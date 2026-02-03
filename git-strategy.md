# Git Strategy for Tauri Migration

**Question**: How to manage GitHub when building Tauri inside the legacy Vaughan folder?

---

## 🎯 Recommended Strategy: Single Repo, Clear Branches

**Keep everything in one repo** with a clear migration strategy.

### Option 1: Feature Branch → Main (Recommended)

**Structure**:
```
main branch (current Iced version)
  ↓
feature/tauri-migration branch (Tauri development)
  ↓
main branch (after migration complete)
```

**Workflow**:

```bash
# 1. Create feature branch
git checkout -b feature/tauri-migration

# 2. Develop Tauri version (Phases 1-4)
# - src/ (old Iced code - keep for reference)
# - src-tauri/ (new Tauri backend)
# - web/ (new React frontend)

git add src-tauri/ web/
git commit -m "feat: add Tauri backend and React frontend"

# 3. Test thoroughly
# Run all tests, security audit, etc.

# 4. Merge to main when ready
git checkout main
git merge feature/tauri-migration

# 5. Phase 5: DEBLOAT (on main branch)
git rm -r src/gui/
git rm src/app.rs src/main.rs
# Update root Cargo.toml to remove Iced deps
git commit -m "chore: remove legacy Iced code"

# 6. Tag release
git tag -a v2.0.0 -m "Tauri 2.0 release"
git push origin main --tags
```

**Pros**:
- ✅ Clean history
- ✅ Easy to review changes
- ✅ Can revert if needed
- ✅ Both versions coexist during development
- ✅ Clear "before" and "after"

**Cons**:
- ⚠️ Large merge at the end
- ⚠️ Need to keep feature branch up to date

---

## Option 2: Main Branch Evolution (Simpler)

**Structure**:
```
main branch
  ↓ (commit: add Tauri)
main branch (both Iced and Tauri)
  ↓ (commit: remove Iced)
main branch (Tauri only)
```

**Workflow**:

```bash
# 1. Develop on main branch
git checkout main

# 2. Add Tauri alongside Iced
# Phases 1-4 happen on main
git add src-tauri/ web/
git commit -m "feat: add Tauri implementation"

# 3. When Tauri is stable, remove Iced
git rm -r src/gui/
git rm src/app.rs src/main.rs
git commit -m "chore: remove legacy Iced implementation"

# 4. Tag release
git tag -a v2.0.0 -m "Tauri 2.0 release"
git push origin main --tags
```

**Pros**:
- ✅ Simpler workflow
- ✅ No branch management
- ✅ Incremental commits

**Cons**:
- ⚠️ Main branch has "mixed" state during migration
- ⚠️ Harder to revert if needed

---

## Option 3: Separate Repo (Clean Slate)

**Structure**:
```
vaughan (old repo - Iced) - archived or maintained separately
vaughan-tauri (new repo - Tauri) - fresh start
```

**Pros**:
- ✅ **Clean slate**: No legacy code in new repo
- ✅ **Clear separation**: Old vs new is obvious
- ✅ **Smaller repo**: Only Tauri code, no Iced baggage
- ✅ **Independent releases**: Can maintain both if needed
- ✅ **Easier for contributors**: No confusion about which version

**Cons**:
- ⚠️ Lose git history (but can reference old repo)
- ⚠️ Need to manage two repos during transition
- ⚠️ Users need to know about new repo

**Use if**: You want a fresh start or plan to maintain Iced version separately.

### How to Set Up Separate Repo

**Step 1: Create new repo**
```bash
# On GitHub, create new repo: vaughan-tauri
# Clone it locally
git clone https://github.com/yourusername/vaughan-tauri.git
cd vaughan-tauri
```

**Step 2: Copy only what you need**
```bash
# Copy controllers and business logic (NOT GUI)
cp -r ../Vaughan-main/src/controllers ./src-tauri/src/
cp -r ../Vaughan-main/src/network ./src-tauri/src/
cp -r ../Vaughan-main/src/security ./src-tauri/src/
cp -r ../Vaughan-main/src/wallet ./src-tauri/src/
cp -r ../Vaughan-main/src/tokens ./src-tauri/src/
cp -r ../Vaughan-main/src/utils ./src-tauri/src/

# Copy tests
cp -r ../Vaughan-main/tests ./tests/

# Copy docs (migration specs)
cp -r ../Vaughan-main/.kiro ./.kiro/
cp -r ../Vaughan-main/docs ./docs/

# DON'T copy: src/gui/, src/app.rs, src/main.rs (Iced code)
```

**Step 3: Initialize Tauri**
```bash
# Initialize Tauri 2.0
npm create tauri-app@latest

# Set up project structure
# Follow tasks.md Phase 1
```

**Step 4: Reference old repo**
```bash
# Add reference to old repo in README
echo "# Vaughan Tauri

This is a complete rewrite of [Vaughan](https://github.com/yourusername/vaughan) using Tauri 2.0.

**Legacy Iced version**: See [vaughan](https://github.com/yourusername/vaughan)
" > README.md
```

**Step 5: First commit**
```bash
git add .
git commit -m "feat: initial Tauri 2.0 implementation

Migrated from vaughan (Iced) to Tauri 2.0.
See: https://github.com/yourusername/vaughan

Changes:
- Tauri 2.0 backend with Alloy
- React + TypeScript frontend
- dApp browser integration
- Android support
"
git push origin main
```

---

## 📁 Repository Structure During Migration

### During Development (Phases 1-4)

```
Vaughan-main/
├── .git/                      # Git repo
├── .github/
│   └── workflows/
│       ├── test-iced.yml      # Test old version
│       └── test-tauri.yml     # Test new version
│
├── src/                       # OLD: Iced code (keep for reference)
│   ├── controllers/           # Reference during migration
│   ├── gui/                   # Will be deleted in Phase 5
│   ├── app.rs                 # Will be deleted in Phase 5
│   └── main.rs                # Will be deleted in Phase 5
│
├── src-tauri/                 # NEW: Tauri backend
│   ├── src/
│   │   ├── controllers/       # Improved from src/controllers/
│   │   ├── commands/          # New
│   │   └── main.rs            # Tauri entry point
│   └── Cargo.toml             # Tauri dependencies
│
├── web/                       # NEW: React frontend
│   ├── src/
│   │   ├── components/
│   │   └── App.tsx
│   └── package.json
│
├── Cargo.toml                 # OLD: Iced dependencies (will be cleaned)
├── README.md                  # Update to mention both versions
└── .gitignore                 # Update for Tauri
```

### After Phase 5 (DEBLOAT)

```
Vaughan-main/
├── .git/
├── .github/
│   └── workflows/
│       └── test-tauri.yml     # Only Tauri tests
│
├── src-tauri/                 # Tauri backend
├── web/                       # React frontend
├── docs/                      # Documentation
├── tests/                     # Tests
├── README.md                  # Tauri-focused
└── .gitignore
```

---

## 📝 README.md Strategy

### During Migration

```markdown
# Vaughan Wallet

**Status**: Migrating to Tauri 2.0

## Versions

### Current (Iced) - v1.x
Desktop-only wallet using Iced GUI framework.

**Run**:
```bash
cargo run
```

### Next (Tauri) - v2.0 (In Development)
Cross-platform wallet (desktop + Android) using Tauri 2.0.

**Run**:
```bash
cargo tauri dev
```

**Status**: Phase 2 complete (Wallet UI)

## Migration Progress

- [x] Phase 1: Backend Setup
- [x] Phase 2: Wallet UI
- [ ] Phase 3: dApp Integration
- [ ] Phase 4: Testing & Polish
- [ ] Phase 5: DEBLOAT

See `.kiro/specs/tauri-migration/` for full migration plan.
```

### After Migration

```markdown
# Vaughan Wallet

Cross-platform Ethereum wallet built with Tauri 2.0 and Alloy.

## Features

- ✅ Desktop support (Windows, Linux, macOS)
- ✅ Android support
- ✅ dApp browser with MetaMask compatibility
- ✅ Pure Alloy implementation (no ethers-rs)
- ✅ Secure by design

## Quick Start

```bash
# Desktop
cargo tauri dev

# Android
cargo tauri android dev
```

## Migration from v1.x

Vaughan v2.0 is a complete rewrite using Tauri 2.0. See [MIGRATION.md](MIGRATION.md) for details.

**Legacy Iced version**: See [v1.x branch](https://github.com/yourusername/vaughan/tree/v1.x) or [releases](https://github.com/yourusername/vaughan/releases/tag/v1.9.0).
```

---

## 🏷️ Tagging Strategy

### During Migration

```bash
# Tag last Iced version before migration
git tag -a v1.9.0 -m "Last Iced version before Tauri migration"

# Tag migration milestones (optional)
git tag -a v2.0.0-alpha.1 -m "Phase 1 complete: Backend setup"
git tag -a v2.0.0-alpha.2 -m "Phase 2 complete: Wallet UI"
git tag -a v2.0.0-beta.1 -m "Phase 3 complete: dApp integration"
git tag -a v2.0.0-rc.1 -m "Release candidate"
```

### After Migration

```bash
# Tag final release
git tag -a v2.0.0 -m "Tauri 2.0 release - complete rewrite"
git push origin v2.0.0
```

---

## 🌿 Branch Strategy

### Recommended: GitFlow-style

```
main (production)
  ↓
develop (integration)
  ↓
feature/tauri-migration (development)
  ↓
feature/tauri-backend (Phase 1)
feature/tauri-ui (Phase 2)
feature/tauri-dapp (Phase 3)
```

**Workflow**:
```bash
# Create develop branch
git checkout -b develop

# Create feature branch
git checkout -b feature/tauri-migration

# Develop Phases 1-4
# Commit regularly

# Merge to develop for testing
git checkout develop
git merge feature/tauri-migration

# When stable, merge to main
git checkout main
git merge develop

# Phase 5: DEBLOAT on main
git rm -r src/gui/
git commit -m "chore: remove Iced code"
```

---

## 📦 .gitignore Updates

Add Tauri-specific ignores:

```gitignore
# Existing Iced ignores
/target
Cargo.lock

# Tauri backend
src-tauri/target/
src-tauri/Cargo.lock

# Frontend
web/node_modules/
web/dist/
web/.vite/

# Tauri build outputs
src-tauri/target/release/bundle/

# OS specific
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# Logs
*.log
npm-debug.log*
```

---

## 🔄 CI/CD Strategy

### During Migration

**`.github/workflows/test-both.yml`**:
```yaml
name: Test Both Versions

on: [push, pull_request]

jobs:
  test-iced:
    name: Test Iced Version
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Test Iced
        run: cargo test --lib
  
  test-tauri:
    name: Test Tauri Version
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node
        uses: actions/setup-node@v3
      - name: Test Tauri
        run: |
          cd src-tauri
          cargo test --all-features
```

### After Migration

**`.github/workflows/test.yml`**:
```yaml
name: Test Tauri

on: [push, pull_request]

jobs:
  test:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v3
      - name: Test
        run: |
          cd src-tauri
          cargo test --all-features
```

---

## 📢 Communication Strategy

### Announce Migration

**GitHub Issue**:
```markdown
# 🚀 Vaughan v2.0: Migrating to Tauri

We're migrating Vaughan to Tauri 2.0! This brings:

- ✅ Android support
- ✅ dApp browser
- ✅ Better performance
- ✅ Modern architecture

## Timeline

- Week 1-2: Backend + UI (Phases 1-2)
- Week 3: dApp integration (Phase 3)
- Week 4: Testing & polish (Phase 4)
- Week 5: Release (Phase 5)

## How to Help

- Test beta releases
- Report bugs
- Provide feedback on UX
- Help with macOS testing (we don't have a MacBook)

Follow progress in the `feature/tauri-migration` branch.
```

### Release Notes

**v2.0.0 Release**:
```markdown
# Vaughan v2.0.0 - Tauri Edition

## 🎉 Complete Rewrite

Vaughan has been completely rewritten using Tauri 2.0 and Alloy!

## ✨ New Features

- 🤖 **Android Support**: Use Vaughan on your phone
- 🌐 **dApp Browser**: Connect to Uniswap, Aave, and more
- ⚡ **Better Performance**: Faster startup, lower memory usage
- 🔒 **Enhanced Security**: Battle-tested patterns from MetaMask/Rabby
- 📦 **Smaller Binary**: < 20MB (down from 50MB)

## 🔄 Migration from v1.x

Your wallet data will be automatically migrated on first launch.

**Backup your seed phrase before upgrading!**

## 📥 Download

- Windows: `Vaughan-2.0.0-x64.msi`
- Linux: `Vaughan-2.0.0-amd64.AppImage`
- macOS: `Vaughan-2.0.0-x64.dmg`
- Android: `Vaughan-2.0.0.apk`

## 🙏 Thanks

Special thanks to the Tauri and Alloy teams, and our community testers!

## 📚 Documentation

See [docs/](docs/) for full documentation.
```

---

## 🎯 Recommended Strategy Summary

**You have 3 good options**:

### Option 1: Feature Branch → Main (Best for preserving history)
- Keep everything in one repo
- Develop on feature branch
- Merge when ready
- Remove Iced in Phase 5

**Choose if**: You want to preserve git history and keep everything together.

### Option 2: Main Branch Evolution (Simplest)
- Develop directly on main
- Add Tauri alongside Iced
- Remove Iced when ready

**Choose if**: You want the simplest workflow.

### Option 3: Separate Repo (Best for clean slate)
- Create new `vaughan-tauri` repo
- Copy only business logic (no GUI)
- Fresh start with Tauri
- Archive or maintain old repo separately

**Choose if**: You want a clean slate or plan to maintain both versions.

---

## 🆕 Separate Repo Strategy (Detailed)

If you choose Option 3 (separate repo), here's the complete workflow:

### Repository Names

```
Old: vaughan (or vaughan-iced)
New: vaughan-tauri (or just vaughan if you archive the old one)
```

### Step-by-Step Setup

**1. Create new GitHub repo**
```bash
# On GitHub: Create "vaughan-tauri" repo
# Clone locally
git clone https://github.com/yourusername/vaughan-tauri.git
cd vaughan-tauri
```

**2. Initialize Tauri 2.0**
```bash
npm create tauri-app@latest
# Select: React + TypeScript, Tauri 2.0
```

**3. Copy business logic (NOT GUI)**
```bash
# From old repo, copy only:
# - Controllers (✅)
# - Network logic (✅)
# - Security logic (✅)
# - Wallet logic (✅)
# - Token logic (✅)
# - Utils (✅)
# - Tests (✅)
# - Docs (✅)

# DON'T copy:
# - src/gui/ (❌ Iced GUI)
# - src/app.rs (❌ Iced app)
# - src/main.rs (❌ Iced entry point)
```

**4. Set up project structure**
```bash
# Create directories
mkdir -p src-tauri/src/controllers
mkdir -p src-tauri/src/commands
mkdir -p src-tauri/src/state

# Copy from old repo
cp -r ../Vaughan-main/src/controllers/* src-tauri/src/controllers/
cp -r ../Vaughan-main/src/network src-tauri/src/
cp -r ../Vaughan-main/src/security src-tauri/src/
cp -r ../Vaughan-main/src/wallet src-tauri/src/
cp -r ../Vaughan-main/src/tokens src-tauri/src/
cp -r ../Vaughan-main/src/utils src-tauri/src/
cp -r ../Vaughan-main/tests tests/
cp -r ../Vaughan-main/.kiro .kiro/
```

**5. Create README**
```markdown
# Vaughan Tauri

Cross-platform Ethereum wallet built with Tauri 2.0 and Alloy.

## About

This is a complete rewrite of [Vaughan](https://github.com/yourusername/vaughan) using Tauri 2.0.

**Why the rewrite?**
- ✅ Android support
- ✅ dApp browser
- ✅ Better performance
- ✅ Modern architecture

**Legacy Iced version**: See [vaughan](https://github.com/yourusername/vaughan) (archived)

## Quick Start

```bash
# Desktop
cargo tauri dev

# Android
cargo tauri android dev
```

## Migration from Iced

See [MIGRATION.md](MIGRATION.md) for migrating your wallet data.
```

**6. First commit**
```bash
git add .
git commit -m "feat: initial Tauri 2.0 implementation

Migrated from vaughan (Iced) to Tauri 2.0.

Changes:
- Tauri 2.0 backend with pure Alloy
- React + TypeScript frontend
- dApp browser with MetaMask compatibility
- Android support
- Improved security and performance

Original repo: https://github.com/yourusername/vaughan
"
git push origin main
```

### Managing Both Repos

**Old Repo (vaughan)**:
```markdown
# Vaughan (Iced) - ARCHIVED

⚠️ **This version is no longer maintained.**

**New version**: See [vaughan-tauri](https://github.com/yourusername/vaughan-tauri)

## Why archived?

Vaughan has been completely rewritten using Tauri 2.0 for better performance, Android support, and dApp integration.

## Last Release

- Version: v1.9.0
- Download: [Releases](https://github.com/yourusername/vaughan/releases/tag/v1.9.0)

## Migration

To migrate to the new version:
1. Backup your seed phrase
2. Download [vaughan-tauri](https://github.com/yourusername/vaughan-tauri)
3. Import your wallet

See [Migration Guide](https://github.com/yourusername/vaughan-tauri/blob/main/MIGRATION.md)
```

**New Repo (vaughan-tauri)**:
```markdown
# Vaughan Tauri

The next generation of Vaughan wallet.

**Previous version**: [vaughan](https://github.com/yourusername/vaughan) (Iced, archived)
```

### Transition Strategy

**Week 1-4**: Develop in `vaughan-tauri` repo
```bash
# Work in new repo
cd vaughan-tauri
git checkout -b feature/backend-setup
# ... develop
git push origin feature/backend-setup
```

**Week 5**: Release and announce
```bash
# Tag release
git tag -a v2.0.0 -m "Tauri 2.0 release"
git push origin v2.0.0

# Archive old repo
# On GitHub: Settings → Archive this repository
```

**Announcement**:
```markdown
# 🚀 Vaughan v2.0 - Now with Tauri!

We've completely rewritten Vaughan using Tauri 2.0!

## New Repo

**New location**: https://github.com/yourusername/vaughan-tauri

## What's New

- ✅ Android support
- ✅ dApp browser
- ✅ Better performance
- ✅ Smaller binary (< 20MB)

## Migration

1. Backup your seed phrase
2. Download v2.0 from new repo
3. Import your wallet

## Old Version

The Iced version (v1.x) is archived but still available:
https://github.com/yourusername/vaughan

## Questions?

See [FAQ](https://github.com/yourusername/vaughan-tauri/wiki/FAQ)
```

### Pros of Separate Repo

✅ **Clean slate**: No legacy code cluttering the repo  
✅ **Clear separation**: Users know which is which  
✅ **Smaller repo**: Faster clones, cleaner history  
✅ **Independent releases**: Can maintain both if needed  
✅ **Fresh start**: New contributors see only Tauri code  
✅ **Better organization**: No mixed Iced/Tauri structure  

### Cons of Separate Repo

⚠️ **Lose git history**: Can't see evolution (but can reference old repo)  
⚠️ **Two repos to manage**: During transition period  
⚠️ **Users need to know**: About new repo location  
⚠️ **Issues/PRs split**: Old issues in old repo, new in new repo  

### When to Choose Separate Repo

**Choose separate repo if**:
- You want a clean slate
- You plan to archive the Iced version
- You want to keep repos focused (Iced vs Tauri)
- You don't need git history from Iced version
- You want to rebrand or rename

**Choose same repo if**:
- You want to preserve git history
- You want all issues/PRs in one place
- You want simpler management
- You want to show evolution over time

---

## 🎯 Final Recommendation

**For Vaughan, I recommend**:

### If you want clean separation: **Option 3 (Separate Repo)**
```
vaughan (Iced) → Archive
vaughan-tauri (Tauri) → Active development
```

**Why**: Clean slate, no legacy code, clear branding

### If you want to preserve history: **Option 1 (Feature Branch)**
```
vaughan (main branch)
  ↓
feature/tauri-migration
  ↓
main (merged, Iced removed)
```

**Why**: Preserves history, shows evolution, simpler management

**Both are valid! Choose based on your preference.**

---

## ✅ CONFIRMED WORKFLOW (User's Choice)

**The user has chosen a hybrid approach: Build inside old folder, then copy to new repo**

### Complete Workflow

**Phase 1-4: Development (Inside Vaughan-main)**

```bash
# Work inside existing Vaughan-main folder
cd C:\Users\rb3y9\Desktop\Vaughan\Vaughan-main

# Initialize Tauri 2.0
npm create tauri-app@latest

# Develop Tauri version alongside Iced code
# - src/ (old Iced code - keep for reference)
# - src-tauri/ (new Tauri backend)
# - web/ (new React frontend)

# Commit to existing repo
git add src-tauri/ web/
git commit -m "feat: add Tauri implementation"
git push origin main
```

**Benefits during development**:
- ✅ AI agents can reference old Iced code easily
- ✅ Easy comparison between old and new
- ✅ All documentation in same place
- ✅ Git history preserved during development

**Phase 5: Release (Copy to New Repo)**

```bash
# When Tauri version is complete and tested:

# 1. Create new repo on GitHub
# Create "vaughan-tauri" repo on GitHub

# 2. Clone new repo
cd C:\Users\rb3y9\Desktop\Vaughan
git clone https://github.com/yourusername/vaughan-tauri.git
cd vaughan-tauri

# 3. Copy ONLY Tauri files (not Iced code)
# Copy from Vaughan-main to vaughan-tauri:
cp -r ../Vaughan-main/src-tauri ./
cp -r ../Vaughan-main/web ./
cp -r ../Vaughan-main/docs ./
cp -r ../Vaughan-main/tests ./
cp -r ../Vaughan-main/.kiro ./
cp ../Vaughan-main/README.md ./
cp ../Vaughan-main/LICENSE ./
cp ../Vaughan-main/.gitignore ./

# DON'T copy:
# - src/ (Iced GUI code)
# - Cargo.toml (root, Iced dependencies)
# - target/ (build artifacts)
# - Any Iced-specific files

# 4. Update README for new repo
# Edit README.md to remove Iced references

# 5. First commit to new repo
git add .
git commit -m "feat: initial Tauri 2.0 release

Complete rewrite of Vaughan wallet using Tauri 2.0 and Alloy.

Original Iced version: https://github.com/yourusername/vaughan
"
git push origin main

# 6. Tag release
git tag -a v2.0.0 -m "Tauri 2.0 release"
git push origin v2.0.0
```

**Result**:
```
Vaughan-main/                    # Old repo (keep or archive)
├── src/                         # Iced code
├── src-tauri/                   # Tauri code (developed here)
├── web/                         # React code (developed here)
└── ...

vaughan-tauri/                   # New repo (clean)
├── src-tauri/                   # Tauri code (copied)
├── web/                         # React code (copied)
├── docs/                        # Docs (copied)
├── tests/                       # Tests (copied)
└── ...                          # No Iced code!
```

**Benefits of this approach**:
- ✅ **During development**: Easy reference to old code, AI-friendly
- ✅ **After release**: Clean new repo with no legacy code
- ✅ **Best of both worlds**: Development convenience + clean release
- ✅ **Simple workflow**: Build in one place, copy when ready

### Managing Old Repo

**Option A: Archive it**
```markdown
# Vaughan (Iced) - ARCHIVED

⚠️ **This version is no longer maintained.**

**New version**: See [vaughan-tauri](https://github.com/yourusername/vaughan-tauri)

Last release: v1.9.0
```

**Option B: Keep it for reference**
```markdown
# Vaughan (Iced) - Legacy Version

**Active development**: See [vaughan-tauri](https://github.com/yourusername/vaughan-tauri)

This repo contains the original Iced implementation for reference.
```

### Summary

**Development**: Build inside `Vaughan-main/` (keeps old code for reference)  
**Release**: Copy to `vaughan-tauri/` (clean slate, no legacy code)  
**Result**: Best of both worlds! 🎉
