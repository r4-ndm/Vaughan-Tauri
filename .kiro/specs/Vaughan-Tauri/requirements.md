# Tauri Migration - Requirements

**Feature Name**: tauri-migration  
**Created**: January 28, 2026  
**Status**: Planning  
**Priority**: High

---

## 1. Overview

### 1.1 Purpose
Migrate Vaughan wallet from Iced GUI framework to Tauri, enabling:
- Controller initialization (blocked in Iced)
- Modern web-based UI with Rabby-style dApp browser
- MetaMask API compatibility for dApp integration
- Better developer experience
- Industry-standard architecture (MetaMask pattern)
- 100% reuse of existing Rust business logic

### 1.2 Background
The current Iced implementation has an architectural limitation that prevents controller initialization. Iced's message system requires all types to be `Clone`, but our controllers contain non-Clone Alloy providers. This blocks Phase E tasks E2 and E3.

Tauri solves this by providing direct mutable state access without message passing constraints.

### 1.3 Vision
**"Vaughan's proven wallet UI + dApp browser with Alloy's type safety and MetaMask's compatibility"**

**UI Strategy**:
- **Wallet UI**: Recreate current Iced GUI look/style in web technologies (React + CSS)
- **dApp Browser**: Add dApp integration inspired by Rabby (separate window OR side panel - to be decided in design phase)
- **Mobile Ready**: Built with Tauri for desktop + Android support

**Architecture Layers** (4 clean layers):
1. **Alloy Core**: Pure Rust/Alloy for ALL Ethereum operations (signing, transactions, RPC, crypto)
   - Type-safe, memory-safe, fast
   - All existing controllers reused 100%
   
2. **Tauri Commands**: Bridge between frontend and Alloy core
   - State management
   - Input validation
   - JSON serialization
   
3. **MetaMask Translation Layer**: Implements standard `window.ethereum` API
   - Translates MetaMask API calls → Tauri commands
   - Provides dApp compatibility
   - Event emission for dApp integration
   
4. **Rabby-Inspired dApp Browser**: iframe-based dApp integration
   - Secure dApp isolation
   - Connection management
   - Approval UI

**Connection Flow**:
```
dApp (in iframe)
  ↓ window.ethereum.request() [MetaMask API]
MetaMask Translation Layer (provider.js)
  ↓ invoke('tauri_command')
Tauri Commands (Rust bridge)
  ↓ controller.method()
Alloy Core (Rust - ALL Ethereum logic)
  ↓ RPC call
Ethereum Network
```

**Key Principle**: Alloy does ALL the Ethereum work. MetaMask is just the translation layer for dApp compatibility. Rabby inspires the dApp browser UX.

### 1.4 Goals
- ✅ Enable controller initialization (solve E2/E3 blocker)
- ✅ Reuse 100% of existing controllers and business logic
- ✅ Recreate Iced GUI look/style in web technologies
- ✅ Add dApp browser integration (MetaMask API compatible)
- ✅ Support desktop (Windows, macOS, Linux) + mobile (Android)
- ✅ Improve UI development speed with web technologies
- ✅ Maintain security and type safety
- ✅ Keep all existing functionality
- ✅ Improve performance where possible

---

## 2. User Stories

### 2.1 As a Developer

**US-1**: As a developer, I want to initialize controllers at startup so that all business logic is available immediately.

**Acceptance Criteria**:
- Controllers initialize when app starts
- Network-dependent controllers initialize on network selection
- Initialization errors are handled gracefully
- Controllers are accessible from all Tauri commands

**US-2**: As a developer, I want to reuse all existing Rust code so that I don't rewrite working business logic.

**Acceptance Criteria**:
- All 4 controllers transfer without changes
- All business logic modules transfer without changes
- All tests transfer and pass
- No duplication of logic between Iced and Tauri versions

**US-3**: As a developer, I want to use web technologies for UI so that development is faster and more flexible.

**Acceptance Criteria**:
- Can use React/Vue/Svelte for UI
- Can use standard web tooling (npm, webpack, etc.)
- Can use CSS frameworks (Tailwind, etc.)
- Hot reload works for UI development

### 2.2 As a User

**US-4**: As a user, I want all existing wallet features to work so that I don't lose functionality.

**Acceptance Criteria**:
- Can send transactions
- Can receive transactions
- Can switch networks
- Can switch accounts
- Can import/export accounts
- Can view balances (native + tokens)
- Can view transaction history
- All security features work

**US-5**: As a user, I want to interact with dApps so that I can use DeFi and Web3 applications.

**Acceptance Criteria**:
- Can browse to dApp URLs
- dApps can detect wallet (window.ethereum)
- Can connect wallet to dApps
- Can approve/reject connection requests
- Can sign transactions from dApps
- Can sign messages from dApps
- Transaction approval UI shows dApp details
- Can disconnect from dApps

**US-6**: As a user, I want the familiar Vaughan wallet interface so that I don't have to relearn the UI.

**Acceptance Criteria**:
- Wallet UI looks like current Iced version
- Same layout and design language
- Same color scheme and styling
- Same navigation patterns
- Familiar button placement and labels
- Smooth transition from Iced version

**US-7**: As a user, I want to interact with dApps so that I can use DeFi and Web3 applications.

**Acceptance Criteria**:
- Can browse to dApp URLs
- dApps can detect wallet (window.ethereum)
- Can connect wallet to dApps
- Can approve/reject connection requests
- Can sign transactions from dApps
- Can sign messages from dApps
- Transaction approval UI shows dApp details
- Can disconnect from dApps
- dApp browser is easily accessible (separate window OR integrated panel)

**US-8**: As a user, I want the wallet to work on my phone so that I can manage crypto on the go.

**Acceptance Criteria**:
- Wallet works on Android devices
- Touch-friendly UI
- Responsive layout for mobile screens
- All features work on mobile
- Performance is good on mobile devices

**US-9**: As a user, I want the wallet to be fast and responsive so that I have a good experience.

**Acceptance Criteria**:
- App starts in <3 seconds
- Network switches in <2 seconds
- Balance updates in <5 seconds
- Transactions submit in <3 seconds
- UI is responsive (no freezing)
- dApp browser loads quickly

**US-10**: As a user, I want my data to be secure so that my funds are safe.

**Acceptance Criteria**:
- Private keys never leave Rust backend
- Passwords are handled securely
- Sensitive data uses Secrecy types
- All validation happens in Rust
- No sensitive data in frontend logs
- dApps cannot access private keys
- Transaction approval required for all dApp requests

**US-11**: As a user, I want sound alerts for important events so that I'm notified of transactions and activity.

**Acceptance Criteria**:
- Sound plays when incoming transaction detected
- Sound plays when transaction confirmed
- Sound plays when dApp requests action
- Can enable/disable sound alerts
- Can adjust volume
- Can choose sound pack
- Sounds work on all platforms (desktop + mobile)
- Privacy-preserving (local monitoring by default)

---

## 3. Functional Requirements

### 3.1 Backend (Rust/Tauri)

**FR-1**: Application State Management
- Create `VaughanState` struct with all controllers
- Use `Arc<Mutex<VaughanState>>` for thread-safe access
- Initialize provider-independent controllers at startup
- Initialize provider-dependent controllers on-demand

**FR-2**: Controller Initialization
- Implement `initialize_network_controller` command
- Initialize NetworkController with RPC URL and chain ID
- Initialize TransactionController using NetworkController's provider
- Handle initialization errors gracefully

**FR-3**: Transaction Commands
- `validate_transaction` - Validate before sending
- `estimate_gas` - Estimate gas for transaction
- `build_transaction` - Build unsigned transaction
- `sign_transaction` - Sign with active account
- `send_transaction` - Send signed transaction
- `get_transaction_status` - Check transaction status

**FR-4**: Network Commands
- `switch_network` - Change active network
- `get_balance` - Get native token balance
- `get_token_balance` - Get ERC20 token balance
- `get_token_balances` - Get all token balances
- `get_network_info` - Get current network details

**FR-5**: Wallet Commands
- `import_account` - Import account from private key/mnemonic
- `create_account` - Create new account
- `switch_account` - Change active account
- `get_accounts` - List all accounts
- `export_account` - Export account (with password)
- `sign_message` - Sign arbitrary message

**FR-6**: Token Commands
- `get_token_price` - Get token price from cache/API
- `refresh_token_prices` - Force price refresh
- `add_custom_token` - Add custom ERC20 token
- `remove_custom_token` - Remove custom token

**FR-7**: Security Commands
- `unlock_wallet` - Unlock with password
- `lock_wallet` - Lock wallet
- `change_password` - Change wallet password
- `verify_password` - Verify password without unlocking

**FR-8**: Sound Alert Commands
- `play_sound` - Play a sound alert
- `update_sound_config` - Update sound configuration
- `get_sound_config` - Get current sound configuration
- `test_sound` - Test a sound alert

### 3.2 Frontend (Web)

**FR-8**: MetaMask API Provider
- Implement `window.ethereum` object
- Support standard MetaMask methods:
  - `eth_requestAccounts` - Connect wallet
  - `eth_accounts` - Get connected accounts
  - `eth_chainId` - Get current chain ID
  - `eth_sendTransaction` - Send transaction
  - `eth_signTransaction` - Sign transaction
  - `eth_sign` - Sign message
  - `personal_sign` - Sign personal message
  - `eth_signTypedData_v4` - Sign typed data
  - `wallet_switchEthereumChain` - Switch network
  - `wallet_addEthereumChain` - Add custom network
- Emit standard events:
  - `accountsChanged` - Account switched
  - `chainChanged` - Network switched
  - `connect` - Wallet connected
  - `disconnect` - Wallet disconnected
- Translate MetaMask API → Tauri commands

**FR-9**: Sound Alert System
- Play sound alerts for transaction events
- Play sound alerts for balance changes
- Play sound alerts for dApp requests
- Configurable per-chain and per-account
- Volume control and sound pack selection
- Privacy-preserving local monitoring
- Cross-platform audio playback (desktop + mobile)

**FR-10**: Wallet UI (Recreate Iced Design)
- Match current Iced GUI layout
- Same visual design language
- Main wallet view with:
  - Network selector (top)
  - Account selector
  - Balance display (large, prominent)
  - Token list with balances
  - Send/Receive buttons
  - Transaction history access
- Same color scheme and styling
- Same button styles and interactions
- Responsive for desktop and mobile

**FR-11**: dApp Browser Integration
- **Option A**: Separate window (like a browser)
  - Opens in new Tauri window
  - Independent from wallet window
  - Can have multiple dApp windows open
- **Option B**: Integrated panel (side or bottom)
  - Slides in/out from wallet view
  - Shares window with wallet
  - Toggle between wallet and dApp view
- **Decision**: To be made in design phase based on UX testing
- URL bar with navigation
- iframe for dApp content
- Loading indicator
- Error handling
- Security indicators

**FR-12**: Main Wallet View
- Display current network (with icon)
- Display active account address (truncated, copyable)
- Display native token balance (large, prominent)
- Display token list with balances and prices
- Network selector dropdown
- Account selector dropdown
- Send button (prominent)
- Receive button (prominent)
- Transaction history link
- Settings link
- dApp browser access button/link

**FR-13**: Send Transaction View
- Recipient address input (with validation)
- Amount input (with balance check)
- Gas limit input (with estimation)
- Gas price input (with suggestions)
- Transaction preview
- Password confirmation
- Transaction status feedback
- Support for dApp-initiated transactions

**FR-14**: Receive View
- Display QR code for active address
- Display address as text (copyable)
- Share button

**FR-15**: Transaction History View
- List recent transactions
- Show transaction details (hash, amount, status)
- Link to block explorer
- Filter by status/type
- Show dApp origin for dApp transactions

**FR-16**: Approval Management
- Pending approvals queue
- Approve/reject interface
- Transaction details display
- dApp information display
- Risk warnings for suspicious transactions
- Batch approval for multiple requests

**FR-17**: Settings View
- Network management (add/remove/edit)
- Account management (import/export/delete)
- Security settings (password, auto-lock)
- dApp permissions management
- Display settings (currency, language)
- Sound alert settings (enable/disable, volume, sound pack)
- About/version info

### 3.3 dApp Integration

**FR-18**: Connection Management
- `request_connection` - dApp requests connection
- `approve_connection` - User approves connection
- `reject_connection` - User rejects connection
- `disconnect_dapp` - Disconnect specific dApp
- `get_connected_dapps` - List connected dApps
- `get_dapp_permissions` - Get dApp permissions

**FR-19**: Transaction Approval
- `request_transaction_approval` - dApp requests transaction
- `approve_transaction` - User approves transaction
- `reject_transaction` - User rejects transaction
- `get_pending_approvals` - List pending approvals
- Display transaction details to user
- Show dApp origin and reputation

**FR-20**: Message Signing
- `request_message_signature` - dApp requests message signature
- `approve_signature` - User approves signature
- `reject_signature` - User rejects signature
- Support multiple signature types (personal, typed data)
- Display message content to user

**FR-21**: Network Management for dApps
- `request_network_switch` - dApp requests network switch
- `request_network_add` - dApp requests adding network
- User approval required for network changes
- Validate network parameters

### 3.4 Data Management

**FR-22**: Persistent Storage
- Store wallet data in secure location
- Store network configurations
- Store account metadata (not private keys)
- Store user preferences
- Store dApp permissions
- Store connection history
- Encrypt sensitive data

**FR-23**: State Synchronization
- Frontend state syncs with backend
- Balance updates propagate to UI
- Network changes update UI immediately
- Account changes update UI immediately
- dApp events propagate to iframe
- Approval queue updates in real-time

---

## 4. Non-Functional Requirements

### 4.1 Performance

**NFR-1**: Startup Time
- Cold start: <3 seconds
- Warm start: <1 second

**NFR-2**: Response Time
- Command execution: <100ms (local operations)
- Network operations: <5 seconds (with timeout)
- UI interactions: <50ms (perceived instant)

**NFR-3**: Resource Usage
- Memory: <200MB idle, <500MB active
- CPU: <5% idle, <30% active
- Disk: <50MB for app, <10MB for data

### 4.2 Security

**NFR-4**: Data Protection
- Private keys encrypted at rest
- Passwords hashed with Argon2
- Sensitive data uses Secrecy types
- No sensitive data in logs
- Secure IPC between frontend/backend

**NFR-5**: Input Validation
- All inputs validated in Rust backend
- No trust in frontend validation
- Type-safe parsing (Alloy types)
- Bounds checking on all numeric inputs

**NFR-6**: Error Handling
- No sensitive data in error messages
- Graceful degradation on errors
- User-friendly error messages
- Detailed logging for debugging

### 4.3 Maintainability

**NFR-7**: Code Quality
- Follow Rust best practices
- Follow web framework best practices
- Comprehensive documentation
- Clear separation of concerns
- DRY principle (no duplication)

**NFR-8**: Testing
- 100% controller test coverage
- Integration tests for all commands
- E2E tests for critical flows
- Property-based tests where applicable

**NFR-9**: Documentation
- API documentation for all commands
- User guide for wallet features
- Developer guide for contributing
- Architecture documentation

### 4.4 Compatibility

**NFR-10**: Platform Support
- Windows 10/11 (desktop) - Primary development platform ✅
- macOS 11+ (desktop) - Requires external testing/help ⚠️
- Linux (Ubuntu 20.04+) (desktop) - Can test via VM/WSL ✅
- Android 8.0+ (mobile) - Primary mobile platform ✅

**NFR-11**: Browser Compatibility (for dApp iframe)
- Modern browsers (Chrome, Firefox, Safari, Edge)
- WebView compatibility for mobile
- No IE11 support required

**NFR-12**: Mobile Optimization
- Touch-friendly UI (44px minimum touch targets)
- Responsive layout (adapts to screen size)
- Mobile-optimized navigation
- Efficient battery usage
- Works on 4G/5G networks

**Note**: macOS builds and testing will require community help or external testers since primary development is on Windows.

---

## 5. Technical Requirements

### 5.1 Backend Stack

**TR-1**: Core Technologies
- Rust 1.75+
- Tauri 1.5+
- Tokio for async runtime
- Alloy for Ethereum operations

**TR-2**: Dependencies
- `tauri` - Application framework
- `alloy` - Ethereum library
- `tokio` - Async runtime
- `serde` - Serialization
- `tracing` - Logging
- `secrecy` - Sensitive data protection
- All existing Vaughan dependencies

**TR-3**: Architecture
- Command pattern for frontend-backend communication
- State management with `Arc<Mutex<T>>`
- Async/await throughout
- Error handling with `Result<T, E>`

### 5.2 Frontend Stack

**TR-4**: Framework Choice
- **Recommended**: React + TypeScript + Vite
- **Rationale**: 
  - Largest ecosystem for Web3 integrations
  - Best documentation and resources
  - Easy to find developers
  - Excellent TypeScript support
  - Fast development with Vite

**TR-5**: UI Libraries
- **Styling**: Tailwind CSS (utility-first, fast development)
  - Custom theme matching Iced design
  - Same color palette
  - Same spacing and sizing
- **Components**: Headless UI (accessible, unstyled components)
- **State Management**: TanStack Query (React Query) for server state
- **Forms**: React Hook Form + Zod validation
- **Icons**: Match current Iced icons (or similar style)
- **QR Codes**: qrcode.react
- **Routing**: React Router (for wallet views)
- **Mobile**: React Native Web patterns for touch optimization

**TR-6**: dApp Integration Libraries
- **Web3 Provider**: Custom `window.ethereum` implementation
- **Iframe Communication**: postMessage API
- **URL Handling**: URL API for dApp navigation
- **Security**: Content Security Policy for iframe sandbox

**TR-7**: Build Tools
- Vite for bundling (fast HMR, optimized builds)
- TypeScript for type safety
- ESLint for linting
- Prettier for formatting
- PostCSS for Tailwind processing
- Tauri Mobile plugin for Android builds

### 5.3 Development Tools

**TR-7**: Development Environment
- Rust toolchain (rustc, cargo)
- Node.js 18+ and npm/pnpm
- Tauri CLI
- Git for version control

**TR-8**: Testing Tools
- `cargo test` for Rust tests
- Vitest for frontend tests
- Playwright for E2E tests

---

## 6. Migration Strategy

### 6.1 Architecture Layers

**4 Clean Layers** (following your vision):

1. **Alloy Core** (`src-tauri/src/controllers/` + `src-tauri/src/`)
   - **Purpose**: ALL Ethereum operations (signing, transactions, RPC, crypto)
   - **Technology**: Pure Rust + Alloy libraries
   - **Characteristics**: Type-safe, memory-safe, fast, framework-agnostic
   - **Content**: All existing controllers and business logic (100% reuse)
   - **No dependencies on**: UI, Tauri, or any framework
   - **Examples**:
     - Transaction signing with Alloy signers
     - RPC calls with Alloy providers
     - Address/U256/ChainId types from Alloy
     - All crypto operations

2. **Tauri Commands** (`src-tauri/src/commands/`)
   - **Purpose**: Bridge between frontend and Alloy core
   - **Technology**: Tauri command handlers
   - **Characteristics**: Thin layer, no business logic
   - **Responsibilities**:
     - State management with `Arc<Mutex<VaughanState>>`
     - Input validation and parsing
     - Error handling and user-friendly messages
     - JSON serialization for IPC
   - **Examples**:
     - `send_transaction` command calls `TransactionController`
     - `get_balance` command calls `NetworkController`

3. **MetaMask Translation Layer** (`web/provider.js`)
   - **Purpose**: Translate MetaMask API → Tauri commands for dApp compatibility
   - **Technology**: JavaScript (injected into dApp iframe)
   - **Characteristics**: Standard compliance (EIP-1193)
   - **Responsibilities**:
     - Implements `window.ethereum` object
     - Translates method names (e.g., `eth_sendTransaction` → `send_transaction`)
     - Event emission (`accountsChanged`, `chainChanged`, etc.)
     - Connection and permission management
   - **Examples**:
     - `window.ethereum.request({method: 'eth_sendTransaction'})` → `invoke('send_transaction')`
     - Emits events when account/network changes

4. **Rabby-Inspired dApp Browser** (`web/components/DappBrowser/`)
   - **Purpose**: Secure dApp integration with iframe isolation
   - **Technology**: React component with iframe
   - **Characteristics**: Inspired by Rabby's UX patterns
   - **Responsibilities**:
     - iframe sandbox for dApp isolation
     - URL navigation and history
     - Connection approval UI
     - Transaction approval UI
     - Security indicators
   - **Examples**:
     - Load Uniswap in iframe
     - Show approval dialog when dApp requests connection
     - Display transaction details for user approval

**Connection Flow** (detailed):
```
1. User opens dApp in browser
   ↓
2. dApp calls window.ethereum.request({method: 'eth_sendTransaction', params: [...]})
   ↓
3. MetaMask Translation Layer intercepts call
   ↓
4. Translates to: invoke('send_transaction', {to, amount, gasLimit})
   ↓
5. Tauri Command receives call
   ↓
6. Parses strings to Alloy types (Address, U256)
   ↓
7. Calls TransactionController.validate_transaction()
   ↓
8. Alloy Core validates and signs transaction
   ↓
9. Alloy Provider sends to Ethereum network
   ↓
10. Result flows back through layers to dApp
```

**Key Principle**: 
- **Alloy = Brain** (does ALL the thinking/Ethereum work)
- **MetaMask = Translator** (speaks dApp language)
- **Rabby = Inspiration** (UX patterns for dApp browser)
- **Tauri = Body** (holds everything together)

### 6.2 Code Reuse

**What Transfers 100% (No Changes)**:
- ✅ `src/controllers/` - All 4 controllers
- ✅ `src/network/` - Network types and logic
- ✅ `src/security/` - Security types and logic
- ✅ `src/wallet/` - Wallet types and logic
- ✅ `src/tokens/` - Token types and logic
- ✅ `src/utils/` - Utility functions
- ✅ `tests/` - All existing tests

**What Needs Conversion (Handlers → Commands)**:
- 🔄 `src/gui/handlers/transaction.rs` → Tauri commands
- 🔄 `src/gui/handlers/network.rs` → Tauri commands
- 🔄 `src/gui/handlers/wallet_ops.rs` → Tauri commands
- 🔄 `src/gui/handlers/security.rs` → Tauri commands
- 🔄 `src/gui/handlers/token_ops.rs` → Tauri commands

**What Needs Creating (New)**:
- ✨ MetaMask API provider (`window.ethereum`)
- ✨ dApp connection management
- ✨ Transaction approval UI
- ✨ dApp browser with iframe
- ✨ Rabby-style layout

**What Needs Rewriting (UI Layer)**:
- ❌ `src/gui/views/` → React components
- ❌ `src/gui/components/` → React components
- ❌ `src/gui/widgets/` → React components

### 6.3 Phased Approach

**Phase 1: Backend Setup (Week 1)**
- Create Tauri project structure (desktop + mobile config)
- Copy controllers and business logic
- Implement state management (`VaughanState`)
- Create Tauri commands for all operations
- Test all commands (no UI yet)

**Phase 2: Wallet UI Recreation (Week 2)**
- Set up React + TypeScript + Vite
- Recreate Iced GUI design in React/CSS
  - Match layout exactly
  - Match colors and styling
  - Match interactions and animations
- Implement wallet views (send, receive, history)
- Connect to Tauri commands
- Test on desktop
- Test basic mobile responsiveness

**Phase 3: dApp Integration (Week 3)**
- Implement MetaMask API provider
- Create dApp browser (decide: separate window vs panel)
- Implement connection management
- Create approval UI (matching Iced style)
- Test with real dApps (Uniswap, etc.)
- Test on desktop and mobile

**Phase 4: Polish & Release (Week 4)**
- UI/UX refinement (match Iced perfectly)
- Mobile optimization (touch targets, gestures)
- Performance optimization
- Security audit
- Android build and testing
- Linux testing (via VM/WSL)
- macOS build (via CI/CD)
- Documentation
- Release preparation
- Community call for macOS testers

---

## 7. Success Criteria

### 7.1 Functional Success

✅ **All Features Working**
- All user stories implemented
- All functional requirements met
- Feature parity with Iced version
- dApp integration working
- MetaMask API compatibility verified
- No regressions

✅ **Controllers Initialized**
- E2/E3 blocker resolved
- Controllers available at startup
- Network-dependent controllers work
- All controller tests passing

✅ **dApp Integration**
- Can connect to dApps
- Can approve/reject transactions
- Can sign messages
- Works with major dApps (Uniswap, Aave, etc.)
- MetaMask API fully compatible

### 7.2 Technical Success

✅ **Code Quality**
- All tests passing (100% coverage)
- No compiler warnings
- No clippy warnings
- Clean architecture

✅ **Performance**
- Meets all performance requirements
- Faster than Iced version
- Responsive UI
- Efficient resource usage

### 7.3 User Success

✅ **User Experience**
- Intuitive UI (Rabby-style)
- Fast and responsive
- Clear error messages
- Good documentation
- Seamless dApp interaction

✅ **Security**
- All security requirements met
- No vulnerabilities
- Secure by default
- Audit passed
- dApp isolation working
- No private key exposure

---

## 8. Risks and Mitigations

### 8.1 Technical Risks

**Risk 1**: Tauri learning curve
- **Impact**: Medium
- **Probability**: Medium
- **Mitigation**: Use existing Tauri documentation, start with simple commands

**Risk 2**: Frontend framework choice
- **Impact**: Medium
- **Probability**: Low
- **Mitigation**: Choose based on team experience, all options are viable

**Risk 3**: State management complexity
- **Impact**: Medium
- **Probability**: Low
- **Mitigation**: Use proven patterns (Arc<Mutex<T>>), test thoroughly

### 8.2 Project Risks

**Risk 4**: macOS testing limitation
- **Impact**: Medium
- **Probability**: High
- **Mitigation**: 
  - Build for macOS using CI/CD (GitHub Actions has macOS runners)
  - Request community testers for macOS
  - Document macOS-specific issues for future fixes
  - Focus on Windows/Linux/Android first

**Risk 5**: dApp compatibility issues
- **Impact**: High
- **Probability**: Medium
- **Mitigation**: Test with major dApps early, follow MetaMask API spec strictly

**Risk 6**: Scope creep
- **Impact**: High
- **Probability**: Medium
- **Mitigation**: Strict feature parity goal, dApp integration is core feature not extra

**Risk 7**: Timeline overrun
- **Impact**: Medium
- **Probability**: Medium
- **Mitigation**: Phased approach, MVP first (Windows/Android), then Linux, then macOS with help

**Risk 8**: Testing gaps
- **Impact**: High
- **Probability**: Low
- **Mitigation**: Maintain 100% test coverage, add E2E tests, test with real dApps

---

## 9. Dependencies

### 9.1 Internal Dependencies
- ✅ Phase D complete (controllers implemented)
- ✅ Phase E partial (E1, E4, E5 complete)
- ✅ Phase F Lite complete (controller tests)
- ✅ Bug fixes complete (transaction flow, token balances)

### 9.2 External Dependencies
- Tauri 1.5+ released and stable
- Alloy library stable
- Web framework of choice stable
- No breaking changes in dependencies

---

## 10. Out of Scope

### 10.1 Not Included in Migration

❌ **UI Redesign**
- No major UI changes (keep Iced look)
- No new design language
- No rebranding

❌ **New Features Beyond dApp Integration**
- No new networks (beyond existing)
- No new token support (beyond existing)
- No hardware wallet support (yet)
- No advanced dApp features (WalletConnect, etc.)

❌ **Major Refactoring**
- No controller redesign
- No business logic changes
- No security model changes
- No data model changes

❌ **Platform Expansion Beyond Android**
- No iOS (yet - requires separate Tauri config)
- No browser extension (yet)
- No web-only version (yet)

### 10.2 Future Enhancements

These can be added after migration:
- iOS support (Tauri supports it)
- WalletConnect support
- Hardware wallet integration (Ledger, Trezor)
- Browser extension
- Advanced dApp features (multi-chain, etc.)
- DeFi integrations (staking, swaps, etc.)
- UI improvements and customization

---

## 11. Acceptance Criteria Summary

### 11.1 Must Have (MVP)

- [ ] All controllers initialize successfully
- [ ] All existing wallet features work
- [ ] UI matches current Iced design (look and feel)
- [ ] MetaMask API implemented (`window.ethereum`)
- [ ] dApp browser working (separate window OR panel)
- [ ] Can connect to dApps
- [ ] Can approve/reject transactions from dApps
- [ ] Works on Windows (primary platform)
- [ ] Works on Android (primary mobile)
- [ ] Works on Linux (testable via VM/WSL)
- [ ] macOS builds successfully (via CI/CD)
- [ ] All tests pass
- [ ] Security requirements met
- [ ] Performance requirements met
- [ ] Documentation complete

### 11.2 Should Have

- [ ] UI perfectly matches Iced version (pixel-perfect)
- [ ] Better performance than Iced
- [ ] Improved developer experience
- [ ] Works with major dApps (Uniswap, Aave, etc.)
- [ ] E2E tests for critical flows
- [ ] dApp permission management
- [ ] Mobile-optimized UI (touch-friendly)
- [ ] macOS tested by community

### 11.3 Nice to Have

- [ ] UI/UX improvements (while keeping Iced style)
- [ ] Additional tests
- [ ] Performance optimizations
- [ ] Advanced dApp features
- [ ] Bookmark management
- [ ] dApp discovery/recommendations
- [ ] iOS support
- [ ] macOS fully tested and verified

---

## 12. References

### 12.1 Internal Documents
- `TAURI_CONTROLLER_INITIALIZATION_SOLUTION.md` - Technical solution
- `PROJECT_STATUS_SUMMARY.md` - Current state
- `docs/development/PHASE_D_COMPLETE.md` - Controller implementation
- `docs/development/E0.5_FAILURE_ANALYSIS.md` - Iced limitation analysis

### 12.2 External Resources
- [Tauri Documentation](https://tauri.app/v1/guides/)
- [Alloy Documentation](https://alloy-rs.github.io/alloy/) - **Core Ethereum library**
- [MetaMask Architecture](https://github.com/MetaMask/metamask-extension)
- [MetaMask Provider API](https://docs.metamask.io/wallet/reference/provider-api/) - **Translation layer reference**
- [Rabby Wallet](https://rabby.io/) - **dApp browser UX inspiration**
- [EIP-1193: Ethereum Provider API](https://eips.ethereum.org/EIPS/eip-1193) - **Standard we implement**
- [Rust Async Book](https://rust-lang.github.io/async-book/)

---

## 13. Glossary

- **Alloy**: Rust Ethereum library - does ALL the Ethereum work (signing, RPC, crypto)
- **MetaMask API**: Standard Ethereum provider interface (`window.ethereum`) - translation layer only
- **Rabby**: Popular wallet - inspiration for dApp browser UX patterns
- **Controller**: Business logic component (MetaMask pattern)
- **Command**: Tauri function callable from frontend
- **State**: Application state managed by Tauri
- **Provider**: Alloy Ethereum RPC provider
- **Signer**: Alloy component for signing transactions
- **IPC**: Inter-Process Communication (frontend ↔ backend)
- **dApp**: Decentralized Application (Web3 app)
- **EIP-1193**: Ethereum Improvement Proposal defining provider API
- **Iframe**: HTML element for embedding dApps securely
- **Approval**: User confirmation for dApp-initiated actions
- **Iced**: Current GUI framework (being replaced, but design preserved)
- **Tauri Mobile**: Tauri plugin for Android/iOS support

**Architecture Summary**:
- **Alloy** = Does the work (Ethereum operations)
- **MetaMask** = Speaks the language (dApp compatibility)
- **Rabby** = Inspires the UX (dApp browser patterns)
- **Tauri** = Holds it together (cross-platform shell)

---

**Status**: Requirements complete - Alloy core + MetaMask translation + Rabby-inspired dApp browser  
**Next Step**: Create design document with:
- UI mockups matching Iced design
- dApp browser integration options (separate window vs panel)
- Mobile layout adaptations
- Detailed architecture diagrams
- Implementation plan  
**Estimated Effort**: 4 weeks (1 week per phase)  
**Priority**: High (blocks Phase E completion + enables dApp ecosystem + mobile support)
