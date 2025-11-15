import React, { useState } from 'react';
import { createInvitation } from '../services/invitationService';
import { handleError } from '../utils/errorHandler';
import { useAuth } from '../contexts/AuthContext';
import { assertResultError } from '../../types';

interface InvitationModalProps {
  facilityId: string;
  facilityName: string;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * InvitationModal
 *
 * Phase 22: 招待送信UI実装
 * - メールアドレス入力フィールド
 * - ロール選択ドロップダウン（editor/viewer）
 * - 招待送信ボタン
 * - 招待リンク表示・コピー機能
 */
export default function InvitationModal({
  facilityId,
  facilityName,
  isOpen,
  onClose,
}: InvitationModalProps): React.ReactElement | null {
  const { currentUser } = useAuth();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('viewer');
  const [loading, setLoading] = useState(false);
  const [invitationLink, setInvitationLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!currentUser) {
      setError('ログインが必要です');
      setLoading(false);
      return;
    }

    try {
      // createInvitation関数は4つの引数を取る: facilityId, email, role, createdBy
      const result = await createInvitation(
        facilityId,
        email,
        role,
        currentUser.uid
      );

      if (!result.success) {
        assertResultError(result);
        const errorMsg = handleError(result.error, '招待の作成');
        setError(errorMsg.message);
        setLoading(false);
        return;
      }

      // 招待リンクは result.data.invitationLink に含まれている
      setInvitationLink(result.data.invitationLink);
      setLoading(false);
    } catch (err) {
      const errorMsg = handleError(err, '招待の作成');
      setError(errorMsg.message);
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (invitationLink) {
      await navigator.clipboard.writeText(invitationLink);
      // トーストメッセージは省略（オプション機能）
    }
  };

  const handleClose = () => {
    setEmail('');
    setRole('viewer');
    setInvitationLink(null);
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">メンバーを招待</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="閉じる"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          {facilityName}へのメンバーを招待します
        </p>

        {!invitationLink ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* メールアドレス入力 */}
            <div>
              <label htmlFor="invite-email-input" className="block text-sm font-medium text-gray-700 mb-1">
                メールアドレス
              </label>
              <input
                type="email"
                id="invite-email-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="user@example.com"
              />
            </div>

            {/* ロール選択 */}
            <div>
              <label htmlFor="invite-role-select" className="block text-sm font-medium text-gray-700 mb-1">
                権限
              </label>
              <select
                id="invite-role-select"
                value={role}
                onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="viewer">閲覧者（閲覧のみ）</option>
                <option value="editor">編集者（シフト編集可能）</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {role === 'viewer'
                  ? 'スケジュールやスタッフ情報の閲覧のみ可能'
                  : 'スケジュールの作成・編集が可能'}
              </p>
            </div>

            {/* エラー表示 */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* ボタン */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '送信中...' : '招待を作成'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            {/* 成功メッセージ */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-900">招待リンクを作成しました</p>
                  <p className="text-xs text-green-700 mt-1">
                    以下のリンクを {email} に送信してください
                  </p>
                </div>
              </div>
            </div>

            {/* リンク表示 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                招待リンク
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={invitationLink}
                  readOnly
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap"
                >
                  コピー
                </button>
              </div>
            </div>

            {/* 閉じるボタン */}
            <button
              onClick={handleClose}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              閉じる
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
