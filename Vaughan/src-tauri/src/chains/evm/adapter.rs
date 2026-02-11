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
    primitives::{utils::format_units, Address as AlloyAddress, U256},
    providers::{Provider, ProviderBuilder, RootProvider},
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
    /// None = read-only adapter (can query but not send)
    /// Some = full adapter (can query and send transactions)
    signer: Option<PrivateKeySigner>,

    /// RPC endpoint URL
    rpc_url: String,

    /// Network identifier (e.g., "ethereum", "pulsechain")
    network_id: String,

    /// Chain ID (e.g., 1 for Ethereum, 369 for PulseChain)
    chain_id: u64,

    /// Network name (e.g., "Ethereum Mainnet")
    network_name: String,

    /// Native token symbol (e.g., "ETH", "PLS")
    native_symbol: String,

    /// Native token name (e.g., "Ethereum", "PulseChain")
    native_name: String,
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

        // Create provider using ProviderBuilder
        let provider = ProviderBuilder::new().on_http(url);

        // Get network info from predefined networks or use defaults
        let (network_name, native_symbol, native_name) =
            if let Some(network_config) = get_network_by_chain_id(chain_id) {
                (
                    network_config.name,
                    network_config.native_symbol,
                    network_config.native_name,
                )
            } else {
                // Fallback for unknown networks
                (
                    format!("Chain {}", chain_id),
                    "ETH".to_string(),
                    "Ethereum".to_string(),
                )
            };

        Ok(Self {
            provider,
            signer: None, // Read-only adapter
            rpc_url: rpc_url.to_string(),
            network_id,
            chain_id,
            network_name,
            native_symbol,
            native_name,
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

        // Create provider using ProviderBuilder
        let provider = ProviderBuilder::new().on_http(url);

        // Get network info from predefined networks or use defaults
        let (network_name, native_symbol, native_name) =
            if let Some(network_config) = get_network_by_chain_id(chain_id) {
                (
                    network_config.name,
                    network_config.native_symbol,
                    network_config.native_name,
                )
            } else {
                // Fallback for unknown networks
                (
                    format!("Chain {}", chain_id),
                    "ETH".to_string(),
                    "Ethereum".to_string(),
                )
            };

        Ok(Self {
            provider,
            signer: Some(signer), // Full adapter with signer
            rpc_url: rpc_url.to_string(),
            network_id,
            chain_id,
            network_name,
            native_symbol,
            native_name,
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
        let _evm_tx = match tx {
            ChainTransaction::Evm(tx) => tx,
            _ => {
                return Err(WalletError::InvalidTransaction(
                    "Expected EVM transaction".to_string(),
                ))
            },
        };

        // Check if signer exists
        let _signer = self.signer.as_ref().ok_or_else(|| {
            WalletError::SignerNotAvailable(
                "Cannot send transaction: adapter has no signer (use new_with_signer)".to_string(),
            )
        })?;

        // TODO: Implement transaction sending with Alloy
        // This requires resolving Alloy's type inference issues with ProviderBuilder + wallet
        // For now, return a clear error message
        // Will be implemented in wallet integration phase when we have better context
        Err(WalletError::InternalError(
            "Transaction sending with signer not yet fully implemented (Alloy type inference issues)".to_string()
        ))
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
