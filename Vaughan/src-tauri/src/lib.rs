// ============================================================================
// Vaughan Wallet - Tauri Backend Entry Point
// ============================================================================

// Production modules
pub mod audio;
pub mod chains;
pub mod commands;
pub mod core;
pub mod dapp;
pub mod error;
pub mod models;
pub mod monitoring;
pub mod security;
pub mod state;

use tauri::Manager;
use tracing::info;

// ============================================================================
// Tauri App Setup
// ============================================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Setup window (golden ratio, 80% screen height)
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
            info!("Initializing Vaughan Wallet...");
            let production_state =
                tauri::async_runtime::block_on(async { state::VaughanState::new().await })
                    .expect("Failed to initialize VaughanState");

            app.manage(production_state);
            info!("VaughanState initialized");

            // Start background balance watcher
            monitoring::balance_watcher::spawn(app.handle().clone());
            info!("Balance watcher started");

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Network Commands
            commands::network::switch_network,
            commands::network::get_balance,
            commands::network::get_network_info,
            commands::network::get_chain_id,
            commands::network::get_block_number,
            commands::network::get_supported_networks,
            // Token Commands
            commands::token::get_token_price,
            commands::token::refresh_token_prices,
            commands::token::get_token_balance,
            commands::token::get_token_metadata,
            commands::token::add_custom_token,
            commands::token::remove_custom_token,
            commands::token::get_tracked_tokens,
            // Persistence Commands
            commands::persistence::export_state,
            commands::persistence::reset_state,
            commands::persistence::get_user_preferences,
            commands::persistence::update_user_preferences,
            // Transaction Commands
            commands::transaction::validate_transaction,
            commands::transaction::estimate_gas_simple,
            commands::transaction::build_transaction,
            commands::transaction::sign_transaction,
            commands::transaction::send_transaction,
            // Wallet Commands
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
            commands::wallet::set_focused_asset,
            // dApp Commands
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
            // dApp IPC Command
            commands::dapp_ipc::handle_dapp_request,
            // Window Commands
            commands::window::open_dapp_browser,
            commands::window::open_dapp_url,
            commands::window::open_dapp_window,
            commands::window::navigate_dapp,
            commands::window::close_dapp,
            commands::window::get_dapp_url,
            // History Commands
            commands::history::get_transactions,
            // Audio Commands
            commands::audio::play_sound,
            commands::audio::update_sound_config,
            commands::audio::get_sound_config,
            commands::audio::test_sound,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
