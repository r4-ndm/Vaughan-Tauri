# Setup Vaughan Wallet from GitHub

**Date**: 2026-02-10

---

## Prerequisites

Before you start, make sure you have installed:

1. **Node.js** (v18 or later) - https://nodejs.org/
2. **Rust** - https://rustup.rs/
3. **Git** (optional, for cloning)

---

## Setup Steps

### 1. Download/Clone the Repository

**Option A: Download ZIP**
1. Go to https://github.com/r4-ndm/Vaughan-Tauri
2. Click "Code" → "Download ZIP"
3. Extract to your desired location

**Option B: Clone with Git**
```bash
git clone https://github.com/r4-ndm/Vaughan-Tauri.git
cd Vaughan-Tauri/Vaughan
```

---

### 2. Install Node Dependencies

Open PowerShell or Command Prompt in the `Vaughan` folder:

```powershell
cd C:\path\to\Vaughan-Tauri\Vaughan
npm install
```

This will install all required packages including:
- React and React Router
- Tauri CLI and API
- TailwindCSS
- TypeScript
- And all other dependencies

**Expected output:**
```
added 439 packages in 30s
```

---

### 3. Verify Tauri CLI Installation

After `npm install`, verify the Tauri CLI is available:

```powershell
npm run tauri -- --version
```

**Expected output:**
```
tauri-cli 2.x.x
```

If you see this, the setup is correct!

---

### 4. Run the Development Server

```powershell
npm run tauri dev
```

**What happens:**
1. Vite dev server starts (frontend)
2. Rust backend compiles (first time takes 5-10 minutes)
3. Vaughan wallet window opens

**First run notes:**
- Rust compilation takes time on first run
- Subsequent runs are much faster (30 seconds)
- You'll see lots of "Compiling..." messages - this is normal

---

### 5. Build for Production (Optional)

To create a distributable executable:

```powershell
npm run tauri build
```

**Output location:**
```
Vaughan/src-tauri/target/release/bundle/
```

You'll find:
- `.exe` installer (Windows)
- `.msi` installer (Windows)

---

## Troubleshooting

### Error: 'tauri' is not recognized

**Problem:** Tauri CLI not installed

**Solution:**
```powershell
# Make sure you're in the Vaughan folder
cd C:\path\to\Vaughan-Tauri\Vaughan

# Delete node_modules and reinstall
Remove-Item -Recurse -Force node_modules
npm install
```

---

### Error: Rust not found

**Problem:** Rust toolchain not installed

**Solution:**
1. Install Rust from https://rustup.rs/
2. Restart your terminal
3. Verify: `rustc --version`

---

### Error: npm install fails

**Problem:** Network issues or corrupted cache

**Solution:**
```powershell
# Clear npm cache
npm cache clean --force

# Try again
npm install
```

---

### Error: Compilation errors in Rust

**Problem:** Missing system dependencies

**Solution (Windows):**
1. Install Visual Studio Build Tools
2. Or install Visual Studio Community with "Desktop development with C++"
3. Restart terminal and try again

---

## Quick Start After Setup

### Create a New Wallet

1. Run `npm run tauri dev`
2. Click "Create New Wallet"
3. Set a password (e.g., `test123`)
4. Save your recovery phrase (12 words)
5. Confirm the recovery phrase
6. Wallet created!

### Test dApp Connection

1. In the wallet, click "Open dApps"
2. Select "Uniswap" from the list
3. Uniswap opens in a new window
4. Click "Connect Wallet" in Uniswap
5. Approve the connection in the wallet
6. You're connected!

---

## Project Structure

```
Vaughan/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── views/              # Page views
│   ├── hooks/              # React hooks
│   ├── services/           # API services
│   ├── utils/              # Utilities
│   └── provider/           # dApp provider scripts
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── commands/       # Tauri commands
│   │   ├── core/           # Business logic
│   │   ├── chains/         # Chain adapters
│   │   ├── security/       # Crypto & encryption
│   │   └── dapp/           # dApp bridge
│   └── Cargo.toml          # Rust dependencies
├── public/                 # Static assets
├── docs-websocket/         # WebSocket documentation
└── package.json            # Node dependencies
```

---

## Development Workflow

### Making Changes

1. **Frontend changes** (React/TypeScript):
   - Edit files in `src/`
   - Hot reload works automatically
   - See changes instantly

2. **Backend changes** (Rust):
   - Edit files in `src-tauri/src/`
   - Save the file
   - Tauri auto-recompiles (takes 10-30 seconds)
   - App restarts automatically

### Running Tests

```powershell
# Rust tests
cd src-tauri
cargo test

# TypeScript type checking
npm run build
```

---

## Network Configuration

**Default Network:** PulseChain Testnet V4

- Chain ID: 369 (0x171)
- RPC: https://rpc.v4.testnet.pulsechain.com
- Explorer: https://scan.v4.testnet.pulsechain.com

**To change network:**
1. Open wallet
2. Click network selector (top right)
3. Choose different network

---

## Security Notes

- **Never share your recovery phrase**
- **Password is stored securely in OS keychain**
- **Private keys never leave the Rust backend**
- **All crypto operations use Alloy (audited library)**

---

## Getting Help

- **Documentation:** Check the `docs-websocket/` folder
- **Issues:** https://github.com/r4-ndm/Vaughan-Tauri/issues
- **Architecture:** See `.kiro/specs/Vaughan-Tauri/design.md`

---

## Next Steps

After setup:
1. Read `TESTING-GUIDE.md` for testing instructions
2. Check `docs-websocket/README.md` for WebSocket architecture
3. See `WORKFLOW-TEST-GUIDE.md` for dApp workflow testing

---

**Last Updated:** 2026-02-10
**Version:** 0.1.0
