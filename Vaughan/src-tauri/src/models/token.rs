use serde::{Deserialize, Serialize};
use specta::Type;

/// Custom token tracked by the user
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Type)]
pub struct TrackedToken {
    /// Token contract address
    pub address: String,

    /// Token symbol (e.g. "WETH", "USDC")
    pub symbol: String,

    /// Token name
    pub name: String,

    /// Token decimals
    pub decimals: u8,

    /// Network Chain ID this token belongs to
    pub chain_id: u64,
}
