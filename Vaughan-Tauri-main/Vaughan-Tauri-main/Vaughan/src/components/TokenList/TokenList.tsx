import { useState, useEffect } from 'react';
import { TauriService } from '../../services/tauri';
import { formatBalance, formatUSD } from '../../utils/format';
import type { TokenBalance } from '../../types';

/**
 * TokenList Component
 * 
 * Displays a scrollable list of token balances.
 * Shows token symbol, balance, and USD value.
 */
export function TokenList() {
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTokens() {
      try {
        setLoading(true);
        setError(null);

        // Get accounts to find active account
        const accounts = await TauriService.getAccounts();
        if (accounts.length === 0) {
          setTokens([]);
          return;
        }

        // Use first account (active account)
        const activeAccount = accounts[0];

        // Get network info for native token
        const networkInfo = await TauriService.getNetworkInfo();
        
        // Get native token balance
        const balanceResponse = await TauriService.getBalance(activeAccount.address);
        
        // Get native token price
        let nativeTokenPrice = 0;
        try {
          // TODO: Backend get_token_price needs symbol parameter
          // const priceResponse = await TauriService.getTokenPrice(networkInfo.native_token.symbol);
          // nativeTokenPrice = priceResponse.price_usd;
          // For now, use mock price
          nativeTokenPrice = networkInfo.native_token.symbol === 'ETH' ? 2000 : 1;
        } catch (priceError) {
          console.warn('Failed to fetch native token price:', priceError);
        }

        // Create native token entry
        const nativeToken: TokenBalance = {
          contract_address: '0x0000000000000000000000000000000000000000',
          symbol: networkInfo.native_token.symbol,
          name: networkInfo.native_token.name,
          decimals: networkInfo.native_token.decimals,
          balance: balanceResponse.balance_wei,
          price_usd: nativeTokenPrice,
        };

        // TODO: Get ERC-20 token balances when backend supports it
        // For now, just show native token
        setTokens([nativeToken]);
      } catch (err) {
        console.error('Failed to load tokens:', err);
        setError('Failed to load tokens');
        setTokens([]);
      } finally {
        setLoading(false);
      }
    }

    loadTokens();

    // Refresh tokens every 30 seconds
    const interval = setInterval(loadTokens, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-4" />
        <span className="text-slate-400 text-sm">Loading tokens...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="text-red-400 mb-2">⚠️</div>
        <span className="text-red-400 text-sm">{error}</span>
      </div>
    );
  }

  if (tokens.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="text-slate-500 mb-2">💰</div>
        <span className="text-slate-400 text-sm">No tokens found</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tokens.map((token) => {
        const formattedBalance = formatBalance(token.balance, token.decimals, 6);
        const balanceValue = parseFloat(formattedBalance);
        const usdValue = balanceValue * token.price_usd;

        return (
          <div
            key={token.contract_address}
            className="flex items-center gap-4 p-4 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            {/* Token icon */}
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold flex-shrink-0">
              {token.symbol.charAt(0)}
            </div>

            {/* Token info */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-100">
                {token.symbol}
              </div>
              <div className="text-xs text-slate-400">
                {token.name}
              </div>
            </div>

            {/* Balance */}
            <div className="text-right">
              <div className="text-sm font-medium text-slate-100">
                {formattedBalance}
              </div>
              {token.price_usd > 0 && (
                <div className="text-xs text-slate-400">
                  {formatUSD(usdValue)}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
