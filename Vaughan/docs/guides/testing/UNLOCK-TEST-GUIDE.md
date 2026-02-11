# Unlock Flow Test Guide 🔓

**Date**: February 9, 2026  
**Purpose**: Test that account loading works correctly after unlocking wallet

---

## 🎯 What We're Testing

After the fixes, the unlock flow should:
1. ✅ Accept password and unlock wallet
2. ✅ Load accounts from backend
3. ✅ Set first account as active
4. ✅ Display account address in UI
5. ✅ Load and display balance (0 ETH for new testnet account)
6. ✅ Show network info (Ethereum Sepolia, Chain ID: 11155111)

---

## 📋 Prerequisites

- Wallet already created with password "1234"
- Wallet is currently locked (window closed or app restarted)
- Network: Ethereum Sepolia testnet
- Expected account: `0xe932...8cff` (or similar)

---

## 🧪 Test Steps

### Step 1: Close Current Window
1. Close the Tauri app window completely
2. This ensures the wallet is locked

### Step 2: Restart App
1. In terminal, navigate to `Vaughan` directory
2. Run: `npm run tauri dev`
3. Wait for app to open

### Step 3: Unlock Wallet
1. You should see the "Welcome Back" unlock screen
2. Enter password: `1234`
3. Click "Unlock Wallet"

### Step 4: Verify Success
After unlocking, you should see:

**✅ Expected Results:**
- Account selector shows: "Account 1" with address `0xe932...8cff`
- Network selector shows: "Ethereum Sepolia" with "Chain ID: 11155111"
- Balance shows: "0 ETH" (or "0.0000 ETH")
- No error messages
- Send/Receive buttons are enabled

**❌ If You See Errors:**
- "No accounts" → Account loading failed
- "Failed to load balance" → Active account not set
- "Network not initialized" → Network initialization failed

---

## 🐛 What to Report

### If Successful ✅
Report:
```
✅ UNLOCK TEST PASSED
- Account loaded: [address]
- Balance displayed: [amount]
- Network: [network name]
- Chain ID: [chain id]
```

### If Failed ❌
Report:
1. **Error messages** (from browser console - press F12)
2. **What you see** in the UI
3. **Screenshot** if possible

---

## 🔍 Debug Info

If there are issues, check browser console (F12) for:

**Good Signs:**
```
✅ No error messages
✅ Network info loads
✅ Account address displays
```

**Bad Signs:**
```
❌ "Failed to load network"
❌ "Failed to load balance"
❌ "No accounts"
❌ Any Tauri invoke errors
```

---

## 🎉 Success Criteria

The test is **SUCCESSFUL** if:
1. Unlock completes without errors
2. Account address displays in UI
3. Network info displays correctly
4. Balance loads (even if 0 ETH)
5. No console errors

If all criteria pass, **Phase 2 is 100% COMPLETE!** 🚀

---

## 📝 Technical Details

### What Changed
1. Added `set_active_account` command to backend (23rd command)
2. Updated `UnlockWalletView` to call `setActiveAccount` after unlock
3. Updated `CreateWalletView` to load accounts after creation
4. Updated `ImportWalletView` to load accounts after import
5. Added default network initialization in `VaughanState::new()`

### Code Flow
```
User enters password
    ↓
unlockWallet(password)
    ↓
getAccounts()
    ↓
setActiveAccount(accounts[0].address)
    ↓
Navigate to /wallet
    ↓
WalletView loads balance/tokens
```

---

## 🚀 Next Steps After Success

Once unlock test passes:
1. ✅ Mark Phase 2 as 100% complete
2. 🎉 Celebrate! You have a working wallet!
3. 📝 Document the achievement
4. 🔜 Plan Phase 3 (dApp Provider API)

---

**Ready to test?** Close the app and restart it! 🚀
