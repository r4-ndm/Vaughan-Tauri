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
// Type-safe IPC: Builder provides invoke handler and event registry (mount_events in setup)
// ============================================================================

fn build_specta_builder() -> tauri_specta::Builder<tauri::Wry> {
    let builder = tauri_specta::Builder::<tauri::Wry>::new()
        .commands(tauri_specta::collect_commands![
        commands::network::switch_network,
        commands::network::get_balance,
        commands::network::get_network_info,
        commands::network::get_chain_id,
        commands::network::get_block_number,
        commands::network::get_supported_networks,
        commands::network::eth_request,
        commands::network::proxy_request,
        commands::token::get_token_price,
        commands::token::refresh_token_prices,
        commands::token::get_token_balance,
        commands::token::get_token_metadata,
        commands::token::add_custom_token,
        commands::token::remove_custom_token,
        commands::token::get_tracked_tokens,
        commands::persistence::export_state,
        commands::persistence::reset_state,
        commands::persistence::get_user_preferences,
        commands::persistence::update_user_preferences,
        commands::transaction::validate_transaction,
        commands::transaction::estimate_gas_simple,
        commands::transaction::build_transaction,
        commands::transaction::sign_transaction,
        commands::transaction::send_transaction,
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
        commands::wallet::report_activity,
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
        commands::dapp_ipc::handle_dapp_request,
        commands::window::open_dapp_browser,
        commands::window::open_dapp_url,
        commands::window::open_dapp_window,
        commands::window::navigate_dapp,
        commands::window::close_dapp,
        commands::window::get_dapp_url,
        commands::history::get_transactions,
        commands::audio::play_sound,
        commands::audio::update_sound_config,
        commands::audio::get_sound_config,
        commands::audio::test_sound,
    ])
        .events(tauri_specta::collect_events![
            monitoring::balance_watcher::RefreshBalanceEvent,
        ]);
    #[cfg(debug_assertions)]
    {
        use specta_typescript::{BigIntExportBehavior, Typescript};
        let _ = builder
            .export(
                Typescript::default().bigint(BigIntExportBehavior::String),
                "../web/src/bindings/tauri-commands.ts",
            )
            .expect("Failed to export TypeScript bindings");
    }
    builder
}

// ============================================================================
// Tauri App Setup
// ============================================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let specta_builder = build_specta_builder();
    let invoke_handler = specta_builder.invoke_handler();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(invoke_handler)
        .setup(move |app| {
            // Required for typed events (e.g. RefreshBalanceEvent) to be emitted without panic
            specta_builder.mount_events(app);
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

            // Persist state periodically so accounts survive app close without explicit save
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(30));
                loop {
                    interval.tick().await;
                    if let Err(e) = handle.state::<state::VaughanState>().save_state().await {
                        tracing::debug!("[Vaughan] Periodic state save failed: {}", e);
                    }
                }
            });
            info!("Periodic state save started (every 30s)");

            // Start background proxy server (Phase 3.6)
            tauri::async_runtime::spawn(async move {
                dapp::proxy::start_proxy_server().await;
            });
            info!("Proxy server started (http://127.0.0.1:8765)");

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
