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
  Briefcase,
  Upload,
  Award,
  Wallet,
  X,
} from 'lucide-react';
import { AccountItem, CurrencyCode, LanguageCode } from '../../types';
import {
  BenefitCalcType,
  DayOfWeekKey,
  LaborBenefit,
  LaborJob,
  LaborShiftEntry,
  ShiftTag,
  TipFrequency,
  WeeklySchedule,
} from '../../types/labor';
import {
  ORDERED_WEEKDAYS,
  WEEKDAY_LABELS,
  buildTwelveMonthSalaryProjection,
  calculateDayScheduleMinutes,
  calculateMonthSalary,
  calculateShiftMinutes,
  calculateWeeklyAudit,
  formatLocalDateYYYYMMDD,
  formatLocalTimeHHMM,
  formatMinutesAsHours,
  getEffectiveSalarySnapshot,
  getScheduleForDate,
  getScheduleForWeek,
  getWeekStartMonday,
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

  const [openSection, setOpenSection] = useState<AccordionSection>('schedule');
  const [selectedMonday, setSelectedMonday] = useState<string>(() => getWeekStartMonday(todayStr));
  const [selectedSalaryMonth, setSelectedSalaryMonth] = useState<string>(currentMonth);
  const [isImportOpen, setIsImportOpen] = useState(false);

  // Manual shift entry / post-shift summary modal state
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
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

  const todaySchedule = useMemo(() => getScheduleForDate(job, todayStr), [job, todayStr]);
  const weekSchedule = useMemo(
    () => getScheduleForWeek(job, selectedMonday),
    [job, selectedMonday]
  );
  const weeklyAudit = useMemo(
    () => calculateWeeklyAudit(job, selectedMonday),
    [job, selectedMonday]
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

  // --- Punch Clock Handlers ---
  const handleStartShift = async () => {
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

    // Pre-fill post-shift modal so user can add tags, notes, or daily tip
    setShiftFormDate(job.activeShift.startDate);
    setShiftFormStart(job.activeShift.startTime);
    setShiftFormEnd(endTime);
    setShiftFormTags(
      durationMinutes - job.activeShift.scheduledMinutes >= 20 ? ['overtime'] : []
    );
    setShiftFormNote('');
    setShiftFormQuickTip('');

    const newShift: LaborShiftEntry = {
      id: `shift_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      date: job.activeShift.startDate,
      startTime: job.activeShift.startTime,
      endTime,
      durationMinutes,
      scheduledMinutes: job.activeShift.scheduledMinutes,
      tags: durationMinutes - job.activeShift.scheduledMinutes >= 20 ? ['overtime'] : [],
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

  const handleSaveManualShift = async () => {
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

    let updatedJob: LaborJob = {
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

    setShiftModalOpen(false);
    setShiftFormNote('');
    setShiftFormQuickTip('');
    setShiftFormTags([]);
  };

  const handleDeleteShift = async (shiftId: string) => {
    await onSaveJob({
      ...job,
      shifts: (job.shifts || []).filter((s) => s.id !== shiftId),
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
      [dayKey]: { ...currentWeek[dayKey], ...patch },
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
    await onSaveJob({
      ...job,
      defaultSchedule: saveAsDefault ? schedule : job.defaultSchedule,
      weekOverrides: {
        ...(job.weekOverrides || {}),
        [selectedMonday]: schedule,
      },
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
    setDraftBaseSalary(String(calc.baseSalary || 0));
    setDraftBenefits(
      (snap.benefits || []).map((b) => {
        const calcItem = calc.benefits.find((cb) => cb.id === b.id);
        return {
          ...b,
          value: calcItem ? calcItem.rawValue : b.value,
          enabled: calcItem ? calcItem.enabled : b.enabled,
        };
      })
    );
    setDraftExtraAmount(String(calc.extraAmount || 0));
    setSalaryEditorOpen(true);
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
      const disabledBenefitIds = draftBenefits.filter((b) => !b.enabled).map((b) => b.id);
      const benefitValueOverrides: Record<string, number> = {};
      draftBenefits.forEach((b) => {
        benefitValueOverrides[b.id] = b.value;
      });

      // Also ensure any brand-new benefits exist in the active snapshot (disabled by default if only for this month, or added cleanly)
      const activeSnap = getEffectiveSalarySnapshot(job, selectedSalaryMonth);
      const existingIds = new Set((activeSnap.benefits || []).map((b) => b.id));
      const newOnes = draftBenefits.filter((b) => !existingIds.has(b.id));
      const nextHistory = newOnes.length
        ? (job.salaryHistory || []).map((s) =>
            s.effectiveFromMonth === activeSnap.effectiveFromMonth
              ? { ...s, benefits: [...s.benefits, ...newOnes] }
              : s
          )
        : job.salaryHistory;

      updatedJob = {
        ...job,
        salaryHistory: nextHistory,
        monthOverrides: {
          ...(job.monthOverrides || {}),
          [selectedSalaryMonth]: {
            baseSalary: newBase,
            disabledBenefitIds,
            benefitValueOverrides,
            extraAmount: newExtra,
          },
        },
      };
    } else {
      // Update from selectedSalaryMonth forward (preserving past months < selectedSalaryMonth)
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
        ? 'Salário e projeção de 12 meses atualizados!'
        : 'Valor atualizado somente para este mês!'
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
      subtitle: `${formatShortDate(weeklyAudit.mondayDateStr)} a ${formatShortDate(weeklyAudit.sundayDateStr)} • Editável Seg a Seg`,
      badge: formatMinutesAsHours(weeklyAudit.scheduledMinutes),
      icon: Calendar,
    },
    {
      id: 'history',
      title: 'Pontos & Conferência RH',
      subtitle: 'Horas reais batidas × cronograma da semana',
      badge: formatMinutesAsHours(weeklyAudit.deltaMinutes, true),
      icon: Clock,
    },
    {
      id: 'salary',
      title: 'Salário, Benefícios & Projeção 12M',
      subtitle: 'Básico + adicionais + Aguinaldo automático',
      badge: formatCurrency(currentMonthSalary.totalWithAguinaldo, job.currency),
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

      {/* Interactive Hold-to-Punch Hero */}
      <HoldToPunchButton
        activeShift={job.activeShift}
        todaySchedule={todaySchedule}
        language={language}
        onStartShift={handleStartShift}
        onEndShift={handleEndShift}
        onOpenManualEntry={() => {
          setShiftFormDate(todayStr);
          setShiftFormStart(todaySchedule.startTime || '18:00');
          setShiftFormEnd(todaySchedule.endTime || '02:00');
          setShiftFormTags([]);
          setShiftFormNote('');
          setShiftFormQuickTip('');
          setShiftModalOpen(true);
        }}
      />

      {justFinishedShiftBanner && (
        <ShiftCompletedBanner
          durationMinutes={justFinishedShiftBanner.durationMinutes}
          scheduledMinutes={justFinishedShiftBanner.scheduledMinutes}
          language={language}
        />
      )}

      {/* Quick KPI Strip */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-emerald-100 bg-white p-3 shadow-2xs">
          <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">
            Semana (RH)
          </div>
          <div className="mt-1 font-mono text-sm font-black text-slate-900">
            {formatMinutesAsHours(weeklyAudit.workedMinutes)}
          </div>
          <div className="text-[9.5px] font-bold text-emerald-700">
            Meta {formatMinutesAsHours(weeklyAudit.scheduledMinutes)}
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-white p-3 shadow-2xs">
          <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">
            Mês Previsto
          </div>
          <div className="mt-1 truncate font-mono text-sm font-black text-emerald-700">
            {formatCurrency(currentMonthSalary.totalWithAguinaldo, job.currency)}
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

                            <button
                              type="button"
                              onClick={() => setIsImportOpen(true)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-3 py-2 text-[11px] font-black text-white shadow-sm shadow-emerald-600/20 hover:opacity-95 cursor-pointer"
                            >
                              <Upload className="h-3.5 w-3.5" />
                              Importar Cronograma (IA)
                            </button>
                          </div>

                          <div className="space-y-2">
                            {ORDERED_WEEKDAYS.map((dayKey, idx) => {
                              const dayDate = shiftDateByDays(selectedMonday, idx);
                              const sched = weekSchedule[dayKey];
                              const isToday = dayDate === todayStr;
                              const mins = calculateDayScheduleMinutes(sched);

                              return (
                                <div
                                  key={dayKey}
                                  className={`rounded-2xl border p-3 transition-colors ${
                                    isToday
                                      ? 'border-emerald-400 bg-emerald-50/40 ring-1 ring-emerald-200'
                                      : sched.isOff
                                      ? 'border-amber-200/80 bg-amber-50/35'
                                      : 'border-slate-200/80 bg-slate-50/40'
                                  }`}
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-black text-slate-900 w-16">
                                        {WEEKDAY_LABELS[dayKey].pt}
                                      </span>
                                      <span className="text-[10px] font-bold text-slate-400">
                                        {formatShortDate(dayDate)}
                                      </span>
                                      {isToday && (
                                        <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[8.5px] font-black uppercase text-white">
                                          Hoje
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          updateWeekDay(dayKey, { isOff: !sched.isOff })
                                        }
                                        className={`rounded-lg px-2.5 py-1 text-[10px] font-black uppercase cursor-pointer ${
                                          sched.isOff
                                            ? 'bg-amber-500 text-white'
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
                                    </div>
                                  </div>

                                  {!sched.isOff && (
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
                                        <span className="font-mono text-xs font-black text-emerald-700">
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
                                          <span className="text-xs font-black text-slate-400">→</span>
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
                                </div>
                              );
                            })}
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <span className="text-xs font-black text-slate-600">
                              Total da semana: {formatMinutesAsHours(weeklyAudit.scheduledMinutes)}
                            </span>
                            <button
                              type="button"
                              onClick={handleMakeCurrentWeekDefault}
                              className="text-[11px] font-black text-emerald-700 hover:underline cursor-pointer"
                            >
                              Salvar como escala padrão
                            </button>
                          </div>
                        </>
                      )}

                      {/* 2. HISTÓRICO DE PONTOS & CONFERÊNCIA RH */}
                      {item.id === 'history' && (
                        <>
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
                              {weeklyAudit.weekShifts.map((s) => (
                                <div
                                  key={s.id}
                                  className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-white p-3"
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-black text-slate-900">
                                        {formatShortDate(s.date)}
                                      </span>
                                      <span className="font-mono text-xs font-bold text-slate-600">
                                        {s.startTime} → {s.endTime}
                                      </span>
                                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-black text-emerald-700">
                                        {formatMinutesAsHours(s.durationMinutes)}
                                      </span>
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
                                          <span className="text-[10px] font-medium text-slate-500">
                                            • {s.note}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteShift(s.id)}
                                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                                    aria-label="Excluir turno"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}

                      {/* 3. SALÁRIO BÁSICO, BENEFÍCIOS & PROJEÇÃO 12 MESES + AGUINALDO */}
                      {item.id === 'salary' && (
                        <>
                          {salarySavedToast && (
                            <div className="flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white">
                              <Check className="h-4 w-4" />
                              {salarySavedToast}
                            </div>
                          )}

                          {/* Month Selector + Quick Update Button */}
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

                          {/* Breakdown Card for Selected Month */}
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

                            {currentMonthSalary.aguinaldoAmount > 0 && (
                              <div className="flex items-center justify-between rounded-xl bg-amber-100/80 px-2.5 py-1.5 text-xs font-black text-amber-900">
                                <span className="inline-flex items-center gap-1">
                                  <Award className="h-3.5 w-3.5 text-amber-600" />
                                  Aguinaldo (SAC 50%)
                                </span>
                                <span className="font-mono">
                                  +{formatCurrency(currentMonthSalary.aguinaldoAmount, job.currency)}
                                </span>
                              </div>
                            )}

                            <div className="flex items-center justify-between border-t border-emerald-200 pt-2 text-sm font-black text-emerald-900">
                              <span>Total a Receber</span>
                              <span className="font-mono">
                                {formatCurrency(currentMonthSalary.totalWithAguinaldo, job.currency)}
                              </span>
                            </div>
                          </div>

                          {/* 12-Month Salary & Aguinaldo Timeline */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                Previsão Salarial 12 Meses + Aguinaldo
                              </span>
                            </div>

                            <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                              {twelveMonthProjection.map((m) => {
                                const isSel = m.month === selectedSalaryMonth;
                                const hasAguinaldo = m.aguinaldoAmount > 0;
                                return (
                                  <button
                                    key={m.month}
                                    type="button"
                                    onClick={() => setSelectedSalaryMonth(m.month)}
                                    className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-colors cursor-pointer ${
                                      isSel
                                        ? 'border-emerald-400 bg-emerald-50/80'
                                        : hasAguinaldo
                                        ? 'border-amber-200 bg-amber-50/40 hover:border-amber-300'
                                        : 'border-slate-200/70 bg-white hover:border-emerald-200'
                                    }`}
                                  >
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-black capitalize text-slate-800">
                                          {formatMonthTitle(m.month)}
                                        </span>
                                        {hasAguinaldo && (
                                          <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[8.5px] font-black uppercase text-white">
                                            +Aguinaldo
                                          </span>
                                        )}
                                      </div>
                                      {hasAguinaldo && (
                                        <div className="text-[10px] font-bold text-amber-700">
                                          Salário {formatCurrency(m.netTotal, job.currency)} + SAC{' '}
                                          {formatCurrency(m.aguinaldoAmount, job.currency)}
                                        </div>
                                      )}
                                    </div>
                                    <span className="font-mono text-xs font-black text-emerald-700 shrink-0">
                                      {formatCurrency(m.totalWithAguinaldo, job.currency)}
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

                          {/* Tip History */}
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

      {/* Schedule Import Modal (AI Image zero-storage + Text) */}
      <ScheduleImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        currentSchedule={weekSchedule}
        language={language}
        onApplySchedule={handleApplyImportedSchedule}
      />

      {/* Manual Shift Modal */}
      <AnimatePresence>
        {shiftModalOpen && (
          <div className="fixed inset-0 z-[75] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShiftModalOpen(false)}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, y: 36 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 36 }}
              className="relative z-10 w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] bg-white p-5 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900">Lançar / Ajustar Turno</h3>
                <button
                  type="button"
                  onClick={() => setShiftModalOpen(false)}
                  className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
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
              </div>

              <div className="text-center text-xs font-black text-emerald-700">
                Duração calculada: {formatMinutesAsHours(calculateShiftMinutes(shiftFormStart, shiftFormEnd))}
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

              {job.tipFrequency === 'daily' && (
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

              <button
                type="button"
                onClick={handleSaveManualShift}
                className="w-full rounded-2xl bg-emerald-600 py-3 text-xs font-black uppercase tracking-wider text-white shadow-md hover:bg-emerald-700 cursor-pointer"
              >
                Salvar Turno
              </button>
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
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                        Benefícios & Adicionais Padrão
                      </div>
                      {draftBenefits.map((b) => (
                        <div
                          key={b.id}
                          className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-2.5"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={b.enabled}
                              onChange={() =>
                                setDraftBenefits((prev) =>
                                  prev.map((item) =>
                                    item.id === b.id ? { ...item, enabled: !item.enabled } : item
                                  )
                                )
                              }
                              className="h-4 w-4 accent-emerald-600 cursor-pointer"
                            />
                            <div className="min-w-0">
                              <div className="truncate text-xs font-black text-slate-800">
                                {b.name}
                              </div>
                              <div className="text-[9.5px] font-bold text-slate-400">
                                {b.type === 'percent'
                                  ? '% sobre o básico'
                                  : b.type === 'fixed'
                                  ? 'Valor fixo'
                                  : 'Variável'}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <input
                              type="number"
                              inputMode="decimal"
                              value={b.value}
                              onChange={(e) => {
                                const val = Math.max(0, Number(e.target.value) || 0);
                                setDraftBenefits((prev) =>
                                  prev.map((item) =>
                                    item.id === b.id ? { ...item, value: val } : item
                                  )
                                );
                              }}
                              className="w-24 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 text-right font-mono text-xs font-black text-slate-900"
                            />
                            <span className="w-5 text-[10px] font-black text-slate-400">
                              {b.type === 'percent' ? '%' : job.currency}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setDraftBenefits((prev) => prev.filter((item) => item.id !== b.id))
                              }
                              className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}

                      {/* Add New Benefit Inline */}
                      <div className="rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/40 p-3 space-y-2">
                        <div className="text-[10px] font-black uppercase text-emerald-800">
                          + Adicionar Benefício / Adicional
                        </div>
                        <div className="grid grid-cols-12 gap-1.5">
                          <input
                            type="text"
                            value={newBenefitName}
                            onChange={(e) => setNewBenefitName(e.target.value)}
                            placeholder="Ex: Presentismo"
                            className="col-span-5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold"
                          />
                          <select
                            value={newBenefitType}
                            onChange={(e) => setNewBenefitType(e.target.value as BenefitCalcType)}
                            className="col-span-4 rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-bold"
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
                            className="col-span-3 rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold"
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
                        ou para todos os próximos meses (incluindo o Aguinaldo).
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
                          Atualiza os próximos 12 meses e recalcula o Aguinaldo automaticamente (meses passados ficam intactos).
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
                          Aplica essa alteração somente em{' '}
                          <span className="capitalize">{formatMonthTitle(selectedSalaryMonth)}</span>.
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
