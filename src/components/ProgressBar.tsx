/**
 * ProgressBar コンポーネント
 *
 * Phase 19.2.4: UIフィードバックの改善 - プログレスバー
 *
 * 特徴:
 * - 進捗状況の視覚的表示
 * - 確定進捗（0-100%）と不確定進捗（アニメーション）の両方サポート
 * - 複数のサイズとバリエーション
 * - アクセシビリティ対応（role, aria-*)
 */

import React from 'react';

/**
 * プログレスバーのバリエーション
 */
export type ProgressBarVariant = 'primary' | 'success' | 'warning' | 'danger' | 'info';

/**
 * プログレスバーのサイズ
 */
export type ProgressBarSize = 'small' | 'medium' | 'large';

/**
 * ProgressBarのプロパティ
 */
export interface ProgressBarProps {
  /**
   * 進捗率（0-100）
   * undefinedの場合は不確定進捗バー（indeterminate）を表示
   */
  value?: number;

  /**
   * バリエーション
   * デフォルト: 'primary'
   */
  variant?: ProgressBarVariant;

  /**
   * サイズ
   * デフォルト: 'medium'
   */
  size?: ProgressBarSize;

  /**
   * ラベルを表示するか
   * デフォルト: false
   */
  showLabel?: boolean;

  /**
   * カスタムラベル
   * 指定しない場合は「{value}%」が表示される
   */
  label?: string;

  /**
   * 追加のCSSクラス
   */
  className?: string;

  /**
   * アニメーションを滑らかにするか
   * デフォルト: true
   */
  animated?: boolean;

  /**
   * ストライプパターンを表示するか
   * デフォルト: false
   */
  striped?: boolean;
}

/**
 * ProgressBar
 *
 * 操作の進捗状況を視覚的に表示するコンポーネント
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  variant = 'primary',
  size = 'medium',
  showLabel = false,
  label,
  className = '',
  animated = true,
  striped = false,
}) => {
  // 進捗率を0-100の範囲に制限
  const clampedValue = value !== undefined ? Math.min(Math.max(value, 0), 100) : undefined;

  // 不確定進捗かどうか
  const isIndeterminate = clampedValue === undefined;

  // サイズに応じたクラス
  const sizeClasses = {
    small: 'h-1',
    medium: 'h-2',
    large: 'h-4',
  };

  // バリエーションに応じた色クラス
  const variantClasses = {
    primary: 'bg-blue-600',
    success: 'bg-green-600',
    warning: 'bg-yellow-600',
    danger: 'bg-red-600',
    info: 'bg-cyan-600',
  };

  // ストライプのグラデーション
  const stripeGradient = striped
    ? 'bg-size-[1rem_1rem] bg-[linear-gradient(45deg,rgba(255,255,255,.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,.15)_50%,rgba(255,255,255,.15)_75%,transparent_75%,transparent)]'
    : '';

  // ストライプアニメーション
  const stripeAnimation = striped && animated ? 'animate-[progress-stripes_1s_linear_infinite]' : '';

  return (
    <div className={`w-full ${className}`}>
      {/* ラベル */}
      {showLabel && (
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-medium text-gray-700">
            {label || (clampedValue !== undefined ? `${Math.round(clampedValue)}%` : '処理中...')}
          </span>
        </div>
      )}

      {/* プログレスバー本体 */}
      {/* Phase 19.2.4: CodeRabbit対応 - 不確定状態ではaria-valuenowを省略 */}
      <div
        className={`w-full bg-gray-200 rounded-full overflow-hidden ${sizeClasses[size]}`}
        role="progressbar"
        {...(clampedValue !== undefined && { 'aria-valuenow': clampedValue })}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || (clampedValue !== undefined ? `${Math.round(clampedValue)}%完了` : '処理中')}
      >
        {isIndeterminate ? (
          /* 不確定進捗バー（左右にアニメーション） */
          <div
            className={`h-full w-1/3 ${variantClasses[variant]} rounded-full animate-[progress-indeterminate_1.5s_ease-in-out_infinite]`}
          />
        ) : (
          /* 確定進捗バー */
          <div
            className={`h-full rounded-full ${variantClasses[variant]} ${stripeGradient} ${stripeAnimation} ${
              animated ? 'transition-all duration-500 ease-out' : ''
            }`}
            style={{ width: `${clampedValue}%` }}
          />
        )}
      </div>
    </div>
  );
};

/**
 * CircularProgress
 *
 * 円形のプログレスインジケーター（オプション）
 */
export interface CircularProgressProps {
  /**
   * 進捗率（0-100）
   * undefinedの場合は不確定進捗（スピナー）を表示
   */
  value?: number;

  /**
   * サイズ（px）
   * デフォルト: 40
   */
  size?: number;

  /**
   * 線の太さ（px）
   * デフォルト: 4
   */
  thickness?: number;

  /**
   * バリエーション
   * デフォルト: 'primary'
   */
  variant?: ProgressBarVariant;

  /**
   * 追加のCSSクラス
   */
  className?: string;
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  value,
  size = 40,
  thickness = 4,
  variant = 'primary',
  className = '',
}) => {
  const clampedValue = value !== undefined ? Math.min(Math.max(value, 0), 100) : undefined;
  const isIndeterminate = clampedValue === undefined;

  // 円の半径と周囲の長さ
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  // 進捗に応じたストロークのオフセット
  const strokeDashoffset = clampedValue !== undefined
    ? circumference - (clampedValue / 100) * circumference
    : 0;

  // バリエーションに応じた色クラス
  const variantColors = {
    primary: 'text-blue-600',
    success: 'text-green-600',
    warning: 'text-yellow-600',
    danger: 'text-red-600',
    info: 'text-cyan-600',
  };

  // Phase 19.2.4: CodeRabbit対応 - 不確定状態ではaria-valuenowを省略
  return (
    <div
      className={`inline-flex items-center justify-center ${className}`}
      role="progressbar"
      {...(clampedValue !== undefined && { 'aria-valuenow': clampedValue })}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={clampedValue !== undefined ? `${Math.round(clampedValue)}%完了` : '処理中'}
    >
      <svg
        width={size}
        height={size}
        className={isIndeterminate ? 'animate-spin' : ''}
      >
        {/* 背景円 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={thickness}
          className="text-gray-200"
        />

        {/* 進捗円 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={thickness}
          strokeLinecap="round"
          className={`${variantColors[variant]} transition-all duration-500 ease-out`}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: isIndeterminate ? circumference * 0.75 : strokeDashoffset,
            transform: 'rotate(-90deg)',
            transformOrigin: '50% 50%',
          }}
        />
      </svg>
    </div>
  );
};

export default ProgressBar;
