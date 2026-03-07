# NetworkSelector

A dropdown component that allows the user to select the active blockchain network.

## Features
- Fetches supported networks on mount.
- Displays current active network.
- Uses Tauri IPC `switch_network` to handle the backend switch.
- Falls back gracefully if backend mapping is missing.

## Usage
```tsx
import { NetworkSelector } from '@/components/NetworkSelector';

export function Header() {
  return (
    <header className="flex justify-between items-center p-4">
      <div className="logo">Vaughan</div>
      <NetworkSelector onNetworkChange={(id) => console.log('Switched to:', id)} />
    </header>
  );
}
```
