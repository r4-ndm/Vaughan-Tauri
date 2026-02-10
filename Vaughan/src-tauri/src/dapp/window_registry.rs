///! Window Registry
///!
///! Tracks dApp windows and their current origins for security validation
///!
///! **PHASE 3.4**: Critical for preventing origin spoofing and tracking
///! window navigation events.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::SystemTime;
use tokio::sync::RwLock;

/// Window information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowInfo {
    /// Window label (unique identifier)
    pub window_label: String,
    
    /// Current origin being displayed
    pub current_origin: String,
    
    /// When the window was created
    pub created_at: SystemTime,
    
    /// Last navigation timestamp
    pub last_navigation: SystemTime,
}

/// Window registry for tracking dApp windows
///
/// This registry maintains a mapping of window labels to their current origins.
/// It's used for:
/// - Origin validation (ensure requests come from correct origin)
/// - Navigation tracking (detect when window navigates to new origin)
/// - Cleanup (remove windows when closed)
///
/// # Thread Safety
///
/// Uses `RwLock` for concurrent access (many readers, few writers)
pub struct WindowRegistry {
    /// Active windows (window_label -> WindowInfo)
    windows: Arc<RwLock<HashMap<String, WindowInfo>>>,
}

impl WindowRegistry {
    /// Create new window registry
    pub fn new() -> Self {
        Self {
            windows: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Register a new window
    ///
    /// # Arguments
    ///
    /// * `window_label` - Unique window identifier
    /// * `origin` - Initial origin (URL origin)
    ///
    /// # Returns
    ///
    /// * `Ok(())` - Window registered
    /// * `Err(String)` - Window already exists
    pub async fn register_window(&self, window_label: &str, origin: &str) -> Result<(), String> {
        let mut windows = self.windows.write().await;

        if windows.contains_key(window_label) {
            return Err(format!("Window already registered: {}", window_label));
        }

        let now = SystemTime::now();
        let info = WindowInfo {
            window_label: window_label.to_string(),
            current_origin: origin.to_string(),
            created_at: now,
            last_navigation: now,
        };

        windows.insert(window_label.to_string(), info);
        eprintln!("[WindowRegistry] Registered window: {} -> {}", window_label, origin);
        Ok(())
    }

    /// Update window origin (on navigation)
    ///
    /// # Arguments
    ///
    /// * `window_label` - Window identifier
    /// * `new_origin` - New origin after navigation
    ///
    /// # Returns
    ///
    /// * `Ok(())` - Origin updated
    /// * `Err(String)` - Window not found
    pub async fn update_origin(&self, window_label: &str, new_origin: &str) -> Result<(), String> {
        let mut windows = self.windows.write().await;

        match windows.get_mut(window_label) {
            Some(info) => {
                eprintln!(
                    "[WindowRegistry] Updating origin: {} -> {} (was: {})",
                    window_label, new_origin, info.current_origin
                );
                info.current_origin = new_origin.to_string();
                info.last_navigation = SystemTime::now();
                Ok(())
            }
            None => Err(format!("Window not found: {}", window_label)),
        }
    }

    /// Get current origin for a window
    ///
    /// # Arguments
    ///
    /// * `window_label` - Window identifier
    ///
    /// # Returns
    ///
    /// * `Some(String)` - Current origin
    /// * `None` - Window not found
    pub async fn get_origin(&self, window_label: &str) -> Option<String> {
        let windows = self.windows.read().await;
        windows.get(window_label).map(|info| info.current_origin.clone())
    }

    /// Get window info
    ///
    /// # Arguments
    ///
    /// * `window_label` - Window identifier
    ///
    /// # Returns
    ///
    /// * `Some(WindowInfo)` - Window information
    /// * `None` - Window not found
    pub async fn get_window(&self, window_label: &str) -> Option<WindowInfo> {
        let windows = self.windows.read().await;
        windows.get(window_label).cloned()
    }

    /// Remove window from registry
    ///
    /// Called when window is closed
    ///
    /// # Arguments
    ///
    /// * `window_label` - Window identifier
    pub async fn remove_window(&self, window_label: &str) {
        let mut windows = self.windows.write().await;
        if windows.remove(window_label).is_some() {
            eprintln!("[WindowRegistry] Removed window: {}", window_label);
        }
    }

    /// Get all registered windows
    ///
    /// # Returns
    ///
    /// * `Vec<WindowInfo>` - All window information
    pub async fn get_all_windows(&self) -> Vec<WindowInfo> {
        let windows = self.windows.read().await;
        windows.values().cloned().collect()
    }

    /// Get all window labels
    ///
    /// # Returns
    ///
    /// * `Vec<String>` - All window labels
    pub async fn get_all_labels(&self) -> Vec<String> {
        let windows = self.windows.read().await;
        windows.keys().cloned().collect()
    }

    /// Get window count
    ///
    /// # Returns
    ///
    /// * `usize` - Number of registered windows
    pub async fn window_count(&self) -> usize {
        let windows = self.windows.read().await;
        windows.len()
    }

    /// Check if window exists
    ///
    /// # Arguments
    ///
    /// * `window_label` - Window identifier
    ///
    /// # Returns
    ///
    /// * `true` - Window exists
    /// * `false` - Window not found
    pub async fn window_exists(&self, window_label: &str) -> bool {
        let windows = self.windows.read().await;
        windows.contains_key(window_label)
    }

    /// Clear all windows
    ///
    /// Useful for testing or cleanup
    pub async fn clear_all(&self) {
        let mut windows = self.windows.write().await;
        windows.clear();
        eprintln!("[WindowRegistry] Cleared all windows");
    }
}

impl Default for WindowRegistry {
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
    async fn test_register_and_get_window() {
        let registry = WindowRegistry::new();
        let window_label = "dapp-window-1";
        let origin = "https://app.uniswap.org";

        // Register window
        registry.register_window(window_label, origin).await.unwrap();

        // Get origin
        let retrieved_origin = registry.get_origin(window_label).await.unwrap();
        assert_eq!(retrieved_origin, origin);

        // Get window info
        let info = registry.get_window(window_label).await.unwrap();
        assert_eq!(info.window_label, window_label);
        assert_eq!(info.current_origin, origin);
    }

    #[tokio::test]
    async fn test_register_duplicate_window() {
        let registry = WindowRegistry::new();
        let window_label = "dapp-window-1";
        let origin = "https://app.uniswap.org";

        // Register window
        registry.register_window(window_label, origin).await.unwrap();

        // Try to register again (should fail)
        let result = registry.register_window(window_label, origin).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_update_origin() {
        let registry = WindowRegistry::new();
        let window_label = "dapp-window-1";
        let origin1 = "https://app.uniswap.org";
        let origin2 = "https://app.aave.com";

        // Register window
        registry.register_window(window_label, origin1).await.unwrap();

        // Update origin
        registry.update_origin(window_label, origin2).await.unwrap();

        // Verify new origin
        let retrieved_origin = registry.get_origin(window_label).await.unwrap();
        assert_eq!(retrieved_origin, origin2);
    }

    #[tokio::test]
    async fn test_update_nonexistent_window() {
        let registry = WindowRegistry::new();
        let window_label = "dapp-window-1";
        let origin = "https://app.uniswap.org";

        // Try to update non-existent window (should fail)
        let result = registry.update_origin(window_label, origin).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_remove_window() {
        let registry = WindowRegistry::new();
        let window_label = "dapp-window-1";
        let origin = "https://app.uniswap.org";

        // Register window
        registry.register_window(window_label, origin).await.unwrap();

        // Verify exists
        assert!(registry.window_exists(window_label).await);

        // Remove window
        registry.remove_window(window_label).await;

        // Verify removed
        assert!(!registry.window_exists(window_label).await);
        assert!(registry.get_origin(window_label).await.is_none());
    }

    #[tokio::test]
    async fn test_get_all_windows() {
        let registry = WindowRegistry::new();

        // Register multiple windows
        registry.register_window("window-1", "https://app.uniswap.org").await.unwrap();
        registry.register_window("window-2", "https://app.aave.com").await.unwrap();
        registry.register_window("window-3", "https://app.1inch.io").await.unwrap();

        // Get all windows
        let windows = registry.get_all_windows().await;
        assert_eq!(windows.len(), 3);

        // Verify all labels present
        let labels = registry.get_all_labels().await;
        assert!(labels.contains(&"window-1".to_string()));
        assert!(labels.contains(&"window-2".to_string()));
        assert!(labels.contains(&"window-3".to_string()));
    }

    #[tokio::test]
    async fn test_window_count() {
        let registry = WindowRegistry::new();

        // Initially empty
        assert_eq!(registry.window_count().await, 0);

        // Register windows
        registry.register_window("window-1", "https://app.uniswap.org").await.unwrap();
        assert_eq!(registry.window_count().await, 1);

        registry.register_window("window-2", "https://app.aave.com").await.unwrap();
        assert_eq!(registry.window_count().await, 2);

        // Remove window
        registry.remove_window("window-1").await;
        assert_eq!(registry.window_count().await, 1);
    }

    #[tokio::test]
    async fn test_clear_all() {
        let registry = WindowRegistry::new();

        // Register multiple windows
        registry.register_window("window-1", "https://app.uniswap.org").await.unwrap();
        registry.register_window("window-2", "https://app.aave.com").await.unwrap();

        // Verify count
        assert_eq!(registry.window_count().await, 2);

        // Clear all
        registry.clear_all().await;

        // Verify empty
        assert_eq!(registry.window_count().await, 0);
    }

    #[tokio::test]
    async fn test_window_exists() {
        let registry = WindowRegistry::new();
        let window_label = "dapp-window-1";
        let origin = "https://app.uniswap.org";

        // Should not exist initially
        assert!(!registry.window_exists(window_label).await);

        // Register window
        registry.register_window(window_label, origin).await.unwrap();

        // Should exist now
        assert!(registry.window_exists(window_label).await);

        // Remove window
        registry.remove_window(window_label).await;

        // Should not exist anymore
        assert!(!registry.window_exists(window_label).await);
    }
}
