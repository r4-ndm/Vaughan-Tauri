/**
 * DappBrowserStandalone Component
 * 
 * Standalone dApp browser for separate window
 * No routing dependencies - works independently
 */

import { useState } from 'react';
import { useProviderBridge } from '../../hooks/useProviderBridge';
import { useApprovalPolling } from '../../hooks/useApprovalPolling';
import { TransactionApproval, ConnectionApproval } from '../../components/ApprovalModal';
import { PersonalSignApproval } from '../../components/ApprovalModal/PersonalSignApproval';
import { WatchAssetApproval } from '../../components/ApprovalModal/WatchAssetApproval';

export function DappBrowserStandalone() {
  // Get URL from query parameter or default to test page
  const params = new URLSearchParams(window.location.search);
  const dappUrl = params.get('url') || 'http://localhost:1420/dapp-test-simple.html';
  
  const [url, setUrl] = useState(dappUrl);
  const [currentUrl, setCurrentUrl] = useState(dappUrl);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Extract origin from URL
  const origin = new URL(currentUrl).origin;

  // Setup provider bridge
  const { iframeRef, connect, disconnect, handleIframeLoad } = useProviderBridge({
    origin,
    onConnect: () => {
      setIsConnected(true);
      setError(null);
    },
    onDisconnect: () => {
      setIsConnected(false);
    },
    onError: (err) => {
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
   * Handle URL navigation
   */
  const handleNavigate = () => {
    try {
      const parsedUrl = new URL(url);
      setCurrentUrl(parsedUrl.href);
      setLoading(true);
      setError(null);
    } catch (err) {
      setError('Invalid URL');
    }
  };

  /**
   * Handle iframe load
   */
  const handleLoad = () => {
    setLoading(false);
    handleIframeLoad();
  };

  /**
   * Handle connect button
   */
  const handleConnect = async () => {
    try {
      await connect();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    }
  };

  /**
   * Handle disconnect button
   */
  const handleDisconnect = async () => {
    try {
      await disconnect();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Disconnect failed');
    }
  };

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
        <div className="px-4 py-2 bg-green-900 text-green-100 text-sm border-b border-green-800">
          🔗 Connected to {origin}
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

      {/* dApp iframe */}
      <iframe
        ref={iframeRef}
        src={currentUrl}
        onLoad={handleLoad}
        sandbox="allow-scripts allow-same-origin allow-forms"
        allow="clipboard-write"
        className="flex-1 w-full border-0"
        title="dApp Browser"
      />

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

      {/* Personal Sign Approval Modal */}
      {currentApproval && currentApproval.request_type.type === 'personalSign' && (
        <PersonalSignApproval
          id={currentApproval.id}
          origin={currentApproval.request_type.origin}
          address={currentApproval.request_type.address}
          message={currentApproval.request_type.message}
          onApprove={handleApprove}
          onReject={handleReject}
          onClose={handleModalClose}
        />
      )}

      {/* Watch Asset Approval Modal */}
      {currentApproval && currentApproval.request_type.type === 'watchAsset' && (
        <WatchAssetApproval
          id={currentApproval.id}
          origin={currentApproval.request_type.origin}
          address={currentApproval.request_type.address}
          symbol={currentApproval.request_type.symbol}
          decimals={currentApproval.request_type.decimals}
          image={currentApproval.request_type.image}
          onApprove={handleApprove}
          onReject={handleReject}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
}
