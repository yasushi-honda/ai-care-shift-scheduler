# Technology Stack - 技術スタックと技術的決定

## 技術スタック概要

### フロントエンド
```
React 19.x
├── TypeScript 5.8.x
├── Vite 6.x (ビルドツール)
└── Tailwind CSS 3.x (スタイリング)
```

### バックエンド（Cloud Functions）
```
Firebase Functions (Gen 2)
├── Node.js 20
├── TypeScript 5.x
└── Vertex AI SDK for Node.js
```

### インフラストラクチャ（GCP）
```
Google Cloud Platform
├── Firebase Hosting (フロントエンド配信)
├── Cloud Functions (バックエンドAPI)
├── Firestore (データベース)
├── Cloud Storage for Firebase (ファイル保存)
└── Vertex AI (Gemini 2.5 Flash-Lite)
```

### 開発・CI/CD
```
GitHub
├── GitHub Actions (CI/CD)
├── Workload Identity Federation (認証)
└── Dependabot (依存関係更新)
```

---

## 詳細技術仕様

### 1. フロントエンド

#### React 19.x
**選定理由**:
- 最新の並行レンダリング機能
- Server Componentsのサポート（将来のSSR化に備える）
- TypeScriptとの優れた統合

**使用している主要機能**:
- `useState`: ローカル状態管理
- `useEffect`: 副作用処理
- カスタムフック: ビジネスロジックの分離

**コンポーネント設計原則**:
- **単一責任の原則**: 1コンポーネント1機能
- **Presentational/Container分離**: UIロジックとビジネスロジックの分離
- **Props型定義**: すべてのPropsをTypeScriptで型定義

#### TypeScript 5.8.x
**選定理由**:
- 型安全性による実行時エラーの削減
- IDEの補完サポート
- リファクタリングの容易さ

**TypeScript設定** (`tsconfig.json`):
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

**型定義の方針**:
- すべての関数引数・戻り値に型を付ける
- `any`の使用は禁止、代わりに`unknown`を使用
- インターフェース(`interface`)を優先、型エイリアス(`type`)は必要時のみ

#### Vite 6.x
**選定理由**:
- 高速な開発サーバー起動（ES Modules使用）
- HMR（Hot Module Replacement）の優れたパフォーマンス
- React用プラグインの充実

**ビルド設定** (`vite.config.ts`):
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
  }
})
```

#### Tailwind CSS 3.x
**選定理由**:
- ユーティリティファーストで高速な開発
- Purge CSSによる最小限のファイルサイズ
- レスポンシブデザインの容易さ

**注意: Tailwind CSS v4の問題**
- 初期実装でv4を使用したが、Viteとの統合に問題が発生
- ビルド時にCSSが正しく生成されない（2行しかない）
- **v3.xにダウングレードして解決**

**カスタムテーマ** (`tailwind.config.js`):
```javascript
export default {
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        'care-primary': '#4338ca',    // indigo-700
        'care-secondary': '#4f46e5',  // indigo-600
        'care-light': '#e0e7ff',      // indigo-100
        'care-dark': '#3730a3',       // indigo-800
      },
    }
  }
}
```

---

### 2. バックエンド

#### Cloud Functions (Gen 2)
**選定理由**:
- サーバーレスで運用コスト最小化
- 自動スケーリング
- Firebase Hostingとのシームレスな統合

**グローバル設定** (`functions/src/index.ts`):
```typescript
setGlobalOptions({
  region: 'asia-northeast1',  // 東京リージョン
  memory: '512MiB',
  timeoutSeconds: 60,
  minInstances: 0,
  maxInstances: 10,
});
```

**現在実装されているエンドポイント**:
- `healthCheck`: ヘルスチェック用エンドポイント
- `generateShift`: （未実装）AIシフト生成API

**セキュリティ設定**:
- CORS: すべてのオリジンを許可（開発段階）
- 認証: なし（将来実装予定）

#### Vertex AI - Gemini 2.5 Flash-Lite (GA版)
**選定理由**:
- **コスト効率**: 最もコスト効率的なGeminiモデル
- **高速**: 高スループット対応（出力トークン50%削減）
- **安定版**: GA（Generally Available）で本番環境に適合
- **文脈理解**: 100万トークンのコンテキストウィンドウ

**モデル情報**（2025年10月時点）:
- **モデル名**: `gemini-2.5-flash-lite` （自動更新安定版エイリアス）
- **リリース日**: 2025年7月22日
- **サポート期限**: 2026年7月22日
- **バージョン管理**: バージョン番号や日付を省略したモデル名は、Googleの「自動更新安定版エイリアス」として機能し、常に最新の安定版を指します

**使用方針**:
- モデル名: `gemini-2.5-flash-lite` （GA版）
- 本番環境対応: GA版のため、本番環境での使用に適している
- バージョン管理: バージョン番号や日付を省略したモデル名は、自動的に最新の安定版を使用
- フォールバック: なし（失敗時はエラーを返す）

**参考ドキュメント**:
- [Model versions and lifecycle](https://cloud.google.com/vertex-ai/generative-ai/docs/learn/model-versions)
- [Gemini 2.5 Updates](https://developers.googleblog.com/en/continuing-to-bring-you-our-latest-models-with-an-improved-gemini-2-5-flash-and-flash-lite-release/)

**プロンプト設計**:
```
あなたは介護施設のシフト作成AIです。
以下の条件でシフトを作成してください：

【スタッフ情報】
- 氏名、役職、資格、勤務不可日

【要件】
- 時間帯別必要人員
- 資格要件

【制約条件】
- 労働基準法遵守
- 公平性の確保
```

---

### 3. データベース

#### Cloud Firestore (Native Mode)
**選定理由**:
- リアルタイム同期
- オフラインサポート（将来実装）
- スケーラビリティ

**リージョン**: `asia-northeast1` (東京)

**コレクション構造**:
```
/facilities/{facilityId}
  └─ /staff/{staffId}
  └─ /schedules/{scheduleId}
  └─ /leaveRequests/{requestId}
  └─ /requirements/{requirementId}
```

**インデックス** (`firestore.indexes.json`):
```json
{
  "indexes": [
    {
      "collectionGroup": "schedules",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "targetMonth", "order": "DESCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "leaveRequests",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "date", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    }
  ]
}
```

**セキュリティルール** (`firestore.rules`):
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;  // 開発モード
    }
  }
}
```
⚠️ **警告**: 本番環境では認証付きルールに変更必須

---

### 4. CI/CD

#### GitHub Actions
**ワークフロー** (`.github/workflows/ci.yml`):
```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/
```

#### Workload Identity Federation（将来実装）
**選定理由**:
- JWT/APIキー不要
- サービスアカウントによる安全な認証
- GitHub ActionsとGCPのシームレスな統合

**設定手順**（未実装）:
1. GCPでWorkload Identity Poolを作成
2. サービスアカウントに権限付与
3. GitHub Secretsに設定
4. deploy jobでFirebase Hostingにデプロイ

---

## 技術的決定の記録（ADR）

### ADR-001: Tailwind CSS v3を使用する
**日付**: 2025-10-22
**状態**: 承認

**背景**:
- 初期実装でTailwind CSS v4を使用
- ビルド時にCSSが正しく生成されない問題が発生
- 原因: v4の新しい`@import "tailwindcss"`と`@theme`構文がViteと互換性がない

**決定**:
- Tailwind CSS v3にダウングレード
- 安定版の`@tailwind`ディレクティブを使用

**結果**:
- ビルドが正常に動作（21.78 KB）
- すべてのユーティリティクラスが生成される
- カスタムテーマが正しく適用される

---

### ADR-002: Gemini API呼び出しをCloud Functions経由にする
**日付**: 2025-10-22
**状態**: 承認

**背景**:
- プロトタイプはブラウザから直接Gemini APIを呼び出していた
- 本番環境でAPIキーが露出するセキュリティリスク
- ブラウザコンソールに"An API Key must be set"エラー

**決定**:
- `services/geminiService.ts`の直接API呼び出しを無効化
- Cloud Functions経由でVertex AI APIを呼び出す設計に変更
- ブラウザには分かりやすいエラーメッセージを表示

**代替手段**:
- 「デモシフト作成」ボタンでランダムシフトを生成
- Cloud Functions実装までの暫定対応

---

### ADR-003: 認証なしでMVPをリリースする
**日付**: 2025-10-22
**状態**: 承認

**背景**:
- 開発速度を優先
- 機能検証が先決

**決定**:
- MVP（現バージョン）は認証機能なし
- Firestoreは開発モード（全アクセス許可）
- Phase 2でFirebase Authentication導入

**リスク**:
- データの漏洩・改ざん可能
- 本番環境での使用は非推奨

**緩和策**:
- 公開URLは関係者のみに共有
- Phase 2への早期移行

---

### ADR-004: Firebase Hostingを使用する
**日付**: 2025-10-22
**状態**: 承認

**背景**:
- Cloud RunとFirebase Hostingを比較
- 静的サイトホスティングが要件

**決定**:
- Firebase Hostingを採用

**理由**:
- CDN配信で高速
- SSL証明書自動発行
- Cloud Functionsとのシームレスな統合
- 低コスト（1GB/月まで無料）

---

## 開発環境

### 必須ツール
- **Node.js**: 20.x LTS
- **npm**: 10.x
- **Firebase CLI**: 13.x
- **gcloud CLI**: 最新版
- **Git**: 2.x

### 推奨エディタ設定（VS Code）
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.tsdk": "node_modules/typescript/lib",
  "tailwindCSS.experimental.classRegex": [
    ["class:\\s*?[\"'`]([^\"'`]*).*?[\"'`]"]
  ]
}
```

### 環境変数 (`.env.local`)
```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=ai-care-shift-scheduler.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=ai-care-shift-scheduler
VITE_FIREBASE_STORAGE_BUCKET=ai-care-shift-scheduler.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=737067812481
VITE_FIREBASE_APP_ID=1:737067812481:web:...
VITE_FIREBASE_MEASUREMENT_ID=G-...

# GCP Configuration
VITE_GCP_PROJECT_ID=ai-care-shift-scheduler
VITE_GCP_PROJECT_NUMBER=737067812481
```

---

## パフォーマンス目標

### フロントエンド
- **初期ロード**: < 2秒（3G回線）
- **Time to Interactive**: < 3秒
- **Lighthouse Score**: > 90

### バックエンド
- **API応答時間**: < 500ms (p95)
- **AIシフト生成**: < 10秒
- **コールドスタート**: < 2秒

### 最適化手法
- Code splitting（React.lazy）
- Tree shaking（Vite）
- CSS purging（Tailwind CSS）
- 画像最適化（WebP）
- CDNキャッシング（Firebase Hosting）

---

## セキュリティ

### 現状（MVP）
- ⚠️ 認証なし
- ⚠️ Firestore全開放
- ✅ HTTPS通信
- ✅ CORS設定
- ✅ APIキー非公開（Cloud Functions経由）

### 将来実装
- Firebase Authentication
- Firestore Security Rules
- Cloud Armor（DDoS対策）
- Secret Manager（APIキー管理）

---

## 依存関係管理

### 依存関係の更新方針
- **メジャーバージョン**: 手動で慎重に更新
- **マイナーバージョン**: 四半期ごとに更新
- **パッチバージョン**: 自動更新（Dependabot）

### 現在の主要依存関係
```json
{
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
  "devDependencies": {
    "typescript": "~5.8.2",
    "vite": "^6.2.0",
    "tailwindcss": "^3.4.1"
  }
}
```

---

## まとめ

このプロジェクトは、モダンなWeb技術スタックと、GCPのマネージドサービスを活用することで、高速で安全、かつスケーラブルなシステムを実現しています。特にTailwind CSS v3への決定や、Cloud Functions経由でのAPI呼び出しなど、実装過程での技術的課題を適切に解決しています。
