import React, { useState } from 'react';
import { X, Save, Copy, Edit2, Trash2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useQueryClient } from '@tanstack/react-query';

interface AccountOptionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentAddress: string;
    currentName: string;
    accountType: string;
    accountIndex?: number;
    canDelete: boolean;
    onDeleteSuccess: () => void;
}

export function AccountOptionsModal({ isOpen, onClose, currentAddress, currentName, accountType, accountIndex, canDelete, onDeleteSuccess }: AccountOptionsModalProps) {
    // If it's an HD account, strip 'HD ' from the initial state so the user only edits the custom part
    const initialName = accountType === 'hd' && currentName.startsWith('HD ')
        ? currentName.substring(3)
        : currentName;

    const [mode, setMode] = useState<'menu' | 'rename' | 'export'>('menu');
    const [name, setName] = useState(initialName);
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [exportingKey, setExportingKey] = useState<'seed' | 'private' | null>(null);
    const [exportValue, setExportValue] = useState<string | null>(null);
    const queryClient = useQueryClient();

    // Reset state when modal opens
    React.useEffect(() => {
        if (isOpen) {
            setMode('menu');
            setName(accountType === 'hd' && currentName.startsWith('HD ') ? currentName.substring(3) : currentName);
            setPassword('');
            setError(null);
            setCopied(false);
            setExportingKey(null);
            setExportValue(null);
        }
    }, [isOpen, currentName, accountType]);

    if (!isOpen) return null;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(currentAddress);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy', err);
        }
    };

    const handleDelete = async () => {
        if (!canDelete) {
            setError("Cannot delete the last remaining account.");
            return;
        }

        const confirmDelete = window.confirm(`Are you sure you want to delete wallet "${currentName}"? This removes it from your Vaughan wallet.`);
        if (!confirmDelete) return;

        setLoading(true);
        setError(null);
        try {
            await invoke("delete_account", { address: currentAddress });
            await queryClient.invalidateQueries({ queryKey: ["accounts"] });
            onDeleteSuccess();
            onClose();
        } catch (error: any) {
            setError("Failed to delete wallet: " + error.toString());
        } finally {
            setLoading(false);
        }
    };

    const handleRenameSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        const newName = name.trim();
        // Re-attach "HD " prefix if it is an HD account
        const finalName = accountType === 'hd' ? `HD ${newName}` : newName;

        if (!password) {
            setError("Password is required to approve rename.");
            setLoading(false);
            return;
        }

        try {
            await invoke("rename_account", { address: currentAddress, newName: finalName, password });
            await queryClient.invalidateQueries({ queryKey: ["accounts"] });
            onClose();
        } catch (err: any) {
            setError(err.toString());
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        if (!password) {
            setError("Password is required to export keys.");
            setLoading(false);
            return;
        }

        try {
            if (exportingKey === 'seed') {
                const seed = await invoke<string>("export_mnemonic", { password });
                setExportValue(seed);
            } else if (exportingKey === 'private') {
                const pk = await invoke<string>("export_private_key", { address: currentAddress, password });
                setExportValue(pk);
            }
        } catch (err: any) {
            setError(err.toString());
        } finally {
            setLoading(false);
        }
    };

    const isMaster = accountIndex === 0 || currentName === 'Master Wallet';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-card w-full max-w-md rounded-xl border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()} // Prevent clicks inside from closing
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border/50">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        {mode === 'menu' ? 'Wallet Options' : 'Rename Wallet'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                        disabled={loading}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Form / Options Body */}
                <div className="p-4 space-y-4">
                    {/* Error Display */}
                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                            {error}
                        </div>
                    )}

                    {mode === 'menu' ? (
                        <div className="flex flex-col gap-2">
                            <div className="px-3 py-2 text-sm text-foreground bg-secondary/50 rounded-lg truncate border border-border/50 font-medium mb-2">
                                {currentName}
                            </div>

                            <button
                                onClick={() => setMode('rename')}
                                className="w-full text-left px-4 py-3 hover:bg-secondary rounded-lg transition-colors flex items-center gap-3 border border-border shadow-sm bg-background font-medium"
                            >
                                <Edit2 size={16} className="text-blue-500" /> Rename Wallet
                            </button>

                            {(isMaster) && (
                                <button
                                    onClick={() => { setMode('export'); setExportingKey('seed'); }}
                                    className="w-full text-left px-4 py-3 hover:bg-secondary rounded-lg transition-colors flex items-center gap-3 border border-border shadow-sm bg-background font-medium"
                                >
                                    <Save size={16} className="text-orange-500" /> Export Seed Phrase
                                </button>
                            )}

                            <button
                                onClick={() => { setMode('export'); setExportingKey('private'); }}
                                className="w-full text-left px-4 py-3 hover:bg-secondary rounded-lg transition-colors flex items-center gap-3 border border-border shadow-sm bg-background font-medium"
                            >
                                <Save size={16} className="text-yellow-500" /> Export Private Key
                            </button>

                            <button
                                onClick={handleCopy}
                                className="w-full text-left px-4 py-3 hover:bg-secondary rounded-lg transition-colors flex items-center gap-3 border border-border shadow-sm bg-background font-medium"
                            >
                                <Copy size={16} className={copied ? "text-green-500" : "text-purple-500"} />
                                {copied ? "Copied!" : "Copy Address"}
                            </button>

                            {canDelete && (
                                <button
                                    onClick={handleDelete}
                                    className="w-full text-left px-4 py-3 hover:bg-red-500/10 text-red-500 rounded-lg transition-colors flex items-center gap-3 border border-red-500/20 shadow-sm font-medium mt-2"
                                >
                                    <Trash2 size={16} /> Delete Wallet
                                </button>
                            )}
                        </div>
                    ) : mode === 'rename' ? (
                        <form onSubmit={handleRenameSubmit} className="space-y-4">
                            <div>
                                <label className="text-sm font-medium block mb-1.5">New Wallet Name</label>
                                <div className="flex items-center relative">
                                    {accountType === 'hd' && (
                                        <div className="absolute left-3 text-muted-foreground font-medium text-sm pointer-events-none select-none">
                                            HD
                                        </div>
                                    )}
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        disabled={loading}
                                        className={`w-full bg-background border border-border rounded-lg py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary ${accountType === 'hd' ? 'pl-9 pr-3' : 'px-3'}`}
                                        placeholder="e.g. Savings Account"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-medium block mb-1.5">Wallet Password</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={loading}
                                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                    placeholder="Required to approve rename"
                                />
                            </div>

                            {/* Footer / Actions */}
                            <div className="pt-2 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setMode('menu')}
                                    disabled={loading}
                                    className="px-4 py-2 text-sm font-medium hover:bg-secondary rounded-lg transition-colors border border-transparent"
                                >
                                    Back
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading || (accountType === 'hd' ? `HD ${name.trim()}` === currentName : name.trim() === currentName) || name.trim() === ""}
                                    className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Save size={16} />
                                    {loading ? "Saving..." : "Save Changes"}
                                </button>
                            </div>
                        </form>
                    ) : mode === 'export' ? (
                        <form onSubmit={handleExport} className="space-y-4">
                            <div className="bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 p-3 rounded-lg text-sm mb-4">
                                <strong>Warning:</strong> Never share your {exportingKey === 'seed' ? 'seed phrase' : 'private key'} with anyone. Anyone with this key can steal your funds.
                            </div>

                            {!exportValue ? (
                                <>
                                    <div>
                                        <label className="text-sm font-medium block mb-1.5">Wallet Password</label>
                                        <input
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            disabled={loading}
                                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                            placeholder="Required to export keys"
                                            autoFocus
                                        />
                                    </div>
                                    <div className="pt-2 flex justify-end gap-3">
                                        <button
                                            type="button"
                                            onClick={() => { setMode('menu'); setPassword(''); setExportingKey(null); }}
                                            disabled={loading}
                                            className="px-4 py-2 text-sm font-medium hover:bg-secondary rounded-lg transition-colors border border-transparent"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={loading || !password}
                                            className="px-4 py-2 text-sm font-medium bg-red-500 text-white hover:bg-red-600 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <Save size={16} />
                                            {loading ? "Decrypting..." : `Reveal ${exportingKey === 'seed' ? 'Seed' : 'Key'}`}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="space-y-4">
                                    <div className="p-4 bg-background border border-border rounded-lg font-mono text-sm break-all select-all text-center">
                                        {exportValue}
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                await navigator.clipboard.writeText(exportValue);
                                                setCopied(true);
                                                setTimeout(() => setCopied(false), 2000);
                                            }}
                                            className="w-full py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                                        >
                                            <Copy size={16} />
                                            {copied ? "Copied to Clipboard!" : "Copy to Clipboard"}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setMode('menu');
                                                setExportValue(null);
                                                setPassword('');
                                                setExportingKey(null);
                                            }}
                                            className="w-full py-2.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg font-medium transition-colors"
                                        >
                                            Close
                                        </button>
                                    </div>
                                </div>
                            )}
                        </form>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
