/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
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
    {
      id: 'planejar',
      labelKey: 'navPlan',
      icon: Calendar,
      badgeCount: overdueBillsCount,
      badgeColor: 'bg-rose-500 text-white',
    },
    { id: 'report', labelKey: 'navInsights', icon: PieChart },
    {
      id: 'goals',
      labelKey: 'navGoals',
      icon: Target,
      badgeCount: goalsMilestoneCount,
      badgeColor: 'bg-amber-500 text-white',
    },
    {
      id: 'accounts',
      labelKey: 'navAccounts',
      icon: Landmark,
      badgeCount: accountsAlertCount,
      badgeColor: 'bg-emerald-600 text-white',
    },
  ];

  const handleTabClick = (area: MainNavArea) => {
    if (area === currentArea) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      onChangeArea(area);
    }
  };

  return (
    <nav
      role="navigation"
      aria-label={t.financialControl}
      className="fixed bottom-0 left-0 right-0 z-40 print:hidden"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div className="mx-auto max-w-xl px-3 pb-2">
        <div className="relative flex h-[72px] items-center justify-between gap-1 overflow-hidden rounded-[27px] border border-emerald-100/90 bg-white/95 px-1.5 shadow-[0_10px_32px_rgba(5,150,105,0.12),0_2px_8px_rgba(15,23,42,0.045),inset_0_1px_0_rgba(255,255,255,0.98)] backdrop-blur-xl">
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
                className={`relative isolate flex h-[60px] min-w-0 flex-1 flex-col items-center justify-center gap-[5px] rounded-[21px] px-0.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-inset ${
                  isActive ? 'text-emerald-800' : 'text-slate-500 hover:text-emerald-700'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="sisfinz-active-nav-liquid"
                    className="absolute inset-x-0.5 inset-y-0 z-0 rounded-[20px] border border-emerald-300/65 bg-gradient-to-br from-emerald-50 via-[#E6F4EA] to-emerald-100/90 shadow-[0_3px_12px_rgba(5,150,105,0.11),inset_0_1px_0_rgba(255,255,255,0.95)]"
                    transition={reduceMotion ? { duration: 0.01 } : {
                      type: 'spring',
                      stiffness: 470,
                      damping: 32,
                      mass: 0.72,
                    }}
                  />
                )}

                <motion.span
                  className="relative z-10 flex h-7 w-8 items-center justify-center"
                  animate={{
                    y: isActive ? -1 : 0,
                    scale: isActive ? 1.09 : 1,
                  }}
                  whileTap={reduceMotion ? undefined : { scale: 0.88 }}
                  transition={reduceMotion ? { duration: 0.01 } : {
                    type: 'spring',
                    stiffness: 480,
                    damping: 21,
                  }}
                >
                  <Icon
                    className={`h-[21px] w-[21px] transition-colors duration-200 ${
                      isActive ? 'stroke-[2.65]' : 'stroke-[2.05] opacity-80'
                    }`}
                  />
                  {item.badgeCount && item.badgeCount > 0 ? (
                    <motion.span
                      key={item.badgeCount}
                      initial={reduceMotion ? false : { scale: 0, y: 3 }}
                      animate={{ scale: 1, y: 0 }}
                      transition={reduceMotion ? { duration: 0.01 } : {
                        type: 'spring',
                        stiffness: 520,
                        damping: 17,
                      }}
                      className={`absolute -right-2 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[9px] font-black leading-none shadow-sm ring-2 ring-white ${
                        item.badgeColor || 'bg-emerald-600 text-white'
                      }`}
                    >
                      {item.badgeCount > 99 ? '99+' : item.badgeCount}
                    </motion.span>
                  ) : null}
                </motion.span>

                <motion.span
                  className="relative z-10 max-w-full truncate text-[9px] font-extrabold uppercase leading-none tracking-[0.11em]"
                  animate={{
                    opacity: isActive ? 1 : 0.76,
                    y: isActive ? 0 : 0.5,
                    scale: isActive ? 1 : 0.96,
                  }}
                  transition={{ duration: reduceMotion ? 0.01 : 0.2 }}
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
