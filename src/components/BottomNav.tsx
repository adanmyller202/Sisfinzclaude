/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { LanguageCode } from '../types';
import { getTranslations } from '../utils/i18n';
import { Wallet, Calendar, PieChart, Target, Landmark } from 'lucide-react';

export type MainNavArea = 'finance' | 'planejar' | 'report' | 'goals' | 'accounts';

interface BottomNavProps {
  currentArea: MainNavArea;
  onChangeArea: (area: MainNavArea) => void;
  language?: LanguageCode;
  overdueBillsCount?: number;
  goalsMilestoneCount?: number;
  accountsAlertCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentArea,
  onChangeArea,
  language = 'pt',
  overdueBillsCount = 0,
  goalsMilestoneCount = 0,
  accountsAlertCount = 0,
}) => {
  const t = getTranslations(language);
  const reduceMotion = useReducedMotion();
  const [reTapPulse, setReTapPulse] = useState(0);

  const navItems: {
    id: MainNavArea;
    labelKey: string;
    icon: React.ComponentType<{ className?: string }>;
    badgeCount?: number;
    badgeColor?: string;
  }[] = [
    { id: 'finance', labelKey: 'navHome', icon: Wallet },
    { id: 'planejar', labelKey: 'navPlan', icon: Calendar, badgeCount: overdueBillsCount, badgeColor: 'bg-rose-500 text-white' },
    { id: 'report', labelKey: 'navInsights', icon: PieChart },
    { id: 'goals', labelKey: 'navGoals', icon: Target, badgeCount: goalsMilestoneCount, badgeColor: 'bg-amber-500 text-white' },
    { id: 'accounts', labelKey: 'navAccounts', icon: Landmark, badgeCount: accountsAlertCount, badgeColor: 'bg-emerald-600 text-white' },
  ];

  const activeIndex = Math.max(0, navItems.findIndex((item) => item.id === currentArea));

  const orbSpring = reduceMotion
    ? { duration: 0.01 }
    : { type: 'spring' as const, stiffness: 410, damping: 26, mass: 0.78 };

  const neighborSpring = reduceMotion
    ? { duration: 0.01 }
    : { type: 'spring' as const, stiffness: 360, damping: 22, mass: 0.7 };

  const handleTabClick = (area: MainNavArea) => {
    if (area === currentArea) {
      setReTapPulse((v) => v + 1);
      const reset = () => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
      };
      reset();
      requestAnimationFrame(reset);
    } else {
      onChangeArea(area);
    }
  };

  return (
    <nav
      role="navigation"
      aria-label={t.financialControl}
      className="sisfinz-bottom-nav-shell fixed bottom-0 left-0 right-0 z-40 print:hidden"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <div className="mx-auto max-w-xl px-3 pb-0">
        <div className="sisfinz-bottom-nav-height relative h-[calc(78px+min(env(safe-area-inset-bottom,0px),12px))] overflow-visible">
          {/* Compact dock surface with subtle glass rim */}
          <div className="absolute inset-x-0 bottom-0 top-[18px] rounded-t-[28px] rounded-b-[20px] border border-emerald-100/95 bg-white/95 backdrop-blur-md shadow-[0_12px_34px_rgba(5,150,105,0.13),0_3px_10px_rgba(15,23,42,0.05),inset_0_1px_0_rgba(255,255,255,0.98)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_12px_34px_rgba(0,0,0,0.35)]" />

          <div className="absolute inset-x-1 top-[18px] bottom-[min(env(safe-area-inset-bottom,0px),10px)] grid grid-cols-5">
            {navItems.map((item, idx) => {
              const Icon = item.icon;
              const isActive = currentArea === item.id;
              const label = (t[item.labelKey as keyof typeof t] as string) || item.labelKey;

              // Magnetic neighbor displacement: icons right beside the active orb
              // gently lean and part away to make room for the traveling orb.
              const delta = idx - activeIndex;
              const absDelta = Math.abs(delta);
              const neighborX = reduceMotion
                ? 0
                : absDelta === 1
                ? delta > 0
                  ? 5.5
                  : -5.5
                : absDelta === 2
                ? delta > 0
                  ? 2
                  : -2
                : 0;
              const neighborRotate = reduceMotion
                ? 0
                : absDelta === 1
                ? delta > 0
                  ? 8
                  : -8
                : absDelta === 2
                ? delta > 0
                  ? 2.5
                  : -2.5
                : 0;
              const neighborScale = reduceMotion ? 1 : absDelta === 1 ? 0.94 : 1;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleTabClick(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={label}
                  className={`relative flex h-full min-w-0 flex-col items-center justify-end rounded-full pb-[8px] pt-0 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-inset cursor-pointer ${
                    isActive
                      ? 'text-emerald-800 dark:text-emerald-300'
                      : 'text-slate-500 hover:text-emerald-700 dark:text-slate-400 dark:hover:text-emerald-300'
                  }`}
                >
                  {isActive && (
                    <>
                      {/* Page-colored notch disc */}
                      <motion.span
                        layoutId="sisfinz-nav-notch"
                        className="pointer-events-none absolute left-1/2 top-[-24px] z-0 h-[68px] w-[68px] -translate-x-1/2 rounded-full bg-[#F4F8F6] dark:bg-[#020617]"
                        transition={orbSpring}
                      />

                      {/* Soft theme-colored ambient halo under the floating orb */}
                      <motion.span
                        layoutId="sisfinz-nav-halo"
                        className="pointer-events-none absolute left-1/2 top-[-12px] z-10 h-[44px] w-[54px] -translate-x-1/2 rounded-full bg-emerald-400/35 blur-md"
                        transition={orbSpring}
                      />

                      {/* Floating magnetic orb with shimmer & arrival ripple */}
                      <motion.span
                        layoutId="sisfinz-nav-floating-orb"
                        className="absolute left-1/2 top-[-18px] z-20 flex h-[54px] w-[54px] -translate-x-1/2 items-center justify-center overflow-hidden rounded-full border-[4px] border-[#F4F8F6] bg-gradient-to-br from-white via-emerald-50 to-emerald-200 text-emerald-700 shadow-[0_8px_20px_rgba(5,150,105,0.26),inset_0_2px_3px_rgba(255,255,255,0.98)] dark:border-[#020617] dark:from-emerald-100 dark:via-emerald-200 dark:to-emerald-400 dark:text-emerald-950"
                        transition={orbSpring}
                      >
                        {!reduceMotion && (
                          <motion.span
                            key={`orb-shimmer-${item.id}-${reTapPulse}`}
                            initial={{ x: '-135%', opacity: 0.85 }}
                            animate={{ x: '220%', opacity: 0 }}
                            transition={{ duration: 0.65, ease: 'easeOut' }}
                            className="pointer-events-none absolute inset-y-0 left-0 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/70 to-transparent"
                          />
                        )}
                        <motion.span
                          key={`orb-icon-${item.id}-${reTapPulse}`}
                          initial={reduceMotion ? false : { scale: 0.72, y: 4, rotate: -10 }}
                          animate={{ scale: 1, y: 0, rotate: 0 }}
                          transition={{ type: 'spring', stiffness: 520, damping: 20 }}
                          className="relative z-10 flex items-center justify-center"
                        >
                          <Icon className="h-[22px] w-[22px] stroke-[2.55]" />
                        </motion.span>
                      </motion.span>

                      {/* Luminous curved indicator sliding along the dock bottom edge */}
                      <motion.span
                        layoutId="sisfinz-nav-rim-glow"
                        className="pointer-events-none absolute bottom-[1px] left-1/2 z-20 h-[3px] w-7 -translate-x-1/2 rounded-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.65)]"
                        transition={orbSpring}
                      />
                    </>
                  )}

                  {!isActive && (
                    <motion.span
                      animate={{
                        x: neighborX,
                        rotate: neighborRotate,
                        scale: neighborScale,
                      }}
                      whileTap={reduceMotion ? undefined : { scale: 0.86 }}
                      transition={neighborSpring}
                      className="relative mb-[4px] flex h-6 w-8 items-center justify-center"
                    >
                      <Icon className="h-[20px] w-[20px] stroke-[2.05] opacity-85" />
                    </motion.span>
                  )}

                  {item.badgeCount && item.badgeCount > 0 ? (
                    <motion.span
                      key={item.badgeCount}
                      initial={reduceMotion ? false : { scale: 0 }}
                      animate={{ scale: 1, x: isActive ? 0 : neighborX * 0.5 }}
                      transition={orbSpring}
                      className={`absolute right-[calc(50%-19px)] top-[1px] z-30 flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[9px] font-black leading-none shadow-sm ring-2 ring-white dark:ring-slate-900 ${
                        item.badgeColor || 'bg-emerald-600 text-white'
                      }`}
                    >
                      {item.badgeCount > 99 ? '99+' : item.badgeCount}
                    </motion.span>
                  ) : null}

                  <motion.span
                    className={`relative z-10 max-w-full truncate text-[9px] font-extrabold uppercase leading-none tracking-[0.09em] ${
                      isActive ? 'mt-[30px]' : ''
                    }`}
                    animate={{
                      opacity: isActive ? 1 : absDelta === 1 ? 0.68 : 0.78,
                      scale: isActive ? 1.03 : 0.95,
                      x: isActive ? 0 : neighborX * 0.35,
                    }}
                    transition={neighborSpring}
                  >
                    {label}
                  </motion.span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
};
