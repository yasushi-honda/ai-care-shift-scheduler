import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { NotificationItem } from './NotificationItem';
import { NotificationSettingsModal } from './NotificationSettingsModal';
import { AppNotification } from '../../types';

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 右スライドイン通知パネル
 * Phase 63: 通知一覧・既読管理・設定
 */
export const NotificationPanel: React.FC<NotificationPanelProps> = ({ isOpen, onClose }) => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, loading } = useNotifications();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // パネル外クリックで閉じる
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleNotificationClick = async (notification: AppNotification) => {
    if (!currentUser) return;

    // 既読にする
    await markAsRead(notification.id);

    // 対象月へのナビゲート
    if (notification.metadata.targetMonth) {
      // URLのクエリパラメータで月を指定（メインページへ）
      navigate(`/?month=${notification.metadata.targetMonth}`);
    }

    onClose();
  };

  if (!isOpen && !settingsOpen) return null;

  return (
    <>
      {/* オーバーレイ */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* スライドインパネル */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="通知"
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-sm bg-white shadow-2xl flex flex-col transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900">通知</h2>
            {unreadCount > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                {unreadCount}件未読
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {/* 設定ボタン */}
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="通知設定"
              title="通知設定"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
            {/* 閉じるボタン */}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="閉じる"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* 全て既読ボタン */}
        {unreadCount > 0 && (
          <div className="px-4 py-2 border-b border-slate-100 bg-slate-50">
            <button
              onClick={markAllAsRead}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
            >
              すべて既読にする
            </button>
          </div>
        )}

        {/* 通知リスト */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <svg
                className="w-5 h-5 animate-spin mr-2"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="text-sm">読み込み中...</span>
            </div>
          )}

          {!loading && notifications.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <svg
                className="w-12 h-12 text-slate-300 mb-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              <p className="text-sm text-slate-500">通知はありません</p>
            </div>
          )}

          {!loading &&
            notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                currentUserId={currentUser?.uid ?? ''}
                onClick={handleNotificationClick}
              />
            ))}
        </div>
      </div>

      {/* 設定モーダル */}
      <NotificationSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  );
};
