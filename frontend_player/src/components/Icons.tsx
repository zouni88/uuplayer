import React from 'react';

interface P {
  size?: number;
  className?: string;
}

/** 统一 24x24 线性图标 */
function S({ size = 20, className, children }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

export const IconPlay = (p: P) => (
  <S {...p}>
    <path d="M7 4.5 19 12 7 19.5Z" fill="currentColor" stroke="none" />
  </S>
);

export const IconPause = (p: P) => (
  <S {...p}>
    <path d="M7 4h3.4v16H7zM13.6 4H17v16h-3.4z" fill="currentColor" stroke="none" />
  </S>
);

export const IconPrev = (p: P) => (
  <S {...p}>
    <path d="M6 4v16" />
    <path d="M19 5 8.5 12 19 19Z" fill="currentColor" stroke="none" />
  </S>
);

export const IconNext = (p: P) => (
  <S {...p}>
    <path d="M18 4v16" />
    <path d="M5 5 15.5 12 5 19Z" fill="currentColor" stroke="none" />
  </S>
);

export const IconVolume = (p: P) => (
  <S {...p}>
    <path d="M4 9v6h4l5 4V5L8 9Z" />
    <path d="M16.5 8.5a5 5 0 0 1 0 7" />
    <path d="M19 6a8.5 8.5 0 0 1 0 12" />
  </S>
);

export const IconMute = (p: P) => (
  <S {...p}>
    <path d="M4 9v6h4l5 4V5L8 9Z" />
    <path d="m16.5 9.5 5 5m0-5-5 5" />
  </S>
);

export const IconExpand = (p: P) => (
  <S {...p}>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </S>
);

export const IconCompress = (p: P) => (
  <S {...p}>
    <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
  </S>
);

export const IconList = (p: P) => (
  <S {...p}>
    <path d="M4 6h12M4 12h12M4 18h8" />
    <path d="m17 15 4 3-4 3Z" fill="currentColor" stroke="none" />
  </S>
);

export const IconMinimize = (p: P) => (
  <S {...p}>
    <path d="M5 12h14" />
  </S>
);

export const IconMaximize = (p: P) => (
  <S {...p}>
    <rect x="5" y="5" width="14" height="14" rx="2" />
  </S>
);

export const IconRestore = (p: P) => (
  <S {...p}>
    <rect x="4" y="8" width="12" height="12" rx="2" />
    <path d="M8 8V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2" />
  </S>
);

export const IconClose = (p: P) => (
  <S {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </S>
);
