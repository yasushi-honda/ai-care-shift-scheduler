
import React, { useState, useEffect } from 'react';
import type { WorkLogDetails } from '../types';

interface WorkLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (details: WorkLogDetails) => void;
  logData: {
    staffName: string;
    date: string; // YYYY-MM-DD
    shiftType: string;
  };
  currentLog?: WorkLogDetails;
}

const WorkLogModal: React.FC<WorkLogModalProps> = ({ isOpen, onClose, onSave, logData, currentLog }) => {
  const [workDetails, setWorkDetails] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      setWorkDetails(currentLog?.workDetails || '');
      setNotes(currentLog?.notes || '');
    }
  }, [isOpen, currentLog]);

  if (!isOpen) {
    return null;
  }
  
  const handleSave = () => {
    onSave({ workDetails, notes });
  };
  
  const [year, month, day] = logData.date.split('-');
  const formattedDate = `${year}年${month}月${day}日`;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
    >
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg transform transition-all" onClick={e => e.stopPropagation()}>
        <header className="p-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-800">業務日誌の編集</h2>
          <p className="text-sm text-slate-500">
            {`${formattedDate} - ${logData.staffName} (${logData.shiftType})`}
          </p>
        </header>
        
        <main className="p-6 space-y-4">
          <div>
            <label htmlFor="workDetails" className="block text-sm font-medium text-slate-700 mb-1">
              業務内容
            </label>
            <textarea
              id="workDetails"
              rows={5}
              value={workDetails}
              onChange={(e) => setWorkDetails(e.target.value)}
              className="w-full p-2 bg-white text-slate-800 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-care-secondary focus:border-care-secondary"
              placeholder="実施した業務内容を記録します（例：バイタルチェック、食事介助、レクリエーションの実施など）"
            ></textarea>
          </div>
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-1">
              特記事項
            </label>
            <textarea
              id="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2 bg-white text-slate-800 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-care-secondary focus:border-care-secondary"
              placeholder="特筆すべき事項があれば記録します（例：田中様の体調変化、ご家族からの連絡事項など）"
            ></textarea>
          </div>
        </main>
        
        <footer className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold bg-white text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-semibold bg-care-secondary text-white rounded-md hover:bg-care-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-care-secondary"
          >
            保存する
          </button>
        </footer>
      </div>
    </div>
  );
};

export default WorkLogModal;
