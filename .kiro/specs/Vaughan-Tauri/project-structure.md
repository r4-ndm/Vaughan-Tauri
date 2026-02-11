# Tauri Migration - Project Structure

**Question**: Should I build Tauri inside the old Vaughan folder or create a new folder?

**Answer**: Build INSIDE the old Vaughan folder (side-by-side approach)

---

## Recommended Structure

```
Vaughan-main/                          # Your current folder
├── .git/                              # Keep existing git repo
├── .kiro/                             # Keep existing Kiro config
│   ├── specs/tauri-migration/         # Migration specs (already here)
│   └── steering/                      # Steering files
│
├── src/                               # OLD Iced code (keep for reference)
│   ├── controllers/                   # Reference these during migration
│   ├── gui/                           # Analyze these, don't copy
│   ├── network/                       # Reference these
│   ├── security/                      # Reference these
│   ├── wallet/                        # Reference these
│   └── ...
│
├── src-tauri/                         # NEW Tauri backend (create this)
│   ├── src/
│   │   ├── controllers/               # Improved versions from src/controllers/
│   │   ├── commands/                  # New - converted from src/gui/handlers/
│   │   ├── state/                     # New - state management
│   │   ├── network/                   # Improved from src/network/
│   │   ├── security/                  # Improved from src/security/
│   │   ├── wallet/                    # Improved from src/wallet/
│   │   └── main.rs                    # Tauri entry point
│   ├── Cargo.toml                     # Tauri dependencies
│   └── tauri.conf.json                # Tauri configuration
│
├── web/                               # NEW React frontend (create this)
│   ├── src/
│   │   ├── components/                # New - recreate from src/gui/components/
│   │   ├── views/                     # New - recreate from src/gui/views/
│   │   ├── services/                  # New - Tauri command wrappers
│   │   ├── utils/                     # New - frontend utilities
│   │   └── App.tsx                    # React entry point
│   ├── package.json                   # Node dependencies
│   └── index.html                     # HTML entry point
│
├── tests/                             # Keep existing tests
├── docs/                              # Keep existing docs
├── Cargo.toml                         # OLD Iced Cargo.toml (keep for reference)
├── README.md                          # Update with Tauri info
└── ...
```

---

## Why This Approach?

### ✅ Advantages

1. **Easy Reference**: AI agents can read old Iced code while writing new Tauri code
   ```
   Agent: "Let me read src/controllers/transaction.rs to understand the logic"
   Agent: "Now I'll write improved version in src-tauri/src/controllers/transaction.rs"
   ```

2. **Git History Preserved**: Keep all your commits and history

3. **Gradual Migration**: Can run both versions during development
   - Old Iced: `cargo run`
   - New Tauri: `cargo tauri dev`

4. **Easy Comparison**: Compare old vs new side-by-side

5. **Documentation Context**: All your docs are still relevant

6. **No File Moving**: Don't need to copy files back and forth

### ❌ Alternative (Not Recommended)

Creating a separate folder:
```
Desktop/
├── Vaughan-main/           # Old Iced version
└── Vaughan-tauri/          # New Tauri version (separate)
```

**Problems**:
- AI agents can't easily reference old code
- Need to copy files between folders
- Lose git history context
- Harder to compare old vs new
- Documentation is in different folder

---

## Migration Workflow

### Step 1: Initialize Tauri (Inside Vaughan-main)

```bash
cd C:\Users\rb3y9\Desktop\Vaughan\Vaughan-main

# Initialize Tauri (creates src-tauri/ and web/)
cargo install tauri-cli
cargo tauri init

# Answer prompts:
# - App name: Vaughan
# - Window title: Vaughan Wallet
# - Web assets: ../web/dist
# - Dev server: http://localhost:5173
# - Frontend dev command: npm run dev
# - Frontend build command: npm run build
```

This creates:
```
Vaughan-main/
├── src/              # OLD (unchanged)
├── src-tauri/        # NEW (created)
└── web/              # NEW (created, or you set up manually)
```

### Step 2: Set Up Frontend

```bash
# Inside Vaughan-main/
npm create vite@latest web -- --template react-ts

cd web
npm install
npm install @tauri-apps/api
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### Step 3: Start Migrating

Now AI agents can:
```
1. Read: src/controllers/transaction.rs (old Iced)
2. Analyze: What does this do? What can be improved?
3. Write: src-tauri/src/controllers/transaction.rs (new Tauri)
4. Compare: Side-by-side in same workspace
```

---

## File Organization During Migration

### Phase 1: Backend Setup

```
Vaughan-main/
├── src/                               # Reference these
│   ├── controllers/                   # Read these
│   ├── network/                       # Read these
│   └── ...
│
└── src-tauri/src/                     # Write here
    ├── controllers/                   # Improved versions
    ├── commands/                      # New
    └── ...
```

### Phase 2: UI Recreation

```
Vaughan-main/
├── src/gui/                           # Reference these
│   ├── views/                         # Analyze these
│   ├── components/                    # Analyze these
│   └── widgets/                       # Analyze these
│
└── web/src/                           # Write here
    ├── views/                         # New React versions
    ├── components/                    # New React versions
    └── ...
```

---

## Git Strategy

### Option 1: Same Branch (Recommended)

```bash
# Continue on main branch
git checkout main

# Commit Tauri code alongside Iced code
git add src-tauri/ web/
git commit -m "feat: add Tauri implementation"

# Old Iced code stays in src/
# New Tauri code in src-tauri/ and web/
```

**Advantages**:
- Simple
- Easy to compare
- Can switch between versions

### Option 2: Feature Branch

```bash
# Create feature branch
git checkout -b feature/tauri-migration

# Commit Tauri code
git add src-tauri/ web/
git commit -m "feat: add Tauri implementation"

# Merge when ready
git checkout main
git merge feature/tauri-migration
```

**Advantages**:
- Cleaner history
- Can PR review
- Easy to abandon if needed

---

## Running Both Versions

### Old Iced Version
```bash
cd C:\Users\rb3y9\Desktop\Vaughan\Vaughan-main
cargo run
```

### New Tauri Version
```bash
cd C:\Users\rb3y9\Desktop\Vaughan\Vaughan-main
cargo tauri dev
```

Both can coexist! Different binaries, different data directories.

---

## When to Remove Old Code

**Don't remove old code until Tauri version is complete and tested!**

### After Release

Once Tauri version is stable:

```bash
# Option 1: Archive old code
mkdir archive
mv src/ archive/iced-src/
mv Cargo.toml archive/iced-Cargo.toml

# Option 2: Delete old code
git rm -r src/
git rm Cargo.toml
git commit -m "chore: remove old Iced implementation"

# Option 3: Keep for reference (recommended)
# Just leave it there, it doesn't hurt
```

**Recommendation**: Keep old code for 1-2 releases, then archive or delete.

---

## AI Agent Instructions

When working on migration, AI agents should:

1. **Read old code**: `src/controllers/transaction.rs`
2. **Analyze**: What does it do? What can be improved?
3. **Write new code**: `src-tauri/src/controllers/transaction.rs`
4. **Reference docs**: `docs/` folder still relevant
5. **Update specs**: `.kiro/specs/tauri-migration/`

Example prompt:
```
"Migrate the transaction controller:
1. Read src/controllers/transaction.rs (old Iced version)
2. Analyze what it does and identify improvements
3. Write improved version to src-tauri/src/controllers/transaction.rs
4. Follow the 7-step process in .kiro/steering/tauri-migration-rules.md"
```

---

## Directory Size Considerations

### Before Migration
```
Vaughan-main/
├── src/          ~5 MB
├── target/       ~2 GB (build artifacts)
└── ...
Total: ~2 GB
```

### After Migration
```
Vaughan-main/
├── src/          ~5 MB (old)
├── src-tauri/    ~5 MB (new)
├── web/          ~2 MB (new)
├── target/       ~2 GB (old build)
├── src-tauri/target/  ~2 GB (new build)
├── web/node_modules/  ~500 MB
└── ...
Total: ~5 GB
```

**Note**: You can clean old builds with `cargo clean` in root to save space.

---

## Recommended .gitignore Updates

Add to `.gitignore`:

```gitignore
# Tauri
src-tauri/target/
src-tauri/Cargo.lock

# Frontend
web/node_modules/
web/dist/
web/.vite/

# Keep old Iced stuff ignored
target/
Cargo.lock
```

---

## Summary

**✅ CONFIRMED WORKFLOW**:

### Development (Phases 1-4)
**Build inside `Vaughan-main/` folder**
- Creates `src-tauri/` and `web/` alongside existing `src/`
- AI agents can reference old code easily
- Git history preserved
- Easy comparison

### Release (Phase 5)
**Copy to new `vaughan-tauri/` repo**
- Copy only: `src-tauri/`, `web/`, `docs/`, `tests/`, `.kiro/`
- Don't copy: `src/` (Iced code), root `Cargo.toml` (Iced deps)
- Result: Clean new repo with no legacy code

**Structure during development**:
```
Vaughan-main/
├── src/              # OLD (keep for reference)
├── src-tauri/        # NEW (Rust backend)
├── web/              # NEW (React frontend)
└── .kiro/specs/      # Migration specs
```

**Structure after release**:
```
vaughan-tauri/        # New repo
├── src-tauri/        # Copied
├── web/              # Copied
├── docs/             # Copied
├── tests/            # Copied
└── .kiro/            # Copied
```

**Benefits**:
- ✅ **During development**: Easy reference, AI-friendly
- ✅ **After release**: Clean repo, no legacy code
- ✅ **Best of both worlds**: Development convenience + clean release

This is the optimal approach for AI-assisted migration!
