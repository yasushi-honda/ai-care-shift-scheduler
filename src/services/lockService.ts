/**
 * LockService - 排他制御サービス
 *
 * 同一シフト（施設・月）への同時操作を防止
 * シフト自動生成・保存処理時にロックを取得
 * タイムアウトによる自動解放
 */

import {
  doc,
  getDoc,
  deleteDoc,
  Timestamp,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../../firebase';

export type LockOperation = 'shift-generation' | 'saving';

export interface LockInfo {
  lockedBy: string;
  lockedByEmail?: string;
  lockedAt: Timestamp;
  operation: LockOperation;
  expiresAt: Timestamp;
}

export interface LockResult {
  success: boolean;
  error?: string;
  existingLock?: LockInfo;
}

// タイムアウト設定（ミリ秒）
const LOCK_TIMEOUTS: Record<LockOperation, number> = {
  'shift-generation': 60 * 1000, // 1分（Solverは数秒で完了）
  'saving': 30 * 1000, // 30秒
};

// 操作名の日本語表示
export const OPERATION_LABELS: Record<LockOperation, string> = {
  'shift-generation': '自動生成',
  'saving': '保存処理',
};

export class LockService {
  /**
   * ロックを取得する
   *
   * トランザクションを使用して安全にロックを取得
   * - ロックが存在しない場合: 新規取得
   * - 自分のロックの場合: 更新
   * - 期限切れロックの場合: 上書き
   * - 他ユーザーのロックの場合: 失敗
   */
  static async acquireLock(
    facilityId: string,
    yearMonth: string,
    userId: string,
    operation: LockOperation,
    userEmail?: string
  ): Promise<LockResult> {
    const lockRef = doc(db, 'facilities', facilityId, 'locks', yearMonth);

    try {
      return await runTransaction(db, async (transaction) => {
        const lockDoc = await transaction.get(lockRef);
        const now = Timestamp.now();
        const expiresAt = Timestamp.fromMillis(
          now.toMillis() + LOCK_TIMEOUTS[operation]
        );

        if (lockDoc.exists()) {
          const existingLock = lockDoc.data() as LockInfo;

          // 自分のロックなら更新
          if (existingLock.lockedBy === userId) {
            const newLock: LockInfo = {
              lockedBy: userId,
              lockedByEmail: userEmail,
              lockedAt: now,
              operation,
              expiresAt,
            };
            transaction.set(lockRef, newLock);
            console.log('🔒 Lock updated (own lock):', { facilityId, yearMonth, operation });
            return { success: true };
          }

          // 期限切れなら上書き
          if (existingLock.expiresAt.toMillis() < now.toMillis()) {
            const newLock: LockInfo = {
              lockedBy: userId,
              lockedByEmail: userEmail,
              lockedAt: now,
              operation,
              expiresAt,
            };
            transaction.set(lockRef, newLock);
            console.log('🔒 Lock acquired (expired lock override):', { facilityId, yearMonth, operation });
            return { success: true };
          }

          // 他のユーザーがロック中
          console.log('🔒 Lock acquisition failed (locked by another user):', {
            facilityId,
            yearMonth,
            lockedBy: existingLock.lockedBy,
          });
          return {
            success: false,
            error: '他のユーザーが操作中です',
            existingLock,
          };
        }

        // ロックなし → 新規取得
        const newLock: LockInfo = {
          lockedBy: userId,
          lockedByEmail: userEmail,
          lockedAt: now,
          operation,
          expiresAt,
        };
        transaction.set(lockRef, newLock);
        console.log('🔒 Lock acquired (new):', { facilityId, yearMonth, operation });
        return { success: true };
      });
    } catch (error) {
      console.error('❌ Lock acquisition failed:', error);
      return {
        success: false,
        error: 'ロック取得に失敗しました',
      };
    }
  }

  /**
   * ロックを解放する
   *
   * 自分のロックのみ解放可能
   */
  static async releaseLock(
    facilityId: string,
    yearMonth: string,
    userId: string
  ): Promise<boolean> {
    const lockRef = doc(db, 'facilities', facilityId, 'locks', yearMonth);

    try {
      const lockDoc = await getDoc(lockRef);

      if (!lockDoc.exists()) {
        console.log('🔓 Lock already released (not found):', { facilityId, yearMonth });
        return true;
      }

      const lock = lockDoc.data() as LockInfo;

      if (lock.lockedBy !== userId) {
        console.warn('⚠️ Cannot release lock owned by another user:', {
          facilityId,
          yearMonth,
          lockedBy: lock.lockedBy,
          requestedBy: userId,
        });
        return false;
      }

      await deleteDoc(lockRef);
      console.log('🔓 Lock released:', { facilityId, yearMonth });
      return true;
    } catch (error) {
      console.error('❌ Lock release failed:', error);
      return false;
    }
  }

  /**
   * ロック状態を確認する
   *
   * 期限切れのロックはnullを返す
   */
  static async checkLock(
    facilityId: string,
    yearMonth: string
  ): Promise<LockInfo | null> {
    const lockRef = doc(db, 'facilities', facilityId, 'locks', yearMonth);

    try {
      const lockDoc = await getDoc(lockRef);

      if (!lockDoc.exists()) {
        return null;
      }

      const lock = lockDoc.data() as LockInfo;
      const now = Timestamp.now();

      // 期限切れなら無効
      if (lock.expiresAt.toMillis() < now.toMillis()) {
        console.log('🔒 Lock found but expired:', { facilityId, yearMonth });
        return null;
      }

      return lock;
    } catch (error) {
      console.error('❌ Lock check failed:', error);
      return null;
    }
  }

  /**
   * ロックの残り時間を計算する（秒）
   */
  static getRemainingSeconds(lockInfo: LockInfo): number {
    const now = Date.now();
    const expiresAt = lockInfo.expiresAt.toMillis();
    return Math.max(0, Math.ceil((expiresAt - now) / 1000));
  }

  /**
   * ロックの残り時間を分単位で取得
   */
  static getRemainingMinutes(lockInfo: LockInfo): number {
    return Math.ceil(this.getRemainingSeconds(lockInfo) / 60);
  }
}
