# Linux Setup Guide

## Quick Start

The app now works on Linux! Just run:

```bash
npm run tauri dev
```

The environment variable `WEBKIT_DISABLE_COMPOSITING_MODE=1` is now automatically set in the npm scripts.

## What Was Fixed

### 1. Empty Window Issue ✅
**Problem**: Black/empty window on Linux due to webkit2gtk rendering issues.

**Solution**: Set `WEBKIT_DISABLE_COMPOSITING_MODE=1` environment variable (now automatic in package.json).

### 2. Cross-Platform Environment Variables ✅
**Problem**: Environment variable syntax differs between platforms (Linux/macOS vs Windows).

**Solution**: Use `cross-env` package to handle platform differences automatically.

### 3. dApp Connection via Tauri IPC ✅
**Problem**: Need secure, CSP-safe way for dApps to communicate with wallet.

**Solution**: Implemented Tauri IPC bridge (no WebSocket needed):
- Provider script injected via `initialization_script` (runs before page loads)
- Uses Tauri's built-in IPC (secure, CSP-safe)
- Works with all sites (HTTP and HTTPS)
- No certificate warnings or mixed content issues

**How it works**:
1. Wallet injects provider script before page loads
2. Provider uses Tauri IPC to communicate with backend
3. All communication is secure and local (no network)
4. Works identically on Linux, Windows, and macOS

### 4. Auto-Connect for Wallet-Opened dApps ✅
**Problem**: Users had to manually approve connection even when they opened the dApp from the wallet.

**Solution**: Automatic connection approval for wallet-opened dApps:
- When you click "Open dApp" in wallet, connection is pre-approved
- No approval modal shown (seamless UX)
- Transactions still require approval (security maintained)
- Window label injection ensures correct session matching

**Technical details**: See `docs/architecture/WINDOW-LABEL-INJECTION.md`

## System Requirements

### Required Packages (Arch/CachyOS)
```bash
sudo pacman -S webkit2gtk-4.1 base-devel curl wget file openssl gtk3 librsvg
```

### Optional (for system tray support)
```bash
sudo pacman -S libayatana-appindicator
```

## Platform Differences

The changes work on **all platforms** (Windows, Linux, macOS):

- **Windows**: Uses WebView2, may have similar Mixed Content issues on HTTPS sites
- **Linux**: Uses webkit2gtk, has Mixed Content Policy restrictions
- **macOS**: Uses WKWebView, may have similar restrictions

The `WEBKIT_DISABLE_COMPOSITING_MODE=1` variable is harmless on Windows/macOS (they ignore it).

## Current Functionality

✅ **Working**:
- Wallet UI (create, import, unlock, send, receive)
- Account management
- Balance display
- Transaction building and signing
- Network switching
- dApp browser with Tauri IPC (CSP-safe, no WebSocket needed)
- dApp provider injection
- Auto-connect for wallet-opened dApps (seamless UX)
- Connection to all sites (HTTPS and HTTP)

### Auto-Connect Feature (2026-02-12)

When you open a dApp from the wallet (e.g., click "Open Uniswap"), the connection is automatically approved:

**How it works**:
1. You click "Open dApp" in wallet
2. dApp window opens
3. ✅ Connection established automatically
4. No approval modal shown
5. Start using dApp immediately

**Why this is safe**:
- Wallet controls which dApps can be opened (whitelist)
- You explicitly clicked "Open dApp" (clear intent)
- Connection only reveals your address (no private keys)
- Transactions still require approval (auto-connect ≠ auto-sign)

**Technical details**: See `docs/architecture/WINDOW-LABEL-INJECTION.md` and `docs/architecture/AUTO-CONNECT-FEATURE.md`

**Platform compatibility**: Works identically on Linux, Windows, and macOS

## Troubleshooting

### Window still empty?
Try running manually with the environment variable:
```bash
WEBKIT_DISABLE_COMPOSITING_MODE=1 npm run tauri dev
```

### dApp not auto-connecting?

If you open a dApp from the wallet but still see an approval modal:

1. **Check the logs** (terminal where you ran `npm run tauri dev`):
   ```
   [Window] Generated window label: dapp-c1dfac04-...
   [SessionManager] Creating AUTO-APPROVED session for window: dapp-c1dfac04-...
   [Vaughan-IPC] Window Label: dapp-c1dfac04-...  ← Should NOT be 'unknown'
   [RPC] eth_accounts - Found session for window: dapp-c1dfac04-..., auto_approved: true
   ```

2. **If window label is 'unknown'**:
   - This indicates a bug in window label injection
   - Check browser console (F12) for errors
   - Report the issue with logs

3. **If session not found**:
   - Check that you opened the dApp FROM the wallet (not by visiting URL directly)
   - Only wallet-opened dApps get auto-connect
   - Manually visited URLs will show approval modal (this is correct behavior)

### dApp can't connect at all?

1. **Check browser console** (F12) for errors
2. **Verify Tauri IPC is working**:
   - Look for `[Vaughan-IPC] Initializing Tauri IPC bridge...` in console
   - Look for `[Vaughan-Provider] Provider injected successfully ✅` in console
3. **Check terminal logs** for backend errors
4. **Try restarting the wallet**

### Build for production
```bash
npm run tauri build
```

The built binary will work without needing to set environment variables.

## Development Notes

The wallet uses Tauri IPC for dApp communication, which is:
- **Secure**: All communication is local (no network)
- **CSP-safe**: Works with strict Content Security Policies
- **Cross-platform**: Works identically on Linux, Windows, and macOS
- **No certificates needed**: No browser warnings or mixed content issues

The provider script is injected via `initialization_script`, which runs before the page loads and has access to Tauri APIs. This allows the provider to work even on sites with strict CSP that would block traditional script injection.

### Auto-Connect Implementation

When you open a dApp from the wallet:
1. Wallet generates unique window label (UUID)
2. Window label and origin injected into `initialization_script`
3. Auto-approved session created with same window label
4. Provider script uses injected window label for all requests
5. Session lookup succeeds → accounts returned immediately
6. No approval modal shown

This is safe because:
- Wallet controls which dApps can be opened (whitelist)
- User explicitly clicked "Open dApp" (clear intent)
- Connection only reveals address (no private keys)
- Transactions still require approval

See `docs/architecture/WINDOW-LABEL-INJECTION.md` for technical details.
