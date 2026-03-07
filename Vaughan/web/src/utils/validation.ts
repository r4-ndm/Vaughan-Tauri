/**
 * Utility functions for user input validation
 */

/**
 * Validates if the given string is a valid Ethereum/EVM format address
 */
export function isValidAddress(address: string): boolean {
    // Matches 0x followed by exactly 40 hex characters
    const evmAddressRegex = /^0x[a-fA-F0-9]{40}$/;
    return evmAddressRegex.test(address);
}

/**
 * Validates an amount input string (allows numbers and single decimals)
 */
export function isValidAmountInput(value: string): boolean {
    if (!value) return true; // empty is valid for typing

    // Only numbers and one optional decimal point
    const amountRegex = /^\d*\.?\d*$/;
    return amountRegex.test(value);
}

/**
 * Converts a decimal string representing native token amount to a Wei string.
 * Helps validate if the amount isn't too low/high.
 */
export function parseAmountToWei(amountStr: string): string | null {
    try {
        if (!amountStr || amountStr === '.' || isNaN(Number(amountStr))) return null;

        let [integer, fraction] = amountStr.split('.');
        fraction = fraction || '';

        if (fraction.length > 18) {
            // truncate to 18 decimals
            fraction = fraction.substring(0, 18);
        }

        // pad right with zeros up to 18 total decimals
        fraction = fraction.padEnd(18, '0');

        let combined = integer + fraction;

        // Remove leading zeros
        combined = combined.replace(/^0+/, '');
        if (combined === '') combined = '0';

        // Check if it's a valid integer equivalent to what a BigInt can parse
        BigInt(combined); // Will throw if invalid

        return combined;
    } catch (e) {
        return null;
    }
}

/**
 * Checks if the required user password is valid
 */
export function isValidPassword(password: string): boolean {
    return password.length >= 8;
}
