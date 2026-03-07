use serde::{Deserialize, Serialize};
use alloy::primitives::Address;

/// Account type
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AccountType {
    /// HD account (derived from seed)
    Hd,
    /// Imported account (from private key)
    Imported,
}

/// Account information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Account {
    /// Account address
    pub address: Address,
    
    /// Account name (user-defined)
    pub name: String,
    
    /// Account type
    pub account_type: AccountType,
    
    /// Derivation index (for HD accounts)
    pub index: Option<u32>,
}
