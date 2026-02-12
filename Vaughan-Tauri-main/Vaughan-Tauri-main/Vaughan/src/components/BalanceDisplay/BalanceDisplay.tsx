import { useState, useEffect } from 'react';
import { TauriService } from '../../services/tauri';
import { formatBalance, formatUSD } from '../../utils/format';

/**
 * BalanceDisplay Component
 * 
 * Displays the user's native token balance prominently.
 * Shows both the token amount and USD value.
 */
export function BalanceDisplay() {
  const [balance, setBalance] = useState<string>('0');
  const [usdValue, setUsdValue] = useState<number>(0);
  const [symbol, setSymbol] = useState<string>('ETH');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    async function loadBalance() {
      try {
        setLoading(true);
        setError(null);

        // Get current network info for symbol
        const networkInfo = await TauriService.getNetworkInfo();
        setSymbol(networkInfo.native_token.symbol);

        // Get accounts to find active account
        const accounts = await TauriService.getAccounts();
        if (accounts.length === 0) {
          setBalance('0');
          setUsdValue(0);
          return;
        }

        // Use first account (active account)
        const activeAccount = accounts[0];

        // Get balance
        const balanceResponse = await TauriService.getBalance(activeAccount.address);
        setBalance(balanceResponse.balance_wei);

        // Get token price for USD value
        try {
          // TODO: Backend get_token_price needs symbol parameter
          // const priceResponse = await TauriService.getTokenPrice(symbol);
          // For now, use mock price
          const mockPrice = symbol === 'ETH' ? 2000 : 1;
          const balanceInEth = parseFloat(formatBalance(balanceResponse.balance_wei, 18, 6));
          setUsdValue(balanceInEth * mockPrice);
        } catch (priceError) {
          console.warn('Failed to fetch token price:', priceError);
          setUsdValue(0);
        }
      } catch (err) {
        console.error('Failed to load balance:', err);
        setError('Failed to load balance');
        setBalance('0');
        setUsdValue(0);
      } finally {
        setLoading(false);
      }
    }

    loadBalance();

    // Refresh balance every 30 seconds
    const interval = setInterval(loadBalance, 30000);
    return () => clearInterval(interval);
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-4" />
        <span className="text-slate-400">Loading balance...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="text-red-400 mb-2">⚠️</div>
        <span className="text-red-400 text-sm">{error}</span>
      </div>
    );
  }

  const formattedBalance = formatBalance(balance, 18, 6);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="flex flex-col items-center justify-center py-8">
      {/* Token Amount */}
      <div className="text-5xl font-bold text-slate-100 mb-2">
        {formattedBalance} {symbol}
      </div>

      {/* USD Value */}
      {usdValue > 0 && (
        <div className="text-2xl text-slate-400">
          {formatUSD(usdValue)}
        </div>
      )}

      {/* Refresh controls */}
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <svg 
            className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
            />
          </svg>
          Refresh
        </button>
        <span className="text-xs text-slate-500">
          Auto-updates every 30s
        </span>
      </div>
    </div>
  );
}
