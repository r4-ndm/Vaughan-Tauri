import { AbstractProvider, PerformActionRequest, Network } from 'ethers';
import { invoke } from '@tauri-apps/api/core';

/**
 * A custom Ethers.js v6 Provider that routes all network requests
 * through Tauri IPC to the Rust backend (Alloy).
 * 
 * This fulfills the Vaughan-Tauri strict 5-Layer architecture rule:
 * "No direct frontend-to-blockchain RPC calls. All network traffic
 * MUST pass through the Rust backend using Alloy."
 */
export class TauriIpcProvider extends AbstractProvider {
    private chainId: number;

    constructor(chainId: number) {
        // We pass 'any' network to the abstract provider since we handle
        // all resolution manually via Rust.
        super("any");
        this.chainId = chainId;
    }

    /**
     * Resolves the current network.
     */
    async _detectNetwork(): Promise<Network> {
        return Network.from(this.chainId);
    }

    /**
     * The core method where ethers v6 executes actions.
     * We serialize the request and send it via Tauri.
     */
    async perform(req: PerformActionRequest): Promise<any> {
        // Map Ethers' perform requests to standard JSON-RPC payloads
        // Since we want the Rust backend to handle generic JSON-RPC,
        // we'll format it as a standard eth_request.

        // Ethers v6 PerformActionRequest is an object with a `method` property and args.
        // We can use Tauri to invoke a generic 'eth_request' command in Rust.
        try {
            const result = await invoke('eth_request', {
                chainId: this.chainId,
                request: req
            });
            return result;
        } catch (error: any) {
            console.error('[TauriIpcProvider] RPC Call Failed over IPC:', req.method, error);
            throw error;
        }
    }

    /**
     * Helper to bypass the abstract perform logic and send raw RPC
     * if the engine requires it.
     */
    async send(method: string, params: Array<any> | Record<string, any>): Promise<any> {
        try {
            return await invoke('eth_request', {
                chainId: this.chainId,
                method,
                params
            });
        } catch (error: any) {
            console.error('[TauriIpcProvider] Raw RPC Send Failed over IPC:', method, error);
            throw error;
        }
    }
}
