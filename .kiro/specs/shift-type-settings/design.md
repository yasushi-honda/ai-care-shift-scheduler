# Phase 38: シフトタイプ設定UI - 技術設計書

**作成日**: 2025-11-26
**仕様ID**: shift-type-settings
**Phase**: 38
**ステータス**: 承認済み

---

## 1. アーキテクチャ概要

### 1.1 システム構成

```
┌─────────────────────────────────────────────────────────────┐
│                         App.tsx                             │
│  ┌─────────────────┐  ┌─────────────────────────────────┐  │
│  │ ShiftTypeSettings│  │         ShiftTable              │  │
│  │     (設定UI)     │  │  (動的SHIFT_CYCLE, getShiftColor)│  │
│  └────────┬────────┘  └─────────────┬───────────────────┘  │
│           │                          │                      │
│           ▼                          ▼                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              ShiftTypeService                        │   │
│  │  (getSettings, saveSettings, subscribe)              │   │
│  └─────────────────────────┬───────────────────────────┘   │
└─────────────────────────────┼───────────────────────────────┘
                              │
                              ▼
               ┌──────────────────────────┐
               │        Firestore          │
               │ /facilities/{id}/         │
               │   shiftSettings/default   │
               └──────────────────────────┘
```

### 1.2 データフロー

```
1. 初期化
   App.tsx → ShiftTypeService.getSettings() → Firestore
   ↓
   なければ DEFAULT_TIME_SLOTS から自動生成

2. 設定変更
   ShiftTypeSettings UI → onSave()
   ↓
   ShiftTypeService.saveSettings() → Firestore
   ↓
   リアルタイム更新 → ShiftTable再レンダリング

3. シフト表表示
   ShiftTable → useShiftSettings(facilityId)
   ↓
   動的 SHIFT_CYCLE, getShiftColor() 取得
```

---

## 2. データモデル詳細

### 2.1 型定義（types.ts に追加）

```typescript
/**
 * Phase 38: シフトタイプ設定
 */

// シフト種別の表示色
export interface ShiftColor {
  background: string;  // Tailwind背景色クラス（例: "bg-sky-100"）
  text: string;        // Tailwind文字色クラス（例: "text-sky-800"）
}

// シフト種別設定
export interface ShiftTypeConfig {
  id: string;                    // UUID (例: "shift_001")
  name: string;                  // シフト名 (例: "早番")
  start: string;                 // 開始時間 HH:mm (例: "07:00")
  end: string;                   // 終了時間 HH:mm (例: "16:00")
  restHours: number;             // 休憩時間（時間単位、例: 1）
  color: ShiftColor;             // 表示色
  isActive: boolean;             // 有効/無効
  sortOrder: number;             // 表示順序（0始まり）
}

// 事業所のシフト設定
export interface FacilityShiftSettings {
  facilityId: string;
  shiftTypes: ShiftTypeConfig[];
  defaultShiftCycle: string[];   // ダブルクリック時のサイクル順序
  updatedAt: Timestamp;
  updatedBy: string;             // UID
}
```

### 2.2 デフォルト値（constants.ts に追加）

```typescript
import { ShiftTypeConfig, ShiftColor } from './types';

// シフト色プリセット
export const SHIFT_COLOR_PRESETS: Record<string, ShiftColor> = {
  sky: { background: 'bg-sky-100', text: 'text-sky-800' },
  emerald: { background: 'bg-emerald-100', text: 'text-emerald-800' },
  amber: { background: 'bg-amber-100', text: 'text-amber-800' },
  indigo: { background: 'bg-indigo-100', text: 'text-indigo-800' },
  slate: { background: 'bg-slate-100', text: 'text-slate-600' },
  slateLight: { background: 'bg-slate-200', text: 'text-slate-700' },
  rose: { background: 'bg-rose-100', text: 'text-rose-800' },
  violet: { background: 'bg-violet-100', text: 'text-violet-800' },
};

// デフォルトシフト種別設定
export const DEFAULT_SHIFT_TYPES: ShiftTypeConfig[] = [
  {
    id: 'shift_early',
    name: '早番',
    start: '07:00',
    end: '16:00',
    restHours: 1,
    color: SHIFT_COLOR_PRESETS.sky,
    isActive: true,
    sortOrder: 0,
  },
  {
    id: 'shift_day',
    name: '日勤',
    start: '09:00',
    end: '18:00',
    restHours: 1,
    color: SHIFT_COLOR_PRESETS.emerald,
    isActive: true,
    sortOrder: 1,
  },
  {
    id: 'shift_late',
    name: '遅番',
    start: '11:00',
    end: '20:00',
    restHours: 1,
    color: SHIFT_COLOR_PRESETS.amber,
    isActive: true,
    sortOrder: 2,
  },
  {
    id: 'shift_night',
    name: '夜勤',
    start: '16:00',
    end: '09:00',
    restHours: 2,
    color: SHIFT_COLOR_PRESETS.indigo,
    isActive: true,
    sortOrder: 3,
  },
  {
    id: 'shift_off',
    name: '休',
    start: '',
    end: '',
    restHours: 0,
    color: SHIFT_COLOR_PRESETS.slate,
    isActive: true,
    sortOrder: 4,
  },
  {
    id: 'shift_postnight',
    name: '明け休み',
    start: '',
    end: '',
    restHours: 0,
    color: SHIFT_COLOR_PRESETS.slateLight,
    isActive: true,
    sortOrder: 5,
  },
];

export const DEFAULT_SHIFT_CYCLE = ['早番', '日勤', '遅番', '夜勤', '休', '明け休み'];
```

### 2.3 Firestoreスキーマ

**パス**: `/facilities/{facilityId}/shiftSettings/default`

```json
{
  "facilityId": "facility_001",
  "shiftTypes": [
    {
      "id": "shift_early",
      "name": "早番",
      "start": "07:00",
      "end": "16:00",
      "restHours": 1,
      "color": {
        "background": "bg-sky-100",
        "text": "text-sky-800"
      },
      "isActive": true,
      "sortOrder": 0
    }
    // ... 他のシフト種別
  ],
  "defaultShiftCycle": ["早番", "日勤", "遅番", "夜勤", "休", "明け休み"],
  "updatedAt": "2025-11-26T00:00:00Z",
  "updatedBy": "user_uid_001"
}
```

---

## 3. サービス層設計

### 3.1 ShiftTypeService

**ファイル**: `src/services/shiftTypeService.ts`

```typescript
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { FacilityShiftSettings, ShiftTypeConfig } from '../../types';
import { DEFAULT_SHIFT_TYPES, DEFAULT_SHIFT_CYCLE } from '../../constants';

export type ShiftTypeError = {
  code: 'NOT_FOUND' | 'PERMISSION_DENIED' | 'VALIDATION_ERROR' | 'UNKNOWN';
  message: string;
};

export type Result<T, E> =
  | { success: true; data: T }
  | { success: false; error: E };

export const ShiftTypeService = {
  /**
   * シフト設定を取得（なければデフォルトを作成）
   */
  async getSettings(
    facilityId: string
  ): Promise<Result<FacilityShiftSettings, ShiftTypeError>> {
    try {
      const docRef = doc(db, 'facilities', facilityId, 'shiftSettings', 'default');
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { success: true, data: docSnap.data() as FacilityShiftSettings };
      }

      // デフォルト設定を作成
      const defaultSettings: FacilityShiftSettings = {
        facilityId,
        shiftTypes: DEFAULT_SHIFT_TYPES,
        defaultShiftCycle: DEFAULT_SHIFT_CYCLE,
        updatedAt: serverTimestamp() as any,
        updatedBy: 'system',
      };

      await setDoc(docRef, defaultSettings);
      return { success: true, data: defaultSettings };
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        return { success: false, error: { code: 'PERMISSION_DENIED', message: '権限がありません' }};
      }
      return { success: false, error: { code: 'UNKNOWN', message: error.message }};
    }
  },

  /**
   * シフト設定を保存
   */
  async saveSettings(
    facilityId: string,
    settings: Partial<FacilityShiftSettings>,
    userId: string
  ): Promise<Result<void, ShiftTypeError>> {
    try {
      // バリデーション
      if (settings.shiftTypes) {
        const names = settings.shiftTypes.map(s => s.name);
        if (new Set(names).size !== names.length) {
          return {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: '重複するシフト名があります' }
          };
        }
      }

      const docRef = doc(db, 'facilities', facilityId, 'shiftSettings', 'default');
      await setDoc(docRef, {
        ...settings,
        facilityId,
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      }, { merge: true });

      return { success: true, data: undefined };
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        return { success: false, error: { code: 'PERMISSION_DENIED', message: '権限がありません' }};
      }
      return { success: false, error: { code: 'UNKNOWN', message: error.message }};
    }
  },

  /**
   * リアルタイム購読
   */
  subscribeToSettings(
    facilityId: string,
    callback: (settings: FacilityShiftSettings | null, error?: Error) => void
  ): () => void {
    const docRef = doc(db, 'facilities', facilityId, 'shiftSettings', 'default');

    return onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          callback(docSnap.data() as FacilityShiftSettings);
        } else {
          callback(null);
        }
      },
      (error) => {
        callback(null, error);
      }
    );
  },
};
```

---

## 4. UIコンポーネント設計

### 4.1 ShiftTypeSettings.tsx

**ファイル**: `src/components/ShiftTypeSettings.tsx`

```typescript
interface ShiftTypeSettingsProps {
  facilityId: string;
  userId: string;
  shiftSettings: FacilityShiftSettings | null;
  onSettingsChange: (settings: FacilityShiftSettings) => void;
}
```

**UIレイアウト**:
```
┌─────────────────────────────────────────────────────────┐
│ シフト種別設定                                          │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 早番  [bg-sky-100]  07:00 - 16:00  休憩1h  [編集]   │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ 日勤  [bg-emerald]  09:00 - 18:00  休憩1h  [編集]   │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ 遅番  [bg-amber]    11:00 - 20:00  休憩1h  [編集]   │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ 夜勤  [bg-indigo]   16:00 - 09:00  休憩2h  [編集]   │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [+ 新しいシフト種別を追加]                               │
│                                                         │
│ ─────────────────────────────────────────────────────── │
│ シフトサイクル順序:                                      │
│ [早番] → [日勤] → [遅番] → [夜勤] → [休] → [明け休み]    │
│ (ドラッグで順序変更)                                     │
└─────────────────────────────────────────────────────────┘
```

### 4.2 ShiftTypeEditor.tsx（編集モーダル）

```typescript
interface ShiftTypeEditorProps {
  isOpen: boolean;
  onClose: () => void;
  shiftType: ShiftTypeConfig | null;  // nullは新規作成
  onSave: (shiftType: ShiftTypeConfig) => void;
  onDelete?: (id: string) => void;
}
```

**モーダルレイアウト**:
```
┌─────────────────────────────────────────┐
│ シフト種別を編集                         │
├─────────────────────────────────────────┤
│ シフト名: [早番          ]              │
│                                         │
│ 開始時間: [07:00] 終了時間: [16:00]     │
│                                         │
│ 休憩時間: [1  ] 時間                    │
│                                         │
│ 表示色:                                 │
│ (○) sky   (○) emerald  (○) amber       │
│ (○) indigo (○) slate   (○) rose        │
│                                         │
│ プレビュー: [早番]                       │
│                                         │
│ ☐ 有効にする                            │
│                                         │
├─────────────────────────────────────────┤
│        [削除]          [キャンセル] [保存]│
└─────────────────────────────────────────┘
```

---

## 5. ShiftTable統合

### 5.1 変更箇所

**現在のコード（ShiftTable.tsx）**:
```typescript
// ハードコード
const SHIFT_CYCLE = ['早番', '日勤', '遅番', '夜勤', '休', '明け休み'];

const getShiftColor = (shiftType: string) => {
  switch (shiftType) {
    case '早番': return 'bg-sky-100 text-sky-800';
    // ...
  }
};
```

**変更後**:
```typescript
interface ShiftTableProps {
  // 既存props...
  shiftSettings?: FacilityShiftSettings;
}

const ShiftTable: React.FC<ShiftTableProps> = ({ shiftSettings, ...props }) => {
  // 動的シフトサイクル
  const shiftCycle = shiftSettings?.defaultShiftCycle || DEFAULT_SHIFT_CYCLE;

  // 動的カラー取得
  const getShiftColor = (shiftType: string): string => {
    const config = shiftSettings?.shiftTypes.find(s => s.name === shiftType);
    if (config) {
      return `${config.color.background} ${config.color.text}`;
    }
    // フォールバック
    switch (shiftType) {
      case '早番': return 'bg-sky-100 text-sky-800';
      // ...デフォルト
    }
  };

  // ...
};
```

---

## 6. セキュリティルール

**firestore.rules への追加**:

```javascript
// シフト設定サブコレクション
match /facilities/{facilityId}/shiftSettings/{settingId} {
  allow read: if isAuthenticated() && hasRole(facilityId, 'viewer');
  allow write: if isAuthenticated() && hasRole(facilityId, 'admin');
}
```

---

## 7. 関連ドキュメント

- [要件定義書](./requirements.md)
- [タスク一覧](./tasks.md)
- [図表](./phase38-diagrams-2025-11-26.md)
