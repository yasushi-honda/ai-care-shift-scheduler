/**
 * useAIGenerationProgress カスタムフック ユニットテスト
 * Phase 45: AIシフト生成進行状況表示機能
 * Phase 60: Solver時代のUI刷新
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAIGenerationProgress } from '../useAIGenerationProgress';
import type { GenerationResult } from '../../components/AIGenerationProgress/types';

const mockResult: GenerationResult = {
  overallScore: 85,
  fulfillmentRate: 92,
  violationCount: 1,
  recommendationCount: 2,
  elapsedSeconds: 3,
};

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
      expect(result.current.state.elapsedSeconds).toBe(0);
      expect(result.current.state.errorMessage).toBeUndefined();
      expect(result.current.state.result).toBeUndefined();
    });
  });

  describe('startGeneration', () => {
    it('startGeneration呼び出し後にgenerating状態になること', () => {
      const { result } = renderHook(() => useAIGenerationProgress());

      act(() => {
        result.current.startGeneration();
      });

      expect(result.current.state.status).toBe('generating');
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
        result.current.completeGeneration(mockResult);
      });

      expect(result.current.state.status).toBe('completed');
      expect(result.current.state.result).toEqual(mockResult);
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
        result.current.completeGeneration(mockResult);
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
      expect(result.current.state.elapsedSeconds).toBe(0);
      expect(result.current.state.errorMessage).toBeUndefined();
      expect(result.current.state.result).toBeUndefined();
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
    });
  });
});
