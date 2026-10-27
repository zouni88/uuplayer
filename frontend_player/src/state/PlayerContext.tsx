import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { mpv, onBackendEvent, onMpvEvent, getProperty, setProperty, type MpvEvent } from '../lib/mpv';
import { pushRecent } from '../lib/recent';

export interface PlaylistEntry {
  id: number;
  filename: string;
  title?: string;
  current?: boolean;
}

export interface Track {
  id: number;
  type: 'video' | 'audio' | 'sub';
  selected: boolean;
  title?: string;
  lang?: string;
  codec?: string;
  external?: boolean;
}

export interface OsdInfo {
  icon: string;
  text: string;
  key: number;
}

interface PlayerState {
  ready: boolean;
  idle: boolean;
  paused: boolean;
  time: number;
  duration: number;
  volume: number;
  muted: boolean;
  speed: number;
  playlist: PlaylistEntry[];
  playlistPos: number;
  title: string;
  buffering: boolean;
  tracks: Track[];
  videoW: number;
  videoH: number;
  osd: OsdInfo | null;
}

interface PlayerApi extends PlayerState {
  openMedia: (targets: string[], force?: boolean) => Promise<void>;
  togglePlay: () => void;
  seekTo: (sec: number) => void;
  seekBy: (delta: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  setSpeed: (x: number) => void;
  jumpTo: (index: number) => void;
  removeAt: (index: number) => void;
  next: () => void;
  prev: () => void;
  flash: (icon: string, text: string) => void;
  refreshRecent: () => void;
  recent: string[];
}

const Ctx = createContext<PlayerApi | null>(null);

export function usePlayer(): PlayerApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePlayer must be inside PlayerProvider');
  return v;
}

const VIDEO_EXT = ['mp4','mkv','avi','mov','wmv','flv','webm','ts','m2ts','mpg','mpeg','rm','rmvb','vob','3gp','m4v','f4v','asf','ogv','divx','h264','265','hevc','m2v','mp3','flac','aac','wav','ogg','m4a','opus','wma','ape','m3u8','mpd'];

export function isPlayable(target: string): boolean {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(target)) return true;
  const m = target.toLowerCase().match(/\.([a-z0-9]+)$/);
  return !!m && VIDEO_EXT.includes(m[1]);
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [st, setSt] = useState<PlayerState>({
    ready: false, idle: true, paused: true, time: 0, duration: 0,
    volume: 100, muted: false, speed: 1, playlist: [], playlistPos: -1,
    title: '', buffering: false, tracks: [], videoW: 0, videoH: 0, osd: null,
  });
  const [recent, setRecent] = useState<string[]>([]);
  const ref = useRef(st);
  ref.current = st;
  const osdTimer = useRef<number | undefined>(undefined);

  const patch = useCallback((p: Partial<PlayerState>) => setSt((s) => ({ ...s, ...p })), []);

  const flash = useCallback((icon: string, text: string) => {
    patch({ osd: { icon, text, key: Date.now() } });
    window.clearTimeout(osdTimer.current);
    osdTimer.current = window.setTimeout(() => patch({ osd: null }), 900);
  }, [patch]);

  const refreshRecent = useCallback(() => {
    try { setRecent(JSON.parse(localStorage.getItem('iplayer.recent') || '[]').map((r: { target: string }) => r.target)); } catch { /* ignore */ }
  }, []);

  // 初始化：等待后端就绪后拉取当前状态
  useEffect(() => {
    let stopFns: (() => void)[] = [];
    const init = async () => {
      const [idle, pause, vol, mute, speed, pl, pos, tracks] = await Promise.all([
        getProperty<boolean>('idle-active'),
        getProperty<boolean>('pause'),
        getProperty<number>('volume'),
        getProperty<boolean>('mute'),
        getProperty<number>('speed'),
        getProperty<PlaylistEntry[]>('playlist'),
        getProperty<number>('playlist-pos'),
        getProperty<Track[]>('track-list'),
      ]);
      patch({
        ready: true,
        idle: idle ?? true,
        paused: pause ?? true,
        volume: Math.round(vol ?? 100),
        muted: mute ?? false,
        speed: speed ?? 1,
        playlist: pl ?? [],
        playlistPos: pos ?? -1,
        tracks: tracks ?? [],
      });
    };
    onBackendEvent('mpv-ready', () => init()).then((f) => stopFns.push(f));
    onBackendEvent('mpv-error', (msg) => flash('⚠', String(msg))).then((f) => stopFns.push(f));

    stopFns.push(onMpvEvent((e: MpvEvent) => {
      if (e.event === 'property-change') {
        switch (e.name) {
          case 'time-pos': if (typeof e.data === 'number') patch({ time: e.data }); break;
          case 'duration': patch({ duration: typeof e.data === 'number' ? e.data : 0 }); break;
          case 'pause': patch({ paused: !!e.data }); break;
          case 'volume': patch({ volume: Math.round((e.data as number) ?? 100) }); break;
          case 'mute': patch({ muted: !!e.data }); break;
          case 'speed': patch({ speed: (e.data as number) ?? 1 }); break;
          case 'idle-active': patch({ idle: !!e.data }); break;
          case 'playlist': patch({ playlist: (e.data as PlaylistEntry[]) ?? [] }); break;
          case 'playlist-pos': patch({ playlistPos: (e.data as number) ?? -1 }); break;
          case 'track-list': patch({ tracks: (e.data as Track[]) ?? [] }); break;
          case 'paused-for-cache': patch({ buffering: !!e.data }); break;
          case 'cache-state': patch({ buffering: e.data === 'loading' }); break;
          case 'current-media-title': patch({ title: (e.data as string) || '' }); break;
          case 'video-params': {
            const v = e.data as { w?: number; h?: number } | null;
            patch({ videoW: v?.w ?? 0, videoH: v?.h ?? 0 });
            break;
          }
          case 'path': {
            const p = e.data as string | null;
            if (p) patch({ title: '' });
            break;
          }
        }
      } else if (e.event === 'file-loaded') {
        getProperty<string>('media-title').then((t) => t && patch({ title: t }));
      }
    }));
    refreshRecent();
    return () => stopFns.forEach((f) => f());
  }, [patch, refreshRecent, flash]);

  const openMedia = useCallback(async (targets: string[], force = false) => {
    const list = force ? targets : targets.filter(isPlayable);
    if (!list.length || !ref.current.ready) return;
    const first = ref.current.idle;
    try {
      await mpv(['loadfile', list[0], first ? 'replace' : 'append']);
      for (const t of list.slice(1)) await mpv(['loadfile', t, 'append']);
      if (await getProperty<boolean>('pause')) await setProperty('pause', false);
      pushRecent(list);
      refreshRecent();
    } catch (err) {
      flash('⚠', String(err));
    }
  }, [flash, refreshRecent]);

  const api: PlayerApi = {
    ...st,
    recent,
    refreshRecent,
    openMedia,
    flash,
    togglePlay: useCallback(() => {
      if (ref.current.idle) return;
      setProperty('pause', !ref.current.paused);
    }, []),
    seekTo: useCallback((sec: number) => mpv(['seek', sec, 'absolute']).catch(() => {}), []),
    seekBy: useCallback((d: number) => mpv(['seek', d, 'relative']).catch(() => {}), []),
    setVolume: useCallback((v: number) => {
      const c = Math.max(0, Math.min(130, Math.round(v)));
      patch({ volume: c });
      setProperty('volume', c);
      if (c > 0 && ref.current.muted) setProperty('mute', false);
    }, [patch]),
    toggleMute: useCallback(() => {
      patch({ muted: !ref.current.muted });
      setProperty('mute', !ref.current.muted);
    }, [patch]),
    setSpeed: useCallback((x: number) => {
      patch({ speed: x });
      setProperty('speed', x);
    }, [patch]),
    jumpTo: useCallback((i: number) => setProperty('playlist-pos', i), []),
    removeAt: useCallback((i: number) => mpv(['playlist-remove', i]).catch(() => {}), []),
    next: useCallback(() => mpv(['playlist-next', 'wrap']).catch(() => {}), []),
    prev: useCallback(() => mpv(['playlist-prev', 'wrap']).catch(() => {}), []),
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
