/**
 * LazyImage コンポーネント
 *
 * Phase 19.1.3: 画像の遅延読み込みをサポートするコンポーネント
 *
 * 特徴:
 * - Intersection Observer APIを使用した効率的な遅延読み込み
 * - プレースホルダー表示（ローディング中）
 * - エラー時のフォールバック画像
 * - WebP形式のサポート（フォールバック付き）
 * - アクセシビリティ対応（alt属性必須）
 *
 * 使用例:
 * ```tsx
 * <LazyImage
 *   src="/images/photo.jpg"
 *   alt="説明"
 *   width={300}
 *   height={200}
 *   className="rounded-sm"
 * />
 * ```
 */

import React, { useState, useEffect, useRef } from 'react';

export interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /**
   * 画像のURL
   */
  src: string;

  /**
   * 代替テキスト（アクセシビリティのため必須）
   */
  alt: string;

  /**
   * WebP形式の画像URL（オプション）
   * 指定された場合、対応ブラウザではこちらを優先的に使用
   */
  webpSrc?: string;

  /**
   * プレースホルダー画像URL（オプション）
   * 指定されない場合、グレーの背景を表示
   */
  placeholderSrc?: string;

  /**
   * エラー時のフォールバック画像URL（オプション）
   */
  fallbackSrc?: string;

  /**
   * 画像読み込み完了時のコールバック
   */
  onLoad?: () => void;

  /**
   * 画像読み込みエラー時のコールバック
   */
  onError?: (error: Error) => void;

  /**
   * Intersection Observer のルートマージン
   * デフォルト: '50px'（ビューポートの50px手前から読み込み開始）
   */
  rootMargin?: string;

  /**
   * 画像の幅（オプション、レイアウトシフト防止のため推奨）
   */
  width?: number | string;

  /**
   * 画像の高さ（オプション、レイアウトシフト防止のため推奨）
   */
  height?: number | string;
}

export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  webpSrc,
  placeholderSrc,
  fallbackSrc,
  onLoad,
  onError,
  rootMargin = '50px',
  width,
  height,
  className = '',
  style,
  ...rest
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [loadedSrc, setLoadedSrc] = useState('');
  const imgRef = useRef<HTMLImageElement>(null);

  // Intersection Observer で画像が表示領域に入ったかを監視
  useEffect(() => {
    if (!imgRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin,
      }
    );

    observer.observe(imgRef.current);

    return () => {
      observer.disconnect();
    };
  }, [rootMargin]);

  // 画像読み込み処理
  useEffect(() => {
    if (!isInView) return;

    let cancelled = false;
    const img = new Image();

    // WebP対応チェック
    const useWebP = webpSrc && supportsWebP();
    const imageSrc = useWebP ? webpSrc : src;

    img.src = imageSrc;

    img.onload = () => {
      if (cancelled) return;
      setLoadedSrc(imageSrc);
      setIsLoaded(true);
      onLoad?.();
    };

    img.onerror = () => {
      if (cancelled) return;
      setIsError(true);
      onError?.(new Error(`Failed to load image: ${imageSrc}`));
    };

    return () => {
      cancelled = true;
    };
  }, [isInView, src, webpSrc]);

  // 表示する画像URLを決定（placeholderSrcがない場合は透明SVGを使用）
  const defaultPlaceholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3C/svg%3E';
  const displaySrc = isError && fallbackSrc
    ? fallbackSrc
    : isLoaded
    ? loadedSrc
    : placeholderSrc || defaultPlaceholder;

  // スタイル
  const containerStyle: React.CSSProperties = {
    position: 'relative',
    display: 'inline-block',
    width: width || 'auto',
    height: height || 'auto',
    backgroundColor: isLoaded ? 'transparent' : '#f0f0f0',
    ...style,
  };

  const imgStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    opacity: isLoaded ? 1 : 0.5,
    transition: 'opacity 0.3s ease-in-out',
  };

  return (
    <div style={containerStyle} className={className}>
      <img
        ref={imgRef}
        src={displaySrc}
        alt={alt}
        style={imgStyle}
        {...rest}
      />
      {/* ローディングインジケータ（オプション） */}
      {!isLoaded && !isError && isInView && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#999',
            fontSize: '0.875rem',
          }}
        >
          Loading...
        </div>
      )}
    </div>
  );
};

/**
 * WebP形式のサポートをチェック
 *
 * ブラウザがWebP形式をサポートしているかを判定します。
 *
 * @returns {boolean} WebPがサポートされている場合true
 */
function supportsWebP(): boolean {
  // サーバーサイドレンダリング対策
  if (typeof window === 'undefined') return false;

  // キャッシュされた結果を使用
  if (supportsWebP.cachedResult !== undefined) {
    return supportsWebP.cachedResult;
  }

  const elem = document.createElement('canvas');

  if (elem.getContext && elem.getContext('2d')) {
    // WebPのテスト画像（1x1ピクセル）
    const testString = elem.toDataURL('image/webp');
    const result = testString.indexOf('data:image/webp') === 0;
    supportsWebP.cachedResult = result;
    return result;
  }

  supportsWebP.cachedResult = false;
  return false;
}

// キャッシュ用のstaticプロパティ
supportsWebP.cachedResult = undefined as boolean | undefined;

export default LazyImage;
