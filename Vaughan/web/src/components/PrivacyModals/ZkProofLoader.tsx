import { ShieldCheck, AlertTriangle } from "lucide-react";

export function ZkProofLoader({
    isOpen,
    progress
}: {
    isOpen: boolean;
    progress: number
}) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/90 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-card w-full max-w-md p-6 rounded-lg shadow-2xl border border-primary/50 relative overflow-hidden flex flex-col items-center text-center space-y-4">

                {/* 
                    This creates an immersive, somewhat mystical pulse
                    effect in the background of the modal. 
                */}
                <div className="absolute inset-0 bg-primary/10 animate-pulse pointer-events-none" />

                <div className="relative -mt-2">
                    <ShieldCheck className="w-12 h-12 text-primary animate-bounce shadow-primary drop-shadow-lg" />
                    <div className="absolute inset-0 border-2 border-primary rounded-full animate-ping opacity-20" />
                </div>

                <div>
                    <h2 className="text-xl font-bold tracking-tight">Forging Privacy Proofs</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Your hardware is heavily generating Groth16 zk-SNARKs. This may take a few seconds. Do not close the application.
                    </p>
                </div>

                {/* Progress Bar Container */}
                <div className="w-full bg-secondary/50 rounded-full h-3 mt-6 border border-border/50 overflow-hidden relative">
                    {/* The actual fill */}
                    <div
                        className="bg-primary h-full transition-all duration-300 ease-out absolute left-0 top-0"
                        style={{ width: `${progress}%` }}
                    />
                    {/* A shimmering overlay to make it look active */}
                    <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_2s_infinite]" />
                </div>

                {/* Progress Text */}
                <div className="w-full flex justify-between text-xs font-mono font-medium mt-1 mb-2">
                    <span className="text-primary">{progress.toFixed(0)}% Complete</span>
                </div>

                {/* Optional Warning block */}
                <div className="bg-amber-500/10 border border-amber-500/20 rounded p-3 text-left w-full flex items-start mt-4">
                    <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 mr-2 shrink-0" />
                    <p className="text-xs text-amber-500/90 leading-relaxed">
                        Generating zero-knowledge proofs locally guarantees your keys never leave this device, ensuring maximum OPSEC.
                    </p>
                </div>
            </div>
        </div>
    );
}
