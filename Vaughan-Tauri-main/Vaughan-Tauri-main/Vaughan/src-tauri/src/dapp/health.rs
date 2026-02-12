///! Health Monitoring for WebSocket Server
///!
///! Tracks connection metrics, message counts, errors, and uptime
///! for the WebSocket server to aid in debugging and monitoring.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Instant;
use serde::Serialize;

/// Health metrics for WebSocket server
///
/// Tracks various statistics about WebSocket connections and message processing.
#[derive(Debug, Clone, Serialize)]
pub struct HealthMetrics {
    /// Total connections since server start
    pub total_connections: u64,
    /// Currently active connections
    pub active_connections: u64,
    /// Total messages processed
    pub messages_processed: u64,
    /// Total errors encountered
    pub errors: u64,
    /// Server uptime in seconds
    pub uptime_seconds: u64,
    /// WebSocket server port
    pub websocket_port: Option<u16>,
}

/// Health monitor for tracking WebSocket server metrics
///
/// Uses atomic operations for thread-safe metric updates.
///
/// # Example
///
/// ```rust,no_run
/// use vaughan::dapp::HealthMonitor;
///
/// let monitor = HealthMonitor::new();
///
/// // Track connection
/// monitor.connection_opened();
/// monitor.message_processed();
/// monitor.connection_closed();
///
/// // Get metrics
/// let metrics = monitor.get_metrics(Some(8766));
/// println!("Active connections: {}", metrics.active_connections);
/// ```
pub struct HealthMonitor {
    /// Total connections since start
    total_connections: Arc<AtomicU64>,
    /// Currently active connections
    active_connections: Arc<AtomicU64>,
    /// Total messages processed
    messages_processed: Arc<AtomicU64>,
    /// Total errors
    errors: Arc<AtomicU64>,
    /// Server start time
    start_time: Instant,
}

impl HealthMonitor {
    /// Create new health monitor
    ///
    /// Initializes all counters to zero and records start time.
    pub fn new() -> Self {
        Self {
            total_connections: Arc::new(AtomicU64::new(0)),
            active_connections: Arc::new(AtomicU64::new(0)),
            messages_processed: Arc::new(AtomicU64::new(0)),
            errors: Arc::new(AtomicU64::new(0)),
            start_time: Instant::now(),
        }
    }

    /// Record a new connection opened
    ///
    /// Increments both total and active connection counters.
    pub fn connection_opened(&self) {
        self.total_connections.fetch_add(1, Ordering::Relaxed);
        self.active_connections.fetch_add(1, Ordering::Relaxed);
    }

    /// Record a connection closed
    ///
    /// Decrements active connection counter.
    pub fn connection_closed(&self) {
        self.active_connections.fetch_sub(1, Ordering::Relaxed);
    }

    /// Record a message processed
    ///
    /// Increments message counter.
    pub fn message_processed(&self) {
        self.messages_processed.fetch_add(1, Ordering::Relaxed);
    }

    /// Record an error occurred
    ///
    /// Increments error counter.
    pub fn error_occurred(&self) {
        self.errors.fetch_add(1, Ordering::Relaxed);
    }

    /// Get current health metrics
    ///
    /// # Arguments
    ///
    /// * `websocket_port` - Optional WebSocket server port
    ///
    /// # Returns
    ///
    /// Current snapshot of all health metrics
    pub fn get_metrics(&self, websocket_port: Option<u16>) -> HealthMetrics {
        HealthMetrics {
            total_connections: self.total_connections.load(Ordering::Relaxed),
            active_connections: self.active_connections.load(Ordering::Relaxed),
            messages_processed: self.messages_processed.load(Ordering::Relaxed),
            errors: self.errors.load(Ordering::Relaxed),
            uptime_seconds: self.start_time.elapsed().as_secs(),
            websocket_port,
        }
    }

    /// Reset all counters (for testing)
    #[cfg(test)]
    pub fn reset(&self) {
        self.total_connections.store(0, Ordering::Relaxed);
        self.active_connections.store(0, Ordering::Relaxed);
        self.messages_processed.store(0, Ordering::Relaxed);
        self.errors.store(0, Ordering::Relaxed);
    }
}

impl Default for HealthMonitor {
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
    use std::thread;
    use std::time::Duration;

    #[test]
    fn test_connection_tracking() {
        let monitor = HealthMonitor::new();

        // Initially zero
        let metrics = monitor.get_metrics(None);
        assert_eq!(metrics.total_connections, 0);
        assert_eq!(metrics.active_connections, 0);

        // Open connection
        monitor.connection_opened();
        let metrics = monitor.get_metrics(None);
        assert_eq!(metrics.total_connections, 1);
        assert_eq!(metrics.active_connections, 1);

        // Open another
        monitor.connection_opened();
        let metrics = monitor.get_metrics(None);
        assert_eq!(metrics.total_connections, 2);
        assert_eq!(metrics.active_connections, 2);

        // Close one
        monitor.connection_closed();
        let metrics = monitor.get_metrics(None);
        assert_eq!(metrics.total_connections, 2); // Total doesn't decrease
        assert_eq!(metrics.active_connections, 1);
    }

    #[test]
    fn test_message_tracking() {
        let monitor = HealthMonitor::new();

        // Initially zero
        let metrics = monitor.get_metrics(None);
        assert_eq!(metrics.messages_processed, 0);

        // Process messages
        for _ in 0..10 {
            monitor.message_processed();
        }

        let metrics = monitor.get_metrics(None);
        assert_eq!(metrics.messages_processed, 10);
    }

    #[test]
    fn test_error_tracking() {
        let monitor = HealthMonitor::new();

        // Initially zero
        let metrics = monitor.get_metrics(None);
        assert_eq!(metrics.errors, 0);

        // Record errors
        for _ in 0..5 {
            monitor.error_occurred();
        }

        let metrics = monitor.get_metrics(None);
        assert_eq!(metrics.errors, 5);
    }

    #[test]
    fn test_uptime_tracking() {
        let monitor = HealthMonitor::new();

        // Should be near zero initially
        let metrics = monitor.get_metrics(None);
        assert!(metrics.uptime_seconds < 1);

        // Wait a bit
        thread::sleep(Duration::from_millis(100));

        // Should still be less than 1 second
        let metrics = monitor.get_metrics(None);
        assert!(metrics.uptime_seconds < 1);
    }

    #[test]
    fn test_websocket_port() {
        let monitor = HealthMonitor::new();

        // Without port
        let metrics = monitor.get_metrics(None);
        assert_eq!(metrics.websocket_port, None);

        // With port
        let metrics = monitor.get_metrics(Some(8766));
        assert_eq!(metrics.websocket_port, Some(8766));
    }

    #[test]
    fn test_concurrent_updates() {
        let monitor = Arc::new(HealthMonitor::new());
        let mut handles = vec![];

        // Spawn multiple threads updating metrics
        for _ in 0..10 {
            let monitor_clone = Arc::clone(&monitor);
            let handle = thread::spawn(move || {
                for _ in 0..100 {
                    monitor_clone.connection_opened();
                    monitor_clone.message_processed();
                    monitor_clone.connection_closed();
                }
            });
            handles.push(handle);
        }

        // Wait for all threads
        for handle in handles {
            handle.join().unwrap();
        }

        // Check final counts
        let metrics = monitor.get_metrics(None);
        assert_eq!(metrics.total_connections, 1000); // 10 threads * 100 connections
        assert_eq!(metrics.active_connections, 0); // All closed
        assert_eq!(metrics.messages_processed, 1000);
    }

    #[test]
    fn test_reset() {
        let monitor = HealthMonitor::new();

        // Add some data
        monitor.connection_opened();
        monitor.message_processed();
        monitor.error_occurred();

        // Verify data exists
        let metrics = monitor.get_metrics(None);
        assert!(metrics.total_connections > 0);
        assert!(metrics.messages_processed > 0);
        assert!(metrics.errors > 0);

        // Reset
        monitor.reset();

        // Verify reset
        let metrics = monitor.get_metrics(None);
        assert_eq!(metrics.total_connections, 0);
        assert_eq!(metrics.active_connections, 0);
        assert_eq!(metrics.messages_processed, 0);
        assert_eq!(metrics.errors, 0);
    }
}
