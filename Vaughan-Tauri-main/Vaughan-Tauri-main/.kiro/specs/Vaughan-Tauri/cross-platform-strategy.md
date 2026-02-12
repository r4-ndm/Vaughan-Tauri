# Cross-Platform Development Strategy

**Primary Platform**: Windows  
**Target Platforms**: Windows, Linux, Android, macOS

---

## TL;DR - When to Test Each Platform

- **Windows**: Continuously (your dev machine)
- **Linux**: Weekly during development, daily in final week
- **Android**: End of Phase 2, then weekly
- **macOS**: CI/CD builds only, community testing at release

---

## Development Workflow

### Phase 1: Backend Setup (Week 1)
**Focus**: Windows only

- Develop entirely on Windows
- Rust code is cross-platform by default
- Tauri commands work the same on all platforms
- **No Linux testing needed yet**

**Why**: Backend is pure Rust - if it compiles on Windows, it'll work on Linux

### Phase 2: Wallet UI (Week 2)
**Focus**: Windows primary, Linux check at end

- Develop on Windows
- Test in Windows browser
- **Friday of Week 2**: Quick Linux VM test
  - Boot Linux VM (or WSL2)
  - Run `cargo tauri dev`
  - Test basic UI
  - Fix any Linux-specific issues

**Why**: UI is web-based - mostly cross-platform, but check for path/font issues

### Phase 3: dApp Integration (Week 3)
**Focus**: Windows primary, Linux + Android checks

- Develop on Windows
- **Mid-week**: Linux VM test
  - Test dApp browser
  - Test iframe isolation
  - Fix any issues
- **End of week**: Android test
  - Build Android APK
  - Test on Android device/emulator
  - Test touch interactions
  - Fix mobile-specific issues

**Why**: dApp browser might have platform-specific quirks

### Phase 4: Polish & Release (Week 4)
**Focus**: All platforms

- **Daily**: Test on Windows
- **Daily**: Test on Linux VM
- **Every 2 days**: Test on Android
- **CI/CD**: macOS builds automatically

---

## Recommended Setup

### Option 1: WSL2 (Easiest)
**Best for**: Quick Linux testing without leaving Windows

```bash
# Install WSL2 with Ubuntu
wsl --install -d Ubuntu

# Inside WSL2, install dependencies
sudo apt update
sudo apt install -y libwebkit2gtk-4.0-dev \
    build-essential curl wget file \
    libssl-dev libgtk-3-dev libayatana-appindicator3-dev \
    librsvg2-dev

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Your Windows files are at /mnt/c/
cd /mnt/c/Users/rb3y9/Desktop/Vaughan/Vaughan-main

# Test build
cargo tauri dev
```

**Pros**:
- No VM overhead
- Access Windows files directly
- Fast switching (just open terminal)
- Good for quick tests

**Cons**:
- GUI apps need X server (VcXsrv or WSLg)
- Not 100% identical to native Linux

### Option 2: VirtualBox/VMware (Most Accurate)
**Best for**: Full Linux testing

```bash
# Create Ubuntu 22.04 VM
# Allocate: 4GB RAM, 2 CPU cores, 50GB disk

# Inside VM, install dependencies (same as WSL2)
# Share folder with Windows host
# Test builds in native Linux environment
```

**Pros**:
- True Linux environment
- Test GUI exactly as users see it
- Can test different distros

**Cons**:
- Slower than WSL2
- More resource intensive
- Need to transfer files

### Option 3: Docker (For CI/CD)
**Best for**: Automated testing

```dockerfile
# Dockerfile for Linux builds
FROM ubuntu:22.04

RUN apt update && apt install -y \
    libwebkit2gtk-4.0-dev build-essential curl \
    libssl-dev libgtk-3-dev

# ... rest of setup
```

**Pros**:
- Reproducible builds
- Easy CI/CD integration
- Lightweight

**Cons**:
- No GUI testing
- Build-only, not for development

---

## Android Development Setup

### Prerequisites
```bash
# Install Android Studio (on Windows)
# Install Android SDK
# Install Android NDK
# Install Java JDK 11+

# Install Tauri Mobile CLI
cargo install tauri-cli --version "^2.0.0-alpha"

# Add Android targets
rustup target add aarch64-linux-android
rustup target add armv7-linux-androideabi
rustup target add i686-linux-android
rustup target add x86_64-linux-android
```

### Android Testing Workflow

**Option A: Physical Device (Recommended)**
```bash
# Enable USB debugging on Android device
# Connect via USB

# Build and run
cargo tauri android dev

# App installs and runs on device
# Hot reload works
```

**Option B: Android Emulator**
```bash
# Create emulator in Android Studio
# Start emulator

# Build and run
cargo tauri android dev

# App installs and runs in emulator
```

**When to Test Android**:
- End of Phase 2 (basic UI)
- Weekly during Phase 3 (dApp browser)
- Daily during Phase 4 (polish)

---

## Recommended Testing Schedule

### Week 1: Backend Setup
```
Monday-Thursday: Windows only
Friday: Quick WSL2 test (5 minutes)
```

### Week 2: Wallet UI
```
Monday-Thursday: Windows only
Friday: 
  - WSL2 test (30 minutes)
  - OR VirtualBox test (1 hour)
  - Fix any Linux issues
```

### Week 3: dApp Integration
```
Monday-Tuesday: Windows only
Wednesday: 
  - Linux test (1 hour)
  - Fix issues
Thursday-Friday: Windows only
Saturday:
  - Android test (2 hours)
  - Fix mobile issues
```

### Week 4: Polish & Release
```
Monday: Windows + Linux testing
Tuesday: Windows + Android testing
Wednesday: Windows + Linux + Android testing
Thursday: All platforms + fixes
Friday: Final testing + release
```

---

## CI/CD Strategy (Recommended)

### GitHub Actions Setup

Create `.github/workflows/build.yml`:

```yaml
name: Build All Platforms

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  # Windows build (your primary platform)
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
      - name: Build
        run: cargo tauri build
      - name: Upload artifact
        uses: actions/upload-artifact@v3
        with:
          name: windows-build
          path: src-tauri/target/release/bundle/

  # Linux build (automated)
  build-linux:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install dependencies
        run: |
          sudo apt update
          sudo apt install -y libwebkit2gtk-4.0-dev \
            build-essential curl wget file \
            libssl-dev libgtk-3-dev
      - uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
      - name: Build
        run: cargo tauri build
      - name: Upload artifact
        uses: actions/upload-artifact@v3
        with:
          name: linux-build
          path: src-tauri/target/release/bundle/

  # macOS build (automated, no manual testing)
  build-macos:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
      - name: Build
        run: cargo tauri build
      - name: Upload artifact
        uses: actions/upload-artifact@v3
        with:
          name: macos-build
          path: src-tauri/target/release/bundle/

  # Android build (automated)
  build-android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Android SDK
        uses: android-actions/setup-android@v2
      - uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
      - name: Add Android targets
        run: |
          rustup target add aarch64-linux-android
          rustup target add armv7-linux-androideabi
      - name: Build
        run: cargo tauri android build
      - name: Upload artifact
        uses: actions/upload-artifact@v3
        with:
          name: android-build
          path: src-tauri/gen/android/app/build/outputs/
```

**Benefits**:
- Every commit builds on all platforms
- Catch platform-specific issues early
- No manual macOS testing needed
- Automated release builds

---

## Platform-Specific Issues to Watch For

### Linux-Specific
- **File paths**: Use `std::path::PathBuf` (not hardcoded `\`)
- **Fonts**: May look different, test font rendering
- **Permissions**: File permissions might differ
- **Dependencies**: WebKit2GTK required

**Test**: File operations, UI rendering, permissions

### Android-Specific
- **Touch targets**: Minimum 44px
- **Screen sizes**: Test on different resolutions
- **Permissions**: Camera, storage, network
- **Performance**: May be slower than desktop
- **Back button**: Handle Android back button

**Test**: Touch interactions, performance, permissions

### macOS-Specific (Community Testing)
- **Code signing**: Required for distribution
- **Notarization**: Required for Gatekeeper
- **Permissions**: Keychain access, network
- **UI**: Native look and feel

**Test**: Via community testers only

---

## Practical Workflow Example

### Daily Development (Monday-Thursday)
```bash
# On Windows
1. Write code
2. Test on Windows: cargo tauri dev
3. Commit changes
4. GitHub Actions builds Linux/macOS automatically
5. Check CI/CD results (green = probably works)
```

### Weekly Linux Check (Friday)
```bash
# Option A: WSL2 (5-30 minutes)
wsl
cd /mnt/c/Users/rb3y9/Desktop/Vaughan/Vaughan-main
cargo tauri dev
# Test basic functionality
# Fix any issues

# Option B: VirtualBox (1 hour)
# Boot VM
# Pull latest code
# cargo tauri dev
# Test thoroughly
# Fix any issues
```

### Weekly Android Check (Saturday)
```bash
# On Windows with Android device connected
cargo tauri android dev
# Test on device
# Fix mobile-specific issues
```

---

## When You MUST Test on Each Platform

### Linux
- ✅ **Must test**: File I/O, paths, permissions
- ✅ **Must test**: UI rendering (fonts, colors)
- ⚠️ **Can skip**: Pure Rust logic (same as Windows)

### Android
- ✅ **Must test**: Touch interactions
- ✅ **Must test**: Screen sizes and orientations
- ✅ **Must test**: Performance
- ✅ **Must test**: Mobile-specific UI

### macOS
- ⚠️ **CI/CD only**: Automated builds
- ⚠️ **Community testing**: At release time
- ❌ **Don't block on**: No MacBook = no problem

---

## Recommended Approach for You

Based on your situation (Windows primary, no MacBook):

### Weeks 1-2: Windows Only
- Develop on Windows
- CI/CD builds Linux/macOS automatically
- Check CI/CD passes (green checkmark)
- **No manual Linux testing needed**

### Week 3: Add Linux Testing
- Continue developing on Windows
- **Friday**: 30-minute WSL2 test
- Fix any Linux issues
- **Saturday**: 2-hour Android test
- Fix mobile issues

### Week 4: Full Testing
- **Daily**: Windows testing
- **Every 2 days**: WSL2 quick test (15 min)
- **Every 2 days**: Android test (30 min)
- **CI/CD**: macOS builds automatically
- **Release**: Request community macOS testers

---

## Summary

**You don't need to constantly flip between platforms!**

- **95% of development**: Windows only
- **5% of time**: Linux/Android testing
- **0% of time**: macOS (CI/CD + community)

**Key insight**: Rust + Tauri are cross-platform by design. If it works on Windows, it'll *probably* work on Linux. Test weekly to catch the edge cases.

**Recommended setup**: WSL2 for quick Linux checks, physical Android device for mobile testing.

**Time investment**:
- WSL2 setup: 30 minutes (one-time)
- Android setup: 1 hour (one-time)
- Weekly Linux testing: 30 minutes
- Weekly Android testing: 1 hour
- **Total**: ~2 hours per week for cross-platform testing

This is manageable and won't slow you down!
