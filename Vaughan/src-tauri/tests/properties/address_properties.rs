use proptest::prelude::*;
use vaughan_lib::chains::evm::utils::{format_address_checksum, is_valid_address};
use alloy::primitives::Address;
use std::str::FromStr;

proptest! {
    #[test]
    fn test_address_roundtrip(bytes in proptest::array::uniform20(0u8..)) {
        let address = Address::from(bytes);
        
        // Format as checksum
        let checksum = format_address_checksum(address);
        
        // Should be valid
        prop_assert!(is_valid_address(&checksum));
        
        // Should parse back to same address
        let parsed = Address::from_str(&checksum).unwrap();
        prop_assert_eq!(address, parsed);
    }

    #[test]
    fn test_random_string_rejection(s in "[a-zA-Z0-9]{40}") {
        // If it's not a valid checksum (statistically likely for random 40 chars),
        // validate_address might accept it if it's all lowercase or all uppercase?
        // Actually validate_address enforces checksum if mixed case.
        
        let is_valid = is_valid_address(&format!("0x{}", s));
        
        // If it returns Ok, it must be a valid address
        if is_valid {
            let addr = Address::from_str(&format!("0x{}", s)).unwrap();
            // If mixed case, it must match checksum
            if s.chars().any(char::is_lowercase) && s.chars().any(char::is_uppercase) {
                prop_assert_eq!(format_address_checksum(addr), format!("0x{}", s));
            }
        }
    }
}
