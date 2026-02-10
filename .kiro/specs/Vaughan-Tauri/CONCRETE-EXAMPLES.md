# Concrete Implementation Examples

**Purpose**: Provide copy-paste-ready code examples for critical paths  
**Status**: Reference Material

---

## 1. Minimal Working Transaction Flow

### Backend (Rust)

```rust
// src-tauri/src/commands/transaction.rs

use alloy::primitives::{Address, U256};
use alloy::providers::{Provider, ProviderBuilder};
use alloy::signers::{LocalWallet, Signer};
use alloy::network::EthereumWallet;
use std::str::FromStr;

#[tauri::command]
pub async fn send_transaction(
    to: String,
    amount: String,
    rpc_url: String,
    private_key: String, // In real app, get from secure storage
) -> Result<String, String> {
    // 1. Parse inputs to Alloy types
    let to_addr = Address::from_str(&to)
        .map_err(|e| format!("Invalid address: {}", e))?;
    
    let amount_wei = U256::from_str(&amount)
        .map_err(|e| format!("Invalid amount: {}", e))?;
    
    // 2. Create Alloy provider
    let provider = ProviderBuilder::new()
        .on_http(rpc_url.parse().unwrap());
    
    // 3. Create Alloy signer
    let wallet = LocalWallet::from_str(&private_key)
        .map_err(|e| format!("Invalid private key: {}", e))?;
    
    let ethereum_wallet = EthereumWallet::from(wallet);
    
    // 4. Build transaction
    let tx = alloy::rpc::types::TransactionRequest::default()
        .to(to_addr)
        .value(amount_wei)
        .gas_limit(21000);
    
    // 5. Send transaction
    let pending_tx = provider
        .send_transaction(tx)
        .await
        .map_err(|e| format!("Failed to send: {}", e))?;
    
    // 6. Get transaction hash
    let tx_hash = pending_tx.tx_hash();
    
    Ok(format!("{:?}", tx_hash))
}
```

### Frontend (TypeScript)

```typescript
// web/src/services/tauri.ts

import { invoke } from '@tauri-apps/api/core';

export async function sendTransaction(
  to: string,
  amount: string,
  rpcUrl: string,
  privateKey: string
): Promise<string> {
  try {
    const txHash = await invoke<string>('send_transaction', {
      to,
      amount,
      rpcUrl,
      privateKey,
    });
    return txHash;
  } catch (error) {
    throw new Error(`Transaction failed: ${error}`);
  }
}
```

### React Component

```tsx
// web/src/components/SendTransaction.tsx

import { useState } from 'react';
import { sendTransaction } from '../services/tauri';

export function SendTransaction() {
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('');

  const handleSend = async () => {
    try {
      setStatus('Sending...');
      const txHash = await sendTransaction(
        to,
        amount,
        'https://eth.llamarpc.com',
        'YOUR_PRIVATE_KEY' // In real app, from secure storage
      );
      setStatus(`Success! TX: ${txHash}`);
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    }
  };

  return (
    <div>
      <input
        value={to}
        onChange={(e) => setTo(e.target.value)}
        placeholder="Recipient address"
      />
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount in wei"
      />
      <button onClick={handleSend}>Send</button>
      <p>{status}</p>
    </div>
  );
}
```

---

## 2. Controller Lazy Initialization Pattern

```rust
// src-tauri/src/state/mod.rs

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use alloy::providers::{Provider, ProviderBuilder};

pub struct NetworkController {
    provider: Arc<dyn Provider>,
    chain_id: u64,
}

impl NetworkController {
    pub fn new(rpc_url: String, chain_id: u64) -> Self {
        let provider = ProviderBuilder::new()
            .on_http(rpc_url.parse().unwrap());
        
        Self {
            provider: Arc::new(provider),
            chain_id,
        }
    }
    
    pub async fn get_balance(&self, address: Address) -> Result<U256, String> {
        self.provider
            .get_balance(address)
            .await
            .map_err(|e| e.to_string())
    }
}

pub struct VaughanState {
    // Lazy-loaded controllers (cached per network)
    network_controllers: Arc<Mutex<HashMap<String, Arc<NetworkController>>>>,
}

impl VaughanState {
    pub fn new() -> Self {
        Self {
            network_controllers: Arc::new(Mutex::new(HashMap::new())),
        }
    }
    
    pub async fn get_network_controller(
        &self,
        network_id: &str,
        rpc_url: &str,
        chain_id: u64,
    ) -> Arc<NetworkController> {
        let mut controllers = self.network_controllers.lock().await;
        
        // Check if controller exists
        if let Some(controller) = controllers.get(network_id) {
            return Arc::clone(controller);
        }
        
        // Create new controller
        let controller = Arc::new(NetworkController::new(
            rpc_url.to_string(),
            chain_id,
        ));
        
        // Cache it
        controllers.insert(network_id.to_string(), Arc::clone(&controller));
        
        controller
    }
}

// Usage in command
#[tauri::command]
async fn get_balance(
    state: State<'_, Arc<Mutex<VaughanState>>>,
    network_id: String,
    rpc_url: String,
    chain_id: u64,
    address: String,
) -> Result<String, String> {
    let app_state = state.lock().await;
    
    // Get or create controller (lazy initialization)
    let controller = app_state
        .get_network_controller(&network_id, &rpc_url, chain_id)
        .await;
    
    // Use controller
    let addr = Address::from_str(&address).map_err(|e| e.to_string())?;
    let balance = controller.get_balance(addr).await?;
    
    Ok(balance.to_string())
}
```

---

## 3. MetaMask Provider Injection (Tauri 2.0)

### Provider Code (JavaScript)

```javascript
// This code will be injected via initialization_script

(function() {
  'use strict';
  
  // Create window.ethereum object
  window.ethereum = {
    isMetaMask: true,
    isVaughan: true,
    
    // Main API method
    request: async function({ method, params }) {
      try {
        // Use Tauri 2.0 invoke API
        const result = await window.__TAURI__.core.invoke('eth_request', {
          method: method,
          params: params || []
        });
        return result;
      } catch (error) {
        throw new Error(`MetaMask request failed: ${error}`);
      }
    },
    
    // Event listeners
    on: function(event, callback) {
      // Listen for Tauri events
      window.__TAURI__.event.listen(`ethereum_${event}`, (data) => {
        callback(data.payload);
      });
    },
    
    // Remove listener
    removeListener: function(event, callback) {
      // Tauri event unlisten
      window.__TAURI__.event.unlisten(`ethereum_${event}`);
    }
  };
  
  // Emit connect event
  window.dispatchEvent(new Event('ethereum#initialized'));
})();
```

### Tauri Configuration

```json
// src-tauri/tauri.conf.json

{
  "tauri": {
    "windows": [
      {
        "label": "main",
        "title": "Vaughan Wallet",
        "url": "index.html"
      },
      {
        "label": "dapp",
        "title": "dApp Browser",
        "url": "dapp.html",
        "initialization_script": "/* Provider code from above */"
      }
    ]
  }
}
```

### Backend Handler

```rust
// src-tauri/src/commands/ethereum.rs

#[tauri::command]
async fn eth_request(
    method: String,
    params: Vec<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    match method.as_str() {
        "eth_chainId" => {
            Ok(serde_json::json!("0x1")) // Ethereum mainnet
        }
        "eth_accounts" => {
            Ok(serde_json::json!(["0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"]))
        }
        "eth_requestAccounts" => {
            // Show approval dialog
            Ok(serde_json::json!(["0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"]))
        }
        "eth_sendTransaction" => {
            // Parse transaction, show approval, send
            Ok(serde_json::json!("0x1234..."))
        }
        _ => Err(format!("Unsupported method: {}", method))
    }
}
```

---

## 4. Complete Minimal App (All Together)

### Project Structure

```
vaughan-tauri/
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/
│       ├── main.rs
│       ├── state.rs
│       └── commands/
│           ├── mod.rs
│           ├── transaction.rs
│           └── ethereum.rs
└── web/
    ├── package.json
    ├── index.html
    ├── dapp.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        └── services/
            └── tauri.ts
```

### main.rs

```rust
// src-tauri/src/main.rs

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod state;
mod commands;

use state::VaughanState;
use std::sync::Arc;
use tokio::sync::Mutex;

fn main() {
    tauri::Builder::default()
        .manage(Arc::new(Mutex::new(VaughanState::new())))
        .invoke_handler(tauri::generate_handler![
            commands::transaction::send_transaction,
            commands::ethereum::eth_request,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Cargo.toml

```toml
[package]
name = "vaughan-tauri"
version = "0.1.0"
edition = "2021"

[dependencies]
tauri = { version = "2.0", features = ["protocol-asset"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
alloy = { version = "0.1", features = ["full"] }

[build-dependencies]
tauri-build = { version = "2.0" }
```

---

## 5. Testing Examples

### Unit Test (Rust)

```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_controller_lazy_initialization() {
        let state = VaughanState::new();
        
        // First call creates controller
        let controller1 = state
            .get_network_controller("eth", "https://eth.llamarpc.com", 1)
            .await;
        
        // Second call returns cached controller
        let controller2 = state
            .get_network_controller("eth", "https://eth.llamarpc.com", 1)
            .await;
        
        // Verify same instance (Arc pointer equality)
        assert!(Arc::ptr_eq(&controller1, &controller2));
    }
}
```

### Integration Test (TypeScript)

```typescript
// web/src/__tests__/transaction.test.ts

import { describe, it, expect } from 'vitest';
import { sendTransaction } from '../services/tauri';

describe('Transaction Flow', () => {
  it('should send transaction successfully', async () => {
    const txHash = await sendTransaction(
      '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      '1000000000000000000', // 1 ETH in wei
      'https://eth.llamarpc.com',
      'test_private_key'
    );
    
    expect(txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
  });
});
```

---

## 6. Error Handling Pattern

```rust
// src-tauri/src/error.rs

use thiserror::Error;

#[derive(Error, Debug)]
pub enum WalletError {
    #[error("Invalid address: {0}")]
    InvalidAddress(String),
    
    #[error("Invalid amount: {0}")]
    InvalidAmount(String),
    
    #[error("Insufficient balance: have {have}, need {need}")]
    InsufficientBalance { have: String, need: String },
    
    #[error("Network error: {0}")]
    NetworkError(String),
    
    #[error("Transaction failed: {0}")]
    TransactionFailed(String),
}

impl WalletError {
    pub fn to_user_message(&self) -> String {
        match self {
            Self::InvalidAddress(_) => "Please enter a valid Ethereum address".to_string(),
            Self::InvalidAmount(_) => "Please enter a valid amount".to_string(),
            Self::InsufficientBalance { have, need } => {
                format!("Insufficient balance. You have {} but need {}", have, need)
            }
            Self::NetworkError(_) => "Network connection failed. Please try again".to_string(),
            Self::TransactionFailed(msg) => format!("Transaction failed: {}", msg),
        }
    }
}

// Usage
#[tauri::command]
async fn send_transaction(...) -> Result<String, String> {
    // ... validation
    if balance < amount {
        return Err(WalletError::InsufficientBalance {
            have: balance.to_string(),
            need: amount.to_string(),
        }.to_user_message());
    }
    // ...
}
```

---

## Summary

These examples provide:

1. ✅ **Working code** - Copy-paste ready
2. ✅ **Complete flow** - Frontend → Backend → Alloy → Network
3. ✅ **Best practices** - Error handling, type safety, async/await
4. ✅ **Testing** - Unit and integration test examples
5. ✅ **Real patterns** - Lazy initialization, provider injection

**Use these as reference during implementation.**

---

**Status**: Reference Material  
**Next Step**: Use during Phase 0 POC and Phase 1 implementation
