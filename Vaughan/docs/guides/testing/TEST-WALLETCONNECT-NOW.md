# ✅ Test WalletConnect NOW

**Status**: Ready to test  
**App**: http://localhost:1420/  
**Time**: 5 minutes

---

## 🚀 Quick Test Steps

### 1. Unlock Wallet
- Password: `test123` or `1234`

### 2. Go to WalletConnect Browser
Navigate to: **http://localhost:1420/dapp-hybrid**

### 3. Test with Uniswap
1. Enter URL: `https://app.uniswap.org`
2. Click "Go"
3. Wait 3 seconds (iframe will timeout)
4. **WalletConnect instructions should appear**

### 4. Connect from External Browser
1. Open Chrome/Firefox
2. Go to: https://app.uniswap.org
3. Click "Connect Wallet" → "WalletConnect"
4. QR code appears
5. Vaughan should auto-detect the session
6. Approve in Vaughan

### 5. Test Transaction
1. Try a small swap in Uniswap
2. Approval modal should appear in Vaughan
3. Approve or reject

---

## ✅ Success = All These Work

- [ ] Iframe times out after 3 seconds
- [ ] WalletConnect instructions appear
- [ ] Can copy URL to clipboard
- [ ] External browser shows QR code
- [ ] Vaughan detects session
- [ ] Approval modal appears
- [ ] Transaction executes

---

## ❌ If It Doesn't Work

Check console for errors, then we'll implement **WebSocket Bridge** (Option 2).

---

## 📝 What to Report

1. **Did WalletConnect mode activate?** (Yes/No)
2. **Did external browser show QR?** (Yes/No)
3. **Did Vaughan detect session?** (Yes/No)
4. **Did approval modal appear?** (Yes/No)
5. **Any console errors?** (Copy them)

---

**Go test now!** → http://localhost:1420/dapp-hybrid
