use crate::audio::{AlertSound, SoundConfig};
use crate::state::VaughanState;
use tauri::State;

#[tauri::command]
pub async fn play_sound(state: State<'_, VaughanState>, alert: AlertSound) -> Result<(), String> {
    state.sound_player.play(alert).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_sound_config(
    state: State<'_, VaughanState>,
    config: SoundConfig,
) -> Result<(), String> {
    state
        .sound_player
        .update_config(config)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_sound_config(state: State<'_, VaughanState>) -> Result<SoundConfig, String> {
    state.sound_player.get_config().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn test_sound(state: State<'_, VaughanState>, alert: AlertSound) -> Result<(), String> {
    // Test sound playback
    play_sound(state, alert).await
}
