import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, RefreshCw, ArrowDownLeft, ArrowUpRight, Copy, Check, ExternalLink, Shield } from "lucide-react";
import { Layout } from "../../components/Layout";
import { PreferencesService } from "../../services/tauri";
import { railgunClient } from "../../services/railgunWorkerClient";

/** Returns [copy fn, isCopied fn] — isCopied(key) is true for 1.5s after copy(key, text) */
function useCopy(): [(key: string, text: string) => void, (key: string) => boolean] {
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const copy = useCallback((key: string, text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedKey(key);
            setTimeout(() => setCopiedKey(null), 1500);
        });
    }, []);
    const isCopied = useCallback((key: string) => copiedKey === key, [copiedKey]);
    return [copy, isCopied];
}

interface TxRecord {
    hash: string;
    from: string;
    to: string;
    value: string;
    gas_used: string;
    gas_price: string;
    block_number: number;
    timestamp: number;
    status: number;
    input: string;
    native_symbol: string;
    token_symbol?: string;
    token_address?: string;
    is_token_transfer: boolean;
}

export function HistoryView() {
    const navigate = useNavigate();
    const [copy, isCopied] = useCopy();

    const { data: accounts } = useQuery({
        queryKey: ["accounts"],
        queryFn: async () => invoke<any[]>("get_accounts"),
    });

    const activeAccount = accounts?.[0]?.address;

    // Get network info for explorer URL and native symbol
    const { data: networkInfo } = useQuery({
        queryKey: ["network_info"],
        queryFn: async () => invoke<{ explorer_url: string; chain_id: number; native_token: { symbol: string } }>("get_network_info"),
        staleTime: 30_000,
    });

    const explorerUrl = networkInfo?.explorer_url ?? "";

    const openInExplorer = useCallback((hash: string) => {
        if (!explorerUrl) return;
        window.open(`${explorerUrl}/tx/${hash}`, "_blank", "noopener,noreferrer");
    }, [explorerUrl]);

    const [privacyEnabled, setPrivacyEnabled] = useState(false);
    const [isShieldMode, setIsShieldMode] = useState(false);

    // Fetch user preferences on mount to determine if we show the Privacy toggles
    useState(() => {
        PreferencesService.getUserPreferences().then(prefs => {
            setPrivacyEnabled(prefs.privacy_enabled);
        });
    });

    const { data: transactions, isLoading, refetch } = useQuery({
        queryKey: ["transactions", activeAccount, isShieldMode, networkInfo?.chain_id],
        queryFn: async (): Promise<TxRecord[]> => {
            if (!activeAccount) return [];

            if (isShieldMode) {
                if (!networkInfo?.chain_id) return [];
                const history = await railgunClient.getHistory(networkInfo.chain_id);

                // Map Railgun's TransactionHistoryItem[] to our UI's TxRecord[]
                return history.map((tx: any) => {
                    let from = "Shadow Engine";
                    let to = "Shadow Engine";
                    let value = "0";
                    let token_symbol = tx.changeERC20Amounts?.[0]?.tokenAddress || "";
                    let isIncoming = false;

                    const cat = tx.category;
                    if (cat === "ShieldERC20s") {
                        value = tx.receiveERC20Amounts[0]?.amountString || "0";
                        isIncoming = true;
                    } else if (cat === "UnshieldERC20s") {
                        value = tx.unshieldERC20Amounts[0]?.amountString || "0";
                        isIncoming = false;
                        to = "Public EVM";
                    } else if (cat === "TransferSendERC20s") {
                        value = tx.transferERC20Amounts[0]?.amountString || "0";
                        isIncoming = false;
                        to = "Shielded Recipient";
                    } else if (cat === "TransferReceiveERC20s") {
                        value = tx.receiveERC20Amounts[0]?.amountString || "0";
                        isIncoming = true;
                        from = "Shielded Sender";
                    }

                    // For now we assume Railgun's value string is display-ready (it may require decimals translation depending on the SDK raw output, but we map the string directly for 4.5.4)

                    return {
                        hash: tx.txid,
                        from: isIncoming ? from : activeAccount,
                        to: isIncoming ? activeAccount : to,
                        value,
                        gas_used: "0",
                        gas_price: "0",
                        block_number: tx.blockNumber || 0,
                        timestamp: tx.timestamp || Math.floor(Date.now() / 1000),
                        status: 1, // Railgun history items are mined
                        input: "0x",
                        native_symbol: "zkToken",
                        token_symbol,
                        is_token_transfer: false,
                    };
                });
            }

            // Standard Public EVM transaction history
            return invoke<TxRecord[]>("get_transactions", {
                address: activeAccount,
                limit: 50,
            });
        },
        enabled: !!activeAccount,
    });

    return (
        <Layout showActions={false}>
            {/* Header */}
            <div className="flex items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate("/dashboard")}
                        className="p-2 hover:bg-secondary rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-xl font-semibold">Transaction History</h1>
                </div>

                <div className="flex items-center gap-3">
                    {privacyEnabled && (
                        <button
                            onClick={() => setIsShieldMode(!isShieldMode)}
                            className={`flex items-center px-3 py-1.5 rounded text-sm font-medium transition-all ${isShieldMode ? 'bg-primary/20 text-primary border border-primary/50' : 'bg-card border border-border text-muted-foreground hover:bg-secondary'}`}
                            title="Toggle Privacy History View"
                        >
                            <Shield className={`w-3.5 h-3.5 mr-1.5 ${isShieldMode ? 'animate-pulse' : ''}`} />
                            {isShieldMode ? "Shielded" : "Public"}
                        </button>
                    )}
                    <button
                        onClick={() => refetch()}
                        className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-colors text-sm"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="bg-card border border-border rounded-lg min-h-[400px]">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground space-y-4">
                        <div className="animate-spin h-8 w-8 border-b-2 border-primary rounded-full" />
                        <p className="text-sm">Fetching transaction history...</p>
                    </div>
                ) : !transactions || transactions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 h-64 text-center space-y-4">
                        <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-2">
                            <Clock className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <div>
                            <h3 className="text-base font-medium">No transactions yet</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                This address has no transaction history.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="p-4">
                        <span className="text-sm font-medium text-muted-foreground block mb-4">
                            {transactions.length} Transactions
                        </span>
                        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                            {transactions.map((tx, i) => {
                                const isIncoming =
                                    tx.to.toLowerCase() === activeAccount?.toLowerCase();

                                return (
                                    <div
                                        key={i}
                                        className="flex flex-col gap-2 p-3 bg-background border border-border/50 rounded hover:border-border transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div
                                                className={`w-8 h-8 rounded shrink-0 flex items-center justify-center ${isShieldMode ? "bg-primary/20 text-primary border border-primary/30" : isIncoming
                                                    ? "bg-green-500/10 text-green-500"
                                                    : "bg-orange-500/10 text-orange-500"
                                                    }`}
                                            >
                                                {isShieldMode ? (
                                                    <Shield className="w-4 h-4" />
                                                ) : isIncoming ? (
                                                    <ArrowDownLeft className="w-4 h-4" />
                                                ) : (
                                                    <ArrowUpRight className="w-4 h-4" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-center">
                                                    <span
                                                        className={`text-sm font-medium ${isIncoming
                                                            ? "text-green-500"
                                                            : "text-orange-500"
                                                            }`}
                                                    >
                                                        {isIncoming ? "Received" : "Sent"}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground tabular-nums">
                                                        {new Date(tx.timestamp * 1000).toLocaleString()}
                                                    </span>
                                                </div>
                                                <div className="flex items-baseline gap-2 mt-0.5">
                                                    <span className="text-xs text-muted-foreground">
                                                        Amount:
                                                    </span>
                                                    <span className="text-sm text-yellow-500 font-medium">
                                                        {tx.value} {tx.is_token_transfer ? (tx.token_symbol ?? 'TOKEN') : tx.native_symbol}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 mt-2 pt-2 border-t border-border/50 text-xs">
                                            {/* Address — click to copy */}
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-muted-foreground">
                                                    {isIncoming ? "From:" : "To:"}
                                                </span>
                                                <button
                                                    type="button"
                                                    title="Click to copy"
                                                    onClick={() => copy(`addr:${i}`, isIncoming ? tx.from : tx.to)}
                                                    className="flex items-center gap-1 font-mono text-foreground/80 hover:text-foreground transition-colors group"
                                                >
                                                    {isCopied(`addr:${i}`) ? (
                                                        <span className="text-green-500 flex items-center gap-1">
                                                            <Check className="w-3 h-3" /> Copied!
                                                        </span>
                                                    ) : (
                                                        <>
                                                            {(isIncoming ? tx.from : tx.to).slice(0, 6)}...{(isIncoming ? tx.from : tx.to).slice(-4)}
                                                            <Copy className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                                                        </>
                                                    )}
                                                </button>
                                            </div>

                                            {/* Hash — click to copy or open in explorer */}
                                            <div className="flex items-center gap-1.5 ml-auto">
                                                <span className="text-muted-foreground">Hash:</span>
                                                <button
                                                    type="button"
                                                    title="Click to copy hash"
                                                    onClick={() => copy(`hash:${i}`, tx.hash)}
                                                    className="flex items-center gap-1 font-mono text-foreground/80 hover:text-foreground transition-colors group"
                                                >
                                                    {isCopied(`hash:${i}`) ? (
                                                        <span className="text-green-500 flex items-center gap-1">
                                                            <Check className="w-3 h-3" /> Copied!
                                                        </span>
                                                    ) : (
                                                        <>
                                                            {tx.hash.slice(0, 6)}...{tx.hash.slice(-4)}
                                                            <Copy className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                                                        </>
                                                    )}
                                                </button>
                                                {explorerUrl && (
                                                    <button
                                                        type="button"
                                                        title="Open in block explorer"
                                                        onClick={() => openInExplorer(tx.hash)}
                                                        className="text-muted-foreground hover:text-primary transition-colors ml-0.5"
                                                    >
                                                        <ExternalLink className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </div>

                                            {tx.status === 1 ? (
                                                <span className="text-green-500 font-medium">
                                                    Success
                                                </span>
                                            ) : (
                                                <span className="text-red-500 font-medium">
                                                    Failed
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}
