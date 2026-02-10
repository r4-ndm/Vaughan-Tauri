# EVM Chain Adapter

**Purpose**: Ethereum Virtual Machine blockchain support using Alloy

This directory implements the `ChainAdapter` trait for all EVM-compatible chains (Ethereum, PulseChain, Polygon, BSC, etc.).

## Files

- `mod.rs` - Module exports
- `adapter.rs` - `EvmAdapter` struct implementing `ChainAdapter`
- `networks.rs` - EVM network configurations (chain IDs, RPC URLs, explorers)
- `utils.rs` - EVM-specific utilities (format_units, parse_units, etc.)

## EvmAdapter

The `EvmAdapter` struct wraps an Alloy provider and implements all `ChainAdapter` methods:

```rust
pub struct EvmAdapter {
    provider: RootProvider<Http<Client>>,
    network_id: String,
    chain_id: u64,
}
```

## Critical Requirements

### 1. Alloy Purity
- **ONLY** use `alloy::*` imports
- **ZERO** `ethers-rs` imports allowed
- Use `alloy::primitives` for all types (Address, U256, Bytes, etc.)

### 2. Concrete Provider Type
From POC-1 lesson learned:
```rust
✅ CORRECT: RootProvider<Http<Client>>
❌ WRONG:   Arc<dyn Provider>  // Provider trait is generic over transport
```

### 3. Error Handling
- All methods return `Result<T, WalletError>`
- Convert Alloy errors to `WalletError`
- Never use `.unwrap()` or `.expect()`

## Supported Networks

The adapter supports all EVM-compatible chains through configuration:

- Ethereum Mainnet (Chain ID: 1)
- PulseChain (Chain ID: 369)
- Polygon (Chain ID: 137)
- Binance Smart Chain (Chain ID: 56)
- Arbitrum (Chain ID: 42161)
- Optimism (Chain ID: 10)
- And more...

See `networks.rs` for full list and configuration.

## Usage Example

```rust
use crate::chains::{ChainAdapter, evm::EvmAdapter};

// Create adapter
let adapter = EvmAdapter::new("https://eth.llamarpc.com", "ethereum", 1).await?;

// Use through trait
let balance = adapter.get_balance("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb").await?;
println!("Balance: {} ETH", balance.formatted());
```

## Implementation Status

- [ ] `adapter.rs` - EvmAdapter struct and ChainAdapter implementation
- [ ] `networks.rs` - Network configurations
- [ ] `utils.rs` - EVM utilities
- [ ] Tests for all methods

## References

- Alloy Cheatsheet: `.kiro/specs/external_refs/Alloy-Cheatsheet.md`
- Alloy Error Handling: `.kiro/specs/external_refs/Alloy-Error-Handling.md`
- POC-1 Code: `Vaughan/src-tauri/src/lib.rs` (reference example)
