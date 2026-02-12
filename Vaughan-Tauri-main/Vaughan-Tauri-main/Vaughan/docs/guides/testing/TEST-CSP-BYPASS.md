# Test Guide: CSP Bypass with Extension-Style Provider

## Quick Test (5 minutes)

### 1. Start the App
```bash
cd Vaughan
npm run tauri dev
```

Wait for:
- ✅ `Production VaughanState initialized`
- ✅ `WebSocket server started on ws://127.0.0.1:8766`

### 2. Navigate to dApp Browser
- Click "dApp Browser" in sidebar (or navigate to `/dapp-browser-simple`)

### 3. Test with Uniswap (CSP-Protected Site)
1. Click "Uniswap" quick link (or enter `https://app.uniswap.org`)
2. Click "Open dApp" button
3. New window opens with Uniswap

### 4. Check Console (IMPORTANT!)
Open DevTools in the Uniswap window (F12):

**Expected Output**:
```
[Vaughan-Ext] Initializing extension-style provider
[Vaughan-Ext] Connecting to WebSocket...
[Vaughan-Ext] Connected! ✅
[Vaughan-Ext] Provider initialized with chainId: 0x171
[Vaughan-Ext] Provider injected successfully ✅
[Vaughan-Ext] EIP-6963 announcement sent ✅
```

**NO CSP ERRORS!** (This is the key difference)

### 5. Connect Wallet in Uniswap
1. Click "Connect" button in Uniswap
2. Look for "Vaughan Wallet" in the provider list
3. Click "Vaughan Wallet"
4. Should see connection approval in main wallet window
5. Approve connection
6. ✅ Connected!

---

## What to Look For

### ✅ SUCCESS Indicators

1. **Console shows connection**:
   ```
   [Vaughan-Ext] Connected! ✅
   ```

2. **No CSP errors** (this was the problem before):
   ```
   ❌ OLD: "Connecting to 'ws://localhost:8766/' violates CSP directive"
   ✅ NEW: No CSP errors at all!
   ```

3. **Provider available**:
   ```javascript
   // In Uniswap console:
   window.ethereum
   // Should show VaughanProvider object
   ```

4. **Chain ID correct**:
   ```javascript
   await window.ethereum.request({ method: 'eth_chainId' })
   // Should return "0x171" (PulseChain Testnet V4)
   ```

### ❌ FAILURE Indicators

1. **CSP error in console**:
   ```
   Connecting to 'ws://localhost:8766/' violates CSP directive
   ```
   → Provider script not injected via initialization_script

2. **No provider**:
   ```javascript
   window.ethereum
   // undefined
   ```
   → Script didn't run or failed to inject

3. **WebSocket connection failed**:
   ```
   [Vaughan-Ext] WebSocket error: ...
   ```
   → Backend WebSocket server not running

---

## Backend Logs to Check

In the terminal running `npm run tauri dev`:

### On App Start
```
✅ Production VaughanState initialized
✅ WebSocket server started on ws://127.0.0.1:8766
```

### On Window Open
```
[Window] Opening dApp window (direct mode): https://app.uniswap.org
[Window] URL validated: https://app.uniswap.org/
[Window] Generated window label: dapp-xxxxx
[Window] Using custom init_script (xxxxx bytes)
[Window] Provider script prepared (xxxxx bytes)
[Window] WebView window created: dapp-xxxxx
[Window] Window registered: dapp-xxxxx -> https://app.uniswap.org
```

### On WebSocket Connection
```
[WebSocket] New connection from: 127.0.0.1:xxxxx
```

### On Provider Request
```
[WebSocket] Received: {"id":1,"jsonrpc":"2.0","method":"eth_chainId","params":[]}
[WebSocket] Response: {"id":1,"jsonrpc":"2.0","result":"0x171"}
```

---

## Manual Testing Checklist

### Basic Functionality
- [ ] App starts without errors
- [ ] WebSocket server starts on port 8766
- [ ] Can open dApp browser view
- [ ] Can enter URL and click "Open dApp"
- [ ] New window opens with URL

### Provider Injection
- [ ] Console shows `[Vaughan-Ext] Initializing...`
- [ ] Console shows `[Vaughan-Ext] Connected! ✅`
- [ ] Console shows `[Vaughan-Ext] Provider injected successfully ✅`
- [ ] No CSP errors in console
- [ ] `window.ethereum` is defined
- [ ] `window.ethereum.isVaughan === true`

### EIP-1193 Methods
- [ ] `eth_chainId` returns `"0x171"`
- [ ] `eth_accounts` returns empty array (before connection)
- [ ] `eth_requestAccounts` shows approval modal
- [ ] After approval, `eth_accounts` returns account array
- [ ] Can call read methods (balance, block number, etc.)

### Uniswap Integration
- [ ] Uniswap loads without errors
- [ ] "Connect" button works
- [ ] Vaughan Wallet appears in provider list
- [ ] Can connect wallet
- [ ] Account address shows in Uniswap UI
- [ ] Can view token balances
- [ ] Can initiate swap (don't need to complete)

---

## Troubleshooting

### Problem: CSP Error Still Appears

**Cause**: Provider not injected via `initialization_script`

**Fix**:
1. Check that `provider-inject-extension.js` exists in `public/` folder
2. Check that `DappBrowserSimple.tsx` loads the correct script:
   ```typescript
   const providerScript = await fetch('/provider-inject-extension.js')
   ```
3. Check that script is passed to `open_dapp_window`:
   ```typescript
   initScript: providerScript
   ```

### Problem: WebSocket Connection Failed

**Cause**: Backend WebSocket server not running

**Fix**:
1. Check terminal logs for:
   ```
   ✅ WebSocket server started on ws://127.0.0.1:8766
   ```
2. If not present, check `lib.rs` setup function
3. Restart app

### Problem: Provider Not Defined

**Cause**: Script failed to execute or inject

**Fix**:
1. Open DevTools in dApp window
2. Check for JavaScript errors
3. Check that script loaded:
   ```javascript
   // In console:
   window.__VAUGHAN_WINDOW_LABEL__
   // Should show window label
   ```

### Problem: State Not Managed Error

**Cause**: WebSocket handler can't access `VaughanState`

**Fix**:
1. Check `lib.rs` WebSocket handler:
   ```rust
   let state = app_handle_clone.state::<state::VaughanState>();
   let state_ref: &state::VaughanState = &*state;
   ```
2. Ensure state is dereferenced correctly

---

## Success Criteria

✅ **All of these must work**:

1. Uniswap loads without CSP errors
2. Provider connects via WebSocket
3. Can connect wallet in Uniswap
4. Account address shows in Uniswap
5. Can view balances
6. Can initiate transactions (approval modal appears)

---

## Next Steps After Testing

If all tests pass:
1. ✅ CSP bypass is working!
2. Test with other dApps (Aave, Curve, etc.)
3. Test transaction signing flow
4. Test network switching
5. Test with multiple dApp windows

If tests fail:
1. Check troubleshooting section above
2. Check console logs (both frontend and backend)
3. Verify all files are in place
4. Restart app and try again

---

**Expected Result**: Uniswap (and all CSP-protected dApps) work perfectly with Vaughan Wallet! 🎉
