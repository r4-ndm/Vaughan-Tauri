import { ReactNode } from "react";

interface HeaderProps {
    children?: ReactNode;
}

export function Header({ children }: HeaderProps) {
    return (
        <header className="p-4 border-b border-border bg-card">
            {/* VAUGHAN Logo PNG */}
            <div className="text-center mb-3">
                <img
                    src="/vaughan-logo.png"
                    alt="VAUGHAN"
                    className="w-full mx-auto select-none"
                    draggable={false}
                />
            </div>

            {/* Controls row */}
            <div className="flex justify-between items-center gap-4">
                {children}
            </div>
        </header>
    );
}
