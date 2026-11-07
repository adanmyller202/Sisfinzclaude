import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  getDocFromServer,
  Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);

// Explicitly ensure default browserLocalPersistence so session token remains in IndexedDB across reloads, updates, and PWA restarts
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn('[FirebaseConfig] Could not set browserLocalPersistence:', err);
});

// Critical: Enable multi-tab offline persistence with persistentLocalCache
let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(
    app,
    {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    },
    firebaseConfig.firestoreDatabaseId
  );
} catch (err) {
  // If already initialized (e.g. HMR or hot reload), retrieve existing instance
  firestoreInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

export const db = firestoreInstance;

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Recursively removes undefined fields from objects before saving to Firestore
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return null as unknown as T;
  }
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object' && !(data instanceof Date)) {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(data as Record<string, any>)) {
      if (value !== undefined) {
        sanitized[key] = sanitizeForFirestore(value);
      }
    }
    return sanitized as unknown as T;
  }
  return data;
}

// Connection check on boot
export async function testFirestoreConnection() {
  if (!auth.currentUser) return;
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('connection-timeout')), 3000)
    );
    await Promise.race([
      getDocFromServer(doc(db, 'users', auth.currentUser.uid)),
      timeoutPromise,
    ]);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('offline') ||
        error.message.includes('backend') ||
        error.message.includes('timeout') ||
        error.message.includes('unavailable') ||
        error.message.includes('Could not reach Cloud Firestore'))
    ) {
      console.warn('[FirebaseConfig] Firestore is currently operating in offline mode or backend is unreachable.');
    }
  }
}

