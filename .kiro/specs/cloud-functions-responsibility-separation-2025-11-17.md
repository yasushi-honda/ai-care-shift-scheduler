# Cloud Functions責務分離 - 修正記録

**更新日**: 2025-11-17
**修正種別**: アーキテクチャ変更
**影響範囲**: Cloud Functions, バージョン履歴管理

---

## 📝 問題の概要

### 症状
年月ごとに新規でAIシフト作成をするたびに、バージョン履歴が強制リセットされる

### ログから判明したこと
```
🚀 Cloud Functions経由でシフト生成開始...
✅ シフト生成成功: {scheduleId: 'M9pAyDeH2xemszbUrYt6', ...}
Draft auto-saved to LocalStorage
```

**重要な観察点**:
- Cloud Functionsが毎回新しい`scheduleId`を生成していた
- App.txaの修正（`updateSchedule`使用）が機能していなかった

---

## 🔍 根本原因分析

### 構造的な問題

#### 1. **Cloud FunctionsがFirestore保存を実施していた**

```typescript
// 修正前: functions/src/shift-generation.ts:249-262
const docRef = await admin.firestore()
  .collection('schedules')  // ← facilityIdなしのグローバルコレクション
  .add({
    schedule: scheduleData.schedule,
    targetMonth: requirements.targetMonth,
    idempotencyHash,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    staffCount: staffList.length,
    status: 'generated',
    metadata: {...},
  });

res.status(200).json({
  success: true,
  scheduleId: docRef.id,  // ← 新しいIDを返す
  schedule: scheduleData.schedule,
  metadata: {...},
});
```

**問題点**:
- `/schedules/{scheduleId}` に保存（`facilityId`なし）
- App.txaは `/facilities/{facilityId}/schedules/{scheduleId}` を参照
- → 保存場所が一致せず、App.txaは独自に新規作成してしまう

#### 2. **責務が二重化していた**

| 責務 | Cloud Functions | App.txa |
|------|----------------|---------|
| AI生成 | ✅ 実施 | - |
| Firestore保存 | ✅ 実施 | ✅ 実施 |
| バージョン履歴管理 | - | ✅ 実施 |

**結果**: 両者が独立して動作し、バージョン履歴が保持されない

---

## ✅ 解決方針

### **責務の明確な分離**

| 責務 | Cloud Functions | App.txa |
|------|----------------|---------|
| AI生成 | ✅ 実施 | - |
| Firestore保存 | ❌ 削除 | ✅ 実施 |
| バージョン履歴管理 | - | ✅ 実施 |

**メリット**:
- ✅ 責務が明確（AI生成 vs データ永続化）
- ✅ 既存の`ScheduleService`をそのまま使える
- ✅ バージョン履歴の管理がApp.txa側で完結
- ✅ セキュリティ向上（`facilityId`をCloud Functionsに渡す必要なし）

---

## 🔧 修正内容

### 修正1: Cloud Functions - Firestore保存の削除

**ファイル**: `functions/src/shift-generation.ts`

#### 削除したコード

1. **キャッシュ機能**（行: 123-185）
```typescript
// 冪等性キー生成
const staffIds = staffList.map((s: Staff) => s.id).sort().join(',');
const requirementsHash = crypto.createHash('sha256')...
const idempotencyHash = crypto.createHash('sha256')...

// 既存スケジュールをチェック（冪等性保証）
const existingSchedules = await admin.firestore()
  .collection('schedules')
  .where('targetMonth', '==', requirements.targetMonth)
  .where('idempotencyHash', '==', idempotencyHash)
  ...

if (!existingSchedules.empty) {
  // キャッシュヒット
  res.status(200).json({...});
  return;
}
```

2. **Firestore保存**（行: 248-264）
```typescript
const docRef = await admin.firestore()
  .collection('schedules')
  .add({...});

console.log('💾 Firestore保存完了:', docRef.id);
```

3. **不要なimport**
```typescript
import * as crypto from 'crypto';
import * as admin from 'firebase-admin';
```

#### 修正後のコード

```typescript
// キャッシュ機能削除（フロントエンド側でバージョン履歴管理するため）
console.log('🚀 AI生成開始（キャッシュなし）');

// ... AI生成処理 ...

// Firestore保存はフロントエンド側で実施（バージョン履歴管理のため）
console.log('✅ AI生成完了（Firestore保存はスキップ）');

// 成功レスポンス（scheduleデータのみ返す）
res.status(200).json({
  success: true,
  schedule: scheduleData.schedule,
  metadata: {
    generatedAt: new Date().toISOString(),
    model: VERTEX_AI_MODEL,
    tokensUsed: tokensUsed,
  },
});
```

**変更点**:
- `scheduleId` を返さない（フロントエンド側で管理）
- `schedule` データのみ返す
- Firestore操作を完全に削除

---

### 修正2: geminiService.ts - ログ修正

**ファイル**: `services/geminiService.ts`
**行数**: 108-111

#### 修正前
```typescript
console.log('✅ シフト生成成功:', {
  scheduleId: result.scheduleId,  // ← 存在しない
  staffCount: result.schedule.length,
  tokensUsed: result.metadata?.tokensUsed || 0,
});
```

#### 修正後
```typescript
console.log('✅ シフト生成成功:', {
  staffCount: result.schedule.length,
  tokensUsed: result.metadata?.tokensUsed || 0,
});
```

---

### 修正3: App.txa - 確認（修正不要）

**ファイル**: `App.txa`
**行数**: 550-617

**確認内容**:
```typescript
const result = await generateShiftSchedule(...); // ← schedule配列を受け取る

if (currentScheduleId) {
  // 既存スケジュール更新（バージョン履歴保持）
  await ScheduleService.updateSchedule(
    selectedFacilityId,
    currentScheduleId,  // ← 既存ID使用
    currentUser.uid,
    { staffSchedules: result, status: 'draft' }
  );
} else {
  // 新規作成（初回のみ）
  await ScheduleService.saveSchedule(...);
}
```

**動作**:
- ✅ Cloud Functionsが`schedule`のみ返す
- ✅ App.txaが`updateSchedule`/`saveSchedule`で保存
- ✅ `currentScheduleId`で既存スケジュール判定
- ✅ バージョン履歴が保持される

---

## 📊 データフロー（修正後）

### 初回AI生成
```
App.txa
  ↓ (AI生成リクエスト)
Cloud Functions
  ↓ (AI生成のみ実施)
  ↓ (schedule配列を返す)
App.txa
  ↓ (currentScheduleId === null)
  ↓ (saveSchedule 実行)
Firestore: /facilities/{facilityId}/schedules/{scheduleId_A}
  - version: 1
  - status: 'draft'
```

### 2回目AI生成（同じ月）
```
App.txa
  ↓ (AI生成リクエスト)
Cloud Functions
  ↓ (AI生成のみ実施)
  ↓ (schedule配列を返す)
App.txa
  ↓ (currentScheduleId === scheduleId_A) ✅
  ↓ (updateSchedule 実行) ✅
Firestore: /facilities/{facilityId}/schedules/{scheduleId_A}
  - staffSchedules: 更新
  - version: 2 (維持)
  - status: 'draft'
  - /versions/1: 保持される ✅
```

---

## 🧪 テスト結果

### TypeScript型チェック
```bash
npx tsc --noEmit
cd functions && npx tsc --noEmit
```
**結果**: ✅ 成功（エラーなし）

### 手動テスト（推奨）
1. AIシフト生成（初回） → 新規スケジュール作成
2. 確定 → version 1作成
3. AIシフト生成（2回目） → 既存スケジュール更新
4. バージョン履歴確認 → version 1が保持されているか確認

---

## 📁 修正ファイル一覧

| ファイル | 変更内容 | 行数 |
|---------|---------|------|
| `functions/src/shift-generation.ts` | Firestore保存削除、キャッシュ削除、import削除 | 1-260 |
| `services/geminiService.ts` | ログからscheduleId削除 | 108-111 |
| `App.txa` | 確認のみ（修正不要） | - |

---

## 🔗 関連ドキュメント

### 今回の修正
- [Cloud Functions責務分離（本ドキュメント）](./../specs/cloud-functions-responsibility-separation-2025-11-17.md)

### 前回の修正（2025-11-17 午前）
- [バージョン履歴クリア問題修正](./../specs/version-history-fix-2025-11-17.md)
- [Mermaid図ドキュメント](./../specs/version-history-fix-diagram-2025-11-17.md)

### プロジェクト全体
- [Product](./../steering/product.md)
- [Tech Stack](./../steering/tech.md)

---

## 💡 学んだ教訓

### 技術的な教訓
1. **責務の分離**: 各レイヤーの責務を明確にすることでバグを防げる
2. **保存場所の統一**: Firestoreパスを統一することでデータの一貫性を保つ
3. **型チェックの重要性**: 未使用importを検出できる

### 設計上の教訓
1. **Cloud Functionsの役割**: AI生成などの重い処理に特化させる
2. **フロントエンドの役割**: データ永続化・状態管理を担当
3. **キャッシュの再考**: 必要に応じてフロントエンド側で実装

---

## 🚀 次のステップ

### 即座に実施すべきこと
- [ ] **手動テスト実施** - バージョン履歴が保持されるか確認
- [ ] **Cloud Functionsデプロイ** - 本番環境に反映

### 将来的な改善案
- [ ] **キャッシュ機能の再実装** - フロントエンド側でメモリキャッシュ
- [ ] **パフォーマンス最適化** - AI生成の高速化

---

**修正完了日**: 2025-11-17
**ステータス**: ✅ 実装完了、手動テスト待ち
