# Vaughan WebSocket Bridge - Complete Documentation

**Purpose**: Comprehensive guide to understanding how Vaughan's WebSocket bridge enables external dApps to interact with the wallet while bypassing CSP restrictions.

---

## 📚 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [File Structure](#file-structure)
4. [How It Works](#how-it-works)
5. [CSP Bypass Mechanism](#csp-bypass-mechanism)
6. [Message Flow](#message-flow)
7. [Code Walkthrough](#code-walkthrough)
8. [Testing](#testing)
9. [Troubleshooting](#troubleshooting)

---

## Overview

The WebSocket bridge is Vaughan's solution for enabling external dApps (like Uniswap) to interact with the wallet **without being blocked by Content Security Policy (CSP)** restrictions.

### The Problem

Modern dApps like Uniswap have strict CSP headers that block:
- ❌ Tauri IPC commands (`__TAURI__` is undefined)
- ❌ Custom protocol handlers
- ❌ Most injection techniques

### The Solution

**Extension-Style Provider Injection + WebSocket Bridge**

```
┌─────────────────────────────────────────────────────────────┐
│  External dApp (e.g., Uniswap)                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  window.ethereum (injected BEFORE CSP)               │   │
│  │  ↓                                                    │   │
│  │  WebSocket connection (ws://localhost:8766)          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Vaughan Wallet (Rust Backend)                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  WebSocket Server (port 8766)                        │   │
│  │  ↓                                                    │   │
│  │  RPC Handler (processes JSON-RPC requests)           │   │
│  │  ↓                                                    │   │
│  │  Wallet Core (signs transactions, manages accounts)  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Architecture

### 3 Core Components

1. **Provider Script** (`provider-inject-extension.js`)
   - Injected via Tauri's `initialization_script`
   - Runs BEFORE page loads, BEFORE CSP applies
   - Creates WebSocket connection to localhost:8766
   - Implements EIP-1193 provider interface

2. **WebSocket Server** (`lib.rs`)
   - Rust backend server listening on port 8766
   - Accepts connections from provider scripts
   - Processes JSON-RPC requests
   - Returns responses to dApps

3. **RPC Handler** (`rpc_handler.rs`)
   - Processes Ethereum JSON-RPC methods
   - Validates requests
   - Interacts with wallet core
   - Handles approvals (user confirmation)

---

## File Structure

```
Vaughan/
├── docs-websocket/                    # This documentation folder
│   ├── README.md                      # This file
│   ├── 01-provider-script.md          # Provider injection details
│   ├── 02-websocket-server.md         # Server implementation
│   ├── 03-rpc-handler.md              # Request processing
│   ├── 04-message-flow.md             # Complete message flow
│   └── 05-csp-bypass-explained.md     # CSP bypass mechanism
│
├── src/provider/
│   └── provider-inject-extension.js   # Provider script (injected)
│
├── src-tauri/src/
│   ├── lib.rs                         # WebSocket server (lines 265-370)
│   ├── dapp/
│   │   ├── rpc_handler.rs             # RPC request processing
│   │   ├── approval.rs                # User approval system
│   │   └── session.rs                 # Session management
│   └── commands/
│       └── window.rs                  # Window creation with injection
│
└── public/
    └── provider-inject-extension.js   # Copy for serving
```

---

## How It Works

### Step-by-Step Flow

#### 1. **Wallet Startup**
```rust
// lib.rs - WebSocket server starts when app launches
println!("🔌 Starting WebSocket server...");
TcpListener::bind("127.0.0.1:8766").await
```

#### 2. **Window Creation**
```rust
// window.rs - Provider script injected via initialization_script
let window = WebviewWindowBuilder::new(app, label, url)
    .initialization_script(PROVIDER_SCRIPT_EXTENSION)  // Runs BEFORE page loads!
    .build()?;
```

#### 3. **Provider Injection**
```javascript
// provider-inject-extension.js - Runs in privileged context
const ws = new WebSocket('ws://localhost:8766');  // CSP can't block this!
window.ethereum = new VaughanProvider(ws);        // Injected before page scripts
```

#### 4. **dApp Interaction**
```javascript
// Uniswap's code
const accounts = await window.ethereum.request({
    method: 'eth_requestAccounts'
});
```

#### 5. **WebSocket Communication**
```javascript
// Provider sends JSON-RPC request
ws.send(JSON.stringify({
    id: 1,
    jsonrpc: '2.0',
    method: 'eth_requestAccounts',
    params: []
}));
```

#### 6. **Backend Processing**
```rust
// WebSocket server receives request
let result = dapp::rpc_handler::handle_request(
    state,
    "websocket",
    "external",
    "eth_requestAccounts",
    []
).await;
```

#### 7. **Response**
```rust
// Server sends response back
let response = json!({
    "id": 1,
    "jsonrpc": "2.0",
    "result": ["0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"]
});
write.send(Message::Text(response.to_string())).await;
```

---

## CSP Bypass Mechanism

### Why This Works

**Key Insight**: Tauri's `initialization_script` runs in a **privileged context** BEFORE the page loads and BEFORE CSP is applied.

```
Timeline:
┌─────────────────────────────────────────────────────────┐
│ 1. Window created                                       │
│ 2. initialization_script runs (privileged context)      │
│    → Provider injected                                  │
│    → WebSocket connection established                   │
│ 3. Page loads                                           │
│ 4. CSP applied (but connection already exists!)         │
│ 5. Page scripts run (can use window.ethereum)           │
└─────────────────────────────────────────────────────────┘
```

### CSP Error is EXPECTED

When you see this in the console:
```
Refused to connect to 'ws://localhost:8766/' because it violates the following 
Content Security Policy directive: "connect-src 'self' https://..."
```

**This is NORMAL and EXPECTED!** It appears AFTER the connection succeeds. The CSP violation is reported, but the connection is already established and working.

### Proof It Works

Look for these logs:
```
[Vaughan-Ext] Connecting to WebSocket...
[Vaughan-Ext] Connected! ✅
[Vaughan-Ext] Provider initialized with chainId: 0x171
```

If you see these, the bypass worked! The CSP error appears after because the browser is reporting the violation, but it can't block what already happened.

---

## Message Flow

### Complete Request/Response Cycle

```
┌──────────────────────────────────────────────────────────────┐
│ 1. dApp calls window.ethereum.request()                      │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ 2. Provider creates JSON-RPC request                         │
│    {                                                          │
│      "id": 1,                                                 │
│      "jsonrpc": "2.0",                                        │
│      "method": "eth_requestAccounts",                         │
│      "params": []                                             │
│    }                                                          │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ 3. WebSocket sends to localhost:8766                         │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ 4. Rust WebSocket server receives                            │
│    - Parses JSON                                              │
│    - Extracts method and params                               │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ 5. RPC Handler processes request                             │
│    - Validates method                                         │
│    - Checks permissions                                       │
│    - Calls wallet core                                        │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ 6. Wallet core executes                                       │
│    - Gets accounts                                            │
│    - Signs transactions                                       │
│    - Queries blockchain                                       │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ 7. Response sent back                                         │
│    {                                                          │
│      "id": 1,                                                 │
│      "jsonrpc": "2.0",                                        │
│      "result": ["0x742d35Cc..."]                              │
│    }                                                          │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ 8. Provider resolves promise                                 │
│    - dApp receives result                                     │
│    - Updates UI                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## Code Walkthrough

See individual documentation files:

1. **[01-provider-script.md](./01-provider-script.md)** - Provider injection and WebSocket client
2. **[02-websocket-server.md](./02-websocket-server.md)** - Rust WebSocket server implementation
3. **[03-rpc-handler.md](./03-rpc-handler.md)** - JSON-RPC request processing
4. **[04-message-flow.md](./04-message-flow.md)** - Detailed message flow diagrams
5. **[05-csp-bypass-explained.md](./05-csp-bypass-explained.md)** - Deep dive into CSP bypass

---

## Testing

### Test with Uniswap

1. **Start Vaughan Wallet**
   ```bash
   cd Vaughan
   npm run tauri dev
   ```

2. **Create/Unlock Wallet**
   - Password: `test123` or `1234`

3. **Open Uniswap**
   - Click "Test Uniswap (Direct Window)" button
   - Or use: `invoke('open_dapp_window', { url: 'https://app.uniswap.org' })`

4. **Check Console Logs**
   ```
   ✅ Expected logs:
   [Vaughan-Ext] Connecting to WebSocket...
   [Vaughan-Ext] Connected! ✅
   [Vaughan-Ext] Provider initialized with chainId: 0x171
   
   ⚠️ Expected CSP error (IGNORE THIS):
   Refused to connect to 'ws://localhost:8766/'...
   ```

5. **Connect Wallet**
   - Click "Connect Wallet" in Uniswap
   - Should see Vaughan in the list
   - Approve connection in Vaughan wallet

### Test with Simple dApp

```html
<!-- test.html -->
<!DOCTYPE html>
<html>
<body>
  <button onclick="connect()">Connect</button>
  <script>
    async function connect() {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });
      console.log('Connected:', accounts);
    }
  </script>
</body>
</html>
```

---

## Troubleshooting

### Issue: "WebSocket not connected"

**Cause**: WebSocket server not running or connection failed

**Fix**:
1. Restart Vaughan wallet
2. Check console for "✅ WebSocket server started on ws://127.0.0.1:8766"
3. Verify no other app is using port 8766

### Issue: "window.ethereum is undefined"

**Cause**: Provider script not injected

**Fix**:
1. Verify window created with `open_dapp_window` command
2. Check `window.rs` uses `PROVIDER_SCRIPT_EXTENSION`
3. Restart app (initialization_script only runs on window creation)

### Issue: CSP errors in console

**Status**: ✅ **EXPECTED AND NORMAL**

**Explanation**: CSP error appears AFTER connection succeeds. If you see connection logs, it's working!

### Issue: Requests timeout

**Cause**: RPC handler error or approval not responded to

**Fix**:
1. Check Rust console for errors
2. Verify approval modal appears
3. Check approval queue: `state.approval_queue`

---

## Key Takeaways

1. **initialization_script is the key** - Runs before CSP, in privileged context
2. **WebSocket bypasses CSP** - Connection established before CSP applies
3. **CSP error is expected** - Appears after connection succeeds
4. **EIP-1193 compliant** - Works with all dApps expecting MetaMask
5. **Secure** - Only localhost connections, approval system for sensitive operations

---

## Next Steps

- Read detailed documentation in numbered files (01-05)
- Study the code with inline comments
- Test with different dApps
- Understand the approval flow
- Learn about EIP-1193 and EIP-6963 standards

---

**Last Updated**: 2026-02-10
**Version**: 1.0
**Status**: Production Ready ✅
