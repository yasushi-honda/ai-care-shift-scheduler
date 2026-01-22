/**
 * reevaluateShift.ts ユニットテスト
 *
 * テスト対象:
 * - createDefaultRequirements: デフォルト要件生成
 *
 * 注: Cloud Function本体（reevaluateShift）は Firebase Admin SDK に依存するため
 * 統合テストでカバーする。このファイルでは純粋関数のみをテスト。
 */

import { createDefaultRequirements } from '../../src/reevaluateShift';

describe('reevaluateShift', () => {
  describe('createDefaultRequirements', () => {
    it('指定された対象月を含む要件を生成する', () => {
      const requirements = createDefaultRequirements('2025-11');
      expect(requirements.targetMonth).toBe('2025-11');
    });

    it('3つのタイムスロット（早番、日勤、遅番）を含む', () => {
      const requirements = createDefaultRequirements('2025-11');
      expect(requirements.timeSlots).toHaveLength(3);

      const slotNames = requirements.timeSlots.map(s => s.name);
      expect(slotNames).toContain('早番');
      expect(slotNames).toContain('日勤');
      expect(slotNames).toContain('遅番');
    });

    it('各タイムスロットの時間設定が正しい', () => {
      const requirements = createDefaultRequirements('2025-11');

      const earlyShift = requirements.timeSlots.find(s => s.name === '早番');
      expect(earlyShift?.start).toBe('07:00');
      expect(earlyShift?.end).toBe('16:00');
      expect(earlyShift?.restHours).toBe(1);

      const dayShift = requirements.timeSlots.find(s => s.name === '日勤');
      expect(dayShift?.start).toBe('09:00');
      expect(dayShift?.end).toBe('18:00');
      expect(dayShift?.restHours).toBe(1);

      const lateShift = requirements.timeSlots.find(s => s.name === '遅番');
      expect(lateShift?.start).toBe('11:00');
      expect(lateShift?.end).toBe('20:00');
      expect(lateShift?.restHours).toBe(1);
    });

    it('各シフトの人員要件が正しい', () => {
      const requirements = createDefaultRequirements('2025-11');

      expect(requirements.requirements['早番'].totalStaff).toBe(2);
      expect(requirements.requirements['日勤'].totalStaff).toBe(3);
      expect(requirements.requirements['遅番'].totalStaff).toBe(2);
    });

    it('資格要件と役割要件は空配列', () => {
      const requirements = createDefaultRequirements('2025-11');

      for (const [, req] of Object.entries(requirements.requirements)) {
        expect(req.requiredQualifications).toEqual([]);
        expect(req.requiredRoles).toEqual([]);
      }
    });

    it('異なる対象月でも正しく要件を生成する', () => {
      const dec = createDefaultRequirements('2025-12');
      expect(dec.targetMonth).toBe('2025-12');

      const jan = createDefaultRequirements('2026-01');
      expect(jan.targetMonth).toBe('2026-01');
    });
  });
});
