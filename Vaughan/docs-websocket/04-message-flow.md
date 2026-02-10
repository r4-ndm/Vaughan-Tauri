# Complete Message Flow

**Purpose**: Detailed diagrams showing how messages flow through the entire WebSocket bridge system.

---

## Overview

This document shows the complete flow of messages from dApp to wallet and back, with timing, error handling, and approval flows.

---

## Flow 1: Connection Request (eth_requestAccounts)

### First Time Connection

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. dApp JavaScript                                              │
│    const accounts = await window.ethereum.request({             │
│        method: 'eth_requestAccounts'                            │
│    });                                                           │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. Provider Script (provider-inject-extension.js)               │
│    - Creates JSON-RPC request                                   │
│    - Generates unique ID                                        │
│    - Stores promise handlers in pendingRequests map             │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. WebSocket Send                                               │
│    ws.send(JSON.stringify({                                     │
│        id: 1,                                                   │
│        jsonrpc: "2.0",                                          │
│        method: "eth_requestAccounts",                           │
│        params: []                                               │
│    }));                                                         │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. Rust WebSocket Server (lib.rs)                              │
│    - Receives text message                                      │
│    - Parses JSON                                                │
│    - Extracts method and params                                 │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. RPC Handler (rpc_handler.rs)                                │
│    handle_request_accounts(state, "websocket", "external")      │
│    - Checks if session exists → NO                              │
│    - Creates approval request                                   │
│    - Adds to approval queue                                     │
│    - Returns oneshot receiver                                   │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. Approval Queue (approval.rs)                                │
│    - Generates approval ID                                      │
│    - Creates oneshot channel                                    │
│    - Stores in pending_approvals map                            │
│    - Returns (id, receiver)                                     │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 7. Frontend Polling (useApprovalPolling.ts)                    │
│    - Polls get_pending_approvals every 500ms                    │
│    - Detects new approval request                               │
│    - Calls onApprovalDetected callback                          │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 8. Wallet UI (WalletView.tsx)                                  │
│    - Shows ConnectionApproval modal                             │
│    - Displays origin: "external"                                │
│    - User clicks "Connect"                                      │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 9. Approval Response (WalletView.tsx)                          │
│    await invoke('respond_to_approval', {                        │
│        response: {                                              │
│            id: approval.id,                                     │
│            approved: true,                                      │
│            data: null                                           │
│        }                                                        │
│    });                                                          │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 10. Approval Queue (approval.rs)                               │
│     - Finds pending approval by ID                              │
│     - Sends response through oneshot channel                    │
│     - Removes from pending_approvals                            │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 11. RPC Handler (rpc_handler.rs)                               │
│     - Receives response from channel                            │
│     - Checks if approved → YES                                  │
│     - Gets active account                                       │
│     - Creates session                                           │
│     - Returns accounts array                                    │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 12. WebSocket Server (lib.rs)                                  │
│     - Builds success response                                   │
│     - Sends back to client                                      │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 13. Provider Script (provider-inject-extension.js)             │
│     - Receives response                                         │
│     - Finds pending request by ID                               │
│     - Resolves promise with result                              │
│     - Updates _accounts cache                                   │
│     - Emits 'accountsChanged' event                             │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 14. dApp JavaScript                                             │
│     console.log('Connected:', accounts);                        │
│     // ["0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"]            │
└─────────────────────────────────────────────────────────────────┘
```

**Timing**: ~2-5 seconds (depends on user response time)

---

## Flow 2: Subsequent Account Request

### Already Connected

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. dApp JavaScript                                              │
│    const accounts = await window.ethereum.request({             │
│        method: 'eth_accounts'                                   │
│    });                                                           │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. Provider Script (provider-inject-extension.js)               │
│    - Checks method === 'eth_accounts'                           │
│    - Returns cached _accounts immediately                       │
│    - NO WebSocket request needed!                               │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. dApp JavaScript                                              │
│    console.log('Accounts:', accounts);                          │
│    // ["0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"]            │
└─────────────────────────────────────────────────────────────────┘
```

**Timing**: <1ms (cached, no network request)

---

## Flow 3: Read Operation (eth_getBalance)

### No Approval Required

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. dApp JavaScript                                              │
│    const balance = await window.ethereum.request({              │
│        method: 'eth_getBalance',                                │
│        params: ['0x742d35Cc...', 'latest']                      │
│    });                                                           │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. Provider → WebSocket → Server → RPC Handler                 │
│    (Same as Flow 1, steps 2-4)                                  │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. RPC Handler (rpc_handler.rs)                                │
│    handle_get_balance(state, params)                            │
│    - Parses address from params                                 │
│    - Gets current adapter                                       │
│    - Calls adapter.get_balance(address)                         │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. Chain Adapter (evm/adapter.rs)                              │
│    - Calls RPC provider.get_balance(address)                    │
│    - Returns Balance { raw, formatted }                         │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. RPC Handler                                                  │
│    - Formats as hex string                                      │
│    - Returns Ok("0x1bc16d674ec80000")                           │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. Server → WebSocket → Provider → dApp                        │
│    (Same as Flow 1, steps 12-14)                                │
└─────────────────────────────────────────────────────────────────┘
```

**Timing**: ~100-500ms (depends on RPC response time)

---

## Flow 4: Transaction (eth_sendTransaction)

### With Approval and Password

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. dApp JavaScript                                              │
│    const txHash = await window.ethereum.request({               │
│        method: 'eth_sendTransaction',                           │
│        params: [{                                               │
│            from: '0x742d35Cc...',                               │
│            to: '0x1234567890...',                               │
│            value: '0xde0b6b3a7640000'  // 1 ETH                 │
│        }]                                                       │
│    });                                                           │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2-4. Provider → WebSocket → Server                             │
│      (Same as Flow 1, steps 2-4)                                │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. RPC Handler (rpc_handler.rs)                                │
│    handle_send_transaction(state, "websocket", "external", params)
│    - Parses transaction parameters                              │
│    - Validates addresses                                        │
│    - Parses value                                               │
│    - Gets gas price                                             │
│    - Creates approval request (Transaction type)                │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6-7. Approval Queue → Frontend Polling                         │
│      (Same as Flow 1, steps 6-7)                                │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 8. Wallet UI (WalletView.tsx)                                  │
│    - Shows TransactionApproval modal                            │
│    - Displays:                                                  │
│      * Origin: "external"                                       │
│      * From: "0x742d35Cc..."                                    │
│      * To: "0x1234567890..."                                    │
│      * Value: "1.0 ETH"                                         │
│      * Gas: "21000"                                             │
│    - User enters password                                       │
│    - User clicks "Approve"                                      │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 9. Approval Response (WalletView.tsx)                          │
│    await invoke('respond_to_approval', {                        │
│        response: {                                              │
│            id: approval.id,                                     │
│            approved: true,                                      │
│            data: { password: "test123" }  // ← Password!        │
│        }                                                        │
│    });                                                          │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 10. Approval Queue → RPC Handler                               │
│     (Same as Flow 1, steps 10-11)                               │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 11. RPC Handler (rpc_handler.rs)                               │
│     - Receives approval response                                │
│     - Checks if approved → YES                                  │
│     - Extracts password from response.data                      │
│     - Verifies password                                         │
│     - Gets signer for from address                              │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 12. Transaction Building (Alloy)                               │
│     - Creates TransactionRequest                                │
│     - Sets from, to, value, gas, gasPrice                       │
│     - Gets nonce from network                                   │
│     - Creates provider with signer                              │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 13. Network Submission                                          │
│     - provider.send_transaction(tx)                             │
│     - Signs transaction with private key                        │
│     - Submits to RPC node                                       │
│     - Returns pending transaction                               │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 14. RPC Handler                                                 │
│     - Extracts transaction hash                                 │
│     - Returns Ok("0xabc123...")                                 │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 15. Server → WebSocket → Provider → dApp                       │
│     (Same as Flow 1, steps 12-14)                               │
└─────────────────────────────────────────────────────────────────┘
```

**Timing**: ~5-10 seconds (depends on user response + network)

---

## Flow 5: Error Handling

### User Rejects Request

```
┌─────────────────────────────────────────────────────────────────┐
│ 1-7. Same as Flow 1 (steps 1-7)                                │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 8. Wallet UI (WalletView.tsx)                                  │
│    - Shows approval modal                                       │
│    - User clicks "Reject"                                       │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 9. Approval Response                                            │
│    await invoke('respond_to_approval', {                        │
│        response: {                                              │
│            id: approval.id,                                     │
│            approved: false,  // ← Rejected!                     │
│            data: null                                           │
│        }                                                        │
│    });                                                          │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 10. RPC Handler                                                 │
│     - Receives response                                         │
│     - Checks if approved → NO                                   │
│     - Returns Err(WalletError::UserRejected)                    │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 11. WebSocket Server                                            │
│     - Builds error response                                     │
│     {                                                           │
│         "id": 1,                                                │
│         "jsonrpc": "2.0",                                       │
│         "error": {                                              │
│             "code": 4001,                                       │
│             "message": "User rejected request"                  │
│         }                                                       │
│     }                                                           │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 12. Provider Script                                             │
│     - Receives error response                                   │
│     - Finds pending request                                     │
│     - Rejects promise with error                                │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 13. dApp JavaScript                                             │
│     try {                                                       │
│         const accounts = await ethereum.request(...);           │
│     } catch (error) {                                           │
│         console.error('User rejected:', error);                 │
│         // error.code === 4001                                  │
│     }                                                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Timing Summary

| Operation | Typical Time | Notes |
|-----------|-------------|-------|
| eth_accounts (cached) | <1ms | No network request |
| eth_chainId | ~50-100ms | WebSocket + local state |
| eth_getBalance | ~100-500ms | WebSocket + RPC call |
| eth_requestAccounts | ~2-5s | Requires user approval |
| eth_sendTransaction | ~5-10s | Approval + password + network |

---

## Key Takeaways

1. **Caching** - Provider caches frequently accessed data
2. **Approval flow** - User control over sensitive operations
3. **Password protection** - Transactions require password
4. **Error handling** - Graceful rejection and error messages
5. **Async all the way** - Non-blocking operations
6. **Timeout protection** - 5 minute timeout for approvals

---

**Next**: [05-csp-bypass-explained.md](./05-csp-bypass-explained.md) - Deep dive into CSP bypass mechanism
