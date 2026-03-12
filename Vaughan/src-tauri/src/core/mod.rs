// ============================================================================
// Vaughan Wallet - Core Module
// ============================================================================
//
// Chain-agnostic wallet business logic.
//
// ============================================================================

pub mod network;
pub mod persistence;
pub mod price;
pub mod transaction;
pub mod wallet;

// Re-export main types
pub use network::{NetworkConfig, NetworkInfo, NetworkService, TokenInfo};
pub use persistence::{PersistedState, StateManager, UserPreferences};
pub use price::PriceService;
pub use transaction::TransactionService;
pub use wallet::WalletService;

// Re-export account types from models to maintain back-compat and keep mod.rs clean
pub use crate::models::wallet::{Account, AccountType};
