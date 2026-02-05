/**
 * parseGeminiJsonResponse ユニットテスト
 *
 * phased-generation.tsの最重要関数。
 * Gemini APIからのレスポンスを安全にJSONパースする。
 *
 * テスト対象:
 * - 正常なJSON
 * - Markdownコードブロック内のJSON
 * - テキスト混在のJSON
 * - トレーリングカンマ
 * - JSONコメント
 * - シングルクォート
 * - 不正なJSON（エラーケース）
 */

import { parseGeminiJsonResponse } from '../../src/phased-generation';

describe('parseGeminiJsonResponse', () => {
  describe('正常なJSON', () => {
    it('シンプルなオブジェクトをパースできる', () => {
      const input = '{"name": "test", "value": 123}';
      const result = parseGeminiJsonResponse(input);
      expect(result).toEqual({ name: 'test', value: 123 });
    });

    it('シンプルな配列をパースできる', () => {
      const input = '[1, 2, 3]';
      const result = parseGeminiJsonResponse(input);
      expect(result).toEqual([1, 2, 3]);
    });

    it('ネストしたオブジェクトをパースできる', () => {
      const input = '{"outer": {"inner": "value"}}';
      const result = parseGeminiJsonResponse(input);
      expect(result).toEqual({ outer: { inner: 'value' } });
    });

    it('空白を含むJSONをパースできる', () => {
      const input = `
        {
          "name": "test"
        }
      `;
      const result = parseGeminiJsonResponse(input);
      expect(result).toEqual({ name: 'test' });
    });
  });

  describe('Markdownコードブロック内のJSON', () => {
    it('```json ... ``` 形式をパースできる', () => {
      const input = '```json\n{"name": "test"}\n```';
      const result = parseGeminiJsonResponse(input);
      expect(result).toEqual({ name: 'test' });
    });

    it('``` ... ``` 形式（言語指定なし）をパースできる', () => {
      const input = '```\n{"name": "test"}\n```';
      const result = parseGeminiJsonResponse(input);
      expect(result).toEqual({ name: 'test' });
    });

    it('コードブロック前後にテキストがあってもパースできる', () => {
      const input = 'Here is the JSON:\n```json\n{"name": "test"}\n```\nEnd of response.';
      const result = parseGeminiJsonResponse(input);
      expect(result).toEqual({ name: 'test' });
    });
  });

  describe('テキスト混在のJSON（thinkingモード対応）', () => {
    it('テキスト後のJSONオブジェクトを抽出できる', () => {
      const input = 'Let me think about this...\n\n{"result": "success"}';
      const result = parseGeminiJsonResponse(input);
      expect(result).toEqual({ result: 'success' });
    });

    it('テキスト後のJSON配列を抽出できる（オブジェクトを含まない場合）', () => {
      // 注: 現在の実装ではオブジェクトマッチが優先されるため、
      // 配列内にオブジェクトがある場合は期待通り動作しない
      const input = 'Here are the numbers:\n[1, 2, 3]';
      const result = parseGeminiJsonResponse(input);
      expect(result).toEqual([1, 2, 3]);
    });

    it('Markdownコードブロック内のJSON配列を抽出できる', () => {
      // コードブロック形式なら配列もオブジェクトも正しく抽出される
      const input = 'Here are the items:\n```json\n[{"id": 1}, {"id": 2}]\n```';
      const result = parseGeminiJsonResponse(input);
      expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it('複雑なthinkingテキスト後のJSONを抽出できる', () => {
      const input = `
        First, I need to consider the constraints.
        The staff availability is limited.

        Based on my analysis:
        {"schedule": [{"date": "2025-01-01", "staff": ["A", "B"]}]}
      `;
      const result = parseGeminiJsonResponse(input);
      expect(result).toEqual({
        schedule: [{ date: '2025-01-01', staff: ['A', 'B'] }],
      });
    });
  });

  describe('トレーリングカンマの処理', () => {
    it('オブジェクトのトレーリングカンマを除去してパースできる', () => {
      const input = '{"name": "test", "value": 123,}';
      const result = parseGeminiJsonResponse(input);
      expect(result).toEqual({ name: 'test', value: 123 });
    });

    it('配列のトレーリングカンマを除去してパースできる', () => {
      const input = '[1, 2, 3,]';
      const result = parseGeminiJsonResponse(input);
      expect(result).toEqual([1, 2, 3]);
    });

    it('ネストしたトレーリングカンマを除去してパースできる', () => {
      const input = '{"items": [1, 2,], "name": "test",}';
      const result = parseGeminiJsonResponse(input);
      expect(result).toEqual({ items: [1, 2], name: 'test' });
    });
  });

  describe('JSONコメントの処理', () => {
    it('単一行コメント（//）を除去してパースできる', () => {
      const input = `{
        "name": "test" // This is a comment
      }`;
      const result = parseGeminiJsonResponse(input);
      expect(result).toEqual({ name: 'test' });
    });

    it('複数行コメント（/* */）を除去してパースできる', () => {
      const input = `{
        /* This is a
           multi-line comment */
        "name": "test"
      }`;
      const result = parseGeminiJsonResponse(input);
      expect(result).toEqual({ name: 'test' });
    });
  });

  describe('シングルクォートの処理', () => {
    it('プロパティ名のシングルクォートをダブルクォートに変換してパースできる', () => {
      const input = "{'name': \"test\"}";
      const result = parseGeminiJsonResponse(input);
      expect(result).toEqual({ name: 'test' });
    });
  });

  describe('エラーケース', () => {
    it('完全に不正なJSONはエラーをスローする', () => {
      const input = 'This is not JSON at all';
      expect(() => parseGeminiJsonResponse(input)).toThrow('Failed to parse Gemini JSON response');
    });

    it('空文字列はエラーをスローする', () => {
      const input = '';
      expect(() => parseGeminiJsonResponse(input)).toThrow();
    });

    it('エラーにparseError情報が含まれる', () => {
      const input = 'invalid json';
      try {
        parseGeminiJsonResponse(input);
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.parseError).toBeDefined();
        expect(error.parseError.responseLength).toBe(input.length);
      }
    });
  });

  describe('実際のGeminiレスポンス形式', () => {
    it('シフトスケルトンレスポンスをパースできる', () => {
      const input = `
        Based on the constraints provided, here is the skeleton:
        \`\`\`json
        {
          "skeleton": {
            "2025-01-01": ["staff1", "staff2"],
            "2025-01-02": ["staff2", "staff3"]
          }
        }
        \`\`\`
      `;
      const result = parseGeminiJsonResponse(input);
      expect(result.skeleton).toBeDefined();
      expect(result.skeleton['2025-01-01']).toEqual(['staff1', 'staff2']);
    });

    it('詳細シフトレスポンスをパースできる', () => {
      const input = `
        {
          "assignments": {
            "2025-01-01": [
              {"staffId": "s1", "shiftType": "日勤"},
              {"staffId": "s2", "shiftType": "早番"}
            ]
          }
        }
      `;
      const result = parseGeminiJsonResponse(input);
      expect(result.assignments).toBeDefined();
      expect(result.assignments['2025-01-01']).toHaveLength(2);
    });
  });
});
