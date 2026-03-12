//! Transaction History Commands
//!
//! Fetches transaction history from Etherscan-compatible block explorer APIs.
//! Includes both native token transfers and ERC20 token transfers.

use crate::chains::ChainAdapter;
use crate::state::VaughanState;
use serde::{Deserialize, Serialize};
use tauri::State;

/// Transaction record matching the shape expected by HistoryView.tsx
#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
pub struct TxRecord {
    pub hash: String,
    pub from: String,
    pub to: String,
    /// Value in human-readable form (e.g. "0.5")
    pub value: String,
    pub gas_used: String,
    pub gas_price: String,
    pub block_number: u64,
    /// Unix timestamp (seconds)
    pub timestamp: u64,
    /// 1 = success, 0 = failed
    pub status: u8,
    pub input: String,
    /// Native token symbol (e.g. "PLS", "ETH", "tPLS")
    pub native_symbol: String,
    /// Token symbol — only set for ERC20 transfers (e.g. "USDC")
    pub token_symbol: Option<String>,
    /// Token contract address — only set for ERC20 transfers
    pub token_address: Option<String>,
    /// Whether this is an ERC20 token transfer
    pub is_token_transfer: bool,
}

/// Get transaction history for an address (native + ERC20 token transfers combined)
#[tauri::command]
#[specta::specta]
pub async fn get_transactions(
    state: State<'_, VaughanState>,
    address: String,
    limit: Option<u32>,
) -> Result<Vec<TxRecord>, String> {
    let limit = limit.unwrap_or(50);

    let adapter = state
        .current_adapter()
        .await
        .map_err(|e| format!("Network not initialized: {}", e))?;

    let chain_info = adapter.chain_info();
    let native_symbol = chain_info.native_token.symbol.clone();

    // Fetch native transfers and ERC20 transfers in parallel
    // These now return crate::chains::types::TxRecord
    let (native_result, token_result) = tokio::join!(
        adapter.get_transaction_history(&address, limit),
        adapter.get_token_transfer_history(&address, limit),
    );

    let native_txns = native_result.unwrap_or_else(|e| {
        eprintln!("[history] Native tx fetch error: {}", e);
        vec![]
    });
    let token_txns = token_result.unwrap_or_else(|e| {
        eprintln!("[history] Token tx fetch error: {}", e);
        vec![]
    });

    // Convert from types::TxRecord to local TxRecord
    let mut records: Vec<TxRecord> = native_txns
        .into_iter()
        .map(|tx| TxRecord {
            hash: tx.hash.0,
            from: tx.from,
            to: tx.to,
            value: tx.value,
            gas_used: tx.gas_used.unwrap_or(0).to_string(),
            gas_price: "0".to_string(), // Missing in types::TxRecord for now
            block_number: tx.block_number.unwrap_or(0),
            timestamp: tx.timestamp.unwrap_or(0),
            status: match tx.status {
                crate::chains::types::TxStatus::Confirmed => 1,
                _ => 0,
            },
            input: "0x".to_string(),
            native_symbol: native_symbol.clone(),
            token_symbol: None,
            token_address: None,
            is_token_transfer: false,
        })
        .collect();

    let token_records: Vec<TxRecord> = token_txns
        .into_iter()
        .map(|tx| TxRecord {
            hash: tx.hash.0,
            from: tx.from,
            to: tx.to,
            value: tx.value,
            gas_used: tx.gas_used.unwrap_or(0).to_string(),
            gas_price: "0".to_string(),
            block_number: tx.block_number.unwrap_or(0),
            timestamp: tx.timestamp.unwrap_or(0),
            status: match tx.status {
                crate::chains::types::TxStatus::Confirmed => 1,
                _ => 0,
            },
            input: "0x".to_string(),
            native_symbol: native_symbol.clone(),
            token_symbol: Some("TOKEN".to_string()),
            token_address: None,
            is_token_transfer: true,
        })
        .collect();

    records.extend(token_records);
    records.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    records.truncate(limit as usize);

    Ok(records)
}
