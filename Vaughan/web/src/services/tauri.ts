/**
 * @fileOverview Tauri Service Wrapper
 *
 * Uses type-safe generated bindings from Rust (tauri-specta).
 * Regenerate bindings with: npm run gen:bindings (from project root).
 */

import { commands } from '../bindings/tauri-commands';
import type {
  AccountExport,
  BalanceResponse,
  UserPreferences,
  SoundConfig as BindingsSoundConfig,
  SwitchNetworkRequest,
  SendTransactionRequest,
  EstimateGasResponse,
  TokenPriceResponse,
  AlertSound,
  NetworkConfig,
  ValidateTransactionRequest,
  ApprovalRequest,
  ApprovalResponseExport,
  TokenBalanceResponse,
  TrackedToken,
} from '../bindings/tauri-commands';

// ============================================================================
// Types (re-export from bindings or adapt for backward compatibility)
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
  account_type: 'hd' | 'imported';
  derivation_path?: string;
  is_active: boolean;
  index?: number;
}

export interface TransactionParams {
  to: string;
  amount: string;
  data?: string;
  gasLimit?: string;
  gasPrice?: string;
}

export interface SoundConfig {
  enabled: boolean;
  volume: number;
  sound_pack: string;
}

export type { UserPreferences, BalanceResponse, SendTransactionRequest, EstimateGasResponse, TokenPriceResponse };

export interface MethodStats {
  count: number;
  avg: number;
  min: number;
  max: number;
  total: number;
}

// ============================================================================
// Helpers: unwrap Result<T, E> to T or throw
// ============================================================================

function unwrap<T, E>(result: { status: 'ok'; data: T } | { status: 'error'; error: E }): T {
  if (result.status === 'ok') return result.data;
  const err = result.error;
  throw typeof err === 'string' ? new Error(err) : new Error(JSON.stringify(err));
}

// ============================================================================
// Network Commands (from generated bindings; fix drift: no args for get_network_info, get_balance address-only)
// ============================================================================

export const NetworkService = {
  async switchNetwork(request: { network_id: string; rpc_url: string; chain_id: number }): Promise<void> {
    // chain_id must be sent as a number to Rust (u64); the generated TS type
    // uses string for safety, so we cast here to avoid sending a string.
    const req = {
      network_id: request.network_id,
      rpc_url: request.rpc_url,
      chain_id: request.chain_id,
    } as unknown as SwitchNetworkRequest;
    unwrap(await commands.switchNetwork(req));
  },

  async getBalance(address: string): Promise<BalanceResponse> {
    return unwrap(await commands.getBalance(address));
  },

  async getNetworkInfo(): Promise<NetworkInfo> {
    const data = unwrap(await commands.getNetworkInfo());
    return {
      id: data.network_id,
      name: data.name,
      chain_id: Number(data.chain_id),
      rpc_url: data.rpc_url,
      explorer_url: data.explorer_url || undefined,
      currency_symbol: data.native_token.symbol,
    };
  },

  async getSupportedNetworks(): Promise<NetworkInfo[]> {
    const list = unwrap(await commands.getSupportedNetworks());
    return list.map((n: NetworkConfig) => ({
      id: n.id,
      name: n.name,
      chain_id: Number(n.chain_id),
      rpc_url: n.rpc_url,
      explorer_url: n.explorer_url ?? undefined,
      currency_symbol: n.native_token.symbol,
    }));
  },

  async getBlockNumber(): Promise<number> {
    const data = unwrap(await commands.getBlockNumber());
    return Number(data);
  },
};

// ============================================================================
// Wallet & Account Commands (fix drift: create_account takes password; import_account takes privateKey, name, password)
// ============================================================================

export const WalletService = {
  async walletExists(): Promise<boolean> {
    return unwrap(await commands.walletExists());
  },

  async isWalletLocked(): Promise<boolean> {
    return unwrap(await commands.isWalletLocked());
  },

  async unlockWallet(password: string): Promise<void> {
    unwrap(await commands.unlockWallet(password));
  },

  async lockWallet(): Promise<void> {
    unwrap(await commands.lockWallet());
  },

  async getAccounts(): Promise<Account[]> {
    const list = unwrap(await commands.getAccounts());
    return list.map((a: AccountExport) => ({
      address: a.address,
      name: a.name,
      account_type: a.account_type,
      is_active: false,
      index: a.index ?? undefined,
    }));
  },

  async setActiveAccount(address: string): Promise<void> {
    unwrap(await commands.setActiveAccount(address));
  },

  async createAccount(password: string): Promise<Account> {
    const a = unwrap(await commands.createAccount(password));
    return {
      address: a.address,
      name: a.name,
      account_type: a.account_type,
      is_active: false,
      index: a.index ?? undefined,
    };
  },

  async importAccount(privateKey: string, name: string, password: string): Promise<Account> {
    const a = unwrap(await commands.importAccount(privateKey, name, password));
    return {
      address: a.address,
      name: a.name,
      account_type: a.account_type,
      is_active: false,
      index: a.index ?? undefined,
    };
  },

  async deleteAccount(address: string): Promise<void> {
    unwrap(await commands.deleteAccount(address));
  },

  async renameAccount(address: string, newName: string, password: string): Promise<void> {
    unwrap(await commands.renameAccount(address, newName, password));
  },

  async setFocusedAsset(asset: string): Promise<void> {
    unwrap(await commands.setFocusedAsset(asset));
  },

  async resetState(): Promise<void> {
    unwrap(await commands.resetState());
  },

  async createWallet(password: string, wordCount: 12 | 24): Promise<string> {
    return unwrap(await commands.createWallet(password, String(wordCount)));
  },

  async importWallet(mnemonic: string, password: string, accountCount: number): Promise<string[]> {
    return unwrap(await commands.importWallet(mnemonic, password, accountCount));
  },

  async exportMnemonic(password: string): Promise<string> {
    return unwrap(await commands.exportMnemonic(password));
  },

  async exportPrivateKey(address: string, password: string): Promise<string> {
    return unwrap(await commands.exportPrivateKey(address, password));
  },

  async getRailgunMnemonic(password: string): Promise<string> {
    return unwrap(await commands.getRailgunMnemonic(password));
  },
};

// ============================================================================
// Transaction Commands
// ============================================================================

export const TransactionService = {
  async estimateGasSimple(
    from: string,
    to: string,
    amount: string,
    tokenAddress?: string | null,
    data?: string | null
  ): Promise<EstimateGasResponse> {
    return unwrap(await commands.estimateGasSimple(from, to, amount, tokenAddress ?? null, data ?? null));
  },

  async sendTransaction(request: SendTransactionRequest): Promise<string> {
    const res = unwrap(await commands.sendTransaction(request));
    return res.tx_hash;
  },

  async validateTransaction(request: ValidateTransactionRequest): Promise<void> {
    unwrap(await commands.validateTransaction(request));
  },
};

// ============================================================================
// Token Commands (fix drift: get_token_price has no args)
// ============================================================================

export const TokenService = {
  async getTokenPrice(): Promise<TokenPriceResponse> {
    return unwrap(await commands.getTokenPrice());
  },

  async refreshTokenPrices(): Promise<TokenPriceResponse> {
    return unwrap(await commands.refreshTokenPrices());
  },

  async getTokenBalance(tokenAddress: string, walletAddress: string): Promise<TokenBalanceResponse> {
    return unwrap(await commands.getTokenBalance(tokenAddress, walletAddress));
  },

  async getTokenMetadata(tokenAddress: string): Promise<TrackedToken> {
    return unwrap(await commands.getTokenMetadata(tokenAddress));
  },

  async addCustomToken(tokenAddress: string): Promise<TrackedToken> {
    return unwrap(await commands.addCustomToken(tokenAddress));
  },

  async removeCustomToken(tokenAddress: string): Promise<void> {
    unwrap(await commands.removeCustomToken(tokenAddress));
  },

  async getTrackedTokens(): Promise<TrackedToken[]> {
    return unwrap(await commands.getTrackedTokens());
  },
};

// ============================================================================
// Audio / Sound Commands
// ============================================================================

export const AudioService = {
  async playSound(alert: AlertSound): Promise<void> {
    unwrap(await commands.playSound(alert));
  },

  async getSoundConfig(): Promise<SoundConfig> {
    const c = unwrap(await commands.getSoundConfig());
    return { enabled: c.enabled, volume: c.volume, sound_pack: c.sound_pack };
  },

  async updateSoundConfig(config: BindingsSoundConfig): Promise<void> {
    unwrap(await commands.updateSoundConfig(config));
  },
};

// ============================================================================
// Preferences Commands
// ============================================================================

export const PreferencesService = {
  async getUserPreferences(): Promise<UserPreferences> {
    return unwrap(await commands.getUserPreferences());
  },

  async updateUserPreferences(preferences: UserPreferences): Promise<void> {
    unwrap(await commands.updateUserPreferences(preferences));
  },
};

// ============================================================================
// Performance Commands
// ============================================================================

export const PerformanceService = {
  async getPerformanceStats(): Promise<Record<string, MethodStats>> {
    const data = unwrap(await commands.getPerformanceStats());
    const out: Record<string, MethodStats> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v) out[k] = { count: Number(v.count), avg: Number(v.avg), min: Number(v.min), max: Number(v.max), total: Number(v.total) };
    }
    return out;
  },
};

// ============================================================================
// Dapp / Approval Commands
// ============================================================================

export const DappService = {
  async getPendingApprovals(): Promise<ApprovalRequest[]> {
    return unwrap(await commands.getPendingApprovals());
  },

  async respondToApproval(response: ApprovalResponseExport): Promise<void> {
    unwrap(await commands.respondToApproval(response));
  },

  async cancelApproval(id: string): Promise<void> {
    unwrap(await commands.cancelApproval(id));
  },

  async clearAllApprovals(): Promise<void> {
    unwrap(await commands.clearAllApprovals());
  },

  async openDappWindow(url: string, title: string | null = null, useProxy: boolean | null = null): Promise<string> {
    return unwrap(await commands.openDappWindow(url, title, useProxy));
  },

  async launchExternalApp(exePath: string): Promise<void> {
    unwrap(await commands.launchExternalApp(exePath));
  },
};

// Re-export typed commands for direct use
export { commands };
