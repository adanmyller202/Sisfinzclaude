import React, { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { LogIn, LogOut, Edit3, CheckCircle2, Sparkles, Clock } from 'lucide-react';
import { LanguageCode } from '../../types';
import { ActiveShiftState, DaySchedule, ShiftPartKey } from '../../types/labor';
import {
  calculateShiftPartMinutes,
  formatLocalTimeHHMM,
  formatMinutesAsHours,
} from '../../utils/laborCalculations';

interface HoldToPunchButtonProps {
  activeShift: ActiveShiftState | null;
  todaySchedule: DaySchedule;
  todayShiftsCount?: number;
  hasPart1Shift?: boolean;
  hasPart2Shift?: boolean;
  language: LanguageCode;
  onStartShift: (part?: ShiftPartKey) => void;
  onEndShift: () => void;
  onOpenManualEntry: () => void;
}

function playPunchTone(type: 'start' | 'end') {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    if (type === 'start') {
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.14);
    } else {
      osc.frequency.setValueAtTime(783.99, now);
      osc.frequency.exponentialRampToValueAtTime(523.25, now + 0.16);
    }
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.26);
    window.setTimeout(() => ctx.close().catch(() => {}), 350);
  } catch {
    // ignore audio errors
  }
}

export const HoldToPunchButton: React.FC<HoldToPunchButtonProps> = ({
  activeShift,
  todaySchedule,
  hasPart1Shift = false,
  hasPart2Shift = false,
  language,
  onStartShift,
  onEndShift,
  onOpenManualEntry,
}) => {
  const reduceMotion = useReducedMotion();
  const [rippleKey, setRippleKey] = useState(0);
  const [confirmPrompt, setConfirmPrompt] = useState<{
    action: 'start' | 'end';
    part?: ShiftPartKey;
    timeLabel: string;
  } | null>(null);

  const isRunning = Boolean(activeShift);
  const isSplitToday = Boolean(
    !todaySchedule.isUnset &&
      !todaySchedule.isOff &&
      todaySchedule.isSplitShift &&
      todaySchedule.splitStartTime &&
      todaySchedule.splitEndTime
  );

  const openConfirmFor = (action: 'start' | 'end', part?: ShiftPartKey) => {
    const nowTime = formatLocalTimeHHMM(new Date());
    setConfirmPrompt({
      action,
      part,
      timeLabel: nowTime,
    });
  };

  const handleConfirmAction = () => {
    if (!confirmPrompt) return;
    const { action, part } = confirmPrompt;
    setConfirmPrompt(null);
    setRippleKey((k) => k + 1);
    playPunchTone(action);
    if (action === 'start') {
      onStartShift(part);
    } else {
      onEndShift();
    }
  };

  const scheduleSummary = todaySchedule.isUnset
    ? language === 'es'
      ? 'Sin cronograma esta semana'
      : language === 'en'
      ? 'No schedule this week'
      : 'Sem cronograma nesta semana'
    : todaySchedule.isOff
    ? language === 'es'
      ? 'Hoy es tu franco'
      : language === 'en'
      ? 'Day off today'
      : 'Hoje é seu franco'
    : isSplitToday
    ? `${todaySchedule.startTime}–${todaySchedule.endTime} • ${todaySchedule.splitStartTime}–${todaySchedule.splitEndTime}`
    : `${todaySchedule.startTime} → ${todaySchedule.endTime}`;

  const activePartLabel =
    activeShift?.shiftPart === 1
      ? ' (1º turno)'
      : activeShift?.shiftPart === 2
      ? ' (2º turno)'
      : '';

  const part1Mins = calculateShiftPartMinutes(todaySchedule, 1);
  const part2Mins = calculateShiftPartMinutes(todaySchedule, 2);

  return (
    <div
      className="relative flex flex-col items-center justify-center rounded-[2rem] border border-emerald-200/80 bg-gradient-to-b from-white via-emerald-50/40 to-white px-5 py-6 shadow-sm overflow-hidden select-none"
      style={{ WebkitUserSelect: 'none', userSelect: 'none', WebkitTapHighlightColor: 'transparent' }}
    >
      {/* Subtle Ambient Background Glow */}
      <div
        className={`pointer-events-none absolute -top-12 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full blur-3xl transition-colors duration-500 ${
          isRunning ? 'bg-rose-400/20' : 'bg-emerald-400/20'
        }`}
      />

      {/* Top Schedule Pill */}
      <div className="relative z-10 mb-5 flex items-center gap-2 rounded-full border border-emerald-200/80 bg-white/90 px-3.5 py-1.5 shadow-2xs">
        <span
          className={`h-2 w-2 rounded-full ${
            isRunning
              ? 'bg-rose-500 animate-pulse'
              : todaySchedule.isUnset
              ? 'bg-slate-400'
              : todaySchedule.isOff
              ? 'bg-amber-400'
              : 'bg-emerald-500'
          }`}
        />
        <span className="text-[11px] font-black tracking-wide text-slate-700">
          {isRunning
            ? `${language === 'es' ? 'Entrada marcada' : 'Entrada marcada'}${activePartLabel} às ${activeShift?.startTime}`
            : todaySchedule.isUnset
            ? scheduleSummary
            : `${language === 'es' ? 'Turno hoy' : 'Turno hoje'}: ${scheduleSummary}`}
        </span>
      </div>

      {/* Circular Button(s) */}
      {isRunning ? (
        <div className="relative flex h-[164px] w-[164px] items-center justify-center">
          <AnimatePresence>
            {rippleKey > 0 && !reduceMotion && (
              <motion.span
                key={rippleKey}
                initial={{ scale: 0.78, opacity: 0.7 }}
                animate={{ scale: 1.45, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.65, ease: 'easeOut' }}
                className="pointer-events-none absolute inset-2 rounded-full border-4 border-emerald-400"
              />
            )}
          </AnimatePresence>

          <motion.button
            type="button"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => openConfirmFor('end', activeShift?.shiftPart)}
            className="relative z-10 flex h-[136px] w-[136px] flex-col items-center justify-center rounded-full bg-gradient-to-br from-rose-500 via-rose-600 to-red-600 text-white shadow-xl shadow-rose-600/30 cursor-pointer outline-none focus-visible:ring-4 focus-visible:ring-rose-300 px-2 text-center"
          >
            <LogOut className="mb-1 h-6 w-6" />
            <span className="text-[11px] font-black uppercase tracking-wider leading-tight">
              {activeShift?.shiftPart === 1
                ? 'Marcar Saída 1º Turno'
                : activeShift?.shiftPart === 2
                ? 'Marcar Saída 2º Turno'
                : language === 'es'
                ? 'Marcar Salida'
                : 'Marcar Saída'}
            </span>
            <span className="mt-1 text-[9.5px] font-bold text-rose-100">
              {language === 'es' ? 'Toque para finalizar' : 'Toque para encerrar'}
            </span>
          </motion.button>
        </div>
      ) : isSplitToday ? (
        <div className="relative z-10 flex flex-wrap items-center justify-center gap-4">
          {/* Button 1: Marcar Entrada 1º Turno */}
          <div className="flex flex-col items-center gap-1.5">
            <motion.button
              type="button"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => openConfirmFor('start', 1)}
              className={`flex h-[126px] w-[126px] flex-col items-center justify-center rounded-full text-white shadow-xl cursor-pointer outline-none focus-visible:ring-4 focus-visible:ring-emerald-400 px-2 text-center ${
                hasPart1Shift
                  ? 'bg-gradient-to-br from-teal-600 to-emerald-700 shadow-emerald-700/25 ring-2 ring-emerald-300'
                  : 'bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 shadow-emerald-600/30'
              }`}
            >
              <LogIn className="mb-1 h-6 w-6" />
              <span className="text-[10.5px] font-black uppercase tracking-wider leading-tight">
                Marcar Entrada 1º Turno
              </span>
              <span className="mt-1 font-mono text-[9.5px] font-bold text-emerald-100">
                {todaySchedule.startTime}–{todaySchedule.endTime}
              </span>
            </motion.button>
            <span className="text-[9.5px] font-black text-emerald-800">
              {hasPart1Shift ? '✓ 1º turno batido' : `${formatMinutesAsHours(part1Mins)} • 1º turno`}
            </span>
          </div>

          {/* Button 2: Marcar Entrada 2º Turno */}
          <div className="flex flex-col items-center gap-1.5">
            <motion.button
              type="button"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => openConfirmFor('start', 2)}
              className={`flex h-[126px] w-[126px] flex-col items-center justify-center rounded-full text-white shadow-xl cursor-pointer outline-none focus-visible:ring-4 focus-visible:ring-emerald-400 px-2 text-center ${
                hasPart2Shift
                  ? 'bg-gradient-to-br from-teal-600 to-emerald-700 shadow-emerald-700/25 ring-2 ring-emerald-300'
                  : 'bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700 shadow-teal-600/30'
              }`}
            >
              <LogIn className="mb-1 h-6 w-6" />
              <span className="text-[10.5px] font-black uppercase tracking-wider leading-tight">
                Marcar Entrada 2º Turno
              </span>
              <span className="mt-1 font-mono text-[9.5px] font-bold text-emerald-100">
                {todaySchedule.splitStartTime}–{todaySchedule.splitEndTime}
              </span>
            </motion.button>
            <span className="text-[9.5px] font-black text-teal-800">
              {hasPart2Shift ? '✓ 2º turno batido' : `${formatMinutesAsHours(part2Mins)} • 2º turno`}
            </span>
          </div>
        </div>
      ) : (
        <div className="relative flex h-[164px] w-[164px] items-center justify-center">
          <AnimatePresence>
            {rippleKey > 0 && !reduceMotion && (
              <motion.span
                key={rippleKey}
                initial={{ scale: 0.78, opacity: 0.7 }}
                animate={{ scale: 1.45, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.65, ease: 'easeOut' }}
                className="pointer-events-none absolute inset-2 rounded-full border-4 border-rose-400"
              />
            )}
          </AnimatePresence>

          {!reduceMotion && (
            <motion.span
              animate={{ scale: [1, 1.06, 1], opacity: [0.25, 0.45, 0.25] }}
              transition={{ repeat: Infinity, duration: 2.8, ease: 'easeInOut' }}
              className="pointer-events-none absolute inset-1 rounded-full bg-emerald-500/15"
            />
          )}

          <motion.button
            type="button"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => openConfirmFor('start')}
            className="relative z-10 flex h-[136px] w-[136px] flex-col items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 text-white shadow-xl shadow-emerald-600/30 cursor-pointer outline-none focus-visible:ring-4 focus-visible:ring-emerald-400"
          >
            <LogIn className="mb-1.5 h-7 w-7" />
            <span className="text-xs font-black uppercase tracking-widest leading-none">
              {language === 'es' ? 'Marcar Entrada' : 'Marcar Entrada'}
            </span>
            <span className="mt-1.5 text-[10px] font-bold text-emerald-100">
              {language === 'es' ? 'Toque para ingresar' : 'Toque para ingressar'}
            </span>
          </motion.button>
        </div>
      )}

      {/* Bottom Helper Row */}
      <div className="relative z-10 mt-4 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onOpenManualEntry}
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-[10.5px] font-extrabold text-emerald-800 shadow-2xs transition-colors hover:bg-emerald-50 cursor-pointer"
        >
          <Edit3 className="h-3 w-3 text-emerald-600" />
          {language === 'es' ? 'Cargar / ajustar turno manual' : 'Lançar / ajustar turno manual'}
        </button>
      </div>

      {/* Confirmation Popup */}
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
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ type: 'spring', stiffness: 420, damping: 28 }}
              className="relative z-10 w-full max-w-sm rounded-[2rem] border border-slate-200 bg-white p-5 shadow-2xl space-y-4 text-center"
            >
              <div
                className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-md ${
                  confirmPrompt.action === 'start'
                    ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
                    : 'bg-gradient-to-br from-rose-500 to-red-600'
                }`}
              >
                <Clock className="h-6 w-6" />
              </div>

              <div>
                <h3 className="text-base font-black text-slate-900">
                  {confirmPrompt.action === 'start'
                    ? confirmPrompt.part === 1
                      ? `Certeza que quer ingressar no 1º turno agora (${confirmPrompt.timeLabel})?`
                      : confirmPrompt.part === 2
                      ? `Certeza que quer ingressar no 2º turno agora (${confirmPrompt.timeLabel})?`
                      : language === 'es'
                      ? `¿Seguro que quieres ingresar ahora (${confirmPrompt.timeLabel})?`
                      : `Certeza que quer ingressar agora (${confirmPrompt.timeLabel})?`
                    : confirmPrompt.part === 1
                    ? `Certeza que quer marcar a saída do 1º turno agora (${confirmPrompt.timeLabel})?`
                    : confirmPrompt.part === 2
                    ? `Certeza que quer marcar a saída do 2º turno agora (${confirmPrompt.timeLabel})?`
                    : language === 'es'
                    ? `¿Seguro que quieres marcar la salida ahora (${confirmPrompt.timeLabel})?`
                    : `Certeza que quer marcar a saída agora (${confirmPrompt.timeLabel})?`}
                </h3>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  {confirmPrompt.action === 'start'
                    ? confirmPrompt.part === 1
                      ? 'Registra somente a entrada do 1º turno.'
                      : confirmPrompt.part === 2
                      ? 'Registra somente a entrada do 2º turno.'
                      : 'Será registrado somente o horário de entrada do seu turno.'
                    : `Finaliza o turno iniciado às ${activeShift?.startTime}${
                        confirmPrompt.part ? ` (${confirmPrompt.part}º turno)` : ''
                      }.`}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmPrompt(null)}
                  className="rounded-2xl border border-slate-200 bg-white py-3 text-xs font-black text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAction}
                  className={`rounded-2xl py-3 text-xs font-black uppercase tracking-wider text-white shadow-md cursor-pointer ${
                    confirmPrompt.action === 'start'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {confirmPrompt.action === 'start' ? 'Sim, ingressar' : 'Sim, sair'}
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
    <div className="flex items-center justify-between gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/90 px-3.5 py-2.5 text-xs">
      <div className="flex items-center gap-2 font-black text-emerald-900">
        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
        <span>
          {language === 'es' ? 'Turno registrado:' : 'Turno registrado:'}{' '}
          {formatMinutesAsHours(durationMinutes)}
        </span>
      </div>
      {scheduledMinutes > 0 && (
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black ${
            delta >= 0 ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
          }`}
        >
          <Sparkles className="h-2.5 w-2.5" />
          {formatMinutesAsHours(delta, true)}
        </span>
      )}
    </div>
  );
};
