import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import equisoundLogo from "./assets/equisound_logo.png";
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
  jingle_loop: boolean;
  spotify_auto_fade_in?: boolean;
  categories: Record<string, JingleCategory>;
}

const CATEGORIES_INFO = [
  { id: "pruefung", labelKey: "pruefung", descKey: "pruefungDesc", cssClass: "pruefung" },
  { id: "fehlerfrei", labelKey: "fehlerfrei", descKey: "fehlerfreiDesc", cssClass: "fehlerfrei" },
  { id: "einlauf", labelKey: "einlauf", descKey: "einlaufDesc", cssClass: "einlauf" },
  { id: "siegerrunde", labelKey: "siegerrunde", descKey: "siegerrundeDesc", cssClass: "siegerrunde" },
  { id: "tusch", labelKey: "tusch", descKey: "tuschDesc", cssClass: "tusch" },
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
    stopJingle: "STOP ACTIVE JINGLE (ESC)",
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
    tusch: "Siegertusch",
    tuschDesc: "Tusch für die Siegerehrung",
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
    settingSpotifyAutoFade: "SPOTIFY AUTOMATISCH EINBLENDEN NACH JINGLE",
    autoFadeActive: "AUTO FADE-IN: AN",
    autoFadeInactive: "AUTO FADE-IN: AUS",
    btnReset: "Werksreset",
    resetConfirm: "Möchtest du wirklich alle Einstellungen auf Werkseinstellungen zurücksetzen?",
    errorNoSongs: "Keine Lieder in dieser Kategorie hinterlegt. Bitte füge über 'Lieder verwalten' Lieder hinzu.",
    manageQueueTitle: "Warteschlange verwalten",
    queueHeaderActive: "Aktive Warteschlange (Reihenfolge)",
    queueHeaderAvailable: "Verfügbare Songs (Klicke ➕ zum Hinzufügen)",
    queueEmpty: "Die Warteschlange ist leer. Klicke rechts auf das ➕ Symbol, um Songs hinzuzufügen.",
    clearQueue: "Warteschlange leeren",
    loopActive: "JINGLE-LOOP: AKTIV",
    loopInactive: "JINGLE-LOOP: INAKTIV",
    queueLockActive: "WARTESCHLANGEN-SPERRE: AKTIV",
    queueLockInactive: "WARTESCHLANGEN-SPERRE: INAKTIV",
    updateTitle: "SOFTWARE-UPDATE",
    updateBtnCheck: "Nach Updates suchen",
    updateChecking: "Prüfe auf Updates...",
    updateUpToDate: "Software ist auf dem neuesten Stand.",
    updateAvailable: "Update verfügbar!",
    updateBtnInstall: "Jetzt installieren & neu starten",
    updateDownloading: "Wird heruntergeladen...",
    updateInstalling: "Wird installiert...",
    updateFailed: "Fehler beim Update.",
    infoTitle: "Info & Impressum",
    infoSoftware: "Software",
    infoDeveloper: "Entwickler",
    infoClub: "Verein",
    infoPurpose: "Zweck",
    infoPurposeVal: "Offizielle Turniersound-Konsole",
    infoRights: "Alle Rechte vorbehalten.",
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
    stopJingle: "STOP ACTIVE JINGLE (ESC)",
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
    tusch: "Victory Fanfare",
    tuschDesc: "Fanfare for the award ceremony",
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
    settingSpotifyAutoFade: "AUTO FADE-IN SPOTIFY AFTER JINGLE",
    autoFadeActive: "AUTO FADE-IN: ON",
    autoFadeInactive: "AUTO FADE-IN: OFF",
    btnReset: "Factory Reset",
    resetConfirm: "Are you sure you want to reset all settings to defaults?",
    errorNoSongs: "No songs available in this category. Please add songs via 'Manage Songs'.",
    manageQueueTitle: "Manage Queue",
    queueHeaderActive: "Active Queue (Playback Order)",
    queueHeaderAvailable: "Available Songs (Click ➕ to Add)",
    queueEmpty: "The queue is empty. Click the ➕ symbol on the right to add songs.",
    clearQueue: "Clear Queue",
    loopActive: "JINGLE LOOP: ACTIVE",
    loopInactive: "JINGLE LOOP: INACTIVE",
    queueLockActive: "QUEUE LOCK: ACTIVE",
    queueLockInactive: "QUEUE LOCK: INACTIVE",
    updateTitle: "SOFTWARE UPDATE",
    updateBtnCheck: "Check for Updates",
    updateChecking: "Checking for updates...",
    updateUpToDate: "Software is up to date.",
    updateAvailable: "Update available!",
    updateBtnInstall: "Install now & restart",
    updateDownloading: "Downloading...",
    updateInstalling: "Installing...",
    updateFailed: "Update failed.",
    infoTitle: "Info & Credits",
    infoSoftware: "Software",
    infoDeveloper: "Developer",
    infoClub: "Club",
    infoPurpose: "Purpose",
    infoPurposeVal: "Official tournament sound console",
    infoRights: "All rights reserved.",
  }
};

interface FaderChannelProps {
  label: string;
  value: number; // 0.0 to 1.0
  trackColorClass: string;
  onChange: (vol: number) => void;
  onCommit: (vol: number) => void;
}

const FaderChannel: React.FC<FaderChannelProps> = ({ label, value, trackColorClass, onChange, onCommit }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const dbTextRef = useRef<HTMLSpanElement>(null);
  const pctTextRef = useRef<HTMLSpanElement>(null);

  const isDragging = useRef(false);
  const lastVolRef = useRef(value);

  // Keep local volume in sync with external resets/changes (e.g. on load, reset, or fade-out)
  useEffect(() => {
    if (!isDragging.current) {
      updateDOM(value);
    }
  }, [value]);

  const updateDOM = (vol: number) => {
    lastVolRef.current = vol;
    const percentage = vol * 100;
    
    if (fillRef.current) {
      fillRef.current.style.height = `${percentage}%`;
    }
    if (thumbRef.current) {
      thumbRef.current.style.bottom = `calc(${percentage}% - 8px)`;
    }
    if (dbTextRef.current) {
      dbTextRef.current.textContent = formatDb(vol);
    }
    if (pctTextRef.current) {
      pctTextRef.current.textContent = `${Math.round(percentage)}%`;
    }
  };

  const calculateVolume = (clientY: number) => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    const percentage = 1 - (clientY - rect.top) / rect.height;
    const volume = Math.max(0, Math.min(100, Math.round(percentage * 100))) / 100;
    
    // Update visual DOM elements synchronously for instantaneous responsiveness (0ms lag)
    updateDOM(volume);
    
    // Send updated volume to Tauri backend
    onChange(volume);
    
    return volume;
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
      onCommit(lastVolRef.current);
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
      onCommit(lastVolRef.current);
    };

    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);
  };

  // Decibel converter for mixers, linearly mapped to fader scale ticks:
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

  const initialPct = value * 100;

  return (
    <div className={`mixer-channel ${trackColorClass}`}>
      <span className="channel-db" ref={dbTextRef}>{formatDb(value)}</span>
      <div className="fader-strip">
        <div className="fader-scale">
          <span>0</span><span>-3</span><span>-6</span><span>-12</span><span>-24</span><span>-48</span><span>-oo</span>
        </div>
        <div className="slider-groove-container">
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
                ref={fillRef}
                style={{ height: `${initialPct}%` }}
              />
            </div>
            <div 
              className="custom-fader-thumb"
              ref={thumbRef}
              style={{ bottom: `calc(${initialPct}% - 8px)` }}
            />
          </div>
        </div>
      </div>
      <span className="channel-label">{label}</span>
      <span className="channel-db" ref={pctTextRef} style={{ fontSize: "0.65rem", padding: "1px 2px" }}>
        {Math.round(initialPct)}%
      </span>
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
  const [queues, setQueues] = useState<Record<string, string[]>>({});
  const [queueModalCategory, setQueueModalCategory] = useState<string | null>(null);
  const [lockedQueues, setLockedQueues] = useState<string[]>([]);

  // Update state variables
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'upToDate' | 'available' | 'downloading' | 'installing' | 'failed'>('idle');
  const [updateProgress, setUpdateProgress] = useState<number | null>(null);
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateInstance, setUpdateInstance] = useState<any>(null);

  // Intro / Splash screen stage state
  const [introStage, setIntroStage] = useState<'spin' | 'text' | 'slide' | 'fadeout' | 'done'>('spin');

  useEffect(() => {
    // 1. Spin logo initially (1.2 seconds)
    // 2. Fade text in (1.0 second duration)
    const textTimer = setTimeout(() => {
      setIntroStage('text');
    }, 1200);

    // 3. Slide logo & title to the header corner (0.9 seconds slide duration)
    const slideTimer = setTimeout(() => {
      setIntroStage('slide');
    }, 2200);

    // 4. Start crossfading splash overlay to layout header (0.4 seconds crossfade)
    const fadeoutTimer = setTimeout(() => {
      setIntroStage('fadeout');
    }, 3100);

    // 5. Finish intro, unmount overlay, show fully interactive UI
    const doneTimer = setTimeout(() => {
      setIntroStage('done');
    }, 3500);

    return () => {
      clearTimeout(textTimer);
      clearTimeout(slideTimer);
      clearTimeout(fadeoutTimer);
      clearTimeout(doneTimer);
    };
  }, []);

  const handleCheckForUpdates = async () => {
    setUpdateStatus('checking');
    setUpdateError(null);
    try {
      const update = await check();
      if (update) {
        setNewVersion(update.version);
        setUpdateStatus('available');
        setUpdateInstance(update);
      } else {
        setUpdateStatus('upToDate');
      }
    } catch (err: any) {
      console.error("Update check failed:", err);
      setUpdateStatus('failed');
      setUpdateError(String(err));
    }
  };

  const handleInstallUpdate = async () => {
    if (!updateInstance) return;
    setUpdateStatus('downloading');
    setUpdateProgress(0);
    try {
      let downloaded = 0;
      let contentLength = 0;
      await updateInstance.downloadAndInstall((event: any) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength || 0;
            setUpdateStatus('downloading');
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            if (contentLength > 0) {
              setUpdateProgress(Math.round((downloaded / contentLength) * 100));
            }
            break;
          case 'Finished':
            setUpdateStatus('installing');
            break;
        }
      });
      
      // Delay for UI feedback
      setTimeout(async () => {
        try {
          await relaunch();
        } catch (relaunchErr) {
          console.error("Relaunch failed:", relaunchErr);
          setUpdateStatus('failed');
          setUpdateError("Relaunch failed. Please restart the app manually.");
        }
      }, 1000);
    } catch (err: any) {
      console.error("Download/Install failed:", err);
      setUpdateStatus('failed');
      setUpdateError(String(err));
    }
  };

  // Throttled volume IPC handler to avoid saturating Tauri IPC channel
  const spotifyVolumeLock = useRef(false);
  const spotifyVolumePending = useRef<number | null>(null);

  const sendSpotifyVolumeToTauri = async (vol: number) => {
    if (spotifyVolumeLock.current) {
      spotifyVolumePending.current = vol;
      return;
    }
    spotifyVolumeLock.current = true;
    try {
      await invoke("set_spotify_mixer_volume", { vol });
    } catch (err) {
      console.error(err);
    }
    spotifyVolumeLock.current = false;
    if (spotifyVolumePending.current !== null) {
      const nextVol = spotifyVolumePending.current;
      spotifyVolumePending.current = null;
      sendSpotifyVolumeToTauri(nextVol);
    }
  };

  const activeCategoryRef = useRef<string | null>(null);
  useEffect(() => {
    activeCategoryRef.current = activeCategory;
  }, [activeCategory]);

  const categoryVolumeLock = useRef<Record<string, boolean>>({});
  const categoryVolumePending = useRef<Record<string, number | null>>({});

  const sendCategoryVolumeToTauri = async (categoryId: string, vol: number) => {
    if (categoryVolumeLock.current[categoryId]) {
      categoryVolumePending.current[categoryId] = vol;
      return;
    }
    categoryVolumeLock.current[categoryId] = true;
    try {
      if (activeCategoryRef.current === categoryId) {
        await invoke("set_jingle_volume", { vol });
      }
    } catch (err) {
      console.error(err);
    }
    categoryVolumeLock.current[categoryId] = false;
    if (categoryVolumePending.current[categoryId] !== undefined && categoryVolumePending.current[categoryId] !== null) {
      const nextVol = categoryVolumePending.current[categoryId]!;
      categoryVolumePending.current[categoryId] = null;
      sendCategoryVolumeToTauri(categoryId, nextVol);
    }
  };

  async function handleToggleQueueLock(categoryId: string) {
    try {
      const isLockedNow = await invoke<boolean>("toggle_queue_lock", { categoryId });
      setLockedQueues(prev => 
        isLockedNow 
          ? [...prev, categoryId] 
          : prev.filter(id => id !== categoryId)
      );
    } catch (err) {
      console.error("Failed to toggle queue lock:", err);
    }
  }
  
  const [songDurations, setSongDurations] = useState<Record<string, number>>({});
  const [jingleElapsed, setJingleElapsed] = useState<number>(0);
  const fetchedPathsRef = useRef<Set<string>>(new Set());

  // Helper to format seconds to mm:ss
  function formatDuration(seconds: number | undefined | null): string {
    if (seconds === undefined || seconds === null) return "...";
    if (seconds < 0) return "n/a";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  const getRemainingTimeStr = () => {
    if (!playingSong || playingSong === "...") return "";
    const duration = songDurations[playingSong];
    if (!duration || duration <= 0) return "";
    const remaining = Math.max(0, duration - jingleElapsed);
    return `-${formatDuration(remaining)}`;
  };

  // Load config on startup
  useEffect(() => {
    loadConfig();
  }, []);

  // Fetch durations for all known songs
  useEffect(() => {
    if (!config) return;
    const paths = new Set<string>();
    
    // Collect paths from categories
    Object.values(config.categories).forEach((cat) => {
      if (cat.songs) {
        cat.songs.forEach((s) => paths.add(s));
      }
    });

    // Collect paths from queues
    Object.values(queues).forEach((q) => {
      if (q) {
        q.forEach((s) => paths.add(s));
      }
    });

    // Collect currently playing
    if (playingSong && playingSong !== "...") {
      paths.add(playingSong);
    }

    paths.forEach(async (path) => {
      if (!fetchedPathsRef.current.has(path)) {
        fetchedPathsRef.current.add(path);
        try {
          const duration = await invoke<number>("get_song_duration", { path });
          setSongDurations((prev) => ({ ...prev, [path]: duration }));
        } catch (err) {
          console.error("Failed to fetch duration for:", path, err);
          setSongDurations((prev) => ({ ...prev, [path]: -1 }));
        }
      }
    });
  }, [config, queues, playingSong]);

  // Track elapsed time for active jingle playing (and handle loop wrapping)
  useEffect(() => {
    if (!activeCategory || !playingSong || playingSong === "...") {
      setJingleElapsed(0);
      return;
    }

    setJingleElapsed(0);

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsedSec = (Date.now() - startTime) / 1000;
      
      const duration = songDurations[playingSong];
      if (duration && duration > 0) {
        if (config?.jingle_loop) {
          setJingleElapsed(elapsedSec % duration);
        } else {
          setJingleElapsed(Math.min(elapsedSec, duration));
        }
      } else {
        setJingleElapsed(elapsedSec);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [activeCategory, playingSong, config?.jingle_loop, songDurations]);

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
      if (e.key === "Escape") {
        e.preventDefault();
        try {
          await invoke("stop_current_jingle", { immediate: true });
          setActiveCategory(null);
          setPlayingSong(null);
        } catch (err) {
          console.error("Escape key stop failed:", err);
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
        const activeCat = await invoke<string | null>("get_active_category");
        setActiveCategory(activeCat);
        if (!activeCat) {
          setPlayingSong(null);
        }
        
        // Poll Spotify active session state
        const isSpotifyActive = await invoke<boolean>("get_spotify_playback_state");
        setSpotifyPlaying(isSpotifyActive);

        // Poll queue lock status
        const locks = await invoke<string[]>("get_queue_locks");
        setLockedQueues(locks);

        // Poll category queues state only when queue manager is not open
        if (!queueModalCategory) {
          const latestQueues = await invoke<Record<string, string[]>>("get_queues");
          setQueues(latestQueues);
        }
      } catch (err) {
        console.error("Playback status poll failed:", err);
      }
    }, 400);

    return () => clearInterval(interval);
  }, [queueModalCategory]);


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
  async function handleSpotifyVolumeChange(vol: number, saveToDisk: boolean = false) {
    if (!config) return;
    try {
      const updatedConfig = { ...config, spotify_volume: vol };
      setConfig(updatedConfig);
      sendSpotifyVolumeToTauri(vol);
      if (saveToDisk) {
        await invoke("save_config_cmd", { config: updatedConfig });
      }
    } catch (err) {
      console.error("Failed to set Spotify volume:", err);
    }
  }

  // Toggle Spotify Auto Fade-In
  async function handleToggleAutoFade() {
    if (!config) return;
    try {
      const updatedConfig = { ...config, spotify_auto_fade_in: !(config.spotify_auto_fade_in ?? true) };
      setConfig(updatedConfig);
      await saveConfig(updatedConfig);
    } catch (err) {
      console.error("Failed to toggle auto fade-in:", err);
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
    } catch (err) {
      console.error("Failed to toggle master mute:", err);
    }
  }

  // Toggle Jingle Loop
  async function handleLoopToggle() {
    if (!config) return;
    try {
      const updatedConfig = { ...config, jingle_loop: !config.jingle_loop };
      setConfig(updatedConfig);
      await saveConfig(updatedConfig);
    } catch (err) {
      console.error("Failed to toggle loop:", err);
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
  async function handleCategoryVolumeChange(categoryId: string, vol: number, saveToDisk: boolean = false) {
    if (!config) return;
    try {
      const updatedConfig = { ...config };
      updatedConfig.categories[categoryId].volume = vol;
      setConfig(updatedConfig);
      
      sendCategoryVolumeToTauri(categoryId, vol);
      
      if (saveToDisk) {
        await invoke("save_config_cmd", { config: updatedConfig });
      }
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
        if (!category) {
          console.error(`Category ${categoryId} not found in config`);
          return;
        }
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
      if (!category) return;
      category.songs = category.songs.filter((s) => s !== songPath);
      await saveConfig(updatedConfig);
      
      // Remove from queue if it was queued
      await handleRemoveFromQueue(categoryId, songPath);
    } catch (err) {
      console.error("Failed to remove song:", err);
    }
  }

  // Add a song to the queue
  async function handleAddToQueue(categoryId: string, songPath: string) {
    try {
      await invoke("add_to_queue", { categoryId, songPath });
      const updatedQueues = await invoke<Record<string, string[]>>("get_queues");
      setQueues(updatedQueues);
    } catch (err) {
      console.error("Failed to add song to queue:", err);
    }
  }

  // Remove a song from the queue
  async function handleRemoveFromQueue(categoryId: string, songPath: string) {
    try {
      await invoke("remove_from_queue", { categoryId, songPath });
      const updatedQueues = await invoke<Record<string, string[]>>("get_queues");
      setQueues(updatedQueues);
    } catch (err) {
      console.error("Failed to remove song from queue:", err);
    }
  }

  // Swap items in queue for reordering
  function moveQueueItem(catId: string, index: number, direction: "up" | "down") {
    const queue = queues[catId] || [];
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === queue.length - 1) return;
    
    const newQueue = [...queue];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    
    // Swap items
    const temp = newQueue[index];
    newQueue[index] = newQueue[targetIndex];
    newQueue[targetIndex] = temp;
    
    handleSetQueue(catId, newQueue);
  }

  // Override the complete queue
  async function handleSetQueue(categoryId: string, newQueue: string[]) {
    try {
      await invoke("set_queue", { categoryId, newQueue });
      const updatedQueues = await invoke<Record<string, string[]>>("get_queues");
      setQueues(updatedQueues);
    } catch (err) {
      console.error("Failed to set queue:", err);
    }
  }

  // Helper to extract clean filename
  function getFileName(path: string): string {
    return path.split(/[/\\]/).pop() || path;
  }

  // Truncate filename keeping extension if possible
  function truncateFileName(path: string, maxLength: number = 25): string {
    const name = getFileName(path);
    if (name.length <= maxLength) return name;
    const dotIndex = name.lastIndexOf(".");
    if (dotIndex !== -1 && name.length - dotIndex <= 5) {
      const ext = name.substring(dotIndex);
      const base = name.substring(0, dotIndex);
      const allowedBaseLength = maxLength - ext.length - 3;
      if (allowedBaseLength > 3) {
        return base.substring(0, allowedBaseLength) + "..." + ext;
      }
    }
    return name.substring(0, maxLength - 3) + "...";
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
    <div className={`app-container ${themeClass} ${["spin", "text"].includes(introStage) ? "intro-active" : ""}`}>
      {/* Startup / Splash Intro Animation */}
      {introStage !== 'done' && (
        <div className={`splash-overlay ${introStage}`}>
          <img 
            src={equisoundLogo} 
            alt="EquiSound Logo" 
            className="splash-logo" 
          />
          <div className="splash-text-container">
            <h1 className="splash-title">{t.title}</h1>
            <span className="splash-subtitle">{t.subtitle}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="app-header">
        <div className="brand" style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "0.75rem", minHeight: "44px" }}>
          <img 
            src={equisoundLogo} 
            alt="EquiSound Logo" 
            className="header-brand-logo" 
            style={{ 
              width: "36px", 
              height: "36px", 
              borderRadius: "50%", 
              objectFit: "cover",
              border: "1px solid var(--border-panel)",
              opacity: ["fadeout", "done"].includes(introStage) ? 1 : 0, 
              transition: 'opacity 0.3s ease' 
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", opacity: ["fadeout", "done"].includes(introStage) ? 1 : 0, transition: 'opacity 0.3s ease' }}>
            <h1>{t.title}</h1>
            <span>{t.subtitle}</span>
          </div>
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

              <button 
                className={`spotify-auto-fade-btn ${config.spotify_auto_fade_in ?? true ? "active" : "inactive"}`}
                onClick={handleToggleAutoFade}
                title="Auto Fade-In nach Jingle umschalten"
              >
                {config.spotify_auto_fade_in ?? true ? t.autoFadeActive : t.autoFadeInactive}
              </button>
              
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
            <button 
              className={`loop-toggle-btn ${config.jingle_loop ? "active" : ""}`}
              onClick={handleLoopToggle}
            >
              {config.jingle_loop ? t.loopActive : t.loopInactive}
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

          {/* Soundeffekt / Tusch Panel */}
          <div className="panel-card tusch-card">
            <span className="system-title">{t.tusch}</span>
            <div
              className={`tusch-pad-btn tusch ${activeCategory === "tusch" ? "playing" : ""} ${(config.master_mute && activeCategory !== "tusch") ? "disabled" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => {
                if (!config.master_mute || activeCategory === "tusch") handleTriggerJingle("tusch");
              }}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && (!config.master_mute || activeCategory === "tusch")) {
                  e.preventDefault();
                  handleTriggerJingle("tusch");
                }
              }}
            >
              <div className="tusch-pad-header">
                <span className="tusch-icon">🏆</span>
                <span className="tusch-label">{t.tusch}</span>
              </div>

              {/* Centered Visual Element */}
              <div className="pad-center-content">
                {activeCategory === "tusch" ? (
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
                      {playingSong ? truncateFileName(playingSong, 38) : "..."}
                    </div>
                    {playingSong && playingSong !== "..." && getRemainingTimeStr() !== "" && (
                      <div className="remaining-time-badge">
                        {getRemainingTimeStr()}
                      </div>
                    )}
                  </div>
                ) : (
                  (queues["tusch"] && queues["tusch"].length > 0) ? (
                    <div className="pad-queue-list">
                      <span className="queue-title">NÄCHSTE TITEL:</span>
                      {queues["tusch"].slice(0, 2).map((songPath, idx) => (
                        <div key={songPath} className={`pad-queue-item ${idx === 0 && lockedQueues.includes("tusch") ? "first-locked" : ""}`}>
                          <span className="queue-num">#{idx + 1}</span>
                          <span className="queue-name" title={songPath}>{truncateFileName(songPath, 24)}</span>
                          <button 
                            className="btn-dequeue-mini" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveFromQueue("tusch", songPath);
                            }}
                            title="Aus Warteschlange entfernen"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      {queues["tusch"].length > 2 && (
                        <span className="queue-more">... und {queues["tusch"].length - 2} weitere</span>
                      )}
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
                  )
                )}
              </div>

              <div className="tusch-pad-status">
                <span>{activeCategory === "tusch" ? t.jingleActive : t.jingleIdle}</span>
                <span>
                  {config.categories.tusch?.songs.length || 0} {config.categories.tusch?.songs.length === 1 ? t.songsCountSingle : t.songsCountPlural}
                  {queues["tusch"] && queues["tusch"].length > 0 && ` (${queues["tusch"].length} Q)`}
                </span>
              </div>

              <button
                className="btn-pad-queue-manage"
                onClick={(e) => {
                  e.stopPropagation();
                  setQueueModalCategory("tusch");
                }}
                title="Warteschlange bearbeiten"
              >
                📋
              </button>
            </div>
          </div>
        </div>

        {/* Center Spalte: Launchpad Grid & Stop Button */}
        <div className="center-column">
          <div className="launchpad-grid">
            {CATEGORIES_INFO.filter(cat => cat.id !== "tusch").map((cat) => {
              const categoryData = config.categories[cat.id];
              const songCount = categoryData?.songs.length || 0;
              const isPlaying = activeCategory === cat.id;

              return (
                <div
                  key={cat.id}
                  className={`pad-button ${cat.cssClass} ${isPlaying ? "playing" : ""} ${(config.master_mute && !isPlaying) ? "disabled" : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (!config.master_mute || isPlaying) handleTriggerJingle(cat.id);
                  }}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && (!config.master_mute || isPlaying)) {
                      e.preventDefault();
                      handleTriggerJingle(cat.id);
                    }
                  }}
                >
                  <span className="pad-label">{t[cat.labelKey as keyof typeof t]}</span>

                  <button
                    className="btn-pad-queue-manage"
                    onClick={(e) => {
                      e.stopPropagation();
                      setQueueModalCategory(cat.id);
                    }}
                    title="Warteschlange verwalten"
                  >
                    📋
                  </button>

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
                          {playingSong ? truncateFileName(playingSong, 38) : "..."}
                        </div>
                        {playingSong && playingSong !== "..." && getRemainingTimeStr() !== "" && (
                          <div className="remaining-time-badge">
                            {getRemainingTimeStr()}
                          </div>
                        )}
                      </div>
                    ) : (
                      (queues[cat.id] && queues[cat.id].length > 0) ? (
                        <div className="pad-queue-list">
                          <span className="queue-title">NÄCHSTE TITEL:</span>
                          {queues[cat.id].slice(0, 2).map((songPath, idx) => (
                            <div key={songPath} className={`pad-queue-item ${idx === 0 && lockedQueues.includes(cat.id) ? "first-locked" : ""}`}>
                              <span className="queue-num">#{idx + 1}</span>
                              <span className="queue-name" title={songPath}>{truncateFileName(songPath, 24)}</span>
                              <button 
                                className="btn-dequeue-mini" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveFromQueue(cat.id, songPath);
                                }}
                                title="Aus Warteschlange entfernen"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                          {queues[cat.id].length > 2 && (
                            <span className="queue-more">... und {queues[cat.id].length - 2} weitere</span>
                          )}
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
                      )
                    )}
                  </div>


                  <div className="pad-meta">
                    <span className="pad-status-text">
                      {isPlaying ? t.jingleActive : t.jingleIdle}
                    </span>
                    <span>
                      {songCount} {songCount === 1 ? t.songsCountSingle : t.songsCountPlural}
                      {queues[cat.id] && queues[cat.id].length > 0 && ` (${queues[cat.id].length} in Warteschlange)`}
                    </span>
                  </div>
                </div>

              );
            })}
          </div>

        </div>

        {/* Right Spalte: Mischpult */}
        <div className="panel-card mixer-panel">
          <span className="system-title">{t.mixerTitle}</span>
          
          <div className="mixer-board">
            {/* Spotify Channel */}
            <FaderChannel
              label={t.spotifyLabel}
              value={config.spotify_volume}
              trackColorClass="spotify"
              onChange={(vol) => handleSpotifyVolumeChange(vol, false)}
              onCommit={(vol) => handleSpotifyVolumeChange(vol, true)}
            />

            {/* 4 Jingle Channels */}
            {CATEGORIES_INFO.map((cat) => {
              const categoryData = config.categories[cat.id];
              const vol = categoryData?.volume ?? 0.8;

              return (
                <FaderChannel
                  key={cat.id}
                  label={t[cat.labelKey as keyof typeof t]}
                  value={vol}
                  trackColorClass={cat.cssClass}
                  onChange={(volume) => handleCategoryVolumeChange(cat.id, volume, false)}
                  onCommit={(volume) => handleCategoryVolumeChange(cat.id, volume, true)}
                />
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
                              <span className="song-name" title={song}>{truncateFileName(song, 30)}</span>
                              <span className="song-duration-label">
                                {formatDuration(songDurations[song])}
                              </span>
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
              
              {/* Update Section */}
              <div style={{ marginTop: "20px", borderTop: "1px solid var(--border-color, #444)", paddingTop: "15px" }}>
                <h3 style={{ fontSize: "14px", color: "#aaa", marginBottom: "10px", letterSpacing: "1px", textTransform: "uppercase" }}>
                  {t.updateTitle}
                </h3>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  {updateStatus === "idle" && (
                    <button 
                      className="btn-control" 
                      style={{ background: "transparent", color: "#ffffff", border: "1px solid #444" }}
                      onClick={handleCheckForUpdates}
                    >
                      🔄 {t.updateBtnCheck}
                    </button>
                  )}
                  {updateStatus === "checking" && (
                    <span style={{ fontSize: "14px", color: "#aaa" }}>
                      ⏳ {t.updateChecking}
                    </span>
                  )}
                  {updateStatus === "upToDate" && (
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "14px", color: "#22c55e" }}>
                        ✅ {t.updateUpToDate}
                      </span>
                      <button 
                        className="btn-control" 
                        style={{ padding: "4px 8px", fontSize: "12px", height: "auto" }}
                        onClick={handleCheckForUpdates}
                      >
                        {t.updateBtnCheck}
                      </button>
                    </div>
                  )}
                  {updateStatus === "available" && (
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "14px", color: "var(--accent-brand)" }}>
                        💡 {t.updateAvailable} (v{newVersion})
                      </span>
                      <button 
                        className="btn-control" 
                        style={{ background: "var(--accent-brand)", color: "#000000", border: "none" }}
                        onClick={handleInstallUpdate}
                      >
                        📥 {t.updateBtnInstall}
                      </button>
                    </div>
                  )}
                  {updateStatus === "downloading" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "5px", width: "100%" }}>
                      <span style={{ fontSize: "14px", color: "#aaa" }}>
                        📥 {t.updateDownloading} {updateProgress !== null ? `${updateProgress}%` : ""}
                      </span>
                      <div style={{ width: "100%", height: "6px", background: "#333", borderRadius: "3px", overflow: "hidden" }}>
                        <div style={{ width: `${updateProgress || 0}%`, height: "100%", background: "var(--accent-brand)", transition: "width 0.2s ease" }}></div>
                      </div>
                    </div>
                  )}
                  {updateStatus === "installing" && (
                    <span style={{ fontSize: "14px", color: "var(--accent-brand)" }}>
                      ⚙️ {t.updateInstalling}
                    </span>
                  )}
                  {updateStatus === "failed" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "14px", color: "#ef4444" }}>
                          ❌ {t.updateFailed}
                        </span>
                        <button 
                          className="btn-control" 
                          style={{ padding: "4px 8px", fontSize: "12px", height: "auto" }}
                          onClick={handleCheckForUpdates}
                        >
                          {t.updateBtnCheck}
                        </button>
                      </div>
                      {updateError && (
                        <span style={{ fontSize: "11px", color: "#ef4444", wordBreak: "break-all" }}>
                          {updateError}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Credits / Impressum Section */}
              <div style={{ marginTop: "20px", borderTop: "1px solid var(--border-color, #444)", paddingTop: "15px" }}>
                <div style={{ fontSize: "12px", color: "var(--text-secondary, #aaa)", lineHeight: "1.6" }}>
                  <p style={{ margin: "2px 0" }}>
                    © {new Date().getFullYear()} Lukas Rischmüller & RFV Leonberg. {t.infoRights}
                  </p>
                </div>
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
                      jingle_loop: false,
                      spotify_auto_fade_in: true,
                      categories: {
                        pruefung: { id: "pruefung", name: "Prüfung eröffnen", volume: 0.8, songs: [] },
                        fehlerfrei: { id: "fehlerfrei", name: "Fehlerfrei", volume: 0.8, songs: [] },
                        einlauf: { id: "einlauf", name: "Siegerehrung Einlauf", volume: 0.8, songs: [] },
                        siegerrunde: { id: "siegerrunde", name: "Siegerrunde", volume: 0.8, songs: [] },
                        tusch: { id: "tusch", name: "Siegertusch", volume: 0.8, songs: [] }
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
      {/* MODAL 3: Warteschlangen-Manager */}
      {queueModalCategory && config && (
        <div className="modal-overlay" onClick={() => setQueueModalCategory(null)}>
          <div className="modal-card queue-manager-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t.manageQueueTitle}: {
                queueModalCategory === "tusch" 
                  ? t.tusch 
                  : t[CATEGORIES_INFO.find(c => c.id === queueModalCategory)?.labelKey as keyof typeof t]
              }</h2>
              <button className="btn-close" onClick={() => setQueueModalCategory(null)}>✕</button>
            </div>

            <div className="modal-body queue-manager-body">
              {/* Linke Seite: Aktive Warteschlange */}
              <div className="queue-manager-column active-pane">
                <div className="queue-pane-header">
                  <h3 style={{ margin: 0 }}>{t.queueHeaderActive}</h3>
                  <button
                    className={`btn-modal-lock-queue ${lockedQueues.includes(queueModalCategory) ? "active" : ""}`}
                    onClick={() => handleToggleQueueLock(queueModalCategory)}
                    title={lockedQueues.includes(queueModalCategory) ? "Warteschlange entsperren" : "Warteschlange sperren (ersten Song halten)"}
                  >
                    {lockedQueues.includes(queueModalCategory) ? "🔒" : "🔓"}
                  </button>
                </div>
                <div className="queue-list-container">
                  {(!queues[queueModalCategory] || queues[queueModalCategory].length === 0) ? (
                    <div className="queue-empty-text">{t.queueEmpty}</div>
                  ) : (
                    <ul className="managed-queue-list">
                      {queues[queueModalCategory].map((songPath, idx) => (
                        <li key={`${songPath}-${idx}`} className={`managed-queue-item ${idx === 0 && lockedQueues.includes(queueModalCategory) ? "first-locked" : ""}`}>
                          <div style={{ display: "flex", alignItems: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexGrow: 1 }}>
                            <span className="managed-queue-num">#{idx + 1}</span>
                            <span className="managed-queue-name" title={songPath}>{truncateFileName(songPath, 30)}</span>
                            <span className="song-duration-label">
                              {formatDuration(songDurations[songPath])}
                            </span>
                          </div>
                          <div className="managed-queue-actions">
                            <button 
                              disabled={idx === 0} 
                              onClick={() => moveQueueItem(queueModalCategory, idx, "up")}
                              title="Nach oben verschieben"
                            >
                              ↑
                            </button>
                            <button 
                              disabled={idx === queues[queueModalCategory].length - 1} 
                              onClick={() => moveQueueItem(queueModalCategory, idx, "down")}
                              title="Nach unten verschieben"
                            >
                              ↓
                            </button>
                            <button 
                              className="btn-dequeue-red"
                              onClick={() => handleRemoveFromQueue(queueModalCategory, songPath)}
                              title="Aus Warteschlange entfernen"
                            >
                              ✕
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {queues[queueModalCategory] && queues[queueModalCategory].length > 0 && (
                  <button 
                    className="btn-control btn-clear-queue" 
                    onClick={() => handleSetQueue(queueModalCategory, [])}
                  >
                    🗑️ {t.clearQueue}
                  </button>
                )}
              </div>

              {/* Rechte Seite: Verfügbare Songs */}
              <div className="queue-manager-column available-pane">
                <div className="queue-pane-header">
                  <h3 style={{ margin: 0 }}>{t.queueHeaderAvailable}</h3>
                </div>
                <div className="queue-list-container">
                  {(!config.categories[queueModalCategory] || config.categories[queueModalCategory].songs.length === 0) ? (
                    <div className="queue-empty-text">{t.noSongs}</div>
                  ) : (
                    <ul className="available-songs-list">
                      {config.categories[queueModalCategory].songs.map((songPath) => {
                        const isQueued = (queues[queueModalCategory] || []).includes(songPath);
                        return (
                          <li key={songPath} className="available-song-item">
                            <span className="available-song-name" title={songPath}>{truncateFileName(songPath, 30)}</span>
                            <span className="song-duration-label" style={{ marginRight: "8px" }}>
                              {formatDuration(songDurations[songPath])}
                            </span>
                            <button
                              className={`btn-add-to-queue-action ${isQueued ? "queued" : ""}`}
                              onClick={() => handleAddToQueue(queueModalCategory, songPath)}
                              disabled={isQueued}
                            >
                              {isQueued ? "✓" : "➕"}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="btn-control" 
                style={{ background: "var(--accent-brand)", color: "#000000" }} 
                onClick={() => setQueueModalCategory(null)}
              >
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
