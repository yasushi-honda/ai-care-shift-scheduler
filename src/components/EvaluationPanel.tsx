import React, { useState, useEffect, useRef } from 'react';
import type { AIEvaluationResult, ConstraintViolation, ConstraintLevel, Recommendation, SimulationResult } from '../../types';

// 自動展開のしきい値定数
const AUTO_EXPAND_SCORE_THRESHOLD = 60;
const AUTO_EXPAND_ERROR_THRESHOLD = 5;

// Phase 53: レベル別UI設定
const LEVEL_UI_CONFIG: Record<
  ConstraintLevel,
  {
    label: string;
    labelShort: string;
    color: string;
    bgColor: string;
    borderColor: string;
    icon: string;
  }
> = {
  1: {
    label: '絶対必須',
    labelShort: 'Lv1',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-500',
    icon: '🚫',
  },
  2: {
    label: '運営必須',
    labelShort: 'Lv2',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-500',
    icon: '⚠️',
  },
  3: {
    label: '努力目標',
    labelShort: 'Lv3',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-500',
    icon: '💡',
  },
  4: {
    label: '推奨',
    labelShort: 'Lv4',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-500',
    icon: 'ℹ️',
  },
};

// Phase 53: 制約タイプからデフォルトレベルへのマッピング
const CONSTRAINT_LEVEL_MAPPING: Record<string, ConstraintLevel> = {
  nightRestViolation: 1,
  staffShortage: 2,
  qualificationMissing: 2,
  consecutiveWork: 3,
  leaveRequestIgnored: 3,
};

// Phase 53: 違反のレベルを取得（level → type → severity の優先順）
function getViolationLevel(violation: ConstraintViolation): ConstraintLevel {
  if (violation.level !== undefined) {
    return violation.level;
  }
  if (violation.type && CONSTRAINT_LEVEL_MAPPING[violation.type]) {
    return CONSTRAINT_LEVEL_MAPPING[violation.type];
  }
  return violation.severity === 'error' ? 2 : 3;
}

// 警告レベル
type WarningLevel = 'critical' | 'severe' | 'warning' | 'none';

/**
 * Phase 53: レベルベースの警告レベル判定
 * - critical: レベル1違反がある場合のみ
 * - severe: レベル1なし + スコア30点以下
 * - warning: レベル1なし + スコア60点未満
 * - none: それ以外
 */
function getWarningLevel(score: number, violations: ConstraintViolation[]): WarningLevel {
  // レベル1違反があるかチェック
  const hasLevel1Violation = violations.some(v => {
    const level = getViolationLevel(v);
    return level === 1;
  });

  // レベル1違反がある場合のみ「実現不可能」
  if (hasLevel1Violation) return 'critical';

  // レベル1違反がない場合はスコアベース（ただしcriticalにはならない）
  if (score <= 30) return 'severe';
  if (score < 60) return 'warning';
  return 'none';
}

// 警告メッセージ設定
const WARNING_MESSAGES: Record<WarningLevel, { title: string; message: string; bgColor: string; borderColor: string; textColor: string; icon: string } | null> = {
  critical: {
    title: '実現不可能なシフトです',
    message: '労基法違反（夜勤後休息不足など）があるため、このシフトは使用できません。該当箇所を修正してください。',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-500',
    textColor: 'text-red-800',
    icon: '🚫',
  },
  severe: {
    title: '運営上の課題がありますが、手直しで対応可能です',
    message: '人員不足や資格要件の未充足など、運営に影響する問題があります。詳細を確認し、部分的に調整してください。',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-500',
    textColor: 'text-orange-800',
    icon: '⚠️',
  },
  warning: {
    title: '軽微な問題があります',
    message: '希望休の未反映や連勤超過など、努力目標の未達成があります。可能な範囲で調整を検討してください。',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-500',
    textColor: 'text-yellow-800',
    icon: '💡',
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

  const { overallScore, fulfillmentRate, constraintViolations, recommendations, simulation, aiComment, rootCauseAnalysis } = evaluation;

  // スコアが-1の場合は評価失敗
  const isEvaluationFailed = overallScore < 0;

  // 警告レベルを取得（Phase 53: レベルベース判定）
  const warningLevel = isEvaluationFailed ? 'none' : getWarningLevel(overallScore, constraintViolations || []);
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
      {isExpanded && (
      <div
        id="evaluation-content"
        className="transition-opacity duration-300 opacity-100"
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

              {/* Phase 55: 根本原因分析 */}
              {rootCauseAnalysis && rootCauseAnalysis.primaryCause && (
                <RootCauseSection rootCauseAnalysis={rootCauseAnalysis} />
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
      )}
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
 * 3階層グループ化: レベル → タイプ → シフト種別
 */
function ViolationsSection({ violations }: { violations: ConstraintViolation[] }) {
  // 違反タイプの日本語ラベル
  const violationTypeLabels: Record<string, string> = {
    staffShortage: '人員不足',
    consecutiveWork: '連続勤務超過',
    nightRestViolation: '夜勤後休息不足',
    qualificationMissing: '必要資格不足',
    leaveRequestIgnored: '休暇申請無視',
  };

  // シフト種別を抽出
  const extractShiftType = (description: string): string => {
    if (description.includes('早番')) return '早番';
    if (description.includes('遅番')) return '遅番';
    if (description.includes('夜勤')) return '夜勤';
    if (description.includes('日勤')) return '日勤';
    return 'その他';
  };

  // 日付を抽出してDate対象に変換
  const extractDate = (v: ConstraintViolation): string | null => {
    if (v.affectedDates?.length) return v.affectedDates[0];
    const match = v.description?.match(/(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : null;
  };

  // 日付をM/D（曜）形式で表示
  const formatDateWithDay = (dateStr: string): string => {
    const match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return dateStr;
    const date = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return `${parseInt(match[2])}/${parseInt(match[3])}(${days[date.getDay()]})`;
  };

  // 3階層グループ化: レベル → タイプ → シフト種別
  const groupedData = violations.reduce(
    (acc, v) => {
      const level = getViolationLevel(v);
      const type = v.type || 'other';
      const shiftType = extractShiftType(v.description || '');

      if (!acc[level]) acc[level] = {};
      if (!acc[level][type]) acc[level][type] = {};
      if (!acc[level][type][shiftType]) acc[level][type][shiftType] = [];
      acc[level][type][shiftType].push(v);
      return acc;
    },
    {} as Record<number, Record<string, Record<string, ConstraintViolation[]>>>
  );

  // 存在するレベルのみ（重要度順）
  const levels = [1, 2, 3, 4].filter(level => groupedData[level]);

  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        制約違反 ({violations.length}件)
      </h4>

      {/* レベル1がない場合のポジティブメッセージ */}
      {!groupedData[1] && (
        <div className="mb-3 text-xs px-3 py-2 rounded bg-green-50 text-green-700 border border-green-200">
          ✅ 労基法違反（絶対必須）はありません
        </div>
      )}

      {/* レベル別グループ表示 */}
      <div className="space-y-4">
        {levels.map((level) => {
          const config = LEVEL_UI_CONFIG[level as ConstraintLevel];
          const typeGroups = groupedData[level];
          const totalCount = Object.values(typeGroups).reduce(
            (sum, shiftGroups) => sum + Object.values(shiftGroups).reduce((s, arr) => s + arr.length, 0),
            0
          );

          return (
            <div key={level}>
              {/* レベルヘッダー */}
              <div className={`text-xs font-medium px-3 py-1.5 rounded-t ${config.bgColor} ${config.color}`}>
                {config.icon} {config.label}（{totalCount}件）
              </div>

              {/* タイプ別グループ */}
              <div className={`border-l-4 ${config.borderColor} bg-white rounded-b`}>
                {Object.entries(typeGroups).map(([type, shiftGroups], typeIndex) => {
                  const typeCount = Object.values(shiftGroups).reduce((s, arr) => s + arr.length, 0);
                  const isLastType = typeIndex === Object.keys(typeGroups).length - 1;

                  return (
                    <div key={type} className={`${!isLastType ? 'border-b border-gray-100' : ''}`}>
                      {/* タイプヘッダー */}
                      <div className="px-3 py-2 bg-gray-50 flex items-center gap-2">
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${config.bgColor} ${config.color}`}>
                          {violationTypeLabels[type] || type}
                        </span>
                        <span className="text-xs text-gray-500">{typeCount}件</span>
                      </div>

                      {/* シフト種別サブグループ */}
                      <div className="px-3 pb-2">
                        {Object.entries(shiftGroups).map(([shiftType, shiftViolations], shiftIndex) => {
                          // 日付を抽出してソート
                          const dates = shiftViolations
                            .map(v => extractDate(v))
                            .filter((d): d is string => d !== null)
                            .sort();
                          const uniqueDates = [...new Set(dates)];

                          // スタッフを抽出
                          const staff = [...new Set(
                            shiftViolations.flatMap(v => v.affectedStaff || [])
                          )];

                          // 提案（最初のものを使用）
                          const suggestion = shiftViolations[0]?.suggestion;

                          const isLastShift = shiftIndex === Object.keys(shiftGroups).length - 1;

                          return (
                            <div
                              key={shiftType}
                              className={`py-2 ${!isLastShift ? 'border-b border-gray-50' : ''}`}
                            >
                              {/* シフト種別 + 日付チップ */}
                              <div className="flex items-start gap-2">
                                <span className="text-xs font-medium text-gray-600 w-10 flex-shrink-0 pt-0.5">
                                  {shiftType}:
                                </span>
                                <div className="flex flex-wrap gap-1">
                                  {uniqueDates.map((d, i) => (
                                    <span
                                      key={i}
                                      className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded"
                                    >
                                      {formatDateWithDay(d)}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              {/* スタッフ（連勤超過など、人が関係する場合） */}
                              {staff.length > 0 && (
                                <div className="mt-1 ml-12 text-xs text-gray-500">
                                  対象: {staff.join(', ')}
                                </div>
                              )}

                              {/* 提案 */}
                              {suggestion && (
                                <div className="mt-1.5 ml-12">
                                  <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block">
                                    💡 {suggestion}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
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
            {simulation.paidLeaveUsageRate.toFixed(0)}<span className="text-sm font-normal">%</span>
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

/**
 * Phase 55: 根本原因分析セクション
 */
interface RootCause {
  category: string;
  description: string;
  impact: number;
  affectedStaff?: string[];
  affectedDates?: string[];
  metrics?: {
    required?: number;
    available?: number;
    shortage?: number;
  };
}

interface RootCauseAnalysis {
  primaryCause: RootCause | null;
  secondaryCauses: RootCause[];
  aiComment: string;
  analyzedAt: string;
}

const CATEGORY_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  staffShortage: { label: 'スタッフ不足', icon: '👥', color: 'text-red-600' },
  timeSlotConstraint: { label: '時間帯制約', icon: '⏰', color: 'text-orange-600' },
  leaveConcentration: { label: '休暇集中', icon: '📅', color: 'text-yellow-600' },
  qualificationMismatch: { label: '資格不足', icon: '📋', color: 'text-purple-600' },
  consecutiveWork: { label: '連勤制限', icon: '🔄', color: 'text-blue-600' },
};

function RootCauseSection({ rootCauseAnalysis }: { rootCauseAnalysis: RootCauseAnalysis }) {
  const { primaryCause, secondaryCauses } = rootCauseAnalysis;

  if (!primaryCause) return null;

  const primaryConfig = CATEGORY_LABELS[primaryCause.category] || {
    label: '不明',
    icon: '❓',
    color: 'text-gray-600',
  };

  return (
    <div className="mt-4" data-testid="root-cause-section">
      <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
        <svg
          className="w-4 h-4 text-indigo-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
        根本原因分析
      </h4>

      {/* 主要原因 */}
      <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100">
        <div className="flex items-start gap-3">
          <span className="text-2xl">{primaryConfig.icon}</span>
          <div className="flex-1">
            <div className={`font-medium ${primaryConfig.color}`}>
              {primaryConfig.label}
            </div>
            <p className="text-sm text-gray-700 mt-1">{primaryCause.description}</p>

            {/* 数値的根拠 */}
            {primaryCause.metrics && (
              <div className="mt-2 flex flex-wrap gap-2">
                {primaryCause.metrics.required !== undefined && (
                  <span className="text-xs bg-white px-2 py-1 rounded border">
                    必要: {primaryCause.metrics.required}人日
                  </span>
                )}
                {primaryCause.metrics.available !== undefined && (
                  <span className="text-xs bg-white px-2 py-1 rounded border">
                    利用可能: {primaryCause.metrics.available}人日
                  </span>
                )}
                {primaryCause.metrics.shortage !== undefined &&
                  primaryCause.metrics.shortage > 0 && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded border border-red-200">
                      不足: {primaryCause.metrics.shortage}人日
                    </span>
                  )}
              </div>
            )}

            {/* 影響スタッフ */}
            {primaryCause.affectedStaff && primaryCause.affectedStaff.length > 0 && (
              <div className="mt-2 text-xs text-gray-600">
                関連スタッフ:{' '}
                {primaryCause.affectedStaff.length <= 3
                  ? primaryCause.affectedStaff.join('、')
                  : `${primaryCause.affectedStaff.slice(0, 3).join('、')}他${primaryCause.affectedStaff.length - 3}名`}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 副次的原因 */}
      {secondaryCauses.length > 0 && (
        <div className="mt-3 space-y-2">
          <div className="text-xs font-medium text-gray-500">その他の要因</div>
          {secondaryCauses.slice(0, 2).map((cause, index) => {
            const config = CATEGORY_LABELS[cause.category] || {
              label: '不明',
              icon: '❓',
              color: 'text-gray-600',
            };
            return (
              <div
                key={index}
                className="bg-gray-50 rounded-lg p-3 border border-gray-100 flex items-start gap-2"
              >
                <span>{config.icon}</span>
                <div>
                  <span className={`text-sm font-medium ${config.color}`}>
                    {config.label}
                  </span>
                  <p className="text-xs text-gray-600 mt-0.5">{cause.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default EvaluationPanel;
