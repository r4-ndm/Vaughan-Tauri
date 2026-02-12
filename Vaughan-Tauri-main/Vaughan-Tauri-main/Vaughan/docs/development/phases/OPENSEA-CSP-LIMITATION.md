# OpenSea CSP Limitation - DOCUMENTED ⚠️

**Date**: 2026-02-10  
**Status**: ⚠️ Known Limitation  
**Issue**: OpenSea blocks WebSocket connections due to Content Security Policy

---

## Problem

OpenSea shows as "Connected" in the wallet UI, but the connection doesn't actually work in the browser.

### What's Happening

1. **Wallet opens OpenSea** → Creates auto-approved session ✅
2. **Provider script injected** → Runs before page loads ✅
3. **Provider tries to connect** → WebSocket connection BLOCKED by CSP ❌
4. **Session exists in backend** → Shows in "Connected dApps" UI ✅
5. **Frontend can't communicate** → Connection is useless ❌

### The CSP Error

```
Refused to connect to 'ws://localhost:8766/' because it violates 
the following Content Security Policy directive: "connect-src 'self' ..."
```

---

## Why This Happens

OpenSea's CSP only allows connections to their own domains, not localhost.

---

## Solutions

### Option 1: Browser Extension (Recommended)

Build Vaughan as a browser extension with native messaging to the Tauri app.
Extensions have privileges that bypass CSP.

### Option 2: WalletConnect

Implement WalletConnect protocol (QR code scanning).

### Option 3: Accept Limitation (Current)

Focus on dApps that work (Uniswap, Aave, 1inch, etc.).

---

## Compatible dApps

### ✅ Working
- Uniswap
- Aave  
- 1inch
- SushiSwap

### ❌ Not Working
- OpenSea (CSP blocks WebSocket)

---

## Recommendation

**Short term**: Document limitation, focus on compatible dApps  
**Long term**: Build browser extension (Phase 3)

---

**Status**: Known limitation, browser extension needed for full compatibility
