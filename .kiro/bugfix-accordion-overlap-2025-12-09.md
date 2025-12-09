# BUG-020: アコーディオン展開時のUI重複問題

**発生日**: 2025-12-09
**解決日**: 2025-12-09
**報告者**: ユーザー
**優先度**: 中（UX影響あり、機能は動作する）

---

## 現象

スタッフ情報のアコーディオンを展開すると、下部のコンテンツ（シフト種別設定、勤務できない日、スタッフ削除ボタン等）と重なって表示される。

## 影響範囲

- `Accordion`コンポーネントを使用する全てのセクション
  - スタッフ情報設定
  - シフト種別設定
  - 休暇残高管理
  - 事業所のシフト要件設定

---

## 原因分析

### 問題のコード

```tsx
// components/Accordion.tsx:33
<div className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-screen' : 'max-h-0 overflow-hidden'}`}>
```

### 根本原因

1. **`max-h-screen`（100vh）の制限**
   - `max-height: 100vh`はビューポートの高さであり、コンテンツの実際の高さとは無関係
   - スタッフ情報設定内で複数のスタッフを展開すると、コンテンツ量が100vhを超える可能性がある

2. **`overflow-hidden`の適用タイミング**
   - 閉じた状態では`max-h-0 overflow-hidden`が適用される
   - 開いた状態では`max-h-screen`のみで`overflow`は未指定（`visible`がデフォルト）
   - この状態でコンテンツが`max-h-screen`を超えると、はみ出して重複表示される

3. **ネストされたアコーディオン構造**
   - `StaffSettings`内の個別スタッフ展開もアコーディオン的な動作をする
   - 親と子のアコーディオンが同時に展開されると、`max-height`の計算が複雑になる

---

## 修正内容

### CSSグリッドベースのアニメーションに変更

**修正前**:
```tsx
<div className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-screen' : 'max-h-0 overflow-hidden'}`}>
  <div className="p-4 bg-slate-50 border-t border-slate-200">
    {children}
  </div>
</div>
```

**修正後**:
```tsx
<div
  className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
    isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
  }`}
>
  <div className="overflow-hidden">
    <div className="p-4 bg-slate-50 border-t border-slate-200">
      {children}
    </div>
  </div>
</div>
```

### 修正理由

| 項目 | max-height方式 | CSS Grid方式 |
|------|---------------|--------------|
| コンテンツ量対応 | 固定値（100vh）で制限 | 自動で1frに拡張 |
| アニメーション | 0→固定値（不自然な場合あり） | 0fr→1fr（自然な展開） |
| overflow制御 | 開いた状態でvisible（重複原因） | 常にhiddenでclip |
| ネスト対応 | 親子の高さ計算が競合 | 各グリッドが独立計算 |

---

## 変更ファイル

| ファイル | 変更内容 |
|----------|----------|
| `components/Accordion.tsx` | アニメーション方式をCSS Gridに変更 |

---

## テスト確認項目

- [x] ビルド成功
- [ ] スタッフ情報設定アコーディオン展開時に重複なし
- [ ] 複数スタッフ同時展開でも正常表示
- [ ] シフト種別設定アコーディオン正常動作
- [ ] 休暇残高管理アコーディオン正常動作
- [ ] アコーディオン開閉アニメーションが自然

---

## 関連情報

- **コンポーネント**: `components/Accordion.tsx`
- **使用箇所**: `App.tsx`内の左サイドバー
- **技術参考**: [CSS Grid accordion technique](https://css-tricks.com/css-grid-animation/)

---

## 教訓

1. **`max-height`アニメーションの限界**
   - コンテンツ量が可変の場合、固定値の`max-height`は不適切
   - `max-h-screen`でも内部コンテンツが多いと重複が発生

2. **CSS Gridの`grid-rows-[0fr]/[1fr]`パターン**
   - コンテンツ量に関係なく自然なアニメーションが可能
   - 内部の`overflow-hidden`と組み合わせることでクリッピングも確実

3. **ネストされたUI構造の考慮**
   - アコーディオン内にさらに展開可能なUIがある場合、高さ計算が複雑になる
   - 各レベルで独立して機能するCSS手法を選択すべき
