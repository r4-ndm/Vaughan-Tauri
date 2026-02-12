# Window Label Injection Architecture

**Date**: 2026-02-12  
**Status**: ✅ WORKING  
**Critical**: DO NOT MODIFY WITHOUT UNDERSTANDING THIS DOCUMENT

---

## Overview

This document explains how window labels and origins are injected into dApp windows to enable proper session management and auto-connect functionality.

## The Problem

When a dApp window is opened, the provider script needs to know:
1. The unique window label (UUID) assigned by Tauri
2. The origin of the dApp (for session lookup)

However, `window.__TAURI_METADATA__?.currentWindow?.label` returns `'unknown'` because:
- The provider script runs via `initialization_script` (before page loads)
- Tauri hasn't fully initialized the window metadata yet
- The metadata becomes available later, but we need it immediately

This causes a **session key mismatch**:
- Session created with: `("dapp-c1dfac04-...", "https://app.uniswap.org")`
- Session lookup with: `("unknown", "https://app.uniswap.org")`
- Result: Auto-connect fails, user sees approval modal

## The Solution

### 1. Injection at Window Creation (Rust)

In `src-tauri/src/commands/window.rs`, the `open_dapp_window` function:

```rust
// Generate unique window label
let window_label = format!("dapp-{}", uuid::Uuid::new_v4());

// Get origin
let origin = validated_url.origin().ascii_serialization();

// Inject metadata into initialization_script
let provider_script = format!(
    r#"
    // Inject window metadata for provider
    window.__VAUGHAN_WINDOW_LABEL__ = "{}";
    window.__VAUGHAN_ORIGIN__ = "{}";
    
    // Provider script
    {}
    "#,
    window_label,
    origin,
    PROVIDER_SCRIPT_IPC.as_str()
);

// Create window with injected script
WebviewWindowBuilder::new(&app, &window_label, window_url)
    .initialization_script(&provider_script)
    .build()?;
```

**Key Points**:
- `initialization_script` runs BEFORE page loads
- Runs in privileged context (has access to Tauri APIs)
- Sets global variables that persist for the page lifetime
- These variables are available immediately when provider script runs

### 2. Usage in Provider Script (JavaScript)

In `src/provider/provider-inject-ipc.js`:

```javascript
// Use injected window label (set by initialization_script before page loads)
// Fallback to Tauri metadata, then 'unknown'
const windowLabel = window.__VAUGHAN_WINDOW_LABEL__ 
  || window.__TAURI_METADATA__?.currentWindow?.label 
  || 'unknown';

const origin = window.__VAUGHAN_ORIGIN__ || window.location.origin;

// Call Tauri backend with correct window label
const result = await invoke('handle_dapp_request', {
  windowLabel: windowLabel,
  origin: origin,
  method,
  params: params || []
});
```

**Key Points**:
- Primary source: `window.__VAUGHAN_WINDOW_LABEL__` (injected)
- Fallback 1: `window.__TAURI_METADATA__?.currentWindow?.label` (may be 'unknown')
- Fallback 2: `'unknown'` (last resort)
- Same pattern for origin

### 3. Session Creation (Rust)

In `src-tauri/src/commands/window.rs`, after window creation:

```rust
// Create auto-approved session with the SAME window_label
state.session_manager.create_auto_approved_session(
    &window_label,  // ← Same UUID used in injection
    &origin,
    title,
    None,
    vec![account],
).await?;
```

**Key Points**:
- Session key: `(window_label, origin)`
- Must match exactly what provider script sends
- Auto-approved flag set to `true`

### 4. Session Lookup (Rust)

In `src-tauri/src/dapp/rpc_handler.rs`:

```rust
async fn handle_accounts(
    state: &VaughanState,
    window_label: &str,  // ← From provider script
    origin: &str,
) -> Result<Value, WalletError> {
    // Lookup session by (window_label, origin)
    if let Some(connection) = state.session_manager
        .get_session_by_window(window_label, origin).await 
    {
        // Session found - return accounts immediately
        let accounts: Vec<String> = connection.accounts
            .iter()
            .map(|addr| format!("{:?}", addr))
            .collect();
        
        return Ok(serde_json::json!(accounts));
    }
    
    // No session - return empty array
    Ok(serde_json::json!([]))
}
```

**Key Points**:
- Session lookup uses exact match on `(window_label, origin)`
- If auto-approved session exists, accounts returned immediately
- No approval modal shown

---

## Data Flow

```
1. User clicks "Open dApp" in wallet
   ↓
2. open_dapp_window() generates UUID: "dapp-c1dfac04-..."
   ↓
3. Initialization script injected with:
   - window.__VAUGHAN_WINDOW_LABEL__ = "dapp-c1dfac04-..."
   - window.__VAUGHAN_ORIGIN__ = "https://app.uniswap.org"
   ↓
4. Auto-approved session created:
   - Key: ("dapp-c1dfac04-...", "https://app.uniswap.org")
   - auto_approved: true
   ↓
5. Window opens, provider script runs
   ↓
6. Provider reads window.__VAUGHAN_WINDOW_LABEL__
   ↓
7. Provider calls handle_dapp_request with:
   - windowLabel: "dapp-c1dfac04-..."
   - origin: "https://app.uniswap.org"
   ↓
8. handle_accounts() looks up session:
   - Key: ("dapp-c1dfac04-...", "https://app.uniswap.org")
   - ✅ MATCH FOUND
   ↓
9. Accounts returned immediately
   ↓
10. dApp auto-connected (no approval modal)
```

---

## Critical Rules

### ✅ DO

1. **Always inject window label and origin** in `initialization_script`
2. **Use injected values as primary source** in provider script
3. **Create session with same window_label** used in injection
4. **Test auto-connect** after any changes to window creation

### ❌ DON'T

1. **Don't rely solely on `__TAURI_METADATA__`** - it may be 'unknown'
2. **Don't modify window label format** without updating session keys
3. **Don't skip injection** - provider script needs these values immediately
4. **Don't use different window labels** for injection vs session creation

---

## Debugging

If auto-connect stops working, check these logs:

### 1. Window Creation
```
[Window] Generated window label: dapp-c1dfac04-f04f-46fb-abd5-d90eb61f2752
[SessionManager] Creating AUTO-APPROVED session for window: dapp-c1dfac04-f04f-46fb-abd5-d90eb61f2752
```

### 2. Provider Script
```
[Vaughan-IPC] Window Label: dapp-c1dfac04-f04f-46fb-abd5-d90eb61f2752
[Vaughan-IPC] Origin: https://app.uniswap.org
```

### 3. Session Lookup
```
[RPC] eth_accounts - Looking for session with window_label: 'dapp-c1dfac04-f04f-46fb-abd5-d90eb61f2752', origin: 'https://app.uniswap.org'
[RPC] eth_accounts - Found session for window: dapp-c1dfac04-f04f-46fb-abd5-d90eb61f2752, auto_approved: true
```

### Common Issues

**Issue**: Window label is 'unknown'
- **Cause**: Provider script not using injected value
- **Fix**: Check `window.__VAUGHAN_WINDOW_LABEL__` is used first

**Issue**: Session not found
- **Cause**: Window label mismatch between injection and lookup
- **Fix**: Verify same `window_label` used in both places

**Issue**: Approval modal shown despite auto-connect
- **Cause**: Session lookup failing due to key mismatch
- **Fix**: Check logs for exact window_label and origin values

---

## Testing

### Manual Test
1. Open wallet, unlock with password
2. Click "Open dApp" for any whitelisted dApp
3. dApp window should open
4. dApp should connect automatically (no approval modal)
5. Check console logs for window label

### Expected Behavior
- No approval modal shown
- Accounts available immediately
- Console shows: `[Vaughan-Provider] Auto-connected with accounts: [...]`

### Failure Indicators
- Approval modal appears
- Console shows: `[Vaughan-IPC] Window Label: unknown`
- Logs show: `[RPC] eth_accounts - No session found`

---

## Related Files

- `src-tauri/src/commands/window.rs` - Window creation and injection
- `src/provider/provider-inject-ipc.js` - Provider script (uses injected values)
- `src-tauri/src/dapp/session.rs` - Session management
- `src-tauri/src/dapp/rpc_handler.rs` - Session lookup
- `src-tauri/src/commands/dapp_ipc.rs` - IPC handler

---

## History

**2026-02-12**: Fixed auto-connect by using injected window label instead of `__TAURI_METADATA__`
- Problem: `__TAURI_METADATA__?.currentWindow?.label` returned 'unknown'
- Solution: Inject `window.__VAUGHAN_WINDOW_LABEL__` in initialization_script
- Result: Auto-connect working correctly

---

## Security Notes

- Window labels are UUIDs (unpredictable, unique per window)
- Origins are validated before injection (http/https only)
- Session keys use both window_label AND origin (prevents cross-window attacks)
- Auto-approved sessions only for wallet-opened dApps (user intent clear)
- Transactions still require approval (auto-connect ≠ auto-sign)

---

**Last Updated**: 2026-02-12  
**Maintainer**: Vaughan Development Team
