/**
 * SubmissionGuideModal.tsx
 *
 * Phase 61: 電子申請フロー案内モーダル（Task 7.1）
 *
 * 機能:
 * - GビズIDを使った電子申請の4ステップを案内
 * - 「この案内を印刷する」ボタン（Task 7.1）
 * - エクスポート完了トーストのリンクから開く（Task 7.2）
 */

import React from 'react';

interface SubmissionGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STEPS = [
  {
    number: 1,
    title: 'ダウンロードしたExcelファイルを確認する',
    description:
      'ダウンロードされた「標準様式第1号」または「予実比較」のExcelファイルを開き、内容（施設名・スタッフ名・勤務時間）に誤りがないか確認してください。',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    number: 2,
    title: 'GビズIDでログインする',
    description:
      '介護事業所向け電子申請システム（カイポケ申請窓口・e-KANTAN等）にアクセスし、GビズIDのプライムアカウントまたはエントリーアカウントでログインしてください。',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
      </svg>
    ),
  },
  {
    number: 3,
    title: 'フォームを選択してExcelをアップロードする',
    description:
      'ログイン後、申請メニューから「勤務形態一覧表（訪問介護計画書）」などの該当する様式を選択し、確認済みのExcelファイルをアップロードしてください。内容を確認後、送信ボタンを押します。',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
  },
  {
    number: 4,
    title: '受付番号を控えて提出完了',
    description:
      '送信完了後に表示される受付番号を必ずメモまたはスクリーンショットで保存してください。行政機関から確認が来た際に必要となります。書類アーカイブタブにも記録として残しておくことをお勧めします。',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export function SubmissionGuideModal({
  isOpen,
  onClose,
}: SubmissionGuideModalProps): React.ReactElement | null {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* モーダルヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">電子申請の手順</h2>
            <p className="text-xs text-gray-500 mt-0.5">GビズIDポータルへのアップロード手順</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="閉じる"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ステップ一覧 */}
        <div className="px-6 py-4 space-y-4">
          {STEPS.map((step, index) => (
            <div key={step.number} className="flex gap-4">
              {/* ステップ番号・アイコン */}
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 text-white font-bold text-sm shrink-0">
                  {step.number}
                </div>
                {index < STEPS.length - 1 && (
                  <div className="w-0.5 flex-1 bg-blue-200 mt-2 mb-0 min-h-4" />
                )}
              </div>
              {/* ステップ内容 */}
              <div className="pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-blue-600">{step.icon}</span>
                  <h3 className="text-sm font-bold text-gray-900">{step.title}</h3>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* フッター */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-800 font-medium transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            この案内を印刷する
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
