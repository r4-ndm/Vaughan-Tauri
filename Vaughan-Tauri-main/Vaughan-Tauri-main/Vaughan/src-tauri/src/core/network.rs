//! Network Service - Chain-agnostic network management
//!
//! This service provides network management functionality that works across
//! all blockchain types using the ChainAdapter trait.
//!
//! ## Design Principles
//!
//! 1. **Chain-Agnostic**: Works with any ChainAdapter implementation
//! 2. **Stateless**: No internal state, receives adapter as parameter
//! 3. **Configuration**: Predefined and custom network support
//! 4. **Validation**: Comprehensive network config validation
//!
//! ## Example
//!
//! ```rust,no_run
//! use vaughan::core::NetworkService;
//! use vaughan::chains::ChainAdapter;
//!
//! # async fn example(adapter: &dyn ChainAdapter) -> Result<(), Box<dyn std::error::Error>> {
//! let service = NetworkService::new();
//!
//! // Check network health
//! let is_healthy = service.check_health(adapter).await?;
//! println!("Network healthy: {}", is_healthy);
//!
//! // Get network info
//! let info = service.get_network_info(adapter).await?;
//! println!("Network: {}", info.name);
//! # Ok(())
//! # }
//! ```

use crate::chains::{Balance, ChainAdapter, ChainInfo, ChainType};
use crate::error::WalletError;
use serde::{Deserialize, Serialize};
use url::Url;

/// Network configuration
///
/// Defines all information needed to connect to and interact with a blockchain network.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NetworkConfig {
    /// Unique network identifier (e.g., "ethereum", "pulsechain")
    pub id: String,

    /// Human-readable network name (e.g., "Ethereum Mainnet")
    pub name: String,

    /// Chain type (EVM, Stellar, Aptos, etc.)
    pub chain_type: ChainType,

    /// Chain ID (for EVM chains, this is the EIP-155 chain ID)
    pub chain_id: u64,

    /// RPC endpoint URL
    pub rpc_url: String,

    /// Block explorer URL (optional)
    pub explorer_url: Option<String>,

    /// Native token information
    pub native_token: TokenInfo,

    /// Whether this is a testnet
    pub is_testnet: bool,
}

/// Token information
///
/// Describes a token's basic properties.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TokenInfo {
    /// Token symbol (e.g., "ETH", "PLS")
    pub symbol: String,

    /// Token name (e.g., "Ether", "Pulse")
    pub name: String,

    /// Number of decimals (typically 18 for EVM chains)
    pub decimals: u8,
}

/// Extended network information
///
/// Combines static configuration with dynamic network state.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkInfo {
    /// Network configuration
    pub config: NetworkConfig,

    /// Chain information from adapter
    pub chain_info: ChainInfo,

    /// Network health status
    pub is_healthy: bool,
}

/// Network service - chain-agnostic network management
///
/// This service provides network management functionality without storing
/// any state. All operations receive a ChainAdapter as a parameter.
pub struct NetworkService;

impl NetworkService {
    /// Create a new network service
    pub fn new() -> Self {
        Self
    }

    /// Get comprehensive network information
    ///
    /// Combines static configuration with dynamic network state.
    ///
    /// # Arguments
    ///
    /// * `adapter` - Chain adapter for the network
    ///
    /// # Returns
    ///
    /// * `Ok(NetworkInfo)` - Network information
    /// * `Err(WalletError)` - Network error
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use vaughan::core::NetworkService;
    /// # use vaughan::chains::ChainAdapter;
    /// # async fn example(adapter: &dyn ChainAdapter) -> Result<(), Box<dyn std::error::Error>> {
    /// let service = NetworkService::new();
    /// let info = service.get_network_info(adapter).await?;
    /// println!("Connected to: {}", info.config.name);
    /// # Ok(())
    /// # }
    /// ```
    pub async fn get_network_info(
        &self,
        adapter: &dyn ChainAdapter,
    ) -> Result<NetworkInfo, WalletError> {
        // Get chain info from adapter (not async, returns ChainInfo directly)
        let chain_info = adapter.chain_info();

        // Check health
        let is_healthy = self.check_health(adapter).await?;

        // Build network config from chain info
        // Note: In production, this would come from VaughanState
        let config = NetworkConfig {
            id: format!("chain_{}", chain_info.chain_id.unwrap_or(0)),
            name: chain_info.name.clone(),
            chain_type: adapter.chain_type(),
            chain_id: chain_info.chain_id.unwrap_or(0),
            rpc_url: String::new(), // Would come from state
            explorer_url: chain_info.explorer_url.clone(),
            native_token: TokenInfo {
                symbol: chain_info.native_token.symbol.clone(),
                name: chain_info.native_token.name.clone(),
                decimals: chain_info.native_token.decimals,
            },
            is_testnet: false, // Would be determined from chain_id
        };

        Ok(NetworkInfo {
            config,
            chain_info,
            is_healthy,
        })
    }

    /// Check network health
    ///
    /// Verifies that the network is responsive by attempting to fetch
    /// basic information.
    ///
    /// # Arguments
    ///
    /// * `adapter` - Chain adapter for the network
    ///
    /// # Returns
    ///
    /// * `Ok(true)` - Network is healthy
    /// * `Ok(false)` - Network is unhealthy
    /// * `Err(WalletError)` - Error checking health
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use vaughan::core::NetworkService;
    /// # use vaughan::chains::ChainAdapter;
    /// # async fn example(adapter: &dyn ChainAdapter) -> Result<(), Box<dyn std::error::Error>> {
    /// let service = NetworkService::new();
    /// if service.check_health(adapter).await? {
    ///     println!("Network is healthy");
    /// }
    /// # Ok(())
    /// # }
    /// ```
    pub async fn check_health(&self, adapter: &dyn ChainAdapter) -> Result<bool, WalletError> {
        // Try to get balance for zero address as a health check
        // This verifies the RPC is responsive
        match adapter
            .get_balance("0x0000000000000000000000000000000000000000")
            .await
        {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }

    /// Get balance for an address
    ///
    /// Convenience method that delegates to the adapter.
    ///
    /// # Arguments
    ///
    /// * `adapter` - Chain adapter for the network
    /// * `address` - Address to check balance for
    ///
    /// # Returns
    ///
    /// * `Ok(Balance)` - Account balance
    /// * `Err(WalletError)` - Network error
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use vaughan::core::NetworkService;
    /// # use vaughan::chains::ChainAdapter;
    /// # async fn example(adapter: &dyn ChainAdapter) -> Result<(), Box<dyn std::error::Error>> {
    /// let service = NetworkService::new();
    /// let balance = service.get_balance(
    ///     adapter,
    ///     "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
    /// ).await?;
    /// println!("Balance: {}", balance.value);
    /// # Ok(())
    /// # }
    /// ```
    pub async fn get_balance(
        &self,
        adapter: &dyn ChainAdapter,
        address: &str,
    ) -> Result<Balance, WalletError> {
        adapter.get_balance(address).await
    }

    /// Validate network configuration
    ///
    /// Checks that a network configuration is valid before use.
    ///
    /// # Arguments
    ///
    /// * `config` - Network configuration to validate
    ///
    /// # Returns
    ///
    /// * `Ok(())` - Configuration is valid
    /// * `Err(WalletError)` - Configuration is invalid
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use vaughan::core::{NetworkService, NetworkConfig, TokenInfo};
    /// # use vaughan::chains::ChainType;
    /// # fn example() -> Result<(), Box<dyn std::error::Error>> {
    /// let service = NetworkService::new();
    /// let config = NetworkConfig {
    ///     id: "ethereum".to_string(),
    ///     name: "Ethereum".to_string(),
    ///     chain_type: ChainType::Evm,
    ///     chain_id: 1,
    ///     rpc_url: "https://eth.llamarpc.com".to_string(),
    ///     explorer_url: Some("https://etherscan.io".to_string()),
    ///     native_token: TokenInfo {
    ///         symbol: "ETH".to_string(),
    ///         name: "Ether".to_string(),
    ///         decimals: 18,
    ///     },
    ///     is_testnet: false,
    /// };
    /// service.validate_network_config(&config)?;
    /// # Ok(())
    /// # }
    /// ```
    pub fn validate_network_config(&self, config: &NetworkConfig) -> Result<(), WalletError> {
        // Validate RPC URL
        Url::parse(&config.rpc_url)
            .map_err(|e| WalletError::InvalidNetwork(format!("Invalid RPC URL: {}", e)))?;

        // Validate explorer URL if present
        if let Some(ref explorer) = config.explorer_url {
            Url::parse(explorer)
                .map_err(|e| WalletError::InvalidNetwork(format!("Invalid explorer URL: {}", e)))?;
        }

        // Validate chain ID
        if config.chain_id == 0 {
            return Err(WalletError::InvalidNetwork(
                "Chain ID cannot be 0".to_string(),
            ));
        }

        // Validate network ID
        if config.id.is_empty() {
            return Err(WalletError::InvalidNetwork(
                "Network ID cannot be empty".to_string(),
            ));
        }

        // Validate network name
        if config.name.is_empty() {
            return Err(WalletError::InvalidNetwork(
                "Network name cannot be empty".to_string(),
            ));
        }

        // Validate token info
        if config.native_token.symbol.is_empty() {
            return Err(WalletError::InvalidNetwork(
                "Token symbol cannot be empty".to_string(),
            ));
        }

        if config.native_token.decimals > 30 {
            return Err(WalletError::InvalidNetwork(
                "Token decimals cannot exceed 30".to_string(),
            ));
        }

        Ok(())
    }

    /// Get predefined network configurations
    ///
    /// Returns a list of well-known networks that are pre-configured.
    ///
    /// # Returns
    ///
    /// Vector of predefined network configurations
    ///
    /// # Example
    ///
    /// ```rust
    /// # use vaughan::core::NetworkService;
    /// let service = NetworkService::new();
    /// let networks = service.get_predefined_networks();
    /// for network in networks {
    ///     println!("Network: {} (Chain ID: {})", network.name, network.chain_id);
    /// }
    /// ```
    pub fn get_predefined_networks(&self) -> Vec<NetworkConfig> {
        vec![
            // Ethereum Mainnet
            NetworkConfig {
                id: "ethereum".to_string(),
                name: "Ethereum Mainnet".to_string(),
                chain_type: ChainType::Evm,
                chain_id: 1,
                rpc_url: "https://eth.llamarpc.com".to_string(),
                explorer_url: Some("https://etherscan.io".to_string()),
                native_token: TokenInfo {
                    symbol: "ETH".to_string(),
                    name: "Ether".to_string(),
                    decimals: 18,
                },
                is_testnet: false,
            },
            // PulseChain
            NetworkConfig {
                id: "pulsechain".to_string(),
                name: "PulseChain".to_string(),
                chain_type: ChainType::Evm,
                chain_id: 369,
                rpc_url: "https://rpc.pulsechain.com".to_string(),
                explorer_url: Some("https://scan.pulsechain.com".to_string()),
                native_token: TokenInfo {
                    symbol: "PLS".to_string(),
                    name: "Pulse".to_string(),
                    decimals: 18,
                },
                is_testnet: false,
            },
            // Polygon
            NetworkConfig {
                id: "polygon".to_string(),
                name: "Polygon".to_string(),
                chain_type: ChainType::Evm,
                chain_id: 137,
                rpc_url: "https://polygon-rpc.com".to_string(),
                explorer_url: Some("https://polygonscan.com".to_string()),
                native_token: TokenInfo {
                    symbol: "MATIC".to_string(),
                    name: "Matic".to_string(),
                    decimals: 18,
                },
                is_testnet: false,
            },
            // Binance Smart Chain
            NetworkConfig {
                id: "bsc".to_string(),
                name: "BNB Smart Chain".to_string(),
                chain_type: ChainType::Evm,
                chain_id: 56,
                rpc_url: "https://bsc-dataseed.binance.org".to_string(),
                explorer_url: Some("https://bscscan.com".to_string()),
                native_token: TokenInfo {
                    symbol: "BNB".to_string(),
                    name: "BNB".to_string(),
                    decimals: 18,
                },
                is_testnet: false,
            },
            // Arbitrum One
            NetworkConfig {
                id: "arbitrum".to_string(),
                name: "Arbitrum One".to_string(),
                chain_type: ChainType::Evm,
                chain_id: 42161,
                rpc_url: "https://arb1.arbitrum.io/rpc".to_string(),
                explorer_url: Some("https://arbiscan.io".to_string()),
                native_token: TokenInfo {
                    symbol: "ETH".to_string(),
                    name: "Ether".to_string(),
                    decimals: 18,
                },
                is_testnet: false,
            },
            // Optimism
            NetworkConfig {
                id: "optimism".to_string(),
                name: "Optimism".to_string(),
                chain_type: ChainType::Evm,
                chain_id: 10,
                rpc_url: "https://mainnet.optimism.io".to_string(),
                explorer_url: Some("https://optimistic.etherscan.io".to_string()),
                native_token: TokenInfo {
                    symbol: "ETH".to_string(),
                    name: "Ether".to_string(),
                    decimals: 18,
                },
                is_testnet: false,
            },
            // Avalanche C-Chain
            NetworkConfig {
                id: "avalanche".to_string(),
                name: "Avalanche C-Chain".to_string(),
                chain_type: ChainType::Evm,
                chain_id: 43114,
                rpc_url: "https://api.avax.network/ext/bc/C/rpc".to_string(),
                explorer_url: Some("https://snowtrace.io".to_string()),
                native_token: TokenInfo {
                    symbol: "AVAX".to_string(),
                    name: "Avalanche".to_string(),
                    decimals: 18,
                },
                is_testnet: false,
            },
            // Base
            NetworkConfig {
                id: "base".to_string(),
                name: "Base".to_string(),
                chain_type: ChainType::Evm,
                chain_id: 8453,
                rpc_url: "https://mainnet.base.org".to_string(),
                explorer_url: Some("https://basescan.org".to_string()),
                native_token: TokenInfo {
                    symbol: "ETH".to_string(),
                    name: "Ether".to_string(),
                    decimals: 18,
                },
                is_testnet: false,
            },
        ]
    }

    /// Find network configuration by chain ID
    ///
    /// Searches predefined networks for a matching chain ID.
    ///
    /// # Arguments
    ///
    /// * `chain_id` - Chain ID to search for
    ///
    /// # Returns
    ///
    /// * `Some(NetworkConfig)` - Found network configuration
    /// * `None` - No matching network found
    pub fn find_network_by_chain_id(&self, chain_id: u64) -> Option<NetworkConfig> {
        self.get_predefined_networks()
            .into_iter()
            .find(|config| config.chain_id == chain_id)
    }

    /// Find network configuration by ID
    ///
    /// Searches predefined networks for a matching network ID.
    ///
    /// # Arguments
    ///
    /// * `id` - Network ID to search for
    ///
    /// # Returns
    ///
    /// * `Some(NetworkConfig)` - Found network configuration
    /// * `None` - No matching network found
    pub fn find_network_by_id(&self, id: &str) -> Option<NetworkConfig> {
        self.get_predefined_networks()
            .into_iter()
            .find(|config| config.id == id)
    }
}

impl Default for NetworkService {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_valid_config() {
        let service = NetworkService::new();
        let config = NetworkConfig {
            id: "ethereum".to_string(),
            name: "Ethereum".to_string(),
            chain_type: ChainType::Evm,
            chain_id: 1,
            rpc_url: "https://eth.llamarpc.com".to_string(),
            explorer_url: Some("https://etherscan.io".to_string()),
            native_token: TokenInfo {
                symbol: "ETH".to_string(),
                name: "Ether".to_string(),
                decimals: 18,
            },
            is_testnet: false,
        };

        assert!(service.validate_network_config(&config).is_ok());
    }

    #[test]
    fn test_validate_invalid_rpc_url() {
        let service = NetworkService::new();
        let config = NetworkConfig {
            id: "ethereum".to_string(),
            name: "Ethereum".to_string(),
            chain_type: ChainType::Evm,
            chain_id: 1,
            rpc_url: "not-a-valid-url".to_string(),
            explorer_url: None,
            native_token: TokenInfo {
                symbol: "ETH".to_string(),
                name: "Ether".to_string(),
                decimals: 18,
            },
            is_testnet: false,
        };

        assert!(service.validate_network_config(&config).is_err());
    }

    #[test]
    fn test_validate_zero_chain_id() {
        let service = NetworkService::new();
        let config = NetworkConfig {
            id: "test".to_string(),
            name: "Test".to_string(),
            chain_type: ChainType::Evm,
            chain_id: 0,
            rpc_url: "https://test.com".to_string(),
            explorer_url: None,
            native_token: TokenInfo {
                symbol: "TEST".to_string(),
                name: "Test".to_string(),
                decimals: 18,
            },
            is_testnet: false,
        };

        assert!(service.validate_network_config(&config).is_err());
    }

    #[test]
    fn test_validate_empty_network_id() {
        let service = NetworkService::new();
        let config = NetworkConfig {
            id: String::new(),
            name: "Test".to_string(),
            chain_type: ChainType::Evm,
            chain_id: 1,
            rpc_url: "https://test.com".to_string(),
            explorer_url: None,
            native_token: TokenInfo {
                symbol: "TEST".to_string(),
                name: "Test".to_string(),
                decimals: 18,
            },
            is_testnet: false,
        };

        assert!(service.validate_network_config(&config).is_err());
    }

    #[test]
    fn test_validate_excessive_decimals() {
        let service = NetworkService::new();
        let config = NetworkConfig {
            id: "test".to_string(),
            name: "Test".to_string(),
            chain_type: ChainType::Evm,
            chain_id: 1,
            rpc_url: "https://test.com".to_string(),
            explorer_url: None,
            native_token: TokenInfo {
                symbol: "TEST".to_string(),
                name: "Test".to_string(),
                decimals: 31, // Too many decimals
            },
            is_testnet: false,
        };

        assert!(service.validate_network_config(&config).is_err());
    }

    #[test]
    fn test_get_predefined_networks() {
        let service = NetworkService::new();
        let networks = service.get_predefined_networks();

        // Should have at least 8 networks
        assert!(networks.len() >= 8);

        // Check Ethereum is present
        assert!(networks.iter().any(|n| n.id == "ethereum"));

        // Check PulseChain is present
        assert!(networks.iter().any(|n| n.id == "pulsechain"));
    }

    #[test]
    fn test_find_network_by_chain_id() {
        let service = NetworkService::new();

        // Find Ethereum (chain ID 1)
        let ethereum = service.find_network_by_chain_id(1);
        assert!(ethereum.is_some());
        assert_eq!(ethereum.unwrap().id, "ethereum");

        // Find PulseChain (chain ID 369)
        let pulsechain = service.find_network_by_chain_id(369);
        assert!(pulsechain.is_some());
        assert_eq!(pulsechain.unwrap().id, "pulsechain");

        // Non-existent chain ID
        let unknown = service.find_network_by_chain_id(999999);
        assert!(unknown.is_none());
    }

    #[test]
    fn test_find_network_by_id() {
        let service = NetworkService::new();

        // Find Ethereum
        let ethereum = service.find_network_by_id("ethereum");
        assert!(ethereum.is_some());
        assert_eq!(ethereum.unwrap().chain_id, 1);

        // Find PulseChain
        let pulsechain = service.find_network_by_id("pulsechain");
        assert!(pulsechain.is_some());
        assert_eq!(pulsechain.unwrap().chain_id, 369);

        // Non-existent ID
        let unknown = service.find_network_by_id("unknown");
        assert!(unknown.is_none());
    }

    #[test]
    fn test_all_predefined_networks_valid() {
        let service = NetworkService::new();
        let networks = service.get_predefined_networks();

        // All predefined networks should pass validation
        for network in networks {
            assert!(
                service.validate_network_config(&network).is_ok(),
                "Network {} failed validation",
                network.id
            );
        }
    }
}
