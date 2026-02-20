/**
 * HelpPage - アプリケーション使い方ガイド
 *
 * 設計: "Premium Japanese Documentation" aesthetic
 * - ダークインディゴのスティッキーサイドバー + スクロールスパイナビゲーション
 * - Noto Serif JP 見出し + Noto Sans JP 本文
 * - 装飾的な大型セクション番号 + カード型コンテンツ
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

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
  | 'faq';

const NAV_SECTIONS: { id: SectionId; title: string; emoji: string; number: string }[] = [
  { id: 'quickstart', title: 'クイックスタート', emoji: '🚀', number: '01' },
  { id: 'staff', title: 'スタッフ設定', emoji: '👥', number: '02' },
  { id: 'requirements', title: 'シフト要件設定', emoji: '📋', number: '03' },
  { id: 'generation', title: 'AI自動生成', emoji: '⚙️', number: '04' },
  { id: 'evaluation', title: '評価・改善提案', emoji: '📊', number: '05' },
  { id: 'leave', title: '休暇管理', emoji: '🏖️', number: '06' },
  { id: 'reports', title: 'レポート機能', emoji: '📈', number: '07' },
  { id: 'export', title: 'エクスポート', emoji: '📤', number: '08' },
  { id: 'keyboard', title: 'キーボード操作', emoji: '⌨️', number: '09' },
  { id: 'faq', title: 'よくある質問', emoji: '❓', number: '10' },
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

// ─── Sub-components ─────────────────────────────────────────

const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2px 7px',
      fontSize: '11px',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontWeight: 600,
      color: '#374151',
      background: '#f9fafb',
      border: '1px solid #d1d5db',
      borderRadius: '5px',
      boxShadow: '0 2px 0 #d1d5db',
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
    info: { bg: '#fffbeb', border: '#fcd34d', text: '#92400e', icon: '💡' },
    warning: { bg: '#fff7ed', border: '#fb923c', text: '#9a3412', icon: '⚠️' },
  }[variant];
  return (
    <div
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderRadius: '12px',
        padding: '14px 18px',
        display: 'flex',
        gap: '10px',
        marginTop: '16px',
      }}
    >
      <span style={{ fontSize: '16px', flexShrink: 0, marginTop: '1px' }}>{cfg.icon}</span>
      <p style={{ fontSize: '13px', color: cfg.text, lineHeight: 1.7, margin: 0 }}>{children}</p>
    </div>
  );
};

const Section = ({
  id,
  title,
  number,
  children,
}: {
  id: string;
  title: string;
  number: string;
  children: React.ReactNode;
}) => (
  <section id={id} style={{ scrollMarginTop: '40px', marginBottom: '72px' }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '28px' }}>
      <span
        style={{
          fontSize: '80px',
          fontWeight: 900,
          color: '#eeede9',
          lineHeight: 1,
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          userSelect: 'none',
          marginTop: '-10px',
          letterSpacing: '-3px',
          flexShrink: 0,
        }}
      >
        {number}
      </span>
      <h2
        style={{
          fontSize: '22px',
          fontWeight: 700,
          color: '#1e1b4b',
          margin: '0',
          paddingTop: '10px',
          fontFamily: '"Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", "MS Mincho", serif',
          lineHeight: 1.3,
        }}
      >
        {title}
      </h2>
    </div>
    {children}
  </section>
);

// ─── Main Component ──────────────────────────────────────────

export const HelpPage = () => {
  const [activeSection, setActiveSection] = useState<SectionId>('quickstart');
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);

  // スクロールスパイ
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((e) => e.isIntersecting);
        if (visible) setActiveSection(visible.target.id as SectionId);
      },
      { rootMargin: '-10% 0px -72% 0px' }
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

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif',
        background: '#f7f6f2',
      }}
    >
      {/* ── Sidebar ── */}
      <nav
        style={{
          width: '232px',
          flexShrink: 0,
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflowY: 'auto',
          background: 'linear-gradient(175deg, #1e1b4b 0%, #312e81 55%, #3730a3 100%)',
          boxShadow: '4px 0 24px rgba(30,27,75,0.18)',
        }}
      >
        <div style={{ padding: '28px 18px 40px' }}>
          {/* Back link */}
          <Link
            to="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#a5b4fc',
              textDecoration: 'none',
              fontSize: '12px',
              fontWeight: 500,
              marginBottom: '28px',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#e0e7ff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#a5b4fc')}
          >
            ← アプリに戻る
          </Link>

          {/* Title */}
          <div style={{ marginBottom: '24px' }}>
            <p
              style={{
                color: '#6366f1',
                fontSize: '9px',
                fontWeight: 700,
                letterSpacing: '2.5px',
                textTransform: 'uppercase',
                margin: '0 0 5px',
              }}
            >
              HELP CENTER
            </p>
            <h1 style={{ color: '#fff', fontSize: '15px', fontWeight: 700, margin: 0, lineHeight: 1.4 }}>
              使い方ガイド
            </h1>
          </div>

          {/* Nav items */}
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {NAV_SECTIONS.map(({ id, title, emoji }) => {
              const isActive = activeSection === id;
              return (
                <li key={id}>
                  <button
                    onClick={() => scrollTo(id)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '9px 11px',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '9px',
                      fontSize: '13px',
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? '#fff' : '#a5b4fc',
                      background: isActive ? 'rgba(99,102,241,0.45)' : 'transparent',
                      transition: 'all 0.15s',
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <span style={{ fontSize: '14px', lineHeight: 1 }}>{emoji}</span>
                    <span style={{ flex: 1 }}>{title}</span>
                    {isActive && (
                      <span
                        style={{
                          width: '5px',
                          height: '5px',
                          borderRadius: '50%',
                          background: '#818cf8',
                          flexShrink: 0,
                        }}
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {/* ── Main content ── */}
      <main style={{ flex: 1, padding: '52px 64px 96px 64px', maxWidth: '880px' }}>
        {/* Hero */}
        <div style={{ marginBottom: '64px' }}>
          <p
            style={{
              color: '#6366f1',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '3px',
              textTransform: 'uppercase',
              margin: '0 0 14px',
            }}
          >
            Help Center
          </p>
          <h1
            style={{
              fontSize: '34px',
              fontWeight: 800,
              color: '#111827',
              margin: '0 0 16px',
              fontFamily: '"Noto Serif JP", "Hiragino Mincho ProN", serif',
              lineHeight: 1.2,
              letterSpacing: '-0.5px',
            }}
          >
            ご利用ガイド
          </h1>
          <p style={{ color: '#6b7280', fontSize: '15px', lineHeight: 1.9, margin: 0, maxWidth: '560px' }}>
            介護シフト管理システムの使い方を解説します。
            <br />
            自動生成から詳細なレポートまで、すべての機能をわかりやすく説明します。
          </p>
        </div>

        {/* ──────── 01 Quick Start ──────── */}
        <Section id="quickstart" title="クイックスタート" number="01">
          <p style={{ color: '#6b7280', marginBottom: '24px', lineHeight: 1.8, fontSize: '14px' }}>
            初めてお使いの方は、以下の5ステップでシフト作成を始めることができます。
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              {
                step: 1,
                title: 'スタッフを登録する',
                desc: '左サイドバーの「スタッフ設定」を開き、スタッフの氏名・役割・資格・勤務設定を入力します。',
              },
              {
                step: 2,
                title: 'シフト種別を確認する',
                desc: '「シフト種別設定」で日勤・夜勤などの時間帯を確認します。施設の形態に合わせて調整できます。',
              },
              {
                step: 3,
                title: '対象月と必要人員を設定する',
                desc: '右エリアの月選択で作成したい年月を指定し、「シフト要件」で曜日・時間帯ごとの必要人員数を設定します。',
              },
              {
                step: 4,
                title: 'シフト自動生成を実行する',
                desc: 'サイドバー下部の「シフト作成実行」ボタンをクリックします。CP-SAT Solverが設定した制約を満たすシフトを自動生成します。',
              },
              {
                step: 5,
                title: '評価結果を確認・手動調整する',
                desc: '生成後に評価スコアと改善提案が表示されます。手動調整が必要な場合はシフト表のセルを直接クリックして編集できます。',
              },
            ].map(({ step, title, desc }) => (
              <div
                key={step}
                style={{
                  display: 'flex',
                  gap: '16px',
                  padding: '16px 20px',
                  background: '#fff',
                  borderRadius: '12px',
                  border: '1px solid #eeede9',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                }}
              >
                <div
                  style={{
                    flexShrink: 0,
                    width: '34px',
                    height: '34px',
                    background: '#4f46e5',
                    color: '#fff',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '13px',
                  }}
                >
                  {step}
                </div>
                <div>
                  <p style={{ fontWeight: 600, color: '#111827', fontSize: '14px', margin: '0 0 4px' }}>{title}</p>
                  <p style={{ color: '#9ca3af', fontSize: '13px', lineHeight: 1.7, margin: 0 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ──────── 02 Staff ──────── */}
        <Section id="staff" title="スタッフ設定" number="02">
          <p style={{ color: '#6b7280', marginBottom: '20px', lineHeight: 1.8, fontSize: '14px' }}>
            スタッフ情報を正確に設定することで、最適なシフト生成が可能になります。
            各スタッフの属性がシフト割り当ての制約として使用されます。
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            {[
              {
                label: '基本情報',
                bg: '#eef2ff',
                border: '#c7d2fe',
                dot: '#6366f1',
                items: ['氏名', '役割（介護職員・看護師・ケアマネ・管理者 等）', '資格（介護福祉士・社会福祉士・看護師 等）'],
              },
              {
                label: '勤務設定',
                bg: '#f0fdf4',
                border: '#bbf7d0',
                dot: '#22c55e',
                items: ['最大連続勤務日数', '勤務可能な時間帯（日勤のみ・夜勤のみ・両方）', '希望休日（曜日・特定日指定）'],
              },
            ].map(({ label, bg, border, dot, items }) => (
              <div
                key={label}
                style={{
                  background: bg,
                  border: `1px solid ${border}`,
                  borderRadius: '12px',
                  padding: '16px 18px',
                }}
              >
                <p
                  style={{
                    fontWeight: 700,
                    color: '#1e1b4b',
                    fontSize: '11px',
                    margin: '0 0 12px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  {label}
                </p>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  {items.map((item) => (
                    <li
                      key={item}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: '#374151' }}
                    >
                      <span
                        style={{
                          width: '5px',
                          height: '5px',
                          borderRadius: '50%',
                          background: dot,
                          flexShrink: 0,
                          marginTop: '5px',
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
        </Section>

        {/* ──────── 03 Requirements ──────── */}
        <Section id="requirements" title="シフト要件設定" number="03">
          <p style={{ color: '#6b7280', marginBottom: '20px', lineHeight: 1.8, fontSize: '14px' }}>
            各シフト（日勤・夜勤等）の必要人員数、資格要件、ロール要件を設定します。
            これらの設定がシフト自動生成の制約条件になります。
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              {
                title: '必要人員数',
                desc: 'シフト種別ごとに最低限必要なスタッフ数を設定します。この人数を下回ると評価スコアが下がります。',
              },
              {
                title: '資格要件',
                desc: '特定の資格（介護福祉士等）を持つスタッフが何名以上必要かを設定します。資格が不要な場合は設定不要です。',
              },
              {
                title: 'ロール要件',
                desc: '看護師・ケアマネジャー等の職種が最低何名必要かを設定します。介護報酬算定の要件に合わせて設定します。',
              },
              {
                title: '施設種別（夜勤なし設定）',
                desc: 'デイサービスなど夜勤のない施設では「夜勤なし」を選択。日曜日が自動的に営業外として除外されます。',
              },
            ].map(({ title, desc }) => (
              <div
                key={title}
                style={{
                  display: 'flex',
                  gap: '14px',
                  padding: '14px 18px',
                  background: '#fff',
                  borderRadius: '10px',
                  border: '1px solid #eeede9',
                }}
              >
                <div style={{ width: '3px', background: '#6366f1', borderRadius: '3px', flexShrink: 0 }} />
                <div>
                  <span style={{ fontWeight: 600, color: '#1e1b4b', fontSize: '13px' }}>{title}：</span>
                  <span style={{ color: '#6b7280', fontSize: '13px', lineHeight: 1.7 }}>{desc}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ──────── 04 Generation ──────── */}
        <Section id="generation" title="AI自動生成" number="04">
          <p style={{ color: '#6b7280', marginBottom: '20px', lineHeight: 1.8, fontSize: '14px' }}>
            CP-SAT（制約充足ソルバー）を使用し、設定したすべての制約を満たす最適なシフトを自動生成します。
            LLMは使用せず、決定的なアルゴリズムで毎回同じ条件なら同じ結果を返します。
          </p>
          <div
            style={{
              background: 'linear-gradient(135deg, #1e1b4b 0%, #3730a3 100%)',
              borderRadius: '16px',
              padding: '24px 28px',
              marginBottom: '16px',
            }}
          >
            <p
              style={{
                color: '#a5b4fc',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '2px',
                textTransform: 'uppercase',
                margin: '0 0 18px',
              }}
            >
              生成の仕組み
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {[
                { icon: '📝', label: '制約定義', desc: '人員・資格・連続勤務・夜勤後休息の条件を収集' },
                { icon: '🔄', label: '最適化計算', desc: 'CP-SATが全制約を満たすシフトを自動探索' },
                { icon: '✅', label: '評価生成', desc: '充足度をスコア化し改善提案を自動出力' },
              ].map(({ icon, label, desc }) => (
                <div
                  key={label}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    borderRadius: '12px',
                    padding: '18px 14px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '26px', marginBottom: '10px' }}>{icon}</div>
                  <p style={{ color: '#fff', fontWeight: 600, fontSize: '13px', margin: '0 0 6px' }}>{label}</p>
                  <p style={{ color: '#a5b4fc', fontSize: '11px', lineHeight: 1.6, margin: 0 }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              border: '1px solid #eeede9',
              padding: '16px 20px',
              marginBottom: '12px',
            }}
          >
            <p style={{ fontWeight: 600, color: '#1e1b4b', fontSize: '13px', margin: '0 0 12px' }}>生成前の確認事項</p>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                'スタッフが1名以上登録されている',
                'シフト種別ごとの必要人員数が設定されている',
                '対象年月が正しく選択されている',
                '「データ設定診断」でエラーが出ていない',
              ].map((item, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '13px', color: '#374151' }}>
                  <span
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      background: '#4f46e5',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <TipBox variant="warning">
            生成中はページを離れないでください。通常10〜60秒で完了します。スタッフ数が多い場合や制約が複雑な場合は、さらに時間がかかることがあります。
          </TipBox>
        </Section>

        {/* ──────── 05 Evaluation ──────── */}
        <Section id="evaluation" title="評価・改善提案" number="05">
          <p style={{ color: '#6b7280', marginBottom: '20px', lineHeight: 1.8, fontSize: '14px' }}>
            シフト生成後に自動で評価が実行されます。制約違反の内容と改善提案が右パネルに表示されます。
            手動で編集した後も「再評価」ボタンでスコアを更新できます。
          </p>
          <p style={{ fontWeight: 600, color: '#1e1b4b', fontSize: '14px', margin: '0 0 12px' }}>
            制約レベルと評価スコアへの影響
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            {[
              {
                level: 'L1',
                label: '絶対必須（労基法・夜勤後休息 等）',
                impact: '即 0点',
                bg: '#fef2f2',
                border: '#fecaca',
                badge: '#dc2626',
              },
              {
                level: 'L2',
                label: '運営必須（必要人員不足・ロール不足 等）',
                impact: '−12点/件',
                bg: '#fff7ed',
                border: '#fed7aa',
                badge: '#ea580c',
              },
              {
                level: 'L3',
                label: '努力目標（希望休未反映 等）',
                impact: '−4点/件',
                bg: '#fefce8',
                border: '#fef08a',
                badge: '#ca8a04',
              },
              {
                level: 'L4',
                label: '推奨（スタッフ追加 等）',
                impact: '0点',
                bg: '#f0fdf4',
                border: '#bbf7d0',
                badge: '#16a34a',
              },
            ].map(({ level, label, impact, bg, border, badge }) => (
              <div
                key={level}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '12px 16px',
                  background: bg,
                  border: `1px solid ${border}`,
                  borderRadius: '10px',
                }}
              >
                <span
                  style={{
                    background: badge,
                    color: '#fff',
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 9px',
                    borderRadius: '20px',
                    flexShrink: 0,
                    fontFamily: 'ui-monospace, monospace',
                  }}
                >
                  {level}
                </span>
                <span style={{ flex: 1, fontSize: '13px', color: '#374151' }}>{label}</span>
                <span style={{ fontSize: '12px', color: '#9ca3af', fontFamily: 'ui-monospace, monospace', flexShrink: 0 }}>
                  {impact}
                </span>
              </div>
            ))}
          </div>
          <TipBox>
            評価パネルの「根本原因分析」タブでは、問題の根本的な原因が表示されます。
            スコアが低い場合はまずL1・L2の違反を優先的に解消してください。
          </TipBox>
        </Section>

        {/* ──────── 06 Leave ──────── */}
        <Section id="leave" title="休暇管理" number="06">
          <p style={{ color: '#6b7280', marginBottom: '20px', lineHeight: 1.8, fontSize: '14px' }}>
            スタッフの休暇希望入力と有給休暇残高を一元管理します。
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            {[
              {
                title: '休暇希望入力',
                icon: '📅',
                desc: 'シフト表の「ビュー切替」で「休暇希望入力」モードに切り替え。カレンダー形式で希望日を選択できます。',
              },
              {
                title: '休暇残高ダッシュボード',
                icon: '📊',
                desc: '全スタッフの有給・特別休暇・介護休暇等の残日数を一覧表示。残日数が少ないスタッフにアラートが出ます。',
              },
              {
                title: '残高不足アラート',
                icon: '🔔',
                desc: '有給休暇残日数が設定した閾値を下回ると、通知ベルに自動でアラートが表示されます。',
              },
              {
                title: '年休消化カウントダウン',
                icon: '⏱️',
                desc: '年次有給休暇の消化期限が近づいているスタッフを自動検出して通知します。',
              },
            ].map(({ title, icon, desc }) => (
              <div
                key={title}
                style={{
                  background: '#fff',
                  borderRadius: '12px',
                  border: '1px solid #eeede9',
                  padding: '18px',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                }}
              >
                <div style={{ fontSize: '26px', marginBottom: '10px' }}>{icon}</div>
                <p style={{ fontWeight: 600, color: '#111827', fontSize: '13px', margin: '0 0 6px' }}>{title}</p>
                <p style={{ color: '#9ca3af', fontSize: '12px', lineHeight: 1.7, margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '14px 18px' }}>
            <p style={{ fontWeight: 600, color: '#1e40af', fontSize: '12px', margin: '0 0 10px' }}>対応している休暇種別</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {[
                '有給休暇',
                '特別休暇',
                '介護休暇',
                '子の看護休暇',
                '産前・産後休暇',
                '育児休業',
                '病気休暇',
                '慶弔休暇',
              ].map((type) => (
                <span
                  key={type}
                  style={{
                    background: '#dbeafe',
                    color: '#1e40af',
                    fontSize: '11px',
                    padding: '3px 10px',
                    borderRadius: '20px',
                    fontWeight: 500,
                  }}
                >
                  {type}
                </span>
              ))}
            </div>
          </div>
        </Section>

        {/* ──────── 07 Reports ──────── */}
        <Section id="reports" title="レポート機能" number="07">
          <p style={{ color: '#6b7280', marginBottom: '20px', lineHeight: 1.8, fontSize: '14px' }}>
            上部ナビゲーションの「レポート」から月次レポートページへ遷移できます。
            多角的なデータ分析・出力が可能です。
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { name: 'ダッシュボード', desc: '全体のKPIを一覧表示。充足率・残業時間・休暇消化率が一目でわかります。' },
              {
                name: 'コンプライアンスレポート',
                desc: '介護保険法の算定要件（資格者配置・ロール配置）への準拠状況を確認できます。',
              },
              { name: '管理レポート', desc: 'シフトパターン分析・コスト概算などの管理者向けデータを提供します。' },
              { name: '個人統計', desc: 'スタッフ別の勤務実績・残業時間・休暇取得状況を確認できます。' },
              { name: 'シフトタイプ分析', desc: '日勤・夜勤など種別ごとの充足率推移をグラフで表示します。' },
              {
                name: '勤務時間分析',
                desc: '月間労働時間の集計と可視化。法定労働時間超過のスタッフを検出します。',
              },
              { name: 'ドキュメントアーカイブ', desc: '過去の確定シフトをPDF形式で出力・保存できます。' },
            ].map(({ name, desc }) => (
              <div
                key={name}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '16px',
                  padding: '12px 18px',
                  background: '#fff',
                  borderRadius: '10px',
                  border: '1px solid #eeede9',
                }}
              >
                <span style={{ fontWeight: 600, color: '#1e1b4b', fontSize: '13px', minWidth: '180px', flexShrink: 0 }}>
                  {name}
                </span>
                <span style={{ color: '#9ca3af', fontSize: '12px', flex: 1, lineHeight: 1.6 }}>{desc}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ──────── 08 Export ──────── */}
        <Section id="export" title="エクスポート" number="08">
          <p style={{ color: '#6b7280', marginBottom: '20px', lineHeight: 1.8, fontSize: '14px' }}>
            シフト表を複数のファイル形式でダウンロードできます。
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '14px' }}>
            {[
              {
                format: 'CSV',
                icon: '📊',
                desc: '表計算ソフトで開ける汎用形式。Excelでの加工・印刷に最適です。',
                bg: '#f0fdf4',
                border: '#bbf7d0',
                badge: '#16a34a',
              },
              {
                format: 'PDF',
                icon: '📄',
                desc: '印刷に適した固定レイアウト。そのまま掲示板に貼り出せます。',
                bg: '#fef2f2',
                border: '#fecaca',
                badge: '#dc2626',
              },
              {
                format: 'Excel',
                icon: '📑',
                desc: 'レポートページから詳細な分析データをExcel形式で出力できます。',
                bg: '#eff6ff',
                border: '#bfdbfe',
                badge: '#2563eb',
              },
            ].map(({ format, icon, desc, bg, border, badge }) => (
              <div key={format} style={{ background: bg, border: `1px solid ${border}`, borderRadius: '14px', padding: '20px 16px' }}>
                <div style={{ fontSize: '28px', marginBottom: '12px' }}>{icon}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 700, color: '#111827', fontSize: '15px' }}>{format}</span>
                  <span
                    style={{
                      background: badge,
                      color: '#fff',
                      fontSize: '9px',
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: '3px',
                    }}
                  >
                    {format}
                  </span>
                </div>
                <p style={{ color: '#6b7280', fontSize: '12px', lineHeight: 1.7, margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
          <div
            style={{
              padding: '12px 16px',
              background: '#f9fafb',
              borderRadius: '10px',
              border: '1px solid #e5e7eb',
              fontSize: '12px',
              color: '#6b7280',
            }}
          >
            💡 エクスポートボタンはシフト表上部ツールバーの <strong>「エクスポート」</strong> から実行できます。確定前のドラフト状態でもエクスポート可能です。
          </div>
        </Section>

        {/* ──────── 09 Keyboard ──────── */}
        <Section id="keyboard" title="キーボード操作" number="09">
          <p style={{ color: '#6b7280', marginBottom: '20px', lineHeight: 1.8, fontSize: '14px' }}>
            シフト表はキーボードで効率よく操作できます。シフト表にフォーカスした状態で{' '}
            <Kbd>?</Kbd> を押すとヘルプが表示されます。
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {[
              {
                category: '基本操作',
                shortcuts: [
                  { keys: ['Tab'], desc: 'フォーカス移動' },
                  { keys: ['Enter'], desc: 'シフト選択モーダルを開く' },
                  { keys: ['Space'], desc: 'シフトをサイクル変更' },
                  { keys: ['Esc'], desc: 'モーダルを閉じる' },
                ],
              },
              {
                category: 'セル移動',
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
                shortcuts: [
                  { keys: ['Ctrl', '↑'], desc: '最初のスタッフへ' },
                  { keys: ['Ctrl', '↓'], desc: '最後のスタッフへ' },
                  { keys: ['Ctrl', '←'], desc: '月初（1日）へ' },
                  { keys: ['Ctrl', '→'], desc: '月末へ' },
                ],
              },
              {
                category: '履歴操作',
                shortcuts: [
                  { keys: ['Ctrl', 'Z'], desc: '元に戻す（アンドゥ）' },
                  { keys: ['Ctrl', 'Shift', 'Z'], desc: 'やり直す（リドゥ）' },
                  { keys: ['?'], desc: 'キーボードヘルプを表示' },
                ],
              },
            ].map(({ category, shortcuts }) => (
              <div
                key={category}
                style={{
                  background: '#fff',
                  borderRadius: '12px',
                  border: '1px solid #eeede9',
                  padding: '16px 18px',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                }}
              >
                <p
                  style={{
                    fontWeight: 700,
                    color: '#1e1b4b',
                    fontSize: '11px',
                    margin: '0 0 14px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  {category}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                  {shortcuts.map(({ keys, desc }) => (
                    <div
                      key={desc}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}
                    >
                      <span style={{ color: '#6b7280', fontSize: '12px' }}>{desc}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                        {keys.map((key, i) => (
                          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <Kbd>{key}</Kbd>
                            {i < keys.length - 1 && (
                              <span style={{ color: '#d1d5db', fontSize: '10px' }}>+</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ──────── 10 FAQ ──────── */}
        <Section id="faq" title="よくある質問" number="10">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {FAQ_ITEMS.map(({ q, a }, index) => (
              <div
                key={index}
                style={{
                  background: '#fff',
                  borderRadius: '12px',
                  border: '1px solid #eeede9',
                  overflow: 'hidden',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                }}
              >
                <button
                  onClick={() => setOpenFAQ(openFAQ === index ? null : index)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    gap: '16px',
                    fontFamily: 'inherit',
                  }}
                >
                  <span style={{ fontWeight: 500, color: '#111827', fontSize: '13px', flex: 1, lineHeight: 1.5 }}>
                    Q. {q}
                  </span>
                  <span
                    style={{
                      color: '#6366f1',
                      flexShrink: 0,
                      fontSize: '11px',
                      display: 'inline-block',
                      transform: openFAQ === index ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.2s ease',
                    }}
                  >
                    ▼
                  </span>
                </button>
                {openFAQ === index && (
                  <div style={{ padding: '0 20px 16px', borderTop: '1px solid #f3f4f6' }}>
                    <p
                      style={{
                        color: '#6b7280',
                        fontSize: '13px',
                        lineHeight: 1.8,
                        margin: '12px 0 0',
                        paddingLeft: '14px',
                        borderLeft: '3px solid #c7d2fe',
                      }}
                    >
                      {a}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>

        {/* Footer */}
        <div
          style={{
            marginTop: '40px',
            paddingTop: '28px',
            borderTop: '1px solid #e5e7eb',
            textAlign: 'center',
          }}
        >
          <p style={{ color: '#9ca3af', fontSize: '13px', margin: '0 0 14px' }}>
            ご不明な点は施設管理者またはシステム担当者にお問い合わせください。
          </p>
          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: '#6366f1',
              textDecoration: 'none',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            ← アプリケーションに戻る
          </Link>
        </div>
      </main>
    </div>
  );
};

export default HelpPage;
