import { CurrencyCode } from '../types';

export type DayOfWeekKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type BenefitCalcType = 'percent' | 'fixed' | 'variable';

export type TipFrequency = 'weekly' | 'daily';

export type ShiftTag = 'overtime' | 'holiday' | 'split_shift' | 'day_swap' | 'advance' | 'absence';

export type ShiftPartKey = 1 | 2;

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
  /** When true (e.g. Adelanto), subtracts from the monthly salary instead of adding */
  isDeduction?: boolean;
}

export interface LaborSalarySnapshot {
  effectiveFromMonth: string; // YYYY-MM (applies from this month onward until a newer snapshot)
  baseSalary: number;
  benefits: LaborBenefit[];
  deductionPercent: number; // optional payroll deduction % (0 = net directly)
}

export interface ReceivedSalaryItemEntry {
  itemId: string;
  itemName: string;
  amount: number;
  linkedIncomeId: string;
  creditNow: boolean;
  depositDate: string; // YYYY-MM-DD
  accountId?: string;
  accountName?: string;
  receivedAt: string;
}

export interface LaborMonthOverride {
  baseSalary?: number;
  deductionPercent?: number;
  disabledBenefitIds?: string[];
  enabledBenefitIds?: string[];
  benefitValueOverrides?: Record<string, number>;
  benefitTypeOverrides?: Record<string, BenefitCalcType>;
  benefitDeductionOverrides?: Record<string, boolean>;
  singleMonthBenefits?: LaborBenefit[];
  extraBenefits?: LaborBenefit[];
  extraAmount?: number;
  extraNote?: string;
  /** Individual salary composition items already received or scheduled separately for this month */
  receivedItems?: Record<string, ReceivedSalaryItemEntry>;
}

export interface LaborShiftEntry {
  id: string;
  date: string;       // YYYY-MM-DD (shift start date)
  startTime: string;  // HH:mm
  endTime: string;    // HH:mm
  durationMinutes: number;
  scheduledMinutes: number;
  shiftPart?: ShiftPartKey;
  tags: ShiftTag[];
  note?: string;
  createdAt: string;
}

export interface ActiveShiftState {
  startedAtIso: string;
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  scheduledMinutes: number;
  shiftPart?: ShiftPartKey;
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
  /** Audit trail for salary advances registered from the salary editor. */
  salaryAdvanceHistory?: {
    id: string;
    month: string;
    amount: number;
    reason: string;
    createIncome: boolean;
    creditNow: boolean;
    depositDate?: string;
    accountId?: string;
    createdAt: string;
  }[];
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
    isDeduction?: boolean;
  }[];
  extraAmount: number;
  grossTotal: number;
  deductionPercent: number;
  deductionAmount: number;
  netTotal: number;
  /** Sum of individual composition items already received or scheduled separately for this month */
  separatelyReceivedTotal: number;
  /** Remaining salary amount still pending in the main salary income (netTotal - separatelyReceivedTotal) */
  remainingToReceive: number;
  aguinaldoAmount: number;
  totalWithAguinaldo: number;
  hourlyRateRef: number;
}
