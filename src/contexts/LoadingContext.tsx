import React, { createContext, useContext, useState, useCallback } from 'react';

/**
 * ローディングタスクの型定義
 */
export interface LoadingTask {
  id: string;
  message?: string;
}

/**
 * LoadingContextの型定義
 */
interface LoadingContextType {
  isLoading: boolean;
  loadingMessage: string | null;
  startLoading: (taskId: string, message?: string) => void;
  stopLoading: (taskId: string) => void;
  tasks: LoadingTask[];
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

/**
 * LoadingProvider
 *
 * アプリ全体でローディング状態を管理するプロバイダー
 * 複数のローディングタスクを同時に管理可能
 */
export const LoadingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<LoadingTask[]>([]);

  /**
   * ローディングタスクを開始
   *
   * @param taskId - タスクの一意な識別子
   * @param message - オプショナルなローディングメッセージ
   */
  const startLoading = useCallback((taskId: string, message?: string) => {
    setTasks((prev) => {
      // 既に同じIDのタスクがある場合は追加しない
      if (prev.some((task) => task.id === taskId)) {
        return prev;
      }
      return [...prev, { id: taskId, message }];
    });
  }, []);

  /**
   * ローディングタスクを終了
   *
   * @param taskId - 終了するタスクの識別子
   */
  const stopLoading = useCallback((taskId: string) => {
    setTasks((prev) => prev.filter((task) => task.id !== taskId));
  }, []);

  /**
   * ローディング中かどうか
   */
  const isLoading = tasks.length > 0;

  /**
   * 現在のローディングメッセージ（最初のタスクのメッセージ）
   */
  const loadingMessage = tasks.length > 0 && tasks[0].message ? tasks[0].message : null;

  const value: LoadingContextType = {
    isLoading,
    loadingMessage,
    startLoading,
    stopLoading,
    tasks,
  };

  return <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>;
};

/**
 * LoadingContextを使用するカスタムフック
 */
export const useLoading = (): LoadingContextType => {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
};

/**
 * LoadingOverlay
 *
 * グローバルローディングインジケーターを表示するコンポーネント
 * アプリのトップレベルで使用する
 */
export const LoadingOverlay: React.FC = () => {
  const { isLoading, loadingMessage } = useLoading();

  if (!isLoading) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-40">
      <div className="bg-white rounded-lg shadow-lg p-6 flex flex-col items-center gap-4">
        {/* スピナー */}
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>

        {/* メッセージ */}
        {loadingMessage && (
          <p className="text-gray-700 text-center font-medium">{loadingMessage}</p>
        )}
      </div>
    </div>
  );
};

/**
 * useLoadingTask
 *
 * ローディングタスクを簡単に管理するカスタムフック
 *
 * @example
 * const { startTask, stopTask } = useLoadingTask();
 *
 * async function fetchData() {
 *   const taskId = startTask('データ読み込み中...');
 *   try {
 *     await someAsyncOperation();
 *   } finally {
 *     stopTask(taskId);
 *   }
 * }
 */
export const useLoadingTask = () => {
  const { startLoading, stopLoading } = useLoading();

  /**
   * タスクを開始し、タスクIDを返す
   */
  const startTask = useCallback(
    (message?: string): string => {
      const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      startLoading(taskId, message);
      return taskId;
    },
    [startLoading]
  );

  /**
   * タスクを終了
   */
  const stopTask = useCallback(
    (taskId: string) => {
      stopLoading(taskId);
    },
    [stopLoading]
  );

  /**
   * 非同期関数をラップしてローディング状態を自動管理
   */
  const withLoading = useCallback(
    async <T,>(
      asyncFn: () => Promise<T>,
      message?: string
    ): Promise<T> => {
      const taskId = startTask(message);
      try {
        return await asyncFn();
      } finally {
        stopTask(taskId);
      }
    },
    [startTask, stopTask]
  );

  return { startTask, stopTask, withLoading };
};
