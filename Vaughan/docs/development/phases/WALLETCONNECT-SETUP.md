# WalletConnect Setup Guide

Quick guide to get WalletConnect working in Vaughan Wallet.

---

## Step 1: Get WalletConnect Project ID (2 minutes)

1. Go to https://cloud.walletconnect.com
2. Click "Sign Up" (or "Sign In" if you have an account)
3. Create a new project:
   - Name: "Vaughan Wallet"
   - Homepage URL: "https://vaughan.io" (or your URL)
4. Copy the **Project ID** (looks like: `a1b2c3d4e5f6...`)

---

## Step 2: Update Configuration

Open `Vaughan/src/services/walletconnect.ts` and update line 11:

```typescript
// Before
const PROJECT_ID = 'YOUR_PROJECT_ID';

// After
const PROJECT_ID = 'a1b2c3d4e5f6...'; // Your actual project ID
```

---

## Step 3: Test It!

### Test Iframe Mode (Fast Path)
```bash
cd Vaughan
npm run dev
```

1. Open the dApp browser
2. Enter URL: `http://localhost:1420/dapp-test-simple.html`
3. Should load in iframe ✅
4. Click "Connect Wallet"
5. Should work seamlessly

### Test WalletConnect Mode (Fallback)
1. Enter URL: `https://app.pulsex.com`
2. Iframe will fail (CSP block detected)
3. WalletConnect modal appears automatically ✅
4. QR code displayed
5. Open PulseX in your browser
6. Click "Connect Wallet" → "WalletConnect"
7. Scan the QR code with your phone or use the URI
8. Approve the connection
9. Transactions will now go through Vaughan! ✅

---

## Troubleshooting

### "WalletConnect not initialized"
- Make sure you updated the PROJECT_ID
- Check browser console for errors
- Restart dev server

### "Session rejected"
- This is normal if you reject the connection
- Try connecting again

### QR code not showing
- Check that WalletConnect dependencies installed: `npm install`
- Check browser console for errors

### Iframe not loading
- This is expected for dApps with CSP restrictions
- The system should automatically switch to WalletConnect mode
- If it doesn't, check browser console

---

## How to Use

### For Iframe-Friendly dApps
1. Enter dApp URL
2. Click "Connect"
3. Done! ✅

### For Iframe-Blocked dApps
1. Enter dApp URL
2. System detects CSP block
3. QR code modal appears
4. Open dApp in browser
5. Scan QR code
6. Approve connection
7. Done! ✅

---

## What Works

- ✅ All EIP-1193 methods
- ✅ eth_sendTransaction
- ✅ eth_sign
- ✅ personal_sign
- ✅ eth_signTypedData
- ✅ Account switching
- ✅ Chain switching
- ✅ Session management

---

## Free Tier Limits

WalletConnect Cloud free tier:
- 1,000,000 requests/month
- Unlimited projects
- Community support

This is more than enough for development and testing!

---

## Next Steps

Once WalletConnect is working:
1. Test with various dApps (Uniswap, PulseX, etc.)
2. Test account switching
3. Test chain switching
4. Test transaction signing
5. Build your dApp ecosystem!

---

## Support

- WalletConnect Docs: https://docs.walletconnect.com
- WalletConnect Discord: https://discord.gg/walletconnect
- Vaughan Issues: (your GitHub repo)

---

**That's it!** You now have universal dApp compatibility. 🎉
