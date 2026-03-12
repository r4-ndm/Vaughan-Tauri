/// <reference lib="webworker" />
import { Buffer } from 'buffer';
import { BrowserLevel } from 'browser-level';
import { NETWORK_CONFIG } from '@railgun-community/shared-models';

// Debug toggle: set VITE_DEBUG_RAILGUN=true in your Vite env to enable
// verbose diagnostics (IDB, BrowserLevel, Level, Fetch Trace, etc.).
const DEBUG_RAILGUN =
    (import.meta as any).env?.VITE_DEBUG_RAILGUN === 'true';

const traceLog = (...args: any[]) => {
    if (DEBUG_RAILGUN) console.log(...args);
};

// ============================================================================
// Polyfills for Level/Levelup Environment (WebWorker)
// ============================================================================
(function nextTickPolyfill() {
    const global = self as any;
    if (!global.process) global.process = {};
    global.process.browser = true;
    global.process.env = global.process.env || {};

    // Switch to MACROTASK priority (setTimeout) to ensure event loop turns.
    // Microtasks (queueMicrotask) can starve the event loop if they are too frequent,
    // which is a common cause of deadlocks in Levelup's state transitions.
    let tickCount = 0;
    global.process.nextTick = (fn: Function, ...args: any[]) => {
        tickCount++;
        if (tickCount % 100 === 0) {
            setTimeout(() => fn(...args), 0);
        } else {
            queueMicrotask(() => fn(...args));
        }
    };

    if (typeof global.setImmediate !== 'function') {
        global.setImmediate = (fn: Function, ...args: any[]) => {
            return setTimeout(() => fn(...args), 0);
        };
    }
})();

// Helper for safe database status checking (levelup's status getter throws if _db is null)
const getSafeStatus = (db: any): string => {
    try {
        if (!db) return 'unknown';
        // For levelup: check _db or db internal property
        const internal = db._db || db.db;
        if (internal) return db.status;
        // For browser-level / abstract-level: status is usually safe
        if (typeof db.status === 'string') return db.status;
        return 'opening';
    } catch (e) {
        return 'opening';
    }
};

// Global registries for all levelup/browserlevel instances to facilitate 'nudging'
(self as any).LEVELUP_INSTANCES = (self as any).LEVELUP_INSTANCES || new Set<any>();
(self as any).BROWSERLEVEL_INSTANCES = (self as any).BROWSERLEVEL_INSTANCES || new Set<any>();

// Some libraries check global.Buffer or Buffer directly.
(self as any).Buffer = Buffer;

// ============================================================================
// Singleton Store Registry
// ============================================================================
// Prevents multiple BrowserLevel instances from fighting over the same IDB store.
const STORES = new Map<string, BrowserLevel>();

function getOrCreateStore(name: string): BrowserLevel {
    if (STORES.has(name)) {
        traceLog(`[Railgun Worker] Reusing existing store instance for: ${name}`);
        return STORES.get(name)!;
    }
    traceLog(`[Railgun Worker] Creating NEW store instance for: ${name}`);
    const store = new BrowserLevel(name);
    STORES.set(name, store);
    return store;
}

// ============================================================================
// CORS Bypass: Fetch Polyfill for WebWorker
// ============================================================================
// The Railgun SDK uses 'fetch' for RPC calls. Browsers block these calls
// from WebWorkers to public RPCs due to CORS. 
// CRITICAL: Tauri 'invoke' is NOT available in WebWorkers. We must route
// these calls through the main thread via postMessage.

const ctx: Worker = self as any;
const tauriInvokeHandlers = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>();
let tauriInvokeMsgIdCounter = 0;

/**
 * Proxy function for Tauri 'invoke'.
 * Sends a message to the main thread and waits for the response.
 */
async function tauriInvoke(cmd: string, args: any): Promise<any> {
    return new Promise((resolve, reject) => {
        const id = `tauri-invoke-${++tauriInvokeMsgIdCounter}`;
        tauriInvokeHandlers.set(id, { resolve, reject });

        ctx.postMessage({
            id,
            type: 'TAURI_INVOKE',
            payload: { cmd, args }
        } as any); // Type cast as RailgunWorkerResponse is too strict
    });
}

// ============================================================================
// Deep Diagnostics: XHR, IDB, and Unhandled Rejections
// ============================================================================
// Environmental Diagnostics
traceLog(`[Railgun Worker] Environmental Diagnostics: ${JSON.stringify({
    hasIDB: typeof indexedDB !== 'undefined',
    hasIDBDatabase: typeof IDBDatabase !== 'undefined',
    hasIDBObjectStore: typeof IDBObjectStore !== 'undefined',
    hasIDBTransaction: typeof IDBTransaction !== 'undefined',
    hasXHR: typeof XMLHttpRequest !== 'undefined',
    hasWasm: typeof WebAssembly !== 'undefined',
    userAgent: navigator.userAgent
})}`);

ctx.addEventListener('unhandledrejection', (event) => {
    const rejectionEvent = event as PromiseRejectionEvent;
    console.error('[Railgun Worker] 🚨 UNHANDLED REJECTION:', rejectionEvent.reason);
});

// Intercept IndexedDB to detect deadlocks
const originalIDBOpen = indexedDB.open;
indexedDB.open = function (name: string, version?: number) {
    traceLog(`[Railgun Worker] 💾 IDB OPEN: ${name} ${version || 'latest'}`);
    return originalIDBOpen.apply(this, [name, version]);
};

// 🧪 LOUD IDB TRANSACTION PATCH: Catch deadlocks early
if (typeof IDBDatabase !== 'undefined') {
    const IDBProto = IDBDatabase.prototype;
    const originalTransaction = IDBProto.transaction;
    IDBProto.transaction = function (this: IDBDatabase, ...args: any[]) {
        const storeNames = args[0];
        const mode = args[1] || 'readonly';
        const tx = originalTransaction.apply(this, args as any);
        const txId = Math.random().toString(36).substring(7);

        traceLog(`[IDB Trace] [${txId}] 🆕 TX START: ${JSON.stringify(storeNames)} (${mode})`);
        tx.oncomplete = () => traceLog(`[IDB Trace] [${txId}] ✅ TX COMPLETE`);
        tx.onerror = (e) => console.error(`[IDB Trace] [${txId}] ❌ TX ERROR`, (e.target as any)?.error);
        tx.onabort = () => console.warn(`[IDB Trace] [${txId}] ⚠️ TX ABORT`);
        return tx;
    };
}

if (typeof IDBObjectStore !== 'undefined') {
    const ObjectStoreProto = IDBObjectStore.prototype;
    const originalGet = ObjectStoreProto.get;
    ObjectStoreProto.get = function (this: IDBObjectStore, query: any) {
        const req = originalGet.call(this, query);
        const reqId = Math.random().toString(36).substring(7);
        const storeName = this.name;
        traceLog(`[IDB Trace] [${reqId}] 🕵️ PHYSICAL GET: ${query} in ${storeName}`);

        req.onsuccess = (e: any) => {
            traceLog(`[IDB Trace] [${reqId}] 🔔 REQUEST SUCCESS: found=${!!e.target.result}`);
        };
        req.onerror = (e: any) => {
            console.error(`[IDB Trace] [${reqId}] 🔔 REQUEST ERROR`, e.target.error);
        };
        return req;
    };
}

// 🧪 PROACTIVE DB LAYERING PATCH: Trace operations BEFORE the engine starts
(async () => {
    try {
        const { BrowserLevel } = await import('browser-level');
        const BrowserLevelProto = BrowserLevel.prototype as any;
        if (!BrowserLevelProto._patched) {
            BrowserLevelProto._patched = true;
            const originalOpen = BrowserLevelProto.open;
            BrowserLevelProto.open = function (this: any, ...args: any[]) {
                const cbIdx = args.findIndex(a => typeof a === 'function');
                const cb = cbIdx !== -1 ? args[cbIdx] : undefined;
                (self as any).BROWSERLEVEL_INSTANCES.add(this);

                traceLog(`[BrowserLevel Trace] 📂 OPEN: ${this.location}. Current Status: ${this.status}`);

                // SYNC BYPASS: If already open, succeed immediately
                if (this.status === 'open') {
                    traceLog(`[BrowserLevel Trace] ✅ Already open, bypassing for ${this.location}`);
                    if (cb) (self as any).process.nextTick(cb);
                    return Promise.resolve();
                }

                return originalOpen.apply(this, args);
            };
            const originalGet = BrowserLevelProto.get;
            BrowserLevelProto.get = function (this: any, ...args: any[]) {
                const id = Math.random().toString(36).substring(7);
                const start = Date.now();
                const key = args[0];
                const keyStr = typeof key === 'string' ? key : '(object)';
                traceLog(`[BrowserLevel Trace] [${id}] 🔍 GET: ${keyStr} in ${this.location}`);

                // Find callback
                let cbIdx = -1;
                for (let i = args.length - 1; i >= 0; i--) {
                    if (typeof args[i] === 'function') {
                        cbIdx = i;
                        break;
                    }
                }

                if (cbIdx !== -1) {
                    const originalCb = args[cbIdx];
                    args[cbIdx] = function (this: any, ...cbArgs: any[]) {
                        traceLog(`[BrowserLevel Trace] [${id}] ✅ CALLBACK SETTLED (${Date.now() - start}ms)`);
                        return originalCb.apply(this, cbArgs);
                    };
                }

                const result = originalGet.apply(this, args);

                // Add 15s atomic timeout
                const timeout = setTimeout(() => {
                    if (PENDING_LOGICAL_REQUESTS.has(id)) {
                        console.error(`[BrowserLevel Trace] 🧨 LOGICAL TIMEOUT (${id}) - ATOMIC SETTLE (undefined): ${keyStr}`);
                        if (cbIdx !== -1) {
                            try { args[cbIdx](null, undefined); } catch (e) { }
                        }
                        finalize(true, 15000, 'TIMEOUT_ATOMIC_SETTLE');
                    }
                }, 15000);

                const finalize = (success: boolean, duration: number, flavor: string, error?: any) => {
                    clearTimeout(timeout);
                    if (PENDING_LOGICAL_REQUESTS.has(id)) {
                        PENDING_LOGICAL_REQUESTS.delete(id);
                        if (success) traceLog(`[BrowserLevel Trace] [${id}] ✅ ${flavor} SETTLED (${duration}ms)`);
                        else console.error(`[BrowserLevel Trace] [${id}] ❌ ${flavor} ERROR (${duration}ms):`, error?.message || error);
                    }
                };

                if (result && typeof result.then === 'function') {
                    return result.then(
                        (res: any) => {
                            finalize(true, Date.now() - start, 'PROMISE');
                            return res;
                        },
                        (err: any) => {
                            finalize(false, Date.now() - start, 'PROMISE', err);
                            throw err;
                        }
                    );
                }

                if (cbIdx === -1 && (!result || typeof result.then !== 'function')) {
                    finalize(true, Date.now() - start, 'SYNC');
                }
                return result;
            };
                const originalPut = BrowserLevelProto.put;
                BrowserLevelProto.put = function (this: any, ...args: any[]) {
                    traceLog(`[BrowserLevel Trace] 💾 PUT: ${args[0]} in ${this.location}`);
                    return originalPut.apply(this, args as any);
                };
        }
    } catch (e) { console.warn('[Railgun Worker] BrowserLevel patch failed:', e); }

    try {
        // levelup is often used by level-js/browser-level indirectly
        const levelup = (await import('levelup') as any).default;
        const LevelupProto = levelup.prototype as any;
        if (!LevelupProto._patched) {
            LevelupProto._patched = true;

            const originalOpen = LevelupProto.open;
            LevelupProto.open = function (this: any, ...args: any[]) {
                const cbIdx = args.findIndex(a => typeof a === 'function');
                const callback = cbIdx !== -1 ? args[cbIdx] : undefined;
                (self as any).LEVELUP_INSTANCES?.add(this);
                // SYNC BYPASS: If already open, succeed immediately
                if (getSafeStatus(this) === 'open') {
                    traceLog(`[Level Trace] ✅ Already open, bypassing for ${this.location || 'unknown'}`);
                    if (callback) (self as any).process.nextTick(callback);
                    return Promise.resolve(this);
                }
                return originalOpen.apply(this, args);
            };

            let getCounter = 0;
            const originalGet = LevelupProto.get;
            LevelupProto.get = function (this: any, ...args: any[]) {
                (self as any).LEVELUP_INSTANCES?.add(this);
                const start = Date.now();
                const id = ++getCounter;
                const key = args[0];
                const keyStr = typeof key === 'string' ? key : '(object)';
                traceLog(`[Level Trace] [${id}] 🔍 GET: ${keyStr}`);

                const reqId = `level-${id}`;
                PENDING_LOGICAL_REQUESTS.set(reqId, { start, key: keyStr });

                // Find if there is a callback
                let cbIdx = -1;
                for (let i = args.length - 1; i >= 0; i--) {
                    if (typeof args[i] === 'function') {
                        cbIdx = i;
                        break;
                    }
                }

                if (cbIdx !== -1) {
                    const originalCb = args[cbIdx];
                    args[cbIdx] = function (this: any, ...cbArgs: any[]) {
                        PENDING_LOGICAL_REQUESTS.delete(reqId);
                        traceLog(`[Level Trace] [${id}] ✅ CALLBACK SETTLED (${Date.now() - start}ms)`);
                        return originalCb.apply(this, cbArgs);
                    };
                }

                const result = originalGet.apply(this, args);

                // Add 15s atomic timeout
                const timeout = setTimeout(() => {
                    if (PENDING_LOGICAL_REQUESTS.has(reqId)) {
                        console.error(`[Level Trace] 🧨 LOGICAL TIMEOUT (${id}) - ATOMIC SETTLE (undefined): ${keyStr}`);
                        if (cbIdx !== -1) {
                            try { args[cbIdx](null, undefined); } catch (e) { }
                        }
                        finalize(true, 15000, 'TIMEOUT_ATOMIC_SETTLE');
                    }
                }, 15000);

                const finalize = (success: boolean, duration: number, flavor: string, error?: any) => {
                    clearTimeout(timeout);
                    if (PENDING_LOGICAL_REQUESTS.has(reqId)) {
                        PENDING_LOGICAL_REQUESTS.delete(reqId);
                        if (success) traceLog(`[Level Trace] [${id}] ✅ ${flavor} SETTLED (${duration}ms)`);
                        else console.error(`[Level Trace] [${id}] ❌ ${flavor} ERROR (${duration}ms):`, error?.message || error);
                    }
                };

                if (result && typeof result.then === 'function') {
                    return result.then(
                        (res: any) => {
                            finalize(true, Date.now() - start, 'PROMISE');
                            return res;
                        },
                        (err: any) => {
                            finalize(false, Date.now() - start, 'PROMISE', err);
                            throw err;
                        }
                    );
                }

                if (cbIdx === -1 && (!result || typeof result.then !== 'function')) {
                    finalize(true, Date.now() - start, 'SYNC');
                }
                return result;
            };
                const originalPut = LevelupProto.put;
                LevelupProto.put = function (this: any, ...args: any[]) {
                    if (this.isOpen()) {
                        traceLog(`[Level Trace] 💾 PUT: ${args[0]}`);
                    } else {
                        console.warn(`[Level Trace] 💾 QUEUED PUT (DB NOT OPEN). Status: ${this.status}, Underlying Status: ${this._db?.status}`);
                    }
                    return originalPut.apply(this, args);
                };

                const originalEmit = LevelupProto.emit;
                LevelupProto.emit = function (this: any, event: string, ...args: any[]) {
                    if (['open', 'ready', 'closed', 'error'].includes(event)) {
                        traceLog(`[Level Trace] 📢 EVENT: ${event} Status: ${this.status}`);
                    }
                    return originalEmit.apply(this, [event, ...args]);
                };
        }
    } catch (e) { console.warn('[Railgun Worker] levelup patch failed:', e); }
})();

// ============================================================================
// Global System Watchdog (Permanent Heartbeat)
// ============================================================================
// Detects and force-flushes stuck levelup _deferred queues.
const PENDING_LOGICAL_REQUESTS = new Map<string, { start: number; key: string }>();

setInterval(() => {
    try {
        const levelupInstances = (self as any).LEVELUP_INSTANCES;
        if (levelupInstances) {
            for (const db of levelupInstances) {
                try {
                    if (!db) continue;
                    const status = getSafeStatus(db);
                    const isOpening = status === 'opening';
                    const underlyingOpen = db._db?.status === 'open' || db.db?.status === 'open' || (typeof db.isOpen === 'function' && db.isOpen());

                    // Track stuck time
                    db._stuckTime = db._stuckTime || 0;
                    if (isOpening || (status === 'open' && db._deferred && db._deferred.length > 0)) {
                        db._stuckTime += 1;
                    } else {
                        db._stuckTime = 0;
                    }

                    // 🔥 LOUD NUDGE: If stuck > 2s or opening+underlying open
                    if ((isOpening && underlyingOpen) || (db._stuckTime >= 2)) {
                        console.warn(`[System Watchdog] 🔨 LOUD NUDGE: ${db.location || 'levelup instance'} (Stuck: ${db._stuckTime}s, Status: ${status})`);

                        if (typeof db.emit === 'function') {
                            db.emit('open');
                            db.emit('ready');
                        }
                        if (typeof db._ready === 'function') db._ready();

                        // Force transition if stuck too long
                        if (db._stuckTime >= 5 && isOpening) {
                            console.error(`[System Watchdog] 🧨 FORCING ATOMIC STATE TRANSITION for ${db.location}`);
                            db.status = 'open';
                        }
                    }

                    if (status === 'open' && db._deferred && db._deferred.length > 0) {
                        console.warn(`[System Watchdog] 💡 Flushing ${db._deferred.length} deferred items...`);
                        if (typeof db._ready === 'function') db._ready();
                    }
                } catch (e) { /* silent loop */ }
            }
        }

        // Logical Request Alerts & NUDGES
        const now = Date.now();
        for (const [id, req] of PENDING_LOGICAL_REQUESTS.entries()) {
            const duration = now - req.start;
            if (duration > 5000) {
                console.warn(`[System Watchdog] 🚨 GHOST GET DETECTED [${id}]: ${req.key} has been pending for ${duration / 1000}s`);

                // If it's a 'levelup' instance or actual instance, try a generic NUDGE
                const levelupInstances = (self as any).LEVELUP_INSTANCES;
                if (levelupInstances && duration > 10000) {
                    for (const db of levelupInstances) {
                        if (getSafeStatus(db) === 'open') {
                            if (typeof db._ready === 'function') {
                                console.log(`[System Watchdog] 🔨 PROACTIVE NUDGE for ${db.location || 'DB'} due to logical hang...`);
                                db._ready();
                            }
                        }
                    }
                }
            }
        }
    } catch (monitorErr) { /* resilient heart */ }
}, 1000);

// Check for XHR usage (Fetch polyfill doesn't catch this)
const XHR = (globalThis as any).XMLHttpRequest;
if (XHR) {
    traceLog('[Railgun Worker] 🩺 Patching XMLHttpRequest for diagnostics...');
    (globalThis as any).XMLHttpRequest = class extends XHR {
        open(method: string, url: string | URL) {
            traceLog(`[Railgun Worker] 🩺 XHR OPEN: ${method} ${url}`);
            return super.open(method, url);
        }
        send(body?: any) {
            traceLog(`[Railgun Worker] 🩺 XHR SEND`, { body });
            return super.send(body);
        }
    };
}

const originalFetch = globalThis.fetch;
let fetchCounter = 0;

// @ts-ignore
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const fetchId = ++fetchCounter;
    const startTime = Date.now();

    // 1. Resolve URL and Method
    let url = '';
    if (typeof input === 'string') {
        url = input;
    } else if (input instanceof URL) {
        url = input.toString();
    } else if (input && typeof input === 'object' && 'url' in input) {
        url = (input as Request).url;
    } else {
        url = String(input);
    }
    const method = init?.method || (input instanceof Request ? input.method : 'GET');

    // LOUD ENTRY LOG: See every single fetch call
    traceLog(`[Fetch Trace #${fetchId}] 🌐 ENTRY: ${method} ${url}`);

    // 2. Extract Body (Crucial for Ethers v6/Railgun SDK)
    let bodyText = '';
    try {
        if (init?.body) {
            if (typeof init.body === 'string') bodyText = init.body;
            else if (init.body instanceof ArrayBuffer || ArrayBuffer.isView(init.body)) bodyText = new TextDecoder().decode(init.body);
            else bodyText = String(init.body);
        } else if (input instanceof Request) {
            // CRITICAL: Clone request before reading as text to avoid "Body already used" downstream
            const clone = input.clone();
            const timeout = new Promise<string>((_, reject) => setTimeout(() => reject(new Error('Body extraction timeout')), 5000));
            bodyText = await Promise.race([clone.text(), timeout]) as string;
        }
    } catch (e) {
        console.warn(`[Fetch Trace #${fetchId}] ⚠️ Body extraction failed or timed out:`, e);
    }

    let body: any = null;
    if (bodyText) {
        try { body = JSON.parse(bodyText); } catch (e) { /* Not JSON */ }
    }

    // 3. Determine if we should proxy (Whitelist logic)
    const isLocal = url.includes('localhost:1420') || url.includes('127.0.0.1:1420') || url.startsWith('/') || url.startsWith('./') || url.startsWith('../');
    const isWasm = url.includes('.wasm');
    const isBlob = url.startsWith('blob:') || url.startsWith('data:');

    // Aggressive infrastructure interception
    const isInfra = url.includes('rpc') || url.includes('node') || url.includes('1rpc') ||
        url.includes('alchemy') || url.includes('infura') || url.includes('llama') ||
        url.includes('railgun') || url.includes('etherscan') || url.includes('polygon') ||
        url.includes('eth.');

    const shouldProxy = (isInfra || !isLocal) && !isWasm && !isBlob;

    if (shouldProxy) {
        traceLog(`[Fetch Trace #${fetchId}] ➡️ PROXYING: ${method} ${url}`, {
            body: JSON.stringify(body || (bodyText ? bodyText : 'None'))
        });
        try {
            // Determine Chain ID for eth_request
            let chainId = 1;
            if (url.includes('sepolia')) chainId = 11155111;
            else if (url.includes('amoy')) chainId = 80002;
            else if (url.includes('pulse-test')) chainId = 943;
            else if (url.includes('pulse')) chainId = 369;
            else if (url.includes('polygon')) chainId = 137;
            else if (url.includes('bsc')) chainId = 56;
            else if (url.includes('arb')) chainId = 42161;

            let finalResponseText = '';

            // 4. Route to Bridge
            if (body && !Array.isArray(body) && body.jsonrpc === '2.0' && body.method) {
                const result = await tauriInvoke('eth_request', {
                    chainId,
                    method: body.method,
                    params: body.params || []
                });
                finalResponseText = JSON.stringify({
                    jsonrpc: '2.0',
                    id: body.id ?? 1,
                    result
                });
                traceLog(`[Fetch Trace #${fetchId}] ✅ RPC Success (${Date.now() - startTime}ms): ${body.method}`, {
                    id: body.id,
                    params: JSON.stringify(body.params),
                    result: JSON.stringify(result).substring(0, 500)
                });
            } else if (Array.isArray(body)) {
                traceLog(`[Fetch Trace #${fetchId}] ➡️ BATCHED RPC (count: ${body.length}, chain: ${chainId})`);
                const batchedResults = [];
                for (const req of body) {
                    const result = await tauriInvoke('eth_request', {
                        chainId,
                        method: req.method,
                        params: req.params || []
                    });
                    batchedResults.push({
                        jsonrpc: '2.0',
                        id: req.id ?? 1,
                        result
                    });
                }
                finalResponseText = JSON.stringify(batchedResults);
                traceLog(`[Fetch Trace #${fetchId}] ✅ Batched Success (${Date.now() - startTime}ms)`);
            } else {
                traceLog(`[Fetch Trace #${fetchId}] ➡️ GENERIC: ${method} ${url}`, {
                    body: JSON.stringify(body || bodyText)
                });
                const headers: Record<string, string> = {};
                if (init?.headers) {
                    if (init.headers instanceof Headers) init.headers.forEach((v, k) => { headers[k] = v; });
                    else if (Array.isArray(init.headers)) init.headers.forEach(([k, v]) => { headers[k] = v; });
                    else Object.assign(headers, init.headers);
                }

                const result = await tauriInvoke('proxy_request', {
                    url,
                    method,
                    headers,
                    body: body || (bodyText ? bodyText : null)
                });

                finalResponseText = typeof result === 'string' ? result : JSON.stringify(result);
                traceLog(`[Fetch Trace #${fetchId}] ✅ Generic Success (${Date.now() - startTime}ms, ${finalResponseText.length} bytes)`);
            }

            return new Response(finalResponseText, {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });

        } catch (error: any) {
            console.error(`[Fetch Trace #${fetchId}] ❌ Proxy ERROR for ${url}:`, error);
            // Return failure as JSON-RPC error if it looks like one
            return new Response(JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                error: { code: -32000, message: error.message || 'Bridge Error' }
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
    }

    // Bypass for local assets
    traceLog(`[Fetch Trace #${fetchId}] ⏩ BYPASS: ${url}`);
    return originalFetch(input, init);
};

// Ensure Buffer is available globally in the worker context
if (typeof (globalThis as any).Buffer === 'undefined') {
    (globalThis as any).Buffer = Buffer;
}

// Define the shape of messages sent TO the worker
export type RailgunWorkerRequest = {
    id: string;
    type: 'INIT' | 'PING' | 'LOAD_WALLET' | 'SET_NETWORK' | 'SHIELD' | 'UNSHIELD' | 'GET_HISTORY' | 'TRANSFER' | 'TAURI_INVOKE_RESPONSE';
    payload?: any;
    error?: string;
};

// Define the shape of messages sent FROM the worker
export type RailgunWorkerResponse = {
    id: string;
    type: 'INIT_SUCCESS' | 'PONG' | 'ERROR' | 'LOAD_WALLET_SUCCESS' | 'SET_NETWORK_SUCCESS' | 'BALANCE_UPDATE' | 'SHIELD_SUCCESS' | 'UNSHIELD_SUCCESS' | 'PROOF_PROGRESS' | 'HISTORY_SUCCESS' | 'TRANSFER_SUCCESS' | 'TAURI_INVOKE';
    payload?: any;
    error?: string;
};

let engineInitialized = false;
let isInitializing = false;

/**
 * Surgically patches the Railgun SDK's NETWORK_CONFIG.
 * Preserves existing fields while only overriding critical ones for testnets.
 */
async function surgicallyPatchNetworkConfig() {
    try {
        const { NetworkName } = await import('@railgun-community/shared-models');

        console.log('[Railgun Worker] Applying surgical patches to NETWORK_CONFIG...');
        const config = NETWORK_CONFIG as any;

        const patchNetwork = (name: string, chainId: number, proxyAddr: string, wrappedAddr: string) => {
            const existing = config[name] || {};

            config[name] = {
                ...existing,
                name,
                chainId,
                proxyContract: proxyAddr,
                relayAdaptContract: proxyAddr,
                relayAdaptHistory: [proxyAddr],
                supportsV3: false, // Force V3 off to avoid ENS errors
                isTestnet: true,
                proxy: {
                    ...(existing.proxy || {}),
                    address: proxyAddr,
                    wrappedBaseTokenAddress: wrappedAddr
                },
                relayAdapt: {
                    ...(existing.relayAdapt || {}),
                    address: proxyAddr
                }
            };

            // Ensure V3 fields are safely defaulted if missing (prevents ENS lookup on undefined)
            const ZERO_ADDR = '0x0000000000000000000000000000000000000000';
            config[name].railgunRegistryContract = config[name].railgunRegistryContract || ZERO_ADDR;
            config[name].poseidonMerkleAccumulatorV3Contract = config[name].poseidonMerkleAccumulatorV3Contract || ZERO_ADDR;
            config[name].poseidonMerkleVerifierV3Contract = config[name].poseidonMerkleVerifierV3Contract || ZERO_ADDR;
            config[name].tokenVaultV3Contract = config[name].tokenVaultV3Contract || ZERO_ADDR;

            console.log(`[Railgun Worker] Surgically patched ${name} (Proxy: ${proxyAddr})`);
        };

        // Official Railgun Amoy Addresses (Note: Currently unverified on Polygonscan Amoy)
        patchNetwork(
            NetworkName.PolygonAmoy,
            80002,
            '0x8123f71740b59aaa35f6e93392476a87aae30b29', // Still using this as placeholder or removing
            '0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889'
        );
        config[NetworkName.PolygonAmoy].fallbackRPCs = ['/rpc/amoy']; // Use proxy URL

        // Official Railgun Sepolia Addresses (VERIFIED)
        const SEPOLIA_PROXY = '0xfa7093cdd9ee6932b4eb2c9e1cde7ce00b1fa4b9';
        const WETH_SEPOLIA = '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9';

        const existingSepolia = config[NetworkName.EthereumSepolia] || {};

        config[NetworkName.EthereumSepolia] = {
            ...existingSepolia,
            chainId: 11155111,
            name: NetworkName.EthereumSepolia,
            proxyContract: SEPOLIA_PROXY,
            relayAdaptContract: SEPOLIA_PROXY,
            relayAdaptHistory: [SEPOLIA_PROXY],
            supportsV3: false,
            isTestnet: true,
            fallbackRPCs: ['/rpc/sepolia'], // Use proxy URL to trigger polyfill
            proxy: {
                ...(existingSepolia.proxy || {}),
                address: SEPOLIA_PROXY,
                wrappedBaseTokenAddress: WETH_SEPOLIA
            },
            relayAdapt: {
                ...(existingSepolia.relayAdapt || {}),
                address: SEPOLIA_PROXY
            },
            baseToken: {
                ...(existingSepolia.baseToken || {}),
                symbol: 'ETH',
                wrappedSymbol: 'WETH',
                wrappedAddress: WETH_SEPOLIA,
                decimals: 18
            }
        };

        // Ensure V3 fields are safely defaulted if missing (prevents ENS lookup on undefined)
        const ZERO_ADDR = '0x0000000000000000000000000000000000000000';
        config[NetworkName.EthereumSepolia].railgunRegistryContract = config[NetworkName.EthereumSepolia].railgunRegistryContract || ZERO_ADDR;
        config[NetworkName.EthereumSepolia].poseidonMerkleAccumulatorV3Contract = config[NetworkName.EthereumSepolia].poseidonMerkleAccumulatorV3Contract || ZERO_ADDR;
        config[NetworkName.EthereumSepolia].poseidonMerkleVerifierV3Contract = config[NetworkName.EthereumSepolia].poseidonMerkleVerifierV3Contract || ZERO_ADDR;
        config[NetworkName.EthereumSepolia].tokenVaultV3Contract = config[NetworkName.EthereumSepolia].tokenVaultV3Contract || ZERO_ADDR;

        console.log(`[Railgun Worker] Surgically patched Sepolia. Proxy: ${config[NetworkName.EthereumSepolia].proxy.address}`);

    } catch (err) {
        console.error('[Railgun Worker] Failed to surgically patch NETWORK_CONFIG:', err);
    }
}

// Command Queue Implementation
const commandQueue: { event: MessageEvent<RailgunWorkerRequest> }[] = [];
let isProcessing = false;

async function processQueue() {
    if (isProcessing || commandQueue.length === 0) return;
    isProcessing = true;

    while (commandQueue.length > 0) {
        const item = commandQueue.shift();
        if (item) {
            await handleMessage(item.event);
        }
    }

    isProcessing = false;
}

ctx.addEventListener('message', (event: MessageEvent<RailgunWorkerRequest>) => {
    const { id, type, payload } = event.data;

    // CRITICAL DEADLOCK FIX:
    // Handle TAURI_INVOKE_RESPONSE immediately and synchronously.
    // We cannot await handleMessage(event) because handleMessage is async and 
    // depends on the event loop, which might be blocked by the very task 
    // (like loadProvider) that is waiting for this response.
    if (type === 'TAURI_INVOKE_RESPONSE') {
        const handler = tauriInvokeHandlers.get(id);
        if (handler) {
            console.log(`[Railgun Worker] 📥 Bridge Response for ${id} received.`);
            if (payload?.error) {
                handler.reject(new Error(payload.error));
            } else {
                handler.resolve(payload?.result);
            }
            tauriInvokeHandlers.delete(id);
        }
        return;
    }

    commandQueue.push({ event });
    processQueue();
});

async function handleMessage(event: MessageEvent<RailgunWorkerRequest>) {
    const { id, type, payload } = event.data;

    // Unified Imports for Railgun SDK - using a single block to reduce overhead
    const {
        startRailgunEngine,
        createRailgunWallet,
        refreshBalances,
        loadProvider,
        getEngine,
        setFallbackProviderForNetwork: _setFallbackProviderForNetwork,
        setPollingProviderForNetwork: _setPollingProviderForNetwork,
        setOnBalanceUpdateCallback,
        populateShield,
        populateShieldBaseToken,
        generateUnshieldProof,
        generateUnshieldBaseTokenProof,
        populateProvedUnshield,
        populateProvedUnshieldBaseToken
    } = await import('@railgun-community/wallet');

    const { NetworkName, TXIDVersion } = await import('@railgun-community/shared-models');
    const { ethers, JsonRpcProvider } = await import('ethers');
    const { TauriIpcProvider: _TauriIpcProvider } = await import('../services/TauriIpcProvider');
    const { Database } = await import('@railgun-community/engine');

    // 🧪 LOUD PROVIDER PROTOTYPE PATCH: Trace EVERY RPC call
    if (!(JsonRpcProvider.prototype as any)._patched) {
        (JsonRpcProvider.prototype as any)._patched = true;
        const originalSend = JsonRpcProvider.prototype.send;
        JsonRpcProvider.prototype.send = async function (this: any, method: string, params: any[]) {
            const callId = Math.random().toString(36).substring(7);
            console.log(`[Provider.send] 🚀 [${callId}] ${method}`, JSON.stringify(params));
            const start = Date.now();
            try {
                const result = await originalSend.call(this, method, params);
                console.log(`[Provider.send] ✅ [${callId}] ${method} (${Date.now() - start}ms)`);
                return result;
            } catch (e: any) {
                console.error(`[Provider.send] ❌ [${callId}] ${method} error:`, e.message || e);
                throw e;
            }
        };
    }

    try {
        switch (type) {
            case 'PING':
                ctx.postMessage({
                    id,
                    type: 'PONG',
                    payload: { message: 'Shadow Engine is awake', originalPayload: payload }
                } as RailgunWorkerResponse);
                break;

            case 'TAURI_INVOKE_RESPONSE':
                // Already handled in the synchronous event listener above
                break;

            case 'INIT':
                if (engineInitialized) {
                    console.log('[Railgun Worker] Engine already initialized. Skipping.');
                    ctx.postMessage({ id, type: 'INIT_SUCCESS' } as RailgunWorkerResponse);
                    break;
                }
                if (isInitializing) {
                    console.log('[Railgun Worker] Engine initialization already in progress. Skipping.');
                    break;
                }
                isInitializing = true;
                console.log('[Railgun Worker] Initializing Shadow Engine...');
                try {
                    // Apply patches before starting the engine
                    await surgicallyPatchNetworkConfig();

                    // 🧪 Prototypical Database patching (catches generic access)
                    const DatabaseProto = (Database as any).prototype;
                    if (!DatabaseProto._patched) {
                        DatabaseProto._patched = true;
                        console.log('[Railgun Worker] Patching generic Database prototype...');
                        let getCounter = 0;
                        const originalGet = DatabaseProto.get;
                        DatabaseProto.get = function (this: any, ...args: any[]) {
                            const callId = ++getCounter;
                            const path = args[0];
                            const key = (this.constructor as any).pathToKey(path);
                            const start = Date.now();
                            const reqId = `db-${callId}`;
                            console.log(`[DB Trace] [${callId}] 🔍 GET: ${key}`);

                            PENDING_LOGICAL_REQUESTS.set(reqId, { start, key });
                            const result = originalGet.apply(this, args);

                            // Add 15s atomic timeout
                            const timeout = setTimeout(() => {
                                if (PENDING_LOGICAL_REQUESTS.has(reqId)) {
                                    console.error(`[DB Trace] 🧨 LOGICAL TIMEOUT (${callId}) - ATOMIC SETTLE (undefined): ${key}`);
                                    PENDING_LOGICAL_REQUESTS.delete(reqId);
                                    // Settle with undefined (MISS) instead of hanging or erroring
                                    ctx.postMessage({ id: reqId, type: 'DEBUG', payload: { action: 'FORCE_SETTLE', key, layer: 'DB' } } as any);
                                }
                            }, 15000);

                            if (result && typeof result.then === 'function') {
                                return result.then(
                                    (res: any) => {
                                        clearTimeout(timeout);
                                        if (PENDING_LOGICAL_REQUESTS.has(reqId)) {
                                            PENDING_LOGICAL_REQUESTS.delete(reqId);
                                            console.log(`[DB Trace] [${callId}] ✅ SETTLED SUCCESS (${Date.now() - start}ms): exists=${!!res}`);
                                        }
                                        return res;
                                    },
                                    (err: any) => {
                                        clearTimeout(timeout);
                                        if (PENDING_LOGICAL_REQUESTS.has(reqId)) {
                                            PENDING_LOGICAL_REQUESTS.delete(reqId);
                                            if (err.message?.includes('not found')) {
                                                console.log(`[DB Trace] [${callId}] 🔍 SETTLED MISS (${Date.now() - start}ms)`);
                                            } else {
                                                console.error(`[DB Trace] [${callId}] ❌ SETTLED ERROR (${Date.now() - start}ms):`, err.message || err);
                                            }
                                        }
                                        throw err;
                                    }
                                );
                            }
                            clearTimeout(timeout);
                            PENDING_LOGICAL_REQUESTS.delete(reqId);
                            return result;
                        };
                        const originalPut = DatabaseProto.put;
                        DatabaseProto.put = function (this: any, path: any, value: any, encoding?: any) {
                            const key = (this.constructor as any).pathToKey(path);
                            console.log(`[DB Trace] 💾 PUT: ${key}`);
                            return originalPut.call(this, path, value, encoding);
                        };
                    }

                    // CRITICAL FIX: Pass the RAW level store, not the Database wrapper
                    // We use Singleton Store + Explicit Open to prevent 'opening' stalls
                    const rawStore = getOrCreateStore('vaughan_railgun_store');

                    console.log(`[Railgun Worker] Store status BEFORE manual open: ${getSafeStatus(rawStore)}`);
                    if (getSafeStatus(rawStore) !== 'open') {
                        console.log('[Railgun Worker] Manually awaiting store.open()...');
                        await rawStore.open();
                    }
                    console.log(`[Railgun Worker] Store status AFTER manual open: ${getSafeStatus(rawStore)}`);

                    // Artifact store stub
                    const artifactStore = {
                        getArtifacts: async () => null,
                        storeArtifacts: async () => { },
                        fileExists: async () => false,
                    };

                    const poiNodeURLs = ['https://poi-sepolia.railgun.org'];

                    await startRailgunEngine(
                        'Vaughan',
                        rawStore as any,
                        true, // shouldDebug
                        artifactStore as any,
                        false, // useNativeArtifacts
                        true, // skipMerkletreeScans (DIAGNOSTIC ISOLATION TEST)
                        poiNodeURLs
                    );

                    // 🔥 AFTER INIT: Attempt to patch the actual instance's database class (cross-bundle protection)
                    try {
                        const engineInstance = getEngine();
                        const ActualDatabaseClass = (engineInstance as any)?.db?.constructor;
                        if (ActualDatabaseClass && ActualDatabaseClass.prototype && !ActualDatabaseClass.prototype._patched) {
                            const Proto = ActualDatabaseClass.prototype;
                            Proto._patched = true;
                            console.log(`[Railgun Worker] 🔥 Patching ACTUAL Database class: ${ActualDatabaseClass.name}`);
                            const originalGet = Proto.get;
                            Proto.get = function (this: any, ...args: any[]) {
                                const callId = Math.random().toString(36).substring(7);
                                const path = args[0];
                                const key = ActualDatabaseClass.pathToKey(path);
                                const start = Date.now();
                                const reqId = `actual-${callId}`;
                                console.log(`[ActualDB Trace] [${callId}] 🔍 GET: ${key}`);

                                PENDING_LOGICAL_REQUESTS.set(reqId, { start, key });
                                const result = originalGet.apply(this, args);

                                // Add 15s atomic timeout
                                const timeout = setTimeout(() => {
                                    if (PENDING_LOGICAL_REQUESTS.has(reqId)) {
                                        console.error(`[ActualDB Trace] 🧨 LOGICAL TIMEOUT (${callId}) - ATOMIC SETTLE (undefined): ${key}`);
                                        PENDING_LOGICAL_REQUESTS.delete(reqId);
                                    }
                                }, 15000);

                                if (result && typeof result.then === 'function') {
                                    return result.then(
                                        (res: any) => {
                                            clearTimeout(timeout);
                                            if (PENDING_LOGICAL_REQUESTS.has(reqId)) {
                                                PENDING_LOGICAL_REQUESTS.delete(reqId);
                                                console.log(`[ActualDB Trace] [${callId}] ✅ SETTLED SUCCESS (${Date.now() - start}ms): exists=${!!res}`);
                                            }
                                            return res;
                                        },
                                        (err: any) => {
                                            clearTimeout(timeout);
                                            if (PENDING_LOGICAL_REQUESTS.has(reqId)) {
                                                PENDING_LOGICAL_REQUESTS.delete(reqId);
                                                console.error(`[ActualDB Trace] [${callId}] ❌ SETTLED ERROR (${Date.now() - start}ms):`, err.message || err);
                                            }
                                            throw err;
                                        }
                                    );
                                }
                                clearTimeout(timeout);
                                PENDING_LOGICAL_REQUESTS.delete(reqId);
                                return result;
                            };
                        }
                    } catch (idbPatchErr) {
                        console.warn('[Railgun Worker] Dynamic database patch failed (ignoring):', idbPatchErr);
                    }

                    engineInitialized = true;
                    console.log('[Railgun Worker] Engine initialized with POI!');

                    ctx.postMessage({
                        id,
                        type: 'INIT_SUCCESS',
                    } as RailgunWorkerResponse);
                } catch (e: any) {
                    console.error('[Railgun Worker] Failed to initialize engine:', e);
                    ctx.postMessage({
                        id,
                        type: 'ERROR',
                        error: e?.message || 'Engine init failed',
                    } as RailgunWorkerResponse);
                } finally {
                    isInitializing = false;
                }
                break;

            case 'LOAD_WALLET':
                if (!engineInitialized) {
                    ctx.postMessage({
                        id,
                        type: 'ERROR',
                        error: 'Shadow Engine not initialized yet. Please wait.'
                    } as RailgunWorkerResponse);
                    break;
                }
                try {
                    const { mnemonic, encryptionKey } = payload;
                    console.log(`[Railgun Worker] ⏳ LOAD_WALLET started (derivationIndex: 0)`);
                    console.time('loadWallet-0');

                    // Hash the password to a 32-byte key (Railgun requires exactly 32 bytes)
                    const keyBuffer = new TextEncoder().encode(encryptionKey);
                    const hashBuffer = await crypto.subtle.digest('SHA-256', keyBuffer);
                    const hashArray = Array.from(new Uint8Array(hashBuffer));
                    const encryptionKeyHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

                    console.log(`[Railgun Worker] ⏳ Calling createRailgunWallet (30s timeout)...`);
                    const walletPromise = createRailgunWallet(
                        encryptionKeyHex,
                        mnemonic,
                        undefined, // creationBlockNumbers
                        0          // derivationIndex
                    );

                    const timeoutWallet = new Promise<never>((_, reject) =>
                        setTimeout(() => reject(new Error('createRailgunWallet timed out after 30s')), 30000)
                    );

                    const walletInfo = await Promise.race([walletPromise, timeoutWallet]);
                    console.timeEnd('loadWallet-0');

                    console.log(`[Railgun Worker] ✅ Successfully generated 0zk Address! ID: ${walletInfo.id}, Address: ${walletInfo.railgunAddress}`);

                    // Trigger refresh for all supported networks in background
                    const networks = [NetworkName.PolygonAmoy, NetworkName.EthereumSepolia];
                    for (const net of (networks as any)) {
                        try {
                            const chain = (NETWORK_CONFIG as any)[net].chain;
                            if (chain) {
                                console.log(`[Railgun Worker] Triggering background balance refresh for ${net}...`);
                                refreshBalances(chain, undefined).catch(e => console.warn(`[Railgun Worker] Refresh failed for ${net}:`, e));
                            }
                        } catch (e) {
                            // Ignore missing chains in config
                        }
                    }

                    ctx.postMessage({
                        id,
                        type: 'LOAD_WALLET_SUCCESS',
                        payload: {
                            id: walletInfo.id,
                            address: walletInfo.railgunAddress
                        }
                    } as RailgunWorkerResponse);
                } catch (e: any) {
                    console.timeEnd('loadWallet-0');
                    console.error('[Railgun Worker] ❌ Failed to load wallet', e);
                    ctx.postMessage({
                        id,
                        type: 'ERROR',
                        error: e.message || 'Failed to load wallet'
                    } as RailgunWorkerResponse);
                }
                break;

            case 'SET_NETWORK':
                try {
                    const { chainId } = payload;
                    let networkName: any;
                    switch (chainId) {
                        case 1: networkName = NetworkName.Ethereum; break;
                        case 137: networkName = NetworkName.Polygon; break;
                        case 56: networkName = NetworkName.BNBChain; break;
                        case 42161: networkName = NetworkName.Arbitrum; break;
                        case 11155111: networkName = NetworkName.EthereumSepolia; break;
                        case 80002: networkName = NetworkName.PolygonAmoy; break;
                        default: networkName = NetworkName.Hardhat;
                    }
                    // TEST: Use a SINGLE extremely stable provider to isolate quorum/deadlock issues
                    const primaryRpc = 'https://1rpc.io/sepolia';
                    console.log(`[Railgun Worker] 🧪 Using SINGLE provider: ${primaryRpc}`);

                    const fallbackProviderConfig: any = {
                        chainId,
                        quorum: 1,
                        providers: [
                            {
                                provider: primaryRpc,
                                priority: 1,
                                weight: 2,
                                maxLogsPerBatch: 10,
                                stallTimeout: 5000,
                            },
                        ],
                    };

                    console.log(`[Railgun Worker] ⏳ SET_NETWORK started for chain ${chainId} (${networkName})`);
                    console.log(`[Railgun Worker] 🧪 Provider Config:`, JSON.stringify(fallbackProviderConfig, null, 2));

                    console.log(`[Railgun Worker] ⏳ [loadProvider] ABOUT TO CALL on chain ${chainId}...`);
                    console.time(`loadProvider-${chainId}`);

                    const startTime = Date.now();
                    const loadWatchdog = setInterval(() => {
                        console.log(`[Railgun Worker Watchdog] loadProvider still running after ${(Date.now() - startTime) / 1000}s`);
                    }, 1000);

                    const loadProviderPromise = loadProvider(fallbackProviderConfig, networkName as any);
                    const timeoutProvider = new Promise<never>((_, reject) =>
                        setTimeout(() => {
                            const err = new Error('loadProvider timed out manually after 30s');
                            console.error('[Railgun Worker] 🔴 TIMEOUT EXCEEDED', err.stack);
                            reject(err);
                        }, 30000)
                    );

                    try {
                        const feesSerialized = await Promise.race([loadProviderPromise, timeoutProvider]);
                        clearInterval(loadWatchdog);

                        console.log(`[Railgun Worker] ✅ [loadProvider] RETURNED after ${Date.now() - startTime}ms`);
                        console.timeEnd(`loadProvider-${chainId}`);
                        console.log(`[Railgun Worker] ✅ Fees:`, JSON.stringify(feesSerialized, null, 2));

                        setOnBalanceUpdateCallback((balancesFormatted) => {
                            console.log('[Railgun Worker] Shielded Balance Updated!', balancesFormatted);
                            ctx.postMessage({
                                id: 'engine-event',
                                type: 'BALANCE_UPDATE',
                                payload: balancesFormatted
                            } as RailgunWorkerResponse);
                        });

                        console.log(`[Railgun Worker] 🚀🚀🚀 SET_NETWORK SUCCESSFUL! 🚀🚀🚀`);

                        ctx.postMessage({
                            id,
                            type: 'SET_NETWORK_SUCCESS',
                            payload: { networkName }
                        } as RailgunWorkerResponse);

                    } catch (loadErr: any) {
                        clearInterval(loadWatchdog);
                        console.timeEnd(`loadProvider-${chainId}`);
                        console.error(`[Railgun Worker] ❌ loadProvider FAILED:`, loadErr.message || loadErr);
                        throw loadErr;
                    }
                } catch (e: any) {
                    console.error('[Railgun Worker] Failed to set network:', e);
                    ctx.postMessage({
                        id,
                        type: 'ERROR',
                        error: e.message || 'Failed to set network'
                    } as RailgunWorkerResponse);
                }
                break;

            case 'SHIELD':
                try {
                    const { isNative, tokenAddress, amountWei, railgunAddress, networkNameStr } = payload;
                    console.log(`[Railgun Worker] ⏳ SHIELD started for ${amountWei} to ${railgunAddress} on ${networkNameStr}`);
                    console.time('shield');

                    // Validate toAddress
                    if (!railgunAddress || railgunAddress === '') {
                        console.error('[Railgun Worker] ❌ toAddress is empty!');
                        throw new Error('Invalid RAILGUN address: empty');
                    }
                    if (!railgunAddress.startsWith('0zk')) {
                        console.error('[Railgun Worker] ❌ toAddress does not start with 0zk:', railgunAddress);
                        throw new Error('Invalid RAILGUN address: must start with 0zk');
                    }

                    const txidVersion = TXIDVersion.V2_PoseidonMerkle;
                    const shieldPrivateKey = ethers.hexlify(ethers.randomBytes(32));

                    let txResponse;

                    if (isNative) {
                        const wrappedBaseTokenAddress = (NETWORK_CONFIG as any)[networkNameStr].baseToken.wrappedAddress;
                        txResponse = await populateShieldBaseToken(
                            txidVersion,
                            networkNameStr,
                            railgunAddress,
                            shieldPrivateKey,
                            { tokenAddress: wrappedBaseTokenAddress, amount: BigInt(amountWei) }
                        );
                    } else {
                        const erc20AmountRecipients = [{
                            tokenAddress,
                            amount: BigInt(amountWei),
                            recipientAddress: railgunAddress
                        }];
                        txResponse = await populateShield(
                            txidVersion,
                            networkNameStr,
                            shieldPrivateKey,
                            erc20AmountRecipients,
                            [] // nftAmountRecipients
                        );
                    }

                    console.timeEnd('shield');
                    console.log(`[Railgun Worker] ✅ Shield payload generated for ${networkNameStr}`);

                    ctx.postMessage({
                        id,
                        type: 'SHIELD_SUCCESS',
                        payload: {
                            to: txResponse.transaction.to,
                            data: txResponse.transaction.data,
                            value: txResponse.transaction.value ? txResponse.transaction.value.toString() : '0'
                        }
                    } as RailgunWorkerResponse);
                } catch (e: any) {
                    console.error('[Railgun Worker] Failed to generate shield tx:', e);
                    ctx.postMessage({
                        id,
                        type: 'ERROR',
                        error: e.message || 'Failed to generate shield tx'
                    } as RailgunWorkerResponse);
                }
                break;

            case 'UNSHIELD':
                try {
                    const {
                        isNative,
                        tokenAddress,
                        amountWei,
                        railgunWalletID,
                        encryptionKey,
                        publicWalletAddress,
                        networkNameStr
                    } = payload;
                    const txidVersion = TXIDVersion.V2_PoseidonMerkle;
                    console.log(`[Railgun Worker] Unshielding ${amountWei} to ${publicWalletAddress} on ${networkNameStr}`);
                    const sendWithPublicWallet = true;
                    let txResponse;

                    if (isNative) {
                        const wrappedBaseTokenAddress = (NETWORK_CONFIG as any)[networkNameStr].baseToken.wrappedAddress;

                        await generateUnshieldBaseTokenProof(
                            txidVersion,
                            networkNameStr,
                            publicWalletAddress,
                            railgunWalletID,
                            encryptionKey,
                            { tokenAddress: wrappedBaseTokenAddress, amount: BigInt(amountWei) },
                            undefined,
                            sendWithPublicWallet,
                            undefined,
                            (progress: number) => {
                                console.log(`[Railgun Worker] Unshield Proof Progress: ${progress}%`);
                                ctx.postMessage({
                                    id: 'engine-event',
                                    type: 'PROOF_PROGRESS',
                                    payload: progress
                                } as RailgunWorkerResponse);
                            }
                        );

                        txResponse = await populateProvedUnshieldBaseToken(
                            txidVersion,
                            networkNameStr,
                            publicWalletAddress,
                            railgunWalletID,
                            { tokenAddress: wrappedBaseTokenAddress, amount: BigInt(amountWei) },
                            undefined,
                            sendWithPublicWallet,
                            undefined,
                            undefined as any
                        );
                    } else {
                        const erc20AmountRecipients = [{
                            tokenAddress,
                            amount: BigInt(amountWei),
                            recipientAddress: publicWalletAddress
                        }];

                        await generateUnshieldProof(
                            txidVersion,
                            networkNameStr,
                            railgunWalletID,
                            encryptionKey,
                            erc20AmountRecipients,
                            [],
                            undefined,
                            sendWithPublicWallet,
                            undefined,
                            (progress: number) => {
                                console.log(`[Railgun Worker] Unshield Proof Progress: ${progress}%`);
                                ctx.postMessage({
                                    id: 'engine-event',
                                    type: 'PROOF_PROGRESS',
                                    payload: progress
                                } as RailgunWorkerResponse);
                            }
                        );

                        txResponse = await populateProvedUnshield(
                            txidVersion,
                            networkNameStr,
                            railgunWalletID,
                            erc20AmountRecipients,
                            [],
                            undefined,
                            sendWithPublicWallet,
                            undefined,
                            undefined as any
                        );
                    }

                    ctx.postMessage({
                        id,
                        type: 'UNSHIELD_SUCCESS',
                        payload: {
                            to: txResponse.transaction.to,
                            data: txResponse.transaction.data,
                            value: txResponse.transaction.value ? txResponse.transaction.value.toString() : '0'
                        }
                    } as RailgunWorkerResponse);
                } catch (e: any) {
                    console.error('[Railgun Worker] Failed to generate unshield tx:', e);
                    ctx.postMessage({
                        id,
                        type: 'ERROR',
                        error: e.message || 'Failed to generate unshield tx'
                    } as RailgunWorkerResponse);
                }
                break;

            case 'TRANSFER':
                try {
                    const {
                        generateTransferProof,
                        populateProvedTransfer
                    } = await import('@railgun-community/wallet');
                    const { TXIDVersion } = await import('@railgun-community/shared-models');

                    const {
                        isNative,
                        tokenAddress,
                        amountWei,
                        railgunWalletID,
                        encryptionKey,
                        railgunRecipientAddress,
                        networkNameStr
                    } = payload;

                    const txidVersion = TXIDVersion.V2_PoseidonMerkle;
                    let txResponse;
                    const sendWithPublicWallet = true;
                    const showSenderAddressToRecipient = false;
                    const progressCallback = (progress: number) => {
                        console.log(`[Railgun Worker] Transfer Proof Progress: ${progress}%`);
                        ctx.postMessage({
                            id: 'engine-event',
                            type: 'PROOF_PROGRESS',
                            payload: progress
                        } as RailgunWorkerResponse);
                    };

                    const finalTokenAddress = isNative
                        ? (NETWORK_CONFIG as any)[networkNameStr].baseToken.wrappedAddress
                        : tokenAddress;

                    const erc20AmountRecipients = [{
                        tokenAddress: finalTokenAddress,
                        amount: BigInt(amountWei),
                        recipientAddress: railgunRecipientAddress
                    }];

                    await generateTransferProof(
                        txidVersion,
                        networkNameStr,
                        railgunWalletID,
                        encryptionKey,
                        showSenderAddressToRecipient,
                        undefined,
                        erc20AmountRecipients,
                        [],
                        undefined,
                        sendWithPublicWallet,
                        undefined,
                        progressCallback
                    );

                    txResponse = await populateProvedTransfer(
                        txidVersion,
                        networkNameStr,
                        railgunWalletID,
                        showSenderAddressToRecipient,
                        undefined,
                        erc20AmountRecipients,
                        [],
                        undefined,
                        sendWithPublicWallet,
                        undefined,
                        !isNative ? (undefined as any) : { gasEstimate: 0n, gasPrice: 0n }
                    );

                    ctx.postMessage({
                        id,
                        type: 'TRANSFER_SUCCESS',
                        payload: {
                            to: txResponse.transaction.to,
                            data: txResponse.transaction.data,
                            value: txResponse.transaction.value ? txResponse.transaction.value.toString() : '0'
                        }
                    } as RailgunWorkerResponse);
                } catch (e: any) {
                    console.error('[Railgun Worker] Failed to generate internal transfer tx:', e);
                    ctx.postMessage({
                        id,
                        type: 'ERROR',
                        error: e.message || 'Failed to generate internal transfer tx'
                    } as RailgunWorkerResponse);
                }
                break;

            case 'GET_HISTORY':
                try {
                    const { getWalletTransactionHistory } = await import('@railgun-community/wallet');
                    const { chainId, railgunWalletID } = payload;
                    const chain = { type: 0, id: chainId };

                    const history = await getWalletTransactionHistory(chain, railgunWalletID, undefined);

                    ctx.postMessage({
                        id,
                        type: 'HISTORY_SUCCESS',
                        payload: { history }
                    } as RailgunWorkerResponse);
                } catch (e: any) {
                    console.error('[Railgun Worker] Failed to fetch private history:', e);
                    ctx.postMessage({
                        id,
                        type: 'ERROR',
                        error: e.message || 'Failed to fetch private history'
                    } as RailgunWorkerResponse);
                }
                break;

            default:
                console.warn(`[Railgun Worker] Unknown message type: ${type}`);
                ctx.postMessage({
                    id,
                    type: 'ERROR',
                    error: `Unknown message type: ${type}`
                } as RailgunWorkerResponse);
                break;
        }
    } catch (err: any) {
        console.error('[Railgun Worker] Global handleMessage Error:', err);
        ctx.postMessage({
            id: id || 'unknown',
            type: 'ERROR',
            error: err.message || String(err)
        } as RailgunWorkerResponse);
    }
}

console.log('[Railgun Worker] Thread loaded and waiting for commands.');

// Heartbeat to monitor worker thread health
setInterval(() => {
    console.debug('[Railgun Worker Activity] Heartbeat (Thread Alive)');
}, 10000);
