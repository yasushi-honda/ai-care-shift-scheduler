/**
 * DemoBanner - デモ環境表示バナー
 *
 * Phase 43: デモ環境改善
 * Phase 43.2: メッセージ変更（保存許可に変更）
 * - デモ環境であることを明示的に表示
 * - サンプル施設で体験中であることを通知
 *
 * デモシフトリセット機能追加:
 * - 表示中の月のシフトをワンクリックでリセット
 * - 何度でもシフト生成デモができる
 */

import React, { useState } from 'react';
import { resetDemoShifts } from '../services/demoResetService';

interface DemoBannerProps {
  className?: string;
  /** 現在表示中の月（YYYY-MM 形式）。指定するとリセットボタンを表示 */
  targetMonth?: string;
  /** リセット完了後に呼び出されるコールバック */
  onResetComplete?: () => void;
}

/**
 * デモ環境バナーコンポーネント
 *
 * 画面上部に固定表示し、デモ環境であることを明示する。
 * targetMonth が渡された場合、その月のシフトをリセットするボタンを表示する。
 */
export function DemoBanner({ className = '', targetMonth, onResetComplete }: DemoBannerProps) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleResetClick = () => {
    setConfirming(true);
  };

  const handleCancel = () => {
    setConfirming(false);
  };

  const handleConfirm = async () => {
    if (!targetMonth) return;
    setLoading(true);
    setConfirming(false);

    const { error } = await resetDemoShifts(targetMonth);

    setLoading(false);

    if (error) {
      // エラーはコンソールに残しつつ、ユーザーにはシンプルに通知
      console.error('[DemoBanner] リセットエラー:', error);
      return;
    }

    onResetComplete?.();
  };

  const monthLabel = targetMonth
    ? targetMonth.replace('-', '年') + '月'
    : '';

  return (
    <div
      className={`
        bg-amber-100 border-b border-amber-300
        px-4 py-2 text-amber-800
        flex items-center justify-between gap-4
        ${className}
      `}
      role="banner"
      aria-label="デモ環境通知"
    >
      {/* 左: ラベル */}
      <div className="flex items-center gap-2">
        <span className="font-medium" aria-hidden="true">🧪 デモ環境</span>
        <span className="text-sm">
          サンプル施設でシステムを体験中です
        </span>
      </div>

      {/* 右: リセットボタン or 確認ダイアログ */}
      {targetMonth && (
        <div className="flex items-center gap-2 shrink-0">
          {confirming ? (
            <>
              <span className="text-sm font-medium">
                {monthLabel}のシフトをリセットしますか？
              </span>
              <button
                onClick={handleConfirm}
                className="
                  px-3 py-1 text-xs font-medium rounded
                  bg-red-500 text-white
                  hover:bg-red-600 active:bg-red-700
                  transition-colors
                "
              >
                リセット
              </button>
              <button
                onClick={handleCancel}
                className="
                  px-3 py-1 text-xs font-medium rounded
                  bg-amber-200 text-amber-800
                  hover:bg-amber-300 active:bg-amber-400
                  transition-colors
                "
              >
                キャンセル
              </button>
            </>
          ) : (
            <button
              onClick={handleResetClick}
              disabled={loading}
              className="
                px-3 py-1 text-xs font-medium rounded
                bg-amber-200 text-amber-800
                hover:bg-amber-300 active:bg-amber-400
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors
              "
              aria-label={`${monthLabel}のシフトをリセット`}
            >
              {loading ? 'リセット中...' : `🔄 ${monthLabel}シフトをリセット`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default DemoBanner;
