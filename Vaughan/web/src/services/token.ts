/**
 * Token service – uses typed commands from tauri.ts (tauri-specta bindings).
 */
import { TokenService } from './tauri';
import type { TokenPriceResponse, TokenBalanceResponse, TrackedToken } from '../bindings/tauri-commands';

export type { TokenPriceResponse, TokenBalanceResponse, TrackedToken };

export const getTokenPrice = (): Promise<TokenPriceResponse> => TokenService.getTokenPrice();
export const refreshTokenPrices = (): Promise<TokenPriceResponse> => TokenService.refreshTokenPrices();
export const getTokenBalance = (tokenAddress: string, walletAddress: string): Promise<TokenBalanceResponse> =>
  TokenService.getTokenBalance(tokenAddress, walletAddress);
export const getTokenMetadata = (tokenAddress: string): Promise<TrackedToken> =>
  TokenService.getTokenMetadata(tokenAddress);
export const addCustomToken = (tokenAddress: string): Promise<TrackedToken> => TokenService.addCustomToken(tokenAddress);
export const removeCustomToken = (tokenAddress: string): Promise<void> => TokenService.removeCustomToken(tokenAddress);
export const getTrackedTokens = (): Promise<TrackedToken[]> => TokenService.getTrackedTokens();
