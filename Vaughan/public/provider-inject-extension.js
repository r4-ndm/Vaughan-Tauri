/**
 * EIP-1193 Provider - Browser Extension Style (CSP Bypass)
 * 
 * This provider mimics how MetaMask works as a browser extension:
 * 1. Injected via initialization_script (runs BEFORE page loads, BEFORE CSP)
 * 2. Uses WebSocket to communicate with wallet backend
 * 3. Bypasses CSP restrictions because it's injected in privileged context
 * 
 * Architecture:
 * - Page JavaScript → window.ethereum → WebSocket → Rust Backend
 * 
 * This is the ONLY way to work with CSP-protected sites like Uniswap
 * without requiring the user to manually whitelist domains.
 */

(function() {
  'use strict';

  // Prevent re-injection
  if (window.ethereum) {
    console.warn('[Vaughan-Ext] Provider already injected');
    return;
  }

  console.log('[Vaughan-Ext] Initializing extension-style provider');

  // ============================================================================
  // WebSocket Communication Layer
  // ============================================================================

  class WebSocketCommunicator {
    constructor() {
      this.ws = null;
      this.pendingRequests = new Map();
      this.isConnected = false;
      this.reconnectAttempts = 0;
      this.maxReconnectAttempts = 5;
      this.reconnectDelay = 1000;
      
      this.connect();
    }

    connect() {
      try {
        console.log('[Vaughan-Ext] Connecting to secure WebSocket...');
        this.ws = new WebSocket('wss://localhost:8766');
        
        this.ws.onopen = () => {
          console.log('[Vaughan-Ext] Connected! ✅');
          this.isConnected = true;
          this.reconnectAttempts = 0;
        };
        
        this.ws.onmessage = (event) => {
          try {
            const response = JSON.parse(event.data);
            console.log('[Vaughan-Ext] Response:', response);
            
            const { id, result, error } = response;
            const pending = this.pendingRequests.get(id);
            
            if (pending) {
              this.pendingRequests.delete(id);
              
              if (error) {
                pending.reject(new Error(error.message || 'Request failed'));
              } else {
                pending.resolve(result);
              }
            }
          } catch (err) {
            console.error('[Vaughan-Ext] Failed to parse response:', err);
          }
        };
        
        this.ws.onerror = (error) => {
          console.error('[Vaughan-Ext] WebSocket error:', error);
        };
        
        this.ws.onclose = () => {
          console.log('[Vaughan-Ext] Disconnected');
          this.isConnected = false;
          
          // Reject all pending requests
          this.pendingRequests.forEach((pending) => {
            pending.reject(new Error('WebSocket disconnected'));
          });
          this.pendingRequests.clear();
          
          // Attempt reconnection
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`[Vaughan-Ext] Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            setTimeout(() => this.connect(), this.reconnectDelay * this.reconnectAttempts);
          } else {
            console.error('[Vaughan-Ext] Max reconnection attempts reached');
          }
        };
      } catch (error) {
        console.error('[Vaughan-Ext] Failed to create WebSocket:', error);
      }
    }

    async sendRequest(method, params = []) {
      if (!this.isConnected) {
        throw new Error('WebSocket not connected. Is Vaughan Wallet running?');
      }
      
      const id = this.generateId();
      const request = {
        id,
        jsonrpc: '2.0',
        method,
        params
      };
      
      console.log('[Vaughan-Ext] Request:', method, params);
      
      return new Promise((resolve, reject) => {
        this.pendingRequests.set(id, { resolve, reject });
        
        try {
          this.ws.send(JSON.stringify(request));
        } catch (error) {
          this.pendingRequests.delete(id);
          reject(error);
        }
        
        // Timeout after 30 seconds
        setTimeout(() => {
          if (this.pendingRequests.has(id)) {
            this.pendingRequests.delete(id);
            reject(new Error('Request timeout'));
          }
        }, 30000);
      });
    }

    generateId() {
      return Date.now();
    }
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
          console.error('[Vaughan-Ext] Event listener error:', error);
        }
      });
      return true;
    }
  }

  // ============================================================================
  // Ethereum Provider
  // ============================================================================

  class VaughanProvider extends EventEmitter {
    constructor(communicator) {
      super();
      
      this.communicator = communicator;
      
      // Provider metadata
      this.isVaughan = true;
      this.isMetaMask = true; // For compatibility
      
      // State
      this._chainId = null;
      this._accounts = [];
      this._isConnected = false;
      
      // Initialize
      this._initialize();
    }

    async _initialize() {
      try {
        console.log('[Vaughan-Ext] Initializing provider...');
        
        // Wait for WebSocket connection
        let attempts = 0;
        while (!this.communicator.isConnected && attempts < 10) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        
        if (!this.communicator.isConnected) {
          console.error('[Vaughan-Ext] Failed to connect to wallet');
          return;
        }
        
        // Get initial chain ID
        const chainId = await this.request({ method: 'eth_chainId' });
        this._chainId = chainId;
        this._isConnected = true;
        
        console.log('[Vaughan-Ext] Provider initialized with chainId:', chainId);
        
        // Emit connect event
        this.emit('connect', { chainId });
      } catch (error) {
        console.error('[Vaughan-Ext] Failed to initialize provider:', error);
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
      
      console.log('[Vaughan-Ext] Request:', method, params);

      // Handle special methods locally
      switch (method) {
        case 'eth_accounts':
          return this._accounts;
        
        case 'eth_chainId':
          if (this._chainId) {
            return this._chainId;
          }
          // Fall through to backend request
          break;
        
        case 'net_version':
          return this._chainId ? String(parseInt(this._chainId, 16)) : null;
        
        case 'eth_requestAccounts':
          // Request accounts and update local state
          const accounts = await this.communicator.sendRequest(method, params);
          this._accounts = accounts;
          this.emit('accountsChanged', accounts);
          return accounts;
      }
      
      // Send to backend via WebSocket
      return this.communicator.sendRequest(method, params);
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
  // Initialize
  // ============================================================================

  // Create communicator
  const communicator = new WebSocketCommunicator();
  
  // Create provider
  const provider = new VaughanProvider(communicator);
  
  // Inject into window (before page scripts run)
  Object.defineProperty(window, 'ethereum', {
    value: provider,
    writable: false,
    configurable: false
  });
  
  console.log('[Vaughan-Ext] Provider injected successfully ✅');

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

  console.log('[Vaughan-Ext] EIP-6963 announcement sent ✅');
})();
