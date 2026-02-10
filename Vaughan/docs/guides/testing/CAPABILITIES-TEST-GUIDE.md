# Tauri Capabilities Testing Guide

## What We Implemented

**Tauri 2.0 Capabilities System** - Whitelist specific domains for direct Tauri IPC access

### Files Created/Modified

1. **`src-tauri/capabilities/dapp-access.json`** - Capability configuration
   - Whitelisted domains: PulseX, Uniswap, Sushi, InternetMoney
   - Granted permissions: dapp commands + core events

2. **`src/provider/provider-inject-window.js`** - Updated provider
   - Uses direct Tauri IPC when `window.__TAURI__` available
   - Clear error messages for non-whitelisted domains

---

## How It Works

### Whitelisted Domains (Have Tauri Access)

```
https://app.pulsex.com
https://*.pulsex.com
https://swap.internetmoney.io
https://app.uniswap.org
https://*.uniswap.org
https://app.sushi.com
https://*.sushi.com
```

**What happens**:
1. Window opens with external URL
2. Tauri checks capability configuration
3. Domain matches → `window.__TAURI__` is available ✅
4. Provider uses direct IPC
5. Fast, seamless communication

### Non-Whitelisted Domains (No Tauri Access)

**What happens**:
1. Window opens with external URL
2. Tauri checks capability configuration
3. Domain doesn't match → `window.__TAURI__` is `undefined` ❌
4. Provider shows error message
5. User must whitelist domain to use

---

## Testing Steps

### Test 1: Whitelisted Domain (PulseX)

**Steps**:
1. Stop Vaughan if running
2. Rebuild: `cd Vaughan && npm run tauri dev`
3. Open wallet, unlock with password
4. Navigate to dApp browser (Direct mode)
5. Enter URL: `https://app.pulsex.com`
6. Click "Open in New Window"
7. Open browser console (F12)

**Expected Console Output**:
```
[Vaughan] Initializing provider for separate window
[Vaughan] Has __TAURI__: true  ← KEY: Should be TRUE
[Vaughan] Communication mode: Direct Tauri IPC ✅
[Vaughan] Setting up direct Tauri IPC...
[Vaughan] Direct Tauri IPC setup complete ✅
[Vaughan] Provider injected successfully
[Vaughan] EIP-6963 announcement sent
```

**Expected Behavior**:
- ✅ `window.__TAURI__` is defined
- ✅ `window.ethereum` is defined
- ✅ Provider works
- ✅ Can connect wallet
- ✅ Can approve transactions

**Test Commands in Console**:
```javascript
// Check Tauri access
window.__TAURI__ !== undefined  // Should be true

// Check provider
window.ethereum !== undefined  // Should be true
window.ethereum.isVaughan  // Should be true

// Test request
await window.ethereum.request({ method: 'eth_chainId' })
// Should return chain ID (e.g., "0x171" for PulseChain)

// Test accounts
await window.ethereum.request({ method: 'eth_requestAccounts' })
// Should show approval modal
```

---

### Test 2: Non-Whitelisted Domain (Random Site)

**Steps**:
1. In dApp browser, enter URL: `https://example.com`
2. Click "Open in New Window"
3. Open browser console (F12)

**Expected Console Output**:
```
[Vaughan] Initializing provider for separate window
[Vaughan] Has __TAURI__: false  ← KEY: Should be FALSE
[Vaughan] Communication mode: Fallback (Domain not whitelisted) ❌
[Vaughan] This domain is not whitelisted in Tauri capabilities.
[Vaughan] Add this domain to src-tauri/capabilities/dapp-access.json
[Vaughan] Using fallback mode - limited functionality
```

**Expected Behavior**:
- ❌ `window.__TAURI__` is undefined
- ❌ Provider throws error on requests
- ✅ Clear error message shown
- ✅ Security working as intended

---

### Test 3: Wildcard Subdomain (*.pulsex.com)

**Steps**:
1. Try different PulseX subdomains:
   - `https://app.pulsex.com`
   - `https://beta.pulsex.com` (if exists)
   - `https://test.pulsex.com` (if exists)

**Expected**:
- ✅ All subdomains should have Tauri access
- ✅ Wildcard pattern `https://*.pulsex.com` matches all

---

### Test 4: Full Integration (PulseX Swap)

**Steps**:
1. Open `https://app.pulsex.com`
2. Click "Connect Wallet"
3. Select "Vaughan" from wallet list
4. Approve connection
5. Try to swap tokens
6. Approve transaction

**Expected**:
- ✅ Vaughan appears in wallet list
- ✅ Connection approval modal appears in Vaughan
- ✅ After approval, dApp shows connected
- ✅ Transaction approval modal appears in Vaughan
- ✅ Transaction executes successfully

---

## Troubleshooting

### Issue: `window.__TAURI__` is undefined on whitelisted domain

**Possible causes**:
1. Capability file not loaded
2. Window label doesn't match pattern
3. Tauri not rebuilt after adding capability

**Solutions**:
```bash
# 1. Check capability file exists
ls Vaughan/src-tauri/capabilities/dapp-access.json

# 2. Rebuild Tauri
cd Vaughan
npm run tauri dev

# 3. Check window label in console
# Should start with "dapp-" to match capability
```

### Issue: Provider requests fail with "command not found"

**Possible causes**:
1. Permissions not granted in capability
2. Command name mismatch

**Solutions**:
1. Check `dapp-access.json` has all required permissions
2. Verify command names match backend commands

### Issue: Events not received

**Possible causes**:
1. Event listeners not set up
2. Event names don't match

**Solutions**:
1. Check console for "Direct Tauri IPC setup complete"
2. Verify event names: `ethereum:accountsChanged`, `ethereum:chainChanged`

---

## Adding New Domains

### Step 1: Update Capability File

Edit `Vaughan/src-tauri/capabilities/dapp-access.json`:

```json
{
  "remote": {
    "urls": [
      "https://app.pulsex.com",
      "https://*.pulsex.com",
      "https://your-new-dapp.com",  ← Add here
      "https://*.your-new-dapp.com"  ← Wildcard for subdomains
    ]
  }
}
```

### Step 2: Rebuild

```bash
cd Vaughan
npm run tauri dev
```

### Step 3: Test

Open the new domain and verify `window.__TAURI__` is available.

---

## Security Notes

### ✅ What This Protects

1. **Untrusted domains** - Cannot access Tauri IPC at all
2. **Malicious sites** - Blocked by default
3. **Phishing** - Must match exact domain pattern
4. **XSS attacks** - Limited to whitelisted commands

### ⚠️ What You Must Verify

1. **Domain ownership** - Only whitelist domains you trust
2. **HTTPS only** - Never whitelist HTTP domains
3. **Exact domains** - Be specific, avoid overly broad wildcards
4. **Regular audits** - Review whitelisted domains periodically

### 🔒 Best Practices

1. **Start minimal** - Only whitelist domains you actively use
2. **User control** - Let users manage whitelist (future feature)
3. **Audit logs** - Log all IPC calls from external domains
4. **Revoke access** - Easy way to remove domains from whitelist

---

## Success Criteria

### ✅ Phase 1: Basic Functionality

- [ ] PulseX opens in separate window
- [ ] `window.__TAURI__` is defined on PulseX
- [ ] Provider works without errors
- [ ] Can connect wallet
- [ ] Can approve transactions

### ✅ Phase 2: Security

- [ ] Non-whitelisted domains blocked
- [ ] Clear error messages shown
- [ ] No security warnings in console
- [ ] Capability file properly configured

### ✅ Phase 3: Multiple dApps

- [ ] PulseX works
- [ ] Uniswap works
- [ ] Multiple windows open simultaneously
- [ ] Each window independent

---

## Next Steps

### If Tests Pass ✅

1. **Document for users**
   - How to add trusted domains
   - Security implications
   - Best practices

2. **Build UI for domain management**
   - Add/remove trusted domains
   - View current whitelist
   - Security warnings

3. **Ship v1.0**
   - Capabilities-based dApp access
   - Clean, secure architecture
   - No WalletConnect complexity

### If Tests Fail ❌

1. **Debug capability loading**
   - Check Tauri logs
   - Verify file format
   - Test with simple domain

2. **Check Tauri version**
   - Ensure Tauri 2.0+
   - Update if needed

3. **Fallback plan**
   - Keep WalletConnect as backup
   - Document limitations
   - Plan alternative approach

---

## Console Commands for Testing

```javascript
// === Basic Checks ===

// Check if Tauri is available
window.__TAURI__ !== undefined

// Check if provider exists
window.ethereum !== undefined

// Check provider identity
window.ethereum.isVaughan
window.ethereum.isMetaMask

// === Provider Methods ===

// Get chain ID
await window.ethereum.request({ method: 'eth_chainId' })

// Get accounts (triggers approval)
await window.ethereum.request({ method: 'eth_requestAccounts' })

// Get balance
await window.ethereum.request({ 
  method: 'eth_getBalance', 
  params: ['0xYourAddress', 'latest'] 
})

// === Event Listeners ===

// Listen for account changes
window.ethereum.on('accountsChanged', (accounts) => {
  console.log('Accounts changed:', accounts);
});

// Listen for chain changes
window.ethereum.on('chainChanged', (chainId) => {
  console.log('Chain changed:', chainId);
});

// Listen for disconnect
window.ethereum.on('disconnect', (error) => {
  console.log('Disconnected:', error);
});
```

---

## Expected Timeline

- **Setup**: 5 minutes (already done)
- **Test 1 (PulseX)**: 10 minutes
- **Test 2 (Non-whitelisted)**: 5 minutes
- **Test 3 (Wildcards)**: 5 minutes
- **Test 4 (Full integration)**: 15 minutes
- **Total**: ~40 minutes

---

## Status

**Implementation**: ✅ Complete  
**Testing**: 🔄 Ready to test  
**Documentation**: ✅ Complete

**Next**: Run tests and verify `window.__TAURI__` is available on whitelisted domains!

🚀 Let's test it!

