# Alloy Error Handling Patterns

**Source**: https://docs.rs/alloy + https://alloy.rs/examples  
**Last Updated**: February 3, 2026  
**Status**: ✅ VERIFIED (Official Alloy Documentation)

---

## 📚 Overview

Alloy uses Rust's `Result` type for error handling. This guide covers common error types and patterns for handling them in Vaughan-Tauri.

---

## 🎯 Common Error Types

### 1. RpcError

**Description**: Errors from JSON-RPC communication

**Type**: `alloy::transports::RpcError<TransportErrorKind>`

**Common Causes**:
- Network connection failures
- Invalid RPC responses
- Rate limiting
- Node errors

**Example**:
```rust
use alloy::transports::RpcError;

match provider.get_balance(address).await {
    Ok(balance) => println!("Balance: {}", balance),
    Err(RpcError::Transport(e)) => {
        eprintln!("Transport error: {}", e);
    }
    Err(RpcError::ErrorResp(payload)) => {
        eprintln!("RPC error {}: {}", payload.code, payload.message);
    }
    Err(e) => {
        eprintln!("Other error: {}", e);
    }
}
```

---

### 2. TransportError

**Description**: Low-level transport errors

**Type**: `alloy::transports::TransportErrorKind`

**Common Variants**:
- `Custom`: Custom error (e.g., network timeout)
- `HttpError`: HTTP-specific errors
- `SerdeJson`: JSON serialization errors

**Example**:
```rust
use alloy::transports::{RpcError, TransportErrorKind};

async fn fetch_balance(provider: &Provider, address: &str) -> Result<String, String> {
    match provider.get_balance(address).await {
        Ok(balance) => Ok(balance.to_string()),
        Err(RpcError::Transport(TransportErrorKind::Custom(e))) => {
            Err(format!("Network error: {}", e))
        }
        Err(e) => Err(format!("RPC error: {}", e)),
    }
}
```

---

### 3. Contract Errors

**Description**: Errors from contract interactions

**Common Causes**:
- Contract reverts
- Invalid function calls
- Gas estimation failures
- Insufficient gas

**Example (Revert Decoding)**:
```rust
use alloy::{sol, primitives::U256};

sol! {
    #[derive(Debug, PartialEq, Eq)]
    library Errors {
        error InsufficientBalance(uint256 requested, uint256 available);
        error InvalidAddress(address addr);
    }
}

async fn send_transaction(contract: &Contract) -> Result<String, String> {
    match contract.transfer(recipient, amount).call().await {
        Ok(tx_hash) => Ok(tx_hash),
        Err(e) => {
            // Try to decode as custom error
            if let Some(revert_data) = e.as_revert_data() {
                // Decode specific error
                if let Ok(err) = Errors::InsufficientBalance::abi_decode(revert_data, true) {
                    return Err(format!(
                        "Insufficient balance: requested {}, available {}",
                        err.requested, err.available
                    ));
                }
            }
            Err(format!("Transaction failed: {}", e))
        }
    }
}
```

---

## 🔧 Error Handling Patterns

### Pattern 1: Simple Error Conversion

**Use when**: You just need a string error message

```rust
use alloy::providers::Provider;

#[tauri::command]
async fn get_balance(address: String) -> Result<String, String> {
    let provider = get_provider().await;
    
    let balance = provider
        .get_balance(&address)
        .await
        .map_err(|e| format!("Failed to fetch balance: {}", e))?;
    
    Ok(balance.to_string())
}
```

---

### Pattern 2: Custom Error Type

**Use when**: You need structured error handling

```rust
use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum WalletError {
    #[error("Network error: {0}")]
    Network(String),
    
    #[error("Invalid address: {0}")]
    InvalidAddress(String),
    
    #[error("Insufficient balance: need {need}, have {have}")]
    InsufficientBalance { need: String, have: String },
    
    #[error("Transaction failed: {0}")]
    TransactionFailed(String),
}

// Serialize for Tauri
#[derive(Serialize)]
struct ErrorResponse {
    code: String,
    message: String,
}

impl Serialize for WalletError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        let response = ErrorResponse {
            code: match self {
                Self::Network(_) => "NETWORK_ERROR".to_string(),
                Self::InvalidAddress(_) => "INVALID_ADDRESS".to_string(),
                Self::InsufficientBalance { .. } => "INSUFFICIENT_BALANCE".to_string(),
                Self::TransactionFailed(_) => "TRANSACTION_FAILED".to_string(),
            },
            message: self.to_string(),
        };
        response.serialize(serializer)
    }
}

// Convert Alloy errors to WalletError
impl From<alloy::transports::RpcError<alloy::transports::TransportErrorKind>> for WalletError {
    fn from(err: alloy::transports::RpcError<alloy::transports::TransportErrorKind>) -> Self {
        match err {
            alloy::transports::RpcError::Transport(e) => {
                WalletError::Network(e.to_string())
            }
            alloy::transports::RpcError::ErrorResp(payload) => {
                WalletError::TransactionFailed(payload.message)
            }
            e => WalletError::Network(e.to_string()),
        }
    }
}

#[tauri::command]
async fn send_transaction(
    recipient: String,
    amount: String,
) -> Result<String, WalletError> {
    // Validate address
    if !recipient.starts_with("0x") {
        return Err(WalletError::InvalidAddress(recipient));
    }
    
    let provider = get_provider().await;
    
    // Get balance
    let balance = provider.get_balance(&sender).await?;
    let amount_wei = parse_ether(&amount)?;
    
    // Check balance
    if balance < amount_wei {
        return Err(WalletError::InsufficientBalance {
            need: amount,
            have: format_ether(balance),
        });
    }
    
    // Send transaction
    let tx_hash = provider
        .send_transaction(recipient, amount_wei)
        .await?;
    
    Ok(tx_hash)
}
```

---

### Pattern 3: Retry Logic

**Use when**: Network requests might fail temporarily

```rust
use tokio::time::{sleep, Duration};

async fn fetch_with_retry<T, F, Fut>(
    operation: F,
    max_retries: u32,
) -> Result<T, String>
where
    F: Fn() -> Fut,
    Fut: std::future::Future<Output = Result<T, alloy::transports::RpcError<alloy::transports::TransportErrorKind>>>,
{
    let mut attempts = 0;
    
    loop {
        match operation().await {
            Ok(result) => return Ok(result),
            Err(e) => {
                attempts += 1;
                
                if attempts >= max_retries {
                    return Err(format!("Failed after {} attempts: {}", attempts, e));
                }
                
                // Exponential backoff
                let delay = Duration::from_millis(100 * 2_u64.pow(attempts - 1));
                sleep(delay).await;
            }
        }
    }
}

// Usage
#[tauri::command]
async fn get_balance_with_retry(address: String) -> Result<String, String> {
    let provider = get_provider().await;
    
    let balance = fetch_with_retry(
        || async { provider.get_balance(&address).await },
        3, // max 3 retries
    ).await?;
    
    Ok(balance.to_string())
}
```

---

### Pattern 4: Timeout Handling

**Use when**: Operations might hang indefinitely

```rust
use tokio::time::{timeout, Duration};

#[tauri::command]
async fn get_balance_with_timeout(address: String) -> Result<String, String> {
    let provider = get_provider().await;
    
    let balance = timeout(
        Duration::from_secs(10),
        provider.get_balance(&address)
    )
    .await
    .map_err(|_| "Request timed out".to_string())?
    .map_err(|e| format!("Failed to fetch balance: {}", e))?;
    
    Ok(balance.to_string())
}
```

---

### Pattern 5: Fallback Providers

**Use when**: Primary RPC might fail, need backup

```rust
async fn get_balance_with_fallback(
    address: &str,
    providers: &[Provider],
) -> Result<String, String> {
    let mut last_error = String::new();
    
    for provider in providers {
        match provider.get_balance(address).await {
            Ok(balance) => return Ok(balance.to_string()),
            Err(e) => {
                last_error = e.to_string();
                continue;
            }
        }
    }
    
    Err(format!("All providers failed. Last error: {}", last_error))
}
```

---

## 📋 Vaughan-Tauri Specific Patterns

### Pattern 1: Network Controller Error Handling

```rust
use std::sync::Arc;
use alloy::providers::Provider;

pub struct NetworkController {
    provider: Arc<dyn Provider>,
}

impl NetworkController {
    pub async fn get_balance(&self, address: &str) -> Result<String, WalletError> {
        // Validate address format
        if !address.starts_with("0x") || address.len() != 42 {
            return Err(WalletError::InvalidAddress(address.to_string()));
        }
        
        // Fetch balance with timeout
        let balance = timeout(
            Duration::from_secs(10),
            self.provider.get_balance(address)
        )
        .await
        .map_err(|_| WalletError::Network("Request timed out".to_string()))?
        .map_err(|e| WalletError::from(e))?;
        
        Ok(balance.to_string())
    }
    
    pub async fn get_gas_price(&self) -> Result<String, WalletError> {
        let gas_price = self.provider
            .get_gas_price()
            .await
            .map_err(|e| WalletError::from(e))?;
        
        Ok(gas_price.to_string())
    }
}
```

---

### Pattern 2: Transaction Controller Error Handling

```rust
pub struct TransactionController {
    provider: Arc<dyn Provider>,
}

impl TransactionController {
    pub async fn send_transaction(
        &self,
        to: &str,
        value: &str,
        data: Option<&str>,
    ) -> Result<String, WalletError> {
        // Validate recipient
        if !to.starts_with("0x") {
            return Err(WalletError::InvalidAddress(to.to_string()));
        }
        
        // Parse value
        let value_wei = parse_ether(value)
            .map_err(|e| WalletError::InvalidAmount(e.to_string()))?;
        
        // Build transaction
        let tx = TransactionRequest::new()
            .to(to)
            .value(value_wei)
            .data(data.map(|d| d.as_bytes().to_vec()));
        
        // Estimate gas
        let gas_estimate = self.provider
            .estimate_gas(&tx)
            .await
            .map_err(|e| match e {
                RpcError::ErrorResp(payload) if payload.message.contains("insufficient funds") => {
                    WalletError::InsufficientBalance {
                        need: value.to_string(),
                        have: "unknown".to_string(),
                    }
                }
                _ => WalletError::from(e),
            })?;
        
        // Send transaction
        let tx_hash = self.provider
            .send_transaction(tx.gas(gas_estimate))
            .await
            .map_err(|e| WalletError::TransactionFailed(e.to_string()))?;
        
        Ok(tx_hash)
    }
}
```

---

### Pattern 3: User-Friendly Error Messages

```rust
impl WalletError {
    pub fn user_message(&self) -> String {
        match self {
            Self::Network(_) => {
                "Network connection failed. Please check your internet connection.".to_string()
            }
            Self::InvalidAddress(addr) => {
                format!("Invalid Ethereum address: {}", addr)
            }
            Self::InsufficientBalance { need, have } => {
                format!("Insufficient balance. Need {} ETH, but only have {} ETH", need, have)
            }
            Self::TransactionFailed(msg) if msg.contains("gas") => {
                "Transaction failed due to insufficient gas. Try increasing the gas limit.".to_string()
            }
            Self::TransactionFailed(msg) if msg.contains("nonce") => {
                "Transaction failed due to nonce mismatch. Please try again.".to_string()
            }
            Self::TransactionFailed(_) => {
                "Transaction failed. Please try again later.".to_string()
            }
        }
    }
}

#[tauri::command]
async fn send_transaction_friendly(
    recipient: String,
    amount: String,
) -> Result<String, String> {
    match send_transaction_internal(recipient, amount).await {
        Ok(hash) => Ok(hash),
        Err(e) => Err(e.user_message()),
    }
}
```

---

## ⚠️ Common Pitfalls

### ❌ DON'T: Ignore error details
```rust
// Wrong - loses error context
.map_err(|_| "Error occurred".to_string())?
```

### ✅ DO: Preserve error information
```rust
// Correct - includes error details
.map_err(|e| format!("Failed to fetch balance: {}", e))?
```

---

### ❌ DON'T: Panic on errors
```rust
// Wrong - crashes the app
let balance = provider.get_balance(address).await.unwrap();
```

### ✅ DO: Handle errors gracefully
```rust
// Correct - returns error to caller
let balance = provider.get_balance(address).await
    .map_err(|e| format!("Failed to fetch balance: {}", e))?;
```

---

### ❌ DON'T: Expose internal errors to users
```rust
// Wrong - confusing for users
Err(format!("RpcError::Transport(TransportErrorKind::Custom(...))"))
```

### ✅ DO: Provide user-friendly messages
```rust
// Correct - clear and actionable
Err("Network connection failed. Please check your internet connection.".to_string())
```

---

## 📚 Additional Resources

- **Alloy Docs**: https://docs.rs/alloy
- **Alloy Examples**: https://alloy.rs/examples
- **thiserror**: https://docs.rs/thiserror
- **anyhow**: https://docs.rs/anyhow (for application-level errors)

---

**Remember**: Always provide context when converting errors, and use user-friendly messages in the UI!
