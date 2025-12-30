/**
 * DiagnosisService - データ設定診断サービス
 * Phase 55: データ設定診断機能
 *
 * AIシフト生成前にデータ設定の問題を検出し、
 * ユーザーに具体的なフィードバックを提供する
 */

import {
  Staff,
  ShiftRequirement,
  LeaveRequest,
  TimeSlotPreference,
} from '../types';
import {
  DiagnosisResult,
  DiagnosisStatus,
  SupplyDemandBalance,
  TimeSlotBalance,
  DiagnosisIssue,
  DiagnosisSuggestion,
  IssueSeverity,
} from './types';

/**
 * 休暇申請集中の分析結果
 */
interface LeaveConcentration {
  date: string;
  staffNames: string[];
  count: number;
}

export class DiagnosisService {
  /**
   * 事前診断を実行
   */
  diagnose(
    staffList: Staff[],
    requirements: ShiftRequirement,
    leaveRequests: LeaveRequest
  ): DiagnosisResult {
    // 1. 営業日数を計算
    const businessDays = this.calculateBusinessDays(requirements);

    // 2. 需給バランスを計算
    const supplyDemandBalance = this.calculateSupplyDemandBalance(
      staffList,
      requirements,
      businessDays
    );

    // 3. 問題を検出
    const issues = this.detectIssues(
      staffList,
      requirements,
      leaveRequests,
      supplyDemandBalance,
      businessDays
    );

    // 4. 改善提案を生成
    const suggestions = this.generateSuggestions(
      staffList,
      requirements,
      issues,
      supplyDemandBalance
    );

    // 5. ステータスとサマリーを決定
    const status = this.determineStatus(issues, supplyDemandBalance);
    const summary = this.generateSummary(status, issues, supplyDemandBalance);

    return {
      status,
      summary,
      supplyDemandBalance,
      issues,
      suggestions,
      executedAt: new Date().toISOString(),
    };
  }

  /**
   * 営業日数を計算
   * 夜勤がない場合は平日のみ、夜勤がある場合は土日祝も含む
   */
  private calculateBusinessDays(requirements: ShiftRequirement): number {
    const [year, month] = requirements.targetMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    // 夜勤があるかどうかを判定
    const hasNightShift = requirements.timeSlots.some(
      (slot) => slot.name.includes('夜')
    );

    let businessDays = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay();

      if (hasNightShift) {
        // 夜勤ありの場合は全日
        businessDays++;
      } else {
        // 夜勤なしの場合は平日のみ（土日除外）
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          businessDays++;
        }
      }
    }

    return businessDays;
  }

  /**
   * 需給バランスを計算
   */
  private calculateSupplyDemandBalance(
    staffList: Staff[],
    requirements: ShiftRequirement,
    businessDays: number
  ): SupplyDemandBalance {
    // 総供給を計算（各スタッフの週希望勤務日数 × 月の週数）
    const weeksInMonth = 4.5;
    let totalSupply = 0;
    staffList.forEach((staff) => {
      totalSupply += Math.round(staff.weeklyWorkCount.hope * weeksInMonth);
    });

    // 総需要を計算（1日あたりの必要人員 × 営業日数）
    let dailyRequired = 0;
    for (const req of Object.values(requirements.requirements)) {
      dailyRequired += req.totalStaff;
    }
    const totalDemand = businessDays * dailyRequired;

    // 時間帯別のバランスを計算
    const byTimeSlot = this.calculateTimeSlotBalances(
      staffList,
      requirements,
      businessDays
    );

    return {
      totalSupply,
      totalDemand,
      balance: totalSupply - totalDemand,
      byTimeSlot,
    };
  }

  /**
   * 時間帯別の需給バランスを計算
   */
  private calculateTimeSlotBalances(
    staffList: Staff[],
    requirements: ShiftRequirement,
    businessDays: number
  ): { [slotName: string]: TimeSlotBalance } {
    const result: { [slotName: string]: TimeSlotBalance } = {};
    const weeksInMonth = 4.5;

    // 時間帯ごとに処理
    for (const [slotName, req] of Object.entries(requirements.requirements)) {
      const demand = businessDays * req.totalStaff;

      // この時間帯に配置可能なスタッフの供給を計算
      let supply = 0;
      staffList.forEach((staff) => {
        if (this.canWorkInTimeSlot(staff, slotName)) {
          // 時間帯に配置可能なスタッフの人日数
          // 簡略化：全時間帯数で按分
          const timeSlotCount = Object.keys(requirements.requirements).length;
          const staffMonthlyDays = Math.round(
            staff.weeklyWorkCount.hope * weeksInMonth
          );
          supply += Math.round(staffMonthlyDays / timeSlotCount);
        }
      });

      const balance = supply - demand;
      const fulfillmentRate =
        demand > 0 ? Math.round((supply / demand) * 100) : 100;

      result[slotName] = {
        supply,
        demand,
        balance,
        fulfillmentRate,
      };
    }

    return result;
  }

  /**
   * スタッフが指定時間帯に勤務可能かどうかを判定
   */
  private canWorkInTimeSlot(staff: Staff, slotName: string): boolean {
    const preference = staff.timeSlotPreference;

    // 夜勤専従の場合
    if (staff.isNightShiftOnly) {
      return slotName.includes('夜');
    }

    // 日勤のみの場合
    if (preference === TimeSlotPreference.DayOnly) {
      return slotName.includes('日勤') || slotName === '日';
    }

    // 夜勤のみの場合
    if (preference === TimeSlotPreference.NightOnly) {
      return slotName.includes('夜');
    }

    // いつでも可の場合
    return true;
  }

  /**
   * 問題を検出
   */
  private detectIssues(
    staffList: Staff[],
    requirements: ShiftRequirement,
    leaveRequests: LeaveRequest,
    balance: SupplyDemandBalance,
    businessDays: number
  ): DiagnosisIssue[] {
    const issues: DiagnosisIssue[] = [];

    // 1. 総供給不足を検出
    if (balance.balance < 0) {
      const shortage = Math.abs(balance.balance);
      const severity: IssueSeverity =
        shortage > balance.totalDemand * 0.3 ? 'high' : 'medium';

      issues.push({
        id: `supply-shortage-${Date.now()}`,
        severity,
        category: 'supply',
        title: '総人員数が不足',
        description: `総供給人日数${balance.totalSupply}に対し、必要人日数${balance.totalDemand}。${shortage}人日不足`,
      });
    }

    // 2. 時間帯制約問題を検出
    const dayOnlyStaff = staffList.filter(
      (s) => s.timeSlotPreference === TimeSlotPreference.DayOnly
    );
    if (dayOnlyStaff.length > 0) {
      // 日勤枠の占有率を計算
      const daySlot = balance.byTimeSlot['日勤'];
      if (daySlot) {
        const weeksInMonth = 4.5;
        let dayOnlySupply = 0;
        dayOnlyStaff.forEach((s) => {
          dayOnlySupply += Math.round(s.weeklyWorkCount.hope * weeksInMonth);
        });

        // 日勤のみスタッフが日勤需要の50%以上を占める場合に警告
        if (dayOnlySupply > daySlot.demand * 0.5) {
          const staffNames = dayOnlyStaff.map((s) => s.name);
          issues.push({
            id: `timeslot-constraint-${Date.now()}`,
            severity: 'high',
            category: 'timeSlot',
            title: '「日勤のみ」スタッフが日勤枠を占有',
            description: `${staffNames.join('、')}の${dayOnlyStaff.length}名が「日勤のみ」設定で日勤必要数の大部分を消費しています。早番・遅番に配置可能なスタッフが不足する可能性があります。`,
            affectedStaff: staffNames,
          });
        }
      }
    }

    // 3. 特定時間帯の供給不足を検出
    for (const [slotName, slotBalance] of Object.entries(balance.byTimeSlot)) {
      if (slotBalance.balance < 0 && slotBalance.fulfillmentRate < 80) {
        issues.push({
          id: `slot-shortage-${slotName}-${Date.now()}`,
          severity: slotBalance.fulfillmentRate < 50 ? 'high' : 'medium',
          category: 'timeSlot',
          title: `${slotName}の人員不足`,
          description: `${slotName}の充足率が${slotBalance.fulfillmentRate}%です。${Math.abs(slotBalance.balance)}人日不足`,
        });
      }
    }

    // 4. 休暇申請集中を検出
    const leaveConcentrations = this.detectLeaveConcentration(
      staffList,
      leaveRequests,
      requirements.targetMonth
    );
    leaveConcentrations.forEach((concentration) => {
      // 全スタッフの30%以上が同じ日に休暇申請している場合
      if (concentration.count >= Math.ceil(staffList.length * 0.3)) {
        issues.push({
          id: `leave-concentration-${concentration.date}`,
          severity: 'medium',
          category: 'leave',
          title: `${concentration.date.split('-').slice(1).join('/')}に休暇申請が集中`,
          description: `${concentration.staffNames.join('、')}の${concentration.count}名が休暇申請`,
          affectedStaff: concentration.staffNames,
          affectedDates: [concentration.date],
        });
      }
    });

    return issues;
  }

  /**
   * 休暇申請の集中を検出
   */
  private detectLeaveConcentration(
    staffList: Staff[],
    leaveRequests: LeaveRequest,
    targetMonth: string
  ): LeaveConcentration[] {
    const dateMap = new Map<string, string[]>();

    // スタッフ名をIDから取得するためのマップ
    const staffNameMap = new Map<string, string>();
    staffList.forEach((s) => staffNameMap.set(s.id, s.name));

    // 休暇申請を日付ごとに集計
    for (const [staffId, requests] of Object.entries(leaveRequests)) {
      for (const date of Object.keys(requests)) {
        // 対象月のみ
        if (date.startsWith(targetMonth)) {
          if (!dateMap.has(date)) {
            dateMap.set(date, []);
          }
          const staffName = staffNameMap.get(staffId) || staffId;
          dateMap.get(date)!.push(staffName);
        }
      }
    }

    // 集中している日付を抽出
    const concentrations: LeaveConcentration[] = [];
    dateMap.forEach((staffNames, date) => {
      concentrations.push({
        date,
        staffNames,
        count: staffNames.length,
      });
    });

    // カウント順にソート
    return concentrations.sort((a, b) => b.count - a.count);
  }

  /**
   * 改善提案を生成
   */
  private generateSuggestions(
    staffList: Staff[],
    requirements: ShiftRequirement,
    issues: DiagnosisIssue[],
    balance: SupplyDemandBalance
  ): DiagnosisSuggestion[] {
    const suggestions: DiagnosisSuggestion[] = [];

    // 1. 時間帯制約が原因の場合
    const timeSlotIssues = issues.filter((i) => i.category === 'timeSlot');
    if (timeSlotIssues.length > 0) {
      const dayOnlyStaff = staffList.filter(
        (s) => s.timeSlotPreference === TimeSlotPreference.DayOnly
      );
      dayOnlyStaff.forEach((staff) => {
        suggestions.push({
          priority: 'high',
          action: `${staff.name}の時間帯設定を「いつでも可」に変更`,
          impact: '早番・遅番の柔軟性が向上します',
          targetStaff: staff.name,
          settingsLink: `/settings/staff/${staff.id}`,
        });
      });
    }

    // 2. スタッフ数不足の場合
    if (balance.balance < 0) {
      const shortage = Math.abs(balance.balance);
      const weeksInMonth = 4.5;
      const avgWorkDays = 5; // 平均週5日勤務と仮定
      const neededStaff = Math.ceil(
        shortage / (avgWorkDays * weeksInMonth)
      );

      // 早番・遅番の不足が大きい場合
      const earlyLateShortage =
        (balance.byTimeSlot['早番']?.balance || 0) +
        (balance.byTimeSlot['遅番']?.balance || 0);

      if (earlyLateShortage < 0) {
        suggestions.push({
          priority: 'high',
          action: `早番・遅番対応可能なスタッフを${neededStaff}名追加`,
          impact: `${Math.abs(earlyLateShortage)}人日の不足が解消されます`,
          settingsLink: '/settings/staff/new',
        });
      } else {
        suggestions.push({
          priority: 'medium',
          action: `スタッフを${neededStaff}名追加採用`,
          impact: `${shortage}人日の不足が解消されます`,
          settingsLink: '/settings/staff/new',
        });
      }
    }

    // 3. 休暇集中の場合
    const leaveIssues = issues.filter((i) => i.category === 'leave');
    leaveIssues.forEach((issue) => {
      suggestions.push({
        priority: 'low',
        action: `${issue.affectedDates?.[0]}の休暇申請を調整`,
        impact: '人員配置の柔軟性が向上します',
      });
    });

    // 優先度順にソート
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return suggestions.sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
    );
  }

  /**
   * ステータスを決定
   */
  private determineStatus(
    issues: DiagnosisIssue[],
    balance: SupplyDemandBalance
  ): DiagnosisStatus {
    // 重大な不足（需要の30%以上不足）はerror
    if (balance.balance < -balance.totalDemand * 0.3) {
      return 'error';
    }

    // 高重要度の問題がある場合はerror
    if (issues.some((i) => i.severity === 'high')) {
      // ただし時間帯制約のみの場合はwarning
      const highIssues = issues.filter((i) => i.severity === 'high');
      const onlyTimeSlotIssues = highIssues.every(
        (i) => i.category === 'timeSlot'
      );
      if (onlyTimeSlotIssues) {
        return 'warning';
      }
      return 'error';
    }

    // 何らかの問題がある場合はwarning
    if (issues.length > 0) {
      return 'warning';
    }

    // 問題なし
    return 'ok';
  }

  /**
   * サマリーメッセージを生成
   */
  private generateSummary(
    status: DiagnosisStatus,
    issues: DiagnosisIssue[],
    balance: SupplyDemandBalance
  ): string {
    switch (status) {
      case 'ok':
        return 'データ設定に問題はありません。シフト生成を実行できます。';

      case 'warning': {
        const timeSlotIssue = issues.find((i) => i.category === 'timeSlot');
        if (timeSlotIssue) {
          return '時間帯制約により、一部の時間帯で人員不足が発生する可能性があります。';
        }
        const leaveIssue = issues.find((i) => i.category === 'leave');
        if (leaveIssue) {
          return '特定日に休暇申請が集中しています。人員配置に注意が必要です。';
        }
        return '軽微な問題が検出されました。確認の上、シフト生成を実行してください。';
      }

      case 'error': {
        const shortage = Math.abs(balance.balance);
        if (shortage > 0) {
          return `スタッフの勤務日数が大幅に不足しています（${shortage}人日不足）。設定を見直してください。`;
        }
        return 'データ設定に重大な問題があります。設定を見直してください。';
      }

      default:
        return '診断を完了しました。';
    }
  }
}
