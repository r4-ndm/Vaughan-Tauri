# WalletConnect Testing Guide

**Status**: Ready to test  
**Date**: February 10, 2026  
**App Running**: http://localhost:1420/

---

## 🎯 What We're Testing

WalletConnect v2 integration that allows Vaughan to connect to ANY external dApp via QR code scanning.

**How it works**:
1. Open any dApp in your regular browser (Chrome, Firefox, etc.)
2. dApp shows WalletConnect QR code
3. Scan QR code in Vaughan
4. Approve connection
5. Sign transactions in Vaughan

---

## 📋 Pre-Test Checklist

### 1. Unlock Vaughan Wallet

- [ ] Open Vaughan (should be running at http://localhost:1420/)
- [ ] Enter password: `test123` or `1234`
- [ ] Verify you see your wallet balance
- [ ] Verify network is set to **PulseChain (Chain ID: 369)**

### 2. Verify WalletConnect is Initialized

Open browser console (F12) and look for:
```
[WC] Initializing...
[WC] Initialized successfully
```

If you see errors, refresh the page.

---

## 🧪 Test 1: Uniswap (Recommended First Test)

### Step 1: Open Uniswap in Regular Browser

1. Open **Chrome, Firefox, or Edge** (NOT in Vaughan)
2. Go to: https://app.uniswap.org
3. Click **"Connect Wallet"** button (top right)
4. Select **"WalletConnect"** from the list
5. **QR code should appear**

### Step 2: Connect from Vaughan

**Option A: Using Hybrid Browser (Built-in)**
1. In Vaughan, navigate to **dApp Browser** view
2. Enter URL: `https://app.uniswap.org`
3. Click **"Go"**
4. Vaughan will detect iframe is blocked
5. **WalletConnect modal should appear with QR code**
6. Use your phone or another device to scan the QR from Uniswap
7. Approve connection in Vaughan

**Option B: Manual QR Scan (If implemented)**
1. In Vaughan, look for **"Scan QR Code"** button
2. Click it to open scanner
3. Scan the QR code from Uniswap
4. Approve connection

### Step 3: Verify Connection

In Uniswap browser tab:
- [ ] "Connected" status appears
- [ ] Your wallet address is displayed
- [ ] Balance shows correctly

In Vaughan:
- [ ] Connection status shows "Connected via WalletConnect"
- [ ] Session is active

### Step 4: Test Transaction

1. In Uniswap, try to swap tokens (even a small amount)
2. Click **"Swap"**
3. **Approval request should appear in Vaughan**
4. Review transaction details
5. Click **"Approve"** or **"Reject"**
6. Verify transaction executes (if approved)

---

## 🧪 Test 2: PulseX (Native Chain)

### Step 1: Open PulseX

1. In regular browser, go to: https://app.pulsex.com
2. Click **"Connect Wallet"**
3. Select **"WalletConnect"**
4. QR code appears

### Step 2: Connect from Vaughan

Same as Uniswap test above.

### Step 3: Test Swap

1. Try swapping PLS for another token
2. Approve in Vaughan
3. Verify transaction completes

---

## 🧪 Test 3: Iframe Mode (Local dApp)

This tests the fallback iframe mode for localhost content.

### Step 1: Load Local Test Page

1. In Vaughan's dApp Browser
2. Enter URL: `http://localhost:1420/dapp-test-simple.html`
3. Click **"Go"**
4. Should load **instantly** (no QR code)

### Step 2: Test Direct Connection

1. Click **"Connect Wallet"** on test page
2. Should connect immediately (no approval needed for localhost)
3. Click **"Get Accounts"** - should show your address
4. Click **"Get Balance"** - should show balance
5. Click **"Sign Message"** - approval modal should appear

### Step 3: Verify Mode Detection

Check console logs:
```
[DappBrowser] Detecting iframe support...
[DappBrowser] Iframe loaded successfully
[DappBrowser] Mode: Iframe (Direct)
```

---

## 🔍 What to Look For

### ✅ Success Indicators

**WalletConnect Mode**:
- [ ] QR code displays clearly
- [ ] Connection establishes within 5 seconds
- [ ] Session persists across page refreshes
- [ ] Transactions appear in Vaughan for approval
- [ ] Approved transactions execute successfully
- [ ] Rejected transactions are cancelled

**Iframe Mode**:
- [ ] Loads instantly without QR code
- [ ] Direct connection works
- [ ] All RPC methods work
- [ ] Approval modals appear correctly

**General**:
- [ ] No errors in console
- [ ] Smooth mode switching
- [ ] Clear status indicators
- [ ] Responsive UI

### ❌ Failure Indicators

- QR code doesn't appear
- Connection times out
- "WalletConnect not initialized" error
- Transactions don't appear in Vaughan
- Approval modal doesn't show
- Console errors

---

## 🐛 Troubleshooting

### Issue: "WalletConnect not initialized"

**Solution**:
1. Refresh Vaughan
2. Check console for initialization errors
3. Verify Project ID is set in `src/services/walletconnect.ts`
4. Check internet connection

### Issue: QR Code Not Showing

**Solution**:
1. Make sure you're on the `/dapp-hybrid` route
2. Check that WalletConnect dependencies loaded
3. Look for errors in console
4. Try refreshing the page

### Issue: Connection Not Working

**Solution**:
1. Unlock wallet first (password: "test123" or "1234")
2. Make sure you have an active account
3. Verify network is set correctly
4. Check that both devices are on same network (if using phone)

### Issue: Transactions Not Appearing

**Solution**:
1. Check that approval polling is running
2. Look for errors in Rust backend logs
3. Verify session is still active
4. Try reconnecting

### Issue: Iframe Mode Not Working

**Solution**:
1. Verify URL is localhost
2. Check that provider script is injected
3. Look for CSP errors in console
4. Try clearing browser cache

---

## 📊 Test Results Template

### WalletConnect Mode

**Uniswap Test**:
- [ ] QR Code Display: ___
- [ ] Connection Time: ___ seconds
- [ ] Transaction Approval: ___
- [ ] Transaction Execution: ___
- [ ] Notes: ___

**PulseX Test**:
- [ ] QR Code Display: ___
- [ ] Connection Time: ___ seconds
- [ ] Transaction Approval: ___
- [ ] Transaction Execution: ___
- [ ] Notes: ___

### Iframe Mode

**Local Test Page**:
- [ ] Load Time: ___ ms
- [ ] Direct Connection: ___
- [ ] RPC Methods: ___
- [ ] Approval Modals: ___
- [ ] Notes: ___

### Mode Detection

- [ ] Auto-detection: ___
- [ ] Mode Switching: ___
- [ ] Status Display: ___
- [ ] Console Logs: ___

---

## 🎯 Success Criteria

WalletConnect is considered **working** if:

1. ✅ Can connect to Uniswap via QR code
2. ✅ Can approve/reject transactions
3. ✅ Transactions execute successfully
4. ✅ Session persists across refreshes
5. ✅ No console errors
6. ✅ Iframe mode works for localhost
7. ✅ Mode detection is automatic

---

## 📝 Next Steps

### If WalletConnect Works ✅

1. **Test more dApps**:
   - Aave: https://app.aave.com
   - Curve: https://curve.fi
   - SushiSwap: https://app.sushi.com

2. **Polish UI**:
   - Better QR code modal design
   - Session management UI
   - Connection history
   - Disconnect button

3. **Add features**:
   - Multiple simultaneous sessions
   - Session persistence after app restart
   - Connection notifications
   - Transaction history

4. **Documentation**:
   - User guide with screenshots
   - Video tutorial
   - FAQ section

### If WalletConnect Doesn't Work ❌

1. **Document specific issues**:
   - What failed?
   - Error messages?
   - Console logs?
   - Steps to reproduce?

2. **Move to Option 2: WebSocket Bridge**:
   - Implement WebSocket server in Rust
   - Update provider to use WebSocket
   - Test with external URLs
   - Compare with WalletConnect

---

## 🔑 Key Information

**Test Credentials**:
- Password: `test123` or `1234`
- Network: PulseChain (Chain ID: 369)

**URLs**:
- Vaughan: http://localhost:1420/
- Test Page: http://localhost:1420/dapp-test-simple.html
- Proxy (debug): http://localhost:8765/

**WalletConnect**:
- Project ID: `afd4137784d97fd3cc85a0cb81000967`
- Version: v2
- Protocol: WebSocket

---

## 🚀 Ready to Test!

1. Make sure Vaughan is unlocked
2. Open Uniswap in regular browser
3. Click "Connect Wallet" → "WalletConnect"
4. Scan QR code from Vaughan
5. Try a transaction!

**Good luck!** 🎉

---

**Questions or Issues?**
- Check console logs (F12)
- Review `src/services/walletconnect.ts`
- Check `src/hooks/useWalletConnect.ts`
- Look at `EXTERNAL-DAPP-SOLUTIONS-SUMMARY.md`
