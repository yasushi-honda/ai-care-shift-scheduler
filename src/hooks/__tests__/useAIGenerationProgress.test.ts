/**
 * useAIGenerationProgress カスタムフック ユニットテスト
 * Phase 45: AIシフト生成進行状況表示機能
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAIGenerationProgress } from '../useAIGenerationProgress';
import { DEFAULT_ESTIMATED_SECONDS, GENERATION_STEPS } from '../../components/AIGenerationProgress/types';

describe('useAIGenerationProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('初期状態', () => {
    it('初期状態がidle状態であること', () => {
      const { result } = renderHook(() => useAIGenerationProgress());

      expect(result.current.state.status).toBe('idle');
      expect(result.current.state.currentStep).toBe(1);
      expect(result.current.state.elapsedSeconds).toBe(0);
      expect(result.current.state.estimatedTotalSeconds).toBe(DEFAULT_ESTIMATED_SECONDS);
      expect(result.current.state.errorMessage).toBeUndefined();
    });

    it('カスタム予測時間を設定できること', () => {
      const customTime = 240;
      const { result } = renderHook(() => useAIGenerationProgress(customTime));

      expect(result.current.state.estimatedTotalSeconds).toBe(customTime);
    });
  });

  describe('startGeneration', () => {
    it('startGeneration呼び出し後にgenerating状態になること', () => {
      const { result } = renderHook(() => useAIGenerationProgress());

      act(() => {
        result.current.startGeneration();
      });

      expect(result.current.state.status).toBe('generating');
      expect(result.current.state.currentStep).toBe(1);
      expect(result.current.state.elapsedSeconds).toBe(0);
    });

    it('時間経過によって経過時間が更新されること', () => {
      const { result } = renderHook(() => useAIGenerationProgress());

      act(() => {
        result.current.startGeneration();
      });

      // 3秒経過
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(result.current.state.elapsedSeconds).toBe(3);
    });

    it('時間経過によってステップが正しく進行すること', () => {
      const { result } = renderHook(() => useAIGenerationProgress());

      act(() => {
        result.current.startGeneration();
      });

      // 初期: ステップ1（リクエスト送信中）
      expect(result.current.state.currentStep).toBe(1);

      // 5秒後: ステップ2（骨子を生成中）
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(result.current.state.currentStep).toBe(2);

      // 180秒後: ステップ3（シフト詳細を生成中）
      act(() => {
        vi.advanceTimersByTime(175000);
      });
      expect(result.current.state.currentStep).toBe(3);

      // 300秒後: ステップ4（評価・最適化中）
      act(() => {
        vi.advanceTimersByTime(120000);
      });
      expect(result.current.state.currentStep).toBe(4);

      // 320秒後: ステップ5（完了処理中）
      act(() => {
        vi.advanceTimersByTime(20000);
      });
      expect(result.current.state.currentStep).toBe(5);
    });
  });

  describe('completeGeneration', () => {
    it('completeGeneration呼び出し後にcompleted状態になること', () => {
      const { result } = renderHook(() => useAIGenerationProgress());

      act(() => {
        result.current.startGeneration();
      });

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      act(() => {
        result.current.completeGeneration();
      });

      expect(result.current.state.status).toBe('completed');
      expect(result.current.state.currentStep).toBe(GENERATION_STEPS.length);
    });

    it('completeGeneration後はタイマーが停止すること', () => {
      const { result } = renderHook(() => useAIGenerationProgress());

      act(() => {
        result.current.startGeneration();
      });

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      const elapsedAtComplete = result.current.state.elapsedSeconds;

      act(() => {
        result.current.completeGeneration();
      });

      // さらに時間を進めても経過時間は更新されない
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(result.current.state.elapsedSeconds).toBe(elapsedAtComplete);
    });
  });

  describe('failGeneration', () => {
    it('failGeneration呼び出し後にerror状態になること', () => {
      const { result } = renderHook(() => useAIGenerationProgress());
      const errorMessage = 'テストエラーメッセージ';

      act(() => {
        result.current.startGeneration();
      });

      act(() => {
        result.current.failGeneration(errorMessage);
      });

      expect(result.current.state.status).toBe('error');
      expect(result.current.state.errorMessage).toBe(errorMessage);
    });

    it('failGeneration後はタイマーが停止すること', () => {
      const { result } = renderHook(() => useAIGenerationProgress());

      act(() => {
        result.current.startGeneration();
      });

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      const elapsedAtFail = result.current.state.elapsedSeconds;

      act(() => {
        result.current.failGeneration('エラー');
      });

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(result.current.state.elapsedSeconds).toBe(elapsedAtFail);
    });
  });

  describe('cancelGeneration', () => {
    it('cancelGeneration呼び出し後にcancelled状態になること', () => {
      const { result } = renderHook(() => useAIGenerationProgress());

      act(() => {
        result.current.startGeneration();
      });

      act(() => {
        result.current.cancelGeneration();
      });

      expect(result.current.state.status).toBe('cancelled');
    });

    it('cancelGeneration後はタイマーが停止すること', () => {
      const { result } = renderHook(() => useAIGenerationProgress());

      act(() => {
        result.current.startGeneration();
      });

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      const elapsedAtCancel = result.current.state.elapsedSeconds;

      act(() => {
        result.current.cancelGeneration();
      });

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(result.current.state.elapsedSeconds).toBe(elapsedAtCancel);
    });
  });

  describe('reset', () => {
    it('reset呼び出し後に初期状態に戻ること', () => {
      const { result } = renderHook(() => useAIGenerationProgress());

      act(() => {
        result.current.startGeneration();
      });

      act(() => {
        vi.advanceTimersByTime(10000);
      });

      act(() => {
        result.current.failGeneration('エラー');
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.state.status).toBe('idle');
      expect(result.current.state.currentStep).toBe(1);
      expect(result.current.state.elapsedSeconds).toBe(0);
      expect(result.current.state.errorMessage).toBeUndefined();
    });

    it('generating状態からresetできること', () => {
      const { result } = renderHook(() => useAIGenerationProgress());

      act(() => {
        result.current.startGeneration();
      });

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.state.status).toBe('idle');
      expect(result.current.state.elapsedSeconds).toBe(0);
    });
  });

  describe('タイマークリーンアップ', () => {
    it('アンマウント時にタイマーがクリアされること', () => {
      const { result, unmount } = renderHook(() => useAIGenerationProgress());

      act(() => {
        result.current.startGeneration();
      });

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      // アンマウント
      unmount();

      // タイマーを進めてもエラーが発生しないこと（タイマーがクリアされている）
      expect(() => {
        vi.advanceTimersByTime(5000);
      }).not.toThrow();
    });

    it('startGenerationを複数回呼んでも問題ないこと', () => {
      const { result } = renderHook(() => useAIGenerationProgress());

      act(() => {
        result.current.startGeneration();
      });

      act(() => {
        vi.advanceTimersByTime(10000);
      });

      // 再度startGenerationを呼ぶ
      act(() => {
        result.current.startGeneration();
      });

      // リセットされていること
      expect(result.current.state.elapsedSeconds).toBe(0);
      expect(result.current.state.currentStep).toBe(1);
    });
  });
});
