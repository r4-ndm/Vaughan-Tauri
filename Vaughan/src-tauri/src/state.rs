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
//! ```rust,no_run
//! use vaughan::state::VaughanState;
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

use crate::chains::evm::EvmAdapter;
use crate::core::{NetworkService, PriceService, TransactionService, WalletService};
use crate::dapp::{ApprovalQueue, RateLimiter, SessionManager, WindowRegistry};
use crate::error::WalletError;
use alloy::primitives::Address;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

/// Network identifier (e.g., "ethereum-mainnet", "pulsechain-mainnet")
pub type NetworkId = String;

/// dApp origin (e.g., "https://app.uniswap.org")
pub type DappOrigin = String;

/// Central application state
///
/// This struct manages all controllers, adapters, and application state.
/// It follows the controller lifecycle design from `controller-lifecycle.md`.
///
/// # Thread Safety
///
/// All mutable fields are protected by `Mutex`. Controllers are shared via `Arc`.
/// Tauri automatically wraps this struct in `Arc<VaughanState>`.
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
}

impl VaughanState {
    /// Initialize application state on startup
    ///
    /// This performs "cold start" initialization:
    /// 1. Creates provider-independent services
    /// 2. Initializes empty adapter caches
    /// 3. Sets default application state
    /// 4. Loads saved state (TODO: Phase 1.6)
    ///
    /// # Returns
    ///
    /// * `Ok(VaughanState)` - Initialized state
    /// * `Err(WalletError)` - Initialization failed
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use vaughan::state::VaughanState;
    /// # async fn example() -> Result<(), Box<dyn std::error::Error>> {
    /// let state = VaughanState::new().await?;
    /// # Ok(())
    /// # }
    /// ```
    pub async fn new() -> Result<Self, WalletError> {
        let state = Self {
            // Provider-independent services (always available)
            transaction_service: TransactionService::new(),
            network_service: NetworkService::new(),
            price_service: PriceService::new(),
            wallet_service: WalletService::new()?,

            // Provider-dependent adapters (empty, created on-demand)
            evm_adapters: Mutex::new(HashMap::new()),

            // Application state (defaults)
            active_network: Mutex::new(None),
            active_account: Mutex::new(None),

            // dApp services
            session_manager: SessionManager::new(),
            rate_limiter: RateLimiter::new(10.0, 1.0), // 10 burst, 1/sec refill
            approval_queue: ApprovalQueue::new(),
            window_registry: WindowRegistry::new(),
        };

        // Initialize with default network (PulseChain Testnet V4)
        state
            .switch_network(
                "pulsechain-testnet-v4",
                "https://rpc.v4.testnet.pulsechain.com",
                943, // PulseChain Testnet V4 Chain ID
            )
            .await?;

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
    /// # use vaughan::state::VaughanState;
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
        // Get or create EVM adapter
        let mut adapters = self.evm_adapters.lock().await;

        if !adapters.contains_key(network_id) {
            // Create new adapter
            let adapter = EvmAdapter::new(rpc_url, network_id.to_string(), chain_id).await?;
            adapters.insert(network_id.to_string(), Arc::new(adapter));
        }

        // Update active network
        let mut active_network = self.active_network.lock().await;
        *active_network = Some(network_id.to_string());

        Ok(())
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
    /// ```rust,no_run
    /// # use vaughan::state::VaughanState;
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
