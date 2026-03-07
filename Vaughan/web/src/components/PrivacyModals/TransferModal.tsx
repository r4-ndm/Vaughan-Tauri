import { useState, useEffect } from "react";
import { X, Globe, AlertCircle } from "lucide-react";
import { railgunClient } from "../../services/railgunWorkerClient";
import { getTrackedTokens, TrackedToken } from "../../services/token";

import { useNavigate } from "react-router-dom";

export function TransferModal({
    isOpen,
    onClose,
    railgunWalletID,
    chainId,
    nativeSymbol,
    onRequiresProof,
    activeAccount,
}: {
    isOpen: boolean;
    onClose: () => void;
    railgunWalletID: string | null;
    chainId?: number;
    nativeSymbol: string;
    onRequiresProof: (state: boolean) => void;
    activeAccount: string | null;
}) {
    const navigate = useNavigate();
    const [amount, setAmount] = useState("");
    const [recipient, setRecipient] = useState("");
    const [encryptionKey, setEncryptionKey] = useState("");

    const [isTransfering, setIsTransfering] = useState(false);
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

    const handleTransfer = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!railgunWalletID || !amount || parseFloat(amount) <= 0 || !recipient || !encryptionKey || !activeAccount) {
            setError("Missing required parameters.");
            return;
        }

        setError("");
        setIsTransfering(true);
        // Lock the UI context while generating Snarks
        onRequiresProof(true);

        try {
            const isNative = selectedAsset === "native";
            const tokenAddr = isNative ? "" : selectedAsset;

            // Simple map of chainId to Railgun Network string
            const networkNameStr = chainId === 1 ? 'Ethereum'
                : chainId === 137 ? 'Polygon'
                    : chainId === 56 ? 'BNBChain'
                        : chainId === 42161 ? 'Arbitrum'
                            : 'Ethereum';

            const txResponse = await railgunClient.generateTransferTransaction(
                networkNameStr,
                isNative,
                tokenAddr,
                amount,
                recipient,
                encryptionKey
            );

            console.log("Got Transfer TX:", txResponse);
            setTxHash("Forwarding to Transaction Approval...");

            // Allow state to settle, then navigate to the Secure Confirmation Screen
            setTimeout(() => {
                navigate("/send-confirm", {
                    state: {
                        from: activeAccount, // Assuming 0zk transactions are still signed by the native activeAccount to pay relayer EVM gas
                        to: txResponse.to,
                        amount: txResponse.value, // value string is 0 if it's an ERC20, or the eth amount if native
                        symbol: isNative ? nativeSymbol : tokens.find(t => t.address === selectedAsset)?.symbol || "TOKEN",
                        nativeSymbol: nativeSymbol,
                        gas_limit: 0, // estimation happens in SendConfirm
                        gas_price_gwei: "0",
                        tokenAddress: undefined, // Transfer payloads specify the token via the smart contract `data`
                        data: txResponse.data,
                    }
                });
                onClose(); // auto close modal in the background
            }, 1000);

        } catch (err: any) {
            setError(err.message || "Failed to generate Transfer proof");
        } finally {
            setIsTransfering(false);
            onRequiresProof(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-card w-full max-w-md p-6 rounded-lg shadow-xl border border-border relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
                    disabled={isTransfering}
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                        <Globe className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">Transfer Assets</h2>
                        <p className="text-sm text-muted-foreground">Move funds out of the Shadow Engine</p>
                    </div>
                </div>

                {txHash ? (
                    <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-lg text-center space-y-2">
                        <div className="text-green-500 font-bold">Transfer Proof Generated</div>
                        <p className="text-xs text-muted-foreground">{txHash}</p>
                    </div>
                ) : (
                    <form onSubmit={handleTransfer} className="space-y-4">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded flex items-center text-sm">
                                <AlertCircle className="w-4 h-4 mr-2 shrink-0" />
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Asset to Transfer</label>
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

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Railgun Recipient Address (0zk...)</label>
                            <input
                                type="text"
                                value={recipient}
                                onChange={(e) => setRecipient(e.target.value)}
                                placeholder="0zk..."
                                className="w-full bg-input border border-border rounded p-3 focus:outline-none focus:ring-1 focus:ring-primary font-mono text-sm"
                                required
                            />
                        </div>

                        <div className="space-y-2 pt-2 border-t border-border/50">
                            <label className="text-sm font-medium text-amber-500">Wallet Password (Signature Required)</label>
                            <input
                                type="password"
                                value={encryptionKey}
                                onChange={(e) => setEncryptionKey(e.target.value)}
                                placeholder="Vault Password"
                                className="w-full bg-input border border-amber-500/50 rounded p-3 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                                required
                            />
                            <p className="text-xs text-muted-foreground mt-1">Decrypts your Spending Key to forge the ZK Proof.</p>
                        </div>

                        <button
                            type="submit"
                            disabled={isTransfering || !amount || !recipient || !encryptionKey}
                            className="w-full bg-secondary text-foreground py-3 rounded-lg font-bold hover:bg-secondary/80 transition-all disabled:opacity-50 mt-4 flex justify-center items-center"
                        >
                            {isTransfering ? "Forging Proof..." : "Transfer Now"}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
