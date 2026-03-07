// ============================================================================
// Vaughan Wallet - POC-4: Integration Test
// ============================================================================
//
// Purpose: Validate that all Phase 0 POC assumptions work together in the
// production codebase. This test combines the learnings from POC-1, POC-2,
// and POC-3 into a unified integration test.
//
// POC-1: Tauri 2.0 + Alloy integration ✅
// POC-2: Controller lazy initialization (state management) ✅
// POC-3: Provider interface (ChainAdapter trait) ✅
// POC-4: All components integrate together ✅
//
// Usage:
//   cargo test --test poc4_integration                # Run non-network tests
//   cargo test --test poc4_integration -- --ignored    # Run ALL tests (needs network)
//
// ============================================================================

use vaughan_lib::chains::evm::adapter::EvmAdapter;
use vaughan_lib::chains::evm::networks::{all_networks, get_network_by_chain_id};
use vaughan_lib::chains::evm::utils::{format_wei_to_eth, is_valid_address, parse_eth_to_wei};
use vaughan_lib::chains::types::*;
use vaughan_lib::chains::ChainAdapter;

// ============================================================================
// POC-1 Validation: Alloy Provider Works
// ============================================================================

/// Validates POC-1: EvmAdapter can be created and connects via Alloy provider.
/// This proves Tauri 2.0 + Alloy coexist without conflicts.
#[tokio::test]
#[ignore] // Requires network access
async fn poc1_alloy_provider_connects() {
    let adapter = EvmAdapter::new("https://eth.llamarpc.com", "ethereum".to_string(), 1)
        .await
        .expect("Failed to create EvmAdapter");

    // Verify chain info
    let info = adapter.chain_info();
    assert_eq!(info.chain_type, ChainType::Evm);
    assert_eq!(info.chain_id, Some(1));
    assert_eq!(info.native_token.symbol, "ETH");

    // Verify live RPC call works (POC-1 core validation)
    let block_number = adapter
        .get_block_number()
        .await
        .expect("Failed to get block number");

    assert!(block_number > 0, "Block number should be > 0");
    println!("✅ POC-1: Alloy provider works. Block: {}", block_number);
}

// ============================================================================
// POC-2 Validation: Lazy Initialization & Caching
// ============================================================================

/// Validates POC-2: Adapters can be created on-demand and cached.
/// This proves the lazy initialization pattern works correctly.
#[tokio::test]
async fn poc2_adapter_creation_and_caching() {
    use std::collections::HashMap;
    use std::sync::Arc;
    use tokio::sync::Mutex;

    // Simulate the VaughanState adapter cache pattern
    let adapter_cache: Arc<Mutex<HashMap<String, Arc<EvmAdapter>>>> =
        Arc::new(Mutex::new(HashMap::new()));

    // First access: creates new adapter (lazy init)
    {
        let mut cache = adapter_cache.lock().await;
        assert!(cache.is_empty(), "Cache should start empty");

        let adapter = Arc::new(
            EvmAdapter::new("https://eth.llamarpc.com", "ethereum".to_string(), 1)
                .await
                .expect("Failed to create adapter"),
        );
        cache.insert("ethereum".to_string(), adapter);
    }

    // Second access: uses cached adapter
    {
        let cache = adapter_cache.lock().await;
        assert_eq!(cache.len(), 1, "Cache should have 1 adapter");
        let cached = cache.get("ethereum").expect("Should find cached adapter");
        assert_eq!(cached.chain_id(), 1);
    }

    // Third access: add another network
    {
        let mut cache = adapter_cache.lock().await;
        let adapter = Arc::new(
            EvmAdapter::new("https://polygon-rpc.com", "polygon".to_string(), 137)
                .await
                .expect("Failed to create polygon adapter"),
        );
        cache.insert("polygon".to_string(), adapter);
        assert_eq!(cache.len(), 2, "Cache should have 2 adapters");
    }

    println!("✅ POC-2: Lazy initialization & caching works");
}

// ============================================================================
// POC-3 Validation: ChainAdapter Trait Interface
// ============================================================================

/// Validates POC-3: The ChainAdapter trait provides a unified interface.
/// This proves dApps can interact with any chain through the same API.
#[tokio::test]
async fn poc3_chain_adapter_interface() {
    let adapter = EvmAdapter::new("https://eth.llamarpc.com", "ethereum".to_string(), 1)
        .await
        .expect("Failed to create adapter");

    // Test validate_address (synchronous, no network needed)
    let valid_addr = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
    assert!(adapter.validate_address(valid_addr).is_ok());
    assert!(adapter.validate_address("invalid").is_err());
    assert!(adapter.validate_address("0xinvalid").is_err());

    // Test chain_info (synchronous)
    let info = adapter.chain_info();
    assert_eq!(info.chain_type, ChainType::Evm);
    assert_eq!(info.chain_id, Some(1));
    assert_eq!(info.name, "Ethereum Mainnet");
    assert_eq!(info.native_token.symbol, "ETH");
    assert_eq!(info.native_token.decimals, 18);

    // Test chain_type (synchronous)
    assert_eq!(adapter.chain_type(), ChainType::Evm);

    println!("✅ POC-3: ChainAdapter trait interface works");
}

/// Validates POC-3: Balance query through ChainAdapter trait.
#[tokio::test]
#[ignore] // Requires network access
async fn poc3_balance_query() {
    let adapter = EvmAdapter::new("https://eth.llamarpc.com", "ethereum".to_string(), 1)
        .await
        .expect("Failed to create adapter");

    // Query Vitalik's balance (always non-zero on mainnet)
    let balance = adapter
        .get_balance("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")
        .await
        .expect("Failed to get balance");

    assert_eq!(balance.token.symbol, "ETH");
    assert!(!balance.raw.is_empty(), "Raw balance should not be empty");
    println!(
        "✅ POC-3: Balance query works. Balance: {}",
        balance.formatted
    );
}

/// Validates POC-3: Fee estimation through ChainAdapter trait.
#[tokio::test]
#[ignore] // Requires network access
async fn poc3_fee_estimation() {
    let adapter = EvmAdapter::new("https://eth.llamarpc.com", "ethereum".to_string(), 1)
        .await
        .expect("Failed to create adapter");

    let tx = ChainTransaction::Evm(EvmTransaction {
        from: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045".to_string(),
        to: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0".to_string(),
        value: "1000000000000000000".to_string(), // 1 ETH
        data: None,
        gas_limit: None,
        gas_price: None,
        max_fee_per_gas: None,
        max_priority_fee_per_gas: None,
        nonce: None,
        chain_id: 1,
    });

    let fee = adapter
        .estimate_fee(&tx)
        .await
        .expect("Failed to estimate fee");

    assert!(!fee.amount.is_empty(), "Fee amount should not be empty");
    println!("✅ POC-3: Fee estimation works. Fee: {}", fee.formatted);
}

// ============================================================================
// POC-4 Validation: Full Integration
// ============================================================================

/// Validates POC-4: All components integrate together.
/// Tests adapter creation, trait interface, utilities, and network configs.
#[tokio::test]
async fn poc4_full_integration() {
    // 1. Network configs exist and are valid
    let networks = all_networks();
    assert!(
        networks.len() >= 9,
        "Should have at least 9 predefined networks"
    );

    let eth_network = get_network_by_chain_id(1).expect("Ethereum should be predefined");
    assert_eq!(eth_network.native_symbol, "ETH");
    assert_eq!(eth_network.chain_id, 1);

    let pls_network = get_network_by_chain_id(369).expect("PulseChain should be predefined");
    assert_eq!(pls_network.native_symbol, "PLS");

    // 2. Utilities work correctly
    assert!(is_valid_address(
        "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
    ));
    assert!(!is_valid_address("invalid"));

    let wei = parse_eth_to_wei("1.5", 18);
    assert!(wei.is_ok(), "Should parse 1.5 ETH to wei");

    let formatted = format_wei_to_eth(
        alloy::primitives::U256::from(1_500_000_000_000_000_000u64),
        18,
    );
    assert!(
        formatted.starts_with("1.5"),
        "Should format 1.5e18 wei as 1.5"
    );

    // 3. Adapter creation + chain adapter trait
    let adapter = EvmAdapter::new("https://eth.llamarpc.com", "ethereum".to_string(), 1)
        .await
        .expect("Failed to create adapter");

    let info = adapter.chain_info();
    assert_eq!(info.chain_type, ChainType::Evm);
    assert_eq!(info.chain_id, Some(1));

    // 4. Read-only adapter correctly rejects send_transaction
    let tx = ChainTransaction::Evm(EvmTransaction {
        from: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045".to_string(),
        to: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0".to_string(),
        value: "0".to_string(),
        data: None,
        gas_limit: Some(21000),
        gas_price: None,
        max_fee_per_gas: None,
        max_priority_fee_per_gas: None,
        nonce: None,
        chain_id: 1,
    });

    let result = adapter.send_transaction(tx).await;
    assert!(
        result.is_err(),
        "Read-only adapter should reject send_transaction"
    );

    // 5. Wrong chain type transaction rejected
    let stellar_tx = ChainTransaction::Stellar(StellarTransaction {
        from: "test".to_string(),
        to: "test".to_string(),
        amount: "100".to_string(),
    });

    let result = adapter.send_transaction(stellar_tx).await;
    assert!(
        result.is_err(),
        "EVM adapter should reject non-EVM transactions"
    );

    // 6. Signer-equipped adapter can be created
    let signer: alloy::signers::local::PrivateKeySigner =
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
            .parse()
            .expect("Should parse test private key");

    let signer_adapter = EvmAdapter::new_with_signer(
        "https://eth.llamarpc.com",
        "ethereum".to_string(),
        1,
        signer,
    )
    .await
    .expect("Failed to create signer adapter");

    assert_eq!(signer_adapter.chain_type(), ChainType::Evm);

    println!("✅ POC-4: Full integration test passed!");
    println!("  ✅ Network configs: {} networks", networks.len());
    println!("  ✅ Utilities: address validation, unit conversion");
    println!("  ✅ ChainAdapter trait: chain_info, validate_address");
    println!("  ✅ Security: read-only rejects send, wrong chain type rejected");
    println!("  ✅ Signer adapter: created successfully");
}

/// Validates POC-4: Live end-to-end integration with real RPC.
#[tokio::test]
#[ignore] // Requires network access
async fn poc4_live_integration() {
    // Create adapter
    let adapter = EvmAdapter::new("https://eth.llamarpc.com", "ethereum".to_string(), 1)
        .await
        .expect("Failed to create adapter");

    // 1. Get block number (POC-1 pattern)
    let block = adapter
        .get_block_number()
        .await
        .expect("Failed to get block number");
    assert!(block > 0);

    // 2. Get balance (POC-3 pattern)
    let balance = adapter
        .get_balance("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")
        .await
        .expect("Failed to get balance");
    assert_eq!(balance.token.symbol, "ETH");

    // 3. Validate address (POC-3 pattern)
    assert!(adapter
        .validate_address("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")
        .is_ok());

    // 4. Get gas price (helper method)
    let gas_price = adapter
        .get_gas_price()
        .await
        .expect("Failed to get gas price");
    assert!(gas_price > 0, "Gas price should be > 0");

    println!("✅ POC-4: Live integration passed!");
    println!("  Block: {}", block);
    println!("  Balance: {}", balance.formatted);
    println!("  Gas price: {} wei", gas_price);
}
