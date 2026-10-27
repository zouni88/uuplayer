import { usePlayer } from '../state/PlayerContext';

interface Props {
  onOpenFiles: () => void;
  onOpenUrl: () => void;
}

/** 空闲时的拖拽引导页 */
export default function EmptyState({ onOpenFiles, onOpenUrl }: Props) {
  const { idle, ready } = usePlayer();
  if (!ready || !idle) return null;
  return (
    <div className="empty">
      <div className="empty-inner">
        <img className="empty-icon" src="/logo.png" alt="iPlayer" draggable={false} />
        <div className="empty-logo">
          i<span>Player</span>
        </div>
        <p>将视频文件或文件夹拖到窗口即可播放</p>
        <div className="empty-btns">
          <button className="btn-neon" onClick={onOpenFiles} onDoubleClick={(e) => e.stopPropagation()}>
            打开文件
          </button>
          <button className="btn-ghost" onClick={onOpenUrl} onDoubleClick={(e) => e.stopPropagation()}>
            打开网址
          </button>
        </div>
        <p className="empty-hint">MP4 · MKV · FLV · RMVB · AVI · HLS · 网络流 · 全格式本地解码</p>
      </div>
    </div>
  );
}
