# Testing Checklist - Auto-Connect & dApp Compatibility

**Date**: 2026-02-10  
**Build**: Latest (with auto-connect restoration)

---

## ✅ What Should Work

### Uniswap (https://app.uniswap.org)
1. Open Uniswap from wallet
2. Provider should initialize automatically
3. Wallet should show as connected (no "Connect Wallet" button)
4. Should see your address in top-right corner

**Expected Console Logs**:
```
[Vaughan-Ext] Initializing provider...
[Vaughan-Ext] Connected to port 8766! ✅
[Vaughan-Ext] Provider initialized with chainId: 0x171
[Vaughan-Ext] Checking for existing accounts (auto-connect)...
[Vaughan-Ext] Auto-connect: Found existing accounts: ["0x..."]
```

### Aave, 1inch, SushiSwap
Same behavior as Uniswap - should auto-connect.

---

## ❌ What Won't Work

### OpenSea (https://opensea.io)
1. Opens but WebSocket connection fails
2. CSP blocks localhost connections
3. Session created but unusable

**Expected Console Logs**:
```
[Vaughan-Ext] Initializing provider...
[Vaughan-Ext] Connecting to WebSocket on port 8766...
[Vaughan-Ext] WebSocket error: Event
[Vaughan-Ext] ⚠️ OpenSea blocks WebSocket connections due to CSP
```

**Status**: Known limitation, documented

---

## 🔍 Debug Steps

### If Auto-Connect Doesn't Work

1. **Check Rust Console** for session creation:
```
[Window] Creating auto-approved session for account: 0x...
[Window] Auto-approved session created successfully
```

2. **Check Browser Console** for provider initialization:
```
[Vaughan-Ext] Checking for existing accounts (auto-connect)...
[Vaughan-Ext] Request: eth_accounts []
```

3. **Check Rust Console** for session lookup:
```
[RPC] eth_accounts - Found session for window: dapp-abc123, auto_approved: true
```

### If WebSocket Doesn't Connect

1. **Check port** in browser console:
```
[Vaughan-Ext] Using injected WebSocket port: 8766
```

2. **Check Rust Console** for WebSocket server:
```
[WebSocket] Server started on 127.0.0.1:8766
```

3. **Try manual connection** in browser console:
```javascript
const ws = new WebSocket('ws://localhost:8766');
ws.onopen = () => console.log('✅ Connected!');
ws.onerror = (e) => console.error('❌ Failed:', e);
```

---

## 📝 Test Results

### Uniswap
- [ ] Opens successfully
- [ ] Provider initializes
- [ ] Auto-connects (no button click needed)
- [ ] Can see account address
- [ ] Can interact with dApp

### Aave
- [ ] Opens successfully
- [ ] Auto-connects
- [ ] Works correctly

### 1inch
- [ ] Opens successfully
- [ ] Auto-connects
- [ ] Works correctly

### OpenSea
- [ ] Opens (but doesn't connect)
- [ ] CSP error in console
- [ ] Documented as known limitation

---

## 🎯 Success Criteria

**Auto-connect is working if**:
1. Uniswap opens and shows wallet as connected immediately
2. No "Connect Wallet" button click needed
3. Console shows "Auto-connect: Found existing accounts"

**If it's not working**:
1. Share Rust console logs
2. Share browser console logs
3. We'll debug together

---

**Status**: Ready for testing
