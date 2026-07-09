// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

use rand::seq::SliceRandom;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, State, Manager};

mod audio_player;
mod config;
mod windows_audio;

use audio_player::AudioPlayer;
use config::AppConfig;

pub struct AppState {
    pub player: AudioPlayer,
    pub config: Mutex<AppConfig>,
}

#[tauri::command]
fn get_config(state: State<'_, AppState>) -> AppConfig {
    state.config.lock().unwrap().clone()
}

#[tauri::command]
fn save_config_cmd(app: AppHandle, state: State<'_, AppState>, config: AppConfig) -> Result<(), String> {
    // Save to disk
    config::save_config(&app, &config)?;
    
    // Save to memory
    let mut local_config = state.config.lock().unwrap();
    
    // Apply changes if Spotify mute/volume changed
    if local_config.spotify_mute != config.spotify_mute {
        let _ = windows_audio::mute_spotify(config.spotify_mute);
    }
    if (local_config.spotify_volume - config.spotify_volume).abs() > 0.01 {
        let _ = windows_audio::set_spotify_volume(config.spotify_volume);
    }
    
    *local_config = config;
    Ok(())
}

#[tauri::command]
fn select_audio_file() -> Option<String> {
    let file = rfd::FileDialog::new()
        .add_filter("Audio Files", &["mp3", "wav", "ogg", "m4a", "flac"])
        .pick_file();

    file.map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
fn toggle_spotify() {
    windows_audio::simulate_media_key_play_pause();
}

#[tauri::command]
fn set_spotify_mixer_volume(vol: f32) -> Result<(), String> {
    windows_audio::set_spotify_volume(vol)
}

#[tauri::command]
fn set_spotify_mixer_mute(mute: bool) -> Result<(), String> {
    windows_audio::mute_spotify(mute)
}

#[tauri::command]
fn play_category_jingle(app: AppHandle, state: State<'_, AppState>, category_id: String) -> Result<String, String> {
    // Stop any running sound immediately since we are transitioning to a new state
    state.player.stop_immediate();

    let config = state.config.lock().unwrap().clone();
    
    let category = config.categories.get(&category_id)
        .ok_or_else(|| format!("Kategorie {} nicht gefunden", category_id))?;
        
    if category.songs.is_empty() {
        return Err("Keine Lieder in dieser Kategorie hinterlegt. Bitte füge in den Einstellungen Lieder hinzu.".to_string());
    }
    
    // Select random song
    let mut rng = rand::thread_rng();
    let selected_song = category.songs.choose(&mut rng)
        .ok_or_else(|| "Zufälliges Lied konnte nicht ausgewählt werden".to_string())?;
        
    // First, mute Spotify in the mixer
    let _ = windows_audio::mute_spotify(true);
    
    // Play the song at the category's specific volume
    // If master mute is on, play at 0 volume, otherwise category volume
    let play_vol = if config.master_mute { 0.0 } else { category.volume };
    state.player.play(selected_song, play_vol)?;
    
    // Spawn thread to monitor when the song ends and unmute Spotify
    let sink_clone = state.player.get_sink_clone();
    let app_clone = app.clone();
    std::thread::spawn(move || {
        // Sleep slightly to let the audio start playing
        std::thread::sleep(Duration::from_millis(200));
        loop {
            std::thread::sleep(Duration::from_millis(200));
            let is_finished = {
                let sink_lock = sink_clone.lock().unwrap();
                if let Some(sink) = &*sink_lock {
                    sink.empty()
                } else {
                    true
                }
            };
            if is_finished {
                if let Some(app_state) = app_clone.try_state::<AppState>() {
                    let config = app_state.config.lock().unwrap();
                    if !config.spotify_mute && !config.master_mute {
                        let _ = windows_audio::mute_spotify(false);
                    }
                }
                break;
            }
        }
    });
    
    Ok(std::path::Path::new(selected_song)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| selected_song.clone()))
}


#[tauri::command]
fn stop_current_jingle(state: State<'_, AppState>) {
    let config = state.config.lock().unwrap();
    state.player.stop_fade(Duration::from_millis(config.fade_duration_ms as u64));
    
    // Unmute Spotify in mixer
    if !config.spotify_mute && !config.master_mute {
        let _ = windows_audio::mute_spotify(false);
    }
}


#[tauri::command]
fn mute_all(state: State<'_, AppState>, mute: bool) -> Result<(), String> {
    let mut config = state.config.lock().unwrap();
    config.master_mute = mute;
    
    if mute {
        // Mute both player and Spotify
        state.player.set_volume(0.0);
        let _ = windows_audio::mute_spotify(true);
    } else {
        // Restore player volume and Spotify mute states based on config
        let _ = windows_audio::mute_spotify(config.spotify_mute);
        state.player.set_volume(0.8); // standard volume fallback
    }
    
    Ok(())
}

#[tauri::command]
fn is_jingle_playing(state: State<'_, AppState>) -> bool {
    state.player.is_playing()
}

#[tauri::command]
fn set_jingle_volume(state: State<'_, AppState>, vol: f32) {
    state.player.set_volume(vol);
}

#[tauri::command]
fn get_spotify_playback_state() -> bool {
    windows_audio::is_spotify_active()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Load config or use default
            let config = config::load_config(&app.handle());
            
            // Initialize Player
            let player = AudioPlayer::new().map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
            
            // Manage State
            app.manage(AppState {
                player,
                config: Mutex::new(config),
            });
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_config,
            save_config_cmd,
            select_audio_file,
            toggle_spotify,
            set_spotify_mixer_volume,
            set_spotify_mixer_mute,
            play_category_jingle,
            stop_current_jingle,
            mute_all,
            is_jingle_playing,
            set_jingle_volume,
            get_spotify_playback_state
        ])


        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
