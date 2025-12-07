/**
 * LockStatusModal - ロック競合時モーダル
 *
 * Phase 43: 排他制御
 * - 他のユーザーが操作中であることを通知
 * - 残り待機時間の目安を表示
 */

import React from 'react';
import { LockInfo, LockService, OPERATION_LABELS } from '../services/lockService';

interface LockStatusModalProps {
  /** モーダル表示状態 */
  isOpen: boolean;
  /** ロック情報 */
  lockInfo: LockInfo | null;
  /** モーダルを閉じる */
  onClose: () => void;
}

/**
 * ロック競合時モーダルコンポーネント
 *
 * 他のユーザーが操作中の場合に表示し、
 * 待機時間の目安を提供する
 */
export function LockStatusModal({
  isOpen,
  lockInfo,
  onClose,
}: LockStatusModalProps) {
  if (!isOpen || !lockInfo) return null;

  const remainingMinutes = LockService.getRemainingMinutes(lockInfo);
  const operationLabel = OPERATION_LABELS[lockInfo.operation];

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lock-modal-title"
    >
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <h3
          id="lock-modal-title"
          className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2"
        >
          <span aria-hidden="true">🔒</span>
          他のユーザーが操作中です
        </h3>
        <p className="text-slate-600 mb-4">
          現在、別のユーザーが{operationLabel}を実行中です。
          <br />
          <span className="font-medium">
            約{remainingMinutes}分後
          </span>
          に操作可能になります。
        </p>
        {lockInfo.lockedByEmail && (
          <p className="text-sm text-slate-500 mb-4">
            操作中のユーザー: {lockInfo.lockedByEmail}
          </p>
        )}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400"
            autoFocus
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

export default LockStatusModal;
