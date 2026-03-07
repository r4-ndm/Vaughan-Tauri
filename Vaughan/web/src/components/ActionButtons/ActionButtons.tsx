import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Copy, Check, X } from 'lucide-react';


// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm">
                <div className="flex justify-between items-center px-5 pt-5 pb-3 border-b border-border/50">
                    <h2 className="text-base font-semibold">{title}</h2>
                    <button onClick={onClose} className="p-1 hover:bg-secondary rounded text-muted-foreground">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="p-5 space-y-4">{children}</div>
            </div>
        </div>
    );
}

function PasswordInput({ value, onChange, placeholder = "Password" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
    const [show, setShow] = useState(false);
    return (
        <div className="relative">
            <input
                type={show ? "text" : "password"}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full px-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary pr-9"
            />
            <button type="button" onClick={() => setShow(s => !s)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
        </div>
    );
}

/** Displays a mnemonic phrase in a styled word grid */
function MnemonicDisplay({ mnemonic }: { mnemonic: string }) {
    const words = mnemonic.trim().split(/\s+/);
    const [copied, setCopied] = useState(false);

    const copyAll = useCallback(() => {
        navigator.clipboard.writeText(mnemonic).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }, [mnemonic]);

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-3 gap-1.5 p-3 bg-background border border-border rounded-lg">
                {words.map((word, i) => (
                    <div key={i} className="flex items-center gap-1.5 px-2 py-1 bg-secondary rounded text-xs">
                        <span className="text-muted-foreground w-4 text-right shrink-0">{i + 1}.</span>
                        <span className="font-mono font-medium">{word}</span>
                    </div>
                ))}
            </div>
            <button onClick={copyAll} className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-secondary hover:bg-secondary/80 rounded text-xs font-medium transition-colors">
                {copied ? <><Check className="w-3.5 h-3.5 text-green-500" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy to clipboard</>}
            </button>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal: Create Wallet
// ─────────────────────────────────────────────────────────────────────────────

export function CreateWalletModal({ onClose }: { onClose: () => void }) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [walletExists, setWalletExists] = useState<boolean | null>(null);
    const [step, setStep] = useState<'password' | 'phrase' | 'done'>('password');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [wordCount, setWordCount] = useState<12 | 24>(12);
    const [mnemonic, setMnemonic] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [confirmed, setConfirmed] = useState(false);

    // Detect if a wallet already exists
    useEffect(() => {
        invoke<boolean>('wallet_exists').then(setWalletExists).catch(() => setWalletExists(false));
    }, []);

    // ── Path A: wallet exists → add HD account ──────────────────────────────
    const handleAddAccount = async () => {
        if (!password) { setError('Enter your wallet password'); return; }
        setLoading(true); setError('');
        try {
            await invoke('create_account', { password });
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            queryClient.invalidateQueries({ queryKey: ['balance'] });
            onClose();
        } catch (e: any) {
            setError(typeof e === 'string' ? e : 'Incorrect password or wallet locked');
        } finally {
            setLoading(false);
        }
    };

    // ── Path B: no wallet → generate new seed ───────────────────────────────
    const handleCreate = async () => {
        if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
        if (password !== confirm) { setError('Passwords do not match'); return; }
        setLoading(true); setError('');
        try {
            const phrase = await invoke<string>('create_wallet', { password, wordCount });
            setMnemonic(phrase);
            setStep('phrase');
        } catch (e: any) {
            setError(typeof e === 'string' ? e : JSON.stringify(e));
        } finally {
            setLoading(false);
        }
    };

    const handleFinish = async () => {
        await invoke('unlock_wallet', { password }).catch(() => { });
        queryClient.invalidateQueries({ queryKey: ['accounts'] });
        queryClient.invalidateQueries({ queryKey: ['balance'] });
        onClose();
        navigate('/dashboard');
    };

    if (walletExists === null) {
        return <Modal title="Create" onClose={onClose}><p className="text-sm text-muted-foreground text-center py-4">Loading...</p></Modal>;
    }

    // ── Path A UI: add HD account ───────────────────────────────────────────
    if (walletExists) {
        return (
            <Modal title="Create" onClose={onClose}>
                <div className="p-3 bg-primary/10 border border-primary/20 rounded text-xs text-primary space-y-1">
                    <p className="font-semibold">Creating a new HD wallet</p>
                    <p className="text-muted-foreground">
                        A new address will be derived from your existing seed phrase (m/44'/60'/0'/0/n).
                        All wallets share the same recovery phrase.
                    </p>
                </div>
                <div>
                    <label className="text-xs text-muted-foreground block mb-1">Wallet password (to authorise)</label>
                    <PasswordInput value={password} onChange={setPassword} />
                </div>
                {error && <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded">{error}</p>}
                <button onClick={handleAddAccount} disabled={loading}
                    className="w-full py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded hover:opacity-90 disabled:opacity-50 transition-opacity">
                    {loading ? 'Creating...' : 'Add HD Wallet'}
                </button>
            </Modal>
        );
    }

    // ── Path B UI: new wallet ───────────────────────────────────────────────
    return (
        <Modal title="Create New Wallet" onClose={onClose}>
            {step === 'password' && (
                <>
                    <p className="text-xs text-muted-foreground">A new seed phrase will be generated. Keep it safe — it's the only way to recover your wallet.</p>
                    <div>
                        <label className="text-xs text-muted-foreground block mb-1">Word count</label>
                        <div className="flex gap-2">
                            {([12, 24] as const).map(n => (
                                <button key={n} type="button" onClick={() => setWordCount(n)}
                                    className={`flex-1 py-1.5 text-sm rounded border transition-colors ${wordCount === n ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-secondary'}`}>
                                    {n} words
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-muted-foreground block mb-1">Password</label>
                        <PasswordInput value={password} onChange={setPassword} placeholder="Min. 8 characters" />
                    </div>
                    <div>
                        <label className="text-xs text-muted-foreground block mb-1">Confirm password</label>
                        <PasswordInput value={confirm} onChange={setConfirm} placeholder="Repeat password" />
                    </div>
                    {error && <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded">{error}</p>}
                    <button onClick={handleCreate} disabled={loading}
                        className="w-full py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded hover:opacity-90 disabled:opacity-50 transition-opacity">
                        {loading ? 'Generating...' : 'Generate Wallet'}
                    </button>
                </>
            )}

            {step === 'phrase' && (
                <>
                    <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded text-xs text-yellow-400">
                        ⚠️ Write these words down and store them safely. You will NOT be able to see them again.
                    </div>
                    <MnemonicDisplay mnemonic={mnemonic} />
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                        <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="rounded" />
                        I have written down my seed phrase
                    </label>
                    <button onClick={handleFinish} disabled={!confirmed}
                        className="w-full py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded hover:opacity-90 disabled:opacity-50 transition-opacity">
                        I'm done — open wallet
                    </button>
                </>
            )}
        </Modal>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal: Import Wallet
// ─────────────────────────────────────────────────────────────────────────────

export function ImportWalletForm({ onClose }: { onClose: () => void }) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [mnemonic, setMnemonic] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const wordCount = mnemonic.trim().split(/\s+/).filter(Boolean).length;
    const isValidWordCount = wordCount === 12 || wordCount === 24;

    const handleImport = async () => {
        if (!isValidWordCount) { setError('Enter exactly 12 or 24 words'); return; }
        if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
        if (password !== confirm) { setError('Passwords do not match'); return; }
        setLoading(true); setError('');
        try {
            await invoke('import_wallet', { mnemonic: mnemonic.trim().toLowerCase(), password, accountCount: 1 });
            await invoke('unlock_wallet', { password }).catch(() => { });
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            queryClient.invalidateQueries({ queryKey: ['balance'] });
            onClose();
            navigate('/dashboard');
        } catch (e: any) {
            setError(typeof e === 'string' ? e : JSON.stringify(e));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <div>
                <label className="text-xs text-muted-foreground block mb-1">
                    Seed phrase <span className={`ml-1 ${isValidWordCount ? 'text-green-500' : 'text-muted-foreground'}`}>({wordCount} words{isValidWordCount ? ' ✓' : ''})</span>
                </label>
                <textarea
                    value={mnemonic}
                    onChange={e => { setMnemonic(e.target.value); setError(''); }}
                    placeholder="Enter your 12 or 24 word seed phrase..."
                    rows={3}
                    className="w-full px-3 py-2 bg-background border border-border rounded text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                    spellCheck={false}
                    autoCorrect="off"
                    autoCapitalize="off"
                />
            </div>
            <div>
                <label className="text-xs text-muted-foreground block mb-1">New password</label>
                <PasswordInput value={password} onChange={setPassword} placeholder="Min. 8 characters" />
            </div>
            <div>
                <label className="text-xs text-muted-foreground block mb-1">Confirm password</label>
                <PasswordInput value={confirm} onChange={setConfirm} placeholder="Repeat password" />
            </div>
            {error && <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded">{error}</p>}
            <button onClick={handleImport} disabled={loading || !isValidWordCount}
                className="w-full py-2.5 mt-2 bg-primary text-primary-foreground text-sm font-medium rounded hover:opacity-90 disabled:opacity-50 transition-opacity">
                {loading ? 'Importing...' : 'Import Wallet'}
            </button>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal: Import Single Account via Private Key
// ─────────────────────────────────────────────────────────────────────────────

export function ImportAccountForm({ onClose }: { onClose: () => void }) {
    const queryClient = useQueryClient();
    const [privateKey, setPrivateKey] = useState('');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleImport = async () => {
        if (!privateKey.trim()) { setError('Enter a private key'); return; }
        if (!password) { setError('Enter your wallet password'); return; }

        setLoading(true); setError('');

        try {
            await invoke('import_account', {
                privateKey: privateKey.trim(),
                name: name.trim() || 'Imported Account',
                password
            });

            // Success - refresh UI and close
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            queryClient.invalidateQueries({ queryKey: ['balance'] });
            onClose();
        } catch (e: any) {
            setError(typeof e === 'string' ? e : JSON.stringify(e));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="space-y-4">
                <div>
                    <label className="text-xs text-muted-foreground block mb-1">Private Key String</label>
                    <input
                        type="password"
                        value={privateKey}
                        onChange={e => { setPrivateKey(e.target.value); setError(''); }}
                        placeholder="e.g. 0x123abc..."
                        className="w-full px-3 py-2 bg-background border border-border rounded text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                        spellCheck={false}
                        autoCorrect="off"
                        autoCapitalize="off"
                    />
                </div>

                <div>
                    <label className="text-xs text-muted-foreground block mb-1">Account Name (Optional)</label>
                    <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Imported Account"
                        maxLength={30}
                        className="w-full px-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                </div>

                <div>
                    <label className="text-xs text-muted-foreground block mb-1">Wallet Password (to authorize)</label>
                    <PasswordInput value={password} onChange={setPassword} />
                </div>
            </div>

            {error && <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded mt-4">{error}</p>}

            <button
                onClick={handleImport}
                disabled={loading || !privateKey.trim() || !password}
                className="w-full py-2.5 mt-2 bg-primary text-primary-foreground text-sm font-medium rounded hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
                {loading ? 'Importing...' : 'Import Account'}
            </button>
        </div>
    );
}


// ─────────────────────────────────────────────────────────────────────────────
// Modal: Import Modal Wrapper (Tabs for Seed or Private Key)
// ─────────────────────────────────────────────────────────────────────────────

export function ImportModalDialog({ onClose, walletExists }: { onClose: () => void, walletExists: boolean }) {
    const [mode, setMode] = useState<'seed' | 'key'>(walletExists ? 'key' : 'seed');

    return (
        <Modal title="Import" onClose={onClose}>
            <div className="flex bg-secondary p-1 rounded-md mb-4 mt-2">
                <button
                    onClick={() => setMode('seed')}
                    className={`flex-1 py-1.5 text-xs font-medium rounded ${mode === 'seed' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                    Seed Phrase
                </button>
                <button
                    onClick={() => setMode('key')}
                    className={`flex-1 py-1.5 text-xs font-medium rounded ${mode === 'key' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                    Private Key
                </button>
            </div>

            {mode === 'seed' && (
                <>
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-500 mb-4 font-medium">
                        ⚠️ WARNING: Importing a new 12 or 24-word seed phrase will completely wipe the device, removing all current accounts.
                    </div>
                    {/* Reusing the body of the original ImportWalletModal minus the <Modal> wrapper */}
                    <ImportWalletForm onClose={onClose} />
                </>
            )}

            {mode === 'key' && (
                <>
                    <div className="p-3 bg-secondary/50 border border-border rounded text-xs text-muted-foreground mb-4">
                        Imported accounts will not be associated with your originally created Vaughan Wallet seed phrase.
                    </div>
                    {/* Reusing the body of the original ImportAccountModal minus the <Modal> wrapper */}
                    <ImportAccountForm onClose={onClose} />
                </>
            )}
        </Modal>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main ActionButtons
// ─────────────────────────────────────────────────────────────────────────────

export interface ActionButtonsProps {
    onReceiveClick: () => void;
    onDappBrowserClick: () => void;
    onRefreshClick: () => void;
    onHistoryClick: () => void;
    onSettingsClick: () => void;
    disabled?: boolean;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
    onReceiveClick,
    onDappBrowserClick,
    onRefreshClick,
    onHistoryClick,
    onSettingsClick,
    disabled = false,
}) => {
    const [modal, setModal] = useState<'create' | 'import' | null>(null);

    // Fetch whether the wallet is initialized directly
    const { data: walletExists } = useQuery({
        queryKey: ["wallet_exists"],
        queryFn: async () => invoke<boolean>("wallet_exists"),
    });

    return (
        <>
            <div className="grid grid-cols-4 gap-2 w-full">
                <button onClick={onRefreshClick} disabled={disabled}
                    className="vaughan-btn flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                    <span>Refresh</span>
                </button>
                <button onClick={onReceiveClick} disabled={disabled}
                    className="vaughan-btn flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                    <span>Receive</span>
                </button>
                <button onClick={onDappBrowserClick} disabled={disabled}
                    className="vaughan-btn flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                    <span>Dapps</span>
                </button>
                <button onClick={() => setModal('create')} disabled={disabled}
                    className="vaughan-btn flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                    <span>Create</span>
                </button>
                <button onClick={() => setModal('import')} disabled={disabled}
                    className="vaughan-btn flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                    <span>Import</span>
                </button>
                <button disabled={true}
                    className="vaughan-btn flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                    <span>Hardware</span>
                </button>
                <button onClick={onSettingsClick} disabled={disabled}
                    className="vaughan-btn flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                    <span>Settings</span>
                </button>
                <button onClick={onHistoryClick} disabled={disabled}
                    className="vaughan-btn flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                    <span>History</span>
                </button>
            </div>

            {modal === 'create' && <CreateWalletModal onClose={() => setModal(null)} />}
            {modal === 'import' && <ImportModalDialog onClose={() => setModal(null)} walletExists={!!walletExists} />}
        </>
    );
};

// Required for JSX in this file
import React from 'react';
