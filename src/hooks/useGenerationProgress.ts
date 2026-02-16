/**
 * 自動生成プログレス管理カスタムフック
 *
 * Solverは数秒で完了するため、シンプルな経過時間追跡と結果サマリー表示のみ
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { GenerationProgressState, GenerationResult, UseGenerationProgressReturn } from '../components/GenerationProgress/types';

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
 * 生成処理の進行状況を管理するカスタムフック
 */
export function useGenerationProgress(): UseGenerationProgressReturn {
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
