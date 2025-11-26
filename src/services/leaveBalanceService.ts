import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
  query,
  where,
  onSnapshot,
  Timestamp,
  Unsubscribe,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '../../firebase';
import {
  Result,
  FacilityLeaveSettings,
  StaffLeaveBalance,
  PublicHolidayBalance,
  PaidLeaveBalance,
  LeaveAdjustment,
  LeaveBalanceError,
} from '../../types';
import { DEFAULT_LEAVE_SETTINGS } from '../../constants';

/**
 * 休暇設定を取得
 * 設定がない場合はデフォルト設定を自動作成
 */
export async function getLeaveSettings(
  facilityId: string
): Promise<Result<FacilityLeaveSettings, LeaveBalanceError>> {
  try {
    const settingsRef = doc(db, 'facilities', facilityId, 'leaveSettings', 'default');
    const settingsDoc = await getDoc(settingsRef);

    if (!settingsDoc.exists()) {
      // デフォルト設定を作成
      const defaultSettings: FacilityLeaveSettings = {
        facilityId,
        publicHoliday: DEFAULT_LEAVE_SETTINGS.publicHoliday,
        paidLeave: DEFAULT_LEAVE_SETTINGS.paidLeave,
        updatedAt: Timestamp.now(),
        updatedBy: 'system',
      };

      await setDoc(settingsRef, defaultSettings);

      return { success: true, data: defaultSettings };
    }

    const settings = settingsDoc.data() as FacilityLeaveSettings;
    return { success: true, data: settings };
  } catch (error) {
    console.error('Error fetching leave settings:', error);
    return {
      success: false,
      error: {
        code: 'FIRESTORE_ERROR',
        message: '休暇設定の取得に失敗しました',
      },
    };
  }
}

/**
 * 休暇設定を保存
 */
export async function saveLeaveSettings(
  facilityId: string,
  settings: Partial<Omit<FacilityLeaveSettings, 'facilityId' | 'updatedAt' | 'updatedBy'>>,
  userId: string
): Promise<Result<void, LeaveBalanceError>> {
  try {
    const settingsRef = doc(db, 'facilities', facilityId, 'leaveSettings', 'default');

    const updateData = {
      ...settings,
      facilityId,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    };

    await setDoc(settingsRef, updateData, { merge: true });

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error saving leave settings:', error);
    return {
      success: false,
      error: {
        code: 'FIRESTORE_ERROR',
        message: '休暇設定の保存に失敗しました',
      },
    };
  }
}

/**
 * 休暇設定のリアルタイム購読
 */
export function subscribeToLeaveSettings(
  facilityId: string,
  onUpdate: (settings: FacilityLeaveSettings) => void,
  onError: (error: LeaveBalanceError) => void
): Unsubscribe {
  const settingsRef = doc(db, 'facilities', facilityId, 'leaveSettings', 'default');

  return onSnapshot(
    settingsRef,
    async (snapshot) => {
      if (!snapshot.exists()) {
        // デフォルト設定を作成
        const defaultSettings: FacilityLeaveSettings = {
          facilityId,
          publicHoliday: DEFAULT_LEAVE_SETTINGS.publicHoliday,
          paidLeave: DEFAULT_LEAVE_SETTINGS.paidLeave,
          updatedAt: Timestamp.now(),
          updatedBy: 'system',
        };

        try {
          await setDoc(settingsRef, defaultSettings);
          onUpdate(defaultSettings);
        } catch (error) {
          console.error('Error creating default leave settings:', error);
          onError({
            code: 'FIRESTORE_ERROR',
            message: 'デフォルト設定の作成に失敗しました',
          });
        }
        return;
      }

      const settings = snapshot.data() as FacilityLeaveSettings;
      onUpdate(settings);
    },
    (error) => {
      console.error('Error subscribing to leave settings:', error);
      onError({
        code: 'FIRESTORE_ERROR',
        message: '休暇設定の購読に失敗しました',
      });
    }
  );
}

/**
 * スタッフの休暇残高一覧を取得
 */
export async function getStaffLeaveBalances(
  facilityId: string,
  yearMonth: string
): Promise<Result<StaffLeaveBalance[], LeaveBalanceError>> {
  try {
    const balancesRef = collection(db, 'facilities', facilityId, 'leaveBalances');
    const q = query(balancesRef, where('yearMonth', '==', yearMonth));
    const querySnapshot = await getDocs(q);

    const balances: StaffLeaveBalance[] = [];
    querySnapshot.forEach((doc) => {
      balances.push({
        id: doc.id,
        ...doc.data(),
      } as StaffLeaveBalance);
    });

    return { success: true, data: balances };
  } catch (error) {
    console.error('Error fetching leave balances:', error);
    return {
      success: false,
      error: {
        code: 'FIRESTORE_ERROR',
        message: '休暇残高の取得に失敗しました',
      },
    };
  }
}

/**
 * スタッフの休暇残高を取得（存在しない場合は初期化）
 */
export async function getStaffLeaveBalance(
  facilityId: string,
  staffId: string,
  yearMonth: string,
  settings: FacilityLeaveSettings
): Promise<Result<StaffLeaveBalance, LeaveBalanceError>> {
  try {
    const balanceId = `${yearMonth}_${staffId}`;
    const balanceRef = doc(db, 'facilities', facilityId, 'leaveBalances', balanceId);
    const balanceDoc = await getDoc(balanceRef);

    if (balanceDoc.exists()) {
      return {
        success: true,
        data: { id: balanceDoc.id, ...balanceDoc.data() } as StaffLeaveBalance,
      };
    }

    // 前月の残高を取得して繰越計算
    const prevYearMonth = getPreviousYearMonth(yearMonth);
    const prevBalanceId = `${prevYearMonth}_${staffId}`;
    const prevBalanceRef = doc(db, 'facilities', facilityId, 'leaveBalances', prevBalanceId);
    const prevBalanceDoc = await getDoc(prevBalanceRef);

    const prevBalance = prevBalanceDoc.exists()
      ? (prevBalanceDoc.data() as StaffLeaveBalance)
      : null;

    // 新規残高を計算・作成
    const newBalance = calculateInitialBalance(staffId, yearMonth, settings, prevBalance);
    await setDoc(balanceRef, newBalance);

    return { success: true, data: newBalance };
  } catch (error) {
    console.error('Error fetching staff leave balance:', error);
    return {
      success: false,
      error: {
        code: 'FIRESTORE_ERROR',
        message: '休暇残高の取得に失敗しました',
      },
    };
  }
}

/**
 * 残高を調整
 */
export async function adjustBalance(
  facilityId: string,
  staffId: string,
  yearMonth: string,
  adjustment: Omit<LeaveAdjustment, 'adjustedAt'>,
  userId: string
): Promise<Result<void, LeaveBalanceError>> {
  try {
    const balanceId = `${yearMonth}_${staffId}`;
    const balanceRef = doc(db, 'facilities', facilityId, 'leaveBalances', balanceId);
    const balanceDoc = await getDoc(balanceRef);

    if (!balanceDoc.exists()) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '休暇残高が見つかりません',
        },
      };
    }

    const currentBalance = balanceDoc.data() as StaffLeaveBalance;
    const newAdjustment: LeaveAdjustment = {
      ...adjustment,
      adjustedAt: Timestamp.now(),
    };

    // 残高を更新
    const updatedBalance = { ...currentBalance };
    if (adjustment.type === 'publicHoliday') {
      updatedBalance.publicHoliday = {
        ...updatedBalance.publicHoliday,
        balance: updatedBalance.publicHoliday.balance + adjustment.amount,
      };
    } else {
      updatedBalance.paidLeave = {
        ...updatedBalance.paidLeave,
        balance: updatedBalance.paidLeave.balance + adjustment.amount,
      };
    }

    await setDoc(balanceRef, {
      ...updatedBalance,
      adjustments: arrayUnion(newAdjustment),
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    }, { merge: true });

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error adjusting balance:', error);
    return {
      success: false,
      error: {
        code: 'FIRESTORE_ERROR',
        message: '残高調整に失敗しました',
      },
    };
  }
}

/**
 * 休暇使用時の残高更新
 */
export async function updateLeaveUsage(
  facilityId: string,
  staffId: string,
  yearMonth: string,
  usageType: 'publicHoliday' | 'paidLeave',
  usedCount: number,
  userId: string
): Promise<Result<void, LeaveBalanceError>> {
  try {
    const balanceId = `${yearMonth}_${staffId}`;
    const balanceRef = doc(db, 'facilities', facilityId, 'leaveBalances', balanceId);
    const balanceDoc = await getDoc(balanceRef);

    if (!balanceDoc.exists()) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '休暇残高が見つかりません',
        },
      };
    }

    const currentBalance = balanceDoc.data() as StaffLeaveBalance;
    const updatedBalance = { ...currentBalance };

    if (usageType === 'publicHoliday') {
      updatedBalance.publicHoliday = {
        ...updatedBalance.publicHoliday,
        used: usedCount,
        balance: updatedBalance.publicHoliday.allocated +
                 updatedBalance.publicHoliday.carriedOver -
                 usedCount,
      };
    } else {
      updatedBalance.paidLeave = {
        ...updatedBalance.paidLeave,
        used: usedCount,
        balance: updatedBalance.paidLeave.annualAllocated +
                 updatedBalance.paidLeave.carriedOver -
                 usedCount,
      };
    }

    await setDoc(balanceRef, {
      ...updatedBalance,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error updating leave usage:', error);
    return {
      success: false,
      error: {
        code: 'FIRESTORE_ERROR',
        message: '休暇使用の更新に失敗しました',
      },
    };
  }
}

/**
 * 前月のYYYY-MMを取得
 */
function getPreviousYearMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  if (month === 1) {
    return `${year - 1}-12`;
  }
  return `${year}-${String(month - 1).padStart(2, '0')}`;
}

/**
 * 初期残高を計算
 */
function calculateInitialBalance(
  staffId: string,
  yearMonth: string,
  settings: FacilityLeaveSettings,
  prevBalance: StaffLeaveBalance | null
): StaffLeaveBalance {
  // 公休の繰越計算
  let phCarriedOver = 0;
  if (prevBalance) {
    const prevPHBalance = prevBalance.publicHoliday.balance;
    if (settings.publicHoliday.maxCarryOver === -1) {
      phCarriedOver = prevPHBalance; // 無制限繰越
    } else {
      phCarriedOver = Math.min(prevPHBalance, settings.publicHoliday.maxCarryOver);
    }
  }

  // 有給の繰越計算
  let plCarriedOver = 0;
  let plAnnualAllocated = 10; // デフォルト年間付与数（スタッフ設定から取得すべき）
  let plExpiresAt = Timestamp.fromDate(getExpirationDate(settings.paidLeave.carryOverYears));

  if (prevBalance) {
    // 有効期限チェック
    const now = Timestamp.now();
    if (prevBalance.paidLeave.expiresAt.toMillis() > now.toMillis()) {
      plCarriedOver = prevBalance.paidLeave.balance;
      plExpiresAt = prevBalance.paidLeave.expiresAt;
    }
    plAnnualAllocated = prevBalance.paidLeave.annualAllocated;
  }

  const publicHoliday: PublicHolidayBalance = {
    allocated: settings.publicHoliday.monthlyAllocation,
    used: 0,
    carriedOver: phCarriedOver,
    balance: settings.publicHoliday.monthlyAllocation + phCarriedOver,
  };

  const paidLeave: PaidLeaveBalance = {
    annualAllocated: plAnnualAllocated,
    used: 0,
    carriedOver: plCarriedOver,
    balance: plAnnualAllocated + plCarriedOver,
    expiresAt: plExpiresAt,
  };

  return {
    id: `${yearMonth}_${staffId}`,
    staffId,
    yearMonth,
    publicHoliday,
    paidLeave,
    adjustments: [],
    updatedAt: Timestamp.now(),
    updatedBy: 'system',
  };
}

/**
 * 有効期限を計算（年度末 + 繰越年数）
 */
function getExpirationDate(carryOverYears: number): Date {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // 年度末（3月31日）を基準
  let fiscalYearEnd: Date;
  if (currentMonth >= 4) {
    // 4月以降は翌年3月31日が年度末
    fiscalYearEnd = new Date(currentYear + 1, 2, 31);
  } else {
    // 1-3月は当年3月31日が年度末
    fiscalYearEnd = new Date(currentYear, 2, 31);
  }

  // 繰越年数を加算
  fiscalYearEnd.setFullYear(fiscalYearEnd.getFullYear() + carryOverYears);

  return fiscalYearEnd;
}

/**
 * 残高ステータスを取得
 */
export function getBalanceStatus(balance: number): 'ok' | 'low' | 'negative' {
  if (balance < 0) return 'negative';
  if (balance <= 3) return 'low';
  return 'ok';
}
