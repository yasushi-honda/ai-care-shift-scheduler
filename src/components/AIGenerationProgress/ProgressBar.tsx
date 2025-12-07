/**
 * プログレスバーコンポーネント
 * Phase 45: AIシフト生成進行状況表示機能
 */

interface ProgressBarProps {
  elapsedSeconds: number;
  estimatedTotalSeconds: number;
}

/**
 * プログレスバーコンポーネント
 * 経過時間に基づいてプログレスバーの進捗を表示する
 */
export function ProgressBar({ elapsedSeconds, estimatedTotalSeconds }: ProgressBarProps) {
  // 進捗率を計算（最大100%）
  const progressPercent = Math.min(100, (elapsedSeconds / estimatedTotalSeconds) * 100);

  return (
    <div className="w-full">
      <div
        className="h-2 bg-gray-200 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={Math.round(progressPercent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="AI生成処理の進捗"
      >
        <div
          className="h-full bg-indigo-600 rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
          style={{ width: `${progressPercent}%` }}
        >
          {/* アニメーションストライプ */}
          <div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"
            aria-hidden="true"
          />
        </div>
      </div>

      {/* 進捗率表示 */}
      <div className="mt-1 text-xs text-gray-500 text-right">
        {Math.round(progressPercent)}%
      </div>
    </div>
  );
}
