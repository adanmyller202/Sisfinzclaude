import React, { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  LogIn,
  LogOut,
  Edit3,
  CheckCircle2,
  Sparkles,
  Clock,
  Coffee,
  Plus,
  Calendar,
  MessageSquarePlus,
  FileText,
} from 'lucide-react';
import { LanguageCode } from '../../types';
import { ActiveShiftState, DaySchedule, ShiftPartKey } from '../../types/labor';
import {
  calculateShiftPartMinutes,
  formatLocalTimeHHMM,
  formatMinutesAsHours,
} from '../../utils/laborCalculations';
import {
  attachObservationToLatestPunch,
  peekPendingEntryNote,
} from '../../utils/punchNoteSync';

interface HoldToPunchButtonProps {
  activeShift: ActiveShiftState | null;
  todaySchedule: DaySchedule;
  todayShiftsCount?: number;
  hasPart1Shift?: boolean;
  hasPart2Shift?: boolean;
  nextShiftLabel?: string | null;
  language: LanguageCode;
  onStartShift: (part?: ShiftPartKey, note?: string) => Promise<void> | void;
  onEndShift: (note?: string) => Promise<void> | void;
  onOpenManualEntry: () => void;
}

function playPunchTone(type: 'start' | 'end' | 'franco') {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type === 'franco' ? 'sine' : 'triangle';
    if (type === 'start') {
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.14);
    } else if (type === 'franco') {
      osc.frequency.setValueAtTime(659.25, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.16);
    } else {
      osc.frequency.setValueAtTime(783.99, now);
      osc.frequency.exponentialRampToValueAtTime(523.25, now + 0.16);
    }
    gain.gain.setValueAtTime(type === 'franco' ? 0.05 : 0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.26);
  } catch {
    // ignore audio block
  }
}

export const HoldToPunchButton: React.FC<HoldToPunchButtonProps> = ({
  activeShift,
  todaySchedule,
  todayShiftsCount = 0,
  hasPart1Shift = false,
  hasPart2Shift = false,
  nextShiftLabel = null,
  language,
  onStartShift,
  onEndShift,
  onOpenManualEntry,
}) => {
  const reduceMotion = useReducedMotion();
  const [rippleKey, setRippleKey] = useState(0);
  const [francoBounceKey, setFrancoBounceKey] = useState(0);
  const [showFrancoExtraDrawer, setShowFrancoExtraDrawer] = useState(false);
  const [confirmPrompt, setConfirmPrompt] = useState<{
    action: 'start' | 'end';
    part?: ShiftPartKey;
    isFrancoExtra?: boolean;
    timeLabel: string;
    withNote: boolean;
  } | null>(null);
  const [observationText, setObservationText] = useState('');

  const isRunning = Boolean(activeShift);
  const isFrancoToday = Boolean(!todaySchedule.isUnset && todaySchedule.isOff);
  const isSplitToday = Boolean(
    !todaySchedule.isUnset &&
      !todaySchedule.isOff &&
      todaySchedule.isSplitShift &&
      todaySchedule.splitStartTime &&
      todaySchedule.splitEndTime
  );

  const activeEntryNote =
    ((activeShift as (ActiveShiftState & { note?: string }) | null)?.note || '').trim() ||
    (isRunning ? peekPendingEntryNote('default') : '');

  const openConfirmFor = (
    action: 'start' | 'end',
    part?: ShiftPartKey,
    isFrancoExtra = false,
    withNote = false
  ) => {
    const nowTime = formatLocalTimeHHMM(new Date());
    setObservationText('');
    setConfirmPrompt({
      action,
      part,
      isFrancoExtra,
      timeLabel: nowTime,
      withNote,
    });
  };

  const handleConfirmAction = async () => {
    if (!confirmPrompt) return;
    const { action, part } = confirmPrompt;
    const cleanNote = observationText.trim() || undefined;
    const prevEntryNote = activeEntryNote || undefined;

    setConfirmPrompt(null);
    setObservationText('');
    setShowFrancoExtraDrawer(false);
    setRippleKey((k) => k + 1);
    playPunchTone(action);

    if (action === 'start') {
      await onStartShift(part, cleanNote);
      if (cleanNote) {
        void attachObservationToLatestPunch({ action: 'start', note: cleanNote });
      }
    } else {
      await onEndShift(cleanNote);
      if (cleanNote || prevEntryNote) {
        void attachObservationToLatestPunch({
          action: 'end',
          note: cleanNote,
          previousEntryNote: prevEntryNote,
        });
      }
    }
  };

  const handleFrancoMedallionTap = () => {
    setFrancoBounceKey((k) => k + 1);
    playPunchTone('franco');
    setShowFrancoExtraDrawer((prev) => !prev);
  };

  const scheduleSummary = todaySchedule.isUnset
    ? language === 'es'
      ? 'Sin cronograma esta semana'
      : language === 'en'
      ? 'No schedule this week'
      : 'Sem cronograma esta semana'
    : todaySchedule.isOff
    ? language === 'es'
      ? 'Hoy es tu franco • Descanso'
      : language === 'en'
      ? 'Day off today • Rest'
      : 'Hoje é seu franco • Descanso'
    : isSplitToday
    ? `${todaySchedule.startTime}–${todaySchedule.endTime} • ${todaySchedule.splitStartTime}–${todaySchedule.splitEndTime}`
    : `${todaySchedule.startTime} → ${todaySchedule.endTime}`;

  const activePartLabel =
    activeShift?.shiftPart === 1
      ? ' (1º turno)'
      : activeShift?.shiftPart === 2
      ? ' (2º turno)'
      : isFrancoToday
      ? language === 'es'
        ? ' (Turno extra en franco)'
        : language === 'en'
        ? ' (Extra day-off shift)'
        : ' (Turno extra no franco)'
      : '';

  const part1Mins = calculateShiftPartMinutes(todaySchedule, 1);
  const part2Mins = calculateShiftPartMinutes(todaySchedule, 2);

  const defaultSplitPartForNote: ShiftPartKey = hasPart1Shift && !hasPart2Shift ? 2 : 1;

  const obsButtonLabel =
    language === 'es'
      ? 'Marcar con observación?'
      : language === 'en'
      ? 'Clock with note?'
      : 'Marcar com observação?';

  return (
    <div
      className={`relative flex flex-col items-center justify-center rounded-[2rem] border px-5 py-6 shadow-sm overflow-hidden select-none transition-colors duration-300 ${
        isFrancoToday && !isRunning
          ? 'border-purple-200/90 bg-gradient-to-b from-purple-50/75 via-white to-purple-50/35'
          : 'border-emerald-200/80 bg-gradient-to-b from-white via-emerald-50/40 to-white'
      }`}
      style={{ WebkitUserSelect: 'none', userSelect: 'none', WebkitTapHighlightColor: 'transparent' }}
    >
      {/* Top Status Pill */}
      <div
        className={`relative z-10 mb-3 flex items-center gap-2 rounded-full border px-3.5 py-1.5 shadow-2xs transition-colors ${
          isFrancoToday && !isRunning
            ? 'border-purple-200/90 bg-purple-50/90'
            : 'border-slate-200/80 bg-white/90'
        }`}
      >
        <span
          className={`h-2 w-2 rounded-full ${
            isRunning
              ? 'bg-rose-500 animate-ping'
              : todaySchedule.isUnset
              ? 'bg-slate-400'
              : todaySchedule.isOff
              ? 'bg-purple-500 animate-pulse'
              : 'bg-emerald-500'
          }`}
        />
        <span
          className={`text-[11px] font-black tracking-wide ${
            isFrancoToday && !isRunning ? 'text-purple-900' : 'text-slate-700'
          }`}
        >
          {isRunning
            ? `${language === 'es' ? 'Entrada marcada' : 'Entrada marcada'}${activePartLabel} às ${activeShift?.startTime}`
            : todaySchedule.isUnset || isFrancoToday
            ? scheduleSummary
            : `${language === 'es' ? 'Turno hoy' : 'Turno hoje'}: ${scheduleSummary}`}
        </span>
      </div>

      {/* Active Shift Entry Observation Preview Pill */}
      {isRunning && activeEntryNote && (
        <div className="relative z-10 mb-3 inline-flex max-w-full items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-1 text-[10.5px] font-bold text-amber-900">
          <FileText className="h-3 w-3 shrink-0 text-amber-600" />
          <span className="truncate">Obs. entrada: {activeEntryNote}</span>
        </div>
      )}

      {/* Circular Button(s) / Franco Interactive Medallion */}
      {isRunning ? (
        <div className="relative flex h-[164px] w-[164px] items-center justify-center">
          <AnimatePresence>
            {rippleKey > 0 && !reduceMotion && (
              <motion.span
                key={rippleKey}
                initial={{ scale: 0.78, opacity: 0.65 }}
                animate={{ scale: 1.45, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.65, ease: 'easeOut' }}
                className="pointer-events-none absolute inset-2 rounded-full border-4 border-rose-500"
              />
            )}
          </AnimatePresence>

          <motion.button
            type="button"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => openConfirmFor('end', activeShift?.shiftPart, isFrancoToday, false)}
            className="relative z-10 flex h-[136px] w-[136px] flex-col items-center justify-center rounded-full bg-gradient-to-br from-rose-500 via-rose-600 to-red-600 text-white shadow-xl shadow-rose-600/30 cursor-pointer outline-none focus-visible:ring-4 focus-visible:ring-rose-300 px-2 text-center"
          >
            <LogOut className="mb-1 h-6 w-6" />
            <span className="text-[11px] font-black uppercase tracking-wider leading-tight">
              {activeShift?.shiftPart === 1
                ? 'Marcar Saída 1º Turno'
                : activeShift?.shiftPart === 2
                ? 'Marcar Saída 2º Turno'
                : isFrancoToday
                ? language === 'es'
                  ? 'Salir Turno Extra'
                  : 'Encerrar Turno Extra'
                : language === 'es'
                ? 'Marcar Salida'
                : 'Marcar Saída'}
            </span>
            <span className="mt-0.5 text-[9.5px] font-bold opacity-85">
              {language === 'es' ? 'Toca para salir' : 'Toque para sair'}
            </span>
          </motion.button>
        </div>
      ) : isFrancoToday ? (
        /* Interactive Animated Franco (Day Off) Sanctuary */
        <div className="relative z-10 flex w-full flex-col items-center">
          <div className="relative flex h-[168px] w-[168px] items-center justify-center">
            <AnimatePresence>
              {francoBounceKey > 0 && !reduceMotion && (
                <motion.span
                  key={francoBounceKey}
                  initial={{ scale: 0.82, opacity: 0.75 }}
                  animate={{ scale: 1.48, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                  className="pointer-events-none absolute inset-2 rounded-full border-4 border-purple-400"
                />
              )}
            </AnimatePresence>

            {!reduceMotion && (
              <motion.span
                animate={{ scale: [1, 1.07, 1], opacity: [0.3, 0.55, 0.3] }}
                transition={{ repeat: Infinity, duration: 3.4, ease: 'easeInOut' }}
                className="pointer-events-none absolute inset-1 rounded-full bg-purple-500/15"
              />
            )}

            {!reduceMotion && (
              <>
                <motion.span
                  animate={{ y: [-3, 3, -3], opacity: [0.55, 1, 0.55], rotate: [0, 12, 0] }}
                  transition={{ repeat: Infinity, duration: 2.8, ease: 'easeInOut' }}
                  className="pointer-events-none absolute top-2 right-3 text-purple-500"
                >
                  <Sparkles className="h-4 w-4" />
                </motion.span>
                <motion.span
                  animate={{ y: [3, -3, 3], opacity: [0.45, 0.9, 0.45], rotate: [0, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 3.2, ease: 'easeInOut' }}
                  className="pointer-events-none absolute bottom-3 left-3 text-indigo-400"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                </motion.span>
              </>
            )}

            <motion.button
              key={`franco-medallion-${francoBounceKey}`}
              type="button"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.93 }}
              animate={
                francoBounceKey > 0 && !reduceMotion
                  ? { rotate: [0, -5, 5, -2, 0], scale: [0.95, 1.04, 1] }
                  : { rotate: 0, scale: 1 }
              }
              transition={{ duration: 0.45 }}
              onClick={handleFrancoMedallionTap}
              className="relative z-10 flex h-[140px] w-[140px] flex-col items-center justify-center rounded-full bg-gradient-to-br from-purple-600 via-violet-600 to-indigo-600 text-white shadow-xl shadow-purple-600/25 cursor-pointer outline-none focus-visible:ring-4 focus-visible:ring-purple-300 px-3 text-center"
            >
              <Coffee className="mb-1.5 h-7 w-7 text-purple-100" />
              <span className="text-xs font-black uppercase tracking-widest leading-tight">
                {language === 'es'
                  ? 'Día de Franco'
                  : language === 'en'
                  ? 'Day Off'
                  : 'Dia de Franco'}
              </span>
              <span className="mt-1 text-[10px] font-bold text-purple-100/95">
                {language === 'es'
                  ? '¡Buen descanso!'
                  : language === 'en'
                  ? 'Enjoy your rest!'
                  : 'Bom descanso!'}
              </span>
            </motion.button>
          </div>

          {nextShiftLabel && (
            <div className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-purple-200/80 bg-white/90 px-3 py-1 text-[10px] font-bold text-purple-900 shadow-2xs">
              <Calendar className="h-3 w-3 text-purple-600 shrink-0" />
              <span>{nextShiftLabel}</span>
            </div>
          )}

          {todayShiftsCount > 0 && (
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-purple-100 px-3 py-1 text-[10px] font-black text-purple-900 border border-purple-200">
              <CheckCircle2 className="h-3 w-3 text-purple-600" />
              {language === 'es'
                ? 'Turno extra registrado hoy'
                : language === 'en'
                ? 'Extra shift logged today'
                : 'Turno extra registrado hoje'}
            </span>
          )}

          <AnimatePresence initial={false}>
            {showFrancoExtraDrawer && (
              <motion.div
                initial={{ opacity: 0, height: 0, y: -6 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, y: -6 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="w-full overflow-hidden"
              >
                <div className="mt-3 rounded-2xl border border-purple-200 bg-white/95 p-3.5 text-center shadow-xs space-y-2.5">
                  <p className="text-[11px] font-bold text-slate-600 leading-snug">
                    {language === 'es'
                      ? 'Hoy es tu día libre. ¿Te llamaron para cubrir un turno extra?'
                      : language === 'en'
                      ? 'Today is your day off. Called in to cover an extra shift?'
                      : 'Hoje é sua folga. Foi chamado para cobrir um turno extra?'}
                  </p>
                  <button
                    type="button"
                    onClick={() => openConfirmFor('start', undefined, true, false)}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 py-2.5 px-3 text-[11px] font-black uppercase tracking-wider text-white shadow-sm hover:opacity-95 cursor-pointer"
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    {language === 'es'
                      ? 'Sí, iniciar turno extra ahora'
                      : language === 'en'
                      ? 'Yes, start extra shift now'
                      : 'Sim, iniciar turno extra agora'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : isSplitToday ? (
        <div className="relative z-10 flex flex-wrap items-center justify-center gap-4">
          {/* Button 1: Marcar Entrada 1º Turno */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => openConfirmFor('start', 1, false, false)}
            className={`relative flex h-[126px] w-[126px] flex-col items-center justify-center rounded-full text-white shadow-lg cursor-pointer outline-none px-2 text-center ${
              hasPart1Shift
                ? 'bg-gradient-to-br from-emerald-700 to-teal-700 opacity-85'
                : 'bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 shadow-emerald-600/30'
            }`}
          >
            {hasPart1Shift ? (
              <CheckCircle2 className="mb-1 h-5 w-5 text-emerald-200" />
            ) : (
              <LogIn className="mb-1 h-5 w-5" />
            )}
            <span className="text-[10.5px] font-black uppercase tracking-wider leading-tight">
              Marcar Entrada 1º Turno
            </span>
            <span className="mt-0.5 font-mono text-[9.5px] font-bold opacity-90">
              {todaySchedule.startTime} ({formatMinutesAsHours(part1Mins)})
            </span>
          </motion.button>

          {/* Button 2: Marcar Entrada 2º Turno */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => openConfirmFor('start', 2, false, false)}
            className={`relative flex h-[126px] w-[126px] flex-col items-center justify-center rounded-full text-white shadow-lg cursor-pointer outline-none px-2 text-center ${
              hasPart2Shift
                ? 'bg-gradient-to-br from-indigo-700 to-blue-800 opacity-85'
                : 'bg-gradient-to-br from-indigo-500 via-indigo-600 to-blue-600 shadow-indigo-600/30'
            }`}
          >
            {hasPart2Shift ? (
              <CheckCircle2 className="mb-1 h-5 w-5 text-indigo-200" />
            ) : (
              <LogIn className="mb-1 h-5 w-5" />
            )}
            <span className="text-[10.5px] font-black uppercase tracking-wider leading-tight">
              Marcar Entrada 2º Turno
            </span>
            <span className="mt-0.5 font-mono text-[9.5px] font-bold opacity-90">
              {todaySchedule.splitStartTime} ({formatMinutesAsHours(part2Mins)})
            </span>
          </motion.button>
        </div>
      ) : (
        <div className="relative flex h-[164px] w-[164px] items-center justify-center">
          <AnimatePresence>
            {rippleKey > 0 && !reduceMotion && (
              <motion.span
                key={rippleKey}
                initial={{ scale: 0.78, opacity: 0.65 }}
                animate={{ scale: 1.45, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.65, ease: 'easeOut' }}
                className="pointer-events-none absolute inset-2 rounded-full border-4 border-emerald-500"
              />
            )}
          </AnimatePresence>

          <motion.button
            type="button"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => openConfirmFor('start', undefined, false, false)}
            className="relative z-10 flex h-[136px] w-[136px] flex-col items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 text-white shadow-xl shadow-emerald-600/30 cursor-pointer outline-none focus-visible:ring-4 focus-visible:ring-emerald-300"
          >
            <LogIn className="mb-1 h-6 w-6" />
            <span className="text-xs font-black uppercase tracking-wider">
              {language === 'es' ? 'Marcar Entrada' : 'Marcar Entrada'}
            </span>
            <span className="mt-0.5 text-[10px] font-bold opacity-85">
              {language === 'es' ? 'Toca para ingresar' : 'Toque para ingressar'}
            </span>
          </motion.button>
        </div>
      )}

      {/* "Marcar com observação?" Action Pill below Entrada & Saída */}
      {(isRunning || !isFrancoToday) && (
        <div className="relative z-10 mt-3 flex justify-center">
          <button
            type="button"
            onClick={() =>
              isRunning
                ? openConfirmFor('end', activeShift?.shiftPart, isFrancoToday, true)
                : isSplitToday
                ? openConfirmFor('start', defaultSplitPartForNote, false, true)
                : openConfirmFor('start', undefined, false, true)
            }
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[11px] font-black shadow-2xs transition-colors cursor-pointer ${
              isRunning
                ? 'border-rose-200 bg-rose-50/85 text-rose-800 hover:bg-rose-100'
                : 'border-amber-200 bg-amber-50/90 text-amber-900 hover:bg-amber-100'
            }`}
          >
            <MessageSquarePlus
              className={`h-3.5 w-3.5 ${isRunning ? 'text-rose-600' : 'text-amber-600'}`}
            />
            <span>{obsButtonLabel}</span>
          </button>
        </div>
      )}

      {/* Bottom Helper Row */}
      <div className="relative z-10 mt-3 flex flex-wrap items-center justify-center gap-2">
        {isFrancoToday && !isRunning && (
          <button
            type="button"
            onClick={() => openConfirmFor('start', undefined, true, false)}
            className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-100/80 px-3.5 py-1.5 text-[11px] font-black text-purple-900 shadow-2xs hover:bg-purple-200/80 transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 text-purple-700" />
            {language === 'es'
              ? 'Trabajar en franco (Turno Extra)'
              : language === 'en'
              ? 'Work on day off (Extra Shift)'
              : 'Trabalhar no franco (Turno Extra)'}
          </button>
        )}

        <button
          type="button"
          onClick={onOpenManualEntry}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-[11px] font-black text-slate-700 shadow-2xs hover:border-emerald-300 hover:text-emerald-700 transition-colors cursor-pointer"
        >
          <Edit3 className="h-3.5 w-3.5 text-emerald-600" />
          {language === 'es' ? 'Cargar / ajustar turno manual' : 'Lançar / ajustar turno manual'}
        </button>
      </div>

      {/* Confirmation Modal (with optional or pre-opened Observation textarea) */}
      <AnimatePresence>
        {confirmPrompt && (
          <div className="fixed inset-0 z-[85] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmPrompt(null)}
              className="absolute inset-0 bg-slate-900/55 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 12 }}
              transition={{ type: 'spring', stiffness: 420, damping: 28 }}
              className="relative z-10 w-full max-w-sm rounded-[2rem] border border-slate-200 bg-white p-5 text-center shadow-2xl space-y-4"
            >
              <div
                className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-md ${
                  confirmPrompt.action === 'start'
                    ? confirmPrompt.isFrancoExtra
                      ? 'bg-gradient-to-br from-purple-600 to-indigo-600'
                      : 'bg-gradient-to-br from-emerald-500 to-teal-600'
                    : 'bg-gradient-to-br from-rose-500 to-red-600'
                }`}
              >
                {confirmPrompt.withNote ? (
                  <MessageSquarePlus className="h-6 w-6" />
                ) : (
                  <Clock className="h-6 w-6" />
                )}
              </div>

              <div>
                <h3 className="text-base font-black text-slate-900">
                  {confirmPrompt.action === 'start'
                    ? confirmPrompt.isFrancoExtra
                      ? language === 'es'
                        ? `¿Trabajar en tu franco hoy (${confirmPrompt.timeLabel})?`
                        : language === 'en'
                        ? `Work on your day off today (${confirmPrompt.timeLabel})?`
                        : `Trabalhar no seu franco hoje (${confirmPrompt.timeLabel})?`
                      : confirmPrompt.part === 1
                      ? `Marcar entrada do 1º turno agora (${confirmPrompt.timeLabel})?`
                      : confirmPrompt.part === 2
                      ? `Marcar entrada do 2º turno agora (${confirmPrompt.timeLabel})?`
                      : language === 'es'
                      ? `¿Seguro que quieres ingresar ahora (${confirmPrompt.timeLabel})?`
                      : `Certeza que quer ingressar agora (${confirmPrompt.timeLabel})?`
                    : language === 'es'
                    ? `¿Seguro que quieres salir ahora (${confirmPrompt.timeLabel})?`
                    : `Certeza que quer sair agora (${confirmPrompt.timeLabel})?`}
                </h3>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  {confirmPrompt.withNote
                    ? language === 'es'
                      ? 'Se registrará en este horario manteniendo tu observación guardada para RR. HH.'
                      : 'O ponto será marcado neste horário com sua observação salva para conferência de RH.'
                    : confirmPrompt.action === 'start'
                    ? confirmPrompt.isFrancoExtra
                      ? language === 'es'
                        ? 'Como hoy es tu franco, este turno se registrará como Turno Extra sin afectar tu puntualidad.'
                        : language === 'en'
                        ? 'Since today is your day off, this shift will be logged as an Extra Shift.'
                        : 'Como hoje é seu franco, este turno será registrado automaticamente como Turno Extra.'
                      : confirmPrompt.part === 1
                      ? 'Registra somente a entrada do 1º turno.'
                      : confirmPrompt.part === 2
                      ? 'Registra somente a entrada do 2º turno.'
                      : language === 'es'
                      ? 'Se registrará tu hora de entrada al trabajo.'
                      : 'Será registrado o horário de entrada no trabalho.'
                    : language === 'es'
                    ? 'Se cerrará el turno activo y se guardará en tu historial.'
                    : 'O turno ativo será encerrado e salvo no histórico.'}
                </p>
              </div>

              {/* Split shift selector when opening via "Marcar com observação?" */}
              {confirmPrompt.action === 'start' && isSplitToday && confirmPrompt.withNote && (
                <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setConfirmPrompt((p) => (p ? { ...p, part: 1 } : p))}
                    className={`rounded-lg py-1.5 text-[11px] font-black transition-all cursor-pointer ${
                      confirmPrompt.part === 1
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    1º Turno ({todaySchedule.startTime})
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmPrompt((p) => (p ? { ...p, part: 2 } : p))}
                    className={`rounded-lg py-1.5 text-[11px] font-black transition-all cursor-pointer ${
                      confirmPrompt.part === 2
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    2º Turno ({todaySchedule.splitStartTime})
                  </button>
                </div>
              )}

              {/* Observation Input Box */}
              {confirmPrompt.withNote ? (
                <div className="text-left space-y-1.5">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-amber-800">
                    {language === 'es'
                      ? 'Observación del fichaje'
                      : 'Observação do ponto'}
                  </label>
                  <textarea
                    rows={3}
                    autoFocus
                    value={observationText}
                    onChange={(e) => setObservationText(e.target.value)}
                    placeholder={
                      confirmPrompt.action === 'start'
                        ? language === 'es'
                          ? 'Ej: El jefe de cocina llegó 11:35 para abrir el restaurante...'
                          : 'Ex: Chefe de cozinha chegou 11h35 para abrir o restaurante...'
                        : language === 'es'
                        ? 'Ej: Salí más tarde ayudando a cerrar la cocina...'
                        : 'Ex: Saí mais tarde ajudando a fechar a cozinha...'
                    }
                    className="w-full rounded-2xl border border-amber-300 bg-amber-50/40 px-3.5 py-2.5 text-base sm:text-xs font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white resize-none"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    setConfirmPrompt((prev) => (prev ? { ...prev, withNote: true } : prev))
                  }
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50/70 px-3 py-1 text-[10.5px] font-black text-amber-900 hover:bg-amber-100 transition-colors cursor-pointer"
                >
                  <MessageSquarePlus className="h-3.5 w-3.5 text-amber-600" />
                  {language === 'es'
                    ? '+ Agregar observación'
                    : '+ Adicionar observação'}
                </button>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmPrompt(null)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 py-3 text-xs font-black text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  {language === 'es' ? 'Cancelar' : 'Cancelar'}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAction}
                  className={`rounded-2xl py-3 text-xs font-black uppercase tracking-wider text-white shadow-md cursor-pointer ${
                    confirmPrompt.action === 'start'
                      ? confirmPrompt.isFrancoExtra
                        ? 'bg-purple-600 hover:bg-purple-700'
                        : 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {confirmPrompt.action === 'start'
                    ? confirmPrompt.isFrancoExtra
                      ? language === 'es'
                        ? 'Sí, turno extra'
                        : 'Sim, turno extra'
                      : language === 'es'
                      ? 'Sí, ingresar'
                      : 'Sim, ingressar'
                    : language === 'es'
                    ? 'Sí, salir'
                    : 'Sim, sair'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const ShiftCompletedBanner: React.FC<{
  durationMinutes: number;
  scheduledMinutes: number;
  language: LanguageCode;
}> = ({ durationMinutes, scheduledMinutes, language }) => {
  const delta = durationMinutes - scheduledMinutes;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between gap-2 rounded-2xl border border-emerald-200 bg-white px-4 py-3 shadow-2xs"
    >
      <div className="flex items-center gap-2 text-xs font-black text-slate-800">
        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
        <span>
          {language === 'es' ? 'Turno registrado:' : 'Turno registrado:'}{' '}
          <strong className="font-mono">{formatMinutesAsHours(durationMinutes)}</strong>
        </span>
      </div>

      {scheduledMinutes > 0 ? (
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-[10.5px] font-black text-white ${
            delta >= 0 ? 'bg-emerald-600' : 'bg-amber-500'
          }`}
        >
          <Sparkles className="h-3 w-3" />
          {formatMinutesAsHours(delta, true)}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-full bg-purple-600 px-2.5 py-0.5 text-[10px] font-black text-white">
          <Sparkles className="h-3 w-3" />
          {language === 'es' ? 'Turno Extra' : 'Turno Extra'}
        </span>
      )}
    </motion.div>
  );
};
