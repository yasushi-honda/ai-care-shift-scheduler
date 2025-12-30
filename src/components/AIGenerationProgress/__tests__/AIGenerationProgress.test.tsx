/**
 * AIGenerationProgress コンポーネント ユニットテスト
 * Phase 45: AIシフト生成進行状況表示機能
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AIGenerationProgress } from '../AIGenerationProgress';
import type { GenerationProgressState } from '../types';
import { DEFAULT_ESTIMATED_SECONDS } from '../types';

// テスト用のデフォルト状態
const createState = (overrides: Partial<GenerationProgressState> = {}): GenerationProgressState => ({
  status: 'generating',
  currentStep: 1,
  elapsedSeconds: 0,
  estimatedTotalSeconds: DEFAULT_ESTIMATED_SECONDS,
  errorMessage: undefined,
  ...overrides,
});

describe('AIGenerationProgress', () => {
  describe('idle状態', () => {
    it('idle状態では何も表示しないこと', () => {
      const state = createState({ status: 'idle' });
      const { container } = render(<AIGenerationProgress state={state} />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('generating状態', () => {
    it('generating状態でプログレス表示が表示されること', () => {
      const state = createState({ status: 'generating' });
      render(<AIGenerationProgress state={state} />);

      expect(screen.getByText('AIがシフトを生成中...')).toBeInTheDocument();
      expect(screen.getByText('しばらくお待ちください')).toBeInTheDocument();
    });

    it('aria-live属性が設定されていること', () => {
      const state = createState({ status: 'generating' });
      render(<AIGenerationProgress state={state} />);

      const region = screen.getByRole('region', { name: 'AI生成進行状況' });
      expect(region).toHaveAttribute('aria-live', 'polite');
    });

    it('キャンセルボタンが表示されること', () => {
      const state = createState({ status: 'generating' });
      const onCancel = vi.fn();
      render(<AIGenerationProgress state={state} onCancel={onCancel} />);

      expect(screen.getByRole('button', { name: 'AI生成をキャンセル' })).toBeInTheDocument();
    });

    it('onCancelが渡されない場合、キャンセルボタンが表示されないこと', () => {
      const state = createState({ status: 'generating' });
      render(<AIGenerationProgress state={state} />);

      expect(screen.queryByRole('button', { name: 'AI生成をキャンセル' })).not.toBeInTheDocument();
    });
  });

  describe('completed状態', () => {
    it('completed状態で完了メッセージが表示されること', () => {
      const state = createState({ status: 'completed' });
      render(<AIGenerationProgress state={state} />);

      expect(screen.getByText('シフト生成が完了しました！')).toBeInTheDocument();
    });

    it('completed状態ではキャンセルボタンが表示されないこと', () => {
      const state = createState({ status: 'completed' });
      const onCancel = vi.fn();
      render(<AIGenerationProgress state={state} onCancel={onCancel} />);

      expect(screen.queryByRole('button', { name: 'AI生成をキャンセル' })).not.toBeInTheDocument();
    });
  });

  describe('error状態', () => {
    it('error状態でエラーメッセージが表示されること', () => {
      const state = createState({ status: 'error' });
      render(<AIGenerationProgress state={state} />);

      expect(screen.getByText('エラーが発生しました')).toBeInTheDocument();
    });

    it('error状態でカスタムエラーメッセージが表示されること', () => {
      const errorMessage = 'APIエラーが発生しました';
      const state = createState({ status: 'error', errorMessage });
      render(<AIGenerationProgress state={state} />);

      expect(screen.getByText('エラーが発生しました')).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it('errorMessageが未定義の場合、詳細メッセージは表示されないこと', () => {
      const state = createState({ status: 'error', errorMessage: undefined });
      render(<AIGenerationProgress state={state} />);

      expect(screen.getByText('エラーが発生しました')).toBeInTheDocument();
      // エラーメッセージ以外のテキストがないことを確認
      const container = screen.getByText('エラーが発生しました').closest('div');
      expect(container?.querySelectorAll('p').length).toBe(1);
    });
  });

  describe('cancelled状態', () => {
    it('cancelled状態でキャンセルメッセージが表示されること', () => {
      const state = createState({ status: 'cancelled' });
      render(<AIGenerationProgress state={state} />);

      expect(screen.getByText('処理がキャンセルされました')).toBeInTheDocument();
    });
  });

  describe('キャンセル機能', () => {
    it('キャンセルボタンクリックで確認モーダルが表示されること', () => {
      const state = createState({ status: 'generating' });
      const onCancel = vi.fn();
      render(<AIGenerationProgress state={state} onCancel={onCancel} />);

      fireEvent.click(screen.getByRole('button', { name: 'AI生成をキャンセル' }));

      expect(screen.getByText('AI生成をキャンセルしますか？')).toBeInTheDocument();
      expect(screen.getByText('処理を中断すると、途中までの結果は破棄されます。')).toBeInTheDocument();
    });

    it('確認モーダルで「キャンセル」をクリックするとonCancelが呼ばれること', () => {
      const state = createState({ status: 'generating' });
      const onCancel = vi.fn();
      render(<AIGenerationProgress state={state} onCancel={onCancel} />);

      // キャンセルボタンをクリック
      fireEvent.click(screen.getByRole('button', { name: 'AI生成をキャンセル' }));

      // モーダル内の「キャンセル」ボタンをクリック
      const cancelButton = screen.getByRole('button', { name: 'キャンセル' });
      fireEvent.click(cancelButton);

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('確認モーダルで「続ける」をクリックするとモーダルが閉じること', () => {
      const state = createState({ status: 'generating' });
      const onCancel = vi.fn();
      render(<AIGenerationProgress state={state} onCancel={onCancel} />);

      // キャンセルボタンをクリック
      fireEvent.click(screen.getByRole('button', { name: 'AI生成をキャンセル' }));

      // 「続ける」ボタンをクリック
      fireEvent.click(screen.getByRole('button', { name: '続ける' }));

      // モーダルが閉じていることを確認
      expect(screen.queryByText('AI生成をキャンセルしますか？')).not.toBeInTheDocument();
      expect(onCancel).not.toHaveBeenCalled();
    });
  });

  describe('アクセシビリティ', () => {
    it('確認モーダルにaria-modal属性があること', () => {
      const state = createState({ status: 'generating' });
      const onCancel = vi.fn();
      render(<AIGenerationProgress state={state} onCancel={onCancel} />);

      fireEvent.click(screen.getByRole('button', { name: 'AI生成をキャンセル' }));

      const modal = screen.getByRole('dialog');
      expect(modal).toHaveAttribute('aria-modal', 'true');
      expect(modal).toHaveAttribute('aria-labelledby', 'cancel-modal-title');
    });
  });
});
