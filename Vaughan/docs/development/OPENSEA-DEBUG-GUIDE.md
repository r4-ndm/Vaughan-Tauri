# OpenSea Connection Debugging Guide

**Date**: 2026-02-10  
**Issue**: OpenSea doesn't connect to Vaughan wallet  
**Goal**: Identify and fix compatibility issues

---

## 🔍 Debugging Steps

### 1. Check Browser Console

When you open OpenSea, check the browser console (F12) for:

**Expected Messages**:
```
[Vaughan-Ext] Initializing extension-style provider
[Vaughan-Ext] Connecting to WebSocket on port 8766...
[Vaughan-Ext] Connected to port 8766! ✅
[Vaughan-Ext] Provider injected successfully ✅
[Vaughan-Ext] EIP-6963 announcement sent ✅
```

**Possible Errors**:
- `WebSocket connection failed` - Backend not running
- `Provider already injected` - Another wallet is installed
- `Request timeout` - Backend not responding
- `Unsupported method` - Missing RPC method

### 2. Check Network Tab

Look for:
- WebSocket connection to `ws://localhost:8766`
- WebSocket messages (requests/responses)
- Any failed requests

### 3. Check What OpenSea Expects

OpenSea might be looking for:
1. **Specific wallet name** - They might check `window.ethereum.isMetaMask`
2. **EIP-6963 support** - Multi-wallet discovery
3. **Specific RPC methods** - Methods we haven't implemented yet
4. **WalletConnect** - They might prefer WalletConnect over direct injection

---

## 🐛 Common Issues

### Issue 1: OpenSea Doesn't Detect Wallet

**Symptoms**:
- "Connect Wallet" button doesn't show Vaughan
- Only shows MetaMask/WalletConnect

**Possible Causes**:
1. **EIP-6963 not working** - OpenSea uses this for wallet discovery
2. **Provider injected too late** - Page loaded before provider ready
3. **Another wallet interfering** - MetaMask/other wallet already injected

**Debug**:
```javascript
// In browser console
console.log('window.ethereum:', window.ethereum);
console.log('isVaughan:', window.ethereum?.isVaughan);
console.log('isMetaMask:', window.ethereum?.isMetaMask);
```

### Issue 2: Connection Request Fails

**Symptoms**:
- Wallet appears in list
- Clicking "Connect" does nothing or shows error

**Possible Causes**:
1. **eth_requestAccounts fails** - Backend error
2. **Missing RPC methods** - OpenSea calls unsupported method
3. **Chain ID mismatch** - OpenSea expects Ethereum mainnet

**Debug**:
```javascript
// In browser console
window.ethereum.request({ method: 'eth_requestAccounts' })
  .then(accounts => console.log('Accounts:', accounts))
  .catch(error => console.error('Error:', error));
```

### Issue 3: Wrong Network

**Symptoms**:
- Wallet connects but shows "Wrong Network"
- OpenSea expects Ethereum mainnet (Chain ID: 1)

**Current Chain**:
- Vaughan is on PulseChain Testnet V4 (Chain ID: 369/0x171)

**Solution**:
- OpenSea only works on Ethereum mainnet
- Need to add network switching support
- Or test with a dApp that supports PulseChain

---

## 🔧 Potential Fixes

### Fix 1: Add Missing RPC Methods

OpenSea might call methods we haven't implemented:

**Check logs for**:
```
[Vaughan-Ext] Request: <method_name>
Error: Unsupported method
```

**Common methods OpenSea uses**:
- `eth_getBalance` ✅ (implemented)
- `eth_call` ❌ (not implemented)
- `eth_estimateGas` ❌ (not implemented)
- `eth_getTransactionReceipt` ❌ (not implemented)
- `wallet_switchEthereumChain` ❌ (not implemented)
- `wallet_addEthereumChain` ❌ (not implemented)

### Fix 2: Improve EIP-6963 Announcement

OpenSea uses EIP-6963 for wallet discovery. Make sure:

1. **Announcement happens early**:
```javascript
// Announce immediately
announceProvider();

// Announce on DOMContentLoaded
document.addEventListener('DOMContentLoaded', announceProvider);

// Listen for requests
window.addEventListener('eip6963:requestProvider', announceProvider);
```

2. **Provider info is correct**:
```javascript
const providerInfo = {
  uuid: '350670db-19fa-4704-a166-e52e178b59d2',
  name: 'Vaughan Wallet',
  icon: '<base64_icon>',
  rdns: 'io.vaughan.wallet'
};
```

### Fix 3: Add Network Switching

OpenSea requires Ethereum mainnet. Add support for:

```rust
// In rpc_handler.rs
async fn handle_switch_chain(
    state: &VaughanState,
    window_label: &str,
    origin: &str,
    params: Vec<Value>,
) -> Result<Value, WalletError> {
    // Parse chain ID from params
    let chain_id_hex = params.get(0)
        .and_then(|v| v.get("chainId"))
        .and_then(|v| v.as_str())
        .ok_or(WalletError::InvalidParams)?;
    
    // Convert to u64
    let chain_id = u64::from_str_radix(
        chain_id_hex.trim_start_matches("0x"), 
        16
    )?;
    
    // Check if chain is supported
    if chain_id != 1 && chain_id != 369 {
        return Err(WalletError::UnsupportedChain(chain_id));
    }
    
    // Create approval request
    let request_type = ApprovalRequestType::NetworkSwitch {
        origin: origin.to_string(),
        chain_id,
    };
    
    // Wait for approval
    let (id, rx) = state.approval_queue
        .add_request(window_label.to_string(), request_type)
        .await?;
    
    let response = rx.await?;
    
    if !response.approved {
        return Err(WalletError::UserRejected);
    }
    
    // Switch network
    state.switch_network(chain_id).await?;
    
    Ok(serde_json::json!(null))
}
```

---

## 📊 Testing Checklist

### Basic Provider Tests

- [ ] `window.ethereum` exists
- [ ] `window.ethereum.isVaughan === true`
- [ ] `window.ethereum.isMetaMask === true`
- [ ] `window.ethereum.request` is a function

### EIP-6963 Tests

- [ ] `eip6963:announceProvider` event fires
- [ ] Provider info includes name, icon, rdns
- [ ] Multiple announcements work (page reload)

### Connection Tests

- [ ] `eth_requestAccounts` returns accounts
- [ ] `eth_accounts` returns accounts after connection
- [ ] `eth_chainId` returns correct chain ID
- [ ] `accountsChanged` event fires

### OpenSea-Specific Tests

- [ ] Wallet appears in OpenSea's wallet list
- [ ] Clicking wallet triggers connection
- [ ] Connection succeeds or shows clear error
- [ ] If wrong network, shows network switch prompt

---

## 🎯 Next Steps

1. **Open OpenSea with console open** (F12)
2. **Check for errors** in console
3. **Try to connect** and note what happens
4. **Share console logs** so we can identify the issue
5. **Implement missing methods** based on errors

---

## 📝 Console Commands for Testing

```javascript
// Check provider
console.log('Provider:', window.ethereum);

// Check connection
window.ethereum.request({ method: 'eth_requestAccounts' })
  .then(console.log)
  .catch(console.error);

// Check chain ID
window.ethereum.request({ method: 'eth_chainId' })
  .then(console.log)
  .catch(console.error);

// Listen for events
window.ethereum.on('accountsChanged', accounts => {
  console.log('Accounts changed:', accounts);
});

window.ethereum.on('chainChanged', chainId => {
  console.log('Chain changed:', chainId);
});

// Check EIP-6963
window.addEventListener('eip6963:announceProvider', (event) => {
  console.log('Provider announced:', event.detail);
});

// Request provider announcement
window.dispatchEvent(new Event('eip6963:requestProvider'));
```

---

**Status**: 🔍 INVESTIGATING  
**Priority**: HIGH (improves compatibility)  
**Complexity**: MEDIUM (depends on what's missing)
