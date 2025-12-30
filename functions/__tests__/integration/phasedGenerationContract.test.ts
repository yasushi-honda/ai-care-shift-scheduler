/**
 * Phased Generation 契約テスト
 *
 * phased-generation.ts がバリデーションモジュールを正しくインポート・使用していることを検証
 * これは「真の統合テスト」ではなく「契約テスト」として機能する
 *
 * 目的:
 * - バリデーション関数の削除を検出
 * - importの欠落を検出
 * - 型の不整合を検出
 */

import * as fs from 'fs';
import * as path from 'path';

describe('Phased Generation Contract', () => {
  const phasedGenerationPath = path.join(__dirname, '../../src/phased-generation.ts');
  let sourceCode: string;

  beforeAll(() => {
    sourceCode = fs.readFileSync(phasedGenerationPath, 'utf-8');
  });

  describe('バリデーションモジュールの統合', () => {
    it('validateSkeletonOutput がインポートされている', () => {
      expect(sourceCode).toMatch(/import\s*\{[^}]*validateSkeletonOutput[^}]*\}\s*from\s*['"]\.\/phase-validation['"]/);
    });

    it('validatePhase2Input がインポートされている', () => {
      expect(sourceCode).toMatch(/import\s*\{[^}]*validatePhase2Input[^}]*\}\s*from\s*['"]\.\/phase-validation['"]/);
    });

    it('logValidationResult がインポートされている', () => {
      expect(sourceCode).toMatch(/import\s*\{[^}]*logValidationResult[^}]*\}\s*from\s*['"]\.\/phase-validation['"]/);
    });

    it('autoFixSkeleton がインポートされている', () => {
      expect(sourceCode).toMatch(/import\s*\{[^}]*autoFixSkeleton[^}]*\}\s*from\s*['"]\.\/phase-validation['"]/);
    });

    it('Phase 1でvalidateSkeletonOutputが呼び出されている', () => {
      // BUG-023防止のためのバリデーション呼び出し
      expect(sourceCode).toMatch(/validateSkeletonOutput\s*\(\s*skeleton\s*,\s*staffList\s*,\s*hasNightShift/);
    });

    it('Phase 2でvalidatePhase2Inputが呼び出されている', () => {
      expect(sourceCode).toMatch(/validatePhase2Input\s*\(/);
    });

    it('自動修正ロジックが含まれている', () => {
      expect(sourceCode).toMatch(/autoFixSkeleton\s*\(/);
    });
  });

  describe('AIレスポンス監視モジュールの統合', () => {
    it('checkResponseHealth がインポートされている', () => {
      expect(sourceCode).toMatch(/import\s*\{[^}]*checkResponseHealth[^}]*\}\s*from\s*['"]\.\/ai-response-monitor['"]/);
    });

    it('checkResponseHealth が使用されている', () => {
      expect(sourceCode).toMatch(/checkResponseHealth\s*\(/);
    });
  });

  describe('daysInMonth パラメータの使用', () => {
    it('validateSkeletonOutput にdaysInMonth が渡されている', () => {
      // 月末境界バグ修正の確認
      expect(sourceCode).toMatch(/validateSkeletonOutput\s*\([^)]*daysInMonth/);
    });
  });

  describe('エラーハンドリング', () => {
    it('バリデーション失敗時の警告ログがある', () => {
      expect(sourceCode).toMatch(/if\s*\(\s*!validationResult\.isValid/);
    });

    it('Phase 2入力バリデーション失敗時の警告がある', () => {
      expect(sourceCode).toMatch(/if\s*\(\s*!phase2Validation\.isValid/);
    });
  });
});

describe('モジュールエクスポートの互換性', () => {
  it('phase-validation.ts が正しくエクスポートしている', () => {
    // 動的インポートでエクスポートを検証
    const phaseValidation = require('../../src/phase-validation');

    expect(typeof phaseValidation.validateSkeletonOutput).toBe('function');
    expect(typeof phaseValidation.validatePhase2Input).toBe('function');
    expect(typeof phaseValidation.logValidationResult).toBe('function');
    expect(typeof phaseValidation.autoFixSkeleton).toBe('function');
  });

  it('ai-response-monitor.ts が正しくエクスポートしている', () => {
    const aiResponseMonitor = require('../../src/ai-response-monitor');

    expect(typeof aiResponseMonitor.checkResponseHealth).toBe('function');
    expect(typeof aiResponseMonitor.logDetailedResponseMetrics).toBe('function');
  });

  it('validateSkeletonOutput のシグネチャが正しい', () => {
    const { validateSkeletonOutput } = require('../../src/phase-validation');

    // 4引数（skeleton, staffList, hasNightShift, daysInMonth）を受け付ける
    expect(validateSkeletonOutput.length).toBeLessThanOrEqual(4);

    // 実際に呼び出して型エラーがないことを確認
    const result = validateSkeletonOutput(
      { staffSchedules: [] },
      [],
      true,
      30
    );

    expect(result).toHaveProperty('isValid');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('warnings');
  });

  it('checkResponseHealth のシグネチャが正しい', () => {
    const { checkResponseHealth } = require('../../src/ai-response-monitor');

    const result = checkResponseHealth(
      { text: 'test', candidates: [{ finishReason: 'STOP' }] },
      'TestOperation'
    );

    expect(result).toHaveProperty('isHealthy');
    expect(result).toHaveProperty('issues');
    expect(result).toHaveProperty('metrics');
  });
});
