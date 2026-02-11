// ============================================================================
// Vaughan Wallet - EVM Module
// ============================================================================
//
// EVM chain adapter implementation using Alloy.
//
// ============================================================================

pub mod adapter;
pub mod networks;
pub mod utils;

// Re-export main types
pub use adapter::EvmAdapter;
pub use networks::{all_networks, get_network, get_network_by_chain_id, EvmNetworkConfig};
pub use utils::*;
