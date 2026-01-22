/**
 * Phase 40: AI評価・フィードバック機能
 * 評価ロジック実装
 *
 * シフトスケジュールに対する制約違反検出と評価スコア計算を行う
 */

import { Timestamp } from 'firebase-admin/firestore';
import {
  Staff,
  StaffSchedule,
  ShiftRequirement,
  LeaveRequest,
  ConstraintViolation,
  AIEvaluationResult,
  Recommendation,
  SimulationResult,
  TimeSlotPreference,
} from '../types';
import { analyzeRootCauses } from './rootCauseAnalysis';
import {
  generatePositiveSummary,
} from './constraintLevelMapping';
import {
  isBusinessDay as isBusinessDayFn,
  checkStaffShortage as checkStaffShortageFn,
  checkConsecutiveWorkViolation as checkConsecutiveWorkViolationFn,
  checkNightRestViolation as checkNightRestViolationFn,
  checkQualificationMissing as checkQualificationMissingFn,
  checkLeaveRequestIgnored as checkLeaveRequestIgnoredFn,
  checkTimeSlotPreferenceViolation as checkTimeSlotPreferenceViolationFn,
} from './constraintCheckers';
import {
  calculateOverallScore as calculateOverallScoreFn,
  calculateFulfillmentRate as calculateFulfillmentRateFn,
} from './scoreCalculators';
import {
  generateAIComment as generateAICommentFn,
  generateRecommendations as generateRecommendationsFn,
} from './commentGenerators';

/**
 * 評価入力データ
 */
export interface EvaluationInput {
  schedule: StaffSchedule[];
  staffList: Staff[];
  requirements: ShiftRequirement;
  leaveRequests: LeaveRequest;
}

/**
 * スタッフ制約分析結果
 * Phase 44: 具体的な問題分析を可視化するためのインターフェース
 */
export interface StaffConstraintAnalysis {
  /** スタッフ総数 */
  totalStaff: number;
  /** 営業日数 */
  businessDays: number;
  /** 総供給可能人日数 */
  totalSupplyPersonDays: number;
  /** 総必要人日数 */
  totalRequiredPersonDays: number;
  /** シフト種別ごとの分析 */
  shiftAnalysis: {
    [shiftName: string]: {
      required: number;
      available: number;
      shortage: number;
      excess: number;
    };
  };
  /** timeSlotPreference別のスタッフ数 */
  preferenceDistribution: {
    [preference: string]: {
      count: number;
      personDays: number;
      staffNames: string[];
    };
  };
  /** 数学的に実現可能か */
  isFeasible: boolean;
  /** 実現不可能な場合の理由 */
  infeasibilityReasons: string[];
  /** 改善提案 */
  suggestions: string[];
}

/**
 * 評価サービスクラス
 *
 * シフトスケジュールの評価・制約違反検出・改善提案生成を行う
 */
export class EvaluationService {
  /**
   * シフトスケジュールを評価し、制約違反と改善提案を生成
   */
  evaluateSchedule(input: EvaluationInput): AIEvaluationResult {
    const violations: ConstraintViolation[] = [];

    // 各制約チェックを実行
    violations.push(
      ...this.checkStaffShortage(input.schedule, input.requirements)
    );
    violations.push(
      ...this.checkConsecutiveWorkViolation(input.schedule, input.staffList)
    );
    violations.push(...this.checkNightRestViolation(input.schedule));
    violations.push(
      ...this.checkQualificationMissing(
        input.schedule,
        input.staffList,
        input.requirements
      )
    );
    violations.push(
      ...this.checkLeaveRequestIgnored(input.schedule, input.leaveRequests)
    );

    // Phase 44: timeSlotPreference違反を検出
    violations.push(
      ...this.checkTimeSlotPreferenceViolation(input.schedule, input.staffList)
    );

    // Phase 44: スタッフ制約の数学的分析
    const constraintAnalysisResult = this.analyzeStaffConstraints(
      input.staffList,
      input.requirements
    );

    // 分析結果をログ出力（デバッグ用）
    if (!constraintAnalysisResult.isFeasible) {
      console.log('📊 [Constraint Analysis] 実現可能性問題を検出:', {
        totalStaff: constraintAnalysisResult.totalStaff,
        businessDays: constraintAnalysisResult.businessDays,
        supply: constraintAnalysisResult.totalSupplyPersonDays,
        required: constraintAnalysisResult.totalRequiredPersonDays,
        reasons: constraintAnalysisResult.infeasibilityReasons,
        suggestions: constraintAnalysisResult.suggestions,
      });
    }

    // スコア計算
    const overallScore = this.calculateOverallScore(violations);
    const fulfillmentRate = this.calculateFulfillmentRate(
      input.schedule,
      input.requirements
    );

    // Phase 53: 改善提案生成（スコアを渡す）
    const recommendations = this.generateRecommendations(violations, input, overallScore);

    // Phase 44: 制約分析から追加の改善提案を生成
    for (const suggestion of constraintAnalysisResult.suggestions) {
      recommendations.push({
        category: 'staffConstraint',
        priority: 'high',
        description: suggestion,
        action: 'スタッフ設定を確認・修正してください',
      });
    }

    // シミュレーション結果生成
    const simulation = this.generateSimulation(input, violations);

    // Phase 55: 根本原因分析を実行
    const rootCauseResult = analyzeRootCauses({
      violations,
      staffList: input.staffList,
      requirements: input.requirements,
      leaveRequests: input.leaveRequests,
      schedule: input.schedule,
    });

    // AI総合コメント生成（根本原因分析を統合）
    const baseAiComment = this.generateAIComment(
      overallScore,
      fulfillmentRate,
      violations,
      recommendations
    );

    // 根本原因がある場合は、AIコメントに追加
    const aiComment = violations.length > 0 && rootCauseResult.primaryCause
      ? `${baseAiComment}\n\n${rootCauseResult.aiComment}`
      : baseAiComment;

    // Phase 53: ポジティブサマリー生成
    const positiveSummary = generatePositiveSummary(violations, overallScore, fulfillmentRate);

    return {
      overallScore,
      fulfillmentRate,
      constraintViolations: violations,
      recommendations,
      simulation,
      generatedAt: Timestamp.now(),
      aiComment,
      positiveSummary, // Phase 53: 追加
      constraintAnalysis: {
        totalStaff: constraintAnalysisResult.totalStaff,
        businessDays: constraintAnalysisResult.businessDays,
        totalSupplyPersonDays: constraintAnalysisResult.totalSupplyPersonDays,
        totalRequiredPersonDays: constraintAnalysisResult.totalRequiredPersonDays,
        isFeasible: constraintAnalysisResult.isFeasible,
        infeasibilityReasons: constraintAnalysisResult.infeasibilityReasons,
        suggestions: constraintAnalysisResult.suggestions,
      },
      // Phase 55: 根本原因分析結果を追加
      rootCauseAnalysis: {
        primaryCause: rootCauseResult.primaryCause,
        secondaryCauses: rootCauseResult.secondaryCauses,
        aiComment: rootCauseResult.aiComment,
        analyzedAt: rootCauseResult.analyzedAt,
      },
    };
  }

  /**
   * AI総合コメントを生成（委譲）
   */
  private generateAIComment(
    overallScore: number,
    fulfillmentRate: number,
    violations: ConstraintViolation[],
    recommendations: Recommendation[]
  ): string {
    return generateAICommentFn(overallScore, fulfillmentRate, violations, recommendations);
  }

  /**
   * 営業日かどうかを判定
   *
   * 夜勤がない施設（デイサービス）の場合、日曜日は営業外として扱う
   *
   * @param date 日付文字列 (YYYY-MM-DD)
   * @param hasNightShift 夜勤シフトがあるかどうか
   * @returns 営業日の場合true
   */
  private isBusinessDay(date: string, hasNightShift: boolean): boolean {
    // 抽出した関数に委譲
    return isBusinessDayFn(date, hasNightShift);
  }

  /**
   * Phase 44: スタッフ制約の数学的分析
   *
   * timeSlotPreference、週勤務希望などを考慮して、
   * 数学的にシフト配置が実現可能かを分析する
   */
  analyzeStaffConstraints(
    staffList: Staff[],
    requirements: ShiftRequirement
  ): StaffConstraintAnalysis {
    const targetMonth = requirements.targetMonth;
    const [year, month] = targetMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    // 夜勤があるかどうかを判定
    const shiftTypeNames = (requirements.timeSlots || []).map(t => t.name);
    const hasNightShift = shiftTypeNames.some(name => name.includes('夜'));

    // 営業日数を計算
    let businessDays = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${targetMonth}-${String(day).padStart(2, '0')}`;
      if (this.isBusinessDay(date, hasNightShift)) {
        businessDays++;
      }
    }

    // timeSlotPreference別にスタッフを分類
    const preferenceDistribution: StaffConstraintAnalysis['preferenceDistribution'] = {};
    for (const pref of Object.values(TimeSlotPreference)) {
      preferenceDistribution[pref] = { count: 0, personDays: 0, staffNames: [] };
    }

    let totalSupplyPersonDays = 0;
    for (const staff of staffList) {
      const pref = staff.timeSlotPreference || TimeSlotPreference.Any;
      const monthlyDays = Math.round(staff.weeklyWorkCount.hope * 4.5);

      if (!preferenceDistribution[pref]) {
        preferenceDistribution[pref] = { count: 0, personDays: 0, staffNames: [] };
      }
      preferenceDistribution[pref].count++;
      preferenceDistribution[pref].personDays += monthlyDays;
      preferenceDistribution[pref].staffNames.push(staff.name);
      totalSupplyPersonDays += monthlyDays;
    }

    // 1日あたりの必要人数を計算
    let dailyRequired = 0;
    for (const req of Object.values(requirements.requirements)) {
      dailyRequired += req.totalStaff;
    }
    const totalRequiredPersonDays = businessDays * dailyRequired;

    // シフト種別ごとの分析
    const shiftAnalysis: StaffConstraintAnalysis['shiftAnalysis'] = {};
    const infeasibilityReasons: string[] = [];
    const suggestions: string[] = [];

    // 各シフト種別の必要人日数
    for (const [shiftName, req] of Object.entries(requirements.requirements)) {
      const required = businessDays * req.totalStaff;
      shiftAnalysis[shiftName] = {
        required,
        available: 0,
        shortage: 0,
        excess: 0,
      };
    }

    // 「日勤のみ」スタッフの影響を分析
    const dayOnlyPref = preferenceDistribution[TimeSlotPreference.DayOnly];
    if (dayOnlyPref && dayOnlyPref.personDays > 0) {
      // 日勤のシフト名を検索
      const dayShiftName = Object.keys(requirements.requirements).find(
        name => name.includes('日勤') || name === '日'
      );

      if (dayShiftName && shiftAnalysis[dayShiftName]) {
        const dayRequired = shiftAnalysis[dayShiftName].required;
        const dayOnlyConsumption = dayOnlyPref.personDays;
        const percentage = Math.round((dayOnlyConsumption / dayRequired) * 100);

        if (dayOnlyConsumption > dayRequired * 0.7) {
          infeasibilityReasons.push(
            `「日勤のみ」スタッフ${dayOnlyPref.count}名（${dayOnlyPref.staffNames.join('・')}）で` +
            `${dayOnlyConsumption}人日を消費し、日勤必要数${dayRequired}人日の${percentage}%を占有`
          );

          // 改善提案を生成
          if (dayOnlyPref.staffNames.length > 1) {
            suggestions.push(
              `${dayOnlyPref.staffNames[dayOnlyPref.staffNames.length - 1]}の` +
              `timeSlotPreferenceを「いつでも可」に変更すると柔軟性が向上します`
            );
          }
        }
      }
    }

    // 早番・遅番に回せる人員を計算
    const flexiblePref = preferenceDistribution[TimeSlotPreference.Any] || { personDays: 0 };
    const earlyShiftName = Object.keys(requirements.requirements).find(
      name => name.includes('早')
    );
    const lateShiftName = Object.keys(requirements.requirements).find(
      name => name.includes('遅')
    );

    if (earlyShiftName || lateShiftName) {
      let earlyLateRequired = 0;
      if (earlyShiftName) earlyLateRequired += shiftAnalysis[earlyShiftName]?.required || 0;
      if (lateShiftName) earlyLateRequired += shiftAnalysis[lateShiftName]?.required || 0;

      // 日勤のみスタッフを除いた柔軟なスタッフの人日数
      const earlyLateAvailable = flexiblePref.personDays;

      if (earlyLateAvailable < earlyLateRequired) {
        infeasibilityReasons.push(
          `早番・遅番に必要な${earlyLateRequired}人日に対し、柔軟に配置可能なスタッフは${earlyLateAvailable}人日しか確保できません`
        );
      }
    }

    // 数学的に実現可能かを判定
    const isFeasible = infeasibilityReasons.length === 0 &&
                       totalSupplyPersonDays >= totalRequiredPersonDays;

    if (!isFeasible && totalSupplyPersonDays < totalRequiredPersonDays) {
      infeasibilityReasons.push(
        `総供給人日数${totalSupplyPersonDays}が必要人日数${totalRequiredPersonDays}を下回っています`
      );
    }

    return {
      totalStaff: staffList.length,
      businessDays,
      totalSupplyPersonDays,
      totalRequiredPersonDays,
      shiftAnalysis,
      preferenceDistribution,
      isFeasible,
      infeasibilityReasons,
      suggestions,
    };
  }

  /**
   * 人員不足を検出
   *
   * 各日・各シフトの配置人数が要件を満たしているかをチェック
   * 注: デイサービス（夜勤なし）の場合、日曜日は営業外としてスキップ
   */
  checkStaffShortage(
    schedule: StaffSchedule[],
    requirements: ShiftRequirement
  ): ConstraintViolation[] {
    // 抽出した関数に委譲
    return checkStaffShortageFn(schedule, requirements);
  }

  /**
   * 連続勤務超過を検出
   *
   * 各スタッフの連続勤務日数がmaxConsecutiveWorkDaysを超えていないかをチェック
   */
  checkConsecutiveWorkViolation(
    schedule: StaffSchedule[],
    staffList: Staff[]
  ): ConstraintViolation[] {
    // 抽出した関数に委譲
    return checkConsecutiveWorkViolationFn(schedule, staffList);
  }

  /**
   * 夜勤後休息不足を検出
   *
   * 夜勤の翌日が「休み」または「明け休み」でない場合を検出
   */
  checkNightRestViolation(schedule: StaffSchedule[]): ConstraintViolation[] {
    // 抽出した関数に委譲
    return checkNightRestViolationFn(schedule);
  }

  /**
   * 資格要件未充足を検出
   * 注: デイサービス（夜勤なし）の場合、日曜日は営業外としてスキップ
   */
  checkQualificationMissing(
    schedule: StaffSchedule[],
    staffList: Staff[],
    requirements: ShiftRequirement
  ): ConstraintViolation[] {
    // 抽出した関数に委譲
    return checkQualificationMissingFn(schedule, staffList, requirements);
  }

  /**
   * 休暇希望未反映を検出
   */
  checkLeaveRequestIgnored(
    schedule: StaffSchedule[],
    leaveRequests: LeaveRequest
  ): ConstraintViolation[] {
    // 抽出した関数に委譲
    return checkLeaveRequestIgnoredFn(schedule, leaveRequests);
  }

  /**
   * Phase 44: timeSlotPreference違反を検出
   *
   * スタッフのtimeSlotPreferenceに反するシフト配置を検出
   * - 「日勤のみ」のスタッフが早番・遅番・夜勤に配置されている
   * - 「夜勤のみ」のスタッフが日勤・早番・遅番に配置されている
   */
  checkTimeSlotPreferenceViolation(
    schedule: StaffSchedule[],
    staffList: Staff[]
  ): ConstraintViolation[] {
    // 抽出した関数に委譲
    return checkTimeSlotPreferenceViolationFn(schedule, staffList);
  }

  /**
   * 総合スコアを計算（委譲）
   */
  calculateOverallScore(violations: ConstraintViolation[]): number {
    return calculateOverallScoreFn(violations);
  }

  /**
   * 充足率を計算（委譲）
   */
  calculateFulfillmentRate(
    schedule: StaffSchedule[],
    requirements: ShiftRequirement
  ): number {
    return calculateFulfillmentRateFn(schedule, requirements);
  }

  /**
   * 改善提案を生成（委譲）
   */
  private generateRecommendations(
    violations: ConstraintViolation[],
    _input: EvaluationInput,
    score?: number
  ): Recommendation[] {
    return generateRecommendationsFn(violations, score);
  }

  /**
   * シミュレーション結果を生成
   */
  private generateSimulation(
    input: EvaluationInput,
    violations: ConstraintViolation[]
  ): SimulationResult {
    // 残業時間予測（簡易計算）
    const shortageViolations = violations.filter(
      (v) => v.type === 'staffShortage'
    );
    // 人員不足1件あたり約2時間の残業と仮定
    const estimatedOvertimeHours = shortageViolations.length * 2;

    // 負荷バランス評価
    let workloadBalance: 'good' | 'fair' | 'poor' = 'good';
    const consecutiveViolations = violations.filter(
      (v) => v.type === 'consecutiveWork'
    );
    if (consecutiveViolations.length >= 3) {
      workloadBalance = 'poor';
    } else if (consecutiveViolations.length >= 1) {
      workloadBalance = 'fair';
    }

    // 有給消化率予測（休暇希望反映率に基づく）
    const leaveIgnoredViolations = violations.filter(
      (v) => v.type === 'leaveRequestIgnored'
    );
    const totalLeaveRequests = Object.values(input.leaveRequests || {}).reduce(
      (sum, requests) => sum + Object.keys(requests || {}).length,
      0
    );
    const paidLeaveUsageRate =
      totalLeaveRequests > 0
        ? Math.round(
            ((totalLeaveRequests - leaveIgnoredViolations.length) /
              totalLeaveRequests) *
              100
          )
        : 100;

    // リスク要因
    const risks: string[] = [];
    if (shortageViolations.length > 0) {
      risks.push('人員不足による業務負荷増加');
    }
    if (consecutiveViolations.length > 0) {
      risks.push('連勤によるスタッフ疲労');
    }
    if (leaveIgnoredViolations.length > 0) {
      risks.push('休暇希望未反映によるモチベーション低下');
    }

    return {
      estimatedOvertimeHours,
      workloadBalance,
      paidLeaveUsageRate,
      risks,
    };
  }
}

/**
 * デフォルトの評価結果を生成（フォールバック用）
 * 呼び出し時にTimestamp.now()を評価するためファクトリ関数として実装
 */
export const createDefaultEvaluation = (): AIEvaluationResult => ({
  overallScore: -1, // 未評価を示す
  fulfillmentRate: -1,
  constraintViolations: [],
  recommendations: [
    {
      priority: 'medium',
      category: 'system',
      description: '評価データの生成に失敗しました',
      action: '手動でシフトを確認してください',
    },
  ],
  simulation: {
    estimatedOvertimeHours: 0,
    workloadBalance: 'fair',
    paidLeaveUsageRate: 0,
    risks: ['評価データが利用できません'],
  },
  generatedAt: Timestamp.now(),
});

/**
 * @deprecated createDefaultEvaluation()を使用してください
 */
export const DEFAULT_EVALUATION = createDefaultEvaluation();
