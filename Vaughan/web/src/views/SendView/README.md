# Send Transaction View

The Send Transaction feature provides a secure, two-step flow for transferring assets across networks.

## Structure

- `SendView.tsx`: The initial form where users input the recipient address and amount. Features balance validation, real-time gas estimation, and an advanced dropdown for overriding Gas Limit and Gas Price.
- `SendConfirmView.tsx`: The final review step. It summarizes the transaction and requires the user to input their wallet password to sign and broadcast the transaction.

## Features

- **Amount Validation**: Users cannot send more than their current balance.
- **Max Button**: Easy auto-fill of the maximum available balance.
- **Gas Override**: Real-time gas estimation with an "Advanced" toggle to manually adjust limits and prices.
- **Security Confirmation**: Requires the wallet password to invoke the backend `send_transaction` command.

## Usage

This flow relies on `react-router-dom` to pass state between the views:

```tsx
// Inside App.tsx
import { SendView, SendConfirmView } from './views/SendView';

<Route path="/send" element={<SendView />} />
<Route path="/send-confirm" element={<SendConfirmView />} />
```
