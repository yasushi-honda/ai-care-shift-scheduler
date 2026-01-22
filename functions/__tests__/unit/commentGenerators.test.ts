/**
 * commentGenerators.ts ユニットテスト
 *
 * テスト対象:
 * - generateAIComment: スコア別AIコメント生成
 * - generateCriticalComment: 重大コメント（スコア0）
 * - generateSevereComment: 重大コメント（スコア1-30）
 * - generateWarningComment: 警告コメント（スコア31-59）
 * - generateFairComment: 普通コメント（スコア60-79）
 * - generateGoodComment: 良好コメント（スコア80-100）
 * - generateRecommendations: 改善提案生成
 */

import {
  generateAIComment,
  generateCriticalComment,
  generateSevereComment,
  generateWarningComment,
  generateFairComment,
  generateGoodComment,
  generateRecommendations,
} from '../../src/evaluation/commentGenerators';
import {
  ConstraintViolation,
  Recommendation,
} from '../../src/types';

describe('commentGenerators', () => {
  describe('generateAIComment', () => {
    it('スコア0の場合は重大コメントを返す', () => {
      const violations: ConstraintViolation[] = [
        { type: 'nightRestViolation', severity: 'error', description: '夜勤後休息不足' },
      ];
      const comment = generateAIComment(0, 50, violations, []);
      expect(comment).toContain('労基法違反');
    });

    it('スコア1-30の場合は重大コメントを返す', () => {
      const violations: ConstraintViolation[] = [
        { type: 'staffShortage', severity: 'error', description: '人員不足' },
      ];
      const comment = generateAIComment(25, 60, violations, []);
      expect(comment).toContain('重大な問題');
    });

    it('スコア31-59の場合は警告コメントを返す', () => {
      const violations: ConstraintViolation[] = [
        { type: 'staffShortage', severity: 'error', description: '人員不足' },
      ];
      const comment = generateAIComment(50, 70, violations, []);
      expect(comment).toContain('いくつかの問題');
    });

    it('スコア60-79の場合は普通コメントを返す', () => {
      const violations: ConstraintViolation[] = [
        { type: 'consecutiveWork', severity: 'warning', description: '連勤' },
      ];
      const comment = generateAIComment(70, 85, violations, []);
      expect(comment).toContain('概ね良好');
    });

    it('スコア80-100の場合は良好コメントを返す', () => {
      const comment = generateAIComment(90, 95, [], []);
      expect(comment).toContain('良好');
    });
  });

  describe('generateCriticalComment', () => {
    it('レベル1違反（夜勤後休息不足）がある場合は労基法違反メッセージ', () => {
      const violationCounts = { nightRestViolation: 1 };
      const violations: ConstraintViolation[] = [
        { type: 'nightRestViolation', severity: 'error', description: '夜勤後休息不足' },
      ];
      const comment = generateCriticalComment(violationCounts, 50, violations);
      expect(comment).toContain('労基法違反');
      expect(comment).toContain('使用できません');
    });

    it('大量の人員不足がある場合はその件数を表示', () => {
      const violationCounts = { staffShortage: 15 };
      const violations: ConstraintViolation[] = Array(15).fill(null).map((_, i) => ({
        type: 'staffShortage' as const,
        severity: 'error' as const,
        description: `2025-11-${String(i + 1).padStart(2, '0')}の日勤で1名の人員不足`,
      }));
      const comment = generateCriticalComment(violationCounts, 30, violations);
      expect(comment).toContain('15件の人員不足');
    });

    it('シフト種別ごとの不足日数を分析', () => {
      const violationCounts = { staffShortage: 3 };
      const violations: ConstraintViolation[] = [
        { type: 'staffShortage', severity: 'error', description: '2025-11-01の早番で1名の人員不足' },
        { type: 'staffShortage', severity: 'error', description: '2025-11-02の早番で1名の人員不足' },
        { type: 'staffShortage', severity: 'error', description: '2025-11-03の日勤で1名の人員不足' },
      ];
      const comment = generateCriticalComment(violationCounts, 60, violations);
      expect(comment).toContain('早番2日');
      expect(comment).toContain('日勤1日');
    });
  });

  describe('generateSevereComment', () => {
    it('人員不足がある場合はその件数を含む', () => {
      const violationCounts = { staffShortage: 5 };
      const comment = generateSevereComment(violationCounts, 5, 0);
      expect(comment).toContain('人員不足が5件');
      expect(comment).toContain('重大な問題');
    });

    it('連勤超過がある場合はその件数を含む', () => {
      const violationCounts = { consecutiveWork: 3 };
      const comment = generateSevereComment(violationCounts, 0, 3);
      expect(comment).toContain('連勤超過が3件');
    });

    it('夜勤後休息不足がある場合はその件数を含む', () => {
      const violationCounts = { nightRestViolation: 2 };
      const comment = generateSevereComment(violationCounts, 2, 0);
      expect(comment).toContain('夜勤後休息不足が2件');
    });

    it('複数の問題がある場合は最大2件まで表示', () => {
      const violationCounts = {
        staffShortage: 5,
        consecutiveWork: 3,
        nightRestViolation: 2,
      };
      const comment = generateSevereComment(violationCounts, 7, 3);
      // 最初の2件のみ
      expect(comment).toContain('人員不足');
      expect(comment).toContain('連勤超過');
    });
  });

  describe('generateWarningComment', () => {
    it('主要な問題を特定して表示', () => {
      const violationCounts = { staffShortage: 10, consecutiveWork: 2 };
      const comment = generateWarningComment(violationCounts, 10, 2);
      expect(comment).toContain('人員不足に関する問題が多く');
    });

    it('違反がない場合は一般的なメッセージ', () => {
      const comment = generateWarningComment({}, 2, 3);
      expect(comment).toContain('いくつかの問題が検出');
      expect(comment).toContain('エラー2件');
      expect(comment).toContain('警告3件');
    });

    it('休暇希望の問題を適切にラベル付け', () => {
      const violationCounts = { leaveRequestIgnored: 5 };
      const comment = generateWarningComment(violationCounts, 0, 5);
      expect(comment).toContain('休暇希望に関する問題');
    });
  });

  describe('generateFairComment', () => {
    it('警告がある場合はその件数と充足率を表示', () => {
      const comment = generateFairComment({}, 3, 85);
      expect(comment).toContain('3件の警告');
      expect(comment).toContain('85%');
    });

    it('警告がない場合は概ね良好なメッセージ', () => {
      const comment = generateFairComment({}, 0, 90);
      expect(comment).toContain('概ね適切');
      expect(comment).toContain('90%');
    });
  });

  describe('generateGoodComment', () => {
    it('充足率95%以上で低優先度提案がある場合は確定推奨', () => {
      const recommendations: Recommendation[] = [
        { priority: 'low', category: 'general', description: '微調整', action: '' },
      ];
      const comment = generateGoodComment(98, recommendations);
      expect(comment).toContain('確定しても問題ありません');
      expect(comment).toContain('98%');
    });

    it('一般的な良好メッセージ', () => {
      const comment = generateGoodComment(85, []);
      expect(comment).toContain('良好なシフト案');
      expect(comment).toContain('85%');
    });
  });

  describe('generateRecommendations', () => {
    it('違反がない場合も基本的な提案を生成', () => {
      const recommendations = generateRecommendations([], 100);
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].category).toBe('general');
    });

    it('レベル1違反（夜勤後休息不足）がある場合は高優先度で提案', () => {
      const violations: ConstraintViolation[] = [
        { type: 'nightRestViolation', severity: 'error', description: '夜勤後休息不足' },
      ];
      const recommendations = generateRecommendations(violations);
      const nightRestRec = recommendations.find(r =>
        r.description.includes('夜勤後の休息') || r.description.includes('実現不可能')
      );
      expect(nightRestRec).toBeDefined();
      expect(nightRestRec?.priority).toBe('high');
    });

    it('人員不足が5件以上の場合は高優先度で提案', () => {
      const violations: ConstraintViolation[] = Array(6).fill(null).map(() => ({
        type: 'staffShortage' as const,
        severity: 'error' as const,
        description: '人員不足',
      }));
      const recommendations = generateRecommendations(violations);
      const staffingRec = recommendations.find(r => r.category === 'staffing');
      expect(staffingRec).toBeDefined();
      expect(staffingRec?.priority).toBe('high');
    });

    it('連勤超過が2件以上の場合は中優先度で提案', () => {
      const violations: ConstraintViolation[] = [
        { type: 'consecutiveWork', severity: 'warning', description: '連勤超過1' },
        { type: 'consecutiveWork', severity: 'warning', description: '連勤超過2' },
      ];
      const recommendations = generateRecommendations(violations);
      const workloadRec = recommendations.find(r =>
        r.category === 'workload' && r.description.includes('連勤')
      );
      expect(workloadRec).toBeDefined();
      expect(workloadRec?.priority).toBe('medium');
    });

    it('休暇希望未反映がある場合は低優先度で提案', () => {
      const violations: ConstraintViolation[] = [
        { type: 'leaveRequestIgnored', severity: 'warning', description: '休暇希望未反映' },
      ];
      const recommendations = generateRecommendations(violations);
      const fairnessRec = recommendations.find(r => r.category === 'fairness');
      expect(fairnessRec).toBeDefined();
      expect(fairnessRec?.priority).toBe('low');
    });
  });
});
