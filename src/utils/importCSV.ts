/**
 * importCSV.ts
 *
 * CSV一括インポート機能 - パース・バリデーション・テンプレート生成
 *
 * 特徴:
 * - papaparseを使用したCSV解析
 * - 行ごとのバリデーション（エラー詳細付き）
 * - BOM付きUTF-8テンプレート生成（Excel対応）
 * - 職員CSV / 施設CSVの両方に対応
 */

import { parse, unparse } from 'papaparse';
import type { Staff, EmploymentType, CareServiceType } from '../../types';
import { Role, Qualification, TimeSlotPreference } from '../../types';
import { ROLES, QUALIFICATIONS, TIME_SLOT_PREFERENCES, EMPLOYMENT_TYPES, CARE_SERVICE_TYPES } from '../../constants';

// ==================== 型定義 ====================

/** CSVインポートの1行のバリデーション結果 */
export interface RowValidationResult {
  rowIndex: number;
  isValid: boolean;
  errors: string[];
  data: Record<string, string>;
}

/** CSVインポート全体の結果 */
export interface CsvImportResult<T> {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  results: RowValidationResult[];
  parsedData: T[];
}

/** 施設CSVの解析結果 */
export interface ParsedFacility {
  name: string;
  facilityNumber: string;
  serviceType: CareServiceType;
}

// ==================== 定数 ====================

/** 職員CSVのヘッダー定義 */
export const STAFF_CSV_HEADERS = [
  '名前',
  '役職',
  '資格',
  '勤務形態区分',
  '契約週時間',
  '週間勤務数（希望）',
  '週間勤務数（必須）',
  '最大連続勤務日数',
  '利用可能曜日',
  '時間帯希望',
  '夜勤専従',
  '雇用開始日',
] as const;

/** 施設CSVのヘッダー定義 */
export const FACILITY_CSV_HEADERS = [
  '施設名',
  '施設番号',
  'サービス種別',
] as const;

const WEEKDAY_MAP: Record<string, number> = {
  '日': 0, '月': 1, '火': 2, '水': 3, '木': 4, '金': 5, '土': 6,
};

const REVERSE_WEEKDAY_MAP: Record<number, string> = {
  0: '日', 1: '月', 2: '火', 3: '水', 4: '木', 5: '金', 6: '土',
};

// ==================== テンプレート生成 ====================

/**
 * 職員CSVテンプレートを生成
 * サンプルデータ2行付き
 */
export function generateStaffTemplate(): string {
  const sampleData = [
    {
      '名前': '山田太郎',
      '役職': '介護職員',
      '資格': '介護福祉士, 普通自動車免許',
      '勤務形態区分': 'A',
      '契約週時間': '40',
      '週間勤務数（希望）': '5',
      '週間勤務数（必須）': '4',
      '最大連続勤務日数': '5',
      '利用可能曜日': '月, 火, 水, 木, 金',
      '時間帯希望': 'いつでも可',
      '夜勤専従': 'いいえ',
      '雇用開始日': '2024-04-01',
    },
    {
      '名前': '鈴木花子',
      '役職': '看護職員',
      '資格': '看護師',
      '勤務形態区分': 'C',
      '契約週時間': '24',
      '週間勤務数（希望）': '3',
      '週間勤務数（必須）': '3',
      '最大連続勤務日数': '3',
      '利用可能曜日': '月, 水, 金',
      '時間帯希望': '日勤のみ',
      '夜勤専従': 'いいえ',
      '雇用開始日': '2025-01-15',
    },
  ];

  const csv = unparse(sampleData, { columns: [...STAFF_CSV_HEADERS] });
  return addBOM(csv);
}

/**
 * 施設CSVテンプレートを生成
 * サンプルデータ1行付き
 */
export function generateFacilityTemplate(): string {
  const sampleData = [
    {
      '施設名': '〇〇ケアセンター',
      '施設番号': '1234567890',
      'サービス種別': '通所介護',
    },
  ];

  const csv = unparse(sampleData, { columns: [...FACILITY_CSV_HEADERS] });
  return addBOM(csv);
}

/**
 * 施設＋職員まとめてインポート用の職員CSVテンプレートを生成
 * （先頭に「施設名」列を追加）
 */
export function generateStaffWithFacilityTemplate(): string {
  const sampleData = [
    {
      '施設名': '〇〇ケアセンター',
      '名前': '山田太郎',
      '役職': '介護職員',
      '資格': '介護福祉士, 普通自動車免許',
      '勤務形態区分': 'A',
      '契約週時間': '40',
      '週間勤務数（希望）': '5',
      '週間勤務数（必須）': '4',
      '最大連続勤務日数': '5',
      '利用可能曜日': '月, 火, 水, 木, 金',
      '時間帯希望': 'いつでも可',
      '夜勤専従': 'いいえ',
      '雇用開始日': '2024-04-01',
    },
  ];

  const headers = ['施設名', ...STAFF_CSV_HEADERS];
  const csv = unparse(sampleData, { columns: headers });
  return addBOM(csv);
}

// ==================== CSV解析 ====================

/**
 * CSV文字列を解析する（共通処理）
 * BOM除去 + papaparse
 */
function parseCSVString(csvContent: string): Record<string, string>[] {
  // BOM除去
  const content = csvContent.replace(/^\uFEFF/, '');

  const result = parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
    transform: (value) => value.trim(),
  });

  if (result.errors.length > 0) {
    const errorMessages = result.errors
      .map((e) => `行${e.row !== undefined ? e.row + 2 : '?'}: ${e.message}`)
      .join(', ');
    throw new Error(`CSV解析エラー: ${errorMessages}`);
  }

  return result.data;
}

// ==================== 職員CSV バリデーション ====================

/**
 * 職員CSVを解析・バリデーション
 */
export function parseAndValidateStaffCSV(
  csvContent: string
): CsvImportResult<Omit<Staff, 'id' | 'createdAt' | 'updatedAt'>> {
  const rows = parseCSVString(csvContent);
  const results: RowValidationResult[] = [];
  const parsedData: Omit<Staff, 'id' | 'createdAt' | 'updatedAt'>[] = [];

  rows.forEach((row, index) => {
    const validation = validateStaffRow(row, index);
    results.push(validation);

    if (validation.isValid) {
      parsedData.push(convertRowToStaff(row));
    }
  });

  return {
    totalRows: rows.length,
    validRows: parsedData.length,
    invalidRows: rows.length - parsedData.length,
    results,
    parsedData,
  };
}

/**
 * 施設＋職員CSVを解析・バリデーション
 * 「施設名」列付きの職員CSVを解析
 */
export function parseAndValidateStaffWithFacilityCSV(
  csvContent: string,
  validFacilityNames: string[]
): CsvImportResult<Omit<Staff, 'id' | 'createdAt' | 'updatedAt'> & { facilityName: string }> {
  const rows = parseCSVString(csvContent);
  const results: RowValidationResult[] = [];
  const parsedData: (Omit<Staff, 'id' | 'createdAt' | 'updatedAt'> & { facilityName: string })[] = [];

  rows.forEach((row, index) => {
    const errors: string[] = [];

    // 施設名バリデーション
    const facilityName = row['施設名'];
    if (!facilityName) {
      errors.push('施設名は必須です');
    } else if (validFacilityNames.length > 0 && !validFacilityNames.includes(facilityName)) {
      errors.push(`施設名「${facilityName}」は施設CSVに存在しません`);
    }

    // 職員データバリデーション
    const staffValidation = validateStaffRow(row, index);
    errors.push(...staffValidation.errors);

    const validation: RowValidationResult = {
      rowIndex: index,
      isValid: errors.length === 0,
      errors,
      data: row,
    };
    results.push(validation);

    if (validation.isValid) {
      parsedData.push({
        ...convertRowToStaff(row),
        facilityName: facilityName,
      });
    }
  });

  return {
    totalRows: rows.length,
    validRows: parsedData.length,
    invalidRows: rows.length - parsedData.length,
    results,
    parsedData,
  };
}

/** 職員CSV1行のバリデーション */
function validateStaffRow(row: Record<string, string>, index: number): RowValidationResult {
  const errors: string[] = [];

  // 名前（必須）
  if (!row['名前'] || row['名前'].trim() === '') {
    errors.push('名前は必須です');
  }

  // 役職（必須、enum値チェック）
  const role = row['役職'];
  if (!role) {
    errors.push('役職は必須です');
  } else if (!ROLES.includes(role as Role)) {
    errors.push(`役職「${role}」は無効です。有効な値: ${ROLES.join(', ')}`);
  }

  // 資格（任意、カンマ区切り、enum値チェック）
  if (row['資格'] && row['資格'].trim() !== '') {
    const quals = row['資格'].split(/[,、]/).map((q) => q.trim()).filter(Boolean);
    for (const q of quals) {
      if (!QUALIFICATIONS.includes(q as Qualification)) {
        errors.push(`資格「${q}」は無効です。有効な値: ${QUALIFICATIONS.join(', ')}`);
      }
    }
  }

  // 勤務形態区分（任意、A/B/C/D）
  if (row['勤務形態区分'] && row['勤務形態区分'].trim() !== '') {
    const empType = row['勤務形態区分'].trim().charAt(0).toUpperCase();
    if (!['A', 'B', 'C', 'D'].includes(empType)) {
      errors.push(`勤務形態区分「${row['勤務形態区分']}」は無効です。A/B/C/Dのいずれかを指定してください`);
    }
  }

  // 契約週時間（任意、0-168）
  if (row['契約週時間'] && row['契約週時間'].trim() !== '') {
    const hours = Number(row['契約週時間']);
    if (isNaN(hours) || hours < 0 || hours > 168) {
      errors.push('契約週時間は0〜168の数値で入力してください');
    }
  }

  // 週間勤務数（希望）（任意、0-7）
  if (row['週間勤務数（希望）'] && row['週間勤務数（希望）'].trim() !== '') {
    const hope = Number(row['週間勤務数（希望）']);
    if (isNaN(hope) || hope < 0 || hope > 7) {
      errors.push('週間勤務数（希望）は0〜7の数値で入力してください');
    }
  }

  // 週間勤務数（必須）（任意、0-7）
  if (row['週間勤務数（必須）'] && row['週間勤務数（必須）'].trim() !== '') {
    const must = Number(row['週間勤務数（必須）']);
    if (isNaN(must) || must < 0 || must > 7) {
      errors.push('週間勤務数（必須）は0〜7の数値で入力してください');
    }
  }

  // 希望 >= 必須のチェック
  if (row['週間勤務数（希望）'] && row['週間勤務数（必須）']) {
    const hope = Number(row['週間勤務数（希望）']);
    const must = Number(row['週間勤務数（必須）']);
    if (!isNaN(hope) && !isNaN(must) && must > hope) {
      errors.push('週間勤務数（必須）は週間勤務数（希望）以下にしてください');
    }
  }

  // 最大連続勤務日数（任意、1-30）
  if (row['最大連続勤務日数'] && row['最大連続勤務日数'].trim() !== '') {
    const days = Number(row['最大連続勤務日数']);
    if (isNaN(days) || days < 1 || days > 30) {
      errors.push('最大連続勤務日数は1〜30の数値で入力してください');
    }
  }

  // 利用可能曜日（任意、日本語曜日名カンマ区切り）
  if (row['利用可能曜日'] && row['利用可能曜日'].trim() !== '') {
    const days = row['利用可能曜日'].split(/[,、]/).map((d) => d.trim()).filter(Boolean);
    for (const d of days) {
      if (!(d in WEEKDAY_MAP)) {
        errors.push(`利用可能曜日「${d}」は無効です。有効な値: 日, 月, 火, 水, 木, 金, 土`);
      }
    }
  }

  // 時間帯希望（任意、enum値チェック）
  if (row['時間帯希望'] && row['時間帯希望'].trim() !== '') {
    if (!TIME_SLOT_PREFERENCES.includes(row['時間帯希望'] as TimeSlotPreference)) {
      errors.push(`時間帯希望「${row['時間帯希望']}」は無効です。有効な値: ${TIME_SLOT_PREFERENCES.join(', ')}`);
    }
  }

  // 夜勤専従（任意、はい/いいえ）
  if (row['夜勤専従'] && row['夜勤専従'].trim() !== '') {
    if (!['はい', 'いいえ'].includes(row['夜勤専従'])) {
      errors.push('夜勤専従は「はい」または「いいえ」で入力してください');
    }
  }

  // 雇用開始日（任意、YYYY-MM-DD形式チェック）
  if (row['雇用開始日'] && row['雇用開始日'].trim() !== '') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row['雇用開始日'])) {
      errors.push('雇用開始日はYYYY-MM-DD形式で入力してください（例: 2024-04-01）');
    }
  }

  return {
    rowIndex: index,
    isValid: errors.length === 0,
    errors,
    data: row,
  };
}

/** CSV行データをStaffオブジェクトに変換 */
function convertRowToStaff(row: Record<string, string>): Omit<Staff, 'id' | 'createdAt' | 'updatedAt'> {
  // 資格パース
  const qualifications: Qualification[] = row['資格'] && row['資格'].trim() !== ''
    ? row['資格'].split(/[,、]/).map((q) => q.trim()).filter((q) => QUALIFICATIONS.includes(q as Qualification)) as Qualification[]
    : [];

  // 勤務形態区分パース
  const empTypeRaw = row['勤務形態区分']?.trim().charAt(0).toUpperCase();
  const employmentType: EmploymentType | undefined = ['A', 'B', 'C', 'D'].includes(empTypeRaw)
    ? empTypeRaw as EmploymentType
    : undefined;

  // 利用可能曜日パース
  const availableWeekdays: number[] = row['利用可能曜日'] && row['利用可能曜日'].trim() !== ''
    ? row['利用可能曜日'].split(/[,、]/).map((d) => d.trim()).filter((d) => d in WEEKDAY_MAP).map((d) => WEEKDAY_MAP[d])
    : [0, 1, 2, 3, 4, 5, 6]; // デフォルト: 全曜日

  return {
    name: row['名前'].trim(),
    role: row['役職'] as Role,
    qualifications,
    weeklyWorkCount: {
      hope: row['週間勤務数（希望）'] ? Number(row['週間勤務数（希望）']) : 4,
      must: row['週間勤務数（必須）'] ? Number(row['週間勤務数（必須）']) : 4,
    },
    maxConsecutiveWorkDays: row['最大連続勤務日数'] ? Number(row['最大連続勤務日数']) : 5,
    availableWeekdays,
    unavailableDates: [],
    timeSlotPreference: (row['時間帯希望'] as TimeSlotPreference) || TimeSlotPreference.Any,
    isNightShiftOnly: row['夜勤専従'] === 'はい',
    ...(employmentType && { employmentType }),
    ...(row['契約週時間'] && row['契約週時間'].trim() !== '' && { weeklyContractHours: Number(row['契約週時間']) }),
    ...(row['雇用開始日'] && row['雇用開始日'].trim() !== '' && { hireDate: row['雇用開始日'] }),
  };
}

// ==================== 施設CSV バリデーション ====================

/**
 * 施設CSVを解析・バリデーション
 */
export function parseAndValidateFacilityCSV(
  csvContent: string
): CsvImportResult<ParsedFacility> {
  const rows = parseCSVString(csvContent);
  const results: RowValidationResult[] = [];
  const parsedData: ParsedFacility[] = [];
  const seenNames = new Set<string>();

  rows.forEach((row, index) => {
    const errors: string[] = [];

    // 施設名（必須、重複チェック）
    if (!row['施設名'] || row['施設名'].trim() === '') {
      errors.push('施設名は必須です');
    } else if (seenNames.has(row['施設名'].trim())) {
      errors.push(`施設名「${row['施設名']}」が重複しています`);
    } else {
      seenNames.add(row['施設名'].trim());
    }

    // 施設番号（任意、10桁数字）
    if (row['施設番号'] && row['施設番号'].trim() !== '') {
      if (!/^\d{10}$/.test(row['施設番号'].trim())) {
        errors.push('施設番号は10桁の数字で入力してください');
      }
    }

    // サービス種別（任意、enum値チェック）
    if (row['サービス種別'] && row['サービス種別'].trim() !== '') {
      if (!CARE_SERVICE_TYPES.includes(row['サービス種別'].trim() as CareServiceType)) {
        errors.push(`サービス種別「${row['サービス種別']}」は無効です。有効な値: ${CARE_SERVICE_TYPES.join(', ')}`);
      }
    }

    const validation: RowValidationResult = {
      rowIndex: index,
      isValid: errors.length === 0,
      errors,
      data: row,
    };
    results.push(validation);

    if (validation.isValid) {
      parsedData.push({
        name: row['施設名'].trim(),
        facilityNumber: row['施設番号']?.trim() || '',
        serviceType: (row['サービス種別']?.trim() as CareServiceType) || 'その他',
      });
    }
  });

  return {
    totalRows: rows.length,
    validRows: parsedData.length,
    invalidRows: rows.length - parsedData.length,
    results,
    parsedData,
  };
}

// ==================== ヘルパー ====================

/** BOM追加（Excel対応） */
function addBOM(csv: string): string {
  return '\uFEFF' + csv;
}

/** CSV文字列をBlobとしてダウンロード */
export function downloadCSVTemplate(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
