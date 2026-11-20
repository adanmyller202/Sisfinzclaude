import { useCallback, useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  runTransaction,
  setDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { AccountItem, CurrencyCode } from '../types';
import { LaborJob, LaborTipEntry } from '../types/labor';
import { getCurrentMonthStr } from '../utils/finance';

function sanitizePayload<T extends Record<string, any>>(obj: T): Record<string, any> {
  return JSON.parse(JSON.stringify(obj));
}

export function useLaborAgenda() {
  const { user } = useAuth();
  const userId = user?.uid;

  const jobsStorageKey = `sisfinz_labor_jobs_v1_${userId || 'guest'}`;

  const [jobs, setJobs] = useState<LaborJob[]>(() => {
    try {
      const raw = localStorage.getItem(jobsStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [accounts, setAccounts] = useState<AccountItem[]>(() => {
    try {
      const raw =
        (userId ? localStorage.getItem(`mc_acc_${userId}_accounts`) : null) ||
        localStorage.getItem('mc_acc_last_accounts');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [isLoading, setIsLoading] = useState(false);

  // Listen to Firestore labor_jobs in real time
  useEffect(() => {
    if (!userId) return;
    setIsLoading(true);
    const colRef = collection(db, 'users', userId, 'labor_jobs');
    const unsub = onSnapshot(
      colRef,
      (snapshot) => {
        const list: LaborJob[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as LaborJob;
          list.push({ ...data, id: docSnap.id });
        });
        list.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
        setJobs(list);
        try {
          localStorage.setItem(jobsStorageKey, JSON.stringify(list));
        } catch {
          // ignore
        }
        setIsLoading(false);
      },
      () => {
        setIsLoading(false);
      }
    );
    return () => unsub();
  }, [userId, jobsStorageKey]);

  // Listen to Firestore accounts so tips & salary can integrate directly with real balances
  useEffect(() => {
    if (!userId) return;
    const accRef = collection(db, 'users', userId, 'accounts');
    const unsub = onSnapshot(
      accRef,
      (snapshot) => {
        const list: AccountItem[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as AccountItem;
          if (data.isActive !== false) {
            list.push({ ...data, id: docSnap.id });
          }
        });
        setAccounts(list);
      },
      () => {
        // keep localStorage fallback
      }
    );
    return () => unsub();
  }, [userId]);

  const saveJob = useCallback(
    async (job: LaborJob) => {
      const updated: LaborJob = { ...job, updatedAt: new Date().toISOString() };
      setJobs((prev) => {
        const exists = prev.some((item) => item.id === updated.id);
        const next = exists
          ? prev.map((item) => (item.id === updated.id ? updated : item))
          : [...prev, updated];
        try {
          localStorage.setItem(jobsStorageKey, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });

      if (userId) {
        try {
          await setDoc(
            doc(db, 'users', userId, 'labor_jobs', updated.id),
            sanitizePayload(updated),
            { merge: true }
          );
        } catch (err) {
          console.warn('[LaborAgenda] Saved locally, Firestore sync pending:', err);
        }
      }
    },
    [userId, jobsStorageKey]
  );

  const deleteJob = useCallback(
    async (jobId: string) => {
      setJobs((prev) => {
        const next = prev.filter((item) => item.id !== jobId);
        try {
          localStorage.setItem(jobsStorageKey, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });

      if (userId) {
        try {
          await deleteDoc(doc(db, 'users', userId, 'labor_jobs', jobId));
        } catch (err) {
          console.warn('[LaborAgenda] Deleted locally, Firestore sync pending:', err);
        }
      }
    },
    [userId, jobsStorageKey]
  );

  /**
   * Record a received tip (Propina) directly into the user's SisFinz account balance
   * AND create a received Income record for that month so reports & balances stay 100% consistent.
   */
  const recordTipToSisFinz = useCallback(
    async (params: {
      job: LaborJob;
      amount: number;
      date: string;
      accountId?: string;
      note?: string;
    }): Promise<LaborTipEntry> => {
      const { job, amount, date, accountId, note } = params;
      const now = new Date().toISOString();
      const targetMonth = date.slice(0, 7) || getCurrentMonthStr();
      const dayOfMonth = Math.max(1, Math.min(31, Number(date.slice(8, 10)) || new Date().getDate()));
      const selectedAcc = accounts.find((a) => a.id === accountId);
      const incomeId = `inc_tip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      let syncedToFinance = false;

      if (userId && amount > 0) {
        try {
          // 1. Atomically credit the chosen account balance
          if (selectedAcc) {
            const accDocRef = doc(db, 'users', userId, 'accounts', selectedAcc.id);
            await runTransaction(db, async (transaction) => {
              const snap = await transaction.get(accDocRef);
              if (!snap.exists()) return;
              const data = snap.data();
              const current = Number(data.currentBalance ?? data.balance ?? data.initialBalance ?? 0) || 0;
              transaction.set(
                accDocRef,
                { currentBalance: current + amount, updatedAt: now },
                { merge: true }
              );
            });
          }

          // 2. Create a one-off Income item for the month
          const incomeDoc = {
            id: incomeId,
            name: note ? `Propina • ${job.companyName} (${note})` : `Propina • ${job.companyName}`,
            amount,
            currency: (selectedAcc?.currency || job.currency) as CurrencyCode,
            category: 'Propina',
            expectedDay: dayOfMonth,
            startMonth: targetMonth,
            recurrence: 'none',
            accountId: selectedAcc?.id || undefined,
            notes: note || `Registrado via Jornada Laboral (${job.role})`,
            createdAt: now,
            updatedAt: now,
          };

          await setDoc(
            doc(db, 'users', userId, 'incomes', incomeId),
            sanitizePayload(incomeDoc),
            { merge: true }
          );

          // 3. Mark that income as already received in monthly_status
          const statusId = `${targetMonth}_income_${incomeId}`;
          await setDoc(
            doc(db, 'users', userId, 'monthly_status', statusId),
            sanitizePayload({
              id: statusId,
              month: targetMonth,
              itemId: incomeId,
              itemType: 'income',
              status: 'received',
              completedAt: now,
              accountId: selectedAcc?.id || undefined,
              amount,
            }),
            { merge: true }
          );

          syncedToFinance = true;
        } catch (err) {
          console.warn('[LaborAgenda] Tip finance sync warning:', err);
        }
      }

      const tipEntry: LaborTipEntry = {
        id: `tip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        date,
        amount,
        currency: (selectedAcc?.currency || job.currency) as CurrencyCode,
        accountId: selectedAcc?.id,
        accountName: selectedAcc?.name,
        syncedToFinance,
        linkedIncomeId: syncedToFinance ? incomeId : undefined,
        note,
        createdAt: now,
      };

      await saveJob({
        ...job,
        tips: [tipEntry, ...(job.tips || [])],
      });

      return tipEntry;
    },
    [userId, accounts, saveJob]
  );

  /**
   * Sync the calculated monthly salary to a recurring Income item in SisFinz.
   * Supports updating only the selected month (via exceptions) or from that month onward.
   */
  const syncSalaryToSisFinz = useCallback(
    async (params: {
      job: LaborJob;
      targetMonth: string;
      amount: number;
      scope: 'single' | 'future';
    }): Promise<boolean> => {
      if (!userId || params.amount <= 0) return false;
      const { job, targetMonth, amount, scope } = params;
      const now = new Date().toISOString();
      const incomeId = job.linkedSalaryIncomeId || `inc_salary_${job.id}`;

      try {
        const incomeRef = doc(db, 'users', userId, 'incomes', incomeId);
        if (scope === 'single' && job.linkedSalaryIncomeId) {
          await setDoc(
            incomeRef,
            sanitizePayload({
              exceptions: {
                [targetMonth]: { amount },
              },
              updatedAt: now,
            }),
            { merge: true }
          );
        } else {
          await setDoc(
            incomeRef,
            sanitizePayload({
              id: incomeId,
              name: `Salário • ${job.companyName}`,
              amount,
              currency: job.currency,
              category: 'Salário',
              expectedDay: 5,
              startMonth: targetMonth,
              recurrence: 'monthly',
              accountId: job.defaultAccountId || undefined,
              notes: `${job.role} • Sincronizado pela Jornada Laboral`,
              createdAt: now,
              updatedAt: now,
            }),
            { merge: true }
          );
        }

        if (job.linkedSalaryIncomeId !== incomeId) {
          await saveJob({ ...job, linkedSalaryIncomeId: incomeId });
        }
        return true;
      } catch (err) {
        console.warn('[LaborAgenda] Salary sync failed:', err);
        return false;
      }
    },
    [userId, saveJob]
  );

  return {
    jobs,
    accounts,
    isLoading,
    saveJob,
    deleteJob,
    recordTipToSisFinz,
    syncSalaryToSisFinz,
  };
}
