import React from 'react';
import { AppNotification } from '../../types';

interface NotificationItemProps {
  notification: AppNotification;
  currentUserId: string;
  onClick: (notification: AppNotification) => void;
}

/**
 * 相対時刻を計算して返す
 */
function getRelativeTime(timestamp: { toDate?: () => Date; seconds?: number } | null | undefined): string {
  if (!timestamp) return '';

  let date: Date;
  if (typeof (timestamp as any).toDate === 'function') {
    date = (timestamp as any).toDate();
  } else if (typeof (timestamp as any).seconds === 'number') {
    date = new Date((timestamp as any).seconds * 1000);
  } else {
    return '';
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'たった今';
  if (diffMin < 60) return `${diffMin}分前`;
  if (diffHour < 24) return `${diffHour}時間前`;
  if (diffDay < 7) return `${diffDay}日前`;

  return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
}

/**
 * 通知タイプに応じたアイコンを返す
 */
function NotificationTypeIcon({ type }: { type: AppNotification['type'] }) {
  if (type === 'schedule_confirmed') {
    return (
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
        <svg
          className="w-4 h-4 text-green-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
    );
  }
  return (
    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
      <svg
        className="w-4 h-4 text-blue-600"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    </div>
  );
}

/**
 * 個別通知アイテム
 * Phase 63: 未読ドット、相対時刻、クリックでナビゲート
 */
export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  currentUserId,
  onClick,
}) => {
  const isRead = notification.readBy.includes(currentUserId);
  const relativeTime = getRelativeTime(notification.createdAt);

  return (
    <button
      className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 ${
        !isRead ? 'bg-indigo-50/40' : 'bg-white'
      }`}
      onClick={() => onClick(notification)}
      aria-label={`${notification.title}${!isRead ? '（未読）' : ''}`}
    >
      {/* タイプアイコン */}
      <NotificationTypeIcon type={notification.type} />

      {/* コンテンツ */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p
            className={`text-sm leading-snug ${
              !isRead ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'
            }`}
          >
            {notification.title}
          </p>
          {/* 未読ドット */}
          {!isRead && (
            <span className="flex-shrink-0 mt-1 w-2 h-2 rounded-full bg-indigo-500" />
          )}
        </div>
        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{notification.body}</p>
        {relativeTime && (
          <p className="text-xs text-slate-400 mt-1">{relativeTime}</p>
        )}
      </div>
    </button>
  );
};
