import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
// import rfvLogo from "./assets/rfv_logo.jpg"; // Kept in project for future use
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
  theme: string;
  language: string;
  fade_duration_ms: number;
  spotify_fade_duration_ms: number;
  categories: Record<string, JingleCategory>;
}

const CATEGORIES_INFO = [
  { id: "pruefung", labelKey: "pruefung", descKey: "pruefungDesc", cssClass: "pruefung" },
  { id: "fehlerfrei", labelKey: "fehlerfrei", descKey: "fehlerfreiDesc", cssClass: "fehlerfrei" },
  { id: "einlauf", labelKey: "einlauf", descKey: "einlaufDesc", cssClass: "einlauf" },
  { id: "siegerrunde", labelKey: "siegerrunde", descKey: "siegerrundeDesc", cssClass: "siegerrunde" },
];

const TRANSLATIONS = {
  de: {
    title: "EQUISOUND",
    subtitle: "OFFIZIELLES SOUNDBOARD DES RFV LEONBERG",

    btnManageSongs: "Lieder verwalten",
    btnSettings: "System-Einstellungen",
    spotifyTitle: "SPOTIFY AUDIO-SEKTION",
    spotifyToggle: "PLAY / PAUSE",
    spotifyMute: "Stumm (Mute)",
    masterMute: "ALLE SOUNDS AUS (MUTE)",
    masterUnmute: "CONSOLE AKTIVIEREN",
    stopJingle: "STOP ACTIVE JINGLE",
    mixerTitle: "RUNDFUNK-MISCHPULT",
    spotifyLabel: "SPOTIFY",
    pruefung: "Prüfung eröffnen",
    pruefungDesc: "Startfreigabe / Einmarsch",
    fehlerfrei: "Fehlerfrei",
    fehlerfreiDesc: "Fehlerfreie Runde",
    einlauf: "Siegerehrung Einlauf",
    einlaufDesc: "Einlauf zur Siegerehrung",
    siegerrunde: "Siegerrunde",
    siegerrundeDesc: "Ehrenrunde des Siegers",
    jingleActive: "JINGLE AKTIV",
    jingleIdle: "BEREIT",
    songsCountSingle: "Lied geladen",
    songsCountPlural: "Lieder geladen",
    modalSongsTitle: "Lieder-Datenbank & Pools",
    modalSettingsTitle: "System-Einstellungen",
    close: "Schließen & Speichern",
    addSong: "Lied hinzufügen",
    noSongs: "Keine Lieder in dieser Kategorie",
    settingLanguage: "SPRACHE (LANGUAGE)",
    settingTheme: "DESIGN-MODUS (THEME)",
    settingThemeDark: "Nacht-Modus (Dunkel)",
    settingThemeLight: "Tag-Modus (Hell / Outdoor)",
    settingFade: "FADE-OUT DAUER (MS)",
    settingSpotifyFade: "SPOTIFY EINBLENDE-DAUER (MS)",
    btnReset: "Werksreset",
    resetConfirm: "Möchtest du wirklich alle Einstellungen auf Werkseinstellungen zurücksetzen?",
    errorNoSongs: "Keine Lieder in dieser Kategorie hinterlegt. Bitte füge über 'Lieder verwalten' Lieder hinzu."
  },
  en: {
    title: "EQUISOUND",
    subtitle: "TOURNAMENT SOUND CONSOLE BY RFV LEONBERG",

    btnManageSongs: "Manage Songs",
    btnSettings: "System Settings",
    spotifyTitle: "SPOTIFY AUDIO SECTION",
    spotifyToggle: "PLAY / PAUSE",
    spotifyMute: "Mute Spotify",
    masterMute: "MUTE ALL SOUNDS",
    masterUnmute: "UNMUTE CONSOLE",
    stopJingle: "STOP ACTIVE JINGLE",
    mixerTitle: "BROADCAST MIXER",
    spotifyLabel: "SPOTIFY",
    pruefung: "Open Class",
    pruefungDesc: "Class Opening / Riding in",
    fehlerfrei: "Clear Round",
    fehlerfreiDesc: "Clear Round Fanfare",
    einlauf: "Award Entrance",
    einlaufDesc: "Award Ceremony Entrance",
    siegerrunde: "Victory Lap",
    siegerrundeDesc: "Winner's Victory Lap",
    jingleActive: "JINGLE PLAYING",
    jingleIdle: "STANDBY",
    songsCountSingle: "song loaded",
    songsCountPlural: "songs loaded",
    modalSongsTitle: "Song Database & Pools",
    modalSettingsTitle: "System Settings",
    close: "Close & Save",
    addSong: "Add Song",
    noSongs: "No songs in this category",
    settingLanguage: "LANGUAGE",
    settingTheme: "COLOR THEME",
    settingThemeDark: "Night Mode (Dark)",
    settingThemeLight: "Day Mode (Light / Outdoor)",
    settingFade: "FADE-OUT DURATION (MS)",
    settingSpotifyFade: "SPOTIFY FADE-IN DURATION (MS)",
    btnReset: "Factory Reset",
    resetConfirm: "Are you sure you want to reset all settings to defaults?",
    errorNoSongs: "No songs available in this category. Please add songs via 'Manage Songs' first."
  }
};

interface FaderProps {
  value: number; // 0.0 to 1.0
  onChange: (value: number) => void;
  trackColorClass: string;
}

const Fader: React.FC<FaderProps> = ({ value, onChange, trackColorClass }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const calculateVolume = (clientY: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const percentage = 1 - (clientY - rect.top) / rect.height;
    const volume = Math.max(0, Math.min(100, Math.round(percentage * 100))) / 100;
    onChange(volume);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    calculateVolume(e.clientY);
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDragging.current) return;
      calculateVolume(moveEvent.clientY);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    isDragging.current = true;
    calculateVolume(e.touches[0].clientY);
    
    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (!isDragging.current) return;
      moveEvent.preventDefault(); // Prevent page scroll while dragging
      calculateVolume(moveEvent.touches[0].clientY);
    };

    const handleTouchEnd = () => {
      isDragging.current = false;
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };

    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);
  };

  const percentage = value * 100;

  return (
    <div 
      className={`custom-fader-track ${trackColorClass}`}
      ref={trackRef}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      style={{ cursor: "ns-resize" }}
    >
      <div className="custom-fader-groove">
        <div 
          className="custom-fader-fill"
          style={{ height: `${percentage}%` }}
        />
      </div>
      <div 
        className="custom-fader-thumb"
        style={{ bottom: `calc(${percentage}% - 8px)` }}
      />
    </div>
  );
};

function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isSongsOpen, setIsSongsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [playingSong, setPlayingSong] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [spotifyPlaying, setSpotifyPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Load config on startup
  useEffect(() => {
    loadConfig();
  }, []);

  // Fullscreen keyboard listener (F11) and state check on mount
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === "F11") {
        e.preventDefault();
        try {
          const appWindow = getCurrentWindow();
          const current = await appWindow.isFullscreen();
          const nextState = !current;
          await appWindow.setFullscreen(nextState);
          setIsFullscreen(nextState);
        } catch (err) {
          console.error("Fullscreen keyboard toggle failed:", err);
          setErrorMessage("F11 Fullscreen Error: " + String(err));
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    // Initial check
    const checkFullscreen = async () => {
      try {
        const appWindow = getCurrentWindow();
        const current = await appWindow.isFullscreen();
        setIsFullscreen(current);
      } catch (_) {}
    };
    checkFullscreen();

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Fullscreen toggle action for button
  async function toggleFullscreen() {
    try {
      const appWindow = getCurrentWindow();
      const current = await appWindow.isFullscreen();
      const nextState = !current;
      await appWindow.setFullscreen(nextState);
      setIsFullscreen(nextState);
    } catch (err) {
      console.error("Failed to toggle fullscreen:", err);
      setErrorMessage("Fullscreen Toggle Error: " + String(err));
    }
  }





  // Poll for audio playback status to auto-unmute Spotify and reset state
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const isPlaying = await invoke<boolean>("is_jingle_playing");
        if (!isPlaying) {
          setActiveCategory(null);
          setPlayingSong(null);
        }
        
        // Poll Spotify active session state
        const isSpotifyActive = await invoke<boolean>("get_spotify_playback_state");
        setSpotifyPlaying(isSpotifyActive);
      } catch (err) {
        console.error("Playback status poll failed:", err);
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

  // Language helper
  const lang = config?.language === "en" ? "en" : "de";
  const t = TRANSLATIONS[lang];

  // Spotify Control
  async function handleSpotifyToggle() {
    try {
      await invoke("toggle_spotify");
    } catch (err) {
      console.error("Failed to toggle Spotify:", err);
    }
  }

  // Spotify volume
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

  // Spotify mute
  async function handleSpotifyMuteToggle() {
    if (!config) return;
    try {
      const newMute = !config.spotify_mute;
      const updatedConfig = { ...config, spotify_mute: newMute };
      setConfig(updatedConfig);
      await invoke("set_spotify_mixer_mute", { mute: newMute });
      await invoke("save_config_cmd", { config: updatedConfig });
    } catch (err) {
      console.error("Failed to toggle Spotify mute:", err);
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

  // Trigger Jingle Pad
  async function handleTriggerJingle(categoryId: string) {
    if (!config || config.master_mute) return;
    setErrorMessage(null);
    
    // Toggle behavior: If clicking the active category, stop it
    if (activeCategory === categoryId) {
      await handleStopJingle(false);
      return;
    }

    try {
      setActiveCategory(categoryId);
      setPlayingSong("...");
      const songName = await invoke<string>("play_category_jingle", { categoryId });
      setPlayingSong(songName);
    } catch (err) {
      setActiveCategory(null);
      setPlayingSong(null);
      setErrorMessage(t.errorNoSongs);
    }
  }


  // Stop Jingle
  async function handleStopJingle(immediate: boolean = false) {
    try {
      await invoke("stop_current_jingle", { immediate });
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
      console.error("Failed to update category volume:", err);
    }
  }

  // Add songs to category pool (allows selecting multiple files)
  async function handleAddSong(categoryId: string) {
    if (!config) return;
    try {
      const selectedPaths = await invoke<string[] | null>("select_audio_files");
      if (selectedPaths && selectedPaths.length > 0) {
        const updatedConfig = { ...config };
        const category = updatedConfig.categories[categoryId];
        let changed = false;

        for (const path of selectedPaths) {
          if (!category.songs.includes(path)) {
            category.songs.push(path);
            changed = true;
          }
        }

        if (changed) {
          await saveConfig(updatedConfig);
        }
      }
    } catch (err) {
      console.error("Failed to add songs:", err);
    }
  }

  // Remove song from category pool
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

  // Helper to extract clean filename
  function getFileName(path: string): string {
    return path.split(/[/\\]/).pop() || path;
  }

  // Decibel converter for mixers, linearly mapped to fader scale ticks:
  // 100% -> 0 dB
  // 83.3% -> -3 dB
  // 66.7% -> -6 dB
  // 50% -> -12 dB
  // 33.3% -> -24 dB
  // 16.7% -> -48 dB
  // 0% -> -oo dB
  function formatDb(vol: number): string {
    const pct = Math.round(vol * 100);
    if (pct <= 0) return "-∞ dB";
    if (pct === 100) return "0 dB";
    
    if (pct >= 83.3) {
      const db = -3 + ((pct - 83.3) / 16.7) * 3;
      return `${Math.round(db)} dB`;
    } else if (pct >= 66.7) {
      const db = -6 + ((pct - 66.7) / 16.6) * 3;
      return `${Math.round(db)} dB`;
    } else if (pct >= 50.0) {
      const db = -12 + ((pct - 50.0) / 16.7) * 6;
      return `${Math.round(db)} dB`;
    } else if (pct >= 33.3) {
      const db = -24 + ((pct - 33.3) / 16.7) * 12;
      return `${Math.round(db)} dB`;
    } else if (pct >= 16.7) {
      const db = -48 + ((pct - 16.7) / 16.6) * 24;
      return `${Math.round(db)} dB`;
    } else {
      const db = -70 + (pct / 16.7) * 22;
      return `${Math.round(db)} dB`;
    }
  }


  if (!config) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", backgroundColor: "#0a0d0c" }}>
        <p style={{ color: "#84a28f", fontSize: "1.1rem", fontWeight: "bold" }}>EQUISOUND CONSOLE LOADING...</p>
      </div>
    );
  }

  const themeClass = config.theme === "light" ? "light" : "dark";

  return (
    <div className={`app-container ${themeClass}`}>
      {/* Header */}
      <header className="app-header">
        <div className="brand">
          <h1>{t.title}</h1>
          <span>{t.subtitle}</span>
        </div>
        <div className="header-actions">
          <button 
            className="fullscreen-toggle-btn" 
            onClick={toggleFullscreen} 
            title="Fullscreen (F11)"
          >
            {isFullscreen ? (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Main Console Columns */}
      <div className="app-body">
        {/* Left Spalte: System & Spotify & Administration */}
        <div className="system-column">
          {/* Spotify Panel */}
          <div className="panel-card spotify-card">
            <span className="system-title">{t.spotifyTitle}</span>
            <div className="spotify-box">
              <button 
                className={`spotify-round-btn ${spotifyPlaying ? "playing" : "paused"}`} 
                onClick={handleSpotifyToggle} 
                title={t.spotifyToggle}
              >
                <svg viewBox="0 0 24 24" width="36" height="36" fill="currentColor">
                  <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424c-.18.295-.565.387-.86.207-2.377-1.454-5.37-1.783-8.893-.982-.336.075-.668-.135-.744-.47-.077-.337.135-.669.47-.745 3.848-.879 7.143-.51 9.82.13.296.18.387.563.207.86zm1.224-2.723c-.226.367-.707.487-1.074.26-2.72-1.672-6.87-2.157-10.08-1.182-.413.125-.847-.107-.972-.52-.125-.413.108-.847.52-.972 3.67-1.114 8.24-.57 11.35 1.346.366.226.486.707.256 1.068zm.105-2.81c-3.26-1.937-8.644-2.12-11.758-1.173-.5.152-1.025-.133-1.177-.633-.151-.5.133-1.026.633-1.178 3.596-1.092 9.539-.882 13.3 1.348.448.266.596.843.33 1.291-.266.449-.842.597-1.29.33-.001 0-.002-.001-.003-.002z"/>
                </svg>
              </button>

              <span className="spotify-status-label">{t.spotifyToggle}</span>
              
              <label className="spotify-mute-checkbox">
                <input 
                  type="checkbox" 
                  checked={config.spotify_mute} 
                  onChange={handleSpotifyMuteToggle}
                  style={{ cursor: "pointer" }}
                />
                {t.spotifyMute}
              </label>
            </div>
          </div>

          {/* Master Controls Panel */}
          <div className="panel-card master-card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <span className="system-title">MASTER CONTROLS</span>
            <button 
              className={`master-mute-btn ${config.master_mute ? "active" : ""}`}
              onClick={handleMasterMuteToggle}
            >
              {config.master_mute ? t.masterUnmute : t.masterMute}
            </button>
            <button 
              className={`stop-jingle-btn ${activeCategory ? "active" : ""}`}
              onClick={() => handleStopJingle(true)}
              disabled={!activeCategory}
            >
              STOP ACTIVE JINGLE
            </button>
          </div>


          {/* Administration Panel */}
          <div className="panel-card admin-card">
            <span className="system-title">ADMINISTRATION</span>
            <button className="btn-control admin-btn" onClick={() => setIsSongsOpen(true)}>
              🎵 {t.btnManageSongs}
            </button>
            <button className="btn-control admin-btn" onClick={() => setIsSettingsOpen(true)}>
              ⚙️ {t.btnSettings}
            </button>
          </div>
        </div>

        {/* Center Spalte: Launchpad Grid & Stop Button */}
        <div className="center-column">
          <div className="launchpad-grid">
            {CATEGORIES_INFO.map((cat) => {
              const categoryData = config.categories[cat.id];
              const songCount = categoryData?.songs.length || 0;
              const isPlaying = activeCategory === cat.id;

              return (
                <button
                  key={cat.id}
                  className={`pad-button ${cat.cssClass} ${isPlaying ? "playing" : ""}`}
                  onClick={() => handleTriggerJingle(cat.id)}
                  disabled={config.master_mute}
                >
                  <span className="pad-label">{t[cat.labelKey as keyof typeof t]}</span>

                  {/* Centered Visual Element */}
                  <div className="pad-center-content">
                    {isPlaying ? (
                      <div className="active-visual">
                        <div className="waveform-animation playing">
                          <span className="bar bar1"></span>
                          <span className="bar bar2"></span>
                          <span className="bar bar3"></span>
                          <span className="bar bar4"></span>
                          <span className="bar bar5"></span>
                          <span className="bar bar6"></span>
                          <span className="bar bar7"></span>
                        </div>
                        <div className="active-song-name">
                          {playingSong ? getFileName(playingSong) : "..."}
                        </div>
                      </div>
                    ) : (
                      <div className="idle-visual">
                        <div className="waveform-animation idle">
                          <span className="bar bar1" style={{ height: "12px" }}></span>
                          <span className="bar bar2" style={{ height: "20px" }}></span>
                          <span className="bar bar3" style={{ height: "32px" }}></span>
                          <span className="bar bar4" style={{ height: "24px" }}></span>
                          <span className="bar bar5" style={{ height: "14px" }}></span>
                          <span className="bar bar6" style={{ height: "28px" }}></span>
                          <span className="bar bar7" style={{ height: "16px" }}></span>
                        </div>
                      </div>
                    )}
                  </div>


                  <div className="pad-meta">
                    <span className="pad-status-text">
                      {isPlaying ? t.jingleActive : t.jingleIdle}
                    </span>
                    <span>
                      {songCount} {songCount === 1 ? t.songsCountSingle : t.songsCountPlural}
                    </span>
                  </div>
                </button>

              );
            })}
          </div>

        </div>

        {/* Right Spalte: Mischpult */}
        <div className="panel-card mixer-panel">
          <span className="system-title">{t.mixerTitle}</span>
          
          <div className="mixer-board">
            {/* Spotify Channel */}
            <div className="mixer-channel spotify">
              <span className="channel-db">{formatDb(config.spotify_volume)}</span>
              <div className="fader-strip">
                <div className="fader-scale">
                  <span>0</span><span>-3</span><span>-6</span><span>-12</span><span>-24</span><span>-48</span><span>-oo</span>
                </div>
                <div className="slider-groove-container">
                  <Fader 
                    value={config.spotify_volume}
                    onChange={handleSpotifyVolumeChange}
                    trackColorClass="spotify"
                  />
                </div>
              </div>
              <span className="channel-label">{t.spotifyLabel}</span>
              <span className="channel-db" style={{ fontSize: "0.65rem", padding: "1px 2px" }}>
                {Math.round(config.spotify_volume * 100)}%
              </span>
            </div>

            {/* 4 Jingle Channels */}
            {CATEGORIES_INFO.map((cat) => {
              const categoryData = config.categories[cat.id];
              const vol = categoryData?.volume ?? 0.8;

              return (
                <div key={cat.id} className={`mixer-channel ${cat.cssClass}`}>
                  <span className="channel-db">{formatDb(vol)}</span>
                  <div className="fader-strip">
                    <div className="fader-scale">
                      <span>0</span><span>-3</span><span>-6</span><span>-12</span><span>-24</span><span>-48</span><span>-oo</span>
                    </div>
                    <div className="slider-groove-container">
                      <Fader 
                        value={vol}
                        onChange={(volume) => handleCategoryVolumeChange(cat.id, volume)}
                        trackColorClass={cat.cssClass}
                      />
                    </div>
                  </div>
                  <span className="channel-label">{t[cat.labelKey as keyof typeof t]}</span>
                  <span className="channel-db" style={{ fontSize: "0.65rem", padding: "1px 2px" }}>
                    {Math.round(vol * 100)}%
                  </span>
                </div>
              );
            })}


          </div>
        </div>
      </div>

      {/* FIXED TOAST NOTIFICATION: prevents layout shifting */}
      {errorMessage && (
        <div className="error-toast">
          <span className="error-toast-text">{errorMessage}</span>
          <button className="error-toast-close" onClick={() => setErrorMessage(null)}>✕</button>
        </div>
      )}

      {/* MODAL 1: Lieder-Datenbank */}
      {isSongsOpen && (
        <div className="modal-overlay" onClick={() => setIsSongsOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t.modalSongsTitle}</h2>
              <button className="btn-close" onClick={() => setIsSongsOpen(false)}>✕</button>
            </div>
            
            <div className="modal-body">
              {CATEGORIES_INFO.map((cat) => {
                const categoryData = config.categories[cat.id];
                const songs = categoryData?.songs || [];

                return (
                  <div key={cat.id} className="category-song-box">
                    <div className="category-song-header">
                      <span className="category-song-title">{t[cat.labelKey as keyof typeof t]}</span>
                      <button className="btn-control" style={{ fontSize: "0.75rem", padding: "3px 8px" }} onClick={() => handleAddSong(cat.id)}>
                        {t.addSong}
                      </button>
                    </div>

                    <div className="song-list-wrapper">
                      <ul className="song-list">
                        {songs.length === 0 ? (
                          <li className="no-songs">{t.noSongs}</li>
                        ) : (
                          songs.map((song) => (
                            <li key={song} className="song-item">
                              <span className="song-name" title={song}>{getFileName(song)}</span>
                              <button className="btn-remove-song" onClick={() => handleRemoveSong(cat.id, song)}>✕</button>
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="modal-footer">
              <button className="btn-control" style={{ background: "var(--accent-brand)", color: "#000000" }} onClick={() => setIsSongsOpen(false)}>
                {t.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: System-Einstellungen */}
      {isSettingsOpen && (
        <div className="modal-overlay" onClick={() => setIsSettingsOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t.modalSettingsTitle}</h2>
              <button className="btn-close" onClick={() => setIsSettingsOpen(false)}>✕</button>
            </div>

            <div className="modal-body">
              {/* Language Selector */}
              <div className="setting-item">
                <label>{t.settingLanguage}</label>
                <select 
                  className="select-control"
                  value={config.language}
                  onChange={(e) => {
                    const updated = { ...config, language: e.target.value };
                    saveConfig(updated);
                  }}
                >
                  <option value="de">Deutsch</option>
                  <option value="en">English</option>
                </select>
              </div>

              {/* Theme Selector */}
              <div className="setting-item">
                <label>{t.settingTheme}</label>
                <select 
                  className="select-control"
                  value={config.theme}
                  onChange={(e) => {
                    const updated = { ...config, theme: e.target.value };
                    saveConfig(updated);
                  }}
                >
                  <option value="dark">{t.settingThemeDark}</option>
                  <option value="light">{t.settingThemeLight}</option>
                </select>
              </div>

              {/* Fade out Slider */}
              <div className="setting-item">
                <label>{t.settingFade}: {config.fade_duration_ms}ms</label>
                <input 
                  type="range"
                  min="200"
                  max="4000"
                  step="100"
                  value={config.fade_duration_ms}
                  onChange={(e) => {
                    const updated = { ...config, fade_duration_ms: Number(e.target.value) };
                    setConfig(updated);
                  }}
                  onMouseUp={() => saveConfig(config)}
                  style={{ accentColor: "var(--accent-brand)", cursor: "pointer" }}
                />
              </div>

              {/* Spotify Fade in Slider */}
              <div className="setting-item">
                <label>{t.settingSpotifyFade}: {config.spotify_fade_duration_ms}ms</label>
                <input 
                  type="range"
                  min="200"
                  max="4000"
                  step="100"
                  value={config.spotify_fade_duration_ms}
                  onChange={(e) => {
                    const updated = { ...config, spotify_fade_duration_ms: Number(e.target.value) };
                    setConfig(updated);
                  }}
                  onMouseUp={() => saveConfig(config)}
                  style={{ accentColor: "var(--accent-brand)", cursor: "pointer" }}
                />
              </div>
            </div>

            <div className="modal-footer" style={{ justifyContent: "space-between" }}>
              <button 
                className="btn-control" 
                style={{ color: "#ef4444", borderColor: "#ef4444" }} 
                onClick={async () => {
                  if (window.confirm(t.resetConfirm)) {
                    const defaultCfg = {
                      spotify_volume: 0.5,
                      spotify_mute: false,
                      master_mute: false,
                      theme: "dark",
                      language: "de",
                      fade_duration_ms: 1200,
                      spotify_fade_duration_ms: 1000,
                      categories: {
                        pruefung: { id: "pruefung", name: "Prüfung eröffnen", volume: 0.8, songs: [] },
                        fehlerfrei: { id: "fehlerfrei", name: "Fehlerfrei", volume: 0.8, songs: [] },
                        einlauf: { id: "einlauf", name: "Siegerehrung Einlauf", volume: 0.8, songs: [] },
                        siegerrunde: { id: "siegerrunde", name: "Siegerrunde", volume: 0.8, songs: [] }
                      }
                    };
                    await saveConfig(defaultCfg);
                    setIsSettingsOpen(false);
                  }
                }}
              >
                {t.btnReset}
              </button>
              <button className="btn-control" style={{ background: "var(--accent-brand)", color: "#000000" }} onClick={() => setIsSettingsOpen(false)}>
                {t.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
