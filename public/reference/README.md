# 参考資料ダウンロード手順

**作成日**: 2025-11-20
**対象**: Phase 25 介護報酬対応 - 予実管理機能実装

---

## 必要な参考資料

Phase 25の実装を開始する前に、以下の参考資料をダウンロードしてください。

---

## 1. 標準様式第1号のダウンロード

### ダウンロード方法

1. **URLにアクセス**:
   ```
   https://www.mhlw.go.jp/content/001269336.xlsx
   ```

2. **ファイル保存**:
   - ブラウザで上記URLを開くと、自動的にExcelファイルのダウンロードが開始されます
   - ダウンロードしたファイルを以下のパスに配置してください:
     ```
     /Users/yyyhhh/ai-care-shift-scheduler/public/reference/standard-form-1.xlsx
     ```

3. **確認**:
   - Excelファイルが正常に開けることを確認してください
   - ファイルサイズ: 約10-20KB（目安）

### 代替手段（直接ダウンロードできない場合）

1. **厚生労働省サイトから検索**:
   - https://www.mhlw.go.jp/ にアクセス
   - 検索窓で「標準様式第1号 勤務形態一覧表」を検索
   - 最新版をダウンロード

2. **高知県庁サイトから取得**:
   - https://www.pref.kochi.lg.jp/doc/2017012300118/ にアクセス
   - 「6. 当該事業申請に係る従業者の勤務の体制及び勤務形態一覧表」からダウンロード

---

## 2. ファイル配置の確認

以下のコマンドで、ファイルが正しく配置されているか確認してください:

```bash
ls -lh /Users/yyyhhh/ai-care-shift-scheduler/public/reference/
```

**期待される出力**:
```
total 48
-rw-r--r--  1 user  staff   XXK  11 20 XX:XX standard-form-1.xlsx
-rw-r--r--  1 user  staff   XXK  11 20 XX:XX reference-links.md
-rw-r--r--  1 user  staff   XXK  11 20 XX:XX README.md
```

---

## 3. Phase 25.3実装時の注意

Phase 25.3「標準様式第1号Excel出力」では、このファイルを参照して以下を確認します:

- セル結合パターン
- 罫線スタイル
- フォント設定（サイズ、太字）
- ヘッダー項目
- データ行フォーマット

**実装タスク**: [Phase 25.3 Task 25.3.2](../../.kiro/specs/care-staff-schedule-compliance/tasks.md#task-2532-標準様式の分析仕様書作成1-2時間)

---

## トラブルシューティング

### Q: ファイルがダウンロードできない

**A**: 以下を確認してください:
1. インターネット接続が正常か
2. ファイアウォール設定でmhlw.go.jpがブロックされていないか
3. 別のブラウザで試す（Chrome、Firefox、Safariなど）

### Q: Excelファイルが開けない

**A**: 以下を確認してください:
1. Microsoft Excelがインストールされているか
2. ファイルが破損していないか（再ダウンロード）
3. LibreOffice CalcやGoogle Sheetsで開いてみる

---

## 関連ドキュメント

- [参考資料リンク集](./reference-links.md)
- [介護報酬算定ガイドライン](../../.kiro/steering/care-compliance.md)
- [Phase 25実装タスク一覧](../../.kiro/specs/care-staff-schedule-compliance/tasks.md)
