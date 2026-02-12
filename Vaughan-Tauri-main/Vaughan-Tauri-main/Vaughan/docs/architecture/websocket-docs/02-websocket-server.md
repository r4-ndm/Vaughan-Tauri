# WebSocket Server - Rust Backend

**File**: `src-tauri/src/lib.rs` (lines 265-370)

**Purpose**: WebSocket server that accepts connections from provider scripts and processes JSON-RPC requests.

---

## Overview

The WebSocket server is the bridge between external dApps and the Vaughan wallet backend. It:
1. Listens on `ws://127.0.0.1:8766`
2. Accepts connections from provider scripts
3. Processes JSON-RPC requests
4. Returns responses to dApps

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  WebSocket Server (Rust)                                │
│                                                          │
│  ┌────────────────────────────────────────────────┐     │
│  │  TcpListener (port 8766)                       │     │
│  │  - Accepts incoming connections                │     │
│  │  - Spawns handler per connection               │     │
│  └────────────────────────────────────────────────┘     │
│                      ↓                                   │
│  ┌────────────────────────────────────────────────┐     │
│  │  Connection Handler (per client)               │     │
│  │  - Upgrades to WebSocket                       │     │
│  │  - Splits into read/write streams              │     │
│  │  - Processes messages                          │     │
│  └────────────────────────────────────────────────┘     │
│                      ↓                                   │
│  ┌────────────────────────────────────────────────┐     │
│  │  Message Processor                             │     │
│  │  - Parses JSON-RPC                             │     │
│  │  - Calls RPC handler                           │     │
│  │  - Builds response                             │     │
│  └────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation

### 1. Server Startup

```rust
// lib.rs - In the app setup function
println!("🔌 Starting WebSocket server...");
let app_handle = app.handle().clone();

tauri::async_runtime::spawn(async move {
    use tokio::net::TcpListener;
    use tokio_tungstenite::accept_async;
    use futures_util::{StreamExt, SinkExt};
    
    match TcpListener::bind("127.0.0.1:8766").await {
        Ok(listener) => {
            println!("✅ WebSocket server started on ws://127.0.0.1:8766");
            
            // Accept connections loop
            loop {
                match listener.accept().await {
                    Ok((stream, addr)) => {
                        println!("[WebSocket] New connection from: {}", addr);
                        let app_handle_clone = app_handle.clone();
                        
                        // Spawn handler for this connection
                        tokio::spawn(async move {
                            handle_connection(app_handle_clone, stream, addr).await;
                        });
                    }
                    Err(e) => {
                        eprintln!("[WebSocket] Failed to accept connection: {}", e);
                    }
                }
            }
        }
        Err(e) => {
            eprintln!("❌ Failed to start WebSocket server: {}", e);
        }
    }
});
```

**Key Points**:
- Runs in separate async task (doesn't block app startup)
- Binds to localhost only (security)
- Spawns new task per connection (concurrent handling)
- Infinite loop accepts connections

---

### 2. Connection Handler

```rust
async fn handle_connection(
    app_handle: AppHandle,
    stream: TcpStream,
    addr: SocketAddr
) {
    // Get state from app handle
    let state = app_handle.state::<state::VaughanState>();
    let state_ref: &state::VaughanState = &*state;
    
    // Upgrade TCP stream to WebSocket
    match accept_async(stream).await {
        Ok(ws_stream) => {
            println!("[WebSocket] Connection upgraded: {}", addr);
            
            // Split into read and write streams
            let (mut write, mut read) = ws_stream.split();
            
            // Process messages
            while let Some(msg_result) = read.next().await {
                match msg_result {
                    Ok(msg) => {
                        if let Message::Text(text) = msg {
                            // Process text message
                            let response = process_message(state_ref, &text).await;
                            
                            // Send response
                            let _ = write.send(Message::Text(response)).await;
                        }
                    }
                    Err(e) => {
                        println!("[WebSocket] Error receiving message: {}", e);
                        break;
                    }
                }
            }
            
            println!("[WebSocket] Connection closed: {}", addr);
        }
        Err(e) => {
            println!("[WebSocket] Failed to accept connection: {}", e);
        }
    }
}
```

**Key Points**:
- Gets `VaughanState` from app handle (access to wallet)
- Upgrades TCP to WebSocket protocol
- Splits stream for concurrent read/write
- Loops until connection closes
- Handles errors gracefully

---

### 3. Message Processing

```rust
async fn process_message(
    state: &VaughanState,
    text: &str
) -> String {
    println!("[WebSocket] Received: {}", text);
    
    // Parse JSON-RPC request
    match serde_json::from_str::<serde_json::Value>(text) {
        Ok(request) => {
            let id = request["id"].clone();
            let method = request["method"].as_str().unwrap_or("");
            let params = request["params"]
                .as_array()
                .cloned()
                .unwrap_or_default();
            
            // Process request using RPC handler
            let result = dapp::rpc_handler::handle_request(
                state,
                "websocket",  // window_label
                "external",   // origin
                method,
                params
            ).await;
            
            // Build response
            let response = match result {
                Ok(value) => serde_json::json!({
                    "id": id,
                    "jsonrpc": "2.0",
                    "result": value
                }),
                Err(e) => serde_json::json!({
                    "id": id,
                    "jsonrpc": "2.0",
                    "error": {
                        "code": -32000,
                        "message": e.to_string()
                    }
                })
            };
            
            println!("[WebSocket] Response: {}", response);
            response.to_string()
        }
        Err(e) => {
            println!("[WebSocket] Failed to parse request: {}", e);
            
            // Return parse error
            serde_json::json!({
                "id": null,
                "jsonrpc": "2.0",
                "error": {
                    "code": -32700,
                    "message": "Parse error"
                }
            }).to_string()
        }
    }
}
```

**Key Points**:
- Parses JSON-RPC format
- Extracts `id`, `method`, `params`
- Calls existing RPC handler (code reuse!)
- Builds JSON-RPC response
- Handles parse errors

---

## JSON-RPC Format

### Request Format

```json
{
    "id": 1,
    "jsonrpc": "2.0",
    "method": "eth_requestAccounts",
    "params": []
}
```

**Fields**:
- `id` - Request identifier (number or string)
- `jsonrpc` - Protocol version (always "2.0")
- `method` - RPC method name
- `params` - Array of parameters

### Success Response

```json
{
    "id": 1,
    "jsonrpc": "2.0",
    "result": ["0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"]
}
```

**Fields**:
- `id` - Same as request
- `jsonrpc` - Protocol version
- `result` - Method result (any JSON value)

### Error Response

```json
{
    "id": 1,
    "jsonrpc": "2.0",
    "error": {
        "code": -32000,
        "message": "User rejected request"
    }
}
```

**Fields**:
- `id` - Same as request (or null if parse error)
- `jsonrpc` - Protocol version
- `error` - Error object with code and message

---

## Error Codes

Standard JSON-RPC error codes:

```rust
// Parse error
-32700  // Invalid JSON

// Invalid request
-32600  // Not a valid JSON-RPC request

// Method not found
-32601  // Method doesn't exist

// Invalid params
-32602  // Invalid method parameters

// Internal error
-32603  // Internal JSON-RPC error

// Server error
-32000 to -32099  // Application-specific errors
```

**Vaughan-Specific Errors**:
```rust
-32000  // Generic wallet error
-32001  // User rejected request
-32002  // Wallet locked
-32003  // Invalid address
-32004  // Insufficient funds
```

---

## State Management

### Accessing VaughanState

```rust
// Get state from app handle
let state = app_handle.state::<state::VaughanState>();
let state_ref: &state::VaughanState = &*state;
```

**Why the deref?**
- `app_handle.state()` returns `State<VaughanState>`
- RPC handler expects `&VaughanState`
- `&*state` dereferences State wrapper to get reference

### State Contents

```rust
pub struct VaughanState {
    pub wallet_service: Arc<Mutex<WalletService>>,
    pub session_manager: Arc<SessionManager>,
    pub approval_queue: Arc<ApprovalQueue>,
    pub window_registry: Arc<WindowRegistry>,
    pub rate_limiter: Arc<RateLimiter>,
}
```

**Used For**:
- `wallet_service` - Sign transactions, manage accounts
- `session_manager` - Track dApp sessions
- `approval_queue` - User approval requests
- `window_registry` - Track dApp windows
- `rate_limiter` - Prevent abuse

---

## Concurrency

### Multiple Connections

```rust
// Each connection gets its own task
tokio::spawn(async move {
    handle_connection(app_handle_clone, stream, addr).await;
});
```

**Benefits**:
- Multiple dApps can connect simultaneously
- One slow dApp doesn't block others
- Connection failures are isolated

### Shared State

```rust
// State is wrapped in Arc (atomic reference counting)
pub struct VaughanState {
    pub wallet_service: Arc<Mutex<WalletService>>,
    // ...
}
```

**Thread Safety**:
- `Arc` - Multiple tasks can share state
- `Mutex` - Only one task modifies at a time
- `RwLock` - Multiple readers, single writer (for read-heavy data)

---

## Security Considerations

### 1. Localhost Only

```rust
TcpListener::bind("127.0.0.1:8766").await
```

**Why?**
- Only accepts connections from same machine
- External attackers can't connect
- No network exposure

### 2. Origin Validation

```rust
dapp::rpc_handler::handle_request(
    state,
    "websocket",
    "external",  // Origin tracked
    method,
    params
).await
```

**Why?**
- RPC handler knows request is from external source
- Can apply different security rules
- Tracks which dApp made request

### 3. Rate Limiting

```rust
// In RPC handler
state.rate_limiter.check_rate_limit(window_label, method)?;
```

**Why?**
- Prevents abuse (spam requests)
- Protects wallet performance
- Limits resource usage

### 4. Approval System

```rust
// Sensitive operations require user approval
let (id, rx) = state.approval_queue.add_request(
    window_label.to_string(),
    request_type
).await?;

// Wait for user response
let response = rx.await?;
```

**Why?**
- User must approve transactions
- User must approve account access
- Prevents unauthorized actions

---

## Testing

### Test Server Startup

```bash
# Start app
cd Vaughan
npm run tauri dev

# Look for log
✅ WebSocket server started on ws://127.0.0.1:8766
```

### Test Connection

```javascript
// Browser console
const ws = new WebSocket('ws://localhost:8766');
ws.onopen = () => console.log('Connected!');
ws.onmessage = (e) => console.log('Response:', e.data);
```

### Test Request

```javascript
// Send JSON-RPC request
ws.send(JSON.stringify({
    id: 1,
    jsonrpc: '2.0',
    method: 'eth_chainId',
    params: []
}));

// Expected response:
// {"id":1,"jsonrpc":"2.0","result":"0x171"}
```

---

## Debugging

### Enable Verbose Logging

```rust
// Add more println! statements
println!("[WebSocket] Processing method: {}", method);
println!("[WebSocket] Params: {:?}", params);
println!("[WebSocket] Result: {:?}", result);
```

### Check Connection State

```rust
// Log connection lifecycle
println!("[WebSocket] Connection opened: {}", addr);
println!("[WebSocket] Message received: {}", text);
println!("[WebSocket] Connection closed: {}", addr);
```

### Monitor Active Connections

```rust
// Track active connections (optional)
static ACTIVE_CONNECTIONS: AtomicUsize = AtomicUsize::new(0);

// On connect
ACTIVE_CONNECTIONS.fetch_add(1, Ordering::SeqCst);
println!("[WebSocket] Active connections: {}", 
    ACTIVE_CONNECTIONS.load(Ordering::SeqCst));

// On disconnect
ACTIVE_CONNECTIONS.fetch_sub(1, Ordering::SeqCst);
```

---

## Performance Considerations

### Message Size Limits

```rust
// Limit message size to prevent memory exhaustion
const MAX_MESSAGE_SIZE: usize = 1024 * 1024; // 1MB

if text.len() > MAX_MESSAGE_SIZE {
    return error_response("Message too large");
}
```

### Connection Limits

```rust
// Limit concurrent connections
const MAX_CONNECTIONS: usize = 10;

if ACTIVE_CONNECTIONS.load(Ordering::SeqCst) >= MAX_CONNECTIONS {
    // Reject new connection
    return;
}
```

### Timeout Handling

```rust
// Timeout idle connections
tokio::time::timeout(
    Duration::from_secs(300),  // 5 minutes
    read.next()
).await
```

---

## Key Takeaways

1. **Localhost only** - Security by default
2. **Concurrent handling** - Multiple dApps supported
3. **JSON-RPC standard** - Industry standard protocol
4. **Shared state** - Arc + Mutex for thread safety
5. **Error handling** - Graceful degradation
6. **Approval system** - User control over sensitive operations
7. **Rate limiting** - Prevents abuse

---

**Next**: [03-rpc-handler.md](./03-rpc-handler.md) - JSON-RPC request processing
