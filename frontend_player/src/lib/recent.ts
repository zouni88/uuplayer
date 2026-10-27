export interface RecentItem {
  target: string;
  title: string;
  isUrl: boolean;
  at: number;
}

const KEY = 'iplayer.recent';
const MAX = 50;

export function loadRecent(): RecentItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function pushRecent(targets: string[]): RecentItem[] {
  const old = loadRecent();
  const now = Date.now();
  const items: RecentItem[] = targets.map((t) => ({
    target: t,
    title: t,
    isUrl: /^[a-z][a-z0-9+.-]*:\/\//i.test(t),
    at: now,
  }));
  const merged = [...items, ...old.filter((r) => !items.some((i) => i.target === r.target))].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(merged));
  return merged;
}

export function clearRecent(): RecentItem[] {
  localStorage.removeItem(KEY);
  return [];
}
