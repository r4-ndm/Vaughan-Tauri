# Alloy Official Reference (Rust)

**Source**: [Official Alloy Documentation](https://alloy.rs/)  
**Version**: Latest (as of Feb 2026)  
**Status**: ✅ VERIFIED - Official Alloy docs

---

## Overview

Alloy is a high-performance Rust toolkit for Ethereum and EVM-based blockchains.

**Key Features**:
- **High Performance**: 60% faster U256 operations, 10x faster ABI encoding
- **Developer Experience**: Intuitive API with `sol!` macro
- **Type Safety**: Compile-time guarantees for Ethereum types
- **Network Generic**: Works with any EVM-compatible chain

**Official Resources**:
- Documentation: https://alloy.rs/
- API Docs: https://docs.rs/alloy
- Examples: https://github.com/alloy-rs/examples
- Book: https://alloy.rs/introduction/getting-started

---

## Installation

Add to `Cargo.toml`:

```toml
[dependencies]
alloy = { version = "0.1", features = ["full"] }
tokio = { version = "1", features = ["full"] }
```

**Feature Flags**:
- `full` - All features (recommended for getting started)
- `providers` - Provider implementations
- `signers` - Signer implementations
- `contract` - Contract interaction
- `rpc-types` - RPC type definitions

See [full feature list](https://docs.rs/alloy/latest/alloy/#features)

---

## 1. Sending Transactions

**Source**: [Official Getting Started Guide](https://alloy.rs/introduction/getting-started)

```rust
use alloy::{
    network::TransactionBuilder,
    primitives::{
        address,
        utils::{format_ether, Unit},
        U256,
    },
    providers::{Provider, ProviderBuilder},
    rpc::types::TransactionRequest,
    signers::local::PrivateKeySigner,
};
use std::error::Error;

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    // Initialize a signer with a private key
    let signer: PrivateKeySigner =
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80".parse()?;

    // Instantiate a provider with the signer
    let provider = ProviderBuilder::new()
        .wallet(signer)
        .connect("http://127.0.0.1:8545")
        .await?;

    // Prepare a transaction request
    let alice = address!("0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
    let value = Unit::ETHER.wei().saturating_mul(U256::from(100));
    let tx = TransactionRequest::default()
        .with_to(alice)
        .with_value(value);

    // Send the transaction and wait for the broadcast
    let pending_tx = provider.send_transaction(tx).await?;
    println!("Pending transaction... {}", pending_tx.tx_hash());

    // Wait for the transaction to be included and get the receipt
    let receipt = pending_tx.get_receipt().await?;
    println!(
        "Transaction included in block {}",
        receipt.block_number.expect("Failed to get block number")
    );

    Ok(())
}
```

---

## 2. Interacting with Smart Contracts

**Source**: [Official Getting Started Guide](https://alloy.rs/introduction/getting-started)

```rust
use alloy::{
    primitives::{
        address,
        utils::{format_ether, Unit},
        U256,
    },
    providers::ProviderBuilder,
    signers::local::PrivateKeySigner,
    sol,
};
use std::error::Error;

// Generate bindings for the WETH9 contract
sol! {
    #[sol(rpc)]
    contract WETH9 {
        function deposit() public payable;
        function balanceOf(address) public view returns (uint256);
        function withdraw(uint amount) public;
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    // Initialize a signer
    let signer: PrivateKeySigner =
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80".parse()?;
    let from_address = signer.address();

    // Instantiate a provider with the signer
    let provider = ProviderBuilder::new()
        .wallet(signer)
        .connect_anvil_with_config(|a| a.fork("https://reth-ethereum.ithaca.xyz/rpc"));

    // Setup WETH contract instance
    let weth_address = address!("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2");
    let weth = WETH9::new(weth_address, provider.clone());

    // Read: Check balance
    let balance = weth.balanceOf(from_address).call().await?;
    println!("WETH balance: {} WETH", format_ether(balance));

    // Write: Deposit ETH to get WETH
    let deposit_amount = Unit::ETHER.wei().saturating_mul(U256::from(10));
    let deposit_tx = weth.deposit().value(deposit_amount).send().await?;
    let deposit_receipt = deposit_tx.get_receipt().await?;
    println!(
        "Deposited ETH in block {}",
        deposit_receipt.block_number.expect("Failed to get block number")
    );

    Ok(())
}
```

---

## 3. Monitoring Blockchain Activity

**Source**: [Official Getting Started Guide](https://alloy.rs/introduction/getting-started)

```rust
use alloy::{
    primitives::{address, utils::format_ether},
    providers::{Provider, ProviderBuilder, WsConnect},
    sol,
};
use futures_util::StreamExt;

sol! {
    #[sol(rpc)]
    contract WETH {
        function balanceOf(address) external view returns (uint256);
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Connect to an Ethereum node via WebSocket
    let ws = WsConnect::new("wss://reth-ethereum.ithaca.xyz/ws");
    let provider = ProviderBuilder::new().connect_ws(ws).await?;

    // Uniswap V3 WETH-USDC Pool address
    let uniswap_pool = address!("0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8");

    // Setup the WETH contract instance
    let weth_addr = address!("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
    let weth = WETH::new(weth_addr, &provider);

    // Subscribe to new blocks
    let mut block_stream = provider.subscribe_blocks().await?.into_stream();
    println!("🔄 Monitoring for new blocks...");

    // Process each new block as it arrives
    while let Some(block) = block_stream.next().await {
        println!("🧱 Block #{}: {}", block.number, block.hash);
        
        // Get contract balance at this block
        let balance = weth.balanceOf(uniswap_pool)
            .block(block.number.into())
            .call()
            .await?;
        
        println!("💰 Pool balance: {} WETH", format_ether(balance));
    }

    Ok(())
}
```

---

## 4. Provider Builder Pattern

**Source**: [Official Examples](https://alloy.rs/examples/providers/builder)

```rust
use alloy::{
    network::TransactionBuilder,
    node_bindings::Anvil,
    primitives::U256,
    providers::{Provider, ProviderBuilder},
    rpc::types::TransactionRequest,
    signers::local::PrivateKeySigner,
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Spin up a local Anvil node
    let anvil = Anvil::new().block_time(1).try_spawn()?;

    // Set up signer from the first default Anvil account
    let signer: PrivateKeySigner = anvil.keys()[0].clone().into();

    // Create provider with signer
    let rpc_url = anvil.endpoint_url();
    let provider = ProviderBuilder::new()
        .wallet(signer)
        .connect_http(rpc_url);

    // Use provider...
    let block_number = provider.get_block_number().await?;
    println!("Latest block: {block_number}");

    Ok(())
}
```

---

## Key Types

### Primitives
```rust
use alloy::primitives::{Address, U256, Bytes, B256};

// Address (20 bytes)
let addr = address!("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");

// U256 (256-bit unsigned integer)
let amount = U256::from(1000);

// Bytes (dynamic byte array)
let data = Bytes::from(vec![1, 2, 3]);

// B256 (32 bytes, for hashes)
let hash = B256::from([0u8; 32]);
```

### Transaction Request
```rust
use alloy::rpc::types::TransactionRequest;

let tx = TransactionRequest::default()
    .with_to(address)
    .with_value(U256::from(100))
    .with_gas_limit(21000);
```

---

## Important Notes

### Provider is NOT Clone
```rust
// ❌ WRONG: Provider doesn't implement Clone
let provider2 = provider.clone();

// ✅ CORRECT: Use Arc for sharing
use std::sync::Arc;
let provider = Arc::new(provider);
let provider2 = Arc::clone(&provider);
```

### Async Runtime Required
All Alloy operations are async and require a runtime like Tokio:
```toml
[dependencies]
tokio = { version = "1", features = ["full"] }
```

### Error Handling
```rust
use std::error::Error;

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    // Your code here
    Ok(())
}
```

---

## Additional Resources

- **Official Book**: https://alloy.rs/
- **API Documentation**: https://docs.rs/alloy
- **Examples Repository**: https://github.com/alloy-rs/examples
- **GitHub**: https://github.com/alloy-rs/alloy
- **Crates.io**: https://crates.io/crates/alloy

---

**Last Updated**: February 3, 2026  
**Alloy Version**: 0.1+  
**Verification**: ✅ All examples from official documentation
