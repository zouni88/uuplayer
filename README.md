# uuplayer

一款参照 QQ影音 设计的 Windows 本地视频播放器，界面简洁、支持全格式视频与音频播放（含网络流），纯本地离线应用，无任何后端依赖。

## 技术架构

- **播放核心**：内置 mpv（解封装/解码完全基于 FFmpeg 8.x），支持几乎所有主流视频、音频格式及 HLS、RTSP 等网络流，无系统解码器依赖
- **桌面壳**：Tauri 2 + Rust，负责 mpv 子进程管理、窗口与 IPC
- **前端 UI**：React 19 + TypeScript + Vite，透明 WebView 悬浮于视频输出之上，实现自绘控制栏、OSD、播放列表等界面

### 工作原理

1. Rust 后端在主窗口内创建一个 Win32 子窗口作为视频输出宿主（`video_host.rs`），置于 z-order 底部
2. 以 `--wid` 参数将该宿主窗口句柄交给 mpv 子进程渲染视频（`mpv.rs`）
3. 通过 Windows 命名管道上的 JSON IPC 与 mpv 通信（播放控制、属性监听、事件回传）
4. 前端经 Tauri command/event 与后端交互，mpv 属性变化实时广播到 UI

## 目录结构

```
uuplayer/
└── frontend_player/              # Tauri 应用（前端 + 后端）
    ├── src/                      # React 前端
    │   ├── components/           # 标题栏、控制栏、OSD、播放列表抽屉、右键菜单等 UI 组件
    │   ├── lib/                  # mpv IPC 封装、格式化工具、最近记录
    │   └── state/                # 播放器全局状态（PlayerContext）
    └── src-tauri/                # Rust 后端
        ├── src/
        │   ├── mpv.rs            # mpv 子进程管理 + JSON IPC
        │   ├── video_host.rs     # 视频输出宿主子窗口（Win32）
        │   └── lib.rs / main.rs  # Tauri 入口与 command 注册
        ├── capabilities/         # Tauri 权限配置
        └── mpv/                  # 内置 mpv.exe 及全部 FFmpeg 依赖 DLL
```

## 开发

环境要求：Node.js、Rust（stable）、Windows 10/11。

```powershell
cd frontend_player
npm install

# 开发模式（热更新）
npm run tauri dev

# 构建发布包
npm run tauri build
```

## 功能特性

- 打开文件 / 打开文件夹批量导入（两个独立入口，支持多选）
- 播放/暂停、进度拖拽、音量、倍速、画面截图
- 音轨 / 字幕轨切换，外挂字幕自动匹配（`--sub-auto=fuzzy`）
- 播放列表抽屉、最近播放记录
- URL 网络流播放（HLS、RTSP 等）
- 硬解加速（`--hwdec=auto-safe`）
- 自绘标题栏与控制栏，简洁现代化界面
