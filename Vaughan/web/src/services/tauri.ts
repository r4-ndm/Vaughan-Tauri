/**
 * @fileOverview Tauri Service Wrapper
 * 
 * Provides a strongly-typed, error-handled wrapper around all Tauri IPC commands.
 * This service directly interfaces with the Rust backend.
 */

import { invoke } from '@tauri-apps/api/core';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface NetworkInfo {
  id: string;
  name: string;
  chain_id: number;
  rpc_url: string;
  explorer_url?: string;
  currency_symbol: string;
}

export interface Account {
  address: string;
  name: string;
  account_type: 'Hd' | 'Imported';
  derivation_path?: string;
  is_active: boolean;
  index?: number;
}

export interface TransactionParams {
  to: string;
  amount: string; // in wei
  data?: string;
  gasLimit?: string;
  gasPrice?: string;
}

export interface SoundConfig {
  enabled: boolean;
  volume: number;
  sound_pack: string;
}

export interface UserPreferences {
  sound_enabled: boolean;
  theme: string;
  auto_lock_seconds: number;
  gas_multiplier: number;
  privacy_enabled: boolean;
}


// ============================================================================
// Core Wrapper
// ============================================================================

/**
 * Generic wrapper for Tauri invoke to standardize error handling
 */
async function tauriInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    console.error(`Tauri command '${command}' failed:`, error);
    // Standardize error as a JavaScript Error object
    if (error instanceof Error) {
      throw error;
    } else if (typeof error === 'string') {
      throw new Error(error);
    } else {
      throw new Error(`Unknown error in ${command}: ${JSON.stringify(error)}`);
    }
  }
}

// ============================================================================
// Network Commands
// ============================================================================

export const NetworkService = {
  /**
   * Switches the active network
   * @param networkId The ID of the network to switch to
   */
  async switchNetwork(networkId: string): Promise<void> {
    return tauriInvoke<void>('switch_network', { networkId });
  },

  /**
   * Gets the balance for an address on a specific network
   * @param address The Ethereum address
   * @param networkId The network ID
   * @returns The balance in wei as a string
   */
  async getBalance(address: string, networkId: string): Promise<string> {
    return tauriInvoke<string>('get_balance', { address, networkId });
  },

  /**
   * Gets details for a specific network
   */
  async getNetworkInfo(networkId: string): Promise<NetworkInfo> {
    return tauriInvoke<NetworkInfo>('get_network_info', { networkId });
  },

  /**
   * Gets all supported predefined networks
   */
  async getSupportedNetworks(): Promise<NetworkInfo[]> {
    return tauriInvoke<NetworkInfo[]>('get_supported_networks');
  },

  /**
   * Gets the current block number for a network
   */
  async getBlockNumber(networkId: string): Promise<number> {
    return tauriInvoke<number>('get_block_number', { networkId });
  }
};

// ============================================================================
// Wallet & Account Commands
// ============================================================================

export const WalletService = {
  /** Checks if a wallet is already configured (vault exists) */
  async walletExists(): Promise<boolean> {
    return tauriInvoke<boolean>('wallet_exists');
  },

  /** Checks if the wallet is currently locked */
  async isWalletLocked(): Promise<boolean> {
    return tauriInvoke<boolean>('is_wallet_locked');
  },

  /**
   * Unlocks the wallet with a password
   * @param password The user's password
   */
  async unlockWallet(password: string): Promise<void> {
    return tauriInvoke<void>('unlock_wallet', { password });
  },

  /** Locks the wallet */
  async lockWallet(): Promise<void> {
    return tauriInvoke<void>('lock_wallet');
  },

  /** Gets all accounts in the wallet */
  async getAccounts(): Promise<Account[]> {
    return tauriInvoke<Account[]>('get_accounts');
  },

  /** Sets the active account */
  async setActiveAccount(address: string): Promise<void> {
    return tauriInvoke<void>('set_active_account', { address });
  },

  /** Creates a new HD account */
  async createAccount(name: string): Promise<Account> {
    return tauriInvoke<Account>('create_account', { name });
  },

  /** Imports an account using a private key */
  async importAccount(name: string, privateKey: string): Promise<Account> {
    return tauriInvoke<Account>('import_account', { name, privateKey });
  },

  /** Deletes an account (only allowed for imported accounts normally) */
  async deleteAccount(address: string): Promise<void> {
    return tauriInvoke<void>('delete_account', { address });
  }
};

// ============================================================================
// Transaction Commands
// ============================================================================

export const TransactionService = {
  /**
   * Estimates gas for a basic transaction based on recipient and amount
   */
  async estimateGasSimple(to: string, amount: string): Promise<any> {
    return tauriInvoke<any>('estimate_gas_simple', { to, amount });
  },

  /**
   * Sends a transaction to the network
   * @param params Transaction parameters
   * @returns The transaction hash
   */
  async sendTransaction(params: TransactionParams): Promise<string> {
    return tauriInvoke<string>('send_transaction', { ...params });
  }
};

// ============================================================================
// Token Commands
// ============================================================================

export const TokenService = {
  /**
   * Gets the USD price of a token by its symbol
   */
  async getTokenPrice(symbol: string): Promise<number> {
    return tauriInvoke<number>('get_token_price', { symbol });
  },

  /**
   * Refreshes all cached token prices
   */
  async refreshTokenPrices(): Promise<void> {
    return tauriInvoke<void>('refresh_token_prices');
  }
};

// ============================================================================
// Audio / Sound Commands
// ============================================================================

export const AudioService = {
  /**
   * Plays a specific sound effect
   * @param soundType Type of sound (e.g., 'success', 'error', 'send')
   */
  async playSound(soundType: string): Promise<void> {
    return tauriInvoke<void>('play_sound', { soundType });
  },

  /** Gets the current sound configuration */
  async getSoundConfig(): Promise<SoundConfig> {
    return tauriInvoke<SoundConfig>('get_sound_config');
  },

  /** Updates the sound configuration */
  async updateSoundConfig(config: Partial<SoundConfig>): Promise<void> {
    return tauriInvoke<void>('update_sound_config', { config });
  }
};

// ============================================================================
// Preferences Commands
// ============================================================================

export const PreferencesService = {
  /** Gets the current user preferences */
  async getUserPreferences(): Promise<UserPreferences> {
    return tauriInvoke<UserPreferences>('get_user_preferences');
  },

  /** Updates the user preferences */
  async updateUserPreferences(preferences: UserPreferences): Promise<void> {
    return tauriInvoke<void>('update_user_preferences', { preferences });
  }
};

// ============================================================================
// Performance / Profiling Commands
// ============================================================================

export interface MethodStats {
  count: number;
  avg: number;
  min: number;
  max: number;
  total: number;
}

export const PerformanceService = {
  /** Gets performance statistics for all RPC methods */
  async getPerformanceStats(): Promise<Record<string, MethodStats>> {
    return tauriInvoke<Record<string, MethodStats>>('get_performance_stats');
  }
};
