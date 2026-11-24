import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Briefcase,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Coffee,
} from 'lucide-react';
import { LanguageCode } from '../../types';
import { LaborShiftEntry, ShiftPartKey, ShiftTag } from '../../types/labor';
import { useLaborAgenda } from '../../hooks/useLaborAgenda';
import {
  WEEKDAY_LABELS,
  calculateDayScheduleMinutes,
  calculateShiftMinutes,
  calculateShiftPartMinutes,
  formatDurationCompact,
  formatLocalDateYYYYMMDD,
  formatLocalTimeHHMM,
  formatMinutesAsHours,
  getDayAttendanceEntries,
  getDayOfWeekKey,
  getScheduleForDate,
  shiftDateByDays,
} from '../../utils/laborCalculations';
import { HoldToPunchButton, ShiftCompletedBanner } from './HoldToPunchButton';

interface QuickPunchModalProps {
  isOpen: boolean;
  onClose: () => void;
  language?: LanguageCode;
}

export const QuickPunchModal: React.FC<QuickPunchModalProps> = ({
  isOpen,
  onClose,
  language = 'pt',
}) => {
  const { jobs, saveJob } = useLaborAgenda();
  const todayStr = formatLocalDateYYYYMMDD(new Date());

  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [justFinishedBanner, setJustFinishedBanner] = useState<{
    durationMinutes: number;
    scheduledMinutes: number;
  } | null>(null);
  const [noticeMsg, setNoticeMsg] = useState<string | null>(null);

  const [showManualForm, setShowManualForm] = useState(false);
  const [manualStart, setManualStart] = useState('18:00');
  const [manualEnd, setManualEnd] = useState('02:00');

  useEffect(() => {
    if (!isOpen || jobs.length === 0) return;
    setJustFinishedBanner(null);
    setNoticeMsg(null);
    setShowManualForm(false);

    if (selectedJobId && jobs.some((j) => j.id === selectedJobId)) return;
    const runningJob = jobs.find((j) => Boolean(j.activeShift));
    setSelectedJobId(runningJob ? runningJob.id : jobs[0].id);
  }, [isOpen, jobs, selectedJobId]);

  const selectedJob = useMemo(
    () => jobs.find((j) => j.id === selectedJobId) || jobs[0] || null,
    [jobs, selectedJobId]
  );

  const todaySchedule = useMemo(
    () => (selectedJob ? getScheduleForDate(selectedJob, todayStr) : null),
    [selectedJob, todayStr]
  );

  const isFrancoToday = Boolean(
    todaySchedule && !todaySchedule.isUnset && todaySchedule.isOff
  );

  const nextShiftLabel = useMemo(() => {
    if (!selectedJob) return null;
    for (let offset = 1; offset <= 7; offset++) {
      const futureDate = shiftDateByDays(todayStr, offset);
      const sched = getScheduleForDate(selectedJob, futureDate);
      if (!sched.isUnset && !sched.isOff) {
        const dayKey = getDayOfWeekKey(futureDate);
        const dayName =
          language === 'es'
            ? WEEKDAY_LABELS[dayKey].es
            : language === 'en'
            ? WEEKDAY_LABELS[dayKey].en
            : WEEKDAY_LABELS[dayKey].pt;
        const prefix =
          language === 'es'
            ? 'Próximo turno'
            : language === 'en'
            ? 'Next shift'
            : 'Próximo turno';
        return `${prefix}: ${dayName} • ${sched.startTime} → ${sched.endTime}`;
      }
    }
    return null;
  }, [selectedJob, todayStr, language]);

  const todayShifts = useMemo(
    () => (selectedJob ? (selectedJob.shifts || []).filter((s) => s.date === todayStr) : []),
    [selectedJob, todayStr]
  );

  const hasPart1Shift = useMemo(
    () =>
      Boolean(
        selectedJob &&
          todaySchedule &&
          (todayShifts.some(
            (s, idx) =>
              s.shiftPart === 1 || (!s.shiftPart && idx === 0 && todaySchedule.isSplitShift)
          ) ||
            selectedJob.activeShift?.shiftPart === 1)
      ),
    [selectedJob, todaySchedule, todayShifts]
  );

  const hasPart2Shift = useMemo(
    () =>
      Boolean(
        selectedJob &&
          (todayShifts.some((s) => s.shiftPart === 2) ||
            selectedJob.activeShift?.shiftPart === 2)
      ),
    [selectedJob, todayShifts]
  );

  const todayAttendanceEntries = useMemo(
    () =>
      selectedJob && todaySchedule
        ? getDayAttendanceEntries(selectedJob, todayStr, todaySchedule)
        : [],
    [selectedJob, todayStr, todaySchedule]
  );

  const handleStartShift = async (part?: ShiftPartKey) => {
    if (!selectedJob || !todaySchedule) return;
    setNoticeMsg(null);

    const now = new Date();
    const startDate = formatLocalDateYYYYMMDD(now);
    const startTime = formatLocalTimeHHMM(now);
    const isSplitDay = Boolean(
      todaySchedule.isSplitShift && !todaySchedule.isOff && !todaySchedule.isUnset
    );

    const hasConflict =
      todayShifts.length > 0 &&
      (!isSplitDay || !part || todayShifts.some((s) => s.shiftPart === part));

    if (hasConflict) {
      setNoticeMsg(
        part
          ? `O ${part}º turno de hoje já foi registrado. Para alterar, abra a Jornada Laboral.`
          : 'O ponto de hoje já foi registrado. Para alterar, abra a Jornada Laboral.'
      );
      return;
    }

    const scheduledMinutes = part
      ? calculateShiftPartMinutes(todaySchedule, part)
      : calculateDayScheduleMinutes(todaySchedule);

    await saveJob({
      ...selectedJob,
      activeShift: {
        startedAtIso: now.toISOString(),
        startDate,
        startTime,
        scheduledMinutes,
        shiftPart: part,
      },
    });
  };

  const handleEndShift = async () => {
    if (!selectedJob || !selectedJob.activeShift) return;
    setNoticeMsg(null);

    const now = new Date();
    const endTime = formatLocalTimeHHMM(now);
    const startedMs = new Date(selectedJob.activeShift.startedAtIso).getTime();
    const durationMinutes = Math.max(
      1,
      Number.isNaN(startedMs)
        ? calculateShiftMinutes(selectedJob.activeShift.startTime, endTime)
        : Math.round((now.getTime() - startedMs) / 60000)
    );

    const part = selectedJob.activeShift.shiftPart;
    const baseTags: ShiftTag[] = part === 2 ? ['split_shift'] : [];
    if (
      isFrancoToday ||
      (selectedJob.activeShift.scheduledMinutes > 0 &&
        durationMinutes - selectedJob.activeShift.scheduledMinutes >= 20)
    ) {
      baseTags.push('overtime');
    }

    const newShift: LaborShiftEntry = {
      id: `shift_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      date: selectedJob.activeShift.startDate,
      startTime: selectedJob.activeShift.startTime,
      endTime,
      durationMinutes,
      scheduledMinutes: selectedJob.activeShift.scheduledMinutes,
      shiftPart: part,
      tags: baseTags,
      note: part ? `${part}º turno` : isFrancoToday ? 'Turno extra (Franco)' : undefined,
      createdAt: now.toISOString(),
    };

    await saveJob({
      ...selectedJob,
      activeShift: null,
      shifts: [newShift, ...(selectedJob.shifts || [])],
    });

    setJustFinishedBanner({
      durationMinutes,
      scheduledMinutes: selectedJob.activeShift.scheduledMinutes,
    });
  };

  const handleSaveManualToday = async () => {
    if (!selectedJob || !todaySchedule) return;
    const durationMinutes = calculateShiftMinutes(manualStart, manualEnd);
    const scheduledMinutes = calculateDayScheduleMinutes(todaySchedule);
    const tags: ShiftTag[] = isFrancoToday ? ['overtime'] : [];

    const newShift: LaborShiftEntry = {
      id: `shift_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      date: todayStr,
      startTime: manualStart,
      endTime: manualEnd,
      durationMinutes,
      scheduledMinutes,
      tags,
      note: isFrancoToday ? 'Turno extra (Franco)' : undefined,
      createdAt: new Date().toISOString(),
    };

    const existingToday = (selectedJob.shifts || []).find((s) => s.date === todayStr);
    const nextShifts =
      existingToday && !todaySchedule.isSplitShift
        ? (selectedJob.shifts || []).map((s) =>
            s.id === existingToday.id ? { ...newShift, id: existingToday.id } : s
          )
        : [newShift, ...(selectedJob.shifts || [])];

    await saveJob({
      ...selectedJob,
      shifts: nextShifts.sort((a, b) => b.date.localeCompare(a.date)),
    });

    setShowManualForm(false);
    setJustFinishedBanner({ durationMinutes, scheduledMinutes });
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[72] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs"
          />

          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            className={`relative z-10 flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[2rem] sm:rounded-[2rem] bg-white shadow-2xl border ${
              isFrancoToday && !selectedJob?.activeShift
                ? 'border-purple-200'
                : 'border-emerald-100'
            }`}
          >
            {/* Header */}
            <div
              className={`flex items-center justify-between border-b border-slate-100 px-5 py-4 text-white transition-colors duration-300 ${
                isFrancoToday && !selectedJob?.activeShift
                  ? 'bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
                  {isFrancoToday && !selectedJob?.activeShift ? (
                    <Coffee className="h-5 w-5" />
                  ) : (
                    <Clock className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black tracking-tight">
                      {isFrancoToday && !selectedJob?.activeShift
                        ? language === 'es'
                          ? 'Día de Franco'
                          : language === 'en'
                          ? 'Day Off'
                          : 'Dia de Franco'
                        : language === 'es'
                        ? 'Marcar Punto'
                        : 'Marcar Ponto'}
                    </h3>
                    {isFrancoToday && (
                      <span className="rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">
                        Franco
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-medium text-white/85">
                    {language === 'es'
                      ? 'Acceso rápido • Jornada Laboral'
                      : 'Acesso rápido • Jornada Laboral'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-2 text-white/80 hover:bg-white/15 hover:text-white cursor-pointer"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {jobs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/40 p-6 text-center space-y-2">
                  <Briefcase className="mx-auto h-8 w-8 text-emerald-600" />
                  <div className="text-sm font-black text-slate-900">
                    Nenhum trabalho cadastrado
                  </div>
                  <p className="text-xs font-medium text-slate-500">
                    Cadastre seu trabalho primeiro no menu <strong>Jornada Laboral</strong> para usar o ponto rápido por aqui.
                  </p>
                </div>
              ) : (
                <>
                  {/* Job Selector */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
                      {jobs.length > 1
                        ? language === 'es'
                          ? 'Selecciona el trabajo'
                          : 'Selecione o trabalho'
                        : language === 'es'
                        ? 'Trabajo'
                        : 'Trabalho'}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {jobs.map((j) => {
                        const isSelected = selectedJob?.id === j.id;
                        return (
                          <button
                            key={j.id}
                            type="button"
                            onClick={() => {
                              setSelectedJobId(j.id);
                              setJustFinishedBanner(null);
                              setNoticeMsg(null);
                              setShowManualForm(false);
                            }}
                            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition-all cursor-pointer ${
                              isSelected
                                ? isFrancoToday && !selectedJob?.activeShift
                                  ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/25'
                                  : 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/25'
                                : 'border border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-300'
                            }`}
                          >
                            <Briefcase className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate max-w-[160px]">{j.companyName}</span>
                            {j.activeShift && (
                              <span className="h-2 w-2 rounded-full bg-rose-400 animate-pulse" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Interactive Punch / Franco Sanctuary */}
                  {selectedJob && todaySchedule && (
                    <>
                      {!showManualForm ? (
                        <HoldToPunchButton
                          activeShift={selectedJob.activeShift}
                          todaySchedule={todaySchedule}
                          todayShiftsCount={todayShifts.length}
                          hasPart1Shift={hasPart1Shift}
                          hasPart2Shift={hasPart2Shift}
                          nextShiftLabel={nextShiftLabel}
                          language={language}
                          onStartShift={handleStartShift}
                          onEndShift={handleEndShift}
                          onOpenManualEntry={() => {
                            setManualStart(todaySchedule.startTime || '18:00');
                            setManualEnd(todaySchedule.endTime || '02:00');
                            setShowManualForm(true);
                          }}
                        />
                      ) : (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-slate-900">
                              {isFrancoToday
                                ? language === 'es'
                                  ? 'Cargar turno extra en franco'
                                  : 'Lançar turno extra no franco'
                                : language === 'es'
                                ? 'Cargar turno de hoy manualmente'
                                : 'Lançar turno de hoje manualmente'}
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowManualForm(false)}
                              className="text-[11px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                            >
                              {language === 'es' ? 'Volver' : 'Voltar'}
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="mb-1 block text-[10px] font-black uppercase text-slate-500">
                                Entrada
                              </label>
                              <input
                                type="time"
                                value={manualStart}
                                onChange={(e) => setManualStart(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[10px] font-black uppercase text-slate-500">
                                {language === 'es' ? 'Salida' : 'Saída'}
                              </label>
                              <input
                                type="time"
                                value={manualEnd}
                                onChange={(e) => setManualEnd(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black"
                              />
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleSaveManualToday}
                            className="w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-emerald-700 cursor-pointer"
                          >
                            {language === 'es' ? 'Guardar' : 'Salvar'} (
                            {formatMinutesAsHours(calculateShiftMinutes(manualStart, manualEnd))})
                          </button>
                        </div>
                      )}

                      {noticeMsg && (
                        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-900">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                          <span>{noticeMsg}</span>
                        </div>
                      )}

                      {justFinishedBanner && (
                        <ShiftCompletedBanner
                          durationMinutes={justFinishedBanner.durationMinutes}
                          scheduledMinutes={justFinishedBanner.scheduledMinutes}
                          language={language}
                        />
                      )}

                      {/* Live Today Status Summary */}
                      {todayAttendanceEntries.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                            {language === 'es' ? 'Registros de hoy' : 'Registros de hoje'}
                          </div>
                          {todayAttendanceEntries.map((att) => {
                            const isIssue = att.hasIssue;
                            const isExtra = att.status === 'extra_day';
                            const partLabel = att.shiftPart ? ` (${att.shiftPart}º turno)` : '';
                            return (
                              <div
                                key={att.id}
                                className={`flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 text-[10.5px] font-black ${
                                  isIssue
                                    ? 'bg-rose-100/90 text-rose-900 border border-rose-200'
                                    : isExtra
                                    ? 'bg-purple-100/85 text-purple-900 border border-purple-200'
                                    : 'bg-emerald-100/85 text-emerald-950 border border-emerald-200'
                                }`}
                              >
                                <span className="inline-flex items-center gap-1.5">
                                  {isIssue ? (
                                    <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                                  ) : (
                                    <CheckCircle2
                                      className={`h-3.5 w-3.5 ${
                                        isExtra ? 'text-purple-600' : 'text-emerald-600'
                                      }`}
                                    />
                                  )}
                                  <span>
                                    {att.status === 'late'
                                      ? `Chegou atrasado (${formatDurationCompact(att.diffMinutes)})${partLabel}`
                                      : att.status === 'out_of_hours'
                                      ? `Entrada fora do horário${partLabel}`
                                      : isExtra
                                      ? language === 'es'
                                        ? 'Turno extra en día de franco'
                                        : 'Turno extra em dia de franco'
                                      : `Chegou no horário${partLabel}`}
                                    {att.exitStatus === 'on_time'
                                      ? ' • Saiu no horário'
                                      : att.exitStatus === 'early_exit'
                                      ? ' • Saiu antes'
                                      : ''}
                                  </span>
                                </span>
                                <span className="font-mono text-[10px]">
                                  {att.endTime
                                    ? `${att.startTime} → ${att.endTime}`
                                    : `Entrada ${att.startTime}`}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
