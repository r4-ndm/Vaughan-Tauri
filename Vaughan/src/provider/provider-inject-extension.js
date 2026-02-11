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
      
      // Check if port was injected by backend
      console.log('[Vaughan-Ext] Checking for injected port...');
      console.log('[Vaughan-Ext] window.__VAUGHAN_WS_PORT__ =', window.__VAUGHAN_WS_PORT__);
      console.log('[Vaughan-Ext] window.__VAUGHAN_WINDOW_LABEL__ =', window.__VAUGHAN_WINDOW_LABEL__);
      console.log('[Vaughan-Ext] window.__VAUGHAN_ORIGIN__ =', window.__VAUGHAN_ORIGIN__);
      
      if (window.__VAUGHAN_WS_PORT__) {
        console.log('[Vaughan-Ext] ✅ Using injected WebSocket port:', window.__VAUGHAN_WS_PORT__);
        this.portRange = [window.__VAUGHAN_WS_PORT__, window.__VAUGHAN_WS_PORT__];
        this.currentPort = window.__VAUGHAN_WS_PORT__;
      } else {
        console.log('[Vaughan-Ext] ❌ No injected port found, trying port range 8766-8800');
        this.portRange = [8766, 8800]; // Fallback: try ports in this range
        this.currentPort = this.portRange[0];
      }
      
      this.connect();
    }

    async connect() {
      try {
        console.log(`[Vaughan-Ext] Connecting to secure WebSocket on port ${this.currentPort}...`);
        this.ws = new WebSocket(`wss://localhost:${this.currentPort}`);
        
        this.ws.onopen = () => {
          console.log(`[Vaughan-Ext] Connected to port ${this.currentPort}! ✅`);
          this.isConnected = true;
          this.reconnectAttempts = 0;
          
          // Emit ready event for dApps waiting for connection
          window.dispatchEvent(new CustomEvent('vaughan:ready'));
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
          
          // Check if this is a CSP violation (common on OpenSea)
          if (window.location.hostname.includes('opensea.io')) {
            console.error('[Vaughan-Ext] ⚠️ OpenSea blocks WebSocket connections due to CSP');
            console.error('[Vaughan-Ext] This is a known limitation - OpenSea requires a browser extension or WalletConnect');
            // Don't retry on OpenSea - it will never work
            return;
          }
          
          // If we have an injected port, retry with exponential backoff
          if (window.__VAUGHAN_WS_PORT__ && !this.isConnected) {
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
              this.reconnectAttempts++;
              const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 5000);
              console.log(`[Vaughan-Ext] Retrying connection in ${delay}ms (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
              setTimeout(() => this.connect(), delay);
            } else {
              console.error('[Vaughan-Ext] Max reconnection attempts reached');
            }
          }
          // Try next port if no injected port and connection failed
          else if (!this.isConnected && this.currentPort < this.portRange[1]) {
            this.currentPort++;
            console.log(`[Vaughan-Ext] Trying next port: ${this.currentPort}`);
            setTimeout(() => this.connect(), 100);
          }
        };
        
        this.ws.onclose = () => {
          console.log('[Vaughan-Ext] Disconnected');
          this.isConnected = false;
          
          // Reject all pending requests
          this.pendingRequests.forEach((pending) => {
            pending.reject(new Error('WebSocket disconnected'));
          });
          this.pendingRequests.clear();
          
          // Don't reconnect on OpenSea - CSP blocks it
          if (window.location.hostname.includes('opensea.io')) {
            console.error('[Vaughan-Ext] ⚠️ OpenSea CSP prevents WebSocket connections');
            return;
          }
          
          // Attempt reconnection with exponential backoff
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 5000);
            console.log(`[Vaughan-Ext] Reconnecting in ${delay}ms (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            setTimeout(() => this.connect(), delay);
          } else {
            console.error('[Vaughan-Ext] Max reconnection attempts reached');
          }
        };
      } catch (error) {
        console.error('[Vaughan-Ext] Failed to create WebSocket:', error);
        
        // Check for CSP error
        if (error.message && error.message.includes('Content Security Policy')) {
          console.error('[Vaughan-Ext] ⚠️ CSP blocks WebSocket connections on this site');
          console.error('[Vaughan-Ext] This site requires a browser extension or WalletConnect');
        }
      }
    }

    async sendRequest(method, params = []) {
      // If not connected, wait a bit for connection to establish
      if (!this.isConnected) {
        console.log('[Vaughan-Ext] Not connected yet, waiting for connection...');
        let attempts = 0;
        const maxAttempts = 30; // 3 seconds
        while (!this.isConnected && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        
        if (!this.isConnected) {
          throw new Error('WebSocket not connected. Is Vaughan Wallet running?');
        }
      }
      
      const id = this.generateId();
      const request = {
        id,
        jsonrpc: '2.0',
        method,
        params,
        // Include window metadata for session management
        _window_label: window.__VAUGHAN_WINDOW_LABEL__ || 'unknown',
        _origin: window.__VAUGHAN_ORIGIN__ || window.location.origin
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
      
      // OpenSea compatibility: Add _metamask object
      this._metamask = {
        isUnlocked: async () => true,
        requestBatch: async (requests) => {
          // Handle MetaMask batch API if OpenSea uses it
          return Promise.all(requests.map(req => this.request(req)));
        }
      };
      
      // Initialize
      this._initialize();
    }

    async _initialize() {
      try {
        console.log('[Vaughan-Ext] Initializing provider...');
        
        // Wait for WebSocket connection with longer timeout
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds total
        while (!this.communicator.isConnected && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        
        if (!this.communicator.isConnected) {
          console.warn('[Vaughan-Ext] Provider initialized without WebSocket connection (will retry on first request)');
          this._chainId = '0x171'; // PulseChain default
          this._isConnected = false;
          return;
        }
        
        console.log('[Vaughan-Ext] WebSocket connected, fetching chain ID...');
        
        // Get initial chain ID
        try {
          const chainId = await this.request({ method: 'eth_chainId' });
          this._chainId = chainId;
          this._isConnected = true;
          
          console.log('[Vaughan-Ext] Provider initialized with chainId:', chainId);
          
          // Emit connect event
          this.emit('connect', { chainId });
          
          // OpenSea compatibility: Emit connect event again after a delay
          // Some dApps check for events in specific order/timing
          setTimeout(() => {
            this.emit('connect', { chainId });
          }, 100);
          
          // Check for auto-approved session (wallet opened this dApp)
          console.log('[Vaughan-Ext] Checking for existing accounts (auto-connect)...');
          try {
            const accounts = await this.request({ method: 'eth_accounts' });
            if (accounts && accounts.length > 0) {
              console.log('[Vaughan-Ext] Auto-connect: Found existing accounts:', accounts);
              this._accounts = accounts;
              // Emit accountsChanged to notify dApp
              this.emit('accountsChanged', accounts);
            } else {
              console.log('[Vaughan-Ext] No existing accounts found (manual connection required)');
            }
          } catch (error) {
            console.warn('[Vaughan-Ext] Failed to check for existing accounts:', error);
          }
        } catch (error) {
          console.warn('[Vaughan-Ext] Failed to get chain ID, using default:', error);
          this._chainId = '0x171'; // PulseChain default
          this._isConnected = false;
        }
      } catch (error) {
        console.error('[Vaughan-Ext] Failed to initialize provider:', error);
        this._chainId = '0x171'; // PulseChain default
        this._isConnected = false;
      }
    }

    /**
     * Check if provider is connected (synchronous for OpenSea compatibility)
     */
    isConnected() {
      return this._isConnected;
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

  // Announce provider immediately
  announceProvider();
  
  // Listen for discovery requests
  window.addEventListener('eip6963:requestProvider', () => {
    announceProvider();
  });

  // AGGRESSIVE: Periodically announce provider for dynamically loaded wallet selectors
  // OpenSea and other sites load their wallet selector UI very late
  const announceInterval = setInterval(() => {
    announceProvider();
  }, 200); // Announce every 200ms (more aggressive)
  
  // Stop announcing after 30 seconds (some sites are VERY slow)
  setTimeout(() => {
    clearInterval(announceInterval);
    console.log('[Vaughan-Ext] Stopped periodic announcements after 30 seconds');
  }, 30000);

  console.log('[Vaughan-Ext] EIP-6963 announcement sent ✅');
})();
