# NetworkSelector Component

Displays the current network and provides a dropdown menu to switch between available networks.

## Features

- Shows current network with colored indicator dot
- Dropdown menu with all available networks
- Visual feedback for active network (checkmark)
- Accessible using Headless UI Menu component
- Loading and error states
- Smooth transitions and hover effects

## Usage

```tsx
import { NetworkSelector } from './components/NetworkSelector';

function Header() {
  return (
    <div className="flex items-center gap-4">
      <NetworkSelector />
    </div>
  );
}
```

## Props

None - component manages its own state by calling Tauri commands.

## Tauri Commands Used

- `get_networks()` - Fetches list of available networks
- `get_network_info()` - Gets current network information
- `switch_network(network_id)` - Switches to a different network

## Styling

Uses Tailwind CSS with custom dark theme colors:
- Background: `bg-slate-800`
- Hover: `bg-slate-700`
- Border: `border-slate-700`
- Text: `text-slate-100`, `text-slate-400`

## Accessibility

- Keyboard navigation supported (Tab, Enter, Escape)
- ARIA labels provided by Headless UI
- Focus states visible
- Screen reader friendly

## Dependencies

- `@headlessui/react` - Accessible dropdown menu
- `@heroicons/react` - Icons (ChevronDown, Check)
- `../../services/tauri` - Tauri command wrappers
- `../../types` - TypeScript type definitions
