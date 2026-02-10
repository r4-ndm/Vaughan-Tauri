///! RPC Method Handler (Router Pattern)
///!
///! Routes dApp requests to appropriate handlers
///!
///! **PHASE 3.4 UPDATE**: Now accepts window_label for proper approval routing

use crate::error::WalletError;
use crate::state::VaughanState;
use alloy::primitives::{Address, U256};
use serde_json::Value;

/// Handle dApp RPC request
///
/// **PHASE 3.4**: Now accepts window_label for approval routing
///
/// # Arguments
///
/// * `state` - Application state
/// * `window_label` - Window identifier (for approval routing)
/// * `origin` - dApp origin
/// * `method` - RPC method
/// * `params` - Method parameters
///
/// # Returns
///
/// * `Ok(Value)` - Method result
/// * `Err(WalletError)` - Method failed
pub async fn handle_request(
    state: &VaughanState,
    window_label: &str,
    origin: &str,
    method: &str,
    params: Vec<Value>,
) -> Result<Value, WalletError> {
    // Route to appropriate handler
    match method {
        // Account Management
        "eth_requestAccounts" => handle_request_accounts(state, window_label, origin).await,
        "eth_accounts" => handle_accounts(state, window_label, origin).await,

        // Network Info
        "eth_chainId" => handle_chain_id(state).await,
        "net_version" => handle_net_version(state).await,

        // Read Operations (passthrough to RPC)
        "eth_getBalance" => handle_get_balance(state, params).await,
        "eth_blockNumber" => handle_block_number(state).await,
        "eth_call" => handle_call(state, params).await,
        "eth_estimateGas" => handle_estimate_gas(state, params).await,
        "eth_gasPrice" => handle_gas_price(state).await,
        "eth_getTransactionCount" => handle_get_transaction_count(state, params).await,
        "eth_getTransactionByHash" => handle_get_transaction_by_hash(state, params).await,
        "eth_getTransactionReceipt" => handle_get_transaction_receipt(state, params).await,

        // Write Operations (require approval)
        "eth_sendTransaction" => handle_send_transaction(state, window_label, origin, params).await,
        "personal_sign" => handle_personal_sign(state, window_label, origin, params).await,
        "eth_signTypedData_v4" => handle_sign_typed_data_v4(state, window_label, origin, params).await,

        // Network Switching (require approval)
        "wallet_switchEthereumChain" => handle_switch_chain(state, window_label, origin, params).await,
        "wallet_addEthereumChain" => handle_add_chain(state, window_label, origin, params).await,

        // Unsupported
        _ => Err(WalletError::UnsupportedMethod(method.to_string())),
    }
}

// ============================================================================
// Account Management Handlers
// ============================================================================

async fn handle_request_accounts(
    state: &VaughanState,
    window_label: &str,
    origin: &str,
) -> Result<Value, WalletError> {
    // Check if already connected for this window
    if let Some(connection) = state.session_manager.get_session_by_window(window_label, origin).await {
        // Return connected accounts
        let accounts: Vec<String> = connection
            .accounts
            .iter()
            .map(|addr| format!("{:?}", addr))
            .collect();
        return Ok(serde_json::json!(accounts));
    }

    // Not connected - create approval request
    use crate::dapp::ApprovalRequestType;

    let request_type = ApprovalRequestType::Connection {
        origin: origin.to_string(),
    };

    // Create approval request (5 minute timeout) with window_label
    let (_id, rx) = state
        .approval_queue
        .add_request(window_label.to_string(), request_type)
        .await?;

    // Wait for user response
    let response = rx
        .await
        .map_err(|_| WalletError::Custom("Approval request cancelled".to_string()))?;

    // Check if approved
    if !response.approved {
        return Err(WalletError::UserRejected);
    }

    // Get active account
    let account = state.active_account().await?;

    // Create session for this window
    state
        .session_manager
        .create_session_for_window(
            window_label,
            origin,
            None, // name
            None, // icon
            vec![account],
        )
        .await?;

    // Return accounts
    let accounts = vec![format!("{:?}", account)];
    Ok(serde_json::json!(accounts))
}

async fn handle_accounts(
    state: &VaughanState,
    window_label: &str,
    origin: &str,
) -> Result<Value, WalletError> {
    // Check if connected for this window
    if let Some(connection) = state.session_manager.get_session_by_window(window_label, origin).await {
        let accounts: Vec<String> = connection
            .accounts
            .iter()
            .map(|addr| format!("{:?}", addr))
            .collect();
        Ok(serde_json::json!(accounts))
    } else {
        // Not connected - return empty array
        Ok(serde_json::json!([]))
    }
}

// ============================================================================
// Network Info Handlers
// ============================================================================

async fn handle_chain_id(state: &VaughanState) -> Result<Value, WalletError> {
    let adapter = state.current_adapter().await?;
    let chain_id = adapter.chain_id();
    Ok(serde_json::json!(format!("0x{:x}", chain_id)))
}

async fn handle_net_version(state: &VaughanState) -> Result<Value, WalletError> {
    let adapter = state.current_adapter().await?;
    let chain_id = adapter.chain_id();
    Ok(serde_json::json!(chain_id.to_string()))
}

// ============================================================================
// Read Operation Handlers (Passthrough to RPC)
// ============================================================================

async fn handle_get_balance(state: &VaughanState, params: Vec<Value>) -> Result<Value, WalletError> {
    // Parse params
    let address_str = params
        .get(0)
        .and_then(|v| v.as_str())
        .ok_or(WalletError::InvalidParams)?;

    // Get balance using ChainAdapter trait
    let adapter = state.current_adapter().await?;
    
    // Call trait method on Arc<EvmAdapter>
    use crate::chains::ChainAdapter;
    let balance = adapter.get_balance(address_str).await?;

    // Return balance in wei as hex string
    Ok(serde_json::json!(format!("0x{}", balance.raw)))
}

async fn handle_block_number(state: &VaughanState) -> Result<Value, WalletError> {
    let adapter = state.current_adapter().await?;
    let block_number = adapter.get_block_number().await?;
    Ok(serde_json::json!(format!("0x{:x}", block_number)))
}

async fn handle_call(_state: &VaughanState, _params: Vec<Value>) -> Result<Value, WalletError> {
    // For now, return unsupported (will implement in Phase 3.2)
    Err(WalletError::UnsupportedMethod("eth_call".to_string()))
}

async fn handle_estimate_gas(_state: &VaughanState, _params: Vec<Value>) -> Result<Value, WalletError> {
    // For now, return unsupported (will implement in Phase 3.2)
    Err(WalletError::UnsupportedMethod("eth_estimateGas".to_string()))
}

async fn handle_gas_price(state: &VaughanState) -> Result<Value, WalletError> {
    let adapter = state.current_adapter().await?;
    let gas_price = adapter.get_gas_price().await?;
    Ok(serde_json::json!(format!("0x{:x}", gas_price)))
}

async fn handle_get_transaction_count(
    state: &VaughanState,
    params: Vec<Value>,
) -> Result<Value, WalletError> {
    // Parse params
    let address = params
        .get(0)
        .and_then(|v| v.as_str())
        .ok_or(WalletError::InvalidParams)?;

    let address: Address = address.parse().map_err(|_| WalletError::InvalidAddress(address.to_string()))?;

    // Get nonce
    let adapter = state.current_adapter().await?;
    let nonce = adapter.get_transaction_count(address).await?;

    Ok(serde_json::json!(format!("0x{:x}", nonce)))
}

async fn handle_get_transaction_by_hash(
    state: &VaughanState,
    params: Vec<Value>,
) -> Result<Value, WalletError> {
    // For now, return unsupported (will implement in Phase 3.2)
    Err(WalletError::UnsupportedMethod("eth_getTransactionByHash".to_string()))
}

async fn handle_get_transaction_receipt(
    state: &VaughanState,
    params: Vec<Value>,
) -> Result<Value, WalletError> {
    // For now, return unsupported (will implement in Phase 3.2)
    Err(WalletError::UnsupportedMethod("eth_getTransactionReceipt".to_string()))
}

// ============================================================================
// Write Operation Handlers (Require Approval)
// ============================================================================

async fn handle_send_transaction(
    state: &VaughanState,
    window_label: &str,
    origin: &str,
    params: Vec<Value>,
) -> Result<Value, WalletError> {
    // Parse transaction parameters
    let tx_obj = params
        .get(0)
        .and_then(|v| v.as_object())
        .ok_or(WalletError::InvalidParams)?;

    // Extract transaction fields
    let from = tx_obj
        .get("from")
        .and_then(|v| v.as_str())
        .ok_or(WalletError::InvalidParams)?;
    
    let to = tx_obj
        .get("to")
        .and_then(|v| v.as_str())
        .ok_or(WalletError::InvalidParams)?;
    
    let value = tx_obj
        .get("value")
        .and_then(|v| v.as_str())
        .unwrap_or("0x0");
    
    let gas_limit = tx_obj
        .get("gas")
        .or_else(|| tx_obj.get("gasLimit"))
        .and_then(|v| v.as_str())
        .and_then(|s| u64::from_str_radix(s.trim_start_matches("0x"), 16).ok());
    
    let gas_price = tx_obj
        .get("gasPrice")
        .and_then(|v| v.as_str());
    
    let data = tx_obj
        .get("data")
        .and_then(|v| v.as_str());

    // Validate addresses
    let from_addr: Address = from.parse()
        .map_err(|_| WalletError::InvalidAddress(from.to_string()))?;
    let to_addr: Address = to.parse()
        .map_err(|_| WalletError::InvalidAddress(to.to_string()))?;

    // Parse value (hex string to U256)
    let value_u256 = if value.starts_with("0x") {
        U256::from_str_radix(value.trim_start_matches("0x"), 16)
            .map_err(|_| WalletError::InvalidParams)?
    } else {
        U256::from_str_radix(value, 10)
            .map_err(|_| WalletError::InvalidParams)?
    };

    // Format value for display (in ETH)
    let value_eth = crate::chains::evm::utils::format_wei_to_eth(value_u256, 18);

    // Get gas price if not provided
    let adapter = state.current_adapter().await?;
    let gas_price_u256 = if let Some(price_hex) = gas_price {
        if price_hex.starts_with("0x") {
            U256::from_str_radix(price_hex.trim_start_matches("0x"), 16)
                .map_err(|_| WalletError::InvalidParams)?
        } else {
            U256::from_str_radix(price_hex, 10)
                .map_err(|_| WalletError::InvalidParams)?
        }
    } else {
        let price = adapter.get_gas_price().await?;
        U256::from(price)
    };

    // Estimate gas if not provided
    let gas_limit_final = gas_limit.unwrap_or(21000);

    // Create approval request
    use crate::dapp::ApprovalRequestType;
    let request_type = ApprovalRequestType::Transaction {
        origin: origin.to_string(),
        from: from.to_string(),
        to: to.to_string(),
        value: value_eth,
        gas_limit: Some(gas_limit_final),
        gas_price: Some(gas_price_u256.to_string()),
        data: data.map(|s| s.to_string()),
    };

    // Add to approval queue and wait for response (with window_label)
    let (id, rx) = state.approval_queue.add_request(window_label.to_string(), request_type).await?;

    // Wait for user response (with 5 minute timeout)
    let response = tokio::time::timeout(
        tokio::time::Duration::from_secs(300),
        rx
    )
    .await
    .map_err(|_| WalletError::Custom("Approval request timed out".to_string()))?
    .map_err(|_| WalletError::Custom("Approval channel closed".to_string()))?;

    // Check if approved
    if !response.approved {
        return Err(WalletError::UserRejected);
    }

    // Get password from response data
    let password = response.data
        .and_then(|d| d.get("password").cloned())
        .and_then(|p| p.as_str().map(|s| s.to_string()))
        .ok_or(WalletError::Custom("Password required for transaction".to_string()))?;

    // Verify password and unlock wallet
    state.wallet_service.verify_password(&password).await?;

    // Get signer for the from address
    let signer = state.wallet_service.get_signer(&from_addr).await?;

    // Build transaction using Alloy
    use alloy::network::TransactionBuilder;
    use alloy::rpc::types::TransactionRequest;
    
    let mut tx = TransactionRequest::default()
        .with_from(from_addr)
        .with_to(to_addr)
        .with_value(value_u256)
        .with_gas_limit(gas_limit_final as u128)
        .with_gas_price(gas_price_u256.to::<u128>());

    // Add data if provided
    if let Some(data_hex) = data {
        let data_bytes = if data_hex.starts_with("0x") {
            hex::decode(data_hex.trim_start_matches("0x"))
                .map_err(|_| WalletError::InvalidParams)?
        } else {
            hex::decode(data_hex)
                .map_err(|_| WalletError::InvalidParams)?
        };
        tx = tx.with_input(data_bytes);
    }

    // Get nonce
    let nonce = adapter.get_transaction_count(from_addr).await?;
    tx = tx.with_nonce(nonce);

    // Send transaction using provider with signer
    use alloy::providers::{Provider, ProviderBuilder};
    use alloy::network::EthereumWallet;
    
    let wallet = EthereumWallet::from(signer);
    let provider = ProviderBuilder::new()
        .with_recommended_fillers()
        .wallet(wallet)
        .on_http(adapter.rpc_url().parse()
            .map_err(|e| WalletError::NetworkError(format!("Invalid RPC URL: {}", e)))?);

    let pending_tx = provider
        .send_transaction(tx)
        .await
        .map_err(|e| WalletError::TransactionFailed(format!("Failed to send transaction: {}", e)))?;

    let tx_hash = *pending_tx.tx_hash();

    // Return transaction hash as hex string
    Ok(serde_json::json!(format!("{:?}", tx_hash)))
}

async fn handle_personal_sign(
    state: &VaughanState,
    window_label: &str,
    origin: &str,
    params: Vec<Value>,
) -> Result<Value, WalletError> {
    // For now, return unsupported (will implement in Phase 3.3)
    Err(WalletError::UnsupportedMethod("personal_sign".to_string()))
}

async fn handle_sign_typed_data_v4(
    state: &VaughanState,
    window_label: &str,
    origin: &str,
    params: Vec<Value>,
) -> Result<Value, WalletError> {
    // For now, return unsupported (will implement in Phase 3.3)
    Err(WalletError::UnsupportedMethod("eth_signTypedData_v4".to_string()))
}

// ============================================================================
// Network Switching Handlers (Require Approval)
// ============================================================================

async fn handle_switch_chain(
    state: &VaughanState,
    window_label: &str,
    origin: &str,
    params: Vec<Value>,
) -> Result<Value, WalletError> {
    // For now, return unsupported (will implement in Phase 3.3)
    Err(WalletError::UnsupportedMethod("wallet_switchEthereumChain".to_string()))
}

async fn handle_add_chain(
    state: &VaughanState,
    window_label: &str,
    origin: &str,
    params: Vec<Value>,
) -> Result<Value, WalletError> {
    // For now, return unsupported (will implement in Phase 3.3)
    Err(WalletError::UnsupportedMethod("wallet_addEthereumChain".to_string()))
}
