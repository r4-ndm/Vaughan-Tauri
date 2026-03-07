import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Check } from "lucide-react";
import QRCode from "react-qr-code";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "../components/Layout";

interface Account {
    address: string;
    name: string;
    account_type: string;
}

export default function Receive() {
    const navigate = useNavigate();
    const [copied, setCopied] = useState(false);
    const [activeAccount, setActiveAccount] = useState<string | null>(null);

    const { data: accounts } = useQuery({
        queryKey: ["accounts"],
        queryFn: async () => invoke<Account[]>("get_accounts"),
    });

    useEffect(() => {
        if (accounts && accounts.length > 0 && !activeAccount) {
            setActiveAccount(accounts[0].address);
        }
    }, [accounts, activeAccount]);

    const handleCopy = () => {
        if (activeAccount) {
            navigator.clipboard.writeText(activeAccount);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <Layout showActions={false}>
            <div className="max-w-md mx-auto w-full space-y-8 text-center pt-8">
                <button
                    onClick={() => navigate("/dashboard")}
                    className="flex items-center text-muted-foreground hover:text-foreground transition-colors self-start"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Dashboard
                </button>

                <h1 className="text-2xl font-bold">Receive Assets</h1>

                {activeAccount ? (
                    <div className="bg-card p-8 rounded-xl border border-border flex flex-col items-center space-y-6 shadow-lg">
                        <div className="bg-white p-4 rounded-lg">
                            <QRCode value={activeAccount} size={200} />
                        </div>

                        <div className="w-full space-y-2">
                            <p className="text-sm text-muted-foreground">Your Address</p>
                            <div
                                className="bg-input p-3 rounded-lg font-mono text-xs break-all cursor-pointer hover:bg-accent transition-colors flex items-center justify-between group"
                                onClick={handleCopy}
                            >
                                <span>{activeAccount}</span>
                                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />}
                            </div>
                        </div>

                        <div className="text-sm text-yellow-500 bg-yellow-500/10 p-3 rounded border border-yellow-500/20">
                            Only send native tokens (ETH, PLS, etc.) and ERC-20 tokens to this address.
                        </div>
                    </div>
                ) : (
                    <div className="p-8">Loading address...</div>
                )}
            </div>
        </Layout>
    );
}
