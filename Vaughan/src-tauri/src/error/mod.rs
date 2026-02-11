// ============================================================================
// Vaughan Wallet - Error Types
// ============================================================================
//
// Centralized error handling for all wallet operations.
// All errors implement Display for user-friendly messages.
//
// ============================================================================

use serde::{Deserialize, Serialize};
use std::fmt;

/// Central error type for all wallet operations
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "message")]
pub enum WalletError {
    // ===== Network Errors =====
    /// Network connection failed
    NetworkError(String),

    /// RPC request failed
    RpcError(String),

    /// Connection timeout
    ConnectionTimeout(String),

    // ===== Address Errors =====
    /// Invalid address format
    InvalidAddress(String),

    /// Invalid checksum
    InvalidChecksum(String),

    // ===== Transaction Errors =====
    /// Insufficient balance for transaction
    InsufficientBalance { need: String, have: String },

    /// Transaction failed
    TransactionFailed(String),

    /// Invalid transaction parameters
    InvalidTransaction(String),

    /// Gas estimation failed
    GasEstimationFailed(String),

    /// Invalid amount
    InvalidAmount(String),

    /// Nonce mismatch
    NonceMismatch(String),

    // ===== Account Errors =====
    /// Account not found
    AccountNotFound(String),

    /// Invalid private key
    InvalidPrivateKey(String),

    /// Invalid mnemonic phrase
    InvalidMnemonic(String),

    /// Derivation path error
    InvalidDerivationPath(String),

    // ===== Security Errors =====
    /// Unauthorized operation
    Unauthorized,

    /// Wallet is locked
    WalletLocked,

    /// Invalid password
    InvalidPassword,

    /// Encryption failed
    EncryptionFailed(String),

    /// Decryption failed
    DecryptionFailed(String),

    /// Signer not available (adapter created without signer)
    SignerNotAvailable(String),

    /// Signing operation failed
    SigningFailed(String),

    /// Key derivation failed (BIP-32)
    KeyDerivationFailed(String),

    /// Keyring operation failed (OS keychain)
    KeyringError(String),

    // ===== Chain Adapter Errors =====
    /// Chain type not supported
    ChainNotSupported(String),

    /// Chain adapter not found
    AdapterNotFound(String),

    /// Invalid network configuration
    InvalidNetwork(String),

    /// Network not initialized
    NetworkNotInitialized,

    /// No active account selected
    NoActiveAccount,

    // ===== dApp Errors =====
    /// dApp not connected
    DappNotConnected(String),

    /// Permission denied
    PermissionDenied(String),

    /// Invalid origin
    InvalidOrigin(String),

    /// Origin mismatch (session origin doesn't match request origin)
    OriginMismatch,

    /// Not connected (no active session)
    NotConnected,

    /// Rate limit exceeded
    RateLimitExceeded,

    /// Unsupported method
    UnsupportedMethod(String),

    /// Invalid params
    InvalidParams,

    /// Duplicate request
    DuplicateRequest,

    /// Request expired
    RequestExpired,

    /// User rejected the request
    UserRejected,

    // ===== Configuration Errors =====
    /// Configuration error
    ConfigError(String),

    /// State persistence error
    StatePersistenceError(String),

    // ===== General Errors =====
    /// Internal error (should not happen)
    InternalError(String),

    /// Parse error
    ParseError(String),

    /// Custom error message
    Custom(String),
}

impl fmt::Display for WalletError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            // Network Errors
            Self::NetworkError(msg) => write!(f, "Network error: {}", msg),
            Self::RpcError(msg) => write!(f, "RPC error: {}", msg),
            Self::ConnectionTimeout(msg) => write!(f, "Connection timeout: {}", msg),

            // Address Errors
            Self::InvalidAddress(addr) => write!(f, "Invalid address: {}", addr),
            Self::InvalidChecksum(addr) => write!(f, "Invalid checksum for address: {}", addr),

            // Transaction Errors
            Self::InsufficientBalance { need, have } => {
                write!(f, "Insufficient balance: need {}, have {}", need, have)
            },
            Self::TransactionFailed(msg) => write!(f, "Transaction failed: {}", msg),
            Self::InvalidTransaction(msg) => write!(f, "Invalid transaction: {}", msg),
            Self::GasEstimationFailed(msg) => write!(f, "Gas estimation failed: {}", msg),
            Self::InvalidAmount(msg) => write!(f, "Invalid amount: {}", msg),
            Self::NonceMismatch(msg) => write!(f, "Nonce mismatch: {}", msg),

            // Account Errors
            Self::AccountNotFound(id) => write!(f, "Account not found: {}", id),
            Self::InvalidPrivateKey(msg) => write!(f, "Invalid private key: {}", msg),
            Self::InvalidMnemonic(msg) => write!(f, "Invalid mnemonic: {}", msg),
            Self::InvalidDerivationPath(path) => write!(f, "Invalid derivation path: {}", path),

            // Security Errors
            Self::Unauthorized => write!(f, "Unauthorized operation"),
            Self::WalletLocked => write!(f, "Wallet is locked"),
            Self::InvalidPassword => write!(f, "Invalid password"),
            Self::EncryptionFailed(msg) => write!(f, "Encryption failed: {}", msg),
            Self::DecryptionFailed(msg) => write!(f, "Decryption failed: {}", msg),
            Self::SignerNotAvailable(msg) => write!(f, "Signer not available: {}", msg),
            Self::SigningFailed(msg) => write!(f, "Signing failed: {}", msg),
            Self::KeyDerivationFailed(msg) => write!(f, "Key derivation failed: {}", msg),
            Self::KeyringError(msg) => write!(f, "Keyring error: {}", msg),

            // Chain Adapter Errors
            Self::ChainNotSupported(chain) => write!(f, "Chain not supported: {}", chain),
            Self::AdapterNotFound(chain) => write!(f, "Adapter not found for chain: {}", chain),
            Self::InvalidNetwork(msg) => write!(f, "Invalid network: {}", msg),
            Self::NetworkNotInitialized => write!(f, "Network not initialized"),
            Self::NoActiveAccount => write!(f, "No active account selected"),

            // dApp Errors
            Self::DappNotConnected(origin) => write!(f, "dApp not connected: {}", origin),
            Self::PermissionDenied(msg) => write!(f, "Permission denied: {}", msg),
            Self::InvalidOrigin(origin) => write!(f, "Invalid origin: {}", origin),
            Self::OriginMismatch => write!(f, "Origin mismatch: session origin doesn't match request origin"),
            Self::NotConnected => write!(f, "Not connected: no active session"),
            Self::RateLimitExceeded => write!(f, "Rate limit exceeded: too many requests"),
            Self::UnsupportedMethod(method) => write!(f, "Unsupported method: {}", method),
            Self::InvalidParams => write!(f, "Invalid parameters"),
            Self::DuplicateRequest => write!(f, "Duplicate request"),
            Self::RequestExpired => write!(f, "Request expired"),
            Self::UserRejected => write!(f, "User rejected the request"),

            // Configuration Errors
            Self::ConfigError(msg) => write!(f, "Configuration error: {}", msg),
            Self::StatePersistenceError(msg) => write!(f, "State persistence error: {}", msg),

            // General Errors
            Self::InternalError(msg) => write!(f, "Internal error: {}", msg),
            Self::ParseError(msg) => write!(f, "Parse error: {}", msg),
            Self::Custom(msg) => write!(f, "{}", msg),
        }
    }
}

impl std::error::Error for WalletError {}

impl WalletError {
    /// Get user-friendly error message
    pub fn user_message(&self) -> String {
        match self {
            Self::NetworkError(_) | Self::RpcError(_) | Self::ConnectionTimeout(_) => {
                "Network connection failed. Please check your internet connection.".to_string()
            },
            Self::RateLimitExceeded => {
                "Too many requests. Please wait a moment and try again.".to_string()
            },
            Self::InvalidAddress(addr) => {
                format!("Invalid address: {}", addr)
            },
            Self::InsufficientBalance { need, have } => {
                format!(
                    "Insufficient balance. Need {}, but only have {}",
                    need, have
                )
            },
            Self::TransactionFailed(msg) if msg.contains("gas") => {
                "Transaction failed due to insufficient gas. Try increasing the gas limit."
                    .to_string()
            },
            Self::TransactionFailed(msg) if msg.contains("nonce") => {
                "Transaction failed due to nonce mismatch. Please try again.".to_string()
            },
            Self::TransactionFailed(_) => "Transaction failed. Please try again later.".to_string(),
            Self::WalletLocked => "Wallet is locked. Please unlock to continue.".to_string(),
            Self::InvalidPassword => "Invalid password. Please try again.".to_string(),
            Self::Unauthorized => {
                "Unauthorized operation. This action can only be performed from the wallet."
                    .to_string()
            },
            Self::SignerNotAvailable(_) => "Cannot sign: wallet is in read-only mode.".to_string(),
            Self::SigningFailed(_) => {
                "Failed to sign transaction or message. Please try again.".to_string()
            },
            Self::ChainNotSupported(chain) => {
                format!("Chain '{}' is not supported yet.", chain)
            },
            Self::InvalidNetwork(msg) => {
                format!("Invalid network configuration: {}", msg)
            },
            Self::NetworkNotInitialized => {
                "Network not initialized. Please select a network first.".to_string()
            },
            Self::NoActiveAccount => {
                "No active account. Please select or create an account.".to_string()
            },
            Self::DappNotConnected(origin) => {
                format!("dApp '{}' is not connected. Please connect first.", origin)
            },
            Self::OriginMismatch => {
                "Origin mismatch. The request origin doesn't match the session.".to_string()
            },
            Self::NotConnected => {
                "Not connected. Please connect to the dApp first.".to_string()
            },
            Self::UnsupportedMethod(method) => {
                format!("Method '{}' is not supported.", method)
            },
            Self::InvalidParams => {
                "Invalid parameters provided.".to_string()
            },
            Self::DuplicateRequest => {
                "Duplicate request detected.".to_string()
            },
            Self::RequestExpired => {
                "Request has expired. Please try again.".to_string()
            },
            Self::UserRejected => {
                "User rejected the request.".to_string()
            },
            Self::PermissionDenied(msg) => {
                format!("Permission denied: {}", msg)
            },
            _ => self.to_string(),
        }
    }

    /// Get error code for frontend
    pub fn code(&self) -> &'static str {
        match self {
            Self::NetworkError(_) => "NETWORK_ERROR",
            Self::RpcError(_) => "RPC_ERROR",
            Self::ConnectionTimeout(_) => "CONNECTION_TIMEOUT",
            Self::InvalidAddress(_) => "INVALID_ADDRESS",
            Self::InvalidChecksum(_) => "INVALID_CHECKSUM",
            Self::InsufficientBalance { .. } => "INSUFFICIENT_BALANCE",
            Self::TransactionFailed(_) => "TRANSACTION_FAILED",
            Self::InvalidTransaction(_) => "INVALID_TRANSACTION",
            Self::GasEstimationFailed(_) => "GAS_ESTIMATION_FAILED",
            Self::InvalidAmount(_) => "INVALID_AMOUNT",
            Self::NonceMismatch(_) => "NONCE_MISMATCH",
            Self::AccountNotFound(_) => "ACCOUNT_NOT_FOUND",
            Self::InvalidPrivateKey(_) => "INVALID_PRIVATE_KEY",
            Self::InvalidMnemonic(_) => "INVALID_MNEMONIC",
            Self::InvalidDerivationPath(_) => "INVALID_DERIVATION_PATH",
            Self::Unauthorized => "UNAUTHORIZED",
            Self::WalletLocked => "WALLET_LOCKED",
            Self::InvalidPassword => "INVALID_PASSWORD",
            Self::EncryptionFailed(_) => "ENCRYPTION_FAILED",
            Self::DecryptionFailed(_) => "DECRYPTION_FAILED",
            Self::SignerNotAvailable(_) => "SIGNER_NOT_AVAILABLE",
            Self::SigningFailed(_) => "SIGNING_FAILED",
            Self::KeyDerivationFailed(_) => "KEY_DERIVATION_FAILED",
            Self::KeyringError(_) => "KEYRING_ERROR",
            Self::ChainNotSupported(_) => "CHAIN_NOT_SUPPORTED",
            Self::AdapterNotFound(_) => "ADAPTER_NOT_FOUND",
            Self::InvalidNetwork(_) => "INVALID_NETWORK",
            Self::NetworkNotInitialized => "NETWORK_NOT_INITIALIZED",
            Self::NoActiveAccount => "NO_ACTIVE_ACCOUNT",
            Self::DappNotConnected(_) => "DAPP_NOT_CONNECTED",
            Self::PermissionDenied(_) => "PERMISSION_DENIED",
            Self::InvalidOrigin(_) => "INVALID_ORIGIN",
            Self::OriginMismatch => "ORIGIN_MISMATCH",
            Self::NotConnected => "NOT_CONNECTED",
            Self::RateLimitExceeded => "RATE_LIMIT_EXCEEDED",
            Self::UnsupportedMethod(_) => "UNSUPPORTED_METHOD",
            Self::InvalidParams => "INVALID_PARAMS",
            Self::DuplicateRequest => "DUPLICATE_REQUEST",
            Self::RequestExpired => "REQUEST_EXPIRED",
            Self::UserRejected => "USER_REJECTED",
            Self::ConfigError(_) => "CONFIG_ERROR",
            Self::StatePersistenceError(_) => "STATE_PERSISTENCE_ERROR",
            Self::InternalError(_) => "INTERNAL_ERROR",
            Self::ParseError(_) => "PARSE_ERROR",
            Self::Custom(_) => "CUSTOM_ERROR",
        }
    }
}

// ============================================================================
// Conversions from External Error Types
// ============================================================================

/// Convert from Alloy RPC errors
impl From<alloy::transports::RpcError<alloy::transports::TransportErrorKind>> for WalletError {
    fn from(err: alloy::transports::RpcError<alloy::transports::TransportErrorKind>) -> Self {
        use alloy::transports::RpcError;

        match err {
            RpcError::Transport(e) => Self::NetworkError(e.to_string()),
            RpcError::ErrorResp(payload) => {
                // Check for specific error messages
                let msg = &payload.message;
                if msg.contains("insufficient funds") {
                    Self::InsufficientBalance {
                        need: "unknown".to_string(),
                        have: "unknown".to_string(),
                    }
                } else if msg.contains("nonce") {
                    Self::NonceMismatch(msg.clone())
                } else if msg.contains("gas") {
                    Self::GasEstimationFailed(msg.clone())
                } else {
                    Self::RpcError(msg.clone())
                }
            },
            e => Self::RpcError(e.to_string()),
        }
    }
}

/// Convert from serde_json errors
impl From<serde_json::Error> for WalletError {
    fn from(err: serde_json::Error) -> Self {
        Self::ParseError(err.to_string())
    }
}

/// Convert from std::io errors
impl From<std::io::Error> for WalletError {
    fn from(err: std::io::Error) -> Self {
        Self::InternalError(err.to_string())
    }
}

/// Convert to String for Tauri commands
impl From<WalletError> for String {
    fn from(err: WalletError) -> Self {
        err.user_message()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display() {
        let err = WalletError::InvalidAddress("0xinvalid".to_string());
        assert_eq!(err.to_string(), "Invalid address: 0xinvalid");
    }

    #[test]
    fn test_user_message() {
        let err = WalletError::WalletLocked;
        assert_eq!(
            err.user_message(),
            "Wallet is locked. Please unlock to continue."
        );
    }

    #[test]
    fn test_error_code() {
        let err = WalletError::InsufficientBalance {
            need: "1.0".to_string(),
            have: "0.5".to_string(),
        };
        assert_eq!(err.code(), "INSUFFICIENT_BALANCE");
    }

    #[test]
    fn test_insufficient_balance_display() {
        let err = WalletError::InsufficientBalance {
            need: "1.0 ETH".to_string(),
            have: "0.5 ETH".to_string(),
        };
        assert_eq!(
            err.to_string(),
            "Insufficient balance: need 1.0 ETH, have 0.5 ETH"
        );
    }
}
