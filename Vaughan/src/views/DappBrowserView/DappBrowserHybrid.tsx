/**
 * DappBrowserHybrid Component
 * 
 * Smart dApp browser with automatic fallback:
 * 1. Try iframe first (fast, better UX)
 * 2. Detect CSP errors
 * 3. Fall back to WalletConnect (universal compatibility)
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useProviderBridge } from '../../hooks/useProviderBridge';
import { useWalletConnect } from '../../hooks/useWalletConnect';
import { useApprovalPolling } from '../../hooks/useApprovalPolling';
import { TransactionApproval, ConnectionApproval } from '../../components/ApprovalModal';
import { WalletConnectModal } from '../../components/WalletConnectModal/WalletConnectModal';

type ConnectionMode = 'iframe' | 'walletconnect' | 'detecting';

export function DappBrowserHybrid() {
  // Get URL from query parameter
  const params = new URLSearchParams(window.location.search);
  const initialUrl = params.get('url') || 'http://localhost:1420/dapp-test-simple.html';
  
  const [url, setUrl] = useState(initialUrl);
  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [mode, setMode] = useState<ConnectionMode>('detecting');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWcModal, setShowWcModal] = useState(false);
  const iframeLoadTimeoutRef = useRef<number | null>(null);

  // Extract origin from URL
  const origin = new URL(currentUrl).origin;

  // Setup iframe provider bridge
  const { 
    iframeRef, 
    connect: connectIframe, 
    disconnect: disconnectIframe, 
    handleIframeLoad 
  } = useProviderBridge({
    origin,
    onConnect: () => {
      console.log('[DappBrowser] Iframe connected');
      setMode('iframe');
      setError(null);
    },
    onDisconnect: () => {
      console.log('[DappBrowser] Iframe disconnected');
    },
    onError: (err) => {
      console.error('[DappBrowser] Iframe error:', err);
      setError(err.message);
    },
  });

  // Setup WalletConnect
  const {
    sessions: wcSessions,
    connecting: wcConnecting,
    disconnect: disconnectWc,
  } = useWalletConnect({
    onSessionApproved: (session) => {
      console.log('[DappBrowser] WC session approved:', session);
      setMode('walletconnect');
      setShowWcModal(false);
      setError(null);
    },
    onSessionRejected: (err) => {
      console.error('[DappBrowser] WC session rejected:', err);
      setError('WalletConnect session rejected');
    },
    onSessionDeleted: (topic) => {
      console.log('[DappBrowser] WC session deleted:', topic);
      // If all sessions are gone, try iframe again
      if (wcSessions.length === 0) {
        setMode('detecting');
      }
    },
    onError: (err) => {
      console.error('[DappBrowser] WC error:', err);
      setError(err.message);
    },
  });

  // Setup approval polling
  const { currentApproval, respondToApproval, cancelApproval } = useApprovalPolling({
    enabled: true,
    onApprovalDetected: (approval) => {
      console.log('[DappBrowser] Approval detected:', approval);
    },
    onError: (err) => {
      console.error('[DappBrowser] Approval error:', err);
      setError(err.message);
    },
  });

  /**
   * Detect if iframe is blocked by CSP
   */
  const detectIframeSupport = useCallback(async (targetUrl: string) => {
    console.log('[DappBrowser] Detecting iframe support for:', targetUrl);
    
    try {
      // Try to fetch headers
      await fetch(targetUrl, { 
        method: 'HEAD',
        mode: 'no-cors', // Avoid CORS issues
      });

      // Note: With no-cors, we can't read headers, so we'll rely on iframe load events
      console.log('[DappBrowser] Fetch completed, trying iframe...');
      return true;
    } catch (err) {
      console.error('[DappBrowser] Fetch failed:', err);
      return false;
    }
  }, []);

  /**
   * Handle iframe load success
   */
  const handleIframeLoadSuccess = useCallback(() => {
    console.log('[DappBrowser] Iframe loaded successfully');
    
    // Clear timeout
    if (iframeLoadTimeoutRef.current) {
      clearTimeout(iframeLoadTimeoutRef.current);
      iframeLoadTimeoutRef.current = null;
    }
    
    setLoading(false);
    setMode('iframe');
    handleIframeLoad();
  }, [handleIframeLoad]);

  /**
   * Handle iframe load error (CSP block)
   */
  const handleIframeLoadError = useCallback(async () => {
    console.log('[DappBrowser] Iframe failed to load - switching to WalletConnect');
    
    // Clear timeout
    if (iframeLoadTimeoutRef.current) {
      clearTimeout(iframeLoadTimeoutRef.current);
      iframeLoadTimeoutRef.current = null;
    }
    
    setLoading(false);
    setMode('walletconnect');
    setShowWcModal(true);
    setError('This dApp blocks iframe embedding. Use WalletConnect to connect.');
  }, []);

  /**
   * Handle URL navigation
   */
  const handleNavigate = useCallback(async () => {
    try {
      const parsedUrl = new URL(url);
      setCurrentUrl(parsedUrl.href);
      setLoading(true);
      setError(null);
      setMode('detecting');
      
      // Clear any existing timeout
      if (iframeLoadTimeoutRef.current) {
        clearTimeout(iframeLoadTimeoutRef.current);
      }
      
      // Set timeout to detect CSP block (3 seconds)
      iframeLoadTimeoutRef.current = setTimeout(() => {
        console.log('[DappBrowser] Iframe load timeout - assuming CSP block');
        handleIframeLoadError();
      }, 3000);
      
      // Try to detect iframe support
      await detectIframeSupport(parsedUrl.href);
    } catch (err) {
      setError('Invalid URL');
      setLoading(false);
    }
  }, [url, detectIframeSupport, handleIframeLoadError]);

  /**
   * Handle connect button
   */
  const handleConnect = useCallback(async () => {
    if (mode === 'iframe') {
      await connectIframe();
    } else if (mode === 'walletconnect') {
      // Show WC modal with instructions
      setShowWcModal(true);
    }
  }, [mode, connectIframe]);

  /**
   * Handle disconnect button
   */
  const handleDisconnect = useCallback(async () => {
    if (mode === 'iframe') {
      await disconnectIframe();
    } else if (mode === 'walletconnect' && wcSessions.length > 0) {
      // Disconnect first session
      await disconnectWc(wcSessions[0].topic);
    }
  }, [mode, disconnectIframe, disconnectWc, wcSessions]);

  /**
   * Handle approval
   */
  const handleApprove = async (id: string, password: string) => {
    await respondToApproval({
      id,
      approved: true,
      data: { password },
    });
  };

  /**
   * Handle rejection
   */
  const handleReject = async (id: string) => {
    await respondToApproval({
      id,
      approved: false,
      data: undefined,
    });
  };

  /**
   * Handle modal close
   */
  const handleModalClose = async () => {
    if (currentApproval) {
      try {
        await cancelApproval(currentApproval.id);
      } catch (err) {
        // Ignore "not found" errors - approval may have already been cleared
        console.log('[DappBrowser] Modal close (approval may be already cleared)');
      }
    }
  };

  /**
   * Check connection status
   */
  const isConnected = mode === 'iframe' || (mode === 'walletconnect' && wcSessions.length > 0);

  /**
   * Cleanup timeout on unmount
   */
  useEffect(() => {
    return () => {
      if (iframeLoadTimeoutRef.current) {
        clearTimeout(iframeLoadTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Address Bar */}
      <div className="flex items-center gap-2 p-4 bg-gray-800 border-b border-gray-700">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleNavigate()}
          placeholder="Enter dApp URL"
          className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={handleNavigate}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Go
        </button>
        {isConnected ? (
          <button
            onClick={handleDisconnect}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Disconnect
          </button>
        ) : (
          <button
            onClick={handleConnect}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Connect
          </button>
        )}
      </div>

      {/* Connection Status */}
      {isConnected && (
        <div className="px-4 py-2 bg-green-900 text-green-100 text-sm border-b border-green-800 flex items-center justify-between">
          <span>
            🔗 Connected via {mode === 'iframe' ? 'Iframe' : 'WalletConnect'} to {origin}
          </span>
          {mode === 'walletconnect' && wcSessions.length > 0 && (
            <span className="text-xs">
              Session: {wcSessions[0].peer.metadata.name}
            </span>
          )}
        </div>
      )}

      {/* Mode Indicator */}
      {mode === 'detecting' && (
        <div className="px-4 py-2 bg-blue-900 text-blue-100 text-sm border-b border-blue-800">
          🔍 Detecting connection method...
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="px-4 py-2 bg-red-900 text-red-100 text-sm border-b border-red-800">
          ⚠️ {error}
        </div>
      )}

      {/* Loading Indicator */}
      {loading && (
        <div className="px-4 py-2 bg-blue-900 text-blue-100 text-sm border-b border-blue-800">
          Loading...
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 relative">
        {/* Iframe Mode */}
        {(mode === 'iframe' || mode === 'detecting') && (
          <iframe
            ref={iframeRef}
            src={currentUrl}
            onLoad={handleIframeLoadSuccess}
            onError={handleIframeLoadError}
            sandbox="allow-scripts allow-same-origin allow-forms"
            allow="clipboard-write"
            className="w-full h-full border-0"
            title="dApp Browser"
          />
        )}

        {/* WalletConnect Mode */}
        {mode === 'walletconnect' && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-2xl px-4">
              {/* Header */}
              <div className="mb-8">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-900 rounded-full mb-4">
                  <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h2 className="text-3xl font-bold text-white mb-2">
                  WalletConnect Mode
                </h2>
                <p className="text-gray-400 text-sm">
                  This dApp blocks iframe embedding due to security policies
                </p>
              </div>

              {/* Instructions Card */}
              <div className="bg-gray-800 rounded-xl p-6 mb-6 text-left">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <span className="text-2xl">📱</span>
                  How to Connect
                </h3>
                <ol className="space-y-4">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                    <div>
                      <p className="text-white font-medium">Open the dApp in your browser</p>
                      <p className="text-gray-400 text-sm mt-1">Copy the URL below and paste it in Chrome, Firefox, or any browser</p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                    <div>
                      <p className="text-white font-medium">Click "Connect Wallet"</p>
                      <p className="text-gray-400 text-sm mt-1">Look for the wallet connection button on the dApp</p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                    <div>
                      <p className="text-white font-medium">Select "WalletConnect"</p>
                      <p className="text-gray-400 text-sm mt-1">Choose WalletConnect from the available wallet options</p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">4</span>
                    <div>
                      <p className="text-white font-medium">Approve the connection</p>
                      <p className="text-gray-400 text-sm mt-1">Vaughan will automatically detect and prompt you to approve</p>
                    </div>
                  </li>
                </ol>
              </div>

              {/* URL Display */}
              <div className="bg-gray-900 rounded-lg p-4 mb-4">
                <p className="text-gray-400 text-xs mb-2">dApp URL:</p>
                <p className="text-blue-400 text-sm font-mono break-all">{currentUrl}</p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(currentUrl);
                  }}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  📋 Copy URL
                </button>
                {!showWcModal && (
                  <button
                    onClick={() => setShowWcModal(true)}
                    className="flex-1 px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
                  >
                    ℹ️ Show Details
                  </button>
                )}
              </div>

              {/* Active Session Display */}
              {wcSessions.length > 0 && (
                <div className="mt-6 bg-green-900 border border-green-700 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <h3 className="text-green-100 font-medium">Connected</h3>
                  </div>
                  <p className="text-green-200 text-sm">{wcSessions[0].peer.metadata.name}</p>
                  <p className="text-green-300 text-xs mt-1">{wcSessions[0].peer.metadata.url}</p>
                </div>
              )}

              {/* Status */}
              {wcSessions.length === 0 && (
                <div className="mt-6 flex items-center justify-center gap-2 text-gray-400">
                  <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                  <span className="text-sm">Waiting for WalletConnect session...</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* WalletConnect Modal */}
      {showWcModal && (
        <WalletConnectModal
          uri="wc:placeholder-uri" // TODO: Get actual URI from WC session
          connecting={wcConnecting}
          dappUrl={currentUrl}
          onClose={() => setShowWcModal(false)}
        />
      )}

      {/* Connection Approval Modal */}
      {currentApproval && currentApproval.request_type.type === 'connection' && (
        <ConnectionApproval
          id={currentApproval.id}
          origin={currentApproval.request_type.origin}
          onApprove={async (id) => {
            await respondToApproval({
              id,
              approved: true,
              data: undefined,
            });
          }}
          onReject={handleReject}
          onClose={handleModalClose}
        />
      )}

      {/* Transaction Approval Modal */}
      {currentApproval && currentApproval.request_type.type === 'transaction' && (
        <TransactionApproval
          id={currentApproval.id}
          origin={currentApproval.request_type.origin}
          from={currentApproval.request_type.from}
          to={currentApproval.request_type.to}
          value={currentApproval.request_type.value}
          gasLimit={currentApproval.request_type.gasLimit}
          gasPrice={currentApproval.request_type.gasPrice}
          data={currentApproval.request_type.data}
          onApprove={handleApprove}
          onReject={handleReject}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
}
