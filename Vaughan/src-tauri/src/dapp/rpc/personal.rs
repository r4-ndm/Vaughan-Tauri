
use crate::error::WalletError;
use crate::state::VaughanState;
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager};


pub(crate) async fn handle_personal_sign(
    app: &AppHandle,
    state: &VaughanState,
    window_label: &str,
    origin: &str,
    params: Vec<Value>,
) -> Result<Value, WalletError> {
    // personal_sign params: [message, address]
    // message is hex-encoded string to sign
    // address is the account to sign with

    if params.len() < 2 {
        return Err(WalletError::Custom(
            "personal_sign requires 2 parameters".to_string(),
        ));
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
        return Err(WalletError::PermissionDenied(
            "Address not authorized".to_string(),
        ));
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
        message: message_text.clone(),
    };

    // Add approval request
    let (id, rx) = state
        .approval_queue
        .add_request(window_label.to_string(), request_type)
        .await?;

    // Emit event to main window to trigger UI
    if let Some(main_window) = app.get_webview_window("main") {
        let payload = serde_json::json!({
            "id": id,
            "origin": origin,
            "type": "personal_sign",
            "params": {
                "address": address_str,
                "message": message_text
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
        .and_then(|data| {
            data.get("password")
                .and_then(|p| p.as_str().map(String::from))
        })
        .ok_or_else(|| WalletError::Custom("Password required for signing".to_string()))?;

    // Sign the message using wallet service
    let signature = state
        .wallet_service
        .sign_message(&address, &message_bytes, &password)
        .await?;

    // Return signature as hex string
    Ok(serde_json::json!(format!("0x{}", hex::encode(signature))))
}

pub(crate) async fn handle_sign_typed_data_v4(
    app: &AppHandle,
    state: &VaughanState,
    window_label: &str,
    origin: &str,
    params: Vec<Value>,
) -> Result<Value, WalletError> {
    // eth_signTypedData_v4 params: [address, typedDataJson]
    if params.len() < 2 {
        return Err(WalletError::Custom(
            "eth_signTypedData_v4 requires 2 parameters".to_string(),
        ));
    }

    let address_str = params[0]
        .as_str()
        .ok_or_else(|| WalletError::Custom("Address must be a string".to_string()))?;

    let typed_data_raw = &params[1];
    // typed_data can be a string (JSON-encoded) or an object
    let typed_data_str = if typed_data_raw.is_string() {
        typed_data_raw.as_str().unwrap().to_string()
    } else {
        typed_data_raw.to_string()
    };

    // Verify session
    let session = state
        .session_manager
        .get_session_by_window(window_label, origin)
        .await
        .ok_or(WalletError::NotConnected)?;

    let address: alloy::primitives::Address = address_str
        .parse()
        .map_err(|_| WalletError::InvalidAddress(address_str.to_string()))?;

    if !session.accounts.contains(&address) {
        return Err(WalletError::PermissionDenied(
            "Address not in session".to_string(),
        ));
    }

    // Create approval request
    use crate::dapp::ApprovalRequestType;
    let request_type = ApprovalRequestType::PersonalSign {
        origin: origin.to_string(),
        address: format!("{:?}", address),
        message: format!("TypedData signature request from {}", origin),
    };

    let (id, rx) = state
        .approval_queue
        .add_request(window_label.to_string(), request_type)
        .await?;

    // Notify main window
    if let Some(main_window) = app.get_webview_window("main") {
        let payload = serde_json::json!({
            "id": id,
            "origin": origin,
            "type": "sign_typed_data_v4",
            "params": {
                "address": address_str,
                "typedData": typed_data_str
            }
        });
        let _ = main_window.emit("dapp_request", payload);
    }

    // Wait for approval
    let response = rx
        .await
        .map_err(|_| WalletError::Custom("Approval cancelled".to_string()))?;

    if !response.approved {
        return Err(WalletError::UserRejected);
    }

    let password = response
        .data
        .and_then(|d| d.get("password").and_then(|p| p.as_str().map(String::from)))
        .ok_or_else(|| WalletError::Custom("Password required for signing".to_string()))?;

    // Sign the raw typed data bytes using personal_sign for now
    // (Full EIP-712 encoding will be added in Phase 3.3)
    let message_bytes = typed_data_str.as_bytes();
    let signature = state
        .wallet_service
        .sign_message(&address, message_bytes, &password)
        .await?;

    Ok(serde_json::json!(format!("0x{}", hex::encode(signature))))
}