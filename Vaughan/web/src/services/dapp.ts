import { invoke } from "@tauri-apps/api/core";

export interface ApprovalRequest {
    id: string;
    window_label: string;
    request_type: {
        type: string;
        [key: string]: any;
    };
    created_at: number;
}

export interface ApprovalResponse {
    id: string;
    approved: boolean;
    data?: any;
}

export async function getPendingApprovals(): Promise<ApprovalRequest[]> {
    return await invoke("get_pending_approvals");
}

export async function respondToApproval(response: ApprovalResponse): Promise<void> {
    await invoke("respond_to_approval", { response });
}

export async function cancelApproval(id: string): Promise<void> {
    await invoke("cancel_approval", { id });
}

export async function clearAllApprovals(): Promise<void> {
    await invoke("clear_all_approvals");
}
