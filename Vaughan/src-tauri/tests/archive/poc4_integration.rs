// ============================================================================
// Vaughan Wallet - POC-4: Integration Test (ARCHIVED)
// ============================================================================
//
// Status: Archived. Kept for historical reference; not part of the active
// test suite. See README "Code hygiene" section for rationale.
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
// Original usage:
//   cargo test --test poc4_integration                # Run non-network tests
//   cargo test --test poc4_integration -- --ignored   # Run ALL tests (needs network)
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
// ... original test body omitted for brevity ...

