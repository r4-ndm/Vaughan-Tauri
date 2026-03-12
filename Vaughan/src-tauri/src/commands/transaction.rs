//! Transaction Commands
//!
//! Tauri commands for transaction operations.
//!
//! **Security Note**: Transaction signing commands require origin verification
//! to ensure they're only called from the main wallet window, not dApp windows.

use crate::chains::ChainAdapter;
use crate::state::VaughanState;
use alloy::eips::eip2718::Encodable2718;
use alloy::primitives::{Address, U256};
use alloy::providers::Provider;
use alloy::rpc::types::TransactionRequest;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::str::FromStr;
use tauri::State;

/// Transaction validation request
#[derive(Debug, Deserialize, Type)]
pub struct ValidateTransactionRequest {
    /// Recipient address
    pub to: String,
    /// Amount in ETH (human-readable)
    pub amount: String,
    /// Gas limit (optional)
    pub gas_limit: Option<u64>,
    /// Token address for ERC20 transfers (optional)
    pub token_address: Option<String>,
    /// Optional raw transaction data payload (hex string)
    pub data: Option<String>,
}

/// Gas estimation response
#[derive(Debug, Serialize, Type)]
pub struct EstimateGasResponse {
    /// Estimated gas limit
    pub gas_limit: u64,
    /// Estimated gas price (in gwei)
    pub gas_price_gwei: String,
    /// Estimated total fee (in ETH)
    pub total_fee_eth: String,
}

/// Validate transaction parameters
#[tauri::command]
#[specta::specta]
pub async fn validate_transaction(
    state: State<'_, VaughanState>,
    request: ValidateTransactionRequest,
) -> Result<(), String> {
    let _to = Address::from_str(&request.to)
        .map_err(|_| format!("Invalid recipient address format: {}", request.to))?;

    if let Some(token) = &request.token_address {
        let _token_addr = Address::from_str(token)
            .map_err(|_| format!("Invalid token address format: {}", token))?;
    }

    let adapter = state.current_adapter().await.map_err(|e| e.user_message())?;
    adapter.validate_address(&request.to).map_err(|e| e.user_message())?;

    let _amount_wei = crate::chains::evm::utils::parse_eth_to_wei(&request.amount, 18)
        .map_err(|e| e.user_message())?;

    if let Some(gas_limit) = request.gas_limit {
        if gas_limit < 21000 { return Err("Gas limit too low".to_string()); }
    }

    Ok(())
}

/// Estimate gas for a simple transfer
#[tauri::command]
#[specta::specta]
pub async fn estimate_gas_simple(
    state: State<'_, VaughanState>,
    from: String,
    to: String,
    amount: String,
    token_address: Option<String>,
    data: Option<String>,
) -> Result<EstimateGasResponse, String> {
    let adapter = state.current_adapter().await.map_err(|e| e.user_message())?;
    let from_addr = Address::from_str(&from).map_err(|_| "Invalid from".to_string())?;
    let to_addr = Address::from_str(&to).map_err(|_| "Invalid to".to_string())?;
    let value = crate::chains::evm::utils::parse_eth_to_wei(&amount, 18).unwrap_or(U256::ZERO);

    let gas_price = adapter.get_gas_price().await.unwrap_or(1_000_000_000);
    let gas_price_gwei = crate::chains::evm::utils::format_wei_to_gwei(&gas_price.to_string());

    let mut tx_request = TransactionRequest::default();
    tx_request.from = Some(from_addr);

    if let Some(token_addr_str) = &token_address {
        let token_addr = Address::from_str(token_addr_str).map_err(|_| "Invalid token".to_string())?;
        use alloy::sol;
        sol!(function transfer(address to, uint256 amount) external returns (bool););
        let call = transferCall { to: to_addr, amount: value };
        use alloy::sol_types::SolCall;
        let data = call.abi_encode();
        tx_request.to = Some(token_addr.into());
        tx_request.value = Some(U256::ZERO);
        tx_request.input.input = Some(data.into());
    } else if let Some(custom_data_str) = &data {
        let decoded = hex::decode(custom_data_str.trim_start_matches("0x")).map_err(|_| "Invalid data".to_string())?;
        tx_request.to = Some(to_addr.into());
        tx_request.value = Some(value);
        tx_request.input.input = Some(decoded.into());
    } else {
        tx_request.to = Some(to_addr.into());
        tx_request.value = Some(value);
    }

    let gas_limit_val = match adapter.estimate_gas(tx_request).await {
        Ok(gas) => gas,
        Err(_) => 21000,
    };

    let total_fee_wei = U256::from(gas_limit_val) * U256::from(gas_price);
    let total_fee_eth = crate::chains::evm::utils::format_wei_to_eth(total_fee_wei, 18);

    Ok(EstimateGasResponse {
        gas_limit: gas_limit_val,
        gas_price_gwei,
        total_fee_eth,
    })
}

/// Sign transaction request
#[derive(Debug, Deserialize, Type)]
pub struct SignTransactionRequest {
    pub from: String,
    pub to: String,
    pub value: String,
    pub gas_limit: u64,
    pub gas_price: String,
    pub nonce: u64,
    pub password: String,
    pub data: Option<String>,
}

/// Built transaction response
#[derive(Debug, Serialize, Type)]
pub struct BuildTransactionResponse {
    pub from: String,
    pub to: String,
    pub value: String,
    pub gas_limit: u64,
    pub gas_price: String,
    pub nonce: u64,
    pub chain_id: u64,
    pub total_cost_eth: String,
    pub data: Option<String>,
}

/// Build transaction request
#[derive(Debug, Deserialize, Type)]
pub struct BuildTransactionRequest {
    pub from: String,
    pub to: String,
    pub amount: String,
    pub gas_limit: Option<u64>,
    pub gas_price_gwei: Option<String>,
    pub nonce: Option<u64>,
    pub token_address: Option<String>,
    pub data: Option<String>,
}

/// Build transaction
#[tauri::command]
#[specta::specta]
pub async fn build_transaction(
    state: State<'_, VaughanState>,
    request: BuildTransactionRequest,
) -> Result<BuildTransactionResponse, String> {
    let from = Address::from_str(&request.from).map_err(|_| format!("Invalid from: {}", request.from))?;
    let to = Address::from_str(&request.to).map_err(|_| format!("Invalid to: {}", request.to))?;
    let value = crate::chains::evm::utils::parse_eth_to_wei(&request.amount, 18).map_err(|e| e.user_message())?;

    let adapter = state.current_adapter().await.map_err(|e| e.user_message())?;
    let chain_id = adapter.chain_id();

    let mut tx_request = TransactionRequest::default();
    tx_request.from = Some(from);
    let mut data_hex: Option<String> = request.data.clone();

    if let Some(token_addr_str) = &request.token_address {
        let token_addr = Address::from_str(token_addr_str).map_err(|_| "Invalid token".to_string())?;
        use alloy::sol;
        sol!(function transfer(address to, uint256 amount) external returns (bool););
        let call = transferCall { to, amount: value };
        use alloy::sol_types::SolCall;
        let data = call.abi_encode();
        data_hex = Some(hex::encode(&data));
        tx_request.to = Some(token_addr.into());
        tx_request.value = Some(U256::ZERO);
        tx_request.input.input = Some(data.into());
    } else if let Some(custom_data) = &data_hex {
        let decoded = hex::decode(custom_data.trim_start_matches("0x")).map_err(|_| "Invalid data".to_string())?;
        tx_request.to = Some(to.into());
        tx_request.value = Some(value);
        tx_request.input.input = Some(decoded.into());
    } else {
        tx_request.to = Some(to.into());
        tx_request.value = Some(value);
    }

    let gas_limit = if let Some(gl) = request.gas_limit { gl } else {
        match adapter.estimate_gas(tx_request).await {
            Ok(gas) => gas,
            Err(_) => 21000,
        }
    };

    let gas_price = if let Some(price_gwei) = request.gas_price_gwei {
        crate::chains::evm::utils::parse_eth_to_wei(&price_gwei, 9).map_err(|e| e.user_message())?
    } else {
        U256::from(adapter.get_gas_price().await.unwrap_or(1_000_000_000))
    };

    let nonce = if let Some(n) = request.nonce { n } else {
        adapter.get_transaction_count(from).await.map_err(|e| format!("Failed to get nonce: {}", e))?
    };

    let total_cost = value + (U256::from(gas_limit) * gas_price);
    let total_cost_eth = crate::chains::evm::utils::format_wei_to_eth(total_cost, 18);

    Ok(BuildTransactionResponse {
        from: from.to_string(), to: to.to_string(), value: value.to_string(),
        gas_limit, gas_price: gas_price.to_string(), nonce, chain_id,
        total_cost_eth, data: data_hex,
    })
}

/// Sign transaction
#[tauri::command]
#[specta::specta]
pub async fn sign_transaction(
    state: State<'_, VaughanState>,
    request: SignTransactionRequest,
) -> Result<String, String> {
    state.wallet_service.verify_password(&request.password).await.map_err(|e| e.user_message())?;

    let from = Address::from_str(&request.from).map_err(|_| "Invalid from".to_string())?;
    let to = Address::from_str(&request.to).map_err(|_| "Invalid to".to_string())?;
    let value = U256::from_str(&request.value).map_err(|_| "Invalid value".to_string())?;
    let gas_price = U256::from_str(&request.gas_price).map_err(|_| "Invalid gas price".to_string())?;

    let signer = state.wallet_service.get_signer(&from).await.map_err(|e| e.user_message())?;
    let adapter = state.current_adapter().await.map_err(|e| e.user_message())?;
    let chain_id = adapter.chain_id();

    use alloy::network::{EthereumWallet, TransactionBuilder};
    use alloy::rpc::types::TransactionRequest;

    let mut tx_request = TransactionRequest::default();
    tx_request.from = Some(from);
    tx_request.gas = Some(request.gas_limit);
    tx_request.gas_price = Some(gas_price.to::<u128>());
    tx_request.nonce = Some(request.nonce);
    tx_request.chain_id = Some(chain_id);
    tx_request.value = Some(value);

    if let Some(token_data) = request.data {
        let input_bytes = hex::decode(token_data).map_err(|_| "Invalid data".to_string())?;
        tx_request.to = Some(to.into());
        tx_request.input.input = Some(input_bytes.into());
    } else {
        tx_request.to = Some(to.into());
    }

    let wallet = EthereumWallet::from(signer);
    let envelope = tx_request.build(&wallet).await.map_err(|e| format!("Build failed: {}", e))?;
    Ok(format!("0x{}", hex::encode(envelope.encoded_2718())))
}

/// Send transaction request
#[derive(Debug, Deserialize, Type)]
pub struct SendTransactionRequest {
    pub from: String,
    pub to: String,
    pub amount: String,
    pub gas_limit: Option<u64>,
    pub gas_price_gwei: Option<String>,
    pub password: String,
    pub token_address: Option<String>,
    pub data: Option<String>,
}

/// Transaction response
#[derive(Debug, Serialize, Type)]
pub struct TransactionResponse {
    pub tx_hash: String,
    pub details: BuildTransactionResponse,
}

/// Send transaction
#[tauri::command]
#[specta::specta]
pub async fn send_transaction(
    state: State<'_, VaughanState>,
    request: SendTransactionRequest,
) -> Result<TransactionResponse, String> {
    state.wallet_service.verify_password(&request.password).await.map_err(|e| e.user_message())?;

    let build_req = BuildTransactionRequest {
        from: request.from.clone(), to: request.to.clone(), amount: request.amount.clone(),
        gas_limit: request.gas_limit, gas_price_gwei: request.gas_price_gwei.clone(),
        nonce: None, token_address: request.token_address.clone(), data: request.data.clone(),
    };
    let built_tx = build_transaction(state.clone(), build_req).await?;

    let (to_sign, val_sign) = if request.token_address.is_some() {
        (request.token_address.clone().unwrap(), "0".to_string())
    } else {
        (request.to.clone(), built_tx.value.clone())
    };

    let sign_req = SignTransactionRequest {
        from: request.from.clone(), to: to_sign, value: val_sign,
        gas_limit: built_tx.gas_limit, gas_price: built_tx.gas_price.clone(),
        nonce: built_tx.nonce, password: request.password.clone(), data: built_tx.data.clone(),
    };
    let signed_tx = sign_transaction(state.clone(), sign_req).await?;

    let adapter = state.current_adapter().await.map_err(|e| e.user_message())?;
    let tx_bytes = hex::decode(signed_tx.trim_start_matches("0x")).map_err(|_| "Decode failed".to_string())?;
    let pending = adapter.provider().send_raw_transaction(&tx_bytes).await.map_err(|e| e.to_string())?;

    Ok(TransactionResponse {
        tx_hash: format!("{:?}", pending.tx_hash()),
        details: built_tx,
    })
}
