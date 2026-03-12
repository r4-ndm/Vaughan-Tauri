import React, { useState } from 'react';
import { ChevronDown, Plus, X } from 'lucide-react';
import { NetworkService } from '../../services/tauri';

interface NetworkConfig {
    id: string;
    name: string;
    chain_id: number;
    rpc_url: string;
}

interface NetworkInfo {
    network_id: string;
    name: string;
    chain_id: number;
    rpc_url: string;
}

interface NetworkSelectorProps {
    currentNetwork?: NetworkInfo;
    supportedNetworks?: NetworkConfig[];
    onSwitchNetwork?: (network: NetworkConfig) => void;
}

interface CustomNetworkForm {
    name: string;
    rpc_url: string;
    chain_id: string;
}

export const NetworkSelector: React.FC<NetworkSelectorProps> = ({
    currentNetwork,
    supportedNetworks = [],
    onSwitchNetwork
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [showCustomModal, setShowCustomModal] = useState(false);
    const [form, setForm] = useState<CustomNetworkForm>({ name: '', rpc_url: '', chain_id: '' });
    const [adding, setAdding] = useState(false);
    const [error, setError] = useState('');

    const handleSelect = (network: NetworkConfig) => {
        onSwitchNetwork?.(network);
        setIsOpen(false);
    };

    const handleAddCustom = async () => {
        if (!form.name || !form.rpc_url || !form.chain_id) {
            setError('All fields are required');
            return;
        }
        const chainId = parseInt(form.chain_id);
        if (isNaN(chainId) || chainId <= 0) {
            setError('Chain ID must be a positive number');
            return;
        }

        setAdding(true);
        setError('');
        try {
            const networkId = `custom-${chainId}`;
            await NetworkService.switchNetwork({
                network_id: networkId,
                rpc_url: form.rpc_url.trim(),
                chain_id: chainId,
            });
            // Notify parent with a synthetic NetworkConfig so it refreshes
            onSwitchNetwork?.({
                id: networkId,
                name: form.name.trim(),
                chain_id: chainId,
                rpc_url: form.rpc_url.trim(),
            });
            setShowCustomModal(false);
            setIsOpen(false);
            setForm({ name: '', rpc_url: '', chain_id: '' });
        } catch (e: any) {
            setError(typeof e === 'string' ? e : 'Failed to connect to network');
        } finally {
            setAdding(false);
        }
    };

    const displayTitle = currentNetwork?.name || 'Loading...';

    return (
        <div className="relative w-full text-left font-sans">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center px-4 py-2.5 bg-card border border-border text-sm font-medium hover:bg-secondary transition-colors"
                type="button"
            >
                <span>{displayTitle}</span>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute left-0 right-0 mt-1 bg-card border border-border shadow-lg z-[60]">
                    {supportedNetworks.map((network) => (
                        <button
                            key={network.id}
                            onClick={() => handleSelect(network)}
                            className={`w-full px-4 py-2.5 flex justify-between items-center text-sm border-b border-border/50 hover:bg-secondary transition-colors text-left ${currentNetwork?.network_id === network.id ? 'bg-secondary/50' : ''}`}
                            type="button"
                        >
                            <div className="flex items-center">
                                <div className={`h-2 w-2 rounded-full mr-2 ${currentNetwork?.network_id === network.id ? 'bg-green-500' : 'bg-transparent'}`} />
                                <span>{network.name}</span>
                            </div>
                        </button>
                    ))}

                    {/* Add Custom Network button */}
                    <button
                        onClick={() => { setShowCustomModal(true); setIsOpen(false); setError(''); }}
                        className="w-full px-4 py-2.5 flex items-center gap-2 text-sm text-primary hover:bg-secondary transition-colors border-t border-border"
                        type="button"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Add Custom Network
                    </button>
                </div>
            )}

            {/* Custom Network Modal */}
            {showCustomModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
                        <div className="flex justify-between items-center mb-5">
                            <h2 className="text-base font-semibold">Add Custom Network</h2>
                            <button
                                onClick={() => { setShowCustomModal(false); setError(''); }}
                                className="p-1 hover:bg-secondary rounded transition-colors text-muted-foreground"
                                type="button"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1">Network Name</label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="e.g. My Private Chain"
                                    className="w-full px-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1">RPC URL</label>
                                <input
                                    type="url"
                                    value={form.rpc_url}
                                    onChange={e => setForm(f => ({ ...f, rpc_url: e.target.value }))}
                                    placeholder="https://rpc.example.com"
                                    className="w-full px-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1">Chain ID</label>
                                <input
                                    type="number"
                                    value={form.chain_id}
                                    onChange={e => setForm(f => ({ ...f, chain_id: e.target.value }))}
                                    placeholder="e.g. 1337"
                                    className="w-full px-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                            </div>

                            {error && (
                                <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded">{error}</p>
                            )}

                            <div className="flex gap-3 pt-1">
                                <button
                                    onClick={() => { setShowCustomModal(false); setError(''); }}
                                    className="flex-1 px-4 py-2 bg-secondary hover:bg-secondary/80 text-sm font-medium rounded transition-colors"
                                    type="button"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddCustom}
                                    disabled={adding}
                                    className="flex-1 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                                    type="button"
                                >
                                    {adding ? 'Connecting...' : 'Add Network'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
