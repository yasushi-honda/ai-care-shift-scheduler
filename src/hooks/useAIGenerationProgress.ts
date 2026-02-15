/**
 * AI生成プログレス管理カスタムフック
 * Phase 45: AIシフト生成進行状況表示機能
 * Phase 60: Solver時代のUI刷新（プログレス→結果サマリー）
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { GenerationProgressState, GenerationResult, UseAIGenerationProgressReturn } from '../components/AIGenerationProgress/types';

/**
 * 初期状態
 */
const initialState: GenerationProgressState = {
  status: 'idle',
  elapsedSeconds: 0,
  errorMessage: undefined,
  result: undefined,
};

/**
 * AI生成処理の進行状況を管理するカスタムフック
 *
 * Phase 60: Solver対応
 * - ステップ管理・予測時間を廃止（Solverは数秒で完了するため）
 * - 完了時に結果サマリーを受け取り、ユーザーが確認後に閉じる
 */
export function useAIGenerationProgress(): UseAIGenerationProgressReturn {
  const [state, setState] = useState<GenerationProgressState>(initialState);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    startTimeRef.current = null;
  }, []);

  const startGeneration = useCallback(() => {
    clearTimer();
    startTimeRef.current = Date.now();

    setState({
      status: 'generating',
      elapsedSeconds: 0,
      errorMessage: undefined,
      result: undefined,
    });

    // 1秒ごとに経過時間を更新
    intervalRef.current = setInterval(() => {
      if (startTimeRef.current) {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setState((prev) => ({ ...prev, elapsedSeconds: elapsed }));
      }
    }, 1000);
  }, [clearTimer]);

  const completeGeneration = useCallback(
    (result: GenerationResult) => {
      clearTimer();
      setState((prev) => ({
        ...prev,
        status: 'completed',
        result,
      }));
    },
    [clearTimer]
  );

  const failGeneration = useCallback(
    (errorMessage: string) => {
      clearTimer();
      setState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage,
      }));
    },
    [clearTimer]
  );

  const cancelGeneration = useCallback(() => {
    clearTimer();
    setState((prev) => ({
      ...prev,
      status: 'cancelled',
    }));
  }, [clearTimer]);

  const reset = useCallback(() => {
    clearTimer();
    setState(initialState);
  }, [clearTimer]);

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  return {
    state,
    startGeneration,
    completeGeneration,
    failGeneration,
    cancelGeneration,
    reset,
  };
}
