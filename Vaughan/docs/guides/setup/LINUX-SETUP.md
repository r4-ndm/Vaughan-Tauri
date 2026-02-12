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

### 2. WebSocket Connection Issue ✅
**Problem**: HTTPS sites (like Uniswap) block insecure WebSocket connections (ws://) due to:
- Mixed Content Policy (HTTPS page → WS connection)
- Content Security Policy (CSP)

**Solution**: Implemented secure WebSocket (WSS) with self-signed certificate.

**How it works**:
1. Wallet generates a self-signed certificate on first run
2. Certificate is cached in `~/.local/share/vaughan/certs/` (Linux)
3. WebSocket server uses TLS (wss://) instead of plain ws://
4. Browser will show a certificate warning on first connection

**First-time setup**:
When you first open a dApp, your browser will show a certificate warning because the certificate is self-signed. This is expected and safe - it's your own wallet's certificate.

To trust the certificate:
1. Open the dApp browser
2. Browser shows "Your connection is not private" or similar
3. Click "Advanced" → "Proceed to localhost (unsafe)" or similar
4. This only needs to be done once per browser session

**Why this is secure**:
- Certificate is generated locally on your machine
- Only used for localhost connections
- Private key never leaves your computer
- Standard TLS encryption protects the connection

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
- dApp browser with secure WebSocket (WSS)
- dApp provider injection
- Connection to HTTPS sites (after accepting certificate)

## Troubleshooting

### Window still empty?
Try running manually with the environment variable:
```bash
WEBKIT_DISABLE_COMPOSITING_MODE=1 npm run tauri dev
```

### dApp can't connect to wallet?
First, check if you've accepted the self-signed certificate:
1. Open browser DevTools (F12)
2. Look for certificate errors in console
3. If you see "NET::ERR_CERT_AUTHORITY_INVALID", you need to accept the certificate
4. The browser should prompt you - click "Advanced" → "Proceed to localhost"

If the issue persists:
- Check that the WebSocket server is running (you should see "[WSS] Secure WebSocket server started on port 8766" in terminal)
- Try restarting the wallet
- Check browser console for specific error messages

### Build for production
```bash
npm run tauri build
```

The built binary will work without needing to set environment variables.

## Development Notes

The wallet now uses secure WebSocket (WSS) with self-signed certificates to enable connections from HTTPS sites. This is the same approach used by many development tools (like webpack-dev-server, vite, etc.) and is secure for localhost connections.

The certificate is automatically generated and cached, so it persists across restarts. Users only need to accept it once per browser session.
