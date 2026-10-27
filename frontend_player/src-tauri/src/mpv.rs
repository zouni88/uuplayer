//! mpv.exe 子进程管理 + JSON IPC（Windows 命名管道）。
//! 协议参考: https://mpv.io/manual/master/#json-ipc

use std::collections::HashMap;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex as StdMutex};
use std::time::Duration;

use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader, ReadHalf, WriteHalf};
use tokio::net::windows::named_pipe::{ClientOptions, NamedPipeClient};
use tokio::sync::{mpsc, oneshot, Mutex};
use tokio::time::timeout;
use tauri::{AppHandle, Emitter};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// 需要监听的 mpv 属性（id >= 60 为异步事件）
const OBSERVED: &[(u64, &str)] = &[
    (60, "time-pos"),
    (61, "duration"),
    (62, "pause"),
    (63, "volume"),
    (64, "mute"),
    (65, "speed"),
    (66, "idle-active"),
    (67, "eof-reached"),
    (68, "playlist"),
    (69, "playlist-pos"),
    (70, "track-list"),
    (71, "current-media-title"),
    (72, "metadata"),
    (73, "video-params"),
    (74, "path"),
    (75, "paused-for-cache"),
    (76, "cache-state"),
    (77, "aspect-name"),
];

type Pending = Arc<Mutex<HashMap<u64, oneshot::Sender<Value>>>>;

pub struct Mpv {
    child: StdMutex<Option<Child>>,
    out_tx: mpsc::UnboundedSender<String>,
    pending: Pending,
    next_id: AtomicU64,
}

impl Mpv {
    /// 启动 mpv 子进程并连接 IPC 管道；成功后注册属性监听并广播 "mpv-ready"。
    pub async fn spawn(
        app: &AppHandle,
        exe_path: &str,
        wid: isize,
        pipe_name: &str,
    ) -> Result<Mpv, String> {
        let mut cmd = Command::new(exe_path);
        cmd.args([
            &format!("--wid={wid}"),
            &format!("--input-ipc-server={pipe_name}"),
            "--no-config",
            "--no-terminal",
            "--no-input-default-bindings",
            "--idle=yes",
            "--keep-open=yes",
            "--osc=no",
            "--force-window=yes",
            "--hwdec=auto-safe",
            "--sub-auto=fuzzy",
            "--screenshot-format=png",
            "--audio-pitch-correction=yes",
            "--volume=100",
        ]);
        cmd.stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
        #[cfg(windows)]
        cmd.creation_flags(CREATE_NO_WINDOW);

        let child = cmd.spawn().map_err(|e| format!("启动 mpv 失败: {e}"))?;

        let (out_tx, out_rx) = mpsc::unbounded_channel::<String>();
        let pending: Pending = Arc::new(Mutex::new(HashMap::new()));
        let mpv = Mpv {
            child: StdMutex::new(Some(child)),
            out_tx,
            pending: pending.clone(),
            next_id: AtomicU64::new(1),
        };

        let pipe_path = format!(r"\\.\pipe\{pipe_name}");
        let client = connect_pipe(&pipe_path).await?;
        let (r, w) = tokio::io::split(client);

        tokio::spawn(writer_task(w, out_rx));
        let reader_pending = pending.clone();
        let reader_app = app.clone();
        tokio::spawn(async move {
            reader_task(r, reader_pending, reader_app).await;
        });

        // 注册属性监听
        for (id, name) in OBSERVED {
            let _ = mpv.request(json!([ "observe_property", id, name ])).await;
        }
        let _ = app.emit("mpv-ready", ());
        Ok(mpv)
    }

    /// 发送命令并等待响应（返回完整响应 JSON，含 data 字段）
    pub async fn request(&self, command: Value) -> Result<Value, String> {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let (tx, rx) = oneshot::channel();
        self.pending.lock().await.insert(id, tx);
        let line = json!({ "command": command, "request_id": id }).to_string();
        self.out_tx.send(line).map_err(|_| "mpv 已退出".to_string())?;
        let resp = timeout(Duration::from_secs(15), rx)
            .await
            .map_err(|_| "mpv 响应超时".to_string())?
            .map_err(|_| "mpv 连接中断".to_string())?;
        let err = resp.get("error").and_then(Value::as_str).unwrap_or("success").to_string();
        if err != "success" {
            return Err(err);
        }
        Ok(resp)
    }

    pub fn kill(&self) {
        if let Some(mut child) = self.child.lock().unwrap().take() {
            let _ = child.kill();
        }
    }
}

async fn connect_pipe(path: &str) -> Result<NamedPipeClient, String> {
    let deadline = tokio::time::Instant::now() + Duration::from_secs(20);
    loop {
        match ClientOptions::new().open(path) {
            Ok(p) => return Ok(p),
            Err(e) => {
                if tokio::time::Instant::now() > deadline {
                    return Err(format!("连接 mpv IPC 失败: {e}"));
                }
                tokio::time::sleep(Duration::from_millis(100)).await;
            }
        }
    }
}

async fn writer_task(mut w: WriteHalf<NamedPipeClient>, mut rx: mpsc::UnboundedReceiver<String>) {
    while let Some(line) = rx.recv().await {
        if w.write_all(line.as_bytes()).await.is_err()
            || w.write_all(b"\n").await.is_err()
            || w.flush().await.is_err()
        {
            break;
        }
    }
}

async fn reader_task(
    r: ReadHalf<NamedPipeClient>,
    pending: Pending,
    app: AppHandle,
) {
    let mut lines = BufReader::new(r).lines();
    while let Ok(Some(line)) = lines.next_line().await {
        let Ok(v) = serde_json::from_str::<Value>(&line) else { continue };
        if let Some(id) = v.get("request_id").and_then(Value::as_u64) {
            if let Some(tx) = pending.lock().await.remove(&id) {
                let _ = tx.send(v);
            }
        } else {
            let _ = app.emit("mpv-event", &v);
        }
    }
    let _ = app.emit("mpv-exit", ());
}
