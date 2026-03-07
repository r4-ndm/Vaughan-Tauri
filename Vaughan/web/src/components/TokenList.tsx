import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, RefreshCw, Coins } from "lucide-react";
import {
    getTrackedTokens,
    getTokenBalance,
    removeCustomToken,
    TrackedToken
} from "../services/token";
import { AddTokenModal } from "./AddTokenModal";
import { invoke } from "@tauri-apps/api/core";

interface TokenListProps {
    nativeToken?: {
        balance: string;
        symbol: string;
    };
    activeAccount?: string | null;
    onRefresh?: () => void;
}

export function TokenList({ nativeToken, activeAccount, onRefresh }: TokenListProps) {
    const [isaddModalOpen, setIsAddModalOpen] = useState(false);
    const queryClient = useQueryClient();

    // We need chain_id for query key to ensure cache separation between networks
    const { data: networkInfo } = useQuery({
        queryKey: ["network"],
        queryFn: async () => invoke<{ chain_id: number }>("get_network_info"),
    });

    const { data: tokens, isLoading: isTokensLoading, refetch: refetchTokens } = useQuery({
        queryKey: ["tracked_tokens", networkInfo?.chain_id],
        queryFn: getTrackedTokens,
        enabled: !!networkInfo,
    });

    // We need to fetch balances for each token.
    // We can use a separate component for each row to handle its own balance fetching,
    // which effectively gives us parallel fetching and simpler error handling per token.

    const handleRefresh = () => {
        refetchTokens();
        onRefresh?.();
        // Also invalidate all token balances
        queryClient.invalidateQueries({ queryKey: ["token_balance"] });
    };

    const handleRemoveToken = async (address: string) => {
        if (!confirm("Are you sure you want to remove this token?")) return;
        try {
            await removeCustomToken(address);
            queryClient.invalidateQueries({ queryKey: ["tracked_tokens"] });
            refetchTokens();
        } catch (err) {
            console.error("Failed to remove token:", err);
        }
    };

    const handleTokenAdded = () => {
        // Refetch tokens list
        queryClient.invalidateQueries({ queryKey: ["tracked_tokens"] });
        refetchTokens();
    };

    return (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="p-4 border-b border-border flex justify-between items-center">
                <h3 className="font-bold flex items-center">
                    <Coins className="w-4 h-4 mr-2" />
                    Assets
                </h3>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={handleRefresh}
                        className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-secondary/50 transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex items-center space-x-1 bg-primary/10 hover:bg-primary/20 text-primary px-2 py-1 rounded-md text-xs font-medium transition-colors"
                    >
                        <Plus className="w-3 h-3" />
                        <span>Add Token</span>
                    </button>
                </div>
            </div>

            <div className="p-0">
                {/* Native Token Row */}
                {nativeToken && (
                    <div className="p-4 flex justify-between items-center border-b border-border/50 hover:bg-muted/10 transition-colors">
                        <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">
                                {nativeToken.symbol?.[0] || "E"}
                            </div>
                            <div>
                                <div className="font-medium">{nativeToken.symbol || "ETH"}</div>
                                <div className="text-xs text-muted-foreground">Native Token</div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="font-medium">{nativeToken.balance || "0.00"} {nativeToken.symbol}</div>
                        </div>
                    </div>
                )}

                {/* Tracked Tokens */}
                {isTokensLoading ? (
                    <div className="p-8 text-center text-muted-foreground text-sm">
                        Loading tokens...
                    </div>
                ) : tokens && tokens.length > 0 ? (
                    tokens.map((token) => (
                        <TokenRow
                            key={`${token.chain_id}-${token.address}`}
                            token={token}
                            account={activeAccount}
                            onRemove={() => handleRemoveToken(token.address)}
                        />
                    ))
                ) : (
                    tokens && tokens.length === 0 && !nativeToken && (
                        <div className="p-8 text-center text-muted-foreground text-sm">
                            No assets found. Add a custom token to get started.
                        </div>
                    )
                )}
            </div>

            <AddTokenModal
                isOpen={isaddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onTokenAdded={handleTokenAdded}
            />
        </div>
    );
}

// Sub-component for individual token row to handle balance fetching independently
function TokenRow({ token, account, onRemove }: { token: TrackedToken, account?: string | null, onRemove: () => void }) {
    const { data: balanceData, isLoading } = useQuery({
        queryKey: ["token_balance", token.address, account],
        queryFn: () => account ? getTokenBalance(token.address, account) : null,
        enabled: !!account,
        refetchInterval: 60000, // Refresh every minute
    });

    const formatTokenBalance = (bal: string | undefined) => {
        if (!bal) return "0.00";
        const num = parseFloat(bal);
        if (isNaN(num) || num === 0) return "0.00";
        if (Number.isInteger(num)) return num.toLocaleString();
        // Cap at 6 decimal places, trim trailing zeros
        return parseFloat(num.toFixed(6)).toString();
    };

    return (
        <div className="p-4 flex justify-between items-center border-b border-border/50 last:border-0 hover:bg-muted/10 transition-colors group">
            <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center font-bold text-xs ring-1 ring-border">
                    {token.symbol[0]}
                </div>
                <div>
                    <div className="font-medium">{token.symbol}</div>
                    <div className="text-xs text-muted-foreground">{token.name}</div>
                </div>
            </div>
            <div className="flex items-center space-x-4">
                <div className="text-right">
                    <div className="font-medium">
                        {isLoading ? (
                            <span className="text-muted-foreground text-xs">Loading...</span>
                        ) : (
                            <span>{formatTokenBalance(balanceData?.balance_formatted)}</span>
                        )}
                        <span className="text-xs text-muted-foreground ml-1">{token.symbol}</span>
                    </div>
                </div>
                <button
                    onClick={(e) => { e.stopPropagation(); onRemove(); }}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1"
                    title="Remove Token"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
