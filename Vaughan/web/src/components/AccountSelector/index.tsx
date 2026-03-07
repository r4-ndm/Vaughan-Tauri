import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { AccountOptionsModal } from './AccountOptionsModal';

interface Account {
    name: string;
    address: string;
    account_type: string;
    index?: number;
}

interface AccountSelectorProps {
    currentAccount?: Account;
    accounts?: Account[];
    onSelectAccount?: (address: string) => void;
}

export const AccountSelector: React.FC<AccountSelectorProps> = ({ currentAccount, accounts = [], onSelectAccount }) => {
    const [isOpen, setIsOpen] = useState(false);

    // Modal States
    const [optionsModalOpen, setOptionsModalOpen] = useState(false);
    const [optionsTarget, setOptionsTarget] = useState<{ address: string, name: string, type: string, index?: number } | null>(null);

    const handleOptionsClick = (address: string, currentName: string, accountType: string, index?: number) => {
        setOptionsTarget({ address, name: currentName, type: accountType, index });
        setOptionsModalOpen(true);
        setIsOpen(false);
    };



    const displayAccount = currentAccount || { name: 'Loading...', address: '', account_type: '' };

    return (
        <div className="relative inline-block text-left w-full">
            <button
                onClick={() => setIsOpen(!isOpen)}
                onContextMenu={(e) => {
                    e.preventDefault();
                    if (displayAccount.address) {
                        handleOptionsClick(displayAccount.address, displayAccount.name, displayAccount.account_type, displayAccount.index);
                    }
                }}
                className="w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-card border border-border text-sm font-medium hover:bg-secondary transition-colors rounded-t-lg"
            >
                <span>{displayAccount.name}</span>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute left-0 right-0 mt-1 origin-top bg-card border border-border shadow-lg z-[60] rounded-b-lg">
                    {accounts.map((acc) => (
                        <div
                            key={acc.address}
                            onClick={() => {
                                if (onSelectAccount) {
                                    onSelectAccount(acc.address);
                                    setIsOpen(false);
                                }
                            }}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                handleOptionsClick(acc.address, acc.name, acc.account_type, acc.index);
                            }}
                            className={`w-full px-4 py-2.5 flex justify-between items-center text-sm border-b border-border/50 last:border-0 hover:bg-secondary transition-colors text-left cursor-pointer ${acc.address === currentAccount?.address ? "bg-secondary/50" : ""}`}
                        >
                            <span>{acc.name}</span>
                            {acc.address && (
                                <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleOptionsClick(acc.address, acc.name, acc.account_type, acc.index);
                                        }}
                                        className="px-2 py-1 rounded-md hover:text-foreground text-muted-foreground transition-colors"
                                        title="Options"
                                    >
                                        ...
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Options Modal */}
            {optionsTarget && (
                <AccountOptionsModal
                    isOpen={optionsModalOpen}
                    onClose={() => {
                        setOptionsModalOpen(false);
                        setOptionsTarget(null);
                    }}
                    currentAddress={optionsTarget.address}
                    currentName={optionsTarget.name}
                    accountType={optionsTarget.type}
                    accountIndex={optionsTarget.index}
                    canDelete={accounts.length > 1}
                    onDeleteSuccess={() => {
                        if (currentAccount?.address === optionsTarget.address && onSelectAccount) {
                            const remaining = accounts.filter(a => a.address !== optionsTarget.address);
                            if (remaining.length > 0) {
                                onSelectAccount(remaining[0].address);
                            }
                        }
                    }}
                />
            )}
        </div>
    );
};
