import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Staff,
  StaffLeaveBalance,
  FacilityLeaveSettings,
} from '../../types';
import {
  getStaffLeaveBalances,
  getStaffLeaveBalance,
  adjustBalance,
  getBalanceStatus,
} from '../services/leaveBalanceService';
import { DEFAULT_LEAVE_SETTINGS } from '../../constants';
import { Timestamp } from 'firebase/firestore';

// アイコンコンポーネント
const WarningIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className || "w-4 h-4"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const CheckIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className || "w-4 h-4"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const XMarkIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

interface LeaveBalanceDashboardProps {
  facilityId: string;
  staffList: Staff[];
  yearMonth: string;
  leaveSettings: FacilityLeaveSettings | null;
  currentUserId: string;
}

type FilterType = 'all' | 'low' | 'negative';
type SortType = 'name' | 'publicHoliday' | 'paidLeave';

export const LeaveBalanceDashboard: React.FC<LeaveBalanceDashboardProps> = ({
  facilityId,
  staffList,
  yearMonth,
  leaveSettings,
  currentUserId,
}) => {
  const [balances, setBalances] = useState<Map<string, StaffLeaveBalance>>(new Map());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortType>('name');
  const [selectedStaff, setSelectedStaff] = useState<{
    staff: Staff;
    balance: StaffLeaveBalance;
  } | null>(null);

  // 残高データをロード
  useEffect(() => {
    if (!facilityId || !yearMonth) {
      setLoading(false);
      return;
    }

    const loadBalances = async () => {
      setLoading(true);
      try {
        const result = await getStaffLeaveBalances(facilityId, yearMonth);
        if (result.success) {
          const balanceMap = new Map<string, StaffLeaveBalance>();
          result.data.forEach((balance) => {
            balanceMap.set(balance.staffId, balance);
          });
          setBalances(balanceMap);
        }
      } catch (error) {
        console.error('Error loading balances:', error);
      } finally {
        setLoading(false);
      }
    };

    loadBalances();
  }, [facilityId, yearMonth]);

  // スタッフの残高を取得（存在しない場合は初期化）
  const getOrCreateBalance = useCallback(async (staffId: string): Promise<StaffLeaveBalance | null> => {
    // 防御的チェック: facilityIdまたはyearMonthが未設定の場合は早期リターン
    if (!facilityId || !yearMonth) {
      console.warn('getOrCreateBalance: facilityId or yearMonth is not set');
      return null;
    }

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

  // フィルタ・ソート適用後のスタッフリスト
  const filteredStaffList = useMemo(() => {
    let list = [...staffList];

    // フィルタ
    if (filter !== 'all') {
      list = list.filter((staff) => {
        const balance = balances.get(staff.id);
        if (!balance) return false;
        const phStatus = getBalanceStatus(balance.publicHoliday.balance);
        const plStatus = getBalanceStatus(balance.paidLeave.balance);
        if (filter === 'negative') {
          return phStatus === 'negative' || plStatus === 'negative';
        }
        if (filter === 'low') {
          return phStatus === 'low' || plStatus === 'low' ||
                 phStatus === 'negative' || plStatus === 'negative';
        }
        return true;
      });
    }

    // ソート
    list.sort((a, b) => {
      if (sort === 'name') {
        return a.name.localeCompare(b.name, 'ja');
      }
      const balanceA = balances.get(a.id);
      const balanceB = balances.get(b.id);
      if (!balanceA || !balanceB) return 0;
      if (sort === 'publicHoliday') {
        return balanceA.publicHoliday.balance - balanceB.publicHoliday.balance;
      }
      return balanceA.paidLeave.balance - balanceB.paidLeave.balance;
    });

    return list;
  }, [staffList, balances, filter, sort]);

  // 詳細表示
  const handleShowDetail = useCallback(async (staff: Staff) => {
    const balance = await getOrCreateBalance(staff.id);
    if (balance) {
      setSelectedStaff({ staff, balance });
    }
  }, [getOrCreateBalance]);

  // 残高調整
  const handleAdjust = useCallback(async (
    type: 'publicHoliday' | 'paidLeave',
    amount: number,
    reason: string
  ) => {
    if (!selectedStaff) return;

    const result = await adjustBalance(
      facilityId,
      selectedStaff.staff.id,
      yearMonth,
      { type, amount, reason, adjustedBy: currentUserId },
      currentUserId
    );

    if (result.success) {
      // 残高を再取得
      const newBalance = await getOrCreateBalance(selectedStaff.staff.id);
      if (newBalance) {
        setSelectedStaff({ ...selectedStaff, balance: newBalance });
      }
    }
  }, [selectedStaff, facilityId, yearMonth, currentUserId, getOrCreateBalance]);

  const getStatusBadge = (status: 'ok' | 'low' | 'negative') => {
    switch (status) {
      case 'ok':
        return <CheckIcon className="w-4 h-4 text-green-600" />;
      case 'low':
        return <WarningIcon className="w-4 h-4 text-amber-500" />;
      case 'negative':
        return <WarningIcon className="w-4 h-4 text-red-500" />;
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-center">
        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-care-secondary"></div>
        <p className="mt-2 text-sm text-slate-500">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* フィルタ・ソート */}
      <div className="flex flex-wrap gap-4 items-center">
        <div>
          <label className="text-sm text-slate-600 mr-2">フィルタ:</label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterType)}
            className="px-2 py-1 border border-slate-300 rounded text-sm"
          >
            <option value="all">全員</option>
            <option value="low">残高少</option>
            <option value="negative">マイナス</option>
          </select>
        </div>
        <div>
          <label className="text-sm text-slate-600 mr-2">ソート:</label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortType)}
            className="px-2 py-1 border border-slate-300 rounded text-sm"
          >
            <option value="name">名前</option>
            <option value="publicHoliday">公休残高</option>
            <option value="paidLeave">有給残高</option>
          </select>
        </div>
      </div>

      {/* スタッフ一覧 */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-2 text-left font-medium text-slate-700">スタッフ名</th>
              <th className="px-4 py-2 text-right font-medium text-slate-700">公休残高</th>
              <th className="px-4 py-2 text-right font-medium text-slate-700">有給残高</th>
              <th className="px-4 py-2 text-center font-medium text-slate-700">ステータス</th>
              <th className="px-4 py-2 text-center font-medium text-slate-700">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredStaffList.map((staff) => {
              const balance = balances.get(staff.id);
              const phStatus = balance ? getBalanceStatus(balance.publicHoliday.balance) : 'ok';
              const plStatus = balance ? getBalanceStatus(balance.paidLeave.balance) : 'ok';
              const overallStatus = phStatus === 'negative' || plStatus === 'negative'
                ? 'negative'
                : phStatus === 'low' || plStatus === 'low'
                  ? 'low'
                  : 'ok';

              return (
                <tr key={staff.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{staff.name}</td>
                  <td className={`px-4 py-3 text-right ${phStatus === 'negative' ? 'text-red-600 font-bold' : phStatus === 'low' ? 'text-amber-600' : ''}`}>
                    {balance ? `${balance.publicHoliday.balance}日` : '-'}
                  </td>
                  <td className={`px-4 py-3 text-right ${plStatus === 'negative' ? 'text-red-600 font-bold' : plStatus === 'low' ? 'text-amber-600' : ''}`}>
                    {balance ? `${balance.paidLeave.balance}日` : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {getStatusBadge(overallStatus)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleShowDetail(staff)}
                      className="px-2 py-1 text-xs text-care-primary hover:bg-care-primary/10 rounded"
                    >
                      詳細
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredStaffList.length === 0 && (
        <div className="text-center py-8 text-slate-500">
          該当するスタッフがいません
        </div>
      )}

      {/* 詳細モーダル */}
      {selectedStaff && (
        <LeaveBalanceDetailModal
          staff={selectedStaff.staff}
          balance={selectedStaff.balance}
          onClose={() => setSelectedStaff(null)}
          onAdjust={handleAdjust}
        />
      )}
    </div>
  );
};

// 詳細モーダル
interface LeaveBalanceDetailModalProps {
  staff: Staff;
  balance: StaffLeaveBalance;
  onClose: () => void;
  onAdjust: (type: 'publicHoliday' | 'paidLeave', amount: number, reason: string) => void;
}

const LeaveBalanceDetailModal: React.FC<LeaveBalanceDetailModalProps> = ({
  staff,
  balance,
  onClose,
  onAdjust,
}) => {
  const [showAdjustForm, setShowAdjustForm] = useState(false);
  const [adjustType, setAdjustType] = useState<'publicHoliday' | 'paidLeave'>('publicHoliday');
  const [adjustAmount, setAdjustAmount] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');

  const handleSubmitAdjust = () => {
    if (adjustAmount === 0 || !adjustReason.trim()) return;
    onAdjust(adjustType, adjustAmount, adjustReason);
    setShowAdjustForm(false);
    setAdjustAmount(0);
    setAdjustReason('');
  };

  const phStatus = getBalanceStatus(balance.publicHoliday.balance);
  const plStatus = getBalanceStatus(balance.paidLeave.balance);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-800">
            {staff.name} の休暇残高
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
            aria-label="閉じる"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* 公休 */}
          <div className={`p-3 rounded-lg border ${phStatus === 'negative' ? 'border-red-300 bg-red-50' : phStatus === 'low' ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
            <h4 className="font-medium text-slate-700 mb-2">【公休】{balance.yearMonth}</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>月間付与:</div>
              <div className="text-right">{balance.publicHoliday.allocated}日</div>
              <div>前月繰越:</div>
              <div className="text-right">{balance.publicHoliday.carriedOver}日</div>
              <div>使用済み:</div>
              <div className="text-right">{balance.publicHoliday.used}日</div>
              <div className="font-medium">残高:</div>
              <div className={`text-right font-bold ${phStatus === 'negative' ? 'text-red-600' : phStatus === 'low' ? 'text-amber-600' : ''}`}>
                {balance.publicHoliday.balance}日
              </div>
            </div>
          </div>

          {/* 有給 */}
          <div className={`p-3 rounded-lg border ${plStatus === 'negative' ? 'border-red-300 bg-red-50' : plStatus === 'low' ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
            <h4 className="font-medium text-slate-700 mb-2">【有給】</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>年間付与:</div>
              <div className="text-right">{balance.paidLeave.annualAllocated}日</div>
              <div>前年繰越:</div>
              <div className="text-right">{balance.paidLeave.carriedOver}日</div>
              <div>使用済み:</div>
              <div className="text-right">{balance.paidLeave.used}日</div>
              <div className="font-medium">残高:</div>
              <div className={`text-right font-bold ${plStatus === 'negative' ? 'text-red-600' : plStatus === 'low' ? 'text-amber-600' : ''}`}>
                {balance.paidLeave.balance}日
              </div>
              <div>有効期限:</div>
              <div className="text-right text-xs text-slate-500">
                {balance.paidLeave.expiresAt.toDate().toLocaleDateString('ja-JP')}
              </div>
            </div>
          </div>

          {/* 調整履歴 */}
          {balance.adjustments.length > 0 && (
            <div>
              <h4 className="font-medium text-slate-700 mb-2">調整履歴</h4>
              <div className="space-y-1 text-xs">
                {balance.adjustments.slice(-5).map((adj, index) => (
                  <div key={index} className="p-2 bg-slate-50 rounded">
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
          {showAdjustForm ? (
            <div className="p-3 border border-slate-200 rounded-lg space-y-3">
              <h4 className="font-medium text-slate-700">残高調整</h4>
              <div>
                <label className="text-sm text-slate-600">種別</label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value as 'publicHoliday' | 'paidLeave')}
                  className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                >
                  <option value="publicHoliday">公休</option>
                  <option value="paidLeave">有給</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-600">調整日数（正=追加、負=減算）</label>
                <input
                  type="number"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(parseInt(e.target.value) || 0)}
                  className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="text-sm text-slate-600">理由</label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="例: 管理者調整"
                  className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowAdjustForm(false)}
                  className="px-3 py-1 text-sm text-slate-600 hover:bg-slate-100 rounded"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSubmitAdjust}
                  disabled={adjustAmount === 0 || !adjustReason.trim()}
                  className="px-3 py-1 text-sm text-white bg-care-primary hover:bg-care-primary/90 rounded disabled:opacity-50"
                >
                  調整する
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAdjustForm(true)}
              className="w-full px-3 py-2 text-sm text-care-primary hover:bg-care-primary/10 rounded-lg border border-care-primary"
            >
              + 残高を調整
            </button>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50 rounded-b-lg">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};

export default LeaveBalanceDashboard;
