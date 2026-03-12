//! Network Commands
//!
//! Tauri commands for network management operations.
//!
//! These commands provide the IPC bridge between the React frontend and the
//! Rust backend for network-related functionality.

use crate::chains::ChainAdapter;
use crate::error::AnyJson;
use crate::state::VaughanState;
use alloy::providers::Provider;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use specta::Type;
use tauri::{AppHandle, Emitter, Manager, State};

/// Network switch request
#[derive(Debug, Deserialize, Type)]
pub struct SwitchNetworkRequest {
    /// Network identifier (e.g., "ethereum-mainnet")
    pub network_id: String,
    /// RPC endpoint URL
    pub rpc_url: String,
    /// Chain ID
    pub chain_id: u64,
}

/// Balance response
#[derive(Debug, Serialize, Type)]
pub struct BalanceResponse {
    /// Balance in wei (as string to avoid precision loss)
    pub balance_wei: String,
    /// Balance in ETH (human-readable)
    pub balance_eth: String,
    /// Native token symbol (e.g., "ETH", "PLS")
    pub symbol: String,
}

/// Token info for network response
#[derive(Debug, Serialize, Type)]
pub struct TokenInfoResponse {
    /// Token symbol (e.g., "ETH", "PLS")
    pub symbol: String,
    /// Token name (e.g., "Ethereum", "PulseChain")
    pub name: String,
    /// Token decimals (usually 18)
    pub decimals: u8,
}

/// Network info response
#[derive(Debug, Serialize, Type)]
pub struct NetworkInfoResponse {
    /// Network ID
    pub network_id: String,
    /// Network name
    pub name: String,
    /// Chain ID
    pub chain_id: u64,
    /// RPC URL
    pub rpc_url: String,
    /// Block explorer URL (empty for now)
    pub explorer_url: String,
    /// Native token information
    pub native_token: TokenInfoResponse,
}

/// Switch to a different network
///
/// This command switches the active network, creating a new adapter if needed.
/// The adapter is cached for future use.
/// **PHASE 3.4**: Now emits chainChanged event to all connected dApp windows.
///
/// # Arguments
///
/// * `app` - Tauri app handle (for event emission)
/// * `state` - Application state
/// * `request` - Network switch request
///
/// # Returns
///
/// * `Ok(())` - Network switched successfully
/// * `Err(String)` - Error message
///
/// # Example (from frontend)
///
/// ```typescript
/// await invoke('switch_network', {
///   request: {
///     networkId: 'ethereum-mainnet',
///     rpcUrl: 'https://eth.llamarpc.com',
///     chainId: 1
///   }
/// });
/// ```
#[tauri::command]
#[specta::specta]
pub async fn switch_network(
    app: AppHandle,
    state: State<'_, VaughanState>,
    request: SwitchNetworkRequest,
) -> Result<(), String> {
    eprintln!(
        "[Network] Switching network: {} (chain_id: {})",
        request.network_id, request.chain_id
    );

    // Switch network
    state
        .switch_network(&request.network_id, &request.rpc_url, request.chain_id)
        .await
        .map_err(|e| e.user_message())?;

    eprintln!("[Network] Network switched successfully");

    // ========================================================================
    // Emit chainChanged event to all dApp windows (Phase 3.4 - Task 4.2)
    // ========================================================================

    // Get new chain ID (hex format for EIP-1193 compliance)
    let chain_id_hex = format!("0x{:x}", request.chain_id);

    // Collect window labels first (avoid holding lock during emit)
    let window_labels: Vec<String> = { state.window_registry.get_all_labels().await }; // Lock released here

    eprintln!(
        "[Network] Emitting chainChanged to {} windows",
        window_labels.len()
    );

    // Emit to all dApp windows (without holding lock)
    for window_label in window_labels {
        if let Some(window) = app.get_webview_window(&window_label) {
            match window.emit("chainChanged", chain_id_hex.clone()) {
                Ok(_) => eprintln!("[Network] Emitted chainChanged to window: {}", window_label),
                Err(e) => eprintln!("[Network] Failed to emit to window {}: {}", window_label, e),
            }
        } else {
            eprintln!("[Network] Window not found: {}", window_label);
        }
    }

    Ok(())
}

/// Get native token balance for an address
///
/// # Arguments
///
/// * `state` - Application state
/// * `address` - Ethereum address (0x...)
///
/// # Returns
///
/// * `Ok(BalanceResponse)` - Balance information
/// * `Err(String)` - Error message
///
/// # Example (from frontend)
///
/// ```typescript
/// const balance = await invoke('get_balance', {
///   address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
/// });
/// console.log(`Balance: ${balance.balance_eth} ${balance.symbol}`);
/// ```
#[tauri::command]
#[specta::specta]
pub async fn get_balance(
    state: State<'_, VaughanState>,
    address: String,
) -> Result<BalanceResponse, String> {
    // Get current adapter
    let adapter = state
        .current_adapter()
        .await
        .map_err(|e| e.user_message())?;

    // Get balance using adapter
    let balance = adapter
        .get_balance(&address)
        .await
        .map_err(|e| e.user_message())?;

    // Format response
    Ok(BalanceResponse {
        balance_wei: balance.raw.clone(),
        balance_eth: balance.formatted,
        symbol: balance.token.symbol,
    })
}

/// Get current network information
///
/// # Arguments
///
/// * `state` - Application state
///
/// # Returns
///
/// * `Ok(NetworkInfoResponse)` - Network information
/// * `Err(String)` - Error message
///
/// # Example (from frontend)
///
/// ```typescript
/// const info = await invoke('get_network_info');
/// console.log(`Connected to: ${info.network_name} (Chain ID: ${info.chain_id})`);
/// ```
#[tauri::command]
#[specta::specta]
pub async fn get_network_info(
    state: State<'_, VaughanState>,
) -> Result<NetworkInfoResponse, String> {
    // Get current adapter
    let adapter = state
        .current_adapter()
        .await
        .map_err(|e| e.user_message())?;

    // Get chain info
    let chain_info = adapter.chain_info();

    // Get network ID
    let network_id = state
        .current_network_id()
        .await
        .map_err(|e| e.user_message())?;

    Ok(NetworkInfoResponse {
        network_id,
        name: chain_info.name,
        chain_id: chain_info.chain_id.unwrap_or(0),
        rpc_url: adapter.rpc_url().to_string(),
        explorer_url: crate::chains::evm::networks::get_network_by_chain_id(
            chain_info.chain_id.unwrap_or(0),
        )
        .and_then(|n| n.explorer_url)
        .unwrap_or_default(),
        native_token: TokenInfoResponse {
            symbol: chain_info.native_token.symbol,
            name: chain_info.native_token.name,
            decimals: chain_info.native_token.decimals,
        },
    })
}

/// Get current chain ID
///
/// # Arguments
///
/// * `state` - Application state
///
/// # Returns
///
/// * `Ok(u64)` - Chain ID
/// * `Err(String)` - Error message
///
/// # Example (from frontend)
///
/// ```typescript
/// const chainId = await invoke('get_chain_id');
/// console.log(`Chain ID: ${chainId}`);
/// ```
#[tauri::command]
#[specta::specta]
pub async fn get_chain_id(state: State<'_, VaughanState>) -> Result<u64, String> {
    let adapter = state
        .current_adapter()
        .await
        .map_err(|e| e.user_message())?;
    Ok(adapter.chain_info().chain_id.unwrap_or(0))
}

/// Get current block number
///
/// # Arguments
///
/// * `state` - Application state
///
/// # Returns
///
/// * `Ok(u64)` - Block number
/// * `Err(String)` - Error message
///
/// # Example (from frontend)
///
/// ```typescript
/// const blockNumber = await invoke('get_block_number');
/// console.log(`Latest block: ${blockNumber}`);
/// ```
#[tauri::command]
#[specta::specta]
pub async fn get_block_number(state: State<'_, VaughanState>) -> Result<u64, String> {
    let adapter = state
        .current_adapter()
        .await
        .map_err(|e| e.user_message())?;

    adapter
        .provider()
        .get_block_number()
        .await
        .map_err(|e| format!("Failed to get block number: {}", e))
}

/// Get supported networks
///
/// Returns a list of all supported network configurations.
///
/// # Arguments
///
/// * `state` - Application state
///
/// # Returns
///
/// * `Ok(Vec<NetworkConfig>)` - List of supported networks
/// * `Err(String)` - Error message
///
/// # Example (from frontend)
///
/// ```typescript
/// const networks = await invoke('get_supported_networks');
/// console.log(`Supported networks: ${networks.length}`);
/// ```
#[tauri::command]
#[specta::specta]
pub async fn get_supported_networks(
    state: State<'_, VaughanState>,
) -> Result<Vec<crate::core::NetworkConfig>, String> {
    Ok(state.network_service.get_predefined_networks())
}

/// Generic RPC request bypass
///
/// Routes an RPC request to a specific chain via the backend's Alloy adapters.
/// This bypasses frontend CORS restrictions.
#[tauri::command]
#[specta::specta]
pub async fn eth_request(
    state: State<'_, VaughanState>,
    chain_id: u64,
    method: String,
    params: Vec<AnyJson>,
) -> Result<AnyJson, String> {
    let params: Vec<Value> = params.into_iter().map(|a| a.0).collect();
    eprintln!("[eth_request] ➡️ Received request for chain {}: method={}, params_count={}", chain_id, method, params.len());

    eprintln!("[eth_request] ⏳ Getting/Creating adapter for chain {}...", chain_id);
    let adapter = state
        .get_or_create_adapter_by_chain_id(chain_id)
        .await
        .map_err(|e| {
            eprintln!("[eth_request] ❌ Failed to get adapter: {}", e);
            e.user_message()
        })?;
    eprintln!("[eth_request] ✅ Adapter acquired. RPC URL: {}", adapter.rpc_url());

    eprintln!("[eth_request] ⏳ Sending raw request to node...");
    let result: Value = adapter
        .raw_request(method.clone(), params)
        .await
        .map_err(|e| {
            eprintln!("[eth_request] ❌ RPC request failed (method: {}, chain: {}): {}", method, chain_id, e);
            format!("RPC request failed (chain_id: {}): {}", chain_id, e)
        })?;

    eprintln!("[eth_request] ✅ Request completed successfully. Result: {}", result);
    Ok(AnyJson(result))
}

/// Generic HTTP proxy for whitelisted domains to bypass CORS in WebWorkers
#[tauri::command]
#[specta::specta]
pub async fn proxy_request(
    url: String,
    method: String,
    headers: Option<std::collections::HashMap<String, String>>,
    body: Option<AnyJson>,
) -> Result<AnyJson, String> {
    eprintln!("[proxy_request] ➡️ Intercepted: {} {}", method, url);
    
    let client = reqwest::Client::new();
    let mut rb = match method.as_str() {
        "POST" => client.post(&url),
        "GET" => client.get(&url),
        "PUT" => client.put(&url),
        _ => client.get(&url),
    };

    if let Some(h) = headers {
        for (k, v) in h {
            rb = rb.header(k, v);
        }
    }

    if let Some(b) = body {
        rb = rb.json(&b.0);
    }

    let response = rb.send().await.map_err(|e| {
        eprintln!("[proxy_request] ❌ Request failed ({}): {}", url, e);
        format!("Request failed: {}", e)
    })?;

    let status = response.status();
    let text = response.text().await.map_err(|e| {
        eprintln!("[proxy_request] ❌ Failed to read response body: {}", e);
        format!("Failed to read response body: {}", e)
    })?;

    eprintln!("[proxy_request] ✅ Success ({}) - Length: {} bytes", status, text.len());

    // Try to parse as JSON, otherwise return as a JSON string
    match serde_json::from_str::<Value>(&text) {
        Ok(json) => Ok(AnyJson(json)),
        Err(_) => Ok(AnyJson(Value::String(text))),
    }
}


// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // Note: These are unit tests for command structure.
    // Integration tests with real state will be in tests/ directory.

    #[test]
    fn test_switch_network_request_deserialize() {
        let json = r#"{
            "network_id": "ethereum-mainnet",
            "rpc_url": "https://eth.llamarpc.com",
            "chain_id": 1
        }"#;

        let request: SwitchNetworkRequest = serde_json::from_str(json).unwrap();
        assert_eq!(request.network_id, "ethereum-mainnet");
        assert_eq!(request.rpc_url, "https://eth.llamarpc.com");
        assert_eq!(request.chain_id, 1);
    }

    #[test]
    fn test_balance_response_serialize() {
        let response = BalanceResponse {
            balance_wei: "1000000000000000000".to_string(),
            balance_eth: "1.0".to_string(),
            symbol: "ETH".to_string(),
        };

        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("balance_wei"));
        assert!(json.contains("balance_eth"));
        assert!(json.contains("symbol"));
    }

    #[test]
    fn test_network_info_response_serialize() {
        let response = NetworkInfoResponse {
            network_id: "ethereum-mainnet".to_string(),
            name: "Ethereum Mainnet".to_string(),
            chain_id: 1,
            rpc_url: "https://eth.llamarpc.com".to_string(),
            explorer_url: "https://etherscan.io".to_string(),
            native_token: TokenInfoResponse {
                symbol: "ETH".to_string(),
                name: "Ethereum".to_string(),
                decimals: 18,
            },
        };

        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("ethereum-mainnet"));
        assert!(json.contains("Ethereum Mainnet"));
    }
}
