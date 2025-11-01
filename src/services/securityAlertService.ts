import {
  collection,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  getDocs,
  QueryConstraint,
  getDoc,
} from 'firebase/firestore';
import { db, auth } from '../../firebase';
import {
  SecurityAlert,
  SecurityAlertType,
  SecurityAlertSeverity,
  SecurityAlertStatus,
  SecurityAlertError,
  Result,
} from '../../types';

/**
 * SecurityAlertService
 *
 * セキュリティアラートの作成・管理を行うサービス
 * Firestoreパス: /securityAlerts/{alertId}
 *
 * Phase 13.3の機能:
 * - 不審なアクセスパターンの検出時にアラートを自動生成
 * - 管理者によるアラートステータス管理（確認、調査中、解決、誤検知）
 * - アラート一覧の取得とフィルタリング
 */
export const SecurityAlertService = {
  /**
   * セキュリティアラートを作成
   *
   * @param params アラートパラメータ
   * @returns 作成されたアラートIDまたはエラー
   */
  async createAlert(params: {
    type: SecurityAlertType;
    severity: SecurityAlertSeverity;
    userId: string | null;
    facilityId: string | null;
    title: string;
    description: string;
    metadata: Record<string, unknown>;
  }): Promise<Result<string, SecurityAlertError>> {
    try {
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

      // バリデーション
      if (!params.title || params.title.trim() === '') {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'タイトルは必須です',
          },
        };
      }

      // アラートデータを作成
      const alertData = {
        type: params.type,
        severity: params.severity,
        status: SecurityAlertStatus.NEW,
        userId: params.userId,
        facilityId: params.facilityId,
        title: params.title,
        description: params.description,
        metadata: params.metadata,
        detectedAt: serverTimestamp(),
        acknowledgedBy: null,
        acknowledgedAt: null,
        resolvedBy: null,
        resolvedAt: null,
        notes: null,
      };

      // Firestoreに保存
      const docRef = await addDoc(collection(db, 'securityAlerts'), alertData);

      return {
        success: true,
        data: docRef.id,
      };
    } catch (error) {
      console.error('Failed to create security alert:', error);
      return {
        success: false,
        error: {
          code: 'FIRESTORE_ERROR',
          message:
            error instanceof Error
              ? error.message
              : 'セキュリティアラートの作成に失敗しました',
        },
      };
    }
  },

  /**
   * セキュリティアラート一覧を取得
   *
   * @param filters フィルター条件
   * @returns アラートリストまたはエラー
   */
  async getAlerts(filters: {
    status?: SecurityAlertStatus;
    type?: SecurityAlertType;
    severity?: SecurityAlertSeverity;
    userId?: string;
    facilityId?: string | null;
    limit?: number;
  }): Promise<Result<SecurityAlert[], SecurityAlertError>> {
    try {
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

      const constraints: QueryConstraint[] = [];

      // フィルター条件を構築
      if (filters.status) {
        constraints.push(where('status', '==', filters.status));
      }

      if (filters.type) {
        constraints.push(where('type', '==', filters.type));
      }

      if (filters.severity) {
        constraints.push(where('severity', '==', filters.severity));
      }

      if (filters.userId) {
        constraints.push(where('userId', '==', filters.userId));
      }

      if (filters.facilityId !== undefined) {
        constraints.push(where('facilityId', '==', filters.facilityId));
      }

      // 検出日時で降順ソート（最新が先）
      constraints.push(orderBy('detectedAt', 'desc'));

      // 件数制限
      if (filters.limit) {
        constraints.push(firestoreLimit(filters.limit));
      }

      const q = query(collection(db, 'securityAlerts'), ...constraints);
      const snapshot = await getDocs(q);

      const alerts: SecurityAlert[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          type: data.type as SecurityAlertType,
          severity: data.severity as SecurityAlertSeverity,
          status: data.status as SecurityAlertStatus,
          userId: data.userId,
          facilityId: data.facilityId,
          title: data.title,
          description: data.description,
          metadata: data.metadata || {},
          detectedAt: data.detectedAt,
          acknowledgedBy: data.acknowledgedBy,
          acknowledgedAt: data.acknowledgedAt,
          resolvedBy: data.resolvedBy,
          resolvedAt: data.resolvedAt,
          notes: data.notes,
        } as SecurityAlert;
      });

      return {
        success: true,
        data: alerts,
      };
    } catch (error) {
      console.error('Failed to get security alerts:', error);
      return {
        success: false,
        error: {
          code: 'FIRESTORE_ERROR',
          message:
            error instanceof Error
              ? error.message
              : 'セキュリティアラートの取得に失敗しました',
        },
      };
    }
  },

  /**
   * アラートステータスを更新
   *
   * @param alertId アラートID
   * @param status 新しいステータス
   * @param notes メモ（オプション）
   * @returns 成功またはエラー
   */
  async updateAlertStatus(
    alertId: string,
    status: SecurityAlertStatus,
    notes?: string
  ): Promise<Result<void, SecurityAlertError>> {
    try {
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

      const alertRef = doc(db, 'securityAlerts', alertId);
      const alertSnap = await getDoc(alertRef);

      if (!alertSnap.exists()) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'アラートが見つかりません',
          },
        };
      }

      const updateData: Record<string, unknown> = {
        status,
      };

      // ステータスに応じてタイムスタンプを更新
      if (status === SecurityAlertStatus.ACKNOWLEDGED) {
        updateData.acknowledgedBy = currentUser.uid;
        updateData.acknowledgedAt = serverTimestamp();
      } else if (
        status === SecurityAlertStatus.RESOLVED ||
        status === SecurityAlertStatus.FALSE_POSITIVE
      ) {
        updateData.resolvedBy = currentUser.uid;
        updateData.resolvedAt = serverTimestamp();
      }

      // メモが提供された場合は更新
      if (notes !== undefined) {
        updateData.notes = notes;
      }

      await updateDoc(alertRef, updateData);

      return {
        success: true,
        data: undefined,
      };
    } catch (error) {
      console.error('Failed to update alert status:', error);
      return {
        success: false,
        error: {
          code: 'FIRESTORE_ERROR',
          message:
            error instanceof Error
              ? error.message
              : 'アラートステータスの更新に失敗しました',
        },
      };
    }
  },

  /**
   * アラートにメモを追加
   *
   * @param alertId アラートID
   * @param notes メモ内容
   * @returns 成功またはエラー
   */
  async addNotes(
    alertId: string,
    notes: string
  ): Promise<Result<void, SecurityAlertError>> {
    try {
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

      const alertRef = doc(db, 'securityAlerts', alertId);
      await updateDoc(alertRef, { notes });

      return {
        success: true,
        data: undefined,
      };
    } catch (error) {
      console.error('Failed to add notes to alert:', error);
      return {
        success: false,
        error: {
          code: 'FIRESTORE_ERROR',
          message:
            error instanceof Error ? error.message : 'メモの追加に失敗しました',
        },
      };
    }
  },
};
