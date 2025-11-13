import React from 'react';

interface ButtonProps {
  variant?: 'primary' | 'danger' | 'success' | 'purple';
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

/**
 * 再利用可能なButtonコンポーネント
 *
 * アクセシビリティとデザインの一貫性を保証
 * アイコン付きボタンをサポート（SVG推奨）
 */
/**
 * Phase 19.2.2: タッチ操作最適化
 * - タッチターゲット最小サイズ: 44x44px (WCAG 2.1 AA準拠)
 * - タッチフィードバック: active:scale-95で視覚的フィードバック
 */
export function Button({
  variant = 'primary',
  icon,
  children,
  className = '',
  ...props
}: ButtonProps) {
  // Phase 19.2.2: 最小高さ44px、パディング調整でタッチターゲット確保
  const baseStyles = 'min-h-[44px] px-4 py-2.5 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 active:scale-95';

  // Phase 19.2.2: タッチフィードバック強化（active状態で色変化）
  const variantStyles = {
    primary: 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white',
    danger: 'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white',
    success: 'bg-green-600 hover:bg-green-700 active:bg-green-800 text-white',
    purple: 'bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white',
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {icon && <span className="inline-block" style={{ color: 'currentColor' }}>{icon}</span>}
      <span>{children}</span>
    </button>
  );
}
