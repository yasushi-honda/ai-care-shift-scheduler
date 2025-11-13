# Phase 19.3.1.1 実装計画 - jsPDF日本語フォント対応

**作成日**: 2025-11-13
**仕様ID**: auth-data-persistence
**Phase**: 19.3.1.1（Phase 19.3.1の追加実装）
**推定工数**: 2-3時間

---

## 📋 概要

Phase 19.3.1で実装したPDFエクスポート機能に、日本語フォントサポートを追加します。jsPDFのデフォルトフォントは日本語をサポートしていないため、NotoSansJPなどのカスタムフォントを統合する必要があります。

### 背景

- **Phase 19.3.1の既知の制約**: jsPDFデフォルトフォントで日本語が文字化け
- **CodeRabbitレビュー指摘**: 日本語テキスト（施設名、スタッフ名、シフトタイプ等）が正しくレンダリングされない
- **影響範囲**: `src/utils/exportPDF.ts` の全関数

---

## 🎯 目的

- PDF出力時に日本語テキストが正しく表示されるようにする
- バンドルサイズへの影響を最小限に抑える
- 既存のexportPDF.ts実装に対する破壊的変更を避ける

---

## 🔍 技術調査

### jsPDFで日本語を表示する方法

#### 方法1: カスタムフォントのBase64埋め込み

**手順**:
1. NotoSansJP-Regular.ttfをダウンロード
2. jsPDFのfontconverterでBase64変換
3. addFont()でフォントを登録
4. setFont()でフォントを適用

**メリット**:
- 確実に動作
- オフラインでも利用可能

**デメリット**:
- バンドルサイズ増加（1-2MB）
- 初期ロード時間への影響

#### 方法2: npm パッケージ利用

**候補パッケージ**:
- `jspdf-font-noto-sans-jp` (存在するか要確認)
- 自作のフォントモジュール

**メリット**:
- 簡単に統合可能
- メンテナンスが楽

**デメリット**:
- 適切なパッケージが存在しない可能性
- バンドルサイズ問題は同じ

#### 方法3: 動的フォントロード

**手順**:
1. フォントファイルをpublic/fonts/に配置
2. PDF生成時に動的にfetch()でロード
3. addFont()で登録

**メリット**:
- バンドルサイズへの影響なし
- 必要時のみロード

**デメリット**:
- ネットワークリクエストが必要
- エラーハンドリングが複雑

#### 方法4: フォントサブセット利用

**手順**:
1. 常用漢字のみのサブセットフォントを作成
2. Base64埋め込み

**メリット**:
- バンドルサイズを大幅削減（200-300KB程度）
- オフライン利用可能

**デメリット**:
- サブセット作成の手間
- 一部の漢字が表示されない可能性

---

## 📐 採用する実装方式

### 方式: 動的フォントロード（方法3）

**理由**:
- バンドルサイズへの影響を完全に回避
- PDF生成は頻繁に行われる操作ではないため、ネットワークロードは許容範囲
- 将来的にフォントを切り替える柔軟性を保持

**実装詳細**:

1. **フォント配置**
   - `public/fonts/NotoSansJP-Regular.ttf` に配置
   - Google Fontsから取得

2. **フォントロード関数**
   ```typescript
   async function loadJapaneseFont(): Promise<string> {
     const response = await fetch('/fonts/NotoSansJP-Regular.ttf');
     const fontBlob = await response.blob();
     const fontBase64 = await blobToBase64(fontBlob);
     return fontBase64;
   }
   ```

3. **jsPDF統合**
   ```typescript
   const doc = new jsPDF({ ... });

   // フォントロード
   const fontBase64 = await loadJapaneseFont();
   doc.addFileToVFS('NotoSansJP-Regular.ttf', fontBase64);
   doc.addFont('NotoSansJP-Regular.ttf', 'NotoSansJP', 'normal');
   doc.setFont('NotoSansJP');
   ```

4. **エラーハンドリング**
   - フォントロード失敗時はデフォルトフォントにフォールバック
   - ユーザーへのエラー通知

---

## 📂 実装ファイル

### 修正対象

#### 1. `src/utils/exportPDF.ts`

**変更内容**:

```typescript
// 新規追加: フォントロードヘルパー関数
/**
 * 日本語フォントを動的にロード
 */
async function loadJapaneseFont(): Promise<string | null> {
  try {
    const response = await fetch('/fonts/NotoSansJP-Regular.ttf');
    if (!response.ok) {
      throw new Error(`Failed to fetch font: ${response.status}`);
    }
    const fontBlob = await response.blob();
    return await blobToBase64(fontBlob);
  } catch (error) {
    console.error('Failed to load Japanese font:', error);
    return null;
  }
}

/**
 * BlobをBase64文字列に変換
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      // "data:application/octet-stream;base64," プレフィックスを削除
      const base64String = base64.split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * jsPDFに日本語フォントを適用
 */
async function applyJapaneseFont(doc: jsPDF): Promise<boolean> {
  const fontBase64 = await loadJapaneseFont();

  if (!fontBase64) {
    console.warn('Japanese font not available, using default font');
    return false;
  }

  try {
    doc.addFileToVFS('NotoSansJP-Regular.ttf', fontBase64);
    doc.addFont('NotoSansJP-Regular.ttf', 'NotoSansJP', 'normal');
    doc.setFont('NotoSansJP');
    return true;
  } catch (error) {
    console.error('Failed to apply Japanese font:', error);
    return false;
  }
}

// 既存関数の修正
export async function exportScheduleToPDF(
  schedule: Schedule,
  facilityName: string
): Promise<jsPDF> {
  if (!schedule.staffSchedules || schedule.staffSchedules.length === 0) {
    throw new Error('シフトデータが存在しません');
  }

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  // 日本語フォントを適用
  await applyJapaneseFont(doc);

  // ... 既存の実装（変更なし）

  return doc;
}

export async function exportStaffToPDF(
  staffList: Staff[],
  facilityName: string
): Promise<jsPDF> {
  if (!staffList || staffList.length === 0) {
    throw new Error('スタッフデータが存在しません');
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // 日本語フォントを適用
  await applyJapaneseFont(doc);

  // ... 既存の実装（変更なし）

  return doc;
}
```

**変更サマリー**:
- `loadJapaneseFont()` 追加（動的フォントロード）
- `blobToBase64()` 追加（Blob→Base64変換）
- `applyJapaneseFont()` 追加（jsPDFへのフォント適用）
- `exportScheduleToPDF()` を `async` 関数に変更
- `exportStaffToPDF()` を `async` 関数に変更
- 各関数の先頭で `await applyJapaneseFont(doc)` を呼び出し

#### 2. `src/components/ExportMenu.tsx`

**変更内容**:

```typescript
// exportPDF関数はすでにasyncなので、await呼び出しに変更
async function exportPDF(
  type: 'schedule' | 'staff' | 'leaveRequests',
  data: Schedule | Staff[] | LeaveRequestDocument[],
  facilityName: string
): Promise<string> {
  let filename: string;

  if (type === 'schedule') {
    const pdf = await exportScheduleToPDF(data as Schedule, facilityName); // await追加
    filename = generateFilename('シフト表', facilityName, 'pdf');
    downloadPDF(pdf, filename);
  } else if (type === 'staff') {
    const pdf = await exportStaffToPDF(data as Staff[], facilityName); // await追加
    filename = generateFilename('スタッフ一覧', facilityName, 'pdf');
    downloadPDF(pdf, filename);
  } else {
    throw new Error('休暇申請のPDFエクスポートは未対応です');
  }

  return filename;
}
```

**変更サマリー**:
- `exportScheduleToPDF()` と `exportStaffToPDF()` の呼び出しに `await` を追加

#### 3. `public/fonts/NotoSansJP-Regular.ttf`

**新規追加**:
- Google Fonts から NotoSansJP-Regular.ttf をダウンロード
- `public/fonts/` ディレクトリに配置

**ダウンロード元**:
- https://fonts.google.com/noto/specimen/Noto+Sans+JP
- Regular (400) weight を使用

---

## 🧪 テスト計画

### 1. ビルドテスト

```bash
npm run build
```

**期待結果**: エラーなしでビルド成功

### 2. 型チェック

TypeScript strict modeで型エラーがないことを確認

### 3. 手動テスト（ブラウザ）

**テストケース1: シフト表PDF生成**
1. ExportMenuコンポーネントをテストページに統合
2. 「PDF形式でエクスポート」を選択
3. 日本語テキスト（施設名、スタッフ名、シフトタイプ）が正しく表示されることを確認

**テストケース2: スタッフ一覧PDF生成**
1. 「PDF形式でエクスポート」を選択
2. 日本語テキスト（名前、役職、資格）が正しく表示されることを確認

**テストケース3: フォントロード失敗時のフォールバック**
1. ネットワークをオフラインに
2. PDF生成を試行
3. エラーメッセージが表示され、デフォルトフォントで生成されることを確認

### 4. E2Eテスト（将来実装）

```typescript
// tests/e2e/export.spec.ts
test('PDF export with Japanese font', async ({ page }) => {
  await page.goto('/test-export');

  // PDF生成ボタンクリック
  await page.click('[data-testid="export-pdf-button"]');

  // ダウンロード完了待ち
  const download = await page.waitForEvent('download');

  // PDFファイルを検証（日本語文字化けチェック）
  // ... PDF解析ロジック
});
```

---

## 📊 影響分析

### バンドルサイズ

- **変更前**: exportPDF.ts = 約10KB
- **変更後**: exportPDF.ts = 約12KB（+2KB、ヘルパー関数追加のみ）
- **フォントファイル**: 約1.5MB（publicフォルダ、バンドル外）

**結論**: バンドルサイズへの影響はほぼゼロ

### パフォーマンス

- **フォントロード時間**: 約100-200ms（初回のみ）
- **PDF生成時間**: +50ms程度（フォント適用処理）
- **キャッシュ**: ブラウザキャッシュにより、2回目以降は高速

**結論**: 許容範囲内のパフォーマンス低下

### 互換性

- **既存コードへの影響**: 最小限（関数シグネチャを `async` に変更のみ）
- **破壊的変更**: なし（呼び出し側で `await` 追加が必要）

---

## ⚠️ リスクと対策

### リスク1: フォントファイルのロード失敗

**影響**: 日本語が文字化けしたPDFが生成される

**対策**:
- エラーハンドリングでデフォルトフォントにフォールバック
- ユーザーへのエラー通知（Toast）
- フォントロード失敗をエラーログに記録

### リスク2: フォントファイルサイズによるネットワーク負荷

**影響**: 初回PDF生成時に遅延が発生

**対策**:
- ローディング表示（「フォント読み込み中...」）
- ブラウザキャッシュ活用
- 将来的にはフォントサブセットを検討

### リスク3: 異なるブラウザでの互換性問題

**影響**: 一部ブラウザでフォントが正しく表示されない可能性

**対策**:
- 主要ブラウザ（Chrome, Firefox, Safari, Edge）でテスト
- フォールバック機構の実装

---

## 📝 実装チェックリスト

### Phase 1: 準備

- [ ] NotoSansJP-Regular.ttfをGoogle Fontsからダウンロード
- [ ] `public/fonts/`ディレクトリ作成
- [ ] フォントファイルを配置
- [ ] Gitにコミット（バイナリファイル）

### Phase 2: exportPDF.ts修正

- [ ] `loadJapaneseFont()` 関数追加
- [ ] `blobToBase64()` 関数追加
- [ ] `applyJapaneseFont()` 関数追加
- [ ] `exportScheduleToPDF()` を async 関数に変更
- [ ] `exportStaffToPDF()` を async 関数に変更
- [ ] エラーハンドリング実装

### Phase 3: ExportMenu.tsx修正

- [ ] `exportPDF()` 内で `await` 追加
- [ ] ローディング表示改善（オプション）

### Phase 4: テスト

- [ ] ビルドテスト
- [ ] 型チェック
- [ ] 手動テスト（シフト表PDF）
- [ ] 手動テスト（スタッフ一覧PDF）
- [ ] フォントロード失敗時のテスト

### Phase 5: レビューとデプロイ

- [ ] CodeRabbitレビュー実行
- [ ] レビュー指摘事項対応
- [ ] コミット・プッシュ
- [ ] GitHub Actions CI/CD確認

### Phase 6: ドキュメント

- [ ] 完了レポート作成
- [ ] 使用方法ドキュメント更新（オプション）

---

## 🔗 関連ドキュメント

- [Phase 19.3.1 実装計画書](./phase19.3.1-implementation-plan-2025-11-13.md)
- [Phase 19.3.1 完了レポート](./phase19.3.1-completion-report-2025-11-13.md)
- [jsPDF Documentation](https://artskydj.github.io/jsPDF/docs/)
- [Google Fonts - Noto Sans JP](https://fonts.google.com/noto/specimen/Noto+Sans+JP)

---

## 📌 まとめ

Phase 19.3.1.1では、動的フォントロードによる日本語PDFサポートを実装します。バンドルサイズへの影響を最小限に抑えつつ、既存コードへの破壊的変更を避けた実装方式を採用します。

**推定工数**: 2-3時間（フォント準備、実装、テスト含む）

**次のステップ**: Phase 19.3.2（バックアップ・リストア機能）

---

**作成者**: Claude Code
**レビュー**: 未実施
**承認**: 未実施
