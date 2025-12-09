# Phase 19.3.1: エクスポート機能（CSV、PDF） - 実装計画

**作成日**: 2025-11-13
**Phase**: 19.3.1
**ステータス**: 🚧 実装中
**推定工数**: 約3-4時間

---

## 📋 概要

シフトデータ、スタッフ情報、休暇申請データをCSVおよびPDF形式でエクスポート可能にする機能を実装します。また、エクスポート操作を監査ログに記録して、セキュリティとコンプライアンスを確保します。

---

## 🎯 実装目標

### 1. CSV エクスポート機能
- ✅ **シフトデータのCSVエクスポート**: 月次シフト表を行列形式でエクスポート
- ✅ **スタッフ一覧のCSVエクスポート**: スタッフ情報（role, qualifications等）をエクスポート
- ✅ **休暇申請一覧のCSVエクスポート**: 休暇申請データをエクスポート

### 2. PDF エクスポート機能
- ✅ **シフト表のPDF生成**: 印刷用のシフト表を生成
- ✅ **スタッフ情報のPDF生成**: スタッフ一覧を印刷用に生成
- ✅ jsPDF と jspdf-autotableを使用

### 3. エクスポート履歴・監査ログ
- ✅ **エクスポート操作の監査ログ記録**: auditLogsコレクションに記録
- ✅ **エクスポート履歴の表示**: admin画面で履歴表示（既存のAuditLogsページ活用）

---

## 📊 データモデル

### エクスポート対象データ

#### 1. Schedule（シフトデータ）
```typescript
export interface Schedule {
  id: string;
  targetMonth: string;     // 'YYYY-MM'
  staffSchedules: StaffSchedule[];
  createdAt: Timestamp;
  createdBy: string;       // UID
  updatedAt: Timestamp;
  updatedBy: string;       // UID
  version: number;         // 1から開始
  status: 'draft' | 'confirmed' | 'archived';
}

export interface StaffSchedule {
  staffId: string;
  staffName: string;
  monthlyShifts: GeneratedShift[];
}

export interface GeneratedShift {
  date: string; // YYYY-MM-DD
  shiftType: string; // e.g., '早番', '日勤', '夜勤', or '休'
}
```

**CSVフォーマット（シフト表）**:
```csv
スタッフ名,2025-11-01,2025-11-02,2025-11-03,...,2025-11-30
山田太郎,早番,日勤,休,...,夜勤
佐藤花子,日勤,早番,早番,...,休
```

**PDFフォーマット（シフト表）**:
- ヘッダー: 施設名、対象月、出力日時
- テーブル: 横軸=日付、縦軸=スタッフ名
- フッター: ページ番号、出力者

---

#### 2. Staff（スタッフ情報）
```typescript
export interface Staff {
  id: string;
  name: string;
  role: Role;
  qualifications: Qualification[];
  weeklyWorkCount: { hope: number; must: number };
  maxConsecutiveWorkDays: number;
  availableWeekdays: number[]; // 0 for Sun, 1 for Mon...
  unavailableDates: string[]; // YYYY-MM-DD
  timeSlotPreference: TimeSlotPreference;
  isNightShiftOnly: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
```

**CSVフォーマット（スタッフ一覧）**:
```csv
ID,名前,役職,資格,週間勤務数（希望）,週間勤務数（必須）,最大連続勤務日数,時間帯希望,夜勤専従,作成日,更新日
abc123,山田太郎,介護職員,"介護福祉士,普通自動車免許",4,5,5,いつでも可,いいえ,2025-11-01,2025-11-10
```

**PDFフォーマット（スタッフ情報）**:
- ヘッダー: 施設名、出力日時
- テーブル: スタッフ情報一覧
- フッター: ページ番号、合計スタッフ数

---

#### 3. LeaveRequestDocument（休暇申請）
```typescript
export interface LeaveRequestDocument {
  id: string;
  staffId: string;
  staffName: string;
  date: string; // YYYY-MM-DD
  leaveType: LeaveType;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
```

**CSVフォーマット（休暇申請一覧）**:
```csv
ID,スタッフID,スタッフ名,日付,休暇種別,申請日,更新日
req001,abc123,山田太郎,2025-11-15,希望休,2025-11-01,2025-11-01
```

---

## 🛠️ 実装ファイル

### 1. `src/utils/exportCSV.ts`

**目的**: CSVエクスポート機能のユーティリティ

**実装する関数**:
```typescript
/**
 * シフトデータをCSVエクスポート
 * @param schedule - Scheduleオブジェクト
 * @param facilityName - 施設名（オプション）
 * @returns CSV文字列
 */
export function exportScheduleToCSV(
  schedule: Schedule,
  facilityName?: string
): string;

/**
 * スタッフ一覧をCSVエクスポート
 * @param staffList - Staffオブジェクトの配列
 * @param facilityName - 施設名（オプション）
 * @returns CSV文字列
 */
export function exportStaffToCSV(
  staffList: Staff[],
  facilityName?: string
): string;

/**
 * 休暇申請一覧をCSVエクスポート
 * @param leaveRequests - LeaveRequestDocumentの配列
 * @param facilityName - 施設名（オプション）
 * @returns CSV文字列
 */
export function exportLeaveRequestsToCSV(
  leaveRequests: LeaveRequestDocument[],
  facilityName?: string
): string;

/**
 * CSV文字列をファイルとしてダウンロード
 * @param csvContent - CSV文字列
 * @param filename - ファイル名
 */
export function downloadCSV(
  csvContent: string,
  filename: string
): void;
```

**技術スタック**:
- `papaparse`: CSV生成
- BOM付きUTF-8エンコーディング（Excelで正しく表示）

---

### 2. `src/utils/exportPDF.ts`

**目的**: PDFエクスポート機能のユーティリティ

**実装する関数**:
```typescript
/**
 * シフト表をPDF生成
 * @param schedule - Scheduleオブジェクト
 * @param facilityName - 施設名
 * @returns jsPDFオブジェクト
 */
export function exportScheduleToPDF(
  schedule: Schedule,
  facilityName: string
): jsPDF;

/**
 * スタッフ情報をPDF生成
 * @param staffList - Staffオブジェクトの配列
 * @param facilityName - 施設名
 * @returns jsPDFオブジェクト
 */
export function exportStaffToPDF(
  staffList: Staff[],
  facilityName: string
): jsPDF;

/**
 * PDFをファイルとしてダウンロード
 * @param pdf - jsPDFオブジェクト
 * @param filename - ファイル名
 */
export function downloadPDF(
  pdf: jsPDF,
  filename: string
): void;
```

**技術スタック**:
- `jspdf`: PDF生成
- `jspdf-autotable`: テーブル生成
- 日本語フォント対応（NotoSansCJKjp-Regular等）

**PDF設定**:
- 用紙サイズ: A4
- 向き: 横向き（シフト表）、縦向き（スタッフ情報）
- マージン: 10mm
- フォント: 日本語対応フォント

---

### 3. `src/components/ExportMenu.tsx`

**目的**: エクスポートメニューUIコンポーネント

**プロパティ**:
```typescript
export interface ExportMenuProps {
  /**
   * エクスポートタイプ
   */
  type: 'schedule' | 'staff' | 'leaveRequests';

  /**
   * データソース
   */
  data: Schedule | Staff[] | LeaveRequestDocument[];

  /**
   * 施設名
   */
  facilityName: string;

  /**
   * 追加のCSSクラス
   */
  className?: string;

  /**
   * エクスポート完了時のコールバック
   */
  onExportComplete?: (format: 'csv' | 'pdf', auditLogId: string) => void;
}
```

**機能**:
- ✅ ドロップダウンメニュー（CSV/PDF選択）
- ✅ エクスポートボタン
- ✅ ローディング状態表示
- ✅ エラーハンドリング
- ✅ トースト通知（成功・エラー）
- ✅ 監査ログ記録

**デザイン**:
- Buttonコンポーネント使用
- アイコン: ダウンロードアイコン
- ドロップダウン: CSV/PDF選択

---

## 🔐 監査ログ統合

### 監査ログ記録

**記録するイベント**:
- `DATA_EXPORT_SCHEDULE`: シフトデータエクスポート
- `DATA_EXPORT_STAFF`: スタッフ情報エクスポート
- `DATA_EXPORT_LEAVE_REQUESTS`: 休暇申請エクスポート

**記録する情報**:
```typescript
{
  action: 'DATA_EXPORT_SCHEDULE' | 'DATA_EXPORT_STAFF' | 'DATA_EXPORT_LEAVE_REQUESTS',
  userId: string,
  userName: string,
  facilityId: string,
  metadata: {
    format: 'csv' | 'pdf',
    targetMonth?: string, // シフトデータの場合
    recordCount: number,  // エクスポートしたレコード数
    filename: string,
  },
  timestamp: Timestamp,
  ipAddress?: string, // 可能であれば
}
```

**実装場所**: `src/services/auditLogService.ts`（既存サービス拡張）

---

## 🎨 UI統合

### FacilityDetailページへの統合

**統合場所**: `src/pages/admin/FacilityDetail.tsx`

**追加するUI要素**:
1. **シフトタブ**: シフト表の右上に「エクスポート」ボタン
   ```tsx
   <ExportMenu
     type="schedule"
     data={currentSchedule}
     facilityName={facility.name}
     onExportComplete={handleExportComplete}
   />
   ```

2. **スタッフタブ**: スタッフ一覧の右上に「エクスポート」ボタン
   ```tsx
   <ExportMenu
     type="staff"
     data={staffList}
     facilityName={facility.name}
     onExportComplete={handleExportComplete}
   />
   ```

3. **休暇申請タブ**: 休暇申請一覧の右上に「エクスポート」ボタン
   ```tsx
   <ExportMenu
     type="leaveRequests"
     data={leaveRequests}
     facilityName={facility.name}
     onExportComplete={handleExportComplete}
   />
   ```

---

## ✅ 実装チェックリスト

### 準備
- [x] データモデルの確認（types.ts）
- [x] 必要なnpmパッケージのインストール
  - [x] papaparse
  - [x] jspdf
  - [x] jspdf-autotable
  - [x] @types/papaparse

### 実装
- [ ] `src/utils/exportCSV.ts`作成
  - [ ] exportScheduleToCSV()
  - [ ] exportStaffToCSV()
  - [ ] exportLeaveRequestsToCSV()
  - [ ] downloadCSV()
  - [ ] BOM付きUTF-8エンコーディング実装
  - [ ] 型安全性の確保

- [ ] `src/utils/exportPDF.ts`作成
  - [ ] exportScheduleToPDF()
  - [ ] exportStaffToPDF()
  - [ ] downloadPDF()
  - [ ] 日本語フォント設定
  - [ ] テーブルフォーマット設定

- [ ] `src/components/ExportMenu.tsx`作成
  - [ ] ドロップダウンメニューUI
  - [ ] エクスポート処理実装
  - [ ] ローディング状態管理
  - [ ] エラーハンドリング
  - [ ] トースト通知統合
  - [ ] 監査ログ記録

- [ ] `src/services/auditLogService.ts`拡張
  - [ ] DATA_EXPORT_* イベント追加
  - [ ] ログ記録関数の実装

- [ ] `src/pages/admin/FacilityDetail.tsx`統合
  - [ ] シフトタブにExportMenu追加
  - [ ] スタッフタブにExportMenu追加
  - [ ] 休暇申請タブにExportMenu追加

### テスト
- [ ] ビルドテスト（npm run build）
- [ ] 型チェック（npm run type-check）
- [ ] CSVエクスポート動作確認
  - [ ] シフトデータCSV
  - [ ] スタッフ一覧CSV
  - [ ] 休暇申請CSV
  - [ ] Excel開封確認（文字化けなし）
- [ ] PDFエクスポート動作確認
  - [ ] シフト表PDF
  - [ ] スタッフ情報PDF
  - [ ] 日本語表示確認
- [ ] 監査ログ記録確認
- [ ] CodeRabbitレビュー

### ドキュメント
- [ ] Phase 19.3.1完了レポート作成
- [ ] 使用方法ドキュメント作成（オプション）

---

## 🚀 実装順序（推奨）

1. **exportCSV.ts**: CSV機能は比較的シンプル → 先に実装
2. **exportPDF.ts**: PDF機能はフォント設定等が複雑 → 次に実装
3. **ExportMenu.tsx**: UIコンポーネント → CSV/PDF完成後に実装
4. **auditLogService.ts**: 監査ログ → ExportMenu完成後に統合
5. **FacilityDetail.tsx**: 既存ページへの統合 → 最後に実装

---

## 🎯 成功基準

- ✅ CSVエクスポートがExcelで正しく開ける（文字化けなし）
- ✅ PDFエクスポートが日本語を含めて正しく表示される
- ✅ エクスポート操作が監査ログに記録される
- ✅ FacilityDetailページからシームレスにエクスポートできる
- ✅ エラーが適切にハンドリングされ、ユーザーにフィードバックされる
- ✅ ビルドエラーなし、型エラーなし
- ✅ CodeRabbitレビューで問題なし

---

## 📝 注意事項

### CSV生成時の注意
1. **BOM付きUTF-8**: Excelで正しく開くために必須
2. **改行コード**: CRLF（\r\n）を使用
3. **カンマのエスケープ**: 値に`,`が含まれる場合は`""`で囲む
4. **日本語カラム名**: わかりやすい日本語でOK

### PDF生成時の注意
1. **日本語フォント**: jsPDFはデフォルトで日本語非対応 → カスタムフォント必要
2. **テーブル幅**: A4横向き用に調整
3. **ページング**: 長いシフト表は自動改ページ
4. **ファイルサイズ**: 大きくなりすぎないよう注意

### 監査ログの注意
1. **個人情報**: エクスポートしたデータの詳細は記録しない（メタデータのみ）
2. **パフォーマンス**: ログ記録は非同期で実行
3. **エラーハンドリング**: ログ記録失敗してもエクスポート自体は成功させる

---

## 🔗 関連ドキュメント

- **Phase 19計画書**: `.kiro/specs/auth-data-persistence/phase19-plan-2025-11-13.md`
- **データモデル**: `types.ts`
- **監査ログ仕様**: `src/services/auditLogService.ts`
- **FacilityDetail実装**: `src/pages/admin/FacilityDetail.tsx`

---

**作成日**: 2025-11-13
**作成者**: Claude (AI Assistant)
**ステータス**: 🚧 実装中（パッケージインストール完了）
