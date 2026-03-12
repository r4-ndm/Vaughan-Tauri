# Tauri + React + Typescript

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Type-safe IPC (tauri-specta)

TypeScript bindings for Tauri commands are generated from Rust and live in `web/src/bindings/tauri-commands.ts`. **Do not edit that file by hand.**

- **Regenerate bindings** after changing Rust command names, arguments, or return types: from the project root run `npm run gen:bindings`. This compiles the Rust app in debug mode and writes the updated bindings (only in debug builds).
- Use `import { commands } from '../bindings/tauri-commands'` for typed `invoke` calls, or use the wrappers in `web/src/services/tauri.ts` which unwrap `Result` and map to legacy shapes where needed.

## Code hygiene & diagnostics

- **Archived tests**: Historical integration tests like `poc4_integration.rs` are kept under `src-tauri/tests/archive/` and are not part of the active test suite.
- **Future relayer/broadcaster work**: `web/src/services/broadcasters.ts` is a stub for a potential future broadcaster/relayer feature and is not currently wired into the app.
- **Railgun worker diagnostics**: High-volume diagnostics in `railgun.worker.ts` are gated behind the `VITE_DEBUG_RAILGUN` flag:
  - Set `VITE_DEBUG_RAILGUN=true` in your Vite env (for example in `.env.development`) to enable verbose IDB/BrowserLevel/Level/Fetch/XHR traces.
  - Omit this flag or set it to `false` for normal development/production to keep logs quiet while preserving warnings and errors.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
