# 開発状況レポート

**更新日**: 2025年10月31日
**プロジェクト**: AIシフト自動作成システム (ai-care-shift-scheduler)
**本番環境**: https://ai-care-shift-scheduler.web.app

---

## 📊 プロジェクト概要

### プロジェクト名
**ai-care-shift-scheduler** - 介護・福祉事業所向けAIシフト自動作成ツール

### 目的
介護施設におけるスタッフのシフト管理を自動化し、管理者の業務負荷を軽減するWebアプリケーション。スタッフの勤務条件、資格、休暇希望などを考慮し、Google Gemini AIを活用して最適なシフト表を自動生成します。

### アーキテクチャ
- **設計方式**: マルチテナントSaaS（事業所単位のデータ分離）
- **認証方式**: Google OAuth 2.0
- **アクセス制御**: ロールベースアクセス制御（RBAC）
  - `super-admin`: システム管理者（全施設管理、全権限付与）
  - `admin`: 施設管理者（施設管理、スタッフ管理、メンバー招待）
  - `editor`: 編集者（シフト作成・編集、スタッフ閲覧）
  - `viewer`: 閲覧者（読み取りのみ）

---

## 🛠️ 技術スタック

### フロントエンド
- **React** 19.2.0
- **TypeScript** ~5.8.2
- **Vite** 6.2.0（ビルドツール）
- **React Router** （ルーティング）

### バックエンド・インフラ
- **Firebase Authentication** - Google OAuthプロバイダー
- **Cloud Firestore** (asia-northeast1) - NoSQLデータベース
- **Cloud Functions** (us-central1, Node.js 20) - サーバーレス関数
- **Firebase Hosting** - 静的サイトホスティング
- **Firebase Storage** - ファイルストレージ（予定）

### AI・外部サービス
- **Vertex AI (Gemini 2.5 Flash-Lite)** - シフト自動生成AI
  - Region: asia-northeast1（強制指定、リージョンミス対策）
  - Cloud Functions経由で呼び出し

### 開発ツール・CI/CD
- **GitHub Actions** - CI/CDパイプライン
  - TypeScript型チェック
  - プロダクションビルド
  - Firebase自動デプロイ（main/developブランチ）
- **CodeRabbit CLI** - ローカルコードレビュー（push前必須）
- **ESLint + TypeScript** - 静的解析
- **Kiro Spec-Driven Development** - 仕様駆動開発フレームワーク

---

## ✅ 現在の開発状況（2025年10月31日時点）

### 実装フェーズ
**Phase 0-12.5 完了**（全13フェーズ中）

### デプロイ状況
- **本番環境**: ✅ デプロイ済み（2025年10月28日）
- **最終デプロイ**: 2025年10月31日（バグ修正）
- **動作検証**: ✅ Phase 0検証完了（2025年10月31日）

### 実装完了した機能

#### Phase 0: デモ環境整備 ✅
- ✅ デモ施設（demo-facility-001）
- ✅ デモスタッフ10名（管理者、看護師、介護士、夜勤専従）
- ✅ AIシフト自動生成の動作確認（scheduleId: 94rhdEOkip34ljBlhXC7）
- ✅ 本番環境での全機能動作検証

#### Phase 1: 認証基盤の構築 ✅
- ✅ Firebase Authentication統合
- ✅ Google OAuthプロバイダー設定
- ✅ 認証状態管理（AuthContext）
- ✅ ログイン画面とOAuth認証フロー
- ✅ 保護されたルートと認証チェック機能

#### Phase 2: ユーザー登録とアクセス権限管理 ✅
- ✅ 初回ログイン時のユーザードキュメント自動作成
- ✅ システム初回ユーザーへのsuper-admin権限自動付与（Cloud Function）
- ✅ アクセス権限なしユーザーの処理と案内画面

#### Phase 3: 事業所管理とロールベースアクセス制御 ✅
- ✅ 事業所データモデルとFirestore統合
- ✅ ユーザーのロール判定と権限チェック機能
- ✅ 施設選択UIと複数施設対応
- ✅ データのマルチテナント分離

#### Phase 4: スタッフ情報の永続化 ✅
- ✅ スタッフデータモデルとFirestoreスキーマ
- ✅ スタッフCRUD操作のFirestore連携
- ✅ 既存スタッフデータのFirestore移行
- ✅ スタッフ一覧とフィルタリング機能

#### Phase 5: シフトデータの永続化 ✅
- ✅ シフトデータモデルとFirestoreスキーマ
- ✅ シフトCRUD操作のFirestore連携
- ✅ 月別シフトデータの管理
- ✅ シフト表示とフィルタリング機能

#### Phase 6: バージョン管理機能 ✅
- ✅ 下書き（draft）と確定（confirmed）ステータス管理
- ✅ バージョン履歴の保存と管理
- ✅ 過去バージョンへの復元機能
- ✅ バージョン履歴の不変性保証

#### Phase 7: 休暇申請と要件設定の永続化 ✅
- ✅ 休暇申請のFirestore統合（Phase 7.1）
- ✅ シフト要件設定の永続化（Phase 7.2）
  - **2025年10月31日**: editor権限でのrequirements保存エラー修正
  - 1秒debounce自動保存機能
  - LocalStorageとFirestoreのハイブリッド永続化

#### Phase 8: Firestore Security Rules ✅
- ✅ ユーザーコレクションのSecurity Rules
- ✅ 施設コレクションとサブコレクションのSecurity Rules
- ✅ RBAC権限チェック関数（hasRole, isSuperAdmin）
- ✅ マルチテナントデータ分離の強制

#### Phase 9: データ復元とリロード対応 ✅
- ✅ ページリロード後の認証状態復元
- ✅ 施設とデータの自動復元（LocalStorage + Firestore）
- ✅ ローディング状態とエラーハンドリング

#### Phase 10: 管理画面（super-admin専用） ✅
- ✅ 全施設一覧と施設詳細表示
- ✅ 全ユーザー一覧とユーザー詳細表示
- ✅ 施設作成・編集・削除機能
- ✅ ユーザー権限管理機能

#### Phase 11: ユーザー招待機能（admin権限） ✅
- ✅ 招待メール送信機能（Cloud Function）
- ✅ 招待リンクとトークン生成
- ✅ 招待承認フローと権限付与
- ✅ 招待ステータス管理

#### Phase 12: エラーハンドリングとユーザーフィードバック ✅
- ✅ 包括的エラーハンドリング機構
- ✅ ユーザーフレンドリーなエラーメッセージ
- ✅ ローディング状態の適切な表示
- ✅ ネットワークエラーとタイムアウト処理

#### Phase 12.5: コード重複削除リファクタリング ✅
- ✅ 共通ロジックの抽出と統合
- ✅ コードの可読性向上
- ✅ デグレーションなしの確認

### AIシフト自動生成機能（ai-shift-integration-test）✅
- ✅ Cloud Functions経由でのVertex AI呼び出し
- ✅ Gemini 2.5 Flash-Lite統合
- ✅ 制約条件の自動考慮（必要人員、資格要件、連続勤務制限）
- ✅ Firestoreへのシフト保存
- ✅ 統合テスト37件（成功率100%）
- ✅ E2Eテスト5件（2件成功、3件スキップ）

---

## 🐛 最近の修正

### バグ修正（2025年10月31日）
**問題**: editor権限でrequirements保存時に`PERMISSION_DENIED`エラー

**原因**: Firestore Security Rulesがrequirementsサブコレクションへのwriteをadmin以上に制限

**修正**: `firestore.rules` Line 140を修正
```javascript
// 修正前
allow write: if isAuthenticated() && hasRole(facilityId, 'admin');

// 修正後
allow write: if isAuthenticated() && hasRole(facilityId, 'editor');
```

**影響**: editor権限でシフト要件の保存が正常に動作するようになった

**コミット**: `50b05ea`
**詳細**: [bugfix-2025-10-31.md](.kiro/specs/auth-data-persistence/bugfix-2025-10-31.md)

---

## 📋 今後の計画

### Phase 13: 監査ログとコンプライアンス（本番リリース前必須）

**優先度**: 🔴 高（本番運用前の必須要件）
**推定工数**: 3-5日

#### 実装内容
- [ ] **13.1 監査ログ記録機能**
  - すべてのCRUD操作の監査ログ記録
  - ログエントリ構造（timestamp, userId, action, resourceType, details）
  - デバイス情報（IPアドレス、ユーザーエージェント）の記録
  - auditLogsコレクションへの不変ログ保存

- [ ] **13.2 監査ログビューアUI**
  - 監査ログの一覧表示とフィルタリング機能
  - 日時範囲、ユーザーID、操作種別、対象リソースでの検索
  - ログの詳細表示
  - CSV/JSON形式でのエクスポート機能

- [ ] **13.3 セキュリティアラートと異常検知**
  - 不審なアクセスパターンの検出ロジック
  - 大量データエクスポート、通常外時間帯アクセスの検出
  - 複数回認証失敗、権限なしアクセス試行の検出
  - アラート生成と管理者への通知
  - ストレージ容量閾値の監視とアーカイブ促進

#### 成果物
- Cloud Function: `auditLogger`（書き込み専用）
- Firestore Collection: `auditLogs`（不変ログ）
- UI: 監査ログビューア画面（super-admin専用）
- Security Rules: auditLogsコレクション保護

#### ビジネス価値
- ✅ コンプライアンス要件の充足（介護事業所の監査対応）
- ✅ セキュリティインシデントの早期検出
- ✅ データアクセスの完全なトレーサビリティ

---

### Phase 14: 統合テストとE2Eテスト（品質保証の必須要件）

**優先度**: 🔴 高（品質保証の必須要件）
**推定工数**: 5-7日

#### 実装内容
- [ ] **14.1 認証フローの統合テスト**
  - Google OAuthログインフローのテスト
  - 初回ユーザー登録とsuper-admin付与のテスト
  - 2人目以降のユーザー登録とアクセス権限なし画面のテスト
  - ログアウトと再ログインのテスト

- [ ] **14.2 データCRUD操作の統合テスト**
  - スタッフ情報のCRUD操作テスト
  - シフトデータのCRUD操作テスト
  - 休暇申請のCRUD操作テスト
  - 要件設定の保存・読込テスト

- [ ] **14.3 RBAC権限チェックの統合テスト**
  - super-adminの全権限テスト
  - admin権限の施設管理とメンバー招待テスト
  - editor権限のシフト作成・編集テスト
  - viewer権限の閲覧のみテスト
  - 権限なし操作の拒否テスト

- [ ] **14.4 バージョン管理機能のE2Eテスト**
  - 下書き保存と確定のE2Eテスト
  - バージョン履歴の作成と表示のテスト
  - 過去バージョンへの復元のテスト
  - バージョン履歴の不変性テスト

- [ ] **14.5 データ復元とリロード対応のE2Eテスト**
  - ページリロード後の認証状態復元テスト
  - 施設とデータの自動復元テスト
  - ローディング状態とエラーハンドリングのテスト

#### テストフレームワーク
- **Playwright** - E2Eテストフレームワーク
- **Vitest** - 統合テストフレームワーク
- **Firebase Emulator Suite** - ローカルテスト環境

#### 成果物
- E2Eテストスイート（Playwright）
- 統合テストスイート（Vitest）
- CI/CDパイプラインへのテスト統合
- テストカバレッジレポート

#### ビジネス価値
- ✅ 本番環境でのデグレーション防止
- ✅ リリースサイクルの高速化（自動テスト）
- ✅ コードの保守性向上

---

## 🚀 リリース計画

### ベータリリース（Phase 13完了後）
**目標日**: Phase 13完了後
**対象**: テストユーザー（限定公開）

**リリース内容**:
- Phase 0-12.5の全機能
- 監査ログ機能（Phase 13）
- デモ環境での動作確認済み

**チェックリスト**:
- ✅ Phase 0-12.5の全機能が本番環境で動作
- ✅ 監査ログ機能の実装完了
- ⚠️ E2Eテストの実装（Phase 14）
- ⚠️ パフォーマンステスト
- ⚠️ セキュリティ監査

---

### 正式リリース（Phase 14完了後）
**目標日**: Phase 14完了後
**対象**: 一般公開

**リリース内容**:
- Phase 0-14の全機能
- 包括的なE2Eテスト
- 本番運用体制の確立

**チェックリスト**:
- ⚠️ Phase 13（監査ログ）の実装完了
- ⚠️ Phase 14（E2Eテスト）の実装完了
- ⚠️ 全E2Eテストのパス（成功率100%）
- ⚠️ パフォーマンスベンチマーク達成
- ⚠️ セキュリティ監査の完了
- ⚠️ ドキュメント整備（ユーザーマニュアル、運用マニュアル）

---

## 🎯 中長期ロードマップ（Phase 15以降）

### Phase 15: メール通知機能
**優先度**: 🟡 中
- 招待メール送信（現在はトークン生成のみ）
- シフト確定通知
- 重要なイベント通知

### Phase 16: データ分析とレポート機能
**優先度**: 🟡 中
- スタッフ稼働率分析
- 夜勤回数の可視化
- 資格保有者の偏り分析
- CSV/PDFレポート生成

### Phase 17: モバイルアプリ対応
**優先度**: 🟢 低
- React Nativeによるモバイルアプリ開発
- プッシュ通知機能
- オフライン対応

### Phase 18: AIシフト生成の高度化
**優先度**: 🟡 中
- 学習データの蓄積と改善
- スタッフの希望時間帯の考慮
- 複数施設の一括シフト生成
- シフトパターンの学習

---

## 📊 開発メトリクス

### コード品質
- **TypeScript型安全性**: 100%（strict mode有効）
- **ESLint警告**: 0件
- **統合テスト成功率**: 100%（37/37件）
- **E2Eテスト成功率**: 100%（2/2件、3件はCI最適化でスキップ）

### デプロイ頻度
- **2025年10月**: 12回（Phase 0-12.5実装）
- **最新デプロイ**: 2025年10月31日（バグ修正）
- **GitHub Actions実行時間**: 平均2分40秒

### コードベース規模
- **フロントエンド**: React + TypeScript
- **バックエンド**: Cloud Functions (Node.js 20)
- **Firestore Collections**: 6個（users, facilities, staff, schedules, leaveRequests, requirements）
- **Security Rules**: 168行

---

## 💼 開発体制とワークフロー

### Git Workflow
**GitHub Flow** を採用

1. **mainブランチ**: 常に安定・デプロイ可能な状態
2. **featureブランチ**: 各機能開発
3. **Pull Request**: コードレビュー後にマージ
4. **自動デプロイ**: mainマージ後に自動デプロイ

### CI/CDパイプライン
1. コード変更
2. `git commit`
3. **CodeRabbit CLIローカルレビュー**（必須）
4. `git push`
5. **GitHub Actions CI/CD**
   - TypeScript型チェック
   - プロダクションビルド
   - Firebase自動デプロイ

### コードレビュー
- **CodeRabbit CLI**: ローカルレビュー（push前必須）
- **GitHub PR**: チーム内レビュー
- **CLAUDE.md**: プロジェクト固有のレビュー基準

---

## 📁 ドキュメント体系

### 仕様書（Kiro Spec-Driven Development）
- `.kiro/specs/auth-data-persistence/` - 認証・データ永続化機能
  - `requirements.md` - 要件定義
  - `design.md` - 技術設計
  - `tasks.md` - 実装タスク
  - `spec.json` - メタデータ
  - `phase0-verification-2025-10-31.md` - Phase 0検証記録
  - `bugfix-2025-10-31.md` - バグ修正記録

- `.kiro/specs/ai-shift-integration-test/` - AIシフト統合テスト
  - `requirements.md`, `design.md`, `tasks.md`, `spec.json`

### ステアリングドキュメント
- `.kiro/steering/product.md` - プロダクト方針
- `.kiro/steering/tech.md` - 技術方針
- `.kiro/steering/structure.md` - コード構造
- `.kiro/steering/development-workflow.md` - 開発ワークフロー
- `.kiro/steering/deployment-troubleshooting.md` - デプロイトラブルシューティング

### メモリファイル（Serena）
- `project_overview` - プロジェクト概要
- `tech_stack` - 技術スタック
- `gcp_architecture_final` - GCPアーキテクチャ
- `firestore_indexes_cache` - Firestoreインデックス
- `code_style_and_conventions` - コードスタイル

---

## 🎓 学び・振り返り

### 成功したアプローチ
1. **Kiro Spec-Driven Development**: 要件→設計→タスクの3段階承認で品質向上
2. **GitHub Flow**: シンプルなワークフローで高速デプロイ実現
3. **CodeRabbit CLI**: push前レビューで品質担保
4. **Firebase Emulator**: ローカル開発環境で開発速度向上
5. **Phase 0検証**: 本番環境での早期検証でバグ早期発見

### 課題と改善策
1. **Security Rules設計の一貫性**: 全サブコレクションの権限マトリックス作成が必要
2. **ロール別動作テスト**: 各Phase完了時に全ロールでの動作確認を実施
3. **E2Eテスト不足**: Phase 14で包括的なE2Eテスト追加予定

### 次の開発での改善点
- Security Rulesレビュー時に権限マトリックスを作成
- 各Phase完了時に全ロール（super-admin, admin, editor, viewer）での動作確認
- Phase 14（E2Eテスト）で権限マトリックスの包括的テスト追加

---

## 📞 リソース

### リポジトリ
- **GitHub**: https://github.com/yasushi-honda/ai-care-shift-scheduler

### 本番環境
- **URL**: https://ai-care-shift-scheduler.web.app
- **Firebase Console**: https://console.firebase.google.com/project/ai-care-shift-scheduler
- **GCP Console**: https://console.cloud.google.com/home/dashboard?project=ai-care-shift-scheduler

### ドキュメント
- **Firebase Documentation**: https://firebase.google.com/docs
- **Vertex AI Documentation**: https://cloud.google.com/vertex-ai/docs
- **React Documentation**: https://react.dev

---

**ステータス**: Phase 0-12.5完了、Phase 13-14実装待ち
**次のステップ**: Phase 13（監査ログとコンプライアンス）の実装開始を推奨
**最終更新**: 2025年10月31日
