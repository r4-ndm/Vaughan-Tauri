import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface AddressDisplayProps {
    address?: string;
}

export function AddressDisplay({ address }: AddressDisplayProps) {
    const [copied, setCopied] = useState(false);

    if (!address) return null;

    const handleCopy = () => {
        navigator.clipboard.writeText(address);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const addrStr = address.startsWith("0x") ? address.slice(2) : address;
    let content;

    if (addrStr.length < 40) {
        content = <span className="text-[18px] tracking-wide text-[#808080]">{address}</span>;
    } else {
        const firstPart = addrStr.slice(0, 5);
        const nonColoredPart = addrStr.slice(5, 18);
        const orangePart = addrStr.slice(18, 23);
        const greyPart = addrStr.slice(23, 35);
        const purplePart = addrStr.slice(35, 40);

        content = (
            <span className="text-[18px] tracking-wide font-medium">
                <span className="text-[#808080]">0x</span>
                <span className="text-[#33cc33]">{firstPart}</span>
                <span className="text-[#808080]">{nonColoredPart}</span>
                <span className="text-[#ff9933]">{orangePart}</span>
                <span className="text-[#808080]">{greyPart}</span>
                <span className="text-[#b24cff]">{purplePart}</span>
            </span>
        );
    }

    return (
        <div
            className="flex items-center justify-center gap-2 cursor-pointer group relative py-1"
            onClick={handleCopy}
            title="Copy address"
        >
            {content}
            {copied ? (
                <Check className="w-4 h-4 text-green-500 transition-all opacity-100" />
            ) : (
                <Copy className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all" />
            )}
        </div>
    );
}
