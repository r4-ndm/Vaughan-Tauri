/**
 * WalletConnect Service
 * 
 * Manages WalletConnect v2 sessions and request handling
 * Maps WC requests to existing Tauri backend commands
 */

import { Core } from '@walletconnect/core';
import { Web3Wallet } from '@walletconnect/web3wallet';
import type { Web3WalletTypes } from '@walletconnect/web3wallet';
import { buildApprovedNamespaces, getSdkError } from '@walletconnect/utils';
import { invoke } from '@tauri-apps/api/core';

// WalletConnect Project ID (from https://cloud.walletconnect.com)
const PROJECT_ID = 'afd4137784d97fd3cc85a0cb81000967';

// Supported chains
const SUPPORTED_CHAINS = ['eip155:1', 'eip155:369']; // Ethereum, PulseChain

// Supported methods (EIP-1193)
const SUPPORTED_METHODS = [
  'eth_sendTransaction',
  'eth_signTransaction',
  'eth_sign',
  'personal_sign',
  'eth_signTypedData',
  'eth_signTypedData_v4',
  'wallet_switchEthereumChain',
  'wallet_addEthereumChain',
];

// Supported events
const SUPPORTED_EVENTS = ['chainChanged', 'accountsChanged'];

export interface WCSession {
  topic: string;
  peer: {
    metadata: {
      name: string;
      description: string;
      url: string;
      icons: string[];
    };
  };
  namespaces: Record<string, any>;
  expiry: number;
}

export interface WCRequest {
  id: number;
  topic: string;
  params: {
    request: {
      method: string;
      params: any;
    };
    chainId: string;
  };
}

/**
 * WalletConnect Service Class
 */
export class WalletConnectService {
  private web3wallet: InstanceType<typeof Web3Wallet> | null = null;
  private initialized = false;
  private currentAccount: string | null = null;
  private currentChainId: number | null = null;

  /**
   * Initialize WalletConnect
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('[WC] Already initialized');
      return;
    }

    try {
      console.log('[WC] Initializing...');

      // Create core
      const core = new Core({
        projectId: PROJECT_ID,
      });

      // Create Web3Wallet
      this.web3wallet = await Web3Wallet.init({
        core: core as any, // Type cast to work around dependency version mismatch
        metadata: {
          name: 'Vaughan Wallet',
          description: 'Multi-chain crypto wallet',
          url: 'https://vaughan.io',
          icons: ['https://vaughan.io/icon.png'],
        },
      });

      // Setup event listeners
      this.setupEventListeners();

      this.initialized = true;
      console.log('[WC] Initialized successfully');
    } catch (error) {
      console.error('[WC] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Setup WalletConnect event listeners
   */
  private setupEventListeners(): void {
    if (!this.web3wallet) return;

    // Session proposal
    this.web3wallet.on('session_proposal', this.onSessionProposal.bind(this));

    // Session request
    this.web3wallet.on('session_request', this.onSessionRequest.bind(this));

    // Session delete
    this.web3wallet.on('session_delete', this.onSessionDelete.bind(this));

    console.log('[WC] Event listeners setup');
  }

  /**
   * Handle session proposal
   */
  private async onSessionProposal(
    proposal: Web3WalletTypes.SessionProposal
  ): Promise<void> {
    console.log('[WC] Session proposal received:', proposal);

    try {
      // Get current account and chain
      const account = await this.getCurrentAccount();
      const chainId = await this.getCurrentChainId();

      if (!account || !chainId) {
        throw new Error('No active account or chain');
      }

      // Build approved namespaces
      const approvedNamespaces = buildApprovedNamespaces({
        proposal: proposal.params,
        supportedNamespaces: {
          eip155: {
            chains: SUPPORTED_CHAINS,
            methods: SUPPORTED_METHODS,
            events: SUPPORTED_EVENTS,
            accounts: SUPPORTED_CHAINS.map(
              (chain) => `${chain}:${account}`
            ),
          },
        },
      });

      // Approve session
      const session = await this.web3wallet!.approveSession({
        id: proposal.id,
        namespaces: approvedNamespaces,
      });

      console.log('[WC] Session approved:', session);

      // Emit event for UI
      window.dispatchEvent(
        new CustomEvent('wc_session_approved', { detail: session })
      );
    } catch (error) {
      console.error('[WC] Session approval failed:', error);

      // Reject session
      await this.web3wallet!.rejectSession({
        id: proposal.id,
        reason: getSdkError('USER_REJECTED'),
      });

      // Emit event for UI
      window.dispatchEvent(
        new CustomEvent('wc_session_rejected', { detail: error })
      );
    }
  }

  /**
   * Handle session request
   */
  private async onSessionRequest(event: WCRequest): Promise<void> {
    console.log('[WC] Session request received:', event);

    const { topic, id, params } = event;
    const { request, chainId } = params;
    const { method, params: methodParams } = request;

    try {
      // Map WC request to Tauri command
      const result = await this.handleRequest(method, methodParams, chainId);

      // Respond to WalletConnect
      await this.web3wallet!.respondSessionRequest({
        topic,
        response: {
          id,
          jsonrpc: '2.0',
          result,
        },
      });

      console.log('[WC] Request handled successfully:', result);
    } catch (error: any) {
      console.error('[WC] Request failed:', error);

      // Respond with error
      await this.web3wallet!.respondSessionRequest({
        topic,
        response: {
          id,
          jsonrpc: '2.0',
          error: {
            code: error.code || -32603,
            message: error.message || 'Internal error',
          },
        },
      });
    }
  }

  /**
   * Handle session delete
   */
  private onSessionDelete(event: { topic: string }): void {
    console.log('[WC] Session deleted:', event);

    // Emit event for UI
    window.dispatchEvent(
      new CustomEvent('wc_session_deleted', { detail: event })
    );
  }

  /**
   * Handle WalletConnect request by mapping to Tauri command
   */
  private async handleRequest(
    method: string,
    params: any,
    _chainId: string // Prefixed with _ to indicate intentionally unused
  ): Promise<any> {
    console.log('[WC] Handling request:', method, params);

    // Map to existing dapp_request command
    const response = await invoke<any>('dapp_request', {
      origin: 'walletconnect', // Special origin for WC requests
      request: {
        id: `wc-${Date.now()}`,
        method,
        params: Array.isArray(params) ? params : [params],
        timestamp: Math.floor(Date.now() / 1000),
      },
    });

    // Check for errors
    if (response.error) {
      throw new Error(response.error.message);
    }

    return response.result;
  }

  /**
   * Get current account from Tauri backend
   */
  private async getCurrentAccount(): Promise<string | null> {
    if (this.currentAccount) {
      return this.currentAccount;
    }

    try {
      const response = await invoke<any>('dapp_request', {
        origin: 'walletconnect',
        request: {
          id: 'wc-get-account',
          method: 'eth_accounts',
          params: [],
          timestamp: Math.floor(Date.now() / 1000),
        },
      });

      if (response.result && response.result.length > 0) {
        this.currentAccount = response.result[0];
        return this.currentAccount;
      }

      return null;
    } catch (error) {
      console.error('[WC] Failed to get current account:', error);
      return null;
    }
  }

  /**
   * Get current chain ID from Tauri backend
   */
  private async getCurrentChainId(): Promise<number | null> {
    if (this.currentChainId) {
      return this.currentChainId;
    }

    try {
      const response = await invoke<any>('dapp_request', {
        origin: 'walletconnect',
        request: {
          id: 'wc-get-chainid',
          method: 'eth_chainId',
          params: [],
          timestamp: Math.floor(Date.now() / 1000),
        },
      });

      if (response.result) {
        this.currentChainId = parseInt(response.result, 16);
        return this.currentChainId;
      }

      return null;
    } catch (error) {
      console.error('[WC] Failed to get current chain ID:', error);
      return null;
    }
  }

  /**
   * Pair with dApp using URI
   */
  async pair(uri: string): Promise<void> {
    if (!this.web3wallet) {
      throw new Error('WalletConnect not initialized');
    }

    console.log('[WC] Pairing with URI:', uri);

    try {
      await this.web3wallet.core.pairing.pair({ uri });
      console.log('[WC] Pairing initiated');
    } catch (error) {
      console.error('[WC] Pairing failed:', error);
      throw error;
    }
  }

  /**
   * Get active sessions
   */
  getActiveSessions(): WCSession[] {
    if (!this.web3wallet) {
      return [];
    }

    const sessions = this.web3wallet.getActiveSessions();
    return Object.values(sessions);
  }

  /**
   * Disconnect session
   */
  async disconnectSession(topic: string): Promise<void> {
    if (!this.web3wallet) {
      throw new Error('WalletConnect not initialized');
    }

    console.log('[WC] Disconnecting session:', topic);

    try {
      await this.web3wallet.disconnectSession({
        topic,
        reason: getSdkError('USER_DISCONNECTED'),
      });

      console.log('[WC] Session disconnected');
    } catch (error) {
      console.error('[WC] Disconnect failed:', error);
      throw error;
    }
  }

  /**
   * Update session account
   */
  async updateSessionAccount(account: string): Promise<void> {
    this.currentAccount = account;

    if (!this.web3wallet) return;

    const sessions = this.getActiveSessions();

    for (const session of sessions) {
      try {
        // Emit accountsChanged event
        await this.web3wallet.emitSessionEvent({
          topic: session.topic,
          event: {
            name: 'accountsChanged',
            data: [account],
          },
          chainId: 'eip155:1', // TODO: Use actual chain ID
        });

        console.log('[WC] Account updated for session:', session.topic);
      } catch (error) {
        console.error('[WC] Failed to update account:', error);
      }
    }
  }

  /**
   * Update session chain
   */
  async updateSessionChain(chainId: number): Promise<void> {
    this.currentChainId = chainId;

    if (!this.web3wallet) return;

    const sessions = this.getActiveSessions();

    for (const session of sessions) {
      try {
        // Emit chainChanged event
        await this.web3wallet.emitSessionEvent({
          topic: session.topic,
          event: {
            name: 'chainChanged',
            data: `0x${chainId.toString(16)}`,
          },
          chainId: `eip155:${chainId}`,
        });

        console.log('[WC] Chain updated for session:', session.topic);
      } catch (error) {
        console.error('[WC] Failed to update chain:', error);
      }
    }
  }

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    if (!this.web3wallet) return;

    const sessions = this.getActiveSessions();

    for (const session of sessions) {
      try {
        await this.disconnectSession(session.topic);
      } catch (error) {
        console.error('[WC] Cleanup error:', error);
      }
    }

    this.initialized = false;
    this.web3wallet = null;
    this.currentAccount = null;
    this.currentChainId = null;
  }
}

// Singleton instance
let wcService: WalletConnectService | null = null;

/**
 * Get WalletConnect service instance
 */
export function getWalletConnectService(): WalletConnectService {
  if (!wcService) {
    wcService = new WalletConnectService();
  }
  return wcService;
}
