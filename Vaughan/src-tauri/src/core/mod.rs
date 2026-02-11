// ============================================================================
// Vaughan Wallet - Core Module
// ============================================================================
//
// Chain-agnostic wallet business logic.
//
// ============================================================================

pub mod network;
pub mod price;
pub mod transaction;
pub mod wallet;

// Re-export main types
pub use network::{NetworkConfig, NetworkInfo, NetworkService, TokenInfo};
pub use price::PriceService;
pub use transaction::TransactionService;
pub use wallet::{Account, AccountType, WalletService};
