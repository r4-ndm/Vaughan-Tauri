//! Price Service - Token price fetching
//!
//! This service provides token price fetching from external APIs.
//! Caching is handled by the state layer (VaughanState).
//!
//! ## Design Principles
//!
//! 1. **Stateless**: No internal caching, pure HTTP client
//! 2. **Chain-Agnostic**: Works with any ChainType
//! 3. **Simple**: Just fetches prices, state layer handles caching
//! 4. **Extensible**: Easy to add more price sources
//!
//! ## Example
//!
//! ```rust,no_run
//! use vaughan::core::PriceService;
//! use vaughan::chains::ChainType;
//!
//! # async fn example() -> Result<(), Box<dyn std::error::Error>> {
//! let service = PriceService::new();
//!
//! // Fetch ETH price
//! let eth_price = service.fetch_native_price(ChainType::Evm, 1).await?;
//! println!("ETH: ${:.2}", eth_price);
//! # Ok(())
//! # }
//! ```

use crate::chains::ChainType;
use crate::error::WalletError;
use std::time::Duration;

/// Price service - fetches token prices from external APIs
///
/// This service is stateless and only handles HTTP requests.
/// Caching should be handled by the state layer.
pub struct PriceService {
    /// HTTP client for API requests
    client: reqwest::Client,
}

impl PriceService {
    /// Create a new price service
    ///
    /// # Example
    ///
    /// ```rust
    /// # use vaughan::core::PriceService;
    /// let service = PriceService::new();
    /// ```
    pub fn new() -> Self {
        Self {
            // Note: reqwest::Client::builder().build() only fails if TLS backend
            // initialization fails, which is extremely rare and indicates a broken
            // system. Using unwrap here is acceptable as there's no recovery path.
            client: reqwest::Client::builder()
                .timeout(Duration::from_secs(10))
                .build()
                .unwrap_or_else(|_| reqwest::Client::new()),
        }
    }

    /// Fetch native token price in USD
    ///
    /// Fetches the price of the native token for a given chain from CoinGecko.
    ///
    /// # Arguments
    ///
    /// * `chain_type` - Type of blockchain
    /// * `chain_id` - Chain ID (for EVM: 1 = Ethereum, 137 = Polygon, etc.)
    ///
    /// # Returns
    ///
    /// * `Ok(f64)` - Price in USD
    /// * `Err(WalletError)` - Network error or unsupported chain
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use vaughan::core::PriceService;
    /// # use vaughan::chains::ChainType;
    /// # async fn example() -> Result<(), Box<dyn std::error::Error>> {
    /// let service = PriceService::new();
    /// let eth_price = service.fetch_native_price(ChainType::Evm, 1).await?;
    /// println!("ETH: ${:.2}", eth_price);
    /// # Ok(())
    /// # }
    /// ```
    pub async fn fetch_native_price(
        &self,
        chain_type: ChainType,
        chain_id: u64,
    ) -> Result<f64, WalletError> {
        match chain_type {
            ChainType::Evm => self.fetch_evm_native_price(chain_id).await,
            _ => Err(WalletError::ChainNotSupported(format!(
                "Price fetching not supported for {:?}",
                chain_type
            ))),
        }
    }

    /// Fetch ERC20 token price in USD
    ///
    /// Fetches the price of an ERC20 token from CoinGecko.
    ///
    /// # Arguments
    ///
    /// * `chain_type` - Type of blockchain
    /// * `chain_id` - Chain ID
    /// * `token_address` - Token contract address
    ///
    /// # Returns
    ///
    /// * `Ok(f64)` - Price in USD
    /// * `Err(WalletError)` - Network error or token not found
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use vaughan::core::PriceService;
    /// # use vaughan::chains::ChainType;
    /// # async fn example() -> Result<(), Box<dyn std::error::Error>> {
    /// let service = PriceService::new();
    /// // USDC on Ethereum
    /// let usdc_price = service.fetch_token_price(
    ///     ChainType::Evm,
    ///     1,
    ///     "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
    /// ).await?;
    /// println!("USDC: ${:.2}", usdc_price);
    /// # Ok(())
    /// # }
    /// ```
    pub async fn fetch_token_price(
        &self,
        chain_type: ChainType,
        chain_id: u64,
        token_address: &str,
    ) -> Result<f64, WalletError> {
        match chain_type {
            ChainType::Evm => self.fetch_evm_token_price(chain_id, token_address).await,
            _ => Err(WalletError::ChainNotSupported(format!(
                "Price fetching not supported for {:?}",
                chain_type
            ))),
        }
    }

    /// Fetch EVM native token price from CoinGecko
    async fn fetch_evm_native_price(&self, chain_id: u64) -> Result<f64, WalletError> {
        let coin_id = Self::get_coingecko_coin_id(chain_id).ok_or_else(|| {
            WalletError::ChainNotSupported(format!("Unsupported chain ID: {}", chain_id))
        })?;

        let url = format!(
            "https://api.coingecko.com/api/v3/simple/price?ids={}&vs_currencies=usd",
            coin_id
        );

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| WalletError::NetworkError(format!("Failed to fetch price: {}", e)))?;

        if !response.status().is_success() {
            return Err(WalletError::NetworkError(format!(
                "API error: {}",
                response.status()
            )));
        }

        // Parse response
        let data: serde_json::Value = response
            .json()
            .await
            .map_err(|e| WalletError::ParseError(format!("Failed to parse response: {}", e)))?;

        let price_usd = data
            .get(coin_id)
            .and_then(|v| v.get("usd"))
            .and_then(|v| v.as_f64())
            .ok_or_else(|| WalletError::ParseError("Invalid price data".to_string()))?;

        Ok(price_usd)
    }

    /// Fetch EVM token price from CoinGecko
    async fn fetch_evm_token_price(
        &self,
        chain_id: u64,
        token_address: &str,
    ) -> Result<f64, WalletError> {
        let platform_id = Self::get_coingecko_platform_id(chain_id).ok_or_else(|| {
            WalletError::ChainNotSupported(format!("Unsupported chain ID: {}", chain_id))
        })?;

        let url = format!(
            "https://api.coingecko.com/api/v3/simple/token_price/{}?contract_addresses={}&vs_currencies=usd",
            platform_id,
            token_address.to_lowercase()
        );

        let response = self.client.get(&url).send().await.map_err(|e| {
            WalletError::NetworkError(format!("Failed to fetch token price: {}", e))
        })?;

        if !response.status().is_success() {
            return Err(WalletError::NetworkError(format!(
                "API error: {}",
                response.status()
            )));
        }

        // Parse response
        let data: serde_json::Value = response
            .json()
            .await
            .map_err(|e| WalletError::ParseError(format!("Failed to parse response: {}", e)))?;

        let address_str = token_address.to_lowercase();
        let price_usd = data
            .get(&address_str)
            .and_then(|v| v.get("usd"))
            .and_then(|v| v.as_f64())
            .ok_or_else(|| WalletError::ParseError("Token price not found".to_string()))?;

        Ok(price_usd)
    }

    /// Get CoinGecko coin ID for native tokens
    ///
    /// Maps chain IDs to CoinGecko coin identifiers.
    fn get_coingecko_coin_id(chain_id: u64) -> Option<&'static str> {
        match chain_id {
            1 => Some("ethereum"),
            137 => Some("matic-network"),
            56 => Some("binancecoin"),
            369 => Some("pulsechain"),
            42161 => Some("ethereum"), // Arbitrum uses ETH
            10 => Some("ethereum"),    // Optimism uses ETH
            43114 => Some("avalanche-2"),
            8453 => Some("ethereum"), // Base uses ETH
            _ => None,
        }
    }

    /// Get CoinGecko platform ID for ERC20 tokens
    ///
    /// Maps chain IDs to CoinGecko platform identifiers.
    fn get_coingecko_platform_id(chain_id: u64) -> Option<&'static str> {
        match chain_id {
            1 => Some("ethereum"),
            137 => Some("polygon-pos"),
            56 => Some("binance-smart-chain"),
            369 => Some("pulsechain"),
            42161 => Some("arbitrum-one"),
            10 => Some("optimistic-ethereum"),
            43114 => Some("avalanche"),
            8453 => Some("base"),
            _ => None,
        }
    }
}

impl Default for PriceService {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_price_service_creation() {
        let service = PriceService::new();
        // Just verify it creates successfully
        assert!(std::ptr::addr_of!(service.client) as usize != 0);
    }

    #[test]
    fn test_coingecko_coin_id_mapping() {
        assert_eq!(PriceService::get_coingecko_coin_id(1), Some("ethereum"));
        assert_eq!(
            PriceService::get_coingecko_coin_id(137),
            Some("matic-network")
        );
        assert_eq!(PriceService::get_coingecko_coin_id(56), Some("binancecoin"));
        assert_eq!(PriceService::get_coingecko_coin_id(369), Some("pulsechain"));
        assert_eq!(PriceService::get_coingecko_coin_id(42161), Some("ethereum")); // Arbitrum
        assert_eq!(PriceService::get_coingecko_coin_id(10), Some("ethereum")); // Optimism
        assert_eq!(
            PriceService::get_coingecko_coin_id(43114),
            Some("avalanche-2")
        );
        assert_eq!(PriceService::get_coingecko_coin_id(8453), Some("ethereum")); // Base
        assert_eq!(PriceService::get_coingecko_coin_id(999), None);
    }

    #[test]
    fn test_coingecko_platform_id_mapping() {
        assert_eq!(PriceService::get_coingecko_platform_id(1), Some("ethereum"));
        assert_eq!(
            PriceService::get_coingecko_platform_id(137),
            Some("polygon-pos")
        );
        assert_eq!(
            PriceService::get_coingecko_platform_id(56),
            Some("binance-smart-chain")
        );
        assert_eq!(
            PriceService::get_coingecko_platform_id(369),
            Some("pulsechain")
        );
        assert_eq!(
            PriceService::get_coingecko_platform_id(42161),
            Some("arbitrum-one")
        );
        assert_eq!(
            PriceService::get_coingecko_platform_id(10),
            Some("optimistic-ethereum")
        );
        assert_eq!(
            PriceService::get_coingecko_platform_id(43114),
            Some("avalanche")
        );
        assert_eq!(PriceService::get_coingecko_platform_id(8453), Some("base"));
        assert_eq!(PriceService::get_coingecko_platform_id(999), None);
    }

    #[tokio::test]
    async fn test_unsupported_chain_type() {
        let service = PriceService::new();
        let result = service.fetch_native_price(ChainType::Stellar, 1).await;
        assert!(result.is_err());
        match result.unwrap_err() {
            WalletError::ChainNotSupported(msg) => {
                assert!(msg.contains("not supported"));
            },
            _ => panic!("Expected ChainNotSupported error"),
        }
    }

    #[tokio::test]
    async fn test_unsupported_chain_id() {
        let service = PriceService::new();
        let result = service.fetch_native_price(ChainType::Evm, 999).await;
        assert!(result.is_err());
        match result.unwrap_err() {
            WalletError::ChainNotSupported(msg) => {
                assert!(msg.contains("Unsupported chain ID"));
            },
            _ => panic!("Expected ChainNotSupported error"),
        }
    }

    // Note: Network tests are commented out to avoid hitting real APIs during testing
    // Uncomment for manual testing with real API calls

    // #[tokio::test]
    // async fn test_fetch_eth_price() {
    //     let service = PriceService::new();
    //     let result = service.fetch_native_price(ChainType::Evm, 1).await;
    //     assert!(result.is_ok());
    //     let price = result.unwrap();
    //     assert!(price > 0.0);
    //     println!("ETH price: ${:.2}", price);
    // }

    // #[tokio::test]
    // async fn test_fetch_token_price() {
    //     let service = PriceService::new();
    //     // USDC on Ethereum
    //     let result = service.fetch_token_price(
    //         ChainType::Evm,
    //         1,
    //         "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
    //     ).await;
    //     assert!(result.is_ok());
    //     let price = result.unwrap();
    //     assert!(price > 0.0);
    //     println!("USDC price: ${:.2}", price);
    // }
}
