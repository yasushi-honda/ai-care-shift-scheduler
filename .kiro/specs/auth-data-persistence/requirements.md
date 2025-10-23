# Requirements Document

## Project Description (Input)

### 機能名
認証・データ永続化機能（Authentication and Data Persistence）

### 背景
現在のMVPでは、ブラウザのローカルストレージにデータを保存していないため、リロードするとすべての設定が消えてしまう問題があります。また、認証機能がないため、複数の事業所や管理者がデータを安全に管理することができません。

### 目的
事業所単位のマルチテナント設計を採用し、以下を実現します：
1. Firebase Authenticationによるユーザー認証
2. Firestoreへのデータ永続化（スタッフ情報、シフトデータ）
3. 事業所（Facility）ベースのデータ分離とアクセス制御
4. 複数管理者によるチーム協働機能
5. リロード時のデータ復元

### ビジネス価値
- **データ保護**: ユーザーの設定やシフトデータがリロード後も保持される
- **セキュリティ**: 事業所ごとにデータが完全に分離され、認証されたユーザーのみがアクセス可能
- **チーム協働**: 同じ事業所の複数管理者が協力してシフト作成できる
- **スケーラビリティ**: マルチテナントSaaSの標準パターンで、将来の収益化に対応

### 技術的制約
- Firebase Authentication（メール/パスワード認証から開始）
- Firestore Native Mode（既存）
- Firestore Security Rules（RBACベース）
- 既存のフロントエンド（React 19 + TypeScript）への統合

### データモデル案

#### facilities（事業所）
```typescript
{
  facilityId: string;
  metadata: {
    name: string;
    plan: 'basic' | 'premium';
    createdAt: Timestamp;
    adminUsers: string[];  // 管理者ユーザーID配列
  };
  staff: {
    // スタッフサブコレクション
    [staffId]: Staff;
  };
  schedules: {
    // シフトサブコレクション
    [scheduleId]: Schedule;
  };
}
```

#### users（ユーザー）
```typescript
{
  userId: string;
  email: string;
  name: string;
  belongsTo: string[];  // 所属事業所ID配列
  role: 'admin' | 'viewer';
  createdAt: Timestamp;
}
```

### 段階的実装アプローチ

**Phase 2-1: 基本認証**
- Firebase Authentication導入
- メール/パスワード認証
- ユーザー登録・ログイン画面
- 事業所作成機能（1ユーザー = 1事業所）

**Phase 2-2: データ永続化**
- Firestoreへのスタッフ・シフトデータ保存
- CRUD操作の実装
- リロード時のデータ復元
- Firestore Security Rules基本実装

**Phase 2-3: マルチテナント対応**
- 複数管理者の招待機能
- 事業所切り替えUI
- ロールベースアクセス制御（RBAC）強化
- チーム協働機能

### 成功基準
- ✅ ユーザー登録・ログインが正常に動作
- ✅ スタッフ・シフトデータがFirestoreに保存される
- ✅ リロード後もデータが復元される
- ✅ 事業所ごとにデータが完全に分離される
- ✅ 認証されていないユーザーはデータにアクセスできない
- ✅ 複数管理者が同じ事業所のデータを編集できる

### リスクと対策
- **リスク**: 既存のMVPユーザーのデータ移行
  - **対策**: 最初の段階では移行機能なし、新規ユーザーのみ対応
- **リスク**: Firestore Security Rulesの複雑化
  - **対策**: 段階的に実装、各段階でテストを徹底
- **リスク**: 認証UIの複雑化
  - **対策**: Firebase UI Authライブラリの活用を検討

---

## Requirements
<!-- Will be generated in /kiro:spec-requirements phase -->
