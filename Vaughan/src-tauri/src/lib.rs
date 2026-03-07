// ============================================================================
// Vaughan Wallet - Tauri Backend
// ============================================================================
//
// This file contains POC code from Phase 0 for reference.
// Production code will be organized in separate modules.
//
// POC REFERENCE CODE - DO NOT USE IN PRODUCTION
// See README files in each module for production architecture.
//
// ============================================================================

// Production modules
pub mod chains;
pub mod commands;
pub mod core;
pub mod dapp;
pub mod error;
pub mod models;
pub mod security;
pub mod state;
pub mod audio;

use std::sync::Arc;
use tauri::Manager;
use tokio::sync::Mutex;

// POC: Alloy imports (Phase 0 validation)
use alloy::providers::{Provider, ProviderBuilder, RootProvider};
use alloy::transports::http::{Client, Http};
use std::collections::HashMap;
use tauri::State;

// ============================================================================
// POC-1: Tauri 2.0 + Alloy Integration Test
// ============================================================================
// Validates: Tauri 2.0 and Alloy work together
// Result: ✅ SUCCESS - Block 24378930 retrieved
// Lesson: Use concrete type RootProvider<Http<Client>>, not Arc<dyn Provider>

// NOTE: POC command commented out - production version in commands/network.rs
/*
#[tauri::command]
async fn get_block_number() -> Result<String, String> {
    println!("🔗 Connecting to Ethereum mainnet...");

    let rpc_url = "https://eth.llamarpc.com";
    let provider = ProviderBuilder::new()
        .on_http(rpc_url.parse().map_err(|e| format!("Invalid URL: {}", e))?);

    let block_number = provider
        .get_block_number()
        .await
        .map_err(|e| format!("Failed to get block number: {}", e))?;

    println!("✅ Latest block: {}", block_number);
    Ok(format!("{}", block_number))
}
*/

// ============================================================================
// POC-2: Controller Lazy Initialization Test
// ============================================================================
// Validates: State management with cached controllers
// Result: ✅ SUCCESS - Controllers cached correctly, no race conditions
// Lesson: Arc<Mutex<HashMap>> pattern works perfectly for lazy init
//
// NOTE: This is POC code for reference. Production state is in state::VaughanState

pub struct PocNetworkController {
    provider: RootProvider<Http<Client>>,
    network_id: String,
}

impl PocNetworkController {
    pub async fn new(rpc_url: &str, network_id: String) -> Result<Self, String> {
        let provider = ProviderBuilder::new()
            .on_http(rpc_url.parse().map_err(|e| format!("Invalid URL: {}", e))?);

        Ok(Self {
            provider,
            network_id,
        })
    }

    pub async fn get_block_number(&self) -> Result<u64, String> {
        self.provider
            .get_block_number()
            .await
            .map_err(|e| format!("Failed to get block number: {}", e))
    }

    pub fn network_id(&self) -> &str {
        &self.network_id
    }
}

pub struct PocVaughanState {
    controllers: Arc<Mutex<HashMap<String, Arc<PocNetworkController>>>>,
}

impl Default for PocVaughanState {
    fn default() -> Self {
        Self::new()
    }
}

impl PocVaughanState {
    pub fn new() -> Self {
        Self {
            controllers: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn get_or_create_controller(
        &self,
        network_id: &str,
    ) -> Result<Arc<PocNetworkController>, String> {
        let mut controllers = self.controllers.lock().await;

        if let Some(controller) = controllers.get(network_id) {
            println!("✅ Using cached controller for network: {}", network_id);
            return Ok(Arc::clone(controller));
        }

        println!("🔨 Creating new controller for network: {}", network_id);

        let rpc_url = match network_id {
            "ethereum" => "https://eth.llamarpc.com",
            "polygon" => "https://polygon-rpc.com",
            _ => return Err(format!("Unknown network: {}", network_id)),
        };

        let controller =
            Arc::new(PocNetworkController::new(rpc_url, network_id.to_string()).await?);
        controllers.insert(network_id.to_string(), Arc::clone(&controller));

        Ok(controller)
    }

    pub async fn controller_count(&self) -> usize {
        self.controllers.lock().await.len()
    }
}

#[tauri::command]
async fn get_block_with_controller(
    state: State<'_, Arc<Mutex<PocVaughanState>>>,
    network_id: String,
) -> Result<String, String> {
    let state = state.lock().await;
    let controller = state.get_or_create_controller(&network_id).await?;
    let block_number = controller.get_block_number().await?;

    Ok(format!(
        "✅ Block: {} (Network: {})",
        block_number,
        controller.network_id()
    ))
}

#[tauri::command]
async fn get_controller_count(
    state: State<'_, Arc<Mutex<PocVaughanState>>>,
) -> Result<String, String> {
    let state = state.lock().await;
    let count = state.controller_count().await;
    Ok(format!("📊 Cached controllers: {}", count))
}

// ============================================================================
// POC-3: MetaMask Provider Injection Test
// ============================================================================
// Validates: dApp integration with window.ethereum provider
// Result: ✅ SUCCESS - All 4 methods work (chainId, accounts, requestAccounts, blockNumber)
// Lesson: Use window.__TAURI_INTERNALS__.invoke with wait loop for API availability

#[tauri::command]
async fn eth_request(
    method: String,
    _params: Vec<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    println!("📥 eth_request called: {}", method);

    match method.as_str() {
        "eth_chainId" => {
            // Return Ethereum mainnet chain ID
            Ok(serde_json::json!("0x1"))
        },
        "eth_accounts" | "eth_requestAccounts" => {
            // Return mock account
            Ok(serde_json::json!([
                "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
            ]))
        },
        "eth_blockNumber" => {
            // Get real block number from Ethereum
            let rpc_url = "https://eth.llamarpc.com";
            let provider = ProviderBuilder::new()
                .on_http(rpc_url.parse().map_err(|e| format!("Invalid URL: {}", e))?);

            let block_number = provider
                .get_block_number()
                .await
                .map_err(|e| format!("Failed to get block number: {}", e))?;

            Ok(serde_json::json!(format!("0x{:x}", block_number)))
        },
        _ => Err(format!("Unsupported method: {}", method)),
    }
}

#[tauri::command]
async fn open_dapp_test(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::WebviewWindowBuilder;

    println!("🌐 Opening dApp test window...");

    WebviewWindowBuilder::new(
        &app,
        "dapp-test",
        tauri::WebviewUrl::App("dapp-test.html".into()),
    )
    .title("dApp Test")
    .inner_size(800.0, 600.0)
    .build()
    .map_err(|e| format!("Failed to create window: {}", e))?;

    Ok(())
}

// ============================================================================
// Tauri App Setup
// ============================================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // First: setup window correctly based on screen size (16:9, 80% height)
            if let Some(window) = app.get_webview_window("main") {
                if let Ok(Some(monitor)) = window.primary_monitor() {
                    let size = monitor.size();
                    let target_height = (size.height as f64 * 0.8) as u32;
                    let target_width = (target_height as f64 * (1.0 / 1.618)) as u32;

                    let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
                        width: target_width,
                        height: target_height,
                    }));
                    let _ = window.center();
                }
                let _ = window.show();
                let _ = window.set_focus();
            }

            // Initialize structured logging
            dapp::logging::init_logging();
            
            // Initialize production VaughanState
            println!("🚀 Initializing Vaughan Wallet...");
            
            // VaughanState::new() is async, so we need to block on it
            let production_state = tauri::async_runtime::block_on(async {
                state::VaughanState::new().await
            }).expect("Failed to initialize VaughanState");
            
            app.manage(production_state);
            println!("✅ Production VaughanState initialized");

            // Start background balance watcher for incoming transaction sounds
            // Uses Tauri's AppHandle to access state (no Clone needed on VaughanState)
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                use alloy::primitives::{U256, Address};
                use alloy::providers::Provider;
                use std::time::Duration;
                use crate::models::IERC20;
                use std::collections::HashMap;
                use tauri::Emitter;

                println!("[BalanceWatcher] Started — polling every 10s");
                let mut interval = tokio::time::interval(Duration::from_secs(10));
                let mut last_balance: Option<U256> = None;
                let mut last_token_balances: HashMap<Address, U256> = HashMap::new();
                let mut last_account: Option<Address> = None;

                loop {
                    interval.tick().await;

                    let state = app_handle.state::<state::VaughanState>();

                    // Skip if wallet is locked
                    if state.is_locked().await {
                        last_balance = None;
                        last_token_balances.clear();
                        continue;
                    }

                    // Get active account (reset baseline on account switch)
                    let account = match state.active_account().await {
                        Ok(a) => a,
                        Err(_) => {
                            last_balance = None;
                            last_token_balances.clear();
                            continue;
                        }
                    };
                    if last_account != Some(account) {
                        eprintln!("[BalanceWatcher] Account set: {:?}", account);
                        last_balance = None;
                        last_token_balances.clear();
                        last_account = Some(account);
                    }

                    // Get current adapter and tracked tokens
                    let adapter = match state.current_adapter().await {
                        Ok(a) => a,
                        Err(e) => {
                            eprintln!("[BalanceWatcher] No adapter: {:?}", e);
                            continue;
                        }
                    };
                    let provider = adapter.provider();
                    let chain_id = adapter.chain_id();

                    // 1. Check native balance
                    if let Ok(balance) = provider.get_balance(account).await {
                         // Play sound only if balance increased (not on first read)
                        match last_balance {
                            Some(prev) if balance > prev => {
                                eprintln!("[BalanceWatcher] 💰 Native incoming detected! {} -> {}", prev, balance);
                                if let Err(e) = state.sound_player.play(audio::AlertSound::TransactionIncoming) {
                                    eprintln!("[BalanceWatcher] Sound error: {}", e);
                                }
                                // Signal UI to refresh
                                let _ = app_handle.emit("refresh-balance", ());
                            }
                            None => {
                                eprintln!("[BalanceWatcher] Native baseline set: {}", balance);
                            }
                            _ => {} 
                        }
                        last_balance = Some(balance);
                    }

                    // 2. Check tracked tokens balances
                    let tokens = {
                        let tt = state.tracked_tokens.lock().await;
                        tt.get(&chain_id).cloned().unwrap_or_default()
                    };

                    for token in tokens {
                        let token_addr = match token.address.parse::<Address>() {
                            Ok(addr) => addr,
                            Err(_) => continue,
                        };

                        let contract = IERC20::new(token_addr, provider.clone());
                        if let Ok(resp) = contract.balanceOf(account).call().await {
                            let balance: U256 = resp._0;
                            
                            if let Some(prev) = last_token_balances.get(&token_addr) {
                                if balance > *prev {
                                    eprintln!("[BalanceWatcher] 💰 Token incoming detected! {} {} -> {}", token.symbol, prev, balance);
                                    if let Err(e) = state.sound_player.play(audio::AlertSound::TransactionIncoming) {
                                        eprintln!("[BalanceWatcher] Sound error: {}", e);
                                    }
                                    // Signal UI to refresh
                                    let _ = app_handle.emit("refresh-balance", ());
                                }
                            } else {
                                eprintln!("[BalanceWatcher] Token baseline set for {}: {}", token.symbol, balance);
                            }
                            last_token_balances.insert(token_addr, balance);
                        }
                    }
                }
            });
            println!("🔊 Balance watcher started");

            // Initialize POC state (for reference commands)
            let poc_state = Arc::new(Mutex::new(PocVaughanState::new()));
            app.manage(poc_state);
            println!("✅ POC state initialized (for reference)");

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // ============================================================
            // PRODUCTION COMMANDS (Phase 1, Days 9-12)
            // ============================================================

            // Network Commands (5)
            commands::network::switch_network,
            commands::network::get_balance,
            commands::network::get_network_info,
            commands::network::get_chain_id,
            commands::network::get_block_number,
            // Token Commands (2)
            commands::token::get_token_price,
            commands::token::refresh_token_prices,
            commands::token::get_token_balance,
            commands::token::get_token_metadata,
            commands::token::add_custom_token,
            commands::token::remove_custom_token,
            commands::token::get_tracked_tokens,
            // Persistence Commands (4) - Phase 1.6
            commands::persistence::export_state,
            commands::persistence::reset_state,
            commands::persistence::get_user_preferences,
            commands::persistence::update_user_preferences,
            // Transaction Commands (5) - Phase 1.5, Day 14
            commands::transaction::validate_transaction,
            commands::transaction::estimate_gas_simple,
            commands::transaction::build_transaction,
            commands::transaction::sign_transaction,
            commands::transaction::send_transaction,
            // Wallet Commands (11) - Phase 1.5, Days 12-13 + Phase 2
            commands::network::get_supported_networks,
            commands::wallet::create_wallet,
            commands::wallet::import_wallet,
            commands::wallet::unlock_wallet,
            commands::wallet::lock_wallet,
            commands::wallet::is_wallet_locked,
            commands::wallet::wallet_exists,
            commands::wallet::get_accounts,
            commands::wallet::create_account,
            commands::wallet::import_account,
            commands::wallet::delete_account,
            commands::wallet::rename_account,
            commands::wallet::set_active_account,
            commands::wallet::export_mnemonic,
            commands::wallet::export_private_key,
            commands::wallet::get_railgun_mnemonic,
            // dApp Commands (9) - Phase 3.1 + 3.2
            commands::dapp::dapp_request,
            commands::dapp::connect_dapp,
            commands::dapp::disconnect_dapp,
            commands::dapp::get_connected_dapps,
            commands::dapp::disconnect_dapp_by_origin,
            commands::dapp::get_pending_approvals,
            commands::dapp::respond_to_approval,
            commands::dapp::cancel_approval,
            commands::dapp::clear_all_approvals,
            commands::dapp::get_performance_stats,
            commands::dapp::launch_external_app,
            // dApp IPC Command (1) - Phase 3.8: Tauri IPC Bridge
            commands::dapp_ipc::handle_dapp_request,
            // Window Commands (6) - Phase 3.2 + 3.4 + 3.7
            commands::window::open_dapp_browser,
            commands::window::open_dapp_url,
            commands::window::open_dapp_window,  // New: Direct injection mode
            commands::window::navigate_dapp,
            commands::window::close_dapp,
            commands::window::get_dapp_url,

            // History Commands (1)
            commands::history::get_transactions,

            // Audio Commands (4) - Phase 1.9
            commands::audio::play_sound,
            commands::audio::update_sound_config,
            commands::audio::get_sound_config,
            commands::audio::test_sound,

            // ============================================================
            // POC COMMANDS (Phase 0 - Reference Only)
            // ============================================================

            // POC-2: Controller lazy initialization
            get_block_with_controller,
            get_controller_count,
            // POC-3: MetaMask provider injection
            eth_request,
            open_dapp_test,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
