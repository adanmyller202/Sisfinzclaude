import { CurrencyCode, LanguageCode } from '../types';
import { LaborJob } from '../types/labor';
import {
  calculateMonthlyAudit,
  calculateQuarterlyLateAudit,
  formatLocalDateYYYYMMDD,
  getScheduleForDate,
  shiftDateByDays,
} from './laborCalculations';
import { FinzyRoutineState } from '../components/FinzyMascot';

const LOCAL_JOBS_PREFIX = 'sisfinz_labor_jobs_v1_';
const STREAK_STORAGE_KEY = 'sisfinz_finzy_streak_v1';
const SKIN_STORAGE_KEY = 'sisfinz_finzy_skin_v1';

export interface FinzyStreakState {
  currentStreak: number;
  bestStreak: number;
  lastEvaluatedDate: string;
  unlockedSkins: string[];
}

export interface FrancoCountdownInfo {
  hasJob: boolean;
  isFrancoToday: boolean;
  nextFrancoDateStr: string | null;
  daysUntilFranco: number;
  hoursUntilFranco: number;
  restHoursThisWeek: number;
  workedHoursThisWeek: number;
  consecutiveDaysStreak: number;
  isLongStreakWarning: boolean;
  energyPercent: number;
  statusHeadlinePt: string;
  statusHeadlineEs: string;
  advicePt: string;
  adviceEs: string;
}

export interface FinzyLivingContext {
  routineState: FinzyRoutineState;
  reactionTitlePt: string;
  reactionTitleEs: string;
  reactionSubPt: string;
  reactionSubEs: string;
  streak: FinzyStreakState;
  franco: FrancoCountdownInfo;
}

export function loadCachedLaborJobsForFinzy(): LaborJob[] {
  if (typeof window === 'undefined') return [];
  try {
    let best: LaborJob[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(LOCAL_JOBS_PREFIX)) {
        const parsed = JSON.parse(localStorage.getItem(k) || '[]');
        if (Array.isArray(parsed) && parsed.length > best.length) {
          best = parsed;
        }
      }
    }
    return best;
  } catch {
    return [];
  }
}

export function getSavedFinzySkinId(): string {
  if (typeof window === 'undefined') return 'emerald_classic';
  try {
    return localStorage.getItem(SKIN_STORAGE_KEY) || 'emerald_classic';
  } catch {
    return 'emerald_classic';
  }
}

export function saveFinzySkinId(skinId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SKIN_STORAGE_KEY, skinId);
    window.dispatchEvent(new CustomEvent('sisfinz-finzy-skin-change', { detail: skinId }));
  } catch {
    // ignore
  }
}

export function computeFinzyLivingContext(
  jobs: LaborJob[],
  language: LanguageCode = 'pt',
  now: Date = new Date()
): FinzyLivingContext {
  const todayStr = formatLocalDateYYYYMMDD(now);
  const currentMonth = todayStr.slice(0, 7);
  const hour = now.getHours();

  const primaryJob = jobs.find((j) => Boolean(j.activeShift)) || jobs[0] || null;

  // Compute punctuality streak & unlocked skins
  let streakCount = 0;
  let bestStreak = 0;
  if (primaryJob) {
    const qAudit = calculateQuarterlyLateAudit(primaryJob, todayStr);
    const mAudit = calculateMonthlyAudit(primaryJob, currentMonth);
    const totalPunches = mAudit.onTimeCount + mAudit.lateCount;
    if (qAudit.lateCount === 0 && totalPunches > 0) {
      streakCount = Math.max(1, mAudit.onTimeCount);
    } else if (mAudit.onTimeCount > 0 && qAudit.lateCount < 3) {
      streakCount = mAudit.onTimeCount;
    }
  }

  try {
    const raw = localStorage.getItem(STREAK_STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<FinzyStreakState>;
      bestStreak = Math.max(streakCount, Number(saved.bestStreak) || 0);
      if (streakCount === 0 && saved.lastEvaluatedDate === todayStr && (saved.currentStreak || 0) > 0) {
        streakCount = Number(saved.currentStreak) || 0;
      }
    } else {
      bestStreak = streakCount;
    }
    const unlockedSkins = ['emerald_classic'];
    if (bestStreak >= 3) unlockedSkins.push('gold_vip');
    if (bestStreak >= 7) unlockedSkins.push('cosmic_violet');
    if (bestStreak >= 14) unlockedSkins.push('cyber_cyan');
    if (bestStreak >= 21) unlockedSkins.push('sakura_rose');

    localStorage.setItem(
      STREAK_STORAGE_KEY,
      JSON.stringify({
        currentStreak: streakCount,
        bestStreak,
        lastEvaluatedDate: todayStr,
        unlockedSkins,
      })
    );
  } catch {
    // ignore
  }

  const unlockedSkins = ['emerald_classic'];
  if (bestStreak >= 3) unlockedSkins.push('gold_vip');
  if (bestStreak >= 7) unlockedSkins.push('cosmic_violet');
  if (bestStreak >= 14) unlockedSkins.push('cyber_cyan');
  if (bestStreak >= 21) unlockedSkins.push('sakura_rose');

  // Compute Franco Countdown & Energy Ring
  let isFrancoToday = false;
  let nextFrancoDateStr: string | null = null;
  let daysUntilFranco = 0;
  let workedHoursThisWeek = 0;
  let consecutiveDaysStreak = 0;

  if (primaryJob) {
    const todaySched = getScheduleForDate(primaryJob, todayStr);
    isFrancoToday = Boolean(!todaySched.isUnset && todaySched.isOff);

    // Search up to 21 days ahead for next Franco
    for (let d = 0; d <= 21; d++) {
      const candDate = shiftDateByDays(todayStr, d);
      const sch = getScheduleForDate(primaryJob, candDate);
      if (!sch.isUnset && sch.isOff) {
        nextFrancoDateStr = candDate;
        daysUntilFranco = d;
        break;
      }
    }

    // Estimate worked hours over the past 7 days
    let sumMins = 0;
    for (let back = 0; back < 7; back++) {
      const pastDate = shiftDateByDays(todayStr, -back);
      const dayShifts = (primaryJob.shifts || []).filter((s) => s.date === pastDate);
      if (dayShifts.length > 0) {
        sumMins += dayShifts.reduce((a, b) => a + (b.durationMinutes || 0), 0);
      } else {
        const sch = getScheduleForDate(primaryJob, pastDate);
        if (!sch.isUnset && !sch.isOff) {
          const [sh, sm] = (sch.startTime || '18:00').split(':').map(Number);
          const [eh, em] = (sch.endTime || '02:00').split(':').map(Number);
          const diff = eh * 60 + em - (sh * 60 + sm);
          sumMins += diff > 0 ? diff : diff < 0 ? 1440 + diff : 0;
        }
      }
    }
    workedHoursThisWeek = Math.round((sumMins / 60) * 10) / 10;

    // Count consecutive days worked/scheduled right up to today
    for (let back = 0; back < 14; back++) {
      const dStr = shiftDateByDays(todayStr, -back);
      const hasShift = (primaryJob.shifts || []).some((s) => s.date === dStr);
      const sch = getScheduleForDate(primaryJob, dStr);
      const worksDay = hasShift || (!sch.isUnset && !sch.isOff);
      if (worksDay) {
        consecutiveDaysStreak++;
      } else if (back > 0) {
        break;
      }
    }
  }

  const restHoursThisWeek = Math.max(0, Math.round((168 - workedHoursThisWeek) * 10) / 10);
  const hoursUntilFranco = isFrancoToday ? 0 : Math.max(1, daysUntilFranco * 24 - now.getHours());
  const isLongStreakWarning = consecutiveDaysStreak >= 6 && !isFrancoToday;
  const energyPercent = isFrancoToday
    ? 92
    : isLongStreakWarning
    ? 34
    : Math.max(25, Math.min(95, Math.round(100 - consecutiveDaysStreak * 9)));

  // Determine Finzy's living routine reaction
  const recentMadrugadaShift = Boolean(
    primaryJob &&
      (primaryJob.shifts || []).some((s) => {
        if (s.date !== todayStr) return false;
        const [eh] = (s.endTime || '00:00').split(':').map(Number);
        return eh >= 0 && eh < 6;
      })
  );
  const isMadrugadaWindow = hour >= 0 && hour < 6;

  let routineState: FinzyRoutineState = 'normal';
  let reactionTitlePt = 'Finzy ligado';
  let reactionTitleEs = 'Finzy activo';
  let reactionSubPt = 'Acompanhando sua rotina e seu saldo';
  let reactionSubEs = 'Acompañando tu rutina y tu saldo';

  if (isFrancoToday) {
    routineState = 'franco_cool';
    reactionTitlePt = 'Finzy no Franco';
    reactionTitleEs = 'Finzy de Franco';
    reactionSubPt = 'Óculos escuros ativados — hoje é dia de recarregar!';
    reactionSubEs = 'Gafas activadas — ¡hoy toca recargar energías!';
  } else if (recentMadrugadaShift || (isMadrugadaWindow && primaryJob)) {
    routineState = 'madrugada_coffee';
    reactionTitlePt = 'Café da Madrugada';
    reactionTitleEs = 'Café de Madrugada';
    reactionSubPt = 'Turno pesado na madrugada — hora de um café e descanso!';
    reactionSubEs = 'Turno de madrugada — ¡hora de un café y descansar!';
  } else if (streakCount >= 3) {
    routineState = 'proud_streak';
    reactionTitlePt = `Sequência de ${streakCount} pontos`;
    reactionTitleEs = `Racha de ${streakCount} fichajes`;
    reactionSubPt = 'Mandando bem na pontualidade — sem atrasos!';
    reactionSubEs = '¡Excelente puntualidad en tu rutina!';
  }

  const statusHeadlinePt = !primaryJob
    ? 'Cadastre seu trabalho na Jornada'
    : isFrancoToday
    ? 'Hoje é o seu dia de Franco!'
    : daysUntilFranco === 1
    ? 'Falta 1 dia para o seu Franco'
    : nextFrancoDateStr
    ? `Faltam ${daysUntilFranco} dias para o Franco`
    : 'Sem folga agendada nos próximos dias';

  const statusHeadlineEs = !primaryJob
    ? 'Registra tu trabajo en Jornada'
    : isFrancoToday
    ? '¡Hoy es tu día de Franco!'
    : daysUntilFranco === 1
    ? 'Falta 1 día para tu Franco'
    : nextFrancoDateStr
    ? `Faltan ${daysUntilFranco} días para el Franco`
    : 'Sin franco programado pronto';

  const advicePt = isLongStreakWarning
    ? `Você já emendou ${consecutiveDaysStreak} dias seguidos — pegue leve e aproveite seu descanso.`
    : `${restHoursThisWeek}h livres na semana para dormir, curtir e recuperar o ritmo.`;

  const adviceEs = isLongStreakWarning
    ? `Ya llevas ${consecutiveDaysStreak} días seguidos — cuida tu energía antes de tu franco.`
    : `${restHoursThisWeek}h libres en la semana para descansar y desconectar.`;

  return {
    routineState,
    reactionTitlePt,
    reactionTitleEs,
    reactionSubPt,
    reactionSubEs,
    streak: {
      currentStreak: streakCount,
      bestStreak,
      lastEvaluatedDate: todayStr,
      unlockedSkins,
    },
    franco: {
      hasJob: Boolean(primaryJob),
      isFrancoToday,
      nextFrancoDateStr,
      daysUntilFranco,
      hoursUntilFranco,
      restHoursThisWeek,
      workedHoursThisWeek,
      consecutiveDaysStreak,
      isLongStreakWarning,
      energyPercent,
      statusHeadlinePt,
      statusHeadlineEs,
      advicePt,
      adviceEs,
    },
  };
}
