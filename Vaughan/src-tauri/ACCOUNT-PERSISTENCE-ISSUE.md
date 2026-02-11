# Account Persistence Issue - Critical Bug 🐛

**Date**: February 9, 2026  
**Severity**: CRITICAL  
**Status**: Discovered during Phase 2 integration testing

---

## 🔍 Problem Discovery

During unlock flow testing, discovered that `get_accounts()` returns an empty array after app restart, even though the wallet was successfully created.

**Console Output**:
```
🔓 Unlocking wallet...
✅ Wallet unlocked
📋 Loading accounts...
✅ Accounts loaded: Array(0)  ← PROBLEM: Should have 1 account
⚠️ No accounts found after unlock
```

---

## 🐛 Root Cause Analysis

### Current Implementation

**Account Storage**:
- Accounts are stored in `WalletService.accounts: Arc<RwLock<HashMap<Address, Account>>>`
- This is an **in-memory only** data structure
- When app restarts, the HashMap is empty

**What Gets Persisted**:
- ✅ Seed phrase → Keyring (encrypted)
- ✅ Private keys → Keyring (encrypted, per account)
- ❌ Account metadata → **NOT PERSISTED**

**Account Metadata** (what's missing):
```rust
pub struct Account {
    pub address: Address,
    pub name: String,           // "Account 1", "Account 2", etc.
    pub account_type: AccountType,  // HD or Imported
    pub index: Option<u32>,     // Derivation index for HD accounts
}
```

### Flow Analysis

**Wallet Creation** (`create_wallet`):
1. ✅ Generate mnemonic
2. ✅ Store seed in keyring (encrypted)
3. ✅ Derive first account (index 0)
4. ✅ Store private key in keyring (encrypted)
5. ✅ Add account to in-memory HashMap
6. ❌ **Account metadata NOT persisted**

**App Restart**:
1. ✅ Seed still in keyring
2. ✅ Private keys still in keyring
3. ❌ Account HashMap is empty (in-memory only)

**Unlock** (`unlock`):
1. ✅ Load seed from keyring (verifies password)
2. ❌ Tries to load signers for accounts in HashMap
3. ❌ HashMap is empty, so no signers loaded
4. ✅ Marks wallet as unlocked
5. ❌ `get_accounts()` returns empty array

---

## 🎯 Why This Wasn't Caught

1. **Phase 1 Testing**: Tests created wallet and used it in same session
2. **No Restart Testing**: Never tested app restart after wallet creation
3. **Missing Requirement**: Account persistence wasn't explicitly in Phase 1 tasks
4. **Assumption**: Assumed keyring would handle everything

---

## 💡 Solution Options

### Option 1: Store Account List in Keyring (Simple)
**Approach**: Store JSON-serialized account list in keyring as "accounts" key

**Pros**:
- Simple implementation
- Uses existing keyring infrastructure
- Encrypted with password

**Cons**:
- Keyring is meant for secrets, not metadata
- JSON serialization in keyring feels wrong
- Mixing concerns (secrets vs. metadata)

### Option 2: Separate Config File (Professional)
**Approach**: Store account metadata in separate encrypted file

**Pros**:
- Clean separation of concerns
- Proper architecture (secrets in keyring, metadata in file)
- Can store additional wallet config later
- Standard wallet pattern (MetaMask, etc.)

**Cons**:
- More complex implementation
- Need to handle file I/O
- Need encryption for file

### Option 3: Derive Accounts on Unlock (Clever but Limited)
**Approach**: On unlock, scan keyring for "account_*" keys and reconstruct metadata

**Pros**:
- No additional storage needed
- Works with existing code

**Cons**:
- Can't store custom account names
- Can't distinguish HD vs. Imported accounts
- Can't store derivation index
- Fragile (depends on keyring key naming)

---

## ✅ Recommended Solution: Option 2 (Config File)

### Architecture

**File Location**: 
- Platform-specific config directory
- `~/.config/vaughan/wallet.json` (Linux)
- `~/Library/Application Support/vaughan/wallet.json` (macOS)
- `%APPDATA%\vaughan\wallet.json` (Windows)

**File Structure**:
```json
{
  "version": 1,
  "accounts": [
    {
      "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      "name": "Account 1",
      "account_type": "hd",
      "index": 0
    }
  ],
  "settings": {
    "last_active_account": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
  }
}
```

**Encryption**:
- File encrypted with AES-GCM
- Key derived from password using Argon2
- Same encryption as used for keyring

**Implementation**:
1. Create `WalletConfig` struct
2. Add `save_config()` and `load_config()` methods
3. Update `create_wallet()` to save config
4. Update `import_wallet()` to save config
5. Update `unlock()` to load config
6. Add proper error handling

---

## 📋 Implementation Plan

### Phase 1.6: Account Persistence (NEW)

**Tasks**:
1. Create `src/core/config.rs` module
2. Implement `WalletConfig` struct
3. Implement encryption/decryption for config file
4. Add `save_config()` and `load_config()` to `WalletService`
5. Update `create_wallet()` to persist config
6. Update `import_wallet()` to persist config
7. Update `unlock()` to load config
8. Update `create_account()` to persist config
9. Update `import_account()` to persist config
10. Update `delete_account()` to persist config
11. Add tests for config persistence
12. Update documentation

**Estimated Time**: 2-3 hours

---

## 🧪 Testing Requirements

After implementation:
1. Create wallet → Restart app → Unlock → Verify accounts load
2. Import wallet → Restart app → Unlock → Verify accounts load
3. Create multiple accounts → Restart → Verify all load
4. Import account → Restart → Verify it loads
5. Delete account → Restart → Verify it's gone
6. Rename account → Restart → Verify name persists

---

## 🚨 Impact Assessment

**Current State**:
- ❌ Wallet unusable after app restart
- ❌ All accounts lost on restart
- ❌ Phase 2 cannot be completed

**After Fix**:
- ✅ Wallet persists across restarts
- ✅ Accounts load correctly
- ✅ Phase 2 can be completed
- ✅ Professional, production-ready solution

---

## 📝 Lessons Learned

1. **Test Restart Scenarios**: Always test app restart in integration tests
2. **Explicit Requirements**: Persistence requirements must be explicit
3. **Architecture Review**: Review what gets persisted vs. in-memory
4. **Real-World Usage**: Test like a real user (close app, reopen)

---

## 🎯 Next Steps

1. **Pause Phase 2**: Cannot complete without account persistence
2. **Implement Phase 1.6**: Account persistence (proper solution)
3. **Test Thoroughly**: Restart scenarios, multiple accounts
4. **Resume Phase 2**: Complete integration testing

---

**Priority**: CRITICAL - Blocks Phase 2 completion  
**Complexity**: Medium - Clean implementation needed  
**Time**: 2-3 hours for professional solution
