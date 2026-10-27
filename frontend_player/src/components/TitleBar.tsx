import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { usePlayer } from '../state/PlayerContext';
import { IconClose, IconMaximize, IconMinimize, IconRestore } from './Icons';

/** 无边框窗口标题栏：拖拽区 + 窗口按钮 */
export default function TitleBar({ hidden }: { hidden: boolean }) {
  const win = getCurrentWindow();
  const { title, playlist, playlistPos } = usePlayer();
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const check = () => win.isMaximized().then(setMaximized).catch(() => {});
    check();
    const un = win.onResized(check);
    return () => {
      un.then((f) => f());
    };
  }, [win]);

  const current = playlist[playlistPos];
  const label = title || current?.title || current?.filename || 'iPlayer';

  return (
    <div className={'titlebar' + (hidden ? ' ui-hide' : '')} data-tauri-drag-region>
      <div className="tb-title" data-tauri-drag-region title={label}>
        {label}
      </div>
      <div className="tb-btns">
        <button onClick={() => win.minimize()} title="最小化">
          <IconMinimize size={16} />
        </button>
        <button onClick={() => win.toggleMaximize()} title="最大化">
          {maximized ? <IconRestore size={15} /> : <IconMaximize size={15} />}
        </button>
        <button className="tb-close" onClick={() => win.close()} title="关闭">
          <IconClose size={16} />
        </button>
      </div>
    </div>
  );
}
