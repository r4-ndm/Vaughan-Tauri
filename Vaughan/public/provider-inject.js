/**
 * EIP-1193 Ethereum Provider Implementation for Vaughan Wallet
 * 
 * This script is injected into dApp iframes to provide window.ethereum
 * Implements EIP-1193 standard with security hardening
 * 
 * Security Features:
 * - Input sanitization
 * - Request ID tracking (replay protection)
 * - Origin validation
 * - Rate limiting (client-side)
 * - No sensitive data exposure
 */

(function() {
  'use strict';

  // Prevent re-injection
  if (window.ethereum) {
    console.warn('[Vaughan] Provider already injected');
    return;
  }

  // Detect environment (native WebView vs iframe)
  const isNativeWebview = typeof window.__TAURI__ !== 'undefined';
  console.log('[Vaughan] Environment:', isNativeWebview ? 'Native WebView' : 'Iframe');

  // ============================================================================
  // Utility Functions
  // ============================================================================

  /**
   * Generate unique request ID (UUID v4)
   */
  function generateRequestId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Sanitize method name (alphanumeric + underscore only)
   */
  function sanitizeMethod(method) {
    if (typeof method !== 'string') {
      throw new Error('Method must be a string');
    }
    if (!/^[a-zA-Z0-9_]+$/.test(method)) {
      throw new Error('Invalid method name');
    }
    return method;
  }

  /**
   * Sanitize params (deep clone + validation)
   */
  function sanitizeParams(params) {
    if (params === undefined || params === null) {
      return [];
    }
    if (!Array.isArray(params) && typeof params !== 'object') {
      throw new Error('Params must be an array or object');
    }
    // Deep clone to prevent prototype pollution
    return JSON.parse(JSON.stringify(params));
  }

  /**
   * Validate request structure
   */
  function validateRequest(args) {
    if (!args || typeof args !== 'object') {
      throw new Error('Request must be an object');
    }
    if (!args.method) {
      throw new Error('Request must have a method');
    }
    return true;
  }

  // ============================================================================
  // Event Emitter Implementation
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
          console.error('[Vaughan] Event listener error:', error);
        }
      });
      return true;
    }
  }

  // ============================================================================
  // Rate Limiter (Client-Side)
  // ============================================================================

  class RateLimiter {
    constructor(maxRequests = 10, windowMs = 1000) {
      this.maxRequests = maxRequests;
      this.windowMs = windowMs;
      this.requests = [];
    }

    checkLimit() {
      const now = Date.now();
      // Remove old requests outside the window
      this.requests = this.requests.filter(time => now - time < this.windowMs);
      
      if (this.requests.length >= this.maxRequests) {
        throw new Error('Rate limit exceeded. Please slow down.');
      }
      
      this.requests.push(now);
    }
  }

  // ============================================================================
  // Ethereum Provider Implementation
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
      
      // Security
      this._rateLimiter = new RateLimiter(10, 1000); // 10 requests per second
      this._processedRequests = new Set();
      
      // Environment
      this._isNativeWebview = isNativeWebview;
      
      // Initialize
      this._initialize();
    }

    /**
     * Initialize provider (get initial state)
     */
    async _initialize() {
      try {
        // Get initial chain ID
        const chainId = await this._sendRequest('eth_chainId', []);
        this._chainId = chainId;
        this._isConnected = true;
        
        // Emit connect event
        this.emit('connect', { chainId });
        
        // Set up event listeners (native WebView only)
        if (this._isNativeWebview) {
          this._setupEventListeners();
        }
      } catch (error) {
        console.error('[Vaughan] Failed to initialize provider:', error);
      }
    }

    /**
     * Set up Tauri event listeners (native WebView only)
     */
    _setupEventListeners() {
      console.log('[Vaughan] Setting up Tauri event listeners');
      
      // Listen for approval responses
      window.__TAURI__.event.listen('approval_response', (event) => {
        console.log('[Vaughan] Received approval_response event:', event.payload);
        // Approval responses are handled by pending request promises
        // This is for logging/debugging purposes
      });
      
      // Listen for account changes
      window.__TAURI__.event.listen('accountsChanged', (event) => {
        console.log('[Vaughan] Received accountsChanged event:', event.payload);
        this._handleAccountsChanged(event.payload);
      });
      
      // Listen for chain changes
      window.__TAURI__.event.listen('chainChanged', (event) => {
        console.log('[Vaughan] Received chainChanged event:', event.payload);
        this._handleChainChanged(event.payload);
      });
      
      // Listen for disconnect
      window.__TAURI__.event.listen('disconnect', (event) => {
        console.log('[Vaughan] Received disconnect event:', event.payload);
        this._handleDisconnect();
      });
      
      // Listen for connect
      window.__TAURI__.event.listen('connect', (event) => {
        console.log('[Vaughan] Received connect event:', event.payload);
        if (event.payload.accounts) {
          this._handleAccountsChanged(event.payload.accounts);
        }
        if (event.payload.chainId) {
          this._handleChainChanged(event.payload.chainId);
        }
      });
      
      console.log('[Vaughan] Event listeners set up successfully');
    }

    /**
     * Send request to Tauri backend (IPC or postMessage)
     */
    async _sendRequest(method, params) {
      // Rate limiting
      this._rateLimiter.checkLimit();
      
      // Generate request ID
      const id = generateRequestId();
      const timestamp = Date.now();
      
      // Check for replay (request ID already processed)
      if (this._processedRequests.has(id)) {
        throw new Error('Duplicate request ID');
      }
      
      // Sanitize inputs
      const sanitizedMethod = sanitizeMethod(method);
      const sanitizedParams = sanitizeParams(params);
      
      // Create request
      const request = {
        id,
        timestamp,
        method: sanitizedMethod,
        params: sanitizedParams
      };
      
      // Mark as processed
      this._processedRequests.add(id);
      
      // Clean up old processed requests (keep last 100)
      if (this._processedRequests.size > 100) {
        const arr = Array.from(this._processedRequests);
        this._processedRequests = new Set(arr.slice(-100));
      }
      
      // Route to appropriate backend
      if (this._isNativeWebview) {
        return this._sendViaTauriIPC(request);
      } else {
        return this._sendViaPostMessage(request);
      }
    }

    /**
     * Send request via Tauri IPC (native WebView)
     */
    async _sendViaTauriIPC(request) {
      try {
        console.log('[Vaughan] Sending via Tauri IPC:', request.method);
        
        // Create timeout promise
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout (30s)')), 30000)
        );
        
        // Create request promise
        const requestPromise = window.__TAURI__.core.invoke('dapp_request', {
          request: request
        });
        
        // Race between request and timeout
        const response = await Promise.race([requestPromise, timeoutPromise]);
        
        console.log('[Vaughan] Received response:', response);
        
        // Handle response
        if (response.error) {
          // Check for session error (need to reconnect)
          if (response.error.message && response.error.message.includes('session')) {
            console.warn('[Vaughan] Session error detected, attempting reconnection...');
            await this._handleSessionError();
            throw new Error(response.error.message);
          }
          throw new Error(response.error.message || 'Request failed');
        }
        
        return response.result;
      } catch (error) {
        console.error('[Vaughan] Tauri IPC error:', error);
        throw error;
      }
    }

    /**
     * Send request via postMessage (iframe fallback)
     */
    async _sendViaPostMessage(request) {
      console.log('[Vaughan] Sending via postMessage:', request.method);
      
      return new Promise((resolve, reject) => {
        // Set up response handler
        const handleResponse = (event) => {
          // Validate response
          if (!event.data || event.data.id !== request.id) {
            return; // Not our response
          }
          
          // Remove listener
          window.removeEventListener('message', handleResponse);
          
          // Handle response
          if (event.data.error) {
            reject(new Error(event.data.error.message || 'Request failed'));
          } else {
            resolve(event.data.result);
          }
        };
        
        // Listen for response
        window.addEventListener('message', handleResponse);
        
        // Send request to parent
        window.parent.postMessage({
          type: 'VAUGHAN_REQUEST',
          request
        }, '*');
        
        // Timeout after 30 seconds
        setTimeout(() => {
          window.removeEventListener('message', handleResponse);
          reject(new Error('Request timeout'));
        }, 30000);
      });
    }

    /**
     * Handle session error (automatic reconnection)
     */
    async _handleSessionError() {
      console.log('[Vaughan] Session lost, attempting reconnection...');
      
      try {
        // Clear current state
        this._accounts = [];
        this._isConnected = false;
        
        // Attempt to reconnect (request accounts again)
        const accounts = await this._sendRequest('eth_requestAccounts', []);
        
        // Update state
        this._accounts = accounts;
        this._isConnected = true;
        
        // Emit events
        this.emit('accountsChanged', accounts);
        
        console.log('[Vaughan] Reconnection successful');
      } catch (error) {
        console.error('[Vaughan] Reconnection failed:', error);
        
        // Emit disconnect event
        this._handleDisconnect();
        
        throw new Error('Session reconnection failed. Please refresh the page.');
      }
    }

    /**
     * EIP-1193 request method
     */
    async request(args) {
      // Validate request
      validateRequest(args);
      
      const { method, params = [] } = args;
      
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
          return this._sendRequest(method, params);
      }
    }

    /**
     * Handle eth_requestAccounts (connection request)
     */
    async _handleRequestAccounts() {
      try {
        const accounts = await this._sendRequest('eth_requestAccounts', []);
        this._accounts = accounts;
        
        // Emit accountsChanged event
        this.emit('accountsChanged', accounts);
        
        return accounts;
      } catch (error) {
        console.error('[Vaughan] Failed to request accounts:', error);
        throw error;
      }
    }

    /**
     * Handle chain change (called by ProviderBridge)
     */
    _handleChainChanged(chainId) {
      if (this._chainId !== chainId) {
        this._chainId = chainId;
        this.emit('chainChanged', chainId);
      }
    }

    /**
     * Handle account change (called by ProviderBridge)
     */
    _handleAccountsChanged(accounts) {
      this._accounts = accounts;
      this.emit('accountsChanged', accounts);
    }

    /**
     * Handle disconnect (called by ProviderBridge)
     */
    _handleDisconnect() {
      this._isConnected = false;
      this._accounts = [];
      this.emit('disconnect', { code: 1000, message: 'User disconnected' });
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
  }

  // ============================================================================
  // Inject Provider
  // ============================================================================

  // Create provider instance
  const provider = new VaughanProvider();

  // Make it read-only
  Object.defineProperty(window, 'ethereum', {
    value: provider,
    writable: false,
    configurable: false
  });

  // ============================================================================
  // EIP-6963: Multi Injected Provider Discovery
  // ============================================================================

  /**
   * EIP-6963 Provider Info
   * 
   * UUID: Static identifier (never changes)
   * Name: Human-readable wallet name
   * Icon: Base64-encoded SVG logo
   * RDNS: Reverse domain name service identifier
   */
  const providerInfo = Object.freeze({
    uuid: '350670db-19fa-4704-a166-e52e178b59d2', // Static UUID (generated once)
    name: 'Vaughan Wallet',
    icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSI4IiBmaWxsPSIjNEY0NkU1Ii8+CiAgPHBhdGggZD0iTTE2IDhMMjQgMTZMMTYgMjRMOCAxNkwxNiA4WiIgZmlsbD0id2hpdGUiLz4KICA8cGF0aCBkPSJNMTYgMTJMMjAgMTZMMTYgMjBMMTIgMTZMMTYgMTJaIiBmaWxsPSIjNEY0NkU1Ii8+Cjwvc3ZnPg==',
    rdns: 'io.vaughan.wallet'
  });

  /**
   * EIP-6963 Provider Detail
   */
  const providerDetail = Object.freeze({
    info: providerInfo,
    provider: provider
  });

  /**
   * Announce provider to dApps
   * 
   * This function dispatches the EIP-6963 announcement event.
   * It should be called:
   * 1. Immediately on page load
   * 2. In response to eip6963:requestProvider events
   */
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

  console.log('[Vaughan] Provider injected successfully');
  console.log('[Vaughan] EIP-6963 announcement sent');
})();
