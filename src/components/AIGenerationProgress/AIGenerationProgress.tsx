/**
 * AI生成プログレス表示メインコンポーネント
 * Phase 45: AIシフト生成進行状況表示機能
 * Phase 60: Solver時代のUI刷新（プログレス→結果サマリー）
 *
 * Solver（CP-SAT）は数秒で完了するため:
 * - 生成中: シンプルなスピナー表示
 * - 完了時: 結果サマリーカード（スコア、充足率、違反数、処理時間）
 */

import type { GenerationProgressState, GenerationResult } from './types';

interface AIGenerationProgressProps {
  state: GenerationProgressState;
  onCancel?: () => void;
  onClose?: () => void;
}

/**
 * スコアに応じた色を返す
 */
function getScoreColor(score: number): string {
  if (score >= 90) return 'text-green-600';
  if (score >= 70) return 'text-yellow-600';
  return 'text-red-600';
}

function getScoreBgColor(score: number): string {
  if (score >= 90) return 'bg-green-50 border-green-200';
  if (score >= 70) return 'bg-yellow-50 border-yellow-200';
  return 'bg-red-50 border-red-200';
}

/**
 * 結果サマリーカード
 */
function ResultSummary({ result }: { result: GenerationResult }) {
  return (
    <div className="text-center">
      {/* チェックマーク */}
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 mb-4">
        <svg
          className="w-7 h-7 text-green-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>

      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        シフト生成が完了しました
      </h3>

      {/* スコア */}
      <div className={`inline-flex items-baseline gap-1 px-4 py-2 rounded-lg border mb-4 ${getScoreBgColor(result.overallScore)}`}>
        <span className={`text-3xl font-bold ${getScoreColor(result.overallScore)}`}>
          {result.overallScore}
        </span>
        <span className="text-sm text-gray-500">/100</span>
      </div>

      {/* 詳細指標 */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">充足率</div>
          <div className="text-lg font-semibold text-gray-900">{result.fulfillmentRate}%</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">違反</div>
          <div className={`text-lg font-semibold ${result.violationCount === 0 ? 'text-green-600' : 'text-red-600'}`}>
            {result.violationCount}件
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">処理時間</div>
          <div className="text-lg font-semibold text-gray-900">{result.elapsedSeconds}秒</div>
        </div>
      </div>

      {/* 推奨事項 */}
      {result.recommendationCount > 0 && (
        <p className="text-xs text-gray-500">
          {result.recommendationCount}件の改善提案があります（シフト表で確認できます）
        </p>
      )}
    </div>
  );
}

/**
 * 生成中スピナー
 */
function GeneratingSpinner() {
  return (
    <div className="text-center py-2">
      <div className="inline-flex items-center justify-center w-14 h-14 mb-4">
        <svg
          className="animate-spin w-10 h-10 text-indigo-600"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">
        最適化計算中...
      </h3>
      <p className="text-sm text-gray-500">
        制約条件を満たす最適なシフトを計算しています
      </p>
    </div>
  );
}

/**
 * エラーメッセージ
 */
function ErrorMessage({ message }: { message?: string }) {
  return (
    <div className="text-center py-4">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-3">
        <svg
          className="w-6 h-6 text-red-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </div>
      <p className="text-lg font-medium text-red-600 mb-1">
        エラーが発生しました
      </p>
      {message && (
        <p className="text-sm text-gray-600">{message}</p>
      )}
    </div>
  );
}

/**
 * キャンセルメッセージ
 */
function CancelledMessage() {
  return (
    <div className="text-center py-4">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-3">
        <svg
          className="w-6 h-6 text-gray-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </div>
      <p className="text-lg font-medium text-gray-600">
        処理がキャンセルされました
      </p>
    </div>
  );
}

/**
 * AI生成プログレス表示メインコンポーネント
 */
export function AIGenerationProgress({ state, onCancel, onClose }: AIGenerationProgressProps) {
  const { status, errorMessage, result } = state;

  if (status === 'idle') {
    return null;
  }

  // 完了状態: 結果サマリー表示
  if (status === 'completed' && result) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm mx-auto">
        <ResultSummary result={result} />
        {onClose && (
          <div className="text-center mt-4 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
            >
              確認
            </button>
          </div>
        )}
      </div>
    );
  }

  // エラー状態
  if (status === 'error') {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm mx-auto">
        <ErrorMessage message={errorMessage} />
        {onClose && (
          <div className="text-center mt-4 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
            >
              閉じる
            </button>
          </div>
        )}
      </div>
    );
  }

  // キャンセル状態
  if (status === 'cancelled') {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm mx-auto">
        <CancelledMessage />
        {onClose && (
          <div className="text-center mt-4 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
            >
              閉じる
            </button>
          </div>
        )}
      </div>
    );
  }

  // 生成中状態: シンプルなスピナー
  return (
    <div
      className="bg-white rounded-lg shadow-lg p-6 max-w-sm mx-auto"
      role="region"
      aria-label="シフト生成中"
      aria-live="polite"
    >
      <GeneratingSpinner />

      {onCancel && (
        <div className="text-center pt-4 border-t border-gray-200 mt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
            aria-label="生成をキャンセル"
          >
            キャンセル
          </button>
        </div>
      )}
    </div>
  );
}
