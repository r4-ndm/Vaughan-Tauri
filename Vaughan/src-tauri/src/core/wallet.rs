use alloy::primitives::{Address, B256};
use alloy::signers::local::PrivateKeySigner;
use crate::error::WalletError;
use crate::models::wallet::{Account, AccountType};
use crate::security::KeyringService;
use crate::security::hd_wallet::{derive_account, generate_mnemonic, validate_mnemonic};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use secrecy::ExposeSecret;
use alloy::signers::Signer;

// ============================================================================
// Wallet Service
// ============================================================================

pub struct WalletService {
    signers: Arc<RwLock<HashMap<Address, PrivateKeySigner>>>,
    accounts: Arc<RwLock<HashMap<Address, Account>>>,
    passphrase_hash: Arc<RwLock<Option<String>>>,
    pub(crate) keyring: KeyringService,
}

impl WalletService {
    pub fn new() -> Self {
        Self {
            signers: Arc::new(RwLock::new(HashMap::new())),
            accounts: Arc::new(RwLock::new(HashMap::new())),
            passphrase_hash: Arc::new(RwLock::new(None)),
            keyring: KeyringService::new("vaughan-wallet").unwrap(),
        }
    }

    pub async fn add_signer(&self, signer: PrivateKeySigner) {
        let mut signers = self.signers.write().await;
        signers.insert(signer.address(), signer);
    }

    pub async fn add_account(&self, account: Account) {
        let mut accounts = self.accounts.write().await;
        accounts.insert(account.address, account.clone());
    }

    pub async fn get_signer(&self, address: &Address) -> Result<PrivateKeySigner, WalletError> {
        let signers = self.signers.read().await;
        signers.get(address).cloned().ok_or(WalletError::AccountNotFound(address.to_string()))
    }

    pub async fn sign_message(&self, address: &Address, message: &[u8], password: &str) -> Result<Vec<u8>, WalletError> {
        self.verify_password(password).await?;
        let signer = self.get_signer(address).await?;
        let signature = signer.sign_message(message).await.map_err(|e| WalletError::SigningFailed(e.to_string()))?;
        Ok(signature.as_bytes().to_vec())
    }

    pub async fn sign_hash(&self, address: &Address, hash: B256, password: &str) -> Result<Vec<u8>, WalletError> {
        self.verify_password(password).await?;
        let signer = self.get_signer(address).await?;
        let signature = signer.sign_hash(&hash).await.map_err(|e| WalletError::SigningFailed(e.to_string()))?;
        Ok(signature.as_bytes().to_vec())
    }

    // New function based on the provided snippet, adapted to fit the WalletService context
    pub async fn verify_password(&self, password: &str) -> Result<(), WalletError> {
        // 1. Check in-memory cache
        {
            let hash = self.passphrase_hash.read().await;
            if let Some(h) = hash.as_ref() {
                if h == password {
                    return Ok(());
                }
                return Err(WalletError::InvalidPassword);
            }
        }

        // 2. Try to verify via keychain (fallback for across restarts)
        if self.keyring.key_exists("vaughan_seed") {
            match self.keyring.retrieve_key("vaughan_seed", password) {
                Ok(_) => {
                    // Password is correct, cache it
                    self.set_password(password.to_string()).await;
                    return Ok(());
                }
                Err(WalletError::KeyringError(_)) | Err(WalletError::DecryptionFailed(_)) => {
                    return Err(WalletError::InvalidPassword);
                }
                Err(e) => return Err(e),
            }
        }

        Err(WalletError::InvalidPassword)
    }

    pub async fn unlock(&self, password: &str, accounts_to_restore: Vec<Account>) -> Result<(), WalletError> {
        // 1. Verify password (populates cache)
        self.verify_password(password).await?;
        
        // 2. Restore seed and derive HD accounts
        let mnemonic_secret = self.keyring.retrieve_key("vaughan_seed", password)?;
        let mnemonic = mnemonic_secret.expose_secret();
        let seed = crate::security::hd_wallet::mnemonic_to_seed(mnemonic, None)?;

        let mut signers = self.signers.write().await;
        let mut accounts = self.accounts.write().await;
        
        for account in accounts_to_restore {
            match account.account_type {
                AccountType::Hd => {
                    if let Some(index) = account.index {
                        if let Ok(signer) = derive_account(&seed, index) {
                            signers.insert(signer.address(), signer);
                            accounts.insert(account.address, account.clone());
                        }
                    }
                }
                AccountType::Imported => {
                    let key_id = format!("account_{}", account.address);
                    if let Ok(pk_secret) = self.keyring.retrieve_key(&key_id, password) {
                        let pk = pk_secret.expose_secret();
                        if let Ok(signer) = pk.parse::<PrivateKeySigner>() {
                            signers.insert(signer.address(), signer);
                            accounts.insert(account.address, account.clone());
                        }
                    }
                }
            }
        }
        Ok(())
    }

    pub async fn is_locked(&self) -> bool {
        self.passphrase_hash.read().await.is_none()
    }

    pub async fn lock(&self) {
        let mut hash = self.passphrase_hash.write().await;
        *hash = None;
    }

    pub async fn set_password(&self, password: String) {
        let mut hash = self.passphrase_hash.write().await;
        *hash = Some(password);
    }

    // --- Restored Methods ---

    pub fn wallet_exists(&self) -> bool {
        // Simple existence check - usually check if any key exists
        self.keyring.key_exists("vaughan_seed")
    }

    pub async fn create_wallet(&self, password: &str, word_count: usize) -> Result<String, WalletError> {
        let mnemonic = generate_mnemonic(word_count)?;
        self.keyring.store_key("vaughan_seed", &mnemonic, password)?;
        self.set_password(password.to_string()).await;
        
        // Derive and store first account
        let seed = crate::security::hd_wallet::mnemonic_to_seed(&mnemonic, None)?;
        let signer = derive_account(&seed, 0)?;
        let address = signer.address();
        self.add_signer(signer).await;
        self.add_account(Account {
            address,
            name: "Wallet 1".to_string(),
            account_type: AccountType::Hd,
            index: Some(0),
        }).await;

        Ok(mnemonic)
    }

    pub async fn import_wallet(&self, mnemonic: &str, password: &str, account_count: u32) -> Result<Vec<Address>, WalletError> {
        validate_mnemonic(mnemonic)?;
        self.keyring.store_key("vaughan_seed", mnemonic, password)?;
        self.set_password(password.to_string()).await;
        
        let mut addresses = Vec::new();
        let seed = crate::security::hd_wallet::mnemonic_to_seed(mnemonic, None)?;
        for i in 0..account_count {
            let signer = derive_account(&seed, i)?;
            let address = signer.address();
            self.add_signer(signer).await;
            let name = if i == 0 {
                "Wallet 1".to_string()
            } else {
                format!("HD Wallet {}", i + 1)
            };
            self.add_account(Account {
                address,
                name,
                account_type: AccountType::Hd,
                index: Some(i),
            }).await;
            addresses.push(address);
        }
        Ok(addresses)
    }

    pub async fn get_accounts(&self) -> Result<Vec<Account>, WalletError> {
        let accounts = self.accounts.read().await;
        Ok(accounts.values().cloned().collect())
    }

    pub async fn create_account(&self, password: &str) -> Result<Account, WalletError> {
        self.verify_password(password).await?;
        let mnemonic_secret = self.keyring.retrieve_key("vaughan_seed", password)?;
        let mnemonic = mnemonic_secret.expose_secret();
        
        // Find next index
        let signers = self.signers.read().await;
        let next_index = signers.len() as u32;
        drop(signers);

        let seed = crate::security::hd_wallet::mnemonic_to_seed(mnemonic, None)?;
        let signer = derive_account(&seed, next_index)?;
        let address = signer.address();
        self.add_signer(signer).await;

        let name = if next_index == 0 {
            "Wallet 1".to_string()
        } else {
            format!("HD Wallet {}", next_index + 1)
        };
        let account = Account {
            address,
            name,
            account_type: AccountType::Hd,
            index: Some(next_index),
        };
        self.add_account(account.clone()).await;

        Ok(account)
    }

    pub async fn import_account(&self, private_key: &str, name: String, password: &str) -> Result<Account, WalletError> {
        self.verify_password(password).await?;
        let signer: PrivateKeySigner = private_key.parse().map_err(|_| WalletError::InvalidPrivateKey("Invalid private key hex".to_string()))?;
        let address = signer.address();
        // Store in keychain
        let key_id = format!("account_{}", address);
        self.keyring.store_key(&key_id, private_key, password)?;

        self.add_signer(signer).await;
        
        let account = Account {
            address,
            name: name,
            account_type: AccountType::Imported,
            index: None,
        };
        self.add_account(account.clone()).await;
        
        Ok(account)
    }

    pub async fn delete_account(&self, address: &Address) -> Result<(), WalletError> {
        let mut signers = self.signers.write().await;
        signers.remove(address).ok_or(WalletError::AccountNotFound(address.to_string()))?;
        let mut accounts = self.accounts.write().await;
        accounts.remove(address);
        Ok(())
    }

    pub async fn rename_account(&self, address: &Address, new_name: String, password: &str) -> Result<(), WalletError> {
        self.verify_password(password).await?;
        let mut accounts = self.accounts.write().await;
        let account = accounts.get_mut(address).ok_or(WalletError::AccountNotFound(address.to_string()))?;
        account.name = new_name;
        Ok(())
    }

    pub async fn export_private_key(&self, address: &Address, password: &str) -> Result<String, WalletError> {
        self.verify_password(password).await?;
        let signer = self.get_signer(address).await?;
        Ok(format!("0x{}", hex::encode(signer.to_bytes())))
    }

    pub async fn export_mnemonic(&self, password: &str) -> Result<String, WalletError> {
        self.verify_password(password).await?;
        let mnemonic_secret = self.keyring.retrieve_key("vaughan_seed", password)?;
        Ok(mnemonic_secret.expose_secret().clone())
    }

    pub async fn get_railgun_mnemonic(&self, password: &str) -> Result<String, WalletError> {
        self.verify_password(password).await?;
        // For POC, return same mnemonic. Real version would derive a separate one.
        self.export_mnemonic(password).await
    }

    pub async fn wipe(&self) -> Result<(), WalletError> {
        let mut signers = self.signers.write().await;
        signers.clear();
        let mut accounts = self.accounts.write().await;
        accounts.clear();
        let mut pass = self.passphrase_hash.write().await;
        *pass = None;
        let _ = self.keyring.delete_key("vaughan_seed");
        Ok(())
    }
}
