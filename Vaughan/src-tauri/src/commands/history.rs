//! Transaction History Commands
//!
//! Fetches transaction history from Etherscan-compatible block explorer APIs.
//! Includes both native token transfers and ERC20 token transfers.

use crate::chains::ChainAdapter;
use crate::state::VaughanState;
use serde::{Deserialize, Serialize};
use tauri::State;

/// Transaction record matching the shape expected by HistoryView.tsx
#[derive(Debug, Serialize, Deserialize, Clone)]
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
///
/// Queries the Etherscan-compatible block explorer API for the current network.
/// Returns an empty list if the network has no explorer API configured.
///
/// # Arguments
///
/// * `state` - Application state
/// * `address` - Account address to query
/// * `limit` - Max number of transactions to return (default 50)
///
/// # Example (frontend)
///
/// ```typescript
/// const txns = await invoke<TxRecord[]>('get_transactions', {
///   address: '0x...',
///   limit: 50
/// });
/// ```
#[tauri::command]
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

    // Get native symbol from adapter
    let chain_info = adapter.chain_info();
    let native_symbol = chain_info.native_token.symbol.clone();

    // Fetch native transfers and ERC20 transfers in parallel
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

    // Parse and combine
    let mut records: Vec<TxRecord> = native_txns
        .iter()
        .filter_map(|tx| parse_native_tx(tx, &native_symbol))
        .collect();

    let token_records: Vec<TxRecord> = token_txns
        .iter()
        .filter_map(|tx| parse_token_tx(tx, &native_symbol))
        .collect();

    // Remove duplicate 0-value native records that are just wrappers for token transactions
    let token_hashes: std::collections::HashSet<String> =
        token_records.iter().map(|tx| tx.hash.clone()).collect();
    records.retain(|tx| !token_hashes.contains(&tx.hash) || tx.value != "0");

    records.extend(token_records);

    // Sort by timestamp descending (newest first)
    records.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    records.truncate(limit as usize);

    Ok(records)
}

/// Parse a native ETH/PLS transaction from Etherscan format
fn parse_native_tx(tx: &serde_json::Value, native_symbol: &str) -> Option<TxRecord> {
    let hash = tx.get("hash")?.as_str()?.to_string();
    let from = tx.get("from")?.as_str()?.to_string();
    let to = tx
        .get("to")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let value_wei = tx.get("value").and_then(|v| v.as_str()).unwrap_or("0");
    let value_eth = wei_str_to_native(value_wei);
    let gas_used = tx
        .get("gasUsed")
        .and_then(|v| v.as_str())
        .unwrap_or("0")
        .to_string();
    let gas_price = tx
        .get("gasPrice")
        .and_then(|v| v.as_str())
        .unwrap_or("0")
        .to_string();
    let block_number = tx
        .get("blockNumber")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);
    let timestamp = tx
        .get("timeStamp")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);
    let is_error = tx.get("isError").and_then(|v| v.as_str()).unwrap_or("0");
    let receipt_status = tx
        .get("txreceipt_status")
        .and_then(|v| v.as_str())
        .unwrap_or("1");
    let status = if is_error == "1" || receipt_status == "0" {
        0
    } else {
        1
    };
    let input = tx
        .get("input")
        .and_then(|v| v.as_str())
        .unwrap_or("0x")
        .to_string();

    Some(TxRecord {
        hash,
        from,
        to,
        value: value_eth,
        gas_used,
        gas_price,
        block_number,
        timestamp,
        status,
        input,
        native_symbol: native_symbol.to_string(),
        token_symbol: None,
        token_address: None,
        is_token_transfer: false,
    })
}

/// Parse an ERC20 token transfer from Etherscan tokentx format
fn parse_token_tx(tx: &serde_json::Value, native_symbol: &str) -> Option<TxRecord> {
    let hash = tx.get("hash")?.as_str()?.to_string();
    let from = tx.get("from")?.as_str()?.to_string();
    let to = tx
        .get("to")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    // ERC20 value is in token's smallest unit — divide by 10^decimals
    let value_raw = tx.get("value").and_then(|v| v.as_str()).unwrap_or("0");
    let decimals: u32 = tx
        .get("tokenDecimal")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse().ok())
        .unwrap_or(18);
    let value = format_token_amount(value_raw, decimals);

    let token_symbol = tx
        .get("tokenSymbol")
        .and_then(|v| v.as_str())
        .unwrap_or("TOKEN")
        .to_string();
    let token_address = tx
        .get("contractAddress")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let gas_used = tx
        .get("gasUsed")
        .and_then(|v| v.as_str())
        .unwrap_or("0")
        .to_string();
    let gas_price = tx
        .get("gasPrice")
        .and_then(|v| v.as_str())
        .unwrap_or("0")
        .to_string();
    let block_number = tx
        .get("blockNumber")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);
    let timestamp = tx
        .get("timeStamp")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);

    Some(TxRecord {
        hash,
        from,
        to,
        value,
        gas_used,
        gas_price,
        block_number,
        timestamp,
        status: 1,
        input: "0x".to_string(),
        native_symbol: native_symbol.to_string(),
        token_symbol: Some(token_symbol),
        token_address,
        is_token_transfer: true,
    })
}

/// Convert a decimal wei string to a native token display string (up to 6 dp)
fn wei_str_to_native(wei_str: &str) -> String {
    let wei: u128 = wei_str.parse().unwrap_or(0);
    if wei == 0 {
        return "0".to_string();
    }
    let whole = wei / 1_000_000_000_000_000_000u128;
    let frac = (wei % 1_000_000_000_000_000_000u128) / 1_000_000_000_000u128;
    if frac == 0 {
        whole.to_string()
    } else {
        format!("{}.{:06}", whole, frac)
            .trim_end_matches('0')
            .trim_end_matches('.')
            .to_string()
    }
}

/// Format a token amount from smallest unit to decimal string
fn format_token_amount(raw: &str, decimals: u32) -> String {
    if decimals == 0 {
        return raw.to_string();
    }
    let value: u128 = raw.parse().unwrap_or(0);
    if value == 0 {
        return "0".to_string();
    }
    let divisor = 10u128.pow(decimals.min(18));
    let display_decimals = decimals.min(6) as usize;
    let frac_divisor = 10u128.pow(decimals.min(18) - decimals.min(6) as u32);
    let whole = value / divisor;
    let frac = (value % divisor) / frac_divisor;
    if frac == 0 {
        whole.to_string()
    } else {
        format!("{}.{:0width$}", whole, frac, width = display_decimals)
            .trim_end_matches('0')
            .trim_end_matches('.')
            .to_string()
    }
}
