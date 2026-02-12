# WebSocket Enhancement Tasks

**Based on**: DeepSeek Analysis & Current Implementation Audit  
**Date**: 2026-02-10  
**Status**: Task List for Production Hardening

---

## 📋 Current Implementation Audit

### ✅ What We Have

| Feature | Status | Location | Notes |
|---------|--------|----------|-------|
| **WebSocket Server** | ✅ Working | `src-tauri/src/lib.rs:260-320` | Basic implementation, hardcoded port |
| **Provider Script** | ✅ Working | `src/provider/provider-inject-extension.js` | Full EIP-1193, auto-reconnect |
| **RPC Handler** | ✅ Working | `src-tauri/src/dapp/rpc_handler.rs` | All methods implemented |
| **Session Manager** | ✅ Working | `src-tauri/src/dapp/session.rs` | Per-window tracking |
| **Rate Limiter** | ✅ Working | `src-tauri/src/dapp/rate_limiter.rs` | Token bucket, per-origin |
| **Approval Queue** | ✅ Working | `src-tauri/src/dapp/approval.rs` | User consent flow |

### ⚠️ What's Missing (DeepSeek Suggestions)

| Feature | Priority | Complexity | Impact |
|---------|----------|------------|--------|
| Connection Authentication | HIGH | Medium | Security |
| Message Signing | HIGH | High | Security |
| Multi-tier Rate Limiting | MEDIUM | Low | Reliability |
| Dynamic Port Assignment | MEDIUM | Low | Compatibility |
| Health Checks | MEDIUM | Low | Monitoring |
| Graceful Degradation | LOW | Medium | Compatibility |
| Connection Metrics | LOW | Low | Monitoring |
| Structured Logging | LOW | Low | Debugging |
| Performance Profiling | LOW | Medium | Optimization |

---

## 🎯 Task List

### Phase 1: Security Enhancements (HIGH PRIORITY)

#### Task 1.1: Connection Authentication
**Priority**: HIGH  
**Complexity**: Medium  
**Estimated Time**: 4-6 hours

**Current State**:
- ❌ No authentication on WebSocket connections
- ❌ Any local process can connect to ws://localhost:8766
- ⚠️ Potential security risk if malicious software running locally

**Implementation**:

```rust
// File: src-tauri/src/dapp/auth.rs (NEW)

use uuid::Uuid;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use std::time::{SystemTime, UNIX_EPOCH};

/// Authentication token with expiry
#[derive(Debug, Clone)]
pub struct AuthToken {
    pub token: String,
    pub origin: String,
    pub window_label: String,
    pub created_at: u64,
    pub expires_at: u64,
}

/// Token manager
pub struct TokenManager {
    tokens: Arc<RwLock<HashMap<String, AuthToken>>>,
}

impl TokenManager {
    pub fn new() -> Self {
        Self {
            tokens: Arc::new(RwLock::new(HashMap::new())),
        }
    }
    
    /// Generate token for window
    pub async fn generate_token(&self, window_label: &str, origin: &str) -> String {
        let token = Uuid::new_v4().to_string();
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
        
        let auth_token = AuthToken {
            token: token.clone(),
            origin: origin.to_string(),
            window_label: window_label.to_string(),
            created_at: now,
            expires_at: now + 3600, // 1 hour expiry
        };
        
        let mut tokens = self.tokens.write().await;
        tokens.insert(token.clone(), auth_token);
        
        token
    }
    
    /// Verify token
    pub async fn verify_token(&self, token: &str) -> Result<AuthToken, String> {
        let tokens = self.tokens.read().await;
        
        match tokens.get(token) {
            Some(auth_token) => {
                let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
                
                if now > auth_token.expires_at {
                    Err("Token expired".to_string())
                } else {
                    Ok(auth_token.clone())
                }
            }
            None => Err("Invalid token".to_string()),
        }
    }
    
    /// Revoke token
    pub async fn revoke_token(&self, token: &str) {
        let mut tokens = self.tokens.write().await;
        tokens.remove(token);
    }
    
    /// Clean expired tokens
    pub async fn clean_expired(&self) {
        let mut tokens = self.tokens.write().await;
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
        
        tokens.retain(|_, auth_token| now <= auth_token.expires_at);
    }
}
```

**Changes Required**:
1. Create `src-tauri/src/dapp/auth.rs`
2. Update `src-tauri/src/dapp/mod.rs` to export `auth`
3. Add `TokenManager` to `VaughanState`
4. Update WebSocket handler in `lib.rs` to verify token on first message
5. Update `provider-inject-extension.js` to send token on connection
6. Update `open_dapp_window` command to generate and inject token

**Acceptance Criteria**:
- [ ] WebSocket connections require valid token
- [ ] Tokens expire after 1 hour
- [ ] Invalid tokens are rejected
- [ ] Tokens are window-specific
- [ ] Expired tokens are cleaned up

---

#### Task 1.2: Message Signing
**Priority**: HIGH  
**Complexity**: High  
**Estimated Time**: 8-10 hours

**Current State**:
- ❌ No message integrity verification
- ❌ Messages could be tampered with in transit
- ⚠️ Potential MITM attack vector (though localhost only)

**Implementation**:

```rust
// File: src-tauri/src/dapp/signing.rs (NEW)

use hmac::{Hmac, Mac};
use sha2::Sha256;
use serde::{Deserialize, Serialize};

type HmacSha256 = Hmac<Sha256>;

/// Signed message
#[derive(Debug, Serialize, Deserialize)]
pub struct SignedMessage {
    pub payload: String,
    pub signature: String,
    pub timestamp: u64,
    pub nonce: String,
}

/// Message signer
pub struct MessageSigner {
    secret_key: Vec<u8>,
}

impl MessageSigner {
    /// Create new signer with secret key
    pub fn new(secret_key: Vec<u8>) -> Self {
        Self { secret_key }
    }
    
    /// Sign message
    pub fn sign(&self, payload: &str) -> Result<SignedMessage, String> {
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        let nonce = uuid::Uuid::new_v4().to_string();
        
        // Create signature data
        let sig_data = format!("{}:{}:{}", payload, timestamp, nonce);
        
        // Sign with HMAC-SHA256
        let mut mac = HmacSha256::new_from_slice(&self.secret_key)
            .map_err(|e| format!("HMAC error: {}", e))?;
        mac.update(sig_data.as_bytes());
        let signature = hex::encode(mac.finalize().into_bytes());
        
        Ok(SignedMessage {
            payload: payload.to_string(),
            signature,
            timestamp,
            nonce,
        })
    }
    
    /// Verify signature
    pub fn verify(&self, msg: &SignedMessage) -> Result<(), String> {
        // Check timestamp (reject if > 5 minutes old)
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        if now - msg.timestamp > 300 {
            return Err("Message too old".to_string());
        }
        
        // Recreate signature data
        let sig_data = format!("{}:{}:{}", msg.payload, msg.timestamp, msg.nonce);
        
        // Verify HMAC
        let mut mac = HmacSha256::new_from_slice(&self.secret_key)
            .map_err(|e| format!("HMAC error: {}", e))?;
        mac.update(sig_data.as_bytes());
        
        let expected_sig = hex::encode(mac.finalize().into_bytes());
        
        if expected_sig == msg.signature {
            Ok(())
        } else {
            Err("Invalid signature".to_string())
        }
    }
}
```

**Changes Required**:
1. Create `src-tauri/src/dapp/signing.rs`
2. Add `hmac` and `sha2` dependencies to `Cargo.toml`
3. Generate secret key on wallet initialization
4. Update WebSocket handler to sign outgoing messages
5. Update `provider-inject-extension.js` to verify signatures
6. Add signature verification to incoming messages

**Acceptance Criteria**:
- [ ] All messages from wallet are signed
- [ ] Provider verifies signatures
- [ ] Old messages (>5 min) are rejected
- [ ] Invalid signatures are rejected
- [ ] Nonce prevents replay attacks

---

#### Task 1.3: Enhanced Rate Limiting
**Priority**: MEDIUM  
**Complexity**: Low  
**Estimated Time**: 2-3 hours

**Current State**:
- ✅ Basic token bucket per origin
- ❌ No per-method limits
- ❌ No burst vs sustained differentiation
- ❌ No hourly/daily limits

**Implementation**:

```rust
// File: src-tauri/src/dapp/rate_limiter.rs (UPDATE)

/// Multi-tier rate limit configuration
#[derive(Debug, Clone)]
pub struct RateLimitConfig {
    pub per_second: f64,
    pub per_minute: f64,
    pub per_hour: f64,
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

/// Method-specific rate limits
pub struct MethodRateLimits {
    configs: HashMap<String, RateLimitConfig>,
}

impl MethodRateLimits {
    pub fn new() -> Self {
        let mut configs = HashMap::new();
        
        // Sensitive methods - stricter limits
        configs.insert("eth_sendTransaction".to_string(), RateLimitConfig {
            per_second: 1.0,
            per_minute: 10.0,
            per_hour: 100.0,
            burst_size: 2.0,
        });
        
        configs.insert("eth_sign".to_string(), RateLimitConfig {
            per_second: 1.0,
            per_minute: 10.0,
            per_hour: 100.0,
            burst_size: 2.0,
        });
        
        // Read-only methods - relaxed limits
        configs.insert("eth_call".to_string(), RateLimitConfig {
            per_second: 20.0,
            per_minute: 200.0,
            per_hour: 2000.0,
            burst_size: 50.0,
        });
        
        Self { configs }
    }
    
    pub fn get_config(&self, method: &str) -> RateLimitConfig {
        self.configs.get(method)
            .cloned()
            .unwrap_or_default()
    }
}
```

**Changes Required**:
1. Update `RateLimiter` struct to support multiple time windows
2. Add method-specific configurations
3. Track per-second, per-minute, per-hour limits
4. Update `check_limit` to check all tiers
5. Add configuration file support

**Acceptance Criteria**:
- [ ] Per-second limits enforced
- [ ] Per-minute limits enforced
- [ ] Per-hour limits enforced
- [ ] Method-specific limits work
- [ ] Sensitive methods have stricter limits

---

### Phase 2: Reliability Improvements (MEDIUM PRIORITY)

#### Task 2.1: Dynamic Port Assignment
**Priority**: MEDIUM  
**Complexity**: Low  
**Estimated Time**: 1-2 hours

**Current State**:
- ❌ Hardcoded port 8766
- ❌ Fails if port is in use
- ❌ Can't run multiple instances

**Implementation**:

```rust
// File: src-tauri/src/dapp/websocket.rs (NEW)

use tokio::net::TcpListener;

/// Find available port in range
pub async fn find_available_port(start: u16, end: u16) -> Option<u16> {
    for port in start..=end {
        if TcpListener::bind(("127.0.0.1", port)).await.is_ok() {
            return Some(port);
        }
    }
    None
}

/// Start WebSocket server on available port
pub async fn start_websocket_server(app_handle: tauri::AppHandle) -> Result<u16, String> {
    // Try to find available port
    let port = find_available_port(8766, 8800).await
        .ok_or("No available ports in range 8766-8800")?;
    
    println!("🔌 Starting WebSocket server on port {}...", port);
    
    // Start server (existing logic)
    // ...
    
    Ok(port)
}
```

**Changes Required**:
1. Create `src-tauri/src/dapp/websocket.rs`
2. Move WebSocket server logic from `lib.rs`
3. Implement port finding logic
4. Store port in `VaughanState`
5. Update provider script to try multiple ports
6. Add Tauri command to get WebSocket port

**Acceptance Criteria**:
- [ ] Finds available port automatically
- [ ] Falls back to next port if occupied
- [ ] Provider can discover port
- [ ] Multiple instances can run
- [ ] Port is logged on startup

---

#### Task 2.2: Health Checks & Monitoring
**Priority**: MEDIUM  
**Complexity**: Low  
**Estimated Time**: 2-3 hours

**Current State**:
- ❌ No health check endpoint
- ❌ No connection metrics
- ❌ No way to monitor server status

**Implementation**:

```rust
// File: src-tauri/src/dapp/health.rs (NEW)

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

/// Health metrics
#[derive(Debug, Clone, serde::Serialize)]
pub struct HealthMetrics {
    pub total_connections: u64,
    pub active_connections: u64,
    pub messages_processed: u64,
    pub errors: u64,
    pub uptime_seconds: u64,
}

/// Health monitor
pub struct HealthMonitor {
    total_connections: Arc<AtomicU64>,
    active_connections: Arc<AtomicU64>,
    messages_processed: Arc<AtomicU64>,
    errors: Arc<AtomicU64>,
    start_time: std::time::Instant,
}

impl HealthMonitor {
    pub fn new() -> Self {
        Self {
            total_connections: Arc::new(AtomicU64::new(0)),
            active_connections: Arc::new(AtomicU64::new(0)),
            messages_processed: Arc::new(AtomicU64::new(0)),
            errors: Arc::new(AtomicU64::new(0)),
            start_time: std::time::Instant::now(),
        }
    }
    
    pub fn connection_opened(&self) {
        self.total_connections.fetch_add(1, Ordering::Relaxed);
        self.active_connections.fetch_add(1, Ordering::Relaxed);
    }
    
    pub fn connection_closed(&self) {
        self.active_connections.fetch_sub(1, Ordering::Relaxed);
    }
    
    pub fn message_processed(&self) {
        self.messages_processed.fetch_add(1, Ordering::Relaxed);
    }
    
    pub fn error_occurred(&self) {
        self.errors.fetch_add(1, Ordering::Relaxed);
    }
    
    pub fn get_metrics(&self) -> HealthMetrics {
        HealthMetrics {
            total_connections: self.total_connections.load(Ordering::Relaxed),
            active_connections: self.active_connections.load(Ordering::Relaxed),
            messages_processed: self.messages_processed.load(Ordering::Relaxed),
            errors: self.errors.load(Ordering::Relaxed),
            uptime_seconds: self.start_time.elapsed().as_secs(),
        }
    }
}

// Tauri command
#[tauri::command]
pub async fn get_websocket_health(
    state: tauri::State<'_, VaughanState>,
) -> Result<HealthMetrics, String> {
    Ok(state.health_monitor.get_metrics())
}
```

**Changes Required**:
1. Create `src-tauri/src/dapp/health.rs`
2. Add `HealthMonitor` to `VaughanState`
3. Instrument WebSocket handler with metrics
4. Add Tauri command for health check
5. Create UI component to display metrics (optional)

**Acceptance Criteria**:
- [ ] Tracks total connections
- [ ] Tracks active connections
- [ ] Tracks messages processed
- [ ] Tracks errors
- [ ] Reports uptime
- [ ] Accessible via Tauri command

---

#### Task 2.3: Graceful Degradation (HTTP Fallback)
**Priority**: LOW  
**Complexity**: Medium  
**Estimated Time**: 4-6 hours

**Current State**:
- ❌ No fallback if WebSocket fails
- ❌ Fails completely in restricted environments

**Implementation**:

```javascript
// File: src/provider/provider-inject-extension.js (UPDATE)

class FallbackTransport {
  constructor() {
    this.wsConnected = false;
    this.wsCommunicator = new WebSocketCommunicator();
    this.httpCommunicator = new HttpCommunicator();
    
    // Try WebSocket first
    this.wsCommunicator.connect().then(() => {
      this.wsConnected = true;
      console.log('[Vaughan] Using WebSocket transport');
    }).catch(() => {
      console.warn('[Vaughan] WebSocket failed, falling back to HTTP');
      this.wsConnected = false;
    });
  }
  
  async sendRequest(method, params) {
    if (this.wsConnected) {
      try {
        return await this.wsCommunicator.sendRequest(method, params);
      } catch (error) {
        console.warn('[Vaughan] WebSocket request failed, trying HTTP');
        this.wsConnected = false;
      }
    }
    
    // Fallback to HTTP
    return await this.httpCommunicator.sendRequest(method, params);
  }
}

class HttpCommunicator {
  async sendRequest(method, params) {
    const response = await fetch('http://localhost:8765/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params
      })
    });
    
    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message);
    }
    return data.result;
  }
}
```

**Changes Required**:
1. Add HTTP RPC endpoint to proxy server
2. Update provider to support fallback
3. Implement HTTP polling for events
4. Add configuration for transport preference

**Acceptance Criteria**:
- [ ] Falls back to HTTP if WebSocket fails
- [ ] HTTP endpoint works for all methods
- [ ] Events work via polling
- [ ] Automatic retry to WebSocket
- [ ] User can configure preference

---

### Phase 3: Monitoring & Debugging (LOW PRIORITY)

#### Task 3.1: Structured Logging
**Priority**: LOW  
**Complexity**: Low  
**Estimated Time**: 2-3 hours

**Current State**:
- ⚠️ Basic println! logging
- ❌ No log levels
- ❌ No structured data
- ❌ Hard to filter/search

**Implementation**:

```rust
// Add to Cargo.toml
// tracing = "0.1"
// tracing-subscriber = "0.3"

// File: src-tauri/src/dapp/logging.rs (NEW)

use tracing::{info, warn, error, debug};

pub fn log_websocket_connection(addr: &str, window_label: &str) {
    info!(
        target: "websocket",
        addr = %addr,
        window_label = %window_label,
        "New WebSocket connection"
    );
}

pub fn log_rpc_request(method: &str, origin: &str, duration_ms: u64) {
    debug!(
        target: "rpc",
        method = %method,
        origin = %origin,
        duration_ms = %duration_ms,
        "RPC request processed"
    );
}

pub fn log_rate_limit_exceeded(origin: &str, method: &str) {
    warn!(
        target: "rate_limit",
        origin = %origin,
        method = %method,
        "Rate limit exceeded"
    );
}
```

**Changes Required**:
1. Add `tracing` dependencies
2. Initialize tracing subscriber
3. Replace println! with tracing macros
4. Add structured fields
5. Configure log levels
6. Add file output (optional)

**Acceptance Criteria**:
- [ ] All logs use tracing
- [ ] Logs have structured fields
- [ ] Log levels configurable
- [ ] Can filter by target
- [ ] Timestamps included

---

#### Task 3.2: Performance Profiling
**Priority**: LOW  
**Complexity**: Medium  
**Estimated Time**: 3-4 hours

**Current State**:
- ❌ No performance metrics
- ❌ Can't identify bottlenecks
- ❌ No request timing

**Implementation**:

```rust
// File: src-tauri/src/dapp/profiling.rs (NEW)

use std::time::Instant;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Request timing data
#[derive(Debug, Clone)]
pub struct RequestTiming {
    pub method: String,
    pub duration_ms: u64,
    pub timestamp: u64,
}

/// Performance profiler
pub struct Profiler {
    timings: Arc<RwLock<Vec<RequestTiming>>>,
    max_entries: usize,
}

impl Profiler {
    pub fn new(max_entries: usize) -> Self {
        Self {
            timings: Arc::new(RwLock::new(Vec::new())),
            max_entries,
        }
    }
    
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
            timings.drain(0..timings.len() - self.max_entries);
        }
    }
    
    pub async fn get_stats(&self) -> HashMap<String, MethodStats> {
        let timings = self.timings.read().await;
        let mut stats: HashMap<String, Vec<u64>> = HashMap::new();
        
        for timing in timings.iter() {
            stats.entry(timing.method.clone())
                .or_insert_with(Vec::new)
                .push(timing.duration_ms);
        }
        
        stats.into_iter().map(|(method, durations)| {
            let count = durations.len();
            let sum: u64 = durations.iter().sum();
            let avg = sum / count as u64;
            let max = *durations.iter().max().unwrap();
            let min = *durations.iter().min().unwrap();
            
            (method, MethodStats { count, avg, min, max })
        }).collect()
    }
}

#[derive(Debug, serde::Serialize)]
pub struct MethodStats {
    pub count: usize,
    pub avg: u64,
    pub min: u64,
    pub max: u64,
}
```

**Changes Required**:
1. Create `src-tauri/src/dapp/profiling.rs`
2. Add `Profiler` to `VaughanState`
3. Instrument RPC handler with timing
4. Add Tauri command to get stats
5. Create UI to display stats (optional)

**Acceptance Criteria**:
- [ ] Records request timing
- [ ] Calculates avg/min/max per method
- [ ] Keeps recent history
- [ ] Accessible via command
- [ ] Can export data

---

## 📊 Implementation Summary

### Effort Estimation

| Phase | Tasks | Total Hours | Priority |
|-------|-------|-------------|----------|
| **Phase 1: Security** | 3 | 14-19 hours | HIGH |
| **Phase 2: Reliability** | 3 | 7-11 hours | MEDIUM |
| **Phase 3: Monitoring** | 2 | 5-7 hours | LOW |
| **TOTAL** | 8 | 26-37 hours | - |

### Recommended Order

1. **Week 1**: Task 1.1 (Authentication) + Task 2.1 (Dynamic Ports)
2. **Week 2**: Task 1.3 (Enhanced Rate Limiting) + Task 2.2 (Health Checks)
3. **Week 3**: Task 1.2 (Message Signing)
4. **Week 4**: Task 3.1 (Logging) + Task 3.2 (Profiling)
5. **Week 5**: Task 2.3 (HTTP Fallback) - if needed

### Dependencies

```
Task 1.1 (Auth) ──┐
                  ├──> Task 1.2 (Signing)
Task 2.1 (Ports) ─┘

Task 2.2 (Health) ──> Task 3.2 (Profiling)

Task 3.1 (Logging) ──> All tasks (improves debugging)
```

---

## ✅ Acceptance Criteria (Overall)

### Security
- [ ] All connections authenticated
- [ ] All messages signed and verified
- [ ] Rate limits prevent abuse
- [ ] No unauthorized access possible

### Reliability
- [ ] Works on any available port
- [ ] Graceful degradation if WebSocket fails
- [ ] Health checks pass
- [ ] Handles connection failures

### Monitoring
- [ ] All events logged with structure
- [ ] Performance metrics available
- [ ] Can diagnose issues quickly
- [ ] Metrics exportable

---

## 🚀 Next Steps

1. **Review** this task list with team
2. **Prioritize** based on immediate needs
3. **Create** GitHub issues for each task
4. **Assign** tasks to developers
5. **Track** progress in project board
6. **Test** each enhancement thoroughly
7. **Document** new features

---

**Created**: 2026-02-10  
**Status**: Ready for Implementation  
**Estimated Completion**: 4-5 weeks (part-time)

