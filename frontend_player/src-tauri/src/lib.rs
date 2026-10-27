mod mpv;
mod video_host;

use std::sync::{Arc, Mutex, OnceLock};

use mpv::Mpv;
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager, State, WindowEvent};
use tauri::path::BaseDirectory;

use video_host::{client_size, create_host, destroy_host, resize_host};

struct AppState {
    host: OnceLock<isize>,
    mpv: Mutex<Option<Arc<Mpv>>>,
}

/// 解析 mpv.exe 路径：优先打包资源，其次开发目录 src-tauri/mpv
fn resolve_mpv_exe(app: &AppHandle) -> Option<String> {
    if let Ok(p) = app.path().resolve("mpv/mpv.exe", BaseDirectory::Resource) {
        if p.exists() {
            return Some(p.to_string_lossy().into_owned());
        }
    }
    let dev = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("mpv").join("mpv.exe");
    if dev.exists() {
        return Some(dev.to_string_lossy().into_owned());
    }
    None
}

fn spawn_player(app: AppHandle, state: Arc<AppState>) {
    tauri::async_runtime::spawn(async move {
        let exe = match resolve_mpv_exe(&app) {
            Some(e) => e,
            None => {
                let _ = app.emit("mpv-error", "找不到 mpv.exe");
                return;
            }
        };
        let wid = match state.host.get() {
            Some(w) => *w,
            None => return,
        };
        let pipe = format!("iplayer-mpv-{}", std::process::id());
        match Mpv::spawn(&app, &exe, wid, &pipe).await {
            Ok(m) => {
                *state.mpv.lock().unwrap() = Some(Arc::new(m));
            }
            Err(e) => {
                let _ = app.emit("mpv-error", e);
            }
        }
    });
}

#[tauri::command]
async fn mpv_request(state: State<'_, Arc<AppState>>, cmd: Vec<Value>) -> Result<Value, String> {
    let mpv = state.mpv.lock().unwrap().clone().ok_or("播放器未就绪")?;
    mpv.request(Value::Array(cmd)).await
}

#[tauri::command]
fn set_video_rect(state: State<'_, Arc<AppState>>, x: i32, y: i32, w: i32, h: i32) -> Result<(), String> {
    let host = state.host.get().ok_or("宿主窗口未创建")?;
    unsafe { resize_host(*host, x, y, w, h) }
}

#[tauri::command]
async fn take_screenshot(state: State<'_, Arc<AppState>>, app: AppHandle) -> Result<String, String> {
    let mpv = state.mpv.lock().unwrap().clone().ok_or("播放器未就绪")?;
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("screenshots");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let path = dir.join(format!("shot_{ts}.png"));
    let path_str = path.to_string_lossy().into_owned();
    mpv.request(serde_json::json!(["screenshot-to-file", path_str, "video"])).await?;
    Ok(path_str)
}

#[tauri::command]
fn is_ready(state: State<'_, Arc<AppState>>) -> bool {
    state.mpv.lock().unwrap().is_some()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let state = Arc::new(AppState {
        host: OnceLock::new(),
        mpv: Mutex::new(None),
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(state.clone())
        .setup({
            let state = state.clone();
            move |app| {
                let win = app.get_webview_window("main").ok_or("缺少 main 窗口")?;
                let parent_raw = win.hwnd().map_err(|e| e.to_string())?.0 as isize;
                let (w, h) = unsafe { client_size(parent_raw) };
                let host = unsafe { create_host(parent_raw, w.max(1), h.max(1))? };
                let _ = state.host.set(host);
                spawn_player(app.handle().clone(), state.clone());
                Ok(())
            }
        })
        .on_window_event({
            let state = state.clone();
            move |window, event| {
                if let WindowEvent::Destroyed = event {
                    if window.label() == "main" {
                        if let Some(m) = state.mpv.lock().unwrap().take() {
                            m.kill();
                        }
                        if let Some(host) = state.host.get() {
                            unsafe { destroy_host(*host) };
                        }
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            mpv_request,
            set_video_rect,
            take_screenshot,
            is_ready
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
