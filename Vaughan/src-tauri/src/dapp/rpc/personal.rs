use alloy_dyn_abi::TypedData;
use crate::error::WalletError;
use crate::state::VaughanState;
use crate::chains::ChainAdapter;
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager};

pub(crate) async fn handle_personal_sign(
    app: &AppHandle,
    state: &VaughanState,
    window_label: &str,
    origin: &str,
    params: Vec<Value>,
) -> Result<Value, WalletError> {
    let message_hex = params
        .get(0)
        .and_then(|v| v.as_str())
        .ok_or(WalletError::InvalidParams)?;
    let address_str = params
        .get(1)
        .and_then(|v| v.as_str())
        .ok_or(WalletError::InvalidParams)?;

    let clean_hex = message_hex.trim_start_matches("0x");
    let message = hex::decode(clean_hex).map_err(|_| WalletError::InvalidParams)?;
    let message_str = String::from_utf8_lossy(&message).to_string();

    use crate::dapp::ApprovalRequestType;
    let request_type = ApprovalRequestType::PersonalSign {
        origin: origin.to_string(),
        address: address_str.to_string(),
        message: message_str,
    };

    let (id, rx) = state
        .approval_queue
        .add_request(window_label.to_string(), request_type)
        .await?;

    if let Some(main_window) = app.get_webview_window("main") {
        let payload = serde_json::json!({
            "id": id,
            "origin": origin,
            "type": "signature",
            "params": {
                "address": address_str,
                "message": message_hex
            }
        });
        let _ = main_window.emit("dapp_request", payload);
    }

    let response = tokio::time::timeout(tokio::time::Duration::from_secs(300), rx)
        .await
        .map_err(|_| WalletError::Custom("Approval timed out".to_string()))?
        .map_err(|_| WalletError::Custom("Approval cancelled".to_string()))?;

    if !response.approved {
        return Err(WalletError::UserRejected);
    }

    let password = response
        .data
        .and_then(|d| d.get("password").cloned())
        .and_then(|p| p.as_str().map(|s| s.to_string()))
        .ok_or(WalletError::Custom("Password required".to_string()))?;

    let adapter = state.current_adapter().await?;
    let signature = adapter.sign_message(address_str, &message).await?;

    // Verify password again for safety (adapter doesn't know about password)
    state.wallet_service.verify_password(&password).await?;

    Ok(serde_json::json!(signature.to_string()))
}

pub(crate) async fn handle_sign_typed_data_v4(
    app: &AppHandle,
    state: &VaughanState,
    window_label: &str,
    origin: &str,
    params: Vec<Value>,
) -> Result<Value, WalletError> {
    let address = params
        .get(0)
        .and_then(|v| v.as_str())
        .ok_or(WalletError::InvalidParams)?;
    let typed_data_val = params.get(1).ok_or(WalletError::InvalidParams)?;
    let typed_data_str = serde_json::to_string(typed_data_val)
        .map_err(|e| WalletError::Custom(format!("Invalid typed data JSON: {}", e)))?;

    use crate::dapp::ApprovalRequestType;
    let request_type = ApprovalRequestType::SignTypedData {
        origin: origin.to_string(),
        address: address.to_string(),
        typed_data: typed_data_str.clone(),
    };

    let (id, rx) = state
        .approval_queue
        .add_request(window_label.to_string(), request_type)
        .await?;

    if let Some(main_window) = app.get_webview_window("main") {
        let payload = serde_json::json!({
            "id": id,
            "origin": origin,
            "type": "signature",
            "params": {
                "address": address,
                "message": typed_data_str
            }
        });
        let _ = main_window.emit("dapp_request", payload);
    }

    let response = tokio::time::timeout(tokio::time::Duration::from_secs(300), rx)
        .await
        .map_err(|_| WalletError::Custom("Approval timed out".to_string()))?
        .map_err(|_| WalletError::Custom("Approval cancelled".to_string()))?;

    if !response.approved {
        return Err(WalletError::UserRejected);
    }

    let password = response
        .data
        .and_then(|d| d.get("password").cloned())
        .and_then(|p| p.as_str().map(|s| s.to_string()))
        .ok_or(WalletError::Custom("Password required".to_string()))?;

    // In Alloy 1.x, we need to sign the typed data. 
    // Since we have the raw JSON, we'll use sign_hash on the EIP-712 hash of the data.
    let typed_data: TypedData = serde_json::from_str(&typed_data_str)
        .map_err(|e| WalletError::Custom(format!("Invalid typed data: {}", e)))?;
    let hash = typed_data.eip712_signing_hash()
        .map_err(|e| WalletError::Custom(format!("Failed to hash typed data: {}", e)))?;

    let addr = address.parse::<alloy::primitives::Address>().map_err(|_| WalletError::InvalidAddress(address.to_string()))?;
    let signature = state
        .wallet_service
        .sign_hash(&addr, hash, &password)
        .await?;

    Ok(serde_json::json!(format!("0x{}", hex::encode(signature))))
}