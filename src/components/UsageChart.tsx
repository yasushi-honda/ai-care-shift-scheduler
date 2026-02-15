import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import { Line, Bar, Pie } from 'react-chartjs-2';

/**
 * Phase 19.3.3: 使用状況レポート - グラフコンポーネント
 *
 * Chart.jsを使用して、使用状況データを視覚化します。
 *
 * 対応グラフ:
 * - line: 折れ線グラフ（日別アクション数推移など）
 * - bar: 棒グラフ（施設別アクション数比較など）
 * - pie: 円グラフ（アクション種別分布など）
 */

// Chart.js設定を登録
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

// グラフ共通のデフォルトオプション
const defaultOptions: ChartOptions<'line' | 'bar' | 'pie'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'top',
    },
  },
};

interface UsageChartProps {
  /**
   * グラフの種類
   */
  type: 'line' | 'bar' | 'pie';

  /**
   * Chart.jsのdataオブジェクト
   * 形式: { labels: string[], datasets: Dataset[] }
   */
  data: any;

  /**
   * Chart.jsのoptionsオブジェクト（オプショナル）
   * 指定しない場合はdefaultOptionsが使用されます
   */
  options?: any;

  /**
   * グラフのタイトル（オプショナル）
   */
  title?: string;

  /**
   * グラフの高さ（px）
   * デフォルト: 300px
   */
  height?: number;
}

/**
 * UsageChart コンポーネント
 *
 * 使用例:
 * ```tsx
 * <UsageChart
 *   type="line"
 *   data={{
 *     labels: ['11/01', '11/02', '11/03'],
 *     datasets: [{
 *       label: 'アクション数',
 *       data: [45, 52, 48],
 *       borderColor: 'rgb(59, 130, 246)',
 *     }],
 *   }}
 *   title="日別アクション数推移"
 *   height={300}
 * />
 * ```
 */
export function UsageChart({
  type,
  data,
  options,
  title,
  height = 300,
}: UsageChartProps): React.ReactElement {
  // グラフコンポーネントのマッピング
  const chartComponents = {
    line: Line,
    bar: Bar,
    pie: Pie,
  };

  const ChartComponent = chartComponents[type];

  // optionsをマージ（カスタムオプションが優先）
  const mergedOptions = {
    ...defaultOptions,
    ...options,
    plugins: {
      ...defaultOptions.plugins,
      ...options?.plugins,
      title: {
        display: !!title,
        text: title,
        ...options?.plugins?.title,
      },
    },
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      {title && !options?.plugins?.title && (
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      )}
      <div style={{ height: `${height}px` }}>
        <ChartComponent data={data} options={mergedOptions} />
      </div>
    </div>
  );
}

/**
 * 事前定義されたカラーパレット（Tailwind CSS準拠）
 */
export const chartColors = {
  blue: 'rgb(59, 130, 246)',
  blueAlpha: 'rgba(59, 130, 246, 0.6)',
  green: 'rgb(16, 185, 129)',
  greenAlpha: 'rgba(16, 185, 129, 0.6)',
  red: 'rgb(239, 68, 68)',
  redAlpha: 'rgba(239, 68, 68, 0.6)',
  orange: 'rgb(251, 146, 60)',
  orangeAlpha: 'rgba(251, 146, 60, 0.6)',
  purple: 'rgb(168, 85, 247)',
  purpleAlpha: 'rgba(168, 85, 247, 0.6)',
  yellow: 'rgb(234, 179, 8)',
  yellowAlpha: 'rgba(234, 179, 8, 0.6)',
  gray: 'rgb(107, 114, 128)',
  grayAlpha: 'rgba(107, 114, 128, 0.6)',
};

/**
 * グラフデータ作成ヘルパー関数
 */

/**
 * 折れ線グラフデータを作成
 */
export function createLineChartData(
  labels: string[],
  dataValues: number[],
  label: string = 'データ',
  color: string = chartColors.blue
) {
  return {
    labels,
    datasets: [
      {
        label,
        data: dataValues,
        borderColor: color,
        backgroundColor: color.replace('rgb', 'rgba').replace(')', ', 0.1)'),
        tension: 0.3,
      },
    ],
  };
}

/**
 * 棒グラフデータを作成
 */
export function createBarChartData(
  labels: string[],
  dataValues: number[],
  label: string = 'データ',
  colors?: string[]
) {
  const defaultColors = [
    chartColors.blueAlpha,
    chartColors.greenAlpha,
    chartColors.orangeAlpha,
    chartColors.purpleAlpha,
    chartColors.yellowAlpha,
    chartColors.redAlpha,
  ];

  return {
    labels,
    datasets: [
      {
        label,
        data: dataValues,
        backgroundColor: colors || defaultColors.slice(0, dataValues.length),
      },
    ],
  };
}

/**
 * 円グラフデータを作成
 */
export function createPieChartData(
  labels: string[],
  dataValues: number[],
  colors?: string[]
) {
  const defaultColors = [
    chartColors.blueAlpha,
    chartColors.greenAlpha,
    chartColors.orangeAlpha,
    chartColors.purpleAlpha,
    chartColors.yellowAlpha,
    chartColors.redAlpha,
    chartColors.grayAlpha,
  ];

  return {
    labels,
    datasets: [
      {
        data: dataValues,
        backgroundColor: colors || defaultColors.slice(0, dataValues.length),
      },
    ],
  };
}
