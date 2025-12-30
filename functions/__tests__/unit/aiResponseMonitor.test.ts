/**
 * AIレスポンス監視 ユニットテスト
 *
 * BUG-022（thinkingトークン過剰消費）パターン検出テスト
 * @see functions/src/ai-response-monitor.ts
 */

import { checkResponseHealth, UsageMetrics } from '../../src/ai-response-monitor';

describe('AI Response Monitor', () => {
  // テストヘルパー
  // 100文字以上のデフォルトテキスト（短いレスポンス警告を回避）
  const DEFAULT_VALID_TEXT = 'Valid JSON response with sufficient length to avoid short response warning. ' +
    'This text should be at least 100 characters long.';

  const createResponse = (overrides?: {
    text?: string;
    finishReason?: string;
    usageMetadata?: Partial<UsageMetrics>;
  }) => ({
    text: overrides?.text ?? DEFAULT_VALID_TEXT,
    candidates: [{ finishReason: overrides?.finishReason ?? 'STOP' }],
    usageMetadata: {
      promptTokenCount: 1000,
      thoughtsTokenCount: 5000,
      candidatesTokenCount: 10000,
      totalTokenCount: 16000,
      ...overrides?.usageMetadata,
    },
  });

  describe('checkResponseHealth', () => {
    describe('正常ケース', () => {
      it('正常なレスポンスの場合、isHealthy=true', () => {
        const response = createResponse();

        const result = checkResponseHealth(response, 'TestOperation');

        expect(result.isHealthy).toBe(true);
        expect(result.issues).toHaveLength(0);
      });

      it('メトリクスを正しく計算する', () => {
        const response = createResponse({
          usageMetadata: {
            thoughtsTokenCount: 4000,
            candidatesTokenCount: 8000,
            totalTokenCount: 16000,
          },
        });

        const result = checkResponseHealth(response, 'TestOperation');

        expect(result.metrics.thinkingRatio).toBeCloseTo(0.25, 2); // 4000/16000
        expect(result.metrics.outputRatio).toBeCloseTo(0.5, 2); // 8000/16000
        expect(result.metrics.finishReason).toBe('STOP');
        expect(result.metrics.responseLength).toBeGreaterThan(0);
      });
    });

    describe('BUG-022パターン: 思考トークン過剰消費', () => {
      it('思考トークンが90%以上の場合、警告を出す', () => {
        const response = createResponse({
          usageMetadata: {
            thoughtsTokenCount: 65533, // 実際のBUG-022ケース
            candidatesTokenCount: 2,
            totalTokenCount: 65536,
          },
        });

        const result = checkResponseHealth(response, 'TestOperation');

        expect(result.isHealthy).toBe(false);
        expect(result.issues.some(i => i.includes('思考トークン過剰消費'))).toBe(true);
        expect(result.issues.some(i => i.includes('BUG-022'))).toBe(true);
      });

      it('思考トークンが89%の場合、警告しない', () => {
        const response = createResponse({
          usageMetadata: {
            thoughtsTokenCount: 8900,
            candidatesTokenCount: 1100,
            totalTokenCount: 10000,
          },
        });

        const result = checkResponseHealth(response, 'TestOperation');

        expect(result.issues.some(i => i.includes('思考トークン過剰消費'))).toBe(false);
      });

      it('境界値: 思考トークンが正確に90%の場合、警告しない', () => {
        const response = createResponse({
          usageMetadata: {
            thoughtsTokenCount: 9000,
            candidatesTokenCount: 1000,
            totalTokenCount: 10000,
          },
        });

        const result = checkResponseHealth(response, 'TestOperation');

        // > 0.90 なので 0.90 は含まない
        expect(result.issues.some(i => i.includes('思考トークン過剰消費'))).toBe(false);
      });

      it('境界値: 思考トークンが90.1%の場合、警告する', () => {
        const response = createResponse({
          usageMetadata: {
            thoughtsTokenCount: 9010,
            candidatesTokenCount: 990,
            totalTokenCount: 10000,
          },
        });

        const result = checkResponseHealth(response, 'TestOperation');

        expect(result.issues.some(i => i.includes('思考トークン過剰消費'))).toBe(true);
      });
    });

    describe('出力トークン比率チェック', () => {
      it('出力トークンが5%未満の場合、警告を出す', () => {
        const response = createResponse({
          text: 'Some output', // responseLength > 0
          usageMetadata: {
            thoughtsTokenCount: 8000,
            candidatesTokenCount: 400, // 4%
            totalTokenCount: 10000,
          },
        });

        const result = checkResponseHealth(response, 'TestOperation');

        expect(result.issues.some(i => i.includes('出力トークン比率が低い'))).toBe(true);
      });

      it('出力トークンが5%以上の場合、警告しない', () => {
        const response = createResponse({
          usageMetadata: {
            thoughtsTokenCount: 7500,
            candidatesTokenCount: 500, // 5%
            totalTokenCount: 10000,
          },
        });

        const result = checkResponseHealth(response, 'TestOperation');

        expect(result.issues.some(i => i.includes('出力トークン比率が低い'))).toBe(false);
      });

      it('レスポンスが空の場合、出力比率警告をスキップ', () => {
        const response = createResponse({
          text: '', // 空
          usageMetadata: {
            candidatesTokenCount: 100, // 1%
            totalTokenCount: 10000,
          },
        });

        const result = checkResponseHealth(response, 'TestOperation');

        // 空レスポンスの警告は出るが、出力比率の警告は出ない
        expect(result.issues.some(i => i.includes('出力トークン比率が低い'))).toBe(false);
        expect(result.issues.some(i => i.includes('レスポンス本文が空'))).toBe(true);
      });
    });

    describe('finishReasonチェック', () => {
      it('STOP以外のfinishReasonで警告', () => {
        const testCases = [
          { finishReason: 'MAX_TOKENS', expected: 'MAX_TOKENS' },
          { finishReason: 'SAFETY', expected: 'SAFETY' },
          { finishReason: 'RECITATION', expected: 'RECITATION' },
          { finishReason: 'OTHER', expected: 'OTHER' },
        ];

        for (const { finishReason, expected } of testCases) {
          const response = createResponse({ finishReason });

          const result = checkResponseHealth(response, 'TestOperation');

          expect(result.isHealthy).toBe(false);
          expect(result.issues.some(i => i.includes(expected))).toBe(true);
        }
      });

      it('STOPの場合、finishReason警告なし', () => {
        const response = createResponse({ finishReason: 'STOP' });

        const result = checkResponseHealth(response, 'TestOperation');

        expect(result.issues.some(i => i.includes('終了理由'))).toBe(false);
      });

      it('candidatesが空の場合、UNKNOWN扱い', () => {
        const response = {
          text: 'Some text',
          candidates: [],
          usageMetadata: createResponse().usageMetadata,
        };

        const result = checkResponseHealth(response, 'TestOperation');

        expect(result.metrics.finishReason).toBe('UNKNOWN');
      });
    });

    describe('レスポンス本文チェック', () => {
      it('レスポンスが空の場合、エラーを報告', () => {
        const response = createResponse({ text: '' });

        const result = checkResponseHealth(response, 'TestOperation');

        expect(result.isHealthy).toBe(false);
        expect(result.issues.some(i => i.includes('レスポンス本文が空'))).toBe(true);
      });

      it('レスポンスがundefinedの場合、エラーを報告', () => {
        // text: undefined を明示的に設定（createResponseのデフォルト値を回避）
        const response = {
          candidates: [{ finishReason: 'STOP' }],
          usageMetadata: {
            promptTokenCount: 1000,
            thoughtsTokenCount: 5000,
            candidatesTokenCount: 10000,
            totalTokenCount: 16000,
          },
          // text is intentionally omitted (undefined)
        };

        const result = checkResponseHealth(response, 'TestOperation');

        expect(result.issues.some(i => i.includes('レスポンス本文が空'))).toBe(true);
      });

      it('レスポンスが100文字未満の場合、警告を出す', () => {
        const response = createResponse({ text: 'Short response' }); // 14文字

        const result = checkResponseHealth(response, 'TestOperation');

        expect(result.issues.some(i => i.includes('非常に短い'))).toBe(true);
      });

      it('レスポンスが100文字以上の場合、長さ警告なし', () => {
        const response = createResponse({ text: 'A'.repeat(100) });

        const result = checkResponseHealth(response, 'TestOperation');

        expect(result.issues.some(i => i.includes('非常に短い'))).toBe(false);
      });
    });

    describe('usageMetadata欠落時の挙動', () => {
      it('usageMetadataがない場合、比率はnull', () => {
        const response = {
          text: 'Some text ' + 'A'.repeat(100),
          candidates: [{ finishReason: 'STOP' }],
        };

        const result = checkResponseHealth(response, 'TestOperation');

        expect(result.metrics.thinkingRatio).toBeNull();
        expect(result.metrics.outputRatio).toBeNull();
      });

      it('totalTokenCountが0の場合、比率はnull', () => {
        const response = createResponse({
          usageMetadata: {
            totalTokenCount: 0,
          },
        });

        const result = checkResponseHealth(response, 'TestOperation');

        expect(result.metrics.thinkingRatio).toBeNull();
      });

      it('thoughtsTokenCountが未定義の場合、thinking比率はnull', () => {
        const response = {
          text: 'Some text ' + 'A'.repeat(100),
          candidates: [{ finishReason: 'STOP' }],
          usageMetadata: {
            totalTokenCount: 10000,
            candidatesTokenCount: 5000,
            // thoughtsTokenCount 未定義
          },
        };

        const result = checkResponseHealth(response, 'TestOperation');

        expect(result.metrics.thinkingRatio).toBeNull();
        expect(result.metrics.outputRatio).toBeCloseTo(0.5, 2);
      });
    });

    describe('複合問題検出', () => {
      it('複数の問題を同時に検出できる', () => {
        const response = {
          text: '', // 空レスポンス
          candidates: [{ finishReason: 'MAX_TOKENS' }], // 非STOP
          usageMetadata: {
            thoughtsTokenCount: 9500, // 95%
            candidatesTokenCount: 500,
            totalTokenCount: 10000,
          },
        };

        const result = checkResponseHealth(response, 'TestOperation');

        expect(result.isHealthy).toBe(false);
        expect(result.issues.length).toBeGreaterThanOrEqual(3);
        expect(result.issues.some(i => i.includes('思考トークン過剰消費'))).toBe(true);
        expect(result.issues.some(i => i.includes('MAX_TOKENS'))).toBe(true);
        expect(result.issues.some(i => i.includes('レスポンス本文が空'))).toBe(true);
      });

      it('BUG-022の実際のレスポンスパターンを検出', () => {
        // 実際のBUG-022発生時のデータ
        const bug022Response = {
          text: '', // 空！
          candidates: [{ finishReason: 'STOP' }], // 一応STOP
          usageMetadata: {
            promptTokenCount: 12000,
            thoughtsTokenCount: 65533,
            candidatesTokenCount: 2,
            totalTokenCount: 65536,
          },
        };

        const result = checkResponseHealth(bug022Response, 'BUG-022 Test');

        expect(result.isHealthy).toBe(false);
        expect(result.issues.some(i => i.includes('BUG-022'))).toBe(true);
        expect(result.issues.some(i => i.includes('レスポンス本文が空'))).toBe(true);
      });
    });

    describe('operationName', () => {
      it('operationNameがログに含まれることを確認（コンソール出力）', () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        const response = createResponse();

        checkResponseHealth(response, 'CustomOperationName');

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('CustomOperationName')
        );
        consoleSpy.mockRestore();
      });

      it('問題がある場合、warnログに含まれる', () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
        const response = createResponse({ text: '' });

        checkResponseHealth(response, 'WarningOperation');

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('WarningOperation')
        );
        consoleSpy.mockRestore();
      });
    });
  });
});
