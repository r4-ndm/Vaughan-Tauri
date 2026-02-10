# Phase 3: dApp Integration - Implementation Plan (Tauri Desktop)

**Goal**: Make Vaughan work with real dApps like PulseX (https://app.pulsex.com/)  
**Standard**: EIP-1193 Ethereum Provider JavaScript API  
**Architecture**: Tauri Desktop (similar to Rabby Desktop but with Tauri instead of Electron)  
**Test dApp**: PulseX DEX on PulseChain Testnet V4

---

## Key Difference: Tauri vs Browser Extension

**Browser Extension** (MetaMask):
- Injects `window.ethereum` into every webpage
- Content scripts run in page context
- Background service worker handles requests

**Desktop App** (Rabby Desktop, Vaughan):
- Uses embedded webview to load dApps
- Injects provider via preload/initialization script
- Main process (Rust) handles wallet operations
- IPC bridge between webview and main process

**Tauri-Specific**:
- Uses `tauri://` custom protocol or `http://localhost`
- JavaScript injection via `webview.eval()` or initialization scripts
- IPC via `invoke()` commands (already have this!)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    dApp (PulseX)                            │
│              Loaded in Tauri WebView                        │
│                 window.ethereum ← INJECTED                  │
└────────────────────────┬────────────────────────────────────┘
                         │ window.ethereum.request()
                         ↓
┌─────────────────────────────────────────────────────────────┐
│         Injected Provider Script (JavaScript)               │
│  - Implements EIP-1193 interface                            │
│  - Calls window.__TAURI__.invoke() for requests            │
│  - Emits events (accountsChanged, chainChanged)            │
└────────────────────────┬────────────────────────────────────┘
                         │ Tauri IPC (invoke)
                         ↓
┌─────────────────────────────────────────────────────────────┐
│         Layer 2: Tauri Commands (dApp-specific)             │
│  - dapp_request_accounts                                    │
│  - dapp_send_transaction                                    │
│  - dapp_sign_message                                        │
│  - dapp_get_chain_id                                        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│    Layer 1: Wallet Core (existing - reuse!)                │
│  - WalletService, NetworkService, TransactionService       │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps (Tauri-Specific)

### Step 1: Create dApp Browser View (2 hours)
**File**: `Vaughan/src/views/DappBrowserView/DappBrowserView.tsx`

Use Tauri's WebView component to load dApps:
- Create iframe or use Tauri's webview API
- Inject provider script on load
- Handle navigation
- Show connection status

**Key Challenge**: Tauri doesn't have built-in webview component in React
**Solution**: Use iframe with proper CSP or create custom Tauri window

---

### Step 2: Build Provider Injection Script (3 hours)
**File**: `Vaughan/public/provider-inject.js`

This script gets injected into the dApp's context:

```javascript
// This runs in the dApp's context
(function() {
  class VaughanProvider {
    constructor() {
      this.isVaughan = true;
      this.isMetaMask = true; // For compatibility
      this._events = {};
    }
    
    async request({ method, params }) {
      // Call Tauri backend
      return await window.__TAURI__.invoke('dapp_request', {
        method,
        params: params || []
      });
    }
    
    on(event, handler) {
      if (!this._events[event]) this._events[event] = [];
      this._events[event].push(handler);
    }
    
    // ... more methods
  }
  
  // Inject into window
  window.ethereum = new VaughanProvider();
  
  // Announce provider (EIP-6963)
  window.dispatchEvent(new CustomEvent('eip6963:announceProvider', {
    detail: {
      info: {
        uuid: 'vaughan-wallet',
        name: 'Vaughan',
        icon: 'data:image/svg+xml,...',
        rdns: 'com.vaughan.wallet'
      },
      provider: window.ethereum
    }
  }));
})();
```

---

### Step 3: Create Tauri dApp Commands (2 hours)
**File**: `Vaughan/src-tauri/src/commands/dapp.rs`

```rust
#[tauri::command]
async fn dapp_request(
    state: State<'_, VaughanState>,
    window: Window,
    method: String,
    params: Vec<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    match method.as_str() {
        "eth_requestAccounts" => {
            // Show approval modal
            // Return accounts if approved
        }
        "eth_sendTransaction" => {
            // Show transaction approval
            // Send if approved
        }
        // ... handle other methods
        _ => Err(format!("Method not supported: {}", method))
    }
}
```

---

### Step 4: Build Approval System (3 hours)

**Approach**: Use Tauri's window system for approvals

**Option A**: Modal in main window
- Show modal overlay in main Vaughan window
- Pause dApp until user approves/rejects

**Option B**: Separate approval window (Rabby-style)
- Create new Tauri window for each approval
- Better UX, more complex

**Recommendation**: Start with Option A (simpler)

---

### Step 5: Handle WebView Communication (2 hours)

**Challenge**: How to load dApp in Tauri?

**Option 1**: iframe (Simple but limited)
```tsx
<iframe 
  src="https://app.pulsex.com"
  sandbox="allow-scripts allow-same-origin"
/>
```
**Problem**: Can't inject provider easily

**Option 2**: Tauri WebView Window (Recommended)
```rust
// Create separate window for dApp
let dapp_window = WindowBuilder::new(
    &app,
    "dapp",
    WindowUrl::External("https://app.pulsex.com".parse().unwrap())
)
.initialization_script(include_str!("../provider-inject.js"))
.build()?;
```

**Option 3**: Use existing test HTML approach
- Load dApp in main window
- Inject provider via script tag
- Similar to `dapp-test.html` we already have!

---

## Recommended Approach (Simplest)

Based on what we already have (`Vaughan/public/dapp-test.html`), let's use:

### Architecture:
1. **DappBrowserView** - React component with iframe
2. **Provider injection** - Via postMessage bridge
3. **Approval modals** - React components in main window

### Flow:
```
dApp (iframe) 
  → postMessage → 
Main Window (React)
  → invoke() → 
Tauri Backend (Rust)
  → Response →
Main Window
  → postMessage →
dApp (iframe)
```

This is simpler and works within Tauri's constraints!

---

### Step 4: Build Approval UI (2 hours)
**File**: `Vaughan/src/components/ApprovalModal/ApprovalModal.tsx`

Create modal for user approvals:

**Connection Request**:
```
┌─────────────────────────────────────┐
│  Connect to PulseX?                 │
│                                     │
│  🌐 app.pulsex.com                  │
│                                     │
│  This site is requesting:           │
│  ✓ View your account address        │
│  ✓ Request transaction approval     │
│                                     │
│  Account: 0x4406...80B6             │
│                                     │
│  [Cancel]  [Connect]                │
└─────────────────────────────────────┘
```

**Transaction Request**:
```
┌─────────────────────────────────────┐
│  Confirm Transaction                │
│                                     │
│  From: app.pulsex.com               │
│                                     │
│  To: 0x1234...5678                  │
│  Amount: 0.5 tPLS                   │
│  Gas: 21000 @ 1.5 Gwei              │
│  Total: 0.500031 tPLS               │
│                                     │
│  [Reject]  [Confirm]                │
└─────────────────────────────────────┘
```

---

### Step 5: Implement Event System (1 hour)
**File**: `Vaughan/src/provider/EventEmitter.ts`

Simple event emitter for provider events:
- `accountsChanged`
- `chainChanged`
- `connect`
- `disconnect`

---

### Step 6: Add dApp State Management (1 hour)
**Update**: `Vaughan/src-tauri/src/state.rs`

Already has dApp state! Just need to use it:
```rust
pub struct VaughanState {
    // ... existing fields ...
    
    /// Connected dApps (origin -> connection info)
    connected_dapps: Mutex<HashMap<DappOrigin, DappConnection>>,
    
    /// Pending approval requests (FIFO queue)
    pending_approvals: Mutex<VecDeque<ApprovalRequest>>,
}
```

---

### Step 7: Testing with PulseX (2 hours)

**Test Flow**:
1. Open dApp view
2. Navigate to https://app.pulsex.com/
3. Click "Connect Wallet"
4. Approve connection in Vaughan
5. Try to swap tokens
6. Approve transaction in Vaughan
7. Verify transaction on block explorer

---

## File Structure

```
Vaughan/
├── src/
│   ├── views/
│   │   └── DappView/
│   │       ├── DappView.tsx          # NEW: dApp browser
│   │       └── index.ts
│   ├── components/
│   │   └── ApprovalModal/
│   │       ├── ApprovalModal.tsx     # NEW: Approval UI
│   │       ├── ConnectionRequest.tsx # NEW
│   │       ├── TransactionRequest.tsx # NEW
│   │       └── index.ts
│   └── provider/
│       ├── VaughanProvider.ts        # NEW: EIP-1193 provider
│       ├── EventEmitter.ts           # NEW: Event system
│       ├── inject.ts                 # NEW: Injection script
│       └── index.ts
│
└── src-tauri/
    └── src/
        └── commands/
            └── dapp.rs               # NEW: dApp commands
```

---

## Security Considerations

### 1. Origin Validation
- Always check dApp origin before processing requests
- Store approved origins in state
- Require re-approval after wallet restart

### 2. User Approval
- NEVER auto-approve transactions
- Show clear transaction details
- Require password for sensitive operations

### 3. Phishing Protection
- Show dApp origin prominently
- Warn on suspicious domains
- Implement domain allowlist (optional)

### 4. Data Validation
- Validate all transaction parameters in Rust
- Check gas limits are reasonable
- Verify addresses are valid

---

## Phase 3 Milestones

### Phase 3.1: Basic Provider (Day 1) ✅
- [ ] Create DappView component
- [ ] Implement VaughanProvider (basic)
- [ ] Add dapp_request_accounts command
- [ ] Add dapp_get_chain_id command
- [ ] Test connection with PulseX

### Phase 3.2: Transaction Support (Day 2) ✅
- [ ] Add ApprovalModal component
- [ ] Implement dapp_send_transaction command
- [ ] Add transaction approval flow
- [ ] Test token swap on PulseX

### Phase 3.3: Message Signing (Day 3) ✅
- [ ] Implement dapp_sign_message command
- [ ] Add message signing approval
- [ ] Test with dApp authentication
- [ ] Full integration testing

---

## Success Criteria

✅ Can connect Vaughan to PulseX  
✅ Can see account balance in PulseX  
✅ Can approve transactions from PulseX  
✅ Transactions appear on block explorer  
✅ Can sign messages for authentication  
✅ Events work (accountsChanged, chainChanged)  

---

## Next Steps

1. Start with Phase 3.1 (Basic Provider)
2. Test each milestone before moving forward
3. Use PulseX as the primary test dApp
4. Document any issues encountered

**Ready to start?** Let's build the dApp browser! 🚀

