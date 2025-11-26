import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence, connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, Timestamp, collection, getDocs, query, where } from 'firebase/firestore'; // Phase 19, 22: E2Eテスト用にFirestore SDK関数追加
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

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

// Cloud Functionsの初期化
const functions = getFunctions(app, 'asia-northeast1');

// Cloud Storageの初期化
const storage = getStorage(app);

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

// Phase 18.2 Step 6: import.meta.env.DEVの条件を削除（CI環境対応）
// CI環境でも開発サーバー（npm run dev）を使用するため、localhostのみで判定
if (isLocalhost) {
  // Auth Emulator接続（http://localhost:9099）
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });

  // Firestore Emulator接続（http://localhost:8080）
  connectFirestoreEmulator(db, 'localhost', 8080);

  // Functions Emulator接続（http://localhost:5001）
  connectFunctionsEmulator(functions, 'localhost', 5001);

  // Storage Emulator接続（http://localhost:9199）
  connectStorageEmulator(storage, 'localhost', 9199);

  console.log('🔧 Firebase Emulator接続完了（Auth: http://localhost:9099, Firestore: http://localhost:8080, Functions: http://localhost:5001, Storage: http://localhost:9199）');

  // Phase 18.2 Step 4c: E2Eテスト用にauthをグローバルオブジェクトとして公開
  // Playwrightのpage.evaluate()からアクセス可能にする
  if (typeof window !== 'undefined') {
    (window as any).__firebaseAuth = auth;
    (window as any).__firebaseDb = db;
    // Phase 18.2 Step 6: signInWithEmailAndPasswordもグローバルに公開
    (window as any).__firebaseSignInWithEmailAndPassword = signInWithEmailAndPassword;
    // Phase 19, 22: Firestore SDK関数をグローバルに公開
    (window as any).__firebaseDoc = doc;
    (window as any).__firebaseSetDoc = setDoc;
    (window as any).__firebaseGetDoc = getDoc;
    (window as any).__firebaseTimestamp = Timestamp;
    // Phase 22: 招待フローE2Eテスト用にcollection, getDocs, query, whereを追加
    (window as any).__firebaseCollection = collection;
    (window as any).__firebaseGetDocs = getDocs;
    (window as any).__firebaseQuery = query;
    (window as any).__firebaseWhere = where;

    console.log('✅ [Firebase Debug] グローバルオブジェクト公開成功:', {
      hasAuth: !!(window as any).__firebaseAuth,
      hasDb: !!(window as any).__firebaseDb,
      hasSignIn: !!(window as any).__firebaseSignInWithEmailAndPassword,
      hasDoc: !!(window as any).__firebaseDoc,
      hasSetDoc: !!(window as any).__firebaseSetDoc,
      hasGetDoc: !!(window as any).__firebaseGetDoc,
      hasTimestamp: !!(window as any).__firebaseTimestamp,
      hasCollection: !!(window as any).__firebaseCollection,
      hasGetDocs: !!(window as any).__firebaseGetDocs,
      hasQuery: !!(window as any).__firebaseQuery,
      hasWhere: !!(window as any).__firebaseWhere,
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
export { auth, googleProvider, db, functions, storage, authReady };
export default app;
