# Phase 3.6: WalletConnect Integration Plan

**Goal**: Universal dApp compatibility with hybrid iframe + WalletConnect approach

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Vaughan Wallet                        │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │         Smart dApp Browser Component               │ │
│  │                                                    │ │
│  │  1. Try Iframe First                              │ │
│  │     ├─ Load dApp in iframe                        │ │
│  │     ├─ Inject provider via postMessage            │ │
│  │     └─ Detect CSP errors                          │ │
│  │                                                    │ │
│  │  2. Fallback to WalletConnect                     │ │
│  │     ├─ Show QR code / deep link                   │ │
│  │     ├─ Establish WC session                       │ │
│  │     └─ Handle WC requests                         │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │         Existing Rust Backend                      │ │
│  │  (No changes needed - reuse existing commands)     │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Add WalletConnect Dependencies
- Add `@walletconnect/web3wallet` (v2 SDK)
- Add QR code library for display
- Configure WalletConnect project ID

### Step 2: Create WalletConnect Service
- Initialize Web3Wallet
- Handle session proposals
- Handle session requests
- Map WC requests to existing Tauri commands

### Step 3: Update DappBrowser Component
- Add iframe error detection
- Add WalletConnect UI (QR code, connection status)
- Implement mode switching (iframe ↔ WalletConnect)
- Add user feedback for connection method

### Step 4: Create Connection Flow
```
User enters dApp URL
    ↓
Try iframe load
    ↓
    ├─ Success? → Use iframe mode ✅
    │   └─ Inject provider via postMessage
    │
    └─ CSP Error? → Switch to WalletConnect mode 🔄
        ├─ Show QR code
        ├─ Wait for dApp to scan
        └─ Handle WC requests
```

### Step 5: Testing
- Test iframe mode with friendly dApps
- Test WalletConnect mode with blocked dApps
- Test mode switching
- Test all EIP-1193 methods via both modes

---

## Technical Details

### WalletConnect Request Mapping

WalletConnect requests will be mapped to existing Tauri commands:

```typescript
// WalletConnect request
{
  method: 'eth_sendTransaction',
  params: [{ from, to, value, ... }]
}

// Maps to existing Tauri command
invoke('dapp_request', {
  origin: wcSession.peer.metadata.url,
  request: {
    id: wcRequest.id,
    method: 'eth_sendTransaction',
    params: wcRequest.params,
    timestamp: Date.now()
  }
})
```

**Key insight**: WalletConnect is just another transport layer. The business logic (approvals, signing, etc.) stays the same!

### CSP Error Detection

```typescript
// Detect iframe CSP errors
iframe.onerror = () => {
  console.log('Iframe failed to load - likely CSP block');
  switchToWalletConnectMode();
};

// Also check for X-Frame-Options
fetch(url, { method: 'HEAD' })
  .then(res => {
    const xFrameOptions = res.headers.get('X-Frame-Options');
    if (xFrameOptions === 'DENY' || xFrameOptions === 'SAMEORIGIN') {
      switchToWalletConnectMode();
    }
  });
```

### WalletConnect Session Management

```typescript
// Store active sessions
interface WCSession {
  topic: string;
  peer: {
    metadata: {
      name: string;
      url: string;
      icons: string[];
    }
  };
  namespaces: {
    eip155: {
      accounts: string[];
      chains: string[];
      methods: string[];
      events: string[];
    }
  };
}
```

---

## File Structure

```
Vaughan/
├── src/
│   ├── services/
│   │   └── walletconnect.ts          # NEW: WalletConnect service
│   ├── hooks/
│   │   ├── useProviderBridge.ts      # EXISTING: Iframe mode
│   │   └── useWalletConnect.ts       # NEW: WalletConnect mode
│   ├── components/
│   │   └── WalletConnectModal/
│   │       ├── WalletConnectModal.tsx    # NEW: QR code + status
│   │       └── ConnectionStatus.tsx      # NEW: Connection indicator
│   └── views/
│       └── DappBrowserView/
│           └── DappBrowserHybrid.tsx     # NEW: Smart browser
├── src-tauri/
│   └── src/
│       └── commands/
│           └── dapp.rs               # EXISTING: No changes needed!
└── package.json                      # UPDATE: Add WC dependencies
```

---

## Dependencies to Add

```json
{
  "dependencies": {
    "@walletconnect/web3wallet": "^1.11.0",
    "@walletconnect/utils": "^2.11.0",
    "qrcode.react": "^3.1.0"
  }
}
```

---

## User Experience

### Iframe Mode (Fast Path)
```
1. User enters URL
2. Iframe loads instantly
3. Provider injected
4. User interacts with dApp
   ✅ Fast, seamless, no extra steps
```

### WalletConnect Mode (Fallback)
```
1. User enters URL
2. Iframe fails (CSP error detected)
3. Show message: "This dApp requires WalletConnect"
4. Display QR code
5. User opens dApp in browser
6. dApp scans QR code
7. Connection established
8. User interacts with dApp
   ✅ Works with ALL dApps
```

---

## Security Considerations

### WalletConnect Security
- ✅ End-to-end encrypted
- ✅ User approves each session
- ✅ User approves each transaction
- ✅ Sessions can be disconnected anytime
- ✅ No private keys exposed

### Iframe Security
- ✅ PostMessage origin validation
- ✅ Request validation in Rust
- ✅ Rate limiting
- ✅ Session management

**Both modes use the same Rust backend** → Same security guarantees!

---

## Advantages of This Approach

1. **Universal Compatibility**
   - Iframe mode: Fast, seamless UX
   - WalletConnect mode: Works with 100% of dApps

2. **No Code Duplication**
   - Both modes use same Rust backend
   - Same approval flow
   - Same transaction signing
   - Same security model

3. **Progressive Enhancement**
   - Try best experience first (iframe)
   - Gracefully fallback to universal solution (WC)
   - User always has a working path

4. **Future-Proof**
   - If dApp adds iframe support → Automatically use faster mode
   - If dApp removes iframe support → Automatically fallback
   - No manual configuration needed

---

## Testing Strategy

### Test Cases

1. **Iframe-Friendly dApp** (e.g., localhost test page)
   - Should use iframe mode
   - Should NOT show WalletConnect UI
   - Should work seamlessly

2. **Iframe-Blocked dApp** (e.g., PulseX)
   - Should detect CSP error
   - Should switch to WalletConnect mode
   - Should show QR code
   - Should establish WC session

3. **Mode Switching**
   - Load iframe-friendly dApp → iframe mode
   - Load iframe-blocked dApp → WC mode
   - Switch between dApps → Correct mode each time

4. **All EIP-1193 Methods**
   - Test via iframe mode
   - Test via WalletConnect mode
   - Both should work identically

---

## Timeline Estimate

- **Step 1** (Dependencies): 15 minutes
- **Step 2** (WC Service): 2 hours
- **Step 3** (UI Components): 2 hours
- **Step 4** (Integration): 1 hour
- **Step 5** (Testing): 1 hour

**Total**: ~6 hours of focused work

---

## Next Steps

1. ✅ Create this plan document
2. ⏳ Add WalletConnect dependencies
3. ⏳ Create WalletConnect service
4. ⏳ Create WalletConnect UI components
5. ⏳ Update DappBrowser with hybrid logic
6. ⏳ Test with real dApps

---

## Success Criteria

- ✅ Iframe mode works with friendly dApps (already done!)
- ✅ WalletConnect mode works with blocked dApps
- ✅ Automatic mode detection and switching
- ✅ All EIP-1193 methods work in both modes
- ✅ User can connect to ANY dApp
- ✅ No changes to Rust backend needed

---

**Status**: Ready to implement
**Blocked by**: None
**Risk level**: Low (WalletConnect is battle-tested, iframe mode already works)
