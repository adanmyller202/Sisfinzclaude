/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { LanguageCode } from '../types';
import { getTranslations } from '../utils/i18n';
import {
  Wallet,
  Calendar,
  PieChart,
  Target,
  Landmark,
} from 'lucide-react';

export type MainNavArea = 'finance' | 'planejar' | 'report' | 'goals' | 'accounts';

interface BottomNavProps {
  currentArea: MainNavArea;
  onChangeArea: (area: MainNavArea) => void;
  language?: LanguageCode;
  overdueBillsCount?: number;
  goalsMilestoneCount?: number;
  accountsAlertCount?: number;
}

const NAV_ITEMS: {
  id: MainNavArea;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeCount?: number;
  badgeColor?: string;
}[] = [];

export const BottomNav: React.FC<BottomNavProps> = ({
  currentArea,
  onChangeArea,
  language = 'pt',
  overdueBillsCount = 0,
  goalsMilestoneCount = 0,
  accountsAlertCount = 0,
}) => {
  const t = getTranslations(language);
  const navRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [isDragging, setIsDragging] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const dragStartX = useRef(0);
  const didDrag = useRef(false);

  const navItems = [
    { id: 'finance' as const, labelKey: 'navHome', icon: Wallet },
    {
      id: 'planejar' as const,
      labelKey: 'navPlan',
      icon: Calendar,
      badgeCount: overdueBillsCount,
      badgeColor: 'bg-rose-500 text-white',
    },
    { id: 'report' as const, labelKey: 'navInsights', icon: PieChart },
    {
      id: 'goals' as const,
      labelKey: 'navGoals',
      icon: Target,
      badgeCount: goalsMilestoneCount,
      badgeColor: 'bg-amber-500 text-white',
    },
    {
      id: 'accounts' as const,
      labelKey: 'navAccounts',
      icon: Landmark,
      badgeCount: accountsAlertCount,
      badgeColor: 'bg-emerald-600 text-white',
    },
  ];

  const activeIndex = Math.max(0, navItems.findIndex((item) => item.id === currentArea));
  const visualIndex = isDragging && previewIndex !== null ? previewIndex : activeIndex;

  const handleTabClick = (area: MainNavArea) => {
    if (area === currentArea) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      onChangeArea(area);
    }
  };

  const updateDragPreview = (clientX: number) => {
    const bounds = navRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0) return;
    const relativeX = Math.min(Math.max(clientX - bounds.left, 0), bounds.width - 1);
    const nextIndex = Math.min(
      navItems.length - 1,
      Math.max(0, Math.floor((relativeX / bounds.width) * navItems.length))
    );
    setPreviewIndex(nextIndex);
    if (Math.abs(clientX - dragStartX.current) > 5) didDrag.current = true;
  };

  const handleIndicatorPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartX.current = event.clientX;
    didDrag.current = false;
    setPreviewIndex(activeIndex);
    setIsDragging(true);
  };

  const handleIndicatorPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    updateDragPreview(event.clientX);
  };

  const finishIndicatorDrag = () => {
    if (!isDragging) return;
    const destination = previewIndex;
    setIsDragging(false);
    setPreviewIndex(null);
    if (didDrag.current && destination !== null) {
      handleTabClick(navItems[destination].id);
    }
  };

  return (
    <nav
      role="navigation"
      aria-label={t.financialControl}
      className="fixed bottom-0 left-0 right-0 z-40 print:hidden pointer-events-none"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="mx-auto max-w-xl px-4 pb-2">
        <div
          ref={navRef}
          className="relative isolate flex h-[68px] items-center gap-0 overflow-visible rounded-[26px] border border-emerald-100/90 bg-white/95 px-1.5 shadow-[0_12px_34px_rgba(5,150,105,0.13),0_3px_10px_rgba(15,23,42,0.05),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-xl pointer-events-auto"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          {/* SVG alpha-threshold filter fuses the two mint shapes into one liquid surface. */}
          <svg aria-hidden="true" className="pointer-events-none absolute h-0 w-0">
            <defs>
              <filter id="sisfinz-liquid-goo" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="softBlur" />
                <feColorMatrix
                  in="softBlur"
                  mode="matrix"
                  values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -8"
                  result="goo"
                />
                <feComposite in="SourceGraphic" in2="goo" operator="atop" />
              </filter>
            </defs>
          </svg>

          {/* Floating liquid indicator. Drag the emerald droplet to jump between sections. */}
          <motion.div
            aria-label="Arraste para mudar de seção"
            role="slider"
            aria-valuemin={1}
            aria-valuemax={navItems.length}
            aria-valuenow={visualIndex + 1}
            aria-valuetext={(t[navItems[visualIndex].labelKey as keyof typeof t] as string) || navItems[visualIndex].labelKey}
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault();
                const direction = event.key === 'ArrowRight' ? 1 : -1;
                const next = Math.min(navItems.length - 1, Math.max(0, activeIndex + direction));
                handleTabClick(navItems[next].id);
              }
            }}
            onPointerDown={handleIndicatorPointerDown}
            onPointerMove={handleIndicatorPointerMove}
            onPointerUp={finishIndicatorDrag}
            onPointerCancel={finishIndicatorDrag}
            animate={{
              left: `calc(${((visualIndex + 0.5) / navItems.length) * 100}% )`,
              scale: isDragging ? 1.08 : 1,
            }}
            transition={reduceMotion ? { duration: 0.01 } : {
              left: { type: 'spring', stiffness: 420, damping: 30, mass: 0.72 },
              scale: { type: 'spring', stiffness: 500, damping: 24 },
            }}
            className="absolute top-1/2 z-20 flex h-[46px] w-[58px] -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none items-center justify-center outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 rounded-full"
            style={{ filter: 'url(#sisfinz-liquid-goo)', WebkitUserSelect: 'none', userSelect: 'none' }}
          >
            <motion.span
              className="absolute inset-0 rounded-full border border-emerald-300/70 bg-gradient-to-br from-emerald-400 via-emerald-500 to-emerald-600 shadow-[0_5px_14px_rgba(5,150,105,0.30),inset_0_1px_1px_rgba(255,255,255,0.48)]"
              animate={{
                scaleX: isDragging ? 1.16 : 1,
                scaleY: isDragging ? 0.94 : 1,
              }}
              transition={reduceMotion ? { duration: 0.01 } : { type: 'spring', stiffness: 420, damping: 19 }}
            />
            <motion.span
              className="absolute -right-1 top-[8px] h-5 w-5 rounded-full bg-emerald-500 shadow-[0_2px_8px_rgba(5,150,105,0.22)]"
              animate={{
                x: isDragging ? -5 : -1,
                scale: isDragging ? 0.9 : 0.78,
                opacity: isDragging ? 1 : 0.82,
              }}
              transition={reduceMotion ? { duration: 0.01 } : { type: 'spring', stiffness: 360, damping: 18 }}
            />
            <motion.span
              className="absolute -left-1 bottom-[7px] h-3.5 w-3.5 rounded-full bg-emerald-400"
              animate={{
                x: isDragging ? 4 : 0,
                scale: isDragging ? 0.9 : 0.65,
                opacity: isDragging ? 0.95 : 0.7,
              }}
              transition={reduceMotion ? { duration: 0.01 } : { type: 'spring', stiffness: 320, damping: 20 }}
            />
          </motion.div>

          {navItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = currentArea === item.id;
            const isPreview = visualIndex === index;
            const label = (t[item.labelKey as keyof typeof t] as string) || item.labelKey;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleTabClick(item.id)}
                aria-current={isActive ? 'page' : undefined}
                aria-label={label}
                className={`relative z-10 flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-0.5 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-inset ${
                  isActive ? 'text-emerald-800' : 'text-slate-500 hover:text-emerald-700'
                }`}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <motion.span
                  className="relative flex h-7 w-8 items-center justify-center"
                  animate={{
                    y: isActive ? -1.5 : 0,
                    scale: isActive ? 1.08 : 1,
                  }}
                  whileTap={reduceMotion ? undefined : { scale: 0.9 }}
                  transition={reduceMotion ? { duration: 0.01 } : { type: 'spring', stiffness: 440, damping: 22 }}
                >
                  <Icon
                    className={`h-[21px] w-[21px] transition-colors duration-200 ${
                      isActive ? 'stroke-[2.7]' : 'stroke-[2.1] opacity-80'
                    }`}
                  />
                  {item.badgeCount && item.badgeCount > 0 ? (
                    <motion.span
                      key={item.badgeCount}
                      initial={reduceMotion ? false : { scale: 0, y: 3 }}
                      animate={{ scale: 1, y: 0 }}
                      transition={reduceMotion ? { duration: 0.01 } : { type: 'spring', stiffness: 520, damping: 17 }}
                      className={`absolute -right-2 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[9px] font-black leading-none shadow-sm ring-2 ring-white ${
                        item.badgeColor || 'bg-emerald-600 text-white'
                      }`}
                    >
                      {item.badgeCount > 99 ? '99+' : item.badgeCount}
                    </motion.span>
                  ) : null}
                </motion.span>

                <motion.span
                  className="max-w-full truncate text-[9px] font-extrabold uppercase leading-none tracking-[0.12em]"
                  animate={{
                    opacity: isActive || isPreview ? 1 : 0.78,
                    y: isActive ? 0 : 1,
                  }}
                  transition={{ duration: reduceMotion ? 0.01 : 0.18 }}
                >
                  {label}
                </motion.span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
