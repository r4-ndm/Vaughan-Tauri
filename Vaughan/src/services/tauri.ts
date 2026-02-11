/**
 * Tauri Service Wrapper
 * 
 * Type-safe wrappers for all Tauri commands.
 * Provides error handling, loading states, and TypeScript types.
 * 
 * **Security Note**: All sensitive operations (signing, account management)
 * are handled in the Rust backend. Private keys never leave the backend.
 * 
 * @version 2.0.1
 * @updated 2026-02-09T10:35:00Z
 */

import { invoke } from '@tauri-apps/api/core';
import type {
  Account,
  NetworkInfo,
  BalanceResponse,
  TokenPriceResponse,
  ValidateTransactionRequest,
  EstimateGasResponse,
  BuildTransactionRequest,
  BuildTransactionResponse,
  SignTransactionRequest,
  SendTransactionRequest,
  TransactionResponse,
  CreateWalletRequest,
  ImportWalletRequest,
  ImportAccountRequest,
  SwitchNetworkRequest,
} from '../types';

// ============================================================================
// Network Commands (5)
// ============================================================================

/**
 * Switch to a different network
 * 
 * @param request - Network switch request with network_id, rpc_url, and chain_id
 * @returns Promise<void>
 * 
 * @example
 * ```ts
 * await switchNetwork({
 *   network_id: 'ethereum',
 *   rpc_url: 'https://eth.llamarpc.com',
 *   chain_id: 1
 * });
 * ```
 */
export async function switchNetwork(request: SwitchNetworkRequest): Promise<void> {
  // Pass the request object directly - Tauri expects { request: SwitchNetworkRequest }
  await invoke('switch_network', { request });
}

/**
 * Get balance for an address
 * 
 * @param address - Ethereum address
 * @returns Promise<BalanceResponse>
 * 
 * @example
 * ```ts
 * const balance = await getBalance('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb');
 * console.log(`Balance: ${balance.balance_eth} ETH`);
 * ```
 */
export async function getBalance(address: string): Promise<BalanceResponse> {
  return await invoke('get_balance', { address });
}

/**
 * Get current network information
 * 
 * @returns Promise<NetworkInfo>
 * 
 * @example
 * ```ts
 * const network = await getNetworkInfo();
 * console.log(`Connected to: ${network.name}`);
 * ```
 */
export async function getNetworkInfo(): Promise<NetworkInfo> {
  return await invoke('get_network_info');
}

/**
 * Get current chain ID
 * 
 * @returns Promise<number>
 * 
 * @example
 * ```ts
 * const chainId = await getChainId();
 * console.log(`Chain ID: ${chainId}`);
 * ```
 */
export async function getChainId(): Promise<number> {
  return await invoke('get_chain_id');
}

/**
 * Get latest block number
 * 
 * @returns Promise<number>
 * 
 * @example
 * ```ts
 * const blockNumber = await getBlockNumber();
 * console.log(`Latest block: ${blockNumber}`);
 * ```
 */
export async function getBlockNumber(): Promise<number> {
  return await invoke('get_block_number');
}

// ============================================================================
// Token Commands (2)
// ============================================================================

/**
 * Get native token price in USD
 * 
 * @returns Promise<TokenPriceResponse>
 * 
 * @example
 * ```ts
 * const price = await getTokenPrice();
 * console.log(`ETH Price: $${price.price_usd}`);
 * ```
 */
export async function getTokenPrice(): Promise<TokenPriceResponse> {
  return await invoke('get_token_price');
}

/**
 * Force refresh token prices
 * 
 * @returns Promise<void>
 * 
 * @example
 * ```ts
 * await refreshTokenPrices();
 * ```
 */
export async function refreshTokenPrices(): Promise<void> {
  await invoke('refresh_token_prices');
}

// ============================================================================
// Transaction Commands (5)
// ============================================================================

/**
 * Validate transaction parameters
 * 
 * @param request - Transaction validation request
 * @returns Promise<void> - Throws error if invalid
 * 
 * @example
 * ```ts
 * await validateTransaction({
 *   to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
 *   amount: '1.5',
 *   gas_limit: 21000
 * });
 * ```
 */
export async function validateTransaction(
  request: ValidateTransactionRequest
): Promise<void> {
  await invoke('validate_transaction', { request });
}

/**
 * Estimate gas for a simple transfer
 * 
 * @returns Promise<EstimateGasResponse>
 * 
 * @example
 * ```ts
 * const estimate = await estimateGasSimple();
 * console.log(`Gas: ${estimate.gas_limit}, Price: ${estimate.gas_price_gwei} gwei`);
 * ```
 */
export async function estimateGasSimple(): Promise<EstimateGasResponse> {
  return await invoke('estimate_gas_simple');
}

/**
 * Build a transaction with all parameters filled in
 * 
 * @param request - Build transaction request
 * @returns Promise<BuildTransactionResponse>
 * 
 * @example
 * ```ts
 * const tx = await buildTransaction({
 *   from: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
 *   to: '0x1234567890123456789012345678901234567890',
 *   amount: '1.5'
 * });
 * console.log(`Total cost: ${tx.total_cost_eth} ETH`);
 * ```
 */
export async function buildTransaction(
  request: BuildTransactionRequest
): Promise<BuildTransactionResponse> {
  return await invoke('build_transaction', { request });
}

/**
 * Sign a transaction with the wallet's private key
 * 
 * **Security**: Requires password verification. Private key never leaves Rust backend.
 * 
 * @param request - Sign transaction request
 * @returns Promise<string> - Signed transaction (RLP-encoded hex)
 * 
 * @example
 * ```ts
 * const signedTx = await signTransaction({
 *   from: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
 *   to: '0x1234567890123456789012345678901234567890',
 *   value: '1500000000000000000',
 *   gas_limit: 21000,
 *   gas_price: '50000000000',
 *   nonce: 5,
 *   password: 'my_password'
 * });
 * ```
 */
export async function signTransaction(
  request: SignTransactionRequest
): Promise<string> {
  return await invoke('sign_transaction', { request });
}

/**
 * Build, sign, and send a transaction
 * 
 * **Security**: Requires password verification. Private key never leaves Rust backend.
 * 
 * @param request - Send transaction request
 * @returns Promise<TransactionResponse>
 * 
 * @example
 * ```ts
 * const result = await sendTransaction({
 *   from: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
 *   to: '0x1234567890123456789012345678901234567890',
 *   amount: '1.5',
 *   password: 'my_password'
 * });
 * console.log(`Transaction sent: ${result.tx_hash}`);
 * ```
 */
export async function sendTransaction(
  request: SendTransactionRequest
): Promise<TransactionResponse> {
  return await invoke('send_transaction', { request });
}

// ============================================================================
// Wallet Commands (10)
// ============================================================================

/**
 * Create a new wallet with BIP-39 mnemonic
 * 
 * **Security**: Mnemonic is only returned once. User must back it up.
 * 
 * @param request - Create wallet request
 * @returns Promise<string> - The generated mnemonic phrase
 * 
 * @example
 * ```ts
 * const mnemonic = await createWallet({
 *   password: 'my_secure_password',
 *   word_count: 12
 * });
 * console.log('BACKUP THIS MNEMONIC:', mnemonic);
 * ```
 */
export async function createWallet(
  request: CreateWalletRequest
): Promise<string> {
  console.log('createWallet called with:', request);
  // Tauri converts camelCase to snake_case automatically
  const params = { 
    password: request.password,
    wordCount: request.word_count  // Send as camelCase, Tauri converts to snake_case
  };
  console.log('Sending to Tauri:', params);
  return await invoke('create_wallet', params);
}

/**
 * Import wallet from BIP-39 mnemonic
 * 
 * @param request - Import wallet request
 * @returns Promise<string[]> - List of derived account addresses
 * 
 * @example
 * ```ts
 * const addresses = await importWallet({
 *   mnemonic: 'abandon abandon abandon...',
 *   password: 'my_secure_password',
 *   account_count: 3
 * });
 * console.log('Imported accounts:', addresses);
 * ```
 */
export async function importWallet(
  request: ImportWalletRequest
): Promise<string[]> {
  // Tauri converts camelCase to snake_case automatically
  return await invoke('import_wallet', {
    mnemonic: request.mnemonic,
    password: request.password,
    accountCount: request.account_count  // camelCase for Tauri
  });
}

/**
 * Unlock wallet with password
 * 
 * @param password - Wallet password
 * @returns Promise<void>
 * 
 * @example
 * ```ts
 * await unlockWallet('my_password');
 * ```
 */
export async function unlockWallet(password: string): Promise<void> {
  await invoke('unlock_wallet', { password });
}

/**
 * Lock wallet
 * 
 * @returns Promise<void>
 * 
 * @example
 * ```ts
 * await lockWallet();
 * ```
 */
export async function lockWallet(): Promise<void> {
  await invoke('lock_wallet');
}

/**
 * Check if wallet is locked
 * 
 * @returns Promise<boolean>
 * 
 * @example
 * ```ts
 * const locked = await isWalletLocked();
 * if (locked) {
 *   // Show unlock UI
 * }
 * ```
 */
export async function isWalletLocked(): Promise<boolean> {
  return await invoke('is_wallet_locked');
}

/**
 * Check if wallet exists
 * 
 * @returns Promise<boolean>
 * 
 * @example
 * ```ts
 * const exists = await walletExists();
 * if (!exists) {
 *   // Show wallet creation UI
 * }
 * ```
 */
export async function walletExists(): Promise<boolean> {
  return await invoke('wallet_exists');
}

/**
 * Get all accounts
 * 
 * @returns Promise<Account[]>
 * 
 * @example
 * ```ts
 * const accounts = await getAccounts();
 * accounts.forEach(account => {
 *   console.log(`${account.name}: ${account.address}`);
 * });
 * ```
 */
export async function getAccounts(): Promise<Account[]> {
  return await invoke('get_accounts');
}

/**
 * Create a new HD account
 * 
 * **Requires**: Wallet must be unlocked
 * 
 * @param password - Wallet password (for verification)
 * @returns Promise<Account>
 * 
 * @example
 * ```ts
 * const account = await createAccount('my_password');
 * console.log('New account:', account.address);
 * ```
 */
export async function createAccount(password: string): Promise<Account> {
  return await invoke('create_account', { password });
}

/**
 * Import account from private key
 * 
 * **Security**: Private key is encrypted and stored in OS keychain
 * 
 * @param request - Import account request
 * @returns Promise<Account>
 * 
 * @example
 * ```ts
 * const account = await importAccount({
 *   private_key: '0x1234...',
 *   name: 'My Imported Account',
 *   password: 'my_password'
 * });
 * ```
 */
export async function importAccount(
  request: ImportAccountRequest
): Promise<Account> {
  // Tauri converts camelCase to snake_case automatically
  return await invoke('import_account', {
    privateKey: request.private_key,  // camelCase for Tauri
    name: request.name,
    password: request.password
  });
}

/**
 * Delete an account
 * 
 * **Protection**: Cannot delete the last account
 * 
 * @param address - Account address to delete
 * @returns Promise<void>
 * 
 * @example
 * ```ts
 * await deleteAccount('0x1234...');
 * ```
 */
export async function deleteAccount(address: string): Promise<void> {
  await invoke('delete_account', { address });
}

/**
 * Set active account
 * 
 * Sets the currently active account for the wallet.
 * This account will be used for balance queries, transactions, etc.
 * 
 * @param address - Account address to set as active
 * @returns Promise<void>
 * 
 * @example
 * ```ts
 * await setActiveAccount('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb');
 * ```
 */
export async function setActiveAccount(address: string): Promise<void> {
  await invoke('set_active_account', { address });
}

// ============================================================================
// Window Management Commands (4) - Phase 3.4
// ============================================================================

/**
 * Open dApp URL in native WebView window
 * 
 * Creates a new native WebView window with the provider script injected.
 * The provider is injected via initialization_script (runs before page loads).
 * 
 * @param url - dApp URL to load (must be http:// or https://)
 * @returns Promise<string> - Window label (unique identifier)
 * 
 * @example
 * ```ts
 * const windowLabel = await openDappUrl('https://swap.internetmoney.io');
 * console.log('Opened dApp window:', windowLabel);
 * ```
 */
export async function openDappUrl(url: string): Promise<string> {
  return await invoke('open_dapp_url', { url });
}

/**
 * Navigate dApp window to new URL
 * 
 * Updates the URL of an existing dApp window.
 * 
 * @param windowLabel - Window identifier
 * @param url - New URL to navigate to
 * @returns Promise<void>
 * 
 * @example
 * ```ts
 * await navigateDapp('dapp-123', 'https://app.uniswap.org');
 * ```
 */
export async function navigateDapp(windowLabel: string, url: string): Promise<void> {
  await invoke('navigate_dapp', { windowLabel, url });
}

/**
 * Close dApp window and clean up resources
 * 
 * Closes the window and performs comprehensive cleanup:
 * - Removes all sessions for the window
 * - Clears all pending approvals for the window
 * - Removes window from registry
 * 
 * @param windowLabel - Window identifier
 * @returns Promise<void>
 * 
 * @example
 * ```ts
 * await closeDapp('dapp-123');
 * ```
 */
export async function closeDapp(windowLabel: string): Promise<void> {
  await invoke('close_dapp', { windowLabel });
}

/**
 * Get current URL of dApp window
 * 
 * Returns the current URL being displayed in the dApp window.
 * 
 * @param windowLabel - Window identifier
 * @returns Promise<string> - Current URL
 * 
 * @example
 * ```ts
 * const url = await getDappUrl('dapp-123');
 * console.log('Current URL:', url);
 * ```
 */
export async function getDappUrl(windowLabel: string): Promise<string> {
  return await invoke('get_dapp_url', { windowLabel });
}

// ============================================================================
// Error Handling Utilities
// ============================================================================

/**
 * Check if error is a wallet error
 */
export function isWalletError(error: unknown): error is string {
  return typeof error === 'string';
}

/**
 * Get user-friendly error message
 */
export function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unknown error occurred';
}

// ============================================================================
// Exports
// ============================================================================

export const TauriService = {
  // Network
  switchNetwork,
  getBalance,
  getNetworkInfo,
  getChainId,
  getBlockNumber,
  
  // Token
  getTokenPrice,
  refreshTokenPrices,
  
  // Transaction
  validateTransaction,
  estimateGasSimple,
  buildTransaction,
  signTransaction,
  sendTransaction,
  
  // Wallet
  createWallet,
  importWallet,
  unlockWallet,
  lockWallet,
  isWalletLocked,
  walletExists,
  getAccounts,
  createAccount,
  importAccount,
  deleteAccount,
  setActiveAccount,
  
  // Window Management (Phase 3.4)
  openDappUrl,
  navigateDapp,
  closeDapp,
  getDappUrl,
  
  // Utilities
  isWalletError,
  getErrorMessage,
};

export default TauriService;
