import { useState } from 'react';
import { WHITELISTED_DAPPS, WhitelistedDapp } from '../../utils/whitelistedDapps';

interface DappSelectorProps {
  onSelect: (dapp: WhitelistedDapp) => void;
  onClose: () => void;
  currentChainId?: number;
}

// Chain ID to name mapping
const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  10: 'Optimism',
  56: 'BNB Chain',
  137: 'Polygon',
  369: 'PulseChain',
  943: 'PulseChain Testnet',
  8453: 'Base',
  42161: 'Arbitrum',
  43114: 'Avalanche',
};

/**
 * DappSelector - Modal for selecting whitelisted dApps
 * 
 * Clean text-only list sorted by blockchain.
 */
export function DappSelector({ onSelect, onClose, currentChainId }: DappSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Group dApps by chain
  const dappsByChain: Record<number, WhitelistedDapp[]> = {};
  
  WHITELISTED_DAPPS.forEach(dapp => {
    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!dapp.name.toLowerCase().includes(query) && 
          !dapp.description.toLowerCase().includes(query)) {
        return;
      }
    }

    dapp.chains.forEach(chainId => {
      if (!dappsByChain[chainId]) {
        dappsByChain[chainId] = [];
      }
      dappsByChain[chainId].push(dapp);
    });
  });

  // Sort chains: current chain first, then by chain ID
  const sortedChainIds = Object.keys(dappsByChain)
    .map(Number)
    .sort((a, b) => {
      if (currentChainId) {
        if (a === currentChainId) return -1;
        if (b === currentChainId) return 1;
      }
      return a - b;
    });

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white">Select dApp</h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search dApps..."
            className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* dApp List by Chain */}
        <div className="flex-1 overflow-y-auto p-6">
          {sortedChainIds.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-400 text-lg">No dApps found</p>
              <p className="text-slate-500 text-sm mt-2">
                Try adjusting your search
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {sortedChainIds.map(chainId => (
                <div key={chainId}>
                  {/* Chain Header */}
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    {CHAIN_NAMES[chainId] || `Chain ${chainId}`}
                    {chainId === currentChainId && (
                      <span className="text-xs bg-primary-600 text-white px-2 py-0.5 rounded">
                        Current
                      </span>
                    )}
                  </h3>

                  {/* dApp List */}
                  <div className="space-y-1">
                    {dappsByChain[chainId].map(dapp => (
                      <button
                        key={`${chainId}-${dapp.id}`}
                        onClick={() => onSelect(dapp)}
                        className="w-full px-4 py-3 bg-slate-900 hover:bg-slate-700 border border-slate-800 hover:border-primary-500 rounded-lg text-left transition-all group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-white group-hover:text-primary-400 transition-colors">
                              {dapp.name}
                            </div>
                            <div className="text-sm text-slate-400 mt-0.5">
                              {dapp.description}
                            </div>
                          </div>
                          <svg 
                            className="w-5 h-5 text-slate-600 group-hover:text-primary-500 transition-colors flex-shrink-0 ml-3" 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 bg-slate-900/50">
          <p className="text-xs text-slate-500 text-center">
            Want to add your dApp? Submit a PR to our GitHub repository
          </p>
        </div>
      </div>
    </div>
  );
}
