//! HD Wallet Module
//!
//! Implements BIP-39 and BIP-32 compliant HD wallet functionality:
//! - **BIP-39**: Mnemonic generation and seed derivation
//! - **BIP-32**: Hierarchical Deterministic key derivation
//!
//! ## Standards Compliance
//!
//! - **BIP-39**: Mnemonic code for generating deterministic keys
//! - **BIP-32**: Hierarchical Deterministic Wallets
//! - **BIP-44**: Multi-Account Hierarchy (m/44'/60'/0'/0/x for Ethereum)
//!
//! ## Derivation Path
//!
//! We use the standard Ethereum derivation path:
//! ```text
//! m/44'/60'/0'/0/x
//! │  │   │   │  │  └─ Address index
//! │  │   │   │  └──── Change (0 = external, 1 = internal)
//! │  │   │   └─────── Account (0 = first account)
//! │  │   └─────────── Coin type (60 = Ethereum)
//! │  └─────────────── Purpose (44 = BIP-44)
//! └────────────────── Master key
//! ```
//!
//! ## Usage
//!
//! ```rust,no_run
//! use vaughan_lib::security::hd_wallet::{generate_mnemonic, mnemonic_to_seed, derive_account};
//!
//! // Generate a 12-word mnemonic
//! let mnemonic = generate_mnemonic(12)?;
//!
//! // Convert to seed
//! let seed = mnemonic_to_seed(&mnemonic, None)?;
//!
//! // Derive first account
//! let (private_key, address) = derive_account(&seed, 0)?;
//! ```

use crate::error::WalletError;
use alloy::primitives::Address;
use alloy::signers::local::PrivateKeySigner;
use bip39::{Language, Mnemonic};
use coins_bip32::{path::DerivationPath, prelude::XPriv};
use std::str::FromStr;

/// Generate a BIP-39 mnemonic
///
/// Supports 12, 15, 18, 21, or 24 words.
/// Uses English language by default.
///
/// # Arguments
///
/// * `word_count` - Number of words (12, 15, 18, 21, or 24)
///
/// # Returns
///
/// A space-separated mnemonic phrase
pub fn generate_mnemonic(word_count: usize) -> Result<String, WalletError> {
    // Calculate entropy size based on word count
    // 12 words = 128 bits = 16 bytes
    // 15 words = 160 bits = 20 bytes
    // 18 words = 192 bits = 24 bytes
    // 21 words = 224 bits = 28 bytes
    // 24 words = 256 bits = 32 bytes
    let entropy_size = match word_count {
        12 => 16,
        15 => 20,
        18 => 24,
        21 => 28,
        24 => 32,
        _ => return Err(WalletError::InvalidMnemonic(
            "Word count must be 12, 15, 18, 21, or 24".to_string()
        )),
    };
    
    // Generate random entropy
    let mut entropy = vec![0u8; entropy_size];
    use rand::RngCore;
    rand::thread_rng().fill_bytes(&mut entropy);
    
    // Create mnemonic from entropy
    let mnemonic = Mnemonic::from_entropy_in(Language::English, &entropy)
        .map_err(|e| WalletError::InvalidMnemonic(format!("Mnemonic generation failed: {}", e)))?;
    
    Ok(mnemonic.to_string())
}

/// Validate a BIP-39 mnemonic
///
/// Checks if the mnemonic is valid according to BIP-39.
pub fn validate_mnemonic(mnemonic: &str) -> Result<(), WalletError> {
    Mnemonic::from_str(mnemonic)
        .map_err(|e| WalletError::InvalidMnemonic(format!("Invalid mnemonic: {}", e)))?;
    
    Ok(())
}

/// Convert a mnemonic to a seed
///
/// Uses BIP-39 seed derivation with optional passphrase.
///
/// # Arguments
///
/// * `mnemonic` - The mnemonic phrase
/// * `passphrase` - Optional passphrase for additional security
///
/// # Returns
///
/// A 64-byte seed
pub fn mnemonic_to_seed(mnemonic: &str, passphrase: Option<&str>) -> Result<Vec<u8>, WalletError> {
    let mnemonic = Mnemonic::from_str(mnemonic)
        .map_err(|e| WalletError::InvalidMnemonic(format!("Invalid mnemonic: {}", e)))?;
    
    let seed = mnemonic.to_seed(passphrase.unwrap_or(""));
    
    Ok(seed.to_vec())
}

/// Derive an Ethereum account from a seed
///
/// Uses the standard Ethereum derivation path: m/44'/60'/0'/0/{index}
///
/// # Arguments
///
/// * `seed` - The 64-byte seed from BIP-39
/// * `index` - The account index (0 for first account, 1 for second, etc.)
///
/// # Returns
///
/// A tuple of (private_key_hex, ethereum_address)
pub fn derive_account(seed: &[u8], index: u32) -> Result<(String, Address), WalletError> {
    // Create master key from seed
    let master_key = XPriv::root_from_seed(seed, None)
        .map_err(|e| WalletError::KeyDerivationFailed(format!("Master key creation failed: {}", e)))?;
    
    // Standard Ethereum derivation path: m/44'/60'/0'/0/{index}
    let path = format!("m/44'/60'/0'/0/{}", index);
    let derivation_path = DerivationPath::from_str(&path)
        .map_err(|e| WalletError::KeyDerivationFailed(format!("Invalid derivation path: {}", e)))?;
    
    // Derive the key
    let derived_key = master_key
        .derive_path(&derivation_path)
        .map_err(|e| WalletError::KeyDerivationFailed(format!("Key derivation failed: {}", e)))?;
    
    // Get private key from XPriv
    // XPriv implements AsRef<SigningKey> where SigningKey is k256::ecdsa::SigningKey
    use coins_bip32::ecdsa::SigningKey;
    
    let signing_key: &SigningKey = derived_key.as_ref();
    
    // Get the private key bytes from the signing key
    let private_key_bytes = signing_key.to_bytes();
    let private_key_hex = hex::encode(&private_key_bytes[..]);
    
    // Create Alloy signer to get address
    let signer = PrivateKeySigner::from_str(&private_key_hex)
        .map_err(|e| WalletError::KeyDerivationFailed(format!("Signer creation failed: {}", e)))?;
    
    let address = signer.address();
    
    Ok((private_key_hex, address))
}

/// Derive multiple accounts from a seed
///
/// Convenience function to derive multiple accounts at once.
///
/// # Arguments
///
/// * `seed` - The 64-byte seed from BIP-39
/// * `count` - Number of accounts to derive
///
/// # Returns
///
/// A vector of (private_key_hex, ethereum_address) tuples
pub fn derive_accounts(seed: &[u8], count: u32) -> Result<Vec<(String, Address)>, WalletError> {
    let mut accounts = Vec::with_capacity(count as usize);
    
    for index in 0..count {
        let account = derive_account(seed, index)?;
        accounts.push(account);
    }
    
    Ok(accounts)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_mnemonic_12_words() {
        let mnemonic = generate_mnemonic(12).unwrap();
        let words: Vec<&str> = mnemonic.split_whitespace().collect();
        
        assert_eq!(words.len(), 12);
        assert!(validate_mnemonic(&mnemonic).is_ok());
        
        println!("✅ 12-word mnemonic generation works");
    }

    #[test]
    fn test_generate_mnemonic_24_words() {
        let mnemonic = generate_mnemonic(24).unwrap();
        let words: Vec<&str> = mnemonic.split_whitespace().collect();
        
        assert_eq!(words.len(), 24);
        assert!(validate_mnemonic(&mnemonic).is_ok());
        
        println!("✅ 24-word mnemonic generation works");
    }

    #[test]
    fn test_validate_mnemonic() {
        // Valid mnemonic
        let valid = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        assert!(validate_mnemonic(valid).is_ok());
        
        // Invalid mnemonic (wrong checksum)
        let invalid = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon";
        assert!(validate_mnemonic(invalid).is_err());
        
        // Invalid mnemonic (not enough words)
        let too_short = "abandon abandon abandon";
        assert!(validate_mnemonic(too_short).is_err());
        
        println!("✅ Mnemonic validation works");
    }

    #[test]
    fn test_mnemonic_to_seed() {
        let mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        
        // Without passphrase
        let seed1 = mnemonic_to_seed(mnemonic, None).unwrap();
        assert_eq!(seed1.len(), 64);
        
        // With passphrase
        let seed2 = mnemonic_to_seed(mnemonic, Some("my_passphrase")).unwrap();
        assert_eq!(seed2.len(), 64);
        
        // Different passphrases produce different seeds
        assert_ne!(seed1, seed2);
        
        // Same inputs produce same seed (deterministic)
        let seed3 = mnemonic_to_seed(mnemonic, None).unwrap();
        assert_eq!(seed1, seed3);
        
        println!("✅ Mnemonic to seed conversion works");
    }

    #[test]
    fn test_derive_account() {
        let mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        let seed = mnemonic_to_seed(mnemonic, None).unwrap();
        
        // Derive first account
        let (private_key, address) = derive_account(&seed, 0).unwrap();
        
        // Private key should be 64 hex characters (32 bytes)
        assert_eq!(private_key.len(), 64);
        
        // Address should be valid
        assert_ne!(address, Address::ZERO);
        
        // Known test vector for this mnemonic (index 0)
        // Address should be: 0x9858EfFD232B4033E47d90003D41EC34EcaEda94
        let expected_address = Address::from_str("0x9858EfFD232B4033E47d90003D41EC34EcaEda94").unwrap();
        assert_eq!(address, expected_address);
        
        println!("✅ Account derivation works (matches test vector)");
    }

    #[test]
    fn test_derive_multiple_accounts() {
        let mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        let seed = mnemonic_to_seed(mnemonic, None).unwrap();
        
        // Derive first 3 accounts
        let accounts = derive_accounts(&seed, 3).unwrap();
        
        assert_eq!(accounts.len(), 3);
        
        // All accounts should be different
        assert_ne!(accounts[0].1, accounts[1].1);
        assert_ne!(accounts[1].1, accounts[2].1);
        assert_ne!(accounts[0].1, accounts[2].1);
        
        // Deriving same index should give same result
        let (pk0, addr0) = derive_account(&seed, 0).unwrap();
        assert_eq!(accounts[0].0, pk0);
        assert_eq!(accounts[0].1, addr0);
        
        println!("✅ Multiple account derivation works");
    }

    #[test]
    fn test_derivation_is_deterministic() {
        let mnemonic = generate_mnemonic(12).unwrap();
        let seed = mnemonic_to_seed(&mnemonic, None).unwrap();
        
        // Derive same account twice
        let (pk1, addr1) = derive_account(&seed, 0).unwrap();
        let (pk2, addr2) = derive_account(&seed, 0).unwrap();
        
        // Should be identical
        assert_eq!(pk1, pk2);
        assert_eq!(addr1, addr2);
        
        println!("✅ Derivation is deterministic");
    }

    #[test]
    fn test_different_indices_produce_different_accounts() {
        let mnemonic = generate_mnemonic(12).unwrap();
        let seed = mnemonic_to_seed(&mnemonic, None).unwrap();
        
        // Derive accounts at different indices
        let (pk0, addr0) = derive_account(&seed, 0).unwrap();
        let (pk1, addr1) = derive_account(&seed, 1).unwrap();
        let (pk2, addr2) = derive_account(&seed, 2).unwrap();
        
        // All should be different
        assert_ne!(pk0, pk1);
        assert_ne!(pk1, pk2);
        assert_ne!(addr0, addr1);
        assert_ne!(addr1, addr2);
        
        println!("✅ Different indices produce different accounts");
    }
}
