/**
 * DiagnosisPanel コンポーネントテスト
 * Phase 55: データ設定診断機能
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DiagnosisPanel } from '../DiagnosisPanel';
import type { DiagnosisResult } from '../../types/diagnosis';

// テスト用の診断結果を作成
function createDiagnosisResult(
  overrides: Partial<DiagnosisResult> = {}
): DiagnosisResult {
  return {
    status: 'ok',
    summary: 'データ設定に問題はありません。',
    supplyDemandBalance: {
      totalSupply: 100,
      totalDemand: 90,
      balance: 10,
      byTimeSlot: {
        早番: { supply: 30, demand: 30, balance: 0, fulfillmentRate: 100 },
        日勤: { supply: 40, demand: 30, balance: 10, fulfillmentRate: 133 },
        遅番: { supply: 30, demand: 30, balance: 0, fulfillmentRate: 100 },
      },
    },
    issues: [],
    suggestions: [],
    executedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('DiagnosisPanel', () => {
  describe('レンダリング', () => {
    it('結果がない場合は何も表示しないこと', () => {
      const { container } = render(<DiagnosisPanel result={null} />);
      expect(container.firstChild).toBeNull();
    });

    it('ローディング中はローディング表示をすること', () => {
      render(<DiagnosisPanel result={null} isLoading={true} />);
      expect(screen.getByTestId('diagnosis-panel-loading')).toBeInTheDocument();
      expect(screen.getByText('診断中...')).toBeInTheDocument();
    });

    it('結果がある場合は診断パネルを表示すること', () => {
      const result = createDiagnosisResult();
      render(<DiagnosisPanel result={result} />);
      expect(screen.getByTestId('diagnosis-panel')).toBeInTheDocument();
    });
  });

  describe('ステータス表示', () => {
    it('okステータスで正しい表示をすること', () => {
      const result = createDiagnosisResult({ status: 'ok' });
      render(<DiagnosisPanel result={result} />);
      expect(screen.getByText('問題なし')).toBeInTheDocument();
    });

    it('warningステータスで正しい表示をすること', () => {
      const result = createDiagnosisResult({
        status: 'warning',
        summary: '軽微な問題があります。',
      });
      render(<DiagnosisPanel result={result} />);
      expect(screen.getByText('警告')).toBeInTheDocument();
    });

    it('errorステータスで正しい表示をすること', () => {
      const result = createDiagnosisResult({
        status: 'error',
        summary: '重大な問題があります。',
      });
      render(<DiagnosisPanel result={result} />);
      expect(screen.getByText('エラー')).toBeInTheDocument();
    });
  });

  describe('展開/折りたたみ', () => {
    it('初期状態で折りたたまれていること', () => {
      const result = createDiagnosisResult();
      render(<DiagnosisPanel result={result} />);
      expect(screen.queryByTestId('supply-demand-section')).not.toBeInTheDocument();
    });

    it('ヘッダークリックで展開されること', () => {
      const result = createDiagnosisResult();
      render(<DiagnosisPanel result={result} />);

      fireEvent.click(screen.getByTestId('diagnosis-panel-header'));

      expect(screen.getByTestId('supply-demand-section')).toBeInTheDocument();
    });

    it('制御コンポーネントとして動作すること', () => {
      const result = createDiagnosisResult();
      const onToggle = vi.fn();
      render(
        <DiagnosisPanel result={result} isExpanded={true} onToggle={onToggle} />
      );

      expect(screen.getByTestId('supply-demand-section')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('diagnosis-panel-header'));
      expect(onToggle).toHaveBeenCalled();
    });
  });

  describe('需給バランス表示', () => {
    it('全体の需給バランスを表示すること', () => {
      const result = createDiagnosisResult();
      render(<DiagnosisPanel result={result} isExpanded={true} />);

      // 供給人日数と需要人日数を確認（複数の要素があるためgetAllByTextを使用）
      const supplyElements = screen.getAllByText('100');
      expect(supplyElements.length).toBeGreaterThan(0);

      const demandElements = screen.getAllByText('90');
      expect(demandElements.length).toBeGreaterThan(0);

      // +10は全体バランスと時間帯別バランスに複数存在
      const balanceElements = screen.getAllByText('+10');
      expect(balanceElements.length).toBeGreaterThan(0);
    });

    it('時間帯別バランステーブルを表示すること', () => {
      const result = createDiagnosisResult();
      render(<DiagnosisPanel result={result} isExpanded={true} />);

      expect(screen.getByTestId('timeslot-balance-table')).toBeInTheDocument();
      expect(screen.getByText('早番')).toBeInTheDocument();
      expect(screen.getByText('日勤')).toBeInTheDocument();
      expect(screen.getByText('遅番')).toBeInTheDocument();
    });

    it('不足時はマイナス表示をすること', () => {
      const result = createDiagnosisResult({
        supplyDemandBalance: {
          totalSupply: 80,
          totalDemand: 100,
          balance: -20,
          byTimeSlot: {
            早番: { supply: 20, demand: 30, balance: -10, fulfillmentRate: 67 },
          },
        },
      });
      render(<DiagnosisPanel result={result} isExpanded={true} />);

      expect(screen.getByText('-20')).toBeInTheDocument();
    });
  });

  describe('問題リスト表示', () => {
    it('問題がある場合に問題リストを表示すること', () => {
      const result = createDiagnosisResult({
        issues: [
          {
            id: 'issue-1',
            severity: 'high',
            category: 'supply',
            title: '総人員数が不足',
            description: '供給人日数が需要に対して不足しています。',
          },
        ],
      });
      render(<DiagnosisPanel result={result} isExpanded={true} />);

      expect(screen.getByTestId('issues-section')).toBeInTheDocument();
      expect(screen.getByText('検出された問題 (1件)')).toBeInTheDocument();
      expect(screen.getByText('総人員数が不足')).toBeInTheDocument();
    });

    it('問題が重要度順にソートされていること', () => {
      const result = createDiagnosisResult({
        issues: [
          {
            id: 'issue-low',
            severity: 'low',
            category: 'other',
            title: '低重要度',
            description: '',
          },
          {
            id: 'issue-high',
            severity: 'high',
            category: 'supply',
            title: '高重要度',
            description: '',
          },
          {
            id: 'issue-medium',
            severity: 'medium',
            category: 'timeSlot',
            title: '中重要度',
            description: '',
          },
        ],
      });
      render(<DiagnosisPanel result={result} isExpanded={true} />);

      const issueItems = screen.getAllByTestId(/^issue-item-/);
      // 高 -> 中 -> 低 の順
      expect(issueItems[0]).toHaveTextContent('高重要度');
      expect(issueItems[1]).toHaveTextContent('中重要度');
      expect(issueItems[2]).toHaveTextContent('低重要度');
    });

    it('影響を受けるスタッフを表示すること', () => {
      const result = createDiagnosisResult({
        issues: [
          {
            id: 'issue-1',
            severity: 'high',
            category: 'timeSlot',
            title: 'テスト問題',
            description: '',
            affectedStaff: ['田中', '佐藤'],
          },
        ],
      });
      render(<DiagnosisPanel result={result} isExpanded={true} />);

      expect(screen.getByText('対象: 田中、佐藤')).toBeInTheDocument();
    });
  });

  describe('改善提案表示', () => {
    it('提案がある場合に改善提案を表示すること', () => {
      const result = createDiagnosisResult({
        suggestions: [
          {
            priority: 'high',
            action: 'スタッフを追加してください',
            impact: '人員不足が解消されます',
          },
        ],
      });
      render(<DiagnosisPanel result={result} isExpanded={true} />);

      expect(screen.getByTestId('suggestions-section')).toBeInTheDocument();
      expect(screen.getByText('改善提案 (1件)')).toBeInTheDocument();
      expect(screen.getByText('スタッフを追加してください')).toBeInTheDocument();
    });

    it('対象スタッフを表示すること', () => {
      const result = createDiagnosisResult({
        suggestions: [
          {
            priority: 'high',
            action: '時間帯設定を変更',
            impact: '柔軟性が向上',
            targetStaff: '山田花子',
          },
        ],
      });
      render(<DiagnosisPanel result={result} isExpanded={true} />);

      expect(screen.getByText('対象: 山田花子')).toBeInTheDocument();
    });
  });

  describe('更新ボタン', () => {
    it('onRefreshが渡された場合に更新ボタンを表示すること', () => {
      const result = createDiagnosisResult();
      const onRefresh = vi.fn();
      render(<DiagnosisPanel result={result} onRefresh={onRefresh} />);

      expect(screen.getByTestId('diagnosis-refresh-button')).toBeInTheDocument();
    });

    it('更新ボタンクリックでonRefreshが呼ばれること', () => {
      const result = createDiagnosisResult();
      const onRefresh = vi.fn();
      render(<DiagnosisPanel result={result} onRefresh={onRefresh} />);

      fireEvent.click(screen.getByTestId('diagnosis-refresh-button'));
      expect(onRefresh).toHaveBeenCalled();
    });

    it('onRefreshがない場合は更新ボタンを表示しないこと', () => {
      const result = createDiagnosisResult();
      render(<DiagnosisPanel result={result} />);

      expect(
        screen.queryByTestId('diagnosis-refresh-button')
      ).not.toBeInTheDocument();
    });
  });

  describe('警告メッセージ', () => {
    it('warningステータスで実行可能メッセージを表示すること', () => {
      const result = createDiagnosisResult({ status: 'warning' });
      render(<DiagnosisPanel result={result} isExpanded={true} />);

      expect(
        screen.getByText('※ 警告があってもシフト生成は実行可能です。')
      ).toBeInTheDocument();
    });

    it('okステータスでは実行可能メッセージを表示しないこと', () => {
      const result = createDiagnosisResult({ status: 'ok' });
      render(<DiagnosisPanel result={result} isExpanded={true} />);

      expect(
        screen.queryByText('※ 警告があってもシフト生成は実行可能です。')
      ).not.toBeInTheDocument();
    });
  });

  describe('アクセシビリティ', () => {
    it('ヘッダーがキーボードで操作可能なこと', () => {
      const result = createDiagnosisResult();
      render(<DiagnosisPanel result={result} />);

      const header = screen.getByTestId('diagnosis-panel-header');

      // Enterキーで展開
      fireEvent.keyDown(header, { key: 'Enter' });
      expect(screen.getByTestId('supply-demand-section')).toBeInTheDocument();

      // Spaceキーで折りたたみ
      fireEvent.keyDown(header, { key: ' ' });
      expect(
        screen.queryByTestId('supply-demand-section')
      ).not.toBeInTheDocument();
    });

    it('aria-expanded属性が正しく設定されること', () => {
      const result = createDiagnosisResult();
      render(<DiagnosisPanel result={result} />);

      const header = screen.getByTestId('diagnosis-panel-header');
      expect(header).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(header);
      expect(header).toHaveAttribute('aria-expanded', 'true');
    });
  });
});
