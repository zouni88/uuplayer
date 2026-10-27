import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export type MpvArg = string | number | boolean | null;

export interface MpvEvent {
  event?: string;
  name?: string;
  data?: unknown;
  id?: number;
  error?: string;
  request_id?: number;
}

/** 发送 mpv JSON IPC 命令，返回响应中的 data 字段 */
export async function mpv<T = unknown>(cmd: MpvArg[]): Promise<T | undefined> {
  const res = await invoke<{ error?: string; data?: T }>('mpv_request', { cmd });
  if (res?.error && res.error !== 'success') throw new Error(res.error);
  return res?.data;
}

export async function getProperty<T>(name: string): Promise<T | undefined> {
  try {
    return await mpv<T>(['get_property', name]);
  } catch {
    return undefined;
  }
}

export function setProperty(name: string, value: unknown) {
  return mpv(['set_property', name as MpvArg, value as MpvArg]);
}

type Listener = (e: MpvEvent) => void;
const subs = new Set<Listener>();
let listening = false;

/** 订阅 mpv 异步事件（property-change / file-loaded 等） */
export function onMpvEvent(cb: Listener): () => void {
  if (!listening) {
    listening = true;
    listen<MpvEvent>('mpv-event', (p) => {
      subs.forEach((f) => f(p.payload));
    });
  }
  subs.add(cb);
  return () => subs.delete(cb);
}

export function onBackendEvent(name: string, cb: (payload: unknown) => void) {
  return listen(name, (p) => cb(p.payload));
}

export function takeScreenshot(): Promise<string> {
  return invoke<string>('take_screenshot');
}

export function setVideoRect(x: number, y: number, w: number, h: number) {
  return invoke('set_video_rect', { x, y, w, h });
}

export function isReady(): Promise<boolean> {
  return invoke<boolean>('is_ready');
}
