import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { AppNotification, NotificationSettings } from '../../types';
import { NotificationService } from '../services/notificationService';
import { useAuth } from './AuthContext';

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  settings: NotificationSettings | null;
  updateSettings: (settings: Partial<NotificationSettings['enabledTypes']>) => Promise<void>;
  loading: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

/**
 * NotificationProvider
 * Phase 63: 通知センターUIのContextプロバイダー
 */
export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, selectedFacilityId } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // 施設またはユーザーが変わったら購読を切り替える
  useEffect(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    if (!currentUser || !selectedFacilityId) {
      setNotifications([]);
      return;
    }

    setLoading(true);
    const userId = currentUser.uid;

    const unsubscribe = NotificationService.subscribeToNotifications(
      selectedFacilityId,
      userId,
      (notifs, error) => {
        setLoading(false);
        if (error) {
          console.error('通知の購読エラー:', error);
          return;
        }
        setNotifications(notifs);
      }
    );

    unsubscribeRef.current = unsubscribe;

    // 通知設定を取得
    NotificationService.getNotificationSettings(userId).then((result) => {
      if (result.success) {
        setSettings(result.data);
      }
    });

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [currentUser, selectedFacilityId]);

  const unreadCount = notifications.filter(
    (n) => currentUser && !n.readBy.includes(currentUser.uid)
  ).length;

  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!currentUser || !selectedFacilityId) return;
      await NotificationService.markAsRead(selectedFacilityId, notificationId, currentUser.uid);
    },
    [currentUser, selectedFacilityId]
  );

  const markAllAsRead = useCallback(async () => {
    if (!currentUser || !selectedFacilityId) return;
    const unreadIds = notifications
      .filter((n) => !n.readBy.includes(currentUser.uid))
      .map((n) => n.id);
    if (unreadIds.length === 0) return;
    await NotificationService.markAllAsRead(selectedFacilityId, currentUser.uid, unreadIds);
  }, [currentUser, selectedFacilityId, notifications]);

  const updateSettings = useCallback(
    async (newSettings: Partial<NotificationSettings['enabledTypes']>) => {
      if (!currentUser) return;
      const result = await NotificationService.updateNotificationSettings(
        currentUser.uid,
        newSettings
      );
      if (result.success) {
        setSettings((prev) =>
          prev
            ? { ...prev, enabledTypes: { ...prev.enabledTypes, ...newSettings } }
            : null
        );
      }
    },
    [currentUser]
  );

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    settings,
    updateSettings,
    loading,
  };

  return (
    <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
  );
};

/**
 * NotificationContextを使用するカスタムフック
 */
export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
