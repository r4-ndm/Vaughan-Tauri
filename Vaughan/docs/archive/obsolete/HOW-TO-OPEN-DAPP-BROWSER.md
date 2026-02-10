# How to Open dApp Browser

**Updated**: February 10, 2026

---

## 🎯 Quick Access

### Option 1: From Wallet View (Easiest)

1. **Unlock your wallet** (password: `test123` or `1234`)
2. You'll see the main wallet screen
3. Look for the button: **"🌐 Open dApp Browser"**
4. Click it
5. ✅ dApp browser opens!

### Option 2: Direct URL

Navigate directly to:
```
http://localhost:1420/dapp-hybrid
```

---

## 🧪 Testing the dApp Browser

Once the dApp browser opens:

1. **You'll see an address bar** at the top
2. **Enter a URL**, for example:
   - `https://app.uniswap.org`
   - `https://app.pulsex.com`
   - `http://localhost:1420/dapp-test-simple.html` (local test)

3. **Click "Go"**

4. **What happens next**:
   - Browser tries to load in iframe (3 second timeout)
   - If iframe fails (CSP block), switches to WalletConnect mode
   - Shows instructions for connecting

---

## 🔍 What You Should See

### For Localhost URLs (like test page):
- ✅ Loads instantly in iframe
- ✅ Direct connection
- ✅ No QR codes needed
- ✅ Works perfectly

### For External URLs (like Uniswap):
- ⏱️ 3 second timeout
- 🔄 Switches to WalletConnect mode
- 📱 Shows connection instructions
- 📋 Provides URL to copy

---

## 🐛 If It Doesn't Work

### Issue: Button not visible
- **Fix**: Refresh the page (Ctrl+R)
- The changes should have hot-reloaded

### Issue: Browser opens but nothing loads
- **Fix**: Check browser console (F12) for errors
- Look for network errors or CSP violations

### Issue: Can't enter URL
- **Fix**: Make sure you're on the `/dapp-hybrid` route
- Check the URL bar shows: `http://localhost:1420/dapp-hybrid`

---

## 📝 Current Status

**What Works**:
- ✅ Navigation button added
- ✅ dApp browser route exists
- ✅ Iframe mode works for localhost
- ✅ WalletConnect mode exists (but may not work fully)

**What We're Building Next**:
- 🔧 WebSocket Bridge (for direct external dApp connection)
- 🔧 No QR codes needed
- 🔧 Seamless UX

---

## 🚀 Next Steps

1. **Try it now**: Click "🌐 Open dApp Browser" button
2. **Test with local page**: `http://localhost:1420/dapp-test-simple.html`
3. **Test with Uniswap**: `https://app.uniswap.org`
4. **Report back**: What works? What doesn't?

Then we'll implement the WebSocket Bridge for a better solution!

---

**Ready to test!** 🎉
