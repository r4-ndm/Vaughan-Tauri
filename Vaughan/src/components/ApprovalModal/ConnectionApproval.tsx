/**
 * ConnectionApproval Component
 * 
 * Modal for approving dApp connection requests
 */

import { useState } from 'react';

interface ConnectionApprovalProps {
  /** Request ID */
  id: string;
  /** dApp origin */
  origin: string;
  /** Approve callback */
  onApprove: (id: string) => Promise<void>;
  /** Reject callback */
  onReject: (id: string) => Promise<void>;
  /** Close callback */
  onClose: () => void;
}

export function ConnectionApproval({
  id,
  origin,
  onApprove,
  onReject,
  onClose,
}: ConnectionApprovalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handle approve
   */
  const handleApprove = async () => {
    try {
      setLoading(true);
      setError(null);
      await onApprove(id);
      // Don't call onClose() - parent handles it
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval failed');
      setLoading(false);
    }
  };

  /**
   * Handle reject
   */
  const handleReject = async () => {
    try {
      setLoading(true);
      setError(null);
      await onReject(id);
      // Don't call onClose() - parent handles it
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rejection failed');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Connection Request</h2>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* Origin */}
          <div>
            <p className="text-gray-400 text-sm mb-2">dApp wants to connect:</p>
            <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
              <p className="text-white font-mono text-sm break-all">{origin}</p>
            </div>
          </div>

          {/* Permissions */}
          <div>
            <p className="text-gray-400 text-sm mb-2">This will allow the dApp to:</p>
            <ul className="space-y-2 text-sm text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>View your account address</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>Request transaction approvals</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>Request message signatures</span>
              </li>
            </ul>
          </div>

          {/* Warning */}
          <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3">
            <p className="text-yellow-200 text-sm">
              ⚠️ Only connect to websites you trust
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3">
              <p className="text-red-200 text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-gray-700 flex gap-3">
          <button
            onClick={handleReject}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reject
          </button>
          <button
            onClick={handleApprove}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Connecting...' : 'Connect'}
          </button>
        </div>
      </div>
    </div>
  );
}
