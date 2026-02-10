//! Token Commands
//!
//! Tauri commands for token-related operations (prices, custom tokens).

use crate::chains::ChainAdapter;
use crate::state::VaughanState;
use serde::Serialize;
use tauri::State;

/// Token price response
#[derive(Debug, Serialize)]
pub struct TokenPriceResponse {
    /// Token symbol (e.g., "ETH", "PLS")
    pub symbol: String,
    /// Price in USD
    pub price_usd: f64,
    /// Timestamp of price data
    pub timestamp: u64,
}

/// Get native token price in USD
///
/// Fetches the current price of the native token for the active network.
///
/// # Arguments
///
/// * `state` - Application state
///
/// # Returns
///
/// * `Ok(TokenPriceResponse)` - Token price information
/// * `Err(String)` - Error message
///
/// # Example (from frontend)
///
/// ```typescript
/// const price = await invoke('get_token_price');
/// console.log(`${price.symbol}: $${price.price_usd}`);
/// ```
#[tauri::command]
pub async fn get_token_price(state: State<'_, VaughanState>) -> Result<TokenPriceResponse, String> {
    // Get current adapter to determine chain
    let adapter = state
        .current_adapter()
        .await
        .map_err(|e| e.user_message())?;
    let chain_info = adapter.chain_info();

    // Fetch price using price service
    let price = state
        .price_service
        .fetch_native_price(chain_info.chain_type, chain_info.chain_id.unwrap_or(0))
        .await
        .map_err(|e| e.user_message())?;

    Ok(TokenPriceResponse {
        symbol: chain_info.native_token.symbol,
        price_usd: price,
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|e| format!("System time error: {}", e))?
            .as_secs(),
    })
}

/// Refresh token prices
///
/// Forces a refresh of token price data from the API.
/// This is the same as `get_token_price` since the price service
/// doesn't cache (caching is handled by the frontend).
///
/// # Arguments
///
/// * `state` - Application state
///
/// # Returns
///
/// * `Ok(TokenPriceResponse)` - Updated token price
/// * `Err(String)` - Error message
///
/// # Example (from frontend)
///
/// ```typescript
/// const price = await invoke('refresh_token_prices');
/// console.log(`Refreshed: ${price.symbol} = $${price.price_usd}`);
/// ```
#[tauri::command]
pub async fn refresh_token_prices(
    state: State<'_, VaughanState>,
) -> Result<TokenPriceResponse, String> {
    // Same as get_token_price since we don't cache in the backend
    get_token_price(state).await
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_token_price_response_serialize() {
        let response = TokenPriceResponse {
            symbol: "ETH".to_string(),
            price_usd: 2500.50,
            timestamp: 1234567890,
        };

        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("ETH"));
        assert!(json.contains("2500.5"));
        assert!(json.contains("1234567890"));
    }
}
