import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

interface JingleCategory {
  id: string;
  name: string;
  volume: number;
  songs: string[];
}

interface AppConfig {
  spotify_volume: number;
  spotify_mute: boolean;
  master_mute: boolean;
  categories: Record<string, JingleCategory>;
}

const CATEGORIES_INFO = [
  { id: "pruefung", label: "Prüfung eröffnen", desc: "Startfreigabe / Einzug der Reiter", cssClass: "pruefung" },
  { id: "fehlerfrei", label: "Fehlerfrei", desc: "Glückwunsch! Fehlerfreie Runde", cssClass: "fehlerfrei" },
  { id: "einlauf", label: "Siegerehrung Einlauf", desc: "Einmarsch zur Siegerehrung", cssClass: "einlauf" },
  { id: "siegerrunde", label: "Siegerrunde", desc: "Ehrenrunde des Siegers", cssClass: "siegerrunde" },
];

function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [playingSong, setPlayingSong] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load config on mount
  useEffect(() => {
    loadConfig();
  }, []);

  // Poll for audio playback status
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const isPlaying = await invoke<boolean>("is_jingle_playing");
        if (!isPlaying) {
          setActiveCategory(null);
          setPlayingSong(null);
        }
      } catch (err) {
        console.error("Failed to check if jingle is playing:", err);
      }
    }, 400);

    return () => clearInterval(interval);
  }, []);

  async function loadConfig() {
    try {
      const cfg = await invoke<AppConfig>("get_config");
      setConfig(cfg);
    } catch (err) {
      console.error("Failed to load config:", err);
    }
  }

  async function saveConfig(updatedConfig: AppConfig) {
    try {
      await invoke("save_config_cmd", { config: updatedConfig });
      setConfig(updatedConfig);
    } catch (err) {
      console.error("Failed to save config:", err);
    }
  }

  // Trigger media key play/pause
  async function handleSpotifyToggle() {
    try {
      await invoke("toggle_spotify");
    } catch (err) {
      console.error("Failed to toggle Spotify:", err);
    }
  }

  // Change Spotify volume in mixer
  async function handleSpotifyVolumeChange(vol: number) {
    if (!config) return;
    try {
      const updatedConfig = { ...config, spotify_volume: vol };
      setConfig(updatedConfig);
      await invoke("set_spotify_mixer_volume", { vol });
      await invoke("save_config_cmd", { config: updatedConfig });
    } catch (err) {
      console.error("Failed to set Spotify volume:", err);
    }
  }

  // Toggle Spotify mute
  async function handleSpotifyMuteToggle() {
    if (!config) return;
    try {
      const newMute = !config.spotify_mute;
      const updatedConfig = { ...config, spotify_mute: newMute };
      setConfig(updatedConfig);
      await invoke("set_spotify_mixer_mute", { mute: newMute });
      await invoke("save_config_cmd", { config: updatedConfig });
    } catch (err) {
      console.error("Failed to set Spotify mute:", err);
    }
  }

  // Master Mute
  async function handleMasterMuteToggle() {
    if (!config) return;
    try {
      const newMute = !config.master_mute;
      const updatedConfig = { ...config, master_mute: newMute };
      setConfig(updatedConfig);
      await invoke("mute_all", { mute: newMute });
      await invoke("save_config_cmd", { config: updatedConfig });
      
      if (newMute) {
        setActiveCategory(null);
        setPlayingSong(null);
      }
    } catch (err) {
      console.error("Failed to toggle master mute:", err);
    }
  }

  // Trigger Jingle
  async function handleTriggerJingle(categoryId: string) {
    if (!config || config.master_mute) return;
    setErrorMessage(null);
    try {
      setActiveCategory(categoryId);
      setPlayingSong("Lädt...");
      const songName = await invoke<string>("play_category_jingle", { categoryId });
      setPlayingSong(songName);
    } catch (err) {
      setActiveCategory(null);
      setPlayingSong(null);
      setErrorMessage(String(err));
    }
  }

  // Stop Jingle
  async function handleStopJingle() {
    try {
      await invoke("stop_current_jingle");
      setActiveCategory(null);
      setPlayingSong(null);
    } catch (err) {
      console.error("Failed to stop jingle:", err);
    }
  }

  // Change individual category volume
  async function handleCategoryVolumeChange(categoryId: string, vol: number) {
    if (!config) return;
    try {
      const updatedConfig = { ...config };
      updatedConfig.categories[categoryId].volume = vol;
      setConfig(updatedConfig);
      
      if (activeCategory === categoryId) {
        await invoke("set_jingle_volume", { vol });
      }
      
      await invoke("save_config_cmd", { config: updatedConfig });
    } catch (err) {
      console.error("Failed to save category volume:", err);
    }
  }

  // File picker to add song
  async function handleAddSong(categoryId: string) {
    if (!config) return;
    try {
      const selectedPath = await invoke<string | null>("select_audio_file");
      if (selectedPath) {
        const updatedConfig = { ...config };
        const category = updatedConfig.categories[categoryId];
        if (!category.songs.includes(selectedPath)) {
          category.songs.push(selectedPath);
          await saveConfig(updatedConfig);
        }
      }
    } catch (err) {
      console.error("Failed to add song:", err);
    }
  }

  // Remove song
  async function handleRemoveSong(categoryId: string, songPath: string) {
    if (!config) return;
    try {
      const updatedConfig = { ...config };
      const category = updatedConfig.categories[categoryId];
      category.songs = category.songs.filter((s) => s !== songPath);
      await saveConfig(updatedConfig);
    } catch (err) {
      console.error("Failed to remove song:", err);
    }
  }

  // Helper to extract filename from path for clean rendering
  function getFileName(path: string): string {
    return path.split(/[/\\]/).pop() || path;
  }

  if (!config) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <p style={{ color: "#84a28f", fontSize: "1.2rem" }}>Lade RFV Leonberg Musik-Steuerung...</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="brand">
          <h1>RFV LEONBERG</h1>
          <span>Musiksteuerung & Turniersound</span>
        </div>
        <button className="settings-toggle-btn" onClick={() => setIsSettingsOpen(true)}>
          ⚙️ Einstellungen & Lieder
        </button>
      </header>

      {/* Error Alert */}
      {errorMessage && (
        <div style={{
          background: "rgba(239, 68, 68, 0.15)",
          border: "1px solid rgba(239, 68, 68, 0.4)",
          borderRadius: "12px",
          padding: "1rem",
          color: "#f87171",
          fontSize: "0.95rem",
          display: "flex",
          justifyContent: "between",
          alignItems: "center"
        }}>
          <span>{errorMessage}</span>
          <button 
            style={{ background: "transparent", border: "none", color: "#f87171", cursor: "pointer", fontWeight: "bold" }}
            onClick={() => setErrorMessage(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Row: System Controls (Spotify + Master Mute) */}
      <div className="system-row">
        {/* Spotify Control */}
        <div className="panel-card spotify-panel">
          <div className="spotify-controller">
            <button 
              className="spotify-btn" 
              onClick={handleSpotifyToggle}
              title="Spotify Start / Stopp (Globale Medientaste)"
            >
              <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424c-.18.295-.565.387-.86.207-2.377-1.454-5.37-1.783-8.893-.982-.336.075-.668-.135-.744-.47-.077-.337.135-.669.47-.745 3.848-.879 7.143-.51 9.82.13.296.18.387.563.207.86zm1.224-2.723c-.226.367-.707.487-1.074.26-2.72-1.672-6.87-2.157-10.08-1.182-.413.125-.847-.107-.972-.52-.125-.413.108-.847.52-.972 3.67-1.114 8.24-.57 11.35 1.346.366.226.486.707.256 1.068zm.105-2.81c-3.26-1.937-8.644-2.12-11.758-1.173-.5.152-1.025-.133-1.177-.633-.151-.5.133-1.026.633-1.178 3.596-1.092 9.539-.882 13.3 1.348.448.266.596.843.33 1.291-.266.449-.842.597-1.29.33-.001 0-.002-.001-.003-.002z"/>
              </svg>
            </button>
            <div className="spotify-info">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="spotify-label">SPOTIFY AUDIO-KANAL</span>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "0.85rem", color: "#94a3b8" }}>
                  <input 
                    type="checkbox" 
                    checked={config.spotify_mute} 
                    onChange={handleSpotifyMuteToggle}
                    style={{ cursor: "pointer" }}
                  />
                  Stumm (Mute)
                </label>
              </div>
              <div className="spotify-volume-wrapper">
                <span style={{ fontSize: "1.2rem" }}>🔉</span>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={config.spotify_volume * 100} 
                  onChange={(e) => handleSpotifyVolumeChange(Number(e.target.value) / 100)}
                  style={{ flexGrow: 1, accentColor: "#1db954", cursor: "pointer" }}
                />
                <span style={{ fontFamily: "monospace", fontSize: "0.9rem", minWidth: "35px", textAlign: "right" }}>
                  {Math.round(config.spotify_volume * 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Master Mute */}
        <div className="panel-card mute-panel">
          <button 
            className={`master-mute-btn ${config.master_mute ? "active" : ""}`}
            onClick={handleMasterMuteToggle}
          >
            <span>🔇</span> {config.master_mute ? "TON AKTIVIEREN" : "ALLE SOUNDS AUS (MUTE)"}
          </button>
        </div>
      </div>

      {/* Main Jingle Grid */}
      <div className="trigger-grid">
        {CATEGORIES_INFO.map((cat) => {
          const categoryData = config.categories[cat.id];
          const songCount = categoryData?.songs.length || 0;
          const isPlaying = activeCategory === cat.id;

          return (
            <div 
              key={cat.id} 
              className={`trigger-card ${cat.cssClass} ${isPlaying ? "playing" : ""}`}
              onClick={() => handleTriggerJingle(cat.id)}
            >
              <div className="card-title">
                {cat.label}
                <span className="song-count-badge">{songCount} {songCount === 1 ? "Lied" : "Lieder"}</span>
              </div>
              <p className="card-description">{cat.desc}</p>
              
              {isPlaying && (
                <div className="playing-status">
                  <div className="sound-wave">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <span style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                    Aktiv: {playingSong ? getFileName(playingSong) : "Lädt..."}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Stop Jingle Banner */}
      <div className="stop-banner">
        <button 
          className={`stop-jingle-btn ${activeCategory ? "active" : ""}`}
          onClick={handleStopJingle}
          disabled={!activeCategory}
        >
          <span>🛑</span> Jingle Stoppen (Fading)
        </button>
      </div>

      {/* Mixer Section */}
      <section className="mixer-section">
        <h2>Lautstärke-Mischpult</h2>
        <div className="mixer-grid">
          {/* Spotify Channel */}
          <div className="mixer-channel" style={{ borderTop: "3px solid #1db954" }}>
            <span style={{ fontSize: "1.1rem" }}>🟢</span>
            <div className="fader-wrapper">
              <input 
                type="range"
                className="fader-input"
                min="0"
                max="100"
                value={config.spotify_volume * 100}
                onChange={(e) => handleSpotifyVolumeChange(Number(e.target.value) / 100)}
                style={{ accentColor: "#1db954" }}
              />
            </div>
            <span className="channel-label">Spotify</span>
            <span className="channel-value">{Math.round(config.spotify_volume * 100)}%</span>
          </div>

          {/* 4 Jingle Channels */}
          {CATEGORIES_INFO.map((cat) => {
            const categoryData = config.categories[cat.id];
            const vol = categoryData?.volume || 0.8;
            
            // Channel color borders
            let accentColor = "#3b82f6";
            if (cat.id === "fehlerfrei") accentColor = "#10b981";
            if (cat.id === "einlauf") accentColor = "#f59e0b";
            if (cat.id === "siegerrunde") accentColor = "#ec4899";

            return (
              <div key={cat.id} className="mixer-channel" style={{ borderTop: `3px solid ${accentColor}` }}>
                <span>📁</span>
                <div className="fader-wrapper">
                  <input 
                    type="range"
                    className="fader-input"
                    min="0"
                    max="100"
                    value={vol * 100}
                    onChange={(e) => handleCategoryVolumeChange(cat.id, Number(e.target.value) / 100)}
                    style={{ accentColor }}
                  />
                </div>
                <span className="channel-label">{cat.label}</span>
                <span className="channel-value">{Math.round(vol * 100)}%</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="modal-overlay" onClick={() => setIsSettingsOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Einstellungen & Lieder-Datenbank</h2>
              <button className="close-btn" onClick={() => setIsSettingsOpen(false)}>✕</button>
            </div>
            
            <div className="modal-body">
              <p style={{ color: "#94a3b8", fontSize: "0.9rem", margin: "0 0 0.5rem 0" }}>
                Hier kannst du Musikdateien (.mp3, .wav, etc.) in die einzelnen Kategorien laden. 
                Wenn eine Kategorie ausgelöst wird, wählt die App zufällig ein Lied aus dem jeweiligen Ordner/Pool.
              </p>

              {CATEGORIES_INFO.map((cat) => {
                const categoryData = config.categories[cat.id];
                const songs = categoryData?.songs || [];

                return (
                  <div key={cat.id} className="settings-category-box">
                    <div className="settings-category-header">
                      <span className={`settings-category-title ${cat.cssClass}-title`}>
                        {cat.label}
                      </span>
                      <button className="add-song-btn" onClick={() => handleAddSong(cat.id)}>
                        ➕ Lied hinzufügen
                      </button>
                    </div>

                    <ul className="settings-song-list">
                      {songs.length === 0 ? (
                        <li className="no-songs-label">Keine Lieder hinzugefügt</li>
                      ) : (
                        songs.map((song) => (
                          <li key={song} className="settings-song-item">
                            <span className="settings-song-name" title={song}>
                              {getFileName(song)}
                            </span>
                            <button 
                              className="remove-song-btn" 
                              onClick={() => handleRemoveSong(cat.id, song)}
                              title="Aus Liste entfernen"
                            >
                              ❌
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                );
              })}
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={async () => {
                if (window.confirm("Möchtest du wirklich alle Einstellungen auf Werkseinstellungen zurücksetzen? Deine Liederlisten werden geleert.")) {
                  const defaultCfg = {
                    spotify_volume: 0.5,
                    spotify_mute: false,
                    master_mute: false,
                    categories: {
                      pruefung: { id: "pruefung", name: "Prüfung eröffnen", volume: 0.8, songs: [] },
                      fehlerfrei: { id: "fehlerfrei", name: "Fehlerfrei", volume: 0.8, songs: [] },
                      einlauf: { id: "einlauf", name: "Siegerehrung Einlauf", volume: 0.8, songs: [] },
                      siegerrunde: { id: "siegerrunde", name: "Siegerrunde", volume: 0.8, songs: [] }
                    }
                  };
                  await saveConfig(defaultCfg);
                }
              }}>
                Zurücksetzen
              </button>
              <button className="btn-primary" onClick={() => setIsSettingsOpen(false)}>
                Schließen & Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
