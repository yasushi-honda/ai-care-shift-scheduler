import React, { useState } from 'react';
import { useNotifications } from '../contexts/NotificationContext';
import { NotificationPanel } from './NotificationPanel';

/**
 * ベルアイコン + 未読バッジ
 * Phase 63: 通知センターUIのエントリーポイント
 */
export const NotificationBell: React.FC = () => {
  const { unreadCount } = useNotifications();
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setPanelOpen(true)}
          className="relative inline-flex items-center justify-center w-9 h-9 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
          aria-label={`通知${unreadCount > 0 ? `（未読${unreadCount}件）` : ''}`}
          title="通知"
        >
          {/* ベルアイコン */}
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>

          {/* 未読バッジ */}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold leading-none text-white bg-red-500 rounded-full">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* 通知パネル */}
      <NotificationPanel isOpen={panelOpen} onClose={() => setPanelOpen(false)} />
    </>
  );
};
