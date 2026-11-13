/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
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

  const spring = reduceMotion
    ? { duration: 0.01 }
    : { type: 'spring' as const, stiffness: 430, damping: 28, mass: 0.72 };

  const handleTabClick = (area: MainNavArea) => {
    if (area === currentArea) {
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
      className="fixed bottom-0 left-0 right-0 z-40 print:hidden"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <div className="mx-auto max-w-xl px-3 pb-0">
        <div className="relative h-[calc(90px+env(safe-area-inset-bottom,0px))] overflow-visible">
          {/* Dock surface reaches the physical screen edge; controls stay above the iPhone home-indicator safe area. */}
          <div className="absolute inset-x-0 bottom-0 top-[22px] rounded-[32px] border border-emerald-100 bg-white shadow-[0_12px_34px_rgba(5,150,105,0.13),0_3px_10px_rgba(15,23,42,0.05),inset_0_1px_0_rgba(255,255,255,0.98)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_12px_34px_rgba(0,0,0,0.35)]" />

          <div className="absolute inset-x-1 top-[22px] bottom-[env(safe-area-inset-bottom,0px)] grid grid-cols-5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentArea === item.id;
              const label = (t[item.labelKey as keyof typeof t] as string) || item.labelKey;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleTabClick(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={label}
                  className={`relative flex h-full min-w-0 flex-col items-center justify-end rounded-full pb-[10px] pt-0 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-inset ${
                    isActive ? 'text-emerald-800 dark:text-emerald-300' : 'text-slate-500 hover:text-emerald-700 dark:text-slate-400 dark:hover:text-emerald-300'
                  }`}
                >
                  {isActive && (
                    <>
                      <motion.span
                        layoutId="sisfinz-nav-notch"
                        className="pointer-events-none absolute left-1/2 top-[-27px] z-0 h-[74px] w-[74px] -translate-x-1/2 rounded-full bg-[#F4F8F6] dark:bg-[#020617]"
                        transition={spring}
                      />
                      <motion.span
                        layoutId="sisfinz-nav-floating-orb"
                        className="absolute left-1/2 top-[-20px] z-20 flex h-[58px] w-[58px] -translate-x-1/2 items-center justify-center rounded-full border-[4px] border-[#F4F8F6] bg-gradient-to-br from-white via-[#E6F4EA] to-[#B9F2D5] text-emerald-700 shadow-[0_7px_17px_rgba(5,150,105,0.24),inset_0_2px_3px_rgba(255,255,255,0.98)] dark:border-[#020617] dark:from-emerald-100 dark:via-emerald-200 dark:to-emerald-400 dark:text-emerald-950"
                        transition={spring}
                      >
                        <Icon className="h-[23px] w-[23px] stroke-[2.55]" />
                      </motion.span>
                    </>
                  )}

                  {!isActive && (
                    <span className="relative mb-[5px] flex h-7 w-8 items-center justify-center">
                      <Icon className="h-[21px] w-[21px] stroke-[2.05] opacity-85" />
                    </span>
                  )}

                  {item.badgeCount && item.badgeCount > 0 ? (
                    <motion.span
                      key={item.badgeCount}
                      initial={reduceMotion ? false : { scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={spring}
                      className={`absolute right-[calc(50%-19px)] top-[1px] z-30 flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[9px] font-black leading-none shadow-sm ring-2 ring-white dark:ring-slate-900 ${
                        item.badgeColor || 'bg-emerald-600 text-white'
                      }`}
                    >
                      {item.badgeCount > 99 ? '99+' : item.badgeCount}
                    </motion.span>
                  ) : null}

                  <motion.span
                    className={`relative z-10 max-w-full truncate text-[9px] font-extrabold uppercase leading-none tracking-[0.09em] ${
                      isActive ? 'mt-[34px]' : ''
                    }`}
                    animate={{ opacity: isActive ? 1 : 0.76, scale: isActive ? 1 : 0.96 }}
                    transition={{ duration: reduceMotion ? 0.01 : 0.18 }}
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
