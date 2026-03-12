import { useState, useEffect } from "react";
import { X, AlertCircle } from "lucide-react";
import { TokenService } from "../services/tauri";
import { listen } from "@tauri-apps/api/event";
import { useQueryClient } from "@tanstack/react-query";

interface WatchAssetRequest {
    address: string;
    symbol: string;
    decimals: number;
    image?: string;
    origin: string;
}

export function WatchAssetModal() {
    const [request, setRequest] = useState<WatchAssetRequest | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const queryClient = useQueryClient();

    // Listen for events from Tauri
    useEffect(() => {
        const unlistenWatchAsset = listen<WatchAssetRequest>("watch_asset_request", (event) => {
            console.log("[WatchAssetModal] Received watch_asset_request:", event.payload);
            setRequest(event.payload);
            setIsOpen(true);
            setError(null);
            setIsLoading(false);
        });

        return () => {
            unlistenWatchAsset.then(f => f());
        };
    }, []);

    const onClose = () => {
        setIsOpen(false);
        setTimeout(() => setRequest(null), 200); // clear after animation
    };

    const handleApprove = async () => {
        if (!request) return;

        setIsLoading(true);
        setError(null);

        try {
            await TokenService.addCustomToken(request.address);
            await queryClient.invalidateQueries({ queryKey: ["tracked_tokens"] });
            onClose();
        } catch (err: any) {
            console.error("Failed to add watched token:", err);
            setError(typeof err === "string" ? err : "Failed to add token. Matches existing or invalid?");
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen || !request) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-card w-full max-w-md rounded-xl border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border/50">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        Add Custom Token Request
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                        disabled={isLoading}
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    <p className="text-sm text-foreground mb-2">
                        <span className="font-semibold text-primary">{new URL(request.origin).hostname}</span> would like to add a token to your tracked assets.
                    </p>

                    <div className="bg-secondary/30 rounded-lg border border-border/50 p-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full border border-border/50 overflow-hidden bg-background flex items-center justify-center flex-shrink-0">
                                {request.image ? (
                                    <img src={request.image} alt={request.symbol} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-lg font-bold text-foreground">
                                        {request.symbol.substring(0, 2).toUpperCase()}
                                    </span>
                                )}
                            </div>

                            <div className="flex-1">
                                <h4 className="text-base font-bold text-foreground">{request.symbol}</h4>
                                <div className="text-xs text-muted-foreground font-mono truncate mt-0.5" title={request.address}>
                                    {request.address.substring(0, 8)}...{request.address.substring(request.address.length - 6)}
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                    Decimals: {request.decimals}
                                </div>
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="flex items-center text-red-500 text-xs mt-1 p-2 bg-red-500/10 rounded-lg border border-red-500/20">
                            <AlertCircle className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium hover:bg-secondary rounded-lg transition-colors border border-transparent"
                            disabled={isLoading}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleApprove}
                            disabled={isLoading}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {isLoading ? "Adding..." : "Add Token"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
