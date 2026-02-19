import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { AppNotification, NotificationType } from './types';

/**
 * シフト確定トリガー
 * Phase 63.1: シフトが draft → confirmed になったとき通知を作成する
 *
 * Firestoreパス: facilities/{facilityId}/schedules/{scheduleId}
 */
export const onScheduleConfirmed = onDocumentUpdated(
  'facilities/{facilityId}/schedules/{scheduleId}',
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    if (!before || !after) {
      console.log('No data associated with the event');
      return;
    }

    // draft → confirmed の遷移のみ処理する
    if (before.status !== 'draft' || after.status !== 'confirmed') {
      return;
    }

    const { facilityId, scheduleId } = event.params;
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();

    const confirmedBy: string = after.updatedBy ?? after.confirmedBy ?? '';
    const targetMonth: string = after.targetMonth ?? '';

    console.log('📅 シフト確定通知を作成します', { facilityId, scheduleId, targetMonth, confirmedBy });

    try {
      // 施設メンバー一覧を取得
      const facilityRef = db.collection('facilities').doc(facilityId);
      const facilitySnap = await facilityRef.get();
      if (!facilitySnap.exists) {
        console.error('施設ドキュメントが見つかりません', { facilityId });
        return;
      }

      const facilityData = facilitySnap.data()!;
      const members: Array<{ userId: string }> = facilityData.members ?? [];
      const recipientIds: string[] = members
        .map((m) => m.userId)
        .filter((uid): uid is string => !!uid);

      if (recipientIds.length === 0) {
        console.log('通知対象メンバーがいません', { facilityId });
        return;
      }

      // 確定者名を取得
      let confirmedByName = '';
      if (confirmedBy) {
        try {
          const userSnap = await db.collection('users').doc(confirmedBy).get();
          if (userSnap.exists) {
            confirmedByName = userSnap.data()?.name ?? '';
          }
        } catch (e) {
          console.warn('確定者名の取得に失敗しました（続行）', e);
        }
      }

      // 対象月を表示用フォーマットに変換（YYYY-MM → YYYY年MM月）
      let displayMonth = targetMonth;
      if (targetMonth && targetMonth.includes('-')) {
        const [year, month] = targetMonth.split('-');
        displayMonth = `${year}年${month}月`;
      }

      const title = `${displayMonth}のシフトが確定しました`;
      const body = confirmedByName
        ? `${confirmedByName}さんがシフトを確定しました。ご確認ください。`
        : 'シフトが確定しました。ご確認ください。';

      const notification: Omit<AppNotification, 'id'> = {
        facilityId,
        type: 'schedule_confirmed' as NotificationType,
        title,
        body,
        recipientIds,
        readBy: [],
        metadata: {
          scheduleId,
          targetMonth,
          confirmedBy: confirmedBy || undefined,
          confirmedByName: confirmedByName || undefined,
        },
        createdAt: now,
      };

      await db
        .collection(`facilities/${facilityId}/notifications`)
        .add(notification);

      console.log('✅ シフト確定通知を作成しました', {
        facilityId,
        scheduleId,
        targetMonth,
        recipientCount: recipientIds.length,
      });
    } catch (error) {
      console.error('❌ シフト確定通知の作成に失敗しました:', error);
      throw new Error(
        `Failed to create schedule confirmed notification: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }
);
