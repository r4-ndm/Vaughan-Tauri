/**
 * useApprovalPolling Hook
 * 
 * Polls for pending approval requests from the backend
 * Shows approval modals when requests are detected
 */

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface ApprovalRequest {
  id: string;
  request_type: ApprovalRequestType;
  timestamp: number;
}

export type ApprovalRequestType =
  | { type: 'connection'; origin: string }
  | {
      type: 'transaction';
      origin: string;
      from: string;
      to: string;
      value: string;
      gasLimit?: number;
      gasPrice?: string;
      data?: string;
    }
  | {
      type: 'personalSign';
      origin: string;
      address: string;
      message: string;
    }
  | {
      type: 'signTypedData';
      origin: string;
      address: string;
      typedData: string;
    }
  | {
      type: 'watchAsset';
      origin: string;
      asset_type: string;
      address: string;
      symbol: string;
      decimals: number;
      image?: string;
    }
  | {
      type: 'switchNetwork';
      origin: string;
      chainId: number;
    }
  | {
      type: 'addNetwork';
      origin: string;
      chainId: number;
      chainName: string;
      rpcUrl: string;
      blockExplorerUrl?: string;
    };

export interface ApprovalResponse {
  id: string;
  approved: boolean;
  data?: Record<string, any>;
}

interface UseApprovalPollingOptions {
  /** Polling interval in milliseconds (default: 1000) */
  interval?: number;
  /** Enable/disable polling */
  enabled?: boolean;
  /** Callback when approval is detected */
  onApprovalDetected?: (approval: ApprovalRequest) => void;
  /** Callback for errors */
  onError?: (error: Error) => void;
}

export function useApprovalPolling(options: UseApprovalPollingOptions = {}) {
  const {
    interval = 1000,
    enabled = true,
    onApprovalDetected,
    onError,
  } = options;

  const [currentApproval, setCurrentApproval] = useState<ApprovalRequest | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  /**
   * Poll for pending approvals
   */
  const pollApprovals = useCallback(async () => {
    if (!enabled || isPolling) return;

    setIsPolling(true);

    try {
      const approvals = await invoke<ApprovalRequest[]>('get_pending_approvals');

      if (approvals.length > 0 && !currentApproval) {
        const approval = approvals[0];
        console.log('[ApprovalPolling] New approval detected:', approval);
        setCurrentApproval(approval);
        onApprovalDetected?.(approval);
      } else if (approvals.length === 0 && currentApproval) {
        console.log('[ApprovalPolling] Approval cleared');
        setCurrentApproval(null);
      }
    } catch (error) {
      console.error('[ApprovalPolling] Error fetching approvals:', error);
      onError?.(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsPolling(false);
    }
  }, [enabled, isPolling, currentApproval, onApprovalDetected, onError]);

  /**
   * Respond to approval request
   */
  const respondToApproval = useCallback(
    async (response: ApprovalResponse) => {
      try {
        await invoke('respond_to_approval', { response });
        setCurrentApproval(null);
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error(String(error)));
        throw error;
      }
    },
    [onError]
  );

  /**
   * Cancel approval request
   */
  const cancelApproval = useCallback(
    async (id: string) => {
      try {
        await invoke('cancel_approval', { id });
        setCurrentApproval(null);
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error(String(error)));
        throw error;
      }
    },
    [onError]
  );

  /**
   * Setup polling interval
   */
  useEffect(() => {
    if (!enabled) return;

    const intervalId = setInterval(pollApprovals, interval);

    // Poll immediately on mount
    pollApprovals();

    return () => {
      clearInterval(intervalId);
    };
  }, [enabled, interval, pollApprovals]);

  return {
    currentApproval,
    respondToApproval,
    cancelApproval,
    isPolling,
  };
}
