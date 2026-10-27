/** 秒 -> mm:ss / h:mm:ss */
export function fmtTime(sec: number | null | undefined): string {
  if (sec == null || !isFinite(sec) || sec < 0) return '00:00';
  const s = Math.floor(sec % 60);
  const m = Math.floor((sec / 60) % 60);
  const h = Math.floor(sec / 3600);
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m).padStart(2, '0');
  return (h > 0 ? h + ':' : '') + mm + ':' + String(s).padStart(2, '0');
}

/** 从路径/URL 提取显示名 */
export function mediaName(target: string): string {
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(target)) {
      const u = new URL(target);
      const last = u.pathname.split('/').filter(Boolean).pop();
      return decodeURIComponent(last || u.hostname);
    }
  } catch {
    /* ignore */
  }
  const parts = target.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? target;
}
