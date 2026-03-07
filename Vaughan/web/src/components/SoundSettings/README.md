# SoundSettings Component

Provides user controls for customizing application audio settings.
Mimics existing layout from Iced GUI using native DOM inputs (`type="range"` and `select` dropdown).

## Features
- Toggle Enable/Disable
- Volume Slider (Range input)
- Sound Pack Select dropdown
- Test Audio Button
- Automatically greys-out inputs when disabled

## Usage

```tsx
import { useState } from 'react';
import { SoundSettings } from '@/components/SoundSettings';

function Example() {
  const [enabled, setEnabled] = useState(true);
  const [volume, setVolume] = useState(50);
  const [pack, setPack] = useState('Default');

  return (
    <SoundSettings 
      enabled={enabled}
      volume={volume}
      soundPack={pack}
      availablePacks={['Default', 'Minimal', 'Arcade']}
      onToggleEnabled={setEnabled}
      onVolumeChange={setVolume}
      onPackChange={setPack}
      onTestSound={() => console.log('Playing test sound...')}
    />
  );
}
```
