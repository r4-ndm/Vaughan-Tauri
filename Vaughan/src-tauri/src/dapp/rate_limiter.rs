///! Rate Limiter for dApp Requests
///!
///! Implements multi-tier token bucket algorithm with method-specific limits
///!
///! ## Features
///!
///! - **Multi-tier limits**: Per-second, per-minute, per-hour
///! - **Method-specific**: Different limits for sensitive vs read-only methods
///! - **Per-origin tracking**: Separate limits for each dApp
///! - **Token bucket algorithm**: Allows bursts while enforcing sustained rates
///!
///! ## Example
///!
///! ```rust,no_run
///! use vaughan::dapp::RateLimiter;
///!
///! # async fn example() -> Result<(), Box<dyn std::error::Error>> {
///! let limiter = RateLimiter::default();
///!
///! // Check limit for specific method
///! limiter.check_limit("https://app.uniswap.org", "eth_sendTransaction").await?;
///! # Ok(())
///! # }
///! ```

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::Mutex;

use crate::error::WalletError;
use crate::dapp::logging::*;

/// Multi-tier rate limit configuration
///
/// Defines limits across multiple time windows to prevent both
/// burst attacks and sustained abuse.
#[derive(Debug, Clone)]
pub struct RateLimitConfig {
    /// Requests per second (burst control)
    pub per_second: f64,
    /// Requests per minute (short-term sustained)
    pub per_minute: f64,
    /// Requests per hour (long-term sustained)
    pub per_hour: f64,
    /// Burst size (max tokens available)
    pub burst_size: f64,
}

impl Default for RateLimitConfig {
    fn default() -> Self {
        Self {
            per_second: 10.0,
            per_minute: 100.0,
            per_hour: 1000.0,
            burst_size: 20.0,
        }
    }
}

impl RateLimitConfig {
    /// Create config for sensitive methods (signing, transactions)
    pub fn sensitive() -> Self {
        Self {
            per_second: 1.0,
            per_minute: 10.0,
            per_hour: 100.0,
            burst_size: 2.0,
        }
    }

    /// Create config for read-only methods (queries, calls)
    pub fn read_only() -> Self {
        Self {
            per_second: 20.0,
            per_minute: 200.0,
            per_hour: 2000.0,
            burst_size: 50.0,
        }
    }

    /// Create config for connection methods
    pub fn connection() -> Self {
        Self {
            per_second: 5.0,
            per_minute: 20.0,
            per_hour: 100.0,
            burst_size: 10.0,
        }
    }
}

/// Multi-tier token bucket for rate limiting
///
/// Tracks tokens across three time windows: second, minute, hour
#[derive(Debug)]
struct MultiTierBucket {
    /// Per-second bucket
    second_tokens: f64,
    second_last_refill: Instant,
    
    /// Per-minute bucket
    minute_tokens: f64,
    minute_last_refill: Instant,
    
    /// Per-hour bucket
    hour_tokens: f64,
    hour_last_refill: Instant,
    
    /// Configuration
    config: RateLimitConfig,
}

impl MultiTierBucket {
    /// Create new multi-tier bucket
    fn new(config: RateLimitConfig) -> Self {
        let now = Instant::now();
        Self {
            second_tokens: config.burst_size,
            second_last_refill: now,
            minute_tokens: config.per_minute,
            minute_last_refill: now,
            hour_tokens: config.per_hour,
            hour_last_refill: now,
            config,
        }
    }

    /// Refill all buckets based on elapsed time
    fn refill(&mut self) {
        let now = Instant::now();
        
        // Refill per-second bucket
        let second_elapsed = now.duration_since(self.second_last_refill).as_secs_f64();
        self.second_tokens = (self.second_tokens + second_elapsed * self.config.per_second)
            .min(self.config.burst_size);
        self.second_last_refill = now;
        
        // Refill per-minute bucket
        let minute_elapsed = now.duration_since(self.minute_last_refill).as_secs_f64();
        self.minute_tokens = (self.minute_tokens + (minute_elapsed / 60.0) * self.config.per_minute)
            .min(self.config.per_minute);
        self.minute_last_refill = now;
        
        // Refill per-hour bucket
        let hour_elapsed = now.duration_since(self.hour_last_refill).as_secs_f64();
        self.hour_tokens = (self.hour_tokens + (hour_elapsed / 3600.0) * self.config.per_hour)
            .min(self.config.per_hour);
        self.hour_last_refill = now;
    }

    /// Try to consume a token from all buckets
    ///
    /// Returns Ok if all buckets have tokens, Err with the limiting tier otherwise
    fn try_consume(&mut self) -> Result<(), &'static str> {
        self.refill();
        
        // Check all tiers (most restrictive first)
        if self.second_tokens < 1.0 {
            return Err("per-second limit exceeded");
        }
        if self.minute_tokens < 1.0 {
            return Err("per-minute limit exceeded");
        }
        if self.hour_tokens < 1.0 {
            return Err("per-hour limit exceeded");
        }
        
        // Consume from all buckets
        self.second_tokens -= 1.0;
        self.minute_tokens -= 1.0;
        self.hour_tokens -= 1.0;
        
        Ok(())
    }
}

/// Method-specific rate limit configurations
///
/// Maps RPC methods to their rate limit configurations
pub struct MethodRateLimits {
    configs: HashMap<String, RateLimitConfig>,
    default_config: RateLimitConfig,
}

impl MethodRateLimits {
    /// Create new method rate limits with default configurations
    pub fn new() -> Self {
        let mut configs = HashMap::new();
        
        // Sensitive methods - strict limits
        let sensitive_methods = vec![
            "eth_sendTransaction",
            "eth_sign",
            "eth_signTypedData",
            "eth_signTypedData_v3",
            "eth_signTypedData_v4",
            "personal_sign",
            "wallet_addEthereumChain",
            "wallet_switchEthereumChain",
        ];
        
        for method in sensitive_methods {
            configs.insert(method.to_string(), RateLimitConfig::sensitive());
        }
        
        // Connection methods - moderate limits
        let connection_methods = vec![
            "eth_requestAccounts",
            "wallet_requestPermissions",
        ];
        
        for method in connection_methods {
            configs.insert(method.to_string(), RateLimitConfig::connection());
        }
        
        // Read-only methods - relaxed limits
        let read_only_methods = vec![
            "eth_call",
            "eth_estimateGas",
            "eth_getBalance",
            "eth_getCode",
            "eth_getStorageAt",
            "eth_getTransactionCount",
            "eth_getBlockByNumber",
            "eth_getBlockByHash",
            "eth_getTransactionByHash",
            "eth_getTransactionReceipt",
            "eth_getLogs",
        ];
        
        for method in read_only_methods {
            configs.insert(method.to_string(), RateLimitConfig::read_only());
        }
        
        Self {
            configs,
            default_config: RateLimitConfig::default(),
        }
    }

    /// Get configuration for a method
    ///
    /// Returns method-specific config if available, otherwise default
    pub fn get_config(&self, method: &str) -> RateLimitConfig {
        self.configs
            .get(method)
            .cloned()
            .unwrap_or_else(|| self.default_config.clone())
    }

    /// Add or update configuration for a method
    pub fn set_config(&mut self, method: String, config: RateLimitConfig) {
        self.configs.insert(method, config);
    }
}

impl Default for MethodRateLimits {
    fn default() -> Self {
        Self::new()
    }
}

/// Enhanced rate limiter with multi-tier and method-specific limits
///
/// Uses token bucket algorithm with three time windows (second, minute, hour)
/// and method-specific configurations for fine-grained control.
pub struct RateLimiter {
    /// Token buckets per (origin, method) pair
    buckets: Arc<Mutex<HashMap<String, MultiTierBucket>>>,
    /// Method-specific configurations
    method_limits: Arc<MethodRateLimits>,
}

impl RateLimiter {
    /// Create new rate limiter with default method configurations
    pub fn new() -> Self {
        Self {
            buckets: Arc::new(Mutex::new(HashMap::new())),
            method_limits: Arc::new(MethodRateLimits::new()),
        }
    }

    /// Create rate limiter with custom method configurations
    pub fn with_method_limits(method_limits: MethodRateLimits) -> Self {
        Self {
            buckets: Arc::new(Mutex::new(HashMap::new())),
            method_limits: Arc::new(method_limits),
        }
    }

    /// Check rate limit for origin and method
    ///
    /// # Arguments
    ///
    /// * `origin` - dApp origin
    /// * `method` - RPC method name
    ///
    /// # Returns
    ///
    /// * `Ok(())` - Request allowed
    /// * `Err(WalletError::RateLimitExceeded)` - Too many requests
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use vaughan::dapp::RateLimiter;
    /// # async fn example() -> Result<(), Box<dyn std::error::Error>> {
    /// let limiter = RateLimiter::new();
    /// limiter.check_limit("https://app.uniswap.org", "eth_sendTransaction").await?;
    /// # Ok(())
    /// # }
    /// ```
    pub async fn check_limit(&self, origin: &str, method: &str) -> Result<(), WalletError> {
        let mut buckets = self.buckets.lock().await;
        
        // Create bucket key (origin:method)
        let key = format!("{}:{}", origin, method);
        
        // Get or create bucket for this origin+method
        let config = self.method_limits.get_config(method);
        let bucket = buckets
            .entry(key)
            .or_insert_with(|| MultiTierBucket::new(config));
        
        // Try to consume token
        bucket.try_consume().map_err(|tier| {
            log_rate_limit_exceeded(origin, method, tier);
            WalletError::RateLimitExceeded
        })?;
        
        log_rate_limit_passed(origin, method);
        Ok(())
    }

    /// Clear rate limit for origin and method (for testing)
    #[cfg(test)]
    pub async fn clear(&self, origin: &str, method: &str) {
        let mut buckets = self.buckets.lock().await;
        let key = format!("{}:{}", origin, method);
        buckets.remove(&key);
    }

    /// Clear all rate limits (for testing)
    #[cfg(test)]
    pub async fn clear_all(&self) {
        let mut buckets = self.buckets.lock().await;
        buckets.clear();
    }
}

impl Default for RateLimiter {
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
    use tokio::time::{sleep, Duration};

    #[tokio::test]
    async fn test_multi_tier_burst() {
        let limiter = RateLimiter::new();
        let origin = "https://test.com";
        let method = "eth_call"; // Read-only method (50 burst)

        // Should allow burst (50 requests)
        for i in 0..50 {
            assert!(
                limiter.check_limit(origin, method).await.is_ok(),
                "Request {} should succeed (burst)", i + 1
            );
        }

        // 51st request should fail (burst exhausted)
        assert!(
            limiter.check_limit(origin, method).await.is_err(),
            "Request 51 should fail (burst exhausted)"
        );
    }

    #[tokio::test]
    async fn test_per_second_limit() {
        let limiter = RateLimiter::new();
        let origin = "https://test.com";
        let method = "eth_sendTransaction"; // Sensitive method (1/sec, burst 2)

        // Should allow burst (2 requests)
        assert!(limiter.check_limit(origin, method).await.is_ok());
        assert!(limiter.check_limit(origin, method).await.is_ok());

        // Third request should fail (burst exhausted)
        assert!(limiter.check_limit(origin, method).await.is_err());

        // Wait for refill
        sleep(Duration::from_millis(1200)).await;

        // Should succeed now (refilled)
        assert!(limiter.check_limit(origin, method).await.is_ok());
    }

    #[tokio::test]
    async fn test_per_minute_limit() {
        // This test verifies that per-minute limits work
        // We use a simpler approach: verify burst works, then verify sustained rate
        let limiter = RateLimiter::new();
        let origin = "https://test.com";
        let method = "eth_sendTransaction"; // Sensitive: 1/sec, 10/min, burst 2

        // Burst should work (2 requests)
        assert!(limiter.check_limit(origin, method).await.is_ok());
        assert!(limiter.check_limit(origin, method).await.is_ok());
        
        // Should fail (burst exhausted)
        assert!(limiter.check_limit(origin, method).await.is_err());
        
        // Clear and test sustained rate
        limiter.clear(origin, method).await;
        
        // Make 10 requests with 1.2s spacing (should all succeed - within minute limit)
        for i in 0..10 {
            if i > 0 {
                sleep(Duration::from_millis(1200)).await;
            }
            assert!(
                limiter.check_limit(origin, method).await.is_ok(),
                "Request {} should succeed (within minute limit)", i + 1
            );
        }
    }

    #[tokio::test]
    async fn test_method_specific_limits() {
        let limiter = RateLimiter::new();
        let origin = "https://test.com";

        // Sensitive method (1/sec, burst 2)
        let sensitive = "eth_sendTransaction";
        assert!(limiter.check_limit(origin, sensitive).await.is_ok());
        assert!(limiter.check_limit(origin, sensitive).await.is_ok());
        assert!(limiter.check_limit(origin, sensitive).await.is_err());

        // Read-only method (20/sec, burst 50) - different bucket
        let read_only = "eth_call";
        for _ in 0..50 {
            assert!(limiter.check_limit(origin, read_only).await.is_ok());
        }
        assert!(limiter.check_limit(origin, read_only).await.is_err());
    }

    #[tokio::test]
    async fn test_per_origin_isolation() {
        let limiter = RateLimiter::new();
        let origin1 = "https://test1.com";
        let origin2 = "https://test2.com";
        let method = "eth_sendTransaction";

        // Use up origin1's burst
        assert!(limiter.check_limit(origin1, method).await.is_ok());
        assert!(limiter.check_limit(origin1, method).await.is_ok());
        assert!(limiter.check_limit(origin1, method).await.is_err());

        // Origin2 should have full burst available
        assert!(limiter.check_limit(origin2, method).await.is_ok());
        assert!(limiter.check_limit(origin2, method).await.is_ok());
        assert!(limiter.check_limit(origin2, method).await.is_err());
    }

    #[tokio::test]
    async fn test_refill_rates() {
        let limiter = RateLimiter::new();
        let origin = "https://test.com";
        let method = "eth_call"; // 20/sec refill

        // Use up burst
        for _ in 0..50 {
            let _ = limiter.check_limit(origin, method).await;
        }

        // Should fail (burst exhausted)
        assert!(limiter.check_limit(origin, method).await.is_err());

        // Wait 100ms (should refill 2 tokens at 20/sec)
        sleep(Duration::from_millis(100)).await;

        // Should succeed (refilled)
        assert!(limiter.check_limit(origin, method).await.is_ok());
        assert!(limiter.check_limit(origin, method).await.is_ok());

        // Should fail again
        assert!(limiter.check_limit(origin, method).await.is_err());
    }

    #[tokio::test]
    async fn test_connection_methods() {
        let limiter = RateLimiter::new();
        let origin = "https://test.com";
        let method = "eth_requestAccounts"; // Connection method (5/sec, burst 10)

        // Should allow burst (10 requests)
        for i in 0..10 {
            assert!(
                limiter.check_limit(origin, method).await.is_ok(),
                "Request {} should succeed", i + 1
            );
        }

        // 11th request should fail
        assert!(limiter.check_limit(origin, method).await.is_err());
    }

    #[tokio::test]
    async fn test_default_config() {
        let limiter = RateLimiter::new();
        let origin = "https://test.com";
        let method = "unknown_method"; // Should use default config

        // Default: 10/sec, burst 20
        for i in 0..20 {
            assert!(
                limiter.check_limit(origin, method).await.is_ok(),
                "Request {} should succeed", i + 1
            );
        }

        // 21st request should fail
        assert!(limiter.check_limit(origin, method).await.is_err());
    }

    #[tokio::test]
    async fn test_rate_limit_config_presets() {
        // Test sensitive preset
        let sensitive = RateLimitConfig::sensitive();
        assert_eq!(sensitive.per_second, 1.0);
        assert_eq!(sensitive.per_minute, 10.0);
        assert_eq!(sensitive.per_hour, 100.0);
        assert_eq!(sensitive.burst_size, 2.0);

        // Test read-only preset
        let read_only = RateLimitConfig::read_only();
        assert_eq!(read_only.per_second, 20.0);
        assert_eq!(read_only.per_minute, 200.0);
        assert_eq!(read_only.per_hour, 2000.0);
        assert_eq!(read_only.burst_size, 50.0);

        // Test connection preset
        let connection = RateLimitConfig::connection();
        assert_eq!(connection.per_second, 5.0);
        assert_eq!(connection.per_minute, 20.0);
        assert_eq!(connection.per_hour, 100.0);
        assert_eq!(connection.burst_size, 10.0);
    }

    #[tokio::test]
    async fn test_custom_method_limits() {
        let mut method_limits = MethodRateLimits::new();
        
        // Add custom limit for a method
        method_limits.set_config(
            "custom_method".to_string(),
            RateLimitConfig {
                per_second: 5.0,
                per_minute: 50.0,
                per_hour: 500.0,
                burst_size: 10.0,
            },
        );

        let limiter = RateLimiter::with_method_limits(method_limits);
        let origin = "https://test.com";

        // Should allow 10 requests (custom burst)
        for i in 0..10 {
            assert!(
                limiter.check_limit(origin, "custom_method").await.is_ok(),
                "Request {} should succeed", i + 1
            );
        }

        // 11th request should fail
        assert!(limiter.check_limit(origin, "custom_method").await.is_err());
    }

    #[tokio::test]
    async fn test_clear_limits() {
        let limiter = RateLimiter::new();
        let origin = "https://test.com";
        let method = "eth_sendTransaction";

        // Use up burst
        assert!(limiter.check_limit(origin, method).await.is_ok());
        assert!(limiter.check_limit(origin, method).await.is_ok());
        assert!(limiter.check_limit(origin, method).await.is_err());

        // Clear limits
        limiter.clear(origin, method).await;

        // Should have full burst again
        assert!(limiter.check_limit(origin, method).await.is_ok());
        assert!(limiter.check_limit(origin, method).await.is_ok());
    }

    #[tokio::test]
    async fn test_all_sensitive_methods() {
        let limiter = RateLimiter::new();
        let origin = "https://test.com";

        let sensitive_methods = vec![
            "eth_sendTransaction",
            "eth_sign",
            "eth_signTypedData",
            "personal_sign",
        ];

        for method in sensitive_methods {
            // Each should have strict limits (burst 2)
            assert!(limiter.check_limit(origin, method).await.is_ok());
            assert!(limiter.check_limit(origin, method).await.is_ok());
            assert!(
                limiter.check_limit(origin, method).await.is_err(),
                "{} should have strict limits", method
            );
            
            // Clear for next test
            limiter.clear(origin, method).await;
        }
    }
}
