---
inclusion: manual
---

# Vaughan Tauri Development Rules

**CRITICAL**: When working on Vaughan Tauri, you MUST follow these rules.

**🚨 READ FIRST**: 
- `.kiro/specs/Vaughan-Tauri/CRITICAL-REQUIREMENTS.md` - Non-negotiable rules
- `.kiro/specs/Vaughan-Tauri/AI-AGENT-GUIDE.md` - Navigation guide for AI agents

---

## 🤖 Quick Navigation for AI Agents

**Don't know which file to read?** → See `AI-AGENT-GUIDE.md`

**Implementing Phase 1?** → Read `tauri-2.0-specifics.md` + `security-considerations.md`  
**Implementing Phase 2?** → Read `design.md` + `performance-ux-considerations.md`  
**Implementing Phase 3?** → Read `security-considerations.md` Section 3 (dApp Security)  
**Implementing Phase 4?** → Read `testing-strategy.md`  
**Implementing Phase 5?** → Read `tauri-2.0-specifics.md` Section 8 (DEBLOAT)

---

## Non-Negotiable Requirements

1. **Tauri 2.0**: Use `npm create tauri-app@latest` (NOT `cargo tauri init`)
2. **Alloy Purity**: ZERO ethers-rs imports allowed
3. **No Custom Crypto Code**: Use Alloy libraries or EIP-1193 provider specification only
4. **Multi-Chain Architecture**: Build with trait-based design from the start
5. **Security**: Origin verification, initialization_script, strict CSP
6. **Capabilities**: Use Tauri 2.0 ACL system (not allowlist)
7. **Debloat**: Phase 5 removes ALL Iced code
8. **Process**: Analyze → Improve → Rebuild (NOT copy-paste)

---

## Core Principle

**❌ DO NOT copy-paste Iced code**  
**✅ DO analyze, improve, and rebuild**

**❌ DO NOT write custom crypto code**  
**✅ DO use Alloy libraries or EIP-1193 provider specification only**

This is NOT a simple migration. This is an opportunity to improve code quality, structure, and maintainability while leveraging battle-tested libraries.

---

## 🔒 No Custom Code Rule

**CRITICAL**: Never write custom implementations for crypto/blockchain operations.

### ✅ ALWAYS Use:

**For Ethereum Operations**:
- `alloy::primitives` - Address, U256, Bytes, etc.
- `alloy::signers` - Transaction signing
- `alloy::providers` - RPC communication
- `alloy::contract` - Contract interactions
- `alloy::rpc-types` - RPC types
- `alloy::network` - Network abstractions

**For Wallet Provider API**:
- EIP-1193 provider specification (Ethereum Provider JavaScript API)
- EIP-1193 JSON-RPC methods (standard)
- EIP-712 typed data signing (standard)
- BIP-39 mnemonic generation (via `bip39` crate)
- BIP-32 HD wallet derivation (via `coins-bip32` crate)

**For Security**:
- OS keychain (via `keyring` crate)
- Standard encryption (via `aes-gcm`, `argon2` crates)
- Standard hashing (via `sha2`, `sha3` crates)

### ❌ NEVER Write Custom:

- ❌ Custom signing algorithms
- ❌ Custom encryption schemes
- ❌ Custom key derivation
- ❌ Custom RPC implementations
- ❌ Custom transaction building (use Alloy)
- ❌ Custom address validation (use Alloy)
- ❌ Custom hash functions
- ❌ Custom random number generation

### Why?

1. **Security**: Crypto is hard. Use audited libraries.
2. **Standards**: Follow industry standards (EIPs, BIPs)
3. **Maintenance**: Libraries are maintained by experts
4. **Compatibility**: Standard implementations work everywhere
5. **Trust**: Users trust established patterns

### Examples

**❌ BAD (Custom Implementation)**:
```rust
// DON'T DO THIS!
fn sign_transaction(tx: &Transaction, key: &[u8]) -> Vec<u8> {
    // Custom signing logic
    let hash = custom_hash(tx);
    let sig = custom_sign(hash, key);
    sig
}
```

**✅ GOOD (Alloy Library)**:
```rust
// DO THIS!
use alloy::signers::{LocalWallet, Signer};

async fn sign_transaction(tx: &Transaction, wallet: &LocalWallet) -> Result<Signature> {
    wallet.sign_transaction(tx).await
}
```

**❌ BAD (Custom Provider)**:
```javascript
// DON'T DO THIS!
window.ethereum = {
    request: async (args) => {
        // Custom implementation
        return customRpcCall(args);
    }
};
```

**✅ GOOD (EIP-1193 Specification)**:
```javascript
// DO THIS!
// Follow EIP-1193 exactly
window.ethereum = {
    isMetaMask: true, // For compatibility
    request: async (args) => {
        // Delegate to Tauri backend (which uses Alloy)
        return window.__TAURI__.core.invoke('ethereum_request', args);
    },
    // ... rest of EIP-1193 standard
};
```

---

## Required Process (7 Steps)

For EVERY file you migrate, follow these steps:

### Step 1: READ
- Read the Iced code carefully
- Understand what it does
- Understand why it exists
- Identify dependencies

### Step 2: ANALYZE
- What problems does this code have?
- What can be improved?
- Is it modular?
- Is it maintainable?
- Can AI agents navigate it?

### Step 3: DESIGN
- How should this work in Tauri?
- What's the best structure?
- Which layer does it belong to?
- How can we separate concerns?

### Step 4: IMPLEMENT
- Write NEW, clean code
- Follow design principles
- Make it modular
- Make it maintainable
- Make it AI-agent friendly

### Step 5: TEST
- Write/adapt tests
- Verify functionality
- Check edge cases
- Ensure 100% coverage

### Step 6: DOCUMENT
- Add comprehensive doc comments
- Add usage examples
- Update README files
- Document design decisions

### Step 7: REVIEW
- Is it better than before?
- Is it maintainable?
- Can AI agents navigate it?
- Does it pass the checklist?

---

## Code Quality Checklist

Before submitting ANY code, verify ALL of these:

- [ ] I read requirements.md and design.md
- [ ] I followed the 7-step process above
- [ ] I did NOT copy-paste Iced code
- [ ] I did NOT write custom crypto code
- [ ] I used Alloy libraries for ALL Ethereum operations
- [ ] I followed EIP-1193 provider specification for dApp compatibility
- [ ] I analyzed the Iced code for problems
- [ ] I designed a better solution
- [ ] I implemented clean, new code
- [ ] Each module has ONE clear responsibility
- [ ] Concerns are properly separated (business logic ≠ UI ≠ data ≠ network)
- [ ] Business logic is separate from UI
- [ ] File is in the expected location
- [ ] File name is clear and descriptive
- [ ] File size is < 500 lines
- [ ] Functions are < 50 lines
- [ ] No unwrap() or expect() (proper error handling with Result)
- [ ] Comprehensive doc comments with examples
- [ ] README exists for this module
- [ ] All tests pass
- [ ] Code follows Rust/TypeScript best practices
- [ ] Code is maintainable
- [ ] AI agents can easily navigate this code

---

## Architecture Layers (MUST FOLLOW)

### Layer 0: Chain Adapters (NEW - Multi-Chain Foundation)
**Location**: `src-tauri/src/chains/`  
**Purpose**: Chain-specific implementations  
**Rules**:
- Each chain implements `ChainAdapter` trait
- EVM uses Alloy libraries
- Stellar uses Stellar SDK (future)
- Aptos uses Aptos SDK (future)
- Solana uses Solana SDK (future)
- Bitcoin uses Rust Bitcoin (future)
- NO custom crypto code

### Layer 1: Wallet Core (Chain-Agnostic)
**Location**: `src-tauri/src/core/`  
**Purpose**: Account management, transaction coordination  
**Rules**:
- Works with ANY chain via `ChainAdapter` trait
- No chain-specific code
- Manages multiple adapters
- Type-safe and framework-agnostic

### Layer 2: Tauri Commands
**Location**: `src-tauri/src/commands/`  
**Purpose**: Bridge between frontend and wallet core  
**Rules**:
- Thin layer, NO business logic
- Routes to correct chain adapter
- Input validation and parsing only
- Error handling and user-friendly messages
- JSON serialization for IPC

### Layer 3: Provider APIs (Chain-Specific)
**Location**: `web/providers/`  
**Purpose**: dApp compatibility for each chain  
**Rules**:
- EIP-1193 for EVM chains
- Freighter API for Stellar (future)
- Phantom API for Solana (future)
- Petra API for Aptos (future)
- NO Ethereum work (only translation)
- Event emission for dApp integration

### Layer 4: UI Layer
**Location**: `web/src/`  
**Purpose**: Presentation only  
**Rules**:
- Chain-agnostic components
- NO business logic
- Match Iced design exactly
- Responsive and accessible
- Clean component structure

---

## Separation of Concerns (MUST FOLLOW)

**Business Logic** (controllers):
- Pure Rust, no UI, no framework
- All Ethereum operations
- Type-safe with Alloy types

**Data Layer** (state):
- State management only
- No business logic

**Network Layer** (commands):
- IPC bridge only
- No business logic

**UI Layer** (React):
- Presentation only
- No business logic

**Translation Layer** (MetaMask API):
- API compatibility only
- No Ethereum logic

---

## Modularity Requirements (MUST FOLLOW)

### Each Module Must:
1. Have ONE clear responsibility
2. Be self-contained and reusable
3. Have clear boundaries with well-defined interfaces
4. Be testable in isolation
5. Have a README explaining its purpose
6. Have comprehensive doc comments
7. Be < 500 lines

### File Organization:
```
src-tauri/src/
├── chains/           # Chain adapters (Layer 0)
│   ├── mod.rs        # ChainAdapter trait
│   ├── evm/          # EVM adapter (Alloy)
│   ├── stellar/      # Stellar adapter (future)
│   ├── aptos/        # Aptos adapter (future)
│   ├── solana/       # Solana adapter (future)
│   └── bitcoin/      # Bitcoin adapter (future)
├── core/             # Wallet core (Layer 1)
│   ├── account.rs    # Account management
│   ├── wallet.rs     # Wallet coordinator
│   └── transaction.rs # Transaction types
├── commands/         # Tauri IPC bridge (Layer 2)
├── state/            # Application state
├── models/           # Data types
├── services/         # Supporting services
└── utils/            # Utilities

web/src/
├── components/       # UI components (presentation)
├── views/            # Page views (composition)
├── hooks/            # React hooks (UI logic)
├── providers/        # Chain provider APIs (Layer 3)
│   ├── ethereum.ts   # EIP-1193 for EVM
│   ├── stellar.ts    # Freighter API (future)
│   ├── solana.ts     # Phantom API (future)
│   └── aptos.ts      # Petra API (future)
├── services/         # Frontend services
└── utils/            # Frontend utilities
```

---

## AI-Agent Friendly Code (MUST FOLLOW)

### Predictable Structure
- Files are where you expect them
- Clear naming conventions
- Consistent patterns throughout

### Clear Documentation
- Comprehensive doc comments
- Usage examples in docs
- README files for each module
- Explain WHY, not just WHAT

### Small Files
- < 500 lines per file
- < 50 lines per function
- One responsibility per module

### Logical Organization
- Related code is grouped together
- Clear module boundaries
- Proper separation of concerns

---

## Examples

### ❌ BAD (Copy-Paste)
```rust
// Just copied from Iced, mixed concerns, no improvements
pub fn handle_send_transaction(app: &mut App, msg: Message) {
    let to = app.send_to.clone();
    let amount = app.send_amount.clone();
    let to_addr = to.parse().unwrap(); // Can panic!
    let tx = build_tx(to_addr, amount);
    send_tx(tx);
    app.status = "Sent!".to_string();
}
```

### ✅ GOOD (Analyzed and Improved)
```rust
/// Sends a transaction to the specified address.
///
/// This command:
/// 1. Parses and validates inputs
/// 2. Delegates to TransactionController
/// 3. Returns result to UI
///
/// # Arguments
/// * `state` - Application state
/// * `to` - Recipient address (hex string)
/// * `amount` - Amount in ETH (decimal string)
///
/// # Returns
/// * `Ok(tx_hash)` - Transaction hash if successful
/// * `Err(message)` - User-friendly error message
#[tauri::command]
pub async fn send_transaction(
    state: State<'_, Arc<Mutex<VaughanState>>>,
    to: String,
    amount: String,
) -> Result<String, String> {
    // Parse inputs (separate concern)
    let to_addr = parse_address(&to)?;
    let amount_u256 = parse_amount(&amount)?;
    
    // Delegate to controller (business logic)
    let app_state = state.lock().await;
    let tx_hash = app_state
        .transaction_controller
        .send_transaction(to_addr, amount_u256)
        .await
        .map_err(|e| e.to_user_message())?;
    
    Ok(tx_hash)
}
```

---

## Common Mistakes to Avoid

### ❌ Mistake 1: Copy-Paste
**Problem**: Just copying Iced code without improvements  
**Solution**: Follow the 7-step process

### ❌ Mistake 2: Custom Crypto Code
**Problem**: Writing custom signing, encryption, or RPC implementations  
**Solution**: Use Alloy libraries or EIP-1193 provider specification only

### ❌ Mistake 3: Mixed Concerns
**Problem**: Business logic in UI, UI logic in controllers  
**Solution**: Strict separation of concerns

### ❌ Mistake 4: Large Files
**Problem**: 1000+ line files that are hard to navigate  
**Solution**: Break into smaller, focused modules

### ❌ Mistake 5: Poor Documentation
**Problem**: No doc comments, unclear purpose  
**Solution**: Comprehensive doc comments with examples

### ❌ Mistake 6: Unpredictable Structure
**Problem**: Files in unexpected locations  
**Solution**: Follow the standard file organization

---

## When in Doubt

1. **Read the spec documents**:
   - `requirements.md` - What we're building
   - `design.md` - How we're building it
   - `tasks.md` - What to do next

2. **Ask yourself**:
   - Is this better than the Iced version?
   - Is this modular and maintainable?
   - Can AI agents navigate this?
   - Does this pass the checklist?

3. **If unsure, ask the user** before proceeding

---

## References

- Requirements: `.kiro/specs/Vaughan-Tauri/requirements.md`
- Design: `.kiro/specs/Vaughan-Tauri/design.md`
- Tasks: `.kiro/specs/Vaughan-Tauri/tasks.md`
- Code Quality Checklist: design.md Section 9.3
- AI Agent Guidelines: design.md Section 15

---

**Remember**: This is NOT a copy-paste migration. This is an opportunity to build something better, cleaner, and more maintainable. Take the time to do it right.
