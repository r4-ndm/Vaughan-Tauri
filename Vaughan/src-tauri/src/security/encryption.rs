//! Encryption Module
//!
//! Provides password-based encryption using industry-standard algorithms:
//! - **Argon2** for password hashing and key derivation
//! - **AES-GCM** for authenticated encryption (AEAD)
//!
//! ## Security Properties
//!
//! - **Argon2id**: Memory-hard password hashing (resistant to GPU attacks)
//! - **AES-256-GCM**: Authenticated encryption with associated data
//! - **Secure Random**: Uses OS-provided randomness
//! - **No Custom Crypto**: Uses audited crates only
//!
//! ## Usage
//!
//! ```rust,no_run
//! use vaughan_lib::security::encryption::{hash_password, encrypt_data, decrypt_data};
//!
//! // Hash a password
//! let password = "my_secure_password";
//! let hash = hash_password(password)?;
//!
//! // Encrypt data
//! let plaintext = b"sensitive data";
//! let ciphertext = encrypt_data(plaintext, password)?;
//!
//! // Decrypt data
//! let decrypted = decrypt_data(&ciphertext, password)?;
//! assert_eq!(plaintext, &decrypted[..]);
//! ```

use crate::error::WalletError;
use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use argon2::{
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use rand::RngCore;

/// Hash a password using Argon2id
///
/// Uses Argon2id with recommended parameters:
/// - Memory: 19 MiB
/// - Iterations: 2
/// - Parallelism: 1
///
/// Returns a PHC string that includes the salt and parameters.
pub fn hash_password(password: &str) -> Result<String, WalletError> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    
    let password_hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| WalletError::EncryptionFailed(format!("Password hashing failed: {}", e)))?;
    
    Ok(password_hash.to_string())
}

/// Verify a password against a hash
///
/// Returns `Ok(())` if the password matches, `Err` otherwise.
pub fn verify_password(password: &str, hash: &str) -> Result<(), WalletError> {
    let parsed_hash = PasswordHash::new(hash)
        .map_err(|e| WalletError::EncryptionFailed(format!("Invalid hash format: {}", e)))?;
    
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .map_err(|_| WalletError::InvalidPassword)
}

/// Derive an encryption key from a password using Argon2
///
/// Returns a 32-byte key suitable for AES-256.
fn derive_key(password: &str, salt: &[u8]) -> Result<[u8; 32], WalletError> {
    use argon2::Params;
    
    let params = Params::new(19456, 2, 1, Some(32))
        .map_err(|e| WalletError::EncryptionFailed(format!("Invalid Argon2 params: {}", e)))?;
    
    let argon2 = Argon2::new(argon2::Algorithm::Argon2id, argon2::Version::V0x13, params);
    
    let mut key = [0u8; 32];
    argon2
        .hash_password_into(password.as_bytes(), salt, &mut key)
        .map_err(|e| WalletError::EncryptionFailed(format!("Key derivation failed: {}", e)))?;
    
    Ok(key)
}

/// Encrypt data using AES-256-GCM with password-derived key
///
/// Format: [salt (16 bytes)][nonce (12 bytes)][ciphertext + tag]
///
/// The salt is used for key derivation, and the nonce is used for encryption.
/// Both are randomly generated and prepended to the ciphertext.
pub fn encrypt_data(plaintext: &[u8], password: &str) -> Result<Vec<u8>, WalletError> {
    // Generate random salt for key derivation
    let mut salt = [0u8; 16];
    OsRng.fill_bytes(&mut salt);
    
    // Derive encryption key from password
    let key = derive_key(password, &salt)?;
    
    // Create cipher
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| WalletError::EncryptionFailed(format!("Cipher creation failed: {}", e)))?;
    
    // Generate random nonce
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    
    // Encrypt
    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|e| WalletError::EncryptionFailed(format!("Encryption failed: {}", e)))?;
    
    // Combine: salt + nonce + ciphertext
    let mut result = Vec::with_capacity(salt.len() + nonce_bytes.len() + ciphertext.len());
    result.extend_from_slice(&salt);
    result.extend_from_slice(&nonce_bytes);
    result.extend_from_slice(&ciphertext);
    
    Ok(result)
}

/// Decrypt data using AES-256-GCM with password-derived key
///
/// Expects format: [salt (16 bytes)][nonce (12 bytes)][ciphertext + tag]
pub fn decrypt_data(encrypted: &[u8], password: &str) -> Result<Vec<u8>, WalletError> {
    // Validate minimum length
    if encrypted.len() < 16 + 12 + 16 {
        return Err(WalletError::DecryptionFailed(
            "Encrypted data too short".to_string(),
        ));
    }
    
    // Extract salt, nonce, and ciphertext
    let salt = &encrypted[0..16];
    let nonce_bytes = &encrypted[16..28];
    let ciphertext = &encrypted[28..];
    
    // Derive encryption key from password
    let key = derive_key(password, salt)?;
    
    // Create cipher
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| WalletError::DecryptionFailed(format!("Cipher creation failed: {}", e)))?;
    
    let nonce = Nonce::from_slice(nonce_bytes);
    
    // Decrypt
    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| WalletError::DecryptionFailed("Decryption failed (wrong password?)".to_string()))?;
    
    Ok(plaintext)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_password_hashing() {
        let password = "my_secure_password_123";
        
        // Hash password
        let hash = hash_password(password).unwrap();
        
        // Verify correct password
        assert!(verify_password(password, &hash).is_ok());
        
        // Verify wrong password fails
        assert!(verify_password("wrong_password", &hash).is_err());
        
        println!("✅ Password hashing works");
    }

    #[test]
    fn test_encryption_decryption() {
        let password = "encryption_password_456";
        let plaintext = b"This is sensitive data that needs encryption";
        
        // Encrypt
        let ciphertext = encrypt_data(plaintext, password).unwrap();
        
        // Verify ciphertext is different from plaintext
        assert_ne!(&ciphertext[28..], plaintext);
        
        // Decrypt with correct password
        let decrypted = decrypt_data(&ciphertext, password).unwrap();
        assert_eq!(plaintext, &decrypted[..]);
        
        // Decrypt with wrong password should fail
        assert!(decrypt_data(&ciphertext, "wrong_password").is_err());
        
        println!("✅ Encryption/decryption works");
    }

    #[test]
    fn test_encryption_produces_different_ciphertexts() {
        let password = "same_password";
        let plaintext = b"same plaintext";
        
        // Encrypt same data twice
        let ciphertext1 = encrypt_data(plaintext, password).unwrap();
        let ciphertext2 = encrypt_data(plaintext, password).unwrap();
        
        // Ciphertexts should be different (different salts/nonces)
        assert_ne!(ciphertext1, ciphertext2);
        
        // But both should decrypt to same plaintext
        let decrypted1 = decrypt_data(&ciphertext1, password).unwrap();
        let decrypted2 = decrypt_data(&ciphertext2, password).unwrap();
        assert_eq!(decrypted1, decrypted2);
        assert_eq!(plaintext, &decrypted1[..]);
        
        println!("✅ Encryption produces different ciphertexts (good!)");
    }

    #[test]
    fn test_decrypt_invalid_data() {
        let password = "password";
        
        // Too short
        let short_data = vec![0u8; 10];
        assert!(decrypt_data(&short_data, password).is_err());
        
        // Invalid ciphertext
        let invalid_data = vec![0u8; 100];
        assert!(decrypt_data(&invalid_data, password).is_err());
        
        println!("✅ Decryption rejects invalid data");
    }

    #[test]
    fn test_key_derivation_deterministic() {
        let password = "test_password";
        let salt = [42u8; 16];
        
        // Derive key twice with same inputs
        let key1 = derive_key(password, &salt).unwrap();
        let key2 = derive_key(password, &salt).unwrap();
        
        // Keys should be identical
        assert_eq!(key1, key2);
        
        // Different salt should produce different key
        let different_salt = [43u8; 16];
        let key3 = derive_key(password, &different_salt).unwrap();
        assert_ne!(key1, key3);
        
        println!("✅ Key derivation is deterministic");
    }
}
