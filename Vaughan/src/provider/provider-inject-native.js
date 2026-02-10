/**
 * Native Tauri Provider for Vaughan Wallet
 * 
 * This script is injected via Tauri's initialization_script
 * It runs BEFORE the external page loads and has access to window.__TAURI__
 * 
 * The dApp only sees window.ethereum (standard EIP-1193 interface)
 * Internally, we use Tauri IPC to communicate with the Rust backend
 */

(function() {
  'use strict';

  console.log('[Vaughan Native] Initializing in WebView context');
  console.log('[Vaughan Native] Has __TAURI__:', typeof window.__TAURI__ !== 'undefined');

  // Verify Tauri is available
  if (typeof window.__TAURI__ === 'undefined') {
    console.error('[Vaughan Native] Tauri API not available!');
    return;
  }

  console.log('[Vaughan Native] Tauri APIs available:', {
    core: !!window.__TAURI__.core,
    event: !!window.__TAURI__.event,
    invoke: !!window.__TAURI__.core?.invoke
  });

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
          console.error('[Vaughan Native] Event listener error:', error);
        }
      });
      return true;
    }
  }

  // ============================================================================
  // Native Tauri Provider
  // ============================================================================

  class NativeTauriProvider extends EventEmitter {
    constructor() {
      super();
      
      // Provider metadata
      this.isVaughan = true;
      this.isMetaMask = true; // For compatibility
      
      // State
      this._chainId = null;
      this._accounts = [];
      this._isConnected = false;
      
      // Tauri event listeners
      this._listeners = new Map();
      
      // Initialize
      this._initialize();
    }

    /**
     * Initialize provider (get initial state)
     */
    async _initialize() {
      try {
        console.log('[Vaughan Native] Initializing provider...');
        
        // Get initial chain ID
        const chainId = await this._invokeBackend('eth_chainId', []);
        this._chainId = chainId;
        this._isConnected = true;
        
        console.log('[Vaughan Native] Provider initialized with chainId:', chainId);
        
        // Emit connect event
        this.emit('connect', { chainId });
        
        // Set up event listeners
        await this._setupEventListeners();
      } catch (error) {
        console.error('[Vaughan Native] Failed to initialize provider:', error);
        // Set fallback values
        this._chainId = '0x171'; // PulseChain default
        this._isConnected = false;
      }
    }

    /**
     * Set up Tauri event listeners
     */
    async _setupEventListeners() {
      try {
        const { event } = window.__TAURI__;
        
        // Listen for chain changes
        const unlistenChain = await event.listen('chainChanged', (event) => {
          console.log('[Vaughan Native] Chain changed:', event.payload);
          this._chainId = event.payload;
          this.emit('chainChanged', event.payload);
        });
        this._listeners.set('chainChanged', unlistenChain);
        
        // Listen for account changes
        const unlistenAccounts = await event.listen('accountsChanged', (event) => {
          console.log('[Vaughan Native] Accounts changed:', event.payload);
          this._accounts = event.payload;
          this.emit('accountsChanged', event.payload);
        });
        this._listeners.set('accountsChanged', unlistenAccounts);
        
        // Listen for disconnect
        const unlistenDisconnect = await event.listen('disconnect', (event) => {
          console.log('[Vaughan Native] Disconnected:', event.payload);
          this._isConnected = false;
          this._accounts = [];
          this.emit('disconnect', event.payload);
        });
        this._listeners.set('disconnect', unlistenDisconnect);
        
        console.log('[Vaughan Native] Event listeners set up successfully');
      } catch (error) {
        console.error('[Vaughan Native] Failed to set up event listeners:', error);
      }
    }

    /**
     * Invoke Tauri backend command
     */
    async _invokeBackend(method, params) {
      if (!window.__TAURI__?.core?.invoke) {
        throw new Error('Tauri invoke not available');
      }

      console.log(`[Vaughan Native] Invoking: ${method}`, params);

      try {
        // Use existing dapp_request command
        const response = await window.__TAURI__.core.invoke('dapp_request', {
          request: {
            id: this._generateRequestId(),
            timestamp: Math.floor(Date.now() / 1000),
            method,
            params: params || []
          }
        });

        console.log(`[Vaughan Native] Response for ${method}:`, response);

        // Check for error in response
        if (response.error) {
          throw new Error(response.error.message || 'Request failed');
        }

        return response.result;
      } catch (error) {
        console.error(`[Vaughan Native] Error for ${method}:`, error);
        throw error;
      }
    }

    /**
     * Generate unique request ID
     */
    _generateRequestId() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
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
      
      console.log('[Vaughan Native] Request:', method, params);

      // Handle special methods
      switch (method) {
        case 'eth_requestAccounts':
          return this._handleRequestAccounts();
        
        case 'eth_accounts':
          return this._accounts;
        
        case 'eth_chainId':
          return this._chainId;
        
        case 'net_version':
          // Convert hex chain ID to decimal string
          return this._chainId ? String(parseInt(this._chainId, 16)) : null;
        
        default:
          // Send to backend
          return this._invokeBackend(method, params);
      }
    }

    /**
     * Handle eth_requestAccounts (connection request)
     */
    async _handleRequestAccounts() {
      try {
        const accounts = await this._invokeBackend('eth_requestAccounts', []);
        this._accounts = accounts;
        
        // Emit accountsChanged event
        this.emit('accountsChanged', accounts);
        
        return accounts;
      } catch (error) {
        console.error('[Vaughan Native] Failed to request accounts:', error);
        throw error;
      }
    }

    /**
     * Legacy sendAsync method (for compatibility)
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
     * Legacy send method (for compatibility)
     */
    send(methodOrPayload, paramsOrCallback) {
      if (typeof methodOrPayload === 'string') {
        // send(method, params)
        return this.request({ method: methodOrPayload, params: paramsOrCallback });
      } else if (typeof paramsOrCallback === 'function') {
        // send(payload, callback)
        return this.sendAsync(methodOrPayload, paramsOrCallback);
      } else {
        // send(payload)
        return this.request(methodOrPayload);
      }
    }

    /**
     * Cleanup
     */
    destroy() {
      // Unlisten all Tauri events
      this._listeners.forEach((unlisten, event) => {
        unlisten();
      });
      this._listeners.clear();
    }
  }

  // ============================================================================
  // Inject Provider
  // ============================================================================

  // Create provider instance
  const provider = new NativeTauriProvider();
  console.log('[Vaughan Native] Provider instance created');

  // Make it read-only
  Object.defineProperty(window, 'ethereum', {
    value: provider,
    writable: false,
    configurable: false
  });
  
  console.log('[Vaughan Native] window.ethereum assigned');

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

  // Announce provider immediately
  announceProvider();

  // Listen for provider discovery requests
  window.addEventListener('eip6963:requestProvider', () => {
    announceProvider();
  });

  console.log('[Vaughan Native] Provider injected successfully');
  console.log('[Vaughan Native] EIP-6963 announcement sent');
})();
