///! dApp IPC Command Handler
///!
///! Handles RPC requests from dApps via Tauri IPC (postMessage bridge)

use crate::state::VaughanState;
use crate::dapp;
use serde_json::Value;
use tauri::State;

/// Handle dApp RPC request via Tauri IPC
///
/// This is called from the initialization_script bridge via postMessage.
/// It processes EIP-1193 requests and returns results.
///
/// # Arguments
///
/// * `state` - Application state
/// * `window_label` - Label of the window making the request
/// * `origin` - Origin of the dApp (e.g., "https://app.uniswap.org")
/// * `method` - RPC method (e.g., "eth_requestAccounts")
/// * `params` - RPC parameters
///
/// # Returns
///
/// * `Ok(Value)` - RPC result
/// * `Err(String)` - Error message
///
#[tauri::command]
pub async fn handle_dapp_request(
    state: State<'_, VaughanState>,
    window_label: String,
    origin: String,
    method: String,
    params: Vec<Value>,
) -> Result<Value, String> {
    eprintln!("[dApp-IPC] Request - window_label: '{}', origin: '{}', method: {}, params: {:?}", 
        window_label, origin, method, params);

    // Use existing RPC handler
    let result = dapp::rpc_handler::handle_request(
        &*state,
        &window_label,
        &origin,
        &method,
        params,
    )
    .await;

    match result {
        Ok(value) => {
            eprintln!("[dApp-IPC] Success: {:?}", value);
            Ok(value)
        }
        Err(e) => {
            eprintln!("[dApp-IPC] Error: {}", e);
            Err(e.to_string())
        }
    }
}
