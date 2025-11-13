/**
 * ErrorMessage コンポーネント
 *
 * Phase 19.2.4: UIフィードバックの改善 - エラーメッセージ
 *
 * 特徴:
 * - エラー、警告、情報メッセージの視覚的区別
 * - 解決策の提示機能
 * - アクションボタンのサポート
 * - アクセシビリティ対応
 */

import React from 'react';

/**
 * メッセージのバリエーション
 */
export type MessageVariant = 'error' | 'warning' | 'info' | 'success';

/**
 * アクションボタンの型定義
 */
export interface MessageAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

/**
 * ErrorMessageのプロパティ
 */
export interface ErrorMessageProps {
  /**
   * バリエーション
   * デフォルト: 'error'
   */
  variant?: MessageVariant;

  /**
   * メインメッセージ（タイトル）
   */
  title: string;

  /**
   * 詳細メッセージ（オプション）
   */
  message?: string;

  /**
   * 解決策の提示（オプション）
   */
  solution?: string | string[];

  /**
   * アクションボタン（オプション）
   */
  actions?: MessageAction[];

  /**
   * 追加のCSSクラス
   */
  className?: string;

  /**
   * コンパクト表示（アイコンとメッセージのみ）
   * デフォルト: false
   */
  compact?: boolean;

  /**
   * 閉じるボタンを表示するか
   * デフォルト: false
   */
  dismissible?: boolean;

  /**
   * 閉じるボタンのコールバック
   */
  onDismiss?: () => void;
}

/**
 * ErrorMessage
 *
 * エラーや警告メッセージを視覚的に分かりやすく表示するコンポーネント
 */
export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  variant = 'error',
  title,
  message,
  solution,
  actions,
  className = '',
  compact = false,
  dismissible = false,
  onDismiss,
}) => {
  // バリエーションに応じたスタイル
  const variantStyles = {
    error: {
      container: 'bg-red-50 border-red-200 text-red-800',
      icon: 'text-red-600',
      title: 'text-red-900',
      solution: 'bg-red-100 border-red-300 text-red-900',
    },
    warning: {
      container: 'bg-yellow-50 border-yellow-200 text-yellow-800',
      icon: 'text-yellow-600',
      title: 'text-yellow-900',
      solution: 'bg-yellow-100 border-yellow-300 text-yellow-900',
    },
    info: {
      container: 'bg-blue-50 border-blue-200 text-blue-800',
      icon: 'text-blue-600',
      title: 'text-blue-900',
      solution: 'bg-blue-100 border-blue-300 text-blue-900',
    },
    success: {
      container: 'bg-green-50 border-green-200 text-green-800',
      icon: 'text-green-600',
      title: 'text-green-900',
      solution: 'bg-green-100 border-green-300 text-green-900',
    },
  };

  const styles = variantStyles[variant];

  // アイコンのSVG
  const Icon = () => {
    switch (variant) {
      case 'error':
        return (
          <svg
            className={`w-5 h-5 ${styles.icon}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      case 'warning':
        return (
          <svg
            className={`w-5 h-5 ${styles.icon}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        );
      case 'info':
        return (
          <svg
            className={`w-5 h-5 ${styles.icon}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      case 'success':
        return (
          <svg
            className={`w-5 h-5 ${styles.icon}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
    }
  };

  // 解決策を配列に変換
  const solutionArray = Array.isArray(solution) ? solution : solution ? [solution] : [];

  return (
    <div
      className={`border rounded-lg ${styles.container} ${compact ? 'p-3' : 'p-4'} ${className}`}
      role={variant === 'error' ? 'alert' : 'status'}
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
    >
      <div className="flex">
        {/* アイコン */}
        <div className="flex-shrink-0">
          <Icon />
        </div>

        {/* コンテンツ */}
        <div className="ml-3 flex-1">
          {/* タイトル */}
          <h3 className={`text-sm font-medium ${styles.title}`}>{title}</h3>

          {!compact && (
            <>
              {/* 詳細メッセージ */}
              {message && <div className="mt-2 text-sm">{message}</div>}

              {/* 解決策 */}
              {solutionArray.length > 0 && (
                <div
                  className={`mt-3 p-3 border rounded ${styles.solution} text-sm`}
                >
                  <div className="font-medium mb-1">💡 解決策:</div>
                  <ul className="list-disc list-inside space-y-1">
                    {solutionArray.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* アクションボタン */}
              {actions && actions.length > 0 && (
                <div className="mt-4 flex gap-3">
                  {actions.map((action, idx) => (
                    <button
                      key={idx}
                      onClick={action.onClick}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        action.variant === 'primary'
                          ? `${
                              variant === 'error'
                                ? 'bg-red-600 hover:bg-red-700'
                                : variant === 'warning'
                                ? 'bg-yellow-600 hover:bg-yellow-700'
                                : variant === 'info'
                                ? 'bg-blue-600 hover:bg-blue-700'
                                : 'bg-green-600 hover:bg-green-700'
                            } text-white`
                          : `bg-white border ${
                              variant === 'error'
                                ? 'border-red-300 text-red-700 hover:bg-red-50'
                                : variant === 'warning'
                                ? 'border-yellow-300 text-yellow-700 hover:bg-yellow-50'
                                : variant === 'info'
                                ? 'border-blue-300 text-blue-700 hover:bg-blue-50'
                                : 'border-green-300 text-green-700 hover:bg-green-50'
                            }`
                      }`}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* 閉じるボタン */}
        {dismissible && onDismiss && (
          <div className="ml-auto pl-3 flex-shrink-0">
            <button
              onClick={onDismiss}
              className="inline-flex text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 rounded"
              aria-label="閉じる"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ErrorMessage;
