// ============================================================================
// Vaughan Wallet - Chain-Agnostic Types
// ============================================================================
//
// Type definitions that work across all blockchain types.
// These types abstract away chain-specific details.
//
// ============================================================================

use serde::{Deserialize, Serialize};
use std::fmt;

// ============================================================================
// Chain Type Enum
// ============================================================================

/// Supported blockchain types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ChainType {
    /// Ethereum Virtual Machine compatible chains
    Evm,

    /// Stellar network
    Stellar,

    /// Aptos blockchain
    Aptos,

    /// Solana network
    Solana,

    /// Bitcoin network
    Bitcoin,
}

impl fmt::Display for ChainType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Evm => write!(f, "EVM"),
            Self::Stellar => write!(f, "Stellar"),
            Self::Aptos => write!(f, "Aptos"),
            Self::Solana => write!(f, "Solana"),
            Self::Bitcoin => write!(f, "Bitcoin"),
        }
    }
}

// ============================================================================
// Balance Types
// ============================================================================

/// Chain-agnostic balance representation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Balance {
    /// Token information
    pub token: TokenInfo,

    /// Raw amount (smallest unit: wei, lamports, etc.)
    pub raw: String,

    /// Human-readable amount (e.g., "1.5 ETH")
    pub formatted: String,

    /// USD value (if available)
    pub usd_value: Option<f64>,
}

impl Balance {
    /// Create a new balance
    pub fn new(token: TokenInfo, raw: String, formatted: String) -> Self {
        Self {
            token,
            raw,
            formatted,
            usd_value: None,
        }
    }

    /// Create balance with USD value
    pub fn with_usd_value(mut self, usd_value: f64) -> Self {
        self.usd_value = Some(usd_value);
        self
    }
}

// ============================================================================
// Token Types
// ============================================================================

/// Token information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenInfo {
    /// Token symbol (e.g., "ETH", "PLS", "USDC")
    pub symbol: String,

    /// Token name (e.g., "Ethereum", "PulseChain", "USD Coin")
    pub name: String,

    /// Decimal places
    pub decimals: u8,

    /// Contract address (None for native tokens)
    pub contract_address: Option<String>,

    /// Token logo URL (optional)
    pub logo_url: Option<String>,
}

impl TokenInfo {
    /// Create native token info
    pub fn native(symbol: String, name: String, decimals: u8) -> Self {
        Self {
            symbol,
            name,
            decimals,
            contract_address: None,
            logo_url: None,
        }
    }

    /// Create ERC20 token info
    pub fn erc20(symbol: String, name: String, decimals: u8, contract_address: String) -> Self {
        Self {
            symbol,
            name,
            decimals,
            contract_address: Some(contract_address),
            logo_url: None,
        }
    }

    /// Add logo URL
    pub fn with_logo(mut self, logo_url: String) -> Self {
        self.logo_url = Some(logo_url);
        self
    }
}

// ============================================================================
// Transaction Types
// ============================================================================

/// Chain-agnostic transaction hash
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TxHash(pub String);

impl fmt::Display for TxHash {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl From<String> for TxHash {
    fn from(s: String) -> Self {
        Self(s)
    }
}

/// Chain-agnostic transaction request
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "chain_type")]
pub enum ChainTransaction {
    /// EVM transaction
    Evm(EvmTransaction),

    /// Stellar transaction (placeholder)
    Stellar(StellarTransaction),

    /// Aptos transaction (placeholder)
    Aptos(AptosTransaction),

    /// Solana transaction (placeholder)
    Solana(SolanaTransaction),

    /// Bitcoin transaction (placeholder)
    Bitcoin(BitcoinTransaction),
}

/// EVM transaction parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvmTransaction {
    /// Sender address
    pub from: String,

    /// Recipient address
    pub to: String,

    /// Value to send (in wei)
    pub value: String,

    /// Transaction data (for contract calls)
    pub data: Option<String>,

    /// Gas limit
    pub gas_limit: Option<u64>,

    /// Gas price (in wei)
    pub gas_price: Option<String>,

    /// Max fee per gas (EIP-1559)
    pub max_fee_per_gas: Option<String>,

    /// Max priority fee per gas (EIP-1559)
    pub max_priority_fee_per_gas: Option<String>,

    /// Nonce
    pub nonce: Option<u64>,

    /// Chain ID
    pub chain_id: u64,
}

/// Stellar transaction (placeholder for future implementation)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StellarTransaction {
    pub from: String,
    pub to: String,
    pub amount: String,
    // Add Stellar-specific fields later
}

/// Aptos transaction (placeholder for future implementation)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AptosTransaction {
    pub from: String,
    pub to: String,
    pub amount: String,
    // Add Aptos-specific fields later
}

/// Solana transaction (placeholder for future implementation)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolanaTransaction {
    pub from: String,
    pub to: String,
    pub amount: String,
    // Add Solana-specific fields later
}

/// Bitcoin transaction (placeholder for future implementation)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BitcoinTransaction {
    pub from: String,
    pub to: String,
    pub amount: String,
    // Add Bitcoin-specific fields later
}

/// Transaction status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TxStatus {
    /// Transaction is pending
    Pending,

    /// Transaction is confirmed
    Confirmed,

    /// Transaction failed
    Failed,
}

impl fmt::Display for TxStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Pending => write!(f, "Pending"),
            Self::Confirmed => write!(f, "Confirmed"),
            Self::Failed => write!(f, "Failed"),
        }
    }
}

/// Transaction record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TxRecord {
    /// Transaction hash
    pub hash: TxHash,

    /// From address
    pub from: String,

    /// To address
    pub to: String,

    /// Value transferred
    pub value: String,

    /// Transaction status
    pub status: TxStatus,

    /// Block number (if confirmed)
    pub block_number: Option<u64>,

    /// Timestamp (Unix timestamp)
    pub timestamp: Option<u64>,

    /// Gas used
    pub gas_used: Option<u64>,

    /// Transaction fee
    pub fee: Option<String>,
}

// ============================================================================
// Signature Types
// ============================================================================

/// Chain-agnostic signature
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Signature {
    /// Signature bytes (hex-encoded)
    pub bytes: String,

    /// Recovery ID (for ECDSA)
    pub recovery_id: Option<u8>,
}

impl Signature {
    /// Create a new signature
    pub fn new(bytes: String) -> Self {
        Self {
            bytes,
            recovery_id: None,
        }
    }

    /// Create signature with recovery ID
    pub fn with_recovery_id(mut self, recovery_id: u8) -> Self {
        self.recovery_id = Some(recovery_id);
        self
    }
}

// ============================================================================
// Fee Types
// ============================================================================

/// Chain-agnostic fee estimate
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Fee {
    /// Estimated fee (in smallest unit)
    pub amount: String,

    /// Formatted fee (human-readable)
    pub formatted: String,

    /// USD value (if available)
    pub usd_value: Option<f64>,

    /// Gas limit (for EVM chains)
    pub gas_limit: Option<u64>,

    /// Gas price (for EVM chains)
    pub gas_price: Option<String>,
}

impl Fee {
    /// Create a new fee estimate
    pub fn new(amount: String, formatted: String) -> Self {
        Self {
            amount,
            formatted,
            usd_value: None,
            gas_limit: None,
            gas_price: None,
        }
    }

    /// Add USD value
    pub fn with_usd_value(mut self, usd_value: f64) -> Self {
        self.usd_value = Some(usd_value);
        self
    }

    /// Add gas details (for EVM)
    pub fn with_gas(mut self, gas_limit: u64, gas_price: String) -> Self {
        self.gas_limit = Some(gas_limit);
        self.gas_price = Some(gas_price);
        self
    }
}

// ============================================================================
// Chain Info Types
// ============================================================================

/// Chain information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainInfo {
    /// Chain type
    pub chain_type: ChainType,

    /// Chain ID (for EVM: 1 = Ethereum, 369 = PulseChain, etc.)
    pub chain_id: Option<u64>,

    /// Chain name
    pub name: String,

    /// Native token
    pub native_token: TokenInfo,

    /// Block explorer URL
    pub explorer_url: Option<String>,
}

impl ChainInfo {
    /// Create new chain info
    pub fn new(
        chain_type: ChainType,
        chain_id: Option<u64>,
        name: String,
        native_token: TokenInfo,
    ) -> Self {
        Self {
            chain_type,
            chain_id,
            name,
            native_token,
            explorer_url: None,
        }
    }

    /// Add explorer URL
    pub fn with_explorer(mut self, explorer_url: String) -> Self {
        self.explorer_url = Some(explorer_url);
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chain_type_display() {
        assert_eq!(ChainType::Evm.to_string(), "EVM");
        assert_eq!(ChainType::Stellar.to_string(), "Stellar");
    }

    #[test]
    fn test_balance_creation() {
        let token = TokenInfo::native("ETH".to_string(), "Ethereum".to_string(), 18);
        let balance = Balance::new(
            token,
            "1000000000000000000".to_string(),
            "1.0 ETH".to_string(),
        );

        assert_eq!(balance.raw, "1000000000000000000");
        assert_eq!(balance.formatted, "1.0 ETH");
        assert_eq!(balance.usd_value, None);
    }

    #[test]
    fn test_token_info_native() {
        let token = TokenInfo::native("ETH".to_string(), "Ethereum".to_string(), 18);
        assert_eq!(token.symbol, "ETH");
        assert_eq!(token.decimals, 18);
        assert_eq!(token.contract_address, None);
    }

    #[test]
    fn test_token_info_erc20() {
        let token = TokenInfo::erc20(
            "USDC".to_string(),
            "USD Coin".to_string(),
            6,
            "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48".to_string(),
        );
        assert_eq!(token.symbol, "USDC");
        assert_eq!(token.decimals, 6);
        assert!(token.contract_address.is_some());
    }

    #[test]
    fn test_tx_hash() {
        let hash = TxHash::from("0x123abc".to_string());
        assert_eq!(hash.to_string(), "0x123abc");
    }

    #[test]
    fn test_tx_status_display() {
        assert_eq!(TxStatus::Pending.to_string(), "Pending");
        assert_eq!(TxStatus::Confirmed.to_string(), "Confirmed");
        assert_eq!(TxStatus::Failed.to_string(), "Failed");
    }
}
