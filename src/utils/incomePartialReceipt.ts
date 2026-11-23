import { collection, doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { AccountItem, CurrencyCode } from '../types';
import { LaborJob } from '../types/labor';
import {
  calculateMonthSalary,
  formatLocalDateYYYYMMDD,
  getMonthReceivedItemsMap,
} from './laborCalculations';
import { formatCurrency } from './currency';
import { getCurrentMonthStr } from './finance';

const LOCAL_JOBS_PREFIX = 'sisfinz_labor_jobs_v1_';
const PARTIAL_STORE_KEY = 'sisfinz_partial_income_state_v1';
const OVERLAY_ID = 'sisfinz-partial-receipt-overlay';
const STYLE_ID = 'sisfinz-partial-receipt-styles';
const PARTIAL_BADGE_CLASS = 'sisfinz-partial-income-badge';

interface CachedIncome {
  id: string;
  name: string;
  amount: number;
  currency?: CurrencyCode;
  category?: string;
  accountId?: string;
  expectedDay?: number;
  expectedDate?: string;
  startMonth?: string;
  recurrence?: string;
  notes?: string;
  laborJobId?: string;
  exceptions?: Record<string, { amount?: number; notes?: string }>;
  partialPending?: Record<
    string,
    {
      originalAmount: number;
      receivedSoFar: number;
      remainingAmount: number;
      installmentCount?: number;
      updatedAt: string;
    }
  >;
}

interface PartialPendingEntry {
  incomeId: string;
  incomeName: string;
  month: string;
  originalAmount: number;
  receivedSoFar: number;
  remainingAmount: number;
  installmentCount: number;
  currency: CurrencyCode;
  updatedAt: string;
}

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

let liveIncomes: CachedIncome[] = [];
let liveAccounts: AccountItem[] = [];
let unsubIncomes: (() => void) | null = null;
let unsubAccounts: (() => void) | null = null;

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

function injectStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes sfFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes sfPopUp {
      0% { opacity: 0; transform: translateY(28px) scale(0.94); }
      72% { opacity: 1; transform: translateY(-3px) scale(1.01); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes sfPulseRing {
      0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.45); }
      50% { box-shadow: 0 0 0 7px rgba(245, 158, 11, 0); }
    }
    .sf-pr-overlay {
      animation: sfFadeIn 0.2s ease-out forwards;
    }
    .sf-pr-card {
      animation: sfPopUp 0.34s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }
    .sf-pr-choice {
      transition: transform 0.18s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.2s ease, border-color 0.2s ease;
    }
    .sf-pr-choice:hover {
      transform: translateY(-2px);
    }
    .sf-pr-choice:active {
      transform: scale(0.97);
    }
    .sf-clock-pending {
      animation: sfPulseRing 2.1s infinite;
    }
  `;
  document.head.appendChild(style);
}

function loadPartialMap(): Record<string, PartialPendingEntry> {
  try {
    const raw = localStorage.getItem(PARTIAL_STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {
    // ignore
  }
  return {};
}

function savePartialMap(map: Record<string, PartialPendingEntry>) {
  try {
    localStorage.setItem(PARTIAL_STORE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

function getPartialKey(incomeId: string, month: string): string {
  return `${month}::${incomeId}`;
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
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as LaborJob[];
    }
  } catch {
    // ignore
  }
  return [];
}

function loadFallbackAccounts(): AccountItem[] {
  if (liveAccounts.length > 0) return liveAccounts;
  const uid = auth.currentUser?.uid;
  try {
    const raw =
      (uid ? localStorage.getItem(`mc_acc_${uid}_accounts`) : null) ||
      localStorage.getItem('mc_acc_last_accounts');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

function detectActiveDashboardMonth(): string {
  try {
    const candidates = document.querySelectorAll(
      'header, main button, main h2, main span, [aria-current="true"]'
    );
    const regex =
      /\b(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|enero|febrero|marzo|mayo|junio|julio|septiembre|octubre|noviembre|diciembre|january|february|march|april|may|june|july|august|september|october|november|december|jan|fev|feb|mar|abr|apr|mai|jun|jul|ago|aug|set|sep|out|oct|nov|dez|dic|dec)\.?\s*(?:de\s*)?(20\d{2})\b/i;

    for (const el of Array.from(candidates)) {
      if ((el as HTMLElement).closest(`#${OVERLAY_ID}`)) continue;
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
    // ignore
  }
  return getCurrentMonthStr();
}

function getEffectiveIncomeAmount(inc: CachedIncome, month: string): number {
  const excAmt = inc.exceptions?.[month]?.amount;
  if (excAmt !== undefined && Number.isFinite(Number(excAmt))) {
    return Number(excAmt);
  }
  return Number(inc.amount) || 0;
}

function parseDisplayedAmount(text: string): number {
  const match = text.match(/[+-]?\s*(?:R\$|US\$|\$|€|₲)\s*([0-9.\s]+(?:,[0-9]{1,2})?)/);
  if (!match) return 0;
  const normalized = match[1].replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const num = Number(normalized);
  return Number.isFinite(num) ? num : 0;
}

function findIncomeCardRow(btn: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = btn.parentElement;
  let depth = 0;
  while (node && depth < 5 && node !== document.body) {
    const h4 = node.querySelector('h4');
    if (h4) return node;
    node = node.parentElement;
    depth++;
  }
  return btn.parentElement?.parentElement || btn.parentElement;
}

function isCheckIconButton(btn: HTMLButtonElement): boolean {
  const cls = btn.className || '';
  const txt = (btn.textContent || '').trim();
  if (txt.length > 0) return false;
  if (!btn.querySelector('svg')) return false;
  if (!cls.includes('w-9') || !cls.includes('h-9')) return false;
  if (cls.includes('text-rose-500') || cls.includes('bg-rose-500/10')) return false;
  const svg = btn.querySelector('svg');
  const svgCls = (svg?.getAttribute('class') || '').toLowerCase();
  if (svgCls.includes('trash') || svgCls.includes('edit') || svgCls.includes('pencil')) {
    return false;
  }
  return true;
}

function isPositiveIncomeCheckButton(btn: HTMLButtonElement): boolean {
  if (btn.dataset.bypassPartialCheck === '1') return false;
  if (
    btn.closest(`#${OVERLAY_ID}`) ||
    btn.closest('#sisfinz-salary-breakdown-overlay') ||
    btn.closest('#sisfinz-salary-editor-overlay') ||
    btn.closest('#sisfinz-item-receive-overlay') ||
    btn.closest('header, nav, [role="dialog"]')
  ) {
    return false;
  }

  if (!isCheckIconButton(btn)) return false;

  const cls = btn.className || '';
  if (
    (cls.includes('bg-emerald-500') || cls.includes('bg-emerald-600')) &&
    btn.dataset.sfClockDecorated !== '1'
  ) {
    return false;
  }

  const actionGroup = btn.parentElement;
  if (!actionGroup) return false;
  const groupText = (actionGroup.textContent || '').trim();
  if (/\+\s*(?:R\$|US\$|ARS|BRL|USD|EUR|PYG|\$|€|₲)/.test(groupText)) {
    return true;
  }

  return false;
}

function matchIncomeFromRow(
  rowEl: HTMLElement,
  activeMonth: string
): {
  income: CachedIncome | null;
  displayName: string;
  displayAmount: number;
  currency: CurrencyCode;
  existingPartial: PartialPendingEntry | null;
} {
  const h4Text = (rowEl.querySelector('h4')?.textContent || '').trim();
  const rowText = (rowEl.textContent || '').trim();
  const displayAmount = parseDisplayedAmount(rowText);

  let matched: CachedIncome | null = null;
  if (liveIncomes.length > 0) {
    const sorted = [...liveIncomes].sort((a, b) => (b.name?.length || 0) - (a.name?.length || 0));
    if (h4Text) {
      matched =
        sorted.find((inc) => inc.name && inc.name.trim().toLowerCase() === h4Text.toLowerCase()) ||
        null;
    }
    if (!matched) {
      matched =
        sorted.find((inc) => inc.name && rowText.toLowerCase().includes(inc.name.toLowerCase())) ||
        null;
    }
  }

  const displayName = matched?.name || h4Text || 'Receita';
  const currency: CurrencyCode = matched?.currency || 'ARS';
  const effectiveAmt = matched ? getEffectiveIncomeAmount(matched, activeMonth) : displayAmount;

  let existingPartial: PartialPendingEntry | null = null;
  if (matched) {
    const fsPartial = matched.partialPending?.[activeMonth];
    const localMap = loadPartialMap();
    const localPartial = localMap[getPartialKey(matched.id, activeMonth)];
    if (fsPartial && fsPartial.remainingAmount > 0) {
      existingPartial = {
        incomeId: matched.id,
        incomeName: matched.name,
        month: activeMonth,
        originalAmount: fsPartial.originalAmount,
        receivedSoFar: fsPartial.receivedSoFar,
        remainingAmount: fsPartial.remainingAmount,
        installmentCount: fsPartial.installmentCount || 1,
        currency,
        updatedAt: fsPartial.updatedAt,
      };
    } else if (localPartial && localPartial.remainingAmount > 0) {
      existingPartial = localPartial;
    }
  }

  return {
    income: matched,
    displayName,
    displayAmount: effectiveAmt > 0 ? effectiveAmt : displayAmount,
    currency,
    existingPartial,
  };
}

function findLinkedLaborJob(inc: CachedIncome | null, displayName: string): LaborJob | null {
  const jobs = loadCachedLaborJobs();
  if (!jobs.length) return null;
  if (inc?.laborJobId) {
    const byId = jobs.find((j) => j.id === inc.laborJobId);
    if (byId) return byId;
  }
  const m = displayName.match(/Sal[aá]rio\s*[•·-]\s*(.+)/i);
  if (m) {
    const target = m[1].trim().toLowerCase();
    return (
      jobs.find((j) => j.companyName.trim().toLowerCase() === target) ||
      jobs.find((j) => target.includes(j.companyName.trim().toLowerCase())) ||
      null
    );
  }
  return null;
}

function closePartialOverlay() {
  const existing = document.getElementById(OVERLAY_ID);
  if (existing) existing.remove();
}

async function applyPartialReceipt(params: {
  income: CachedIncome | null;
  displayName: string;
  totalPendingAmount: number;
  partialAmount: number;
  accountId: string;
  activeMonth: string;
  currency: CurrencyCode;
  existingPartial: PartialPendingEntry | null;
  noteDetail?: string;
}) {
  const {
    income,
    displayName,
    totalPendingAmount,
    partialAmount,
    accountId,
    activeMonth,
    currency,
    existingPartial,
    noteDetail,
  } = params;

  const uid = auth.currentUser?.uid;
  const now = new Date().toISOString();
  const todayStr = formatLocalDateYYYYMMDD(new Date());
  const dayOfMonth = Math.max(
    1,
    Math.min(31, Number(todayStr.slice(8, 10)) || new Date().getDate())
  );
  const remainingAmount = Math.max(0, Math.round((totalPendingAmount - partialAmount) * 100) / 100);
  const nextInstallmentNum = (existingPartial?.installmentCount || 0) + 1;

  const accounts = loadFallbackAccounts();
  const selectedAcc = accounts.find((a) => a.id === accountId) || accounts[0];
  const effectiveCurrency = (selectedAcc?.currency || currency || 'ARS') as CurrencyCode;

  if (uid && selectedAcc && partialAmount > 0) {
    const currentBal = Number(selectedAcc.currentBalance ?? selectedAcc.initialBalance ?? 0);
    const nextBal = Math.round((currentBal + partialAmount) * 100) / 100;
    try {
      await updateDoc(doc(db, 'users', uid, 'accounts', selectedAcc.id), {
        currentBalance: nextBal,
        updatedAt: now,
      });
    } catch {
      await setDoc(
        doc(db, 'users', uid, 'accounts', selectedAcc.id),
        sanitizePayload({ currentBalance: nextBal, updatedAt: now }),
        { merge: true }
      );
    }

    try {
      const updatedAccounts = accounts.map((a) =>
        a.id === selectedAcc.id ? { ...a, currentBalance: nextBal, updatedAt: now } : a
      );
      localStorage.setItem(`mc_acc_${uid}_accounts`, JSON.stringify(updatedAccounts));
      localStorage.setItem('mc_acc_last_accounts', JSON.stringify(updatedAccounts));
    } catch {
      // ignore
    }
  }

  const partialIncomeId = `inc_partial_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const partialNote = noteDetail
    ? `Recebimento parcial (${nextInstallmentNum}ª parte) • ${noteDetail} • Resta: ${formatCurrency(
        remainingAmount,
        effectiveCurrency
      )}`
    : `Recebimento parcial (${nextInstallmentNum}ª parte) de ${displayName} • Resta: ${formatCurrency(
        remainingAmount,
        effectiveCurrency
      )}`;

  if (uid) {
    await setDoc(
      doc(db, 'users', uid, 'incomes', partialIncomeId),
      sanitizePayload({
        id: partialIncomeId,
        name: `${displayName} (Parcial ${nextInstallmentNum})`,
        amount: partialAmount,
        currency: effectiveCurrency,
        category: income?.category || 'Receita',
        expectedDay: dayOfMonth,
        expectedDate: todayStr,
        startMonth: activeMonth,
        recurrence: 'none',
        accountId: selectedAcc?.id || undefined,
        notes: partialNote,
        isPartialReceiptRecord: true,
        parentIncomeId: income?.id || undefined,
        createdAt: now,
        updatedAt: now,
      })
    );

    const statusId = `income_${partialIncomeId}_${activeMonth}`;
    await setDoc(
      doc(db, 'users', uid, 'monthly_status', statusId),
      sanitizePayload({
        id: statusId,
        month: activeMonth,
        itemId: partialIncomeId,
        itemType: 'income',
        isCompleted: true,
        status: 'received',
        completedAt: now,
        accountId: selectedAcc?.id || undefined,
        amount: partialAmount,
      }),
      { merge: true }
    );
  }

  if (income && uid) {
    const originalAmount = existingPartial?.originalAmount || totalPendingAmount;
    const receivedSoFar =
      Math.round(((existingPartial?.receivedSoFar || 0) + partialAmount) * 100) / 100;

    const partialInfo = {
      originalAmount,
      receivedSoFar,
      remainingAmount,
      installmentCount: nextInstallmentNum,
      updatedAt: now,
    };

    const nextExceptions = {
      ...(income.exceptions || {}),
      [activeMonth]: {
        ...(income.exceptions?.[activeMonth] || {}),
        amount: remainingAmount,
        notes: `Restante pendente (já recebido ${formatCurrency(
          receivedSoFar,
          effectiveCurrency
        )} de ${formatCurrency(originalAmount, effectiveCurrency)})`,
      },
    };

    if (income.recurrence === 'none') {
      await setDoc(
        doc(db, 'users', uid, 'incomes', income.id),
        sanitizePayload({
          amount: remainingAmount,
          exceptions: nextExceptions,
          partialPending: {
            ...(income.partialPending || {}),
            [activeMonth]: partialInfo,
          },
          updatedAt: now,
        }),
        { merge: true }
      );
    } else {
      await setDoc(
        doc(db, 'users', uid, 'incomes', income.id),
        sanitizePayload({
          exceptions: nextExceptions,
          partialPending: {
            ...(income.partialPending || {}),
            [activeMonth]: partialInfo,
          },
          updatedAt: now,
        }),
        { merge: true }
      );
    }

    const pMap = loadPartialMap();
    const pKey = getPartialKey(income.id, activeMonth);
    if (remainingAmount > 0) {
      pMap[pKey] = {
        incomeId: income.id,
        incomeName: income.name,
        month: activeMonth,
        originalAmount,
        receivedSoFar,
        remainingAmount,
        installmentCount: nextInstallmentNum,
        currency: effectiveCurrency,
        updatedAt: now,
      };
    } else {
      delete pMap[pKey];
    }
    savePartialMap(pMap);
  }

  window.setTimeout(() => decoratePartialPendingButtons(), 120);
}

function clearPartialPendingState(incomeId: string | undefined, activeMonth: string) {
  if (!incomeId) return;
  const pMap = loadPartialMap();
  delete pMap[getPartialKey(incomeId, activeMonth)];
  savePartialMap(pMap);

  const uid = auth.currentUser?.uid;
  if (uid) {
    setDoc(
      doc(db, 'users', uid, 'incomes', incomeId),
      sanitizePayload({
        partialPending: {
          [activeMonth]: null,
        },
        updatedAt: new Date().toISOString(),
      }),
      { merge: true }
    ).catch(() => {});
  }
}

function openReceiptChoiceModal(params: {
  originalButton: HTMLButtonElement;
  income: CachedIncome | null;
  displayName: string;
  displayAmount: number;
  currency: CurrencyCode;
  activeMonth: string;
  existingPartial: PartialPendingEntry | null;
}) {
  injectStyles();
  closePartialOverlay();

  const {
    originalButton,
    income,
    displayName,
    displayAmount,
    currency,
    activeMonth,
    existingPartial,
  } = params;
  const linkedJob = findLinkedLaborJob(income, displayName);
  const salaryCalc = linkedJob ? calculateMonthSalary(linkedJob, activeMonth) : null;
  const alreadyReceivedItems = linkedJob ? getMonthReceivedItemsMap(linkedJob, activeMonth) : {};
  const accounts = loadFallbackAccounts();

  let step: 'choose' | 'partial' = 'choose';
  let partialMode: 'free' | 'composition' = 'free';
  let selectedAccountId = income?.accountId || linkedJob?.defaultAccountId || accounts[0]?.id || '';
  let freeAmountStr = '';

  type CompDraftItem = {
    id: string;
    name: string;
    fullAmount: number;
    checked: boolean;
    partialValue: number;
  };

  // Subtract any amount already received separately for each item so it can NEVER be double-counted!
  let compItems: CompDraftItem[] = [];
  if (salaryCalc) {
    const basePaid = Number(alreadyReceivedItems['__base__']?.amount) || 0;
    const baseRem = Math.max(0, Math.round((salaryCalc.baseSalary - basePaid) * 100) / 100);
    if (baseRem > 0) {
      compItems.push({
        id: '__base__',
        name: basePaid > 0 ? 'Salário Básico (Restante)' : 'Salário Básico',
        fullAmount: baseRem,
        checked: false,
        partialValue: baseRem,
      });
    }
    for (const b of salaryCalc.benefits.filter((x) => x.enabled && !x.isDeduction && x.calculatedAmount > 0)) {
      const itemPaid = Number(alreadyReceivedItems[b.id]?.amount) || 0;
      const itemRem = Math.max(0, Math.round((b.calculatedAmount - itemPaid) * 100) / 100);
      if (itemRem > 0) {
        compItems.push({
          id: b.id,
          name: itemPaid > 0 ? `${b.name} (Restante)` : b.name,
          fullAmount: itemRem,
          checked: false,
          partialValue: itemRem,
        });
      }
    }
    const extraPaid = Number(alreadyReceivedItems['__extra__']?.amount) || 0;
    const extraRem = Math.max(0, Math.round((salaryCalc.extraAmount - extraPaid) * 100) / 100);
    if (extraRem > 0) {
      compItems.push({
        id: '__extra__',
        name: extraPaid > 0 ? 'Extras / Bônus (Restante)' : 'Extras / Bônus do mês',
        fullAmount: extraRem,
        checked: false,
        partialValue: extraRem,
      });
    }
  }

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.className = 'sf-pr-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:10055;display:flex;align-items:flex-end;justify-content:center;padding:0;background:rgba(15,23,42,0.58);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);overflow:hidden;overscroll-behavior:contain;touch-action:none;';

  const card = document.createElement('div');
  card.className = 'sf-pr-card';
  card.style.cssText =
    'width:100%;max-width:min(100vw,440px);max-height:90dvh;display:flex;flex-direction:column;overflow:hidden;box-sizing:border-box;background:#ffffff;border-radius:28px 28px 0 0;box-shadow:0 28px 65px rgba(15,23,42,0.32);border:1px solid #d1fae5;font-family:inherit;';

  if (window.innerWidth >= 640) {
    overlay.style.alignItems = 'center';
    overlay.style.padding = '16px';
    card.style.borderRadius = '28px';
  }

  const computeCompositionSum = () =>
    compItems.reduce(
      (acc, it) => acc + (it.checked ? Math.max(0, Number(it.partialValue) || 0) : 0),
      0
    );

  const render = () => {
    const partialNumeric =
      partialMode === 'composition'
        ? computeCompositionSum()
        : Math.max(0, Number(freeAmountStr.replace(',', '.')) || 0);
    const remaining = Math.max(0, Math.round((displayAmount - partialNumeric) * 100) / 100);
    const isValidPartial = partialNumeric > 0 && partialNumeric < displayAmount;

    if (step === 'choose') {
      const sepRecTotal = salaryCalc?.separatelyReceivedTotal || 0;
      const effectiveReceivedSoFar = Math.max(existingPartial?.receivedSoFar || 0, sepRecTotal);
      const effectiveOriginal =
        existingPartial?.originalAmount ||
        (sepRecTotal > 0 ? salaryCalc?.netTotal || displayAmount + sepRecTotal : displayAmount);
      const hasProgress = effectiveReceivedSoFar > 0;

      const progressBannerHtml = hasProgress
        ? (() => {
            const pct = Math.min(
              100,
              Math.round((effectiveReceivedSoFar / Math.max(1, effectiveOriginal)) * 100)
            );
            return `
              <div style="padding:12px 14px;border-radius:16px;background:#fff7ed;border:1px solid #fdba74;display:flex;flex-direction:column;gap:6px;">
                <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:800;color:#9a3412;">
                  <span>⏳ Recebimento em andamento</span>
                  <span>${pct}% já separado</span>
                </div>
                <div style="height:6px;border-radius:9999px;background:#ffedd5;overflow:hidden;">
                  <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#f59e0b,#10b981);border-radius:9999px;"></div>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:10.5px;font-weight:700;color:#c2410c;">
                  <span>Já recebido/separado: ${escapeHtml(
                    formatCurrency(effectiveReceivedSoFar, currency)
                  )}</span>
                  <span>Resta: ${escapeHtml(formatCurrency(displayAmount, currency))}</span>
                </div>
              </div>
            `;
          })()
        : '';

      const totalTitle = hasProgress
        ? 'Receber valor restante total'
        : 'Marcar como recebido valor total';
      const totalSub = hasProgress
        ? `Quita apenas os ${escapeHtml(
            formatCurrency(displayAmount, currency)
          )} restantes (sem duplicar o que já caiu) e muda para verde.`
        : `Entra ${escapeHtml(formatCurrency(displayAmount, currency))} inteiro na sua conta e fica verde.`;

      const partialTitle = hasProgress
        ? 'Receber mais uma parte (parcial)'
        : 'Marcar como recebido valor parcial';
      const partialSub =
        'Registra o que caiu agora na conta e mantém o restante pendente com relógio laranja.';

      card.innerHTML = `
        <div style="padding:20px 20px 16px;background:linear-gradient(135deg,#059669 0%,#0d9488 100%);color:#ffffff;position:relative;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
            <div style="min-width:0;">
              <div style="display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,0.18);padding:3px 10px;border-radius:9999px;font-size:10px;font-weight:900;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:8px;">
                <span>✨</span> Confirmar Recebimento
              </div>
              <div style="font-size:16px;font-weight:900;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(
                displayName
              )}</div>
              <div style="font-size:12px;font-weight:700;color:#d1fae5;margin-top:4px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">
                Valor pendente: ${escapeHtml(formatCurrency(displayAmount, currency))}
              </div>
            </div>
            <button type="button" data-close-pr style="width:34px;height:34px;border-radius:12px;border:none;background:rgba(255,255,255,0.2);color:#ffffff;font-size:17px;font-weight:900;cursor:pointer;flex-shrink:0;">✕</button>
          </div>
        </div>

        <div style="padding:18px 20px 22px;display:flex;flex-direction:column;gap:12px;overflow-y:auto;overflow-x:hidden;touch-action:pan-y;box-sizing:border-box;">
          ${progressBannerHtml}

          <div style="font-size:12px;font-weight:700;color:#475569;text-align:center;margin-bottom:2px;">
            Como você recebeu este valor?
          </div>

          <button type="button" data-choose-total class="sf-pr-choice" style="width:100%;text-align:left;padding:16px;border-radius:20px;border:2px solid #a7f3d0;background:linear-gradient(135deg,#ecfdf5 0%,#d1fae5 100%);cursor:pointer;display:flex;align-items:center;gap:14px;box-shadow:0 6px 18px rgba(5,150,105,0.12);box-sizing:border-box;">
            <div style="width:46px;height:46px;border-radius:16px;background:linear-gradient(135deg,#10b981,#059669);color:#ffffff;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 6px 14px rgba(5,150,105,0.3);">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
            </div>
            <div style="min-width:0;flex:1;">
              <div style="font-size:14px;font-weight:900;color:#064e3b;">${totalTitle}</div>
              <div style="font-size:11.5px;font-weight:600;color:#047857;margin-top:2px;line-height:1.35;">${totalSub}</div>
            </div>
          </button>

          <button type="button" data-choose-partial class="sf-pr-choice" style="width:100%;text-align:left;padding:16px;border-radius:20px;border:2px solid #fed7aa;background:linear-gradient(135deg,#fffbeb 0%,#ffedd5 100%);cursor:pointer;display:flex;align-items:center;gap:14px;box-shadow:0 6px 18px rgba(245,158,11,0.12);box-sizing:border-box;">
            <div style="width:46px;height:46px;border-radius:16px;background:linear-gradient(135deg,#f59e0b,#ea580c);color:#ffffff;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 6px 14px rgba(234,88,12,0.3);">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div style="min-width:0;flex:1;">
              <div style="font-size:14px;font-weight:900;color:#7c2d12;">${partialTitle}</div>
              <div style="font-size:11.5px;font-weight:600;color:#c2410c;margin-top:2px;line-height:1.35;">${partialSub}</div>
            </div>
          </button>

          <button type="button" data-close-pr style="width:100%;padding:11px;border-radius:14px;border:1px solid #e2e8f0;background:#ffffff;color:#64748b;font-size:12px;font-weight:800;cursor:pointer;margin-top:2px;">
            Cancelar
          </button>
        </div>
      `;

      card
        .querySelectorAll('[data-close-pr]')
        .forEach((b) => b.addEventListener('click', closePartialOverlay));
      card.querySelector('[data-choose-total]')?.addEventListener('click', () => {
        clearPartialPendingState(income?.id, activeMonth);
        closePartialOverlay();
        originalButton.dataset.bypassPartialCheck = '1';
        originalButton.dataset.sfClockDecorated = '0';
        originalButton.classList.remove('sf-clock-pending');
        originalButton.style.backgroundColor = '';
        originalButton.style.borderColor = '';
        originalButton.style.color = '';
        originalButton.click();
        window.setTimeout(() => {
          delete originalButton.dataset.bypassPartialCheck;
        }, 300);
      });
      card.querySelector('[data-choose-partial]')?.addEventListener('click', () => {
        step = 'partial';
        render();
      });
      return;
    }

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

    const modeTabsHtml =
      compItems.length > 0
        ? `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;background:#f1f5f9;padding:4px;border-radius:14px;">
          <button type="button" data-mode="free" style="padding:8px;border-radius:10px;border:none;font-size:11px;font-weight:900;cursor:pointer;${
            partialMode === 'free'
              ? 'background:#ffffff;color:#c2410c;box-shadow:0 1px 3px rgba(0,0,0,0.08);'
              : 'background:transparent;color:#64748b;'
          }">Valor livre</button>
          <button type="button" data-mode="composition" style="padding:8px;border-radius:10px;border:none;font-size:11px;font-weight:900;cursor:pointer;${
            partialMode === 'composition'
              ? 'background:#ffffff;color:#047857;box-shadow:0 1px 3px rgba(0,0,0,0.08);'
              : 'background:transparent;color:#64748b;'
          }">Por itens restantes</button>
        </div>
      `
        : '';

    const freeBodyHtml = `
      <div style="display:flex;flex-direction:column;gap:8px;">
        <label style="font-size:10.5px;font-weight:900;text-transform:uppercase;letter-spacing:0.05em;color:#475569;">
          Quanto caiu agora na sua conta? (${escapeHtml(currency)})
        </label>
        <input type="number" inputmode="decimal" step="any" data-free-input value="${escapeHtml(
          freeAmountStr
        )}" placeholder="Ex: ${Math.round(
      displayAmount / 2
    )}" style="width:100%;box-sizing:border-box;padding:13px 14px;border-radius:16px;border:2px solid #fdba74;background:#fffbeb;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:18px;font-weight:900;color:#0f172a;outline:none;" />
        <div style="display:flex;gap:6px;">
          ${[25, 50, 75]
            .map(
              (pct) =>
                `<button type="button" data-pct="${pct}" style="flex:1;padding:7px;border-radius:10px;border:1px solid #fed7aa;background:#ffffff;color:#c2410c;font-size:11px;font-weight:900;cursor:pointer;">${pct}%</button>`
            )
            .join('')}
        </div>
      </div>
    `;

    const compBodyHtml = `
      <div style="display:flex;flex-direction:column;gap:8px;max-height:210px;overflow-y:auto;overflow-x:hidden;padding-right:2px;">
        <div style="font-size:10.5px;font-weight:800;color:#475569;">
          Itens ainda pendentes (valores já recebidos separadamente foram descontados):
        </div>
        ${compItems
          .map(
            (it) => `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 10px;border-radius:14px;border:1px solid ${
            it.checked ? '#6ee7b7' : '#e2e8f0'
          };background:${it.checked ? '#ecfdf5' : '#f8fafc'};">
            <label style="display:flex;align-items:center;gap:8px;min-width:0;flex:1;cursor:pointer;">
              <input type="checkbox" data-comp-check="${escapeHtml(it.id)}" ${
              it.checked ? 'checked' : ''
            } style="width:16px;height:16px;accent-color:#059669;cursor:pointer;" />
              <span style="font-size:12px;font-weight:800;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(
                it.name
              )}</span>
            </label>
            <input type="number" inputmode="decimal" step="any" data-comp-val="${escapeHtml(
              it.id
            )}" value="${it.partialValue}" ${
              it.checked ? '' : 'disabled'
            } style="width:104px;padding:6px 8px;border-radius:10px;border:1px solid #cbd5e1;background:#ffffff;text-align:right;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;font-weight:800;color:#0f172a;opacity:${
              it.checked ? '1' : '0.45'
            };" />
          </div>
        `
          )
          .join('')}
      </div>
    `;

    card.innerHTML = `
      <div style="padding:18px 20px;background:linear-gradient(135deg,#f59e0b 0%,#ea580c 100%);color:#ffffff;display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <div style="min-width:0;">
          <div style="font-size:10px;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:#ffedd5;">Recebimento Parcial</div>
          <div style="font-size:15px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(
            displayName
          )}</div>
          <div style="font-size:11px;font-weight:700;color:#fef3c7;">Total pendente: ${escapeHtml(
            formatCurrency(displayAmount, currency)
          )}</div>
        </div>
        <button type="button" data-close-pr style="width:34px;height:34px;border-radius:12px;border:none;background:rgba(255,255,255,0.2);color:#ffffff;font-size:17px;font-weight:900;cursor:pointer;">✕</button>
      </div>

      <div style="padding:16px 20px 20px;display:flex;flex-direction:column;gap:13px;overflow-y:auto;overflow-x:hidden;touch-action:pan-y;box-sizing:border-box;">
        ${modeTabsHtml}
        ${partialMode === 'composition' ? compBodyHtml : freeBodyHtml}

        <div>
          <label style="display:block;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;margin-bottom:5px;">
            Conta que recebe este valor
          </label>
          <select data-acc-select style="width:100%;padding:10px 12px;border-radius:12px;border:1px solid #cbd5e1;background:#f8fafc;font-size:12px;font-weight:800;color:#0f172a;">
            ${accOptionsHtml}
          </select>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div style="padding:10px 12px;border-radius:14px;background:#ecfdf5;border:1px solid #a7f3d0;">
            <div style="font-size:9.5px;font-weight:900;text-transform:uppercase;color:#047857;">Cai agora na conta</div>
            <div data-preview-now style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:14px;font-weight:900;color:#059669;margin-top:2px;">+${escapeHtml(
              formatCurrency(partialNumeric, currency)
            )}</div>
          </div>
          <div style="padding:10px 12px;border-radius:14px;background:#fff7ed;border:1px solid #fed7aa;">
            <div style="font-size:9.5px;font-weight:900;text-transform:uppercase;color:#c2410c;">Restante pendente</div>
            <div data-preview-rem style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:14px;font-weight:900;color:#ea580c;margin-top:2px;">${escapeHtml(
              formatCurrency(remaining, currency)
            )}</div>
          </div>
        </div>

        <div data-error-box style="display:none;padding:9px 12px;border-radius:12px;background:#fff1f2;border:1px solid #fecdd3;color:#be123c;font-size:11px;font-weight:700;"></div>

        <div style="display:grid;grid-template-columns:1fr 2fr;gap:8px;margin-top:2px;">
          <button type="button" data-back-step style="padding:12px;border-radius:14px;border:1px solid #e2e8f0;background:#ffffff;color:#475569;font-size:12px;font-weight:800;cursor:pointer;">
            Voltar
          </button>
          <button type="button" data-confirm-partial ${
            isValidPartial ? '' : 'disabled'
          } style="padding:12px;border-radius:14px;border:none;background:${
            isValidPartial ? 'linear-gradient(135deg,#f59e0b,#ea580c)' : '#cbd5e1'
          };color:#ffffff;font-size:12px;font-weight:900;letter-spacing:0.04em;text-transform:uppercase;cursor:${
            isValidPartial ? 'pointer' : 'not-allowed'
          };box-shadow:${isValidPartial ? '0 8px 20px rgba(234,88,12,0.28)' : 'none'};">
            Confirmar Parcial
          </button>
        </div>
      </div>
    `;

    card
      .querySelectorAll('[data-close-pr]')
      .forEach((b) => b.addEventListener('click', closePartialOverlay));
    card.querySelector('[data-back-step]')?.addEventListener('click', () => {
      step = 'choose';
      render();
    });

    card.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        partialMode = btn.dataset.mode === 'composition' ? 'composition' : 'free';
        render();
      });
    });

    const accSel = card.querySelector<HTMLSelectElement>('[data-acc-select]');
    accSel?.addEventListener('change', () => {
      selectedAccountId = accSel.value;
    });

    const updatePreviewLive = (val: number) => {
      const rem = Math.max(0, Math.round((displayAmount - val) * 100) / 100);
      const valid = val > 0 && val < displayAmount;
      const nowEl = card.querySelector('[data-preview-now]');
      const remEl = card.querySelector('[data-preview-rem]');
      const confirmBtn = card.querySelector<HTMLButtonElement>('[data-confirm-partial]');
      if (nowEl) nowEl.textContent = `+${formatCurrency(val, currency)}`;
      if (remEl) remEl.textContent = formatCurrency(rem, currency);
      if (confirmBtn) {
        confirmBtn.disabled = !valid;
        confirmBtn.style.background = valid
          ? 'linear-gradient(135deg,#f59e0b,#ea580c)'
          : '#cbd5e1';
        confirmBtn.style.cursor = valid ? 'pointer' : 'not-allowed';
      }
    };

    const freeInput = card.querySelector<HTMLInputElement>('[data-free-input]');
    freeInput?.addEventListener('input', () => {
      freeAmountStr = freeInput.value;
      updatePreviewLive(Math.max(0, Number(freeAmountStr.replace(',', '.')) || 0));
    });

    card.querySelectorAll<HTMLButtonElement>('[data-pct]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const pct = Number(btn.dataset.pct) || 50;
        const calcVal = Math.round(((displayAmount * pct) / 100) * 100) / 100;
        freeAmountStr = String(calcVal);
        if (freeInput) freeInput.value = freeAmountStr;
        updatePreviewLive(calcVal);
      });
    });

    card.querySelectorAll<HTMLInputElement>('[data-comp-check]').forEach((cb) => {
      cb.addEventListener('change', () => {
        const id = cb.dataset.compCheck;
        compItems = compItems.map((it) => (it.id === id ? { ...it, checked: cb.checked } : it));
        render();
      });
    });

    card.querySelectorAll<HTMLInputElement>('[data-comp-val]').forEach((inp) => {
      inp.addEventListener('input', () => {
        const id = inp.dataset.compVal;
        const num = Math.max(0, Number(inp.value.replace(',', '.')) || 0);
        compItems = compItems.map((it) => (it.id === id ? { ...it, partialValue: num } : it));
        updatePreviewLive(computeCompositionSum());
      });
    });

    const confirmBtn = card.querySelector<HTMLButtonElement>('[data-confirm-partial]');
    confirmBtn?.addEventListener('click', async () => {
      const amountToReceive =
        partialMode === 'composition'
          ? computeCompositionSum()
          : Math.max(0, Number(freeAmountStr.replace(',', '.')) || 0);
      const errBox = card.querySelector<HTMLElement>('[data-error-box]');

      if (amountToReceive <= 0) {
        if (errBox) {
          errBox.style.display = 'block';
          errBox.textContent = 'Informe um valor maior que zero.';
        }
        return;
      }
      if (amountToReceive >= displayAmount) {
        if (errBox) {
          errBox.style.display = 'block';
          errBox.textContent =
            'O valor informado é igual ou maior que o total. Volte e use "Valor total".';
        }
        return;
      }

      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Registrando...';

      const detailParts =
        partialMode === 'composition'
          ? compItems
              .filter((it) => it.checked && it.partialValue > 0)
              .map((it) => `${it.name} (${formatCurrency(it.partialValue, currency)})`)
              .join(', ')
          : undefined;

      try {
        await applyPartialReceipt({
          income,
          displayName,
          totalPendingAmount: displayAmount,
          partialAmount: amountToReceive,
          accountId: selectedAccountId,
          activeMonth,
          currency,
          existingPartial,
          noteDetail: detailParts,
        });
        closePartialOverlay();
      } catch (err: any) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirmar Parcial';
        if (errBox) {
          errBox.style.display = 'block';
          errBox.textContent = err?.message || 'Erro ao salvar recebimento parcial.';
        }
      }
    });
  };

  render();
  overlay.appendChild(card);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closePartialOverlay();
  });
  document.body.appendChild(overlay);
}

/** Visually turn pending partial incomes' right-side check button into an orange pulsing clock + remaining badge */
function decoratePartialPendingButtons() {
  if (typeof document === 'undefined') return;
  const activeMonth = detectActiveDashboardMonth();
  const pMap = loadPartialMap();

  for (const inc of liveIncomes) {
    const pp = inc.partialPending?.[activeMonth];
    const key = getPartialKey(inc.id, activeMonth);
    if (pp && pp.remainingAmount > 0) {
      pMap[key] = {
        incomeId: inc.id,
        incomeName: inc.name,
        month: activeMonth,
        originalAmount: pp.originalAmount,
        receivedSoFar: pp.receivedSoFar,
        remainingAmount: pp.remainingAmount,
        installmentCount: pp.installmentCount || 1,
        currency: inc.currency || 'ARS',
        updatedAt: pp.updatedAt,
      };
    }
  }

  const activePartials = Object.values(pMap).filter(
    (entry) => entry.month === activeMonth && entry.remainingAmount > 0
  );
  if (activePartials.length === 0) return;

  const buttons = document.querySelectorAll<HTMLButtonElement>('button');
  for (const btn of Array.from(buttons)) {
    if (!isPositiveIncomeCheckButton(btn)) continue;

    const row = findIncomeCardRow(btn);
    if (!row) continue;
    const h4Text = (row.querySelector('h4')?.textContent || '').trim().toLowerCase();
    const rowText = (row.textContent || '').toLowerCase();

    const matchedPartial = activePartials.find(
      (p) =>
        p.incomeName &&
        (h4Text === p.incomeName.toLowerCase() || rowText.includes(p.incomeName.toLowerCase()))
    );
    if (!matchedPartial) continue;

    if (btn.dataset.sfClockDecorated !== '1') {
      btn.dataset.sfClockDecorated = '1';
      btn.classList.add('sf-clock-pending');
      btn.style.backgroundColor = '#ffedd5';
      btn.style.borderColor = '#fb923c';
      btn.style.color = '#ea580c';
      btn.setAttribute(
        'title',
        `Recebimento parcial • Restante pendente: ${formatCurrency(
          matchedPartial.remainingAmount,
          matchedPartial.currency
        )}`
      );
      btn.innerHTML = `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
    }

    if (!row.querySelector(`.${PARTIAL_BADGE_CLASS}`)) {
      const badge = document.createElement('span');
      badge.className = PARTIAL_BADGE_CLASS;
      badge.textContent = `⏳ Parcial • Já caiu ${formatCurrency(
        matchedPartial.receivedSoFar,
        matchedPartial.currency
      )}`;
      badge.style.cssText =
        'display:inline-flex;align-items:center;gap:4px;margin-top:4px;padding:2px 8px;border-radius:9999px;background:#fff7ed;border:1px solid #fdba74;color:#c2410c;font-size:10px;font-weight:800;';
      const h4 = row.querySelector('h4');
      h4?.parentElement?.insertAdjacentElement('afterend', badge);
    }
  }
}

function subscribeUserData(uid: string | null) {
  if (unsubIncomes) {
    unsubIncomes();
    unsubIncomes = null;
  }
  if (unsubAccounts) {
    unsubAccounts();
    unsubAccounts = null;
  }
  if (!uid) {
    liveIncomes = [];
    liveAccounts = [];
    return;
  }

  unsubIncomes = onSnapshot(
    collection(db, 'users', uid, 'incomes'),
    (snap) => {
      const list: CachedIncome[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...(d.data() as Omit<CachedIncome, 'id'>) });
      });
      liveIncomes = list;
      decoratePartialPendingButtons();
    },
    () => {}
  );

  unsubAccounts = onSnapshot(
    collection(db, 'users', uid, 'accounts'),
    (snap) => {
      const list: AccountItem[] = [];
      snap.forEach((d) => {
        const data = d.data() as AccountItem;
        if (data.isActive !== false) {
          list.push({ ...data, id: d.id });
        }
      });
      liveAccounts = list;
    },
    () => {}
  );
}

let initialized = false;
let decorateTimer: number | null = null;

export function initIncomePartialReceipt() {
  if (initialized || typeof window === 'undefined' || typeof document === 'undefined') return;
  initialized = true;

  injectStyles();

  auth.onAuthStateChanged((u) => {
    subscribeUserData(u?.uid || null);
  });
  if (auth.currentUser?.uid) {
    subscribeUserData(auth.currentUser.uid);
  }

  const scheduleDecorate = () => {
    if (decorateTimer !== null) window.clearTimeout(decorateTimer);
    decorateTimer = window.setTimeout(() => {
      decorateTimer = null;
      decoratePartialPendingButtons();
    }, 150);
  };

  const observer = new MutationObserver(() => {
    scheduleDecorate();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePartialOverlay();
  });

  document.addEventListener(
    'click',
    (event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const btn = target.closest('button') as HTMLButtonElement | null;
      if (!btn) return;
      if (!isPositiveIncomeCheckButton(btn)) return;

      const row = findIncomeCardRow(btn);
      if (!row) return;

      const activeMonth = detectActiveDashboardMonth();
      const { income, displayName, displayAmount, currency, existingPartial } = matchIncomeFromRow(
        row,
        activeMonth
      );
      if (displayAmount <= 0) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      openReceiptChoiceModal({
        originalButton: btn,
        income,
        displayName,
        displayAmount,
        currency,
        activeMonth,
        existingPartial,
      });
    },
    true
  );
}
