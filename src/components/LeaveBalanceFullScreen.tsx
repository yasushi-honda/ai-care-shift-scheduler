/**
 * LeaveBalanceFullScreen.tsx
 *
 * Phase 64: 休暇残高管理 UX刷新
 * 全画面ダッシュボード
 * InspectionModeDashboard と同パターンで実装
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { Staff, StaffLeaveBalance, FacilityLeaveSettings } from '../../types';
import {
  getStaffLeaveBalances,
  getStaffLeaveBalance,
  adjustBalance,
  borrowFromNextMonth,
} from '../services/leaveBalanceService';
import { LeaveBalanceStaffCard } from './LeaveBalanceStaffCard';
import { PaidLeaveCountdown } from './PaidLeaveCountdown';
import { BorrowConfirmDialog } from './BorrowConfirmDialog';
import { SkeletonLoader } from './SkeletonLoader';
import { filterStaffByLeaveStatus, getNextYearMonth } from '../utils/leaveBalanceUtils';
import type { LeaveStatusFilter } from '../utils/leaveBalanceUtils';
import { DEFAULT_LEAVE_SETTINGS } from '../../constants';
import { Timestamp } from 'firebase/firestore';

// -- 詳細モーダルの型再利用（LeaveBalanceDashboard からインライン）
interface DetailModalState {
  staff: Staff;
  balance: StaffLeaveBalance;
}

interface LeaveBalanceFullScreenProps {
  facilityId: string;
  staffList: Staff[];
  yearMonth: string;
  leaveSettings: FacilityLeaveSettings | null;
  currentUserId: string;
  refreshTrigger?: number;
  onClose: () => void;
}

const FILTER_LABELS: { value: LeaveStatusFilter; label: string }[] = [
  { value: 'all', label: '全員' },
  { value: 'negative', label: '残高不足' },
  { value: 'borrowed', label: '前借り中' },
  { value: 'expiringSoon', label: '有給期限近' },
];

export const LeaveBalanceFullScreen: React.FC<LeaveBalanceFullScreenProps> = ({
  facilityId,
  staffList,
  yearMonth,
  leaveSettings,
  currentUserId,
  refreshTrigger,
  onClose,
}) => {
  const [balances, setBalances] = useState<Map<string, StaffLeaveBalance>>(new Map());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<LeaveStatusFilter>('all');
  const [detailModal, setDetailModal] = useState<DetailModalState | null>(null);
  const [borrowModal, setBorrowModal] = useState<{ staff: Staff; balance: StaffLeaveBalance } | null>(null);
  const [showCountdown, setShowCountdown] = useState(true);

  // 残高データをロード
  const loadBalances = useCallback(async () => {
    if (!facilityId || !yearMonth) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await getStaffLeaveBalances(facilityId, yearMonth);
      if (result.success) {
        const map = new Map<string, StaffLeaveBalance>();
        result.data.forEach((b) => map.set(b.staffId, b));
        setBalances(map);
      }
    } catch (e) {
      console.error('Error loading balances:', e);
    } finally {
      setLoading(false);
    }
  }, [facilityId, yearMonth]);

  useEffect(() => {
    void loadBalances();
  }, [loadBalances, refreshTrigger]);

  // スタッフの残高を取得（存在しない場合は初期化）
  const getOrCreateBalance = useCallback(async (staffId: string): Promise<StaffLeaveBalance | null> => {
    const existing = balances.get(staffId);
    if (existing) return existing;

    const settings = leaveSettings ?? {
      facilityId,
      publicHoliday: DEFAULT_LEAVE_SETTINGS.publicHoliday,
      paidLeave: DEFAULT_LEAVE_SETTINGS.paidLeave,
      updatedAt: Timestamp.now(),
      updatedBy: 'system',
    };
    const result = await getStaffLeaveBalance(facilityId, staffId, yearMonth, settings);
    if (result.success) {
      setBalances((prev) => new Map(prev).set(staffId, result.data));
      return result.data;
    }
    return null;
  }, [facilityId, yearMonth, leaveSettings, balances]);

  // 詳細モーダルを開く
  const handleOpenDetail = useCallback(async (staff: Staff) => {
    const balance = await getOrCreateBalance(staff.id);
    if (balance) setDetailModal({ staff, balance });
  }, [getOrCreateBalance]);

  // 前借りモーダルを開く
  const handleOpenBorrow = useCallback(async (staff: Staff) => {
    const balance = await getOrCreateBalance(staff.id);
    if (balance) setBorrowModal({ staff, balance });
  }, [getOrCreateBalance]);

  // 前借りを実行
  const handleConfirmBorrow = useCallback(async (amount: number) => {
    if (!borrowModal) return;
    const result = await borrowFromNextMonth(
      facilityId,
      borrowModal.staff.id,
      yearMonth,
      amount,
      currentUserId
    );
    if (result.success === false) {
      throw new Error(result.error.message);
    }
    // リロード
    await loadBalances();
  }, [borrowModal, facilityId, yearMonth, currentUserId, loadBalances]);

  // フィルタ済みスタッフリスト
  const filteredStaff = useMemo(
    () => filterStaffByLeaveStatus(staffList, balances, filter),
    [staffList, balances, filter]
  );

  const negativeCount = useMemo(() => {
    let n = 0;
    balances.forEach((b) => {
      if (b.publicHoliday.balance < 0 || b.paidLeave.balance < 0) n++;
    });
    return n;
  }, [balances]);

  return (
    <div className="flex flex-col h-full">
      {/* ヘッダー（InspectionModeパターン: bg-indigo-600） */}
      <div className="sticky top-0 z-10 bg-indigo-600 text-white px-4 py-3 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <span className="font-semibold">休暇残高ダッシュボード</span>
          <span className="text-indigo-200 text-sm">{yearMonth}</span>
          {negativeCount > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              要確認 {negativeCount}名
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="p-1.5 text-indigo-200 hover:text-white hover:bg-indigo-500 rounded transition-colors"
            title="印刷"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-indigo-200 hover:text-white hover:bg-indigo-500 rounded transition-colors"
            aria-label="閉じる"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="flex-1 overflow-auto p-4 bg-slate-50 space-y-4">

        {/* 有給時効カウントダウン */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <button
            onClick={() => setShowCountdown((v) => !v)}
            className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900 w-full text-left"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform ${showCountdown ? '' : '-rotate-90'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
            有給時効アラート
          </button>
          {showCountdown && (
            <div className="mt-3">
              <PaidLeaveCountdown staffList={staffList} balances={balances} threshold={90} />
            </div>
          )}
        </div>

        {/* フィルタタブ */}
        <div className="flex flex-wrap gap-1.5 print:hidden">
          {FILTER_LABELS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                filter === value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {label}
              {value === 'negative' && negativeCount > 0 && (
                <span className={`ml-1 text-xs font-bold ${filter === value ? 'text-white' : 'text-red-500'}`}>
                  {negativeCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* スタッフカードグリッド */}
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonLoader key={i} variant="card" />
            ))}
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <p className="text-sm">該当するスタッフがいません</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 print:grid-cols-3">
            {filteredStaff.map((staff) => (
              <LeaveBalanceStaffCard
                key={staff.id}
                staff={staff}
                balance={balances.get(staff.id)}
                onOpenDetail={handleOpenDetail}
                onBorrow={handleOpenBorrow}
              />
            ))}
          </div>
        )}
      </div>

      {/* 詳細モーダル（LeaveBalanceDashboard の modal を再利用する代わりにシンプル実装） */}
      {detailModal && (
        <DetailModal
          staff={detailModal.staff}
          balance={detailModal.balance}
          facilityId={facilityId}
          yearMonth={yearMonth}
          currentUserId={currentUserId}
          onClose={() => setDetailModal(null)}
          onAdjusted={loadBalances}
        />
      )}

      {/* 前借りモーダル */}
      {borrowModal && (
        <BorrowConfirmDialog
          staffId={borrowModal.staff.id}
          staffName={borrowModal.staff.name}
          facilityId={facilityId}
          yearMonth={yearMonth}
          currentBalance={borrowModal.balance.publicHoliday.balance}
          nextYearMonth={getNextYearMonth(yearMonth)}
          currentUserId={currentUserId}
          onConfirm={handleConfirmBorrow}
          onClose={() => setBorrowModal(null)}
        />
      )}
    </div>
  );
};

// ==================== 詳細モーダル（インライン） ====================

interface DetailModalProps {
  staff: Staff;
  balance: StaffLeaveBalance;
  facilityId: string;
  yearMonth: string;
  currentUserId: string;
  onClose: () => void;
  onAdjusted: () => void;
}

const DetailModal: React.FC<DetailModalProps> = ({
  staff,
  balance,
  facilityId,
  yearMonth,
  currentUserId,
  onClose,
  onAdjusted,
}) => {
  const [adjustType, setAdjustType] = useState<'publicHoliday' | 'paidLeave'>('publicHoliday');
  const [adjustAmount, setAdjustAmount] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [adjusting, setAdjusting] = useState(false);

  const handleAdjust = async () => {
    if (adjustAmount === 0 || !adjustReason.trim()) return;
    setAdjusting(true);
    try {
      await adjustBalance(facilityId, staff.id, yearMonth, {
        type: adjustType,
        amount: adjustAmount,
        reason: adjustReason,
        adjustedBy: currentUserId,
      }, currentUserId);
      setShowForm(false);
      setAdjustAmount(0);
      setAdjustReason('');
      onAdjusted();
    } finally {
      setAdjusting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-800">{staff.name} の休暇残高</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-md" aria-label="閉じる">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 space-y-4">
          {/* 公休 */}
          <div className={`p-3 rounded-lg border ${balance.publicHoliday.balance < 0 ? 'border-red-300 bg-red-50' : balance.publicHoliday.balance <= 3 ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
            <h4 className="font-medium text-slate-700 mb-2">【公休】{balance.yearMonth}</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>月間付与:</div><div className="text-right">{balance.publicHoliday.allocated}日</div>
              <div>前月繰越:</div><div className="text-right">{balance.publicHoliday.carriedOver}日</div>
              <div>使用済み:</div><div className="text-right">{balance.publicHoliday.used}日</div>
              <div className="font-medium">残高:</div>
              <div className={`text-right font-bold ${balance.publicHoliday.balance < 0 ? 'text-red-600' : balance.publicHoliday.balance <= 3 ? 'text-amber-600' : ''}`}>
                {balance.publicHoliday.balance}日
              </div>
            </div>
          </div>
          {/* 有給 */}
          <div className={`p-3 rounded-lg border ${balance.paidLeave.balance < 0 ? 'border-red-300 bg-red-50' : balance.paidLeave.balance <= 3 ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
            <h4 className="font-medium text-slate-700 mb-2">【有給】</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>年間付与:</div><div className="text-right">{balance.paidLeave.annualAllocated}日</div>
              <div>前年繰越:</div><div className="text-right">{balance.paidLeave.carriedOver}日</div>
              <div>使用済み:</div><div className="text-right">{balance.paidLeave.used}日</div>
              <div className="font-medium">残高:</div>
              <div className={`text-right font-bold ${balance.paidLeave.balance < 0 ? 'text-red-600' : balance.paidLeave.balance <= 3 ? 'text-amber-600' : ''}`}>
                {balance.paidLeave.balance}日
              </div>
              <div>有効期限:</div>
              <div className="text-right text-xs text-slate-500">{balance.paidLeave.expiresAt.toDate().toLocaleDateString('ja-JP')}</div>
            </div>
          </div>
          {/* 調整履歴 */}
          {balance.adjustments.length > 0 && (
            <div>
              <h4 className="font-medium text-slate-700 mb-2">調整履歴</h4>
              <div className="space-y-1 text-xs">
                {balance.adjustments.slice(-5).map((adj, i) => (
                  <div key={i} className="p-2 bg-slate-50 rounded-sm">
                    {adj.adjustedAt.toDate().toLocaleDateString('ja-JP')}{' '}
                    {adj.type === 'publicHoliday' ? '公休' : '有給'}{' '}
                    <span className={adj.amount > 0 ? 'text-green-600' : 'text-red-600'}>
                      {adj.amount > 0 ? '+' : ''}{adj.amount}日
                    </span>{' '}
                    ({adj.reason})
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* 調整フォーム */}
          {showForm ? (
            <div className="p-3 border border-slate-200 rounded-lg space-y-3">
              <h4 className="font-medium text-slate-700">残高調整</h4>
              <div>
                <label className="text-sm text-slate-600">種別</label>
                <select value={adjustType} onChange={(e) => setAdjustType(e.target.value as 'publicHoliday' | 'paidLeave')} className="w-full px-2 py-1 border border-slate-300 rounded-sm text-sm">
                  <option value="publicHoliday">公休</option>
                  <option value="paidLeave">有給</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-600">調整日数（正=追加、負=減算）</label>
                <input type="number" value={adjustAmount} onChange={(e) => setAdjustAmount(parseInt(e.target.value) || 0)} className="w-full px-2 py-1 border border-slate-300 rounded-sm text-sm" />
              </div>
              <div>
                <label className="text-sm text-slate-600">理由</label>
                <input type="text" value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="例: 管理者調整" className="w-full px-2 py-1 border border-slate-300 rounded-sm text-sm" />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowForm(false)} className="px-3 py-1 text-sm text-slate-600 hover:bg-slate-100 rounded-sm">キャンセル</button>
                <button onClick={handleAdjust} disabled={adjustAmount === 0 || !adjustReason.trim() || adjusting} className="px-3 py-1 text-sm text-white bg-care-primary hover:bg-care-primary/90 rounded-sm disabled:opacity-50">
                  {adjusting ? '処理中...' : '調整する'}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowForm(true)} className="w-full px-3 py-2 text-sm text-care-primary hover:bg-care-primary/10 rounded-lg border border-care-primary">
              + 残高を調整
            </button>
          )}
        </div>
        <div className="p-4 border-t border-slate-200 bg-slate-50 rounded-b-lg">
          <button onClick={onClose} className="w-full px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">閉じる</button>
        </div>
      </div>
    </div>
  );
};
