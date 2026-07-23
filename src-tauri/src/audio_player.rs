use rodio::{Decoder, OutputStream, OutputStreamHandle, Sink};
use std::fs::File;
use std::io::BufReader;
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicU64, Ordering};
use std::thread;
use std::time::Duration;

pub struct AudioPlayer {
    sink: Arc<Mutex<Option<Arc<Sink>>>>,
    stream_handle: OutputStreamHandle,
    generation: Arc<AtomicU64>,
    // Keep the stream alive so the audio device remains active
    _stream: OutputStream,
}

impl AudioPlayer {
    pub fn new() -> Result<Self, String> {
        let (stream, stream_handle) = OutputStream::try_default()
            .map_err(|e| format!("Failed to open default audio output stream: {}", e))?;
        Ok(Self {
            sink: Arc::new(Mutex::new(None)),
            stream_handle,
            generation: Arc::new(AtomicU64::new(0)),
            _stream: stream,
        })
    }

    pub fn play(&self, path: &str, volume: f32) -> Result<(), String> {
        // Stop any running sound immediately before starting a new one
        self.stop_immediate();

        let file = File::open(path)
            .map_err(|e| format!("Failed to open file ({}): {}", path, e))?;
        let reader = BufReader::new(file);
        let source = Decoder::new(reader)
            .map_err(|e| format!("Failed to decode audio file: {}", e))?;

        let sink = Sink::try_new(&self.stream_handle)
            .map_err(|e| format!("Failed to create audio sink: {}", e))?;

        sink.set_volume(volume);
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

        let sink = Sink::try_new(&self.stream_handle)
            .map_err(|e| format!("Failed to create audio sink: {}", e))?;

        sink.set_volume(volume);
        sink.append(source);

        let mut current_sink = self.sink.lock().unwrap();
        *current_sink = Some(Arc::new(sink));

        Ok(())
    }

    pub fn stop_immediate(&self) {
        self.generation.fetch_add(1, Ordering::SeqCst);
        let mut current_sink = self.sink.lock().unwrap();
        if let Some(sink) = current_sink.take() {
            sink.stop();
        }
    }

    pub fn stop_fade(&self, fade_duration: Duration) {
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
                let steps = 20;
                let step_duration = fade_duration / steps;

                for i in 1..=steps {
                    if generation.load(Ordering::SeqCst) != current_gen {
                        sink.stop();
                        return;
                    }
                    let factor = 1.0 - (i as f32 / steps as f32);
                    sink.set_volume(start_vol * factor);
                    thread::sleep(step_duration);
                }

                if generation.load(Ordering::SeqCst) == current_gen {
                    sink.stop();
                    let mut lock = sink_mutex.lock().unwrap();
                    *lock = None;
                }
            }
        });
    }

    pub fn is_playing(&self) -> bool {
        let current_sink = self.sink.lock().unwrap();
        if let Some(sink) = &*current_sink {
            !sink.empty()
        } else {
            false
        }
    }

    pub fn get_sink_clone(&self) -> Arc<Mutex<Option<Arc<Sink>>>> {
        self.sink.clone()
    }

    pub fn get_generation_clone(&self) -> Arc<AtomicU64> {
        self.generation.clone()
    }

    pub fn get_current_generation(&self) -> u64 {
        self.generation.load(Ordering::SeqCst)
    }

    pub fn set_volume(&self, volume: f32) {
        let current_sink = self.sink.lock().unwrap();
        if let Some(sink) = &*current_sink {
            sink.set_volume(volume);
        }
    }
}

// Safe to send across threads
unsafe impl Send for AudioPlayer {}
unsafe impl Sync for AudioPlayer {}

