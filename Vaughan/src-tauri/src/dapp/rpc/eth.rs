use alloy::primitives::{Address, U256};
use crate::chains::ChainAdapter;
use crate::error::WalletError;
use crate::state::VaughanState;
use alloy::providers::Provider;
use alloy::rpc::client::RpcClient;
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager};

// ============================================================================
// Account Management Handlers
// ============================================================================

pub(crate) async fn handle_request_accounts(
    app: &AppHandle,
    state: &VaughanState,
    window_label: &str,
    origin: &str,
) -> Result<Value, WalletError> {
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
        return Ok(serde_json::json!(accounts));
    }

    use crate::dapp::ApprovalRequestType;
    let request_type = ApprovalRequestType::Connection {
        origin: origin.to_string(),
    };

    let (id, rx) = state
        .approval_queue
        .add_request(window_label.to_string(), request_type)
        .await?;

    if let Some(main_window) = app.get_webview_window("main") {
        let payload = serde_json::json!({
            "id": id,
            "origin": origin,
            "type": "connection",
            "params": {}
        });
        let _ = main_window.emit("dapp_request", payload);
    }

    let response = rx
        .await
        .map_err(|_| WalletError::Custom("Approval request cancelled".to_string()))?;

    if !response.approved {
        return Err(WalletError::UserRejected);
    }

    let account = state.active_account().await?;
    state
        .session_manager
        .create_session_for_window(
            window_label,
            origin,
            None,
            None,
            vec![account],
        )
        .await?;

    let accounts = vec![format!("{:?}", account)];
    Ok(serde_json::json!(accounts))
}

pub(crate) async fn handle_accounts(
    state: &VaughanState,
    window_label: &str,
    origin: &str,
) -> Result<Value, WalletError> {
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
        Ok(serde_json::json!(accounts))
    } else {
        Ok(serde_json::json!([]))
    }
}

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

pub(crate) async fn handle_get_balance(
    state: &VaughanState,
    params: Vec<Value>,
) -> Result<Value, WalletError> {
    let address_str = params
        .get(0)
        .and_then(|v| v.as_str())
        .ok_or(WalletError::InvalidParams)?;

    let adapter = state.current_adapter().await?;
    let balance = adapter.get_balance(address_str).await?;
    Ok(serde_json::json!(format!("0x{}", balance.raw)))
}

pub(crate) async fn handle_block_number(state: &VaughanState) -> Result<Value, WalletError> {
    let adapter = state.current_adapter().await?;
    let block_number = adapter.get_block_number().await?;
    Ok(serde_json::json!(format!("0x{:x}", block_number)))
}

pub(crate) async fn handle_call(state: &VaughanState, params: Vec<Value>) -> Result<Value, WalletError> {
    let tx_obj = params
        .get(0)
        .and_then(|v| v.as_object())
        .ok_or(WalletError::InvalidParams)?;

    use alloy::rpc::types::TransactionRequest;
    use std::str::FromStr;

    let mut tx = TransactionRequest::default();
    if let Some(from) = tx_obj.get("from").and_then(|v| v.as_str()) {
        if let Ok(addr) = Address::from_str(from) {
            tx.from = Some(addr);
        }
    }
    if let Some(to) = tx_obj.get("to").and_then(|v| v.as_str()) {
        if let Ok(addr) = Address::from_str(to) {
            tx.to = Some(addr.into());
        }
    }
    if let Some(data_hex) = tx_obj.get("data").and_then(|v| v.as_str()) {
        let clean = data_hex.trim_start_matches("0x");
        if let Ok(bytes) = hex::decode(clean) {
            tx.input.input = Some(bytes.into());
        }
    }
    if let Some(value) = tx_obj.get("value").and_then(|v| v.as_str()) {
        if let Ok(v) = U256::from_str_radix(value.trim_start_matches("0x"), 16) {
            tx.value = Some(v);
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
    let tx_obj = match params.get(0) {
        Some(v) if v.is_object() => v.as_object().unwrap(),
        _ => return Ok(serde_json::json!("0x5208")),
    };

    use alloy::rpc::types::TransactionRequest;
    use std::str::FromStr;

    let mut tx = TransactionRequest::default();
    if let Some(from) = tx_obj.get("from").and_then(|v| v.as_str()) {
        if let Ok(addr) = Address::from_str(from) {
            tx.from = Some(addr);
        }
    }
    if let Some(to) = tx_obj.get("to").and_then(|v| v.as_str()) {
        if let Ok(addr) = Address::from_str(to) {
            tx.to = Some(addr.into());
        }
    }
    if let Some(data_hex) = tx_obj.get("data").and_then(|v| v.as_str()) {
        let clean = data_hex.trim_start_matches("0x");
        if let Ok(bytes) = hex::decode(clean) {
            tx.input.input = Some(bytes.into());
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
    use alloy::primitives::Address;
    let address = params
        .get(0)
        .and_then(|v| v.as_str())
        .ok_or(WalletError::InvalidParams)?;
    let address: Address = address.parse().map_err(|_| WalletError::InvalidAddress(address.to_string()))?;
    let adapter = state.current_adapter().await?;
    let nonce = adapter.get_transaction_count(address).await?;
    Ok(serde_json::json!(format!("0x{:x}", nonce)))
}

pub(crate) async fn handle_get_transaction_by_hash(
    state: &VaughanState,
    params: Vec<Value>,
) -> Result<Value, WalletError> {
    let hash = params.get(0).and_then(|v| v.as_str()).ok_or(WalletError::InvalidParams)?;
    let hash_b256: alloy::primitives::B256 = hash.parse().map_err(|_| WalletError::InvalidParams)?;
    let adapter = state.current_adapter().await?;
    let tx = adapter.get_transaction_by_hash(hash_b256).await?;
    Ok(serde_json::to_value(tx).unwrap_or(serde_json::Value::Null))
}

pub(crate) async fn handle_get_transaction_receipt(
    state: &VaughanState,
    params: Vec<Value>,
) -> Result<Value, WalletError> {
    let hash = params.get(0).and_then(|v| v.as_str()).ok_or(WalletError::InvalidParams)?;
    let hash_b256: alloy::primitives::B256 = hash.parse().map_err(|_| WalletError::InvalidParams)?;
    let adapter = state.current_adapter().await?;
    let receipt = adapter.get_transaction_receipt(hash_b256).await?;
    Ok(serde_json::to_value(receipt).unwrap_or(serde_json::Value::Null))
}

pub(crate) async fn handle_send_transaction(
    app: &AppHandle,
    state: &VaughanState,
    window_label: &str,
    origin: &str,
    params: Vec<Value>,
) -> Result<Value, WalletError> {
    let tx_obj = params.get(0).and_then(|v| v.as_object()).ok_or(WalletError::InvalidParams)?;
    let from = tx_obj.get("from").and_then(|v| v.as_str()).ok_or(WalletError::InvalidParams)?;
    let to = tx_obj.get("to").and_then(|v| v.as_str()).ok_or(WalletError::InvalidParams)?;
    let value = tx_obj.get("value").and_then(|v| v.as_str()).unwrap_or("0x0");
    let gas_limit = tx_obj.get("gas").or_else(|| tx_obj.get("gasLimit")).and_then(|v| v.as_str())
        .and_then(|s| u64::from_str_radix(s.trim_start_matches("0x"), 16).ok());
    let data = tx_obj.get("data").and_then(|v| v.as_str());

    let from_addr: Address = from.parse().map_err(|_| WalletError::InvalidAddress(from.to_string()))?;
    let to_addr: Address = to.parse().map_err(|_| WalletError::InvalidAddress(to.to_string()))?;
    
    let value_u256 = if value.starts_with("0x") {
        U256::from_str_radix(value.trim_start_matches("0x"), 16).map_err(|_| WalletError::InvalidParams)?
    } else {
        U256::from_str_radix(value, 10).map_err(|_| WalletError::InvalidParams)?
    };

    let value_eth = crate::chains::evm::utils::format_wei_to_eth(value_u256, 18);
    let adapter = state.current_adapter().await?;
    let gas_price = adapter.get_gas_price().await?;
    let gas_limit_final = gas_limit.unwrap_or(21000);

    use crate::dapp::ApprovalRequestType;
    let request_type = ApprovalRequestType::Transaction {
        origin: origin.to_string(),
        from: from.to_string(),
        to: to.to_string(),
        value: value_eth.clone(),
        gas_limit: Some(gas_limit_final),
        gas_price: Some(gas_price.to_string()),
        data: data.map(|s| s.to_string()),
    };

    let (id, rx) = state.approval_queue.add_request(window_label.to_string(), request_type).await?;

    if let Some(main_window) = app.get_webview_window("main") {
        let payload = serde_json::json!({
            "id": id, "origin": origin, "type": "transaction",
            "params": { "from": from, "to": to, "value": value_eth, "data": data, "gasLimit": gas_limit_final, "gasPrice": gas_price.to_string() }
        });
        let _ = main_window.emit("dapp_request", payload);
    }

    let response = tokio::time::timeout(tokio::time::Duration::from_secs(300), rx).await
        .map_err(|_| WalletError::Custom("Approval timed out".to_string()))?
        .map_err(|_| WalletError::Custom("Approval cancelled".to_string()))?;

    if !response.approved { return Err(WalletError::UserRejected); }

    let password = response.data.and_then(|d| d.get("password").cloned()).and_then(|p| p.as_str().map(|s| s.to_string()))
        .ok_or(WalletError::Custom("Password required".to_string()))?;

    state.wallet_service.verify_password(&password).await?;
    let _signer = state.wallet_service.get_signer(&from_addr).await?;

    use alloy::rpc::types::TransactionRequest;
    let mut tx = TransactionRequest::default();
    tx.from = Some(from_addr);
    tx.to = Some(to_addr.into());
    tx.value = Some(value_u256);
    tx.gas = Some(gas_limit_final);
    tx.gas_price = Some(gas_price);

    if let Some(data_hex) = data {
        let data_bytes = hex::decode(data_hex.trim_start_matches("0x")).map_err(|_| WalletError::InvalidParams)?;
        tx.input.input = Some(data_bytes.into());
    }

    let nonce = adapter.get_transaction_count(from_addr).await?;
    tx.nonce = Some(nonce);

    let url = adapter.rpc_url().parse().map_err(|e| WalletError::NetworkError(format!("Invalid RPC: {}", e)))?;
    let client = RpcClient::new_http(url);
    let provider = alloy::providers::RootProvider::new(client);

    let pending_tx = Provider::<alloy::network::Ethereum>::send_transaction(&provider, tx).await.map_err(|e| WalletError::TransactionFailed(format!("Failed: {}", e)))?;
    Ok(serde_json::json!(format!("{}", pending_tx.tx_hash())))
}