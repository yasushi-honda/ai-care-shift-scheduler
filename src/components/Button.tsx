import React from 'react';

interface ButtonProps {
  /** ボタンのバリアント（スタイル種別） */
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost' | 'outline-solid';
  /** ボタンのサイズ */
  size?: 'sm' | 'md' | 'lg';
  /** アイコン（左側に表示） */
  icon?: React.ReactNode;
  /** ボタンのラベル */
  children: React.ReactNode;
  /** 追加のクラス名 */
  className?: string;
  /** クリックハンドラー */
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  /** 無効状態 */
  disabled?: boolean;
  /** ボタンタイプ */
  type?: 'button' | 'submit' | 'reset';
  /** data-testid属性 */
  'data-testid'?: string;
}

/**
 * 再利用可能なButtonコンポーネント
 *
 * Phase 42: デザイン統一のためvariant/size拡張
 * - 6種類のvariant: primary, secondary, success, danger, ghost, outline
 * - 3種類のsize: sm, md, lg
 *
 * アクセシビリティ:
 * - タッチターゲット最小サイズ: 44x44px (WCAG 2.1 AA準拠)
 * - タッチフィードバック: active:scale-95で視覚的フィードバック
 */
export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  children,
  className = '',
  ...props
}: ButtonProps) {
  // 共通の基本スタイル
  const baseStyles = `
    rounded-lg font-medium transition-all duration-200
    disabled:opacity-50 disabled:cursor-not-allowed
    inline-flex items-center justify-center gap-2
    active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-offset-2
  `;

  // サイズ別スタイル（Phase 42追加）
  const sizeStyles = {
    sm: 'min-h-[36px] px-3 py-1.5 text-sm',
    md: 'min-h-[40px] px-4 py-2 text-sm',
    lg: 'min-h-[48px] px-5 py-2.5 text-base',
  };

  // バリアント別スタイル（Phase 42拡張）
  const variantStyles = {
    // プライマリ: 主要アクション
    primary: 'bg-btn-primary hover:bg-btn-primary-hover active:bg-btn-primary-active text-white focus:ring-indigo-500',
    // セカンダリ: 副次アクション
    secondary: 'bg-btn-secondary hover:bg-btn-secondary-hover active:bg-gray-300 text-btn-secondary-text focus:ring-gray-400',
    // サクセス: 確定・完了アクション
    success: 'bg-btn-success hover:bg-btn-success-hover active:bg-btn-success-active text-white focus:ring-emerald-500',
    // デンジャー: 削除・警告アクション
    danger: 'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white focus:ring-red-500',
    // ゴースト: 控えめなアクション（Phase 42追加）
    ghost: 'bg-transparent hover:bg-gray-100 active:bg-gray-200 text-gray-600 focus:ring-gray-400',
    // アウトライン: エクスポート系（Phase 42追加）
    outline: 'bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-700 border border-gray-300 focus:ring-gray-400',
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {icon && <span className="inline-flex items-center" style={{ color: 'currentColor' }}>{icon}</span>}
      <span>{children}</span>
    </button>
  );
}

export default Button;
