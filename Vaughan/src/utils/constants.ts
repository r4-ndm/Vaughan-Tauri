/**
 * Application constants and configuration values
 */

/**
 * Network-related constants
 */
export const NETWORKS = {
  ETHEREUM: {
    id: 'ethereum',
    name: 'Ethereum',
    chainId: 1,
    symbol: 'ETH',
    decimals: 18,
    color: '#627EEA',
  },
  PULSECHAIN: {
    id: 'pulsechain',
    name: 'PulseChain',
    chainId: 369,
    symbol: 'PLS',
    decimals: 18,
    color: '#00D4AA',
  },
  POLYGON: {
    id: 'polygon',
    name: 'Polygon',
    chainId: 137,
    symbol: 'MATIC',
    decimals: 18,
    color: '#8247E5',
  },
  BSC: {
    id: 'bsc',
    name: 'BNB Chain',
    chainId: 56,
    symbol: 'BNB',
    decimals: 18,
    color: '#F3BA2F',
  },
} as const;

/**
 * Transaction status constants
 */
export const TX_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  FAILED: 'failed',
} as const;

/**
 * Transaction type constants
 */
export const TX_TYPE = {
  SEND: 'send',
  RECEIVE: 'receive',
  CONTRACT: 'contract',
  APPROVE: 'approve',
} as const;

/**
 * Gas limit presets for common operations
 */
export const GAS_LIMITS = {
  TRANSFER: 21000,
  TOKEN_TRANSFER: 65000,
  TOKEN_APPROVE: 50000,
  CONTRACT_INTERACTION: 100000,
} as const;

/**
 * Gas price suggestions (in Gwei)
 */
export const GAS_PRICE_PRESETS = {
  SLOW: { label: 'Slow', multiplier: 0.8 },
  STANDARD: { label: 'Standard', multiplier: 1.0 },
  FAST: { label: 'Fast', multiplier: 1.2 },
  INSTANT: { label: 'Instant', multiplier: 1.5 },
} as const;

/**
 * Wallet-related constants
 */
export const WALLET = {
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 128,
  MNEMONIC_LENGTHS: [12, 15, 18, 21, 24],
  DEFAULT_DERIVATION_PATH: "m/44'/60'/0'/0",
  MAX_ACCOUNTS: 100,
} as const;

/**
 * UI-related constants
 */
export const UI = {
  ADDRESS_TRUNCATE_START: 6,
  ADDRESS_TRUNCATE_END: 4,
  TX_HASH_TRUNCATE_START: 10,
  TX_HASH_TRUNCATE_END: 8,
  MAX_DECIMALS_DISPLAY: 6,
  TOAST_DURATION: 5000, // milliseconds
  DEBOUNCE_DELAY: 300, // milliseconds
} as const;

/**
 * API-related constants
 */
export const API = {
  PRICE_UPDATE_INTERVAL: 60000, // 1 minute
  BALANCE_UPDATE_INTERVAL: 30000, // 30 seconds
  TX_POLL_INTERVAL: 5000, // 5 seconds
  REQUEST_TIMEOUT: 30000, // 30 seconds
} as const;

/**
 * Storage keys for local/session storage
 */
export const STORAGE_KEYS = {
  THEME: 'vaughan_theme',
  LAST_NETWORK: 'vaughan_last_network',
  LAST_ACCOUNT: 'vaughan_last_account',
  CUSTOM_TOKENS: 'vaughan_custom_tokens',
  SETTINGS: 'vaughan_settings',
} as const;

/**
 * Error messages
 */
export const ERROR_MESSAGES = {
  INVALID_ADDRESS: 'Invalid Ethereum address',
  INVALID_AMOUNT: 'Invalid amount',
  INSUFFICIENT_BALANCE: 'Insufficient balance',
  INVALID_GAS_LIMIT: 'Invalid gas limit',
  INVALID_GAS_PRICE: 'Invalid gas price',
  INVALID_MNEMONIC: 'Invalid mnemonic phrase',
  INVALID_PRIVATE_KEY: 'Invalid private key',
  WEAK_PASSWORD: 'Password does not meet requirements',
  PASSWORD_MISMATCH: 'Passwords do not match',
  NETWORK_ERROR: 'Network error occurred',
  TRANSACTION_FAILED: 'Transaction failed',
  WALLET_LOCKED: 'Wallet is locked',
  UNKNOWN_ERROR: 'An unknown error occurred',
} as const;

/**
 * Success messages
 */
export const SUCCESS_MESSAGES = {
  TRANSACTION_SENT: 'Transaction sent successfully',
  ACCOUNT_CREATED: 'Account created successfully',
  ACCOUNT_IMPORTED: 'Account imported successfully',
  NETWORK_SWITCHED: 'Network switched successfully',
  PASSWORD_CHANGED: 'Password changed successfully',
  SETTINGS_SAVED: 'Settings saved successfully',
} as const;

/**
 * Route paths
 */
export const ROUTES = {
  HOME: '/',
  SEND: '/send',
  RECEIVE: '/receive',
  HISTORY: '/history',
  SETTINGS: '/settings',
  DAPP_BROWSER: '/dapp',
} as const;

/**
 * Block explorer URL templates
 * Use {address} or {tx} as placeholders
 */
export const BLOCK_EXPLORERS = {
  ethereum: 'https://etherscan.io',
  pulsechain: 'https://scan.pulsechain.com',
  polygon: 'https://polygonscan.com',
  bsc: 'https://bscscan.com',
} as const;

/**
 * Helper function to get block explorer URL for an address
 */
export function getExplorerAddressUrl(network: string, address: string): string {
  const baseUrl = BLOCK_EXPLORERS[network as keyof typeof BLOCK_EXPLORERS];
  return baseUrl ? `${baseUrl}/address/${address}` : '';
}

/**
 * Helper function to get block explorer URL for a transaction
 */
export function getExplorerTxUrl(network: string, txHash: string): string {
  const baseUrl = BLOCK_EXPLORERS[network as keyof typeof BLOCK_EXPLORERS];
  return baseUrl ? `${baseUrl}/tx/${txHash}` : '';
}

/**
 * Helper function to get network by chain ID
 */
export function getNetworkByChainId(chainId: number): typeof NETWORKS[keyof typeof NETWORKS] | null {
  return Object.values(NETWORKS).find(n => n.chainId === chainId) || null;
}
