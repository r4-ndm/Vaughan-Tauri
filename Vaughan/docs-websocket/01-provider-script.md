# Provider Script - Extension-Style Injection

**File**: `src/provider/provider-inject-extension.js`

**Purpose**: EIP-1193 compliant Ethereum provider that uses WebSocket to communicate with the wallet backend, injected before CSP applies.

---

## Overview

This script mimics how MetaMask works as a browser extension:
1. Injected via `initialization_script` (privileged context)
2. Runs BEFORE page loads, BEFORE CSP
3. Creates WebSocket connection to wallet backend
4. Provides `window.ethereum` API to dApps

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Provider Script (provider-inject-extension.js)         │
│                                                          │
│  ┌────────────────────────────────────────────────┐     │
│  │  VaughanProvider (EIP-1193 interface)          │     │
│  │  - request(method, params)                     │     │
│  │  - sendAsync() [legacy]                        │     │
│  │  - send() [legacy]                             │     │
│  │  - Event emitter (on, emit, removeListener)    │     │
│  └────────────────────────────────────────────────┘     │
│                      ↓                                   │
│  ┌────────────────────────────────────────────────┐     │
│  │  WebSocketCommunicator                         │     │
│  │  - connect()                                   │     │
│  │  - sendRequest(method, params)                 │     │
│  │  - Handles reconnection                        │     │
│  │  - Manages pending requests                    │     │
│  └────────────────────────────────────────────────┘     │
│                      ↓                                   │
│              WebSocket (ws://localhost:8766)             │
└─────────────────────────────────────────────────────────┘
```

---

## Key Components

### 1. WebSocketCommunicator

Manages WebSocket connection and request/response handling.

```javascript
class WebSocketCommunicator {
    constructor() {
        this.ws = null;
        this.pendingRequests = new Map();  // Track in-flight requests
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        
        this.connect();
    }
}
```

#### Connection Management

```javascript
connect() {
    this.ws = new WebSocket('ws://localhost:8766');
    
    this.ws.onopen = () => {
        console.log('[Vaughan-Ext] Connected! ✅');
        this.isConnected = true;
        this.reconnectAttempts = 0;
    };
    
    this.ws.onclose = () => {
        // Reject all pending requests
        this.pendingRequests.forEach((pending) => {
            pending.reject(new Error('WebSocket disconnected'));
        });
        this.pendingRequests.clear();
        
        // Attempt reconnection
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => this.connect(), this.reconnectDelay * this.reconnectAttempts);
        }
    };
}
```

**Features**:
- Automatic reconnection (up to 5 attempts)
- Exponential backoff (1s, 2s, 3s, 4s, 5s)
- Cleans up pending requests on disconnect

#### Request/Response Handling

```javascript
async sendRequest(method, params = []) {
    if (!this.isConnected) {
        throw new Error('WebSocket not connected');
    }
    
    const id = Date.now();  // Simple ID generation
    const request = {
        id,
        jsonrpc: '2.0',
        method,
        params
    };
    
    return new Promise((resolve, reject) => {
        // Store promise handlers
        this.pendingRequests.set(id, { resolve, reject });
        
        // Send request
        this.ws.send(JSON.stringify(request));
        
        // Timeout after 30 seconds
        setTimeout(() => {
            if (this.pendingRequests.has(id)) {
                this.pendingRequests.delete(id);
                reject(new Error('Request timeout'));
            }
        }, 30000);
    });
}
```

**Message Handler**:
```javascript
this.ws.onmessage = (event) => {
    const response = JSON.parse(event.data);
    const { id, result, error } = response;
    
    const pending = this.pendingRequests.get(id);
    if (pending) {
        this.pendingRequests.delete(id);
        
        if (error) {
            pending.reject(new Error(error.message));
        } else {
            pending.resolve(result);
        }
    }
};
```

---

### 2. EventEmitter

Simple event system for provider events (accountsChanged, chainChanged, etc.)

```javascript
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
```

**Usage**:
```javascript
// dApp code
ethereum.on('accountsChanged', (accounts) => {
    console.log('Accounts changed:', accounts);
});

ethereum.on('chainChanged', (chainId) => {
    console.log('Chain changed:', chainId);
    window.location.reload();  // Standard practice
});
```

---

### 3. VaughanProvider

EIP-1193 compliant Ethereum provider.

```javascript
class VaughanProvider extends EventEmitter {
    constructor(communicator) {
        super();
        
        this.communicator = communicator;
        
        // Provider metadata
        this.isVaughan = true;
        this.isMetaMask = true;  // For compatibility
        
        // State
        this._chainId = null;
        this._accounts = [];
        this._isConnected = false;
        
        this._initialize();
    }
}
```

#### Initialization

```javascript
async _initialize() {
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
    
    // Emit connect event
    this.emit('connect', { chainId });
}
```

#### EIP-1193 request() Method

```javascript
async request(args) {
    if (!args || typeof args !== 'object') {
        throw new Error('Request must be an object');
    }
    if (!args.method) {
        throw new Error('Request must have a method');
    }

    const { method, params = [] } = args;

    // Handle special methods locally (for performance)
    switch (method) {
        case 'eth_accounts':
            return this._accounts;  // Return cached accounts
        
        case 'eth_chainId':
            if (this._chainId) {
                return this._chainId;  // Return cached chainId
            }
            break;
        
        case 'net_version':
            return this._chainId ? String(parseInt(this._chainId, 16)) : null;
        
        case 'eth_requestAccounts':
            // Request accounts and update cache
            const accounts = await this.communicator.sendRequest(method, params);
            this._accounts = accounts;
            this.emit('accountsChanged', accounts);
            return accounts;
    }
    
    // Send to backend via WebSocket
    return this.communicator.sendRequest(method, params);
}
```

**Why Cache Some Values?**
- `eth_accounts` and `eth_chainId` are called frequently
- Caching reduces WebSocket traffic
- Improves performance
- Still updates on changes (via events)

#### Legacy Methods

For compatibility with older dApps:

```javascript
// Legacy sendAsync (callback-based)
sendAsync(payload, callback) {
    this.request({
        method: payload.method,
        params: payload.params
    })
        .then(result => callback(null, { id: payload.id, jsonrpc: '2.0', result }))
        .catch(error => callback(error, null));
}

// Legacy send (multiple signatures)
send(methodOrPayload, paramsOrCallback) {
    if (typeof methodOrPayload === 'string') {
        // send('eth_accounts', [])
        return this.request({ method: methodOrPayload, params: paramsOrCallback });
    } else if (typeof paramsOrCallback === 'function') {
        // send({ method: 'eth_accounts' }, callback)
        return this.sendAsync(methodOrPayload, paramsOrCallback);
    } else {
        // send({ method: 'eth_accounts' })
        return this.request(methodOrPayload);
    }
}
```

---

### 4. Window Injection

```javascript
// Create communicator
const communicator = new WebSocketCommunicator();

// Create provider
const provider = new VaughanProvider(communicator);

// Inject into window (immutable)
Object.defineProperty(window, 'ethereum', {
    value: provider,
    writable: false,      // Cannot be overwritten
    configurable: false   // Cannot be deleted
});

console.log('[Vaughan-Ext] Provider injected successfully ✅');
```

**Why `Object.defineProperty`?**
- Prevents dApps from overwriting `window.ethereum`
- Prevents malicious scripts from hijacking the provider
- Standard practice for wallet providers

---

### 5. EIP-6963: Multi-Provider Discovery

Modern standard for discovering multiple wallet providers.

```javascript
const providerInfo = Object.freeze({
    uuid: '350670db-19fa-4704-a166-e52e178b59d2',  // Unique ID
    name: 'Vaughan Wallet',
    icon: 'data:image/svg+xml;base64,...',  // Base64 SVG
    rdns: 'io.vaughan.wallet'  // Reverse domain name
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

// Announce immediately
announceProvider();

// Listen for discovery requests
window.addEventListener('eip6963:requestProvider', () => {
    announceProvider();
});
```

**How dApps Use This**:
```javascript
// dApp code
window.addEventListener('eip6963:announceProvider', (event) => {
    const { info, provider } = event.detail;
    console.log('Found wallet:', info.name);
    // Add to wallet selection UI
});

// Request all providers
window.dispatchEvent(new Event('eip6963:requestProvider'));
```

---

## Supported Methods

### Read Methods (No Approval)
- `eth_chainId` - Get current chain ID
- `eth_accounts` - Get connected accounts
- `eth_blockNumber` - Get latest block number
- `eth_getBalance` - Get account balance
- `eth_call` - Call contract (read-only)
- `eth_estimateGas` - Estimate gas for transaction
- `eth_gasPrice` - Get current gas price
- `net_version` - Get network version

### Write Methods (Require Approval)
- `eth_requestAccounts` - Request account access
- `eth_sendTransaction` - Send transaction
- `personal_sign` - Sign message
- `eth_signTypedData_v4` - Sign typed data

---

## Error Handling

```javascript
try {
    const accounts = await ethereum.request({
        method: 'eth_requestAccounts'
    });
} catch (error) {
    if (error.code === 4001) {
        // User rejected request
        console.log('User rejected connection');
    } else if (error.code === -32002) {
        // Request already pending
        console.log('Connection request already pending');
    } else {
        // Other error
        console.error('Error:', error.message);
    }
}
```

**Standard Error Codes**:
- `4001` - User rejected request
- `4100` - Unauthorized (not connected)
- `4200` - Unsupported method
- `4900` - Disconnected
- `-32700` - Parse error
- `-32600` - Invalid request
- `-32601` - Method not found
- `-32602` - Invalid params
- `-32603` - Internal error

---

## Testing

### Test Connection

```javascript
// Check if provider exists
if (window.ethereum) {
    console.log('Provider found:', window.ethereum.isVaughan);
    
    // Check connection
    const chainId = await ethereum.request({ method: 'eth_chainId' });
    console.log('Connected to chain:', chainId);
}
```

### Test Account Request

```javascript
const accounts = await ethereum.request({
    method: 'eth_requestAccounts'
});
console.log('Connected accounts:', accounts);
```

### Test Events

```javascript
ethereum.on('accountsChanged', (accounts) => {
    console.log('Accounts changed:', accounts);
});

ethereum.on('chainChanged', (chainId) => {
    console.log('Chain changed:', chainId);
});

ethereum.on('disconnect', () => {
    console.log('Disconnected');
});
```

---

## Key Takeaways

1. **Runs before CSP** - Injected via `initialization_script`
2. **WebSocket communication** - Bypasses CSP restrictions
3. **EIP-1193 compliant** - Works with all dApps
4. **EIP-6963 support** - Multi-provider discovery
5. **Automatic reconnection** - Handles connection failures
6. **Event system** - Notifies dApps of changes
7. **Legacy support** - Works with older dApps

---

**Next**: [02-websocket-server.md](./02-websocket-server.md) - Rust WebSocket server implementation
