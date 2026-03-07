import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { BalanceDisplay } from "../components/BalanceDisplay";
import { NetworkSelector } from "../components/NetworkSelector";
import { AccountSelector } from "../components/AccountSelector";
import { ChevronDown } from "lucide-react";
import {
    getTrackedTokens,
    getTokenBalance,
    TrackedToken
} from "../services/token";
import { PreferencesService } from "../services/tauri";
import { railgunClient } from "../services/railgunWorkerClient";
import { Shield, Globe, ArrowRight } from "lucide-react";
import { ShieldModal } from "../components/PrivacyModals/ShieldModal";
import { UnshieldModal } from "../components/PrivacyModals/UnshieldModal";
import { TransferModal } from "../components/PrivacyModals/TransferModal";
import { ZkProofLoader } from "../components/PrivacyModals/ZkProofLoader";

interface Account {
    address: string;
    name: string;
    path: string;
    account_type: string;
    index?: number;
}

interface NetworkInfo {
    network_id: string;
    name: string;
    chain_id: number;
    rpc_url: string;
    native_token: {
        symbol: string;
        name: string;
        decimals: number;
    };
}

interface BalanceResponse {
    balance_wei: string;
    balance_eth: string;
    symbol: string;
}

export default function Dashboard() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [activeAccount, setActiveAccount] = useState<string | null>(null);

    // Privacy logic
    const [privacyEnabled, setPrivacyEnabled] = useState(false);
    const [isShieldMode, setIsShieldMode] = useState(false);

    // Privacy Modal State
    const [shieldOpen, setShieldOpen] = useState(false);
    const [unshieldOpen, setUnshieldOpen] = useState(false);
    const [transferOpen, setTransferOpen] = useState(false);

    // Privacy Worker State
    const [zkProgress, setZkProgress] = useState(0);
    const [zkProofActive, setZkProofActive] = useState(false);

    useEffect(() => {
        PreferencesService.getUserPreferences().then(prefs => {
            setPrivacyEnabled(prefs.privacy_enabled);
        });

        // Wire up ZK Progress from WebWorker
        const unsub = railgunClient.onProofProgress((prog) => {
            setZkProgress(prog);
        });
        return () => unsub();
    }, []);

    // Send form state
    const [recipient, setRecipient] = useState("");
    const [sendAmount, setSendAmount] = useState("");

    // Assets dropdown
    const [assetsOpen, setAssetsOpen] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState<string>("native"); // "native" or token address
    const [selectedSymbol, setSelectedSymbol] = useState<string>("ETH");

    const { data: network, isLoading: isNetworkLoading } = useQuery({
        queryKey: ["network"],
        queryFn: async () => invoke<NetworkInfo>("get_network_info"),
    });

    const { data: accounts, isLoading: isAccountsLoading } = useQuery({
        queryKey: ["accounts"],
        queryFn: async () => invoke<Account[]>("get_accounts"),
    });

    const { data: supportedNetworks } = useQuery({
        queryKey: ["supported_networks"],
        queryFn: async () => invoke<any[]>("get_supported_networks"),
    });

    const handleSwitchNetwork = async (net: any) => {
        try {
            await invoke("switch_network", {
                request: {
                    network_id: net.id,
                    rpc_url: net.rpc_url,
                    chain_id: net.chain_id,
                }
            });
            queryClient.invalidateQueries({ queryKey: ["network"] });
        } catch (e) {
            console.error("Failed to switch network:", e);
        }
    };

    const handleSelectAccount = async (address: string) => {
        try {
            await invoke("set_active_account", { address });
            setActiveAccount(address);
            // Refresh balance once account is switched
            queryClient.invalidateQueries({ queryKey: ["balance"] });
        } catch (e) {
            console.error("Failed to set active account:", e);
        }
    };

    useEffect(() => {
        if (accounts && accounts.length > 0 && !activeAccount) {
            const defaultAddress = accounts[0].address;
            setActiveAccount(defaultAddress);
            invoke("set_active_account", { address: defaultAddress }).catch(e =>
                console.error("Failed to sync initial active account to backend:", e)
            );
        }
    }, [accounts, activeAccount]);

    useEffect(() => {
        if (selectedAsset === "native" && network?.native_token?.symbol) {
            setSelectedSymbol(network.native_token.symbol);
        }
    }, [selectedAsset, network]);

    // 🏴‍☠️ Keep the Shadow Engine in sync with the active network
    useEffect(() => {
        if (network?.chain_id) {
            import("../services/railgunWorkerClient").then(({ railgunClient }) => {
                railgunClient.setNetwork(network.chain_id).catch(err => {
                    console.warn("[Vaughan] Failed to lock Shadow Engine to network:", err);
                });
            });
        }
    }, [network?.chain_id]);

    // 🔔 Listen for balance refresh signals from backend
    useEffect(() => {
        const unlisten = listen("refresh-balance", () => {
            console.log("[Dashboard] Refreshing balances due to backend signal");
            queryClient.invalidateQueries({ queryKey: ["balance"] });
            queryClient.invalidateQueries({ queryKey: ["tracked_tokens"] });
            queryClient.invalidateQueries({ queryKey: ["token_balance"] });
        });

        return () => {
            unlisten.then(f => f());
        };
    }, [queryClient]);

    const { data: balance, isLoading: isBalanceLoading } = useQuery({
        queryKey: ["balance", activeAccount, network?.chain_id],
        queryFn: async () => {
            if (!activeAccount) return null;
            return invoke<BalanceResponse>("get_balance", { address: activeAccount });
        },
        enabled: !!activeAccount && !!network,
        refetchInterval: 60000,
    });

    const { data: tokens } = useQuery({
        queryKey: ["tracked_tokens", network?.chain_id],
        queryFn: getTrackedTokens,
        enabled: !!network,
    });

    const formatBalance = (bal: string | undefined) => {
        if (!bal) return "0.00";
        const num = parseFloat(bal);
        if (num === 0) return "0.00";
        if (Number.isInteger(num)) return num.toString();
        return parseFloat(num.toFixed(6)).toString();
    };

    // Shielded Balances currently unimplemented locally but mapped out
    const displayBalance = isShieldMode ? "0.00" : formatBalance(balance?.balance_eth);
    const displaySymbol = isShieldMode ? `${balance?.symbol || "ETH"} (zk)` : balance?.symbol || "ETH";

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    const handleSendClick = (e: React.FormEvent) => {
        e.preventDefault();
        if (!recipient || !sendAmount || !activeAccount) return;

        // Navigate to confirmation page with tx params, including token details
        navigate("/send-confirm", {
            state: {
                from: activeAccount,
                to: recipient,
                amount: sendAmount,
                symbol: selectedSymbol,
                nativeSymbol: network?.native_token?.symbol || "ETH",
                tokenAddress: selectedAsset !== "native" ? selectedAsset : undefined,
                chainId: network?.chain_id,
            }
        });
    };

    const handleAddCustomToken = async (e: React.MouseEvent) => {
        e.preventDefault(); // Prevent standard right-click menu

        const tokenAddr = window.prompt("Enter the Contract Address of the ERC20 Token to track:");
        if (!tokenAddr || tokenAddr.trim() === "") return;

        try {
            // We cast state token response back down implicitly if we wanted to
            await invoke("add_custom_token", { tokenAddress: tokenAddr.trim() });
            queryClient.invalidateQueries({ queryKey: ["tracked_tokens"] });
            alert("Custom token tracked successfully!");
        } catch (err: any) {
            alert(`Failed to add custom token: ${err}`);
        }
    };

    if (isNetworkLoading || isAccountsLoading) {
        return (
            <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
                <div className="animate-spin h-12 w-12 border-b-2 border-foreground"></div>
            </div>
        );
    }

    return (
        <Layout showActions={true}>
            <div className={`space-y-4 transition-colors duration-500 ${isShieldMode ? "bg-primary/5 rounded-xl border border-primary/20 p-2" : ""}`}>
                <BalanceDisplay
                    balance={displayBalance}
                    symbol={displaySymbol}
                    address={activeAccount || undefined}
                    isLoading={isBalanceLoading}
                    onCopyAddress={copyToClipboard}
                >
                    <div className="flex gap-2 w-full justify-center py-2">
                        <NetworkSelector
                            currentNetwork={network}
                            supportedNetworks={supportedNetworks || []}
                            onSwitchNetwork={handleSwitchNetwork}
                        />
                        <AccountSelector
                            currentAccount={accounts?.find(a => a.address === activeAccount)}
                            accounts={accounts || []}
                            onSelectAccount={handleSelectAccount}
                        />
                    </div>
                </BalanceDisplay>

                {/* Privacy Action Row (only rendered if Privacy Mode was enabled at unlock) */}
                {privacyEnabled && (
                    <div className="grid grid-cols-4 gap-2 p-2">
                        <button
                            onClick={() => setIsShieldMode(!isShieldMode)}
                            className={`col-span-1 p-2 flex justify-center items-center rounded-lg border text-sm transition-all ${isShieldMode ? 'bg-primary text-primary-foreground border-primary shadow-[0_0_15px_rgba(var(--primary),0.3)]' : 'bg-card border-border hover:bg-secondary'}`}
                            title="Toggle Privacy View"
                        >
                            <Shield className={`w-4 h-4 mr-2 ${isShieldMode ? 'animate-pulse' : ''}`} />
                            {isShieldMode ? "Shielded" : "Public"}
                        </button>

                        <button
                            onClick={() => setShieldOpen(true)}
                            className="col-span-1 border border-border bg-card hover:bg-secondary p-2 rounded-lg text-sm flex justify-center items-center transition-opacity"
                        >
                            <Shield className="w-4 h-4 mr-2 text-primary" />
                            Shield
                        </button>

                        <button
                            onClick={() => setTransferOpen(true)}
                            className="col-span-1 border border-border bg-card hover:bg-secondary p-2 rounded-lg text-sm flex justify-center items-center transition-opacity"
                        >
                            <ArrowRight className="w-4 h-4 mr-2 text-blue-400" />
                            Transfer
                        </button>

                        <button
                            onClick={() => setUnshieldOpen(true)}
                            className="col-span-1 border border-border bg-card hover:bg-secondary p-2 rounded-lg text-sm flex justify-center items-center transition-opacity"
                        >
                            <Globe className="w-4 h-4 mr-2 text-secondary-foreground" />
                            Unshield
                        </button>
                    </div>
                )}

                {/* Inline Send Form — no password here, that's on the confirmation page */}
                <div className="bg-card border border-border p-4 space-y-3">
                    <form onSubmit={handleSendClick} className="space-y-3">
                        <div>
                            <label className="text-sm text-muted-foreground mb-1 block">To Address :</label>
                            <input
                                type="text"
                                value={recipient}
                                onChange={(e) => setRecipient(e.target.value)}
                                placeholder="Recipient address (0x...)"
                                className="w-full bg-input border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/30"
                            />
                        </div>

                        <div>
                            <label className="text-sm text-muted-foreground mb-1 block">Send :</label>
                            <input
                                type="text"
                                value={sendAmount}
                                onChange={(e) => setSendAmount(e.target.value)}
                                placeholder="0.0"
                                className="w-full bg-input border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/30"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={!recipient || !sendAmount}
                            className="w-full vaughan-btn text-center disabled:opacity-40 disabled:cursor-not-allowed mt-4"
                        >
                            Send
                        </button>
                    </form>
                </div>

                {/* Assets Dropdown — shows selected asset */}
                <div className="bg-card border border-border">
                    <button
                        onClick={() => setAssetsOpen(!assetsOpen)}
                        onContextMenu={handleAddCustomToken}
                        title="Right click to add Custom Token"
                        className="w-full px-4 py-2.5 flex items-center justify-between text-sm font-medium hover:bg-secondary transition-colors"
                    >
                        <SelectedAssetDisplay
                            selectedAsset={selectedAsset}
                            nativeSymbol={balance?.symbol || "ETH"}
                            nativeBalance={formatBalance(balance?.balance_eth)}
                            tokens={tokens}
                            activeAccount={activeAccount}
                        />
                        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${assetsOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {assetsOpen && (
                        <div className="border-t border-border">
                            <button
                                onClick={() => {
                                    setSelectedAsset("native");
                                    setSelectedSymbol(balance?.symbol || "ETH");
                                    setAssetsOpen(false);
                                }}
                                className={`w-full px-4 py-2.5 flex justify-between items-center text-sm border-b border-border/50 hover:bg-secondary transition-colors text-left ${selectedAsset === "native" ? "bg-secondary/50" : ""}`}
                            >
                                <span>{balance?.symbol || "ETH"}</span>
                                <span className="text-muted-foreground">{formatBalance(balance?.balance_eth)} {balance?.symbol || "ETH"}</span>
                            </button>

                            {tokens?.map((token) => (
                                <TokenRow
                                    key={`${token.chain_id}-${token.address}`}
                                    token={token}
                                    account={activeAccount}
                                    isSelected={selectedAsset === token.address}
                                    onSelect={() => {
                                        setSelectedAsset(token.address);
                                        setSelectedSymbol(token.symbol);
                                        setAssetsOpen(false);
                                    }}
                                />
                            ))}

                            {(!tokens || tokens.length === 0) && (
                                <div className="px-4 py-2.5 text-sm text-muted-foreground">
                                    No custom tokens tracked
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Render Privacy Modals */}
            <ShieldModal
                isOpen={shieldOpen}
                onClose={() => setShieldOpen(false)}
                activeAccount={activeAccount}
                chainId={network?.chain_id}
                nativeSymbol={network?.native_token?.symbol || "ETH"}
            />

            <UnshieldModal
                isOpen={unshieldOpen}
                onClose={() => setUnshieldOpen(false)}
                railgunWalletID={railgunClient.railgunWalletID || null}
                chainId={network?.chain_id}
                nativeSymbol={network?.native_token?.symbol || "ETH"}
                onRequiresProof={(active) => setZkProofActive(active)}
                activeAccount={activeAccount}
            />

            <TransferModal
                isOpen={transferOpen}
                onClose={() => setTransferOpen(false)}
                railgunWalletID={railgunClient.railgunWalletID || null}
                chainId={network?.chain_id}
                nativeSymbol={network?.native_token?.symbol || "ETH"}
                onRequiresProof={(active) => setZkProofActive(active)}
                activeAccount={activeAccount}
            />

            <ZkProofLoader
                isOpen={zkProofActive}
                progress={zkProgress}
            />
        </Layout>
    );
}

// Shows the selected asset's name + balance in the dropdown trigger
function SelectedAssetDisplay({
    selectedAsset,
    nativeSymbol,
    nativeBalance,
    tokens,
    activeAccount,
}: {
    selectedAsset: string;
    nativeSymbol: string;
    nativeBalance: string;
    tokens?: TrackedToken[];
    activeAccount: string | null;
}) {
    if (selectedAsset === "native") {
        return (
            <span className="flex items-center gap-3">
                <span>{nativeSymbol}</span>
                <span className="text-muted-foreground">{nativeBalance} {nativeSymbol}</span>
            </span>
        );
    }

    const token = tokens?.find(t => t.address === selectedAsset);
    if (!token) {
        return <span className="text-muted-foreground">Select asset</span>;
    }

    return <SelectedTokenDisplay token={token} account={activeAccount} />;
}

function SelectedTokenDisplay({ token, account }: { token: TrackedToken; account: string | null }) {
    const { data: balanceData } = useQuery({
        queryKey: ["token_balance", token.address, account],
        queryFn: () => account ? getTokenBalance(token.address, account) : null,
        enabled: !!account,
    });

    const bal = balanceData?.balance_formatted
        ? parseFloat(parseFloat(balanceData.balance_formatted).toFixed(6)).toString()
        : "0.00";

    return (
        <span className="flex items-center gap-3">
            <span>{token.symbol}</span>
            <span className="text-muted-foreground">{bal} {token.symbol}</span>
        </span>
    );
}

function TokenRow({ token, account, isSelected, onSelect }: {
    token: TrackedToken;
    account?: string | null;
    isSelected?: boolean;
    onSelect?: () => void;
}) {
    const { data: balanceData, isLoading } = useQuery({
        queryKey: ["token_balance", token.address, account],
        queryFn: () => account ? getTokenBalance(token.address, account) : null,
        enabled: !!account,
        refetchInterval: 60000,
    });

    const formatTokenBalance = (bal: string | undefined) => {
        if (!bal) return "0.00";
        const num = parseFloat(bal);
        if (isNaN(num) || num === 0) return "0.00";
        if (Number.isInteger(num)) return num.toLocaleString();
        return parseFloat(num.toFixed(6)).toString();
    };

    return (
        <button
            onClick={onSelect}
            className={`w-full px-4 py-2.5 flex justify-between items-center text-sm border-b border-border/50 last:border-0 hover:bg-secondary transition-colors text-left ${isSelected ? "bg-secondary/50" : ""}`}
        >
            <span>{token.symbol}</span>
            <span className="text-muted-foreground">
                {isLoading ? "..." : formatTokenBalance(balanceData?.balance_formatted)} {token.symbol}
            </span>
        </button>
    );
}

