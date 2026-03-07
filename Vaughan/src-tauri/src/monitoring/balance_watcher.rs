//! Background Balance Watcher
//!
//! Polls for balance changes of the *focused* asset.
//! Plays a sound alert and emits a `refresh-balance` event to the UI
//! when an incoming transfer is detected.

use alloy::primitives::{Address, U256};
use alloy::providers::Provider;
use std::collections::HashMap;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};
use tracing::{debug, info, warn};

use crate::audio;
use crate::models::IERC20;
use crate::state::VaughanState;

/// Spawn the background balance watcher task.
///
/// This polls every 10 seconds for balance changes of the *focused* asset.
/// When a balance increases, it plays a sound and signals the UI to refresh.
pub fn spawn(app_handle: AppHandle) {
    tauri::async_runtime::spawn(async move {
        info!("[BalanceWatcher] Started — polling every 10s");
        let mut interval = tokio::time::interval(Duration::from_secs(10));
        let mut last_balance: Option<U256> = None;
        let mut last_token_balances: HashMap<Address, U256> = HashMap::new();
        let mut last_account: Option<Address> = None;
        let mut last_chain_id: Option<u64> = None;

        loop {
            interval.tick().await;

            let state = app_handle.state::<VaughanState>();

            // Skip if wallet is locked
            if state.is_locked().await {
                last_balance = None;
                last_token_balances.clear();
                continue;
            }

            // Get active account
            let account = match state.active_account().await {
                Ok(a) => a,
                Err(_) => {
                    last_balance = None;
                    last_token_balances.clear();
                    continue;
                },
            };
            if last_account != Some(account) {
                last_balance = None;
                last_token_balances.clear();
                last_account = Some(account);
            }

            // Get current adapter
            let adapter = match state.current_adapter().await {
                Ok(a) => a,
                Err(_) => continue,
            };
            let provider = adapter.provider();
            let chain_id = adapter.chain_id();

            // Reset baseline on network switch
            if last_chain_id != Some(chain_id) {
                last_balance = None;
                last_token_balances.clear();
                last_chain_id = Some(chain_id);
            }

            // Determine focus
            let focused = state
                .focused_asset
                .lock()
                .await
                .clone()
                .unwrap_or_else(|| "native".to_string());

            if focused == "native" {
                // Poll native balance
                if let Ok(balance) = provider.get_balance(account).await {
                    if let Some(prev) = last_balance {
                        if balance > prev {
                            info!("[BalanceWatcher] Native incoming detected: {} -> {}", prev, balance);
                            if let Err(e) = state.sound_player.play(audio::AlertSound::CoinDrop) {
                                warn!("[BalanceWatcher] Sound error: {}", e);
                            }
                            let _ = app_handle.emit("refresh-balance", ());
                        }
                    } else {
                        debug!("[BalanceWatcher] Native baseline set: {}", balance);
                    }
                    last_balance = Some(balance);
                }
            } else if let Ok(token_addr) = focused.parse::<Address>() {
                // Poll specific token
                let contract = IERC20::new(token_addr, provider.clone());
                if let Ok(resp) = contract.balanceOf(account).call().await {
                    let balance: U256 = resp._0;
                    if let Some(prev) = last_token_balances.get(&token_addr) {
                        if balance > *prev {
                            info!("[BalanceWatcher] Token incoming ({:?}): {} -> {}", token_addr, prev, balance);
                            if let Err(e) = state.sound_player.play(audio::AlertSound::CoinDrop) {
                                warn!("[BalanceWatcher] Sound error: {}", e);
                            }
                            let _ = app_handle.emit("refresh-balance", ());
                        }
                    } else {
                        debug!("[BalanceWatcher] Token baseline set for {:?}: {}", token_addr, balance);
                    }
                    last_token_balances.insert(token_addr, balance);
                }
            }
        }
    });
}
