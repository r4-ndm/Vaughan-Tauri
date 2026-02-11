/**
 * Formatting utilities for addresses, balances, and currency values
 */

/**
 * Truncates an Ethereum address for display
 * @param address - Full Ethereum address (0x...)
 * @param startChars - Number of characters to show at start (default: 6)
 * @param endChars - Number of characters to show at end (default: 4)
 * @returns Truncated address (e.g., "0x1234...5678")
 */
export function formatAddress(
  address: string,
  startChars: number = 6,
  endChars: number = 4
): string {
  if (!address) return '';
  if (address.length <= startChars + endChars) return address;
  
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Formats a balance from wei to a human-readable format
 * @param balance - Balance in wei (as string)
 * @param decimals - Token decimals (default: 18 for ETH)
 * @param maxDecimals - Maximum decimal places to show (default: 6)
 * @returns Formatted balance string
 */
export function formatBalance(
  balance: string,
  decimals: number = 18,
  maxDecimals: number = 6
): string {
  if (!balance || balance === '0') return '0';
  
  try {
    const value = BigInt(balance);
    const divisor = BigInt(10 ** decimals);
    const integerPart = value / divisor;
    const fractionalPart = value % divisor;
    
    if (fractionalPart === BigInt(0)) {
      return integerPart.toString();
    }
    
    // Convert fractional part to string with leading zeros
    const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    
    // Trim trailing zeros and limit decimal places
    const trimmed = fractionalStr.replace(/0+$/, '').slice(0, maxDecimals);
    
    if (trimmed === '') {
      return integerPart.toString();
    }
    
    return `${integerPart}.${trimmed}`;
  } catch (error) {
    console.error('Error formatting balance:', error);
    return '0';
  }
}

/**
 * Formats a USD amount with proper currency formatting
 * @param amount - Amount in USD
 * @param decimals - Decimal places to show (default: 2)
 * @returns Formatted USD string (e.g., "$1,234.56")
 */
export function formatUSD(amount: number, decimals: number = 2): string {
  if (isNaN(amount)) return '$0.00';
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

/**
 * Formats a number with thousands separators
 * @param value - Number to format
 * @param decimals - Decimal places to show (default: 2)
 * @returns Formatted number string (e.g., "1,234.56")
 */
export function formatNumber(value: number, decimals: number = 2): string {
  if (isNaN(value)) return '0';
  
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Formats a timestamp to a human-readable date/time
 * @param timestamp - Unix timestamp (seconds)
 * @param includeTime - Whether to include time (default: true)
 * @returns Formatted date string
 */
export function formatDate(timestamp: number, includeTime: boolean = true): string {
  const date = new Date(timestamp * 1000);
  
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };
  
  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
  }
  
  return new Intl.DateTimeFormat('en-US', options).format(date);
}

/**
 * Formats a relative time (e.g., "2 hours ago")
 * @param timestamp - Unix timestamp (seconds)
 * @returns Relative time string
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const then = timestamp * 1000;
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
  
  return formatDate(timestamp, false);
}

/**
 * Formats a transaction hash for display
 * @param hash - Transaction hash
 * @returns Truncated hash (e.g., "0x1234...5678")
 */
export function formatTxHash(hash: string): string {
  return formatAddress(hash, 10, 8);
}

/**
 * Formats gas price from wei to Gwei
 * @param gasPrice - Gas price in wei (as string)
 * @returns Formatted gas price in Gwei
 */
export function formatGasPrice(gasPrice: string): string {
  const gwei = formatBalance(gasPrice, 9, 2); // 9 decimals for Gwei
  return `${gwei} Gwei`;
}
