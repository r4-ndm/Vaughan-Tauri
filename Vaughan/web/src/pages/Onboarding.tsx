import { useState } from "react";
import { CreateWalletModal, ImportModalDialog } from "../components/ActionButtons/ActionButtons";

export default function Onboarding() {
    const [modal, setModal] = useState<'create' | 'import' | null>(null);

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full text-center space-y-8">
                <div>
                    <h1 className="text-4xl font-bold text-primary mb-2">Welcome to Vaughan</h1>
                    <p className="text-muted-foreground">Secure, Fast, Private.</p>
                </div>

                <div className="bg-card p-6 rounded-lg shadow-lg border border-border space-y-4">
                    <button
                        onClick={() => setModal('create')}
                        className="w-full bg-primary text-primary-foreground py-3 px-4 rounded-lg font-medium hover:bg-primary/90 transition-colors"
                    >
                        Create New Wallet
                    </button>

                    <button
                        onClick={() => setModal('import')}
                        className="w-full bg-secondary text-secondary-foreground py-3 px-4 rounded-lg font-medium hover:bg-secondary/80 transition-colors"
                    >
                        Import Existing Wallet
                    </button>
                </div>
            </div>

            {modal === 'create' && <CreateWalletModal onClose={() => setModal(null)} />}
            {modal === 'import' && <ImportModalDialog onClose={() => setModal(null)} walletExists={false} />}
        </div>
    );
}
