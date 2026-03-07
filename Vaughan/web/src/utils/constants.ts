/**
 * Application-wide constants
 */

export const NETWORK_IDS = {
    ETHEREUM: 'ethereum',
    SEPOLIA: 'sepolia',
    PULSECHAIN: 'pulsechain',
    PULSECHAIN_TESTNET: 'pulsechain_testnet',
    POLYGON: 'polygon',
    ARBITRUM: 'arbitrum',
    OPTIMISM: 'optimism',
    BASE: 'base',
    XDC: 'xdc',
} as const;

export type NetworkId = typeof NETWORK_IDS[keyof typeof NETWORK_IDS];

export const EXPLORER_URLS = {
    ethereum: 'https://etherscan.io',
    pulsechain: 'https://scan.pulsechain.com',
    polygon: 'https://polygonscan.com',
};

export const UI_CONSTANTS = {
    MAX_DECIMALS_DISPLAY: 6,
    TOAST_DURATION_MS: 4000,
    POLL_INTERVAL_MS: 15000, // 15 seconds for balances
};
