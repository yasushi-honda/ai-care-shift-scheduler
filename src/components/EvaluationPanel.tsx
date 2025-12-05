import React, { useState, useEffect, useRef } from 'react';
import type { AIEvaluationResult, ConstraintViolation, Recommendation, SimulationResult } from '../../types';

// 自動展開のしきい値定数
const AUTO_EXPAND_SCORE_THRESHOLD = 60;
const AUTO_EXPAND_ERROR_THRESHOLD = 5;

// 警告レベル
type WarningLevel = 'critical' | 'severe' | 'warning' | 'none';

function getWarningLevel(score: number): WarningLevel {
  if (score === 0) return 'critical';
  if (score <= 30) return 'severe';
  if (score < 60) return 'warning';
  return 'none';
}

// 警告メッセージ設定
const WARNING_MESSAGES: Record<WarningLevel, { title: string; message: string; bgColor: string; borderColor: string; textColor: string; icon: string } | null> = {
  critical: {
    title: 'この要件では実現不可能です',
    message: '人員数が不足しているか、制約が厳しすぎるため、すべての条件を満たすシフトを作成できません。スタッフの追加または要件の緩和を検討してください。',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-500',
    textColor: 'text-red-800',
    icon: '🚫',
  },
  severe: {
    title: '重大な制約違反があります',
    message: '多数の制約違反が発生しています。このままでは運用に支障をきたす可能性があります。手動での調整が必要です。',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-500',
    textColor: 'text-orange-800',
    icon: '⚠️',
  },
  warning: {
    title: '複数の問題があります',
    message: 'いくつかの制約違反が検出されました。詳細を確認し、必要に応じて調整してください。',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-500',
    textColor: 'text-yellow-800',
    icon: '⚡',
  },
  none: null,
};

interface EvaluationPanelProps {
  evaluation: AIEvaluationResult | null;
  isExpanded?: boolean;
  onToggle?: () => void;
}

/**
 * Phase 40: AI評価・フィードバックパネル
 *
 * シフト生成結果の評価情報を表示するコンポーネント
 * - 総合スコア・充足率
 * - 制約違反リスト
 * - 改善提案
 * - シミュレーション結果
 */
export function EvaluationPanel({
  evaluation,
  isExpanded: controlledExpanded,
  onToggle,
}: EvaluationPanelProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const hasAutoExpandedRef = useRef(false);

  // 制御コンポーネントと非制御コンポーネントの両方をサポート
  const isExpanded = controlledExpanded ?? internalExpanded;

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    } else {
      setInternalExpanded(!internalExpanded);
    }
  };

  // 違反の重要度別カウント（早期計算）
  const errorCount = evaluation?.constraintViolations?.filter(v => v.severity === 'error').length || 0;
  const warningCount = evaluation?.constraintViolations?.filter(v => v.severity === 'warning').length || 0;

  // 自動展開の判定（初回のみ）
  useEffect(() => {
    if (!evaluation || hasAutoExpandedRef.current || controlledExpanded !== undefined) {
      return;
    }

    const shouldAutoExpand =
      evaluation.overallScore < AUTO_EXPAND_SCORE_THRESHOLD ||
      errorCount >= AUTO_EXPAND_ERROR_THRESHOLD;

    if (shouldAutoExpand) {
      setInternalExpanded(true);
      hasAutoExpandedRef.current = true;
    }
  }, [evaluation, errorCount, controlledExpanded]);

  if (!evaluation) {
    return null;
  }

  const { overallScore, fulfillmentRate, constraintViolations, recommendations, simulation, aiComment } = evaluation;

  // スコアが-1の場合は評価失敗
  const isEvaluationFailed = overallScore < 0;

  // 警告レベルを取得
  const warningLevel = isEvaluationFailed ? 'none' : getWarningLevel(overallScore);
  const warningConfig = WARNING_MESSAGES[warningLevel];

  return (
    <div className="space-y-3">
      {/* 警告メッセージ（低スコア時に表示） */}
      {warningConfig && (
        <div
          className={`${warningConfig.bgColor} border-l-4 ${warningConfig.borderColor} p-4 rounded-r-lg`}
          role="alert"
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">{warningConfig.icon}</span>
            <div>
              <h3 className={`font-bold ${warningConfig.textColor}`}>
                {warningConfig.title}
              </h3>
              <p className={`mt-1 text-sm ${warningConfig.textColor} opacity-90`}>
                {warningConfig.message}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        {/* ヘッダー（常に表示） */}
      <button
        onClick={handleToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors duration-200 rounded-t-lg"
        aria-expanded={isExpanded}
        aria-controls="evaluation-content"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-gray-800">AI評価</span>

          {isEvaluationFailed ? (
            <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded">
              評価不可
            </span>
          ) : (
            <>
              <ScoreBadge score={overallScore} />
              {errorCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                  エラー {errorCount}
                </span>
              )}
              {warningCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">
                  警告 {warningCount}
                </span>
              )}
            </>
          )}
        </div>

        <svg
          className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* AIコメント（展開状態に関わらず常に表示） */}
      {aiComment && !isEvaluationFailed && (
        <AICommentSection comment={aiComment} />
      )}

      {/* 展開コンテンツ */}
      <div
        id="evaluation-content"
        className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div className="px-4 pb-4 border-t border-gray-100">
          {isEvaluationFailed ? (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-gray-600">評価データの生成に失敗しました。手動でシフトを確認してください。</p>
            </div>
          ) : (
            <>
              {/* サマリー */}
              <SummarySection
                overallScore={overallScore}
                fulfillmentRate={fulfillmentRate}
                errorCount={errorCount}
                warningCount={warningCount}
              />

              {/* 制約違反リスト */}
              {constraintViolations && constraintViolations.length > 0 && (
                <ViolationsSection violations={constraintViolations} />
              )}

              {/* 改善提案 */}
              {recommendations && recommendations.length > 0 && (
                <RecommendationsSection recommendations={recommendations} />
              )}

              {/* シミュレーション結果 */}
              {simulation && (
                <SimulationSection simulation={simulation} />
              )}
            </>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

/**
 * スコアバッジ
 */
function ScoreBadge({ score }: { score: number }) {
  let bgColor = 'bg-green-100';
  let textColor = 'text-green-700';

  if (score < 60) {
    bgColor = 'bg-red-100';
    textColor = 'text-red-700';
  } else if (score < 80) {
    bgColor = 'bg-yellow-100';
    textColor = 'text-yellow-700';
  }

  return (
    <span className={`px-2 py-1 text-sm font-bold ${bgColor} ${textColor} rounded`}>
      {score}点
    </span>
  );
}

/**
 * サマリーセクション
 */
function SummarySection({
  overallScore,
  fulfillmentRate,
  errorCount,
  warningCount,
}: {
  overallScore: number;
  fulfillmentRate: number;
  errorCount: number;
  warningCount: number;
}) {
  return (
    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* 総合スコア */}
      <div className="bg-gray-50 rounded-lg p-3 text-center">
        <div className="text-xs text-gray-500 mb-1">総合スコア</div>
        <div className="text-2xl font-bold text-gray-800">{overallScore}<span className="text-sm font-normal">/100</span></div>
        <ScoreBar score={overallScore} />
      </div>

      {/* 充足率 */}
      <div className="bg-gray-50 rounded-lg p-3 text-center">
        <div className="text-xs text-gray-500 mb-1">人員充足率</div>
        <div className="text-2xl font-bold text-gray-800">{fulfillmentRate.toFixed(0)}<span className="text-sm font-normal">%</span></div>
        <ScoreBar score={fulfillmentRate} />
      </div>

      {/* エラー件数 */}
      <div className="bg-gray-50 rounded-lg p-3 text-center">
        <div className="text-xs text-gray-500 mb-1">エラー</div>
        <div className={`text-2xl font-bold ${errorCount > 0 ? 'text-red-600' : 'text-gray-800'}`}>
          {errorCount}<span className="text-sm font-normal">件</span>
        </div>
      </div>

      {/* 警告件数 */}
      <div className="bg-gray-50 rounded-lg p-3 text-center">
        <div className="text-xs text-gray-500 mb-1">警告</div>
        <div className={`text-2xl font-bold ${warningCount > 0 ? 'text-yellow-600' : 'text-gray-800'}`}>
          {warningCount}<span className="text-sm font-normal">件</span>
        </div>
      </div>
    </div>
  );
}

/**
 * スコアバー（プログレスバー）
 */
function ScoreBar({ score }: { score: number }) {
  let barColor = 'bg-green-500';
  if (score < 60) {
    barColor = 'bg-red-500';
  } else if (score < 80) {
    barColor = 'bg-yellow-500';
  }

  return (
    <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
      <div
        className={`h-full ${barColor} transition-all duration-500`}
        style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
      />
    </div>
  );
}

/**
 * 制約違反セクション
 */
function ViolationsSection({ violations }: { violations: ConstraintViolation[] }) {
  const [showAll, setShowAll] = useState(false);
  const displayViolations = showAll ? violations : violations.slice(0, 3);

  // 違反タイプの日本語ラベル
  const violationTypeLabels: Record<string, string> = {
    staffShortage: '人員不足',
    consecutiveWork: '連続勤務超過',
    nightRestViolation: '夜勤後休息不足',
    qualificationMissing: '必要資格不足',
    leaveRequestIgnored: '休暇申請無視',
  };

  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
        <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        制約違反 ({violations.length}件)
      </h4>

      <ul className="space-y-2">
        {displayViolations.map((violation, index) => (
          <li
            key={index}
            className={`p-3 rounded-lg border-l-4 ${
              violation.severity === 'error'
                ? 'bg-red-50 border-red-500'
                : 'bg-yellow-50 border-yellow-500'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                  violation.severity === 'error'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {violationTypeLabels[violation.type] || violation.type}
                </span>
                <p className="mt-1 text-sm text-gray-700">{violation.description}</p>
              </div>
            </div>

            {/* 影響スタッフ・日付 */}
            {(violation.affectedStaff?.length || violation.affectedDates?.length) && (
              <div className="mt-2 text-xs text-gray-500">
                {violation.affectedStaff?.length ? (
                  <span className="mr-3">対象: {violation.affectedStaff.join(', ')}</span>
                ) : null}
                {violation.affectedDates?.length ? (
                  <span>日付: {violation.affectedDates.slice(0, 3).join(', ')}{violation.affectedDates.length > 3 ? `他${violation.affectedDates.length - 3}日` : ''}</span>
                ) : null}
              </div>
            )}

            {/* 提案 */}
            {violation.suggestion && (
              <p className="mt-2 text-xs text-blue-600 bg-blue-50 p-2 rounded">
                💡 {violation.suggestion}
              </p>
            )}
          </li>
        ))}
      </ul>

      {violations.length > 3 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-2 text-sm text-blue-600 hover:text-blue-700"
        >
          {showAll ? '閉じる' : `他 ${violations.length - 3} 件を表示`}
        </button>
      )}
    </div>
  );
}

/**
 * 改善提案セクション
 */
function RecommendationsSection({ recommendations }: { recommendations: Recommendation[] }) {
  // 優先度順にソート
  const sortedRecommendations = [...recommendations].sort((a, b) => {
    const priority: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return priority[a.priority] - priority[b.priority];
  });

  const priorityStyles: Record<string, { bg: string; text: string; icon: string }> = {
    high: { bg: 'bg-red-50', text: 'text-red-700', icon: '🔴' },
    medium: { bg: 'bg-yellow-50', text: 'text-yellow-700', icon: '🟡' },
    low: { bg: 'bg-blue-50', text: 'text-blue-700', icon: '🔵' },
  };

  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        改善提案 ({recommendations.length}件)
      </h4>

      <ul className="space-y-2">
        {sortedRecommendations.map((rec, index) => {
          const style = priorityStyles[rec.priority] || priorityStyles.low;
          return (
            <li key={index} className={`p-3 rounded-lg ${style.bg}`}>
              <div className="flex items-start gap-2">
                <span>{style.icon}</span>
                <div className="flex-1">
                  <span className={`text-xs font-medium ${style.text}`}>{rec.category}</span>
                  <p className="text-sm text-gray-700 mt-1">{rec.description}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    <span className="font-medium">アクション:</span> {rec.action}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * シミュレーションセクション
 */
function SimulationSection({ simulation }: { simulation: SimulationResult }) {
  const workloadStyles: Record<string, { text: string; icon: string }> = {
    good: { text: '良好', icon: '✅' },
    fair: { text: '普通', icon: '➖' },
    poor: { text: '要改善', icon: '⚠️' },
  };

  const workloadStyle = workloadStyles[simulation.workloadBalance] || workloadStyles.fair;

  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
        <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        シミュレーション結果
      </h4>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {/* 推定残業時間 */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs text-gray-500">推定残業時間</div>
          <div className="text-lg font-semibold text-gray-800">
            {simulation.estimatedOvertimeHours}<span className="text-sm font-normal">時間</span>
          </div>
        </div>

        {/* 負荷バランス */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs text-gray-500">負荷バランス</div>
          <div className="text-lg font-semibold text-gray-800">
            {workloadStyle.icon} {workloadStyle.text}
          </div>
        </div>

        {/* 有休消化率 */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs text-gray-500">有休消化率</div>
          <div className="text-lg font-semibold text-gray-800">
            {(simulation.paidLeaveUsageRate * 100).toFixed(0)}<span className="text-sm font-normal">%</span>
          </div>
        </div>
      </div>

      {/* リスク */}
      {simulation.risks && simulation.risks.length > 0 && (
        <div className="mt-3 p-3 bg-orange-50 rounded-lg">
          <div className="text-xs font-medium text-orange-700 mb-1">リスク</div>
          <ul className="text-sm text-orange-800 list-disc list-inside space-y-1">
            {simulation.risks.map((risk, index) => (
              <li key={index}>{risk}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * AIコメントセクション
 * 展開状態に関わらず常に表示される総合コメント
 */
function AICommentSection({ comment }: { comment: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(comment);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // フォールバック: 古いブラウザ対応
      const textArea = document.createElement('textarea');
      textArea.value = comment;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="px-4 py-3 bg-blue-50 border-t border-blue-100">
      <div className="flex items-start gap-2">
        <span className="text-lg flex-shrink-0">💬</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs font-medium text-blue-700">AIコメント</span>
            <button
              onClick={handleCopy}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
              title="コメントをコピー"
            >
              {copied ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  コピー済み
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  コピー
                </>
              )}
            </button>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{comment}</p>
        </div>
      </div>
    </div>
  );
}

export default EvaluationPanel;
