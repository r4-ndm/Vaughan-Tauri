# EIP-6963 Testing Guide

## Quick Test (Recommended)

### Test with Real dApp: swap.internetmoney.io

1. **Open Vaughan wallet** (main window)
2. **Click "dApps" button** → Opens dApp browser in separate window
3. **In URL bar, enter**: `https://swap.internetmoney.io`
4. **Press Enter**
5. **Click "Connect Wallet"** button on the website
6. **Look for "Vaughan Wallet"** in the wallet selection modal

**Expected Result**: You should see "Vaughan Wallet" listed alongside MetaMask, Coinbase Wallet, etc.

---

## Test with EIP-6963 Test Page

### Option 1: Via dApp Browser (Correct Way)

1. **Open Vaughan wallet** (main window)
2. **Click "dApps" button** → Opens dApp browser
3. **In URL bar, enter**: `http://localhost:1420/dapp-test-eip6963.html`
4. **Press Enter**
5. **See "Vaughan Wallet" in discovered wallets list**
6. **Click "Vaughan Wallet"** to connect
7. **Approve connection** in modal
8. **Success**: Account displays

### Option 2: Direct Navigation (Won't Work)

❌ **Don't do this**: Navigate directly to `http://localhost:1420/dapp-test-eip6963.html` in browser
- **Why it fails**: No iframe = no ProviderBridge = no postMessage communication
- **Error**: "Request timeout" after 30 seconds

---

## Test with Simple Test Page (Already Works)

1. **Open dApp browser**
2. **Default URL**: `http://localhost:1420/dapp-test-simple.html` (loads automatically)
3. **Click "Connect Wallet"**
4. **Approve connection**
5. **Click "Send Transaction"**
6. **Approve transaction**
7. **Success**: Transaction sent to blockchain

---

## Understanding the Architecture

### How It Works

```
┌─────────────────────────────────────────┐
│ dApp Browser Window                     │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ URL Bar: swap.internetmoney.io    │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ <iframe> (dApp website)           │ │
│  │                                   │ │
│  │  - Emits: eip6963:requestProvider │ │
│  │  - Receives: eip6963:announce...  │ │
│  │  - Shows: [Vaughan, MetaMask...]  │ │
│  │                                   │ │
│  │  Provider injected via:           │ │
│  │  provider-inject.js               │ │
│  └───────────────────────────────────┘ │
│           ↕ postMessage                 │
│  ┌───────────────────────────────────┐ │
│  │ ProviderBridge (React)            │ │
│  │ - Handles postMessage             │ │
│  │ - Calls Tauri commands            │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### Why Direct Navigation Fails

When you navigate directly to a test page (not via dApp browser):
- ❌ No iframe
- ❌ No ProviderBridge
- ❌ No parent window
- ❌ postMessage has nowhere to go
- ❌ Request times out

---

## EIP-6963 Verification Checklist

### Discovery
- [x] Provider announces on page load
- [x] Provider responds to discovery requests
- [x] Provider info includes: uuid, name, icon, rdns
- [x] Icon displays correctly (purple diamond)

### Connection
- [ ] Wallet appears in selection modal
- [ ] Click wallet → connection request
- [ ] Approve → accounts returned
- [ ] Account displays in dApp

### Compatibility
- [ ] Works with swap.internetmoney.io
- [ ] Works with app.uniswap.org
- [ ] Works with app.1inch.io
- [ ] Works with custom test page

---

## Troubleshooting

### "Request timeout" Error
**Cause**: Page loaded outside of dApp browser iframe
**Solution**: Load page via dApp browser URL bar

### "No wallets discovered"
**Cause**: Provider injection failed or EIP-6963 not implemented
**Solution**: Check browser console for "[Vaughan] Provider injected" message

### "Vaughan not in wallet list"
**Cause**: dApp doesn't support EIP-6963 (old dApp)
**Solution**: Try a modern dApp (Uniswap, 1inch, etc.)

### "Connection approved but dApp says not connected"
**Cause**: Session management issue
**Solution**: Check Rust backend logs for session creation

---

## Real-World dApp Testing

### Recommended Test Sites

1. **swap.internetmoney.io**
   - Modern wallet connector
   - Supports EIP-6963
   - Good for testing

2. **app.uniswap.org**
   - Uses Web3Modal
   - Industry standard
   - Comprehensive test

3. **app.1inch.io**
   - Uses custom connector
   - Tests compatibility
   - Real DEX

### What to Look For

✅ **Success Indicators**:
- "Vaughan Wallet" appears in list
- Icon displays (purple diamond)
- Click → connection modal appears
- Approve → dApp shows connected
- Account address displays
- Can sign transactions

❌ **Failure Indicators**:
- Vaughan not in list (only MetaMask, etc.)
- Click → nothing happens
- Connection times out
- dApp shows "No wallet detected"

---

## Next Steps After Successful Test

Once EIP-6963 is verified working:

1. **Replace placeholder icon** with actual Vaughan logo
2. **Test with multiple wallets** (install MetaMask, verify both appear)
3. **Test network switching** (switch to Ethereum, verify dApp updates)
4. **Test transaction signing** (send transaction via dApp)
5. **Production readiness** (add telemetry, error tracking)

---

## Quick Reference

**Test EIP-6963 Discovery**:
```
dApp Browser → http://localhost:1420/dapp-test-eip6963.html
```

**Test Real dApp**:
```
dApp Browser → https://swap.internetmoney.io
```

**Test Simple Flow**:
```
dApp Browser → http://localhost:1420/dapp-test-simple.html (default)
```

---

**Status**: EIP-6963 implemented ✅ | Ready for real-world testing 🚀
