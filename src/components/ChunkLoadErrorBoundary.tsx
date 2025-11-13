/**
 * ChunkLoadErrorBoundary コンポーネント
 *
 * Phase 19.1.4: Code Splitting時のチャンク読み込みエラーをハンドリング
 *
 * 特徴:
 * - ネットワークエラーやチャンク読み込み失敗をキャッチ
 * - ユーザーフレンドリーなエラーメッセージ表示
 * - リロードボタンでリカバリー可能
 */

import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ChunkLoadErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): State {
    // エラーが発生したらstateを更新
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // チャンク読み込みエラーの検出
    const isChunkLoadError =
      error.message.includes('Failed to fetch') ||
      error.message.includes('Loading chunk') ||
      error.message.includes('dynamically imported module');

    if (isChunkLoadError) {
      console.error('Chunk loading error:', error, errorInfo);
      // TODO: エラートラッキングサービスにログ送信
      // Example: Sentry.captureException(error);
    } else {
      console.error('React Error Boundary caught:', error, errorInfo);
    }
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      const { error } = this.state;
      const isChunkLoadError =
        error?.message.includes('Failed to fetch') ||
        error?.message.includes('Loading chunk') ||
        error?.message.includes('dynamically imported module');

      return (
        <div className="flex items-center justify-center min-h-screen bg-slate-100">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
            {/* エラーアイコン */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-red-600"
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
              </div>
            </div>

            {/* エラーメッセージ */}
            <h2 className="text-2xl font-bold text-slate-900 mb-3">
              {isChunkLoadError ? 'ページの読み込みに失敗しました' : 'エラーが発生しました'}
            </h2>

            <p className="text-slate-600 mb-6">
              {isChunkLoadError
                ? 'ネットワークの問題、またはアプリケーションの更新により、ページの読み込みに失敗しました。ページをリロードしてください。'
                : '予期しないエラーが発生しました。ページをリロードして再試行してください。'}
            </p>

            {/* リロードボタン */}
            <button
              onClick={this.handleReload}
              className="w-full bg-care-secondary hover:bg-care-dark text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              ページをリロード
            </button>

            {/* 技術的な詳細（開発環境のみ） */}
            {process.env.NODE_ENV === 'development' && error && (
              <details className="mt-6 text-left">
                <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-700">
                  技術的な詳細を表示
                </summary>
                <pre className="mt-3 p-4 bg-slate-100 rounded text-xs text-red-600 overflow-auto">
                  {error.toString()}
                  {'\n\n'}
                  {error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    // @ts-expect-error - React 19 type compatibility issue
    return this.props.children;
  }
}

export default ChunkLoadErrorBoundary;
