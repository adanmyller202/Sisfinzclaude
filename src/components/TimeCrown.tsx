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

const ITEM_WIDTH = 78; // px per month slot on the precision dial
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
let audioUnlocked = false;

function isSoundDisabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('settings') || key.includes('Settings'))) {
        const raw = localStorage.getItem(key);
        if (raw && raw.includes('"soundEnabled":false')) return true;
      }
    }
  } catch {
    // ignore
  }
  return false;
}

/** Unlock AudioContext inside a direct user gesture so iOS Safari/PWA plays ticks reliably */
function unlockAudioEngine() {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    if (!sharedAudioCtx) sharedAudioCtx = new AudioCtx();
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    if (!audioUnlocked) {
      const silentBuffer = sharedAudioCtx.createBuffer(1, 1, 22050);
      const source = sharedAudioCtx.createBufferSource();
      source.buffer = silentBuffer;
      source.connect(sharedAudioCtx.destination);
      source.start(0);
      audioUnlocked = true;
    }
  } catch {
    // ignore
  }
}

function playMechanicalTick(strong = false) {
  if (typeof window === 'undefined' || isSoundDisabled()) return;
  try {
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
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.015);

    gain.gain.setValueAtTime(strong ? 0.075 : 0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.018);

    osc.connect(gain);
    gain.connect(sharedAudioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.02);
  } catch {
    // ignore audio errors
  }
}

/**
 * Trigger tactile haptic feedback on Android (navigator.vibrate)
 * and best-effort native switch haptic on iOS 17.4+ during direct gestures.
 * Note: iOS WebKit does not support navigator.vibrate() and blocks continuous
 * haptics during drag/async animations.
 */
let iosHapticLabel: HTMLLabelElement | null = null;
function triggerHaptic(strong = false) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(strong ? 14 : 8);
      return;
    } catch {
      // ignore
    }
  }

  if (typeof document !== 'undefined') {
    try {
      if (!iosHapticLabel || !document.body.contains(iosHapticLabel)) {
        const label = document.createElement('label');
        label.setAttribute('aria-hidden', 'true');
        label.style.position = 'fixed';
        label.style.left = '-9999px';
        label.style.top = '0';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.setAttribute('switch', '');
        input.tabIndex = -1;
        label.appendChild(input);
        document.body.appendChild(label);
        iosHapticLabel = label;
      }
      iosHapticLabel.click();
    } catch {
      // ignore
    }
  }
}

/** Compute net health (positive / negative / neutral) for visible months from local cache */
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

  const [dragOffsetPx, setDragOffsetPx] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [tickPulse, setTickPulse] = useState(0);

  const pointerActiveRef = useRef(false);
  const lastClientXRef = useRef(0);
  const lastMoveTimeRef = useRef(0);
  const velocityPxPerMsRef = useRef(0);
  const accumPxRef = useRef(0);
  const didDragRef = useRef(false);
  const lastTapTimeRef = useRef(0);
  const animRafRef = useRef<number | null>(null);

  const healthMap = useMemo(() => computeMonthHealthMap(selectedMonth), [selectedMonth]);
  const activeHealth = healthMap[selectedMonth] || 'neutral';
  const isNegativeMonth = activeHealth === 'negative';

  const stopAnimation = useCallback(() => {
    if (animRafRef.current !== null) {
      cancelAnimationFrame(animRafRef.current);
      animRafRef.current = null;
    }
    setIsSpinning(false);
  }, []);

  useEffect(() => () => stopAnimation(), [stopAnimation]);

  const emitMonthStep = useCallback(
    (delta: -1 | 1, strong = false) => {
      onStepMonth(delta);
      setTickPulse((v) => v + 1);
      triggerHaptic(strong);
      playMechanicalTick(strong);
    },
    [onStepMonth]
  );

  const applyDeltaPx = useCallback(
    (dx: number) => {
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

  /** Smooth 60fps rotary spin across N months (used for both Rewind to Current Month and clicking neighbor slots) */
  const spinByMonths = useCallback(
    (steps: number, onComplete?: () => void) => {
      if (steps === 0) {
        onComplete?.();
        return;
      }

      stopAnimation();

      if (reduceMotion) {
        const dir: -1 | 1 = steps > 0 ? 1 : -1;
        for (let i = 0; i < Math.abs(steps); i++) {
          emitMonthStep(dir, i === Math.abs(steps) - 1);
        }
        accumPxRef.current = 0;
        setDragOffsetPx(0);
        onComplete?.();
        return;
      }

      // If more than 12 months away, skip the excess first and spin smoothly through the final 12 months
      const absSteps = Math.abs(steps);
      let visualSteps = steps;
      if (absSteps > 12) {
        const dir: -1 | 1 = steps > 0 ? 1 : -1;
        const skipCount = absSteps - 12;
        for (let i = 0; i < skipCount; i++) {
          onStepMonth(dir);
        }
        visualSteps = dir * 12;
      }

      // Moving forward (+steps) requires dragging left (-px); moving backward (-steps) requires dragging right (+px)
      const totalTravelPx = -visualSteps * ITEM_WIDTH;
      const durationMs = Math.min(820, Math.max(320, Math.abs(visualSteps) * 115));
      const startTs = performance.now();
      let prevTravel = 0;

      accumPxRef.current = 0;
      setDragOffsetPx(0);
      setIsSpinning(true);

      const easeInOutCubic = (t: number) =>
        t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      const frame = (now: number) => {
        const elapsed = now - startTs;
        const t = Math.min(1, elapsed / durationMs);
        const currentTravel = easeInOutCubic(t) * totalTravelPx;
        const dx = currentTravel - prevTravel;
        prevTravel = currentTravel;

        applyDeltaPx(dx);

        if (t < 1) {
          animRafRef.current = requestAnimationFrame(frame);
        } else {
          animRafRef.current = null;
          accumPxRef.current = 0;
          setDragOffsetPx(0);
          setIsSpinning(false);
          onComplete?.();
        }
      };

      animRafRef.current = requestAnimationFrame(frame);
    },
    [applyDeltaPx, emitMonthStep, onStepMonth, reduceMotion, stopAnimation]
  );

  const startInertiaCoast = useCallback(
    (initialVelocity: number) => {
      stopAnimation();
      setIsSpinning(true);
      let velocity = initialVelocity;
      let lastTs = performance.now();

      const frame = (now: number) => {
        const dt = Math.min(32, Math.max(4, now - lastTs));
        lastTs = now;

        if (Math.abs(velocity) < 0.06) {
          accumPxRef.current = 0;
          setDragOffsetPx(0);
          setIsDragging(false);
          setIsSpinning(false);
          animRafRef.current = null;
          return;
        }

        applyDeltaPx(velocity * dt);
        velocity *= Math.pow(0.92, dt / 16);
        animRafRef.current = requestAnimationFrame(frame);
      };

      animRafRef.current = requestAnimationFrame(frame);
    },
    [applyDeltaPx, stopAnimation]
  );

  const handleRewindToToday = useCallback(() => {
    unlockAudioEngine();

    if (monthDiffFromToday === 0) {
      triggerHaptic(false);
      playMechanicalTick(false);
      setTickPulse((v) => v + 1);
      return;
    }

    triggerHaptic(true);
    playMechanicalTick(true);

    // Smoothly spin the entire ruler back to the current month
    spinByMonths(-monthDiffFromToday, () => {
      onGoToCurrentMonth();
      setTickPulse((v) => v + 1);
    });
  }, [monthDiffFromToday, onGoToCurrentMonth, spinByMonths]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    unlockAudioEngine();
    stopAnimation();
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

  const currentMonthBtnLabel =
    language === 'es' ? 'Mes actual' : language === 'en' ? 'Current' : 'Mês atual';

  const slots = useMemo(() => {
    const arr: { offset: number; monthStr: string; shortLabel: string; yearShort: string }[] = [];
    for (let offset = -VISIBLE_RANGE; offset <= VISIBLE_RANGE; offset++) {
      const mStr = shiftMonthStr(selectedMonth, offset);
      const [y, m] = mStr.split('-').map(Number);
      const idx = Math.max(0, Math.min(11, (m || 1) - 1));
      arr.push({
        offset,
        monthStr: mStr,
        shortLabel: MONTH_SHORT[language][idx],
        yearShort: String(y || '').slice(-2),
      });
    }
    return arr;
  }, [selectedMonth, language]);

  const disableCssTransition = isDragging || isSpinning;

  return (
    <div
      className="glass rounded-[1.75rem] border border-emerald-200/70 bg-white/90 px-3 pt-2.5 pb-2 shadow-sm ring-1 ring-white/50 select-none overflow-hidden"
      style={{ WebkitUserSelect: 'none', userSelect: 'none', WebkitTapHighlightColor: 'transparent' }}
    >
      {/* Top Row: Always-clickable "Mês atual" button on the left + Active Month Title */}
      <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
        <motion.button
          type="button"
          whileTap={{ scale: 0.93 }}
          onClick={handleRewindToToday}
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[9.5px] font-black uppercase tracking-wider transition-all cursor-pointer ${
            monthDiffFromToday === 0
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200/70'
              : 'bg-emerald-600 text-white shadow-xs hover:bg-emerald-700'
          }`}
          title={
            language === 'es'
              ? 'Volver al mes actual'
              : language === 'en'
              ? 'Back to current month'
              : 'Voltar para o mês atual'
          }
        >
          {monthDiffFromToday !== 0 ? (
            <motion.span
              animate={isSpinning ? { rotate: -360 } : { rotate: 0 }}
              transition={isSpinning ? { repeat: Infinity, duration: 0.6, ease: 'linear' } : { duration: 0.2 }}
              className="inline-flex"
            >
              <RotateCcw className="h-2.5 w-2.5 stroke-[2.75]" />
            </motion.span>
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
          )}
          <span>{currentMonthBtnLabel}</span>
        </motion.button>

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

        <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider text-slate-400">
          <Sparkles className="h-2.5 w-2.5 text-emerald-500" />
          {language === 'es' ? 'Gira ⇄' : language === 'en' ? 'Slide ⇄' : 'Gire ⇄'}
        </span>
      </div>

      {/* Rotary Dial Track */}
      <div
        role="slider"
        aria-label={
          language === 'es'
            ? 'Corona del tiempo: desliza para cambiar de mes'
            : 'Coroa do Tempo: deslize para mudar de mês'
        }
        aria-valuetext={activeFullLabel}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            unlockAudioEngine();
            spinByMonths(1);
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            unlockAudioEngine();
            spinByMonths(-1);
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
        className={`relative h-[48px] w-full overflow-hidden rounded-2xl bg-gradient-to-b from-emerald-50/50 via-white/80 to-emerald-50/40 border border-emerald-100/80 touch-none ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        style={{
          WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 16%, black 84%, transparent 100%)',
          maskImage: 'linear-gradient(to right, transparent 0%, black 16%, black 84%, transparent 100%)',
        }}
      >
        {/* Center Highlight Rounded Capsule (Emerald for positive/zero, Rose for negative) */}
        <motion.div
          key={`capsule-${tickPulse}`}
          initial={reduceMotion ? false : { scale: 0.94 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 520, damping: 24 }}
          className={`pointer-events-none absolute left-1/2 top-1/2 z-0 h-[36px] w-[72px] -translate-x-1/2 -translate-y-1/2 rounded-xl border transition-colors duration-200 ${
            isNegativeMonth
              ? 'border-rose-400/85 bg-rose-500/15 shadow-[0_0_12px_rgba(244,63,94,0.16)]'
              : 'border-emerald-300/80 bg-emerald-500/12 shadow-inner'
          }`}
        />

        {/* Sliding Month Slots with Single Clean Vertical Divider Between Months */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transform: `translate3d(${dragOffsetPx}px, 0, 0)`,
            transition: disableCssTransition ? 'none' : 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          {slots.map((slot) => {
            const xPos = slot.offset * ITEM_WIDTH;
            const visualDist = Math.abs(xPos + dragOffsetPx) / ITEM_WIDTH;
            const isCenter = visualDist < 0.45;
            const scale = Math.max(0.78, 1.06 - visualDist * 0.12);
            const opacity = Math.max(0.24, 1 - visualDist * 0.28);
            const slotHealth = healthMap[slot.monthStr] || 'neutral';
            const slotIsNegative = slotHealth === 'negative';

            return (
              <div
                key={slot.monthStr}
                style={{
                  position: 'absolute',
                  left: '50%',
                  width: ITEM_WIDTH,
                  transform: `translate3d(calc(-50% + ${xPos}px), 0, 0)`,
                }}
                className="flex h-full items-center justify-center"
              >
                {/* Single Vertical Divider Line Separating Each Month */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute right-0 top-1/2 h-4 w-[1px] -translate-y-1/2 rounded-full bg-slate-300/65"
                />

                {/* Clickable Month Label */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!didDragRef.current && slot.offset !== 0) {
                      unlockAudioEngine();
                      spinByMonths(slot.offset);
                    }
                  }}
                  style={{ transform: `scale(${scale})`, opacity }}
                  className="relative z-10 flex items-baseline justify-center gap-0.5 rounded-lg px-2 py-1.5 transition-colors cursor-pointer"
                >
                  <span
                    className={`text-[11px] font-black tracking-wider leading-none ${
                      isCenter
                        ? slotIsNegative
                          ? 'text-rose-700'
                          : 'text-emerald-800'
                        : 'text-slate-600'
                    }`}
                  >
                    {slot.shortLabel}
                  </span>
                  <span
                    className={`text-[8.5px] font-bold leading-none ${
                      isCenter
                        ? slotIsNegative
                          ? 'text-rose-500'
                          : 'text-emerald-600'
                        : 'text-slate-400'
                    }`}
                  >
                    {slot.yearShort}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
