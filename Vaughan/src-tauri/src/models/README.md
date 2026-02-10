# Data Models

**Purpose**: Shared data types used across the application

This directory contains all data structures (models) used throughout the Vaughan wallet. These types are used by commands, wallet core, and chain adapters.

## Files

- `account.rs` - Account-related types
- `transaction.rs` - Transaction-related types
- `network.rs` - Network configuration types
- `token.rs` - Token and balance types
- `error.rs` - Error types
- `dapp.rs` - dApp connection types

## Design Principles

### 1. Serialization
All types that cross the IPC boundary (Rust ↔ TypeScript) must derive:
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MyType {
    // ...
}
```

### 2. Type Safety
- Use strong types instead of primitives (e.g., `Address` not `String`)
- Use enums for fixed sets of values
- Use `Option<T>` for optional fields
- Use `Result<T, E>` for operations that can fail

### 3. Documentation
Every type must have:
- Doc comment explaining its purpose
- Doc comments on all fields
- Usage examples where appropriate

## Core Types

### Account Types
```rust
pub struct Account {
    pub id: AccountId,
    pub name: String,
    pub addresses: HashMap<ChainType, String>,
    pub account_type: AccountType,
}

pub enum AccountType {
    Imported,      // Imported from private key
    Mnemonic,      // Derived from mnemonic
    Hardware,      // Hardware wallet
}
```

### Transaction Types
```rust
pub struct Transaction {
    pub from: String,
    pub to: String,
    pub value: String,
    pub data: Option<String>,
    pub gas_limit: Option<u64>,
    pub gas_price: Option<String>,
}

pub struct TxReceipt {
    pub hash: String,
    pub status: TxStatus,
    pub block_number: Option<u64>,
}

pub enum TxStatus {
    Pending,
    Confirmed,
    Failed,
}
```

### Network Types
```rust
pub struct NetworkConfig {
    pub id: String,
    pub name: String,
    pub chain_id: u64,
    pub chain_type: ChainType,
    pub rpc_url: String,
    pub explorer_url: Option<String>,
    pub native_token: TokenInfo,
}

pub enum ChainType {
    Evm,
    Stellar,
    Aptos,
    Solana,
    Bitcoin,
}
```

### Token Types
```rust
pub struct TokenInfo {
    pub symbol: String,
    pub name: String,
    pub decimals: u8,
    pub contract_address: Option<String>,
}

pub struct Balance {
    pub token: TokenInfo,
    pub amount: String,        // Raw amount (wei, lamports, etc.)
    pub formatted: String,     // Human-readable (e.g., "1.5 ETH")
    pub usd_value: Option<f64>,
}
```

### Error Types
```rust
pub enum WalletError {
    NetworkError(String),
    InvalidAddress(String),
    InsufficientBalance,
    TransactionFailed(String),
    Unauthorized,
    WalletLocked,
    // ... more variants
}
```

### dApp Types
```rust
pub struct DappConnection {
    pub origin: String,
    pub connected_at: u64,
    pub permissions: Vec<Permission>,
    pub accounts: Vec<String>,
}

pub enum Permission {
    ReadAccounts,
    SignTransactions,
    SignMessages,
}
```

## Conversion Traits

Implement conversion traits for interoperability:

```rust
// Convert from Alloy types
impl From<alloy::primitives::Address> for Address {
    fn from(addr: alloy::primitives::Address) -> Self {
        Address(addr.to_string())
    }
}

// Convert to Alloy types
impl TryFrom<Address> for alloy::primitives::Address {
    type Error = WalletError;
    
    fn try_from(addr: Address) -> Result<Self, Self::Error> {
        addr.0.parse()
            .map_err(|_| WalletError::InvalidAddress(addr.0))
    }
}
```

## Implementation Status

- [ ] `account.rs` - Account types
- [ ] `transaction.rs` - Transaction types
- [ ] `network.rs` - Network types
- [ ] `token.rs` - Token and balance types
- [ ] `error.rs` - Error types
- [ ] `dapp.rs` - dApp types
- [ ] Tests for all types

## References

- Design Document: `.kiro/specs/Vaughan-Tauri/design.md` (Section 6)
- Serde Documentation: https://serde.rs/
