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
    pub queues: Mutex<std::collections::HashMap<String, Vec<String>>>,
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
fn select_audio_files() -> Option<Vec<String>> {
    let files = rfd::FileDialog::new()
        .add_filter("Audio Files", &["mp3", "wav", "ogg", "m4a", "flac"])
        .pick_files();

    files.map(|paths| {
        paths
            .into_iter()
            .map(|p| p.to_string_lossy().to_string())
            .collect()
    })
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
        
    // Determine the song to play: check queue first, otherwise random
    let mut queues = state.queues.lock().unwrap();
    let queued_song = if let Some(queue) = queues.get_mut(&category_id) {
        if !queue.is_empty() {
            Some(queue.remove(0))
        } else {
            None
        }
    } else {
        None
    };

    let selected_song = match queued_song {
        Some(song) => song,
        None => {
            if category.songs.is_empty() {
                return Err("Keine Lieder in dieser Kategorie hinterlegt. Bitte füge in den Einstellungen Lieder hinzu.".to_string());
            }
            // Select random song
            let mut rng = rand::thread_rng();
            let rand_song = category.songs.choose(&mut rng)
                .ok_or_else(|| "Zufälliges Lied konnte nicht ausgewählt werden".to_string())?;
            rand_song.clone()
        }
    };
        
    // First, mute Spotify in the mixer
    let _ = windows_audio::mute_spotify(true);
    
    // Play the song at the category's specific volume
    // If master mute is on, play at 0 volume, otherwise category volume
    let play_vol = if config.master_mute { 0.0 } else { category.volume };
    state.player.play(&selected_song, play_vol)?;
    
    // Spawn thread to monitor when the song ends and unmute Spotify
    let sink_clone = state.player.get_sink_clone();
    let app_clone = app.clone();
    std::thread::spawn(move || {
        // Sleep slightly to let the audio start playing
        std::thread::sleep(Duration::from_millis(200));
        loop {
            std::thread::sleep(Duration::from_millis(200));
            
            enum PlaybackStatus {
                Playing,
                FinishedNaturally,
                StoppedManually,
            }
            
            let status = {
                let sink_lock = sink_clone.lock().unwrap();
                if let Some(sink) = &*sink_lock {
                    if sink.empty() {
                        PlaybackStatus::FinishedNaturally
                    } else {
                        PlaybackStatus::Playing
                    }
                } else {
                    PlaybackStatus::StoppedManually
                }
            };
            
            match status {
                PlaybackStatus::Playing => {
                    // Keep polling
                }
                PlaybackStatus::FinishedNaturally => {
                    if let Some(app_state) = app_clone.try_state::<AppState>() {
                        let config = app_state.config.lock().unwrap().clone();
                        if !config.spotify_mute && !config.master_mute {
                            // Only fade in if no other jingle is currently playing
                            if !app_state.player.is_playing() {
                                let target_vol = config.spotify_volume;
                                let fade_duration = Duration::from_millis(config.spotify_fade_duration_ms as u64);
                                let _ = windows_audio::fade_in_spotify(target_vol, fade_duration);
                            }
                        }
                    }
                    break;
                }
                PlaybackStatus::StoppedManually => {
                    // Stopped manually: exit immediately. The stopping thread will handle Spotify unmute/fade-in.
                    break;
                }
            }
        }
    });
    
    Ok(std::path::Path::new(&selected_song)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| selected_song.clone()))
}

#[tauri::command]
fn add_to_queue(state: State<'_, AppState>, category_id: String, song_path: String) -> Result<(), String> {
    let mut queues = state.queues.lock().unwrap();
    let queue = queues.entry(category_id).or_insert_with(Vec::new);
    if !queue.contains(&song_path) {
        queue.push(song_path);
    }
    Ok(())
}

#[tauri::command]
fn remove_from_queue(state: State<'_, AppState>, category_id: String, song_path: String) -> Result<(), String> {
    let mut queues = state.queues.lock().unwrap();
    if let Some(queue) = queues.get_mut(&category_id) {
        queue.retain(|x| x != &song_path);
    }
    Ok(())
}

#[tauri::command]
fn get_queues(state: State<'_, AppState>) -> Result<std::collections::HashMap<String, Vec<String>>, String> {
    let queues = state.queues.lock().unwrap();
    Ok(queues.clone())
}

#[tauri::command]
fn set_queue(state: State<'_, AppState>, category_id: String, new_queue: Vec<String>) -> Result<(), String> {
    let mut queues = state.queues.lock().unwrap();
    queues.insert(category_id, new_queue);
    Ok(())
}


#[tauri::command]
fn stop_current_jingle(app: AppHandle, state: State<'_, AppState>, immediate: bool) {
    let config = state.config.lock().unwrap().clone();
    
    if immediate {
        state.player.stop_immediate();
        
        // Unmute Spotify in mixer immediately
        if !config.spotify_mute && !config.master_mute {
            let target_vol = config.spotify_volume;
            let spotify_fade_duration = Duration::from_millis(config.spotify_fade_duration_ms as u64);
            let _ = windows_audio::fade_in_spotify(target_vol, spotify_fade_duration);
        }
    } else {
        state.player.stop_fade(Duration::from_millis(config.fade_duration_ms as u64));
        
        // Unmute Spotify in mixer after fade duration
        if !config.spotify_mute && !config.master_mute {
            let target_vol = config.spotify_volume;
            let jingle_fade_duration = Duration::from_millis(config.fade_duration_ms as u64);
            let spotify_fade_duration = Duration::from_millis(config.spotify_fade_duration_ms as u64);
            
            let app_clone = app.clone();
            std::thread::spawn(move || {
                // Wait for jingle to fade out first
                std::thread::sleep(jingle_fade_duration);
                
                // Only fade in Spotify if no other jingle was started in the meantime
                if let Some(app_state) = app_clone.try_state::<AppState>() {
                    if !app_state.player.is_playing() {
                        let _ = windows_audio::fade_in_spotify(target_vol, spotify_fade_duration);
                    }
                }
            });
        }
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
                queues: Mutex::new(std::collections::HashMap::new()),
            });
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_config,
            save_config_cmd,
            select_audio_files,
            toggle_spotify,
            set_spotify_mixer_volume,
            set_spotify_mixer_mute,
            play_category_jingle,
            stop_current_jingle,
            mute_all,
            is_jingle_playing,
            set_jingle_volume,
            get_spotify_playback_state,
            add_to_queue,
            remove_from_queue,
            get_queues,
            set_queue
        ])


        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
