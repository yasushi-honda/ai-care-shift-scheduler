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
  // 本番環境のURL（環境変数から取得、デフォルトはlocalhost）
  const baseUrl = import.meta.env.VITE_APP_URL || 'http://localhost:5173';
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

    // 招待ドキュメントを作成
    const invitationRef = doc(
      collection(db, 'facilities', facilityId, 'invitations')
    );
    const invitationId = invitationRef.id;

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

    await setDoc(invitationRef, invitation);

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

    // 全施設の招待コレクションからトークンで検索
    // TODO: SCALABILITY ISSUE - O(n×m) complexity
    // CodeRabbitレビュー指摘事項：
    // 現在の実装は全施設を反復し、各施設のinvitationsサブコレクションをクエリします。
    // これはO(n×m)の複雑性を持ち、施設数が増えると以下の問題が発生します：
    // - Firestoreコスト増加（読み取りごとに課金）
    // - レスポンス時間の遅延
    // - タイムアウトリスク
    //
    // 推奨される改善策：
    // 1. トップレベルのinvitationsコレクションを作成し、facilityIdフィールドを追加
    // 2. tokenにインデックスを設定
    // 3. または、token → facilityIdマッピング用の別コレクションを作成
    //
    // 現時点では小規模システムのため許容範囲として実装を保留

    const facilitiesSnapshot = await getDocs(collection(db, 'facilities'));

    for (const facilityDoc of facilitiesSnapshot.docs) {
      const facilityId = facilityDoc.id;
      const invitationsQuery = query(
        collection(db, 'facilities', facilityId, 'invitations'),
        where('token', '==', token)
      );

      const invitationsSnapshot = await getDocs(invitationsQuery);

      if (!invitationsSnapshot.empty) {
        const invitationDoc = invitationsSnapshot.docs[0];
        const invitation = invitationDoc.data() as Invitation;

        return {
          success: true,
          data: { invitation, facilityId },
        };
      }
    }

    return {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: '招待が見つかりません',
      },
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
    // 期限切れの場合、ステータスを更新
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
 * TODO: RACE CONDITION ISSUE
 * CodeRabbitレビュー指摘事項：
 * 現在の実装では、招待の検証とステータス更新の間にrace conditionが存在します。
 * 複数のユーザーが同時に同じ招待を受け入れられる可能性があります。
 *
 * 推奨される修正：
 * 1. Firestoreトランザクションを使用して、招待ドキュメントの取得、検証、
 *    ステータス更新をアトミックに実行
 * 2. grantAccessFromInvitation()もトランザクション内で呼び出すか、
 *    または別途処理してエラーハンドリング
 *
 * 現時点では小規模システムで同時アクセスが少ないため、
 * 簡易的なチェックで実装を保留
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
    // 招待を検証
    const verifyResult = await verifyInvitationToken(token);

    if (!verifyResult.success) {
      return verifyResult as Result<void, InvitationError>;
    }

    const { invitation, facilityId } = verifyResult.data;

    // メールアドレスが一致するか確認
    if (invitation.email.toLowerCase() !== userEmail.toLowerCase()) {
      return {
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'この招待は別のメールアドレス宛です',
        },
      };
    }

    // grantAccessFromInvitationを使ってアクセス権限を付与
    // この関数は権限チェックをスキップし、招待トークンが検証済みであることを前提とします
    const grantResult = await grantAccessFromInvitation(
      userId,
      facilityId,
      invitation.role,
      invitation.createdBy // 招待を作成したユーザーのUIDを使用
    );

    if (!grantResult.success) {
      // 既にアクセス権限がある場合は成功とみなす
      if (grantResult.error.code === 'VALIDATION_ERROR' &&
          grantResult.error.message.includes('すでに')) {
        // 招待ステータスを更新
        const invitationRef = doc(
          db,
          'facilities',
          facilityId,
          'invitations',
          invitation.id
        );
        await updateDoc(invitationRef, { status: 'accepted' as InvitationStatus });

        return { success: true, data: undefined };
      }

      return {
        success: false,
        error: {
          code: 'FIRESTORE_ERROR',
          message: grantResult.error.message,
        },
      };
    }

    // 招待ステータスを 'accepted' に更新
    const invitationRef = doc(
      db,
      'facilities',
      facilityId,
      'invitations',
      invitation.id
    );

    await updateDoc(invitationRef, { status: 'accepted' as InvitationStatus });

    console.log('招待を受け入れました:', {
      invitationId: invitation.id,
      facilityId,
      role: invitation.role,
    });

    return { success: true, data: undefined };
  } catch (error: any) {
    console.error('Error accepting invitation:', error);
    return {
      success: false,
      error: {
        code: 'FIRESTORE_ERROR',
        message: '招待の受け入れに失敗しました',
      },
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
