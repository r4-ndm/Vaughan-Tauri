import { invoke } from '@tauri-apps/api/core';

export interface TokenPriceResponse {
    symbol: string;
    price_usd: number;
    timestamp: number;
}

export interface TokenBalanceResponse {
    balance: string;
    balance_formatted: string;
    symbol: string;
    decimals: number;
}

export interface TrackedToken {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    chain_id: number;
}

export const getTokenPrice = async (): Promise<TokenPriceResponse> => {
    return invoke('get_token_price');
};

export const refreshTokenPrices = async (): Promise<TokenPriceResponse> => {
    return invoke('refresh_token_prices');
};

export const getTokenBalance = async (tokenAddress: string, walletAddress: string): Promise<TokenBalanceResponse> => {
    return invoke('get_token_balance', { tokenAddress, walletAddress });
};

export const getTokenMetadata = async (tokenAddress: string): Promise<TrackedToken> => {
    return invoke('get_token_metadata', { tokenAddress });
};

export const addCustomToken = async (tokenAddress: string): Promise<TrackedToken> => {
    return invoke('add_custom_token', { tokenAddress });
};

export const removeCustomToken = async (tokenAddress: string): Promise<void> => {
    return invoke('remove_custom_token', { tokenAddress });
};

export const getTrackedTokens = async (): Promise<TrackedToken[]> => {
    return invoke('get_tracked_tokens');
};
