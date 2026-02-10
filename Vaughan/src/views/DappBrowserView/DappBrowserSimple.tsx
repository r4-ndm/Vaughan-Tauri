/**
 * Simple dApp Browser with WebSocket Bridge
 * 
 * Clean, minimal browser that opens external dApps in separate windows
 * with WebSocket provider injected for communication.
 */

import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

export function DappBrowserSimple() {
  const [url, setUrl] = useState('https://app.uniswap.org');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenDapp = async () => {
    if (!url) {
      setError('Please enter a URL');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('[DappBrowser] Opening:', url);

      // Open window with extension-style provider (injected by backend)
      // No need to fetch script - backend uses PROVIDER_SCRIPT_EXTENSION by default
      const windowLabel = await invoke('open_dapp_window', {
        url: url,
        title: 'dApp Browser',
        // initScript: undefined - use backend default (extension-style)
      });

      console.log('[DappBrowser] Opened window:', windowLabel);
      setLoading(false);
    } catch (err) {
      console.error('[DappBrowser] Failed to open:', err);
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleOpenDapp();
    }
  };

  const quickLinks = [
    { name: 'Uniswap', url: 'https://app.uniswap.org' },
    { name: 'PulseX', url: 'https://app.pulsex.com' },
    { name: 'Aave', url: 'https://app.aave.com' },
    { name: 'Local Test', url: 'http://localhost:1420/dapp-test-simple.html' },
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-6">
        <h1 className="text-2xl font-bold mb-2">🌐 dApp Browser</h1>
        <p className="text-gray-400 text-sm">
          Opens external dApps in separate windows with Vaughan provider
        </p>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-8">
        {/* URL Input */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            dApp URL
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="https://app.uniswap.org"
              className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              disabled={loading}
            />
            <button
              onClick={handleOpenDapp}
              disabled={loading || !url}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {loading ? 'Opening...' : 'Open dApp'}
            </button>
          </div>
          
          {error && (
            <div className="mt-3 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm">
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Quick Links</h2>
          <div className="grid grid-cols-2 gap-3">
            {quickLinks.map((link) => (
              <button
                key={link.url}
                onClick={() => setUrl(link.url)}
                className="px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-left transition-colors"
              >
                <div className="font-medium">{link.name}</div>
                <div className="text-xs text-gray-400 truncate">{link.url}</div>
              </button>
            ))}
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">🔧 How It Works (Extension-Style)</h2>
          <div className="space-y-3 text-sm text-gray-300">
            <div className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
              <div>
                <p className="font-medium text-white">Provider injected BEFORE page loads</p>
                <p className="text-gray-400">Like MetaMask extension - runs in privileged context</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
              <div>
                <p className="font-medium text-white">Bypasses CSP restrictions</p>
                <p className="text-gray-400">Works with Uniswap, Aave, and other CSP-protected sites</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
              <div>
                <p className="font-medium text-white">WebSocket communication</p>
                <p className="text-gray-400">Provider → ws://localhost:8766 → Rust Backend</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">4</span>
              <div>
                <p className="font-medium text-white">Full dApp compatibility</p>
                <p className="text-gray-400">Connect wallet, sign transactions, switch networks</p>
              </div>
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="mt-6 p-4 bg-green-900/30 border border-green-700 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-green-200 text-sm font-medium">WebSocket server running on ws://localhost:8766</span>
          </div>
        </div>
      </div>
    </div>
  );
}
