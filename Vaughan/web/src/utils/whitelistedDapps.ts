/**
 * Whitelisted dApps
 * 
 * Curated list of verified dApps that are safe to use with Vaughan Wallet.
 * Communities can submit PRs to add their dApps to this list.
 */

export interface WhitelistedDapp {
    /** Unique identifier */
    id: string;
    /** Display name */
    name: string;
    /** Short description */
    description: string;
    /** dApp URL */
    url: string;
    /** Icon URL or emoji */
    icon: string;
    /** Category */
    category: 'dex' | 'lending' | 'nft' | 'gaming' | 'defi' | 'bridge' | 'other' | 'wallet' | 'data' | 'tools';
    /** Supported chains (chain IDs) */
    chains: number[];
    /** Verification status */
    verified: boolean;
    /** Date added (YYYY-MM-DD) */
    dateAdded: string;
    /** Optional: Path to local executable to launch before opening */
    launchExecutable?: string;
}

/**
 * Whitelisted dApps Registry
 */
export const WHITELISTED_DAPPS: WhitelistedDapp[] = [
    // DEX (Decentralized Exchanges)
    {
        id: 'uniswap',
        name: 'Uniswap',
        description: 'Swap, earn, and build on the leading decentralized crypto trading protocol.',
        url: 'https://app.uniswap.org',
        icon: '🦄',
        category: 'dex',
        chains: [1, 10, 137, 42161, 8453], // Ethereum, Optimism, Polygon, Arbitrum, Base
        verified: true,
        dateAdded: '2026-02-10',
    },
    {
        id: 'sushiswap',
        name: 'SushiSwap',
        description: 'Community-driven DEX and DeFi platform',
        url: 'https://www.sushi.com/swap',
        icon: '🍣',
        category: 'dex',
        chains: [1, 10, 137, 42161, 56], // Ethereum, Optimism, Polygon, Arbitrum, BSC
        verified: true,
        dateAdded: '2026-02-10',
    },
    {
        id: 'pancakeswap',
        name: 'PancakeSwap',
        description: 'Popular DEX on BNB Chain',
        url: 'https://pancakeswap.finance',
        icon: '🥞',
        category: 'dex',
        chains: [56, 1], // BSC, Ethereum
        verified: true,
        dateAdded: '2026-02-10',
    },
    {
        id: 'curve',
        name: 'Curve Finance',
        description: 'Stablecoin-focused DEX with low slippage',
        url: 'https://curve.fi',
        icon: '🌊',
        category: 'dex',
        chains: [1, 10, 137, 42161], // Ethereum, Optimism, Polygon, Arbitrum
        verified: true,
        dateAdded: '2026-02-10',
    },

    // Lending Protocols
    {
        id: 'aave',
        name: 'Aave',
        description: 'Leading decentralized lending protocol',
        url: 'https://app.aave.com',
        icon: '👻',
        category: 'lending',
        chains: [1, 10, 137, 42161, 43114], // Ethereum, Optimism, Polygon, Arbitrum, Avalanche
        verified: true,
        dateAdded: '2026-02-10',
    },
    {
        id: 'compound',
        name: 'Compound',
        description: 'Algorithmic money market protocol',
        url: 'https://app.compound.finance/?market=usdc-mainnet',
        icon: 'https://compound.finance/favicon.ico',
        category: 'lending',
        chains: [1, 10, 137, 42161], // Ethereum, Optimism, Polygon, Arbitrum
        verified: true,
        dateAdded: '2026-02-10',
    },

    // Aggregators
    {
        id: '1inch',
        name: '1inch',
        description: 'DEX aggregator for best swap rates',
        url: 'https://1inch.com/swap',
        icon: '🦏',
        category: 'dex',
        chains: [1, 10, 137, 42161, 56], // Ethereum, Optimism, Polygon, Arbitrum, BSC
        verified: true,
        dateAdded: '2026-02-10',
    },

    // NFT Marketplaces
    {
        id: 'opensea',
        name: 'OpenSea',
        description: 'Largest NFT marketplace',
        url: 'https://opensea.io',
        icon: '🌊',
        category: 'nft',
        chains: [1, 10, 137, 42161, 8453], // Ethereum, Optimism, Polygon, Arbitrum, Base
        verified: true,
        dateAdded: '2026-02-10',
    },

    // Bridges
    {
        id: 'stargate',
        name: 'Stargate Finance',
        description: 'Cross-chain bridge powered by LayerZero',
        url: 'https://stargate.finance',
        icon: '🌉',
        category: 'bridge',
        chains: [1, 10, 137, 42161, 56, 43114], // Multi-chain
        verified: true,
        dateAdded: '2026-02-10',
    },

    // PulseChain Ecosystem
    {
        id: 'pulsechain-faucet',
        name: 'PulseChain Faucet',
        description: 'Get free PLS and other tokens for testing on PulseChain V4 Testnet.',
        url: 'https://faucet.v4.testnet.pulsechain.com/',
        icon: '💧',
        category: 'tools',
        chains: [943], // PulseChain Testnet V4
        verified: true,
        dateAdded: '2026-02-12',
    },
    {
        id: 'pulsex-local',
        name: 'PulseX (Local)',
        description: 'Local PulseX instance - fast and private',
        url: 'http://127.0.0.1:3691',
        icon: '💓',
        category: 'dex',
        chains: [369, 943], // PulseChain, PulseChain Testnet
        verified: true,
        dateAdded: '2026-02-12',
        launchExecutable: 'C:\\Users\\rb3y9\\Desktop\\Vaughan-Tauri\\PulseX\\pulsex-server.exe',
    },
    {
        id: 'pulsex',
        name: 'PulseX',
        description: 'The most liquid DEX on PulseChain.',
        url: 'https://app.pulsex.com',
        icon: '💓',
        category: 'dex',
        chains: [369, 943], // PulseChain, PulseChain Testnet
        verified: true,
        dateAdded: '2026-02-10',
    },
    {
        id: 'piteas',
        name: 'Piteas',
        description: 'DEX Aggregator on PulseChain.',
        url: 'https://app.piteas.io',
        icon: '⚓',
        category: 'defi',
        chains: [369, 943], // PulseChain, PulseChain Testnet
        verified: true,
        dateAdded: '2026-02-12',
    },
    {
        id: 'gopulse',
        name: 'GoPulse',
        description: "PulseChain Portfolio Tracker & Explorer.",
        url: "https://gopulse.com",
        icon: '📈',
        category: 'data',
        chains: [369],
        verified: true,
        dateAdded: '2026-02-18'
    },
    {
        id: 'internet-money',
        name: "Internet Money",
        description: "Native PulseChain Wallet & Swap.",
        url: "https://internetmoney.io",
        icon: '💰',
        category: 'wallet',
        chains: [369],
        verified: true,
        dateAdded: '2026-02-18'
    },
    {
        id: 'provex-revolut',
        name: 'Provex (Revolut)',
        description: 'Crypto on-ramp service via Revolut',
        url: 'https://app.provex.com/#/?provider=revolut',
        icon: '💳',
        category: 'defi',
        chains: [1, 10, 137, 42161, 56, 43114, 8453], // Multi-chain
        verified: true,
        dateAdded: '2026-02-18',
    },
    {
        id: 'libertyswap',
        name: 'LibertySwap',
        description: 'The community-driven DEX for PulseChain.',
        url: 'https://libertyswap.finance/',
        icon: '🗽',
        category: 'dex',
        chains: [369],
        verified: true,
        dateAdded: '2026-03-06',
    },
];
