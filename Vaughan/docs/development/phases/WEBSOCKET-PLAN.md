# WebSocket Bridge - Implementation Plan

**Goal**: Get external dApps working with direct WebSocket communication  
**Timeline**: 2-3 hours  
**Approach**: Simple, pragmatic, get it working first

---

## 🎯 Current Status

### ✅ What's Done
- Frontend UI (100%)
- Provider script (100%)
- Navigation/routing (100%)
- Dependencies added (100%)

### ❌ What's Broken
- Rust module not compiling
- WebSocket server not implemented

### 🔍 The Problem
Rust can't find the `start_websocket_server` function even though it's defined. This is likely a module system issue or caching problem.

---

## 📋 Plan A: Fix Module Issue (30 minutes)

### Step 1: Try Inline Implementation
Instead of a separate module, put WebSocket code directly in `lib.rs`.

**Why**: Avoids module system issues entirely.

**How**:
1. Remove `pub mod websocket;` from lib.rs
2. Delete `src/websocket/` folder
3. Add WebSocket code directly in lib.rs setup function
4. Use existing dependencies

### Step 2: Minimal WebSocket Server
Don't try to be fancy - just get it working.

```rust
// In lib.rs setup function
tauri::async_runtime::spawn(async {
    use tokio::net::TcpListener;
    use tokio_tungstenite::accept_async;
    
    let listener = TcpListener::bind("127.0.0.1:8766").await.unwrap();
    println!("[WebSocket] Server started on ws://127.0.0.1:8766");
    
    loop {
        if let Ok((stream, _)) = listener.accept().await {
            tokio::spawn(async move {
                if let Ok(ws) = accept_async(stream).await {
                    // Handle connection
                    println!("[WebSocket] Client connected");
                }
            });
        }
    }
});
```

### Step 3: Test Connection
1. Start app
2. Check console for "Server started"
3. Provider should connect
4. See "Client connected" message

**Success Criteria**: Provider connects, we see logs.

---

## 📋 Plan B: Use HTTP Instead (1 hour)

If WebSocket continues to be problematic, use HTTP polling instead.

### Why HTTP?
- Simpler than WebSocket
- No module issues
- Easier to debug
- Still works fine

### How It Works
```
Provider (JavaScript)
    ↓
POST to http://localhost:8766/rpc
    ↓
Rust HTTP server
    ↓
Process request
    ↓
Return JSON response
```

### Implementation
1. Use existing `axum` dependency (already in Cargo.toml)
2. Create simple HTTP endpoint
3. Provider uses `fetch()` instead of WebSocket
4. Works exactly the same from dApp perspective

**Advantages**:
- Simpler
- No connection management
- Easier to debug
- Proven to work (proxy already uses HTTP)

---

## 📋 Plan C: Hybrid Approach (2 hours)

Use the existing proxy server infrastructure.

### Why?
- Proxy server already works
- Already has HTTP handling
- Just add RPC endpoint
- Minimal new code

### How
1. Add `/rpc` endpoint to existing proxy
2. Provider connects to `http://localhost:8765/rpc`
3. Reuse all existing infrastructure
4. No new server needed

**File**: `src-tauri/src/proxy/mod.rs` (already exists)

---

## 🎯 Recommended Approach

### Phase 1: Try Plan A (30 min)
**Inline WebSocket in lib.rs**

**Pros**:
- Cleanest solution
- Best performance
- Proper WebSocket

**Cons**:
- Might hit same module issue
- More complex

### Phase 2: If Plan A Fails, Use Plan B (1 hour)
**HTTP polling**

**Pros**:
- Guaranteed to work
- Simple
- Easy to debug

**Cons**:
- Slightly higher latency
- More HTTP overhead

### Phase 3: Polish (30 min)
Once basic communication works:
- Connect to existing RPC handler
- Test all methods
- Handle errors properly

---

## 🔧 Implementation Steps

### Step 1: Clean Up (5 min)
```bash
# Remove problematic websocket module
rm -rf src-tauri/src/websocket
```

Remove from lib.rs:
```rust
// Delete this line
pub mod websocket;
```

### Step 2: Add Inline WebSocket (15 min)
In `lib.rs` setup function, add:

```rust
// Start WebSocket server inline
println!("🔌 Starting WebSocket server...");
tauri::async_runtime::spawn(async {
    use tokio::net::TcpListener;
    use tokio_tungstenite::{accept_async, tungstenite::Message};
    use futures_util::{StreamExt, SinkExt};
    
    let listener = TcpListener::bind("127.0.0.1:8766")
        .await
        .expect("Failed to bind WebSocket server");
    
    println!("✅ WebSocket server started on ws://127.0.0.1:8766");
    
    loop {
        if let Ok((stream, addr)) = listener.accept().await {
            println!("[WebSocket] New connection from: {}", addr);
            
            tokio::spawn(async move {
                if let Ok(ws_stream) = accept_async(stream).await {
                    let (mut write, mut read) = ws_stream.split();
                    
                    while let Some(Ok(msg)) = read.next().await {
                        if let Message::Text(text) = msg {
                            println!("[WebSocket] Received: {}", text);
                            
                            // Echo back for now
                            let response = format!(r#"{{"id":"test","result":"ok"}}"#);
                            let _ = write.send(Message::Text(response)).await;
                        }
                    }
                }
            });
        }
    }
});
```

### Step 3: Test (5 min)
1. Compile: `cargo build`
2. Run: `npm run tauri dev`
3. Check console for "WebSocket server started"
4. Open dApp browser
5. Check browser console for connection

### Step 4: Connect to RPC Handler (5 min)
Replace echo with actual RPC handling:

```rust
// Parse request
let request: serde_json::Value = serde_json::from_str(&text).unwrap();
let method = request["method"].as_str().unwrap();
let params = request["params"].as_array().unwrap();

// Call existing dapp_request command
// (This is the key - reuse existing logic!)
let result = process_dapp_request(method, params).await;

// Send response
let response = serde_json::json!({
    "id": request["id"],
    "result": result
});
let _ = write.send(Message::Text(response.to_string())).await;
```

---

## 🎯 Success Criteria

### Milestone 1: Connection Works
- [ ] Server starts without errors
- [ ] Provider connects
- [ ] See connection logs
- [ ] Can send/receive messages

### Milestone 2: RPC Works
- [ ] Can call `eth_chainId`
- [ ] Can call `eth_requestAccounts`
- [ ] Approval modal appears
- [ ] Can approve/reject

### Milestone 3: Full Integration
- [ ] All RPC methods work
- [ ] Transactions work
- [ ] Signing works
- [ ] Works with Uniswap

---

## 🚀 Let's Start

**Next Action**: Try Plan A - Inline WebSocket

1. Remove websocket module
2. Add inline code to lib.rs
3. Test compilation
4. Test connection

**Time Estimate**: 30 minutes to working connection

**Fallback**: If it doesn't work, switch to Plan B (HTTP) which is guaranteed to work.

---

## 📝 Notes

- Keep it simple
- Get it working first
- Optimize later
- Don't fight Rust's module system
- Inline is fine for now

**Ready to implement?** Let's start with Step 1!
