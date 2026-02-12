//! Security Module
//!
//! This module contains all security-critical functionality for the Vaughan Wallet:
//! - OS keychain integration (secure key storage)
//! - Password-based encryption (AES-GCM + Argon2)
//! - HD wallet support (BIP-39 mnemonics, BIP-32 derivation)
//! - Account management (create, import, export)
//! - Transaction signing (Alloy signers)
//!
//! ## Security Principles
//!
//! 1. **Use ONLY Standard Libraries**: No custom crypto code
//! 2. **Secure Memory**: Use `secrecy::Secret` for sensitive data
//! 3. **OS Keychain**: Store keys in OS-provided secure storage
//! 4. **Strong Encryption**: AES-GCM with Argon2 key derivation
//! 5. **HD Wallets**: BIP-39/BIP-32 compliant
//!
//! ## Dependencies
//!
//! - `keyring` - OS keychain integration
//! - `bip39` - BIP-39 mnemonic generation
//! - `coins-bip32` - BIP-32 HD wallet derivation
//! - `aes-gcm` - AES-GCM encryption
//! - `argon2` - Argon2 key derivation
//! - `secrecy` - Secret protection in memory
//! - `alloy::signers` - Transaction signing

pub mod encryption;
pub mod hd_wallet;
pub mod keyring_service;

// Re-export main types
pub use encryption::{decrypt_data, encrypt_data, hash_password, verify_password};
pub use hd_wallet::{derive_account, generate_mnemonic, mnemonic_to_seed, validate_mnemonic};
pub use keyring_service::KeyringService;

#[cfg(test)]
mod tests {

    /// Test that all security dependencies are available
    #[test]
    fn test_security_dependencies() {
        // This test verifies that all security crates compile and link correctly
        
        // Test keyring (will test actual functionality in keyring_service tests)
        let _keyring = keyring::Entry::new("test_service", "test_user");
        
        // Test bip39
        use bip39::{Language, Mnemonic};
        use rand::RngCore;
        
        // Generate 16 bytes of entropy for 12-word mnemonic
        let mut entropy = [0u8; 16];
        rand::thread_rng().fill_bytes(&mut entropy);
        
        let mnemonic = Mnemonic::from_entropy_in(Language::English, &entropy).unwrap();
        assert_eq!(mnemonic.word_count(), 12);
        
        // Test secrecy
        use secrecy::{ExposeSecret, Secret};
        let secret = Secret::new("test_secret".to_string());
        assert_eq!(secret.expose_secret(), "test_secret");
        
        // Test rand
        use rand::Rng;
        let mut rng = rand::thread_rng();
        let _random_number: u32 = rng.gen();
        
        println!("✅ All security dependencies available");
    }
}
