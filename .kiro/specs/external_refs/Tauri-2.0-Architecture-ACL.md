# Tauri 2.0 Security Model & ACL

## Architecture Overview
Tauri Distinguishes between the **Rust Backend** (highly trusted) and the **Frontend WebView** (untrusted).
**IPC** (Inter-Process Communication) acts as the bridge.

## Access Control List (ACL)

### Capabilities
Capabilities are sets of permissions assigned to windows/webviews.
Located in: `src-tauri/capabilities/`
Format: JSON or TOML.

**Example `default.json`:**
```json
{
  "identifier": "default",
  "description": "Default capabilities for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "event:default",
    "window:default",
    "app:default"
  ]
}
```

### Permissions
Dictate which commands are accessible.
Format: `<plugin-name>:<command-name>` or `<plugin-name>:default`.
Scopes can limit arguments.

### Scopes
Fine-grained control over command behavior (e.g., allowed file paths).

## Security Best Practices
1. **Content Security Policy (CSP)**: Essential to prevent XSS.
2. **Isolation Pattern**: Use `initialization_script` to inject an API adapter, preventing direct access to Tauri IPC from the window object in untrusted environments.
3. **Validation**: Validate all inputs on the Rust side.
