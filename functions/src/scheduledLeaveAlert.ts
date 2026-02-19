/**
 * scheduledLeaveAlert.ts
 *
 * Phase 63.2: 残高不足アラート
 *
 * - 公休残高がマイナスのスタッフを翌月1日に管理者へ通知
 * - 有給残高の時効を90日前・30日前・7日前に管理者へ通知
 *
 * スケジュール: 毎日午前0時（JST）= 15:00 UTC
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { AppNotification, NotificationType } from './types';

/** 管理者として通知を受け取るロール */
const ADMIN_ROLES = new Set(['admin', 'super-admin']);

/** 有給時効チェックの閾値（日数） */
const EXPIRY_THRESHOLDS = [90, 30, 7] as const;

type ExpiryThreshold = (typeof EXPIRY_THRESHOLDS)[number];

const ALERT_TYPE_MAP: Record<ExpiryThreshold, AppNotification['metadata']['alertType']> = {
  90: 'paid_leave_expiry_90d',
  30: 'paid_leave_expiry_30d',
  7: 'paid_leave_expiry_7d',
};

/**
 * 毎日午前0時（JST）に全施設の休暇残高をチェックして通知を生成する
 */
export const scheduledLeaveAlert = onSchedule(
  {
    schedule: '0 15 * * *', // 毎日午前0時（JST）= 15:00 UTC
    timeZone: 'UTC',
    region: 'asia-northeast1',
    memory: '512MiB',
    timeoutSeconds: 540,
  },
  async (_event) => {
    const db = admin.firestore();

    // Cloud FunctionsはUTCで動作するため、JST（UTC+9）に変換して日付を判定する
    const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
    const nowJst = new Date(Date.now() + JST_OFFSET_MS);
    // JSTの年月日でDateオブジェクトを構築（日付計算の基準）
    const today = new Date(nowJst.getUTCFullYear(), nowJst.getUTCMonth(), nowJst.getUTCDate());
    const dayOfMonth = today.getDate();

    // 当月: YYYY-MM（JST基準）
    const currentMonth = formatYearMonth(today);

    // 前月: YYYY-MM（JST基準）
    const prevDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const prevMonth = formatYearMonth(prevDate);

    console.log(`📅 残高アラートチェック開始 (${currentMonth}, dayOfMonth=${dayOfMonth})`);

    const facilitiesSnap = await db.collection('facilities').get();
    console.log(`施設数: ${facilitiesSnap.size}`);

    for (const facilityDoc of facilitiesSnap.docs) {
      const facilityId = facilityDoc.id;
      const facilityData = facilityDoc.data();
      const members: Array<{ userId: string; role: string; name: string }> =
        facilityData.members ?? [];

      // 管理者のuserIdを抽出
      const adminIds = members
        .filter((m) => ADMIN_ROLES.has(m.role))
        .map((m) => m.userId)
        .filter((uid): uid is string => !!uid);

      if (adminIds.length === 0) {
        console.log(`施設 ${facilityId}: 管理者なし。スキップ。`);
        continue;
      }

      try {
        // 1. 公休残高マイナスチェック（毎月1日のみ）
        if (dayOfMonth === 1) {
          await checkPublicHolidayShortage(db, facilityId, prevMonth, adminIds);
        }

        // 2. 有給時効チェック（毎日）
        await checkPaidLeaveExpiry(db, facilityId, currentMonth, adminIds, today);
      } catch (error) {
        console.error(`❌ 施設 ${facilityId} のアラートチェックに失敗:`, error);
        // 1施設の失敗で全体を停止しない
      }
    }

    console.log('✅ 残高アラートチェック完了');
  }
);

/**
 * 公休残高がマイナスのスタッフを管理者へ通知する
 * 毎月1日に前月データを確認する
 */
async function checkPublicHolidayShortage(
  db: admin.firestore.Firestore,
  facilityId: string,
  targetMonth: string,
  adminIds: string[]
): Promise<void> {
  const balancesSnap = await db
    .collection(`facilities/${facilityId}/leaveBalances`)
    .where('yearMonth', '==', targetMonth)
    .get();

  const shortageStaffs = balancesSnap.docs
    .map((d) => d.data())
    .filter((data) => typeof data.publicHoliday?.balance === 'number' && data.publicHoliday.balance < 0);

  if (shortageStaffs.length === 0) {
    console.log(`施設 ${facilityId}: 公休残高マイナスなし`);
    return;
  }

  // スタッフ名を取得するためのIDリスト
  const staffIds: string[] = shortageStaffs
    .map((d) => d.staffId as string)
    .filter(Boolean);

  const staffNameMap = await fetchStaffNames(db, facilityId, staffIds);

  const now = admin.firestore.Timestamp.now();
  const batch = db.batch();

  for (const data of shortageStaffs) {
    const staffId = data.staffId as string;
    const balance = data.publicHoliday.balance as number;
    const staffName = staffNameMap[staffId] ?? '不明';

    const notification: Omit<AppNotification, 'id'> = {
      facilityId,
      type: 'balance_shortage' as NotificationType,
      title: `${staffName}さんの公休残高がマイナスです（${formatDisplayMonth(targetMonth)}分）`,
      body: `公休残高: ${balance}日。不足分は翌月に繰り越されません。ご確認ください。`,
      recipientIds: adminIds,
      readBy: [],
      metadata: {
        staffId,
        staffName,
        alertType: 'public_holiday_shortage',
        balanceAmount: balance,
        targetMonth,
      },
      createdAt: now,
    };

    const notifRef = db.collection(`facilities/${facilityId}/notifications`).doc();
    batch.set(notifRef, notification);
  }

  await batch.commit();
  console.log(
    `✅ 施設 ${facilityId}: 公休残高マイナス通知 ${shortageStaffs.length}件を作成`
  );
}

/**
 * 有給残高の時効が近いスタッフを管理者へ通知する
 * 毎日チェックし、閾値（90日/30日/7日前）に一致した場合のみ通知
 */
async function checkPaidLeaveExpiry(
  db: admin.firestore.Firestore,
  facilityId: string,
  currentMonth: string,
  adminIds: string[],
  today: Date
): Promise<void> {
  const balancesSnap = await db
    .collection(`facilities/${facilityId}/leaveBalances`)
    .where('yearMonth', '==', currentMonth)
    .get();

  const todayMs = today.getTime();
  let notificationCount = 0;

  const now = admin.firestore.Timestamp.now();
  const batch = db.batch();

  // スタッフ名をまとめてfetchするためのIDリスト
  const relevantStaffs: Array<{
    staffId: string;
    balance: number;
    expiresAt: admin.firestore.Timestamp;
    daysUntilExpiry: number;
    threshold: ExpiryThreshold;
  }> = [];

  for (const doc of balancesSnap.docs) {
    const data = doc.data();
    const paidLeave = data.paidLeave;
    if (!paidLeave?.expiresAt || typeof paidLeave.balance !== 'number') continue;
    if (paidLeave.balance <= 0) continue; // 残高0以下はスキップ

    const expiresAtMs = (paidLeave.expiresAt as admin.firestore.Timestamp).toDate().getTime();
    const daysUntilExpiry = Math.floor((expiresAtMs - todayMs) / 86_400_000);

    const matchedThreshold = EXPIRY_THRESHOLDS.find((t) => t === daysUntilExpiry);
    if (matchedThreshold === undefined) continue;

    relevantStaffs.push({
      staffId: data.staffId as string,
      balance: paidLeave.balance as number,
      expiresAt: paidLeave.expiresAt as admin.firestore.Timestamp,
      daysUntilExpiry,
      threshold: matchedThreshold,
    });
  }

  if (relevantStaffs.length === 0) return;

  const staffIds = relevantStaffs.map((s) => s.staffId).filter(Boolean);
  const staffNameMap = await fetchStaffNames(db, facilityId, staffIds);

  for (const s of relevantStaffs) {
    const staffName = staffNameMap[s.staffId] ?? '不明';
    const expiryDateStr = s.expiresAt.toDate().toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const notification: Omit<AppNotification, 'id'> = {
      facilityId,
      type: 'leave_expiry' as NotificationType,
      title: `${staffName}さんの有給が${s.daysUntilExpiry}日後に失効します`,
      body: `有給残高 ${s.balance}日が${expiryDateStr}に失効します。消化を検討してください。`,
      recipientIds: adminIds,
      readBy: [],
      metadata: {
        staffId: s.staffId,
        staffName,
        alertType: ALERT_TYPE_MAP[s.threshold],
        balanceAmount: s.balance,
        daysUntilExpiry: s.daysUntilExpiry,
      },
      createdAt: now,
    };

    const notifRef = db.collection(`facilities/${facilityId}/notifications`).doc();
    batch.set(notifRef, notification);
    notificationCount++;
  }

  if (notificationCount > 0) {
    await batch.commit();
    console.log(
      `✅ 施設 ${facilityId}: 有給時効アラート ${notificationCount}件を作成`
    );
  }
}

/**
 * スタッフIDからスタッフ名のマップを取得する
 */
async function fetchStaffNames(
  db: admin.firestore.Firestore,
  facilityId: string,
  staffIds: string[]
): Promise<Record<string, string>> {
  const nameMap: Record<string, string> = {};
  if (staffIds.length === 0) return nameMap;

  // Firestoreの`in`クエリは30件制限があるため、チャンク処理
  const chunkSize = 30;
  for (let i = 0; i < staffIds.length; i += chunkSize) {
    const chunk = staffIds.slice(i, i + chunkSize);
    try {
      const staffSnap = await db
        .collection(`facilities/${facilityId}/staff`)
        .where(admin.firestore.FieldPath.documentId(), 'in', chunk)
        .get();
      for (const staffDoc of staffSnap.docs) {
        nameMap[staffDoc.id] = staffDoc.data().name ?? '';
      }
    } catch (e) {
      console.warn('スタッフ名の取得に失敗（続行）:', e);
    }
  }

  return nameMap;
}

/** YYYY-MM形式の文字列を生成する */
function formatYearMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** YYYY-MM → YYYY年MM月の表示用フォーマット */
function formatDisplayMonth(yearMonth: string): string {
  if (!yearMonth.includes('-')) return yearMonth;
  const [year, month] = yearMonth.split('-');
  return `${year}年${month}月`;
}
