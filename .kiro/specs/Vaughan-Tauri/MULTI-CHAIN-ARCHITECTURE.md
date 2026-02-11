# Multi-Chain Architecture

**Status**: Future-Proof Design  
**Version**: 1.0  
**Last Updated**: February 2, 2026

---

## 🎯 Overview

Vaughan wallet is designed with **multi-chain support from the ground up**, even though Phase 1 implements EVM chains only.

**Planned Chains**:
- ✅ **EVM** (Ethereum, PulseChain, etc.) - Phase 1
- 🔜 **Stellar** - Future
- 🔜 **Aptos** - Future
- 🔜 **Solana** - Future
- 🔜 **Bitcoin** - Future

**Architecture Goal**: Add new chains by implementing a trait, NOT by refactoring the entire codebase.

---

## 🏗️ Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    WALLET UI (React)                        │
│              Chain-agnostic components                      │
│  - Send/Receive forms work for ANY chain                   │
│  - Account list shows all chains                           │
│  - Transaction history unified                             │
└────────────────────┬────────────────────────────────────────┘
                     │ Tauri IPC
┌────────────────────▼────────────────────────────────────────┐
│              WALLET CORE (Rust)                             │
│  - Account management (chain-agnostic)                      │
│  - Transaction coordination                                 │
│  - Security (keychain, encryption)                          │
│  - State management                                         │
└────────────────────┬────────────────────────────────────────┘
                     │ ChainAdapter trait
        ┌────────────┼────────────┬──────────────┬────────────┐
        │            │            │              │            │
┌───────▼──────┐ ┌──▼──────┐ ┌──▼──────┐ ┌────▼─────┐ ┌────▼─────┐
│ EVM Adapter  │ │ Stellar │ │ Aptos   │ │ Solana   │ │ Bitcoin  │
│ (Alloy)      │ │ Adapter │ │ Adapter │ │ Adapter  │ │ Adapter  │
│              │ │ (SDK)   │ │ (SDK)   │ │ (SDK)    │ │ (SDK)    │
│ ✅ Phase 1   │ │ 🔜 Future│ │ 🔜 Future│ │ 🔜 Future │ │ 🔜 Future │
└──────────────┘ └─────────┘ └─────────┘ └──────────┘ └──────────┘
```

---

## 🔑 Core Design: ChainAdapter Trait

### The Trait (Chain-Agnostic Interface)

```rust
/// Universal interface for blockchain operations.
/// 
/// All chain-specific implementations (EVM, Stellar, etc.) must implement this trait.
/// This allows the wallet core to work with ANY blockchain without knowing the details.
#[async_trait]
pub trait ChainAdapter: Send + Sync {
    /// Get the balance for an address
    async fn get_balance(&self, address: &str) -> Result<Balance, ChainError>;
    
    /// Send a transaction
    async fn send_transaction(&self, tx: ChainTransaction) -> Result<TxHash, ChainError>;
    
    /// Sign a message
    async fn sign_message(&self, address: &str, message: &[u8]) -> Result<Signature, ChainError>;
    
    /// Get transaction history
    async fn get_transactions(&self, address: &str, limit: u32) -> Result<Vec<TxRecord>, ChainError>;
    
    /// Estimate transaction fee
    async fn estimate_fee(&self, tx: &ChainTransaction) -> Result<Fee, ChainError>;
    
    /// Validate an address
    fn validate_address(&self, address: &str) -> Result<(), ChainError>;
    
    /// Get chain information
    fn chain_info(&self) -> ChainInfo;
    
    /// Get chain type
    fn chain_type(&self) -> ChainType;
}

/// Chain-agnostic types
pub struct Balance {
    pub amount: String,      // Decimal string (e.g., "1.5")
    pub symbol: String,      // "ETH", "XLM", "APT", etc.
    pub decimals: u8,        // 18 for ETH, 7 for XLM, etc.
}

pub struct TxHash(pub String);

pub struct Signature(pub Vec<u8>);

pub struct Fee {
    pub amount: String,
    pub symbol: String,
}

pub enum ChainType {
    Evm(EvmChain),
    Stellar,
    Aptos,
    Solana,
    Bitcoin,
}

pub struct ChainInfo {
    pub name: String,
    pub chain_id: String,
    pub native_currency: Currency,
    pub explorer_url: Option<String>,
}
```

---

## 📦 EVM Adapter (Phase 1 - Using Alloy)

### Implementation

```rust
use alloy::primitives::{Address, U256};
use alloy::providers::{Provider, ProviderBuilder};
use alloy::signers::local::PrivateKeySigner;

/// EVM blockchain adapter using Alloy.
/// 
/// Implements ChainAdapter for all EVM-compatible chains:
/// - Ethereum
/// - PulseChain
/// - Polygon
/// - Arbitrum
/// - etc.
pub struct EvmAdapter {
    provider: Box<dyn Provider>,
    signer: Option<PrivateKeySigner>,
    chain: EvmChain,
}

impl EvmAdapter {
    pub fn new(rpc_url: &str, chain: EvmChain) -> Result<Self> {
        let provider = ProviderBuilder::new()
            .on_http(rpc_url.parse()?);
        
        Ok(Self {
            provider: Box::new(provider),
            signer: None,
            chain,
        })
    }
    
    pub fn with_signer(mut self, signer: PrivateKeySigner) -> Self {
        self.signer = Some(signer);
        self
    }
}

#[async_trait]
impl ChainAdapter for EvmAdapter {
    async fn get_balance(&self, address: &str) -> Result<Balance, ChainError> {
        // Parse address using Alloy
        let addr: Address = address.parse()
            .map_err(|_| ChainError::InvalidAddress)?;
        
        // Get balance using Alloy provider
        let balance: U256 = self.provider.get_balance(addr).await?;
        
        // Convert to chain-agnostic Balance
        Ok(Balance {
            amount: format_units(balance, 18)?,
            symbol: self.chain.native_currency().symbol.clone(),
            decimals: 18,
        })
    }
    
    async fn send_transaction(&self, tx: ChainTransaction) -> Result<TxHash, ChainError> {
        // Convert chain-agnostic transaction to EVM transaction
        let evm_tx = match tx {
            ChainTransaction::Evm(tx) => tx,
            _ => return Err(ChainError::WrongChainType),
        };
        
        // Build transaction using Alloy
        let tx_request = TransactionRequest::default()
            .to(evm_tx.to)
            .value(evm_tx.value)
            .data(evm_tx.data);
        
        // Sign and send using Alloy
        let signer = self.signer.as_ref()
            .ok_or(ChainError::NoSigner)?;
        
        let tx_hash = self.provider
            .send_transaction(tx_request)
            .await?;
        
        Ok(TxHash(format!("{:?}", tx_hash)))
    }
    
    async fn sign_message(&self, address: &str, message: &[u8]) -> Result<Signature, ChainError> {
        let signer = self.signer.as_ref()
            .ok_or(ChainError::NoSigner)?;
        
        // Sign using Alloy
        let sig = signer.sign_message(message).await?;
        
        Ok(Signature(sig.as_bytes().to_vec()))
    }
    
    fn chain_type(&self) -> ChainType {
        ChainType::Evm(self.chain.clone())
    }
    
    fn chain_info(&self) -> ChainInfo {
        ChainInfo {
            name: self.chain.name().to_string(),
            chain_id: self.chain.id().to_string(),
            native_currency: self.chain.native_currency(),
            explorer_url: self.chain.explorer_url(),
        }
    }
    
    // ... other methods
}
```

---

## 🌟 Stellar Adapter (Future)

### Implementation (Example)

```rust
use stellar_sdk::{HorizonClient, Keypair, Transaction as StellarTx};

/// Stellar blockchain adapter.
/// 
/// Implements ChainAdapter for Stellar network.
pub struct StellarAdapter {
    horizon_client: HorizonClient,
    keypair: Option<Keypair>,
}

#[async_trait]
impl ChainAdapter for StellarAdapter {
    async fn get_balance(&self, address: &str) -> Result<Balance, ChainError> {
        // Use Stellar SDK
        let account = self.horizon_client
            .load_account(address)
            .await?;
        
        let xlm_balance = account.balances
            .iter()
            .find(|b| b.asset_type == "native")
            .map(|b| b.balance.clone())
            .unwrap_or_default();
        
        Ok(Balance {
            amount: xlm_balance,
            symbol: "XLM".to_string(),
            decimals: 7,
        })
    }
    
    async fn send_transaction(&self, tx: ChainTransaction) -> Result<TxHash, ChainError> {
        let stellar_tx = match tx {
            ChainTransaction::Stellar(tx) => tx,
            _ => return Err(ChainError::WrongChainType),
        };
        
        // Build and submit using Stellar SDK
        // ...
    }
    
    fn chain_type(&self) -> ChainType {
        ChainType::Stellar
    }
    
    // ... other methods
}
```

---

## 🗂️ File Structure

```
src-tauri/src/
├── core/                           # Chain-agnostic wallet core
│   ├── mod.rs
│   ├── account.rs                  # Account management
│   ├── wallet.rs                   # Wallet coordinator
│   ├── transaction.rs              # Transaction types
│   └── security.rs                 # Security utilities
│
├── chains/                         # Chain-specific implementations
│   ├── mod.rs                      # ChainAdapter trait definition
│   ├── types.rs                    # Chain-agnostic types
│   ├── error.rs                    # ChainError type
│   │
│   ├── evm/                        # EVM adapter (Alloy)
│   │   ├── mod.rs
│   │   ├── adapter.rs              # EvmAdapter implementation
│   │   ├── transaction.rs          # EVM transaction types
│   │   ├── networks.rs             # EVM network configs
│   │   └── utils.rs                # EVM utilities
│   │
│   ├── stellar/                    # Stellar adapter (future)
│   │   ├── mod.rs
│   │   ├── adapter.rs              # StellarAdapter implementation
│   │   └── transaction.rs
│   │
│   ├── aptos/                      # Aptos adapter (future)
│   │   ├── mod.rs
│   │   └── adapter.rs
│   │
│   ├── solana/                     # Solana adapter (future)
│   │   ├── mod.rs
│   │   └── adapter.rs
│   │
│   └── bitcoin/                    # Bitcoin adapter (future)
│       ├── mod.rs
│       └── adapter.rs
│
├── commands/                       # Tauri commands (chain-agnostic)
│   ├── mod.rs
│   ├── account.rs                  # Account commands
│   ├── transaction.rs              # Transaction commands
│   └── network.rs                  # Network commands
│
├── state/                          # Application state
│   ├── mod.rs
│   └── wallet_state.rs             # Manages all adapters
│
└── main.rs                         # Tauri entry point
```

---

## 🔧 Wallet Core (Chain-Agnostic)

### WalletState

```rust
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Central wallet state that manages all chain adapters.
/// 
/// This is the single source of truth for the wallet.
/// It coordinates operations across multiple chains.
pub struct WalletState {
    /// Registered chain adapters
    adapters: HashMap<ChainType, Arc<dyn ChainAdapter>>,
    
    /// User accounts (can have addresses on multiple chains)
    accounts: Vec<Account>,
    
    /// Active chain
    active_chain: ChainType,
}

impl WalletState {
    pub fn new() -> Self {
        let mut adapters: HashMap<ChainType, Arc<dyn ChainAdapter>> = HashMap::new();
        
        // Register EVM adapter (Phase 1)
        let evm_adapter = EvmAdapter::new(
            "https://rpc.pulsechain.com",
            EvmChain::PulseChain
        ).unwrap();
        
        adapters.insert(
            ChainType::Evm(EvmChain::PulseChain),
            Arc::new(evm_adapter)
        );
        
        // Future: Register other adapters
        // adapters.insert(ChainType::Stellar, Arc::new(StellarAdapter::new()));
        
        Self {
            adapters,
            accounts: Vec::new(),
            active_chain: ChainType::Evm(EvmChain::PulseChain),
        }
    }
    
    /// Get adapter for a specific chain
    pub fn get_adapter(&self, chain: &ChainType) -> Option<Arc<dyn ChainAdapter>> {
        self.adapters.get(chain).cloned()
    }
    
    /// Get balance for an account on a specific chain
    pub async fn get_balance(&self, account_id: &Uuid, chain: &ChainType) -> Result<Balance> {
        let adapter = self.get_adapter(chain)
            .ok_or(WalletError::ChainNotSupported)?;
        
        let account = self.accounts.iter()
            .find(|a| a.id == *account_id)
            .ok_or(WalletError::AccountNotFound)?;
        
        let address = account.get_address(chain)
            .ok_or(WalletError::AddressNotFound)?;
        
        adapter.get_balance(&address).await
            .map_err(Into::into)
    }
    
    /// Send transaction on any chain
    pub async fn send_transaction(
        &self,
        account_id: &Uuid,
        chain: &ChainType,
        tx: ChainTransaction,
    ) -> Result<TxHash> {
        let adapter = self.get_adapter(chain)
            .ok_or(WalletError::ChainNotSupported)?;
        
        adapter.send_transaction(tx).await
            .map_err(Into::into)
    }
}
```

### Account (Multi-Chain)

```rust
use uuid::Uuid;

/// A user account that can have addresses on multiple chains.
/// 
/// Example: One account can have:
/// - Ethereum address: 0x1234...
/// - Stellar address: GABC...
/// - Solana address: 5Qw...
pub struct Account {
    /// Unique account ID
    pub id: Uuid,
    
    /// User-friendly name
    pub name: String,
    
    /// Account type (seed-based, keystore, hardware)
    pub account_type: AccountType,
    
    /// Addresses on different chains
    pub chains: HashMap<ChainType, ChainAccount>,
}

impl Account {
    /// Get address for a specific chain
    pub fn get_address(&self, chain: &ChainType) -> Option<String> {
        self.chains.get(chain).map(|ca| ca.address.clone())
    }
    
    /// Add a new chain to this account
    pub fn add_chain(&mut self, chain: ChainType, address: String, derivation_path: Option<String>) {
        self.chains.insert(chain, ChainAccount {
            chain_type: chain,
            address,
            derivation_path,
        });
    }
}

/// Account information for a specific chain
pub struct ChainAccount {
    pub chain_type: ChainType,
    pub address: String,
    pub derivation_path: Option<String>,
}

pub enum AccountType {
    SeedBased { derivation_index: u32 },
    Keystore { keystore_path: String },
    Hardware { device_id: String },
}
```

---

## 🎨 UI Layer (Chain-Agnostic)

### Send Transaction Component

```typescript
// web/src/components/SendTransaction.tsx

interface SendTransactionProps {
  accountId: string;
  chain: ChainType;
}

export function SendTransaction({ accountId, chain }: SendTransactionProps) {
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  
  const handleSend = async () => {
    // UI doesn't know about Alloy, Stellar SDK, etc.
    // It just calls a generic command
    const txHash = await invoke('send_transaction', {
      accountId,
      chain,
      to,
      amount,
    });
    
    console.log('Transaction sent:', txHash);
  };
  
  return (
    <div>
      <input 
        placeholder={`Recipient ${chain} address`}
        value={to}
        onChange={(e) => setTo(e.target.value)}
      />
      <input 
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <button onClick={handleSend}>Send</button>
    </div>
  );
}
```

### Account List (Shows All Chains)

```typescript
// web/src/components/AccountList.tsx

export function AccountList() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  
  useEffect(() => {
    invoke<Account[]>('get_accounts').then(setAccounts);
  }, []);
  
  return (
    <div>
      {accounts.map(account => (
        <div key={account.id}>
          <h3>{account.name}</h3>
          
          {/* Show balances for all chains */}
          {Object.entries(account.chains).map(([chain, chainAccount]) => (
            <div key={chain}>
              <span>{chain}:</span>
              <span>{chainAccount.address}</span>
              <Balance accountId={account.id} chain={chain} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

---

## 🔌 dApp Integration (Multi-Chain)

### Multiple Provider APIs

```javascript
// web/provider.js

// EVM chains (EIP-1193)
window.ethereum = {
  isMetaMask: true,
  request: async (args) => {
    return window.__TAURI__.core.invoke('ethereum_request', args);
  },
  // ... rest of EIP-1193
};

// Stellar (Freighter API)
window.stellar = {
  isConnected: async () => {
    return window.__TAURI__.core.invoke('stellar_is_connected');
  },
  getPublicKey: async () => {
    return window.__TAURI__.core.invoke('stellar_get_public_key');
  },
  signTransaction: async (xdr) => {
    return window.__TAURI__.core.invoke('stellar_sign_transaction', { xdr });
  },
};

// Solana (Phantom API)
window.solana = {
  isPhantom: true,
  connect: async () => {
    return window.__TAURI__.core.invoke('solana_connect');
  },
  signTransaction: async (transaction) => {
    return window.__TAURI__.core.invoke('solana_sign_transaction', { transaction });
  },
};

// Aptos (Petra API)
window.aptos = {
  connect: async () => {
    return window.__TAURI__.core.invoke('aptos_connect');
  },
  account: async () => {
    return window.__TAURI__.core.invoke('aptos_get_account');
  },
  signAndSubmitTransaction: async (transaction) => {
    return window.__TAURI__.core.invoke('aptos_sign_and_submit', { transaction });
  },
};
```

---

## 📋 Cargo.toml (Feature Flags)

```toml
[package]
name = "vaughan-tauri"
version = "2.0.0"
edition = "2021"

[features]
default = ["evm"]

# Chain support (enable/disable per chain)
evm = ["alloy"]
stellar = ["stellar-sdk"]
aptos = ["aptos-sdk"]
solana = ["solana-sdk"]
bitcoin = ["bitcoin"]

# Convenience feature for all chains
all-chains = ["evm", "stellar", "aptos", "solana", "bitcoin"]

[dependencies]
# Core dependencies (always included)
tauri = "2.0"
serde = { version = "1.0", features = ["derive"] }
tokio = { version = "1", features = ["full"] }
async-trait = "0.1"
uuid = { version = "1.0", features = ["v4", "serde"] }

# Chain-specific dependencies (optional)
alloy = { version = "0.1", optional = true }
stellar-sdk = { version = "0.1", optional = true }
aptos-sdk = { version = "0.1", optional = true }
solana-sdk = { version = "1.0", optional = true }
bitcoin = { version = "0.30", optional = true }

# Security (always included)
keyring = "2.0"
aes-gcm = "0.10"
argon2 = "0.5"
```

---

## 🚀 Implementation Strategy

### Phase 1: EVM with Multi-Chain Architecture (Week 1-4)

**Goal**: Build EVM support using Alloy, but with multi-chain architecture in place.

**Tasks**:
1. Define `ChainAdapter` trait
2. Define chain-agnostic types (`Balance`, `TxHash`, etc.)
3. Implement `EvmAdapter` using Alloy
4. Build `WalletState` with adapter registry
5. Build UI that works with any chain
6. Test with EVM chains only

**Result**: Working EVM wallet with multi-chain foundation.

### Phase 2-4: Same as Original Plan

Build UI, dApp integration, testing (but chain-agnostic).

### Phase 5: Add Stellar (Future - Week 1-2)

**Goal**: Add Stellar support without refactoring.

**Tasks**:
1. Implement `StellarAdapter` (implement `ChainAdapter` trait)
2. Register adapter in `WalletState`
3. Add Stellar provider API (`window.stellar`)
4. Test with Stellar dApps

**Result**: Wallet now supports EVM + Stellar.

### Phase 6+: Add Other Chains (Future)

Same process: implement trait, register adapter, add provider API.

---

## ✅ Benefits of This Architecture

### 1. **Future-Proof**
- Add new chains without refactoring
- Just implement the trait

### 2. **Clean Separation**
- Chain-specific code isolated in adapters
- Wallet core is chain-agnostic
- UI doesn't know about chains

### 3. **Testable**
- Mock adapters for testing
- Test wallet core without real chains
- Test each adapter independently

### 4. **Maintainable**
- Each chain in its own module
- Clear boundaries
- Easy to understand

### 5. **Professional**
- Industry-standard design pattern
- Scalable architecture
- Easy for contributors

---

## 🎯 Key Principles

### 1. **Trait-Based Design**
All chains implement `ChainAdapter` trait.

### 2. **Dependency Injection**
`WalletState` manages adapters, doesn't know their types.

### 3. **Chain-Agnostic Core**
Wallet logic works with ANY chain.

### 4. **Chain-Specific Adapters**
Each chain uses its best library (Alloy for EVM, etc.).

### 5. **Feature Flags**
Enable/disable chains at compile time.

---

## 📚 References

- **EVM**: Alloy libraries (https://github.com/alloy-rs/alloy)
- **Stellar**: Stellar SDK (https://github.com/stellar/stellar-sdk)
- **Aptos**: Aptos SDK (https://github.com/aptos-labs/aptos-core)
- **Solana**: Solana SDK (https://github.com/solana-labs/solana)
- **Bitcoin**: Rust Bitcoin (https://github.com/rust-bitcoin/rust-bitcoin)

---

## 🎉 Summary

**Phase 1**: Build EVM with multi-chain architecture (Alloy + trait design)  
**Future**: Add chains by implementing trait (no refactoring needed)  
**Result**: Professional, scalable, future-proof wallet

**This architecture allows you to add Stellar, Aptos, Solana, and Bitcoin later without touching the wallet core!**
