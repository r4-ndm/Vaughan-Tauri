//! Keyring Service Module
//!
//! Provides secure key storage using the OS keychain:
//! - **Windows**: Credential Manager
//! - **macOS**: Keychain
//! - **Linux**: Secret Service API (libsecret)
//!
//! ## Security Properties
//!
//! - Keys stored in OS-provided secure storage
//! - Keys encrypted at rest by the OS
//! - Keys protected by user authentication
//! - Keys never written to disk in plaintext
//!
//! ## Usage
//!
//! ```rust,no_run
//! use vaughan_lib::security::KeyringService;
//!
//! // Create service
//! let keyring = KeyringService::new("vaughan-wallet")?;
//!
//! // Store a key
//! keyring.store_key("account_0", "private_key_hex", "password")?;
//!
//! // Retrieve a key
//! let key = keyring.retrieve_key("account_0", "password")?;
//!
//! // Delete a key
//! keyring.delete_key("account_0")?;
//! ```

use crate::error::WalletError;
use crate::security::encryption::{decrypt_data, encrypt_data};
use keyring::Entry;
use secrecy::Secret;

#[cfg(test)]
use secrecy::ExposeSecret;

/// KeyringService provides secure key storage using the OS keychain
///
/// Keys are encrypted with a password before being stored in the keychain,
/// providing defense-in-depth security.
pub struct KeyringService {
    service_name: String,
}

impl KeyringService {
    /// Create a new KeyringService
    ///
    /// # Arguments
    ///
    /// * `service_name` - The service name for keychain entries (e.g., "vaughan-wallet")
    pub fn new(service_name: impl Into<String>) -> Result<Self, WalletError> {
        Ok(Self {
            service_name: service_name.into(),
        })
    }
    
    /// Store a key in the OS keychain
    ///
    /// The key is encrypted with the password before storage.
    ///
    /// # Arguments
    ///
    /// * `key_id` - Unique identifier for the key (e.g., "account_0")
    /// * `private_key` - The private key to store (hex string)
    /// * `password` - Password for encryption
    pub fn store_key(
        &self,
        key_id: &str,
        private_key: &str,
        password: &str,
    ) -> Result<(), WalletError> {
        // Encrypt the private key
        let encrypted = encrypt_data(private_key.as_bytes(), password)?;
        
        // Encode as base64 for storage
        let encoded = base64::encode(&encrypted);
        
        // Store in keychain
        let entry = Entry::new(&self.service_name, key_id)
            .map_err(|e| WalletError::KeyringError(format!("Keyring entry creation failed: {}", e)))?;
        
        entry
            .set_password(&encoded)
            .map_err(|e| WalletError::KeyringError(format!("Failed to store key: {}", e)))?;
        
        Ok(())
    }
    
    /// Retrieve a key from the OS keychain
    ///
    /// The key is decrypted with the password after retrieval.
    ///
    /// # Arguments
    ///
    /// * `key_id` - Unique identifier for the key
    /// * `password` - Password for decryption
    ///
    /// # Returns
    ///
    /// The decrypted private key as a Secret<String>
    pub fn retrieve_key(
        &self,
        key_id: &str,
        password: &str,
    ) -> Result<Secret<String>, WalletError> {
        // Retrieve from keychain
        let entry = Entry::new(&self.service_name, key_id)
            .map_err(|e| WalletError::KeyringError(format!("Keyring entry creation failed: {}", e)))?;
        
        let encoded = entry
            .get_password()
            .map_err(|e| WalletError::KeyringError(format!("Failed to retrieve key: {}", e)))?;
        
        // Decode from base64
        let encrypted = base64::decode(&encoded)
            .map_err(|e| WalletError::KeyringError(format!("Invalid base64 encoding: {}", e)))?;
        
        // Decrypt
        let decrypted = decrypt_data(&encrypted, password)?;
        
        // Convert to string
        let private_key = String::from_utf8(decrypted)
            .map_err(|e| WalletError::KeyringError(format!("Invalid UTF-8: {}", e)))?;
        
        Ok(Secret::new(private_key))
    }
    
    /// Delete a key from the OS keychain
    ///
    /// # Arguments
    ///
    /// * `key_id` - Unique identifier for the key
    pub fn delete_key(&self, key_id: &str) -> Result<(), WalletError> {
        let entry = Entry::new(&self.service_name, key_id)
            .map_err(|e| WalletError::KeyringError(format!("Keyring entry creation failed: {}", e)))?;
        
        entry
            .delete_password()
            .map_err(|e| WalletError::KeyringError(format!("Failed to delete key: {}", e)))?;
        
        Ok(())
    }
    
    /// Check if a key exists in the keychain
    ///
    /// # Arguments
    ///
    /// * `key_id` - Unique identifier for the key
    pub fn key_exists(&self, key_id: &str) -> bool {
        let entry = match Entry::new(&self.service_name, key_id) {
            Ok(e) => e,
            Err(_) => return false,
        };
        
        entry.get_password().is_ok()
    }
    
    /// List all key IDs stored in the keychain
    ///
    /// Note: This is a placeholder. The keyring crate doesn't provide
    /// a way to list all entries, so we'll need to track this separately
    /// in VaughanState.
    pub fn list_keys(&self) -> Result<Vec<String>, WalletError> {
        // TODO: Implement key listing (requires separate tracking)
        Ok(Vec::new())
    }
}

// Add base64 encoding/decoding
mod base64 {
    pub fn encode(data: &[u8]) -> String {
        use base64ct::{Base64, Encoding};
        Base64::encode_string(data)
    }
    
    pub fn decode(s: &str) -> Result<Vec<u8>, base64ct::Error> {
        use base64ct::{Base64, Encoding};
        Base64::decode_vec(s)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_keyring_service_creation() {
        let keyring = KeyringService::new("test-service").unwrap();
        assert_eq!(keyring.service_name, "test-service");
        
        println!("✅ KeyringService creation works");
    }

    #[test]
    fn test_store_and_retrieve_key() {
        let keyring = KeyringService::new("test-vaughan-wallet").unwrap();
        let key_id = "test_account_0";
        let private_key = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        let password = "test_password_123";
        
        // Store key
        keyring.store_key(key_id, private_key, password).unwrap();
        
        // Retrieve key
        let retrieved = keyring.retrieve_key(key_id, password).unwrap();
        assert_eq!(retrieved.expose_secret(), private_key);
        
        // Clean up
        keyring.delete_key(key_id).unwrap();
        
        println!("✅ Store and retrieve key works");
    }

    #[test]
    fn test_retrieve_with_wrong_password() {
        let keyring = KeyringService::new("test-vaughan-wallet-2").unwrap();
        let key_id = "test_account_1";
        let private_key = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";
        let password = "correct_password";
        
        // Store key
        keyring.store_key(key_id, private_key, password).unwrap();
        
        // Try to retrieve with wrong password
        let result = keyring.retrieve_key(key_id, "wrong_password");
        assert!(result.is_err());
        
        // Clean up
        keyring.delete_key(key_id).unwrap();
        
        println!("✅ Wrong password is rejected");
    }

    #[test]
    fn test_key_exists() {
        let keyring = KeyringService::new("test-vaughan-wallet-3").unwrap();
        let key_id = "test_account_2";
        let private_key = "1111111111111111111111111111111111111111111111111111111111111111";
        let password = "password";
        
        // Clean up any leftover keys from previous test runs
        let _ = keyring.delete_key(key_id);
        
        // Key should not exist initially
        assert!(!keyring.key_exists(key_id));
        
        // Store key
        keyring.store_key(key_id, private_key, password).unwrap();
        
        // Key should exist now
        assert!(keyring.key_exists(key_id));
        
        // Delete key
        keyring.delete_key(key_id).unwrap();
        
        // Key should not exist anymore
        assert!(!keyring.key_exists(key_id));
        
        println!("✅ Key existence check works");
    }

    #[test]
    fn test_delete_nonexistent_key() {
        let keyring = KeyringService::new("test-vaughan-wallet-4").unwrap();
        let key_id = "nonexistent_key";
        
        // Deleting nonexistent key should fail gracefully
        let result = keyring.delete_key(key_id);
        assert!(result.is_err());
        
        println!("✅ Deleting nonexistent key fails gracefully");
    }
}
