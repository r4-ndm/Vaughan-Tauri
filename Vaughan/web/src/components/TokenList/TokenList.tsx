import React from 'react';
import { formatBalance, formatCurrency } from '../../utils/format';

export interface Token {
    address: string;
    symbol: string;
    name: string;
    balanceWei: string;
    decimals: number;
    usdPrice?: number;
    iconUrl?: string; // Optional custom icon
}

export interface TokenListProps {
    tokens: Token[];
    isLoading?: boolean;
    onTokenClick?: (token: Token) => void;
}

/**
 * TokenList component displays a scrollable list of tokens with their balances and USD values.
 */
export const TokenList: React.FC<TokenListProps> = ({
    tokens,
    isLoading = false,
    onTokenClick,
}) => {
    if (isLoading) {
        return (
            <div className="w-full h-full flex items-center justify-center p-8 bg-card border border-border">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    <p className="text-sm text-muted-foreground">Loading tokens...</p>
                </div>
            </div>
        );
    }

    if (tokens.length === 0) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-card border border-border text-center">
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-3">
                    <span className="text-xl">💰</span>
                </div>
                <h3 className="text-lg font-medium text-foreground mb-1">No tokens found</h3>
                <p className="text-sm text-muted-foreground max-w-[200px]">
                    You don't have any tokens on this network yet.
                </p>
            </div>
        );
    }

    return (
        <div className="w-full flex flex-col border border-border bg-card overflow-hidden">
            <div className="flex-1 overflow-y-auto max-h-[400px]">
                {tokens.map((token) => {
                    const formattedBalance = formatBalance(token.balanceWei, 6);

                    // Calculate USD Value if price is available
                    let usdValueDisplay = '';
                    if (token.usdPrice !== undefined) {
                        const numericBalance = parseFloat(formattedBalance);
                        if (!isNaN(numericBalance)) {
                            usdValueDisplay = formatCurrency(numericBalance * token.usdPrice);
                        }
                    }

                    return (
                        <div
                            key={token.address}
                            onClick={() => onTokenClick?.(token)}
                            className={`
                flex items-center justify-between p-4 border-b border-border last:border-b-0
                hover:bg-secondary cursor-pointer transition-colors
                ${onTokenClick ? 'active:bg-accent' : ''}
              `}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    onTokenClick?.(token);
                                }
                            }}
                        >
                            {/* Left Side: Icon & Name */}
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-secondary border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
                                    {token.iconUrl ? (
                                        <img src={token.iconUrl} alt={token.symbol} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-sm font-bold text-foreground">
                                            {token.symbol.substring(0, 2).toUpperCase()}
                                        </span>
                                    )}
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-semibold text-foreground">{token.symbol}</span>
                                    <span className="text-xs text-muted-foreground">{token.name}</span>
                                </div>
                            </div>

                            {/* Right Side: Balance & USD Value */}
                            <div className="flex flex-col items-end">
                                <span className="font-medium text-foreground">{formattedBalance}</span>
                                {usdValueDisplay && (
                                    <span className="text-xs text-muted-foreground">{usdValueDisplay}</span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
