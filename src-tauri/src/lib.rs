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
    pub active_category: Mutex<Option<String>>,
    pub queue_locks: Mutex<std::collections::HashSet<String>>,
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
        let is_jingle_active = state.active_category.lock().unwrap().is_some();
        if !config.spotify_mute && is_jingle_active {
            // Keep muted in the mixer for now; the thread or stop event will unmute it later.
        } else {
            let _ = windows_audio::mute_spotify(config.spotify_mute);
        }
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
fn set_spotify_mixer_mute(state: State<'_, AppState>, mute: bool) -> Result<(), String> {
    let is_jingle_active = state.active_category.lock().unwrap().is_some();
    if !mute && is_jingle_active {
        // Keep muted in the mixer for now; the thread or stop event will unmute it later.
        Ok(())
    } else {
        windows_audio::mute_spotify(mute)
    }
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
    let is_locked = state.queue_locks.lock().unwrap().contains(&category_id);
    let queued_song = if let Some(queue) = queues.get_mut(&category_id) {
        if !queue.is_empty() {
            if is_locked {
                Some(queue[0].clone())
            } else {
                Some(queue.remove(0))
            }
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
                return Err("Keine Lieder in dieser Kategorie hinterlegt. Bitte füge über 'Lieder verwalten' Lieder hinzu.".to_string());
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
    
    // Set active category right before playing
    {
        let mut active_cat = state.active_category.lock().unwrap();
        *active_cat = Some(category_id.clone());
    }

    // Try playing the file, and roll back state if file fails to open/play
    if let Err(err) = state.player.play(&selected_song, play_vol) {
        {
            let mut active_cat = state.active_category.lock().unwrap();
            *active_cat = None;
        }
        if !config.spotify_mute && !config.master_mute {
            let _ = windows_audio::mute_spotify(false);
        }
        return Err(err);
    }
    
    // Spawn thread to monitor when the song ends and unmute Spotify
    let sink_clone = state.player.get_sink_clone();
    let generation_clone = state.player.get_generation_clone();
    let play_gen = state.player.get_current_generation();
    let app_clone = app.clone();
    let selected_song_clone = selected_song.clone();
    let play_vol_clone = play_vol;
    let category_id_clone = category_id.clone();

    std::thread::spawn(move || {
        // Sleep slightly to let the audio start playing
        std::thread::sleep(Duration::from_millis(200));
        loop {
            std::thread::sleep(Duration::from_millis(200));
            
            // Check if this thread has been superseded by a new jingle play or stop
            if generation_clone.load(std::sync::atomic::Ordering::SeqCst) != play_gen {
                break;
            }
            
            if let Some(app_state) = app_clone.try_state::<AppState>() {
                let active_cat = app_state.active_category.lock().unwrap().clone();
                if active_cat.as_ref() != Some(&category_id_clone) {
                    break;
                }
            } else {
                break;
            }
            
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
                        
                        // If looping is enabled and no new playback occurred, replay the song
                        if config.jingle_loop && generation_clone.load(std::sync::atomic::Ordering::SeqCst) == play_gen {
                            if let Ok(_) = app_state.player.play(&selected_song_clone, play_vol_clone) {
                                std::thread::sleep(Duration::from_millis(200));
                                continue;
                            }
                        }
                        
                        // Clear active category on backend since jingle finished naturally
                        {
                            let mut active_cat = app_state.active_category.lock().unwrap();
                            *active_cat = None;
                        }

                        if config.spotify_auto_fade_in && !config.spotify_mute && !config.master_mute {
                            let target_vol = config.spotify_volume;
                            let fade_duration = Duration::from_millis(config.spotify_fade_duration_ms as u64);
                            
                            let gen_check = generation_clone.clone();
                            let app_state_clone = app_clone.clone();
                            let _ = windows_audio::fade_in_spotify(target_vol, fade_duration, move || {
                                if gen_check.load(std::sync::atomic::Ordering::SeqCst) != play_gen {
                                    return true;
                                }
                                if let Some(st) = app_state_clone.try_state::<AppState>() {
                                    let cfg = st.config.lock().unwrap();
                                    cfg.master_mute || cfg.spotify_mute || !cfg.spotify_auto_fade_in
                                } else {
                                    true
                                }
                            });
                        }
                    }
                    break;
                }
                PlaybackStatus::StoppedManually => {
                    break;
                }
            }
        }
    });
    
    Ok(selected_song)
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
    // Clear active category
    {
        let mut active_cat = state.active_category.lock().unwrap();
        *active_cat = None;
    }

    let config = state.config.lock().unwrap().clone();
    
    if immediate {
        state.player.stop_immediate();
        
        let gen_now = state.player.get_current_generation();
        let gen_clone = state.player.get_generation_clone();
        let app_clone = app.clone();

        // Unmute Spotify in mixer immediately with cancellation check
        if config.spotify_auto_fade_in && !config.spotify_mute && !config.master_mute {
            let target_vol = config.spotify_volume;
            let spotify_fade_duration = Duration::from_millis(config.spotify_fade_duration_ms as u64);
            let _ = windows_audio::fade_in_spotify(target_vol, spotify_fade_duration, move || {
                if gen_clone.load(std::sync::atomic::Ordering::SeqCst) != gen_now {
                    return true;
                }
                if let Some(st) = app_clone.try_state::<AppState>() {
                    let cfg = st.config.lock().unwrap();
                    cfg.master_mute || cfg.spotify_mute || !cfg.spotify_auto_fade_in
                } else {
                    true
                }
            });
        }
    } else {
        state.player.stop_fade(Duration::from_millis(config.fade_duration_ms as u64));
        let gen_after_fade = state.player.get_current_generation();
        let gen_clone = state.player.get_generation_clone();
        
        // Unmute Spotify in mixer after fade duration
        if config.spotify_auto_fade_in && !config.spotify_mute && !config.master_mute {
            let target_vol = config.spotify_volume;
            let jingle_fade_duration = Duration::from_millis(config.fade_duration_ms as u64);
            let spotify_fade_duration = Duration::from_millis(config.spotify_fade_duration_ms as u64);
            
            let app_clone = app.clone();
            std::thread::spawn(move || {
                // Wait for jingle fade-out to complete + 50ms buffer
                std::thread::sleep(jingle_fade_duration + Duration::from_millis(50));
                
                // Only fade in Spotify if no other jingle was started in the meantime
                if gen_clone.load(std::sync::atomic::Ordering::SeqCst) != gen_after_fade {
                    return;
                }

                if let Some(app_state) = app_clone.try_state::<AppState>() {
                    let is_cat_active = app_state.active_category.lock().unwrap().is_some();
                    let cfg = app_state.config.lock().unwrap().clone();
                    if !is_cat_active && cfg.spotify_auto_fade_in && !cfg.spotify_mute && !cfg.master_mute {
                        let gen_inner = gen_clone.clone();
                        let app_inner = app_clone.clone();
                        let _ = windows_audio::fade_in_spotify(target_vol, spotify_fade_duration, move || {
                            if gen_inner.load(std::sync::atomic::Ordering::SeqCst) != gen_after_fade {
                                return true;
                            }
                            if let Some(st) = app_inner.try_state::<AppState>() {
                                let c = st.config.lock().unwrap();
                                c.master_mute || c.spotify_mute || !c.spotify_auto_fade_in
                            } else {
                                true
                            }
                        });
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
        // Restore player volume based on the active category if any, else default to 0.8
        let active_cat_opt = state.active_category.lock().unwrap().clone();
        let target_vol = if let Some(cat_id) = &active_cat_opt {
            if let Some(category) = config.categories.get(cat_id) {
                category.volume
            } else {
                0.8
            }
        } else {
            0.8
        };
        state.player.set_volume(target_vol);

        // Only unmute Spotify in the mixer if no jingle is currently playing and Spotify is not muted in config
        if active_cat_opt.is_none() && !config.spotify_mute {
            let _ = windows_audio::mute_spotify(false);
        }
    }
    
    Ok(())
}

#[tauri::command]
fn is_jingle_playing(state: State<'_, AppState>) -> bool {
    state.player.is_playing()
}

#[tauri::command]
fn get_active_category(state: State<'_, AppState>) -> Option<String> {
    state.active_category.lock().unwrap().clone()
}

#[tauri::command]
fn set_jingle_volume(state: State<'_, AppState>, vol: f32) {
    state.player.set_volume(vol);
}

#[tauri::command]
fn get_spotify_playback_state() -> bool {
    windows_audio::is_spotify_active()
}

#[tauri::command]
fn get_song_duration(path: String) -> Result<f64, String> {
    let file = std::fs::File::open(&path)
        .map_err(|e| format!("Failed to open file: {}", e))?;
    let reader = std::io::BufReader::new(file);
    let source = rodio::Decoder::new(reader)
        .map_err(|e| format!("Failed to decode audio file: {}", e))?;
    
    use rodio::Source;
    if let Some(duration) = source.total_duration() {
        Ok(duration.as_secs_f64())
    } else {
        // Fallback: decode the entire file and count the samples
        let sample_rate = source.sample_rate() as f64;
        let channels = source.channels() as f64;
        if sample_rate > 0.0 && channels > 0.0 {
            let sample_count = source.count() as f64;
            let duration_secs = sample_count / (channels * sample_rate);
            Ok(duration_secs)
        } else {
            Err("Unknown sample rate or channels".to_string())
        }
    }
}

#[tauri::command]
fn toggle_queue_lock(state: State<'_, AppState>, category_id: String) -> bool {
    let mut locks = state.queue_locks.lock().unwrap();
    if locks.contains(&category_id) {
        locks.remove(&category_id);
        false
    } else {
        locks.insert(category_id);
        true
    }
}

#[tauri::command]
fn get_queue_locks(state: State<'_, AppState>) -> Vec<String> {
    state.queue_locks.lock().unwrap().iter().cloned().collect()
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
                active_category: Mutex::new(None),
                queue_locks: Mutex::new(std::collections::HashSet::new()),
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
            get_active_category,
            set_jingle_volume,
            get_spotify_playback_state,
            get_song_duration,
            toggle_queue_lock,
            get_queue_locks,
            add_to_queue,
            remove_from_queue,
            get_queues,
            set_queue
        ])


        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
