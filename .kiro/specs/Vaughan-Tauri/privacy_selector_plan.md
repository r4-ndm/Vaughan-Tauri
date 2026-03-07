# Privacy Selector Implementation Plan

The user wants to add a "privacy selector" option at launch to potentially make the wallet run faster by disabling privacy features (Railgun). Disabling the Railgun engine skips WASM loading, database initialization, and background blockchain scanning, which can significantly reduce startup time and resource usage.

> [!NOTE]
> **Plan Review Conclusion**: This plan is solidly architected and **does not add unnecessary bloat**. 
> - The `UserPreferences` struct and `StateManager` already exist in `persistence.rs`, so adding a single boolean is practically zero cost.
> - Tauri commands are extremely fast, so fetching preferences during the `initEngine` sequence won't noticeably delay startup.
> - The worker architecture means that keeping it disabled completely circumvents the heavy WASM initialization.

> [!IMPORTANT]
> When privacy is disabled, the Railgun "Shadow Engine" will be completely skipped. This means **no background scanning, no network sync, and no database activity** for the privacy layer will occur. The system will be idle regarding privacy functions.

## Proposed Changes

### Backend (Rust)

#### [MODIFY] [persistence.rs](file:///c:/Users/rb3y9/Desktop/Vaughan-Tauri/Vaughan/src-tauri/src/core/persistence.rs)
- Add `privacy_enabled: bool` to the `UserPreferences` struct.
- Update `Default` implementation for `UserPreferences` to set `privacy_enabled` to `true`.

#### [MODIFY] [persistence.rs](file:///c:/Users/rb3y9/Desktop/Vaughan-Tauri/Vaughan/src-tauri/src/commands/persistence.rs)
- Add `get_user_preferences` command to expose all settings to the frontend.
- Add `update_user_preferences` command to allow the frontend to save modified settings.

#### [MODIFY] [lib.rs](file:///c:/Users/rb3y9/Desktop/Vaughan-Tauri/Vaughan/src-tauri/src/lib.rs)
- Register `get_user_preferences` and `update_user_preferences` in the `invoke_handler`.

---

### Frontend (React/TypeScript)

#### [MODIFY] [Settings.tsx](file:///c:/Users/rb3y9/Desktop/Vaughan-Tauri/Vaughan/web/src/pages/Settings.tsx)
- Add a "Privacy & Performance" section.
- Add a toggle switch for "Shadow Engine (Railgun Privacy)".
- **UI Improvement**: When toggled, show a helper text: *"Changing this setting requires an app restart to take full effect."* Unloading an active WASM worker gracefully is complex, so a restart is the safest and least bloated approach.
- Use a `useQuery` and `useMutation` to fetch and update these settings via the new backend commands.

#### [MODIFY] [railgunWorkerClient.ts](file:///c:/Users/rb3y9/Desktop/Vaughan-Tauri/Vaughan/web/src/services/railgunWorkerClient.ts)
- Update `initEngine` to fetch the `privacy_enabled` preference from the backend before starting the worker.
- If `privacy_enabled` is `false`, log a message and skip initialization.

## Verification Plan

### Automated Tests
- Run Rust tests to ensure persistence logic is correct:
  ```powershell
  cd Vaughan/src-tauri
  cargo test core::persistence
  ```

### Manual Verification
1. **Initial State Check**:
   - Verify Railgun initializes normally on startup (check console logs for "[RailgunClient] Shadow Engine initialized successfully").
2. **Disable Privacy**:
   - Go to **Settings** -> **Privacy & Performance**.
   - Toggle **Shadow Engine** to **OFF**.
3. **Restart/Reload Verification**:
   - Refresh the page or restart the app.
   - Verify the console logs show "[RailgunClient] Skipping Railgun engine initialization - Privacy is disabled in settings."
   - Verify that "Shield" or "Unshield" actions in the UI are either hidden or show a "Privacy Disabled" message.
4. **Re-enable Privacy**:
   - Toggle **Shadow Engine** back to **ON**.
   - Verify Railgun initializes immediately or on next action.
