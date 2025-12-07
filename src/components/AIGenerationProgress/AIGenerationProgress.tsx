/**
 * AI生成プログレス表示メインコンポーネント
 * Phase 45: AIシフト生成進行状況表示機能
 */

import { useState, useCallback } from 'react';
import type { GenerationProgressState, StepDefinition } from './types';
import { GENERATION_STEPS } from './types';
import { ProgressSteps } from './ProgressSteps';
import { ProgressTimer } from './ProgressTimer';
import { ProgressBar } from './ProgressBar';

interface AIGenerationProgressProps {
  state: GenerationProgressState;
  onCancel?: () => void;
}

/**
 * キャンセル確認モーダル
 */
function CancelConfirmModal({
  isOpen,
  onConfirm,
  onClose,
}: {
  isOpen: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-modal-title"
    >
      <div className="bg-white rounded-lg p-6 max-w-sm mx-4 shadow-xl">
        <h3 id="cancel-modal-title" className="text-lg font-semibold text-gray-900 mb-2">
          AI生成をキャンセルしますか？
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          処理を中断すると、途中までの結果は破棄されます。
        </p>
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
          >
            続ける
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 完了メッセージ
 */
function CompletedMessage() {
  return (
    <div className="text-center py-4">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-3">
        <svg
          className="w-6 h-6 text-green-600"
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
      <p className="text-lg font-medium text-green-600">
        シフト生成が完了しました！
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
 * ステップ表示、時間表示、プログレスバー、キャンセルボタンを統合
 */
export function AIGenerationProgress({ state, onCancel }: AIGenerationProgressProps) {
  const [showCancelModal, setShowCancelModal] = useState(false);

  const handleCancelClick = useCallback(() => {
    setShowCancelModal(true);
  }, []);

  const handleCancelConfirm = useCallback(() => {
    setShowCancelModal(false);
    onCancel?.();
  }, [onCancel]);

  const handleCancelClose = useCallback(() => {
    setShowCancelModal(false);
  }, []);

  const { status, currentStep, elapsedSeconds, estimatedTotalSeconds, errorMessage } = state;

  // idle状態では何も表示しない
  if (status === 'idle') {
    return null;
  }

  // 完了状態
  if (status === 'completed') {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto">
        <CompletedMessage />
      </div>
    );
  }

  // エラー状態
  if (status === 'error') {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto">
        <ErrorMessage message={errorMessage} />
      </div>
    );
  }

  // キャンセル状態
  if (status === 'cancelled') {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto">
        <CancelledMessage />
      </div>
    );
  }

  // 生成中状態
  return (
    <>
      <div
        className="bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto"
        role="region"
        aria-label="AI生成進行状況"
        aria-live="polite"
      >
        {/* ヘッダー */}
        <div className="text-center mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            AIがシフトを生成中...
          </h2>
          <p className="text-sm text-gray-500">
            しばらくお待ちください
          </p>
        </div>

        {/* プログレスバー */}
        <div className="mb-6">
          <ProgressBar
            elapsedSeconds={elapsedSeconds}
            estimatedTotalSeconds={estimatedTotalSeconds}
          />
        </div>

        {/* 時間表示 */}
        <div className="mb-6">
          <ProgressTimer
            elapsedSeconds={elapsedSeconds}
            estimatedTotalSeconds={estimatedTotalSeconds}
          />
        </div>

        {/* ステップ表示 */}
        <div className="mb-6">
          <ProgressSteps
            currentStep={currentStep}
            steps={GENERATION_STEPS}
            isCompleted={false}
          />
        </div>

        {/* キャンセルボタン */}
        {onCancel && (
          <div className="text-center pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleCancelClick}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
              aria-label="AI生成をキャンセル"
            >
              キャンセル
            </button>
          </div>
        )}
      </div>

      {/* キャンセル確認モーダル */}
      <CancelConfirmModal
        isOpen={showCancelModal}
        onConfirm={handleCancelConfirm}
        onClose={handleCancelClose}
      />
    </>
  );
}
