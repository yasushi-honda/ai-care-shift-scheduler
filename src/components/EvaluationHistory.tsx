/**
 * Phase 54: 評価履歴一覧コンポーネント
 *
 * 過去の評価履歴をリスト表示し、比較できるようにする
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Timestamp } from 'firebase/firestore';
import type { EvaluationResult, EvaluationType } from '../../types';
import { getEvaluationHistory, type AIGenerationHistory } from '../services/evaluationHistoryService';

interface EvaluationHistoryProps {
  facilityId: string;
  targetMonth: string;
  onSelectEvaluation?: (evaluation: EvaluationResult) => void;
  className?: string;
}

/**
 * 日時をフォーマット
 */
function formatDate(timestamp: Timestamp | undefined): string {
  if (!timestamp) return '-';
  const date = timestamp.toDate();
  return date.toLocaleDateString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 評価タイプのラベルを取得
 */
function getEvaluationTypeLabel(type: EvaluationType | undefined): { text: string; color: string } {
  if (type === 'manual_reevaluate') {
    return { text: '手動評価', color: 'bg-purple-100 text-purple-700' };
  }
  return { text: '自動生成時', color: 'bg-blue-100 text-blue-700' };
}

/**
 * スコアの色を取得
 */
function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  if (score >= 30) return 'text-orange-600';
  return 'text-red-600';
}

export const EvaluationHistory: React.FC<EvaluationHistoryProps> = ({
  facilityId,
  targetMonth,
  onSelectEvaluation,
  className = '',
}) => {
  const [history, setHistory] = useState<AIGenerationHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 履歴を取得
  const fetchHistory = useCallback(async () => {
    if (!facilityId || !targetMonth) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await getEvaluationHistory(facilityId, targetMonth, 10);
      setHistory(data);
    } catch (err) {
      console.error('評価履歴の取得に失敗:', err);
      setError('履歴の取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [facilityId, targetMonth]);

  // 展開時に履歴を取得
  useEffect(() => {
    if (isExpanded) {
      fetchHistory();
    }
  }, [isExpanded, fetchHistory]);

  // 履歴選択
  const handleSelect = (item: AIGenerationHistory) => {
    setSelectedId(item.id || null);
    if (onSelectEvaluation && item.evaluation) {
      onSelectEvaluation(item.evaluation);
    }
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* ヘッダー（折りたたみトグル） */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium text-gray-700">評価履歴</span>
          {history.length > 0 && !isExpanded && (
            <span className="text-sm text-gray-500">({history.length}件)</span>
          )}
        </div>
        <svg
          className={`h-5 w-5 text-gray-400 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* 履歴リスト */}
      {isExpanded && (
        <div className="border-t border-gray-200">
          {isLoading ? (
            <div className="p-4 text-center">
              <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
              <p className="mt-1 text-sm text-gray-500">読み込み中...</p>
            </div>
          ) : error ? (
            <div className="p-4 text-center text-red-600 text-sm">
              {error}
              <button
                onClick={fetchHistory}
                className="ml-2 text-purple-600 hover:underline"
              >
                再試行
              </button>
            </div>
          ) : history.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              この月の評価履歴はありません
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
              {history.map((item, index) => {
                const isSelected = item.id === selectedId;
                const typeLabel = getEvaluationTypeLabel(item.evaluationType);
                const score = item.evaluation?.overallScore ?? 0;
                const violationCount = item.evaluation?.constraintViolations?.length ?? 0;

                return (
                  <li key={item.id || index}>
                    <button
                      type="button"
                      onClick={() => handleSelect(item)}
                      className={`w-full px-4 py-3 flex items-center gap-4 hover:bg-gray-50 transition-colors text-left ${
                        isSelected ? 'bg-purple-50' : ''
                      }`}
                    >
                      {/* 日時 */}
                      <div className="shrink-0 text-xs text-gray-500 w-20">
                        {formatDate(item.createdAt)}
                      </div>

                      {/* タイプラベル */}
                      <span className={`shrink-0 text-xs px-2 py-0.5 rounded-sm ${typeLabel.color}`}>
                        {typeLabel.text}
                      </span>

                      {/* スコアと違反件数 */}
                      <div className="flex-1 flex items-center gap-4">
                        <span className={`font-bold ${getScoreColor(score)}`}>
                          {score}点
                        </span>
                        <span className="text-xs text-gray-500">
                          違反: {violationCount}件
                        </span>
                      </div>

                      {/* 選択インジケーター */}
                      {isSelected && (
                        <svg className="h-4 w-4 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* リフレッシュボタン */}
          {!isLoading && history.length > 0 && (
            <div className="p-2 border-t border-gray-100 text-center">
              <button
                onClick={fetchHistory}
                className="text-xs text-gray-500 hover:text-purple-600 flex items-center justify-center gap-1 mx-auto"
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                更新
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EvaluationHistory;
