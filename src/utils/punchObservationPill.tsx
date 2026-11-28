import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { ActiveShiftState, LaborJob } from '../types/labor';
import {
  PunchObservationModal,
  buildDayObservationTargets,
  countUserObservationsForDay,
  rebuildShiftNoteWithObservation,
} from '../components/labor/PunchObservationModal';

const PILL_ATTR = 'data-sisfinz-obs-pill';
const LOCAL_JOBS_PREFIX = 'sisfinz_labor_jobs_v1_';

const NOTE_ICON_SVG = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8"/><path d="M8 13h5"/></svg>`;

let initialized = false;
let currentUid: string | null = null;
let unsubJobs: (() => void) | null = null;
let cachedJobs: LaborJob[] = [];

let modalHostEl: HTMLDivElement | null = null;
let modalRoot: Root | null = null;
let activeModalState: {
  jobId: string;
  dateStr: string;
  dayLabel: string;
  isEs: boolean;
} | null = null;

function sanitizePayload<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function loadFallbackJobs(): LaborJob[] {
  if (cachedJobs.length > 0) return cachedJobs;
  const uid = currentUid || auth.currentUser?.uid;
  try {
    const raw =
      (uid ? localStorage.getItem(`${LOCAL_JOBS_PREFIX}${uid}`) : null) ||
      localStorage.getItem(`${LOCAL_JOBS_PREFIX}guest`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

function persistLocalJobs(uid: string, updatedJob: LaborJob) {
  cachedJobs = cachedJobs.map((j) => (j.id === updatedJob.id ? updatedJob : j));
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

function detectVisibleJob(jobs: LaborJob[], cardEl: HTMLElement): LaborJob | null {
  if (!jobs.length) return null;
  if (jobs.length === 1) return jobs[0];

  // Try matching the active LaborJobDetail header company name in the DOM
  const rootOverlay = cardEl.closest('[class*="fixed inset-0"]') || document.body;
  const headings = rootOverlay.querySelectorAll('h2, h3');
  for (const h of Array.from(headings)) {
    const txt = (h.textContent || '').trim().toLowerCase();
    if (!txt) continue;
    const matched = jobs.find((j) => j.companyName.trim().toLowerCase() === txt);
    if (matched) return matched;
  }

  return jobs[0];
}

function resolveDateForShortDDMM(
  job: LaborJob,
  ddmm: string,
  cardText: string
): string {
  const [dd, mm] = ddmm.split('/');
  const suffix = `-${mm}-${dd}`;

  // 1. Check activeShift first
  if (job.activeShift?.startDate && job.activeShift.startDate.endsWith(suffix)) {
    return job.activeShift.startDate;
  }

  // 2. Match shifts ending with -MM-DD (preferring one whose startTime appears in cardText)
  const matchingShifts = (job.shifts || []).filter((s) => s.date && s.date.endsWith(suffix));
  if (matchingShifts.length > 0) {
    const exactTimeMatch = matchingShifts.find(
      (s) => s.startTime && cardText.includes(s.startTime)
    );
    if (exactTimeMatch) return exactTimeMatch.date;

    // Otherwise prefer the most recent date matching -MM-DD
    const sorted = [...matchingShifts].sort((a, b) => b.date.localeCompare(a.date));
    return sorted[0].date;
  }

  // 3. Fallback to current year
  const year = new Date().getFullYear();
  return `${year}-${mm}-${dd}`;
}

function formatObsLabel(count: number, isEs: boolean): string {
  if (isEs) {
    return count === 1 ? '1 observación' : `${count} observaciones`;
  }
  return count === 1 ? '1 observação' : `${count} observações`;
}

function ensureModalRoot(): Root {
  if (!modalHostEl || !document.body.contains(modalHostEl)) {
    modalHostEl = document.createElement('div');
    modalHostEl.id = 'sisfinz-punch-observation-host';
    document.body.appendChild(modalHostEl);
    modalRoot = createRoot(modalHostEl);
  }
  return modalRoot!;
}

async function handleSaveObservation(params: {
  targetId: string;
  isActive: boolean;
  newObservation: string;
}) {
  if (!activeModalState) return;
  const uid = currentUid || auth.currentUser?.uid;
  const jobs = loadFallbackJobs();
  const job = jobs.find((j) => j.id === activeModalState!.jobId);
  if (!job) return;

  const now = new Date().toISOString();
  let updatedJob: LaborJob;

  if (params.isActive && job.activeShift) {
    const activeAny = job.activeShift as ActiveShiftState & { note?: string };
    const cleanObs = params.newObservation.trim();
    const nextActive: ActiveShiftState & { note?: string } = { ...activeAny };
    if (cleanObs) {
      nextActive.note = cleanObs;
    } else {
      delete nextActive.note;
    }
    updatedJob = {
      ...job,
      activeShift: nextActive,
      updatedAt: now,
    };
  } else {
    const nextShifts = (job.shifts || []).map((s) => {
      if (s.id !== params.targetId) return s;
      const nextNote = rebuildShiftNoteWithObservation(
        s.note,
        params.newObservation,
        s.shiftPart
      );
      const copy = { ...s };
      if (nextNote) {
        copy.note = nextNote;
      } else {
        delete copy.note;
      }
      return copy;
    });
    updatedJob = {
      ...job,
      shifts: nextShifts,
      updatedAt: now,
    };
  }

  if (uid) {
    persistLocalJobs(uid, updatedJob);
    try {
      await setDoc(
        doc(db, 'users', uid, 'labor_jobs', updatedJob.id),
        sanitizePayload(updatedJob),
        { merge: true }
      );
    } catch (err) {
      console.warn('[punchObservationPill] Firestore save warning:', err);
    }
  } else {
    cachedJobs = cachedJobs.map((j) => (j.id === updatedJob.id ? updatedJob : j));
  }

  renderObservationModal();
  syncObservationPills();
}

function renderObservationModal() {
  if (!modalRoot && !activeModalState) return;
  const root = ensureModalRoot();

  if (!activeModalState) {
    root.render(
      <PunchObservationModal
        isOpen={false}
        onClose={() => {
          activeModalState = null;
          renderObservationModal();
        }}
        job={null}
        dateStr=""
        dayLabel=""
        isEs={false}
        targets={[]}
        onSaveObservation={handleSaveObservation}
      />
    );
    return;
  }

  const jobs = loadFallbackJobs();
  const job = jobs.find((j) => j.id === activeModalState!.jobId) || null;
  const targets = job ? buildDayObservationTargets(job, activeModalState.dateStr) : [];

  root.render(
    <PunchObservationModal
      isOpen={Boolean(job)}
      onClose={() => {
        activeModalState = null;
        renderObservationModal();
      }}
      job={job}
      dateStr={activeModalState.dateStr}
      dayLabel={activeModalState.dayLabel}
      isEs={activeModalState.isEs}
      targets={targets}
      onSaveObservation={handleSaveObservation}
    />
  );
}

function openObservationModal(params: {
  jobId: string;
  dateStr: string;
  dayLabel: string;
  isEs: boolean;
}) {
  activeModalState = params;
  renderObservationModal();
}

function syncObservationPills() {
  if (typeof document === 'undefined') return;
  const jobs = loadFallbackJobs();
  if (!jobs.length) return;

  // Locate every "Ponto registrado" / "Fichaje registrado" pill inside Escala Semanal day cards
  const spans = document.querySelectorAll<HTMLSpanElement>('span.rounded-full');

  for (const badge of Array.from(spans)) {
    if (badge.closest('#sisfinz-punch-observation-modal')) continue;
    const rawText = (badge.textContent || '').trim();
    const lower = rawText.toLowerCase();
    if (lower !== 'ponto registrado' && lower !== 'fichaje registrado') continue;

    const isEs = lower === 'fichaje registrado';
    const headerGroup = badge.parentElement;
    if (!headerGroup) continue;

    // Extract DD/MM and day label from sibling spans in the same header group
    const groupText = (headerGroup.textContent || '').trim();
    const dateMatch = groupText.match(/\b(\d{2}\/\d{2})\b/);
    if (!dateMatch) continue;
    const ddmm = dateMatch[1];

    const firstSpan = headerGroup.querySelector('span');
    const dayLabel = (firstSpan?.textContent || '').trim() || ddmm;

    const dayCard = headerGroup.closest('.rounded-2xl') as HTMLElement | null;
    const job = detectVisibleJob(jobs, dayCard || headerGroup);
    if (!job) continue;

    const dateStr = resolveDateForShortDDMM(job, ddmm, dayCard?.textContent || groupText);
    const obsCount = countUserObservationsForDay(job, dateStr);
    const labelText = formatObsLabel(obsCount, isEs);

    // Ensure header row wraps cleanly on narrow mobile screens
    if (!headerGroup.classList.contains('flex-wrap')) {
      headerGroup.classList.add('flex-wrap');
    }

    let pillBtn = headerGroup.querySelector<HTMLButtonElement>(`button[${PILL_ATTR}="1"]`);
    if (!pillBtn) {
      pillBtn = document.createElement('button');
      pillBtn.type = 'button';
      pillBtn.setAttribute(PILL_ATTR, '1');
      // Same rounded-full mold as "Ponto registrado", styled with vivid red border, soft light-red center, and strong dark-red text
      pillBtn.className =
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[8.5px] font-black uppercase tracking-wide border border-red-500 bg-red-50 text-red-800 hover:bg-red-100 active:scale-95 transition-all cursor-pointer shadow-2xs';
      pillBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const jId = pillBtn!.dataset.obsJobId || '';
        const dStr = pillBtn!.dataset.obsDateStr || '';
        const dLabel = pillBtn!.dataset.obsDayLabel || '';
        const esFlag = pillBtn!.dataset.obsEs === '1';
        if (jId && dStr) {
          openObservationModal({
            jobId: jId,
            dateStr: dStr,
            dayLabel: dLabel,
            isEs: esFlag,
          });
        }
      });
      // Insert directly after the "Ponto registrado" pill
      badge.insertAdjacentElement('afterend', pillBtn);
    }

    pillBtn.dataset.obsJobId = job.id;
    pillBtn.dataset.obsDateStr = dateStr;
    pillBtn.dataset.obsDayLabel = dayLabel;
    pillBtn.dataset.obsEs = isEs ? '1' : '0';

    const nextHtml = `${NOTE_ICON_SVG}<span>${labelText}</span>`;
    if (pillBtn.dataset.obsRendered !== labelText) {
      pillBtn.dataset.obsRendered = labelText;
      pillBtn.innerHTML = nextHtml;
    }
  }
}

function attachJobsListener(uid: string) {
  if (unsubJobs) unsubJobs();
  currentUid = uid;

  unsubJobs = onSnapshot(
    collection(db, 'users', uid, 'labor_jobs'),
    (snap) => {
      const list: LaborJob[] = [];
      snap.forEach((docSnap) => {
        list.push({ ...(docSnap.data() as LaborJob), id: docSnap.id });
      });
      cachedJobs = list;
      syncObservationPills();
      if (activeModalState) {
        renderObservationModal();
      }
    },
    () => {
      // keep localStorage fallback
    }
  );
}

export function initPunchObservationPill() {
  if (initialized || typeof window === 'undefined' || typeof document === 'undefined') return;
  initialized = true;

  onAuthStateChanged(auth, (user) => {
    if (user?.uid) {
      if (user.uid !== currentUid) {
        attachJobsListener(user.uid);
      }
    } else {
      currentUid = null;
      if (unsubJobs) unsubJobs();
      unsubJobs = null;
      cachedJobs = [];
    }
  });

  let rafId: number | null = null;
  const scheduleSync = () => {
    if (rafId !== null) return;
    rafId = window.requestAnimationFrame(() => {
      rafId = null;
      syncObservationPills();
    });
  };

  const observer = new MutationObserver(scheduleSync);
  observer.observe(document.body, { childList: true, subtree: true });

  window.setTimeout(syncObservationPills, 250);
  window.setTimeout(syncObservationPills, 900);
}
