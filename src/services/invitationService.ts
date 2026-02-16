import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  Timestamp,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../../firebase';
import {
  Invitation,
  InvitationStatus,
  Result,
  FacilityMember,
  FacilityAccess,
  FacilityRole,
  assertResultError,
} from '../../types';
import { grantAccessFromInvitation } from './userService';

// Invitation サービスエラー型
export type InvitationError =
  | { code: 'PERMISSION_DENIED'; message: string }
  | { code: 'NOT_FOUND'; message: string }
  | { code: 'VALIDATION_ERROR'; message: string }
  | { code: 'EXPIRED'; message: string }
  | { code: 'ALREADY_ACCEPTED'; message: string }
  | { code: 'FIRESTORE_ERROR'; message: string };

/**
 * UUIDv4を生成（暗号学的に安全）
 */
function generateUUID(): string {
  // crypto.randomUUID()を使用して暗号学的に安全なトークンを生成
  return crypto.randomUUID();
}

/**
 * 招待リンクを生成
 *
 * @param token - 招待トークン
 * @returns 招待リンクURL
 */
export function generateInvitationLink(token: string): string {
  // 本番環境のURL（環境変数から取得、デフォルトは本番URL）
  const baseUrl = import.meta.env.VITE_APP_URL || 'https://ai-care-shift-scheduler.web.app';
  return `${baseUrl}/invite?token=${token}`;
}

/**
 * 招待を作成
 *
 * @param facilityId - 施設ID
 * @param email - 招待先メールアドレス
 * @param role - 付与する権限（'editor' | 'viewer'）
 * @param createdBy - 招待したユーザーのUID
 * @returns 作成された招待情報と招待リンク
 */
export async function createInvitation(
  facilityId: string,
  email: string,
  role: 'editor' | 'viewer',
  createdBy: string
): Promise<Result<{ invitation: Invitation; invitationLink: string }, InvitationError>> {
  try {
    // バリデーション
    if (!facilityId || !email || !role || !createdBy) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '必須項目が不足しています',
        },
      };
    }

    // メールアドレス形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'メールアドレスの形式が正しくありません',
        },
      };
    }

    // ロールチェック（admin権限では editor と viewer のみ招待可能）
    if (role !== 'editor' && role !== 'viewer') {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '招待可能なロールは editor または viewer のみです',
        },
      };
    }

    // トークンと有効期限を生成
    const token = generateUUID();
    const now = Timestamp.now();
    const expiresAt = Timestamp.fromDate(
      new Date(now.toDate().getTime() + 7 * 24 * 60 * 60 * 1000) // 7日後
    );

    // 招待ドキュメントを作成（Phase 22: トップレベルコレクションに移行）
    // トップレベルinvitationsコレクションに作成（facilityIdフィールド追加）
    const topLevelInvitationRef = doc(collection(db, 'invitations'));
    const invitationId = topLevelInvitationRef.id;

    const invitation: Invitation = {
      id: invitationId,
      email,
      role,
      token,
      status: 'pending',
      createdBy,
      createdAt: now,
      expiresAt,
    };

    // トップレベルコレクションにはfacilityIdフィールドを追加
    const topLevelInvitationData = {
      ...invitation,
      facilityId, // トップレベルコレクション用フィールド
    };

    // トップレベルコレクションに作成
    await setDoc(topLevelInvitationRef, topLevelInvitationData);

    // 後方互換性のため、サブコレクションにも作成
    const subcollectionInvitationRef = doc(
      collection(db, 'facilities', facilityId, 'invitations'),
      invitationId // 同じIDを使用
    );
    await setDoc(subcollectionInvitationRef, invitation);

    // 招待リンクを生成
    const invitationLink = generateInvitationLink(token);

    console.log('招待を作成しました:', {
      facilityId,
      role,
      invitationId,
    });

    return {
      success: true,
      data: { invitation, invitationLink },
    };
  } catch (error: any) {
    console.error('Error creating invitation:', error);
    return {
      success: false,
      error: {
        code: 'FIRESTORE_ERROR',
        message: '招待の作成に失敗しました',
      },
    };
  }
}

/**
 * トークンから招待情報を取得
 *
 * Phase 22: トップレベルinvitationsコレクションからO(1)クエリで取得
 * CodeRabbitレビュー指摘対応：スケーラビリティ問題を解決
 *
 * @param token - 招待トークン
 * @returns 招待情報とfacilityId
 */
export async function getInvitationByToken(
  token: string
): Promise<Result<{ invitation: Invitation; facilityId: string }, InvitationError>> {
  try {
    if (!token) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'トークンが指定されていません',
        },
      };
    }

    // Phase 22: トップレベルinvitationsコレクションからtokenで検索（インデックス付きクエリ）
    // NOTE: where()クエリはFirestoreインデックス使用でO(log n)。真のO(1)はdoc()による直接取得のみ。
    // Security Rules: 未認証ユーザーも読み取り可能（招待リンクアクセス時）
    const invitationsQuery = query(
      collection(db, 'invitations'),
      where('token', '==', token)
    );

    const invitationsSnapshot = await getDocs(invitationsQuery);

    if (invitationsSnapshot.empty) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '招待が見つかりません',
        },
      };
    }

    const invitationDoc = invitationsSnapshot.docs[0];
    const invitationData = invitationDoc.data();

    // トップレベルコレクションからfacilityIdを取得
    const facilityId = invitationData.facilityId as string;

    // CodeRabbit指摘対応: facilityIdの存在確認（データ不整合・マイグレーション問題対策）
    if (!facilityId) {
      return {
        success: false,
        error: {
          code: 'FIRESTORE_ERROR',
          message: '招待データが不正です（facilityIdが見つかりません）',
        },
      };
    }

    // Invitation型に変換（facilityIdフィールドを除外）
    const { facilityId: _, ...invitation } = invitationData;

    return {
      success: true,
      data: { invitation: invitation as Invitation, facilityId },
    };
  } catch (error: any) {
    console.error('Error getting invitation by token:', error);
    return {
      success: false,
      error: {
        code: 'FIRESTORE_ERROR',
        message: '招待の取得に失敗しました',
      },
    };
  }
}

/**
 * 招待を検証
 *
 * @param token - 招待トークン
 * @returns 検証結果と招待情報
 */
export async function verifyInvitationToken(
  token: string
): Promise<Result<{ invitation: Invitation; facilityId: string }, InvitationError>> {
  const result = await getInvitationByToken(token);

  if (!result.success) {
    return result;
  }

  const { invitation, facilityId } = result.data;

  // ステータスチェック
  if (invitation.status === 'accepted') {
    return {
      success: false,
      error: {
        code: 'ALREADY_ACCEPTED',
        message: 'この招待は既に受け入れられています',
      },
    };
  }

  if (invitation.status === 'expired') {
    return {
      success: false,
      error: {
        code: 'EXPIRED',
        message: 'この招待は期限切れです',
      },
    };
  }

  // 有効期限チェック
  const now = new Date();
  const expiresAt = invitation.expiresAt.toDate();

  if (now > expiresAt) {
    // 期限切れの場合、ステータスを更新（Phase 22: 両方のコレクションを更新）
    // トップレベルコレクション
    const topLevelQuery = query(
      collection(db, 'invitations'),
      where('token', '==', invitation.token)
    );
    const topLevelSnapshot = await getDocs(topLevelQuery);
    if (!topLevelSnapshot.empty) {
      await updateDoc(topLevelSnapshot.docs[0].ref, { status: 'expired' as InvitationStatus });
    }

    // サブコレクション（後方互換性）
    const invitationRef = doc(
      db,
      'facilities',
      facilityId,
      'invitations',
      invitation.id
    );
    await updateDoc(invitationRef, { status: 'expired' as InvitationStatus });

    return {
      success: false,
      error: {
        code: 'EXPIRED',
        message: 'この招待は期限切れです',
      },
    };
  }

  return {
    success: true,
    data: { invitation, facilityId },
  };
}

/**
 * 招待を受け入れてアクセス権限を付与
 *
 * Firestoreトランザクションで招待ドキュメントの取得・検証・ステータス更新をアトミックに実行し、
 * 同一招待の同時受け入れ（race condition）を防止する。
 *
 * @param token - 招待トークン
 * @param userId - ユーザーID（受け入れるユーザー）
 * @param userEmail - ユーザーのメールアドレス
 * @returns 成功/失敗
 */
export async function acceptInvitation(
  token: string,
  userId: string,
  userEmail: string
): Promise<Result<void, InvitationError>> {
  try {
    // Step 1: トランザクションで招待の検証とステータス更新をアトミックに実行
    // トークンからドキュメントIDを事前取得（トランザクション内ではqueryが使えないため）
    const invitationsQuery = query(
      collection(db, 'invitations'),
      where('token', '==', token)
    );
    const invitationsSnapshot = await getDocs(invitationsQuery);

    if (invitationsSnapshot.empty) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: '招待が見つかりません' },
      };
    }

    const topLevelDocRef = invitationsSnapshot.docs[0].ref;
    const topLevelData = invitationsSnapshot.docs[0].data();
    const facilityId = topLevelData.facilityId as string;

    if (!facilityId) {
      return {
        success: false,
        error: { code: 'FIRESTORE_ERROR', message: '招待データが不正です（facilityIdが見つかりません）' },
      };
    }

    const subDocRef = doc(db, 'facilities', facilityId, 'invitations', topLevelData.id as string);

    // トランザクション内で最新データを再取得し、検証→ステータス更新をアトミック実行
    const { invitation: validatedInvitation, facilityId: validatedFacilityId } = await runTransaction(db, async (transaction) => {
      const freshDoc = await transaction.get(topLevelDocRef);
      if (!freshDoc.exists()) {
        throw new Error('NOT_FOUND');
      }

      const freshData = freshDoc.data();
      const { facilityId: fId, ...invData } = freshData;
      const inv = invData as Invitation;

      // ステータスチェック（トランザクション内で最新値を検証）
      if (inv.status === 'accepted') {
        throw new Error('ALREADY_ACCEPTED');
      }
      if (inv.status === 'expired') {
        throw new Error('EXPIRED');
      }

      // 有効期限チェック
      const now = new Date();
      const expiresAt = inv.expiresAt.toDate();
      if (now > expiresAt) {
        transaction.update(topLevelDocRef, { status: 'expired' as InvitationStatus });
        transaction.update(subDocRef, { status: 'expired' as InvitationStatus });
        throw new Error('EXPIRED');
      }

      // メールアドレスチェック
      if (inv.email.toLowerCase() !== userEmail.toLowerCase()) {
        throw new Error('PERMISSION_DENIED');
      }

      // ステータスを 'accepted' に更新（トップレベル + サブコレクション）
      transaction.update(topLevelDocRef, { status: 'accepted' as InvitationStatus });
      transaction.update(subDocRef, { status: 'accepted' as InvitationStatus });

      return { invitation: inv, facilityId: fId as string };
    });

    // Step 2: トランザクション成功後にアクセス権限を付与
    const roleMap: Record<'editor' | 'viewer', FacilityRole> = {
      'editor': FacilityRole.Editor,
      'viewer': FacilityRole.Viewer,
    };
    const grantResult = await grantAccessFromInvitation(
      userId,
      validatedFacilityId,
      roleMap[validatedInvitation.role],
      validatedInvitation.createdBy
    );

    if (!grantResult.success) {
      assertResultError(grantResult);
      // 既にアクセス権限がある場合は成功とみなす
      if (grantResult.error.code === 'VALIDATION_ERROR' &&
          grantResult.error.message.includes('すでに')) {
        return { success: true, data: undefined };
      }

      // 権限付与失敗時は招待ステータスを 'pending' に戻す
      try {
        await runTransaction(db, async (transaction) => {
          transaction.update(topLevelDocRef, { status: 'pending' as InvitationStatus });
          transaction.update(subDocRef, { status: 'pending' as InvitationStatus });
        });
      } catch (rollbackError) {
        console.error('Failed to rollback invitation status:', rollbackError);
      }

      return {
        success: false,
        error: { code: 'FIRESTORE_ERROR', message: grantResult.error.message },
      };
    }

    console.log('招待を受け入れました:', {
      invitationId: validatedInvitation.id,
      facilityId: validatedFacilityId,
      role: validatedInvitation.role,
    });

    return { success: true, data: undefined };
  } catch (error: any) {
    // トランザクション内のthrowをInvitationErrorに変換
    const errorMap: Record<string, InvitationError> = {
      'NOT_FOUND': { code: 'NOT_FOUND', message: '招待が見つかりません' },
      'ALREADY_ACCEPTED': { code: 'ALREADY_ACCEPTED', message: 'この招待は既に受け入れられています' },
      'EXPIRED': { code: 'EXPIRED', message: 'この招待は期限切れです' },
      'PERMISSION_DENIED': { code: 'PERMISSION_DENIED', message: 'この招待は別のメールアドレス宛です' },
    };

    const mappedError = errorMap[error.message];
    if (mappedError) {
      return { success: false, error: mappedError };
    }

    console.error('Error accepting invitation:', error);
    return {
      success: false,
      error: { code: 'FIRESTORE_ERROR', message: '招待の受け入れに失敗しました' },
    };
  }
}

/**
 * 施設の招待リストを取得
 *
 * @param facilityId - 施設ID
 * @returns 招待リスト
 */
export async function getInvitationsByFacility(
  facilityId: string
): Promise<Result<Invitation[], InvitationError>> {
  try {
    if (!facilityId) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '施設IDが指定されていません',
        },
      };
    }

    const invitationsRef = collection(db, 'facilities', facilityId, 'invitations');
    const snapshot = await getDocs(invitationsRef);

    const invitations: Invitation[] = snapshot.docs.map((doc) => doc.data() as Invitation);

    return {
      success: true,
      data: invitations,
    };
  } catch (error: any) {
    console.error('Error getting invitations by facility:', error);
    return {
      success: false,
      error: {
        code: 'FIRESTORE_ERROR',
        message: '招待リストの取得に失敗しました',
      },
    };
  }
}
