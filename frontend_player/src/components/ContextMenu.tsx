import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePlayer } from '../state/PlayerContext';
import { mpv, setProperty } from '../lib/mpv';

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3];
const ASPECTS: { label: string; val: string | null }[] = [
  { label: '自动', val: null },
  { label: '16:9', val: '16:9' },
  { label: '4:3', val: '4:3' },
  { label: '2.35:1', val: '2.35:1' },
];

interface Props {
  x: number;
  y: number;
  pinned: boolean;
  onClose: () => void;
  onOpenFiles: () => void;
  onOpenFolder: () => void;
  onOpenUrl: () => void;
  onScreenshot: () => void;
  onTogglePin: () => void;
}

/** 右键菜单：打开/截图/置顶/倍速/画面比例/音轨/字幕 */
export default function ContextMenu({ x, y, pinned, onClose, onOpenFiles, onOpenFolder, onOpenUrl, onScreenshot, onTogglePin }: Props) {
  const p = usePlayer();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  // 防止菜单超出窗口
  useLayoutEffect(() => {
    const r = ref.current!.getBoundingClientRect();
    setPos({
      x: Math.max(4, Math.min(x, window.innerWidth - r.width - 4)),
      y: Math.max(4, Math.min(y, window.innerHeight - r.height - 4)),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener('mousedown', down, true);
    return () => window.removeEventListener('mousedown', down, true);
  }, [onClose]);

  const Item = ({ label, onClick, on = false }: { label: string; onClick: () => void; on?: boolean }) => (
    <button
      className={'cm-item' + (on ? ' on' : '')}
      onClick={() => {
        onClick();
        onClose();
      }}
    >
      {label}
    </button>
  );

  const audio = p.tracks.filter((t) => t.type === 'audio');
  const subs = p.tracks.filter((t) => t.type === 'sub');

  return (
    <div
      className="ctxmenu"
      ref={ref}
      style={{ left: pos.x, top: pos.y }}
      onContextMenu={(e) => e.preventDefault()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <Item label="打开文件…" onClick={onOpenFiles} />
      <Item label="打开文件夹…" onClick={onOpenFolder} />
      <Item label="打开网址…" onClick={onOpenUrl} />
      <div className="cm-sep" />
      <Item label="截图保存" onClick={onScreenshot} />
      <Item label="窗口置顶" on={pinned} onClick={onTogglePin} />
      <div className="cm-sep" />

      <div className="cm-label">倍速</div>
      <div className="cm-chips">
        {SPEEDS.map((s) => (
          <button
            key={s}
            className={s === p.speed ? 'on' : ''}
            onClick={() => {
              p.setSpeed(s);
              onClose();
            }}
          >
            {s}x
          </button>
        ))}
      </div>

      <div className="cm-label">画面比例</div>
      <div className="cm-chips">
        {ASPECTS.map((a) => (
          <button
            key={a.label}
            onClick={() => {
              mpv(['set_property', 'aspect', a.val]).catch(() => {});
              onClose();
            }}
          >
            {a.label}
          </button>
        ))}
      </div>

      {audio.length > 1 && (
        <>
          <div className="cm-sep" />
          <div className="cm-label">音轨</div>
          {audio.map((t, i) => (
            <Item
              key={t.id}
              label={t.title || t.lang || `音轨 ${i + 1}${t.codec ? ' · ' + t.codec : ''}`}
              on={t.selected}
              onClick={() => setProperty('aid', t.id)}
            />
          ))}
        </>
      )}

      {subs.length > 0 && (
        <>
          <div className="cm-sep" />
          <div className="cm-label">字幕</div>
          <Item
            label="关闭字幕"
            onClick={() => mpv(['set_property', 'sid', 'no']).catch(() => {})}
          />
          {subs.map((t, i) => (
            <Item
              key={t.id}
              label={t.title || t.lang || `字幕 ${i + 1}`}
              on={t.selected}
              onClick={() => setProperty('sid', t.id)}
            />
          ))}
        </>
      )}
    </div>
  );
}
