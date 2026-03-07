import { useState } from "react";

interface BalanceDisplayProps {
    balance: string;
    symbol: string;
    address?: string;
    isLoading: boolean;
    onCopyAddress: (address: string) => void;
    children?: React.ReactNode;
}

function ColoredAddress({ address }: { address: string }) {
    if (!address) return null;

    const addrStr = address.startsWith("0x") ? address.slice(2) : address;

    if (addrStr.length < 40) {
        return <span className="text-[18px] tracking-wide text-[#808080]">{address}</span>;
    }

    const firstPart = addrStr.slice(0, 5);
    const nonColoredPart = addrStr.slice(5, 18);
    const orangePart = addrStr.slice(18, 23);
    const greyPart = addrStr.slice(23, 35);
    const purplePart = addrStr.slice(35, 40);

    return (
        <span className="text-[18px] tracking-wide">
            <span className="text-[#808080]">0x</span>
            <span className="text-[#33cc33]">{firstPart}</span>
            <span className="text-[#808080]">{nonColoredPart}</span>
            <span className="text-[#ff9933]">{orangePart}</span>
            <span className="text-[#808080]">{greyPart}</span>
            <span className="text-[#b24cff]">{purplePart}</span>
        </span>
    );
}

export function BalanceDisplay({ balance, symbol, address, isLoading, onCopyAddress, children }: BalanceDisplayProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        if (address) {
            onCopyAddress(address);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="space-y-3">
            {address && (
                <div
                    className="flex items-center justify-center gap-2 cursor-pointer group relative"
                    onClick={handleCopy}
                    title="Copy address"
                >
                    <ColoredAddress address={address} />
                    {copied && (
                        <div className="absolute -top-8 bg-foreground/90 text-background text-xs px-2 py-1 rounded shadow-sm">
                            Copied!
                        </div>
                    )}
                </div>
            )}

            {children}

            <div className="bg-card border border-border p-6 text-center space-y-2">
                {isLoading ? (
                    <div className="h-10 w-32 mx-auto bg-input animate-pulse"></div>
                ) : (
                    <div className="text-4xl font-bold tracking-tight">
                        {balance}
                        <span className="text-xl text-muted-foreground ml-2">{symbol}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
