# Chain Adapters

**Purpose**: Multi-chain abstraction layer for blockchain operations

This directory contains the trait-based architecture that allows Vaughan to support multiple blockchain types (EVM, Stellar, Aptos, etc.) through a unified interface.

## Architecture

```
chains/
├── mod.rs          # ChainAdapter trait definition
├── types.rs        # Chain-agnostic types (Balance, TxHash, etc.)
└── evm/            # EVM implementation (Ethereum, PulseChain, etc.)
    ├── mod.rs
    ├── adapter.rs  # EvmAdapter implementing ChainAdapter
    ├── networks.rs # EVM network configurations
    └── utils.rs    # EVM-specific utilities
```

## ChainAdapter Trait

The `ChainAdapter` trait defines the interface that all blockchain implementations must provide:

```rust
#[async_trait]
pub trait ChainAdapter: Send + Sync {
    async fn get_balance(&self, address: &str) -> Result<Balance>;
    async fn send_transaction(&self, tx: ChainTransaction) -> Result<TxHash>;
    async fn sign_message(&self, address: &str, message: &[u8]) -> Result<Signature>;
    async fn get_transactions(&self, address: &str, limit: u32) -> Result<Vec<TxRecord>>;
    async fn estimate_fee(&self, tx: &ChainTransaction) -> Result<Fee>;
    async fn validate_address(&self, address: &str) -> Result<()>;
    fn chain_info(&self) -> ChainInfo;
    fn chain_type(&self) -> ChainType;
}
```

## Design Principles

1. **Chain-Agnostic Core**: Business logic in `core/` uses only the `ChainAdapter` trait
2. **Chain-Specific Implementation**: Each chain type implements the trait differently
3. **Type Safety**: Chain-specific types wrapped in enums for compile-time safety
4. **No Leaky Abstractions**: Chain-specific details stay in adapter implementations

## Adding a New Chain

To add support for a new blockchain:

1. Create directory: `chains/new_chain/`
2. Implement `ChainAdapter` trait for the new chain
3. Add chain type to `ChainType` enum in `types.rs`
4. Register adapter in `WalletState` (see `core/wallet.rs`)

## Current Implementations

- **EVM** (`evm/`): Ethereum, PulseChain, Polygon, BSC, etc.
  - Uses Alloy libraries exclusively
  - Supports all EVM-compatible chains

## Future Implementations

- **Stellar** (`stellar/`): Stellar network
- **Aptos** (`aptos/`): Aptos blockchain
- **Solana** (`solana/`): Solana network
- **Bitcoin** (`bitcoin/`): Bitcoin network

## Security Notes

- All chain adapters MUST use audited libraries (Alloy for EVM, official SDKs for others)
- NEVER implement custom cryptography
- All private key operations happen in the adapter layer
- Adapters are responsible for input validation

## References

- Phase 1 Plan: `.kiro/specs/Vaughan-Tauri/PHASE-1-PLAN.md`
- Multi-Chain Architecture: `.kiro/specs/Vaughan-Tauri/MULTI-CHAIN-ARCHITECTURE.md`
- Design Document: `.kiro/specs/Vaughan-Tauri/design.md` (Section 4)
