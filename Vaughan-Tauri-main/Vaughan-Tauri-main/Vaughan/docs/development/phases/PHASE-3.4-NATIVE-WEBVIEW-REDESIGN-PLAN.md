# Phase 3.4: Native WebView Redesign Plan

**Goal**: Redesign dApp browser to use Tauri's native WebviewWindow (Rabby Desktop architecture) instead of HTML iframe

**Status**: 📋 Planning
**Estimated Effort**: 6-8 hours
**Priority**: HIGH (Required for real-world dApp compatibility)

---

## Problem Statement

### Current Architecture (Broken)
```
Main Wallet Window (Tauri WebviewWindow)
  └─> dApp Browser Window (Tauri WebviewWindow)
       └─> React App with <iframe>
            └─> dApp Website (e.g., swap.internetmoney.io)
                 └─> Try to inject provider-inject.js
                      ❌ BLOCKED by Content Security Policy (CSP)
```

**Why it fails**:
- HTML `<iframe>` has strict CSP restrictions
- Cannot inject scripts into cross-origin iframes
- Script injection happens AFTER page loads (too late)
- Real-world dApps block external script injection for security

### Rabby Desktop Architecture (Correct)
```
Main Wallet Window (Tauri WebviewWindow)
  └─> dApp Browser Window (Tauri WebviewWindow)
       ├─> initialization_script (runs BEFORE page loads)
       │    └─> Injects window.ethereum provider
       │    └─> Sets up Tauri IPC communication
       │    └─> Announces EIP-6963
       └─> Loads dApp URL directly (no iframe)
            └─> dApp Website sees window.ethereum
                 ✅ Provider already available
```

**Why it works**:
- Tauri's `initialization_script` runs at webview level (before any page content)
- Bypasses CSP because it's injected by the native app, not via DOM
- Provider is available immediately when page loads
- Works with ANY website (no CSP restrictions)

---

## Architecture Comparison

### Current (Iframe-Based)

**Pros**:
- ✅ Easy to implement (just React components)
- ✅ Can have address bar and controls in same window
- ✅ Works for localhost/same-origin testing

**Cons**:
- ❌ Blocked by CSP on real dApps
- ❌ Cannot inject scripts into cross-origin iframes
- ❌ Limited browser capabilities
- ❌ No access to webview events
- ❌ Incompatible with production dApps

### Rabby Desktop (Native WebView)

**Pros**:
- ✅ Bypasses CSP restrictions
- ✅ Works with ALL dApps (Uniswap, PulseX, etc.)
- ✅ Full browser capabilities
- ✅ Access to navigation events
- ✅ Production-ready architecture
- ✅ Better performance (native webview)

**Cons**:
- ⚠️ More complex implementation
- ⚠️ Address bar must be in separate window or overlay
- ⚠️ Requires Tauri IPC for communication

---

## Implementation Plan

### Phase 1: Backend Changes (Rust)

#### Step 1.1: Update Window Command
**File**: `Vaughan/src-tauri/src/commands/window.rs`

**Changes**:
```rust
#[tauri::command]
pub async fn open_dapp_url(
    app: AppHandle,
    url: String,
) -> Result<String, String> {
    let window_label = format!("dapp-{}", uuid::Uuid::new_v4());
    
    // Read provider script
    let provider_script = include_str!("../../provider-inject.js");
    
    // Create webview with initialization script
    WebviewWindowBuilder::new(
        &app,
        &window_label,
        WebviewUrl::External(url.parse()?),
    )
    .title("Vaughan - dApp Browser")
    .inner_size(1200.0, 800.0)
    .initialization_script(provider_script)  // ← KEY: Inject BEFORE page loads
    .build()?;
    
    Ok(window_label)
}
```

**Key Points**:
- `initialization_script()` runs BEFORE page loads
- Provider is available immediately
- Bypasses CSP restrictions
- Returns window label for tracking

#### Step 1.2: Add Navigation Commands
**File**: `Vaughan/src-tauri/src/commands/window.rs`

**New Commands**:
```rust
#[tauri::command]
pub async fn navigate_dapp(
    app: AppHandle,
    window_label: String,
    url: String,
) -> Result<(), String>

#[tauri::command]
pub async fn close_dapp(
    app: AppHandle,
    window_label: String,
) -> Result<(), String>

#[tauri::command]
pub async fn get_dapp_url(
    app: AppHandle,
    window_label: String,
) -> Result<String, String>
```

#### Step 1.3: Update Provider Script for Tauri IPC
**File**: `Vaughan/src/provider/provider-inject.js`

**Changes**:
```javascript
// Replace postMessage with Tauri IPC
async function _sendRequest(method, params) {
    const request = { id, method, params };
    
    // Use Tauri IPC instead of postMessage
    const response = await window.__TAURI__.invoke('dapp_request', {
        request
    });
    
    return response.result;
}
```

**Key Points**:
- Replace `window.postMessage` with `window.__TAURI__.invoke`
- Direct communication with Rust backend
- No need for ProviderBridge React component
- Simpler, more reliable

#### Step 1.4: Add Window Event Handlers
**File**: `Vaughan/src-tauri/src/commands/window.rs`

**New Handlers**:
```rust
// Listen for navigation events
webview.on_navigation(|url| {
    println!("Navigating to: {}", url);
    // Update address bar, check permissions, etc.
});

// Listen for page load
webview.on_page_load(|_| {
    println!("Page loaded");
    // Trigger any post-load actions
});
```

---

### Phase 2: Frontend Changes (React/TypeScript)

#### Step 2.1: Create Address Bar Component
**File**: `Vaughan/src/components/DappAddressBar/DappAddressBar.tsx`

**Purpose**: Floating address bar overlay for dApp windows

**Features**:
- URL input and navigation
- Back/forward buttons
- Refresh button
- Connection status indicator
- Close button

**Implementation**:
```typescript
export function DappAddressBar() {
  const [url, setUrl] = useState('');
  const [windowLabel, setWindowLabel] = useState('');
  
  const handleNavigate = async () => {
    await invoke('navigate_dapp', { windowLabel, url });
  };
  
  return (
    <div className="fixed top-0 left-0 right-0 bg-gray-800 p-2 z-50">
      {/* Address bar UI */}
    </div>
  );
}
```

#### Step 2.2: Update Main Wallet to Open Native WebView
**File**: `Vaughan/src/views/WalletView/WalletView.tsx`

**Changes**:
```typescript
const handleDappBrowser = async () => {
  // Open native webview instead of React window
  const windowLabel = await invoke('open_dapp_url', {
    url: 'https://swap.internetmoney.io'
  });
  
  console.log('Opened dApp window:', windowLabel);
};
```

#### Step 2.3: Remove Old Iframe-Based Components
**Files to Remove/Archive**:
- `Vaughan/src/views/DappBrowserView/DappBrowserStandalone.tsx`
- `Vaughan/src/hooks/useProviderBridge.ts`
- `Vaughan/dapp-browser.html`

**Reason**: No longer needed with native webview approach

#### Step 2.4: Update Tauri Service
**File**: `Vaughan/src/services/tauri.ts`

**New Methods**:
```typescript
export async function openDappUrl(url: string): Promise<string> {
  return await invoke('open_dapp_url', { url });
}

export async function navigateDapp(windowLabel: string, url: string): Promise<void> {
  await invoke('navigate_dapp', { windowLabel, url });
}

export async function closeDapp(windowLabel: string): Promise<void> {
  await invoke('close_dapp', { windowLabel });
}
```

---

### Phase 3: Provider Communication

#### Step 3.1: Update Provider for Tauri IPC
**File**: `Vaughan/src/provider/provider-inject.js`

**Current**: Uses `window.postMessage` to parent
**New**: Uses `window.__TAURI__.invoke` directly

**Changes**:
```javascript
// OLD (postMessage)
window.parent.postMessage({
  type: 'VAUGHAN_REQUEST',
  request
}, '*');

// NEW (Tauri IPC)
const response = await window.__TAURI__.invoke('dapp_request', {
  request
});
```

**Benefits**:
- Direct communication with Rust backend
- No need for React ProviderBridge
- More reliable (no message passing issues)
- Better error handling

#### Step 3.2: Keep Existing dapp_request Command
**File**: `Vaughan/src-tauri/src/commands/dapp.rs`

**No changes needed** - the `dapp_request` command already handles:
- Session validation
- Rate limiting
- RPC method routing
- Approval queue

**Just update the call site** from React postMessage to Tauri IPC

---

### Phase 4: Testing & Validation

#### Step 4.1: Test with Localhost
**Test URL**: `http://localhost:1420/dapp-test-simple.html`

**Expected**:
- ✅ Window opens
- ✅ Provider injected
- ✅ Connection works
- ✅ Transaction works

#### Step 4.2: Test with Real dApps
**Test URLs**:
1. `https://swap.internetmoney.io`
2. `https://app.uniswap.org`
3. `https://app.1inch.io`

**Expected**:
- ✅ Vaughan appears in wallet list
- ✅ Connection works
- ✅ Transaction signing works
- ✅ No CSP errors

#### Step 4.3: Test EIP-6963 Discovery
**Test**: Open dApp, click "Connect Wallet"

**Expected**:
- ✅ "Vaughan Wallet" appears in list
- ✅ Icon displays correctly
- ✅ Click → connection modal
- ✅ Approve → connected

---

## File Changes Summary

### Files to Create
1. ✅ `Vaughan/PHASE-3.4-NATIVE-WEBVIEW-REDESIGN-PLAN.md` (this file)
2. ➕ `Vaughan/src/components/DappAddressBar/DappAddressBar.tsx`
3. ➕ `Vaughan/src/components/DappAddressBar/index.ts`

### Files to Modify
1. ✏️ `Vaughan/src-tauri/src/commands/window.rs` (~100 lines added)
2. ✏️ `Vaughan/src/provider/provider-inject.js` (~50 lines changed)
3. ✏️ `Vaughan/src/views/WalletView/WalletView.tsx` (~10 lines changed)
4. ✏️ `Vaughan/src/services/tauri.ts` (~30 lines added)
5. ✏️ `Vaughan/src-tauri/src/lib.rs` (register new commands)

### Files to Remove/Archive
1. ❌ `Vaughan/src/views/DappBrowserView/DappBrowserStandalone.tsx`
2. ❌ `Vaughan/src/hooks/useProviderBridge.ts`
3. ❌ `Vaughan/dapp-browser.html`
4. ❌ `Vaughan/src/dapp-browser.tsx`

**Total Changes**: ~200 lines added, ~500 lines removed

---

## Implementation Steps (Detailed)

### Step 1: Backend - Window Management (2 hours)

**1.1 Update window.rs**
- [ ] Add `open_dapp_url` command
- [ ] Add `navigate_dapp` command
- [ ] Add `close_dapp` command
- [ ] Add `get_dapp_url` command
- [ ] Implement initialization_script injection
- [ ] Add window event handlers
- [ ] Test compilation

**1.2 Update lib.rs**
- [ ] Register new commands
- [ ] Test compilation

**1.3 Test Backend**
- [ ] Call `open_dapp_url` from frontend
- [ ] Verify window opens
- [ ] Verify script injection
- [ ] Check console for provider logs

### Step 2: Provider - Tauri IPC (1 hour)

**2.1 Update provider-inject.js**
- [ ] Replace postMessage with Tauri IPC
- [ ] Update _sendRequest method
- [ ] Test with localhost dApp
- [ ] Verify requests reach backend

**2.2 Test Provider**
- [ ] Open test dApp
- [ ] Check window.ethereum exists
- [ ] Call eth_requestAccounts
- [ ] Verify approval modal appears

### Step 3: Frontend - UI Updates (2 hours)

**3.1 Create DappAddressBar**
- [ ] Create component file
- [ ] Add URL input
- [ ] Add navigation buttons
- [ ] Add connection status
- [ ] Style with Tailwind

**3.2 Update WalletView**
- [ ] Replace old dApp browser call
- [ ] Call open_dapp_url instead
- [ ] Test button click

**3.3 Update TauriService**
- [ ] Add openDappUrl method
- [ ] Add navigateDapp method
- [ ] Add closeDapp method

**3.4 Remove Old Files**
- [ ] Archive DappBrowserStandalone.tsx
- [ ] Archive useProviderBridge.ts
- [ ] Archive dapp-browser.html
- [ ] Update vite.config.ts (remove dappBrowser entry)

### Step 4: Testing (1 hour)

**4.1 Localhost Testing**
- [ ] Open dapp-test-simple.html
- [ ] Test connection
- [ ] Test transaction
- [ ] Verify approval modals

**4.2 Real dApp Testing**
- [ ] Open swap.internetmoney.io
- [ ] Click "Connect Wallet"
- [ ] Verify Vaughan appears
- [ ] Test connection
- [ ] Test transaction

**4.3 EIP-6963 Testing**
- [ ] Verify announcement fires
- [ ] Check wallet list
- [ ] Test icon display
- [ ] Test connection flow

### Step 5: Documentation (30 minutes)

**5.1 Update Docs**
- [ ] Create PHASE-3.4-COMPLETE.md
- [ ] Update testing guide
- [ ] Document new architecture
- [ ] Add troubleshooting section

---

## Technical Details

### Tauri initialization_script

**How it works**:
```rust
WebviewWindowBuilder::new(...)
    .initialization_script(r#"
        // This runs BEFORE any page content loads
        // Has access to window object
        // Cannot be blocked by CSP
        console.log('Initialization script running');
        
        // Inject provider
        window.ethereum = { /* ... */ };
        
        // Announce EIP-6963
        window.dispatchEvent(new CustomEvent('eip6963:announceProvider', {
            detail: { /* ... */ }
        }));
    "#)
    .build()?;
```

**Key Points**:
- Runs at webview creation (before page loads)
- Has full access to window object
- Cannot be blocked by CSP
- Perfect for provider injection

### Tauri IPC Communication

**From JavaScript**:
```javascript
const response = await window.__TAURI__.invoke('dapp_request', {
    request: {
        id: '123',
        method: 'eth_requestAccounts',
        params: []
    }
});
```

**To Rust**:
```rust
#[tauri::command]
async fn dapp_request(
    state: State<'_, VaughanState>,
    request: DappRequest,
) -> Result<DappResponse, String> {
    // Handle request
}
```

**Benefits**:
- Type-safe (serde serialization)
- Direct communication (no message passing)
- Better error handling
- Simpler architecture

---

## Migration Strategy

### Option 1: Clean Break (Recommended)
1. Implement new architecture completely
2. Test thoroughly
3. Remove old iframe-based code
4. Ship new version

**Pros**: Clean, no legacy code
**Cons**: More upfront work

### Option 2: Gradual Migration
1. Keep iframe-based for localhost testing
2. Add native webview for real dApps
3. Maintain both temporarily
4. Remove iframe later

**Pros**: Less risky, can test both
**Cons**: More code to maintain

**Recommendation**: Option 1 (Clean Break)

---

## Success Criteria

### Must Have
- [x] EIP-6963 implemented
- [ ] Native webview opens dApp URLs
- [ ] Provider injected via initialization_script
- [ ] Works with swap.internetmoney.io
- [ ] Connection approval works
- [ ] Transaction signing works
- [ ] No CSP errors

### Nice to Have
- [ ] Address bar overlay
- [ ] Navigation history (back/forward)
- [ ] Bookmarks
- [ ] Multiple dApp windows
- [ ] Window management UI

---

## Risks & Mitigation

### Risk 1: Tauri IPC Complexity
**Risk**: Tauri IPC might be more complex than postMessage
**Mitigation**: Start simple, use existing dapp_request command
**Impact**: Low (Tauri IPC is well-documented)

### Risk 2: Window Management
**Risk**: Managing multiple dApp windows could be complex
**Mitigation**: Start with single window, add multi-window later
**Impact**: Medium (can be added incrementally)

### Risk 3: Address Bar UX
**Risk**: Separate address bar window might be awkward
**Mitigation**: Use overlay or toolbar in dApp window
**Impact**: Low (can iterate on UX)

### Risk 4: Breaking Existing Tests
**Risk**: Removing iframe breaks existing test setup
**Mitigation**: Update tests to use native webview
**Impact**: Medium (tests need rewriting)

---

## Timeline

### Day 1 (4 hours)
- ✅ Create this plan
- [ ] Implement backend window management
- [ ] Update provider for Tauri IPC
- [ ] Test with localhost

### Day 2 (4 hours)
- [ ] Create address bar component
- [ ] Update frontend to use native webview
- [ ] Remove old iframe code
- [ ] Test with real dApps

### Total: 8 hours

---

## Next Steps

1. **Review this plan** - Confirm approach is correct
2. **Start implementation** - Begin with Step 1 (Backend)
3. **Test incrementally** - Verify each step works
4. **Document progress** - Update completion docs

---

## References

- **Rabby Desktop**: https://github.com/RabbyHub/Rabby (reference implementation)
- **Tauri WebviewWindow**: https://tauri.app/v1/api/js/window/
- **Tauri initialization_script**: https://tauri.app/v1/api/config/#webviewwindowconfig.initializationscript
- **EIP-6963**: https://eips.ethereum.org/EIPS/eip-6963
- **EIP-1193**: https://eips.ethereum.org/EIPS/eip-1193

---

**Status**: 📋 Ready for implementation
**Next**: Begin Step 1.1 - Update window.rs with initialization_script
