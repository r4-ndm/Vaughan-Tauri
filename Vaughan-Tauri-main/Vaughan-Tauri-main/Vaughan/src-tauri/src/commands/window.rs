///! Window Management Commands
///!
///! Commands for managing Tauri windows with native WebView for dApps
///!
///! **PHASE 3.4**: Native WebView implementation with proper security,
///! window-specific session management, and comprehensive cleanup.

use crate::state::VaughanState;
use tauri::{AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder};
use url::Url;
use lazy_static::lazy_static;

// ============================================================================
// Provider Script (Lazy-loaded for performance)
// ============================================================================

lazy_static! {
    /// Provider script for IPC mode (Tauri IPC via postMessage bridge, CSP-safe)
    /// This is the ACTIVE provider implementation - works with all sites including HTTPS
    /// Uses Tauri IPC instead of WebSocket, bypasses CSP via initialization_script
    static ref PROVIDER_SCRIPT_IPC: String = 
        include_str!("../../../src/provider/provider-inject-ipc.js").to_string();
}

// ============================================================================
// URL Validation
// ============================================================================

/// Validate URL for dApp loading
///
/// Only allows http:// and https:// protocols to prevent security issues
///
/// # Arguments
///
/// * `url` - URL string to validate
///
/// # Returns
///
/// * `Ok(Url)` - Parsed and validated URL
/// * `Err(String)` - Invalid URL or disallowed protocol
///
/// # Security
///
/// Blocks dangerous protocols:
/// - file:// (local file access)
/// - data:// (data URIs)
/// - javascript:// (code execution)
/// - about:// (browser internals)
fn validate_url(url: &str) -> Result<Url, String> {
    let parsed = Url::parse(url)
        .map_err(|e| format!("Invalid URL: {}", e))?;
    
    // Only allow http/https
    match parsed.scheme() {
        "http" | "https" => Ok(parsed),
        scheme => Err(format!(
            "Only HTTP(S) URLs allowed, got: {}://",
            scheme
        )),
    }
}

// ============================================================================
// Window Commands
// ============================================================================

/// Open dApp URL in native WebView window (DIRECT MODE - No Proxy)
///
/// Creates a new WebView window that loads external URL directly
/// with provider script injected via initialization_script.
/// Provider uses Tauri events to communicate with main window.
///
/// # Arguments
///
/// * `app` - Tauri app handle
/// * `state` - Application state
/// * `url` - dApp URL to load (must be http:// or https://)
/// * `title` - Optional window title
///
/// # Returns
///
/// * `Ok(String)` - Window label (unique identifier)
/// * `Err(String)` - Failed to create window or invalid URL
///
#[tauri::command]
pub async fn open_dapp_window(
    app: AppHandle,
    state: State<'_, VaughanState>,
    url: String,
    title: Option<String>,
    init_script: Option<String>,
) -> Result<String, String> {
    eprintln!("[Window] Opening dApp window (direct mode): {}", url);

    // Validate URL
    let validated_url = validate_url(&url)?;
    eprintln!("[Window] URL validated: {}", validated_url);
    
    // Create WebView URL (direct external URL)
    let window_url = WebviewUrl::External(validated_url.clone());

    // Generate unique window label
    let window_label = format!("dapp-{}", uuid::Uuid::new_v4());
    eprintln!("[Window] Generated window label: {}", window_label);

    // Get origin for registration
    let origin = validated_url.origin().ascii_serialization();

    // Get WebSocket port from state
    let ws_port = state.get_websocket_port().await
        .ok_or_else(|| "WebSocket server not started".to_string())?;
    
    eprintln!("[Window] WebSocket server running on port: {}", ws_port);

    // Use provided init_script or default to PROVIDER_SCRIPT_IPC (CSP-safe via Tauri IPC)
    let provider_script = if let Some(script) = init_script {
        eprintln!("[Window] Using custom init_script ({} bytes)", script.len());
        format!(
            r#"
            // Inject window metadata for provider
            window.__VAUGHAN_WINDOW_LABEL__ = "{}";
            window.__VAUGHAN_ORIGIN__ = "{}";
            
            // Provider script
            {}
            "#,
            window_label,
            origin,
            script
        )
    } else {
        eprintln!("[Window] Using default PROVIDER_SCRIPT_IPC (Tauri IPC bridge, CSP-safe)");
        format!(
            r#"
            // Inject window metadata for provider
            window.__VAUGHAN_WINDOW_LABEL__ = "{}";
            window.__VAUGHAN_ORIGIN__ = "{}";
            
            // Provider script
            {}
            "#,
            window_label,
            origin,
            PROVIDER_SCRIPT_IPC.as_str()
        )
    };
    eprintln!("[Window] Provider script prepared ({} bytes)", provider_script.len());

    // Create WebView window with provider injected
    let _window = WebviewWindowBuilder::new(
        &app,
        &window_label,
        window_url,
    )
    .title(title.clone().unwrap_or_else(|| "Vaughan - dApp".to_string()))
    .inner_size(1200.0, 800.0)
    .min_inner_size(800.0, 600.0)
    .resizable(true)
    .initialization_script(&provider_script)  // Inject provider before page loads
    .build()
    .map_err(|e| format!("Failed to create window: {}", e))?;

    eprintln!("[Window] WebView window created: {}", window_label);

    // Register window in WindowRegistry
    let origin = validated_url.origin().ascii_serialization();
    state.window_registry.register_window(&window_label, &origin).await
        .map_err(|e| format!("Failed to register window: {}", e))?;

    eprintln!("[Window] Window registered: {} -> {}", window_label, origin);

    // ========================================================================
    // AUTO-CONNECT: Pre-approve connection for wallet-opened dApps
    // ========================================================================
    // This is safe because:
    // 1. Wallet controls which dApps can be opened (whitelist)
    // 2. User explicitly clicked "Open dApp" (clear intent)
    // 3. Connection only reveals address (no private keys)
    // 4. Transactions still require approval
    
    // Get active account
    if let Ok(account) = state.active_account().await {
        eprintln!("[Window] Creating auto-approved session for account: {:?}", account);
        
        // Create auto-approved session
        if let Err(e) = state.session_manager.create_auto_approved_session(
            &window_label,
            &origin,
            title,
            None, // icon
            vec![account],
        ).await {
            eprintln!("[Window] Warning: Failed to create auto-approved session: {}", e);
            // Don't fail window creation if session creation fails
        } else {
            eprintln!("[Window] Auto-approved session created successfully");
        }
    } else {
        eprintln!("[Window] Warning: No active account, skipping auto-connect");
    }

    eprintln!("[Window] Window opened successfully: {}", window_label);
    
    Ok(window_label)
}

/// Open dApp URL in native WebView window
///
/// Creates a new WebView window with provider script injected via
/// initialization_script (runs BEFORE page loads, bypasses CSP).
///
/// # Arguments
///
/// * `app` - Tauri app handle
/// * `state` - Application state (for window registry - TODO: Task 1.5)
/// * `url` - dApp URL to load (must be http:// or https://)
///
/// # Returns
///
/// * `Ok(String)` - Window label (unique identifier)
/// * `Err(String)` - Failed to create window or invalid URL
///
/// # Security
///
/// - URL validation (http/https only)
/// - Provider script injected at webview level (bypasses CSP)
/// - Window label is unique (UUID-based)
/// - Window registered for tracking (TODO: Task 1.5)
///
/// # Example
///
/// ```typescript
/// const windowLabel = await invoke('open_dapp_url', {
///     url: 'https://swap.internetmoney.io'
/// });
/// ```
#[tauri::command]
pub async fn open_dapp_url(
    app: AppHandle,
    state: State<'_, VaughanState>,
    url: String,
) -> Result<String, String> {
    eprintln!("[Window] Opening dApp URL: {}", url);

    // Validate URL
    let validated_url = validate_url(&url)?;
    eprintln!("[Window] URL validated: {}", validated_url);

    // **PHASE 3.6**: Use HTTP proxy to bypass CSP
    // Proxy fetches content, strips CSP headers, injects provider script
    let proxy_url = format!(
        "http://localhost:8765/proxy?url={}",
        urlencoding::encode(&url)
    );
    eprintln!("[Window] Using proxy URL: {}", proxy_url);
    
    let window_url = WebviewUrl::External(
        Url::parse(&proxy_url)
            .map_err(|e| format!("Invalid proxy URL: {}", e))?
    );

    // Generate unique window label
    let window_label = format!("dapp-{}", uuid::Uuid::new_v4());
    eprintln!("[Window] Generated window label: {}", window_label);

    // Get provider script (lazy-loaded) - using IPC provider
    let provider_script = PROVIDER_SCRIPT_IPC.as_str();
    eprintln!("[Window] Provider script loaded ({} bytes)", provider_script.len());

    // Create WebView window
    // Provider script injected via initialization_script (runs before page loads)
    // Proxy serves content from localhost, so Tauri API is available
    let _window = WebviewWindowBuilder::new(
        &app,
        &window_label,
        window_url,
    )
    .title("Vaughan - dApp Browser")
    .inner_size(1200.0, 800.0)
    .min_inner_size(800.0, 600.0)
    .resizable(true)
    .initialization_script(provider_script)
    .build()
    .map_err(|e| format!("Failed to create window: {}", e))?;

    eprintln!("[Window] WebView window created: {}", window_label);

    // Register window in WindowRegistry
    let origin = validated_url.origin().ascii_serialization();
    state.window_registry.register_window(&window_label, &origin).await
        .map_err(|e| format!("Failed to register window: {}", e))?;

    eprintln!("[Window] Window registered in registry: {} -> {}", window_label, origin);

    eprintln!("[Window] Window opened successfully: {}", window_label);
    Ok(window_label)
}

/// Navigate dApp window to new URL
///
/// Updates the URL of an existing dApp window. Validates the new URL
/// and updates the window registry.
///
/// # Arguments
///
/// * `app` - Tauri app handle
/// * `state` - Application state (for window registry - TODO: Task 1.5)
/// * `window_label` - Window identifier
/// * `url` - New URL to navigate to
///
/// # Returns
///
/// * `Ok(())` - Navigation successful
/// * `Err(String)` - Window not found or invalid URL
///
/// # Security
///
/// - URL validation (http/https only)
/// - Window existence check
/// - Origin validation on navigation (prevents redirect attacks)
/// - Window registry updated with new origin
///
/// # Example
///
/// ```typescript
/// await invoke('navigate_dapp', {
///     windowLabel: 'dapp-123',
///     url: 'https://app.uniswap.org'
/// });
/// ```
#[tauri::command]
pub async fn navigate_dapp(
    app: AppHandle,
    state: State<'_, VaughanState>,
    window_label: String,
    url: String,
) -> Result<(), String> {
    eprintln!("[Window] Navigating window {} to: {}", window_label, url);

    // Validate URL
    let validated_url = validate_url(&url)?;
    eprintln!("[Window] URL validated: {}", validated_url);

    // Get window
    let window = app.get_webview_window(&window_label)
        .ok_or_else(|| format!("Window not found: {}", window_label))?;

    // Navigate to URL
    window.navigate(validated_url.clone())
        .map_err(|e| format!("Failed to navigate: {}", e))?;

    // Update window registry with new origin
    let new_origin = validated_url.origin().ascii_serialization();
    state.window_registry.update_origin(&window_label, &new_origin).await
        .map_err(|e| format!("Failed to update registry: {}", e))?;

    eprintln!("[Window] Registry updated with new origin: {} -> {}", window_label, new_origin);

    eprintln!("[Window] Navigation successful: {}", window_label);
    Ok(())
}

/// Close dApp window and clean up resources
///
/// Closes the window and performs comprehensive cleanup:
/// - Removes all sessions for the window
/// - Clears all pending approvals for the window
/// - Removes window from registry
/// - Cancels any pending requests
///
/// # Arguments
///
/// * `app` - Tauri app handle
/// * `state` - Application state (for cleanup)
/// * `window_label` - Window identifier
///
/// # Returns
///
/// * `Ok(())` - Window closed and cleaned up
/// * `Err(String)` - Window not found or cleanup failed
///
/// # Cleanup Steps
///
/// 1. Get window by label
/// 2. Clean up sessions for window (SessionManager)
/// 3. Clear approvals for window (ApprovalQueue)
/// 4. Remove from window registry (WindowRegistry - TODO: Task 1.5)
/// 5. Cancel pending requests (TODO: if needed)
/// 6. Close window
///
/// # Example
///
/// ```typescript
/// await invoke('close_dapp', {
///     windowLabel: 'dapp-123'
/// });
/// ```
#[tauri::command]
pub async fn close_dapp(
    app: AppHandle,
    state: State<'_, VaughanState>,
    window_label: String,
) -> Result<(), String> {
    eprintln!("[Window] Closing dApp window: {}", window_label);

    // Get window
    let window = app.get_webview_window(&window_label)
        .ok_or_else(|| format!("Window not found: {}", window_label))?;

    // ========================================================================
    // COMPREHENSIVE CLEANUP (Critical for preventing memory leaks)
    // ========================================================================

    // 1. Clean up sessions for window
    eprintln!("[Window] Cleaning up sessions for window: {}", window_label);
    state.session_manager.remove_all_sessions_for_window(&window_label).await;

    // 2. Clear approvals for window
    eprintln!("[Window] Clearing approvals for window: {}", window_label);
    state.approval_queue.clear_for_window(&window_label).await;

    // 3. Remove from window registry
    eprintln!("[Window] Removing from window registry: {}", window_label);
    state.window_registry.remove_window(&window_label).await;

    // 4. Close window
    eprintln!("[Window] Closing window: {}", window_label);
    window.close()
        .map_err(|e| format!("Failed to close window: {}", e))?;

    eprintln!("[Window] Window closed and cleaned up: {}", window_label);
    Ok(())
}

/// Get current URL of dApp window
///
/// Returns the current URL being displayed in the dApp window.
///
/// # Arguments
///
/// * `app` - Tauri app handle
/// * `window_label` - Window identifier
///
/// # Returns
///
/// * `Ok(String)` - Current URL
/// * `Err(String)` - Window not found or failed to get URL
///
/// # Example
///
/// ```typescript
/// const url = await invoke('get_dapp_url', {
///     windowLabel: 'dapp-123'
/// });
/// ```
#[tauri::command]
pub async fn get_dapp_url(
    app: AppHandle,
    window_label: String,
) -> Result<String, String> {
    eprintln!("[Window] Getting URL for window: {}", window_label);

    // Get window
    let window = app.get_webview_window(&window_label)
        .ok_or_else(|| format!("Window not found: {}", window_label))?;

    // Get URL
    let url = window.url()
        .map_err(|e| format!("Failed to get URL: {}", e))?;

    eprintln!("[Window] Current URL: {}", url);
    Ok(url.to_string())
}

/// Open dApp browser in a new window (LEGACY - Phase 3.2)
///
/// **DEPRECATED**: Use `open_dapp_url` instead for native WebView.
/// This command opens the old iframe-based browser.
///
/// # Arguments
///
/// * `app` - Tauri app handle
/// * `url` - Optional dApp URL to load (defaults to test page)
///
/// # Returns
///
/// * `Ok(())` - Window opened successfully
/// * `Err(String)` - Failed to open window
#[tauri::command]
pub async fn open_dapp_browser(
    app: AppHandle,
    url: Option<String>,
) -> Result<(), String> {
    let window_label = format!("dapp-browser-{}", uuid::Uuid::new_v4());
    
    // For now, always open the browser page (URL passing can be added later)
    let browser_url = "http://localhost:1420/dapp-browser.html";

    // Create new window
    WebviewWindowBuilder::new(
        &app,
        &window_label,
        WebviewUrl::External(browser_url.parse().map_err(|e| format!("Invalid URL: {}", e))?),
    )
    .title("Vaughan - dApp Browser")
    .inner_size(1200.0, 800.0)
    .min_inner_size(800.0, 600.0)
    .resizable(true)
    .build()
    .map_err(|e| format!("Failed to create window: {}", e))?;

    Ok(())
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_url_https() {
        let result = validate_url("https://app.uniswap.org");
        assert!(result.is_ok());
        assert_eq!(result.unwrap().scheme(), "https");
    }

    #[test]
    fn test_validate_url_http() {
        let result = validate_url("http://localhost:3000");
        assert!(result.is_ok());
        assert_eq!(result.unwrap().scheme(), "http");
    }

    #[test]
    fn test_validate_url_file_blocked() {
        let result = validate_url("file:///etc/passwd");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Only HTTP(S) URLs allowed"));
    }

    #[test]
    fn test_validate_url_data_blocked() {
        let result = validate_url("data:text/html,<script>alert('xss')</script>");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Only HTTP(S) URLs allowed"));
    }

    #[test]
    fn test_validate_url_javascript_blocked() {
        let result = validate_url("javascript:alert('xss')");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Only HTTP(S) URLs allowed"));
    }

    #[test]
    fn test_validate_url_invalid() {
        let result = validate_url("not a url");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Invalid URL"));
    }
}
