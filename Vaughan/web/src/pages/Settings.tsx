import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, RotateCcw, Shield, Globe, Lock, Cpu } from "lucide-react";
import { Layout } from "../components/Layout";
import { PerformanceService, MethodStats, NetworkService, WalletService } from "../services/tauri";

interface NetworkInfo {
    network_id: string;
    name: string;
    chain_id: number;
    rpc_url: string;
    explorer_url: string;
    native_token: { symbol: string; name: string; decimals: number };
}

export default function Settings() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const { data: networkInfo } = useQuery<NetworkInfo>({
        queryKey: ["network_info"],
        queryFn: async () => {
            const n = await NetworkService.getNetworkInfo();
            return { network_id: n.id, name: n.name, chain_id: n.chain_id, rpc_url: n.rpc_url, explorer_url: n.explorer_url ?? "", native_token: { symbol: n.currency_symbol, name: n.currency_symbol, decimals: 18 } };
        },
    });

    const { data: performanceStats } = useQuery<Record<string, MethodStats>>({
        queryKey: ["performance_stats"],
        queryFn: () => PerformanceService.getPerformanceStats(),
        refetchInterval: 5000,
    });

    // RPC URL override
    const [rpcUrl, setRpcUrl] = useState("");
    const [rpcSaving, setRpcSaving] = useState(false);
    const [rpcMsg, setRpcMsg] = useState("");

    // Lock timeout
    const [lockTimeout, setLockTimeout] = useState("15");
    const [lockMsg, setLockMsg] = useState("");

    const handleSaveRpc = async () => {
        if (!rpcUrl.trim()) {
            setRpcMsg("Enter a valid RPC URL");
            return;
        }
        setRpcSaving(true);
        setRpcMsg("");
        try {
            await NetworkService.switchNetwork({
                network_id: networkInfo?.network_id ?? "custom",
                rpc_url: rpcUrl.trim(),
                chain_id: networkInfo?.chain_id ?? 1,
            });
            queryClient.invalidateQueries({ queryKey: ["network_info"] });
            queryClient.invalidateQueries({ queryKey: ["balance"] });
            setRpcMsg("RPC updated ✓");
            setRpcUrl("");
        } catch (e: any) {
            setRpcMsg(`Failed: ${e}`);
        } finally {
            setRpcSaving(false);
        }
    };

    const handleLockNow = async () => {
        await WalletService.lockWallet().catch(() => { });
        queryClient.clear();
        navigate("/unlock");
    };

    const handleResetState = async () => {
        if (!window.confirm("This will clear all wallet data. Are you sure?")) return;
        await WalletService.resetState().catch(() => { });
        queryClient.clear();
        // Force a hard reload to completely flush React state and re-mount App.tsx
        window.location.href = "/";
    };

    return (
        <Layout showActions={false}>
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <button
                    onClick={() => navigate("/dashboard")}
                    className="p-2 hover:bg-secondary rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-xl font-semibold">Settings</h1>
            </div>

            <div className="space-y-4">
                {/* Current Network */}
                <section className="bg-card border border-border rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1">
                        <Globe className="w-4 h-4" />
                        Network
                    </div>
                    <div className="text-sm space-y-1">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Network</span>
                            <span className="font-medium">{networkInfo?.name ?? "—"}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Chain ID</span>
                            <span className="font-mono">{networkInfo?.chain_id ?? "—"}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">RPC</span>
                            <span className="font-mono text-xs truncate max-w-[180px] text-foreground/70">
                                {networkInfo?.rpc_url ?? "—"}
                            </span>
                        </div>
                    </div>

                    {/* RPC Override */}
                    <div className="pt-2 border-t border-border/50">
                        <p className="text-xs text-muted-foreground mb-2">Override RPC URL for current network</p>
                        <div className="flex gap-2">
                            <input
                                type="url"
                                value={rpcUrl}
                                onChange={e => { setRpcUrl(e.target.value); setRpcMsg(""); }}
                                placeholder="https://rpc.example.com"
                                className="flex-1 px-3 py-2 bg-background border border-border rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            <button
                                onClick={handleSaveRpc}
                                disabled={rpcSaving}
                                className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground text-xs font-medium rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                            >
                                <Save className="w-3.5 h-3.5" />
                                {rpcSaving ? "Saving..." : "Save"}
                            </button>
                        </div>
                        {rpcMsg && (
                            <p className={`text-xs mt-1.5 ${rpcMsg.includes("✓") ? "text-green-500" : "text-red-400"}`}>
                                {rpcMsg}
                            </p>
                        )}
                    </div>
                </section>

                {/* Security */}
                <section className="bg-card border border-border rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1">
                        <Shield className="w-4 h-4" />
                        Security
                    </div>

                    {/* Lock timeout */}
                    <div>
                        <label className="text-xs text-muted-foreground block mb-1.5">
                            Auto-lock after inactivity
                        </label>
                        <div className="flex gap-2 items-center">
                            <select
                                value={lockTimeout}
                                onChange={e => { setLockTimeout(e.target.value); setLockMsg("Saved ✓"); setTimeout(() => setLockMsg(""), 2000); }}
                                className="px-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                                <option value="5">5 minutes</option>
                                <option value="15">15 minutes</option>
                                <option value="30">30 minutes</option>
                                <option value="60">1 hour</option>
                                <option value="0">Never</option>
                            </select>
                            {lockMsg && <span className="text-xs text-green-500">{lockMsg}</span>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5">
                            Note: Auto-lock is enforced on next app launch.
                        </p>
                    </div>

                    {/* Lock Now */}
                    <button
                        onClick={handleLockNow}
                        className="flex items-center gap-2 w-full px-4 py-2.5 bg-secondary hover:bg-secondary/80 text-sm font-medium rounded transition-colors"
                    >
                        <Lock className="w-4 h-4" />
                        Lock Wallet Now
                    </button>
                </section>

                {/* Performance Metrics */}
                <section className="bg-card border border-border rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1">
                        <Cpu className="w-4 h-4" />
                        Performance Metrics
                    </div>
                    {performanceStats && Object.keys(performanceStats).length > 0 ? (
                        <div className="space-y-2">
                            {Object.entries(performanceStats).map(([method, stats]) => (
                                <div key={method} className="flex flex-col text-xs bg-background/50 rounded border border-border/50 p-2">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-mono text-primary truncate max-w-[200px]" title={method}>
                                            {method}
                                        </span>
                                        <span className="text-muted-foreground">{stats.count} calls</span>
                                    </div>
                                    <div className="flex gap-4 text-muted-foreground">
                                        <span>Avg: {stats.avg}ms</span>
                                        <span>Min: {stats.min}ms</span>
                                        <span>Max: {stats.max}ms</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-muted-foreground italic">No performance data recorded yet.</p>
                    )}
                </section>

                {/* Danger Zone */}
                <section className="bg-card border border-red-500/20 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-red-400 mb-1">
                        <RotateCcw className="w-4 h-4" />
                        Danger Zone
                    </div>
                    <p className="text-xs text-muted-foreground">
                        This will permanently erase all wallet data from this device. Make sure you have your seed phrase backed up.
                    </p>
                    <button
                        onClick={handleResetState}
                        className="w-full px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium rounded border border-red-500/20 transition-colors"
                    >
                        Reset All Wallet Data
                    </button>
                </section>
            </div>
        </Layout>
    );
}
