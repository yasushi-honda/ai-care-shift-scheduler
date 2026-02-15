/**
 * SkeletonLoader コンポーネント
 *
 * Phase 19.2.4: UIフィードバックの改善 - スケルトンローディング
 *
 * 特徴:
 * - データ読み込み中のスケルトン表示
 * - 複数バリエーション（text, rect, circle, table, list, card）
 * - パルスアニメーション
 * - レスポンシブ対応
 */

import React from 'react';

/**
 * スケルトンのバリエーション
 */
export type SkeletonVariant = 'text' | 'rect' | 'circle' | 'table' | 'list' | 'card';

/**
 * SkeletonLoaderのプロパティ
 */
export interface SkeletonLoaderProps {
  /**
   * バリエーション
   * デフォルト: 'text'
   */
  variant?: SkeletonVariant;

  /**
   * 幅（CSSサイズ文字列）
   * デフォルト: '100%'
   */
  width?: string;

  /**
   * 高さ（CSSサイズ文字列）
   * デフォルト: variant依存
   */
  height?: string;

  /**
   * 繰り返し数（table, list用）
   * デフォルト: 3
   */
  count?: number;

  /**
   * カラム数（table用）
   * デフォルト: 4
   */
  columns?: number;

  /**
   * 追加のCSSクラス
   */
  className?: string;

  /**
   * アニメーションを無効化
   * デフォルト: false
   */
  noAnimation?: boolean;
}

/**
 * 基本スケルトン要素
 * Phase 19.2.4: CodeRabbit対応 - style prop追加
 */
const SkeletonBase: React.FC<{
  className?: string;
  noAnimation?: boolean;
  style?: React.CSSProperties;
}> = ({ className = '', noAnimation = false, style }) => {
  return (
    <div
      className={`bg-gray-200 rounded ${
        noAnimation ? '' : 'animate-pulse'
      } ${className}`}
      style={style}
      role="status"
      aria-label="読み込み中"
    >
      <span className="sr-only">読み込み中...</span>
    </div>
  );
};

/**
 * テキストスケルトン
 */
const SkeletonText: React.FC<Pick<SkeletonLoaderProps, 'width' | 'height' | 'className' | 'noAnimation'>> = ({
  width = '100%',
  height = '1rem',
  className = '',
  noAnimation = false,
}) => {
  return (
    <SkeletonBase
      className={`${className}`}
      style={{ width, height }}
      noAnimation={noAnimation}
    />
  );
};

/**
 * 矩形スケルトン
 */
const SkeletonRect: React.FC<Pick<SkeletonLoaderProps, 'width' | 'height' | 'className' | 'noAnimation'>> = ({
  width = '100%',
  height = '200px',
  className = '',
  noAnimation = false,
}) => {
  return (
    <SkeletonBase
      className={`${className}`}
      style={{ width, height }}
      noAnimation={noAnimation}
    />
  );
};

/**
 * 円形スケルトン
 */
const SkeletonCircle: React.FC<Pick<SkeletonLoaderProps, 'width' | 'height' | 'className' | 'noAnimation'>> = ({
  width = '40px',
  height,
  className = '',
  noAnimation = false,
}) => {
  const size = height || width;
  return (
    <SkeletonBase
      className={`rounded-full ${className}`}
      style={{ width, height: size }}
      noAnimation={noAnimation}
    />
  );
};

/**
 * テーブルスケルトン
 */
const SkeletonTable: React.FC<Pick<SkeletonLoaderProps, 'count' | 'columns' | 'className' | 'noAnimation'>> = ({
  count = 3,
  columns = 4,
  className = '',
  noAnimation = false,
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {/* ヘッダー行 */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {Array.from({ length: columns }).map((_, idx) => (
          <SkeletonText
            key={`header-${idx}`}
            width="100%"
            height="1.5rem"
            noAnimation={noAnimation}
          />
        ))}
      </div>

      {/* データ行 */}
      {Array.from({ length: count }).map((_, rowIdx) => (
        <div
          key={`row-${rowIdx}`}
          className="grid gap-4"
          style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
        >
          {Array.from({ length: columns }).map((_, colIdx) => (
            <SkeletonText
              key={`row-${rowIdx}-col-${colIdx}`}
              width="100%"
              height="1rem"
              noAnimation={noAnimation}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

/**
 * リストスケルトン
 */
const SkeletonList: React.FC<Pick<SkeletonLoaderProps, 'count' | 'className' | 'noAnimation'>> = ({
  count = 3,
  className = '',
  noAnimation = false,
}) => {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: count }).map((_, idx) => (
        <div key={`list-item-${idx}`} className="flex items-center gap-3">
          {/* アイコン/アバター */}
          <SkeletonCircle width="40px" noAnimation={noAnimation} />

          {/* コンテンツ */}
          <div className="flex-1 space-y-2">
            <SkeletonText width="60%" height="1rem" noAnimation={noAnimation} />
            <SkeletonText width="40%" height="0.75rem" noAnimation={noAnimation} />
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * カードスケルトン
 */
const SkeletonCard: React.FC<Pick<SkeletonLoaderProps, 'className' | 'noAnimation'>> = ({
  className = '',
  noAnimation = false,
}) => {
  return (
    <div className={`bg-white rounded-lg shadow-xs p-6 space-y-4 ${className}`}>
      {/* カードヘッダー */}
      <div className="flex items-center justify-between">
        <SkeletonText width="40%" height="1.5rem" noAnimation={noAnimation} />
        <SkeletonCircle width="32px" noAnimation={noAnimation} />
      </div>

      {/* カード画像 */}
      <SkeletonRect width="100%" height="200px" noAnimation={noAnimation} />

      {/* カードコンテンツ */}
      <div className="space-y-2">
        <SkeletonText width="100%" height="1rem" noAnimation={noAnimation} />
        <SkeletonText width="80%" height="1rem" noAnimation={noAnimation} />
        <SkeletonText width="60%" height="1rem" noAnimation={noAnimation} />
      </div>

      {/* カードフッター */}
      <div className="flex items-center justify-between pt-4">
        <SkeletonText width="30%" height="0.875rem" noAnimation={noAnimation} />
        <SkeletonText width="20%" height="0.875rem" noAnimation={noAnimation} />
      </div>
    </div>
  );
};

/**
 * SkeletonLoader
 *
 * データ読み込み中のプレースホルダー表示
 */
export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  variant = 'text',
  width,
  height,
  count = 3,
  columns = 4,
  className = '',
  noAnimation = false,
}) => {
  switch (variant) {
    case 'text':
      return (
        <SkeletonText
          width={width}
          height={height}
          className={className}
          noAnimation={noAnimation}
        />
      );

    case 'rect':
      return (
        <SkeletonRect
          width={width}
          height={height}
          className={className}
          noAnimation={noAnimation}
        />
      );

    case 'circle':
      return (
        <SkeletonCircle
          width={width}
          height={height}
          className={className}
          noAnimation={noAnimation}
        />
      );

    case 'table':
      return (
        <SkeletonTable
          count={count}
          columns={columns}
          className={className}
          noAnimation={noAnimation}
        />
      );

    case 'list':
      return (
        <SkeletonList
          count={count}
          className={className}
          noAnimation={noAnimation}
        />
      );

    case 'card':
      return (
        <SkeletonCard
          className={className}
          noAnimation={noAnimation}
        />
      );

    default:
      return (
        <SkeletonText
          width={width}
          height={height}
          className={className}
          noAnimation={noAnimation}
        />
      );
  }
};

export default SkeletonLoader;
