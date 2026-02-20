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
  EvaluationResult,
  Recommendation,
  SimulationResult,
} from '../types';
import { analyzeRootCauses } from './rootCauseAnalysis';
import {
  generatePositiveSummary,
} from './constraintLevelMapping';
import {
  checkStaffShortage as checkStaffShortageFn,
  checkConsecutiveWorkViolation as checkConsecutiveWorkViolationFn,
  checkNightRestViolation as checkNightRestViolationFn,
  checkQualificationMissing as checkQualificationMissingFn,
  checkRoleMissing as checkRoleMissingFn,
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
import {
  analyzeStaffConstraints as analyzeStaffConstraintsFn,
  StaffConstraintAnalysis,
} from './staffConstraintAnalyzer';
import { generateSimulation as generateSimulationFn } from './simulationGenerator';

/**
 * 評価入力データ
 */
export interface EvaluationInput {
  schedule: StaffSchedule[];
  staffList: Staff[];
  requirements: ShiftRequirement;
  leaveRequests: LeaveRequest;
}

// StaffConstraintAnalysis は staffConstraintAnalyzer.ts からエクスポート

/**
 * 評価サービスクラス
 *
 * シフトスケジュールの評価・制約違反検出・改善提案生成を行う
 */
export class EvaluationService {
  /**
   * シフトスケジュールを評価し、制約違反と改善提案を生成
   */
  evaluateSchedule(input: EvaluationInput): EvaluationResult {
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
      ...this.checkRoleMissing(
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
   * Phase 44: スタッフ制約の数学的分析（委譲）
   */
  analyzeStaffConstraints(
    staffList: Staff[],
    requirements: ShiftRequirement
  ): StaffConstraintAnalysis {
    return analyzeStaffConstraintsFn(staffList, requirements);
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
   * ロール要件未充足を検出（看護師・ケアマネ等）
   * 注: デイサービス（夜勤なし）の場合、日曜日は営業外としてスキップ
   */
  checkRoleMissing(
    schedule: StaffSchedule[],
    staffList: Staff[],
    requirements: ShiftRequirement
  ): ConstraintViolation[] {
    // 抽出した関数に委譲
    return checkRoleMissingFn(schedule, staffList, requirements);
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
   * シミュレーション結果を生成（委譲）
   */
  private generateSimulation(
    input: EvaluationInput,
    violations: ConstraintViolation[]
  ): SimulationResult {
    return generateSimulationFn({ leaveRequests: input.leaveRequests }, violations);
  }
}

/**
 * デフォルトの評価結果を生成（フォールバック用）
 * 呼び出し時にTimestamp.now()を評価するためファクトリ関数として実装
 */
export const createDefaultEvaluation = (): EvaluationResult => ({
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
