# Controller Lifecycle & Provider Management

**Status**: Architecture Design  
**Version**: 1.0  
**Last Updated**: February 3, 2026

---

## 🎯 Overview

This document defines how controllers are initialized, how providers are managed, and how network switching works in the Tauri architecture.

**Key Challenge**: Alloy providers are NOT `Clone`, which blocked Iced. Tauri solves this with `Arc<Mutex<VaughanState>>`.

---

## 🏗️ Architecture

### State Structure

```rust
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use alloy::providers::{Provider, ProviderBuilder};
use alloy::primitives::Address;

/// Central application state
pub struct VaughanState {
    // ===== PROVIDER-INDEPENDENT (Always Available) =====
    /// Wallet operations (account management, signing)
    pub wallet_controller: Arc<WalletController>,
    
    /// Token price caching and fetching
    pub price_controller: Arc<PriceController>,
    
    // ===== PROVIDER-DEPENDENT (Per-Network) =====
    /// Network controllers (one per network, cached)
    /// Key: NetworkId (e.g., "ethereum-mainnet", "pulsechain-mainnet")
    pub network_controllers: HashMap<NetworkId, Arc<NetworkController>>,
    
    /// Transaction controllers (one per network, cached)
    /// Key: NetworkId
    pub transaction_controllers: HashMap<NetworkId, Arc<TransactionController>>,
    
    // ===== APPLICATION STATE =====
    /// Currently active network
    pub active_network: NetworkId,
    
    /// Currently active account
    pub active_account: Option<Address>,
    
    /// Wallet locked state
    pub wallet_locked: bool,
    
    // ===== DAPP STATE =====
    /// Connected dApps
    pub connected_dapps: HashMap<String, DappConnection>,
    
    /// Pending approval requests
    pub pending_approvals: VecDeque<ApprovalRequest>,
}
```

---

## 🔄 Initialization Flow

### Cold Start (No Network Selected)

```rust
impl VaughanState {
    /// Initialize state on app startup
    pub fn new() -> Result<Self> {
        // 1. Initialize provider-independent controllers
        let wallet_controller = Arc::new(WalletController::new()?);
        let price_controller = Arc::new(PriceController::new()?);
        
        // 2. Load saved state (last active network, accounts, etc.)
        let saved_state = StateManager::load()?;
        
        // 3. Create empty controller maps (will be populated on-demand)
        let network_controllers = HashMap::new();
        let transaction_controllers = HashMap::new();
        
        Ok(Self {
            wallet_controller,
            price_controller,
            network_controllers,
            transaction_controllers,
            active_network: saved_state.last_network,
            active_account: saved_state.last_account,
            wallet_locked: true,
            connected_dapps: HashMap::new(),
            pending_approvals: VecDeque::new(),
        })
    }
}
```

### Network Selection (Lazy Initialization)

```rust
impl VaughanState {
    /// Switch to a network (creates controllers if needed)
    pub async fn switch_network(&mut self, network_id: NetworkId) -> Result<()> {
        // 1. Get or create network controller
        if !self.network_controllers.contains_key(&network_id) {
            let network_config = NetworkConfig::get(&network_id)?;
            let network_ctrl = Arc::new(
                NetworkController::new(
                    network_config.rpc_url,
                    network_config.chain_id
                )?
            );
            self.network_controllers.insert(network_id.clone(), network_ctrl);
        }
        
        // 2. Get or create transaction controller
        if !self.transaction_controllers.contains_key(&network_id) {
            let network_ctrl = self.network_controllers.get(&network_id).unwrap();
            let tx_ctrl = Arc::new(
                TransactionController::new(network_ctrl.provider())?
            );
            self.transaction_controllers.insert(network_id.clone(), tx_ctrl);
        }
        
        // 3. Update active network
        self.active_network = network_id;
        
        // 4. Emit network changed event
        self.emit_event(Event::NetworkChanged { network_id })?;
        
        Ok(())
    }
    
    /// Get current network controller (must be initialized)
    pub fn current_network_controller(&self) -> Result<Arc<NetworkController>> {
        self.network_controllers
            .get(&self.active_network)
            .cloned()
            .ok_or(WalletError::NetworkNotInitialized)
    }
    
    /// Get current transaction controller (must be initialized)
    pub fn current_transaction_controller(&self) -> Result<Arc<TransactionController>> {
        self.transaction_controllers
            .get(&self.active_network)
            .cloned()
            .ok_or(WalletError::NetworkNotInitialized)
    }
}
```

---

## 🔌 Provider Sharing Strategy

### Option 1: Controller Owns Provider (RECOMMENDED)

```rust
/// Network controller owns the provider
pub struct NetworkController {
    provider: Arc<dyn Provider>,
    chain_id: u64,
    network_id: NetworkId,
}

impl NetworkController {
    pub fn new(rpc_url: String, chain_id: u64) -> Result<Self> {
        let provider = ProviderBuilder::new()
            .on_http(rpc_url.parse()?);
        
        Ok(Self {
            provider: Arc::new(provider),
            chain_id,
            network_id: NetworkId::from_chain_id(chain_id),
        })
    }
    
    /// Get shared reference to provider
    pub fn provider(&self) -> Arc<dyn Provider> {
        self.provider.clone()
    }
}

/// Transaction controller shares provider via Arc
pub struct TransactionController {
    provider: Arc<dyn Provider>,
    chain_id: u64,
}

impl TransactionController {
    pub fn new(provider: Arc<dyn Provider>) -> Result<Self> {
        let chain_id = provider.get_chain_id().await?;
        
        Ok(Self {
            provider,
            chain_id,
        })
    }
}
```

**Pros**:
- ✅ Simple ownership model
- ✅ Thread-safe (Arc)
- ✅ No lifetime issues
- ✅ Easy to test

**Cons**:
- ⚠️ Slight memory overhead (Arc)

---

## 📋 Command Examples

### Send Transaction Command

```rust
#[tauri::command]
async fn send_transaction(
    window: tauri::Window,
    state: State<'_, Arc<Mutex<VaughanState>>>,
    to: String,
    amount: String,
    gas_limit: Option<u64>,
) -> Result<String, String> {
    // 1. Verify origin (security)
    if window.label() != "main" {
        return Err("Unauthorized".to_string());
    }
    
    // 2. Lock state
    let app_state = state.lock().await;
    
    // 3. Check wallet is unlocked
    if app_state.wallet_locked {
        return Err("Wallet is locked".to_string());
    }
    
    // 4. Get current controllers (will fail if network not initialized)
    let tx_controller = app_state.current_transaction_controller()
        .map_err(|e| e.to_string())?;
    let network_controller = app_state.current_network_controller()
        .map_err(|e| e.to_string())?;
    
    // 5. Parse inputs
    let to_addr = Address::from_str(&to)
        .map_err(|e| format!("Invalid address: {}", e))?;
    let amount_u256 = parse_amount(&amount, 18)?;
    
    // 6. Get current balance
    let balance = network_controller.get_balance(
        app_state.active_account.ok_or("No active account")?
    ).await?;
    
    // 7. Validate transaction
    tx_controller.validate_transaction(
        to_addr,
        amount_u256,
        gas_limit.unwrap_or(21000),
        balance
    )?;
    
    // 8. Sign and send
    let tx_hash = tx_controller.send_transaction(
        &app_state.wallet_controller,
        to_addr,
        amount_u256,
        gas_limit
    ).await?;
    
    Ok(format!("{:?}", tx_hash))
}
```

### Switch Network Command

```rust
#[tauri::command]
async fn switch_network(
    state: State<'_, Arc<Mutex<VaughanState>>>,
    network_id: String,
) -> Result<(), String> {
    let mut app_state = state.lock().await;
    
    // Switch network (creates controllers if needed)
    app_state.switch_network(NetworkId::from(network_id))
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(())
}
```

---

## 🔄 Network Switching Flow

```
User clicks "Switch to Ethereum"
  ↓
Frontend calls: invoke('switch_network', {networkId: 'ethereum-mainnet'})
  ↓
Tauri command locks state
  ↓
Check if NetworkController exists for 'ethereum-mainnet'
  ├─ YES: Use existing controller
  └─ NO: Create new NetworkController
          ├─ Initialize Alloy provider with RPC URL
          ├─ Store in network_controllers HashMap
          └─ Create TransactionController with this provider
  ↓
Update active_network = 'ethereum-mainnet'
  ↓
Emit 'networkChanged' event
  ↓
Frontend updates UI (balance, tokens, etc.)
  ↓
dApps receive 'chainChanged' event
```

---

## 💾 Controller Caching Strategy

### Why Cache Controllers?

1. **Performance**: Avoid re-creating providers on every network switch
2. **Connection Pooling**: Reuse HTTP connections
3. **State Preservation**: Keep network-specific state

### Cache Invalidation

```rust
impl VaughanState {
    /// Clear controller cache (e.g., on RPC URL change)
    pub fn clear_controller_cache(&mut self, network_id: &NetworkId) {
        self.network_controllers.remove(network_id);
        self.transaction_controllers.remove(network_id);
    }
    
    /// Clear all controller caches
    pub fn clear_all_caches(&mut self) {
        self.network_controllers.clear();
        self.transaction_controllers.clear();
    }
}
```

---

## 🧪 Testing Strategy

### Unit Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_cold_start() {
        let state = VaughanState::new().unwrap();
        
        // Provider-independent controllers should be available
        assert!(state.wallet_controller.is_some());
        assert!(state.price_controller.is_some());
        
        // Provider-dependent controllers should be empty
        assert!(state.network_controllers.is_empty());
        assert!(state.transaction_controllers.is_empty());
    }
    
    #[tokio::test]
    async fn test_network_switch() {
        let mut state = VaughanState::new().unwrap();
        
        // Switch to Ethereum
        state.switch_network(NetworkId::EthereumMainnet).await.unwrap();
        
        // Controllers should be created
        assert!(state.network_controllers.contains_key(&NetworkId::EthereumMainnet));
        assert!(state.transaction_controllers.contains_key(&NetworkId::EthereumMainnet));
        
        // Active network should be updated
        assert_eq!(state.active_network, NetworkId::EthereumMainnet);
    }
    
    #[tokio::test]
    async fn test_controller_caching() {
        let mut state = VaughanState::new().unwrap();
        
        // Switch to Ethereum
        state.switch_network(NetworkId::EthereumMainnet).await.unwrap();
        let ctrl1 = state.current_network_controller().unwrap();
        
        // Switch to PulseChain
        state.switch_network(NetworkId::PulseChainMainnet).await.unwrap();
        
        // Switch back to Ethereum
        state.switch_network(NetworkId::EthereumMainnet).await.unwrap();
        let ctrl2 = state.current_network_controller().unwrap();
        
        // Should be the same controller (cached)
        assert!(Arc::ptr_eq(&ctrl1, &ctrl2));
    }
}
```

---

## 📝 Summary

### Key Decisions

1. **Provider Ownership**: Controllers own providers via `Arc<dyn Provider>`
2. **Lazy Initialization**: Controllers created on first network switch
3. **Caching**: Controllers cached per network for performance
4. **Thread Safety**: All shared via `Arc<Mutex<VaughanState>>`

### Benefits

- ✅ No lifetime issues
- ✅ Thread-safe
- ✅ Performant (caching)
- ✅ Simple to understand
- ✅ Easy to test

### Implementation Checklist

- [ ] Define `VaughanState` struct
- [ ] Implement `new()` for cold start
- [ ] Implement `switch_network()` with lazy initialization
- [ ] Implement `current_network_controller()` helper
- [ ] Implement `current_transaction_controller()` helper
- [ ] Add controller caching
- [ ] Add cache invalidation
- [ ] Write unit tests
- [ ] Document in code comments
