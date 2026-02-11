# Phase 2.5: Balance Loading Polish 🔧

**Date**: February 9, 2026  
**Goal**: Fix balance loading with better RPC endpoints and error handling  
**Time**: 30 minutes

---

## 🐛 Current Issues

1. **Balance fails to load** - "Failed to load balance" error
2. **Token list fails** - "Failed to load tokens" error
3. **Root cause**: Using free public RPC (`https://rpc.sepolia.org`) which is:
   - Rate limited
   - Unreliable
   - Slow

---

## ✅ Solution Plan

### 1. Add Better RPC Endpoints
**Sepolia Testnet Options**:
- Alchemy: `https://eth-sepolia.g.alchemy.com/v2/demo` (demo key, limited)
- Infura: `https://sepolia.infura.io/v3/` (requires API key)
- Ankr: `https://rpc.ankr.com/eth_sepolia` (free, better reliability)

**Strategy**: Use Ankr as default (free, no API key needed, better than rpc.sepolia.org)

### 2. Add Retry Logic
- Retry failed requests up to 3 times
- Exponential backoff (1s, 2s, 4s)
- Better error messages

### 3. Improve Loading States
- Show "Loading..." instead of "Failed" immediately
- Add timeout handling
- Graceful degradation

---

## 🔧 Implementation

### Step 1: Update Default RPC
Change Sepolia RPC from `https://rpc.sepolia.org` to `https://rpc.ankr.com/eth_sepolia`

**File**: `src-tauri/src/state.rs`

### Step 2: Add Retry Logic (Optional)
Add retry wrapper in EVM adapter for balance queries

**File**: `src-tauri/src/chains/evm/adapter.rs`

### Step 3: Better Error Messages
Update error handling to distinguish between:
- Network errors (retry)
- Invalid address (don't retry)
- Rate limiting (wait and retry)

---

## 📊 Expected Results

**Before**:
```
⚠️ Failed to load balance
⚠️ Failed to load tokens
```

**After**:
```
0 ETH
$0.00 USD
💰 No tokens found
```

---

## 🎯 Success Criteria

- ✅ Balance loads successfully (even if 0 ETH)
- ✅ No "Failed to load" errors
- ✅ Smooth user experience
- ✅ Works on free RPC endpoints

---

**Status**: Starting implementation...
