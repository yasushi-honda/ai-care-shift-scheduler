# Requirements Document

## Introduction

本ドキュメントは、AIシフト自動作成システムにおける認証・データ永続化機能の要件を定義します。

### 背景
現在のMVP（Minimum Viable Product）では、ブラウザのローカルストレージにデータを保存していないため、ページをリロードするとすべての設定やシフトデータが消失してしまう問題があります。また、認証機能が実装されていないため、複数の事業所や管理者が安全にデータを管理することができません。

### 目的
事業所（Facility）単位のマルチテナント設計を採用し、以下を実現します：
1. Firebase Authentication（Google OAuth）によるユーザー認証
2. Firestoreへのデータ永続化（スタッフ情報、シフトデータ、休暇申請、要件設定）
3. 事業所ベースのデータ分離とロールベースアクセス制御（RBAC）
4. 管理画面による権限管理とユーザー招待機能
5. 複数管理者によるチーム協働機能
6. リロード時のデータ復元

### ビジネス価値
- **運用コスト削減**: パスワード管理不要、Google Workspaceと統合
- **データ保護**: ユーザーの設定やシフトデータがリロード後も保持される
- **セキュリティ**: Googleの強力な認証基盤、事業所ごとのデータ分離、ロールベースアクセス制御
- **チーム協働**: 同じ事業所の複数管理者が協力してシフト作成できる
- **スケーラビリティ**: マルチテナントSaaSの標準パターンで、将来の収益化に対応

---

## Requirements

### Requirement 1: ユーザー認証（Google OAuth）
**Objective:** As a 事業所管理者, I want GoogleアカウントでログインできるSSO機能, so that パスワード管理なしで安全に自分の事業所のデータにアクセスできる

#### Acceptance Criteria

1. WHEN ユーザーが未ログイン状態でアプリにアクセスする THEN システム SHALL ログイン画面を表示する
2. WHEN ログイン画面が表示される THEN システム SHALL 「Googleでログイン」ボタンを表示する
3. WHEN ユーザーが「Googleでログイン」ボタンをクリックする THEN システム SHALL Google OAuth認証画面にリダイレクトする
4. WHEN GoogleでOAuth認証が成功する THEN システム SHALL 以下の情報をGoogleから取得する: email, displayName, photoURL, uid
5. IF 初回ログインのユーザーである THEN システム SHALL Firestoreの `/users/{uid}` に新規ユーザードキュメントを作成する
6. WHEN 初回ユーザードキュメントが作成される THEN システム SHALL 以下のフィールドを保存する: userId, email, name, photoURL, provider("google"), facilities(空配列), createdAt, lastLoginAt
7. IF システム内に1人もユーザーが存在しない THEN システム SHALL 初回ユーザーをsuper-admin権限で作成し、デフォルト施設を自動作成してadmin権限を付与する
8. IF システム内に既にユーザーが存在する THEN システム SHALL 新規ユーザーを権限なし（facilities: []）で作成し、「アクセス権限がありません。管理者に連絡してください」画面を表示する
9. IF 既存ユーザーのログインである THEN システム SHALL lastLoginAtを更新する
10. IF 認証に成功し、かつユーザーがアクセス権限を持つ施設が存在する THEN システム SHALL メイン画面にリダイレクトする
11. IF 認証に失敗した THEN システム SHALL エラーメッセージを表示する
12. WHEN ログイン済みユーザーが「ログアウト」ボタンをクリックする THEN システム SHALL Firebase Authenticationからサインアウトしてログイン画面にリダイレクトする
13. WHEN アプリがリロードされる THEN システム SHALL Firebase AuthenticationのセッションからユーザーIDを復元し、自動的にログイン状態を維持する

### Requirement 2: 事業所管理とロールベースアクセス制御（RBAC）
**Objective:** As a ユーザー, I want 自分のロールに応じた権限で事業所のデータを操作できる機能, so that 他の事業所のデータと混在せず、適切な権限で安全に管理できる

#### ロール定義

| ロール | 権限 |
|--------|------|
| **super-admin** | 管理画面アクセス、全施設管理、全権限付与、ユーザー管理 |
| **admin** | 施設のシフト作成・編集・削除、スタッフ管理、同じ施設内のメンバー招待（editor/viewer権限のみ付与可） |
| **editor** | 施設のシフト作成・編集・閲覧、スタッフ情報の閲覧 |
| **viewer** | 施設のシフト閲覧のみ |

#### Acceptance Criteria

1. WHEN ユーザーがログインする THEN システム SHALL Firestoreから `/users/{uid}` ドキュメントを取得し、そのユーザーの facilities 配列を読み込む
2. WHEN facilities配列が読み込まれる THEN システム SHALL 各施設エントリに以下の情報が含まれることを確認する: facilityId, role, grantedAt, grantedBy
3. IF ユーザーがアクセス権限を持つ施設が存在しない（facilities: []） THEN システム SHALL 「アクセス権限がありません。管理者に連絡してください」画面を表示する
4. IF ユーザーが1つの施設のみにアクセス権限を持つ THEN システム SHALL その施設を自動的に選択してメイン画面を表示する
5. IF ユーザーが複数の施設にアクセス権限を持つ THEN システム SHALL 施設選択UIを表示する
6. WHEN ユーザーが施設を選択する THEN システム SHALL 選択された施設のデータ（スタッフ、シフト、休暇申請、要件）をロードする
7. WHILE ユーザーがアプリを使用している THE システム SHALL 現在選択中の施設IDと自分のロールをコンテキストに保持する
8. WHERE ユーザーがsuper-admin権限を持つ THE システム SHALL 管理画面（/admin）へのアクセスを許可する
9. WHERE ユーザーがsuper-admin以外の権限である THE システム SHALL 管理画面へのアクセスを拒否し、403エラーを返す
10. WHERE ユーザーがadmin権限を持つ THE システム SHALL その施設のデータ作成・編集・削除を許可する
11. WHERE ユーザーがeditor権限を持つ THE システム SHALL その施設のシフト作成・編集と、スタッフ情報の閲覧を許可する
12. WHERE ユーザーがviewer権限を持つ THE システム SHALL その施設のすべてのデータ閲覧のみを許可し、編集操作を拒否する
13. WHEN ユーザーがデータ操作を実行する THEN システム SHALL 操作前にユーザーのロールを確認し、権限がない場合は403エラーを返す
14. WHERE ユーザーが他の施設のデータにアクセスしようとした THE システム SHALL アクセスを拒否し、403エラーを返す
15. WHEN ユーザーが施設を切り替える THEN システム SHALL 新しい施設のデータをロードし、古い施設のデータをメモリからクリアする

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
7. WHEN Last Write Wins戦略を使用する THEN システム SHALL 以下の動作を保証する:
   - 先に保存された変更が後の保存で上書きされる（既知の制限）
   - 最新の保存が常に優先される
   - データ損失のリスクがあることをドキュメントに明記する
8. IF 同時編集によるデータ損失が許容できない THEN システム SHALL 以下の緩和策を検討する:
   - オプション1: バージョン管理やタイムスタンプベースのマージ戦略を実装する
   - オプション2: UIレベルで競合検出を実装し、ユーザーにリロードとリトライを促す
   - オプション3: 楽観的ロック（Optimistic Locking）を使用して、保存前に競合をチェックする
9. WHERE 管理者が事業所から他の管理者を削除しようとする THE システム SHALL 少なくとも1人の管理者が残ることを検証する

### Requirement 10: エラーハンドリングとユーザーフィードバック
**Objective:** As a 事業所管理者, I want エラーが発生したときに分かりやすいメッセージを見られる機能, so that 問題を理解し適切に対処できる

#### Acceptance Criteria

1. IF Firestoreへの書き込みに失敗した THEN システム SHALL 「データの保存に失敗しました。もう一度お試しください」というエラーメッセージを表示する
2. IF Firestoreからの読み取りに失敗した THEN システム SHALL 「データの取得に失敗しました。ネットワーク接続を確認してください」というエラーメッセージを表示する
3. IF 認証に失敗した THEN システム SHALL 具体的な失敗理由（メールアドレスが無効、パスワードが間違っている、など）をユーザーに表示する
4. IF ネットワーク接続が切断された THEN システム SHALL 「オフラインです。接続が復旧するまでお待ちください」というメッセージを表示する
5. WHEN データ保存が成功する THEN システム SHALL 成功フィードバック（トーストメッセージなど）を表示する
6. WHEN データ取得・保存処理中 THEN システム SHALL ローディングインジケーターを表示する

### Requirement 11: 監査ログとコンプライアンス（Phase 2-4）
**Objective:** As a システム管理者, I want すべてのデータアクセスと操作を監査ログに記録する機能, so that 介護保険法などの規制要件に準拠し、セキュリティインシデント発生時に調査できる

#### Acceptance Criteria

1. WHEN ユーザーがスタッフ、シフト、休暇申請、要件設定のデータを作成・読取・更新・削除する THEN システム SHALL 監査ログにその操作を記録する
2. WHEN 監査ログエントリが作成される THEN システム SHALL 以下の情報を含める:
   - 操作日時（タイムスタンプ）
   - ユーザーID（誰が操作したか）
   - 操作種別（CREATE, READ, UPDATE, DELETE）
   - 対象リソース（コレクション名とドキュメントID）
   - 操作内容（変更前後の値、またはクエリ条件）
   - デバイス情報（IPアドレス、ユーザーエージェント）
   - 操作結果（成功/失敗）
3. WHEN 監査ログが保存される THEN システム SHALL Firestoreの専用コレクション `/auditLogs/{logId}` に改ざん防止可能な形式で保存する
4. WHEN 監査ログが保存される THEN システム SHALL 介護保険法に準拠した保存期間（最低5年、推奨10年）を設定する
5. WHERE ユーザーが監査ログを編集または削除しようとする THE システム SHALL 操作を拒否する（immutable logs）
6. WHEN システム管理者が監査ログを閲覧する THEN システム SHALL フィルタリング可能な監査ログビューアUIを提供する
7. WHEN システム管理者が監査ログを検索する THEN システム SHALL 以下の条件で検索できる: 日時範囲、ユーザーID、操作種別、対象リソース
8. WHEN 不審なアクセスパターンが検出される THEN システム SHALL アラートを生成する:
   - 短時間での大量のデータエクスポート
   - 通常と異なる時間帯のアクセス
   - 複数回の認証失敗
   - 権限のないリソースへのアクセス試行
9. WHEN 監査ログのストレージ容量が閾値を超える THEN システム SHALL 管理者に通知し、古いログのアーカイブを促す
10. WHERE セキュリティ監査が実施される THE システム SHALL 監査ログをCSVまたはJSON形式でエクスポートできる

#### 補足事項

**規制要件との関連**:
- **介護保険法**: 介護サービス事業者は、サービス提供記録を一定期間保存する義務があります
- **個人情報保護法**: 個人データへのアクセス履歴を記録し、漏洩時の影響範囲を特定できる必要があります
- **厚生労働省ガイドライン**: 医療・介護分野の情報システムには、アクセスログの取得と定期的なレビューが推奨されています

**実装の優先順位**:
- Phase 2-1〜2-3では最小限の監査ログ（認証イベントのみ）
- Phase 2-4で包括的な監査ログシステムを実装
- 本番環境リリース前に必ず実装完了すること

### Requirement 12: 管理画面とアクセス制御（super-admin専用）
**Objective:** As a super-admin, I want 管理画面から全施設とユーザーを管理できる機能, so that システム全体の権限管理とユーザー招待を効率的に行える

#### Acceptance Criteria

1. WHERE ユーザーがsuper-admin権限を持つ THE システム SHALL `/admin` パスへのアクセスを許可する
2. WHERE ユーザーがsuper-admin以外の権限である THE システム SHALL `/admin` パスへのアクセスを拒否し、403エラー画面を表示する
3. WHEN super-adminが管理画面にアクセスする THEN システム SHALL 以下のナビゲーションメニューを表示する: 施設管理、ユーザー管理、監査ログ、使用状況レポート
4. WHEN super-adminが「施設管理」画面を開く THEN システム SHALL すべての施設の一覧を表示する（施設名、作成日、メンバー数、ステータス）
5. WHEN super-adminが「新規施設作成」ボタンをクリックする THEN システム SHALL 施設作成フォーム（施設名、初期管理者メール）を表示する
6. WHEN super-adminが施設作成フォームを送信する THEN システム SHALL Firestoreに `/facilities/{facilityId}` ドキュメントを作成し、指定されたユーザーにadmin権限を付与する
7. WHEN super-adminが施設を選択する THEN システム SHALL その施設の詳細画面（メンバー一覧、シフトデータ統計）を表示する
8. WHEN super-adminが「ユーザー管理」画面を開く THEN システム SHALL すべてのユーザーの一覧を表示する（名前、メール、所属施設数、最終ログイン日時）
9. WHEN super-adminがユーザーを選択する THEN システム SHALL そのユーザーの詳細画面（所属施設とロール、アクセス履歴）を表示する
10. WHEN super-adminが「アクセス権限付与」ボタンをクリックする THEN システム SHALL 施設選択とロール選択（admin/editor/viewer）のフォームを表示する
11. WHEN super-adminがアクセス権限付与フォームを送信する THEN システム SHALL そのユーザーの `/users/{uid}` ドキュメントの facilities 配列に新しいエントリを追加する
12. WHEN facilities配列にエントリが追加される THEN システム SHALL 以下の情報を含める: facilityId, role, grantedAt (Timestamp), grantedBy (super-admin UID)
13. WHEN super-adminがアクセス権限を剥奪する THEN システム SHALL そのユーザーの facilities 配列から該当エントリを削除する
14. WHERE admin権限ユーザーが同じ施設内のメンバーを招待しようとする THE システム SHALL editor または viewer 権限のみ付与可能とし、admin権限の付与は拒否する
15. WHEN super-adminが監査ログ画面を開く THEN システム SHALL Requirement 11の監査ログビューアUIを表示する
16. WHEN super-adminが使用状況レポート画面を開く THEN システム SHALL 施設別の利用統計（ユーザー数、シフト生成回数、ストレージ使用量）を表示する
17. WHEN admin権限ユーザーが自分の施設のメンバーを招待する THEN システム SHALL `/facilities/{facilityId}/invitations/{invitationId}` にドキュメントを作成し、招待メールを送信する
18. WHEN 招待されたユーザーが招待リンクをクリックする THEN システム SHALL そのユーザーの facilities 配列に該当施設のエントリを追加する

#### 補足事項

**管理画面の画面構成**:
```text
/admin（super-admin専用）
├── /facilities（施設管理）
│   ├── 一覧・作成・削除
│   └── 施設詳細（メンバー管理、データ統計）
├── /users（ユーザー管理）
│   ├── 一覧・検索
│   └── ユーザー詳細（アクセス権限付与/剥奪）
├── /audit-logs（監査ログ）
│   └── フィルタリング可能なログビューア
└── /usage（使用状況レポート）
    └── 施設別利用統計
```

**招待機能のフロー**:
1. admin権限ユーザーが招待メールアドレスを入力
2. システムが招待リンク付きメールを送信
3. 招待されたユーザーがリンクをクリック
4. Googleアカウントでログイン
5. 自動的に該当施設のアクセス権限が付与される
6. メイン画面にリダイレクト

**実装の優先順位**:
- Phase 2-1: super-admin機能（施設管理、ユーザー管理）
- Phase 2-2: admin権限ユーザーによる招待機能
- Phase 2-3: 監査ログビューア、使用状況レポート

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
1. システム SHALL ログイン画面に「Googleでログイン」ボタンを明確に表示する
2. システム SHALL Google OAuth認証画面へのリダイレクトをスムーズに行う
3. システム SHALL データ保存の成功・失敗を視覚的に分かりやすくフィードバックする
4. システム SHALL アクセス権限がないユーザーに分かりやすいメッセージを表示する

---

## Data Model

### users コレクション
```typescript
{
  userId: string,  // Firebase Auth UID
  email: string,  // Googleから取得
  name: string,  // Googleから取得
  photoURL: string,  // Googleプロフィール画像
  provider: "google",

  // アクセス権限（施設とロール）
  facilities: [
    {
      facilityId: string,
      role: "super-admin" | "admin" | "editor" | "viewer",
      grantedAt: Timestamp,
      grantedBy: string  // 付与したユーザーのUID
    }
  ],

  createdAt: Timestamp,
  lastLoginAt: Timestamp
}
```

### facilities コレクション
```typescript
{
  facilityId: string,
  name: string,

  // メンバー一覧（非正規化）
  members: [
    {
      userId: string,
      email: string,
      name: string,
      role: "admin" | "editor" | "viewer"
    }
  ],

  createdAt: Timestamp,
  createdBy: string,  // 作成したsuper-admin UID

  // サブコレクション
  // - /staff/{staffId}
  // - /schedules/{scheduleId}
  // - /leaveRequests/{requestId}
  // - /requirements/{requirementId}
  // - /invitations/{invitationId}
}
```

### facilities/{facilityId}/staff コレクション
```typescript
{
  id: string,
  name: string,
  role: string,  // スタッフの役職
  qualifications: string[],
  weeklyWorkCount: { hope: number, must: number },
  maxConsecutiveWorkDays: number,
  availableWeekdays: number[],
  unavailableDates: string[],
  timeSlotPreference: string,
  isNightShiftOnly: boolean,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### facilities/{facilityId}/schedules コレクション
```typescript
{
  id: string,
  targetMonth: string,  // "2025-11"
  staffSchedules: [
    {
      staffId: string,
      staffName: string,
      shifts: { [date: string]: ShiftType }
    }
  ],
  version: number,
  status: "draft" | "published",
  generatedAt: Timestamp,
  generatedBy: string,  // UID
  updatedAt: Timestamp
}
```

### facilities/{facilityId}/leaveRequests コレクション
```typescript
{
  id: string,
  staffId: string,
  staffName: string,
  date: string,  // "2025-11-15"
  leaveType: "有給休暇" | "欠勤" | "研修",
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### facilities/{facilityId}/requirements コレクション
```typescript
{
  id: "default",  // デフォルト設定は固定ID
  早番: { total: number, qualifications: { [key: string]: number } },
  日勤: { total: number, qualifications: { [key: string]: number } },
  遅番: { total: number, qualifications: { [key: string]: number } },
  夜勤: { total: number, qualifications: { [key: string]: number } },
  updatedAt: Timestamp
}
```

### facilities/{facilityId}/invitations コレクション
```typescript
{
  id: string,
  email: string,  // 招待先メールアドレス
  role: "editor" | "viewer",  // 付与する権限
  token: string,  // ランダムトークン
  status: "pending" | "accepted" | "expired",
  createdBy: string,  // 招待したユーザーのUID
  createdAt: Timestamp,
  expiresAt: Timestamp  // 有効期限（7日間）
}
```

### auditLogs コレクション（グローバル）
```typescript
{
  logId: string,
  timestamp: Timestamp,
  userId: string,
  email: string,
  action: "CREATE" | "READ" | "UPDATE" | "DELETE",
  resourceType: "staff" | "schedule" | "leaveRequest" | "requirement" | "facility" | "user",
  resourceId: string,
  facilityId: string | null,
  details: any,  // 変更内容など
  ipAddress: string,
  userAgent: string,
  result: "success" | "failure"
}
```

---

## Constraints

### Technical Constraints
- Firebase Authentication（Google OAuth認証）
- Cloud Firestore Native Mode（既存のasia-northeast1リージョン）
- Firestore Security Rules（RBACベース）
- React 19 + TypeScript（既存フロントエンド）
- Google Workspace（組織のアカウント管理基盤）

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
9. ✅ 監査ログが正しく記録され、コンプライアンス要件を満たす（Phase 2-4）
10. ✅ 同時編集の制限が明確にドキュメント化され、必要に応じて緩和策が実装されている

---

## Glossary

| 用語 | 説明 |
|------|------|
| 事業所 (Facility) | 介護・福祉サービスを提供する組織単位。マルチテナントの基本単位 |
| マルチテナント | 複数の事業所が同じシステムを使用するが、データは完全に分離される設計 |
| Google OAuth | Googleアカウントで他のサービスにログインできる認証プロトコル |
| SSO (Single Sign-On) | 1つのアカウントで複数のサービスにログインできる仕組み |
| Google Workspace | Googleが提供する企業向けクラウドサービス（Gmail、Driveなど） |
| Firebase Authentication | Googleが提供する認証サービス（Google OAuthに対応） |
| Cloud Firestore | Googleが提供するNoSQLドキュメントデータベース |
| Security Rules | Firestoreのアクセス制御ルール |
| RBAC | Role-Based Access Control（ロールベースアクセス制御） |
| super-admin | システム全体の管理者。全施設とユーザーを管理できる最高権限 |
| admin | 施設の管理者。シフト作成・編集・削除、メンバー招待が可能 |
| editor | 施設の編集者。シフト作成・編集とスタッフ情報閲覧が可能 |
| viewer | 施設の閲覧者。すべてのデータ閲覧のみ可能 |
| 招待機能 (Invitation) | 管理者が他のユーザーを施設に招待する機能。メールでリンクを送信 |
| セッション | ユーザーのログイン状態を維持する仕組み |
| Last Write Wins (LWW) | 同時編集時の競合解決戦略。最後に保存された変更が優先される |
| 監査ログ (Audit Log) | システム上のすべての操作を記録したログ。コンプライアンスとセキュリティ調査に使用 |
| 楽観的ロック (Optimistic Locking) | データ保存時に競合を検出する仕組み。バージョン番号やタイムスタンプで実装 |
| 介護保険法 | 介護サービス事業者に記録保持義務を課す日本の法律 |
| 改ざん防止 (Tamper-proof) | データが変更または削除できないように保護する仕組み |
