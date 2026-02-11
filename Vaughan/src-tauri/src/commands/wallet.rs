//! Wallet Commands
//!
//! Tauri commands for wallet management operations.
//!
//! ## Security
//!
//! - All commands validate inputs
//! - Private keys never leave the backend
//! - Password required for sensitive operations
//! - Wallet must be unlocked for most operations
//!
//! ## Commands
//!
//! - `create_wallet` - Create new wallet with mnemonic
//! - `import_wallet` - Import wallet from mnemonic
//! - `unlock_wallet` - Unlock wallet with password
//! - `lock_wallet` - Lock wallet
//! - `is_wallet_locked` - Check if wallet is locked
//! - `wallet_exists` - Check if wallet exists
//! - `get_accounts` - Get all accounts
//! - `create_account` - Create new HD account
//! - `import_account` - Import account from private key
//! - `delete_account` - Delete account

use crate::core::Account;
use crate::error::WalletError;
use crate::state::VaughanState;
use tauri::{AppHandle, Emitter, Manager, State};

/// Create a new wallet with BIP-39 mnemonic
///
/// Generates a new wallet with the specified number of words.
/// The wallet starts locked - user must call `unlock_wallet` to use it.
///
/// # Arguments
///
/// * `password` - Password for encrypting the seed
/// * `word_count` - Number of words (12 or 24)
///
/// # Returns
///
/// The generated mnemonic phrase (user MUST back this up!)
///
/// # Security
///
/// - Mnemonic is only returned once
/// - User must save it securely
/// - Seed is encrypted with password and stored in OS keychain
///
/// # Example
///
/// ```typescript
/// const mnemonic = await invoke('create_wallet', {
///   password: 'my_secure_password',
///   wordCount: 12
/// });
/// console.log('BACKUP THIS MNEMONIC:', mnemonic);
/// ```
#[tauri::command]
pub async fn create_wallet(
    state: State<'_, VaughanState>,
    password: String,
    word_count: usize,
) -> Result<String, WalletError> {
    // Validate inputs
    if password.is_empty() {
        return Err(WalletError::InvalidPassword);
    }

    if word_count != 12 && word_count != 24 {
        return Err(WalletError::InvalidMnemonic(
            "Word count must be 12 or 24".to_string(),
        ));
    }

    // Create wallet
    state.wallet_service.create_wallet(&password, word_count).await
}

/// Import wallet from BIP-39 mnemonic
///
/// Restores a wallet from an existing mnemonic phrase.
/// Derives the specified number of accounts.
///
/// # Arguments
///
/// * `mnemonic` - BIP-39 mnemonic phrase
/// * `password` - Password for encrypting the seed
/// * `account_count` - Number of accounts to derive (default: 1)
///
/// # Returns
///
/// List of derived account addresses
///
/// # Example
///
/// ```typescript
/// const addresses = await invoke('import_wallet', {
///   mnemonic: 'abandon abandon abandon...',
///   password: 'my_secure_password',
///   accountCount: 3
/// });
/// ```
#[tauri::command]
pub async fn import_wallet(
    state: State<'_, VaughanState>,
    mnemonic: String,
    password: String,
    account_count: u32,
) -> Result<Vec<String>, WalletError> {
    // Validate inputs
    if password.is_empty() {
        return Err(WalletError::InvalidPassword);
    }

    if mnemonic.trim().is_empty() {
        return Err(WalletError::InvalidMnemonic("Mnemonic is empty".to_string()));
    }

    if account_count == 0 || account_count > 10 {
        return Err(WalletError::InternalError(
            "Account count must be between 1 and 10".to_string(),
        ));
    }

    // Import wallet
    let addresses = state
        .wallet_service
        .import_wallet(&mnemonic, &password, account_count)
        .await?;

    // Convert addresses to strings
    Ok(addresses.iter().map(|addr| addr.to_string()).collect())
}

/// Unlock wallet with password
///
/// Loads all account keys from keychain into memory.
/// Required before performing any operations that need keys.
///
/// # Arguments
///
/// * `password` - Wallet password
///
/// # Example
///
/// ```typescript
/// await invoke('unlock_wallet', { password: 'my_password' });
/// ```
#[tauri::command]
pub async fn unlock_wallet(
    state: State<'_, VaughanState>,
    password: String,
) -> Result<(), WalletError> {
    if password.is_empty() {
        return Err(WalletError::InvalidPassword);
    }

    state.unlock_wallet(&password).await
}

/// Lock wallet
///
/// Clears all keys from memory.
/// User must unlock again to perform key operations.
///
/// # Example
///
/// ```typescript
/// await invoke('lock_wallet');
/// ```
#[tauri::command]
pub async fn lock_wallet(state: State<'_, VaughanState>) -> Result<(), WalletError> {
    state.lock_wallet().await;
    Ok(())
}

/// Check if wallet is locked
///
/// # Returns
///
/// `true` if wallet is locked, `false` if unlocked
///
/// # Example
///
/// ```typescript
/// const locked = await invoke('is_wallet_locked');
/// if (locked) {
///   // Show unlock UI
/// }
/// ```
#[tauri::command]
pub async fn is_wallet_locked(state: State<'_, VaughanState>) -> Result<bool, WalletError> {
    Ok(state.is_locked().await)
}

/// Check if wallet exists
///
/// # Returns
///
/// `true` if wallet has been created, `false` otherwise
///
/// # Example
///
/// ```typescript
/// const exists = await invoke('wallet_exists');
/// if (!exists) {
///   // Show wallet creation UI
/// }
/// ```
#[tauri::command]
pub async fn wallet_exists(state: State<'_, VaughanState>) -> Result<bool, WalletError> {
    Ok(state.wallet_service.wallet_exists())
}

/// Get all accounts
///
/// Returns list of all accounts (HD and imported).
///
/// # Returns
///
/// List of accounts with address, name, type, and index
///
/// # Example
///
/// ```typescript
/// const accounts = await invoke('get_accounts');
/// accounts.forEach(account => {
///   console.log(`${account.name}: ${account.address}`);
/// });
/// ```
#[tauri::command]
pub async fn get_accounts(state: State<'_, VaughanState>) -> Result<Vec<Account>, WalletError> {
    state.wallet_service.get_accounts().await
}

/// Create new HD account
///
/// Derives the next account from the seed.
/// Wallet must be unlocked.
///
/// # Arguments
///
/// * `password` - Wallet password (for verification)
///
/// # Returns
///
/// The newly created account
///
/// # Example
///
/// ```typescript
/// const account = await invoke('create_account', {
///   password: 'my_password'
/// });
/// console.log('New account:', account.address);
/// ```
#[tauri::command]
pub async fn create_account(
    state: State<'_, VaughanState>,
    password: String,
) -> Result<Account, WalletError> {
    if password.is_empty() {
        return Err(WalletError::InvalidPassword);
    }

    state.wallet_service.create_account(&password).await
}

/// Import account from private key
///
/// Imports an account from a private key hex string.
/// Wallet must be unlocked.
///
/// # Arguments
///
/// * `private_key` - Private key as hex string (with or without 0x prefix)
/// * `name` - Account name
/// * `password` - Wallet password (for verification)
///
/// # Returns
///
/// The imported account
///
/// # Security
///
/// - Private key is validated before storage
/// - Private key is encrypted with password
/// - Private key is stored in OS keychain
///
/// # Example
///
/// ```typescript
/// const account = await invoke('import_account', {
///   privateKey: '0x1234...',
///   name: 'My Imported Account',
///   password: 'my_password'
/// });
/// ```
#[tauri::command]
pub async fn import_account(
    state: State<'_, VaughanState>,
    private_key: String,
    name: String,
    password: String,
) -> Result<Account, WalletError> {
    // Validate inputs
    if password.is_empty() {
        return Err(WalletError::InvalidPassword);
    }

    if private_key.trim().is_empty() {
        return Err(WalletError::InvalidPrivateKey(
            "Private key is empty".to_string(),
        ));
    }

    if name.trim().is_empty() {
        return Err(WalletError::InternalError("Account name is empty".to_string()));
    }

    // Remove 0x prefix if present
    let private_key = private_key.trim().trim_start_matches("0x");

    // Validate hex format
    if private_key.len() != 64 {
        return Err(WalletError::InvalidPrivateKey(
            "Private key must be 64 hex characters (32 bytes)".to_string(),
        ));
    }

    if !private_key.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(WalletError::InvalidPrivateKey(
            "Private key must be valid hex".to_string(),
        ));
    }

    state
        .wallet_service
        .import_account(private_key, name, &password)
        .await
}

/// Delete account
///
/// Removes an account from the wallet.
/// Cannot delete the last account.
/// Wallet must be unlocked.
///
/// # Arguments
///
/// * `address` - Account address to delete
///
/// # Example
///
/// ```typescript
/// await invoke('delete_account', {
///   address: '0x1234...'
/// });
/// ```
#[tauri::command]
pub async fn delete_account(
    state: State<'_, VaughanState>,
    address: String,
) -> Result<(), WalletError> {
    // Validate address format
    let address = address
        .parse()
        .map_err(|_| WalletError::InvalidAddress(address.clone()))?;

    // Check if this is the last account
    let accounts = state.wallet_service.get_accounts().await?;
    if accounts.len() <= 1 {
        return Err(WalletError::InternalError(
            "Cannot delete the last account".to_string(),
        ));
    }

    state.wallet_service.delete_account(&address).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_wallet_commands_integration() {
        // This is a placeholder for integration tests
        // Real tests would use a test state instance
        println!("✅ Wallet commands module compiles");
    }
}

/// Set active account
///
/// Sets the currently active account for the wallet.
/// This account will be used for balance queries, transactions, etc.
/// **PHASE 3.4**: Now emits accountsChanged event to all connected dApp windows.
///
/// # Arguments
///
/// * `app` - Tauri app handle (for event emission)
/// * `state` - Application state
/// * `address` - Account address to set as active
///
/// # Returns
///
/// * `Ok(())` - Account set successfully
/// * `Err(WalletError::InvalidAddress)` - Invalid address format
/// * `Err(WalletError::AccountNotFound)` - Account doesn't exist
///
/// # Example
///
/// ```typescript
/// await invoke('set_active_account', {
///   address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'
/// });
/// ```
#[tauri::command]
pub async fn set_active_account(
    app: AppHandle,
    state: State<'_, VaughanState>,
    address: String,
) -> Result<(), WalletError> {
    use alloy::primitives::Address;
    
    eprintln!("[Wallet] Setting active account: {}", address);
    
    // Parse and validate address
    let address: Address = address
        .parse()
        .map_err(|_| WalletError::InvalidAddress(address.clone()))?;

    // Verify account exists
    let accounts = state.wallet_service.get_accounts().await?;
    if !accounts.iter().any(|acc| acc.address == address) {
        return Err(WalletError::AccountNotFound(address.to_string()));
    }

    // Set as active
    state.set_active_account(address).await;
    
    eprintln!("[Wallet] Active account set: {}", address);

    // ========================================================================
    // Emit accountsChanged event to all dApp windows (Phase 3.4 - Task 4.1)
    // ========================================================================
    
    // Collect window labels first (avoid holding lock during emit)
    let window_labels: Vec<String> = {
        state.window_registry.get_all_labels().await
    }; // Lock released here
    
    eprintln!("[Wallet] Emitting accountsChanged to {} windows", window_labels.len());
    
    // Emit to all dApp windows (without holding lock)
    let address_str = format!("0x{:x}", address);
    for window_label in window_labels {
        if let Some(window) = app.get_webview_window(&window_label) {
            match window.emit("accountsChanged", vec![address_str.clone()]) {
                Ok(_) => eprintln!("[Wallet] Emitted accountsChanged to window: {}", window_label),
                Err(e) => eprintln!("[Wallet] Failed to emit to window {}: {}", window_label, e),
            }
        } else {
            eprintln!("[Wallet] Window not found: {}", window_label);
        }
    }

    Ok(())
}
