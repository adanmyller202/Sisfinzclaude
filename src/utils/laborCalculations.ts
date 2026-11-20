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

export function createDefaultGastronomyBenefits(): LaborBenefit[] {
  return [
    { id: 'ben_asistencia', name: 'Assistência Perfeita', type: 'percent', value: 10, enabled: true },
    { id: 'ben_alimentacao', name: 'Alimentação', type: 'percent', value: 10, enabled: true },
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
  if (day.isOff) return 0;
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

export function getScheduleForWeek(job: LaborJob, mondayDateStr: string): WeeklySchedule {
  return job.weekOverrides?.[mondayDateStr] || job.defaultSchedule;
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

/** Calculate monthly salary without Aguinaldo (used internally to compute semester max for SAC) */
function calculateRawMonthSalary(job: LaborJob, targetMonth: string): Omit<MonthlySalaryCalculation, 'aguinaldoAmount' | 'totalWithAguinaldo'> {
  const snap = getEffectiveSalarySnapshot(job, targetMonth);
  const override = job.monthOverrides?.[targetMonth];

  const baseSalary = override?.baseSalary !== undefined ? override.baseSalary : snap.baseSalary;
  const deductionPercent =
    override?.deductionPercent !== undefined ? override.deductionPercent : snap.deductionPercent || 0;
  const disabledIds = new Set(override?.disabledBenefitIds || []);

  const benefits = (snap.benefits || []).map((b) => {
    const enabled = b.enabled && !disabledIds.has(b.id);
    const rawValue =
      override?.benefitValueOverrides?.[b.id] !== undefined
        ? override.benefitValueOverrides[b.id]
        : b.value;
    const calculatedAmount = !enabled
      ? 0
      : b.type === 'percent'
      ? Math.round((baseSalary * rawValue) / 100)
      : rawValue;
    return {
      id: b.id,
      name: b.name,
      type: b.type,
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

/** Calculate full monthly salary INCLUDING automatic Aguinaldo (SAC) in June (06) and December (12) */
export function calculateMonthSalary(job: LaborJob, targetMonth: string): MonthlySalaryCalculation {
  const base = calculateRawMonthSalary(job, targetMonth);
  const [yearStr, monthNumStr] = targetMonth.split('-');
  const monthNum = Number(monthNumStr);

  let aguinaldoAmount = 0;
  if (monthNum === 6 || monthNum === 12) {
    const startMonth = monthNum === 6 ? 1 : 7;
    const endMonth = monthNum;
    let maxNet = 0;
    for (let m = startMonth; m <= endMonth; m++) {
      const mStr = `${yearStr}-${String(m).padStart(2, '0')}`;
      const calc = calculateRawMonthSalary(job, mStr);
      if (calc.netTotal > maxNet) maxNet = calc.netTotal;
    }
    aguinaldoAmount = Math.round(maxNet * 0.5);
  }

  return {
    ...base,
    aguinaldoAmount,
    totalWithAguinaldo: base.netTotal + aguinaldoAmount,
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
  const weekSchedule = getScheduleForWeek(job, mondayDateStr);
  const weekDates = ORDERED_WEEKDAYS.map((dayKey, idx) => ({
    dayKey,
    date: shiftDateByDays(mondayDateStr, idx),
    schedule: weekSchedule[dayKey],
  }));

  const dateSet = new Set(weekDates.map((d) => d.date));
  const weekShifts = (job.shifts || []).filter((s) => dateSet.has(s.date));

  const scheduledMinutes = weekDates.reduce(
    (sum, d) => sum + calculateDayScheduleMinutes(d.schedule),
    0
  );
  const workedMinutes = weekShifts.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);

  return {
    mondayDateStr,
    sundayDateStr: shiftDateByDays(mondayDateStr, 6),
    weekDates,
    weekShifts,
    scheduledMinutes,
    workedMinutes,
    deltaMinutes: workedMinutes - scheduledMinutes,
  };
}
