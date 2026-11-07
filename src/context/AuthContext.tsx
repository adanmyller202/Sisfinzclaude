import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  sendEmailVerification,
  EmailAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  updatePassword,
  verifyBeforeUpdateEmail,
  deleteUser,
} from 'firebase/auth';
import { doc, setDoc, getDoc, deleteDoc, collection, getDocs, writeBatch, query, where } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase/config';
import { hashEmail } from '../utils/crypto';

export interface OAuthDiagnostics {
  hostname: string;
  pathname: string;
  search: string;
  hash: string;
  isStandalone: boolean;
  authDomain: string;
  authState: string;
  redirectResultStatus: 'pending' | 'success' | 'null' | 'error';
  redirectErrorCode?: string;
  redirectErrorMessage?: string;
  timestamp: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authError: string | null;
  oauthDiagnostics: OAuthDiagnostics | null;
  clearAuthError: () => void;
  signUp: (name: string, email: string, password: string, keepSignedIn: boolean) => Promise<void>;
  signIn: (email: string, password: string, keepSignedIn: boolean) => Promise<void>;
  signInWithGoogle: (keepSignedIn: boolean) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  reloadUser: () => Promise<boolean>;
  updateDisplayName: (name: string) => Promise<void>;
  updateUserPhoto: (photoURL: string | null) => Promise<void>;
  reauthenticateUser: (password?: string) => Promise<void>;
  changeUserPassword: (currentPassword: string, newPassword: string) => Promise<void>;
  changeUserEmail: (currentPassword: string, newEmail: string) => Promise<void>;
  deleteUserAccount: (password?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapAuthErrorMessage(errorCode: string): string {
  if (!errorCode) return '';
  switch (errorCode) {
    case 'auth/email-already-in-use':
      return 'Já existe uma conta cadastrada com este e-mail. Faça login ou recupere sua senha.';
    case 'auth/invalid-email':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'E-mail ou senha incorretos.';
    case 'auth/user-mismatch':
      return 'A conta do Google selecionada é diferente da conta atualmente conectada. Selecione a mesma conta do Google.';
    case 'auth/operation-not-allowed':
      return 'Operação não permitida. O provedor de autenticação (Email/Senha ou Google) precisa estar habilitado no console do Firebase.';
    case 'auth/weak-password':
      return 'A senha é muito fraca. Escolha uma senha com pelo menos 6 caracteres.';
    case 'auth/user-disabled':
      return 'Esta conta foi desativada.';
    case 'auth/network-request-failed':
      return 'Erro de conexão de rede. Verifique sua internet e tente novamente.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas sem sucesso. Por segurança, o acesso foi temporariamente bloqueado.';
    case 'auth/account-exists-with-different-credential':
      return 'Já existe uma conta com este e-mail usando outro método de acesso. Faça login com o método original.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'A autenticação com o Google foi cancelada pelo usuário.';
    case 'auth/popup-blocked':
      return 'O pop-up de reautenticação do Google foi bloqueado pelo navegador/Safari. Permita pop-ups e tente novamente.';
    case 'auth/unauthorized-domain':
      return 'Domínio não autorizado no console do Firebase para autenticação Google.';
    case 'auth/web-storage-unsupported':
      return 'O armazenamento do navegador não é suportado ou foi bloqueado pelo Safari ITP.';
    case 'auth/requires-recent-login':
      return 'Por segurança, confirme sua senha ou conta do Google novamente antes desta alteração.';
    default:
      return '';
  }
}

function isTemporaryRedirectStateError(err: unknown): boolean {
  if (!err) return false;
  const code = (err as { code?: string })?.code || '';
  const message = (err as { message?: string })?.message || String(err);

  const isKnownCode =
    code === 'auth/missing-initial-state' ||
    code === 'auth/web-storage-unsupported' ||
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request';

  const isKnownMsg =
    message.includes('missing initial state') ||
    message.includes('web-storage-unsupported') ||
    message.includes('sessionStorage');

  return isKnownCode || isKnownMsg;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [oauthDiagnostics, setOauthDiagnostics] = useState<OAuthDiagnostics | null>(null);

  useEffect(() => {
    let isMounted = true;
    let authStateResolved = false;
    let redirectResolved = false;

    const checkLoadingComplete = () => {
      if (authStateResolved && redirectResolved && isMounted) {
        setLoading(false);
      }
    };

    // 1. Attach onAuthStateChanged as the primary listener for user session updates
    const unsubListener = onAuthStateChanged(auth, async (currentUser) => {
      if (!isMounted) return;
      if (currentUser) {
        setUser(currentUser);
        try {
          await syncUserProfile(currentUser);
        } catch (syncErr) {
          console.warn('[AuthContext] User directory sync warning:', syncErr);
        }
      } else if (!auth.currentUser) {
        setUser(null);
      }
      authStateResolved = true;
      checkLoadingComplete();
    });

    // 2. Process OAuth redirect result on boot before declaring loading = false
    const processRedirectResult = async () => {
      const isStandalone =
        typeof window !== 'undefined' &&
        ((window.navigator as unknown as { standalone?: boolean })?.standalone === true ||
          window.matchMedia('(display-mode: standalone)').matches);

      const diagInfo: OAuthDiagnostics = {
        hostname: typeof window !== 'undefined' ? window.location.hostname : '',
        pathname: typeof window !== 'undefined' ? window.location.pathname : '',
        search: typeof window !== 'undefined' ? window.location.search || '(vazio)' : '',
        hash: typeof window !== 'undefined' ? window.location.hash || '(vazio)' : '',
        isStandalone,
        authDomain: (auth.app.options as { authDomain?: string })?.authDomain || 'não especificado',
        authState: auth.currentUser ? `Autenticado (${auth.currentUser.uid})` : 'Não autenticado',
        redirectResultStatus: 'pending',
        timestamp: new Date().toLocaleTimeString(),
      };

      try {
        await setPersistence(auth, browserLocalPersistence);
        const redirectResult = await getRedirectResult(auth);
        if (redirectResult && redirectResult.user && isMounted) {
          console.log('[AuthContext] Google OAuth redirect success:', redirectResult.user.uid);
          diagInfo.redirectResultStatus = 'success';
          diagInfo.authState = `Autenticado (${redirectResult.user.uid})`;
          if (isMounted) setOauthDiagnostics({ ...diagInfo });

          await syncUserProfile(redirectResult.user);
          setUser(redirectResult.user);
        } else {
          diagInfo.redirectResultStatus = 'null';
          if (isMounted) setOauthDiagnostics({ ...diagInfo });
        }
      } catch (err: unknown) {
        if (isTemporaryRedirectStateError(err)) {
          console.info('[AuthContext] Ignored temporary OAuth redirect state loss gracefully:', err);
          diagInfo.redirectResultStatus = 'null';
          diagInfo.redirectErrorCode = (err as { code?: string })?.code || 'state_loss_ignored';
          if (isMounted) setOauthDiagnostics({ ...diagInfo });
        } else {
          console.error('[AuthContext] OAuth redirect error:', err);
          const code = (err as { code?: string })?.code || '';
          const rawMsg = (err as Error)?.message || String(err);
          diagInfo.redirectResultStatus = 'error';
          diagInfo.redirectErrorCode = code || 'erro_desconhecido';
          diagInfo.redirectErrorMessage = rawMsg;
          if (isMounted) setOauthDiagnostics({ ...diagInfo });

          if (!auth.currentUser && isMounted) {
            const msg = mapAuthErrorMessage(code);
            setAuthError(msg);
          }
        }
      } finally {
        redirectResolved = true;
        checkLoadingComplete();
      }
    };

    processRedirectResult();

    return () => {
      isMounted = false;
      if (unsubListener) {
        unsubListener();
      }
    };
  }, []);

  const clearAuthError = () => setAuthError(null);

  // Sync user profile in Firestore and searchable user_directory
  const syncUserProfile = async (u: User, displayName?: string) => {
    const userDocRef = doc(db, 'users', u.uid);
    const directoryDocRef = doc(db, 'user_directory', u.uid);
    const resolvedName = displayName || u.displayName || u.email?.split('@')[0] || 'Usuário';
    const emailLower = (u.email || '').toLowerCase().trim();
    const now = new Date().toISOString();

    try {
      const existing = await getDoc(userDocRef);
      if (!existing.exists()) {
        await setDoc(userDocRef, {
          userId: u.uid,
          displayName: resolvedName,
          email: u.email || '',
          createdAt: now,
          updatedAt: now,
        });
      } else if (displayName && existing.data()?.displayName !== displayName) {
        await setDoc(
          userDocRef,
          {
            displayName,
            updatedAt: now,
          },
          { merge: true }
        );
      }
      const savedPhoto = existing.exists() ? existing.data()?.photoURL : null;
      const cachedPhoto = localStorage.getItem(`user_photo_${u.uid}`);
      const effectivePhoto = u.photoURL || savedPhoto || cachedPhoto || null;
      if (effectivePhoto && u.photoURL !== effectivePhoto) {
        setUser((prev) => (prev ? { ...prev, photoURL: effectivePhoto } : prev));
      }

      // Keep directory entry synced for partner invitations by email
      if (emailLower) {
        const directoryPayload = {
          uid: u.uid,
          email: emailLower,
          displayName: resolvedName,
          updatedAt: now,
        };
        await setDoc(directoryDocRef, directoryPayload, { merge: true });

        // Also write to user_directory_lookup using deterministic SHA-256 hash of email
        try {
          const emailHash = await hashEmail(emailLower);
          const lookupDocRef = doc(db, 'user_directory_lookup', emailHash);
          await setDoc(lookupDocRef, directoryPayload, { merge: true });
        } catch (lookupErr) {
          console.warn('Sync lookup doc error:', lookupErr);
        }
      }
    } catch (err) {
      console.warn('Sync profile error:', err);
    }
  };

  const signUp = async (name: string, email: string, password: string, keepSignedIn: boolean) => {
    setAuthError(null);
    try {
      await setPersistence(auth, keepSignedIn ? browserLocalPersistence : browserSessionPersistence);
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (name.trim()) {
        await updateProfile(cred.user, { displayName: name.trim() });
      }
      try {
        await sendEmailVerification(cred.user);
      } catch (err) {
        console.warn('Could not send verification email:', err);
      }
      await syncUserProfile(cred.user, name.trim());
    } catch (err: unknown) {
      console.error('[AuthContext] signUp error:', err);
      const code = (err as { code?: string })?.code || '';
      const mappedMsg = mapAuthErrorMessage(code);
      const finalMsg = mappedMsg || (err instanceof Error ? err.message : '') || 'Erro ao cadastrar conta. Verifique os dados e tente novamente.';
      setAuthError(finalMsg);
      throw new Error(finalMsg);
    }
  };

  const signIn = async (email: string, password: string, keepSignedIn: boolean) => {
    setAuthError(null);
    try {
      await setPersistence(auth, keepSignedIn ? browserLocalPersistence : browserSessionPersistence);
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await syncUserProfile(cred.user);
    } catch (err: unknown) {
      console.error('[AuthContext] signIn error:', err);
      const code = (err as { code?: string })?.code || '';
      const mappedMsg = mapAuthErrorMessage(code);
      const finalMsg = mappedMsg || (err instanceof Error ? err.message : '') || 'Erro ao entrar na conta. Verifique os dados e tente novamente.';
      setAuthError(finalMsg);
      throw new Error(finalMsg);
    }
  };

  const isStandaloneMode = (): boolean => {
    if (typeof window === 'undefined') return false;
    return (
      (window.navigator as unknown as { standalone?: boolean })?.standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches
    );
  };

  const signInWithGoogle = async (_keepSignedIn: boolean) => {
    setAuthError(null);
    try {
      await setPersistence(auth, browserLocalPersistence);
      const cred = await signInWithPopup(auth, googleProvider);
      if (cred && cred.user) {
        await syncUserProfile(cred.user);
      }
    } catch (popupErr: unknown) {
      const code = (popupErr as { code?: string })?.code || '';
      console.warn('[AuthContext] signInWithPopup error code:', code, popupErr);

      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return;
      }

      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment' ||
        isStandaloneMode()
      ) {
        console.log('[AuthContext] Falling back to signInWithRedirect...');
        try {
          await setPersistence(auth, browserLocalPersistence);
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectErr: unknown) {
          const rCode = (redirectErr as { code?: string })?.code || '';
          const msg = mapAuthErrorMessage(rCode);
          setAuthError(msg);
          throw redirectErr;
        }
      }

      const msg = mapAuthErrorMessage(code);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  // Safe password reset: do NOT throw or reveal whether user email exists (prevents account enumeration)
  const resetPassword = async (email: string) => {
    setAuthError(null);
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err: unknown) {
      console.info('[AuthContext] Password reset request finished (generic status response):', err);
    }
  };

  const signOutUser = async () => {
    setAuthError(null);
    try {
      if (typeof window !== 'undefined') {
        try {
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('mc_fin_') || key.startsWith('money_challenge_'))) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach((k) => localStorage.removeItem(k));
        } catch {}
      }
      await signOut(auth);
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  const sendVerificationEmail = async () => {
    setAuthError(null);
    try {
      if (auth.currentUser && !auth.currentUser.emailVerified) {
        await sendEmailVerification(auth.currentUser);
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      const msg = mapAuthErrorMessage(code);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const reloadUser = async (): Promise<boolean> => {
    setAuthError(null);
    try {
      if (auth.currentUser) {
        await auth.currentUser.reload();
        setUser({ ...auth.currentUser });
        return auth.currentUser.emailVerified;
      }
      return false;
    } catch (err) {
      console.warn('Reload user error:', err);
      return false;
    }
  };

  const updateDisplayName = async (name: string): Promise<void> => {
    const clean = name.trim().replace(/\s+/g, ' ').slice(0, 50);
    if (!clean) throw new Error('Informe um nome.');
    if (!auth.currentUser) return;
    await updateProfile(auth.currentUser, { displayName: clean });
    await syncUserProfile(auth.currentUser, clean);
    setUser({ ...auth.currentUser });
  };

  const updateUserPhoto = async (photoURL: string | null): Promise<void> => {
    if (!auth.currentUser) return;
    try {
      await updateProfile(auth.currentUser, { photoURL: photoURL || '' });
    } catch (e) {
      console.warn('Could not update Auth photoURL:', e);
    }
    try {
      const now = new Date().toISOString();
      await setDoc(
        doc(db, 'users', auth.currentUser.uid),
        {
          photoURL: photoURL || null,
          updatedAt: now,
        },
        { merge: true }
      );
      if (photoURL) {
        localStorage.setItem(`user_photo_${auth.currentUser.uid}`, photoURL);
      } else {
        localStorage.removeItem(`user_photo_${auth.currentUser.uid}`);
      }
    } catch (e) {
      console.warn('Could not save user photo to Firestore:', e);
    }
    setUser({ ...auth.currentUser, photoURL });
  };

  // Reauthenticate user before sensitive actions
  const reauthenticateUser = async (password?: string): Promise<void> => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Nenhum usuário autenticado.');

    const isGoogleUser = currentUser.providerData.some((p) => p.providerId === 'google.com');

    if (isGoogleUser) {
      try {
        // Add 12-second timeout to reauthenticateWithPopup so it never hangs indefinitely
        const popupPromise = reauthenticateWithPopup(currentUser, googleProvider);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('auth/popup-timeout')), 12000)
        );
        await Promise.race([popupPromise, timeoutPromise]);
      } catch (err: unknown) {
        console.error('[AuthContext] Google reauthentication popup error:', err);
        const code = (err as { code?: string })?.code || '';
        const msg = (err as Error)?.message || '';

        if (code === 'auth/popup-blocked' || msg === 'auth/popup-timeout') {
          throw new Error('O pop-up de login do Google não respondeu ou foi bloqueado pelo navegador. Permita pop-ups e tente novamente.');
        } else if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
          throw new Error('A reautenticação com o Google foi cancelada.');
        } else if (code === 'auth/user-mismatch') {
          throw new Error('A conta do Google selecionada é diferente da conta atualmente conectada.');
        } else if (code === 'auth/unauthorized-domain') {
          throw new Error('Domínio não autorizado no console do Firebase para autenticação Google.');
        }
        throw err;
      }
    } else {
      if (!password) {
        throw new Error('Digite sua senha atual para continuar.');
      }
      if (!currentUser.email) {
        throw new Error('E-mail do usuário indisponível.');
      }
      const credential = EmailAuthProvider.credential(currentUser.email, password);
      await reauthenticateWithCredential(currentUser, credential);
    }
  };

  // Change password with reauthentication
  const changeUserPassword = async (currentPassword: string, newPassword: string): Promise<void> => {
    setAuthError(null);
    try {
      await reauthenticateUser(currentPassword);
      if (!auth.currentUser) throw new Error('Sessão expirada.');
      await updatePassword(auth.currentUser, newPassword);
    } catch (err: unknown) {
      console.error('[AuthContext] changeUserPassword error:', err);
      const code = (err as { code?: string })?.code || '';
      const mappedMsg = mapAuthErrorMessage(code);
      const finalMsg = mappedMsg || (err instanceof Error ? err.message : '') || 'Erro ao alterar senha. Verifique os dados e tente novamente.';
      setAuthError(finalMsg);
      throw new Error(finalMsg);
    }
  };

async function deleteUserDataFromFirestore(uid: string, email?: string): Promise<void> {
  const subcollections = [
    'bills',
    'incomes',
    'expenses',
    'goals',
    'savings',
    'saving_transactions',
    'monthly_status',
    'categories',
    'accounts',
    'settings',
    'achievements',
    'finance_settings',
    'fifty_two_week_challenges',
  ];

  const BATCH_SIZE = 400;

  // 1. Delete all private user subcollections
  for (const sub of subcollections) {
    try {
      const snap = await getDocs(collection(db, 'users', uid, sub));
      if (!snap.empty) {
        for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
          const chunk = snap.docs.slice(i, i + BATCH_SIZE);
          const batch = writeBatch(db);
          chunk.forEach((docSnap) => batch.delete(docSnap.ref));
          await batch.commit();
        }
      }
    } catch (err: any) {
      console.warn(`[FirestoreDelete] Subcollection users/${uid}/${sub} delete note:`, err?.message || err);
    }
  }

  // 2. Safely terminate shared connections
  try {
    const connSnap = await getDocs(query(collection(db, 'shared_connections'), where('members', 'array-contains', uid)));
    if (!connSnap.empty) {
      for (let i = 0; i < connSnap.docs.length; i += BATCH_SIZE) {
        const chunk = connSnap.docs.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        chunk.forEach((d) => {
          batch.update(d.ref, {
            status: 'cancelled',
            [`userProfiles.${uid}.displayName`]: 'Conta Excluída',
            [`memberProfiles.${uid}.displayName`]: 'Conta Excluída',
            updatedAt: new Date().toISOString(),
          });
        });
        await batch.commit();
      }
    }
  } catch (err: any) {
    console.warn(`[FirestoreDelete] shared_connections status update note:`, err?.message || err);
  }

  // 3. Delete user's invitations
  try {
    const fromInvSnap = await getDocs(query(collection(db, 'shared_invitations'), where('fromUserId', '==', uid)));
    if (!fromInvSnap.empty) {
      for (let i = 0; i < fromInvSnap.docs.length; i += BATCH_SIZE) {
        const chunk = fromInvSnap.docs.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        chunk.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    }

    const toInvSnap = await getDocs(query(collection(db, 'shared_invitations'), where('toUserId', '==', uid)));
    if (!toInvSnap.empty) {
      for (let i = 0; i < toInvSnap.docs.length; i += BATCH_SIZE) {
        const chunk = toInvSnap.docs.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        chunk.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    }
  } catch (err: any) {
    console.warn(`[FirestoreDelete] shared_invitations delete note:`, err?.message || err);
  }

  // 4. Delete user's own notifications
  try {
    const notifSnap = await getDocs(query(collection(db, 'shared_notifications'), where('userId', '==', uid)));
    if (!notifSnap.empty) {
      for (let i = 0; i < notifSnap.docs.length; i += BATCH_SIZE) {
        const chunk = notifSnap.docs.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        chunk.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    }
  } catch (err: any) {
    console.warn(`[FirestoreDelete] shared_notifications delete note:`, err?.message || err);
  }

  // 5. Delete directory entry
  try {
    await deleteDoc(doc(db, 'user_directory', uid));
  } catch (err: any) {
    console.warn(`[FirestoreDelete] user_directory/${uid} delete note:`, err?.message || err);
  }

  // 6. Delete directory lookup doc directly WITHOUT calling getDoc (read is blocked)
  if (email) {
    try {
      const emailHash = await hashEmail(email.toLowerCase().trim());
      const lookupRef = doc(db, 'user_directory_lookup', emailHash);
      await deleteDoc(lookupRef);
    } catch (err: any) {
      console.warn(`[FirestoreDelete] user_directory_lookup delete note:`, err?.message || err);
    }
  }

  // 7. Delete user root doc
  try {
    await deleteDoc(doc(db, 'users', uid));
  } catch (err: any) {
    console.warn(`[FirestoreDelete] users/${uid} root doc delete note:`, err?.message || err);
  }
}

  // Change email with reauthentication and verification link
  const changeUserEmail = async (currentPassword: string, newEmail: string): Promise<void> => {
    setAuthError(null);
    const cleanEmail = newEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Informe um endereço de e-mail válido.');
    }

    try {
      await reauthenticateUser(currentPassword);
      if (!auth.currentUser) throw new Error('Sessão expirada.');
      await verifyBeforeUpdateEmail(auth.currentUser, cleanEmail);
    } catch (err: unknown) {
      console.error('[AuthContext] changeUserEmail error:', err);
      const code = (err as { code?: string })?.code || '';
      const mappedMsg = mapAuthErrorMessage(code);
      const finalMsg = mappedMsg || (err instanceof Error ? err.message : '') || 'Erro ao alterar e-mail. Verifique os dados e tente novamente.';
      setAuthError(finalMsg);
      throw new Error(finalMsg);
    }
  };

  // Delete user account instantly without hanging on Google popup
  const deleteUserAccount = async (password?: string): Promise<void> => {
    setAuthError(null);
    const currentUser = auth.currentUser;
    if (!currentUser) {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.clear();
      }
      setUser(null);
      return;
    }

    const uid = currentUser.uid;
    const email = currentUser.email || undefined;

    // 1. Purge all Firestore user data
    try {
      await deleteUserDataFromFirestore(uid, email);
    } catch (firestoreErr) {
      console.warn('[AuthContext] Firestore cleanup warning:', firestoreErr);
    }

    // 2. Clear relevant local cache and storage
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (
            key &&
            (key.startsWith('mc_') ||
              key.startsWith('money_challenge_') ||
              key.startsWith('user_photo_') ||
              key.startsWith('sisfin_') ||
              key.includes(uid))
          ) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      }
    } catch (storageErr) {
      console.warn('Error clearing localStorage on account delete:', storageErr);
    }

    // 3. Delete Firebase Auth user directly
    try {
      await deleteUser(currentUser);
    } catch (deleteErr: any) {
      const code = deleteErr?.code || '';
      console.warn('[AuthContext] Direct deleteUser result:', code, deleteErr);

      if (code === 'auth/requires-recent-login') {
        try {
          await reauthenticateUser(password);
          await deleteUser(currentUser);
        } catch (reauthErr: any) {
          console.error('[AuthContext] Reauth delete failure:', reauthErr);
          try {
            await signOut(auth);
          } catch {}
          setUser(null);
          const mappedMsg = mapAuthErrorMessage(reauthErr?.code || '');
          const finalMsg = mappedMsg || reauthErr?.message || 'Sessão expirada. Faça login novamente para concluir a exclusão.';
          setAuthError(finalMsg);
          throw new Error(finalMsg);
        }
      } else {
        // Force signout and local state reset so user is never trapped on spinning screen
        try {
          await signOut(auth);
        } catch {}
        setUser(null);
        return;
      }
    }

    // 4. Reset user state
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authError,
        oauthDiagnostics,
        clearAuthError,
        signUp,
        signIn,
        signInWithGoogle,
        resetPassword,
        signOutUser,
        sendVerificationEmail,
        reloadUser,
        updateDisplayName,
        updateUserPhoto,
        reauthenticateUser,
        changeUserPassword,
        changeUserEmail,
        deleteUserAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

