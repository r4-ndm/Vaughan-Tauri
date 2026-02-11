# Tauri Migration - Implementation Tasks

**Feature Name**: tauri-migration  
**Created**: January 28, 2026  
**Status**: Ready for Implementation  
**Priority**: High

**🚨 CRITICAL**: This migration uses **Tauri 2.0** (not 1.x). See `tauri-2.0-specifics.md` for details.

---

## ⚠️ Key Requirements

1. **Tauri 2.0**: Use `npm create tauri-app@latest` (NOT `cargo tauri init`)
2. **Alloy Purity**: ZERO ethers-rs imports allowed
3. **Multi-Chain Architecture**: Build with trait-based design from the start
4. **Security**: Origin verification, strict CSP, initialization_script injection
5. **Debloat**: Phase 5 removes ALL Iced code
6. **Process**: Follow "Analyze → Improve → Rebuild" (NOT copy-paste)

**Read First**: 
- `CRITICAL-REQUIREMENTS.md` - Non-negotiable rules
- `MULTI-CHAIN-ARCHITECTURE.md` - Multi-chain design (IMPORTANT!)
- `tauri-2.0-specifics.md` - Tauri 2.0 requirements
- `requirements.md` - What we're building
- `design.md` - How we're building it

---

## Task Overview

This task list breaks down the Tauri migration into 6 phases:
0. **Phase 0**: Proof of Concept (2-3 days) - **RECOMMENDED FOR 100% CONFIDENCE**
1. **Phase 1**: Backend Setup (Week 1.5) - Tauri 2.0 + Alloy controllers
2. **Phase 2**: Wallet UI Recreation (Week 2) - React + Tailwind
3. **Phase 3**: dApp Integration (Week 3) - MetaMask bridge + dApp browser
4. **Phase 4**: Polish & Release (Week 4) - Testing + optimization
5. **Phase 5**: DEBLOAT & CLEANUP (Week 5) - Remove Iced, optimize binary

**CRITICAL**: Follow the "Analyze → Improve → Rebuild" process (NOT copy-paste)

**RECOMMENDED**: Execute Phase 0 POC first for 100% confidence (see `PHASE-0-POC.md`)

---

## Phase 0: Proof of Concept (2-3 days) - RECOMMENDED

**Purpose**: Validate critical assumptions before full implementation  
**Goal**: Achieve 100% confidence (currently 95%)  
**See**: `PHASE-0-POC.md` for detailed rationale

### 0.1 POC-1: Tauri 2.0 + Alloy Integration (4 hours)

- [x] 0.1.1 Create minimal Tauri 2.0 project
  - Run `npm create tauri-app@latest` (Tauri 2.0, React + TypeScript)
  - Verify project builds successfully
  - Document any setup issues

- [x] 0.1.2 Add Alloy dependency
  - Add to src-tauri/Cargo.toml:
    ```toml
    [dependencies]
    alloy = { version = "0.1", features = ["full"] }
    ```
  - Run `cargo build` and verify no conflicts
  - Document any dependency issues

- [x] 0.1.3 Create minimal Alloy command
  - Create command that calls Alloy provider
  - Test: Get block number from RPC
  - Verify: Frontend → Rust → Alloy → Network works
  - Document any integration issues

- [x] 0.1.4 Test from React frontend
  - Call command from React component
  - Display result in UI
  - Verify end-to-end flow works
  - Document lessons learned

**Success Criteria**:
- ✅ Tauri 2.0 builds without errors
- ✅ Alloy compiles without conflicts
- ✅ Can make RPC call through Alloy (Block: 24378930)
- ✅ Frontend can call Rust commands

**Risk Mitigated**: Tauri 2.0 + Alloy compatibility (HIGH RISK) ✅ VALIDATED

---

### 0.2 POC-2: Controller Lazy Initialization (4 hours)

- [x] 0.2.1 Create minimal VaughanState
  - Define state struct with HashMap of controllers
  - Use Arc<Mutex<HashMap<...>>>
  - Document structure

- [x] 0.2.2 Implement lazy initialization
  - Create `get_or_create_controller()` method
  - Check if controller exists, create if not
  - Cache controller in HashMap
  - Document pattern

- [x] 0.2.3 Create test command
  - Command that uses lazy initialization
  - Test switching networks multiple times
  - Verify controllers are cached (not recreated)
  - Document behavior

- [x] 0.2.4 Test for race conditions
  - Call command concurrently from multiple threads
  - Verify no deadlocks
  - Verify no duplicate controllers
  - Document any issues

**Success Criteria**:
- ✅ Controllers initialize on-demand (first call creates)
- ✅ Controllers are cached correctly (subsequent calls reuse)
- ✅ No deadlocks or race conditions (multiple calls work)
- ✅ Arc<Mutex<>> pattern works (thread-safe)

**Risk Mitigated**: Controller lifecycle strategy (MEDIUM RISK) ✅ VALIDATED

---

### 0.3 POC-3: MetaMask Provider Injection (4 hours)

- [x] 0.3.1 Create minimal provider code
  - Write window.ethereum object
  - Implement request() method
  - Use window.__TAURI_INTERNALS__.invoke
  - Document code

- [x] 0.3.2 Configure window creation
  - Create Tauri command to open dApp window
  - Test window creation and focus
  - Verify Tauri API availability
  - Document configuration

- [x] 0.3.3 Create test dApp
  - Simple HTML page that calls window.ethereum
  - Test: eth_chainId, eth_accounts, eth_requestAccounts, eth_blockNumber
  - Verify provider is available
  - Document behavior

- [x] 0.3.4 Test functionality
  - All MetaMask methods work correctly
  - Provider can't be tampered with (read-only)
  - Test with different method calls
  - Document security findings

**Success Criteria**:
- ✅ Provider injects before dApp code (window.ethereum available on load)
- ✅ dApp can call window.ethereum (all 4 methods tested successfully)
- ✅ Tauri commands receive requests (eth_request handler works)
- ✅ Provider is functional (Chain ID: 0x1, Block: 24379037)

**Risk Mitigated**: dApp integration strategy (MEDIUM RISK) ✅ VALIDATED

**Success Criteria**:
- ✅ Provider injects before dApp code
- ✅ dApp can call window.ethereum
- ✅ Tauri commands receive requests
- ✅ Provider is secure

**Risk Mitigated**: dApp integration strategy (MEDIUM RISK)

---

### 0.4 POC-4: Integration Test (2 hours)

- [ ] 0.4.1 Combine all POCs
  - Integrate POC-1, POC-2, and POC-3
  - Create unified test app
  - Document integration

- [ ] 0.4.2 Create end-to-end test
  - dApp calls window.ethereum.request()
  - Provider translates to Tauri command
  - Command uses lazy-loaded controller
  - Controller calls Alloy
  - Result returns to dApp
  - Document flow

- [ ] 0.4.3 Test complete flow
  - Switch networks from dApp
  - Get block number
  - Verify everything works together
  - Document any issues

- [ ] 0.4.4 Document lessons learned
  - What worked well
  - What needs adjustment
  - Any surprises or gotchas
  - Recommendations for Phase 1

**Success Criteria**:
- ✅ All 3 POCs work together
- ✅ No integration issues
- ✅ Performance is acceptable
- ✅ Lessons learned documented

**Risk Mitigated**: Integration complexity (LOW RISK)

---

### 0.5 Phase 0 Completion

- [ ] 0.5.1 Review POC results
  - All 4 POC tasks completed successfully
  - No blocking issues found
  - Working code examples created
  - Lessons learned documented

- [ ] 0.5.2 Update specs if needed
  - Incorporate lessons learned
  - Adjust design if necessary
  - Update tasks based on findings
  - Document changes

- [ ] 0.5.3 Create reference examples
  - Extract working code from POCs
  - Add to CONCRETE-EXAMPLES.md
  - Document best practices
  - Prepare for Phase 1

- [ ] 0.5.4 Achieve 100% confidence
  - All critical assumptions validated
  - All technical risks mitigated
  - Clear path forward
  - Ready to start Phase 1

**Deliverables**:
- ✅ Working POC app
- ✅ Code examples for Phase 1
- ✅ Lessons learned document
- ✅ 100% confidence achieved

**Decision Point**: If Phase 0 succeeds → Proceed to Phase 1 with 100% confidence

---

## Phase 1: Backend Setup (Week 1.5)

### 1.1 Project Setup & Configuration

- [x] 1.1.1 Create Tauri 2.0 project structure
  - Run `npm create tauri-app@latest` (select Tauri 2.0, React + TypeScript)
  - Verify Tauri 2.0 structure created
  - Configure for desktop (Windows, Linux, macOS) - **DESKTOP PRIORITY**
  - ~~Configure for Android~~ (DEFERRED - Desktop first)
  - Set up project directories
  - Configure src-tauri/Cargo.toml with Alloy dependencies (NO ethers)

- [x] 1.1.2 Set up Tauri 2.0 capabilities (ACL system)
  - Create `src-tauri/capabilities/default.json` (main window permissions)
  - Create `src-tauri/capabilities/dapp.json` (dApp window permissions - minimal)
  - Create `src-tauri/capabilities/wallet-commands.json` (wallet command permissions)
  - Configure strict CSP for wallet window in tauri.conf.json
  - Configure looser CSP for dApp window
  - Document permission strategy

- [x] 1.1.3 Set up development tools
  - Configure rustfmt.toml
  - Configure clippy.toml
  - Set up pre-commit hooks (DEFERRED)
  - Configure CI/CD (GitHub Actions for Tauri 2.0) (DEFERRED)
  - Set up testing framework (DEFERRED to Day 10)

- [x] 1.1.4 Create project structure (Multi-Chain)
  - Create `src-tauri/src/chains/` directory (chain adapters)
  - Create `src-tauri/src/chains/evm/` directory (EVM adapter)
  - Create `src-tauri/src/core/` directory (chain-agnostic wallet core)
  - Create `src-tauri/src/commands/` directory (Tauri commands)
  - Create `src-tauri/src/models/` directory (data types)
  - Create `src-tauri/src/error/` directory (error types)
  - Add README.md files to each directory

- [x] 1.1.5 Verify Alloy-only dependencies
  - Check src-tauri/Cargo.toml has ONLY Alloy dependencies
  - Ensure NO ethers-rs dependencies
  - Add alloy with full features
  - Document Alloy purity standard (enforced in clippy.toml)


### 1.2 Define Multi-Chain Architecture

- [x] 1.2.1 Define ChainAdapter trait
  - Create `src-tauri/src/chains/mod.rs`
  - Define `ChainAdapter` trait with async methods:
    - `get_balance(address: &str) -> Result<Balance>`
    - `send_transaction(tx: ChainTransaction) -> Result<TxHash>`
    - `sign_message(address: &str, message: &[u8]) -> Result<Signature>`
    - `get_transactions(address: &str, limit: u32) -> Result<Vec<TxRecord>>`
    - `estimate_fee(tx: &ChainTransaction) -> Result<Fee>`
    - `validate_address(address: &str) -> Result<()>`
    - `chain_info() -> ChainInfo`
    - `chain_type() -> ChainType`
  - Define chain-agnostic types (Balance, TxHash, Signature, Fee, etc.)
  - Define ChainType enum (Evm, Stellar, Aptos, Solana, Bitcoin)
  - Add comprehensive doc comments with examples

- [x] 1.2.2 Define chain-agnostic transaction types
  - Create `src-tauri/src/chains/types.rs`
  - Define `ChainTransaction` enum for all chain types
  - Define `EvmTransaction` struct (for EVM chains)
  - Define placeholder structs for future chains (Stellar, Aptos, etc.)
  - Ensure type safety and clear documentation

- [x] 1.2.3 Create WalletError enum
  - Create `src-tauri/src/error/mod.rs`
  - Define comprehensive error types (40+ variants)
  - Implement Display for user-friendly messages
  - Implement user_message() for frontend
  - Implement code() for error codes
  - Add conversions from Alloy errors
  - Add tests for error handling

### 1.3 Implement EVM Adapter (Using Alloy)

- [ ] 1.3.1 Create EVM adapter structure
  - Create `src-tauri/src/chains/evm/mod.rs`
  - Create `src-tauri/src/chains/evm/adapter.rs`
  - Define `EvmAdapter` struct with Alloy provider and signer
  - **CRITICAL**: Use ONLY alloy::primitives (Address, U256, Bytes)
  - **CRITICAL**: Verify NO ethers imports

- [ ] 1.3.2 Implement ChainAdapter for EvmAdapter
  - Implement `get_balance()` using Alloy provider
  - Implement `send_transaction()` using Alloy
  - Implement `sign_message()` using Alloy signer
  - Implement `get_transactions()` (use RPC or explorer API)
  - Implement `estimate_fee()` using Alloy gas estimation
  - Implement `validate_address()` using Alloy address parsing
  - Implement `chain_info()` and `chain_type()`
  - Add comprehensive error handling
  - Add doc comments with examples

- [ ] 1.3.3 Refactor TransactionController logic into EvmAdapter
  - Copy transaction logic from `src/controllers/transaction.rs`
  - Adapt to use Alloy (not ethers)
  - Improve error handling
  - Simplify complex logic
  - Add usage examples
  - Verify tests pass

- [ ] 1.3.4 Implement EVM network configuration
  - Create `src-tauri/src/chains/evm/networks.rs`
  - Define EVM network configs (Ethereum, PulseChain, Polygon, etc.)
  - Add RPC URLs, chain IDs, explorers
  - Make it easy to add new EVM chains

- [ ] 1.3.5 Add EVM utilities
  - Create `src-tauri/src/chains/evm/utils.rs`
  - Add helper functions for EVM-specific operations
  - Format units, parse units, etc.
  - All using Alloy types

### 1.4 Implement Chain-Agnostic Wallet Core

- [ ] 1.4.1 Create WalletState (manages all adapters)
  - Create `src-tauri/src/core/wallet.rs`
  - Define `WalletState` struct with HashMap of adapters
  - Implement adapter registration
  - Implement `get_adapter(chain: &ChainType)` method
  - Implement chain-agnostic wallet operations
  - Add comprehensive doc comments

- [ ] 1.4.2 Implement multi-chain account management
  - Create `src-tauri/src/core/account.rs`
  - Define `Account` struct with multi-chain support
  - Each account can have addresses on multiple chains
  - Implement account creation, import, export
  - Support HD wallet derivation for multiple chains

- [ ] 1.4.3 Refactor WalletController logic
  - Copy wallet logic from `src/controllers/wallet.rs`
  - Make it chain-agnostic (uses ChainAdapter trait)
  - Improve error handling
  - Add usage examples
  - Verify tests pass

- [ ] 1.4.4 Refactor NetworkController logic
  - Copy network logic from `src/controllers/network.rs`
  - Make it work with multiple chain types
  - Improve error handling
  - Add usage examples
  - Verify tests pass

- [ ] 1.4.5 Refactor PriceController logic
  - Copy price logic from `src/controllers/price.rs`
  - Make it work with multiple chains
  - Improve error handling
  - Add usage examples
  - Verify tests pass

### 1.5 Copy Supporting Modules

- [ ] 1.3.1 Copy network module
  - Copy `src/network/` → `src-tauri/src/network/`
  - Review and improve code quality
  - Add doc comments where missing
  - Verify tests pass

- [ ] 1.3.2 Copy security module
  - Copy `src/security/` → `src-tauri/src/security/`
  - Review and improve code quality
  - Add doc comments where missing
  - Verify tests pass

- [ ] 1.3.3 Copy wallet module
  - Copy `src/wallet/` → `src-tauri/src/wallet/`
  - Review and improve code quality
  - Add doc comments where missing
  - Verify tests pass

- [ ] 1.3.4 Copy tokens module
  - Copy `src/tokens/` → `src-tauri/src/tokens/`
  - Review and improve code quality
  - Add doc comments where missing
  - Verify tests pass

- [ ] 1.3.5 Copy utils module
  - Copy `src/utils/` → `src-tauri/src/utils/`
  - Review and improve code quality
  - Add doc comments where missing
  - Verify tests pass

- [ ] 1.3.6 Copy tests
  - Copy `tests/` → `tests/`
  - Update imports for Tauri structure
  - Verify all tests pass
  - Add new tests for Tauri-specific code


### 1.4 Implement State Management (ENHANCED)

- [ ] 1.4.1 Create VaughanState struct with controller lifecycle
  - Define in `src-tauri/src/state/mod.rs`
  - **CRITICAL**: Follow `controller-lifecycle.md` design
  - Provider-independent controllers (always available):
    - `wallet_controller: Arc<WalletController>`
    - `price_controller: Arc<PriceController>`
  - Provider-dependent controllers (per-network, cached):
    - `network_controllers: HashMap<NetworkId, Arc<NetworkController>>`
    - `transaction_controllers: HashMap<NetworkId, Arc<TransactionController>>`
  - Application state:
    - `active_network: NetworkId`
    - `active_account: Option<Address>`
    - `wallet_locked: bool`
  - dApp state:
    - `connected_dapps: HashMap<String, DappConnection>`
    - `pending_approvals: VecDeque<ApprovalRequest>`
  - Add comprehensive doc comments

- [ ] 1.4.2 Implement cold start initialization
  - Create `VaughanState::new()` function
  - Initialize provider-independent controllers (wallet, price)
  - Load saved state (last network, accounts)
  - Create empty controller HashMaps (lazy initialization)
  - Set up state management with Arc<Mutex<>>
  - Add error handling
  - Add tests

- [ ] 1.4.3 Implement network switching with lazy initialization
  - Create `switch_network()` method
  - Check if NetworkController exists for network
    - If NO: Create new NetworkController with Alloy provider
    - If YES: Use cached controller
  - Check if TransactionController exists for network
    - If NO: Create new TransactionController with provider
    - If YES: Use cached controller
  - Update `active_network`
  - Emit 'networkChanged' event
  - Add tests for caching behavior

- [ ] 1.4.4 Implement controller helper methods
  - Create `current_network_controller()` - returns Arc or error
  - Create `current_transaction_controller()` - returns Arc or error
  - Create `clear_controller_cache()` - for RPC URL changes
  - Add comprehensive error handling
  - Add tests

- [ ] 1.4.5 Implement provider sharing strategy
  - NetworkController owns provider via `Arc<dyn Provider>`
  - TransactionController receives shared provider
  - Document ownership model in code comments
  - Add tests for provider sharing


### 1.5 Implement Tauri Commands

- [ ] 1.5.1 Analyze Iced handlers
  - Read `src/gui/handlers/transaction.rs`
  - Read `src/gui/handlers/network.rs`
  - Read `src/gui/handlers/wallet_ops.rs`
  - Read `src/gui/handlers/security.rs`
  - Read `src/gui/handlers/token_ops.rs`
  - Identify what needs to become commands
  - Document command structure

- [ ] 1.5.2 Implement transaction commands (with origin verification)
  - Create `src-tauri/src/commands/transaction.rs`
  - **CRITICAL**: Add origin verification (check window.label() == "main")
  - Implement `validate_transaction` command
  - Implement `estimate_gas` command
  - Implement `build_transaction` command
  - Implement `sign_transaction` command
  - Implement `send_transaction` command
  - Implement `get_transaction_status` command
  - Add comprehensive doc comments
  - Add tests for each command
  - Test origin verification (dApp window should be rejected)

- [ ] 1.5.3 Implement network commands
  - Create `src-tauri/src/commands/network.rs`
  - Implement `switch_network` command
  - Implement `get_balance` command
  - Implement `get_token_balance` command
  - Implement `get_token_balances` command
  - Implement `get_network_info` command
  - Add comprehensive doc comments
  - Add tests for each command

- [ ] 1.5.4 Implement wallet commands
  - Create `src-tauri/src/commands/wallet.rs`
  - Implement `import_account` command
  - Implement `create_account` command
  - Implement `switch_account` command
  - Implement `get_accounts` command
  - Implement `export_account` command
  - Implement `sign_message` command
  - Add comprehensive doc comments
  - Add tests for each command

- [ ] 1.5.5 Implement security commands
  - Create `src-tauri/src/commands/security.rs`
  - Implement `unlock_wallet` command
  - Implement `lock_wallet` command
  - Implement `change_password` command
  - Implement `verify_password` command
  - Add comprehensive doc comments
  - Add tests for each command

- [ ] 1.5.6 Implement token commands
  - Create `src-tauri/src/commands/token.rs`
  - Implement `get_token_price` command
  - Implement `refresh_token_prices` command
  - Implement `add_custom_token` command
  - Implement `remove_custom_token` command
  - Add comprehensive doc comments
  - Add tests for each command

- [ ] 1.5.7 Implement sound alert commands
  - Create `src-tauri/src/commands/audio.rs`
  - Implement `play_sound` command
  - Implement `update_sound_config` command
  - Implement `get_sound_config` command
  - Implement `test_sound` command
  - Add comprehensive doc comments
  - Add tests for each command


### 1.6 State Persistence (NEW)

- [ ] 1.6.1 Define state storage strategy
  - **Security-critical data** (private keys): OS keychain
  - **App state** (last network, accounts): JSON file in app data directory
  - **Network configs**: TOML file
  - **User preferences**: JSON file
  - Document storage locations per platform

- [ ] 1.6.2 Implement StateManager
  - Create `src-tauri/src/state/persistence.rs`
  - Implement `StateManager::save()` method
  - Implement `StateManager::load()` method
  - Implement state validation
  - Handle corrupted state gracefully (reset to defaults)
  - Add tests

- [ ] 1.6.3 Implement state versioning
  - Add version field to saved state
  - Implement migration functions (v1 → v2, etc.)
  - Test migration from Iced version
  - Document migration strategy

- [ ] 1.6.4 Implement auto-save
  - Save state on network switch
  - Save state on account switch
  - Save state on app close
  - Debounce saves (avoid excessive I/O)
  - Add tests

### 1.7 Testing Infrastructure (NEW)

- [ ] 1.7.1 Set up property-based testing
  - Add proptest to dev-dependencies
  - Create `tests/properties/` directory
  - Define properties for transaction validation
  - Define properties for balance calculations
  - Define properties for signature verification
  - Add README explaining property tests

- [ ] 1.7.2 Set up integration testing
  - Create mock Alloy provider for tests
  - Test controller initialization
  - Test network switching
  - Test transaction flow end-to-end
  - Test state persistence
  - Add README explaining integration tests

- [ ] 1.7.3 Set up E2E testing framework
  - Install Playwright or Tauri WebDriver
  - Define critical user flows:
    - First-time setup
    - Send transaction
    - dApp interaction
    - Network switch
  - Create test fixtures
  - Document E2E test strategy (for Phase 4)

### 1.8 Integration & Testing

- [x] 1.8.1 Wire up commands in main.rs
  - Register all commands with Tauri
  - Initialize state with `VaughanState::new()`
  - Set up error handling
  - Configure logging

- [x] 1.8.2 Test all commands
  - Test transaction commands
  - Test network commands
  - Test wallet commands
  - Test security commands
  - Test token commands
  - Verify error handling

- [x] 1.8.3 Run full test suite
  - Run `cargo test --all-features`
  - Verify all 20 controller tests pass
  - Verify all command tests pass
  - Verify property tests pass
  - Verify integration tests pass
  - Fix any failing tests

- [x] 1.8.4 Code quality review
  - Run `cargo clippy`
  - Run `cargo fmt --check`
  - Review against code quality checklist (design.md Section 9.3)
  - Fix any issues

---

## Phase 2: Wallet UI Recreation (Week 2)

### 2.1 Frontend Setup

- [ ] 2.1.1 Initialize React project
  - Set up Vite + React + TypeScript
  - Configure for Tauri integration
  - Set up project structure
  - Configure ESLint + Prettier

- [ ] 2.1.2 Install dependencies
  - Install Tailwind CSS
  - Install Headless UI
  - Install TanStack Query (React Query)
  - Install React Hook Form + Zod
  - Install React Router
  - Install qrcode.react
  - Install other required libraries

- [ ] 2.1.3 Configure Tailwind CSS
  - Set up Tailwind config
  - Extract Iced color palette
  - Create custom theme matching Iced design
  - Set up design tokens
  - Configure responsive breakpoints


### 2.2 Design System & Utilities

- [ ] 2.2.1 Create design tokens
  - Extract colors from Iced
  - Define spacing scale
  - Define typography scale
  - Define shadow styles
  - Define border radius values
  - Document in `web/src/styles/tokens.css`

- [ ] 2.2.2 Create Tauri service wrapper
  - Create `web/src/services/tauri.ts`
  - Wrap all Tauri commands with TypeScript types
  - Add error handling
  - Add loading states
  - Add comprehensive JSDoc comments

- [ ] 2.2.3 Create utility functions
  - Create `web/src/utils/format.ts` (address, balance formatting)
  - Create `web/src/utils/validation.ts` (input validation)
  - Create `web/src/utils/constants.ts` (app constants)
  - Add tests for utilities


### 2.3 Core Components

- [ ] 2.3.1 Analyze Iced components
  - Review `src/gui/components/` structure
  - Review `src/gui/widgets/` structure
  - Identify reusable patterns
  - Document component requirements

- [ ] 2.3.2 Create NetworkSelector component
  - Create `web/src/components/NetworkSelector/`
  - Match Iced design exactly
  - Implement dropdown functionality
  - Add network icons
  - Connect to `switch_network` command
  - Add tests
  - Add README with usage

- [ ] 2.3.3 Create AccountSelector component
  - Create `web/src/components/AccountSelector/`
  - Match Iced design exactly
  - Implement dropdown functionality
  - Show truncated addresses
  - Connect to `switch_account` command
  - Add tests
  - Add README with usage

- [ ] 2.3.4 Create BalanceDisplay component
  - Create `web/src/components/BalanceDisplay/`
  - Match Iced design exactly
  - Large, prominent display
  - Show native token balance
  - Show USD value
  - Add loading state
  - Add tests
  - Add README with usage

- [ ] 2.3.5 Create TokenList component
  - Create `web/src/components/TokenList/`
  - Match Iced design exactly
  - Scrollable list
  - Show token icon, symbol, balance, USD value
  - Add loading states
  - Add empty state
  - Add tests
  - Add README with usage

- [ ] 2.3.6 Create ActionButtons component
  - Create `web/src/components/ActionButtons/`
  - Match Iced button styles exactly
  - Send button
  - Receive button
  - dApp Browser button (new)
  - Add tests
  - Add README with usage

- [ ] 2.3.7 Create SoundSettings component
  - Create `web/src/components/SoundSettings/`
  - Enable/disable toggle
  - Volume slider
  - Sound pack selector
  - Test sound buttons
  - Match Iced styling
  - Add tests
  - Add README with usage


### 2.4 View Components

- [ ] 2.4.1 Analyze Iced views
  - Review `src/gui/views/` structure
  - Identify view hierarchy
  - Document view requirements
  - Plan React Router structure

- [ ] 2.4.2 Create Main Wallet View
  - Create `web/src/views/WalletView/`
  - Match Iced layout exactly
  - Compose: Header, BalanceDisplay, TokenList, ActionButtons
  - Add responsive layout
  - Connect to Tauri commands
  - Add tests
  - Add README

- [ ] 2.4.3 Create Send Transaction View
  - Create `web/src/views/SendView/`
  - Match Iced design exactly
  - Recipient address input with validation
  - Amount input with balance check
  - Gas limit input with estimation
  - Gas price input with suggestions
  - Transaction preview
  - Password confirmation
  - Transaction status feedback
  - Connect to transaction commands
  - Add tests
  - Add README

- [ ] 2.4.4 Create Receive View
  - Create `web/src/views/ReceiveView/`
  - Match Iced design exactly
  - Display QR code for active address
  - Display address as text (copyable)
  - Share button
  - Add tests
  - Add README

- [ ] 2.4.5 Create Transaction History View
  - Create `web/src/views/HistoryView/`
  - Match Iced design exactly
  - List recent transactions
  - Show transaction details
  - Link to block explorer
  - Filter by status/type
  - Add tests
  - Add README

- [ ] 2.4.6 Create Settings View
  - Create `web/src/views/SettingsView/`
  - Match Iced design exactly
  - Network management
  - Account management
  - Security settings
  - Sound alert settings (integrate SoundSettings component)
  - Display settings
  - About/version info
  - Add tests
  - Add README


### 2.5 Mobile UI Specifics (NEW)

- [ ] 2.5.1 Define responsive breakpoints
  - Mobile: < 768px
  - Tablet: 768px - 1024px
  - Desktop: > 1024px
  - Document in design tokens

- [ ] 2.5.2 Create mobile navigation
  - Bottom tab bar (Home, Send, Receive, Settings)
  - Hamburger menu for secondary actions
  - Swipe gestures for navigation
  - Add tests

- [ ] 2.5.3 Optimize touch targets
  - Ensure minimum 44px × 44px for all interactive elements
  - Increase button padding on mobile
  - Add touch feedback (ripple effect)
  - Test on device

- [ ] 2.5.4 Create mobile-specific layouts
  - Stack layout for mobile (vertical)
  - Grid layout for tablet/desktop (horizontal)
  - Collapsible sections for mobile
  - Add tests

### 2.6 Integration & Testing

- [ ] 2.6.1 Set up React Router
  - Configure routes for all views
  - Add navigation
  - Add route guards (authentication)
  - Test navigation

- [ ] 2.6.2 Connect all components to Tauri
  - Wire up all Tauri command calls
  - Implement error handling
  - Implement loading states
  - Test all interactions

- [ ] 2.6.3 Test on desktop
  - Test on Windows (primary platform)
  - Test all wallet features
  - Test all views
  - Test navigation
  - Fix bugs

- [ ] 2.6.4 Test responsive design
  - Test at mobile breakpoint (< 768px)
  - Test at tablet breakpoint (768px - 1024px)
  - Test at desktop breakpoint (> 1024px)
  - Test touch targets
  - Identify issues

- [ ] 2.6.5 Code quality review
  - Run ESLint
  - Run Prettier
  - Review component structure
  - Review against best practices
  - Fix any issues

---

## Phase 3: dApp Integration (Week 3)

### 3.1 MetaMask Translation Layer (Secure Injection)

- [ ] 3.1.1 Design MetaMask provider (Tauri 2.0 secure method)
  - Review EIP-1193 specification
  - Review MetaMask provider API
  - Design provider structure
  - Document API mapping (MetaMask → Tauri)
  - **CRITICAL**: Plan initialization_script injection (NOT side-loaded JS)

- [ ] 3.1.2 Implement window.ethereum object (secure injection)
  - Create provider code (will be injected via initialization_script)
  - Implement base provider structure
  - Add `isMetaMask` and `isVaughan` flags
  - Use `window.__TAURI__.core.invoke` for IPC (Tauri 2.0 API)
  - Add comprehensive JSDoc comments

- [ ] 3.1.3 Configure initialization_script in tauri.conf.json
  - Add initialization_script to dApp window config
  - Ensure provider loads BEFORE any dApp code
  - Test injection timing
  - Verify security (provider can't be overwritten)

- [ ] 3.1.4 Implement MetaMask API methods (using Tauri 2.0 invoke)
  - Implement `eth_requestAccounts` (using window.__TAURI__.core.invoke)
  - Implement `eth_accounts`
  - Implement `eth_chainId`
  - Implement `eth_sendTransaction`
  - Implement `eth_signTransaction`
  - Implement `eth_sign`
  - Implement `personal_sign`
  - Implement `eth_signTypedData_v4`
  - Implement `wallet_switchEthereumChain`
  - Implement `wallet_addEthereumChain`
  - Add error handling for each method

- [ ] 3.1.5 Implement event emission
  - Implement `accountsChanged` event
  - Implement `chainChanged` event
  - Implement `connect` event
  - Implement `disconnect` event
  - Add event listener management

- [ ] 3.1.6 Implement request queue management (NEW)
  - Create `RequestQueue` class
  - Handle concurrent requests (queue + process sequentially)
  - Implement request timeout (30s default)
  - Implement request cancellation
  - Add tests for multiple simultaneous requests
  - Document queue behavior

- [ ] 3.1.7 Test with mock dApp
  - Create EIP-1193 compliance test suite (tests/mock-dapp.html)
  - Test all API methods
  - Test event emission
  - Test provider injection timing
  - Test concurrent requests (queue management)
  - Fix any issues


### 3.2 dApp Browser Window

- [ ] 3.2.1 Design dApp browser
  - Review Rabby's dApp browser UX
  - Design window layout
  - Design navigation bar
  - Design security indicators
  - Document design decisions

- [ ] 3.2.2 Create dApp browser window
  - Create `web/dapp-browser.html`
  - Create `web/src/views/DappBrowser/`
  - Implement window creation command
  - Configure window properties
  - Add tests

- [ ] 3.2.3 Implement navigation bar
  - Create URL input with validation
  - Create back button
  - Create forward button
  - Create refresh button
  - Add navigation history
  - Add tests

- [ ] 3.2.4 Implement security indicators
  - Show connection status
  - Show HTTPS badge
  - Show dApp permissions
  - Add warning for HTTP sites
  - Add tests

- [ ] 3.2.5 Implement sandboxed iframe
  - Create iframe with proper sandbox attributes
  - Configure Content Security Policy
  - Inject MetaMask provider into iframe
  - Handle iframe loading states
  - Add error handling
  - Add tests

- [ ] 3.2.6 Test with simple dApp
  - Load simple HTML dApp
  - Test provider injection
  - Test basic interactions
  - Fix any issues


### 3.3 Approval System

- [ ] 3.3.1 Implement approval state management
  - Add approval queue to VaughanState
  - Create ApprovalRequest type
  - Implement request_approval function
  - Implement approve_request function
  - Implement reject_request function
  - Add tests

- [ ] 3.3.2 Implement approval commands
  - Create `src-tauri/src/commands/approval.rs`
  - Implement `request_connection` command
  - Implement `approve_connection` command
  - Implement `reject_connection` command
  - Implement `request_transaction_approval` command
  - Implement `approve_transaction` command
  - Implement `reject_transaction` command
  - Implement `request_signature_approval` command
  - Implement `approve_signature` command
  - Implement `reject_signature` command
  - Add tests

- [ ] 3.3.3 Create approval dialog components
  - Create `web/src/components/ApprovalDialog/`
  - Create base approval dialog
  - Create connection approval dialog
  - Create transaction approval dialog
  - Create signature approval dialog
  - Match Iced styling
  - Add tests
  - Add README

- [ ] 3.3.4 Implement approval UI flow
  - Show approval dialog when request arrives
  - Display dApp information
  - Display request details
  - Handle approve action
  - Handle reject action
  - Show risk warnings for suspicious requests
  - Add tests

- [ ] 3.3.5 Test approval flows
  - Test connection approval
  - Test transaction approval
  - Test signature approval
  - Test rejection flows
  - Test multiple pending approvals
  - Fix any issues


### 3.4 dApp Connection Management

- [ ] 3.4.1 Implement connection storage
  - Add connected_dapps to VaughanState
  - Create DappConnection type
  - Implement connection persistence
  - Add tests

- [ ] 3.4.2 Implement connection commands
  - Implement `get_connected_dapps` command
  - Implement `disconnect_dapp` command
  - Implement `get_dapp_permissions` command
  - Add tests

- [ ] 3.4.3 Create connection management UI
  - Create `web/src/views/DappConnectionsView/`
  - List connected dApps
  - Show dApp permissions
  - Add disconnect button
  - Match Iced styling
  - Add tests

- [ ] 3.4.4 Test connection management
  - Test connecting multiple dApps
  - Test disconnecting dApps
  - Test permission display
  - Fix any issues


### 3.5 Sound Alert System (CONSOLIDATED FROM PHASE 2)

- [ ] 3.5.1 Implement sound playback infrastructure
  - Add `rodio` dependency to src-tauri/Cargo.toml
  - Create `src-tauri/src/audio/mod.rs`
  - Implement SoundPlayer struct
  - Add default sound assets to `src-tauri/sounds/default/`
  - Implement sound commands:
    - `play_sound`
    - `update_sound_config`
    - `get_sound_config`
    - `test_sound`
  - Test sound playback on desktop

- [ ] 3.5.2 Implement transaction monitoring
  - Create `src-tauri/src/monitoring/transaction_monitor.rs`
  - Implement TransactionMonitor struct
  - Add address watching functionality
  - Implement background monitoring loop (check every 15s)
  - Detect new transactions
  - Emit events to frontend
  - Add tests

- [ ] 3.5.3 Integrate sound alerts with monitoring
  - Play sound on incoming transaction
  - Play sound on transaction confirmation
  - Play sound on dApp request
  - Add per-chain configuration
  - Add per-account configuration
  - Test monitoring on all platforms

- [ ] 3.5.4 Create sound settings UI
  - Create `web/src/components/SoundSettings/`
  - Enable/disable toggle
  - Volume slider
  - Sound pack selector
  - Test sound buttons
  - Match Iced styling
  - Add tests

- [ ] 3.5.5 Add system notifications (optional)
  - Install tauri-plugin-notification
  - Show system notification on transaction
  - Show system notification on dApp request
  - Test on all platforms

### 3.6 Real dApp Testing

- [ ] 3.6.1 Test with Uniswap
  - Open Uniswap in dApp browser
  - Test connection
  - Test token swap approval
  - Test transaction signing
  - Document any issues
  - Fix compatibility issues

- [ ] 3.6.2 Test with Aave
  - Open Aave in dApp browser
  - Test connection
  - Test deposit/borrow approval
  - Test transaction signing
  - Document any issues
  - Fix compatibility issues

- [ ] 3.6.3 Test with OpenSea
  - Open OpenSea in dApp browser
  - Test connection
  - Test NFT listing approval
  - Test signature requests
  - Document any issues
  - Fix compatibility issues

- [ ] 3.6.4 Test with additional dApps
  - Test with Curve
  - Test with 1inch
  - Test with other popular dApps
  - Document compatibility
  - Fix any issues

- [ ] 3.6.5 Code quality review
  - Review dApp integration code
  - Check against EIP-1193 spec
  - Verify security measures
  - Fix any issues

---

## Phase 4: Polish & Release (Week 4)

### 4.1 ~~Mobile Optimization~~ (DEFERRED - Desktop Priority)

- [ ] 4.1.1 ~~Configure Tauri for Android~~ (DEFERRED)
- [ ] 4.1.2 ~~Optimize touch targets~~ (Already done in Phase 2.5)
- [ ] 4.1.3 ~~Implement mobile-specific UI~~ (Already done in Phase 2.5)
- [ ] 4.1.4 ~~Test on Android device~~ (DEFERRED)


### 4.2 Cross-Platform Testing

- [ ] 4.2.1 Test on Windows
  - Test all features on Windows 10
  - Test all features on Windows 11
  - Test performance
  - Fix Windows-specific issues

- [ ] 4.2.2 Test on Linux
  - Set up Linux VM or WSL
  - Test all features on Ubuntu 20.04+
  - Test performance
  - Fix Linux-specific issues

- [ ] 4.2.3 Build for macOS
  - Configure GitHub Actions for macOS build
  - Build macOS binary
  - Create macOS installer
  - Document macOS build process

- [ ] 4.2.4 Request macOS testers
  - Create testing guide
  - Post request in community
  - Collect feedback
  - Document macOS-specific issues for future fixes


### 4.3 Performance Optimization

- [ ] 4.3.1 Profile application performance
  - Measure startup time
  - Measure command execution time
  - Measure UI render time
  - Measure memory usage
  - Identify bottlenecks

- [ ] 4.3.2 Optimize startup time
  - Lazy load non-critical components
  - Optimize controller initialization
  - Cache network data
  - Parallel initialization where possible
  - Verify <3s cold start target

- [ ] 4.3.3 Optimize runtime performance
  - Optimize React re-renders
  - Implement request caching
  - Batch multiple RPC calls
  - Use multicall for token balances
  - Verify performance targets

- [ ] 4.3.4 Optimize resource usage
  - Reduce memory footprint
  - Optimize CPU usage
  - Minimize disk I/O
  - Verify resource targets


### 4.4 Security Audit

- [ ] 4.4.1 Review private key handling
  - Verify keys never leave Rust backend
  - Verify keys are encrypted at rest
  - Verify no keys in logs
  - Verify secure memory handling

- [ ] 4.4.2 Review dApp isolation
  - Verify iframe sandbox is secure
  - Verify CSP is properly configured
  - Verify no direct access to wallet state
  - Verify approval system is secure

- [ ] 4.4.3 Review input validation
  - Verify all inputs validated in Rust
  - Verify no trust in frontend validation
  - Verify type-safe parsing
  - Verify bounds checking

- [ ] 4.4.4 Review error handling
  - Verify no sensitive data in errors
  - Verify graceful degradation
  - Verify user-friendly messages
  - Verify detailed logging for debugging

- [ ] 4.4.5 Run security audit tools
  - Run cargo-audit for dependency vulnerabilities
  - Run clippy with security lints
  - Review code for common vulnerabilities
  - Fix all security issues


### 4.5 User Data Migration

- [ ] 4.5.1 Implement migration script
  - Create `migrate_user_data()` function
  - Copy keystore files
  - Copy network configurations
  - Copy account metadata
  - Copy user preferences
  - Add error handling
  - Add tests

- [ ] 4.5.2 Implement first-launch detection
  - Detect Iced installation
  - Offer to migrate data
  - Run migration script
  - Verify migration success
  - Handle migration errors

- [ ] 4.5.3 Test migration
  - Test with real Iced data
  - Test with various data states
  - Test error cases
  - Verify all data migrates correctly


### 4.6 Documentation

- [ ] 4.6.1 Write user documentation
  - Create user guide for wallet features
  - Document dApp browser usage
  - Create FAQ
  - Add screenshots and videos
  - Document mobile-specific features

- [ ] 4.6.2 Write developer documentation
  - Document architecture
  - Document API (all Tauri commands)
  - Create contributing guide
  - Document build process
  - Document testing process

- [ ] 4.6.3 Write migration guide
  - Document Iced → Tauri migration
  - Document data migration process
  - Document breaking changes
  - Provide troubleshooting guide

- [ ] 4.6.4 Create release notes
  - List new features (dApp browser)
  - List improvements
  - List bug fixes
  - List known issues
  - Document platform support


### 4.7 Release Preparation

- [ ] 4.7.1 Build release binaries
  - Build Windows installer
  - Build Linux AppImage/deb
  - Build macOS dmg (via CI/CD)
  - Build Android APK
  - Test all installers

- [ ] 4.7.2 Create release package
  - Package binaries
  - Include documentation
  - Include license
  - Create checksums
  - Sign binaries

- [ ] 4.7.3 Set up release infrastructure
  - Configure GitHub Releases
  - Set up auto-update mechanism
  - Configure crash reporting
  - Set up analytics (optional)

- [ ] 4.7.4 Final testing
  - Test fresh installation on all platforms
  - Test upgrade from Iced version
  - Test all critical flows
  - Verify all acceptance criteria met

- [ ] 4.7.5 Publish release
  - Create GitHub release
  - Publish binaries
  - Announce to community
  - Monitor for issues

---

## Phase 5: DEBLOAT & CLEANUP (Week 5 - Critical)

### 5.1 Remove Legacy Iced Code

- [ ] 5.1.1 Verify Tauri version is complete
  - All features working
  - All tests passing
  - User acceptance complete
  - Ready to remove old code

- [ ] 5.1.2 Delete Iced GUI code
  - Delete `src/gui/` directory
  - Delete `src/app.rs`
  - Delete `src/main.rs` (old Iced entry point)
  - Keep controllers/network/security/wallet (already copied to src-tauri)
  - Document what was removed

- [ ] 5.1.3 Clean up root Cargo.toml
  - Remove `iced` dependency
  - Remove `iced_native` dependency
  - Remove `wgpu` dependency
  - Remove `font-kit` dependency
  - Remove `image` dependency (if only used by Iced)
  - Remove other Iced-specific dependencies
  - Keep only library dependencies (if any)

- [ ] 5.1.4 Verify build still works
  - Run `cargo build` in root (should fail or be minimal)
  - Run `cargo tauri build` (should work)
  - Verify no broken imports
  - Fix any issues

### 5.2 Dependency Audit & Optimization

- [ ] 5.2.1 Audit dependencies
  - Run `cargo tree --duplicates` to find duplicate deps
  - Run `cargo bloat --release` to find large dependencies
  - Install and run `cargo machete` to find unused deps
  - Document findings

- [ ] 5.2.2 Remove unused dependencies
  - Remove dependencies identified by cargo machete
  - Remove duplicate dependencies
  - Update Cargo.lock
  - Test build

- [ ] 5.2.3 Verify Alloy purity (CRITICAL)
  - Search entire codebase for `use ethers`
  - Ensure ZERO ethers imports
  - Verify all Ethereum operations use Alloy
  - Document Alloy usage

### 5.3 Binary Optimization

- [ ] 5.3.1 Configure release profile
  - Add `lto = true` to [profile.release]
  - Add `codegen-units = 1` to [profile.release]
  - Add `panic = "abort"` to [profile.release]
  - Add `strip = true` to [profile.release]
  - Add `opt-level = "z"` to [profile.release]

- [ ] 5.3.2 Build and measure
  - Build release binary: `cargo tauri build --release`
  - Measure binary size (target: < 20MB)
  - Compare with old Iced binary
  - Document size reduction

- [ ] 5.3.3 Test optimized binary
  - Test all features work
  - Test performance (should be faster)
  - Test on all platforms
  - Fix any issues

### 5.4 Final Cleanup

- [ ] 5.4.1 Clean up project structure
  - Remove old build artifacts
  - Remove unused files
  - Update .gitignore
  - Clean up documentation

- [ ] 5.4.2 Update README
  - Remove Iced references
  - Add Tauri 2.0 information
  - Update build instructions
  - Update architecture documentation

- [ ] 5.4.3 Archive old code (optional)
  - Create `archive/` directory
  - Move old Iced code to archive
  - Document what was archived
  - Update git history

---

## Post-Release Tasks (Optional)

### 5.1 Community Feedback

- [ ] 5.1.1 Monitor user feedback
  - Monitor GitHub issues
  - Monitor community channels
  - Collect bug reports
  - Collect feature requests

- [ ] 5.1.2 Address critical issues
  - Fix critical bugs
  - Release hotfix if needed
  - Update documentation

### 5.2 macOS Support

- [ ] 5.2.1 Work with macOS testers
  - Collect macOS test results
  - Identify macOS-specific issues
  - Fix macOS bugs
  - Release macOS update

### 5.3 Future Enhancements

- [ ] 5.3.1 Plan v1.1 features
  - iOS support
  - WalletConnect integration
  - Hardware wallet support
  - Additional dApp features

---

## Success Criteria

### Must Have (MVP)
- [ ] All controllers initialize successfully
- [ ] All existing wallet features work
- [ ] UI matches current Iced design
- [ ] MetaMask API implemented
- [ ] dApp browser working
- [ ] Can connect to dApps
- [ ] Can approve/reject transactions from dApps
- [ ] Works on Windows
- [ ] Works on Android
- [ ] Works on Linux
- [ ] macOS builds successfully
- [ ] All tests pass
- [ ] Security requirements met
- [ ] Performance requirements met
- [ ] Documentation complete

### Should Have
- [ ] UI perfectly matches Iced version
- [ ] Better performance than Iced
- [ ] Works with major dApps (Uniswap, Aave, etc.)
- [ ] E2E tests for critical flows
- [ ] Mobile-optimized UI
- [ ] macOS tested by community

### Nice to Have
- [ ] UI/UX improvements
- [ ] Additional tests
- [ ] Performance optimizations
- [ ] Advanced dApp features
- [ ] iOS support

---

## Notes

### Code Quality Reminders
- Follow "Analyze → Improve → Rebuild" process (NOT copy-paste)
- Check code quality checklist (design.md Section 9.3)
- Verify against AI agent guidelines (design.md Section 15)
- Keep files < 500 lines
- Keep functions < 50 lines
- Add comprehensive doc comments
- Add README files for modules
- Make code AI-agent friendly

### Testing Reminders
- Test after each task
- Maintain 100% controller test coverage
- Add tests for new code
- Run full test suite regularly
- Test on multiple platforms

### Documentation Reminders
- Document as you go
- Add JSDoc/doc comments
- Update README files
- Keep documentation in sync with code

---

---

## 📋 Updated Priorities & Timeline

### Recommended Approach: Phase 0 First (100% Confidence)
- **Phase 0**: 2-3 days (POC - validates critical assumptions) - **RECOMMENDED**
- **Phase 1**: 1.5 weeks (backend setup)
- **Phase 2**: 2 weeks (wallet UI)
- **Phase 3**: 1.5 weeks (dApp integration)
- **Phase 4**: 1.5 weeks (polish & release)
- **Phase 5**: 0.5 weeks (debloat)
- **Total**: ~7.5 weeks for desktop-ready v1.0 with 100% confidence

### Alternative: Skip Phase 0 (95% Confidence)
- **Phase 1-5**: 7 weeks (as originally planned)
- **Risk**: 5% unknown (might discover issues during Phase 1)
- **Not Recommended**: See `PATH-TO-100-PERCENT.md` for rationale

### Desktop-First Strategy
- Windows (primary) → Linux → macOS (CI/CD + community)
- Android deferred to v1.1
- Mobile-responsive UI built in Phase 2 (ready for future Android)

### Key Improvements Implemented
1. ✅ **Phase 0 POC** - Validates critical assumptions (NEW - RECOMMENDED)
2. ✅ **Controller Lifecycle** - Clear initialization strategy (see `controller-lifecycle.md`)
3. ✅ **State Persistence** - Defined storage strategy (Phase 1.6)
4. ✅ **Testing Infrastructure** - Property-based, integration, E2E (Phase 1.7)
5. ✅ **Request Queue** - Handle concurrent dApp requests (Phase 3.1.6)
6. ✅ **Mobile UI Specifics** - Responsive breakpoints and components (Phase 2.5)
7. ✅ **Sound Alerts Consolidated** - All in Phase 3 (Phase 3.5)
8. ✅ **Concrete Examples** - Copy-paste ready code (see `CONCRETE-EXAMPLES.md`)
9. ✅ **Risk Register** - Comprehensive risk analysis (see `RISK-REGISTER.md`)

---

**Status**: Ready for Implementation  
**Confidence**: 95% (100% after Phase 0 POC)  
**Estimated Timeline**: 7.5 weeks (with Phase 0) or 7 weeks (without Phase 0)  
**Priority**: High  
**Recommendation**: Execute Phase 0 first for 100% confidence

**Next Step**: 
- **Recommended**: Phase 0, Task 0.1.1 (POC-1: Tauri 2.0 + Alloy)
- **Alternative**: Phase 1, Task 1.1.1 (Create Tauri project structure)

**Read First**:
- `PATH-TO-100-PERCENT.md` - Why Phase 0 is recommended
- `PHASE-0-POC.md` - Phase 0 detailed tasks
- `CONCRETE-EXAMPLES.md` - Code examples for reference
- `RISK-REGISTER.md` - Risk analysis and mitigation
- `controller-lifecycle.md` - Controller initialization strategy
- `CRITICAL-REQUIREMENTS.md` - Non-negotiable rules
- `MULTI-CHAIN-ARCHITECTURE.md` - Multi-chain design
- `tauri-2.0-specifics.md` - Tauri 2.0 requirements
