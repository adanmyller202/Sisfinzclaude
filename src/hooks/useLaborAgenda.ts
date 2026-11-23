import { useCallback, useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  runTransaction,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useAccounts } from './useAccounts';
import { CurrencyCode } from '../types';
import { LaborJob, LaborTipEntry } from '../types/labor';
import { calculateMonthSalary } from '../utils/laborCalculations';
import { formatCurrency } from '../utils/currency';

const LOCAL_JOBS_PREFIX = 'sisfinz_labor_jobs_v1_';

function sanitizePayload<T extends Record<string, any>>(obj: T): Record<string, any> {
  return JSON.parse(JSON.stringify(obj));
}

function formatSafeDate(dateStr?: string): string {
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildSalaryBreakdownData(job: LaborJob, targetMonth: string) {
  const calc = calculateMonthSalary(job, targetMonth);
  const activeBenefits = calc.benefits.filter((b) => b.enabled);

  const lines: string[] = [
    `Salário Básico: ${formatCurrency(calc.baseSalary, job.currency)}`,
  ];
  for (const b of activeBenefits) {
    const pct = b.type === 'percent' ? ` (${b.rawValue}%)` : '';
    const sign = b.isDeduction ? '-' : '+';
    lines.push(`${b.name}${pct}: ${sign}${formatCurrency(b.calculatedAmount, job.currency)}`);
  }
  if (calc.extraAmount > 0) {
    lines.push(`Extras do mês: +${formatCurrency(calc.extraAmount, job.currency)}`);
  }
  if (calc.separatelyReceivedTotal > 0) {
    lines.push(
      `Já recebido separadamente: -${formatCurrency(calc.separatelyReceivedTotal, job.currency)}`
    );
  }

  return {
    calc,
    notes: `${job.role} • ${lines.join(' | ')}`,
    breakdown: {
      jobId: job.id,
      companyName: job.companyName,
      role: job.role,
      currency: job.currency,
      month: targetMonth,
      baseSalary: calc.baseSalary,
      benefits: activeBenefits.map((b) => ({
        id: b.id,
        name: b.name,
        type: b.type,
        rawValue: b.rawValue,
        calculatedAmount: b.calculatedAmount,
        isDeduction: Boolean(b.isDeduction),
      })),
      extraAmount: calc.extraAmount,
      netTotal: calc.netTotal,
      separatelyReceivedTotal: calc.separatelyReceivedTotal,
      remainingToReceive: calc.remainingToReceive,
    },
  };
}

export function useLaborAgenda() {
  const { user } = useAuth();
  const userId = user?.uid;
  const { accounts, refreshAccounts } = useAccounts();
  const [jobs, setJobs] = useState<LaborJob[]>([]);
  const [loading, setLoading] = useState(true);

  const getLocalKey = useCallback(
    (uid?: string) => `${LOCAL_JOBS_PREFIX}${uid || 'guest'}`,
    []
  );

  // Load initial cache immediately (even before auth resolves) so UI feels instant
  useEffect(() => {
    try {
      const uid = userId || auth.currentUser?.uid;
      const raw =
        localStorage.getItem(getLocalKey(uid)) ||
        localStorage.getItem(`${LOCAL_JOBS_PREFIX}guest`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setJobs(parsed);
        }
      }
    } catch {
      // ignore storage read error
    } finally {
      setLoading(false);
    }
  }, [userId, getLocalKey]);

  // Real-time Firestore listener for logged-in user
  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    const colRef = collection(db, 'users', userId, 'labor_jobs');
    const unsub = onSnapshot(
      colRef,
      (snap) => {
        const list: LaborJob[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...(d.data() as Omit<LaborJob, 'id'>) });
        });
        list.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
        setJobs(list);
        try {
          localStorage.setItem(getLocalKey(userId), JSON.stringify(list));
        } catch {
          // ignore
        }
        setLoading(false);
      },
      (err) => {
        console.warn('[useLaborAgenda] snapshot fallback:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [userId, getLocalKey]);

  const persistJobsLocally = useCallback(
    (nextJobs: LaborJob[]) => {
      setJobs(nextJobs);
      try {
        const uid = userId || auth.currentUser?.uid;
        localStorage.setItem(getLocalKey(uid), JSON.stringify(nextJobs));
      } catch {
        // ignore
      }
    },
    [userId, getLocalKey]
  );

  const saveJob = useCallback(
    async (updatedJob: LaborJob): Promise<void> => {
      const stamped: LaborJob = {
        ...updatedJob,
        updatedAt: new Date().toISOString(),
      };

      const exists = jobs.some((j) => j.id === stamped.id);
      const nextList = exists
        ? jobs.map((j) => (j.id === stamped.id ? stamped : j))
        : [...jobs, stamped];
      persistJobsLocally(nextList);

      const uid = userId || auth.currentUser?.uid;
      if (uid) {
        const ref = doc(db, 'users', uid, 'labor_jobs', stamped.id);
        await setDoc(ref, sanitizePayload(stamped), { merge: true });
      }
    },
    [jobs, persistJobsLocally, userId]
  );

  const deleteJob = useCallback(
    async (jobId: string): Promise<void> => {
      const nextList = jobs.filter((j) => j.id !== jobId);
      persistJobsLocally(nextList);

      const uid = userId || auth.currentUser?.uid;
      if (uid) {
        await deleteDoc(doc(db, 'users', uid, 'labor_jobs', jobId));
      }
    },
    [jobs, persistJobsLocally, userId]
  );

  /**
   * Register a tip (propina) and immediately add it to the selected SisFinz account balance
   * + create a synced income record so the home balance & ledger stay 100% consistent.
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
      const safeDate = formatSafeDate(date);
      const targetMonth = safeDate.slice(0, 7) || '2026-11';
      const dayOfMonth = Math.max(1, Math.min(31, Number(safeDate.slice(8, 10)) || new Date().getDate()));
      const selectedAcc = accounts.find((a) => a.id === accountId);
      const incomeId = `inc_tip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      let syncedToFinance = false;

      const uid = userId || auth.currentUser?.uid;
      if (uid) {
        try {
          if (selectedAcc) {
            const currentBal = Number(selectedAcc.currentBalance ?? selectedAcc.initialBalance ?? 0);
            const nextBal = currentBal + amount;
            await updateDoc(doc(db, 'users', uid, 'accounts', selectedAcc.id), {
              currentBalance: nextBal,
              updatedAt: now,
            });
          }

          const incomeDoc = {
            id: incomeId,
            name: note ? `Propina • ${job.companyName} (${note})` : `Propina • ${job.companyName}`,
            amount,
            currency: (selectedAcc?.currency || job.currency) as CurrencyCode,
            category: 'Propina',
            expectedDay: dayOfMonth,
            expectedDate: safeDate,
            startMonth: targetMonth,
            recurrence: 'none',
            accountId: selectedAcc?.id || undefined,
            notes: note || `Propina registrada em ${job.companyName} (${job.role})`,
            createdAt: now,
            updatedAt: now,
          };
          await setDoc(
            doc(db, 'users', uid, 'incomes', incomeId),
            sanitizePayload(incomeDoc)
          );

          const statusId = `income_${incomeId}_${targetMonth}`;
          await setDoc(
            doc(db, 'users', uid, 'monthly_status', statusId),
            sanitizePayload({
              id: statusId,
              month: targetMonth,
              itemId: incomeId,
              itemType: 'income',
              isCompleted: true,
              status: 'received',
              completedAt: now,
              accountId: selectedAcc?.id || undefined,
              amount,
            }),
            { merge: true }
          );

          syncedToFinance = true;
          await refreshAccounts();
        } catch (err) {
          console.warn('[useLaborAgenda] tip finance sync fallback:', err);
        }
      }

      const tipEntry: LaborTipEntry = {
        id: `tip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        date: safeDate,
        amount,
        currency: (selectedAcc?.currency || job.currency) as CurrencyCode,
        accountId: selectedAcc?.id,
        accountName: selectedAcc?.name,
        syncedToFinance,
        linkedIncomeId: syncedToFinance ? incomeId : undefined,
        note,
        createdAt: now,
      };

      const updatedJob: LaborJob = {
        ...job,
        tips: [tipEntry, ...(job.tips || [])],
      };
      await saveJob(updatedJob);

      return tipEntry;
    },
    [accounts, refreshAccounts, saveJob, userId]
  );

  /**
   * Sync the calculated monthly salary AND its full composition to SisFinz.
   * Always deducts any items already received separately in `targetMonth`
   * (`calc.remainingToReceive`) so editing salary never re-adds already-received items.
   */
  const syncSalaryToSisFinz = useCallback(
    async (params: {
      job: LaborJob;
      targetMonth: string;
      amount: number;
      scope: 'single' | 'future';
    }): Promise<boolean> => {
      const uid = userId || auth.currentUser?.uid;
      if (!uid || params.amount <= 0) return false;
      const { job, targetMonth, amount, scope } = params;
      const safeMonth = /^\d{4}-\d{2}$/.test(targetMonth) ? targetMonth : '2026-11';
      const expectedDate = `${safeMonth}-05`;
      const now = new Date().toISOString();
      const incomeId = job.linkedSalaryIncomeId || `inc_salary_${job.id}`;
      const { calc, notes: compositionNotes, breakdown } = buildSalaryBreakdownData(job, safeMonth);
      const effectiveMonthAmount =
        calc.separatelyReceivedTotal > 0 ? calc.remainingToReceive : amount;

      try {
        const incomeRef = doc(db, 'users', uid, 'incomes', incomeId);
        if (scope === 'single') {
          await setDoc(
            incomeRef,
            sanitizePayload({
              id: incomeId,
              laborJobId: job.id,
              name: `Salário • ${job.companyName}`,
              currency: job.currency,
              category: 'Salário',
              expectedDay: 5,
              expectedDate,
              recurrence: 'monthly',
              accountId: job.defaultAccountId || undefined,
              exceptions: {
                [safeMonth]: { amount: effectiveMonthAmount, notes: compositionNotes },
              },
              salaryBreakdowns: {
                [safeMonth]: breakdown,
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
              laborJobId: job.id,
              name: `Salário • ${job.companyName}`,
              amount,
              currency: job.currency,
              category: 'Salário',
              expectedDay: 5,
              expectedDate,
              startMonth: safeMonth,
              recurrence: 'monthly',
              accountId: job.defaultAccountId || undefined,
              notes: compositionNotes,
              ...(calc.separatelyReceivedTotal > 0
                ? {
                    exceptions: {
                      [safeMonth]: { amount: effectiveMonthAmount, notes: compositionNotes },
                    },
                  }
                : {}),
              salaryBreakdown: breakdown,
              salaryBreakdowns: {
                [safeMonth]: breakdown,
              },
              updatedAt: now,
            }),
            { merge: true }
          );
        }

        if (!job.linkedSalaryIncomeId) {
          await saveJob({ ...job, linkedSalaryIncomeId: incomeId });
        }
        return true;
      } catch (err) {
        console.warn('[useLaborAgenda] salary sync warning:', err);
        return false;
      }
    },
    [saveJob, userId]
  );

  /**
   * Registers a salary advance as a one-time SisFinz income.
   * A received-today advance updates the selected account and its monthly status
   * in one Firestore transaction; a scheduled advance stays pending.
   */
  const registerSalaryAdvanceIncome = useCallback(
    async (params: {
      id: string;
      job: LaborJob;
      amount: number;
      reason: string;
      creditNow: boolean;
      depositDate: string;
      accountId?: string;
    }): Promise<boolean> => {
      const { id, job, amount, reason, creditNow, depositDate, accountId } = params;
      const uid = userId || auth.currentUser?.uid;
      const cleanReason = reason.trim();
      if (!uid || !id || amount <= 0 || !cleanReason) return false;

      const safeDate = formatSafeDate(depositDate);
      const targetMonth = safeDate.slice(0, 7);
      const now = new Date().toISOString();
      const selectedAcc = accounts.find((a) => a.id === accountId);
      const incomeRef = doc(db, 'users', uid, 'incomes', id);
      const statusId = `income_${id}_${targetMonth}`;
      const statusRef = doc(db, 'users', uid, 'monthly_status', statusId);
      const accountRef =
        creditNow && selectedAcc
          ? doc(db, 'users', uid, 'accounts', selectedAcc.id)
          : null;

      try {
        await runTransaction(db, async (transaction) => {
          const existingIncome = await transaction.get(incomeRef);
          if (existingIncome.exists()) return;

          let nextBalance: number | null = null;
          if (accountRef && selectedAcc) {
            const accountSnap = await transaction.get(accountRef);
            if (!accountSnap.exists()) {
              throw new Error('A conta selecionada não foi encontrada.');
            }
            const accountData = accountSnap.data();
            const currentBalance = Number(
              accountData.currentBalance ?? accountData.initialBalance ?? 0
            );
            nextBalance = currentBalance + amount;
          }

          const incomeDoc = {
            id,
            laborJobId: job.id,
            name: `Antecipação de Salário • ${job.companyName}`,
            amount,
            currency: (selectedAcc?.currency || job.currency) as CurrencyCode,
            category: 'Salário',
            expectedDay: Number(safeDate.slice(8, 10)) || 1,
            expectedDate: safeDate,
            startMonth: targetMonth,
            recurrence: 'none',
            accountId: selectedAcc?.id || undefined,
            notes: `Motivo: ${cleanReason} | Cargo: ${job.role}`,
            createdAt: now,
            updatedAt: now,
          };

          transaction.set(incomeRef, sanitizePayload(incomeDoc));
          transaction.set(
            statusRef,
            sanitizePayload({
              id: statusId,
              itemId: id,
              itemType: 'income',
              month: targetMonth,
              status: creditNow ? 'received' : 'pending',
              isCompleted: creditNow,
              ...(creditNow ? { completedAt: now, paidDate: safeDate } : {}),
              accountId: selectedAcc?.id || undefined,
              amount,
              expectedDate: safeDate,
              updatedAt: now,
            }),
            { merge: true }
          );

          if (accountRef && nextBalance !== null) {
            transaction.update(accountRef, {
              currentBalance: nextBalance,
              updatedAt: now,
            });
          }
        });

        if (creditNow && selectedAcc) await refreshAccounts();
        return true;
      } catch (err) {
        console.error('[useLaborAgenda] salary advance income sync failed:', err);
        return false;
      }
    },
    [accounts, refreshAccounts, userId]
  );

  return {
    jobs,
    accounts,
    loading,
    saveJob,
    deleteJob,
    recordTipToSisFinz,
    syncSalaryToSisFinz,
    registerSalaryAdvanceIncome,
  };
}
