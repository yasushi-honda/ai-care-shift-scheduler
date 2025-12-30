/**
 * useDiagnosis カスタムフック
 * Phase 55: データ設定診断機能
 *
 * シフト生成前にデータ設定の問題を診断し、
 * ユーザーにフィードバックを提供するためのフック
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Staff, ShiftRequirement, LeaveRequest } from '../../types';
import { DiagnosisResult } from '../types/diagnosis';
import { diagnose } from '../services/diagnosisService';

/**
 * 自動診断オプション
 */
export interface AutoDiagnosisOptions {
  /** スタッフリスト */
  staffList: Staff[];
  /** シフト要件 */
  requirements: ShiftRequirement;
  /** 休暇申請 */
  leaveRequests: LeaveRequest;
  /** 自動診断を有効にするか */
  enabled?: boolean;
  /** デバウンス時間（ms）デフォルト300ms */
  debounceMs?: number;
}

/**
 * 診断フックの状態
 */
type DiagnosisStatus = 'idle' | 'loading' | 'completed' | 'error';

/**
 * useDiagnosisの戻り値の型
 */
export interface UseDiagnosisReturn {
  /** 現在のステータス */
  status: DiagnosisStatus;
  /** 診断結果 */
  result: DiagnosisResult | null;
  /** エラーメッセージ */
  error: string | null;
  /** ローディング中かどうか */
  isLoading: boolean;
  /** 診断を実行する */
  runDiagnosis: (
    staffList: Staff[],
    requirements: ShiftRequirement,
    leaveRequests: LeaveRequest
  ) => Promise<void>;
  /** 診断結果をクリアする */
  clearDiagnosis: () => void;
}

/**
 * データ設定診断フック
 *
 * スタッフリストとシフト要件を受け取り、需給バランスや
 * 潜在的な問題を診断します。
 *
 * @returns 診断状態と操作関数
 *
 * @example
 * ```tsx
 * const { result, isLoading, runDiagnosis, clearDiagnosis } = useDiagnosis();
 *
 * // 診断実行
 * await runDiagnosis(staffList, requirements, leaveRequests);
 *
 * // 結果確認
 * if (result?.status === 'warning') {
 *   // 警告表示
 * }
 * ```
 */
export function useDiagnosis(
  autoDiagnosisOptions?: AutoDiagnosisOptions
): UseDiagnosisReturn {
  const [status, setStatus] = useState<DiagnosisStatus>('idle');
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * 診断を実行する
   */
  const runDiagnosis = useCallback(
    async (
      staffList: Staff[],
      requirements: ShiftRequirement,
      leaveRequests: LeaveRequest
    ): Promise<void> => {
      setStatus('loading');
      setError(null);

      try {
        // クライアントサイドで同期的に計算（1秒以内に完了）
        const diagnosisResult = diagnose(staffList, requirements, leaveRequests);
        setResult(diagnosisResult);
        setStatus('completed');
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : '診断中にエラーが発生しました';
        setError(errorMessage);
        setStatus('error');
      }
    },
    []
  );

  /**
   * 診断結果をクリアする
   */
  const clearDiagnosis = useCallback(() => {
    setStatus('idle');
    setResult(null);
    setError(null);
  }, []);

  /**
   * 自動診断トリガー
   * - 画面を開いた時に自動実行
   * - データが変更された時にデバウンス付きで再実行
   */
  useEffect(() => {
    if (!autoDiagnosisOptions) return;

    const {
      staffList,
      requirements,
      leaveRequests,
      enabled = true,
      debounceMs = 300,
    } = autoDiagnosisOptions;

    if (!enabled) return;

    // 既存のタイマーをクリア
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // デバウンス付きで診断を実行
    debounceTimerRef.current = setTimeout(() => {
      runDiagnosis(staffList, requirements, leaveRequests);
    }, debounceMs);

    // クリーンアップ
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [
    autoDiagnosisOptions?.staffList,
    autoDiagnosisOptions?.requirements,
    autoDiagnosisOptions?.leaveRequests,
    autoDiagnosisOptions?.enabled,
    autoDiagnosisOptions?.debounceMs,
    runDiagnosis,
  ]);

  return {
    status,
    result,
    error,
    isLoading: status === 'loading',
    runDiagnosis,
    clearDiagnosis,
  };
}
