import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useQueryClient } from "@tanstack/react-query";
import { X, ShieldCheck, AlertTriangle, KeyRound, Coins } from "lucide-react";
import { respondToApproval, cancelApproval } from "../services/dapp";

interface DappRequestEvent {
    id: string;
    origin: string;
    type: string;
    params: any;
}

interface WatchAssetEvent {
    origin: string;
    type: string;
    params: {
        address: string;
        symbol: string;
        decimals: number;
        image?: string;
    };
}

export function ApprovalModal() {
    const queryClient = useQueryClient();
    const [isOpen, setIsOpen] = useState(false);
    const [request, setRequest] = useState<DappRequestEvent | null>(null);
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Toast state for watch_asset notifications
    const [toast, setToast] = useState<WatchAssetEvent | null>(null);

    useEffect(() => {
        const unlistenRequest = listen<DappRequestEvent>("dapp_request", (event) => {
            console.log("Received dapp_request:", event.payload);
            setRequest(event.payload);
            setIsOpen(true);
            setPassword("");
            setError(null);
        });

        const unlistenWatchAsset = listen<WatchAssetEvent>("dapp_watch_asset", (event) => {
            console.log("Received dapp_watch_asset:", event.payload);
            setToast(event.payload);
            // Auto-refresh the token list so the new token appears immediately
            queryClient.invalidateQueries({ queryKey: ["tracked_tokens"] });
            queryClient.invalidateQueries({ queryKey: ["token_balance"] });
            // Auto-dismiss after 5 seconds
            setTimeout(() => setToast(null), 5000);
        });

        return () => {
            unlistenRequest.then(u => u());
            unlistenWatchAsset.then(u => u());
        };
    }, []);

    const handleConfirm = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!request) return;

        setIsLoading(true);
        setError(null);

        try {
            await respondToApproval({
                id: request.id,
                approved: true,
                data: { password }
            });
            setIsOpen(false);
            setRequest(null);
        } catch (err: any) {
            console.error("Failed to approve:", err);
            setError(typeof err === 'string' ? err : "Failed to approve request");
        } finally {
            setIsLoading(false);
        }
    };

    const handleReject = async () => {
        if (!request) {
            setIsOpen(false);
            return;
        }
        try {
            await cancelApproval(request.id);
            setIsOpen(false);
            setRequest(null);
        } catch (err) {
            console.error("Failed to reject:", err);
            setIsOpen(false);
        }
    };

    if (!isOpen && !request && !toast) return null;

    // Toast for watch_asset (token added notification)
    if (toast && !isOpen) {
        return (
            <div className="fixed top-4 right-4 z-[100] animate-in fade-in slide-in-from-top-2 duration-300">
                <div
                    className="bg-card border border-border rounded-xl shadow-2xl p-4 max-w-sm flex items-start gap-3 cursor-pointer hover:bg-secondary/20 transition-colors"
                    onClick={() => setToast(null)}
                >
                    <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-500 shrink-0">
                        <Coins className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                        <h4 className="text-sm font-semibold">Token Added</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            <span className="font-medium text-foreground">{toast.params.symbol}</span> has been added to your wallet
                        </p>
                        <p className="text-xs text-muted-foreground font-mono mt-1 truncate">
                            {toast.params.address.slice(0, 10)}...{toast.params.address.slice(-8)}
                        </p>
                    </div>
                    <button
                        onClick={(e) => { e.stopPropagation(); setToast(null); }}
                        className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
        );
    }

    if (!isOpen || !request) return null;

    // Helper to format params for display
    const renderParams = () => {
        if (request.type === "transaction") {
            const { from, to, value, gasLimit, gasPrice, data } = request.params;
            return (
                <div className="space-y-3 text-sm">
                    <div className="bg-secondary/30 p-3 rounded-md border border-border/50">
                        <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                            <span className="text-muted-foreground">From:</span>
                            <span className="font-mono text-xs break-all bg-background/50 px-2 py-1 rounded">{from}</span>

                            <span className="text-muted-foreground">To:</span>
                            <span className="font-mono text-xs break-all bg-background/50 px-2 py-1 rounded">{to}</span>

                            <span className="text-muted-foreground">Value:</span>
                            <span className="font-medium text-foreground">{value} ETH</span>

                            <span className="text-muted-foreground">Gas Limit:</span>
                            <span className="font-mono text-xs">{gasLimit}</span>

                            <span className="text-muted-foreground">Gas Price:</span>
                            <span className="font-mono text-xs">{gasPrice} wei</span>

                            {data && (
                                <>
                                    <span className="text-muted-foreground">Data:</span>
                                    <div className="font-mono text-xs break-all bg-background/50 px-2 py-1 rounded max-h-20 overflow-y-auto col-span-2">
                                        {data}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            );
        } else if (request.type === "personal_sign") {
            return (
                <div className="space-y-3 text-sm">
                    <div className="bg-secondary/30 p-3 rounded-md border border-border/50">
                        <div className="grid grid-cols-[80px_1fr] gap-2">
                            <span className="text-muted-foreground">Address:</span>
                            <span className="font-mono text-xs break-all bg-background/50 px-2 py-1 rounded">{request.params.address}</span>

                            <span className="text-muted-foreground pt-1">Message:</span>
                            <div className="bg-background/50 p-2 rounded border border-border text-xs break-words max-h-32 overflow-y-auto font-mono">
                                {request.params.message}
                            </div>
                        </div>
                    </div>
                </div>
            );
        }
        return <pre className="text-xs bg-secondary/30 p-2 rounded overflow-x-auto">{JSON.stringify(request.params, null, 2)}</pre>;
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleReject} />

            {/* Modal */}
            <div className="bg-card w-full max-w-md rounded-xl border border-border shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-200 z-10 mx-4">
                <button
                    onClick={handleReject}
                    className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors p-1 hover:bg-secondary/50 rounded-full"
                    disabled={isLoading}
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                        <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold tracking-tight">Signature Request</h2>
                        <p className="text-sm text-muted-foreground font-medium">{request.origin}</p>
                    </div>
                </div>

                <div className="mb-6">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />
                        Request Details
                    </h3>
                    {renderParams()}
                </div>

                <form onSubmit={handleConfirm} className="space-y-5">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Confirm with Password</label>
                        <div className="relative group">
                            <KeyRound className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your wallet password"
                                className="w-full bg-input border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all shadow-sm placeholder:text-muted-foreground/50"
                                disabled={isLoading}
                                autoFocus
                            />
                        </div>
                        {error && (
                            <div className="bg-destructive/10 text-destructive text-sm px-3 py-2 rounded-md flex items-center gap-2 animate-in fade-in slide-in-from-top-1 border border-destructive/20">
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                {error}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={handleReject}
                            className="px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/80 rounded-lg transition-colors"
                            disabled={isLoading}
                        >
                            Reject
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || !password}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                    Signing...
                                </>
                            ) : (
                                "Sign & Confirm"
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
