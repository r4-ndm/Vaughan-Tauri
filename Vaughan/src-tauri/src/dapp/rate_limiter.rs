///! Rate Limiter for dApp Requests
///!
///! Implements token bucket algorithm to prevent request spam

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

use crate::error::WalletError;

/// Token bucket for rate limiting
#[derive(Debug)]
struct TokenBucket {
    /// Current number of tokens
    tokens: f64,
    /// Last refill time
    last_refill: Instant,
    /// Maximum capacity
    capacity: f64,
    /// Refill rate (tokens per second)
    refill_rate: f64,
}

impl TokenBucket {
    /// Create new token bucket
    fn new(capacity: f64, refill_rate: f64) -> Self {
        Self {
            tokens: capacity,
            last_refill: Instant::now(),
            capacity,
            refill_rate,
        }
    }

    /// Refill tokens based on elapsed time
    fn refill(&mut self) {
        let now = Instant::now();
        let elapsed = now.duration_since(self.last_refill).as_secs_f64();
        
        // Add tokens based on elapsed time
        self.tokens = (self.tokens + elapsed * self.refill_rate).min(self.capacity);
        self.last_refill = now;
    }

    /// Try to consume a token
    fn try_consume(&mut self) -> bool {
        self.refill();
        
        if self.tokens >= 1.0 {
            self.tokens -= 1.0;
            true
        } else {
            false
        }
    }
}

/// Rate limiter for dApp requests
///
/// Uses token bucket algorithm per origin
pub struct RateLimiter {
    /// Token buckets per origin
    buckets: Arc<Mutex<HashMap<String, TokenBucket>>>,
    /// Default capacity (tokens)
    capacity: f64,
    /// Default refill rate (tokens per second)
    refill_rate: f64,
}

impl RateLimiter {
    /// Create new rate limiter
    ///
    /// # Arguments
    ///
    /// * `capacity` - Maximum tokens (burst size)
    /// * `refill_rate` - Tokens per second (sustained rate)
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// // Allow 10 requests burst, 1 request per second sustained
    /// let limiter = RateLimiter::new(10.0, 1.0);
    /// ```
    pub fn new(capacity: f64, refill_rate: f64) -> Self {
        Self {
            buckets: Arc::new(Mutex::new(HashMap::new())),
            capacity,
            refill_rate,
        }
    }

    /// Check rate limit for origin
    ///
    /// # Arguments
    ///
    /// * `origin` - dApp origin
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
    /// let limiter = RateLimiter::new(10.0, 1.0);
    /// limiter.check_limit("https://app.uniswap.org").await?;
    /// # Ok(())
    /// # }
    /// ```
    pub async fn check_limit(&self, origin: &str) -> Result<(), WalletError> {
        let mut buckets = self.buckets.lock().await;
        
        // Get or create bucket for origin
        let bucket = buckets
            .entry(origin.to_string())
            .or_insert_with(|| TokenBucket::new(self.capacity, self.refill_rate));
        
        // Try to consume token
        if bucket.try_consume() {
            Ok(())
        } else {
            Err(WalletError::RateLimitExceeded)
        }
    }

    /// Clear rate limit for origin (for testing)
    #[cfg(test)]
    pub async fn clear(&self, origin: &str) {
        let mut buckets = self.buckets.lock().await;
        buckets.remove(origin);
    }
}

impl Default for RateLimiter {
    fn default() -> Self {
        // Default: 10 requests burst, 1 request per second sustained
        Self::new(10.0, 1.0)
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_rate_limit_allows_burst() {
        let limiter = RateLimiter::new(5.0, 1.0);
        let origin = "https://test.com";

        // Should allow 5 requests (burst)
        for _ in 0..5 {
            assert!(limiter.check_limit(origin).await.is_ok());
        }

        // 6th request should fail
        assert!(limiter.check_limit(origin).await.is_err());
    }

    #[tokio::test]
    async fn test_rate_limit_refills() {
        let limiter = RateLimiter::new(1.0, 10.0); // 1 token, 10/sec refill
        let origin = "https://test.com";

        // Use token
        assert!(limiter.check_limit(origin).await.is_ok());

        // Should fail immediately
        assert!(limiter.check_limit(origin).await.is_err());

        // Wait 200ms (should refill 2 tokens at 10/sec)
        tokio::time::sleep(Duration::from_millis(200)).await;

        // Should succeed now
        assert!(limiter.check_limit(origin).await.is_ok());
    }

    #[tokio::test]
    async fn test_rate_limit_per_origin() {
        let limiter = RateLimiter::new(1.0, 1.0);
        let origin1 = "https://test1.com";
        let origin2 = "https://test2.com";

        // Use token for origin1
        assert!(limiter.check_limit(origin1).await.is_ok());

        // Should fail for origin1
        assert!(limiter.check_limit(origin1).await.is_err());

        // Should succeed for origin2 (different bucket)
        assert!(limiter.check_limit(origin2).await.is_ok());
    }
}
