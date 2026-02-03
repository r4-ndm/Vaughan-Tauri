# Tauri Migration - Design Document

**Feature Name**: tauri-migration  
**Created**: January 28, 2026  
**Status**: Design Phase  
**Priority**: High

---

## 1. Executive Summary

### 1.1 Overview
Migrate Vaughan wallet from Iced to Tauri while:
- Preserving the current Iced GUI design (look and feel)
- Adding dApp browser integration (MetaMask API compatible)
- Supporting desktop (Windows, Linux, macOS) + mobile (Android)
- Reusing 100% of existing Rust business logic

### 1.2 Architecture Philosophy
**"Alloy does the work, MetaMask speaks the language, Rabby inspires the UX"**

- **Alloy Core**: ALL Ethereum operations (signing, RPC, crypto)
- **MetaMask Translation**: dApp compatibility layer only
- **Rabby-Inspired**: dApp browser UX patterns
- **Tauri Shell**: Cross-platform wrapper

### 1.3 Key Design Decisions
1. **UI Design**: Recreate Iced GUI exactly (same colors, layout, interactions)
2. **dApp Browser**: Separate window (decided - see section 3.2)
3. **Mobile Strategy**: Responsive design with touch optimization
4. **State Management**: `Arc<Mutex<VaughanState>>` pattern
5. **Testing Strategy**: Maintain 100% controller test coverage
6. **Code Quality**: Refactor and improve code structure during migration (see section 9.3)

### 1.4 Code Quality Philosophy
**"Migration is an opportunity for improvement"**

While migrating, we will:
- ✨ **Refactor** messy code into clean, elegant solutions
- 🎨 **Improve** structure and organization
- 📚 **Document** complex logic clearly
- 🧹 **Remove** technical debt
- 💎 **Apply** good taste and best practices
- 🧩 **Modularize** code with clear boundaries
- 🎯 **Separate** concerns properly

**Core Principles**:
1. **Modularity**: Each module has one clear responsibility
2. **Separation of Concerns**: Business logic ≠ UI ≠ Data ≠ Network
3. **Single Responsibility**: One function, one purpose
4. **Loose Coupling**: Modules depend on interfaces, not implementations
5. **High Cohesion**: Related functionality stays together
6. **Easy Maintenance**: Code is easy to understand, modify, and extend
7. **AI-Agent Friendly**: Clear structure for AI agents to navigate and assist

**Principle**: Don't just copy code - make it better, cleaner, more modular, and easier to maintain.

---

## 2. System Architecture

### 2.1 High-Level Architecture

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


### 2.2 Layer Details

#### Layer 1: Alloy Core (Rust)
**Location**: `src-tauri/src/controllers/`, `src-tauri/src/`

**Purpose**: ALL Ethereum operations

**Components**:
- `TransactionController` - Transaction validation, building, signing
- `NetworkController` - RPC provider management, network switching
- `WalletController` - Account management, keyring, signing
- `PriceController` - Token price caching and fetching

**Key Characteristics**:
- Pure Rust + Alloy libraries
- Type-safe (Address, U256, ChainId)
- Framework-agnostic (no Tauri/UI dependencies)
- 100% reused from current Iced version
- All 20 controller tests transfer unchanged

**Example**:
```rust
// TransactionController validates and builds transactions
pub fn validate_transaction(
    &self,
    to: Address,           // Alloy type
    amount: U256,          // Alloy type
    gas_limit: u64,
    balance: U256,
) -> Result<(), TransactionError> {
    // MetaMask-style validation
    if to == Address::ZERO {
        return Err(TransactionError::ZeroAddress);
    }
    // ... more validation
}
```


#### Layer 2: Tauri Commands (Rust Bridge)
**Location**: `src-tauri/src/commands/`

**Purpose**: Bridge between frontend and Alloy core

**State Management**:
```rust
pub struct VaughanState {
    // Provider-independent (always available)
    pub wallet_controller: Arc<WalletController>,
    pub price_controller: Arc<PriceController>,
    
    // Provider-dependent (initialized on network selection)
    pub transaction_controller: Option<Arc<TransactionController<AlloyCoreProvider>>>,
    pub network_controller: Option<Arc<NetworkController<AlloyCoreProvider>>>,
    
    // Application state
    pub current_network: NetworkId,
    pub current_account: Option<Address>,
    pub connected_dapps: HashMap<String, DappConnection>,
    pub pending_approvals: Vec<ApprovalRequest>,
}
```

**Command Example**:
```rust
#[tauri::command]
async fn send_transaction(
    state: State<'_, Arc<Mutex<VaughanState>>>,
    to: String,        // From UI (string)
    amount: String,    // From UI (string)
    gas_limit: u64,
) -> Result<String, String> {
    let app_state = state.lock().await;
    
    // Get controller
    let tx_controller = app_state.transaction_controller
        .as_ref()
        .ok_or("Network not initialized")?;
    
    // Parse UI strings → Alloy types
    let to_addr = Address::from_str(&to)
        .map_err(|e| format!("Invalid address: {}", e))?;
    let amount_u256 = parse_amount(&amount, 18)?;
    
    // Call Alloy core
    let balance = app_state.get_current_balance()?;
    tx_controller.validate_transaction(to_addr, amount_u256, gas_limit, balance)?;
    
    // ... sign and send
    Ok(tx_hash)
}
```


#### Layer 3: MetaMask Translation Layer (JavaScript)
**Location**: `web/provider.js`

**Purpose**: Translate MetaMask API → Tauri commands (dApp compatibility ONLY)

**Implementation**:
```javascript
// Injected into dApp iframe
window.ethereum = {
    isMetaMask: true,
    isVaughan: true,
    
    // Main API method
    request: async ({ method, params }) => {
        // Translate MetaMask method → Tauri command
        switch (method) {
            case 'eth_requestAccounts':
                return await invoke('request_connection');
            
            case 'eth_sendTransaction':
                const [tx] = params;
                return await invoke('send_transaction', {
                    to: tx.to,
                    amount: tx.value,
                    gasLimit: tx.gas || 21000,
                });
            
            case 'eth_accounts':
                return await invoke('get_connected_accounts');
            
            case 'eth_chainId':
                return await invoke('get_chain_id');
            
            // ... more methods
        }
    },
    
    // Event emission
    on: (event, callback) => {
        // Listen for Tauri events
        listen(`ethereum_${event}`, callback);
    },
};
```

**Key Point**: This layer does NO Ethereum work. It only translates API calls.


#### Layer 4: UI Layer (React)
**Location**: `web/src/`

**Components**:
1. **Wallet Window** - Main wallet interface (recreates Iced design)
2. **dApp Browser Window** - Separate window with iframe

**Wallet Window Structure**:
```
WalletApp/
├── Header/
│   ├── NetworkSelector
│   └── AccountSelector
├── BalanceDisplay/
│   ├── NativeBalance (large, prominent)
│   └── TokenList
├── ActionButtons/
│   ├── SendButton
│   ├── ReceiveButton
│   └── DappBrowserButton (NEW)
├── TransactionHistory/
└── Settings/
```

**dApp Browser Window Structure**:
```
DappBrowser/
├── NavigationBar/
│   ├── URLInput
│   ├── BackButton
│   ├── ForwardButton
│   └── RefreshButton
├── SecurityIndicator/
│   ├── ConnectionStatus
│   └── HTTPSBadge
├── DappIframe/
│   └── (sandboxed iframe)
└── ApprovalOverlay/
    └── (shows when dApp requests approval)
```

---

## 3. Design Decisions

### 3.1 UI Design: Recreate Iced Look

**Decision**: Match current Iced GUI exactly

**Rationale**:
- Users are familiar with current design
- No learning curve for existing users
- Proven UX patterns
- Focus on functionality, not redesign

**Implementation**:
- Extract color palette from Iced code
- Measure spacing and sizing from screenshots
- Recreate button styles and interactions
- Match animations and transitions

**Color Palette** (to be extracted):
```css
:root {
  --primary: #...;
  --secondary: #...;
  --background: #...;
  --text: #...;
  /* ... extract from Iced */
}
```


### 3.2 dApp Browser: Separate Window

**Decision**: dApp browser opens in separate Tauri window (not integrated panel)

**Rationale**:
1. **Simpler Implementation**: No complex layout management
2. **Better UX**: Users can position wallet and dApp side-by-side
3. **Multi-dApp Support**: Can open multiple dApp windows
4. **Desktop-First**: Matches desktop app expectations
5. **Mobile Adaptation**: On mobile, can switch between windows

**Pros**:
- ✅ Easier to implement
- ✅ More flexible for users
- ✅ Better for multi-monitor setups
- ✅ Clearer separation of concerns
- ✅ Can have multiple dApps open

**Cons**:
- ⚠️ Not as "integrated" as Rabby
- ⚠️ Requires window management
- ⚠️ Mobile needs different approach

**Mobile Adaptation**:
- On mobile: dApp browser is full-screen
- Wallet accessible via overlay/drawer
- Can switch between wallet and dApp views

**Implementation**:
```rust
// Open dApp browser window
#[tauri::command]
async fn open_dapp_browser(
    app: tauri::AppHandle,
    url: String,
) -> Result<(), String> {
    tauri::WindowBuilder::new(
        &app,
        "dapp-browser",
        tauri::WindowUrl::App("dapp-browser.html".into())
    )
    .title("Vaughan dApp Browser")
    .inner_size(1200.0, 800.0)
    .build()?;
    
    // Navigate to URL
    // ...
    
    Ok(())
}
```


### 3.3 State Management

**Decision**: `Arc<Mutex<VaughanState>>` with Tauri's managed state

**Rationale**:
- Thread-safe access from multiple commands
- Async-friendly (tokio::sync::Mutex)
- Simple and proven pattern
- No external state management library needed

**State Structure**:
```rust
pub struct VaughanState {
    // Controllers
    wallet_controller: Arc<WalletController>,
    price_controller: Arc<PriceController>,
    transaction_controller: Option<Arc<TransactionController<AlloyCoreProvider>>>,
    network_controller: Option<Arc<NetworkController<AlloyCoreProvider>>>,
    
    // Application state
    current_network: NetworkId,
    current_account: Option<Address>,
    wallet_locked: bool,
    
    // dApp state
    connected_dapps: HashMap<String, DappConnection>,
    pending_approvals: VecDeque<ApprovalRequest>,
    
    // UI state (minimal)
    balance_cache: HashMap<Address, U256>,
    token_prices: HashMap<String, f64>,
}
```

**Access Pattern**:
```rust
#[tauri::command]
async fn some_command(
    state: State<'_, Arc<Mutex<VaughanState>>>,
) -> Result<(), String> {
    let mut app_state = state.lock().await;
    // Modify state
    Ok(())
}
```


### 3.4 Mobile Strategy

**Decision**: Responsive design with touch optimization

**Desktop Layout**:
```
┌─────────────────────────┐
│  Network  │  Account    │
├─────────────────────────┤
│                         │
│   Balance: 1.5 ETH      │
│                         │
├─────────────────────────┤
│  Token List             │
│  - USDC: 100.00         │
│  - USDT: 50.00          │
├─────────────────────────┤
│  [Send]  [Receive]      │
│  [dApp Browser]         │
└─────────────────────────┘
```

**Mobile Layout** (Android):
```
┌─────────────────┐
│ ☰  Network  👤  │
├─────────────────┤
│                 │
│  Balance        │
│  1.5 ETH        │
│                 │
├─────────────────┤
│ Token List      │
│ (scrollable)    │
│                 │
├─────────────────┤
│ [Send][Receive] │
│ [dApp Browser]  │
└─────────────────┘
```

**Touch Optimization**:
- Minimum 44px touch targets
- Larger buttons on mobile
- Swipe gestures for navigation
- Pull-to-refresh for balances
- Bottom navigation for key actions

**Responsive Breakpoints**:
```css
/* Mobile */
@media (max-width: 768px) {
  /* Stack layout, larger touch targets */
}

/* Tablet */
@media (min-width: 769px) and (max-width: 1024px) {
  /* Hybrid layout */
}

/* Desktop */
@media (min-width: 1025px) {
  /* Full layout */
}
```


---

## 4. Component Design

### 4.1 Wallet Window Components

#### NetworkSelector
**Purpose**: Switch between networks

**Props**:
```typescript
interface NetworkSelectorProps {
  currentNetwork: Network;
  networks: Network[];
  onNetworkChange: (network: Network) => void;
}
```

**Behavior**:
- Dropdown with network list
- Shows network icon and name
- Calls `switch_network` command
- Updates UI when network changes

#### BalanceDisplay
**Purpose**: Show native token balance prominently

**Props**:
```typescript
interface BalanceDisplayProps {
  balance: string;
  symbol: string;
  usdValue?: number;
}
```

**Design**:
- Large, prominent display (matching Iced)
- Shows balance in native token
- Optional USD value below
- Loading state while fetching

#### TokenList
**Purpose**: Display ERC20 token balances

**Props**:
```typescript
interface TokenListProps {
  tokens: Token[];
  onTokenClick?: (token: Token) => void;
}

interface Token {
  address: string;
  symbol: string;
  balance: string;
  usdValue?: number;
  icon?: string;
}
```

**Design**:
- Scrollable list
- Each token shows: icon, symbol, balance, USD value
- Click to see details
- Loading state for each token


### 4.2 dApp Browser Components

#### DappBrowser
**Purpose**: Main dApp browser window

**Structure**:
```typescript
interface DappBrowserProps {
  initialUrl?: string;
}

function DappBrowser({ initialUrl }: DappBrowserProps) {
  const [url, setUrl] = useState(initialUrl || '');
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  
  return (
    <div className="dapp-browser">
      <NavigationBar 
        url={url}
        onNavigate={handleNavigate}
        onBack={handleBack}
        onForward={handleForward}
      />
      <SecurityIndicator 
        connected={connected}
        https={url.startsWith('https')}
      />
      <DappIframe 
        url={url}
        onLoad={() => setLoading(false)}
      />
      {loading && <LoadingOverlay />}
    </div>
  );
}
```

#### DappIframe
**Purpose**: Sandboxed iframe for dApp

**Security**:
```html
<iframe
  src={url}
  sandbox="allow-scripts allow-same-origin allow-forms"
  allow="clipboard-read; clipboard-write"
  referrerpolicy="no-referrer"
/>
```

**Provider Injection**:
```javascript
// Inject window.ethereum into iframe
iframe.contentWindow.ethereum = createEthereumProvider();
```


### 4.3 Approval Components

#### ApprovalDialog
**Purpose**: Show approval request from dApp

**Props**:
```typescript
interface ApprovalDialogProps {
  request: ApprovalRequest;
  onApprove: () => void;
  onReject: () => void;
}

interface ApprovalRequest {
  type: 'connection' | 'transaction' | 'signature';
  dappUrl: string;
  dappName?: string;
  details: any;
}
```

**Design**:
- Modal overlay
- Shows dApp information
- Shows request details
- Clear approve/reject buttons
- Risk warnings for suspicious requests

**Example - Transaction Approval**:
```
┌─────────────────────────────────┐
│  Transaction Request            │
├─────────────────────────────────┤
│  From: app.uniswap.org          │
│                                 │
│  To: 0x1234...5678              │
│  Amount: 0.1 ETH                │
│  Gas: 21000                     │
│                                 │
│  [Reject]  [Approve]            │
└─────────────────────────────────┘
```

---

## 5. Data Flow

### 5.1 Transaction Flow

**User-Initiated Transaction** (from wallet):
```
1. User enters transaction details in Send form
   ↓
2. React calls: invoke('validate_transaction', {...})
   ↓
3. Tauri command parses strings → Alloy types
   ↓
4. TransactionController validates
   ↓
5. User confirms with password
   ↓
6. React calls: invoke('send_transaction', {...})
   ↓
7. WalletController signs with Alloy signer
   ↓
8. NetworkController sends via Alloy provider
   ↓
9. Transaction hash returned to UI
   ↓
10. UI shows success + link to explorer
```


**dApp-Initiated Transaction**:
```
1. dApp calls: window.ethereum.request({method: 'eth_sendTransaction', params: [...]})
   ↓
2. MetaMask translation layer intercepts
   ↓
3. Translates to: invoke('request_transaction_approval', {...})
   ↓
4. Tauri command creates ApprovalRequest
   ↓
5. Approval dialog shows in wallet window
   ↓
6. User reviews and approves
   ↓
7. Tauri command parses → Alloy types
   ↓
8. TransactionController validates
   ↓
9. WalletController signs
   ↓
10. NetworkController sends
   ↓
11. Transaction hash returned to dApp
   ↓
12. dApp receives result via window.ethereum
```

### 5.2 Network Switch Flow

**User-Initiated**:
```
1. User selects network from dropdown
   ↓
2. React calls: invoke('switch_network', {networkId, rpcUrl})
   ↓
3. Tauri command re-initializes controllers
   ↓
4. NetworkController created with new provider
   ↓
5. TransactionController updated with new provider
   ↓
6. Emit 'chainChanged' event
   ↓
7. UI updates (balance, tokens, etc.)
   ↓
8. dApps receive chainChanged event
```

**dApp-Initiated**:
```
1. dApp calls: window.ethereum.request({method: 'wallet_switchEthereumChain', params: [...]})
   ↓
2. MetaMask translation layer intercepts
   ↓
3. Shows approval dialog to user
   ↓
4. User approves
   ↓
5. Same as user-initiated flow above
```


### 5.3 dApp Connection Flow

```
1. User opens dApp in browser window
   ↓
2. dApp calls: window.ethereum.request({method: 'eth_requestAccounts'})
   ↓
3. MetaMask translation layer intercepts
   ↓
4. Calls: invoke('request_connection', {dappUrl, dappName})
   ↓
5. Connection approval dialog shows in wallet window
   ↓
6. User reviews dApp info and approves
   ↓
7. Tauri command stores connection in state
   ↓
8. Returns connected accounts to dApp
   ↓
9. dApp receives accounts array
   ↓
10. dApp is now connected and can make requests
```

---

## 6. Security Design

### 6.1 dApp Isolation

**Iframe Sandbox**:
```html
<iframe
  sandbox="allow-scripts allow-same-origin allow-forms"
  allow="clipboard-read; clipboard-write"
  referrerpolicy="no-referrer"
/>
```

**Content Security Policy**:
```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval';
connect-src *;
img-src * data: blob:;
```

**Key Principles**:
- dApps run in isolated iframe
- No direct access to wallet state
- All requests go through MetaMask API
- User approval required for sensitive operations


### 6.2 Private Key Protection

**Storage**:
- Private keys encrypted at rest
- Stored in secure location (OS keychain)
- Never exposed to frontend
- Never logged

**Access**:
- Only Alloy core can access private keys
- Tauri commands never see private keys
- Frontend never sees private keys
- dApps never see private keys

**Signing Flow**:
```
Frontend → Tauri Command → WalletController → Alloy Signer
                                                    ↓
                                            (private key used)
                                                    ↓
                                                Signature
                                                    ↓
Frontend ← Tauri Command ← WalletController ← (signature only)
```

### 6.3 Approval System

**Approval Types**:
1. **Connection**: dApp requests access to accounts
2. **Transaction**: dApp requests transaction
3. **Signature**: dApp requests message signature
4. **Network Switch**: dApp requests network change
5. **Network Add**: dApp requests adding custom network

**Approval Flow**:
```rust
pub struct ApprovalRequest {
    id: Uuid,
    dapp_url: String,
    dapp_name: Option<String>,
    request_type: ApprovalType,
    details: serde_json::Value,
    timestamp: SystemTime,
}

impl VaughanState {
    pub fn request_approval(&mut self, request: ApprovalRequest) {
        self.pending_approvals.push_back(request);
        // Emit event to show approval dialog
    }
    
    pub fn approve_request(&mut self, id: Uuid) -> Result<ApprovalRequest> {
        // Find and remove from queue
        // Execute approved action
    }
    
    pub fn reject_request(&mut self, id: Uuid) {
        // Find and remove from queue
        // Notify dApp of rejection
    }
}
```


---

## 7. Implementation Plan

### 7.1 Phase 1: Backend Setup (Week 1)

**Day 1-2: Project Setup**
- [ ] Create Tauri project with `cargo tauri init`
- [ ] Configure for desktop + Android
- [ ] Set up project structure
- [ ] Configure build tools
- [ ] Set up linting and formatting (rustfmt, clippy)

**Day 3-4: Copy & Refactor Controllers**
- [ ] Copy `src/controllers/` → `src-tauri/src/controllers/`
- [ ] **Refactor**: Improve error handling
- [ ] **Refactor**: Add documentation
- [ ] **Refactor**: Simplify complex logic
- [ ] Copy supporting modules (network, security, wallet, tokens, utils)
- [ ] **Review**: Apply code quality improvements
- [ ] Verify all tests pass

**Day 5-7: Tauri Commands (Clean Implementation)**
- [ ] Create `VaughanState` struct (well-documented)
- [ ] Implement initialization command (elegant error handling)
- [ ] Implement transaction commands (clear, focused)
- [ ] Implement network commands (simple, testable)
- [ ] Implement wallet commands (secure, clean)
- [ ] Implement token commands (efficient, clear)
- [ ] **Review**: Ensure all commands follow best practices
- [ ] Test all commands (no UI yet)

**Code Quality Focus**:
- Every function has clear purpose
- Error handling is consistent
- Names are descriptive
- Logic is well-structured
- Documentation is clear

**Deliverable**: Working Tauri backend with clean, elegant code


### 7.2 Phase 2: Wallet UI Recreation (Week 2)

**Day 1-2: Setup & Design System**
- [ ] Set up React + TypeScript + Vite
- [ ] Install Tailwind CSS
- [ ] Extract Iced color palette
- [ ] Create design tokens (clean, organized)
- [ ] Set up component library structure
- [ ] Configure ESLint + Prettier (consistent style)

**Day 3-4: Core Components (Clean, Reusable)**
- [ ] NetworkSelector component (elegant, accessible)
- [ ] AccountSelector component (clear UX)
- [ ] BalanceDisplay component (beautiful, readable)
- [ ] TokenList component (performant, clean)
- [ ] ActionButtons component (consistent style)
- [ ] **Review**: Ensure components are well-structured

**Day 5-6: Views (Well-Organized)**
- [ ] Main wallet view (clean layout)
- [ ] Send transaction view (clear flow)
- [ ] Receive view (simple, effective)
- [ ] Transaction history view (readable, useful)
- [ ] Settings view (organized, intuitive)
- [ ] **Review**: Ensure views follow best practices

**Day 7: Integration & Testing**
- [ ] Connect all components to Tauri commands
- [ ] Test on desktop (Windows)
- [ ] Test basic flows
- [ ] **Refactor**: Improve any messy code
- [ ] Fix bugs

**Code Quality Focus**:
- Components are small and focused
- Props are well-typed
- Logic is separated from presentation
- Code is DRY (Don't Repeat Yourself)
- Accessibility is built-in

**Deliverable**: Working wallet UI with clean, maintainable code


### 7.3 Phase 3: dApp Integration (Week 3)

**Day 1-2: MetaMask Translation Layer**
- [ ] Implement `window.ethereum` object
- [ ] Implement all MetaMask API methods
- [ ] Implement event emission
- [ ] Test with mock dApp

**Day 3-4: dApp Browser**
- [ ] Create dApp browser window
- [ ] Implement navigation bar
- [ ] Implement iframe with sandbox
- [ ] Inject MetaMask provider into iframe
- [ ] Test with simple dApp

**Day 5-6: Approval System**
- [ ] Create approval dialog components
- [ ] Implement connection approval
- [ ] Implement transaction approval
- [ ] Implement signature approval
- [ ] Test approval flows

**Day 7: Real dApp Testing**
- [ ] Test with Uniswap
- [ ] Test with Aave
- [ ] Test with OpenSea
- [ ] Fix compatibility issues

**Deliverable**: Working dApp integration with major dApps


### 7.4 Phase 4: Polish & Release (Week 4)

**Day 1-2: Mobile Optimization**
- [ ] Test on Android device
- [ ] Optimize touch targets
- [ ] Implement mobile-specific UI
- [ ] Test gestures and interactions
- [ ] Fix mobile-specific bugs

**Day 3-4: Cross-Platform Testing**
- [ ] Test on Windows (primary)
- [ ] Test on Linux (VM/WSL)
- [ ] Build for macOS (CI/CD)
- [ ] Request community macOS testers
- [ ] Fix platform-specific issues

**Day 5: Performance & Security**
- [ ] Performance profiling
- [ ] Optimize slow operations
- [ ] Security audit
- [ ] Fix security issues
- [ ] Load testing

**Day 6-7: Documentation & Release**
- [ ] User documentation
- [ ] Developer documentation
- [ ] Migration guide (Iced → Tauri)
- [ ] Release notes
- [ ] Build release binaries
- [ ] Publish release

**Deliverable**: Production-ready Tauri wallet with dApp support

---

## 8. Testing Strategy

### 8.1 Unit Tests

**Rust (Backend)**:
- All 20 controller tests transfer unchanged
- Add tests for new Tauri commands
- Test state management
- Test approval system

**TypeScript (Frontend)**:
- Component tests with Vitest
- Test user interactions
- Test Tauri command calls
- Test error handling


### 8.2 Integration Tests

**Wallet Flows**:
- [ ] Send transaction end-to-end
- [ ] Receive transaction
- [ ] Switch networks
- [ ] Switch accounts
- [ ] Import/export accounts

**dApp Flows**:
- [ ] Connect dApp
- [ ] Approve transaction from dApp
- [ ] Sign message from dApp
- [ ] Switch network from dApp
- [ ] Disconnect dApp

### 8.3 E2E Tests

**Tools**: Playwright or Tauri's WebDriver

**Critical Paths**:
1. **First-time setup**: Create wallet → Set password → Import account
2. **Send transaction**: Open wallet → Enter details → Confirm → Success
3. **dApp interaction**: Open dApp → Connect → Approve transaction → Success
4. **Network switch**: Switch network → Balances update → dApp notified

### 8.4 Manual Testing

**Desktop**:
- [ ] Windows 10/11
- [ ] Linux (Ubuntu 20.04+)
- [ ] macOS (community testers)

**Mobile**:
- [ ] Android 8.0+
- [ ] Various screen sizes
- [ ] Touch interactions

**dApps**:
- [ ] Uniswap
- [ ] Aave
- [ ] OpenSea
- [ ] Curve
- [ ] 1inch

---

## 9. Migration from Iced

### 9.1 Migration Philosophy

**⚠️ CRITICAL: This is NOT a copy-paste migration!**

**Approach**: **Analyze → Improve → Rebuild**

```
❌ WRONG APPROACH:
1. Copy Iced code
2. Paste into Tauri
3. Fix compilation errors
4. Ship it

✅ CORRECT APPROACH:
1. Analyze Iced code (understand what it does)
2. Identify problems and improvement opportunities
3. Design better solution
4. Implement clean, modular code
5. Test thoroughly
6. Document well
```

**Migration Process for Each Module**:

```
Step 1: ANALYZE
- What does this code do?
- Why does it do it this way?
- What are the problems?
- What can be improved?
- Is the structure good?
- Is it modular?
- Is it maintainable?

Step 2: DESIGN
- How should this work in Tauri?
- What's the best structure?
- How can we make it cleaner?
- How can we make it more modular?
- What patterns should we use?

Step 3: IMPLEMENT
- Write clean, new code
- Follow best practices
- Use proper separation of concerns
- Make it modular
- Make it maintainable
- Make it AI-agent friendly

Step 4: VERIFY
- Does it work correctly?
- Is it better than before?
- Is it well-tested?
- Is it well-documented?
- Can AI agents navigate it?
```

**Example Migration**:

```rust
// ❌ ICED CODE (Don't just copy this!)
// File: src/gui/handlers/transaction.rs (500 lines, mixed concerns)
pub fn handle_send_transaction(app: &mut App, msg: Message) {
    match msg {
        Message::SendClicked => {
            let to = app.send_to.clone(); // String
            let amount = app.send_amount.clone(); // String
            
            // Inline parsing (should be separate)
            let to_addr = to.parse().unwrap(); // Can panic!
            let amount_val = amount.parse::<f64>().unwrap() * 1e18;
            
            // Inline validation (should be in controller)
            if to_addr == "0x0" { return; }
            
            // Inline business logic (should be in controller)
            let tx = build_tx(to_addr, amount_val);
            send_tx(tx);
            
            // UI update (mixed with logic)
            app.status = "Sent!".to_string();
        }
    }
}

// ✅ TAURI CODE (Analyzed and improved!)
// File: src-tauri/src/commands/transaction.rs (50 lines, clear purpose)

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

// File: src-tauri/src/controllers/transaction.rs (business logic)
impl TransactionController {
    /// Sends a transaction (business logic only).
    pub async fn send_transaction(
        &self,
        to: Address,
        amount: U256,
    ) -> Result<TxHash, TransactionError> {
        // Validate (proper error handling)
        self.validate_transaction(to, amount)?;
        
        // Build, sign, send (clean separation)
        let tx = self.build_transaction(to, amount)?;
        let signed = self.wallet.sign_transaction(tx).await?;
        let tx_hash = self.network.send_transaction(signed).await?;
        
        Ok(tx_hash)
    }
}
```

**What Changed?**:
1. ✅ **Separated concerns**: Command ≠ Controller ≠ UI
2. ✅ **Proper error handling**: No unwrap(), proper Result types
3. ✅ **Type safety**: Alloy types instead of strings
4. ✅ **Modularity**: Small, focused functions
5. ✅ **Documentation**: Clear doc comments
6. ✅ **Testability**: Each layer can be tested independently
7. ✅ **Maintainability**: Easy to understand and modify
8. ✅ **AI-friendly**: Clear structure and naming

### 9.2 Code Migration Strategy

**What Transfers 100%**:
```
src/controllers/          → src-tauri/src/controllers/
src/network/              → src-tauri/src/network/
src/security/             → src-tauri/src/security/
src/wallet/               → src-tauri/src/wallet/
src/tokens/               → src-tauri/src/tokens/
src/utils/                → src-tauri/src/utils/
tests/                    → tests/
```

**What Needs Conversion**:
```
src/gui/handlers/         → src-tauri/src/commands/
```

**What Needs Rewriting**:
```
src/gui/views/            → web/src/views/
src/gui/components/       → web/src/components/
src/gui/widgets/          → web/src/components/
```


### 9.2 User Data Migration

**Wallet Data**:
- Keystore files remain compatible
- Network configurations transfer
- Account metadata transfers
- Transaction history transfers

**Migration Script**:
```rust
// Copy data from Iced location to Tauri location
pub fn migrate_user_data() -> Result<()> {
    let iced_data_dir = get_iced_data_dir()?;
    let tauri_data_dir = get_tauri_data_dir()?;
    
    // Copy keystore
    copy_dir(
        iced_data_dir.join("keystore"),
        tauri_data_dir.join("keystore")
    )?;
    
    // Copy config
    copy_file(
        iced_data_dir.join("config.json"),
        tauri_data_dir.join("config.json")
    )?;
    
    Ok(())
}
```

**First Launch**:
- Detect Iced installation
- Offer to migrate data
- Run migration script
- Verify migration success

### 9.3 Code Quality Improvements

**Philosophy**: Migration is an opportunity to improve code quality

**Core Architecture Principles**:

1. **Modularity**
   - Each module has ONE clear responsibility
   - Modules are self-contained and reusable
   - Clear module boundaries with well-defined interfaces
   - Easy to test in isolation

2. **Separation of Concerns**
   - **Business Logic** (controllers): Pure Rust, no UI, no framework
   - **Data Layer** (state): State management only, no logic
   - **Network Layer** (commands): IPC bridge only, no business logic
   - **UI Layer** (React): Presentation only, no business logic
   - **Translation Layer** (MetaMask API): API compatibility only

3. **Maintainability**
   - Code is easy to understand at a glance
   - Changes are localized (modify one module, not many)
   - Clear naming conventions throughout
   - Consistent patterns and idioms
   - Well-documented with examples

4. **AI-Agent Friendly**
   - **Predictable Structure**: Files are where you expect them
   - **Clear Naming**: `transaction_controller.rs` does transaction control
   - **Consistent Patterns**: Same patterns used throughout
   - **Good Documentation**: Doc comments explain intent and usage
   - **Small Files**: < 500 lines per file (easy to understand)
   - **Logical Organization**: Related code is grouped together
   - **README Files**: Each module has a README explaining its purpose

**AI-Agent Navigation Aids**:

```
src-tauri/
├── README.md                 # "This is the Rust backend"
├── controllers/
│   ├── README.md             # "Business logic layer - Alloy core"
│   ├── transaction.rs        # "Handles transaction operations"
│   ├── network.rs            # "Handles network management"
│   ├── wallet.rs             # "Handles account management"
│   └── price.rs              # "Handles price fetching"
├── commands/
│   ├── README.md             # "Tauri IPC bridge - thin layer"
│   ├── transaction.rs        # "Transaction commands for frontend"
│   └── ...
├── state/
│   ├── README.md             # "Application state management"
│   └── mod.rs                # "VaughanState definition"
└── ...

web/src/
├── README.md                 # "This is the React frontend"
├── components/
│   ├── README.md             # "Reusable UI components"
│   ├── NetworkSelector/
│   │   ├── index.tsx         # "Network selection dropdown"
│   │   └── README.md         # "Usage and props"
│   └── ...
└── ...
```

**Code Style for AI Agents**:

```rust
// ✅ GOOD: Clear, self-documenting, AI-friendly

/// Validates a transaction before sending.
///
/// This function checks:
/// - Recipient address is not zero
/// - Amount is not zero
/// - Gas limit is within bounds (21k - 30M)
/// - Sender has sufficient balance
///
/// # Arguments
/// * `to` - Recipient address (Alloy type)
/// * `amount` - Amount to send in wei (Alloy U256)
/// * `gas_limit` - Gas limit for transaction
/// * `balance` - Sender's current balance
///
/// # Returns
/// * `Ok(())` if validation passes
/// * `Err(TransactionError)` if validation fails
///
/// # Example
/// ```rust
/// let result = controller.validate_transaction(
///     Address::from_str("0x...")?,
///     U256::from(1000000000000000000u64), // 1 ETH
///     21000,
///     U256::from(2000000000000000000u64), // 2 ETH balance
/// );
/// assert!(result.is_ok());
/// ```
pub fn validate_transaction(
    &self,
    to: Address,
    amount: U256,
    gas_limit: u64,
    balance: U256,
) -> Result<(), TransactionError> {
    // Check 1: Zero address
    if to == Address::ZERO {
        return Err(TransactionError::ZeroAddress);
    }
    
    // Check 2: Zero amount
    if amount.is_zero() {
        return Err(TransactionError::ZeroAmount);
    }
    
    // Check 3: Gas limit bounds
    if gas_limit < MIN_GAS_LIMIT || gas_limit > MAX_GAS_LIMIT {
        return Err(TransactionError::InvalidGasLimit);
    }
    
    // Check 4: Sufficient balance
    if balance < amount {
        return Err(TransactionError::InsufficientBalance);
    }
    
    Ok(())
}
```

**Why This Helps AI Agents**:
1. **Clear Intent**: Doc comment explains what, why, and how
2. **Type Information**: Alloy types are explicit
3. **Error Cases**: All error paths documented
4. **Example Usage**: Shows how to call the function
5. **Step-by-Step Logic**: Comments explain each check
6. **Consistent Naming**: `validate_transaction` does what it says

**File Organization for AI Agents**:

```
✅ GOOD: Predictable, logical structure

src-tauri/src/
├── controllers/
│   └── transaction.rs        # All transaction business logic
├── commands/
│   └── transaction.rs        # All transaction IPC commands
├── models/
│   └── transaction.rs        # All transaction data types
└── services/
    └── transaction.rs        # All transaction supporting services

AI Agent thinks: "I need transaction logic? Check controllers/transaction.rs"
AI Agent thinks: "I need transaction commands? Check commands/transaction.rs"

❌ BAD: Scattered, unpredictable

src-tauri/src/
├── tx.rs                     # Some transaction stuff
├── handlers.rs               # More transaction stuff mixed with other things
├── utils.rs                  # Even more transaction stuff
└── main.rs                   # Transaction logic here too?

AI Agent thinks: "Where is transaction logic? I have to search everywhere!"
```

**Module Structure**:

```
src-tauri/
├── controllers/          # Business logic (Alloy core)
│   ├── transaction.rs    # Transaction operations
│   ├── network.rs        # Network management
│   ├── wallet.rs         # Account management
│   └── price.rs          # Price fetching
├── commands/             # Tauri IPC bridge
│   ├── transaction.rs    # Transaction commands
│   ├── network.rs        # Network commands
│   ├── wallet.rs         # Wallet commands
│   └── token.rs          # Token commands
├── state/                # Application state
│   ├── mod.rs            # VaughanState definition
│   └── manager.rs        # State management helpers
├── models/               # Data types
│   ├── transaction.rs    # Transaction types
│   ├── network.rs        # Network types
│   └── account.rs        # Account types
├── services/             # Supporting services
│   ├── storage.rs        # Persistent storage
│   ├── keystore.rs       # Key management
│   └── rpc.rs            # RPC client
└── utils/                # Utilities
    ├── crypto.rs         # Crypto helpers
    └── validation.rs     # Validation helpers

web/src/
├── components/           # UI components (presentation)
│   ├── NetworkSelector/
│   ├── BalanceDisplay/
│   └── TokenList/
├── views/                # Page views (composition)
│   ├── WalletView/
│   ├── SendView/
│   └── SettingsView/
├── hooks/                # React hooks (UI logic)
│   ├── useWallet.ts
│   ├── useNetwork.ts
│   └── useBalance.ts
├── services/             # Frontend services
│   ├── tauri.ts          # Tauri command wrappers
│   └── ethereum.ts       # MetaMask provider
└── utils/                # Frontend utilities
    ├── format.ts         # Formatting helpers
    └── validation.ts     # Input validation
```

**Separation of Concerns Examples**:

```rust
// ❌ BAD: Mixed concerns
pub fn send_transaction(state: &mut State, to: String, amount: String) {
    // Parsing (should be in command layer)
    let to_addr = Address::from_str(&to).unwrap();
    
    // Validation (should be in controller)
    if to_addr == Address::ZERO { return; }
    
    // UI logic (should be in frontend)
    println!("Sending transaction...");
    
    // Business logic (correct layer)
    let tx = build_transaction(to_addr, amount);
    
    // Network logic (should be in controller)
    send_to_network(tx);
}

// ✅ GOOD: Clear separation
// Command layer (IPC bridge only)
#[tauri::command]
pub async fn send_transaction(
    state: State<'_, Arc<Mutex<VaughanState>>>,
    to: String,
    amount: String,
) -> Result<String, String> {
    // Parse inputs
    let to_addr = parse_address(&to)?;
    let amount_u256 = parse_amount(&amount)?;
    
    // Delegate to controller (business logic)
    let app_state = state.lock().await;
    let tx_hash = app_state
        .transaction_controller
        .send_transaction(to_addr, amount_u256)
        .await?;
    
    Ok(tx_hash)
}

// Controller layer (business logic only)
impl TransactionController {
    pub async fn send_transaction(
        &self,
        to: Address,
        amount: U256,
    ) -> Result<TxHash, TransactionError> {
        // Validate (business logic)
        self.validate_transaction(to, amount)?;
        
        // Build (business logic)
        let tx = self.build_transaction(to, amount)?;
        
        // Sign (business logic)
        let signed = self.wallet.sign_transaction(tx).await?;
        
        // Send (business logic)
        let tx_hash = self.network.send_transaction(signed).await?;
        
        Ok(tx_hash)
    }
}
```

**Modularity Examples**:

```rust
// ❌ BAD: God object with everything
pub struct Wallet {
    accounts: Vec<Account>,
    network: Network,
    transactions: Vec<Transaction>,
    prices: HashMap<String, f64>,
    ui_state: UIState,
    // ... 50 more fields
    
    pub fn do_everything(&mut self) { /* 1000 lines */ }
}

// ✅ GOOD: Focused modules
// Each module has ONE responsibility

// Module 1: Account management
pub struct WalletController {
    keyring: Keyring,
    active_account: Option<Address>,
}

impl WalletController {
    pub fn import_account(&mut self, key: PrivateKey) -> Result<Address>;
    pub fn switch_account(&mut self, address: Address) -> Result<()>;
    pub fn get_accounts(&self) -> Vec<Address>;
}

// Module 2: Network management
pub struct NetworkController {
    provider: Arc<Provider>,
    chain_id: ChainId,
}

impl NetworkController {
    pub async fn switch_network(&mut self, rpc_url: String) -> Result<()>;
    pub async fn get_balance(&self, address: Address) -> Result<U256>;
}

// Module 3: Transaction management
pub struct TransactionController {
    network: Arc<NetworkController>,
    wallet: Arc<WalletController>,
}

impl TransactionController {
    pub fn validate_transaction(&self, tx: &Transaction) -> Result<()>;
    pub async fn send_transaction(&self, tx: Transaction) -> Result<TxHash>;
}

// Each module is:
// - Self-contained
// - Testable in isolation
// - Has clear responsibility
// - Loosely coupled
```

**Refactoring Opportunities**:

1. **Handler → Command Conversion**
   - **Before** (Iced handler): String-based, inline logic, hard to test
   - **After** (Tauri command): Type-safe, thin bridge, well-tested
   - **Improvement**: Cleaner separation, better error handling

2. **State Management**
   - **Before**: Scattered state across GUI components
   - **After**: Centralized `VaughanState` with clear ownership
   - **Improvement**: Single source of truth, easier to reason about

3. **Error Handling**
   - **Before**: Mix of Result, Option, unwrap, expect
   - **After**: Consistent error types, proper propagation
   - **Improvement**: Better error messages, no panics

4. **Code Organization**
   - **Before**: Large files, mixed concerns
   - **After**: Small, focused modules with clear responsibilities
   - **Improvement**: Easier to navigate and maintain

5. **Documentation**
   - **Before**: Minimal comments, unclear intent
   - **After**: Clear doc comments, examples, rationale
   - **Improvement**: Self-documenting code

**Code Review Checklist**:
- [ ] Is this code elegant and easy to understand?
- [ ] Does each module have ONE clear responsibility?
- [ ] Are concerns properly separated?
- [ ] Is business logic separate from UI?
- [ ] Is data separate from logic?
- [ ] Are modules loosely coupled?
- [ ] Can modules be tested in isolation?
- [ ] **Can an AI agent easily find this code?**
- [ ] **Is the file in the expected location?**
- [ ] **Is the naming clear and descriptive?**
- [ ] **Is there a README explaining the module?**
- [ ] **Are doc comments comprehensive?**
- [ ] **Is the file size reasonable (< 500 lines)?**
- [ ] Are error cases handled properly?
- [ ] Is the logic well-structured?
- [ ] Are names clear and descriptive?
- [ ] Is there unnecessary complexity?
- [ ] Can this be simplified?
- [ ] Is it well-documented?
- [ ] Does it follow Rust best practices?

**Refactoring Process**:
1. Copy code from Iced
2. Identify improvement opportunities
3. **Identify module boundaries**
4. **Separate concerns properly**
5. Refactor for clarity and elegance
6. Add tests for each module
7. Document changes
8. Review for good taste

**Examples of "Good Taste"**:
- Prefer `?` over `unwrap()`
- Use descriptive names over abbreviations
- Keep functions small and focused (< 50 lines)
- Keep modules small and focused (< 500 lines)
- Use type system to prevent errors
- Write self-documenting code
- Follow Rust idioms
- Consistent formatting and style
- Clear module boundaries
- Proper separation of concerns
- **Predictable file locations**
- **Comprehensive doc comments**
- **README files for each module**
- **Examples in documentation**
- **Clear error messages**

**Maintainability Checklist**:
- [ ] Can I understand this code in 30 seconds?
- [ ] Can I find related code easily?
- [ ] Can I modify this without breaking other things?
- [ ] Can I test this in isolation?
- [ ] Can an AI agent navigate this codebase?
- [ ] Is the structure predictable?
- [ ] Are patterns consistent?
- [ ] Is documentation helpful?

---

## 10. Performance Targets

### 10.1 Startup Performance

**Target**: <3 seconds cold start

**Breakdown**:
- Tauri initialization: <500ms
- Controller initialization: <1s
- UI render: <500ms
- Initial balance fetch: <1s

**Optimization**:
- Lazy load non-critical components
- Cache network data
- Parallel initialization where possible


### 10.2 Runtime Performance

**Targets**:
- Command execution: <100ms (local operations)
- Network operations: <5s (with timeout)
- UI interactions: <50ms (perceived instant)
- Balance updates: <5s
- dApp iframe load: <3s

**Optimization**:
- Use Alloy's efficient RPC client
- Implement request caching
- Batch multiple RPC calls
- Use multicall for token balances
- Optimize React re-renders

### 10.3 Resource Usage

**Targets**:
- Memory: <200MB idle, <500MB active
- CPU: <5% idle, <30% active
- Disk: <50MB for app, <10MB for data
- Network: Minimal when idle

---

## 11. Risk Mitigation

### 11.1 Technical Risks

**Risk**: dApp compatibility issues
**Mitigation**:
- Follow EIP-1193 spec strictly
- Test with major dApps early
- Monitor MetaMask API changes
- Community feedback loop

**Risk**: Performance issues
**Mitigation**:
- Profile early and often
- Optimize hot paths
- Use efficient data structures
- Implement caching strategically

**Risk**: Security vulnerabilities
**Mitigation**:
- Security audit before release
- Follow best practices
- Regular dependency updates
- Bug bounty program


### 11.2 Project Risks

**Risk**: Scope creep
**Mitigation**:
- Strict feature parity goal
- No new features during migration
- dApp integration is core, not extra
- Defer nice-to-haves to post-launch

**Risk**: Timeline overrun
**Mitigation**:
- Phased approach with clear milestones
- MVP first (Windows/Android)
- Community help for macOS
- Buffer time in schedule

**Risk**: User adoption
**Mitigation**:
- Preserve familiar UI
- Smooth data migration
- Clear migration guide
- Gradual rollout (beta → stable)

---

## 12. Success Metrics

### 12.1 Technical Metrics

- [ ] All 20 controller tests passing
- [ ] 100% feature parity with Iced version
- [ ] <3s startup time
- [ ] <100ms command execution
- [ ] Works with top 10 dApps
- [ ] Zero critical security issues

### 12.2 User Metrics

- [ ] 90%+ user satisfaction
- [ ] <5% bug reports
- [ ] Successful data migration for all users
- [ ] Positive community feedback
- [ ] Active dApp usage

---

## 13. Future Enhancements

### 13.1 Post-Launch (v1.1)

- iOS support (Tauri supports it)
- WalletConnect integration
- Hardware wallet support (Ledger, Trezor)
- Advanced dApp features
- Performance optimizations

### 13.2 Long-Term (v2.0)

- Browser extension
- Multi-chain support
- DeFi integrations (swaps, staking)
- NFT gallery
- Portfolio tracking

---

## 14. Conclusion

This design provides a clear path to migrate Vaughan from Iced to Tauri while:

✅ **Preserving** the familiar UI design  
✅ **Adding** dApp browser integration  
✅ **Supporting** desktop + Android  
✅ **Reusing** 100% of Rust business logic  
✅ **Following** industry standards (MetaMask API)  
✅ **Maintaining** security and type safety  
✨ **Improving** code quality and structure  
💎 **Applying** good taste and best practices  

**Philosophy**: Don't just migrate - make it better.

**Next Step**: Begin Phase 1 implementation (Backend Setup with refactoring)

---

**Status**: Design Complete  
**Ready for**: Implementation  
**Estimated Timeline**: 4 weeks  
**Team Size**: 1 developer (with community help for macOS)  
**Code Quality**: Emphasis on clean, elegant, well-structured code


### 9.2 Code Migration Strategy

**What Transfers 100% (Already Good)**:
```
tests/                        → tests/
  - Controller tests are already clean
  - Property-based tests are well-structured
  - Integration tests are comprehensive
  → Copy these directly (they're already good!)
```

**What Needs Analysis & Improvement**:
```
src/controllers/              → Analyze → Improve → src-tauri/src/controllers/
  - Controllers are good but can be improved
  - Add better documentation
  - Improve error messages
  - Simplify complex logic

src/network/                  → Analyze → Improve → src-tauri/src/network/
src/security/                 → Analyze → Improve → src-tauri/src/security/
src/wallet/                   → Analyze → Improve → src-tauri/src/wallet/
src/tokens/                   → Analyze → Improve → src-tauri/src/tokens/
src/utils/                    → Analyze → Improve → src-tauri/src/utils/
```

**What Needs Complete Rebuild**:
```
src/gui/handlers/             → Analyze → Redesign → src-tauri/src/commands/
  - Handlers have mixed concerns
  - Need to separate into thin commands
  - Business logic goes to controllers
  
src/gui/views/                → Analyze → Redesign → web/src/views/
src/gui/components/           → Analyze → Redesign → web/src/components/
src/gui/widgets/              → Analyze → Redesign → web/src/components/
  - UI needs complete rewrite in React
  - Analyze current UX patterns
  - Recreate with better structure
```

**Migration Workflow**:

```
For each file:

1. READ the Iced code
   - Understand what it does
   - Understand why it exists
   - Identify dependencies

2. ANALYZE
   - What problems does it have?
   - What can be improved?
   - How does it fit in new architecture?

3. DESIGN
   - How should this work in Tauri?
   - What's the best structure?
   - Which layer does it belong to?

4. IMPLEMENT
   - Write new, clean code
   - Follow design principles
   - Make it modular and maintainable

5. TEST
   - Write/adapt tests
   - Verify functionality
   - Check edge cases

6. DOCUMENT
   - Add doc comments
   - Update README if needed
   - Add examples

7. REVIEW
   - Is it better than before?
   - Is it maintainable?
   - Can AI agents navigate it?
```


---

## 15. AI Agent Guidelines

### 15.1 How to Ensure AI Agents Follow These Requirements

**Problem**: AI agents might default to copy-paste instead of analyze-improve

**Solution**: Clear instructions, checklists, and verification steps

### 15.2 Instructions for AI Agents

**When working on Vaughan Tauri migration, you MUST**:

1. **Read the spec documents FIRST**
   - `requirements.md` - What we're building
   - `design.md` - How we're building it
   - These documents are the source of truth

2. **Follow the "Analyze → Improve → Rebuild" process**
   - ❌ Do NOT copy-paste Iced code
   - ✅ DO analyze, improve, and rebuild

3. **Use the 7-step workflow for each file**:
   ```
   Step 1: READ the Iced code
   Step 2: ANALYZE (what problems? what improvements?)
   Step 3: DESIGN (how should this work in Tauri?)
   Step 4: IMPLEMENT (write clean, new code)
   Step 5: TEST (verify functionality)
   Step 6: DOCUMENT (add doc comments)
   Step 7: REVIEW (is it better? maintainable? AI-friendly?)
   ```

4. **Check against the code quality checklist** (Section 9.3)
   - All 20 items must pass
   - If any fail, refactor until they pass

5. **Verify modularity and separation of concerns**
   - Each module has ONE responsibility
   - Business logic ≠ UI ≠ Data ≠ Network
   - No mixed concerns

6. **Make code AI-agent friendly**
   - Predictable file locations
   - Clear naming
   - Comprehensive doc comments
   - README files for modules
   - Small files (< 500 lines)

### 15.3 Verification Checklist for AI Agents

**Before submitting any code, verify**:

```markdown
## Code Quality Verification

- [ ] I read the requirements.md and design.md
- [ ] I followed the "Analyze → Improve → Rebuild" process
- [ ] I did NOT copy-paste Iced code
- [ ] I analyzed the Iced code for problems
- [ ] I designed a better solution
- [ ] I implemented clean, new code
- [ ] Each module has ONE clear responsibility
- [ ] Concerns are properly separated
- [ ] Business logic is separate from UI
- [ ] File is in the expected location
- [ ] File name is clear and descriptive
- [ ] File size is < 500 lines
- [ ] Functions are < 50 lines
- [ ] No unwrap() or expect() (proper error handling)
- [ ] Comprehensive doc comments
- [ ] Examples in documentation
- [ ] README exists for this module
- [ ] All tests pass
- [ ] Code follows Rust best practices
- [ ] Code is maintainable
- [ ] AI agents can easily navigate this code
```

### 15.4 Example Prompts for AI Agents

**❌ BAD PROMPT** (leads to copy-paste):
```
"Migrate the transaction handler from Iced to Tauri"
```

**✅ GOOD PROMPT** (enforces analyze-improve):
```
"Migrate the transaction handler from Iced to Tauri following these steps:

1. READ: Analyze src/gui/handlers/transaction.rs
   - What does it do?
   - What problems does it have?
   - What can be improved?

2. DESIGN: Plan the Tauri implementation
   - How should this work in Tauri?
   - What's the best structure?
   - How can we separate concerns?

3. IMPLEMENT: Write clean, new code
   - Create src-tauri/src/commands/transaction.rs (thin bridge)
   - Update src-tauri/src/controllers/transaction.rs (business logic)
   - Follow the code quality checklist (Section 9.3)
   - Make it modular and maintainable

4. VERIFY: Check against requirements
   - Run the verification checklist (Section 15.3)
   - Ensure all items pass

Show me your analysis before implementing."
```

### 15.5 Code Review Process

**For each pull request / code submission**:

1. **Human Review**:
   - Does this follow the spec?
   - Is this analyze-improve or copy-paste?
   - Is it modular and maintainable?
   - Can AI agents navigate it?

2. **Automated Checks**:
   ```bash
   # File size check
   find src-tauri/src -name "*.rs" -exec wc -l {} \; | awk '$1 > 500 {print "File too large:", $2}'
   
   # Function size check (clippy)
   cargo clippy -- -W clippy::too_many_lines
   
   # Documentation check
   cargo doc --no-deps
   
   # Test coverage
   cargo test --all-features
   ```

3. **Checklist Verification**:
   - Reviewer goes through Section 15.3 checklist
   - All items must be checked
   - If any fail, request changes

### 15.6 Steering Files for AI Agents

**Create `.kiro/steering/tauri-migration-rules.md`**:

```markdown
# Tauri Migration Rules

When working on Vaughan Tauri migration:

## CRITICAL RULES

1. ❌ **DO NOT copy-paste Iced code**
2. ✅ **DO analyze, improve, and rebuild**
3. ✅ **DO follow the 7-step workflow** (design.md Section 9.1)
4. ✅ **DO check the code quality checklist** (design.md Section 9.3)
5. ✅ **DO verify before submitting** (design.md Section 15.3)

## PROCESS

For every file:
1. READ the Iced code
2. ANALYZE (problems? improvements?)
3. DESIGN (how should this work?)
4. IMPLEMENT (write clean code)
5. TEST (verify functionality)
6. DOCUMENT (add doc comments)
7. REVIEW (is it better?)

## QUALITY STANDARDS

- Modular (one responsibility per module)
- Separated concerns (business ≠ UI ≠ data)
- Well-documented (doc comments + examples)
- Maintainable (< 500 lines per file)
- AI-friendly (predictable structure)

## VERIFICATION

Before submitting, check:
- [ ] Followed analyze-improve process
- [ ] All checklist items pass
- [ ] Code is better than Iced version
- [ ] Tests pass
- [ ] Documentation complete

## REFERENCES

- requirements.md - What we're building
- design.md - How we're building it
- Section 9.1 - Migration philosophy
- Section 9.3 - Code quality improvements
- Section 15.3 - Verification checklist
```

### 15.7 Enforcement Strategy

**Level 1: Documentation** (This spec)
- Clear requirements and design
- Explicit "do not copy-paste" warnings
- Detailed checklists

**Level 2: Steering Files** (AI agent context)
- `.kiro/steering/tauri-migration-rules.md`
- Always included in AI agent context
- Reinforces requirements

**Level 3: Prompts** (How you ask)
- Use good prompts (Section 15.4)
- Ask for analysis before implementation
- Request verification checklist

**Level 4: Code Review** (Human oversight)
- Review every submission
- Check against checklists
- Request changes if needed

**Level 5: Automated Checks** (CI/CD)
- File size limits
- Function size limits
- Documentation requirements
- Test coverage

### 15.8 Example Interaction

**You**: "Migrate the network handler to Tauri"

**AI Agent**: "I'll follow the analyze-improve process from design.md Section 9.1.

**Step 1: ANALYZE**
Reading src/gui/handlers/network.rs...

Problems I found:
- Mixed concerns (UI + business logic)
- String-based validation
- No error handling
- 800 lines (too large)

Improvements needed:
- Separate into command (bridge) + controller (logic)
- Use Alloy types
- Proper error handling
- Split into smaller modules

**Step 2: DESIGN**
I'll create:
- src-tauri/src/commands/network.rs (thin bridge, ~100 lines)
- Update src-tauri/src/controllers/network.rs (business logic, ~300 lines)

Should I proceed with implementation?"

**You**: "Yes, proceed"

**AI Agent**: *implements clean code*

**AI Agent**: "Implementation complete. Running verification checklist from Section 15.3...

✅ All 20 items pass
✅ Tests pass
✅ Documentation complete
✅ File sizes within limits

Ready for review."

---

## 16. Summary

This design ensures Vaughan Tauri migration will:

✅ **NOT be a copy-paste** - Analyze and improve everything  
✅ **Be modular** - Clear separation of concerns  
✅ **Be maintainable** - Easy to understand and modify  
✅ **Be AI-friendly** - Predictable structure and documentation  
✅ **Follow best practices** - Rust idioms and patterns  
✅ **Have quality enforcement** - Checklists and verification  

**How to ensure AI agents follow requirements**:
1. Clear documentation (this spec)
2. Steering files (always in context)
3. Good prompts (ask for analysis first)
4. Code review (human oversight)
5. Automated checks (CI/CD)

**Next Step**: Create steering file and begin Phase 1 implementation

---

**Status**: Design Complete with AI Agent Guidelines  
**Ready for**: Implementation with AI agent enforcement  
**Estimated Timeline**: 4 weeks  
**Quality Assurance**: Multi-level enforcement strategy
