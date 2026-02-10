# WebSocket Bridge Implementation Plan

**Goal**: Direct connection to external dApps without QR codes or iframe limitations

**Status**: Starting implementation  
**Timeline**: 2-3 days

---

## 🎯 Architecture

```
External dApp Window (https://app.uniswap.org)
         ↓
Provider script injected via initialization_script
         ↓
WebSocket connection to ws://localhost:8766
         ↓
WebSocket server in Rust backend
         ↓
Existing dapp_request command
         ↓
Wallet core (already working ✅)
```

---

## 📋 Implementation Phases

### Phase 1: Backend (Day 1) - IN PROGRESS

**1.1 WebSocket Server** (`src-tauri/src/websocket/mod.rs`)
- [ ] Create WebSocket server module
- [ ] Listen on `ws://localhost:8766`
- [ ] Handle connections
- [ ] Parse JSON-RPC requests
- [ ] Call existing `dapp_request` logic
- [ ] Send responses back via WebSocket

**1.2 State Integration** (`src-tauri/src/state.rs`)
- [ ] Add WebSocket server to VaughanState
- [ ] Start server on app initialization
- [ ] Graceful shutdown

**1.3 Dependencies** (`Cargo.toml`)
- [x] Add `tokio-tungstenite` for WebSocket
- [x] Add `futures-util` for stream handling

### Phase 2: Provider Script (Day 2)

**2.1 WebSocket Provider** (`src/provider/provider-websocket.js`)
- [ ] Connect to `ws://localhost:8766`
- [ ] Implement EIP-1193 `request()` method
- [ ] Handle reconnection
- [ ] Event emitter for `accountsChanged`, `chainChanged`
- [ ] EIP-6963 announcement

**2.2 Connection Management**
- [ ] Auto-reconnect on disconnect
- [ ] Connection status indicator
- [ ] Error handling
- [ ] Request timeout (30 seconds)

### Phase 3: Browser UI (Day 2-3)

**3.1 Simple Browser** (`src/views/DappBrowserView/DappBrowserWebSocket.tsx`)
- [ ] Clean, simple UI
- [ ] URL input (with paste support!)
- [ ] Go button
- [ ] Connection status
- [ ] Open external window with provider injected

**3.2 Window Management**
- [ ] Use existing `open_dapp_window` command
- [ ] Inject WebSocket provider script
- [ ] Track open windows
- [ ] Handle window close

### Phase 4: Testing & Polish (Day 3)

**4.1 Test with Major dApps**
- [ ] Uniswap
- [ ] PulseX
- [ ] Aave
- [ ] Curve

**4.2 Edge Cases**
- [ ] Multiple windows
- [ ] Reconnection
- [ ] Network switching
- [ ] Account switching
- [ ] Transaction approval flow

**4.3 UI Polish**
- [ ] Loading states
- [ ] Error messages
- [ ] Connection indicators
- [ ] Better styling

---

## 🔧 Technical Details

### WebSocket Protocol

**Request Format**:
```json
{
  "id": "req-123",
  "method": "eth_requestAccounts",
  "params": []
}
```

**Response Format**:
```json
{
  "id": "req-123",
  "result": ["0x1234..."],
  "error": null
}
```

**Error Format**:
```json
{
  "id": "req-123",
  "result": null,
  "error": {
    "code": 4001,
    "message": "User rejected request"
  }
}
```

### Security Considerations

1. **Localhost Only**: WebSocket server only binds to `127.0.0.1`
2. **Origin Validation**: Check window origin before processing requests
3. **Rate Limiting**: Use existing rate limiter
4. **Session Management**: Use existing session system

### Advantages Over WalletConnect

- ✅ No QR codes
- ✅ Lower latency (~50ms vs ~500ms)
- ✅ Simpler UX
- ✅ Works offline
- ✅ Desktop-optimized

### Disadvantages

- ❌ Desktop only (no mobile)
- ❌ Same machine only
- ❌ We maintain it
- ❌ Custom solution

---

## 🚀 Current Progress

### ✅ Completed
- [x] Added WebSocket dependencies to Cargo.toml
- [x] Analyzed existing dApp infrastructure
- [x] Designed architecture

### 🔄 In Progress
- [ ] Creating WebSocket server module

### ⏳ Todo
- [ ] Provider script
- [ ] Browser UI
- [ ] Testing

---

## 📝 Files to Create/Modify

### New Files
- `src-tauri/src/websocket/mod.rs` - WebSocket server
- `src-tauri/src/websocket/handler.rs` - Request handler
- `src/provider/provider-websocket.js` - WebSocket provider
- `src/views/DappBrowserView/DappBrowserWebSocket.tsx` - New browser UI

### Modified Files
- `src-tauri/src/lib.rs` - Add websocket module
- `src-tauri/src/state.rs` - Add WebSocket server to state
- `src/App.tsx` - Add new route
- `src/views/WalletView/WalletView.tsx` - Update button

---

**Next**: Creating WebSocket server module...
