/**
 * TransactionApproval Component
 * 
 * Modal for approving/rejecting transaction requests from dApps
 * Shows transaction details, gas estimates, and password input
 */

import { useState } from 'react';

interface TransactionApprovalProps {
  /** Approval request ID */
  id: string;
  /** dApp origin */
  origin: string;
  /** From address */
  from: string;
  /** To address */
  to: string;
  /** Value in ETH (human-readable) */
  value: string;
  /** Gas limit */
  gasLimit?: number;
  /** Gas price in wei */
  gasPrice?: string;
  /** Transaction data (hex) */
  data?: string;
  /** Callback when approved */
  onApprove: (id: string, password: string) => Promise<void>;
  /** Callback when rejected */
  onReject: (id: string) => Promise<void>;
  /** Callback when closed */
  onClose: () => void;
}

export function TransactionApproval({
  id,
  origin,
  from,
  to,
  value,
  gasLimit,
  gasPrice,
  data,
  onApprove,
  onReject,
}: TransactionApprovalProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Calculate estimated gas cost
   */
  const estimatedGasCost = (): string => {
    if (!gasLimit || !gasPrice) return 'Unknown';

    try {
      const gasPriceWei = BigInt(gasPrice);
      const totalWei = gasPriceWei * BigInt(gasLimit);
      const eth = Number(totalWei) / 1e18;
      return `${eth.toFixed(6)} ETH`;
    } catch {
      return 'Unknown';
    }
  };

  /**
   * Calculate total cost (value + gas)
   */
  const totalCost = (): string => {
    try {
      const valueEth = parseFloat(value.replace(' ETH', ''));
      const gasCostStr = estimatedGasCost();
      
      if (gasCostStr === 'Unknown') return 'Unknown';
      
      const gasCostEth = parseFloat(gasCostStr.replace(' ETH', ''));
      const total = valueEth + gasCostEth;
      
      return `${total.toFixed(6)} ETH`;
    } catch {
      return 'Unknown';
    }
  };

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
  const truncateAddress = (address: string): string => {
    if (address.length <= 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Transaction Request
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {origin}
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* From */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              From
            </label>
            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <p className="text-sm font-mono text-gray-900 dark:text-white">
                {truncateAddress(from)}
              </p>
            </div>
          </div>

          {/* To */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              To
            </label>
            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <p className="text-sm font-mono text-gray-900 dark:text-white">
                {truncateAddress(to)}
              </p>
            </div>
          </div>

          {/* Value */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Amount
            </label>
            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {value}
              </p>
            </div>
          </div>

          {/* Gas Estimate */}
          <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900 rounded-lg">
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Estimated Gas Cost
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Gas Limit: {gasLimit?.toLocaleString() || 'Unknown'}
              </p>
            </div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {estimatedGasCost()}
            </p>
          </div>

          {/* Total Cost */}
          <div className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Total (Amount + Gas)
            </p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {totalCost()}
            </p>
          </div>

          {/* Data (if present) */}
          {data && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Data
              </label>
              <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded-lg max-h-20 overflow-y-auto">
                <p className="text-xs font-mono text-gray-600 dark:text-gray-400 break-all">
                  {data}
                </p>
              </div>
            </div>
          )}

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
            {loading ? 'Processing...' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  );
}
