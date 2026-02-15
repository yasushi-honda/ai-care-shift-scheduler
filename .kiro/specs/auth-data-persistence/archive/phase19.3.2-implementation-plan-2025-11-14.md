# Phase 19.3.2 実装計画 - バックアップ・リストア機能

**作成日**: 2025-11-14
**仕様ID**: auth-data-persistence
**Phase**: 19.3.2
**推定工数**: 4-5時間

---

## 📋 概要

Phase 19.3.2では、施設データのバックアップとリストア機能を実装します。Cloud Functions、Cloud Storage、Cloud Schedulerを統合し、データ保護と災害復旧（DR）機能を提供します。

### 背景

- **データ保護の必要性**: 施設データ（スタッフ、シフト、休暇申請）の誤削除や破損からの復旧
- **コンプライアンス**: データ保管要件への対応（介護事業者のデータ管理義務）
- **運用の安定性**: 定期バックアップによる事業継続性の確保

---

## 🎯 目的

1. **手動バックアップ機能**
   - 管理者が任意のタイミングで施設データをバックアップ
   - Cloud Storageへの保存

2. **自動定期バックアップ**
   - Cloud Schedulerによる毎日自動バックアップ
   - 世代管理（30日間保持）

3. **リストア機能**
   - バックアップファイルからのデータ復元
   - 復元前の確認・プレビュー
   - 復元操作の監査ログ記録

4. **バックアップ管理UI**
   - バックアップ履歴の表示
   - バックアップのダウンロード
   - リストア操作の実行

---

## 🔍 技術調査

### Cloud Storage構成

#### バケット構成
- **デフォルトバケット**: `{project-id}.appspot.com`（Firebase Storage）
- **パス構造**:
  ```
  /backups/{facilityId}/{timestamp}.json
  /backups/{facilityId}/{timestamp}.metadata.json (オプション)
  ```

#### セキュリティルール
**現状**: `storage.rules` は開発用（誰でも読み取り可能、10MB書き込み制限）

**Phase 19.3.2対応**:
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // バックアップファイル
    match /backups/{facilityId}/{filename} {
      // 読み取り: 該当施設のadmin/super-admin
      allow read: if request.auth != null &&
                     (request.auth.token.role == 'super-admin' ||
                      (request.auth.token.facilityId == facilityId &&
                       request.auth.token.role == 'admin'));

      // 書き込み: Cloud Functionsのみ（service account）
      // フロントエンドからの直接書き込みは禁止
      allow write: if false; // Cloud Functions経由のみ
    }

    // その他のファイル（既存のルール維持）
    match /{allPaths=**} {
      allow read: if true;
      allow write: if request.resource.size < 10 * 1024 * 1024;
    }
  }
}
```

### バックアップデータ形式

#### JSON Schema

```typescript
interface FacilityBackup {
  // メタデータ
  backupId: string; // UUID
  facilityId: string;
  facilityName: string;
  timestamp: string; // ISO 8601 (e.g., "2025-11-14T12:00:00.000Z")
  schemaVersion: string; // "1.0.0"
  createdBy: string; // UID（手動バックアップ時）または "system"（自動バックアップ時）
  backupType: 'manual' | 'scheduled';

  // バックアップデータ
  data: {
    facility: Facility;
    staff: Staff[];
    schedules: Schedule[];
    scheduleVersions: ScheduleVersion[];
    leaveRequests: LeaveRequestDocument[];
  };

  // 統計情報
  statistics: {
    staffCount: number;
    scheduleCount: number;
    scheduleVersionCount: number;
    leaveRequestCount: number;
    totalSize: number; // バイト数
  };
}
```

#### ファイルサイズ見積もり

| 施設規模 | スタッフ数 | スケジュール数 | 推定サイズ |
|----------|-----------|--------------|-----------|
| 小規模   | 10名      | 12ヶ月       | ~50KB     |
| 中規模   | 50名      | 12ヶ月       | ~200KB    |
| 大規模   | 100名     | 12ヶ月       | ~500KB    |

**結論**: 10MB制限で十分対応可能

---

## 📂 実装ファイル

### 1. Cloud Functions

#### 1.1 `functions/src/backupFacilityData.ts` (新規作成)

**概要**: 施設データをCloud Storageにバックアップ

**実装内容**:

```typescript
import { onCall } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';

interface BackupRequest {
  facilityId: string;
}

interface BackupResponse {
  backupId: string;
  storageUrl: string;
  timestamp: string;
  statistics: {
    staffCount: number;
    scheduleCount: number;
    scheduleVersionCount: number;
    leaveRequestCount: number;
    totalSize: number;
  };
}

/**
 * 施設データをバックアップ
 *
 * 認証: admin または super-admin
 * レート制限: 1回/分（Cloud Functionsのデフォルト制限）
 */
export const backupFacilityData = onCall<BackupRequest, Promise<BackupResponse>>(
  {
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 300, // 5分（バックアップ処理に時間がかかる可能性）
    minInstances: 0,
    maxInstances: 5,
  },
  async (request) => {
    // 認証チェック
    if (!request.auth) {
      throw new Error('認証が必要です');
    }

    const { facilityId } = request.data;

    // 権限チェック（super-admin または該当施設のadmin）
    const isSuperAdmin = request.auth.token.role === 'super-admin';
    const isFacilityAdmin =
      request.auth.token.facilityId === facilityId &&
      request.auth.token.role === 'admin';

    if (!isSuperAdmin && !isFacilityAdmin) {
      throw new Error('バックアップ権限がありません');
    }

    const db = admin.firestore();
    const storage = admin.storage();

    try {
      // 1. 施設情報を取得
      const facilityDoc = await db.collection('facilities').doc(facilityId).get();
      if (!facilityDoc.exists) {
        throw new Error('施設が見つかりません');
      }
      const facility = { facilityId, ...facilityDoc.data() };

      // 2. スタッフデータを取得
      const staffSnapshot = await db
        .collection('facilities')
        .doc(facilityId)
        .collection('staff')
        .get();
      const staff = staffSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      // 3. スケジュールデータを取得
      const schedulesSnapshot = await db
        .collection('facilities')
        .doc(facilityId)
        .collection('schedules')
        .get();
      const schedules = schedulesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      // 4. スケジュールバージョンを取得
      const scheduleVersions: any[] = [];
      for (const scheduleDoc of schedulesSnapshot.docs) {
        const versionsSnapshot = await scheduleDoc.ref.collection('versions').get();
        versionsSnapshot.docs.forEach((versionDoc) => {
          scheduleVersions.push({
            scheduleId: scheduleDoc.id,
            versionId: versionDoc.id,
            ...versionDoc.data(),
          });
        });
      }

      // 5. 休暇申請データを取得
      const leaveRequestsSnapshot = await db
        .collection('facilities')
        .doc(facilityId)
        .collection('leaveRequests')
        .get();
      const leaveRequests = leaveRequestsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      // 6. バックアップオブジェクトを作成
      const backupId = uuidv4();
      const timestamp = new Date().toISOString();

      const backupData = {
        backupId,
        facilityId,
        facilityName: facility.name,
        timestamp,
        schemaVersion: '1.0.0',
        createdBy: request.auth.uid,
        backupType: 'manual',
        data: {
          facility,
          staff,
          schedules,
          scheduleVersions,
          leaveRequests,
        },
        statistics: {
          staffCount: staff.length,
          scheduleCount: schedules.length,
          scheduleVersionCount: scheduleVersions.length,
          leaveRequestCount: leaveRequests.length,
          totalSize: 0, // 後で計算
        },
      };

      // 7. JSON文字列に変換
      const backupJson = JSON.stringify(backupData, null, 2);
      backupData.statistics.totalSize = Buffer.byteLength(backupJson, 'utf8');

      // 8. Cloud Storageに保存
      const filename = `backups/${facilityId}/${timestamp}.json`;
      const bucket = storage.bucket();
      const file = bucket.file(filename);

      await file.save(backupJson, {
        contentType: 'application/json',
        metadata: {
          facilityId,
          backupId,
          createdBy: request.auth.uid,
          createdAt: timestamp,
        },
      });

      // 9. ダウンロードURLを取得（署名付きURL、7日間有効）
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7日後
      });

      // 10. 監査ログ記録（AuditLogServiceはフロントエンド側で記録）

      return {
        backupId,
        storageUrl: signedUrl,
        timestamp,
        statistics: backupData.statistics,
      };
    } catch (error) {
      console.error('Backup failed:', error);
      throw new Error(`バックアップに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    }
  }
);
```

**依存パッケージ**:
```json
{
  "dependencies": {
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/uuid": "^9.0.0"
  }
}
```

#### 1.2 `functions/src/restoreFacilityData.ts` (新規作成)

**概要**: バックアップファイルから施設データを復元

**実装内容**:

```typescript
import { onCall } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

interface RestoreRequest {
  facilityId: string;
  backupId: string; // または storageUrl
  storageUrl: string; // gs://... 形式
}

interface RestoreResponse {
  restored: {
    staffCount: number;
    scheduleCount: number;
    scheduleVersionCount: number;
    leaveRequestCount: number;
  };
  timestamp: string;
}

/**
 * バックアップからデータを復元
 *
 * 認証: super-admin のみ（データ復元は高リスク操作）
 *
 * ⚠️ 注意: 既存データは上書きされます
 */
export const restoreFacilityData = onCall<RestoreRequest, Promise<RestoreResponse>>(
  {
    region: 'us-central1',
    memory: '1GiB', // 大量データ復元に備えて増量
    timeoutSeconds: 540, // 9分（最大値）
    minInstances: 0,
    maxInstances: 2, // リストアは並列実行しない
  },
  async (request) => {
    // 認証チェック（super-adminのみ）
    if (!request.auth) {
      throw new Error('認証が必要です');
    }

    if (request.auth.token.role !== 'super-admin') {
      throw new Error('リストア権限がありません（super-adminのみ実行可能）');
    }

    const { facilityId, storageUrl } = request.data;

    const db = admin.firestore();
    const storage = admin.storage();

    try {
      // 1. バックアップファイルをCloud Storageから読み込み
      const bucket = storage.bucket();
      const file = bucket.file(storageUrl.replace(`gs://${bucket.name}/`, ''));

      const [fileContents] = await file.download();
      const backupData = JSON.parse(fileContents.toString('utf8'));

      // 2. スキーマバージョンチェック
      if (backupData.schemaVersion !== '1.0.0') {
        throw new Error(`サポートされていないスキーマバージョンです: ${backupData.schemaVersion}`);
      }

      // 3. 施設IDの一致確認
      if (backupData.facilityId !== facilityId) {
        throw new Error('バックアップの施設IDが一致しません');
      }

      // 4. トランザクションで復元（Firestoreの制限: 500ドキュメント/トランザクション）
      // → バッチ処理で実装

      const batch = db.batch();
      let operationCount = 0;

      // 4.1 施設情報を復元
      const facilityRef = db.collection('facilities').doc(facilityId);
      batch.set(facilityRef, backupData.data.facility, { merge: true });
      operationCount++;

      // 4.2 スタッフを復元
      for (const staffData of backupData.data.staff) {
        const staffRef = facilityRef.collection('staff').doc(staffData.id);
        batch.set(staffRef, staffData);
        operationCount++;

        // バッチの制限（500）に達したらコミット
        if (operationCount >= 450) {
          await batch.commit();
          operationCount = 0;
        }
      }

      // 4.3 スケジュールを復元
      for (const scheduleData of backupData.data.schedules) {
        const scheduleRef = facilityRef.collection('schedules').doc(scheduleData.id);
        batch.set(scheduleRef, scheduleData);
        operationCount++;

        if (operationCount >= 450) {
          await batch.commit();
          operationCount = 0;
        }
      }

      // 4.4 スケジュールバージョンを復元
      for (const versionData of backupData.data.scheduleVersions) {
        const versionRef = facilityRef
          .collection('schedules')
          .doc(versionData.scheduleId)
          .collection('versions')
          .doc(versionData.versionId);
        batch.set(versionRef, versionData);
        operationCount++;

        if (operationCount >= 450) {
          await batch.commit();
          operationCount = 0;
        }
      }

      // 4.5 休暇申請を復元
      for (const leaveRequestData of backupData.data.leaveRequests) {
        const leaveRequestRef = facilityRef.collection('leaveRequests').doc(leaveRequestData.id);
        batch.set(leaveRequestRef, leaveRequestData);
        operationCount++;

        if (operationCount >= 450) {
          await batch.commit();
          operationCount = 0;
        }
      }

      // 最後のバッチをコミット
      if (operationCount > 0) {
        await batch.commit();
      }

      return {
        restored: {
          staffCount: backupData.data.staff.length,
          scheduleCount: backupData.data.schedules.length,
          scheduleVersionCount: backupData.data.scheduleVersions.length,
          leaveRequestCount: backupData.data.leaveRequests.length,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Restore failed:', error);
      throw new Error(`リストアに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    }
  }
);
```

#### 1.3 `functions/src/scheduledBackup.ts` (新規作成)

**概要**: Cloud Schedulerによる定期バックアップ

**実装内容**:

```typescript
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';

/**
 * 毎日午前2時（JST）に全施設のバックアップを実行
 *
 * Cloud Scheduler: 0 17 * * * (UTC) = 午前2時（JST, UTC+9）
 */
export const scheduledBackup = onSchedule(
  {
    schedule: '0 17 * * *', // 毎日午前2時（JST）
    timeZone: 'UTC',
    region: 'us-central1',
    memory: '1GiB',
    timeoutSeconds: 540, // 9分
    retryCount: 3,
  },
  async (event) => {
    const db = admin.firestore();
    const storage = admin.storage();

    console.log('Scheduled backup started');

    try {
      // 1. 全施設を取得
      const facilitiesSnapshot = await db.collection('facilities').get();

      for (const facilityDoc of facilitiesSnapshot.docs) {
        const facilityId = facilityDoc.id;
        const facilityName = facilityDoc.data().name;

        try {
          console.log(`Backing up facility: ${facilityId} (${facilityName})`);

          // 2. バックアップ処理（backupFacilityDataと同じロジック）
          const facility = { facilityId, ...facilityDoc.data() };

          const staffSnapshot = await db
            .collection('facilities')
            .doc(facilityId)
            .collection('staff')
            .get();
          const staff = staffSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

          const schedulesSnapshot = await db
            .collection('facilities')
            .doc(facilityId)
            .collection('schedules')
            .get();
          const schedules = schedulesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

          const scheduleVersions: any[] = [];
          for (const scheduleDoc of schedulesSnapshot.docs) {
            const versionsSnapshot = await scheduleDoc.ref.collection('versions').get();
            versionsSnapshot.docs.forEach((versionDoc) => {
              scheduleVersions.push({
                scheduleId: scheduleDoc.id,
                versionId: versionDoc.id,
                ...versionDoc.data(),
              });
            });
          }

          const leaveRequestsSnapshot = await db
            .collection('facilities')
            .doc(facilityId)
            .collection('leaveRequests')
            .get();
          const leaveRequests = leaveRequestsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

          const backupId = uuidv4();
          const timestamp = new Date().toISOString();

          const backupData = {
            backupId,
            facilityId,
            facilityName,
            timestamp,
            schemaVersion: '1.0.0',
            createdBy: 'system',
            backupType: 'scheduled',
            data: {
              facility,
              staff,
              schedules,
              scheduleVersions,
              leaveRequests,
            },
            statistics: {
              staffCount: staff.length,
              scheduleCount: schedules.length,
              scheduleVersionCount: scheduleVersions.length,
              leaveRequestCount: leaveRequests.length,
              totalSize: 0,
            },
          };

          const backupJson = JSON.stringify(backupData, null, 2);
          backupData.statistics.totalSize = Buffer.byteLength(backupJson, 'utf8');

          const filename = `backups/${facilityId}/${timestamp}.json`;
          const bucket = storage.bucket();
          const file = bucket.file(filename);

          await file.save(backupJson, {
            contentType: 'application/json',
            metadata: {
              facilityId,
              backupId,
              createdBy: 'system',
              createdAt: timestamp,
              type: 'scheduled',
            },
          });

          console.log(`Backup completed for facility: ${facilityId} (${backupData.statistics.totalSize} bytes)`);
        } catch (error) {
          console.error(`Backup failed for facility ${facilityId}:`, error);
          // 1施設の失敗で全体を停止しない
          continue;
        }
      }

      // 3. 古いバックアップを削除（30日以上前）
      await cleanupOldBackups(storage);

      console.log('Scheduled backup completed');
    } catch (error) {
      console.error('Scheduled backup failed:', error);
      throw error;
    }
  }
);

/**
 * 30日以上前のバックアップファイルを削除
 */
async function cleanupOldBackups(storage: admin.storage.Storage): Promise<void> {
  const bucket = storage.bucket();
  const [files] = await bucket.getFiles({ prefix: 'backups/' });

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  for (const file of files) {
    const [metadata] = await file.getMetadata();
    const createdAt = new Date(metadata.timeCreated).getTime();

    if (createdAt < thirtyDaysAgo) {
      console.log(`Deleting old backup: ${file.name}`);
      await file.delete();
    }
  }
}
```

#### 1.4 `functions/src/index.ts` (修正)

**追加内容**:

```typescript
// ... 既存のimport

// Phase 19.3.2: バックアップ・リストア機能
export { backupFacilityData } from './backupFacilityData';
export { restoreFacilityData } from './restoreFacilityData';
export { scheduledBackup } from './scheduledBackup';
```

### 2. フロントエンド（管理画面）

#### 2.1 `src/pages/admin/BackupManagement.tsx` (新規作成)

**概要**: バックアップ管理画面（super-admin/admin用）

**機能**:
- バックアップ履歴の表示
- 手動バックアップの実行
- バックアップのダウンロード
- リストア操作（super-adminのみ）

**実装内容**:

```typescript
import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { ref, listAll, getMetadata } from 'firebase/storage';
import { functions, storage } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Button } from '../components/Button';
import { AuditLogService } from '../services/auditLogService';
import { AuditLogAction } from '../../types';

interface BackupMetadata {
  backupId: string;
  filename: string;
  facilityId: string;
  createdBy: string;
  createdAt: string;
  size: number;
  type: 'manual' | 'scheduled';
}

export const BackupManagement: React.FC = () => {
  const { currentUser, facilityRole } = useAuth();
  const { addToast } = useToast();
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // バックアップ一覧を取得
  useEffect(() => {
    loadBackups();
  }, []);

  const loadBackups = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);

      // facilityIdを取得（仮実装: 最初の施設を使用）
      const facilityId = currentUser.facilities?.[0]?.facilityId;
      if (!facilityId) {
        throw new Error('施設情報が見つかりません');
      }

      // Cloud Storageからバックアップファイル一覧を取得
      const backupsRef = ref(storage, `backups/${facilityId}`);
      const result = await listAll(backupsRef);

      const backupList: BackupMetadata[] = [];

      for (const item of result.items) {
        const metadata = await getMetadata(item);
        backupList.push({
          backupId: metadata.customMetadata?.backupId || 'unknown',
          filename: item.name,
          facilityId: metadata.customMetadata?.facilityId || facilityId,
          createdBy: metadata.customMetadata?.createdBy || 'unknown',
          createdAt: metadata.customMetadata?.createdAt || metadata.timeCreated,
          size: metadata.size,
          type: (metadata.customMetadata?.type as 'manual' | 'scheduled') || 'manual',
        });
      }

      // 新しい順にソート
      backupList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setBackups(backupList);
    } catch (error) {
      console.error('Failed to load backups:', error);
      addToast('バックアップ一覧の取得に失敗しました', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 手動バックアップを実行
  const handleBackup = async () => {
    if (!currentUser) return;

    const facilityId = currentUser.facilities?.[0]?.facilityId;
    if (!facilityId) {
      addToast('施設情報が見つかりません', 'error');
      return;
    }

    try {
      setBackingUp(true);

      const backupFunction = httpsCallable(functions, 'backupFacilityData');
      const result = await backupFunction({ facilityId });

      // 監査ログ記録
      await AuditLogService.logAction({
        userId: currentUser.uid,
        facilityId,
        action: AuditLogAction.CREATE,
        resourceType: 'backup',
        resourceId: (result.data as any).backupId,
        details: {
          statistics: (result.data as any).statistics,
        },
        deviceInfo: {
          ipAddress: null,
          userAgent: navigator.userAgent,
        },
        result: 'success',
      });

      addToast('バックアップが完了しました', 'success');
      loadBackups(); // 一覧を再読み込み
    } catch (error) {
      console.error('Backup failed:', error);
      addToast(
        `バックアップに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`,
        'error'
      );

      // エラー監査ログ記録
      await AuditLogService.logAction({
        userId: currentUser.uid,
        facilityId,
        action: AuditLogAction.CREATE,
        resourceType: 'backup',
        resourceId: null,
        details: {},
        deviceInfo: {
          ipAddress: null,
          userAgent: navigator.userAgent,
        },
        result: 'failure',
        errorMessage: error instanceof Error ? error.message : '不明なエラー',
      });
    } finally {
      setBackingUp(false);
    }
  };

  // リストアを実行（super-adminのみ）
  const handleRestore = async (backup: BackupMetadata) => {
    if (facilityRole !== 'super-admin') {
      addToast('リストア権限がありません（super-adminのみ）', 'error');
      return;
    }

    const confirmed = window.confirm(
      `バックアップからデータを復元しますか？\n\n` +
      `バックアップ日時: ${new Date(backup.createdAt).toLocaleString('ja-JP')}\n` +
      `※ 既存データは上書きされます。この操作は取り消せません。`
    );

    if (!confirmed) return;

    try {
      setRestoring(true);

      const restoreFunction = httpsCallable(functions, 'restoreFacilityData');
      const storageUrl = `gs://${storage.app.options.storageBucket}/backups/${backup.facilityId}/${backup.filename}`;

      const result = await restoreFunction({
        facilityId: backup.facilityId,
        backupId: backup.backupId,
        storageUrl,
      });

      // 監査ログ記録
      await AuditLogService.logAction({
        userId: currentUser!.uid,
        facilityId: backup.facilityId,
        action: AuditLogAction.UPDATE,
        resourceType: 'backup',
        resourceId: backup.backupId,
        details: {
          restored: (result.data as any).restored,
        },
        deviceInfo: {
          ipAddress: null,
          userAgent: navigator.userAgent,
        },
        result: 'success',
      });

      addToast('データの復元が完了しました', 'success');
    } catch (error) {
      console.error('Restore failed:', error);
      addToast(
        `リストアに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`,
        'error'
      );

      // エラー監査ログ記録
      await AuditLogService.logAction({
        userId: currentUser!.uid,
        facilityId: backup.facilityId,
        action: AuditLogAction.UPDATE,
        resourceType: 'backup',
        resourceId: backup.backupId,
        details: {},
        deviceInfo: {
          ipAddress: null,
          userAgent: navigator.userAgent,
        },
        result: 'failure',
        errorMessage: error instanceof Error ? error.message : '不明なエラー',
      });
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">バックアップ管理</h1>

      {/* 手動バックアップボタン */}
      <div className="mb-6">
        <Button
          onClick={handleBackup}
          disabled={backingUp || loading}
          variant="primary"
        >
          {backingUp ? 'バックアップ中...' : '今すぐバックアップ'}
        </Button>
      </div>

      {/* バックアップ一覧 */}
      <div className="bg-white shadow-sm rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold">バックアップ履歴</h2>
        </div>

        {loading ? (
          <div className="p-6 text-center">読み込み中...</div>
        ) : backups.length === 0 ? (
          <div className="p-6 text-center text-gray-500">バックアップがありません</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    日時
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    種別
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    サイズ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    作成者
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {backups.map((backup) => (
                  <tr key={backup.backupId}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(backup.createdAt).toLocaleString('ja-JP')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {backup.type === 'manual' ? '手動' : '自動'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatBytes(backup.size)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {backup.createdBy === 'system' ? 'システム' : backup.createdBy}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {facilityRole === 'super-admin' && (
                        <button
                          onClick={() => handleRestore(backup)}
                          disabled={restoring}
                          className="text-indigo-600 hover:text-indigo-900 mr-4"
                        >
                          復元
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ヘルパー関数
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
```

---

## 🧪 テスト計画

### 1. Cloud Functions ユニットテスト

#### 1.1 `backupFacilityData`

```typescript
// tests/functions/backupFacilityData.test.ts
describe('backupFacilityData', () => {
  test('正常系: admin権限でバックアップ成功', async () => {
    // モックデータをセットアップ
    // 関数を呼び出し
    // Cloud Storageにファイルが保存されたことを確認
  });

  test('異常系: 認証なしでエラー', async () => {
    // 認証なしで呼び出し
    // エラーがスローされることを確認
  });

  test('異常系: viewer権限でエラー', async () => {
    // viewer権限で呼び出し
    // 権限エラーがスローされることを確認
  });
});
```

#### 1.2 `restoreFacilityData`

```typescript
// tests/functions/restoreFacilityData.test.ts
describe('restoreFacilityData', () => {
  test('正常系: super-admin権限でリストア成功', async () => {
    // バックアップファイルをモック
    // 関数を呼び出し
    // Firestoreにデータが復元されたことを確認
  });

  test('異常系: admin権限でエラー', async () => {
    // admin権限で呼び出し
    // 権限エラーがスローされることを確認
  });
});
```

### 2. E2Eテスト

```typescript
// tests/e2e/backup.spec.ts
test('バックアップ管理画面: 手動バックアップ実行', async ({ page }) => {
  // 1. ログイン（admin）
  // 2. バックアップ管理画面に移動
  // 3. 「今すぐバックアップ」ボタンをクリック
  // 4. バックアップ完了のトースト表示を確認
  // 5. バックアップ履歴に新しいバックアップが追加されたことを確認
});

test('バックアップ管理画面: リストア実行（super-admin）', async ({ page }) => {
  // 1. ログイン（super-admin）
  // 2. バックアップ管理画面に移動
  // 3. 最新のバックアップの「復元」ボタンをクリック
  // 4. 確認ダイアログで「OK」をクリック
  // 5. リストア完了のトースト表示を確認
});
```

---

## 📊 影響分析

### バンドルサイズ

| ファイル | 推定サイズ |
|---------|----------|
| backupFacilityData.ts | 5KB |
| restoreFacilityData.ts | 5KB |
| scheduledBackup.ts | 6KB |
| BackupManagement.tsx | 8KB |
| **合計** | **24KB** |

**結論**: 影響は軽微

### パフォーマンス

| 操作 | 推定時間 |
|------|---------|
| 手動バックアップ（中規模施設） | 5-10秒 |
| リストア（中規模施設） | 10-20秒 |
| 定期バックアップ（全施設） | 施設数 × 10秒 |

**結論**: 許容範囲内

### コスト試算（月額）

| 項目 | 使用量 | 単価 | 月額 |
|------|--------|------|------|
| Cloud Storage | 10施設 × 30日 × 200KB | $0.026/GB | ~$0.02 |
| Cloud Functions（定期バックアップ） | 30回/月 × 10秒 | $0.40/million invocations | ~$0.001 |
| Cloud Scheduler | 1ジョブ | $0.10/ジョブ | $0.10 |
| **合計** | - | - | **~$0.12/月** |

**結論**: ほぼ無視できるコスト

---

## ⚠️ リスクと対策

### リスク1: バックアップファイルの肥大化

**影響**: ストレージコスト増加、バックアップ・リストア時間の増加

**対策**:
- 定期バックアップは30日間のみ保持（自動削除）
- 手動バックアップは管理者が定期的に削除
- 将来的には圧縮機能の追加を検討

### リスク2: リストア時の既存データ上書き

**影響**: 誤操作による最新データの喪失

**対策**:
- super-adminのみがリストア可能
- リストア前に確認ダイアログを2回表示（実装時に追加）
- リストア前に自動バックアップを作成（実装時に追加）
- 監査ログへの記録

### リスク3: 定期バックアップの失敗

**影響**: データ保護機能の欠如

**対策**:
- Cloud Schedulerのリトライ機能（3回）
- 失敗時のログ記録
- 将来的には失敗通知メール送信を検討

### リスク4: スキーマ変更時の互換性

**影響**: 古いバックアップが復元できない

**対策**:
- スキーマバージョン管理（現在: "1.0.0"）
- リストア時のバージョンチェック
- マイグレーション関数の実装（将来）

---

## 📝 実装チェックリスト

### Phase 1: Cloud Functions実装

- [ ] `functions/package.json` に `uuid` パッケージ追加
- [ ] `functions/src/backupFacilityData.ts` 作成
- [ ] `functions/src/restoreFacilityData.ts` 作成
- [ ] `functions/src/scheduledBackup.ts` 作成
- [ ] `functions/src/index.ts` にエクスポート追加
- [ ] ビルドテスト: `npm run build` (functions/)

### Phase 2: Firebase Storage設定

- [ ] `storage.rules` 更新（バックアップパスのセキュリティルール）
- [ ] Cloud Schedulerジョブ作成（GCPコンソールまたはgcloud CLI）
  ```bash
  gcloud scheduler jobs create http scheduled-backup \
    --schedule="0 17 * * *" \
    --uri="https://us-central1-{project-id}.cloudfunctions.net/scheduledBackup" \
    --http-method=POST \
    --time-zone="UTC"
  ```

### Phase 3: フロントエンド実装

- [ ] `src/pages/admin/BackupManagement.tsx` 作成
- [ ] ルーティング追加（AdminLayoutに統合）
- [ ] ナビゲーションメニューに「バックアップ管理」追加

### Phase 4: テスト

- [ ] Cloud Functionsユニットテスト作成
- [ ] E2Eテスト作成
- [ ] 手動テスト（ブラウザ）
  - [ ] 手動バックアップ実行
  - [ ] バックアップ履歴表示
  - [ ] リストア実行（super-admin）
  - [ ] 権限チェック（viewer/editorでリストア不可）

### Phase 5: デプロイとレビュー

- [ ] ビルドテスト: `npm run build`
- [ ] 型チェック: `npm run type-check`
- [ ] CodeRabbitレビュー
- [ ] コミット・プッシュ
- [ ] GitHub Actions CI/CD確認
- [ ] 本番環境でスモークテスト

### Phase 6: ドキュメント

- [ ] Phase 19.3.2完了レポート作成
- [ ] 運用ドキュメント作成（バックアップ・リストアの手順書）

---

## 🔗 関連ドキュメント

- [Phase 19 マスタープラン](./phase19-plan-2025-11-13.md)
- [Phase 19.3.1 完了レポート](./phase19.3.1-completion-report-2025-11-13.md)
- [Firebase Storage Documentation](https://firebase.google.com/docs/storage)
- [Cloud Scheduler Documentation](https://cloud.google.com/scheduler/docs)

---

## 📌 まとめ

Phase 19.3.2では、エンタープライズグレードのバックアップ・リストア機能を実装します。Cloud Functions、Cloud Storage、Cloud Schedulerを統合し、手動・自動の両方でデータ保護を実現します。

**推定工数**: 4-5時間

**次のステップ**: Phase 19.3.3（エクスポート・バックアップUI統合）

---

**作成者**: Claude Code
**レビュー**: 未実施
**承認**: 未実施
