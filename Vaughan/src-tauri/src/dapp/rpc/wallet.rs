
use crate::error::WalletError;
use crate::state::VaughanState;
use serde_json::Value;
use tauri::{Emitter, Manager};


// ============================================================================
// Network Switching Handlers (Require Approval)
// ============================================================================

pub(crate) async fn handle_switch_chain(
    state: &VaughanState,
    _window_label: &str,
    _origin: &str,
    params: Vec<Value>,
) -> Result<Value, WalletError> {
    // Parse chainId from params
    // format: [{ chainId: '0x1' }]
    let params_obj = params
        .get(0)
        .and_then(|v| v.as_object())
        .ok_or(WalletError::InvalidParams)?;

    let chain_id_hex = params_obj
        .get("chainId")
        .and_then(|v| v.as_str())
        .ok_or(WalletError::InvalidParams)?;

    // Parse chain ID
    let chain_id = if chain_id_hex.starts_with("0x") {
        u64::from_str_radix(chain_id_hex.trim_start_matches("0x"), 16)
            .map_err(|_| WalletError::InvalidParams)?
    } else {
        u64::from_str_radix(chain_id_hex, 10).map_err(|_| WalletError::InvalidParams)?
    };

    eprintln!(
        "[RPC] wallet_switchEthereumChain: Requesting switch to chain {}",
        chain_id
    );

    // Verify chain is supported
    // For now, allow switching to any configured chain
    // In future, this should prompt user approval if not auto-approved

    // Check if chain is supported/configured
    // This is done implicitly by set_active_chain returning error if not found

    // Switch chain
    state.set_active_chain(chain_id).await?;

    eprintln!("[RPC] Successfully switched to chain {}", chain_id);

    // Return null as per EIP-3326
    Ok(serde_json::json!(null))
}

pub(crate) async fn handle_add_chain(
    state: &VaughanState,
    _window_label: &str,
    _origin: &str,
    params: Vec<Value>,
) -> Result<Value, WalletError> {
    // wallet_addEthereumChain params: [{ chainId, chainName, rpcUrls, nativeCurrency }]
    let chain_obj = params
        .get(0)
        .and_then(|v| v.as_object())
        .ok_or(WalletError::InvalidParams)?;

    let chain_id_hex = chain_obj
        .get("chainId")
        .and_then(|v| v.as_str())
        .ok_or(WalletError::InvalidParams)?;

    let chain_id = if chain_id_hex.starts_with("0x") {
        u64::from_str_radix(chain_id_hex.trim_start_matches("0x"), 16)
            .map_err(|_| WalletError::InvalidParams)?
    } else {
        u64::from_str_radix(chain_id_hex, 10).map_err(|_| WalletError::InvalidParams)?
    };

    let rpc_url = chain_obj
        .get("rpcUrls")
        .and_then(|v| v.as_array())
        .and_then(|arr| arr.first())
        .and_then(|v| v.as_str())
        .ok_or_else(|| {
            WalletError::Custom("wallet_addEthereumChain: no rpcUrls provided".to_string())
        })?;

    let network_name = chain_obj
        .get("chainName")
        .and_then(|v| v.as_str())
        .unwrap_or("Custom Network")
        .to_string();

    eprintln!(
        "[RPC] wallet_addEthereumChain: Adding chain {} ({})",
        network_name, chain_id
    );

    // Switch to this network (creates adapter on-demand)
    state
        .switch_network(&format!("custom-{}", chain_id), rpc_url, chain_id)
        .await?;

    eprintln!(
        "[RPC] wallet_addEthereumChain: Successfully added chain {}",
        chain_id
    );

    // Return null as per EIP-3085
    Ok(serde_json::json!(null))
}

// ============================================================================
// Permission Management Handlers (EIP-2255)
// ============================================================================

/// Handle wallet_requestPermissions
///
/// Stub implementation - returns success to unblock dApps
/// Full implementation in Phase 4
pub(crate) async fn handle_request_permissions(
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
pub(crate) async fn handle_revoke_permissions(
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
pub(crate) async fn handle_get_permissions(
    state: &VaughanState,
    window_label: &str,
    origin: &str,
) -> Result<Value, WalletError> {
    // Check if session exists
    if state
        .session_manager
        .get_session_by_window(window_label, origin)
        .await
        .is_some()
    {
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
pub(crate) async fn handle_watch_asset(
    app: &tauri::AppHandle,
    _state: &VaughanState,
    _window_label: &str,
    origin: &str,
    params: Vec<Value>,
) -> Result<Value, WalletError> {
    eprintln!("[RPC] wallet_watchAsset requested by {}", origin);

    // EIP-747 definition: watchAsset({ type, options })
    let param_obj = params
        .get(0)
        .and_then(|v| v.as_object())
        .ok_or(WalletError::InvalidParams)?;

    let asset_type = param_obj
        .get("type")
        .and_then(|v| v.as_str())
        .ok_or(WalletError::InvalidParams)?;

    // Only ERC20 is supported by EIP-747
    if asset_type != "ERC20" {
        return Err(WalletError::Custom(format!(
            "Unsupported asset type: {}",
            asset_type
        )));
    }

    let options = param_obj
        .get("options")
        .and_then(|v| v.as_object())
        .ok_or(WalletError::InvalidParams)?;

    // Required fields
    let address = options
        .get("address")
        .and_then(|v| v.as_str())
        .ok_or(WalletError::InvalidParams)?;
    let symbol = options
        .get("symbol")
        .and_then(|v| v.as_str())
        .ok_or(WalletError::InvalidParams)?;
    let decimals = options
        .get("decimals")
        .and_then(|v| if v.is_number() {
            v.as_u64()
        } else {
            v.as_str().and_then(|s| s.parse::<u64>().ok())
        })
        .ok_or(WalletError::InvalidParams)?;

    // Optional field
    let image = options
        .get("image")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    // In a real implementation:
    // 1. Send approval request to user
    // 2. Wait for user to accept
    // 3. Add to local token list
    // 4. Return true

    // For now, emit event so frontend can show UI
    // Note: This relies on the frontend handling the actual token addition
    let token_data = serde_json::json!({
        "address": address,
        "symbol": symbol,
        "decimals": decimals,
        "image": image,
        "origin": origin
    });

    if let Some(main_window) = app.get_webview_window("main") {
        let _ = main_window.emit("watch_asset_request", token_data);
    }

    // Return true optimistically for now (unblocks dApp)
    // A full implementation requires returning true only AFTER user clicks "Add"
    Ok(serde_json::json!(true))
}
