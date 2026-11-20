import { CurrencyCode } from '../types';

export type DayOfWeekKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type BenefitCalcType = 'percent' | 'fixed' | 'variable';

export type TipFrequency = 'weekly' | 'daily';

export type ShiftTag = 'overtime' | 'holiday' | 'split_shift' | 'day_swap' | 'advance' | 'absence';

export interface DaySchedule {
  isOff: boolean;
  /** True when the week has no schedule registered yet (counts as 0h and excluded from calculations) */
  isUnset?: boolean;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm (if <= startTime, treated as overnight +1 day)
  isSplitShift?: boolean;
  splitStartTime?: string;
  splitEndTime?: string;
  note?: string;
}

export type WeeklySchedule = Record<DayOfWeekKey, DaySchedule>;

export interface LaborBenefit {
  id: string;
  name: string;
  type: BenefitCalcType;
  value: number; // percentage (0-100) if 'percent', currency amount if 'fixed' or 'variable'
  enabled: boolean;
}

export interface LaborSalarySnapshot {
  effectiveFromMonth: string; // YYYY-MM (applies from this month onward until a newer snapshot)
  baseSalary: number;
  benefits: LaborBenefit[];
  deductionPercent: number; // optional payroll deduction % (0 = net directly)
}

export interface LaborMonthOverride {
  baseSalary?: number;
  deductionPercent?: number;
  disabledBenefitIds?: string[];
  benefitValueOverrides?: Record<string, number>;
  extraAmount?: number;
  extraNote?: string;
}

export interface LaborShiftEntry {
  id: string;
  date: string;       // YYYY-MM-DD (shift start date)
  startTime: string;  // HH:mm
  endTime: string;    // HH:mm
  durationMinutes: number;
  scheduledMinutes: number;
  tags: ShiftTag[];
  note?: string;
  createdAt: string;
}

export interface ActiveShiftState {
  startedAtIso: string;
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  scheduledMinutes: number;
}

export interface LaborTipEntry {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  currency: CurrencyCode;
  accountId?: string;
  accountName?: string;
  syncedToFinance: boolean;
  linkedIncomeId?: string;
  note?: string;
  createdAt: string;
}

export interface LaborJob {
  id: string;
  companyName: string;
  role: string;
  currency: CurrencyCode;
  weeklyTargetHours: number;
  tipFrequency: TipFrequency;
  tipWeekday: DayOfWeekKey; // default 'wed' for weekly tips
  defaultAccountId?: string;
  linkedSalaryIncomeId?: string;
  defaultSchedule: WeeklySchedule;
  /** Week-specific schedule overrides keyed by Monday's date YYYY-MM-DD */
  weekOverrides: Record<string, WeeklySchedule>;
  /** Chronological salary snapshots (each applies from effectiveFromMonth forward) */
  salaryHistory: LaborSalarySnapshot[];
  /** Single-month overrides keyed by YYYY-MM */
  monthOverrides: Record<string, LaborMonthOverride>;
  shifts: LaborShiftEntry[];
  activeShift: ActiveShiftState | null;
  tips: LaborTipEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface MonthlySalaryCalculation {
  month: string;
  baseSalary: number;
  benefits: {
    id: string;
    name: string;
    type: BenefitCalcType;
    rawValue: number;
    calculatedAmount: number;
    enabled: boolean;
  }[];
  extraAmount: number;
  grossTotal: number;
  deductionPercent: number;
  deductionAmount: number;
  netTotal: number;
  aguinaldoAmount: number; // non-zero in June (06) and December (12)
  totalWithAguinaldo: number;
  hourlyRateRef: number;
}
