// ============================================================================
// Vaughan Wallet - EVM Chain Adapter
// ============================================================================
use alloy::{
    network::Ethereum,
    primitives::{utils::format_units, Address, B256, TxKind, U256},
    rpc::types::eth::TransactionRequest,
    signers::local::PrivateKeySigner,
};
use alloy::providers::{Provider, RootProvider};
use alloy::rpc::client::RpcClient;
use alloy::transports::http::Http;
use async_trait::async_trait;
use url::Url;
use std::sync::Arc;

pub type AlloyProvider = RootProvider<Ethereum>;

use crate::chains::{evm::networks::get_network_by_chain_id, types::*, ChainAdapter};
use crate::error::WalletError;

pub struct EvmAdapter {
    provider: Arc<AlloyProvider>,
    signer: Option<PrivateKeySigner>,
    rpc_url: String,
    chain_id: u64,
}

impl EvmAdapter {
    pub async fn new(rpc_url: &str, _network_id: String, chain_id: u64) -> Result<Self, WalletError> {
        let url = Url::parse(rpc_url).map_err(|e| WalletError::NetworkError(e.to_string()))?;
        let transport = Http::new(url);
        let client = RpcClient::new(transport, true);
        let provider = RootProvider::<Ethereum>::new(client);

        Ok(Self {
            provider: Arc::new(provider),
            signer: None,
            rpc_url: rpc_url.to_string(),
            chain_id,
        })
    }

    pub async fn with_signer(rpc_url: &str, _network_id: String, chain_id: u64, signer: PrivateKeySigner) -> Result<Self, WalletError> {
        let url = Url::parse(rpc_url).map_err(|e| WalletError::NetworkError(e.to_string()))?;
        let transport = Http::new(url);
        let client = RpcClient::new(transport, true);
        let provider = RootProvider::<Ethereum>::new(client);

        Ok(Self {
            provider: Arc::new(provider),
            signer: Some(signer),
            rpc_url: rpc_url.to_string(),
            chain_id,
        })
    }

    pub fn rpc_url(&self) -> &str { &self.rpc_url }
    pub fn chain_id(&self) -> u64 { self.chain_id }
    pub fn provider(&self) -> Arc<AlloyProvider> { self.provider.clone() }
}

#[async_trait]
impl ChainAdapter for EvmAdapter {
    async fn get_balance(&self, address: &str) -> Result<Balance, WalletError> {
        let addr = address.parse::<Address>().map_err(|_| WalletError::InvalidAddress(address.to_string()))?;
        let balance = self.provider.get_balance(addr).await.map_err(|e| WalletError::RpcError(e.to_string()))?;

        let (symbol, name, decimals) = if let Some(net) = get_network_by_chain_id(self.chain_id) {
            (net.native_symbol.clone(), net.native_name.clone(), net.decimals)
        } else {
            ("ETH".to_string(), "Ethereum".to_string(), 18)
        };
        let formatted = format_units(balance, decimals).unwrap_or_else(|_| "0.0".to_string());
        let token = TokenInfo::native(symbol, name, decimals);
        Ok(Balance::new(token, balance.to_string(), formatted))
    }

    async fn send_transaction(&self, tx: ChainTransaction) -> Result<TxHash, WalletError> {
        let evm_tx = match tx {
            ChainTransaction::Evm(tx) => tx,
            _ => return Err(WalletError::InvalidTransaction("Not an EVM transaction".into())),
        };

        let mut alloy_tx = TransactionRequest::default();
        alloy_tx.from = Some(evm_tx.from.parse().map_err(|_| WalletError::InvalidAddress(evm_tx.from.clone()))?);
        let tx_addr: Address = evm_tx.to.parse().map_err(|_| WalletError::InvalidAddress(evm_tx.to.clone()))?;
        alloy_tx.to = Some(TxKind::Call(tx_addr)); // Fix: Use TxKind::Call for 'to' address
        alloy_tx.value = Some(U256::from_str_radix(&evm_tx.value, 10).map_err(|_| WalletError::InvalidParams)?);

        if let Some(data) = evm_tx.data {
            let bytes = hex::decode(data.trim_start_matches("0x")).map_err(|_| WalletError::InvalidParams)?;
            alloy_tx.input.input = Some(bytes.into());
        }

        // Explicit trait call for send_transaction
        let pending = Provider::<Ethereum>::send_transaction(&*self.provider, alloy_tx).await.map_err(|e| WalletError::TransactionFailed(e.to_string()))?;
        Ok(TxHash(format!("{:?}", pending.tx_hash())))
    }

    async fn sign_message(&self, _address: &str, message: &[u8]) -> Result<Signature, WalletError> {
        if let Some(signer) = &self.signer {
            use alloy::signers::Signer;
            let sig = signer.sign_message(message).await.map_err(|e| WalletError::SigningFailed(e.to_string()))?;
            Ok(Signature::new(format!("0x{}", hex::encode(sig.as_bytes()))).with_recovery_id(sig.v() as u8))
        } else {
            Err(WalletError::SignerNotAvailable("No signer configured".into()))
        }
    }

    async fn get_transactions(&self, _address: &str, _limit: u32) -> Result<Vec<TxRecord>, WalletError> { Ok(vec![]) }
    async fn get_transaction_history(&self, _address: &str, _limit: u32) -> Result<Vec<TxRecord>, WalletError> { Ok(vec![]) }
    async fn get_token_transfer_history(&self, _address: &str, _limit: u32) -> Result<Vec<TxRecord>, WalletError> { Ok(vec![]) }

    async fn estimate_fee(&self, tx: &ChainTransaction) -> Result<Fee, WalletError> {
        let evm_tx = match tx {
            ChainTransaction::Evm(tx) => tx,
            _ => return Err(WalletError::InvalidTransaction("Not an EVM transaction".into())),
        };

        let mut alloy_tx = TransactionRequest::default();
        alloy_tx.from = Some(evm_tx.from.parse().map_err(|_| WalletError::InvalidAddress(evm_tx.from.clone()))?);
        alloy_tx.to = Some(TxKind::Call(evm_tx.to.parse().map_err(|_| WalletError::InvalidAddress(evm_tx.to.clone()))?)); // Fix: Use TxKind::Call
        alloy_tx.value = Some(U256::from_str_radix(&evm_tx.value, 10).map_err(|_| WalletError::InvalidParams)?);

        let gas_estimate = self.provider.estimate_gas(alloy_tx.clone()).await.map_err(|e| WalletError::GasEstimationFailed(e.to_string()))?;
        let gas_price = self.provider.get_gas_price().await.map_err(|e| WalletError::RpcError(e.to_string()))?;
        let total_fee = U256::from(gas_estimate) * U256::from(gas_price);

        Ok(Fee::new(total_fee.to_string(), format_units(total_fee, 18).unwrap_or_else(|_| "0.0".to_string()))
            .with_gas(gas_estimate, gas_price.to_string()))
    }

    fn validate_address(&self, address: &str) -> Result<(), WalletError> {
        address.parse::<Address>().map(|_| ()).map_err(|_| WalletError::InvalidAddress(address.to_string()))
    }

    fn chain_info(&self) -> ChainInfo {
        if let Some(net) = get_network_by_chain_id(self.chain_id) {
            ChainInfo::new(
                ChainType::Evm,
                Some(self.chain_id),
                net.name.clone(),
                TokenInfo::native(
                    net.native_symbol.clone(),
                    net.native_name.clone(),
                    net.decimals,
                ),
            )
        } else {
            ChainInfo::new(
                ChainType::Evm,
                Some(self.chain_id),
                "Network".into(),
                TokenInfo::native("ETH".into(), "Ethereum".into(), 18),
            )
        }
    }

    fn chain_type(&self) -> ChainType { ChainType::Evm }
    
    async fn estimate_gas(&self, tx: TransactionRequest) -> Result<u64, WalletError> {
        self.provider.estimate_gas(tx).await.map_err(|e| WalletError::RpcError(e.to_string()))
    }

    async fn call(&self, tx: TransactionRequest) -> Result<alloy::primitives::Bytes, WalletError> {
        self.provider.call(tx).await.map_err(|e| WalletError::RpcError(e.to_string()))
    }

    async fn get_transaction_by_hash(&self, hash: B256) -> Result<Option<alloy::rpc::types::eth::Transaction>, WalletError> {
        self.provider.get_transaction_by_hash(hash).await.map_err(|e| WalletError::RpcError(e.to_string()))
    }

    async fn get_transaction_receipt(&self, hash: B256) -> Result<Option<alloy::rpc::types::eth::TransactionReceipt>, WalletError> {
        self.provider.get_transaction_receipt(hash).await.map_err(|e| WalletError::RpcError(e.to_string()))
    }

    async fn get_token_balance(&self, token_address: &str, wallet_address: &str) -> Result<Balance, WalletError> {
        let token_addr = token_address.parse::<Address>().map_err(|_| WalletError::InvalidAddress(token_address.to_string()))?;
        let wallet_addr = wallet_address.parse::<Address>().map_err(|_| WalletError::InvalidAddress(wallet_address.to_string()))?;
        
        // Use the internal RootProvider specifically for sol!(rpc) calls
        let contract = crate::models::erc20::IERC20::new(token_addr, self.provider.clone());
        let balance = contract.balanceOf(wallet_addr).call().await.map_err(|e| WalletError::RpcError(e.to_string()))?;
        let symbol = contract.symbol().call().await.unwrap_or("TOKEN".to_string());
        let decimals = contract.decimals().call().await.unwrap_or(18);
        
        let formatted = format_units(balance, decimals).unwrap_or_else(|_| "0.0".to_string());
        let token = TokenInfo::erc20(symbol, "Token".to_string(), decimals, token_address.to_string());
        Ok(Balance::new(token, balance.to_string(), formatted))
    }

    async fn get_token_metadata(&self, token_address: &str) -> Result<TokenInfo, WalletError> {
        let token_addr = token_address.parse::<Address>().map_err(|_| WalletError::InvalidAddress(token_address.to_string()))?;
                let contract = crate::models::erc20::IERC20::new(token_addr, self.provider.clone());
        
        let symbol = contract.symbol().call().await.unwrap_or_else(|_| "TOKEN".into());
        let name = contract.name().call().await.unwrap_or_else(|_| "Token".into());
        let decimals = contract.decimals().call().await.unwrap_or(18);
        
        Ok(TokenInfo::erc20(symbol, name, decimals, token_address.to_string()))
    }

    async fn raw_request(&self, method: String, params: Vec<serde_json::Value>) -> Result<serde_json::Value, WalletError> {
        let client = reqwest::Client::new();
        let payload = serde_json::json!({ "jsonrpc": "2.0", "id": 1, "method": method, "params": params });
        let response = client.post(&self.rpc_url).json(&payload).send().await.map_err(|e| WalletError::NetworkError(e.to_string()))?;
        let body: serde_json::Value = response.json().await.map_err(|e| WalletError::RpcError(e.to_string()))?;
        Ok(body.get("result").cloned().unwrap_or(serde_json::Value::Null))
    }
}

impl EvmAdapter {
    pub async fn get_block_number(&self) -> Result<u64, WalletError> { self.provider.get_block_number().await.map_err(|e| WalletError::RpcError(e.to_string())) }
    pub async fn get_gas_price(&self) -> Result<u128, WalletError> { self.provider.get_gas_price().await.map_err(|e| WalletError::RpcError(e.to_string())) }
    pub async fn get_transaction_count(&self, address: Address) -> Result<u64, WalletError> { self.provider.get_transaction_count(address).await.map_err(|e| WalletError::RpcError(e.to_string())) }
}
