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
        initialAmount: params.initialAmount,
        totalWeeks,
        savingMode,
        startDate: params.startDate || now.slice(0, 10),
        totalTarget,
        completedWeeks: [],
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

  // Complete a week
  const completeWeek = useCallback(
    async (
      challengeId: string,
      weekNumber: number,
      addExpenseFn: (expData: Omit<ExpenseItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<ExpenseItem>
    ): Promise<void> => {
      if (!userId) throw new Error('Usuário não autenticado.');
      const target = challenges.find((c) => c.id === challengeId);
      if (!target) throw new Error('Desafio não encontrado.');

      if (target.completedWeeks.includes(weekNumber)) {
        return; // Already completed
      }

      const totalWeeks = Math.max(1, Math.floor(target.totalWeeks || 52));
      if (weekNumber < 1 || weekNumber > totalWeeks) throw new Error('Etapa inválida para este plano.');
      const savingMode = target.savingMode || 'progressive';
      const fixedWeeklyAmount = Math.round((target.totalTarget / totalWeeks) * 100) / 100;
      const weekAmount = savingMode === 'fixed'
        ? (weekNumber === totalWeeks ? Math.round((target.totalTarget - fixedWeeklyAmount * (totalWeeks - 1)) * 100) / 100 : fixedWeeklyAmount)
        : Math.round(target.initialAmount * weekNumber * 100) / 100;

      // Calculate week date: startDate + (weekNumber - 1) * 7 days
      const start = new Date(target.startDate);
      start.setDate(start.getDate() + (weekNumber - 1) * 7);
      const weekDateStr = start.toISOString().slice(0, 10);

      // Automatically register expense under category "Investimentos"
      const createdExpense = await addExpenseFn({
        name: `Plano semanal: etapa ${weekNumber}`,
        amount: weekAmount,
        date: weekDateStr,
        category: 'Investimentos',
        notes: `Depósito da etapa ${weekNumber} do plano semanal`,
      });

      const now = new Date().toISOString();
      const updatedCompletedWeeks = [...target.completedWeeks, weekNumber].sort((a, b) => a - b);
      const updatedWeekExpenses = {
        ...(target.weekExpenses || {}),
        [weekNumber]: createdExpense.id,
      };
      const isAllDone = updatedCompletedWeeks.length >= totalWeeks;

      const updatedChallenge: FiftyTwoWeekChallenge = {
        ...target,
        completedWeeks: updatedCompletedWeeks,
        weekExpenses: updatedWeekExpenses,
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

  // Undo a completed week
  const undoWeek = useCallback(
    async (
      challengeId: string,
      weekNumber: number,
      deleteExpenseFn: (expenseId: string) => Promise<void>
    ): Promise<void> => {
      if (!userId) throw new Error('Usuário não autenticado.');
      const target = challenges.find((c) => c.id === challengeId);
      if (!target) throw new Error('Desafio não encontrado.');

      if (!target.completedWeeks.includes(weekNumber)) {
        return; // Not completed
      }

      const expenseId = target.weekExpenses?.[weekNumber];
      if (expenseId) {
        try {
          await deleteExpenseFn(expenseId);
        } catch (err) {
          console.warn('Could not delete associated expense:', err);
        }
      }

      const now = new Date().toISOString();
      const updatedCompletedWeeks = target.completedWeeks.filter((w) => w !== weekNumber);
      const updatedWeekExpenses = { ...(target.weekExpenses || {}) };
      delete updatedWeekExpenses[weekNumber];

      const updatedChallenge: FiftyTwoWeekChallenge = {
        ...target,
        completedWeeks: updatedCompletedWeeks,
        weekExpenses: updatedWeekExpenses,
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
    deleteChallenge,
  };
}
