# Real dApp Testing Guide

**Date**: 2026-02-10  
**Phase**: 3.4 Native WebView Redesign  
**Status**: Ready for Testing

---

## 🎯 Overview

This guide walks you through testing Vaughan Wallet with real-world dApps to verify:
- EIP-1193 provider compatibility
- EIP-6963 wallet discovery
- Connection flow (eth_requestAccounts)
- Transaction signing (eth_sendTransaction)
- State synchronization (account/network changes)
- Multi-window support

---

## 🚀 Quick Start

### 1. Start the Application

```bash
cd Vaughan
npm run tauri dev
```

**Wait for**: "Compiled successfully" message

### 2. Unlock Wallet

- Password: `test123` or `1234`
- Current Network: **PulseChain Testnet V4** (Chain ID: 943)

### 3. Open dApp Browser

- Click **"dApps"** button in main wallet
- Native WebView window should open

---

## 🧪 Test Scenarios

### Test 1: Local Test dApp (Warm-up)

**Purpose**: Verify basic provider functionality

**Steps**:
1. In dApp browser, navigate to: `http://localhost:1420/dapp-test.html`
2. Click **"Check if window.ethereum exists"**
   - ✅ Should show: "window.ethereum exists!"
3. Click **"Get Chain ID"**
   - ✅ Should show: `0x3af` (943 in decimal)
4. Click **"Connect"**
   - ✅ Approval modal should appear in main wallet
   - ✅ Approve connection
   - ✅ Should show connected account address
5. Click **"Send Transaction"**
   - ✅ Transaction approval modal should appear
   - ✅ Approve transaction
   - ✅ Should show transaction hash

**Expected Results**:
- ✅ All buttons work
- ✅ No console errors
- ✅ Approvals appear in main wallet
- ✅ State updates in real-time

---

### Test 2: PulseChain DEX (swap.internetmoney.io)

**Purpose**: Test with real PulseChain dApp

**Prerequisites**:
- Network: PulseChain Testnet V4 (Chain ID: 943)
- Some test PLS in wallet

**Steps**:
1. In dApp browser, navigate to: `https://swap.internetmoney.io`
2. Look for **"Connect Wallet"** button
3. Click **"Connect Wallet"**
   - ✅ Should see Vaughan in wallet list (EIP-6963 discovery)
   - ✅ Click Vaughan
4. Approve connection in main wallet
   - ✅ Connection approval modal appears
   - ✅ Shows origin: `swap.internetmoney.io`
   - ✅ Approve
5. Verify connection
   - ✅ dApp shows connected account
   - ✅ dApp shows correct network (PulseChain)
6. Test swap (optional, requires test tokens)
   - Select tokens to swap
   - Enter amount
   - Click "Swap"
   - ✅ Transaction approval modal appears
   - ✅ Shows transaction details
   - ✅ Approve or reject

**Expected Results**:
- ✅ Vaughan appears in wallet list
- ✅ Connection works smoothly
- ✅ Account/network displayed correctly
- ✅ Transaction approval works

**Troubleshooting**:
- If Vaughan doesn't appear: Check EIP-6963 implementation
- If connection fails: Check console for errors
- If wrong network: Switch to PulseChain Testnet V4

---

### Test 3: Ethereum DEX (app.uniswap.org)

**Purpose**: Test with Ethereum mainnet dApp

**Prerequisites**:
- Network: Switch to **Ethereum Mainnet** (Chain ID: 1)
- Some test ETH (or just test connection)

**Steps**:
1. In main wallet, switch network to **Ethereum Mainnet**
   - ✅ dApp should auto-update (chainChanged event)
2. In dApp browser, navigate to: `https://app.uniswap.org`
3. Click **"Connect Wallet"**
   - ✅ Should see Vaughan in wallet list
4. Select Vaughan and approve connection
5. Verify connection
   - ✅ Shows connected account
   - ✅ Shows Ethereum network
6. Test swap (optional)
   - Follow same steps as Test 2

**Expected Results**:
- ✅ Network switch propagates to dApp
- ✅ Connection works on Ethereum
- ✅ All features work as expected

---

### Test 4: Multi-Window Support

**Purpose**: Verify multiple dApp windows work independently

**Steps**:
1. Open first dApp window (swap.internetmoney.io)
2. Connect wallet in first window
3. Open second dApp window (app.uniswap.org)
   - Click "dApps" button again
   - Navigate to different URL
4. Connect wallet in second window
5. Verify both windows work independently
   - ✅ Each has own session
   - ✅ Each can make requests
   - ✅ No cross-window interference
6. Change account in main wallet
   - ✅ Both windows should update (accountsChanged event)
7. Change network in main wallet
   - ✅ Both windows should update (chainChanged event)

**Expected Results**:
- ✅ Multiple windows open successfully
- ✅ Each window has isolated session
- ✅ State syncs to all windows
- ✅ No memory leaks or crashes

---

### Test 5: State Synchronization

**Purpose**: Verify real-time state updates

**Steps**:
1. Connect dApp (any from above)
2. In main wallet, switch to different account
   - ✅ dApp should receive `accountsChanged` event
   - ✅ dApp should update displayed account
3. In main wallet, switch to different network
   - ✅ dApp should receive `chainChanged` event
   - ✅ dApp should update displayed network
4. Verify dApp responds correctly
   - ✅ No errors in console
   - ✅ UI updates smoothly

**Expected Results**:
- ✅ Account changes propagate instantly
- ✅ Network changes propagate instantly
- ✅ dApp UI updates correctly
- ✅ No disconnections or errors

---

### Test 6: Error Handling

**Purpose**: Verify graceful error handling

**Steps**:
1. Connect dApp
2. Reject connection approval
   - ✅ dApp should receive error
   - ✅ Error message should be clear
3. Initiate transaction
4. Reject transaction approval
   - ✅ dApp should receive error
   - ✅ No hung requests
5. Close dApp window while request pending
   - ✅ Request should timeout
   - ✅ No memory leaks

**Expected Results**:
- ✅ Rejections handled gracefully
- ✅ Clear error messages
- ✅ No hung requests
- ✅ Proper cleanup

---

## 🔍 What to Look For

### ✅ Success Indicators

**Provider Detection**:
- Vaughan appears in wallet connection lists
- EIP-6963 discovery works
- `window.ethereum` is available

**Connection Flow**:
- Approval modal appears in main wallet
- Shows correct origin
- Connection succeeds after approval
- Account displayed in dApp

**Transaction Flow**:
- Transaction approval modal appears
- Shows transaction details (to, value, gas)
- Transaction succeeds after approval
- Transaction hash returned

**State Synchronization**:
- Account changes propagate to dApp
- Network changes propagate to dApp
- Events fire in real-time
- No delays or disconnections

**Multi-Window**:
- Multiple windows open successfully
- Each window works independently
- State syncs to all windows
- No cross-window interference

### ❌ Issues to Report

**Provider Issues**:
- Vaughan not appearing in wallet lists
- `window.ethereum` undefined
- EIP-6963 not working

**Connection Issues**:
- Approval modal not appearing
- Connection hanging
- Wrong origin displayed
- Connection rejected incorrectly

**Transaction Issues**:
- Transaction approval not appearing
- Transaction hanging
- Wrong transaction details
- Transaction failing unexpectedly

**State Issues**:
- Account changes not propagating
- Network changes not propagating
- Events not firing
- Disconnections

**Window Issues**:
- Windows not opening
- Windows crashing
- Cross-window interference
- Memory leaks

---

## 🐛 Troubleshooting

### Issue: Vaughan Not Appearing in Wallet List

**Possible Causes**:
- EIP-6963 not implemented correctly
- Provider not injected before page load
- dApp doesn't support EIP-6963

**Solutions**:
1. Check browser console for errors
2. Verify `window.ethereum` exists: `console.log(window.ethereum)`
3. Check if dApp uses EIP-6963: Look for `eip6963:requestProvider` event
4. Try refreshing the page

### Issue: Connection Hanging

**Possible Causes**:
- Approval modal not appearing
- Request timeout
- Session error

**Solutions**:
1. Check main wallet for approval modal
2. Wait 30 seconds for timeout
3. Check console for errors
4. Try reconnecting

### Issue: Transaction Failing

**Possible Causes**:
- Insufficient balance
- Wrong network
- Gas estimation failed
- Transaction rejected

**Solutions**:
1. Check account balance
2. Verify correct network
3. Check transaction details in approval modal
4. Try with lower amount

### Issue: State Not Syncing

**Possible Causes**:
- Event listeners not set up
- Backend not emitting events
- dApp not listening for events

**Solutions**:
1. Check console for event logs
2. Verify dApp has event listeners
3. Try reconnecting
4. Restart application

---

## 📊 Test Results Template

Use this template to document your testing:

```markdown
## Test Results - [Date]

### Environment
- OS: Windows
- Vaughan Version: [version]
- Network: PulseChain Testnet V4 (943)

### Test 1: Local Test dApp
- [ ] Provider detected
- [ ] Connection works
- [ ] Transaction works
- [ ] Issues: [none/describe]

### Test 2: swap.internetmoney.io
- [ ] EIP-6963 discovery works
- [ ] Connection works
- [ ] Transaction works (optional)
- [ ] Issues: [none/describe]

### Test 3: app.uniswap.org
- [ ] Network switch works
- [ ] Connection works
- [ ] Transaction works (optional)
- [ ] Issues: [none/describe]

### Test 4: Multi-Window
- [ ] Multiple windows open
- [ ] Independent sessions
- [ ] State syncs to all
- [ ] Issues: [none/describe]

### Test 5: State Sync
- [ ] Account changes propagate
- [ ] Network changes propagate
- [ ] Real-time updates
- [ ] Issues: [none/describe]

### Test 6: Error Handling
- [ ] Rejections handled
- [ ] Clear error messages
- [ ] No hung requests
- [ ] Issues: [none/describe]

### Overall Assessment
- Status: [Pass/Fail/Partial]
- Critical Issues: [list]
- Minor Issues: [list]
- Notes: [additional observations]
```

---

## 🎯 Success Criteria

Phase 3.4 is considered successful if:

- ✅ Vaughan appears in wallet lists (EIP-6963)
- ✅ Connection flow works smoothly
- ✅ Transaction signing works
- ✅ State synchronization works
- ✅ Multiple windows work independently
- ✅ No CSP errors
- ✅ No memory leaks
- ✅ Error handling is graceful

---

## 📝 Notes

### Test Networks

**PulseChain Testnet V4**:
- Chain ID: 943 (0x3af)
- RPC: https://rpc.v4.testnet.pulsechain.com
- Explorer: https://scan.v4.testnet.pulsechain.com
- Faucet: https://faucet.v4.testnet.pulsechain.com

**Ethereum Mainnet**:
- Chain ID: 1 (0x1)
- RPC: https://eth.llamarpc.com
- Explorer: https://etherscan.io

### Test Accounts

Use the accounts created/imported in your wallet. Make sure they have some test tokens for transaction testing.

### Recommended Test Order

1. Start with local test dApp (simplest)
2. Move to PulseChain DEX (native network)
3. Test Ethereum DEX (network switching)
4. Test multi-window (advanced)
5. Test state sync (integration)
6. Test error handling (edge cases)

---

## 🚀 Ready to Test!

You're all set! Start with Test 1 (local test dApp) and work your way through the scenarios. Document any issues you find and report them.

**Good luck!** 🎉

---

**Last Updated**: 2026-02-10
