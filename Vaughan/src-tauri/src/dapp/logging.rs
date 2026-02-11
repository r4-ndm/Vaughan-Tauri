//! Structured logging for WebSocket and dApp operations
//!
//! This module provides structured logging using the `tracing` crate.
//! All logs include structured fields for easy filtering and analysis.
//!
//! # Log Targets
//!
//! - `websocket`: WebSocket connection lifecycle
//! - `rpc`: RPC request processing
//! - `rate_limit`: Rate limiting events
//! - `approval`: User approval flow
//! - `session`: Session management
//!
//! # Usage
//!
//! ```rust
//! use crate::dapp::logging::*;
//!
//! // Log WebSocket connection
//! log_websocket_connection("127.0.0.1:12345", "dapp-window-1");
//!
//! // Log RPC request
//! log_rpc_request("eth_call", "https://app.uniswap.org", 45);
//!
//! // Log rate limit exceeded
//! log_rate_limit_exceeded("https://app.uniswap.org", "eth_sendTransaction");
//! ```

use tracing::{debug, error, info, warn};

/// Initialize tracing subscriber
///
/// Sets up structured logging with:
/// - Environment-based filtering (RUST_LOG)
/// - Timestamps
/// - Target filtering
/// - Pretty formatting
pub fn init_logging() {
    use tracing_subscriber::{fmt, EnvFilter};

    // Default to INFO level, can be overridden with RUST_LOG env var
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,vaughan_lib=debug"));

    fmt()
        .with_env_filter(filter)
        .with_target(true)
        .with_thread_ids(false)
        .with_file(false)
        .with_line_number(false)
        .init();

    info!(target: "vaughan", "Logging initialized");
}

// ============================================================================
// WebSocket Logging
// ============================================================================

/// Log new WebSocket connection
pub fn log_websocket_connection(addr: &str, window_label: &str) {
    info!(
        target: "websocket",
        addr = %addr,
        window_label = %window_label,
        "New WebSocket connection established"
    );
}

/// Log WebSocket disconnection
pub fn log_websocket_disconnection(addr: &str, window_label: &str, reason: &str) {
    info!(
        target: "websocket",
        addr = %addr,
        window_label = %window_label,
        reason = %reason,
        "WebSocket connection closed"
    );
}

/// Log WebSocket error
pub fn log_websocket_error(addr: &str, error: &str) {
    error!(
        target: "websocket",
        addr = %addr,
        error = %error,
        "WebSocket error occurred"
    );
}

/// Log WebSocket server startup
pub fn log_websocket_startup(port: u16) {
    info!(
        target: "websocket",
        port = %port,
        "WebSocket server started"
    );
}

// ============================================================================
// RPC Logging
// ============================================================================

/// Log RPC request processing
pub fn log_rpc_request(method: &str, origin: &str, duration_ms: u64) {
    debug!(
        target: "rpc",
        method = %method,
        origin = %origin,
        duration_ms = %duration_ms,
        "RPC request processed"
    );
}

/// Log RPC request start
pub fn log_rpc_request_start(method: &str, origin: &str, request_id: u64) {
    debug!(
        target: "rpc",
        method = %method,
        origin = %origin,
        request_id = %request_id,
        "RPC request received"
    );
}

/// Log RPC request success
pub fn log_rpc_request_success(method: &str, origin: &str, request_id: u64, duration_ms: u64) {
    info!(
        target: "rpc",
        method = %method,
        origin = %origin,
        request_id = %request_id,
        duration_ms = %duration_ms,
        "RPC request succeeded"
    );
}

/// Log RPC request error
pub fn log_rpc_request_error(method: &str, origin: &str, request_id: u64, error: &str) {
    error!(
        target: "rpc",
        method = %method,
        origin = %origin,
        request_id = %request_id,
        error = %error,
        "RPC request failed"
    );
}

// ============================================================================
// Rate Limiting Logging
// ============================================================================

/// Log rate limit exceeded
pub fn log_rate_limit_exceeded(origin: &str, method: &str, tier: &str) {
    warn!(
        target: "rate_limit",
        origin = %origin,
        method = %method,
        tier = %tier,
        "Rate limit exceeded"
    );
}

/// Log rate limit check passed
pub fn log_rate_limit_passed(origin: &str, method: &str) {
    debug!(
        target: "rate_limit",
        origin = %origin,
        method = %method,
        "Rate limit check passed"
    );
}

// ============================================================================
// Approval Logging
// ============================================================================

/// Log approval request created
pub fn log_approval_request_created(
    approval_id: &str,
    approval_type: &str,
    origin: &str,
    window_label: &str,
) {
    info!(
        target: "approval",
        approval_id = %approval_id,
        approval_type = %approval_type,
        origin = %origin,
        window_label = %window_label,
        "Approval request created"
    );
}

/// Log approval granted
pub fn log_approval_granted(approval_id: &str, approval_type: &str) {
    info!(
        target: "approval",
        approval_id = %approval_id,
        approval_type = %approval_type,
        "Approval granted by user"
    );
}

/// Log approval rejected
pub fn log_approval_rejected(approval_id: &str, approval_type: &str) {
    info!(
        target: "approval",
        approval_id = %approval_id,
        approval_type = %approval_type,
        "Approval rejected by user"
    );
}

/// Log approval timeout
pub fn log_approval_timeout(approval_id: &str, approval_type: &str) {
    warn!(
        target: "approval",
        approval_id = %approval_id,
        approval_type = %approval_type,
        "Approval request timed out"
    );
}

// ============================================================================
// Session Logging
// ============================================================================

/// Log session created
pub fn log_session_created(origin: &str, window_label: &str, chain_id: u64) {
    info!(
        target: "session",
        origin = %origin,
        window_label = %window_label,
        chain_id = %chain_id,
        "Session created"
    );
}

/// Log session updated
pub fn log_session_updated(origin: &str, window_label: &str, field: &str) {
    debug!(
        target: "session",
        origin = %origin,
        window_label = %window_label,
        field = %field,
        "Session updated"
    );
}

/// Log session removed
pub fn log_session_removed(origin: &str, window_label: &str) {
    info!(
        target: "session",
        origin = %origin,
        window_label = %window_label,
        "Session removed"
    );
}

// ============================================================================
// Health Monitoring Logging
// ============================================================================

/// Log health metrics snapshot
pub fn log_health_metrics(
    total_connections: u64,
    active_connections: u64,
    messages_processed: u64,
    errors: u64,
    uptime_seconds: u64,
) {
    info!(
        target: "health",
        total_connections = %total_connections,
        active_connections = %active_connections,
        messages_processed = %messages_processed,
        errors = %errors,
        uptime_seconds = %uptime_seconds,
        "Health metrics snapshot"
    );
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_logging_functions_compile() {
        // Just verify all functions compile and can be called
        // Actual output testing would require capturing logs
        
        log_websocket_connection("127.0.0.1:8766", "test-window");
        log_websocket_disconnection("127.0.0.1:8766", "test-window", "normal");
        log_websocket_error("127.0.0.1:8766", "test error");
        log_websocket_startup(8766);
        
        log_rpc_request("eth_call", "https://test.com", 100);
        log_rpc_request_start("eth_call", "https://test.com", 1);
        log_rpc_request_success("eth_call", "https://test.com", 1, 100);
        log_rpc_request_error("eth_call", "https://test.com", 1, "test error");
        
        log_rate_limit_exceeded("https://test.com", "eth_call", "per-second");
        log_rate_limit_passed("https://test.com", "eth_call");
        
        log_approval_request_created("test-id", "connection", "https://test.com", "test-window");
        log_approval_granted("test-id", "connection");
        log_approval_rejected("test-id", "connection");
        log_approval_timeout("test-id", "connection");
        
        log_session_created("https://test.com", "test-window", 369);
        log_session_updated("https://test.com", "test-window", "accounts");
        log_session_removed("https://test.com", "test-window");
        
        log_health_metrics(10, 5, 100, 2, 3600);
    }
}
