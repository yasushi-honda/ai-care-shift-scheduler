import React, { useState } from 'react';
import { previewBorrowImpact } from '../utils/leaveBalanceUtils';

interface BorrowConfirmDialogProps {
  staffId: string;
  staffName: string;
  facilityId: string;
  yearMonth: string;
  currentBalance: number;
  nextYearMonth: string;
  onConfirm: (amount: number) => Promise<void>;
  onClose: () => void;
  currentUserId: string;
}

export const BorrowConfirmDialog: React.FC<BorrowConfirmDialogProps> = ({
  staffName,
  currentBalance,
  nextYearMonth,
  onConfirm,
  onClose,
}) => {
  const [amount, setAmount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = previewBorrowImpact(currentBalance, amount);

  const handleOverlayKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleAmountChange = (value: number) => {
    const clamped = Math.min(30, Math.max(1, value));
    setAmount(clamped);
    setError(null);
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await onConfirm(amount);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '前借り処理に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
      onKeyDown={handleOverlayKeyDown}
      role="presentation"
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="borrow-dialog-title"
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h3 id="borrow-dialog-title" className="text-lg font-bold text-slate-800">
            {staffName} の公休を前借りする
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
            aria-label="閉じる"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* 本文 */}
        <div className="p-4 space-y-4">
          {/* 現在の残高 */}
          <div className="flex items-center justify-between text-sm text-slate-700">
            <span>現在の残高</span>
            <span className="font-medium">{currentBalance}日</span>
          </div>

          {/* 前借り日数入力 */}
          <div className="flex items-center justify-between text-sm text-slate-700">
            <label htmlFor="borrow-amount" className="font-medium">
              前借り日数
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleAmountChange(amount - 1)}
                disabled={amount <= 1 || loading}
                className="w-7 h-7 flex items-center justify-center rounded border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="1日減らす"
              >
                −
              </button>
              <input
                id="borrow-amount"
                type="number"
                min={1}
                max={30}
                value={amount}
                onChange={(e) => handleAmountChange(Number(e.target.value))}
                disabled={loading}
                className="w-16 text-center border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-40"
              />
              <button
                type="button"
                onClick={() => handleAmountChange(amount + 1)}
                disabled={amount >= 30 || loading}
                className="w-7 h-7 flex items-center justify-center rounded border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="1日増やす"
              >
                ＋
              </button>
            </div>
          </div>

          {/* プレビュー */}
          <div className="border-t border-b border-slate-200 py-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">前借り後の残高</span>
              <span className="font-bold text-green-600">{preview.afterBorrowBalance}日</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">{nextYearMonth} への影響</span>
              <span className="font-bold text-red-600">
                {preview.nextMonthImpact}日
              </span>
            </div>
          </div>

          {/* エラー表示 */}
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="flex items-center justify-end gap-3 px-4 pb-4">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            autoFocus
            className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading && (
              <svg
                className="w-4 h-4 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
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
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
            )}
            前借りする
          </button>
        </div>
      </div>
    </div>
  );
};
