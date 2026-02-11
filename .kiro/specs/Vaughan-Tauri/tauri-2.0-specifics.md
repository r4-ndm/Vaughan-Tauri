# Tauri 2.0 Specific Implementation Guide

**CRITICAL**: This document specifies Tauri 2.0 requirements that supersede generic Tauri references in other docs.

---

## 1. Tauri 2.0 vs 1.x Differences

### Key Changes in Tauri 2.0

1. **Permissions System (ACLs)**: Replaces `allowlist` in `tauri.conf.json`
2. **Mobile Support**: Native Android/iOS support (not a plugin)
3. **Improved Security**: Stricter CSP, better isolation
4. **New API Structure**: `window.__TAURI__.core.invoke()` instead of `@tauri-apps/api`
5. **Capabilities**: Per-window permission sets

---

## 2. Project Initialization

### ❌ OLD (Tauri 1.x)
```bash
cargo tauri init
```

### ✅ NEW (Tauri 2.0)
```bash
# Use the latest Tauri 2.0 template
npm create tauri-app@latest

# Select:
# - Project name: vaughan
# - Package manager: npm
# - UI template: React + TypeScript
# - Tauri version: 2.0 (stable/RC)
```

**Result**: Creates proper Tauri 2.0 structure with:
- `src-tauri/capabilities/` directory
- Updated `tauri.conf.json` format
- Tauri 2.0 dependencies

---

## 3. Permissions & ACLs (Critical Security)

### Tauri 2.0 Capabilities System

**Location**: `src-tauri/capabilities/default.json`

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "identifier": "main-capability",
  "description": "Main window capabilities",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:allow-create",
    "core:window:allow-close",
    "shell:allow-open"
  ]
}
```

### Separate Capabilities for dApp Window

**Location**: `src-tauri/capabilities/dapp.json`

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "identifier": "dapp-capability",
  "description": "dApp browser window capabilities",
  "windows": ["dapp-*"],
  "permissions": [
    "core:default",
    "core:window:allow-close"
  ]
}
```

**Key Principle**: dApp windows have MINIMAL permissions. They can't access wallet commands directly.

### Command Permissions

**Location**: `src-tauri/capabilities/wallet-commands.json`

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "identifier": "wallet-commands",
  "description": "Wallet command permissions",
  "windows": ["main"],
  "permissions": [
    "wallet:allow-send-transaction",
    "wallet:allow-get-balance",
    "wallet:allow-switch-network",
    "wallet:allow-import-account"
  ]
}
```

**Security**: Only the main wallet window can call wallet commands. dApp windows CANNOT.

---

## 4. Mobile Support (Native in 2.0)

### Android Initialization

```bash
# Initialize Android project (built into Tauri 2.0)
cargo tauri android init

# Build for Android
cargo tauri android build

# Run on device
cargo tauri android dev
```

**No plugin needed!** This is native in Tauri 2.0.

### iOS Initialization (Future)

```bash
# Initialize iOS project
cargo tauri ios init

# Build for iOS
cargo tauri ios build
```

---

## 5. Security Hardening (MetaMask Standard)

### 5.1 Content Security Policy (CSP)

**Main Wallet Window** (Strict):

```json
// In tauri.conf.json
{
  "tauri": {
    "security": {
      "csp": "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self' https://rpc.pulsechain.com https://mainnet.infura.io wss://*; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; frame-src 'none';"
    }
  }
}
```

**dApp Browser Window** (Looser, but still controlled):

```json
// Separate config for dApp window
{
  "tauri": {
    "security": {
      "csp": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; connect-src *; style-src 'self' 'unsafe-inline' https:; img-src * data: blob:; font-src 'self' data: https:; frame-src https:;"
    }
  }
}
```

**Why different?**: dApps need to load external scripts, but wallet window must be locked down.

### 5.2 Provider Injection (Secure Method)

**❌ WRONG (Insecure)**:
```javascript
// Just loading provider.js in HTML
<script src="provider.js"></script>
```

**✅ CORRECT (Tauri 2.0 initialization_script)**:

In `tauri.conf.json`:
```json
{
  "tauri": {
    "windows": [
      {
        "label": "dapp-browser",
        "url": "dapp-browser.html",
        "initialization_script": "window.ethereum = (function() { /* provider code */ })();"
      }
    ]
  }
}
```

**Why?**: `initialization_script` runs BEFORE any dApp code, ensuring our provider is injected first.

### 5.3 Origin Verification

**In Rust commands**:

```rust
use tauri::Manager;

#[tauri::command]
async fn send_transaction(
    window: tauri::Window,
    state: State<'_, Arc<Mutex<VaughanState>>>,
    to: String,
    amount: String,
) -> Result<String, String> {
    // CRITICAL: Verify request comes from authorized window
    let window_label = window.label();
    
    if window_label != "main" {
        return Err("Unauthorized: Only main window can send transactions".to_string());
    }
    
    // ... rest of implementation
}
```

**Security**: dApp windows can't directly call wallet commands. They must go through the MetaMask bridge.

---

## 6. Alloy Purity Standards

### ✅ CORRECT Imports

```rust
// Primitives
use alloy::primitives::{Address, U256, Bytes, B256};

// Providers
use alloy::providers::{Provider, ProviderBuilder, RootProvider};
use alloy::transports::http::Http;

// Signers
use alloy::signers::local::PrivateKeySigner;

// Network
use alloy::network::Ethereum;

// RPC types
use alloy::rpc::types::{TransactionRequest, Block};
```

### ❌ FORBIDDEN Imports

```rust
// NEVER use these
use ethers::types::{Address, U256};  // ❌ Use alloy::primitives
use ethers::providers::Provider;     // ❌ Use alloy::providers
use ethers::signers::LocalWallet;    // ❌ Use alloy::signers
```

### Type Conversions (Only When Necessary)

If you MUST interact with legacy ethers code:

```rust
use alloy_ethers_typecast::{transaction, ethers_core};

// Convert Alloy → Ethers (rare, avoid if possible)
let ethers_addr = ethers_core::types::Address::from(alloy_addr.0);

// Convert Ethers → Alloy (when receiving from legacy code)
let alloy_addr = Address::from(ethers_addr.0);
```

**Rule**: Only use `alloy-ethers-typecast` at boundaries with legacy code. All new code is pure Alloy.

---

## 7. Dependency Management

### src-tauri/Cargo.toml (Tauri 2.0)

```toml
[package]
name = "vaughan"
version = "2.0.0"
edition = "2021"

[dependencies]
# Tauri 2.0
tauri = { version = "2.0", features = ["macos-private-api"] }
tauri-plugin-shell = "2.0"

# Alloy (pure, no ethers)
alloy = { version = "0.1", features = ["full"] }
alloy-primitives = "0.7"
alloy-providers = "0.1"
alloy-signers = "0.1"
alloy-network = "0.1"
alloy-rpc-types = "0.1"
alloy-transports = "0.1"

# Only if absolutely necessary for legacy compatibility
alloy-ethers-typecast = { version = "0.1", optional = true }

# Async runtime
tokio = { version = "1", features = ["full"] }

# Serialization
serde = { version = "1", features = ["derive"] }
serde_json = "1"

# Security
secrecy = "0.8"
argon2 = "0.5"

# Logging
tracing = "0.1"
tracing-subscriber = "0.3"

[features]
default = []
legacy-compat = ["alloy-ethers-typecast"]

[build-dependencies]
tauri-build = { version = "2.0", features = [] }
```

### Root Cargo.toml (Legacy - Will be removed in Phase 5)

Keep for reference during migration, delete after Phase 4.

---

## 8. Phase 5: DEBLOAT & CLEANUP (Critical)

### What to Delete After Migration

Once Tauri version is working and tested:

```bash
# Delete Iced GUI code
rm -rf src/gui/
rm src/app.rs
rm src/main.rs  # Old Iced entry point

# Update root Cargo.toml to remove Iced dependencies
# Remove:
# - iced
# - iced_native
# - wgpu
# - font-kit
# - image (if only used by Iced)
```

### Dependency Audit

```bash
# Check what's actually being used
cargo tree --duplicates
cargo bloat --release

# Remove unused dependencies
cargo machete  # Install: cargo install cargo-machete
```

### Binary Optimization

**src-tauri/Cargo.toml**:

```toml
[profile.release]
lto = true              # Link-time optimization
codegen-units = 1       # Better optimization, slower compile
panic = "abort"         # Smaller binary
strip = true            # Remove debug symbols
opt-level = "z"         # Optimize for size
```

**Expected Results**:
- Before: ~50MB binary
- After: ~15-20MB binary

---

## 9. IPC Bridge (Tauri 2.0 API)

### Frontend (React)

**❌ OLD (Tauri 1.x)**:
```typescript
import { invoke } from '@tauri-apps/api/tauri';
```

**✅ NEW (Tauri 2.0)**:
```typescript
// Use the global __TAURI__ object
const { invoke } = window.__TAURI__.core;

// Call command
const balance = await invoke('get_balance', { 
  address: '0x...' 
});
```

### Provider Implementation

**web/src/services/ethereum-provider.ts**:

```typescript
class VaughanEthereumProvider {
  private invoke = window.__TAURI__.core.invoke;
  
  async request({ method, params }: { method: string; params?: any[] }) {
    // Translate MetaMask API → Tauri commands
    switch (method) {
      case 'eth_requestAccounts':
        return await this.invoke('request_connection');
      
      case 'eth_sendTransaction':
        const [tx] = params || [];
        return await this.invoke('send_transaction', {
          to: tx.to,
          value: tx.value,
          gasLimit: tx.gas || 21000,
        });
      
      // ... more methods
    }
  }
}

// Inject into window
window.ethereum = new VaughanEthereumProvider();
```

---

## 10. Testing Strategy (Battle Test)

### Phase 4 Verification Checklist

- [ ] **Alloy Tests**: All controller tests pass
- [ ] **Bridge Tests**: Mock dApp test suite passes
- [ ] **Security Tests**: Origin verification works
- [ ] **Permission Tests**: dApp window can't call wallet commands directly
- [ ] **CSP Tests**: Strict CSP doesn't break wallet UI
- [ ] **Mobile Tests**: Android build works

### Mock dApp Test Suite

**tests/mock-dapp.html**:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Mock dApp - EIP-1193 Test Suite</title>
</head>
<body>
  <h1>EIP-1193 Compliance Tests</h1>
  <div id="results"></div>
  
  <script>
    async function runTests() {
      const results = [];
      
      // Test 1: Provider exists
      results.push({
        test: 'window.ethereum exists',
        pass: typeof window.ethereum !== 'undefined'
      });
      
      // Test 2: Request accounts
      try {
        const accounts = await window.ethereum.request({
          method: 'eth_requestAccounts'
        });
        results.push({
          test: 'eth_requestAccounts',
          pass: Array.isArray(accounts) && accounts.length > 0
        });
      } catch (e) {
        results.push({ test: 'eth_requestAccounts', pass: false, error: e.message });
      }
      
      // Test 3: Get chain ID
      try {
        const chainId = await window.ethereum.request({
          method: 'eth_chainId'
        });
        results.push({
          test: 'eth_chainId',
          pass: typeof chainId === 'string' && chainId.startsWith('0x')
        });
      } catch (e) {
        results.push({ test: 'eth_chainId', pass: false, error: e.message });
      }
      
      // ... more tests
      
      // Display results
      document.getElementById('results').innerHTML = results
        .map(r => `<div>${r.test}: ${r.pass ? '✅' : '❌'} ${r.error || ''}</div>`)
        .join('');
    }
    
    runTests();
  </script>
</body>
</html>
```

---

## 11. Updated Task Priorities

### Immediate Actions (Week 1, Day 1)

1. **Initialize Tauri 2.0 project**:
   ```bash
   npm create tauri-app@latest
   ```

2. **Set up capabilities**:
   - Create `src-tauri/capabilities/default.json`
   - Create `src-tauri/capabilities/dapp.json`
   - Create `src-tauri/capabilities/wallet-commands.json`

3. **Verify Alloy dependencies**:
   - Check `src-tauri/Cargo.toml`
   - Ensure NO ethers dependencies
   - Add alloy with full features

4. **Migrate TransactionController**:
   - Copy from `src/controllers/transaction.rs`
   - Verify pure Alloy usage
   - Add to `src-tauri/src/controllers/transaction.rs`

---

## 12. Critical Security Checklist

Before any release:

- [ ] CSP is strict for wallet window
- [ ] Provider injection uses `initialization_script`
- [ ] Origin verification in all commands
- [ ] dApp window has minimal permissions
- [ ] No ethers dependencies in final build
- [ ] Binary is optimized (< 20MB)
- [ ] All Iced code removed
- [ ] Mock dApp test suite passes
- [ ] Android build works
- [ ] Security audit complete

---

## Summary of Key Changes

1. **Tauri 2.0**: Use `npm create tauri-app@latest`, not `cargo tauri init`
2. **Permissions**: Use capabilities system, not allowlist
3. **Mobile**: Native support, not plugin
4. **Security**: Strict CSP, origin verification, initialization_script
5. **Alloy**: Pure Alloy, no ethers
6. **Debloat**: Phase 5 removes all Iced code
7. **Optimization**: LTO, codegen-units=1, strip=true

These changes make the migration more secure, smaller, and aligned with Tauri 2.0 best practices.
