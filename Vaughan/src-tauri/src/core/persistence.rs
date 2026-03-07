//! State Persistence Module
//!
//! Persists non-sensitive application state to disk so the app remembers
//! its configuration across restarts.
//!
//! ## Storage Layout
//!
//! ```text
//! <data_dir>/vaughan/
//!   ├── state.json          ← App state (this module)
//!   └── certs/              ← TLS certificates (cert.rs)
//! ```
//!
//! ## Security Note
//!
//! Private keys are stored in the OS keychain via `keyring_service.rs`.
//! This module only persists non-sensitive data like active network,
//! account address, and user preferences.

use crate::core::network::NetworkConfig;
use crate::error::WalletError;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// Current state file version
const STATE_VERSION: u32 = 1;

/// Default state file name
const STATE_FILE: &str = "state.json";

/// User preferences
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserPreferences {
    /// Whether sound alerts are enabled
    pub sound_enabled: bool,

    /// UI theme ("dark" or "light")
    pub theme: String,

    /// Auto-lock timeout in seconds (0 = disabled)
    pub auto_lock_seconds: u64,

    /// Default gas multiplier for fee estimation (e.g. 1.2 = 20% buffer)
    pub gas_multiplier: f64,

    /// Whether privacy features (Railgun Shadow Engine) are enabled
    pub privacy_enabled: bool,
}

impl Default for UserPreferences {
    fn default() -> Self {
        Self {
            sound_enabled: true,
            theme: "dark".to_string(),
            auto_lock_seconds: 300, // 5 minutes
            gas_multiplier: 1.2,
            privacy_enabled: true,
        }
    }
}

/// Persisted application state
///
/// This struct is serialized to JSON and saved to disk.
/// It contains everything needed to restore the app to its previous state.
use crate::models::token::TrackedToken;

// ... (existing imports)

/// Persisted application state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistedState {
    /// Schema version for forward-compatible migrations
    pub version: u32,

    /// Last active network ID (e.g. "pulsechain-testnet-v4")
    pub active_network_id: Option<String>,

    /// RPC URL for the active network
    pub active_network_rpc: Option<String>,

    /// Chain ID for the active network  
    pub active_network_chain_id: Option<u64>,

    /// Last active account address (0x...)
    pub active_account: Option<String>,

    /// User-added custom network configurations
    pub custom_networks: Vec<NetworkConfig>,

    /// User-tracked custom tokens
    #[serde(default)] // For backward compatibility with existing state files
    pub tracked_tokens: Vec<TrackedToken>,

    /// User preferences
    pub preferences: UserPreferences,
}

impl Default for PersistedState {
    fn default() -> Self {
        Self {
            version: STATE_VERSION,
            active_network_id: Some("pulsechain-testnet-v4".to_string()),
            active_network_rpc: Some("https://rpc.v4.testnet.pulsechain.com".to_string()),
            active_network_chain_id: Some(943),
            active_account: None,
            custom_networks: Vec::new(),
            tracked_tokens: Vec::new(),
            preferences: UserPreferences::default(),
        }
    }
}

/// State persistence manager
///
/// Handles loading and saving application state to a JSON file
/// in the platform-specific data directory.
pub struct StateManager {
    /// Path to the state file
    state_path: PathBuf,
}

impl StateManager {
    /// Create a new StateManager
    ///
    /// Resolves the platform-specific data directory:
    /// - Windows: `%APPDATA%\vaughan\state.json`
    /// - macOS: `~/Library/Application Support/vaughan/state.json`
    /// - Linux: `~/.local/share/vaughan/state.json`
    pub fn new() -> Result<Self, WalletError> {
        let data_dir = dirs::data_dir()
            .ok_or_else(|| {
                WalletError::InternalError("Failed to resolve app data directory".to_string())
            })?
            .join("vaughan");

        // Create directory if it doesn't exist
        fs::create_dir_all(&data_dir).map_err(|e| {
            WalletError::InternalError(format!("Failed to create data directory: {}", e))
        })?;

        Ok(Self {
            state_path: data_dir.join(STATE_FILE),
        })
    }

    /// Create a StateManager with a custom path (for testing)
    #[cfg(test)]
    pub fn with_path(path: PathBuf) -> Self {
        Self { state_path: path }
    }

    /// Load persisted state from disk
    ///
    /// Falls back to defaults if:
    /// - File doesn't exist (first run)
    /// - File is corrupted (invalid JSON)
    /// - Version is incompatible
    pub fn load(&self) -> PersistedState {
        match self.try_load() {
            Ok(state) => state,
            Err(e) => {
                eprintln!(
                    "[StateManager] Failed to load state (using defaults): {}",
                    e
                );
                PersistedState::default()
            }
        }
    }

    /// Attempt to load state, returning an error on failure
    fn try_load(&self) -> Result<PersistedState, WalletError> {
        if !self.state_path.exists() {
            return Err(WalletError::InternalError(
                "State file does not exist (first run)".to_string(),
            ));
        }

        let contents = fs::read_to_string(&self.state_path).map_err(|e| {
            WalletError::InternalError(format!("Failed to read state file: {}", e))
        })?;

        let state: PersistedState = serde_json::from_str(&contents).map_err(|e| {
            WalletError::InternalError(format!("Failed to parse state file: {}", e))
        })?;

        // Version check — if loaded version is newer, fall back to defaults
        if state.version > STATE_VERSION {
            return Err(WalletError::InternalError(format!(
                "State file version {} is newer than supported version {}",
                state.version, STATE_VERSION
            )));
        }

        // Future: migration logic for state.version < STATE_VERSION
        // if state.version == 1 { migrate_v1_to_v2(&mut state); }

        Ok(state)
    }

    /// Save state to disk
    ///
    /// Uses atomic write (write to temp file, then rename) to prevent
    /// corruption from crashes or power loss.
    pub fn save(&self, state: &PersistedState) -> Result<(), WalletError> {
        let json = serde_json::to_string_pretty(state).map_err(|e| {
            WalletError::InternalError(format!("Failed to serialize state: {}", e))
        })?;

        // Atomic write: write to .tmp then rename
        let tmp_path = self.state_path.with_extension("json.tmp");

        fs::write(&tmp_path, &json).map_err(|e| {
            WalletError::InternalError(format!("Failed to write temp state file: {}", e))
        })?;

        if let Err(rename_err) = fs::rename(&tmp_path, &self.state_path) {
            // If rename fails (e.g. cross-device), fall back to direct write
            eprintln!(
                "[StateManager] Atomic rename failed ({}), falling back to direct write",
                rename_err
            );
            fs::write(&self.state_path, &json).map_err(|e| {
                WalletError::InternalError(format!("Failed to save state file: {}", e))
            })?;
            // Clean up tmp file
            let _ = fs::remove_file(&tmp_path);
        }

        Ok(())
    }

    /// Get the state file path (for display/debugging)
    pub fn state_path(&self) -> &PathBuf {
        &self.state_path
    }

    /// Delete state file (reset to defaults on next load)
    pub fn reset(&self) -> Result<(), WalletError> {
        if self.state_path.exists() {
            fs::remove_file(&self.state_path).map_err(|e| {
                WalletError::InternalError(format!("Failed to delete state file: {}", e))
            })?;
        }
        Ok(())
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::chains::ChainType;
    use crate::core::network::TokenInfo;
    use std::io::Write;

    fn temp_state_path() -> PathBuf {
        let dir = std::env::temp_dir().join("vaughan_test");
        fs::create_dir_all(&dir).unwrap();
        dir.join(format!("state_test_{}.json", uuid::Uuid::new_v4()))
    }

    #[test]
    fn test_default_state() {
        let state = PersistedState::default();
        assert_eq!(state.version, STATE_VERSION);
        assert_eq!(
            state.active_network_id.as_deref(),
            Some("pulsechain-testnet-v4")
        );
        assert!(state.active_account.is_none());
        assert!(state.custom_networks.is_empty());
        assert!(state.preferences.sound_enabled);
        assert_eq!(state.preferences.theme, "dark");
        println!("✅ Default state is correct");
    }

    #[test]
    fn test_save_and_load_roundtrip() {
        let path = temp_state_path();
        let manager = StateManager::with_path(path.clone());

        let mut state = PersistedState::default();
        state.active_network_id = Some("ethereum-mainnet".to_string());
        state.active_network_rpc = Some("https://eth.llamarpc.com".to_string());
        state.active_network_chain_id = Some(1);
        state.active_account = Some("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045".to_string());
        state.preferences.theme = "light".to_string();

        // Save
        manager.save(&state).unwrap();
        assert!(path.exists());

        // Load
        let loaded = manager.load();
        assert_eq!(loaded.active_network_id, state.active_network_id);
        assert_eq!(loaded.active_network_rpc, state.active_network_rpc);
        assert_eq!(loaded.active_network_chain_id, state.active_network_chain_id);
        assert_eq!(loaded.active_account, state.active_account);
        assert_eq!(loaded.preferences.theme, "light");

        // Cleanup
        let _ = fs::remove_file(&path);
        println!("✅ Save/load roundtrip works");
    }

    #[test]
    fn test_load_nonexistent_file_returns_defaults() {
        let path = temp_state_path();
        let manager = StateManager::with_path(path);

        let state = manager.load();
        assert_eq!(state.version, STATE_VERSION);
        assert_eq!(
            state.active_network_id.as_deref(),
            Some("pulsechain-testnet-v4")
        );
        println!("✅ Loading nonexistent file returns defaults");
    }

    #[test]
    fn test_corrupted_file_returns_defaults() {
        let path = temp_state_path();
        let manager = StateManager::with_path(path.clone());

        // Write garbage
        let mut f = fs::File::create(&path).unwrap();
        f.write_all(b"this is not valid json!!!").unwrap();

        let state = manager.load();
        assert_eq!(state.version, STATE_VERSION);
        assert_eq!(
            state.active_network_id.as_deref(),
            Some("pulsechain-testnet-v4")
        );

        // Cleanup
        let _ = fs::remove_file(&path);
        println!("✅ Corrupted file gracefully falls back to defaults");
    }

    #[test]
    fn test_future_version_returns_defaults() {
        let path = temp_state_path();
        let manager = StateManager::with_path(path.clone());

        // Write state with version 999
        let future_state = serde_json::json!({
            "version": 999,
            "active_network_id": "future-chain",
            "active_network_rpc": null,
            "active_network_chain_id": null,
            "active_account": null,
            "custom_networks": [],
            "preferences": {
                "sound_enabled": true,
                "theme": "dark",
                "auto_lock_seconds": 300,
                "gas_multiplier": 1.2
            }
        });
        fs::write(&path, serde_json::to_string(&future_state).unwrap()).unwrap();

        let state = manager.load();
        // Should fall back to defaults since version 999 > STATE_VERSION
        assert_eq!(state.version, STATE_VERSION);
        assert_ne!(state.active_network_id.as_deref(), Some("future-chain"));

        // Cleanup
        let _ = fs::remove_file(&path);
        println!("✅ Future version falls back to defaults");
    }

    #[test]
    fn test_save_with_custom_networks() {
        let path = temp_state_path();
        let manager = StateManager::with_path(path.clone());

        let mut state = PersistedState::default();
        state.custom_networks.push(NetworkConfig {
            id: "my-chain".to_string(),
            name: "My Custom Chain".to_string(),
            chain_type: ChainType::Evm,
            chain_id: 12345,
            rpc_url: "https://my-rpc.example.com".to_string(),
            explorer_url: Some("https://explorer.example.com".to_string()),
            native_token: TokenInfo {
                symbol: "MYC".to_string(),
                name: "My Coin".to_string(),
                decimals: 18,
            },
            is_testnet: false,
        });

        manager.save(&state).unwrap();
        let loaded = manager.load();
        assert_eq!(loaded.custom_networks.len(), 1);
        assert_eq!(loaded.custom_networks[0].id, "my-chain");
        assert_eq!(loaded.custom_networks[0].chain_id, 12345);

        // Cleanup
        let _ = fs::remove_file(&path);
        println!("✅ Custom networks persist correctly");
    }

    #[test]
    fn test_reset_deletes_file() {
        let path = temp_state_path();
        let manager = StateManager::with_path(path.clone());

        // Save and verify file exists
        manager.save(&PersistedState::default()).unwrap();
        assert!(path.exists());

        // Reset
        manager.reset().unwrap();
        assert!(!path.exists());

        // Load after reset returns defaults
        let state = manager.load();
        assert_eq!(state.version, STATE_VERSION);
        println!("✅ Reset deletes state file");
    }

    #[test]
    fn test_state_manager_new() {
        // Should succeed on all platforms
        let manager = StateManager::new();
        assert!(manager.is_ok());
        println!("✅ StateManager::new() works on this platform");
    }
}
