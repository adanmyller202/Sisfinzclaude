import React from 'react';
import { ChallengeGoal, CurrencyCode, LanguageCode } from '../types';
import { formatCurrency, getGoalSquares, getGoalSavedAmount } from '../utils/currency';
import { getTranslations } from '../utils/i18n';
import { useAuth } from '../context/AuthContext';
import {
  Plus,
  Target,
  Settings,
  Trash2,
  LogOut,
  User as UserIcon,
  Wallet,
  Bot,
  Sparkles,
  PiggyBank,
  Gauge,
} from 'lucide-react';

interface SidebarProps {
  goals: ChallengeGoal[];
  activeGoalId: string;
  currency: CurrencyCode;
  language?: LanguageCode;
  currentView?: 'finance' | 'goals' | 'savings' | 'daily_pace';
  onChangeView?: (view: 'finance' | 'goals' | 'savings' | 'daily_pace') => void;
  onSwitchGoal: (id: string) => void;
  onOpenNewGoalModal: () => void;
  onOpenSettingsModal: () => void;
  onOpenProfileModal: () => void;
  onOpenMoneChat: () => void;
  onDeleteGoal: (id: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  goals,
  activeGoalId,
  currency,
  language = 'pt',
  currentView = 'finance',
  onChangeView,
  onSwitchGoal,
  onOpenNewGoalModal,
  onOpenSettingsModal,
  onOpenProfileModal,
  onOpenMoneChat,
  onDeleteGoal,
}) => {
  const t = getTranslations(language);
  const { user, signOutUser } = useAuth();

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0 shrink-0 select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-200/60">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl overflow-hidden shadow-xs border border-slate-200/60 dark:border-slate-800 shrink-0">
            <img
              src="/assets/aistudio/image_89b2520a.jpeg"
              alt="SisFinz Logo"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-black tracking-tight leading-none truncate bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 dark:from-cyan-400 dark:via-teal-300 dark:to-emerald-400 bg-clip-text text-transparent">
              SisFinz
            </h1>
            <p className="text-[10px] text-slate-400 mt-1 truncate">
              {t.financialControl}
            </p>
          </div>
        </div>
      </div>

      {/* Main Navigation Modules */}
      <div className="p-2.5 border-b border-slate-100 dark:border-slate-800/80 space-y-1">
        <button
          type="button"
          onClick={() => onChangeView?.('finance')}
          className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            currentView === 'finance'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <Wallet className="w-3.5 h-3.5" />
          <span>{t.financialControl}</span>
        </button>

        <button
          type="button"
          onClick={() => onChangeView?.('savings')}
          className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            currentView === 'savings'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <PiggyBank className="w-3.5 h-3.5" />
          <span>{t.tabSavings}</span>
        </button>

        <button
          type="button"
          onClick={() => onChangeView?.('daily_pace')}
          className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            currentView === 'daily_pace'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <Gauge className="w-3.5 h-3.5" />
          <span>{language === 'es' ? 'Ritmo Diario' : 'Ritmo Diário'}</span>
        </button>

        <button
          type="button"
          onClick={onOpenMoneChat}
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/70 border border-emerald-200/80 dark:border-emerald-800/80 transition-all cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Bot className="w-3.5 h-3.5 text-emerald-600" />
            <span>{t.moneAssistant}</span>
          </span>
          <Sparkles className="w-3 h-3 text-amber-500 animate-pulse" />
        </button>

        <button
          type="button"
          onClick={onOpenSettingsModal}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all cursor-pointer"
        >
          <Settings className="w-3.5 h-3.5 text-slate-500" />
          <span>{t.settings}</span>
        </button>

        <button
          type="button"
          onClick={onOpenProfileModal}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all cursor-pointer"
        >
          <UserIcon className="w-3.5 h-3.5 text-slate-500" />
          <span>{t.profile}</span>
        </button>
      </div>

      {/* Objectives Section - Compact with Adicionar objetivo */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <div className="flex items-center justify-between px-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {t.myGoals} ({goals.length})
          </span>
          <button
            type="button"
            onClick={onOpenNewGoalModal}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            {t.addGoalBtn}
          </button>
        </div>

        {goals.length === 0 ? (
          <div className="p-3 text-center border border-dashed border-slate-200 rounded-xl space-y-1.5">
            <Target className="w-5 h-5 mx-auto text-emerald-500/70" />
            <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              {t.noGoalsActive}
            </p>
            <button
              type="button"
              onClick={onOpenNewGoalModal}
              className="mt-1 inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>{t.addGoalBtn}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            {goals.map((goal) => {
              const goalCur = goal.currency || currency;
              const isActive = goal.id === activeGoalId;
              const saved = getGoalSavedAmount(goal);
              const percent = goal.totalTarget > 0 ? (saved / goal.totalTarget) * 100 : 0;
              const squaresCount = goal.totalSquares || getGoalSquares(goal).length;
              const isCompleted = goal.completedSquares.length >= squaresCount && squaresCount > 0;

              return (
                <div
                  key={goal.id}
                  onClick={() => onSwitchGoal(goal.id)}
                  className={`group relative p-2.5 rounded-xl border transition-all cursor-pointer ${
                    isActive
                      ? 'bg-emerald-50/70 border-emerald-300 shadow-xs'
                      : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base shrink-0 p-1 bg-white rounded-md shadow-xs border border-slate-200/60">
                        {goal.icon}
                      </span>
                      <div className="min-w-0">
                        <h4
                          className={`text-xs font-bold truncate ${
                            isActive
                              ? 'text-emerald-900 dark:text-emerald-200'
                              : 'text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {goal.title}
                        </h4>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono-numbers truncate">
                          {formatCurrency(saved, goalCur)} / {formatCurrency(goal.totalTarget, goalCur)}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`${t.deleteConfirmGoal} "${goal.title}"?`)) {
                          onDeleteGoal(goal.id);
                        }
                      }}
                      className="p-1 rounded text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      title={t.deleteItem}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="mt-1.5">
                    <div className="h-1 w-full bg-[#D1FAEB]/80 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isCompleted ? 'bg-emerald-500' : 'bg-emerald-500/80'
                        }`}
                        style={{ width: `${Math.min(100, percent)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Profile footer item */}
      {user && (
        <div className="p-3 border-t border-slate-100 dark:border-slate-800">
          <div
            onClick={onOpenProfileModal}
            className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center text-xs shrink-0">
                {user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                  {user.displayName || t.profile}
                </p>
                <p className="text-[10px] text-slate-400 truncate">
                  {user.email}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                signOutUser();
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer shrink-0"
              title={t.logout}
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};
