# Phase 1, Day 5 - Add Signer Support to EvmAdapter

**Date**: 2026-02-04  
**Status**: IN PROGRESS  
**Goal**: Complete EvmAdapter with signing capabilities

---

## 🎯 Objectives

### 1. Add Signer Support to EvmAdapter
- Add optional `PrivateKeySigner` to EvmAdapter struct
- Create `new_with_signer()` constructor
- Keep existing `new()` for read-only operations

### 2. Implement send_transaction with Signing
- Build transaction using Alloy TransactionRequest
- Sign transaction with PrivateKeySigner
- Send to network via provider
- Return transaction hash

### 3. Implement sign_message
- Support EIP-191 (personal_sign)
- Sign arbitrary messages
- Return signature

### 4. Update Tests
- Test transaction signing
- Test message signing
- Test error handling
- Maintain 100% test coverage

---

## 📚 Reference Documents

- `.kiro/specs/external_refs/Alloy-Cheatsheet.md` - Signer examples
- `.kiro/specs/external_refs/Alloy-Error-Handling.md` - Error patterns
- `CONTROLLER-ANALYSIS.md` - Implementation plan

---

## 🔧 Implementation Plan

### Step 1: Update EvmAdapter Struct
```rust
pub struct EvmAdapter {
    provider: RootProvider<Http<Client>>,
    signer: Option<PrivateKeySigner>,  // NEW
    network_id: String,
    chain_id: u64,
    // ...
}
```

### Step 2: Add new_with_signer Constructor
```rust
pub async fn new_with_signer(
    rpc_url: &str,
    network_id: String,
    chain_id: u64,
    signer: PrivateKeySigner,
) -> Result<Self, WalletError>
```

### Step 3: Implement send_transaction
```rust
async fn send_transaction(&self, tx: ChainTransaction) -> Result<TxHash, WalletError> {
    // Extract EVM transaction
    // Check signer exists
    // Build TransactionRequest
    // Sign and send
    // Return hash
}
```

### Step 4: Implement sign_message
```rust
async fn sign_message(&self, address: &str, message: &[u8]) -> Result<Signature, WalletError> {
    // Check signer exists
    // Verify address matches signer
    // Sign message
    // Return signature
}
```

---

## ✅ Success Criteria

- [ ] EvmAdapter has optional signer
- [ ] new_with_signer() constructor works
- [ ] send_transaction() signs and sends
- [ ] sign_message() works
- [ ] All tests pass
- [ ] No compilation errors
- [ ] Code quality maintained

---

**Status**: Starting implementation...
