import { useState } from 'react';
import { usePlayer } from '../state/PlayerContext';
import { mediaName } from '../lib/format';
import { clearRecent } from '../lib/recent';

/** 右侧抽屉：播放列表 / 最近文件 */
export default function PlaylistDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const p = usePlayer();
  const [tab, setTab] = useState<'list' | 'recent'>('list');
  if (!open) return null;

  return (
    <aside className="drawer" onDoubleClick={(e) => e.stopPropagation()}>
      <div className="drawer-tabs">
        <button className={tab === 'list' ? 'on' : ''} onClick={() => setTab('list')}>
          播放列表 ({p.playlist.length})
        </button>
        <button className={tab === 'recent' ? 'on' : ''} onClick={() => { setTab('recent'); p.refreshRecent(); }}>
          最近文件
        </button>
        <button className="drawer-close" onClick={onClose} title="关闭">
          ×
        </button>
      </div>

      <div className="drawer-body">
        {tab === 'list' ? (
          p.playlist.length === 0 ? (
            <div className="drawer-empty">播放列表为空</div>
          ) : (
            p.playlist.map((it, i) => (
              <div key={it.id} className={'item' + (i === p.playlistPos ? ' cur' : '')} onClick={() => p.jumpTo(i)}>
                <span className="idx">{i === p.playlistPos ? '▶' : i + 1}</span>
                <span className="name" title={it.filename}>
                  {it.title || mediaName(it.filename)}
                </span>
                <button
                  className="del"
                  title="移除"
                  onClick={(e) => {
                    e.stopPropagation();
                    p.removeAt(i);
                  }}
                >
                  ×
                </button>
              </div>
            ))
          )
        ) : (
          <>
            {p.recent.length > 0 && (
              <button
                className="clear"
                onClick={() => {
                  clearRecent();
                  p.refreshRecent();
                }}
              >
                清空记录
              </button>
            )}
            {p.recent.length === 0 ? (
              <div className="drawer-empty">暂无播放记录</div>
            ) : (
              p.recent.map((t) => (
                <div key={t} className="item" onClick={() => p.openMedia([t], true)}>
                  <span className="idx">{/^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? '🌐' : '📄'}</span>
                  <span className="name" title={t}>
                    {mediaName(t)}
                  </span>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </aside>
  );
}
