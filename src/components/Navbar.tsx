import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Menu,
  Calendar,
  TrendingUp,
  Award,
  Sparkles,
  CheckSquare,
} from 'lucide-react';
import { ChallengeGoal, LanguageCode } from '../types';
import { getTranslations } from '../utils/i18n';
import { getCurrentMonthStr, formatMonthName } from '../utils/finance';
import { FinzyMascot } from './FinzyMascot';
import { FinzyLivingModal } from './FinzyLivingModal';
import {
  computeFinzyLivingContext,
  getSavedFinzySkinId,
  loadCachedLaborJobsForFinzy,
} from '../utils/finzyLiving';
import { useFinanceControl } from '../hooks/useFinanceControl';
import { useSharedAccounts } from '../hooks/useSharedAccounts';
import { getMoneMood } from '../utils/moneMood';

interface NavbarProps {
  onOpenMenu: () => void;
  currentView: string;
  goals: ChallengeGoal[];
  activeGoal: ChallengeGoal | null;
  language?: LanguageCode;
  onOpenNewGoalModal: () => void;
  onOpenProfile: () => void;
  onOpenChecklist?: () => void;
  onOpenFinzyChat?: () => void;
  hasPendingNotifications?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenMenu,
  currentView,
  activeGoal,
  language = 'pt',
  onOpenProfile,
  onOpenChecklist,
  onOpenFinzyChat,
  hasPendingNotifications = false,
}) => {
  const t = getTranslations(language) as Record<string, string>;
  const currentMonthStr = getCurrentMonthStr();
  const [skinId, setSkinId] = useState<string>(() => getSavedFinzySkinId());
  const [isLivingModalOpen, setIsLivingModalOpen] = useState(false);
  const [jobsCache, setJobsCache] = useState(() => loadCachedLaborJobsForFinzy());

  useEffect(() => {
    const syncSkin = () => setSkinId(getSavedFinzySkinId());
    const syncJobs = () => setJobsCache(loadCachedLaborJobsForFinzy());
    window.addEventListener('sisfinz-finzy-skin-change', syncSkin);
    window.addEventListener('storage', syncJobs);
    const interval = window.setInterval(syncJobs, 2500);
    return () => {
      window.removeEventListener('sisfinz-finzy-skin-change', syncSkin);
      window.removeEventListener('storage', syncJobs);
      window.clearInterval(interval);
    };
  }, []);

  const sharedAccounts = useSharedAccounts();
  const { bills, incomes, expenses, monthBills, currentBalance, forecastBalance } =
    useFinanceControl(sharedAccounts.sharedBills);

  const overdueBillsCount = useMemo(
    () => (monthBills || []).filter((b) => b.status === 'overdue').length,
    [monthBills]
  );
  const hasFinanceData = bills.length > 0 || expenses.length > 0 || incomes.length > 0;
  const moodObj = useMemo(
    () =>
      getMoneMood({
        forecastBalance,
        currentBalance,
        overdueCount: overdueBillsCount,
        hasData: hasFinanceData,
      }),
    [forecastBalance, currentBalance, overdueBillsCount, hasFinanceData]
  );
  const moodLabel = (t[moodObj.moodLabelKey] as string) || '';

  const living = useMemo(
    () => computeFinzyLivingContext(jobsCache, language, new Date()),
    [jobsCache, language]
  );

  const viewHeaderInfo = useMemo(() => {
    switch (currentView) {
      case 'planejar':
        return {
          title: t.navPlan,
          subtitle: t.navPlan,
          icon: Calendar,
        };
      case 'goals':
        return {
          title: activeGoal ? activeGoal.title : t.goalsCenterTitle,
          subtitle: activeGoal ? t.goalsCenterTitle : t.goalsCenterTitle,
          icon: Award,
        };
      case 'report':
        return {
          title: t.fullReportTitle,
          subtitle: t.fullReportSubtitle,
          icon: TrendingUp,
        };
      case 'finance':
      default:
        return {
          title: 'SisFinz',
          subtitle: formatMonthName(currentMonthStr),
          icon: TrendingUp,
        };
    }
  }, [currentView, activeGoal, t, currentMonthStr]);

  const HeaderIcon = viewHeaderInfo.icon;

  return (
    <>
      <header className="sticky top-0 z-30 glass border-b border-emerald-100/80 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2">
          {/* Left: Hamburger Menu + Brand */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={onOpenMenu}
              className="relative p-2.5 rounded-2xl text-emerald-800 hover:bg-emerald-50/80 transition-colors cursor-pointer shrink-0"
              aria-label={t.menu || 'Menu'}
            >
              <Menu className="w-5 h-5" />
              {hasPendingNotifications && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
              )}
            </motion.button>

            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-600/20 shrink-0 overflow-hidden">
                <Sparkles className="h-6 w-6 text-white" />
              </div>

              <div className="min-w-0">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentView}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.18 }}
                    className="flex items-center gap-1.5"
                  >
                    <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 truncate">
                      {viewHeaderInfo.title}
                    </h1>
                    {currentView !== 'finance' && (
                      <HeaderIcon className="w-4 h-4 text-emerald-600 shrink-0 hidden sm:block" />
                    )}
                  </motion.div>
                </AnimatePresence>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">
                  {viewHeaderInfo.subtitle}
                </p>
              </div>
            </div>
          </div>

          {/* Right: Compact Franco Pill + Checklist + Finzy Vivo Mascot + Profile */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {living.franco.hasJob && (
              <button
                type="button"
                onClick={() => setIsLivingModalOpen(true)}
                className={`hidden sm:inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black transition-all cursor-pointer ${
                  living.franco.isFrancoToday
                    ? 'border-purple-300 bg-purple-50 text-purple-900'
                    : living.franco.isLongStreakWarning
                    ? 'border-amber-300 bg-amber-50 text-amber-900'
                    : 'border-emerald-200 bg-emerald-50/70 text-emerald-900 hover:bg-emerald-100/70'
                }`}
                title={language === 'es' ? living.franco.statusHeadlineEs : living.franco.statusHeadlinePt}
              >
                <Sparkles className="h-3 w-3 text-emerald-600" />
                <span>
                  {living.franco.isFrancoToday
                    ? language === 'es'
                      ? 'Franco hoy'
                      : 'Franco hoje'
                    : `${living.franco.daysUntilFranco}d ${
                        language === 'es' ? 'p/ Franco' : 'p/ Franco'
                      }`}
                </span>
              </button>
            )}

            {onOpenChecklist && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.94 }}
                type="button"
                onClick={onOpenChecklist}
                className="p-2 rounded-2xl border border-emerald-200/80 bg-white/80 text-emerald-800 hover:bg-emerald-50 transition-colors cursor-pointer"
                title={language === 'es' ? 'Checklists reutilizables' : 'Checklists reutilizáveis'}
                aria-label="Checklists"
              >
                <CheckSquare className="w-4 h-4" />
              </motion.button>
            )}

            {/* Finzy Vivo Mascot Button */}
            <motion.button
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              type="button"
              onClick={() => setIsLivingModalOpen(true)}
              className="relative flex items-center justify-center rounded-2xl p-0.5 hover:bg-emerald-50/80 transition-colors cursor-pointer"
              title={`Finzy • ${
                language === 'es' ? living.reactionTitleEs : living.reactionTitlePt
              }`}
              aria-label="Finzy Vivo"
            >
              <FinzyMascot
                mood={moodObj.mood}
                routineState={living.routineState}
                skinId={skinId}
                size={38}
              />
            </motion.button>

          </div>
        </div>
      </header>

      <FinzyLivingModal
        isOpen={isLivingModalOpen}
        onClose={() => setIsLivingModalOpen(false)}
        mood={moodObj.mood}
        moodLabel={moodLabel}
        living={living}
        language={language}
        onOpenChat={() => {
          if (onOpenFinzyChat) onOpenFinzyChat();
        }}
      />
    </>
  );
};
