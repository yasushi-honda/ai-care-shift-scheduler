/**
 * Phase 56: コメント生成関数
 *
 * EvaluationServiceから抽出したコメント生成ロジック
 */

import {
  ConstraintViolation,
  Recommendation,
} from '../types';
import {
  getViolationLevel,
  generateLevelBasedComment,
  groupViolationsByLevel,
} from './constraintLevelMapping';
import { calculateOverallScore } from './scoreCalculators';

/**
 * AIコメントを生成
 *
 * スコアに応じて適切なコメントを生成する
 *
 * @param overallScore 総合スコア
 * @param fulfillmentRate 充足率
 * @param violations 制約違反リスト
 * @param recommendations 改善提案リスト
 * @returns AIコメント文字列
 */
export function generateAIComment(
  overallScore: number,
  fulfillmentRate: number,
  violations: ConstraintViolation[],
  recommendations: Recommendation[]
): string {
  // 違反をタイプ別にカウント
  const violationCounts: Record<string, number> = {};
  for (const v of violations) {
    violationCounts[v.type] = (violationCounts[v.type] || 0) + 1;
  }

  const errorCount = violations.filter(v => v.severity === 'error').length;
  const warningCount = violations.filter(v => v.severity === 'warning').length;

  // スコア別のコメント生成
  if (overallScore === 0) {
    return generateCriticalComment(violationCounts, fulfillmentRate, violations);
  } else if (overallScore <= 30) {
    return generateSevereComment(violationCounts, errorCount, warningCount);
  } else if (overallScore < 60) {
    return generateWarningComment(violationCounts, errorCount, warningCount);
  } else if (overallScore < 80) {
    return generateFairComment(violationCounts, warningCount, fulfillmentRate);
  } else {
    return generateGoodComment(fulfillmentRate, recommendations);
  }
}

/**
 * 重大なコメント（スコア0）を生成
 */
export function generateCriticalComment(
  violationCounts: Record<string, number>,
  fulfillmentRate: number,
  violations?: ConstraintViolation[]
): string {
  const mainIssues: string[] = [];

  if (violationCounts['staffShortage'] > 10) {
    mainIssues.push(`${violationCounts['staffShortage']}件の人員不足`);
  }
  if (violationCounts['qualificationMissing'] > 5) {
    mainIssues.push(`資格要件の未充足`);
  }

  const issueText = mainIssues.length > 0
    ? `主な問題: ${mainIssues.join('、')}。`
    : '';

  // Phase 44: シフト種別ごとの不足日数を分析
  let shiftDetailText = '';
  if (violations && violations.length > 0) {
    const shortageByShift: Record<string, number> = {};
    for (const v of violations) {
      if (v.type === 'staffShortage' && v.description) {
        // "2026-01-06の早番で1名の人員不足" のようなパターンを解析
        const match = v.description.match(/の(.+)で/);
        if (match) {
          const shiftName = match[1];
          shortageByShift[shiftName] = (shortageByShift[shiftName] || 0) + 1;
        }
      }
    }

    const shiftDetails = Object.entries(shortageByShift)
      .filter(([_, count]) => count > 0)
      .map(([shiftName, count]) => `${shiftName}${count}日`)
      .join('、');

    if (shiftDetails) {
      shiftDetailText = `【不足日数】${shiftDetails}。`;
    }
  }

  // Phase 53: レベル1違反（労基法違反）がある場合のメッセージ
  const hasLevel1 = violations?.some(v => {
    const level = getViolationLevel(v);
    return level === 1;
  }) ?? false;

  if (hasLevel1) {
    return `労基法違反（夜勤後休息不足など）があるため、このシフトは使用できません。${issueText}${shiftDetailText}人員充足率${fulfillmentRate}%です。該当箇所を修正してください。`;
  }

  // レベル1なしの場合：建設的なメッセージ
  return `運営上の制約違反があります。${issueText}${shiftDetailText}人員充足率${fulfillmentRate}%です。詳細を確認し、必要に応じて調整してください。`;
}

/**
 * 重大コメント（スコア1-30）を生成
 */
export function generateSevereComment(
  violationCounts: Record<string, number>,
  errorCount: number,
  warningCount: number
): string {
  const issues: string[] = [];

  if (violationCounts['staffShortage'] > 0) {
    issues.push(`人員不足が${violationCounts['staffShortage']}件`);
  }
  if (violationCounts['consecutiveWork'] > 0) {
    issues.push(`連勤超過が${violationCounts['consecutiveWork']}件`);
  }
  if (violationCounts['nightRestViolation'] > 0) {
    issues.push(`夜勤後休息不足が${violationCounts['nightRestViolation']}件`);
  }

  const issueText = issues.slice(0, 2).join('、');
  const issueClause = issueText ? `${issueText}あります。` : '';
  return `重大な問題が${errorCount + warningCount}件検出されました。${issueClause}このままでは運用に支障が出る可能性があります。手動での大幅な調整が必要です。`;
}

/**
 * 警告コメント（スコア31-59）を生成
 */
export function generateWarningComment(
  violationCounts: Record<string, number>,
  errorCount: number,
  warningCount: number
): string {
  const sortedIssues = Object.entries(violationCounts)
    .sort((a, b) => b[1] - a[1]);
  const mainIssue = sortedIssues[0];

  if (!mainIssue) {
    return `いくつかの問題が検出されました（エラー${errorCount}件、警告${warningCount}件）。詳細を確認し、必要に応じて調整してください。`;
  }

  const issueLabels: Record<string, string> = {
    staffShortage: '人員不足',
    consecutiveWork: '連勤',
    nightRestViolation: '夜勤後休息',
    qualificationMissing: '資格要件',
    leaveRequestIgnored: '休暇希望',
  };

  const mainIssueName = issueLabels[mainIssue[0]] || mainIssue[0];

  return `いくつかの問題が検出されました（エラー${errorCount}件、警告${warningCount}件）。特に${mainIssueName}に関する問題が多く見られます。詳細を確認し、必要に応じて調整してください。`;
}

/**
 * 普通コメント（スコア60-79）を生成
 */
export function generateFairComment(
  _violationCounts: Record<string, number>,
  warningCount: number,
  fulfillmentRate: number
): string {
  if (warningCount > 0) {
    return `概ね良好ですが、${warningCount}件の警告があります。人員充足率は${fulfillmentRate}%です。確定前に警告内容を確認することを推奨します。`;
  }
  return `シフト配置は概ね適切です。人員充足率${fulfillmentRate}%で、大きな問題はありません。微調整を行えばさらに改善できます。`;
}

/**
 * 良好コメント（スコア80-100）を生成
 */
export function generateGoodComment(
  fulfillmentRate: number,
  recommendations: Recommendation[]
): string {
  const hasLowPriorityRec = recommendations.some(r => r.priority === 'low');
  if (hasLowPriorityRec && fulfillmentRate >= 95) {
    return `すべての制約を満たした良好なシフト案です。人員充足率${fulfillmentRate}%で、このまま確定しても問題ありません。`;
  }
  return `良好なシフト案が生成されました。人員充足率は${fulfillmentRate}%です。制約違反なく、バランスの取れた配置になっています。`;
}

/**
 * 改善提案を生成
 */
export function generateRecommendations(
  violations: ConstraintViolation[],
  score?: number
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const grouped = groupViolationsByLevel(violations);

  // Phase 53: レベル別コメント生成を使用
  const currentScore = score ?? calculateOverallScore(violations);
  const { mainComment, details } = generateLevelBasedComment(violations, currentScore);

  // メインコメントを最優先で追加
  recommendations.push({
    priority: grouped[1].length > 0 ? 'high' : grouped[2].length > 5 ? 'high' : 'medium',
    category: 'general',
    description: mainComment,
    action: details.length > 0 ? details[0] : '詳細を確認してください',
  });

  // 詳細コメントを追加
  for (let i = 1; i < details.length; i++) {
    recommendations.push({
      priority: 'low',
      category: 'general',
      description: details[i],
      action: '',
    });
  }

  // 人員不足が多い場合（レベル2）
  const shortageCount = grouped[2].filter(
    (v) => v.type === 'staffShortage'
  ).length;
  if (shortageCount >= 5) {
    recommendations.push({
      priority: 'high',
      category: 'staffing',
      description: '複数日で人員不足が発生しています',
      action: 'スタッフの追加採用または配置調整を検討してください',
    });
  }

  // 連勤超過が多い場合（レベル3）
  const consecutiveCount = grouped[3].filter(
    (v) => v.type === 'consecutiveWork'
  ).length;
  if (consecutiveCount >= 2) {
    recommendations.push({
      priority: 'medium',
      category: 'workload',
      description: '複数スタッフで連勤超過が発生しています',
      action: 'シフトパターンの見直しを検討してください',
    });
  }

  // 夜勤後休息不足がある場合（レベル1）
  const nightRestCount = grouped[1].filter(
    (v) => v.type === 'nightRestViolation'
  ).length;
  if (nightRestCount > 0) {
    recommendations.push({
      priority: 'high',
      category: 'workload',
      description: '夜勤後の休息が確保されていないケースがあります（法令違反）',
      action: '夜勤翌日に明け休みを設定してください',
    });
  }

  // 休暇希望未反映がある場合（レベル3）
  const leaveIgnoredCount = grouped[3].filter(
    (v) => v.type === 'leaveRequestIgnored'
  ).length;
  if (leaveIgnoredCount > 0) {
    recommendations.push({
      priority: 'low',
      category: 'fairness',
      description: '一部の休暇希望が反映されていません',
      action: '可能な範囲で休暇希望を調整してください',
    });
  }

  return recommendations;
}
