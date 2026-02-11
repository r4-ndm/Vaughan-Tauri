# Wallet Core

**Purpose**: Chain-agnostic wallet business logic

This directory contains the core wallet functionality that works across all blockchain types. All code here uses the `ChainAdapter` trait and never depends on chain-specific implementations.

## Architecture Layer

This is **Layer 1** in the 5-layer architecture:
```
Layer 4: UI (React)           → Presentation
Layer 3: Provider APIs        → EIP-1193 translation
Layer 2: Tauri Commands       → IPC bridge
Layer 1: Wallet Core          → Business logic (THIS LAYER)
Layer 0: Chain Adapters       → Chain-specific operations
```

## Files

- `wallet.rs` - `WalletState` struct managing all chain adapters
- `account.rs` - Multi-chain account management
- `transaction.rs` - Chain-agnostic transaction logic
- `network.rs` - Network management across chains
- `price.rs` - Price tracking for multiple chains

## WalletState

The central state manager that coordinates all chain adapters:

```rust
pub struct WalletState {
    // Chain adapters (one per chain type)
    adapters: HashMap<ChainType, Arc<dyn ChainAdapter>>,
    
    // Active state
    active_chain: ChainType,
    active_account: Option<Address>,
    
    // Accounts (multi-chain)
    accounts: Vec<Account>,
    
    // Security
    wallet_locked: bool,
}
```

## Design Principles

### 1. Chain-Agnostic
All code in this directory:
- Uses `ChainAdapter` trait, not concrete types
- Works with any blockchain that implements the trait
- Never imports chain-specific code (no `use crate::chains::evm`)

### 2. Business Logic Only
This layer contains:
- ✅ Account management
- ✅ Transaction validation
- ✅ Balance tracking
- ✅ Network switching
- ✅ Price calculations

This layer does NOT contain:
- ❌ UI code
- ❌ Tauri commands
- ❌ Chain-specific operations
- ❌ RPC calls (delegated to adapters)

### 3. Proper Error Handling
- All methods return `Result<T, WalletError>`
- Errors propagate up to command layer
- No `.unwrap()` or `.expect()`

## Multi-Chain Account Model

Each account can have addresses on multiple chains:

```rust
pub struct Account {
    id: AccountId,
    name: String,
    addresses: HashMap<ChainType, String>,  // One address per chain
    derivation_path: Option<String>,        // For HD wallets
}
```

Example:
```
Account "Main"
├── EVM:     0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
├── Stellar: GCZJ...ABCD
└── Aptos:   0x1234...5678
```

## Controller Migration

This directory will contain refactored versions of the old Iced controllers:

- `TransactionController` → `transaction.rs` (chain-agnostic)
- `NetworkController` → `network.rs` (multi-chain)
- `WalletController` → `account.rs` (multi-chain accounts)
- `PriceController` → `price.rs` (multi-chain prices)

**Process**: Analyze → Improve → Rebuild (NOT copy-paste)

## Implementation Status

- [ ] `wallet.rs` - WalletState and adapter management
- [ ] `account.rs` - Multi-chain account management
- [ ] `transaction.rs` - Transaction logic (refactored from old controller)
- [ ] `network.rs` - Network management (refactored from old controller)
- [ ] `price.rs` - Price tracking (refactored from old controller)
- [ ] Tests for all modules

## References

- Controller Lifecycle: `.kiro/specs/Vaughan-Tauri/controller-lifecycle.md`
- Design Document: `.kiro/specs/Vaughan-Tauri/design.md` (Section 5)
- Old Controllers: `Vaughan-old/Vaughan-main-old/src/controllers/` (reference only)
