# Vaughan Wallet - Testing Guide

**Date**: February 9, 2026  
**Status**: Ready for Testing  
**App**: Running at `http://localhost:1420/`

---

## 🎯 What to Test

The Vaughan wallet app should now be open in a window. You should see a **welcome screen** with two large buttons.

---

## ✅ Test 1: Create New Wallet

### Steps:
1. Click **"Create New Wallet"** button
2. Choose word count (12 or 24 words)
3. Enter a password (min 8 characters)
4. Confirm password
5. Click **"Create Wallet"**

### Expected Result:
- You should see a grid of 12 or 24 words
- **CRITICAL**: Write these words down! This is your recovery phrase
- Click "Copy to Clipboard" to copy them
- Click "I've Backed It Up" to continue

### Step 3: Confirm Backup
- Check the confirmation checkbox
- Click "Continue"

### Step 4: Success
- You should see a success screen
- Click "Open Wallet"

### Step 5: Main Wallet View
- You should see the main wallet interface
- Network selector (top right)
- Account selector (top right)
- Balance display (should show 0 ETH initially)
- Action buttons (Send, Receive, dApps)
- Token list (should show ETH with 0 balance)

### What to Check:
- ✅ Password validation works (min 8 chars)
- ✅ Password confirmation works
- ✅ Mnemonic is displayed correctly
- ✅ Copy to clipboard works
- ✅ Confirmation checkbox is required
- ✅ Navigation works smoothly
- ✅ Wallet view loads after creation

---

## ✅ Test 2: View Balance

### Steps:
1. After creating wallet, you should be on the main wallet view
2. Look at the balance display (center of screen)

### Expected Result:
- Should show "0.00 ETH" (or similar)
- Should show "$0.00 USD"
- Network name should be displayed (e.g., "Ethereum Mainnet")

### What to Check:
- ✅ Balance displays correctly
- ✅ USD value displays correctly
- ✅ Network name is correct
- ✅ No errors in console

---

## ✅ Test 3: View Account Address

### Steps:
1. Click the **"Receive"** button
2. You should see a QR code and your address

### Expected Result:
- QR code is displayed
- Address is shown below QR code (starts with 0x...)
- "Copy Address" button is available

### What to Check:
- ✅ QR code generates correctly
- ✅ Address is displayed
- ✅ Copy button works
- ✅ Back button returns to wallet

---

## ✅ Test 4: Send Transaction Form

### Steps:
1. Click the **"Send"** button
2. You should see a transaction form

### Expected Result:
- Recipient address input
- Amount input
- Gas settings (limit and price)
- "Estimate Gas" button
- Password input
- "Send Transaction" button

### What to Check:
- ✅ Form displays correctly
- ✅ All inputs are present
- ✅ Validation works (try invalid address)
- ✅ Back button returns to wallet

**Note**: Don't actually send a transaction yet (you have no ETH!)

---

## ✅ Test 5: Lock and Unlock Wallet

### Steps:
1. Close the wallet app window
2. Reopen the app (run `npm run tauri dev` again if needed)

### Expected Result:
- App should detect wallet exists
- Should show **"Welcome Back"** screen
- Should ask for password

### What to Check:
- ✅ Unlock screen appears
- ✅ Password input works
- ✅ Wrong password shows error
- ✅ Correct password unlocks wallet
- ✅ Returns to main wallet view

---

## ✅ Test 6: Import Existing Wallet (Optional)

**Note**: Only do this if you have a test mnemonic. Don't use your real wallet!

### Steps:
1. If you have a wallet, close the app
2. Delete the wallet from OS keychain (or use a different test mnemonic)
3. Reopen the app
4. Click **"Import Wallet"**
5. Enter your 12 or 24 word mnemonic
6. Set a password
7. Choose number of accounts (1-10)
8. Click "Import Wallet"

### Expected Result:
- Wallet imports successfully
- Shows imported addresses
- Redirects to main wallet view
- Balance loads (if wallet has funds)

### What to Check:
- ✅ Mnemonic validation works
- ✅ Password validation works
- ✅ Account count selection works
- ✅ Import succeeds
- ✅ Addresses are displayed
- ✅ Wallet view loads

---

## 🐛 Common Issues

### Issue 1: "State not managed" Error
**Fixed!** The state management issue has been resolved.

### Issue 2: Balance Shows 0
**Expected**: If you just created a wallet, it will have 0 balance. You need to send test ETH to it.

### Issue 3: Network Connection Error
**Possible Causes**:
- No internet connection
- RPC endpoint is down
- Firewall blocking requests

**Solution**: Check internet connection and try again.

### Issue 4: Password Error
**Possible Causes**:
- Password too short (min 8 characters)
- Passwords don't match
- Wrong password on unlock

**Solution**: Check password requirements and try again.

---

## 📊 What to Report

If you find any issues, please report:

1. **What you were doing**: (e.g., "Creating new wallet")
2. **What happened**: (e.g., "Error message appeared")
3. **Error message**: (copy the exact error text)
4. **Console output**: (check browser dev tools console)
5. **Expected behavior**: (what should have happened)

---

## 🎯 Success Criteria

The wallet is working correctly if:

- ✅ You can create a new wallet
- ✅ You can see your mnemonic phrase
- ✅ You can view the main wallet interface
- ✅ You can see your account address
- ✅ You can navigate between views
- ✅ You can lock and unlock the wallet
- ✅ No errors appear in the console

---

## 🚀 Next Steps After Testing

Once basic testing is complete, we can:

1. **Get Test ETH**: Use a faucet to get test ETH on Sepolia testnet
2. **Test Transactions**: Send a real test transaction
3. **Test Network Switching**: Switch between networks
4. **Test Account Management**: Create multiple accounts
5. **Advanced Features**: Transaction history, settings, etc.

---

## 💡 Tips

### Getting Test ETH
1. Switch to Sepolia testnet (if network switching is implemented)
2. Copy your address from the Receive view
3. Visit a Sepolia faucet (e.g., https://sepoliafaucet.com/)
4. Paste your address and request test ETH
5. Wait a few minutes for the transaction to confirm
6. Refresh your wallet to see the balance

### Checking Console
- Press F12 to open browser dev tools
- Click "Console" tab
- Look for any red error messages
- Copy any errors you see

### Restarting the App
If something goes wrong:
1. Close the wallet window
2. Stop the dev server (Ctrl+C in terminal)
3. Run `npm run tauri dev` again
4. Wait for the app to rebuild and open

---

## 📝 Test Results Template

```
## Test Results - [Your Name] - [Date]

### Test 1: Create New Wallet
- Status: ✅ Pass / ❌ Fail
- Notes: [Any issues or observations]

### Test 2: View Balance
- Status: ✅ Pass / ❌ Fail
- Notes: [Any issues or observations]

### Test 3: View Account Address
- Status: ✅ Pass / ❌ Fail
- Notes: [Any issues or observations]

### Test 4: Send Transaction Form
- Status: ✅ Pass / ❌ Fail
- Notes: [Any issues or observations]

### Test 5: Lock and Unlock Wallet
- Status: ✅ Pass / ❌ Fail
- Notes: [Any issues or observations]

### Test 6: Import Existing Wallet
- Status: ✅ Pass / ❌ Fail / ⏭️ Skipped
- Notes: [Any issues or observations]

### Overall Assessment
- Working: [What works well]
- Issues: [What needs fixing]
- Suggestions: [Ideas for improvement]
```

---

## 🎉 Happy Testing!

The wallet is ready for you to test. Take your time and explore all the features. Report any issues you find, and we'll fix them together!

**Remember**: This is a test wallet. Don't use real funds or real mnemonics yet!
