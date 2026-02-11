# Contributing to Vaughan Wallet

Thank you for your interest in contributing to Vaughan! This document provides guidelines and instructions for contributing.

---

## 🎯 Code of Conduct

Be respectful, professional, and constructive. We're building a secure wallet that people trust with their assets.

---

## 🚀 Getting Started

### Prerequisites

1. **Rust** 1.75+ ([Install](https://rustup.rs/))
2. **Node.js** 18+ ([Install](https://nodejs.org/))
3. **Tauri CLI** ([Install](https://v2.tauri.app/start/prerequisites/))
4. **Git** ([Install](https://git-scm.com/))

### Setup Development Environment

```bash
# Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/Vaughan-Tauri.git
cd Vaughan-Tauri

# Install dependencies
npm install

# Run in development mode
cargo tauri dev

# Run tests
cargo test --all-features
```

---

## 📋 Before You Start

### Read the Documentation

**REQUIRED READING** (in order):
1. [CRITICAL-REQUIREMENTS.md](.kiro/specs/Vaughan-Tauri/CRITICAL-REQUIREMENTS.md) - Non-negotiable rules
2. [MULTI-CHAIN-ARCHITECTURE.md](.kiro/specs/Vaughan-Tauri/MULTI-CHAIN-ARCHITECTURE.md) - Architecture design
3. [Development Rules](.kiro/steering/vaughan-tauri-rules.md) - Coding standards

**Reference as needed**:
- [Requirements](.kiro/specs/Vaughan-Tauri/requirements.md) - What we're building
- [Design](.kiro/specs/Vaughan-Tauri/design.md) - How we're building it
- [Security](.kiro/specs/Vaughan-Tauri/security-considerations.md) - Security requirements

---

## 🔒 Critical Rules

### 1. No Custom Crypto Code

**❌ NEVER write custom**:
- Signing algorithms
- Encryption schemes
- Key derivation
- Hash functions
- RPC implementations

**✅ ALWAYS use**:
- Alloy libraries for Ethereum operations
- Standard crates (aes-gcm, argon2, sha2, etc.)
- EIP-1193 provider specification

### 2. Multi-Chain Architecture

**❌ DON'T**:
```rust
// Tightly coupled to EVM
pub struct WalletCore {
    provider: AlloyProvider,  // EVM-only
}
```

**✅ DO**:
```rust
// Trait-based, works with ANY chain
pub trait ChainAdapter { /* ... */ }

pub struct WalletCore {
    adapters: HashMap<ChainType, Box<dyn ChainAdapter>>,
}
```

### 3. Code Quality Standards

- ✅ Files < 500 lines
- ✅ Functions < 50 lines
- ✅ Proper error handling (no unwrap/expect)
- ✅ Comprehensive doc comments
- ✅ Tests for all new code
- ✅ One responsibility per module

---

## 🎨 Development Workflow

### 1. Create a Branch

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Or bug fix branch
git checkout -b fix/bug-description
```

### 2. Make Your Changes

Follow the [7-step process](.kiro/steering/vaughan-tauri-rules.md#required-process-7-steps):

1. **READ** - Understand existing code
2. **ANALYZE** - Identify improvements
3. **DESIGN** - Plan your solution
4. **IMPLEMENT** - Write clean code
5. **TEST** - Write comprehensive tests
6. **DOCUMENT** - Add doc comments
7. **REVIEW** - Check quality checklist

### 3. Write Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_your_feature() {
        // Arrange
        let input = setup_test_data();
        
        // Act
        let result = your_function(input);
        
        // Assert
        assert_eq!(result, expected);
    }
}
```

### 4. Run Tests

```bash
# Run all tests
cargo test --all-features

# Run specific test
cargo test test_your_feature

# Run with output
cargo test -- --nocapture
```

### 5. Check Code Quality

```bash
# Format code
cargo fmt

# Run clippy
cargo clippy --all-features -- -D warnings

# Check compilation
cargo check --all-features
```

### 6. Commit Your Changes

```bash
# Stage changes
git add .

# Commit with descriptive message
git commit -m "feat: add amazing feature

- Implement X
- Add tests for Y
- Update documentation
"
```

**Commit Message Format**:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `test:` - Test additions/changes
- `refactor:` - Code refactoring
- `chore:` - Maintenance tasks

### 7. Push and Create PR

```bash
# Push to your fork
git push origin feature/your-feature-name

# Create Pull Request on GitHub
# Fill out the PR template
```

---

## 🧪 Testing Guidelines

### Test Coverage Goals

- **Unit tests**: 80%+ coverage
- **Integration tests**: 60%+ coverage
- **E2E tests**: Critical paths only

### Test Structure

```
tests/
├── unit/               # Unit tests
│   ├── chains/
│   ├── core/
│   └── commands/
├── integration/        # Integration tests
│   ├── wallet_flow.rs
│   └── transaction_flow.rs
└── e2e/               # End-to-end tests
    └── dapp_integration.rs
```

### Writing Good Tests

```rust
#[test]
fn test_send_transaction_success() {
    // Arrange - Set up test data
    let wallet = setup_test_wallet();
    let tx = create_test_transaction();
    
    // Act - Execute the function
    let result = wallet.send_transaction(tx).await;
    
    // Assert - Verify the result
    assert!(result.is_ok());
    assert_eq!(result.unwrap().status, TxStatus::Success);
}

#[test]
fn test_send_transaction_insufficient_balance() {
    // Test error cases too!
    let wallet = setup_wallet_with_zero_balance();
    let tx = create_large_transaction();
    
    let result = wallet.send_transaction(tx).await;
    
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), WalletError::InsufficientBalance);
}
```

---

## 📝 Documentation Guidelines

### Doc Comments

```rust
/// Sends a transaction on the specified chain.
///
/// This function validates the transaction, estimates gas,
/// signs it, and broadcasts it to the network.
///
/// # Arguments
/// * `chain` - The blockchain to send the transaction on
/// * `tx` - The transaction to send
///
/// # Returns
/// * `Ok(TxHash)` - Transaction hash if successful
/// * `Err(ChainError)` - Error if transaction fails
///
/// # Examples
/// ```
/// let tx_hash = wallet.send_transaction(
///     ChainType::Evm(EvmChain::Ethereum),
///     transaction
/// ).await?;
/// ```
///
/// # Errors
/// * `ChainError::InsufficientBalance` - Not enough funds
/// * `ChainError::InvalidAddress` - Invalid recipient
/// * `ChainError::NetworkError` - Network issues
pub async fn send_transaction(
    &self,
    chain: ChainType,
    tx: ChainTransaction,
) -> Result<TxHash, ChainError> {
    // Implementation
}
```

### README Files

Each module should have a README.md:

```markdown
# Module Name

Brief description of what this module does.

## Purpose

Why this module exists.

## Usage

```rust
// Example code
```

## Architecture

How this module fits into the overall system.
```

---

## 🔍 Code Review Process

### What We Look For

1. **Correctness**: Does it work as intended?
2. **Security**: Are there any vulnerabilities?
3. **Performance**: Is it efficient?
4. **Maintainability**: Is it easy to understand?
5. **Tests**: Are there comprehensive tests?
6. **Documentation**: Is it well-documented?

### Review Checklist

- [ ] Code follows the [development rules](.kiro/steering/vaughan-tauri-rules.md)
- [ ] No custom crypto code
- [ ] Trait-based design for multi-chain support
- [ ] All tests pass
- [ ] Code coverage meets goals (80%+)
- [ ] Documentation is complete
- [ ] No unwrap/expect (proper error handling)
- [ ] Files < 500 lines, functions < 50 lines
- [ ] Clippy passes with no warnings
- [ ] Code is formatted (cargo fmt)

---

## 🐛 Reporting Bugs

### Before Reporting

1. Check [existing issues](https://github.com/r4-ndm/Vaughan-Tauri/issues)
2. Verify it's reproducible
3. Test on latest version

### Bug Report Template

```markdown
**Description**
Clear description of the bug.

**Steps to Reproduce**
1. Go to '...'
2. Click on '...'
3. See error

**Expected Behavior**
What should happen.

**Actual Behavior**
What actually happens.

**Environment**
- OS: [e.g., Windows 11]
- Vaughan Version: [e.g., 2.0.0]
- Rust Version: [e.g., 1.75.0]

**Logs**
```
Paste relevant logs here
```

**Screenshots**
If applicable.
```

---

## 💡 Feature Requests

### Before Requesting

1. Check [existing discussions](https://github.com/r4-ndm/Vaughan-Tauri/discussions)
2. Consider if it fits the project goals
3. Think about implementation

### Feature Request Template

```markdown
**Problem**
What problem does this solve?

**Proposed Solution**
How should it work?

**Alternatives**
Other solutions you've considered.

**Additional Context**
Any other information.
```

---

## 🔐 Security Issues

**DO NOT** open public issues for security vulnerabilities!

See [SECURITY.md](SECURITY.md) for responsible disclosure process.

---

## 📚 Resources

### Learning Resources

- [Tauri 2.0 Documentation](https://v2.tauri.app/)
- [Alloy Documentation](https://alloy-rs.github.io/alloy/)
- [EIP-1193 Specification](https://eips.ethereum.org/EIPS/eip-1193)
- [Rust Book](https://doc.rust-lang.org/book/)

### Project Documentation

- [Architecture](.kiro/specs/Vaughan-Tauri/MULTI-CHAIN-ARCHITECTURE.md)
- [Requirements](.kiro/specs/Vaughan-Tauri/requirements.md)
- [Design](.kiro/specs/Vaughan-Tauri/design.md)
- [Security](.kiro/specs/Vaughan-Tauri/security-considerations.md)

---

## 🎉 Recognition

Contributors will be:
- Listed in [CONTRIBUTORS.md](CONTRIBUTORS.md)
- Mentioned in release notes
- Credited in the project

---

## 📞 Questions?

- **General questions**: [GitHub Discussions](https://github.com/r4-ndm/Vaughan-Tauri/discussions)
- **Bug reports**: [GitHub Issues](https://github.com/r4-ndm/Vaughan-Tauri/issues)
- **Security issues**: See [SECURITY.md](SECURITY.md)

---

**Thank you for contributing to Vaughan! 🙏**
