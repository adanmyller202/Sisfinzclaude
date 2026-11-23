import { deleteDoc, doc, runTransaction, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { AccountItem, CurrencyCode } from '../types';
import {
  BenefitCalcType,
  LaborBenefit,
  LaborJob,
  ReceivedSalaryItemEntry,
  ReceivedSalaryItemTranche,
} from '../types/labor';
import {
  calculateMonthSalary,
  formatLocalDateYYYYMMDD,
  getEffectiveSalarySnapshot,
  getMonthReceivedItemsMap,
} from './laborCalculations';
import { formatCurrency } from './currency';
import { getCurrentMonthStr, shiftMonthStr } from './finance';

const LOCAL_JOBS_PREFIX = 'sisfinz_labor_jobs_v1_';
const PARTIAL_STORE_KEY = 'sisfinz_partial_income_state_v1';
const BADGE_CLASS = 'sisfinz-salary-breakdown-chip';
const OVERLAY_ID = 'sisfinz-salary-breakdown-overlay';
const EDITOR_OVERLAY_ID = 'sisfinz-salary-editor-overlay';
const ITEM_RECEIVE_OVERLAY_ID = 'sisfinz-item-receive-overlay';

const TRASH_ICON_SVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>`;

const MONTH_NAME_MAP: Record<string, number> = {
  jan: 1, janeiro: 1, enero: 1, january: 1,
  fev: 2, fevereiro: 2, feb: 2, febrero: 2, february: 2,
  mar: 3, marco: 3, março: 3, marzo: 3, march: 3,
  abr: 4, abril: 4, apr: 4, april: 4,
  mai: 5, maio: 5, may: 5, mayo: 5,
  jun: 6, junho: 6, junio: 6, june: 6,
  jul: 7, julho: 7, julio: 7, july: 7,
  ago: 8, agosto: 8, aug: 8, august: 8,
  set: 9, setembro: 9, sep: 9, sept: 9, septiembre: 9, september: 9,
  out: 10, outubro: 10, oct: 10, octubre: 10, october: 10,
  nov: 11, novembro: 11, noviembre: 11, november: 11,
  dez: 12, dezembro: 12, dic: 12, diciembre: 12, dec: 12, december: 12,
};

function sanitizePayload<T extends Record<string, any>>(obj: T): Record<string, any> {
  return JSON.parse(JSON.stringify(obj));
}

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getJobsStorageKey(): string {
  const uid = auth.currentUser?.uid;
  return `${LOCAL_JOBS_PREFIX}${uid || 'guest'}`;
}

function loadCachedLaborJobs(): LaborJob[] {
  const uid = auth.currentUser?.uid;
  const candidateKeys: string[] = [];
  if (uid) candidateKeys.push(`${LOCAL_JOBS_PREFIX}${uid}`);
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(LOCAL_JOBS_PREFIX) && !candidateKeys.includes(k)) {
        candidateKeys.push(k);
      }
    }
    for (const key of candidateKeys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as LaborJob[];
      }
    }
  } catch {
    // ignore storage errors
  }
  return [];
}

function loadCachedAccounts(): AccountItem[] {
  const uid = auth.currentUser?.uid;
  try {
    const raw =
      (uid ? localStorage.getItem(`mc_acc_${uid}_accounts`) : null) ||
      localStorage.getItem('mc_acc_last_accounts');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((a: AccountItem) => a && a.isActive !== false);
      }
    }
  } catch {
    // ignore
  }
  return [];
}

function normalizeItemTranches(entry?: ReceivedSalaryItemEntry): ReceivedSalaryItemTranche[] {
  if (!entry) return [];
  if (Array.isArray(entry.tranches) && entry.tranches.length > 0) {
    return entry.tranches;
  }
  if (entry.amount > 0) {
    return [
      {
        id: entry.linkedIncomeId || `tr_${entry.itemId}_1`,
        amount: entry.amount,
        linkedIncomeId: entry.linkedIncomeId,
        creditNow: entry.creditNow,
        depositDate: entry.depositDate,
        accountId: entry.accountId,
        accountName: entry.accountName,
        receivedAt: entry.receivedAt,
      },
    ];
  }
  return [];
}

function savePartialIndicatorLocally(params: {
  incomeId: string;
  incomeName: string;
  month: string;
  originalAmount: number;
  receivedSoFar: number;
  remainingAmount: number;
  currency: CurrencyCode;
}) {
  try {
    const raw = localStorage.getItem(PARTIAL_STORE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    const key = `${params.month}::${params.incomeId}`;
    if (params.receivedSoFar > 0 && params.remainingAmount > 0) {
      map[key] = {
        incomeId: params.incomeId,
        incomeName: params.incomeName,
        month: params.month,
        originalAmount: params.originalAmount,
        receivedSoFar: params.receivedSoFar,
        remainingAmount: params.remainingAmount,
        installmentCount: 1,
        currency: params.currency,
        updatedAt: new Date().toISOString(),
      };
    } else {
      delete map[key];
    }
    localStorage.setItem(PARTIAL_STORE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

async function persistUpdatedJobAndSyncIncome(params: {
  updatedJob: LaborJob;
  targetMonth: string;
  scope: 'single' | 'future';
  syncWithFinance: boolean;
}): Promise<LaborJob> {
  const { updatedJob, targetMonth, scope, syncWithFinance } = params;
  const now = new Date().toISOString();
  const stamped: LaborJob = { ...updatedJob, updatedAt: now };

  const existing = loadCachedLaborJobs();
  const nextList = existing.some((j) => j.id === stamped.id)
    ? existing.map((j) => (j.id === stamped.id ? stamped : j))
    : [...existing, stamped];
  try {
    localStorage.setItem(getJobsStorageKey(), JSON.stringify(nextList));
  } catch {
    // ignore
  }

  const uid = auth.currentUser?.uid;
  if (uid) {
    await setDoc(
      doc(db, 'users', uid, 'labor_jobs', stamped.id),
      sanitizePayload(stamped),
      { merge: true }
    );

    const calc = calculateMonthSalary(stamped, targetMonth);
    if (syncWithFinance && calc.netTotal > 0) {
      const activeBenefits = calc.benefits.filter((b) => b.enabled);
      const lines: string[] = [
        `Salário Básico: ${formatCurrency(calc.baseSalary, stamped.currency)}`,
      ];
      for (const b of activeBenefits) {
        const pct = b.type === 'percent' ? ` (${b.rawValue}%)` : '';
        const sign = b.isDeduction ? '-' : '+';
        lines.push(`${b.name}${pct}: ${sign}${formatCurrency(b.calculatedAmount, stamped.currency)}`);
      }
      if (calc.extraAmount > 0) {
        lines.push(`Extras do mês: +${formatCurrency(calc.extraAmount, stamped.currency)}`);
      }
      if (calc.separatelyReceivedTotal > 0) {
        lines.push(
          `Já recebido separadamente: -${formatCurrency(calc.separatelyReceivedTotal, stamped.currency)}`
        );
      }

      const compositionNotes = `${stamped.role} • ${lines.join(' | ')}`;
      const breakdown = {
        jobId: stamped.id,
        companyName: stamped.companyName,
        role: stamped.role,
        currency: stamped.currency,
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
      };

      const incomeId = stamped.linkedSalaryIncomeId || `inc_salary_${stamped.id}`;
      const expectedDate = `${targetMonth}-05`;
      const incomeRef = doc(db, 'users', uid, 'incomes', incomeId);
      const partialObj =
        calc.separatelyReceivedTotal > 0 && calc.remainingToReceive > 0
          ? {
              originalAmount: calc.netTotal,
              receivedSoFar: calc.separatelyReceivedTotal,
              remainingAmount: calc.remainingToReceive,
              updatedAt: now,
            }
          : null;

      if (scope === 'single') {
        await setDoc(
          incomeRef,
          sanitizePayload({
            id: incomeId,
            laborJobId: stamped.id,
            name: `Salário • ${stamped.companyName}`,
            currency: stamped.currency,
            category: 'Salário',
            expectedDay: 5,
            expectedDate,
            recurrence: 'monthly',
            accountId: stamped.defaultAccountId || undefined,
            exceptions: {
              [targetMonth]: { amount: calc.remainingToReceive, notes: compositionNotes },
            },
            partialPending: {
              [targetMonth]: partialObj,
            },
            salaryBreakdowns: {
              [targetMonth]: breakdown,
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
            laborJobId: stamped.id,
            name: `Salário • ${stamped.companyName}`,
            amount: calc.netTotal,
            currency: stamped.currency,
            category: 'Salário',
            expectedDay: 5,
            expectedDate,
            startMonth: targetMonth,
            recurrence: 'monthly',
            accountId: stamped.defaultAccountId || undefined,
            notes: compositionNotes,
            ...(calc.separatelyReceivedTotal > 0
              ? {
                  exceptions: {
                    [targetMonth]: { amount: calc.remainingToReceive, notes: compositionNotes },
                  },
                }
              : {}),
            partialPending: {
              [targetMonth]: partialObj,
            },
            salaryBreakdown: breakdown,
            salaryBreakdowns: {
              [targetMonth]: breakdown,
            },
            updatedAt: now,
          }),
          { merge: true }
        );
      }

      if (calc.separatelyReceivedTotal > 0 && calc.remainingToReceive <= 0) {
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
            amount: 0,
          }),
          { merge: true }
        );
      }

      savePartialIndicatorLocally({
        incomeId,
        incomeName: `Salário • ${stamped.companyName}`,
        month: targetMonth,
        originalAmount: calc.netTotal,
        receivedSoFar: calc.separatelyReceivedTotal,
        remainingAmount: calc.remainingToReceive,
        currency: stamped.currency,
      });
    }
  }

  return stamped;
}

/**
 * Mark an individual salary composition item (full OR partial tranche) as received immediately
 * OR scheduled for a future date:
 * - Creates a separate one-time income (atomically crediting the account if immediate, idempotent).
 * - Appends the tranche to `job.monthOverrides[salaryMonth].receivedItems[itemId]`.
 * - Deducts the exact cumulative received/scheduled amount from the month's main salary
 *   (`remainingToReceive`) so there is ZERO duplication.
 */
async function markCompositionItemTranche(params: {
  job: LaborJob;
  salaryMonth: string;
  itemId: string;
  itemName: string;
  fullItemAmount: number;
  trancheAmount: number;
  creditNow: boolean;
  depositDate: string;
  accountId?: string;
}): Promise<LaborJob> {
  const {
    job,
    salaryMonth,
    itemId,
    itemName,
    fullItemAmount,
    trancheAmount,
    creditNow,
    depositDate,
    accountId,
  } = params;

  const uid = auth.currentUser?.uid;
  const now = new Date().toISOString();
  const safeDate =
    depositDate && /^\d{4}-\d{2}-\d{2}$/.test(depositDate)
      ? depositDate
      : formatLocalDateYYYYMMDD(new Date());
  const depositMonth = safeDate.slice(0, 7);
  const depositDay = Math.max(1, Math.min(31, Number(safeDate.slice(8, 10)) || 1));
  const accounts = loadCachedAccounts();
  const selectedAcc = accounts.find((a) => a.id === accountId) || accounts[0];
  const effectiveCurrency = (selectedAcc?.currency || job.currency) as CurrencyCode;

  const prevReceivedMap = getMonthReceivedItemsMap(job, salaryMonth);
  const existingEntry = prevReceivedMap[itemId];
  const prevTranches = normalizeItemTranches(existingEntry);
  const trancheIndex = prevTranches.length + 1;
  const prevCumulative = prevTranches.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const newCumulative = Math.round((prevCumulative + trancheAmount) * 100) / 100;
  const isPartialOfItem = newCumulative < fullItemAmount || prevTranches.length > 0;

  const safeItemSlug = itemId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const linkedIncomeId = `inc_salitem_${job.id}_${salaryMonth}_${safeItemSlug}_t${trancheIndex}`;
  const incomeTitle = isPartialOfItem
    ? `${itemName} (Parcial ${trancheIndex}) • ${job.companyName}`
    : `${itemName} • ${job.companyName}`;

  if (uid && trancheAmount > 0) {
    const incomeRef = doc(db, 'users', uid, 'incomes', linkedIncomeId);
    const statusId = `income_${linkedIncomeId}_${depositMonth}`;
    const statusRef = doc(db, 'users', uid, 'monthly_status', statusId);
    const accountRef =
      creditNow && selectedAcc ? doc(db, 'users', uid, 'accounts', selectedAcc.id) : null;

    await runTransaction(db, async (transaction) => {
      const existingInc = await transaction.get(incomeRef);
      if (existingInc.exists()) return;

      let nextBal: number | null = null;
      if (accountRef && selectedAcc) {
        const accSnap = await transaction.get(accountRef);
        if (accSnap.exists()) {
          const data = accSnap.data();
          const cur = Number(data.currentBalance ?? data.initialBalance ?? 0);
          nextBal = Math.round((cur + trancheAmount) * 100) / 100;
        }
      }

      const monthRefLabel = formatMonthLabel(salaryMonth);
      const itemRem = Math.max(0, Math.round((fullItemAmount - newCumulative) * 100) / 100);
      const noteText =
        itemRem > 0
          ? `Recebimento parcial (${trancheIndex}ª parte) de ${itemName} (${monthRefLabel}) • Resta do item: ${formatCurrency(
              itemRem,
              effectiveCurrency
            )}`
          : `Item da composição salarial (${monthRefLabel}) recebido separadamente`;

      transaction.set(
        incomeRef,
        sanitizePayload({
          id: linkedIncomeId,
          laborJobId: job.id,
          parentSalaryIncomeId: job.linkedSalaryIncomeId || `inc_salary_${job.id}`,
          salaryItemId: itemId,
          salaryRefMonth: salaryMonth,
          name: incomeTitle,
          amount: trancheAmount,
          currency: effectiveCurrency,
          category: 'Salário',
          expectedDay: depositDay,
          expectedDate: safeDate,
          startMonth: depositMonth,
          recurrence: 'none',
          accountId: selectedAcc?.id || undefined,
          notes: noteText,
          createdAt: now,
          updatedAt: now,
        })
      );

      transaction.set(
        statusRef,
        sanitizePayload({
          id: statusId,
          itemId: linkedIncomeId,
          itemType: 'income',
          month: depositMonth,
          status: creditNow ? 'received' : 'pending',
          isCompleted: creditNow,
          ...(creditNow ? { completedAt: now, paidDate: safeDate } : {}),
          accountId: selectedAcc?.id || undefined,
          amount: trancheAmount,
          expectedDate: safeDate,
          updatedAt: now,
        }),
        { merge: true }
      );

      if (accountRef && nextBal !== null) {
        transaction.update(accountRef, {
          currentBalance: nextBal,
          updatedAt: now,
        });
      }
    });

    if (creditNow && selectedAcc) {
      try {
        const updatedAccs = accounts.map((a) =>
          a.id === selectedAcc.id
            ? {
                ...a,
                currentBalance:
                  Math.round(
                    ((Number(a.currentBalance ?? a.initialBalance ?? 0) || 0) + trancheAmount) *
                      100
                  ) / 100,
                updatedAt: now,
              }
            : a
        );
        localStorage.setItem(`mc_acc_${uid}_accounts`, JSON.stringify(updatedAccs));
        localStorage.setItem('mc_acc_last_accounts', JSON.stringify(updatedAccs));
      } catch {
        // ignore
      }
    }
  }

  const newTranche: ReceivedSalaryItemTranche = {
    id: linkedIncomeId,
    amount: trancheAmount,
    linkedIncomeId,
    creditNow,
    depositDate: safeDate,
    accountId: selectedAcc?.id,
    accountName: selectedAcc?.name,
    receivedAt: now,
  };

  const nextTranches = [...prevTranches, newTranche];
  const newEntry: ReceivedSalaryItemEntry = {
    itemId,
    itemName,
    amount: newCumulative,
    linkedIncomeId,
    creditNow,
    depositDate: safeDate,
    accountId: selectedAcc?.id,
    accountName: selectedAcc?.name,
    receivedAt: now,
    tranches: nextTranches,
  };

  const prevMonthOv = job.monthOverrides?.[salaryMonth] || {};
  const updatedJob: LaborJob = {
    ...job,
    monthOverrides: {
      ...(job.monthOverrides || {}),
      [salaryMonth]: {
        ...prevMonthOv,
        receivedItems: {
          ...prevReceivedMap,
          [itemId]: newEntry,
        },
      },
    },
  };

  return await persistUpdatedJobAndSyncIncome({
    updatedJob,
    targetMonth: salaryMonth,
    scope: 'single',
    syncWithFinance: true,
  });
}

/**
 * Undo a specific tranche of a separately-received composition item:
 * - Reverses account balance if that tranche had already been credited.
 * - Deletes the linked one-time income and its monthly status.
 * - Updates (or deletes) `receivedItems[itemId]` and restores the main salary's pending balance.
 */
async function undoCompositionItemTranche(params: {
  job: LaborJob;
  salaryMonth: string;
  itemId: string;
  tranche: ReceivedSalaryItemTranche;
}): Promise<LaborJob> {
  const { job, salaryMonth, itemId, tranche } = params;
  const uid = auth.currentUser?.uid;
  const now = new Date().toISOString();
  const depositMonth = (tranche.depositDate || '').slice(0, 7) || salaryMonth;

  if (uid && tranche.linkedIncomeId) {
    const incomeRef = doc(db, 'users', uid, 'incomes', tranche.linkedIncomeId);
    const statusId = `income_${tranche.linkedIncomeId}_${depositMonth}`;
    const statusRef = doc(db, 'users', uid, 'monthly_status', statusId);
    const accountRef =
      tranche.creditNow && tranche.accountId
        ? doc(db, 'users', uid, 'accounts', tranche.accountId)
        : null;

    try {
      await runTransaction(db, async (transaction) => {
        const incSnap = await transaction.get(incomeRef);
        const statusSnap = await transaction.get(statusRef);
        const wasCredited = Boolean(statusSnap.exists() && statusSnap.data()?.isCompleted);

        if (accountRef && wasCredited && tranche.amount > 0) {
          const accSnap = await transaction.get(accountRef);
          if (accSnap.exists()) {
            const data = accSnap.data();
            const cur = Number(data.currentBalance ?? data.initialBalance ?? 0);
            transaction.update(accountRef, {
              currentBalance: Math.round((cur - tranche.amount) * 100) / 100,
              updatedAt: now,
            });
          }
        }
        if (incSnap.exists()) transaction.delete(incomeRef);
        if (statusSnap.exists()) transaction.delete(statusRef);
      });
    } catch {
      await deleteDoc(incomeRef).catch(() => {});
      await deleteDoc(statusRef).catch(() => {});
    }
  }

  const prevMonthOv = job.monthOverrides?.[salaryMonth] || {};
  const nextReceivedMap = { ...getMonthReceivedItemsMap(job, salaryMonth) };
  const existingEntry = nextReceivedMap[itemId];

  if (existingEntry) {
    const remainingTranches = normalizeItemTranches(existingEntry).filter(
      (t) => t.id !== tranche.id && t.linkedIncomeId !== tranche.linkedIncomeId
    );
    if (remainingTranches.length === 0) {
      delete nextReceivedMap[itemId];
    } else {
      const last = remainingTranches[remainingTranches.length - 1];
      const newSum =
        Math.round(remainingTranches.reduce((s, t) => s + (Number(t.amount) || 0), 0) * 100) /
        100;
      nextReceivedMap[itemId] = {
        ...existingEntry,
        amount: newSum,
        linkedIncomeId: last.linkedIncomeId,
        creditNow: last.creditNow,
        depositDate: last.depositDate,
        accountId: last.accountId,
        accountName: last.accountName,
        receivedAt: last.receivedAt,
        tranches: remainingTranches,
      };
    }
  }

  const updatedJob: LaborJob = {
    ...job,
    monthOverrides: {
      ...(job.monthOverrides || {}),
      [salaryMonth]: {
        ...prevMonthOv,
        receivedItems: nextReceivedMap,
      },
    },
  };

  return await persistUpdatedJobAndSyncIncome({
    updatedJob,
    targetMonth: salaryMonth,
    scope: 'single',
    syncWithFinance: true,
  });
}

function findJobByCompanyName(companyText: string): LaborJob | null {
  const jobs = loadCachedLaborJobs();
  if (!jobs.length) return null;
  const cleanTarget = companyText.trim().toLowerCase();
  return (
    jobs.find((j) => j.companyName.trim().toLowerCase() === cleanTarget) ||
    jobs.find((j) => cleanTarget.includes(j.companyName.trim().toLowerCase())) ||
    jobs[0] ||
    null
  );
}

/** Try to detect the currently selected dashboard month (YYYY-MM) from visible UI text */
function detectActiveDashboardMonth(): string {
  try {
    const candidates = document.querySelectorAll(
      'header, main button, main h2, main span, [aria-current="true"]'
    );
    const regex =
      /\b(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|enero|febrero|marzo|mayo|junio|julio|septiembre|octubre|noviembre|diciembre|january|february|march|april|may|june|july|august|september|october|november|december|jan|fev|feb|mar|abr|apr|mai|jun|jul|ago|aug|set|sep|out|oct|nov|dez|dic|dec)\.?\s*(?:de\s*)?(20\d{2})\b/i;

    for (const el of Array.from(candidates)) {
      if (
        (el as HTMLElement).closest(
          `#${OVERLAY_ID}, #${EDITOR_OVERLAY_ID}, #${ITEM_RECEIVE_OVERLAY_ID}`
        )
      )
        continue;
      const txt = (el.textContent || '').trim();
      if (!txt || txt.length > 42) continue;
      const m = txt.match(regex);
      if (m) {
        const monthNum = MONTH_NAME_MAP[m[1].toLowerCase()];
        const yearNum = Number(m[2]);
        if (monthNum && yearNum >= 2020 && yearNum <= 2099) {
          return `${yearNum}-${String(monthNum).padStart(2, '0')}`;
        }
      }
    }
  } catch {
    // fallback below
  }
  return getCurrentMonthStr();
}

function formatMonthLabel(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number);
  const dt = new Date(y || 2026, (m || 1) - 1, 1);
  return dt.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function formatShortDateBR(yyyyMmDd: string): string {
  if (!yyyyMmDd || !/^\d{4}-\d{2}-\d{2}$/.test(yyyyMmDd)) return yyyyMmDd;
  const [, m, d] = yyyyMmDd.split('-');
  return `${d}/${m}`;
}

function closeItemReceiveOverlay() {
  const existing = document.getElementById(ITEM_RECEIVE_OVERLAY_ID);
  if (existing) existing.remove();
}

function closeEditorOverlay() {
  const existing = document.getElementById(EDITOR_OVERLAY_ID);
  if (existing) existing.remove();
}

function closeBreakdownOverlay() {
  closeItemReceiveOverlay();
  closeEditorOverlay();
  const existing = document.getElementById(OVERLAY_ID);
  if (existing) existing.remove();
}

/**
 * Interactive modal opened when the user taps on an individual item inside Composição Salarial
 * (e.g., Bônus asistencia, Aguinaldo, Turnos Cortados, Salário Básico).
 * Supports BOTH:
 *  - Valor total (remaining balance of this item)
 *  - Valor parcial (e.g. half of Bônus asistencia = $158.000, leaving $158.676 pending)
 * And lets the user credit immediately OR schedule a deposit date — automatically deducting
 * it from the month's pending salary with ZERO duplication.
 */
function openItemSeparateReceiveModal(params: {
  job: LaborJob;
  salaryMonth: string;
  itemId: string;
  itemName: string;
  fullItemAmount: number;
  existingEntry?: ReceivedSalaryItemEntry;
  onUpdated: (updatedJob: LaborJob, toastMsg: string) => void;
}) {
  closeItemReceiveOverlay();

  const { job, salaryMonth, itemId, itemName, fullItemAmount, existingEntry, onUpdated } = params;
  const accounts = loadCachedAccounts();
  const todayStr = formatLocalDateYYYYMMDD(new Date());
  const calc = calculateMonthSalary(job, salaryMonth);

  const tranches = normalizeItemTranches(existingEntry);
  const alreadyReceivedOnItem =
    Math.round(tranches.reduce((s, t) => s + (Number(t.amount) || 0), 0) * 100) / 100;
  const remainingOnItem = Math.max(
    0,
    Math.round((fullItemAmount - alreadyReceivedOnItem) * 100) / 100
  );

  // Step 1 = choose Total vs Partial (when remainingOnItem > 0), Step 2 = configure amount/timing/account
  let step: 'choose' | 'configure' = remainingOnItem > 0 ? 'choose' : 'configure';
  let amountMode: 'total' | 'partial' = 'total';
  let partialInputStr = '';
  let deliveryMode: 'now' | 'schedule' = 'now';
  let depositDate = todayStr;
  let selectedAccountId = job.defaultAccountId || accounts[0]?.id || '';
  let isProcessing = false;

  const modalOverlay = document.createElement('div');
  modalOverlay.id = ITEM_RECEIVE_OVERLAY_ID;
  modalOverlay.setAttribute('role', 'dialog');
  modalOverlay.setAttribute('aria-modal', 'true');
  modalOverlay.style.cssText =
    'position:fixed;inset:0;z-index:10070;display:flex;align-items:flex-end;justify-content:center;padding:0;background:rgba(15,23,42,0.58);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);overflow:hidden;overscroll-behavior:contain;touch-action:none;';

  const card = document.createElement('div');
  card.style.cssText =
    'width:100%;max-width:min(100vw,440px);max-height:90dvh;display:flex;flex-direction:column;overflow:hidden;box-sizing:border-box;background:#ffffff;border-radius:28px 28px 0 0;box-shadow:0 28px 70px rgba(15,23,42,0.34);border:1px solid #a7f3d0;font-family:inherit;';

  if (window.innerWidth >= 640) {
    modalOverlay.style.alignItems = 'center';
    modalOverlay.style.padding = '16px';
    card.style.borderRadius = '28px';
  }

  const renderTranchesHistoryHtml = () => {
    if (tranches.length === 0) return '';
    return `
      <div style="display:flex;flex-direction:column;gap:6px;padding:10px 12px;border-radius:14px;background:#f8fafc;border:1px solid #e2e8f0;">
        <div style="font-size:9.5px;font-weight:900;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;">
          Lançamentos já feitos deste item (${tranches.length})
        </div>
        ${tranches
          .map(
            (t, idx) => `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 8px;border-radius:10px;background:#ffffff;border:1px solid #e2e8f0;font-size:11.5px;">
            <div style="min-width:0;">
              <div style="font-weight:800;color:#0f172a;">
                ${tranches.length > 1 ? `${idx + 1}ª parte • ` : ''}${
              t.creditNow
                ? `✓ Creditado (${formatShortDateBR(t.depositDate)})`
                : `📅 Agendado (${formatShortDateBR(t.depositDate)})`
            }
              </div>
              <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:900;color:#059669;">
                +${escapeHtml(formatCurrency(t.amount, job.currency))}
              </div>
            </div>
            <button type="button" data-undo-tranche="${escapeHtml(t.id)}" ${
              isProcessing ? 'disabled' : ''
            } style="padding:5px 9px;border-radius:8px;border:1px solid #fecdd3;background:#fff1f2;color:#be123c;font-size:10px;font-weight:900;cursor:pointer;flex-shrink:0;">
              Desfazer
            </button>
          </div>
        `
          )
          .join('')}
      </div>
    `;
  };

  const bindUndoTrancheHandlers = () => {
    card.querySelectorAll<HTMLButtonElement>('[data-undo-tranche]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (isProcessing) return;
        const tid = btn.dataset.undoTranche;
        const targetTranche = tranches.find((t) => t.id === tid);
        if (!targetTranche) return;
        isProcessing = true;
        renderModal();
        try {
          const updated = await undoCompositionItemTranche({
            job,
            salaryMonth,
            itemId,
            tranche: targetTranche,
          });
          closeItemReceiveOverlay();
          onUpdated(
            updated,
            `Lançamento de ${formatCurrency(
              targetTranche.amount,
              job.currency
            )} desfeito e devolvido ao salário.`
          );
        } catch {
          isProcessing = false;
          renderModal();
        }
      });
    });
  };

  const renderModal = () => {
    // Case A: 100% of this item has already been received/scheduled separately
    if (remainingOnItem <= 0) {
      card.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;background:linear-gradient(135deg,#059669,#0d9488);color:#ffffff;flex-shrink:0;">
          <div style="min-width:0;">
            <div style="font-size:10px;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:#a7f3d0;">Item 100% Recebido Separadamente</div>
            <div style="font-size:15px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(
              itemName
            )}</div>
          </div>
          <button type="button" data-close-ir style="width:32px;height:32px;border-radius:10px;border:none;background:rgba(255,255,255,0.2);color:#ffffff;font-size:16px;font-weight:900;cursor:pointer;flex-shrink:0;">✕</button>
        </div>

        <div style="padding:18px 20px 22px;display:flex;flex-direction:column;gap:13px;overflow-y:auto;overflow-x:hidden;touch-action:pan-y;box-sizing:border-box;">
          <div style="padding:13px 15px;border-radius:16px;background:#ecfdf5;border:1px solid #a7f3d0;display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <span style="font-size:12px;font-weight:900;color:#065f46;">✓ Total já abatido do salário</span>
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:14px;font-weight:900;color:#059669;">${escapeHtml(
              formatCurrency(alreadyReceivedOnItem, job.currency)
            )}</span>
          </div>

          ${renderTranchesHistoryHtml()}

          <div style="font-size:11px;font-weight:600;color:#64748b;line-height:1.4;">
            Quando você marcar o salário de <strong style="text-transform:capitalize;">${escapeHtml(
              formatMonthLabel(salaryMonth)
            )}</strong> como recebido, este item <strong>não será somado de novo</strong>.
          </div>

          <button type="button" data-close-ir style="width:100%;padding:12px;border-radius:14px;border:none;background:#059669;color:#ffffff;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:0.05em;cursor:pointer;">
            Fechar
          </button>
        </div>
      `;

      card
        .querySelectorAll('[data-close-ir]')
        .forEach((b) => b.addEventListener('click', closeItemReceiveOverlay));
      bindUndoTrancheHandlers();
      return;
    }

    // Case B: Step 1 — Choose Total vs. Partial for this benefit/item
    if (step === 'choose') {
      const hasPriorPartial = alreadyReceivedOnItem > 0;
      const pctDone = Math.min(
        100,
        Math.round((alreadyReceivedOnItem / Math.max(1, fullItemAmount)) * 100)
      );

      const partialProgressHtml = hasPriorPartial
        ? `
          <div style="padding:11px 13px;border-radius:15px;background:#fff7ed;border:1px solid #fdba74;display:flex;flex-direction:column;gap:5px;">
            <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:800;color:#9a3412;">
              <span>⏳ Item parcialmente recebido</span>
              <span>${pctDone}%</span>
            </div>
            <div style="height:6px;border-radius:9999px;background:#ffedd5;overflow:hidden;">
              <div style="height:100%;width:${pctDone}%;background:linear-gradient(90deg,#f59e0b,#10b981);border-radius:9999px;"></div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:10.5px;font-weight:700;color:#c2410c;">
              <span>Já recebido: ${escapeHtml(
                formatCurrency(alreadyReceivedOnItem, job.currency)
              )}</span>
              <span>Resta: ${escapeHtml(formatCurrency(remainingOnItem, job.currency))}</span>
            </div>
          </div>
        `
        : '';

      card.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;background:linear-gradient(135deg,#059669,#0d9488);color:#ffffff;flex-shrink:0;">
          <div style="min-width:0;">
            <div style="font-size:10px;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:#a7f3d0;">Receber Item Separadamente</div>
            <div style="font-size:15px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(
              itemName
            )}</div>
            <div style="font-size:12px;font-weight:800;color:#d1fae5;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;margin-top:2px;">
              Disponível: ${escapeHtml(formatCurrency(remainingOnItem, job.currency))}
            </div>
          </div>
          <button type="button" data-close-ir style="width:32px;height:32px;border-radius:10px;border:none;background:rgba(255,255,255,0.2);color:#ffffff;font-size:16px;font-weight:900;cursor:pointer;flex-shrink:0;">✕</button>
        </div>

        <div style="padding:16px 18px 20px;display:flex;flex-direction:column;gap:12px;overflow-y:auto;overflow-x:hidden;touch-action:pan-y;box-sizing:border-box;">
          ${partialProgressHtml}

          <div style="font-size:12px;font-weight:700;color:#475569;text-align:center;">
            Quanto deste item você recebeu?
          </div>

          <!-- Option 1: Total of this item -->
          <button type="button" data-pick-item-total style="width:100%;text-align:left;padding:14px 15px;border-radius:18px;border:2px solid #a7f3d0;background:linear-gradient(135deg,#ecfdf5 0%,#d1fae5 100%);cursor:pointer;display:flex;align-items:center;gap:12px;box-sizing:border-box;">
            <div style="width:42px;height:42px;border-radius:14px;background:#059669;color:#ffffff;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:900;flex-shrink:0;">✓</div>
            <div style="min-width:0;flex:1;">
              <div style="font-size:13.5px;font-weight:900;color:#064e3b;">
                ${hasPriorPartial ? 'Marcar restante total do item' : 'Marcar como recebido valor total'}
              </div>
              <div style="font-size:11px;font-weight:600;color:#047857;margin-top:2px;">
                Lança ${escapeHtml(
                  formatCurrency(remainingOnItem, job.currency)
                )} inteiros e abate do salário.
              </div>
            </div>
          </button>

          <!-- Option 2: Partial of this item -->
          <button type="button" data-pick-item-partial style="width:100%;text-align:left;padding:14px 15px;border-radius:18px;border:2px solid #fed7aa;background:linear-gradient(135deg,#fffbeb 0%,#ffedd5 100%);cursor:pointer;display:flex;align-items:center;gap:12px;box-sizing:border-box;">
            <div style="width:42px;height:42px;border-radius:14px;background:#ea580c;color:#ffffff;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:900;flex-shrink:0;">⏳</div>
            <div style="min-width:0;flex:1;">
              <div style="font-size:13.5px;font-weight:900;color:#7c2d12;">
                Marcar como recebido valor parcial
              </div>
              <div style="font-size:11px;font-weight:600;color:#c2410c;margin-top:2px;">
                Recebeu só uma parte (ex.: metade)? Informe o valor e mantenha o restante pendente.
              </div>
            </div>
          </button>

          ${renderTranchesHistoryHtml()}

          <button type="button" data-close-ir style="width:100%;padding:11px;border-radius:14px;border:1px solid #e2e8f0;background:#ffffff;color:#64748b;font-size:12px;font-weight:800;cursor:pointer;">
            Cancelar
          </button>
        </div>
      `;

      card
        .querySelectorAll('[data-close-ir]')
        .forEach((b) => b.addEventListener('click', closeItemReceiveOverlay));
      bindUndoTrancheHandlers();

      card.querySelector('[data-pick-item-total]')?.addEventListener('click', () => {
        amountMode = 'total';
        step = 'configure';
        renderModal();
      });
      card.querySelector('[data-pick-item-partial]')?.addEventListener('click', () => {
        amountMode = 'partial';
        partialInputStr = '';
        step = 'configure';
        renderModal();
      });
      return;
    }

    // Case C: Step 2 — Configure amount (if partial), immediate vs scheduled date, and account
    const trancheVal =
      amountMode === 'total'
        ? remainingOnItem
        : Math.max(0, Number(partialInputStr.replace(',', '.')) || 0);
    const itemRemainingAfter = Math.max(
      0,
      Math.round((remainingOnItem - trancheVal) * 100) / 100
    );
    const salaryRemainingAfter = Math.max(
      0,
      Math.round((calc.remainingToReceive - trancheVal) * 100) / 100
    );
    const isValidAmount =
      amountMode === 'total'
        ? remainingOnItem > 0
        : trancheVal > 0 && trancheVal < remainingOnItem;

    const accOptionsHtml =
      accounts.length > 0
        ? accounts
            .map(
              (a) =>
                `<option value="${escapeHtml(a.id)}" ${
                  a.id === selectedAccountId ? 'selected' : ''
                }>${escapeHtml(a.name)} (${escapeHtml(a.currency)})</option>`
            )
            .join('')
        : `<option value="">Conta padrão</option>`;

    const partialAmountBoxHtml =
      amountMode === 'partial'
        ? `
          <div style="display:flex;flex-direction:column;gap:7px;">
            <label style="font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.05em;color:#9a3412;">
              Quanto de ${escapeHtml(itemName)} você recebeu? (${escapeHtml(job.currency)})
            </label>
            <input type="number" inputmode="decimal" step="any" data-ir-partial-val value="${escapeHtml(
              partialInputStr
            )}" placeholder="Ex: ${Math.round(
              remainingOnItem / 2
            )}" style="width:100%;box-sizing:border-box;padding:12px 14px;border-radius:14px;border:2px solid #fdba74;background:#fffbeb;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:18px;font-weight:900;color:#0f172a;outline:none;" />
            <div style="display:flex;gap:6px;">
              ${[
                { pct: 25, label: '25%' },
                { pct: 50, label: '50% (Metade)' },
                { pct: 75, label: '75%' },
              ]
                .map(
                  (opt) =>
                    `<button type="button" data-ir-pct="${opt.pct}" style="flex:1;padding:7px 4px;border-radius:10px;border:1px solid #fed7aa;background:#ffffff;color:#c2410c;font-size:10.5px;font-weight:900;cursor:pointer;">${opt.label}</button>`
                )
                .join('')}
            </div>
          </div>
        `
        : '';

    const headerBg =
      amountMode === 'partial'
        ? 'linear-gradient(135deg,#f59e0b,#ea580c)'
        : 'linear-gradient(135deg,#059669,#0d9488)';

    card.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;background:${headerBg};color:#ffffff;flex-shrink:0;">
        <div style="min-width:0;">
          <div style="font-size:10px;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.85);">
            ${amountMode === 'partial' ? 'Recebimento Parcial do Item' : 'Receber Item Total'}
          </div>
          <div style="font-size:15px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(
            itemName
          )}</div>
          <div style="font-size:11.5px;font-weight:700;color:rgba(255,255,255,0.9);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">
            Disponível do item: ${escapeHtml(formatCurrency(remainingOnItem, job.currency))}
          </div>
        </div>
        <button type="button" data-close-ir style="width:32px;height:32px;border-radius:10px;border:none;background:rgba(255,255,255,0.2);color:#ffffff;font-size:16px;font-weight:900;cursor:pointer;flex-shrink:0;">✕</button>
      </div>

      <div style="padding:16px 18px 20px;display:flex;flex-direction:column;gap:12px;overflow-y:auto;overflow-x:hidden;touch-action:pan-y;box-sizing:border-box;">
        ${partialAmountBoxHtml}

        <!-- Option 1: Credit immediately -->
        <button type="button" data-ir-mode="now" style="width:100%;text-align:left;padding:12px 14px;border-radius:15px;border:2px solid ${
          deliveryMode === 'now' ? '#059669' : '#e2e8f0'
        };background:${deliveryMode === 'now' ? '#ecfdf5' : '#ffffff'};cursor:pointer;box-sizing:border-box;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <span style="font-size:12.5px;font-weight:900;color:#064e3b;">⚡ Agregar imediato na conta agora</span>
            <span style="width:18px;height:18px;border-radius:9999px;border:2px solid ${
              deliveryMode === 'now' ? '#059669' : '#cbd5e1'
            };background:${
      deliveryMode === 'now' ? '#059669' : 'transparent'
    };display:inline-flex;align-items:center;justify-content:center;color:#ffffff;font-size:11px;font-weight:900;">${
      deliveryMode === 'now' ? '✓' : ''
    }</span>
          </div>
          <div style="font-size:10.5px;font-weight:600;color:#047857;margin-top:2px;">
            Soma direto no saldo hoje e cria o ingresso marcado como recebido.
          </div>
        </button>

        <!-- Option 2: Schedule date -->
        <button type="button" data-ir-mode="schedule" style="width:100%;text-align:left;padding:12px 14px;border-radius:15px;border:2px solid ${
          deliveryMode === 'schedule' ? '#0284c7' : '#e2e8f0'
        };background:${deliveryMode === 'schedule' ? '#f0f9ff' : '#ffffff'};cursor:pointer;box-sizing:border-box;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <span style="font-size:12.5px;font-weight:900;color:#0c4a6e;">📅 Agendar data que vai cair</span>
            <span style="width:18px;height:18px;border-radius:9999px;border:2px solid ${
              deliveryMode === 'schedule' ? '#0284c7' : '#cbd5e1'
            };background:${
      deliveryMode === 'schedule' ? '#0284c7' : 'transparent'
    };display:inline-flex;align-items:center;justify-content:center;color:#ffffff;font-size:11px;font-weight:900;">${
      deliveryMode === 'schedule' ? '✓' : ''
    }</span>
          </div>
          <div style="font-size:10.5px;font-weight:600;color:#0369a1;margin-top:2px;">
            Cria ingresso separado pendente para a data escolhida, integrado ao salário.
          </div>
        </button>

        ${
          deliveryMode === 'schedule'
            ? `
          <div>
            <label style="display:block;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;margin-bottom:5px;">
              Data prevista que vai cair na conta
            </label>
            <input type="date" data-ir-date value="${escapeHtml(
              depositDate
            )}" style="width:100%;box-sizing:border-box;padding:10px 12px;border-radius:12px;border:1px solid #7dd3fc;background:#f0f9ff;font-size:13px;font-weight:800;color:#0f172a;" />
          </div>
        `
            : ''
        }

        <div>
          <label style="display:block;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;margin-bottom:5px;">
            Conta do SisFinz
          </label>
          <select data-ir-acc style="width:100%;box-sizing:border-box;padding:10px 12px;border-radius:12px;border:1px solid #cbd5e1;background:#f8fafc;font-size:12px;font-weight:800;color:#0f172a;">
            ${accOptionsHtml}
          </select>
        </div>

        <!-- Live Zero-Duplication Impact Box -->
        <div style="padding:12px 14px;border-radius:16px;background:#f8fafc;border:1px solid #e2e8f0;display:flex;flex-direction:column;gap:5px;">
          <div style="font-size:9.5px;font-weight:900;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;">
            Resumo sem duplicação
          </div>
          <div style="display:flex;justify-content:space-between;font-size:11.5px;font-weight:800;color:#059669;">
            <span>${deliveryMode === 'now' ? 'Cai agora na conta:' : 'Agendado separado:'}</span>
            <span data-ir-prev-now style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">+${escapeHtml(
              formatCurrency(trancheVal, job.currency)
            )}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:11.5px;font-weight:700;color:#c2410c;">
            <span>Restante deste item no salário:</span>
            <span data-ir-prev-itemrem style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${escapeHtml(
              formatCurrency(itemRemainingAfter, job.currency)
            )}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:12.5px;font-weight:900;color:#0f172a;padding-top:5px;border-top:1px dashed #cbd5e1;">
            <span>Novo restante do salário do mês:</span>
            <span data-ir-prev-salrem style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#047857;">${escapeHtml(
              formatCurrency(salaryRemainingAfter, job.currency)
            )}</span>
          </div>
        </div>

        <div data-ir-err style="display:none;padding:9px 12px;border-radius:12px;background:#fff1f2;border:1px solid #fecdd3;color:#be123c;font-size:11px;font-weight:700;"></div>

        <div style="display:grid;grid-template-columns:1fr 2fr;gap:8px;margin-top:2px;">
          <button type="button" data-ir-back style="padding:12px;border-radius:14px;border:1px solid #e2e8f0;background:#ffffff;color:#475569;font-size:12px;font-weight:800;cursor:pointer;">
            Voltar
          </button>
          <button type="button" data-confirm-ir ${
            isValidAmount && !isProcessing ? '' : 'disabled'
          } style="padding:12px;border-radius:14px;border:none;background:${
      !isValidAmount
        ? '#cbd5e1'
        : deliveryMode === 'now'
        ? '#059669'
        : '#0284c7'
    };color:#ffffff;font-size:12px;font-weight:900;letter-spacing:0.04em;text-transform:uppercase;cursor:${
      isValidAmount ? 'pointer' : 'not-allowed'
    };">
            ${
              isProcessing
                ? 'Salvando...'
                : deliveryMode === 'now'
                ? 'Confirmar e Creditar'
                : 'Agendar Ingresso'
            }
          </button>
        </div>
      </div>
    `;

    card
      .querySelectorAll('[data-close-ir]')
      .forEach((b) => b.addEventListener('click', closeItemReceiveOverlay));

    card.querySelector('[data-ir-back]')?.addEventListener('click', () => {
      step = 'choose';
      renderModal();
    });

    const updateLiveNumbers = (val: number) => {
      const iRem = Math.max(0, Math.round((remainingOnItem - val) * 100) / 100);
      const sRem = Math.max(0, Math.round((calc.remainingToReceive - val) * 100) / 100);
      const valid =
        amountMode === 'total' ? remainingOnItem > 0 : val > 0 && val < remainingOnItem;

      const nowEl = card.querySelector('[data-ir-prev-now]');
      const iRemEl = card.querySelector('[data-ir-prev-itemrem]');
      const sRemEl = card.querySelector('[data-ir-prev-salrem]');
      const confirmBtn = card.querySelector<HTMLButtonElement>('[data-confirm-ir]');

      if (nowEl) nowEl.textContent = `+${formatCurrency(val, job.currency)}`;
      if (iRemEl) iRemEl.textContent = formatCurrency(iRem, job.currency);
      if (sRemEl) sRemEl.textContent = formatCurrency(sRem, job.currency);
      if (confirmBtn) {
        confirmBtn.disabled = !valid;
        confirmBtn.style.background = !valid
          ? '#cbd5e1'
          : deliveryMode === 'now'
          ? '#059669'
          : '#0284c7';
        confirmBtn.style.cursor = valid ? 'pointer' : 'not-allowed';
      }
    };

    const partialInp = card.querySelector<HTMLInputElement>('[data-ir-partial-val]');
    partialInp?.addEventListener('input', () => {
      partialInputStr = partialInp.value;
      updateLiveNumbers(Math.max(0, Number(partialInputStr.replace(',', '.')) || 0));
    });

    card.querySelectorAll<HTMLButtonElement>('[data-ir-pct]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const pct = Number(btn.dataset.irPct) || 50;
        const computed = Math.round(((remainingOnItem * pct) / 100) * 100) / 100;
        partialInputStr = String(computed);
        if (partialInp) partialInp.value = partialInputStr;
        updateLiveNumbers(computed);
      });
    });

    card.querySelectorAll<HTMLButtonElement>('[data-ir-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        deliveryMode = btn.dataset.irMode === 'schedule' ? 'schedule' : 'now';
        renderModal();
      });
    });

    const dateInp = card.querySelector<HTMLInputElement>('[data-ir-date]');
    dateInp?.addEventListener('change', () => {
      depositDate = dateInp.value || todayStr;
    });

    const accSel = card.querySelector<HTMLSelectElement>('[data-ir-acc]');
    accSel?.addEventListener('change', () => {
      selectedAccountId = accSel.value;
    });

    card.querySelector('[data-confirm-ir]')?.addEventListener('click', async () => {
      if (isProcessing) return;
      const finalAmt =
        amountMode === 'total'
          ? remainingOnItem
          : Math.max(0, Number(partialInputStr.replace(',', '.')) || 0);
      const errBox = card.querySelector<HTMLElement>('[data-ir-err]');

      if (finalAmt <= 0) {
        if (errBox) {
          errBox.style.display = 'block';
          errBox.textContent = 'Informe um valor maior que zero.';
        }
        return;
      }
      if (amountMode === 'partial' && finalAmt >= remainingOnItem) {
        if (errBox) {
          errBox.style.display = 'block';
          errBox.textContent =
            'O valor parcial deve ser menor que o restante do item. Use "Valor total" para quitar tudo.';
        }
        return;
      }

      isProcessing = true;
      renderModal();
      try {
        const updated = await markCompositionItemTranche({
          job,
          salaryMonth,
          itemId,
          itemName,
          fullItemAmount,
          trancheAmount: finalAmt,
          creditNow: deliveryMode === 'now',
          depositDate: deliveryMode === 'now' ? todayStr : depositDate,
          accountId: selectedAccountId,
        });
        closeItemReceiveOverlay();
        const labelVal = formatCurrency(finalAmt, job.currency);
        onUpdated(
          updated,
          deliveryMode === 'now'
            ? `${itemName} (${labelVal}) creditado na conta e abatido do salário!`
            : `${itemName} (${labelVal}) agendado para ${formatShortDateBR(
                depositDate
              )} e abatido do salário!`
        );
      } catch (err) {
        console.warn('[SalaryBreakdown] separate item receipt failed:', err);
        isProcessing = false;
        renderModal();
      }
    });
  };

  renderModal();
  modalOverlay.appendChild(card);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeItemReceiveOverlay();
  });
  document.body.appendChild(modalOverlay);
}

/**
 * Stacked Salary & Benefits Editor overlay rendered ON TOP of the Composição Salarial modal.
 */
function openStackedSalaryEditor(params: {
  job: LaborJob;
  targetMonth: string;
  focusItemId?: string;
  scrollToAdd?: boolean;
  onSaved: (updatedJob: LaborJob) => void;
}) {
  closeEditorOverlay();

  const { job, targetMonth, focusItemId, scrollToAdd, onSaved } = params;
  const calc = calculateMonthSalary(job, targetMonth);

  let draftBaseSalary = String(calc.baseSalary || 0);
  let draftExtraAmount = String(calc.extraAmount || 0);
  let draftBenefits: LaborBenefit[] = calc.benefits.map((cb) => ({
    id: cb.id,
    name: cb.name,
    type: cb.type,
    value: cb.rawValue,
    enabled: cb.enabled,
    isDeduction: Boolean(cb.isDeduction),
  }));
  let newName = '';
  let newType: BenefitCalcType = 'percent';
  let newValue = '';
  let newIsDeduction = false;
  let syncWithFinance = true;
  let scopeStep = false;
  let isSaving = false;

  const editorOverlay = document.createElement('div');
  editorOverlay.id = EDITOR_OVERLAY_ID;
  editorOverlay.setAttribute('role', 'dialog');
  editorOverlay.setAttribute('aria-modal', 'true');
  editorOverlay.style.cssText =
    'position:fixed;inset:0;z-index:10065;display:flex;align-items:flex-end;justify-content:center;padding:0;background:rgba(15,23,42,0.52);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);overflow:hidden;overscroll-behavior:contain;touch-action:none;';

  const card = document.createElement('div');
  card.style.cssText =
    'width:100%;max-width:min(100vw,480px);max-height:90dvh;display:flex;flex-direction:column;overflow:hidden;box-sizing:border-box;background:#ffffff;border-radius:28px 28px 0 0;box-shadow:0 28px 70px rgba(15,23,42,0.34);border:1px solid #a7f3d0;font-family:inherit;';

  if (window.innerWidth >= 640) {
    editorOverlay.style.alignItems = 'center';
    editorOverlay.style.padding = '16px';
    card.style.borderRadius = '28px';
  }

  const commitSave = async (scope: 'single' | 'future') => {
    if (isSaving) return;
    isSaving = true;
    renderEditor();

    const newBase = Math.max(0, Number(draftBaseSalary.replace(',', '.')) || 0);
    const newExtra = Math.max(0, Number(draftExtraAmount.replace(',', '.')) || 0);
    let updatedJob: LaborJob;

    if (scope === 'single') {
      const baseSnap = getEffectiveSalarySnapshot(job, targetMonth);
      const baseSnapIds = new Set((baseSnap.benefits || []).map((b) => b.id));

      const disabledBenefitIds = draftBenefits.filter((b) => !b.enabled).map((b) => b.id);
      const enabledBenefitIds = draftBenefits.filter((b) => b.enabled).map((b) => b.id);
      const benefitValueOverrides: Record<string, number> = {};
      const benefitTypeOverrides: Record<string, BenefitCalcType> = {};
      const benefitDeductionOverrides: Record<string, boolean> = {};
      const singleMonthOnlyBenefits: LaborBenefit[] = [];
      const newlyEnabledOrAddedIds: string[] = [];

      draftBenefits.forEach((b) => {
        benefitValueOverrides[b.id] = b.value;
        benefitTypeOverrides[b.id] = b.type;
        benefitDeductionOverrides[b.id] = Boolean(b.isDeduction);
        if (!baseSnapIds.has(b.id)) {
          singleMonthOnlyBenefits.push({
            ...b,
            enabled: b.enabled,
            isDeduction: Boolean(b.isDeduction),
          });
          if (b.enabled) newlyEnabledOrAddedIds.push(b.id);
        } else {
          const origSnapBenefit = (baseSnap.benefits || []).find((sb) => sb.id === b.id);
          if (b.enabled && (!origSnapBenefit || !origSnapBenefit.enabled)) {
            newlyEnabledOrAddedIds.push(b.id);
          }
        }
      });

      const nextMonthOverrides: Record<string, any> = {
        ...(job.monthOverrides || {}),
      };
      const prevMonthOverride = nextMonthOverrides[targetMonth] || {};
      nextMonthOverrides[targetMonth] = {
        ...prevMonthOverride,
        baseSalary: newBase,
        disabledBenefitIds,
        enabledBenefitIds,
        benefitValueOverrides,
        benefitTypeOverrides,
        benefitDeductionOverrides,
        singleMonthBenefits: singleMonthOnlyBenefits,
        extraAmount: newExtra,
      };

      if (newlyEnabledOrAddedIds.length > 0) {
        for (const [mKey, mOv] of Object.entries(nextMonthOverrides)) {
          if (mKey <= targetMonth) continue;
          const existingDisabled = new Set<string>(mOv?.disabledBenefitIds || []);
          const existingEnabled = new Set<string>(mOv?.enabledBenefitIds || []);
          newlyEnabledOrAddedIds.forEach((id) => {
            existingDisabled.add(id);
            existingEnabled.delete(id);
          });
          nextMonthOverrides[mKey] = {
            ...mOv,
            disabledBenefitIds: Array.from(existingDisabled),
            enabledBenefitIds: Array.from(existingEnabled),
          };
        }
      }

      updatedJob = { ...job, monthOverrides: nextMonthOverrides };
    } else {
      const pastSnapshots = (job.salaryHistory || []).filter(
        (s) => s.effectiveFromMonth < targetMonth
      );
      const newSnapshot = {
        effectiveFromMonth: targetMonth,
        baseSalary: newBase,
        benefits: draftBenefits.map((b) => ({ ...b, isDeduction: Boolean(b.isDeduction) })),
        deductionPercent: 0,
      };
      const nextOverrides: Record<string, any> = { ...(job.monthOverrides || {}) };
      const existingReceivedItems = job.monthOverrides?.[targetMonth]?.receivedItems;
      if (
        newExtra > 0 ||
        (existingReceivedItems && Object.keys(existingReceivedItems).length > 0)
      ) {
        nextOverrides[targetMonth] = {
          ...(newExtra > 0 ? { extraAmount: newExtra } : {}),
          ...(existingReceivedItems ? { receivedItems: existingReceivedItems } : {}),
        };
      } else {
        delete nextOverrides[targetMonth];
      }
      for (const mKey of Object.keys(nextOverrides)) {
        if (mKey > targetMonth) delete nextOverrides[mKey];
      }

      updatedJob = {
        ...job,
        salaryHistory: [...pastSnapshots, newSnapshot],
        monthOverrides: nextOverrides,
      };
    }

    try {
      const saved = await persistUpdatedJobAndSyncIncome({
        updatedJob,
        targetMonth,
        scope,
        syncWithFinance,
      });
      closeEditorOverlay();
      onSaved(saved);
    } catch (err) {
      console.warn('[SalaryBreakdownEditor] save failed:', err);
      isSaving = false;
      renderEditor();
    }
  };

  const renderEditor = () => {
    const draftBaseNum = Math.max(0, Number(draftBaseSalary.replace(',', '.')) || 0);

    if (scopeStep) {
      card.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;background:#059669;color:#ffffff;flex-shrink:0;">
          <div style="min-width:0;">
            <div style="font-size:14px;font-weight:900;">Salvar Alterações</div>
            <div style="font-size:10.5px;font-weight:600;color:#d1fae5;text-transform:capitalize;">${escapeHtml(
              formatMonthLabel(targetMonth)
            )}</div>
          </div>
          <button type="button" data-close-ed style="width:32px;height:32px;border-radius:10px;border:none;background:rgba(255,255,255,0.18);color:#ffffff;font-size:16px;font-weight:900;cursor:pointer;flex-shrink:0;">✕</button>
        </div>

        <div style="padding:20px;display:flex;flex-direction:column;gap:14px;overflow-y:auto;overflow-x:hidden;overscroll-behavior-x:none;touch-action:pan-y;box-sizing:border-box;width:100%;">
          <div style="text-align:center;">
            <div style="font-size:26px;margin-bottom:4px;">✨</div>
            <div style="font-size:15px;font-weight:900;color:#0f172a;">Como aplicar este novo valor?</div>
            <div style="font-size:12px;font-weight:500;color:#64748b;margin-top:4px;">
              Escolha se a alteração vale só para <strong style="text-transform:capitalize;">${escapeHtml(
                formatMonthLabel(targetMonth)
              )}</strong> ou para todos os próximos meses.
            </div>
          </div>

          <label style="display:flex;align-items:center;gap:10px;padding:12px;border-radius:14px;border:1px solid #a7f3d0;background:#ecfdf5;font-size:12px;font-weight:700;color:#064e3b;cursor:pointer;box-sizing:border-box;">
            <input type="checkbox" data-sync-fin ${syncWithFinance ? 'checked' : ''} style="width:16px;height:16px;accent-color:#059669;flex-shrink:0;" />
            <span>Sincronizar automaticamente com minhas Receitas do SisFinz</span>
          </label>

          <button type="button" data-save-future ${isSaving ? 'disabled' : ''} style="width:100%;text-align:left;padding:15px;border-radius:16px;border:none;background:linear-gradient(90deg,#059669,#0d9488);color:#ffffff;cursor:pointer;box-shadow:0 6px 16px rgba(5,150,105,0.25);box-sizing:border-box;">
            <div style="font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:0.05em;">
              ${isSaving ? 'Salvando...' : 'Atualizar deste mês em diante'}
            </div>
            <div style="font-size:11px;font-weight:500;color:#d1fae5;margin-top:3px;">
              Aplica os benefícios, descontos e reajuste neste mês e nos próximos 12 meses.
            </div>
          </button>

          <button type="button" data-save-single ${isSaving ? 'disabled' : ''} style="width:100%;text-align:left;padding:15px;border-radius:16px;border:1px solid #cbd5e1;background:#ffffff;color:#1e293b;cursor:pointer;box-sizing:border-box;">
            <div style="font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:0.05em;">
              ${isSaving ? 'Salvando...' : 'Manter valor original nos próximos meses'}
            </div>
            <div style="font-size:11px;font-weight:500;color:#64748b;margin-top:3px;">
              Aplica somente em <span style="text-transform:capitalize;">${escapeHtml(
                formatMonthLabel(targetMonth)
              )}</span> — nos próximos meses o valor original é mantido.
            </div>
          </button>

          <button type="button" data-back-ed style="width:100%;padding:8px;border:none;background:transparent;color:#64748b;font-size:12px;font-weight:700;cursor:pointer;">
            Voltar e editar
          </button>
        </div>
      `;

      card.querySelector('[data-close-ed]')?.addEventListener('click', closeEditorOverlay);
      card.querySelector('[data-back-ed]')?.addEventListener('click', () => {
        scopeStep = false;
        renderEditor();
      });
      const syncCb = card.querySelector<HTMLInputElement>('[data-sync-fin]');
      syncCb?.addEventListener('change', () => {
        syncWithFinance = syncCb.checked;
      });
      card.querySelector('[data-save-future]')?.addEventListener('click', () => commitSave('future'));
      card.querySelector('[data-save-single]')?.addEventListener('click', () => commitSave('single'));
      return;
    }

    const benefitsHtml = draftBenefits
      .map((b) => {
        const isPercent = b.type === 'percent';
        const isDed = Boolean(b.isDeduction);
        const previewAmt = !b.enabled
          ? 0
          : isPercent
          ? Math.round((draftBaseNum * (Number(b.value) || 0)) / 100)
          : Number(b.value) || 0;
        const isFocused = focusItemId === b.id;

        return `
          <div data-item-row="${escapeHtml(b.id)}" style="width:100%;max-width:100%;box-sizing:border-box;overflow:hidden;border-radius:16px;border:${
          isFocused ? '2px solid #059669' : isDed ? '1px solid #fecdd3' : '1px solid #e2e8f0'
        };background:${isDed ? '#fff1f2' : '#ffffff'};padding:10px 12px;display:flex;flex-direction:column;gap:8px;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0;width:100%;">
              <label style="display:flex;align-items:center;gap:8px;min-width:0;flex:1;cursor:pointer;">
                <input type="checkbox" data-ed-check="${escapeHtml(b.id)}" ${
          b.enabled ? 'checked' : ''
        } style="width:16px;height:16px;accent-color:${isDed ? '#e11d48' : '#059669'};cursor:pointer;flex-shrink:0;" />
                <div style="min-width:0;flex:1;">
                  <div style="font-size:12px;font-weight:900;color:${
                    isDed ? '#881337' : '#0f172a'
                  };white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                    ${escapeHtml(b.name)}
                    ${
                      isDed
                        ? '<span style="margin-left:5px;font-size:8.5px;font-weight:900;text-transform:uppercase;background:#ffe4e6;color:#be123c;padding:1px 6px;border-radius:9999px;">Desconto</span>'
                        : ''
                    }
                  </div>
                  <div style="font-size:10px;font-weight:700;color:${isDed ? '#e11d48' : '#047857'};">
                    ${isDed ? '-' : '+'}${escapeHtml(formatCurrency(previewAmt, job.currency))}
                  </div>
                </div>
              </label>
              <button type="button" data-ed-del="${escapeHtml(
                b.id
              )}" aria-label="Remover ${escapeHtml(b.name)}" title="Remover" style="width:30px;height:30px;border-radius:10px;border:1px solid #fecdd3;background:#fff1f2;color:#f43f5e;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;">${TRASH_ICON_SVG}</button>
            </div>

            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding-left:24px;min-width:0;width:100%;box-sizing:border-box;">
              <div style="display:flex;gap:4px;flex-shrink:0;">
                <button type="button" data-ed-sign="${escapeHtml(b.id)}" data-val="add" style="padding:4px 8px;border-radius:8px;border:none;font-size:10px;font-weight:900;cursor:pointer;${
          !isDed ? 'background:#059669;color:#ffffff;' : 'background:#e2e8f0;color:#475569;'
        }">+</button>
                <button type="button" data-ed-sign="${escapeHtml(b.id)}" data-val="ded" style="padding:4px 8px;border-radius:8px;border:none;font-size:10px;font-weight:900;cursor:pointer;${
          isDed ? 'background:#e11d48;color:#ffffff;' : 'background:#e2e8f0;color:#475569;'
        }">-</button>
                <button type="button" data-ed-type="${escapeHtml(b.id)}" data-val="percent" style="padding:4px 8px;border-radius:8px;border:none;font-size:10px;font-weight:900;cursor:pointer;${
          isPercent
            ? isDed
              ? 'background:#e11d48;color:#ffffff;'
              : 'background:#059669;color:#ffffff;'
            : 'background:#e2e8f0;color:#475569;'
        }">%</button>
                <button type="button" data-ed-type="${escapeHtml(b.id)}" data-val="fixed" style="padding:4px 8px;border-radius:8px;border:none;font-size:10px;font-weight:900;cursor:pointer;${
          !isPercent
            ? isDed
              ? 'background:#e11d48;color:#ffffff;'
              : 'background:#059669;color:#ffffff;'
            : 'background:#e2e8f0;color:#475569;'
        }">${escapeHtml(job.currency)}</button>
              </div>
              <input type="number" inputmode="decimal" step="any" data-ed-val="${escapeHtml(
                b.id
              )}" value="${b.value}" style="width:96px;min-width:0;max-width:42%;box-sizing:border-box;padding:6px 8px;border-radius:10px;border:1px solid ${
          isDed ? '#fda4af' : '#cbd5e1'
        };background:#ffffff;text-align:right;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;font-weight:900;color:${
          isDed ? '#9f1239' : '#0f172a'
        };" />
            </div>
          </div>
        `;
      })
      .join('');

    card.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;background:#059669;color:#ffffff;flex-shrink:0;">
        <div style="min-width:0;">
          <div style="font-size:14px;font-weight:900;">Editar Composição Salarial</div>
          <div style="font-size:10.5px;font-weight:600;color:#d1fae5;text-transform:capitalize;">${escapeHtml(
            formatMonthLabel(targetMonth)
          )} • Sincroniza com Meus Trabalhos</div>
        </div>
        <button type="button" data-close-ed style="width:32px;height:32px;border-radius:10px;border:none;background:rgba(255,255,255,0.18);color:#ffffff;font-size:16px;font-weight:900;cursor:pointer;flex-shrink:0;">✕</button>
      </div>

      <div data-ed-scroll style="padding:16px 16px 20px;display:flex;flex-direction:column;gap:14px;overflow-y:auto;overflow-x:hidden;overscroll-behavior-x:none;overscroll-behavior-y:contain;touch-action:pan-y;width:100%;max-width:100%;box-sizing:border-box;">
        <div style="width:100%;box-sizing:border-box;">
          <label style="display:block;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;margin-bottom:5px;">
            Salário Básico (${escapeHtml(job.currency)})
          </label>
          <input type="number" inputmode="decimal" data-ed-base value="${escapeHtml(
            draftBaseSalary
          )}" style="width:100%;box-sizing:border-box;padding:11px 14px;border-radius:14px;border:1px solid #a7f3d0;background:#ecfdf5;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:17px;font-weight:900;color:#0f172a;" />
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;width:100%;box-sizing:border-box;">
          <span style="font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;">
            Benefícios (+) & Descontos (-)
          </span>
          <button type="button" data-quick-adelanto style="padding:4px 10px;border-radius:9999px;border:none;background:#ffe4e6;color:#be123c;font-size:10px;font-weight:900;cursor:pointer;">
            - Adelanto
          </button>
        </div>

        <div style="display:flex;flex-direction:column;gap:8px;width:100%;box-sizing:border-box;">
          ${benefitsHtml}
        </div>

        <div data-add-box style="width:100%;max-width:100%;box-sizing:border-box;border-radius:16px;border:1px dashed ${
          newIsDeduction ? '#fda4af' : '#6ee7b7'
        };background:${newIsDeduction ? '#fff1f2' : '#ecfdf5'};padding:12px;display:flex;flex-direction:column;gap:8px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
            <span style="font-size:10px;font-weight:900;text-transform:uppercase;color:${
              newIsDeduction ? '#9f1239' : '#065f46'
            };">${newIsDeduction ? '- Novo Desconto / Adelanto' : '+ Novo Benefício / Adicional'}</span>
            <div style="display:flex;gap:4px;background:#ffffff;padding:2px;border-radius:10px;border:1px solid #e2e8f0;flex-shrink:0;">
              <button type="button" data-new-mode="add" style="padding:3px 8px;border-radius:8px;border:none;font-size:9.5px;font-weight:900;cursor:pointer;${
                !newIsDeduction ? 'background:#059669;color:#ffffff;' : 'background:transparent;color:#64748b;'
              }">+ Soma</button>
              <button type="button" data-new-mode="ded" style="padding:3px 8px;border-radius:8px;border:none;font-size:9.5px;font-weight:900;cursor:pointer;${
                newIsDeduction ? 'background:#e11d48;color:#ffffff;' : 'background:transparent;color:#64748b;'
              }">- Desconta</button>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;width:100%;box-sizing:border-box;">
            <input type="text" data-new-name value="${escapeHtml(newName)}" placeholder="${
      newIsDeduction ? 'Ex: Adelanto / Vale' : 'Ex: Bônus / Antiguidade'
    }" style="grid-column:1 / -1;width:100%;min-width:0;box-sizing:border-box;padding:8px 10px;border-radius:10px;border:1px solid #cbd5e1;background:#ffffff;font-size:12px;font-weight:700;" />
            <select data-new-type style="width:100%;min-width:0;box-sizing:border-box;padding:8px 8px;border-radius:10px;border:1px solid #cbd5e1;background:#ffffff;font-size:11.5px;font-weight:700;">
              <option value="percent" ${newType === 'percent' ? 'selected' : ''}>% Básico</option>
              <option value="fixed" ${newType === 'fixed' ? 'selected' : ''}>Valor Fixo</option>
              <option value="variable" ${newType === 'variable' ? 'selected' : ''}>Variável</option>
            </select>
            <input type="number" inputmode="decimal" data-new-val value="${escapeHtml(
              newValue
            )}" placeholder="Valor" style="width:100%;min-width:0;box-sizing:border-box;padding:8px 10px;border-radius:10px;border:1px solid #cbd5e1;background:#ffffff;font-size:12px;font-weight:700;" />
          </div>

          <button type="button" data-add-item style="align-self:flex-start;padding:7px 12px;border-radius:10px;border:none;background:${
            newIsDeduction ? '#e11d48' : '#059669'
          };color:#ffffff;font-size:10.5px;font-weight:900;cursor:pointer;">
            ${newIsDeduction ? '- Incluir desconto' : '+ Incluir benefício'}
          </button>
        </div>

        <button type="button" data-go-scope style="width:100%;box-sizing:border-box;padding:13px;border-radius:16px;border:none;background:#059669;color:#ffffff;font-size:12px;font-weight:900;letter-spacing:0.06em;text-transform:uppercase;cursor:pointer;box-shadow:0 8px 18px rgba(5,150,105,0.24);">
          Continuar para salvar
        </button>
      </div>
    `;

    card.querySelector('[data-close-ed]')?.addEventListener('click', closeEditorOverlay);

    const baseInp = card.querySelector<HTMLInputElement>('[data-ed-base]');
    baseInp?.addEventListener('input', () => {
      draftBaseSalary = baseInp.value;
    });

    card.querySelector('[data-quick-adelanto]')?.addEventListener('click', () => {
      draftBenefits = [
        ...draftBenefits,
        {
          id: `ded_adelanto_${Date.now()}_${Math.random().toString(36).slice(2, 4)}`,
          name: 'Adelanto',
          type: 'fixed',
          value: 0,
          enabled: true,
          isDeduction: true,
        },
      ];
      renderEditor();
    });

    card.querySelectorAll<HTMLInputElement>('[data-ed-check]').forEach((cb) => {
      cb.addEventListener('change', () => {
        const id = cb.dataset.edCheck;
        draftBenefits = draftBenefits.map((b) =>
          b.id === id ? { ...b, enabled: cb.checked } : b
        );
        renderEditor();
      });
    });

    card.querySelectorAll<HTMLButtonElement>('[data-ed-del]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.edDel;
        draftBenefits = draftBenefits.filter((b) => b.id !== id);
        renderEditor();
      });
    });

    card.querySelectorAll<HTMLButtonElement>('[data-ed-sign]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.edSign;
        const ded = btn.dataset.val === 'ded';
        draftBenefits = draftBenefits.map((b) =>
          b.id === id ? { ...b, isDeduction: ded } : b
        );
        renderEditor();
      });
    });

    card.querySelectorAll<HTMLButtonElement>('[data-ed-type]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.edType;
        const t = (btn.dataset.val as BenefitCalcType) || 'fixed';
        draftBenefits = draftBenefits.map((b) => (b.id === id ? { ...b, type: t } : b));
        renderEditor();
      });
    });

    card.querySelectorAll<HTMLInputElement>('[data-ed-val]').forEach((inp) => {
      inp.addEventListener('input', () => {
        const id = inp.dataset.edVal;
        const v = Math.max(0, Number(inp.value.replace(',', '.')) || 0);
        draftBenefits = draftBenefits.map((b) => (b.id === id ? { ...b, value: v } : b));
      });
    });

    card.querySelectorAll<HTMLButtonElement>('[data-new-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        newIsDeduction = btn.dataset.newMode === 'ded';
        if (newIsDeduction) newType = 'fixed';
        renderEditor();
      });
    });

    const newNameInp = card.querySelector<HTMLInputElement>('[data-new-name]');
    const newTypeSel = card.querySelector<HTMLSelectElement>('[data-new-type]');
    const newValInp = card.querySelector<HTMLInputElement>('[data-new-val]');
    newNameInp?.addEventListener('input', () => {
      newName = newNameInp.value;
    });
    newTypeSel?.addEventListener('change', () => {
      newType = newTypeSel.value as BenefitCalcType;
    });
    newValInp?.addEventListener('input', () => {
      newValue = newValInp.value;
    });

    card.querySelector('[data-add-item]')?.addEventListener('click', () => {
      if (!newName.trim()) return;
      const val = Math.max(0, Number(newValue.replace(',', '.')) || 0);
      draftBenefits = [
        ...draftBenefits,
        {
          id: `${newIsDeduction ? 'ded' : 'ben'}_${Date.now()}_${Math.random()
            .toString(36)
            .slice(2, 5)}`,
          name: newName.trim(),
          type: newType,
          value: val,
          enabled: true,
          isDeduction: newIsDeduction,
        },
      ];
      newName = '';
      newValue = '';
      newIsDeduction = false;
      renderEditor();
    });

    card.querySelector('[data-go-scope]')?.addEventListener('click', () => {
      scopeStep = true;
      renderEditor();
    });
  };

  renderEditor();
  editorOverlay.appendChild(card);
  editorOverlay.addEventListener('click', (e) => {
    if (e.target === editorOverlay) closeEditorOverlay();
  });
  document.body.appendChild(editorOverlay);

  if (scrollToAdd) {
    const addBox = card.querySelector('[data-add-box]');
    addBox?.scrollIntoView({ behavior: 'auto', block: 'center' });
  } else if (focusItemId) {
    const targetRow = card.querySelector(`[data-item-row="${focusItemId}"]`);
    targetRow?.scrollIntoView({ behavior: 'auto', block: 'center' });
  }
}

function renderSalaryBreakdownOverlay(initialJob: LaborJob, initialMonth: string) {
  closeBreakdownOverlay();

  let activeJob: LaborJob = initialJob;
  let currentMonth = initialMonth;
  let savedFlashMsg: string | null = null;

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:10050;display:flex;align-items:flex-end;justify-content:center;padding:0;background:rgba(15,23,42,0.55);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);overflow:hidden;overscroll-behavior:contain;touch-action:none;';

  const card = document.createElement('div');
  card.style.cssText =
    'width:100%;max-width:min(100vw,440px);max-height:88dvh;display:flex;flex-direction:column;overflow:hidden;box-sizing:border-box;background:#ffffff;border-radius:28px 28px 0 0;box-shadow:0 24px 60px rgba(15,23,42,0.28);border:1px solid #d1fae5;font-family:inherit;margin-bottom:0;';

  if (window.innerWidth >= 640) {
    overlay.style.alignItems = 'center';
    overlay.style.padding = '16px';
    card.style.borderRadius = '28px';
  }

  const showToast = (msg: string) => {
    savedFlashMsg = msg;
    renderContent();
    window.setTimeout(() => {
      savedFlashMsg = null;
      if (document.getElementById(OVERLAY_ID)) renderContent();
    }, 3200);
  };

  const openEditorFromBreakdown = (focusItemId?: string, scrollToAdd?: boolean) => {
    openStackedSalaryEditor({
      job: activeJob,
      targetMonth: currentMonth,
      focusItemId,
      scrollToAdd,
      onSaved: (updatedJob) => {
        activeJob = updatedJob;
        showToast('Composição atualizada aqui e em Meus Trabalhos!');
      },
    });
  };

  const renderContent = () => {
    const calc = calculateMonthSalary(activeJob, currentMonth);
    const receivedMap = getMonthReceivedItemsMap(activeJob, currentMonth);
    const enabledItems = calc.benefits.filter((b) => b.enabled);
    const additions = enabledItems.filter((b) => !b.isDeduction);
    const deductions = enabledItems.filter((b) => Boolean(b.isDeduction));

    const editIconSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;

    const buildItemStatusHtml = (rec: ReceivedSalaryItemEntry | undefined, fullAmt: number) => {
      if (!rec || rec.amount <= 0) {
        return {
          badgeHtml: '',
          amountHtml: `+${escapeHtml(formatCurrency(fullAmt, activeJob.currency))}`,
          amountColor: '#059669',
          strike: false,
          nameColor: '#334155',
        };
      }
      const rem = Math.max(0, Math.round((fullAmt - rec.amount) * 100) / 100);
      if (rem > 0) {
        // Partially received item!
        return {
          badgeHtml: `<span style="margin-left:5px;font-size:9px;font-weight:900;background:#ffedd5;color:#c2410c;padding:1px 6px;border-radius:9999px;white-space:nowrap;">⏳ Parcial: ${escapeHtml(
            formatCurrency(rec.amount, activeJob.currency)
          )}</span>`,
          amountHtml: `+${escapeHtml(formatCurrency(rem, activeJob.currency))}`,
          amountColor: '#d97706',
          strike: false,
          nameColor: '#0f172a',
        };
      }
      // 100% received/scheduled separately
      return {
        badgeHtml: `<span style="margin-left:5px;font-size:9px;font-weight:900;background:${
          rec.creditNow ? '#d1fae5' : '#e0f2fe'
        };color:${
          rec.creditNow ? '#047857' : '#0369a1'
        };padding:1px 6px;border-radius:9999px;white-space:nowrap;">${
          rec.creditNow ? '✓ Recebido' : `📅 ${formatShortDateBR(rec.depositDate)}`
        }</span>`,
        amountHtml: `+${escapeHtml(formatCurrency(fullAmt, activeJob.currency))}`,
        amountColor: '#94a3b8',
        strike: true,
        nameColor: '#64748b',
      };
    };

    const baseStatus = buildItemStatusHtml(receivedMap['__base__'], calc.baseSalary);
    const baseAmtDisplay = baseStatus.amountHtml.replace(/^\+/, '');

    const benefitRowsHtml = additions
      .map((b) => {
        const st = buildItemStatusHtml(receivedMap[b.id], b.calculatedAmount);
        const canReceive = b.calculatedAmount > 0;
        const pctTag =
          b.type === 'percent'
            ? `<span style="font-size:10.5px;font-weight:800;color:#047857;margin-left:4px;">(${b.rawValue}%)</span>`
            : '';
        return `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 4px;border-bottom:1px dashed #e2e8f0;font-size:13px;border-radius:10px;${
            canReceive ? 'cursor:pointer;' : ''
          }" ${
          canReceive
            ? `data-receive-item="${escapeHtml(b.id)}" data-receive-name="${escapeHtml(
                b.name
              )}" data-receive-amt="${b.calculatedAmount}"`
            : ''
        }>
            <span style="font-weight:700;color:${
              st.nameColor
            };min-width:0;flex:1;display:flex;align-items:center;flex-wrap:wrap;gap:2px;">
              <span>${escapeHtml(b.name)}${pctTag}</span>
              ${st.badgeHtml}
            </span>
            <div style="display:inline-flex;align-items:center;gap:6px;flex-shrink:0;">
              <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:800;color:${
                st.amountColor
              };white-space:nowrap;${st.strike ? 'text-decoration:line-through;' : ''}">${
          st.amountHtml
        }</span>
              <button type="button" data-edit-item="${escapeHtml(b.id)}" title="Editar ${escapeHtml(
          b.name
        )}" style="width:24px;height:24px;border-radius:8px;border:1px solid #a7f3d0;background:#ffffff;color:#047857;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;">${editIconSvg}</button>
            </div>
          </div>
        `;
      })
      .join('');

    const deductionRowsHtml = deductions
      .map((b) => {
        const pctTag =
          b.type === 'percent'
            ? `<span style="font-size:10.5px;font-weight:800;color:#be123c;margin-left:4px;">(${b.rawValue}%)</span>`
            : '';
        return `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 4px;border-bottom:1px dashed #fecdd3;font-size:13px;">
            <span style="font-weight:700;color:#be123c;display:inline-flex;align-items:center;gap:6px;min-width:0;flex:1;flex-wrap:wrap;">
              ${escapeHtml(b.name)}${pctTag}
              <span style="font-size:9px;font-weight:900;text-transform:uppercase;background:#ffe4e6;color:#be123c;padding:1px 6px;border-radius:9999px;">Desconto</span>
            </span>
            <div style="display:inline-flex;align-items:center;gap:6px;flex-shrink:0;">
              <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:800;color:#e11d48;white-space:nowrap;">-${escapeHtml(
                formatCurrency(b.calculatedAmount, activeJob.currency)
              )}</span>
              <button type="button" data-edit-item="${escapeHtml(b.id)}" title="Editar ${escapeHtml(
          b.name
        )}" style="width:24px;height:24px;border-radius:8px;border:1px solid #fecdd3;background:#ffffff;color:#be123c;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;">${editIconSvg}</button>
            </div>
          </div>
        `;
      })
      .join('');

    const extraRowHtml =
      calc.extraAmount > 0
        ? (() => {
            const st = buildItemStatusHtml(receivedMap['__extra__'], calc.extraAmount);
            return `
              <div data-receive-item="__extra__" data-receive-name="Extras / Bônus do mês" data-receive-amt="${calc.extraAmount}" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:7px 4px;border-bottom:1px dashed #e2e8f0;font-size:13px;cursor:pointer;">
                <span style="font-weight:700;color:#065f46;">Extras / Bônus do mês ${st.badgeHtml}</span>
                <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:800;color:${
                  st.amountColor
                };white-space:nowrap;${st.strike ? 'text-decoration:line-through;' : ''}">${
              st.amountHtml
            }</span>
              </div>
            `;
          })()
        : '';

    const emptyBenefitsHtml =
      additions.length === 0 && deductions.length === 0 && calc.extraAmount <= 0
        ? `<div style="padding:8px 0;font-size:12px;color:#64748b;font-weight:600;">Nenhum benefício ou desconto ativo neste mês.</div>`
        : '';

    const footerCounts = [
      `${additions.length} benefício${additions.length === 1 ? '' : 's'}`,
      ...(deductions.length > 0
        ? [`${deductions.length} desconto${deductions.length === 1 ? '' : 's'}`]
        : []),
    ].join(' • ');

    const flashHtml = savedFlashMsg
      ? `<div style="padding:8px 12px;border-radius:12px;background:#059669;color:#ffffff;font-size:11.5px;font-weight:800;text-align:center;">✓ ${escapeHtml(
          savedFlashMsg
        )}</div>`
      : '';

    const totalsHtml =
      calc.separatelyReceivedTotal > 0
        ? `
          <div style="display:flex;flex-direction:column;gap:5px;padding-top:10px;margin-top:4px;border-top:2px solid #6ee7b7;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:12px;font-weight:700;color:#475569;">
              <span>Total da Composição</span>
              <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${escapeHtml(
                formatCurrency(calc.netTotal, activeJob.currency)
              )}</span>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:12px;font-weight:800;color:#059669;">
              <span>Já recebido / separado</span>
              <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">-${escapeHtml(
                formatCurrency(calc.separatelyReceivedTotal, activeJob.currency)
              )}</span>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:15px;padding-top:4px;border-top:1px dashed #6ee7b7;">
              <span style="font-weight:900;color:#064e3b;">Restante a Receber</span>
              <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:900;color:#047857;white-space:nowrap;">${escapeHtml(
                formatCurrency(calc.remainingToReceive, activeJob.currency)
              )}</span>
            </div>
          </div>
        `
        : `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:10px;margin-top:4px;border-top:2px solid #6ee7b7;font-size:15px;">
            <span style="font-weight:900;color:#064e3b;">Total a Receber</span>
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:900;color:#047857;white-space:nowrap;">${escapeHtml(
              formatCurrency(calc.netTotal, activeJob.currency)
            )}</span>
          </div>
        `;

    card.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;background:linear-gradient(135deg,#059669,#0d9488);color:#ffffff;flex-shrink:0;">
        <div style="min-width:0;">
          <div style="font-size:10px;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:#a7f3d0;">Composição Salarial</div>
          <div style="font-size:15px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Salário • ${escapeHtml(
            activeJob.companyName
          )}</div>
          <div style="font-size:11px;font-weight:600;color:#d1fae5;">${escapeHtml(
            activeJob.role
          )}</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
          <button type="button" data-open-full-editor title="Editar salário e benefícios" style="height:34px;padding:0 10px;border-radius:12px;border:none;background:rgba(255,255,255,0.2);color:#ffffff;font-size:11px;font-weight:900;cursor:pointer;display:inline-flex;align-items:center;gap:5px;">
            ${editIconSvg} Editar
          </button>
          <button type="button" data-close-breakdown style="width:34px;height:34px;border-radius:12px;border:none;background:rgba(255,255,255,0.18);color:#ffffff;font-size:18px;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
        </div>
      </div>

      <div style="padding:16px 20px 20px;overflow-y:auto;overflow-x:hidden;overscroll-behavior-x:none;overscroll-behavior-y:contain;touch-action:pan-y;display:flex;flex-direction:column;gap:12px;width:100%;box-sizing:border-box;">
        ${flashHtml}

        <div style="display:flex;align-items:center;justify-content:space-between;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:6px 8px;">
          <button type="button" data-prev-month style="width:32px;height:32px;border-radius:10px;border:none;background:#ffffff;color:#334155;font-size:16px;font-weight:900;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,0.06);">‹</button>
          <span style="font-size:12.5px;font-weight:900;color:#0f172a;text-transform:capitalize;">${escapeHtml(
            formatMonthLabel(currentMonth)
          )}</span>
          <button type="button" data-next-month style="width:32px;height:32px;border-radius:10px;border:none;background:#ffffff;color:#334155;font-size:16px;font-weight:900;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,0.06);">›</button>
        </div>

        <div style="font-size:10.5px;font-weight:700;color:#047857;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:7px 11px;text-align:center;">
          💡 Toque em qualquer item abaixo para marcar como recebido (total ou parcial)
        </div>

        <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:18px;padding:14px 16px;">
          <div ${
            calc.baseSalary > 0
              ? `data-receive-item="__base__" data-receive-name="Salário Básico" data-receive-amt="${calc.baseSalary}"`
              : ''
          } style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 4px 8px;border-bottom:1px solid #a7f3d0;font-size:13.5px;cursor:pointer;">
            <span style="font-weight:900;color:${
              baseStatus.strike ? '#64748b' : '#0f172a'
            };">Salário Básico ${baseStatus.badgeHtml}</span>
            <div style="display:inline-flex;align-items:center;gap:6px;">
              <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:900;color:${
                baseStatus.strike ? '#94a3b8' : baseStatus.amountColor === '#d97706' ? '#d97706' : '#0f172a'
              };white-space:nowrap;${
      baseStatus.strike ? 'text-decoration:line-through;' : ''
    }">${baseAmtDisplay}</span>
              <button type="button" data-open-full-editor title="Editar Salário Básico" style="width:24px;height:24px;border-radius:8px;border:1px solid #a7f3d0;background:#ffffff;color:#047857;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;">${editIconSvg}</button>
            </div>
          </div>

          <div style="padding:4px 0;">
            ${benefitRowsHtml}
            ${extraRowHtml}
            ${deductionRowsHtml}
            ${emptyBenefitsHtml}
          </div>

          ${totalsHtml}
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;font-weight:600;color:#64748b;padding:0 2px;">
          <span>Sincronizado pela Jornada Laboral</span>
          <span>${escapeHtml(footerCounts)}</span>
        </div>

        <button type="button" data-add-benefit-btn style="width:100%;padding:12px;border-radius:14px;border:2px dashed #10b981;background:#ecfdf5;color:#047857;font-size:12px;font-weight:900;letter-spacing:0.04em;text-transform:uppercase;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">
          <span>＋</span> Agregar benefício / desconto
        </button>

        <button type="button" data-close-breakdown style="width:100%;padding:12px;border-radius:14px;border:none;background:#059669;color:#ffffff;font-size:12px;font-weight:900;letter-spacing:0.06em;text-transform:uppercase;cursor:pointer;">
          Fechar
        </button>
      </div>
    `;

    card.querySelectorAll('[data-close-breakdown]').forEach((btn) => {
      btn.addEventListener('click', closeBreakdownOverlay);
    });
    card.querySelectorAll('[data-open-full-editor]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditorFromBreakdown();
      });
    });
    card.querySelectorAll<HTMLButtonElement>('[data-edit-item]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditorFromBreakdown(btn.dataset.editItem);
      });
    });
    card.querySelectorAll<HTMLElement>('[data-receive-item]').forEach((rowEl) => {
      rowEl.addEventListener('click', (e) => {
        if ((e.target as HTMLElement)?.closest('button')) return;
        const itemId = rowEl.dataset.receiveItem || '';
        const itemName = rowEl.dataset.receiveName || '';
        const fullItemAmount = Number(rowEl.dataset.receiveAmt) || 0;
        if (!itemId || fullItemAmount <= 0) return;

        openItemSeparateReceiveModal({
          job: activeJob,
          salaryMonth: currentMonth,
          itemId,
          itemName,
          fullItemAmount,
          existingEntry: receivedMap[itemId],
          onUpdated: (updatedJob, toastMsg) => {
            activeJob = updatedJob;
            showToast(toastMsg);
          },
        });
      });
    });
    card.querySelector('[data-add-benefit-btn]')?.addEventListener('click', () => {
      openEditorFromBreakdown(undefined, true);
    });
    card.querySelector('[data-prev-month]')?.addEventListener('click', () => {
      currentMonth = shiftMonthStr(currentMonth, -1);
      renderContent();
    });
    card.querySelector('[data-next-month]')?.addEventListener('click', () => {
      currentMonth = shiftMonthStr(currentMonth, 1);
      renderContent();
    });
  };

  renderContent();
  overlay.appendChild(card);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeBreakdownOverlay();
  });

  document.body.appendChild(overlay);
}

/** Extract company name from text like "Salário • Popolo Oroño" */
function extractSalaryCompany(text: string): string | null {
  const m = text.match(/Sal[aá]rio\s*[•·-]\s*(.+)/i);
  if (!m) return null;
  return m[1].replace(/\(Parcial(?:\s*\d+)?\)/i, '').trim();
}

/** Decorate visible "Salário • Company" income rows in Receitas with a subtle "Ver composição" chip */
function decorateSalaryIncomeRows() {
  if (typeof document === 'undefined') return;
  const jobs = loadCachedLaborJobs();
  if (!jobs.length) return;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const matchingElements = new Set<HTMLElement>();

  let node: Node | null;
  while ((node = walker.nextNode())) {
    const val = (node.nodeValue || '').trim();
    if (!val || !val.includes('Salário')) continue;
    const company = extractSalaryCompany(val);
    if (!company) continue;

    const parent = node.parentElement;
    if (!parent) continue;
    if (
      parent.closest(
        `#${OVERLAY_ID}, #${EDITOR_OVERLAY_ID}, #${ITEM_RECEIVE_OVERLAY_ID}, #sisfinz-partial-receipt-overlay`
      ) ||
      parent.closest('input, textarea, select') ||
      parent.closest('[data-labor-overlay]')
    ) {
      continue;
    }
    matchingElements.add(parent);
  }

  matchingElements.forEach((el) => {
    if (el.dataset.sisfinzSalaryDecorated === '1') return;
    const company = extractSalaryCompany(el.textContent || '');
    if (!company) return;
    const job = findJobByCompanyName(company);
    if (!job) return;

    el.dataset.sisfinzSalaryDecorated = '1';
    el.dataset.sisfinzSalaryCompany = job.companyName;
    el.style.cursor = 'pointer';

    const container = el.parentElement;
    if (container && !container.querySelector(`.${BADGE_CLASS}`)) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = BADGE_CLASS;
      chip.dataset.sisfinzSalaryCompany = job.companyName;
      chip.textContent = 'Ver composição salarial';
      chip.style.cssText =
        'display:inline-flex;align-items:center;gap:4px;margin-top:4px;padding:2px 8px;border-radius:9999px;border:1px solid #a7f3d0;background:#ecfdf5;color:#047857;font-size:10px;font-weight:800;letter-spacing:0.02em;cursor:pointer;line-height:1.4;';
      el.insertAdjacentElement('afterend', chip);
    }
  });
}

let initialized = false;
let decorateTimer: number | null = null;

export function initSalaryBreakdownViewer() {
  if (initialized || typeof window === 'undefined' || typeof document === 'undefined') return;
  initialized = true;

  const scheduleDecorate = () => {
    if (decorateTimer !== null) window.clearTimeout(decorateTimer);
    decorateTimer = window.setTimeout(() => {
      decorateTimer = null;
      decorateSalaryIncomeRows();
    }, 120);
  };

  scheduleDecorate();

  const observer = new MutationObserver(() => {
    scheduleDecorate();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (document.getElementById(ITEM_RECEIVE_OVERLAY_ID)) {
        closeItemReceiveOverlay();
      } else if (document.getElementById(EDITOR_OVERLAY_ID)) {
        closeEditorOverlay();
      } else {
        closeBreakdownOverlay();
      }
    }
  });

  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    if (
      !target ||
      target.closest(`#${OVERLAY_ID}, #${EDITOR_OVERLAY_ID}, #${ITEM_RECEIVE_OVERLAY_ID}`)
    ) {
      return;
    }

    const chip = target.closest(`.${BADGE_CLASS}`) as HTMLElement | null;
    if (chip) {
      event.preventDefault();
      event.stopPropagation();
      const company = chip.dataset.sisfinzSalaryCompany || '';
      const job = findJobByCompanyName(company);
      if (job) {
        renderSalaryBreakdownOverlay(job, detectActiveDashboardMonth());
      }
      return;
    }

    if (target.closest('button, a, input, select, textarea')) return;
    const decorated = target.closest('[data-sisfinz-salary-decorated="1"]') as HTMLElement | null;
    if (decorated) {
      const company = decorated.dataset.sisfinzSalaryCompany || '';
      const job = findJobByCompanyName(company);
      if (job) {
        event.preventDefault();
        event.stopPropagation();
        renderSalaryBreakdownOverlay(job, detectActiveDashboardMonth());
      }
    }
  });
}
