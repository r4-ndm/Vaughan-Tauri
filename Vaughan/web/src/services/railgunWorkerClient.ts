import { RailgunWorkerRequest, RailgunWorkerResponse } from '../workers/railgun.worker';
import { PreferencesService } from "./tauri";

class RailgunWorkerClient {
    private worker: Worker;
    private messageHandlers: Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>;
    private msgIdCounter: number = 0;
    private engineInitialized: boolean = false;

    public railgunWalletID?: string;
    public railgunAddress?: string;

    constructor() {
        this.messageHandlers = new Map();
        // Use Vite's worker import syntax
        this.worker = new Worker(new URL('../workers/railgun.worker.ts', import.meta.url), {
            type: 'module',
        });

        this.worker.addEventListener('message', this.handleMessage.bind(this));
        this.worker.addEventListener('error', this.handleError.bind(this));

        console.log('[RailgunClient] Shadow Engine Worker initialized.');
    }

    private balanceListeners: Array<(balances: any) => void> = [];
    private proofProgressListeners: Array<(progress: number) => void> = [];

    public onProofProgress(callback: (progress: number) => void) {
        this.proofProgressListeners.push(callback);
        return () => {
            this.proofProgressListeners = this.proofProgressListeners.filter(l => l !== callback);
        };
    }

    private handleMessage(event: MessageEvent<RailgunWorkerResponse>) {
        const { id, type, payload, error } = event.data;

        // Intercept unsolicited push events from the Engine
        if (id === 'engine-event') {
            if (type === 'BALANCE_UPDATE') {
                this.balanceListeners.forEach(listener => listener(payload));
            } else if (type === 'PROOF_PROGRESS') {
                this.proofProgressListeners.forEach(listener => listener(payload));
            }
            return;
        }

        const handler = this.messageHandlers.get(id);

        if (!handler) {
            console.warn(`[RailgunClient] Received message for unknown ID: ${id}`);
            return;
        }

        if (type === 'ERROR') {
            handler.reject(new Error(error || 'Worker returned an error'));
        } else {
            handler.resolve({ type, payload });
        }

        this.messageHandlers.delete(id);
    }

    private handleError(event: ErrorEvent) {
        console.error('[RailgunClient] Shadow Engine Worker threw a global error:', event.message);
    }

    private sendRequest<T = any>(type: RailgunWorkerRequest['type'], payload?: any): Promise<{ type: string; payload: T }> {
        return new Promise((resolve, reject) => {
            const id = (++this.msgIdCounter).toString();
            this.messageHandlers.set(id, { resolve, reject });

            const req: RailgunWorkerRequest = { id, type, payload };
            this.worker.postMessage(req);
        });
    }

    // --- Public API ---

    public async ping(data?: any): Promise<any> {
        const res = await this.sendRequest('PING', data);
        return res.payload;
    }

    public async initEngine(): Promise<void> {
        if (this.engineInitialized) return;

        try {
            const prefs = await PreferencesService.getUserPreferences();
            if (!prefs.privacy_enabled) {
                console.log('[RailgunClient] Skipping Railgun engine initialization - Privacy is disabled in settings.');
                return;
            }
        } catch (e) {
            console.warn('[RailgunClient] Failed to fetch preferences, defaulting to enabled', e);
        }

        console.log('[RailgunClient] Initializing Shadow Engine...');
        try {
            // Timeout after 15s — WASM loading can hang if files aren't served correctly
            const initPromise = this.sendRequest('INIT');
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Engine init timed out after 15s')), 15000)
            );
            await Promise.race([initPromise, timeoutPromise]);
            this.engineInitialized = true;
            console.log('[RailgunClient] Shadow Engine initialized successfully.');
        } catch (err) {
            console.warn('[RailgunClient] Shadow Engine failed to initialize. Privacy features will be unavailable.', err);
            // Don't throw — wallet should still work without privacy features
        }
    }

    public async loadWallet(password: string): Promise<{ id: string; address: string }> {
        // Try to init engine first, but don't block wallet unlock if it fails
        await this.initEngine();

        if (!this.engineInitialized) {
            console.warn('[RailgunClient] Skipping Railgun wallet load — engine not initialized.');
            return { id: '', address: '' };
        }

        console.log('[RailgunClient] Fetching Railgun Mnemonic from Citadel...');
        const { invoke } = await import('@tauri-apps/api/core');

        // 1. Ask Rust to derive the 24-word ZK mnemonic from the master seed
        const mnemonic = await invoke<string>('get_railgun_mnemonic', { password });

        // 2. Pass it directly into the Shadow Engine (WebWorker)
        console.log('[RailgunClient] Mnemonic retrieved, pushing to Worker...');
        const res = await this.sendRequest('LOAD_WALLET', { mnemonic, encryptionKey: password });

        this.railgunWalletID = res.payload.id;
        this.railgunAddress = res.payload.address;

        return res.payload;
    }

    // Railgun-supported chain IDs (+ PulseChain custom support)
    private static SUPPORTED_CHAINS = new Set([1, 56, 137, 42161, 369, 943]);

    public async setNetwork(chainId: number): Promise<void> {
        if (!RailgunWorkerClient.SUPPORTED_CHAINS.has(chainId)) {
            console.warn(`[RailgunClient] Chain ${chainId} is not supported by Railgun. Privacy features disabled for this network.`);
            return;
        }
        // Fire-and-forget engine init + network setup — don't block the UI
        this.initEngine().then(async () => {
            if (!this.engineInitialized) return;
            try {
                console.log(`[RailgunClient] Instructing Shadow Engine to lock onto chain ${chainId}...`);
                await this.sendRequest('SET_NETWORK', { chainId });
            } catch (err) {
                console.warn(`[RailgunClient] Failed to set Railgun network for chain ${chainId}:`, err);
            }
        });
    }

    /**
     * Subscribe to realtime Shielded Balance Updates from the Engine.
     * @returns an unsubscribe function
     */
    public onBalanceUpdate(callback: (balances: any) => void): () => void {
        this.balanceListeners.push(callback);
        return () => {
            this.balanceListeners = this.balanceListeners.filter(c => c !== callback);
        };
    }

    /**
     * Ask the Shadow Engine to generate a raw Shield transaction payload.
     */
    public async populateShieldTransaction(
        networkNameStr: string,
        isNative: boolean,
        tokenAddress: string,
        amountWei: string,
        railgunAddress: string
    ): Promise<{ to: string; data: string; value: string }> {
        console.log(`[RailgunClient] Instructing Shadow Engine to populate a Shield payload...`);
        const res = await this.sendRequest('SHIELD', {
            networkNameStr,
            isNative,
            tokenAddress,
            amountWei,
            railgunAddress
        });
        return res.payload;
    }

    /**
     * Ask the Shadow Engine to generate a ZK Proof and Unshield payload.
     * Note: This will take several seconds on the client machine!
     */
    public async generateUnshieldTransaction(
        networkNameStr: string,
        isNative: boolean,
        tokenAddress: string,
        amountWei: string,
        publicWalletAddress: string,
        encryptionKey: string
    ): Promise<{ to: string; data: string; value: string }> {
        if (!this.railgunWalletID) throw new Error("Wallet not loaded");

        console.log(`[RailgunClient] Instructing Shadow Engine to forge an UNSHIELD proof...`);
        const res = await this.sendRequest('UNSHIELD', {
            networkNameStr,
            isNative,
            tokenAddress,
            amountWei,
            publicWalletAddress,
            railgunWalletID: this.railgunWalletID,
            encryptionKey
        });
        return res.payload;
    }

    /**
     * Ask the Shadow Engine to generate a ZK Proof and completely blinded Transfer payload.
     * Note: This will take several seconds on the client machine!
     */
    public async generateTransferTransaction(
        networkNameStr: string,
        isNative: boolean,
        tokenAddress: string,
        amountWei: string,
        railgunRecipientAddress: string,
        encryptionKey: string
    ): Promise<{ to: string; data: string; value: string }> {
        if (!this.railgunWalletID) throw new Error("Wallet not loaded");

        console.log(`[RailgunClient] Instructing Shadow Engine to forge an internal TRANSFER proof...`);
        const res = await this.sendRequest('TRANSFER', {
            networkNameStr,
            isNative,
            tokenAddress,
            amountWei,
            railgunRecipientAddress,
            railgunWalletID: this.railgunWalletID,
            encryptionKey
        });
        return res.payload;
    }

    /**
     * Ask the Shadow Engine to read the local IndexedDB and return the decrypted Shielded Transaction History.
     */
    public async getHistory(chainId: number): Promise<any[]> {
        if (!this.railgunWalletID) throw new Error("Wallet not loaded");

        console.log(`[RailgunClient] Fetching Shielded History from Engine...`);
        const res = await this.sendRequest('GET_HISTORY', {
            chainId,
            railgunWalletID: this.railgunWalletID
        });
        return res.payload.history;
    }
}

// Export as a singleton so the app shares one Railgun Engine instance
export const railgunClient = new RailgunWorkerClient();
