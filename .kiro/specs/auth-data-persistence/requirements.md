# Requirements Document

## Introduction

本ドキュメントは、AIシフト自動作成システムにおける認証・データ永続化機能の要件を定義します。

### 背景
現在のMVP（Minimum Viable Product）では、ブラウザのローカルストレージにデータを保存していないため、ページをリロードするとすべての設定やシフトデータが消失してしまう問題があります。また、認証機能が実装されていないため、複数の事業所や管理者が安全にデータを管理することができません。

### 目的
事業所（Facility）単位のマルチテナント設計を採用し、以下を実現します：
1. Firebase Authenticationによるユーザー認証
2. Firestoreへのデータ永続化（スタッフ情報、シフトデータ、休暇申請、要件設定）
3. 事業所ベースのデータ分離とアクセス制御
4. 複数管理者によるチーム協働機能
5. リロード時のデータ復元

### ビジネス価値
- **データ保護**: ユーザーの設定やシフトデータがリロード後も保持される
- **セキュリティ**: 事業所ごとにデータが完全に分離され、認証されたユーザーのみがアクセス可能
- **チーム協働**: 同じ事業所の複数管理者が協力してシフト作成できる
- **スケーラビリティ**: マルチテナントSaaSの標準パターンで、将来の収益化に対応

---

## Requirements

### Requirement 1: ユーザー認証
**Objective:** As a 事業所管理者, I want メール/パスワードでログインできる機能, so that 自分の事業所のデータに安全にアクセスできる

#### Acceptance Criteria

1. WHEN ユーザーが未ログイン状態でアプリにアクセスする THEN システム SHALL ログイン画面を表示する
2. WHEN ユーザーがメールアドレスとパスワードを入力してログインボタンをクリックする THEN システム SHALL Firebase Authenticationで認証を実行する
3. IF 認証に成功した THEN システム SHALL ユーザーをメイン画面にリダイレクトする
4. IF 認証に失敗した THEN システム SHALL エラーメッセージを表示する
5. WHEN ユーザーが「新規登録」リンクをクリックする THEN システム SHALL ユーザー登録画面を表示する
6. WHEN ユーザーが新規登録フォームに必要情報（メール、パスワード、氏名、事業所名）を入力して送信する THEN システム SHALL Firebase Authenticationでユーザーアカウントを作成する
7. WHEN 新規ユーザーアカウントが作成される THEN システム SHALL Firestoreに新規ユーザードキュメントを作成する
8. WHEN 新規ユーザーアカウントが作成される THEN システム SHALL そのユーザーを管理者とする新規事業所ドキュメントをFirestoreに作成する
9. WHEN ログイン済みユーザーが「ログアウト」ボタンをクリックする THEN システム SHALL Firebase Authenticationからサインアウトしてログイン画面にリダイレクトする
10. WHEN ユーザーが「パスワードを忘れた」リンクをクリックする THEN システム SHALL パスワードリセット画面を表示する
11. WHEN ユーザーがパスワードリセット画面でメールアドレスを入力して送信する THEN システム SHALL Firebase Authenticationのパスワードリセットメールを送信する

### Requirement 2: 事業所管理（マルチテナント）
**Objective:** As a 事業所管理者, I want 自分の事業所のデータのみを閲覧・編集できる機能, so that 他の事業所のデータと混在せず安全に管理できる

#### Acceptance Criteria

1. WHEN ユーザーが新規登録する THEN システム SHALL 自動的に新規事業所を作成し、そのユーザーを管理者として設定する
2. WHEN ユーザーがログインする THEN システム SHALL そのユーザーが所属する事業所のデータのみを取得する
3. IF ユーザーが複数の事業所に所属している THEN システム SHALL 事業所選択UIを表示する
4. WHEN ユーザーが事業所を選択する THEN システム SHALL 選択された事業所のデータをロードする
5. WHILE ユーザーがアプリを使用している THE システム SHALL 現在選択中の事業所のコンテキストを維持する
6. WHEN ユーザーがデータ（スタッフ、シフト、休暇申請）を作成・更新・削除する THEN システム SHALL 現在選択中の事業所のコレクション内でのみ操作を実行する
7. WHERE ユーザーが他の事業所のデータにアクセスしようとした THE システム SHALL アクセスを拒否しエラーを返す

### Requirement 3: スタッフ情報の永続化
**Objective:** As a 事業所管理者, I want スタッフ情報をFirestoreに保存できる機能, so that リロード後もスタッフデータが保持される

#### Acceptance Criteria

1. WHEN ユーザーが新規スタッフを追加する THEN システム SHALL Firestoreの `/facilities/{facilityId}/staff/{staffId}` にドキュメントを作成する
2. WHEN スタッフドキュメントが作成される THEN システム SHALL 以下のフィールドを保存する: id, name, role, qualifications, weeklyWorkCount, maxConsecutiveWorkDays, availableWeekdays, unavailableDates, timeSlotPreference, isNightShiftOnly, createdAt, updatedAt
3. WHEN ユーザーがスタッフ情報を編集する THEN システム SHALL 対応するFirestoreドキュメントを更新する
4. WHEN ユーザーがスタッフを削除する THEN システム SHALL 対応するFirestoreドキュメントを削除する
5. WHEN ユーザーがアプリをロードする THEN システム SHALL Firestoreから現在の事業所のすべてのスタッフ情報を取得する
6. WHEN Firestoreからスタッフデータを取得する THEN システム SHALL データをアプリケーションの状態（state）に反映する
7. IF Firestoreからのデータ取得に失敗した THEN システム SHALL エラーメッセージを表示し、空のスタッフリストで初期化する

### Requirement 4: シフトデータの永続化
**Objective:** As a 事業所管理者, I want 生成したシフトをFirestoreに保存できる機能, so that 過去のシフトを参照・管理できる

#### Acceptance Criteria

1. WHEN AIまたはデモでシフトが生成される THEN システム SHALL Firestoreの `/facilities/{facilityId}/schedules/{scheduleId}` にドキュメントを作成する
2. WHEN シフトドキュメントが作成される THEN システム SHALL 以下のフィールドを保存する: id, targetMonth, staffSchedules (各スタッフのシフト配列), generatedAt, generatedBy, version, status
3. WHEN ユーザーがシフトを手動で編集する THEN システム SHALL 既存ドキュメントを更新する
4. WHEN ユーザーが過去のシフトを閲覧する THEN システム SHALL 対象月のシフトドキュメントをFirestoreから取得する
5. WHEN ユーザーが対象月を変更する THEN システム SHALL 新しい対象月のシフトデータをFirestoreから取得し、存在しない場合は空のシフトを表示する
6. IF 同じ対象月のシフトが既に存在する THEN システム SHALL バージョン番号をインクリメントして保存する
7. WHEN シフトデータを保存する THEN システム SHALL createdAt（初回のみ）と updatedAt（常に）のタイムスタンプを記録する

### Requirement 5: 休暇申請の永続化
**Objective:** As a 事業所管理者, I want スタッフの休暇申請をFirestoreに保存できる機能, so that シフト生成時に休暇情報を考慮できる

#### Acceptance Criteria

1. WHEN ユーザーがカレンダー上でスタッフの休暇を登録する THEN システム SHALL Firestoreの `/facilities/{facilityId}/leaveRequests/{requestId}` にドキュメントを作成する
2. WHEN 休暇申請ドキュメントが作成される THEN システム SHALL 以下のフィールドを保存する: id, staffId, staffName, date, leaveType, createdAt, updatedAt
3. WHEN ユーザーが休暇申請を削除する THEN システム SHALL 対応するFirestoreドキュメントを削除する
4. WHEN ユーザーがアプリをロードする THEN システム SHALL Firestoreから現在の事業所の全休暇申請を取得する
5. WHEN シフト生成時 THEN システム SHALL Firestoreから取得した休暇申請データを制約条件として使用する
6. WHERE ユーザーがカレンダー上で対象月を変更した THE システム SHALL その月の休暇申請データを取得して表示する

### Requirement 6: シフト要件設定の永続化
**Objective:** As a 事業所管理者, I want シフト要件設定をFirestoreに保存できる機能, so that 毎回同じ設定を入力する手間を省ける

#### Acceptance Criteria

1. WHEN ユーザーがシフト要件（時間帯別必要人員、資格要件）を設定する THEN システム SHALL Firestoreの `/facilities/{facilityId}/requirements/default` にドキュメントを保存する
2. WHEN 要件ドキュメントが保存される THEN システム SHALL 各時間帯（早番、日勤、遅番、夜勤）の total と qualifications を含める
3. WHEN ユーザーがアプリをロードする THEN システム SHALL Firestoreから要件設定を取得してUIに反映する
4. IF Firestoreに要件設定が存在しない THEN システム SHALL デフォルト設定を使用する
5. WHEN ユーザーが要件設定を変更する THEN システム SHALL 変更を即座にFirestoreに保存する

### Requirement 7: データ復元とリロード対応
**Objective:** As a 事業所管理者, I want ブラウザをリロードしてもデータが保持される機能, so that 作業を中断しても安心して再開できる

#### Acceptance Criteria

1. WHEN ユーザーがブラウザをリロードする THEN システム SHALL Firebase AuthenticationのセッションからユーザーIDを復元する
2. IF 有効なセッションが存在する THEN システム SHALL Firestoreから以下のデータを自動的に取得する: スタッフ情報、シフトデータ、休暇申請、要件設定
3. IF 有効なセッションが存在しない THEN システム SHALL ログイン画面にリダイレクトする
4. WHEN データ取得が完了する THEN システム SHALL アプリケーション状態を復元し、ユーザーが作業を継続できる状態にする
5. WHILE データ取得中 THE システム SHALL ローディングインジケーターを表示する
6. IF データ取得に失敗した THEN システム SHALL エラーメッセージを表示し、リトライオプションを提供する

### Requirement 8: アクセス制御（Security Rules）
**Objective:** As a システム管理者, I want Firestore Security Rulesで不正アクセスを防止する機能, so that データのセキュリティが保証される

#### Acceptance Criteria

1. WHERE ユーザーが未認証の状態でFirestoreにアクセスしようとする THE システム SHALL アクセスを拒否する
2. WHERE ユーザーが自分の事業所のデータを読み取ろうとする THE システム SHALL アクセスを許可する
3. WHERE ユーザーが自分の事業所のデータを書き込もうとする THE システム SHALL アクセスを許可する
4. WHERE ユーザーが他の事業所のデータにアクセスしようとする THE システム SHALL アクセスを拒否する
5. WHERE ユーザーがfacilitiesコレクションの自分の事業所ドキュメントを読み取ろうとする THE システム SHALL アクセスを許可する
6. WHERE ユーザーがusersコレクションの自分のドキュメントを読み取ろうとする THE システム SHALL アクセスを許可する
7. WHERE ユーザーがusersコレクションの他のユーザーのドキュメントにアクセスしようとする THE システム SHALL アクセスを拒否する
8. WHEN Security Rulesが変更される THEN システム SHALL Firebase CLIまたはコンソールから正しくデプロイされる

### Requirement 9: 複数管理者の協働（Phase 2-3）
**Objective:** As a 事業所管理者, I want 他の管理者を事業所に招待できる機能, so that チームで協力してシフト作成できる

#### Acceptance Criteria

1. WHEN 事業所の管理者が他のユーザーを招待する THEN システム SHALL 招待メールを送信する
2. WHEN 招待されたユーザーが招待リンクをクリックする THEN システム SHALL ユーザーを事業所に追加する
3. WHEN ユーザーが事業所に追加される THEN システム SHALL usersドキュメントの belongsTo 配列にその事業所IDを追加する
4. WHEN ユーザーが事業所に追加される THEN システム SHALL facilitiesドキュメントの adminUsers 配列にそのユーザーIDを追加する
5. IF ユーザーが複数の事業所に所属している THEN システム SHALL 事業所切り替えUIを表示する
6. WHEN 複数の管理者が同時に同じシフトを編集する THEN システム SHALL 最後に保存された変更を適用する（Last Write Wins）
7. WHERE 管理者が事業所から他の管理者を削除しようとする THE システム SHALL 少なくとも1人の管理者が残ることを検証する

### Requirement 10: エラーハンドリングとユーザーフィードバック
**Objective:** As a 事業所管理者, I want エラーが発生したときに分かりやすいメッセージを見られる機能, so that 問題を理解し適切に対処できる

#### Acceptance Criteria

1. IF Firestoreへの書き込みに失敗した THEN システム SHALL 「データの保存に失敗しました。もう一度お試しください」というエラーメッセージを表示する
2. IF Firestoreからの読み取りに失敗した THEN システム SHALL 「データの取得に失敗しました。ネットワーク接続を確認してください」というエラーメッセージを表示する
3. IF 認証に失敗した THEN システム SHALL 具体的な失敗理由（メールアドレスが無効、パスワードが間違っている、など）をユーザーに表示する
4. IF ネットワーク接続が切断された THEN システム SHALL 「オフラインです。接続が復旧するまでお待ちください」というメッセージを表示する
5. WHEN データ保存が成功する THEN システム SHALL 成功フィードバック（トーストメッセージなど）を表示する
6. WHEN データ取得・保存処理中 THEN システム SHALL ローディングインジケーターを表示する

---

## Non-Functional Requirements

### Performance
1. WHEN ユーザーがログインする THEN システム SHALL 3秒以内にメイン画面を表示する
2. WHEN ユーザーがスタッフ情報を保存する THEN システム SHALL 1秒以内に保存完了フィードバックを表示する
3. WHEN ユーザーがシフトデータを取得する THEN システム SHALL 2秒以内にカレンダーに表示する

### Security
1. システム SHALL すべての通信をHTTPS経由で行う
2. システム SHALL Firebase Authenticationのセキュリティベストプラクティスに従う
3. システム SHALL Firestore Security Rulesで最小権限の原則を適用する

### Scalability
1. システム SHALL 100事業所まで問題なくスケールする
2. システム SHALL 1事業所あたり100人のスタッフを管理できる
3. システム SHALL 1事業所あたり過去12ヶ月分のシフトデータを保持できる

### Usability
1. システム SHALL ログイン・登録フォームでバリデーションエラーを即座に表示する
2. システム SHALL パスワードは8文字以上を要求する
3. システム SHALL データ保存の成功・失敗を視覚的に分かりやすくフィードバックする

---

## Constraints

### Technical Constraints
- Firebase Authentication（メール/パスワード認証から開始）
- Cloud Firestore Native Mode（既存のasia-northeast1リージョン）
- Firestore Security Rules（RBACベース）
- React 19 + TypeScript（既存フロントエンド）

### Business Constraints
- 既存MVPユーザーのデータ移行は行わない（新規ユーザーのみ対応）
- Phase 2-1, 2-2, 2-3の3段階で実装（一度にすべてを実装しない）
- 無料プランから開始（Firebaseの無料枠内で運用）

### Regulatory Constraints
- 個人情報保護法に準拠
- 介護保険法の記録保持要件に準拠（将来的に）

---

## Dependencies

### External Dependencies
- Firebase Authentication SDK
- Firebase Firestore SDK
- Firebase Hosting（デプロイ）

### Internal Dependencies
- 既存のApp.tsx状態管理（認証状態と統合）
- 既存のtypes.ts型定義（Firestore型と統合）
- 既存のCI/CDパイプライン（Security Rulesのデプロイ）

---

## Success Criteria

本機能が成功したと判断される基準：

1. ✅ ユーザー登録・ログインが正常に動作する
2. ✅ スタッフ・シフトデータがFirestoreに保存される
3. ✅ ブラウザリロード後もデータが復元される
4. ✅ 事業所ごとにデータが完全に分離される
5. ✅ 認証されていないユーザーはデータにアクセスできない
6. ✅ 複数管理者が同じ事業所のデータを編集できる（Phase 2-3）
7. ✅ Security Rulesが正しく動作し、不正アクセスを防止する
8. ✅ エラーハンドリングが適切で、ユーザーが問題を理解できる

---

## Glossary

| 用語 | 説明 |
|------|------|
| 事業所 (Facility) | 介護・福祉サービスを提供する組織単位。マルチテナントの基本単位 |
| マルチテナント | 複数の事業所が同じシステムを使用するが、データは完全に分離される設計 |
| Firebase Authentication | Googleが提供する認証サービス |
| Cloud Firestore | Googleが提供するNoSQLドキュメントデータベース |
| Security Rules | Firestoreのアクセス制御ルール |
| RBAC | Role-Based Access Control（ロールベースアクセス制御） |
| セッション | ユーザーのログイン状態を維持する仕組み |
