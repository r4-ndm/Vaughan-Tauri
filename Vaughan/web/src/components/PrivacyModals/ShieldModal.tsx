import { useState, useEffect } from "react";
import { X, ShieldCheck, AlertCircle } from "lucide-react";
import { railgunClient } from "../../services/railgunWorkerClient";
import { getTrackedTokens, TrackedToken } from "../../services/token";

import { useNavigate } from "react-router-dom";

export function ShieldModal({
    isOpen,
    onClose,
    activeAccount,
    chainId,
    nativeSymbol,
}: {
    isOpen: boolean;
    onClose: () => void;
    activeAccount: string | null;
    chainId?: number;
    nativeSymbol: string;
}) {
    const navigate = useNavigate();
    const [amount, setAmount] = useState("");
    const [isShielding, setIsShielding] = useState(false);
    const [error, setError] = useState("");
    const [txHash, setTxHash] = useState("");

    const [tokens, setTokens] = useState<TrackedToken[]>([]);
    const [selectedAsset, setSelectedAsset] = useState<string>("native");

    useEffect(() => {
        if (chainId) {
            getTrackedTokens().then((result) => setTokens(result as TrackedToken[]));
        }
    }, [chainId]);

    if (!isOpen) return null;

    const handleShield = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeAccount || !amount || parseFloat(amount) <= 0) {
            setError("Invalid parameters.");
            return;
        }

        setIsShielding(true);
        setError("");

        try {
            const isNative = selectedAsset === "native";
            const tokenAddr = isNative ? "" : selectedAsset;

            // Simple map of chainId to Railgun Network string
            const networkNameStr = chainId === 1 ? 'Ethereum'
                : chainId === 137 ? 'Polygon'
                    : chainId === 56 ? 'BNBChain'
                        : chainId === 42161 ? 'Arbitrum'
                            : chainId === 11155111 ? 'EthereumSepolia'
                                : chainId === 80002 ? 'PolygonAmoy'
                                    : 'Ethereum';

            const txResponse = await railgunClient.populateShieldTransaction(
                networkNameStr,
                isNative,
                tokenAddr,
                amount,
                railgunClient.railgunAddress || ""
            );

            console.log("Got Shield TX:", txResponse);
            setTxHash("Forwarding to Transaction Approval...");

            // Allow state to settle, then navigate to the Secure Confirmation Screen
            setTimeout(() => {
                navigate("/send-confirm", {
                    state: {
                        from: activeAccount,
                        to: txResponse.to,
                        amount: txResponse.value, // value string is 0 if it's an ERC20, or the eth amount if native
                        symbol: isNative ? nativeSymbol : tokens.find(t => t.address === selectedAsset)?.symbol || "TOKEN",
                        nativeSymbol: nativeSymbol,
                        gas_limit: 0, // estimation happens in SendConfirm
                        gas_price_gwei: "0",
                        tokenAddress: undefined, // Shield payloads specify the token via the smart contract `data`
                        data: txResponse.data,
                    }
                });
                onClose(); // auto close modal in the background
            }, 1000);

        } catch (err: any) {
            setError(err.message || "Failed to generate Shield transaction");
        } finally {
            setIsShielding(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-card w-full max-w-md p-6 rounded-lg shadow-xl border border-border relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <ShieldCheck className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">Shield Assets</h2>
                        <p className="text-sm text-muted-foreground">Move funds into the Shadow Engine</p>
                    </div>
                </div>

                {txHash ? (
                    <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-lg text-center space-y-2">
                        <div className="text-green-500 font-bold">Shield Payload Generated</div>
                        <p className="text-xs text-muted-foreground">{txHash}</p>
                    </div>
                ) : (
                    <form onSubmit={handleShield} className="space-y-4">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded flex items-center text-sm">
                                <AlertCircle className="w-4 h-4 mr-2 shrink-0" />
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Asset to Shield</label>
                            <select
                                value={selectedAsset}
                                onChange={(e) => setSelectedAsset(e.target.value)}
                                className="w-full bg-input border border-border rounded p-3 focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                            >
                                <option value="native">{nativeSymbol}</option>
                                {tokens.map(t => (
                                    <option key={t.address} value={t.address}>
                                        {t.symbol}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Amount</label>
                            <input
                                type="number"
                                step="any"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.0"
                                className="w-full bg-input border border-border rounded p-3 focus:outline-none focus:ring-1 focus:ring-primary font-mono text-sm"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isShielding || !amount}
                            className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-bold hover:opacity-90 transition-all disabled:opacity-50 mt-4 flex justify-center items-center"
                        >
                            {isShielding ? "Generating Payload..." : "Shield Now"}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
