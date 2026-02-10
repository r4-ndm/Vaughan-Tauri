# RPC Handler - Request Processing

**File**: `src-tauri/src/dapp/rpc_handler.rs`

**Purpose**: Routes JSON-RPC requests to appropriate handlers, processes Ethereum methods, manages approvals.

---

## Overview

The RPC handler is the brain of the WebSocket bridge. It:
1. Routes requests to appropriate handlers
2. Validates parameters
3. Manages user approvals for sensitive operations
4. Interacts with wallet core
5. Returns formatted responses

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  RPC Handler (Router Pattern)                           │
│                                                          │
│  handle_request(state, window_label, origin, method, params)
│                      ↓                                   │
│  ┌────────────────────────────────────────────────┐     │
│  │  Method Router (match statement)               │     │
│  │  - Account methods → handle_request_accounts   │     │
│  │  - Network methods → handle_chain_id           │     │
│  │  - Read methods → handle_get_balance           │     │
│  │  - Write methods → handle_send_transaction     │     │
│  └────────────────────────────────────────────────┘     │
│                      ↓                                   │
│  ┌────────────────────────────────────────────────┐     │
│  │  Method Handler                                │     │
│  │  - Parse parameters                            │     │
│  │  - Validate inputs                             │     │
│  │  - Request approval (if needed)                │     │
│  │  - Execute operation                           │     │
│  │  - Return result                               │     │
│  └────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

---

## Main Entry Point

```rust
pub async fn handle_request(
    state: &VaughanState,
    window_label: &str,  // NEW: For approval routing
    origin: &str,        // dApp origin (e.g., "https://app.uniswap.org")
    method: &str,        // RPC method (e.g., "eth_requestAccounts")
    params: Vec<Value>,  // Method parameters
) -> Result<Value, WalletError>
```

**Parameters**:
- `state` - Application state (wallet, sessions, approvals)
- `window_label` - Window identifier (for routing approvals to correct window)
- `origin` - dApp origin (for session management and security)
- `method` - Ethereum JSON-RPC method name
- `params` - Array of method parameters

**Returns**:
- `Ok(Value)` - Method result as JSON value
- `Err(WalletError)` - Error with code and message

---

## Method Categories

### 1. Account Management

**No Approval Required** (after initial connection):
- `eth_accounts` - Get connected accounts

**Approval Required**:
- `eth_requestAccounts` - Request account access

### 2. Network Info

**No Approval Required**:
- `eth_chainId` - Get current chain ID (e.g., "0x171")
- `net_version` - Get network version (e.g., "369")

### 3. Read Operations

**No Approval Required** (passthrough to RPC):
- `eth_getBalance` - Get account balance
- `eth_blockNumber` - Get latest block number
- `eth_call` - Call contract (read-only)
- `eth_estimateGas` - Estimate gas for transaction
- `eth_gasPrice` - Get current gas price
- `eth_getTransactionCount` - Get account nonce
- `eth_getTransactionByHash` - Get transaction details
- `eth_getTransactionReceipt` - Get transaction receipt

### 4. Write Operations

**Approval Required**:
- `eth_sendTransaction` - Send transaction
- `personal_sign` - Sign message
- `eth_signTypedData_v4` - Sign typed data (EIP-712)

### 5. Network Switching

**Approval Required**:
- `wallet_switchEthereumChain` - Switch to different chain
- `wallet_addEthereumChain` - Add custom chain

---

## Method Router

```rust
pub async fn handle_request(
    state: &VaughanState,
    window_label: &str,
    origin: &str,
    method: &str,
    params: Vec<Value>,
) -> Result<Value, WalletError> {
    match method {
        // Account Management
        "eth_requestAccounts" => handle_request_accounts(state, window_label, origin).await,
        "eth_accounts" => handle_accounts(state, window_label, origin).await,

        // Network Info
        "eth_chainId" => handle_chain_id(state).await,
        "net_version" => handle_net_version(state).await,

        // Read Operations
        "eth_getBalance" => handle_get_balance(state, params).await,
        "eth_blockNumber" => handle_block_number(state).await,
        "eth_gasPrice" => handle_gas_price(state).await,
        "eth_getTransactionCount" => handle_get_transaction_count(state, params).await,

        // Write Operations
        "eth_sendTransaction" => handle_send_transaction(state, window_label, origin, params).await,

        // Unsupported
        _ => Err(WalletError::UnsupportedMethod(method.to_string())),
    }
}
```

---

## Handler Examples

### 1. eth_requestAccounts

Requests account access from user. Creates approval request if not already connected.

```rust
async fn handle_request_accounts(
    state: &VaughanState,
    window_label: &str,
    origin: &str,
) -> Result<Value, WalletError> {
    // Check if already connected for this window
    if let Some(connection) = state.session_manager
        .get_session_by_window(window_label, origin).await 
    {
        // Already connected - return accounts
        let accounts: Vec<String> = connection
            .accounts
            .iter()
            .map(|addr| format!("{:?}", addr))
            .collect();
        return Ok(serde_json::json!(accounts));
    }

    // Not connected - create approval request
    let request_type = ApprovalRequestType::Connection {
        origin: origin.to_string(),
    };

    // Add to approval queue (with window_label for routing)
    let (_id, rx) = state.approval_queue
        .add_request(window_label.to_string(), request_type)
        .await?;

    // Wait for user response
    let response = rx.await
        .map_err(|_| WalletError::Custom("Approval cancelled".to_string()))?;

    // Check if approved
    if !response.approved {
        return Err(WalletError::UserRejected);
    }

    // Get active account
    let account = state.active_account().await?;

    // Create session for this window
    state.session_manager
        .create_session_for_window(
            window_label,
            origin,
            None,  // name
            None,  // icon
            vec![account],
        )
        .await?;

    // Return accounts
    let accounts = vec![format!("{:?}", account)];
    Ok(serde_json::json!(accounts))
}
```

**Flow**:
1. Check if already connected → return accounts
2. Not connected → create approval request
3. Wait for user approval (modal appears in wallet UI)
4. If approved → create session and return accounts
5. If rejected → return error

---

### 2. eth_chainId

Returns current chain ID. No approval required.

```rust
async fn handle_chain_id(state: &VaughanState) -> Result<Value, WalletError> {
    let adapter = state.current_adapter().await?;
    let chain_id = adapter.chain_id();
    Ok(serde_json::json!(format!("0x{:x}", chain_id)))
}
```

**Example**:
- Input: `eth_chainId`, `[]`
- Output: `"0x171"` (PulseChain Testnet V4)

---

### 3. eth_getBalance

Gets account balance. No approval required.

```rust
async fn handle_get_balance(
    state: &VaughanState,
    params: Vec<Value>
) -> Result<Value, WalletError> {
    // Parse address from params
    let address_str = params
        .get(0)
        .and_then(|v| v.as_str())
        .ok_or(WalletError::InvalidParams)?;

    // Get balance using ChainAdapter trait
    let adapter = state.current_adapter().await?;
    let balance = adapter.get_balance(address_str).await?;

    // Return balance in wei as hex string
    Ok(serde_json::json!(format!("0x{}", balance.raw)))
}
```

**Example**:
- Input: `eth_getBalance`, `["0x742d35Cc...", "latest"]`
- Output: `"0x1bc16d674ec80000"` (2 ETH in wei)

---

### 4. eth_sendTransaction

Sends transaction. Requires user approval.

```rust
async fn handle_send_transaction(
    state: &VaughanState,
    window_label: &str,
    origin: &str,
    params: Vec<Value>,
) -> Result<Value, WalletError> {
    // 1. Parse transaction parameters
    let tx_obj = params.get(0)
        .and_then(|v| v.as_object())
        .ok_or(WalletError::InvalidParams)?;

    let from = tx_obj.get("from")
        .and_then(|v| v.as_str())
        .ok_or(WalletError::InvalidParams)?;
    
    let to = tx_obj.get("to")
        .and_then(|v| v.as_str())
        .ok_or(WalletError::InvalidParams)?;
    
    let value = tx_obj.get("value")
        .and_then(|v| v.as_str())
        .unwrap_or("0x0");

    // 2. Validate addresses
    let from_addr: Address = from.parse()
        .map_err(|_| WalletError::InvalidAddress(from.to_string()))?;
    let to_addr: Address = to.parse()
        .map_err(|_| WalletError::InvalidAddress(to.to_string()))?;

    // 3. Parse value
    let value_u256 = U256::from_str_radix(
        value.trim_start_matches("0x"), 
        16
    ).map_err(|_| WalletError::InvalidParams)?;

    // 4. Format for display
    let value_eth = format_wei_to_eth(value_u256, 18);

    // 5. Get gas price
    let adapter = state.current_adapter().await?;
    let gas_price = adapter.get_gas_price().await?;

    // 6. Create approval request
    let request_type = ApprovalRequestType::Transaction {
        origin: origin.to_string(),
        from: from.to_string(),
        to: to.to_string(),
        value: value_eth,
        gas_limit: Some(21000),
        gas_price: Some(gas_price.to_string()),
        data: None,
    };

    // 7. Add to approval queue
    let (_id, rx) = state.approval_queue
        .add_request(window_label.to_string(), request_type)
        .await?;

    // 8. Wait for user response (5 minute timeout)
    let response = tokio::time::timeout(
        Duration::from_secs(300),
        rx
    ).await??;

    // 9. Check if approved
    if !response.approved {
        return Err(WalletError::UserRejected);
    }

    // 10. Get password from response
    let password = response.data
        .and_then(|d| d.get("password").cloned())
        .and_then(|p| p.as_str().map(|s| s.to_string()))
        .ok_or(WalletError::Custom("Password required".to_string()))?;

    // 11. Verify password
    state.wallet_service.verify_password(&password).await?;

    // 12. Get signer
    let signer = state.wallet_service.get_signer(&from_addr).await?;

    // 13. Build transaction using Alloy
    let mut tx = TransactionRequest::default()
        .with_from(from_addr)
        .with_to(to_addr)
        .with_value(value_u256)
        .with_gas_limit(21000)
        .with_gas_price(gas_price);

    // 14. Get nonce
    let nonce = adapter.get_transaction_count(from_addr).await?;
    tx = tx.with_nonce(nonce);

    // 15. Send transaction
    let wallet = EthereumWallet::from(signer);
    let provider = ProviderBuilder::new()
        .with_recommended_fillers()
        .wallet(wallet)
        .on_http(adapter.rpc_url().parse()?);

    let pending_tx = provider.send_transaction(tx).await?;
    let tx_hash = *pending_tx.tx_hash();

    // 16. Return transaction hash
    Ok(serde_json::json!(format!("{:?}", tx_hash)))
}
```

**Flow**:
1. Parse transaction parameters
2. Validate addresses and amounts
3. Get current gas price
4. Create approval request
5. Wait for user approval (modal with password)
6. Verify password
7. Get signer for account
8. Build transaction with Alloy
9. Send transaction to network
10. Return transaction hash

---

## Approval System

### Approval Types

```rust
pub enum ApprovalRequestType {
    Connection {
        origin: String,
    },
    Transaction {
        origin: String,
        from: String,
        to: String,
        value: String,
        gas_limit: Option<u64>,
        gas_price: Option<String>,
        data: Option<String>,
    },
    SignMessage {
        origin: String,
        address: String,
        message: String,
    },
    SignTypedData {
        origin: String,
        address: String,
        data: String,
    },
}
```

### Creating Approval Request

```rust
// Add to approval queue
let (id, rx) = state.approval_queue
    .add_request(window_label.to_string(), request_type)
    .await?;

// Wait for response
let response = rx.await?;

// Check if approved
if !response.approved {
    return Err(WalletError::UserRejected);
}
```

### Approval Response

```rust
pub struct ApprovalResponse {
    pub id: String,
    pub approved: bool,
    pub data: Option<serde_json::Value>,  // e.g., password
}
```

---

## Session Management

### Creating Session

```rust
state.session_manager.create_session_for_window(
    window_label,  // "dapp-123"
    origin,        // "https://app.uniswap.org"
    None,          // name (optional)
    None,          // icon (optional)
    vec![account], // connected accounts
).await?;
```

### Checking Session

```rust
if let Some(connection) = state.session_manager
    .get_session_by_window(window_label, origin).await 
{
    // Session exists - return accounts
    let accounts = connection.accounts;
}
```

### Session Lifecycle

```
1. dApp calls eth_requestAccounts
2. User approves connection
3. Session created (window_label + origin)
4. Subsequent requests use existing session
5. Window closes → session cleaned up
```

---

## Error Handling

### Error Types

```rust
pub enum WalletError {
    UserRejected,                    // User rejected request
    InvalidParams,                   // Invalid method parameters
    InvalidAddress(String),          // Invalid Ethereum address
    UnsupportedMethod(String),       // Method not supported
    NetworkError(String),            // Network/RPC error
    TransactionFailed(String),       // Transaction failed
    Custom(String),                  // Custom error message
}
```

### Error Responses

```rust
// Convert WalletError to JSON-RPC error
match result {
    Ok(value) => json!({
        "id": id,
        "jsonrpc": "2.0",
        "result": value
    }),
    Err(e) => json!({
        "id": id,
        "jsonrpc": "2.0",
        "error": {
            "code": error_code(&e),
            "message": e.to_string()
        }
    })
}
```

---

## Security Features

### 1. Parameter Validation

```rust
// Validate address format
let address: Address = address_str.parse()
    .map_err(|_| WalletError::InvalidAddress(address_str.to_string()))?;

// Validate value format
let value = U256::from_str_radix(value_hex.trim_start_matches("0x"), 16)
    .map_err(|_| WalletError::InvalidParams)?;
```

### 2. Origin Tracking

```rust
// Every request includes origin
handle_request(state, window_label, origin, method, params)

// Origin stored in session
create_session_for_window(window_label, origin, ...)

// Origin shown in approval modal
ApprovalRequestType::Transaction {
    origin: "https://app.uniswap.org",
    ...
}
```

### 3. Password Verification

```rust
// User must enter password for transactions
let password = response.data
    .and_then(|d| d.get("password").cloned())
    .ok_or(WalletError::Custom("Password required".to_string()))?;

// Verify password before signing
state.wallet_service.verify_password(&password).await?;
```

### 4. Rate Limiting

```rust
// Check rate limit before processing
state.rate_limiter.check_rate_limit(window_label, method)?;
```

---

## Testing

### Test Account Request

```javascript
const accounts = await ethereum.request({
    method: 'eth_requestAccounts'
});
console.log('Accounts:', accounts);
// Expected: ["0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"]
```

### Test Chain ID

```javascript
const chainId = await ethereum.request({
    method: 'eth_chainId'
});
console.log('Chain ID:', chainId);
// Expected: "0x171" (PulseChain Testnet V4)
```

### Test Balance

```javascript
const balance = await ethereum.request({
    method: 'eth_getBalance',
    params: ['0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb', 'latest']
});
console.log('Balance:', balance);
// Expected: "0x1bc16d674ec80000" (2 ETH)
```

### Test Transaction

```javascript
const txHash = await ethereum.request({
    method: 'eth_sendTransaction',
    params: [{
        from: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        to: '0x1234567890123456789012345678901234567890',
        value: '0xde0b6b3a7640000', // 1 ETH
        gas: '0x5208',              // 21000
        gasPrice: '0x9184e72a000'   // 10 Gwei
    }]
});
console.log('Transaction hash:', txHash);
// Expected: "0xabc123..."
```

---

## Key Takeaways

1. **Router pattern** - Clean method routing
2. **Approval system** - User control over sensitive operations
3. **Session management** - Track connected dApps
4. **Parameter validation** - Security first
5. **Error handling** - Graceful failures
6. **Alloy integration** - Standard library for Ethereum operations
7. **Origin tracking** - Know which dApp made request

---

**Next**: [04-message-flow.md](./04-message-flow.md) - Complete message flow diagrams
