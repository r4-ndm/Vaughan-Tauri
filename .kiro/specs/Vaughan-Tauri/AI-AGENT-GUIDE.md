# AI Agent Quick Reference Guide

**🤖 This document helps AI agents navigate the Tauri migration spec efficiently.**

---

## ✅ CONFIRMED WORKFLOW

**Development Strategy**: Build inside `Vaughan-main/`, then copy to new repo

### During Development (Phases 1-4)
```
Location: C:\Users\rb3y9\Desktop\Vaughan\Vaughan-main

Structure:
├── src/              # OLD Iced code (keep for reference)
├── src-tauri/        # NEW Tauri backend (develop here)
├── web/              # NEW React frontend (develop here)
└── .kiro/specs/      # Migration specs

Benefits:
✅ AI agents can reference old Iced code
✅ Easy comparison between old and new
✅ All docs in same place
```

### At Release (Phase 5)
```
1. Create new repo: vaughan-tauri
2. Copy ONLY: src-tauri/, web/, docs/, tests/, .kiro/
3. DON'T copy: src/ (Iced code), root Cargo.toml
4. Result: Clean new repo with no legacy code

Benefits:
✅ Clean slate for users
✅ No legacy code confusion
✅ Smaller repo size
```

**See**: `git-strategy.md` for full workflow details

---

## 📍 Where Am I? What Do I Read?

### Scenario 1: Just Starting the Migration

**You need**:
1. `CRITICAL-REQUIREMENTS.md` - Non-negotiable rules (READ FIRST!)
2. `MULTI-CHAIN-ARCHITECTURE.md` - Multi-chain design (IMPORTANT!)
3. `project-structure.md` - Where to build (inside Vaughan-main folder)
4. `git-strategy.md` - Git workflow (build inside, copy to new repo)
5. `tasks.md` - What to do first (Phase 1, Task 1.1.1)

**Don't read yet**: design.md, requirements.md (too much context)

---

### Scenario 2: Implementing Phase 1 (Backend Setup)

**Current task**: Setting up Tauri 2.0, migrating controllers

**You need**:
1. `MULTI-CHAIN-ARCHITECTURE.md` - How to structure chain adapters (CRITICAL!)
2. `tauri-2.0-specifics.md` - How to use Tauri 2.0 (ACLs, capabilities)
3. `CRITICAL-REQUIREMENTS.md` - Verify Alloy purity, no ethers, trait-based design
4. `security-considerations.md` - Section 1 (private key storage), Section 2 (Tauri security)

**Reference if needed**:
- `requirements.md` - Section 3.1 (Backend requirements)
- `design.md` - Section 2.2 (Layer 1: Alloy Core)
- Old Iced code in `src/controllers/` (for reference)

**Critical**: Implement `ChainAdapter` trait first, then `EvmAdapter` using Alloy

**Skip**: performance-ux-considerations.md (frontend focused)

---

### Scenario 3: Implementing Phase 2 (Wallet UI)

**Current task**: Building React UI, recreating Iced design

**You need**:
1. `design.md` - Section 4 (Component Design)
2. `performance-ux-considerations.md` - Section 2 (UX Considerations)
3. `requirements.md` - Section 3.2 (Frontend requirements)

**Reference if needed**:
- `tauri-2.0-specifics.md` - Section 9 (IPC Bridge)
- `security-considerations.md` - Section 2.1 (Disable DevTools)
- Old Iced UI in `src/gui/` (for design reference)

**Skip**: testing-strategy.md (test later)

---

### Scenario 4: Implementing Phase 3 (dApp Integration)

**Current task**: MetaMask provider, dApp browser

**You need**:
1. `security-considerations.md` - Section 3 (dApp Security) - CRITICAL!
2. `tauri-2.0-specifics.md` - Section 5.2 (Provider Injection)
3. `design.md` - Section 2.2 (Layer 3: MetaMask Translation)

**Reference if needed**:
- `requirements.md` - Section 3.3 (dApp Integration)
- `performance-ux-considerations.md` - Section 4 (Network Resilience)

**Critical**: Read security-considerations.md Section 3 BEFORE implementing!

---

### Scenario 5: Implementing Phase 4 (Testing & Polish)

**Current task**: Writing tests, optimizing performance

**You need**:
1. `testing-strategy.md` - Full document
2. `cross-platform-strategy.md` - Platform testing strategy
3. `performance-ux-considerations.md` - Section 1 (Performance Optimization)

**Reference if needed**:
- `security-considerations.md` - Section 10 (Penetration Testing)
- `tauri-2.0-specifics.md` - Section 10 (Testing)

---

### Scenario 6: Implementing Phase 5 (DEBLOAT & Release)

**Current task**: Removing Iced code, copying to new repo

**You need**:
1. `git-strategy.md` - Section "CONFIRMED WORKFLOW" (copy to new repo)
2. `tauri-2.0-specifics.md` - Section 8 (Phase 5: DEBLOAT)
3. `tasks.md` - Phase 5 tasks
4. `CRITICAL-REQUIREMENTS.md` - Section 5 (Phase 5 requirements)

**Steps**:
1. Create new `vaughan-tauri` repo on GitHub
2. Copy only: `src-tauri/`, `web/`, `docs/`, `tests/`, `.kiro/`
3. Don't copy: `src/` (Iced), root `Cargo.toml`
4. Update README, commit, tag v2.0.0

**Reference if needed**:
- `performance-ux-considerations.md` - Binary optimization

---

## 🎯 Quick Lookup: "I need to know about..."

### "...Tauri 2.0 specifics"
→ `tauri-2.0-specifics.md`
- Initialization: Section 2
- Capabilities/ACLs: Section 3
- Mobile: Section 4
- Security: Section 5

### "...Security requirements"
→ `security-considerations.md`
- Private keys: Section 1
- Tauri security: Section 2
- dApp security: Section 3
- Updates: Section 4

### "...Performance optimization"
→ `performance-ux-considerations.md`
- Startup: Section 1.1
- RPC optimization: Section 1.2
- Frontend: Section 1.3
- Memory: Section 1.4

### "...Testing approach"
→ `testing-strategy.md`
- Unit tests: Section 2
- Integration tests: Section 3
- E2E tests: Section 4
- Security tests: Section 5

### "...What to build"
→ `requirements.md`
- User stories: Section 2
- Functional requirements: Section 3
- Non-functional requirements: Section 4

### "...How to build it"
→ `design.md`
- Architecture: Section 2
- Design decisions: Section 3
- Component design: Section 4
- Data flow: Section 5

### "...What to do next"
→ `tasks.md`
- Phase 1: Backend Setup
- Phase 2: Wallet UI
- Phase 3: dApp Integration
- Phase 4: Testing & Polish
- Phase 5: DEBLOAT

### "...Where to build"
→ `project-structure.md`
- Build inside Vaughan-main folder
- Side-by-side with old Iced code

### "...Platform testing"
→ `cross-platform-strategy.md`
- Windows: Daily
- Linux: Weekly (WSL2)
- Android: Weekly
- macOS: CI/CD only

---

## 🚨 Critical Rules (Always Check)

Before implementing ANYTHING, verify:

1. **Tauri 2.0**: Using `npm create tauri-app@latest` (not `cargo tauri init`)
2. **Alloy Purity**: NO `use ethers` imports (only `use alloy`)
3. **Origin Verification**: Check `window.label()` in commands
4. **Security**: Follow patterns in `security-considerations.md`
5. **Process**: Analyze → Improve → Rebuild (NOT copy-paste)

**Source**: `CRITICAL-REQUIREMENTS.md`

---

## 📊 Document Size Guide

**Small (< 100 lines)**: Quick reference
- `CRITICAL-REQUIREMENTS.md` (150 lines)
- `project-structure.md` (200 lines)
- `AI-AGENT-GUIDE.md` (this file)

**Medium (100-500 lines)**: Focused topics
- `tauri-2.0-specifics.md` (400 lines)
- `cross-platform-strategy.md` (300 lines)
- `tasks.md` (500 lines)

**Large (500+ lines)**: Comprehensive guides
- `security-considerations.md` (800 lines)
- `performance-ux-considerations.md` (700 lines)
- `testing-strategy.md` (600 lines)
- `requirements.md` (982 lines)
- `design.md` (2,269 lines)

**Strategy**: Read small/medium docs fully. Read large docs by section.

---

## 🎓 Reading Strategies

### Strategy 1: Breadth-First (Recommended for Starting)
1. Read `CRITICAL-REQUIREMENTS.md` (all)
2. Read `README.md` (overview)
3. Skim `tasks.md` (understand phases)
4. Read specific docs as needed

### Strategy 2: Depth-First (Recommended for Implementing)
1. Read current phase in `tasks.md`
2. Read relevant sections in technical docs
3. Implement
4. Read testing docs
5. Test

### Strategy 3: Just-In-Time (Recommended for AI Agents)
1. Read task description
2. Read ONLY relevant sections
3. Implement
4. Move to next task

---

## 🔍 Search Patterns

### "How do I...?"

**"...initialize Tauri 2.0?"**
→ `tauri-2.0-specifics.md` Section 2

**"...store private keys securely?"**
→ `security-considerations.md` Section 1

**"...inject the MetaMask provider?"**
→ `tauri-2.0-specifics.md` Section 5.2

**"...verify origin in commands?"**
→ `security-considerations.md` Section 2.3

**"...optimize startup time?"**
→ `performance-ux-considerations.md` Section 1.1

**"...test dApp integration?"**
→ `testing-strategy.md` Section 4.2

**"...remove Iced code?"**
→ `tauri-2.0-specifics.md` Section 8

### "What is...?"

**"...the architecture?"**
→ `design.md` Section 2

**"...Alloy purity?"**
→ `CRITICAL-REQUIREMENTS.md` Section 2

**"...the capabilities system?"**
→ `tauri-2.0-specifics.md` Section 3

**"...Phase 5 DEBLOAT?"**
→ `tauri-2.0-specifics.md` Section 8

### "Why...?"

**"...Tauri 2.0 instead of 1.x?"**
→ `tauri-2.0-specifics.md` Section 1

**"...separate window for dApp browser?"**
→ `design.md` Section 3.2

**"...no ethers-rs?"**
→ `CRITICAL-REQUIREMENTS.md` Section 2

---

## 💡 Pro Tips for AI Agents

### Tip 1: Read Sections, Not Whole Files
Large files like `design.md` have clear sections. Read only what you need.

### Tip 2: Check CRITICAL-REQUIREMENTS.md First
Before implementing anything, verify it doesn't violate critical requirements.

### Tip 3: Use the README as a Map
`README.md` has a table of contents and document purposes.

### Tip 4: Follow the Task Order
`tasks.md` is ordered for a reason. Don't skip ahead.

### Tip 5: Security First
When in doubt, check `security-considerations.md`.

### Tip 6: Test As You Go
Don't wait until Phase 4. Write tests for each feature.

### Tip 7: Ask for Clarification
If requirements conflict, ask the user before proceeding.

---

## 📝 Document Dependency Graph

```
CRITICAL-REQUIREMENTS.md (start here!)
    ↓
README.md (overview)
    ↓
tasks.md (what to do)
    ↓
┌───────────────┬───────────────┬───────────────┐
│               │               │               │
Phase 1         Phase 2         Phase 3         Phase 4/5
│               │               │               │
↓               ↓               ↓               ↓
tauri-2.0       design.md       security        testing
-specifics.md   performance     -considerations -strategy.md
security        -ux.md          tauri-2.0       performance
-considerations                 -specifics.md   -ux.md
requirements.md requirements.md design.md       cross-platform
design.md                                       -strategy.md
```

---

## ✅ Checklist: Before Starting Implementation

- [ ] Read `CRITICAL-REQUIREMENTS.md` (all)
- [ ] Read `README.md` (overview section)
- [ ] Read `project-structure.md` (where to build)
- [ ] Read current phase in `tasks.md`
- [ ] Read relevant technical docs for current task
- [ ] Verify no conflicts with critical requirements
- [ ] Understand the "why" behind the task

---

## 🎯 Summary

**The spec is organized for efficient navigation:**

1. **Start**: `CRITICAL-REQUIREMENTS.md` → `README.md` → `tasks.md`
2. **Implement**: Read relevant sections from technical docs
3. **Verify**: Check against `CRITICAL-REQUIREMENTS.md`
4. **Test**: Follow `testing-strategy.md`

**Don't try to read everything at once. Read what you need, when you need it.**

**This structure is AI-agent friendly because:**
- ✅ Clear navigation paths
- ✅ Focused documents (one purpose each)
- ✅ Section-based reading (don't need whole file)
- ✅ Quick reference guide (this file)
- ✅ Context-aware recommendations

**Happy coding! 🚀**
