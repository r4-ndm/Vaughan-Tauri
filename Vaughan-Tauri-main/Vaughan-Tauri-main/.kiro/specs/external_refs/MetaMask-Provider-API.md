# MetaMask Ethereum Provider API

## Methods

### isConnected()
```javascript
isConnected(): boolean
```
Indicates whether the provider is connected to the current chain.
Returns `true` if satisfied, `false` otherwise.

### request(args)
```javascript
request(args: { method: string, params?: unknown[] | object }): Promise<unknown>
```
Submits JSON-RPC API requests to Ethereum using MetaMask.

**Example:**
```javascript
window.ethereum.request({
  method: 'eth_sendTransaction',
  params: [ ... ]
})
```

## Events

### accountsChanged
```javascript
provider.on("accountsChanged", (accounts: Array<string>) => { ... });
```
Emitted when the user's exposed account address changes.

### chainChanged
```javascript
provider.on("chainChanged", (chainId: string) => { ... });
```
Emitted when the currently connected chain changes. `chainId` is a hex string.
**Recommendation**: Reload the page on chain change.

### connect
```javascript
provider.on("connect", (connectInfo: { chainId: string }) => { ... });
```
Emitted when the provider is first able to submit RPC requests.

### disconnect
```javascript
provider.on("disconnect", (error: ProviderRpcError) => { ... });
```
Emitted if it becomes unable to submit RPC requests.
