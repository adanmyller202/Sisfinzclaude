/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { AccountItem, AccountTransferRecord, AccountType, CurrencyCode } from '../types';
import { db } from '../firebase/config';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  getDocs,
  writeBatch,
  runTransaction,
} from 'firebase/firestore';

function sanitizeFirestorePayload<T extends Record<string, any>>(obj: T): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      clean[key] = val;
    }
  }
  return clean;
}

export function useAccounts() {
  const { user } = useAuth();

  const getLocalKey = useCallback(
    (sub: string) => (user ? `mc_acc_${user.uid}_${sub}` : `mc_acc_anon_${sub}`),
    [user]
  );

  // Initial accounts from localStorage for instant offline/re-render availability
  const [accounts, setAccounts] = useState<AccountItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      let stored = localStorage.getItem('mc_acc_last_accounts');
      if (!stored && user) {
        stored = localStorage.getItem(`mc_acc_${user.uid}_accounts`);
      }
      if (!stored) {
        stored = localStorage.getItem('mc_acc_anon_accounts');
      }
      if (!stored) {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('mc_acc_') && key.endsWith('_accounts')) {
            stored = localStorage.getItem(key);
            if (stored) break;
          }
        }
      }
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [transfers, setTransfers] = useState<AccountTransferRecord[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      let stored = localStorage.getItem('mc_acc_last_transfers');
      if (!stored && user) {
        stored = localStorage.getItem(`mc_acc_${user.uid}_transfers`);
      }
      if (!stored) {
        stored = localStorage.getItem('mc_acc_anon_transfers');
      }
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [loadingAccounts, setLoadingAccounts] = useState<boolean>(true);

  // 1. Realtime listener for user's accounts
  useEffect(() => {
    if (!user) {
      try {
        const cached =
          localStorage.getItem('mc_acc_anon_accounts') ||
          localStorage.getItem('mc_acc_last_accounts');
        if (cached) {
          setAccounts(JSON.parse(cached));
        }
        const cachedTx =
          localStorage.getItem('mc_acc_anon_transfers') ||
          localStorage.getItem('mc_acc_last_transfers');
        if (cachedTx) {
          setTransfers(JSON.parse(cachedTx));
        }
      } catch {}
      setLoadingAccounts(false);
      return;
    }

    // Try reading user specific cache or last cached accounts
    try {
      const cached =
        localStorage.getItem(getLocalKey('accounts')) ||
        localStorage.getItem('mc_acc_last_accounts');
      if (cached) {
        setAccounts(JSON.parse(cached));
      }
      const cachedTx =
        localStorage.getItem(getLocalKey('transfers')) ||
        localStorage.getItem('mc_acc_last_transfers');
      if (cachedTx) {
        setTransfers(JSON.parse(cachedTx));
      }
    } catch {}

    setLoadingAccounts(true);
    const accountsRef = collection(db, 'users', user.uid, 'accounts');
    const unsubAccounts = onSnapshot(
      accountsRef,
      (snapshot) => {
        const list: AccountItem[] = [];
        snapshot.forEach((docSnap) => {
          // Legacy account documents may not contain their own id field. Always use the Firestore document ID as the stable account ID.
          const data = docSnap.data() as Partial<AccountItem>;
          list.push({ ...data, id: data.id || docSnap.id } as AccountItem);
        });
        // Sort accounts by type/name
        list.sort((a, b) => a.name.localeCompare(b.name));
        setAccounts(list);
        try {
          localStorage.setItem(getLocalKey('accounts'), JSON.stringify(list));
          localStorage.setItem('mc_acc_last_accounts', JSON.stringify(list));
        } catch {}
        setLoadingAccounts(false);
      },
      (err) => {
        console.warn('Error listening to accounts:', err);
        setLoadingAccounts(false);
      }
    );

    const transfersRef = collection(db, 'users', user.uid, 'account_transfers');
    const qTransfers = query(transfersRef, orderBy('createdAt', 'desc'));
    const unsubTransfers = onSnapshot(
      qTransfers,
      (snapshot) => {
        const list: AccountTransferRecord[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as AccountTransferRecord);
        });
        setTransfers(list);
        try {
          localStorage.setItem(getLocalKey('transfers'), JSON.stringify(list));
          localStorage.setItem('mc_acc_last_transfers', JSON.stringify(list));
        } catch {}
      },
      (err) => {
        console.warn('Error listening to account transfers:', err);
      }
    );

    return () => {
      unsubAccounts();
      unsubTransfers();
    };
  }, [user, getLocalKey]);

  // Total balance sum of all active accounts
  const totalBalance = useMemo(() => {
    return accounts
      .filter((a) => a.isActive !== false)
      .reduce((sum, acc) => {
        const val = acc.currentBalance ?? (acc as any).balance ?? acc.initialBalance ?? 0;
        return sum + (Number(val) || 0);
      }, 0);
  }, [accounts]);

  // Create new account
  const addAccount = useCallback(
    async (params: {
      name: string;
      type: AccountType;
      currency: CurrencyCode;
      initialBalance: number;
      currentBalance?: number;
      notes?: string;
    }) => {
      const now = new Date().toISOString();
      const accountId = `acc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const uid = user?.uid || 'local_user';

      const initialBal =
        params.currentBalance !== undefined
          ? Number(params.currentBalance) || 0
          : Number(params.initialBalance) || 0;

      const newAccountData: AccountItem = {
        id: accountId,
        userId: uid,
        name: params.name.trim(),
        type: params.type,
        currency: params.currency,
        initialBalance: initialBal,
        currentBalance: initialBal,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };

      const trimmedNotes = params.notes?.trim();
      if (trimmedNotes) {
        newAccountData.notes = trimmedNotes;
      }

      // Optimistic update
      setAccounts((prev) => {
        const updated = [...prev, newAccountData].sort((a, b) => a.name.localeCompare(b.name));
        try {
          localStorage.setItem(getLocalKey('accounts'), JSON.stringify(updated));
          localStorage.setItem('mc_acc_last_accounts', JSON.stringify(updated));
        } catch {}
        return updated;
      });

      if (user) {
        try {
          await setDoc(
            doc(db, 'users', user.uid, 'accounts', accountId),
            sanitizeFirestorePayload(newAccountData)
          );
        } catch (err) {
          console.warn('Could not save account to Firestore:', err);
        }
      }
    },
    [user, getLocalKey]
  );

  // Update existing account
  const updateAccount = useCallback(
    async (id: string, params: Partial<AccountItem> & { currentBalance?: number }) => {
      const acc = accounts.find((a) => a.id === id);
      if (!acc) return;

      const updated: AccountItem = {
        ...acc,
        ...params,
        ...(params.currentBalance !== undefined
          ? { currentBalance: params.currentBalance, initialBalance: params.currentBalance }
          : {}),
        updatedAt: new Date().toISOString(),
      };

      if (params.notes !== undefined) {
        const trimmed = params.notes.trim();
        updated.notes = trimmed ? trimmed : '';
      }

      // Optimistic update
      setAccounts((prev) => {
        const list = prev.map((a) => (a.id === id ? updated : a));
        try {
          localStorage.setItem(getLocalKey('accounts'), JSON.stringify(list));
          localStorage.setItem('mc_acc_last_accounts', JSON.stringify(list));
        } catch {}
        return list;
      });

      if (user) {
        try {
          await setDoc(
            doc(db, 'users', user.uid, 'accounts', id),
            sanitizeFirestorePayload(updated),
            { merge: true }
          );
        } catch (err) {
          console.warn('Could not update account in Firestore:', err);
        }
      }
    },
    [user, accounts, getLocalKey]
  );

  // Toggle active/inactive status
  const toggleAccountActive = useCallback(
    async (id: string) => {
      const acc = accounts.find((a) => a.id === id);
      if (!acc) return;

      const updated = {
        ...acc,
        isActive: !acc.isActive,
        updatedAt: new Date().toISOString(),
      };

      setAccounts((prev) => {
        const list = prev.map((a) => (a.id === id ? updated : a));
        try {
          localStorage.setItem(getLocalKey('accounts'), JSON.stringify(list));
          localStorage.setItem('mc_acc_last_accounts', JSON.stringify(list));
        } catch {}
        return list;
      });

      if (user) {
        try {
          const payload = sanitizeFirestorePayload({
            isActive: !acc.isActive,
            updatedAt: new Date().toISOString(),
          });
          await setDoc(
            doc(db, 'users', user.uid, 'accounts', id),
            payload,
            { merge: true }
          );
        } catch (err) {
          console.warn('Could not toggle account status in Firestore:', err);
        }
      }
    },
    [user, accounts, getLocalKey]
  );

  // Delete account
  const deleteAccount = useCallback(
    async (id: string) => {
      setAccounts((prev) => {
        const list = prev.filter((a) => a.id !== id);
        try {
          localStorage.setItem(getLocalKey('accounts'), JSON.stringify(list));
          localStorage.setItem('mc_acc_last_accounts', JSON.stringify(list));
        } catch {}
        return list;
      });

      if (user) {
        try {
          await deleteDoc(doc(db, 'users', user.uid, 'accounts', id));
        } catch (err) {
          console.warn('Could not delete account in Firestore:', err);
        }
      }
    },
    [user, getLocalKey]
  );

  // Transfer money between two user accounts
  const transferBetweenAccounts = useCallback(
    async (params: {
      fromAccountId: string;
      toAccountId: string;
      amount: number;
      date: string;
      notes?: string;
    }) => {
      if (!user) throw new Error('Usuário não autenticado.');
      const { fromAccountId, toAccountId, amount, date, notes } = params;

      if (fromAccountId === toAccountId) {
        throw new Error('A conta de origem e destino não podem ser a mesma.');
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('O valor da transferência deve ser maior que zero.');
      }

      const fromAcc = accounts.find((a) => a.id === fromAccountId);
      const toAcc = accounts.find((a) => a.id === toAccountId);
      if (!fromAcc || !toAcc) {
        throw new Error('Conta de origem ou destino não encontrada.');
      }
      if (fromAcc.isActive === false || toAcc.isActive === false) {
        throw new Error('As duas contas precisam estar ativas.');
      }
      if (fromAcc.currency !== toAcc.currency) {
        throw new Error('Não é possível transferir diretamente entre contas de moedas diferentes.');
      }

      const now = new Date().toISOString();
      const transferId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const fromRef = doc(db, 'users', user.uid, 'accounts', fromAccountId);
      const toRef = doc(db, 'users', user.uid, 'accounts', toAccountId);
      const transferRef = doc(db, 'users', user.uid, 'account_transfers', transferId);

      // Commit both balance changes and the transfer record atomically.
      await runTransaction(db, async (tx) => {
        const [fromSnapshot, toSnapshot] = await Promise.all([tx.get(fromRef), tx.get(toRef)]);
        if (!fromSnapshot.exists() || !toSnapshot.exists()) {
          throw new Error('Uma das contas não existe mais. Atualize a tela e tente novamente.');
        }
        const fromData = fromSnapshot.data() as AccountItem;
        const toData = toSnapshot.data() as AccountItem;
        if (fromData.isActive === false || toData.isActive === false) {
          throw new Error('As duas contas precisam estar ativas.');
        }
        if (fromData.currency !== toData.currency) {
          throw new Error('Não é possível transferir diretamente entre contas de moedas diferentes.');
        }

        const fromBalance = Number(fromData.currentBalance) || 0;
        const toBalance = Number(toData.currentBalance) || 0;
        tx.update(fromRef, { currentBalance: fromBalance - amount, updatedAt: now });
        tx.update(toRef, { currentBalance: toBalance + amount, updatedAt: now });
        tx.set(transferRef, sanitizeFirestorePayload({
          id: transferId,
          userId: user.uid,
          fromAccountId,
          fromAccountName: fromData.name || fromAcc.name,
          toAccountId,
          toAccountName: toData.name || toAcc.name,
          amount,
          date,
          ...(notes?.trim() ? { notes: notes.trim() } : {}),
          createdAt: now,
        }));
      });

      setAccounts((prev) => {
        const list = prev.map((account) => {
          if (account.id === fromAccountId) return { ...account, currentBalance: (account.currentBalance || 0) - amount, updatedAt: now };
          if (account.id === toAccountId) return { ...account, currentBalance: (account.currentBalance || 0) + amount, updatedAt: now };
          return account;
        });
        try {
          localStorage.setItem(getLocalKey('accounts'), JSON.stringify(list));
          localStorage.setItem('mc_acc_last_accounts', JSON.stringify(list));
        } catch {}
        return list;
      });
    },
    [user, accounts, getLocalKey]
  );

  // Delete/revert transfer record
  const deleteTransfer = useCallback(
    async (transferId: string) => {
      if (!user) return;
      const tx = transfers.find((t) => t.id === transferId);
      if (!tx) return;

      const fromAcc = accounts.find((a) => a.id === tx.fromAccountId);
      const toAcc = accounts.find((a) => a.id === tx.toAccountId);

      const now = new Date().toISOString();

      // Optimistic update
      setAccounts((prev) => {
        const list = prev.map((a) => {
          if (a.id === tx.fromAccountId) {
            return { ...a, currentBalance: (a.currentBalance || 0) + tx.amount, updatedAt: now };
          }
          if (a.id === tx.toAccountId) {
            return { ...a, currentBalance: (a.currentBalance || 0) - tx.amount, updatedAt: now };
          }
          return a;
        });
        try {
          localStorage.setItem(getLocalKey('accounts'), JSON.stringify(list));
          localStorage.setItem('mc_acc_last_accounts', JSON.stringify(list));
        } catch {}
        return list;
      });

      // Revert balances
      if (fromAcc) {
        await setDoc(
          doc(db, 'users', user.uid, 'accounts', tx.fromAccountId),
          sanitizeFirestorePayload({
            currentBalance: (fromAcc.currentBalance || 0) + tx.amount,
            updatedAt: now,
          }),
          { merge: true }
        );
      }

      if (toAcc) {
        await setDoc(
          doc(db, 'users', user.uid, 'accounts', tx.toAccountId),
          sanitizeFirestorePayload({
            currentBalance: (toAcc.currentBalance || 0) - tx.amount,
            updatedAt: now,
          }),
          { merge: true }
        );
      }

      // Delete transfer log
      await deleteDoc(doc(db, 'users', user.uid, 'account_transfers', transferId));
    },
    [user, accounts, transfers, getLocalKey]
  );

  // Adjust account balance when linked to an income/expense/bill
  const adjustAccountBalanceForFinancialItem = useCallback(
    async (accountId: string, amountDelta: number) => {
      if (!user || !accountId || amountDelta === 0) return;
      const acc = accounts.find((a) => a.id === accountId);
      if (!acc) return;

      const now = new Date().toISOString();
      setAccounts((prev) => {
        const list = prev.map((a) =>
          a.id === accountId ? { ...a, currentBalance: (a.currentBalance || 0) + amountDelta, updatedAt: now } : a
        );
        try {
          localStorage.setItem(getLocalKey('accounts'), JSON.stringify(list));
          localStorage.setItem('mc_acc_last_accounts', JSON.stringify(list));
        } catch {}
        return list;
      });

      await setDoc(
        doc(db, 'users', user.uid, 'accounts', accountId),
        sanitizeFirestorePayload({
          currentBalance: (acc.currentBalance || 0) + amountDelta,
          updatedAt: now,
        }),
        { merge: true }
      );
    },
    [user, accounts, getLocalKey]
  );

  // Clear all transfers without altering current balances
  const clearAllTransfers = useCallback(async () => {
    setTransfers([]);
    try {
      localStorage.removeItem(getLocalKey('transfers'));
      localStorage.removeItem('mc_acc_last_transfers');
    } catch {}

    if (user) {
      try {
        const snap = await getDocs(collection(db, 'users', user.uid, 'account_transfers'));
        const batch = writeBatch(db);
        snap.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      } catch (err) {
        console.warn('Error clearing transfer history:', err);
      }
    }
  }, [user, getLocalKey]);

  return {
    accounts,
    transfers,
    totalBalance,
    loadingAccounts,
    addAccount,
    updateAccount,
    toggleAccountActive,
    deleteAccount,
    transferBetweenAccounts,
    deleteTransfer,
    clearAllTransfers,
    adjustAccountBalanceForFinancialItem,
  };
}
