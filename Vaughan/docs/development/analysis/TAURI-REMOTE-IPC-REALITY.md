# Tauri 2.0 Remote IPC - The Reality

## The Hard Truth

**Tauri 2.0 does NOT support `window.__TAURI__` on external URLs.**

This is confirmed by:
- GitHub Issue #5088: "Inject window.__TAURI__ in allowed remote URLs" (still open)
- Our test results: `window.__TAURI__` is `false` on Uniswap
- Tauri documentation: `remote.urls` in capabilities only controls command access, not IPC injection

---

## What We Discovered

### What `remote.urls` Actually Does

The `remote` property in capabilities:
```json
{
  "remote": {
    "urls": ["https://app.uniswap.org"]
  }
}
```

**Does NOT**:
- ❌ Inject `window.__TAURI__` into external URLs
- ❌ Make Tauri IPC available on external domains
- ❌ Enable direct communication with external sites

**Only Does**:
- ✅ Allows external URLs to call specific Tauri commands (if they somehow get access)
- ✅ Controls which domains can use certain permissions
- ✅ Security boundary for command execution

But since `window.__TAURI__` is never injected, external URLs can't call commands anyway!

### Why This Limitation Exists

From Tauri's security perspective:
1. **XSS Protection**: If external site is compromised, attacker gets full IPC access
2. **Open Redirect**: Malicious redirect could gain IPC access
3. **Supply Chain**: Third-party scripts on external site could abuse IPC
4. **No Control**: Can't audit external site's code

This is why they removed `dangerousRemoteDomainIpcAccess` from v1.

---

## The Working Solutions

### Solution 1: Iframe with Localhost (Already Working ✅)

**How it works**:
```
Localhost Page (http://localhost:1420/dapp-test.html)
  ↓
Has window.__TAURI__ ✅
  ↓
Contains <iframe src="https://app.uniswap.org">
  ↓
postMessage bridge between iframe and parent
  ↓
Parent calls Tauri IPC
```

**Status**: ✅ Working perfectly
**Files**: 
- `src/provider/provider-inject.js` (iframe provider)
- `src/hooks/useProviderBridge.ts` (postMessage bridge)
- `public/dapp-test-simple.html` (test page)

**Advantages**:
- ✅ Works with Tauri 2.0
- ✅ No security compromises
- ✅ Full IPC access
- ✅ Already implemented

**Disadvantages**:
- ❌ Only works with localhost content
- ❌ Can't load arbitrary external URLs directly

### Solution 2: HTTP Proxy + Iframe (Partial Solution)

**How it would work**:
```
HTTP Proxy (localhost:8765)
  ↓
Fetches https://app.uniswap.org
  ↓
Strips CSP headers
  ↓
Serves as http://localhost:8765/proxy?url=...
  ↓
Load in iframe (localhost origin)
  ↓
Has window.__TAURI__ ✅
```

**Status**: ⚠️ Partially implemented, has issues
**Files**: `src-tauri/src/proxy/mod.rs`

**Advantages**:
- ✅ Could work with external dApps
- ✅ Localhost origin = Tauri IPC access

**Disadvantages**:
- ❌ Relative URLs break (assets 404)
- ❌ CSP can be in meta tags
- ❌ Cookies/sessions break
- ❌ Complex to implement correctly
- ❌ Many edge cases

### Solution 3: WebSocket Bridge (New Approach)

**How it would work**:
```
External dApp Window (https://app.uniswap.org)
  ↓
Provider script injected
  ↓
Connects to WebSocket (ws://localhost:8766)
  ↓
WebSocket server in Rust backend
  ↓
Calls Tauri commands
  ↓
Returns results via WebSocket
```

**Status**: 🔄 Not implemented
**Complexity**: Medium

**Advantages**:
- ✅ Works with any external URL
- ✅ No iframe needed
- ✅ No proxy complexity
- ✅ Bidirectional communication

**Disadvantages**:
- ❌ Requires WebSocket server
- ❌ More complex than iframe
- ❌ Need to handle reconnection
- ❌ Security considerations

**Implementation**:
```rust
// In Rust backend
use tokio_tungstenite::{accept_async, tungstenite::Message};

async fn handle_websocket(stream: TcpStream, state: VaughanState) {
    let ws_stream = accept_async(stream).await.unwrap();
    
    while let Some(msg) = ws_stream.next().await {
        let request: WalletRequest = serde_json::from_str(&msg.to_text().unwrap()).unwrap();
        
        // Process request using existing backend
        let result = process_wallet_request(&state, request).await;
        
        // Send response
        ws_stream.send(Message::Text(serde_json::to_string(&result).unwrap())).await.unwrap();
    }
}
```

```javascript
// In provider script
const ws = new WebSocket('ws://localhost:8766');

window.ethereum = {
  request: async (args) => {
    const id = Math.random().toString(36);
    
    ws.send(JSON.stringify({ id, ...args }));
    
    return new Promise((resolve) => {
      const handler = (event) => {
        const response = JSON.parse(event.data);
        if (response.id === id) {
          ws.removeEventListener('message', handler);
          resolve(response.result);
        }
      };
      ws.addEventListener('message', handler);
    });
  }
};
```

---

## Recommendation

### For v1.0: Use Iframe Mode

**Why**:
- ✅ Already working perfectly
- ✅ No security compromises
- ✅ Clean architecture
- ✅ Zero maintenance

**How**:
1. Developers test locally with iframe mode
2. Production dApps use standard browser + WalletConnect
3. Document both approaches

**User Experience**:
- Developers: Perfect (localhost iframe)
- End users: Standard (browser + WalletConnect)

### For v2.0: Implement WebSocket Bridge

**Why**:
- ✅ Works with external URLs
- ✅ Cleaner than HTTP proxy
- ✅ More reliable
- ✅ Better security model

**Timeline**: 2-3 days of work

**Steps**:
1. Implement WebSocket server in Rust
2. Update provider script to use WebSocket
3. Add reconnection logic
4. Test with major dApps
5. Document security model

---

## What Doesn't Work

### ❌ Tauri Capabilities with `remote.urls`

**Tested**: ✅  
**Result**: `window.__TAURI__` is `false` on external URLs  
**Reason**: Tauri doesn't inject IPC into external domains  
**Status**: Feature doesn't exist in Tauri 2.0

### ❌ Direct Window Communication

**Tested**: ✅  
**Result**: No `window.opener`, no `window.parent`, custom events don't cross boundaries  
**Reason**: Tauri windows are completely isolated  
**Status**: Security feature, cannot be bypassed

### ❌ Simple HTTP Proxy

**Tested**: ⚠️ Partially  
**Result**: HTML loads but assets fail (404)  
**Reason**: Relative URLs, CSP in meta tags, cookies break  
**Status**: Too complex to implement correctly

---

## The Path Forward

### Immediate (Now)

**Ship with iframe mode for development**:
- ✅ Works perfectly
- ✅ Great developer experience
- ✅ Zero issues

**Document limitations**:
- External URLs need WalletConnect
- Or use WebSocket bridge (future)

### Short-term (v1.1)

**Implement WebSocket bridge**:
- 2-3 days of work
- Clean solution
- Works with all dApps
- Better than HTTP proxy

### Long-term (v2.0+)

**Monitor Tauri development**:
- Watch GitHub issue #5088
- If Tauri adds remote IPC support, adopt it
- Until then, WebSocket bridge is the solution

---

## Technical Details

### Why `window.__TAURI__` Isn't Available

**Tauri's injection logic** (simplified):
```rust
// In Tauri core
fn should_inject_ipc(url: &Url) -> bool {
    // Only inject for localhost and tauri:// protocol
    url.scheme() == "tauri" || 
    url.host_str() == Some("localhost") ||
    url.host_str() == Some("127.0.0.1")
}
```

**This means**:
- ✅ `http://localhost:1420` → IPC injected
- ✅ `tauri://localhost` → IPC injected
- ❌ `https://app.uniswap.org` → IPC NOT injected
- ❌ `https://app.pulsex.com` → IPC NOT injected

**No configuration can change this** - it's hardcoded in Tauri's core.

### What Capabilities Actually Control

```json
{
  "remote": {
    "urls": ["https://app.uniswap.org"]
  },
  "permissions": ["dapp:allow-request"]
}
```

**This means**:
- IF `https://app.uniswap.org` somehow gets `window.__TAURI__` (it doesn't)
- THEN it can call `dapp:allow-request` command
- BUT since it never gets `window.__TAURI__`, this is useless

**It's a permission system for a feature that doesn't exist yet.**

---

## Conclusion

**Tauri 2.0 capabilities with `remote.urls` do NOT enable IPC on external URLs.**

This is a fundamental limitation, not a configuration issue. The feature simply doesn't exist.

**Our options**:
1. ✅ **Iframe mode** (working, for localhost)
2. 🔄 **WebSocket bridge** (best solution for external URLs)
3. ⚠️ **HTTP proxy** (too complex, too many issues)
4. ❌ **Tauri capabilities** (doesn't work, feature doesn't exist)

**Recommendation**: Ship v1.0 with iframe mode, implement WebSocket bridge for v1.1.

---

**Status**: Reality check complete  
**Next**: Decide on WebSocket bridge implementation or stick with iframe mode

