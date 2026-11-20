import {
  DayOfWeekKey,
  DaySchedule,
  LaborBenefit,
  LaborJob,
  LaborSalarySnapshot,
  MonthlySalaryCalculation,
  WeeklySchedule,
} from '../types/labor';
import { CurrencyCode } from '../types';
import { getCurrentMonthStr, shiftMonthStr } from './finance';

export const ORDERED_WEEKDAYS: DayOfWeekKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/** Maximum entry delay (in minutes) still considered on time */
export const LATE_TOLERANCE_MINUTES = 5;

/** Maximum early arrival (in minutes) still considered within normal shift entry window */
export const EARLY_ENTRY_WINDOW_MINUTES = 60;

/** Maximum early exit tolerance (in minutes) before counting as left early */
export const EARLY_EXIT_TOLERANCE_MINUTES = 5;

/** Number of late arrivals in the same quarter that triggers suspension risk */
export const QUARTERLY_LATE_LIMIT = 3;

export const WEEKDAY_LABELS: Record<DayOfWeekKey, { pt: string; es: string; en: string; shortPt: string; shortEs: string }> = {
  mon: { pt: 'Segunda', es: 'Lunes', en: 'Monday', shortPt: 'Seg', shortEs: 'Lun' },
  tue: { pt: 'Terça', es: 'Martes', en: 'Tuesday', shortPt: 'Ter', shortEs: 'Mar' },
  wed: { pt: 'Quarta', es: 'Miércoles', en: 'Wednesday', shortPt: 'Qua', shortEs: 'Mié' },
  thu: { pt: 'Quinta', es: 'Jueves', en: 'Thursday', shortPt: 'Qui', shortEs: 'Jue' },
  fri: { pt: 'Sexta', es: 'Viernes', en: 'Friday', shortPt: 'Sex', shortEs: 'Vie' },
  sat: { pt: 'Sábado', es: 'Sábado', en: 'Saturday', shortPt: 'Sáb', shortEs: 'Sáb' },
  sun: { pt: 'Domingo', es: 'Domingo', en: 'Sunday', shortPt: 'Dom', shortEs: 'Dom' },
};

export function createDefaultWeeklySchedule(): WeeklySchedule {
  return {
    mon: { isOff: false, startTime: '18:00', endTime: '02:00' },
    tue: { isOff: true, startTime: '18:00', endTime: '02:00' },
    wed: { isOff: false, startTime: '18:00', endTime: '02:00' },
    thu: { isOff: false, startTime: '18:00', endTime: '02:00' },
    fri: { isOff: false, startTime: '18:00', endTime: '02:30' },
    sat: { isOff: false, startTime: '18:00', endTime: '02:30' },
    sun: { isOff: false, startTime: '18:00', endTime: '01:30' },
  };
}

/** Empty/zeroed week schedule used for any week that has not been manually filled or imported */
export function createEmptyWeeklySchedule(): WeeklySchedule {
  return {
    mon: { isOff: true, isUnset: true, startTime: '18:00', endTime: '02:00' },
    tue: { isOff: true, isUnset: true, startTime: '18:00', endTime: '02:00' },
    wed: { isOff: true, isUnset: true, startTime: '18:00', endTime: '02:00' },
    thu: { isOff: true, isUnset: true, startTime: '18:00', endTime: '02:00' },
    fri: { isOff: true, isUnset: true, startTime: '18:00', endTime: '02:00' },
    sat: { isOff: true, isUnset: true, startTime: '18:00', endTime: '02:00' },
    sun: { isOff: true, isUnset: true, startTime: '18:00', endTime: '02:00' },
  };
}

export function createDefaultGastronomyBenefits(): LaborBenefit[] {
  return [
    { id: 'ben_asistencia', name: 'Assistência Perfeita', type: 'percent', value: 10, enabled: true },
    { id: 'ben_alimentacao', name: 'Alimentação', type: 'percent', value: 10, enabled: true },
    { id: 'ben_antiguidade', name: 'Antiguidade', type: 'percent', value: 0, enabled: true },
    { id: 'ben_cortados', name: 'Turnos Cortados', type: 'fixed', value: 0, enabled: true },
    { id: 'ben_extras', name: 'Horas Extras', type: 'variable', value: 0, enabled: true },
  ];
}

export function createNewLaborJob(params: {
  companyName: string;
  role: string;
  currency: CurrencyCode;
  baseSalary: number;
  weeklyTargetHours?: number;
  tipFrequency?: 'weekly' | 'daily';
  tipWeekday?: DayOfWeekKey;
  defaultAccountId?: string;
  useGastronomyPreset?: boolean;
}): LaborJob {
  const now = new Date().toISOString();
  const currentMonth = getCurrentMonthStr();
  return {
    id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    companyName: params.companyName.trim(),
    role: params.role.trim(),
    currency: params.currency,
    weeklyTargetHours: params.weeklyTargetHours || 48,
    tipFrequency: params.tipFrequency || 'weekly',
    tipWeekday: params.tipWeekday || 'wed',
    defaultAccountId: params.defaultAccountId,
    defaultSchedule: createDefaultWeeklySchedule(),
    weekOverrides: {},
    salaryHistory: [
      {
        effectiveFromMonth: currentMonth,
        baseSalary: Math.max(0, Number(params.baseSalary) || 0),
        benefits: params.useGastronomyPreset !== false ? createDefaultGastronomyBenefits() : [],
        deductionPercent: 0,
      },
    ],
    monthOverrides: {},
    shifts: [],
    activeShift: null,
    tips: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = (timeStr || '00:00').split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

/** Calculate shift duration in minutes, properly handling overnight shifts (e.g. 18:00 -> 02:30) */
export function calculateShiftMinutes(startTime: string, endTime: string): number {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (end > start) return end - start;
  if (end < start) return 24 * 60 - start + end;
  return 0;
}

export function calculateDayScheduleMinutes(day: DaySchedule): number {
  if (!day || day.isOff || day.isUnset) return 0;
  let total = calculateShiftMinutes(day.startTime, day.endTime);
  if (day.isSplitShift && day.splitStartTime && day.splitEndTime) {
    total += calculateShiftMinutes(day.splitStartTime, day.splitEndTime);
  }
  return total;
}

export function formatMinutesAsHours(totalMinutes: number, showSign = false): string {
  const sign = totalMinutes < 0 ? '-' : showSign && totalMinutes > 0 ? '+' : '';
  const abs = Math.abs(Math.round(totalMinutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (m === 0) return `${sign}${h}h`;
  return `${sign}${h}h ${String(m).padStart(2, '0')}m`;
}

/** Human-friendly duration for delays/early arrival (e.g. "15 min", "1h 10m") */
export function formatDurationCompact(totalMinutes: number): string {
  const abs = Math.abs(Math.round(totalMinutes));
  if (abs < 60) return `${abs} min`;
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export type PunctualityStatus =
  | 'on_time'
  | 'early'
  | 'late'
  | 'out_of_hours'
  | 'extra_day'
  | 'no_schedule';

export type ExitPunctualityStatus = 'on_time' | 'early_exit' | 'none';

export interface DayAttendanceEntry {
  id: string;
  isActive: boolean;
  startTime: string;
  endTime?: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  shiftPart?: 1 | 2;
  status: PunctualityStatus;
  /** Positive = minutes after scheduled start, Negative = minutes before scheduled start */
  diffMinutes: number;
  exitStatus: ExitPunctualityStatus;
  /** Positive = minutes left early (when early_exit), or minutes extra (when on_time) */
  exitDiffMinutes: number;
  /** True if entry is late/out_of_hours OR exit was early */
  hasIssue: boolean;
}

function getCircularMinuteDiff(actualTime: string, scheduledTime: string): number {
  const actual = parseTimeToMinutes(actualTime);
  const sched = parseTimeToMinutes(scheduledTime);
  let diff = actual - sched;
  if (diff > 720) diff -= 1440;
  if (diff < -720) diff += 1440;
  return diff;
}

/**
 * Evaluate entry AND optional exit punctuality against the day's scheduled shift(s).
 * - Entry allows up to 5 min late tolerance and up to 60 min early arrival.
 * - Arriving > 60 min early is flagged as 'out_of_hours' (never falsely "Chegou no horário").
 * - Exiting > 5 min before scheduled end time is flagged as 'early_exit' (red).
 */
export function evaluatePunchPunctuality(
  actualStartTime: string,
  schedule: DaySchedule,
  actualEndTime?: string
): {
  status: PunctualityStatus;
  diffMinutes: number;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  shiftPart?: 1 | 2;
  exitStatus: ExitPunctualityStatus;
  exitDiffMinutes: number;
  hasIssue: boolean;
} {
  if (!schedule || schedule.isUnset) {
    return {
      status: 'no_schedule',
      diffMinutes: 0,
      exitStatus: 'none',
      exitDiffMinutes: 0,
      hasIssue: false,
    };
  }
  if (schedule.isOff) {
    return {
      status: 'extra_day',
      diffMinutes: 0,
      exitStatus: 'none',
      exitDiffMinutes: 0,
      hasIssue: false,
    };
  }

  let bestScheduledStart = schedule.startTime;
  let bestScheduledEnd = schedule.endTime;
  let bestDiff = getCircularMinuteDiff(actualStartTime, schedule.startTime);
  let shiftPart: 1 | 2 | undefined = schedule.isSplitShift ? 1 : undefined;

  if (schedule.isSplitShift && schedule.splitStartTime) {
    const splitDiff = getCircularMinuteDiff(actualStartTime, schedule.splitStartTime);
    if (Math.abs(splitDiff) < Math.abs(bestDiff)) {
      bestScheduledStart = schedule.splitStartTime;
      bestScheduledEnd = schedule.splitEndTime || schedule.endTime;
      bestDiff = splitDiff;
      shiftPart = 2;
    }
  }

  let status: PunctualityStatus;
  if (bestDiff > LATE_TOLERANCE_MINUTES) {
    status = 'late';
  } else if (bestDiff < -EARLY_ENTRY_WINDOW_MINUTES) {
    status = 'out_of_hours';
  } else if (bestDiff < 0) {
    status = 'early';
  } else {
    status = 'on_time';
  }

  let exitStatus: ExitPunctualityStatus = 'none';
  let exitDiffMinutes = 0;

  if (actualEndTime && bestScheduledEnd) {
    const schedDuration = calculateShiftMinutes(bestScheduledStart, bestScheduledEnd);
    const actualDuration = calculateShiftMinutes(actualStartTime, actualEndTime);
    const exitDiffFromEnd = getCircularMinuteDiff(actualEndTime, bestScheduledEnd);

    if (
      status === 'out_of_hours' &&
      actualDuration < Math.max(30, schedDuration - EARLY_EXIT_TOLERANCE_MINUTES)
    ) {
      exitStatus = 'early_exit';
      exitDiffMinutes = Math.max(0, schedDuration - actualDuration);
    } else if (exitDiffFromEnd < -EARLY_EXIT_TOLERANCE_MINUTES) {
      exitStatus = 'early_exit';
      exitDiffMinutes = Math.abs(exitDiffFromEnd);
    } else {
      exitStatus = 'on_time';
      exitDiffMinutes = Math.max(0, exitDiffFromEnd);
    }
  }

  const hasIssue =
    status === 'late' || status === 'out_of_hours' || exitStatus === 'early_exit';

  return {
    status,
    diffMinutes: bestDiff,
    scheduledStartTime: bestScheduledStart,
    scheduledEndTime: bestScheduledEnd,
    shiftPart,
    exitStatus,
    exitDiffMinutes,
    hasIssue,
  };
}

/** Return all attendance entries (active shift + recorded shifts) for a given calendar date */
export function getDayAttendanceEntries(
  job: LaborJob,
  dateStr: string,
  schedule: DaySchedule
): DayAttendanceEntry[] {
  const entries: DayAttendanceEntry[] = [];

  if (job.activeShift && job.activeShift.startDate === dateStr) {
    const evalRes = evaluatePunchPunctuality(job.activeShift.startTime, schedule);
    entries.push({
      id: 'active_shift',
      isActive: true,
      startTime: job.activeShift.startTime,
      ...evalRes,
    });
  }

  const dayShifts = (job.shifts || []).filter((s) => s.date === dateStr);
  for (const s of dayShifts) {
    const evalRes = evaluatePunchPunctuality(s.startTime, schedule, s.endTime);
    entries.push({
      id: s.id,
      isActive: false,
      startTime: s.startTime,
      endTime: s.endTime,
      ...evalRes,
    });
  }

  return entries;
}

export function getQuarterInfo(dateOrMonthStr: string) {
  const [yStr, mStr] = (dateOrMonthStr || '').split('-');
  const year = Number(yStr) || new Date().getFullYear();
  const month = Number(mStr) || new Date().getMonth() + 1;
  const quarter = (Math.floor((month - 1) / 3) + 1) as 1 | 2 | 3 | 4;
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  return {
    year,
    quarter,
    startMonth,
    endMonth,
    labelPt: `${quarter}º Trimestre ${year}`,
    labelEs: `${quarter}º Trimestre ${year}`,
  };
}

export interface QuarterlyLateAudit {
  year: number;
  quarter: 1 | 2 | 3 | 4;
  labelPt: string;
  labelEs: string;
  lateCount: number;
  limit: number;
  remainingBeforeRisk: number;
  riskLevel: 'none' | 'warning' | 'high' | 'critical';
  lateShifts: {
    id: string;
    date: string;
    startTime: string;
    scheduledStartTime?: string;
    diffMinutes: number;
  }[];
}

/** Count all late arrivals (> 5 min) inside the same quarter to alert about suspension risk (3/3) */
export function calculateQuarterlyLateAudit(
  job: LaborJob,
  referenceDateOrMonthStr: string
): QuarterlyLateAudit {
  const qInfo = getQuarterInfo(referenceDateOrMonthStr);
  const lateShifts: QuarterlyLateAudit['lateShifts'] = [];

  const isInQuarter = (dateStr: string) => {
    const [y, m] = (dateStr || '').split('-').map(Number);
    return y === qInfo.year && m >= qInfo.startMonth && m <= qInfo.endMonth;
  };

  if (job.activeShift && isInQuarter(job.activeShift.startDate)) {
    const sched = getScheduleForDate(job, job.activeShift.startDate);
    const evalRes = evaluatePunchPunctuality(job.activeShift.startTime, sched);
    if (evalRes.status === 'late') {
      lateShifts.push({
        id: 'active_shift',
        date: job.activeShift.startDate,
        startTime: job.activeShift.startTime,
        scheduledStartTime: evalRes.scheduledStartTime,
        diffMinutes: evalRes.diffMinutes,
      });
    }
  }

  for (const s of job.shifts || []) {
    if (!isInQuarter(s.date)) continue;
    const sched = getScheduleForDate(job, s.date);
    const evalRes = evaluatePunchPunctuality(s.startTime, sched, s.endTime);
    if (evalRes.status === 'late') {
      lateShifts.push({
        id: s.id,
        date: s.date,
        startTime: s.startTime,
        scheduledStartTime: evalRes.scheduledStartTime,
        diffMinutes: evalRes.diffMinutes,
      });
    }
  }

  lateShifts.sort((a, b) => b.date.localeCompare(a.date));
  const lateCount = lateShifts.length;
  const riskLevel: QuarterlyLateAudit['riskLevel'] =
    lateCount === 0
      ? 'none'
      : lateCount === 1
      ? 'warning'
      : lateCount === 2
      ? 'high'
      : 'critical';

  return {
    year: qInfo.year,
    quarter: qInfo.quarter,
    labelPt: qInfo.labelPt,
    labelEs: qInfo.labelEs,
    lateCount,
    limit: QUARTERLY_LATE_LIMIT,
    remainingBeforeRisk: Math.max(0, QUARTERLY_LATE_LIMIT - lateCount),
    riskLevel,
    lateShifts,
  };
}

export function getDayOfWeekKey(dateStr: string): DayOfWeekKey {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  const jsDay = dt.getDay(); // 0 = Sun, 1 = Mon...
  const map: DayOfWeekKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return map[jsDay] || 'mon';
}

export function formatLocalDateYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatLocalTimeHHMM(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Return Monday YYYY-MM-DD for the week containing dateStr */
export function getWeekStartMonday(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  const jsDay = dt.getDay();
  const diffToMonday = jsDay === 0 ? -6 : 1 - jsDay;
  dt.setDate(dt.getDate() + diffToMonday);
  return formatLocalDateYYYYMMDD(dt);
}

export function shiftDateByDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + days);
  return formatLocalDateYYYYMMDD(dt);
}

/** True only when the user explicitly imported, edited, or applied a schedule for this week */
export function hasScheduleForWeek(job: LaborJob, mondayDateStr: string): boolean {
  return Boolean(job.weekOverrides && job.weekOverrides[mondayDateStr]);
}

/** Returns the saved schedule for a week, or an empty (0h) schedule if none was registered */
export function getScheduleForWeek(job: LaborJob, mondayDateStr: string): WeeklySchedule {
  return job.weekOverrides?.[mondayDateStr] || createEmptyWeeklySchedule();
}

export function getScheduleForDate(job: LaborJob, dateStr: string): DaySchedule {
  const monday = getWeekStartMonday(dateStr);
  const week = getScheduleForWeek(job, monday);
  const key = getDayOfWeekKey(dateStr);
  return week[key];
}

/** Find the salary snapshot active for a given YYYY-MM */
export function getEffectiveSalarySnapshot(job: LaborJob, targetMonth: string): LaborSalarySnapshot {
  const sorted = [...(job.salaryHistory || [])].sort((a, b) =>
    a.effectiveFromMonth.localeCompare(b.effectiveFromMonth)
  );
  if (!sorted.length) {
    return {
      effectiveFromMonth: targetMonth,
      baseSalary: 0,
      benefits: [],
      deductionPercent: 0,
    };
  }
  let active = sorted[0];
  for (const snap of sorted) {
    if (snap.effectiveFromMonth <= targetMonth) {
      active = snap;
    } else {
      break;
    }
  }
  return active;
}

/** Calculate monthly salary from Base + Benefits + optional month extras */
function calculateRawMonthSalary(job: LaborJob, targetMonth: string): Omit<MonthlySalaryCalculation, 'aguinaldoAmount' | 'totalWithAguinaldo'> {
  const snap = getEffectiveSalarySnapshot(job, targetMonth);
  const override = job.monthOverrides?.[targetMonth];

  const baseSalary = override?.baseSalary !== undefined ? override.baseSalary : snap.baseSalary;
  const deductionPercent =
    override?.deductionPercent !== undefined ? override.deductionPercent : snap.deductionPercent || 0;
  const disabledIds = new Set(override?.disabledBenefitIds || []);

  const benefits = (snap.benefits || []).map((b) => {
    const enabled = b.enabled && !disabledIds.has(b.id);
    const effectiveType = override?.benefitTypeOverrides?.[b.id] || b.type;
    const rawValue =
      override?.benefitValueOverrides?.[b.id] !== undefined
        ? override.benefitValueOverrides[b.id]
        : b.value;
    const calculatedAmount = !enabled
      ? 0
      : effectiveType === 'percent'
      ? Math.round((baseSalary * rawValue) / 100)
      : rawValue;
    return {
      id: b.id,
      name: b.name,
      type: effectiveType,
      rawValue,
      calculatedAmount,
      enabled,
    };
  });

  const extraAmount = override?.extraAmount || 0;
  const benefitsTotal = benefits.reduce((acc, item) => acc + item.calculatedAmount, 0);
  const grossTotal = baseSalary + benefitsTotal + extraAmount;
  const deductionAmount = deductionPercent > 0 ? Math.round((grossTotal * deductionPercent) / 100) : 0;
  const netTotal = Math.max(0, grossTotal - deductionAmount);
  const monthlyHoursRef = Math.max(1, (job.weeklyTargetHours || 48) * 4.33);
  const hourlyRateRef = baseSalary / monthlyHoursRef;

  return {
    month: targetMonth,
    baseSalary,
    benefits,
    extraAmount,
    grossTotal,
    deductionPercent,
    deductionAmount,
    netTotal,
    hourlyRateRef,
  };
}

/** Calculate full monthly salary (no automatic SAC/Aguinaldo; user adds any bonus manually as a benefit) */
export function calculateMonthSalary(job: LaborJob, targetMonth: string): MonthlySalaryCalculation {
  const base = calculateRawMonthSalary(job, targetMonth);
  return {
    ...base,
    aguinaldoAmount: 0,
    totalWithAguinaldo: base.netTotal,
  };
}

export function buildTwelveMonthSalaryProjection(
  job: LaborJob,
  startMonth = getCurrentMonthStr()
): MonthlySalaryCalculation[] {
  const list: MonthlySalaryCalculation[] = [];
  for (let i = 0; i < 12; i++) {
    const m = shiftMonthStr(startMonth, i);
    list.push(calculateMonthSalary(job, m));
  }
  return list;
}

/** Compute weekly HR audit totals for the week starting at mondayDateStr */
export function calculateWeeklyAudit(job: LaborJob, mondayDateStr: string) {
  const hasSchedule = hasScheduleForWeek(job, mondayDateStr);
  const weekSchedule = getScheduleForWeek(job, mondayDateStr);
  const weekDates = ORDERED_WEEKDAYS.map((dayKey, idx) => ({
    dayKey,
    date: shiftDateByDays(mondayDateStr, idx),
    schedule: weekSchedule[dayKey],
  }));

  const dateSet = new Set(weekDates.map((d) => d.date));
  const weekShifts = (job.shifts || []).filter((s) => dateSet.has(s.date));

  const scheduledMinutes = hasSchedule
    ? weekDates.reduce((sum, d) => sum + calculateDayScheduleMinutes(d.schedule), 0)
    : 0;
  const workedMinutes = weekShifts.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);

  return {
    mondayDateStr,
    sundayDateStr: shiftDateByDays(mondayDateStr, 6),
    hasSchedule,
    weekDates,
    weekShifts,
    scheduledMinutes,
    workedMinutes,
    deltaMinutes: workedMinutes - scheduledMinutes,
  };
}

/**
 * Compute monthly HR audit totals for a calendar month (YYYY-MM).
 * Only weeks explicitly registered in job.weekOverrides count toward scheduledMinutes;
 * empty past/future weeks remain 0h until filled or imported by the user.
 */
export function calculateMonthlyAudit(job: LaborJob, targetMonth: string) {
  const [yStr, mStr] = targetMonth.split('-');
  const year = Number(yStr) || new Date().getFullYear();
  const month = Number(mStr) || new Date().getMonth() + 1;
  const daysInMonth = new Date(year, month, 0).getDate();

  const monthShifts = (job.shifts || [])
    .filter((s) => s.date && s.date.startsWith(targetMonth))
    .sort((a, b) => b.date.localeCompare(a.date));

  const shiftsByDate = new Map<string, typeof monthShifts>();
  for (const s of monthShifts) {
    const list = shiftsByDate.get(s.date) || [];
    list.push(s);
    shiftsByDate.set(s.date, list);
  }

  const weekMap = new Map<
    string,
    {
      mondayDateStr: string;
      firstDayInMonth: string;
      lastDayInMonth: string;
      hasSchedule: boolean;
      scheduledMinutes: number;
      workedMinutes: number;
      shiftsCount: number;
    }
  >();

  let scheduledMinutes = 0;
  let workedMinutes = 0;
  let onTimeCount = 0;
  let lateCount = 0;
  let totalLateMinutes = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const monday = getWeekStartMonday(dateStr);
    const hasSched = hasScheduleForWeek(job, monday);
    const daySched = getScheduleForDate(job, dateStr);
    const daySchedMins = hasSched ? calculateDayScheduleMinutes(daySched) : 0;

    const dayShifts = shiftsByDate.get(dateStr) || [];
    const dayWorkedMins = dayShifts.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);

    for (const s of dayShifts) {
      const p = evaluatePunchPunctuality(s.startTime, daySched, s.endTime);
      if (p.status === 'late') {
        lateCount++;
        totalLateMinutes += p.diffMinutes;
      } else if (p.status === 'on_time' || p.status === 'early') {
        onTimeCount++;
      }
    }

    scheduledMinutes += daySchedMins;
    workedMinutes += dayWorkedMins;

    const existing = weekMap.get(monday);
    if (!existing) {
      weekMap.set(monday, {
        mondayDateStr: monday,
        firstDayInMonth: dateStr,
        lastDayInMonth: dateStr,
        hasSchedule: hasSched,
        scheduledMinutes: daySchedMins,
        workedMinutes: dayWorkedMins,
        shiftsCount: dayShifts.length,
      });
    } else {
      existing.lastDayInMonth = dateStr;
      existing.scheduledMinutes += daySchedMins;
      existing.workedMinutes += dayWorkedMins;
      existing.shiftsCount += dayShifts.length;
    }
  }

  const weeksBreakdown = Array.from(weekMap.values()).map((w) => ({
    ...w,
    deltaMinutes: w.workedMinutes - w.scheduledMinutes,
  }));

  return {
    month: targetMonth,
    scheduledMinutes,
    workedMinutes,
    deltaMinutes: workedMinutes - scheduledMinutes,
    monthShifts,
    onTimeCount,
    lateCount,
    totalLateMinutes,
    configuredWeeksCount: weeksBreakdown.filter((w) => w.hasSchedule).length,
    totalWeeksCount: weeksBreakdown.length,
    weeksBreakdown,
  };
}
