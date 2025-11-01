import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { verifyInvitationToken, acceptInvitation } from '../services/invitationService';
import { useAuth } from '../contexts/AuthContext';
import { handleError } from '../utils/errorHandler';
import { assertResultError } from '../../types';

/**
 * InviteAccept
 *
 * 招待リンクからのアクセスを処理するページ
 * - トークンを検証
 * - ユーザーがログインしていない場合はログインを促す
 * - ユーザーがログイン後、自動的に招待を受け入れて施設へのアクセスを付与
 */
export function InviteAccept(): React.ReactElement {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser, signInWithGoogle } = useAuth();

  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<{ message: string; canRetry: boolean } | null>(null);
  const [invitationInfo, setInvitationInfo] = useState<{
    email: string;
    role: string;
    facilityId: string;
  } | null>(null);

  const token = searchParams.get('token');

  // トークンを検証
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setError({ message: '招待トークンが見つかりません', canRetry: false });
        setVerifying(false);
        setLoading(false);
        return;
      }

      const result = await verifyInvitationToken(token);

      if (!result.success) {
        assertResultError(result);
        // 招待固有のエラーメッセージをユーザーフレンドリーに変換
        let friendlyMessage = '';
        let canRetry = true;

        if (result.error.code === 'EXPIRED') {
          friendlyMessage = 'この招待リンクは有効期限が切れています。\n招待を送った方に新しいリンクの発行を依頼してください。';
          canRetry = false;
        } else if (result.error.code === 'ALREADY_ACCEPTED') {
          friendlyMessage = 'この招待は既に使用されています。\n新しい招待リンクが必要な場合は、招待を送った方にご連絡ください。';
          canRetry = false;
        } else if (result.error.code === 'NOT_FOUND') {
          friendlyMessage = 'この招待リンクは見つかりませんでした。\nリンクが正しいか確認してください。';
          canRetry = false;
        } else {
          const errorMsg = handleError(result.error, '招待の検証');
          friendlyMessage = errorMsg.message;
          canRetry = errorMsg.canRetry;
        }

        setError({ message: friendlyMessage, canRetry });
        setVerifying(false);
        setLoading(false);
        return;
      }

      const { invitation, facilityId } = result.data;

      setInvitationInfo({
        email: invitation.email,
        role: invitation.role,
        facilityId,
      });

      setVerifying(false);
      setLoading(false);
    };

    verifyToken();
  }, [token]);

  // ユーザーがログインしている場合、自動的に招待を受け入れる
  useEffect(() => {
    const acceptInvite = async () => {
      if (!currentUser || !token || verifying || accepting || !invitationInfo) {
        return;
      }

      // メールアドレスが一致するか確認
      if (
        currentUser.email?.toLowerCase() !== invitationInfo.email.toLowerCase()
      ) {
        setError({
          message: `この招待は ${invitationInfo.email} 宛です。現在ログインしているアカウント（${currentUser.email}）とは異なります。正しいアカウントでログインしてください。`,
          canRetry: false,
        });
        return;
      }

      setAccepting(true);

      const result = await acceptInvitation(
        token,
        currentUser.uid,
        currentUser.email || ''
      );

      setAccepting(false);

      if (!result.success) {
        assertResultError(result);
        // 招待受け入れ固有のエラーメッセージをユーザーフレンドリーに変換
        let friendlyMessage = '';
        let canRetry = true;

        if (result.error.code === 'PERMISSION_DENIED') {
          friendlyMessage = 'アクセス権限がありません。\nページを更新してもう一度お試しください。\n問題が解決しない場合は、招待を送った方にご連絡ください。';
          canRetry = true;
        } else if (result.error.code === 'ALREADY_HAS_ACCESS' || result.error.message?.includes('すでに')) {
          friendlyMessage = 'あなたは既にこの施設にアクセスできます。\nホーム画面から施設を選択してください。';
          canRetry = false;
        } else {
          const errorMsg = handleError(result.error, '招待の受け入れ');
          friendlyMessage = errorMsg.message;
          canRetry = errorMsg.canRetry;
        }

        setError({ message: friendlyMessage, canRetry });
        return;
      }

      // 成功：メイン画面にリダイレクト
      navigate('/', { replace: true });
    };

    acceptInvite();
  }, [currentUser, token, verifying, accepting, invitationInfo, navigate]);

  // ログインボタンのハンドラー
  const handleLogin = async () => {
    try {
      await signInWithGoogle();
      // ログイン後、useEffectが自動的に招待を受け入れます
    } catch (error) {
      const errorMsg = handleError(error, 'ログイン');
      setError({ message: errorMsg.message, canRetry: errorMsg.canRetry });
    }
  };

  if (loading || verifying) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">招待を確認しています...</p>
        </div>
      </div>
    );
  }

  if (accepting) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">招待を受け入れています...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              招待の処理に失敗しました
            </h1>
            <p className="text-sm text-gray-600">
              {error.canRetry 
                ? 'エラーが発生しました。ページを更新してもう一度お試しください。'
                : 'エラーが発生しました。詳細は下記をご確認ください。'}
            </p>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-800 whitespace-pre-wrap">{error.message}</p>
          </div>

          <div className="space-y-3">
            {error.canRetry && (
              <button
                onClick={() => window.location.reload()}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                ページを更新する
              </button>
            )}
            <button
              onClick={() => navigate('/')}
              className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              ホームに戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ログインしていない場合、ログインを促す
  if (!currentUser && invitationInfo) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">✉️</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              施設への招待
            </h1>
            <p className="text-gray-600">
              {invitationInfo.email} 宛に招待が届いています
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="text-sm text-blue-900">
              <div className="mb-2">
                <span className="font-semibold">ロール:</span>{' '}
                {invitationInfo.role === 'editor' ? '編集者' : '閲覧者'}
              </div>
              <p className="text-xs text-blue-700">
                この招待を受け入れるには、Googleアカウントでログインしてください
              </p>
            </div>
          </div>

          <button
            onClick={handleLogin}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Googleでログイン
          </button>
        </div>
      </div>
    );
  }

  // 通常はここに到達しないが、念のため
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-600">処理中...</p>
      </div>
    </div>
  );
}
