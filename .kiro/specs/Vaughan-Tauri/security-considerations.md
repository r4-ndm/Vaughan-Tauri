# Security Considerations for Crypto Wallet

**CRITICAL**: Crypto wallets are high-value targets. Security must be paranoid-level.

---

## 1. Private Key Storage (CRITICAL)

### Current Approach Review Needed

**Question**: Where are private keys stored currently?
- Encrypted file on disk?
- OS keychain/credential manager?
- Memory only?

### Recommended: OS-Level Keychain

**Windows**: Windows Credential Manager
```rust
use keyring::Entry;

fn store_private_key(account: &str, encrypted_key: &[u8]) -> Result<()> {
    let entry = Entry::new("vaughan-wallet", account)?;
    entry.set_password(&base64::encode(encrypted_key))?;
    Ok(())
}

fn retrieve_private_key(account: &str) -> Result<Vec<u8>> {
    let entry = Entry::new("vaughan-wallet", account)?;
    let encoded = entry.get_password()?;
    Ok(base64::decode(encoded)?)
}
```

**Linux**: Secret Service API (GNOME Keyring, KWallet)
**macOS**: Keychain Access
**Android**: Android Keystore System

**Why**: OS-level storage is more secure than file-based storage.

### Memory Protection

```rust
use secrecy::{Secret, ExposeSecret};
use zeroize::Zeroize;

// ALWAYS use Secret<T> for sensitive data
struct PrivateKey(Secret<Vec<u8>>);

impl Drop for PrivateKey {
    fn drop(&mut self) {
        // Zeroize memory on drop
        self.0.expose_secret().zeroize();
    }
}
```

**Critical**: Never log, print, or serialize private keys.

---

## 2. Tauri-Specific Security

### 2.1 Disable DevTools in Production

**tauri.conf.json**:
```json
{
  "tauri": {
    "security": {
      "devTools": false  // CRITICAL: Disable in production
    }
  }
}
```

**Why**: DevTools can expose sensitive data and allow code injection.

### 2.2 Disable Dangerous APIs

```json
{
  "tauri": {
    "allowlist": {
      "all": false,  // Deny all by default
      "shell": {
        "all": false,
        "open": true  // Only allow opening URLs
      },
      "fs": {
        "all": false  // No filesystem access from frontend
      },
      "clipboard": {
        "all": false,
        "writeText": true,  // Only allow copying addresses
        "readText": false   // Never allow reading clipboard
      }
    }
  }
}
```

### 2.3 Context Isolation (CRITICAL)

Tauri 2.0 has this by default, but verify:

```json
{
  "tauri": {
    "security": {
      "dangerousDisableAssetCspModification": false,
      "dangerousRemoteDomainIpcAccess": []
    }
  }
}
```

**Never** add domains to `dangerousRemoteDomainIpcAccess`.

---

## 3. dApp Security (CRITICAL)

### 3.1 Phishing Protection

**Domain Verification**:
```rust
#[tauri::command]
async fn request_connection(
    window: tauri::Window,
    dapp_url: String,
) -> Result<Vec<String>, String> {
    // Parse and validate URL
    let url = Url::parse(&dapp_url)
        .map_err(|_| "Invalid URL")?;
    
    // Check against known phishing domains
    if is_known_phishing_domain(&url.host_str().unwrap_or("")) {
        return Err("⚠️ WARNING: This site is a known phishing attempt!".to_string());
    }
    
    // Check for suspicious patterns
    if looks_suspicious(&url) {
        // Show extra warning to user
        warn_user_suspicious_domain(&url)?;
    }
    
    // ... rest of connection logic
}

fn looks_suspicious(url: &Url) -> bool {
    let host = url.host_str().unwrap_or("");
    
    // Check for homograph attacks (unicode lookalikes)
    if contains_unicode_lookalikes(host) {
        return true;
    }
    
    // Check for typosquatting (uniswap.com vs uniswaap.com)
    if is_typosquatting_attempt(host) {
        return true;
    }
    
    false
}
```

### 3.2 Transaction Simulation (Recommended)

Before showing approval dialog, simulate the transaction:

```rust
use alloy::providers::Provider;

async fn simulate_transaction(
    provider: &impl Provider,
    tx: &TransactionRequest,
) -> Result<SimulationResult, Error> {
    // Use eth_call to simulate
    let result = provider.call(tx, None).await?;
    
    // Decode result to show user what will happen
    // "This transaction will transfer 100 USDC to 0x..."
    
    Ok(SimulationResult {
        success: true,
        gas_used: result.gas_used,
        state_changes: decode_state_changes(&result),
    })
}
```

**Show user**:
- What tokens will be transferred
- What approvals will be granted
- Estimated gas cost
- Any suspicious patterns

### 3.3 Approval Limits

```rust
struct DappConnection {
    url: String,
    connected_at: SystemTime,
    permissions: DappPermissions,
}

struct DappPermissions {
    max_transaction_value: U256,  // e.g., 1 ETH
    requires_approval_above: U256, // Auto-approve below this
    daily_limit: U256,
    daily_spent: U256,
}
```

**Why**: Limit damage if dApp is compromised.

---

## 4. Auto-Update Security (CRITICAL)

### 4.1 Signed Updates Only

**tauri.conf.json**:
```json
{
  "tauri": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://releases.vaughan.io/{{target}}/{{current_version}}"
      ],
      "pubkey": "YOUR_PUBLIC_KEY_HERE"  // CRITICAL: Sign all updates
    }
  }
}
```

**Generate keys**:
```bash
cargo tauri signer generate -w ~/.tauri/vaughan.key
```

**Sign releases**:
```bash
cargo tauri signer sign /path/to/app.exe
```

### 4.2 Update Verification

```rust
use tauri::updater::UpdaterBuilder;

fn setup_updater(app: &tauri::App) -> Result<()> {
    let updater = UpdaterBuilder::new()
        .build()?;
    
    // Verify signature before installing
    updater.check().await?;
    
    // Show user what's being updated
    if let Some(update) = updater.available_update() {
        show_update_dialog(
            &update.version,
            &update.body,  // Release notes
            &update.signature,  // Show signature for verification
        )?;
    }
    
    Ok(())
}
```

**Never** auto-install updates without user confirmation.

---

## 5. Rate Limiting & DoS Protection

### 5.1 Command Rate Limiting

```rust
use std::time::{Duration, Instant};
use std::collections::HashMap;

struct RateLimiter {
    requests: HashMap<String, Vec<Instant>>,
    max_requests: usize,
    window: Duration,
}

impl RateLimiter {
    fn check_rate_limit(&mut self, command: &str) -> Result<(), String> {
        let now = Instant::now();
        let requests = self.requests.entry(command.to_string()).or_default();
        
        // Remove old requests outside window
        requests.retain(|&time| now.duration_since(time) < self.window);
        
        if requests.len() >= self.max_requests {
            return Err("Rate limit exceeded. Please slow down.".to_string());
        }
        
        requests.push(now);
        Ok(())
    }
}

#[tauri::command]
async fn send_transaction(
    state: State<'_, Arc<Mutex<VaughanState>>>,
    // ...
) -> Result<String, String> {
    // Check rate limit
    let mut app_state = state.lock().await;
    app_state.rate_limiter.check_rate_limit("send_transaction")?;
    
    // ... rest of implementation
}
```

### 5.2 dApp Request Limits

```rust
struct DappConnection {
    url: String,
    request_count: usize,
    last_request: Instant,
    rate_limit: RateLimit,
}

struct RateLimit {
    max_requests_per_minute: usize,
    max_pending_approvals: usize,
}
```

**Why**: Prevent malicious dApps from spamming approval requests.

---

## 6. Secure Communication

### 6.1 RPC Endpoint Security

**Use HTTPS only**:
```rust
fn validate_rpc_url(url: &str) -> Result<(), String> {
    let parsed = Url::parse(url)
        .map_err(|_| "Invalid URL")?;
    
    // MUST be HTTPS (except localhost for development)
    if parsed.scheme() != "https" && !is_localhost(&parsed) {
        return Err("RPC endpoint must use HTTPS".to_string());
    }
    
    Ok(())
}
```

### 6.2 Certificate Pinning (Optional but Recommended)

For critical RPC endpoints:
```rust
use rustls::ClientConfig;

fn create_pinned_client(expected_cert: &[u8]) -> Result<Client> {
    let mut config = ClientConfig::new();
    config.root_store.add_pem_file(&mut expected_cert)?;
    
    // Only accept this specific certificate
    Ok(Client::builder()
        .use_preconfigured_tls(config)
        .build()?)
}
```

---

## 7. Backup & Recovery

### 7.1 Encrypted Backups

```rust
use age::Encryptor;

async fn create_encrypted_backup(
    password: &str,
    data: &WalletData,
) -> Result<Vec<u8>> {
    // Derive key from password
    let key = derive_key_from_password(password)?;
    
    // Encrypt wallet data
    let encryptor = Encryptor::with_user_passphrase(password);
    let encrypted = encryptor.wrap_output(data.serialize()?)?;
    
    Ok(encrypted)
}
```

### 7.2 Backup Verification

```rust
async fn verify_backup(backup: &[u8], password: &str) -> Result<bool> {
    // Try to decrypt and deserialize
    match decrypt_backup(backup, password) {
        Ok(data) => {
            // Verify data integrity
            data.verify_checksum()?;
            Ok(true)
        }
        Err(_) => Ok(false),
    }
}
```

**Show user**: "Backup verified successfully. Store this file safely."

---

## 8. Audit Logging (CRITICAL)

### 8.1 Security Event Logging

```rust
use tracing::{info, warn, error};

#[tauri::command]
async fn send_transaction(
    window: tauri::Window,
    state: State<'_, Arc<Mutex<VaughanState>>>,
    to: String,
    amount: String,
) -> Result<String, String> {
    // Log security-relevant events
    info!(
        window_label = %window.label(),
        to = %to,
        amount = %amount,
        "Transaction requested"
    );
    
    // ... implementation
    
    match result {
        Ok(tx_hash) => {
            info!(tx_hash = %tx_hash, "Transaction sent successfully");
            Ok(tx_hash)
        }
        Err(e) => {
            warn!(error = %e, "Transaction failed");
            Err(e.to_string())
        }
    }
}
```

**Log**:
- All transaction attempts (success and failure)
- Account imports/exports
- Password changes
- dApp connections
- Suspicious activity

**Never log**: Private keys, passwords, seed phrases

### 8.2 Tamper Detection

```rust
use sha2::{Sha256, Digest};

fn verify_binary_integrity() -> Result<()> {
    let binary_path = std::env::current_exe()?;
    let binary_data = std::fs::read(&binary_path)?;
    
    let hash = Sha256::digest(&binary_data);
    let expected_hash = include_bytes!("../binary_hash.txt");
    
    if hash.as_slice() != expected_hash {
        error!("Binary integrity check failed! Possible tampering detected.");
        return Err("Binary has been modified".into());
    }
    
    Ok(())
}
```

---

## 9. User Education & Warnings

### 9.1 First-Time Setup Warnings

Show users:
```
⚠️ SECURITY WARNINGS ⚠️

1. Never share your seed phrase with anyone
2. Vaughan will NEVER ask for your seed phrase
3. Always verify the URL of dApps you connect to
4. Be cautious of transactions you don't understand
5. Keep your password secure and unique

[ ] I understand and accept these risks
```

### 9.2 Transaction Warnings

Before signing:
```
⚠️ You are about to sign a transaction

From: 0x1234...5678
To: 0xabcd...ef01
Amount: 1.5 ETH ($3,000 USD)
Gas: 0.002 ETH ($4 USD)

dApp: app.uniswap.org ✓ Verified

This transaction will:
• Transfer 1.5 ETH to the recipient
• Cost approximately $4 in gas fees

[Cancel] [Sign Transaction]
```

### 9.3 Suspicious Activity Warnings

```
🚨 SUSPICIOUS ACTIVITY DETECTED 🚨

This dApp is requesting:
• Unlimited token approval for USDC
• Access to all your tokens

This is HIGHLY UNUSUAL and potentially dangerous.

Recommended action: REJECT this request

[Reject] [I understand the risks, proceed anyway]
```

---

## 10. Penetration Testing Checklist

Before release, test:

### 10.1 Frontend Attacks
- [ ] XSS in dApp iframe (should be blocked by CSP)
- [ ] XSS in wallet UI (should be blocked by CSP)
- [ ] CSRF attacks (should be blocked by origin verification)
- [ ] Clickjacking (should be blocked by frame-ancestors)

### 10.2 IPC Attacks
- [ ] Can dApp window call wallet commands directly? (should fail)
- [ ] Can malicious window labels bypass origin check? (should fail)
- [ ] Can frontend bypass rate limiting? (should fail)

### 10.3 Crypto Attacks
- [ ] Can private keys be extracted from memory? (should be zeroized)
- [ ] Can private keys be extracted from disk? (should be encrypted)
- [ ] Can password be brute-forced? (should use Argon2 with high cost)

### 10.4 dApp Attacks
- [ ] Phishing domain detection works?
- [ ] Transaction simulation catches malicious transactions?
- [ ] Rate limiting prevents spam?

---

## 11. Compliance & Legal

### 11.1 Privacy Policy

**Required disclosures**:
- What data is collected (RPC requests, transaction history)
- Where data is stored (local only? cloud backup?)
- Who has access (only user? third-party services?)
- How to delete data

### 11.2 Terms of Service

**Required disclaimers**:
- Software provided "as is"
- User responsible for securing seed phrase
- No liability for lost funds
- Compliance with local laws

### 11.3 Open Source Licenses

Ensure compliance with:
- Alloy license (MIT/Apache)
- Tauri license (MIT/Apache)
- All dependency licenses

---

## 12. Incident Response Plan

### 12.1 Security Vulnerability Discovered

1. **Assess severity** (critical, high, medium, low)
2. **Develop patch** (in private repository)
3. **Test patch** thoroughly
4. **Coordinate disclosure** (if third-party library)
5. **Release emergency update**
6. **Notify users** (in-app notification)
7. **Post-mortem** (what went wrong, how to prevent)

### 12.2 User Reports Compromise

1. **Verify report** (is it real?)
2. **Isolate affected accounts** (if possible)
3. **Investigate root cause**
4. **Notify other users** (if widespread)
5. **Provide recovery guidance**

---

## 13. Additional Tauri-Specific Considerations

### 13.1 Window Management Security

```rust
// Prevent window hijacking
#[tauri::command]
async fn open_dapp_browser(
    app: tauri::AppHandle,
    url: String,
) -> Result<(), String> {
    // Validate URL before opening window
    validate_url(&url)?;
    
    // Create window with restricted permissions
    tauri::WindowBuilder::new(
        &app,
        format!("dapp-{}", generate_random_id()),  // Unique label
        tauri::WindowUrl::App("dapp-browser.html".into())
    )
    .title("Vaughan dApp Browser")
    .inner_size(1200.0, 800.0)
    .resizable(true)
    .maximizable(true)
    .closable(true)
    .minimizable(true)
    // CRITICAL: Disable dangerous features
    .skip_taskbar(false)
    .always_on_top(false)
    .decorations(true)  // Keep window decorations
    .build()?;
    
    Ok(())
}
```

### 13.2 Deep Linking Security

If supporting `vaughan://` URLs:

```rust
fn handle_deep_link(url: &str) -> Result<()> {
    // Parse and validate
    let parsed = Url::parse(url)?;
    
    // Only allow specific actions
    match parsed.host_str() {
        Some("send") => {
            // vaughan://send?to=0x...&amount=1.5
            // Show confirmation dialog, never auto-send
            show_send_confirmation(&parsed)?;
        }
        Some("connect") => {
            // vaughan://connect?dapp=https://app.uniswap.org
            // Show connection dialog
            show_connection_dialog(&parsed)?;
        }
        _ => {
            return Err("Unknown deep link action".into());
        }
    }
    
    Ok(())
}
```

**Never** auto-execute transactions from deep links.

---

## Summary: Security Checklist

Before release, verify ALL of these:

**Storage**:
- [ ] Private keys use OS keychain (not files)
- [ ] Sensitive data uses `Secret<T>` and `Zeroize`
- [ ] No private keys in logs

**Tauri**:
- [ ] DevTools disabled in production
- [ ] Dangerous APIs disabled
- [ ] Context isolation enabled
- [ ] CSP configured (strict for wallet, controlled for dApp)

**dApp Security**:
- [ ] Origin verification in all commands
- [ ] Phishing domain detection
- [ ] Transaction simulation
- [ ] Rate limiting
- [ ] Approval limits

**Updates**:
- [ ] Signed updates only
- [ ] User confirmation required
- [ ] Signature verification

**Logging**:
- [ ] Security events logged
- [ ] No sensitive data in logs
- [ ] Tamper detection

**Testing**:
- [ ] Penetration testing complete
- [ ] Mock dApp test suite passes
- [ ] Security audit complete

**Legal**:
- [ ] Privacy policy
- [ ] Terms of service
- [ ] License compliance

**This is a crypto wallet. Security is not optional.**
