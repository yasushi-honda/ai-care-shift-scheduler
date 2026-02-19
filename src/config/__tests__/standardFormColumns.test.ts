/**
 * standardFormColumns.test.ts
 *
 * Phase 66: 列定義Config のユニットテスト
 * - getColumnConfig が各サービス種別で正しい列数・列キーを返すことを検証
 */

import { describe, it, expect } from 'vitest';
import { getColumnConfig } from '../standardFormColumns';
import type { CareServiceType } from '../../../types';

describe('getColumnConfig', () => {
  describe('通所介護（デフォルト）', () => {
    it('固定列7列・集計列3列を返す', () => {
      const config = getColumnConfig('通所介護');
      expect(config.fixedColumns).toHaveLength(7);
      expect(config.tailColumns).toHaveLength(3);
    });

    it('固定列に正しいキーを持つ', () => {
      const config = getColumnConfig('通所介護');
      const keys = config.fixedColumns.map((c) => c.key);
      expect(keys).toEqual(['no', 'name', 'role', 'qualification', 'employment', 'concurrency', 'hireDate']);
    });

    it('集計列に正しいキーを持つ', () => {
      const config = getColumnConfig('通所介護');
      const keys = config.tailColumns.map((c) => c.key);
      expect(keys).toEqual(['monthlyHours', 'weeklyAvg', 'fte']);
    });
  });

  describe('訪問介護', () => {
    it('固定列8列（+サービス提供時間）・集計列3列を返す', () => {
      const config = getColumnConfig('訪問介護');
      expect(config.fixedColumns).toHaveLength(8);
      expect(config.tailColumns).toHaveLength(3);
    });

    it('固定列最後にserviceHoursキーを持つ', () => {
      const config = getColumnConfig('訪問介護');
      const lastFixed = config.fixedColumns[config.fixedColumns.length - 1];
      expect(lastFixed.key).toBe('serviceHours');
    });

    it('集計列は通所介護と同一', () => {
      const config = getColumnConfig('訪問介護');
      const keys = config.tailColumns.map((c) => c.key);
      expect(keys).toEqual(['monthlyHours', 'weeklyAvg', 'fte']);
    });
  });

  describe('介護老人福祉施設（特養）', () => {
    it('固定列7列・集計列4列（+夜間勤務h）を返す', () => {
      const config = getColumnConfig('介護老人福祉施設');
      expect(config.fixedColumns).toHaveLength(7);
      expect(config.tailColumns).toHaveLength(4);
    });

    it('集計列最後にnightHoursキーを持つ', () => {
      const config = getColumnConfig('介護老人福祉施設');
      const lastTail = config.tailColumns[config.tailColumns.length - 1];
      expect(lastTail.key).toBe('nightHours');
    });

    it('固定列は通所介護と同一', () => {
      const config = getColumnConfig('介護老人福祉施設');
      const keys = config.fixedColumns.map((c) => c.key);
      expect(keys).toEqual(['no', 'name', 'role', 'qualification', 'employment', 'concurrency', 'hireDate']);
    });
  });

  describe('その他サービス種別（デフォルト動作）', () => {
    const otherTypes: CareServiceType[] = [
      '訪問入浴介護',
      '訪問看護',
      '通所リハビリテーション',
      '短期入所生活介護',
      '特定施設入居者生活介護',
      '介護老人保健施設',
      '認知症対応型共同生活介護',
      'その他',
    ];

    it.each(otherTypes)('%s は固定7列・集計3列を返す', (serviceType) => {
      const config = getColumnConfig(serviceType);
      expect(config.fixedColumns).toHaveLength(7);
      expect(config.tailColumns).toHaveLength(3);
    });
  });

  describe('列定義の必須フィールド', () => {
    it('全列定義が key/headerText/widthClass/excelWidth を持つ', () => {
      const config = getColumnConfig('介護老人福祉施設');
      for (const col of [...config.fixedColumns, ...config.tailColumns]) {
        expect(col.key).toBeTruthy();
        expect(col.headerText).toBeTruthy();
        expect(col.widthClass).toBeTruthy();
        expect(col.excelWidth).toBeGreaterThan(0);
      }
    });
  });
});
