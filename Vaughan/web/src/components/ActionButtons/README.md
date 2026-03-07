# ActionButtons Component

Displays the primary action buttons for the wallet interface (Send, Receive, dApps).
It uses the `vaughan-btn` CSS class to match the original Iced application's square button design with primary backgrounds and hover states.

## Features
- Fully responsive row of buttons
- Disabling capabilities
- Uses Lucide React icons
- Matches internal design language

## Usage

```tsx
import { ActionButtons } from '@/components/ActionButtons';

function Example() {
  return (
    <ActionButtons 
      onSendClick={() => console.log('Send Clicked')}
      onReceiveClick={() => console.log('Receive Clicked')}
      onDappBrowserClick={() => console.log('dApps Clicked')}
      disabled={false}
    />
  );
}
```
