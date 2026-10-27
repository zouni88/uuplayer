import { useCallback, useEffect, useRef, useState } from 'react';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { open } from '@tauri-apps/plugin-dialog';
import { PlayerProvider, usePlayer } from './state/PlayerContext';
import { onBackendEvent, setVideoRect, takeScreenshot } from './lib/mpv';
import TitleBar from './components/TitleBar';
import ControlBar from './components/ControlBar';
import PlaylistDrawer from './components/PlaylistDrawer';
import ContextMenu from './components/ContextMenu';
import UrlDialog from './components/UrlDialog';
import Osd from './components/Osd';
import EmptyState from './components/EmptyState';
import './App.css';

const FILE_FILTERS = [
  {
    name: '视频/音频',
    extensions: [
      'mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'ts', 'm2ts', 'mpg', 'mpeg',
      'rm', 'rmvb', 'vob', '3gp', 'm4v', 'asf', 'ogv', 'mp3', 'flac', 'aac', 'wav',
      'ogg', 'm4a', 'opus', 'wma', 'ape', 'm3u8', 'mpd',
    ],
  },
  { name: '所有文件', extensions: ['*'] },
];

function Player() {
  const p = usePlayer();
  const win = getCurrentWindow();
  const [uiVisible, setUiVisible] = useState(true);
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [urlOpen, setUrlOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const hideTimer = useRef<number | undefined>(undefined);
  const busy = useRef({ hover: false, menu: false, url: false, list: false, drag: false });
  busy.current.menu = !!menu;
  busy.current.url = urlOpen;
  busy.current.list = playlistOpen;

  // 延时后隐藏 UI；若鼠标仍悬停在控制条/拖拽进度/有弹层则保持显示
  const hideUi = useCallback((delay: number) => {
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      const b = busy.current;
      if (!b.hover && !b.menu && !b.url && !b.list && !b.drag) setUiVisible(false);
    }, delay);
  }, []);

  // 鼠标移动显示 UI，播放中 2.6s 后自动隐藏
  const showUi = useCallback(() => {
    setUiVisible(true);
    hideUi(2600);
  }, [hideUi]);

  // 视频宿主窗口铺满整个窗口（物理像素）
  useEffect(() => {
    const sync = () => {
      const d = Math.max(1, window.devicePixelRatio || 1);
      setVideoRect(0, 0, Math.round(window.innerWidth * d), Math.round(window.innerHeight * d)).catch(() => {});
    };
    sync();
    const onResize = () => sync();
    window.addEventListener('resize', onResize);
    const un = win.onResized(sync);
    return () => {
      window.removeEventListener('resize', onResize);
      un.then((f) => f());
    };
  }, [win]);

  // 全屏状态跟踪
  useEffect(() => {
    const check = () => win.isFullscreen().then(setFullscreen).catch(() => {});
    check();
    const un = win.onResized(check);
    return () => {
      un.then((f) => f());
    };
  }, [win]);

  // mpv 进程退出
  useEffect(() => {
    const un = onBackendEvent('mpv-exit', () => p.flash('⚠', '播放器进程已退出'));
    return () => {
      un.then((f) => f());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 文件拖放
  useEffect(() => {
    const un = getCurrentWebview().onDragDropEvent((e) => {
      if (e.payload.type === 'over') showUi();
      else if (e.payload.type === 'drop') p.openMedia(e.payload.paths, true);
    });
    return () => {
      un.then((f) => f());
    };
  }, [p, showUi]);

  const toggleFs = useCallback(async () => {
    const fs = await win.isFullscreen();
    await win.setFullscreen(!fs);
  }, [win]);

  const doOpenFiles = useCallback(async () => {
    const sel = await open({ multiple: true, filters: FILE_FILTERS });
    if (sel) p.openMedia(Array.isArray(sel) ? sel : [sel]);
  }, [p]);

  const doOpenFolder = useCallback(async () => {
    const sel = await open({ directory: true });
    if (sel) p.openMedia([sel as string], true);
  }, [p]);

  const doScreenshot = useCallback(async () => {
    try {
      const path = await takeScreenshot();
      p.flash('📸', '已保存 ' + path);
    } catch (e) {
      p.flash('⚠', String(e));
    }
  }, [p]);

  const togglePin = useCallback(async () => {
    const v = !pinned;
    await win.setAlwaysOnTop(v);
    setPinned(v);
  }, [pinned, win]);

  // 快捷键
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return;
      const k = e.key;
      if (k === ' ') {
        e.preventDefault();
        p.togglePlay();
      } else if (k === 'ArrowLeft') p.seekBy(-5);
      else if (k === 'ArrowRight') p.seekBy(5);
      else if (k === 'ArrowUp') p.setVolume(p.volume + 5);
      else if (k === 'ArrowDown') p.setVolume(p.volume - 5);
      else if (k === 'f' || k === 'F') toggleFs();
      else if (k === 'm' || k === 'M') p.toggleMute();
      else if (k === 's' || k === 'S') doScreenshot();
      else if (k === '[') p.setSpeed(Math.max(0.25, +(p.speed - 0.25).toFixed(2)));
      else if (k === ']') p.setSpeed(Math.min(4, +(p.speed + 0.25).toFixed(2)));
      else if (k === 'PageUp') p.prev();
      else if (k === 'PageDown') p.next();
      else if (k === 'Escape') {
        setMenu(null);
        setUrlOpen(false);
        setPlaylistOpen(false);
      } else if ((k === 'o' || k === 'O') && e.ctrlKey) {
        e.preventDefault();
        doOpenFiles();
      } else if ((k === 'u' || k === 'U') && e.ctrlKey) {
        e.preventDefault();
        setUrlOpen(true);
      } else if ((k === 'l' || k === 'L') && e.ctrlKey) {
        e.preventDefault();
        setPlaylistOpen((v) => !v);
      }
      showUi();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [p, toggleFs, doScreenshot, doOpenFiles, showUi]);

  // 滚轮调音量
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      const v = Math.max(0, Math.min(130, p.volume + (e.deltaY < 0 ? 5 : -5)));
      p.setVolume(v);
      p.flash(v === 0 ? '🔇' : '🔊', `${v}%`);
      showUi();
    },
    [p, showUi]
  );

  return (
    <div
      className={'root' + (uiVisible ? '' : ' ui-cursor-hidden')}
      onMouseMove={showUi}
      onMouseLeave={() => hideUi(260)} // 鼠标移出窗口立即隐藏（对齐 QQ影音）
      onDoubleClick={toggleFs}
      onWheel={onWheel}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      <TitleBar hidden={!uiVisible} />
      <EmptyState onOpenFiles={doOpenFiles} onOpenUrl={() => setUrlOpen(true)} />
      <Osd />

      <div
        className="ui-bottom"
        onMouseEnter={() => (busy.current.hover = true)}
        onMouseLeave={() => {
          busy.current.hover = false;
          hideUi(260); // 鼠标离开控制条后很快消失（对齐 QQ影音）
        }}
      >
        <ControlBar
          hidden={!uiVisible}
          fullscreen={fullscreen}
          playlistOpen={playlistOpen}
          onTogglePlaylist={() => setPlaylistOpen((v) => !v)}
          onToggleFullscreen={toggleFs}
          onDragChange={(d) => (busy.current.drag = d)}
        />
      </div>

      <PlaylistDrawer open={playlistOpen} onClose={() => setPlaylistOpen(false)} />

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          pinned={pinned}
          onClose={() => setMenu(null)}
          onOpenFiles={doOpenFiles}
          onOpenFolder={doOpenFolder}
          onOpenUrl={() => setUrlOpen(true)}
          onScreenshot={doScreenshot}
          onTogglePin={togglePin}
        />
      )}

      {urlOpen && (
        <UrlDialog
          onClose={() => setUrlOpen(false)}
          onSubmit={(urls) => p.openMedia(urls)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <PlayerProvider>
      <Player />
    </PlayerProvider>
  );
}
