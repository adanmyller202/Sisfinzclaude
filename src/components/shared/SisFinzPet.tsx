/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'motion/react';

export type FinzyMood = 'normal' | 'happy' | 'curious' | 'surprised' | 'love' | 'angry' | 'sleepy' | 'shy';

interface SisFinzPetProps {
  onClick?: () => void;
  size?: number;
  className?: string;
}

export const SisFinzPet: React.FC<SisFinzPetProps> = ({
  size = 56,
  className = '',
}) => {
  const [mood, setMood] = useState<FinzyMood>('normal');
  const [isBlinking, setIsBlinking] = useState(false);
  const [pupilOffset, setPupilOffset] = useState({ x: 0, y: 0 });
  const [touchCount, setTouchCount] = useState(0);
  const touchTimerRef = useRef<number | null>(null);
  const idleTimerRef = useRef<number | null>(null);
  const moodTimeoutRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset idle timer
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (mood === 'sleepy') {
      setMood('happy');
      if (moodTimeoutRef.current) clearTimeout(moodTimeoutRef.current);
      moodTimeoutRef.current = window.setTimeout(() => setMood('normal'), 2500);
    }
    idleTimerRef.current = window.setTimeout(() => {
      setMood('sleepy');
    }, 15000); // 15 seconds of inactivity -> sleepy
  }, [mood]);

  // Blink effect loop
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      if (mood !== 'sleepy' && mood !== 'love' && mood !== 'shy') {
        setIsBlinking(true);
        setTimeout(() => setIsBlinking(false), 150);
      }
    }, 4000 + Math.random() * 3000);

    return () => clearInterval(blinkInterval);
  }, [mood]);

  // Initial idle timer setup
  useEffect(() => {
    resetIdleTimer();
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (moodTimeoutRef.current) clearTimeout(moodTimeoutRef.current);
    };
  }, [resetIdleTimer]);

  // Mouse / Touch move tracking for eyes
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      resetIdleTimer();
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      const dx = clientX - centerX;
      const dy = clientY - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 200) {
        const maxOffset = 3;
        setPupilOffset({
          x: (dx / (dist || 1)) * Math.min(Math.abs(dx), maxOffset),
          y: (dy / (dist || 1)) * Math.min(Math.abs(dy), maxOffset),
        });
      } else {
        setPupilOffset({ x: 0, y: 0 });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleMouseMove);
    };
  }, [resetIdleTimer]);

  // Tap / Click handler
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    resetIdleTimer();

    // Increment quick touch count for anger detection
    setTouchCount((prev) => {
      const next = prev + 1;
      if (next >= 4) {
        setMood('angry');
        if (moodTimeoutRef.current) clearTimeout(moodTimeoutRef.current);
        moodTimeoutRef.current = window.setTimeout(() => setMood('normal'), 3000);
        return 0;
      }
      return next;
    });

    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    touchTimerRef.current = window.setTimeout(() => setTouchCount(0), 800);

    if (mood !== 'angry') {
      const moods: FinzyMood[] = ['happy', 'surprised', 'curious', 'love'];
      const nextMood = moods[Math.floor(Math.random() * moods.length)];
      setMood(nextMood);
      if (moodTimeoutRef.current) clearTimeout(moodTimeoutRef.current);
      moodTimeoutRef.current = window.setTimeout(() => setMood('normal'), 2500);
    }
  };

  // Drag / Swipe handler (Demonstrate affection/shy)
  const handleMouseEnterOrTouchStart = () => {
    resetIdleTimer();
    if (mood !== 'angry') {
      setMood('shy');
    }
  };

  const handleMouseLeaveOrTouchEnd = () => {
    if (mood === 'shy') {
      setMood('normal');
    }
  };

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      onMouseEnter={handleMouseEnterOrTouchStart}
      onMouseLeave={handleMouseLeaveOrTouchEnd}
      onTouchStart={handleMouseEnterOrTouchStart}
      onTouchEnd={handleMouseLeaveOrTouchEnd}
      className={`relative cursor-pointer select-none group flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      title="Finzy (IA & Perfil)"
    >
      {/* Floating & Breathing Animation Wrapper */}
      <motion.div
        animate={{
          y: mood === 'sleepy' ? [0, 2, 0] : [0, -3, 0],
          scale: mood === 'surprised' ? [1, 1.08, 1] : [1, 1.02, 1],
          rotate: mood === 'angry' ? [-2, 2, -2, 2, 0] : mood === 'curious' ? 5 : 0,
        }}
        transition={{
          duration: mood === 'sleepy' ? 3.5 : 2.2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="relative w-full h-full flex items-center justify-center filter drop-shadow-[0_4px_10px_rgba(16,185,129,0.4)]"
      >
        {/* SVG Mascot Body */}
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full overflow-visible pointer-events-none"
        >
          <defs>
            {/* Green Body Jelly Gradient */}
            <radialGradient id="finzyBodyGrad" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="50%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#047857" />
            </radialGradient>

            {/* Inner Glow / Highlight */}
            <radialGradient id="finzyHighlight" cx="30%" cy="25%" r="40%">
              <stop offset="0%" stopColor="rgba(255, 255, 255, 0.75)" />
              <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
            </radialGradient>

            {/* Cheek Blush Gradient */}
            <radialGradient id="finzyBlush">
              <stop offset="0%" stopColor="rgba(244, 63, 94, 0.65)" />
              <stop offset="100%" stopColor="rgba(244, 63, 94, 0)" />
            </radialGradient>

            <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Outer Aura Glow */}
          <path
            d="M32 24 C45 16, 68 18, 78 30 C88 42, 85 62, 72 74 C59 86, 38 84, 26 72 C14 60, 19 32, 32 24 Z"
            fill="none"
            stroke="#6ee7b7"
            strokeWidth="3.5"
            strokeLinecap="round"
            opacity="0.75"
            filter="url(#neonGlow)"
          />

          {/* Main Jelly Cloud/Blob Body */}
          <path
            d="M32 24 C45 16, 68 18, 78 30 C88 42, 85 62, 72 74 C59 86, 38 84, 26 72 C14 60, 19 32, 32 24 Z"
            fill="url(#finzyBodyGrad)"
            stroke="#a7f3d0"
            strokeWidth="2"
          />

          {/* Top Luminous Gloss */}
          <path
            d="M34 27 C45 20, 62 22, 70 32 C60 30, 42 32, 34 27 Z"
            fill="url(#finzyHighlight)"
          />

          {/* Rosy Cheeks */}
          {(mood === 'happy' || mood === 'shy' || mood === 'love') && (
            <>
              <circle cx="32" cy="58" r="8" fill="url(#finzyBlush)" />
              <circle cx="68" cy="58" r="8" fill="url(#finzyBlush)" />
            </>
          )}

          {/* Facial Expressions / Eyes */}
          {mood === 'sleepy' ? (
            <>
              <path d="M 38 52 Q 42 56 46 52" fill="none" stroke="#064e3b" strokeWidth="3.5" strokeLinecap="round" />
              <path d="M 54 52 Q 58 56 62 52" fill="none" stroke="#064e3b" strokeWidth="3.5" strokeLinecap="round" />
            </>
          ) : mood === 'love' || mood === 'shy' ? (
            <>
              <path d="M 36 54 Q 42 46 48 54" fill="none" stroke="#064e3b" strokeWidth="4" strokeLinecap="round" />
              <path d="M 52 54 Q 58 46 64 54" fill="none" stroke="#064e3b" strokeWidth="4" strokeLinecap="round" />
            </>
          ) : mood === 'angry' ? (
            <>
              <line x1="36" y1="46" x2="48" y2="52" stroke="#064e3b" strokeWidth="4" strokeLinecap="round" />
              <line x1="64" y1="46" x2="52" y2="52" stroke="#064e3b" strokeWidth="4" strokeLinecap="round" />
            </>
          ) : isBlinking ? (
            <>
              <line x1="37" y1="50" x2="47" y2="50" stroke="#064e3b" strokeWidth="4" strokeLinecap="round" />
              <line x1="53" y1="50" x2="63" y2="50" stroke="#064e3b" strokeWidth="4" strokeLinecap="round" />
            </>
          ) : mood === 'surprised' ? (
            <>
              <ellipse cx="42" cy="50" rx="5" ry="6" fill="#064e3b" />
              <ellipse cx="58" cy="50" rx="5" ry="6" fill="#064e3b" />
              <circle cx="50" cy="62" r="4" fill="#064e3b" />
            </>
          ) : (
            <>
              <g transform={`translate(${pupilOffset.x}, ${pupilOffset.y})`}>
                <ellipse cx="42" cy="50" rx="4.5" ry="5.5" fill="#064e3b" />
                <circle cx="43.5" cy="48" r="1.5" fill="white" />
                <ellipse cx="58" cy="50" rx="4.5" ry="5.5" fill="#064e3b" />
                <circle cx="59.5" cy="48" r="1.5" fill="white" />
              </g>
            </>
          )}

          {/* Happy smile */}
          {(mood === 'happy' || mood === 'normal' || mood === 'shy') && (
            <path d="M 45 60 Q 50 65 55 60" fill="none" stroke="#064e3b" strokeWidth="3" strokeLinecap="round" />
          )}

          {/* Curious question mark */}
          {mood === 'curious' && (
            <text x="68" y="32" fill="#fff" fontSize="16" fontWeight="900" filter="url(#neonGlow)">?</text>
          )}
        </svg>
      </motion.div>
    </div>
  );
};
