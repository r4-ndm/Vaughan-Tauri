# BalanceDisplay

A bold, center-aligned component designed to prominently display a user's balance. Recreates the aesthetic from the legacy framework.

## Features
- Periodically fetches wallet balances for an active address/network using Tauri IPC.
- Displays native token balance alongside USD conversion estimate.
- Built-in loading skeleton.

## Usage
```tsx
import { BalanceDisplay } from '@/components/BalanceDisplay';

export function DashboardView() {
  return (
    <div className="p-4">
      <BalanceDisplay address="0x123...abc" networkId="1" />
    </div>
  );
}
```
