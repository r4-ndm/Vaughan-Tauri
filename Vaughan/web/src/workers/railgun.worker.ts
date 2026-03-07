/// <reference lib="webworker" />
import { Buffer } from 'buffer';
import { BrowserLevel } from 'browser-level';

// Ensure Buffer is available globally in the worker context
if (typeof (globalThis as any).Buffer === 'undefined') {
    (globalThis as any).Buffer = Buffer;
}

// Define the shape of messages sent TO the worker
export type RailgunWorkerRequest = {
    id: string;
    type: 'INIT' | 'PING' | 'LOAD_WALLET' | 'SET_NETWORK' | 'SHIELD' | 'UNSHIELD' | 'GET_HISTORY' | 'TRANSFER';
    payload?: any;
};

// Define the shape of messages sent FROM the worker
export type RailgunWorkerResponse = {
    id: string;
    type: 'INIT_SUCCESS' | 'PONG' | 'ERROR' | 'LOAD_WALLET_SUCCESS' | 'SET_NETWORK_SUCCESS' | 'BALANCE_UPDATE' | 'SHIELD_SUCCESS' | 'UNSHIELD_SUCCESS' | 'PROOF_PROGRESS' | 'HISTORY_SUCCESS' | 'TRANSFER_SUCCESS';
    payload?: any;
    error?: string;
};

const ctx: Worker = self as any;

ctx.addEventListener('message', async (event: MessageEvent<RailgunWorkerRequest>) => {
    const { id, type, payload } = event.data;

    try {
        switch (type) {
            case 'PING':
                ctx.postMessage({
                    id,
                    type: 'PONG',
                    payload: { message: 'Shadow Engine is awake', originalPayload: payload }
                } as RailgunWorkerResponse);
                break;

            case 'INIT':
                console.log('[Railgun Worker] Initializing Shadow Engine...');
                try {
                    const { startRailgunEngine } = await import('@railgun-community/wallet');
                    const db = new BrowserLevel('vaughan_railgun_store');

                    // Artifact store stub (production would fetch zkey/wasm via Tauri)
                    const artifactStore = {
                        getArtifacts: async () => null,
                        storeArtifacts: async () => { },
                        fileExists: async () => false,
                    };

                    // POI aggregator node (required for Ethereum mainnet)
                    const poiNodeURLs = ['https://ppoi-agg.horsewithsixlegs.xyz'];

                    await startRailgunEngine(
                        'VaughanWallet',       // walletSource
                        db as any,             // db
                        true,                  // shouldDebug
                        artifactStore as any,  // artifactStore
                        false,                 // useNativeArtifacts
                        false,                 // skipMerkletreeScans
                        poiNodeURLs,           // poiNodeURLs
                    );

                    console.log('[Railgun Worker] Engine initialized with POI!');
                    ctx.postMessage({
                        id,
                        type: 'INIT_SUCCESS',
                    } as RailgunWorkerResponse);
                } catch (e: any) {
                    console.error('[Railgun Worker] Failed to initialize engine:', e);
                    // Always post ERROR so the client's sendRequest Promise resolves
                    ctx.postMessage({
                        id,
                        type: 'ERROR',
                        error: e?.message || 'Engine init failed',
                    } as RailgunWorkerResponse);
                }
                break;

            case 'LOAD_WALLET':
                console.log('[Railgun Worker] Received Command: LOAD_WALLET');
                try {
                    const { mnemonic, encryptionKey } = payload;

                    // Hash the password to a 32-byte key (Railgun requires exactly 32 bytes)
                    const keyBuffer = new TextEncoder().encode(encryptionKey);
                    const hashBuffer = await crypto.subtle.digest('SHA-256', keyBuffer);
                    const hashArray = Array.from(new Uint8Array(hashBuffer));
                    const encryptionKeyHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

                    // Import wallet SDK
                    const { createRailgunWallet } = await import('@railgun-community/wallet');

                    // Create the wallet instance in the engine
                    const walletInfo = await createRailgunWallet(
                        encryptionKeyHex,
                        mnemonic,
                        undefined, // creationBlockNumbers
                        0         // derivationIndex
                    );

                    console.log(`[Railgun Worker] Successfully generated 0zk Address! ID: ${walletInfo.id}`);

                    ctx.postMessage({
                        id,
                        type: 'LOAD_WALLET_SUCCESS',
                        payload: {
                            id: walletInfo.id,
                            address: walletInfo.railgunAddress
                        }
                    } as RailgunWorkerResponse);
                } catch (e: any) {
                    console.error('[Railgun Worker] Failed to load wallet', e);
                    throw e;
                }
                break;

            case 'SET_NETWORK':
                console.log(`[Railgun Worker] Received Command: SET_NETWORK for Chain ID ${payload.chainId}`);
                try {
                    const { chainId } = payload;
                    const { loadProvider, setOnBalanceUpdateCallback } = await import('@railgun-community/wallet');
                    const { NetworkName } = await import('@railgun-community/shared-models');
                    const { TauriIpcProvider } = await import('../services/TauriIpcProvider');

                    // 1. Initialize our custom Tauri IPC Provider (rust-bound)
                    const provider = new TauriIpcProvider(chainId);

                    // 2. Map standard EVM Chain ID to Railgun NetworkName
                    // Note: Railgun officially supports specific networks. We handle gracefully.
                    let networkName;
                    switch (chainId) {
                        case 1: networkName = NetworkName.Ethereum; break;
                        case 137: networkName = NetworkName.Polygon; break;
                        case 56: networkName = NetworkName.BNBChain; break;
                        case 42161: networkName = NetworkName.Arbitrum; break;
                        case 369:
                        case 943:
                            // Custom networks require custom configurations in Railgun,
                            // stubbing with Hardhat/localhost equivalent for scaffold.
                            networkName = NetworkName.Hardhat;
                            break;
                        default:
                            networkName = NetworkName.Hardhat;
                    }

                    // 3. Build the FallbackProviderJsonConfig with real public RPCs
                    // Two providers with weight 1 each = total weight 2 (quorum satisfied)
                    const rpcUrlsByChain: Record<number, string[]> = {
                        1: ['http://localhost:1420/rpc/eth', 'http://localhost:1420/rpc/eth2'],
                        137: ['http://localhost:1420/rpc/polygon', 'http://localhost:1420/rpc/polygon2'],
                        56: ['http://localhost:1420/rpc/bsc', 'http://localhost:1420/rpc/bsc2'],
                        42161: ['http://localhost:1420/rpc/arb', 'http://localhost:1420/rpc/arb2'],
                        369: ['http://localhost:1420/rpc/pulse', 'http://localhost:1420/rpc/pulse2'],
                        943: ['http://localhost:1420/rpc/pulse-test', 'http://localhost:1420/rpc/pulse-test2'],
                    };
                    const rpcUrls = rpcUrlsByChain[chainId] || ['https://eth.llamarpc.com', 'https://ethereum.publicnode.com'];

                    const fallbackProviderConfig = {
                        chainId,
                        providers: rpcUrls.map((url, i) => ({
                            provider: url,
                            priority: i + 1,
                            weight: 1,
                            maxLogsPerBatch: 1,
                            stallTimeout: 2500,
                        }))
                    };

                    const { setFallbackProviderForNetwork, setPollingProviderForNetwork } = await import('@railgun-community/wallet');

                    await loadProvider(fallbackProviderConfig as any, networkName, 15000);

                    // Hot-swap the internal Provider state to use our Rust bridge!
                    setFallbackProviderForNetwork(networkName, provider as any);
                    setPollingProviderForNetwork(networkName, provider as any);

                    // 4. Hook up the Balance Update scanner sequence
                    setOnBalanceUpdateCallback((balancesFormatted) => {
                        console.log('[Railgun Worker] Shielded Balance Updated!', balancesFormatted);
                        ctx.postMessage({
                            id: 'engine-event',
                            type: 'BALANCE_UPDATE',
                            payload: balancesFormatted
                        } as RailgunWorkerResponse);
                    });

                    console.log(`[Railgun Worker] Engine locked onto network: ${networkName}`);

                    ctx.postMessage({
                        id,
                        type: 'SET_NETWORK_SUCCESS',
                        payload: { networkName }
                    } as RailgunWorkerResponse);

                } catch (e: any) {
                    console.error('[Railgun Worker] Failed to set network:', e);
                    throw e;
                }
                break;

            case 'SHIELD':
                console.log(`[Railgun Worker] Received Command: SHIELD`);
                try {
                    const { populateShield, populateShieldBaseToken } = await import('@railgun-community/wallet');
                    const { TXIDVersion } = await import('@railgun-community/shared-models');
                    const { ethers } = await import('ethers');

                    const { isNative, tokenAddress, amountWei, railgunAddress, networkNameStr } = payload;
                    const txidVersion = TXIDVersion.V2_PoseidonMerkle;
                    const shieldPrivateKey = ethers.hexlify(ethers.randomBytes(32));

                    let txResponse;

                    if (isNative) {
                        // For native (ETH/BNB etc), Railgun wraps it automatically via the wrapper contract.
                        // We must provide the WETH (or WBNB, etc) token address for the specific network.
                        txResponse = await populateShieldBaseToken(
                            txidVersion,
                            networkNameStr,
                            railgunAddress,
                            shieldPrivateKey,
                            { tokenAddress, amount: BigInt(amountWei) }
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
                    throw e;
                }
                break;

            case 'UNSHIELD':
                console.log(`[Railgun Worker] Received Command: UNSHIELD`);
                try {
                    const {
                        generateUnshieldProof,
                        generateUnshieldBaseTokenProof,
                        populateProvedUnshield,
                        populateProvedUnshieldBaseToken
                    } = await import('@railgun-community/wallet');
                    const { TXIDVersion } = await import('@railgun-community/shared-models');

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
                    const sendWithPublicWallet = true; // Phase 4.4.2 Option 1: Self-Broadcasting
                    let txResponse;

                    if (isNative) {
                        console.log('[Railgun Worker] Generating Unshield Proof for Native Token...');
                        await generateUnshieldBaseTokenProof(
                            txidVersion,
                            networkNameStr,
                            publicWalletAddress,
                            railgunWalletID,
                            encryptionKey,
                            { tokenAddress, amount: BigInt(amountWei) },
                            undefined, // broadcasterFeeERC20AmountRecipient
                            sendWithPublicWallet,
                            undefined, // overallBatchMinGasPrice
                            (progress: number) => {
                                console.log(`[Railgun Worker] Unshield Proof Progress: ${progress}%`);
                                ctx.postMessage({
                                    id: 'engine-event',
                                    type: 'PROOF_PROGRESS',
                                    payload: progress
                                } as RailgunWorkerResponse);
                            }
                        );

                        console.log('[Railgun Worker] Populating Proved Native Unshield...');
                        txResponse = await populateProvedUnshieldBaseToken(
                            txidVersion,
                            networkNameStr,
                            publicWalletAddress,
                            railgunWalletID,
                            { tokenAddress, amount: BigInt(amountWei) },
                            undefined, // broadcasterFee
                            sendWithPublicWallet,
                            undefined, // overallBatchMinGasPrice
                            undefined as any // gasDetails
                        );
                    } else {
                        console.log('[Railgun Worker] Generating Unshield Proof for ERC20...');
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
                            [], // nftAmountRecipients
                            undefined, // broadcasterFee
                            sendWithPublicWallet,
                            undefined, // overallBatchMinGasPrice
                            (progress: number) => {
                                console.log(`[Railgun Worker] Unshield Proof Progress: ${progress}%`);
                                ctx.postMessage({
                                    id: 'engine-event',
                                    type: 'PROOF_PROGRESS',
                                    payload: progress
                                } as RailgunWorkerResponse);
                            }
                        );

                        console.log('[Railgun Worker] Populating Proved ERC20 Unshield...');
                        txResponse = await populateProvedUnshield(
                            txidVersion,
                            networkNameStr,
                            railgunWalletID,
                            erc20AmountRecipients,
                            [], // nftAmountRecipients
                            undefined, // broadcasterFee
                            sendWithPublicWallet,
                            undefined, // overallBatchMinGasPrice
                            undefined as any // gasDetails
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
                    throw e;
                }
                break;

            case 'TRANSFER':
                console.log(`[Railgun Worker] Received Command: TRANSFER`);
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
                    const sendWithPublicWallet = true; // Use the relayer logic standard fallback
                    const showSenderAddressToRecipient = false;
                    const memoText = undefined;
                    const broadcasterFeeERC20AmountRecipient = undefined;
                    const overallBatchMinGasPrice = undefined;
                    const progressCallback = (progress: number) => {
                        console.log(`[Railgun Worker] Transfer Proof Progress: ${progress}%`);
                        ctx.postMessage({
                            id: 'engine-event',
                            type: 'PROOF_PROGRESS',
                            payload: progress
                        } as RailgunWorkerResponse);
                    };

                    const erc20AmountRecipients = [{
                        tokenAddress,
                        amount: BigInt(amountWei),
                        recipientAddress: railgunRecipientAddress
                    }];
                    const nftAmountRecipients: any[] = [];

                    console.log('[Railgun Worker] Generating Internal Transfer Proof...');
                    await generateTransferProof(
                        txidVersion,
                        networkNameStr,
                        railgunWalletID,
                        encryptionKey,
                        showSenderAddressToRecipient,
                        memoText,
                        erc20AmountRecipients,
                        nftAmountRecipients,
                        broadcasterFeeERC20AmountRecipient,
                        sendWithPublicWallet,
                        overallBatchMinGasPrice,
                        progressCallback
                    );

                    console.log('[Railgun Worker] Populating Proved Internal Transfer...');
                    txResponse = await populateProvedTransfer(
                        txidVersion,
                        networkNameStr,
                        railgunWalletID,
                        showSenderAddressToRecipient,
                        memoText,
                        erc20AmountRecipients,
                        nftAmountRecipients,
                        broadcasterFeeERC20AmountRecipient,
                        sendWithPublicWallet,
                        overallBatchMinGasPrice,
                        !isNative ? (undefined as any) : { gasEstimate: 0n, gasPrice: 0n } // Fallback for GasDetails if enforced
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
                    throw e;
                }
                break;

            case 'GET_HISTORY':
                try {
                    const { getWalletTransactionHistory } = await import('@railgun-community/wallet');
                    const { chainId, railgunWalletID } = payload;

                    if (!chainId || !railgunWalletID) {
                        throw new Error("Missing required parameters: chainId, railgunWalletID");
                    }

                    // For EVM logic, type = 0.
                    const chain = { type: 0, id: chainId };

                    const history = await getWalletTransactionHistory(chain, railgunWalletID, undefined);

                    ctx.postMessage({
                        id,
                        type: 'HISTORY_SUCCESS',
                        payload: { history }
                    } as RailgunWorkerResponse);
                } catch (e: any) {
                    console.error('[Railgun Worker] Failed to fetch private history:', e);
                    throw e;
                }
                break;

            default:
                console.warn(`[Railgun Worker] Unknown message type: ${type}`);
                ctx.postMessage({
                    id,
                    type: 'ERROR',
                    error: `Unknown message type: ${type}`
                } as RailgunWorkerResponse);
        }
    } catch (err: any) {
        ctx.postMessage({
            id,
            type: 'ERROR',
            error: err.message || 'Unknown error in worker'
        } as RailgunWorkerResponse);
    }
});

console.log('[Railgun Worker] Thread loaded and waiting for commands.');
