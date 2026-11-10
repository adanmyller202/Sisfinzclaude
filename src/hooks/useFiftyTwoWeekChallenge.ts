/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, sanitizeForFirestore, handleFirestoreError, OperationType } from '../firebase/config';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { FiftyTwoWeekChallenge, ExpenseItem } from '../types';

export function useFiftyTwoWeekChallenge() {
  const { user } = useAuth();
  const userId = user?.uid;

  const [challenges, setChallenges] = useState<FiftyTwoWeekChallenge[]>([]);
  const [activeChallengeId, setActiveChallengeId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const getLocalKey = useCallback(() => `mc_fin_${userId}_52challenges`, [userId]);

  // Real-time Firestore subscription + local cache
  useEffect(() => {
    setChallenges([]);
    setActiveChallengeId(null);

    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Try local storage cache first
    try {
      const cached = localStorage.getItem(getLocalKey());
      if (cached) {
        const parsed: FiftyTwoWeekChallenge[] = JSON.parse(cached);
        setChallenges(parsed);
        if (parsed.length > 0) {
          setActiveChallengeId(parsed[0].id);
        }
      }
    } catch {}

    const colRef = collection(db, 'users', userId, 'fifty_two_week_challenges');

    const unsub = onSnapshot(
      colRef,
      (snapshot) => {
        const list: FiftyTwoWeekChallenge[] = [];
        snapshot.forEach((d) => list.push(d.data() as FiftyTwoWeekChallenge));
        // Sort newest first
        list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setChallenges(list);

        if (list.length > 0) {
          // Keep activeChallengeId if valid, otherwise select first
          setActiveChallengeId((prev) => (prev && list.some((c) => c.id === prev) ? prev : list[0].id));
        } else {
          setActiveChallengeId(null);
        }

        try {
          localStorage.setItem(getLocalKey(), JSON.stringify(list));
        } catch {}
        setLoading(false);
      },
      (err) => {
        console.warn('52-Week Challenges listener error:', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [userId, getLocalKey]);

  // Active challenge getter
  const activeChallenge = challenges.find((c) => c.id === activeChallengeId) || challenges[0] || null;

  // Create new 52-week challenge
  const createChallenge = useCallback(
    async (params: {
      initialAmount: number;
      startDate: string;
      title?: string;
      totalWeeks?: number;
      savingMode?: 'progressive' | 'fixed';
      totalTarget?: number;
      storageLocation?: string;
      currency?: import('../types').CurrencyCode;
    }): Promise<FiftyTwoWeekChallenge> => {
      if (!userId) throw new Error('Usuário não autenticado.');
      if (params.initialAmount <= 0) throw new Error('O valor inicial deve ser maior que zero.');

      const id = 'c52_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const now = new Date().toISOString();
      const totalWeeks = Math.max(1, Math.floor(params.totalWeeks || 52));
      const savingMode = params.savingMode || 'progressive';
      const totalTarget = savingMode === 'fixed'
        ? Math.round((params.totalTarget || params.initialAmount * totalWeeks) * 100) / 100
        : Math.round(params.initialAmount * totalWeeks * (totalWeeks + 1) / 2 * 100) / 100;

      const newChallenge: FiftyTwoWeekChallenge = {
        id,
        userId,
        title: params.title?.trim() || 'Plano Semanal',
        currency: params.currency || 'ARS',
        initialAmount: params.initialAmount,
        totalWeeks,
        savingMode,
        startDate: params.startDate || now.slice(0, 10),
        totalTarget,
        storageLocation: params.storageLocation?.trim() || '',
        completedWeeks: [],
        weekAccountIds: {},
        weekExpenses: {},
        createdAt: now,
        updatedAt: now,
        status: 'active',
      };

      setChallenges((prev) => [newChallenge, ...prev]);
      setActiveChallengeId(id);

      try {
        localStorage.setItem(
          getLocalKey(),
          JSON.stringify([newChallenge, ...challenges])
        );
      } catch {}

      try {
        const docRef = doc(db, 'users', userId, 'fifty_two_week_challenges', id);
        await setDoc(docRef, sanitizeForFirestore(newChallenge));
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `fifty_two_week_challenges/${id}`);
      }

      return newChallenge;
    },
    [userId, challenges, getLocalKey]
  );

  // Complete a week by moving real money out of the selected account into the plan.
  const completeWeek = useCallback(
    async (
      challengeId: string,
      weekNumber: number,
      accountId: string,
      adjustAccountBalanceFn: (accountId: string, amountDelta: number) => Promise<void>,
      planCurrency?: CurrencyCode
    ): Promise<void> => {
      if (!userId) throw new Error('Usuário não autenticado.');
      if (!accountId) throw new Error('Selecione a conta de origem do depósito.');
      const target = challenges.find((c) => c.id === challengeId);
      if (!target) throw new Error('Plano não encontrado.');
      if (target.completedWeeks.includes(weekNumber)) return;

      const totalWeeks = Math.max(1, Math.floor(target.totalWeeks || 52));
      if (weekNumber < 1 || weekNumber > totalWeeks) throw new Error('Etapa inválida para este plano.');
      const savingMode = target.savingMode || 'progressive';
      const fixedWeeklyAmount = Math.round((target.totalTarget / totalWeeks) * 100) / 100;
      const weekAmount = savingMode === 'fixed'
        ? (weekNumber === totalWeeks ? Math.round((target.totalTarget - fixedWeeklyAmount * (totalWeeks - 1)) * 100) / 100 : fixedWeeklyAmount)
        : Math.round(target.initialAmount * weekNumber * 100) / 100;

      // Debit the selected account exactly once. This is a transfer into savings, not an expense.
      await adjustAccountBalanceFn(accountId, -weekAmount);

      const now = new Date().toISOString();
      const updatedCompletedWeeks = [...target.completedWeeks, weekNumber].sort((a, b) => a - b);
      const updatedWeekAccountIds = { ...(target.weekAccountIds || {}), [weekNumber]: accountId };
      const isAllDone = updatedCompletedWeeks.length >= totalWeeks;
      const updatedChallenge: FiftyTwoWeekChallenge = {
        ...target,
        ...(planCurrency ? { currency: planCurrency } : {}),
        completedWeeks: updatedCompletedWeeks,
        weekAccountIds: updatedWeekAccountIds,
        status: isAllDone ? 'completed' : 'active',
        updatedAt: now,
      };

      setChallenges((prev) => prev.map((c) => (c.id === challengeId ? updatedChallenge : c)));
      try {
        const docRef = doc(db, 'users', userId, 'fifty_two_week_challenges', challengeId);
        await setDoc(docRef, sanitizeForFirestore(updatedChallenge), { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `fifty_two_week_challenges/${challengeId}`);
      }
    },
    [userId, challenges]
  );

  // Undo a deposit by returning the money to the account chosen by the user.
  const undoWeek = useCallback(
    async (
      challengeId: string,
      weekNumber: number,
      returnAccountId: string,
      adjustAccountBalanceFn: (accountId: string, amountDelta: number) => Promise<void>,
      deleteExpenseFn: (expenseId: string) => Promise<void>
    ): Promise<void> => {
      if (!userId) throw new Error('Usuário não autenticado.');
      if (!returnAccountId) throw new Error('Selecione a conta que receberá a devolução.');
      const target = challenges.find((c) => c.id === challengeId);
      if (!target) throw new Error('Plano não encontrado.');
      if (!target.completedWeeks.includes(weekNumber)) return;

      const totalWeeks = Math.max(1, Math.floor(target.totalWeeks || 52));
      const savingMode = target.savingMode || 'progressive';
      const fixedWeeklyAmount = Math.round((target.totalTarget / totalWeeks) * 100) / 100;
      const weekAmount = savingMode === 'fixed'
        ? (weekNumber === totalWeeks ? Math.round((target.totalTarget - fixedWeeklyAmount * (totalWeeks - 1)) * 100) / 100 : fixedWeeklyAmount)
        : Math.round(target.initialAmount * weekNumber * 100) / 100;

      // New deposits have an account reference and are returned as a balance credit.
      const originalAccountId = target.weekAccountIds?.[weekNumber];
      if (originalAccountId) {
        await adjustAccountBalanceFn(returnAccountId, weekAmount);
      }

      // Compatibility with old plans: remove the legacy expense record, if one exists.
      const legacyExpenseId = target.weekExpenses?.[weekNumber];
      if (legacyExpenseId) {
        try { await deleteExpenseFn(legacyExpenseId); }
        catch (err) { console.warn('Não foi possível remover o lançamento antigo do depósito:', err); }
      }

      const now = new Date().toISOString();
      const updatedCompletedWeeks = target.completedWeeks.filter((w) => w !== weekNumber);
      const updatedWeekExpenses = { ...(target.weekExpenses || {}) };
      const updatedWeekAccountIds = { ...(target.weekAccountIds || {}) };
      delete updatedWeekExpenses[weekNumber];
      delete updatedWeekAccountIds[weekNumber];
      const updatedChallenge: FiftyTwoWeekChallenge = {
        ...target,
        completedWeeks: updatedCompletedWeeks,
        weekExpenses: updatedWeekExpenses,
        weekAccountIds: updatedWeekAccountIds,
        status: 'active',
        updatedAt: now,
      };

      setChallenges((prev) => prev.map((c) => (c.id === challengeId ? updatedChallenge : c)));
      try {
        const docRef = doc(db, 'users', userId, 'fifty_two_week_challenges', challengeId);
        await setDoc(docRef, sanitizeForFirestore(updatedChallenge), { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `fifty_two_week_challenges/${challengeId}`);
      }
    },
    [userId, challenges]
  );

  const updateStorageLocation = useCallback(
    async (challengeId: string, storageLocation: string): Promise<void> => {
      if (!userId) throw new Error('Usuário não autenticado.');
      const target = challenges.find((c) => c.id === challengeId);
      if (!target) throw new Error('Plano não encontrado.');
      const updatedChallenge = { ...target, storageLocation: storageLocation.trim(), updatedAt: new Date().toISOString() };
      setChallenges((prev) => prev.map((c) => c.id === challengeId ? updatedChallenge : c));
      try {
        const docRef = doc(db, 'users', userId, 'fifty_two_week_challenges', challengeId);
        await setDoc(docRef, sanitizeForFirestore({ storageLocation: updatedChallenge.storageLocation, updatedAt: updatedChallenge.updatedAt }), { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `fifty_two_week_challenges/${challengeId}`);
      }
    },
    [userId, challenges]
  );

  // Delete a challenge
  const deleteChallenge = useCallback(
    async (challengeId: string): Promise<void> => {
      if (!userId) throw new Error('Usuário não autenticado.');
      setChallenges((prev) => prev.filter((c) => c.id !== challengeId));
      if (activeChallengeId === challengeId) {
        setActiveChallengeId(null);
      }

      try {
        const docRef = doc(db, 'users', userId, 'fifty_two_week_challenges', challengeId);
        await deleteDoc(docRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `fifty_two_week_challenges/${challengeId}`);
      }
    },
    [userId, activeChallengeId]
  );

  return {
    challenges,
    activeChallenge,
    activeChallengeId,
    setActiveChallengeId,
    loading,
    createChallenge,
    completeWeek,
    undoWeek,
    updateStorageLocation,
    deleteChallenge,
  };
}
