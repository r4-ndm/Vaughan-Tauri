// ============================================================================
// Vaughan Wallet - Transaction Service
// ============================================================================
//
// Chain-agnostic transaction service using ChainAdapter trait.
// Rebuilt from old Iced TransactionController with improvements.
//
// Key Improvements:
// 1. Chain-agnostic (uses ChainAdapter trait)
// 2. Stateless (no stored provider)
// 3. Signer integration
// 4. EIP-1559 support
// 5. Better error handling
//
// ============================================================================

use crate::chains::{types::*, ChainAdapter};
use crate::error::WalletError;

/// Gas limit constants (from Ethereum standards)
pub const MIN_GAS_LIMIT: u64 = 21_000; // Minimum for simple transfer
pub const MAX_GAS_LIMIT: u64 = 30_000_000; // Block gas limit safety

/// Transaction service - chain-agnostic transaction operations
///
/// This service provides transaction validation, gas estimation, and sending
/// across all supported blockchains using the ChainAdapter trait.
///
/// # Design
///
/// - **Stateless**: No stored state, receives adapter as parameter
/// - **Chain-Agnostic**: Works with any ChainAdapter implementation
/// - **Validation**: Implements MetaMask-style validation rules
/// - **Security**: All validation happens in Rust (never trust frontend)
///
/// # Example
///
/// ```rust,ignore
/// let service = TransactionService::new();
/// let adapter = EvmAdapter::new(...).await?;
///
/// // Validate transaction
/// service.validate_evm_transaction(&tx)?;
///
/// // Estimate gas
/// let fee = service.estimate_gas(&adapter, &tx).await?;
///
/// // Send transaction (with signer)
/// let tx_hash = service.send_transaction(&adapter, &signer, tx).await?;
/// ```
pub struct TransactionService;

impl TransactionService {
    /// Create new transaction service
    pub fn new() -> Self {
        Self
    }

    // ========================================================================
    // Validation Methods
    // ========================================================================

    /// Validate EVM transaction parameters
    ///
    /// Implements MetaMask validation rules:
    /// - Zero address check (cannot send to 0x0)
    /// - Amount validation (positive, non-zero)
    /// - Gas limit validation (21k-30M)
    ///
    /// # Arguments
    ///
    /// * `tx` - EVM transaction to validate
    ///
    /// # Returns
    ///
    /// * `Ok(())` if validation passes
    /// * `Err(WalletError)` with specific validation failure
    ///
    /// # Example
    ///
    /// ```rust,ignore
    /// let service = TransactionService::new();
    /// service.validate_evm_transaction(&tx)?;
    /// ```
    pub fn validate_evm_transaction(&self, tx: &EvmTransaction) -> Result<(), WalletError> {
        // Zero address check (MetaMask pattern)
        // Sending to 0x0 is almost always a mistake and can result in lost funds
        let to_lower = tx.to.to_lowercase();
        if to_lower == "0x0000000000000000000000000000000000000000" || to_lower == "0x0" {
            return Err(WalletError::InvalidAddress(
                "Cannot send to zero address (0x0)".to_string(),
            ));
        }

        // Validate address format (basic check)
        if !tx.to.starts_with("0x") {
            return Err(WalletError::InvalidAddress(format!(
                "Invalid address format: {}",
                tx.to
            )));
        }

        // Amount validation
        // Parse amount to check it's valid
        let _amount = tx
            .value
            .parse::<u128>()
            .map_err(|_| WalletError::InvalidAmount(format!("Invalid amount: {}", tx.value)))?;

        // Allow zero amount for contract interactions
        // (MetaMask allows this for contract calls)

        // Gas limit validation (if provided)
        if let Some(gas_limit) = tx.gas_limit {
            if gas_limit < MIN_GAS_LIMIT {
                return Err(WalletError::InvalidTransaction(format!(
                    "Gas limit too low: minimum {} gas required for transfer",
                    MIN_GAS_LIMIT
                )));
            }

            if gas_limit > MAX_GAS_LIMIT {
                return Err(WalletError::InvalidTransaction(format!(
                    "Gas limit too high: maximum {} gas (block limit)",
                    MAX_GAS_LIMIT
                )));
            }
        }

        Ok(())
    }

    /// Validate transaction has sufficient balance
    ///
    /// Checks that sender has enough balance to cover amount + gas cost.
    ///
    /// # Arguments
    ///
    /// * `tx` - Transaction to validate
    /// * `balance` - Sender's current balance
    ///
    /// # Returns
    ///
    /// * `Ok(())` if balance is sufficient
    /// * `Err(WalletError::InsufficientBalance)` if not enough balance
    ///
    /// # Example
    ///
    /// ```rust,ignore
    /// let service = TransactionService::new();
    /// let balance = adapter.get_balance(&from_address).await?;
    /// service.validate_balance(&tx, &balance)?;
    /// ```
    pub fn validate_balance(
        &self,
        tx: &EvmTransaction,
        balance: &Balance,
    ) -> Result<(), WalletError> {
        // Parse transaction amount
        let tx_amount = tx
            .value
            .parse::<u128>()
            .map_err(|_| WalletError::InvalidAmount(format!("Invalid amount: {}", tx.value)))?;

        // Parse balance
        let balance_amount = balance
            .raw
            .parse::<u128>()
            .map_err(|_| WalletError::InternalError("Failed to parse balance".to_string()))?;

        // Estimate gas cost (conservative estimate)
        let gas_limit = tx.gas_limit.unwrap_or(MIN_GAS_LIMIT);
        let gas_price = if let Some(price) = &tx.gas_price {
            price.parse::<u128>().unwrap_or(1_000_000_000) // 1 gwei default
        } else {
            1_000_000_000 // 1 gwei default
        };

        let gas_cost = (gas_limit as u128).checked_mul(gas_price).ok_or_else(|| {
            WalletError::InvalidTransaction("Gas cost calculation overflow".to_string())
        })?;

        // Calculate total cost
        let total_cost = tx_amount.checked_add(gas_cost).ok_or_else(|| {
            WalletError::InvalidTransaction("Total cost calculation overflow".to_string())
        })?;

        // Check balance
        if total_cost > balance_amount {
            return Err(WalletError::InsufficientBalance {
                need: total_cost.to_string(),
                have: balance_amount.to_string(),
            });
        }

        Ok(())
    }

    // ========================================================================
    // Gas Estimation
    // ========================================================================

    /// Estimate gas for transaction
    ///
    /// Uses the chain adapter to estimate gas required for the transaction.
    ///
    /// # Arguments
    ///
    /// * `adapter` - Chain adapter to use for estimation
    /// * `tx` - Transaction to estimate gas for
    ///
    /// # Returns
    ///
    /// * `Ok(Fee)` - Estimated fee with gas details
    /// * `Err(WalletError)` - Estimation failed
    ///
    /// # Example
    ///
    /// ```rust,ignore
    /// let service = TransactionService::new();
    /// let fee = service.estimate_gas(&adapter, &ChainTransaction::Evm(tx)).await?;
    /// println!("Estimated fee: {}", fee.formatted);
    /// ```
    pub async fn estimate_gas(
        &self,
        adapter: &dyn ChainAdapter,
        tx: &ChainTransaction,
    ) -> Result<Fee, WalletError> {
        adapter.estimate_fee(tx).await
    }

    // ========================================================================
    // Transaction Sending
    // ========================================================================

    /// Send transaction
    ///
    /// Validates, signs, and sends a transaction using the chain adapter.
    ///
    /// # Arguments
    ///
    /// * `adapter` - Chain adapter to use for sending
    /// * `tx` - Transaction to send
    ///
    /// # Returns
    ///
    /// * `Ok(TxHash)` - Transaction hash
    /// * `Err(WalletError)` - Transaction failed
    ///
    /// # Example
    ///
    /// ```rust,ignore
    /// let service = TransactionService::new();
    /// let tx_hash = service.send_transaction(&adapter, tx).await?;
    /// println!("Transaction sent: {}", tx_hash);
    /// ```
    ///
    /// # Note
    ///
    /// This method delegates to the chain adapter, which handles signing
    /// internally. For EVM chains, the adapter will use the signer provided
    /// during adapter creation.
    pub async fn send_transaction(
        &self,
        adapter: &dyn ChainAdapter,
        tx: ChainTransaction,
    ) -> Result<TxHash, WalletError> {
        // Validate before sending
        if let ChainTransaction::Evm(ref evm_tx) = tx {
            self.validate_evm_transaction(evm_tx)?;
        }

        // Send using adapter
        adapter.send_transaction(tx).await
    }

    // ========================================================================
    // Transaction History
    // ========================================================================

    /// Get transaction history
    ///
    /// Retrieves recent transactions for an address.
    ///
    /// # Arguments
    ///
    /// * `adapter` - Chain adapter to use
    /// * `address` - Address to get transactions for
    /// * `limit` - Maximum number of transactions to return
    ///
    /// # Returns
    ///
    /// * `Ok(Vec<TxRecord>)` - List of transactions
    /// * `Err(WalletError)` - Failed to get transactions
    ///
    /// # Example
    ///
    /// ```rust,ignore
    /// let service = TransactionService::new();
    /// let txs = service.get_transactions(&adapter, "0x...", 10).await?;
    /// for tx in txs {
    ///     println!("{}: {} -> {}", tx.hash, tx.from, tx.to);
    /// }
    /// ```
    pub async fn get_transactions(
        &self,
        adapter: &dyn ChainAdapter,
        address: &str,
        limit: u32,
    ) -> Result<Vec<TxRecord>, WalletError> {
        adapter.get_transactions(address, limit).await
    }
}

impl Default for TransactionService {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_zero_address() {
        let service = TransactionService::new();

        let tx = EvmTransaction {
            from: "0x742d35cc6634c0532925a3b844bc9e7595f0beb".to_string(),
            to: "0x0000000000000000000000000000000000000000".to_string(),
            value: "1000000000000000000".to_string(),
            data: None,
            gas_limit: Some(21000),
            gas_price: None,
            max_fee_per_gas: None,
            max_priority_fee_per_gas: None,
            nonce: None,
            chain_id: 1,
        };

        let result = service.validate_evm_transaction(&tx);
        assert!(result.is_err());
        match result.unwrap_err() {
            WalletError::InvalidAddress(msg) => {
                assert!(msg.contains("zero address"));
            },
            _ => panic!("Expected InvalidAddress error"),
        }
    }

    #[test]
    fn test_validate_zero_amount() {
        let service = TransactionService::new();

        let tx = EvmTransaction {
            from: "0x742d35cc6634c0532925a3b844bc9e7595f0beb".to_string(),
            to: "0x742d35cc6634c0532925a3b844bc9e7595f0bec".to_string(),
            value: "0".to_string(),
            data: None,
            gas_limit: Some(21000),
            gas_price: None,
            max_fee_per_gas: None,
            max_priority_fee_per_gas: None,
            nonce: None,
            chain_id: 1,
        };

        // Zero amount is now allowed (for contract interactions)
        let result = service.validate_evm_transaction(&tx);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_gas_limit_too_low() {
        let service = TransactionService::new();

        let tx = EvmTransaction {
            from: "0x742d35cc6634c0532925a3b844bc9e7595f0beb".to_string(),
            to: "0x742d35cc6634c0532925a3b844bc9e7595f0bec".to_string(),
            value: "1000000000000000000".to_string(),
            data: None,
            gas_limit: Some(20000), // Below minimum
            gas_price: None,
            max_fee_per_gas: None,
            max_priority_fee_per_gas: None,
            nonce: None,
            chain_id: 1,
        };

        let result = service.validate_evm_transaction(&tx);
        assert!(result.is_err());
        match result.unwrap_err() {
            WalletError::InvalidTransaction(msg) => {
                assert!(msg.contains("too low"));
            },
            _ => panic!("Expected InvalidTransaction error"),
        }
    }

    #[test]
    fn test_validate_gas_limit_too_high() {
        let service = TransactionService::new();

        let tx = EvmTransaction {
            from: "0x742d35cc6634c0532925a3b844bc9e7595f0beb".to_string(),
            to: "0x742d35cc6634c0532925a3b844bc9e7595f0bec".to_string(),
            value: "1000000000000000000".to_string(),
            data: None,
            gas_limit: Some(31_000_000), // Above maximum
            gas_price: None,
            max_fee_per_gas: None,
            max_priority_fee_per_gas: None,
            nonce: None,
            chain_id: 1,
        };

        let result = service.validate_evm_transaction(&tx);
        assert!(result.is_err());
        match result.unwrap_err() {
            WalletError::InvalidTransaction(msg) => {
                assert!(msg.contains("too high"));
            },
            _ => panic!("Expected InvalidTransaction error"),
        }
    }

    #[test]
    fn test_validate_valid_transaction() {
        let service = TransactionService::new();

        let tx = EvmTransaction {
            from: "0x742d35cc6634c0532925a3b844bc9e7595f0beb".to_string(),
            to: "0x742d35cc6634c0532925a3b844bc9e7595f0bec".to_string(),
            value: "1000000000000000000".to_string(),
            data: None,
            gas_limit: Some(21000),
            gas_price: Some("20000000000".to_string()),
            max_fee_per_gas: None,
            max_priority_fee_per_gas: None,
            nonce: None,
            chain_id: 1,
        };

        let result = service.validate_evm_transaction(&tx);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_insufficient_balance() {
        let service = TransactionService::new();

        let tx = EvmTransaction {
            from: "0x742d35cc6634c0532925a3b844bc9e7595f0beb".to_string(),
            to: "0x742d35cc6634c0532925a3b844bc9e7595f0bec".to_string(),
            value: "1000000000000000000".to_string(), // 1 ETH
            data: None,
            gas_limit: Some(21000),
            gas_price: Some("20000000000".to_string()), // 20 gwei
            max_fee_per_gas: None,
            max_priority_fee_per_gas: None,
            nonce: None,
            chain_id: 1,
        };

        let balance = Balance::new(
            TokenInfo::native("ETH".to_string(), "Ethereum".to_string(), 18),
            "500000000000000000".to_string(), // 0.5 ETH (insufficient)
            "0.5 ETH".to_string(),
        );

        let result = service.validate_balance(&tx, &balance);
        assert!(result.is_err());
        match result.unwrap_err() {
            WalletError::InsufficientBalance { need, have } => {
                assert!(need.parse::<u128>().unwrap() > have.parse::<u128>().unwrap());
            },
            _ => panic!("Expected InsufficientBalance error"),
        }
    }
}
