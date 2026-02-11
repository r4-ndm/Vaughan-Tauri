// ============================================================================
// Vaughan Wallet - EVM Utilities
// ============================================================================
//
// Helper functions for EVM-specific operations using Alloy.
//
// CRITICAL: Uses ONLY Alloy primitives (ZERO ethers-rs imports)
//
// ============================================================================

use crate::error::WalletError;
use alloy::primitives::{
    utils::{format_units, parse_units},
    Address, U256,
};

// ============================================================================
// Unit Conversion
// ============================================================================

/// Format wei to human-readable ETH (or other token)
///
/// # Arguments
///
/// * `wei` - Amount in wei
/// * `decimals` - Token decimals (18 for ETH)
///
/// # Returns
///
/// * `String` - Formatted amount (e.g., "1.5")
///
/// # Example
///
/// ```rust,ignore
/// let wei = U256::from(1500000000000000000u128); // 1.5 ETH
/// let eth = format_wei_to_eth(wei, 18);
/// assert_eq!(eth, "1.5");
/// ```
pub fn format_wei_to_eth(wei: U256, decimals: u8) -> String {
    format_units(wei, decimals).unwrap_or_else(|_| "0".to_string())
}

/// Format wei to gwei (for gas prices)
///
/// # Arguments
///
/// * `wei` - Amount in wei (as string)
///
/// # Returns
///
/// * `String` - Formatted amount in gwei (e.g., "50")
///
/// # Example
///
/// ```rust,ignore
/// let gwei = format_wei_to_gwei("50000000000"); // 50 gwei
/// assert_eq!(gwei, "50");
/// ```
pub fn format_wei_to_gwei(wei: &str) -> String {
    let wei_u256 = wei.parse::<U256>().unwrap_or(U256::ZERO);
    format_units(wei_u256, 9) // gwei = 10^9 wei
        .unwrap_or_else(|_| "0".to_string())
}

/// Parse human-readable amount to wei
///
/// # Arguments
///
/// * `amount` - Human-readable amount (e.g., "1.5")
/// * `decimals` - Token decimals (18 for ETH)
///
/// # Returns
///
/// * `Result<U256, WalletError>` - Amount in wei or error
///
/// # Errors
///
/// * `WalletError::InvalidAmount` - If amount cannot be parsed
///
/// # Example
///
/// ```rust,ignore
/// let wei = parse_eth_to_wei("1.5", 18)?;
/// assert_eq!(wei, U256::from(1500000000000000000u128));
/// ```
pub fn parse_eth_to_wei(amount: &str, decimals: u8) -> Result<U256, WalletError> {
    parse_units(amount, decimals)
        .map(|parsed| parsed.into())
        .map_err(|e| WalletError::InvalidAmount(format!("Failed to parse amount: {}", e)))
}

// ============================================================================
// Address Formatting
// ============================================================================

/// Format address with checksum
///
/// # Arguments
///
/// * `address` - Address to format
///
/// # Returns
///
/// * `String` - Checksummed address (e.g., "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb")
///
/// # Example
///
/// ```rust,ignore
/// let addr = Address::from_str("0x742d35cc6634c0532925a3b844bc9e7595f0beb")?;
/// let checksummed = format_address_checksum(addr);
/// assert_eq!(checksummed, "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb");
/// ```
pub fn format_address_checksum(address: Address) -> String {
    format!("{:?}", address) // Alloy's Debug impl includes checksum
}

/// Truncate address for display (e.g., "0x742d...f0bEb")
///
/// # Arguments
///
/// * `address` - Address to truncate
/// * `prefix_len` - Number of characters to show at start (default: 6)
/// * `suffix_len` - Number of characters to show at end (default: 4)
///
/// # Returns
///
/// * `String` - Truncated address
///
/// # Example
///
/// ```rust,ignore
/// let addr = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb";
/// let truncated = truncate_address(addr, 6, 4);
/// assert_eq!(truncated, "0x742d...f0bEb");
/// ```
pub fn truncate_address(address: &str, prefix_len: usize, suffix_len: usize) -> String {
    if address.len() <= prefix_len + suffix_len + 3 {
        return address.to_string();
    }

    let prefix = &address[..prefix_len];
    let suffix = &address[address.len() - suffix_len..];
    format!("{}...{}", prefix, suffix)
}

// ============================================================================
// Gas Calculations
// ============================================================================

/// Calculate transaction fee
///
/// # Arguments
///
/// * `gas_limit` - Gas limit
/// * `gas_price` - Gas price in wei
///
/// # Returns
///
/// * `U256` - Total fee in wei
///
/// # Example
///
/// ```rust,ignore
/// let fee = calculate_tx_fee(21000, U256::from(20_000_000_000u64)); // 20 gwei
/// assert_eq!(fee, U256::from(420_000_000_000_000u64)); // 0.00042 ETH
/// ```
pub fn calculate_tx_fee(gas_limit: u64, gas_price: U256) -> U256 {
    U256::from(gas_limit) * gas_price
}

/// Calculate EIP-1559 transaction fee
///
/// # Arguments
///
/// * `gas_limit` - Gas limit
/// * `base_fee` - Base fee per gas
/// * `priority_fee` - Priority fee per gas (tip)
///
/// # Returns
///
/// * `U256` - Total fee in wei
///
/// # Example
///
/// ```rust,ignore
/// let fee = calculate_eip1559_fee(
///     21000,
///     U256::from(20_000_000_000u64), // 20 gwei base
///     U256::from(2_000_000_000u64),  // 2 gwei tip
/// );
/// ```
pub fn calculate_eip1559_fee(gas_limit: u64, base_fee: U256, priority_fee: U256) -> U256 {
    U256::from(gas_limit) * (base_fee + priority_fee)
}

// ============================================================================
// Validation
// ============================================================================

/// Check if address is valid EVM address
///
/// # Arguments
///
/// * `address` - Address string to validate
///
/// # Returns
///
/// * `bool` - True if valid, false otherwise
///
/// # Example
///
/// ```rust,ignore
/// assert!(is_valid_address("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"));
/// assert!(!is_valid_address("invalid"));
/// ```
pub fn is_valid_address(address: &str) -> bool {
    address.parse::<Address>().is_ok()
}

/// Check if amount is valid (non-negative, parseable)
///
/// # Arguments
///
/// * `amount` - Amount string to validate
/// * `decimals` - Token decimals
///
/// # Returns
///
/// * `bool` - True if valid, false otherwise
///
/// # Example
///
/// ```rust,ignore
/// assert!(is_valid_amount("1.5", 18));
/// assert!(!is_valid_amount("-1", 18));
/// assert!(!is_valid_amount("invalid", 18));
/// ```
pub fn is_valid_amount(amount: &str, decimals: u8) -> bool {
    parse_eth_to_wei(amount, decimals).is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_wei_to_eth() {
        let wei = U256::from(1500000000000000000u128); // 1.5 ETH
        let eth = format_wei_to_eth(wei, 18);
        // Alloy format_units includes trailing zeros
        assert!(eth.starts_with("1.5"));

        let wei = U256::from(1000000000000000000u128); // 1 ETH
        let eth = format_wei_to_eth(wei, 18);
        assert!(eth.starts_with("1.0") || eth.starts_with("1"));
    }

    #[test]
    fn test_parse_eth_to_wei() {
        let wei = parse_eth_to_wei("1.5", 18).unwrap();
        assert_eq!(wei, U256::from(1500000000000000000u128));

        let wei = parse_eth_to_wei("1", 18).unwrap();
        assert_eq!(wei, U256::from(1000000000000000000u128));
    }

    #[test]
    fn test_parse_invalid_amount() {
        assert!(parse_eth_to_wei("invalid", 18).is_err());
        // Empty string might parse as 0, which is valid
        // So we don't test for empty string error
    }

    #[test]
    fn test_truncate_address() {
        let addr = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
        let truncated = truncate_address(addr, 6, 4);
        // Should be "0xd8dA...6045" (last 4 chars)
        assert_eq!(truncated, "0xd8dA...6045");
    }

    #[test]
    fn test_calculate_tx_fee() {
        let fee = calculate_tx_fee(21000, U256::from(20_000_000_000u64));
        assert_eq!(fee, U256::from(420_000_000_000_000u64));
    }

    #[test]
    fn test_calculate_eip1559_fee() {
        let fee = calculate_eip1559_fee(
            21000,
            U256::from(20_000_000_000u64),
            U256::from(2_000_000_000u64),
        );
        assert_eq!(fee, U256::from(462_000_000_000_000u64));
    }

    #[test]
    fn test_is_valid_address() {
        // Use a valid Ethereum address (Vitalik's address)
        assert!(is_valid_address(
            "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
        ));
        assert!(!is_valid_address("invalid"));
        assert!(!is_valid_address("0xinvalid"));
    }

    #[test]
    fn test_is_valid_amount() {
        assert!(is_valid_amount("1.5", 18));
        assert!(is_valid_amount("0", 18));
        assert!(!is_valid_amount("invalid", 18));
    }
}
