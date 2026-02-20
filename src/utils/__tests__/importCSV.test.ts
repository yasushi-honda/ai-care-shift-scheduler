/**
 * importCSV.test.ts
 *
 * CSV一括インポート機能のユニットテスト
 * - テンプレート生成（職員・施設）
 * - 職員CSVパース・バリデーション
 * - 施設CSVパース・バリデーション
 * - 施設名付き職員CSVパース・バリデーション
 */

import { describe, it, expect } from 'vitest';
import {
  generateStaffTemplate,
  generateFacilityTemplate,
  parseAndValidateStaffCSV,
  parseAndValidateFacilityCSV,
  parseAndValidateStaffWithFacilityCSV,
  STAFF_CSV_HEADERS,
  FACILITY_CSV_HEADERS,
} from '../importCSV';

// ==================== テストデータヘルパー ====================

/** 有効な職員CSV1行を生成する */
function buildValidStaffCsvRow(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    '名前': '山田太郎',
    '役職': '介護職員',
    '資格': '介護福祉士',
    '勤務形態区分': 'A',
    '契約週時間': '40',
    '週間勤務数（希望）': '5',
    '週間勤務数（必須）': '4',
    '最大連続勤務日数': '5',
    '利用可能曜日': '月, 火, 水, 木, 金',
    '時間帯希望': 'いつでも可',
    '夜勤専従': 'いいえ',
    '雇用開始日': '2024-04-01',
    ...overrides,
  };
}

/** レコードからCSV文字列を構築する */
function buildCsvString(headers: readonly string[], rows: Record<string, string>[]): string {
  const headerLine = headers.join(',');
  const dataLines = rows.map((row) =>
    headers.map((h) => {
      const val = row[h] ?? '';
      // カンマを含む場合はダブルクォートで囲む
      return val.includes(',') ? `"${val}"` : val;
    }).join(',')
  );
  return [headerLine, ...dataLines].join('\n');
}

/** 職員CSV文字列を構築する */
function buildStaffCsv(rows: Record<string, string>[]): string {
  return buildCsvString(STAFF_CSV_HEADERS, rows);
}

/** 施設CSV文字列を構築する */
function buildFacilityCsv(rows: Record<string, string>[]): string {
  return buildCsvString(FACILITY_CSV_HEADERS, rows);
}

/** 施設名付き職員CSV文字列を構築する */
function buildStaffWithFacilityCsv(rows: Record<string, string>[]): string {
  const headers = ['施設名', ...STAFF_CSV_HEADERS];
  return buildCsvString(headers, rows);
}

// ==================== generateStaffTemplate ====================

describe('importCSV', () => {
  describe('generateStaffTemplate', () => {
    it('テンプレートがBOM付きUTF-8であること', () => {
      const template = generateStaffTemplate();
      expect(template.startsWith('\uFEFF')).toBe(true);
    });

    it('ヘッダー行に全必須列が含まれること', () => {
      const template = generateStaffTemplate();
      const firstLine = template.replace(/^\uFEFF/, '').split('\n')[0];
      for (const header of STAFF_CSV_HEADERS) {
        expect(firstLine).toContain(header);
      }
    });

    it('サンプルデータが2行含まれること', () => {
      const template = generateStaffTemplate();
      const lines = template.replace(/^\uFEFF/, '').split('\n').filter((line) => line.trim() !== '');
      // ヘッダー1行 + データ2行 = 3行
      expect(lines.length).toBe(3);
    });
  });

  // ==================== generateFacilityTemplate ====================

  describe('generateFacilityTemplate', () => {
    it('テンプレートがBOM付きUTF-8であること', () => {
      const template = generateFacilityTemplate();
      expect(template.startsWith('\uFEFF')).toBe(true);
    });

    it('ヘッダー行に全必須列が含まれること', () => {
      const template = generateFacilityTemplate();
      const firstLine = template.replace(/^\uFEFF/, '').split('\n')[0];
      for (const header of FACILITY_CSV_HEADERS) {
        expect(firstLine).toContain(header);
      }
    });
  });

  // ==================== parseAndValidateStaffCSV ====================

  describe('parseAndValidateStaffCSV', () => {
    // --- 正常系 ---

    it('有効なCSVデータを正しくパースできること', () => {
      const csv = buildStaffCsv([buildValidStaffCsvRow()]);
      const result = parseAndValidateStaffCSV(csv);

      expect(result.totalRows).toBe(1);
      expect(result.validRows).toBe(1);
      expect(result.invalidRows).toBe(0);
      expect(result.parsedData).toHaveLength(1);
    });

    it('全フィールドが適切にStaffオブジェクトに変換されること', () => {
      const csv = buildStaffCsv([buildValidStaffCsvRow()]);
      const result = parseAndValidateStaffCSV(csv);
      const staff = result.parsedData[0];

      expect(staff.name).toBe('山田太郎');
      expect(staff.role).toBe('介護職員');
      expect(staff.qualifications).toEqual(['介護福祉士']);
      expect(staff.employmentType).toBe('A');
      expect(staff.weeklyContractHours).toBe(40);
      expect(staff.weeklyWorkCount).toEqual({ hope: 5, must: 4 });
      expect(staff.maxConsecutiveWorkDays).toBe(5);
      expect(staff.availableWeekdays).toEqual([1, 2, 3, 4, 5]);
      expect(staff.timeSlotPreference).toBe('いつでも可');
      expect(staff.isNightShiftOnly).toBe(false);
      expect(staff.hireDate).toBe('2024-04-01');
    });

    it('任意フィールドが空の場合にデフォルト値が適用されること', () => {
      const csv = buildStaffCsv([buildValidStaffCsvRow({
        '資格': '',
        '勤務形態区分': '',
        '契約週時間': '',
        '週間勤務数（希望）': '',
        '週間勤務数（必須）': '',
        '最大連続勤務日数': '',
        '利用可能曜日': '',
        '時間帯希望': '',
        '夜勤専従': '',
        '雇用開始日': '',
      })]);
      const result = parseAndValidateStaffCSV(csv);
      const staff = result.parsedData[0];

      expect(staff.qualifications).toEqual([]);
      expect(staff.employmentType).toBeUndefined();
      expect(staff.weeklyContractHours).toBeUndefined();
      expect(staff.weeklyWorkCount).toEqual({ hope: 4, must: 4 });
      expect(staff.maxConsecutiveWorkDays).toBe(5);
      expect(staff.availableWeekdays).toEqual([0, 1, 2, 3, 4, 5, 6]);
      expect(staff.timeSlotPreference).toBe('いつでも可');
      expect(staff.isNightShiftOnly).toBe(false);
      expect(staff.hireDate).toBeUndefined();
    });

    // --- 異常系 ---

    it('名前が空の行でエラーが出ること', () => {
      const csv = buildStaffCsv([buildValidStaffCsvRow({ '名前': '' })]);
      const result = parseAndValidateStaffCSV(csv);

      expect(result.invalidRows).toBe(1);
      expect(result.results[0].isValid).toBe(false);
      expect(result.results[0].errors.some((e) => e.includes('名前'))).toBe(true);
    });

    it('無効な役職でエラーが出ること', () => {
      const csv = buildStaffCsv([buildValidStaffCsvRow({ '役職': '無効な役職' })]);
      const result = parseAndValidateStaffCSV(csv);

      expect(result.invalidRows).toBe(1);
      expect(result.results[0].errors.some((e) => e.includes('役職'))).toBe(true);
    });

    it('無効な資格でエラーが出ること', () => {
      const csv = buildStaffCsv([buildValidStaffCsvRow({ '資格': '存在しない資格' })]);
      const result = parseAndValidateStaffCSV(csv);

      expect(result.invalidRows).toBe(1);
      expect(result.results[0].errors.some((e) => e.includes('資格'))).toBe(true);
    });

    it('勤務形態区分がA/B/C/D以外でエラーが出ること', () => {
      const csv = buildStaffCsv([buildValidStaffCsvRow({ '勤務形態区分': 'E' })]);
      const result = parseAndValidateStaffCSV(csv);

      expect(result.invalidRows).toBe(1);
      expect(result.results[0].errors.some((e) => e.includes('勤務形態区分'))).toBe(true);
    });

    it('契約週時間が範囲外（0-168）でエラーが出ること', () => {
      const csvNeg = buildStaffCsv([buildValidStaffCsvRow({ '契約週時間': '-1' })]);
      const resultNeg = parseAndValidateStaffCSV(csvNeg);
      expect(resultNeg.results[0].errors.some((e) => e.includes('契約週時間'))).toBe(true);

      const csvOver = buildStaffCsv([buildValidStaffCsvRow({ '契約週時間': '169' })]);
      const resultOver = parseAndValidateStaffCSV(csvOver);
      expect(resultOver.results[0].errors.some((e) => e.includes('契約週時間'))).toBe(true);
    });

    it('週間勤務数（必須）> 週間勤務数（希望）でエラーが出ること', () => {
      const csv = buildStaffCsv([buildValidStaffCsvRow({
        '週間勤務数（希望）': '3',
        '週間勤務数（必須）': '5',
      })]);
      const result = parseAndValidateStaffCSV(csv);

      expect(result.invalidRows).toBe(1);
      expect(result.results[0].errors.some((e) => e.includes('週間勤務数'))).toBe(true);
    });

    it('最大連続勤務日数が範囲外（1-30）でエラーが出ること', () => {
      const csvZero = buildStaffCsv([buildValidStaffCsvRow({ '最大連続勤務日数': '0' })]);
      const resultZero = parseAndValidateStaffCSV(csvZero);
      expect(resultZero.results[0].errors.some((e) => e.includes('最大連続勤務日数'))).toBe(true);

      const csvOver = buildStaffCsv([buildValidStaffCsvRow({ '最大連続勤務日数': '31' })]);
      const resultOver = parseAndValidateStaffCSV(csvOver);
      expect(resultOver.results[0].errors.some((e) => e.includes('最大連続勤務日数'))).toBe(true);
    });

    it('無効な曜日名でエラーが出ること', () => {
      const csv = buildStaffCsv([buildValidStaffCsvRow({ '利用可能曜日': '月曜日' })]);
      const result = parseAndValidateStaffCSV(csv);

      expect(result.invalidRows).toBe(1);
      expect(result.results[0].errors.some((e) => e.includes('利用可能曜日'))).toBe(true);
    });

    it('無効な時間帯希望でエラーが出ること', () => {
      const csv = buildStaffCsv([buildValidStaffCsvRow({ '時間帯希望': '朝のみ' })]);
      const result = parseAndValidateStaffCSV(csv);

      expect(result.invalidRows).toBe(1);
      expect(result.results[0].errors.some((e) => e.includes('時間帯希望'))).toBe(true);
    });

    it('雇用開始日が不正な形式でエラーが出ること', () => {
      const csv = buildStaffCsv([buildValidStaffCsvRow({ '雇用開始日': '2024/04/01' })]);
      const result = parseAndValidateStaffCSV(csv);

      expect(result.invalidRows).toBe(1);
      expect(result.results[0].errors.some((e) => e.includes('雇用開始日'))).toBe(true);
    });

    // --- 境界値 ---

    it('契約週時間0が有効であること', () => {
      const csv = buildStaffCsv([buildValidStaffCsvRow({ '契約週時間': '0' })]);
      const result = parseAndValidateStaffCSV(csv);

      expect(result.validRows).toBe(1);
      expect(result.parsedData[0].weeklyContractHours).toBe(0);
    });

    it('契約週時間168が有効であること', () => {
      const csv = buildStaffCsv([buildValidStaffCsvRow({ '契約週時間': '168' })]);
      const result = parseAndValidateStaffCSV(csv);

      expect(result.validRows).toBe(1);
      expect(result.parsedData[0].weeklyContractHours).toBe(168);
    });

    it('最大連続勤務日数1が有効であること', () => {
      const csv = buildStaffCsv([buildValidStaffCsvRow({ '最大連続勤務日数': '1' })]);
      const result = parseAndValidateStaffCSV(csv);

      expect(result.validRows).toBe(1);
      expect(result.parsedData[0].maxConsecutiveWorkDays).toBe(1);
    });

    it('最大連続勤務日数30が有効であること', () => {
      const csv = buildStaffCsv([buildValidStaffCsvRow({ '最大連続勤務日数': '30' })]);
      const result = parseAndValidateStaffCSV(csv);

      expect(result.validRows).toBe(1);
      expect(result.parsedData[0].maxConsecutiveWorkDays).toBe(30);
    });

    it('週間勤務数0が有効であること', () => {
      const csv = buildStaffCsv([buildValidStaffCsvRow({
        '週間勤務数（希望）': '0',
        '週間勤務数（必須）': '0',
      })]);
      const result = parseAndValidateStaffCSV(csv);

      expect(result.validRows).toBe(1);
      expect(result.parsedData[0].weeklyWorkCount).toEqual({ hope: 0, must: 0 });
    });

    it('週間勤務数7が有効であること', () => {
      const csv = buildStaffCsv([buildValidStaffCsvRow({
        '週間勤務数（希望）': '7',
        '週間勤務数（必須）': '7',
      })]);
      const result = parseAndValidateStaffCSV(csv);

      expect(result.validRows).toBe(1);
      expect(result.parsedData[0].weeklyWorkCount).toEqual({ hope: 7, must: 7 });
    });
  });

  // ==================== parseAndValidateFacilityCSV ====================

  describe('parseAndValidateFacilityCSV', () => {
    // --- 正常系 ---

    it('有効な施設CSVを正しくパースできること', () => {
      const csv = buildFacilityCsv([{
        '施設名': 'テストケアセンター',
        '施設番号': '1234567890',
        'サービス種別': '通所介護',
      }]);
      const result = parseAndValidateFacilityCSV(csv);

      expect(result.totalRows).toBe(1);
      expect(result.validRows).toBe(1);
      expect(result.invalidRows).toBe(0);
      expect(result.parsedData[0]).toEqual({
        name: 'テストケアセンター',
        facilityNumber: '1234567890',
        serviceType: '通所介護',
      });
    });

    // --- 異常系 ---

    it('施設名が空の行でエラーが出ること', () => {
      const csv = buildFacilityCsv([{
        '施設名': '',
        '施設番号': '1234567890',
        'サービス種別': '通所介護',
      }]);
      const result = parseAndValidateFacilityCSV(csv);

      expect(result.invalidRows).toBe(1);
      expect(result.results[0].errors.some((e) => e.includes('施設名'))).toBe(true);
    });

    it('施設名が重複しているとエラーが出ること', () => {
      const csv = buildFacilityCsv([
        { '施設名': '同じ名前', '施設番号': '1234567890', 'サービス種別': '通所介護' },
        { '施設名': '同じ名前', '施設番号': '0987654321', 'サービス種別': '訪問介護' },
      ]);
      const result = parseAndValidateFacilityCSV(csv);

      // 1行目は有効、2行目が重複エラー
      expect(result.results[0].isValid).toBe(true);
      expect(result.results[1].isValid).toBe(false);
      expect(result.results[1].errors.some((e) => e.includes('重複'))).toBe(true);
    });

    it('施設番号が10桁数字でない場合エラーが出ること', () => {
      const csv = buildFacilityCsv([{
        '施設名': 'テスト施設',
        '施設番号': '12345',
        'サービス種別': '通所介護',
      }]);
      const result = parseAndValidateFacilityCSV(csv);

      expect(result.invalidRows).toBe(1);
      expect(result.results[0].errors.some((e) => e.includes('施設番号'))).toBe(true);
    });

    it('無効なサービス種別でエラーが出ること', () => {
      const csv = buildFacilityCsv([{
        '施設名': 'テスト施設',
        '施設番号': '1234567890',
        'サービス種別': '存在しないサービス',
      }]);
      const result = parseAndValidateFacilityCSV(csv);

      expect(result.invalidRows).toBe(1);
      expect(result.results[0].errors.some((e) => e.includes('サービス種別'))).toBe(true);
    });
  });

  // ==================== parseAndValidateStaffWithFacilityCSV ====================

  describe('parseAndValidateStaffWithFacilityCSV', () => {
    const validFacilityNames = ['テストケアセンター', '別の施設'];

    // --- 正常系 ---

    it('施設名付き職員CSVを正しくパースできること', () => {
      const csv = buildStaffWithFacilityCsv([{
        '施設名': 'テストケアセンター',
        ...buildValidStaffCsvRow(),
      }]);
      const result = parseAndValidateStaffWithFacilityCSV(csv, validFacilityNames);

      expect(result.totalRows).toBe(1);
      expect(result.validRows).toBe(1);
      expect(result.invalidRows).toBe(0);
      expect(result.parsedData[0].facilityName).toBe('テストケアセンター');
      expect(result.parsedData[0].name).toBe('山田太郎');
    });

    // --- 異常系 ---

    it('施設名が空でエラーが出ること', () => {
      const csv = buildStaffWithFacilityCsv([{
        '施設名': '',
        ...buildValidStaffCsvRow(),
      }]);
      const result = parseAndValidateStaffWithFacilityCSV(csv, validFacilityNames);

      expect(result.invalidRows).toBe(1);
      expect(result.results[0].errors.some((e) => e.includes('施設名'))).toBe(true);
    });

    it('施設CSVに存在しない施設名でエラーが出ること', () => {
      const csv = buildStaffWithFacilityCsv([{
        '施設名': '存在しない施設',
        ...buildValidStaffCsvRow(),
      }]);
      const result = parseAndValidateStaffWithFacilityCSV(csv, validFacilityNames);

      expect(result.invalidRows).toBe(1);
      expect(result.results[0].errors.some((e) => e.includes('存在しません'))).toBe(true);
    });
  });
});
