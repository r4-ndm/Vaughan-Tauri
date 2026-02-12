# TypeScript + Tauri Integration Guide

**Source**: https://tauri.app/develop/calling-rust/  
**Last Updated**: February 3, 2026  
**Status**: ✅ VERIFIED (Official Tauri Documentation)

---

## 📚 Overview

This guide covers how to call Rust functions from TypeScript with full type safety in Tauri applications.

---

## 🎯 Basic Command Pattern

### Rust Side (Backend)

**Define a command**:
```rust
// src-tauri/src/lib.rs

#[tauri::command]
fn greet(name: String) -> String {
    format!("Hello, {}!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### TypeScript Side (Frontend)

**Call the command**:
```typescript
import { invoke } from '@tauri-apps/api/core';

async function greetUser() {
  const result = await invoke<string>('greet', { name: 'Alice' });
  console.log(result); // "Hello, Alice!"
}
```

---

## 🔧 Type Safety Patterns

### Pattern 1: Simple Types

**Rust**:
```rust
#[tauri::command]
fn add(a: i32, b: i32) -> i32 {
    a + b
}
```

**TypeScript**:
```typescript
const sum = await invoke<number>('add', { a: 5, b: 3 });
// sum: number = 8
```

---

### Pattern 2: Complex Types

**Rust**:
```rust
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
struct User {
    id: u64,
    name: String,
    email: String,
}

#[tauri::command]
fn get_user(user_id: u64) -> Result<User, String> {
    Ok(User {
        id: user_id,
        name: "Alice".to_string(),
        email: "alice@example.com".to_string(),
    })
}
```

**TypeScript**:
```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

const user = await invoke<User>('get_user', { userId: 1 });
// user: User = { id: 1, name: "Alice", email: "alice@example.com" }
```

**Note**: Use camelCase in TypeScript, snake_case in Rust. Tauri handles conversion automatically.

---

### Pattern 3: Optional Values

**Rust**:
```rust
#[tauri::command]
fn find_user(email: String) -> Option<User> {
    // Returns Some(user) or None
    None
}
```

**TypeScript**:
```typescript
const user = await invoke<User | null>('find_user', { 
  email: 'alice@example.com' 
});

if (user) {
  console.log(user.name);
} else {
  console.log('User not found');
}
```

---

## ⚠️ Error Handling

### Pattern 1: Result Type

**Rust**:
```rust
#[tauri::command]
fn send_transaction(
    recipient: String,
    amount: String,
) -> Result<String, String> {
    if recipient.is_empty() {
        return Err("Recipient cannot be empty".to_string());
    }
    
    // Process transaction
    Ok("0x123abc...".to_string())
}
```

**TypeScript**:
```typescript
try {
  const txHash = await invoke<string>('send_transaction', {
    recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    amount: '1.0',
  });
  console.log('Transaction sent:', txHash);
} catch (error) {
  console.error('Transaction failed:', error);
  // error is a string: "Recipient cannot be empty"
}
```

---

### Pattern 2: Custom Error Types

**Rust**:
```rust
use serde::Serialize;

#[derive(Debug, thiserror::Error)]
enum CommandError {
    #[error("Invalid address: {0}")]
    InvalidAddress(String),
    
    #[error("Insufficient balance")]
    InsufficientBalance,
    
    #[error("Network error: {0}")]
    NetworkError(String),
}

// Custom serialization for better error messages
#[derive(Serialize)]
struct ErrorResponse {
    code: String,
    message: String,
}

impl Serialize for CommandError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        let response = ErrorResponse {
            code: match self {
                Self::InvalidAddress(_) => "INVALID_ADDRESS".to_string(),
                Self::InsufficientBalance => "INSUFFICIENT_BALANCE".to_string(),
                Self::NetworkError(_) => "NETWORK_ERROR".to_string(),
            },
            message: self.to_string(),
        };
        response.serialize(serializer)
    }
}

#[tauri::command]
fn send_transaction(
    recipient: String,
    amount: String,
) -> Result<String, CommandError> {
    if !recipient.starts_with("0x") {
        return Err(CommandError::InvalidAddress(recipient));
    }
    
    Ok("0x123abc...".to_string())
}
```

**TypeScript**:
```typescript
interface ErrorResponse {
  code: string;
  message: string;
}

try {
  const txHash = await invoke<string>('send_transaction', {
    recipient: 'invalid',
    amount: '1.0',
  });
} catch (error) {
  const err = error as ErrorResponse;
  
  switch (err.code) {
    case 'INVALID_ADDRESS':
      console.error('Please enter a valid Ethereum address');
      break;
    case 'INSUFFICIENT_BALANCE':
      console.error('Not enough funds');
      break;
    case 'NETWORK_ERROR':
      console.error('Network connection failed');
      break;
  }
}
```

---

## 🔄 Async Commands

### Rust Side

**Async command**:
```rust
#[tauri::command]
async fn fetch_balance(address: String) -> Result<String, String> {
    // Simulate async operation
    tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
    
    // Fetch balance from blockchain
    Ok("10.5 ETH".to_string())
}
```

### TypeScript Side

**Call async command** (same as sync):
```typescript
const balance = await invoke<string>('fetch_balance', {
  address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
});
```

---

## 🌐 Accessing Tauri Context

### Pattern 1: Window Handle

**Rust**:
```rust
use tauri::Window;

#[tauri::command]
fn show_notification(window: Window, message: String) {
    println!("Showing notification in window: {}", window.label());
    // Use window to emit events, etc.
}
```

**TypeScript**:
```typescript
await invoke('show_notification', { 
  message: 'Transaction confirmed!' 
});
// Window handle is passed automatically
```

---

### Pattern 2: App Handle

**Rust**:
```rust
use tauri::AppHandle;

#[tauri::command]
fn get_app_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}
```

**TypeScript**:
```typescript
const version = await invoke<string>('get_app_version');
console.log('App version:', version);
```

---

### Pattern 3: State Management

**Rust**:
```rust
use std::sync::Mutex;
use tauri::State;

struct AppState {
    current_network: Mutex<String>,
}

#[tauri::command]
fn get_current_network(state: State<AppState>) -> String {
    state.current_network.lock().unwrap().clone()
}

#[tauri::command]
fn switch_network(state: State<AppState>, network: String) {
    *state.current_network.lock().unwrap() = network;
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            current_network: Mutex::new("ethereum-mainnet".to_string()),
        })
        .invoke_handler(tauri::generate_handler![
            get_current_network,
            switch_network
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**TypeScript**:
```typescript
// Get current network
const network = await invoke<string>('get_current_network');

// Switch network
await invoke('switch_network', { network: 'polygon-mainnet' });
```

---

## 📋 Vaughan-Tauri Specific Patterns

### Pattern 1: Get Balance

**Rust**:
```rust
#[derive(Serialize)]
struct Balance {
    native: String,
    tokens: Vec<TokenBalance>,
}

#[derive(Serialize)]
struct TokenBalance {
    symbol: String,
    balance: String,
    address: String,
}

#[tauri::command]
async fn get_balance(
    state: State<'_, VaughanState>,
    address: String,
) -> Result<Balance, String> {
    let wallet_ctrl = state.wallet_controller.lock().await;
    
    // Get native balance
    let native = wallet_ctrl.get_native_balance(&address).await
        .map_err(|e| e.to_string())?;
    
    // Get token balances
    let tokens = wallet_ctrl.get_token_balances(&address).await
        .map_err(|e| e.to_string())?;
    
    Ok(Balance { native, tokens })
}
```

**TypeScript**:
```typescript
interface TokenBalance {
  symbol: string;
  balance: string;
  address: string;
}

interface Balance {
  native: string;
  tokens: TokenBalance[];
}

const balance = await invoke<Balance>('get_balance', {
  address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
});

console.log('ETH:', balance.native);
balance.tokens.forEach(token => {
  console.log(`${token.symbol}: ${token.balance}`);
});
```

---

### Pattern 2: Send Transaction

**Rust**:
```rust
#[derive(Deserialize)]
struct TransactionRequest {
    to: String,
    value: String,
    data: Option<String>,
}

#[derive(Serialize)]
struct TransactionResponse {
    hash: String,
    status: String,
}

#[tauri::command]
async fn send_transaction(
    state: State<'_, VaughanState>,
    request: TransactionRequest,
) -> Result<TransactionResponse, String> {
    let tx_ctrl = state.get_transaction_controller().await
        .map_err(|e| e.to_string())?;
    
    let hash = tx_ctrl.send_transaction(
        &request.to,
        &request.value,
        request.data.as_deref(),
    ).await.map_err(|e| e.to_string())?;
    
    Ok(TransactionResponse {
        hash,
        status: "pending".to_string(),
    })
}
```

**TypeScript**:
```typescript
interface TransactionRequest {
  to: string;
  value: string;
  data?: string;
}

interface TransactionResponse {
  hash: string;
  status: string;
}

const response = await invoke<TransactionResponse>('send_transaction', {
  request: {
    to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    value: '1.0',
  },
});

console.log('Transaction hash:', response.hash);
```

---

### Pattern 3: Network Switching

**Rust**:
```rust
#[derive(Serialize)]
struct Network {
    id: String,
    name: String,
    chain_id: u64,
    rpc_url: String,
}

#[tauri::command]
async fn get_networks(
    state: State<'_, VaughanState>,
) -> Result<Vec<Network>, String> {
    let networks = state.get_available_networks().await;
    Ok(networks)
}

#[tauri::command]
async fn switch_network(
    state: State<'_, VaughanState>,
    network_id: String,
) -> Result<(), String> {
    state.switch_network(&network_id).await
        .map_err(|e| e.to_string())
}
```

**TypeScript**:
```typescript
interface Network {
  id: string;
  name: string;
  chainId: number;
  rpcUrl: string;
}

// Get available networks
const networks = await invoke<Network[]>('get_networks');

// Switch to a network
await invoke('switch_network', { networkId: 'ethereum-mainnet' });
```

---

## 🎨 Type Generation (Advanced)

For large projects, consider using `ts-rs` to auto-generate TypeScript types from Rust:

**Rust**:
```rust
use ts_rs::TS;

#[derive(Serialize, Deserialize, TS)]
#[ts(export)]
struct User {
    id: u64,
    name: String,
    email: String,
}
```

This generates a `User.ts` file automatically!

---

## ⚠️ Common Pitfalls

### ❌ DON'T: Forget to register commands
```rust
// Wrong - command not registered
#[tauri::command]
fn my_command() {}

pub fn run() {
    tauri::Builder::default()
        // .invoke_handler(...) // Missing!
        .run(tauri::generate_context!())
}
```

### ✅ DO: Register all commands
```rust
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![my_command])
        .run(tauri::generate_context!())
}
```

---

### ❌ DON'T: Use snake_case in TypeScript
```typescript
// Wrong
await invoke('get_balance', { user_id: 1 });
```

### ✅ DO: Use camelCase in TypeScript
```typescript
// Correct - Tauri converts automatically
await invoke('get_balance', { userId: 1 });
```

---

### ❌ DON'T: Forget type annotations
```typescript
// Wrong - no type safety
const result = await invoke('get_user', { userId: 1 });
```

### ✅ DO: Add type annotations
```typescript
// Correct - full type safety
const result = await invoke<User>('get_user', { userId: 1 });
```

---

## 📚 Additional Resources

- **Official Docs**: https://tauri.app/develop/calling-rust/
- **Type Safety**: https://tauri.app/develop/typescript/
- **State Management**: https://tauri.app/develop/state-management/

---

**Remember**: Always use TypeScript generics with `invoke<T>()` for type safety!
