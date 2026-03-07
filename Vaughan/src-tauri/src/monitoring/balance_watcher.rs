//! Background Balance Watcher
//!
//! Polls for native and token balance changes on the active account.
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
/// This polls every 10 seconds for native and ERC-20 token balance changes.
/// When a balance increases, it plays a sound and signals the UI to refresh.
pub fn spawn(app_handle: AppHandle) {
    tauri::async_runtime::spawn(async move {
        info!("[BalanceWatcher] Started — polling every 10s");
        let mut interval = tokio::time::interval(Duration::from_secs(10));
        let mut last_balance: Option<U256> = None;
        let mut last_token_balances: HashMap<Address, U256> = HashMap::new();
        let mut last_account: Option<Address> = None;

        loop {
            interval.tick().await;

            let state = app_handle.state::<VaughanState>();

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
                debug!("[BalanceWatcher] Account set: {:?}", account);
                last_balance = None;
                last_token_balances.clear();
                last_account = Some(account);
            }

            // Get current adapter and tracked tokens
            let adapter = match state.current_adapter().await {
                Ok(a) => a,
                Err(e) => {
                    debug!("[BalanceWatcher] No adapter: {:?}", e);
                    continue;
                }
            };
            let provider = adapter.provider();
            let chain_id = adapter.chain_id();

            // 1. Check native balance
            if let Ok(balance) = provider.get_balance(account).await {
                match last_balance {
                    Some(prev) if balance > prev => {
                        info!(
                            "[BalanceWatcher] Native incoming detected: {} -> {}",
                            prev, balance
                        );
                        if let Err(e) =
                            state.sound_player.play(audio::AlertSound::TransactionIncoming)
                        {
                            warn!("[BalanceWatcher] Sound error: {}", e);
                        }
                        let _ = app_handle.emit("refresh-balance", ());
                    }
                    None => {
                        debug!("[BalanceWatcher] Native baseline set: {}", balance);
                    }
                    _ => {}
                }
                last_balance = Some(balance);
            }

            // 2. Check tracked token balances
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
                            info!(
                                "[BalanceWatcher] Token incoming: {} {} -> {}",
                                token.symbol, prev, balance
                            );
                            if let Err(e) =
                                state.sound_player.play(audio::AlertSound::TransactionIncoming)
                            {
                                warn!("[BalanceWatcher] Sound error: {}", e);
                            }
                            let _ = app_handle.emit("refresh-balance", ());
                        }
                    } else {
                        debug!(
                            "[BalanceWatcher] Token baseline set for {}: {}",
                            token.symbol, balance
                        );
                    }
                    last_token_balances.insert(token_addr, balance);
                }
            }
        }
    });
}
