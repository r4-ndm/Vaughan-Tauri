/**
 * TypeScript Type Definitions for Vaughan Wallet
 * 
 * These types match the Rust backend structures and provide
 * type safety for all Tauri command interactions.
 */

// ============================================================================
// Account Types
// ============================================================================

/**
 * Account type - HD (derived from seed) or Imported (from private key)
 */
export type AccountType = 'hd' | 'imported';

/**
 * Account information
 */
export interface Account {
  /** Ethereum address (0x...) */
  address: string;
  /** User-defined account name */
  name: string;
  /** Account type (HD or imported) */
  account_type: AccountType;
  /** Derivation index (only for HD accounts) */
  index?: number;
}

// ============================================================================
// Network Types
// ============================================================================

/**
 * Network information
 */
export interface NetworkInfo {
  /** Network ID (e.g., "ethereum", "pulsechain") */
  network_id: string;
  /** Human-readable network name */
  name: string;
  /** Chain ID (e.g., 1 for Ethereum mainnet) */
  chain_id: number;
  /** RPC endpoint URL */
  rpc_url: string;
  /** Block explorer URL */
  explorer_url: string;
  /** Native token information */
  native_token: TokenInfo;
}

/**
 * Token balance information
 */
export interface TokenBalance {
  contract_address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  price_usd: number;
}

/**
 * Token information
 */
export interface TokenInfo {
  /** Token symbol (e.g., "ETH", "PLS") */
  symbol: string;
  /** Token name (e.g., "Ethereum", "PulseChain") */
  name: string;
  /** Token decimals (usually 18) */
  decimals: number;
}

// ============================================================================
// Balance Types
// ============================================================================

/**
 * Balance response
 */
export interface BalanceResponse {
  /** Balance in wei (as string) */
  balance_wei: string;
  /** Balance in ETH (human-readable) */
  balance_eth: string;
  /** Token symbol */
  symbol: string;
}

/**
 * Token price response
 */
export interface TokenPriceResponse {
  /** Token symbol */
  symbol: string;
  /** Price in USD */
  price_usd: number;
  /** Last updated timestamp */
  last_updated: number;
}

// ============================================================================
// Transaction Types
// ============================================================================

/**
 * Transaction validation request
 */
export interface ValidateTransactionRequest {
  /** Recipient address */
  to: string;
  /** Amount in ETH (human-readable) */
  amount: string;
  /** Gas limit (optional) */
  gas_limit?: number;
}

/**
 * Gas estimation response
 */
export interface EstimateGasResponse {
  /** Estimated gas limit */
  gas_limit: number;
  /** Estimated gas price in gwei */
  gas_price_gwei: string;
  /** Estimated total fee in ETH */
  total_fee_eth: string;
}

/**
 * Build transaction request
 */
export interface BuildTransactionRequest {
  /** Sender address */
  from: string;
  /** Recipient address */
  to: string;
  /** Amount in ETH (human-readable) */
  amount: string;
  /** Gas limit (optional) */
  gas_limit?: number;
  /** Gas price in gwei (optional) */
  gas_price_gwei?: string;
  /** Nonce (optional) */
  nonce?: number;
}

/**
 * Built transaction response
 */
export interface BuildTransactionResponse {
  /** Sender address */
  from: string;
  /** Recipient address */
  to: string;
  /** Amount in wei */
  value: string;
  /** Gas limit */
  gas_limit: number;
  /** Gas price in wei */
  gas_price: string;
  /** Nonce */
  nonce: number;
  /** Chain ID */
  chain_id: number;
  /** Estimated total cost in ETH (amount + gas fee) */
  total_cost_eth: string;
}

/**
 * Sign transaction request
 */
export interface SignTransactionRequest {
  /** Sender address */
  from: string;
  /** Recipient address */
  to: string;
  /** Amount in wei */
  value: string;
  /** Gas limit */
  gas_limit: number;
  /** Gas price in wei */
  gas_price: string;
  /** Nonce */
  nonce: number;
  /** Password for wallet unlock verification */
  password: string;
}

/**
 * Send transaction request
 */
export interface SendTransactionRequest {
  /** Sender address */
  from: string;
  /** Recipient address */
  to: string;
  /** Amount in ETH (human-readable) */
  amount: string;
  /** Gas limit (optional) */
  gas_limit?: number;
  /** Gas price in gwei (optional) */
  gas_price_gwei?: string;
  /** Password for wallet unlock verification */
  password: string;
}

/**
 * Transaction response
 */
export interface TransactionResponse {
  /** Transaction hash */
  tx_hash: string;
  /** Transaction details */
  details: BuildTransactionResponse;
}

// ============================================================================
// Wallet Types
// ============================================================================

/**
 * Create wallet request
 */
export interface CreateWalletRequest {
  /** Password for encrypting the seed */
  password: string;
  /** Number of words (12 or 24) */
  word_count: number;
}

/**
 * Import wallet request
 */
export interface ImportWalletRequest {
  /** BIP-39 mnemonic phrase */
  mnemonic: string;
  /** Password for encrypting the seed */
  password: string;
  /** Number of accounts to derive (1-10) */
  account_count: number;
}

/**
 * Import account request
 */
export interface ImportAccountRequest {
  /** Private key as hex (with or without 0x) */
  private_key: string;
  /** Account name */
  name: string;
  /** Password for verification */
  password: string;
}

// ============================================================================
// Network Switch Types
// ============================================================================

/**
 * Switch network request
 */
export interface SwitchNetworkRequest {
  /** Network ID to switch to */
  network_id: string;
  /** RPC endpoint URL */
  rpc_url: string;
  /** Chain ID */
  chain_id: number;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Wallet error from backend
 */
export interface WalletError {
  /** Error message */
  message: string;
  /** Error code (optional) */
  code?: string;
}

// ============================================================================
// UI State Types
// ============================================================================

/**
 * Wallet state for UI
 */
export interface WalletState {
  /** Is wallet created? */
  exists: boolean;
  /** Is wallet locked? */
  locked: boolean;
  /** Current accounts */
  accounts: Account[];
  /** Active account address */
  activeAccount: string | null;
  /** Current network */
  currentNetwork: NetworkInfo | null;
  /** Current balance */
  balance: BalanceResponse | null;
}

/**
 * Loading state
 */
export interface LoadingState {
  /** Is loading? */
  loading: boolean;
  /** Loading message */
  message?: string;
}

/**
 * Error state
 */
export interface ErrorState {
  /** Has error? */
  hasError: boolean;
  /** Error message */
  message?: string;
}

// ============================================================================
// Form Types
// ============================================================================

/**
 * Send transaction form data
 */
export interface SendTransactionForm {
  /** Recipient address */
  to: string;
  /** Amount in ETH */
  amount: string;
  /** Gas limit (optional) */
  gasLimit?: string;
  /** Gas price in gwei (optional) */
  gasPrice?: string;
  /** Password */
  password: string;
}

/**
 * Create wallet form data
 */
export interface CreateWalletForm {
  /** Password */
  password: string;
  /** Confirm password */
  confirmPassword: string;
  /** Word count (12 or 24) */
  wordCount: 12 | 24;
}

/**
 * Import wallet form data
 */
export interface ImportWalletForm {
  /** Mnemonic phrase */
  mnemonic: string;
  /** Password */
  password: string;
  /** Confirm password */
  confirmPassword: string;
  /** Number of accounts */
  accountCount: number;
}

/**
 * Unlock wallet form data
 */
export interface UnlockWalletForm {
  /** Password */
  password: string;
}

/**
 * Import account form data
 */
export interface ImportAccountForm {
  /** Private key */
  privateKey: string;
  /** Account name */
  name: string;
  /** Password */
  password: string;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Result type for async operations
 */
export type Result<T, E = WalletError> = 
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Async state for UI
 */
export interface AsyncState<T> {
  /** Data */
  data: T | null;
  /** Loading state */
  loading: boolean;
  /** Error */
  error: string | null;
}
