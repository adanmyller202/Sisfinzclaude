/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, sanitizeForFirestore } from '../firebase/config';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { SavingGoal, SavingTransaction, CurrencyCode, ExpenseItem, IncomeItem } from '../types';
import { getTodayStr, getCurrentMonthStr } from '../utils/finance';
import { formatCurrency } from '../utils/currency';
import { registerPendingWrite, registerResolvedWrite } from './useSyncStatus';

interface TransferFinanceOps {
  addExpense: (expenseData: Omit<ExpenseItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<ExpenseItem>;
  currency: CurrencyCode;
  accountId?: string;
  accountName?: string;
  adjustAccountBalance?: (accountId: string, amountDelta: number) => Promise<void>;
}

interface WithdrawFinanceOps {
  addIncome: (incomeData: Omit<IncomeItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<IncomeItem>;
  addIncomeAsReceived?: (
    incomeData: Omit<IncomeItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
    receivedMonth: string
  ) => Promise<IncomeItem>;
  toggleIncomeReceived: (incomeId: string, month: string, isReceived: boolean, receivedDate?: string) => Promise<void>;
  currentMonthStr: string;
  accountId?: string;
  accountName?: string;
  adjustAccountBalance?: (accountId: string, amountDelta: number) => Promise<void>;
}

export function useSavings() {
  const { user } = useAuth();
  const userId = user?.uid;

  const [savings, setSavings] = useState<SavingGoal[]>([]);
  const [transactions, setTransactions] = useState<SavingTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const getLocalKey = useCallback((sub: string) => `mc_savings_${userId}_${sub}`, [userId]);

  // Real-time listener for user savings and transactions
  useEffect(() => {
    // Immediately clear in-memory savings on user switch/logout
    setSavings([]);
    setTransactions([]);

    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Try reading cache for instant offline render
    try {
      const cached = localStorage.getItem(getLocalKey('goals'));
      const cachedTx = localStorage.getItem(getLocalKey('txs'));
      if (cached) setSavings(JSON.parse(cached));
      if (cachedTx) setTransactions(JSON.parse(cachedTx));
    } catch {
      // ignore
    }

    // 1. Savings Goals listener: /users/{userId}/savings
    const savingsCol = collection(db, 'users', userId, 'savings');
    const unsubSavings = onSnapshot(
      savingsCol,
      (snapshot) => {
        const loaded: SavingGoal[] = [];
        snapshot.forEach((d) => {
          const data = d.data();
          const hasTarget = data.hasTarget !== false;
          loaded.push({
            id: d.id,
            userId,
            name: data.name || '',
            hasTarget,
            targetAmount: hasTarget ? (Number(data.targetAmount) || 0) : undefined,
            currentAmount: Number(data.currentAmount) || 0,
            currency: (data.currency as CurrencyCode) || 'ARS',
            deadline: hasTarget ? (data.deadline || undefined) : undefined,
            icon: data.icon || '🎯',
            notes: data.notes || '',
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt || new Date().toISOString(),
          });
        });
        // Sort by creation date descending
        loaded.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setSavings(loaded);
        try {
          localStorage.setItem(getLocalKey('goals'), JSON.stringify(loaded));
        } catch {
          // ignore
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error listening to savings:', error);
        setLoading(false);
      }
    );

    // 2. Savings Transactions listener: /users/{userId}/saving_transactions
    const txCol = collection(db, 'users', userId, 'saving_transactions');
    const unsubTx = onSnapshot(
      txCol,
      (snapshot) => {
        const loaded: SavingTransaction[] = [];
        snapshot.forEach((d) => {
          const data = d.data();
          const cur = (data.currency as CurrencyCode) || 'ARS';
          const rate = data.exchangeRate !== undefined ? Number(data.exchangeRate) : 1;
          const amt = Number(data.amount) || 0;
          const baseAmt = data.baseAmountARS !== undefined ? Number(data.baseAmountARS) : (cur === 'ARS' ? amt : amt * rate);
          loaded.push({
            id: d.id,
            userId,
            savingId: data.savingId || '',
            savingName: data.savingName || '',
            type: data.type || 'deposit',
            amount: amt,
            currency: cur,
            exchangeRate: rate,
            baseAmountARS: baseAmt,
            date: data.date || getTodayStr(),
            note: data.note || '',
            createdAt: data.createdAt || new Date().toISOString(),
            expenseId: data.expenseId,
            incomeId: data.incomeId,
            accountId: data.accountId,
            accountName: data.accountName,
          });
        });
        loaded.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setTransactions(loaded);
        try {
          localStorage.setItem(getLocalKey('txs'), JSON.stringify(loaded));
        } catch {
          // ignore
        }
      },
      (error) => {
        console.error('Error listening to saving transactions:', error);
      }
    );

    return () => {
      unsubSavings();
      unsubTx();
    };
  }, [userId, getLocalKey]);

  // 1. Create a new Saving Goal
  const createSavingGoal = useCallback(
    async (params: {
      name: string;
      hasTarget?: boolean;
      targetAmount?: number;
      currency?: CurrencyCode;
      deadline?: string;
      icon?: string;
      notes?: string;
    }): Promise<SavingGoal> => {
      if (!userId) throw new Error('Usuário não autenticado.');
      const id = 'save_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const now = new Date().toISOString();
      const hasTarget = params.hasTarget !== false;
      const goalCurrency = params.currency || 'ARS';

      const newGoal: SavingGoal = {
        id,
        userId,
        name: params.name.trim(),
        hasTarget,
        targetAmount: hasTarget ? (Number(params.targetAmount) || 0) : undefined,
        currentAmount: 0,
        currency: goalCurrency,
        deadline: hasTarget ? (params.deadline?.trim() || undefined) : undefined,
        icon: params.icon?.trim() || '🎯',
        notes: params.notes?.trim() || '',
        createdAt: now,
        updatedAt: now,
      };

      setSavings((prev) => {
        const updated = [newGoal, ...prev];
        try {
          localStorage.setItem(getLocalKey('goals'), JSON.stringify(updated));
        } catch {}
        return updated;
      });

      registerPendingWrite();
      const docRef = doc(db, 'users', userId, 'savings', id);
      try {
        await setDoc(docRef, sanitizeForFirestore(newGoal));
      } finally {
        registerResolvedWrite();
      }
      return newGoal;
    },
    [userId, getLocalKey]
  );

  // 2. Update a Saving Goal
  const updateSavingGoal = useCallback(
    async (id: string, updates: Partial<SavingGoal>) => {
      if (!userId) throw new Error('Usuário não autenticado.');
      const now = new Date().toISOString();
      const updatedData = { ...updates, updatedAt: now };

      setSavings((prev) => {
        const updated = prev.map((s) => (s.id === id ? { ...s, ...updatedData } : s));
        try {
          localStorage.setItem(getLocalKey('goals'), JSON.stringify(updated));
        } catch {}
        return updated;
      });

      registerPendingWrite();
      const docRef = doc(db, 'users', userId, 'savings', id);
      try {
        await setDoc(docRef, sanitizeForFirestore(updatedData), { merge: true });
      } finally {
        registerResolvedWrite();
      }
    },
    [userId, getLocalKey]
  );

  // 3. Delete a Saving Goal
  const deleteSavingGoal = useCallback(
    async (id: string) => {
      if (!userId) throw new Error('Usuário não autenticado.');
      setSavings((prev) => {
        const updated = prev.filter((s) => s.id !== id);
        try {
          localStorage.setItem(getLocalKey('goals'), JSON.stringify(updated));
        } catch {}
        return updated;
      });

      registerPendingWrite();
      const docRef = doc(db, 'users', userId, 'savings', id);
      try {
        await deleteDoc(docRef);
      } finally {
        registerResolvedWrite();
      }
    },
    [userId, getLocalKey]
  );
  // 4. Delete a Saving Transaction
  const deleteSavingTransaction = useCallback(
    async (txId: string) => {
      if (!userId) throw new Error('Usuário não autenticado.');
      setTransactions((prev) => {
        const updated = prev.filter((t) => t.id !== txId);
        try {
          localStorage.setItem(getLocalKey('txs'), JSON.stringify(updated));
        } catch {}
        return updated;
      });

      registerPendingWrite();
      try {
        const txRef = doc(db, 'users', userId, 'saving_transactions', txId);
        await deleteDoc(txRef);
      } finally {
        registerResolvedWrite();
      }
    },
    [userId, getLocalKey]
  );

  // 5. Transfer money from Available Balance to a Saving Goal (Aporte)
  // - If foreign currency (USD/BRL): foreign amount is converted to ARS using exchangeRate
  // - Decreases available balance by registering an expense in "Inversiones" using baseAmountARS
  // - Increases saving goal current amount by amount (in cofrinho's currency)
  // - Strictly no duplicate subtraction or creation
  const transferToSaving = useCallback(
    async (
      savingId: string,
      amount: number, // In cofrinho's currency
      exchangeRate: number = 1,
      date?: string,
      note?: string,
      financeOps?: TransferFinanceOps
    ) => {
      if (!userId) throw new Error('Usuário não autenticado.');
      if (amount <= 0) throw new Error('O valor deve ser maior que zero.');

      const targetGoal = savings.find((s) => s.id === savingId);
      if (!targetGoal) throw new Error('Meta de ahorro não encontrada.');

      const goalCurrency = (targetGoal.currency as CurrencyCode) || 'ARS';
      const effectiveRate = goalCurrency === 'ARS' ? 1 : (exchangeRate > 0 ? exchangeRate : 1);
      const baseAmountARS = goalCurrency === 'ARS' ? amount : Math.round(amount * effectiveRate * 100) / 100;

      const txDate = date || getTodayStr();
      const now = new Date().toISOString();
      const formattedGoalAmt = formatCurrency(amount, goalCurrency);
      const formattedARSAmt = formatCurrency(baseAmountARS, 'ARS');

      // 1. Create expense in category "Inversiones" in ARS (SisFinz base balance)
      let createdExpenseId: string | undefined;
      if (financeOps?.addExpense) {
        const expenseName = goalCurrency === 'ARS'
          ? `Inversiones — ${targetGoal.name} — ${formattedGoalAmt}`
          : `Inversiones — ${targetGoal.name} — ${formattedGoalAmt} (${formattedARSAmt})`;
        const createdExp = await financeOps.addExpense({
          name: expenseName,
          amount: baseAmountARS,
          category: 'Inversiones',
          date: txDate,
          accountId: financeOps.accountId,
          notes: `Meta: ${targetGoal.name} | Conta de origem: ${financeOps.accountName || 'Conta não informada'} | Reservado: ${formattedGoalAmt} | Debitado: ${formattedARSAmt} | Cotação: 1 ${goalCurrency} = ${effectiveRate} ARS${note ? ` | Observações: ${note}` : ''}`,
        });
        createdExpenseId = createdExp?.id;
        if (financeOps.accountId && financeOps.adjustAccountBalance) await financeOps.adjustAccountBalance(financeOps.accountId, -baseAmountARS);
      }

      // 2. Update saving goal balance (in foreign currency)
      const newCurrentAmount = (targetGoal.currentAmount || 0) + amount;
      await updateSavingGoal(savingId, { currentAmount: newCurrentAmount });

      // 3. Record transaction
      const txId = 'stx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const newTx: SavingTransaction = {
        id: txId,
        userId,
        savingId,
        savingName: targetGoal.name,
        type: 'deposit',
        amount,
        currency: goalCurrency,
        exchangeRate: effectiveRate,
        baseAmountARS,
        date: txDate,
        note: `Meta: ${targetGoal.name} | Conta de origem: ${financeOps?.accountName || 'Conta não informada'} | Cotação: 1 ${goalCurrency} = ${effectiveRate} ARS${note ? ` | ${note}` : ''}`,
        accountId: financeOps?.accountId,
        accountName: financeOps?.accountName,
        createdAt: now,
        expenseId: createdExpenseId,
      };

      setTransactions((prev) => {
        const updated = [newTx, ...prev];
        try {
          localStorage.setItem(getLocalKey('txs'), JSON.stringify(updated));
        } catch {}
        return updated;
      });

      registerPendingWrite();
      try {
        const txRef = doc(db, 'users', userId, 'saving_transactions', txId);
        await setDoc(txRef, sanitizeForFirestore(newTx));
      } catch (err) {
        console.error('Error recording saving transaction:', err);
      } finally {
        registerResolvedWrite();
      }
    },
    [userId, savings, updateSavingGoal, getLocalKey]
  );

  // 6. Withdraw money from a Saving Goal back to Available Balance (Resgate)
  // - Decreases saving goal current amount by amount (in cofrinho's currency)
  // - Increases available balance by adding received income in ARS (baseAmountARS = amount * exchangeRate)
  const withdrawFromSaving = useCallback(
    async (
      savingId: string,
      amount: number, // In cofrinho's currency
      exchangeRate: number = 1,
      date?: string,
      note?: string,
      financeOps?: WithdrawFinanceOps
    ) => {
      if (!userId) throw new Error('Usuário não autenticado.');
      if (amount <= 0) throw new Error('O valor deve ser maior que zero.');

      const targetGoal = savings.find((s) => s.id === savingId);
      if (!targetGoal) throw new Error('Meta de ahorro não encontrada.');

      if ((targetGoal.currentAmount || 0) < amount) {
        throw new Error('Monto insuficiente ahorrado en esta meta.');
      }

      const goalCurrency = (targetGoal.currency as CurrencyCode) || 'ARS';
      const effectiveRate = goalCurrency === 'ARS' ? 1 : (exchangeRate > 0 ? exchangeRate : 1);
      const baseAmountARS = goalCurrency === 'ARS' ? amount : Math.round(amount * effectiveRate * 100) / 100;

      const txDate = date || getTodayStr();
      const now = new Date().toISOString();
      const currentMonth = financeOps?.currentMonthStr || getCurrentMonthStr();
      const dayOfMonth = txDate && txDate.includes('-') ? (parseInt(txDate.split('-')[2], 10) || new Date().getDate()) : new Date().getDate();
      const formattedGoalAmt = formatCurrency(amount, goalCurrency);
      const formattedARSAmt = formatCurrency(baseAmountARS, 'ARS');

      // 1. Add received income to restore available balance (in ARS)
      let createdIncomeId: string | undefined;
      if (financeOps?.addIncome && financeOps?.toggleIncomeReceived) {
        const incomeName = goalCurrency === 'ARS'
          ? `Retiro de ahorro: ${targetGoal.name}`
          : `Retiro de ahorro: ${targetGoal.name} (${formattedGoalAmt} -> ${formattedARSAmt})`;
        const incomePayload = {
          name: incomeName,
          amount: baseAmountARS,
          category: 'Inversiones',
          expectedDate: txDate,
          expectedDay: dayOfMonth,
          recurrence: 'none' as const,
          startMonth: currentMonth,
          accountId: financeOps.accountId,
          notes: `Meta: ${targetGoal.name} | Conta de destino: ${financeOps.accountName || 'Conta não informada'} | Resgatado: ${formattedGoalAmt} | Creditado: ${formattedARSAmt} | Cotação: 1 ${goalCurrency} = ${effectiveRate} ARS${note ? ` | Observações: ${note}` : ''}`,
        };
        const newIncome = financeOps.addIncomeAsReceived
          ? await financeOps.addIncomeAsReceived(incomePayload, currentMonth)
          : await financeOps.addIncome(incomePayload);
        createdIncomeId = newIncome.id;
        if (financeOps.accountId && financeOps.adjustAccountBalance) await financeOps.adjustAccountBalance(financeOps.accountId, baseAmountARS);
        // Mark immediately received when the finance adapter does not support atomic creation.
        if (!financeOps.addIncomeAsReceived) {
          await financeOps.toggleIncomeReceived(newIncome.id, currentMonth, true, txDate);
        }
      } else {
        console.error('Finance operations (addIncome/toggleIncomeReceived) missing in withdrawFromSaving');
      }

      // 2. Decrease saving goal balance (in cofrinho's currency)
      const newCurrentAmount = Math.max(0, (targetGoal.currentAmount || 0) - amount);
      await updateSavingGoal(savingId, { currentAmount: newCurrentAmount });

      // 3. Record transaction
      const txId = 'stx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const newTx: SavingTransaction = {
        id: txId,
        userId,
        savingId,
        savingName: targetGoal.name,
        type: 'withdrawal',
        amount,
        currency: goalCurrency,
        exchangeRate: effectiveRate,
        baseAmountARS,
        date: txDate,
        note: `Meta: ${targetGoal.name} | Conta de destino: ${financeOps?.accountName || 'Conta não informada'} | Cotação: 1 ${goalCurrency} = ${effectiveRate} ARS${note ? ` | ${note}` : ''}`,
        accountId: financeOps?.accountId,
        accountName: financeOps?.accountName,
        createdAt: now,
        incomeId: createdIncomeId,
      };

      setTransactions((prev) => {
        const updated = [newTx, ...prev];
        try {
          localStorage.setItem(getLocalKey('txs'), JSON.stringify(updated));
        } catch {}
        return updated;
      });

      registerPendingWrite();
      try {
        const txRef = doc(db, 'users', userId, 'saving_transactions', txId);
        await setDoc(txRef, sanitizeForFirestore(newTx));
      } catch (err) {
        console.error('Error recording saving transaction:', err);
      } finally {
        registerResolvedWrite();
      }
    },
    [userId, savings, updateSavingGoal, getLocalKey]
  );

  // Derived totals by currency
  const totalsByCurrency = useMemo(() => {
    const map: Record<CurrencyCode, { saved: number; target: number; count: number }> = {
      ARS: { saved: 0, target: 0, count: 0 },
      USD: { saved: 0, target: 0, count: 0 },
      BRL: { saved: 0, target: 0, count: 0 },
      EUR: { saved: 0, target: 0, count: 0 },
    };
    savings.forEach((s) => {
      const cur = (s.currency as CurrencyCode) || 'ARS';
      if (!map[cur]) {
        map[cur] = { saved: 0, target: 0, count: 0 };
      }
      map[cur].saved += s.currentAmount || 0;
      if (s.hasTarget !== false && s.targetAmount) {
        map[cur].target += s.targetAmount;
      }
      map[cur].count += 1;
    });
    return map;
  }, [savings]);

  // Legacy derived totals for ARS
  const totalSavedInSavings = useMemo(() => {
    return totalsByCurrency.ARS.saved;
  }, [totalsByCurrency]);

  const totalTargetInSavings = useMemo(() => {
    return totalsByCurrency.ARS.target;
  }, [totalsByCurrency]);

  return {
    savings,
    transactions,
    loading,
    totalsByCurrency,
    totalSavedInSavings,
    totalTargetInSavings,
    createSavingGoal,
    updateSavingGoal,
    deleteSavingGoal,
    deleteSavingTransaction,
    transferToSaving,
    withdrawFromSaving,
  };
}
