//! Application State Management
//!
//! This module defines the central application state (VaughanState) that manages
//! all controllers, adapters, and application state.
//!
//! ## Architecture
//!
//! VaughanState follows a layered controller lifecycle:
//!
//! 1. **Provider-Independent Controllers** (always available):
//!    - WalletController: Account management, signing
//!    - PriceController: Token price caching
//!
//! 2. **Provider-Dependent Adapters** (per-network, cached):
//!    - EvmAdapter: One per network, created on-demand
//!
//! 3. **Application State**:
//!    - Active network, active account, wallet locked state
//!
//! 4. **dApp State**:
//!    - Connected dApps, pending approval requests
//!
//! ## Lazy Initialization
//!
//! Network adapters are created on-demand when switching networks and cached
//! for reuse. This avoids creating providers for networks that are never used.
//!
//! ## Thread Safety
//!
//! All mutable state is protected by `Mutex`. Controllers are shared via `Arc`.
//! Tauri automatically wraps the entire state in `Arc`, so we don't need to
//! wrap the top-level struct.
//!
//! ## Example
//!
//! ```rust,ignore
//! use vaughan_lib::state::VaughanState;
//!
//! # async fn example() -> Result<(), Box<dyn std::error::Error>> {
//! // Initialize state on app startup
//! let state = VaughanState::new().await?;
//!
//! // Switch to a network (creates adapter if needed)
//! state.switch_network("ethereum-mainnet").await?;
//!
//! // Get current adapter
//! let adapter = state.current_adapter().await?;
//! # Ok(())
//! # }
//! ```

use crate::models::token::TrackedToken;

use crate::chains::evm::EvmAdapter;
use crate::chains::NetworkId;
use crate::core::persistence::StateManager;
use crate::dapp::{ApprovalQueue, RateLimiter, SessionManager, WindowRegistry};
use crate::error::WalletError;
use crate::core::{NetworkService, PriceService, TransactionService, WalletService};
use alloy::primitives::Address;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct VaughanState {
    // ===== PROVIDER-INDEPENDENT SERVICES (Always Available) =====
    /// Transaction service (stateless, always available)
    pub transaction_service: TransactionService,

    /// Network service (stateless, always available)
    pub network_service: NetworkService,

    /// Price service (stateless, always available)
    pub price_service: PriceService,

    /// Wallet service (manages accounts, HD wallet, keyring)
    pub wallet_service: WalletService,

    // ===== PROVIDER-DEPENDENT ADAPTERS (Per-Network, Cached) =====
    /// EVM adapters cached by network ID
    /// Created on-demand when switching networks
    evm_adapters: Mutex<HashMap<NetworkId, Arc<EvmAdapter>>>,

    // ===== APPLICATION STATE =====
    /// Currently active network
    active_network: Mutex<Option<NetworkId>>,

    /// Currently active account address
    active_account: Mutex<Option<Address>>,

    // ===== DAPP STATE =====
    /// Session manager for dApp connections
    pub session_manager: SessionManager,

    /// Rate limiter for dApp requests
    pub rate_limiter: RateLimiter,

    /// Approval queue for user approvals
    pub approval_queue: ApprovalQueue,

    /// Window registry for tracking dApp windows
    pub window_registry: WindowRegistry,

    /// Performance profiler for RPC requests
    pub profiler: crate::dapp::Profiler,

    /// Sound player service
    pub sound_player: crate::audio::SoundPlayer,

    /// User-tracked custom tokens (grouped by Chain ID)
    pub tracked_tokens: Mutex<HashMap<u64, Vec<TrackedToken>>>,

    /// State persistence manager
    state_manager: StateManager,
}

impl VaughanState {
    pub async fn new() -> Result<Self, WalletError> {
        println!("[VaughanState] Initializing...");
        let state_manager = StateManager::new()?;
        let persisted = state_manager.load();
        println!("[VaughanState] State loaded (version: {})", persisted.version);

        // Restore active account from persisted state
        let active_account = persisted
            .active_account
            .as_ref()
            .and_then(|addr| addr.parse::<Address>().ok());

        // Group tracked tokens by chain ID
        let mut tracked_tokens_map: HashMap<u64, Vec<TrackedToken>> = HashMap::new();
        for token in persisted.tracked_tokens {
            tracked_tokens_map
                .entry(token.chain_id)
                .or_default()
                .push(token);
        }

        let state = Self {
            // Provider-independent services (always available)
            transaction_service: TransactionService::new(),
            network_service: NetworkService::new(),
            price_service: PriceService::new(),
            wallet_service: WalletService::new()?,

            // Provider-dependent adapters (empty, created on-demand)
            evm_adapters: Mutex::new(HashMap::new()),

            // Application state (restored from persisted state)
            active_network: Mutex::new(None),
            active_account: Mutex::new(active_account),
            tracked_tokens: Mutex::new(tracked_tokens_map),

            // dApp services
            session_manager: SessionManager::new(),
            rate_limiter: RateLimiter::new(),
            approval_queue: ApprovalQueue::new(),
            window_registry: WindowRegistry::new(),
            profiler: crate::dapp::Profiler::new(1000),

            // Audio service
            sound_player: crate::audio::SoundPlayer::new(crate::audio::SoundConfig::default()),

            // State persistence
            state_manager,
        };

        // Restore active network from persisted state (or fall back to default)
        let network_id = persisted
            .active_network_id
            .unwrap_or_else(|| "pulsechain-testnet-v4".to_string());
        let rpc_url = persisted
            .active_network_rpc
            .unwrap_or_else(|| "https://rpc.v4.testnet.pulsechain.com".to_string());
        let chain_id = persisted.active_network_chain_id.unwrap_or(943);

        println!("[VaughanState] Switching to initial network: {}", network_id);
        state
            .switch_network(&network_id, &rpc_url, chain_id)
            .await?;
        println!("[VaughanState] Initialization complete.");

        Ok(state)
    }

    // ========================================================================
    // Network Management
    // ========================================================================

    /// Switch to a network (creates adapter if needed)
    ///
    /// This implements lazy initialization:
    /// - If adapter exists for network: Use cached adapter
    /// - If adapter doesn't exist: Create new adapter and cache it
    ///
    /// # Arguments
    ///
    /// * `network_id` - Network identifier (e.g., "ethereum-mainnet")
    /// * `rpc_url` - RPC endpoint URL
    /// * `chain_id` - Chain ID (for EVM chains)
    ///
    /// # Returns
    ///
    /// * `Ok(())` - Network switched successfully
    /// * `Err(WalletError)` - Failed to create adapter or switch network
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use vaughan_lib::state::VaughanState;
    /// # async fn example(state: &VaughanState) -> Result<(), Box<dyn std::error::Error>> {
    /// state.switch_network(
    ///     "ethereum-mainnet",
    ///     "https://eth.llamarpc.com",
    ///     1
    /// ).await?;
    /// # Ok(())
    /// # }
    /// ```
    pub async fn switch_network(
        &self,
        network_id: &str,
        rpc_url: &str,
        chain_id: u64,
    ) -> Result<(), WalletError> {
        println!("[VaughanState] switch_network: {}", network_id);
        // Get or create EVM adapter
        let mut adapters = self.evm_adapters.lock().await;

        if !adapters.contains_key(network_id) {
            // Create new adapter
            let adapter = EvmAdapter::new(rpc_url, network_id.to_string(), chain_id).await?;
            adapters.insert(network_id.to_string(), Arc::new(adapter));
        }
        drop(adapters); // Explicitly drop lock prevents deadlock in save_state()

        // Update active network
        let mut active_network = self.active_network.lock().await;
        *active_network = Some(network_id.to_string());
        drop(active_network);

        // Auto-save state
        println!("[VaughanState] Auto-saving state (network switch)...");
        let _ = self.save_state().await;
        println!("[VaughanState] State saved (network switch).");

        Ok(())
    }

    pub async fn set_active_chain(&self, chain_id: u64) -> Result<(), WalletError> {
        let config = crate::chains::evm::networks::get_network_by_chain_id(chain_id)
            .ok_or(WalletError::UnsupportedNetwork(format!(
                "Chain ID {} not supported",
                chain_id
            )))?;
        self.switch_network(&config.id, &config.rpc_url, config.chain_id)
            .await
    }

    /// Get current network adapter
    ///
    /// Returns the adapter for the currently active network.
    ///
    /// # Returns
    ///
    /// * `Ok(Arc<EvmAdapter>)` - Current adapter
    /// * `Err(WalletError::NetworkNotInitialized)` - No network selected
    ///
    /// # Example
    ///
    /// ```rust,ignore
    /// # use vaughan_lib::state::VaughanState;
    /// # async fn example(state: &VaughanState) -> Result<(), Box<dyn std::error::Error>> {
    /// let adapter = state.current_adapter().await?;
    /// let balance = adapter.get_balance("0x...").await?;
    /// # Ok(())
    /// # }
    /// ```
    pub async fn current_adapter(&self) -> Result<Arc<EvmAdapter>, WalletError> {
        let active_network = self.active_network.lock().await;
        let network_id = active_network
            .as_ref()
            .ok_or(WalletError::NetworkNotInitialized)?;

        let adapters = self.evm_adapters.lock().await;
        adapters
            .get(network_id)
            .cloned()
            .ok_or(WalletError::NetworkNotInitialized)
    }

    /// Get current network ID
    ///
    /// # Returns
    ///
    /// * `Ok(String)` - Current network ID
    /// * `Err(WalletError::NetworkNotInitialized)` - No network selected
    pub async fn current_network_id(&self) -> Result<String, WalletError> {
        self.active_network
            .lock()
            .await
            .clone()
            .ok_or(WalletError::NetworkNotInitialized)
    }

    /// Clear adapter cache for a network
    ///
    /// Use this when RPC URL changes or adapter needs to be recreated.
    ///
    /// # Arguments
    ///
    /// * `network_id` - Network identifier
    pub async fn clear_adapter_cache(&self, network_id: &str) {
        self.evm_adapters.lock().await.remove(network_id);
    }

    /// Clear all adapter caches
    ///
    /// Use this for testing or when resetting the application.
    pub async fn clear_all_caches(&self) {
        self.evm_adapters.lock().await.clear();
    }

    // ========================================================================
    // Account Management
    // ========================================================================

    /// Set active account
    ///
    /// # Arguments
    ///
    /// * `address` - Account address
    pub async fn set_active_account(&self, address: Address) {
        let mut active_account = self.active_account.lock().await;
        *active_account = Some(address);
        drop(active_account);

        // Auto-save state
        let _ = self.save_state().await;
    }

    /// Get active account
    ///
    /// # Returns
    ///
    /// * `Ok(Address)` - Active account address
    /// * `Err(WalletError::NoActiveAccount)` - No account selected
    pub async fn active_account(&self) -> Result<Address, WalletError> {
        self.active_account
            .lock()
            .await
            .ok_or(WalletError::NoActiveAccount)
    }

    // ========================================================================
    // Wallet Lock State (Delegated to WalletService)
    // ========================================================================

    /// Lock the wallet
    pub async fn lock_wallet(&self) {
        self.wallet_service.lock().await;
    }

    /// Unlock the wallet with password
    ///
    /// # Arguments
    ///
    /// * `password` - Wallet password
    ///
    /// # Returns
    ///
    /// * `Ok(())` - Wallet unlocked successfully
    /// * `Err(WalletError)` - Invalid password or other error
    pub async fn unlock_wallet(&self, password: &str) -> Result<(), WalletError> {
        self.wallet_service.unlock(password).await
    }

    /// Check if wallet is locked
    ///
    /// # Returns
    ///
    /// * `true` - Wallet is locked
    /// * `false` - Wallet is unlocked
    pub async fn is_locked(&self) -> bool {
        self.wallet_service.is_locked().await
    }

    // ========================================================================
    // State Persistence
    // ========================================================================

    /// Save current state to disk
    ///
    /// Called automatically on network/account changes.
    /// Silently ignores errors (non-critical operation).
    async fn save_state(&self) -> Result<(), WalletError> {
        println!("[VaughanState] save_state: Acquiring locks...");
        let active_network = self.active_network.lock().await;
        println!("[VaughanState] save_state: Acquired active_network lock");
        let active_account = self.active_account.lock().await;
        println!("[VaughanState] save_state: Acquired active_account lock");
        let tracked_tokens_map = self.tracked_tokens.lock().await;

        // Look up RPC URL and chain ID from the active adapter
        let (rpc_url, chain_id) = if let Some(ref net_id) = *active_network {
            let adapters = self.evm_adapters.lock().await;
            if let Some(adapter) = adapters.get(net_id) {
                (
                    Some(adapter.rpc_url().to_string()),
                    Some(adapter.chain_id()),
                )
            } else {
                (None, None)
            }
        } else {
            (None, None)
        };

        // Load existing state to preserve other fields (preferences, custom_networks)
        // If load fails (e.g. file deleted), start with default
        let mut state = self.state_manager.load();

        // Update with current in-memory values
        state.active_network_id = active_network.clone();
        state.active_network_rpc = rpc_url;
        state.active_network_chain_id = chain_id;
        state.active_account = active_account.map(|addr| format!("{:?}", addr));
        
        // Flatten tracked tokens map to vector
        state.tracked_tokens = tracked_tokens_map.values().flat_map(|v| v.clone()).collect::<Vec<TrackedToken>>();

        let result = self.state_manager.save(&state);
        println!("[VaughanState] save_state: Save complete (success: {})", result.is_ok());
        result
    }

    /// Get reference to the state manager (for commands)
    pub fn state_manager(&self) -> &StateManager {
        &self.state_manager
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_cold_start() {
        let state = VaughanState::new().await.unwrap();

        // Services should be available (they're stateless)
        // Just verify the state was created successfully

        // Should have 1 adapter (PulseChain Testnet V4 initialized by default)
        assert_eq!(state.evm_adapters.lock().await.len(), 1);

        // Should have active network (PulseChain Testnet V4)
        assert!(state.active_network.lock().await.is_some());
        assert_eq!(
            state.active_network.lock().await.as_ref().unwrap(),
            "pulsechain-testnet-v4"
        );

        // No active account
        assert!(state.active_account.lock().await.is_none());

        // Wallet should be locked
        assert!(state.is_locked().await);
    }

    #[tokio::test]
    async fn test_wallet_lock_unlock() {
        let state = VaughanState::new().await.unwrap();

        // Cleanup from previous runs
        let _ = state.wallet_service.keyring.delete_key("seed");

        // Should start locked
        assert!(state.is_locked().await);

        // Create wallet first
        let _mnemonic = state
            .wallet_service
            .create_wallet("test_password", 12)
            .await
            .unwrap();

        // Unlock with password
        state.unlock_wallet("test_password").await.unwrap();
        assert!(!state.is_locked().await);

        // Lock again
        state.lock_wallet().await;
        assert!(state.is_locked().await);

        // Cleanup
        if let Ok(accounts) = state.wallet_service.get_accounts().await {
            for account in accounts {
                let _ = state.wallet_service.keyring.delete_key(&format!("account_{}", account.address));
            }
        }
        let _ = state.wallet_service.keyring.delete_key("seed");
    }

    #[tokio::test]
    async fn test_account_management() {
        let state = VaughanState::new().await.unwrap();

        // No active account initially
        assert!(state.active_account().await.is_err());

        // Set active account
        let addr = Address::ZERO;
        state.set_active_account(addr).await;

        // Should return the account
        assert_eq!(state.active_account().await.unwrap(), addr);
    }


}
