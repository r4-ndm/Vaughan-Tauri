/**
 * Input validation utilities for addresses, amounts, and other user inputs
 */

/**
 * Validates an Ethereum address
 * @param address - Address to validate
 * @returns true if valid, false otherwise
 */
export function validateAddress(address: string): boolean {
  if (!address) return false;
  
  // Basic format check: starts with 0x and is 42 characters long
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return false;
  }
  
  return true;
}

/**
 * Validates a transaction amount
 * @param amount - Amount to validate (as string)
 * @param maxDecimals - Maximum decimal places allowed (default: 18)
 * @returns true if valid, false otherwise
 */
export function validateAmount(amount: string, maxDecimals: number = 18): boolean {
  if (!amount || amount.trim() === '') return false;
  
  // Remove leading/trailing whitespace
  amount = amount.trim();
  
  // Check for valid number format
  if (!/^\d+(\.\d+)?$/.test(amount)) {
    return false;
  }
  
  // Check for negative or zero
  const value = parseFloat(amount);
  if (value <= 0 || isNaN(value)) {
    return false;
  }
  
  // Check decimal places
  const parts = amount.split('.');
  if (parts.length === 2 && parts[1].length > maxDecimals) {
    return false;
  }
  
  return true;
}

/**
 * Validates that an amount doesn't exceed the available balance
 * @param amount - Amount to send (as string)
 * @param balance - Available balance (as string, in wei)
 * @param decimals - Token decimals (default: 18)
 * @returns true if amount <= balance, false otherwise
 */
export function validateBalanceSufficient(
  amount: string,
  balance: string,
  decimals: number = 18
): boolean {
  if (!validateAmount(amount)) return false;
  
  try {
    // Convert amount to wei
    const [integerPart, fractionalPart = ''] = amount.split('.');
    const paddedFractional = fractionalPart.padEnd(decimals, '0');
    const amountWei = BigInt(integerPart + paddedFractional);
    
    // Compare with balance
    const balanceWei = BigInt(balance);
    
    return amountWei <= balanceWei;
  } catch (error) {
    console.error('Error validating balance:', error);
    return false;
  }
}

/**
 * Validates a gas limit value
 * @param gasLimit - Gas limit to validate
 * @returns true if valid, false otherwise
 */
export function validateGasLimit(gasLimit: string): boolean {
  if (!gasLimit || gasLimit.trim() === '') return false;
  
  // Must be a positive integer
  if (!/^\d+$/.test(gasLimit.trim())) {
    return false;
  }
  
  const value = parseInt(gasLimit, 10);
  
  // Reasonable bounds: 21000 (minimum) to 10M (very high)
  if (value < 21000 || value > 10_000_000) {
    return false;
  }
  
  return true;
}

/**
 * Validates a gas price value (in Gwei)
 * @param gasPrice - Gas price to validate (in Gwei)
 * @returns true if valid, false otherwise
 */
export function validateGasPrice(gasPrice: string): boolean {
  if (!gasPrice || gasPrice.trim() === '') return false;
  
  // Must be a positive number
  if (!/^\d+(\.\d+)?$/.test(gasPrice.trim())) {
    return false;
  }
  
  const value = parseFloat(gasPrice);
  
  // Reasonable bounds: 0.1 Gwei to 1000 Gwei
  if (value < 0.1 || value > 1000 || isNaN(value)) {
    return false;
  }
  
  return true;
}

/**
 * Validates a mnemonic phrase
 * @param mnemonic - Mnemonic phrase to validate
 * @returns true if valid format (12, 15, 18, 21, or 24 words), false otherwise
 */
export function validateMnemonic(mnemonic: string): boolean {
  if (!mnemonic) return false;
  
  const words = mnemonic.trim().split(/\s+/);
  const validLengths = [12, 15, 18, 21, 24];
  
  return validLengths.includes(words.length);
}

/**
 * Validates a private key
 * @param privateKey - Private key to validate (with or without 0x prefix)
 * @returns true if valid, false otherwise
 */
export function validatePrivateKey(privateKey: string): boolean {
  if (!privateKey) return false;
  
  // Remove 0x prefix if present
  const key = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
  
  // Must be 64 hex characters
  return /^[0-9a-fA-F]{64}$/.test(key);
}

/**
 * Validates a password strength
 * @param password - Password to validate
 * @returns Object with isValid flag and error message
 */
export function validatePassword(password: string): {
  isValid: boolean;
  error?: string;
} {
  if (!password) {
    return { isValid: false, error: 'Password is required' };
  }
  
  if (password.length < 8) {
    return { isValid: false, error: 'Password must be at least 8 characters' };
  }
  
  if (password.length > 128) {
    return { isValid: false, error: 'Password must be less than 128 characters' };
  }
  
  // Check for at least one uppercase, one lowercase, and one number
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  
  if (!hasUppercase || !hasLowercase || !hasNumber) {
    return {
      isValid: false,
      error: 'Password must contain uppercase, lowercase, and numbers',
    };
  }
  
  return { isValid: true };
}

/**
 * Validates that two passwords match
 * @param password - First password
 * @param confirmPassword - Confirmation password
 * @returns true if they match, false otherwise
 */
export function validatePasswordMatch(
  password: string,
  confirmPassword: string
): boolean {
  return password === confirmPassword && password.length > 0;
}

/**
 * Validates a network RPC URL
 * @param url - RPC URL to validate
 * @returns true if valid URL format, false otherwise
 */
export function validateRpcUrl(url: string): boolean {
  if (!url) return false;
  
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validates a chain ID
 * @param chainId - Chain ID to validate
 * @returns true if valid positive integer, false otherwise
 */
export function validateChainId(chainId: string): boolean {
  if (!chainId || chainId.trim() === '') return false;
  
  // Must be a positive integer
  if (!/^\d+$/.test(chainId.trim())) {
    return false;
  }
  
  const value = parseInt(chainId, 10);
  return value > 0 && value < 2147483647; // Max safe integer for chain ID
}
