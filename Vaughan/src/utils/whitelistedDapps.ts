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
  category: 'dex' | 'lending' | 'nft' | 'gaming' | 'defi' | 'bridge' | 'other';
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
 * 
 * To add your dApp:
 * 1. Fork the repository
 * 2. Add your dApp to this list
 * 3. Submit a PR with:
 *    - dApp name and description
 *    - Official URL
 *    - Supported chains
 *    - Verification proof (official social media, domain ownership, etc.)
 * 4. Wait for review and approval
 */
export const WHITELISTED_DAPPS: WhitelistedDapp[] = [
  // DEX (Decentralized Exchanges)
  {
    id: 'uniswap',
    name: 'Uniswap',
    description: 'Leading decentralized exchange protocol',
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
    url: 'https://app.compound.finance',
    icon: '🏦',
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
    url: 'https://app.1inch.io',
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

  // PulseChain Ecosystem (for testing)
  {
    id: 'pulsechain-faucet',
    name: 'PulseChain Faucet',
    description: 'Get free testnet tPLS tokens',
    url: 'https://faucet.v4.testnet.pulsechain.com/',
    icon: '💧',
    category: 'other',
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
    name: 'PulseX (Web)',
    description: 'Native DEX on PulseChain',
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
    description: 'DeFi platform on PulseChain',
    url: 'https://app.piteas.io',
    icon: '⚓',
    category: 'defi',
    chains: [369, 943], // PulseChain, PulseChain Testnet
    verified: true,
    dateAdded: '2026-02-12',
  },
  {
    id: 'provex-revolut',
    name: 'Provex (Revolut)',
    description: 'Crypto on-ramp service via Revolut',
    url: 'https://app.provex.com/#/?provider=revolut',
    icon: '💳',
    category: 'defi',
    chains: [1, 10, 137, 42161, 56, 43114, 8453], // Multi-chain support assumed for on-ramp
    verified: true,
    dateAdded: '2026-02-18',
  },
];

/**
 * Get dApps by category
 */
export function getDappsByCategory(category: WhitelistedDapp['category']): WhitelistedDapp[] {
  return WHITELISTED_DAPPS.filter(dapp => dapp.category === category);
}

/**
 * Get dApps by chain ID
 */
export function getDappsByChain(chainId: number): WhitelistedDapp[] {
  return WHITELISTED_DAPPS.filter(dapp => dapp.chains.includes(chainId));
}

/**
 * Get dApp by ID
 */
export function getDappById(id: string): WhitelistedDapp | undefined {
  return WHITELISTED_DAPPS.find(dapp => dapp.id === id);
}

/**
 * Check if URL is whitelisted
 */
export function isWhitelisted(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const origin = urlObj.origin;
    return WHITELISTED_DAPPS.some(dapp => {
      const dappOrigin = new URL(dapp.url).origin;
      return dappOrigin === origin;
    });
  } catch {
    return false;
  }
}

/**
 * Get all categories
 */
export function getCategories(): Array<{ id: WhitelistedDapp['category']; name: string; icon: string }> {
  return [
    { id: 'dex', name: 'DEX', icon: '🔄' },
    { id: 'lending', name: 'Lending', icon: '🏦' },
    { id: 'nft', name: 'NFT', icon: '🖼️' },
    { id: 'gaming', name: 'Gaming', icon: '🎮' },
    { id: 'defi', name: 'DeFi', icon: '💰' },
    { id: 'bridge', name: 'Bridge', icon: '🌉' },
    { id: 'other', name: 'Other', icon: '📦' },
  ];
}
