# CRITICAL REQUIREMENTS - READ FIRST

**🚨 This document contains non-negotiable requirements for the Tauri migration.**

---

## 1. Tauri 2.0 (NOT 1.x)

### ❌ WRONG
```bash
cargo tauri init  # This is Tauri 1.x
```

### ✅ CORRECT
```bash
npm create tauri-app@latest  # This is Tauri 2.0
# Select: React + TypeScript, Tauri 2.0
```

**Why**: Tauri 2.0 has native mobile support, better security (ACLs), and improved APIs.

---

## 2. Alloy Purity (ZERO ethers-rs)

### ❌ FORBIDDEN
```rust
use ethers::types::{Address, U256};
use ethers::providers::Provider;
use ethers::signers::LocalWallet;
```

### ✅ REQUIRED
```rust
use alloy::primitives::{Address, U256, Bytes};
use alloy::providers::{Provider, ProviderBuilder};
use alloy::signers::local::PrivateKeySigner;
```

**Rule**: If you see `use ethers`, STOP. Find the Alloy equivalent.

**Exception**: Only use `alloy-ethers-typecast` at boundaries with legacy code (rare).

---

## 3. No Custom Crypto Code

### ❌ FORBIDDEN
```rust
// Custom signing
fn sign_transaction(tx: &Transaction, key: &[u8]) -> Vec<u8> {
    let hash = custom_hash(tx);
    custom_sign(hash, key)
}

// Custom encryption
fn encrypt_key(key: &[u8], password: &str) -> Vec<u8> {
    custom_encrypt(key, password)
}
```

### ✅ REQUIRED
```rust
// Use Alloy for signing
use alloy::signers::{LocalWallet, Signer};
async fn sign_transaction(tx: &Transaction, wallet: &LocalWallet) -> Result<Signature> {
    wallet.sign_transaction(tx).await
}

// Use standard crates for encryption
use aes_gcm::{Aes256Gcm, KeyInit};
use argon2::Argon2;
```

**Rule**: NEVER write custom crypto. Use Alloy libraries or EIP-1193 provider specification only.

**Why**: 
- Crypto is hard. Use audited libraries.
- Follow industry standards (EIPs, BIPs)
- Users trust established patterns

---

## 4. Multi-Chain Architecture (Future-Proof)

### ❌ WRONG (EVM-Only, Tightly Coupled)
```rust
// This will require massive refactoring to add other chains
pub struct WalletCore {
    provider: AlloyProvider,  // EVM-only
    signer: AlloyWallet,      // EVM-only
}
```

### ✅ REQUIRED (Chain-Agnostic with Trait)
```rust
// Define trait for ALL chains
#[async_trait]
pub trait ChainAdapter: Send + Sync {
    async fn get_balance(&self, address: &str) -> Result<Balance>;
    async fn send_transaction(&self, tx: ChainTransaction) -> Result<TxHash>;
    fn chain_type(&self) -> ChainType;
}

// EVM implementation using Alloy
pub struct EvmAdapter {
    provider: AlloyProvider,
    signer: AlloyWallet,
}

impl ChainAdapter for EvmAdapter {
    // Implement trait using Alloy
}

// Wallet core uses trait, not concrete type
pub struct WalletCore {
    adapters: HashMap<ChainType, Box<dyn ChainAdapter>>,
}
```

**Rule**: Build with multi-chain architecture from the start, even though Phase 1 only implements EVM.

**Why**:
- Add Stellar/Aptos/Solana/Bitcoin later without refactoring
- Clean separation of concerns
- Professional, scalable design

**See**: `MULTI-CHAIN-ARCHITECTURE.md` for full details

---

## 5. Security (EIP-1193 Standard)

### Origin Verification (REQUIRED)
```rust
#[tauri::command]
async fn send_transaction(
    window: tauri::Window,
    // ...
) -> Result<String, String> {
    // CRITICAL: Verify request comes from authorized window
    if window.label() != "main" {
        return Err("Unauthorized".to_string());
    }
    // ... rest of implementation
}
```

**Why**: dApp windows must NOT be able to call wallet commands directly.

### Provider Injection (REQUIRED)
Use `initialization_script` in `tauri.conf.json`, NOT side-loaded JS:

```json
{
  "tauri": {
    "windows": [
      {
        "label": "dapp-browser",
        "initialization_script": "window.ethereum = (function() { /* provider */ })();"
      }
    ]
  }
}
```

**Why**: Ensures provider loads BEFORE any dApp code.

### CSP (REQUIRED)
**Wallet window** (strict):
```
default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; frame-src 'none';
```

**dApp window** (looser):
```
default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; frame-src https:;
```

---

## 6. Tauri 2.0 Capabilities (ACL System)

### REQUIRED Files

**src-tauri/capabilities/default.json**:
```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "identifier": "main-capability",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:allow-create"
  ]
}
```

**src-tauri/capabilities/dapp.json**:
```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "identifier": "dapp-capability",
  "windows": ["dapp-*"],
  "permissions": [
    "core:default"
  ]
}
```

**Why**: Granular permission control. dApp windows have MINIMAL permissions.

---

## 7. Phase 5: DEBLOAT (REQUIRED)

After Tauri version is working:

### Delete These
```bash
rm -rf src/gui/
rm src/app.rs
rm src/main.rs
```

### Remove From Cargo.toml
- `iced`
- `iced_native`
- `wgpu`
- `font-kit`
- `image` (if only used by Iced)

### Binary Optimization (REQUIRED)
```toml
[profile.release]
lto = true
codegen-units = 1
panic = "abort"
strip = true
opt-level = "z"
```

**Target**: < 20MB binary (down from ~50MB)

---

## 8. Tauri 2.0 API (NOT 1.x)

### ❌ WRONG (Tauri 1.x)
```typescript
import { invoke } from '@tauri-apps/api/tauri';
```

### ✅ CORRECT (Tauri 2.0)
```typescript
const { invoke } = window.__TAURI__.core;
```

---

## 9. Mobile Support (Native in 2.0)

### ❌ WRONG (Tauri 1.x)
```bash
# Install plugin
cargo install tauri-plugin-mobile
```

### ✅ CORRECT (Tauri 2.0)
```bash
# Native support, no plugin
cargo tauri android init
cargo tauri android build
```

---

## 10. Testing (Battle Test)

### REQUIRED Test Suite

**tests/mock-dapp.html** - EIP-1193 compliance tests:
- ✅ window.ethereum exists
- ✅ eth_requestAccounts works
- ✅ eth_chainId works
- ✅ eth_sendTransaction works
- ✅ Events emit correctly

**Must pass before release.**

---

## 11. Migration Process (REQUIRED)

### ❌ WRONG
```
1. Copy Iced code
2. Paste into Tauri
3. Fix compilation errors
4. Ship it
```

### ✅ CORRECT
```
1. READ the Iced code
2. ANALYZE (problems? improvements?)
3. DESIGN (how should this work in Tauri?)
4. IMPLEMENT (write clean, new code)
5. TEST (verify functionality)
6. DOCUMENT (add doc comments)
7. REVIEW (is it better? maintainable?)
```

**See**: `.kiro/steering/tauri-migration-rules.md`

---

## 10. Verification Checklist

Before any release, ALL must be ✅:

- [ ] Using Tauri 2.0 (not 1.x)
- [ ] ZERO ethers-rs imports
- [ ] Origin verification in all commands
- [ ] Provider uses initialization_script
- [ ] Strict CSP for wallet window
- [ ] Capabilities configured (ACL system)
- [ ] dApp window has minimal permissions
- [ ] Mock dApp test suite passes
- [ ] All Iced code removed (Phase 5)
- [ ] Binary < 20MB
- [ ] Android build works
- [ ] All tests pass

---

## Quick Reference

| Requirement | Document |
|-------------|----------|
| Tauri 2.0 specifics | `tauri-2.0-specifics.md` |
| Migration process | `.kiro/steering/tauri-migration-rules.md` |
| What we're building | `requirements.md` |
| How we're building it | `design.md` |
| Task breakdown | `tasks.md` |
| Cross-platform strategy | `cross-platform-strategy.md` |
| Project structure | `project-structure.md` |

---

## Summary

1. **Tauri 2.0**: `npm create tauri-app@latest`
2. **Alloy Only**: No ethers-rs
3. **Security**: Origin verification, initialization_script, strict CSP
4. **Capabilities**: ACL system for permissions
5. **Debloat**: Remove all Iced code in Phase 5
6. **Process**: Analyze → Improve → Rebuild (not copy-paste)
7. **Testing**: Mock dApp test suite must pass
8. **Binary**: < 20MB target

**These are non-negotiable. Follow them strictly.**
