# Phase 3.2: Approval Modal Testing Guide

**Date**: 2026-02-09  
**Status**: Ready for Testing  
**Application**: Running on http://localhost:1420/

---

## 🎯 Test Objective

Verify that the approval modal system works correctly with real dApp transactions.

---

## 📋 Prerequisites

### 1. Wallet Setup

**If you don't have a wallet yet:**
1. Open the app (should be running now)
2. Navigate to `/setup`
3. Create a new wallet or import existing
4. Set password: `test123` (or your preferred password)
5. Save your mnemonic securely

**If you already have a wallet:**
1. Unlock with your password
2. Make sure you're on PulseChain Testnet V4

### 2. Network Setup

**Ensure you're on PulseChain Testnet V4:**
- Network: PulseChain Testnet V4
- Chain ID: 943
- RPC: https://rpc.v4.testnet.pulsechain.com

**Get Test Funds:**
1. Copy your wallet address
2. Visit PulseChain Testnet V4 faucet
3. Request test PLS tokens

---

## 🧪 Test Scenarios

### Test 1: Basic Approval Modal Display

**Goal**: Verify modal appears when transaction is requested

**Steps**:
1. Navigate to `/dapp` in the app
2. The dApp browser should load with PulseX (https://app.pulsex.com)
3. Wait for PulseX to load
4. Open browser DevTools (F12) to see console logs

**Expected Result**:
- dApp browser loads successfully
- PulseX interface appears in iframe
- No errors in console

---

### Test 2: Manual Transaction Test (Simpler)

**Goal**: Test approval modal with a simple test page

**Steps**:
1. Navigate to `/dapp` in the app
2. Change URL to: `http://localhost:1420/dapp-test.html`
3. Click "Connect Wallet" button
4. Click "Send Transaction" button

**Expected Result**:
- Approval modal appears within 1 second
- Modal shows:
  - Transaction Request header
  - Origin: http://localhost:1420
  - From address (your address)
  - To address
  - Amount: 0.1 ETH
  - Estimated gas cost
  - Total cost
  - Password input field
  - Reject and Approve buttons

**Test Actions**:

**Action A: Approve Transaction**
1. Enter your password in the password field
2. Click "Approve" button
3. Wait for processing

**Expected**:
- Modal shows "Processing..." state
- Modal closes after approval
- Transaction hash returned to dApp
- Console shows transaction hash

**Action B: Reject Transaction**
1. Click "Reject" button (don't enter password)

**Expected**:
- Modal closes immediately
- dApp receives rejection error
- Console shows "User rejected" error

**Action C: Cancel (Close Modal)**
1. Click outside modal or press Escape
2. Modal should close

**Expected**:
- Modal closes
- Request is cancelled
- dApp receives timeout/cancel error

---

### Test 3: PulseX Integration (Advanced)

**Goal**: Test with real DEX

**Prerequisites**:
- Wallet has test PLS tokens
- Connected to PulseChain Testnet V4

**Steps**:
1. Navigate to `/dapp` in the app
2. URL should be: https://app.pulsex.com
3. Wait for PulseX to load
4. Click "Connect Wallet" in PulseX
5. Approve connection (if connection approval is implemented)
6. Select tokens to swap (e.g., PLS → WPLS)
7. Enter small amount (e.g., 0.01 PLS)
8. Click "Swap" button

**Expected Result**:
- Approval modal appears
- Shows swap transaction details
- Gas estimate displayed
- Total cost calculated

**Test Actions**:
1. Review transaction details
2. Enter password
3. Click "Approve"
4. Wait for transaction to process

**Expected**:
- Transaction sent to blockchain
- PulseX shows "Transaction Pending"
- After confirmation, swap completes
- Balances update

---

## 🔍 What to Check

### Modal Appearance
- ✅ Modal appears within 1 second of transaction request
- ✅ Modal is centered on screen
- ✅ Backdrop darkens background
- ✅ Modal is responsive (try resizing window)

### Transaction Details
- ✅ Origin shows correct dApp URL
- ✅ From address matches your wallet address
- ✅ To address is displayed correctly
- ✅ Amount is human-readable (e.g., "1.5 ETH")
- ✅ Gas limit is shown (e.g., "21,000")
- ✅ Gas cost is calculated correctly
- ✅ Total cost = Amount + Gas cost

### User Interaction
- ✅ Password field accepts input
- ✅ Password is masked (shows dots)
- ✅ Enter key submits form
- ✅ Approve button disabled without password
- ✅ Reject button always enabled
- ✅ Loading state shows during processing
- ✅ Error messages display if something fails

### Backend Integration
- ✅ Polling detects approval requests
- ✅ Approval response sent to backend
- ✅ Backend verifies password
- ✅ Transaction signed and sent
- ✅ Transaction hash returned

---

## 🐛 Common Issues & Solutions

### Issue 1: Modal Doesn't Appear

**Symptoms**: Transaction requested but no modal shows

**Possible Causes**:
1. Polling not working
2. Approval request not created
3. Type mismatch in request

**Debug Steps**:
1. Open DevTools console
2. Check for errors
3. Verify `get_pending_approvals` is being called
4. Check backend logs for approval queue

**Solution**:
- Restart the app
- Check console for errors
- Verify backend is running

---

### Issue 2: Password Rejected

**Symptoms**: "Password incorrect" error after entering password

**Possible Causes**:
1. Wrong password entered
2. Wallet locked
3. Password verification failing

**Debug Steps**:
1. Verify you're using the correct password
2. Try unlocking wallet first
3. Check backend logs

**Solution**:
- Use correct password (default test: `test123`)
- Unlock wallet before testing
- Restart app if needed

---

### Issue 3: Transaction Fails

**Symptoms**: Approval succeeds but transaction fails

**Possible Causes**:
1. Insufficient balance
2. Gas price too low
3. Network issues
4. Invalid transaction parameters

**Debug Steps**:
1. Check wallet balance
2. Verify network connection
3. Check gas price
4. Review transaction parameters

**Solution**:
- Ensure sufficient balance (including gas)
- Check network is PulseChain Testnet V4
- Try with lower amount
- Check RPC endpoint is working

---

## 📊 Test Results Template

Copy this template and fill in your results:

```
## Test Results - Phase 3.2 Approval Modals

**Date**: [Date]
**Tester**: [Your Name]
**Environment**: Windows / Development

### Test 1: Basic Modal Display
- [ ] Modal appears: YES / NO
- [ ] Transaction details correct: YES / NO
- [ ] Gas estimate shown: YES / NO
- [ ] UI responsive: YES / NO
- **Notes**: 

### Test 2: Manual Transaction Test
- [ ] Approve works: YES / NO
- [ ] Reject works: YES / NO
- [ ] Cancel works: YES / NO
- [ ] Password validation: YES / NO
- **Transaction Hash**: 
- **Notes**: 

### Test 3: PulseX Integration
- [ ] PulseX loads: YES / NO
- [ ] Connection works: YES / NO
- [ ] Swap initiated: YES / NO
- [ ] Approval modal appears: YES / NO
- [ ] Transaction sent: YES / NO
- [ ] Transaction confirmed: YES / NO
- **Transaction Hash**: 
- **Notes**: 

### Issues Found
1. 
2. 
3. 

### Overall Assessment
- **Status**: PASS / FAIL / PARTIAL
- **Recommendation**: 
```

---

## 🎯 Success Criteria

The test is successful if:

1. ✅ Approval modal appears automatically when transaction requested
2. ✅ All transaction details displayed correctly
3. ✅ Gas cost calculated and shown
4. ✅ Password input works
5. ✅ Approve button sends transaction
6. ✅ Reject button cancels transaction
7. ✅ Transaction hash returned to dApp
8. ✅ No errors in console
9. ✅ UI is responsive and user-friendly
10. ✅ Works with real dApp (PulseX)

---

## 🚀 Next Steps After Testing

### If Tests Pass:
1. Document any minor issues
2. Test additional approval types (signing, network switch)
3. Test edge cases (timeout, wrong password, etc.)
4. Prepare for production deployment

### If Tests Fail:
1. Document exact failure scenario
2. Capture screenshots/videos
3. Check console errors
4. Review backend logs
5. Report issues for fixing

---

## 💡 Tips for Testing

1. **Use DevTools**: Keep browser console open to see logs
2. **Test Incrementally**: Start with simple test, then move to PulseX
3. **Document Everything**: Take screenshots of issues
4. **Test Edge Cases**: Try wrong password, insufficient balance, etc.
5. **Be Patient**: First transaction may take longer
6. **Check Backend**: Look at terminal for backend logs

---

## 📝 Quick Test Commands

**Check if app is running**:
```bash
# Should show Vaughan window
# Navigate to http://localhost:1420/
```

**Check backend logs**:
```bash
# Look at terminal where you ran `npm run tauri dev`
# Should see approval queue logs
```

**Test with curl** (advanced):
```bash
# Test approval queue directly
curl -X POST http://localhost:1420/api/get_pending_approvals
```

---

## ✅ Ready to Test!

The application is running and ready for testing. Start with Test 2 (Manual Transaction Test) as it's the simplest and most controlled test scenario.

**Current Status**:
- ✅ Backend running
- ✅ Frontend running
- ✅ Approval system implemented
- ✅ Modal components ready
- ✅ Polling active

**Good luck with testing!** 🚀
