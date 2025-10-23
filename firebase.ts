import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

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

// エクスポート
export { auth, googleProvider, db, authReady };
export default app;
