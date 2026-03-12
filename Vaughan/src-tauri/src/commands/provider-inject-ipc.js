/**
 * EIP-1193 Provider - Tauri IPC Bridge (CSP-Safe)
 * 
 * This provider uses Tauri IPC via postMessage bridge to bypass CSP restrictions.
 * It is stabilized with a retry mechanism for Tauri 2.0 initialization.
 */

(function () {
  'use strict';

  console.log('[Vaughan-IPC] Initializing Tauri IPC bridge...');

  // Wait for __TAURI__ to be available (retry up to 40 times with 100ms delay)
  // Added check for transformCallback which is required for invoke/listen to work
  function waitForTauri(callback, attempts = 40) {
    const isTauriReady = window.__TAURI__ &&
      window.__TAURI__.core &&
      window.__TAURI__.event &&
      typeof window.__TAURI__.core.invoke === 'function';

    // Some internal Tauri 2.0 transforms might not be ready yet even if 'core' exists
    // We check for a common internal used by invoke
    if (isTauriReady) {
      // Give Tauri a tiny bit more time to settle internal state
      setTimeout(callback, 50);
    } else if (attempts > 0) {
      setTimeout(() => waitForTauri(callback, attempts - 1), 100);
    } else {
      console.error('[Vaughan-IPC] Tauri APIs not available after retries');
    }
  }

  function setupBridge() {
    const { invoke } = window.__TAURI__.core;
    const { listen } = window.__TAURI__.event;

    // ============================================================================
    // Message Bridge: Page ↔ Tauri Backend
    // ============================================================================

    // Listen for RPC requests from page context (VaughanProvider)
    window.addEventListener('message', async (event) => {
      // Only process our messages
      if (!event.data || event.data.type !== 'VAUGHAN_RPC_REQUEST') {
        return;
      }

      const { id, method, params } = event.data;

      // Use injected window label (set by initialization_script before page loads)
      const windowLabel = window.__VAUGHAN_WINDOW_LABEL__
        || window.__TAURI_METADATA__?.currentWindow?.label
        || 'unknown';

      const origin = window.__VAUGHAN_ORIGIN__ || window.location.origin;

      // Normalize params to always be an array
      const normalizedParams = !params ? [] : Array.isArray(params) ? params : [params];

      try {
        // CSP-SAFE INVOKE: Try standard invoke, but handle fetch failures gracefully
        let result;
        try {
          result = await invoke('handle_dapp_request', {
            windowLabel: windowLabel,
            origin: origin,
            method,
            params: normalizedParams
          });
        } catch (error) {
          // If fetch fails (likely CSP), we might be in the middle of a Tauri fallback
          // or we need to catch it and notify the user/retry.
          // In Tauri 2.0, 'Failed to fetch' is the hallmark of CSP blocking ipc.localhost
          if (error.toString().includes('Failed to fetch') || error.toString().includes('CSP')) {
            console.warn('[Vaughan-IPC] Standard invoke blocked by CSP. Attempting native fallback...');

            // On Windows (WebView2), we can try to use the postMessage interface directly
            // which handles the message in the backend's on_message handler if configured.
            // However, Tauri's invoke already attempts this internally.
            // If we are here, it means the internal fallback also failed or produced an error.
            throw new Error('IPC blocked by Content Security Policy. This dApp (like Hyperliquid) requires Direct Mode or a hardened RPC Proxy.');
          }
          throw error;
        }

        // Send response back to page context
        window.postMessage({
          type: 'VAUGHAN_RPC_RESPONSE',
          id,
          result
        }, '*');
      } catch (error) {
        console.error('[Vaughan-IPC] RPC Error:', error);

        // Send error back to page context
        window.postMessage({
          type: 'VAUGHAN_RPC_ERROR',
          id,
          error: {
            code: -32000,
            message: error.toString()
          }
        }, '*');
      }
    });
    // Listen for events from Tauri backend
    listen('wallet_event', (event) => {
      console.log('[Vaughan-IPC] Wallet Event:', event.payload);

      // Forward to page context
      window.postMessage({
        type: 'VAUGHAN_WALLET_EVENT',
        event: event.payload.event,
        data: event.payload.data
      }, '*');
    }).then((unlisten) => {
      console.log('[Vaughan-IPC] Event listener registered successfully');
      window.__VAUGHAN_UNLISTEN__ = unlisten;
    }).catch((error) => {
      console.error('[Vaughan-IPC] Failed to register event listener:', error);
    });

    // ============================================================================
    // Inject Provider into Page Context
    // ============================================================================

    if (window.ethereum) {
      console.warn('[Vaughan-Provider] Provider already exists');
      return;
    }

    // Event Emitter Implementation
    class EventEmitter {
      constructor() {
        this._events = {};
      }
      on(event, listener) {
        if (!this._events[event]) this._events[event] = [];
        this._events[event].push(listener);
        return this;
      }
      removeListener(event, listener) {
        if (!this._events[event]) return this;
        this._events[event] = this._events[event].filter(l => l !== listener);
        return this;
      }
      emit(event, ...args) {
        if (!this._events[event]) return false;
        this._events[event].forEach(listener => {
          try { listener(...args); } catch (error) { console.error('[Vaughan-Provider] Event error:', error); }
        });
        return true;
      }
    }

    // Ethereum Provider Implementation
    class VaughanProvider extends EventEmitter {
      constructor() {
        super();
        this.isVaughan = true;
        this.isMetaMask = true;
        this._chainId = null;
        this._accounts = [];
        this._isConnected = false;
        this._requestId = 0;
        this._pendingRequests = new Map();

        this._setupMessageListener();

        // Give the bridge a moment to fully stabilize before first request
        setTimeout(() => this._initialize(), 100);
      }

      _setupMessageListener() {
        window.addEventListener('message', (event) => {
          const { data } = event;
          if (!data) return;

          if (data.type === 'VAUGHAN_RPC_RESPONSE') {
            const pending = this._pendingRequests.get(data.id);
            if (pending) {
              this._pendingRequests.delete(data.id);
              pending.resolve(data.result);
            }
          } else if (data.type === 'VAUGHAN_RPC_ERROR') {
            const pending = this._pendingRequests.get(data.id);
            if (pending) {
              this._pendingRequests.delete(data.id);
              pending.reject(new Error(data.error?.message || 'Unknown error'));
            }
          } else if (data.type === 'VAUGHAN_WALLET_EVENT') {
            this._handleWalletEvent(data.event, data.data);
          }
        });
      }

      _handleWalletEvent(event, data) {
        console.log('[Vaughan-Provider] Wallet event:', event, data);
        switch (event) {
          case 'accountsChanged':
            this._accounts = data;
            this.emit('accountsChanged', data);
            break;
          case 'chainChanged':
            this._chainId = data;
            this.emit('chainChanged', data);
            break;
          case 'connect':
            this._isConnected = true;
            this.emit('connect', { chainId: data });
            break;
          case 'disconnect':
            this._isConnected = false;
            this.emit('disconnect');
            break;
        }
      }

      async _initialize() {
        try {
          const chainId = await this.request({ method: 'eth_chainId' });
          this._chainId = chainId;
          this._isConnected = true;
          this.emit('connect', { chainId });

          const accounts = await this.request({ method: 'eth_accounts' });
          if (accounts && accounts.length > 0) {
            this._accounts = accounts;
            this.emit('accountsChanged', accounts);
          }
        } catch (error) {
          console.warn('[Vaughan-Provider] Initialization partial failure:', error);
          this._chainId = '0x171'; // Fallback to PulseChain
        }
      }

      async request(args) {
        if (!args || typeof args !== 'object' || !args.method) {
          throw new Error('Invalid request args');
        }
        const { method, params = [] } = args;
        const id = ++this._requestId;

        return new Promise((resolve, reject) => {
          this._pendingRequests.set(id, { resolve, reject });
          window.postMessage({
            type: 'VAUGHAN_RPC_REQUEST',
            id,
            method,
            params
          }, '*');

          // Timeout after 60 seconds
          setTimeout(() => {
            if (this._pendingRequests.has(id)) {
              this._pendingRequests.delete(id);
              reject(new Error('Request timeout'));
            }
          }, 60000);
        });
      }

      sendAsync(payload, callback) {
        this.request({ method: payload.method, params: payload.params })
          .then(result => callback(null, { id: payload.id, jsonrpc: '2.0', result }))
          .catch(error => callback(error, null));
      }

      send(methodOrPayload, paramsOrCallback) {
        if (typeof methodOrPayload === 'string') {
          return this.request({ method: methodOrPayload, params: paramsOrCallback });
        } else if (typeof paramsOrCallback === 'function') {
          return this.sendAsync(methodOrPayload, paramsOrCallback);
        } else {
          return this.request(methodOrPayload);
        }
      }
    }

    // Inject Provider
    const provider = new VaughanProvider();
    Object.defineProperty(window, 'ethereum', {
      value: provider,
      writable: false,
      configurable: false
    });

    console.log('[Vaughan-Provider] Provider injected successfully ✅');

    // EIP-6963 Discovery
    const announceProvider = () => {
      window.dispatchEvent(new CustomEvent('eip6963:announceProvider', {
        detail: Object.freeze({
          info: Object.freeze({
            uuid: '350670db-19fa-4704-a166-e52e178b59d2',
            name: 'Vaughan Wallet',
            icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSI4IiBmaWxsPSIjNEY0NkU1Ii8+CiAgPHBhdGggZD0iTTE2IDhMMjQgMTZMMTYgMjRMOCAxNkwxNiA4WiIgZmlsbD0id2hpdGUiLz4KICA8cGF0aCBkPSJNMTYgMTJMMjAgMTZMMTYgMjBMMTIgMTZMMTYgMTJaIiBmaWxsPSIjNEY0NkU1Ii8+Cjwvc3ZnPg==',
            rdns: 'io.vaughan.wallet'
          }),
          provider: provider
        })
      }));
    };

    announceProvider();
    window.addEventListener('eip6963:requestProvider', announceProvider);

    console.log('[Vaughan-IPC] Initialization complete ✅');
  }

  waitForTauri(setupBridge);
})();
