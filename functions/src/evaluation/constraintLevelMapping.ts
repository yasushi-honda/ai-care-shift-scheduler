/**
 * 制約レベルマッピング設定
 * Phase 53: 制約レベル別評価システム
 *
 * 各制約タイプに対するデフォルトレベルとUI設定を一元管理
 */

import { ConstraintViolationType, ConstraintLevel } from '../types';

/**
 * 制約タイプからデフォルトレベルへのマッピング
 *
 * レベル定義:
 * - 1: 絶対必須（労基法違反 → シフト無効・0点）
 * - 2: 運営必須（人員・資格基準 → 1件12点減点）
 * - 3: 努力目標（希望休・連勤 → 1件4点減点）
 * - 4: 推奨（相性考慮 → 減点なし・情報のみ）
 */
export const CONSTRAINT_LEVEL_MAPPING: Record<ConstraintViolationType, ConstraintLevel> = {
  // レベル1（絶対必須）: 労基法違反
  nightRestViolation: 1, // 夜勤後休息不足（72時間ルール等）

  // レベル2（運営必須）: 人員・資格基準
  staffShortage: 2, // 人員不足
  qualificationMissing: 2, // 資格要件未充足

  // レベル3（努力目標）: 希望・連勤
  consecutiveWork: 3, // 連勤超過
  leaveRequestIgnored: 3, // 休暇希望未反映
};

/**
 * レベル別の減点設定
 */
export const LEVEL_DEDUCTIONS: Record<ConstraintLevel, number> = {
  1: 100, // レベル1: 即座に0点（100点減点 = 0点）
  2: 12, // レベル2: 1件12点減点（10〜15の中央値）
  3: 4, // レベル3: 1件4点減点（3〜5の中央値）
  4: 0, // レベル4: 減点なし
};

/**
 * レベル別UI表示設定
 */
export const LEVEL_UI_CONFIG: Record<
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
    color: '#DC2626',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-500',
    icon: '🚫',
  },
  2: {
    label: '運営必須',
    labelShort: 'Lv2',
    color: '#EA580C',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-500',
    icon: '⚠️',
  },
  3: {
    label: '努力目標',
    labelShort: 'Lv3',
    color: '#CA8A04',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-500',
    icon: '💡',
  },
  4: {
    label: '推奨',
    labelShort: 'Lv4',
    color: '#2563EB',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-500',
    icon: 'ℹ️',
  },
};

/**
 * 後方互換性: severityからデフォルトレベルを推定
 *
 * @param severity - 従来のseverityフィールド値
 * @returns 推定されたConstraintLevel
 */
export function getDefaultLevelFromSeverity(severity: 'error' | 'warning'): ConstraintLevel {
  return severity === 'error' ? 2 : 3;
}

/**
 * 制約タイプからレベルを取得
 *
 * @param type - 制約タイプ
 * @returns ConstraintLevel（未定義タイプはレベル3）
 */
export function getConstraintLevel(type: ConstraintViolationType): ConstraintLevel {
  return CONSTRAINT_LEVEL_MAPPING[type] ?? 3;
}

/**
 * レベル値のバリデーション
 *
 * @param level - 検証するレベル値
 * @returns 有効なConstraintLevel（無効な場合はデフォルト3）
 */
export function validateConstraintLevel(level: unknown): ConstraintLevel {
  if (typeof level === 'number' && [1, 2, 3, 4].includes(level)) {
    return level as ConstraintLevel;
  }
  return 3; // デフォルト
}

/**
 * 違反のレベルを取得（level → type → severity の優先順）
 *
 * @param violation - 制約違反オブジェクト
 * @returns ConstraintLevel
 */
export function getViolationLevel(violation: {
  level?: ConstraintLevel;
  type?: ConstraintViolationType;
  severity?: 'error' | 'warning';
}): ConstraintLevel {
  // 1. 明示的なlevelがあればそれを使用
  if (violation.level !== undefined) {
    return validateConstraintLevel(violation.level);
  }

  // 2. typeからレベルを取得
  if (violation.type) {
    return getConstraintLevel(violation.type);
  }

  // 3. severityからフォールバック
  if (violation.severity) {
    return getDefaultLevelFromSeverity(violation.severity);
  }

  // 4. 最終フォールバック
  return 3;
}

/**
 * 違反をレベル別にグループ化
 *
 * @param violations - 違反リスト
 * @returns レベル別にグループ化された違反
 */
export function groupViolationsByLevel(violations: {
  level?: ConstraintLevel;
  type?: ConstraintViolationType;
  severity?: 'error' | 'warning';
}[]): Record<ConstraintLevel, typeof violations> {
  const grouped: Record<ConstraintLevel, typeof violations> = {
    1: [],
    2: [],
    3: [],
    4: [],
  };

  for (const violation of violations) {
    const level = getViolationLevel(violation);
    grouped[level].push(violation);
  }

  return grouped;
}

/**
 * レベル別コメント生成
 * Phase 53: 設計書3.1, 3.2, 3.3に基づく
 *
 * @param violations - 違反リスト
 * @param score - 計算済みスコア
 * @returns メインコメントと詳細コメント
 */
export function generateLevelBasedComment(
  violations: {
    level?: ConstraintLevel;
    type?: ConstraintViolationType;
    severity?: 'error' | 'warning';
  }[],
  score: number
): { mainComment: string; details: string[] } {
  const grouped = groupViolationsByLevel(violations);
  const details: string[] = [];

  // レベル1（絶対必須）違反がある場合 → 実現不可能
  if (grouped[1].length > 0) {
    return {
      mainComment: '🚫 実現不可能なシフトです',
      details: [
        `労基法違反が${grouped[1].length}件あります。このシフトは使用できません。`,
        '夜勤後の休息確保など、法的要件を満たすように調整してください。',
      ],
    };
  }

  // レベル1なし + スコア60点以上 → 運用可能
  if (score >= 60) {
    let mainComment = '✅ 運用可能なシフトです';

    if (grouped[2].length > 0) {
      details.push(`運営上の課題が${grouped[2].length}件ありますが、手直しで対応可能です。`);
    }
    if (grouped[3].length > 0) {
      details.push(`努力目標の未達成が${grouped[3].length}件あります（減点は軽微です）。`);
    }
    if (violations.length === 0) {
      mainComment = '🎉 すべての制約を満たしています';
      details.push('このシフトは確定可能です。');
    }

    return { mainComment, details };
  }

  // レベル1なし + スコア60点未満 + レベル2が5件以下 → 手直しで対応可能
  if (grouped[2].length <= 5) {
    return {
      mainComment: '⚠️ 要調整: 手直しで対応可能です',
      details: [
        `運営上の課題が${grouped[2].length}件あります。`,
        grouped[3].length > 0
          ? `努力目標の未達成が${grouped[3].length}件あります。`
          : '',
        'スタッフ配置を部分的に調整することで改善できます。',
      ].filter(Boolean),
    };
  }

  // レベル2が多い場合
  return {
    mainComment: '⚠️ 要検討: 運営上の課題が多くあります',
    details: [
      `運営上の課題が${grouped[2].length}件あります（人員不足・資格要件など）。`,
      'シフト全体の見直しを検討してください。',
      'スタッフの追加採用または勤務日数の調整が必要かもしれません。',
    ],
  };
}

/**
 * ポジティブサマリー生成
 * Phase 53: 設計書3.4に基づく
 *
 * @param violations - 違反リスト
 * @param score - 計算済みスコア
 * @param fulfillmentRate - 充足率
 * @returns ポジティブなサマリーメッセージ
 */
export function generatePositiveSummary(
  violations: {
    level?: ConstraintLevel;
    type?: ConstraintViolationType;
    severity?: 'error' | 'warning';
  }[],
  score: number,
  fulfillmentRate: number
): string {
  const grouped = groupViolationsByLevel(violations);

  // レベル1違反がある場合はポジティブサマリーなし
  if (grouped[1].length > 0) {
    return '';
  }

  const parts: string[] = [];

  // 充足率を含むメッセージ
  if (fulfillmentRate >= 90) {
    parts.push(`充足率${Math.round(fulfillmentRate)}%を達成`);
  }

  // 必須条件クリアメッセージ
  parts.push('必須条件をすべて満たしています');

  // スコアに応じたメッセージ
  if (score >= 80) {
    parts.push('高品質なシフト案です');
  } else if (score >= 60) {
    parts.push('運用可能な品質です');
  }

  return parts.join(' / ');
}
