import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { TimeCrown } from '../components/TimeCrown';
import { LanguageCode } from '../types';
import { getCurrentMonthStr } from './finance';

const MONTH_NAME_MAP: Record<string, string> = {
  janeiro: '01', enero: '01', january: '01', jan: '01', ene: '01',
  fevereiro: '02', febrero: '02', february: '02', fev: '02', feb: '02',
  marco: '03', marzo: '03', march: '03', mar: '03',
  abril: '04', april: '04', abr: '04', apr: '04',
  maio: '05', mayo: '05', may: '05', mai: '05',
  junho: '06', junio: '06', june: '06', jun: '06',
  julho: '07', julio: '07', july: '07', jul: '07',
  agosto: '08', august: '08', ago: '08', aug: '08',
  setembro: '09', septiembre: '09', september: '09', set: '09', sep: '09',
  outubro: '10', octubre: '10', october: '10', out: '10', oct: '10',
  novembro: '11', noviembre: '11', november: '11', nov: '11',
  dezembro: '12', diciembre: '12', december: '12', dez: '12', dic: '12', dec: '12',
};

function parseMonthTextToYYYYMM(text: string): string | null {
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  const yearMatch = normalized.match(/\b(20\d{2})\b/);
  if (!yearMatch) return null;
  const year = yearMatch[1];

  const words = normalized.split(/[\s,/.-]+/).filter(Boolean);
  for (const w of words) {
    if (MONTH_NAME_MAP[w]) {
      return `${year}-${MONTH_NAME_MAP[w]}`;
    }
  }
  return null;
}

function detectLanguage(ariaLabel: string): LanguageCode {
  const lower = ariaLabel.toLowerCase();
  if (lower.includes('volver')) return 'es';
  if (lower.includes('back to')) return 'en';
  return 'pt';
}

interface MountedCrown {
  hostRow: HTMLElement;
  mountEl: HTMLDivElement;
  root: Root;
  labelObserver: MutationObserver;
}

let activeCrown: MountedCrown | null = null;
let initialized = false;

function findDashboardMonthHeader(): {
  hostRow: HTMLElement;
  prevBtn: HTMLButtonElement;
  nextBtn: HTMLButtonElement;
  todayBtn: HTMLButtonElement;
  labelContainer: HTMLElement;
} | null {
  const todayBtns = document.querySelectorAll<HTMLButtonElement>('button[aria-pressed][aria-label]');
  for (const todayBtn of todayBtns) {
    const aria = (todayBtn.getAttribute('aria-label') || '').toLowerCase();
    if (
      !aria.includes('mês atual') &&
      !aria.includes('mes actual') &&
      !aria.includes('current month')
    ) {
      continue;
    }

    const hostRow = todayBtn.parentElement;
    if (!hostRow) continue;

    const pillBox = hostRow.firstElementChild as HTMLElement | null;
    if (!pillBox || pillBox === todayBtn) continue;

    const buttons = pillBox.querySelectorAll<HTMLButtonElement>('button');
    if (buttons.length < 2) continue;

    return {
      hostRow,
      prevBtn: buttons[0],
      nextBtn: buttons[buttons.length - 1],
      todayBtn,
      labelContainer: pillBox,
    };
  }
  return null;
}

function unmountCrown() {
  if (!activeCrown) return;
  activeCrown.labelObserver.disconnect();
  const rootToUnmount = activeCrown.root;
  const mountEl = activeCrown.mountEl;
  const hostRow = activeCrown.hostRow;
  activeCrown = null;

  try {
    rootToUnmount.unmount();
  } catch {
    // ignore
  }
  if (mountEl.parentElement) mountEl.remove();
  if (document.body.contains(hostRow)) {
    hostRow.style.display = '';
    hostRow.removeAttribute('data-time-crown-replaced');
  }
}

function renderCrown(
  root: Root,
  labelContainer: HTMLElement,
  prevBtn: HTMLButtonElement,
  nextBtn: HTMLButtonElement,
  todayBtn: HTMLButtonElement
) {
  const parsedMonth = parseMonthTextToYYYYMM(labelContainer.textContent || '') || getCurrentMonthStr();
  const language = detectLanguage(todayBtn.getAttribute('aria-label') || '');

  root.render(
    <TimeCrown
      selectedMonth={parsedMonth}
      language={language}
      onStepMonth={(delta) => {
        if (delta < 0) prevBtn.click();
        else nextBtn.click();
      }}
      onGoToCurrentMonth={() => {
        todayBtn.click();
      }}
    />
  );
}

function syncCrownMount() {
  const found = findDashboardMonthHeader();

  if (!found) {
    if (activeCrown) unmountCrown();
    return;
  }

  // Already mounted on this exact header row
  if (activeCrown && activeCrown.hostRow === found.hostRow) {
    return;
  }

  if (activeCrown) unmountCrown();

  const { hostRow, prevBtn, nextBtn, todayBtn, labelContainer } = found;
  const parent = hostRow.parentElement;
  if (!parent) return;

  // Hide the original row non-destructively so its React buttons stay live
  hostRow.style.display = 'none';
  hostRow.setAttribute('data-time-crown-replaced', 'true');

  const mountEl = document.createElement('div');
  mountEl.setAttribute('data-sisfinz-time-crown', 'true');
  parent.insertBefore(mountEl, hostRow);

  const root = createRoot(mountEl);

  const labelObserver = new MutationObserver(() => {
    renderCrown(root, labelContainer, prevBtn, nextBtn, todayBtn);
  });
  labelObserver.observe(labelContainer, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  activeCrown = { hostRow, mountEl, root, labelObserver };
  renderCrown(root, labelContainer, prevBtn, nextBtn, todayBtn);
}

export function initTimeCrown() {
  if (initialized || typeof window === 'undefined' || typeof document === 'undefined') return;
  initialized = true;

  let rafPending = false;
  const scheduleSync = () => {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      syncCrownMount();
    });
  };

  const domObserver = new MutationObserver(scheduleSync);
  domObserver.observe(document.body, { childList: true, subtree: true });

  // Initial check after React mounts
  window.setTimeout(syncCrownMount, 150);
  window.setTimeout(syncCrownMount, 600);
}
