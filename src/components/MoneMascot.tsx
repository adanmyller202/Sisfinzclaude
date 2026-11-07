/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, useReducedMotion, type TargetAndTransition } from 'motion/react';
import { MoneMood } from '../types';

export interface MoneMascotProps {
  mood: MoneMood;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  animate?: boolean;
}

const SIZE_MAP = {
  sm: 'w-7 h-7',
  md: 'w-10 h-10',
  lg: 'w-14 h-14',
};

export const MoneMascot: React.FC<MoneMascotProps> = ({
  mood,
  size = 'md',
  className = '',
  animate = true,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const allowMotion = animate && !shouldReduceMotion;

  // Base coin color gradient per mood
  const getGradientColors = () => {
    switch (mood) {
      case 'scared':
        // Paler, slightly desaturated amber
        return { start: '#FDE68A', mid: '#F59E0B', end: '#D97706', rim: '#B45309' };
      case 'worried':
        // Warm gold with slightly tense tone
        return { start: '#FDE047', mid: '#EAB308', end: '#CA8A04', rim: '#A16207' };
      case 'sleeping':
        // Soft golden glow
        return { start: '#FEF08A', mid: '#FACC15', end: '#EAB308', rim: '#CA8A04' };
      case 'happy':
        // Vibrant sparkling gold
        return { start: '#FEF08A', mid: '#FBBF24', end: '#F59E0B', rim: '#D97706' };
      case 'calm':
      default:
        // Harmonious balanced gold
        return { start: '#FDE68A', mid: '#FBBF24', end: '#D97706', rim: '#B45309' };
    }
  };

  const colors = getGradientColors();

  // Motion variants for mascot body float/sway/tremor
  const getBodyAnimation = (): TargetAndTransition => {
    if (!allowMotion) return {};

    switch (mood) {
      case 'scared':
        return {
          x: [-0.5, 0.5, -0.5, 0.5, 0],
          y: [-0.5, 0.5, 0],
          transition: {
            repeat: Infinity,
            repeatType: 'reverse' as const,
            duration: 0.25,
            ease: 'easeInOut' as const,
          },
        };
      case 'happy':
        return {
          y: [0, -2.5, 0],
          rotate: [0, 2, -2, 0],
          transition: {
            repeat: Infinity,
            duration: 2.8,
            ease: 'easeInOut' as const,
          },
        };
      case 'sleeping':
        return {
          scale: [1, 1.02, 1],
          y: [0, 1, 0],
          transition: {
            repeat: Infinity,
            duration: 3.5,
            ease: 'easeInOut' as const,
          },
        };
      case 'worried':
        return {
          rotate: [-1.5, 1.5, -1.5],
          transition: {
            repeat: Infinity,
            duration: 2.2,
            ease: 'easeInOut' as const,
          },
        };
      case 'calm':
      default:
        return {
          y: [0, -1.2, 0],
          transition: {
            repeat: Infinity,
            duration: 3.2,
            ease: 'easeInOut' as const,
          },
        };
    }
  };

  // Eyes blink animation for moods that blink
  const shouldBlink = allowMotion && (mood === 'calm' || mood === 'happy' || mood === 'worried');
  const eyeBlinkAnimation = shouldBlink
    ? {
        scaleY: [1, 1, 0.1, 1, 1],
        transition: {
          repeat: Infinity,
          duration: 4,
          times: [0, 0.88, 0.92, 0.96, 1],
        },
      }
    : {};

  return (
    <motion.div
      animate={getBodyAnimation()}
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${SIZE_MAP[size]} ${className}`}
      aria-label={`Mone Mascot (${mood})`}
    >
      <svg
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-sm overflow-visible"
      >
        <defs>
          {/* Main Coin Gradient */}
          <linearGradient id={`coinGrad_${mood}`} x1="8" y1="6" x2="40" y2="42" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={colors.start} />
            <stop offset="50%" stopColor={colors.mid} />
            <stop offset="100%" stopColor={colors.end} />
          </linearGradient>

          {/* Rim Gradient */}
          <linearGradient id={`rimGrad_${mood}`} x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFBEB" />
            <stop offset="35%" stopColor={colors.start} />
            <stop offset="70%" stopColor={colors.mid} />
            <stop offset="100%" stopColor={colors.rim} />
          </linearGradient>

          {/* Coin Inner Bevel */}
          <radialGradient id={`bevelGrad_${mood}`} cx="20" cy="18" r="22" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.45" />
            <stop offset="60%" stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset="100%" stopColor="#78350F" stopOpacity="0.25" />
          </radialGradient>
        </defs>

        {/* Outer Coin Edge & Depth */}
        <circle cx="24" cy="25" r="21" fill={colors.rim} opacity="0.6" />
        <circle cx="24" cy="24" r="21" fill={`url(#rimGrad_${mood})`} stroke={colors.rim} strokeWidth="1.2" />

        {/* Inner Coin Rim */}
        <circle cx="24" cy="24" r="18.5" fill={`url(#coinGrad_${mood})`} />
        <circle
          cx="24"
          cy="24"
          r="16.5"
          fill="none"
          stroke={colors.rim}
          strokeWidth="0.8"
          strokeDasharray="1.5 2"
          opacity="0.5"
        />

        {/* Gloss highlight arc on upper left */}
        <path
          d="M 12 20 A 15 15 0 0 1 24 9"
          stroke="#FFFFFF"
          strokeWidth="1.8"
          strokeLinecap="round"
          opacity="0.6"
        />

        {/* Rosy Cheeks for cute moods */}
        {(mood === 'happy' || mood === 'calm' || mood === 'sleeping') && (
          <>
            <circle cx="13" cy="26" r="2.4" fill="#F43F5E" opacity="0.3" />
            <circle cx="35" cy="26" r="2.4" fill="#F43F5E" opacity="0.3" />
          </>
        )}

        {/* ============================================================ */}
        {/* FACIAL FEATURES ACCORDING TO MOOD */}
        {/* ============================================================ */}

        {/* 1. HAPPY (^ ^ eyes, cheerful smile, sparkling highlight) */}
        {mood === 'happy' && (
          <g>
            {/* Sparkling Star */}
            <path
              d="M 36 9 L 37.5 12.5 L 41 14 L 37.5 15.5 L 36 19 L 34.5 15.5 L 31 14 L 34.5 12.5 Z"
              fill="#FEF08A"
              stroke="#F59E0B"
              strokeWidth="0.6"
            />
            {/* Smiling Eyes */}
            <motion.g animate={eyeBlinkAnimation} style={{ transformOrigin: '24px 19px' }}>
              <path
                d="M 14 20 C 15.5 16 19.5 16 21 20"
                stroke="#78350F"
                strokeWidth="2.2"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M 27 20 C 28.5 16 32.5 16 34 20"
                stroke="#78350F"
                strokeWidth="2.2"
                strokeLinecap="round"
                fill="none"
              />
            </motion.g>
            {/* Open Happy Smile */}
            <path
              d="M 18 24.5 C 19 31.5 29 31.5 30 24.5 Z"
              fill="#78350F"
            />
            {/* Little tongue */}
            <path
              d="M 21 28.5 C 22.5 30.5 25.5 30.5 27 28.5 Z"
              fill="#FB7185"
            />
          </g>
        )}

        {/* 2. CALM (gentle smiling eyes, peaceful posture, soft smile) */}
        {mood === 'calm' && (
          <g>
            {/* Relaxed Calm Eyes */}
            <motion.g animate={eyeBlinkAnimation} style={{ transformOrigin: '24px 20px' }}>
              <ellipse cx="17.5" cy="20" rx="1.8" ry="2.4" fill="#78350F" />
              <circle cx="18.2" cy="19.2" r="0.7" fill="#FFFFFF" />
              <ellipse cx="30.5" cy="20" rx="1.8" ry="2.4" fill="#78350F" />
              <circle cx="31.2" cy="19.2" r="0.7" fill="#FFFFFF" />
            </motion.g>
            {/* Gentle Serene Smile */}
            <path
              d="M 20 25.5 C 22 28.5 26 28.5 28 25.5"
              stroke="#78350F"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
          </g>
        )}

        {/* 3. WORRIED (slanted eyebrows, wavy mouth, sweat droplet) */}
        {mood === 'worried' && (
          <g>
            {/* Slanted Brows */}
            <path d="M 14 15.5 L 20 18" stroke="#78350F" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M 34 15.5 L 28 18" stroke="#78350F" strokeWidth="1.6" strokeLinecap="round" />
            {/* Eyes */}
            <motion.g animate={eyeBlinkAnimation} style={{ transformOrigin: '24px 21px' }}>
              <circle cx="17.5" cy="21.5" r="2.2" fill="#78350F" />
              <circle cx="18.2" cy="20.8" r="0.7" fill="#FFFFFF" />
              <circle cx="30.5" cy="21.5" r="2.2" fill="#78350F" />
              <circle cx="31.2" cy="20.8" r="0.7" fill="#FFFFFF" />
            </motion.g>
            {/* Wavy Tense Mouth */}
            <path
              d="M 18.5 27.5 Q 21 25.5 24 27.5 Q 27 29.5 29.5 27"
              stroke="#78350F"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
            {/* Cute Cyan Sweat Droplet */}
            <path
              d="M 37 12 C 37 12 39.5 15.5 39.5 17 C 39.5 18.4 38.4 19.5 37 19.5 C 35.6 19.5 34.5 18.4 34.5 17 C 34.5 15.5 37 12 37 12 Z"
              fill="#38BDF8"
              stroke="#0284C7"
              strokeWidth="0.6"
            />
          </g>
        )}

        {/* 4. SCARED (wide round eyes, trembling mouth, fear marks) */}
        {mood === 'scared' && (
          <g>
            {/* High Brows */}
            <path d="M 14 14.5 Q 17.5 13 21 15" stroke="#78350F" strokeWidth="1.6" strokeLinecap="round" fill="none" />
            <path d="M 34 14.5 Q 30.5 13 27 15" stroke="#78350F" strokeWidth="1.6" strokeLinecap="round" fill="none" />
            {/* Wide Shocked Eyes */}
            <circle cx="17.5" cy="20.5" r="3.4" fill="#FFFFFF" stroke="#78350F" strokeWidth="1.4" />
            <circle cx="17.5" cy="20.5" r="1.4" fill="#78350F" />
            <circle cx="30.5" cy="20.5" r="3.4" fill="#FFFFFF" stroke="#78350F" strokeWidth="1.4" />
            <circle cx="30.5" cy="20.5" r="1.4" fill="#78350F" />
            {/* Gasp / Trembling Mouth */}
            <ellipse
              cx="24"
              cy="28"
              rx="3"
              ry="3.8"
              fill="#78350F"
            />
            <ellipse
              cx="24"
              cy="28.8"
              rx="1.8"
              ry="2"
              fill="#991B1B"
            />
            {/* Stress marks */}
            <line x1="8" y1="12" x2="11" y2="15" stroke="#0284C7" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="11" y1="9" x2="14" y2="12" stroke="#0284C7" strokeWidth="1.2" strokeLinecap="round" />
          </g>
        )}

        {/* 5. SLEEPING (sleeping curved lines, relaxed mouth, floating Zzz) */}
        {mood === 'sleeping' && (
          <g>
            {/* Closed Sleeping Eyes */}
            <path
              d="M 14.5 21 C 16 23.5 19 23.5 20.5 21"
              stroke="#78350F"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M 27.5 21 C 29 23.5 32 23.5 33.5 21"
              stroke="#78350F"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
            {/* Small Relaxed Mouth */}
            <ellipse
              cx="24"
              cy="27"
              rx="1.6"
              ry="2"
              fill="#78350F"
            />
            {/* Animated Floating Zzz */}
            {allowMotion ? (
              <motion.g
                animate={{
                  y: [0, -3.5, -7],
                  opacity: [0, 0.9, 0],
                  scale: [0.8, 1.1, 1.3],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 2.8,
                  ease: 'easeOut',
                }}
                style={{ transformOrigin: '36px 12px' }}
              >
                <text
                  x="33"
                  y="12"
                  fontSize="7.5"
                  fontWeight="900"
                  fill="#78350F"
                  fontFamily="sans-serif"
                >
                  z
                </text>
                <text
                  x="37"
                  y="7"
                  fontSize="9.5"
                  fontWeight="900"
                  fill="#78350F"
                  fontFamily="sans-serif"
                >
                  Z
                </text>
              </motion.g>
            ) : (
              <text
                x="35"
                y="10"
                fontSize="8.5"
                fontWeight="900"
                fill="#78350F"
                fontFamily="sans-serif"
              >
                Z
              </text>
            )}
          </g>
        )}
      </svg>
    </motion.div>
  );
};
