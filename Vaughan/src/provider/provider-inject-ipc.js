/**
 * EIP-1193 Provider - Tauri IPC Bridge (CSP-Safe)
 * 
 * This provider uses Tauri IPC via postMessage bridge to bypass CSP restrictions.
 * 
 * Architecture:
 * 1. This script runs in privileged context (initialization_script, before CSP)
 * 2. Has full access to Tauri APIs (__TAURI__.invoke, __TAURI__.listen)
 * 3. Creates postMessage bridge between page and Tauri backend
 * 4. Injects window.ethereum that uses postMessage (CSP-safe)
 * 
 * Why This Works:
 * - initialization_script runs before CSP is applied
 * - postMessage is explicitly allowed by CSP
 * - Page never touches Tauri APIs directly
 * - Same pattern used by browser extensions (MetaMask, etc.)
 */

(async function() {
  'use strict';

  console.log('[Vaughan-IPC] Initializing Tauri IPC bridge...');

  // Check if Tauri APIs are available
  if (!window.__TAURI__) {
    console.error('[Vaughan-IPC] Tauri APIs not available');
    return;
  }

  const { invoke } = window.__TAURI__.core;
  const { listen } = window.__TAURI__.event;

  // ============================================================================
  // Message Bridge: Page ↔ Tauri Backend
  // ============================================================================

  // Listen for RPC requests from page context
  window.addEventListener('message', async (event) => {
    // Only process our messages
    if (!event.data || event.data.type !== 'VAUGHAN_RPC_REQUEST') {
      return;
    }

    const { id, method, params } = event.data;

    console.log('[Vaughan-IPC] RPC Request:', method, params);

    try {
      // Call Tauri backend
      const result = await invoke('handle_dapp_request', {
        windowLabel: window.__TAURI_METADATA__?.currentWindow?.label || 'unknown',
        origin: window.location.origin,
        method,
        params: params || []
      });

      // Send response back to page
      window.postMessage({
        type: 'VAUGHAN_RPC_RESPONSE',
        id,
        result
      }, '*');

      console.log('[Vaughan-IPC] RPC Response:', result);
    } catch (error) {
      console.error('[Vaughan-IPC] RPC Error:', error);

      // Send error back to page
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
  try {
    await listen('wallet_event', (event) => {
      console.log('[Vaughan-IPC] Wallet Event:', event.payload);

      // Forward to page context
      window.postMessage({
        type: 'VAUGHAN_WALLET_EVENT',
        event: event.payload.event,
        data: event.payload.data
      }, '*');
    });

    console.log('[Vaughan-IPC] Event listener registered');
  } catch (error) {
    console.error('[Vaughan-IPC] Failed to register event listener:', error);
  }

  // ============================================================================
  // Inject Provider into Page Context (Direct injection, no script tag)
  // ============================================================================

  // Since we're already in privileged context, we can directly define the provider
  // This bypasses CSP because initialization_script runs before CSP is applied

  console.log('[Vaughan-Provider] Initializing EIP-1193 provider...');

  // Prevent re-injection
  if (window.ethereum) {
    console.warn('[Vaughan-Provider] Provider already exists');
    return;
  }

  // ============================================================================
  // Event Emitter
  // ============================================================================

  class EventEmitter {
    constructor() {
      this._events = {};
    }

    on(event, listener) {
      if (!this._events[event]) {
        this._events[event] = [];
      }
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
        try {
          listener(...args);
        } catch (error) {
          console.error('[Vaughan-Provider] Event listener error:', error);
        }
      });
      return true;
    }
  }

  // ============================================================================
  // Ethereum Provider
  // ============================================================================

  class VaughanProvider extends EventEmitter {
    constructor() {
      super();

      // Provider metadata
      this.isVaughan = true;
      this.isMetaMask = true; // For compatibility

      // State
      this._chainId = null;
      this._accounts = [];
      this._isConnected = false;

      // Request tracking
      this._requestId = 0;
      this._pendingRequests = new Map();

      // Setup message listener
      this._setupMessageListener();

      // Initialize
      this._initialize();
    }

    _setupMessageListener() {
      window.addEventListener('message', (event) => {
        const { data } = event;

        // Handle RPC responses
        if (data.type === 'VAUGHAN_RPC_RESPONSE') {
          const pending = this._pendingRequests.get(data.id);
          if (pending) {
            this._pendingRequests.delete(data.id);
            pending.resolve(data.result);
          }
        }

        // Handle RPC errors
        if (data.type === 'VAUGHAN_RPC_ERROR') {
          const pending = this._pendingRequests.get(data.id);
          if (pending) {
            this._pendingRequests.delete(data.id);
            pending.reject(new Error(data.error.message));
          }
        }

        // Handle wallet events
        if (data.type === 'VAUGHAN_WALLET_EVENT') {
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
        console.log('[Vaughan-Provider] Initializing...');

        // Get initial chain ID
        const chainId = await this.request({ method: 'eth_chainId' });
        this._chainId = chainId;
        this._isConnected = true;

        console.log('[Vaughan-Provider] Initialized with chainId:', chainId);

        // Emit connect event
        this.emit('connect', { chainId });

        // Check for existing accounts (auto-connect)
        try {
          const accounts = await this.request({ method: 'eth_accounts' });
          if (accounts && accounts.length > 0) {
            this._accounts = accounts;
            console.log('[Vaughan-Provider] Auto-connected with accounts:', accounts);
          }
        } catch (error) {
          console.log('[Vaughan-Provider] No existing accounts');
        }
      } catch (error) {
        console.error('[Vaughan-Provider] Initialization failed:', error);
        this._chainId = '0x171'; // PulseChain default
        this._isConnected = false;
      }
    }

    /**
     * EIP-1193 request method
     */
    async request(args) {
      if (!args || typeof args !== 'object') {
        throw new Error('Request must be an object');
      }
      if (!args.method) {
        throw new Error('Request must have a method');
      }

      const { method, params = [] } = args;

      console.log('[Vaughan-Provider] Request:', method, params);

      // Generate request ID
      const id = ++this._requestId;

      // Send request via postMessage
      return new Promise((resolve, reject) => {
        // Store pending request
        this._pendingRequests.set(id, { resolve, reject });

        // Send to bridge
        window.postMessage({
          type: 'VAUGHAN_RPC_REQUEST',
          id,
          method,
          params
        }, '*');

        // Timeout after 30 seconds
        setTimeout(() => {
          if (this._pendingRequests.has(id)) {
            this._pendingRequests.delete(id);
            reject(new Error('Request timeout'));
          }
        }, 30000);
      });
    }

    /**
     * Legacy sendAsync method
     */
    sendAsync(payload, callback) {
      this.request({
        method: payload.method,
        params: payload.params
      })
        .then(result => callback(null, { id: payload.id, jsonrpc: '2.0', result }))
        .catch(error => callback(error, null));
    }

    /**
     * Legacy send method
     */
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

  // ============================================================================
  // Initialize Provider
  // ============================================================================

  const provider = new VaughanProvider();

  // Inject into window
  Object.defineProperty(window, 'ethereum', {
    value: provider,
    writable: false,
    configurable: false
  });

  console.log('[Vaughan-Provider] Provider injected successfully ✅');

  // ============================================================================
  // EIP-6963: Multi Injected Provider Discovery
  // ============================================================================

  const providerInfo = Object.freeze({
    uuid: '350670db-19fa-4704-a166-e52e178b59d2',
    name: 'Vaughan Wallet',
    icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSI4IiBmaWxsPSIjNEY0NkU1Ii8+CiAgPHBhdGggZD0iTTE2IDhMMjQgMTZMMTYgMjRMOCAxNkwxNiA4WiIgZmlsbD0id2hpdGUiLz4KICA8cGF0aCBkPSJNMTYgMTJMMjAgMTZMMTYgMjBMMTIgMTZMMTYgMTJaIiBmaWxsPSIjNEY0NkU1Ii8+Cjwvc3ZnPg==',
    rdns: 'io.vaughan.wallet'
  });

  const providerDetail = Object.freeze({
    info: providerInfo,
    provider: provider
  });

  function announceProvider() {
    window.dispatchEvent(
      new CustomEvent('eip6963:announceProvider', {
        detail: providerDetail
      })
    );
  }

  // Announce provider
  announceProvider();

  // Listen for discovery requests
  window.addEventListener('eip6963:requestProvider', () => {
    announceProvider();
  });

  console.log('[Vaughan-Provider] EIP-6963 announcement sent ✅');
  console.log('[Vaughan-IPC] Provider initialization complete ✅');
})();
