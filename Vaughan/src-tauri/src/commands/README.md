# Tauri Commands

**Purpose**: IPC bridge between React frontend and Rust backend

This directory contains all Tauri commands that the frontend can invoke. Commands are thin wrappers that delegate to the wallet core.

## Architecture Layer

This is **Layer 2** in the 5-layer architecture:
```
Layer 4: UI (React)           → Calls commands via invoke()
Layer 3: Provider APIs        → EIP-1193 translation
Layer 2: Tauri Commands       → IPC bridge (THIS LAYER)
Layer 1: Wallet Core          → Business logic
Layer 0: Chain Adapters       → Chain-specific operations
```

## Files

- `transaction.rs` - Transaction commands (send, sign, estimate gas, etc.)
- `network.rs` - Network commands (switch network, get balance, etc.)
- `wallet.rs` - Wallet commands (create account, import, export, etc.)
- `security.rs` - Security commands (lock, unlock, change password, etc.)
- `token.rs` - Token commands (get price, add custom token, etc.)
- `dapp.rs` - dApp commands (eth_request handler, connect, disconnect, etc.)

## Command Structure

All commands follow this pattern:

```rust
#[tauri::command]
pub async fn command_name(
    state: State<'_, Arc<Mutex<VaughanState>>>,
    param1: String,
    param2: u64,
) -> Result<ReturnType, String> {
    // 1. Lock state
    let state = state.lock().await;
    
    // 2. Delegate to wallet core
    let result = state.wallet.some_operation(param1, param2).await
        .map_err(|e| e.to_string())?;
    
    // 3. Return result
    Ok(result)
}
```

## Design Principles

### 1. Thin Layer
Commands should be minimal:
- ✅ Lock state
- ✅ Delegate to wallet core
- ✅ Convert errors to strings
- ✅ Return result

Commands should NOT:
- ❌ Contain business logic
- ❌ Make RPC calls directly
- ❌ Perform complex operations
- ❌ Access chain adapters directly

### 2. Security
- **Origin Verification**: Sensitive commands check `window.label()` to ensure they're called from the main wallet window, not a dApp window
- **Input Validation**: All inputs validated in Rust (never trust frontend)
- **Error Messages**: Don't leak sensitive information in error messages

### 3. Error Handling
- Commands return `Result<T, String>` (Tauri requirement)
- Convert `WalletError` to user-friendly strings
- Log detailed errors server-side
- Return generic errors to frontend

## Origin Verification

Sensitive commands (send transaction, export keys, etc.) must verify origin:

```rust
#[tauri::command]
pub async fn send_transaction(
    window: Window,
    state: State<'_, Arc<Mutex<VaughanState>>>,
    to: String,
    amount: String,
) -> Result<String, String> {
    // Verify this is called from main wallet window, not dApp
    if window.label() != "main" {
        return Err("Unauthorized: This command can only be called from the wallet".to_string());
    }
    
    // ... rest of command
}
```

## Command Categories

### Transaction Commands (6)
- `validate_transaction` - Validate transaction parameters
- `estimate_gas` - Estimate gas for transaction
- `build_transaction` - Build unsigned transaction
- `sign_transaction` - Sign transaction (requires password)
- `send_transaction` - Sign and send transaction
- `get_transaction_status` - Get transaction status

### Network Commands (5)
- `switch_network` - Switch active network
- `get_balance` - Get native token balance
- `get_token_balance` - Get ERC20 token balance
- `get_token_balances` - Get all token balances
- `get_network_info` - Get current network info

### Wallet Commands (6)
- `import_account` - Import account from private key/mnemonic
- `create_account` - Create new account
- `switch_account` - Switch active account
- `get_accounts` - Get all accounts
- `export_account` - Export account (requires password)
- `sign_message` - Sign arbitrary message

### Security Commands (4)
- `unlock_wallet` - Unlock wallet with password
- `lock_wallet` - Lock wallet
- `change_password` - Change wallet password
- `verify_password` - Verify password is correct

### Token Commands (4)
- `get_token_price` - Get token price in USD
- `refresh_token_prices` - Refresh all token prices
- `add_custom_token` - Add custom token to list
- `remove_custom_token` - Remove custom token

### dApp Commands (Special)
- `eth_request` - Handle EIP-1193 requests from dApps
- `open_dapp_test` - Open test dApp window (POC reference)

## Implementation Status

- [ ] `transaction.rs` - Transaction commands
- [ ] `network.rs` - Network commands
- [ ] `wallet.rs` - Wallet commands
- [ ] `security.rs` - Security commands
- [ ] `token.rs` - Token commands
- [ ] `dapp.rs` - dApp commands
- [ ] Tests for all commands

## Frontend Usage

Commands are called from React using `@tauri-apps/api`:

```typescript
import { invoke } from '@tauri-apps/api/core';

// Call command
const balance = await invoke<string>('get_balance', {
  address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'
});
```

## References

- Tauri State Management: `.kiro/specs/external_refs/Tauri-State-Management.md`
- TypeScript Integration: `.kiro/specs/external_refs/TypeScript-Tauri-Integration.md`
- POC Commands: `Vaughan/src-tauri/src/lib.rs` (reference examples)
