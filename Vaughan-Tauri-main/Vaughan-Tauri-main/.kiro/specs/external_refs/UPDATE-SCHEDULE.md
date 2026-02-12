# External References Update Schedule

**Purpose**: Keep offline references current without constant checking

**Last Updated**: February 3, 2026

---

## 📅 Update Frequency by Reference

### 🔴 High Priority - Check Monthly

| Reference | Why Monthly | Risk if Outdated |
|-----------|-------------|------------------|
| **Alloy-Cheatsheet.md** | Alloy is pre-1.0, API changes frequently | High - Breaking changes possible |
| **Alloy-Advanced-Patterns.md** | AI-generated, needs verification | High - May contain errors |

**Action**: Check first Monday of each month during active development

---

### 🟡 Medium Priority - Check Quarterly

| Reference | Why Quarterly | Risk if Outdated |
|-----------|---------------|------------------|
| **Tauri-State-Management.md** | Tauri 2.0 is stable but evolving | Medium - Best practices may improve |
| **Tauri-2.0-Architecture-ACL.md** | Security model may get enhancements | Medium - New security features |

**Action**: Check at start of each quarter (Jan, Apr, Jul, Oct)

---

### 🟢 Low Priority - Check Annually

| Reference | Why Annually | Risk if Outdated |
|-----------|--------------|------------------|
| **EIP-1193.md** | Final standard, rarely changes | Low - Stable specification |
| **MetaMask-Provider-API.md** | Mature API, backward compatible | Low - Additions only, no breaking changes |

**Action**: Check once per year (January)

---

## 🎯 Practical Update Strategy

### During Active Development (Phases 1-5)

**Week 1 of Each Month**:
```bash
# Check Alloy for updates
1. Visit https://alloy.rs/
2. Check "What's New" or changelog
3. If major changes, update Alloy-Cheatsheet.md
4. Update "Last Updated" date
```

**First Week of Quarter**:
```bash
# Check Tauri for updates
1. Visit https://tauri.app/
2. Check release notes
3. If state management changes, update references
4. Update "Last Updated" date
```

---

## 🚨 Trigger-Based Updates (Check Immediately)

### Update When:

1. **Compilation Errors**
   - If Alloy code doesn't compile
   - If Tauri patterns fail
   - **Action**: Check official docs immediately

2. **Major Version Release**
   - Alloy 1.0 release
   - Tauri 2.1+ release
   - **Action**: Review all affected references

3. **Breaking Changes Announced**
   - Monitor GitHub releases
   - Subscribe to release notifications
   - **Action**: Update within 1 week

4. **Security Advisories**
   - CVE announcements
   - Security patches
   - **Action**: Update immediately

---

## 📊 Update Priority Matrix

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  HIGH PRIORITY (Monthly)                        │
│  ┌─────────────────────────────────────┐       │
│  │ • Alloy-Cheatsheet.md               │       │
│  │ • Alloy-Advanced-Patterns.md        │       │
│  └─────────────────────────────────────┘       │
│                                                 │
│  MEDIUM PRIORITY (Quarterly)                    │
│  ┌─────────────────────────────────────┐       │
│  │ • Tauri-State-Management.md         │       │
│  │ • Tauri-2.0-Architecture-ACL.md     │       │
│  └─────────────────────────────────────┘       │
│                                                 │
│  LOW PRIORITY (Annually)                        │
│  ┌─────────────────────────────────────┐       │
│  │ • EIP-1193.md                       │       │
│  │ • MetaMask-Provider-API.md          │       │
│  └─────────────────────────────────────┘       │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 🔔 How to Monitor for Updates

### 1. GitHub Watch (Recommended)

**Alloy**:
```bash
# Watch releases only
https://github.com/alloy-rs/alloy
→ Watch → Custom → Releases
```

**Tauri**:
```bash
# Watch releases only
https://github.com/tauri-apps/tauri
→ Watch → Custom → Releases
```

### 2. RSS Feeds

**Alloy Blog**:
- https://www.paradigm.xyz/blog (filter for Alloy)

**Tauri Blog**:
- https://tauri.app/blog/

### 3. Discord/Community

**Alloy Discord**:
- https://discord.gg/alloy (if available)

**Tauri Discord**:
- https://discord.com/invite/tauri

---

## 📝 Update Checklist

When updating a reference:

- [ ] Check official documentation for changes
- [ ] Review changelog/release notes
- [ ] Test code examples (if applicable)
- [ ] Update "Last Updated" date in file
- [ ] Update version numbers
- [ ] Note breaking changes in file
- [ ] Update VERIFICATION-COMPLETE.md
- [ ] Commit changes with clear message

---

## 🎯 Recommended Schedule for Vaughan-Tauri

### Phase 1-2 (Weeks 1-3.5)
**Check**: Weekly for Alloy (actively using)
- You're writing Alloy code daily
- Quick checks prevent wasted time

### Phase 3-4 (Weeks 4-6.5)
**Check**: Bi-weekly for Alloy, Monthly for Tauri
- Less Alloy-intensive work
- More Tauri/frontend focus

### Phase 5 (Week 7)
**Check**: Only if issues arise
- Debloat phase, minimal new code

### Post-Release (Maintenance)
**Check**: Monthly for all
- Stable codebase
- Only critical updates needed

---

## 🚀 Automation Ideas (Optional)

### Simple Bash Script

```bash
#!/bin/bash
# check-updates.sh

echo "Checking for updates..."

# Check Alloy
echo "Alloy latest release:"
curl -s https://api.github.com/repos/alloy-rs/alloy/releases/latest | grep '"tag_name"'

# Check Tauri
echo "Tauri latest release:"
curl -s https://api.github.com/repos/tauri-apps/tauri/releases/latest | grep '"tag_name"'

echo "Check complete. Review releases if needed."
```

**Usage**:
```bash
# Run monthly
./check-updates.sh
```

---

## 💡 Pro Tips

### 1. Don't Over-Update
- If code works, don't update just because
- Only update when:
  - You hit a bug
  - You need a new feature
  - Security issue announced

### 2. Version Lock During Development
- Lock Alloy version in Cargo.toml during Phases 1-4
- Update only between phases
- Prevents mid-phase breakage

```toml
[dependencies]
# Lock to specific version during development
alloy = "=0.1.4"  # Exact version

# After Phase 5, use flexible versioning
alloy = "0.1"     # Allow patch updates
```

### 3. Test Before Updating
- Create a test branch
- Update references
- Run all tests
- If pass, merge; if fail, investigate

---

## 📊 Real-World Update Frequency

Based on typical project timelines:

**7-Week Development (Vaughan-Tauri)**:
- Alloy checks: 2-3 times (Week 1, Week 4, Week 7)
- Tauri checks: 1-2 times (Week 1, Week 7)
- EIP/MetaMask: 0 times (stable standards)

**Total time spent**: ~2-3 hours over 7 weeks

---

## 🎯 TL;DR - Quick Answer

**During Development (7 weeks)**:
- **Alloy**: Check monthly (3 times total)
- **Tauri**: Check at start and end (2 times total)
- **EIP/MetaMask**: Don't check (stable)

**After Release**:
- **All**: Check quarterly or when issues arise

**Effort**: ~30 minutes per check = ~2.5 hours total

---

## 📅 Suggested Calendar

```
Week 1 (Feb 3):  ✅ Initial verification (DONE)
Week 4 (Feb 24): 🔍 Check Alloy updates
Week 7 (Mar 17): 🔍 Check Alloy + Tauri updates
Month 2:         🔍 Monthly Alloy check
Month 3:         🔍 Quarterly Tauri check
```

---

**Bottom Line**: Check Alloy monthly during development, Tauri quarterly, EIP/MetaMask annually. Total effort: ~30 min/month.

**Last Updated**: February 3, 2026  
**Next Review**: March 3, 2026 (Alloy check)
