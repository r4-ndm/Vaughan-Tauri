/**
 * DappBrowserDirect Component
 * 
 * Opens dApps in separate WebView windows with provider injected directly
 * Works with 100% of dApps (no CSP issues!)
 * 
 * Architecture:
 * - Separate WebView window for each dApp
 * - Provider injected via initialization_script
 * - Communication via Tauri events (or custom events as fallback)
 * - Same backend as iframe mode
 */

import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

export function DappBrowserDirect() {
  const [url, setUrl] = useState('https://app.pulsex.com');
  const [title, setTitle] = useState('PulseX');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openWindows, setOpenWindows] = useState<Array<{ label: string; url: string; title: string }>>([]);

  /**
   * Open dApp in separate window
   */
  const handleOpen = async () => {
    if (!url) {
      setError('Please enter a URL');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('[DappBrowserDirect] Opening window:', url);
      
      const windowLabel = await invoke<string>('open_dapp_window', {
        url,
        title: title || undefined,
      });

      console.log('[DappBrowserDirect] Window opened:', windowLabel);

      // Add to open windows list
      setOpenWindows(prev => [...prev, { label: windowLabel, url, title: title || url }]);

      // Clear form
      setUrl('');
      setTitle('');
    } catch (err) {
      console.error('[DappBrowserDirect] Failed to open window:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  /**
   * Close window
   */
  const handleClose = async (label: string) => {
    try {
      await invoke('close_dapp', { windowLabel: label });
      setOpenWindows(prev => prev.filter(w => w.label !== label));
    } catch (err) {
      console.error('[DappBrowserDirect] Failed to close window:', err);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">
          Direct Injection Browser
        </h1>
        <p className="text-gray-400">
          Opens dApps in separate windows with provider injected directly. Works with 100% of dApps!
        </p>
      </div>

      {/* Open New Window Form */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold text-white mb-4">Open New dApp</h2>
        
        <div className="space-y-4">
          {/* URL Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              dApp URL
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleOpen()}
              placeholder="https://app.pulsex.com"
              className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Title Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Window Title (optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleOpen()}
              placeholder="PulseX"
              className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Error Display */}
          {error && (
            <div className="px-4 py-2 bg-red-900 text-red-100 rounded-lg text-sm">
              ⚠️ {error}
            </div>
          )}

          {/* Open Button */}
          <button
            onClick={handleOpen}
            disabled={loading || !url}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {loading ? 'Opening...' : '🚀 Open in New Window'}
          </button>
        </div>

        {/* Quick Links */}
        <div className="mt-6 pt-6 border-t border-gray-700">
          <p className="text-sm text-gray-400 mb-3">Quick Links:</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setUrl('https://app.pulsex.com');
                setTitle('PulseX');
              }}
              className="px-3 py-1 bg-gray-700 text-gray-300 rounded text-sm hover:bg-gray-600 transition-colors"
            >
              PulseX
            </button>
            <button
              onClick={() => {
                setUrl('https://app.uniswap.org');
                setTitle('Uniswap');
              }}
              className="px-3 py-1 bg-gray-700 text-gray-300 rounded text-sm hover:bg-gray-600 transition-colors"
            >
              Uniswap
            </button>
            <button
              onClick={() => {
                setUrl('http://localhost:1420/dapp-test-simple.html');
                setTitle('Test dApp');
              }}
              className="px-3 py-1 bg-gray-700 text-gray-300 rounded text-sm hover:bg-gray-600 transition-colors"
            >
              Local Test
            </button>
          </div>
        </div>
      </div>

      {/* Open Windows List */}
      <div className="bg-gray-800 rounded-lg p-6 flex-1 overflow-auto">
        <h2 className="text-xl font-semibold text-white mb-4">
          Open Windows ({openWindows.length})
        </h2>

        {openWindows.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 mb-2">No windows open</p>
            <p className="text-gray-500 text-sm">
              Open a dApp above to get started
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {openWindows.map((window) => (
              <div
                key={window.label}
                className="flex items-center justify-between p-4 bg-gray-700 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-medium truncate">
                    {window.title}
                  </h3>
                  <p className="text-gray-400 text-sm truncate">
                    {window.url}
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    {window.label}
                  </p>
                </div>
                <button
                  onClick={() => handleClose(window.label)}
                  className="ml-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm"
                >
                  Close
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-blue-900 border border-blue-700 rounded-lg p-4">
        <h3 className="text-blue-100 font-medium mb-2">ℹ️ How It Works</h3>
        <ul className="text-blue-200 text-sm space-y-1">
          <li>• Opens dApp in separate WebView window</li>
          <li>• Provider injected before page loads (bypasses CSP)</li>
          <li>• Works with 100% of dApps (no restrictions)</li>
          <li>• Same backend as iframe mode (secure)</li>
          <li>• Multiple windows supported</li>
        </ul>
      </div>
    </div>
  );
}
