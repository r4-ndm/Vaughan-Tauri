/**
 * useWalletConnect Hook
 * 
 * React hook for managing WalletConnect sessions
 */

import { useState, useEffect, useCallback } from 'react';
import { getWalletConnectService, WCSession } from '../services/walletconnect';

export interface UseWalletConnectOptions {
  /** Callback when session is approved */
  onSessionApproved?: (session: WCSession) => void;
  /** Callback when session is rejected */
  onSessionRejected?: (error: any) => void;
  /** Callback when session is deleted */
  onSessionDeleted?: (topic: string) => void;
  /** Callback for errors */
  onError?: (error: Error) => void;
}

export function useWalletConnect(options: UseWalletConnectOptions = {}) {
  const { onSessionApproved, onSessionRejected, onSessionDeleted, onError } = options;

  const [initialized, setInitialized] = useState(false);
  const [sessions, setSessions] = useState<WCSession[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wcService = getWalletConnectService();

  /**
   * Initialize WalletConnect
   */
  const initialize = useCallback(async () => {
    try {
      console.log('[useWalletConnect] Initializing...');
      await wcService.initialize();
      setInitialized(true);
      
      // Load active sessions
      const activeSessions = wcService.getActiveSessions();
      setSessions(activeSessions);
      
      console.log('[useWalletConnect] Initialized with', activeSessions.length, 'sessions');
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('[useWalletConnect] Initialization failed:', error);
      setError(error.message);
      onError?.(error);
    }
  }, [wcService, onError]);

  /**
   * Connect to dApp using URI
   */
  const connect = useCallback(async (uri: string) => {
    if (!initialized) {
      throw new Error('WalletConnect not initialized');
    }

    setConnecting(true);
    setError(null);

    try {
      console.log('[useWalletConnect] Connecting with URI...');
      await wcService.pair(uri);
      console.log('[useWalletConnect] Pairing initiated');
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('[useWalletConnect] Connection failed:', error);
      setError(error.message);
      onError?.(error);
      throw error;
    } finally {
      setConnecting(false);
    }
  }, [initialized, wcService, onError]);

  /**
   * Disconnect session
   */
  const disconnect = useCallback(async (topic: string) => {
    try {
      console.log('[useWalletConnect] Disconnecting session:', topic);
      await wcService.disconnectSession(topic);
      
      // Update sessions list
      const activeSessions = wcService.getActiveSessions();
      setSessions(activeSessions);
      
      console.log('[useWalletConnect] Session disconnected');
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('[useWalletConnect] Disconnect failed:', error);
      setError(error.message);
      onError?.(error);
      throw error;
    }
  }, [wcService, onError]);

  /**
   * Update account for all sessions
   */
  const updateAccount = useCallback(async (account: string) => {
    try {
      console.log('[useWalletConnect] Updating account:', account);
      await wcService.updateSessionAccount(account);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('[useWalletConnect] Update account failed:', error);
      onError?.(error);
    }
  }, [wcService, onError]);

  /**
   * Update chain for all sessions
   */
  const updateChain = useCallback(async (chainId: number) => {
    try {
      console.log('[useWalletConnect] Updating chain:', chainId);
      await wcService.updateSessionChain(chainId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('[useWalletConnect] Update chain failed:', error);
      onError?.(error);
    }
  }, [wcService, onError]);

  /**
   * Setup event listeners
   */
  useEffect(() => {
    const handleSessionApproved = (event: CustomEvent) => {
      console.log('[useWalletConnect] Session approved event:', event.detail);
      
      // Update sessions list
      const activeSessions = wcService.getActiveSessions();
      setSessions(activeSessions);
      
      setConnecting(false);
      onSessionApproved?.(event.detail);
    };

    const handleSessionRejected = (event: CustomEvent) => {
      console.log('[useWalletConnect] Session rejected event:', event.detail);
      setConnecting(false);
      setError('Session rejected');
      onSessionRejected?.(event.detail);
    };

    const handleSessionDeleted = (event: CustomEvent) => {
      console.log('[useWalletConnect] Session deleted event:', event.detail);
      
      // Update sessions list
      const activeSessions = wcService.getActiveSessions();
      setSessions(activeSessions);
      
      onSessionDeleted?.(event.detail.topic);
    };

    window.addEventListener('wc_session_approved', handleSessionApproved as EventListener);
    window.addEventListener('wc_session_rejected', handleSessionRejected as EventListener);
    window.addEventListener('wc_session_deleted', handleSessionDeleted as EventListener);

    return () => {
      window.removeEventListener('wc_session_approved', handleSessionApproved as EventListener);
      window.removeEventListener('wc_session_rejected', handleSessionRejected as EventListener);
      window.removeEventListener('wc_session_deleted', handleSessionDeleted as EventListener);
    };
  }, [wcService, onSessionApproved, onSessionRejected, onSessionDeleted]);

  /**
   * Initialize on mount
   */
  useEffect(() => {
    initialize();
  }, [initialize]);

  return {
    initialized,
    sessions,
    connecting,
    error,
    connect,
    disconnect,
    updateAccount,
    updateChain,
  };
}
