///! dApp Session Management
///!
///! Tracks connected dApps per window and validates origins
///!
///! **PHASE 3.4 UPDATE**: Sessions are now window-specific to support
///! multiple windows connecting to the same origin independently.

use crate::error::WalletError;
use alloy::primitives::Address;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Session key: (window_label, origin)
/// This ensures sessions are isolated per window
pub type SessionKey = (String, String);

/// dApp origin (e.g., "https://app.uniswap.org")
pub type DappOrigin = String;

/// dApp connection information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DappConnection {
    /// Window label (unique per window)
    pub window_label: String,

    /// dApp origin (e.g., "https://app.uniswap.org")
    pub origin: String,

    /// dApp name (if provided)
    pub name: Option<String>,

    /// dApp icon URL (if provided)
    pub icon: Option<String>,

    /// Connected accounts (addresses the dApp can see)
    pub accounts: Vec<Address>,

    /// Connection timestamp (Unix timestamp)
    pub connected_at: u64,

    /// Last activity timestamp (Unix timestamp)
    pub last_activity: u64,
}

/// Session manager for dApp connections
pub struct SessionManager {
    /// Active sessions ((window_label, origin) -> connection)
    sessions: Arc<RwLock<HashMap<SessionKey, DappConnection>>>,
}

impl SessionManager {
    /// Create new session manager
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Create new session for a specific window
    ///
    /// # Arguments
    ///
    /// * `window_label` - Unique window identifier
    /// * `origin` - dApp origin
    /// * `name` - dApp name (optional)
    /// * `icon` - dApp icon URL (optional)
    /// * `accounts` - Connected accounts
    ///
    /// # Returns
    ///
    /// * `Ok(())` - Session created
    /// * `Err(WalletError)` - Failed to create session
    pub async fn create_session_for_window(
        &self,
        window_label: &str,
        origin: &str,
        name: Option<String>,
        icon: Option<String>,
        accounts: Vec<Address>,
    ) -> Result<(), WalletError> {
        let mut sessions = self.sessions.write().await;

        eprintln!("[SessionManager] Creating session for window: {}, origin: {}", window_label, origin);

        let connection = DappConnection {
            window_label: window_label.to_string(),
            origin: origin.to_string(),
            name,
            icon,
            accounts,
            connected_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            last_activity: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        };

        let key = (window_label.to_string(), origin.to_string());
        sessions.insert(key, connection);
        eprintln!("[SessionManager] Session created. Total sessions: {}", sessions.len());
        Ok(())
    }

    /// Get session by window and origin
    ///
    /// # Arguments
    ///
    /// * `window_label` - Window identifier
    /// * `origin` - dApp origin
    ///
    /// # Returns
    ///
    /// * `Some(DappConnection)` - Session found
    /// * `None` - Session not found
    pub async fn get_session_by_window(
        &self,
        window_label: &str,
        origin: &str,
    ) -> Option<DappConnection> {
        let sessions = self.sessions.read().await;
        let key = (window_label.to_string(), origin.to_string());
        sessions.get(&key).cloned()
    }

    /// Validate session exists for window and origin
    ///
    /// # Arguments
    ///
    /// * `window_label` - Window identifier
    /// * `origin` - dApp origin to validate
    ///
    /// # Returns
    ///
    /// * `Ok(())` - Session valid
    /// * `Err(WalletError::NotConnected)` - No session
    /// * `Err(WalletError::OriginMismatch)` - Origin doesn't match
    pub async fn validate_session_for_window(
        &self,
        window_label: &str,
        origin: &str,
    ) -> Result<(), WalletError> {
        let sessions = self.sessions.read().await;
        let key = (window_label.to_string(), origin.to_string());

        match sessions.get(&key) {
            Some(session) => {
                // Validate origin matches exactly
                if session.origin != origin {
                    return Err(WalletError::OriginMismatch);
                }
                // Validate window label matches
                if session.window_label != window_label {
                    return Err(WalletError::Custom("Window label mismatch".to_string()));
                }
                Ok(())
            }
            None => Err(WalletError::NotConnected),
        }
    }

    /// Update session activity for a specific window
    ///
    /// # Arguments
    ///
    /// * `window_label` - Window identifier
    /// * `origin` - dApp origin
    pub async fn update_activity_for_window(
        &self,
        window_label: &str,
        origin: &str,
    ) -> Result<(), WalletError> {
        let mut sessions = self.sessions.write().await;
        let key = (window_label.to_string(), origin.to_string());

        match sessions.get_mut(&key) {
            Some(session) => {
                let new_activity = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs();
                
                // Ensure timestamp always increases (handle sub-second updates)
                session.last_activity = new_activity.max(session.last_activity + 1);
                Ok(())
            }
            None => Err(WalletError::NotConnected),
        }
    }

    /// Remove session for a specific window
    ///
    /// # Arguments
    ///
    /// * `window_label` - Window identifier
    /// * `origin` - dApp origin
    pub async fn remove_session_by_window(&self, window_label: &str, origin: &str) {
        let mut sessions = self.sessions.write().await;
        let key = (window_label.to_string(), origin.to_string());
        sessions.remove(&key);
    }

    /// Remove all sessions for a window
    ///
    /// Called when window is closed
    ///
    /// # Arguments
    ///
    /// * `window_label` - Window identifier
    pub async fn remove_all_sessions_for_window(&self, window_label: &str) {
        let mut sessions = self.sessions.write().await;
        sessions.retain(|(label, _), _| label != window_label);
        eprintln!("[SessionManager] Removed all sessions for window: {}", window_label);
    }

    /// Get all sessions
    ///
    /// # Returns
    ///
    /// * `Vec<SessionKey>` - All session keys (window_label, origin)
    pub async fn all_sessions(&self) -> Vec<SessionKey> {
        let sessions = self.sessions.read().await;
        sessions.keys().cloned().collect()
    }

    /// Get all window labels with active sessions
    ///
    /// # Returns
    ///
    /// * `Vec<String>` - All unique window labels
    pub async fn all_window_labels(&self) -> Vec<String> {
        let sessions = self.sessions.read().await;
        let mut labels: Vec<String> = sessions
            .keys()
            .map(|(label, _)| label.clone())
            .collect();
        labels.sort();
        labels.dedup();
        labels
    }

    /// Get session count
    ///
    /// # Returns
    ///
    /// * `usize` - Number of active sessions
    pub async fn session_count(&self) -> usize {
        let sessions = self.sessions.read().await;
        sessions.len()
    }

    // ========================================================================
    // Legacy methods (for backward compatibility during migration)
    // ========================================================================

    /// Create session (legacy - uses empty window label)
    ///
    /// **DEPRECATED**: Use `create_session_for_window` instead
    pub async fn create_session(
        &self,
        origin: String,
        name: Option<String>,
        icon: Option<String>,
        accounts: Vec<Address>,
    ) -> Result<(), WalletError> {
        self.create_session_for_window("", &origin, name, icon, accounts).await
    }

    /// Get session (legacy - uses empty window label)
    ///
    /// **DEPRECATED**: Use `get_session_by_window` instead
    pub async fn get_session(&self, origin: &str) -> Option<DappConnection> {
        self.get_session_by_window("", origin).await
    }

    /// Validate session (legacy - uses empty window label)
    ///
    /// **DEPRECATED**: Use `validate_session_for_window` instead
    pub async fn validate_session(&self, origin: &str) -> Result<(), WalletError> {
        self.validate_session_for_window("", origin).await
    }

    /// Update activity (legacy - uses empty window label)
    ///
    /// **DEPRECATED**: Use `update_activity_for_window` instead
    pub async fn update_activity(&self, origin: &str) -> Result<(), WalletError> {
        self.update_activity_for_window("", origin).await
    }

    /// Remove session (legacy - uses empty window label)
    ///
    /// **DEPRECATED**: Use `remove_session_by_window` instead
    pub async fn remove_session(&self, origin: &str) {
        self.remove_session_by_window("", origin).await;
    }

    /// Get all sessions (legacy - returns all connections)
    ///
    /// **DEPRECATED**: Use `all_sessions` for keys or iterate manually
    pub async fn get_all_sessions(&self) -> Vec<DappConnection> {
        let sessions = self.sessions.read().await;
        sessions.values().cloned().collect()
    }

    /// Clear all sessions
    pub async fn clear_all(&self) {
        let mut sessions = self.sessions.write().await;
        sessions.clear();
    }

    /// Clear expired sessions (inactive for > 24 hours)
    pub async fn clear_expired(&self) {
        let mut sessions = self.sessions.write().await;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        sessions.retain(|_, session| {
            // Keep if active within last 24 hours
            now - session.last_activity < 86400
        });
    }
}

impl Default for SessionManager {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_create_and_get_session_for_window() {
        let manager = SessionManager::new();
        let window_label = "dapp-window-1";
        let origin = "https://app.uniswap.org";
        let accounts = vec![Address::ZERO];

        // Create session
        manager
            .create_session_for_window(
                window_label,
                origin,
                Some("Uniswap".to_string()),
                None,
                accounts.clone(),
            )
            .await
            .unwrap();

        // Get session
        let session = manager.get_session_by_window(window_label, origin).await.unwrap();
        assert_eq!(session.window_label, window_label);
        assert_eq!(session.origin, origin);
        assert_eq!(session.name, Some("Uniswap".to_string()));
        assert_eq!(session.accounts, accounts);
    }

    #[tokio::test]
    async fn test_multiple_windows_same_origin() {
        let manager = SessionManager::new();
        let origin = "https://app.uniswap.org";
        let window1 = "dapp-window-1";
        let window2 = "dapp-window-2";

        // Create sessions for two windows to same origin
        manager
            .create_session_for_window(window1, origin, None, None, vec![])
            .await
            .unwrap();
        manager
            .create_session_for_window(window2, origin, None, None, vec![])
            .await
            .unwrap();

        // Both sessions should exist independently
        assert!(manager.get_session_by_window(window1, origin).await.is_some());
        assert!(manager.get_session_by_window(window2, origin).await.is_some());

        // Should have 2 sessions total
        assert_eq!(manager.session_count().await, 2);
    }

    #[tokio::test]
    async fn test_validate_session_for_window() {
        let manager = SessionManager::new();
        let window_label = "dapp-window-1";
        let origin = "https://app.uniswap.org";

        // Should fail (no session)
        assert!(manager.validate_session_for_window(window_label, origin).await.is_err());

        // Create session
        manager
            .create_session_for_window(window_label, origin, None, None, vec![])
            .await
            .unwrap();

        // Should succeed
        assert!(manager.validate_session_for_window(window_label, origin).await.is_ok());

        // Should fail (different origin)
        assert!(manager.validate_session_for_window(window_label, "https://evil.com").await.is_err());

        // Should fail (different window)
        assert!(manager.validate_session_for_window("dapp-window-2", origin).await.is_err());
    }

    #[tokio::test]
    async fn test_update_activity_for_window() {
        let manager = SessionManager::new();
        let window_label = "dapp-window-1";
        let origin = "https://app.uniswap.org";

        // Create session
        manager
            .create_session_for_window(window_label, origin, None, None, vec![])
            .await
            .unwrap();

        let session1 = manager.get_session_by_window(window_label, origin).await.unwrap();
        let activity1 = session1.last_activity;

        // Wait a bit
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        
        // Update activity
        manager.update_activity_for_window(window_label, origin).await.unwrap();

        let session2 = manager.get_session_by_window(window_label, origin).await.unwrap();
        let activity2 = session2.last_activity;

        // Activity should be updated
        assert!(activity2 > activity1);
    }

    #[tokio::test]
    async fn test_remove_session_by_window() {
        let manager = SessionManager::new();
        let window_label = "dapp-window-1";
        let origin = "https://app.uniswap.org";

        // Create session
        manager
            .create_session_for_window(window_label, origin, None, None, vec![])
            .await
            .unwrap();

        // Should exist
        assert!(manager.get_session_by_window(window_label, origin).await.is_some());

        // Remove
        manager.remove_session_by_window(window_label, origin).await;

        // Should not exist
        assert!(manager.get_session_by_window(window_label, origin).await.is_none());
    }

    #[tokio::test]
    async fn test_remove_all_sessions_for_window() {
        let manager = SessionManager::new();
        let window_label = "dapp-window-1";

        // Create multiple sessions for same window
        manager
            .create_session_for_window(window_label, "https://app.uniswap.org", None, None, vec![])
            .await
            .unwrap();
        manager
            .create_session_for_window(window_label, "https://app.aave.com", None, None, vec![])
            .await
            .unwrap();

        // Create session for different window
        manager
            .create_session_for_window("dapp-window-2", "https://app.1inch.io", None, None, vec![])
            .await
            .unwrap();

        // Should have 3 sessions
        assert_eq!(manager.session_count().await, 3);

        // Remove all sessions for window 1
        manager.remove_all_sessions_for_window(window_label).await;

        // Should have 1 session left (window 2)
        assert_eq!(manager.session_count().await, 1);

        // Window 1 sessions should be gone
        assert!(manager.get_session_by_window(window_label, "https://app.uniswap.org").await.is_none());
        assert!(manager.get_session_by_window(window_label, "https://app.aave.com").await.is_none());

        // Window 2 session should still exist
        assert!(manager.get_session_by_window("dapp-window-2", "https://app.1inch.io").await.is_some());
    }

    #[tokio::test]
    async fn test_all_sessions() {
        let manager = SessionManager::new();

        // Create multiple sessions
        manager
            .create_session_for_window("window-1", "https://app.uniswap.org", None, None, vec![])
            .await
            .unwrap();
        manager
            .create_session_for_window("window-2", "https://app.aave.com", None, None, vec![])
            .await
            .unwrap();

        // Get all session keys
        let sessions = manager.all_sessions().await;
        assert_eq!(sessions.len(), 2);
        assert!(sessions.contains(&("window-1".to_string(), "https://app.uniswap.org".to_string())));
        assert!(sessions.contains(&("window-2".to_string(), "https://app.aave.com".to_string())));
    }

    #[tokio::test]
    async fn test_all_window_labels() {
        let manager = SessionManager::new();

        // Create sessions for multiple windows
        manager
            .create_session_for_window("window-1", "https://app.uniswap.org", None, None, vec![])
            .await
            .unwrap();
        manager
            .create_session_for_window("window-1", "https://app.aave.com", None, None, vec![])
            .await
            .unwrap();
        manager
            .create_session_for_window("window-2", "https://app.1inch.io", None, None, vec![])
            .await
            .unwrap();

        // Get all window labels
        let labels = manager.all_window_labels().await;
        assert_eq!(labels.len(), 2);
        assert!(labels.contains(&"window-1".to_string()));
        assert!(labels.contains(&"window-2".to_string()));
    }
}
