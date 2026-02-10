# WalletConnect Testing Guide

**Status**: Ready to test!  
**Project ID**: Configured ✅  
**Dev Server**: Running on http://localhost:1420/

---

## Quick Test

### 1. Open the Hybrid Browser

Navigate to: **http://localhost:1420/dapp-hybrid**

This will open the smart dApp browser with WalletConnect support.

### 2. Test with PulseX (WalletConnect Mode)

1. In the address bar, enter: `https://app.pulsex.com`
2. Click "Go"
3. The browser will detect that iframe is blocked
4. **WalletConnect modal should appear** with QR code
5. Open PulseX in your regular browser
6. Click "Connect Wallet" → "WalletConnect"
7. Scan the QR code
8. Approve the connection
9. Try a transaction!

### 3. Test with Local dApp (Iframe Mode)

1. In the address bar, enter: `http://localhost:1420/dapp-test-simple.html`
2. Click "Go"
3. Should load in iframe (fast mode)
4. Click "Connect Wallet"
5. Should work seamlessly

---

## What to Look For

### WalletConnect Mode
✅ QR code displays  
✅ Connection instructions shown  
✅ Can copy URI  
✅ dApp in browser can scan QR  
✅ Session establishes  
✅ Transactions work  

### Iframe Mode
✅ Loads instantly  
✅ No QR code needed  
✅ Direct connection  
✅ Transactions work  

### Mode Switching
✅ Automatically detects which mode to use  
✅ Switches between modes when changing URLs  
✅ Shows correct status indicator  

---

## Browser Console

Open browser DevTools (F12) to see logs:

```
[WC] Initializing...
[WC] Initialized successfully
[DappBrowser] Detecting iframe support...
[DappBrowser] Iframe loaded successfully  (or)
[DappBrowser] Iframe failed - switching to WalletConnect
```

---

## Troubleshooting

### "WalletConnect not initialized"
- Check browser console for errors
- Refresh the page
- Check that Project ID is set correctly

### QR code not showing
- Make sure you're on `/dapp-hybrid` route
- Check that WalletConnect dependencies installed
- Look for errors in browser console

### Connection not working
- Make sure wallet is unlocked
- Check that you have an active account
- Verify network is set correctly

---

## Test Checklist

- [ ] Navigate to `/dapp-hybrid`
- [ ] Enter PulseX URL
- [ ] See WalletConnect modal
- [ ] QR code displays
- [ ] Can copy URI
- [ ] Open PulseX in browser
- [ ] Scan QR code
- [ ] Connection establishes
- [ ] Try transaction
- [ ] Switch to local dApp
- [ ] Iframe mode works
- [ ] Mode switching automatic

---

## Next Steps

Once WalletConnect is working:
1. Test with other dApps (Uniswap, etc.)
2. Test account switching
3. Test network switching
4. Test session persistence
5. Test multiple sessions

---

**Ready to test!** Open http://localhost:1420/dapp-hybrid and try connecting to PulseX! 🚀
