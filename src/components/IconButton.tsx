import React from 'react';
import { Link } from 'react-router-dom';
import { Tooltip } from './Tooltip';

type IconButtonElement = 'button' | 'a' | typeof Link;

interface IconButtonBaseProps {
  /** アイコン要素 */
  icon: React.ReactNode;
  /** アクセシビリティ用ラベル（ツールチップにも表示） */
  label: string;
  /** 無効状態 */
  disabled?: boolean;
  /** バリアント（light: ヘッダー用, dark: 通常用） */
  variant?: 'light' | 'dark';
  /** 追加のクラス名 */
  className?: string;
  /** ツールチップの表示位置 */
  tooltipPosition?: 'top' | 'bottom' | 'left' | 'right';
}

interface IconButtonAsButton extends IconButtonBaseProps {
  as?: 'button';
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  href?: never;
  to?: never;
  target?: never;
  rel?: never;
}

interface IconButtonAsAnchor extends IconButtonBaseProps {
  as: 'a';
  href: string;
  target?: string;
  rel?: string;
  onClick?: never;
  to?: never;
}

interface IconButtonAsLink extends IconButtonBaseProps {
  as: typeof Link;
  to: string;
  onClick?: never;
  href?: never;
  target?: never;
  rel?: never;
}

type IconButtonProps = IconButtonAsButton | IconButtonAsAnchor | IconButtonAsLink;

/**
 * Phase 42: アイコンのみのボタンコンポーネント
 *
 * ヘッダーナビゲーション用に最適化
 * - ホバー時にツールチップでラベルを表示
 * - aria-label属性でアクセシビリティ対応
 * - Link/a/buttonとしてレンダリング可能
 */
export function IconButton({
  icon,
  label,
  disabled = false,
  variant = 'dark',
  className = '',
  tooltipPosition = 'bottom',
  as = 'button',
  ...props
}: IconButtonProps) {
  // バリアント別スタイル
  const variantStyles = {
    light: 'hover:bg-white/30 text-white focus:ring-white/50',
    dark: 'hover:bg-gray-100 text-gray-600 focus:ring-gray-400',
  };

  // 共通スタイル
  const buttonStyles = `
    w-10 h-10 rounded-lg
    inline-flex items-center justify-center
    transition-colors duration-200
    focus:outline-hidden focus:ring-2 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
    ${variantStyles[variant]}
    ${className}
  `;

  const content = (
    <span className="w-5 h-5 inline-flex items-center justify-center">
      {icon}
    </span>
  );

  // buttonとしてレンダリング
  if (as === 'button') {
    const buttonProps = props as IconButtonAsButton;
    return (
      <Tooltip content={label} position={tooltipPosition}>
        <button
          type="button"
          aria-label={label}
          disabled={disabled}
          className={buttonStyles}
          onClick={buttonProps.onClick}
        >
          {content}
        </button>
      </Tooltip>
    );
  }

  // aタグとしてレンダリング
  if (as === 'a') {
    const anchorProps = props as IconButtonAsAnchor;
    return (
      <Tooltip content={label} position={tooltipPosition}>
        <a
          aria-label={label}
          className={buttonStyles}
          href={anchorProps.href}
          target={anchorProps.target}
          rel={anchorProps.rel}
        >
          {content}
        </a>
      </Tooltip>
    );
  }

  // React Router Linkとしてレンダリング
  const linkProps = props as IconButtonAsLink;
  return (
    <Tooltip content={label} position={tooltipPosition}>
      <Link
        aria-label={label}
        className={buttonStyles}
        to={linkProps.to}
      >
        {content}
      </Link>
    </Tooltip>
  );
}

export default IconButton;
