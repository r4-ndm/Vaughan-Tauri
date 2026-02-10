# How to Start the App

**Error**: You're in the wrong directory!

---

## ✅ Correct Way

```bash
# Navigate to the Vaughan folder
cd Desktop\Vaughan-Tauri\Vaughan

# Then run
npm run tauri dev
```

---

## ❌ Wrong Way

```bash
# Don't run from your home directory
C:\Users\rb3y9> npm run tauri dev  # ❌ WRONG!
```

---

## 📁 Directory Structure

```
C:\Users\rb3y9\
└── Desktop\
    └── Vaughan-Tauri\
        └── Vaughan\          ← YOU NEED TO BE HERE!
            ├── package.json  ← This file must exist
            ├── src\
            ├── src-tauri\
            └── public\
```

---

## 🚀 Quick Start

**Copy and paste this**:

```bash
cd C:\Users\rb3y9\Desktop\Vaughan-Tauri\Vaughan
npm run tauri dev
```

---

## ✅ You'll Know It's Working When You See:

```
> vaughan@0.1.0 tauri
> tauri dev

Running BeforeDevCommand (`npm run dev`)

> vaughan@0.1.0 dev
> vite

VITE v7.3.1  ready in 311 ms
➜  Local:   http://localhost:1420/

Running DevCommand (`cargo run --no-default-features --color always --`)
   Compiling vaughan v0.1.0
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 28.87s
     Running `target\debug\vaughan.exe`

🚀 Initializing Vaughan Wallet...
✅ Production VaughanState initialized
✅ POC state initialized (for reference)
🌐 Starting HTTP proxy server...
✅ Proxy server started on http://localhost:8765
```

---

## 🎯 Then You Can Test

1. **Unlock wallet**: password `test123`
2. **Click "🌐 Open dApp Browser"**
3. **See the new UI!**

---

**That's it!** Just make sure you're in the right directory.
