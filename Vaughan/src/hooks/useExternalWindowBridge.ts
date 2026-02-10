/**
 * useExternalWindowBridge Hook
 * 
 * Listens for provider requests from external windows (opened via open_dapp_window)
 * and forwards them to the Tauri backend.
 * 
 * This bridges the gap when Tauri events aren't available on external URLs.
 * 
 * **How it works**:
 * 1. External window sends custom event 'vaughan-provider-request' with window info
 * 2. This hook receives it in main window
 * 3. Forwards to Tauri backend via dapp_request
 * 4. Sends response back via 'vaughan-provider-response' custom event
 * 5. External window receives response and resolves promise
 */

import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface WindowInfo {
  label: string;
  origin: string;
}

export function useExternalWindowBridge() {
  // Track active windows (label -> origin mapping)
  const windowsRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    console.log('[ExternalWindowBridge] Setting up event listeners');

    /**
     * Handle window registration from external windows
     * External windows send this on load to register themselves
     */
    const handleWindowRegister = (event: CustomEvent) => {
      const { label, origin } = event.detail as WindowInfo;
      console.log('[ExternalWindowBridge] Window registered:', label, origin);
      windowsRef.current.set(label, origin);
    };

    /**
     * Handle provider requests from external windows via postMessage
     */
    const handlePostMessage = async (event: MessageEvent) => {
      // Only accept messages with our type
      if (!event.data || event.data.type !== 'vaughan-provider-request') {
        return;
      }

      const request = event.data.data;
      
      console.log('[ExternalWindowBridge] Received request via postMessage:', request);

      // Extract window info from request
      const windowLabel = request.windowLabel || 'unknown';
      const origin = request.origin || windowsRef.current.get(windowLabel) || 'https://external';

      console.log('[ExternalWindowBridge] Window:', windowLabel, 'Origin:', origin);

      try {
        // Call Tauri backend with the request
        const response = await invoke('dapp_request', {
          windowLabel,
          origin,
          request: {
            id: request.id,
            method: request.method,
            params: request.params || [],
            timestamp: Math.floor(Date.now() / 1000),
          },
        });

        console.log('[ExternalWindowBridge] Backend response:', response);

        // Send response back to external window via postMessage
        if (event.source && event.source !== window) {
          (event.source as Window).postMessage({
            type: 'vaughan-provider-response',
            data: {
              id: request.id,
              result: (response as any).result,
              error: (response as any).error,
            }
          }, '*');
          console.log('[ExternalWindowBridge] Response sent via postMessage');
        }
      } catch (error) {
        console.error('[ExternalWindowBridge] Error handling request:', error);

        // Send error response
        if (event.source && event.source !== window) {
          (event.source as Window).postMessage({
            type: 'vaughan-provider-response',
            data: {
              id: request.id,
              result: null,
              error: {
                code: -32603,
                message: error instanceof Error ? error.message : 'Internal error',
              },
            }
          }, '*');
        }
      }
    };

    /**
     * Handle provider requests from external windows (legacy custom events)
     */
    const handleProviderRequest = async (event: CustomEvent) => {
      const request = event.detail;
      
      console.log('[ExternalWindowBridge] Received request via custom event:', request);

      // Extract window info from request (if provided)
      const windowLabel = request.windowLabel || 'unknown';
      const origin = request.origin || windowsRef.current.get(windowLabel) || 'https://external';

      console.log('[ExternalWindowBridge] Window:', windowLabel, 'Origin:', origin);

      try {
        // Call Tauri backend with the request
        const response = await invoke('dapp_request', {
          windowLabel,
          origin,
          request: {
            id: request.id,
            method: request.method,
            params: request.params || [],
            timestamp: Math.floor(Date.now() / 1000),
          },
        });

        console.log('[ExternalWindowBridge] Backend response:', response);

        // Send response back to external window
        window.dispatchEvent(new CustomEvent('vaughan-provider-response', {
          detail: {
            id: request.id,
            result: (response as any).result,
            error: (response as any).error,
          },
        }));

        console.log('[ExternalWindowBridge] Response sent');
      } catch (error) {
        console.error('[ExternalWindowBridge] Error handling request:', error);

        // Send error response
        window.dispatchEvent(new CustomEvent('vaughan-provider-response', {
          detail: {
            id: request.id,
            result: null,
            error: {
              code: -32603,
              message: error instanceof Error ? error.message : 'Internal error',
            },
          },
        }));
      }
    };

    // Listen for postMessage (primary method for cross-window communication)
    window.addEventListener('message', handlePostMessage);

    // Listen for window registration
    window.addEventListener('vaughan-window-register', handleWindowRegister as EventListener);

    // Listen for provider requests (legacy)
    window.addEventListener('vaughan-provider-request', handleProviderRequest as unknown as EventListener);

    console.log('[ExternalWindowBridge] Event listeners active');

    // Cleanup
    return () => {
      window.removeEventListener('message', handlePostMessage);
      window.removeEventListener('vaughan-window-register', handleWindowRegister as EventListener);
      window.removeEventListener('vaughan-provider-request', handleProviderRequest as unknown as EventListener);
      windowsRef.current.clear();
      console.log('[ExternalWindowBridge] Event listeners removed');
    };
  }, []);
}
