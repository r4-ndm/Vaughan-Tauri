# Phase 1: Backend Setup - Execution Plan

**Duration**: 1.5 weeks  
**Status**: Ready to Start  
**Confidence**: 100% (Phase 0 validated all risks)

---

## Overview

Phase 1 builds the complete Rust backend with:
- Multi-chain architecture (trait-based)
- All controllers migrated from Iced
- Complete Tauri command layer
- State management with lazy initialization
- 100% test coverage maintained

**Key Principle**: Analyze → Improve → Rebuild (NOT copy-paste)

---

## Week 1: Core Architecture (Days 1-5)

### Day 1: Project Structure & Setup
**Goal**: Clean foundation with proper organization

**Tasks**:
1. ✅ Already have Tauri 2.0 project (from POC)
2. Create multi-chain directory structure
3. Set up Tauri 2.0 capabilities (ACL system)
4. Configure development tools (rustfmt, clippy)
5. Document architecture decisions

**Deliverables**:
- Clean directory structure
- Capability files for security
- Development tooling configured

---

### Day 2: Multi-Chain Architecture
**Goal**: Define trait-based chain abstraction

**Tasks**:
1. Define `ChainAdapter` trait
2. Define chain-agnostic types (Balance, TxHash, etc.)
3. Create `ChainType` enum (Evm, Stellar, Aptos, etc.)
4. Document trait design with examples

**Deliverables**:
- `src-tauri/src/chains/mod.rs` with trait
- `src-tauri/src/chains/types.rs` with types
- Comprehensive documentation

**Reference**: Use POC NetworkController as starting point

---

### Day 3: EVM Adapter Implementation
**Goal**: Implement ChainAdapter for EVM using Alloy

**Tasks**:
1. Create EvmAdapter struct (use concrete types from POC)
2. Implement all ChainAdapter methods
3. Add EVM network configurations
4. Add EVM utilities (format_units, etc.)

**Deliverables**:
- `src-tauri/src/chains/evm/adapter.rs`
- `src-tauri/src/chains/evm/networks.rs`
- Working EVM adapter with tests

**Critical**: Use `RootProvider<Http<Client>>` (learned from POC)

---

### Day 4-5: Analyze & Refactor Controllers
**Goal**: Understand existing code before migration

**Tasks**:
1. Read all 4 controllers from Iced version
2. Identify chain-agnostic vs chain-specific logic
3. Document problems and improvement opportunities
4. Design improved architecture
5. Start refactoring TransactionController

**Deliverables**:
- Analysis document
- Refactored TransactionController
- Test suite passing

**Process**: Analyze → Improve → Rebuild

---

## Week 2: Commands & Integration (Days 6-10)

### Day 6-7: Complete Controller Migration
**Goal**: All controllers working in Tauri

**Tasks**:
1. Finish TransactionController refactor
2. Refactor NetworkController
3. Refactor WalletController  
4. Refactor PriceController
5. Ensure all tests pass

**Deliverables**:
- 4 controllers fully migrated
- Improved error handling
- 100% test coverage maintained

---

### Day 8: State Management
**Goal**: Production-ready VaughanState

**Tasks**:
1. Expand POC VaughanState to full version
2. Implement controller lifecycle (from POC-2)
3. Add application state fields
4. Add dApp connection state
5. Implement state persistence

**Deliverables**:
- Complete VaughanState implementation
- State persistence working
- Tests for state management

**Reference**: Use POC-2 lazy initialization pattern

---

### Day 9: Tauri Commands
**Goal**: Complete command layer

**Tasks**:
1. Implement transaction commands (6 commands)
2. Implement network commands (5 commands)
3. Implement wallet commands (6 commands)
4. Implement security commands (4 commands)
5. Implement token commands (4 commands)
6. Add origin verification for sensitive commands

**Deliverables**:
- ~25 Tauri commands implemented
- All commands tested
- Origin verification working

**Reference**: Use POC eth_request as template

---

### Day 10: Integration & Testing
**Goal**: Everything works together

**Tasks**:
1. Wire up all commands in main.rs
2. Run full test suite
3. Fix any integration issues
4. Code quality review (clippy, fmt)
5. Document Phase 1 completion

**Deliverables**:
- All tests passing
- No clippy warnings
- Phase 1 complete document

---

## Success Criteria

### Must Have
- ✅ All 4 controllers migrated and working
- ✅ Multi-chain architecture implemented
- ✅ All Tauri commands functional
- ✅ State management with lazy initialization
- ✅ 100% test coverage maintained
- ✅ No ethers-rs dependencies (Alloy only)

### Quality Gates
- ✅ All tests pass
- ✅ No clippy warnings
- ✅ Code formatted with rustfmt
- ✅ Comprehensive documentation
- ✅ Files < 500 lines
- ✅ Functions < 50 lines

---

## Key Decisions from Phase 0

### 1. Provider Types
**Decision**: Use concrete types, not `dyn Provider`  
**Reason**: Provider trait is generic over transport  
**Implementation**: `RootProvider<Http<Client>>`

### 2. State Management
**Decision**: Arc<Mutex<VaughanState>> with lazy initialization  
**Reason**: Validated in POC-2, works perfectly  
**Implementation**: HashMap of controllers, create on-demand

### 3. Error Handling
**Decision**: Proper error types, not String  
**Reason**: Better error handling and debugging  
**Implementation**: Create WalletError enum

### 4. Architecture
**Decision**: 5-layer architecture with trait-based chains  
**Reason**: Multi-chain ready from day one  
**Implementation**: ChainAdapter trait + EVM adapter

---

## Risk Mitigation

| Risk | Mitigation | Status |
|------|------------|--------|
| Alloy compatibility | ✅ Validated in POC-1 | RESOLVED |
| State management | ✅ Validated in POC-2 | RESOLVED |
| Controller lifecycle | ✅ Validated in POC-2 | RESOLVED |
| Code complexity | Analyze → Improve → Rebuild | PLANNED |
| Test coverage | Maintain 100% coverage | PLANNED |

---

## Next Steps

**Ready to start?** Begin with Day 1: Project Structure & Setup

**Questions to answer first:**
1. Should we keep the POC code or start fresh?
2. Do we want to implement multi-chain now or EVM-only first?
3. Any specific controllers to prioritize?

**Recommendation**: Start fresh in a new directory, reference POC code as examples.
