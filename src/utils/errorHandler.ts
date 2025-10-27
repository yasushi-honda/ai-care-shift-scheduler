import { FirebaseError } from 'firebase/app';

/**
 * エラーメッセージの型定義
 */
export interface ErrorMessage {
  title: string;
  message: string;
  code?: string;
  canRetry: boolean;
}

/**
 * Firestoreエラーコードから日本語メッセージへのマッピング
 */
const FIRESTORE_ERROR_MESSAGES: Record<string, ErrorMessage> = {
  'permission-denied': {
    title: 'アクセス権限エラー',
    message: 'この操作を実行する権限がありません。管理者に連絡してください。',
    canRetry: false,
  },
  'not-found': {
    title: 'データが見つかりません',
    message: '指定されたデータが見つかりませんでした。',
    canRetry: false,
  },
  'already-exists': {
    title: 'データが既に存在します',
    message: '同じデータが既に登録されています。',
    canRetry: false,
  },
  'resource-exhausted': {
    title: 'リソース制限',
    message: '一時的にリクエストが集中しています。しばらく待ってから再試行してください。',
    canRetry: true,
  },
  'failed-precondition': {
    title: '条件エラー',
    message: '操作の前提条件が満たされていません。',
    canRetry: false,
  },
  'aborted': {
    title: '処理が中断されました',
    message: '処理が競合により中断されました。再試行してください。',
    canRetry: true,
  },
  'out-of-range': {
    title: '範囲外エラー',
    message: '指定された値が許可範囲外です。',
    canRetry: false,
  },
  'unauthenticated': {
    title: '認証エラー',
    message: 'ログインセッションが無効です。再度ログインしてください。',
    canRetry: false,
  },
  'unavailable': {
    title: 'サービス一時停止',
    message: 'サービスに接続できません。ネットワーク接続を確認して再試行してください。',
    canRetry: true,
  },
  'deadline-exceeded': {
    title: 'タイムアウト',
    message: '処理がタイムアウトしました。再試行してください。',
    canRetry: true,
  },
  'cancelled': {
    title: 'キャンセル',
    message: '処理がキャンセルされました。',
    canRetry: true,
  },
  'data-loss': {
    title: 'データ損失',
    message: '不明なデータ損失が発生しました。管理者に連絡してください。',
    canRetry: false,
  },
  'unknown': {
    title: '不明なエラー',
    message: '不明なエラーが発生しました。再試行してください。',
    canRetry: true,
  },
  'invalid-argument': {
    title: '入力エラー',
    message: '入力された情報が正しくありません。内容を確認してください。',
    canRetry: false,
  },
  'internal': {
    title: 'サーバーエラー',
    message: 'サーバー内部エラーが発生しました。しばらく待ってから再試行してください。',
    canRetry: true,
  },
};

/**
 * Firebase Authエラーコードから日本語メッセージへのマッピング
 */
const AUTH_ERROR_MESSAGES: Record<string, ErrorMessage> = {
  'auth/invalid-email': {
    title: 'メールアドレスエラー',
    message: 'メールアドレスの形式が正しくありません。',
    canRetry: false,
  },
  'auth/user-disabled': {
    title: 'アカウント無効',
    message: 'このアカウントは無効化されています。管理者に連絡してください。',
    canRetry: false,
  },
  'auth/user-not-found': {
    title: 'ユーザーが見つかりません',
    message: '指定されたユーザーが見つかりませんでした。',
    canRetry: false,
  },
  'auth/wrong-password': {
    title: 'パスワードエラー',
    message: 'パスワードが間違っています。',
    canRetry: false,
  },
  'auth/too-many-requests': {
    title: 'リクエスト過多',
    message: 'ログイン試行回数が上限に達しました。しばらく待ってから再試行してください。',
    canRetry: true,
  },
  'auth/network-request-failed': {
    title: 'ネットワークエラー',
    message: 'ネットワーク接続に失敗しました。接続を確認して再試行してください。',
    canRetry: true,
  },
  'auth/popup-closed-by-user': {
    title: 'ログインキャンセル',
    message: 'ログインウィンドウが閉じられました。',
    canRetry: true,
  },
  'auth/cancelled-popup-request': {
    title: 'ログインキャンセル',
    message: 'ログインがキャンセルされました。',
    canRetry: true,
  },
};

/**
 * ネットワーク接続エラーの検出
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof FirebaseError) {
    return (
      error.code === 'unavailable' ||
      error.code === 'deadline-exceeded' ||
      error.code === 'auth/network-request-failed'
    );
  }

  // JavaScriptネットワークエラー
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  return false;
}

/**
 * エラーからユーザーフレンドリーなメッセージを生成
 *
 * @param error - エラーオブジェクト（FirebaseError、Error、unknown）
 * @param context - エラーが発生したコンテキスト（例: "スタッフ情報の保存"）
 * @returns ErrorMessage オブジェクト
 */
export function handleError(error: unknown, context?: string): ErrorMessage {
  console.error(`Error in ${context || 'unknown context'}:`, error);

  // Firebase Errorの場合
  if (error instanceof FirebaseError) {
    const errorCode = error.code.replace('firestore/', '').replace('auth/', '');

    // Authエラー
    if (error.code.startsWith('auth/')) {
      const authError = AUTH_ERROR_MESSAGES[error.code];
      if (authError) {
        return { ...authError, code: error.code };
      }
    }

    // Firestoreエラー
    const firestoreError = FIRESTORE_ERROR_MESSAGES[errorCode];
    if (firestoreError) {
      return { ...firestoreError, code: error.code };
    }
  }

  // 一般的なErrorオブジェクト
  if (error instanceof Error) {
    // ネットワークエラーの場合
    if (isNetworkError(error)) {
      return {
        title: 'ネットワークエラー',
        message: 'ネットワーク接続に失敗しました。接続を確認して再試行してください。',
        canRetry: true,
      };
    }

    return {
      title: 'エラー',
      message: error.message || '不明なエラーが発生しました。',
      canRetry: true,
    };
  }

  // その他の不明なエラー
  return {
    title: '不明なエラー',
    message: context
      ? `${context}中に不明なエラーが発生しました。`
      : '不明なエラーが発生しました。',
    canRetry: true,
  };
}

/**
 * エラーメッセージを簡潔な文字列に変換
 * （トースト通知用）
 */
export function getErrorMessage(error: unknown, context?: string): string {
  const errorMsg = handleError(error, context);
  return `${errorMsg.title}: ${errorMsg.message}`;
}

/**
 * リトライ可能なエラーかどうかを判定
 */
export function canRetry(error: unknown): boolean {
  const errorMsg = handleError(error);
  return errorMsg.canRetry;
}
