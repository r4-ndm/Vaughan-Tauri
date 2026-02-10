# Phase 0: Proof of Concept (Pre-Phase 1)

**Duration**: 2-3 days  
**Purpose**: Validate critical assumptions and de-risk the migration  
**Status**: Not Started

---

## Why Phase 0?

Before committing to 7 weeks of development, we validate the 3 highest-risk assumptions:

1. **Tauri 2.0 + Alloy Integration** - Does it work as expected?
2. **Controller Initialization** - Does the lazy loading strategy work?
3. **MetaMask Provider Injection** - Can we inject window.ethereum securely?

**Goal**: Achieve 100% confidence before Phase 1.

---

## POC Tasks (2-3 days)

### POC-1: Minimal Tauri 2.0 + Alloy Setup (4 hours)

**Objective**: Verify Tauri 2.0 works with Alloy

**Steps**:
1. Run `npm create tauri-app@latest` (Tauri 2.0, React + TypeScript)
2. Add Alloy to src-tauri/Cargo.toml:
   ```toml
   [dependencies]
   alloy = { version = "0.1", features = ["full"] }
   ```
3. Create minimal command:
   ```rust
   #[tauri::command]
   async fn get_block_number(rpc_url: String) -> Result<u64, String> {
       use alloy::providers::{Provider, ProviderBuilder};
       let provider = ProviderBuilder::new().on_http(rpc_url.parse().unwrap());
       let block = provider.get_block_number().await.map_err(|e| e.to_string())?;
       Ok(block)
   }
   ```
4. Call from React frontend
5. Verify it works

**Success Criteria**:
- ✅ Tauri 2.0 project builds
- ✅ Alloy compiles without conflicts
- ✅ Can make RPC call from frontend → Rust → Alloy → Network
- ✅ No version conflicts or dependency issues

**Risk Mitigated**: Tauri 2.0 + Alloy compatibility (HIGH RISK)

---

### POC-2: Controller Lazy Initialization (4 hours)

**Objective**: Verify lazy controller initialization works

**Steps**:
1. Create minimal VaughanState:
   ```rust
   pub struct VaughanState {
       network_controllers: Arc<Mutex<HashMap<String, Arc<NetworkController>>>>,
   }
   ```
2. Implement lazy initialization:
   ```rust
   pub async fn get_or_create_controller(&self, network_id: &str) -> Arc<NetworkController> {
       let mut controllers = self.network_controllers.lock().await;
       if let Some(controller) = controllers.get(network_id) {
           return Arc::clone(controller);
       }
       let controller = Arc::new(NetworkController::new(network_id));
       controllers.insert(network_id.to_string(), Arc::clone(&controller));
       controller
   }
   ```
3. Create command that uses it:
   ```rust
   #[tauri::command]
   async fn switch_network(state: State<'_, Arc<Mutex<VaughanState>>>, network_id: String) -> Result<(), String> {
       let app_state = state.lock().await;
       let controller = app_state.get_or_create_controller(&network_id).await;
       // Use controller...
       Ok(())
   }
   ```
4. Test switching networks multiple times
5. Verify controllers are cached (not recreated)

**Success Criteria**:
- ✅ Controllers initialize on-demand
- ✅ Controllers are cached correctly
- ✅ No deadlocks or race conditions
- ✅ Arc<Mutex<>> pattern works as expected

**Risk Mitigated**: Controller lifecycle strategy (MEDIUM RISK)

---

### POC-3: MetaMask Provider Injection (4 hours)

**Objective**: Verify secure provider injection in Tauri 2.0

**Steps**:
1. Create minimal provider code:
   ```javascript
   window.ethereum = {
       isMetaMask: true,
       request: async ({ method, params }) => {
           return await window.__TAURI__.core.invoke('eth_request', { method, params });
       }
   };
   ```
2. Configure initialization_script in tauri.conf.json:
   ```json
   {
     "windows": [{
       "label": "dapp",
       "url": "dapp.html",
       "initialization_script": "window.ethereum = { ... }"
     }]
   }
   ```
3. Create simple test dApp:
   ```html
   <script>
     window.ethereum.request({ method: 'eth_chainId' })
       .then(chainId => console.log('Chain ID:', chainId));
   </script>
   ```
4. Test provider injection timing (loads before dApp code)
5. Test security (provider can't be overwritten)

**Success Criteria**:
- ✅ Provider injects before dApp code runs
- ✅ dApp can call window.ethereum methods
- ✅ Tauri commands receive requests correctly
- ✅ Provider is secure (can't be tampered with)

**Risk Mitigated**: dApp integration strategy (MEDIUM RISK)

---

### POC-4: Integration Test (2 hours)

**Objective**: Verify all 3 POCs work together

**Steps**:
1. Combine all 3 POCs into one test app
2. Create dApp that:
   - Calls window.ethereum.request({ method: 'eth_chainId' })
   - Switches networks
   - Calls window.ethereum.request({ method: 'eth_blockNumber' })
3. Verify:
   - Provider injection works
   - Controller lazy loading works
   - Alloy RPC calls work
   - Everything integrates smoothly

**Success Criteria**:
- ✅ All 3 POCs work together
- ✅ No integration issues
- ✅ Performance is acceptable
- ✅ No unexpected problems

**Risk Mitigated**: Integration complexity (LOW RISK)

---

## POC Success = 100% Confidence

If all 4 POC tasks succeed:
- ✅ **Tauri 2.0 + Alloy**: Proven to work
- ✅ **Controller Lifecycle**: Proven to work
- ✅ **MetaMask Provider**: Proven to work
- ✅ **Integration**: Proven to work

**Result**: 100% confidence to proceed with Phase 1

---

## POC Failure Scenarios

### If POC-1 Fails (Tauri 2.0 + Alloy)
- **Fallback**: Use Tauri 1.x (more mature)
- **Impact**: Minor (Tauri 1.x is well-documented)
- **Timeline**: No change

### If POC-2 Fails (Controller Lifecycle)
- **Fallback**: Use simpler state management (no lazy loading)
- **Impact**: Minor (slightly more memory usage)
- **Timeline**: No change

### If POC-3 Fails (Provider Injection)
- **Fallback**: Use different injection method (postMessage)
- **Impact**: Minor (slightly more complex)
- **Timeline**: +1 day

### If POC-4 Fails (Integration)
- **Action**: Debug and fix integration issues
- **Impact**: Depends on issue
- **Timeline**: +1-2 days

---

## Timeline Impact

**Best Case**: 2 days (all POCs succeed quickly)  
**Worst Case**: 5 days (some debugging needed)  
**Expected**: 3 days

**Total Project Timeline**: 7 weeks + 3 days = ~7.5 weeks

**Confidence Gain**: 95% → 100%

---

## Deliverables

After Phase 0, you'll have:

1. **Working POC app** - Proves all critical assumptions
2. **Code examples** - Reference for Phase 1 implementation
3. **Lessons learned** - Any gotchas or best practices discovered
4. **100% confidence** - No more unknowns

---

## Decision Point

**Option A**: Skip Phase 0, start Phase 1 (95% confidence, 7 weeks)  
**Option B**: Do Phase 0, then Phase 1 (100% confidence, 7.5 weeks)

**Recommendation**: **Option B** - 3 extra days for 100% confidence is worth it.

---

**Status**: Ready to start Phase 0  
**Next Step**: POC-1 (Tauri 2.0 + Alloy setup)
