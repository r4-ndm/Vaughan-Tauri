///! RPC Method Handler (Router Pattern)
///!
///! Routes dApp requests to appropriate handlers
///!
///! **PHASE 3.4 UPDATE**: Now accepts window_label for proper approval routing
use crate::error::WalletError;
use crate::state::VaughanState;
use serde_json::Value;
pub mod eth;
pub mod personal;
pub mod wallet;

use tauri::AppHandle;

/// Handle dApp RPC request
///
/// **PHASE 3.4**: Now accepts window_label for approval routing
///
/// # Arguments
///
/// * `app` - Tauri AppHandle (for event emission)
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
    app: &AppHandle,
    state: &VaughanState,
    window_label: &str,
    origin: &str,
    method: &str,
    params: Vec<Value>,
) -> Result<Value, WalletError> {
    // Route to appropriate handler
    match method {
        // Account Management
        "eth_requestAccounts" => eth::handle_request_accounts(state, window_label, origin).await,
        "eth_accounts" => eth::handle_accounts(state, window_label, origin).await,

        // Network Info
        "eth_chainId" => eth::handle_chain_id(state).await,
        "net_version" => eth::handle_net_version(state).await,

        // Read Operations (passthrough to RPC)
        "eth_getBalance" => eth::handle_get_balance(state, params).await,
        "eth_blockNumber" => eth::handle_block_number(state).await,
        "eth_call" => eth::handle_call(state, params).await,
        "eth_estimateGas" => eth::handle_estimate_gas(state, params).await,
        "eth_gasPrice" => eth::handle_gas_price(state).await,
        "eth_getTransactionCount" => eth::handle_get_transaction_count(state, params).await,
        "eth_getTransactionByHash" => eth::handle_get_transaction_by_hash(state, params).await,
        "eth_getTransactionReceipt" => eth::handle_get_transaction_receipt(state, params).await,

        // Write Operations (require approval)
        "eth_sendTransaction" => {
            eth::handle_send_transaction(app, state, window_label, origin, params).await
        },
        "personal_sign" => personal::handle_personal_sign(app, state, window_label, origin, params).await,
        "eth_signTypedData_v4" => {
            personal::handle_sign_typed_data_v4(app, state, window_label, origin, params).await
        },

        // Network Switching (require approval)
        "wallet_switchEthereumChain" => {
            wallet::handle_switch_chain(state, window_label, origin, params).await
        },
        "wallet_addEthereumChain" => wallet::handle_add_chain(state, window_label, origin, params).await,

        // Asset Management (EIP-747)
        "wallet_watchAsset" => wallet::handle_watch_asset(app, state, window_label, origin, params).await,

        // Permission Management (EIP-2255) - Stub implementations
        "wallet_requestPermissions" => {
            wallet::handle_request_permissions(state, window_label, origin, params).await
        },
        "wallet_revokePermissions" => {
            wallet::handle_revoke_permissions(state, window_label, origin, params).await
        },
        "wallet_getPermissions" => wallet::handle_get_permissions(state, window_label, origin).await,

        // Unsupported
        _ => Err(WalletError::UnsupportedMethod(method.to_string())),
    }
}

