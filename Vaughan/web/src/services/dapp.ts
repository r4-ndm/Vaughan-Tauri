/**
 * Dapp / approval service – uses typed commands from tauri.ts (tauri-specta bindings).
 */
import { DappService } from './tauri';
import type { ApprovalRequest, ApprovalResponseExport } from '../bindings/tauri-commands';

export type { ApprovalRequest, ApprovalResponseExport };

export async function getPendingApprovals(): Promise<ApprovalRequest[]> {
  return DappService.getPendingApprovals();
}

export async function respondToApproval(response: ApprovalResponseExport): Promise<void> {
  return DappService.respondToApproval(response);
}

export async function cancelApproval(id: string): Promise<void> {
  return DappService.cancelApproval(id);
}

export async function clearAllApprovals(): Promise<void> {
  return DappService.clearAllApprovals();
}
