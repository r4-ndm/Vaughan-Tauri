//! Tauri Commands
//!
//! This module contains all Tauri commands that provide the IPC bridge
//! between the React frontend and the Rust backend.
//!
//! ## Architecture
//!
//! Commands follow a consistent pattern:
//! 1. Receive typed request from frontend
//! 2. Access VaughanState via `State<'_, VaughanState>`
//! 3. Call appropriate service/adapter methods
//! 4. Return typed response or error
//!
//! ## Error Handling
//!
//! All commands return `Result<T, String>` where the error string is
//! user-friendly (via `WalletError::user_message()`).
//!
//! ## Security
//!
//! Sensitive commands (transaction signing, account export) include origin
//! verification to ensure they're only called from the main wallet window,
//! not from dApp windows.

pub mod dapp;
pub mod network;
pub mod token;
pub mod transaction;
pub mod wallet;
pub mod window;

// Re-export command functions for easy registration
pub use dapp::{connect_dapp, dapp_request, disconnect_dapp, get_connected_dapps};
pub use network::{get_balance, get_block_number, get_chain_id, get_network_info, switch_network};
pub use token::{get_token_price, refresh_token_prices};
pub use transaction::{
    build_transaction, estimate_gas_simple, send_transaction, sign_transaction,
    validate_transaction,
};
pub use wallet::{
    create_account, create_wallet, delete_account, get_accounts, import_account, import_wallet,
    is_wallet_locked, lock_wallet, set_active_account, unlock_wallet, wallet_exists,
};
pub use window::open_dapp_browser;
