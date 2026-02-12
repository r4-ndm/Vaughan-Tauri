# Error Handling

**Purpose**: Centralized error types and error handling utilities

This directory contains the error types used throughout the Vaughan wallet and utilities for error handling.

## Files

- `mod.rs` - Main `WalletError` enum and error handling utilities

## WalletError Enum

The central error type for all wallet operations:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WalletError {
    // Network errors
    NetworkError(String),
    RpcError(String),
    ConnectionFailed(String),
    
    // Address errors
    InvalidAddress(String),
    InvalidChecksum(String),
    
    // Transaction errors
    InsufficientBalance,
    TransactionFailed(String),
    InvalidTransaction(String),
    GasEstimationFailed(String),
    
    // Account errors
    AccountNotFound(String),
    InvalidPrivateKey(String),
    InvalidMnemonic(String),
    
    // Security errors
    Unauthorized,
    WalletLocked,
    InvalidPassword,
    EncryptionFailed(String),
    DecryptionFailed(String),
    
    // Chain adapter errors
    ChainNotSupported(String),
    AdapterNotFound(String),
    
    // dApp errors
    DappNotConnected(String),
    PermissionDenied(String),
    
    // General errors
    InternalError(String),
    ConfigError(String),
}
```

## Error Conversion

Convert from external error types:

```rust
// From Alloy errors
impl From<alloy::transports::RpcError<alloy::transports::TransportErrorKind>> for WalletError {
    fn from(err: alloy::transports::RpcError<alloy::transports::TransportErrorKind>) -> Self {
        WalletError::RpcError(err.to_string())
    }
}

// From Alloy provider errors
impl From<alloy::providers::ProviderError> for WalletError {
    fn from(err: alloy::providers::ProviderError) -> Self {
        WalletError::NetworkError(err.to_string())
    }
}

// From serde errors
impl From<serde_json::Error> for WalletError {
    fn from(err: serde_json::Error) -> Self {
        WalletError::ConfigError(err.to_string())
    }
}
```

## Error Display

Implement user-friendly error messages:

```rust
impl std::fmt::Display for WalletError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            WalletError::InsufficientBalance => {
                write!(f, "Insufficient balance for this transaction")
            }
            WalletError::WalletLocked => {
                write!(f, "Wallet is locked. Please unlock to continue.")
            }
            WalletError::InvalidAddress(addr) => {
                write!(f, "Invalid address: {}", addr)
            }
            // ... more variants
        }
    }
}
```

## Error Handling Patterns

### Pattern 1: Propagate with ?
```rust
pub async fn send_transaction(&self, tx: Transaction) -> Result<TxHash, WalletError> {
    let adapter = self.get_adapter()?;
    let receipt = adapter.send_transaction(tx).await?;
    Ok(receipt.hash)
}
```

### Pattern 2: Convert and Propagate
```rust
pub async fn get_balance(&self, address: &str) -> Result<Balance, WalletError> {
    let adapter = self.get_adapter()?;
    adapter.get_balance(address)
        .await
        .map_err(|e| WalletError::NetworkError(e.to_string()))
}
```

### Pattern 3: Add Context
```rust
pub fn parse_address(&self, addr: &str) -> Result<Address, WalletError> {
    addr.parse()
        .map_err(|_| WalletError::InvalidAddress(format!("Failed to parse: {}", addr)))
}
```

### Pattern 4: Handle in Commands
```rust
#[tauri::command]
pub async fn send_transaction(
    state: State<'_, Arc<Mutex<VaughanState>>>,
    to: String,
    amount: String,
) -> Result<String, String> {
    let state = state.lock().await;
    
    state.wallet.send_transaction(to, amount)
        .await
        .map_err(|e| e.to_string())  // Convert WalletError to String for Tauri
}
```

## Logging

Log errors with appropriate levels:

```rust
use tracing::{error, warn, info};

match result {
    Ok(value) => {
        info!("Transaction sent: {}", value);
        Ok(value)
    }
    Err(WalletError::InsufficientBalance) => {
        warn!("Transaction failed: insufficient balance");
        Err(WalletError::InsufficientBalance)
    }
    Err(e) => {
        error!("Unexpected error: {:?}", e);
        Err(e)
    }
}
```

## Security Considerations

### Don't Leak Sensitive Information
```rust
// ❌ BAD: Leaks private key in error
Err(WalletError::InvalidPrivateKey(format!("Key {} is invalid", private_key)))

// ✅ GOOD: Generic error message
Err(WalletError::InvalidPrivateKey("Invalid private key format".to_string()))
```

### Log Sensitive Errors Carefully
```rust
// ❌ BAD: Logs private key
error!("Failed to import key: {}", private_key);

// ✅ GOOD: Logs error without sensitive data
error!("Failed to import key: invalid format");
```

## Implementation Status

- [ ] `mod.rs` - WalletError enum and utilities
- [ ] Error conversion implementations
- [ ] Display implementation
- [ ] Tests for error handling

## References

- Alloy Error Handling: `.kiro/specs/external_refs/Alloy-Error-Handling.md`
- Rust Error Handling: https://doc.rust-lang.org/book/ch09-00-error-handling.html
