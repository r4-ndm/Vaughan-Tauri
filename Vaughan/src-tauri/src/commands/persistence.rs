//! Persistence commands
//!
//! Commands for managing persisted application state.

use crate::core::persistence::{PersistedState, UserPreferences};
use crate::error::WalletError;
use crate::state::VaughanState;
use tauri::State;

/// Export current persisted state
///
/// Returns the raw JSON content of the state file.
/// Useful for debugging or backups.
#[tauri::command]
pub async fn export_state(
    state: State<'_, VaughanState>,
) -> Result<PersistedState, WalletError> {
    Ok(state.state_manager().load())
}

/// Reset persisted state
///
/// Deletes the state file. The app will use defaults on next restart.
/// Note: This does not reset the currently running in-memory state.
#[tauri::command]
pub async fn reset_state(state: State<'_, VaughanState>) -> Result<(), WalletError> {
    state.wallet_service.wipe().await?;
    state.state_manager().reset()
}

/// Get current user preferences
///
/// Returns the user preferences from the persisted state.
#[tauri::command]
pub async fn get_user_preferences(
    state: State<'_, VaughanState>,
) -> Result<UserPreferences, WalletError> {
    Ok(state.state_manager().load().preferences)
}

/// Update user preferences
///
/// Saves the updated user preferences to the persisted state.
#[tauri::command]
pub async fn update_user_preferences(
    state: State<'_, VaughanState>,
    preferences: UserPreferences,
) -> Result<(), WalletError> {
    let state_manager = state.state_manager();
    let mut current_state = state_manager.load();
    current_state.preferences = preferences;
    state_manager.save(&current_state)
}
