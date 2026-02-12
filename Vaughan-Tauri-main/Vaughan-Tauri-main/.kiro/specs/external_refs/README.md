# External References for Vaughan-Tauri

**Purpose**: Offline references for development without internet dependency

**Last Updated**: February 3, 2026

---

## 📚 Reference Status

### ✅ Verified Official Sources

| File | Source | Status | Verification |
|------|--------|--------|--------------|
| `EIP-1193.md` | [ethereum.org](https://eips.ethereum.org/EIPS/eip-1193) | ✅ VERIFIED | Official Ethereum standard |
| `MetaMask-Provider-API.md` | [MetaMask Docs](https://docs.metamask.io/) | ✅ VERIFIED | Official MetaMask documentation |
| `Tauri-2.0-Architecture-ACL.md` | [tauri.app](https://tauri.app/security/) | ✅ VERIFIED | Official Tauri v2 documentation |
| `Alloy-Cheatsheet.md` | [alloy.rs](https://alloy.rs/) | ✅ VERIFIED | Official Alloy documentation |
| `Tauri-State-Management.md` | [tauri.app](https://tauri.app/develop/state-management/) | ✅ VERIFIED | Official Tauri v2 state management |
| `React-Hooks-Cheatsheet.md` | [react.dev](https://react.dev/reference/react/hooks) | ✅ VERIFIED | Official React documentation |
| `TypeScript-Tauri-Integration.md` | [tauri.app](https://tauri.app/develop/calling-rust/) | ✅ VERIFIED | Official Tauri TypeScript integration |
| `Tailwind-Utilities-Reference.md` | [tailwindcss.com](https://tailwindcss.com/docs) | ✅ VERIFIED | Official Tailwind CSS documentation |
| `Alloy-Error-Handling.md` | [docs.rs/alloy](https://docs.rs/alloy) + [alloy.rs](https://alloy.rs/examples) | ✅ VERIFIED | Official Alloy documentation |

### ⚠️ AI-Generated (Verify Before Use)

| File | Status | Recommendation |
|------|--------|----------------|
| `Alloy-Advanced-Patterns.md` | 🔴 NOT VERIFIED | Verify against [alloy.rs](https://alloy.rs/) before using |

---

## 🎯 How to Use These References

### During Phase 1 (Backend Setup)
- **Primary**: `Alloy-Cheatsheet.md` - Basic Alloy usage
- **Primary**: `Alloy-Error-Handling.md` - Error handling patterns
- **Secondary**: `Tauri-2.0-Architecture-ACL.md` - Security model
- **Secondary**: `Tauri-State-Management.md` - State management
- **Verify**: `Alloy-Advanced-Patterns.md` patterns against official docs

### During Phase 2 (Wallet UI)
- **Primary**: `React-Hooks-Cheatsheet.md` - React hooks patterns
- **Primary**: `TypeScript-Tauri-Integration.md` - Tauri + TypeScript
- **Primary**: `Tailwind-Utilities-Reference.md` - Tailwind CSS utilities
- **Secondary**: `Tauri-State-Management.md` - Frontend-backend communication

### During Phase 3 (dApp Integration)
- **Primary**: `EIP-1193.md` - Provider standard
- **Primary**: `MetaMask-Provider-API.md` - MetaMask compatibility
- **Secondary**: Iframe security best practices

---

## 🔍 Verification Process

When using any reference:

1. **Check Status**: Is it marked as VERIFIED?
2. **Cross-Reference**: Compare with official docs
3. **Test**: Verify code compiles and works
4. **Update**: If you find errors, update the reference

---

## 📖 Official Documentation Links

### Alloy
- **Main Site**: https://alloy.rs/
- **API Docs**: https://docs.rs/alloy
- **Examples**: https://github.com/alloy-rs/examples
- **GitHub**: https://github.com/alloy-rs/alloy

### Tauri
- **Main Site**: https://tauri.app/
- **v2 Docs**: https://v2.tauri.app/
- **Security**: https://tauri.app/security/
- **GitHub**: https://github.com/tauri-apps/tauri

### Ethereum Standards
- **EIPs**: https://eips.ethereum.org/
- **EIP-1193**: https://eips.ethereum.org/EIPS/eip-1193
- **EIP-712**: https://eips.ethereum.org/EIPS/eip-712

### MetaMask
- **Docs**: https://docs.metamask.io/
- **Provider API**: https://docs.metamask.io/guide/ethereum-provider.html

---

## 🆕 Adding New References

When adding a new reference:

1. **Fetch from official source** (not AI-generated)
2. **Include source URL** in the document
3. **Mark verification status** (✅ VERIFIED or ⚠️ UNVERIFIED)
4. **Update this README** with the new reference
5. **Update REFERENCE-INDEX.md** with categorization

---

## ⚠️ Important Notes

### About AI-Generated Content
- AI-generated references are marked with 🔴 NOT VERIFIED
- Always verify against official documentation
- Use as a starting point, not as truth
- Report inaccuracies for correction

### About Official Content
- Official references are marked with ✅ VERIFIED
- Still check for version compatibility
- APIs may change between versions
- Always prefer latest official docs

---

## 📝 Maintenance

### When to Update
- When Alloy releases new version
- When Tauri releases new version
- When EIPs are updated
- When you find inaccuracies

### How to Update
1. Fetch latest official documentation
2. Update the reference file
3. Update "Last Updated" date
4. Update this README if status changes

---

## 🤝 Contributing

If you find errors or want to add references:

1. Verify against official source
2. Update the reference file
3. Mark verification status
4. Update this README
5. Document the change

---

**Remember**: When in doubt, check the official documentation!

