# TokenList Component

Displays a scrollable list of tokens, matching the original Iced application design but utilizing Vite/React and Tailwind CSS.

## Features
- Shows Token Icon (derived from symbol if URL not provided)
- Shows Symbol and Name
- Formats wei balances correctly according to utilities
- Displays calculated USD value based on current token price
- Interactive, keyboard accessible, and includes hover/active states
- Includes Loading and Empty states

## Usage

```tsx
import { TokenList } from '@/components/TokenList';

const mockTokens = [
  {
    address: '0x123',
    symbol: 'ETH',
    name: 'Ethereum',
    balanceWei: '1500000000000000000', // 1.5 ETH
    decimals: 18,
    usdPrice: 2000,
  }
];

function Example() {
  return (
    <TokenList 
      tokens={mockTokens} 
      isLoading={false}
      onTokenClick={(token) => console.log(token.symbol)} 
    />
  );
}
```
