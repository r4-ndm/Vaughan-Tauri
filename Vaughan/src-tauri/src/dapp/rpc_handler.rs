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

        // Asset Management (EIP-747)
        "wallet_watchAsset" => handle_watch_asset(state, window_label, origin, params).await,

        // Permission Management (EIP-2255) - Stub implementations
        "wallet_requestPermissions" => handle_request_permissions(state, window_label, origin, params).await,
        "wallet_revokePermissions" => handle_revoke_permissions(state, window_label, origin, params).await,
        "wallet_getPermissions" => handle_get_permissions(state, window_label, origin).await,

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
    // Check if already connected for this window (including auto-approved)
    if let Some(connection) = state.session_manager.get_session_by_window(window_label, origin).await {
        eprintln!("[RPC] Found existing session for window: {}, auto_approved: {}", window_label, connection.auto_approved);
        
        // Return connected accounts immediately
        let accounts: Vec<String> = connection
            .accounts
            .iter()
            .map(|addr| format!("{:?}", addr))
            .collect();
        
        if connection.auto_approved {
            eprintln!("[RPC] Auto-approved session - returning accounts immediately: {:?}", accounts);
        }
        
        return Ok(serde_json::json!(accounts));
    }

    eprintln!("[RPC] No existing session found - creating approval request");

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

    // Create session for this window (manual approval, not auto-approved)
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

    eprintln!("[RPC] Manual approval completed - session created");

    // Return accounts
    let accounts = vec![format!("{:?}", account)];
    Ok(serde_json::json!(accounts))
}

async fn handle_accounts(
    state: &VaughanState,
    window_label: &str,
    origin: &str,
) -> Result<Value, WalletError> {
    eprintln!("[RPC] eth_accounts - Looking for session with window_label: '{}', origin: '{}'", window_label, origin);
    
    // Check if connected for this window
    if let Some(connection) = state.session_manager.get_session_by_window(window_label, origin).await {
        let accounts: Vec<String> = connection
            .accounts
            .iter()
            .map(|addr| format!("{:?}", addr))
            .collect();
        
        eprintln!("[RPC] eth_accounts - Found session for window: {}, auto_approved: {}, accounts: {:?}", 
            window_label, connection.auto_approved, accounts);
        
        Ok(serde_json::json!(accounts))
    } else {
        // Not connected - return empty array
        eprintln!("[RPC] eth_accounts - No session found for window: '{}', origin: '{}'", window_label, origin);
        
        // Debug: List all sessions
        let all_sessions = state.session_manager.all_sessions().await;
        eprintln!("[RPC] eth_accounts - All sessions: {:?}", all_sessions);
        
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
    // personal_sign params: [message, address]
    // message is hex-encoded string to sign
    // address is the account to sign with
    
    if params.len() < 2 {
        return Err(WalletError::Custom("personal_sign requires 2 parameters".to_string()));
    }

    let message_hex = params[0]
        .as_str()
        .ok_or_else(|| WalletError::Custom("Message must be a string".to_string()))?;
    
    let address_str = params[1]
        .as_str()
        .ok_or_else(|| WalletError::Custom("Address must be a string".to_string()))?;

    // Verify session exists
    let session = state
        .session_manager
        .get_session_by_window(window_label, origin)
        .await
        .ok_or_else(|| WalletError::NotConnected)?;

    // Parse address
    let address = address_str
        .parse::<alloy::primitives::Address>()
        .map_err(|_| WalletError::InvalidAddress("Invalid address format".to_string()))?;

    // Verify address is in session
    if !session.accounts.contains(&address) {
        return Err(WalletError::PermissionDenied("Address not authorized".to_string()));
    }

    // Decode message from hex
    let message_bytes = if message_hex.starts_with("0x") {
        hex::decode(&message_hex[2..])
            .map_err(|_| WalletError::Custom("Invalid hex message".to_string()))?
    } else {
        hex::decode(message_hex)
            .map_err(|_| WalletError::Custom("Invalid hex message".to_string()))?
    };

    // Convert to string for display
    let message_text = String::from_utf8_lossy(&message_bytes).to_string();

    // Create approval request
    use crate::dapp::ApprovalRequestType;

    let request_type = ApprovalRequestType::PersonalSign {
        origin: origin.to_string(),
        address: format!("{:?}", address),
        message: message_text,
    };

    // Add approval request
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

    // Get password from response data
    let password = response
        .data
        .and_then(|data| data.get("password").and_then(|p| p.as_str().map(String::from)))
        .ok_or_else(|| WalletError::Custom("Password required for signing".to_string()))?;

    // Sign the message using wallet service
    let signature = state
        .wallet_service
        .sign_message(&address, &message_bytes, &password)
        .await?;

    // Return signature as hex string
    Ok(serde_json::json!(format!("0x{}", hex::encode(signature))))
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
    _state: &VaughanState,
    _window_label: &str,
    _origin: &str,
    _params: Vec<Value>,
) -> Result<Value, WalletError> {
    // For now, return unsupported (will implement in Phase 3.3)
    Err(WalletError::UnsupportedMethod("wallet_addEthereumChain".to_string()))
}

// ============================================================================
// Permission Management Handlers (EIP-2255)
// ============================================================================

/// Handle wallet_requestPermissions
/// 
/// Stub implementation - returns success to unblock dApps
/// Full implementation in Phase 4
async fn handle_request_permissions(
    _state: &VaughanState,
    _window_label: &str,
    _origin: &str,
    _params: Vec<Value>,
) -> Result<Value, WalletError> {
    // Return empty permissions array (dApp already has eth_accounts permission via session)
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64;
    
    Ok(serde_json::json!([
        {
            "parentCapability": "eth_accounts",
            "date": timestamp
        }
    ]))
}

/// Handle wallet_revokePermissions
/// 
/// Stub implementation - returns null to indicate success
/// Full implementation in Phase 4
async fn handle_revoke_permissions(
    _state: &VaughanState,
    _window_label: &str,
    _origin: &str,
    _params: Vec<Value>,
) -> Result<Value, WalletError> {
    // Return null to indicate success
    Ok(serde_json::json!(null))
}

/// Handle wallet_getPermissions
/// 
/// Stub implementation - returns current permissions
/// Full implementation in Phase 4
async fn handle_get_permissions(
    state: &VaughanState,
    window_label: &str,
    origin: &str,
) -> Result<Value, WalletError> {
    // Check if session exists
    if state.session_manager.get_session_by_window(window_label, origin).await.is_some() {
        // Return eth_accounts permission
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64;
        
        Ok(serde_json::json!([
            {
                "parentCapability": "eth_accounts",
                "date": timestamp
            }
        ]))
    } else {
        // No permissions
        Ok(serde_json::json!([]))
    }
}

// ============================================================================
// Asset Management Handlers (EIP-747)
// ============================================================================

/// Handle wallet_watchAsset (EIP-747)
/// 
/// Allows dApps to suggest tokens for users to add to their wallet.
/// This is the "Add to MetaMask" button functionality.
/// 
/// # Parameters
/// 
/// Expected params format:
/// ```json
/// {
///   "type": "ERC20",
///   "options": {
///     "address": "0x...",
///     "symbol": "TOKEN",
///     "decimals": 18,
///     "image": "https://..."  // optional
///   }
/// }
/// ```
async fn handle_watch_asset(
    state: &VaughanState,
    window_label: &str,
    origin: &str,
    params: Vec<Value>,
) -> Result<Value, WalletError> {
    // Parse parameters
    let asset_params = params.get(0)
        .ok_or_else(|| WalletError::Custom("Missing asset parameters".to_string()))?;
    
    let asset_type = asset_params.get("type")
        .and_then(|v: &Value| v.as_str())
        .ok_or_else(|| WalletError::Custom("Missing asset type".to_string()))?;
    
    // Only support ERC20 for now
    if asset_type != "ERC20" {
        return Err(WalletError::Custom(format!("Unsupported asset type: {}", asset_type)));
    }
    
    let options = asset_params.get("options")
        .ok_or_else(|| WalletError::Custom("Missing asset options".to_string()))?;
    
    let address = options.get("address")
        .and_then(|v: &Value| v.as_str())
        .ok_or_else(|| WalletError::Custom("Missing token address".to_string()))?;
    
    let symbol = options.get("symbol")
        .and_then(|v: &Value| v.as_str())
        .ok_or_else(|| WalletError::Custom("Missing token symbol".to_string()))?;
    
    let decimals = options.get("decimals")
        .and_then(|v: &Value| v.as_u64())
        .ok_or_else(|| WalletError::Custom("Missing token decimals".to_string()))?;
    
    let image = options.get("image")
        .and_then(|v: &Value| v.as_str());
    
    eprintln!("[RPC] wallet_watchAsset request:");
    eprintln!("  Address: {}", address);
    eprintln!("  Symbol: {}", symbol);
    eprintln!("  Decimals: {}", decimals);
    eprintln!("  Image: {:?}", image);
    eprintln!("  Origin: {}", origin);
    
    // AUTO-APPROVE: wallet_watchAsset is low-risk (just adds token to list)
    // TODO: Add actual token storage when token management is implemented
    eprintln!("[RPC] Auto-approving wallet_watchAsset (low-risk operation)");
    
    Ok(serde_json::json!(true))
}
