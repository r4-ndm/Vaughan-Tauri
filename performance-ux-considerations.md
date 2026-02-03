# Performance & UX Considerations

**Goal**: Fast, responsive wallet that feels native on all platforms.

---

## 1. Performance Optimization

### 1.1 Startup Performance

**Target**: < 3 seconds cold start

**Strategies**:

```rust
// Lazy initialization of heavy components
pub struct VaughanState {
    // Always initialized (fast)
    wallet_controller: Arc<WalletController>,
    
    // Lazy initialized (only when needed)
    transaction_controller: OnceCell<Arc<TransactionController>>,
    network_controller: OnceCell<Arc<NetworkController>>,
    price_controller: OnceCell<Arc<PriceController>>,
}

impl VaughanState {
    pub async fn get_transaction_controller(&self) -> Result<&Arc<TransactionController>> {
        self.transaction_controller
            .get_or_try_init(|| async {
                // Initialize only when first needed
                TransactionController::new(/* ... */).await
            })
            .await
    }
}
```

**Parallel Initialization**:
```rust
async fn initialize_app() -> Result<VaughanState> {
    // Initialize independent components in parallel
    let (wallet, price) = tokio::join!(
        WalletController::new(),
        PriceController::new(),
    );
    
    Ok(VaughanState {
        wallet_controller: Arc::new(wallet?),
        price_controller: Arc::new(price?),
        // Network-dependent controllers initialized later
        transaction_controller: OnceCell::new(),
        network_controller: OnceCell::new(),
    })
}
```

### 1.2 RPC Request Optimization

**Batch Requests**:
```rust
use alloy::providers::Provider;

async fn get_multiple_balances(
    provider: &impl Provider,
    addresses: &[Address],
) -> Result<Vec<U256>> {
    // Use multicall to batch requests
    let multicall = Multicall::new(provider).await?;
    
    let calls: Vec<_> = addresses
        .iter()
        .map(|addr| multicall.add_call(/* balance call */))
        .collect();
    
    // Single RPC request instead of N requests
    multicall.call().await
}
```

**Request Caching**:
```rust
use moka::future::Cache;
use std::time::Duration;

struct CachedProvider {
    provider: Arc<Provider>,
    cache: Cache<String, CachedResponse>,
}

impl CachedProvider {
    async fn get_balance(&self, address: Address) -> Result<U256> {
        let cache_key = format!("balance:{}", address);
        
        // Check cache first
        if let Some(cached) = self.cache.get(&cache_key).await {
            if !cached.is_expired() {
                return Ok(cached.value);
            }
        }
        
        // Fetch from network
        let balance = self.provider.get_balance(address, None).await?;
        
        // Cache for 10 seconds
        self.cache.insert(
            cache_key,
            CachedResponse {
                value: balance,
                expires_at: Instant::now() + Duration::from_secs(10),
            }
        ).await;
        
        Ok(balance)
    }
}
```

### 1.3 Frontend Performance

**Virtual Scrolling** for token lists:
```typescript
import { FixedSizeList } from 'react-window';

function TokenList({ tokens }: { tokens: Token[] }) {
  return (
    <FixedSizeList
      height={400}
      itemCount={tokens.length}
      itemSize={60}
      width="100%"
    >
      {({ index, style }) => (
        <TokenRow token={tokens[index]} style={style} />
      )}
    </FixedSizeList>
  );
}
```

**Debounced Input**:
```typescript
import { useDebouncedCallback } from 'use-debounce';

function SendForm() {
  const validateAddress = useDebouncedCallback(
    async (address: string) => {
      // Only validate after user stops typing for 300ms
      const isValid = await invoke('validate_address', { address });
      setAddressValid(isValid);
    },
    300
  );
  
  return (
    <input
      onChange={(e) => validateAddress(e.target.value)}
      placeholder="Recipient address"
    />
  );
}
```

**Optimistic Updates**:
```typescript
async function sendTransaction(tx: Transaction) {
  // Update UI immediately (optimistic)
  setPendingTx(tx);
  setBalance(balance - tx.amount);
  
  try {
    // Send transaction
    const hash = await invoke('send_transaction', tx);
    
    // Update with real data
    setConfirmedTx(hash);
  } catch (error) {
    // Revert optimistic update
    setPendingTx(null);
    setBalance(balance);
    showError(error);
  }
}
```

### 1.4 Memory Management

**Limit Cache Size**:
```rust
use lru::LruCache;

struct PriceController {
    cache: LruCache<String, f64>,
}

impl PriceController {
    fn new() -> Self {
        Self {
            // Only cache 1000 most recent prices
            cache: LruCache::new(NonZeroUsize::new(1000).unwrap()),
        }
    }
}
```

**Periodic Cleanup**:
```rust
async fn cleanup_task(state: Arc<Mutex<VaughanState>>) {
    let mut interval = tokio::time::interval(Duration::from_secs(300)); // 5 minutes
    
    loop {
        interval.tick().await;
        
        let mut app_state = state.lock().await;
        
        // Clean up expired cache entries
        app_state.price_controller.cleanup_expired();
        
        // Clean up old transaction history
        app_state.transaction_history.retain(|tx| {
            tx.timestamp > SystemTime::now() - Duration::from_secs(86400 * 30) // 30 days
        });
    }
}
```

---

## 2. UX Considerations

### 2.1 Loading States

**Never show blank screens**:
```typescript
function BalanceDisplay() {
  const { data: balance, isLoading } = useQuery({
    queryKey: ['balance'],
    queryFn: () => invoke('get_balance'),
  });
  
  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-32"></div>
        <div className="h-4 bg-gray-200 rounded w-24 mt-2"></div>
      </div>
    );
  }
  
  return (
    <div>
      <div className="text-3xl font-bold">{balance} ETH</div>
      <div className="text-gray-500">${usdValue}</div>
    </div>
  );
}
```

**Progress Indicators**:
```typescript
function TransactionStatus({ hash }: { hash: string }) {
  const [status, setStatus] = useState<'pending' | 'confirmed' | 'failed'>('pending');
  
  useEffect(() => {
    const interval = setInterval(async () => {
      const receipt = await invoke('get_transaction_receipt', { hash });
      if (receipt) {
        setStatus(receipt.status === 1 ? 'confirmed' : 'failed');
        clearInterval(interval);
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [hash]);
  
  return (
    <div>
      {status === 'pending' && (
        <>
          <Spinner />
          <p>Confirming transaction...</p>
          <p className="text-sm text-gray-500">
            This usually takes 15-30 seconds
          </p>
        </>
      )}
      {status === 'confirmed' && (
        <>
          <CheckIcon className="text-green-500" />
          <p>Transaction confirmed!</p>
        </>
      )}
    </div>
  );
}
```

### 2.2 Error Handling

**User-Friendly Error Messages**:
```rust
#[derive(Debug, thiserror::Error)]
pub enum TransactionError {
    #[error("Insufficient balance. You have {balance} but need {required}")]
    InsufficientBalance { balance: U256, required: U256 },
    
    #[error("Gas price too high. Current: {current}, Max: {max}")]
    GasPriceTooHigh { current: U256, max: U256 },
    
    #[error("Invalid recipient address. Please check and try again.")]
    InvalidAddress,
    
    #[error("Network error. Please check your connection and try again.")]
    NetworkError,
}

impl TransactionError {
    pub fn to_user_message(&self) -> String {
        match self {
            Self::InsufficientBalance { balance, required } => {
                format!(
                    "You don't have enough funds. You have {} ETH but need {} ETH (including gas fees).",
                    format_ether(balance),
                    format_ether(required)
                )
            }
            Self::GasPriceTooHigh { current, max } => {
                format!(
                    "Gas price is unusually high ({} Gwei). Consider waiting for lower gas prices.",
                    current / 1_000_000_000
                )
            }
            _ => self.to_string(),
        }
    }
}
```

**Actionable Errors**:
```typescript
function ErrorDisplay({ error }: { error: string }) {
  // Parse error and provide actions
  if (error.includes('Insufficient balance')) {
    return (
      <div className="bg-red-50 p-4 rounded">
        <p className="text-red-800">{error}</p>
        <div className="mt-2 space-x-2">
          <button onClick={openReceiveDialog}>
            Receive Funds
          </button>
          <button onClick={adjustAmount}>
            Adjust Amount
          </button>
        </div>
      </div>
    );
  }
  
  if (error.includes('Network error')) {
    return (
      <div className="bg-yellow-50 p-4 rounded">
        <p className="text-yellow-800">{error}</p>
        <button onClick={retry} className="mt-2">
          Retry
        </button>
      </div>
    );
  }
  
  return <div className="bg-red-50 p-4 rounded">{error}</div>;
}
```

### 2.3 Confirmation Dialogs

**Clear, Scannable Information**:
```typescript
function TransactionConfirmation({ tx }: { tx: Transaction }) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Confirm Transaction</h2>
      
      {/* Visual hierarchy */}
      <div className="bg-gray-50 p-4 rounded space-y-2">
        <div className="flex justify-between">
          <span className="text-gray-600">From</span>
          <span className="font-mono">{truncateAddress(tx.from)}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600">To</span>
          <span className="font-mono">{truncateAddress(tx.to)}</span>
        </div>
        
        {/* Most important info - large and prominent */}
        <div className="border-t pt-2 mt-2">
          <div className="text-center">
            <div className="text-3xl font-bold">{tx.amount} ETH</div>
            <div className="text-gray-500">${tx.usdValue} USD</div>
          </div>
        </div>
        
        {/* Secondary info - smaller */}
        <div className="border-t pt-2 mt-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Network Fee</span>
            <span>{tx.gasFee} ETH (${tx.gasFeeUsd})</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>Total</span>
            <span>{tx.total} ETH (${tx.totalUsd})</span>
          </div>
        </div>
      </div>
      
      {/* Clear actions */}
      <div className="flex space-x-2">
        <button
          onClick={onReject}
          className="flex-1 bg-gray-200 hover:bg-gray-300"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
        >
          Confirm
        </button>
      </div>
    </div>
  );
}
```

### 2.4 Keyboard Shortcuts

```typescript
function useKeyboardShortcuts() {
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K: Quick search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        openQuickSearch();
      }
      
      // Cmd/Ctrl + S: Send
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        openSendDialog();
      }
      
      // Cmd/Ctrl + R: Receive
      if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
        e.preventDefault();
        openReceiveDialog();
      }
      
      // Cmd/Ctrl + ,: Settings
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        openSettings();
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);
}
```

### 2.5 Accessibility

**Screen Reader Support**:
```typescript
function BalanceDisplay({ balance, usdValue }: Props) {
  return (
    <div
      role="region"
      aria-label="Account balance"
    >
      <div
        className="text-3xl font-bold"
        aria-label={`Balance: ${balance} ETH`}
      >
        {balance} ETH
      </div>
      <div
        className="text-gray-500"
        aria-label={`Approximately ${usdValue} US dollars`}
      >
        ${usdValue} USD
      </div>
    </div>
  );
}
```

**Keyboard Navigation**:
```typescript
function TokenList({ tokens }: { tokens: Token[] }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, tokens.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        openTokenDetails(tokens[selectedIndex]);
        break;
    }
  };
  
  return (
    <div
      role="listbox"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label="Token list"
    >
      {tokens.map((token, index) => (
        <TokenRow
          key={token.address}
          token={token}
          selected={index === selectedIndex}
          role="option"
          aria-selected={index === selectedIndex}
        />
      ))}
    </div>
  );
}
```

---

## 3. Mobile-Specific Considerations

### 3.1 Touch Gestures

**Swipe to Refresh**:
```typescript
function WalletView() {
  const [refreshing, setRefreshing] = useState(false);
  
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refetchBalance(),
      refetchTokens(),
      refetchTransactions(),
    ]);
    setRefreshing(false);
  };
  
  return (
    <PullToRefresh
      onRefresh={handleRefresh}
      refreshing={refreshing}
    >
      <BalanceDisplay />
      <TokenList />
      <TransactionHistory />
    </PullToRefresh>
  );
}
```

**Swipe Actions**:
```typescript
function TransactionRow({ tx }: { tx: Transaction }) {
  return (
    <Swipeable
      renderLeftActions={() => (
        <button onClick={() => copyTxHash(tx.hash)}>
          Copy
        </button>
      )}
      renderRightActions={() => (
        <button onClick={() => viewOnExplorer(tx.hash)}>
          View
        </button>
      )}
    >
      <div className="p-4">
        {/* Transaction details */}
      </div>
    </Swipeable>
  );
}
```

### 3.2 Haptic Feedback

```typescript
function useHapticFeedback() {
  const vibrate = (pattern: number | number[]) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  };
  
  return {
    success: () => vibrate([50, 100, 50]),
    error: () => vibrate([100, 50, 100, 50, 100]),
    warning: () => vibrate(100),
    tap: () => vibrate(10),
  };
}

function SendButton() {
  const haptic = useHapticFeedback();
  
  const handleSend = async () => {
    haptic.tap(); // Immediate feedback
    
    try {
      await sendTransaction();
      haptic.success();
    } catch (error) {
      haptic.error();
    }
  };
  
  return <button onClick={handleSend}>Send</button>;
}
```

### 3.3 Safe Area Insets

```css
/* Handle notches and home indicators */
.wallet-container {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}
```

---

## 4. Network Resilience

### 4.1 Offline Detection

```typescript
function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  return isOnline;
}

function App() {
  const isOnline = useNetworkStatus();
  
  if (!isOnline) {
    return (
      <div className="bg-yellow-50 p-4">
        <p>You're offline. Some features may not work.</p>
      </div>
    );
  }
  
  return <WalletView />;
}
```

### 4.2 Request Retry Logic

```rust
use backoff::{ExponentialBackoff, backoff::Backoff};

async fn fetch_with_retry<T, F>(
    operation: F,
    max_retries: usize,
) -> Result<T>
where
    F: Fn() -> Future<Output = Result<T>>,
{
    let mut backoff = ExponentialBackoff::default();
    let mut attempts = 0;
    
    loop {
        match operation().await {
            Ok(result) => return Ok(result),
            Err(e) if attempts < max_retries => {
                attempts += 1;
                
                if let Some(duration) = backoff.next_backoff() {
                    warn!("Request failed, retrying in {:?}...", duration);
                    tokio::time::sleep(duration).await;
                } else {
                    return Err(e);
                }
            }
            Err(e) => return Err(e),
        }
    }
}
```

### 4.3 Fallback RPC Endpoints

```rust
struct NetworkController {
    primary_rpc: String,
    fallback_rpcs: Vec<String>,
    current_rpc_index: usize,
}

impl NetworkController {
    async fn get_balance(&mut self, address: Address) -> Result<U256> {
        // Try primary first
        match self.try_get_balance(&self.primary_rpc, address).await {
            Ok(balance) => Ok(balance),
            Err(e) => {
                warn!("Primary RPC failed: {}", e);
                
                // Try fallbacks
                for (i, rpc) in self.fallback_rpcs.iter().enumerate() {
                    match self.try_get_balance(rpc, address).await {
                        Ok(balance) => {
                            info!("Fallback RPC {} succeeded", i);
                            return Ok(balance);
                        }
                        Err(e) => {
                            warn!("Fallback RPC {} failed: {}", i, e);
                        }
                    }
                }
                
                Err("All RPC endpoints failed".into())
            }
        }
    }
}
```

---

## 5. Analytics & Monitoring (Privacy-Preserving)

### 5.1 Performance Metrics

```rust
use tracing::{info, instrument};

#[instrument(skip(state))]
#[tauri::command]
async fn send_transaction(
    state: State<'_, Arc<Mutex<VaughanState>>>,
    to: String,
    amount: String,
) -> Result<String, String> {
    let start = Instant::now();
    
    // ... implementation
    
    let duration = start.elapsed();
    info!(
        duration_ms = duration.as_millis(),
        "Transaction sent"
    );
    
    Ok(tx_hash)
}
```

### 5.2 Error Tracking

```rust
use sentry;

fn setup_error_tracking() {
    let _guard = sentry::init((
        "YOUR_SENTRY_DSN",
        sentry::ClientOptions {
            release: Some(env!("CARGO_PKG_VERSION").into()),
            // CRITICAL: Don't send sensitive data
            before_send: Some(Arc::new(|mut event| {
                // Scrub sensitive data
                if let Some(request) = &mut event.request {
                    request.data = None; // Remove request body
                }
                Some(event)
            })),
            ..Default::default()
        },
    ));
}
```

**Never track**:
- Private keys
- Passwords
- Seed phrases
- Transaction amounts
- Addresses (unless anonymized)

---

## Summary: Performance & UX Checklist

**Performance**:
- [ ] Lazy initialization of heavy components
- [ ] Parallel initialization where possible
- [ ] RPC request batching (multicall)
- [ ] Request caching with TTL
- [ ] Virtual scrolling for long lists
- [ ] Debounced input validation
- [ ] Optimistic UI updates
- [ ] Memory limits on caches
- [ ] Periodic cleanup tasks

**UX**:
- [ ] Loading states (never blank screens)
- [ ] Progress indicators for long operations
- [ ] User-friendly error messages
- [ ] Actionable error dialogs
- [ ] Clear confirmation dialogs
- [ ] Keyboard shortcuts
- [ ] Screen reader support
- [ ] Keyboard navigation

**Mobile**:
- [ ] Touch gestures (swipe to refresh, swipe actions)
- [ ] Haptic feedback
- [ ] Safe area insets
- [ ] Touch-friendly targets (44px minimum)

**Resilience**:
- [ ] Offline detection
- [ ] Request retry logic
- [ ] Fallback RPC endpoints
- [ ] Network error handling

**Monitoring**:
- [ ] Performance metrics
- [ ] Error tracking (privacy-preserving)
- [ ] No sensitive data in analytics

**A fast, responsive wallet builds trust with users.**
