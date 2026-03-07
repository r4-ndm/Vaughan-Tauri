import { useState, useEffect } from "react";
import { X, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { getTokenMetadata, addCustomToken, TrackedToken } from "../services/token";

interface AddTokenModalProps {
    isOpen: boolean;
    onClose: () => void;
    onTokenAdded: (token: TrackedToken) => void;
}

export function AddTokenModal({ isOpen, onClose, onTokenAdded }: AddTokenModalProps) {
    const [address, setAddress] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [previewToken, setPreviewToken] = useState<TrackedToken | null>(null);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setAddress("");
            setError(null);
            setPreviewToken(null);
            setIsLoading(false);
        }
    }, [isOpen]);

    const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setAddress(e.target.value);
        setError(null);
        setPreviewToken(null);
    };

    // Auto-fetch metadata on blur or when address length is valid (42 chars)
    const handleBlur = async () => {
        if (!address || address.length !== 42 || !address.startsWith("0x")) return;

        setIsLoading(true);
        setError(null);
        try {
            const token = await getTokenMetadata(address);
            setPreviewToken(token);
        } catch (err) {
            console.error("Failed to fetch token metadata:", err);
            setError("Invalid token address or network error");
            setPreviewToken(null);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!address) return;

        setIsLoading(true);
        setError(null);

        try {
            // If we haven't previewed yet, try to add directly (it will fetch internally if needed, 
            // but our backend command add_custom_token calls get_token_metadata internally too)
            const token = await addCustomToken(address);
            onTokenAdded(token);
            onClose();
        } catch (err: any) {
            console.error("Failed to add token:", err);
            setError(typeof err === 'string' ? err : "Failed to add token. Matches existing or invalid?");
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-card w-full max-w-md rounded-xl border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border/50">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        Add Custom Token
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                        disabled={isLoading}
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium block">Token Contract Address</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={address}
                                onChange={handleAddressChange}
                                onBlur={handleBlur}
                                placeholder="0x..."
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                                disabled={isLoading}
                                autoFocus
                            />
                            {isLoading && (
                                <div className="absolute right-3 top-2.5">
                                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                </div>
                            )}
                        </div>
                        {error && (
                            <div className="flex items-center text-red-500 text-xs mt-1">
                                <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
                                {error}
                            </div>
                        )}
                    </div>

                    {previewToken && (
                        <div className="bg-secondary/30 rounded-lg p-3 border border-border/50">
                            <div className="flex items-start">
                                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 mr-2" />
                                <div>
                                    <h4 className="font-semibold text-sm">Token Found</h4>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Symbol</p>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Name</p>
                                        <p className="text-xs font-medium text-foreground">{previewToken.symbol}</p>
                                        <p className="text-xs text-foreground truncate">{previewToken.name}</p>

                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Decimals</p>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Network</p>
                                        <p className="text-xs text-foreground">{previewToken.decimals}</p>
                                        <p className="text-xs text-foreground">PulseChain</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium hover:bg-secondary rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || !address}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {isLoading ? "Adding..." : "Add Token"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
