/**
 * standardFormColumns.ts
 *
 * Phase 66: 厚生労働省標準様式第1号 サービス種別対応
 *           Config-Driven 列定義（StandardFormViewer / exportExcel 共有）
 *
 * 列差異:
 *   通所介護（デフォルト）: 固定7列 + 集計3列
 *   訪問介護:              固定7列 + サービス提供時間1列 = 8列 + 集計3列
 *   介護老人福祉施設（特養）: 固定7列 + 集計3列 + 夜間勤務h1列 = 4集計列
 */

import type { CareServiceType } from '../../types';

// ==================== 型定義 ====================

/** 固定列（日付列より左側の列）の定義 */
export interface FixedColumnDef {
  /** 列識別キー */
  key: string;
  /** ヘッダーテキスト（Excel / aria-label 用プレーンテキスト） */
  headerText: string;
  /** Tailwind 幅クラス（例: 'w-20'） */
  widthClass: string;
  /** Excel 列幅（ExcelJS width 単位） */
  excelWidth: number;
}

/** 集計列（日付列より右側の列）の定義 */
export interface TailColumnDef {
  /** 列識別キー */
  key: string;
  /** ヘッダーテキスト */
  headerText: string;
  /** Tailwind 幅クラス */
  widthClass: string;
  /** Excel 列幅 */
  excelWidth: number;
}

/** サービス種別ごとの列設定 */
export interface ServiceTypeColumnConfig {
  fixedColumns: FixedColumnDef[];
  tailColumns: TailColumnDef[];
}

// ==================== 共通固定列（7列） ====================

/** 全サービス種別共通の固定列（7列） */
const BASE_FIXED_COLUMNS: FixedColumnDef[] = [
  { key: 'no',            headerText: 'No.',      widthClass: 'w-8',  excelWidth: 4  },
  { key: 'name',          headerText: '職員氏名',   widthClass: 'w-24', excelWidth: 12 },
  { key: 'role',          headerText: '職種',       widthClass: 'w-20', excelWidth: 10 },
  { key: 'qualification', headerText: '資格',       widthClass: 'w-24', excelWidth: 12 },
  { key: 'employment',    headerText: '常勤/非常勤', widthClass: 'w-16', excelWidth: 7  },
  { key: 'concurrency',   headerText: '専従/兼務',   widthClass: 'w-14', excelWidth: 6  },
  { key: 'hireDate',      headerText: '雇用開始日',  widthClass: 'w-20', excelWidth: 10 },
];

/** 訪問介護用追加固定列: サービス提供時間 */
const VISIT_CARE_SERVICE_HOURS_COLUMN: FixedColumnDef = {
  key: 'serviceHours',
  headerText: 'サービス提供時間',
  widthClass: 'w-20',
  excelWidth: 12,
};

// ==================== 共通集計列（3列） ====================

/** 全サービス種別共通の集計列（3列） */
const BASE_TAIL_COLUMNS: TailColumnDef[] = [
  { key: 'monthlyHours', headerText: '月間h',    widthClass: 'w-16', excelWidth: 9 },
  { key: 'weeklyAvg',    headerText: '週平均h',   widthClass: 'w-16', excelWidth: 7 },
  { key: 'fte',          headerText: '常勤換算値', widthClass: 'w-14', excelWidth: 8 },
];

/** 介護老人福祉施設（特養）用追加集計列: 夜間勤務時間 */
const NURSING_NIGHT_HOURS_COLUMN: TailColumnDef = {
  key: 'nightHours',
  headerText: '夜間勤務h',
  widthClass: 'w-14',
  excelWidth: 8,
};

// ==================== getColumnConfig ====================

/**
 * サービス種別ごとの列設定を返す
 *
 * @param serviceType - 介護サービス種類
 * @returns 固定列・集計列の定義リスト
 *
 * 後方互換: '通所介護' はデフォルト（従来の7+3列構成と同一）
 */
export function getColumnConfig(serviceType: CareServiceType): ServiceTypeColumnConfig {
  switch (serviceType) {
    case '訪問介護':
      // 固定列: 共通7列 + サービス提供時間 = 8列
      // TODO: 現データモデルに専用フィールドなし → 月間勤務時間で代替
      return {
        fixedColumns: [...BASE_FIXED_COLUMNS, VISIT_CARE_SERVICE_HOURS_COLUMN],
        tailColumns: BASE_TAIL_COLUMNS,
      };

    case '介護老人福祉施設':
      // 集計列: 共通3列 + 夜間勤務h = 4列
      return {
        fixedColumns: BASE_FIXED_COLUMNS,
        tailColumns: [...BASE_TAIL_COLUMNS, NURSING_NIGHT_HOURS_COLUMN],
      };

    default:
      // 通所介護・その他: 7+3列（従来通り）
      return {
        fixedColumns: BASE_FIXED_COLUMNS,
        tailColumns: BASE_TAIL_COLUMNS,
      };
  }
}
