/**
 * GenerationProgress コンポーネント ユニットテスト
 * Phase 45: AIシフト生成進行状況表示機能
 * Phase 60: Solver時代のUI刷新
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GenerationProgress } from '../GenerationProgress';
import type { GenerationProgressState, GenerationResult } from '../types';

const mockResult: GenerationResult = {
  overallScore: 85,
  fulfillmentRate: 92,
  violationCount: 1,
  recommendationCount: 2,
  elapsedSeconds: 3,
};

// テスト用のデフォルト状態
const createState = (overrides: Partial<GenerationProgressState> = {}): GenerationProgressState => ({
  status: 'generating',
  elapsedSeconds: 0,
  errorMessage: undefined,
  result: undefined,
  ...overrides,
});

describe('GenerationProgress', () => {
  describe('idle状態', () => {
    it('idle状態では何も表示しないこと', () => {
      const state = createState({ status: 'idle' });
      const { container } = render(<GenerationProgress state={state} />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('generating状態', () => {
    it('generating状態でスピナーが表示されること', () => {
      const state = createState({ status: 'generating' });
      render(<GenerationProgress state={state} />);

      expect(screen.getByText('最適化計算中...')).toBeInTheDocument();
      expect(screen.getByText('制約条件を満たす最適なシフトを計算しています')).toBeInTheDocument();
    });

    it('aria-live属性が設定されていること', () => {
      const state = createState({ status: 'generating' });
      render(<GenerationProgress state={state} />);

      const region = screen.getByRole('region', { name: 'シフト生成中' });
      expect(region).toHaveAttribute('aria-live', 'polite');
    });

    it('キャンセルボタンが表示されること', () => {
      const state = createState({ status: 'generating' });
      const onCancel = vi.fn();
      render(<GenerationProgress state={state} onCancel={onCancel} />);

      expect(screen.getByRole('button', { name: '生成をキャンセル' })).toBeInTheDocument();
    });

    it('onCancelが渡されない場合、キャンセルボタンが表示されないこと', () => {
      const state = createState({ status: 'generating' });
      render(<GenerationProgress state={state} />);

      expect(screen.queryByRole('button', { name: '生成をキャンセル' })).not.toBeInTheDocument();
    });

    it('キャンセルボタンクリックで直接onCancelが呼ばれること', () => {
      const state = createState({ status: 'generating' });
      const onCancel = vi.fn();
      render(<GenerationProgress state={state} onCancel={onCancel} />);

      fireEvent.click(screen.getByRole('button', { name: '生成をキャンセル' }));

      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('completed状態', () => {
    it('completed状態で結果サマリーが表示されること', () => {
      const state = createState({ status: 'completed', result: mockResult });
      render(<GenerationProgress state={state} />);

      expect(screen.getByText('シフト生成が完了しました')).toBeInTheDocument();
      expect(screen.getByText('85')).toBeInTheDocument();
      expect(screen.getByText('92%')).toBeInTheDocument();
      expect(screen.getByText('1件')).toBeInTheDocument();
      expect(screen.getByText('3秒')).toBeInTheDocument();
    });

    it('completed状態で確認ボタンが表示されること', () => {
      const state = createState({ status: 'completed', result: mockResult });
      const onClose = vi.fn();
      render(<GenerationProgress state={state} onClose={onClose} />);

      const button = screen.getByRole('button', { name: '確認' });
      expect(button).toBeInTheDocument();

      fireEvent.click(button);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('推奨事項がある場合メッセージが表示されること', () => {
      const state = createState({ status: 'completed', result: mockResult });
      render(<GenerationProgress state={state} />);

      expect(screen.getByText('2件の改善提案があります（シフト表で確認できます）')).toBeInTheDocument();
    });

    it('推奨事項が0件の場合メッセージが表示されないこと', () => {
      const resultNoRec = { ...mockResult, recommendationCount: 0 };
      const state = createState({ status: 'completed', result: resultNoRec });
      render(<GenerationProgress state={state} />);

      expect(screen.queryByText(/改善提案/)).not.toBeInTheDocument();
    });
  });

  describe('error状態', () => {
    it('error状態でエラーメッセージが表示されること', () => {
      const state = createState({ status: 'error' });
      render(<GenerationProgress state={state} />);

      expect(screen.getByText('エラーが発生しました')).toBeInTheDocument();
    });

    it('error状態でカスタムエラーメッセージが表示されること', () => {
      const errorMessage = 'APIエラーが発生しました';
      const state = createState({ status: 'error', errorMessage });
      render(<GenerationProgress state={state} />);

      expect(screen.getByText('エラーが発生しました')).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it('error状態で閉じるボタンが機能すること', () => {
      const state = createState({ status: 'error', errorMessage: 'テスト' });
      const onClose = vi.fn();
      render(<GenerationProgress state={state} onClose={onClose} />);

      fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('cancelled状態', () => {
    it('cancelled状態でキャンセルメッセージが表示されること', () => {
      const state = createState({ status: 'cancelled' });
      render(<GenerationProgress state={state} />);

      expect(screen.getByText('処理がキャンセルされました')).toBeInTheDocument();
    });

    it('cancelled状態で閉じるボタンが機能すること', () => {
      const state = createState({ status: 'cancelled' });
      const onClose = vi.fn();
      render(<GenerationProgress state={state} onClose={onClose} />);

      fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
