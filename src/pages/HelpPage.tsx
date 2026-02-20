/**
 * HelpPage v2.1 - アプリケーション使い方ガイド
 *
 * 設計: "Interactive Visual Walkthrough"
 * v2.1 アニメーションバランス調整:
 * - Hero: ページロードアニメーション維持 ✅
 * - 図解コンポーネント (WorkflowDiagram/ScoreVisualizer/GenerationFlow): 独自アニメーション維持 ✅
 * - コンテンツカード: スクロールFadeInUp削除 → ホバーマイクロインタラクションに置換
 * - アクセシビリティ: prefers-reduced-motion 対応を図解アニメーションに追加
 */
import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

// ─── Types ───────────────────────────────────────────────────

type SectionId =
  | 'quickstart'
  | 'staff'
  | 'requirements'
  | 'generation'
  | 'evaluation'
  | 'leave'
  | 'reports'
  | 'export'
  | 'keyboard'
  | 'admin'
  | 'faq';

const NAV_SECTIONS: { id: SectionId; title: string; icon: string }[] = [
  { id: 'quickstart', title: 'クイックスタート', icon: '🚀' },
  { id: 'staff', title: 'スタッフ設定', icon: '👥' },
  { id: 'requirements', title: 'シフト要件設定', icon: '📋' },
  { id: 'generation', title: 'AI自動生成', icon: '⚙️' },
  { id: 'evaluation', title: '評価・改善提案', icon: '📊' },
  { id: 'leave', title: '休暇管理', icon: '🏖️' },
  { id: 'reports', title: 'レポート機能', icon: '📈' },
  { id: 'export', title: 'エクスポート', icon: '📤' },
  { id: 'keyboard', title: 'キーボード操作', icon: '⌨️' },
  { id: 'admin', title: '管理者機能', icon: '🔧' },
  { id: 'faq', title: 'よくある質問', icon: '❓' },
];

const FAQ_ITEMS = [
  {
    q: 'シフト生成が失敗します。どうすればよいですか？',
    a: 'スタッフ数が必要人員数を大きく下回っている場合や、勤務制約が厳しすぎる場合に生成が困難になります。左サイドバー下部の「データ設定診断」ボタンをクリックして、設定に問題がないか確認してください。特に必要人員数とスタッフ数のバランスが重要です。',
  },
  {
    q: '有給休暇の残日数が正しく表示されません',
    a: '休暇残高は「休暇残高管理」パネルから確認・修正できます。初期設定では標準的な付与日数が設定されています。入社年月日や付与基準日に合わせて手動で修正してください。',
  },
  {
    q: '複数の担当者が同時に編集できますか？',
    a: '同じ施設・同じ月のシフトは、排他制御により1名のみが編集できます。別の担当者が編集中の場合は「ロック中」と表示されます。ロック解除を待つか、管理者に連絡してください。',
  },
  {
    q: '夜勤なしの施設（デイサービス）の設定はどこでできますか？',
    a: 'シフト要件設定の「施設種別」で「デイサービス（夜勤なし）」を選択すると、日曜日が自動的に営業外として扱われ、夜勤シフトが除外されます。',
  },
  {
    q: '評価スコアが低い場合はどうすればいいですか？',
    a: '評価パネルの「改善提案」を確認してください。制約違反のレベルに応じた具体的な改善アクションが表示されます。特にLevel 1（絶対必須・労基法）の違反は優先的に対応してください。評価パネルの「根本原因分析」タブも確認することで、問題の根本的な原因を特定できます。',
  },
  {
    q: 'シフトをエクスポートしたい',
    a: 'シフト表上部の「エクスポート」ボタンからCSV・PDF形式でダウンロードできます。より詳細な分析データはレポートページ（/reports）からExcel形式でも出力できます。',
  },
  {
    q: 'スタッフを削除したいのですが',
    a: '左サイドバーの「スタッフ設定」を開き、対象スタッフの行の削除ボタン（ゴミ箱アイコン）をクリックしてください。削除後は自動保存されます。過去の確定済みシフトデータには影響しません。',
  },
  {
    q: '通知が届きません',
    a: 'ヘッダー右上の通知ベル（🔔）アイコンをクリックして通知パネルを開き、通知設定が有効になっているか確認してください。また、ブラウザの通知許可設定もご確認ください。',
  },
];

// ─── Animation Hook（図解コンポーネント専用）────────────────
// prefers-reduced-motion 対応: モーション設定が「減らす」の場合は即時表示

const useInView = (threshold = 0.12) => {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    // アクセシビリティ: reduced-motion設定時は即時表示
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
};

// ─── Hero アニメーション（ページロード時のみ使用）────────────

const FadeInUp = ({
  children,
  delay = 0,
  style = {},
}: {
  children: React.ReactNode;
  delay?: number;
  style?: React.CSSProperties;
  key?: React.Key;
}) => {
  const { ref, inView } = useInView();
  return (
    <div
      ref={ref}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// ─── Sub-components ───────────────────────────────────────────

const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '4px 10px',
      fontSize: '13px',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontWeight: 600,
      color: '#1e1b4b',
      background: '#f5f3ff',
      border: '1px solid #c7d2fe',
      borderRadius: '7px',
      boxShadow: '0 3px 0 #c7d2fe',
      whiteSpace: 'nowrap',
      lineHeight: 1.4,
    }}
  >
    {children}
  </kbd>
);

const TipBox = ({
  children,
  variant = 'info',
}: {
  children: React.ReactNode;
  variant?: 'info' | 'warning';
}) => {
  const cfg = {
    info: { bg: '#fffbeb', border: '#fcd34d', text: '#92400e', icon: '💡', label: 'ポイント' },
    warning: { bg: '#fff7ed', border: '#fb923c', text: '#9a3412', icon: '⚠️', label: '注意' },
  }[variant];
  return (
    <div style={{ marginTop: '24px' }}>
      <div
        style={{
          background: cfg.bg,
          border: `1px solid ${cfg.border}`,
          borderRadius: '16px',
          padding: '20px 24px',
          display: 'flex',
          gap: '16px',
        }}
      >
        <span style={{ fontSize: '24px', flexShrink: 0, marginTop: '2px' }}>{cfg.icon}</span>
        <div>
          <p style={{ fontSize: '11px', fontWeight: 700, color: cfg.text, letterSpacing: '1px', textTransform: 'uppercase', margin: '0 0 6px' }}>{cfg.label}</p>
          <p style={{ fontSize: '16px', color: cfg.text, lineHeight: 1.8, margin: 0 }}>{children}</p>
        </div>
      </div>
    </div>
  );
};

const SectionHeader = ({
  id,
  title,
  number,
  subtitle,
}: {
  id: string;
  title: string;
  number: string;
  subtitle?: string;
}) => (
  <div id={id} style={{ scrollMarginTop: '40px', marginBottom: '40px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '14px' }}>
      <span
        style={{
          fontSize: '13px',
          fontWeight: 700,
          color: '#6366f1',
          letterSpacing: '2px',
          fontFamily: 'ui-monospace, monospace',
          background: '#eef2ff',
          padding: '4px 12px',
          borderRadius: '20px',
        }}
      >
        {number}
      </span>
    </div>
    <h2
      style={{
        fontSize: '32px',
        fontWeight: 800,
        color: '#1e1b4b',
        margin: '0 0 14px',
        fontFamily: '"Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif',
        lineHeight: 1.2,
        letterSpacing: '-0.5px',
      }}
    >
      {title}
    </h2>
    {subtitle && (
      <p style={{ fontSize: '18px', color: '#6b7280', lineHeight: 1.8, margin: 0, maxWidth: '640px' }}>
        {subtitle}
      </p>
    )}
  </div>
);

// ─── Workflow Diagram（独自アニメーション）────────────────────

const WorkflowDiagram = () => {
  const { ref, inView } = useInView(0.2);
  const steps = [
    { emoji: '👥', label: 'スタッフ登録', color: '#6366f1', bg: '#eef2ff' },
    { emoji: '📋', label: '要件設定', color: '#0ea5e9', bg: '#f0f9ff' },
    { emoji: '⚙️', label: '自動生成', color: '#8b5cf6', bg: '#f5f3ff' },
    { emoji: '📊', label: '評価確認', color: '#f59e0b', bg: '#fffbeb' },
    { emoji: '✅', label: '完成', color: '#10b981', bg: '#f0fdf4' },
  ];

  return (
    <div ref={ref} style={{ overflowX: 'auto', paddingBottom: '8px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0',
          minWidth: '600px',
          padding: '8px 0',
        }}
      >
        {steps.map((step, i) => (
          <React.Fragment key={step.label}>
            {/* Step node */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
                opacity: inView ? 1 : 0,
                transform: inView ? 'translateY(0)' : 'translateY(20px)',
                transition: `opacity 0.5s ease ${i * 120}ms, transform 0.5s ease ${i * 120}ms`,
              }}
            >
              <div
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: step.bg,
                  border: `3px solid ${step.color}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '32px',
                  boxShadow: `0 8px 24px ${step.color}30`,
                  flexShrink: 0,
                }}
              >
                {step.emoji}
              </div>
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: step.color,
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 6px',
                  }}
                >
                  {i + 1}
                </div>
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#1e1b4b', margin: 0, whiteSpace: 'nowrap' }}>
                  {step.label}
                </p>
              </div>
            </div>

            {/* Arrow */}
            {i < steps.length - 1 && (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  paddingBottom: '52px',
                  opacity: inView ? 1 : 0,
                  transition: `opacity 0.4s ease ${i * 120 + 200}ms`,
                }}
              >
                <div style={{ flex: 1, height: '2px', background: 'linear-gradient(90deg, #c7d2fe, #a5b4fc)' }} />
                <div style={{ color: '#6366f1', fontSize: '18px', marginLeft: '-1px' }}>›</div>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

// ─── Score Visualizer（独自アニメーション）────────────────────

const ScoreVisualizer = () => {
  const { ref, inView } = useInView(0.15);
  const levels = [
    { id: 'L1', label: '絶対必須', detail: '労基法・夜勤後休息', impact: '即 0点', width: 100, color: '#dc2626', bg: '#fef2f2', border: '#fecaca', textColor: '#991b1b' },
    { id: 'L2', label: '運営必須', detail: '必要人員不足・ロール不足', impact: '−12点/件', width: 72, color: '#ea580c', bg: '#fff7ed', border: '#fed7aa', textColor: '#9a3412' },
    { id: 'L3', label: '努力目標', detail: '希望休未反映・時間帯希望違反', impact: '−4点/件', width: 44, color: '#ca8a04', bg: '#fefce8', border: '#fef08a', textColor: '#854d0e' },
    { id: 'L4', label: '推奨', detail: 'スタッフ追加・設定改善', impact: '0点', width: 18, color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', textColor: '#14532d' },
  ];

  return (
    <div ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {levels.map((lv, i) => (
        <div
          key={lv.id}
          style={{
            background: lv.bg,
            border: `1px solid ${lv.border}`,
            borderRadius: '16px',
            padding: '20px 24px',
            opacity: inView ? 1 : 0,
            transform: inView ? 'translateX(0)' : 'translateX(-32px)',
            transition: `opacity 0.55s ease ${i * 100}ms, transform 0.55s ease ${i * 100}ms`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span
                style={{
                  background: lv.color,
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 700,
                  padding: '3px 12px',
                  borderRadius: '20px',
                  fontFamily: 'ui-monospace, monospace',
                }}
              >
                {lv.id}
              </span>
              <div>
                <p style={{ fontWeight: 700, color: lv.textColor, fontSize: '17px', margin: '0 0 2px' }}>{lv.label}</p>
                <p style={{ fontSize: '14px', color: lv.textColor, margin: 0, opacity: 0.75 }}>{lv.detail}</p>
              </div>
            </div>
            <span
              style={{
                fontSize: '18px',
                fontWeight: 700,
                color: lv.color,
                fontFamily: 'ui-monospace, monospace',
                flexShrink: 0,
              }}
            >
              {lv.impact}
            </span>
          </div>
          {/* Progress bar */}
          <div style={{ background: 'rgba(0,0,0,0.08)', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                background: lv.color,
                borderRadius: '4px',
                width: inView ? `${lv.width}%` : '0%',
                transition: `width 0.8s cubic-bezier(0.4,0,0.2,1) ${i * 100 + 300}ms`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Generation Flow Diagram（独自アニメーション）─────────────

const GenerationFlow = () => {
  const { ref, inView } = useInView(0.15);
  const flow = [
    { icon: '📝', label: '制約収集', desc: '人員・資格・連続勤務・夜勤後休息の条件を収集', color: '#6366f1' },
    { icon: '🔄', label: 'CP-SAT最適化', desc: '全制約を満たすシフトをアルゴリズムで自動探索', color: '#8b5cf6' },
    { icon: '📊', label: 'スコア計算', desc: '充足度を0〜100点でスコア化', color: '#0ea5e9' },
    { icon: '💡', label: '改善提案生成', desc: '違反内容と具体的な解決策を自動出力', color: '#10b981' },
  ];

  return (
    <div
      ref={ref}
      style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #3730a3 60%, #4338ca 100%)',
        borderRadius: '24px',
        padding: '36px 32px',
      }}
    >
      <p style={{ color: '#a5b4fc', fontSize: '12px', fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase', margin: '0 0 28px' }}>
        生成の仕組み
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
        {flow.map((item, i) => (
          <div
            key={item.label}
            style={{
              background: 'rgba(255,255,255,0.08)',
              borderRadius: '16px',
              padding: '24px',
              border: '1px solid rgba(255,255,255,0.12)',
              opacity: inView ? 1 : 0,
              transform: inView ? 'scale(1)' : 'scale(0.92)',
              transition: `opacity 0.5s ease ${i * 120}ms, transform 0.5s ease ${i * 120}ms`,
            }}
          >
            <div style={{ fontSize: '36px', marginBottom: '14px' }}>{item.icon}</div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: `${item.color}30`,
                border: `1px solid ${item.color}60`,
                borderRadius: '20px',
                padding: '2px 10px',
                marginBottom: '10px',
              }}
            >
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: item.color, flexShrink: 0 }} />
              <span style={{ color: item.color, fontSize: '11px', fontWeight: 700 }}>STEP {i + 1}</span>
            </div>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: '17px', margin: '0 0 8px' }}>{item.label}</p>
            <p style={{ color: '#a5b4fc', fontSize: '14px', lineHeight: 1.7, margin: 0 }}>{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────

export const HelpPage = () => {
  const [activeSection, setActiveSection] = useState<SectionId>('quickstart');
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);

  // Scroll spy
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((e) => e.isIntersecting);
        if (visible) setActiveSection(visible.target.id as SectionId);
      },
      { rootMargin: '-8% 0px -70% 0px' }
    );
    NAV_SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveSection(id as SectionId);
  };

  // カードホバー効果ヘルパー
  const cardHoverOn = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.transform = 'translateY(-2px)';
    e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.09)';
  };
  const cardHoverOff = (e: React.MouseEvent<HTMLDivElement>, defaultShadow = '0 2px 8px rgba(0,0,0,0.04)') => {
    e.currentTarget.style.transform = '';
    e.currentTarget.style.boxShadow = defaultShadow;
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif',
        background: '#f4f3ef',
      }}
    >
      {/* ── Sidebar ── */}
      <nav
        style={{
          width: '256px',
          flexShrink: 0,
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflowY: 'auto',
          background: 'linear-gradient(180deg, #1e1b4b 0%, #312e81 60%, #3730a3 100%)',
          boxShadow: '6px 0 32px rgba(30,27,75,0.22)',
        }}
      >
        <div style={{ padding: '32px 20px 48px' }}>
          {/* Back */}
          <Link
            to="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#a5b4fc',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 500,
              marginBottom: '36px',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#e0e7ff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#a5b4fc')}
          >
            ← アプリに戻る
          </Link>

          {/* Title */}
          <div style={{ marginBottom: '28px', paddingBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <p style={{ color: '#6366f1', fontSize: '10px', fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase', margin: '0 0 6px' }}>
              HELP CENTER
            </p>
            <h1 style={{ color: '#fff', fontSize: '18px', fontWeight: 700, margin: 0, lineHeight: 1.4, fontFamily: '"Noto Serif JP", serif' }}>
              使い方ガイド
            </h1>
          </div>

          {/* Nav items */}
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {NAV_SECTIONS.map(({ id, title, icon }) => {
              const isActive = activeSection === id;
              return (
                <li key={id}>
                  <button
                    onClick={() => scrollTo(id)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '11px 14px',
                      borderRadius: '10px',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '11px',
                      fontSize: '14px',
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? '#fff' : '#a5b4fc',
                      background: isActive ? 'rgba(99,102,241,0.5)' : 'transparent',
                      transition: 'all 0.15s',
                      fontFamily: 'inherit',
                      borderLeft: isActive ? '3px solid #818cf8' : '3px solid transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <span style={{ fontSize: '16px', lineHeight: 1 }}>{icon}</span>
                    <span style={{ flex: 1 }}>{title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {/* ── Main ── */}
      <main style={{ flex: 1, padding: '64px 72px 120px 72px', maxWidth: '900px' }}>

        {/* Hero: ページロード時アニメーション（FadeInUp はここのみ使用）*/}
        <FadeInUp>
          <div
            style={{
              background: 'linear-gradient(135deg, #eef2ff 0%, #f5f3ff 50%, #eff6ff 100%)',
              borderRadius: '24px',
              padding: '48px 56px',
              marginBottom: '80px',
              border: '1px solid #c7d2fe',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Decorative circle */}
            <div
              style={{
                position: 'absolute',
                top: '-40px',
                right: '-40px',
                width: '200px',
                height: '200px',
                borderRadius: '50%',
                background: 'rgba(99,102,241,0.08)',
                pointerEvents: 'none',
              }}
            />
            <p style={{ color: '#6366f1', fontSize: '12px', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', margin: '0 0 16px' }}>
              Help Center
            </p>
            <h1
              style={{
                fontSize: '42px',
                fontWeight: 800,
                color: '#1e1b4b',
                margin: '0 0 20px',
                fontFamily: '"Noto Serif JP", "Hiragino Mincho ProN", serif',
                lineHeight: 1.15,
                letterSpacing: '-0.5px',
              }}
            >
              ご利用ガイド
            </h1>
            <p style={{ color: '#6b7280', fontSize: '18px', lineHeight: 1.9, margin: 0, maxWidth: '520px' }}>
              介護シフト管理システムの使い方をわかりやすく解説します。<br />
              左のメニューからセクションを選んでください。
            </p>
          </div>
        </FadeInUp>

        {/* ──────── 01 Quick Start ──────── */}
        <section style={{ marginBottom: '96px' }}>
          <SectionHeader
            id="quickstart"
            title="クイックスタート"
            number="01"
            subtitle="初めてお使いの方は、以下の5ステップでシフト作成を始められます。"
          />

          {/* Workflow diagram（独自アニメーションを持つ）*/}
          <div style={{ marginBottom: '40px' }}>
            <WorkflowDiagram />
          </div>

          {/* Step cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              {
                step: 1,
                title: 'スタッフを登録する',
                desc: '左サイドバーの「スタッフ設定」を開き、スタッフの氏名・役割・資格・勤務設定を入力します。',
                color: '#6366f1',
                bg: '#eef2ff',
              },
              {
                step: 2,
                title: 'シフト種別を確認する',
                desc: '「シフト種別設定」で日勤・夜勤などの時間帯を確認します。施設の形態に合わせて調整できます。',
                color: '#0ea5e9',
                bg: '#f0f9ff',
              },
              {
                step: 3,
                title: '対象月と必要人員を設定する',
                desc: '右エリアの月選択で作成したい年月を指定し、「シフト要件」で曜日・時間帯ごとの必要人員数を設定します。',
                color: '#8b5cf6',
                bg: '#f5f3ff',
              },
              {
                step: 4,
                title: 'シフト自動生成を実行する',
                desc: 'サイドバー下部の「シフト作成実行」ボタンをクリックします。CP-SAT Solverが設定した制約を満たすシフトを自動生成します。',
                color: '#f59e0b',
                bg: '#fffbeb',
              },
              {
                step: 5,
                title: '評価結果を確認・手動調整する',
                desc: '生成後に評価スコアと改善提案が表示されます。手動調整が必要な場合はシフト表のセルを直接クリックして編集できます。',
                color: '#10b981',
                bg: '#f0fdf4',
              },
            ].map(({ step, title, desc, color, bg }) => (
              <div
                key={step}
                style={{
                  display: 'flex',
                  gap: '20px',
                  padding: '24px 28px',
                  background: '#fff',
                  borderRadius: '16px',
                  border: '1px solid #e8e6e0',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  cursor: 'default',
                }}
                onMouseEnter={cardHoverOn}
                onMouseLeave={cardHoverOff}
              >
                <div
                  style={{
                    flexShrink: 0,
                    width: '48px',
                    height: '48px',
                    background: bg,
                    border: `2px solid ${color}`,
                    color: color,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '18px',
                  }}
                >
                  {step}
                </div>
                <div style={{ paddingTop: '4px' }}>
                  <p style={{ fontWeight: 700, color: '#111827', fontSize: '18px', margin: '0 0 8px' }}>{title}</p>
                  <p style={{ color: '#6b7280', fontSize: '16px', lineHeight: 1.8, margin: 0 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ──────── 02 Staff ──────── */}
        <section style={{ marginBottom: '96px' }}>
          <SectionHeader
            id="staff"
            title="スタッフ設定"
            number="02"
            subtitle="スタッフ情報を正確に設定することで、最適なシフト生成が可能になります。"
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            {[
              {
                label: '基本情報',
                emoji: '👤',
                bg: '#eef2ff',
                border: '#c7d2fe',
                color: '#6366f1',
                items: [
                  '氏名（フルネーム）',
                  '役割（介護職員・看護師・ケアマネ・管理者 等）',
                  '資格（介護福祉士・社会福祉士・看護師 等）',
                ],
              },
              {
                label: '勤務設定',
                emoji: '⏰',
                bg: '#f0fdf4',
                border: '#bbf7d0',
                color: '#16a34a',
                items: [
                  '最大連続勤務日数',
                  '勤務可能な時間帯（日勤のみ・夜勤のみ・両方）',
                  '希望休日（曜日・特定日指定）',
                ],
              },
            ].map(({ label, emoji, bg, border, color, items }) => (
              <div
                key={label}
                style={{
                  background: bg,
                  border: `1.5px solid ${border}`,
                  borderRadius: '18px',
                  padding: '28px 24px',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  cursor: 'default',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = '';
                  e.currentTarget.style.boxShadow = '';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                  <span style={{ fontSize: '28px' }}>{emoji}</span>
                  <p style={{ fontWeight: 700, color: '#1e1b4b', fontSize: '17px', margin: 0 }}>{label}</p>
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {items.map((item) => (
                    <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', fontSize: '15px', color: '#374151', lineHeight: 1.6 }}>
                      <div
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: color,
                          flexShrink: 0,
                          marginTop: '7px',
                        }}
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <TipBox>
            スタッフ数が必要人員数を大きく下回ると、制約を満たすシフト生成が困難になります。
            「データ設定診断」機能で事前に問題を検出できます。
          </TipBox>
        </section>

        {/* ──────── 03 Requirements ──────── */}
        <section style={{ marginBottom: '96px' }}>
          <SectionHeader
            id="requirements"
            title="シフト要件設定"
            number="03"
            subtitle="各シフトの必要人員数・資格要件・ロール要件を設定します。これらがシフト自動生成の制約条件になります。"
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              {
                title: '必要人員数',
                desc: 'シフト種別ごとに最低限必要なスタッフ数を設定します。この人数を下回ると評価スコアが下がります。',
                emoji: '👫',
                color: '#6366f1',
              },
              {
                title: '資格要件',
                desc: '特定の資格（介護福祉士等）を持つスタッフが何名以上必要かを設定します。資格が不要な場合は設定不要です。',
                emoji: '📜',
                color: '#0ea5e9',
              },
              {
                title: 'ロール要件',
                desc: '看護師・ケアマネジャー等の職種が最低何名必要かを設定します。介護報酬算定の要件に合わせて設定します。',
                emoji: '🏥',
                color: '#8b5cf6',
              },
              {
                title: '施設種別（夜勤なし設定）',
                desc: 'デイサービスなど夜勤のない施設では「夜勤なし」を選択。日曜日が自動的に営業外として除外されます。',
                emoji: '🌅',
                color: '#f59e0b',
              },
            ].map(({ title, desc, emoji, color }) => (
              <div
                key={title}
                style={{
                  display: 'flex',
                  gap: '20px',
                  padding: '22px 24px',
                  background: '#fff',
                  borderRadius: '16px',
                  border: '1px solid #e8e6e0',
                  boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  cursor: 'default',
                }}
                onMouseEnter={cardHoverOn}
                onMouseLeave={(e) => cardHoverOff(e, '0 1px 6px rgba(0,0,0,0.04)')}
              >
                <div
                  style={{
                    flexShrink: 0,
                    width: '52px',
                    height: '52px',
                    borderRadius: '14px',
                    background: `${color}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '26px',
                  }}
                >
                  {emoji}
                </div>
                <div>
                  <p style={{ fontWeight: 700, color: '#1e1b4b', fontSize: '17px', margin: '0 0 8px' }}>{title}</p>
                  <p style={{ color: '#6b7280', fontSize: '16px', lineHeight: 1.8, margin: 0 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ──────── 04 Generation ──────── */}
        <section style={{ marginBottom: '96px' }}>
          <SectionHeader
            id="generation"
            title="AI自動生成"
            number="04"
            subtitle="CP-SAT（制約充足ソルバー）を使用し、すべての制約を満たす最適なシフトを自動生成します。"
          />

          {/* GenerationFlow は独自アニメーションを持つ */}
          <div style={{ marginBottom: '24px' }}>
            <GenerationFlow />
          </div>

          <div
            style={{
              background: '#fff',
              borderRadius: '18px',
              border: '1px solid #e8e6e0',
              padding: '28px 32px',
              marginBottom: '16px',
            }}
          >
            <p style={{ fontWeight: 700, color: '#1e1b4b', fontSize: '18px', margin: '0 0 20px' }}>
              ✅ 生成前の確認チェックリスト
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {[
                'スタッフが1名以上登録されている',
                'シフト種別ごとの必要人員数が設定されている',
                '対象年月が正しく選択されている',
                '「データ設定診断」でエラーが出ていない',
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      background: '#4f46e5',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    ✓
                  </div>
                  <p style={{ fontSize: '16px', color: '#374151', margin: 0 }}>{item}</p>
                </div>
              ))}
            </div>
          </div>

          <TipBox variant="warning">
            生成中はページを離れないでください。通常10〜60秒で完了します。スタッフ数が多い場合や制約が複雑な場合はさらに時間がかかることがあります。
          </TipBox>
        </section>

        {/* ──────── 05 Evaluation ──────── */}
        <section style={{ marginBottom: '96px' }}>
          <SectionHeader
            id="evaluation"
            title="評価・改善提案"
            number="05"
            subtitle="シフト生成後に自動で評価が実行されます。制約違反の内容と改善提案が右パネルに表示されます。"
          />

          <p style={{ fontWeight: 700, color: '#1e1b4b', fontSize: '19px', margin: '0 0 20px' }}>
            制約レベルとスコアへの影響
          </p>

          {/* ScoreVisualizer は独自アニメーションを持つ */}
          <ScoreVisualizer />

          <TipBox>
            評価パネルの「根本原因分析」タブでは、問題の根本的な原因が表示されます。
            スコアが低い場合はまずL1・L2の違反を優先的に解消してください。
          </TipBox>
        </section>

        {/* ──────── 06 Leave ──────── */}
        <section style={{ marginBottom: '96px' }}>
          <SectionHeader
            id="leave"
            title="休暇管理"
            number="06"
            subtitle="スタッフの休暇希望入力と有給休暇残高を一元管理します。"
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            {[
              {
                title: '休暇希望入力',
                icon: '📅',
                desc: 'シフト表の「ビュー切替」で「休暇希望入力」モードに切り替え。カレンダー形式で希望日を選択できます。',
                color: '#6366f1',
                bg: '#eef2ff',
              },
              {
                title: '残高ダッシュボード',
                icon: '📊',
                desc: '全スタッフの有給・特別休暇・介護休暇等の残日数を一覧表示。残日数が少ないスタッフにアラートが出ます。',
                color: '#0ea5e9',
                bg: '#f0f9ff',
              },
              {
                title: '残高不足アラート',
                icon: '🔔',
                desc: '有給休暇残日数が設定した閾値を下回ると、通知ベルに自動でアラートが表示されます。',
                color: '#f59e0b',
                bg: '#fffbeb',
              },
              {
                title: '年休消化カウントダウン',
                icon: '⏱️',
                desc: '年次有給休暇の消化期限が近づいているスタッフを自動検出して通知します。',
                color: '#10b981',
                bg: '#f0fdf4',
              },
            ].map(({ title, icon, desc, color, bg }) => (
              <div
                key={title}
                style={{
                  background: '#fff',
                  borderRadius: '18px',
                  border: '1px solid #e8e6e0',
                  padding: '28px 24px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  height: '100%',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  cursor: 'default',
                }}
                onMouseEnter={cardHoverOn}
                onMouseLeave={cardHoverOff}
              >
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '14px',
                    background: bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '28px',
                    marginBottom: '16px',
                    border: `1px solid ${color}30`,
                  }}
                >
                  {icon}
                </div>
                <p style={{ fontWeight: 700, color: '#111827', fontSize: '17px', margin: '0 0 10px' }}>{title}</p>
                <p style={{ color: '#6b7280', fontSize: '15px', lineHeight: 1.8, margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>

          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '18px', padding: '24px 28px' }}>
            <p style={{ fontWeight: 700, color: '#1e40af', fontSize: '16px', margin: '0 0 16px' }}>
              📋 対応している休暇種別
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {[
                '有給休暇', '特別休暇', '介護休暇', '子の看護休暇',
                '産前・産後休暇', '育児休業', '病気休暇', '慶弔休暇',
              ].map((type) => (
                <span
                  key={type}
                  style={{
                    background: '#dbeafe',
                    color: '#1e40af',
                    fontSize: '14px',
                    padding: '5px 14px',
                    borderRadius: '20px',
                    fontWeight: 500,
                  }}
                >
                  {type}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ──────── 07 Reports ──────── */}
        <section style={{ marginBottom: '96px' }}>
          <SectionHeader
            id="reports"
            title="レポート機能"
            number="07"
            subtitle="上部ナビゲーションの「レポート」から月次レポートページへ遷移できます。多角的なデータ分析・出力が可能です。"
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { name: 'ダッシュボード', desc: '全体のKPIを一覧表示。充足率・残業時間・休暇消化率が一目でわかります。', emoji: '🎯' },
              { name: 'コンプライアンスレポート', desc: '介護保険法の算定要件（資格者配置・ロール配置）への準拠状況を確認できます。', emoji: '⚖️' },
              { name: '管理レポート', desc: 'シフトパターン分析・コスト概算などの管理者向けデータを提供します。', emoji: '💼' },
              { name: '個人統計', desc: 'スタッフ別の勤務実績・残業時間・休暇取得状況を確認できます。', emoji: '👤' },
              { name: 'シフトタイプ分析', desc: '日勤・夜勤など種別ごとの充足率推移をグラフで表示します。', emoji: '📉' },
              { name: '勤務時間分析', desc: '月間労働時間の集計と可視化。法定労働時間超過のスタッフを検出します。', emoji: '🕐' },
              { name: 'ドキュメントアーカイブ', desc: '過去の確定シフトをPDF形式で出力・保存できます。', emoji: '📁' },
            ].map(({ name, desc, emoji }) => (
              <div
                key={name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '18px',
                  padding: '20px 24px',
                  background: '#fff',
                  borderRadius: '14px',
                  border: '1px solid #e8e6e0',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  cursor: 'default',
                }}
                onMouseEnter={cardHoverOn}
                onMouseLeave={(e) => cardHoverOff(e, '0 1px 4px rgba(0,0,0,0.04)')}
              >
                <span style={{ fontSize: '28px', flexShrink: 0 }}>{emoji}</span>
                <div>
                  <p style={{ fontWeight: 700, color: '#1e1b4b', fontSize: '16px', margin: '0 0 4px' }}>{name}</p>
                  <p style={{ color: '#6b7280', fontSize: '15px', lineHeight: 1.7, margin: 0 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ──────── 08 Export ──────── */}
        <section style={{ marginBottom: '96px' }}>
          <SectionHeader
            id="export"
            title="エクスポート"
            number="08"
            subtitle="シフト表を複数のファイル形式でダウンロードできます。"
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
            {[
              {
                format: 'CSV',
                icon: '📊',
                desc: '表計算ソフトで開ける汎用形式。Excelでの加工・印刷に最適です。',
                bg: '#f0fdf4',
                border: '#86efac',
                color: '#16a34a',
              },
              {
                format: 'PDF',
                icon: '📄',
                desc: '印刷に適した固定レイアウト。そのまま掲示板に貼り出せます。',
                bg: '#fef2f2',
                border: '#fca5a5',
                color: '#dc2626',
              },
              {
                format: 'Excel',
                icon: '📑',
                desc: 'レポートページから詳細な分析データをExcel形式で出力できます。',
                bg: '#eff6ff',
                border: '#93c5fd',
                color: '#2563eb',
              },
            ].map(({ format, icon, desc, bg, border, color }) => (
              <div
                key={format}
                style={{
                  background: bg,
                  border: `2px solid ${border}`,
                  borderRadius: '18px',
                  padding: '28px 22px',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  cursor: 'default',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = '';
                  e.currentTarget.style.boxShadow = '';
                }}
              >
                <div style={{ fontSize: '36px', marginBottom: '16px' }}>{icon}</div>
                <p
                  style={{
                    fontWeight: 800,
                    color: color,
                    fontSize: '22px',
                    margin: '0 0 10px',
                    fontFamily: 'ui-monospace, monospace',
                  }}
                >
                  {format}
                </p>
                <p style={{ color: '#374151', fontSize: '15px', lineHeight: 1.8, margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>

          <div style={{ padding: '18px 22px', background: '#f9fafb', borderRadius: '14px', border: '1px solid #e5e7eb' }}>
            <p style={{ fontSize: '16px', color: '#6b7280', margin: 0, lineHeight: 1.7 }}>
              💡 エクスポートボタンはシフト表上部ツールバーの <strong style={{ color: '#374151' }}>「エクスポート」</strong> から実行できます。確定前のドラフト状態でもエクスポート可能です。
            </p>
          </div>
        </section>

        {/* ──────── 09 Keyboard ──────── */}
        <section style={{ marginBottom: '96px' }}>
          <SectionHeader
            id="keyboard"
            title="キーボード操作"
            number="09"
            subtitle={undefined}
          />
          <p style={{ fontSize: '17px', color: '#6b7280', lineHeight: 1.8, margin: '-16px 0 32px' }}>
            シフト表はキーボードで効率よく操作できます。シフト表にフォーカスした状態で <Kbd>?</Kbd> を押すとヘルプが表示されます。
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {[
              {
                category: '基本操作',
                emoji: '🖱️',
                shortcuts: [
                  { keys: ['Tab'], desc: 'フォーカス移動' },
                  { keys: ['Enter'], desc: 'シフト選択モーダルを開く' },
                  { keys: ['Space'], desc: 'シフトをサイクル変更' },
                  { keys: ['Esc'], desc: 'モーダルを閉じる' },
                ],
              },
              {
                category: 'セル移動',
                emoji: '↕️',
                shortcuts: [
                  { keys: ['↑', '↓', '←', '→'], desc: '1セル移動' },
                  { keys: ['Home'], desc: '月初（1日）へ移動' },
                  { keys: ['End'], desc: '月末へ移動' },
                  { keys: ['PageUp'], desc: '7日前へ' },
                  { keys: ['PageDown'], desc: '7日後へ' },
                ],
              },
              {
                category: 'ジャンプ移動',
                emoji: '🚀',
                shortcuts: [
                  { keys: ['Ctrl', '↑'], desc: '最初のスタッフへ' },
                  { keys: ['Ctrl', '↓'], desc: '最後のスタッフへ' },
                  { keys: ['Ctrl', '←'], desc: '月初（1日）へ' },
                  { keys: ['Ctrl', '→'], desc: '月末へ' },
                ],
              },
              {
                category: '履歴操作',
                emoji: '↩️',
                shortcuts: [
                  { keys: ['Ctrl', 'Z'], desc: '元に戻す（アンドゥ）' },
                  { keys: ['Ctrl', 'Shift', 'Z'], desc: 'やり直す（リドゥ）' },
                  { keys: ['?'], desc: 'キーボードヘルプを表示' },
                ],
              },
            ].map(({ category, emoji, shortcuts }) => (
              <div
                key={category}
                style={{
                  background: '#fff',
                  borderRadius: '18px',
                  border: '1px solid #e8e6e0',
                  padding: '24px 22px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  cursor: 'default',
                }}
                onMouseEnter={cardHoverOn}
                onMouseLeave={cardHoverOff}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                  <span style={{ fontSize: '22px' }}>{emoji}</span>
                  <p style={{ fontWeight: 700, color: '#1e1b4b', fontSize: '16px', margin: 0 }}>{category}</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {shortcuts.map(({ keys, desc }) => (
                    <div key={desc} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <span style={{ color: '#6b7280', fontSize: '15px', flex: 1 }}>{desc}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                        {keys.map((key, ki) => (
                          <span key={ki} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Kbd>{key}</Kbd>
                            {ki < keys.length - 1 && <span style={{ color: '#9ca3af', fontSize: '12px' }}>+</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ──────── 10 管理者機能 ──────── */}
        <section style={{ marginBottom: '96px' }}>
          <SectionHeader
            id="admin"
            title="管理者機能"
            number="10"
            subtitle="施設・スタッフデータの一括登録など、管理者専用の操作を解説します。"
          />

          {/* CSV一括インポート */}
          <div
            style={{
              background: '#f8fafc',
              border: '1.5px solid #e2e8f0',
              borderRadius: '20px',
              padding: '32px',
              marginBottom: '24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <span style={{ fontSize: '28px' }}>📥</span>
              <h3 style={{ fontSize: '22px', fontWeight: 700, color: '#1e1b4b', margin: 0 }}>
                CSV一括インポート
              </h3>
            </div>

            <p style={{ fontSize: '16px', color: '#374151', lineHeight: 1.8, margin: '0 0 28px' }}>
              管理画面（施設管理ページ）から、施設とスタッフを一括で登録できます。
              多数の施設・スタッフを手入力なしで素早く登録したい場合に利用してください。
            </p>

            {/* ステップ */}
            {[
              {
                step: '1',
                color: '#6366f1',
                bg: '#eef2ff',
                border: '#c7d2fe',
                title: 'テンプレートCSVをダウンロード',
                desc: '管理画面右上の「CSV一括インポート」ボタンをクリックし、モーダル内の「テンプレートをダウンロード」ボタンを押します。サンプルデータ付きのCSVファイルが保存されます。',
              },
              {
                step: '2',
                color: '#0ea5e9',
                bg: '#f0f9ff',
                border: '#bae6fd',
                title: 'テンプレートにデータを入力',
                desc: 'ダウンロードしたCSVをExcelまたはスプレッドシートで開き、登録したい施設・スタッフの情報を入力します。1行目はヘッダー行のため変更しないでください。',
              },
              {
                step: '3',
                color: '#8b5cf6',
                bg: '#f5f3ff',
                border: '#ddd6fe',
                title: 'CSVファイルをアップロード',
                desc: 'モーダルのファイルアップロードエリアに、作成したCSVをドラッグ＆ドロップするか、クリックしてファイルを選択します。アップロード後、自動でバリデーションが実行されます。',
              },
              {
                step: '4',
                color: '#10b981',
                bg: '#f0fdf4',
                border: '#bbf7d0',
                title: 'バリデーション結果を確認してインポート',
                desc: '各行の検証結果が表でプレビュー表示されます。エラー行はスキップされ、有効行のみが登録対象になります。内容を確認後「○件をインポート」ボタンを押すと一括登録が完了します。',
              },
            ].map(({ step, color, bg, border, title, desc }) => (
              <div
                key={step}
                style={{
                  display: 'flex',
                  gap: '20px',
                  marginBottom: '20px',
                  alignItems: 'flex-start',
                }}
              >
                <div
                  style={{
                    flexShrink: 0,
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: bg,
                    border: `2px solid ${border}`,
                    color,
                    fontWeight: 700,
                    fontSize: '15px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: '2px',
                  }}
                >
                  {step}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 700, color: '#1e1b4b', fontSize: '17px', margin: '0 0 6px' }}>{title}</p>
                  <p style={{ color: '#374151', fontSize: '15px', lineHeight: 1.8, margin: 0 }}>{desc}</p>
                </div>
              </div>
            ))}

            {/* CSV列の説明 */}
            <div
              style={{
                marginTop: '28px',
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '14px',
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: '16px 20px', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                <p style={{ fontWeight: 700, color: '#1e1b4b', fontSize: '15px', margin: 0 }}>📋 CSVの主な列（施設＋スタッフ形式）</p>
              </div>
              <div style={{ padding: '16px 20px' }}>
                {[
                  { col: '施設名', desc: '登録する施設名。既存施設名を入力すると既存施設にスタッフを追加、新しい名前を入力すると施設も自動作成されます。' },
                  { col: '名前', desc: 'スタッフの氏名。必須項目です。' },
                  { col: '役職', desc: '「介護職員」「看護師」「ケアマネジャー」などの役職名。' },
                  { col: '資格', desc: '「介護福祉士」「社会福祉士」など複数ある場合は「/」区切りで入力。' },
                  { col: '夜勤専従', desc: '「true」または「false」で指定。省略時はfalse。' },
                  { col: '最大連続勤務日数', desc: '1〜7の整数。省略時は5日。' },
                ].map(({ col, desc }) => (
                  <div
                    key={col}
                    style={{
                      display: 'flex',
                      gap: '16px',
                      padding: '10px 0',
                      borderBottom: '1px solid #f1f5f9',
                      alignItems: 'flex-start',
                    }}
                  >
                    <span
                      style={{
                        flexShrink: 0,
                        background: '#eef2ff',
                        color: '#6366f1',
                        fontWeight: 700,
                        fontSize: '13px',
                        padding: '3px 10px',
                        borderRadius: '6px',
                        fontFamily: 'ui-monospace, monospace',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {col}
                    </span>
                    <p style={{ color: '#374151', fontSize: '14px', lineHeight: 1.7, margin: 0 }}>{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <TipBox variant="warning">
            CSVファイルはUTF-8形式で保存してください。Excelで編集した場合は「CSV UTF-8（コンマ区切り）」形式で保存するとExcelでの文字化けが防げます。テンプレートをそのまま使えば文字コードの問題は発生しません。
          </TipBox>
          <TipBox>
            エラーがある行はスキップされ、有効な行のみがインポートされます。インポート後にスキップされた行を確認し、データを修正して再度インポートすることができます。
          </TipBox>
        </section>

        {/* ──────── 11 FAQ ──────── */}
        <section style={{ marginBottom: '48px' }}>
          <SectionHeader
            id="faq"
            title="よくある質問"
            number="11"
            subtitle={undefined}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {FAQ_ITEMS.map(({ q, a }, index) => (
              <div
                key={index}
                style={{
                  background: '#fff',
                  borderRadius: '16px',
                  border: `1.5px solid ${openFAQ === index ? '#c7d2fe' : '#e8e6e0'}`,
                  overflow: 'hidden',
                  boxShadow: openFAQ === index ? '0 4px 16px rgba(99,102,241,0.1)' : '0 1px 4px rgba(0,0,0,0.04)',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
              >
                <button
                  onClick={() => setOpenFAQ(openFAQ === index ? null : index)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '22px 26px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    gap: '20px',
                    fontFamily: 'inherit',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flex: 1 }}>
                    <span
                      style={{
                        flexShrink: 0,
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: '#eef2ff',
                        color: '#6366f1',
                        fontWeight: 700,
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginTop: '2px',
                      }}
                    >
                      Q
                    </span>
                    <span style={{ fontWeight: 600, color: '#111827', fontSize: '17px', flex: 1, lineHeight: 1.6 }}>
                      {q}
                    </span>
                  </div>
                  <span
                    style={{
                      color: '#6366f1',
                      flexShrink: 0,
                      fontSize: '14px',
                      display: 'inline-block',
                      transform: openFAQ === index ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.25s ease',
                    }}
                  >
                    ▼
                  </span>
                </button>

                <div
                  style={{
                    maxHeight: openFAQ === index ? '400px' : '0',
                    overflow: 'hidden',
                    transition: 'max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                >
                  <div style={{ padding: '0 26px 24px 26px', borderTop: '1px solid #f0f0f0' }}>
                    <div style={{ display: 'flex', gap: '14px', marginTop: '18px' }}>
                      <span
                        style={{
                          flexShrink: 0,
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: '#f0fdf4',
                          color: '#16a34a',
                          fontWeight: 700,
                          fontSize: '13px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        A
                      </span>
                      <p style={{ color: '#374151', fontSize: '16px', lineHeight: 1.9, margin: 0, flex: 1 }}>{a}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <div
          style={{
            marginTop: '64px',
            paddingTop: '40px',
            borderTop: '1px solid #e5e7eb',
            textAlign: 'center',
          }}
        >
          <p style={{ color: '#9ca3af', fontSize: '16px', margin: '0 0 20px', lineHeight: 1.7 }}>
            ご不明な点は施設管理者またはシステム担当者にお問い合わせください。
          </p>
          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              color: '#6366f1',
              textDecoration: 'none',
              fontSize: '16px',
              fontWeight: 600,
              padding: '12px 24px',
              background: '#eef2ff',
              borderRadius: '12px',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#e0e7ff')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#eef2ff')}
          >
            ← アプリケーションに戻る
          </Link>
        </div>
      </main>
    </div>
  );
};

export default HelpPage;
