---
inclusion: always
---

# Vaughan-Tauri Development Rules

**Purpose**: Critical rules for building a secure, maintainable multi-chain wallet

---

## 🎯 Core Principles

1. **Security First**: Never write custom crypto code - use audited libraries only
2. **Standards Compliance**: Follow EIP-1193, BIP-39, BIP-32 specifications exactly
3. **Clean Architecture**: Analyze → Improve → Rebuild (never copy-paste)
4. **Multi-Chain Ready**: Use trait-based design from day one

---

## 🔒 Security Rules (NON-NEGOTIABLE)

### ✅ ALWAYS Use Standard Libraries

**Rust Backend**:
- `alloy::*` - All Ethereum operations (providers, signers, contracts, primitives)
- `bip39` - Mnemonic generation
- `coins-bip32` - HD wallet derivation
- `keyring` - OS keychain for private keys
- `aes-gcm`, `argon2` - Standard encryption
- `sha2`, `sha3` - Standard hashing

**Frontend**:
- EIP-1193 specification - Provider API (see `.kiro/specs/external_refs/EIP-1193.md`)
- MetaMask API patterns (see `.kiro/specs/external_refs/MetaMask-Provider-API.md`)

### ❌ NEVER Write Custom

- ❌ Signing algorithms
- ❌ Encryption schemes
- ❌ Key derivation functions
- ❌ RPC implementations
- ❌ Transaction builders
- ❌ Address validators
- ❌ Hash functions

**Why**: Crypto is hard. One mistake = lost funds. Use battle-tested libraries.

---

## 📚 Required Reading Before Coding

### Phase 1 (Backend)
- `.kiro/specs/external_refs/Alloy-Cheatsheet.md` - Alloy basics
- `.kiro/specs/external_refs/Alloy-Error-Handling.md` - Error patterns
- `.kiro/specs/external_refs/Tauri-State-Management.md` - State management
- `.kiro/specs/Vaughan-Tauri/controller-lifecycle.md` - Controller design

### Phase 2 (Frontend)
- `.kiro/specs/external_refs/React-Hooks-Cheatsheet.md` - React patterns
- `.kiro/specs/external_refs/TypeScript-Tauri-Integration.md` - Tauri commands
- `.kiro/specs/external_refs/Tailwind-Utilities-Reference.md` - Styling

### Phase 3 (dApp)
- `.kiro/specs/external_refs/EIP-1193.md` - Provider standard
- `.kiro/specs/external_refs/MetaMask-Provider-API.md` - Compatibility

### Always
- `.kiro/specs/Vaughan-Tauri/requirements.md` - What we're building
- `.kiro/specs/Vaughan-Tauri/design.md` - How we're building it
- `.kiro/specs/Vaughan-Tauri/tasks.md` - Current task details

---

## 🏗️ Architecture (5 Layers)

```
Layer 4: UI (React)           → Presentation only
         ↓
Layer 3: Provider APIs        → EIP-1193 translation
         ↓
Layer 2: Tauri Commands       → IPC bridge (thin)
         ↓
Layer 1: Wallet Core          → Business logic (chain-agnostic)
         ↓
Layer 0: Chain Adapters       → Chain-specific (Alloy for EVM)
```

**Key Rule**: Each layer talks ONLY to adjacent layers. No shortcuts.

---

## 📋 Code Quality Checklist

Before ANY commit:

**Security**:
- [ ] No custom crypto code
- [ ] Using Alloy for all Ethereum operations
- [ ] Following EIP-1193 for provider API
- [ ] Private keys never leave Rust backend
- [ ] All inputs validated in Rust (never trust frontend)

**Architecture**:
- [ ] Code in correct layer
- [ ] No business logic in UI
- [ ] No UI logic in controllers
- [ ] Proper error handling (Result<T, E>, no unwrap/expect)

**Quality**:
- [ ] File < 500 lines
- [ ] Function < 50 lines
- [ ] One responsibility per module
- [ ] Comprehensive doc comments
- [ ] Tests written and passing

**References**:
- [ ] Read relevant offline reference files
- [ ] Followed patterns from reference files
- [ ] Used examples from reference files

---

## 🚫 Common Mistakes

### Mistake 1: Custom Crypto
```rust
❌ fn custom_sign(data: &[u8], key: &[u8]) -> Vec<u8> { ... }
✅ use alloy::signers::{LocalWallet, Signer};
```

### Mistake 2: Mixed Concerns
```rust
❌ // UI logic in controller
pub fn send_tx(app: &mut App) { app.status = "Sent!"; }

✅ // Controller returns Result, UI handles display
pub async fn send_tx() -> Result<TxHash, WalletError>
```

### Mistake 3: Ignoring References
```rust
❌ // Guessing Alloy API
provider.get_balance(addr).unwrap()

✅ // Using Alloy-Error-Handling.md patterns
provider.get_balance(addr)
    .await
    .map_err(|e| WalletError::from(e))?
```

### Mistake 4: Copy-Paste
```rust
❌ // Copied from Iced without improvements
pub fn handle_msg(app: &mut App, msg: Msg) { ... }

✅ // Analyzed, improved, rebuilt
#[tauri::command]
pub async fn send_transaction(
    state: State<'_, VaughanState>,
    to: String,
    amount: String,
) -> Result<String, WalletError>
```

---

## 🎯 Quick Reference

**Need to...**
- Create Alloy provider? → `Alloy-Cheatsheet.md`
- Handle errors? → `Alloy-Error-Handling.md`
- Manage Tauri state? → `Tauri-State-Management.md`
- Use React hooks? → `React-Hooks-Cheatsheet.md`
- Call Tauri commands? → `TypeScript-Tauri-Integration.md`
- Style with Tailwind? → `Tailwind-Utilities-Reference.md`
- Implement provider? → `EIP-1193.md` + `MetaMask-Provider-API.md`

**Stuck?**
1. Check relevant reference file in `.kiro/specs/external_refs/`
2. Check design doc: `.kiro/specs/Vaughan-Tauri/design.md`
3. Ask user before proceeding

---

## 🔑 Key Takeaways

1. **Security**: Use standard libraries, never custom crypto
2. **References**: Read offline files before coding
3. **Architecture**: Respect layer boundaries
4. **Quality**: Small files, clear docs, proper errors
5. **Process**: Analyze → Improve → Rebuild

**Remember**: This is a security-critical application. Take time to do it right.

---

**Reference Index**: `.kiro/specs/external_refs/REFERENCE-INDEX.md`  
**Quick Start**: `.kiro/specs/Vaughan-Tauri/QUICK-START.md`
