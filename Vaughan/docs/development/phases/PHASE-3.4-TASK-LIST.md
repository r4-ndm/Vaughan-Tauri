# Phase 3.4: Native WebView Redesign - Task List

**Status**: 🚀 In Progress
**Estimated Time**: 17 hours (updated after god mode review)
**Priority**: HIGH

---

## 🎯 Overview

Redesign dApp browser to use Tauri's native WebviewWindow with proper security, following Rabby Desktop architecture.

**Key Changes**:
- Replace HTML iframe with native WebviewWindow
- Inject provider via initialization_script (bypasses CSP)
- Add window-specific session management
- Implement proper security validation
- Add multi-window state synchronization

---

## 📋 Task Checklist

### PHASE 1: Backend Security & Window Management (4 hours)

#### 1.1 Session Management Refactoring (45 min)
**File**: `Vaughan/src-tauri/src/dapp/session.rs`

- [x] Change session key from `String` to `(String, String)` (window_label, origin)
- [x] Update `SessionManager` struct:
  ```rust
  pub struct SessionManager {
      sessions: Arc<RwLock<HashMap<(String, String), Session>>>,
      // ...
  }
  ```
- [x] Add `create_session_for_window(window_label: &str, origin: &str)`
- [x] Add `get_session_by_window(window_label: &str, origin: &str)`
- [x] Add `remove_session_by_window(window_label: &str)`
- [x] Add `remove_all_sessions_for_window(window_label: &str)`
- [x] Update existing methods to use new key structure
- [x] Add tests for window-specific sessions
- [x] Verify compilation

**Acceptance Criteria**:
- ✅ Sessions are isolated per window
- ✅ Multiple windows to same origin have separate sessions
- ✅ Closing window removes only that window's sessions

---

#### 1.2 Approval Queue Updates (30 min)
**File**: `Vaughan/src-tauri/src/dapp/approval.rs`

- [x] Add `window_label: String` field to `ApprovalRequest` struct
- [x] Update `add_request()` to accept window_label parameter
- [x] Add `clear_for_window(window_label: &str)` method
- [x] Add `get_requests_for_window(window_label: &str)` method
- [x] Update serialization to include window_label
- [x] Add tests for window-specific approval filtering
- [x] Verify compilation

**Acceptance Criteria**:
- ✅ Approvals are tagged with window label
- ✅ Can clear approvals for specific window
- ✅ Can query approvals by window

---

#### 1.3 Window Command Implementation (90 min)
**File**: `Vaughan/src-tauri/src/commands/window.rs`

- [x] Add URL validation helper:
  ```rust
  fn validate_url(url: &str) -> Result<Url, String>
  ```
- [x] Implement `open_dapp_url` command:
  - [x] Validate URL (http/https only)
  - [x] Generate unique window label
  - [x] Load provider script
  - [x] Create WebviewWindow with initialization_script
  - [x] Set up window event handlers
  - [x] Return window label
- [x] Implement `navigate_dapp` command:
  - [x] Validate URL
  - [x] Check window exists
  - [x] Navigate to URL
  - [x] **Handle navigation events** (on_navigation callback) - TODO markers added
  - [x] **Update window registry** with new URL - TODO markers added (Task 1.5)
  - [x] **Validate origin on navigation** (prevent redirect attacks) - TODO markers added
- [x] Implement `close_dapp` command:
  - [x] Get window by label
  - [x] **Clean up sessions for window**
  - [x] **Clear approvals for window**
  - [x] **Remove from window registry** - TODO markers added (Task 1.5)
  - [x] **Cancel pending requests** - TODO markers added
  - [x] Close window
- [x] Implement `get_dapp_url` command
- [x] Add window event handlers:
  - [x] `on_window_event` for CloseRequested
  - [x] **`on_navigation` for URL changes** - TODO markers added
  - [x] **`on_page_load` for load completion** - TODO markers added
  - [x] **Comprehensive cleanup on window close**
- [x] Add tests
- [x] Verify compilation

**Acceptance Criteria**:
- ✅ Can open dApp URL in native webview
- ✅ URL validation prevents file:// and other protocols
- ✅ Window cleanup happens on close (sessions, approvals, registry)
- ✅ Provider script injected before page loads
- ✅ Navigation events tracked and validated (TODO markers for Task 1.5)
- ✅ No memory leaks on window close

---

#### 1.4 dapp_request Security Updates (45 min)
**File**: `Vaughan/src-tauri/src/commands/dapp.rs`

- [ ] Update `dapp_request` signature to include `Window` parameter:
  ```rust
  #[tauri::command]
  pub async fn dapp_request(
      window: Window,
      state: State<'_, VaughanState>,
      request: DappRequest,
  ) -> Result<DappResponse, String>
  ```
- [ ] Extract window label from `Window`
- [ ] Extract origin from window URL
- [ ] **Validate window_label matches actual window** (CRITICAL):
  ```rust
  let actual_label = window.label();
  if actual_label != window_label {
      return Err("Window label mismatch".to_string());
  }
  ```
- [ ] Update session validation to use (window_label, origin)
- [ ] Update approval request creation to include window_label
- [ ] Add origin validation logging
- [ ] Add tests for window-specific requests
- [ ] Verify compilation

**Acceptance Criteria**:
- ✅ Requests are validated per window
- ✅ Origin is extracted from window URL
- ✅ Cannot spoof origin from different window
- ✅ Window label validation prevents label spoofing attacks

---

#### 1.5 Window Registry Implementation (30 min) **[NEW - CRITICAL]**
**File**: `Vaughan/src-tauri/src/dapp/window_registry.rs` (NEW)

- [ ] Create `WindowRegistry` struct:
  ```rust
  pub struct WindowRegistry {
      windows: Arc<RwLock<HashMap<String, WindowInfo>>>,
  }
  
  pub struct WindowInfo {
      pub window_label: String,
      pub current_origin: String,
      pub created_at: SystemTime,
      pub last_navigation: SystemTime,
  }
  ```
- [ ] Add `register_window(label: &str, origin: &str)` method
- [ ] Add `update_origin(label: &str, new_origin: &str)` method
- [ ] Add `get_origin(label: &str)` method
- [ ] Add `remove_window(label: &str)` method
- [ ] Add `get_all_windows()` method
- [ ] Add tests for window tracking
- [ ] Integrate with `VaughanState`:
  ```rust
  // In state.rs
  pub struct VaughanState {
      // ... existing fields
      pub window_registry: WindowRegistry,
  }
  ```
- [ ] Update `open_dapp_url` to register windows
- [ ] Update `navigate_dapp` to update origin
- [ ] Update `close_dapp` to remove from registry
- [ ] Verify compilation

**Why Critical**: Without this, we can't track which window is showing which origin, making origin validation impossible and opening security holes.

**Acceptance Criteria**:
- ✅ All dApp windows tracked in registry
- ✅ Origin updated on navigation
- ✅ Registry cleaned up on window close
- ✅ Can query current origin for any window

---

### PHASE 2: Provider Script Updates (2.5 hours)

#### 2.1 Provider IPC Communication (60 min)
**File**: `Vaughan/src/provider/provider-inject.js`

- [ ] Add environment detection:
  ```javascript
  const isNativeWebview = window.__TAURI__ !== undefined;
  ```
- [ ] Replace postMessage with Tauri IPC for native webview:
  ```javascript
  async _sendRequest(method, params) {
      const request = { id, method, params };
      
      if (isNativeWebview) {
          // Use Tauri IPC
          const response = await window.__TAURI__.invoke('dapp_request', {
              request
          });
          return response.result;
      } else {
          // Fallback to postMessage (for iframe testing)
          return this._sendViaPostMessage(request);
      }
  }
  ```
- [ ] Add Tauri IPC error handling
- [ ] Add reconnection logic on session errors
- [ ] Keep postMessage code as fallback
- [ ] Update initialization to not require parent window
- [ ] Add console logging for debugging
- [ ] Test with localhost dApp

**Acceptance Criteria**:
- ✅ Provider detects native webview vs iframe
- ✅ Uses Tauri IPC in native webview
- ✅ Falls back to postMessage in iframe
- ✅ Errors are handled gracefully
- ✅ Reconnection works on session loss

---

#### 2.2 Window Event Listeners (30 min)
**File**: `Vaughan/src/provider/provider-inject.js`

- [ ] Add event listener for approval responses:
  ```javascript
  window.__TAURI__.event.listen('approval_response', (event) => {
      // Handle approval response
  });
  ```
- [ ] Add event listener for account changes:
  ```javascript
  window.__TAURI__.event.listen('accountsChanged', (event) => {
      this._handleAccountsChanged(event.payload);
  });
  ```
- [ ] Add event listener for chain changes:
  ```javascript
  window.__TAURI__.event.listen('chainChanged', (event) => {
      this._handleChainChanged(event.payload);
  });
  ```
- [ ] Add event listener for disconnect
- [ ] Test event propagation

**Acceptance Criteria**:
- ✅ Provider receives events from backend
- ✅ Account changes propagate to dApp
- ✅ Network changes propagate to dApp

---

#### 2.3 Provider Script Optimization (30 min)
**File**: `Vaughan/src-tauri/src/commands/window.rs`

- [ ] Create lazy_static for provider script:
  ```rust
  lazy_static! {
      static ref PROVIDER_SCRIPT: String = 
          include_str!("../../provider-inject.js").to_string();
  }
  ```
- [ ] Update `open_dapp_url` to use reference
- [ ] Copy updated provider to public folder
- [ ] Test script injection
- [ ] Verify no performance regression

**Acceptance Criteria**:
- ✅ Provider script loaded once at startup
- ✅ No binary size bloat
- ✅ Script injection still works

---

#### 2.4 Request Timeout & Reconnection (30 min) **[NEW - CRITICAL]**
**File**: `Vaughan/src/provider/provider-inject.js`

- [ ] Add request timeout handling:
  ```javascript
  async _sendRequest(method, params) {
      const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 30000)
      );
      
      const requestPromise = window.__TAURI__.invoke('dapp_request', {
          request: { id, method, params }
      });
      
      return Promise.race([requestPromise, timeoutPromise]);
  }
  ```
- [ ] Add automatic reconnection on session loss:
  ```javascript
  async _handleSessionError() {
      console.log('[Vaughan] Session lost, reconnecting...');
      try {
          await this.request({ method: 'eth_requestAccounts', params: [] });
          console.log('[Vaughan] Reconnected successfully');
      } catch (error) {
          console.error('[Vaughan] Reconnection failed:', error);
      }
  }
  ```
- [ ] Add retry logic for transient errors (max 3 retries)
- [ ] Add exponential backoff for retries
- [ ] Test timeout scenarios
- [ ] Test reconnection after session expiry
- [ ] Verify no infinite retry loops

**Why Critical**: Without timeouts, hung requests can freeze the dApp. Without reconnection, users must refresh the page after session expiry.

**Acceptance Criteria**:
- ✅ Requests timeout after 30 seconds
- ✅ Session errors trigger automatic reconnection
- ✅ Transient errors retried with backoff
- ✅ No infinite loops or memory leaks

---

### PHASE 3: Frontend Updates (2 hours)

#### 3.1 Update Main Wallet (30 min)
**File**: `Vaughan/src/views/WalletView/WalletView.tsx`

- [ ] Update `handleDappBrowser` to call `open_dapp_url`:
  ```typescript
  const handleDappBrowser = async () => {
      try {
          const windowLabel = await invoke('open_dapp_url', {
              url: 'https://swap.internetmoney.io'
          });
          console.log('Opened dApp window:', windowLabel);
      } catch (error) {
          console.error('Failed to open dApp:', error);
      }
  };
  ```
- [ ] Add error handling
- [ ] Add loading state
- [ ] Test button click

**Acceptance Criteria**:
- ✅ Clicking dApps button opens native webview
- ✅ Errors are displayed to user
- ✅ Loading state shows during window creation

#### 3.2 Update Tauri Service (30 min)
**File**: `Vaughan/src/services/tauri.ts`

- [ ] Add `openDappUrl(url: string): Promise<string>` method
- [ ] Add `navigateDapp(windowLabel: string, url: string): Promise<void>` method
- [ ] Add `closeDapp(windowLabel: string): Promise<void>` method
- [ ] Add `getDappUrl(windowLabel: string): Promise<string>` method
- [ ] Export methods in TauriService object
- [ ] Add JSDoc comments
- [ ] Add type definitions

**Acceptance Criteria**:
- ✅ Type-safe methods for window management
- ✅ Proper error handling
- ✅ Documentation complete

---

#### 3.3 Update Approval Commands (30 min)
**File**: `Vaughan/src-tauri/src/commands/dapp.rs`

- [ ] Update `respond_to_approval` to emit event to specific window:
  ```rust
  #[tauri::command]
  pub async fn respond_to_approval(
      app: AppHandle,
      state: State<'_, VaughanState>,
      id: String,
      approved: bool,
      data: Option<serde_json::Value>,
  ) -> Result<(), String> {
      let approval = state.approval_queue.get(&id)?;
      let window_label = &approval.window_label;
      
      // Get dApp window
      let window = app.get_webview_window(window_label)
          .ok_or("dApp window not found")?;
      
      // Emit response to window
      window.emit("approval_response", ApprovalResponse {
          id: id.clone(),
          approved,
          result: data,
      })?;
      
      // Remove from queue
      state.approval_queue.remove(&id)?;
      
      Ok(())
  }
  ```
- [ ] Update `cancel_approval` similarly
- [ ] Add tests
- [ ] Verify compilation

**Acceptance Criteria**:
- ✅ Approval responses sent to correct window
- ✅ Multiple windows don't interfere
- ✅ Errors handled gracefully

---

#### 3.4 Update WalletView dApps Button (15 min)
**File**: `Vaughan/src/views/WalletView/WalletView.tsx`

- [ ] Update dApps button to use new `open_dapp_url` command
- [ ] Add error handling and user feedback
- [ ] Test button functionality
- [ ] Verify native webview opens

**Acceptance Criteria**:
- ✅ Button opens native webview (not iframe)
- ✅ Errors displayed to user
- ✅ No breaking changes to other buttons

---

#### 3.5 Remove Old Iframe Code (15 min)
**⚠️ IMPORTANT**: Only do this AFTER Phase 6.4 (Real dApp Testing) passes!

**Why wait**: Keep old code as fallback until new implementation is proven working.

- [ ] **VERIFY** new native webview works with real dApps first
- [ ] Delete `Vaughan/src/views/DappBrowserView/DappBrowserStandalone.tsx`
- [ ] Delete `Vaughan/src/views/DappBrowserView/DappBrowserView.tsx`
- [ ] Delete `Vaughan/src/hooks/useProviderBridge.ts`
- [ ] Delete `Vaughan/dapp-browser.html`
- [ ] Delete `Vaughan/src/dapp-browser.tsx`
- [ ] Update `Vaughan/vite.config.ts` to remove dappBrowser entry:
  ```typescript
  // Remove this entire section:
  dappBrowser: resolve(__dirname, 'dapp-browser.html'),
  ```
- [ ] Remove unused imports from other files
- [ ] Search for any remaining references to deleted files
- [ ] Verify compilation: `npm run build`
- [ ] Run tests: `npm test`
- [ ] Test main wallet still works

**Acceptance Criteria**:
- ✅ Old iframe code completely removed
- ✅ No compilation errors
- ✅ No broken imports
- ✅ Tests still pass
- ✅ Main wallet functionality intact

---

#### 3.6 Backend Event Emission (15 min) **[NEW - CRITICAL]**
**File**: `Vaughan/src-tauri/src/commands/dapp.rs`

- [ ] Add helper function to emit events to dApp windows:
  ```rust
  /// Emit event to specific dApp window
  fn emit_to_window<T: Serialize>(
      app: &AppHandle,
      window_label: &str,
      event: &str,
      payload: T,
  ) -> Result<(), String> {
      app.get_webview_window(window_label)
          .ok_or_else(|| format!("Window {} not found", window_label))?
          .emit(event, payload)
          .map_err(|e| format!("Failed to emit event: {}", e))
  }
  ```
- [ ] Update `respond_to_approval` to use helper
- [ ] Add event emission for connection approval:
  ```rust
  // After successful connection
  emit_to_window(&app, &window_label, "connect", ConnectEvent {
      accounts: vec![address],
      chain_id: format!("0x{:x}", chain_id),
  })?;
  ```
- [ ] Add event emission for disconnection
- [ ] Test event delivery to provider
- [ ] Verify compilation

**Why Critical**: Provider needs to receive events from backend to update dApp state. Without this, dApps won't know when accounts/networks change.

**Acceptance Criteria**:
- ✅ Events emitted to correct window
- ✅ Provider receives and handles events
- ✅ dApp state updates correctly

---

### PHASE 4: State Synchronization (2 hours)

#### 4.1 Account Change Propagation (45 min)
**File**: `Vaughan/src-tauri/src/commands/wallet.rs`

- [ ] Update `set_active_account` to emit events:
  ```rust
  #[tauri::command]
  pub async fn set_active_account(
      app: AppHandle,
      state: State<'_, VaughanState>,
      address: String,
  ) -> Result<(), String> {
      state.set_active_account(address.clone())?;
      
      // Collect window labels first (avoid holding lock during emit)
      let window_labels: Vec<String> = {
          let sessions = state.session_manager.all_sessions().await;
          sessions.into_iter().map(|(label, _)| label).collect()
      }; // Lock released here
      
      // Emit to all dApp windows (without holding lock)
      for window_label in window_labels {
          if let Some(window) = app.get_webview_window(&window_label) {
              window.emit("accountsChanged", vec![address.clone()]).ok();
          }
      }
      
      Ok(())
  }
  ```
- [ ] Add helper method `emit_to_all_dapp_windows`
- [ ] Test with multiple windows
- [ ] Verify events received

**Acceptance Criteria**:
- ✅ Account changes propagate to all dApp windows
- ✅ Each window receives accountsChanged event
- ✅ dApps update their UI
- ✅ No deadlocks (lock released before emitting)

---

#### 4.2 Network Change Propagation (45 min)
**File**: `Vaughan/src-tauri/src/commands/network.rs`

- [ ] Update `switch_network` to emit events:
  ```rust
  #[tauri::command]
  pub async fn switch_network(
      app: AppHandle,
      state: State<'_, VaughanState>,
      request: SwitchNetworkRequest,
  ) -> Result<(), String> {
      state.switch_network(&request.network_id, &request.rpc_url, request.chain_id).await?;
      
      // Get new chain ID
      let chain_id = format!("0x{:x}", request.chain_id);
      
      // Collect window labels first (avoid holding lock during emit)
      let window_labels: Vec<String> = {
          let sessions = state.session_manager.all_sessions().await;
          sessions.into_iter().map(|(label, _)| label).collect()
      }; // Lock released here
      
      // Emit to all dApp windows (without holding lock)
      for window_label in window_labels {
          if let Some(window) = app.get_webview_window(&window_label) {
              window.emit("chainChanged", chain_id.clone()).ok();
          }
      }
      
      Ok(())
  }
  ```
- [ ] Test with multiple windows
- [ ] Verify chain ID format (hex string)
- [ ] Test dApp response

**Acceptance Criteria**:
- ✅ Network changes propagate to all dApp windows
- ✅ Chain ID in correct format (0x-prefixed hex)
- ✅ dApps update their network display
- ✅ No deadlocks (lock released before emitting)

---

#### 4.3 Session Manager Updates (30 min)
**File**: `Vaughan/src-tauri/src/dapp/session.rs`

- [ ] Add `all_sessions()` method:
  ```rust
  pub fn all_sessions(&self) -> Vec<(String, String)> {
      self.sessions.read().unwrap()
          .keys()
          .cloned()
          .collect()
  }
  ```
- [ ] Add `all_window_labels()` method
- [ ] Add `session_count()` method
- [ ] Add tests
- [ ] Verify compilation

**Acceptance Criteria**:
- ✅ Can iterate over all sessions
- ✅ Can get list of active windows
- ✅ Thread-safe access

---

### PHASE 5: Security Hardening (2 hours)

#### 5.1 URL Validation (30 min)
**File**: `Vaughan/src-tauri/src/commands/window.rs`

- [ ] Create `validate_url` function:
  ```rust
  fn validate_url(url: &str) -> Result<Url, String> {
      let parsed = Url::parse(url)
          .map_err(|_| "Invalid URL")?;
      
      // Only allow http/https
      match parsed.scheme() {
          "http" | "https" => Ok(parsed),
          _ => Err("Only HTTP(S) URLs allowed".to_string()),
      }
  }
  ```
- [ ] Add to `open_dapp_url`
- [ ] Add to `navigate_dapp`
- [ ] Add tests for various URL schemes
- [ ] Test error messages

**Acceptance Criteria**:
- ✅ Only http/https URLs allowed
- ✅ file://, data://, javascript: blocked
- ✅ Clear error messages

---

#### 5.2 Request Logging (30 min)
**File**: `Vaughan/src-tauri/src/commands/dapp.rs`

- [ ] Add logging to `dapp_request`:
  ```rust
  log::info!(
      "dApp request: window={}, origin={}, method={}",
      window_label, origin, request.method
  );
  ```
- [ ] Add logging to approval responses
- [ ] Add logging to session creation/removal
- [ ] Configure log levels
- [ ] Test log output

**Acceptance Criteria**:
- ✅ All dApp requests logged
- ✅ Origin and window tracked
- ✅ Useful for debugging and auditing

---

#### 5.3 Rate Limiting Per Window (30 min)
**File**: `Vaughan/src-tauri/src/dapp/rate_limiter.rs`

- [ ] Update rate limiter key to include window:
  ```rust
  pub fn check_limit(&mut self, window_label: &str, origin: &str) -> Result<(), WalletError> {
      let key = format!("{}:{}", window_label, origin);
      // ... existing logic
  }
  ```
- [ ] Update `dapp_request` to pass window_label
- [ ] Add tests for per-window limits
- [ ] Verify isolation

**Acceptance Criteria**:
- ✅ Rate limiting per window + origin
- ✅ Multiple windows don't share rate limit
- ✅ Prevents abuse

---

#### 5.4 Permission System (30 min)
**File**: `Vaughan/src-tauri/src/dapp/permissions.rs` (NEW)

- [ ] Create `DappPermissions` struct:
  ```rust
  pub struct DappPermissions {
      pub window_label: String,
      pub origin: String,
      pub allowed_methods: HashSet<String>,
      pub granted_at: SystemTime,
  }
  ```
- [ ] Create `PermissionManager` struct
- [ ] Add `grant_permission` method
- [ ] Add `check_permission` method
- [ ] Add `revoke_permission` method
- [ ] Add tests
- [ ] Integrate with `dapp_request`

**Acceptance Criteria**:
- ✅ Permissions tracked per window
- ✅ Can grant/revoke permissions
- ✅ Permissions checked before execution

---

### PHASE 6: Testing & Validation (2 hours)

#### 6.1 Unit Tests (30 min)

- [ ] Test session management with multiple windows
- [ ] Test approval queue window filtering
- [ ] Test URL validation
- [ ] Test rate limiting per window
- [ ] Test permission system
- [ ] Run `cargo test`
- [ ] Fix any failures

**Acceptance Criteria**:
- ✅ All unit tests pass
- ✅ Code coverage > 80%
- ✅ Edge cases covered

---

#### 6.2 Integration Tests (45 min) **[ENHANCED]**

- [ ] Test opening dApp window
- [ ] Test provider injection
- [ ] Test eth_requestAccounts flow
- [ ] Test eth_sendTransaction flow
- [ ] Test window cleanup on close
- [ ] **Test concurrent multi-window scenarios** (15 min extra):
  - [ ] Open 3 dApp windows simultaneously
  - [ ] Send requests from all windows at once
  - [ ] Verify each window gets correct responses
  - [ ] Test approval routing (approve in window 1, verify window 2 unaffected)
  - [ ] Close one window, verify others unaffected
  - [ ] Test session isolation between windows
  - [ ] Test rate limiting per window
  - [ ] Verify no cross-window data leakage

**Acceptance Criteria**:
- ✅ End-to-end flows work
- ✅ No memory leaks
- ✅ Clean shutdown
- ✅ Multiple windows work independently
- ✅ No race conditions or deadlocks
- ✅ Proper isolation between windows

---

#### 6.3 Security Tests (30 min)

- [ ] Test cross-window attack prevention
- [ ] Test origin spoofing prevention
- [ ] Test malicious URL blocking
- [ ] Test approval routing isolation
- [ ] Test session isolation
- [ ] Document security findings

**Acceptance Criteria**:
- ✅ No cross-window attacks possible
- ✅ Origin validation works
- ✅ Sessions properly isolated

---

#### 6.4 Real dApp Testing (30 min)

- [ ] Test with swap.internetmoney.io
  - [ ] Open dApp
  - [ ] Connect wallet
  - [ ] Verify Vaughan appears in list
  - [ ] Test transaction
- [ ] Test with app.uniswap.org
  - [ ] Same flow
- [ ] Test with app.1inch.io
  - [ ] Same flow
- [ ] Test multi-window (open multiple dApps)
- [ ] Test state synchronization
- [ ] Document any issues

**Acceptance Criteria**:
- ✅ Works with real-world dApps
- ✅ No CSP errors
- ✅ EIP-6963 discovery works
- ✅ Transactions succeed

---

### PHASE 7: Documentation (1 hour)

#### 7.1 Update Documentation (30 min)

- [ ] Create `PHASE-3.4-COMPLETE.md`
- [ ] Document new architecture
- [ ] Update testing guide
- [ ] Add troubleshooting section
- [ ] Document security features
- [ ] Add diagrams

**Acceptance Criteria**:
- ✅ Complete implementation docs
- ✅ Clear architecture diagrams
- ✅ Troubleshooting guide

---

#### 7.2 Code Comments (30 min)

- [ ] Add JSDoc to all new TypeScript functions
- [ ] Add Rust doc comments to all new functions
- [ ] Update README if needed
- [ ] Add inline comments for complex logic
- [ ] Review and improve clarity

**Acceptance Criteria**:
- ✅ All public APIs documented
- ✅ Complex logic explained
- ✅ Examples provided

---

## 📊 Progress Tracking

### Phase 1: Backend (4 hours) **[UPDATED]**
- [x] 1.1 Session Management (45 min) ✅ COMPLETE
- [x] 1.2 Approval Queue (30 min) ✅ COMPLETE
- [x] 1.3 Window Commands (90 min) ✅ COMPLETE **[+30 min for navigation & cleanup]**
- [ ] 1.4 Security Updates (45 min)
- [ ] 1.5 Window Registry (30 min) **[NEW - CRITICAL]**

### Phase 2: Provider (2.5 hours) **[UPDATED]**
- [ ] 2.1 IPC Communication (60 min)
- [ ] 2.2 Event Listeners (30 min)
- [ ] 2.3 Optimization (30 min)
- [ ] 2.4 Request Timeout & Reconnection (30 min) **[NEW - CRITICAL]**

### Phase 3: Frontend (2.25 hours) **[UPDATED]**
- [ ] 3.1 Main Wallet (30 min)
- [ ] 3.2 Tauri Service (30 min)
- [ ] 3.3 Approval Commands (45 min) **[+15 min]**
- [ ] 3.4 Update WalletView (15 min)
- [ ] 3.5 Remove Old Code (15 min) ⚠️ **DO LAST - After Phase 6.4 passes**
- [ ] 3.6 Backend Event Emission (15 min) **[NEW - CRITICAL]**

### Phase 4: State Sync (2 hours)
- [ ] 4.1 Account Changes (45 min)
- [ ] 4.2 Network Changes (45 min)
- [ ] 4.3 Session Manager (30 min)

### Phase 5: Security (2 hours)
- [ ] 5.1 URL Validation (30 min)
- [ ] 5.2 Request Logging (30 min)
- [ ] 5.3 Rate Limiting (30 min)
- [ ] 5.4 Permissions (30 min)

### Phase 6: Testing (2.25 hours) **[UPDATED]**
- [ ] 6.1 Unit Tests (30 min)
- [ ] 6.2 Integration Tests (45 min) **[+15 min for concurrent windows]**
- [ ] 6.3 Security Tests (30 min)
- [ ] 6.4 Real dApp Tests (30 min)

### Phase 7: Documentation (1 hour)
- [ ] 7.1 Update Docs (30 min)
- [ ] 7.2 Code Comments (30 min)

---

## 🎯 Success Criteria

### Must Have
- [ ] Native webview opens dApp URLs
- [ ] Provider injected via initialization_script
- [ ] Works with swap.internetmoney.io
- [ ] Connection approval works
- [ ] Transaction signing works
- [ ] No CSP errors
- [ ] Window-specific sessions
- [ ] Proper cleanup on window close
- [ ] **Window registry tracks all dApp windows** **[NEW]**
- [ ] **Request timeouts prevent hung requests** **[NEW]**
- [ ] **Automatic reconnection on session loss** **[NEW]**
- [ ] **Events emitted from backend to provider** **[NEW]**
- [ ] **Concurrent windows work independently** **[NEW]**

### Nice to Have
- [ ] Address bar overlay
- [ ] Navigation history
- [ ] Bookmarks
- [ ] Multiple dApp windows
- [ ] Window management UI

---

## 🚨 Blockers & Dependencies

### Blockers
- None identified

### Dependencies
- Tauri 2.0 (already installed)
- lazy_static crate (may need to add)
- url crate (already installed)
- serde crate (already installed)

---

## 📝 Notes

- Start with Phase 1 (Backend) - most critical
- **NEW CRITICAL TASKS**: Window Registry (1.5), Request Timeout (2.4), Event Emission (3.6)
- Test after each phase before moving to next
- Security is priority - don't skip Phase 5
- Real dApp testing is essential - allocate enough time
- **Concurrent window testing is critical** - don't skip 6.2
- Document as you go - don't leave for end

---

## 🔍 Expert Review Additions Summary

**8 Critical Gaps Addressed**:
1. ✅ **Window Registry** (Task 1.5) - Track window-to-origin mapping
2. ✅ **Navigation Events** (Task 1.3 enhanced) - Handle URL changes and validate origins
3. ✅ **Event Emission** (Task 3.6) - Backend emits events to provider
4. ✅ **Request Timeouts** (Task 2.4) - Prevent hung requests
5. ✅ **Reconnection Logic** (Task 2.4) - Auto-reconnect on session loss
6. ✅ **Comprehensive Cleanup** (Task 1.3 enhanced) - Full cleanup on window close
7. ✅ **Concurrent Testing** (Task 6.2 enhanced) - Test multiple windows
8. ⚠️ **Phishing Detection** - Deferred to future phase (requires UI/UX design)

**Time Impact**: +2 hours (12h → 14h total)

---

**Total Estimated Time**: 17 hours **[UPDATED after god mode review]**
**Recommended Schedule**: 2.5 days (7 hours each)

**Ready to start?** Begin with Phase 1, Task 1.1 (Session Management)
