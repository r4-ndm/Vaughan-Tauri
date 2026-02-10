# Universal Prompt for All Phases

**Purpose**: Single prompt template that works for Phase 0, 1, 2, 3, 4, and 5  
**Location**: Use this for every phase of the Vaughan-Tauri migration

---

## The Universal Prompt

```
Execute Vaughan-Tauri migration work.

PROJECT: C:\Users\rb3y9\Desktop\Vaughan-Tauri\

CURRENT PHASE: [Phase 0 / Phase 1 / Phase 2 / Phase 3 / Phase 4 / Phase 5]

READ FIRST:
- tasks.md (current phase section)
- CONCRETE-EXAMPLES.md (code patterns)
- Relevant offline references (see REFERENCE-INDEX.md)

WORK STYLE:
- Professional quality over speed
- Mark completed tasks with [x] in tasks.md
- Report failures clearly - we'll solve together
- Use offline references (90% ready in external_refs/)

START: Next uncompleted task in current phase

Begin work.
```

---

## How to Use

### For Phase 0:
```
Execute Vaughan-Tauri migration work.

PROJECT: C:\Users\rb3y9\Desktop\Vaughan-Tauri\

CURRENT PHASE: Phase 0

READ FIRST:
- tasks.md (Phase 0 section)
- CONCRETE-EXAMPLES.md (code patterns)
- PHASE-0-POC.md (POC rationale)

WORK STYLE:
- Professional quality over speed
- Mark completed tasks with [x] in tasks.md
- Report failures clearly - we'll solve together
- Use offline references (90% ready in external_refs/)

START: Next uncompleted task in Phase 0

Begin work.
```

### For Phase 1:
```
Execute Vaughan-Tauri migration work.

PROJECT: C:\Users\rb3y9\Desktop\Vaughan-Tauri\

CURRENT PHASE: Phase 1

READ FIRST:
- tasks.md (Phase 1 section)
- CONCRETE-EXAMPLES.md (code patterns)
- Alloy-Cheatsheet.md, Alloy-Error-Handling.md, Tauri-State-Management.md

WORK STYLE:
- Professional quality over speed
- Mark completed tasks with [x] in tasks.md
- Report failures clearly - we'll solve together
- Use offline references (90% ready in external_refs/)

START: Next uncompleted task in Phase 1

Begin work.
```

### For Phase 2:
```
Execute Vaughan-Tauri migration work.

PROJECT: C:\Users\rb3y9\Desktop\Vaughan-Tauri\

CURRENT PHASE: Phase 2

READ FIRST:
- tasks.md (Phase 2 section)
- CONCRETE-EXAMPLES.md (code patterns)
- React-Hooks-Cheatsheet.md, TypeScript-Tauri-Integration.md, Tailwind-Utilities-Reference.md

WORK STYLE:
- Professional quality over speed
- Mark completed tasks with [x] in tasks.md
- Report failures clearly - we'll solve together
- Use offline references (90% ready in external_refs/)

START: Next uncompleted task in Phase 2

Begin work.
```

### For Phase 3:
```
Execute Vaughan-Tauri migration work.

PROJECT: C:\Users\rb3y9\Desktop\Vaughan-Tauri\

CURRENT PHASE: Phase 3

READ FIRST:
- tasks.md (Phase 3 section)
- CONCRETE-EXAMPLES.md (code patterns)
- EIP-1193.md, MetaMask-Provider-API.md

WORK STYLE:
- Professional quality over speed
- Mark completed tasks with [x] in tasks.md
- Report failures clearly - we'll solve together
- Use offline references (90% ready in external_refs/)

START: Next uncompleted task in Phase 3

Begin work.
```

---

## Why This Works

### ✅ Relies on Always-On Steering Rules

The steering file (`.kiro/steering/vaughan-tauri-rules.md`) is set to `inclusion: always`, which means:
- ✅ AI agent automatically sees all critical requirements
- ✅ AI agent automatically sees security rules
- ✅ AI agent automatically sees code quality standards
- ✅ AI agent automatically sees offline reference list
- ✅ AI agent automatically sees architecture rules

**You don't need to repeat these in the prompt!**

### ✅ Minimal and Focused

The prompt only needs to specify:
1. **What phase** (Phase 0, 1, 2, etc.)
2. **Where to start** (next uncompleted task)
3. **Work style** (quality, mark tasks, report failures)

Everything else is handled by:
- Steering rules (always-on)
- Spec documents (tasks.md, design.md, requirements.md)
- Offline references (external_refs/)

### ✅ Works for Every Phase

Same prompt structure, just change:
- `CURRENT PHASE: Phase X`
- `READ FIRST:` (phase-specific references)

---

## Even Simpler Version

If you want the absolute minimum:

```
Execute Vaughan-Tauri Phase [0/1/2/3/4/5].

PROJECT: C:\Users\rb3y9\Desktop\Vaughan-Tauri\

Start with next uncompleted task in tasks.md.
Mark completed tasks with [x].
Report failures clearly.

Begin work.
```

**This works because**:
- Steering rules are always-on (critical requirements)
- Spec documents are in the workspace (tasks.md, design.md)
- Offline references are documented (REFERENCE-INDEX.md)
- AI agent knows to read specs before starting

---

## My Recommendation

Use the **first version** (with phase-specific references) because:
- ✅ Reminds agent which offline docs to prioritize
- ✅ Explicit about reading tasks.md first
- ✅ Clear work style expectations
- ✅ Still very concise (6 lines)

But the **minimal version** works too if you prefer ultra-short prompts.

---

## Copy-Paste Ready Prompts

### Phase 0 (POC)
```
Execute Vaughan-Tauri migration work.
PROJECT: C:\Users\rb3y9\Desktop\Vaughan-Tauri\
CURRENT PHASE: Phase 0
READ FIRST: tasks.md (Phase 0), CONCRETE-EXAMPLES.md, PHASE-0-POC.md
WORK STYLE: Quality over speed, mark tasks [x], report failures
START: Next uncompleted task in Phase 0
Begin work.
```

### Phase 1 (Backend)
```
Execute Vaughan-Tauri migration work.
PROJECT: C:\Users\rb3y9\Desktop\Vaughan-Tauri\
CURRENT PHASE: Phase 1
READ FIRST: tasks.md (Phase 1), CONCRETE-EXAMPLES.md, Alloy docs
WORK STYLE: Quality over speed, mark tasks [x], report failures
START: Next uncompleted task in Phase 1
Begin work.
```

### Phase 2 (Frontend)
```
Execute Vaughan-Tauri migration work.
PROJECT: C:\Users\rb3y9\Desktop\Vaughan-Tauri\
CURRENT PHASE: Phase 2
READ FIRST: tasks.md (Phase 2), CONCRETE-EXAMPLES.md, React/Tailwind docs
WORK STYLE: Quality over speed, mark tasks [x], report failures
START: Next uncompleted task in Phase 2
Begin work.
```

### Phase 3 (dApp)
```
Execute Vaughan-Tauri migration work.
PROJECT: C:\Users\rb3y9\Desktop\Vaughan-Tauri\
CURRENT PHASE: Phase 3
READ FIRST: tasks.md (Phase 3), CONCRETE-EXAMPLES.md, EIP-1193.md
WORK STYLE: Quality over speed, mark tasks [x], report failures
START: Next uncompleted task in Phase 3
Begin work.
```

### Phase 4 (Polish)
```
Execute Vaughan-Tauri migration work.
PROJECT: C:\Users\rb3y9\Desktop\Vaughan-Tauri\
CURRENT PHASE: Phase 4
READ FIRST: tasks.md (Phase 4), test all features
WORK STYLE: Quality over speed, mark tasks [x], report failures
START: Next uncompleted task in Phase 4
Begin work.
```

### Phase 5 (Debloat)
```
Execute Vaughan-Tauri migration work.
PROJECT: C:\Users\rb3y9\Desktop\Vaughan-Tauri\
CURRENT PHASE: Phase 5
READ FIRST: tasks.md (Phase 5), remove all Iced code
WORK STYLE: Quality over speed, mark tasks [x], report failures
START: Next uncompleted task in Phase 5
Begin work.
```

---

## Summary

**Your insight is correct**: The steering rules are always-on, so you don't need to repeat critical requirements in every prompt.

**Universal prompt structure**:
1. Specify phase
2. Point to tasks.md
3. Mention work style
4. Start work

**That's it!** The steering rules handle the rest.

---

**Status**: Universal prompt created  
**Usage**: Copy-paste for any phase  
**Benefit**: Consistent, minimal, relies on always-on steering rules

**Ready to use for Phase 0!** 🚀
