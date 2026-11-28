import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { LaborJob } from '../types/labor';

const PENDING_ENTRY_NOTE_PREFIX = 'sisfinz_pending_entry_note_v1_';
const LOCAL_JOBS_PREFIX = 'sisfinz_labor_jobs_v1_';

function sanitizePayload<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function savePendingEntryNote(jobKey: string, note?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const clean = (note || '').trim();
    const key = `${PENDING_ENTRY_NOTE_PREFIX}${jobKey || 'default'}`;
    if (clean) {
      sessionStorage.setItem(key, clean);
    } else {
      sessionStorage.removeItem(key);
    }
  } catch {
    // ignore storage errors
  }
}

export function peekPendingEntryNote(jobKey: string): string {
  if (typeof window === 'undefined') return '';
  try {
    return (
      sessionStorage.getItem(`${PENDING_ENTRY_NOTE_PREFIX}${jobKey || 'default'}`) ||
      sessionStorage.getItem(`${PENDING_ENTRY_NOTE_PREFIX}default`) ||
      ''
    ).trim();
  } catch {
    return '';
  }
}

export function consumePendingEntryNote(jobKey: string): string {
  const val = peekPendingEntryNote(jobKey);
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem(`${PENDING_ENTRY_NOTE_PREFIX}${jobKey || 'default'}`);
      sessionStorage.removeItem(`${PENDING_ENTRY_NOTE_PREFIX}default`);
    } catch {
      // ignore
    }
  }
  return val;
}

export function combinePunchNotes(params: {
  baseNote?: string;
  entryNote?: string;
  exitNote?: string;
}): string | undefined {
  const parts: string[] = [];
  const base = (params.baseNote || '').trim();
  const entry = (params.entryNote || '').trim();
  const exit = (params.exitNote || '').trim();

  if (base) parts.push(base);
  if (entry) {
    const formattedEntry = entry.toLowerCase().startsWith('entrada:')
      ? entry
      : `Entrada: ${entry}`;
    if (!parts.some((p) => p.includes(entry))) {
      parts.push(formattedEntry);
    }
  }
  if (exit) {
    const formattedExit = exit.toLowerCase().startsWith('saída:') || exit.toLowerCase().startsWith('salida:')
      ? exit
      : `Saída: ${exit}`;
    if (!parts.some((p) => p.includes(exit))) {
      parts.push(formattedExit);
    }
  }

  return parts.length > 0 ? parts.join(' • ') : undefined;
}

function updateLocalJobsCache(uid: string, updatedJob: LaborJob) {
  try {
    const key = `${LOCAL_JOBS_PREFIX}${uid}`;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    const next = parsed.map((j: LaborJob) => (j.id === updatedJob.id ? updatedJob : j));
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // ignore
  }
}

/**
 * Ensures an observation typed during Clock In ("start") or Clock Out ("end")
 * is persisted onto the active shift or freshly completed shift in Firestore,
 * even when triggered from views whose callbacks do not yet accept a note argument.
 * Does NOT alter punctuality or lateness evaluation.
 */
export async function attachObservationToLatestPunch(params: {
  action: 'start' | 'end';
  note?: string;
  previousEntryNote?: string;
}): Promise<void> {
  const cleanNote = (params.note || '').trim();
  const prevEntry = (params.previousEntryNote || '').trim();
  const uid = auth.currentUser?.uid;

  if (params.action === 'start') {
    if (cleanNote) savePendingEntryNote('default', cleanNote);
    if (!cleanNote || !uid) return;

    // Give parent saveJob a brief moment to flush if needed
    await new Promise((r) => window.setTimeout(r, 180));

    try {
      const snap = await getDocs(collection(db, 'users', uid, 'labor_jobs'));
      let targetJob: LaborJob | null = null;
      let latestStartedMs = 0;

      snap.forEach((docSnap) => {
        const job = { ...(docSnap.data() as LaborJob), id: docSnap.id };
        if (job.activeShift?.startedAtIso) {
          const ms = new Date(job.activeShift.startedAtIso).getTime();
          if (!Number.isNaN(ms) && ms >= latestStartedMs) {
            latestStartedMs = ms;
            targetJob = job;
          }
        }
      });

      if (!targetJob) return;
      const foundJob: LaborJob = targetJob;
      const activeShiftAny = foundJob.activeShift as (LaborJob['activeShift'] & { note?: string }) | null;
      if (!activeShiftAny) return;

      savePendingEntryNote(foundJob.id, cleanNote);

      // Already saved directly by QuickPunchModal? Skip redundant write.
      if ((activeShiftAny.note || '').includes(cleanNote)) return;

      const updatedJob: LaborJob = {
        ...foundJob,
        activeShift: {
          ...activeShiftAny,
          note: cleanNote,
        } as LaborJob['activeShift'],
        updatedAt: new Date().toISOString(),
      };

      updateLocalJobsCache(uid, updatedJob);
      await setDoc(
        doc(db, 'users', uid, 'labor_jobs', foundJob.id),
        sanitizePayload(updatedJob),
        { merge: true }
      );
    } catch (err) {
      console.warn('[punchNoteSync] Could not attach entry observation:', err);
    }
    return;
  }

  // action === 'end'
  const effectiveEntryNote = prevEntry || consumePendingEntryNote('default');
  if (!cleanNote && !effectiveEntryNote) return;
  if (!uid) return;

  await new Promise((r) => window.setTimeout(r, 220));

  try {
    const snap = await getDocs(collection(db, 'users', uid, 'labor_jobs'));
    const nowMs = Date.now();
    let bestJob: LaborJob | null = null;
    let bestShiftIdx = -1;
    let newestCreatedMs = 0;

    snap.forEach((docSnap) => {
      const job = { ...(docSnap.data() as LaborJob), id: docSnap.id };
      const shifts = job.shifts || [];
      shifts.forEach((s, idx) => {
        const createdMs = new Date(s.createdAt || '').getTime();
        if (!Number.isNaN(createdMs) && nowMs - createdMs <= 45000 && createdMs > newestCreatedMs) {
          newestCreatedMs = createdMs;
          bestJob = job;
          bestShiftIdx = idx;
        }
      });
    });

    if (!bestJob || bestShiftIdx < 0) return;
    const foundJob: LaborJob = bestJob;
    const targetShift = foundJob.shifts[bestShiftIdx];
    const jobEntryNote = effectiveEntryNote || consumePendingEntryNote(foundJob.id);

    const existing = (targetShift.note || '').trim();
    const alreadyHasEntry = !jobEntryNote || existing.includes(jobEntryNote);
    const alreadyHasExit = !cleanNote || existing.includes(cleanNote);
    if (alreadyHasEntry && alreadyHasExit) return;

    const mergedNote = combinePunchNotes({
      baseNote: existing,
      entryNote: alreadyHasEntry ? undefined : jobEntryNote,
      exitNote: alreadyHasExit ? undefined : cleanNote,
    });

    const nextShifts = foundJob.shifts.map((s, idx) =>
      idx === bestShiftIdx ? { ...s, note: mergedNote } : s
    );

    const updatedJob: LaborJob = {
      ...foundJob,
      shifts: nextShifts,
      updatedAt: new Date().toISOString(),
    };

    updateLocalJobsCache(uid, updatedJob);
    await setDoc(
      doc(db, 'users', uid, 'labor_jobs', foundJob.id),
      sanitizePayload(updatedJob),
      { merge: true }
    );
  } catch (err) {
    console.warn('[punchNoteSync] Could not attach exit observation:', err);
  }
}
