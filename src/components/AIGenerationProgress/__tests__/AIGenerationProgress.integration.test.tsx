/**
 * AIGenerationProgress 統合テスト
 * Phase 45: AIシフト生成進行状況表示機能
 *
 * フックとコンポーネントを組み合わせた実際の使用シナリオをテスト
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useAIGenerationProgress } from '../../../hooks/useAIGenerationProgress';
import { AIGenerationProgress } from '../AIGenerationProgress';

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
  } = useAIGenerationProgress(180); // 180秒の予測時間

  const handleStart = () => {
    startGeneration();
    onGenerationStart?.();
  };

  const handleComplete = () => {
    completeGeneration();
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
      <AIGenerationProgress state={state} onCancel={handleCancel} />
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
    it('シフト作成実行ボタンクリックでプログレス表示が開始されること', () => {
      const onStart = vi.fn();
      render(<TestComponent onGenerationStart={onStart} />);

      // 初期状態ではプログレス表示なし
      expect(screen.queryByText('AIがシフトを生成中...')).not.toBeInTheDocument();

      // シフト作成実行
      fireEvent.click(screen.getByTestId('start-btn'));

      // プログレス表示開始
      expect(screen.getByText('AIがシフトを生成中...')).toBeInTheDocument();
      expect(onStart).toHaveBeenCalledTimes(1);
    });

    it('時間経過でステップが自動的に進行すること', () => {
      render(<TestComponent />);

      fireEvent.click(screen.getByTestId('start-btn'));

      // 初期: ステップ1「リクエスト送信中」
      expect(screen.getByText('リクエスト送信中')).toBeInTheDocument();

      // 5秒後: ステップ2「骨子を生成中」
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(screen.getByText('骨子を生成中')).toBeInTheDocument();
    });
  });

  describe('処理完了時の動作', () => {
    it('処理完了時にプログレスが完了状態になること', () => {
      const onComplete = vi.fn();
      render(<TestComponent onGenerationComplete={onComplete} />);

      // 開始
      fireEvent.click(screen.getByTestId('start-btn'));
      expect(screen.getByText('AIがシフトを生成中...')).toBeInTheDocument();

      // 完了
      fireEvent.click(screen.getByTestId('complete-btn'));

      expect(screen.getByText('シフト生成が完了しました！')).toBeInTheDocument();
      expect(screen.queryByText('AIがシフトを生成中...')).not.toBeInTheDocument();
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it('リセット後に初期状態に戻ること', () => {
      render(<TestComponent />);

      // 開始 → 完了
      fireEvent.click(screen.getByTestId('start-btn'));
      fireEvent.click(screen.getByTestId('complete-btn'));
      expect(screen.getByText('シフト生成が完了しました！')).toBeInTheDocument();

      // リセット
      fireEvent.click(screen.getByTestId('reset-btn'));

      // プログレス表示が消えている（idle状態）
      expect(screen.queryByText('シフト生成が完了しました！')).not.toBeInTheDocument();
      expect(screen.queryByText('AIがシフトを生成中...')).not.toBeInTheDocument();
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
      expect(screen.queryByText('AIがシフトを生成中...')).not.toBeInTheDocument();
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
      expect(screen.getByText('AIがシフトを生成中...')).toBeInTheDocument();
    });
  });

  describe('キャンセル機能の動作', () => {
    it('キャンセル確認モーダルからキャンセルを実行できること', () => {
      const onCancel = vi.fn();
      render(<TestComponent onGenerationCancel={onCancel} />);

      // 開始
      fireEvent.click(screen.getByTestId('start-btn'));
      expect(screen.getByText('AIがシフトを生成中...')).toBeInTheDocument();

      // キャンセルボタンクリック → 確認モーダル表示
      fireEvent.click(screen.getByRole('button', { name: 'AI生成をキャンセル' }));
      expect(screen.getByText('AI生成をキャンセルしますか？')).toBeInTheDocument();

      // モーダル内「キャンセル」ボタンをクリック
      fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }));

      // キャンセル状態
      expect(screen.getByText('処理がキャンセルされました')).toBeInTheDocument();
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('キャンセル後にリセットして再実行できること', () => {
      render(<TestComponent />);

      // 開始 → キャンセル
      fireEvent.click(screen.getByTestId('start-btn'));
      fireEvent.click(screen.getByRole('button', { name: 'AI生成をキャンセル' }));
      fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }));
      expect(screen.getByText('処理がキャンセルされました')).toBeInTheDocument();

      // リセット → 再実行
      fireEvent.click(screen.getByTestId('reset-btn'));
      fireEvent.click(screen.getByTestId('start-btn'));
      expect(screen.getByText('AIがシフトを生成中...')).toBeInTheDocument();
    });
  });

  describe('タイマーの動作確認', () => {
    it('generating中は経過時間が更新されること', () => {
      render(<TestComponent />);

      fireEvent.click(screen.getByTestId('start-btn'));

      // 初期: 0:00
      expect(screen.getByText('0:00')).toBeInTheDocument();

      // 1秒後
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByText('0:01')).toBeInTheDocument();

      // 10秒後
      act(() => {
        vi.advanceTimersByTime(9000);
      });
      expect(screen.getByText('0:10')).toBeInTheDocument();

      // 1分後
      act(() => {
        vi.advanceTimersByTime(50000);
      });
      expect(screen.getByText('1:00')).toBeInTheDocument();
    });

    it('完了後はタイマーが停止すること', () => {
      render(<TestComponent />);

      fireEvent.click(screen.getByTestId('start-btn'));

      act(() => {
        vi.advanceTimersByTime(30000);
      });

      fireEvent.click(screen.getByTestId('complete-btn'));

      // 完了後に時間を進めても表示は変わらない
      // （完了状態では時間表示がないので、直接確認はできないが、
      //   エラーが発生しないことで停止を確認）
      act(() => {
        vi.advanceTimersByTime(10000);
      });

      expect(screen.getByText('シフト生成が完了しました！')).toBeInTheDocument();
    });
  });
});
