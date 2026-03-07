//! Wallet Service
//!
//! Manages wallet accounts, HD wallet, and secure key storage.
//!
//! ## Architecture
//!
//! The WalletService coordinates three security modules:
//! - **KeyringService**: OS keychain for secure key storage
//! - **HD Wallet**: BIP-39/BIP-32 for mnemonic and derivation
//! - **Encryption**: AES-GCM + Argon2 for password-based encryption
//!
//! ## Account Types
//!
//! 1. **HD Accounts**: Derived from seed phrase (m/44'/60'/0'/0/x)
//! 2. **Imported Accounts**: Imported from private key
//!
//! ## Security Model
//!
//! - Wallet starts **locked** (no access to keys)
//! - User must **unlock** with password to access keys
//! - Keys stored in **OS keychain** (encrypted with password)
//! - Seed phrase stored in **OS keychain** (encrypted with password)
//! - Keys wrapped in `Secret<T>` in memory
//!
//! ## Usage
//!
//! ```rust,no_run
//! use vaughan_lib::core::WalletService;
//!
//! # async fn example() -> Result<(), Box<dyn std::error::Error>> {
//! let wallet = WalletService::new()?;
//!
//! // Create new wallet with seed phrase
//! let mnemonic = wallet.create_wallet("password", 12).await?;
//!
//! // Unlock wallet
//! wallet.unlock("password").await?;
//!
//! // Get accounts
//! let accounts = wallet.get_accounts().await?;
//! # Ok(())
//! # }
//! ```

use crate::error::WalletError;
use crate::security::{
    derive_account, generate_mnemonic, mnemonic_to_seed, validate_mnemonic, KeyringService,
};
use alloy::primitives::Address;
use alloy::signers::local::PrivateKeySigner;
use secrecy::ExposeSecret;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::str::FromStr;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Account information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Account {
    /// Account address
    pub address: Address,

    /// Account name (user-defined)
    pub name: String,

    /// Account type
    pub account_type: AccountType,

    /// Derivation index (for HD accounts)
    pub index: Option<u32>,
}

/// Account type
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AccountType {
    /// HD account (derived from seed)
    Hd,
    /// Imported account (from private key)
    Imported,
}

/// Wallet Service
///
/// Manages accounts, HD wallet, and secure key storage.
pub struct WalletService {
    /// Keyring service for secure storage
    pub(crate) keyring: KeyringService,

    /// Wallet locked state
    locked: Arc<RwLock<bool>>,

    /// Cached accounts (address -> account info)
    accounts: Arc<RwLock<HashMap<Address, Account>>>,

    /// Cached signers (address -> signer) - only available when unlocked
    signers: Arc<RwLock<HashMap<Address, PrivateKeySigner>>>,

    /// Password hash (for verification) - stored in memory when unlocked
    #[allow(dead_code)]
    password_hash: Arc<RwLock<Option<String>>>,
}

impl WalletService {
    /// Create a new WalletService
    ///
    /// Initializes the keyring service and sets wallet to locked state.
    pub fn new() -> Result<Self, WalletError> {
        Self::with_service_name("vaughan-wallet")
    }

    /// Create a new WalletService with custom service name
    ///
    /// Useful for testing to avoid conflicts between tests.
    pub fn with_service_name(service_name: &str) -> Result<Self, WalletError> {
        let keyring = KeyringService::new(service_name)?;

        Ok(Self {
            keyring,
            locked: Arc::new(RwLock::new(true)),
            accounts: Arc::new(RwLock::new(HashMap::new())),
            signers: Arc::new(RwLock::new(HashMap::new())),
            password_hash: Arc::new(RwLock::new(None)),
        })
    }

    // ========================================================================
    // Wallet Management
    // ========================================================================

    /// Create a new wallet with seed phrase
    ///
    /// Generates a new BIP-39 mnemonic and derives the first account.
    ///
    /// # Arguments
    ///
    /// * `password` - Password for encrypting the seed
    /// * `word_count` - Number of words (12 or 24)
    ///
    /// # Returns
    ///
    /// The generated mnemonic phrase (user must back this up!)
    pub async fn create_wallet(
        &self,
        password: &str,
        word_count: usize,
    ) -> Result<String, WalletError> {
        // Check if wallet already exists
        if self.keyring.key_exists("seed") {
            return Err(WalletError::InternalError(
                "Wallet already exists. Use import_wallet to restore.".to_string(),
            ));
        }

        // Generate mnemonic
        let mnemonic = generate_mnemonic(word_count)?;

        // Convert to seed
        let seed = mnemonic_to_seed(&mnemonic, None)?;

        // Store seed in keychain (encrypted)
        let seed_hex = hex::encode(&seed);
        self.keyring.store_key("seed", &seed_hex, password)?;

        // Store mnemonic in keychain (encrypted) so it can be exported later
        self.keyring.store_key("mnemonic", &mnemonic, password)?;

        // Derive first account (index 0)
        let (private_key, address) = derive_account(&seed, 0)?;

        // Store first account
        let account_id = format!("account_{}", address);
        self.keyring
            .store_key(&account_id, &private_key, password)?;

        // Add to accounts list
        let account = Account {
            address,
            name: "Master Wallet".to_string(),
            account_type: AccountType::Hd,
            index: Some(0),
        };

        let mut accounts = self.accounts.write().await;
        accounts.insert(address, account.clone());
        
        // Persist account list to keyring
        let account_list: Vec<Account> = accounts.values().cloned().collect();
        let accounts_json = serde_json::to_string(&account_list)
            .map_err(|e| WalletError::InternalError(format!("Failed to serialize accounts: {}", e)))?;
        self.keyring.store_key("accounts", &accounts_json, password)?;

        // Wallet is still locked - user must unlock
        Ok(mnemonic)
    }

    /// Import wallet from mnemonic
    ///
    /// Restores wallet from existing BIP-39 mnemonic.
    ///
    /// # Arguments
    ///
    /// * `mnemonic` - BIP-39 mnemonic phrase
    /// * `password` - Password for encrypting the seed
    /// * `account_count` - Number of accounts to derive (default: 1)
    pub async fn import_wallet(
        &self,
        mnemonic: &str,
        password: &str,
        account_count: u32,
    ) -> Result<Vec<Address>, WalletError> {
        // Validate mnemonic
        validate_mnemonic(mnemonic)?;

        // Convert to seed
        let seed = mnemonic_to_seed(mnemonic, None)?;

        // Store seed in keychain (encrypted)
        let seed_hex = hex::encode(&seed);
        self.keyring.store_key("seed", &seed_hex, password)?;

        // Store mnemonic in keychain (encrypted) so it can be exported later
        self.keyring.store_key("mnemonic", mnemonic, password)?;

        // Derive accounts
        let mut addresses = Vec::new();
        let mut accounts = self.accounts.write().await;

        for index in 0..account_count {
            let (private_key, address) = derive_account(&seed, index)?;

            // Store account
            let account_id = format!("account_{}", address);
            self.keyring
                .store_key(&account_id, &private_key, password)?;

            // Add to accounts list
            let name = if index == 0 {
                "Master Wallet".to_string()
            } else {
                format!("HD Wallet {}", index + 1)
            };

            let account = Account {
                address,
                name,
                account_type: AccountType::Hd,
                index: Some(index),
            };

            accounts.insert(address, account);
            addresses.push(address);
        }
        
        // Persist account list to keyring
        let account_list: Vec<Account> = accounts.values().cloned().collect();
        let accounts_json = serde_json::to_string(&account_list)
            .map_err(|e| WalletError::InternalError(format!("Failed to serialize accounts: {}", e)))?;
        self.keyring.store_key("accounts", &accounts_json, password)?;

        Ok(addresses)
    }

    /// Check if wallet exists
    pub fn wallet_exists(&self) -> bool {
        self.keyring.key_exists("seed")
    }

    /// Export the BIP-39 mnemonic phrase
    ///
    /// Decrypts and returns the stored mnemonic phrase.
    /// Requires correct password as authentication gate.
    ///
    /// # Security
    ///
    /// - Password must match the one used to create/import the wallet
    /// - Should only be called in response to explicit user action
    pub async fn export_mnemonic(&self, password: &str) -> Result<String, WalletError> {
        if !self.keyring.key_exists("mnemonic") {
            return Err(WalletError::InternalError(
                "Mnemonic not stored. This wallet was created before export support was added. \
                 Please create a new wallet or re-import from your existing seed phrase."
                    .to_string(),
            ));
        }
        let secret = self.keyring.retrieve_key("mnemonic", password)?;
        Ok(secret.expose_secret().to_string())
    }

    // ========================================================================
    // Lock/Unlock
    // ========================================================================

    /// Unlock wallet with password
    ///
    /// Loads all account keys from keychain into memory.
    pub async fn unlock(&self, password: &str) -> Result<(), WalletError> {
        // Verify password by trying to load seed
        let seed_secret = self.keyring.retrieve_key("seed", password)?;
        let seed_hex = seed_secret.expose_secret();

        // Derive root address (index 0) for reliable migration
        let root_address = hex::decode(seed_hex.clone())
            .ok()
            .and_then(|seed_bytes| crate::security::derive_account(&seed_bytes, 0).ok())
            .map(|(_, addr)| addr);

        // Load account list from keyring (if exists)
        if self.keyring.key_exists("accounts") {
            let accounts_json_secret = self.keyring.retrieve_key("accounts", password)?;
            let accounts_json = accounts_json_secret.expose_secret();
            
            // Parse account list
            let mut account_list: Vec<Account> = serde_json::from_str(accounts_json)
                .map_err(|e| WalletError::InternalError(format!("Failed to parse accounts: {}", e)))?;
            
            // MIGRATION: Ensure Master Wallet is identified and renamed
            let mut accounts_modified = false;
            for account in &mut account_list {
                // If it's the root address, ensure it has index 0
                if let Some(root_addr) = root_address {
                    if account.address == root_addr {
                        if account.index != Some(0) {
                            account.index = Some(0);
                            accounts_modified = true;
                        }
                        
                        // Default names that should be upgraded to Master
                        if account.name == "HD Wallet 1" || account.name == "HD Wallet" {
                            account.name = "Master Wallet".to_string();
                            accounts_modified = true;
                        }
                    }
                }
            }
            
            // Load into cache
            let mut accounts = self.accounts.write().await;
            accounts.clear();
            for account in account_list {
                accounts.insert(account.address, account);
            }

            // Persist the updated names back if modified
            if accounts_modified {
                let account_list: Vec<Account> = accounts.values().cloned().collect();
                if let Ok(accounts_json) = serde_json::to_string(&account_list) {
                    let _ = self.keyring.store_key("accounts", &accounts_json, password);
                }
            }
        } else {
            // MIGRATION: Old wallet without accounts list
            // Reconstruct from seed by deriving accounts until we find all stored keys
            let seed_bytes = hex::decode(seed_hex)
                .map_err(|e| WalletError::InternalError(format!("Invalid seed hex: {}", e)))?;
            
            let mut accounts = self.accounts.write().await;
            accounts.clear();
            
            // Try to derive up to 10 accounts and check if they exist in keyring
            for index in 0..10 {
                let (_, address) = derive_account(&seed_bytes, index)
                    .map_err(|e| WalletError::InternalError(format!("Failed to derive account: {}", e)))?;
                
                let account_id = format!("account_{}", address);
                
                // Check if this account exists in keyring
                if self.keyring.key_exists(&account_id) {
                    let name = if index == 0 {
                        "Master Wallet".to_string()
                    } else {
                        format!("HD Wallet {}", index + 1)
                    };
                    
                    let account = Account {
                        address,
                        name,
                        account_type: AccountType::Hd,
                        index: Some(index),
                    };
                    accounts.insert(address, account);
                } else {
                    // No more accounts found
                    break;
                }
            }
            
            // Persist the reconstructed account list
            if !accounts.is_empty() {
                let account_list: Vec<Account> = accounts.values().cloned().collect();
                let accounts_json = serde_json::to_string(&account_list)
                    .map_err(|e| WalletError::InternalError(format!("Failed to serialize accounts: {}", e)))?;
                self.keyring.store_key("accounts", &accounts_json, password)?;
            }
        }

        // Password is correct - load all account keys
        let accounts = self.accounts.read().await;
        let mut signers = self.signers.write().await;

        for (address, _account) in accounts.iter() {
            let account_id = format!("account_{}", address);

            // Load private key from keychain
            let key_secret = self.keyring.retrieve_key(&account_id, password)?;
            let private_key = key_secret.expose_secret();

            // Create signer
            let signer = PrivateKeySigner::from_str(private_key)
                .map_err(|e| WalletError::InvalidPrivateKey(e.to_string()))?;

            signers.insert(*address, signer);
        }

        // Mark as unlocked
        *self.locked.write().await = false;

        Ok(())
    }

    /// Lock wallet
    ///
    /// Clears all keys from memory.
    pub async fn lock(&self) {
        // Clear signers from memory
        self.signers.write().await.clear();

        // Mark as locked
        *self.locked.write().await = true;
    }

    /// Check if wallet is locked
    pub async fn is_locked(&self) -> bool {
        *self.locked.read().await
    }

    /// Verify password
    ///
    /// Verifies password without unlocking the wallet.
    pub async fn verify_password(&self, password: &str) -> Result<(), WalletError> {
        // Try to load seed with password
        let _seed_secret = self.keyring.retrieve_key("seed", password)?;
        Ok(())
    }

    // ========================================================================
    // Account Management
    // ========================================================================

    /// Get all accounts
    pub async fn get_accounts(&self) -> Result<Vec<Account>, WalletError> {
        let accounts = self.accounts.read().await;
        let mut account_list: Vec<Account> = accounts.values().cloned().collect();

        // Sort to ensure deterministic order (fixes UI balance mapping issues)
        account_list.sort_by(|a, b| {
            match (&a.account_type, &b.account_type) {
                // HD always comes before Imported
                (AccountType::Hd, AccountType::Imported) => std::cmp::Ordering::Less,
                (AccountType::Imported, AccountType::Hd) => std::cmp::Ordering::Greater,
                
                // If both are HD, sort by derivation index ASC
                (AccountType::Hd, AccountType::Hd) => {
                    let idx_a = a.index.unwrap_or(u32::MAX);
                    let idx_b = b.index.unwrap_or(u32::MAX);
                    idx_a.cmp(&idx_b)
                }
                
                // If both are Imported, sort alphabetically by name ASC
                (AccountType::Imported, AccountType::Imported) => {
                    a.name.cmp(&b.name)
                }
            }
        });

        Ok(account_list)
    }

    /// Get account by address
    pub async fn get_account(&self, address: &Address) -> Result<Account, WalletError> {
        let accounts = self.accounts.read().await;
        accounts
            .get(address)
            .cloned()
            .ok_or_else(|| WalletError::AccountNotFound(address.to_string()))
    }

    /// Create new HD account (derive next account from seed)
    ///
    /// Requires wallet to be unlocked.
    pub async fn create_account(&self, password: &str) -> Result<Account, WalletError> {
        // Check if wallet is locked
        if *self.locked.read().await {
            return Err(WalletError::WalletLocked);
        }

        // Load seed
        let seed_secret = self.keyring.retrieve_key("seed", password)?;
        let seed_hex = seed_secret.expose_secret();
        let seed = hex::decode(seed_hex)
            .map_err(|e| WalletError::InternalError(format!("Invalid seed hex: {}", e)))?;

        // Find next index
        let accounts = self.accounts.read().await;
        let next_index = accounts
            .values()
            .filter(|a| a.account_type == AccountType::Hd)
            .filter_map(|a| a.index)
            .max()
            .map(|i| i + 1)
            .unwrap_or(0);

        drop(accounts); // Release read lock

        // Derive new account
        let (private_key, address) = derive_account(&seed, next_index)?;

        // Store in keychain
        let account_id = format!("account_{}", address);
        self.keyring
            .store_key(&account_id, &private_key, password)?;

        // Create signer
        let signer = PrivateKeySigner::from_str(&private_key)
            .map_err(|e| WalletError::InvalidPrivateKey(e.to_string()))?;

        // Add to accounts and signers
        let account = Account {
            address,
            name: format!("HD Wallet {}", next_index + 1),
            account_type: AccountType::Hd,
            index: Some(next_index),
        };

        let mut accounts = self.accounts.write().await;
        accounts.insert(address, account.clone());

        let mut signers = self.signers.write().await;
        signers.insert(address, signer);

        Ok(account)
    }

    /// Import account from private key
    pub async fn import_account(
        &self,
        private_key: &str,
        name: String,
        password: &str,
    ) -> Result<Account, WalletError> {
        // Create signer to validate key and get address
        let signer = PrivateKeySigner::from_str(private_key)
            .map_err(|e| WalletError::InvalidPrivateKey(e.to_string()))?;

        let address = signer.address();

        // Check if account already exists
        if self.accounts.read().await.contains_key(&address) {
            return Err(WalletError::InternalError(
                "Account already exists".to_string(),
            ));
        }

        // Store in keychain
        let account_id = format!("account_{}", address);
        self.keyring
            .store_key(&account_id, private_key, password)?;

        // Add to accounts
        let account = Account {
            address,
            name,
            account_type: AccountType::Imported,
            index: None,
        };

        let mut accounts = self.accounts.write().await;
        accounts.insert(address, account.clone());

        // If unlocked, add signer
        if !*self.locked.read().await {
            let mut signers = self.signers.write().await;
            signers.insert(address, signer);
        }

        Ok(account)
    }

    /// Delete account
    pub async fn delete_account(&self, address: &Address) -> Result<(), WalletError> {
        // Remove from accounts
        let mut accounts = self.accounts.write().await;
        accounts
            .remove(address)
            .ok_or_else(|| WalletError::AccountNotFound(address.to_string()))?;

        // Remove from signers
        let mut signers = self.signers.write().await;
        signers.remove(address);

        // Delete from keychain
        let account_id = format!("account_{}", address);
        self.keyring.delete_key(&account_id)?;

        Ok(())
    }

    /// Rename an account
    ///
    /// Requires password validation to persist the updated account list to the keyring.
    pub async fn rename_account(
        &self,
        address: &Address,
        new_name: String,
        password: &str,
    ) -> Result<(), WalletError> {
        // Validate inputs
        if new_name.trim().is_empty() {
            return Err(WalletError::InternalError("Account name cannot be empty".to_string()));
        }

        // Verify password first
        self.verify_password(password).await?;

        let mut accounts = self.accounts.write().await;
        
        // Find and update the account in memory
        if let Some(account) = accounts.get_mut(address) {
            account.name = new_name;
        } else {
            return Err(WalletError::AccountNotFound(address.to_string()));
        }

        // Snapshot current accounts and persist to OS Keychain
        let account_list: Vec<Account> = accounts.values().cloned().collect();
        let accounts_json = serde_json::to_string(&account_list)
            .map_err(|e| WalletError::InternalError(format!("Failed to serialize accounts: {}", e)))?;
        
        self.keyring.store_key("accounts", &accounts_json, password)?;

        Ok(())
    }

    // ========================================================================
    // Signing
    // ========================================================================

    /// Get signer for account
    ///
    /// Returns error if wallet is locked or account not found.
    pub async fn get_signer(&self, address: &Address) -> Result<PrivateKeySigner, WalletError> {
        // Check if wallet is locked
        if *self.locked.read().await {
            return Err(WalletError::WalletLocked);
        }

        // Get signer
        let signers = self.signers.read().await;
        signers
            .get(address)
            .cloned()
            .ok_or_else(|| WalletError::SignerNotAvailable(address.to_string()))
    }

    /// Sign a message with the specified account
    ///
    /// # Arguments
    ///
    /// * `address` - Account address to sign with
    /// * `message` - Message bytes to sign
    /// * `password` - Wallet password (to unlock if needed)
    ///
    /// # Returns
    ///
    /// * `Ok(Vec<u8>)` - Signature bytes (65 bytes: r + s + v)
    /// * `Err(WalletError)` - If signing fails
    ///
    /// # Security
    ///
    /// - Verifies password before signing
    /// - Uses Alloy's personal_sign (EIP-191)
    /// - Signature format: 65 bytes (r + s + v)
    pub async fn sign_message(
        &self,
        address: &Address,
        message: &[u8],
        password: &str,
    ) -> Result<Vec<u8>, WalletError> {
        // Verify password
        self.verify_password(password).await?;

        // Get signer
        let signer = self.get_signer(address).await?;

        // Sign message using Alloy's personal_sign (EIP-191)
        use alloy::signers::Signer;
        let signature = signer
            .sign_message(message)
            .await
            .map_err(|e| WalletError::SigningFailed(e.to_string()))?;

        // Convert signature to bytes (r + s + v format, 65 bytes)
        Ok(signature.as_bytes().to_vec())
    }

    /// Export private key for account
    ///
    /// Extacts the raw private key for a specific account.
    ///
    /// # Arguments
    ///
    /// * `address` - Account address to export
    /// * `password` - Wallet password (to unlock/authorize)
    ///
    /// # Returns
    ///
    /// * `Ok(String)` - Hex encoded private key with 0x prefix
    /// * `Err(WalletError)` - If export fails (e.g., wrong password)
    pub async fn export_private_key(
        &self,
        address: &Address,
        password: &str,
    ) -> Result<String, WalletError> {
        // Verify password
        self.verify_password(password).await?;

        // Get signer
        let signer = self.get_signer(address).await?;

        // Extract raw private key bytes
        let bytes = signer.credential().to_bytes();
        
        // Return encoded as hex string
        Ok(format!("0x{}", hex::encode(bytes)))
    }

    /// Retrieve the Railgun Deterministic Mnemonic
    ///
    /// Exposes the deterministic 24-word mnemonic for the Railgun Engine.
    ///
    /// # Security
    ///
    /// - Requires the wallet password to authorize derivation from the master seed.
    /// - Should be held ONLY in the WebWorker's memory.
    pub async fn get_railgun_mnemonic(
        &self,
        password: &str,
    ) -> Result<String, WalletError> {
        // Must be unlocked
        if *self.locked.read().await {
            return Err(WalletError::WalletLocked);
        }

        // Verify password and get master seed
        let seed_secret = self.keyring.retrieve_key("seed", password)?;
        let seed_hex = seed_secret.expose_secret();

        let seed_bytes = hex::decode(seed_hex)
            .map_err(|e| WalletError::InternalError(format!("Invalid seed hex: {}", e)))?;

        // Derive deterministic mnemonic using HD wallet
        use crate::security::hd_wallet::derive_railgun_mnemonic;

        let railgun_mnemonic = derive_railgun_mnemonic(&seed_bytes)?;

        Ok(railgun_mnemonic)
    }

    /// Wipe all wallet data
    ///
    /// Deletes the seed phrase, account list, and all private keys from the OS keychain,
    /// then clears all in-memory state and locks the wallet.
    pub async fn wipe(&self) -> Result<(), WalletError> {
        // Delete all accounts from keyring
        let accounts = self.get_accounts().await.unwrap_or_default();
        for account in accounts {
            let _ = self.keyring.delete_key(&format!("account_{}", account.address));
        }

        // Delete seed, mnemonic, and accounts list (ignore errors if they don't exist)
        if let Err(e) = self.keyring.delete_key("seed") {
            println!("Failed to delete seed: {:?}", e);
        }
        if let Err(e) = self.keyring.delete_key("mnemonic") {
            println!("Failed to delete mnemonic: {:?}", e);
        }
        if let Err(e) = self.keyring.delete_key("accounts") {
            println!("Failed to delete accounts list: {:?}", e);
        }

        // Clear memory
        self.accounts.write().await.clear();
        self.signers.write().await.clear();
        
        // Lock wallet
        *self.locked.write().await = true;

        Ok(())
    }
}

impl Default for WalletService {
    fn default() -> Self {
        Self::new().expect("Failed to create WalletService")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Helper to cleanup wallet after test
    async fn cleanup_wallet(wallet: &WalletService) {
        // Get all accounts
        if let Ok(accounts) = wallet.get_accounts().await {
            for account in accounts {
                let _ = wallet.keyring.delete_key(&format!("account_{}", account.address));
            }
        }
        // Delete seed
        let _ = wallet.keyring.delete_key("seed");
    }

    #[tokio::test]
    async fn test_wallet_service_creation() {
        let wallet = WalletService::with_service_name("test_creation").unwrap();
        assert!(wallet.is_locked().await);
        println!("✅ WalletService creation works");
    }

    #[tokio::test]
    async fn test_create_wallet() {
        let wallet = WalletService::with_service_name("test_create_wallet").unwrap();
        cleanup_wallet(&wallet).await; // Clean up from previous runs

        // Create wallet
        let mnemonic = wallet.create_wallet("test_password", 12).await.unwrap();

        // Verify mnemonic is valid
        assert!(validate_mnemonic(&mnemonic).is_ok());

        // Verify wallet exists
        assert!(wallet.wallet_exists());

        // Verify wallet is still locked
        assert!(wallet.is_locked().await);

        // Verify one account was created
        let accounts = wallet.get_accounts().await.unwrap();
        assert_eq!(accounts.len(), 1);
        assert_eq!(accounts[0].name, "HD Wallet 1");
        assert_eq!(accounts[0].account_type, AccountType::Hd);
        assert_eq!(accounts[0].index, Some(0));

        cleanup_wallet(&wallet).await;
        println!("✅ Create wallet works");
    }

    #[tokio::test]
    async fn test_unlock_lock() {
        let wallet = WalletService::with_service_name("test_unlock_lock").unwrap();
        cleanup_wallet(&wallet).await;

        // Create wallet
        let _mnemonic = wallet.create_wallet("test_password", 12).await.unwrap();

        // Unlock wallet
        wallet.unlock("test_password").await.unwrap();
        assert!(!wallet.is_locked().await);

        // Lock wallet
        wallet.lock().await;
        assert!(wallet.is_locked().await);

        cleanup_wallet(&wallet).await;
        println!("✅ Unlock/lock works");
    }

    #[tokio::test]
    async fn test_unlock_wrong_password() {
        let wallet = WalletService::with_service_name("test_wrong_password").unwrap();
        cleanup_wallet(&wallet).await;

        // Create wallet
        let _mnemonic = wallet.create_wallet("correct_password", 12).await.unwrap();

        // Try to unlock with wrong password
        let result = wallet.unlock("wrong_password").await;
        assert!(result.is_err());
        assert!(wallet.is_locked().await);

        cleanup_wallet(&wallet).await;
        println!("✅ Wrong password is rejected");
    }

    #[tokio::test]
    async fn test_create_account() {
        let wallet = WalletService::with_service_name("test_create_account").unwrap();
        cleanup_wallet(&wallet).await;

        // Create wallet
        let _mnemonic = wallet.create_wallet("test_password", 12).await.unwrap();

        // Unlock wallet
        wallet.unlock("test_password").await.unwrap();

        // Create second account
        let account2 = wallet.create_account("test_password").await.unwrap();
        assert_eq!(account2.name, "Wallet 2");
        assert_eq!(account2.account_type, AccountType::Hd);
        assert_eq!(account2.index, Some(1));

        // Verify two accounts exist
        let accounts = wallet.get_accounts().await.unwrap();
        assert_eq!(accounts.len(), 2);

        cleanup_wallet(&wallet).await;
        println!("✅ Create account works");
    }

    #[tokio::test]
    async fn test_import_account() {
        let wallet = WalletService::with_service_name("test_import_account").unwrap();
        cleanup_wallet(&wallet).await;

        // Create wallet
        let _mnemonic = wallet.create_wallet("test_password", 12).await.unwrap();

        // Unlock wallet
        wallet.unlock("test_password").await.unwrap();

        // Import account
        let private_key = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        let account = wallet
            .import_account(private_key, "Imported Account".to_string(), "test_password")
            .await
            .unwrap();

        assert_eq!(account.name, "Imported Account");
        assert_eq!(account.account_type, AccountType::Imported);
        assert_eq!(account.index, None);

        // Verify two accounts exist
        let accounts = wallet.get_accounts().await.unwrap();
        assert_eq!(accounts.len(), 2);

        cleanup_wallet(&wallet).await;
        println!("✅ Import account works");
    }

    #[tokio::test]
    async fn test_get_signer_when_locked() {
        let wallet = WalletService::with_service_name("test_signer_locked").unwrap();
        cleanup_wallet(&wallet).await;

        // Create wallet
        let _mnemonic = wallet.create_wallet("test_password", 12).await.unwrap();

        // Get accounts
        let accounts = wallet.get_accounts().await.unwrap();
        let address = accounts[0].address;

        // Try to get signer while locked
        let result = wallet.get_signer(&address).await;
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), WalletError::WalletLocked));

        cleanup_wallet(&wallet).await;
        println!("✅ Get signer when locked fails correctly");
    }

    #[tokio::test]
    async fn test_get_signer_when_unlocked() {
        let wallet = WalletService::with_service_name("test_signer_unlocked").unwrap();
        cleanup_wallet(&wallet).await;

        // Create wallet
        let _mnemonic = wallet.create_wallet("test_password", 12).await.unwrap();

        // Unlock wallet
        wallet.unlock("test_password").await.unwrap();

        // Get accounts
        let accounts = wallet.get_accounts().await.unwrap();
        let address = accounts[0].address;

        // Get signer
        let signer = wallet.get_signer(&address).await.unwrap();
        assert_eq!(signer.address(), address);

        cleanup_wallet(&wallet).await;
        println!("✅ Get signer when unlocked works");
    }
}
