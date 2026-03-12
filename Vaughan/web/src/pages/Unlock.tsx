import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, EyeOff } from "lucide-react";
import { PreferencesService, UserPreferences, WalletService } from "../services/tauri";

export default function Unlock() {
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    // Privacy state
    const [prefs, setPrefs] = useState<UserPreferences | null>(null);
    const [privacyEnabled, setPrivacyEnabled] = useState(true);

    const navigate = useNavigate();

    // Fetch preferences on load to see what to default the toggle to
    useEffect(() => {
        PreferencesService.getUserPreferences()
            .then(p => {
                setPrefs(p);
                setPrivacyEnabled(p.privacy_enabled);
            })
            .catch(e => console.error("Failed to fetch preferences during unlock:", e));
    }, []);

    const handleUnlock = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            // Save preference if it was changed before unlocking
            if (prefs && prefs.privacy_enabled !== privacyEnabled) {
                await PreferencesService.updateUserPreferences({
                    ...prefs,
                    privacy_enabled: privacyEnabled
                });
            }

            await WalletService.unlockWallet(password);

            // Initialize railgun wallet right after a successful unlock if privacy is enabled
            if (privacyEnabled) {
                console.log("[Unlock] Loading Railgun wallet...");
                import('../services/railgunWorkerClient').then(({ railgunClient }) => {
                    railgunClient.loadWallet(password).catch(e => {
                        console.error("[Unlock] Failed to load Railgun wallet:", e);
                    });
                });
            }

            navigate("/dashboard");
        } catch (err: any) {
            const msg =
                err instanceof Error
                    ? err.message
                    : typeof err === 'string'
                    ? err
                    : JSON.stringify(err);
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4">
            <div className="bg-card p-8 rounded-lg shadow-lg border border-border max-w-md w-full">
                <h1 className="text-2xl font-bold mb-6 text-center text-primary">Unlock Vaughan</h1>

                <form onSubmit={handleUnlock} className="space-y-4">
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium mb-1">
                            Password
                        </label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-input border border-input rounded p-2 focus:ring-2 focus:ring-primary focus:outline-none mb-6"
                            placeholder="Enter your password"
                        />
                    </div>

                    {/* Mode Selector */}
                    <div className="space-y-3 mb-6">
                        <label className="block text-sm font-medium">Select Start Mode</label>
                        <div className="grid grid-cols-2 gap-3">
                            {/* Privacy Mode */}
                            <button
                                type="button"
                                onClick={() => setPrivacyEnabled(true)}
                                className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${privacyEnabled
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-border bg-card text-muted-foreground hover:border-primary/50'
                                    }`}
                            >
                                <EyeOff className="w-6 h-6 mb-2" />
                                <span className="text-sm font-semibold">Privacy Mode</span>
                                <span className="text-xs text-center mt-1 opacity-80">(Full Railgun SDK)</span>
                            </button>

                            {/* Fast Mode */}
                            <button
                                type="button"
                                onClick={() => setPrivacyEnabled(false)}
                                className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${!privacyEnabled
                                    ? 'border-amber-500 bg-amber-500/10 text-amber-500'
                                    : 'border-border bg-card text-muted-foreground hover:border-amber-500/50'
                                    }`}
                            >
                                <Zap className="w-6 h-6 mb-2" />
                                <span className="text-sm font-semibold">Fast Mode</span>
                                <span className="text-xs text-center mt-1 opacity-80">(Lightweight, NO Privacy)</span>
                            </button>
                        </div>
                    </div>

                    {error && <p className="text-destructive text-sm text-center font-medium">{error}</p>}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-primary text-primary-foreground py-2 px-4 rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                        {loading ? "Unlocking..." : "Unlock Wallet"}
                    </button>
                </form>
            </div>
        </div>
    );
}
