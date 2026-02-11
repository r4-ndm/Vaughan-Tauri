# Tauri Migration - Complete Specification

**Status**: Ready for Implementation  
**Version**: 2.0 (Updated with Tauri 2.0 + Security + Performance)  
**Last Updated**: January 28, 2026

---

## 📋 Quick Start Guide

### For AI Agents 🤖

**Context-aware reading strategy**:

```
IF starting migration:
  READ: CRITICAL-REQUIREMENTS.md (must read first!)
  READ: project-structure.md (where to build)
  READ: tasks.md (what to do)

IF implementing backend (Phase 1):
  READ: tauri-2.0-specifics.md (Tauri 2.0 details)
  READ: security-considerations.md (security patterns)
  REFERENCE: requirements.md (what features)
  REFERENCE: design.md (architecture)

IF implementing frontend (Phase 2):
  READ: design.md (UI architecture)
  READ: performance-ux-considerations.md (UX patterns)
  REFERENCE: requirements.md (UI requirements)

IF implementing dApp integration (Phase 3):
  READ: security-considerations.md (dApp security)
  READ: tauri-2.0-specifics.md (provider injection)
  REFERENCE: design.md (MetaMask bridge)

IF testing (Phase 4):
  READ: testing-strategy.md (test approach)
  READ: cross-platform-strategy.md (platform testing)

IF optimizing (Phase 5):
  READ: performance-ux-considerations.md (optimization)
  READ: tauri-2.0-specifics.md (binary optimization)
```

### For Humans 👤

**Read in this order**:

1. **`CRITICAL-REQUIREMENTS.md`** ⚠️ (5 min) - Non-negotiable rules
2. **`WORKFLOW-SUMMARY.md`** 🎯 (5 min) - Confirmed git workflow
3. **`MULTI-CHAIN-ARCHITECTURE.md`** 🌐 (15 min) - Future-proof design
4. **`requirements.md`** (20 min) - What we're building
5. **`design.md`** (30 min) - How we're building it
6. **`tasks.md`** (10 min) - Implementation checklist

**Reference as needed**:
- `tauri-2.0-specifics.md` - Tauri 2.0 technical details
- `security-considerations.md` - Security requirements
- `performance-ux-considerations.md` - Performance & UX
- `testing-strategy.md` - Testing approach
- `project-structure.md` - Where to build
- `cross-platform-strategy.md` - Platform testing
- `git-strategy.md` - Detailed git workflow

---

## 🎯 What We're Building

**Vaughan Wallet - Tauri 2.0 Edition**

- **Current**: Iced GUI (desktop only, controller initialization blocked)
- **Future**: Tauri 2.0 (desktop + Android, dApp browser, MetaMask compatible)

**Key Features**:
- ✅ All existing wallet features (send, receive, accounts, networks)
- ✅ dApp browser with EIP-1193 compatibility
- ✅ Desktop support (Windows, Linux, macOS)
- ✅ Android support (native in Tauri 2.0)
- ✅ Same Iced GUI look/feel (recreated in React)
- ✅ 100% Alloy-based for EVM (no ethers-rs)
- ✅ Multi-chain architecture (EVM now, Stellar/Aptos/Solana/Bitcoin future)
- ✅ Battle-tested security patterns

**Supported Chains**:
- **Phase 1**: EVM chains (Ethereum, PulseChain, Polygon, etc.)
- **Future**: Stellar, Aptos, Solana, Bitcoin

---

## 🚨 Critical Requirements

### 1. Tauri 2.0 (NOT 1.x)
```bash
npm create tauri-app@latest  # ✅ Correct
cargo tauri init             # ❌ Wrong (Tauri 1.x)
```

### 2. Alloy Purity (ZERO ethers-rs)
```rust
use alloy::primitives::Address;  # ✅ Correct
use ethers::types::Address;      # ❌ Forbidden
```

### 3. Security First
- Origin verification in ALL commands
- Provider injection via `initialization_script`
- Strict CSP for wallet window
- Capabilities (ACL) system for permissions

### 4. Process: Analyze → Improve → Rebuild
**NOT copy-paste migration!**

### 5. Phase 5: DEBLOAT
Remove ALL Iced code after migration (target: < 20MB binary)

---

## 📁 Document Structure

### Core Documents
| Document | Purpose | Read When |
|----------|---------|-----------|
| `CRITICAL-REQUIREMENTS.md` | Non-negotiable rules | **First** |
| `WORKFLOW-SUMMARY.md` | Git workflow (quick reference) | **Second** |
| `requirements.md` | What we're building | Planning |
| `design.md` | How we're building it | Planning |
| `tasks.md` | Implementation checklist | Implementing |

### Technical Guides
| Document | Purpose | Read When |
|----------|---------|-----------|
| `tauri-2.0-specifics.md` | Tauri 2.0 details | Implementing |
| `MULTI-CHAIN-ARCHITECTURE.md` | Multi-chain design | **Planning** |
| `security-considerations.md` | Security requirements | Implementing security |
| `performance-ux-considerations.md` | Performance & UX | Optimizing |
| `testing-strategy.md` | Testing approach | Writing tests |

### Workflow Guides
| Document | Purpose | Read When |
|----------|---------|-----------|
| `WORKFLOW-SUMMARY.md` | Quick workflow reference | **Starting** |
| `project-structure.md` | Where to build | Starting |
| `cross-platform-strategy.md` | Platform testing | Testing |
| `git-strategy.md` | Detailed git workflow | Reference |
| `.kiro/steering/tauri-migration-rules.md` | AI agent rules | Using AI |

---

## 🗺️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     VAUGHAN WALLET                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐              ┌──────────────┐           │
│  │ Wallet Window│              │ dApp Window  │           │
│  │  (React UI)  │              │  (iframe)    │           │
│  └──────┬───────┘              └──────┬───────┘           │
│         │                              │                   │
│         │ Tauri IPC                    │ postMessage       │
│         ↓                              ↓                   │
│  ┌──────────────────────────────────────────────┐         │
│  │     MetaMask Translation Layer (JS)          │         │
│  │     window.ethereum implementation           │         │
│  └──────────────────┬───────────────────────────┘         │
│                     │ invoke()                             │
│                     ↓                                      │
│  ┌──────────────────────────────────────────────┐         │
│  │        Tauri Commands (Rust Bridge)          │         │
│  │     Arc<Mutex<VaughanState>>                 │         │
│  └──────────────────┬───────────────────────────┘         │
│                     │                                      │
│                     ↓                                      │
│  ┌──────────────────────────────────────────────┐         │
│  │         Alloy Core (Rust)                    │         │
│  │  - TransactionController                     │         │
│  │  - NetworkController                         │         │
│  │  - WalletController                          │         │
│  │  - PriceController                           │         │
│  └──────────────────┬───────────────────────────┘         │
│                     │                                      │
│                     ↓                                      │
│              Ethereum Network                              │
└─────────────────────────────────────────────────────────────┘
```

**Key Principle**: 
- **Alloy** = Does the work (ALL Ethereum operations)
- **MetaMask** = Speaks the language (dApp compatibility)
- **Rabby** = Inspires the UX (dApp browser patterns)
- **Tauri** = Holds it together (cross-platform shell)

---

## 📅 Timeline (5 Weeks)

### Week 1: Backend Setup
- Initialize Tauri 2.0 project
- Set up capabilities (ACL system)
- Migrate controllers (verify Alloy purity)
- Implement Tauri commands
- **Deliverable**: Working backend with tests

### Week 2: Wallet UI
- Set up React + TypeScript + Vite
- Recreate Iced GUI design
- Implement wallet views
- Connect to Tauri commands
- **Deliverable**: Working wallet UI

### Week 3: dApp Integration
- Implement MetaMask provider (secure injection)
- Create dApp browser (separate window)
- Implement approval system
- Test with real dApps
- **Deliverable**: Working dApp integration

### Week 4: Polish & Release
- Mobile optimization (Android)
- Cross-platform testing
- Performance optimization
- Security audit
- **Deliverable**: Release candidate

### Week 5: DEBLOAT & CLEANUP
- Remove ALL Iced code
- Remove Iced dependencies
- Binary optimization
- Final testing
- **Deliverable**: Production release (< 20MB)

---

## ✅ Success Criteria

### Must Have (MVP)
- [ ] All controllers initialize successfully
- [ ] All existing wallet features work
- [ ] UI matches Iced design
- [ ] MetaMask API implemented
- [ ] dApp browser working
- [ ] Can connect to dApps
- [ ] Can approve/reject transactions from dApps
- [ ] Works on Windows
- [ ] Works on Android
- [ ] Works on Linux
- [ ] macOS builds successfully
- [ ] All tests pass
- [ ] Security audit complete
- [ ] Binary < 20MB

### Should Have
- [ ] UI perfectly matches Iced
- [ ] Better performance than Iced
- [ ] Works with major dApps (Uniswap, Aave, etc.)
- [ ] E2E tests for critical flows
- [ ] Mobile-optimized UI
- [ ] macOS tested by community

---

## 🔒 Security Highlights

**Critical Security Measures**:
1. **Private keys** in OS keychain (not files)
2. **Origin verification** in all commands
3. **Provider injection** via initialization_script
4. **Strict CSP** for wallet window
5. **Minimal permissions** for dApp window
6. **Signed updates** only
7. **Rate limiting** on commands
8. **Phishing detection** for dApps
9. **Transaction simulation** before approval
10. **Audit logging** (no sensitive data)

**See**: `security-considerations.md` for full details

---

## ⚡ Performance Targets

- **Startup**: < 3 seconds (cold start)
- **Commands**: < 100ms (local operations)
- **Network ops**: < 5 seconds (with timeout)
- **UI interactions**: < 50ms (perceived instant)
- **Memory**: < 200MB idle, < 500MB active
- **Binary size**: < 20MB (after debloat)

**See**: `performance-ux-considerations.md` for optimization strategies

---

## 🧪 Testing Strategy

**Testing Pyramid**:
- **60% Unit Tests**: Controllers, pure functions
- **30% Integration Tests**: Commands, state management
- **10% E2E Tests**: Critical user flows, dApp integration

**Coverage Goals**:
- Unit tests: 80%+
- Integration tests: 60%+
- E2E tests: Critical paths only

**See**: `testing-strategy.md` for full strategy

---

## 🛠️ Development Workflow

### 1. Initial Setup (Inside Vaughan-main)
```bash
# Work inside existing folder (keeps old code for reference)
cd Vaughan-main

# Initialize Tauri 2.0
npm create tauri-app@latest

# Set up capabilities
# Create src-tauri/capabilities/*.json files
```

### 2. Daily Development (Phases 1-4)
```bash
# On Windows (primary platform)
cargo tauri dev  # Run wallet

# Run tests
cargo test --all-features
npm run test

# Commit changes (to existing Vaughan-main repo)
git add src-tauri/ web/
git commit -m "feat: implement X"
git push origin main
```

**During development**:
- Old Iced code stays in `src/` (for reference)
- New Tauri code in `src-tauri/` and `web/`
- AI agents can reference old code easily

### 3. Weekly Testing
```bash
# Friday: Linux test (WSL2)
wsl
cd /mnt/c/Users/rb3y9/Desktop/Vaughan/Vaughan-main
cargo tauri dev

# Saturday: Android test
cargo tauri android dev
```

### 4. Release Preparation (Phase 5)
```bash
# When Tauri version is complete:

# Create new repo on GitHub: "vaughan-tauri"
cd C:\Users\rb3y9\Desktop\Vaughan
git clone https://github.com/yourusername/vaughan-tauri.git
cd vaughan-tauri

# Copy ONLY Tauri files (not Iced code)
cp -r ../Vaughan-main/src-tauri ./
cp -r ../Vaughan-main/web ./
cp -r ../Vaughan-main/docs ./
cp -r ../Vaughan-main/tests ./
cp -r ../Vaughan-main/.kiro ./
cp ../Vaughan-main/README.md ./
cp ../Vaughan-main/LICENSE ./

# First commit to new repo
git add .
git commit -m "feat: initial Tauri 2.0 release"
git push origin main

# Tag release
git tag -a v2.0.0 -m "Tauri 2.0 release"
git push origin v2.0.0
```

**Result**: Clean new repo with no legacy Iced code!

### 5. CI/CD
- GitHub Actions builds on every commit
- Automatic builds for Windows, Linux, macOS
- Test suite runs automatically
- Coverage reports generated

---

## 📚 Additional Resources

### External Documentation
- [Tauri 2.0 Docs](https://v2.tauri.app/)
- [Alloy Docs](https://alloy-rs.github.io/alloy/)
- [EIP-1193 Spec](https://eips.ethereum.org/EIPS/eip-1193)
- [MetaMask Provider API](https://docs.metamask.io/wallet/reference/provider-api/)

### Internal Documentation
- `docs/development/` - Development history
- `docs/architecture/` - Architecture decisions
- `docs/guides/` - User guides

---

## 🤝 Contributing

### For AI Agents
1. Read `.kiro/steering/tauri-migration-rules.md`
2. Follow the 7-step process (Analyze → Improve → Rebuild)
3. Check code quality checklist before submitting
4. Verify Alloy purity (no ethers imports)

### For Humans
1. Read `CRITICAL-REQUIREMENTS.md`
2. Follow the spec documents
3. Write tests for all new code
4. Run security checks before PR
5. Update documentation

---

## 📞 Support

### Questions?
- Check the spec documents first
- Review `CRITICAL-REQUIREMENTS.md`
- Look at existing code examples
- Ask in community channels

### Found a Bug?
1. Check if it's a known issue
2. Write a reproduction test
3. Submit PR with fix
4. Update regression tests

### Security Issue?
- **DO NOT** open public issue
- Email security contact privately
- Follow responsible disclosure

---

## 📝 Changelog

### v2.0 (Current)
- Added Tauri 2.0 specifics
- Added security considerations
- Added performance & UX guide
- Added testing strategy
- Added Phase 5 DEBLOAT
- Updated all documents

### v1.0 (Initial)
- Requirements document
- Design document
- Tasks breakdown
- Project structure guide
- Cross-platform strategy

---

## ✨ Summary

**This is a comprehensive, production-ready specification for migrating Vaughan wallet to Tauri 2.0.**

**Key Points**:
1. **Tauri 2.0** with native mobile support
2. **Alloy-only** (no ethers-rs)
3. **Security-first** (MetaMask/Rabby patterns)
4. **Performance-optimized** (< 20MB binary)
5. **Well-tested** (80%+ coverage)
6. **Cross-platform** (Windows, Linux, macOS, Android)
7. **dApp-ready** (MetaMask API compatible)

**Ready to start? Begin with `CRITICAL-REQUIREMENTS.md`!**

---

**Good luck with the migration! 🚀**
