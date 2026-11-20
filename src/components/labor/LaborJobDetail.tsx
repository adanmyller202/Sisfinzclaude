import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Calendar,
  Clock,
  DollarSign,
  Coins,
  Settings,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Plus,
  Trash2,
  Check,
  Upload,
  Wallet,
  X,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  RotateCcw,
  Edit3,
  Zap,
} from 'lucide-react';
import { AccountItem, CurrencyCode, LanguageCode } from '../../types';
import {
  BenefitCalcType,
  DayOfWeekKey,
  DaySchedule,
  LaborBenefit,
  LaborJob,
  LaborShiftEntry,
  ShiftTag,
  TipFrequency,
  WeeklySchedule,
} from '../../types/labor';
import {
  LATE_TOLERANCE_MINUTES,
  ORDERED_WEEKDAYS,
  WEEKDAY_LABELS,
  buildTwelveMonthSalaryProjection,
  calculateDayScheduleMinutes,
  calculateMonthSalary,
  calculateMonthlyAudit,
  calculateQuarterlyLateAudit,
  calculateShiftMinutes,
  calculateWeeklyAudit,
  evaluatePunchPunctuality,
  formatDurationCompact,
  formatLocalDateYYYYMMDD,
  formatLocalTimeHHMM,
  formatMinutesAsHours,
  getDayAttendanceEntries,
  getEffectiveSalarySnapshot,
  getScheduleForDate,
  getScheduleForWeek,
  getWeekStartMonday,
  hasScheduleForWeek,
  parseTimeToMinutes,
  shiftDateByDays,
} from '../../utils/laborCalculations';
import { formatCurrency } from '../../utils/currency';
import { getCurrentMonthStr, shiftMonthStr } from '../../utils/finance';
import { getLocaleForLanguage } from '../../utils/i18n';
import { HoldToPunchButton, ShiftCompletedBanner } from './HoldToPunchButton';
import { ScheduleImportModal } from './ScheduleImportModal';

interface LaborJobDetailProps {
  job: LaborJob;
  accounts: AccountItem[];
  language: LanguageCode;
  onBack: () => void;
  onSaveJob: (updated: LaborJob) => Promise<void>;
  onDeleteJob: (jobId: string) => Promise<void>;
  onRecordTipToSisFinz: (params: {
    job: LaborJob;
    amount: number;
    date: string;
    accountId?: string;
    note?: string;
  }) => Promise<any>;
  onSyncSalaryToSisFinz: (params: {
    job: LaborJob;
    targetMonth: string;
    amount: number;
    scope: 'single' | 'future';
  }) => Promise<boolean>;
}

type AccordionSection = 'schedule' | 'history' | 'salary' | 'tips' | 'settings' | null;

const SHIFT_TAGS: { id: ShiftTag; labelPt: string; labelEs: string }[] = [
  { id: 'overtime', labelPt: 'Hora Extra', labelEs: 'Hora Extra' },
  { id: 'holiday', labelPt: 'Feriado', labelEs: 'Feriado' },
  { id: 'split_shift', labelPt: 'Turno Cortado', labelEs: 'Cortado' },
  { id: 'day_swap', labelPt: 'Troca de Franco', labelEs: 'Cambio Franco' },
  { id: 'advance', labelPt: 'Vale / Adiant.', labelEs: 'Adelanto' },
  { id: 'absence', labelPt: 'Falta / Atestado', labelEs: 'Falta' },
];

function addMinutesToHHMM(timeStr: string, deltaMinutes: number): string {
  const base = parseTimeToMinutes(timeStr || '18:00');
  const total = (((base + deltaMinutes) % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const LaborJobDetail: React.FC<LaborJobDetailProps> = ({
  job,
  accounts,
  language,
  onBack,
  onSaveJob,
  onDeleteJob,
  onRecordTipToSisFinz,
  onSyncSalaryToSisFinz,
}) => {
  const locale = getLocaleForLanguage(language);
  const todayStr = formatLocalDateYYYYMMDD(new Date());
  const currentMonth = getCurrentMonthStr();
  const currentWeekMonday = useMemo(() => getWeekStartMonday(todayStr), [todayStr]);

  const [openSection, setOpenSection] = useState<AccordionSection>('schedule');
  const [selectedMonday, setSelectedMonday] = useState<string>(() => getWeekStartMonday(todayStr));
  const [historyMode, setHistoryMode] = useState<'weekly' | 'monthly'>('monthly');
  const [selectedAuditMonth, setSelectedAuditMonth] = useState<string>(currentMonth);
  const [selectedSalaryMonth, setSelectedSalaryMonth] = useState<string>(currentMonth);
  const [isImportOpen, setIsImportOpen] = useState(false);

  // Quick punch chooser ("Ponto rápido") per day
  const [quickPunchDay, setQuickPunchDay] = useState<{
    date: string;
    dayLabel: string;
    schedule: DaySchedule;
    existingShifts: LaborShiftEntry[];
    isSplitShiftDay: boolean;
  } | null>(null);
  const [quickLateMinutes, setQuickLateMinutes] = useState('15');
  const [quickReplaceShiftId, setQuickReplaceShiftId] = useState<string | null>(null);

  // Manual shift entry / edit shift modal state
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [editingActiveShift, setEditingActiveShift] = useState(false);
  const [shiftFormDate, setShiftFormDate] = useState(todayStr);
  const [shiftFormStart, setShiftFormStart] = useState('18:00');
  const [shiftFormEnd, setShiftFormEnd] = useState('02:00');
  const [shiftFormTags, setShiftFormTags] = useState<ShiftTag[]>([]);
  const [shiftFormNote, setShiftFormNote] = useState('');
  const [shiftFormQuickTip, setShiftFormQuickTip] = useState('');
  const [justFinishedShiftBanner, setJustFinishedShiftBanner] = useState<{
    durationMinutes: number;
    scheduledMinutes: number;
  } | null>(null);

  // Duplicate punch prevention popup
  const [duplicatePunchPrompt, setDuplicatePunchPrompt] = useState<{
    source: 'punch' | 'manual';
    date: string;
    existingShifts: LaborShiftEntry[];
    isSplitShiftDay: boolean;
  } | null>(null);

  // Salary editor state + smart scope prompt ("Só neste mês" vs "Deste mês em diante")
  const [salaryEditorOpen, setSalaryEditorOpen] = useState(false);
  const [draftBaseSalary, setDraftBaseSalary] = useState('');
  const [draftBenefits, setDraftBenefits] = useState<LaborBenefit[]>([]);
  const [draftExtraAmount, setDraftExtraAmount] = useState('');
  const [newBenefitName, setNewBenefitName] = useState('');
  const [newBenefitType, setNewBenefitType] = useState<BenefitCalcType>('percent');
  const [newBenefitValue, setNewBenefitValue] = useState('');
  const [syncSalaryWithFinance, setSyncSalaryWithFinance] = useState(true);
  const [scopeConfirmOpen, setScopeConfirmOpen] = useState(false);
  const [salarySavedToast, setSalarySavedToast] = useState<string | null>(null);

  // Tip registration state
  const [tipAmount, setTipAmount] = useState('');
  const [tipDate, setTipDate] = useState(todayStr);
  const [tipAccountId, setTipAccountId] = useState<string>(
    job.defaultAccountId || accounts[0]?.id || ''
  );
  const [tipNote, setTipNote] = useState('');
  const [isSavingTip, setIsSavingTip] = useState(false);
  const [tipToast, setTipToast] = useState<string | null>(null);

  // Job settings state
  const [editCompany, setEditCompany] = useState(job.companyName);
  const [editRole, setEditRole] = useState(job.role);
  const [editWeeklyHours, setEditWeeklyHours] = useState(String(job.weeklyTargetHours || 48));
  const [editCurrency, setEditCurrency] = useState<CurrencyCode>(job.currency);
  const [editTipFreq, setEditTipFreq] = useState<TipFrequency>(job.tipFrequency || 'weekly');
  const [editTipWeekday, setEditTipWeekday] = useState<DayOfWeekKey>(job.tipWeekday || 'wed');
  const [editDefaultAcc, setEditDefaultAcc] = useState(job.defaultAccountId || '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isViewingCurrentWeek = selectedMonday === currentWeekMonday;

  const todaySchedule = useMemo(() => getScheduleForDate(job, todayStr), [job, todayStr]);
  const selectedWeekHasSchedule = useMemo(
    () => hasScheduleForWeek(job, selectedMonday),
    [job, selectedMonday]
  );
  const weekSchedule = useMemo(
    () => getScheduleForWeek(job, selectedMonday),
    [job, selectedMonday]
  );
  const weeklyAudit = useMemo(
    () => calculateWeeklyAudit(job, selectedMonday),
    [job, selectedMonday]
  );
  const monthlyAudit = useMemo(
    () => calculateMonthlyAudit(job, selectedAuditMonth),
    [job, selectedAuditMonth]
  );
  const currentMonthAudit = useMemo(
    () => calculateMonthlyAudit(job, currentMonth),
    [job, currentMonth]
  );
  const quarterlyLateAudit = useMemo(
    () => calculateQuarterlyLateAudit(job, todayStr),
    [job, todayStr]
  );
  const currentMonthSalary = useMemo(
    () => calculateMonthSalary(job, selectedSalaryMonth),
    [job, selectedSalaryMonth]
  );
  const twelveMonthProjection = useMemo(
    () => buildTwelveMonthSalaryProjection(job, currentMonth),
    [job, currentMonth]
  );

  const currentMonthTipsTotal = useMemo(() => {
    return (job.tips || [])
      .filter((t) => t.date?.startsWith(currentMonth))
      .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
  }, [job.tips, currentMonth]);

  const toggleSection = (sec: AccordionSection) => {
    setOpenSection((prev) => (prev === sec ? null : sec));
  };

  // --- Quick Punch ("Ponto rápido") Handler ---
  const openQuickPunchForDay = (dateStr: string, dayLabel: string, sched: DaySchedule) => {
    const existingForDay = (job.shifts || []).filter((s) => s.date === dateStr);
    setQuickLateMinutes('15');
    setQuickReplaceShiftId(existingForDay.length === 1 ? existingForDay[0].id : null);
    setQuickPunchDay({
      date: dateStr,
      dayLabel,
      schedule: sched,
      existingShifts: existingForDay,
      isSplitShiftDay: Boolean(sched.isSplitShift && !sched.isOff && !sched.isUnset),
    });
  };

  const applyQuickPunch = async (mode: 'on_time' | 'late') => {
    if (!quickPunchDay) return;
    const { date, schedule, existingShifts, isSplitShiftDay } = quickPunchDay;

    const baseStart =
      !schedule.isUnset && !schedule.isOff && schedule.startTime
        ? schedule.startTime
        : '18:00';
    const baseEnd =
      !schedule.isUnset && !schedule.isOff && schedule.endTime
        ? schedule.endTime
        : '02:00';

    const lateMins =
      mode === 'late'
        ? Math.max(LATE_TOLERANCE_MINUTES + 1, Number(quickLateMinutes) || 15)
        : 0;

    const startTime = mode === 'late' ? addMinutesToHHMM(baseStart, lateMins) : baseStart;
    const endTime = baseEnd;
    const durationMinutes = calculateShiftMinutes(startTime, endTime);
    const scheduledMinutes = calculateDayScheduleMinutes(schedule);

    const newEntry: LaborShiftEntry = {
      id:
        quickReplaceShiftId ||
        `shift_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      date,
      startTime,
      endTime,
      durationMinutes,
      scheduledMinutes,
      tags: [],
      note:
        mode === 'late'
          ? `Ponto rápido • Atraso de ${formatDurationCompact(lateMins)}`
          : 'Ponto rápido • No horário',
      createdAt: new Date().toISOString(),
    };

    const currentShifts = job.shifts || [];
    let nextShifts: LaborShiftEntry[];

    if (quickReplaceShiftId) {
      nextShifts = currentShifts.map((s) => (s.id === quickReplaceShiftId ? newEntry : s));
    } else if (existingShifts.length > 0 && !isSplitShiftDay) {
      const firstId = existingShifts[0].id;
      nextShifts = currentShifts.map((s) => (s.id === firstId ? { ...newEntry, id: firstId } : s));
    } else {
      nextShifts = [newEntry, ...currentShifts];
    }

    nextShifts.sort((a, b) => b.date.localeCompare(a.date));

    await onSaveJob({
      ...job,
      shifts: nextShifts,
    });

    setQuickPunchDay(null);
    setQuickReplaceShiftId(null);
  };

  // --- Shift Modal Openers ---
  const openNewManualShiftModal = () => {
    setEditingShiftId(null);
    setEditingActiveShift(false);
    setShiftFormDate(todayStr);
    setShiftFormStart(todaySchedule.startTime || '18:00');
    setShiftFormEnd(todaySchedule.endTime || '02:00');
    setShiftFormTags([]);
    setShiftFormNote('');
    setShiftFormQuickTip('');
    setShiftModalOpen(true);
  };

  const openEditShiftModal = (shift: LaborShiftEntry) => {
    setEditingShiftId(shift.id);
    setEditingActiveShift(false);
    setShiftFormDate(shift.date);
    setShiftFormStart(shift.startTime);
    setShiftFormEnd(shift.endTime);
    setShiftFormTags(shift.tags || []);
    setShiftFormNote(shift.note || '');
    setShiftFormQuickTip('');
    setShiftModalOpen(true);
  };

  const openEditActiveShiftModal = () => {
    if (!job.activeShift) return;
    setEditingShiftId(null);
    setEditingActiveShift(true);
    setShiftFormDate(job.activeShift.startDate);
    setShiftFormStart(job.activeShift.startTime);
    setShiftFormEnd('');
    setShiftFormTags([]);
    setShiftFormNote('');
    setShiftFormQuickTip('');
    setShiftModalOpen(true);
  };

  const closeShiftModal = () => {
    setShiftModalOpen(false);
    setEditingShiftId(null);
    setEditingActiveShift(false);
  };

  // --- Punch Clock Handlers ---
  const startNewActiveShiftNow = async () => {
    const now = new Date();
    const startDate = formatLocalDateYYYYMMDD(now);
    const startTime = formatLocalTimeHHMM(now);
    const sched = getScheduleForDate(job, startDate);
    await onSaveJob({
      ...job,
      activeShift: {
        startedAtIso: now.toISOString(),
        startDate,
        startTime,
        scheduledMinutes: calculateDayScheduleMinutes(sched),
      },
    });
  };

  const handleStartShift = async () => {
    const now = new Date();
    const startDate = formatLocalDateYYYYMMDD(now);
    const existingForToday = (job.shifts || []).filter((s) => s.date === startDate);
    if (existingForToday.length > 0) {
      const sched = getScheduleForDate(job, startDate);
      setDuplicatePunchPrompt({
        source: 'punch',
        date: startDate,
        existingShifts: existingForToday,
        isSplitShiftDay: Boolean(sched.isSplitShift && !sched.isOff && !sched.isUnset),
      });
      return;
    }
    await startNewActiveShiftNow();
  };

  const handleEndShift = async () => {
    if (!job.activeShift) return;
    const now = new Date();
    const endTime = formatLocalTimeHHMM(now);
    const startedMs = new Date(job.activeShift.startedAtIso).getTime();
    const durationMinutes = Math.max(
      1,
      Number.isNaN(startedMs)
        ? calculateShiftMinutes(job.activeShift.startTime, endTime)
        : Math.round((now.getTime() - startedMs) / 60000)
    );

    const newShift: LaborShiftEntry = {
      id: `shift_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      date: job.activeShift.startDate,
      startTime: job.activeShift.startTime,
      endTime,
      durationMinutes,
      scheduledMinutes: job.activeShift.scheduledMinutes,
      tags:
        job.activeShift.scheduledMinutes > 0 &&
        durationMinutes - job.activeShift.scheduledMinutes >= 20
          ? ['overtime']
          : [],
      createdAt: now.toISOString(),
    };

    await onSaveJob({
      ...job,
      activeShift: null,
      shifts: [newShift, ...(job.shifts || [])],
    });

    setJustFinishedShiftBanner({
      durationMinutes,
      scheduledMinutes: job.activeShift.scheduledMinutes,
    });
    if (job.tipFrequency === 'daily') {
      setOpenSection('tips');
    }
  };

  const commitNewManualShift = async () => {
    const durationMinutes = calculateShiftMinutes(shiftFormStart, shiftFormEnd);
    const sched = getScheduleForDate(job, shiftFormDate);
    const scheduledMinutes = calculateDayScheduleMinutes(sched);

    const entry: LaborShiftEntry = {
      id: `shift_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      date: shiftFormDate,
      startTime: shiftFormStart,
      endTime: shiftFormEnd,
      durationMinutes,
      scheduledMinutes,
      tags: shiftFormTags,
      note: shiftFormNote.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    const updatedJob: LaborJob = {
      ...job,
      shifts: [entry, ...(job.shifts || [])].sort((a, b) => b.date.localeCompare(a.date)),
    };

    await onSaveJob(updatedJob);

    const quickTipNum = Number(shiftFormQuickTip.replace(',', '.'));
    if (quickTipNum > 0) {
      await onRecordTipToSisFinz({
        job: updatedJob,
        amount: quickTipNum,
        date: shiftFormDate,
        accountId: tipAccountId || job.defaultAccountId || accounts[0]?.id,
        note: shiftFormNote.trim() || 'Propina do turno',
      });
    }

    closeShiftModal();
    setShiftFormNote('');
    setShiftFormQuickTip('');
    setShiftFormTags([]);
  };

  const handleSaveManualShift = async () => {
    if (editingActiveShift && job.activeShift) {
      const [y, m, d] = shiftFormDate.split('-').map(Number);
      const [hh, mm] = shiftFormStart.split(':').map(Number);
      const dt = new Date(y || 2026, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0);
      const sched = getScheduleForDate(job, shiftFormDate);
      await onSaveJob({
        ...job,
        activeShift: {
          startedAtIso: dt.toISOString(),
          startDate: shiftFormDate,
          startTime: shiftFormStart,
          scheduledMinutes: calculateDayScheduleMinutes(sched),
        },
      });
      closeShiftModal();
      return;
    }

    if (editingShiftId) {
      const durationMinutes = calculateShiftMinutes(shiftFormStart, shiftFormEnd);
      const sched = getScheduleForDate(job, shiftFormDate);
      const scheduledMinutes = calculateDayScheduleMinutes(sched);

      const updatedShifts = (job.shifts || [])
        .map((s) =>
          s.id === editingShiftId
            ? {
                ...s,
                date: shiftFormDate,
                startTime: shiftFormStart,
                endTime: shiftFormEnd,
                durationMinutes,
                scheduledMinutes,
                tags: shiftFormTags,
                note: shiftFormNote.trim() || undefined,
              }
            : s
        )
        .sort((a, b) => b.date.localeCompare(a.date));

      await onSaveJob({
        ...job,
        shifts: updatedShifts,
      });
      closeShiftModal();
      return;
    }

    const existingForDate = (job.shifts || []).filter((s) => s.date === shiftFormDate);
    if (existingForDate.length > 0) {
      const sched = getScheduleForDate(job, shiftFormDate);
      setDuplicatePunchPrompt({
        source: 'manual',
        date: shiftFormDate,
        existingShifts: existingForDate,
        isSplitShiftDay: Boolean(sched.isSplitShift && !sched.isOff && !sched.isUnset),
      });
      return;
    }

    await commitNewManualShift();
  };

  const handleDeleteShift = async (shiftId: string) => {
    await onSaveJob({
      ...job,
      shifts: (job.shifts || []).filter((s) => s.id !== shiftId),
    });
  };

  const handleCancelActiveShift = async () => {
    if (!job.activeShift) return;
    await onSaveJob({
      ...job,
      activeShift: null,
    });
  };

  // --- Schedule Handlers ---
  const updateWeekDay = async (
    dayKey: DayOfWeekKey,
    patch: Partial<WeeklySchedule[DayOfWeekKey]>
  ) => {
    const currentWeek = getScheduleForWeek(job, selectedMonday);
    const updatedWeek: WeeklySchedule = {
      ...currentWeek,
      [dayKey]: { ...currentWeek[dayKey], ...patch, isUnset: false },
    };
    await onSaveJob({
      ...job,
      weekOverrides: {
        ...(job.weekOverrides || {}),
        [selectedMonday]: updatedWeek,
      },
    });
  };

  const handleApplyImportedSchedule = async (
    schedule: WeeklySchedule,
    saveAsDefault: boolean
  ) => {
    const cleanedSchedule: WeeklySchedule = { ...schedule };
    for (const dayKey of ORDERED_WEEKDAYS) {
      cleanedSchedule[dayKey] = { ...cleanedSchedule[dayKey], isUnset: false };
    }
    await onSaveJob({
      ...job,
      defaultSchedule: saveAsDefault ? cleanedSchedule : job.defaultSchedule,
      weekOverrides: {
        ...(job.weekOverrides || {}),
        [selectedMonday]: cleanedSchedule,
      },
    });
  };

  const handleApplyDefaultToCurrentWeek = async () => {
    const cleanedDefault: WeeklySchedule = { ...job.defaultSchedule };
    for (const dayKey of ORDERED_WEEKDAYS) {
      cleanedDefault[dayKey] = { ...cleanedDefault[dayKey], isUnset: false };
    }
    await onSaveJob({
      ...job,
      weekOverrides: {
        ...(job.weekOverrides || {}),
        [selectedMonday]: cleanedDefault,
      },
    });
  };

  const handleClearCurrentWeekSchedule = async () => {
    const nextOverrides = { ...(job.weekOverrides || {}) };
    delete nextOverrides[selectedMonday];
    await onSaveJob({
      ...job,
      weekOverrides: nextOverrides,
    });
  };

  const handleMakeCurrentWeekDefault = async () => {
    await onSaveJob({
      ...job,
      defaultSchedule: weekSchedule,
    });
  };

  // --- Salary & Benefits Handlers ---
  const openSalaryEditor = () => {
    const snap = getEffectiveSalarySnapshot(job, selectedSalaryMonth);
    const calc = calculateMonthSalary(job, selectedSalaryMonth);
    const override = job.monthOverrides?.[selectedSalaryMonth];
    const snapBenefitIds = new Set((snap.benefits || []).map((b) => b.id));

    const mergedDraft: LaborBenefit[] = calc.benefits
      .filter(
        (cb) =>
          snapBenefitIds.has(cb.id) ||
          ((override as any)?.extraBenefits || []).some((eb: LaborBenefit) => eb.id === cb.id)
      )
      .map((cb) => ({
        id: cb.id,
        name: cb.name,
        type: cb.type,
        value: cb.rawValue,
        enabled: cb.enabled,
      }));

    setDraftBaseSalary(String(calc.baseSalary || 0));
    setDraftBenefits(mergedDraft);
    setDraftExtraAmount(String(calc.extraAmount || 0));
    setSalaryEditorOpen(true);
  };

  const hasAntiguidadeInDraft = useMemo(
    () =>
      draftBenefits.some(
        (b) =>
          b.id === 'ben_antiguidade' ||
          b.name.toLowerCase().includes('antiguid') ||
          b.name.toLowerCase().includes('antigued') ||
          b.name.toLowerCase().includes('antigüed')
      ),
    [draftBenefits]
  );

  const handleQuickAddAntiguidade = () => {
    if (hasAntiguidadeInDraft) return;
    setDraftBenefits((prev) => [
      ...prev,
      {
        id: `ben_antiguidade_${Date.now()}`,
        name: 'Antiguidade',
        type: 'percent',
        value: 0,
        enabled: true,
      },
    ]);
  };

  const handleAddBenefitToDraft = () => {
    if (!newBenefitName.trim()) return;
    const val = Math.max(0, Number(newBenefitValue.replace(',', '.')) || 0);
    setDraftBenefits((prev) => [
      ...prev,
      {
        id: `ben_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        name: newBenefitName.trim(),
        type: newBenefitType,
        value: val,
        enabled: true,
      },
    ]);
    setNewBenefitName('');
    setNewBenefitValue('');
  };

  const applySalaryChanges = async (scope: 'single' | 'future') => {
    const newBase = Math.max(0, Number(draftBaseSalary.replace(',', '.')) || 0);
    const newExtra = Math.max(0, Number(draftExtraAmount.replace(',', '.')) || 0);

    let updatedJob: LaborJob;

    if (scope === 'single') {
      // Single-month scope ("Manter valor original nos próximos meses"):
      // Apply enabled/new benefits ONLY in `selectedSalaryMonth`, and for subsequent months
      // keep the benefit UNCHECKED (`enabled: false`) so future months keep their original value.
      const baseSnap = getEffectiveSalarySnapshot(job, selectedSalaryMonth);
      const baseSnapIds = new Set((baseSnap.benefits || []).map((b) => b.id));

      const disabledBenefitIds = draftBenefits.filter((b) => !b.enabled).map((b) => b.id);
      const benefitValueOverrides: Record<string, number> = {};
      const benefitTypeOverrides: Record<string, BenefitCalcType> = {};
      const singleMonthOnlyBenefits: LaborBenefit[] = [];
      const newlyEnabledOrAddedIds: string[] = [];

      draftBenefits.forEach((b) => {
        benefitValueOverrides[b.id] = b.value;
        benefitTypeOverrides[b.id] = b.type;
        if (!baseSnapIds.has(b.id)) {
          singleMonthOnlyBenefits.push(b);
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

      const prevMonthOverride = nextMonthOverrides[selectedSalaryMonth] || {};
      nextMonthOverrides[selectedSalaryMonth] = {
        ...prevMonthOverride,
        baseSalary: newBase,
        disabledBenefitIds,
        benefitValueOverrides,
        benefitTypeOverrides,
        extraBenefits: singleMonthOnlyBenefits,
        extraAmount: newExtra,
      };

      // Uncheck newly added/enabled benefits in subsequent months so future months stay original
      if (newlyEnabledOrAddedIds.length > 0) {
        for (const [mKey, mOv] of Object.entries(nextMonthOverrides)) {
          if (mKey <= selectedSalaryMonth) continue;
          const existingDisabled = new Set<string>(mOv?.disabledBenefitIds || []);
          newlyEnabledOrAddedIds.forEach((id) => existingDisabled.add(id));
          nextMonthOverrides[mKey] = {
            ...mOv,
            disabledBenefitIds: Array.from(existingDisabled),
          };
        }
      }

      updatedJob = {
        ...job,
        monthOverrides: nextMonthOverrides,
      };
    } else {
      // Future scope ("Atualizar deste mês em diante"):
      // Apply the full draft (including any newly created benefit) from selectedSalaryMonth onward,
      // while keeping past months (< selectedSalaryMonth) intact.
      const pastSnapshots = (job.salaryHistory || []).filter(
        (s) => s.effectiveFromMonth < selectedSalaryMonth
      );
      const newSnapshot = {
        effectiveFromMonth: selectedSalaryMonth,
        baseSalary: newBase,
        benefits: draftBenefits,
        deductionPercent: 0,
      };
      const nextOverrides = { ...(job.monthOverrides || {}) };
      if (newExtra > 0) {
        nextOverrides[selectedSalaryMonth] = { extraAmount: newExtra };
      } else {
        delete nextOverrides[selectedSalaryMonth];
      }

      updatedJob = {
        ...job,
        salaryHistory: [...pastSnapshots, newSnapshot],
        monthOverrides: nextOverrides,
      };
    }

    await onSaveJob(updatedJob);

    const nextCalc = calculateMonthSalary(updatedJob, selectedSalaryMonth);
    if (syncSalaryWithFinance && nextCalc.netTotal > 0) {
      await onSyncSalaryToSisFinz({
        job: updatedJob,
        targetMonth: selectedSalaryMonth,
        amount: nextCalc.netTotal,
        scope,
      });
    }

    setScopeConfirmOpen(false);
    setSalaryEditorOpen(false);
    setSalarySavedToast(
      scope === 'future'
        ? 'Salário, benefícios e projeção atualizados deste mês em diante!'
        : 'Benefício aplicado somente neste mês — próximos meses mantidos desmarcados!'
    );
    window.setTimeout(() => setSalarySavedToast(null), 3200);
  };

  // --- Tip Submission Handler ---
  const handleSubmitTip = async (e: React.FormEvent) => {
    e.preventDefault();
    const numeric = Number(tipAmount.replace(',', '.'));
    if (!numeric || numeric <= 0) return;
    setIsSavingTip(true);
    try {
      const entry = await onRecordTipToSisFinz({
        job,
        amount: numeric,
        date: tipDate,
        accountId: tipAccountId || accounts[0]?.id,
        note: tipNote.trim() || undefined,
      });
      setTipAmount('');
      setTipNote('');
      setTipToast(
        entry.syncedToFinance
          ? `Propina de ${formatCurrency(numeric, entry.currency)} somada no seu saldo!`
          : 'Propina registrada na Jornada Laboral!'
      );
      window.setTimeout(() => setTipToast(null), 3500);
    } finally {
      setIsSavingTip(false);
    }
  };

  // --- Settings Save Handler ---
  const handleSaveJobSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCompany.trim() || !editRole.trim()) return;
    await onSaveJob({
      ...job,
      companyName: editCompany.trim(),
      role: editRole.trim(),
      currency: editCurrency,
      weeklyTargetHours: Math.max(1, Number(editWeeklyHours) || 48),
      tipFrequency: editTipFreq,
      tipWeekday: editTipWeekday,
      defaultAccountId: editDefaultAcc || undefined,
    });
    setOpenSection(null);
  };

  const formatMonthTitle = (yyyyMm: string) => {
    const [y, m] = yyyyMm.split('-').map(Number);
    const dt = new Date(y || 2026, (m || 1) - 1, 1);
    return dt.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  };

  const formatShortDate = (yyyyMmDd: string) => {
    const [, m, d] = yyyyMmDd.split('-');
    return `${d}/${m}`;
  };

  const renderShiftListItem = (s: LaborShiftEntry) => {
    const daySched = getScheduleForDate(job, s.date);
    const punctuality = evaluatePunchPunctuality(s.startTime, daySched, s.endTime);
    const hasIssue = punctuality.hasIssue;
    const isEntryBad = punctuality.status === 'late' || punctuality.status === 'out_of_hours';
    const isExitBad = punctuality.exitStatus === 'early_exit';

    return (
      <div
        key={s.id}
        className={`flex items-center justify-between gap-2 rounded-2xl border p-3 ${
          hasIssue ? 'border-rose-200 bg-rose-50/35' : 'border-slate-200/80 bg-white'
        }`}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-black text-slate-900">{formatShortDate(s.date)}</span>
            <span className="font-mono text-xs font-bold text-slate-600">
              {s.startTime} → {s.endTime}
            </span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-black text-emerald-700">
              {formatMinutesAsHours(s.durationMinutes)}
            </span>
            {punctuality.status !== 'extra_day' && punctuality.status !== 'no_schedule' && (
              <>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-black ${
                    isEntryBad ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {punctuality.status === 'late'
                    ? `Chegou atrasado (${formatDurationCompact(punctuality.diffMinutes)})`
                    : punctuality.status === 'out_of_hours'
                    ? 'Entrada fora do horário'
                    : 'Chegou no horário'}
                </span>
                {punctuality.exitStatus !== 'none' && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-black ${
                      isExitBad ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {isExitBad
                      ? `Saiu antes (${formatDurationCompact(punctuality.exitDiffMinutes)})`
                      : 'Saiu no horário'}
                  </span>
                )}
              </>
            )}
          </div>
          {(s.tags.length > 0 || s.note) && (
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {s.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-black text-slate-600"
                >
                  {SHIFT_TAGS.find((t) => t.id === tag)?.labelPt || tag}
                </span>
              ))}
              {s.note && (
                <span className="text-[10px] font-medium text-slate-500">• {s.note}</span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => openEditShiftModal(s)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer"
            aria-label="Alterar horário do turno"
            title="Alterar horário"
          >
            <Edit3 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleDeleteShift(s.id)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
            aria-label="Excluir turno"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  };

  const accordionItems: {
    id: Exclude<AccordionSection, null>;
    title: string;
    subtitle: string;
    badge?: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    {
      id: 'schedule',
      title: 'Escala Semanal & Importar IA',
      subtitle: selectedWeekHasSchedule
        ? `${formatShortDate(weeklyAudit.mondayDateStr)} a ${formatShortDate(weeklyAudit.sundayDateStr)} • Salva no histórico`
        : `${formatShortDate(weeklyAudit.mondayDateStr)} a ${formatShortDate(weeklyAudit.sundayDateStr)} • Zerada (sem cronograma)`,
      badge: selectedWeekHasSchedule ? formatMinutesAsHours(weeklyAudit.scheduledMinutes) : '0h',
      icon: Calendar,
    },
    {
      id: 'history',
      title: 'Pontos & Conferência RH',
      subtitle: 'Relatório Mensal e Semanal • Tolerância 5 min',
      badge: formatMinutesAsHours(currentMonthAudit.deltaMinutes, true),
      icon: Clock,
    },
    {
      id: 'salary',
      title: 'Salário, Benefícios & Projeção 12M',
      subtitle: 'Básico + benefícios e projeção mensal',
      badge: formatCurrency(currentMonthSalary.netTotal, job.currency),
      icon: DollarSign,
    },
    {
      id: 'tips',
      title: 'Propinas (Semanal / Diária)',
      subtitle:
        job.tipFrequency === 'weekly'
          ? `Semanal (${WEEKDAY_LABELS[job.tipWeekday || 'wed'].pt}) • Entra direto no saldo`
          : 'Diária por turno • Entra direto no saldo',
      badge: formatCurrency(currentMonthTipsTotal, job.currency),
      icon: Coins,
    },
    {
      id: 'settings',
      title: 'Ajustes do Trabalho',
      subtitle: `${job.companyName} • ${job.role}`,
      icon: Settings,
    },
  ];

  const draftBaseNum = Math.max(0, Number(draftBaseSalary.replace(',', '.')) || 0);

  return (
    <div className="space-y-4 pb-16">
      {/* Top Job Header Bar */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-black text-emerald-800 shadow-2xs hover:bg-emerald-50 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Meus Trabalhos
        </button>

        <div className="min-w-0 text-right">
          <h2 className="truncate text-sm font-black text-slate-900">{job.companyName}</h2>
          <p className="truncate text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
            {job.role}
          </p>
        </div>
      </div>

      {/* Interactive Click-to-Confirm Punch Hero */}
      <HoldToPunchButton
        activeShift={job.activeShift}
        todaySchedule={todaySchedule}
        language={language}
        onStartShift={handleStartShift}
        onEndShift={handleEndShift}
        onOpenManualEntry={openNewManualShiftModal}
      />

      {justFinishedShiftBanner && (
        <ShiftCompletedBanner
          durationMinutes={justFinishedShiftBanner.durationMinutes}
          scheduledMinutes={justFinishedShiftBanner.scheduledMinutes}
          language={language}
        />
      )}

      {/* Quarterly Late Arrival Suspension Risk Alert (1/3, 2/3, 3/3) */}
      <AnimatePresence>
        {quarterlyLateAudit.lateCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className={`rounded-2xl border p-3.5 shadow-xs ${
              quarterlyLateAudit.riskLevel === 'critical'
                ? 'border-rose-300 bg-rose-50 text-rose-950'
                : quarterlyLateAudit.riskLevel === 'high'
                ? 'border-orange-300 bg-orange-50 text-orange-950'
                : 'border-amber-300 bg-amber-50 text-amber-950'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <div
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white ${
                    quarterlyLateAudit.riskLevel === 'critical'
                      ? 'bg-rose-600'
                      : quarterlyLateAudit.riskLevel === 'high'
                      ? 'bg-orange-500'
                      : 'bg-amber-500'
                  }`}
                >
                  <ShieldAlert className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-black leading-tight">
                    {quarterlyLateAudit.riskLevel === 'critical'
                      ? `Risco de Suspensão! (${quarterlyLateAudit.lateCount} de ${quarterlyLateAudit.limit} atrasos)`
                      : quarterlyLateAudit.riskLevel === 'high'
                      ? `Alerta Crítico: ${quarterlyLateAudit.lateCount} de ${quarterlyLateAudit.limit} atrasos no trimestre`
                      : `Atenção: ${quarterlyLateAudit.lateCount} de ${quarterlyLateAudit.limit} atrasos no trimestre`}
                  </div>
                  <p className="mt-0.5 text-[10.5px] font-semibold opacity-85 leading-snug">
                    {quarterlyLateAudit.riskLevel === 'critical'
                      ? `${quarterlyLateAudit.labelPt}: você atingiu o limite de 3 atrasos acima de ${LATE_TOLERANCE_MINUTES} min.`
                      : quarterlyLateAudit.riskLevel === 'high'
                      ? `${quarterlyLateAudit.labelPt}: mais 1 atraso acima de ${LATE_TOLERANCE_MINUTES} min gera risco de suspensão.`
                      : `${quarterlyLateAudit.labelPt}: restam ${quarterlyLateAudit.remainingBeforeRisk} antes do risco de suspensão (tolerância: ${LATE_TOLERANCE_MINUTES} min).`}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1 shrink-0">
                <span
                  className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-black text-white ${
                    quarterlyLateAudit.riskLevel === 'critical'
                      ? 'bg-rose-600'
                      : quarterlyLateAudit.riskLevel === 'high'
                      ? 'bg-orange-500'
                      : 'bg-amber-500'
                  }`}
                >
                  {quarterlyLateAudit.lateCount}/{quarterlyLateAudit.limit}
                </span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3].map((step) => (
                    <span
                      key={step}
                      className={`h-1.5 w-3 rounded-full ${
                        step <= quarterlyLateAudit.lateCount
                          ? quarterlyLateAudit.riskLevel === 'critical'
                            ? 'bg-rose-600'
                            : quarterlyLateAudit.riskLevel === 'high'
                            ? 'bg-orange-500'
                            : 'bg-amber-500'
                          : 'bg-black/10'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick KPI Strip */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-emerald-100 bg-white p-3 shadow-2xs">
          <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">
            Mês (RH)
          </div>
          <div className="mt-1 font-mono text-sm font-black text-slate-900">
            {formatMinutesAsHours(currentMonthAudit.workedMinutes)}
          </div>
          <div className="text-[9.5px] font-bold text-emerald-700">
            Escala {formatMinutesAsHours(currentMonthAudit.scheduledMinutes)}
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-white p-3 shadow-2xs">
          <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">
            Mês Previsto
          </div>
          <div className="mt-1 truncate font-mono text-sm font-black text-emerald-700">
            {formatCurrency(currentMonthSalary.netTotal, job.currency)}
          </div>
          <div className="text-[9.5px] font-bold text-slate-500">
            ~{formatCurrency(Math.round(currentMonthSalary.hourlyRateRef), job.currency)}/h
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-white p-3 shadow-2xs">
          <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">
            Propinas Mês
          </div>
          <div className="mt-1 truncate font-mono text-sm font-black text-amber-600">
            {formatCurrency(currentMonthTipsTotal, job.currency)}
          </div>
          <div className="text-[9.5px] font-bold text-slate-500">
            {job.tipFrequency === 'weekly' ? 'Semanal' : 'Diária'}
          </div>
        </div>
      </div>

      {/* Expandable Settings-Style Accordion Modules */}
      <div className="space-y-2.5">
        {accordionItems.map((item) => {
          const isOpen = openSection === item.id;
          const Icon = item.icon;

          return (
            <div
              key={item.id}
              className={`overflow-hidden rounded-[1.5rem] border transition-colors ${
                isOpen
                  ? 'border-emerald-300 bg-white shadow-md shadow-emerald-900/5'
                  : 'border-slate-200/80 bg-white/95 hover:border-emerald-200'
              }`}
            >
              <button
                type="button"
                onClick={() => toggleSection(item.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left cursor-pointer"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                      isOpen
                        ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/25'
                        : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-slate-900">{item.title}</div>
                    <div className="truncate text-[10.5px] font-medium text-slate-500">
                      {item.subtitle}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {item.badge && (
                    <span className="hidden sm:inline-block rounded-full bg-emerald-50 px-2.5 py-0.5 font-mono text-[10px] font-black text-emerald-800 border border-emerald-200/70">
                      {item.badge}
                    </span>
                  )}
                  <motion.span
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.22 }}
                    className="text-slate-400"
                  >
                    <ChevronDown className="h-5 w-5" />
                  </motion.span>
                </div>
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    key={`panel-${item.id}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden border-t border-slate-100"
                  >
                    <div className="p-4 space-y-4">
                      {/* 1. ESCALA SEMANAL & IMPORTAR IA */}
                      {item.id === 'schedule' && (
                        <>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
                                <button
                                  type="button"
                                  onClick={() => setSelectedMonday(shiftDateByDays(selectedMonday, -7))}
                                  className="rounded-lg p-1.5 text-slate-600 hover:bg-white cursor-pointer"
                                >
                                  <ChevronLeft className="h-4 w-4" />
                                </button>
                                <span className="px-2 text-xs font-black text-slate-800">
                                  {formatShortDate(weeklyAudit.mondayDateStr)} – {formatShortDate(weeklyAudit.sundayDateStr)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setSelectedMonday(shiftDateByDays(selectedMonday, 7))}
                                  className="rounded-lg p-1.5 text-slate-600 hover:bg-white cursor-pointer"
                                >
                                  <ChevronRight className="h-4 w-4" />
                                </button>
                              </div>

                              <motion.button
                                type="button"
                                whileTap={{ scale: 0.94 }}
                                onClick={() => setSelectedMonday(currentWeekMonday)}
                                className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[10.5px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                  isViewingCurrentWeek
                                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                                    : 'bg-emerald-600 text-white shadow-xs hover:bg-emerald-700'
                                }`}
                                title={
                                  language === 'es'
                                    ? 'Volver a la semana actual'
                                    : 'Voltar para a semana atual'
                                }
                              >
                                {isViewingCurrentWeek ? (
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                                ) : (
                                  <RotateCcw className="h-3 w-3 stroke-[2.75]" />
                                )}
                                <span>{language === 'es' ? 'Semana actual' : 'Semana atual'}</span>
                              </motion.button>
                            </div>

                            <button
                              type="button"
                              onClick={() => setIsImportOpen(true)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-3 py-2 text-[11px] font-black text-white shadow-sm shadow-emerald-600/20 hover:opacity-95 cursor-pointer"
                            >
                              <Upload className="h-3.5 w-3.5" />
                              Importar Cronograma (IA)
                            </button>
                          </div>

                          {/* Empty / Unconfigured Week Notice */}
                          {!selectedWeekHasSchedule && (
                            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/90 p-3.5 space-y-2.5">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="text-xs font-black text-slate-800">
                                    Semana zerada (0h) — fora dos cálculos do mês
                                  </div>
                                  <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                                    Importe o cronograma desta semana ou marque manualmente qualquer dia abaixo para incluí-la no relatório mensal do RH.
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setIsImportOpen(true)}
                                  className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-[10.5px] font-black text-white hover:bg-emerald-700 cursor-pointer"
                                >
                                  <Upload className="h-3 w-3" />
                                  Importar com IA
                                </button>
                                <button
                                  type="button"
                                  onClick={handleApplyDefaultToCurrentWeek}
                                  className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-[10.5px] font-black text-emerald-800 hover:bg-emerald-50 cursor-pointer"
                                >
                                  <Sparkles className="h-3 w-3" />
                                  Aplicar escala padrão
                                </button>
                              </div>
                            </div>
                          )}

                          <div className="space-y-2">
                            {ORDERED_WEEKDAYS.map((dayKey, idx) => {
                              const dayDate = shiftDateByDays(selectedMonday, idx);
                              const sched = weekSchedule[dayKey];
                              const isUnset = Boolean(sched.isUnset);
                              const isToday = dayDate === todayStr;
                              const mins = calculateDayScheduleMinutes(sched);
                              const attendanceEntries = getDayAttendanceEntries(job, dayDate, sched);
                              const hasPunch = attendanceEntries.length > 0;
                              const hasIssueEntry = attendanceEntries.some((a) => a.hasIssue);
                              const isWorkdayPendingPunch = !isUnset && !sched.isOff && !hasPunch;
                              const dayLabelPt = WEEKDAY_LABELS[dayKey].pt;

                              return (
                                <div
                                  key={dayKey}
                                  className={`rounded-2xl border p-3 transition-colors ${
                                    hasIssueEntry
                                      ? 'border-rose-400 bg-rose-50/45 ring-1 ring-rose-200'
                                      : hasPunch
                                      ? isToday
                                        ? 'border-emerald-400 bg-emerald-50/45 ring-1 ring-emerald-200'
                                        : 'border-emerald-300 bg-emerald-50/30'
                                      : isWorkdayPendingPunch
                                      ? isToday
                                        ? 'border-orange-400 bg-orange-50/50 ring-1 ring-orange-200'
                                        : 'border-orange-300 bg-orange-50/30'
                                      : isUnset
                                      ? 'border-slate-200/70 bg-slate-50/50'
                                      : 'border-amber-200/80 bg-amber-50/35'
                                  }`}
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className="text-xs font-black text-slate-900">
                                        {dayLabelPt}
                                      </span>
                                      <span className="text-[10px] font-bold text-slate-400">
                                        {formatShortDate(dayDate)}
                                      </span>
                                      {isToday && (
                                        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[8.5px] font-black uppercase text-white">
                                          Hoje
                                        </span>
                                      )}
                                      {hasPunch ? (
                                        <span
                                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[8.5px] font-black uppercase tracking-wide ${
                                            hasIssueEntry
                                              ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                          }`}
                                        >
                                          {hasIssueEntry ? (
                                            <AlertTriangle className="h-2.5 w-2.5" />
                                          ) : (
                                            <CheckCircle2 className="h-2.5 w-2.5" />
                                          )}
                                          {language === 'es'
                                            ? 'Fichaje registrado'
                                            : 'Ponto registrado'}
                                        </span>
                                      ) : isWorkdayPendingPunch ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[8.5px] font-black uppercase tracking-wide text-orange-800 border border-orange-200">
                                          <Clock className="h-2.5 w-2.5" />
                                          {language === 'es'
                                            ? 'Pendiente de marcar'
                                            : 'Ponto pendente de marcar'}
                                        </span>
                                      ) : null}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openQuickPunchForDay(dayDate, dayLabelPt, sched)
                                        }
                                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2 py-1 text-[10px] font-black text-emerald-800 hover:bg-emerald-50 transition-colors cursor-pointer"
                                        title="Marcar ponto rápido (No horário ou Com atraso) sem lembrar o horário exato"
                                      >
                                        <Zap className="h-2.5 w-2.5 text-emerald-600" />
                                        {language === 'es' ? 'Punto rápido' : 'Ponto rápido'}
                                      </button>

                                      {isUnset ? (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              updateWeekDay(dayKey, {
                                                isOff: false,
                                                startTime: sched.startTime || '18:00',
                                                endTime: sched.endTime || '02:00',
                                              })
                                            }
                                            className="rounded-lg bg-orange-100 px-2.5 py-1 text-[10px] font-black uppercase text-orange-800 hover:bg-orange-200 cursor-pointer"
                                          >
                                            + Trabalho
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => updateWeekDay(dayKey, { isOff: true })}
                                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-black uppercase text-slate-500 hover:bg-amber-50 hover:text-amber-700 cursor-pointer"
                                          >
                                            Franco
                                          </button>
                                        </>
                                      ) : (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              updateWeekDay(dayKey, { isOff: !sched.isOff })
                                            }
                                            className={`rounded-lg px-2.5 py-1 text-[10px] font-black uppercase cursor-pointer ${
                                              sched.isOff
                                                ? 'bg-amber-500 text-white'
                                                : hasIssueEntry
                                                ? 'bg-rose-100 text-rose-800'
                                                : isWorkdayPendingPunch
                                                ? 'bg-orange-100 text-orange-800'
                                                : 'bg-emerald-100 text-emerald-800'
                                            }`}
                                          >
                                            {sched.isOff ? 'Franco' : 'Trabalho'}
                                          </button>
                                          {!sched.isOff && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                updateWeekDay(dayKey, {
                                                  isSplitShift: !sched.isSplitShift,
                                                  splitStartTime: sched.splitStartTime || '19:00',
                                                  splitEndTime: sched.splitEndTime || '23:30',
                                                })
                                              }
                                              className={`rounded-lg px-2 py-1 text-[10px] font-black cursor-pointer ${
                                                sched.isSplitShift
                                                  ? 'bg-indigo-600 text-white'
                                                  : 'bg-white border border-slate-200 text-slate-500'
                                              }`}
                                              title="Ativar turno cortado (2 períodos no dia)"
                                            >
                                              Cortado
                                            </button>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  {!isUnset && !sched.isOff && (
                                    <div className="mt-2.5 space-y-2">
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5">
                                          <input
                                            type="time"
                                            value={sched.startTime}
                                            onChange={(e) =>
                                              updateWeekDay(dayKey, { startTime: e.target.value })
                                            }
                                            className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-black text-slate-800"
                                          />
                                          <span className="text-xs font-black text-slate-400">→</span>
                                          <input
                                            type="time"
                                            value={sched.endTime}
                                            onChange={(e) =>
                                              updateWeekDay(dayKey, { endTime: e.target.value })
                                            }
                                            className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-black text-slate-800"
                                          />
                                        </div>
                                        <span
                                          className={`font-mono text-xs font-black ${
                                            hasIssueEntry
                                              ? 'text-rose-700'
                                              : isWorkdayPendingPunch
                                              ? 'text-orange-700'
                                              : 'text-emerald-700'
                                          }`}
                                        >
                                          {formatMinutesAsHours(mins)}
                                        </span>
                                      </div>

                                      {sched.isSplitShift && (
                                        <div className="flex items-center gap-1.5 pl-2 border-l-2 border-indigo-300">
                                          <span className="text-[10px] font-black text-indigo-700 mr-1">
                                            2º turno:
                                          </span>
                                          <input
                                            type="time"
                                            value={sched.splitStartTime || '19:00'}
                                            onChange={(e) =>
                                              updateWeekDay(dayKey, {
                                                splitStartTime: e.target.value,
                                              })
                                            }
                                            className="rounded-xl border border-indigo-200 bg-white px-2 py-1 text-xs font-black text-slate-800"
                                          />
                                          <span className="text-xs font-black text-indigo-400">→</span>
                                          <input
                                            type="time"
                                            value={sched.splitEndTime || '23:30'}
                                            onChange={(e) =>
                                              updateWeekDay(dayKey, { splitEndTime: e.target.value })
                                            }
                                            className="rounded-xl border border-indigo-200 bg-white px-2 py-1 text-xs font-black text-slate-800"
                                          />
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Entry + Exit Punctuality Strip with Alterar & Excluir buttons */}
                                  {attendanceEntries.length > 0 && (
                                    <div className="mt-2.5 space-y-1.5 border-t border-slate-200/70 pt-2">
                                      {attendanceEntries.map((att) => {
                                        const isEntryBad =
                                          att.status === 'late' || att.status === 'out_of_hours';
                                        const isExitBad = att.exitStatus === 'early_exit';
                                        const isIssue = att.hasIssue;
                                        const isExtra = att.status === 'extra_day';
                                        const isNoSched = att.status === 'no_schedule';
                                        const partLabel = att.shiftPart ? ` (${att.shiftPart}º turno)` : '';
                                        const timeRange = att.endTime
                                          ? `${att.startTime} → ${att.endTime}`
                                          : `Entrada ${att.startTime}`;

                                        const entryText =
                                          att.status === 'late'
                                            ? `Chegou atrasado (${formatDurationCompact(att.diffMinutes)})${partLabel}`
                                            : att.status === 'out_of_hours'
                                            ? `Entrada fora do horário${partLabel}`
                                            : isExtra
                                            ? language === 'es'
                                              ? 'Turno en día de franco'
                                              : 'Turno em dia de franco'
                                            : isNoSched
                                            ? 'Ponto registrado (sem cronograma)'
                                            : att.diffMinutes > 0
                                            ? `Chegou no horário (+${att.diffMinutes}m)${partLabel}`
                                            : `Chegou no horário${partLabel}`;

                                        const exitText =
                                          att.exitStatus === 'early_exit'
                                            ? att.exitDiffMinutes > 0
                                              ? `Saiu antes do horário (${formatDurationCompact(att.exitDiffMinutes)})`
                                              : 'Saiu antes do horário'
                                            : att.exitStatus === 'on_time'
                                            ? 'Saiu no horário'
                                            : null;

                                        return (
                                          <div
                                            key={att.id}
                                            className={`flex flex-wrap items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-[10.5px] font-black ${
                                              isIssue
                                                ? 'bg-rose-100/95 text-rose-900 border border-rose-200'
                                                : isExtra
                                                ? 'bg-indigo-100/80 text-indigo-800 border border-indigo-200'
                                                : isNoSched
                                                ? 'bg-slate-100 text-slate-700 border border-slate-200'
                                                : 'bg-emerald-100/90 text-emerald-950 border border-emerald-200'
                                            }`}
                                          >
                                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                                              <span
                                                className={`inline-flex items-center gap-1 ${
                                                  isEntryBad
                                                    ? 'text-rose-700'
                                                    : isExtra || isNoSched
                                                    ? ''
                                                    : 'text-emerald-800'
                                                }`}
                                              >
                                                {isEntryBad ? (
                                                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-600" />
                                                ) : isExtra || isNoSched ? (
                                                  <Clock className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
                                                ) : (
                                                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                                                )}
                                                <span>{entryText}</span>
                                              </span>

                                              {exitText && (
                                                <span
                                                  className={`inline-flex items-center gap-1 ${
                                                    isExitBad ? 'text-rose-700' : 'text-emerald-800'
                                                  }`}
                                                >
                                                  {isExitBad ? (
                                                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-600" />
                                                  ) : (
                                                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                                                  )}
                                                  <span>{exitText}</span>
                                                </span>
                                              )}
                                            </div>

                                            <div className="inline-flex items-center gap-1.5">
                                              <span className="font-mono text-[10px]">
                                                {timeRange}
                                              </span>
                                              {att.isActive && (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[8.5px] font-black uppercase text-white">
                                                  Saída pendente
                                                </span>
                                              )}
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  if (att.isActive) {
                                                    openEditActiveShiftModal();
                                                  } else {
                                                    const found = (job.shifts || []).find(
                                                      (s) => s.id === att.id
                                                    );
                                                    if (found) openEditShiftModal(found);
                                                  }
                                                }}
                                                className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wide transition-colors cursor-pointer ${
                                                  isIssue
                                                    ? 'bg-rose-200/90 text-rose-900 hover:bg-rose-300/90'
                                                    : isExtra
                                                    ? 'bg-indigo-200/90 text-indigo-900 hover:bg-indigo-300/90'
                                                    : isNoSched
                                                    ? 'bg-slate-200/90 text-slate-800 hover:bg-slate-300/90'
                                                    : 'bg-emerald-200/90 text-emerald-950 hover:bg-emerald-300/90'
                                                }`}
                                                title="Alterar horário deste ponto"
                                              >
                                                <Edit3 className="h-2.5 w-2.5" />
                                                Alterar
                                              </button>
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  if (att.isActive) {
                                                    handleCancelActiveShift();
                                                  } else {
                                                    handleDeleteShift(att.id);
                                                  }
                                                }}
                                                className={`inline-flex items-center justify-center rounded-lg p-1 transition-colors cursor-pointer ${
                                                  isIssue
                                                    ? 'bg-rose-200/90 text-rose-900 hover:bg-rose-300'
                                                    : 'bg-white/80 text-rose-600 hover:bg-rose-100 hover:text-rose-700'
                                                }`}
                                                aria-label="Excluir ponto deste dia"
                                                title="Excluir ponto deste dia"
                                              >
                                                <Trash2 className="h-3 w-3" />
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            <span className="text-xs font-black text-slate-600">
                              Total da semana: {formatMinutesAsHours(weeklyAudit.scheduledMinutes)}
                            </span>
                            {selectedWeekHasSchedule && (
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={handleClearCurrentWeekSchedule}
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-rose-600 cursor-pointer"
                                >
                                  <RotateCcw className="h-3 w-3" />
                                  Zerar semana
                                </button>
                                <button
                                  type="button"
                                  onClick={handleMakeCurrentWeekDefault}
                                  className="text-[11px] font-black text-emerald-700 hover:underline cursor-pointer"
                                >
                                  Salvar como padrão
                                </button>
                              </div>
                            )}
                          </div>
                        </>
                      )}

                      {/* 2. HISTÓRICO DE PONTOS & CONFERÊNCIA RH (MENSAL + SEMANAL) */}
                      {item.id === 'history' && (
                        <>
                          <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-slate-100 p-1">
                            <button
                              type="button"
                              onClick={() => setHistoryMode('monthly')}
                              className={`rounded-xl py-2 text-xs font-black transition-all cursor-pointer ${
                                historyMode === 'monthly'
                                  ? 'bg-white text-emerald-700 shadow-xs'
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              Conferência Mensal
                            </button>
                            <button
                              type="button"
                              onClick={() => setHistoryMode('weekly')}
                              className={`rounded-xl py-2 text-xs font-black transition-all cursor-pointer ${
                                historyMode === 'weekly'
                                  ? 'bg-white text-emerald-700 shadow-xs'
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              Conferência Semanal
                            </button>
                          </div>

                          {historyMode === 'monthly' ? (
                            <>
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSelectedAuditMonth(shiftMonthStr(selectedAuditMonth, -1))
                                    }
                                    className="rounded-lg p-1.5 text-slate-600 hover:bg-white cursor-pointer"
                                  >
                                    <ChevronLeft className="h-4 w-4" />
                                  </button>
                                  <span className="px-2 text-xs font-black capitalize text-slate-800">
                                    {formatMonthTitle(selectedAuditMonth)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSelectedAuditMonth(shiftMonthStr(selectedAuditMonth, 1))
                                    }
                                    className="rounded-lg p-1.5 text-slate-600 hover:bg-white cursor-pointer"
                                  >
                                    <ChevronRight className="h-4 w-4" />
                                  </button>
                                </div>

                                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-800 border border-emerald-200/70">
                                  {monthlyAudit.configuredWeeksCount}/{monthlyAudit.totalWeeksCount} sem. preenchidas
                                </span>
                              </div>

                              <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-3 border border-slate-200/70">
                                <div>
                                  <div className="text-[9px] font-black uppercase text-slate-400">
                                    Cronograma Mês
                                  </div>
                                  <div className="font-mono text-sm font-black text-slate-800">
                                    {formatMinutesAsHours(monthlyAudit.scheduledMinutes)}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-[9px] font-black uppercase text-slate-400">
                                    Ponto Real
                                  </div>
                                  <div className="font-mono text-sm font-black text-emerald-700">
                                    {formatMinutesAsHours(monthlyAudit.workedMinutes)}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-[9px] font-black uppercase text-slate-400">
                                    Saldo RH Mês
                                  </div>
                                  <div
                                    className={`font-mono text-sm font-black ${
                                      monthlyAudit.deltaMinutes >= 0
                                        ? 'text-emerald-600'
                                        : 'text-rose-600'
                                    }`}
                                  >
                                    {formatMinutesAsHours(monthlyAudit.deltaMinutes, true)}
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-white px-3 py-2.5 text-[11px]">
                                <div className="flex items-center gap-3">
                                  <span className="inline-flex items-center gap-1 font-black text-emerald-700">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    {monthlyAudit.onTimeCount} no horário
                                  </span>
                                  <span
                                    className={`inline-flex items-center gap-1 font-black ${
                                      monthlyAudit.lateCount > 0 ? 'text-rose-600' : 'text-slate-400'
                                    }`}
                                  >
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                    {monthlyAudit.lateCount} atraso{monthlyAudit.lateCount === 1 ? '' : 's'} (&gt;5m)
                                  </span>
                                </div>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                                    quarterlyLateAudit.lateCount >= 3
                                      ? 'bg-rose-600 text-white'
                                      : quarterlyLateAudit.lateCount > 0
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-slate-100 text-slate-500'
                                  }`}
                                >
                                  Trimestre: {quarterlyLateAudit.lateCount}/3
                                </span>
                              </div>

                              <div className="space-y-1.5">
                                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                  Semanas do mês (toque para editar na escala)
                                </div>
                                {monthlyAudit.weeksBreakdown.map((w) => (
                                  <button
                                    key={w.mondayDateStr}
                                    type="button"
                                    onClick={() => {
                                      setSelectedMonday(w.mondayDateStr);
                                      setOpenSection('schedule');
                                    }}
                                    className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-colors cursor-pointer ${
                                      w.hasSchedule
                                        ? 'border-emerald-200/80 bg-white hover:border-emerald-400'
                                        : 'border-dashed border-slate-200 bg-slate-50/70 hover:border-slate-300'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="text-xs font-black text-slate-800">
                                        {formatShortDate(w.firstDayInMonth)} – {formatShortDate(w.lastDayInMonth)}
                                      </span>
                                      {!w.hasSchedule && (
                                        <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[9px] font-black uppercase text-slate-500">
                                          Zerada (0h)
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 font-mono text-[11px] shrink-0">
                                      <span className="font-bold text-slate-500">
                                        {formatMinutesAsHours(w.workedMinutes)} / {formatMinutesAsHours(w.scheduledMinutes)}
                                      </span>
                                      {w.hasSchedule && (
                                        <span
                                          className={`font-black ${
                                            w.deltaMinutes >= 0 ? 'text-emerald-600' : 'text-rose-600'
                                          }`}
                                        >
                                          {formatMinutesAsHours(w.deltaMinutes, true)}
                                        </span>
                                      )}
                                    </div>
                                  </button>
                                ))}
                              </div>

                              {monthlyAudit.monthShifts.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-center text-xs font-bold text-slate-400">
                                  Nenhum ponto registrado neste mês ainda.
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                    Pontos registrados no mês ({monthlyAudit.monthShifts.length})
                                  </div>
                                  {monthlyAudit.monthShifts.map((s) => renderShiftListItem(s))}
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                  <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setSelectedMonday(shiftDateByDays(selectedMonday, -7))
                                      }
                                      className="rounded-lg p-1.5 text-slate-600 hover:bg-white cursor-pointer"
                                    >
                                      <ChevronLeft className="h-4 w-4" />
                                    </button>
                                    <span className="px-2 text-xs font-black text-slate-800">
                                      {formatShortDate(weeklyAudit.mondayDateStr)} – {formatShortDate(weeklyAudit.sundayDateStr)}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setSelectedMonday(shiftDateByDays(selectedMonday, 7))
                                      }
                                      className="rounded-lg p-1.5 text-slate-600 hover:bg-white cursor-pointer"
                                    >
                                      <ChevronRight className="h-4 w-4" />
                                    </button>
                                  </div>

                                  {!isViewingCurrentWeek && (
                                    <button
                                      type="button"
                                      onClick={() => setSelectedMonday(currentWeekMonday)}
                                      className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-2.5 py-2 text-[10px] font-black uppercase text-white hover:bg-emerald-700 cursor-pointer"
                                    >
                                      <RotateCcw className="h-3 w-3" />
                                      Atual
                                    </button>
                                  )}
                                </div>
                                {!weeklyAudit.hasSchedule && (
                                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500">
                                    Semana zerada (0h)
                                  </span>
                                )}
                              </div>

                              <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-3 border border-slate-200/70">
                                <div>
                                  <div className="text-[9px] font-black uppercase text-slate-400">
                                    Cronograma
                                  </div>
                                  <div className="font-mono text-sm font-black text-slate-800">
                                    {formatMinutesAsHours(weeklyAudit.scheduledMinutes)}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-[9px] font-black uppercase text-slate-400">
                                    Ponto Real
                                  </div>
                                  <div className="font-mono text-sm font-black text-emerald-700">
                                    {formatMinutesAsHours(weeklyAudit.workedMinutes)}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-[9px] font-black uppercase text-slate-400">
                                    Saldo RH
                                  </div>
                                  <div
                                    className={`font-mono text-sm font-black ${
                                      weeklyAudit.deltaMinutes >= 0
                                        ? 'text-emerald-600'
                                        : 'text-rose-600'
                                    }`}
                                  >
                                    {formatMinutesAsHours(weeklyAudit.deltaMinutes, true)}
                                  </div>
                                </div>
                              </div>

                              {weeklyAudit.weekShifts.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-center text-xs font-bold text-slate-400">
                                  Nenhum ponto registrado nesta semana ainda. Use o botão acima ou lance manualmente.
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {weeklyAudit.weekShifts.map((s) => renderShiftListItem(s))}
                                </div>
                              )}
                            </>
                          )}
                        </>
                      )}

                      {/* 3. SALÁRIO BÁSICO, BENEFÍCIOS & PROJEÇÃO 12 MESES */}
                      {item.id === 'salary' && (
                        <>
                          {salarySavedToast && (
                            <div className="flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white">
                              <Check className="h-4 w-4" />
                              {salarySavedToast}
                            </div>
                          )}

                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedSalaryMonth(shiftMonthStr(selectedSalaryMonth, -1))
                                }
                                className="rounded-lg p-1.5 text-slate-600 hover:bg-white cursor-pointer"
                              >
                                <ChevronLeft className="h-4 w-4" />
                              </button>
                              <span className="px-2 text-xs font-black capitalize text-slate-800">
                                {formatMonthTitle(selectedSalaryMonth)}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedSalaryMonth(shiftMonthStr(selectedSalaryMonth, 1))
                                }
                                className="rounded-lg p-1.5 text-slate-600 hover:bg-white cursor-pointer"
                              >
                                <ChevronRight className="h-4 w-4" />
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={openSalaryEditor}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-black text-white shadow-sm hover:bg-emerald-700 cursor-pointer"
                            >
                              <DollarSign className="h-3.5 w-3.5" />
                              Atualizar Salário / Benefícios
                            </button>
                          </div>

                          <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-3.5 space-y-2">
                            <div className="flex items-center justify-between text-xs font-black text-slate-800">
                              <span>Salário Básico</span>
                              <span className="font-mono">
                                {formatCurrency(currentMonthSalary.baseSalary, job.currency)}
                              </span>
                            </div>

                            {currentMonthSalary.benefits.map((b) => (
                              <div
                                key={b.id}
                                className={`flex items-center justify-between text-xs font-bold ${
                                  b.enabled ? 'text-slate-700' : 'text-slate-400 line-through'
                                }`}
                              >
                                <span>
                                  {b.name}{' '}
                                  {b.type === 'percent' && (
                                    <span className="text-[10px] text-emerald-700">
                                      ({b.rawValue}%)
                                    </span>
                                  )}
                                  {!b.enabled && (
                                    <span className="ml-1.5 rounded bg-slate-200/80 px-1.5 py-0.5 text-[9px] font-black uppercase text-slate-500 no-underline inline-block">
                                      Desmarcado
                                    </span>
                                  )}
                                </span>
                                <span className="font-mono">
                                  +{formatCurrency(b.calculatedAmount, job.currency)}
                                </span>
                              </div>
                            ))}

                            {currentMonthSalary.extraAmount > 0 && (
                              <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
                                <span>Extras / Bônus do mês</span>
                                <span className="font-mono">
                                  +{formatCurrency(currentMonthSalary.extraAmount, job.currency)}
                                </span>
                              </div>
                            )}

                            <div className="flex items-center justify-between border-t border-emerald-200 pt-2 text-sm font-black text-emerald-900">
                              <span>Total a Receber</span>
                              <span className="font-mono">
                                {formatCurrency(currentMonthSalary.netTotal, job.currency)}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                Previsão Salarial 12 Meses
                              </span>
                            </div>

                            <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                              {twelveMonthProjection.map((m) => {
                                const isSel = m.month === selectedSalaryMonth;
                                return (
                                  <button
                                    key={m.month}
                                    type="button"
                                    onClick={() => setSelectedSalaryMonth(m.month)}
                                    className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-colors cursor-pointer ${
                                      isSel
                                        ? 'border-emerald-400 bg-emerald-50/80'
                                        : 'border-slate-200/70 bg-white hover:border-emerald-200'
                                    }`}
                                  >
                                    <span className="text-xs font-black capitalize text-slate-800">
                                      {formatMonthTitle(m.month)}
                                    </span>
                                    <span className="font-mono text-xs font-black text-emerald-700 shrink-0">
                                      {formatCurrency(m.netTotal, job.currency)}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      )}

                      {/* 4. PROPINAS (INTEGRAÇÃO DIRETA NO SALDO DO SISFINZ) */}
                      {item.id === 'tips' && (
                        <>
                          {tipToast && (
                            <div className="flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white">
                              <Check className="h-4 w-4" />
                              {tipToast}
                            </div>
                          )}

                          <form
                            onSubmit={handleSubmitTip}
                            className="space-y-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-3.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-emerald-950">
                                Registrar Propina Recebida
                              </span>
                              <span className="rounded-full bg-white px-2 py-0.5 text-[9.5px] font-black text-emerald-700 border border-emerald-200">
                                Entra direto no saldo
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="mb-1 block text-[10px] font-black uppercase text-slate-500">
                                  Valor ({job.currency})
                                </label>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  step="any"
                                  required
                                  value={tipAmount}
                                  onChange={(e) => setTipAmount(e.target.value)}
                                  placeholder="Ex: 35000"
                                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-900 outline-none focus:border-emerald-500"
                                />
                              </div>

                              <div>
                                <label className="mb-1 block text-[10px] font-black uppercase text-slate-500">
                                  Data
                                </label>
                                <input
                                  type="date"
                                  value={tipDate}
                                  onChange={(e) => setTipDate(e.target.value)}
                                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="mb-1 block text-[10px] font-black uppercase text-slate-500">
                                Conta do SisFinz que recebe o dinheiro
                              </label>
                              <select
                                value={tipAccountId}
                                onChange={(e) => setTipAccountId(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500"
                              >
                                {accounts.length === 0 && (
                                  <option value="">Sem conta cadastrada (registrar só aqui)</option>
                                )}
                                {accounts.map((acc) => (
                                  <option key={acc.id} value={acc.id}>
                                    {acc.name} ({acc.currency} •{' '}
                                    {formatCurrency(
                                      Number(acc.currentBalance ?? acc.initialBalance ?? 0),
                                      acc.currency
                                    )}
                                    )
                                  </option>
                                ))}
                              </select>
                            </div>

                            <input
                              type="text"
                              value={tipNote}
                              onChange={(e) => setTipNote(e.target.value)}
                              placeholder="Observação opcional (ex: Quarta-feira, turno sexta)"
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500"
                            />

                            <button
                              type="submit"
                              disabled={isSavingTip}
                              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 disabled:opacity-60 cursor-pointer"
                            >
                              <Wallet className="h-4 w-4" />
                              {isSavingTip ? 'Registrando...' : 'Propina Recebida → Somar no Saldo'}
                            </button>
                          </form>

                          {(job.tips || []).length > 0 && (
                            <div className="space-y-1.5">
                              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                Últimas propinas
                              </div>
                              {(job.tips || []).slice(0, 8).map((t) => (
                                <div
                                  key={t.id}
                                  className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-white px-3 py-2"
                                >
                                  <div>
                                    <div className="text-xs font-black text-slate-800">
                                      {formatShortDate(t.date)}{' '}
                                      {t.accountName ? `• ${t.accountName}` : ''}
                                    </div>
                                    {t.note && (
                                      <div className="text-[10px] font-medium text-slate-500">
                                        {t.note}
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <div className="font-mono text-xs font-black text-emerald-700">
                                      +{formatCurrency(t.amount, t.currency)}
                                    </div>
                                    {t.syncedToFinance && (
                                      <div className="text-[9px] font-bold text-emerald-600">
                                        ✓ No saldo
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}

                      {/* 5. AJUSTES DO TRABALHO */}
                      {item.id === 'settings' && (
                        <form onSubmit={handleSaveJobSettings} className="space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="mb-1 block text-[10px] font-black uppercase text-slate-500">
                                Empresa
                              </label>
                              <input
                                type="text"
                                required
                                value={editCompany}
                                onChange={(e) => setEditCompany(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[10px] font-black uppercase text-slate-500">
                                Posto / Cargo
                              </label>
                              <input
                                type="text"
                                required
                                value={editRole}
                                onChange={(e) => setEditRole(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="mb-1 block text-[10px] font-black uppercase text-slate-500">
                                Moeda
                              </label>
                              <select
                                value={editCurrency}
                                onChange={(e) => setEditCurrency(e.target.value as CurrencyCode)}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900"
                              >
                                <option value="ARS">ARS (Pesos)</option>
                                <option value="BRL">BRL (Reais)</option>
                                <option value="USD">USD (Dólares)</option>
                                <option value="EUR">EUR (Euros)</option>
                              </select>
                            </div>
                            <div>
                              <label className="mb-1 block text-[10px] font-black uppercase text-slate-500">
                                Carga semanal (h)
                              </label>
                              <input
                                type="number"
                                value={editWeeklyHours}
                                onChange={(e) => setEditWeeklyHours(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="mb-1 block text-[10px] font-black uppercase text-slate-500">
                                Frequência da Propina
                              </label>
                              <select
                                value={editTipFreq}
                                onChange={(e) => setEditTipFreq(e.target.value as TipFrequency)}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900"
                              >
                                <option value="weekly">Semanal (1x por semana)</option>
                                <option value="daily">Diária (todo turno)</option>
                              </select>
                            </div>
                            {editTipFreq === 'weekly' && (
                              <div>
                                <label className="mb-1 block text-[10px] font-black uppercase text-slate-500">
                                  Dia da Propina
                                </label>
                                <select
                                  value={editTipWeekday}
                                  onChange={(e) =>
                                    setEditTipWeekday(e.target.value as DayOfWeekKey)
                                  }
                                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900"
                                >
                                  {ORDERED_WEEKDAYS.map((dk) => (
                                    <option key={dk} value={dk}>
                                      {WEEKDAY_LABELS[dk].pt}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>

                          {accounts.length > 0 && (
                            <div>
                              <label className="mb-1 block text-[10px] font-black uppercase text-slate-500">
                                Conta padrão (Salário & Propinas)
                              </label>
                              <select
                                value={editDefaultAcc}
                                onChange={(e) => setEditDefaultAcc(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900"
                              >
                                <option value="">Selecionar ao lançar</option>
                                {accounts.map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.name} ({a.currency})
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          <div className="flex items-center justify-between gap-2 pt-2">
                            {!confirmDelete ? (
                              <button
                                type="button"
                                onClick={() => setConfirmDelete(true)}
                                className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-black text-rose-700 hover:bg-rose-100 cursor-pointer"
                              >
                                Excluir trabalho
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onDeleteJob(job.id)}
                                className="rounded-xl bg-rose-600 px-3 py-2 text-[11px] font-black text-white cursor-pointer"
                              >
                                Confirmar exclusão
                              </button>
                            )}

                            <button
                              type="submit"
                              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-emerald-700 cursor-pointer"
                            >
                              Salvar ajustes
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Quick Punch ("Ponto rápido") Chooser Modal */}
      <AnimatePresence>
        {quickPunchDay && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setQuickPunchDay(null)}
              className="absolute inset-0 bg-slate-900/55 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ type: 'spring', stiffness: 420, damping: 28 }}
              className="relative z-10 w-full max-w-sm rounded-[2rem] border border-slate-200 bg-white p-5 shadow-2xl space-y-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                    <Zap className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">
                      Ponto rápido • {quickPunchDay.dayLabel} ({formatShortDate(quickPunchDay.date)})
                    </h3>
                    <p className="mt-0.5 text-[11px] font-medium text-slate-500 leading-snug">
                      {language === 'es'
                        ? 'Elige cómo se marcó el punto sin recordar la hora exacta:'
                        : 'Escolha como o ponto foi marcado sem precisar lembrar a hora exata:'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setQuickPunchDay(null)}
                  className="rounded-xl p-1 text-slate-400 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {quickPunchDay.existingShifts.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-[10.5px] font-bold text-amber-900">
                  {quickPunchDay.isSplitShiftDay
                    ? 'Dia com turno cortado: confirmar adiciona ou ajusta o turno sem duplicar.'
                    : 'Este dia já tem ponto — confirmar atualizará o registro existente.'}
                </div>
              )}

              <button
                type="button"
                onClick={() => applyQuickPunch('on_time')}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-emerald-300 bg-emerald-50/80 p-3.5 text-left hover:bg-emerald-100/80 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                  <div>
                    <div className="text-xs font-black text-emerald-950">
                      {language === 'es' ? 'Ponto marcado en horario' : 'Ponto marcado no horário'}
                    </div>
                    <div className="text-[10.5px] font-semibold text-emerald-700">
                      {language === 'es'
                        ? 'Registra entrada y salida según el cronograma'
                        : 'Registra entrada e saída conforme o cronograma'}
                    </div>
                  </div>
                </div>
              </button>

              <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                    <span className="text-xs font-black text-rose-950">
                      {language === 'es' ? 'Ponto marcado con retraso' : 'Ponto marcado com atraso'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={LATE_TOLERANCE_MINUTES + 1}
                      max={720}
                      inputMode="numeric"
                      value={quickLateMinutes}
                      onChange={(e) => setQuickLateMinutes(e.target.value)}
                      className="w-16 rounded-xl border border-rose-300 bg-white px-2 py-1 text-right font-mono text-xs font-black text-rose-800 outline-none focus:border-rose-500"
                    />
                    <span className="text-[10px] font-black text-rose-700">min</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => applyQuickPunch('late')}
                  className="w-full rounded-xl bg-rose-600 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-sm hover:bg-rose-700 transition-colors cursor-pointer"
                >
                  {language === 'es'
                    ? `Confirmar atraso (${Math.max(LATE_TOLERANCE_MINUTES + 1, Number(quickLateMinutes) || 15)} min)`
                    : `Confirmar atraso (${Math.max(LATE_TOLERANCE_MINUTES + 1, Number(quickLateMinutes) || 15)} min)`}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Schedule Import Modal (AI Image zero-storage + Text) */}
      <ScheduleImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        currentSchedule={weekSchedule}
        language={language}
        onApplySchedule={handleApplyImportedSchedule}
      />

      {/* Manual Shift / Edit Shift Modal */}
      <AnimatePresence>
        {shiftModalOpen && (
          <div className="fixed inset-0 z-[75] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeShiftModal}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, y: 36 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 36 }}
              className="relative z-10 w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] bg-white p-5 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    {editingActiveShift
                      ? 'Alterar Entrada (Turno em Andamento)'
                      : editingShiftId
                      ? 'Alterar Horário do Ponto'
                      : 'Lançar / Ajustar Turno'}
                  </h3>
                  {(editingShiftId || editingActiveShift) && (
                    <p className="text-[10.5px] font-medium text-emerald-700">
                      Atualiza o ponto existente sem duplicar o dia
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={closeShiftModal}
                  className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className={`grid gap-2 ${editingActiveShift ? 'grid-cols-2' : 'grid-cols-3'}`}>
                <div>
                  <label className="mb-1 block text-[10px] font-black uppercase text-slate-500">
                    Data
                  </label>
                  <input
                    type="date"
                    value={shiftFormDate}
                    onChange={(e) => setShiftFormDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-black uppercase text-slate-500">
                    Entrada
                  </label>
                  <input
                    type="time"
                    value={shiftFormStart}
                    onChange={(e) => setShiftFormStart(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-bold"
                  />
                </div>
                {!editingActiveShift && (
                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase text-slate-500">
                      Saída
                    </label>
                    <input
                      type="time"
                      value={shiftFormEnd}
                      onChange={(e) => setShiftFormEnd(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-bold"
                    />
                  </div>
                )}
              </div>

              {!editingActiveShift && (
                <>
                  <div className="text-center text-xs font-black text-emerald-700">
                    Duração calculada:{' '}
                    {formatMinutesAsHours(calculateShiftMinutes(shiftFormStart, shiftFormEnd))}
                  </div>

                  <div>
                    <div className="mb-1.5 text-[10px] font-black uppercase text-slate-500">
                      Tags rápidas do turno
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {SHIFT_TAGS.map((tag) => {
                        const active = shiftFormTags.includes(tag.id);
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() =>
                              setShiftFormTags((prev) =>
                                prev.includes(tag.id)
                                  ? prev.filter((t) => t !== tag.id)
                                  : [...prev, tag.id]
                              )
                            }
                            className={`rounded-full px-2.5 py-1 text-[10px] font-black transition-colors cursor-pointer ${
                              active
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {tag.labelPt}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {!editingShiftId && job.tipFrequency === 'daily' && (
                    <div>
                      <label className="mb-1 block text-[10px] font-black uppercase text-slate-500">
                        Propina de hoje (opcional — entra no saldo)
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={shiftFormQuickTip}
                        onChange={(e) => setShiftFormQuickTip(e.target.value)}
                        placeholder="0"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
                      />
                    </div>
                  )}

                  <input
                    type="text"
                    value={shiftFormNote}
                    onChange={(e) => setShiftFormNote(e.target.value)}
                    placeholder="Nota do turno (ex: Fechei sozinho, +1h extra)"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
                  />
                </>
              )}

              <button
                type="button"
                onClick={handleSaveManualShift}
                className="w-full rounded-2xl bg-emerald-600 py-3 text-xs font-black uppercase tracking-wider text-white shadow-md hover:bg-emerald-700 cursor-pointer"
              >
                {editingShiftId || editingActiveShift ? 'Salvar Alteração' : 'Salvar Turno'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Duplicate Punch Warning Popup */}
      <AnimatePresence>
        {duplicatePunchPrompt && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDuplicatePunchPrompt(null)}
              className="absolute inset-0 bg-slate-900/55 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ type: 'spring', stiffness: 420, damping: 28 }}
              className="relative z-10 w-full max-w-sm rounded-[2rem] border border-amber-200 bg-white p-5 shadow-2xl space-y-4"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-slate-900">
                    Ponto já batido em {formatShortDate(duplicatePunchPrompt.date)}
                  </h3>
                  <p className="mt-1 text-xs font-medium text-slate-600 leading-snug">
                    Este dia já possui ponto registrado. Para evitar duplicação, deseja alterar o horário do ponto existente?
                  </p>
                </div>
              </div>

              <div className="space-y-1.5 rounded-2xl border border-slate-200/80 bg-slate-50 p-3">
                {duplicatePunchPrompt.existingShifts.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between text-xs font-black text-slate-800"
                  >
                    <span className="font-mono">
                      {s.startTime} → {s.endTime}
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-mono text-[10px] text-emerald-800">
                      {formatMinutesAsHours(s.durationMinutes)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                {duplicatePunchPrompt.existingShifts.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setDuplicatePunchPrompt(null);
                      openEditShiftModal(s);
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 text-xs font-black uppercase tracking-wider text-white shadow-md hover:bg-emerald-700 cursor-pointer"
                  >
                    <Edit3 className="h-4 w-4" />
                    {duplicatePunchPrompt.existingShifts.length > 1
                      ? `Alterar ${idx + 1}º ponto (${s.startTime} → ${s.endTime})`
                      : 'Alterar ponto existente'}
                  </button>
                ))}

                {duplicatePunchPrompt.isSplitShiftDay &&
                  duplicatePunchPrompt.existingShifts.length < 2 && (
                    <button
                      type="button"
                      onClick={async () => {
                        const src = duplicatePunchPrompt.source;
                        setDuplicatePunchPrompt(null);
                        if (src === 'punch') {
                          await startNewActiveShiftNow();
                        } else {
                          await commitNewManualShift();
                        }
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 py-2.5 text-xs font-black uppercase tracking-wider text-indigo-800 hover:bg-indigo-100 cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                      {duplicatePunchPrompt.source === 'punch'
                        ? 'Iniciar 2º turno (Cortado)'
                        : 'Salvar como 2º turno (Cortado)'}
                    </button>
                  )}

                <button
                  type="button"
                  onClick={() => setDuplicatePunchPrompt(null)}
                  className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Salary & Benefits Editor Modal */}
      <AnimatePresence>
        {salaryEditorOpen && (
          <div className="fixed inset-0 z-[75] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setSalaryEditorOpen(false);
                setScopeConfirmOpen(false);
              }}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="relative z-10 flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[2rem] sm:rounded-[2rem] bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 bg-emerald-600 px-5 py-4 text-white">
                <div>
                  <h3 className="text-sm font-black">Salário Básico & Benefícios</h3>
                  <p className="text-[10px] font-semibold capitalize text-emerald-100">
                    {formatMonthTitle(selectedSalaryMonth)} • Valores líquidos que você recebe
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSalaryEditorOpen(false);
                    setScopeConfirmOpen(false);
                  }}
                  className="rounded-xl p-1.5 text-white/80 hover:bg-white/15 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {!scopeConfirmOpen ? (
                  <>
                    <div>
                      <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">
                        Salário Básico ({job.currency})
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={draftBaseSalary}
                        onChange={(e) => setDraftBaseSalary(e.target.value)}
                        className="w-full rounded-2xl border border-emerald-200 bg-emerald-50/40 px-4 py-3 font-mono text-lg font-black text-slate-900 outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                          Benefícios & Adicionais (% ou Valor Direto)
                        </span>
                        {!hasAntiguidadeInDraft && (
                          <button
                            type="button"
                            onClick={handleQuickAddAntiguidade}
                            className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black text-emerald-800 hover:bg-emerald-200 cursor-pointer"
                          >
                            <Plus className="h-3 w-3" />
                            Antiguidade
                          </button>
                        )}
                      </div>

                      {draftBenefits.map((b) => {
                        const isPercent = b.type === 'percent';
                        const previewAmt = !b.enabled
                          ? 0
                          : isPercent
                          ? Math.round((draftBaseNum * (Number(b.value) || 0)) / 100)
                          : Number(b.value) || 0;

                        return (
                          <div
                            key={b.id}
                            className="rounded-2xl border border-slate-200 bg-white p-2.5 space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={b.enabled}
                                  onChange={() =>
                                    setDraftBenefits((prev) =>
                                      prev.map((item) =>
                                        item.id === b.id
                                          ? { ...item, enabled: !item.enabled }
                                          : item
                                      )
                                    )
                                  }
                                  className="h-4 w-4 accent-emerald-600 cursor-pointer shrink-0"
                                />
                                <div className="min-w-0">
                                  <div className="truncate text-xs font-black text-slate-800">
                                    {b.name}
                                  </div>
                                  <div className="text-[9.5px] font-bold text-emerald-700">
                                    {isPercent
                                      ? `% sobre o básico → ${formatCurrency(previewAmt, job.currency)}`
                                      : `Valor direto (${job.currency})`}
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  setDraftBenefits((prev) =>
                                    prev.filter((item) => item.id !== b.id)
                                  )
                                }
                                className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer shrink-0"
                                aria-label={`Remover ${b.name}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            <div className="flex items-center justify-between gap-2 pl-6">
                              <div className="inline-flex rounded-xl bg-slate-100 p-0.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDraftBenefits((prev) =>
                                      prev.map((item) =>
                                        item.id === b.id ? { ...item, type: 'percent' } : item
                                      )
                                    )
                                  }
                                  className={`rounded-lg px-2.5 py-1 text-[10px] font-black transition-all cursor-pointer ${
                                    isPercent
                                      ? 'bg-emerald-600 text-white shadow-2xs'
                                      : 'text-slate-500 hover:text-slate-800'
                                  }`}
                                >
                                  % Básico
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDraftBenefits((prev) =>
                                      prev.map((item) =>
                                        item.id === b.id ? { ...item, type: 'fixed' } : item
                                      )
                                    )
                                  }
                                  className={`rounded-lg px-2.5 py-1 text-[10px] font-black transition-all cursor-pointer ${
                                    !isPercent
                                      ? 'bg-emerald-600 text-white shadow-2xs'
                                      : 'text-slate-500 hover:text-slate-800'
                                  }`}
                                >
                                  Valor ({job.currency})
                                </button>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  step="any"
                                  value={b.value}
                                  onChange={(e) => {
                                    const val = Math.max(0, Number(e.target.value) || 0);
                                    setDraftBenefits((prev) =>
                                      prev.map((item) =>
                                        item.id === b.id ? { ...item, value: val } : item
                                      )
                                    );
                                  }}
                                  className="w-28 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-right font-mono text-xs font-black text-slate-900 outline-none focus:border-emerald-500 focus:bg-white"
                                />
                                <span className="w-7 text-[10px] font-black text-slate-400">
                                  {isPercent ? '%' : job.currency}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      <div className="rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/40 p-3 space-y-2">
                        <div className="text-[10px] font-black uppercase text-emerald-800">
                          + Adicionar Benefício / Adicional
                        </div>
                        <div className="grid grid-cols-12 gap-1.5">
                          <input
                            type="text"
                            value={newBenefitName}
                            onChange={(e) => setNewBenefitName(e.target.value)}
                            placeholder="Ex: Aguinaldo / Antiguidade"
                            className="col-span-5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold"
                          />
                          <select
                            value={newBenefitType}
                            onChange={(e) => setNewBenefitType(e.target.value as BenefitCalcType)}
                            className="col-span-4 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold"
                          >
                            <option value="percent">% Básico</option>
                            <option value="fixed">Valor Fixo</option>
                            <option value="variable">Variável</option>
                          </select>
                          <input
                            type="number"
                            inputMode="decimal"
                            value={newBenefitValue}
                            onChange={(e) => setNewBenefitValue(e.target.value)}
                            placeholder="Valor"
                            className="col-span-3 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleAddBenefitToDraft}
                          className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-[10.5px] font-black text-white cursor-pointer"
                        >
                          <Plus className="h-3 w-3" /> Incluir benefício
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">
                        Bônus / Extra avulso só deste mês (opcional)
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={draftExtraAmount}
                        onChange={(e) => setDraftExtraAmount(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm font-black text-slate-900"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setScopeConfirmOpen(true)}
                      className="w-full rounded-2xl bg-emerald-600 py-3.5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 cursor-pointer"
                    >
                      Continuar para salvar
                    </button>
                  </>
                ) : (
                  <div className="space-y-4 py-2">
                    <div className="text-center">
                      <Sparkles className="mx-auto mb-2 h-8 w-8 text-emerald-600" />
                      <h4 className="text-base font-black text-slate-900">
                        Como aplicar este novo valor?
                      </h4>
                      <p className="mt-1 text-xs font-medium text-slate-500">
                        Escolha se o reajuste vale só para{' '}
                        <strong className="capitalize">{formatMonthTitle(selectedSalaryMonth)}</strong>{' '}
                        ou para todos os próximos meses.
                      </p>
                    </div>

                    <label className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs font-bold text-emerald-950 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={syncSalaryWithFinance}
                        onChange={(e) => setSyncSalaryWithFinance(e.target.checked)}
                        className="h-4 w-4 accent-emerald-600"
                      />
                      <span>Sincronizar automaticamente com minhas Receitas do SisFinz</span>
                    </label>

                    <div className="space-y-2.5">
                      <button
                        type="button"
                        onClick={() => applySalaryChanges('future')}
                        className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 p-4 text-left text-white shadow-md cursor-pointer"
                      >
                        <div className="text-xs font-black uppercase tracking-wider">
                          Atualizar deste mês em diante
                        </div>
                        <div className="mt-0.5 text-[11px] font-medium text-emerald-50">
                          Aplica o benefício e o reajuste neste mês e nos próximos 12 meses (meses passados ficam intactos).
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => applySalaryChanges('single')}
                        className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left text-slate-800 hover:border-emerald-300 cursor-pointer"
                      >
                        <div className="text-xs font-black uppercase tracking-wider">
                          Manter valor original nos próximos meses
                        </div>
                        <div className="mt-0.5 text-[11px] font-medium text-slate-500">
                          Aplica o benefício somente em{' '}
                          <span className="capitalize">{formatMonthTitle(selectedSalaryMonth)}</span> — nos próximos meses o benefício fica desmarcado e o valor original é mantido.
                        </div>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setScopeConfirmOpen(false)}
                      className="w-full py-2 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      Voltar e editar
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
