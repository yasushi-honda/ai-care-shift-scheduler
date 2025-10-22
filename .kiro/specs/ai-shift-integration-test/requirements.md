# Requirements Document

## Project Description (Input)

AI自動シフト生成機能の統合テストと検証

## プロジェクト概要
介護・福祉事業所向けAIシフト自動作成システムにおいて、Cloud Functions経由でVertex AI (Gemini 2.5 Flash-Lite)を使用したシフト自動生成機能が正しく動作することを、TDD（テスト駆動開発）アプローチで検証・実装する。

## 背景
- フロントエンド（React）とCloud Functionsは既に実装済み
- services/geminiService.ts がCloud Functions APIを呼び出す
- functions/src/shift-generation.ts がVertex AIを使用してシフト生成
- 本番環境（https://ai-care-shift-scheduler.web.app）にデプロイ済み
- 現在は「デモシフト作成」のみ動作確認済み
- **実際のAIシフト生成が動作するか未検証**

## 現在の実装状態

### フロントエンド
- **App.tsx**: handleGenerateClick()でgenerateShiftSchedule()を呼び出し
- **services/geminiService.ts**:
  - Cloud Functions URL: https://us-central1-ai-care-shift-scheduler.cloudfunctions.net/generateShift
  - タイムアウト: 60秒
  - エラーハンドリング実装済み

### バックエンド
- **functions/src/shift-generation.ts**:
  - Vertex AI初期化（us-central1リージョン）
  - モデル: gemini-2.5-flash-lite
  - 冪等性キー実装（キャッシュ機能）
  - 入力バリデーション（MAX_STAFF_COUNT: 200, MAX_REQUEST_SIZE: 200KB）
  - Firestoreに結果を保存

### デプロイ状態
- Cloud Functions: us-central1 にデプロイ済み（firebase functions:listで確認済み）
- Firebase Hosting: 最新版デプロイ済み

## 目的
1. **統合テストの実装**: Cloud Functions APIエンドポイントの統合テストをTDDで作成
2. **AIシフト生成の動作検証**: 実際にVertex AIを使用したシフト生成が正しく動作することを確認
3. **エラーハンドリングの検証**: 様々なエッジケースでの挙動を確認
4. **パフォーマンステスト**: 応答時間、タイムアウト処理の確認

## 期待される成果物
1. **統合テストスイート**:
   - functions/__tests__/integration/shift-generation.test.ts
   - 正常系テスト（シフト生成成功）
   - 異常系テスト（バリデーションエラー、タイムアウト等）
   - 冪等性テスト（同じ入力で同じ結果を返す）

2. **E2Eテストの拡張**:
   - e2e/ai-shift-generation.spec.ts
   - 実際のUIからAIシフト生成を実行するテスト

3. **ドキュメント**:
   - AIシフト生成機能の動作確認手順
   - トラブルシューティングガイド

## 制約条件
- Vertex AI APIの呼び出しにはコストがかかるため、テストは最小限に
- CI/CD環境では実際のAI呼び出しをスキップ（モック使用）
- 本番環境での動作確認は手動で実施

---

## Requirements

### Requirement 1: 統合テストフレームワークの構築
**目的:** 開発者として、Cloud Functions APIエンドポイントの統合テストを自動実行できるようにしたい。これにより、デプロイ前に機能が正しく動作することを保証する

#### Acceptance Criteria
1. WHEN 統合テストスイートが実行される THEN テストランナー SHALL functions/__tests__/integration/shift-generation.test.ts を検出して実行する
2. WHEN テストが実行される THEN テストスイート SHALL 実際のCloud Functions エンドポイント（us-central1）に接続する
3. IF 環境変数SKIP_AI_TESTSが設定されている THEN テストスイート SHALL Vertex AI呼び出しをモックに置き換える
4. WHEN テストが完了する THEN テストスイート SHALL 実行結果をJUnit XML形式でエクスポートする

### Requirement 2: AIシフト生成APIの正常系テスト
**目的:** 開発者として、AIシフト生成APIが正しいリクエストに対して有効なシフトを返すことを検証したい。これにより、基本機能が動作することを保証する

#### Acceptance Criteria
1. WHEN 5名のスタッフリストと有効なシフト要件が送信される THEN AIシフト生成サービス SHALL HTTPステータス200を返す
2. WHEN 正常なリクエストが送信される THEN AIシフト生成サービス SHALL レスポンスに`success: true`を含む
3. WHEN シフト生成が成功する THEN AIシフト生成サービス SHALL `schedule`フィールドに配列を返す
4. WHEN スケジュールが生成される THEN 各スタッフ SHALL 対象月の全日数分のシフトを持つ
5. WHEN シフトが生成される THEN 各シフト SHALL `staffId`, `staffName`, `monthlyShifts`を含む
6. WHEN AIがシフトを生成する THEN AIシフト生成サービス SHALL Firestoreに結果を保存する
7. WHEN Firestoreに保存される THEN レスポンス SHALL `scheduleId`を含む
8. WHEN シフトが生成される THEN AIシフト生成サービス SHALL 60秒以内に応答する

### Requirement 3: 入力バリデーションテスト
**目的:** 開発者として、不正な入力に対してAPIが適切なエラーメッセージを返すことを検証したい。これにより、セキュリティとデータ整合性を保証する

#### Acceptance Criteria
1. WHEN staffListが空配列で送信される THEN AIシフト生成サービス SHALL HTTPステータス400を返す
2. WHEN staffListが未定義で送信される THEN AIシフト生成サービス SHALL エラーメッセージ "staffList is required" を返す
3. IF スタッフ数が200を超える THEN AIシフト生成サービス SHALL HTTPステータス400を返し、超過数を含むエラーメッセージを返す
4. WHEN requirementsが未定義で送信される THEN AIシフト生成サービス SHALL エラーメッセージ "requirements with targetMonth is required" を返す
5. WHEN targetMonthが未定義で送信される THEN AIシフト生成サービス SHALL エラーメッセージ "requirements with targetMonth is required" を返す
6. IF リクエストボディサイズが200KBを超える THEN AIシフト生成サービス SHALL HTTPステータス413を返し、サイズ制限を含むエラーメッセージを返す
7. WHEN バリデーションエラーが発生する THEN AIシフト生成サービス SHALL `success: false`を含むレスポンスを返す
8. WHEN バリデーションエラーが発生する THEN AIシフト生成サービス SHALL スタックトレースを含まない

### Requirement 4: 冪等性の検証
**目的:** 開発者として、同じ入力に対して同じ結果が返されることを検証したい。これにより、重複リクエストによるコスト増加を防ぐ

#### Acceptance Criteria
1. WHEN 同一の入力で2回リクエストが送信される THEN AIシフト生成サービス SHALL 2回目はキャッシュから結果を返す
2. WHEN キャッシュヒットが発生する THEN レスポンス SHALL `metadata.cached: true`を含む
3. WHEN キャッシュヒットが発生する THEN レスポンス SHALL `metadata.cacheHit: true`を含む
4. WHEN 同じstaffListとrequirements だが異なるleaveRequests が送信される THEN AIシフト生成サービス SHALL 新しいシフトを生成する
5. WHEN 同じstaffListとleaveRequests だが異なるrequirements が送信される THEN AIシフト生成サービス SHALL 新しいシフトを生成する
6. WHEN キャッシュから結果が返される THEN AIシフト生成サービス SHALL Vertex AIを呼び出さない
7. WHEN キャッシュから結果が返される THEN 応答時間 SHALL 5秒以内である

### Requirement 5: エラーハンドリングとタイムアウトテスト
**目的:** 開発者として、様々なエラーケースが適切に処理されることを検証したい。これにより、システムの堅牢性を保証する

#### Acceptance Criteria
1. WHEN Vertex AIがエラーを返す THEN AIシフト生成サービス SHALL HTTPステータス500を返す
2. WHEN Vertex AIがエラーを返す THEN レスポンス SHALL `success: false`を含む
3. WHEN Vertex AIがタイムアウトする THEN フロントエンド SHALL 60秒後にAbortErrorを発生させる
4. WHEN AbortErrorが発生する THEN フロントエンド SHALL ユーザーにタイムアウトメッセージを表示する
5. WHEN ネットワークエラーが発生する THEN フロントエンド SHALL ユーザーに接続エラーメッセージを表示する
6. WHEN HTTPエラーが発生する THEN フロントエンド SHALL レスポンスからエラーメッセージを抽出して表示する
7. WHEN エラーが発生する THEN AIシフト生成サービス SHALL エラーログをCloud Loggingに記録する

### Requirement 6: E2Eテストの実装
**目的:** QAエンジニアとして、実際のUIからAIシフト生成を実行するエンドツーエンドテストを自動実行したい。これにより、ユーザー体験全体が正しく機能することを保証する

#### Acceptance Criteria
1. WHEN E2Eテストが実行される THEN Playwright SHALL e2e/ai-shift-generation.spec.ts を実行する
2. WHEN E2Eテストが開始される THEN ブラウザ SHALL 本番環境（https://ai-care-shift-scheduler.web.app）を開く
3. WHEN 「シフト作成実行」ボタンがクリックされる THEN UI SHALL ローディング表示を表示する
4. WHEN AIシフト生成が進行中 THEN UI SHALL 「AIがシフトを作成中...」メッセージを表示する
5. WHEN AIシフト生成が完了する THEN UI SHALL シフトカレンダーにシフトを表示する
6. WHEN シフトが表示される THEN カレンダー SHALL 全スタッフの全日数分のシフトセルを含む
7. WHEN エラーが発生する THEN UI SHALL エラーメッセージを赤色で表示する
8. WHEN E2Eテストが本番環境で実行される THEN テストスイート SHALL 実際のVertex AI呼び出しを実行する
9. IF CI/CD環境で実行される THEN E2Eテスト SHALL スキップされる（コスト削減のため）

### Requirement 7: パフォーマンステスト
**目的:** 開発者として、AIシフト生成APIが許容範囲内の応答時間で動作することを検証したい。これにより、ユーザー体験の品質を保証する

#### Acceptance Criteria
1. WHEN 5名のスタッフでシフト生成が実行される THEN AIシフト生成サービス SHALL 15秒以内に応答する
2. WHEN 20名のスタッフでシフト生成が実行される THEN AIシフト生成サービス SHALL 30秒以内に応答する
3. WHEN 50名のスタッフでシフト生成が実行される THEN AIシフト生成サービス SHALL 60秒以内に応答する
4. WHEN キャッシュヒットが発生する THEN 応答時間 SHALL 5秒以内である
5. WHEN Vertex AIが応答する THEN トークン使用量 SHALL `metadata.tokensUsed`に記録される
6. WHEN Cloud Functionsがコールドスタートする THEN 初回応答時間 SHALL 5秒以内の追加遅延を許容する

### Requirement 8: ドキュメントとトラブルシューティング
**目的:** 開発者として、AIシフト生成機能の動作確認手順とトラブルシューティングガイドを参照したい。これにより、問題発生時に迅速に対応できる

#### Acceptance Criteria
1. WHEN ドキュメントが作成される THEN README SHALL AIシフト生成機能の動作確認手順を含む
2. WHEN ドキュメントが作成される THEN トラブルシューティングガイド SHALL 一般的なエラーとその解決方法を含む
3. WHEN ドキュメントが作成される THEN 統合テスト実行手順 SHALL 環境変数の設定方法を含む
4. WHEN ドキュメントが作成される THEN E2Eテスト実行手順 SHALL ローカル実行とCI/CD実行の違いを説明する
5. WHERE 本番環境で手動テストを実施する場合 ドキュメント SHALL テストデータの準備方法を説明する

### Requirement 9: テストデータとモック
**目的:** 開発者として、統合テストで使用する標準的なテストデータとモックを定義したい。これにより、一貫性のあるテストを実行できる

#### Acceptance Criteria
1. WHEN テストデータが定義される THEN テストスイート SHALL 5名の標準スタッフリストを含む
2. WHEN テストデータが定義される THEN テストスイート SHALL 4つの時間帯の標準要件を含む
3. WHEN テストデータが定義される THEN テストスイート SHALL サンプル休暇申請データを含む
4. IF SKIP_AI_TESTSが設定されている THEN モック SHALL Vertex AIのレスポンス形式と一致するダミーデータを返す
5. WHEN モックが使用される THEN モック SHALL 実際のAPIと同じエラーパターンをシミュレートできる
6. WHEN テストデータが変更される THEN 変更 SHALL functions/__tests__/fixtures/test-data.ts に集約される
