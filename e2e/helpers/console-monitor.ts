import { Page } from '@playwright/test';

/**
 * Permission errorを検出するコンソール監視ヘルパー
 *
 * Phase 18.1: Phase 17で発見されたPermission errorを自動検出
 *
 * 使用例:
 * ```typescript
 * const monitor = new ConsoleMonitor(page);
 * await page.goto('/admin/users');
 * const error = monitor.hasPermissionError();
 * expect(error).toBeNull();
 * ```
 */

export interface ConsoleMessage {
  type: string;
  text: string;
  location?: string;
}

/**
 * Permission errorのパターン
 */
const PERMISSION_ERROR_PATTERNS = [
  /permission/i,
  /insufficient permissions/i,
  /PERMISSION_DENIED/i,
  /Missing or insufficient permissions/i,
  /Failed to get.*permission/i,
  /Error fetching.*permission/i,
];

/**
 * コンソールログを監視し、Permission errorを検出
 */
export class ConsoleMonitor {
  private consoleMessages: ConsoleMessage[] = [];
  private page: Page;

  constructor(page: Page) {
    this.page = page;
    this.setupConsoleListener();
  }

  /**
   * コンソールリスナーをセットアップ
   */
  private setupConsoleListener() {
    this.page.on('console', (msg) => {
      this.consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location()?.url,
      });
    });
  }

  /**
   * Permission errorが発生しているか確認
   *
   * @returns Permission errorが発生している場合はそのメッセージ、なければnull
   */
  hasPermissionError(): ConsoleMessage | null {
    for (const msg of this.consoleMessages) {
      // error, warningタイプのみチェック
      if (msg.type !== 'error' && msg.type !== 'warning') {
        continue;
      }

      // Permission errorパターンにマッチするか確認
      for (const pattern of PERMISSION_ERROR_PATTERNS) {
        if (pattern.test(msg.text)) {
          return msg;
        }
      }
    }

    return null;
  }

  /**
   * すべてのコンソールメッセージを取得
   */
  getAllMessages(): ConsoleMessage[] {
    return this.consoleMessages;
  }

  /**
   * エラーメッセージのみ取得
   */
  getErrorMessages(): ConsoleMessage[] {
    return this.consoleMessages.filter((msg) => msg.type === 'error');
  }

  /**
   * コンソールログをクリア
   */
  clear() {
    this.consoleMessages = [];
  }
}
