# Architecture - システムアーキテクチャ

## アーキテクチャ概要

AIシフト自動作成は、Google Cloud Platform（GCP）上に構築された、サーバーレスなマイクロサービスアーキテクチャです。

```
┌─────────────────────────────────────────────────────────────┐
│                         Users                                │
│                    (管理者・スタッフ)                          │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  Firebase Hosting (CDN)                      │
│                  https://ai-care-shift-scheduler.web.app     │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  React 19 + TypeScript + Tailwind CSS                │  │
│  │  - スタッフ管理UI                                      │  │
│  │  - シフト要件設定UI                                    │  │
│  │  - カレンダー表示                                      │  │
│  │  - CSV エクスポート                                    │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS (CORS)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Cloud Functions (us-central1)                  │
│                                                              │
│  ┌────────────────────────────────────────────────┐         │
│  │  generateShift                                 │         │
│  │  - AIシフト生成（Gemini 2.5 Pro）               │         │
│  │  - 1GB メモリ、540秒タイムアウト                │         │
│  └──────────────────────┬─────────────────────────┘         │
└──────────────────────────────────┼──────────────────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
        ▼                          ▼                          ▼
┌───────────────┐      ┌──────────────────────┐   ┌──────────────────┐
│   Firestore   │      │    Vertex AI         │   │ Cloud Storage    │
│  (Database)   │      │  Gemini 2.5 Pro      │   │  (File Storage)  │
│               │      │  asia-northeast1     │   │                  │
│ - スタッフ情報 │      │                      │   │ - エクスポート   │
│ - シフトデータ │      │ - シフト最適化AI     │   │ - バックアップ   │
│ - 休暇申請    │      │ - 制約条件考慮       │   │                  │
│ - 要件設定    │      │                      │   │                  │
└───────────────┘      └──────────────────────┘   └──────────────────┘
```

---

## GCPプロジェクト情報

### プロジェクト詳細
- **プロジェクトID**: `ai-care-shift-scheduler`
- **プロジェクト番号**: `737067812481`
- **請求アカウント**: 有効（admin@fuku-no-tane.com）
- **Firestoreリージョン**: `asia-northeast1` (東京)
- **Cloud Functionsリージョン**: `us-central1` (米国中部、全関数統一)
- **作成日**: 2025-10-22

### 有効化されたAPI
```bash
# Firebase関連
firebase.googleapis.com
firebasehosting.googleapis.com
firebasestorage.googleapis.com

# Cloud Functions
cloudfunctions.googleapis.com
cloudbuild.googleapis.com

# Firestore
firestore.googleapis.com

# Vertex AI
aiplatform.googleapis.com

# その他
cloudresourcemanager.googleapis.com
serviceusage.googleapis.com
```

### IAMロール
| サービスアカウント | 役割 | 用途 |
|------------------|------|------|
| admin@fuku-no-tane.com | Owner | プロジェクト管理 |
| （将来）gh-actions@... | Workload Identity User | CI/CD |

---

## コンポーネント詳細

### 1. Firebase Hosting

#### 概要
静的ファイル（HTML, CSS, JS）を配信するCDN。

#### 設定 (`firebase.json`)
```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**/*.@(jpg|jpeg|gif|png|svg|webp|ico)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          }
        ]
      },
      {
        "source": "**/*.@(js|css)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          }
        ]
      }
    ]
  }
}
```

#### キャッシュ戦略
- **画像・アイコン**: 1年間キャッシュ
- **JS/CSSバンドル**: 1年間キャッシュ（ハッシュ付きファイル名）
- **index.html**: キャッシュなし（常に最新を取得）

#### デプロイURL
- **本番**: https://ai-care-shift-scheduler.web.app
- **Firebase Console**: https://console.firebase.google.com/project/ai-care-shift-scheduler

#### デプロイコマンド
```bash
npm run build
firebase deploy --only hosting
```

---

### 2. Cloud Functions (Gen 2)

#### 概要
サーバーレスなバックエンドAPI。Node.js 20で動作。

#### グローバル設定
```typescript
setGlobalOptions({
  region: 'us-central1',       // 米国中部リージョン（全関数統一）
  memory: '512MiB',            // メモリ割り当て
  timeoutSeconds: 60,          // タイムアウト
  minInstances: 0,             // コールドスタート許可
  maxInstances: 10,            // 最大同時実行数
});
```

**リージョン選定理由**:
- Gemini 2.5 Flash-Lite が us-central1 でのみ利用可能
- Artifact Registryのストレージコスト削減
- シンプルな構成で管理が容易

#### エンドポイント

##### generateShift
**用途**: AIによるシフト自動生成（Gemini 2.5 Pro使用、asia-northeast1）

**リクエスト**:
```
POST /generateShift
Content-Type: application/json

{
  "staffList": [...],
  "requirements": {...},
  "leaveRequests": {...},
  "targetMonth": "2025-11"
}
```

**レスポンス**:
```json
{
  "schedule": [
    {
      "staffId": "staff-001",
      "shifts": {
        "2025-11-01": "早番",
        "2025-11-02": "日勤",
        ...
      }
    }
  ],
  "metadata": {
    "generatedAt": "2025-10-22T07:00:00.000Z",
    "model": "gemini-2.5-flash-lite",
    "tokensUsed": 15234
  }
}
```

**実装方針**:
```typescript
export const generateShift = onRequest(
  { region: 'us-central1', cors: true }, // Gemini 2.5 Flash-Lite対応リージョン
  async (req, res) => {
    // 1. リクエストバリデーション
    const { staffList, requirements, leaveRequests } = req.body;

    // 2. Vertex AI呼び出し
    const vertexAI = new VertexAI({
      project: 'ai-care-shift-scheduler',
      location: 'us-central1', // Gemini 2.5 Flash-Lite対応リージョン
    });

    const model = vertexAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite', // 自動更新安定版エイリアス
    });

    // 3. プロンプト構築
    const prompt = buildPrompt(staffList, requirements, leaveRequests);

    // 4. AI実行
    const result = await model.generateContent(prompt);

    // 5. レスポンス整形
    const schedule = parseAIResponse(result.response.text());

    res.status(200).json({ schedule });
  }
);
```

---

### 3. Cloud Firestore

#### 概要
NoSQLドキュメントデータベース。リアルタイム同期対応。

#### データモデル

##### facilities コレクション
```typescript
interface Facility {
  id: string;
  name: string;
  type: '訪問介護' | 'デイサービス' | '特別養護老人ホーム';
  address: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

##### staff サブコレクション
```typescript
interface Staff {
  id: string;
  facilityId: string;
  name: string;
  role: '管理者' | '介護職員' | '看護職員' | 'ケアマネージャー';
  qualifications: string[];  // ['介護福祉士', '看護師', '普通自動車免許']
  isNightShiftOnly: boolean;
  unavailableDates: string[]; // ['2025-11-10', '2025-11-22']
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

##### schedules サブコレクション
```typescript
interface Schedule {
  id: string;
  facilityId: string;
  targetMonth: string;  // '2025-11'
  staffSchedules: StaffSchedule[];
  createdAt: Timestamp;
  createdBy: string;
  version: number;
  status: 'draft' | 'confirmed' | 'archived';
}

interface StaffSchedule {
  staffId: string;
  staffName: string;
  shifts: { [date: string]: ShiftType };
}

type ShiftType = '早番' | '日勤' | '遅番' | '夜勤' | '休み';
```

##### requirements サブコレクション
```typescript
interface ShiftRequirement {
  id: string;
  facilityId: string;
  targetMonth: string;
  timeSlots: {
    早番: { total: number; qualifications: { [qual: string]: number } };
    日勤: { total: number; qualifications: { [qual: string]: number } };
    遅番: { total: number; qualifications: { [qual: string]: number } };
    夜勤: { total: number; qualifications: { [qual: string]: number } };
  };
  createdAt: Timestamp;
}
```

##### leaveRequests サブコレクション
```typescript
interface LeaveRequest {
  id: string;
  facilityId: string;
  staffId: string;
  date: string;  // '2025-11-10'
  type: '有給休暇' | '欠勤' | '研修';
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Timestamp;
}
```

#### インデックス
```json
{
  "indexes": [
    {
      "collectionGroup": "schedules",
      "fields": [
        { "fieldPath": "targetMonth", "order": "DESCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "leaveRequests",
      "fields": [
        { "fieldPath": "date", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    }
  ]
}
```

#### セキュリティルール（現状）
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 開発モード: すべて許可
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

#### セキュリティルール（将来実装）
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /facilities/{facilityId} {
      allow read: if request.auth != null &&
                    request.auth.token.facilityId == facilityId;
      allow write: if request.auth != null &&
                     request.auth.token.role == 'admin';

      match /staff/{staffId} {
        allow read, write: if request.auth != null &&
                             request.auth.token.facilityId == facilityId;
      }

      match /schedules/{scheduleId} {
        allow read: if request.auth != null &&
                      request.auth.token.facilityId == facilityId;
        allow write: if request.auth != null &&
                       request.auth.token.role in ['admin', 'manager'];
      }
    }
  }
}
```

---

### 4. Vertex AI (Gemini 2.5 Pro)

#### 概要
Google の最新生成AIモデル。シフト最適化と評価に使用。

#### モデル仕様（2025年12月時点）
- **モデル名**: `gemini-2.5-pro`
- **リージョン**: `asia-northeast1` （東京）
- **コンテキストウィンドウ**: 100万トークン
- **特徴**: 思考モード常時ON、複雑な制約条件の推論に最適

**本プロジェクトでの使用リージョン**: `asia-northeast1` （東京）

#### 詳細なAI生成フロー
**→ [ai-generation-flow.md](./ai-generation-flow.md)** を参照

主要な処理:
- 小規模（≤5名）: 一括生成
- 大規模（>5名）: Phase 1（骨子）→ Phase 2（詳細バッチ）
- 処理時間: 90-400秒

#### 既知の問題と対策
- **JSONパース不安定**: parseGeminiJsonResponse で複数のワークアラウンド実装
- **処理時間のばらつき**: 90-400秒（Cloud Functionsタイムアウト540秒に近い）
- **詳細**: [ai-generation-flow.md](./ai-generation-flow.md) のセクション6を参照

#### プロンプトエンジニアリング

**システムプロンプト**:
```
あなたは介護施設のシフト作成を専門とするAIアシスタントです。
以下のルールを厳守してシフトを作成してください：

【必須ルール】
1. 労働基準法の遵守
   - 週40時間以内の労働時間
   - 月8回以上の休日
   - 連続勤務は最大6日まで

2. 介護保険法の遵守
   - 時間帯別の最低人員配置基準を満たす
   - 必要な資格を持つスタッフを配置

3. 公平性
   - 夜勤回数の偏りを最小化
   - 休日の偏りを最小化

【出力形式】
JSON形式で以下の構造で出力してください：
{
  "schedule": [
    {
      "staffId": "staff-001",
      "staffName": "田中 愛",
      "shifts": {
        "2025-11-01": "早番",
        "2025-11-02": "日勤",
        ...
      }
    }
  ],
  "warnings": [
    "スタッフ鈴木太郎が週40時間を超える可能性があります"
  ]
}
```

**ユーザープロンプト例**:
```
【対象月】
2025年11月

【スタッフ情報】
1. 田中 愛（看護師、普通自動車免許）- 勤務不可日: 10日, 22日
2. 鈴木 太郎（介護福祉士）- 夜勤専従
3. 佐藤 花子（介護福祉士、普通自動車免許）
4. 高橋 健太（介護職員）
5. 渡辺 久美子（看護師）

【シフト要件】
- 早番: 合計2人（内 普通自動車免許1人）
- 日勤: 合計3人（内 看護職員1人）
- 遅番: 合計2人（内 普通自動車免許1人）
- 夜勤: 合計1人（内 介護職員1人）

上記の条件で最適なシフトを作成してください。
```

#### エラーハンドリング
```typescript
try {
  const result = await model.generateContent(prompt);
  return parseResponse(result);
} catch (error) {
  if (error.code === 'RESOURCE_EXHAUSTED') {
    // レート制限エラー
    return { error: 'AIサービスが混雑しています。しばらくしてから再試行してください。' };
  } else if (error.code === 'INVALID_ARGUMENT') {
    // 入力エラー
    return { error: '入力データに問題があります。スタッフ情報と要件を確認してください。' };
  } else {
    // その他のエラー
    return { error: 'シフト生成に失敗しました。条件を確認して再度お試しください。' };
  }
}
```

---

### 5. Cloud Storage for Firebase

#### 概要
ファイルストレージサービス。エクスポートデータやバックアップを保存。

#### バケット構造
```
gs://ai-care-shift-scheduler.firebasestorage.app/
├── exports/
│   ├── {facilityId}/
│   │   ├── schedule-2025-11.csv
│   │   └── schedule-2025-12.csv
├── backups/
│   ├── firestore-backup-2025-10-22.json
└── temp/
    └── {sessionId}/
```

#### セキュリティルール（現状）
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true;  // 開発モード
    }
  }
}
```

#### セキュリティルール（将来実装）
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /exports/{facilityId}/{filename} {
      allow read: if request.auth != null &&
                    request.auth.token.facilityId == facilityId;
      allow write: if request.auth != null &&
                     request.auth.token.role == 'admin';
    }
  }
}
```

---

## データフロー

### シフト生成フロー

```
1. ユーザー入力
   ├── スタッフ情報入力
   ├── シフト要件設定
   └── 休暇申請入力

2. フロントエンド処理
   ├── バリデーション
   ├── データ整形
   └── API呼び出し

3. Cloud Functions
   ├── リクエスト検証
   ├── Firestoreからデータ取得
   └── Vertex AI呼び出し

4. Vertex AI (Gemini)
   ├── プロンプト解析
   ├── 制約条件考慮
   ├── 最適化計算
   └── シフト生成

5. Cloud Functions
   ├── レスポンスパース
   ├── Firestoreに保存
   └── フロントエンドへ返却

6. フロントエンド表示
   ├── カレンダーレンダリング
   ├── 警告表示
   └── CSV エクスポート
```

---

## 非機能要件

### パフォーマンス
- **目標レイテンシ**:
  - ページロード: < 2秒
  - API応答: < 500ms (p95)
  - AIシフト生成: 90-400秒（スタッフ数による）

- **スループット**:
  - 同時ユーザー数: 100人
  - API呼び出し: 1000 req/min

### 可用性
- **目標SLA**: 99.9% (月間ダウンタイム < 43分)
- **リージョン**:
  - Firestore: asia-northeast1（東京）
  - Cloud Functions: us-central1（米国中部、全関数統一）
  - Vertex AI: us-central1（Gemini 2.5 Flash-Lite使用）
- **バックアップ**: 日次自動バックアップ

### スケーラビリティ
- **Cloud Functions**: 自動スケーリング（0〜10インスタンス）
- **Firestore**: 無制限スケーリング
- **Firebase Hosting**: CDN自動スケーリング

### セキュリティ
- **通信**: HTTPS/TLS 1.3
- **認証**: Firebase Authentication（実装済み）
- **認可**: Firestore Security Rules + RBAC
- **監査ログ**: Cloud Logging

---

## コスト見積もり

### 月間コスト試算（100ユーザー想定）

| サービス | 使用量 | 単価 | 月額 |
|---------|--------|------|------|
| Firebase Hosting | 10 GB転送 | $0.15/GB | $1.50 |
| Cloud Functions | 100万呼び出し | $0.40/100万 | $0.40 |
| Firestore | 100万読み取り | $0.06/100万 | $0.06 |
| Firestore | 50万書き込み | $0.18/100万 | $0.09 |
| Vertex AI (Gemini) | 1000万トークン | $0.10/100万 | $1.00 |
| Cloud Storage | 1 GB保存 | $0.026/GB | $0.03 |
| **合計** | | | **$3.08** |

**無料枠**:
- Firebase Hosting: 10 GB/月
- Cloud Functions: 200万呼び出し/月
- Firestore: 5万読み取り、2万書き込み/日

**スケーリング**:
- 1000ユーザー: 約$30/月
- 10000ユーザー: 約$300/月

---

## 監視とロギング

### Cloud Logging
- すべてのCloud Functions実行ログ
- エラートレース
- パフォーマンスメトリクス

### Cloud Monitoring
- **ダッシュボード**:
  - Firebase Hosting: トラフィック、レイテンシ
  - Cloud Functions: 呼び出し回数、エラー率、実行時間
  - Firestore: 読み書き操作数、コスト
  - Vertex AI: API呼び出し回数、トークン使用量

### アラート設定（将来実装）
- エラー率 > 5%
- レイテンシ p95 > 1秒
- コスト > $100/日

---

## ディザスタリカバリ

### バックアップ戦略
- **Firestore**: 日次エクスポート → Cloud Storage
- **頻度**: 毎日 3:00 JST
- **保持期間**: 30日間

### リストア手順
```bash
# 1. バックアップからエクスポート
gcloud firestore export gs://ai-care-shift-scheduler-backups/2025-10-22

# 2. インポート
gcloud firestore import gs://ai-care-shift-scheduler-backups/2025-10-22
```

### RTO/RPO目標
- **RTO** (Recovery Time Objective): 4時間
- **RPO** (Recovery Point Objective): 24時間

---

## 将来のアーキテクチャ拡張

### Phase 2: 認証・マルチテナント
```
+ Firebase Authentication
+ Firestore Security Rules強化
+ 事業所ごとのデータ分離
```

### Phase 3: リアルタイム通知
```
+ Cloud Pub/Sub
+ Firebase Cloud Messaging
+ Slackインテグレーション
```

### Phase 4: 分析・レポート
```
+ BigQuery連携
+ Looker Studioダッシュボード
+ 予測分析（MLモデル）
```

### Phase 5: ハイブリッド最適化層（提案中）
```
+ Google OR-Tools CP-SAT Solver導入
+ Phase 2（詳細生成）をSolverに置換
+ LLMは制約解釈・説明生成に限定
+ 処理時間: 90-400秒 → 5-30秒（目標）
+ スケーラビリティ: 15名 → 100名以上
```
**詳細**: [ADR-0004](../../docs/adr/0004-hybrid-architecture-adoption.md)

---

## まとめ

このアーキテクチャは、GCPのマネージドサービスを最大限活用することで、運用負荷を最小化しながら、スケーラブルで高可用性なシステムを実現しています。特にVertex AIとの統合により、最新のAI技術を簡単に利用でき、継続的な改善が可能です。
