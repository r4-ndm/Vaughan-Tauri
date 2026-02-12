# WSS (Secure WebSocket) Implementation

## Status: ✅ COMPLETE

The wallet now uses secure WebSocket (WSS) with self-signed certificates to enable dApp connections from HTTPS sites.

## What Was Implemented

### 1. Certificate Generation Module (`src-tauri/src/dapp/cert.rs`)
- Generates self-signed certificates for localhost
- Caches certificates in app data directory
- Certificates valid for 1 year
- Includes SANs for localhost, 127.0.0.1, ::1

### 2. Secure WebSocket Server (`src-tauri/src/dapp/websocket.rs`)
- Upgraded from `ws://` to `wss://`
- Uses TLS with self-signed certificate
- Automatic certificate loading/generation on startup
- Generic connection handler supports both TLS and non-TLS streams

### 3. Provider Script Update (`public/provider-inject-extension.js`)
- Changed from `ws://localhost:8766` to `wss://localhost:8766`
- No other changes needed - transparent upgrade

### 4. Dependencies Added (`Cargo.toml`)
- `tokio-native-tls` - TLS support for WebSocket
- `native-tls` - TLS implementation
- `rcgen` - Self-signed certificate generation
- `pem` - PEM parsing
- `dirs` - Cross-platform directory paths

## How It Works

1. **On Startup**:
   - Wallet checks for existing certificate in `~/.local/share/vaughan/certs/`
   - If not found or expired, generates new self-signed certificate
   - Certificate and private key saved to disk
   - WebSocket server starts with TLS enabled

2. **On dApp Connection**:
   - dApp page loads in browser
   - Provider script connects to `wss://localhost:8766`
   - Browser shows certificate warning (first time only)
   - User accepts certificate
   - Connection established, dApp can interact with wallet

## User Experience

### First Time Setup
When opening a dApp for the first time, users will see a certificate warning:

**Chrome/Edge**: "Your connection is not private"
- Click "Advanced"
- Click "Proceed to localhost (unsafe)"

**Firefox**: "Warning: Potential Security Risk Ahead"
- Click "Advanced"
- Click "Accept the Risk and Continue"

**Safari**: "This Connection Is Not Private"
- Click "Show Details"
- Click "visit this website"

This is **expected and safe** - it's the wallet's own certificate.

### Subsequent Connections
After accepting once, the browser remembers the certificate for the session. No more warnings.

## Security

### Why This Is Secure
- Certificate generated locally on user's machine
- Private key never leaves the computer
- Only used for localhost connections
- Standard TLS encryption protects the connection
- Same approach used by development tools (webpack-dev-server, vite, etc.)

### What's Protected
- WebSocket messages encrypted with TLS
- Prevents man-in-the-middle attacks on localhost
- Meets browser Mixed Content Policy requirements

### What's NOT Protected
- Certificate is self-signed (not from trusted CA)
- Browser will show warnings
- Users must manually accept certificate

This is the standard trade-off for localhost development tools.

## Testing

### Verify WSS Server Started
Look for this in terminal output:
```
[WSS] Setting up secure WebSocket server...
[Cert] Using existing certificate: "/home/r4/.local/share/vaughan/certs/localhost.crt"
[WSS] Secure WebSocket server started on port 8766
```

### Test dApp Connection
1. Run wallet: `npm run tauri dev`
2. Open dApp browser
3. Navigate to HTTPS site (e.g., https://app.uniswap.org)
4. Accept certificate warning
5. Check browser console for: `[Vaughan-Ext] Connected! ✅`

## Platform Support

Works on all platforms:
- ✅ Linux (webkit2gtk)
- ✅ Windows (WebView2)
- ✅ macOS (WKWebView)

Certificate locations:
- Linux: `~/.local/share/vaughan/certs/`
- macOS: `~/Library/Application Support/vaughan/certs/`
- Windows: `%APPDATA%\vaughan\certs\`

## Troubleshooting

### Certificate Not Accepted
- Clear browser cache and restart
- Delete certificate files and restart wallet (will regenerate)
- Check browser console for specific error

### Connection Still Fails
- Verify WSS server started (check terminal output)
- Check firewall isn't blocking localhost:8766
- Try different browser

### Certificate Expired
- Delete certificate files: `rm -rf ~/.local/share/vaughan/certs/`
- Restart wallet (will generate new certificate)

## Future Improvements

Potential enhancements:
1. Add certificate trust instructions to UI
2. Provide one-click certificate installation
3. Generate certificate with longer validity (5 years)
4. Add certificate fingerprint display for verification

## References

- [RFC 6455](https://tools.ietf.org/html/rfc6455) - WebSocket Protocol
- [RFC 5280](https://tools.ietf.org/html/rfc5280) - X.509 Certificates
- [Mixed Content](https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content) - MDN Docs
