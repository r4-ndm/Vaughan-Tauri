import { useState, useEffect } from 'react';
import { TauriService } from '../../services/tauri';
import type { NetworkInfo } from '../../types';

/**
 * NetworkSelector Component
 * 
 * Displays current network and allows switching between networks.
 */
export function NetworkSelector() {
  const [currentNetwork, setCurrentNetwork] = useState<NetworkInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Available networks
  const availableNetworks = [
    { id: 'ethereum', name: 'Ethereum', chainId: 1, rpcUrl: 'https://eth.llamarpc.com', symbol: 'ETH' },
    { id: 'pulsechain', name: 'PulseChain', chainId: 369, rpcUrl: 'https://rpc.pulsechain.com', symbol: 'PLS' },
    { id: 'pulsechain-testnet-v4', name: 'PulseChain Testnet V4', chainId: 943, rpcUrl: 'https://rpc.v4.testnet.pulsechain.com', symbol: 'tPLS' },
    { id: 'polygon', name: 'Polygon', chainId: 137, rpcUrl: 'https://polygon-rpc.com', symbol: 'MATIC' },
  ];

  // Load current network on mount
  useEffect(() => {
    loadNetwork();
  }, []);

  async function loadNetwork() {
    try {
      setLoading(true);
      setError(null);
      
      const current = await TauriService.getNetworkInfo();
      setCurrentNetwork(current);
    } catch (err) {
      console.error('Failed to load network:', err);
      setError('Failed to load network');
    } finally {
      setLoading(false);
    }
  }

  async function handleSwitchNetwork(network: typeof availableNetworks[0]) {
    try {
      setSwitching(true);
      setError(null);
      setIsOpen(false);

      await TauriService.switchNetwork({
        network_id: network.id,
        rpc_url: network.rpcUrl,
        chain_id: network.chainId,
      });

      // Reload network info
      await loadNetwork();
    } catch (err) {
      console.error('Failed to switch network:', err);
      setError(err instanceof Error ? err.message : 'Failed to switch network');
    } finally {
      setSwitching(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-lg">
        <div className="w-3 h-3 bg-slate-600 rounded-full animate-pulse" />
        <span className="text-sm text-slate-400">Loading...</span>
      </div>
    );
  }

  if (error && !currentNetwork) {
    return (
      <div className="px-4 py-2 bg-red-900/20 border border-red-500/30 rounded-lg">
        <span className="text-sm text-red-400">{error}</span>
      </div>
    );
  }

  if (!currentNetwork) {
    return null;
  }

  return (
    <div className="relative">
      {/* Current network button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={switching}
        className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full"
      >
        {/* Network indicator dot */}
        <div className="w-3 h-3 rounded-full bg-primary-500" />
        
        {/* Network info */}
        <div className="flex flex-col items-start flex-1">
          <span className="text-sm font-medium text-slate-100">
            {switching ? 'Switching...' : currentNetwork.name}
          </span>
          <span className="text-xs text-slate-400">
            Chain ID: {currentNetwork.chain_id}
          </span>
        </div>

        {/* Dropdown arrow */}
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 overflow-hidden">
            {availableNetworks.map((network) => (
              <button
                key={network.id}
                onClick={() => handleSwitchNetwork(network)}
                disabled={switching || currentNetwork.chain_id === network.chainId}
                className="w-full px-4 py-3 text-left hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
              >
                <div className={`w-2 h-2 rounded-full ${currentNetwork.chain_id === network.chainId ? 'bg-primary-500' : 'bg-slate-600'}`} />
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-100">{network.name}</div>
                  <div className="text-xs text-slate-400">Chain ID: {network.chainId}</div>
                </div>
                {currentNetwork.chain_id === network.chainId && (
                  <svg className="w-4 h-4 text-primary-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Error message */}
      {error && (
        <div className="mt-2 px-3 py-2 bg-red-900/20 border border-red-500/30 rounded text-xs text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
