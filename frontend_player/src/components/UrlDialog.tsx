import { useState } from 'react';

interface Props {
  onClose: () => void;
  onSubmit: (urls: string[]) => void;
}

/** 打开网络地址弹窗（支持多行批量） */
export default function UrlDialog({ onClose, onSubmit }: Props) {
  const [text, setText] = useState('');
  const submit = () => {
    const list = text
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (list.length) {
      onSubmit(list);
      onClose();
    }
  };
  return (
    <div className="modal-mask" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
        <h3>打开网络地址</h3>
        <textarea
          autoFocus
          rows={4}
          placeholder={'https://… 或 .m3u8 / rtmp:// 地址\n可多行粘贴批量播放'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit();
            if (e.key === 'Escape') onClose();
          }}
        />
        <div className="modal-btns">
          <button className="btn-ghost" onClick={onClose}>
            取消
          </button>
          <button className="btn-neon" onClick={submit}>
            播放
          </button>
        </div>
      </div>
    </div>
  );
}
