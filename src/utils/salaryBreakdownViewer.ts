import { auth } from '../firebase/config';
import { LaborJob } from '../types/labor';
import { calculateMonthSalary } from './laborCalculations';
import { formatCurrency } from './currency';
import { getCurrentMonthStr, shiftMonthStr } from './finance';

const LOCAL_JOBS_PREFIX = 'sisfinz_labor_jobs_v1_';
const BADGE_CLASS = 'sisfinz-salary-breakdown-chip';
const OVERLAY_ID = 'sisfinz-salary-breakdown-overlay';

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

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
    const candidates = document.querySelectorAll('header, main button, main h2, main span, [aria-current="true"]');
    const regex = /\b(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|enero|febrero|marzo|mayo|junio|julio|septiembre|octubre|noviembre|diciembre|january|february|march|april|may|june|july|august|september|october|november|december|jan|fev|feb|mar|abr|apr|mai|jun|jul|ago|aug|set|sep|out|oct|nov|dez|dic|dec)\.?\s*(?:de\s*)?(20\d{2})\b/i;

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
    // fallback below
  }
  return getCurrentMonthStr();
}

function formatMonthLabel(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number);
  const dt = new Date(y || 2026, (m || 1) - 1, 1);
  return dt.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function closeBreakdownOverlay() {
  const existing = document.getElementById(OVERLAY_ID);
  if (existing) existing.remove();
}

function renderSalaryBreakdownOverlay(job: LaborJob, initialMonth: string) {
  closeBreakdownOverlay();

  let currentMonth = initialMonth;

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:10050;display:flex;align-items:flex-end;justify-content:center;padding:0;background:rgba(15,23,42,0.55);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);';

  const card = document.createElement('div');
  card.style.cssText =
    'width:100%;max-width:440px;max-height:88dvh;display:flex;flex-direction:column;overflow:hidden;background:#ffffff;border-radius:28px 28px 0 0;box-shadow:0 24px 60px rgba(15,23,42,0.28);border:1px solid #d1fae5;font-family:inherit;margin-bottom:0;';

  if (window.innerWidth >= 640) {
    overlay.style.alignItems = 'center';
    overlay.style.padding = '16px';
    card.style.borderRadius = '28px';
  }

  const renderContent = () => {
    const calc = calculateMonthSalary(job, currentMonth);
    const enabledItems = calc.benefits.filter((b) => b.enabled);
    const additions = enabledItems.filter((b) => !b.isDeduction);
    const deductions = enabledItems.filter((b) => Boolean(b.isDeduction));

    const benefitRowsHtml = additions
      .map((b) => {
        const pctTag =
          b.type === 'percent'
            ? `<span style="font-size:10.5px;font-weight:800;color:#047857;margin-left:4px;">(${b.rawValue}%)</span>`
            : '';
        return `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px dashed #e2e8f0;font-size:13px;">
            <span style="font-weight:700;color:#334155;">${escapeHtml(b.name)}${pctTag}</span>
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:800;color:#059669;white-space:nowrap;">+${escapeHtml(formatCurrency(b.calculatedAmount, job.currency))}</span>
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
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px dashed #fecdd3;font-size:13px;">
            <span style="font-weight:700;color:#be123c;display:inline-flex;align-items:center;gap:6px;">
              ${escapeHtml(b.name)}${pctTag}
              <span style="font-size:9px;font-weight:900;text-transform:uppercase;background:#ffe4e6;color:#be123c;padding:1px 6px;border-radius:9999px;">Desconto</span>
            </span>
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:800;color:#e11d48;white-space:nowrap;">-${escapeHtml(formatCurrency(b.calculatedAmount, job.currency))}</span>
          </div>
        `;
      })
      .join('');

    const extraRowHtml =
      calc.extraAmount > 0
        ? `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px dashed #e2e8f0;font-size:13px;">
            <span style="font-weight:700;color:#065f46;">Extras / Bônus do mês</span>
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:800;color:#059669;white-space:nowrap;">+${escapeHtml(formatCurrency(calc.extraAmount, job.currency))}</span>
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

    card.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;background:linear-gradient(135deg,#059669,#0d9488);color:#ffffff;">
        <div style="min-width:0;">
          <div style="font-size:10px;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:#a7f3d0;">Composição Salarial</div>
          <div style="font-size:15px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Salário • ${escapeHtml(job.companyName)}</div>
          <div style="font-size:11px;font-weight:600;color:#d1fae5;">${escapeHtml(job.role)}</div>
        </div>
        <button type="button" data-close-breakdown style="width:34px;height:34px;border-radius:12px;border:none;background:rgba(255,255,255,0.18);color:#ffffff;font-size:18px;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
      </div>

      <div style="padding:18px 20px;overflow-y:auto;display:flex;flex-direction:column;gap:14px;">
        <div style="display:flex;align-items:center;justify-content:space-between;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:6px 8px;">
          <button type="button" data-prev-month style="width:32px;height:32px;border-radius:10px;border:none;background:#ffffff;color:#334155;font-size:16px;font-weight:900;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,0.06);">‹</button>
          <span style="font-size:12.5px;font-weight:900;color:#0f172a;text-transform:capitalize;">${escapeHtml(formatMonthLabel(currentMonth))}</span>
          <button type="button" data-next-month style="width:32px;height:32px;border-radius:10px;border:none;background:#ffffff;color:#334155;font-size:16px;font-weight:900;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,0.06);">›</button>
        </div>

        <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:18px;padding:14px 16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding-bottom:8px;border-bottom:1px solid #a7f3d0;font-size:13.5px;">
            <span style="font-weight:900;color:#0f172a;">Salário Básico</span>
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:900;color:#0f172a;white-space:nowrap;">${escapeHtml(formatCurrency(calc.baseSalary, job.currency))}</span>
          </div>

          <div style="padding:4px 0;">
            ${benefitRowsHtml}
            ${extraRowHtml}
            ${deductionRowsHtml}
            ${emptyBenefitsHtml}
          </div>

          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:10px;margin-top:4px;border-top:2px solid #6ee7b7;font-size:15px;">
            <span style="font-weight:900;color:#064e3b;">Total a Receber</span>
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:900;color:#047857;white-space:nowrap;">${escapeHtml(formatCurrency(calc.netTotal, job.currency))}</span>
          </div>
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;font-weight:600;color:#64748b;padding:0 2px;">
          <span>Sincronizado pela Jornada Laboral</span>
          <span>${escapeHtml(footerCounts)}</span>
        </div>

        <button type="button" data-close-breakdown style="width:100%;padding:12px;border-radius:14px;border:none;background:#059669;color:#ffffff;font-size:12px;font-weight:900;letter-spacing:0.06em;text-transform:uppercase;cursor:pointer;">
          Fechar
        </button>
      </div>
    `;

    card.querySelectorAll('[data-close-breakdown]').forEach((btn) => {
      btn.addEventListener('click', closeBreakdownOverlay);
    });
    const prevBtn = card.querySelector('[data-prev-month]');
    const nextBtn = card.querySelector('[data-next-month]');
    prevBtn?.addEventListener('click', () => {
      currentMonth = shiftMonthStr(currentMonth, -1);
      renderContent();
    });
    nextBtn?.addEventListener('click', () => {
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
  return m[1].trim();
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
      parent.closest(`#${OVERLAY_ID}`) ||
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
    if (e.key === 'Escape') closeBreakdownOverlay();
  });

  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    if (!target || target.closest(`#${OVERLAY_ID}`)) return;

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
