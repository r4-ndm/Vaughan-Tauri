import { AbstractProvider, PerformActionRequest, Network } from 'ethers';

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
    private invokeFn: (cmd: string, args: any) => Promise<any>;

    constructor(chainId: number, invokeFn?: (cmd: string, args: any) => Promise<any>) {
        // We pass 'any' network to the abstract provider since we handle
        // all resolution manually via Rust.
        super("any");
        this.chainId = chainId;

        if (invokeFn) {
            this.invokeFn = invokeFn;
        } else {
            // Default to window.__TAURI__.invoke if available (main thread)
            this.invokeFn = async (cmd: string, args: any) => {
                const { invoke } = await import('@tauri-apps/api/core');
                return invoke(cmd, args);
            };
        }
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
        try {
            // Ethers.js v6 PerformActionRequest has all data flattened
            // We need to map it back to standard JSON-RPC if we want to use 'raw_request' on the backend
            const methodMap: Record<string, string> = {
                getBlockNumber: 'eth_blockNumber',
                getGasPrice: 'eth_gasPrice',
                getBalance: 'eth_getBalance',
                getTransactionCount: 'eth_getTransactionCount',
                getCode: 'eth_getCode',
                getStorageAt: 'eth_getStorageAt',
                call: 'eth_call',
                estimateGas: 'eth_estimateGas',
                getBlock: 'eth_getBlockByNumber',
                getTransaction: 'eth_getTransactionByHash',
                getTransactionReceipt: 'eth_getTransactionReceipt',
                sendTransaction: 'eth_sendRawTransaction',
                broadcastTransaction: 'eth_sendRawTransaction',
                chainId: 'eth_chainId'
            };

            const mappedMethod = methodMap[req.method] || req.method;
            const params: any[] = [];

            // Robust param extraction for common methods
            switch (req.method as string) {
                case 'getBalance':
                case 'getTransactionCount':
                case 'getCode':
                    params.push((req as any).address);
                    params.push((req as any).blockTag || 'latest');
                    break;
                case 'getStorageAt':
                    params.push((req as any).address);
                    params.push((req as any).position);
                    params.push((req as any).blockTag || 'latest');
                    break;
                case 'call':
                case 'estimateGas':
                    params.push((req as any).transaction);
                    if (req.method === 'call') params.push((req as any).blockTag || 'latest');
                    break;
                case 'getBlock':
                    if ((req as any).blockHash) {
                        params.push((req as any).blockHash);
                        params.push((req as any).includeTransactions || false);
                    } else {
                        params.push((req as any).blockTag || 'latest');
                        params.push((req as any).includeTransactions || false);
                    }
                    break;
                case 'getTransaction':
                case 'getTransactionReceipt':
                    params.push((req as any).transactionHash);
                    break;
                case 'broadcastTransaction':
                    params.push((req as any).signedTransaction);
                    break;
                default:
                    // If we don't know the mapping, fallback to whatever is in the request
                    if ((req as any).params) params.push(...(req as any).params);
            }

            console.log(`[TauriIpcProvider] Routing: ${req.method} -> ${mappedMethod}`, params);

            const result = await this.invokeFn('eth_request', {
                chainId: this.chainId,
                method: mappedMethod,
                params
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
            return await this.invokeFn('eth_request', {
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
