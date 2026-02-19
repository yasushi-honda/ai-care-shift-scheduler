import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  writeBatch,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  Timestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { AppNotification, NotificationSettings, NotificationError, Result } from '../../types';

/**
 * 通知サービス
 * Phase 63: 通知センターUI + シフト確定通知
 */
export const NotificationService = {
  /**
   * ユーザーへの通知をリアルタイム購読
   *
   * @param facilityId 施設ID
   * @param userId 購読対象のユーザーID
   * @param callback 通知リストが更新されたときに呼ばれるコールバック
   * @returns リスナー解除関数
   */
  subscribeToNotifications(
    facilityId: string,
    userId: string,
    callback: (notifications: AppNotification[], error?: Error) => void
  ): Unsubscribe {
    if (!facilityId || !userId) {
      callback([], new Error('施設IDとユーザーIDは必須です'));
      return () => {};
    }

    const notificationsRef = collection(db, `facilities/${facilityId}/notifications`);
    const q = query(
      notificationsRef,
      where('recipientIds', 'array-contains', userId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const notifications: AppNotification[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            facilityId: data.facilityId,
            type: data.type,
            title: data.title,
            body: data.body,
            recipientIds: data.recipientIds ?? [],
            readBy: data.readBy ?? [],
            metadata: data.metadata ?? {},
            createdAt: data.createdAt,
          } as AppNotification;
        });
        callback(notifications);
      },
      (error) => {
        console.error('Failed to subscribe to notifications:', error);
        callback([], error as Error);
      }
    );

    return unsubscribe;
  },

  /**
   * 通知を既読にする
   */
  async markAsRead(
    facilityId: string,
    notificationId: string,
    userId: string
  ): Promise<Result<void, NotificationError>> {
    try {
      const notifRef = doc(db, `facilities/${facilityId}/notifications/${notificationId}`);
      await updateDoc(notifRef, {
        readBy: arrayUnion(userId),
      });
      return { success: true, data: undefined };
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      return {
        success: false,
        error: { code: 'FIRESTORE_ERROR', message: '既読更新に失敗しました' },
      };
    }
  },

  /**
   * 全通知を既読にする
   */
  async markAllAsRead(
    facilityId: string,
    userId: string,
    notificationIds: string[]
  ): Promise<Result<void, NotificationError>> {
    if (notificationIds.length === 0) {
      return { success: true, data: undefined };
    }

    try {
      const batch = writeBatch(db);
      for (const notifId of notificationIds) {
        const notifRef = doc(db, `facilities/${facilityId}/notifications/${notifId}`);
        batch.update(notifRef, { readBy: arrayUnion(userId) });
      }
      await batch.commit();
      return { success: true, data: undefined };
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      return {
        success: false,
        error: { code: 'FIRESTORE_ERROR', message: '全件既読更新に失敗しました' },
      };
    }
  },

  /**
   * 通知設定を取得する
   */
  async getNotificationSettings(
    userId: string
  ): Promise<Result<NotificationSettings, NotificationError>> {
    try {
      const settingsRef = doc(db, `users/${userId}/notificationSettings/default`);
      const settingsSnap = await getDoc(settingsRef);

      if (!settingsSnap.exists()) {
        // デフォルト設定を返す
        const defaultSettings: NotificationSettings = {
          enabledTypes: { schedule_confirmed: true },
          updatedAt: Timestamp.now(),
        };
        return { success: true, data: defaultSettings };
      }

      return { success: true, data: settingsSnap.data() as NotificationSettings };
    } catch (error) {
      console.error('Failed to get notification settings:', error);
      return {
        success: false,
        error: { code: 'FIRESTORE_ERROR', message: '通知設定の取得に失敗しました' },
      };
    }
  },

  /**
   * 通知設定を更新する
   */
  async updateNotificationSettings(
    userId: string,
    settings: Partial<NotificationSettings['enabledTypes']>
  ): Promise<Result<void, NotificationError>> {
    try {
      const settingsRef = doc(db, `users/${userId}/notificationSettings/default`);
      await setDoc(
        settingsRef,
        {
          enabledTypes: settings,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      return { success: true, data: undefined };
    } catch (error) {
      console.error('Failed to update notification settings:', error);
      return {
        success: false,
        error: { code: 'FIRESTORE_ERROR', message: '通知設定の更新に失敗しました' },
      };
    }
  },
};
