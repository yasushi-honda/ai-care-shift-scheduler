import React from 'react';

interface TooltipProps {
  /** ツールチップに表示するテキスト */
  content: string;
  /** ツールチップを表示する対象要素 */
  children: React.ReactNode;
  /** ツールチップの表示位置 */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** 追加のクラス名 */
  className?: string;
}

/**
 * Phase 42: 軽量なCSS-onlyツールチップコンポーネント
 *
 * アクセシビリティとデザインの一貫性を保証
 * ホバー時にツールチップを表示
 */
export function Tooltip({
  content,
  children,
  position = 'bottom',
  className = '',
}: TooltipProps) {
  const positionStyles = {
    top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
    bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
    left: 'right-full mr-2 top-1/2 -translate-y-1/2',
    right: 'left-full ml-2 top-1/2 -translate-y-1/2',
  };

  return (
    <div className={`relative inline-flex group ${className}`}>
      {children}
      <div
        role="tooltip"
        className={`
          absolute z-50 px-2 py-1 text-xs font-medium text-white bg-gray-800 rounded shadow-lg
          opacity-0 group-hover:opacity-100 transition-opacity duration-200
          pointer-events-none whitespace-nowrap
          ${positionStyles[position]}
        `}
      >
        {content}
        {/* ツールチップの矢印 */}
        <div
          className={`
            absolute w-2 h-2 bg-gray-800 transform rotate-45
            ${position === 'bottom' ? '-top-1 left-1/2 -translate-x-1/2' : ''}
            ${position === 'top' ? '-bottom-1 left-1/2 -translate-x-1/2' : ''}
            ${position === 'left' ? '-right-1 top-1/2 -translate-y-1/2' : ''}
            ${position === 'right' ? '-left-1 top-1/2 -translate-y-1/2' : ''}
          `}
        />
      </div>
    </div>
  );
}

export default Tooltip;
