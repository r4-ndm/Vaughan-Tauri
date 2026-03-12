use serde::{Deserialize, Deserializer, Serialize, Serializer};
use specta::Type;
use alloy::primitives::Address;
use std::str::FromStr;

/// Account type
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Type)]
#[serde(rename_all = "lowercase")]
pub enum AccountType {
    /// HD account (derived from seed)
    Hd,
    /// Imported account (from private key)
    Imported,
}

/// Deserialize Address from a string (e.g. "0x...") so persisted state still loads
/// after Alloy serialization format changes (e.g. EIP-55 vs lowercase).
fn deserialize_address_lenient<'de, D>(deserializer: D) -> Result<Address, D::Error>
where
    D: Deserializer<'de>,
{
    let s = String::deserialize(deserializer)?;
    Address::from_str(&s).map_err(serde::de::Error::custom)
}

/// Serialize Address as a plain "0x..." string so the frontend always receives a string.
fn serialize_address_string<S>(addr: &Address, serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    serializer.serialize_str(&format!("{:?}", addr))
}

/// Account information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Account {
    /// Account address (lenient deserialize for persistence; always serialize as string for frontend)
    #[serde(deserialize_with = "deserialize_address_lenient", serialize_with = "serialize_address_string")]
    pub address: Address,

    /// Account name (user-defined)
    pub name: String,

    /// Account type
    pub account_type: AccountType,

    /// Derivation index (for HD accounts)
    pub index: Option<u32>,
}

/// Account shape for Specta/TypeScript export (address as string; same JSON shape as Account).
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct AccountExport {
    pub address: String,
    pub name: String,
    pub account_type: AccountType,
    pub index: Option<u32>,
}

impl From<Account> for AccountExport {
    fn from(a: Account) -> Self {
        Self {
            address: format!("{:?}", a.address),
            name: a.name,
            account_type: a.account_type,
            index: a.index,
        }
    }
}
