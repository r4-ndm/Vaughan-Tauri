# AccountSelector

A dropdown component that allows the user to view and select their active wallet account.

## Features
- Fetches the user's accounts via Tauri IPC `get_accounts`.
- Displays truncated Ethereum addresses and account names.
- Provides a quick "Copy to Clipboard" button for each address.
- Highlights the currently selected account.

## Usage
```tsx
import { AccountSelector } from '@/components/AccountSelector';

export function Header() {
  return (
    <header className="flex justify-between items-center p-4">
      <AccountSelector />
    </header>
  );
}
```
