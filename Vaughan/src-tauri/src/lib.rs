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

use tauri::Manager;



// ============================================================================
// Tauri App Setup
// ============================================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // First: setup window correctly based on screen size (golden ratio, 80% height)
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


        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
