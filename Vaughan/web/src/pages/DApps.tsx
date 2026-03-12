import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink, Search, Plus } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "../components/Layout";
import { NetworkSelector } from "../components/NetworkSelector";
import { AccountSelector } from "../components/AccountSelector";

import { NetworkService, WalletService, DappService } from "../services/tauri";
import { WHITELISTED_DAPPS } from "../utils/whitelistedDapps";

interface DApp {
    name: string;
    url: string;
    description: string;
    icon?: string;
    category: string;
    launchExecutable?: string;
    chains: number[];
    useProxy?: boolean;
}

// Convert WHITELISTED_DAPPS to DApp interface
const coreDapps: DApp[] = WHITELISTED_DAPPS.map(dapp => ({
    name: dapp.name,
    url: dapp.url,
    description: dapp.description,
    icon: dapp.icon,
    launchExecutable: dapp.launchExecutable,
    chains: dapp.chains,
    // Capitalize category for display
    category: dapp.category.charAt(0).toUpperCase() + dapp.category.slice(1).replace('Defi', 'DeFi').replace('Nft', 'NFT').replace('Dex', 'DEX'),
    useProxy: dapp.useProxy
}));

export default function DApps() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [activeAccount, setActiveAccount] = useState<string | null>(null);
    const [customUrl, setCustomUrl] = useState<string>("");
    const [isLaunchingCustom, setIsLaunchingCustom] = useState(false);

    // State for user's custom dApps loaded from localStorage
    const [customDapps, setCustomDapps] = useState<DApp[]>([]);
    // URLs of whitelisted dApps the user has chosen to hide (persisted)
    const [hiddenDappUrls, setHiddenDappUrls] = useState<string[]>([]);

    // Load custom dApps and hidden whitelist on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem('vaughan_custom_dapps');
            if (stored) {
                setCustomDapps(JSON.parse(stored));
            }
        } catch (e) {
            console.error("Failed to load custom dApps:", e);
        }
        try {
            const hidden = localStorage.getItem('vaughan_hidden_dapps');
            if (hidden) {
                setHiddenDappUrls(JSON.parse(hidden));
            }
        } catch (e) {
            console.error("Failed to load hidden dApps:", e);
        }
    }, []);

    const { data: network, isLoading: isNetworkLoading } = useQuery({
        queryKey: ["network"],
        queryFn: async () => {
            try {
                const n = await NetworkService.getNetworkInfo();
                return { network_id: n.id, name: n.name, chain_id: n.chain_id, rpc_url: n.rpc_url, native_token: { symbol: n.currency_symbol, name: n.currency_symbol, decimals: 18 } };
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

    const handleOpenDApp = async (dapp: DApp) => {
        try {
            console.log(`Opening ${dapp.name}...`);
            await DappService.openDappWindow(dapp.url, dapp.name, dapp.useProxy ?? false);
        } catch (error) {
            console.error("Failed to open dApp:", error);
            alert(`Failed to open dApp: ${error}`);
        }
    };

    const handleLaunchServer = async (e: React.MouseEvent, exePath: string) => {
        e.stopPropagation(); // Prevent the card's handleOpenDApp from firing
        try {
            console.log(`Launching server at ${exePath}...`);
            await DappService.launchExternalApp(exePath);
        } catch (error) {
            console.error("Failed to launch server:", error);
            alert(`Failed to launch server: ${error}`);
        }
    };

    const formatUrl = (url: string) => {
        let formattedUrl = url.trim();
        if (!/^https?:\/\//i.test(formattedUrl)) {
            formattedUrl = `https://${formattedUrl}`;
        }
        return formattedUrl;
    };

    const handleAddCustomDapp = (e: React.MouseEvent) => {
        e.preventDefault();
        if (!customUrl.trim()) return;

        const formattedUrl = formatUrl(customUrl);

        try {
            const parsedUrl = new URL(formattedUrl);
            const newDapp: DApp = {
                name: parsedUrl.hostname,
                url: formattedUrl,
                description: "Custom user-added dApp",
                category: "Custom",
                chains: [], // Empty chains array means it's available on all networks
                useProxy: false // Default to direct mode for custom URLs unless issues found
            };

            // Check for duplicates
            if (!customDapps.some(d => d.url === formattedUrl) && !coreDapps.some(d => d.url === formattedUrl)) {
                const updatedList = [...customDapps, newDapp];
                setCustomDapps(updatedList);
                localStorage.setItem('vaughan_custom_dapps', JSON.stringify(updatedList));
                setCustomUrl(""); // Clear input on success
            } else {
                alert("This dApp is already in your list.");
            }
        } catch (error) {
            alert("Please enter a valid URL.");
        }
    };

    const handleCustomUrlSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!customUrl.trim()) return;

        const formattedUrl = formatUrl(customUrl);

        setIsLaunchingCustom(true);
        try {
            console.log(`Opening custom dApp URL: ${formattedUrl}`);
            await DappService.openDappWindow(formattedUrl, new URL(formattedUrl).hostname, false);
            // We do not save to list automatically on launch, user must click +
        } catch (error) {
            console.error("Failed to open custom URL:", error);
            alert(`Failed to open custom URL: ${error}`);
        } finally {
            setIsLaunchingCustom(false);
        }
    };

    if (isNetworkLoading || isAccountsLoading) {
        return (
            <Layout showActions={false}>
                <div className="flex items-center justify-center min-h-[50vh]">
                    <div className="animate-spin h-8 w-8 border-b-2 border-foreground"></div>
                </div>
            </Layout>
        );
    }

    // Combine core dApps (filtered by network and not hidden) with all custom dApps
    const filteredCoreDapps = (network
        ? coreDapps.filter(dapp => dapp.chains.includes(network.chain_id))
        : coreDapps
    ).filter(dapp => !hiddenDappUrls.includes(dapp.url));

    const combinedDapps = [...customDapps, ...filteredCoreDapps];

    const getDAppIcon = (dapp: any) => {
        // If it's a URL or path, use it directly
        if (dapp.icon && (dapp.icon.startsWith('http') || dapp.icon.startsWith('/'))) {
            return dapp.icon;
        }

        // Use the hostname for the favicon service
        const hostname = new URL(dapp.url).hostname;
        return `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`;
    };

    const handleRemoveCustomDapp = (e: React.MouseEvent, urlToRemove: string) => {
        e.stopPropagation();
        const updatedList = customDapps.filter(d => d.url !== urlToRemove);
        setCustomDapps(updatedList);
        localStorage.setItem('vaughan_custom_dapps', JSON.stringify(updatedList));
    };

    /** Remove any dApp: custom dApps are deleted; whitelisted dApps are hidden (persisted). */
    const handleRemoveDapp = (e: React.MouseEvent, dapp: DApp) => {
        e.stopPropagation();
        e.preventDefault();
        const isCustom = customDapps.some(d => d.url === dapp.url);
        if (isCustom) {
            handleRemoveCustomDapp(e, dapp.url);
        } else {
            const updated = [...hiddenDappUrls, dapp.url];
            setHiddenDappUrls(updated);
            localStorage.setItem('vaughan_hidden_dapps', JSON.stringify(updated));
        }
    };

    const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>, dappUrl: string, dappIcon?: string) => {
        const target = e.target as HTMLImageElement;
        const hostname = new URL(dappUrl).hostname;

        // If Google fails, try Clearbit
        if (target.src.includes('google.com')) {
            target.src = `https://logo.clearbit.com/${hostname}`;
        }
        // If Clearbit fails or custom URL fails, try root domain as last ditch
        else if (target.src.includes('clearbit.com') || target.src === dappIcon) {
            const rootDomain = hostname.split('.').slice(-2).join('.');
            if (hostname !== rootDomain) {
                target.src = `https://www.google.com/s2/favicons?domain=${rootDomain}&sz=128`;
            } else {
                target.src = `https://avatar.vercel.sh/${hostname}`;
            }
        }
        // Final generic fallback
        else {
            target.src = `https://avatar.vercel.sh/${hostname}`;
        }
    };

    return (
        <Layout showActions={false}>
            <div className="max-w-5xl mx-auto w-full space-y-6 pt-2">

                {/* Header with Back Button and Centered Title */}
                <div className="relative flex items-center justify-center mb-6">
                    <button
                        onClick={() => navigate("/dashboard")}
                        className="absolute left-0 text-muted-foreground hover:text-foreground transition-colors p-2 -ml-2"
                        title="Back"
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <h1 className="text-2xl font-bold">DApps Browser</h1>
                </div>

                {/* Selectors Row - Full width side-by-side */}
                <div className="flex gap-2 w-full">
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

                <div className="grid grid-cols-3 gap-3">
                    {combinedDapps.map((dapp) => (
                        <div
                            key={dapp.url}
                            onClick={() => handleOpenDApp(dapp)}
                            className="bg-card border border-border rounded-none p-4 hover:border-primary/50 hover:shadow-lg transition-all cursor-pointer group flex flex-col justify-between h-full relative overflow-hidden"
                        >
                            <div className="space-y-2">
                                <div className="flex justify-between items-start">
                                    <div className="bg-primary/5 p-1 rounded-lg w-10 h-10 flex items-center justify-center overflow-hidden border border-border/50">
                                        <img
                                            src={getDAppIcon(dapp)}
                                            alt={dapp.name}
                                            className="w-full h-full object-contain"
                                            onError={(e) => handleImageError(e, dapp.url, dapp.icon)}
                                        />
                                    </div>
                                    <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                </div>

                                <div>
                                    <h3 className="text-base font-bold mb-1 group-hover:text-primary transition-colors truncate pr-6">{dapp.name}</h3>
                                    <p className="text-muted-foreground text-xs leading-tight line-clamp-2">{dapp.description}</p>
                                </div>
                            </div>

                            <div className="mt-3 pt-2 border-t border-border flex items-center justify-between text-[10px] font-medium text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                                <span className="bg-secondary px-1.5 py-0.5 rounded truncate max-w-[60px]">{dapp.category}</span>
                                <div className="flex items-center space-x-2">
                                    {dapp.launchExecutable && (
                                        <button
                                            onClick={(e) => handleLaunchServer(e, dapp.launchExecutable!)}
                                            className="bg-primary/10 text-primary hover:bg-primary/20 px-2 py-0.5 rounded transition-colors font-bold z-10 relative"
                                        >
                                            Server
                                        </button>
                                    )}
                                    <span className="truncate max-w-[80px]">{new URL(dapp.url).hostname}</span>
                                </div>
                            </div>

                            {/* Remove button for all dApps (custom: delete; whitelisted: hide) */}
                            <button
                                onClick={(e) => handleRemoveDapp(e, dapp)}
                                className="absolute top-2 right-10 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all z-10"
                                title={dapp.category === "Custom" ? "Remove from your list" : "Hide from list"}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                            </button>
                        </div>
                    ))}
                </div>

                {/* Custom URL Input Bar */}
                <div className="pt-4 pb-8">
                    <form
                        onSubmit={handleCustomUrlSubmit}
                        className="bg-card border border-border rounded-none p-2 flex items-center gap-2 focus-within:border-primary/50 focus-within:shadow-[0_0_15px_rgba(var(--primary),0.2)] transition-all"
                    >
                        <button
                            type="button"
                            onClick={handleAddCustomDapp}
                            disabled={!customUrl.trim() || isLaunchingCustom}
                            title="Add URL to your Custom dApps list"
                            className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                        <input
                            type="text"
                            value={customUrl}
                            onChange={(e) => setCustomUrl(e.target.value)}
                            placeholder="Type a URL and hit + to add, or Go to just launch..."
                            className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground/50 px-2"
                            disabled={isLaunchingCustom}
                        />
                        <button
                            type="submit"
                            disabled={!customUrl.trim() || isLaunchingCustom}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0 flex items-center gap-2"
                        >
                            {isLaunchingCustom ? (
                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <Search className="w-4 h-4" />
                            )}
                            Go
                        </button>
                    </form>
                </div>
            </div>
        </Layout>
    );
}
