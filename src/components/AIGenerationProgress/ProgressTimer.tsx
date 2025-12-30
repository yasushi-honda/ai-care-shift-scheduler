/**
 * 時間表示コンポーネント
 * Phase 45: AIシフト生成進行状況表示機能
 */

interface ProgressTimerProps {
  elapsedSeconds: number;
  estimatedTotalSeconds: number;
}

/**
 * 秒数を mm:ss 形式にフォーマット
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * 予測時間を「約X〜Y分」形式でフォーマット
 * BUG-022対応: 動的に予測時間を表示
 */
function formatEstimatedRange(seconds: number): string {
  const mins = Math.ceil(seconds / 60);
  const minRange = Math.max(1, mins - 1);
  const maxRange = mins + 1;
  return `約${minRange}〜${maxRange}分かかります`;
}

/**
 * 時間表示コンポーネント
 * 経過時間と予測時間を表示する
 */
export function ProgressTimer({ elapsedSeconds, estimatedTotalSeconds }: ProgressTimerProps) {
  const isOverEstimate = elapsedSeconds > estimatedTotalSeconds;
  const remainingSeconds = Math.max(0, estimatedTotalSeconds - elapsedSeconds);
  const progressPercent = Math.min(100, (elapsedSeconds / estimatedTotalSeconds) * 100);
  const isHalfway = progressPercent >= 50;

  return (
    <div className="text-center space-y-2">
      {/* 経過時間 */}
      <div className="flex items-center justify-center space-x-2">
        <span className="text-sm text-gray-500">経過時間:</span>
        <span
          className="text-lg font-mono font-semibold text-indigo-600"
          aria-live="polite"
          aria-atomic="true"
        >
          {formatTime(elapsedSeconds)}
        </span>
      </div>

      {/* 残り時間の目安 */}
      {isOverEstimate ? (
        <p className="text-sm text-amber-600 animate-pulse" role="status">
          もう少しお待ちください...
        </p>
      ) : isHalfway ? (
        <p className="text-sm text-gray-500" role="status">
          残り約 {formatTime(remainingSeconds)}
        </p>
      ) : (
        <p className="text-sm text-gray-500">
          {formatEstimatedRange(estimatedTotalSeconds)}
        </p>
      )}
    </div>
  );
}
