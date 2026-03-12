import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { NetworkSelector } from "../components/NetworkSelector";
import { AccountSelector } from "../components/AccountSelector";
import { AddressDisplay, ColoredAddress } from "../components/AddressDisplay";

import {
    getTrackedTokens,
    getTokenBalance,
    TrackedToken
} from "../services/token";
import { PreferencesService, NetworkService, WalletService } from "../services/tauri";
import { railgunClient } from "../services/railgunWorkerClient";
import { Shield, Globe, ArrowRight } from "lucide-react";
import { ShieldModal } from "../components/PrivacyModals/ShieldModal";
import { UnshieldModal } from "../components/PrivacyModals/UnshieldModal";
import { TransferModal } from "../components/PrivacyModals/TransferModal";
import { ZkProofLoader } from "../components/PrivacyModals/ZkProofLoader";

import { AddTokenModal } from "../components/AddTokenModal";
import { events } from "../bindings/tauri-commands";


const formatBalance = (bal: string | undefined) => {
    if (!bal) return "0.00";
    const num = parseFloat(bal);
    if (isNaN(num) || num === 0) return "0.00";
    if (Number.isInteger(num)) return num.toLocaleString();
    return parseFloat(num.toFixed(6)).toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 6
    });
};

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

    // Token Modal State
    const [addTokenOpen, setAddTokenOpen] = useState(false);


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
        queryFn: async () => {
            try {
                const n = await NetworkService.getNetworkInfo();
                return {
                    network_id: n.id,
                    name: n.name,
                    chain_id: n.chain_id,
                    rpc_url: n.rpc_url,
                    native_token: { symbol: n.currency_symbol, name: n.currency_symbol, decimals: 18 },
                };
            } catch (error: any) {
                throw error;
            }
        },
    });

    const { data: accounts, isLoading: isAccountsLoading } = useQuery({
        queryKey: ["accounts"],
        queryFn: async () => {
            try {
                return await WalletService.getAccounts();
            } catch (error: any) {
                throw error;
            }
        },
    });

    const { data: supportedNetworks } = useQuery({
        queryKey: ["supported_networks"],
        queryFn: async () => NetworkService.getSupportedNetworks(),
    });

    const handleSwitchNetwork = async (net: any) => {
        try {
            await NetworkService.switchNetwork({ network_id: net.id, rpc_url: net.rpc_url, chain_id: net.chain_id });
            queryClient.invalidateQueries({ queryKey: ["network"] });
        } catch (e) {
            console.error("Failed to switch network:", e);
        }
    };

    const handleSelectAccount = async (address: string) => {
        try {
            await WalletService.setActiveAccount(address);
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
            WalletService.setActiveAccount(defaultAddress).catch(e =>
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

    // 🎯 Inform backend about the focused asset for optimized monitoring
    useEffect(() => {
        WalletService.setFocusedAsset(selectedAsset).catch(err => {
            console.warn("[Vaughan] Failed to sync focused asset to backend:", err);
        });
    }, [selectedAsset]);

    // 🔔 Listen for balance refresh signals from backend (typed event)
    useEffect(() => {
        const unlistenRefresh = events.refreshBalanceEvent.listen(() => {
            console.log("[Dashboard] Refreshing balances due to backend signal");
            queryClient.invalidateQueries({ queryKey: ["balance"] });
            queryClient.invalidateQueries({ queryKey: ["tracked_tokens"] });
            queryClient.invalidateQueries({ queryKey: ["token_balance"] });
        });

        return () => {
            unlistenRefresh.then(f => f());
        };
    }, [queryClient]);


    const { data: balance, isLoading: isBalanceLoading } = useQuery({
        queryKey: ["balance", activeAccount, network?.chain_id],
        queryFn: async () => {
            if (!activeAccount) return null;
            return NetworkService.getBalance(activeAccount);
        },
        enabled: !!activeAccount && !!network,
        refetchInterval: 60000,
    });

    const { data: tokens } = useQuery({
        queryKey: ["tracked_tokens", network?.chain_id],
        queryFn: getTrackedTokens,
        enabled: !!network,
    });


    const displayBalance = isShieldMode ? "0.00" : formatBalance(balance?.balance_eth);
    const displaySymbol = isShieldMode ? `${balance?.symbol || "ETH"} (zk)` : balance?.symbol || "ETH";

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

    const handleAddCustomToken = (e: React.MouseEvent) => {
        e.preventDefault(); // Prevent standard right-click menu
        setAddTokenOpen(true);
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

                <AddressDisplay address={activeAccount || undefined} />

                {/* Selectors Row */}
                <div className="flex gap-2 w-full pt-2">
                    <div className="flex-1 min-w-0 [&>button]:w-full">
                        <NetworkSelector
                            currentNetwork={network}
                            supportedNetworks={supportedNetworks || []}
                            onSwitchNetwork={handleSwitchNetwork}
                        />
                    </div>
                    <div className="flex-1 min-w-0 [&>button]:w-full [&>div]:w-full">
                        <AccountSelector
                            currentAccount={accounts?.find(a => a.address === activeAccount)}
                            accounts={accounts || []}
                            onSelectAccount={handleSelectAccount}
                        />
                    </div>
                </div>

                {/* Assets Dropdown — replaced the old Native Balance Box */}
                <div className="bg-card border border-border relative z-40">
                    <button
                        onClick={() => setAssetsOpen(!assetsOpen)}
                        onContextMenu={handleAddCustomToken}
                        title="Right click to add Custom Token"
                        className="w-full hover:bg-secondary transition-colors"
                    >
                        <SelectedAssetDisplay
                            selectedAsset={selectedAsset}
                            nativeSymbol={displaySymbol}
                            nativeBalance={isBalanceLoading ? "..." : displayBalance}
                            tokens={tokens}
                            activeAccount={activeAccount}
                        />
                    </button>

                    {assetsOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1 border border-border bg-card overflow-hidden shadow-lg z-50">
                            <button
                                onClick={() => {
                                    setSelectedAsset("native");
                                    setSelectedSymbol(displaySymbol);
                                    setAssetsOpen(false);
                                }}
                                className={`w-full px-4 py-2 grid grid-cols-2 items-center text-sm border-b border-border/50 hover:bg-secondary transition-colors text-left ${selectedAsset === "native" ? "bg-secondary/50" : ""}`}
                            >
                                <span className="font-bold">{displaySymbol}</span>
                                <span className="text-muted-foreground text-right">{displayBalance}</span>
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
                                <div className="px-4 py-2 text-sm text-muted-foreground text-center">
                                    No custom tokens tracked
                                </div>
                            )}
                        </div>
                    )}
                </div>

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
                onRequiresProof={(active: boolean) => setZkProofActive(active)}
                activeAccount={activeAccount}
            />

            <TransferModal
                isOpen={transferOpen}
                onClose={() => setTransferOpen(false)}
                railgunWalletID={railgunClient.railgunWalletID || null}
                chainId={network?.chain_id}
                nativeSymbol={network?.native_token?.symbol || "ETH"}
                onRequiresProof={(active: boolean) => setZkProofActive(active)}
                activeAccount={activeAccount}
            />


            <ZkProofLoader
                isOpen={zkProofActive}
                progress={zkProgress}
            />

            <AddTokenModal
                isOpen={addTokenOpen}
                onClose={() => setAddTokenOpen(false)}
                onTokenAdded={() => {
                    queryClient.invalidateQueries({ queryKey: ["tracked_tokens"] });
                }}
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
            <div className="w-full px-4 py-2 grid grid-cols-2 items-center">
                <span className="font-bold text-left">{nativeSymbol}</span>
                <span className="text-muted-foreground text-right">{nativeBalance}</span>
            </div>
        );
    }

    const token = tokens?.find(t => t.address === selectedAsset);
    if (!token) {
        return <div className="w-full px-4 py-2 text-muted-foreground text-left">Select asset</div>;
    }

    return <SelectedTokenDisplay token={token} account={activeAccount} />;
}

function SelectedTokenDisplay({ token, account }: { token: TrackedToken; account: string | null }) {
    const { data: balanceData } = useQuery({
        queryKey: ["token_balance", token.address, account],
        queryFn: () => account ? getTokenBalance(token.address, account) : null,
        enabled: !!account,
    });

    return (
        <div className="w-full px-4 py-2 grid grid-cols-2 items-center">
            <span className="font-bold text-left">{token.symbol}</span>
            <span className="text-muted-foreground text-right">
                {formatBalance(balanceData?.balance_formatted)}
            </span>
        </div>
    );
}

function TokenRow({ token, account, isSelected, onSelect }: {
    token: TrackedToken;
    account?: string | null;
    isSelected?: boolean;
    onSelect?: () => void;
}) {
    const [copied, setCopied] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    const { data: balanceData, isLoading } = useQuery({
        queryKey: ["token_balance", token.address, account],
        queryFn: () => account ? getTokenBalance(token.address, account) : null,
        enabled: !!account,
        refetchInterval: 60000,
    });


    const handleContextMenu = async (e: React.MouseEvent) => {
        e.preventDefault();
        try {
            await navigator.clipboard.writeText(token.address);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    return (
        <button
            onClick={onSelect}
            onContextMenu={handleContextMenu}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`w-full px-4 py-2 flex items-center text-sm border-b border-border/50 last:border-0 hover:bg-secondary transition-colors relative h-10 ${isSelected ? "bg-secondary/50" : ""}`}
        >
            {/* Ticker - Fixed Left */}
            <span className="font-bold truncate shrink-0 z-20 bg-inherit pr-2">{token.symbol}</span>

            {/* Address - Absolutely Centered */}
            <ColoredAddress
                address={token.address}
                className="absolute left-1/2 -translate-x-1/2 opacity-80 whitespace-nowrap px-1 overflow-visible pointer-events-none text-[14px]"
            />

            {/* Balance Overlay - Fixed Right */}
            {isHovered && (
                <div className="absolute top-0 right-0 h-full flex items-center pl-6 pr-4 bg-gradient-to-l from-secondary via-secondary to-transparent z-30 animate-in fade-in duration-200">
                    <span className="text-muted-foreground text-right tabular-nums whitespace-nowrap">
                        {isLoading ? "..." : formatBalance(balanceData?.balance_formatted)}
                    </span>
                </div>
            )}

            {copied && (
                <div className="absolute inset-0 bg-background/90 flex items-center justify-center z-40 animate-in fade-in duration-200">
                    <span className="text-sm text-green-500 font-medium font-mono">Copied: {token.address}</span>
                </div>
            )}
        </button>
    );
}

