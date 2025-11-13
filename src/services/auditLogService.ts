import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  getDocs,
  QueryConstraint,
  startAfter,
  endBefore,
  limitToLast,
  getDoc,
  doc,
} from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { AuditLog, AuditLogAction, AuditLogError, Result } from '../../types';

/**
 * AuditLogService
 *
 * 監査ログの記録と取得を行うサービス
 * Firestoreパス: /auditLogs/{logId}
 *
 * **Phase 13.1の制限事項（一時的なクライアント側実装）:**
 * - デバイス情報（IPアドレス、ユーザーエージェント）はクライアント側で取得するため、スプーフィング可能
 * - 認証済みユーザーのみが自分のログを作成可能（他のユーザーのログは作成不可）
 * - Phase 13.2でCloud Functions経由の実装に移行予定
 *
 * **Phase 13.2で実装予定:**
 * - Cloud Functionsによるサーバー側ログ記録
 * - onCreate/onUpdate/onDeleteトリガーによる自動ログ記録
 * - サーバー側でのデバイス情報取得（request context経由）
 * - Firestore Rulesでクライアント側書き込みを禁止
 *
 * 特徴:
 * - すべての操作を不変ログとして記録
 * - 介護保険法に準拠した保存期間（最低5年）
 * - 改ざん防止（read-onlyアクセス）
 */
export const AuditLogService = {
  /**
   * 監査ログを記録
   *
   * @param params 監査ログパラメータ
   * @returns 作成されたログIDまたはエラー
   */
  async logAction(params: {
    userId: string;
    facilityId: string | null;
    action: AuditLogAction;
    resourceType: string;
    resourceId: string | null;
    details: Record<string, unknown>;
    deviceInfo: {
      ipAddress: string | null;
      userAgent: string | null;
    };
    result: 'success' | 'failure';
    errorMessage?: string;
  }): Promise<Result<string, AuditLogError>> {
    try {
      // セキュリティ: 認証ユーザーのuidを取得
      const currentUser = auth.currentUser;
      if (!currentUser) {
        return {
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: '認証が必要です',
          },
        };
      }

      // セキュリティ: ログのuserIdは現在の認証ユーザーと一致する必要がある
      // （他のユーザーのログを作成することを防止）
      if (params.userId !== currentUser.uid) {
        return {
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: '他のユーザーのログを作成することはできません',
          },
        };
      }

      // バリデーション
      if (!params.userId || params.userId.trim() === '') {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'userIdは必須です',
          },
        };
      }

      if (!params.resourceType || params.resourceType.trim() === '') {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'resourceTypeは必須です',
          },
        };
      }

      // 監査ログエントリを作成
      const auditLogData = {
        userId: params.userId,
        facilityId: params.facilityId,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        details: params.details,
        deviceInfo: params.deviceInfo,
        result: params.result,
        errorMessage: params.errorMessage || null,
        timestamp: serverTimestamp(),
      };

      // Firestoreに保存
      const docRef = await addDoc(collection(db, 'auditLogs'), auditLogData);

      return {
        success: true,
        data: docRef.id,
      };
    } catch (error) {
      console.error('Failed to log audit action:', error);
      return {
        success: false,
        error: {
          code: 'FIRESTORE_ERROR',
          message: error instanceof Error ? error.message : '監査ログの記録に失敗しました',
        },
      };
    }
  },

  /**
   * 監査ログを取得（ページネーション対応）
   *
   * @param filters フィルター条件
   * @param filters.startAfterId 前方ページネーション用のドキュメントID
   * @param filters.startBeforeId 後方ページネーション用のドキュメントID
   * @returns 監査ログリストまたはエラー
   */
  async getAuditLogs(filters: {
    facilityId?: string | null;
    userId?: string;
    action?: AuditLogAction;
    resourceType?: string;
    limit?: number;
    startAfterId?: string;
    startBeforeId?: string;
  }): Promise<Result<AuditLog[], AuditLogError>> {
    try {
      // パラメータバリデーション: startAfterIdとstartBeforeIdの同時指定を禁止
      if (filters.startAfterId && filters.startBeforeId) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'startAfterIdとstartBeforeIdは同時に指定できません',
          },
        };
      }

      const constraints: QueryConstraint[] = [];

      // フィルター条件を構築
      if (filters.facilityId !== undefined) {
        constraints.push(where('facilityId', '==', filters.facilityId));
      }

      if (filters.userId) {
        constraints.push(where('userId', '==', filters.userId));
      }

      if (filters.action) {
        constraints.push(where('action', '==', filters.action));
      }

      if (filters.resourceType) {
        constraints.push(where('resourceType', '==', filters.resourceType));
      }

      // タイムスタンプで降順ソート（最新が先）
      constraints.push(orderBy('timestamp', 'desc'));

      // IDベースのページネーション
      if (filters.startAfterId) {
        // 前方ページネーション: startAfterIdのドキュメントを取得してstartAfterで使用
        const startDoc = await getDoc(doc(db, 'auditLogs', filters.startAfterId));
        if (!startDoc.exists()) {
          return {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: '指定されたstartAfterIdのドキュメントが見つかりません',
            },
          };
        }
        constraints.push(startAfter(startDoc));
        constraints.push(firestoreLimit(filters.limit || 50));
      } else if (filters.startBeforeId) {
        // 後方ページネーション: startBeforeIdのドキュメントを取得してendBeforeで使用
        const startDoc = await getDoc(doc(db, 'auditLogs', filters.startBeforeId));
        if (!startDoc.exists()) {
          return {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: '指定されたstartBeforeIdのドキュメントが見つかりません',
            },
          };
        }
        constraints.push(endBefore(startDoc));
        constraints.push(limitToLast(filters.limit || 50));
      } else {
        // 初期ロード
        constraints.push(firestoreLimit(filters.limit || 50));
      }

      const q = query(collection(db, 'auditLogs'), ...constraints);
      const snapshot = await getDocs(q);

      // シリアライズ可能なデータのみを返す
      const logs: AuditLog[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data.userId,
          facilityId: data.facilityId,
          action: data.action as AuditLogAction,
          resourceType: data.resourceType,
          resourceId: data.resourceId,
          details: data.details || {},
          deviceInfo: data.deviceInfo || { ipAddress: null, userAgent: null },
          result: data.result as 'success' | 'failure',
          errorMessage: data.errorMessage,
          timestamp: data.timestamp,
        } as AuditLog;
      });

      return {
        success: true,
        data: logs,
      };
    } catch (error) {
      console.error('Failed to get audit logs:', error);
      return {
        success: false,
        error: {
          code: 'FIRESTORE_ERROR',
          message: error instanceof Error ? error.message : '監査ログの取得に失敗しました',
        },
      };
    }
  },
};
