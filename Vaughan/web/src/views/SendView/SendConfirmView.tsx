import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "../../components/Layout";
import { ArrowLeft, Send as SendIcon, AlertCircle, ShieldCheck } from "lucide-react";

interface TransactionResponse {
    tx_hash: string;
}

interface LocationState {
    from: string;
    to: string;
    amount: string;
    symbol: string;
    nativeSymbol: string;
    gas_limit: number;
    gas_price_gwei: string;
    tokenAddress?: string; // Added tokenAddress
    data?: string; // Support for arbitrary smart contract interaction (e.g. Railgun Shields)
}

interface EstimateGasResponse {
    gas_limit: number;
    gas_price_gwei: string;
}

export const SendConfirmView: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();
    const txParams = location.state as LocationState | null; // Changed to LocationState

    const [password, setPassword] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [sendError, setSendError] = useState("");
    const [txHash, setTxHash] = useState("");
    const [speed, setSpeed] = useState<"normal" | "fast" | "custom">("normal");
    const [customGasPrice, setCustomGasPrice] = useState(txParams?.gas_price_gwei || "0");
    const [customGasLimit, setCustomGasLimit] = useState(txParams?.gas_limit?.toString() || "0");
    const [gasEstimate, setGasEstimate] = useState<EstimateGasResponse | null>(null); // Added gasEstimate state

    // If no tx params, redirect back
    useEffect(() => {
        if (!txParams) {
            navigate("/dashboard");
        }
    }, [txParams, navigate]);

    // Effect to estimate gas when component mounts or txParams change
    useEffect(() => {
        const estimate = async () => {
            if (!txParams) return;
            try {
                const est = await invoke<EstimateGasResponse>("estimate_gas_simple", {
                    from: txParams.from,
                    to: txParams.to,
                    amount: txParams.amount,
                    tokenAddress: txParams.tokenAddress || null,
                    data: txParams.data || null, // Support Railgun custom gas estimates
                });
                setGasEstimate(est);
                // Update gas price and limit based on estimate if not custom
                if (speed === "normal") {
                    setCustomGasPrice(est.gas_price_gwei);
                    setCustomGasLimit(est.gas_limit.toString());
                } else if (speed === "fast") {
                    const fastPrice = (parseFloat(est.gas_price_gwei) * 1.5).toString();
                    setCustomGasPrice(fastPrice);
                    setCustomGasLimit(est.gas_limit.toString());
                }
            } catch (err) {
                console.error("Failed to estimate gas:", err);
                setSendError(`Failed to estimate gas: ${String(err)}`);
            }
        };
        estimate();
    }, [txParams, speed]); // Re-estimate if txParams or speed changes

    if (!txParams) return null;

    // Handle Speed Toggle
    const handleSpeedChange = (newSpeed: "normal" | "fast" | "custom") => {
        setSpeed(newSpeed);
        if (gasEstimate) { // Use estimated gas if available
            if (newSpeed === "normal") {
                setCustomGasPrice(gasEstimate.gas_price_gwei);
                setCustomGasLimit(gasEstimate.gas_limit.toString());
            } else if (newSpeed === "fast") {
                const fastPrice = (parseFloat(gasEstimate.gas_price_gwei) * 1.5).toString();
                setCustomGasPrice(fastPrice);
                setCustomGasLimit(gasEstimate.gas_limit.toString());
            }
        } else { // Fallback to initial txParams if no estimate yet
            if (newSpeed === "normal") {
                setCustomGasPrice(txParams.gas_price_gwei);
                setCustomGasLimit(txParams.gas_limit.toString());
            } else if (newSpeed === "fast") {
                const fastPrice = (parseFloat(txParams.gas_price_gwei) * 1.5).toString();
                setCustomGasPrice(fastPrice);
                setCustomGasLimit(txParams.gas_limit.toString());
            }
        }
    };

    const currentGasPrice = parseFloat(customGasPrice) || 0;
    const currentGasLimit = Math.max(parseInt(customGasLimit) || 0, 21000);

    const totalFee = ((currentGasLimit * currentGasPrice) / 1e9).toFixed(5);
    const amountNum = parseFloat(txParams.amount) || 0;
    const totalFeeNum = parseFloat(totalFee) || 0;

    const isNativeTransfer = !txParams.tokenAddress;
    const totalWithFee = isNativeTransfer
        ? (amountNum + totalFeeNum).toFixed(5)
        : amountNum.toFixed(5);

    const handleConfirm = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSending(true);
        setSendError("");

        try {
            // Validate transaction before sending
            await invoke("validate_transaction", {
                request: {
                    to: txParams.to,
                    amount: txParams.amount,
                    gas_limit: currentGasLimit,
                    token_address: txParams.tokenAddress || null,
                    data: txParams.data || null,
                },
            });

            const response = await invoke<TransactionResponse>("send_transaction", {
                request: {
                    from: txParams.from,
                    to: txParams.to,
                    amount: txParams.amount,
                    password: password,
                    gas_limit: currentGasLimit,
                    gas_price_gwei: currentGasPrice.toString(),
                    token_address: txParams.tokenAddress || null,
                    data: txParams.data || null,
                },
            });
            setTxHash(response.tx_hash);
            // Refresh balance
            queryClient.invalidateQueries({ queryKey: ["balance"] });
            queryClient.invalidateQueries({ queryKey: ["transactions"] });
        } catch (err) {
            setSendError(String(err));
        } finally {
            setIsSending(false);
        }
    };

    // Success View
    if (txHash) {
        return (
            <Layout showActions={false}>
                <div className="max-w-md mx-auto w-full space-y-6 pt-4">
                    <div className="bg-card border border-border p-6 rounded-lg space-y-6 shadow-lg text-center">
                        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/50">
                            <ShieldCheck className="w-8 h-8 text-green-500" />
                        </div>

                        <h2 className="text-xl font-bold text-green-500">Transaction Sent!</h2>

                        <div className="space-y-3 text-sm text-left bg-background p-4 rounded border border-border">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Amount</span>
                                <span className="font-bold">{txParams.amount} {txParams.symbol}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">To</span>
                                <span className="font-mono text-xs text-right whitespace-pre-wrap ml-4">{txParams.to}</span>
                            </div>
                            <div className="border-t border-border pt-3 mt-3">
                                <span className="text-muted-foreground text-xs">Transaction Hash:</span>
                                <div className="font-mono text-xs break-all mt-1 bg-input p-2 rounded text-primary selection:bg-primary/30">
                                    {txHash}
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => navigate("/dashboard")}
                            className="w-full vaughan-btn py-3 mt-4"
                        >
                            Back to Dashboard
                        </button>
                    </div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout showActions={false}>
            <div className="max-w-md mx-auto w-full space-y-6 pt-4">
                {/* Back button */}
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Edit
                </button>


                <div className="bg-card border border-border p-5 rounded-lg space-y-4 shadow-lg">
                    <div className="space-y-4 text-sm">
                        <div className="p-3 bg-background border border-border/50 rounded flex justify-between items-center">
                            <span className="text-muted-foreground font-medium">Send Amount</span>
                            <span className="text-lg font-bold text-primary">{txParams.amount} {txParams.symbol}</span>
                        </div>

                        {txParams.data && (
                            <div className="px-3 py-2 bg-purple-500/10 border border-purple-500/30 rounded flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-purple-500 shrink-0" />
                                <span className="text-xs text-purple-500/90 font-medium">
                                    Smart Contract Payload Detected
                                </span>
                            </div>
                        )}

                        <div className="space-y-2 bg-background p-3 rounded border border-border/50">
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">From</span>
                                <span className="font-mono">{txParams.from.slice(0, 8)}...{txParams.from.slice(-6)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">To</span>
                                <span className="font-mono">{txParams.to.slice(0, 8)}...{txParams.to.slice(-6)}</span>
                            </div>
                        </div>

                        {/* Transaction Speed */}
                        <div className="flex gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => handleSpeedChange("normal")}
                                className={`flex-1 py-2 text-xs font-semibold rounded border transition-colors ${speed === "normal" ? "bg-primary/20 border-primary text-primary" : "bg-background border-border text-muted-foreground hover:bg-input"}`}
                            >
                                Normal
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSpeedChange("fast")}
                                className={`flex-1 py-2 text-xs font-semibold rounded border transition-colors ${speed === "fast" ? "bg-primary/20 border-primary text-primary" : "bg-background border-border text-muted-foreground hover:bg-input"}`}
                            >
                                Fast (1.5x Gas)
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSpeedChange("custom")}
                                className={`flex-1 py-2 text-xs font-semibold rounded border transition-colors ${speed === "custom" ? "bg-primary/20 border-primary text-primary" : "bg-background border-border text-muted-foreground hover:bg-input"}`}
                            >
                                Custom
                            </button>
                        </div>

                        {/* Custom Gas Inputs */}
                        {speed === "custom" && (
                            <div className="grid grid-cols-2 gap-4 bg-background p-3 rounded border border-border/50">
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">Gas Limit</label>
                                    <input
                                        type="number"
                                        value={customGasLimit}
                                        onChange={(e) => setCustomGasLimit(e.target.value)}
                                        className="w-full bg-input border border-border rounded p-2 text-sm focus:outline-none focus:border-primary/50"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">Gas Price (Gwei)</label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={customGasPrice}
                                        onChange={(e) => setCustomGasPrice(e.target.value)}
                                        className="w-full bg-input border border-border rounded p-2 text-sm focus:outline-none focus:border-primary/50"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Gas Details */}
                        <div className="space-y-2 bg-background p-3 rounded border border-border/50">
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Network Fee</span>
                                <span className="font-mono">~ {totalFeeNum > 0 ? totalFeeNum.toFixed(9).replace(/\.?0+$/, "") : "0"} {txParams.nativeSymbol}</span>
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground/70">
                                <span>Gas Limit</span>
                                <span className="font-mono">{currentGasLimit}</span>
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground/70">
                                <span>Gas Price</span>
                                <span className="font-mono">{currentGasPrice < 0.01 ? currentGasPrice.toFixed(8).replace(/\.?0+$/, "") : currentGasPrice.toFixed(2)} Gwei</span>
                            </div>
                        </div>

                        <div className="p-3 bg-background border border-border rounded flex flex-col space-y-1">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground font-medium">Total Maximum</span>
                                <span className="font-bold text-right">
                                    {isNativeTransfer
                                        ? `~ ${totalWithFee} ${txParams.symbol}`
                                        : `${txParams.amount} ${txParams.symbol} + ~${totalFeeNum.toFixed(6).replace(/\.?0+$/, "")} ${txParams.nativeSymbol}`}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Password Form */}
                <form onSubmit={handleConfirm} className="bg-card border border-border p-5 rounded-lg space-y-4 shadow-lg">

                    {sendError && (
                        <div className="text-xs text-red-500 border border-red-500/30 bg-red-500/10 p-3 rounded flex items-center">
                            <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                            {sendError}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground flex items-center">
                            <ShieldCheck className="w-4 h-4 mr-2 text-primary" />
                            Security Confirmation
                        </label>
                        <p className="text-xs text-muted-foreground">
                            Enter your wallet password to sign and broadcast this transaction to the network.
                        </p>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Wallet Password"
                            className="w-full bg-input border border-border px-3 py-3 rounded text-sm text-foreground focus:outline-none focus:border-primary/50 mt-2"
                            required
                            autoFocus
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => navigate(-1)}
                            className="flex-1 py-3 text-sm font-bold text-foreground bg-input border border-border hover:bg-input/80 rounded transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSending || !password}
                            className="flex-1 vaughan-btn flex items-center justify-center py-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSending ? (
                                <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>Confirm Send <SendIcon className="w-4 h-4 ml-2" /></>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </Layout>
    );
};
