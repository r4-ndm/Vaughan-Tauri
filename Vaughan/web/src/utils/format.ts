/**
 * Utility functions to format data for display
 */

/**
 * Truncates an Ethereum address.
 * Example: 0x1234567890abcdef1234567890abcdef12345678 -> 0x1234...5678
 * 
 * @param address The full address
 * @param startChars Number of characters to keep at start (including 0x)
 * @param endChars Number of characters to keep at end
 */
export function truncateAddress(address: string, startChars = 6, endChars = 4): string {
    if (!address) return '';
    if (address.length <= startChars + endChars) return address;

    return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Formats a native balance (in wei) to a readable string (e.g. ETH)
 * 
 * @param balanceWei The balance in wei (string or bigint)
 * @param maxDecimals Maximum number of decimals to display
 */
export function formatBalance(balanceWei: string | bigint, maxDecimals = 6): string {
    try {
        const weiAmount = typeof balanceWei === 'string' ? BigInt(balanceWei) : balanceWei;
        if (weiAmount === 0n) return '0';

        // 1 ETH = 10^18 wei
        const divisor = 10n ** 18n;

        const integerPart = weiAmount / divisor;
        const fractionalPart = weiAmount % divisor;

        if (fractionalPart === 0n) {
            return integerPart.toString();
        }

        // Pad fraction with leading zeros to 18 digits
        let fractionStr = fractionalPart.toString().padStart(18, '0');

        // Truncate to maxDecimals and remove trailing zeros
        fractionStr = fractionStr.substring(0, maxDecimals).replace(/0+$/, '');

        if (fractionStr.length === 0) {
            return integerPart.toString();
        }

        return `${integerPart}.${fractionStr}`;
    } catch (err) {
        console.error('Error formatting balance', err);
        return '0';
    }
}

/**
 * Formats a fiat currency amount
 * 
 * @param amount The USD amount
 */
export function formatCurrency(amount: number): string {
    if (isNaN(amount)) return '$0.00';

    // Show fewer decimals for larger values
    const decimals = amount >= 1000 ? 0 : amount < 0.01 ? 4 : 2;

    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(amount);
}
