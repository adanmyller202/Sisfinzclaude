import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { BenefitCalcType, LaborBenefit, LaborJob } from '../types/labor';
import { calculateMonthSalary, getEffectiveSalarySnapshot } from './laborCalculations';
import { formatCurrency } from './currency';
import { getCurrentMonthStr, shiftMonthStr } from './finance';

const LOCAL_JOBS_PREFIX = 'sisfinz_labor_jobs_v1_';
const BADGE_CLASS = 'sisfinz-salary-breakdown-chip';
const OVERLAY_ID = 'sisfinz-salary-breakdown-overlay';
const EDITOR_OVERLAY_ID = 'sisfinz-salary-editor-overlay';

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

async function persistUpdatedJobAndSyncIncome(params: {
  updatedJob: LaborJob;
  targetMonth: string;
  scope: 'single' | 'future';
  syncWithFinance: boolean;
}): Promise<LaborJob> {
  const { updatedJob, targetMonth, scope, syncWithFinance } = params;
  const now = new Date().toISOString();
  const stamped: LaborJob = { ...updatedJob, updatedAt: now };

  // 1. Update localStorage cache so all screens reflect immediately
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
    // 2. Sync LaborJob to Firestore (Meus Trabalhos updates in real time via onSnapshot)
    await setDoc(
      doc(db, 'users', uid, 'labor_jobs', stamped.id),
      sanitizePayload(stamped),
      { merge: true }
    );

    // 3. Sync Income in Receitas if enabled
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
      };

      const incomeId = stamped.linkedSalaryIncomeId || `inc_salary_${stamped.id}`;
      const expectedDate = `${targetMonth}-05`;
      const incomeRef = doc(db, 'users', uid, 'incomes', incomeId);

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
              [targetMonth]: { amount: calc.netTotal, notes: compositionNotes },
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
            salaryBreakdown: breakdown,
            salaryBreakdowns: {
              [targetMonth]: breakdown,
            },
            updatedAt: now,
          }),
          { merge: true }
        );
      }
    }
  }

  return stamped;
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
      if ((el as HTMLElement).closest(`#${OVERLAY_ID}, #${EDITOR_OVERLAY_ID}`)) continue;
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

function closeEditorOverlay() {
  const existing = document.getElementById(EDITOR_OVERLAY_ID);
  if (existing) existing.remove();
}

function closeBreakdownOverlay() {
  closeEditorOverlay();
  const existing = document.getElementById(OVERLAY_ID);
  if (existing) existing.remove();
}

/**
 * Stacked Salary & Benefits Editor overlay rendered ON TOP of the Composição Salarial modal.
 * Strictly locked horizontally (vertical scroll only) with crisp red trash icon matching the app.
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
      if (newExtra > 0) {
        nextOverrides[targetMonth] = { extraAmount: newExtra };
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

        <!-- Add New Benefit / Deduction Box (strictly contained, zero horizontal overflow) -->
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

  const openEditorFromBreakdown = (focusItemId?: string, scrollToAdd?: boolean) => {
    openStackedSalaryEditor({
      job: activeJob,
      targetMonth: currentMonth,
      focusItemId,
      scrollToAdd,
      onSaved: (updatedJob) => {
        activeJob = updatedJob;
        savedFlashMsg = 'Composição atualizada aqui e em Meus Trabalhos!';
        renderContent();
        window.setTimeout(() => {
          savedFlashMsg = null;
          if (document.getElementById(OVERLAY_ID)) renderContent();
        }, 2800);
      },
    });
  };

  const renderContent = () => {
    const calc = calculateMonthSalary(activeJob, currentMonth);
    const enabledItems = calc.benefits.filter((b) => b.enabled);
    const additions = enabledItems.filter((b) => !b.isDeduction);
    const deductions = enabledItems.filter((b) => Boolean(b.isDeduction));

    const editIconSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;

    const benefitRowsHtml = additions
      .map((b) => {
        const pctTag =
          b.type === 'percent'
            ? `<span style="font-size:10.5px;font-weight:800;color:#047857;margin-left:4px;">(${b.rawValue}%)</span>`
            : '';
        return `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 0;border-bottom:1px dashed #e2e8f0;font-size:13px;">
            <span style="font-weight:700;color:#334155;min-width:0;flex:1;">${escapeHtml(b.name)}${pctTag}</span>
            <div style="display:inline-flex;align-items:center;gap:6px;flex-shrink:0;">
              <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:800;color:#059669;white-space:nowrap;">+${escapeHtml(formatCurrency(b.calculatedAmount, activeJob.currency))}</span>
              <button type="button" data-edit-item="${escapeHtml(b.id)}" title="Editar ${escapeHtml(b.name)}" style="width:24px;height:24px;border-radius:8px;border:1px solid #a7f3d0;background:#ffffff;color:#047857;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;">${editIconSvg}</button>
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
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 0;border-bottom:1px dashed #fecdd3;font-size:13px;">
            <span style="font-weight:700;color:#be123c;display:inline-flex;align-items:center;gap:6px;min-width:0;flex:1;">
              ${escapeHtml(b.name)}${pctTag}
              <span style="font-size:9px;font-weight:900;text-transform:uppercase;background:#ffe4e6;color:#be123c;padding:1px 6px;border-radius:9999px;">Desconto</span>
            </span>
            <div style="display:inline-flex;align-items:center;gap:6px;flex-shrink:0;">
              <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:800;color:#e11d48;white-space:nowrap;">-${escapeHtml(formatCurrency(b.calculatedAmount, activeJob.currency))}</span>
              <button type="button" data-edit-item="${escapeHtml(b.id)}" title="Editar ${escapeHtml(b.name)}" style="width:24px;height:24px;border-radius:8px;border:1px solid #fecdd3;background:#ffffff;color:#be123c;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;">${editIconSvg}</button>
            </div>
          </div>
        `;
      })
      .join('');

    const extraRowHtml =
      calc.extraAmount > 0
        ? `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px dashed #e2e8f0;font-size:13px;">
            <span style="font-weight:700;color:#065f46;">Extras / Bônus do mês</span>
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:800;color:#059669;white-space:nowrap;">+${escapeHtml(formatCurrency(calc.extraAmount, activeJob.currency))}</span>
          </div>
        `
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
      ? `<div style="padding:8px 12px;border-radius:12px;background:#059669;color:#ffffff;font-size:11.5px;font-weight:800;text-align:center;">✓ ${escapeHtml(savedFlashMsg)}</div>`
      : '';

    card.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;background:linear-gradient(135deg,#059669,#0d9488);color:#ffffff;flex-shrink:0;">
        <div style="min-width:0;">
          <div style="font-size:10px;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:#a7f3d0;">Composição Salarial</div>
          <div style="font-size:15px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Salário • ${escapeHtml(activeJob.companyName)}</div>
          <div style="font-size:11px;font-weight:600;color:#d1fae5;">${escapeHtml(activeJob.role)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
          <button type="button" data-open-full-editor title="Editar salário e benefícios" style="height:34px;padding:0 10px;border-radius:12px;border:none;background:rgba(255,255,255,0.2);color:#ffffff;font-size:11px;font-weight:900;cursor:pointer;display:inline-flex;align-items:center;gap:5px;">
            ${editIconSvg} Editar
          </button>
          <button type="button" data-close-breakdown style="width:34px;height:34px;border-radius:12px;border:none;background:rgba(255,255,255,0.18);color:#ffffff;font-size:18px;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
        </div>
      </div>

      <div style="padding:16px 20px 20px;overflow-y:auto;overflow-x:hidden;overscroll-behavior-x:none;overscroll-behavior-y:contain;touch-action:pan-y;display:flex;flex-direction:column;gap:13px;width:100%;box-sizing:border-box;">
        ${flashHtml}

        <div style="display:flex;align-items:center;justify-content:space-between;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:6px 8px;">
          <button type="button" data-prev-month style="width:32px;height:32px;border-radius:10px;border:none;background:#ffffff;color:#334155;font-size:16px;font-weight:900;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,0.06);">‹</button>
          <span style="font-size:12.5px;font-weight:900;color:#0f172a;text-transform:capitalize;">${escapeHtml(formatMonthLabel(currentMonth))}</span>
          <button type="button" data-next-month style="width:32px;height:32px;border-radius:10px;border:none;background:#ffffff;color:#334155;font-size:16px;font-weight:900;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,0.06);">›</button>
        </div>

        <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:18px;padding:14px 16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding-bottom:8px;border-bottom:1px solid #a7f3d0;font-size:13.5px;">
            <span style="font-weight:900;color:#0f172a;">Salário Básico</span>
            <div style="display:inline-flex;align-items:center;gap:6px;">
              <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:900;color:#0f172a;white-space:nowrap;">${escapeHtml(formatCurrency(calc.baseSalary, activeJob.currency))}</span>
              <button type="button" data-open-full-editor title="Editar Salário Básico" style="width:24px;height:24px;border-radius:8px;border:1px solid #a7f3d0;background:#ffffff;color:#047857;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;">${editIconSvg}</button>
            </div>
          </div>

          <div style="padding:4px 0;">
            ${benefitRowsHtml}
            ${extraRowHtml}
            ${deductionRowsHtml}
            ${emptyBenefitsHtml}
          </div>

          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:10px;margin-top:4px;border-top:2px solid #6ee7b7;font-size:15px;">
            <span style="font-weight:900;color:#064e3b;">Total a Receber</span>
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:900;color:#047857;white-space:nowrap;">${escapeHtml(formatCurrency(calc.netTotal, activeJob.currency))}</span>
          </div>
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;font-weight:600;color:#64748b;padding:0 2px;">
          <span>Sincronizado pela Jornada Laboral</span>
          <span>${escapeHtml(footerCounts)}</span>
        </div>

        <!-- Add Benefit / Deduction button directly inside Composição Salarial -->
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
      btn.addEventListener('click', () => openEditorFromBreakdown());
    });
    card.querySelectorAll<HTMLButtonElement>('[data-edit-item]').forEach((btn) => {
      btn.addEventListener('click', () => openEditorFromBreakdown(btn.dataset.editItem));
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
      parent.closest(`#${OVERLAY_ID}, #${EDITOR_OVERLAY_ID}, #sisfinz-partial-receipt-overlay`) ||
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
      if (document.getElementById(EDITOR_OVERLAY_ID)) {
        closeEditorOverlay();
      } else {
        closeBreakdownOverlay();
      }
    }
  });

  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    if (!target || target.closest(`#${OVERLAY_ID}, #${EDITOR_OVERLAY_ID}`)) return;

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
