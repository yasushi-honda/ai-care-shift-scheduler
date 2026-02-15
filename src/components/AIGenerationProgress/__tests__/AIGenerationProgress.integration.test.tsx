/**
 * AIGenerationProgress 統合テスト
 * Phase 45: AIシフト生成進行状況表示機能
 * Phase 60: Solver時代のUI刷新
 *
 * フックとコンポーネントを組み合わせた実際の使用シナリオをテスト
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useAIGenerationProgress } from '../../../hooks/useAIGenerationProgress';
import { AIGenerationProgress } from '../AIGenerationProgress';
import type { GenerationResult } from '../types';

const mockResult: GenerationResult = {
  overallScore: 85,
  fulfillmentRate: 92,
  violationCount: 1,
  recommendationCount: 2,
  elapsedSeconds: 3,
};

/**
 * フックとコンポーネントを統合したテスト用コンポーネント
 */
function TestComponent({
  onGenerationStart,
  onGenerationComplete,
  onGenerationError,
  onGenerationCancel,
}: {
  onGenerationStart?: () => void;
  onGenerationComplete?: () => void;
  onGenerationError?: (message: string) => void;
  onGenerationCancel?: () => void;
}) {
  const {
    state,
    startGeneration,
    completeGeneration,
    failGeneration,
    cancelGeneration,
    reset,
  } = useAIGenerationProgress();

  const handleStart = () => {
    startGeneration();
    onGenerationStart?.();
  };

  const handleComplete = () => {
    completeGeneration(mockResult);
    onGenerationComplete?.();
  };

  const handleError = () => {
    const errorMessage = 'APIエラーが発生しました';
    failGeneration(errorMessage);
    onGenerationError?.(errorMessage);
  };

  const handleCancel = () => {
    cancelGeneration();
    onGenerationCancel?.();
  };

  return (
    <div>
      {/* 操作ボタン（テスト用） */}
      <button onClick={handleStart} data-testid="start-btn">
        シフト作成実行
      </button>
      <button onClick={handleComplete} data-testid="complete-btn">
        完了
      </button>
      <button onClick={handleError} data-testid="error-btn">
        エラー発生
      </button>
      <button onClick={reset} data-testid="reset-btn">
        リセット
      </button>

      {/* プログレス表示 */}
      <AIGenerationProgress state={state} onCancel={handleCancel} onClose={reset} />
    </div>
  );
}

describe('AIGenerationProgress 統合テスト', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('シフト作成実行からプログレス表示開始までの流れ', () => {
    it('シフト作成実行ボタンクリックでスピナーが表示されること', () => {
      const onStart = vi.fn();
      render(<TestComponent onGenerationStart={onStart} />);

      // 初期状態ではプログレス表示なし
      expect(screen.queryByText('最適化計算中...')).not.toBeInTheDocument();

      // シフト作成実行
      fireEvent.click(screen.getByTestId('start-btn'));

      // スピナー表示開始
      expect(screen.getByText('最適化計算中...')).toBeInTheDocument();
      expect(onStart).toHaveBeenCalledTimes(1);
    });
  });

  describe('処理完了時の動作', () => {
    it('処理完了時に結果サマリーが表示されること', () => {
      const onComplete = vi.fn();
      render(<TestComponent onGenerationComplete={onComplete} />);

      // 開始
      fireEvent.click(screen.getByTestId('start-btn'));
      expect(screen.getByText('最適化計算中...')).toBeInTheDocument();

      // 完了
      fireEvent.click(screen.getByTestId('complete-btn'));

      expect(screen.getByText('シフト生成が完了しました')).toBeInTheDocument();
      expect(screen.getByText('85')).toBeInTheDocument();
      expect(screen.queryByText('最適化計算中...')).not.toBeInTheDocument();
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it('確認ボタンクリックで初期状態に戻ること', () => {
      render(<TestComponent />);

      // 開始 → 完了
      fireEvent.click(screen.getByTestId('start-btn'));
      fireEvent.click(screen.getByTestId('complete-btn'));
      expect(screen.getByText('シフト生成が完了しました')).toBeInTheDocument();

      // 確認ボタンクリック（onClose=reset）
      fireEvent.click(screen.getByRole('button', { name: '確認' }));

      // プログレス表示が消えている（idle状態）
      expect(screen.queryByText('シフト生成が完了しました')).not.toBeInTheDocument();
      expect(screen.queryByText('最適化計算中...')).not.toBeInTheDocument();
    });

    it('リセット後に初期状態に戻ること', () => {
      render(<TestComponent />);

      // 開始 → 完了
      fireEvent.click(screen.getByTestId('start-btn'));
      fireEvent.click(screen.getByTestId('complete-btn'));
      expect(screen.getByText('シフト生成が完了しました')).toBeInTheDocument();

      // リセット
      fireEvent.click(screen.getByTestId('reset-btn'));

      // プログレス表示が消えている（idle状態）
      expect(screen.queryByText('シフト生成が完了しました')).not.toBeInTheDocument();
      expect(screen.queryByText('最適化計算中...')).not.toBeInTheDocument();
    });
  });

  describe('エラー発生時の動作', () => {
    it('エラー発生時に適切なエラー表示になること', () => {
      const onError = vi.fn();
      render(<TestComponent onGenerationError={onError} />);

      // 開始
      fireEvent.click(screen.getByTestId('start-btn'));

      // エラー発生
      fireEvent.click(screen.getByTestId('error-btn'));

      expect(screen.getByText('エラーが発生しました')).toBeInTheDocument();
      expect(screen.getByText('APIエラーが発生しました')).toBeInTheDocument();
      expect(screen.queryByText('最適化計算中...')).not.toBeInTheDocument();
      expect(onError).toHaveBeenCalledWith('APIエラーが発生しました');
    });

    it('エラー後にリセットして再実行できること', () => {
      render(<TestComponent />);

      // 開始 → エラー
      fireEvent.click(screen.getByTestId('start-btn'));
      fireEvent.click(screen.getByTestId('error-btn'));
      expect(screen.getByText('エラーが発生しました')).toBeInTheDocument();

      // リセット
      fireEvent.click(screen.getByTestId('reset-btn'));

      // 再実行
      fireEvent.click(screen.getByTestId('start-btn'));
      expect(screen.getByText('最適化計算中...')).toBeInTheDocument();
    });
  });

  describe('キャンセル機能の動作', () => {
    it('キャンセルボタンクリックでキャンセル状態になること', () => {
      const onCancel = vi.fn();
      render(<TestComponent onGenerationCancel={onCancel} />);

      // 開始
      fireEvent.click(screen.getByTestId('start-btn'));
      expect(screen.getByText('最適化計算中...')).toBeInTheDocument();

      // キャンセルボタンクリック（直接キャンセル、確認モーダルなし）
      fireEvent.click(screen.getByText('キャンセル'));

      // キャンセル状態
      expect(screen.getByText('処理がキャンセルされました')).toBeInTheDocument();
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('キャンセル後にリセットして再実行できること', () => {
      render(<TestComponent />);

      // 開始 → キャンセル
      fireEvent.click(screen.getByTestId('start-btn'));
      fireEvent.click(screen.getByText('キャンセル'));
      expect(screen.getByText('処理がキャンセルされました')).toBeInTheDocument();

      // リセット → 再実行
      fireEvent.click(screen.getByTestId('reset-btn'));
      fireEvent.click(screen.getByTestId('start-btn'));
      expect(screen.getByText('最適化計算中...')).toBeInTheDocument();
    });
  });

  describe('タイマーの動作確認', () => {
    it('完了後はタイマーが停止すること', () => {
      render(<TestComponent />);

      fireEvent.click(screen.getByTestId('start-btn'));

      act(() => {
        vi.advanceTimersByTime(30000);
      });

      fireEvent.click(screen.getByTestId('complete-btn'));

      // 完了後に時間を進めてもエラーが発生しないこと
      act(() => {
        vi.advanceTimersByTime(10000);
      });

      expect(screen.getByText('シフト生成が完了しました')).toBeInTheDocument();
    });
  });
});
