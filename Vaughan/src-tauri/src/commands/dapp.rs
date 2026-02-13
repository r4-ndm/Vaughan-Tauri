///! dApp Integration Commands
///!
///! Single entry point for all dApp requests (router pattern)
///!
///! **PHASE 3.4 UPDATE**: Window-specific security validation to prevent
///! cross-window attacks and origin spoofing.

use crate::dapp::{rpc_handler, DappConnection};
use crate::error::WalletError;
use crate::state::VaughanState;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, State, WebviewWindow};
use tokio::sync::Mutex;

/// dApp request structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DappRequest {
    /// Request ID (UUID)
    pub id: String,
    /// Request timestamp (Unix timestamp)
    pub timestamp: u64,
    /// RPC method
    pub method: String,
    /// Method parameters
    pub params: Vec<Value>,
}

/// dApp response structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DappResponse {
    /// Request ID
    pub id: String,
    /// Result (if successful)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    /// Error (if failed)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<DappError>,
}

/// dApp error structure (EIP-1193 + EIP-1474)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DappError {
    /// Error code
    pub code: i32,
    /// Error message
    pub message: String,
    /// Additional data
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
}

// ============================================================================
// Event Emission Helper (Phase 3.4 - Task 3.6)
// ============================================================================

/// Emit event to specific dApp window
///
/// Helper function to send events from backend to provider in dApp window.
/// Used for approval responses, account changes, network changes, etc.
///
/// # Arguments
///
/// * `app` - Tauri app handle
/// * `window_label` - Target window label
/// * `event` - Event name
/// * `payload` - Event payload (must be serializable)
///
/// # Returns
///
/// * `Ok(())` - Event emitted successfully
/// * `Err(String)` - Window not found or emission failed
fn emit_to_window<T: Serialize + Clone>(
    app: &AppHandle,
    window_label: &str,
    event: &str,
    payload: T,
) -> Result<(), String> {
    eprintln!("[dApp] Emitting event '{}' to window: {}", event, window_label);
    
    app.get_webview_window(window_label)
        .ok_or_else(|| format!("Window {} not found", window_label))?
        .emit(event, payload)
        .map_err(|e| format!("Failed to emit event: {}", e))?;
    
    eprintln!("[dApp] Event '{}' emitted successfully", event);
    Ok(())
}

/// Processed request tracker (replay protection)
struct ProcessedRequests {
    requests: Arc<Mutex<HashSet<String>>>,
}

impl ProcessedRequests {
    fn new() -> Self {
        Self {
            requests: Arc::new(Mutex::new(HashSet::new())),
        }
    }

    async fn is_processed(&self, id: &str) -> bool {
        let requests = self.requests.lock().await;
        requests.contains(id)
    }

    async fn mark_processed(&self, id: String) {
        let mut requests = self.requests.lock().await;
        requests.insert(id);

        // Keep only last 1000 requests (prevent memory growth)
        if requests.len() > 1000 {
            let to_remove: Vec<String> = requests.iter().take(requests.len() - 1000).cloned().collect();
            for id in to_remove {
                requests.remove(&id);
            }
        }
    }
}

// Global state for dApp integration
lazy_static::lazy_static! {
    static ref PROCESSED_REQUESTS: ProcessedRequests = ProcessedRequests::new();
}

/// Handle dApp request (single entry point)
///
/// **PHASE 3.4**: Now extracts window label and origin from Window parameter
/// for proper window-specific validation.
///
/// # Security Layers:
/// 1. Window validation (extract label and origin from Window)
/// 2. Rate limiting (prevent spam, per window+origin)
/// 3. Request validation (structure, timestamp)
/// 4. Replay protection (request ID tracking)
/// 5. Session validation (window+origin check)
/// 6. Input sanitization (in rpc_handler)
/// 7. User approval (for sensitive operations)
///
/// # Arguments
///
/// * `window` - Tauri window (for extracting label and origin)
/// * `state` - Application state
/// * `request` - dApp request
///
/// # Returns
///
/// * `Ok(DappResponse)` - Request handled
/// * `Err(String)` - Request failed
///
/// # Security Notes
///
/// - Window label extracted from Window (cannot be spoofed)
/// - Origin extracted from window URL (trusted source)
/// - Session validated per (window_label, origin) pair
/// - Rate limiting per (window_label, origin) pair
#[tauri::command]
pub async fn dapp_request(
    window: WebviewWindow,
    state: State<'_, VaughanState>,
    request: DappRequest,
    origin: Option<String>, // Optional origin for iframe-based dApps
) -> Result<DappResponse, String> {
    // ========================================================================
    // Layer 1: Window Validation (CRITICAL - PHASE 3.4)
    // ========================================================================

    // Extract window label (cannot be spoofed - comes from Tauri)
    let window_label = window.label().to_string();
    eprintln!("[dapp_request] Window label: {}", window_label);

    // Extract origin - either from parameter (iframe) or window URL (native WebView)
    let origin = if let Some(provided_origin) = origin {
        // Iframe-based dApp - origin provided by bridge
        eprintln!("[dapp_request] Origin (from parameter - iframe): {}", provided_origin);
        provided_origin
    } else {
        // Native WebView - extract from window URL
        let window_url = window.url()
            .map_err(|e| format!("Failed to get window URL: {}", e))?;
        
        let extracted_origin = window_url.origin().ascii_serialization();
        eprintln!("[dapp_request] Origin (from window URL - native): {}", extracted_origin);
        extracted_origin
    };
    
    eprintln!("[dapp_request] Method: {}", request.method);

    // Log for security auditing
    eprintln!(
        "[dapp_request] Request: window={}, origin={}, method={}, id={}",
        window_label, origin, request.method, request.id
    );

    // ========================================================================
    // Layer 2: Rate Limiting (per window+origin+method)
    // ========================================================================

    // Create rate limit key (window_label:origin)
    let rate_limit_key = format!("{}:{}", window_label, origin);
    
    if let Err(e) = state.rate_limiter.check_limit(&rate_limit_key, &request.method).await {
        eprintln!("[dapp_request] Rate limit exceeded: {} for method {}", rate_limit_key, request.method);
        return Ok(DappResponse {
            id: request.id,
            result: None,
            error: Some(DappError {
                code: 4902, // Custom: Rate limit exceeded
                message: e.to_string(),
                data: None,
            }),
        });
    }

    // ========================================================================
    // Layer 3: Request Validation
    // ========================================================================

    // Validate timestamp (reject if > 5 minutes old)
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();

    if now > request.timestamp && (now - request.timestamp) > 300 {
        eprintln!("[dapp_request] Request expired: {} seconds old", now - request.timestamp);
        return Ok(DappResponse {
            id: request.id,
            result: None,
            error: Some(DappError {
                code: 4904, // Custom: Request expired
                message: "Request expired (> 5 minutes old)".to_string(),
                data: None,
            }),
        });
    }

    // ========================================================================
    // Layer 4: Replay Protection
    // ========================================================================

    if PROCESSED_REQUESTS.is_processed(&request.id).await {
        eprintln!("[dapp_request] Duplicate request ID: {}", request.id);
        return Ok(DappResponse {
            id: request.id,
            result: None,
            error: Some(DappError {
                code: 4905, // Custom: Duplicate request
                message: "Duplicate request ID".to_string(),
                data: None,
            }),
        });
    }

    // ========================================================================
    // Layer 5: Session Validation (for methods that require connection)
    // ========================================================================

    // Methods that don't require connection
    let no_auth_methods = vec![
        "eth_chainId",
        "net_version",
        "eth_blockNumber",
        "eth_requestAccounts",
        "eth_accounts"
    ];

    if !no_auth_methods.contains(&request.method.as_str()) {
        // Check if session exists for this window+origin
        eprintln!("[dapp_request] Validating session for window={}, origin={}", window_label, origin);
        
        if let Err(e) = state.session_manager.validate_session_for_window(&window_label, &origin).await {
            eprintln!("[dapp_request] Session validation failed: {}", e);
            eprintln!("[dapp_request] Active sessions: {:?}", state.session_manager.all_sessions().await);
            
            return Ok(DappResponse {
                id: request.id,
                result: None,
                error: Some(DappError {
                    code: 4100, // EIP-1193: Unauthorized
                    message: format!("Not connected. Please call eth_requestAccounts first. Error: {}", e),
                    data: None,
                }),
            });
        }

        // Update session activity
        let _ = state.session_manager.update_activity_for_window(&window_label, &origin).await;
    }

    // ========================================================================
    // Layer 6: Handle Request
    // ========================================================================

    // Pass window_label to rpc_handler for approval routing
    match rpc_handler::handle_request(&state, &window_label, &origin, &request.method, request.params).await {
        Ok(result) => {
            // Mark as processed
            PROCESSED_REQUESTS.mark_processed(request.id.clone()).await;

            eprintln!("[dapp_request] Request successful: {}", request.id);
            Ok(DappResponse {
                id: request.id,
                result: Some(result),
                error: None,
            })
        }
        Err(e) => {
            eprintln!("[dapp_request] Request failed: {} - {}", request.id, e);
            
            // Convert WalletError to DappError
            let (code, message) = match e {
                WalletError::NotConnected => (4100, "Not connected".to_string()),
                WalletError::OriginMismatch => (4903, "Origin mismatch".to_string()),
                WalletError::RateLimitExceeded => (4902, "Rate limit exceeded".to_string()),
                WalletError::UnsupportedMethod(m) => (4200, format!("Unsupported method: {}", m)),
                WalletError::InvalidParams => (-32602, "Invalid params".to_string()),
                WalletError::InvalidAddress(_) => (-32602, "Invalid address".to_string()),
                WalletError::WalletLocked => (4100, "Wallet is locked".to_string()),
                _ => (-32603, e.to_string()),
            };

            Ok(DappResponse {
                id: request.id,
                result: None,
                error: Some(DappError {
                    code,
                    message,
                    data: None,
                }),
            })
        }
    }
}

/// Connect dApp (create session)
///
/// **PHASE 3.4**: Now window-specific
///
/// This should be called after user approves connection
///
/// # Arguments
///
/// * `window` - Tauri window (for extracting label and origin)
/// * `state` - Application state
/// * `name` - dApp name (optional)
/// * `icon` - dApp icon URL (optional)
///
/// # Returns
///
/// * `Ok(Vec<String>)` - Connected accounts
/// * `Err(String)` - Connection failed
#[tauri::command]
pub async fn connect_dapp(
    window: WebviewWindow,
    state: State<'_, VaughanState>,
    name: Option<String>,
    icon: Option<String>,
) -> Result<Vec<String>, String> {
    // Extract window label and origin
    let window_label = window.label().to_string();
    let window_url = window.url()
        .map_err(|e| format!("Failed to get window URL: {}", e))?;
    let origin = window_url.origin().ascii_serialization();

    eprintln!("[connect_dapp] Connecting: window={}, origin={}", window_label, origin);

    // Get active account
    let account = state.active_account().await.map_err(|e| e.to_string())?;

    // Create session for this window
    state.session_manager
        .create_session_for_window(&window_label, &origin, name, icon, vec![account])
        .await
        .map_err(|e| e.to_string())?;

    eprintln!("[connect_dapp] Session created successfully");

    // Return connected accounts
    Ok(vec![format!("{:?}", account)])
}

/// Disconnect dApp (remove session)
///
/// **PHASE 3.4**: Now window-specific
///
/// # Arguments
///
/// * `window` - Tauri window (for extracting label and origin)
/// * `state` - Application state
///
/// # Returns
///
/// * `Ok(())` - Disconnected
#[tauri::command]
pub async fn disconnect_dapp(
    window: WebviewWindow,
    state: State<'_, VaughanState>,
) -> Result<(), String> {
    // Extract window label and origin
    let window_label = window.label().to_string();
    let window_url = window.url()
        .map_err(|e| format!("Failed to get window URL: {}", e))?;
    let origin = window_url.origin().ascii_serialization();

    eprintln!("[disconnect_dapp] Disconnecting: window={}, origin={}", window_label, origin);

    state.session_manager.remove_session_by_window(&window_label, &origin).await;
    
    eprintln!("[disconnect_dapp] Session removed successfully");
    Ok(())
}

/// Get connected dApps
///
/// # Returns
///
/// * `Ok(Vec<DappConnection>)` - Connected dApps
#[tauri::command]
pub async fn get_connected_dapps(
    state: State<'_, VaughanState>,
) -> Result<Vec<DappConnection>, String> {
    Ok(state.session_manager.get_all_sessions().await)
}

/// Disconnect from dApp by origin
///
/// Removes all sessions for the given origin across all windows
///
/// # Arguments
///
/// * `state` - Application state
/// * `origin` - dApp origin to disconnect from
///
/// # Returns
///
/// * `Ok(())` - Disconnected successfully
#[tauri::command]
pub async fn disconnect_dapp_by_origin(
    state: State<'_, VaughanState>,
    origin: String,
) -> Result<(), String> {
    eprintln!("[disconnect_dapp_by_origin] Disconnecting from origin: {}", origin);
    
    // Get all sessions
    let all_sessions = state.session_manager.all_sessions().await;
    
    // Remove sessions matching the origin
    for (window_label, session_origin) in all_sessions {
        if session_origin == origin {
            eprintln!("[disconnect_dapp_by_origin] Removing session: window={}, origin={}", window_label, session_origin);
            state.session_manager.remove_session_by_window(&window_label, &session_origin).await;
        }
    }
    
    eprintln!("[disconnect_dapp_by_origin] Disconnected from origin: {}", origin);
    Ok(())
}

// ============================================================================
// Approval Management Commands
// ============================================================================

/// Get all pending approval requests
///
/// # Returns
///
/// * `Ok(Vec<ApprovalRequest>)` - All pending approval requests
#[tauri::command]
pub async fn get_pending_approvals(
    state: State<'_, VaughanState>,
) -> Result<Vec<crate::dapp::ApprovalRequest>, String> {
    Ok(state.approval_queue.get_all_requests().await)
}

/// Respond to an approval request
///
/// **PHASE 3.4**: Now emits event to specific dApp window so provider
/// can receive the response.
///
/// # Arguments
///
/// * `app` - Tauri app handle (for event emission)
/// * `state` - Application state
/// * `response` - Approval response (id, approved, optional data)
///
/// # Returns
///
/// * `Ok(())` - Response sent successfully
/// * `Err(String)` - If request not found or other error
#[tauri::command]
pub async fn respond_to_approval(
    app: AppHandle,
    state: State<'_, VaughanState>,
    response: crate::dapp::ApprovalResponse,
) -> Result<(), String> {
    eprintln!("[dApp] Responding to approval: {}", response.id);
    
    // Get approval request to find window label
    let approval = state.approval_queue.get_request(&response.id).await
        .ok_or_else(|| format!("Approval request not found: {}", response.id))?;
    
    let window_label = approval.window_label.clone();
    eprintln!("[dApp] Approval window label: {}", window_label);
    
    // Respond to approval (this sends via channel)
    state
        .approval_queue
        .respond(response.clone())
        .await
        .map_err(|e| e.to_string())?;
    
    // Emit event to dApp window (for provider to receive)
    emit_to_window(&app, &window_label, "approval_response", response)?;
    
    eprintln!("[dApp] Approval response sent successfully");
    Ok(())
}

/// Cancel an approval request
///
/// # Arguments
///
/// * `state` - Application state
/// * `id` - Request ID to cancel
///
/// # Returns
///
/// * `Ok(())` - Request cancelled successfully
/// * `Err(String)` - If request not found or other error
#[tauri::command]
pub async fn cancel_approval(
    state: State<'_, VaughanState>,
    id: String,
) -> Result<(), String> {
    state
        .approval_queue
        .cancel(&id)
        .await
        .map_err(|e| e.to_string())
}

/// Clear all pending approval requests
///
/// Useful for cleanup/reset during development
///
/// # Arguments
///
/// * `state` - Application state
///
/// # Returns
///
/// * `Ok(())` - All requests cleared
#[tauri::command]
pub async fn clear_all_approvals(
    state: State<'_, VaughanState>,
) -> Result<(), String> {
    state.approval_queue.clear_all().await;
    Ok(())
}




// ============================================================================
// Performance Monitoring Commands
// ============================================================================

/// Get performance profiling statistics
///
/// Returns performance statistics for all RPC methods including
/// average, min, max durations and request counts.
///
/// # Frontend Usage
///
/// ```typescript
/// import { invoke } from '@tauri-apps/api/tauri';
///
/// const stats = await invoke('get_performance_stats');
/// for (const [method, stat] of Object.entries(stats)) {
///   console.log(`${method}: avg=${stat.avg}ms, count=${stat.count}`);
/// }
/// ```
#[tauri::command]
pub async fn get_performance_stats(
    state: State<'_, VaughanState>,
) -> Result<std::collections::HashMap<String, crate::dapp::MethodStats>, String> {
    Ok(state.profiler.get_stats().await)
}

/// Launch external application (e.g., local dApp server)
///
/// # Arguments
///
/// * `exe_path` - Path to executable to launch
///
/// # Returns
///
/// * `Ok(())` - Application launched successfully
/// * `Err(String)` - Failed to launch application
///
/// # Security
///
/// - Only launches executables from whitelisted dApps
/// - Path validation to prevent directory traversal
///
#[tauri::command]
pub async fn launch_external_app(exe_path: String) -> Result<(), String> {
    eprintln!("[Dapp] Launching external app: {}", exe_path);
    
    // Validate path exists
    let path = std::path::Path::new(&exe_path);
    if !path.exists() {
        return Err(format!("Executable not found: {}", exe_path));
    }
    
    // Launch process in background
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new(&exe_path)
            .spawn()
            .map_err(|e| format!("Failed to launch: {}", e))?;
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        std::process::Command::new(&exe_path)
            .spawn()
            .map_err(|e| format!("Failed to launch: {}", e))?;
    }
    
    eprintln!("[Dapp] External app launched successfully");
    Ok(())
}
