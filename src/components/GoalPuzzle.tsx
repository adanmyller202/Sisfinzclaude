import React, { useMemo, useState, useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import confetti from 'canvas-confetti';
import { Camera, Image as ImageIcon, Sparkles, Trash2, RefreshCw } from 'lucide-react';
import { LanguageCode } from '../types';
import { getTranslations } from '../utils/i18n';

interface GoalPuzzleProps {
  goalId: string;
  goalTitle?: string;
  imageUrl: string;
  width: number;
  height: number;
  progressPercent: number; // 0 to 100
  language: LanguageCode;
  onChangePhoto: () => void;
  onRemovePhoto: () => void;
  isProcessing?: boolean;
}

// 32-bit FNV-1a / multiplicative hash
function hashString(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// Deterministic PRNG seeded with goalId
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const GoalPuzzle: React.FC<GoalPuzzleProps> = ({
  goalId,
  goalTitle,
  imageUrl,
  width,
  height,
  progressPercent,
  language,
  onChangePhoto,
  onRemovePhoto,
  isProcessing = false,
}) => {
  const t = getTranslations(language);
  const shouldReduceMotion = useReducedMotion();
  const hasCelebratedRef = useRef<boolean>(false);
  const prevRevealedCountRef = useRef<number | null>(null);

  // 10 columns; rows proportional to aspect ratio, clamped [5, 15]
  const cols = 10;
  const rows = useMemo(() => {
    const safeW = width > 0 ? width : 600;
    const safeH = height > 0 ? height : 400;
    const computed = Math.round((10 * safeH) / safeW);
    return Math.min(15, Math.max(5, computed));
  }, [width, height]);

  const totalPieces = cols * rows;

  // Clamped progress between 0 and 100
  const normalizedProgress = Math.min(100, Math.max(0, progressPercent));

  // Revealed pieces count
  const revealedCount =
    normalizedProgress >= 100
      ? totalPieces
      : Math.floor((normalizedProgress / 100) * totalPieces);

  // Deterministic shuffle order for revealing pieces
  const { revealOrderMap } = useMemo(() => {
    const indices = Array.from({ length: totalPieces }, (_, i) => i);
    const rng = mulberry32(hashString(goalId || 'default-goal') || 987654321);

    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    // Map pieceIndex -> step at which it is revealed (0 to totalPieces - 1)
    const map = new Uint16Array(totalPieces);
    for (let step = 0; step < indices.length; step++) {
      map[indices[step]] = step;
    }

    return { revealOrderMap: map };
  }, [goalId, totalPieces]);

  // Track initial render vs live updates so initial load does not animate
  const isInitialMount = useRef(true);
  useEffect(() => {
    isInitialMount.current = false;
  }, []);

  // Fire celebratory confetti once when 100% is reached
  useEffect(() => {
    if (normalizedProgress >= 100 && !hasCelebratedRef.current) {
      hasCelebratedRef.current = true;
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#10B981', '#34D399', '#F59E0B', '#3B82F6', '#EC4899'],
        });
      } catch {}
    } else if (normalizedProgress < 100) {
      hasCelebratedRef.current = false;
    }
  }, [normalizedProgress]);

  // Update previous revealed count after render
  useEffect(() => {
    prevRevealedCountRef.current = revealedCount;
  }, [revealedCount]);

  // Build grid pieces
  const pieces = useMemo(() => {
    const list: Array<{ id: number; isCovered: boolean; isNewlyRevealed: boolean }> = [];
    const prevCount = prevRevealedCountRef.current;

    for (let i = 0; i < totalPieces; i++) {
      const revealStep = revealOrderMap[i];
      const isCovered = revealStep >= revealedCount;
      const isNewlyRevealed =
        !isCovered &&
        prevCount !== null &&
        revealStep >= prevCount &&
        !isInitialMount.current;

      list.push({ id: i, isCovered, isNewlyRevealed });
    }
    return list;
  }, [totalPieces, revealOrderMap, revealedCount]);

  const revealedFormatted = Math.round(normalizedProgress);
  const footerText = t.puzzleRevealedPercent
    ? t.puzzleRevealedPercent
        .replace('{percent}', String(revealedFormatted))
        .replace('{revealed}', String(revealedCount))
        .replace('{total}', String(totalPieces))
    : `${revealedFormatted}% revelado · ${revealedCount} de ${totalPieces} peças`;

  return (
    <div className="glass-card rounded-2xl border border-emerald-100/80 p-3 sm:p-4 shadow-xs space-y-3">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
              <span>{t.goalDreamPhoto}</span>
              {normalizedProgress >= 100 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 animate-pulse border border-emerald-200">
                  {t.dreamConquered}
                </span>
              )}
            </h3>
            <p className="text-[11px] text-slate-500">
              {goalTitle ? `${goalTitle} · ` : ''}
              {t.goalDreamPhotoDesc}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onChangePhoto}
            disabled={isProcessing}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-white/80 hover:bg-white border border-slate-200/80 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            title={t.changePhotoBtn}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{t.changePhotoBtn}</span>
          </button>
          <button
            type="button"
            onClick={onRemovePhoto}
            disabled={isProcessing}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200/60 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            title={t.removePhotoBtn}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.removePhotoBtn}</span>
          </button>
        </div>
      </div>

      {/* Puzzle Frame with Image & Overlay Cover Tiles */}
      <div className="relative w-full rounded-xl overflow-hidden bg-emerald-50/50 border border-emerald-200/60 select-none shadow-inner">
        {/* Base Image maintaining native aspect ratio */}
        <img
          src={imageUrl}
          alt={t.goalDreamPhoto}
          className="w-full h-auto block max-h-[460px] object-contain mx-auto"
          loading="lazy"
        />

        {/* Puzzle Cover Layer: absolute grid exactly over the image */}
        <div
          className="absolute inset-0 grid pointer-events-none"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
          }}
        >
          {pieces.map((piece) => {
            if (!piece.isCovered) {
              return <div key={piece.id} className="w-full h-full" />;
            }

            return (
              <motion.div
                key={piece.id}
                initial={
                  shouldReduceMotion || isInitialMount.current
                    ? false
                    : { opacity: 1, scale: 1 }
                }
                animate={{ opacity: 1, scale: 1 }}
                exit={
                  shouldReduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, scale: 0.9, filter: 'blur(2px)' }
                }
                transition={{
                  duration: shouldReduceMotion ? 0.05 : 0.35,
                  ease: 'easeOut',
                }}
                className="w-full h-full bg-[#D1FAEB]/90 border-[0.5px] border-emerald-500/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)] backdrop-blur-[2px]"
              />
            );
          })}
        </div>

        {/* 100% Goal Conquered Celebration Banner overlay */}
        {normalizedProgress >= 100 && (
          <div className="absolute inset-0 pointer-events-none flex items-end justify-center p-3 bg-gradient-to-t from-emerald-900/30 via-transparent to-transparent">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600 text-white text-xs font-black shadow-lg backdrop-blur-xs">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>{t.dreamConquered}</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer Stats & Progress */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-slate-100">
        <span className="text-xs font-bold text-slate-700 font-mono-numbers">
          {footerText}
        </span>

        {/* Mini progress bar */}
        <div className="flex items-center gap-2">
          <div className="w-32 sm:w-40 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300 rounded-full"
              style={{ width: `${normalizedProgress}%` }}
            />
          </div>
          <span className="text-xs font-black text-emerald-600 font-mono-numbers">
            {revealedFormatted}%
          </span>
        </div>
      </div>
    </div>
  );
};

export default GoalPuzzle;
