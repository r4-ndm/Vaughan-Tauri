//! Token Commands
//!
//! Tauri commands for token-related operations (prices, custom tokens).

use crate::chains::ChainAdapter;
use crate::models::token::TrackedToken;
use crate::state::VaughanState;
use serde::Serialize;
use specta::Type;
use tauri::State;

/// Token price response
#[derive(Debug, Serialize, Type)]
pub struct TokenPriceResponse {
    pub symbol: String,
    pub price_usd: f64,
    pub timestamp: u64,
}

/// Token balance response
#[derive(Debug, Serialize, Type)]
pub struct TokenBalanceResponse {
    pub balance: String,
    pub balance_formatted: String,
    pub symbol: String,
    pub decimals: u8,
}

#[tauri::command]
#[specta::specta]
pub async fn get_token_price(state: State<'_, VaughanState>) -> Result<TokenPriceResponse, String> {
    let adapter = state.current_adapter().await.map_err(|e| e.user_message())?;
    let chain_info = adapter.chain_info();
    let price = state.price_service.fetch_native_price(chain_info.chain_type, chain_info.chain_id.unwrap_or(0)).await.map_err(|e| e.user_message())?;

    Ok(TokenPriceResponse {
        symbol: chain_info.native_token.symbol,
        price_usd: price,
        timestamp: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs(),
    })
}

#[tauri::command]
#[specta::specta]
pub async fn refresh_token_prices(state: State<'_, VaughanState>) -> Result<TokenPriceResponse, String> {
    get_token_price(state).await
}

#[tauri::command]
#[specta::specta]
pub async fn get_token_balance(
    state: State<'_, VaughanState>,
    token_address: String,
    wallet_address: String,
) -> Result<TokenBalanceResponse, String> {
    let adapter = state.current_adapter().await.map_err(|e| e.user_message())?;
    let balance = adapter.get_token_balance(&token_address, &wallet_address).await?;
    
    Ok(TokenBalanceResponse {
        balance: balance.raw,
        balance_formatted: balance.formatted,
        symbol: balance.token.symbol,
        decimals: balance.token.decimals as u8,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn get_token_metadata(
    state: State<'_, VaughanState>,
    token_address: String,
) -> Result<TrackedToken, String> {
    let adapter = state.current_adapter().await.map_err(|e| e.user_message())?;
    let info = adapter.get_token_metadata(&token_address).await?;

    Ok(TrackedToken {
        address: token_address,
        symbol: info.symbol,
        name: info.name,
        decimals: info.decimals as u8,
        chain_id: adapter.chain_id(),
    })
}

#[tauri::command]
#[specta::specta]
pub async fn add_custom_token(state: State<'_, VaughanState>, token_address: String) -> Result<TrackedToken, String> {
    let token = get_token_metadata(state.clone(), token_address.clone()).await?;
    let mut tracked = state.tracked_tokens.lock().await;
    let chain_tokens = tracked.entry(token.chain_id).or_default();
    if chain_tokens.iter().any(|t| t.address.eq_ignore_ascii_case(&token.address)) {
        return Err("Already tracked".to_string());
    }
    chain_tokens.push(token.clone());
    drop(tracked);
    if let Ok(acc) = state.active_account().await { state.set_active_account(acc).await; }
    Ok(token)
}

#[tauri::command]
#[specta::specta]
pub async fn remove_custom_token(state: State<'_, VaughanState>, token_address: String) -> Result<(), String> {
    let adapter = state.current_adapter().await.map_err(|e| e.user_message())?;
    let mut tracked = state.tracked_tokens.lock().await;
    if let Some(tokens) = tracked.get_mut(&adapter.chain_id()) {
        tokens.retain(|t| !t.address.eq_ignore_ascii_case(&token_address));
    }
    drop(tracked);
    if let Ok(acc) = state.active_account().await { state.set_active_account(acc).await; }
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn get_tracked_tokens(state: State<'_, VaughanState>) -> Result<Vec<TrackedToken>, String> {
    let adapter = state.current_adapter().await.map_err(|e| e.user_message())?;
    let tracked = state.tracked_tokens.lock().await;
    Ok(tracked.get(&adapter.chain_id()).cloned().unwrap_or_default())
}
