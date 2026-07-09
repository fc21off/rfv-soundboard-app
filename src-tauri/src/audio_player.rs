use rodio::{Decoder, OutputStream, OutputStreamHandle, Sink};
use std::fs::File;
use std::io::BufReader;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

pub struct AudioPlayer {
    sink: Arc<Mutex<Option<Sink>>>,
    stream_handle: OutputStreamHandle,
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
        *current_sink = Some(sink);

        Ok(())
    }

    pub fn stop_immediate(&self) {
        let mut current_sink = self.sink.lock().unwrap();
        if let Some(sink) = current_sink.take() {
            sink.stop();
        }
    }

    pub fn stop_fade(&self, fade_duration: Duration) {
        let sink_clone = self.sink.clone();
        thread::spawn(move || {
            // Take ownership of the sink so no other thread can modify it while we fade it out
            let sink_opt = {
                let mut current_sink = sink_clone.lock().unwrap();
                current_sink.take()
            };

            if let Some(sink) = sink_opt {
                let start_vol = sink.volume();
                let steps = 20;
                let step_duration = fade_duration / steps;
                
                for i in 1..=steps {
                    let factor = 1.0 - (i as f32 / steps as f32);
                    sink.set_volume(start_vol * factor);
                    thread::sleep(step_duration);
                }
                sink.stop();
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

    pub fn get_sink_clone(&self) -> Arc<Mutex<Option<Sink>>> {
        self.sink.clone()
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
