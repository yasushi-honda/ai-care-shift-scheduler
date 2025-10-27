import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'danger' | 'success' | 'purple';
  icon?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * 再利用可能なButtonコンポーネント
 *
 * アクセシビリティとデザインの一貫性を保証
 * アイコン付きボタンをサポート（SVG推奨）
 */
export function Button({
  variant = 'primary',
  icon,
  children,
  className = '',
  ...props
}: ButtonProps) {
  const baseStyles = 'px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2';

  const variantStyles = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    success: 'bg-green-600 hover:bg-green-700 text-white',
    purple: 'bg-purple-600 hover:bg-purple-700 text-white',
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
