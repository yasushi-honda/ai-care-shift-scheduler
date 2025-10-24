import React from 'react';
import type { ScheduleVersion } from '../types';

interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  versions: ScheduleVersion[];
  onRestore: (versionNumber: number) => void;
  loading: boolean;
}

const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  isOpen,
  onClose,
  versions,
  onRestore,
  loading,
}) => {
  if (!isOpen) return null;

  const formatDate = (timestamp: any): string => {
    if (!timestamp) return '不明';

    try {
      // Firestore Timestampの場合
      if (timestamp.toDate) {
        return timestamp.toDate().toLocaleString('ja-JP', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });
      }
      // Date objectの場合
      if (timestamp instanceof Date) {
        return timestamp.toLocaleString('ja-JP', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });
      }
      return '不明';
    } catch (err) {
      console.error('Date formatting error:', err);
      return '不明';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">バージョン履歴</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="閉じる"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-care-secondary"></div>
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-16 w-16 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-slate-800">バージョン履歴がありません</h3>
              <p className="mt-2 text-sm text-slate-500">シフトを確定すると、バージョン履歴が作成されます。</p>
            </div>
          ) : (
            <div className="space-y-3">
              {versions.map((version) => (
                <div
                  key={version.id}
                  className="border border-slate-200 rounded-lg p-4 hover:border-care-secondary hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-care-secondary text-white font-bold text-sm">
                          v{version.versionNumber}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            {version.changeDescription || '変更なし'}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatDate(version.createdAt)} · 作成者: {version.createdBy}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-slate-600 bg-slate-50 p-3 rounded">
                        <span className="font-medium">スタッフ数:</span> {version.staffSchedules?.length || 0}名
                        {version.previousVersion !== undefined && (
                          <span className="ml-4">
                            <span className="font-medium">前バージョン:</span> v{version.previousVersion}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => onRestore(version.versionNumber)}
                      className="ml-4 px-4 py-2 bg-care-secondary hover:bg-care-dark text-white text-sm font-semibold rounded-lg transition-colors duration-200"
                    >
                      このバージョンに復元
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors duration-200"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};

export default VersionHistoryModal;
