/**
 * useProviderBridge Hook
 * 
 * Manages postMessage communication between iframe and Tauri backend
 * Implements EIP-1193 provider bridge with security validation
 */

import { useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { ProviderRequest, ProviderResponse, ProviderMessage } from '../provider/types';

interface UseProviderBridgeOptions {
  /** Expected origin of the dApp iframe */
  origin: string;
  /** Callback when connection is established */
  onConnect?: (origin: string) => void;
  /** Callback when connection is closed */
  onDisconnect?: (origin: string) => void;
  /** Callback for errors */
  onError?: (error: Error) => void;
}

export function useProviderBridge(options: UseProviderBridgeOptions) {
  const { origin, onConnect, onDisconnect, onError } = options;
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  /**
   * Handle incoming postMessage from iframe
   */
  const handleMessage = useCallback(async (event: MessageEvent) => {
    console.log('[ProviderBridge] Received message:', event.origin, event.data);
    
    // Security: Validate origin
    if (event.origin !== origin) {
      console.warn('[ProviderBridge] Invalid origin:', event.origin, 'expected:', origin);
      return;
    }

    const message = event.data as ProviderMessage;

    // Handle provider requests
    if (message.type === 'PROVIDER_REQUEST') {
      const request = message.data as ProviderRequest;
      console.log('[ProviderBridge] Processing request:', request.method, request);
      
      try {
        // Call Tauri backend with proper DappRequest structure
        console.log('[ProviderBridge] Calling Tauri backend...');
        const response = await invoke<any>('dapp_request', {
          origin: event.origin, // Pass origin for iframe-based dApps
          request: {
            id: request.id,
            method: request.method,
            params: request.params || [],
            timestamp: Math.floor(Date.now() / 1000), // Unix timestamp in seconds
          },
        });

        console.log('[ProviderBridge] Tauri response:', request.method, response);

        // Check if response has an error
        if (response.error) {
          throw new Error(response.error.message);
        }

        // Extract result from DappResponse
        const result = response.result;

        // Send response back to iframe
        const providerResponse: ProviderResponse = {
          id: request.id,
          result,
        };

        console.log('[ProviderBridge] Sending response to iframe:', providerResponse);
        iframeRef.current?.contentWindow?.postMessage(
          {
            type: 'PROVIDER_RESPONSE',
            data: providerResponse,
          } as ProviderMessage,
          origin
        );
      } catch (error) {
        console.error('[ProviderBridge] Error:', request.method, error);
        
        // Send error response
        const providerResponse: ProviderResponse = {
          id: request.id,
          result: null,
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : 'Internal error',
          },
        };

        console.log('[ProviderBridge] Sending error response to iframe:', providerResponse);
        iframeRef.current?.contentWindow?.postMessage(
          {
            type: 'PROVIDER_RESPONSE',
            data: providerResponse,
          } as ProviderMessage,
          origin
        );

        onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    } else {
      console.log('[ProviderBridge] Unknown message type:', message.type);
    }
  }, [origin, onError]);

  /**
   * Connect to dApp
   */
  const connect = useCallback(async () => {
    try {
      await invoke('connect_dapp', { origin });
      onConnect?.(origin);
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }, [origin, onConnect, onError]);

  /**
   * Disconnect from dApp
   */
  const disconnect = useCallback(async () => {
    try {
      await invoke('disconnect_dapp', { origin });
      onDisconnect?.(origin);
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }, [origin, onDisconnect, onError]);

  /**
   * Setup message listener
   */
  useEffect(() => {
    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [handleMessage]);

  /**
   * Inject provider script when iframe loads
   */
  const handleIframeLoad = useCallback(() => {
    if (!iframeRef.current?.contentWindow) return;

    // Inject provider script
    const script = iframeRef.current.contentDocument?.createElement('script');
    if (script) {
      script.src = '/provider-inject.js';
      script.async = true;
      iframeRef.current.contentDocument?.head.appendChild(script);
    }
  }, []);

  return {
    iframeRef,
    connect,
    disconnect,
    handleIframeLoad,
  };
}
