// ============================================================================
// Vaughan Wallet - EVM Network Configurations
// ============================================================================
//
// Predefined configurations for popular EVM-compatible networks.
// Makes it easy to add support for new EVM chains.
//
// ============================================================================

use serde::{Deserialize, Serialize};

/// EVM network configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvmNetworkConfig {
    /// Network identifier (e.g., "ethereum", "pulsechain")
    pub id: String,

    /// Human-readable name
    pub name: String,

    /// Chain ID
    pub chain_id: u64,

    /// RPC URL
    pub rpc_url: String,

    /// Block explorer URL (optional)
    pub explorer_url: Option<String>,

    /// Native token symbol
    pub native_symbol: String,

    /// Native token name
    pub native_name: String,

    /// Native token decimals (usually 18 for EVM)
    pub decimals: u8,
}

impl EvmNetworkConfig {
    /// Create a new network configuration
    pub fn new(
        id: String,
        name: String,
        chain_id: u64,
        rpc_url: String,
        native_symbol: String,
        native_name: String,
    ) -> Self {
        Self {
            id,
            name,
            chain_id,
            rpc_url,
            explorer_url: None,
            native_symbol,
            native_name,
            decimals: 18,
        }
    }

    /// Add block explorer URL
    pub fn with_explorer(mut self, explorer_url: String) -> Self {
        self.explorer_url = Some(explorer_url);
        self
    }
}

// ============================================================================
// Predefined Network Configurations
// ============================================================================

/// Get Ethereum Mainnet configuration
pub fn ethereum_mainnet() -> EvmNetworkConfig {
    EvmNetworkConfig::new(
        "ethereum".to_string(),
        "Ethereum Mainnet".to_string(),
        1,
        "https://eth.llamarpc.com".to_string(),
        "ETH".to_string(),
        "Ethereum".to_string(),
    )
    .with_explorer("https://etherscan.io".to_string())
}

/// Get PulseChain Mainnet configuration
pub fn pulsechain_mainnet() -> EvmNetworkConfig {
    EvmNetworkConfig::new(
        "pulsechain".to_string(),
        "PulseChain Mainnet".to_string(),
        369,
        "https://rpc.pulsechain.com".to_string(),
        "PLS".to_string(),
        "PulseChain".to_string(),
    )
    .with_explorer("https://scan.pulsechain.com".to_string())
}

/// Get Polygon Mainnet configuration
pub fn polygon_mainnet() -> EvmNetworkConfig {
    EvmNetworkConfig::new(
        "polygon".to_string(),
        "Polygon Mainnet".to_string(),
        137,
        "https://polygon-rpc.com".to_string(),
        "MATIC".to_string(),
        "Polygon".to_string(),
    )
    .with_explorer("https://polygonscan.com".to_string())
}

/// Get Binance Smart Chain Mainnet configuration
pub fn bsc_mainnet() -> EvmNetworkConfig {
    EvmNetworkConfig::new(
        "bsc".to_string(),
        "BSC Mainnet".to_string(),
        56,
        "https://bsc-dataseed.binance.org".to_string(),
        "BNB".to_string(),
        "Binance Coin".to_string(),
    )
    .with_explorer("https://bscscan.com".to_string())
}

/// Get Arbitrum One configuration
pub fn arbitrum_one() -> EvmNetworkConfig {
    EvmNetworkConfig::new(
        "arbitrum".to_string(),
        "Arbitrum One".to_string(),
        42161,
        "https://arb1.arbitrum.io/rpc".to_string(),
        "ETH".to_string(),
        "Ethereum".to_string(),
    )
    .with_explorer("https://arbiscan.io".to_string())
}

/// Get Optimism Mainnet configuration
pub fn optimism_mainnet() -> EvmNetworkConfig {
    EvmNetworkConfig::new(
        "optimism".to_string(),
        "Optimism Mainnet".to_string(),
        10,
        "https://mainnet.optimism.io".to_string(),
        "ETH".to_string(),
        "Ethereum".to_string(),
    )
    .with_explorer("https://optimistic.etherscan.io".to_string())
}

/// Get Avalanche C-Chain configuration
pub fn avalanche_cchain() -> EvmNetworkConfig {
    EvmNetworkConfig::new(
        "avalanche".to_string(),
        "Avalanche C-Chain".to_string(),
        43114,
        "https://api.avax.network/ext/bc/C/rpc".to_string(),
        "AVAX".to_string(),
        "Avalanche".to_string(),
    )
    .with_explorer("https://snowtrace.io".to_string())
}

/// Get Base Mainnet configuration
pub fn base_mainnet() -> EvmNetworkConfig {
    EvmNetworkConfig::new(
        "base".to_string(),
        "Base Mainnet".to_string(),
        8453,
        "https://mainnet.base.org".to_string(),
        "ETH".to_string(),
        "Ethereum".to_string(),
    )
    .with_explorer("https://basescan.org".to_string())
}

/// Get PulseChain Testnet V4 configuration
pub fn pulsechain_testnet_v4() -> EvmNetworkConfig {
    EvmNetworkConfig::new(
        "pulsechain-testnet-v4".to_string(),
        "PulseChain Testnet V4".to_string(),
        943,
        "https://rpc.v4.testnet.pulsechain.com".to_string(),
        "tPLS".to_string(),
        "Test PulseChain".to_string(),
    )
    .with_explorer("https://scan.v4.testnet.pulsechain.com".to_string())
}

// ============================================================================
// Network Registry
// ============================================================================

/// Get all predefined network configurations
pub fn all_networks() -> Vec<EvmNetworkConfig> {
    vec![
        ethereum_mainnet(),
        pulsechain_mainnet(),
        pulsechain_testnet_v4(),
        polygon_mainnet(),
        bsc_mainnet(),
        arbitrum_one(),
        optimism_mainnet(),
        avalanche_cchain(),
        base_mainnet(),
    ]
}

/// Get network configuration by ID
pub fn get_network(id: &str) -> Option<EvmNetworkConfig> {
    match id {
        "ethereum" => Some(ethereum_mainnet()),
        "pulsechain" => Some(pulsechain_mainnet()),
        "pulsechain-testnet-v4" => Some(pulsechain_testnet_v4()),
        "polygon" => Some(polygon_mainnet()),
        "bsc" => Some(bsc_mainnet()),
        "arbitrum" => Some(arbitrum_one()),
        "optimism" => Some(optimism_mainnet()),
        "avalanche" => Some(avalanche_cchain()),
        "base" => Some(base_mainnet()),
        _ => None,
    }
}

/// Get network configuration by chain ID
pub fn get_network_by_chain_id(chain_id: u64) -> Option<EvmNetworkConfig> {
    match chain_id {
        1 => Some(ethereum_mainnet()),
        369 => Some(pulsechain_mainnet()),
        943 => Some(pulsechain_testnet_v4()),
        137 => Some(polygon_mainnet()),
        56 => Some(bsc_mainnet()),
        42161 => Some(arbitrum_one()),
        10 => Some(optimism_mainnet()),
        43114 => Some(avalanche_cchain()),
        8453 => Some(base_mainnet()),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ethereum_config() {
        let config = ethereum_mainnet();
        assert_eq!(config.id, "ethereum");
        assert_eq!(config.chain_id, 1);
        assert_eq!(config.native_symbol, "ETH");
        assert!(config.explorer_url.is_some());
    }

    #[test]
    fn test_pulsechain_config() {
        let config = pulsechain_mainnet();
        assert_eq!(config.id, "pulsechain");
        assert_eq!(config.chain_id, 369);
        assert_eq!(config.native_symbol, "PLS");
    }

    #[test]
    fn test_get_network() {
        assert!(get_network("ethereum").is_some());
        assert!(get_network("pulsechain").is_some());
        assert!(get_network("unknown").is_none());
    }

    #[test]
    fn test_get_network_by_chain_id() {
        assert!(get_network_by_chain_id(1).is_some());
        assert!(get_network_by_chain_id(369).is_some());
        assert!(get_network_by_chain_id(999999).is_none());
    }

    #[test]
    fn test_all_networks() {
        let networks = all_networks();
        assert_eq!(networks.len(), 9);
    }
}
