# Project Structure - ファイル構成とコードパターン

## ディレクトリ構造

```
ai-care-shift-scheduler/
├── .github/                    # GitHub設定
│   └── workflows/
│       └── ci.yml             # CI/CDパイプライン
│
├── .kiro/                     # Spec-Driven Development
│   ├── steering/              # プロジェクト全体の方針
│   │   ├── product.md         # プロダクトコンテキスト
│   │   ├── tech.md            # 技術スタック
│   │   ├── architecture.md    # アーキテクチャ
│   │   └── structure.md       # 本ドキュメント
│   └── specs/                 # 機能仕様（将来使用）
│
├── .claude/                   # Claude Code設定
│   └── commands/              # カスタムスラッシュコマンド
│
├── components/                # Reactコンポーネント
│   ├── Calendar/              # カレンダーコンポーネント
│   ├── StaffList/             # スタッフリストコンポーネント
│   ├── RequirementsPanel/     # シフト要件パネル
│   └── [その他コンポーネント]
│
├── services/                  # ビジネスロジック
│   ├── geminiService.ts       # AI API呼び出し（現在無効化）
│   ├── scheduleService.ts     # シフトロジック
│   └── exportService.ts       # エクスポート機能
│
├── functions/                 # Cloud Functions
│   ├── src/
│   │   └── index.ts           # エントリーポイント
│   ├── package.json           # Cloud Functions依存関係
│   ├── tsconfig.json          # TypeScript設定
│   └── .gitignore
│
├── public/                    # 静的ファイル
│   └── favicon.svg            # ファビコン
│
├── dist/                      # ビルド成果物（Git無視）
│
├── node_modules/              # 依存関係（Git無視）
│
├── App.tsx                    # ルートコンポーネント
├── index.tsx                  # エントリーポイント
├── index.css                  # Tailwind CSSインポート
├── index.html                 # HTMLテンプレート
│
├── types.ts                   # TypeScript型定義
├── constants.ts               # 定数定義
│
├── firebase.json              # Firebase設定
├── firestore.rules            # Firestoreセキュリティルール
├── firestore.indexes.json     # Firestoreインデックス
├── storage.rules              # Cloud Storageルール
├── .firebaserc                # Firebaseプロジェクト設定
│
├── vite.config.ts             # Vite設定
├── tsconfig.json              # TypeScript設定
├── tailwind.config.js         # Tailwind CSS設定
├── postcss.config.js          # PostCSS設定
├── package.json               # プロジェクト依存関係
├── package-lock.json          # 依存関係ロック
│
├── .env.local                 # 環境変数（Git無視）
├── .gitignore                 # Git無視設定
├── CLAUDE.md                  # Claude Code用プロジェクト説明
└── README.md                  # プロジェクトREADME
```

---

## ファイル詳細

### ルートファイル

#### `App.tsx`
**役割**: ルートReactコンポーネント、アプリケーション全体のレイアウト

**構造**:
```typescript
export default function App() {
  // 状態管理
  const [staffList, setStaffList] = useState<Staff[]>(SAMPLE_STAFF);
  const [requirements, setRequirements] = useState<ShiftRequirement>(DEFAULT_REQUIREMENTS);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest>({});
  const [schedule, setSchedule] = useState<StaffSchedule[]>([]);

  // ハンドラー
  const handleGenerateShift = () => { ... };
  const handleGenerateDemoShift = () => { ... };

  return (
    <div className="flex h-screen">
      <aside>{/* 左パネル */}</aside>
      <main>{/* 右パネル */}</main>
    </div>
  );
}
```

**責務**:
- グローバル状態管理
- レイアウト構成
- イベントハンドラー

---

#### `index.tsx`
**役割**: Reactアプリのエントリーポイント

```typescript
import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

---

#### `types.ts`
**役割**: 全プロジェクト共通の型定義

**主要な型**:
```typescript
// スタッフ情報
export interface Staff {
  id: string;
  name: string;
  role: StaffRole;
  qualifications: Qualification[];
  isNightShiftOnly: boolean;
  unavailableDates: string[];
}

export type StaffRole = '管理者' | '介護職員' | '看護職員' | 'ケアマネージャー' | 'オペレーター';
export type Qualification = '介護福祉士' | '看護師' | '准看護師' | '普通自動車免許';

// シフト要件
export interface ShiftRequirement {
  早番: TimeSlotRequirement;
  日勤: TimeSlotRequirement;
  遅番: TimeSlotRequirement;
  夜勤: TimeSlotRequirement;
}

export interface TimeSlotRequirement {
  total: number;
  qualifications: { [key in Qualification]?: number };
}

// 休暇申請
export interface LeaveRequest {
  [staffId: string]: {
    [date: string]: LeaveType;
  };
}

export type LeaveType = '有給休暇' | '欠勤' | '研修';

// シフトスケジュール
export interface StaffSchedule {
  staffId: string;
  staffName: string;
  shifts: { [date: string]: ShiftType };
}

export type ShiftType = '早番' | '日勤' | '遅番' | '夜勤' | '休み';
```

**命名規則**:
- インターフェース: PascalCase (`Staff`, `ShiftRequirement`)
- 型エイリアス: PascalCase (`StaffRole`, `ShiftType`)
- プロパティ: camelCase (`unavailableDates`, `isNightShiftOnly`)

---

#### `constants.ts`
**役割**: アプリケーション全体の定数

```typescript
// サンプルデータ
export const SAMPLE_STAFF: Staff[] = [ ... ];

// デフォルト設定
export const DEFAULT_REQUIREMENTS: ShiftRequirement = {
  早番: { total: 2, qualifications: { '普通自動車免許': 1 } },
  日勤: { total: 3, qualifications: { '看護職員': 1 } },
  遅番: { total: 2, qualifications: { '普通自動車免許': 1 } },
  夜勤: { total: 1, qualifications: { '介護職員': 1 } },
};

// 時間帯定義
export const TIME_SLOTS = ['早番', '日勤', '遅番', '夜勤'] as const;

// 資格リスト
export const QUALIFICATIONS = [
  '介護福祉士',
  '看護師',
  '准看護師',
  '普通自動車免許',
] as const;
```

---

### `components/` ディレクトリ

#### コンポーネント設計原則

1. **単一責任の原則**: 1コンポーネント1機能
2. **Props型定義**: すべてのPropsに型を付ける
3. **純粋関数**: 副作用はuseEffect内で
4. **再利用性**: 汎用的なコンポーネントは共通化

#### コンポーネントファイル命名規則
- **ファイル名**: PascalCase.tsx (`StaffCard.tsx`)
- **コンポーネント名**: ファイル名と同じ (`StaffCard`)
- **Props型**: `{ComponentName}Props` (`StaffCardProps`)

#### コンポーネント例
```typescript
// components/StaffCard/StaffCard.tsx

import { Staff } from '../../types';

interface StaffCardProps {
  staff: Staff;
  onUpdate: (staff: Staff) => void;
  onDelete: (staffId: string) => void;
}

export function StaffCard({ staff, onUpdate, onDelete }: StaffCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-white rounded-lg border border-slate-200">
      {/* コンポーネント内容 */}
    </div>
  );
}
```

---

### `services/` ディレクトリ

#### サービス設計原則

1. **ビジネスロジックの分離**: UIから独立
2. **純粋関数**: 同じ入力には同じ出力
3. **エラーハンドリング**: すべてのエラーをキャッチ
4. **型安全**: 引数・戻り値に型を付ける

#### `geminiService.ts`
**役割**: Cloud Functions経由でAI API呼び出し（Gemini 2.5 Flash）

```typescript
// 現在の実装（2025-12-07更新）
export const generateShiftSchedule = async (
  staffList: Staff[],
  requirements: ShiftRequirement,
  leaveRequests: LeaveRequest
): Promise<ShiftGenerationResult> => {
  const CLOUD_FUNCTION_URL = getCloudFunctionUrl();

  const response = await fetch(CLOUD_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ staffList, requirements, leaveRequests }),
  });

  // ...エラーハンドリング、レスポンス検証
  return { schedule, evaluation, metadata };
};
```

---

### `functions/` ディレクトリ

#### Cloud Functions構造

```
functions/
├── src/
│   ├── index.ts              # エントリーポイント
│   ├── shift-generation.ts   # シフト生成ロジック（未実装）
│   └── utils/                # ユーティリティ
├── package.json
├── tsconfig.json
└── .gitignore
```

#### `functions/src/index.ts`
```typescript
import { setGlobalOptions } from 'firebase-functions/v2';
import { onRequest } from 'firebase-functions/v2/https';

setGlobalOptions({
  region: 'us-central1', // 米国中部リージョン（全関数統一）
  memory: '512MiB',
  timeoutSeconds: 60,
  minInstances: 0,
  maxInstances: 10,
});

// エンドポイントのエクスポート
export { generateShift } from './shift-generation';
```

---

## コーディング規約

### TypeScript

#### 命名規則
- **変数・関数**: camelCase (`staffList`, `handleSubmit`)
- **定数**: UPPER_SNAKE_CASE (`MAX_STAFF_COUNT`)
- **型・インターフェース**: PascalCase (`Staff`, `ShiftRequirement`)
- **コンポーネント**: PascalCase (`StaffCard`, `CalendarView`)
- **ファイル名**: PascalCase.tsx (コンポーネント), camelCase.ts (その他)

#### 型付け
```typescript
// ❌ 悪い例
function calculateTotal(items: any) {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// ✅ 良い例
interface Item {
  price: number;
  name: string;
}

function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}
```

#### アロー関数 vs 通常関数
```typescript
// コンポーネント: 通常関数
export function StaffCard({ staff }: StaffCardProps) {
  // ...
}

// イベントハンドラー: アロー関数
const handleClick = () => {
  // ...
};

// サービス関数: アロー関数（exportする場合）
export const generateShift = async (...) => {
  // ...
};
```

---

### React

#### Hooks使用順序
```typescript
function Component() {
  // 1. useState
  const [count, setCount] = useState(0);
  const [name, setName] = useState('');

  // 2. useEffect
  useEffect(() => {
    // 副作用処理
  }, []);

  // 3. カスタムフック
  const data = useCustomHook();

  // 4. イベントハンドラー
  const handleClick = () => {
    // ...
  };

  // 5. JSXを返す
  return <div>...</div>;
}
```

#### 条件付きレンダリング
```typescript
// ❌ 悪い例
{isLoading ? <Loader /> : data ? <Content data={data} /> : <Empty />}

// ✅ 良い例
{isLoading && <Loader />}
{!isLoading && data && <Content data={data} />}
{!isLoading && !data && <Empty />}
```

---

### Tailwind CSS

#### クラス名の順序
1. レイアウト (flex, grid, block)
2. サイズ (w-, h-, min-, max-)
3. スペーシング (m-, p-)
4. タイポグラフィ (text-, font-)
5. カラー (bg-, text-, border-)
6. その他 (rounded-, shadow-, transition-)

```typescript
// ✅ 良い例
<div className="flex items-center justify-between w-full p-4 text-lg font-bold text-slate-800 bg-white rounded-lg shadow-md transition-colors">
```

#### カスタムカラー使用
```typescript
// ✅ カスタムcare-*カラーを使用
<button className="bg-care-secondary hover:bg-care-dark text-white">
  シフト作成
</button>
```

---

## Git規約

### ブランチ戦略

```
main         # 本番環境（Firebase Hosting）
  └─ develop # 開発環境
       ├─ feature/staff-management
       ├─ feature/shift-generation
       └─ bugfix/calendar-display
```

### コミットメッセージ

**フォーマット**: `<type>: <subject>`

**Type**:
- `feat`: 新機能
- `fix`: バグ修正
- `docs`: ドキュメント
- `style`: コードスタイル（機能変更なし）
- `refactor`: リファクタリング
- `test`: テスト
- `chore`: ビルド・設定変更

**例**:
```
feat: スタッフ情報編集機能を追加
fix: カレンダー表示の月またぎバグを修正
docs: アーキテクチャドキュメントを更新
refactor: ShiftService を関数型に書き換え
```

---

## テストディレクトリ（将来実装）

```
__tests__/
├── unit/                    # 単体テスト
│   ├── services/
│   │   └── scheduleService.test.ts
│   └── utils/
│       └── dateUtils.test.ts
│
├── integration/             # 統合テスト
│   └── api/
│       └── generateShift.test.ts
│
└── e2e/                     # E2Eテスト
    └── shift-creation.spec.ts
```

---

## まとめ

このプロジェクトは、明確なディレクトリ構造とコーディング規約により、メンテナンス性と拡張性を確保しています。特に、型安全性を重視したTypeScriptの使用と、コンポーネント指向のReact設計により、大規模な機能追加にも対応できる基盤が整っています。
