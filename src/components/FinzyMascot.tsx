import React from 'react';
import { motion, useReducedMotion, type TargetAndTransition } from 'motion/react';
import { MoneMood } from '../types';

export type FinzyRoutineState = 'normal' | 'franco_cool' | 'madrugada_coffee' | 'proud_streak';

export interface FinzySkinPalette {
  id: string;
  namePt: string;
  nameEs: string;
  bodyStart: string;
  bodyMid: string;
  bodyEnd: string;
  rimStroke: string;
  glowColor: string;
  unlockStreaks: number;
}

export const FINZY_SKINS: FinzySkinPalette[] = [
  {
    id: 'emerald_classic',
    namePt: 'Esmeralda Clássico',
    nameEs: 'Esmeralda Clásico',
    bodyStart: '#34d399',
    bodyMid: '#10b981',
    bodyEnd: '#047857',
    rimStroke: '#a7f3d0',
    glowColor: 'rgba(16, 185, 129, 0.45)',
    unlockStreaks: 0,
  },
  {
    id: 'gold_vip',
    namePt: 'Ouro Real',
    nameEs: 'Oro Real',
    bodyStart: '#fde047',
    bodyMid: '#f59e0b',
    bodyEnd: '#b45309',
    rimStroke: '#fef08a',
    glowColor: 'rgba(245, 158, 11, 0.45)',
    unlockStreaks: 3,
  },
  {
    id: 'cosmic_violet',
    namePt: 'Roxo Franco',
    nameEs: 'Violeta Franco',
    bodyStart: '#c084fc',
    bodyMid: '#8b5cf6',
    bodyEnd: '#5b21b6',
    rimStroke: '#e9d5ff',
    glowColor: 'rgba(139, 92, 246, 0.45)',
    unlockStreaks: 7,
  },
  {
    id: 'cyber_cyan',
    namePt: 'Azul Sereno',
    nameEs: 'Azul Sereno',
    bodyStart: '#67e8f9',
    bodyMid: '#06b6d4',
    bodyEnd: '#0e7490',
    rimStroke: '#cffafe',
    glowColor: 'rgba(6, 182, 212, 0.45)',
    unlockStreaks: 14,
  },
  {
    id: 'sakura_rose',
    namePt: 'Rosa Quartzo',
    nameEs: 'Rosa Cuarzo',
    bodyStart: '#f9a8d4',
    bodyMid: '#ec4899',
    bodyEnd: '#9d174d',
    rimStroke: '#fce7f3',
    glowColor: 'rgba(236, 72, 153, 0.45)',
    unlockStreaks: 21,
  },
];

export interface FinzyMascotProps {
  mood: MoneMood;
  routineState?: FinzyRoutineState;
  skinId?: string;
  size?: number | 'sm' | 'md' | 'lg';
  className?: string;
  animate?: boolean;
}

const SIZE_CLASS_MAP = {
  sm: 'w-7 h-7',
  md: 'w-10 h-10',
  lg: 'w-14 h-14',
};

export const FinzyMascot: React.FC<FinzyMascotProps> = ({
  mood,
  routineState = 'normal',
  skinId = 'emerald_classic',
  size = 'md',
  className = '',
  animate = true,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const allowMotion = animate && !shouldReduceMotion;

  const skin = FINZY_SKINS.find((s) => s.id === skinId) || FINZY_SKINS[0];
  const uniquePrefix = React.useId().replace(/:/g, '');

  const getBodyAnimation = (): TargetAndTransition => {
    if (!allowMotion) return {};

    if (routineState === 'proud_streak') {
      return {
        y: [0, -3.5, 0],
        scale: [1, 1.05, 1],
        rotate: [0, -2, 2, 0],
        transition: { repeat: Infinity, duration: 2.2, ease: 'easeInOut' },
      };
    }

    if (routineState === 'franco_cool') {
      return {
        y: [0, -1.8, 0],
        rotate: [-1.5, 1.5, -1.5],
        transition: { repeat: Infinity, duration: 3.4, ease: 'easeInOut' },
      };
    }

    if (routineState === 'madrugada_coffee') {
      return {
        y: [0, 1.5, 0],
        scale: [1, 1.02, 1],
        transition: { repeat: Infinity, duration: 3.2, ease: 'easeInOut' },
      };
    }

    switch (mood) {
      case 'scared':
        return {
          x: [-0.6, 0.6, -0.6, 0.6, 0],
          y: [-0.5, 0.5, 0],
          transition: { repeat: Infinity, repeatType: 'reverse' as const, duration: 0.25 },
        };
      case 'happy':
        return {
          y: [0, -2.5, 0],
          rotate: [0, 2, -2, 0],
          transition: { repeat: Infinity, duration: 2.6, ease: 'easeInOut' },
        };
      case 'sleeping':
        return {
          scale: [1, 1.02, 1],
          y: [0, 1.2, 0],
          transition: { repeat: Infinity, duration: 3.5, ease: 'easeInOut' },
        };
      case 'worried':
        return {
          rotate: [-1.5, 1.5, -1.5],
          transition: { repeat: Infinity, duration: 2.2, ease: 'easeInOut' },
        };
      case 'calm':
      default:
        return {
          y: [0, -1.5, 0],
          transition: { repeat: Infinity, duration: 3.0, ease: 'easeInOut' },
        };
    }
  };

  const sizeStyle: React.CSSProperties = {
    ...(typeof size === 'number' ? { width: size, height: size } : {}),
    filter: `drop-shadow(0 4px 10px ${skin.glowColor})`,
  };
  const sizeClass = typeof size === 'string' ? SIZE_CLASS_MAP[size] : '';

  const showSunglasses = routineState === 'franco_cool';
  const showCoffeeMug = routineState === 'madrugada_coffee';
  const showProudShine = routineState === 'proud_streak';

  return (
    <motion.div
      animate={getBodyAnimation()}
      style={sizeStyle}
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${sizeClass} ${className}`}
      aria-label={`Finzy (${routineState !== 'normal' ? routineState : mood})`}
    >
      <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible pointer-events-none">
        <defs>
          <radialGradient id={`${uniquePrefix}_bodyGrad`} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor={skin.bodyStart} />
            <stop offset="55%" stopColor={skin.bodyMid} />
            <stop offset="100%" stopColor={skin.bodyEnd} />
          </radialGradient>

          <radialGradient id={`${uniquePrefix}_highlight`} cx="30%" cy="25%" r="42%">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.78)" />
            <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
          </radialGradient>

          <radialGradient id={`${uniquePrefix}_blush`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(244, 63, 94, 0.65)" />
            <stop offset="100%" stopColor="rgba(244, 63, 94, 0)" />
          </radialGradient>
        </defs>

        <path
          d="M32 24 C45 16, 68 18, 78 30 C88 42, 85 62, 72 74 C59 86, 38 84, 26 72 C14 60, 19 32, 32 24 Z"
          fill="none"
          stroke={skin.rimStroke}
          strokeWidth="3.2"
          strokeLinecap="round"
          opacity="0.72"
        />

        <path
          d="M32 24 C45 16, 68 18, 78 30 C88 42, 85 62, 72 74 C59 86, 38 84, 26 72 C14 60, 19 32, 32 24 Z"
          fill={`url(#${uniquePrefix}_bodyGrad)`}
          stroke={skin.rimStroke}
          strokeWidth="2"
        />

        <path
          d="M34 27 C45 20, 62 22, 70 32 C60 30, 42 32, 34 27 Z"
          fill={`url(#${uniquePrefix}_highlight)`}
        />

        {(showSunglasses || showProudShine || mood === 'happy' || mood === 'calm') && (
          <>
            <circle cx="32" cy="58" r="7.5" fill={`url(#${uniquePrefix}_blush)`} />
            <circle cx="68" cy="58" r="7.5" fill={`url(#${uniquePrefix}_blush)`} />
          </>
        )}

        {showSunglasses ? (
          <g>
            <rect
              x="27"
              y="42"
              width="20"
              height="14"
              rx="5"
              fill="#0f172a"
              stroke="#f8fafc"
              strokeWidth="2"
            />
            <rect
              x="53"
              y="42"
              width="20"
              height="14"
              rx="5"
              fill="#0f172a"
              stroke="#f8fafc"
              strokeWidth="2"
            />
            <line
              x1="47"
              y1="47"
              x2="53"
              y2="47"
              stroke="#f8fafc"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <line
              x1="31"
              y1="45"
              x2="36"
              y2="52"
              stroke="rgba(255,255,255,0.45)"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <line
              x1="57"
              y1="45"
              x2="62"
              y2="52"
              stroke="rgba(255,255,255,0.45)"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M 43 61 Q 50 67 57 61"
              fill="none"
              stroke="#064e3b"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
          </g>
        ) : showCoffeeMug ? (
          <g>
            <path
              d="M 36 50 Q 41 55 46 50"
              fill="none"
              stroke="#064e3b"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <path
              d="M 54 50 Q 59 55 64 50"
              fill="none"
              stroke="#064e3b"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <ellipse cx="50" cy="61" rx="3.2" ry="2.4" fill="#064e3b" />
          </g>
        ) : showProudShine ? (
          <g>
            <path
              d="M 36 52 Q 42 45 48 52"
              fill="none"
              stroke="#064e3b"
              strokeWidth="3.8"
              strokeLinecap="round"
            />
            <path
              d="M 52 52 Q 58 45 64 52"
              fill="none"
              stroke="#064e3b"
              strokeWidth="3.8"
              strokeLinecap="round"
            />
            <path
              d="M 42 60 Q 50 67 58 60"
              fill="none"
              stroke="#064e3b"
              strokeWidth="3.4"
              strokeLinecap="round"
            />
          </g>
        ) : mood === 'sleeping' ? (
          <>
            <path
              d="M 38 52 Q 42 56 46 52"
              fill="none"
              stroke="#064e3b"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <path
              d="M 54 52 Q 58 56 62 52"
              fill="none"
              stroke="#064e3b"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <ellipse cx="50" cy="62" rx="2.5" ry="3" fill="#064e3b" />
          </>
        ) : mood === 'scared' ? (
          <>
            <circle cx="42" cy="50" r="5" fill="#ffffff" stroke="#064e3b" strokeWidth="2" />
            <circle cx="42" cy="50" r="2" fill="#064e3b" />
            <circle cx="58" cy="50" r="5" fill="#ffffff" stroke="#064e3b" strokeWidth="2" />
            <circle cx="58" cy="50" r="2" fill="#064e3b" />
            <ellipse cx="50" cy="63" rx="3.5" ry="4" fill="#064e3b" />
          </>
        ) : mood === 'worried' ? (
          <>
            <line x1="36" y1="45" x2="46" y2="48" stroke="#064e3b" strokeWidth="3" strokeLinecap="round" />
            <line x1="64" y1="45" x2="54" y2="48" stroke="#064e3b" strokeWidth="3" strokeLinecap="round" />
            <circle cx="42" cy="52" r="3.5" fill="#064e3b" />
            <circle cx="58" cy="52" r="3.5" fill="#064e3b" />
            <path
              d="M 43 63 Q 47 60 50 63 Q 53 66 57 62"
              fill="none"
              stroke="#064e3b"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
          </>
        ) : (
          <>
            <circle cx="42" cy="50" r="4.5" fill="#064e3b" />
            <circle cx="43.5" cy="48" r="1.5" fill="#ffffff" />
            <circle cx="58" cy="50" r="4.5" fill="#064e3b" />
            <circle cx="59.5" cy="48" r="1.5" fill="#ffffff" />
            <path
              d="M 45 60 Q 50 65 55 60"
              fill="none"
              stroke="#064e3b"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </>
        )}

        {showCoffeeMug && (
          <g transform="translate(62, 62)">
            <rect
              x="0"
              y="3"
              width="18"
              height="15"
              rx="4"
              fill="#ffffff"
              stroke="#064e3b"
              strokeWidth="2.2"
            />
            <path
              d="M 18 6 H 21 A 3 3 0 0 1 21 14 H 18"
              fill="none"
              stroke="#064e3b"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            {allowMotion && (
              <motion.path
                d="M 6 0 Q 4 -3 6 -6 M 12 0 Q 10 -3 12 -6"
                stroke="#f59e0b"
                strokeWidth="1.8"
                strokeLinecap="round"
                fill="none"
                animate={{ y: [0, -2.5, 0], opacity: [0.4, 0.95, 0.4] }}
                transition={{ repeat: Infinity, duration: 2.2 }}
              />
            )}
          </g>
        )}

        {showProudShine && (
          <path
            d="M 73 16 L 75 21 L 80 23 L 75 25 L 73 30 L 71 25 L 66 23 L 71 21 Z"
            fill="#fbbf24"
            stroke="#ffffff"
            strokeWidth="1.2"
          />
        )}
      </svg>
    </motion.div>
  );
};
