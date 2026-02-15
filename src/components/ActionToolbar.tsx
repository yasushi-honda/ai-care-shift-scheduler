/**
 * ActionToolbar - アクションツールバーコンポーネント
 *
 * Phase 42: アクションボタン統合
 * Phase 43: デモボタン削除（不要な開発用機能）
 *
 * シフト表の上部に表示するアクションボタンを統合
 * - 編集グループ: 下書き保存、確定
 * - ユーティリティグループ: バージョン履歴、CSVエクスポート
 */

import React from 'react';
import { Button } from './Button';
import { ButtonGroup } from './ButtonGroup';

// Heroicons (Outline)
const SaveIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
  </svg>
);

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const ClockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const DownloadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

interface ActionToolbarProps {
  /** 下書き保存クリック */
  onSaveClick: () => void;
  /** 確定クリック */
  onConfirmClick: () => void;
  /** バージョン履歴クリック */
  onHistoryClick: () => void;
  /** CSVエクスポートクリック */
  onExportClick: () => void;
  /** ローディング状態 */
  isLoading: boolean;
  /** 保存可能かどうか */
  canSave: boolean;
  /** 確定可能かどうか */
  canConfirm: boolean;
  /** 履歴表示可能かどうか */
  canShowHistory: boolean;
  /** 追加のクラス名 */
  className?: string;
}

export function ActionToolbar({
  onSaveClick,
  onConfirmClick,
  onHistoryClick,
  onExportClick,
  isLoading,
  canSave,
  canConfirm,
  canShowHistory,
  className = '',
}: ActionToolbarProps) {
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      {/* 編集グループ */}
      <ButtonGroup>
        <Button
          variant="secondary"
          size="md"
          icon={<SaveIcon />}
          onClick={onSaveClick}
          disabled={isLoading || !canSave}
          data-testid="save-draft-button"
        >
          保存
        </Button>
        <Button
          variant="success"
          size="md"
          icon={<CheckIcon />}
          onClick={onConfirmClick}
          disabled={isLoading || !canConfirm}
          data-testid="confirm-button"
        >
          確定
        </Button>
      </ButtonGroup>

      {/* ユーティリティグループ */}
      <ButtonGroup separated>
        <Button
          variant="ghost"
          size="md"
          icon={<ClockIcon />}
          onClick={onHistoryClick}
          disabled={!canShowHistory}
          data-testid="version-history-button"
        >
          履歴
        </Button>
        <Button
          variant="outline-solid"
          size="md"
          icon={<DownloadIcon />}
          onClick={onExportClick}
          data-testid="csv-export-button"
        >
          CSV
        </Button>
      </ButtonGroup>
    </div>
  );
}

export default ActionToolbar;
