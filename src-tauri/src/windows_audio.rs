use windows::core::Interface;
use windows::Win32::Foundation::CloseHandle;
use windows::Win32::System::Com::{CoInitializeEx, CoCreateInstance, CLSCTX_ALL, COINIT_MULTITHREADED};
use windows::Win32::Media::Audio::{
    IMMDeviceEnumerator, MMDeviceEnumerator, eRender, eConsole,
    IAudioSessionManager2, IAudioSessionEnumerator, IAudioSessionControl2,
    ISimpleAudioVolume
};
use windows::Win32::System::Threading::{OpenProcess, PROCESS_QUERY_INFORMATION, PROCESS_VM_READ};
use windows::Win32::System::ProcessStatus::GetModuleBaseNameW;
use windows::Win32::UI::Input::KeyboardAndMouse::{
    keybd_event, KEYBD_EVENT_FLAGS, KEYEVENTF_KEYUP, VK_MEDIA_PLAY_PAUSE
};

// Helper to get the process name from its PID
fn get_process_name(pid: u32) -> Option<String> {
    if pid == 0 {
        return None;
    }
    unsafe {
        let handle_res = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, false, pid);
        if let Ok(handle) = handle_res {
            let mut buffer = vec![0u16; 260];
            let len = GetModuleBaseNameW(handle, None, &mut buffer);
            let _ = CloseHandle(handle);
            if len > 0 {
                let name = String::from_utf16_lossy(&buffer[..len as usize]);
                return Some(name.to_lowercase());
            }
        }
    }
    None
}

// Helper to run COM-based operations safely
fn run_com_audio_op<F>(op: F) -> Result<(), String>
where
    F: FnOnce(&IAudioSessionEnumerator) -> Result<(), windows::core::Error>,
{
    unsafe {
        let _init_res = CoInitializeEx(None, COINIT_MULTITHREADED);
        
        let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
            .map_err(|e| format!("Failed to create MMDeviceEnumerator: {:?}", e))?;
            
        let device = enumerator.GetDefaultAudioEndpoint(eRender, eConsole)
            .map_err(|e| format!("Failed to get default audio endpoint: {:?}", e))?;
            
        let manager: IAudioSessionManager2 = device.Activate(CLSCTX_ALL, None)
            .map_err(|e| format!("Failed to activate IAudioSessionManager2: {:?}", e))?;
            
        let session_enum = manager.GetSessionEnumerator()
            .map_err(|e| format!("Failed to get session enumerator: {:?}", e))?;
            
        op(&session_enum).map_err(|e| format!("Audio operation failed: {:?}", e))?;
    }
    Ok(())
}

/// Mute or unmute Spotify specifically in the Windows Volume Mixer
pub fn mute_spotify(mute: bool) -> Result<(), String> {
    run_com_audio_op(|session_enum| unsafe {
        let count = session_enum.GetCount()?;
        for i in 0..count {
            let session_control = session_enum.GetSession(i)?;
            let session_control2: IAudioSessionControl2 = session_control.cast()?;
            let pid = session_control2.GetProcessId()?;
            if let Some(name) = get_process_name(pid) {
                if name.contains("spotify") {
                    let volume_control: ISimpleAudioVolume = session_control.cast()?;
                    volume_control.SetMute(mute, std::ptr::null())?;
                }
            }
        }
        Ok(())
    })
}

/// Set the volume of Spotify specifically (0.0 to 1.0)
pub fn set_spotify_volume(volume: f32) -> Result<(), String> {
    run_com_audio_op(|session_enum| unsafe {
        let count = session_enum.GetCount()?;
        for i in 0..count {
            let session_control = session_enum.GetSession(i)?;
            let session_control2: IAudioSessionControl2 = session_control.cast()?;
            let pid = session_control2.GetProcessId()?;
            if let Some(name) = get_process_name(pid) {
                if name.contains("spotify") {
                    let volume_control: ISimpleAudioVolume = session_control.cast()?;
                    volume_control.SetMasterVolume(volume, std::ptr::null())?;
                }
            }
        }
        Ok(())
    })
}

/// Simulate a global media key press for Play/Pause. Controls Spotify if it is active.
pub fn simulate_media_key_play_pause() {
    unsafe {
        // Key down
        keybd_event(VK_MEDIA_PLAY_PAUSE.0 as u8, 0, KEYBD_EVENT_FLAGS(0), 0);
        // Key up
        keybd_event(VK_MEDIA_PLAY_PAUSE.0 as u8, 0, KEYEVENTF_KEYUP, 0);
    }
}

