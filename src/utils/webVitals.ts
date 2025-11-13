/**
 * Web Vitals測定ユーティリティ
 *
 * Core Web Vitalsを測定し、パフォーマンスデータを収集します。
 * - LCP (Largest Contentful Paint): 最大コンテンツ描画時間
 * - INP (Interaction to Next Paint): 次の描画までのインタラクション時間
 * - CLS (Cumulative Layout Shift): 累積レイアウトシフト
 * - TTFB (Time to First Byte): 最初のバイト受信時間
 *
 * 注: FID (First Input Delay) はweb-vitals v3で廃止され、INPに置き換えられました。
 *
 * 参考: https://web.dev/vitals/
 */

import { onCLS, onLCP, onTTFB, onINP, type Metric } from 'web-vitals';

/**
 * Web Vitalsの閾値（Good/Needs Improvement/Poor）
 * 参考: https://web.dev/articles/defining-core-web-vitals-thresholds
 */
export const WEB_VITALS_THRESHOLDS = {
  LCP: { good: 2500, needsImprovement: 4000 },
  INP: { good: 200, needsImprovement: 500 },
  CLS: { good: 0.1, needsImprovement: 0.25 },
  TTFB: { good: 800, needsImprovement: 1800 },
} as const;

/**
 * メトリクスのパフォーマンス評価
 */
type PerformanceRating = 'good' | 'needs-improvement' | 'poor';

/**
 * メトリクスの評価を判定
 */
function getRating(metric: Metric): PerformanceRating {
  const { name, value } = metric;
  const thresholds = WEB_VITALS_THRESHOLDS[name as keyof typeof WEB_VITALS_THRESHOLDS];

  if (!thresholds) {
    return 'good';
  }

  if (value <= thresholds.good) {
    return 'good';
  } else if (value <= thresholds.needsImprovement) {
    return 'needs-improvement';
  } else {
    return 'poor';
  }
}

/**
 * メトリクスをコンソールに出力（開発環境のみ）
 */
function logMetric(metric: Metric): void {
  if (import.meta.env.DEV) {
    const rating = getRating(metric);
    const emoji = rating === 'good' ? '🟢' : rating === 'needs-improvement' ? '🟡' : '🔴';

    console.log(
      `${emoji} ${metric.name}:`,
      Math.round(metric.value),
      metric.rating || rating,
      metric
    );
  }
}

/**
 * メトリクスをアナリティクスに送信
 *
 * 現在はコンソール出力のみ。将来的にGoogle Analytics等に送信可能。
 */
function sendToAnalytics(metric: Metric): void {
  const rating = getRating(metric);

  // コンソールに出力
  logMetric(metric);

  // TODO: Google Analytics等に送信
  // 例: gtag('event', metric.name, {
  //   value: Math.round(metric.value),
  //   metric_id: metric.id,
  //   metric_rating: rating,
  // });

  // TODO: Firebase Performance Monitoringに送信
  // 例: const trace = performance.trace(metric.name);
  //     trace.putMetric('value', Math.round(metric.value));
  //     trace.stop();
}

/**
 * すべてのWeb Vitalsを測定開始
 *
 * アプリケーションのエントリーポイント（main.tsxまたはindex.tsx）で呼び出す。
 *
 * @example
 * ```typescript
 * import { reportWebVitals } from './utils/webVitals';
 *
 * reportWebVitals();
 * ```
 */
export function reportWebVitals(): void {
  // LCP: Largest Contentful Paint
  // ビューポート内の最大のコンテンツ要素が描画されるまでの時間
  // Good: <= 2.5s, Needs Improvement: <= 4s, Poor: > 4s
  onLCP(sendToAnalytics);

  // INP: Interaction to Next Paint
  // ユーザーインタラクションからブラウザが次の描画を行うまでの時間
  // Good: <= 200ms, Needs Improvement: <= 500ms, Poor: > 500ms
  // 注: INPはFIDの後継メトリクスです
  onINP(sendToAnalytics);

  // CLS: Cumulative Layout Shift
  // ページライフサイクル全体の予期しないレイアウトシフトの累積
  // Good: <= 0.1, Needs Improvement: <= 0.25, Poor: > 0.25
  onCLS(sendToAnalytics);

  // TTFB: Time to First Byte
  // リクエストしてから最初のバイトを受信するまでの時間
  // Good: <= 800ms, Needs Improvement: <= 1800ms, Poor: > 1800ms
  onTTFB(sendToAnalytics);
}

/**
 * カスタムパフォーマンスマーク
 *
 * 特定の処理のパフォーマンスを測定する際に使用。
 * measurePerformance()が自動的にendMarkを作成するため、
 * 通常はstartMarkのみをマークします。
 *
 * @example
 * ```typescript
 * markPerformance('facility-list-load-start');
 * // ... 施設一覧を読み込み
 * // Note: endMarkは measurePerformance() が自動的に作成します
 * const duration = measurePerformance('facility-list-load-start', 'facility-list-load-end');
 * console.log(`Facility list load time: ${duration}ms`);
 * ```
 */
export function markPerformance(name: string): void {
  if (typeof performance !== 'undefined' && performance.mark) {
    performance.mark(name);
  }
}

/**
 * カスタムパフォーマンス測定
 *
 * 2つのマーク間の時間を測定する。
 *
 * @returns 経過時間（ミリ秒）、測定できない場合は-1
 */
export function measurePerformance(startMark: string, endMark: string): number {
  if (typeof performance === 'undefined' || !performance.measure) {
    return -1;
  }

  try {
    performance.mark(endMark);
    const measureName = `${startMark}-to-${endMark}`;
    performance.measure(measureName, startMark, endMark);

    const measure = performance.getEntriesByName(measureName)[0];
    const duration = measure ? Math.round(measure.duration) : -1;

    if (import.meta.env.DEV && duration >= 0) {
      console.log(`⏱️ ${measureName}: ${duration}ms`);
    }

    // クリーンアップ
    performance.clearMarks(startMark);
    performance.clearMarks(endMark);
    performance.clearMeasures(measureName);

    return duration;
  } catch (error) {
    console.error('Performance measurement error:', error);
    return -1;
  }
}

/**
 * パフォーマンスオブザーバーを使用した詳細測定
 *
 * Resource Timing、Navigation Timing、Paint Timingなどを測定。
 * メモリリークを防ぐため、cleanup関数を返します。
 *
 * @returns cleanup関数（コンポーネントアンマウント時やアプリ終了時に呼び出す）
 *
 * @example
 * ```typescript
 * const cleanup = observePerformance(['resource', 'navigation', 'paint']);
 * // Later, when component unmounts or app closes:
 * cleanup();
 * ```
 */
export function observePerformance(types: Array<'resource' | 'navigation' | 'paint'>): () => void {
  if (typeof PerformanceObserver === 'undefined') {
    return () => {};
  }

  const observers: PerformanceObserver[] = [];

  types.forEach((type) => {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (import.meta.env.DEV) {
            console.log(`📊 ${type}:`, entry.name, Math.round(entry.duration || 0), 'ms');
          }
        }
      });

      observer.observe({ type, buffered: true });
      observers.push(observer);
    } catch (error) {
      console.error(`Failed to observe ${type}:`, error);
    }
  });

  // Return cleanup function
  return () => {
    observers.forEach(observer => observer.disconnect());
    observers.length = 0;
  };
}

export default reportWebVitals;
