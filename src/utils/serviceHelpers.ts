import { DocumentReference, getDoc } from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { Result } from '../../types';
import { handleError, ErrorMessage } from './errorHandler';

/**
 * サービスエラー型（全サービス共通）
 */
export type ServiceError =
  | { code: 'PERMISSION_DENIED'; message: string }
  | { code: 'NOT_FOUND'; message: string }
  | { code: 'VALIDATION_ERROR'; message: string }
  | { code: 'FIRESTORE_ERROR'; message: string }
  | { code: 'UNKNOWN_ERROR'; message: string };

/**
 * Firestoreドキュメントの存在確認
 *
 * @param docRef - ドキュメント参照
 * @param resourceName - リソース名（エラーメッセージ用）
 * @returns Result<void, ServiceError>
 *
 * @description
 * この関数は複数のサービスで重複していたドキュメント存在チェックを統合したものです。
 */
export async function checkDocumentExists(
  docRef: DocumentReference,
  resourceName: string = 'ドキュメント'
): Promise<Result<void, ServiceError>> {
  try {
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `指定された${resourceName}が見つかりません`,
        },
      };
    }

    return { success: true, data: undefined };
  } catch (error) {
    return handleServiceError(error, `${resourceName}の確認`);
  }
}

/**
 * Firestoreエラーをサービスエラーに変換
 *
 * @param error - キャッチしたエラー
 * @param context - エラーが発生したコンテキスト
 * @returns Result<never, ServiceError>
 *
 * @description
 * errorHandler.tsのhandleError()を使用してFirebaseエラーを解析し、
 * サービスエラー型に変換します。
 */
export function handleServiceError(
  error: unknown,
  context: string
): Result<never, ServiceError> {
  console.error(`Error in ${context}:`, error);

  // FirebaseErrorの場合、permission-deniedを特別扱い
  if (error instanceof FirebaseError && error.code === 'permission-denied') {
    return {
      success: false,
      error: {
        code: 'PERMISSION_DENIED',
        message: `${context}する権限がありません`,
      },
    };
  }

  // errorHandlerを使用してエラーメッセージを生成
  const errorMsg: ErrorMessage = handleError(error, context);

  // ErrorMessageからServiceErrorへの変換
  let errorCode: ServiceError['code'];
  if (errorMsg.code?.includes('permission-denied')) {
    errorCode = 'PERMISSION_DENIED';
  } else if (errorMsg.code?.includes('not-found')) {
    errorCode = 'NOT_FOUND';
  } else if (errorMsg.code?.includes('invalid-argument')) {
    errorCode = 'VALIDATION_ERROR';
  } else if (errorMsg.code?.startsWith('firestore/') || errorMsg.code?.startsWith('auth/')) {
    errorCode = 'FIRESTORE_ERROR';
  } else {
    errorCode = 'UNKNOWN_ERROR';
  }

  return {
    success: false,
    error: {
      code: errorCode,
      message: errorMsg.message,
    },
  };
}

/**
 * 権限拒否エラーを生成
 *
 * @param operation - 操作名
 * @returns ServiceError
 */
export function createPermissionDeniedError(operation: string): ServiceError {
  return {
    code: 'PERMISSION_DENIED',
    message: `${operation}する権限がありません`,
  };
}

/**
 * Not Foundエラーを生成
 *
 * @param resourceName - リソース名
 * @returns ServiceError
 */
export function createNotFoundError(resourceName: string): ServiceError {
  return {
    code: 'NOT_FOUND',
    message: `指定された${resourceName}が見つかりません`,
  };
}

/**
 * バリデーションエラーを生成
 *
 * @param message - エラーメッセージ
 * @returns ServiceError
 */
export function createValidationError(message: string): ServiceError {
  return {
    code: 'VALIDATION_ERROR',
    message,
  };
}
