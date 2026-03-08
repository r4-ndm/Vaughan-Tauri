# Vaughan Wallet - Tauri 2.0

**Cross-platform Ethereum wallet built with Tauri 2.0 and Alloy**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-blue.svg)](https://v2.tauri.app/)
[![Rust](https://img.shields.io/badge/Rust-1.75+-orange.svg)](https://www.rust-lang.org/)
[![React](https://img.shields.io/badge/React-18+-61DAFB.svg)](https://react.dev/)

---

## 🎯 Overview

Vaughan is a secure, multi-chain cryptocurrency wallet with dApp browser integration. Built from the ground up with Tauri 2.0 for cross-platform support and Alloy for pure Rust Ethereum operations.

**Status**: 🚧 In Development (Phase 1: Backend Setup)

---

## ✨ Features

### Current (Phase 1)
- ✅ Multi-chain architecture (trait-based design)
- ✅ EVM chain support (Ethereum, PulseChain, Polygon, etc.)
- ✅ Pure Alloy implementation (no ethers-rs)
- ✅ Secure key management (OS keychain)
- ✅ HD wallet support (BIP-39/BIP-32)

### Planned
- 🔜 React UI (recreating Iced design)
- 🔜 dApp browser with EIP-1193 compatibility
- 🔜 Android support (native in Tauri 2.0)
- 🔜 Desktop support (Windows, Linux, macOS)
- 🔜 Additional chains (Stellar, Aptos, Solana, Bitcoin)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  WALLET UI (React)                      │
│            Chain-agnostic components                    │
└────────────────────┬────────────────────────────────────┘
                     │ Tauri IPC
┌────────────────────▼────────────────────────────────────┐
│              WALLET CORE (Rust)                         │
│  - Account management (chain-agnostic)                  │
│  - Transaction coordination                             │
│  - Security (keychain, encryption)                      │
└────────────────────┬────────────────────────────────────┘
                     │ ChainAdapter trait
        ┌────────────┼────────────┬──────────────┐
        │            │            │              │
┌───────▼──────┐ ┌──▼──────┐ ┌──▼──────┐ ┌────▼─────┐
│ EVM Adapter  │ │ Stellar │ │ Aptos   │ │ Solana   │
│ (Alloy)      │ │ Adapter │ │ Adapter │ │ Adapter  │
│ ✅ Phase 1   │ │ 🔜 Future│ │ 🔜 Future│ │ 🔜 Future │
└──────────────┘ └─────────┘ └─────────┘ └──────────┘
```

**Key Principles**:
- **Alloy** = Does the work (ALL Ethereum operations)
- **EIP-1193** = Speaks the language (dApp compatibility)
- **Tauri** = Holds it together (cross-platform shell)
- **Trait-based** = Future-proof (add chains without refactoring)

---

## 🚀 Quick Start

### Prerequisites

- **Rust** 1.75+ ([Install](https://rustup.rs/))
- **Node.js** 18+ ([Install](https://nodejs.org/))
- **Tauri CLI** ([Install](https://v2.tauri.app/start/prerequisites/))

### Development Setup

```bash
# Clone the repository
git clone https://github.com/r4-ndm/Vaughan-Tauri.git
cd Vaughan-Tauri/Vaughan

# Install shell and frontend dependencies
npm install
npm install --prefix web

# Run in development mode
cargo tauri dev
```

### Build for Production

```bash
# Build for current platform
cargo tauri build

# Build for Android
cargo tauri android init
cargo tauri android build
```

---

## 📁 Project Structure

```
Vaughan-Tauri/
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── chains/         # Chain adapters (Alloy, etc.)
│   │   ├── core/           # Wallet core (chain-agnostic)
│   │   ├── commands/       # Tauri commands
│   │   └── state/          # Application state
│   └── Cargo.toml
│
├── web/                    # React frontend
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── views/          # Page views
│   │   └── providers/      # Chain provider APIs
│   └── package.json
│
├── docs/                   # Documentation
│   ├── specs/              # Technical specifications
│   └── guides/             # User guides
│
└── tests/                  # Test suites
```

---

## 🔒 Security

Vaughan follows industry best practices for wallet security:

- ✅ **Private keys** stored in OS keychain (not files)
- ✅ **Origin verification** in all commands
- ✅ **Provider injection** via initialization_script
- ✅ **Strict CSP** for wallet window
- ✅ **No custom crypto** (Alloy libraries only)
- ✅ **Battle-tested patterns** (EIP-1193 standard)

**Security Audit**: Planned for Phase 4

---

## 🧪 Testing

```bash
# Run all tests
cargo test --all-features

# Run specific test suite
cargo test --test integration_test

# Run with coverage
cargo tarpaulin --all-features
```

**Test Coverage Goals**:
- Unit tests: 80%+
- Integration tests: 60%+
- E2E tests: Critical paths

---

## 📚 Documentation

### For Users
- [User Guide](docs/guides/user-guide.md) - How to use Vaughan
- [FAQ](docs/guides/faq.md) - Frequently asked questions

### For Developers
- [Architecture Overview](.kiro/specs/Vaughan-Tauri/MULTI-CHAIN-ARCHITECTURE.md)
- [Development Guide](.kiro/specs/Vaughan-Tauri/README.md)
- [API Documentation](docs/api/README.md)
- [Contributing Guide](CONTRIBUTING.md)

### Specifications
- [Requirements](.kiro/specs/Vaughan-Tauri/requirements.md)
- [Design](.kiro/specs/Vaughan-Tauri/design.md)
- [Security](.kiro/specs/Vaughan-Tauri/security-considerations.md)
- [Testing Strategy](.kiro/specs/Vaughan-Tauri/testing-strategy.md)

---

## 🗺️ Roadmap

### Phase 1: Backend Setup (Week 1) ✅ In Progress
- [x] Multi-chain architecture design
- [x] ChainAdapter trait definition
- [ ] EVM adapter implementation (Alloy)
- [ ] Tauri 2.0 setup with capabilities
- [ ] Account management
- [ ] Transaction handling

### Phase 2: Wallet UI (Week 2)
- [ ] React + TypeScript setup
- [ ] Recreate Iced design in React
- [ ] Account views
- [ ] Send/Receive forms
- [ ] Transaction history

### Phase 3: dApp Integration (Week 3)
- [ ] EIP-1193 provider implementation
- [ ] dApp browser (separate window)
- [ ] Approval system
- [ ] Test with real dApps

### Phase 4: Testing & Polish (Week 4)
- [ ] Cross-platform testing
- [ ] Security audit
- [ ] Performance optimization
- [ ] Mobile optimization (Android)

### Phase 5: Release (Week 5)
- [ ] Binary optimization (< 20MB)
- [ ] Documentation
- [ ] Release builds
- [ ] Community testing

### Future
- [ ] Stellar support
- [ ] Aptos support
- [ ] Solana support
- [ ] Bitcoin support
- [ ] Hardware wallet integration
- [ ] iOS support

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Follow the [development rules](.kiro/steering/vaughan-tauri-rules.md)
4. Write tests for your changes
5. Ensure all tests pass (`cargo test --all-features`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Code Quality Standards

- ✅ No custom crypto code (use Alloy or standard libraries)
- ✅ Trait-based design for multi-chain support
- ✅ Comprehensive tests (80%+ coverage)
- ✅ Clear documentation with examples
- ✅ Files < 500 lines, functions < 50 lines
- ✅ Proper error handling (no unwrap/expect)

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **[Tauri](https://tauri.app/)** - Cross-platform framework
- **[Alloy](https://github.com/alloy-rs/alloy)** - Pure Rust Ethereum library
- **[MetaMask](https://metamask.io/)** - EIP-1193 standard inspiration
- **[Rabby](https://rabby.io/)** - dApp browser UX patterns

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/r4-ndm/Vaughan-Tauri/issues)
- **Discussions**: [GitHub Discussions](https://github.com/r4-ndm/Vaughan-Tauri/discussions)
- **Security**: See [SECURITY.md](SECURITY.md) for reporting vulnerabilities

---

## 🌟 Star History

If you find Vaughan useful, please consider giving it a star! ⭐

---

**Built with ❤️ by the Vaughan team**
