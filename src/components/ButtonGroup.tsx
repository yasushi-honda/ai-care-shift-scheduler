import React from 'react';

interface ButtonGroupProps {
  /** グループ内のボタン要素 */
  children: React.ReactNode;
  /** 左側に視覚的な区切り線を表示 */
  separated?: boolean;
  /** 追加のクラス名 */
  className?: string;
}

/**
 * Phase 42: ボタングループコンポーネント
 *
 * ボタンを視覚的にグループ化し、関連するアクションをまとめる
 * separated=trueで他のグループとの区切り線を表示
 */
export function ButtonGroup({
  children,
  separated = false,
  className = '',
}: ButtonGroupProps) {
  return (
    <div
      role="group"
      className={`
        inline-flex items-center gap-2
        ${separated ? 'pl-4 border-l border-gray-300' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

export default ButtonGroup;
