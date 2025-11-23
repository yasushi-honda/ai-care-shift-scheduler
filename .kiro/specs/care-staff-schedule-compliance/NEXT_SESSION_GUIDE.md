# 次のAIセッションへの引き継ぎガイド

**作成日**: 2025-11-23
**対象**: Phase 25.2 - 予実2段書きUI実装
**前回完了**: Phase 25.1（100%）

---

## 🎯 すぐに実装を開始するために

### 1分でキャッチアップ（必読）

**Phase 25.1で完了したこと**:
- ✅ WorkLogs機能を完全削除
- ✅ GeneratedShiftインターフェースを予実管理対応に拡張
- ✅ 後方互換性の実装（既存データ自動変換）
- ✅ TypeScriptエラー0件、ユニットテスト123/123成功
- ✅ Gitコミット・プッシュ完了（d5efc0d）

**Phase 25.2でやること**:
- TimePicker.tsxコンポーネント実装
- ShiftEditConfirmModal.tsxコンポーネント実装
- ShiftTable.tsxの2段書き表示改修
- scheduleService.tsのupdateShift関数拡張
- E2Eテスト実装

**推定工数**: 8-12時間

---

## 📚 必須ドキュメント（実装前に確認）

### 最優先（15分）

1. **Phase 25.1完了記録**（5分）:
   ```
   .kiro/specs/care-staff-schedule-compliance/phase25-1-completion-2025-11-23.md
   ```
   - 何が変更されたか、なぜ変更されたかを理解

2. **実装タスク一覧 - Phase 25.2**（10分）:
   ```
   .kiro/specs/care-staff-schedule-compliance/tasks.md#phase-252
   ```
   - Task 25.2.1 ~ 25.2.6を確認

### 参考資料（必要に応じて）

3. **技術設計書**（10分）:
   ```
   .kiro/specs/care-staff-schedule-compliance/design.md
   ```
   - Section 3.2: 予実2段書きUI設計
   - Section 4.1: ShiftEditConfirmModal設計

4. **メモリファイル**（5分）:
   ```
   phase25_progress_2025-11-23
   phase25_design_decisions_2025-11-23_updated
   ```

---

## 🚀 Phase 25.2 実装開始手順

### Step 1: 環境確認（5分）

```bash
# TypeScriptエラー確認
npx tsc --noEmit

# ユニットテスト実行
npm test

# 開発サーバー起動（別ターミナル）
npm run dev
```

**期待結果**:
- TypeScriptエラー: 0件
- ユニットテスト: 123/123成功
- 開発サーバー: http://localhost:5173で起動

### Step 2: Task 25.2.1開始（1時間）

**TimePicker.tsx実装**:

1. ファイル作成:
   ```
   src/components/TimePicker.tsx
   ```

2. 実装内容（design.md参照）:
   ```typescript
   interface TimePickerProps {
     value: string;          // "08:30"
     onChange: (value: string) => void;
     label?: string;
     required?: boolean;
     disabled?: boolean;
   }

   export function TimePicker({ value, onChange, label, required, disabled }: TimePickerProps) {
     return (
       <div className="flex flex-col gap-1">
         {label && (
           <label className="text-sm font-medium text-gray-700">
             {label}
             {required && <span className="text-red-500 ml-1">*</span>}
           </label>
         )}
         <input
           type="time"
           value={value || ''}
           onChange={(e) => onChange(e.target.value)}
           required={required}
           disabled={disabled}
           className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
         />
       </div>
     );
   }
   ```

3. 完了条件確認:
   - [ ] TimePickerコンポーネントが実装される
   - [ ] HH:mm形式で入力可能
   - [ ] TypeScriptエラーがゼロ
   - [ ] Storybookまたは手動テストで動作確認

### Step 3: Task 25.2.2 ~ 25.2.6

順番に`tasks.md`のPhase 25.2セクションを参照して実装してください。

---

## ⚠️ 重要な注意事項

### CI/CDワークフロー（必須）

Phase 25.2実装時も、既存のCI/CDワークフローに従ってください:

1. コード変更
2. `git add .` → `git commit -m "..."`
3. **CodeRabbit CLIローカルレビュー実施・完了待ち** ← 必須！
   ```bash
   coderabbit review --plain --base-commit HEAD~1 --config CLAUDE.md
   ```
4. レビュー結果に基づいて修正（問題がある場合）
5. レビューOK後に `git push`
6. GitHub Actions CI/CD実行を監視
   ```bash
   gh run list --limit 1
   ```

### ドキュメントドリブンの原則

- すべての設計判断をドキュメントに記録
- 不明な点があれば、まずドキュメントを確認
- ドキュメントで不明な場合は、ドキュメントを更新

### GitHub Flow

- mainブランチから feature ブランチを作成（推奨）
- feature ブランチで開発
- PR作成 → レビュー → mainにマージ

---

## 📊 Phase 25.2の完了条件

すべてのタスク（25.2.1 ~ 25.2.6）が完了したら、以下を確認してください:

- [ ] TypeScriptエラーがゼロ
- [ ] ユニットテストが100%成功
- [ ] E2Eテストが100%成功（新規3テスト + 既存6テスト = 計9テスト）
- [ ] 予実2段書き表示が正常に動作する
- [ ] シングルクリック編集が正常に動作する
- [ ] 差異ハイライトが正常に動作する
- [ ] コードレビュー完了（CodeRabbit）

---

## 🔍 Phase 25.1の主要な変更点（振り返り）

### 新しいGeneratedShiftインターフェース

```typescript
export interface GeneratedShift {
  date: string; // YYYY-MM-DD

  // 予定シフト（必須）
  plannedShiftType: string;
  plannedStartTime?: string; // HH:mm
  plannedEndTime?: string;

  // 実績シフト（任意）
  actualShiftType?: string;
  actualStartTime?: string;
  actualEndTime?: string;
  breakMinutes?: number;

  // 備考
  notes?: string;

  // 後方互換性
  shiftType?: string; // @deprecated
}
```

### 後方互換性の実装

- `migrateGeneratedShift`関数（scheduleService.ts:27-46）
- すべてのコードで`plannedShiftType || shiftType`のフォールバック

### 削除されたもの

- WorkLogModal.tsx
- workLogs state（App.tsx）
- workLogs関連のUI・ツールチップ（ShiftTable.tsx）
- WorkLogDetails・WorkLogsインターフェース（types.ts）

---

## 📦 参考資料

### ドキュメント

- [要件定義書](./requirements.md)
- [技術設計書](./design.md)
- [実装タスク一覧](./tasks.md)
- [Phase 25.1完了記録](./phase25-1-completion-2025-11-23.md)

### メモリファイル

```bash
# メモリ一覧表示
mcp__serena__list_memories

# メモリ読み込み
mcp__serena__read_memory phase25_progress_2025-11-23
mcp__serena__read_memory phase25_design_decisions_2025-11-23_updated
```

### Mermaid図

- データモデル図: `./diagrams/data-model-diagram.md`
- UIフロー図: `./diagrams/ui-flow-diagram.md`
- 実装スケジュール: `./diagrams/phase25-gantt.md`

---

## 🎊 準備完了！

**Phase 25.2の実装を開始してください。**

実装中に不明な点があれば、以下を確認:
1. `tasks.md`の該当タスク
2. `design.md`の該当セクション
3. メモリファイル

**幸運を祈ります！** 🚀
