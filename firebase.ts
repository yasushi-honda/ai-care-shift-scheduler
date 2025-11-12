import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

// Firebase設定（環境変数から取得）
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// 必須の環境変数が設定されているかバリデーション
const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'] as const;
const missingKeys = requiredKeys.filter(key => !firebaseConfig[key as keyof typeof firebaseConfig]);
if (missingKeys.length > 0) {
  throw new Error(`Missing required Firebase configuration: ${missingKeys.join(', ')}`);
}

// Firebase Appの初期化
const app = initializeApp(firebaseConfig);

// Firebase Authenticationの初期化
const auth = getAuth(app);

// 認証状態の永続化設定（ブラウザセッション）
// ブラウザを閉じてもログイン状態を維持
const authReady = setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error('Failed to set auth persistence:', error);
});

// Google OAuthプロバイダーの設定
const googleProvider = new GoogleAuthProvider();

// 毎回アカウント選択を促す（複数アカウント対応）
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Cloud Firestoreの初期化
const db = getFirestore(app);

// Firebase Emulator接続（Phase 18.2: E2Eテスト対応）
// localhost環境かつ開発モードの場合、Emulatorに接続
const isLocalhost = typeof window !== 'undefined' &&
                    (window.location.hostname === 'localhost' ||
                     window.location.hostname === '127.0.0.1');

// Phase 18.2 Step 6: デバッグログ
console.log('🔍 [Firebase Debug] Environment check:', {
  isLocalhost,
  isDev: import.meta.env.DEV,
  hostname: typeof window !== 'undefined' ? window.location.hostname : 'N/A',
  mode: import.meta.env.MODE,
});

if (isLocalhost && import.meta.env.DEV) {
  // Auth Emulator接続（http://localhost:9099）
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });

  // Firestore Emulator接続（http://localhost:8080）
  connectFirestoreEmulator(db, 'localhost', 8080);

  console.log('🔧 Firebase Emulator接続完了（Auth: http://localhost:9099, Firestore: http://localhost:8080）');

  // Phase 18.2 Step 4c: E2Eテスト用にauthをグローバルオブジェクトとして公開
  // Playwrightのpage.evaluate()からアクセス可能にする
  if (typeof window !== 'undefined') {
    (window as any).__firebaseAuth = auth;
    (window as any).__firebaseDb = db;
    console.log('✅ [Firebase Debug] グローバルオブジェクト公開成功:', {
      hasAuth: !!(window as any).__firebaseAuth,
      hasDb: !!(window as any).__firebaseDb,
    });
  }
} else {
  console.log('⚠️ [Firebase Debug] Emulator接続スキップ:', {
    reason: !isLocalhost ? 'Not localhost' : 'Not DEV mode',
    isLocalhost,
    isDev: import.meta.env.DEV,
  });
}

// エクスポート
export { auth, googleProvider, db, authReady };
export default app;
