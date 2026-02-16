import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 5173,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {},
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      // Phase 19.1.3: ビルド最適化設定
      build: {
        // ソースマップ生成（プロダクションでは無効化）
        sourcemap: mode === 'development',
        // 本番ビルド時の最適化（esbuildはterserより高速）
        minify: 'esbuild',
        // esbuild minifyオプション
        target: 'es2015',
        // チャンク分割戦略
        rollupOptions: {
          output: {
            // ベンダーライブラリを分離してキャッシュ効率を向上
            manualChunks: {
              // React関連
              'react-vendor': ['react', 'react-dom', 'react-router-dom'],
              // Firebase関連
              'firebase-vendor': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
              // Chart.js関連（レポートページでのみ使用）
              'chart-vendor': ['chart.js', 'react-chartjs-2'],
            },
            // ファイル名にハッシュを含める（長期キャッシュのため）
            chunkFileNames: 'assets/[name]-[hash].js',
            entryFileNames: 'assets/[name]-[hash].js',
            assetFileNames: 'assets/[name]-[hash].[ext]',
          },
        },
        // チャンクサイズ警告の閾値（KB）
        chunkSizeWarningLimit: 500,
        // CSS Code Splitting
        cssCodeSplit: true,
      },
      // 最適化オプション
      optimizeDeps: {
        include: ['react', 'react-dom', 'react-router-dom', 'firebase/app', 'firebase/auth', 'firebase/firestore'],
      },
      test: {
        globals: true,
        environment: 'happy-dom',
        setupFiles: './src/test/setup.ts',
        include: ['src/**/*.test.{ts,tsx}'],
        exclude: ['node_modules', 'functions', 'dist', 'solver-functions'],
        coverage: {
          provider: 'v8',
          reporter: ['text', 'json', 'html'],
          exclude: [
            'node_modules/',
            'src/test/',
            '**/*.test.ts',
            '**/*.test.tsx',
            'dist/',
            'functions/',
          ],
        },
      }
    };
});
