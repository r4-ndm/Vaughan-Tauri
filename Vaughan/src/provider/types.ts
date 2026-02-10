/**
 * EIP-1193 TypeScript Type Definitions
 * 
 * Standard Ethereum Provider API types
 */

// ============================================================================
// Request/Response Types
// ============================================================================

export interface RequestArguments {
  readonly method: string;
  readonly params?: readonly unknown[] | object;
}

export interface ProviderMessage {
  readonly type: string;
  readonly data: unknown;
}

export interface ProviderConnectInfo {
  readonly chainId: string;
}

export interface ProviderRpcError extends Error {
  code: number;
  data?: unknown;
}

// ============================================================================
// Provider Request/Response (Internal)
// ============================================================================

export interface ProviderRequest {
  id: string;
  timestamp: number;
  method: string;
  params: unknown[];
}

export interface ProviderResponse {
  id: string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// ============================================================================
// dApp Connection Types
// ============================================================================

export interface DappConnectionInfo {
  origin: string;
  name?: string;
  icon?: string;
  accounts: string[];
  connectedAt: number;
  lastActivity: number;
}

// ============================================================================
// Approval Request Types
// ============================================================================

export type ApprovalRequestType = 
  | 'connection'
  | 'transaction'
  | 'signature'
  | 'networkSwitch'
  | 'addNetwork';

export interface BaseApprovalRequest {
  id: string;
  type: ApprovalRequestType;
  origin: string;
  timestamp: number;
}

export interface ConnectionApprovalRequest extends BaseApprovalRequest {
  type: 'connection';
  name?: string;
  icon?: string;
}

export interface TransactionApprovalRequest extends BaseApprovalRequest {
  type: 'transaction';
  transaction: {
    from: string;
    to: string;
    value?: string;
    data?: string;
    gas?: string;
    gasPrice?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
    nonce?: string;
  };
}

export interface SignatureApprovalRequest extends BaseApprovalRequest {
  type: 'signature';
  method: 'personal_sign' | 'eth_signTypedData_v4' | 'eth_sign';
  message: string;
  address: string;
}

export interface NetworkSwitchApprovalRequest extends BaseApprovalRequest {
  type: 'networkSwitch';
  chainId: string;
}

export interface AddNetworkApprovalRequest extends BaseApprovalRequest {
  type: 'addNetwork';
  network: {
    chainId: string;
    chainName: string;
    nativeCurrency: {
      name: string;
      symbol: string;
      decimals: number;
    };
    rpcUrls: string[];
    blockExplorerUrls?: string[];
    iconUrls?: string[];
  };
}

export type ApprovalRequest =
  | ConnectionApprovalRequest
  | TransactionApprovalRequest
  | SignatureApprovalRequest
  | NetworkSwitchApprovalRequest
  | AddNetworkApprovalRequest;

// ============================================================================
// RPC Method Types
// ============================================================================

export type RpcMethod =
  // Account Management
  | 'eth_requestAccounts'
  | 'eth_accounts'
  
  // Network Info
  | 'eth_chainId'
  | 'net_version'
  
  // Read Operations
  | 'eth_getBalance'
  | 'eth_blockNumber'
  | 'eth_call'
  | 'eth_estimateGas'
  | 'eth_gasPrice'
  | 'eth_getTransactionCount'
  | 'eth_getTransactionByHash'
  | 'eth_getTransactionReceipt'
  | 'eth_getBlockByNumber'
  | 'eth_getBlockByHash'
  | 'eth_getLogs'
  
  // Write Operations
  | 'eth_sendTransaction'
  | 'eth_sendRawTransaction'
  | 'personal_sign'
  | 'eth_signTypedData_v4'
  | 'eth_sign'
  
  // Network Switching
  | 'wallet_switchEthereumChain'
  | 'wallet_addEthereumChain'
  
  // Permissions
  | 'wallet_requestPermissions'
  | 'wallet_getPermissions'
  
  // Assets
  | 'wallet_watchAsset';

// ============================================================================
// Error Codes (EIP-1193 + EIP-1474)
// ============================================================================

export enum ProviderErrorCode {
  // EIP-1193
  USER_REJECTED = 4001,
  UNAUTHORIZED = 4100,
  UNSUPPORTED_METHOD = 4200,
  DISCONNECTED = 4900,
  CHAIN_DISCONNECTED = 4901,
  
  // EIP-1474
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,
  
  // Custom
  RATE_LIMIT_EXCEEDED = 4902,
  ORIGIN_MISMATCH = 4903,
  REQUEST_EXPIRED = 4904,
  DUPLICATE_REQUEST = 4905,
}

// ============================================================================
// Utility Types
// ============================================================================

export interface ChainInfo {
  chainId: string;
  chainName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrl: string;
  blockExplorerUrl?: string;
}

export interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  name?: string;
  logoURI?: string;
}
