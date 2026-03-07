
use crate::error::WalletError;
use crate::state::VaughanState;
use alloy::primitives::{Address, U256};
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager};

// ============================================================================
// Account Management Handlers
// ============================================================================

pub(crate) async fn handle_request_accounts(
    state: &VaughanState,
    window_label: &str,
    origin: &str,
) -> Result<Value, WalletError> {
    // Check if already connected for this window (including auto-approved)
    if let Some(connection) = state
        .session_manager
        .get_session_by_window(window_label, origin)
        .await
    {
        eprintln!(
            "[RPC] Found existing session for window: {}, auto_approved: {}",
            window_label, connection.auto_approved
        );

        // Return connected accounts immediately
        let accounts: Vec<String> = connection
            .accounts
            .iter()
            .map(|addr| format!("{:?}", addr))
            .collect();

        if connection.auto_approved {
            eprintln!(
                "[RPC] Auto-approved session - returning accounts immediately: {:?}",
                accounts
            );
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

pub(crate) async fn handle_accounts(
    state: &VaughanState,
    window_label: &str,
    origin: &str,
) -> Result<Value, WalletError> {
    eprintln!(
        "[RPC] eth_accounts - Looking for session with window_label: '{}', origin: '{}'",
        window_label, origin
    );

    // Check if connected for this window
    if let Some(connection) = state
        .session_manager
        .get_session_by_window(window_label, origin)
        .await
    {
        let accounts: Vec<String> = connection
            .accounts
            .iter()
            .map(|addr| format!("{:?}", addr))
            .collect();

        eprintln!(
            "[RPC] eth_accounts - Found session for window: {}, auto_approved: {}, accounts: {:?}",
            window_label, connection.auto_approved, accounts
        );

        Ok(serde_json::json!(accounts))
    } else {
        // Not connected - return empty array
        eprintln!(
            "[RPC] eth_accounts - No session found for window: '{}', origin: '{}'",
            window_label, origin
        );

        // Debug: List all sessions
        let all_sessions = state.session_manager.all_sessions().await;
        eprintln!("[RPC] eth_accounts - All sessions: {:?}", all_sessions);

        Ok(serde_json::json!([]))
    }
}

// ============================================================================
// Network Info Handlers
// ============================================================================

pub(crate) async fn handle_chain_id(state: &VaughanState) -> Result<Value, WalletError> {
    let adapter = state.current_adapter().await?;
    let chain_id = adapter.chain_id();
    Ok(serde_json::json!(format!("0x{:x}", chain_id)))
}

pub(crate) async fn handle_net_version(state: &VaughanState) -> Result<Value, WalletError> {
    let adapter = state.current_adapter().await?;
    let chain_id = adapter.chain_id();
    Ok(serde_json::json!(chain_id.to_string()))
}

// ============================================================================
// Read Operation Handlers (Passthrough to RPC)
// ============================================================================

pub(crate) async fn handle_get_balance(
    state: &VaughanState,
    params: Vec<Value>,
) -> Result<Value, WalletError> {
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

pub(crate) async fn handle_block_number(state: &VaughanState) -> Result<Value, WalletError> {
    let adapter = state.current_adapter().await?;
    let block_number = adapter.get_block_number().await?;
    Ok(serde_json::json!(format!("0x{:x}", block_number)))
}

pub(crate) async fn handle_call(state: &VaughanState, params: Vec<Value>) -> Result<Value, WalletError> {
    // eth_call: [{ from, to, data, gas, value }, blockTag]
    let tx_obj = params
        .get(0)
        .and_then(|v| v.as_object())
        .ok_or(WalletError::InvalidParams)?;

    use alloy::network::TransactionBuilder;
    use alloy::primitives::Address;
    use alloy::rpc::types::TransactionRequest;
    use std::str::FromStr;

    let mut tx = TransactionRequest::default();

    if let Some(from) = tx_obj.get("from").and_then(|v| v.as_str()) {
        if let Ok(addr) = Address::from_str(from) {
            tx = tx.with_from(addr);
        }
    }
    if let Some(to) = tx_obj.get("to").and_then(|v| v.as_str()) {
        if let Ok(addr) = Address::from_str(to) {
            tx = tx.with_to(addr);
        }
    }
    if let Some(data_hex) = tx_obj.get("data").and_then(|v| v.as_str()) {
        let clean = data_hex.trim_start_matches("0x");
        if let Ok(bytes) = hex::decode(clean) {
            tx = tx.with_input(bytes);
        }
    }
    if let Some(gas) = tx_obj.get("gas").and_then(|v| v.as_str()) {
        if let Ok(g) = u128::from_str_radix(gas.trim_start_matches("0x"), 16) {
            tx = tx.with_gas_limit(g);
        }
    }
    if let Some(value) = tx_obj.get("value").and_then(|v| v.as_str()) {
        use alloy::primitives::U256;
        if let Ok(v) = U256::from_str_radix(value.trim_start_matches("0x"), 16) {
            tx = tx.with_value(v);
        }
    }

    let adapter = state.current_adapter().await?;
    let result = adapter.call(tx).await?;
    Ok(serde_json::json!(format!("0x{}", hex::encode(&result))))
}

pub(crate) async fn handle_estimate_gas(
    state: &VaughanState,
    params: Vec<Value>,
) -> Result<Value, WalletError> {
    // eth_estimateGas: [{ from, to, data, gas, value }]
    let tx_obj = match params.get(0) {
        Some(v) if v.is_object() => v.as_object().unwrap(),
        _ => return Ok(serde_json::json!("0x5208")), // Fallback: 21000 gas
    };

    use alloy::network::TransactionBuilder;
    use alloy::primitives::Address;
    use alloy::rpc::types::TransactionRequest;
    use std::str::FromStr;

    let mut tx = TransactionRequest::default();

    if let Some(from) = tx_obj.get("from").and_then(|v| v.as_str()) {
        if let Ok(addr) = Address::from_str(from) {
            tx = tx.with_from(addr);
        }
    }
    if let Some(to) = tx_obj.get("to").and_then(|v| v.as_str()) {
        if let Ok(addr) = Address::from_str(to) {
            tx = tx.with_to(addr);
        }
    }
    if let Some(data_hex) = tx_obj.get("data").and_then(|v| v.as_str()) {
        let clean = data_hex.trim_start_matches("0x");
        if let Ok(bytes) = hex::decode(clean) {
            tx = tx.with_input(bytes);
        }
    }
    if let Some(value) = tx_obj.get("value").and_then(|v| v.as_str()) {
        use alloy::primitives::U256;
        if let Ok(v) = U256::from_str_radix(value.trim_start_matches("0x"), 16) {
            tx = tx.with_value(v);
        }
    }

    let adapter = state.current_adapter().await?;
    let gas = adapter.estimate_gas(tx).await?;
    Ok(serde_json::json!(format!("0x{:x}", gas)))
}

pub(crate) async fn handle_gas_price(state: &VaughanState) -> Result<Value, WalletError> {
    let adapter = state.current_adapter().await?;
    let gas_price = adapter.get_gas_price().await?;
    Ok(serde_json::json!(format!("0x{:x}", gas_price)))
}

pub(crate) async fn handle_get_transaction_count(
    state: &VaughanState,
    params: Vec<Value>,
) -> Result<Value, WalletError> {
    // Parse params
    let address = params
        .get(0)
        .and_then(|v| v.as_str())
        .ok_or(WalletError::InvalidParams)?;

    let address: Address = address
        .parse()
        .map_err(|_| WalletError::InvalidAddress(address.to_string()))?;

    // Get nonce
    let adapter = state.current_adapter().await?;
    let nonce = adapter.get_transaction_count(address).await?;

    Ok(serde_json::json!(format!("0x{:x}", nonce)))
}

pub(crate) async fn handle_get_transaction_by_hash(
    state: &VaughanState,
    params: Vec<Value>,
) -> Result<Value, WalletError> {
    let hash = params
        .get(0)
        .and_then(|v| v.as_str())
        .ok_or(WalletError::InvalidParams)?;

    let adapter = state.current_adapter().await?;
    let tx = adapter.get_transaction_by_hash(hash).await?;
    Ok(tx.unwrap_or(serde_json::Value::Null))
}

pub(crate) async fn handle_get_transaction_receipt(
    state: &VaughanState,
    params: Vec<Value>,
) -> Result<Value, WalletError> {
    let hash = params
        .get(0)
        .and_then(|v| v.as_str())
        .ok_or(WalletError::InvalidParams)?;

    let adapter = state.current_adapter().await?;
    let receipt = adapter.get_transaction_receipt(hash).await?;
    Ok(receipt.unwrap_or(serde_json::Value::Null))
}

// ============================================================================
// Write Operation Handlers (Require Approval)
// ============================================================================

pub(crate) async fn handle_send_transaction(
    app: &AppHandle,
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

    let gas_price = tx_obj.get("gasPrice").and_then(|v| v.as_str());

    let data = tx_obj.get("data").and_then(|v| v.as_str());

    // Validate addresses
    let from_addr: Address = from
        .parse()
        .map_err(|_| WalletError::InvalidAddress(from.to_string()))?;
    let to_addr: Address = to
        .parse()
        .map_err(|_| WalletError::InvalidAddress(to.to_string()))?;

    // Parse value (hex string to U256)
    let value_u256 = if value.starts_with("0x") {
        U256::from_str_radix(value.trim_start_matches("0x"), 16)
            .map_err(|_| WalletError::InvalidParams)?
    } else {
        U256::from_str_radix(value, 10).map_err(|_| WalletError::InvalidParams)?
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
            U256::from_str_radix(price_hex, 10).map_err(|_| WalletError::InvalidParams)?
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
        value: value_eth.clone(),
        gas_limit: Some(gas_limit_final),
        gas_price: Some(gas_price_u256.to_string()),
        data: data.map(|s| s.to_string()),
    };

    // Add to approval queue and wait for response (with window_label)
    let (id, rx) = state
        .approval_queue
        .add_request(window_label.to_string(), request_type)
        .await?;

    // Emit event to main window to trigger UI
    if let Some(main_window) = app.get_webview_window("main") {
        let payload = serde_json::json!({
            "id": id,
            "origin": origin,
            "type": "transaction",
            "params": {
                "from": from,
                "to": to,
                "value": value_eth,
                "data": data,
                "gasLimit": gas_limit_final,
                "gasPrice": gas_price_u256.to_string()
            }
        });

        eprintln!(
            "[RPC] Emitting dapp_request event to main window: {:?}",
            payload
        );
        if let Err(e) = main_window.emit("dapp_request", payload) {
            eprintln!("[RPC] Failed to emit dapp_request event: {}", e);
        }
    } else {
        eprintln!("[RPC] WARN: Main window not found - UI will not show approval modal");
    }

    // Wait for user response (with 5 minute timeout)
    let response = tokio::time::timeout(tokio::time::Duration::from_secs(300), rx)
        .await
        .map_err(|_| WalletError::Custom("Approval request timed out".to_string()))?
        .map_err(|_| WalletError::Custom("Approval channel closed".to_string()))?;

    // Check if approved
    if !response.approved {
        return Err(WalletError::UserRejected);
    }

    // Get password from response data
    let password = response
        .data
        .and_then(|d| d.get("password").cloned())
        .and_then(|p| p.as_str().map(|s| s.to_string()))
        .ok_or(WalletError::Custom(
            "Password required for transaction".to_string(),
        ))?;

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
            hex::decode(data_hex).map_err(|_| WalletError::InvalidParams)?
        };
        tx = tx.with_input(data_bytes);
    }

    // Get nonce
    let nonce = adapter.get_transaction_count(from_addr).await?;
    tx = tx.with_nonce(nonce);

    // Send transaction using provider with signer
    use alloy::network::EthereumWallet;
    use alloy::providers::{Provider, ProviderBuilder};

    let wallet = EthereumWallet::from(signer);
    let provider = ProviderBuilder::new()
        .with_recommended_fillers()
        .wallet(wallet)
        .on_http(
            adapter
                .rpc_url()
                .parse()
                .map_err(|e| WalletError::NetworkError(format!("Invalid RPC URL: {}", e)))?,
        );

    let pending_tx = provider.send_transaction(tx).await.map_err(|e| {
        WalletError::TransactionFailed(format!("Failed to send transaction: {}", e))
    })?;

    let tx_hash = *pending_tx.tx_hash();

    // Return transaction hash as hex string
    Ok(serde_json::json!(format!("{:?}", tx_hash)))
}