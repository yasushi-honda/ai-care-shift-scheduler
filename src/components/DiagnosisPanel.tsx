/**
 * DiagnosisPanel - データ設定診断パネル
 * Phase 55: データ設定診断機能
 *
 * シフト生成前にデータ設定の問題を検出し、
 * ユーザーにフィードバックを表示するコンポーネント
 */

import React, { useState } from 'react';
import type {
  DiagnosisResult,
  DiagnosisStatus,
  DiagnosisIssue,
  DiagnosisSuggestion,
  IssueSeverity,
  SuggestionPriority,
  SupplyDemandBalance,
  TimeSlotBalance,
} from '../types/diagnosis';

/**
 * ステータス別UI設定
 */
const STATUS_UI_CONFIG: Record<
  DiagnosisStatus,
  {
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    icon: string;
  }
> = {
  ok: {
    label: '問題なし',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-500',
    icon: '✓',
  },
  warning: {
    label: '警告',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-500',
    icon: '⚠',
  },
  error: {
    label: 'エラー',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-500',
    icon: '✕',
  },
};

/**
 * 重要度別UI設定
 */
const SEVERITY_UI_CONFIG: Record<
  IssueSeverity,
  {
    color: string;
    bgColor: string;
    icon: string;
  }
> = {
  high: {
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    icon: '🔴',
  },
  medium: {
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
    icon: '🟡',
  },
  low: {
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    icon: '🔵',
  },
};

/**
 * 優先度別UI設定
 */
const PRIORITY_UI_CONFIG: Record<
  SuggestionPriority,
  {
    stars: string;
    color: string;
  }
> = {
  high: {
    stars: '★★★',
    color: 'text-red-600',
  },
  medium: {
    stars: '★★☆',
    color: 'text-yellow-600',
  },
  low: {
    stars: '★☆☆',
    color: 'text-gray-600',
  },
};

interface DiagnosisPanelProps {
  /** 診断結果 */
  result: DiagnosisResult | null;
  /** 診断中かどうか */
  isLoading?: boolean;
  /** 展開状態（制御コンポーネント用） */
  isExpanded?: boolean;
  /** 展開トグル時のコールバック */
  onToggle?: () => void;
  /** 更新ボタンクリック時のコールバック */
  onRefresh?: () => void;
  /** 追加のクラス名 */
  className?: string;
}

/**
 * データ設定診断パネルコンポーネント
 */
export function DiagnosisPanel({
  result,
  isLoading = false,
  isExpanded: controlledExpanded,
  onToggle,
  onRefresh,
  className = '',
}: DiagnosisPanelProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);

  // 制御コンポーネントと非制御コンポーネントの両方をサポート
  const isExpanded = controlledExpanded ?? internalExpanded;

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    } else {
      setInternalExpanded(!internalExpanded);
    }
  };

  // ローディング中の表示
  if (isLoading) {
    return (
      <div
        className={`bg-gray-50 border border-gray-200 rounded-lg p-4 ${className}`}
        data-testid="diagnosis-panel-loading"
      >
        <div className="flex items-center gap-2 text-gray-600">
          <svg
            className="animate-spin h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>診断中...</span>
        </div>
      </div>
    );
  }

  // 結果がない場合は非表示
  if (!result) {
    return null;
  }

  const { status, summary, supplyDemandBalance, issues, suggestions } = result;
  const statusConfig = STATUS_UI_CONFIG[status];

  return (
    <div
      className={`${statusConfig.bgColor} border ${statusConfig.borderColor} rounded-lg overflow-hidden ${className}`}
      data-testid="diagnosis-panel"
    >
      {/* サマリーヘッダー（常に表示） */}
      <div
        className="p-4 cursor-pointer flex items-center justify-between"
        onClick={handleToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleToggle();
          }
        }}
        aria-expanded={isExpanded}
        aria-label={`診断結果: ${statusConfig.label}`}
        data-testid="diagnosis-panel-header"
      >
        <div className="flex items-center gap-3">
          <span
            className={`text-xl ${statusConfig.color}`}
            aria-hidden="true"
          >
            {statusConfig.icon}
          </span>
          <div>
            <div className={`font-medium ${statusConfig.color}`}>
              {statusConfig.label}
            </div>
            <div className="text-sm text-gray-600">{summary}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRefresh();
              }}
              className="p-1 hover:bg-white/50 rounded-sm"
              aria-label="診断を再実行"
              data-testid="diagnosis-refresh-button"
            >
              <svg
                className="h-4 w-4 text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          )}
          <svg
            className={`h-5 w-5 text-gray-500 transform transition-transform ${
              isExpanded ? 'rotate-180' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>

      {/* 詳細コンテンツ（展開時のみ表示） */}
      {isExpanded && (
        <div className="border-t border-gray-200 bg-white p-4 space-y-4 max-h-96 overflow-y-auto">
          {/* 警告あっても実行可能メッセージ */}
          {status === 'warning' && (
            <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded-sm">
              ※ 警告があってもシフト生成は実行可能です。
            </div>
          )}

          {/* 需給バランスセクション */}
          <SupplyDemandSection balance={supplyDemandBalance} />

          {/* 問題リストセクション */}
          {issues.length > 0 && <IssuesSection issues={issues} />}

          {/* 改善提案セクション */}
          {suggestions.length > 0 && (
            <SuggestionsSection suggestions={suggestions} />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 需給バランスセクション
 */
function SupplyDemandSection({ balance }: { balance: SupplyDemandBalance }) {
  const { totalSupply, totalDemand, balance: diff, byTimeSlot } = balance;
  const isShortage = diff < 0;

  return (
    <div data-testid="supply-demand-section">
      <h4 className="font-medium text-gray-700 mb-2">需給バランス</h4>

      {/* 全体バランス */}
      <div className="bg-gray-50 rounded-sm p-3 mb-3">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-sm text-gray-500">供給人日数</div>
            <div className="text-lg font-medium text-gray-900">
              {totalSupply}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500">需要人日数</div>
            <div className="text-lg font-medium text-gray-900">
              {totalDemand}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500">過不足</div>
            <div
              className={`text-lg font-medium ${
                isShortage ? 'text-red-600' : 'text-green-600'
              }`}
            >
              {diff > 0 ? '+' : ''}
              {diff}
            </div>
          </div>
        </div>
      </div>

      {/* 時間帯別バランス */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="timeslot-balance-table">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="pb-2">時間帯</th>
              <th className="pb-2 text-right">供給</th>
              <th className="pb-2 text-right">需要</th>
              <th className="pb-2 text-right">過不足</th>
              <th className="pb-2 w-24">充足率</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(byTimeSlot).map(([slotName, slotBalance]) => {
              return (
                <TimeSlotRow
                  key={slotName}
                  slotName={slotName}
                  balance={slotBalance}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface TimeSlotRowProps {
  slotName: string;
  balance: TimeSlotBalance;
}

/**
 * 時間帯別バランス行
 */
const TimeSlotRow: React.FC<TimeSlotRowProps> = ({ slotName, balance }) => {
  const { supply, demand, balance: diff, fulfillmentRate } = balance;
  const isShortage = diff < 0;
  const isCritical = fulfillmentRate < 80;

  return (
    <tr className={`border-b ${isCritical ? 'bg-red-50' : ''}`}>
      <td className="py-2">{slotName}</td>
      <td className="py-2 text-right">{supply}</td>
      <td className="py-2 text-right">{demand}</td>
      <td
        className={`py-2 text-right ${
          isShortage ? 'text-red-600 font-medium' : 'text-green-600'
        }`}
      >
        {diff > 0 ? '+' : ''}
        {diff}
      </td>
      <td className="py-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                fulfillmentRate >= 100
                  ? 'bg-green-500'
                  : fulfillmentRate >= 80
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(fulfillmentRate, 100)}%` }}
            />
          </div>
          <span
            className={`text-xs ${isCritical ? 'text-red-600' : 'text-gray-600'}`}
          >
            {fulfillmentRate}%
          </span>
        </div>
      </td>
    </tr>
  );
}

/**
 * 問題リストセクション
 */
function IssuesSection({ issues }: { issues: DiagnosisIssue[] }) {
  // 重要度順にソート
  const sortedIssues = [...issues].sort((a, b) => {
    const order: Record<IssueSeverity, number> = { high: 0, medium: 1, low: 2 };
    return order[a.severity] - order[b.severity];
  });

  return (
    <div data-testid="issues-section">
      <h4 className="font-medium text-gray-700 mb-2">
        検出された問題 ({issues.length}件)
      </h4>
      <div className="space-y-2">
        {sortedIssues.map((issue) => (
          <IssueItem key={issue.id} issue={issue} />
        ))}
      </div>
    </div>
  );
}

interface IssueItemProps {
  issue: DiagnosisIssue;
}

/**
 * 問題アイテム
 */
const IssueItem: React.FC<IssueItemProps> = ({ issue }) => {
  const config = SEVERITY_UI_CONFIG[issue.severity];

  return (
    <div
      className={`${config.bgColor} rounded-sm p-3`}
      data-testid={`issue-item-${issue.id}`}
    >
      <div className="flex items-start gap-2">
        <span className="text-sm" aria-hidden="true">
          {config.icon}
        </span>
        <div className="flex-1">
          <div className={`font-medium ${config.color}`}>{issue.title}</div>
          <div className="text-sm text-gray-600 mt-1">{issue.description}</div>
          {issue.affectedStaff && issue.affectedStaff.length > 0 && (
            <div className="text-xs text-gray-500 mt-1">
              対象: {issue.affectedStaff.join('、')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 改善提案セクション
 */
function SuggestionsSection({
  suggestions,
}: {
  suggestions: DiagnosisSuggestion[];
}) {
  return (
    <div data-testid="suggestions-section">
      <h4 className="font-medium text-gray-700 mb-2">
        改善提案 ({suggestions.length}件)
      </h4>
      <div className="space-y-2">
        {suggestions.map((suggestion, index) => (
          <SuggestionItem key={index} suggestion={suggestion} />
        ))}
      </div>
    </div>
  );
}

interface SuggestionItemProps {
  suggestion: DiagnosisSuggestion;
}

/**
 * 提案アイテム
 */
const SuggestionItem: React.FC<SuggestionItemProps> = ({ suggestion }) => {
  const config = PRIORITY_UI_CONFIG[suggestion.priority];

  return (
    <div
      className="bg-gray-50 rounded-sm p-3"
      data-testid={`suggestion-item-${suggestion.priority}`}
    >
      <div className="flex items-start gap-2">
        <span className={`text-sm ${config.color}`} aria-hidden="true">
          {config.stars}
        </span>
        <div className="flex-1">
          <div className="font-medium text-gray-800">{suggestion.action}</div>
          <div className="text-sm text-gray-600 mt-1">{suggestion.impact}</div>
          {suggestion.targetStaff && (
            <div className="text-xs text-gray-500 mt-1">
              対象: {suggestion.targetStaff}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DiagnosisPanel;
