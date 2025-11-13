/**
 * LoadingFallback コンポーネント
 *
 * Phase 19.1.4: Code Splitting時のローディング表示コンポーネント
 *
 * 特徴:
 * - React.Suspenseのfallbackとして使用
 * - シンプルなスピナーとメッセージ表示
 * - 統一されたローディングUI
 */

import React from 'react';

export interface LoadingFallbackProps {
  /**
   * ローディングメッセージ
   * デフォルト: '読み込み中...'
   */
  message?: string;

  /**
   * フルスクリーン表示するか
   * デフォルト: true
   */
  fullScreen?: boolean;

  /**
   * スピナーのサイズ
   * デフォルト: 'medium'
   */
  size?: 'small' | 'medium' | 'large';
}

export const LoadingFallback: React.FC<LoadingFallbackProps> = ({
  message = '読み込み中...',
  fullScreen = true,
  size = 'medium',
}) => {
  // サイズに応じたスタイル
  const sizeClasses = {
    small: 'h-6 w-6',
    medium: 'h-8 w-8',
    large: 'h-12 w-12',
  };

  const textSizeClasses = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-base',
  };

  // コンテナスタイル
  const containerClasses = fullScreen
    ? 'flex items-center justify-center min-h-screen bg-slate-100'
    : 'flex items-center justify-center p-8';

  return (
    <div className={containerClasses}>
      <div className="text-center">
        {/* スピナー */}
        <div className="flex justify-center mb-4">
          <div
            className={`inline-block animate-spin rounded-full border-b-2 border-care-secondary ${sizeClasses[size]}`}
            role="status"
            aria-label={message}
          >
            <span className="sr-only">{message}</span>
          </div>
        </div>

        {/* メッセージ */}
        <p className={`text-slate-600 ${textSizeClasses[size]}`}>{message}</p>
      </div>
    </div>
  );
};

/**
 * ページ読み込み用のFallback
 */
export const PageLoadingFallback: React.FC = () => (
  <LoadingFallback message="ページを読み込み中..." fullScreen={true} size="medium" />
);

/**
 * コンポーネント読み込み用のFallback
 */
export const ComponentLoadingFallback: React.FC = () => (
  <LoadingFallback message="読み込み中..." fullScreen={false} size="small" />
);

export default LoadingFallback;
