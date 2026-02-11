# Comprehensive Testing Strategy

**Goal**: Ship a wallet that works correctly, securely, and reliably.

---

## 1. Testing Pyramid

```
        /\
       /  \      E2E Tests (10%)
      /    \     - Critical user flows
     /------\    - Real dApp integration
    /        \   
   /  Integration Tests (30%)
  /            \ - Command tests
 /    Unit Tests (60%)
/________________\ - Controller tests
                   - Pure function tests
```

---

## 2. Unit Tests (60% of tests)

### 2.1 Controller Tests (Already Exist)

**Transfer existing tests**:
```bash
# Copy all controller tests
cp tests/*_controller*.rs src-tauri/tests/

# Verify they pass
cd src-tauri
cargo test --lib
```

**Example - TransactionController**:
```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_validate_transaction_zero_address() {
        let controller = TransactionController::new();
        
        let result = controller.validate_transaction(
            Address::ZERO,
            U256::from(1000),
            21000,
            U256::from(2000),
        );
        
        assert!(matches!(result, Err(TransactionError::ZeroAddress)));
    }
    
    #[test]
    fn test_validate_transaction_insufficient_balance() {
        let controller = TransactionController::new();
        
        let result = controller.validate_transaction(
            Address::from_str("0x1234...").unwrap(),
            U256::from(2000),  // Need 2000
            21000,
            U256::from(1000),  // Only have 1000
        );
        
        assert!(matches!(result, Err(TransactionError::InsufficientBalance { .. })));
    }
}
```

### 2.2 Pure Function Tests

**Utility functions**:
```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_parse_amount() {
        assert_eq!(
            parse_amount("1.5", 18).unwrap(),
            U256::from(1_500_000_000_000_000_000u128)
        );
        
        assert_eq!(
            parse_amount("0.001", 18).unwrap(),
            U256::from(1_000_000_000_000_000u128)
        );
    }
    
    #[test]
    fn test_format_amount() {
        assert_eq!(
            format_amount(U256::from(1_500_000_000_000_000_000u128), 18),
            "1.5"
        );
    }
    
    #[test]
    fn test_truncate_address() {
        assert_eq!(
            truncate_address("0x1234567890abcdef1234567890abcdef12345678"),
            "0x1234...5678"
        );
    }
}
```

### 2.3 Frontend Unit Tests

**Component tests with Vitest**:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SendForm } from './SendForm';

describe('SendForm', () => {
  it('validates address format', async () => {
    render(<SendForm />);
    
    const input = screen.getByPlaceholderText('Recipient address');
    fireEvent.change(input, { target: { value: 'invalid' } });
    
    expect(await screen.findByText('Invalid address')).toBeInTheDocument();
  });
  
  it('validates sufficient balance', async () => {
    const mockInvoke = vi.fn().mockResolvedValue('1.0'); // 1 ETH balance
    
    render(<SendForm balance="1.0" invoke={mockInvoke} />);
    
    const amountInput = screen.getByPlaceholderText('Amount');
    fireEvent.change(amountInput, { target: { value: '2.0' } }); // Try to send 2 ETH
    
    expect(await screen.findByText('Insufficient balance')).toBeInTheDocument();
  });
  
  it('calls send_transaction with correct params', async () => {
    const mockInvoke = vi.fn().mockResolvedValue('0x123...');
    
    render(<SendForm invoke={mockInvoke} />);
    
    fireEvent.change(screen.getByPlaceholderText('Recipient address'), {
      target: { value: '0x1234567890abcdef1234567890abcdef12345678' }
    });
    fireEvent.change(screen.getByPlaceholderText('Amount'), {
      target: { value: '1.5' }
    });
    fireEvent.click(screen.getByText('Send'));
    
    expect(mockInvoke).toHaveBeenCalledWith('send_transaction', {
      to: '0x1234567890abcdef1234567890abcdef12345678',
      amount: '1.5',
    });
  });
});
```

---

## 3. Integration Tests (30% of tests)

### 3.1 Command Tests

**Test Tauri commands**:
```rust
#[cfg(test)]
mod tests {
    use super::*;
    use tauri::test::{mock_context, MockRuntime};
    
    #[tokio::test]
    async fn test_send_transaction_command() {
        let app = tauri::test::mock_app();
        let state = create_test_state().await;
        
        let result = send_transaction(
            app.get_window("main").unwrap(),
            tauri::State::new(Arc::new(Mutex::new(state))),
            "0x1234567890abcdef1234567890abcdef12345678".to_string(),
            "1.5".to_string(),
        ).await;
        
        assert!(result.is_ok());
        assert!(result.unwrap().starts_with("0x"));
    }
    
    #[tokio::test]
    async fn test_origin_verification() {
        let app = tauri::test::mock_app();
        let state = create_test_state().await;
        
        // Create dApp window (should be rejected)
        let dapp_window = app.get_window("dapp-browser").unwrap();
        
        let result = send_transaction(
            dapp_window,
            tauri::State::new(Arc::new(Mutex::new(state))),
            "0x1234567890abcdef1234567890abcdef12345678".to_string(),
            "1.5".to_string(),
        ).await;
        
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Unauthorized"));
    }
}
```

### 3.2 State Management Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_state_initialization() {
        let state = VaughanState::new().await.unwrap();
        
        // Provider-independent controllers should be initialized
        assert!(state.wallet_controller.is_some());
        assert!(state.price_controller.is_some());
        
        // Provider-dependent controllers should be None
        assert!(state.transaction_controller.is_none());
        assert!(state.network_controller.is_none());
    }
    
    #[tokio::test]
    async fn test_network_switch() {
        let mut state = VaughanState::new().await.unwrap();
        
        // Switch network
        state.switch_network("https://rpc.pulsechain.com", 369).await.unwrap();
        
        // Provider-dependent controllers should now be initialized
        assert!(state.transaction_controller.is_some());
        assert!(state.network_controller.is_some());
        
        // Verify network
        assert_eq!(state.current_network.chain_id, 369);
    }
}
```

### 3.3 Frontend Integration Tests

**Test React Query integration**:
```typescript
import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useBalance } from './useBalance';

describe('useBalance', () => {
  it('fetches balance on mount', async () => {
    const queryClient = new QueryClient();
    const wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
    
    const { result } = renderHook(() => useBalance('0x123...'), { wrapper });
    
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe('1.5');
  });
  
  it('refetches on network change', async () => {
    // Test that balance refetches when network changes
  });
});
```

---

## 4. E2E Tests (10% of tests)

### 4.1 Critical User Flows

**Test with Playwright**:
```typescript
import { test, expect } from '@playwright/test';

test.describe('Wallet E2E', () => {
  test('send transaction flow', async ({ page }) => {
    // Launch app
    await page.goto('tauri://localhost');
    
    // Unlock wallet
    await page.fill('[data-testid="password-input"]', 'test-password');
    await page.click('[data-testid="unlock-button"]');
    
    // Wait for wallet to load
    await expect(page.locator('[data-testid="balance"]')).toBeVisible();
    
    // Open send dialog
    await page.click('[data-testid="send-button"]');
    
    // Fill form
    await page.fill('[data-testid="recipient-input"]', '0x1234567890abcdef1234567890abcdef12345678');
    await page.fill('[data-testid="amount-input"]', '0.1');
    
    // Confirm
    await page.click('[data-testid="confirm-button"]');
    
    // Wait for success
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    
    // Verify transaction appears in history
    await page.click('[data-testid="history-button"]');
    await expect(page.locator('[data-testid="transaction-0"]')).toBeVisible();
  });
  
  test('network switch flow', async ({ page }) => {
    await page.goto('tauri://localhost');
    await page.fill('[data-testid="password-input"]', 'test-password');
    await page.click('[data-testid="unlock-button"]');
    
    // Open network selector
    await page.click('[data-testid="network-selector"]');
    
    // Select different network
    await page.click('[data-testid="network-pulsechain"]');
    
    // Verify network changed
    await expect(page.locator('[data-testid="network-name"]')).toHaveText('PulseChain');
    
    // Verify balance updated
    await expect(page.locator('[data-testid="balance"]')).not.toHaveText('Loading...');
  });
});
```

### 4.2 dApp Integration Tests

**Test with real dApps**:
```typescript
test.describe('dApp Integration', () => {
  test('connect to Uniswap', async ({ page, context }) => {
    // Open wallet
    await page.goto('tauri://localhost');
    await page.fill('[data-testid="password-input"]', 'test-password');
    await page.click('[data-testid="unlock-button"]');
    
    // Open dApp browser
    await page.click('[data-testid="dapp-browser-button"]');
    
    // Navigate to Uniswap
    const dappPage = await context.waitForEvent('page');
    await dappPage.goto('https://app.uniswap.org');
    
    // Click connect wallet
    await dappPage.click('button:has-text("Connect Wallet")');
    await dappPage.click('button:has-text("MetaMask")');
    
    // Approve connection in wallet
    await page.click('[data-testid="approve-connection"]');
    
    // Verify connected
    await expect(dappPage.locator('[data-testid="wallet-address"]')).toBeVisible();
  });
  
  test('sign transaction from dApp', async ({ page, context }) => {
    // ... connect to dApp
    
    // Initiate swap on Uniswap
    await dappPage.fill('[data-testid="swap-input"]', '1');
    await dappPage.click('[data-testid="swap-button"]');
    
    // Approve transaction in wallet
    await page.waitForSelector('[data-testid="transaction-approval"]');
    await expect(page.locator('[data-testid="tx-amount"]')).toHaveText('1 ETH');
    await page.click('[data-testid="approve-transaction"]');
    
    // Verify transaction sent
    await expect(dappPage.locator('[data-testid="tx-pending"]')).toBeVisible();
  });
});
```

---

## 5. Security Tests

### 5.1 Penetration Testing

**XSS Tests**:
```typescript
test.describe('Security', () => {
  test('XSS in dApp iframe is blocked', async ({ page }) => {
    await page.goto('tauri://localhost');
    
    // Try to inject script via dApp URL
    await page.fill('[data-testid="dapp-url"]', 'javascript:alert("XSS")');
    await page.click('[data-testid="navigate-button"]');
    
    // Should be blocked
    await expect(page.locator('[data-testid="error-message"]')).toHaveText('Invalid URL');
  });
  
  test('dApp cannot access wallet commands', async ({ page }) => {
    // Open dApp
    await page.goto('tauri://localhost/dapp-browser');
    
    // Try to call wallet command from dApp
    const result = await page.evaluate(async () => {
      try {
        await window.__TAURI__.core.invoke('send_transaction', {
          to: '0x123...',
          amount: '1.0',
        });
        return 'success';
      } catch (e) {
        return e.message;
      }
    });
    
    expect(result).toContain('Unauthorized');
  });
});
```

### 5.2 Fuzzing Tests

**Property-based testing with proptest**:
```rust
use proptest::prelude::*;

proptest! {
    #[test]
    fn test_parse_amount_never_panics(
        amount_str in "\\d+\\.?\\d*",
        decimals in 0u8..=18u8
    ) {
        // Should never panic, even with invalid input
        let _ = parse_amount(&amount_str, decimals);
    }
    
    #[test]
    fn test_validate_address_never_panics(
        address_str in ".*"
    ) {
        // Should never panic, even with garbage input
        let _ = validate_address(&address_str);
    }
    
    #[test]
    fn test_transaction_validation_is_consistent(
        to in any::<Address>(),
        amount in any::<U256>(),
        gas_limit in any::<u64>(),
        balance in any::<U256>()
    ) {
        let controller = TransactionController::new();
        
        // Validation should be deterministic
        let result1 = controller.validate_transaction(to, amount, gas_limit, balance);
        let result2 = controller.validate_transaction(to, amount, gas_limit, balance);
        
        assert_eq!(result1.is_ok(), result2.is_ok());
    }
}
```

---

## 6. Performance Tests

### 6.1 Load Testing

```rust
#[tokio::test]
async fn test_concurrent_balance_requests() {
    let state = Arc::new(Mutex::new(VaughanState::new().await.unwrap()));
    
    // Simulate 100 concurrent balance requests
    let handles: Vec<_> = (0..100)
        .map(|_| {
            let state = state.clone();
            tokio::spawn(async move {
                get_balance(
                    tauri::State::new(state),
                    "0x1234567890abcdef1234567890abcdef12345678".to_string(),
                ).await
            })
        })
        .collect();
    
    // All should succeed
    for handle in handles {
        assert!(handle.await.unwrap().is_ok());
    }
}
```

### 6.2 Memory Leak Tests

```rust
#[tokio::test]
async fn test_no_memory_leak_on_repeated_operations() {
    let state = Arc::new(Mutex::new(VaughanState::new().await.unwrap()));
    
    let initial_memory = get_memory_usage();
    
    // Perform 1000 operations
    for _ in 0..1000 {
        let _ = get_balance(
            tauri::State::new(state.clone()),
            "0x1234567890abcdef1234567890abcdef12345678".to_string(),
        ).await;
    }
    
    let final_memory = get_memory_usage();
    
    // Memory should not grow significantly
    assert!(final_memory < initial_memory * 1.5);
}
```

---

## 7. Regression Tests

### 7.1 Bug Reproduction Tests

**When a bug is found, add a test**:
```rust
#[test]
fn test_bug_123_zero_amount_validation() {
    // Bug: Zero amount transactions were not rejected
    let controller = TransactionController::new();
    
    let result = controller.validate_transaction(
        Address::from_str("0x1234...").unwrap(),
        U256::ZERO,  // Zero amount
        21000,
        U256::from(1000),
    );
    
    // Should be rejected
    assert!(matches!(result, Err(TransactionError::ZeroAmount)));
}
```

### 7.2 Snapshot Tests

**For UI components**:
```typescript
import { render } from '@testing-library/react';
import { TransactionConfirmation } from './TransactionConfirmation';

test('renders transaction confirmation correctly', () => {
  const tx = {
    from: '0x1234...5678',
    to: '0xabcd...ef01',
    amount: '1.5',
    usdValue: '3000',
    gasFee: '0.002',
    gasFeeUsd: '4',
  };
  
  const { container } = render(<TransactionConfirmation tx={tx} />);
  
  // Compare with snapshot
  expect(container).toMatchSnapshot();
});
```

---

## 8. Test Coverage

### 8.1 Coverage Goals

- **Unit tests**: 80%+ coverage
- **Integration tests**: 60%+ coverage
- **E2E tests**: Critical paths only

### 8.2 Measuring Coverage

**Rust**:
```bash
cargo install cargo-tarpaulin
cargo tarpaulin --out Html --output-dir coverage
```

**TypeScript**:
```bash
npm run test -- --coverage
```

### 8.3 Coverage Reports

**CI/CD integration**:
```yaml
# .github/workflows/test.yml
- name: Run tests with coverage
  run: |
    cargo tarpaulin --out Xml
    npm run test -- --coverage
    
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v3
  with:
    files: ./cobertura.xml,./coverage/lcov.info
```

---

## 9. Test Data Management

### 9.1 Test Fixtures

```rust
// tests/fixtures/mod.rs
pub fn create_test_account() -> Account {
    Account {
        address: Address::from_str("0x1234567890abcdef1234567890abcdef12345678").unwrap(),
        name: "Test Account".to_string(),
        balance: U256::from(1_000_000_000_000_000_000u128), // 1 ETH
    }
}

pub fn create_test_transaction() -> Transaction {
    Transaction {
        from: create_test_account().address,
        to: Address::from_str("0xabcdef1234567890abcdef1234567890abcdef12").unwrap(),
        amount: U256::from(500_000_000_000_000_000u128), // 0.5 ETH
        gas_limit: 21000,
        gas_price: U256::from(20_000_000_000u128), // 20 Gwei
    }
}
```

### 9.2 Mock Services

```rust
#[cfg(test)]
pub struct MockProvider {
    balances: HashMap<Address, U256>,
    transactions: Vec<Transaction>,
}

impl MockProvider {
    pub fn new() -> Self {
        Self {
            balances: HashMap::new(),
            transactions: Vec::new(),
        }
    }
    
    pub fn set_balance(&mut self, address: Address, balance: U256) {
        self.balances.insert(address, balance);
    }
}

#[async_trait]
impl Provider for MockProvider {
    async fn get_balance(&self, address: Address) -> Result<U256> {
        Ok(self.balances.get(&address).copied().unwrap_or(U256::ZERO))
    }
    
    async fn send_transaction(&mut self, tx: Transaction) -> Result<TxHash> {
        self.transactions.push(tx);
        Ok(TxHash::random())
    }
}
```

---

## 10. Continuous Testing

### 10.1 Pre-commit Hooks

```bash
# .git/hooks/pre-commit
#!/bin/bash

# Run tests before commit
cargo test --lib
npm run test

if [ $? -ne 0 ]; then
    echo "Tests failed. Commit aborted."
    exit 1
fi
```

### 10.2 CI/CD Pipeline

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Rust
        uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - name: Run Rust tests
        run: cargo test --all-features
      
      - name: Run frontend tests
        run: |
          cd web
          npm install
          npm run test
      
      - name: Run E2E tests
        run: npm run test:e2e
```

---

## Summary: Testing Checklist

**Before Release**:
- [ ] All unit tests pass (80%+ coverage)
- [ ] All integration tests pass (60%+ coverage)
- [ ] All E2E tests pass (critical paths)
- [ ] Security tests pass (XSS, CSRF, origin verification)
- [ ] Performance tests pass (no memory leaks, handles load)
- [ ] Regression tests pass (all known bugs have tests)
- [ ] Manual testing on all platforms
- [ ] dApp integration tested with real dApps
- [ ] Penetration testing complete
- [ ] Code coverage reports reviewed

**Continuous**:
- [ ] Pre-commit hooks run tests
- [ ] CI/CD runs tests on every commit
- [ ] Coverage reports uploaded
- [ ] Failed tests block merges

**Test early, test often, test thoroughly.**
