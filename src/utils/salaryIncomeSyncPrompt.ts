import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { CurrencyCode } from '../types';
import { LaborBenefit, LaborJob, ReceivedSalaryItemEntry } from '../types/labor';
import {
  calculateMonthSalary,
  getEffectiveSalarySnapshot,
  getMonthReceivedItemsMap,
} from './laborCalculations';
import { formatCurrency } from './currency';
import { shiftMonthStr } from './finance';

const OVERLAY_ID = 'sisfinz-salary-income-sync-overlay';
const LOCAL_JOBS_PREFIX = 'sisfinz_labor_jobs_v1_';

interface TrackedIncomeSnapshot {
  id: string;
  name: string;
  amount: number;
  notes: string;
  expectedDate: string;
  startMonth: string;
  currency: CurrencyCode;
  laborJobId?: string;
  salaryItemId?: string;
  salaryRefMonth?: string;
  parentSalaryIncomeId?: string;
}

interface SyncCandidate {
  kind: 'advance_deduction' | 'received_item';
  income: TrackedIncomeSnapshot;
  prevIncome: TrackedIncomeSnapshot;
  job: LaborJob;
  targetMonth: string;
  itemLabel: string;
  oldAmount: number;
  newAmount: number;
  oldLabel?: string;
  newLabel?: string;
  deductionBenefitId?: string;
  receivedItemId?: string;
}

let initialized = false;
let currentUid: string | null = null;
let unsubIncomes: (() => void) | null = null;
let unsubJobs: (() => void) | null = null;

let cachedJobs: LaborJob[] = [];
const prevIncomesMap = new Map<string, TrackedIncomeSnapshot>();
let initialIncomesSeeded = false;
const recentlySyncedIncomeIds = new Map<string, number>();

function sanitizePayload<T>(obj: T): T {
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

function normalizeText(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function formatMonthTitle(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number);
  if (!y || !m) return yyyyMm;
  const dt = new Date(y, m - 1, 1);
  return dt.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function toTrackedIncome(id: string, data: any): TrackedIncomeSnapshot {
  const startMonth =
    String(data?.startMonth || '').slice(0, 7) ||
    String(data?.expectedDate || '').slice(0, 7) ||
    '';
  return {
    id,
    name: String(data?.name || ''),
    amount: Math.round((Number(data?.amount) || 0) * 100) / 100,
    notes: String(data?.notes || ''),
    expectedDate: String(data?.expectedDate || ''),
    startMonth,
    currency: (data?.currency || 'ARS') as CurrencyCode,
    laborJobId: data?.laborJobId ? String(data.laborJobId) : undefined,
    salaryItemId: data?.salaryItemId ? String(data.salaryItemId) : undefined,
    salaryRefMonth: data?.salaryRefMonth ? String(data.salaryRefMonth) : undefined,
    parentSalaryIncomeId: data?.parentSalaryIncomeId
      ? String(data.parentSalaryIncomeId)
      : undefined,
  };
}

function markIncomeAsRecentlySynced(incomeId: string) {
  recentlySyncedIncomeIds.set(incomeId, Date.now());
}

function isRecentlySynced(incomeId: string): boolean {
  const ts = recentlySyncedIncomeIds.get(incomeId);
  if (!ts) return false;
  if (Date.now() - ts > 6000) {
    recentlySyncedIncomeIds.delete(incomeId);
    return false;
  }
  return true;
}

function findMatchingJob(income: TrackedIncomeSnapshot): LaborJob | null {
  if (!cachedJobs.length) return null;
  if (income.laborJobId) {
    const byId = cachedJobs.find((j) => j.id === income.laborJobId);
    if (byId) return byId;
  }
  if (income.parentSalaryIncomeId) {
    const byParent = cachedJobs.find(
      (j) =>
        j.linkedSalaryIncomeId === income.parentSalaryIncomeId ||
        `inc_salary_${j.id}` === income.parentSalaryIncomeId
    );
    if (byParent) return byParent;
  }
  // Check salaryAdvanceHistory
  const byHistory = cachedJobs.find((j) =>
    (j.salaryAdvanceHistory || []).some((entry) => entry.id === income.id)
  );
  if (byHistory) return byHistory;

  // Check receivedItems in monthOverrides
  for (const job of cachedJobs) {
    for (const mOv of Object.values(job.monthOverrides || {})) {
      const recMap = mOv?.receivedItems || {};
      for (const rec of Object.values(recMap)) {
        if (
          rec.linkedIncomeId === income.id ||
          (rec.installments || []).some((inst) => inst.linkedIncomeId === income.id)
        ) {
          return job;
        }
      }
    }
  }

  // Fallback by company name in title (e.g. "Antecipação de Salário • Popolo Oroño")
  const normName = normalizeText(income.name);
  for (const job of cachedJobs) {
    const normCompany = normalizeText(job.companyName);
    if (normCompany && normName.includes(normCompany)) {
      return job;
    }
  }

  return null;
}

function looksLikeSalaryAdvanceIncome(income: TrackedIncomeSnapshot): boolean {
  if (income.id.startsWith('inc_advance_')) return true;
  const normName = normalizeText(income.name);
  const normNotes = normalizeText(income.notes);
  return (
    normName.includes('antecipacao') ||
    normName.includes('adelanto') ||
    normName.includes('adiantamento') ||
    normNotes.includes('antecipacao') ||
    normNotes.includes('adelanto')
  );
}

function findSyncCandidate(
  prevIncome: TrackedIncomeSnapshot,
  nextIncome: TrackedIncomeSnapshot
): SyncCandidate | null {
  // Ignore main monthly salary income itself (already synced from salary editor / partial receipt)
  if (nextIncome.id.startsWith('inc_salary_')) return null;

  const amountChanged = Math.abs(prevIncome.amount - nextIncome.amount) >= 0.01;
  const nameChanged = prevIncome.name.trim() !== nextIncome.name.trim();
  const notesChanged = prevIncome.notes.trim() !== nextIncome.notes.trim();

  if (!amountChanged && !nameChanged && !notesChanged) return null;

  const job = findMatchingJob(nextIncome) || findMatchingJob(prevIncome);
  if (!job) return null;

  // 1. Check separately-received salary item (inc_salitem_... or receivedItems match)
  const checkReceivedItem = (): SyncCandidate | null => {
    const monthsToSearch = new Set<string>();
    if (nextIncome.salaryRefMonth) monthsToSearch.add(nextIncome.salaryRefMonth);
    if (nextIncome.startMonth) {
      monthsToSearch.add(nextIncome.startMonth);
      monthsToSearch.add(shiftMonthStr(nextIncome.startMonth, 1));
    }
    for (const mKey of Object.keys(job.monthOverrides || {})) {
      monthsToSearch.add(mKey);
    }

    for (const mKey of monthsToSearch) {
      const recMap = getMonthReceivedItemsMap(job, mKey);
      for (const [itemId, entry] of Object.entries(recMap)) {
        const matchesDirect = entry.linkedIncomeId === nextIncome.id;
        const matchesInst = (entry.installments || []).some(
          (i) => i.linkedIncomeId === nextIncome.id
        );
        if (matchesDirect || matchesInst || (nextIncome.salaryItemId && itemId === nextIncome.salaryItemId)) {
          return {
            kind: 'received_item',
            income: nextIncome,
            prevIncome,
            job,
            targetMonth: mKey,
            itemLabel: entry.itemName || nextIncome.name,
            oldAmount: prevIncome.amount,
            newAmount: nextIncome.amount,
            oldLabel: prevIncome.name,
            newLabel: nextIncome.name,
            receivedItemId: itemId,
          };
        }
      }
    }
    return null;
  };

  if (nextIncome.id.startsWith('inc_salitem_') || nextIncome.salaryItemId) {
    const recCandidate = checkReceivedItem();
    if (recCandidate) return recCandidate;
  }

  // 2. Check Salary Advance / Deduction (Adelanto / Antecipação de salário)
  const historyMatch = (job.salaryAdvanceHistory || []).find(
    (entry) => entry.id === nextIncome.id
  );

  if (historyMatch || looksLikeSalaryAdvanceIncome(nextIncome) || looksLikeSalaryAdvanceIncome(prevIncome)) {
    const candidateMonths: string[] = [];
    if (historyMatch?.month) candidateMonths.push(historyMatch.month);
    if (nextIncome.startMonth) {
      if (!candidateMonths.includes(nextIncome.startMonth)) {
        candidateMonths.push(nextIncome.startMonth);
      }
      const nextM = shiftMonthStr(nextIncome.startMonth, 1);
      if (!candidateMonths.includes(nextM)) candidateMonths.push(nextM);
      const prevM = shiftMonthStr(nextIncome.startMonth, -1);
      if (!candidateMonths.includes(prevM)) candidateMonths.push(prevM);
    }
    for (const mKey of Object.keys(job.monthOverrides || {})) {
      if (!candidateMonths.includes(mKey)) candidateMonths.push(mKey);
    }

    // Find the deduction item whose calculatedAmount or rawValue matches prevIncome.amount (e.g., 250.000)
    let bestMonth: string | null = null;
    let bestBenefit: { id: string; name: string; calculatedAmount: number } | null = null;

    for (const mKey of candidateMonths) {
      const calc = calculateMonthSalary(job, mKey);
      const deductions = calc.benefits.filter((b) => b.enabled && b.isDeduction);
      const exactMatch = deductions.find(
        (b) => Math.abs(b.calculatedAmount - prevIncome.amount) < 0.01
      );
      if (exactMatch) {
        bestMonth = mKey;
        bestBenefit = exactMatch;
        break;
      }
    }

    // Fallback: if there is a single active deduction in the history/start month, match it
    if (!bestBenefit) {
      for (const mKey of candidateMonths) {
        const calc = calculateMonthSalary(job, mKey);
        const deductions = calc.benefits.filter((b) => b.enabled && b.isDeduction && b.calculatedAmount > 0);
        if (deductions.length === 1) {
          bestMonth = mKey;
          bestBenefit = deductions[0];
          break;
        }
      }
    }

    if (bestMonth && bestBenefit) {
      // Avoid prompting if the deduction already equals the new amount
      if (Math.abs(bestBenefit.calculatedAmount - nextIncome.amount) < 0.01 && !nameChanged) {
        return null;
      }
      return {
        kind: 'advance_deduction',
        income: nextIncome,
        prevIncome,
        job,
        targetMonth: bestMonth,
        itemLabel: bestBenefit.name,
        oldAmount: bestBenefit.calculatedAmount,
        newAmount: nextIncome.amount,
        oldLabel: prevIncome.name,
        newLabel: nextIncome.name,
        deductionBenefitId: bestBenefit.id,
      };
    }
  }

  return checkReceivedItem();
}

function updateLocalJobsCache(uid: string, updatedJob: LaborJob) {
  try {
    const key = `${LOCAL_JOBS_PREFIX}${uid}`;
    const raw = localStorage.getItem(key);
    const list: LaborJob[] = raw ? JSON.parse(raw) : cachedJobs;
    const next = Array.isArray(list)
      ? list.map((j) => (j.id === updatedJob.id ? updatedJob : j))
      : [updatedJob];
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // ignore
  }
}

async function syncMainSalaryIncome(uid: string, updatedJob: LaborJob, targetMonth: string) {
  const calc = calculateMonthSalary(updatedJob, targetMonth);
  const incomeId = updatedJob.linkedSalaryIncomeId || `inc_salary_${updatedJob.id}`;
  const now = new Date().toISOString();

  const activeBenefits = calc.benefits.filter((b) => b.enabled);
  const lines = [
    `Básico: ${formatCurrency(calc.baseSalary, updatedJob.currency)}`,
    ...activeBenefits.map((b) => {
      const pct = b.type === 'percent' ? ` (${b.rawValue}%)` : '';
      const sign = b.isDeduction ? '-' : '+';
      return `${b.name}${pct}: ${sign}${formatCurrency(b.calculatedAmount, updatedJob.currency)}`;
    }),
  ];
  if (calc.extraAmount > 0) {
    lines.push(`Extras do mês: +${formatCurrency(calc.extraAmount, updatedJob.currency)}`);
  }
  if (calc.separatelyReceivedTotal > 0) {
    lines.push(
      `Já recebido separadamente: -${formatCurrency(calc.separatelyReceivedTotal, updatedJob.currency)}`
    );
  }

  const compositionNotes = `${updatedJob.role} • ${lines.join(' | ')}`;
  const breakdown = {
    jobId: updatedJob.id,
    companyName: updatedJob.companyName,
    role: updatedJob.role,
    currency: updatedJob.currency,
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

  const effectiveAmount =
    calc.separatelyReceivedTotal > 0 ? calc.remainingToReceive : calc.netTotal;

  markIncomeAsRecentlySynced(incomeId);

  await setDoc(
    doc(db, 'users', uid, 'incomes', incomeId),
    sanitizePayload({
      exceptions: {
        [targetMonth]: {
          amount: effectiveAmount,
          notes: compositionNotes,
        },
      },
      salaryBreakdowns: {
        [targetMonth]: breakdown,
      },
      updatedAt: now,
    }),
    { merge: true }
  );
}

async function applySyncToLaborAgenda(candidate: SyncCandidate): Promise<void> {
  const uid = currentUid || auth.currentUser?.uid;
  if (!uid) return;

  const { job, targetMonth, newAmount } = candidate;
  const now = new Date().toISOString();
  let updatedJob: LaborJob = JSON.parse(JSON.stringify(job));

  if (candidate.kind === 'advance_deduction' && candidate.deductionBenefitId) {
    const benId = candidate.deductionBenefitId;
    const prevMonthOv = updatedJob.monthOverrides?.[targetMonth] || {};

    // Check if the deduction lives in singleMonthBenefits, extraBenefits, or salaryHistory
    const updateBenefitList = (list?: LaborBenefit[]) =>
      (list || []).map((b) =>
        b.id === benId
          ? { ...b, type: 'fixed' as const, value: newAmount }
          : b
      );

    const hasSingleMonth = (prevMonthOv.singleMonthBenefits || []).some((b) => b.id === benId);
    const hasExtra = (prevMonthOv.extraBenefits || []).some((b) => b.id === benId);

    const nextMonthOv = {
      ...prevMonthOv,
      benefitValueOverrides: {
        ...(prevMonthOv.benefitValueOverrides || {}),
        [benId]: newAmount,
      },
      benefitTypeOverrides: {
        ...(prevMonthOv.benefitTypeOverrides || {}),
        [benId]: 'fixed' as const,
      },
      ...(hasSingleMonth
        ? { singleMonthBenefits: updateBenefitList(prevMonthOv.singleMonthBenefits) }
        : {}),
      ...(hasExtra ? { extraBenefits: updateBenefitList(prevMonthOv.extraBenefits) } : {}),
    };

    updatedJob.monthOverrides = {
      ...(updatedJob.monthOverrides || {}),
      [targetMonth]: nextMonthOv,
    };

    // If the deduction also exists in the effective salary snapshot for this month and no other month overrides it,
    // update it in the snapshot ONLY if it was in salaryHistory for this exact effectiveFromMonth
    const activeSnap = getEffectiveSalarySnapshot(updatedJob, targetMonth);
    if (
      activeSnap &&
      activeSnap.effectiveFromMonth === targetMonth &&
      (activeSnap.benefits || []).some((b) => b.id === benId)
    ) {
      updatedJob.salaryHistory = (updatedJob.salaryHistory || []).map((s) =>
        s.effectiveFromMonth === activeSnap.effectiveFromMonth
          ? { ...s, benefits: updateBenefitList(s.benefits) }
          : s
      );
    }

    // Update salaryAdvanceHistory audit entry if present
    if (Array.isArray(updatedJob.salaryAdvanceHistory)) {
      updatedJob.salaryAdvanceHistory = updatedJob.salaryAdvanceHistory.map((entry) =>
        entry.id === candidate.income.id
          ? { ...entry, amount: newAmount }
          : entry
      );
    }
  } else if (candidate.kind === 'received_item' && candidate.receivedItemId) {
    const itemId = candidate.receivedItemId;
    const prevMonthOv = updatedJob.monthOverrides?.[targetMonth] || {};
    const prevRecMap = { ...(prevMonthOv.receivedItems || {}) };
    const existing: ReceivedSalaryItemEntry | undefined = prevRecMap[itemId];

    if (existing) {
      if (Array.isArray(existing.installments) && existing.installments.length > 0) {
        const nextInstallments = existing.installments.map((inst) =>
          inst.linkedIncomeId === candidate.income.id
            ? { ...inst, amount: newAmount }
            : inst
        );
        const nextTotal =
          Math.round(
            nextInstallments.reduce((sum, i) => sum + (Number(i.amount) || 0), 0) * 100
          ) / 100;
        prevRecMap[itemId] = {
          ...existing,
          amount: nextTotal,
          installments: nextInstallments,
        };
      } else {
        prevRecMap[itemId] = {
          ...existing,
          amount: newAmount,
        };
      }

      updatedJob.monthOverrides = {
        ...(updatedJob.monthOverrides || {}),
        [targetMonth]: {
          ...prevMonthOv,
          receivedItems: prevRecMap,
        },
      };
    }
  }

  updatedJob.updatedAt = now;

  // 1. Save updated LaborJob to Firestore & localStorage
  updateLocalJobsCache(uid, updatedJob);
  await setDoc(
    doc(db, 'users', uid, 'labor_jobs', updatedJob.id),
    sanitizePayload(updatedJob),
    { merge: true }
  );

  // 2. Recalculate and sync the main monthly salary income so all screens reflect the updated net salary
  await syncMainSalaryIncome(uid, updatedJob, targetMonth);
}

function showSyncToast(message: string) {
  const existing = document.getElementById('sisfinz-salary-sync-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'sisfinz-salary-sync-toast';
  toast.style.cssText =
    'position:fixed;top:max(16px,env(safe-area-inset-top,16px));left:50%;transform:translateX(-50%);z-index:10095;max-width:92vw;padding:12px 18px;border-radius:16px;background:linear-gradient(135deg,#059669,#0d9488);color:#ffffff;font-size:12px;font-weight:800;box-shadow:0 16px 40px rgba(5,150,105,0.35);display:flex;align-items:center;gap:8px;font-family:inherit;';
  toast.innerHTML = `<span>✓</span><span>${escapeHtml(message)}</span>`;
  document.body.appendChild(toast);

  window.setTimeout(() => {
    toast.style.transition = 'opacity 250ms ease, transform 250ms ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(-8px)';
    window.setTimeout(() => toast.remove(), 260);
  }, 3200);
}

function closeSyncModal() {
  const existing = document.getElementById(OVERLAY_ID);
  if (existing) existing.remove();
}

function openSyncConfirmModal(candidate: SyncCandidate) {
  closeSyncModal();

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:10085;display:flex;align-items:flex-end;justify-content:center;padding:0;background:rgba(15,23,42,0.58);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);overflow:hidden;overscroll-behavior:contain;';

  const card = document.createElement('div');
  card.style.cssText =
    'width:100%;max-width:min(100vw,440px);background:#ffffff;border-radius:28px 28px 0 0;box-shadow:0 28px 70px rgba(15,23,42,0.34);border:1px solid #a7f3d0;overflow:hidden;font-family:inherit;box-sizing:border-box;';

  if (window.innerWidth >= 640) {
    overlay.style.alignItems = 'center';
    overlay.style.padding = '16px';
    card.style.borderRadius = '28px';
  }

  const currency = candidate.job.currency || candidate.income.currency || 'ARS';
  const monthLabel = formatMonthTitle(candidate.targetMonth);
  const oldValStr = formatCurrency(candidate.oldAmount, currency);
  const newValStr = formatCurrency(candidate.newAmount, currency);

  const kindLabel =
    candidate.kind === 'advance_deduction'
      ? 'Desconto / Antecipação no Salário'
      : 'Item da Composição Salarial';

  let isSaving = false;

  const render = () => {
    card.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;background:linear-gradient(135deg,#059669,#0d9488);color:#ffffff;">
        <div style="min-width:0;">
          <div style="font-size:10px;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:#a7f3d0;">
            Jornada Laboral • Salários
          </div>
          <div style="font-size:15px;font-weight:900;margin-top:2px;">
            Atualizar também nos Salários?
          </div>
        </div>
        <button type="button" data-sync-no style="width:32px;height:32px;border-radius:10px;border:none;background:rgba(255,255,255,0.2);color:#ffffff;font-size:16px;font-weight:900;cursor:pointer;flex-shrink:0;">✕</button>
      </div>

      <div style="padding:18px 20px 22px;display:flex;flex-direction:column;gap:14px;box-sizing:border-box;">
        <div style="font-size:12.5px;font-weight:700;color:#334155;line-height:1.45;">
          Detectamos que você alterou uma receita integrada à aba de <strong>Salários da Jornada Laboral</strong>. Deseja atualizar esse valor lá também (e recalcular o salário previsto em todas as telas)?
        </div>

        <div style="padding:13px 15px;border-radius:18px;background:#ecfdf5;border:1px solid #a7f3d0;display:flex;flex-direction:column;gap:7px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <span style="font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.05em;color:#047857;">
              ${escapeHtml(candidate.job.companyName)} • <span style="text-transform:capitalize;">${escapeHtml(monthLabel)}</span>
            </span>
            <span style="font-size:9.5px;font-weight:900;background:#ffffff;border:1px solid #a7f3d0;color:#065f46;padding:2px 7px;border-radius:9999px;">
              ${escapeHtml(kindLabel)}
            </span>
          </div>

          <div style="font-size:13px;font-weight:900;color:#0f172a;">
            ${escapeHtml(candidate.itemLabel)}
          </div>

          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding-top:6px;border-top:1px dashed #6ee7b7;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">
            <span style="font-size:12px;font-weight:700;color:#94a3b8;text-decoration:line-through;">
              ${escapeHtml(oldValStr)}
            </span>
            <span style="font-size:12px;font-weight:900;color:#059669;">→</span>
            <span style="font-size:15px;font-weight:900;color:#047857;">
              ${escapeHtml(newValStr)}
            </span>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:8px;margin-top:2px;">
          <button type="button" data-sync-yes ${isSaving ? 'disabled' : ''} style="width:100%;padding:13px 16px;border-radius:16px;border:none;background:linear-gradient(135deg,#059669,#0d9488);color:#ffffff;font-size:12px;font-weight:900;letter-spacing:0.04em;text-transform:uppercase;cursor:pointer;box-shadow:0 8px 20px rgba(5,150,105,0.28);">
            ${isSaving ? 'Atualizando...' : '✓ Sim, alterar na Jornada Laboral'}
          </button>
          <button type="button" data-sync-no ${isSaving ? 'disabled' : ''} style="width:100%;padding:12px 16px;border-radius:16px;border:1px solid #e2e8f0;background:#ffffff;color:#475569;font-size:12px;font-weight:800;cursor:pointer;">
            Não, alterar somente na Receita
          </button>
        </div>
      </div>
    `;

    card.querySelectorAll('[data-sync-no]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!isSaving) closeSyncModal();
      });
    });

    card.querySelector('[data-sync-yes]')?.addEventListener('click', async () => {
      if (isSaving) return;
      isSaving = true;
      render();
      try {
        await applySyncToLaborAgenda(candidate);
        closeSyncModal();
        showSyncToast(
          `${candidate.itemLabel} atualizado para ${newValStr} na Jornada Laboral!`
        );
      } catch (err) {
        console.warn('[salaryIncomeSyncPrompt] Failed to sync to Labor Agenda:', err);
        isSaving = false;
        render();
      }
    });
  };

  render();
  overlay.appendChild(card);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay && !isSaving) closeSyncModal();
  });
  document.body.appendChild(overlay);
}

function attachListenersForUser(uid: string) {
  if (unsubIncomes) unsubIncomes();
  if (unsubJobs) unsubJobs();
  prevIncomesMap.clear();
  cachedJobs = [];
  initialIncomesSeeded = false;
  currentUid = uid;

  // 1. Subscribe to labor_jobs
  unsubJobs = onSnapshot(
    collection(db, 'users', uid, 'labor_jobs'),
    (snap) => {
      const list: LaborJob[] = [];
      snap.forEach((docSnap) => {
        list.push({ ...(docSnap.data() as LaborJob), id: docSnap.id });
      });
      cachedJobs = list;
    },
    () => {
      // ignore permission/offline errors
    }
  );

  // 2. Subscribe to incomes and detect edits to linked salary advances / items
  unsubIncomes = onSnapshot(
    collection(db, 'users', uid, 'incomes'),
    (snap) => {
      if (!initialIncomesSeeded) {
        snap.forEach((docSnap) => {
          prevIncomesMap.set(docSnap.id, toTrackedIncome(docSnap.id, docSnap.data()));
        });
        initialIncomesSeeded = true;
        return;
      }

      for (const change of snap.docChanges()) {
        const id = change.doc.id;
        if (change.type === 'removed') {
          prevIncomesMap.delete(id);
          continue;
        }

        const nextIncome = toTrackedIncome(id, change.doc.data());
        const prevIncome = prevIncomesMap.get(id);
        prevIncomesMap.set(id, nextIncome);

        if (change.type !== 'modified' || !prevIncome) continue;
        if (isRecentlySynced(id)) continue;

        const candidate = findSyncCandidate(prevIncome, nextIncome);
        if (candidate) {
          openSyncConfirmModal(candidate);
        }
      }
    },
    () => {
      // ignore permission/offline errors
    }
  );
}

export function initSalaryIncomeSyncPrompt() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  onAuthStateChanged(auth, (user) => {
    if (user?.uid) {
      if (user.uid !== currentUid) {
        attachListenersForUser(user.uid);
      }
    } else {
      currentUid = null;
      if (unsubIncomes) unsubIncomes();
      if (unsubJobs) unsubJobs();
      unsubIncomes = null;
      unsubJobs = null;
      prevIncomesMap.clear();
      cachedJobs = [];
      initialIncomesSeeded = false;
    }
  });
}
