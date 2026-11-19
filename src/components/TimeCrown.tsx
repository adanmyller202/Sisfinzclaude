import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { RotateCcw, Sparkles } from 'lucide-react';
import { LanguageCode } from '../types';
import { getCurrentMonthStr, shiftMonthStr, doesItemOccurInMonth } from '../utils/finance';

interface TimeCrownProps {
  selectedMonth: string;
  language: LanguageCode;
  onStepMonth: (delta: -1 | 1) => void;
  onGoToCurrentMonth: () => void;
}

type MonthHealth = 'positive' | 'negative' | 'neutral';

const ITEM_WIDTH = 76; // px per month slot on the precision dial
const VISIBLE_RANGE = 4; // render ±4 months around the active center

const MONTH_SHORT: Record<LanguageCode, string[]> = {
  pt: ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'],
  es: ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'],
  en: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'],
};

const MONTH_LONG: Record<LanguageCode, string[]> = {
  pt: [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ],
  es: [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ],
  en: [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ],
};

function getMonthDiff(fromMonth: string, toMonth: string): number {
  const [y1, m1] = fromMonth.split('-').map(Number);
  const [y2, m2] = toMonth.split('-').map(Number);
  if (!y1 || !m1 || !y2 || !m2) return 0;
  return (y2 - y1) * 12 + (m2 - m1);
}

/** Synthesize a crisp, subtle watch/camera-dial mechanical tick via Web Audio API */
let sharedAudioCtx: AudioContext | null = null;
function playMechanicalTick(strong = false) {
  if (typeof window === 'undefined') return;
  try {
    // Respect user sound preference if stored
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('settings') || key.includes('Settings'))) {
        const raw = localStorage.getItem(key);
        if (raw && raw.includes('"soundEnabled":false')) return;
      }
    }

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    if (!sharedAudioCtx) sharedAudioCtx = new AudioCtx();
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }

    const now = sharedAudioCtx.currentTime;
    const osc = sharedAudioCtx.createOscillator();
    const gain = sharedAudioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(strong ? 1450 : 1050, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.014);

    gain.gain.setValueAtTime(strong ? 0.065 : 0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.016);

    osc.connect(gain);
    gain.connect(sharedAudioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.018);
  } catch {
    // ignore audio errors
  }
}

function triggerHaptic(strong = false) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(strong ? 12 : 6);
    } catch {
      // ignore
    }
  }
}

/** Best-effort read of cached bills/incomes/expenses from localStorage for month health radar dots */
function computeMonthHealthMap(centerMonth: string): Record<string, MonthHealth> {
  const result: Record<string, MonthHealth> = {};
  if (typeof window === 'undefined') return result;

  try {
    let bills: any[] = [];
    let incomes: any[] = [];
    let expenses: any[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.endsWith('_bills') && !k.includes('shared')) {
        const parsed = JSON.parse(localStorage.getItem(k) || '[]');
        if (Array.isArray(parsed) && parsed.length > bills.length) bills = parsed;
      } else if (k.endsWith('_incomes')) {
        const parsed = JSON.parse(localStorage.getItem(k) || '[]');
        if (Array.isArray(parsed) && parsed.length > incomes.length) incomes = parsed;
      } else if (k.endsWith('_expenses')) {
        const parsed = JSON.parse(localStorage.getItem(k) || '[]');
        if (Array.isArray(parsed) && parsed.length > expenses.length) expenses = parsed;
      }
    }

    if (!bills.length && !incomes.length && !expenses.length) return result;

    for (let offset = -VISIBLE_RANGE - 2; offset <= VISIBLE_RANGE + 2; offset++) {
      const m = shiftMonthStr(centerMonth, offset);
      let sumInc = 0;
      let sumOut = 0;

      for (const inc of incomes) {
        const start = inc.startMonth || (inc.expectedDate ? String(inc.expectedDate).slice(0, 7) : '');
        if (start && doesItemOccurInMonth(start, m, inc.recurrence, inc.recurrenceMonthsCount)) {
          const exc = inc.exceptions?.[m];
          if (!exc?.isDeleted && !inc.excludedMonths?.includes(m)) {
            sumInc += Number(exc?.amount ?? inc.amount) || 0;
          }
        }
      }

      for (const b of bills) {
        const start = b.startMonth || (b.dueDate ? String(b.dueDate).slice(0, 7) : '');
        if (start && doesItemOccurInMonth(start, m, b.recurrence, b.recurrenceMonthsCount)) {
          const exc = b.exceptions?.[m];
          if (!exc?.isDeleted && !b.excludedMonths?.includes(m)) {
            sumOut += Number(exc?.amount ?? b.amount) || 0;
          }
        }
      }

      for (const exp of expenses) {
        if (exp.date && String(exp.date).startsWith(m) && !exp.isRefund && !exp.isRefunded) {
          sumOut += Number(exp.amount) || 0;
        }
      }

      if (sumInc === 0 && sumOut === 0) {
        result[m] = 'neutral';
      } else {
        result[m] = sumInc - sumOut >= 0 ? 'positive' : 'negative';
      }
    }
  } catch {
    // ignore cache read errors
  }

  return result;
}

export const TimeCrown: React.FC<TimeCrownProps> = ({
  selectedMonth,
  language,
  onStepMonth,
  onGoToCurrentMonth,
}) => {
  const reduceMotion = useReducedMotion();
  const currentMonth = getCurrentMonthStr();
  const monthDiffFromToday = getMonthDiff(currentMonth, selectedMonth);

  // Sub-slot fractional drag offset in pixels (between -ITEM_WIDTH and +ITEM_WIDTH)
  const [dragOffsetPx, setDragOffsetPx] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [tickPulse, setTickPulse] = useState(0);

  const pointerActiveRef = useRef(false);
  const lastClientXRef = useRef(0);
  const lastMoveTimeRef = useRef(0);
  const velocityPxPerMsRef = useRef(0);
  const accumPxRef = useRef(0);
  const didDragRef = useRef(false);
  const lastTapTimeRef = useRef(0);
  const inertiaRafRef = useRef<number | null>(null);
  const stepQueueTimerRef = useRef<number | null>(null);

  const healthMap = useMemo(() => computeMonthHealthMap(selectedMonth), [selectedMonth]);

  const stopInertia = useCallback(() => {
    if (inertiaRafRef.current !== null) {
      cancelAnimationFrame(inertiaRafRef.current);
      inertiaRafRef.current = null;
    }
    if (stepQueueTimerRef.current !== null) {
      window.clearTimeout(stepQueueTimerRef.current);
      stepQueueTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => stopInertia(), [stopInertia]);

  const emitMonthStep = useCallback(
    (delta: -1 | 1, strong = false) => {
      onStepMonth(delta);
      setTickPulse((v) => v + 1);
      triggerHaptic(strong);
      playMechanicalTick(strong);
    },
    [onStepMonth]
  );

  // Consume accumulated pixel drag and fire month steps whenever crossing a slot boundary
  const applyDeltaPx = useCallback(
    (dx: number) => {
      // Dragging finger LEFT (dx < 0) moves the dial forward into the FUTURE (+1 month)
      // Dragging finger RIGHT (dx > 0) moves the dial backward into the PAST (-1 month)
      accumPxRef.current += dx;

      while (accumPxRef.current <= -ITEM_WIDTH * 0.52) {
        accumPxRef.current += ITEM_WIDTH;
        emitMonthStep(1);
      }
      while (accumPxRef.current >= ITEM_WIDTH * 0.52) {
        accumPxRef.current -= ITEM_WIDTH;
        emitMonthStep(-1);
      }

      setDragOffsetPx(accumPxRef.current);
    },
    [emitMonthStep]
  );

  const startInertiaCoast = useCallback(
    (initialVelocity: number) => {
      stopInertia();
      let velocity = initialVelocity; // px per ms
      let lastTs = performance.now();

      const frame = (now: number) => {
        const dt = Math.min(32, Math.max(4, now - lastTs));
        lastTs = now;

        if (Math.abs(velocity) < 0.06) {
          // Snap back smoothly to center (0)
          accumPxRef.current = 0;
          setDragOffsetPx(0);
          setIsDragging(false);
          inertiaRafRef.current = null;
          return;
        }

        applyDeltaPx(velocity * dt);
        velocity *= Math.pow(0.92, dt / 16);
        inertiaRafRef.current = requestAnimationFrame(frame);
      };

      inertiaRafRef.current = requestAnimationFrame(frame);
    },
    [applyDeltaPx, stopInertia]
  );

  const handleRewindToToday = useCallback(() => {
    stopInertia();
    accumPxRef.current = 0;
    setDragOffsetPx(0);
    setIsDragging(false);
    if (monthDiffFromToday === 0) return;

    triggerHaptic(true);
    playMechanicalTick(true);
    onGoToCurrentMonth();
    setTickPulse((v) => v + 1);
  }, [monthDiffFromToday, onGoToCurrentMonth, stopInertia]);

  const handleJumpBySteps = useCallback(
    (steps: number) => {
      if (steps === 0) return;
      stopInertia();
      const dir: -1 | 1 = steps > 0 ? 1 : -1;
      let remaining = Math.abs(steps);

      const stepNext = () => {
        if (remaining <= 0) return;
        emitMonthStep(dir);
        remaining--;
        if (remaining > 0) {
          stepQueueTimerRef.current = window.setTimeout(stepNext, 45);
        }
      };
      stepNext();
    },
    [emitMonthStep, stopInertia]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    stopInertia();
    pointerActiveRef.current = true;
    didDragRef.current = false;
    lastClientXRef.current = e.clientX;
    lastMoveTimeRef.current = performance.now();
    velocityPxPerMsRef.current = 0;
    accumPxRef.current = 0;
    setIsDragging(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerActiveRef.current) return;
    const now = performance.now();
    const dx = e.clientX - lastClientXRef.current;
    const dt = Math.max(1, now - lastMoveTimeRef.current);

    if (Math.abs(dx) > 2) didDragRef.current = true;

    velocityPxPerMsRef.current = velocityPxPerMsRef.current * 0.6 + (dx / dt) * 0.4;
    lastClientXRef.current = e.clientX;
    lastMoveTimeRef.current = now;

    applyDeltaPx(dx);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerActiveRef.current) return;
    pointerActiveRef.current = false;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }

    if (!didDragRef.current) {
      // Check for double-tap to rewind to current month
      const now = Date.now();
      if (now - lastTapTimeRef.current < 300) {
        lastTapTimeRef.current = 0;
        handleRewindToToday();
      } else {
        lastTapTimeRef.current = now;
      }
      accumPxRef.current = 0;
      setDragOffsetPx(0);
      setIsDragging(false);
      return;
    }

    const v = velocityPxPerMsRef.current;
    if (!reduceMotion && Math.abs(v) > 0.25) {
      startInertiaCoast(Math.max(-2.4, Math.min(2.4, v)));
    } else {
      accumPxRef.current = 0;
      setDragOffsetPx(0);
      setIsDragging(false);
    }
  };

  // Support trackpad/mouse wheel horizontal scrolling on desktop
  const wheelAccumRef = useRef(0);
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(delta) < 1) return;
    wheelAccumRef.current += delta;
    if (wheelAccumRef.current >= 42) {
      wheelAccumRef.current = 0;
      emitMonthStep(1);
    } else if (wheelAccumRef.current <= -42) {
      wheelAccumRef.current = 0;
      emitMonthStep(-1);
    }
  };

  const [selYearStr, selMonthNumStr] = selectedMonth.split('-');
  const selMonthIdx = Math.max(0, Math.min(11, (Number(selMonthNumStr) || 1) - 1));
  const activeFullLabel = `${MONTH_LONG[language][selMonthIdx]} ${selYearStr}`;

  const statusBadge = useMemo(() => {
    if (monthDiffFromToday === 0) {
      return {
        text: language === 'es' ? 'Mes actual' : language === 'en' ? 'Current' : 'Mês atual',
        tone: 'current' as const,
      };
    }
    if (monthDiffFromToday > 0) {
      return {
        text:
          language === 'es'
            ? `En +${monthDiffFromToday} ${monthDiffFromToday === 1 ? 'mes' : 'meses'}`
            : language === 'en'
            ? `In +${monthDiffFromToday}m`
            : `Em +${monthDiffFromToday} ${monthDiffFromToday === 1 ? 'mês' : 'meses'}`,
        tone: 'future' as const,
      };
    }
    const abs = Math.abs(monthDiffFromToday);
    return {
      text:
        language === 'es'
          ? `Hace ${abs} ${abs === 1 ? 'mes' : 'meses'}`
          : language === 'en'
          ? `${abs}m ago`
          : `Há ${abs} ${abs === 1 ? 'mês' : 'meses'}`,
      tone: 'past' as const,
    };
  }, [monthDiffFromToday, language]);

  const slots = useMemo(() => {
    const arr: { offset: number; monthStr: string; shortLabel: string; yearShort: string; isToday: boolean }[] = [];
    for (let offset = -VISIBLE_RANGE; offset <= VISIBLE_RANGE; offset++) {
      const mStr = shiftMonthStr(selectedMonth, offset);
      const [y, m] = mStr.split('-').map(Number);
      const idx = Math.max(0, Math.min(11, (m || 1) - 1));
      arr.push({
        offset,
        monthStr: mStr,
        shortLabel: MONTH_SHORT[language][idx],
        yearShort: String(y || '').slice(-2),
        isToday: mStr === currentMonth,
      });
    }
    return arr;
  }, [selectedMonth, language, currentMonth]);

  return (
    <div
      className="glass rounded-[1.75rem] border border-emerald-200/70 bg-white/90 px-3 pt-2.5 pb-2 shadow-sm ring-1 ring-white/50 select-none overflow-hidden"
      style={{ WebkitUserSelect: 'none', userSelect: 'none', WebkitTapHighlightColor: 'transparent' }}
    >
      {/* Top Status Row */}
      <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[9.5px] font-black uppercase tracking-wider transition-colors ${
            statusBadge.tone === 'current'
              ? 'bg-emerald-100 text-emerald-800'
              : statusBadge.tone === 'future'
              ? 'bg-emerald-600 text-white shadow-2xs'
              : 'bg-slate-200/90 text-slate-700'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              statusBadge.tone === 'current'
                ? 'bg-emerald-600 animate-pulse'
                : statusBadge.tone === 'future'
                ? 'bg-emerald-200'
                : 'bg-slate-500'
            }`}
          />
          {statusBadge.text}
        </span>

        <AnimatePresence mode="wait">
          <motion.span
            key={selectedMonth}
            initial={reduceMotion ? false : { opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: 5 }}
            transition={{ duration: 0.14 }}
            className="truncate text-xs font-black tracking-tight text-slate-900 sm:text-sm"
          >
            {activeFullLabel}
          </motion.span>
        </AnimatePresence>

        {monthDiffFromToday !== 0 ? (
          <motion.button
            type="button"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            whileTap={{ scale: 0.92 }}
            onClick={handleRewindToToday}
            className="inline-flex items-center gap-1 rounded-full border border-emerald-300/80 bg-emerald-50 px-2.5 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-emerald-800 transition-colors hover:bg-emerald-100 cursor-pointer"
          >
            <RotateCcw className="h-2.5 w-2.5 stroke-[2.75]" />
            <span>{language === 'es' ? 'Hoy' : language === 'en' ? 'Today' : 'Hoje'}</span>
          </motion.button>
        ) : (
          <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider text-slate-400">
            <Sparkles className="h-2.5 w-2.5 text-emerald-500" />
            {language === 'es' ? 'Gira ⇄' : language === 'en' ? 'Slide ⇄' : 'Gire ⇄'}
          </span>
        )}
      </div>

      {/* Rotary Precision Dial Track */}
      <div
        role="slider"
        aria-label={language === 'es' ? 'Corona del tiempo: desliza para cambiar de mes' : 'Coroa do Tempo: deslize para mudar de mês'}
        aria-valuetext={activeFullLabel}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            emitMonthStep(1);
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            emitMonthStep(-1);
          } else if (e.key === 'Home') {
            e.preventDefault();
            handleRewindToToday();
          }
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        className={`relative h-[50px] w-full overflow-hidden rounded-2xl bg-gradient-to-b from-emerald-50/50 via-white/80 to-emerald-50/40 border border-emerald-100/80 touch-none ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        style={{
          WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 16%, black 84%, transparent 100%)',
          maskImage: 'linear-gradient(to right, transparent 0%, black 16%, black 84%, transparent 100%)',
        }}
      >
        {/* Center Illuminated Precision Needle */}
        <motion.div
          key={`needle-${tickPulse}`}
          initial={reduceMotion ? false : { scaleY: 1.18, opacity: 1 }}
          animate={{ scaleY: 1, opacity: 0.9 }}
          transition={{ duration: 0.18 }}
          className="pointer-events-none absolute inset-y-1 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center justify-between"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 shadow-[0_0_8px_rgba(5,150,105,0.8)]" />
          <span className="w-[2px] flex-1 bg-gradient-to-b from-emerald-600/80 via-emerald-500/20 to-emerald-600/80" />
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 shadow-[0_0_8px_rgba(5,150,105,0.8)]" />
        </motion.div>

        {/* Center Highlight Capsule */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[38px] w-[72px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-emerald-300/70 bg-emerald-500/10 shadow-inner" />

        {/* Sliding Month Slots + Precision Sub-Ticks */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transform: `translate3d(${dragOffsetPx}px, 0, 0)`,
            transition: isDragging ? 'none' : 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          {slots.map((slot) => {
            const xPos = slot.offset * ITEM_WIDTH;
            const visualDist = Math.abs(xPos + dragOffsetPx) / ITEM_WIDTH;
            const isCenter = visualDist < 0.45;
            const scale = Math.max(0.76, 1.06 - visualDist * 0.12);
            const opacity = Math.max(0.22, 1 - visualDist * 0.28);
            const health = healthMap[slot.monthStr] || 'neutral';

            return (
              <div
                key={slot.monthStr}
                style={{
                  position: 'absolute',
                  left: '50%',
                  width: ITEM_WIDTH,
                  transform: `translate3d(calc(-50% + ${xPos}px), 0, 0)`,
                }}
                className="flex h-full flex-col items-center justify-center"
              >
                {/* Fine Camera-Dial Sub-Ticks on the right half of each slot */}
                <div className="pointer-events-none absolute right-[-24px] top-1/2 flex -translate-y-1/2 items-center gap-[9px] opacity-35">
                  <span className="h-2 w-[1px] rounded-full bg-slate-400" />
                  <span className="h-3 w-[1px] rounded-full bg-slate-400" />
                  <span className="h-2 w-[1px] rounded-full bg-slate-400" />
                </div>

                {/* Clickable Month Label + Health Radar Dot */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!didDragRef.current && slot.offset !== 0) {
                      handleJumpBySteps(slot.offset);
                    }
                  }}
                  style={{ transform: `scale(${scale})`, opacity }}
                  className="relative z-10 flex flex-col items-center justify-center rounded-lg px-2 py-1 transition-colors cursor-pointer"
                >
                  <div className="flex items-baseline gap-0.5">
                    <span
                      className={`text-[11px] font-black tracking-wider leading-none ${
                        isCenter ? 'text-emerald-800' : 'text-slate-600'
                      }`}
                    >
                      {slot.shortLabel}
                    </span>
                    <span
                      className={`text-[8.5px] font-bold leading-none ${
                        isCenter ? 'text-emerald-600' : 'text-slate-400'
                      }`}
                    >
                      {slot.yearShort}
                    </span>
                  </div>

                  {/* Health Radar Indicator Dot */}
                  <div className="mt-1 flex items-center gap-1">
                    <span
                      className={`h-1.5 w-1.5 rounded-full transition-transform ${
                        health === 'positive'
                          ? 'bg-emerald-500'
                          : health === 'negative'
                          ? 'bg-rose-500'
                          : 'bg-slate-300'
                      } ${isCenter ? 'scale-110' : 'scale-90 opacity-75'}`}
                    />
                    {slot.isToday && (
                      <span className="h-1 w-1 rounded-full bg-emerald-700 ring-2 ring-emerald-200" />
                    )}
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
