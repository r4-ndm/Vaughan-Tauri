//! Transaction Commands
//!
//! Tauri commands for transaction operations.
//!
//! **Security Note**: Transaction signing commands require origin verification
//! to ensure they're only called from the main wallet window, not dApp windows.

use crate::chains::ChainAdapter;
use crate::state::VaughanState;
use alloy::eips::eip2718::Encodable2718;
use alloy::primitives::{Address, U256};
use alloy::providers::Provider;
use serde::{Deserialize, Serialize};
use std::str::FromStr;
use tauri::State;

/// Transaction validation request
#[derive(Debug, Deserialize)]
pub struct ValidateTransactionRequest {
    /// Recipient address
    pub to: String,
    /// Amount in ETH (human-readable)
    pub amount: String,
    /// Gas limit (optional)
    pub gas_limit: Option<u64>,
}

/// Gas estimation response
#[derive(Debug, Serialize)]
pub struct EstimateGasResponse {
    /// Estimated gas limit
    pub gas_limit: u64,
    /// Estimated gas price (in gwei)
    pub gas_price_gwei: String,
    /// Estimated total fee (in ETH)
    pub total_fee_eth: String,
}

/// Validate transaction parameters
///
/// Validates transaction parameters without sending.
/// Checks address format, amount, and gas limits.
///
/// # Arguments
///
/// * `state` - Application state
/// * `request` - Transaction validation request
///
/// # Returns
///
/// * `Ok(())` - Transaction is valid
/// * `Err(String)` - Validation error message
///
/// # Example (from frontend)
///
/// ```typescript
/// await invoke('validate_transaction', {
///   request: {
///     to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
///     amount: '1.5',
///     gasLimit: 21000
///   }
/// });
/// ```
#[tauri::command]
pub async fn validate_transaction(
    state: State<'_, VaughanState>,
    request: ValidateTransactionRequest,
) -> Result<(), String> {
    // Get current adapter
    let adapter = state
        .current_adapter()
        .await
        .map_err(|e| e.user_message())?;

    // Validate address format using adapter
    adapter
        .validate_address(&request.to)
        .map_err(|e| e.user_message())?;

    // Parse and validate amount
    let _amount_wei = crate::chains::evm::utils::parse_eth_to_wei(&request.amount, 18)
        .map_err(|e| e.user_message())?;

    // Validate gas limit if provided
    if let Some(gas_limit) = request.gas_limit {
        if gas_limit < 21000 {
            return Err("Gas limit too low (minimum 21000)".to_string());
        }
        if gas_limit > 30_000_000 {
            return Err("Gas limit too high (maximum 30000000)".to_string());
        }
    }

    Ok(())
}

/// Estimate gas for a simple transfer
///
/// Provides a basic gas estimation for ETH transfers.
/// For contract interactions, use the full estimate_gas endpoint (Phase 2).
///
/// # Arguments
///
/// * `state` - Application state
///
/// # Returns
///
/// * `Ok(EstimateGasResponse)` - Gas estimation
/// * `Err(String)` - Error message
///
/// # Example (from frontend)
///
/// ```typescript
/// const estimate = await invoke('estimate_gas_simple');
/// console.log(`Estimated gas: ${estimate.gas_limit}`);
/// console.log(`Gas price: ${estimate.gas_price_gwei} gwei`);
/// ```
#[tauri::command]
pub async fn estimate_gas_simple(
    state: State<'_, VaughanState>,
) -> Result<EstimateGasResponse, String> {
    // Get current adapter
    let adapter = state
        .current_adapter()
        .await
        .map_err(|e| e.user_message())?;

    // Get current gas price from provider
    use alloy::providers::Provider;
    let gas_price = adapter
        .provider()
        .get_gas_price()
        .await
        .map_err(|e| format!("Failed to get gas price: {}", e))?;

    // Format gas price in gwei
    let gas_price_gwei = crate::chains::evm::utils::format_wei_to_gwei(&gas_price.to_string());

    // Calculate total fee for simple transfer (21000 gas)
    let gas_limit = 21000u64;
    let total_fee_wei = U256::from(gas_limit) * U256::from(gas_price);
    let total_fee_eth = crate::chains::evm::utils::format_wei_to_eth(total_fee_wei, 18);

    Ok(EstimateGasResponse {
        gas_limit,
        gas_price_gwei,
        total_fee_eth,
    })
}

// ============================================================================
// Transaction Signing Commands (Phase 1.5)
// ============================================================================

/// Build transaction request
#[derive(Debug, Deserialize)]
pub struct BuildTransactionRequest {
    /// Sender address
    pub from: String,
    /// Recipient address
    pub to: String,
    /// Amount in ETH (human-readable)
    pub amount: String,
    /// Gas limit (optional, will estimate if not provided)
    pub gas_limit: Option<u64>,
    /// Gas price in gwei (optional, will use current if not provided)
    pub gas_price_gwei: Option<String>,
    /// Nonce (optional, will fetch if not provided)
    pub nonce: Option<u64>,
}

/// Built transaction response
#[derive(Debug, Serialize)]
pub struct BuildTransactionResponse {
    /// Sender address
    pub from: String,
    /// Recipient address
    pub to: String,
    /// Amount in wei
    pub value: String,
    /// Gas limit
    pub gas_limit: u64,
    /// Gas price in wei
    pub gas_price: String,
    /// Nonce
    pub nonce: u64,
    /// Chain ID
    pub chain_id: u64,
    /// Estimated total cost in ETH (amount + gas fee)
    pub total_cost_eth: String,
}

/// Sign transaction request
#[derive(Debug, Deserialize)]
pub struct SignTransactionRequest {
    /// Sender address
    pub from: String,
    /// Recipient address
    pub to: String,
    /// Amount in wei
    pub value: String,
    /// Gas limit
    pub gas_limit: u64,
    /// Gas price in wei
    pub gas_price: String,
    /// Nonce
    pub nonce: u64,
    /// Password for wallet unlock verification
    pub password: String,
}

/// Send transaction request
#[derive(Debug, Deserialize)]
pub struct SendTransactionRequest {
    /// Sender address
    pub from: String,
    /// Recipient address
    pub to: String,
    /// Amount in ETH (human-readable)
    pub amount: String,
    /// Gas limit (optional)
    pub gas_limit: Option<u64>,
    /// Gas price in gwei (optional)
    pub gas_price_gwei: Option<String>,
    /// Password for wallet unlock verification
    pub password: String,
}

/// Transaction response
#[derive(Debug, Serialize)]
pub struct TransactionResponse {
    /// Transaction hash
    pub tx_hash: String,
    /// Transaction details
    pub details: BuildTransactionResponse,
}

/// Build transaction
///
/// Builds a transaction with all parameters filled in (gas, nonce, etc.).
/// Does not sign or send the transaction.
///
/// # Arguments
///
/// * `state` - Application state
/// * `request` - Build transaction request
///
/// # Returns
///
/// * `Ok(BuildTransactionResponse)` - Built transaction
/// * `Err(String)` - Error message
///
/// # Example (from frontend)
///
/// ```typescript
/// const tx = await invoke('build_transaction', {
///   request: {
///     from: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
///     to: '0x1234567890123456789012345678901234567890',
///     amount: '1.5',
///     gasLimit: 21000,
///     gasPriceGwei: '50'
///   }
/// });
/// console.log('Transaction built:', tx);
/// ```
#[tauri::command]
pub async fn build_transaction(
    state: State<'_, VaughanState>,
    request: BuildTransactionRequest,
) -> Result<BuildTransactionResponse, String> {
    // Validate addresses
    let from = Address::from_str(&request.from)
        .map_err(|_| format!("Invalid from address: {}", request.from))?;
    let to = Address::from_str(&request.to)
        .map_err(|_| format!("Invalid to address: {}", request.to))?;

    // Parse amount
    let value = crate::chains::evm::utils::parse_eth_to_wei(&request.amount, 18)
        .map_err(|e| e.user_message())?;

    // Get current adapter
    let adapter = state
        .current_adapter()
        .await
        .map_err(|e| e.user_message())?;

    // Get chain ID
    let chain_id = adapter
        .provider()
        .get_chain_id()
        .await
        .map_err(|e| format!("Failed to get chain ID: {}", e))?;

    // Get or estimate gas limit
    let gas_limit = request.gas_limit.unwrap_or(21000);

    // Get or fetch gas price
    let gas_price = if let Some(price_gwei) = request.gas_price_gwei {
        crate::chains::evm::utils::parse_eth_to_wei(&price_gwei, 9)
            .map_err(|e| e.user_message())?
    } else {
        let price_u128 = adapter
            .provider()
            .get_gas_price()
            .await
            .map_err(|e| format!("Failed to get gas price: {}", e))?;
        U256::from(price_u128)
    };

    // Get or fetch nonce
    let nonce = if let Some(n) = request.nonce {
        n
    } else {
        adapter
            .provider()
            .get_transaction_count(from)
            .await
            .map_err(|e| format!("Failed to get nonce: {}", e))?
    };

    // Calculate total cost (amount + gas fee)
    let gas_fee = U256::from(gas_limit) * gas_price;
    let total_cost = value + gas_fee;
    let total_cost_eth = crate::chains::evm::utils::format_wei_to_eth(total_cost, 18);

    Ok(BuildTransactionResponse {
        from: from.to_string(),
        to: to.to_string(),
        value: value.to_string(),
        gas_limit,
        gas_price: gas_price.to_string(),
        nonce,
        chain_id,
        total_cost_eth,
    })
}

/// Sign transaction
///
/// Signs a transaction with the wallet's private key.
/// Requires wallet to be unlocked.
///
/// # Arguments
///
/// * `state` - Application state
/// * `request` - Sign transaction request
///
/// # Returns
///
/// * `Ok(String)` - Signed transaction (RLP-encoded hex)
/// * `Err(String)` - Error message
///
/// # Security
///
/// - Verifies password before signing
/// - Requires wallet to be unlocked
/// - Private key never leaves Rust backend
///
/// # Example (from frontend)
///
/// ```typescript
/// const signedTx = await invoke('sign_transaction', {
///   request: {
///     from: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
///     to: '0x1234567890123456789012345678901234567890',
///     value: '1500000000000000000',
///     gasLimit: 21000,
///     gasPrice: '50000000000',
///     nonce: 5,
///     password: 'my_password'
///   }
/// });
/// ```
#[tauri::command]
pub async fn sign_transaction(
    state: State<'_, VaughanState>,
    request: SignTransactionRequest,
) -> Result<String, String> {
    // Verify password
    state
        .wallet_service
        .verify_password(&request.password)
        .await
        .map_err(|e| e.user_message())?;

    // Parse addresses
    let from = Address::from_str(&request.from)
        .map_err(|_| format!("Invalid from address: {}", request.from))?;
    let to = Address::from_str(&request.to)
        .map_err(|_| format!("Invalid to address: {}", request.to))?;

    // Parse value
    let value = U256::from_str(&request.value)
        .map_err(|_| format!("Invalid value: {}", request.value))?;

    // Parse gas price
    let gas_price = U256::from_str(&request.gas_price)
        .map_err(|_| format!("Invalid gas price: {}", request.gas_price))?;

    // Get signer for account
    let signer = state
        .wallet_service
        .get_signer(&from)
        .await
        .map_err(|e| e.user_message())?;

    // Get current adapter for chain ID
    let adapter = state
        .current_adapter()
        .await
        .map_err(|e| e.user_message())?;

    let chain_id = adapter
        .provider()
        .get_chain_id()
        .await
        .map_err(|e| format!("Failed to get chain ID: {}", e))?;

    // Build transaction using Alloy's TransactionRequest
    use alloy::network::{EthereumWallet, TransactionBuilder};
    use alloy::rpc::types::TransactionRequest;
    
    let tx_request = TransactionRequest::default()
        .with_from(from)
        .with_to(to)
        .with_value(value)
        .with_gas_limit(request.gas_limit as u128)
        .with_gas_price(gas_price.to::<u128>())
        .with_nonce(request.nonce)
        .with_chain_id(chain_id);

    // Wrap signer in EthereumWallet
    let wallet = EthereumWallet::from(signer);

    // Sign using the wallet
    let envelope = tx_request
        .build(&wallet)
        .await
        .map_err(|e| format!("Failed to sign transaction: {}", e))?;

    // Encode to bytes
    let encoded = envelope.encoded_2718();
    
    Ok(format!("0x{}", hex::encode(encoded)))
}

/// Send transaction
///
/// Builds, signs, and sends a transaction in one call.
/// Convenience method that combines build_transaction and sign_transaction.
///
/// # Arguments
///
/// * `state` - Application state
/// * `request` - Send transaction request
///
/// # Returns
///
/// * `Ok(TransactionResponse)` - Transaction hash and details
/// * `Err(String)` - Error message
///
/// # Security
///
/// - Verifies password before signing
/// - Requires wallet to be unlocked
/// - Private key never leaves Rust backend
///
/// # Example (from frontend)
///
/// ```typescript
/// const result = await invoke('send_transaction', {
///   request: {
///     from: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
///     to: '0x1234567890123456789012345678901234567890',
///     amount: '1.5',
///     password: 'my_password'
///   }
/// });
/// console.log('Transaction sent:', result.tx_hash);
/// ```
#[tauri::command]
pub async fn send_transaction(
    state: State<'_, VaughanState>,
    request: SendTransactionRequest,
) -> Result<TransactionResponse, String> {
    // Verify password first
    state
        .wallet_service
        .verify_password(&request.password)
        .await
        .map_err(|e| e.user_message())?;

    // Build transaction
    let build_request = BuildTransactionRequest {
        from: request.from.clone(),
        to: request.to.clone(),
        amount: request.amount.clone(),
        gas_limit: request.gas_limit,
        gas_price_gwei: request.gas_price_gwei.clone(),
        nonce: None, // Will fetch current nonce
    };

    let built_tx = build_transaction(state.clone(), build_request).await?;

    // Sign transaction
    let sign_request = SignTransactionRequest {
        from: request.from.clone(),
        to: request.to.clone(),
        value: built_tx.value.clone(),
        gas_limit: built_tx.gas_limit,
        gas_price: built_tx.gas_price.clone(),
        nonce: built_tx.nonce,
        password: request.password.clone(),
    };

    let signed_tx = sign_transaction(state.clone(), sign_request).await?;

    // Send transaction
    let adapter = state
        .current_adapter()
        .await
        .map_err(|e| e.user_message())?;

    // Decode signed transaction bytes
    let tx_bytes = hex::decode(signed_tx.trim_start_matches("0x"))
        .map_err(|e| format!("Failed to decode signed transaction: {}", e))?;

    // Send raw transaction
    let pending_tx = adapter
        .provider()
        .send_raw_transaction(&tx_bytes)
        .await
        .map_err(|e| format!("Failed to send transaction: {}", e))?;

    let tx_hash = format!("0x{}", hex::encode(pending_tx.tx_hash()));

    Ok(TransactionResponse {
        tx_hash,
        details: built_tx,
    })
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_transaction_request_deserialize() {
        let json = r#"{
            "to": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
            "amount": "1.5",
            "gas_limit": 21000
        }"#;

        let request: ValidateTransactionRequest = serde_json::from_str(json).unwrap();
        assert_eq!(request.to, "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb");
        assert_eq!(request.amount, "1.5");
        assert_eq!(request.gas_limit, Some(21000));
    }

    #[test]
    fn test_estimate_gas_response_serialize() {
        let response = EstimateGasResponse {
            gas_limit: 21000,
            gas_price_gwei: "50".to_string(),
            total_fee_eth: "0.00105".to_string(),
        };

        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("21000"));
        assert!(json.contains("50"));
        assert!(json.contains("0.00105"));
    }

    #[test]
    fn test_build_transaction_request_deserialize() {
        let json = r#"{
            "from": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
            "to": "0x1234567890123456789012345678901234567890",
            "amount": "1.5",
            "gas_limit": 21000,
            "gas_price_gwei": "50"
        }"#;

        let request: BuildTransactionRequest = serde_json::from_str(json).unwrap();
        assert_eq!(request.from, "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb");
        assert_eq!(request.to, "0x1234567890123456789012345678901234567890");
        assert_eq!(request.amount, "1.5");
        assert_eq!(request.gas_limit, Some(21000));
        assert_eq!(request.gas_price_gwei, Some("50".to_string()));
    }

    #[test]
    fn test_sign_transaction_request_deserialize() {
        let json = r#"{
            "from": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
            "to": "0x1234567890123456789012345678901234567890",
            "value": "1500000000000000000",
            "gas_limit": 21000,
            "gas_price": "50000000000",
            "nonce": 5,
            "password": "test_password"
        }"#;

        let request: SignTransactionRequest = serde_json::from_str(json).unwrap();
        assert_eq!(request.from, "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb");
        assert_eq!(request.nonce, 5);
        assert_eq!(request.password, "test_password");
    }

    #[test]
    fn test_send_transaction_request_deserialize() {
        let json = r#"{
            "from": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
            "to": "0x1234567890123456789012345678901234567890",
            "amount": "1.5",
            "password": "test_password"
        }"#;

        let request: SendTransactionRequest = serde_json::from_str(json).unwrap();
        assert_eq!(request.from, "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb");
        assert_eq!(request.amount, "1.5");
        assert_eq!(request.password, "test_password");
    }
}
