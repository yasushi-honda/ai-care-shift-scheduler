/**
 * DemoBanner - デモ環境表示バナー
 *
 * Phase 43: デモ環境改善
 * Phase 43.2: メッセージ変更（保存許可に変更）
 * - デモ環境であることを明示的に表示
 * - サンプル施設で体験中であることを通知
 */

import React from 'react';

interface DemoBannerProps {
  className?: string;
}

/**
 * デモ環境バナーコンポーネント
 *
 * 画面上部に固定表示し、デモ環境であることを明示する
 */
export function DemoBanner({ className = '' }: DemoBannerProps) {
  return (
    <div
      className={`
        bg-amber-100 border-b border-amber-300
        px-4 py-2 text-center text-amber-800
        ${className}
      `}
      role="banner"
      aria-label="デモ環境通知"
    >
      <span className="font-medium" aria-hidden="true">🧪 デモ環境</span>
      <span className="ml-2 text-sm">
        サンプル施設でシステムを体験中です
      </span>
    </div>
  );
}

export default DemoBanner;
