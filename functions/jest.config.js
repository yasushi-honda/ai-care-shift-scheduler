/**
 * Jest設定ファイル
 * Cloud Functions統合テスト用
 */

module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/__tests__'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/types.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],

  // JUnit XMLレポート出力（CI/CD用）
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: './test-results',
        outputName: 'junit.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: true,
      },
    ],
  ],

  // タイムアウト設定（統合テストは時間がかかる）
  testTimeout: 120000, // 120秒

  // ESMモジュールをトランスフォーム対象に含める（@google/genai の依存関係対応）
  transformIgnorePatterns: [
    'node_modules/(?!(p-retry|is-network-error)/)',
  ],

  // ts-jest: TSファイル + ESM JSファイルの両方をトランスフォーム
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '^.+\\.js$': ['ts-jest', { tsconfig: { allowJs: true } }],
  },

  // セットアップファイル
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],
};
