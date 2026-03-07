import { ReactNode } from "react";
import { ActionButtons } from "./ActionButtons/ActionButtons";
import { ApprovalModal } from "./ApprovalModal";
import { WatchAssetModal } from "./WatchAssetModal";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";


interface LayoutProps {
    children: ReactNode;
    showActions?: boolean;
}

export function Layout({ children, showActions = true }: LayoutProps) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ["balance"] });
        queryClient.invalidateQueries({ queryKey: ["tracked_tokens"] });
        queryClient.invalidateQueries({ queryKey: ["token_balance"] });
    };

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col p-4 max-w-2xl mx-auto w-full">
            {/* Logo */}
            <div className="mb-4">
                <img
                    src="/vaughan-logo.png"
                    alt="VAUGHAN"
                    className="w-full select-none"
                    draggable={false}
                />
            </div>

            {/* Main content */}
            <div className="flex-1 space-y-4">
                {children}
            </div>

            {showActions && (
                <div className="pt-4">
                    <ActionButtons
                        onReceiveClick={() => navigate("/receive")}
                        onDappBrowserClick={() => navigate("/dapps")}
                        onRefreshClick={handleRefresh}
                        onHistoryClick={() => navigate("/history")}
                        onSettingsClick={() => navigate("/settings")}
                    />
                </div>
            )}

            <ApprovalModal />
            <WatchAssetModal />
        </div>
    );
}
