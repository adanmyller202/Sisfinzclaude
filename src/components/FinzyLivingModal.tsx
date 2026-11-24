import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Coffee,
  Sparkles,
  Flame,
  BatteryCharging,
  CalendarHeart,
  Lock,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { LanguageCode } from '../types';
import { MoneMood } from '../types';
import {
  FINZY_SKINS,
  FinzyMascot,
  FinzyRoutineState,
} from './FinzyMascot';
import {
  FinzyLivingContext,
  getSavedFinzySkinId,
  saveFinzySkinId,
} from '../utils/finzyLiving';

interface FinzyLivingModalProps {
  isOpen: boolean;
  onClose: () => void;
  mood: MoneMood;
  moodLabel?: string;
  living: FinzyLivingContext;
  language: LanguageCode;
  onOpenChat: () => void;
}

export const FinzyLivingModal: React.FC<FinzyLivingModalProps> = ({
  isOpen,
  onClose,
  mood,
  moodLabel,
  living,
  language,
  onOpenChat,
}) => {
  const [selectedSkinId, setSelectedSkinId] = useState<string>(() => getSavedFinzySkinId());

  useEffect(() => {
    setSelectedSkinId(getSavedFinzySkinId());
  }, [isOpen]);

  const handleSelectSkin = (skinId: string, unlocked: boolean) => {
    if (!unlocked) return;
    setSelectedSkinId(skinId);
    saveFinzySkinId(skinId);
  };

  if (typeof document === 'undefined') return null;

  const isEs = language === 'es';
  const { routineState, streak, franco } = living;

  const routineChips: {
    id: FinzyRoutineState;
    labelPt: string;
    labelEs: string;
    active: boolean;
  }[] = [
    {
      id: 'franco_cool',
      labelPt: 'Óculos no Franco',
      labelEs: 'Gafas en Franco',
      active: routineState === 'franco_cool',
    },
    {
      id: 'madrugada_coffee',
      labelPt: 'Café Madrugada',
      labelEs: 'Café Madrugada',
      active: routineState === 'madrugada_coffee',
    },
    {
      id: 'proud_streak',
      labelPt: 'Orgulhoso (Streak)',
      labelEs: 'Orgulloso (Racha)',
      active: routineState === 'proud_streak',
    },
  ];

  const ringRadius = 34;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - franco.energyPercent / 100);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs"
          />

          <motion.div
            initial={{ opacity: 0, y: 36, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 36, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            className="relative z-10 flex max-h-[88dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[2rem] sm:rounded-[2rem] bg-white shadow-2xl border border-emerald-100"
          >
            {/* Header */}
            <div className="flex items-center justify-between bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 px-5 py-4 text-white shrink-0">
              <div className="flex items-center gap-2.5">
                <Sparkles className="h-5 w-5 text-emerald-200" />
                <div>
                  <h3 className="text-sm font-black tracking-tight">
                    {isEs ? 'Finzy Vivo & Energía' : 'Finzy Vivo & Energia'}
                  </h3>
                  <p className="text-[10px] font-semibold text-emerald-100">
                    {isEs
                      ? 'Mascota interactiva • Conteo del Franco'
                      : 'Mascote interativo • Contagem do Franco'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-1.5 text-white/85 hover:bg-white/15 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Finzy Live Showcase */}
              <div className="rounded-3xl border border-emerald-200/80 bg-gradient-to-b from-emerald-50/70 to-white p-4 text-center space-y-3">
                <div className="flex justify-center">
                  <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-white shadow-md border border-emerald-100">
                    <FinzyMascot
                      mood={mood}
                      routineState={routineState}
                      skinId={selectedSkinId}
                      size={74}
                    />
                  </div>
                </div>

                <div>
                  <div className="text-sm font-black text-slate-900">
                    {isEs ? living.reactionTitleEs : living.reactionTitlePt}
                  </div>
                  <p className="mt-0.5 text-xs font-medium text-slate-600">
                    {isEs ? living.reactionSubEs : living.reactionSubPt}
                  </p>
                  {moodLabel && (
                    <span className="mt-2 inline-block rounded-full bg-emerald-100 px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-800">
                      {moodLabel}
                    </span>
                  )}
                </div>

                {/* Routine Reaction Indicators */}
                <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                  {routineChips.map((chip) => (
                    <span
                      key={chip.id}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black ${
                        chip.active
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {chip.id === 'franco_cool' && <CalendarHeart className="h-3 w-3" />}
                      {chip.id === 'madrugada_coffee' && <Coffee className="h-3 w-3" />}
                      {chip.id === 'proud_streak' && <Flame className="h-3 w-3" />}
                      {isEs ? chip.labelEs : chip.labelPt}
                    </span>
                  ))}
                </div>
              </div>

              {/* Franco Countdown & Energy Ring Widget */}
              <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <BatteryCharging className="h-3.5 w-3.5 text-emerald-600" />
                    {isEs ? 'Conteo del Franco & Anel de Energía' : 'Contagem do Franco & Anel de Energia'}
                  </span>
                  <span className="rounded-full bg-purple-100 px-2.5 py-0.5 font-mono text-[10px] font-black text-purple-800">
                    {franco.restHoursThisWeek}h {isEs ? 'descanso' : 'folga'}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  {/* Animated Energy Ring */}
                  <div className="relative flex h-22 w-22 shrink-0 items-center justify-center">
                    <svg className="h-full w-full -rotate-90" viewBox="0 0 84 84">
                      <circle
                        cx="42"
                        cy="42"
                        r={ringRadius}
                        fill="none"
                        stroke="#e2e8f0"
                        strokeWidth="6"
                      />
                      <motion.circle
                        cx="42"
                        cy="42"
                        r={ringRadius}
                        fill="none"
                        stroke={
                          franco.isLongStreakWarning
                            ? '#f59e0b'
                            : franco.isFrancoToday
                            ? '#8b5cf6'
                            : '#10b981'
                        }
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={ringCircumference}
                        initial={{ strokeDashoffset: ringCircumference }}
                        animate={{ strokeDashoffset: ringOffset }}
                        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="font-mono text-sm font-black text-slate-900">
                        {franco.energyPercent}%
                      </span>
                      <span className="text-[8px] font-black uppercase text-slate-400">
                        {isEs ? 'Energía' : 'Energia'}
                      </span>
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="text-sm font-black text-slate-900">
                      {isEs ? franco.statusHeadlineEs : franco.statusHeadlinePt}
                    </div>
                    <p className="text-[11px] font-medium text-slate-500 leading-snug">
                      {isEs ? franco.adviceEs : franco.advicePt}
                    </p>
                  </div>
                </div>

                {franco.isLongStreakWarning && (
                  <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[11px] font-bold text-amber-900">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                    <span>
                      {isEs
                        ? `Llevas ${franco.consecutiveDaysStreak} días seguidos trabajando. ¡Cuida tu descanso antes del próximo franco!`
                        : `Você já emendou ${franco.consecutiveDaysStreak} dias seguidos. Cuide do seu descanso até o próximo franco!`}
                    </span>
                  </div>
                )}
              </div>

              {/* Streaks & Unlockable Skins */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <Flame className="h-3.5 w-3.5 text-amber-500" />
                    {isEs ? 'Rachas & Cores Desbloqueables' : 'Sequências & Cores Desbloqueáveis'}
                  </span>
                  <span className="font-mono text-[10px] font-black text-emerald-700">
                    {isEs ? 'Racha' : 'Streak'}: {streak.currentStreak} ({isEs ? 'Máx' : 'Recorde'}:{' '}
                    {streak.bestStreak})
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {FINZY_SKINS.map((sk) => {
                    const isUnlocked = streak.unlockedSkins.includes(sk.id);
                    const isSelected = selectedSkinId === sk.id;
                    return (
                      <button
                        key={sk.id}
                        type="button"
                        disabled={!isUnlocked}
                        onClick={() => handleSelectSkin(sk.id, isUnlocked)}
                        className={`flex items-center justify-between gap-2 rounded-2xl border p-2.5 text-left transition-all ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-50/80 shadow-2xs cursor-pointer'
                            : isUnlocked
                            ? 'border-slate-200 bg-white hover:border-emerald-300 cursor-pointer'
                            : 'border-slate-100 bg-slate-50/80 opacity-65 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="h-6 w-6 shrink-0 rounded-xl border border-white shadow-xs"
                            style={{
                              background: `linear-gradient(135deg, ${sk.bodyStart}, ${sk.bodyEnd})`,
                            }}
                          />
                          <div className="min-w-0">
                            <div className="truncate text-[11px] font-black text-slate-900">
                              {isEs ? sk.nameEs : sk.namePt}
                            </div>
                            <div className="text-[9px] font-bold text-slate-500">
                              {isUnlocked
                                ? isEs
                                  ? 'Desbloqueado'
                                  : 'Desbloqueado'
                                : `${sk.unlockStreaks} ${isEs ? 'puntos' : 'pontos'}`}
                            </div>
                          </div>
                        </div>

                        {isSelected ? (
                          <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                        ) : !isUnlocked ? (
                          <Lock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenChat();
                }}
                className="w-full rounded-2xl bg-emerald-600 py-3 text-xs font-black uppercase tracking-wider text-white shadow-md hover:bg-emerald-700 cursor-pointer"
              >
                {isEs ? 'Conversar com o Finzy' : 'Conversar com o Finzy'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
