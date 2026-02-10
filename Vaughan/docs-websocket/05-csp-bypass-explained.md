# CSP Bypass Mechanism - Deep Dive

**Purpose**: Detailed explanation of how Vaughan bypasses Content Security Policy restrictions to work with sites like Uniswap.

---

## The Problem

### What is CSP?

Content Security Policy (CSP) is a security feature that restricts what resources a web page can load and execute.

**Example CSP Header** (from Uniswap):
```
Content-Security-Policy: 
    default-src 'self';
    connect-src 'self' https://api.uniswap.org https://cloudflare-eth.com;
    script-src 'self' 'unsafe-inline' 'unsafe-eval';
```

**What This Blocks**:
- ❌ WebSocket connections to `ws://localhost:8766`
- ❌ Fetch/XHR to localhost
- ❌ Custom protocol handlers
- ❌ Most injection techniques

### Why This is a Problem for Wallets

Traditional wallet approaches don't work:

```javascript
// ❌ Tauri IPC - Blocked by CSP
await invoke('wallet_method');  // __TAURI__ is undefined

// ❌ Custom protocol - Blocked by CSP
fetch('vaughan://wallet/accounts');  // Blocked

// ❌ Regular WebSocket - Blocked by CSP
const ws = new WebSocket('ws://localhost:8766');  // Blocked
```

---

## The Solution

### Extension-Style Injection

**Key Insight**: Tauri's `initialization_script` runs in a **privileged context** BEFORE the page loads and BEFORE CSP is applied.

```rust
// window.rs
let window = WebviewWindowBuilder::new(app, label, url)
    .initialization_script(PROVIDER_SCRIPT_EXTENSION)  // ← Magic happens here!
    .build()?;
```

---

## How It Works

### Timeline

```
┌─────────────────────────────────────────────────────────────────┐
│ Time 0: Window Created                                          │
│ - Tauri creates webview window                                  │
│ - No page loaded yet                                            │
│ - No CSP applied yet                                            │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ Time 1: initialization_script Runs (PRIVILEGED CONTEXT)         │
│ - Runs BEFORE page loads                                        │
│ - Runs BEFORE CSP is applied                                    │
│ - Has full access to browser APIs                               │
│ - Can create WebSocket connections                              │
│ - Can inject into window object                                 │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ Time 2: Provider Injected                                       │
│ - window.ethereum created                                       │
│ - WebSocket connection established                              │
│ - Connection is ALREADY OPEN                                    │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ Time 3: Page Loads                                              │
│ - HTML downloaded                                               │
│ - CSP headers received                                          │
│ - CSP is NOW ACTIVE                                             │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ Time 4: Page Scripts Run                                        │
│ - Page JavaScript executes                                      │
│ - CSP is enforced                                               │
│ - BUT: window.ethereum already exists!                          │
│ - BUT: WebSocket connection already open!                       │
│ - CSP can't block what already happened!                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Code Walkthrough

### 1. Window Creation with Injection

```rust
// src-tauri/src/commands/window.rs

lazy_static! {
    static ref PROVIDER_SCRIPT_EXTENSION: String = {
        include_str!("../../provider/provider-inject-extension.js").to_string()
    };
}

#[tauri::command]
pub async fn open_dapp_window(
    app: AppHandle,
    state: State<'_, VaughanState>,
    url: String,
    title: Option<String>,
) -> Result<String, String> {
    let label = format!("dapp-{}", uuid::Uuid::new_v4());
    
    // Create window with provider injection
    let window = WebviewWindowBuilder::new(&app, &label, WebviewUrl::External(url.parse()?))
        .title(title.unwrap_or_else(|| "dApp".to_string()))
        .initialization_script(&PROVIDER_SCRIPT_EXTENSION)  // ← Injected here!
        .build()?;
    
    Ok(label)
}
```

**Key Points**:
- `initialization_script` accepts JavaScript code as string
- Script runs in privileged context (before CSP)
- Script has full access to browser APIs
- Script runs ONCE per window creation

---

### 2. Provider Script Execution

```javascript
// src/provider/provider-inject-extension.js

(function() {
    'use strict';

    // Prevent re-injection
    if (window.ethereum) {
        console.warn('[Vaughan-Ext] Provider already injected');
        return;
    }

    console.log('[Vaughan-Ext] Initializing extension-style provider');

    // ========================================================================
    // THIS CODE RUNS BEFORE CSP!
    // ========================================================================

    // Create WebSocket connection (CSP can't block this!)
    const ws = new WebSocket('ws://localhost:8766');
    
    ws.onopen = () => {
        console.log('[Vaughan-Ext] Connected! ✅');
        // Connection is now open and will stay open
    };

    // Create provider
    const provider = new VaughanProvider(ws);

    // Inject into window (CSP can't prevent this!)
    Object.defineProperty(window, 'ethereum', {
        value: provider,
        writable: false,
        configurable: false
    });

    console.log('[Vaughan-Ext] Provider injected successfully ✅');
})();
```

**Key Points**:
- Runs in IIFE (immediately invoked function expression)
- Creates WebSocket connection BEFORE CSP
- Injects provider BEFORE CSP
- Connection stays open after CSP is applied

---

## Why CSP Can't Block This

### CSP Enforcement Timeline

```
┌─────────────────────────────────────────────────────────────────┐
│ CSP Enforcement Phases                                          │
│                                                                  │
│ Phase 1: Before Page Load                                       │
│ - No CSP yet                                                    │
│ - initialization_script runs here ✅                            │
│ - WebSocket connection created here ✅                          │
│                                                                  │
│ Phase 2: Page Load                                              │
│ - CSP headers received                                          │
│ - CSP becomes active                                            │
│ - But connection already exists!                                │
│                                                                  │
│ Phase 3: After Page Load                                        │
│ - CSP enforced on all new requests                              │
│ - Existing connections unaffected                               │
│ - Page scripts can use window.ethereum                          │
└─────────────────────────────────────────────────────────────────┘
```

### What CSP Sees

```
Browser's Perspective:

1. Window created
2. initialization_script runs (privileged, no CSP)
   → WebSocket connection to ws://localhost:8766 ✅
   → window.ethereum injected ✅
3. Page loads
4. CSP headers received
5. CSP becomes active
6. Page tries to create WebSocket (hypothetically)
   → CSP blocks it ❌
7. BUT: Our WebSocket was created in step 2!
   → CSP can't retroactively close it
   → Connection stays open ✅
```

---

## The CSP Error is EXPECTED

### What You See in Console

```
Refused to connect to 'ws://localhost:8766/' because it violates 
the following Content Security Policy directive: "connect-src 'self' 
https://api.uniswap.org https://cloudflare-eth.com".
```

### Why This Appears

```javascript
// Provider script (runs BEFORE CSP)
const ws = new WebSocket('ws://localhost:8766');  // ← Connection succeeds

// Later, after CSP is active
// Browser reports: "Hey, there's a WebSocket connection that violates CSP"
// But the connection is already open and working!
```

### How to Verify It's Working

Look for these logs BEFORE the CSP error:

```
✅ Expected logs (in order):
[Vaughan-Ext] Initializing extension-style provider
[Vaughan-Ext] Connecting to WebSocket...
[Vaughan-Ext] Connected! ✅
[Vaughan-Ext] Provider injected successfully ✅
[Vaughan-Ext] Provider initialized with chainId: 0x171

⚠️ Then CSP error appears (IGNORE THIS):
Refused to connect to 'ws://localhost:8766/'...
```

**If you see the ✅ logs, the bypass worked!** The CSP error is just the browser reporting the violation after the fact.

---

## Comparison with Other Approaches

### Approach 1: Regular Injection (FAILS)

```javascript
// Injected via <script> tag or eval
const ws = new WebSocket('ws://localhost:8766');  // ❌ Blocked by CSP
```

**Why it fails**: Runs after CSP is active

---

### Approach 2: Tauri IPC (FAILS)

```javascript
// Try to use Tauri commands
await invoke('wallet_method');  // ❌ __TAURI__ is undefined
```

**Why it fails**: CSP blocks Tauri's IPC mechanism

---

### Approach 3: Custom Protocol (FAILS)

```javascript
// Try custom protocol
fetch('vaughan://wallet/accounts');  // ❌ Blocked by CSP
```

**Why it fails**: CSP blocks custom protocols

---

### Approach 4: initialization_script (WORKS!)

```rust
// Tauri window creation
.initialization_script(PROVIDER_SCRIPT)  // ✅ Runs before CSP
```

**Why it works**: Runs in privileged context before CSP is applied

---

## Security Implications

### Is This Safe?

**YES!** This is exactly how browser extensions work.

**Why it's safe**:
1. **Localhost only** - WebSocket server only accepts connections from 127.0.0.1
2. **User approval** - Sensitive operations require user confirmation
3. **Password protection** - Transactions require password
4. **Origin tracking** - We know which dApp made each request
5. **Rate limiting** - Prevents abuse

### How Browser Extensions Work

```
MetaMask (Browser Extension):
1. Extension injects content script into page
2. Content script runs in privileged context
3. Content script creates window.ethereum
4. Page scripts use window.ethereum
5. CSP can't block extension scripts

Vaughan (Tauri App):
1. Tauri injects initialization_script into page
2. initialization_script runs in privileged context
3. initialization_script creates window.ethereum
4. Page scripts use window.ethereum
5. CSP can't block initialization_script

→ Same mechanism, same security model!
```

---

## Testing the Bypass

### Test 1: Verify Injection

```javascript
// Browser console (in dApp window)
console.log('ethereum' in window);  // Should be true
console.log(window.ethereum.isVaughan);  // Should be true
```

### Test 2: Verify Connection

```javascript
// Browser console
window.ethereum.request({ method: 'eth_chainId' })
    .then(chainId => console.log('Chain ID:', chainId))
    .catch(err => console.error('Error:', err));

// Should log: Chain ID: 0x171
```

### Test 3: Check Logs

```
Expected sequence:
1. [Vaughan-Ext] Initializing extension-style provider
2. [Vaughan-Ext] Connecting to WebSocket...
3. [Vaughan-Ext] Connected! ✅
4. [Vaughan-Ext] Provider injected successfully ✅
5. [Vaughan-Ext] Provider initialized with chainId: 0x171
6. ⚠️ CSP error (IGNORE - this is expected)
```

---

## Troubleshooting

### Issue: "window.ethereum is undefined"

**Cause**: initialization_script not running

**Fix**:
1. Verify window created with `open_dapp_window` command
2. Check `window.rs` uses `PROVIDER_SCRIPT_EXTENSION`
3. Restart app (script only runs on window creation)

---

### Issue: "WebSocket connection failed"

**Cause**: WebSocket server not running

**Fix**:
1. Check Rust console for "✅ WebSocket server started on ws://127.0.0.1:8766"
2. Verify no other app is using port 8766
3. Restart app

---

### Issue: CSP errors but no connection logs

**Cause**: Script failed to run

**Fix**:
1. Check for JavaScript errors in console
2. Verify `PROVIDER_SCRIPT_EXTENSION` is loaded correctly
3. Check `include_str!` path is correct

---

## Key Takeaways

1. **initialization_script is the key** - Runs before CSP in privileged context
2. **Timing is everything** - Connection established before CSP applies
3. **CSP error is expected** - Appears after connection succeeds
4. **Same as browser extensions** - Uses same mechanism as MetaMask
5. **Secure by design** - Localhost only, user approval, password protection
6. **Works with any dApp** - No dApp modifications needed

---

## References

- [Tauri initialization_script docs](https://tauri.app/v1/api/js/window/#initialization_script)
- [Content Security Policy (MDN)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [EIP-1193: Ethereum Provider JavaScript API](https://eips.ethereum.org/EIPS/eip-1193)
- [How MetaMask Works](https://docs.metamask.io/guide/)

---

**End of Documentation**

You now understand the complete WebSocket bridge system and how it bypasses CSP restrictions!
