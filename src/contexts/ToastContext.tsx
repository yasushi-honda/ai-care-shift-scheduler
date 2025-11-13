import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { handleError, getErrorMessage } from '../utils/errorHandler';

/**
 * トーストメッセージの型定義
 * Phase 19.2.4: isExiting状態を追加（退場アニメーション用）
 */
export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number; // ミリ秒（デフォルト: 自動計算）
  isExiting?: boolean; // 退場アニメーション中
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
   * Phase 19.2.4: メッセージ長に基づいて最適な表示時間を計算
   * - 短いメッセージ（<30文字）: 3000ms
   * - 中程度（30-60文字）: 4000ms
   * - 長いメッセージ（>60文字）: 5000ms
   * - エラーメッセージは+1000ms
   */
  const calculateOptimalDuration = (message: string, type: Toast['type']): number => {
    const baseTime = message.length < 30 ? 3000 : message.length < 60 ? 4000 : 5000;
    const errorPenalty = type === 'error' ? 1000 : 0;
    return baseTime + errorPenalty;
  };

  /**
   * トーストを追加
   * Phase 19.2.4: 退場アニメーション対応、最適化された自動消去時間
   */
  const addToast = useCallback(
    (message: string, type: Toast['type'], duration?: number) => {
      const id = generateId();
      const optimalDuration = duration ?? calculateOptimalDuration(message, type);
      const newToast: Toast = { id, message, type, duration: optimalDuration, isExiting: false };

      setToasts((prev) => {
        // 最大3件まで表示（古いものから削除）
        const updated = [...prev, newToast];
        return updated.slice(-3);
      });

      // 自動非表示タイマー
      if (optimalDuration > 0) {
        // 退場アニメーション（300ms）→削除
        setTimeout(() => {
          // 退場開始
          setToasts((prev) =>
            prev.map((toast) => (toast.id === id ? { ...toast, isExiting: true } : toast))
          );

          // アニメーション完了後に削除
          setTimeout(() => {
            setToasts((prev) => prev.filter((toast) => toast.id !== id));
          }, 300);
        }, optimalDuration);
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
   * Phase 19.2.4: 退場アニメーション対応
   */
  const dismissToast = useCallback((id: string) => {
    // 退場アニメーション開始
    setToasts((prev) =>
      prev.map((toast) => (toast.id === id ? { ...toast, isExiting: true } : toast))
    );

    // アニメーション完了後に削除
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 300);
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
 * Phase 19.2.4: ToastItem - 個別トーストコンポーネント
 * プログレスバーインジケーター付き
 */
const ToastItem: React.FC<{ toast: Toast; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  const [progress, setProgress] = useState(100);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!toast.duration || toast.duration <= 0 || toast.isExiting) return;

    // プログレスバーのアニメーション（100% → 0%）
    const interval = 50; // 50msごとに更新
    const decrement = (100 / toast.duration) * interval;

    progressIntervalRef.current = setInterval(() => {
      setProgress((prev) => {
        const next = prev - decrement;
        return next > 0 ? next : 0;
      });
    }, interval);

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [toast.duration, toast.isExiting]);

  return (
    <div
      className={`
        relative overflow-hidden flex items-start gap-3 p-4 rounded-lg shadow-lg min-w-[300px] max-w-[500px]
        transition-all duration-300 ease-out
        ${
          toast.type === 'success'
            ? 'bg-green-50 border border-green-200'
            : toast.type === 'error'
            ? 'bg-red-50 border border-red-200'
            : toast.type === 'warning'
            ? 'bg-yellow-50 border border-yellow-200'
            : 'bg-blue-50 border border-blue-200'
        }
        ${toast.isExiting ? 'animate-[toast-exit_300ms_ease-out_forwards]' : 'animate-[toast-enter_300ms_ease-out]'}
      `}
    >
      {/* プログレスバーインジケーター（下部） */}
      {toast.duration && toast.duration > 0 && !toast.isExiting && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-300 bg-opacity-30">
          <div
            className={`h-full transition-all ${
              toast.type === 'success'
                ? 'bg-green-600'
                : toast.type === 'error'
                ? 'bg-red-600'
                : toast.type === 'warning'
                ? 'bg-yellow-600'
                : 'bg-blue-600'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

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
        onClick={() => onDismiss(toast.id)}
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
  );
};

/**
 * ToastContainer
 *
 * トーストメッセージを画面に表示するコンテナコンポーネント
 * Phase 19.2.4: アニメーション改善、プログレスバー追加
 */
export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useToast();

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2" aria-live="polite">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </div>
  );
};
