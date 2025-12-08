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
  ConstraintLevel,
  AIEvaluationResult,
  Recommendation,
  SimulationResult,
  TimeSlotPreference,
} from '../types';
import {
  LEVEL_DEDUCTIONS,
  getViolationLevel,
  generateLevelBasedComment,
  generatePositiveSummary,
  groupViolationsByLevel,
} from './constraintLevelMapping';

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

    // AI総合コメント生成
    const aiComment = this.generateAIComment(
      overallScore,
      fulfillmentRate,
      violations,
      recommendations
    );

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
    };
  }

  /**
   * AI総合コメントを生成
   *
   * スコアと違反内容に基づいて、200文字以内の自然言語コメントを生成
   */
  private generateAIComment(
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
      return this.generateCriticalComment(violationCounts, fulfillmentRate, violations);
    } else if (overallScore <= 30) {
      return this.generateSevereComment(violationCounts, errorCount, warningCount);
    } else if (overallScore < 60) {
      return this.generateWarningComment(violationCounts, errorCount, warningCount);
    } else if (overallScore < 80) {
      return this.generateFairComment(violationCounts, warningCount, fulfillmentRate);
    } else {
      return this.generateGoodComment(fulfillmentRate, recommendations);
    }
  }

  private generateCriticalComment(
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

    return `現在の要件ではすべての制約を満たすシフトを作成できません。${issueText}${shiftDetailText}人員充足率${fulfillmentRate}%です。`;
  }

  private generateSevereComment(
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

  private generateWarningComment(
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

  private generateFairComment(
    _violationCounts: Record<string, number>,
    warningCount: number,
    fulfillmentRate: number
  ): string {
    if (warningCount > 0) {
      return `概ね良好ですが、${warningCount}件の警告があります。人員充足率は${fulfillmentRate}%です。確定前に警告内容を確認することを推奨します。`;
    }
    return `シフト配置は概ね適切です。人員充足率${fulfillmentRate}%で、大きな問題はありません。微調整を行えばさらに改善できます。`;
  }

  private generateGoodComment(
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
   * 営業日かどうかを判定
   *
   * 夜勤がない施設（デイサービス）の場合、日曜日は営業外として扱う
   *
   * @param date 日付文字列 (YYYY-MM-DD)
   * @param hasNightShift 夜勤シフトがあるかどうか
   * @returns 営業日の場合true
   */
  private isBusinessDay(date: string, hasNightShift: boolean): boolean {
    if (hasNightShift) {
      // 24時間営業の施設（老健など）は毎日営業
      return true;
    }

    // デイサービス: 日曜日は休業
    const dayOfWeek = new Date(date).getDay();
    return dayOfWeek !== 0; // 0 = 日曜日
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
    const violations: ConstraintViolation[] = [];
    const targetMonth = requirements.targetMonth;

    // 対象月の日数を取得
    const [year, month] = targetMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    // 夜勤があるかどうかを判定
    const shiftTypeNames = (requirements.timeSlots || []).map(t => t.name);
    const hasNightShift = shiftTypeNames.some(name => name.includes('夜'));

    // 各日の配置人数をカウント
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${targetMonth}-${String(day).padStart(2, '0')}`;

      // 営業外の日はスキップ
      if (!this.isBusinessDay(date, hasNightShift)) {
        continue;
      }

      const dailyStaffByShift: Record<string, string[]> = {};

      // 各スタッフのシフトをカウント
      for (const staffSchedule of schedule) {
        const shift = staffSchedule.monthlyShifts.find((s) => s.date === date);
        if (shift && shift.shiftType && shift.shiftType !== '休') {
          const shiftType = shift.shiftType;
          if (!dailyStaffByShift[shiftType]) {
            dailyStaffByShift[shiftType] = [];
          }
          dailyStaffByShift[shiftType].push(staffSchedule.staffId);
        }
      }

      // 要件と比較
      for (const [shiftName, requirement] of Object.entries(
        requirements.requirements
      )) {
        const assignedStaff = dailyStaffByShift[shiftName] || [];
        const shortage = requirement.totalStaff - assignedStaff.length;

        if (shortage > 0) {
          violations.push({
            type: 'staffShortage',
            severity: 'error',
            description: `${date}の${shiftName}で${shortage}名の人員不足`,
            affectedDates: [date],
            suggestion: `${shiftName}に追加の配置を検討してください`,
          });
        }
      }
    }

    return violations;
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
    const violations: ConstraintViolation[] = [];
    const DEFAULT_MAX_CONSECUTIVE = 5; // デフォルト連勤上限

    for (const staffSchedule of schedule) {
      const staff = staffList.find((s) => s.id === staffSchedule.staffId);
      if (!staff) continue;

      const maxConsecutive = staff.maxConsecutiveWorkDays ?? DEFAULT_MAX_CONSECUTIVE;
      const shifts = [...staffSchedule.monthlyShifts].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      let consecutiveDays = 0;
      let startDate = '';
      const violatingPeriods: { start: string; end: string }[] = [];

      for (let i = 0; i < shifts.length; i++) {
        const shift = shifts[i];
        const isWorkDay =
          shift.shiftType && shift.shiftType !== '休' && shift.shiftType !== '明け休み';

        if (isWorkDay) {
          if (consecutiveDays === 0) {
            startDate = shift.date;
          }
          consecutiveDays++;

          // 連勤超過を検出（境界値：ちょうど上限は違反にならない）
          if (consecutiveDays > maxConsecutive) {
            // 前日までの期間を記録（まだ記録していない場合）
            if (
              violatingPeriods.length === 0 ||
              violatingPeriods[violatingPeriods.length - 1].end !== shifts[i - 1]?.date
            ) {
              violatingPeriods.push({
                start: startDate,
                end: shift.date,
              });
            } else {
              // 継続中の違反期間を更新
              violatingPeriods[violatingPeriods.length - 1].end = shift.date;
            }
          }
        } else {
          consecutiveDays = 0;
        }
      }

      // 違反期間があれば報告
      for (const period of violatingPeriods) {
        violations.push({
          type: 'consecutiveWork',
          severity: 'warning',
          description: `${staff.name}さんが${period.start}から${period.end}まで${maxConsecutive}日を超える連勤`,
          affectedStaff: [staffSchedule.staffId],
          affectedDates: [period.start, period.end],
          suggestion: `連勤を${maxConsecutive}日以内に調整してください`,
        });
      }
    }

    return violations;
  }

  /**
   * 夜勤後休息不足を検出
   *
   * 夜勤の翌日が「休み」または「明け休み」でない場合を検出
   */
  checkNightRestViolation(schedule: StaffSchedule[]): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];

    for (const staffSchedule of schedule) {
      const shifts = [...staffSchedule.monthlyShifts].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      for (let i = 0; i < shifts.length - 1; i++) {
        const currentShift = shifts[i];
        const nextShift = shifts[i + 1];

        // 夜勤かどうかをチェック（「夜勤」または「夜」を含むシフト）
        const isNightShift =
          currentShift.shiftType?.includes('夜勤') ||
          currentShift.shiftType?.includes('夜');

        if (isNightShift) {
          // 翌日が連続しているかチェック（DST対策: UTC日付で比較）
          const currentDate = new Date(currentShift.date + 'T00:00:00Z');
          const nextDate = new Date(nextShift.date + 'T00:00:00Z');
          const diffDays =
            (nextDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24);

          if (diffDays === 1) {
            // 翌日が「休み」または「明け休み」でない場合は違反
            const nextShiftType = nextShift.shiftType || '';
            const isRest =
              nextShiftType === '休' ||
              nextShiftType.includes('明け') ||
              nextShiftType.includes('公休');

            if (!isRest) {
              violations.push({
                type: 'nightRestViolation',
                severity: 'warning',
                description: `${staffSchedule.staffName}さんの${currentShift.date}の夜勤後に休息がありません`,
                affectedStaff: [staffSchedule.staffId],
                affectedDates: [currentShift.date, nextShift.date],
                suggestion: `夜勤の翌日は「明け休み」または「休」を設定してください`,
              });
            }
          }
        }
      }
    }

    return violations;
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
    const violations: ConstraintViolation[] = [];
    const targetMonth = requirements.targetMonth;

    // 対象月の日数を取得
    const [year, month] = targetMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    // 夜勤があるかどうかを判定
    const shiftTypeNames = (requirements.timeSlots || []).map(t => t.name);
    const hasNightShift = shiftTypeNames.some(name => name.includes('夜'));

    // 各日の資格保有者をカウント
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${targetMonth}-${String(day).padStart(2, '0')}`;

      // 営業外の日はスキップ
      if (!this.isBusinessDay(date, hasNightShift)) {
        continue;
      }

      for (const [shiftName, requirement] of Object.entries(
        requirements.requirements
      )) {
        // 各資格要件をチェック
        for (const qualReq of requirement.requiredQualifications || []) {
          let qualifiedCount = 0;

          for (const staffSchedule of schedule) {
            const shift = staffSchedule.monthlyShifts.find(
              (s) => s.date === date
            );
            if (shift && shift.shiftType === shiftName) {
              const staff = staffList.find(
                (s) => s.id === staffSchedule.staffId
              );
              if (staff?.qualifications?.includes(qualReq.qualification)) {
                qualifiedCount++;
              }
            }
          }

          if (qualifiedCount < qualReq.count) {
            violations.push({
              type: 'qualificationMissing',
              severity: 'error',
              description: `${date}の${shiftName}で${qualReq.qualification}が${qualReq.count - qualifiedCount}名不足`,
              affectedDates: [date],
              suggestion: `${qualReq.qualification}保有者を追加配置してください`,
            });
          }
        }
      }
    }

    return violations;
  }

  /**
   * 休暇希望未反映を検出
   */
  checkLeaveRequestIgnored(
    schedule: StaffSchedule[],
    leaveRequests: LeaveRequest
  ): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];

    for (const [staffId, requests] of Object.entries(leaveRequests || {})) {
      const staffSchedule = schedule.find((s) => s.staffId === staffId);
      if (!staffSchedule) continue;

      for (const [date, leaveType] of Object.entries(requests || {})) {
        const shift = staffSchedule.monthlyShifts.find((s) => s.date === date);

        if (shift) {
          const shiftType = shift.shiftType || '';
          // 休暇希望日に勤務が入っている場合
          const isWorking =
            shiftType !== '休' &&
            shiftType !== '有給' &&
            shiftType !== '公休' &&
            !shiftType.includes('休');

          if (isWorking) {
            violations.push({
              type: 'leaveRequestIgnored',
              severity: 'warning',
              description: `${staffSchedule.staffName}さんの${date}の${leaveType}希望が反映されていません`,
              affectedStaff: [staffId],
              affectedDates: [date],
              suggestion: `${date}を${leaveType}に変更することを検討してください`,
            });
          }
        }
      }
    }

    return violations;
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
    const violations: ConstraintViolation[] = [];

    for (const staffSchedule of schedule) {
      const staff = staffList.find((s) => s.id === staffSchedule.staffId);
      if (!staff) continue;

      const preference = staff.timeSlotPreference;
      const staffName = staff.name;

      // 各日のシフトをチェック
      for (const shift of staffSchedule.monthlyShifts) {
        const shiftType = shift.shiftType || '';

        // 休みや明け休みは違反対象外
        if (shiftType === '休' || shiftType.includes('休') || shiftType === '') {
          continue;
        }

        // 日勤のみスタッフが日勤以外に配置されている場合
        if (preference === TimeSlotPreference.DayOnly) {
          const isDayShift = shiftType === '日勤' || shiftType.includes('日勤');
          if (!isDayShift) {
            violations.push({
              type: 'leaveRequestIgnored', // 既存タイプを流用（timeSlotPreferenceViolationがないため）
              severity: 'error',
              description: `${staffName}さん（日勤のみ希望）が${shift.date}に${shiftType}に配置されています`,
              affectedStaff: [staffSchedule.staffId],
              affectedDates: [shift.date],
              suggestion: `${staffName}さんは日勤のみに配置してください`,
            });
          }
        }

        // 夜勤のみスタッフが夜勤以外に配置されている場合
        if (preference === TimeSlotPreference.NightOnly) {
          const isNightShift = shiftType === '夜勤' || shiftType.includes('夜');
          if (!isNightShift) {
            violations.push({
              type: 'leaveRequestIgnored',
              severity: 'error',
              description: `${staffName}さん（夜勤のみ希望）が${shift.date}に${shiftType}に配置されています`,
              affectedStaff: [staffSchedule.staffId],
              affectedDates: [shift.date],
              suggestion: `${staffName}さんは夜勤のみに配置してください`,
            });
          }
        }
      }
    }

    return violations;
  }

  /**
   * 総合スコアを計算
   *
   * 100点から違反に応じて減点
   * - error: -10点
   * - warning: -5点
   */
  calculateOverallScore(violations: ConstraintViolation[]): number {
    // 違反をレベル別にグループ化
    const violationsByLevel: Record<ConstraintLevel, ConstraintViolation[]> = {
      1: [],
      2: [],
      3: [],
      4: [],
    };

    for (const violation of violations) {
      const level = getViolationLevel(violation);
      violationsByLevel[level].push(violation);
    }

    // Phase 53: デバッグログ
    console.log('📊 [Phase 53] レベル別違反件数:', {
      level1: violationsByLevel[1].length,
      level2: violationsByLevel[2].length,
      level3: violationsByLevel[3].length,
      level4: violationsByLevel[4].length,
      level1Violations: violationsByLevel[1].map(v => ({ type: v.type, desc: v.description.substring(0, 50) })),
    });

    // レベル1（絶対必須）違反がある場合は即座に0点
    if (violationsByLevel[1].length > 0) {
      console.log('⚠️ [Phase 53] レベル1違反があるため0点:', violationsByLevel[1].map(v => v.type));
      return 0;
    }

    // レベル2-4の減点を計算
    let score = 100;

    // レベル2（運営必須）: 1件あたり12点減点
    score -= violationsByLevel[2].length * LEVEL_DEDUCTIONS[2];

    // レベル3（努力目標）: 1件あたり4点減点
    score -= violationsByLevel[3].length * LEVEL_DEDUCTIONS[3];

    // レベル4（推奨）: 減点なし（情報のみ）

    // スコアを0〜100の範囲に正規化
    return Math.max(0, Math.min(100, score));
  }

  /**
   * 充足率を計算
   *
   * (実際の配置人数 / 必要人数) * 100
   * 注: デイサービス（夜勤なし）の場合、日曜日は営業外としてスキップ
   */
  calculateFulfillmentRate(
    schedule: StaffSchedule[],
    requirements: ShiftRequirement
  ): number {
    const targetMonth = requirements.targetMonth;
    const [year, month] = targetMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    // 夜勤があるかどうかを判定
    const shiftTypeNames = (requirements.timeSlots || []).map(t => t.name);
    const hasNightShift = shiftTypeNames.some(name => name.includes('夜'));

    let totalRequired = 0;
    let totalAssigned = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${targetMonth}-${String(day).padStart(2, '0')}`;

      // 営業外の日はスキップ
      if (!this.isBusinessDay(date, hasNightShift)) {
        continue;
      }

      for (const [shiftName, requirement] of Object.entries(
        requirements.requirements
      )) {
        totalRequired += requirement.totalStaff;

        // 実際の配置人数をカウント
        let assigned = 0;
        for (const staffSchedule of schedule) {
          const shift = staffSchedule.monthlyShifts.find(
            (s) => s.date === date
          );
          if (shift && shift.shiftType === shiftName) {
            assigned++;
          }
        }
        totalAssigned += Math.min(assigned, requirement.totalStaff);
      }
    }

    if (totalRequired === 0) return 100;
    return Math.round((totalAssigned / totalRequired) * 100);
  }

  /**
   * 改善提案を生成
   */
  private generateRecommendations(
    violations: ConstraintViolation[],
    input: EvaluationInput,
    score?: number
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const grouped = groupViolationsByLevel(violations);

    // Phase 53: レベル別コメント生成を使用
    const currentScore = score ?? this.calculateOverallScore(violations);
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
