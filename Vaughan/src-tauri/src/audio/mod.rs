use rodio::{Decoder, OutputStream, Sink};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::BufReader;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::thread;

/// Sound alert types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
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
    pub volume: f32,        // 0.0 to 1.0
    pub sound_pack: String, // "default", "minimal", "custom"
}

impl Default for SoundConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            volume: 0.5,
            sound_pack: "default".to_string(),
        }
    }
}

/// Sound player service
#[derive(Clone)]
pub struct SoundPlayer {
    config: Arc<Mutex<SoundConfig>>,
    // We don't store OutputStream because it's not Send/Sync and tied to the thread.
    // Instead, we spawn a thread for playback or use a global manager if needed.
    // For simplicity in this Tauri app, we'll open a new stream per playback or
    // use a dedicated audio thread channel if performance is an issue.
    // rodio::OutputStream::try_default() creates a stream on the default device.
}

impl SoundPlayer {
    pub fn new(config: SoundConfig) -> Self {
        Self {
            config: Arc::new(Mutex::new(config)),
        }
    }

    /// Play a sound alert
    pub fn play(&self, alert: AlertSound) -> Result<(), String> {
        let config = self.config.lock().map_err(|e| e.to_string())?.clone();

        if !config.enabled {
            return Ok(());
        }

        // Spawn a thread to handle audio playback so it doesn't block the async runtime
        // Audio streams in rodio must be kept alive while playing
        let config_clone = config.clone();
        let alert_clone = alert.clone();

        // We need to resolve the resource path relative to the app.
        // For now, we assume a "sounds" directory next to the binary or in the datadir.
        // In a real Tauri app, we should use the `app_handle.path_resolver()`.
        // Since we are inside the core logic, we might need to pass the base path.
        // For this implementation, we'll try to find "sounds/" in the current working directory.

        thread::spawn(move || {
            let (_stream, stream_handle) = match OutputStream::try_default() {
                Ok(s) => s,
                Err(e) => {
                    eprintln!("Failed to get default audio output: {}", e);
                    return;
                },
            };

            let sink = match Sink::try_new(&stream_handle) {
                Ok(s) => s,
                Err(e) => {
                    eprintln!("Failed to create audio sink: {}", e);
                    return;
                },
            };

            let sound_file = match Self::get_sound_file(&alert_clone, &config_clone.sound_pack) {
                Ok(p) => p,
                Err(e) => {
                    eprintln!("Failed to get sound file: {}", e);
                    return;
                },
            };

            // Attempt to open the file
            let file = match File::open(&sound_file) {
                Ok(f) => f,
                Err(e) => {
                    eprintln!("Failed to open sound file {:?}: {}", sound_file, e);
                    return;
                },
            };

            let reader = BufReader::new(file);
            let source = match Decoder::new(reader) {
                Ok(s) => s,
                Err(e) => {
                    eprintln!("Failed to decode sound file: {}", e);
                    return;
                },
            };

            sink.set_volume(config_clone.volume);
            sink.append(source);
            sink.sleep_until_end();
        });

        Ok(())
    }

    /// Get sound file path for alert type
    ///
    /// Tries multiple paths to find the sound file:
    /// 1. CWD/sounds/{pack}/{file} (running from src-tauri/)
    /// 2. CWD/src-tauri/sounds/{pack}/{file} (running from project root)
    /// 3. Executable-relative sounds/{pack}/{file} (release builds)
    fn get_sound_file(alert: &AlertSound, pack: &str) -> Result<PathBuf, String> {
        let filename = match alert {
            AlertSound::TransactionIncoming => "tx_incoming.wav",
            AlertSound::TransactionConfirmed => "tx_confirmed.wav",
            AlertSound::TransactionFailed => "tx_failed.wav",
            AlertSound::BalanceIncreased => "balance_up.wav",
            AlertSound::BalanceDecreased => "balance_down.wav",
            AlertSound::LowBalance => "low_balance.wav",
            AlertSound::DappRequest => "dapp_request.wav",
            AlertSound::SecurityAlert => "security_alert.wav",
            AlertSound::WalletUnlocked => "wallet_unlock.wav",
            AlertSound::Custom(name) => name.as_str(),
        };

        let cwd = std::env::current_dir().unwrap_or_default();

        // Try multiple paths
        let candidates = [
            // Running from src-tauri/ (cargo tauri dev)
            cwd.join("sounds").join(pack).join(filename),
            // Running from project root (Vaughan/)
            cwd.join("src-tauri")
                .join("sounds")
                .join(pack)
                .join(filename),
            // Executable-relative (release builds)
            std::env::current_exe()
                .unwrap_or_default()
                .parent()
                .unwrap_or(std::path::Path::new("."))
                .join("sounds")
                .join(pack)
                .join(filename),
        ];

        for path in &candidates {
            if path.exists() {
                eprintln!("[SoundPlayer] Found: {}", path.display());
                return Ok(path.clone());
            }
        }

        let msg = format!(
            "Sound file '{}' not found. Searched:\n{}",
            filename,
            candidates
                .iter()
                .map(|p| format!("  - {}", p.display()))
                .collect::<Vec<_>>()
                .join("\n")
        );
        eprintln!("[SoundPlayer] {}", msg);
        Err(msg)
    }

    /// Update configuration
    pub fn update_config(&self, config: SoundConfig) -> Result<(), String> {
        let mut cfg = self.config.lock().map_err(|e| e.to_string())?;
        *cfg = config;
        Ok(())
    }

    pub fn get_config(&self) -> Result<SoundConfig, String> {
        let cfg = self.config.lock().map_err(|e| e.to_string())?;
        Ok(cfg.clone())
    }
}
