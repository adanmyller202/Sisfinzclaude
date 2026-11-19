import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CurrencyCode,
  LanguageCode,
  BillItem,
  IncomeItem,
  ExpenseItem,
  SharedBill,
  MonthlyStatusRecord,
} from '../types';
import { formatCurrency } from '../utils/currency';
import {
  getCurrentMonthStr,
  shiftMonthStr,
  doesItemOccurInMonth,
} from '../utils/finance';
import { getLocaleForLanguage } from '../utils/i18n';
import { MonthlyFreedomScale } from './MonthlyFreedomScale';
import { FinancialCalendarView } from './FinancialCalendarView';
import {
  Calendar,
  BarChart3,
  Scale,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';

interface PlanningViewProps {
  currency: CurrencyCode;
  language?: LanguageCode;
  bills: BillItem[];
  incomes: IncomeItem[];
  expenses: ExpenseItem[];
  sharedBills?: SharedBill[];
  statusRecords?: MonthlyStatusRecord[];
  currentBalance?: number;
  forecastBalance?: number;
  onOpenMoneChat?: () => void;
  onOpenNewTransaction?: (type: 'bill' | 'income' | 'expense') => void;
  overdueBillsCount?: number;
  onNavigateToFinance?: (
    tab: 'timeline' | 'bills' | 'upcoming' | 'incomes' | 'expenses' | 'categories' | 'savings' | 'report' | 'calendar' | 'freedom',
    options?: {
      billFilter?: 'all' | 'pending' | 'paid' | 'overdue';
      incomeFilter?: 'all' | 'pending' | 'received';
      month?: string;
    }
  ) => void;
}

export const PlanningView: React.FC<PlanningViewProps> = ({
  currency,
  language = 'pt',
  bills = [],
  incomes = [],
  expenses = [],
  sharedBills = [],
  statusRecords = [],
  currentBalance = 0,
  forecastBalance = currentBalance,
  onOpenMoneChat,
  overdueBillsCount = 0,
  onNavigateToFinance,
}) => {
  const locale = getLocaleForLanguage(language);
  const [subTab, setSubTab] = useState<'projections' | 'calendar' | 'freedom'>('projections');
  const currentMonth = getCurrentMonthStr();

  const handleSubTabChange = (nextTab: typeof subTab) => {
    const reset = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
    };
    reset();
    setSubTab(nextTab);
    requestAnimationFrame(reset);
  };

  const monthlyProjections = useMemo(() => {
    const list = [];
    for (let i = 0; i < 12; i++) {
      const monthStr = shiftMonthStr(currentMonth, i);
      const dateObj = new Date(parseInt(monthStr.split('-')[0]), parseInt(monthStr.split('-')[1]) - 1, 1);
      const monthTitle = dateObj.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
      const monthShort = dateObj
        .toLocaleDateString(locale, { month: 'short' })
        .replace('.', '')
        .slice(0, 3)
        .toUpperCase();

      let sumIncomes = 0;
      incomes.forEach(inc => {
        if (doesItemOccurInMonth(inc.startMonth, monthStr, inc.recurrence, inc.recurrenceMonthsCount)) {
          const exc = inc.exceptions?.[monthStr];
          if (!exc?.isDeleted && !inc.excludedMonths?.includes(monthStr)) sumIncomes += exc?.amount ?? inc.amount;
        }
      });

      let sumExpenses = 0;
      bills.forEach(b => {
        if (doesItemOccurInMonth(b.startMonth, monthStr, b.recurrence, b.recurrenceMonthsCount)) {
          const exc = b.exceptions?.[monthStr];
          if (!exc?.isDeleted && !b.excludedMonths?.includes(monthStr)) sumExpenses += exc?.amount ?? b.amount;
        }
      });

      sharedBills.forEach(sb => {
        const start = sb.startMonth || sb.month || (sb.dueDate ? sb.dueDate.substring(0, 7) : '');
        if (doesItemOccurInMonth(start, monthStr, sb.recurrence || 'none', sb.recurrenceMonthsCount)) {
          const exc = sb.exceptions?.[monthStr];
          if (!exc?.isDeleted && !sb.excludedMonths?.includes(monthStr)) sumExpenses += sb.shares ? Object.values(sb.shares)[0]?.amount || sb.amount / 2 : sb.amount / 2;
        }
      });

      expenses.filter(e => e.date?.startsWith(monthStr)).forEach(e => sumExpenses += e.amount);

      // Show only this month's net projection. Do not carry forward
      // the previous month's surplus or mix it with the account balance.
      const surplus = sumIncomes - sumExpenses;
      const hasActivity = sumIncomes > 0 || sumExpenses > 0;
      list.push({
        monthStr,
        monthTitle,
        monthShort,
        isCurrent: i === 0,
        sumIncomes,
        sumExpenses,
        surplus,
        isPositive: surplus >= 0,
        hasActivity,
      });
    }
    return list;
  }, [currentMonth, incomes, bills, sharedBills, expenses, locale, forecastBalance, currentBalance]);

  const tabs = [
    {
      id: 'projections',
      label: language === 'es' ? 'Proyección' : language === 'en' ? 'Forecast' : 'Projeção',
      sub: language === 'es' ? '12 meses' : language === 'en' ? '12 months' : '12 meses',
      icon: BarChart3,
    },
    {
      id: 'freedom',
      label: language === 'es' ? 'Libertad' : language === 'en' ? 'Freedom' : 'Liberdade',
      sub: language === 'es' ? 'Velocímetro' : language === 'en' ? 'Gauge' : 'Velocímetro',
      icon: Scale,
    },
    {
      id: 'calendar',
      label: language === 'es' ? 'Calendario' : language === 'en' ? 'Calendar' : 'Calendário',
      sub: language === 'es' ? 'Agenda' : language === 'en' ? 'Schedule' : 'Agenda',
      icon: Calendar,
    },
  ] as const;

  const containerVariants: any = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } };
  const itemVariants: any = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } } };

  return (
    <motion.div initial="hidden" animate="visible" variants={containerVariants} className="space-y-5 pb-24">
      {overdueBillsCount > 0 && (
        <div
          role="button"
          onClick={() => onNavigateToFinance?.('bills', { billFilter: 'overdue' })}
          className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 font-bold text-xs text-center cursor-pointer hover:bg-rose-100 transition-colors"
        >
          {overdueBillsCount} {overdueBillsCount === 1 ? (language === 'pt' ? 'nova fatura atrasada' : language === 'es' ? 'nueva factura vencida' : 'new overdue bill') : (language === 'pt' ? 'novas faturas atrasadas' : language === 'es' ? 'nuevas facturas vencidas' : 'new overdue bills')}
        </div>
      )}

      {/* Dynamic Island Morphing Pill Tab Switcher (always showing full tab names) */}
      <motion.div
        variants={itemVariants}
        layout
        className="flex items-stretch gap-1 rounded-[1.85rem] border border-emerald-200/80 bg-white/90 p-1.5 shadow-md shadow-emerald-900/5 backdrop-blur-md"
      >
        {tabs.map((tab) => {
          const isActive = subTab === tab.id;
          const Icon = tab.icon;
          return (
            <motion.button
              type="button"
              layout
              key={tab.id}
              onClick={() => handleSubTabChange(tab.id)}
              whileTap={{ scale: 0.96 }}
              transition={{ layout: { type: 'spring', stiffness: 420, damping: 32 } }}
              className={`relative z-10 flex min-h-[54px] items-center justify-center overflow-hidden rounded-[1.35rem] transition-colors cursor-pointer ${
                isActive
                  ? 'flex-[1.38] px-2.5 py-2 text-white sm:px-3.5'
                  : 'flex-1 px-1 py-1.5 text-slate-600 hover:bg-emerald-50/70 hover:text-emerald-800 sm:px-2'
              }`}
            >
              {isActive && (
                <>
                  <motion.div
                    layoutId="planning-dynamic-pill"
                    className="absolute inset-0 -z-10 rounded-[1.35rem] bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 shadow-lg shadow-emerald-600/25"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                  <motion.span
                    key={`shimmer-${tab.id}`}
                    initial={{ x: '-120%', opacity: 0.7 }}
                    animate={{ x: '220%', opacity: 0 }}
                    transition={{ duration: 0.65, ease: 'easeOut' }}
                    className="pointer-events-none absolute inset-y-0 left-0 -z-0 w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  />
                </>
              )}

              <motion.div
                layout="position"
                className={`relative z-10 flex items-center justify-center ${
                  isActive ? 'flex-row gap-2' : 'flex-col gap-1'
                }`}
              >
                <motion.span
                  layout="position"
                  animate={isActive ? { scale: [0.88, 1.12, 1], rotate: [0, -8, 0] } : { scale: 1, rotate: 0 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  className={`flex shrink-0 items-center justify-center transition-colors ${
                    isActive
                      ? 'h-8 w-8 rounded-xl bg-white/20 text-white shadow-inner'
                      : 'h-6 w-6 rounded-lg bg-emerald-50 text-emerald-700'
                  }`}
                >
                  <Icon className={isActive ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
                </motion.span>

                <div className={isActive ? 'text-left' : 'text-center'}>
                  <motion.span
                    layout="position"
                    className={`block whitespace-nowrap font-black uppercase leading-tight ${
                      isActive
                        ? 'text-[11px] tracking-wide text-white'
                        : 'text-[9.5px] tracking-tight text-slate-700 sm:text-[10px]'
                    }`}
                  >
                    {tab.label}
                  </motion.span>
                  <AnimatePresence initial={false}>
                    {isActive && (
                      <motion.span
                        key={`sub-${tab.id}`}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="mt-0.5 block whitespace-nowrap text-[9px] font-bold leading-tight text-emerald-100"
                      >
                        {tab.sub}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            </motion.button>
          );
        })}
      </motion.div>

      {/* Feature Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={subTab}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -24 }}
          transition={{ type: 'spring', damping: 26, stiffness: 220 }}
          className="relative"
        >
          {subTab === 'projections' && (
            <div className="space-y-4">
              <div className="px-2 flex items-center justify-between gap-2">
                <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-600">Simulação Anual</h2>
                <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black text-emerald-700 uppercase tracking-widest">
                  12 Meses • Recorrências
                </div>
              </div>

              {/* Connected 12-Month Annual Timeline */}
              <div className="rounded-[2rem] border border-emerald-100/90 bg-white/95 px-3.5 py-5 shadow-sm sm:px-6">
                {monthlyProjections.map((m, idx) => {
                  const isFirst = idx === 0;
                  const isLast = idx === monthlyProjections.length - 1;
                  const prev = !isFirst ? monthlyProjections[idx - 1] : null;
                  const isNeutral = !m.hasActivity && m.surplus === 0;

                  const topLineColor = prev
                    ? !prev.hasActivity && prev.surplus === 0
                      ? 'bg-slate-200'
                      : prev.isPositive && m.isPositive
                      ? 'bg-emerald-300'
                      : !prev.isPositive && !m.isPositive
                      ? 'bg-rose-300'
                      : 'bg-slate-200'
                    : 'bg-transparent';

                  const bottomLineColor = isNeutral
                    ? 'bg-slate-200'
                    : m.isPositive
                    ? 'bg-emerald-300'
                    : 'bg-rose-300';

                  const nodeClass = isNeutral
                    ? 'border-2 border-slate-200 bg-white text-slate-500'
                    : m.isPositive
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/25 ring-4 ring-emerald-50'
                    : 'bg-rose-500 text-white shadow-sm shadow-rose-500/25 ring-4 ring-rose-50';

                  const cardBorderClass = m.isCurrent
                    ? m.isPositive
                      ? 'border-emerald-400 bg-emerald-50/40 ring-2 ring-emerald-100'
                      : 'border-rose-400 bg-rose-50/40 ring-2 ring-rose-100'
                    : isNeutral
                    ? 'border-slate-200/80 bg-white hover:border-slate-300'
                    : m.isPositive
                    ? 'border-emerald-200/80 bg-white hover:border-emerald-300'
                    : 'border-rose-200/80 bg-white hover:border-rose-300';

                  return (
                    <motion.div
                      key={m.monthStr}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(idx * 0.035, 0.35) }}
                      className="relative flex items-stretch gap-3 sm:gap-4"
                    >
                      {/* Timeline Node Column */}
                      <div className="flex w-11 shrink-0 flex-col items-center">
                        <div className={`w-0.5 flex-1 ${isFirst ? 'bg-transparent' : topLineColor}`} />
                        <div
                          className={`z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[10px] font-black tracking-wider transition-all ${nodeClass}`}
                        >
                          {m.monthShort}
                        </div>
                        <div className={`w-0.5 flex-1 ${isLast ? 'bg-transparent' : bottomLineColor}`} />
                      </div>

                      {/* Month Card */}
                      <div className="min-w-0 flex-1 py-2">
                        <div
                          role={onNavigateToFinance ? 'button' : undefined}
                          tabIndex={onNavigateToFinance ? 0 : undefined}
                          onClick={() => onNavigateToFinance?.('timeline', { month: m.monthStr })}
                          onKeyDown={(e) => {
                            if (onNavigateToFinance && (e.key === 'Enter' || e.key === ' ')) {
                              e.preventDefault();
                              onNavigateToFinance('timeline', { month: m.monthStr });
                            }
                          }}
                          className={`rounded-2xl border p-3.5 sm:p-4 shadow-2xs transition-all ${cardBorderClass} ${
                            onNavigateToFinance ? 'cursor-pointer active:scale-[0.99]' : ''
                          }`}
                        >
                          {/* Top Row: Month Name + Projected Surplus */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <h3 className="truncate text-sm font-black capitalize text-slate-900 sm:text-base">
                                  {m.monthTitle}
                                </h3>
                                {m.isCurrent && (
                                  <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white">
                                    Mês atual
                                  </span>
                                )}
                              </div>
                            </div>
                            <div
                              className={`shrink-0 rounded-xl border px-2.5 py-1 font-mono text-xs font-black sm:text-sm ${
                                isNeutral
                                  ? 'border-slate-200 bg-slate-50 text-slate-600'
                                  : m.isPositive
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : 'border-rose-200 bg-rose-50 text-rose-700'
                              }`}
                            >
                              {m.surplus > 0 ? '+' : ''}
                              {formatCurrency(m.surplus, currency)}
                            </div>
                          </div>

                          {/* Bottom Row: Previsão de Entradas & Previsão de Saídas */}
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <div className="rounded-xl border border-emerald-100/90 bg-emerald-50/60 px-2.5 py-2 sm:px-3">
                              <div className="flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider text-emerald-800/80">
                                <ArrowUpRight className="h-3 w-3 shrink-0 text-emerald-600" />
                                <span className="truncate">Previsão de Entradas</span>
                              </div>
                              <div className="mt-1 truncate font-mono text-xs font-black text-emerald-700 sm:text-sm">
                                +{formatCurrency(m.sumIncomes, currency)}
                              </div>
                            </div>

                            <div className="rounded-xl border border-rose-100/90 bg-rose-50/60 px-2.5 py-2 sm:px-3">
                              <div className="flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider text-rose-800/80">
                                <ArrowDownLeft className="h-3 w-3 shrink-0 text-rose-500" />
                                <span className="truncate">Previsão de Saídas</span>
                              </div>
                              <div className="mt-1 truncate font-mono text-xs font-black text-rose-600 sm:text-sm">
                                -{formatCurrency(m.sumExpenses, currency)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {subTab === 'freedom' && (
            <MonthlyFreedomScale bills={bills} incomes={incomes} expenses={expenses} sharedBills={sharedBills} statusRecords={statusRecords} currency={currency} language={language} startMonth={currentMonth} currentBalance={currentBalance} forecastBalance={forecastBalance} />
          )}

          {subTab === 'calendar' && (
            <FinancialCalendarView currency={currency} language={language} onOpenMoneChat={onOpenMoneChat} />
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
};
