import React from 'react';
import { ChallengeGoal, LanguageCode } from '../types';
import { useAuth } from '../context/AuthContext';
import { getTranslations } from '../utils/i18n';
import { SyncStatusBadge } from './SyncStatusBadge';
import { PWAInstallButton } from './PWAInstallButton';
import { SisFinzPet } from './shared/SisFinzPet';
import {
  Menu,
  Plus,
} from 'lucide-react';

interface NavbarProps {
  onOpenMenu: () => void;
  currentView: 'finance' | 'planejar' | 'goals' | 'savings' | 'categories' | 'report' | 'shared_accounts' | 'challenge_52' | 'full_report' | 'accounts' | 'financial_calendar' | 'freedom' | 'daily_pace';
  goals: ChallengeGoal[];
  activeGoal: ChallengeGoal | null;
  language?: LanguageCode;
  onOpenNewGoalModal: () => void;
  hasPendingNotifications?: boolean;
  onOpenProfile: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenMenu,
  currentView,
  goals,
  language = 'pt',
  onOpenNewGoalModal,
  hasPendingNotifications = false,
  onOpenProfile,
}) => {
  const { user } = useAuth();
  const t = getTranslations(language);

  const userName = user?.displayName || user?.email?.split('@')[0];

  const userInitial =
    user?.displayName?.charAt(0).toUpperCase() ||
    user?.email?.charAt(0).toUpperCase() ||
    'U';

  return (
    <header className="sticky top-0 z-30 glass-navigation border-b transition-colors shadow-2xs print:hidden pt-safe">
      <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-6 h-14 flex items-center justify-between gap-3">
        {/* Left Side: 3-Bars Hamburger Button + SisFinz Logo + Brand Name + Sync Status Badge */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 min-w-0">
          {/* Hamburger 3-Bars Button */}
          <button
            type="button"
            onClick={onOpenMenu}
            className="relative p-2 rounded-xl text-slate-800 bg-white/80 hover:bg-white border border-slate-200/80 active:scale-95 transition-all cursor-pointer flex items-center justify-center focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 shadow-xs"
            title={language === 'es' ? 'Menú principal (3 barritas)' : language === 'en' ? 'Main menu (3 bars)' : 'Menu principal (3 barras)'}
            aria-label={language === 'es' ? 'Abrir menú principal' : 'Abrir menu principal'}
          >
            <Menu className="w-5 h-5 text-slate-800" />
            {hasPendingNotifications && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white animate-pulse" />
            )}
          </button>

          {/* Logo & Brand Name */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-xl overflow-hidden shadow-xs border border-slate-200/80 shrink-0">
              <img
                src="/assets/aistudio/image_89b2520a.jpeg"
                alt="SisFinz Logo"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex flex-col justify-center min-w-0">
              <span className="font-black text-sm sm:text-base leading-tight tracking-tight bg-gradient-to-r from-emerald-800 via-teal-700 to-emerald-600 bg-clip-text text-transparent">
                SisFinz
              </span>
              {userName && (
                <span className="text-[11px] leading-tight text-slate-600 truncate max-w-[9rem] sm:max-w-xs font-medium">
                  {t.welcomeGreeting}, {userName}
                </span>
              )}
            </div>
          </div>

          {/* Discreet Sync Status Badge */}
          <SyncStatusBadge language={language} />
        </div>

        {/* Right Side: Quick Tools (PWA Install, New Goal Shortcut, Finzy Mascot / Profile Button) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* PWA Install Button (auto-hides when already running standalone) */}
          <PWAInstallButton language={language} variant="compact" />

          {/* Quick Add Goal button (visible on goals view or desktop) */}
          {currentView === 'goals' && (
            <button
              type="button"
              onClick={onOpenNewGoalModal}
              className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 rounded-xl shadow-xs transition-colors whitespace-nowrap cursor-pointer"
              title={t.addGoalBtn}
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.addGoalBtn}</span>
              <span className="sm:hidden">{t.addGoalBtnShort}</span>
            </button>
          )}

          {/* Finzy Virtual Pet (Independent AI Mascot) */}
          <SisFinzPet size={56} />
        </div>
      </div>
    </header>
  );
};
