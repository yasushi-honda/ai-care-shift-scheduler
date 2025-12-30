/**
 * 診断機能の型定義テスト
 * Phase 55: データ設定診断機能
 *
 * TDD RED: 型定義が正しく動作することを検証
 */

import { describe, it, expect } from 'vitest';
import {
  DiagnosisStatus,
  DiagnosisResult,
  SupplyDemandBalance,
  TimeSlotBalance,
  DiagnosisIssue,
  DiagnosisSuggestion,
  RootCauseAnalysis,
  RootCause,
} from '../../src/diagnosis/types';

describe('診断機能の型定義', () => {
  describe('DiagnosisStatus', () => {
    it('3つの状態値を持つこと', () => {
      const statuses: DiagnosisStatus[] = ['ok', 'warning', 'error'];
      expect(statuses).toHaveLength(3);
    });
  });

  describe('DiagnosisResult', () => {
    it('正常状態の診断結果を作成できること', () => {
      const result: DiagnosisResult = {
        status: 'ok',
        summary: 'データ設定に問題はありません',
        supplyDemandBalance: {
          totalSupply: 200,
          totalDemand: 180,
          balance: 20,
          byTimeSlot: {},
        },
        issues: [],
        suggestions: [],
        executedAt: '2025-12-30T12:00:00Z',
      };

      expect(result.status).toBe('ok');
      expect(result.issues).toHaveLength(0);
      expect(result.supplyDemandBalance.balance).toBeGreaterThan(0);
    });

    it('警告状態の診断結果を作成できること', () => {
      const result: DiagnosisResult = {
        status: 'warning',
        summary: '早番・遅番の人員が不足する可能性があります',
        supplyDemandBalance: {
          totalSupply: 180,
          totalDemand: 200,
          balance: -20,
          byTimeSlot: {
            '早番': { supply: 45, demand: 60, balance: -15, fulfillmentRate: 75 },
            '日勤': { supply: 90, demand: 60, balance: 30, fulfillmentRate: 150 },
            '遅番': { supply: 45, demand: 60, balance: -15, fulfillmentRate: 75 },
          },
        },
        issues: [
          {
            id: 'issue-1',
            severity: 'high',
            category: 'timeSlot',
            title: '「日勤のみ」スタッフが日勤枠を占有',
            description: '田中太郎、山田花子の2名が「日勤のみ」設定で日勤必要数の70%を消費',
            affectedStaff: ['田中太郎', '山田花子'],
          },
        ],
        suggestions: [
          {
            priority: 'high',
            action: '山田花子の時間帯設定を「いつでも可」に変更',
            impact: '早番・遅番の柔軟性が向上します',
            targetStaff: '山田花子',
          },
        ],
        executedAt: '2025-12-30T12:00:00Z',
      };

      expect(result.status).toBe('warning');
      expect(result.issues).toHaveLength(1);
      expect(result.suggestions).toHaveLength(1);
      expect(result.supplyDemandBalance.balance).toBeLessThan(0);
    });

    it('エラー状態の診断結果を作成できること', () => {
      const result: DiagnosisResult = {
        status: 'error',
        summary: 'スタッフの勤務日数が大幅に不足しています',
        supplyDemandBalance: {
          totalSupply: 100,
          totalDemand: 200,
          balance: -100,
          byTimeSlot: {},
        },
        issues: [
          {
            id: 'issue-1',
            severity: 'high',
            category: 'supply',
            title: '総人員数が不足',
            description: '総供給人日数100に対し、必要人日数200。100人日不足',
          },
        ],
        suggestions: [],
        executedAt: '2025-12-30T12:00:00Z',
      };

      expect(result.status).toBe('error');
      expect(result.supplyDemandBalance.balance).toBe(-100);
    });
  });

  describe('TimeSlotBalance', () => {
    it('時間帯別バランスを作成できること', () => {
      const balance: TimeSlotBalance = {
        supply: 45,
        demand: 60,
        balance: -15,
        fulfillmentRate: 75,
      };

      expect(balance.fulfillmentRate).toBe(75);
      expect(balance.balance).toBe(balance.supply - balance.demand);
    });
  });

  describe('DiagnosisIssue', () => {
    it('重要度が3段階あること', () => {
      const severities: DiagnosisIssue['severity'][] = ['high', 'medium', 'low'];
      expect(severities).toHaveLength(3);
    });

    it('カテゴリが4種類あること', () => {
      const categories: DiagnosisIssue['category'][] = ['supply', 'timeSlot', 'leave', 'other'];
      expect(categories).toHaveLength(4);
    });

    it('休暇集中問題を作成できること', () => {
      const issue: DiagnosisIssue = {
        id: 'leave-concentration-1',
        severity: 'medium',
        category: 'leave',
        title: '12/25に休暇申請が集中',
        description: '佐藤、鈴木、高橋の3名が休暇申請',
        affectedStaff: ['佐藤', '鈴木', '高橋'],
        affectedDates: ['2025-12-25'],
      };

      expect(issue.category).toBe('leave');
      expect(issue.affectedDates).toContain('2025-12-25');
    });

    it('設定画面へのリンクを含められること', () => {
      const issue: DiagnosisIssue = {
        id: 'issue-1',
        severity: 'high',
        category: 'timeSlot',
        title: '時間帯制約問題',
        description: '説明',
        settingsLink: '/settings/staff/123',
      };

      expect(issue.settingsLink).toBe('/settings/staff/123');
    });
  });

  describe('DiagnosisSuggestion', () => {
    it('優先度が3段階あること', () => {
      const priorities: DiagnosisSuggestion['priority'][] = ['high', 'medium', 'low'];
      expect(priorities).toHaveLength(3);
    });

    it('完全な改善提案を作成できること', () => {
      const suggestion: DiagnosisSuggestion = {
        priority: 'high',
        action: '早番・遅番対応可能なスタッフを1名追加',
        impact: '15人日の不足が解消されます',
        settingsLink: '/settings/staff/new',
      };

      expect(suggestion.priority).toBe('high');
      expect(suggestion.action).toContain('1名追加');
    });
  });

  describe('RootCauseAnalysis', () => {
    it('根本原因分析結果を作成できること', () => {
      const analysis: RootCauseAnalysis = {
        causes: [
          {
            id: 'cause-1',
            violationType: 'staffShortage',
            causeType: 'timeSlotConstraint',
            description: '「日勤のみ」スタッフが日勤枠を占有しているため、早番・遅番に配置可能なスタッフが不足',
            affectedStaff: ['田中太郎', '山田花子'],
            evidence: {
              required: 60,
              available: 45,
              shortage: 15,
            },
          },
        ],
        aiCommentAddition: '田中太郎、山田花子は「日勤のみ」設定のため早番・遅番に配置できません。',
      };

      expect(analysis.causes).toHaveLength(1);
      expect(analysis.causes[0].evidence?.shortage).toBe(15);
    });

    it('原因タイプが4種類あること', () => {
      const causeTypes: RootCause['causeType'][] = [
        'staffShortage',
        'timeSlotConstraint',
        'leaveConflict',
        'other',
      ];
      expect(causeTypes).toHaveLength(4);
    });
  });
});
