import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { handleError, getErrorMessage } from '../utils/errorHandler';

/**
 * トーストメッセージの型定義
 */
export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number; // ミリ秒（デフォルト: 3000）
}

/**
 * ToastContextの型定義
 */
interface ToastContextType {
  showSuccess: (message: string, duration?: number) => void;
  showError: (message: string, duration?: number) => void;
  showErrorWithHandler: (error: unknown, context?: string, duration?: number) => void;
  showInfo: (message: string, duration?: number) => void;
  showWarning: (message: string, duration?: number) => void;
  dismissToast: (id: string) => void;
  toasts: Toast[];
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

/**
 * ToastProvider
 *
 * アプリ全体でトースト通知を管理するプロバイダー
 * 複数のトーストを同時に表示可能（最大3件まで）
 */
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  /**
   * トーストIDを生成
   */
  const generateId = (): string => {
    return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  /**
   * トーストを追加
   */
  const addToast = useCallback(
    (message: string, type: Toast['type'], duration: number = 3000) => {
      const id = generateId();
      const newToast: Toast = { id, message, type, duration };

      setToasts((prev) => {
        // 最大3件まで表示（古いものから削除）
        const updated = [...prev, newToast];
        return updated.slice(-3);
      });

      // 自動非表示タイマー
      if (duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((toast) => toast.id !== id));
        }, duration);
      }
    },
    []
  );

  /**
   * 成功メッセージを表示
   */
  const showSuccess = useCallback(
    (message: string, duration?: number) => {
      addToast(message, 'success', duration);
    },
    [addToast]
  );

  /**
   * エラーメッセージを表示
   */
  const showError = useCallback(
    (message: string, duration?: number) => {
      addToast(message, 'error', duration);
    },
    [addToast]
  );

  /**
   * エラーオブジェクトからメッセージを生成して表示
   */
  const showErrorWithHandler = useCallback(
    (error: unknown, context?: string, duration?: number) => {
      const message = getErrorMessage(error, context);
      addToast(message, 'error', duration);
    },
    [addToast]
  );

  /**
   * 情報メッセージを表示
   */
  const showInfo = useCallback(
    (message: string, duration?: number) => {
      addToast(message, 'info', duration);
    },
    [addToast]
  );

  /**
   * 警告メッセージを表示
   */
  const showWarning = useCallback(
    (message: string, duration?: number) => {
      addToast(message, 'warning', duration);
    },
    [addToast]
  );

  /**
   * トーストを非表示
   */
  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const value: ToastContextType = {
    showSuccess,
    showError,
    showErrorWithHandler,
    showInfo,
    showWarning,
    dismissToast,
    toasts,
  };

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
};

/**
 * ToastContextを使用するカスタムフック
 */
export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

/**
 * ToastContainer
 *
 * トーストメッセージを画面に表示するコンテナコンポーネント
 * アプリのトップレベルで使用する
 */
export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useToast();

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            flex items-start gap-3 p-4 rounded-lg shadow-lg min-w-[300px] max-w-[500px]
            transition-all duration-300 ease-in-out
            ${
              toast.type === 'success'
                ? 'bg-green-50 border border-green-200'
                : toast.type === 'error'
                ? 'bg-red-50 border border-red-200'
                : toast.type === 'warning'
                ? 'bg-yellow-50 border border-yellow-200'
                : 'bg-blue-50 border border-blue-200'
            }
          `}
        >
          {/* アイコン */}
          <div className="flex-shrink-0">
            {toast.type === 'success' ? (
              <svg
                className="w-6 h-6 text-green-600"
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
            ) : toast.type === 'error' ? (
              <svg
                className="w-6 h-6 text-red-600"
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
            ) : toast.type === 'warning' ? (
              <svg
                className="w-6 h-6 text-yellow-600"
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
            ) : (
              <svg
                className="w-6 h-6 text-blue-600"
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
            )}
          </div>

          {/* メッセージ */}
          <div className="flex-1">
            <p
              className={`text-sm font-medium ${
                toast.type === 'success'
                  ? 'text-green-800'
                  : toast.type === 'error'
                  ? 'text-red-800'
                  : toast.type === 'warning'
                  ? 'text-yellow-800'
                  : 'text-blue-800'
              }`}
            >
              {toast.message}
            </p>
          </div>

          {/* 閉じるボタン */}
          <button
            onClick={() => dismissToast(toast.id)}
            className={`flex-shrink-0 inline-flex text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              toast.type === 'success'
                ? 'focus:ring-green-500'
                : toast.type === 'error'
                ? 'focus:ring-red-500'
                : toast.type === 'warning'
                ? 'focus:ring-yellow-500'
                : 'focus:ring-blue-500'
            }`}
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
      ))}
    </div>
  );
};
