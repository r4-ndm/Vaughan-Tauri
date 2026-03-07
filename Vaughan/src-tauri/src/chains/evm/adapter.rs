// ============================================================================
// Vaughan Wallet - EVM Chain Adapter
// ============================================================================
//
// Implementation of ChainAdapter trait for EVM-compatible chains using Alloy.
//
// CRITICAL: Uses ONLY Alloy libraries (ZERO ethers-rs imports)
//
// ============================================================================

use alloy::{
    network::{EthereumWallet, TransactionBuilder},
    primitives::{utils::format_units, Address as AlloyAddress, Bytes, U256},
    providers::{Provider, ProviderBuilder, RootProvider},
    rpc::types::TransactionRequest,
    signers::local::PrivateKeySigner,
    transports::http::{Client, Http},
};
use async_trait::async_trait;

use crate::chains::{evm::networks::get_network_by_chain_id, types::*, ChainAdapter};
use crate::error::WalletError;

// ============================================================================
// EvmAdapter Struct
// ============================================================================

/// EVM chain adapter using Alloy
///
/// This adapter implements the ChainAdapter trait for all EVM-compatible
/// chains (Ethereum, PulseChain, Polygon, BSC, etc.).
///
/// # Design
///
/// - Uses concrete type `RootProvider<Http<Client>>` (from POC-1 lesson)
/// - Provider is NOT Clone, so we don't wrap in Arc here
/// - Thread-safe when wrapped in Arc by the caller
///
/// # Example
///
/// ```rust,ignore
/// let adapter = EvmAdapter::new(
///     "https://eth.llamarpc.com",
///     "ethereum",
///     1
/// ).await?;
///
/// let balance = adapter.get_balance("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb").await?;
/// println!("Balance: {}", balance.formatted);
/// ```
pub struct EvmAdapter {
    /// Alloy provider (concrete type, not dyn Provider)
    provider: RootProvider<Http<Client>>,

    /// Optional signer for transaction signing
    signer: Option<PrivateKeySigner>,

    /// RPC endpoint URL
    rpc_url: String,

    /// Network identifier
    #[allow(dead_code)]
    network_id: String,

    /// Chain ID
    chain_id: u64,

    /// Network name
    network_name: String,

    /// Native token symbol
    native_symbol: String,

    /// Native token name
    native_name: String,

    /// Block explorer API URL (Etherscan-compatible, optional)
    explorer_api_url: Option<String>,
}

impl EvmAdapter {
    /// Create a new read-only EVM adapter (no signer)
    ///
    /// This adapter can query blockchain state but cannot send transactions.
    /// Use `new_with_signer()` if you need to send transactions.
    ///
    /// # Arguments
    ///
    /// * `rpc_url` - RPC endpoint URL
    /// * `network_id` - Network identifier
    /// * `chain_id` - Chain ID
    ///
    /// # Returns
    ///
    /// * `Result<Self, WalletError>` - New adapter or error
    ///
    /// # Errors
    ///
    /// * `WalletError::NetworkError` - If RPC URL is invalid
    /// * `WalletError::ConnectionFailed` - If connection fails
    ///
    /// # Example
    ///
    /// ```rust,ignore
    /// let adapter = EvmAdapter::new(
    ///     "https://eth.llamarpc.com",
    ///     "ethereum",
    ///     1
    /// ).await?;
    ///
    /// // Can query balance
    /// let balance = adapter.get_balance("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045").await?;
    ///
    /// // Cannot send transactions (will return error)
    /// // adapter.send_transaction(tx).await?; // ERROR
    /// ```
    pub async fn new(
        rpc_url: &str,
        network_id: String,
        chain_id: u64,
    ) -> Result<Self, WalletError> {
        // Parse RPC URL
        let url = rpc_url
            .parse()
            .map_err(|e| WalletError::NetworkError(format!("Invalid RPC URL: {}", e)))?;

        // Create provider using custom rustls client to bypass Windows Schannel NO_REVOCATION bugs
        let reqwest_client = reqwest::Client::builder()
            .use_rustls_tls()
            .build()
            .map_err(|e| {
                WalletError::NetworkError(format!("Failed to build HTTP client: {}", e))
            })?;

        // Configure Alloy Provider
        let transport = alloy::transports::http::Http::with_client(reqwest_client, url);
        let rpc_client = alloy::rpc::client::RpcClient::new(transport, true);
        let provider = ProviderBuilder::new().on_client(rpc_client);

        // Get network info from predefined networks or use defaults
        let (network_name, native_symbol, native_name, explorer_api_url) =
            if let Some(network_config) = get_network_by_chain_id(chain_id) {
                (
                    network_config.name,
                    network_config.native_symbol,
                    network_config.native_name,
                    network_config.explorer_api_url,
                )
            } else {
                (
                    format!("Chain {}", chain_id),
                    "ETH".to_string(),
                    "Ethereum".to_string(),
                    None,
                )
            };

        Ok(Self {
            provider,
            signer: None,
            rpc_url: rpc_url.to_string(),
            network_id,
            chain_id,
            network_name,
            native_symbol,
            native_name,
            explorer_api_url,
        })
    }

    /// Create a new EVM adapter with signer (can send transactions)
    ///
    /// This adapter can both query blockchain state and send transactions.
    ///
    /// # Arguments
    ///
    /// * `rpc_url` - RPC endpoint URL
    /// * `network_id` - Network identifier
    /// * `chain_id` - Chain ID
    /// * `signer` - Private key signer for transaction signing
    ///
    /// # Returns
    ///
    /// * `Result<Self, WalletError>` - New adapter or error
    ///
    /// # Errors
    ///
    /// * `WalletError::NetworkError` - If RPC URL is invalid
    /// * `WalletError::ConnectionFailed` - If connection fails
    ///
    /// # Example
    ///
    /// ```rust,ignore
    /// use alloy::signers::local::PrivateKeySigner;
    ///
    /// let signer: PrivateKeySigner = "0xac0974...".parse()?;
    /// let adapter = EvmAdapter::new_with_signer(
    ///     "https://eth.llamarpc.com",
    ///     "ethereum",
    ///     1,
    ///     signer,
    /// ).await?;
    ///
    /// // Can query balance
    /// let balance = adapter.get_balance("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045").await?;
    ///
    /// // Can send transactions
    /// let tx_hash = adapter.send_transaction(tx).await?;
    /// ```
    pub async fn new_with_signer(
        rpc_url: &str,
        network_id: String,
        chain_id: u64,
        signer: PrivateKeySigner,
    ) -> Result<Self, WalletError> {
        // Parse RPC URL
        let url = rpc_url
            .parse()
            .map_err(|e| WalletError::NetworkError(format!("Invalid RPC URL: {}", e)))?;

        // Create provider using custom rustls client to bypass Windows Schannel NO_REVOCATION bugs
        let reqwest_client = reqwest::Client::builder()
            .use_rustls_tls()
            .build()
            .map_err(|e| {
                WalletError::NetworkError(format!("Failed to build HTTP client: {}", e))
            })?;

        // Configure Alloy Provider
        let transport = alloy::transports::http::Http::with_client(reqwest_client, url);
        let rpc_client = alloy::rpc::client::RpcClient::new(transport, true);
        let provider = ProviderBuilder::new().on_client(rpc_client);

        // Get network info from predefined networks or use defaults
        let (network_name, native_symbol, native_name, explorer_api_url) =
            if let Some(network_config) = get_network_by_chain_id(chain_id) {
                (
                    network_config.name,
                    network_config.native_symbol,
                    network_config.native_name,
                    network_config.explorer_api_url,
                )
            } else {
                (
                    format!("Chain {}", chain_id),
                    "ETH".to_string(),
                    "Ethereum".to_string(),
                    None,
                )
            };

        Ok(Self {
            provider,
            signer: Some(signer),
            rpc_url: rpc_url.to_string(),
            network_id,
            chain_id,
            network_name,
            native_symbol,
            native_name,
            explorer_api_url,
        })
    }

    /// Get RPC URL
    ///
    /// # Returns
    ///
    /// * `&str` - RPC endpoint URL
    pub fn rpc_url(&self) -> &str {
        &self.rpc_url
    }

    /// Get provider reference
    ///
    /// # Returns
    ///
    /// * `&RootProvider<Http<Client>>` - Alloy provider
    pub fn provider(&self) -> &RootProvider<Http<Client>> {
        &self.provider
    }

    /// Parse address string to Alloy Address
    fn parse_address(&self, address: &str) -> Result<AlloyAddress, WalletError> {
        address
            .parse()
            .map_err(|_| WalletError::InvalidAddress(address.to_string()))
    }

    /// Format wei to human-readable amount
    fn format_wei(&self, wei: U256) -> String {
        format_units(wei, 18).unwrap_or_else(|_| "0".to_string())
    }

    /// Get transaction history from block explorer API
    ///
    /// Uses Etherscan-compatible API to fetch transaction history.
    /// Returns empty vec if no API URL is configured for this network.
    ///
    /// # Arguments
    ///
    /// * `address` - Account address
    /// * `limit` - Max number of transactions to return
    ///
    /// # Returns
    ///
    /// * `Ok(Vec<serde_json::Value>)` - List of transaction objects
    /// * `Err(WalletError)` - API error
    pub async fn get_transaction_history(
        &self,
        address: &str,
        limit: u32,
    ) -> Result<Vec<serde_json::Value>, WalletError> {
        let api_url = match &self.explorer_api_url {
            Some(url) => url.clone(),
            None => {
                eprintln!(
                    "[EvmAdapter] No explorer API URL for chain {}",
                    self.chain_id
                );
                return Ok(vec![]);
            },
        };

        let url = format!(
            "{}?module=account&action=txlist&address={}&startblock=0&endblock=99999999&sort=desc&offset={}",
            api_url, address, limit
        );

        eprintln!("[EvmAdapter] Fetching tx history from: {}", url);

        let client = reqwest::Client::builder()
            .use_rustls_tls()
            .timeout(std::time::Duration::from_secs(15))
            .build()
            .map_err(|e| WalletError::NetworkError(format!("HTTP client error: {}", e)))?;

        let resp = client
            .get(&url)
            .header("Accept", "application/json")
            .send()
            .await
            .map_err(|e| {
                WalletError::NetworkError(format!("Explorer API request failed: {}", e))
            })?;

        let json: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| WalletError::NetworkError(format!("Explorer API parse error: {}", e)))?;

        // Etherscan API returns { status: "1", result: [...] } on success
        // or { status: "0", result: "No transactions found" } when empty
        let status = json.get("status").and_then(|s| s.as_str()).unwrap_or("0");
        if status != "1" {
            eprintln!(
                "[EvmAdapter] Explorer API returned status 0 (no txns or error): {:?}",
                json.get("message")
            );
            return Ok(vec![]);
        }

        let txns = json
            .get("result")
            .and_then(|r| r.as_array())
            .cloned()
            .unwrap_or_default();

        eprintln!(
            "[EvmAdapter] Got {} transactions from explorer API",
            txns.len()
        );
        Ok(txns)
    }

    /// Get ERC20 token transfer history from block explorer API
    ///
    /// Uses `action=tokentx` on the Etherscan-compatible API.
    /// Returns empty vec if no API URL is configured for this network.
    ///
    /// # Arguments
    ///
    /// * `address` - Account address
    /// * `limit` - Max number of token transfers to return
    pub async fn get_token_transfer_history(
        &self,
        address: &str,
        limit: u32,
    ) -> Result<Vec<serde_json::Value>, WalletError> {
        let api_url = match &self.explorer_api_url {
            Some(url) => url.clone(),
            None => return Ok(vec![]),
        };

        let url = format!(
            "{}?module=account&action=tokentx&address={}&startblock=0&endblock=99999999&sort=desc&offset={}",
            api_url, address, limit
        );

        eprintln!("[EvmAdapter] Fetching token tx history from: {}", url);

        let client = reqwest::Client::builder()
            .use_rustls_tls()
            .timeout(std::time::Duration::from_secs(15))
            .build()
            .map_err(|e| WalletError::NetworkError(format!("HTTP client error: {}", e)))?;

        let resp = client
            .get(&url)
            .header("Accept", "application/json")
            .send()
            .await
            .map_err(|e| WalletError::NetworkError(format!("Explorer token API failed: {}", e)))?;

        let json: serde_json::Value = resp.json().await.map_err(|e| {
            WalletError::NetworkError(format!("Explorer token API parse error: {}", e))
        })?;

        let status = json.get("status").and_then(|s| s.as_str()).unwrap_or("0");
        if status != "1" {
            eprintln!(
                "[EvmAdapter] Token tx API returned status 0: {:?}",
                json.get("message")
            );
            return Ok(vec![]);
        }

        let txns = json
            .get("result")
            .and_then(|r| r.as_array())
            .cloned()
            .unwrap_or_default();

        eprintln!(
            "[EvmAdapter] Got {} token transfers from explorer API",
            txns.len()
        );
        Ok(txns)
    }
}

// ============================================================================
// ChainAdapter Implementation
// ============================================================================

#[async_trait]
impl ChainAdapter for EvmAdapter {
    // ========================================================================
    // Balance Operations
    // ========================================================================

    async fn get_balance(&self, address: &str) -> Result<Balance, WalletError> {
        // Validate and parse address
        let addr = self.parse_address(address)?;

        // Get balance from provider
        let balance_wei = self
            .provider
            .get_balance(addr)
            .await
            .map_err(WalletError::from)?;

        // Format balance
        let formatted = format!("{} {}", self.format_wei(balance_wei), self.native_symbol);

        // Create token info
        let token = TokenInfo::native(self.native_symbol.clone(), self.native_name.clone(), 18);

        // Create balance
        Ok(Balance::new(token, balance_wei.to_string(), formatted))
    }

    // ========================================================================
    // Transaction Operations
    // ========================================================================

    async fn send_transaction(&self, tx: ChainTransaction) -> Result<TxHash, WalletError> {
        // Extract EVM transaction
        let evm_tx = match tx {
            ChainTransaction::Evm(tx) => tx,
            _ => {
                return Err(WalletError::InvalidTransaction(
                    "Expected EVM transaction".to_string(),
                ))
            },
        };

        // Check if signer exists (clone needed — ProviderBuilder::wallet takes ownership)
        let signer = self
            .signer
            .as_ref()
            .ok_or_else(|| {
                WalletError::SignerNotAvailable(
                    "Cannot send transaction: adapter has no signer (use new_with_signer)"
                        .to_string(),
                )
            })?
            .clone();

        // Parse recipient address
        let to_addr: AlloyAddress = evm_tx
            .to
            .parse()
            .map_err(|e| WalletError::InvalidAddress(format!("Invalid 'to' address: {}", e)))?;

        // Parse value (wei)
        let value = U256::from_str_radix(&evm_tx.value, 10).unwrap_or_else(|_| {
            // Try hex parsing as fallback
            evm_tx.value.parse::<U256>().unwrap_or(U256::ZERO)
        });

        // Build Alloy TransactionRequest from our EvmTransaction
        let mut tx_request = TransactionRequest::default()
            .with_to(to_addr)
            .with_value(value)
            .with_chain_id(evm_tx.chain_id);

        // Set gas limit if provided
        if let Some(gas_limit) = evm_tx.gas_limit {
            tx_request = tx_request.with_gas_limit(gas_limit as u128);
        }

        // Set gas price (legacy) if provided
        if let Some(ref gas_price_str) = evm_tx.gas_price {
            if let Ok(gas_price) = gas_price_str.parse::<u128>() {
                tx_request = tx_request.with_gas_price(gas_price);
            }
        }

        // Set EIP-1559 fields if provided
        if let Some(ref max_fee) = evm_tx.max_fee_per_gas {
            if let Ok(max_fee_val) = max_fee.parse::<u128>() {
                tx_request = tx_request.with_max_fee_per_gas(max_fee_val);
            }
        }
        if let Some(ref max_priority_fee) = evm_tx.max_priority_fee_per_gas {
            if let Ok(max_priority_val) = max_priority_fee.parse::<u128>() {
                tx_request = tx_request.with_max_priority_fee_per_gas(max_priority_val);
            }
        }

        // Set nonce if provided
        if let Some(nonce) = evm_tx.nonce {
            tx_request = tx_request.with_nonce(nonce);
        }

        // Set data if provided (for contract calls)
        if let Some(ref data_hex) = evm_tx.data {
            let data_str = data_hex.strip_prefix("0x").unwrap_or(data_hex);
            if let Ok(data_bytes) = hex::decode(data_str) {
                tx_request = tx_request.with_input(Bytes::from(data_bytes));
            }
        }

        // Construct a signing provider on-demand using the stored signer and RPC URL.
        // This is the correct Alloy pattern: ProviderBuilder::new().wallet(wallet).on_client(...)
        let wallet = EthereumWallet::from(signer);
        let rpc_url = self.rpc_url.parse().map_err(|e| {
            WalletError::NetworkError(format!("Invalid RPC URL for signing provider: {}", e))
        })?;

        // Create custom rustls client to bypass Windows Schannel NO_REVOCATION bugs
        let reqwest_client_sign = reqwest::Client::builder()
            .use_rustls_tls()
            .build()
            .map_err(|e| {
                WalletError::NetworkError(format!("Failed to build HTTP client for signing: {}", e))
            })?;

        let signing_transport =
            alloy::transports::http::Http::with_client(reqwest_client_sign, rpc_url);
        let signing_rpc_client = alloy::rpc::client::RpcClient::new(signing_transport, true);

        let signing_provider = ProviderBuilder::new()
            .wallet(wallet)
            .on_client(signing_rpc_client);

        // Send the transaction and get the pending transaction handle
        let pending_tx = signing_provider
            .send_transaction(tx_request)
            .await
            .map_err(|e| {
                WalletError::TransactionFailed(format!("Failed to send transaction: {}", e))
            })?;

        // Return the transaction hash
        let hash = pending_tx.tx_hash();
        Ok(TxHash(format!("{:?}", hash)))
    }

    async fn sign_message(&self, address: &str, message: &[u8]) -> Result<Signature, WalletError> {
        // Check if signer exists
        let signer = self.signer.as_ref().ok_or_else(|| {
            WalletError::SignerNotAvailable(
                "Cannot sign message: adapter has no signer (use new_with_signer)".to_string(),
            )
        })?;

        // Parse address
        let addr = address
            .parse::<AlloyAddress>()
            .map_err(|_| WalletError::InvalidAddress(address.to_string()))?;

        // Verify address matches signer
        if signer.address() != addr {
            return Err(WalletError::InvalidAddress(format!(
                "Address {} does not match signer address {}",
                address,
                signer.address()
            )));
        }

        // Sign message using Alloy's Signer trait
        // This implements EIP-191 (personal_sign) by default
        use alloy::signers::Signer as AlloySigner;
        let signature = signer
            .sign_message(message)
            .await
            .map_err(|e| WalletError::SigningFailed(format!("Failed to sign message: {}", e)))?;

        // Convert Alloy signature to our Signature type
        // Alloy signature format: 0x + 65 bytes hex (r + s + v)
        let sig_hex = format!("{:?}", signature);

        Ok(Signature::new(sig_hex))
    }

    async fn get_transactions(
        &self,
        _address: &str,
        _limit: u32,
    ) -> Result<Vec<TxRecord>, WalletError> {
        // TODO: Implement transaction history
        // This requires either:
        // 1. Block explorer API integration
        // 2. Scanning blocks (slow)
        // For now, return empty list
        Ok(Vec::new())
    }

    // ========================================================================
    // Fee Estimation
    // ========================================================================

    async fn estimate_fee(&self, tx: &ChainTransaction) -> Result<Fee, WalletError> {
        // Extract EVM transaction
        let evm_tx = match tx {
            ChainTransaction::Evm(tx) => tx,
            _ => {
                return Err(WalletError::InvalidTransaction(
                    "Expected EVM transaction".to_string(),
                ))
            },
        };

        // Get gas price
        let gas_price = self
            .provider
            .get_gas_price()
            .await
            .map_err(WalletError::from)?;

        // Use provided gas limit or default to 21000
        let gas_limit = evm_tx.gas_limit.unwrap_or(21000);

        // Calculate fee: gas_limit * gas_price
        let fee_wei = U256::from(gas_limit) * U256::from(gas_price);

        // Format fee
        let formatted = format!("{} {}", self.format_wei(fee_wei), self.native_symbol);

        // Create fee estimate
        Ok(Fee::new(fee_wei.to_string(), formatted).with_gas(gas_limit, gas_price.to_string()))
    }

    // ========================================================================
    // Address Validation
    // ========================================================================

    fn validate_address(&self, address: &str) -> Result<(), WalletError> {
        // Try to parse address
        self.parse_address(address)?;
        Ok(())
    }

    // ========================================================================
    // Chain Information
    // ========================================================================

    fn chain_info(&self) -> ChainInfo {
        let native_token =
            TokenInfo::native(self.native_symbol.clone(), self.native_name.clone(), 18);

        ChainInfo::new(
            ChainType::Evm,
            Some(self.chain_id),
            self.network_name.clone(),
            native_token,
        )
    }

    fn chain_type(&self) -> ChainType {
        ChainType::Evm
    }
}

// ============================================================================
// Additional Helper Methods (for dApp integration)
// ============================================================================

impl EvmAdapter {
    /// Get current gas price
    ///
    /// # Returns
    ///
    /// * `Ok(u128)` - Gas price in wei
    /// * `Err(WalletError)` - Failed to get gas price
    pub async fn get_gas_price(&self) -> Result<u128, WalletError> {
        self.provider
            .get_gas_price()
            .await
            .map_err(WalletError::from)
    }

    /// Get transaction count (nonce) for address
    ///
    /// # Arguments
    ///
    /// * `address` - Address to get nonce for
    ///
    /// # Returns
    ///
    /// * `Ok(u64)` - Transaction count (nonce)
    /// * `Err(WalletError)` - Failed to get nonce
    pub async fn get_transaction_count(&self, address: AlloyAddress) -> Result<u64, WalletError> {
        self.provider
            .get_transaction_count(address)
            .pending()
            .await
            .map_err(WalletError::from)
    }

    /// Get current block number
    ///
    /// # Returns
    ///
    /// * `Ok(u64)` - Current block number
    /// * `Err(WalletError)` - Failed to get block number
    pub async fn get_block_number(&self) -> Result<u64, WalletError> {
        self.provider
            .get_block_number()
            .await
            .map_err(WalletError::from)
    }

    /// Call a smart contract function (read-only, no gas cost)
    ///
    /// This is a raw passthrough to the underlying RPC `eth_call`.
    ///
    /// # Arguments
    ///
    /// * `tx` - Transaction request (from/to/data)
    ///
    /// # Returns
    ///
    /// * `Ok(Bytes)` - Return data from the contract call
    /// * `Err(WalletError)` - Call reverted or failed
    pub async fn call(&self, tx: TransactionRequest) -> Result<Bytes, WalletError> {
        self.provider
            .call(&tx)
            .await
            .map_err(|e| WalletError::Custom(format!("eth_call failed: {}", e)))
    }

    /// Estimate gas for a transaction
    ///
    /// # Arguments
    ///
    /// * `tx` - Transaction request
    ///
    /// # Returns
    ///
    /// * `Ok(u128)` - Estimated gas limit
    /// * `Err(WalletError)` - Estimation failed
    pub async fn estimate_gas(&self, tx: TransactionRequest) -> Result<u128, WalletError> {
        self.provider
            .estimate_gas(&tx)
            .await
            .map_err(|e| WalletError::Custom(format!("eth_estimateGas failed: {}", e)))
    }

    /// Get transaction by hash
    ///
    /// # Arguments
    ///
    /// * `hash` - Transaction hash (hex string with 0x prefix)
    ///
    /// # Returns
    ///
    /// * `Ok(Option<serde_json::Value>)` - Transaction or None if not found
    /// * `Err(WalletError)` - RPC error
    pub async fn get_transaction_by_hash(
        &self,
        hash: &str,
    ) -> Result<Option<serde_json::Value>, WalletError> {
        use alloy::primitives::TxHash;
        let tx_hash: TxHash = hash
            .parse()
            .map_err(|_| WalletError::Custom(format!("Invalid transaction hash: {}", hash)))?;

        let tx = self
            .provider
            .get_transaction_by_hash(tx_hash)
            .await
            .map_err(|e| WalletError::Custom(format!("eth_getTransactionByHash failed: {}", e)))?;

        Ok(tx.map(|t| serde_json::to_value(t).unwrap_or(serde_json::Value::Null)))
    }

    /// Get transaction receipt by hash
    ///
    /// # Arguments
    ///
    /// * `hash` - Transaction hash (hex string with 0x prefix)
    ///
    /// # Returns
    ///
    /// * `Ok(Option<serde_json::Value>)` - Receipt or None if pending
    /// * `Err(WalletError)` - RPC error
    pub async fn get_transaction_receipt(
        &self,
        hash: &str,
    ) -> Result<Option<serde_json::Value>, WalletError> {
        use alloy::primitives::TxHash;
        let tx_hash: TxHash = hash
            .parse()
            .map_err(|_| WalletError::Custom(format!("Invalid transaction hash: {}", hash)))?;

        let receipt = self
            .provider
            .get_transaction_receipt(tx_hash)
            .await
            .map_err(|e| WalletError::Custom(format!("eth_getTransactionReceipt failed: {}", e)))?;

        Ok(receipt.map(|r| serde_json::to_value(r).unwrap_or(serde_json::Value::Null)))
    }

    /// Get chain ID
    ///
    /// # Returns
    ///
    /// * `u64` - Chain ID
    pub fn chain_id(&self) -> u64 {
        self.chain_id
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_adapter_creation() {
        let adapter = EvmAdapter::new("https://eth.llamarpc.com", "ethereum".to_string(), 1).await;

        assert!(adapter.is_ok());
        let adapter = adapter.unwrap();
        assert_eq!(adapter.chain_id, 1);
        assert_eq!(adapter.network_id, "ethereum");
    }

    #[test]
    fn test_address_validation() {
        // Test address validation without needing a provider
        // Use a valid Ethereum address (Vitalik's address)
        let valid_addr = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
        let invalid_addr = "invalid";

        // Valid address should parse
        assert!(valid_addr.parse::<AlloyAddress>().is_ok());

        // Invalid address should fail
        assert!(invalid_addr.parse::<AlloyAddress>().is_err());
        assert!("0xinvalid".parse::<AlloyAddress>().is_err());
    }

    #[test]
    fn test_chain_info() {
        // Test chain info construction without needing a provider
        let _network_id = "ethereum".to_string();
        let chain_id = 1u64;
        let network_name = "Ethereum Mainnet".to_string();
        let native_symbol = "ETH".to_string();
        let native_name = "Ethereum".to_string();

        let token = TokenInfo::native(native_symbol.clone(), native_name.clone(), 18);

        let info = ChainInfo::new(ChainType::Evm, Some(chain_id), network_name.clone(), token);

        assert_eq!(info.chain_type, ChainType::Evm);
        assert_eq!(info.chain_id, Some(1));
        assert_eq!(info.name, "Ethereum Mainnet");
        assert_eq!(info.native_token.symbol, "ETH");
    }
}
