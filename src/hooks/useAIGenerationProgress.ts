/**
 * AI生成プログレス管理カスタムフック
 * Phase 45: AIシフト生成進行状況表示機能
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { GenerationProgressState, UseAIGenerationProgressReturn } from '../components/AIGenerationProgress/types';
import { GENERATION_STEPS, DEFAULT_ESTIMATED_SECONDS } from '../components/AIGenerationProgress/types';

/**
 * 経過時間から現在のステップを計算する
 */
const calculateCurrentStep = (elapsedSeconds: number): number => {
  // ステップを逆順で確認し、経過時間に該当するステップを返す
  for (let i = GENERATION_STEPS.length - 1; i >= 0; i--) {
    if (elapsedSeconds >= GENERATION_STEPS[i].startTimeSeconds) {
      return GENERATION_STEPS[i].id;
    }
  }
  return 1;
};

/**
 * 初期状態
 */
const initialState: GenerationProgressState = {
  status: 'idle',
  currentStep: 1,
  elapsedSeconds: 0,
  estimatedTotalSeconds: DEFAULT_ESTIMATED_SECONDS,
  errorMessage: undefined,
};

/**
 * AI生成処理の進行状況を管理するカスタムフック
 *
 * @param estimatedTotalSeconds 予測処理時間（秒）。デフォルト180秒
 * @returns 状態と操作関数
 */
export function useAIGenerationProgress(
  estimatedTotalSeconds: number = DEFAULT_ESTIMATED_SECONDS
): UseAIGenerationProgressReturn {
  const [state, setState] = useState<GenerationProgressState>({
    ...initialState,
    estimatedTotalSeconds,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);

  /**
   * タイマーをクリアする
   */
  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    startTimeRef.current = null;
  }, []);

  /**
   * 生成処理を開始する
   */
  const startGeneration = useCallback(() => {
    clearTimer();
    startTimeRef.current = Date.now();

    setState({
      status: 'generating',
      currentStep: 1,
      elapsedSeconds: 0,
      estimatedTotalSeconds,
      errorMessage: undefined,
    });

    // 1秒ごとに経過時間を更新
    intervalRef.current = setInterval(() => {
      if (startTimeRef.current) {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        const currentStep = calculateCurrentStep(elapsed);

        setState((prev) => ({
          ...prev,
          elapsedSeconds: elapsed,
          currentStep,
        }));
      }
    }, 1000);
  }, [clearTimer, estimatedTotalSeconds]);

  /**
   * 生成処理を完了する
   */
  const completeGeneration = useCallback(() => {
    clearTimer();
    setState((prev) => ({
      ...prev,
      status: 'completed',
      currentStep: GENERATION_STEPS.length,
    }));
  }, [clearTimer]);

  /**
   * 生成処理をエラーで終了する
   */
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

  /**
   * 生成処理をキャンセルする
   */
  const cancelGeneration = useCallback(() => {
    clearTimer();
    setState((prev) => ({
      ...prev,
      status: 'cancelled',
    }));
  }, [clearTimer]);

  /**
   * 状態をリセットする
   */
  const reset = useCallback(() => {
    clearTimer();
    setState({
      ...initialState,
      estimatedTotalSeconds,
    });
  }, [clearTimer, estimatedTotalSeconds]);

  /**
   * コンポーネントのアンマウント時にタイマーをクリア
   */
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
