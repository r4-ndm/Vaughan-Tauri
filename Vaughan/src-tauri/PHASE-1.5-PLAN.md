# Phase 1.5: Secure Wallet Management - Execution Plan

**Date**: February 4, 2026  
**Duration**: 3-4 days  
**Status**: Ready to Start  
**Confidence**: 100% (Foundation complete from Phase 1)

---

## Overview

Phase 1.5 implements the security-critical wallet management layer that was strategically deferred from Phase 1. This includes:

- **OS keychain integration** for secure key storage
- **HD wallet support** (BIP-39 mnemonics, BIP-32 derivation)
- **Password-based encryption** (AES-GCM + Argon2)
- **Account management** (create, import, export)
- **Transaction signing** with Alloy signers
- **15 wallet/security commands**

**Key Principle**: Security First - Use ONLY audited libraries, NO custom crypto

---

## Why Phase 1.5?

### Strategic Deferral Rationale

From Day 7 analysis, WalletController was deferred because:

1. **Security-Critical**: One mistake = lost funds
2. **Complex Dependencies**: Requires 5+ new security crates
3. **Needs Foundation**: Requires VaughanState (completed Day 8)
4. **Needs Design**: HD wallet strategy needs careful planning
5. **Not Blocking**: Could build core services without it

### Now We're Ready

✅ **Foundation Complete**:
- VaughanState with controller lifecycle (Day 8)
- Multi-chain architecture (Days 2-3)
- Core services (Days 4-7)
- Command layer (Days 9-10)

✅ **Time for Security**:
- Proper planning time
- Security review possible
- No rush to ship
- Can test thoroughly

---

## Security Requirements (NON-NEGOTIABLE)

### ✅ ALWAYS Use Standard Libraries

**Required Crates**:
- `keyring` - OS keychain integration (Windows/macOS/Linux)
- `bip39` - BIP-39 mnemonic generation (12/24 words)
- `coins-bip32` - BIP-32 HD wallet derivation
- `aes-gcm` - AES-GCM encryption (AEAD)
- `argon2` - Argon2 key derivation (password hashing)
- `secrecy` - Secret protection in memory
- `alloy::signers` - Transaction signing (already have)

### ❌ NEVER Write Custom

- ❌ Signing algorithms
- ❌ Encryption schemes
- ❌ Key derivation functions
- ❌ Mnemonic generation
- ❌ HD derivation paths
- ❌ Random number generation

**Why**: Crypto is HARD. One mistake = lost funds. Use battle-tested libraries.

---

## Day 11: Add Security Dependencies

**Goal**: Add and test all security dependencies

### Tasks

1. **Add Dependencies to Cargo.toml**
   - Add `keyring = "2.0"` for OS keychain
   - Add `bip39 = "2.0"` for mnemonics
   - Add `coins-bip32 = "0.8"` for HD derivation
   - Add `aes-gcm = "0.10"` for encryption
   - Add `argon2 = "0.5"` for key derivation
   - Add `secrecy = "0.8"` for secret protection
   - Add `rand = "0.8"` for secure randomness

2. **Test Each Dependency**
   - Test keyring (store/retrieve secret)
   - Test bip39 (generate mnemonic)
   - Test coins-bip32 (derive keys)
   - Test aes-gcm (encrypt/decrypt)
   - Test argon2 (hash password)
   - Document any platform-specific issues

3. **Create Security Module Structure**
   - Create `src/security/` directory
   - Create `src/security/mod.rs`
   - Create `src/security/keyring.rs` (placeholder)
   - Create `src/security/encryption.rs` (placeholder)
   - Create `src/security/hd_wallet.rs` (placeholder)
   - Create `src/security/README.md`

4. **Document Security Design**
   - Document key storage strategy
   - Document encryption approach
   - Document HD wallet paths
   - Document password requirements

### Deliverables
- All dependencies added and tested
- Security module structure created
- Security design documented
- No build errors

### Success Criteria
- ✅ All dependencies compile
- ✅ Basic tests pass for each dependency
- ✅ Module structure created
- ✅ Design documented

---

## Day 12: Implement KeyringService

**Goal**: Secure key storage using OS keychain

### Tasks

1. **Implement KeyringService**
   - Create `KeyringService` struct
   - Implement OS keychain integration
   - Support Windows Credential Manager
   - Support macOS Keychain
   - Support Linux Secret Service
   - Handle keychain errors gracefully

2. **Implement Password-Based Encryption**
   - Implement Argon2 key derivation
   - Implement AES-GCM encryption/decryption
   - Use secure memory handling (secrecy)
   - Implement key rotation support

3. **Implement Account Management**
   - Store encrypted private keys in keychain
   - Support multiple accounts
   - Account creation (generate new key)
   - Account import (from private key)
   - Account export (encrypted)
   - Account deletion (secure wipe)

4. **Integrate with VaughanState**
   - Add KeyringService to VaughanState
   - Implement wallet lock/unlock
   - Implement active account management
   - Implement password verification

5. **Add Comprehensive Tests**
   - Test keychain operations
   - Test encryption/decryption
   - Test account management
   - Test error handling
   - Test password verification

### Deliverables
- KeyringService implementation
- Password-based encryption working
- Account management working
- Integration with VaughanState
- 15+ tests passing

### Success Criteria
- ✅ Keys stored securely in OS keychain
- ✅ Encryption/decryption working
- ✅ Account management working
- ✅ All tests passing
- ✅ No security warnings

---

## Day 13: Implement HD Wallet Support

**Goal**: BIP-39/BIP-32 HD wallet implementation

### Tasks

1. **Implement Mnemonic Generation**
   - Generate 12-word mnemonics (BIP-39)
   - Generate 24-word mnemonics (BIP-39)
   - Validate mnemonics
   - Convert mnemonic to seed
   - Store seed securely (encrypted)

2. **Implement HD Derivation**
   - Implement BIP-32 derivation
   - Use standard path: m/44'/60'/0'/0/x
   - Support multiple accounts from one seed
   - Derive private keys
   - Derive public keys/addresses

3. **Implement Seed Phrase Management**
   - Import from mnemonic
   - Export mnemonic (encrypted)
   - Backup seed phrase
   - Restore from seed phrase
   - Verify seed phrase

4. **Integrate with KeyringService**
   - Store seed in keychain (encrypted)
   - Derive accounts on-demand
   - Cache derived keys
   - Support account discovery

5. **Add Comprehensive Tests**
   - Test mnemonic generation
   - Test HD derivation
   - Test seed management
   - Test account derivation
   - Test BIP-39/BIP-32 compliance

### Deliverables
- HD wallet implementation
- BIP-39 mnemonic support
- BIP-32 derivation working
- Seed phrase management
- 20+ tests passing

### Success Criteria
- ✅ Mnemonics generate correctly
- ✅ HD derivation follows BIP-32
- ✅ Multiple accounts from one seed
- ✅ All tests passing
- ✅ BIP-39/BIP-32 compliant

---

## Day 14: Wallet Commands (Optional)

**Goal**: Implement wallet/security Tauri commands

### Tasks

1. **Implement Wallet Commands**
   - `create_account` - Create new account
   - `import_account` - Import from private key
   - `import_mnemonic` - Import from mnemonic
   - `export_account` - Export private key (encrypted)
   - `export_mnemonic` - Export mnemonic (encrypted)
   - `get_accounts` - List all accounts
   - `switch_account` - Switch active account
   - `delete_account` - Delete account

2. **Implement Security Commands**
   - `unlock_wallet` - Unlock with password
   - `lock_wallet` - Lock wallet
   - `change_password` - Change wallet password
   - `verify_password` - Verify password
   - `backup_seed` - Backup seed phrase
   - `restore_seed` - Restore from seed phrase

3. **Implement Transaction Signing Commands**
   - `sign_transaction` - Sign transaction
   - `sign_message` - Sign arbitrary message
   - `sign_typed_data` - Sign EIP-712 typed data

4. **Add Origin Verification**
   - Verify commands called from main window
   - Reject calls from dApp windows
   - Add security logging

5. **Add Comprehensive Tests**
   - Test all wallet commands
   - Test all security commands
   - Test origin verification
   - Test error handling

### Deliverables
- 15 wallet/security commands
- Origin verification working
- All commands tested
- Integration with KeyringService

### Success Criteria
- ✅ All commands working
- ✅ Origin verification working
- ✅ All tests passing
- ✅ Security audit passed

---

## Security Checklist

Before ANY commit:

### Code Security
- [ ] No custom crypto code
- [ ] Using ONLY standard libraries
- [ ] All secrets use `secrecy::Secret`
- [ ] Keys never logged
- [ ] Secure memory wiping
- [ ] No hardcoded secrets

### Cryptography
- [ ] Using `keyring` for OS keychain
- [ ] Using `bip39` for mnemonics
- [ ] Using `coins-bip32` for HD derivation
- [ ] Using `aes-gcm` for encryption
- [ ] Using `argon2` for key derivation
- [ ] Using `alloy::signers` for signing

### Key Management
- [ ] Keys stored in OS keychain
- [ ] Keys encrypted at rest
- [ ] Keys never in logs
- [ ] Secure key deletion
- [ ] Key rotation supported

### Password Security
- [ ] Argon2 for password hashing
- [ ] Minimum password length (8 chars)
- [ ] Password strength validation
- [ ] Secure password storage
- [ ] Password change supported

### HD Wallet
- [ ] BIP-39 compliant mnemonics
- [ ] BIP-32 compliant derivation
- [ ] Standard derivation path (m/44'/60'/0'/0/x)
- [ ] Seed encrypted in keychain
- [ ] Multiple accounts supported

---

## Testing Strategy

### Unit Tests
- Test each security function in isolation
- Test encryption/decryption
- Test key derivation
- Test mnemonic generation
- Test HD derivation

### Integration Tests
- Test KeyringService with VaughanState
- Test wallet commands end-to-end
- Test account management flow
- Test password change flow

### Security Tests
- Test password strength validation
- Test key storage security
- Test encryption strength
- Test secure memory handling
- Test error handling (no info leaks)

### Platform Tests
- Test on Windows (Credential Manager)
- Test on macOS (Keychain)
- Test on Linux (Secret Service)
- Document platform-specific issues

---

## Dependencies to Add

```toml
[dependencies]
# Security (Phase 1.5)
keyring = "2.0"           # OS keychain integration
bip39 = "2.0"             # BIP-39 mnemonic generation
coins-bip32 = "0.8"       # BIP-32 HD wallet derivation
aes-gcm = "0.10"          # AES-GCM encryption (AEAD)
argon2 = "0.5"            # Argon2 key derivation
secrecy = "0.8"           # Secret protection in memory
rand = "0.8"              # Secure random number generation

# Already have from Phase 1
alloy = { version = "0.1", features = ["full"] }  # Includes signers
```

---

## Success Criteria

### Must Have
- [ ] OS keychain integration working
- [ ] Password-based encryption working
- [ ] HD wallet support (BIP-39/BIP-32)
- [ ] Account management working
- [ ] Transaction signing working
- [ ] All wallet commands implemented
- [ ] All security commands implemented
- [ ] All tests passing (50+ new tests)
- [ ] No security warnings
- [ ] Security audit passed

### Quality Gates
- [ ] All tests pass
- [ ] No clippy warnings
- [ ] Code formatted with rustfmt
- [ ] Comprehensive documentation
- [ ] Files < 500 lines
- [ ] Functions < 50 lines
- [ ] Security review complete

---

## Risk Mitigation

| Risk | Mitigation | Status |
|------|------------|--------|
| Platform-specific keychain issues | Test on all platforms early | PLANNED |
| Encryption key management | Use Argon2 + AES-GCM (standard) | PLANNED |
| HD wallet complexity | Use coins-bip32 (audited) | PLANNED |
| Password security | Enforce strong passwords | PLANNED |
| Key leakage | Use secrecy crate | PLANNED |

---

## Reference Documents

### Security Standards
- BIP-39: Mnemonic code for generating deterministic keys
- BIP-32: Hierarchical Deterministic Wallets
- EIP-191: Signed Data Standard (personal_sign)
- EIP-712: Typed structured data hashing and signing

### Crate Documentation
- keyring: https://docs.rs/keyring/
- bip39: https://docs.rs/bip39/
- coins-bip32: https://docs.rs/coins-bip32/
- aes-gcm: https://docs.rs/aes-gcm/
- argon2: https://docs.rs/argon2/

### Internal Docs
- `.kiro/steering/vaughan-tauri-rules.md` - Security rules
- `Vaughan/src-tauri/WALLET-PRICE-CONTROLLER-ANALYSIS.md` - Analysis
- `.kiro/specs/Vaughan-Tauri/design.md` - Architecture

---

## Next Steps

**Ready to start?** Begin with Day 11: Add Security Dependencies

**Before you start:**
1. Read BIP-39 specification
2. Read BIP-32 specification
3. Review keyring crate documentation
4. Review security best practices

**Remember**: This is security-critical code. Take time to do it right. 🔒

---

**Status**: Ready to Start  
**Confidence**: 100%  
**Timeline**: 3-4 days  
**Priority**: HIGH (Security-Critical)
