/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
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

  const navItems: {
    id: MainNavArea;
    labelKey: string;
    icon: React.ComponentType<{ className?: string }>;
    badgeCount?: number;
    badgeColor?: string;
  }[] = [
    {
      id: 'finance',
      labelKey: 'navHome',
      icon: Wallet,
    },
    {
      id: 'planejar',
      labelKey: 'navPlan',
      icon: Calendar,
      badgeCount: overdueBillsCount,
      badgeColor: 'bg-rose-500 text-white animate-pulse',
    },
    {
      id: 'report',
      labelKey: 'navInsights',
      icon: PieChart,
    },
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
      badgeColor: 'bg-blue-500 text-white',
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
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/85 backdrop-blur-2xl border-t border-white/90 shadow-xl transition-all print:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="max-w-xl mx-auto px-2 h-18 flex items-center justify-between gap-1 relative">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentArea === item.id;
          const label = (t[item.labelKey as keyof typeof t] as string) || item.labelKey;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleTabClick(item.id)}
              className={`flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all duration-300 cursor-pointer relative group ${
                isActive
                  ? 'text-emerald-700 font-black'
                  : 'text-slate-500 hover:text-slate-900 font-bold'
              }`}
            >
              {/* Active Pill Indicator Glow */}
              {isActive && (
                <motion.span 
                  layoutId="bottom-nav-pill"
                  className="absolute inset-x-2 inset-y-2 rounded-2xl bg-emerald-500/10 -z-10 shadow-xs border border-emerald-500/20"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                />
              )}

              {/* Icon Container with optional Badge */}
              <div className="relative flex items-center justify-center mb-1">
                <Icon
                  className={`w-6 h-6 transition-transform duration-300 ${
                    isActive ? 'scale-110' : 'opacity-80 group-hover:scale-105'
                  }`}
                />

                {/* Badge Indicator */}
                {item.badgeCount && item.badgeCount > 0 ? (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className={`absolute -top-1 -right-2 px-1.5 py-0.5 min-w-[1.25rem] h-5 rounded-full text-[10px] font-black leading-none flex items-center justify-center shadow-md ring-2 ring-white ${
                      item.badgeColor || 'bg-emerald-600 text-white'
                    }`}
                  >
                    {item.badgeCount > 99 ? '99+' : item.badgeCount}
                  </motion.span>
                ) : null}
              </div>

              {/* Caption Label */}
              <span className="text-[9px] font-black uppercase tracking-[0.2em] truncate max-w-full leading-none">
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
