/**
 * EIP-1193 Provider via WebSocket Bridge
 * 
 * This provider connects to a local WebSocket server (ws://localhost:8766)
 * instead of using Tauri IPC. This allows it to work with external URLs
 * that don't have Tauri IPC access.
 * 
 * Architecture:
 * - External dApp window loads this script
 * - Connects to WebSocket server in Rust backend
 * - Sends JSON-RPC requests via WebSocket
 * - Receives responses via WebSocket
 * - No Tauri IPC needed!
 */

(function() {
  'use strict';

  // Prevent re-injection
  if (window.ethereum) {
    console.warn('[Vaughan-WS] Provider already injected');
    return;
  }

  console.log('[Vaughan-WS] Initializing WebSocket provider...');

  // ============================================================================
  // WebSocket Connection Manager
  // ============================================================================

  class WebSocketConnection {
    constructor() {
      this.ws = null;
      this.connected = false;
      this.pendingRequests = new Map();
      this.reconnectAttempts = 0;
      this.maxReconnectAttempts = 5;
      this.reconnectDelay = 1000;
      
      this.connect();
    }

    connect() {
      try {
        console.log('[Vaughan-WS] Connecting to ws://localhost:8766...');
        
        this.ws = new WebSocket('ws://localhost:8766');
        
        this.ws.onopen = () => {
          console.log('[Vaughan-WS] Connected! ✅');
          this.connected = true;
          this.reconnectAttempts = 0;
          
          // Emit connect event
          if (window.ethereum) {
            window.ethereum.emit('connect', { chainId: '0x171' }); // PulseChain default
          }
        };
        
        this.ws.onmessage = (event) => {
          try {
            const response = JSON.parse(event.data);
            console.log('[Vaughan-WS] Response:', response);
            
            const resolver = this.pendingRequests.get(response.id);
            if (resolver) {
              this.pendingRequests.delete(response.id);
              
              if (response.error) {
                resolver.reject(new Error(response.error.message));
              } else {
                resolver.resolve(response.result);
              }
            }
          } catch (err) {
            console.error('[Vaughan-WS] Failed to parse response:', err);
          }
        };
        
        this.ws.onerror = (error) => {
          console.error('[Vaughan-WS] WebSocket error:', error);
          this.connected = false;
        };
        
        this.ws.onclose = () => {
          console.log('[Vaughan-WS] Disconnected');
          this.connected = false;
          
          // Emit disconnect event
          if (window.ethereum) {
            window.ethereum.emit('disconnect', { code: 1000, reason: 'Connection closed' });
          }
          
          // Try to reconnect
          this.reconnect();
        };
      } catch (err) {
        console.error('[Vaughan-WS] Failed to connect:', err);
        this.reconnect();
      }
    }

    reconnect() {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('[Vaughan-WS] Max reconnect attempts reached');
        return;
      }
      
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * this.reconnectAttempts;
      
      console.log(`[Vaughan-WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.connect();
      }, delay);
    }

    async send(method, params = []) {
      if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket not connected');
      }
      
      const id = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const request = {
        id,
        method,
        params
      };
      
      console.log('[Vaughan-WS] Request:', request);
      
      return new Promise((resolve, reject) => {
        // Store resolver
        this.pendingRequests.set(id, { resolve, reject });
        
        // Set timeout (30 seconds)
        setTimeout(() => {
          if (this.pendingRequests.has(id)) {
            this.pendingRequests.delete(id);
            reject(new Error('Request timeout'));
          }
        }, 30000);
        
        // Send request
        this.ws.send(JSON.stringify(request));
      });
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
          console.error('[Vaughan-WS] Event listener error:', error);
        }
      });
      return true;
    }
  }

  // ============================================================================
  // Ethereum Provider
  // ============================================================================

  class VaughanWebSocketProvider extends EventEmitter {
    constructor(connection) {
      super();
      
      this.connection = connection;
      
      // Provider metadata
      this.isVaughan = true;
      this.isMetaMask = true; // For compatibility
      
      // State
      this._chainId = '0x171'; // PulseChain default
      this._accounts = [];
      this._isConnected = false;
      
      // Initialize
      this._initialize();
    }

    async _initialize() {
      try {
        console.log('[Vaughan-WS] Initializing provider...');
        
        // Wait for connection
        let attempts = 0;
        while (!this.connection.connected && attempts < 10) {
          await new Promise(resolve => setTimeout(resolve, 500));
          attempts++;
        }
        
        if (!this.connection.connected) {
          console.error('[Vaughan-WS] Failed to connect to WebSocket server');
          return;
        }
        
        // Get initial chain ID
        const chainId = await this.request({ method: 'eth_chainId' });
        this._chainId = chainId;
        this._isConnected = true;
        
        console.log('[Vaughan-WS] Provider initialized with chainId:', chainId);
        
        // Emit connect event
        this.emit('connect', { chainId });
      } catch (error) {
        console.error('[Vaughan-WS] Failed to initialize provider:', error);
        this._chainId = '0x171'; // Fallback
        this._isConnected = false;
      }
    }

    async request(args) {
      if (!args || typeof args !== 'object') {
        throw new Error('Request must be an object');
      }
      if (!args.method) {
        throw new Error('Request must have a method');
      }

      const { method, params = [] } = args;
      
      console.log('[Vaughan-WS] Request:', method, params);

      // Handle special methods locally
      switch (method) {
        case 'eth_accounts':
          return this._accounts;
        
        case 'eth_chainId':
          return this._chainId;
        
        case 'net_version':
          return this._chainId ? String(parseInt(this._chainId, 16)) : null;
        
        case 'eth_requestAccounts':
          // Request accounts and update local state
          const accounts = await this.connection.send(method, params);
          this._accounts = accounts;
          this.emit('accountsChanged', accounts);
          return accounts;
        
        default:
          // Send to backend via WebSocket
          return await this.connection.send(method, params);
      }
    }

    // Legacy sendAsync method
    sendAsync(payload, callback) {
      this.request({
        method: payload.method,
        params: payload.params
      })
        .then(result => callback(null, { id: payload.id, jsonrpc: '2.0', result }))
        .catch(error => callback(error, null));
    }

    // Legacy send method
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

  // Create WebSocket connection
  const connection = new WebSocketConnection();
  
  // Create provider
  const provider = new VaughanWebSocketProvider(connection);
  
  // Inject into window
  Object.defineProperty(window, 'ethereum', {
    value: provider,
    writable: false,
    configurable: false
  });
  
  console.log('[Vaughan-WS] Provider injected successfully ✅');

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

  console.log('[Vaughan-WS] EIP-6963 announcement sent');
})();
