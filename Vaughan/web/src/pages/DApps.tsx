import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "../components/Layout";
import { NetworkSelector } from "../components/NetworkSelector";
import { AccountSelector } from "../components/AccountSelector";

import { WHITELISTED_DAPPS } from "../utils/whitelistedDapps";

interface DApp {
    name: string;
    url: string;
    description: string;
    icon?: string;
    category: string;
    launchExecutable?: string;
}

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

// Convert WHITELISTED_DAPPS to DApp interface
const dapps: DApp[] = WHITELISTED_DAPPS.map(dapp => ({
    name: dapp.name,
    url: dapp.url,
    description: dapp.description,
    icon: dapp.icon,
    launchExecutable: dapp.launchExecutable,
    // Capitalize category for display
    category: dapp.category.charAt(0).toUpperCase() + dapp.category.slice(1).replace('Defi', 'DeFi').replace('Nft', 'NFT').replace('Dex', 'DEX')
}));

export default function DApps() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [activeAccount, setActiveAccount] = useState<string | null>(null);

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

    const handleOpenDApp = async (dapp: DApp) => {
        try {
            console.log(`Opening ${dapp.name}...`);
            await invoke("open_dapp_window", {
                url: dapp.url,
                title: dapp.name
            });
        } catch (error) {
            console.error("Failed to open dApp:", error);
            alert(`Failed to open dApp: ${error}`);
        }
    };

    const handleLaunchServer = async (e: React.MouseEvent, exePath: string) => {
        e.stopPropagation(); // Prevent the card's handleOpenDApp from firing
        try {
            console.log(`Launching server at ${exePath}...`);
            await invoke("launch_external_app", { exePath });
        } catch (error) {
            console.error("Failed to launch server:", error);
            alert(`Failed to launch server: ${error}`);
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

    const getDAppIcon = (dapp: any) => {
        // If it's a URL or path, use it directly
        if (dapp.icon && (dapp.icon.startsWith('http') || dapp.icon.startsWith('/'))) {
            return dapp.icon;
        }

        // Use the hostname for the favicon service
        const hostname = new URL(dapp.url).hostname;
        return `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`;
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

                <div className="grid grid-cols-2 gap-4">
                    {dapps.map((dapp) => (
                        <div
                            key={dapp.url}
                            onClick={() => handleOpenDApp(dapp)}
                            className="bg-card border border-border rounded-xl p-4 hover:border-primary/50 hover:shadow-lg transition-all cursor-pointer group flex flex-col justify-between h-full"
                        >
                            <div className="space-y-2">
                                <div className="flex justify-between items-start">
                                    <div className="bg-primary/5 p-1 rounded-lg w-10 h-10 flex items-center justify-center overflow-hidden border border-border/50">
                                        <img
                                            src={getDAppIcon(dapp)}
                                            alt={dapp.name}
                                            className="w-full h-full object-contain"
                                            onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                const hostname = new URL(dapp.url).hostname;

                                                // If Google fails, try Clearbit
                                                if (target.src.includes('google.com')) {
                                                    target.src = `https://logo.clearbit.com/${hostname}`;
                                                }
                                                // If Clearbit fails or custom URL fails, try root domain as last ditch
                                                else if (target.src.includes('clearbit.com') || target.src === dapp.icon) {
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
                                            }}
                                        />
                                    </div>
                                    <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                </div>

                                <div>
                                    <h3 className="text-base font-bold mb-1 group-hover:text-primary transition-colors truncate">{dapp.name}</h3>
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
                        </div>
                    ))}
                </div>
            </div>
        </Layout>
    );
}
