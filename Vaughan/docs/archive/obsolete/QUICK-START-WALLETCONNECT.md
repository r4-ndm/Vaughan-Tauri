# Quick Start: Test WalletConnect NOW

**App is running**: http://localhost:1420/

---

## 🚀 5-Minute Test

### Step 1: Unlock Wallet (30 seconds)

1. Open Vaughan (should already be open)
2. If you see "Unlock Wallet" screen:
   - Enter password: `test123` or `1234`
   - Click "Unlock"
3. You should see your wallet balance

### Step 2: Navigate to WalletConnect Browser (10 seconds)

In your browser, go to:
```
http://localhost:1420/dapp-hybrid
```

Or click the "dApp Browser" button in the wallet view.

### Step 3: Test with Uniswap (2 minutes)

**Option A: Built-in Browser (Easiest)**
1. In the address bar, type: `https://app.uniswap.org`
2. Click "Go"
3. Vaughan will detect iframe is blocked
4. **WalletConnect QR code should appear**

**Option B: External Browser (Real-world test)**
1. Open Chrome/Firefox
2. Go to: https://app.uniswap.org
3. Click "Connect Wallet" → "WalletConnect"
4. QR code appears
5. Scan it from Vaughan (if QR scanner is implemented)

### Step 4: Connect & Test (2 minutes)

1. Connection should establish
2. Try a small swap
3. Approval modal should appear in Vaughan
4. Approve or reject
5. Done! ✅

---

## 🎯 What Should Happen

### ✅ Success Looks Like:

1. **QR Code Appears**: Either in Vaughan or in external browser
2. **Connection Establishes**: Within 5 seconds
3. **Status Shows**: "Connected via WalletConnect"
4. **Transactions Work**: Approval modal appears in Vaughan
5. **No Errors**: Console is clean

### ❌ Failure Looks Like:

1. **No QR Code**: Check console for errors
2. **Connection Timeout**: Check internet connection
3. **"Not Initialized"**: Refresh Vaughan
4. **No Approval Modal**: Check backend logs

---

## 🐛 Quick Fixes

**Problem**: "WalletConnect not initialized"
- **Fix**: Refresh the page (Ctrl+R)

**Problem**: QR code doesn't show
- **Fix**: Make sure you're at `/dapp-hybrid` route

**Problem**: Connection doesn't work
- **Fix**: Make sure wallet is unlocked first

**Problem**: Transactions don't appear
- **Fix**: Check console for errors, try reconnecting

---

## 📊 Quick Test Results

After testing, answer these:

1. **Did QR code appear?** Yes / No
2. **Did connection work?** Yes / No
3. **Did transaction approval appear?** Yes / No
4. **Any errors in console?** Yes / No

If all "Yes" except last one → **WalletConnect works!** ✅

If any "No" → Check `WALLETCONNECT-TEST-GUIDE.md` for detailed troubleshooting

---

## 🔄 If WalletConnect Doesn't Work

We'll move to **Option 2: WebSocket Bridge**

This will take 2-3 days to implement but will give us:
- Direct communication with external dApps
- No QR codes needed
- Lower latency
- More control

---

## 📝 Current Implementation Files

If you need to debug:

- **Service**: `src/services/walletconnect.ts`
- **Hook**: `src/hooks/useWalletConnect.ts`
- **Modal**: `src/components/WalletConnectModal/WalletConnectModal.tsx`
- **Browser**: `src/views/DappBrowserView/DappBrowserHybrid.tsx`

---

**Ready? Go test!** 🚀

Navigate to: http://localhost:1420/dapp-hybrid
