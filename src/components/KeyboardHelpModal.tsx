import React, { useEffect } from 'react';

interface KeyboardHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Phase 37: キーボードショートカットヘルプモーダル
 */
const KeyboardHelpModal: React.FC<KeyboardHelpModalProps> = ({ isOpen, onClose }) => {
  // Escキーで閉じる
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shortcuts = [
    { category: '基本操作', items: [
      { key: 'Tab', description: 'フォーカス移動' },
      { key: 'Enter', description: 'モーダル表示' },
      { key: 'Space', description: 'シフトサイクル' },
    ]},
    { category: '履歴操作', items: [
      { key: 'Ctrl+Z', description: 'アンドゥ（元に戻す）' },
      { key: 'Ctrl+Shift+Z', description: 'リドゥ（やり直し）' },
    ]},
    { category: 'セル移動', items: [
      { key: '↑↓←→', description: '1セル移動' },
      { key: 'Home', description: '1日目へ' },
      { key: 'End', description: '月末へ' },
    ]},
    { category: 'ジャンプ移動', items: [
      { key: 'Ctrl+↑', description: '最初のスタッフへ' },
      { key: 'Ctrl+↓', description: '最後のスタッフへ' },
      { key: 'Ctrl+←', description: '1日目へ' },
      { key: 'Ctrl+→', description: '月末へ' },
    ]},
    { category: '週単位移動', items: [
      { key: 'PageUp', description: '7日前へ' },
      { key: 'PageDown', description: '7日後へ' },
    ]},
    { category: 'その他', items: [
      { key: '?', description: 'このヘルプを表示' },
      { key: 'Esc', description: 'モーダルを閉じる' },
    ]},
  ];

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="keyboard-help-title"
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b px-6 py-4">
          <h2 id="keyboard-help-title" className="text-xl font-bold text-slate-800">
            キーボードショートカット
          </h2>
        </div>

        <div className="px-6 py-4 space-y-4">
          {shortcuts.map((section) => (
            <div key={section.category}>
              <h3 className="text-sm font-semibold text-slate-600 mb-2">
                {section.category}
              </h3>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <div
                    key={item.key}
                    className="flex justify-between items-center py-1 border-b border-slate-100 last:border-0"
                  >
                    <span className="text-sm text-slate-700">{item.description}</span>
                    <kbd className="px-2 py-1 bg-slate-100 rounded-sm text-xs font-mono text-slate-600 border border-slate-200">
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="sticky bottom-0 bg-white border-t px-6 py-4">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            閉じる (Esc)
          </button>
        </div>
      </div>
    </div>
  );
};

export default KeyboardHelpModal;
