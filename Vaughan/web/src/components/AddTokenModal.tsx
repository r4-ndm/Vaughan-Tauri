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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-card w-full max-w-md rounded-xl border border-border shadow-xl p-6 relative animate-in fade-in zoom-in-95 duration-200">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <h2 className="text-xl font-bold mb-4">Add Custom Token</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">Token Contract Address</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={address}
                                onChange={handleAddressChange}
                                onBlur={handleBlur}
                                placeholder="0x..."
                                className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                                disabled={isLoading}
                            />
                            {isLoading && (
                                <div className="absolute right-3 top-2.5">
                                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                </div>
                            )}
                        </div>
                        {error && (
                            <div className="flex items-center text-destructive text-sm mt-1">
                                <AlertCircle className="w-4 h-4 mr-1.5" />
                                {error}
                            </div>
                        )}
                    </div>

                    {previewToken && (
                        <div className="bg-secondary/20 rounded-lg p-3 border border-border">
                            <div className="flex items-start">
                                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 mr-2" />
                                <div>
                                    <h4 className="font-semibold text-sm">Token Found</h4>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Symbol: <span className="text-foreground font-medium">{previewToken.symbol}</span>
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Name: <span className="text-foreground">{previewToken.name}</span>
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Decimals: {previewToken.decimals}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground mr-2"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || !address}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {isLoading ? "Adding..." : "Add Token"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
