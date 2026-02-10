//! Performance Profiling for WebSocket and RPC Operations
//!
//! Tracks request timing and provides performance statistics for monitoring
//! and optimization.
//!
//! # Features
//!
//! - **Request timing**: Track duration of each RPC method
//! - **Statistics**: Calculate avg/min/max per method
//! - **Recent history**: Keep last N requests for analysis
//! - **Thread-safe**: Safe for concurrent access
//!
//! # Example
//!
//! ```rust,no_run
//! use vaughan::dapp::profiling::Profiler;
//!
//! # async fn example() {
//! let profiler = Profiler::new(1000);
//!
//! // Record request timing
//! profiler.record("eth_call".to_string(), 45).await;
//!
//! // Get statistics
//! let stats = profiler.get_stats().await;
//! println!("eth_call avg: {}ms", stats.get("eth_call").unwrap().avg);
//! # }
//! ```

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use serde::Serialize;

/// Request timing data
#[derive(Debug, Clone)]
pub struct RequestTiming {
    /// RPC method name
    pub method: String,
    /// Request duration in milliseconds
    pub duration_ms: u64,
    /// Unix timestamp when request was made
    pub timestamp: u64,
}

/// Performance statistics for a method
#[derive(Debug, Clone, Serialize)]
pub struct MethodStats {
    /// Number of requests
    pub count: usize,
    /// Average duration in milliseconds
    pub avg: u64,
    /// Minimum duration in milliseconds
    pub min: u64,
    /// Maximum duration in milliseconds
    pub max: u64,
    /// Total duration in milliseconds
    pub total: u64,
}

/// Performance profiler
///
/// Tracks request timing and calculates statistics per method.
/// Keeps a rolling window of recent requests to avoid unbounded memory growth.
pub struct Profiler {
    /// Recent request timings
    timings: Arc<RwLock<Vec<RequestTiming>>>,
    /// Maximum number of entries to keep
    max_entries: usize,
}

impl Profiler {
    /// Create new profiler
    ///
    /// # Arguments
    ///
    /// * `max_entries` - Maximum number of timing entries to keep
    ///
    /// # Example
    ///
    /// ```rust
    /// use vaughan::dapp::profiling::Profiler;
    ///
    /// let profiler = Profiler::new(1000);
    /// ```
    pub fn new(max_entries: usize) -> Self {
        Self {
            timings: Arc::new(RwLock::new(Vec::new())),
            max_entries,
        }
    }

    /// Record request timing
    ///
    /// # Arguments
    ///
    /// * `method` - RPC method name
    /// * `duration_ms` - Request duration in milliseconds
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use vaughan::dapp::profiling::Profiler;
    /// # async fn example() {
    /// let profiler = Profiler::new(1000);
    /// profiler.record("eth_call".to_string(), 45).await;
    /// # }
    /// ```
    pub async fn record(&self, method: String, duration_ms: u64) {
        let mut timings = self.timings.write().await;

        timings.push(RequestTiming {
            method,
            duration_ms,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        });

        // Keep only recent entries
        if timings.len() > self.max_entries {
            let excess = timings.len() - self.max_entries;
            timings.drain(0..excess);
        }
    }

    /// Get performance statistics per method
    ///
    /// # Returns
    ///
    /// HashMap of method name to statistics
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use vaughan::dapp::profiling::Profiler;
    /// # async fn example() {
    /// let profiler = Profiler::new(1000);
    /// let stats = profiler.get_stats().await;
    ///
    /// for (method, stat) in stats {
    ///     println!("{}: avg={}ms, count={}", method, stat.avg, stat.count);
    /// }
    /// # }
    /// ```
    pub async fn get_stats(&self) -> HashMap<String, MethodStats> {
        let timings = self.timings.read().await;
        let mut stats: HashMap<String, Vec<u64>> = HashMap::new();

        // Group durations by method
        for timing in timings.iter() {
            stats
                .entry(timing.method.clone())
                .or_insert_with(Vec::new)
                .push(timing.duration_ms);
        }

        // Calculate statistics
        stats
            .into_iter()
            .map(|(method, durations)| {
                let count = durations.len();
                let total: u64 = durations.iter().sum();
                let avg = if count > 0 { total / count as u64 } else { 0 };
                let max = *durations.iter().max().unwrap_or(&0);
                let min = *durations.iter().min().unwrap_or(&0);

                (
                    method,
                    MethodStats {
                        count,
                        avg,
                        min,
                        max,
                        total,
                    },
                )
            })
            .collect()
    }

    /// Get recent timings (last N entries)
    ///
    /// # Arguments
    ///
    /// * `limit` - Maximum number of entries to return
    ///
    /// # Returns
    ///
    /// Vector of recent request timings
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use vaughan::dapp::profiling::Profiler;
    /// # async fn example() {
    /// let profiler = Profiler::new(1000);
    /// let recent = profiler.get_recent(10).await;
    ///
    /// for timing in recent {
    ///     println!("{}: {}ms", timing.method, timing.duration_ms);
    /// }
    /// # }
    /// ```
    pub async fn get_recent(&self, limit: usize) -> Vec<RequestTiming> {
        let timings = self.timings.read().await;
        let start = if timings.len() > limit {
            timings.len() - limit
        } else {
            0
        };
        timings[start..].to_vec()
    }

    /// Get statistics for specific method
    ///
    /// # Arguments
    ///
    /// * `method` - RPC method name
    ///
    /// # Returns
    ///
    /// Statistics for the method, or None if no data
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use vaughan::dapp::profiling::Profiler;
    /// # async fn example() {
    /// let profiler = Profiler::new(1000);
    ///
    /// if let Some(stats) = profiler.get_method_stats("eth_call").await {
    ///     println!("eth_call: avg={}ms", stats.avg);
    /// }
    /// # }
    /// ```
    pub async fn get_method_stats(&self, method: &str) -> Option<MethodStats> {
        let stats = self.get_stats().await;
        stats.get(method).cloned()
    }

    /// Clear all timing data
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use vaughan::dapp::profiling::Profiler;
    /// # async fn example() {
    /// let profiler = Profiler::new(1000);
    /// profiler.clear().await;
    /// # }
    /// ```
    pub async fn clear(&self) {
        let mut timings = self.timings.write().await;
        timings.clear();
    }

    /// Get total number of requests tracked
    ///
    /// # Returns
    ///
    /// Total number of timing entries
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use vaughan::dapp::profiling::Profiler;
    /// # async fn example() {
    /// let profiler = Profiler::new(1000);
    /// let count = profiler.count().await;
    /// println!("Tracked {} requests", count);
    /// # }
    /// ```
    pub async fn count(&self) -> usize {
        let timings = self.timings.read().await;
        timings.len()
    }
}

impl Default for Profiler {
    fn default() -> Self {
        Self::new(1000)
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_record_and_stats() {
        let profiler = Profiler::new(100);

        // Record some timings
        profiler.record("eth_call".to_string(), 50).await;
        profiler.record("eth_call".to_string(), 100).await;
        profiler.record("eth_call".to_string(), 75).await;
        profiler.record("eth_sendTransaction".to_string(), 200).await;

        let stats = profiler.get_stats().await;

        // Check eth_call stats
        let eth_call_stats = stats.get("eth_call").unwrap();
        assert_eq!(eth_call_stats.count, 3);
        assert_eq!(eth_call_stats.avg, 75); // (50 + 100 + 75) / 3
        assert_eq!(eth_call_stats.min, 50);
        assert_eq!(eth_call_stats.max, 100);
        assert_eq!(eth_call_stats.total, 225);

        // Check eth_sendTransaction stats
        let tx_stats = stats.get("eth_sendTransaction").unwrap();
        assert_eq!(tx_stats.count, 1);
        assert_eq!(tx_stats.avg, 200);
    }

    #[tokio::test]
    async fn test_max_entries() {
        let profiler = Profiler::new(5);

        // Record more than max_entries
        for i in 0..10 {
            profiler.record("test".to_string(), i * 10).await;
        }

        let count = profiler.count().await;
        assert_eq!(count, 5); // Should only keep last 5

        let recent = profiler.get_recent(10).await;
        assert_eq!(recent.len(), 5);

        // Should have the last 5 entries (50, 60, 70, 80, 90)
        assert_eq!(recent[0].duration_ms, 50);
        assert_eq!(recent[4].duration_ms, 90);
    }

    #[tokio::test]
    async fn test_get_recent() {
        let profiler = Profiler::new(100);

        for i in 0..10 {
            profiler.record("test".to_string(), i).await;
        }

        let recent = profiler.get_recent(5).await;
        assert_eq!(recent.len(), 5);

        // Should have last 5 entries (5, 6, 7, 8, 9)
        assert_eq!(recent[0].duration_ms, 5);
        assert_eq!(recent[4].duration_ms, 9);
    }

    #[tokio::test]
    async fn test_get_method_stats() {
        let profiler = Profiler::new(100);

        profiler.record("eth_call".to_string(), 50).await;
        profiler.record("eth_call".to_string(), 100).await;
        profiler.record("other".to_string(), 200).await;

        let stats = profiler.get_method_stats("eth_call").await;
        assert!(stats.is_some());

        let stats = stats.unwrap();
        assert_eq!(stats.count, 2);
        assert_eq!(stats.avg, 75);

        let no_stats = profiler.get_method_stats("nonexistent").await;
        assert!(no_stats.is_none());
    }

    #[tokio::test]
    async fn test_clear() {
        let profiler = Profiler::new(100);

        profiler.record("test".to_string(), 50).await;
        profiler.record("test".to_string(), 100).await;

        assert_eq!(profiler.count().await, 2);

        profiler.clear().await;

        assert_eq!(profiler.count().await, 0);
        let stats = profiler.get_stats().await;
        assert!(stats.is_empty());
    }

    #[tokio::test]
    async fn test_concurrent_access() {
        use std::sync::Arc;

        let profiler = Arc::new(Profiler::new(1000));
        let mut handles = vec![];

        // Spawn 10 tasks, each recording 100 timings
        for i in 0..10 {
            let profiler_clone = Arc::clone(&profiler);
            let handle = tokio::spawn(async move {
                for j in 0..100 {
                    profiler_clone
                        .record(format!("method_{}", i), j)
                        .await;
                }
            });
            handles.push(handle);
        }

        // Wait for all tasks
        for handle in handles {
            handle.await.unwrap();
        }

        // Should have 1000 total entries (10 tasks * 100 each)
        assert_eq!(profiler.count().await, 1000);

        let stats = profiler.get_stats().await;
        assert_eq!(stats.len(), 10); // 10 different methods
    }

    #[tokio::test]
    async fn test_empty_stats() {
        let profiler = Profiler::new(100);

        let stats = profiler.get_stats().await;
        assert!(stats.is_empty());

        let recent = profiler.get_recent(10).await;
        assert!(recent.is_empty());

        assert_eq!(profiler.count().await, 0);
    }
}
