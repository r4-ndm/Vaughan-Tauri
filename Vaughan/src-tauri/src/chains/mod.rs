// ============================================================================
// Vaughan Wallet - Chain Adapter Trait
// ============================================================================
//
// Multi-chain abstraction layer that allows Vaughan to support multiple
// blockchain types through a unified interface.
//
// Design Principle: All wallet core logic uses this trait, never concrete
// chain implementations. This keeps the core chain-agnostic.
//
// ============================================================================

pub mod evm;
pub mod types;

use crate::error::WalletError;
use async_trait::async_trait;

// Re-export all types for convenience
pub use types::{
    Balance, ChainInfo, ChainTransaction, ChainType, EvmTransaction, Fee, Signature, TokenInfo,
    TxHash, TxRecord, TxStatus,
};

// ============================================================================
// ChainAdapter Trait
// ============================================================================

/// Chain adapter trait for blockchain operations
///
/// This trait defines the interface that all blockchain implementations must
/// provide. It abstracts away chain-specific details and provides a unified
/// API for wallet operations.
///
/// # Design Principles
///
/// 1. **Chain-Agnostic**: All methods use chain-agnostic types from `types.rs`
/// 2. **Async**: All operations are async (blockchain operations are I/O bound)
/// 3. **Error Handling**: All methods return `Result<T, WalletError>`
/// 4. **Thread-Safe**: Trait requires `Send + Sync` for multi-threaded use
///
/// # Example Implementation
///
/// ```rust,ignore
/// use async_trait::async_trait;
///
/// pub struct EvmAdapter {
///     provider: RootProvider<Http<Client>>,
///     chain_id: u64,
/// }
///
/// #[async_trait]
/// impl ChainAdapter for EvmAdapter {
///     async fn get_balance(&self, address: &str) -> Result<Balance, WalletError> {
///         // Implementation using Alloy
///         let balance = self.provider.get_balance(address).await?;
///         Ok(Balance::new(/* ... */))
///     }
///     
///     // ... implement other methods
/// }
/// ```
///
/// # Usage in Wallet Core
///
/// ```rust,ignore
/// pub struct WalletState {
///     adapters: HashMap<ChainType, Arc<dyn ChainAdapter>>,
/// }
///
/// impl WalletState {
///     pub async fn get_balance(&self, chain: ChainType, address: &str) -> Result<Balance> {
///         let adapter = self.adapters.get(&chain)?;
///         adapter.get_balance(address).await
///     }
/// }
/// ```
#[async_trait]
pub trait ChainAdapter: Send + Sync {
    // ========================================================================
    // Balance Operations
    // ========================================================================

    /// Get native token balance for an address
    ///
    /// # Arguments
    ///
    /// * `address` - The address to query (chain-specific format)
    ///
    /// # Returns
    ///
    /// * `Balance` - Balance with raw amount, formatted amount, and optional USD value
    ///
    /// # Errors
    ///
    /// * `WalletError::InvalidAddress` - If address format is invalid
    /// * `WalletError::NetworkError` - If network request fails
    /// * `WalletError::RpcError` - If RPC call fails
    ///
    /// # Example
    ///
    /// ```rust,ignore
    /// let balance = adapter.get_balance("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb").await?;
    /// println!("Balance: {}", balance.formatted);
    /// ```
    async fn get_balance(&self, address: &str) -> Result<Balance, WalletError>;

    // ========================================================================
    // Transaction Operations
    // ========================================================================

    /// Send a transaction
    ///
    /// # Arguments
    ///
    /// * `tx` - Chain-specific transaction parameters
    ///
    /// # Returns
    ///
    /// * `TxHash` - Transaction hash
    ///
    /// # Errors
    ///
    /// * `WalletError::InvalidTransaction` - If transaction parameters are invalid
    /// * `WalletError::InsufficientBalance` - If sender has insufficient balance
    /// * `WalletError::TransactionFailed` - If transaction fails
    /// * `WalletError::NetworkError` - If network request fails
    ///
    /// # Example
    ///
    /// ```rust,ignore
    /// let tx = ChainTransaction::Evm(EvmTransaction {
    ///     from: "0x...".to_string(),
    ///     to: "0x...".to_string(),
    ///     value: "1000000000000000000".to_string(), // 1 ETH in wei
    ///     // ... other fields
    /// });
    ///
    /// let tx_hash = adapter.send_transaction(tx).await?;
    /// println!("Transaction sent: {}", tx_hash);
    /// ```
    async fn send_transaction(&self, tx: ChainTransaction) -> Result<TxHash, WalletError>;

    /// Sign a message (for authentication, not transactions)
    ///
    /// # Arguments
    ///
    /// * `address` - The address to sign with
    /// * `message` - The message to sign (raw bytes)
    ///
    /// # Returns
    ///
    /// * `Signature` - Signature with bytes and optional recovery ID
    ///
    /// # Errors
    ///
    /// * `WalletError::InvalidAddress` - If address is invalid
    /// * `WalletError::AccountNotFound` - If account not found
    /// * `WalletError::WalletLocked` - If wallet is locked
    ///
    /// # Example
    ///
    /// ```rust,ignore
    /// let message = b"Sign in to dApp";
    /// let signature = adapter.sign_message("0x...", message).await?;
    /// println!("Signature: {}", signature.bytes);
    /// ```
    async fn sign_message(&self, address: &str, message: &[u8]) -> Result<Signature, WalletError>;

    /// Get transaction history for an address
    ///
    /// # Arguments
    ///
    /// * `address` - The address to query
    /// * `limit` - Maximum number of transactions to return
    ///
    /// # Returns
    ///
    /// * `Vec<TxRecord>` - List of transaction records
    ///
    /// # Errors
    ///
    /// * `WalletError::InvalidAddress` - If address is invalid
    /// * `WalletError::NetworkError` - If network request fails
    ///
    /// # Example
    ///
    /// ```rust,ignore
    /// let txs = adapter.get_transactions("0x...", 10).await?;
    /// for tx in txs {
    ///     println!("{}: {} -> {}", tx.hash, tx.from, tx.to);
    /// }
    /// ```
    async fn get_transactions(
        &self,
        address: &str,
        limit: u32,
    ) -> Result<Vec<TxRecord>, WalletError>;

    // ========================================================================
    // Fee Estimation
    // ========================================================================

    /// Estimate transaction fee
    ///
    /// # Arguments
    ///
    /// * `tx` - Transaction to estimate fee for
    ///
    /// # Returns
    ///
    /// * `Fee` - Fee estimate with amount, formatted value, and optional USD value
    ///
    /// # Errors
    ///
    /// * `WalletError::GasEstimationFailed` - If fee estimation fails
    /// * `WalletError::InvalidTransaction` - If transaction is invalid
    /// * `WalletError::NetworkError` - If network request fails
    ///
    /// # Example
    ///
    /// ```rust,ignore
    /// let fee = adapter.estimate_fee(&tx).await?;
    /// println!("Estimated fee: {}", fee.formatted);
    /// ```
    async fn estimate_fee(&self, tx: &ChainTransaction) -> Result<Fee, WalletError>;

    // ========================================================================
    // Address Validation
    // ========================================================================

    /// Validate an address format
    ///
    /// # Arguments
    ///
    /// * `address` - The address to validate
    ///
    /// # Returns
    ///
    /// * `Ok(())` - If address is valid
    ///
    /// # Errors
    ///
    /// * `WalletError::InvalidAddress` - If address format is invalid
    /// * `WalletError::InvalidChecksum` - If checksum is invalid (for EVM)
    ///
    /// # Example
    ///
    /// ```rust,ignore
    /// adapter.validate_address("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb")?;
    /// println!("Address is valid");
    /// ```
    fn validate_address(&self, address: &str) -> Result<(), WalletError>;

    // ========================================================================
    // Chain Information
    // ========================================================================

    /// Get chain information
    ///
    /// # Returns
    ///
    /// * `ChainInfo` - Information about this chain (type, ID, name, native token)
    ///
    /// # Example
    ///
    /// ```rust,ignore
    /// let info = adapter.chain_info();
    /// println!("Chain: {} (ID: {})", info.name, info.chain_id.unwrap());
    /// ```
    fn chain_info(&self) -> ChainInfo;

    /// Get chain type
    ///
    /// # Returns
    ///
    /// * `ChainType` - The type of blockchain (Evm, Stellar, etc.)
    ///
    /// # Example
    ///
    /// ```rust,ignore
    /// match adapter.chain_type() {
    ///     ChainType::Evm => println!("EVM chain"),
    ///     ChainType::Stellar => println!("Stellar chain"),
    ///     _ => println!("Other chain"),
    /// }
    /// ```
    fn chain_type(&self) -> ChainType;
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Check if a chain type is supported
///
/// # Arguments
///
/// * `chain_type` - The chain type to check
///
/// # Returns
///
/// * `true` if supported, `false` otherwise
///
/// # Example
///
/// ```rust,ignore
/// if is_chain_supported(ChainType::Evm) {
///     println!("EVM is supported");
/// }
/// ```
pub fn is_chain_supported(chain_type: ChainType) -> bool {
    matches!(chain_type, ChainType::Evm)
    // Add more as we implement them:
    // matches!(chain_type, ChainType::Evm | ChainType::Stellar | ChainType::Aptos)
}

/// Get list of supported chain types
///
/// # Returns
///
/// * `Vec<ChainType>` - List of supported chain types
///
/// # Example
///
/// ```rust,ignore
/// let supported = supported_chains();
/// println!("Supported chains: {:?}", supported);
/// ```
pub fn supported_chains() -> Vec<ChainType> {
    vec![ChainType::Evm]
    // Add more as we implement them:
    // vec![ChainType::Evm, ChainType::Stellar, ChainType::Aptos]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_chain_supported() {
        assert!(is_chain_supported(ChainType::Evm));
        assert!(!is_chain_supported(ChainType::Stellar));
        assert!(!is_chain_supported(ChainType::Aptos));
    }

    #[test]
    fn test_supported_chains() {
        let chains = supported_chains();
        assert_eq!(chains.len(), 1);
        assert_eq!(chains[0], ChainType::Evm);
    }
}
