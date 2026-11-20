import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Play, Square, Clock, Edit3, CheckCircle2, Sparkles } from 'lucide-react';
import { LanguageCode } from '../../types';
import { ActiveShiftState, DaySchedule } from '../../types/labor';
import { calculateDayScheduleMinutes, formatMinutesAsHours } from '../../utils/laborCalculations';

interface HoldToPunchButtonProps {
  activeShift: ActiveShiftState | null;
  todaySchedule: DaySchedule;
  language: LanguageCode;
  onStartShift: () => void;
  onEndShift: () => void;
  onOpenManualEntry: () => void;
}

const HOLD_DURATION_MS = 650;
const RING_RADIUS = 72;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function playPunchTone(type: 'start' | 'end' | 'tick') {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (type === 'tick') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      gain.gain.setValueAtTime(0.035, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.045);
    } else if (type === 'start') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.14);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.24);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(783.99, now);
      osc.frequency.exponentialRampToValueAtTime(523.25, now + 0.16);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.26);
    }
    window.setTimeout(() => ctx.close().catch(() => {}), 350);
  } catch {
    // ignore audio errors
  }
}

function vibrate(ms: number) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(ms);
    } catch {
      // ignore
    }
  }
}

function formatChronometer(elapsedSec: number): string {
  const safe = Math.max(0, Math.floor(elapsedSec));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const HoldToPunchButton: React.FC<HoldToPunchButtonProps> = ({
  activeShift,
  todaySchedule,
  language,
  onStartShift,
  onEndShift,
  onOpenManualEntry,
}) => {
  const reduceMotion = useReducedMotion();
  const [holdProgress, setHoldProgress] = useState(0); // 0..1
  const [isHolding, setIsHolding] = useState(false);
  const [rippleKey, setRippleKey] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);

  const rafRef = useRef<number | null>(null);
  const holdStartRef = useRef<number>(0);
  const completedRef = useRef(false);

  // Live 1-second chronometer while a shift is active
  useEffect(() => {
    if (!activeShift) {
      setElapsedSec(0);
      return;
    }
    const updateElapsed = () => {
      const startedMs = new Date(activeShift.startedAtIso).getTime();
      if (!Number.isNaN(startedMs)) {
        setElapsedSec(Math.max(0, Math.floor((Date.now() - startedMs) / 1000)));
      }
    };
    updateElapsed();
    const id = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(id);
  }, [activeShift]);

  const cancelHold = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setIsHolding(false);
    setHoldProgress(0);
  };

  useEffect(() => () => cancelHold(), []);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    completedRef.current = false;
    setIsHolding(true);
    holdStartRef.current = performance.now();
    playPunchTone('tick');
    vibrate(8);

    const step = (now: number) => {
      const elapsed = now - holdStartRef.current;
      const pct = Math.min(1, elapsed / HOLD_DURATION_MS);
      setHoldProgress(pct);

      if (pct >= 1) {
        completedRef.current = true;
        rafRef.current = null;
        setIsHolding(false);
        setHoldProgress(0);
        setRippleKey((k) => k + 1);
        vibrate(25);
        if (activeShift) {
          playPunchTone('end');
          onEndShift();
        } else {
          playPunchTone('start');
          onStartShift();
        }
        return;
      }
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
  };

  const handlePointerUpOrLeave = () => {
    if (!completedRef.current) {
      cancelHold();
    }
  };

  const scheduledMinutes = activeShift?.scheduledMinutes || calculateDayScheduleMinutes(todaySchedule);
  const shiftProgressRatio =
    activeShift && scheduledMinutes > 0
      ? Math.min(1, elapsedSec / (scheduledMinutes * 60))
      : 0;

  const isRunning = Boolean(activeShift);
  const strokeDashoffset = RING_CIRCUMFERENCE * (1 - (isHolding ? holdProgress : isRunning ? shiftProgressRatio : 0));

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
    : todaySchedule.isSplitShift && todaySchedule.splitStartTime && todaySchedule.splitEndTime
    ? `${todaySchedule.startTime}–${todaySchedule.endTime} • ${todaySchedule.splitStartTime}–${todaySchedule.splitEndTime}`
    : `${todaySchedule.startTime} → ${todaySchedule.endTime}`;

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
            ? `${language === 'es' ? 'En turno desde' : 'Em turno desde'} ${activeShift?.startTime}`
            : todaySchedule.isUnset
            ? scheduleSummary
            : `${language === 'es' ? 'Turno hoy' : 'Turno hoje'}: ${scheduleSummary}`}
        </span>
      </div>

      {/* Interactive Circular Hold-to-Punch Core */}
      <div className="relative flex h-[176px] w-[176px] items-center justify-center">
        {/* Expanding Ripple Wave on Punch Completion */}
        <AnimatePresence>
          {rippleKey > 0 && !reduceMotion && (
            <motion.span
              key={rippleKey}
              initial={{ scale: 0.78, opacity: 0.7 }}
              animate={{ scale: 1.45, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.65, ease: 'easeOut' }}
              className={`pointer-events-none absolute inset-2 rounded-full border-4 ${
                isRunning ? 'border-emerald-400' : 'border-rose-400'
              }`}
            />
          )}
        </AnimatePresence>

        {/* Breathing Ambient Ring */}
        {!reduceMotion && (
          <motion.span
            animate={{
              scale: isHolding ? 1.07 : [1, 1.05, 1],
              opacity: isHolding ? 0.55 : [0.25, 0.45, 0.25],
            }}
            transition={
              isHolding
                ? { duration: 0.2 }
                : { repeat: Infinity, duration: 2.8, ease: 'easeInOut' }
            }
            className={`pointer-events-none absolute inset-1 rounded-full ${
              isRunning ? 'bg-rose-500/15' : 'bg-emerald-500/15'
            }`}
          />
        )}

        {/* SVG Progress Ring (Hold 360° fill OR Live Shift Progress) */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"
          viewBox="0 0 176 176"
        >
          <circle
            cx="88"
            cy="88"
            r={RING_RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth="7"
            className={isRunning ? 'text-rose-100' : 'text-emerald-100'}
          />
          <circle
            cx="88"
            cy="88"
            r={RING_RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            className={`transition-[stroke] duration-300 ${
              isHolding
                ? isRunning
                  ? 'text-rose-500'
                  : 'text-emerald-500'
                : isRunning
                ? 'text-rose-400'
                : 'text-emerald-500'
            }`}
          />
        </svg>

        {/* Tactile Center Button */}
        <motion.button
          type="button"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUpOrLeave}
          onPointerLeave={handlePointerUpOrLeave}
          onPointerCancel={handlePointerUpOrLeave}
          onContextMenu={(e) => e.preventDefault()}
          animate={{ scale: isHolding ? 0.93 : 1 }}
          transition={{ type: 'spring', stiffness: 480, damping: 24 }}
          className={`relative z-10 flex h-[132px] w-[132px] flex-col items-center justify-center rounded-full text-white shadow-xl cursor-pointer touch-none outline-none focus-visible:ring-4 focus-visible:ring-emerald-400 ${
            isRunning
              ? 'bg-gradient-to-br from-rose-500 via-rose-600 to-orange-600 shadow-rose-600/30'
              : 'bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 shadow-emerald-600/30'
          }`}
        >
          {isRunning ? (
            <>
              <Square className="mb-1 h-5 w-5 fill-current opacity-95" />
              <span className="font-mono text-lg font-black tracking-tight leading-none">
                {formatChronometer(elapsedSec)}
              </span>
              <span className="mt-1.5 text-[9px] font-black uppercase tracking-widest text-rose-100">
                {isHolding
                  ? language === 'es'
                    ? 'Soltando...'
                    : 'Encerrando...'
                  : language === 'es'
                  ? 'Mantén para salir'
                  : 'Segure p/ sair'}
              </span>
            </>
          ) : (
            <>
              <Play className="mb-1 h-7 w-7 fill-current translate-x-0.5" />
              <span className="text-xs font-black uppercase tracking-widest leading-none">
                {isHolding
                  ? language === 'es'
                    ? 'Iniciando...'
                    : 'Batendo...'
                  : language === 'es'
                  ? 'Iniciar Turno'
                  : 'Iniciar Turno'}
              </span>
              <span className="mt-1.5 text-[9px] font-bold text-emerald-100">
                {language === 'es' ? 'Mantén presionado' : 'Segure 0,7s'}
              </span>
            </>
          )}
        </motion.button>
      </div>

      {/* Bottom Helper Row */}
      <div className="relative z-10 mt-4 flex flex-wrap items-center justify-center gap-3">
        {isRunning && scheduledMinutes > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
            <Clock className="h-3 w-3 text-emerald-600" />
            {language === 'es' ? 'Previsto:' : 'Previsto:'} {formatMinutesAsHours(scheduledMinutes)}
          </span>
        )}
        <button
          type="button"
          onClick={onOpenManualEntry}
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-[10.5px] font-extrabold text-emerald-800 shadow-2xs transition-colors hover:bg-emerald-50 cursor-pointer"
        >
          <Edit3 className="h-3 w-3 text-emerald-600" />
          {language === 'es' ? 'Cargar / ajustar turno manual' : 'Lançar / ajustar turno manual'}
        </button>
      </div>
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
