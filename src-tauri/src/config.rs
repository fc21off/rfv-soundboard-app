use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::PathBuf;
use tauri::Manager;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct JingleCategory {
    pub id: String,
    pub name: String,
    pub volume: f32,       // 0.0 to 1.0
    pub songs: Vec<String>, // absolute file paths
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(default)]
pub struct AppConfig {
    pub spotify_volume: f32,
    pub spotify_mute: bool,
    pub master_mute: bool,
    pub theme: String,
    pub language: String,
    pub fade_duration_ms: u32,
    pub spotify_fade_duration_ms: u32,
    pub jingle_loop: bool,
    pub categories: HashMap<String, JingleCategory>,
}

impl Default for AppConfig {
    fn default() -> Self {
        let mut categories = HashMap::new();

        categories.insert(
            "pruefung".to_string(),
            JingleCategory {
                id: "pruefung".to_string(),
                name: "Prüfung eröffnen".to_string(),
                volume: 0.8,
                songs: Vec::new(),
            },
        );

        categories.insert(
            "fehlerfrei".to_string(),
            JingleCategory {
                id: "fehlerfrei".to_string(),
                name: "Fehlerfrei".to_string(),
                volume: 0.8,
                songs: Vec::new(),
            },
        );

        categories.insert(
            "einlauf".to_string(),
            JingleCategory {
                id: "einlauf".to_string(),
                name: "Siegerehrung Einlauf".to_string(),
                volume: 0.8,
                songs: Vec::new(),
            },
        );

        categories.insert(
            "siegerrunde".to_string(),
            JingleCategory {
                id: "siegerrunde".to_string(),
                name: "Siegerrunde".to_string(),
                volume: 0.8,
                songs: Vec::new(),
            },
        );

        categories.insert(
            "tusch".to_string(),
            JingleCategory {
                id: "tusch".to_string(),
                name: "Siegertusch".to_string(),
                volume: 0.8,
                songs: Vec::new(),
            },
        );

        Self {
            spotify_volume: 0.5,
            spotify_mute: false,
            master_mute: false,
            theme: "dark".to_string(),
            language: "de".to_string(),
            fade_duration_ms: 1200,
            spotify_fade_duration_ms: 1000,
            jingle_loop: false,
            categories,
        }
    }
}


// Get path to config file in Tauri App Data Directory
pub fn get_config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;
        
    // Create directory if it doesn't exist
    if !app_dir.exists() {
        fs::create_dir_all(&app_dir)
            .map_err(|e| format!("Failed to create app data directory: {}", e))?;
    }
    
    Ok(app_dir.join("config.json"))
}

// Load config from file, or return default if it doesn't exist
pub fn load_config(app: &tauri::AppHandle) -> AppConfig {
    let path = match get_config_path(app) {
        Ok(p) => p,
        Err(_) => return AppConfig::default(),
    };

    if !path.exists() {
        return AppConfig::default();
    }

    let mut file = match File::open(&path) {
        Ok(f) => f,
        Err(_) => return AppConfig::default(),
    };

    let mut contents = String::new();
    if file.read_to_string(&mut contents).is_err() {
        return AppConfig::default();
    }

    let mut config: AppConfig = serde_json::from_str(&contents).unwrap_or_else(|_| AppConfig::default());
    
    // Migration: ensure all default categories exist
    let default_config = AppConfig::default();
    let mut modified = false;
    for (id, cat) in default_config.categories {
        if !config.categories.contains_key(&id) {
            config.categories.insert(id, cat);
            modified = true;
        }
    }
    
    if modified {
        let _ = save_config(app, &config);
    }

    config
}

// Save config to file
pub fn save_config(app: &tauri::AppHandle, config: &AppConfig) -> Result<(), String> {
    let path = get_config_path(app)?;
    let serialized = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Serialization error: {}", e))?;

    let mut file = File::create(&path)
        .map_err(|e| format!("Failed to create config file: {}", e))?;

    file.write_all(serialized.as_bytes())
        .map_err(|e| format!("Failed to write config file: {}", e))?;

    Ok(())
}
