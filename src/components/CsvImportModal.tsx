import React, { useState, useRef, useCallback } from 'react';
import type { RowValidationResult } from '../utils/importCSV';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  onTemplateDownload: () => void;
  templateButtonLabel?: string;
  onFileSelect: (csvContent: string) => void;
  validationResults: RowValidationResult[] | null;
  onImport: () => Promise<void>;
  importDisabled?: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
}

/**
 * CsvImportModal
 *
 * 再利用可能なCSVインポートモーダル
 * - テンプレートCSVダウンロード
 * - ファイルアップロード（ドラッグ＆ドロップ対応）
 * - バリデーション結果プレビュー
 * - 一括インポート実行
 */
export function CsvImportModal({
  isOpen,
  onClose,
  title,
  description,
  onTemplateDownload,
  templateButtonLabel = 'テンプレートをダウンロード',
  onFileSelect,
  validationResults,
  onImport,
  importDisabled = false,
  totalRows,
  validRows,
  invalidRows,
}: CsvImportModalProps): React.ReactElement | null {
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileRead = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      alert('CSVファイルを選択してください');
      return;
    }
    setFileName(file.name);
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      onFileSelect(content);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileRead(file);
  }, [onFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileRead(file);
    // リセット（同じファイルを再選択可能にする）
    e.target.value = '';
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      await onImport();
      setImportResult({ success: validRows, failed: invalidRows });
    } catch {
      // エラーは親コンポーネントで処理
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setFileName(null);
    setImportResult(null);
    setDragOver(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="csv-import-modal-title"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[85vh] flex flex-col">
        {/* ヘッダー */}
        <div className="flex justify-between items-center p-6 pb-4 border-b">
          <div>
            <h2 id="csv-import-modal-title" className="text-xl font-bold text-gray-900">{title}</h2>
            {description && <p className="text-sm text-gray-600 mt-1">{description}</p>}
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="閉じる"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* インポート完了メッセージ */}
          {importResult && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-green-900">
                    インポートが完了しました
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    {importResult.success}件を登録しました
                    {importResult.failed > 0 && `（${importResult.failed}件はスキップ）`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 1: テンプレートダウンロード */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900">テンプレートCSVをダウンロード</p>
                <p className="text-xs text-blue-700 mt-1">テンプレートに従ってデータを入力してください。サンプルデータ付きです。</p>
                <button
                  onClick={onTemplateDownload}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {templateButtonLabel}
                </button>
              </div>
            </div>
          </div>

          {/* Step 2: ファイルアップロード */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-gray-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">CSVファイルをアップロード</p>
                <div
                  className={`mt-2 border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer
                    ${dragOver
                      ? 'border-blue-500 bg-blue-50'
                      : fileName
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                  {fileName ? (
                    <div className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm text-green-700 font-medium">{fileName}</span>
                      <span className="text-xs text-gray-500">（クリックで変更）</span>
                    </div>
                  ) : (
                    <div>
                      <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="text-sm text-gray-600">ここにCSVファイルをドロップ</p>
                      <p className="text-xs text-gray-500 mt-1">またはクリックしてファイルを選択</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Step 3: バリデーション結果 */}
          {validationResults && validationResults.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-gray-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">プレビュー・確認</p>
                  <div className="flex gap-3 mt-2 text-xs">
                    <span className="px-2 py-1 bg-gray-100 rounded">
                      全{totalRows}行
                    </span>
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                      有効 {validRows}行
                    </span>
                    {invalidRows > 0 && (
                      <span className="px-2 py-1 bg-red-100 text-red-800 rounded">
                        エラー {invalidRows}行
                      </span>
                    )}
                  </div>

                  {/* バリデーション結果テーブル */}
                  <div className="mt-3 max-h-60 overflow-y-auto border rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left text-gray-600 font-medium">行</th>
                          <th className="px-3 py-2 text-left text-gray-600 font-medium">名前</th>
                          <th className="px-3 py-2 text-left text-gray-600 font-medium">状態</th>
                          <th className="px-3 py-2 text-left text-gray-600 font-medium">詳細</th>
                        </tr>
                      </thead>
                      <tbody>
                        {validationResults.map((result) => (
                          <tr
                            key={result.rowIndex}
                            className={result.isValid ? 'bg-white' : 'bg-red-50'}
                          >
                            <td className="px-3 py-2 text-gray-500">{result.rowIndex + 1}</td>
                            <td className="px-3 py-2 text-gray-900">
                              {result.data['名前'] || result.data['施設名'] || '-'}
                            </td>
                            <td className="px-3 py-2">
                              {result.isValid ? (
                                <span className="text-green-600">OK</span>
                              ) : (
                                <span className="text-red-600">エラー</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-red-700">
                              {result.errors.join('; ')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="flex gap-3 p-6 pt-4 border-t">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {importResult ? '閉じる' : 'キャンセル'}
          </button>
          {!importResult && (
            <button
              type="button"
              onClick={handleImport}
              disabled={importing || importDisabled || validRows === 0}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  インポート中...
                </span>
              ) : (
                `${validRows}件をインポート`
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
