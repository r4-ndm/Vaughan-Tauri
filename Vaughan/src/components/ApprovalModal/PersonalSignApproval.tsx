/**
 * PersonalSignApproval Component
 * 
 * Modal for approving/rejecting personal_sign requests from dApps
 * Shows message to sign and requires password
 */

import { useState } from 'react';

interface PersonalSignApprovalProps {
  /** Approval request ID */
  id: string;
  /** dApp origin */
  origin: string;
  /** Address to sign with */
  address: string;
  /** Message to sign (human-readable) */
  message: string;
  /** Callback when approved */
  onApprove: (id: string, password: string) => Promise<void>;
  /** Callback when rejected */
  onReject: (id: string) => Promise<void>;
  /** Callback when closed */
  onClose: () => void;
}

export function PersonalSignApproval({
  id,
  origin,
  address,
  message,
  onApprove,
  onReject,
}: PersonalSignApprovalProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handle approve button
   */
  const handleApprove = async () => {
    if (!password) {
      setError('Password is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onApprove(id, password);
      // Don't call onClose() - parent handles it
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval failed');
      setLoading(false);
    }
  };

  /**
   * Handle reject button
   */
  const handleReject = async () => {
    setLoading(true);
    setError(null);

    try {
      await onReject(id);
      // Don't call onClose() - parent handles it
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rejection failed');
      setLoading(false);
    }
  };

  /**
   * Truncate address for display
   */
  const truncateAddress = (addr: string): string => {
    if (addr.length <= 10) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Signature Request
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {origin}
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* Account */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Account
            </label>
            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <p className="text-sm font-mono text-gray-900 dark:text-white">
                {truncateAddress(address)}
              </p>
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Message
            </label>
            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded-lg max-h-40 overflow-y-auto">
              <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap break-words">
                {message}
              </p>
            </div>
          </div>

          {/* Warning */}
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              ⚠️ Only sign messages from websites you trust. Signing malicious messages can give attackers access to your funds.
            </p>
          </div>

          {/* Password Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleApprove()}
              placeholder="Enter your password"
              className="
                w-full px-4 py-2 rounded-lg
                border border-gray-300 dark:border-gray-600
                bg-white dark:bg-gray-800
                text-gray-900 dark:text-white
                focus:outline-none focus:ring-2 focus:ring-blue-500
                placeholder-gray-400 dark:placeholder-gray-500
              "
              disabled={loading}
              autoFocus
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="px-3 py-2 bg-red-50 dark:bg-red-900 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-200">
                {error}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
          <button
            onClick={handleReject}
            disabled={loading}
            className="
              flex-1 px-4 py-2 rounded-lg
              bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600
              text-gray-900 dark:text-white font-medium
              transition-colors duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            Reject
          </button>
          <button
            onClick={handleApprove}
            disabled={loading || !password}
            className="
              flex-1 px-4 py-2 rounded-lg
              bg-blue-500 hover:bg-blue-600 active:bg-blue-700
              text-white font-medium
              transition-colors duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            {loading ? 'Signing...' : 'Sign'}
          </button>
        </div>
      </div>
    </div>
  );
}
