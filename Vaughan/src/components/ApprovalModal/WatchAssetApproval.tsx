import { useState } from 'react';

interface WatchAssetApprovalProps {
  id: string;
  origin: string;
  address: string;
  symbol: string;
  decimals: number;
  image?: string;
  onApprove: (id: string, password: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onClose: () => void;
}

/**
 * WatchAssetApproval - Modal for token addition requests (EIP-747)
 * 
 * Displays when a dApp requests to add a token to the wallet.
 * Shows token details and allows user to approve or reject.
 */
export function WatchAssetApproval({
  id,
  origin,
  address,
  symbol,
  decimals,
  image,
  onApprove,
  onReject,
  onClose,
}: WatchAssetApprovalProps) {
  const [loading, setLoading] = useState(false);

  const handleApprove = async () => {
    setLoading(true);
    try {
      // WatchAsset doesn't require a password, pass empty string
      await onApprove(id, '');
      onClose();
    } catch (error) {
      console.error('Failed to approve token:', error);
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    try {
      await onReject(id);
      onClose();
    } catch (error) {
      console.error('Failed to reject token:', error);
      setLoading(false);
    }
  };

  // Truncate address for display
  const truncatedAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Add Token</h2>
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
          <p className="text-sm text-slate-400 mt-2">
            {origin}
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Token Icon */}
          {image && (
            <div className="flex justify-center">
              <img 
                src={image} 
                alt={symbol}
                className="w-16 h-16 rounded-full"
                onError={(e) => {
                  // Hide image if it fails to load
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          )}

          {/* Token Details */}
          <div className="bg-slate-900 rounded-lg p-4 space-y-3">
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Symbol</div>
              <div className="text-white font-medium">{symbol}</div>
            </div>

            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Contract Address</div>
              <div className="text-white font-mono text-sm">{truncatedAddress}</div>
              <div className="text-xs text-slate-500 mt-1">{address}</div>
            </div>

            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Decimals</div>
              <div className="text-white">{decimals}</div>
            </div>
          </div>

          {/* Warning */}
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
            <div className="flex gap-2">
              <svg className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="text-sm text-yellow-200">
                <div className="font-medium mb-1">Verify token details</div>
                <div className="text-yellow-200/80">
                  Anyone can create a token with any name. Make sure this is the correct token before adding it.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-slate-700 flex gap-3">
          <button
            onClick={handleReject}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleApprove}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Adding...' : 'Add Token'}
          </button>
        </div>
      </div>
    </div>
  );
}
