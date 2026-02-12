# Sound Alert System - Vaughan Tauri

**Status**: Planned Feature  
**Priority**: Medium (Phase 2 or 3)  
**Primary References**: 
- **BDK (Bitcoin Dev Kit)** - Rust event-driven patterns (MIT/Apache 2.0) - https://github.com/bitcoindevkit/bdk
- **Specter Desktop** - Desktop wallet UX and notifications (MIT) - https://github.com/cryptoadvance/specter-desktop
- **Tauri Examples** - Audio playback and system notifications

**Why These References?**
- **BDK**: Production-ready Rust wallet library with excellent async transaction monitoring patterns
- **Specter Desktop**: Python-based desktop wallet with clean notification UX (concepts transferable to Tauri)
- **NOT Cake Wallet**: Wrong tech stack (Flutter/Dart vs Rust/Tauri) - patterns don't translate well

**License Compliance**: Original implementation, architectural patterns inspired by open-source wallets

---

## 🎯 Overview

A reliable, privacy-respecting sound alert system for transaction notifications across multiple chains.

**Key Improvements over Vaughan-old**:
- ✅ Reliable event detection (using Tauri's event system + BDK-inspired patterns)
- ✅ Multi-chain support (works with any ChainAdapter)
- ✅ Configurable per-chain and per-account
- ✅ Privacy-preserving (local-only monitoring by default)
- ✅ Cross-platform (Windows, Linux, macOS, Android)

**Architectural Inspiration**:
- **BDK's async monitoring** - Rust-native, production-ready transaction detection
- **Specter Desktop's UX** - Clean desktop wallet notification flow
- **Electrum's privacy model** - Local-first transaction monitoring

---

## 🔊 Alert Types

### 1. Transaction Alerts
- **Incoming transaction detected** (mempool)
- **Transaction confirmed** (1+ confirmations)
- **Transaction failed** (reverted or rejected)
- **Large transaction** (above user-defined threshold)

### 2. Account Alerts
- **Balance changed** (increase or decrease)
- **Low balance warning** (below threshold)
- **New token received** (ERC-20, etc.)

### 3. dApp Alerts
- **Transaction request** (dApp wants to send tx)
- **Signature request** (dApp wants to sign message)
- **Connection request** (dApp wants to connect)

### 4. System Alerts
- **Wallet unlocked**
- **Wallet locked** (auto-lock)
- **Security alert** (suspicious activity)

---

## 🏗️ Architecture

### Layer 1: Sound Engine (Rust)

```rust
// src-tauri/src/audio/mod.rs

use rodio::{Decoder, OutputStream, Sink, Source};
use std::fs::File;
use std::io::BufReader;
use std::sync::{Arc, Mutex};

/// Sound alert types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AlertSound {
    TransactionIncoming,
    TransactionConfirmed,
    TransactionFailed,
    BalanceIncreased,
    BalanceDecreased,
    LowBalance,
    DappRequest,
    SecurityAlert,
    WalletUnlocked,
    Custom(String),
}

/// Sound configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoundConfig {
    pub enabled: bool,
    pub volume: f32,  // 0.0 to 1.0
    pub sound_pack: String,  // "default", "minimal", "custom"
}

/// Sound player service
pub struct SoundPlayer {
    config: Arc<Mutex<SoundConfig>>,
    _stream: OutputStream,
    stream_handle: rodio::OutputStreamHandle,
}

impl SoundPlayer {
    pub fn new(config: SoundConfig) -> Result<Self, AudioError> {
        let (_stream, stream_handle) = OutputStream::try_default()?;
        
        Ok(Self {
            config: Arc::new(Mutex::new(config)),
            _stream,
            stream_handle,
        })
    }
    
    /// Play a sound alert
    pub fn play(&self, alert: AlertSound) -> Result<(), AudioError> {
        let config = self.config.lock().unwrap();
        
        if !config.enabled {
            return Ok(());
        }
        
        let sound_file = self.get_sound_file(&alert, &config.sound_pack)?;
        let file = BufReader::new(File::open(sound_file)?);
        let source = Decoder::new(file)?;
        
        // Apply volume
        let source = source.amplify(config.volume);
        
        // Play sound (non-blocking)
        self.stream_handle.play_raw(source.convert_samples())?;
        
        Ok(())
    }
    
    /// Get sound file path for alert type
    fn get_sound_file(&self, alert: &AlertSound, pack: &str) -> Result<PathBuf, AudioError> {
        let filename = match alert {
            AlertSound::TransactionIncoming => "tx_incoming.mp3",
            AlertSound::TransactionConfirmed => "tx_confirmed.mp3",
            AlertSound::TransactionFailed => "tx_failed.mp3",
            AlertSound::BalanceIncreased => "balance_up.mp3",
            AlertSound::BalanceDecreased => "balance_down.mp3",
            AlertSound::LowBalance => "low_balance.mp3",
            AlertSound::DappRequest => "dapp_request.mp3",
            AlertSound::SecurityAlert => "security_alert.mp3",
            AlertSound::WalletUnlocked => "wallet_unlock.mp3",
            AlertSound::Custom(name) => name.as_str(),
        };
        
        // Resolve path from app resources
        let path = format!("sounds/{}/{}", pack, filename);
        Ok(PathBuf::from(path))
    }
    
    /// Update configuration
    pub fn update_config(&self, config: SoundConfig) {
        *self.config.lock().unwrap() = config;
    }
}
```

### Layer 2: Transaction Monitor (Rust)

```rust
// src-tauri/src/monitoring/transaction_monitor.rs

use crate::chains::ChainAdapter;
use crate::audio::{SoundPlayer, AlertSound};
use tokio::time::{interval, Duration};

/// Monitors transactions for a specific chain
pub struct TransactionMonitor {
    chain_adapter: Arc<dyn ChainAdapter>,
    sound_player: Arc<SoundPlayer>,
    watched_addresses: Vec<String>,
    last_checked_block: u64,
}

impl TransactionMonitor {
    pub fn new(
        chain_adapter: Arc<dyn ChainAdapter>,
        sound_player: Arc<SoundPlayer>,
    ) -> Self {
        Self {
            chain_adapter,
            sound_player,
            watched_addresses: Vec::new(),
            last_checked_block: 0,
        }
    }
    
    /// Add address to watch list
    pub fn watch_address(&mut self, address: String) {
        if !self.watched_addresses.contains(&address) {
            self.watched_addresses.push(address);
        }
    }
    
    /// Start monitoring (runs in background)
    pub async fn start_monitoring(&mut self, window: tauri::Window) {
        let mut interval = interval(Duration::from_secs(15)); // Check every 15 seconds
        
        loop {
            interval.tick().await;
            
            if let Err(e) = self.check_for_new_transactions(&window).await {
                eprintln!("Transaction monitoring error: {}", e);
            }
        }
    }
    
    /// Check for new transactions
    async fn check_for_new_transactions(&mut self, window: &tauri::Window) -> Result<()> {
        for address in &self.watched_addresses {
            // Get recent transactions
            let txs = self.chain_adapter
                .get_transactions(address, 10)
                .await?;
            
            for tx in txs {
                // Check if this is a new transaction
                if tx.block_number > self.last_checked_block {
                    self.handle_new_transaction(tx, window).await?;
                }
            }
        }
        
        Ok(())
    }
    
    /// Handle a new transaction
    async fn handle_new_transaction(&self, tx: TxRecord, window: &tauri::Window) -> Result<()> {
        // Determine alert type
        let alert = if tx.is_incoming {
            AlertSound::TransactionIncoming
        } else {
            AlertSound::TransactionConfirmed
        };
        
        // Play sound
        self.sound_player.play(alert)?;
        
        // Emit event to frontend
        window.emit("new-transaction", &tx)?;
        
        // Show system notification (optional)
        self.show_system_notification(&tx)?;
        
        Ok(())
    }
    
    /// Show system notification
    fn show_system_notification(&self, tx: &TxRecord) -> Result<()> {
        // Use tauri-plugin-notification or native notifications
        // Platform-specific implementation
        Ok(())
    }
}
```

### Layer 3: Tauri Commands

```rust
// src-tauri/src/commands/audio.rs

#[tauri::command]
pub async fn play_sound(
    state: State<'_, Arc<Mutex<VaughanState>>>,
    alert: AlertSound,
) -> Result<(), String> {
    let app_state = state.lock().await;
    
    app_state.sound_player
        .play(alert)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_sound_config(
    state: State<'_, Arc<Mutex<VaughanState>>>,
    config: SoundConfig,
) -> Result<(), String> {
    let app_state = state.lock().await;
    
    app_state.sound_player.update_config(config);
    
    // Save to persistent storage
    app_state.save_sound_config(&config)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_sound_config(
    state: State<'_, Arc<Mutex<VaughanState>>>,
) -> Result<SoundConfig, String> {
    let app_state = state.lock().await;
    
    app_state.load_sound_config()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn test_sound(
    state: State<'_, Arc<Mutex<VaughanState>>>,
    alert: AlertSound,
) -> Result<(), String> {
    // Test sound playback
    play_sound(state, alert).await
}
```

### Layer 4: Frontend Integration

```typescript
// web/src/services/soundService.ts

import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';

export enum AlertSound {
  TransactionIncoming = 'TransactionIncoming',
  TransactionConfirmed = 'TransactionConfirmed',
  TransactionFailed = 'TransactionFailed',
  BalanceIncreased = 'BalanceIncreased',
  BalanceDecreased = 'BalanceDecreased',
  LowBalance = 'LowBalance',
  DappRequest = 'DappRequest',
  SecurityAlert = 'SecurityAlert',
  WalletUnlocked = 'WalletUnlocked',
}

export interface SoundConfig {
  enabled: boolean;
  volume: number;  // 0.0 to 1.0
  soundPack: string;
}

export class SoundService {
  private static instance: SoundService;
  
  private constructor() {
    this.setupEventListeners();
  }
  
  static getInstance(): SoundService {
    if (!SoundService.instance) {
      SoundService.instance = new SoundService();
    }
    return SoundService.instance;
  }
  
  /**
   * Play a sound alert
   */
  async playSound(alert: AlertSound): Promise<void> {
    await invoke('play_sound', { alert });
  }
  
  /**
   * Update sound configuration
   */
  async updateConfig(config: SoundConfig): Promise<void> {
    await invoke('update_sound_config', { config });
  }
  
  /**
   * Get current sound configuration
   */
  async getConfig(): Promise<SoundConfig> {
    return await invoke('get_sound_config');
  }
  
  /**
   * Test a sound
   */
  async testSound(alert: AlertSound): Promise<void> {
    await invoke('test_sound', { alert });
  }
  
  /**
   * Set up event listeners for automatic sound playback
   */
  private setupEventListeners() {
    // Listen for new transactions
    listen('new-transaction', (event) => {
      const tx = event.payload as Transaction;
      
      if (tx.isIncoming) {
        this.playSound(AlertSound.TransactionIncoming);
      }
    });
    
    // Listen for balance changes
    listen('balance-changed', (event) => {
      const { oldBalance, newBalance } = event.payload as any;
      
      if (newBalance > oldBalance) {
        this.playSound(AlertSound.BalanceIncreased);
      } else {
        this.playSound(AlertSound.BalanceDecreased);
      }
    });
    
    // Listen for dApp requests
    listen('dapp-request', () => {
      this.playSound(AlertSound.DappRequest);
    });
  }
}
```

---

## 🎨 UI Components

### Sound Settings Panel

```typescript
// web/src/components/SoundSettings.tsx

import React, { useState, useEffect } from 'react';
import { SoundService, AlertSound, SoundConfig } from '../services/soundService';

export function SoundSettings() {
  const [config, setConfig] = useState<SoundConfig>({
    enabled: true,
    volume: 0.7,
    soundPack: 'default',
  });
  
  const soundService = SoundService.getInstance();
  
  useEffect(() => {
    // Load current config
    soundService.getConfig().then(setConfig);
  }, []);
  
  const handleToggle = async (enabled: boolean) => {
    const newConfig = { ...config, enabled };
    setConfig(newConfig);
    await soundService.updateConfig(newConfig);
  };
  
  const handleVolumeChange = async (volume: number) => {
    const newConfig = { ...config, volume };
    setConfig(newConfig);
    await soundService.updateConfig(newConfig);
  };
  
  const handleTestSound = async (alert: AlertSound) => {
    await soundService.testSound(alert);
  };
  
  return (
    <div className="sound-settings">
      <h3>Sound Alerts</h3>
      
      {/* Enable/Disable */}
      <div className="setting-row">
        <label>Enable Sound Alerts</label>
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(e) => handleToggle(e.target.checked)}
        />
      </div>
      
      {/* Volume Control */}
      <div className="setting-row">
        <label>Volume: {Math.round(config.volume * 100)}%</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={config.volume}
          onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
          disabled={!config.enabled}
        />
      </div>
      
      {/* Sound Pack Selection */}
      <div className="setting-row">
        <label>Sound Pack</label>
        <select
          value={config.soundPack}
          onChange={(e) => {
            const newConfig = { ...config, soundPack: e.target.value };
            setConfig(newConfig);
            soundService.updateConfig(newConfig);
          }}
          disabled={!config.enabled}
        >
          <option value="default">Default</option>
          <option value="minimal">Minimal</option>
          <option value="custom">Custom</option>
        </select>
      </div>
      
      {/* Test Sounds */}
      <div className="test-sounds">
        <h4>Test Sounds</h4>
        <button onClick={() => handleTestSound(AlertSound.TransactionIncoming)}>
          Incoming Transaction
        </button>
        <button onClick={() => handleTestSound(AlertSound.TransactionConfirmed)}>
          Transaction Confirmed
        </button>
        <button onClick={() => handleTestSound(AlertSound.DappRequest)}>
          dApp Request
        </button>
      </div>
    </div>
  );
}
```

---

## 📁 Sound Assets

### Directory Structure

```
src-tauri/sounds/
├── default/
│   ├── tx_incoming.mp3
│   ├── tx_confirmed.mp3
│   ├── tx_failed.mp3
│   ├── balance_up.mp3
│   ├── balance_down.mp3
│   ├── low_balance.mp3
│   ├── dapp_request.mp3
│   ├── security_alert.mp3
│   └── wallet_unlock.mp3
├── minimal/
│   └── (same files, different sounds)
└── custom/
    └── (user-provided sounds)
```

### Sound Requirements

- **Format**: MP3 or OGG (cross-platform support)
- **Duration**: 0.5-2 seconds (short and non-intrusive)
- **File Size**: < 50KB per file
- **Sample Rate**: 44.1kHz
- **Bitrate**: 128kbps

---

## 🔒 Privacy Considerations

### 1. Local-Only Monitoring (Default)
- Monitor transactions using local RPC node
- No third-party services by default
- User controls polling frequency

### 2. Optional Cloud Monitoring
- User can opt-in to use block explorer APIs
- Faster notifications but less private
- Clear privacy warning in settings

### 3. Address Privacy
- Don't send addresses to third parties without consent
- Use encrypted storage for watched addresses
- Clear watched addresses on wallet lock

---

## ⚙️ Configuration Options

### Per-Chain Settings

```typescript
interface ChainSoundConfig {
  chainType: ChainType;
  enabled: boolean;
  minAmount: string;  // Only alert for amounts above this
  confirmations: number;  // Alert after X confirmations
}
```

### Per-Account Settings

```typescript
interface AccountSoundConfig {
  accountId: string;
  enabled: boolean;
  alertTypes: AlertSound[];  // Which alerts to enable
}
```

---

## 🧪 Testing Strategy

### Unit Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_sound_player_creation() {
        let config = SoundConfig {
            enabled: true,
            volume: 0.5,
            sound_pack: "default".to_string(),
        };
        
        let player = SoundPlayer::new(config);
        assert!(player.is_ok());
    }
    
    #[test]
    fn test_sound_file_resolution() {
        let player = create_test_player();
        let path = player.get_sound_file(
            &AlertSound::TransactionIncoming,
            "default"
        );
        
        assert!(path.is_ok());
        assert!(path.unwrap().ends_with("tx_incoming.mp3"));
    }
}
```

### Integration Tests

```rust
#[tokio::test]
async fn test_transaction_monitoring() {
    let monitor = create_test_monitor();
    
    // Simulate new transaction
    let tx = create_test_transaction();
    
    // Verify sound is played
    // Verify event is emitted
}
```

---

## 📋 Implementation Tasks

### Phase 2 (Wallet UI) - Basic Implementation
- [ ] Add rodio dependency to Cargo.toml
- [ ] Implement SoundPlayer struct
- [ ] Create basic sound assets (default pack)
- [ ] Implement Tauri commands for sound playback
- [ ] Add sound settings UI component
- [ ] Test sound playback on all platforms

### Phase 3 (dApp Integration) - Full Implementation
- [ ] Implement TransactionMonitor
- [ ] Add event listeners for automatic playback
- [ ] Implement per-chain configuration
- [ ] Implement per-account configuration
- [ ] Add dApp request sounds
- [ ] Add system notification integration

### Phase 4 (Polish) - Advanced Features
- [ ] Add custom sound pack support
- [ ] Implement sound pack marketplace (optional)
- [ ] Add visual indicators (for accessibility)
- [ ] Performance optimization
- [ ] Cross-platform testing

---

## 🎯 Success Criteria

- [ ] Sounds play reliably on all platforms
- [ ] No performance impact on wallet operations
- [ ] User can customize all alert types
- [ ] Privacy-preserving by default
- [ ] Accessible (visual alternatives available)
- [ ] Works with all supported chains

---

## 📚 References

### Primary References (Rust + Desktop Wallets)

1. **BDK (Bitcoin Dev Kit)** - https://github.com/bitcoindevkit/bdk
   - License: MIT/Apache 2.0
   - **Why**: Production-ready Rust wallet library with excellent async patterns
   - **What we borrow**: Event-driven architecture, transaction monitoring patterns
   - **Note**: BDK is Bitcoin-specific, but patterns apply to all chains

2. **Specter Desktop** - https://github.com/cryptoadvance/specter-desktop
   - License: MIT
   - **Why**: Clean desktop wallet UX with hardware wallet focus
   - **What we borrow**: Notification UX patterns, user preferences structure
   - **Note**: Python-based, but UX concepts are language-agnostic

3. **Rodio (Audio Library)** - https://github.com/RustAudio/rodio
   - License: MIT/Apache 2.0
   - **Why**: Pure Rust audio playback, cross-platform
   - **What we use**: Direct dependency for sound playback

4. **Tauri Notification Plugin** - https://github.com/tauri-apps/tauri-plugin-notification
   - License: MIT/Apache 2.0
   - **Why**: Native system notifications for Tauri apps
   - **What we use**: System notification integration

---

## 🚀 Future Enhancements

- **Voice Alerts**: Text-to-speech for transaction amounts
- **Haptic Feedback**: Vibration on mobile (Android)
- **Custom Ringtones**: User-provided sound files
- **Sound Themes**: Community-created sound packs
- **Conditional Alerts**: Complex rules (e.g., "alert if > $1000")
- **Do Not Disturb**: Schedule quiet hours

---

**This sound alert system will be more reliable than Vaughan-old by using Tauri's event system and proper async monitoring!**
