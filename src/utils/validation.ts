import { Result } from '../../types';

/**
 * バリデーションエラー型
 */
export type ValidationError = {
  code: 'VALIDATION_ERROR';
  message: string;
};

/**
 * 施設IDのバリデーション
 *
 * @param facilityId - 施設ID
 * @returns Result<void, ValidationError>
 *
 * @description
 * この関数は複数のサービスで重複していたfacilityIdバリデーションを統合したものです。
 * 以下のファイルで13箇所に重複していました：
 * - staffService.ts (3箇所)
 * - scheduleService.ts (6箇所)
 * - leaveRequestService.ts (2箇所)
 * - requirementService.ts (2箇所)
 */
export function validateFacilityId(facilityId: string): Result<void, ValidationError> {
  if (!facilityId || facilityId.trim() === '') {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '施設IDは必須です',
      },
    };
  }

  return { success: true, data: undefined };
}

/**
 * 必須フィールドのバリデーション
 *
 * @param value - 検証する値
 * @param fieldName - フィールド名（エラーメッセージ用）
 * @returns Result<void, ValidationError>
 */
export function validateRequired(
  value: string | undefined | null,
  fieldName: string
): Result<void, ValidationError> {
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: `${fieldName}は必須です`,
      },
    };
  }

  return { success: true, data: undefined };
}

/**
 * 文字列長のバリデーション
 *
 * @param value - 検証する値
 * @param fieldName - フィールド名
 * @param maxLength - 最大文字数
 * @returns Result<void, ValidationError>
 */
export function validateMaxLength(
  value: string,
  fieldName: string,
  maxLength: number
): Result<void, ValidationError> {
  if (value.trim().length > maxLength) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: `${fieldName}は${maxLength}文字以内で入力してください`,
      },
    };
  }

  return { success: true, data: undefined };
}

/**
 * 複数のバリデーション結果を統合
 *
 * @param validations - バリデーション結果の配列
 * @returns Result<void, ValidationError> - すべて成功ならsuccess、1つでも失敗なら最初のエラーを返す
 */
export function combineValidations(
  validations: Result<void, ValidationError>[]
): Result<void, ValidationError> {
  for (const validation of validations) {
    if (!validation.success) {
      return validation;
    }
  }

  return { success: true, data: undefined };
}
