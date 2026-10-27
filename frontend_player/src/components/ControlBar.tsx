import { useRef, useState } from 'react';
import { usePlayer } from '../state/PlayerContext';
import { fmtTime } from '../lib/format';
import {
  IconCompress,
  IconExpand,
  IconList,
  IconMute,
  IconNext,
  IconPause,
  IconPlay,
  IconPrev,
  IconVolume,
} from './Icons';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

interface Props {
  hidden: boolean;
  fullscreen: boolean;
  playlistOpen: boolean;
  onTogglePlaylist: () => void;
  onToggleFullscreen: () => void;
}

/** 底部控制条：进度条 + 播放按钮 + 倍速 + 音量 + 列表 + 全屏 */
export default function ControlBar({
  hidden,
  fullscreen,
  playlistOpen,
  onTogglePlaylist,
  onToggleFullscreen,
}: Props) {
  const p = usePlayer();
  const barRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [hover, setHover] = useState<number | null>(null);
  const [speedOpen, setSpeedOpen] = useState(false);

  const pct = p.duration > 0 ? Math.min(1, Math.max(0, p.time / p.duration)) : 0;

  const ratio = (e: React.PointerEvent) => {
    const r = barRef.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  };

  return (
    <div className={'controlbar' + (hidden ? ' ui-hide' : '')} onDoubleClick={(e) => e.stopPropagation()}>
      {/* 进度条 */}
      <div
        className="progress"
        ref={barRef}
        onPointerDown={(e) => {
          dragging.current = true;
          (e.currentTarget as Element).setPointerCapture(e.pointerId);
          if (p.duration > 0) p.seekTo(ratio(e) * p.duration);
        }}
        onPointerMove={(e) => {
          const r = ratio(e);
          setHover(r);
          if (dragging.current && p.duration > 0) p.seekTo(r * p.duration);
        }}
        onPointerUp={(e) => {
          dragging.current = false;
          (e.currentTarget as Element).releasePointerCapture(e.pointerId);
        }}
        onPointerLeave={() => setHover(null)}
      >
        <div className="track">
          <div className="fill" style={{ width: `${(hover ?? pct) * 100}%` }} />
          <div className="knob" style={{ left: `${pct * 100}%` }} />
        </div>
        {hover != null && p.duration > 0 && (
          <div className="tip" style={{ left: `${hover * 100}%` }}>
            {fmtTime(hover * p.duration)}
          </div>
        )}
      </div>

      {/* 按钮行 */}
      <div className="row">
        <button onClick={p.prev} title="上一个 (PgUp)">
          <IconPrev />
        </button>
        <button className="play" onClick={p.togglePlay} title="播放/暂停 (Space)">
          {p.paused ? <IconPlay size={24} /> : <IconPause size={24} />}
        </button>
        <button onClick={p.next} title="下一个 (PgDn)">
          <IconNext />
        </button>
        <span className="time">
          {fmtTime(p.time)} / {fmtTime(p.duration)}
        </span>

        <div className="spacer" />

        <div className="speed-wrap" onMouseLeave={() => setSpeedOpen(false)}>
          <button onClick={() => setSpeedOpen((v) => !v)} title="倍速 ([ / ])" className={p.speed !== 1 ? 'on' : ''}>
            {p.speed === 1 ? '倍速' : `${p.speed}x`}
          </button>
          {speedOpen && (
            <div className="popover">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  className={s === p.speed ? 'on' : ''}
                  onClick={() => {
                    p.setSpeed(s);
                    setSpeedOpen(false);
                  }}
                >
                  {s}x
                </button>
              ))}
            </div>
          )}
        </div>

        <button onClick={p.toggleMute} title="静音 (M)">
          {p.muted || p.volume === 0 ? <IconMute /> : <IconVolume />}
        </button>
        <input
          className="vol"
          type="range"
          min={0}
          max={130}
          value={p.muted ? 0 : p.volume}
          onChange={(e) => p.setVolume(+e.target.value)}
          title="音量 (↑↓ / 滚轮)"
        />

        <button className={playlistOpen ? 'on' : ''} onClick={onTogglePlaylist} title="播放列表 (Ctrl+L)">
          <IconList />
        </button>
        <button onClick={onToggleFullscreen} title="全屏 (F / 双击)">
          {fullscreen ? <IconCompress /> : <IconExpand />}
        </button>
      </div>
    </div>
  );
}
