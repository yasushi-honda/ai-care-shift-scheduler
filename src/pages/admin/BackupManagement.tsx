import React, { useState, useEffect } from 'react';
import { ref, listAll, getMetadata } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { storage, functions } from '../../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { AuditLogService } from '../../services/auditLogService';
import { AuditLogAction } from '../../../types';

/**
 * Phase 19.3.2: バックアップ管理
 *
 * 機能:
 * - バックアップ一覧表示
 * - 手動バックアップ作成（admin/super-admin）
 * - データ復元（super-adminのみ）
 * - 監査ログ記録
 */

interface BackupMetadata {
  backupId: string;
  filename: string;
  facilityId: string;
  createdBy: string;
  createdAt: string;
  size: number;
  type: 'manual' | 'scheduled';
}

export function BackupManagement(): React.ReactElement {
  const { currentUser, userProfile } = useAuth();
  const { showSuccess, showError } = useToast();

  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // 現在のユーザーがsuper-adminかどうかを判定
  const isSuperAdmin = userProfile?.facilities?.some(f => f.role === 'super-admin') ?? false;

  // バックアップ一覧を取得
  useEffect(() => {
    loadBackups();
  }, []);

  const loadBackups = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);

      // facilityIdを取得（仮実装: 最初の施設を使用）
      const facilityId = userProfile?.facilities?.[0]?.facilityId;
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
          createdAt: metadata.customMetadata?.createdAt || metadata.timeCreated || '',
          size: metadata.size,
          type: (metadata.customMetadata?.type as 'manual' | 'scheduled') || 'manual',
        });
      }

      // 新しい順にソート
      backupList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setBackups(backupList);
    } catch (error) {
      console.error('Failed to load backups:', error);
      showError('バックアップ一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // 手動バックアップを実行
  const handleBackup = async () => {
    if (!currentUser) return;

    const facilityId = userProfile?.facilities?.[0]?.facilityId;
    if (!facilityId) {
      showError('施設情報が見つかりません');
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

      showSuccess('バックアップが完了しました');
      loadBackups(); // 一覧を再読み込み
    } catch (error) {
      console.error('Backup failed:', error);
      showError(
        `バックアップに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`
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
    if (!isSuperAdmin) {
      showError('リストア権限がありません（super-adminのみ）');
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

      showSuccess('データの復元が完了しました');
    } catch (error) {
      console.error('Restore failed:', error);
      showError(
        `リストアに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`
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
        <button
          onClick={handleBackup}
          disabled={backingUp || loading}
          className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {backingUp ? 'バックアップ中...' : '今すぐバックアップ'}
        </button>
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
                      {isSuperAdmin && (
                        <button
                          onClick={() => handleRestore(backup)}
                          disabled={restoring}
                          className="text-indigo-600 hover:text-indigo-900 disabled:opacity-50 disabled:cursor-not-allowed"
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
}

// ヘルパー関数
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
