use rodio::cpal::traits::{DeviceTrait, HostTrait};
use rodio::{cpal, Decoder, OutputStream, OutputStreamHandle, Sink};
use std::fs::File;
use std::io::BufReader;
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicU64, Ordering};
use std::thread;
use std::time::Duration;

pub struct AudioPlayer {
    sink: Arc<Mutex<Option<Arc<Sink>>>>,
    overlay_sink: Arc<Mutex<Option<Arc<Sink>>>>,
    stream_handle: Arc<Mutex<Option<OutputStreamHandle>>>,
    generation: Arc<AtomicU64>,
    overlay_generation: Arc<AtomicU64>,
    duck_generation: Arc<AtomicU64>,
    current_device: Arc<Mutex<Option<String>>>,
    // Keep the stream alive so the audio device remains active
    _stream: Arc<Mutex<Option<OutputStream>>>,
}

impl AudioPlayer {
    pub fn get_output_devices() -> Vec<String> {
        let host = cpal::default_host();
        let mut names = Vec::new();
        if let Ok(devices) = host.output_devices() {
            for device in devices {
                if let Ok(name) = device.name() {
                    names.push(name);
                }
            }
        }
        names
    }

    fn open_device(device_name: Option<&str>) -> Result<(OutputStream, OutputStreamHandle), String> {
        match device_name {
            Some(name) if !name.is_empty() && name != "default" => {
                let host = cpal::default_host();
                let mut matched_device = None;
                if let Ok(devices) = host.output_devices() {
                    for dev in devices {
                        if let Ok(dev_name) = dev.name() {
                            if dev_name == name {
                                matched_device = Some(dev);
                                break;
                            }
                        }
                    }
                }

                if let Some(dev) = matched_device {
                    OutputStream::try_from_device(&dev)
                        .map_err(|e| format!("Failed to open audio device '{}': {}", name, e))
                } else {
                    // Fallback to default if selected device is disconnected
                    OutputStream::try_default()
                        .map_err(|e| format!("Named device '{}' not found and default device failed: {}", name, e))
                }
            }
            _ => OutputStream::try_default()
                .map_err(|e| format!("Failed to open default audio output stream: {}", e)),
        }
    }

    pub fn new(initial_device: Option<&str>) -> Result<Self, String> {
        let (stream, stream_handle) = Self::open_device(initial_device)?;
        Ok(Self {
            sink: Arc::new(Mutex::new(None)),
            overlay_sink: Arc::new(Mutex::new(None)),
            stream_handle: Arc::new(Mutex::new(Some(stream_handle))),
            generation: Arc::new(AtomicU64::new(0)),
            overlay_generation: Arc::new(AtomicU64::new(0)),
            duck_generation: Arc::new(AtomicU64::new(0)),
            current_device: Arc::new(Mutex::new(initial_device.map(|s| s.to_string()))),
            _stream: Arc::new(Mutex::new(Some(stream))),
        })
    }

    pub fn set_device(&self, device_name: Option<&str>) -> Result<(), String> {
        self.stop_all_immediate();

        let (stream, stream_handle) = Self::open_device(device_name)?;

        let mut stream_lock = self._stream.lock().unwrap();
        let mut handle_lock = self.stream_handle.lock().unwrap();
        let mut current_dev_lock = self.current_device.lock().unwrap();

        *stream_lock = Some(stream);
        *handle_lock = Some(stream_handle);
        *current_dev_lock = device_name.map(|s| s.to_string());

        Ok(())
    }

    pub fn play(&self, path: &str, volume: f32) -> Result<(), String> {
        // Stop any running main sound immediately before starting a new one
        self.stop_immediate();

        let file = File::open(path)
            .map_err(|e| format!("Failed to open file ({}): {}", path, e))?;
        let reader = BufReader::new(file);
        let source = Decoder::new(reader)
            .map_err(|e| format!("Failed to decode audio file: {}", e))?;

        let handle = {
            let handle_lock = self.stream_handle.lock().unwrap();
            handle_lock.clone().ok_or_else(|| "Audio output stream handle not available".to_string())?
        };

        let sink = Sink::try_new(&handle)
            .map_err(|e| format!("Failed to create audio sink: {}", e))?;

        // If overlay fanfare is currently playing, duck main volume immediately
        let play_vol = if self.is_overlay_playing() {
            0.0
        } else {
            volume
        };

        sink.set_volume(play_vol);
        sink.append(source);

        let mut current_sink = self.sink.lock().unwrap();
        *current_sink = Some(Arc::new(sink));

        Ok(())
    }

    pub fn play_loop(&self, path: &str, volume: f32) -> Result<(), String> {
        // We do NOT stop_immediate or increment generation because this is a natural loop repetition 
        // within the same playback session.
        let file = File::open(path)
            .map_err(|e| format!("Failed to open file ({}): {}", path, e))?;
        let reader = BufReader::new(file);
        let source = Decoder::new(reader)
            .map_err(|e| format!("Failed to decode audio file: {}", e))?;

        let handle = {
            let handle_lock = self.stream_handle.lock().unwrap();
            handle_lock.clone().ok_or_else(|| "Audio output stream handle not available".to_string())?
        };

        let sink = Sink::try_new(&handle)
            .map_err(|e| format!("Failed to create audio sink: {}", e))?;

        let play_vol = if self.is_overlay_playing() {
            0.0
        } else {
            volume
        };

        sink.set_volume(play_vol);
        sink.append(source);

        let mut current_sink = self.sink.lock().unwrap();
        *current_sink = Some(Arc::new(sink));

        Ok(())
    }

    pub fn play_overlay(&self, path: &str, volume: f32) -> Result<(), String> {
        // Stop previous overlay sound if any
        self.stop_overlay_immediate();

        let file = File::open(path)
            .map_err(|e| format!("Failed to open file ({}): {}", path, e))?;
        let reader = BufReader::new(file);
        let source = Decoder::new(reader)
            .map_err(|e| format!("Failed to decode audio file: {}", e))?;

        let handle = {
            let handle_lock = self.stream_handle.lock().unwrap();
            handle_lock.clone().ok_or_else(|| "Audio output stream handle not available".to_string())?
        };

        let sink = Sink::try_new(&handle)
            .map_err(|e| format!("Failed to create overlay audio sink: {}", e))?;

        sink.set_volume(volume);
        sink.append(source);

        let mut current_overlay = self.overlay_sink.lock().unwrap();
        *current_overlay = Some(Arc::new(sink));

        Ok(())
    }

    pub fn stop_immediate(&self) {
        self.generation.fetch_add(1, Ordering::SeqCst);
        self.duck_generation.fetch_add(1, Ordering::SeqCst);
        let mut current_sink = self.sink.lock().unwrap();
        if let Some(sink) = current_sink.take() {
            sink.stop();
        }
    }

    pub fn stop_overlay_immediate(&self) {
        self.overlay_generation.fetch_add(1, Ordering::SeqCst);
        let mut current_overlay = self.overlay_sink.lock().unwrap();
        if let Some(sink) = current_overlay.take() {
            sink.stop();
        }
    }

    pub fn stop_all_immediate(&self) {
        self.stop_immediate();
        self.stop_overlay_immediate();
    }

    pub fn stop_fade(&self, fade_duration: Duration) {
        self.duck_generation.fetch_add(1, Ordering::SeqCst);
        let current_gen = self.generation.fetch_add(1, Ordering::SeqCst) + 1;
        let sink_opt = {
            let current_sink = self.sink.lock().unwrap();
            current_sink.clone()
        };

        let generation = self.generation.clone();
        let sink_mutex = self.sink.clone();

        thread::spawn(move || {
            if let Some(sink) = sink_opt {
                let start_vol = sink.volume();
                let steps = (fade_duration.as_millis() / 15).max(20) as usize;
                let step_duration = fade_duration / steps as u32;

                for i in 1..=steps {
                    if generation.load(Ordering::SeqCst) != current_gen {
                        sink.stop();
                        return;
                    }
                    let t = i as f32 / steps as f32;
                    // Exponential perceptual curve: (1 - t)^2.2
                    // Human hearing is logarithmic; this ensures the perceived loudness decays smoothly to silence
                    let factor = (1.0 - t).powf(2.2);
                    sink.set_volume(start_vol * factor);
                    thread::sleep(step_duration);
                }

                if generation.load(Ordering::SeqCst) == current_gen {
                    sink.set_volume(0.0);
                    sink.stop();
                    let mut lock = sink_mutex.lock().unwrap();
                    *lock = None;
                }
            }
        });
    }

    pub fn fade_volume(&self, target_volume: f32, duration: Duration) {
        let current_duck_gen = self.duck_generation.fetch_add(1, Ordering::SeqCst) + 1;
        let duck_gen = self.duck_generation.clone();
        let main_gen = self.generation.clone();
        let play_gen = self.generation.load(Ordering::SeqCst);
        let sink_opt = {
            let current_sink = self.sink.lock().unwrap();
            current_sink.clone()
        };

        if let Some(sink) = sink_opt {
            thread::spawn(move || {
                let start_vol = sink.volume();
                let steps = (duration.as_millis() / 15).max(10) as usize;
                let step_duration = duration / steps as u32;

                for i in 1..=steps {
                    if main_gen.load(Ordering::SeqCst) != play_gen || duck_gen.load(Ordering::SeqCst) != current_duck_gen {
                        return;
                    }
                    let t = i as f32 / steps as f32;
                    // S-curve smoothstep for natural audio transition
                    let factor = t * t * (3.0 - 2.0 * t);
                    let current_vol = start_vol + (target_volume - start_vol) * factor;
                    sink.set_volume(current_vol);
                    thread::sleep(step_duration);
                }

                if main_gen.load(Ordering::SeqCst) == play_gen && duck_gen.load(Ordering::SeqCst) == current_duck_gen {
                    sink.set_volume(target_volume);
                }
            });
        }
    }

    pub fn is_playing(&self) -> bool {
        let current_sink = self.sink.lock().unwrap();
        if let Some(sink) = &*current_sink {
            !sink.empty()
        } else {
            false
        }
    }

    pub fn is_overlay_playing(&self) -> bool {
        let current_overlay = self.overlay_sink.lock().unwrap();
        if let Some(sink) = &*current_overlay {
            !sink.empty()
        } else {
            false
        }
    }

    pub fn is_any_playing(&self) -> bool {
        self.is_playing() || self.is_overlay_playing()
    }

    pub fn get_sink_clone(&self) -> Arc<Mutex<Option<Arc<Sink>>>> {
        self.sink.clone()
    }

    pub fn get_overlay_sink_clone(&self) -> Arc<Mutex<Option<Arc<Sink>>>> {
        self.overlay_sink.clone()
    }

    pub fn get_generation_clone(&self) -> Arc<AtomicU64> {
        self.generation.clone()
    }

    pub fn get_overlay_generation_clone(&self) -> Arc<AtomicU64> {
        self.overlay_generation.clone()
    }

    pub fn get_current_generation(&self) -> u64 {
        self.generation.load(Ordering::SeqCst)
    }

    pub fn get_current_overlay_generation(&self) -> u64 {
        self.overlay_generation.load(Ordering::SeqCst)
    }

    pub fn set_volume(&self, volume: f32) {
        self.duck_generation.fetch_add(1, Ordering::SeqCst);
        let current_sink = self.sink.lock().unwrap();
        if let Some(sink) = &*current_sink {
            sink.set_volume(volume);
        }
    }

    pub fn set_overlay_volume(&self, volume: f32) {
        let current_overlay = self.overlay_sink.lock().unwrap();
        if let Some(sink) = &*current_overlay {
            sink.set_volume(volume);
        }
    }
}

// Safe to send across threads
unsafe impl Send for AudioPlayer {}
unsafe impl Sync for AudioPlayer {}

