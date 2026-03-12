//! Persistence commands
//!
//! Commands for managing persisted application state.

use crate::core::persistence::{PersistedState, UserPreferences};
use crate::error::WalletError;
use crate::models::wallet::AccountExport;
use crate::state::VaughanState;
use serde::Serialize;
use specta::Type;
use tauri::State;

/// Persisted state shape for IPC/TypeScript (accounts use string address).
#[derive(Debug, Clone, Serialize, Type)]
pub struct PersistedStateExport {
    pub version: u32,
    pub active_network_id: Option<String>,
    pub active_network_rpc: Option<String>,
    pub active_network_chain_id: Option<u64>,
    pub active_account: Option<String>,
    pub accounts: Vec<AccountExport>,
    pub custom_networks: Vec<crate::core::NetworkConfig>,
    pub tracked_tokens: Vec<crate::models::token::TrackedToken>,
    pub preferences: UserPreferences,
}

impl From<PersistedState> for PersistedStateExport {
    fn from(s: PersistedState) -> Self {
        Self {
            version: s.version,
            active_network_id: s.active_network_id,
            active_network_rpc: s.active_network_rpc,
            active_network_chain_id: s.active_network_chain_id,
            active_account: s.active_account,
            accounts: s.accounts.into_iter().map(AccountExport::from).collect(),
            custom_networks: s.custom_networks,
            tracked_tokens: s.tracked_tokens,
            preferences: s.preferences,
        }
    }
}

/// Export current persisted state
///
/// Returns the raw JSON content of the state file.
/// Useful for debugging or backups.
#[tauri::command]
#[specta::specta]
pub async fn export_state(state: State<'_, VaughanState>) -> Result<PersistedStateExport, WalletError> {
    Ok(state.state_manager().load().into())
}

/// Reset persisted state
///
/// Deletes the state file. The app will use defaults on next restart.
/// Note: This does not reset the currently running in-memory state.
#[tauri::command]
#[specta::specta]
pub async fn reset_state(state: State<'_, VaughanState>) -> Result<(), WalletError> {
    state.wallet_service.wipe().await?;
    state.state_manager().reset()
}

/// Get current user preferences
///
/// Returns the user preferences from the persisted state.
#[tauri::command]
#[specta::specta]
pub async fn get_user_preferences(
    state: State<'_, VaughanState>,
) -> Result<UserPreferences, WalletError> {
    Ok(state.state_manager().load().preferences)
}

/// Update user preferences
///
/// Saves the updated user preferences to the persisted state.
#[tauri::command]
#[specta::specta]
pub async fn update_user_preferences(
    state: State<'_, VaughanState>,
    preferences: UserPreferences,
) -> Result<(), WalletError> {
    let state_manager = state.state_manager();
    let mut current_state = state_manager.load();
    current_state.preferences = preferences;
    state_manager.save(&current_state)
}
