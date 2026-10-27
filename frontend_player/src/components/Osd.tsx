import { usePlayer } from '../state/PlayerContext';

/** 中央闪现提示 + 缓冲指示 */
export default function Osd() {
  const { osd, buffering, idle } = usePlayer();
  return (
    <>
      {osd && (
        <div className="osd" key={osd.key}>
          <span className="osd-icon">{osd.icon}</span>
          <span className="osd-text">{osd.text}</span>
        </div>
      )}
      {buffering && !idle && (
        <div className="buffering">
          <span className="spinner" />
          缓冲中…
        </div>
      )}
    </>
  );
}
