/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  CurrencyCode,
  LanguageCode,
  MonthTimelineItem,
} from '../types';
import { useFinanceControl } from '../hooks/useFinanceControl';
import { useSharedAccounts } from '../hooks/useSharedAccounts';
import { useCategories } from '../hooks/useCategories';
import { useAccounts } from '../hooks/useAccounts';
import { formatCurrency } from '../utils/currency';
import {
  getCurrentMonthStr,
  getTodayStr,
  formatMonthName,
} from '../utils/finance';
import { getTranslations, getLocaleForLanguage } from '../utils/i18n';
import { TransactionModal, TransactionType, EditingTransaction } from './TransactionModal';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  TrendingUp,
  Receipt,
  ShoppingBag,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Users,
  Eye,
  EyeOff,
  Filter,
  Sparkles,
  X,
  Repeat,
  Layers,
  ArrowRightLeft,
  Check,
  Zap,
} from 'lucide-react';

interface FinancialCalendarViewProps {
  currency: CurrencyCode;
  language?: LanguageCode;
  onReturnToFinance?: () => void;
  onOpenMoneChat?: () => void;
}

type CalendarFilter = 'all' | 'income' | 'expense' | 'pending' | 'paid' | 'shared';

interface DayAggregate {
  dayNumber: number;
  dateStr: string;
  items: MonthTimelineItem[];
  filteredItems: MonthTimelineItem[];
  inflows: number;
  outflows: number;
  dailyResult: number;
  projectedBalance: number;
  isToday: boolean;
  hasShared: boolean;
  hasPendingBills: boolean;
  hasPaidBills: boolean;
  hasIncomes: boolean;
  hasExpenses: boolean;
}

export const FinancialCalendarView: React.FC<FinancialCalendarViewProps> = ({
  currency,
  language = 'pt',
  onReturnToFinance,
  onOpenMoneChat,
}) => {
  const t = getTranslations(language);
  const locale = getLocaleForLanguage(language);
  const todayStr = useMemo(() => getTodayStr(), []);
  const sharedAccounts = useSharedAccounts();

  const {
    selectedMonth,
    setSelectedMonth,
    goToPreviousMonth,
    goToNextMonth,
    bills,
    incomes,
    expenses,
    timelineItems,
    baseBalance,
    toggleBillPaid,
    toggleIncomeReceived,
  } = useFinanceControl(sharedAccounts.sharedBills);

  const [activeFilter, setActiveFilter] = useState<CalendarFilter>('all');
  const [showProjected, setShowProjected] = useState<boolean>(true);
  const [isTxModalOpen, setIsTxModalOpen] = useState<boolean>(false);
  const [txInitialType, setTxInitialType] = useState<TransactionType>('bill');
  const [txDefaultDate, setTxDefaultDate] = useState<string>(todayStr);
  const [editingTx, setEditingTx] = useState<EditingTransaction | null>(null);
  const [isQuickAddMenuOpen, setIsQuickAddMenuOpen] = useState<boolean>(false);
  const [selectedDayNum, setSelectedDayNum] = useState<number>(() => parseInt(todayStr.split('-')[2] || '1', 10));
  const [isDayDetailModalOpen, setIsDayDetailModalOpen] = useState<boolean>(false);

  const { yearStr, monthNumStr, daysInMonth, firstDayOfWeek } = useMemo(() => {
    const parts = (selectedMonth || getCurrentMonthStr()).split('-');
    const yStr = parts[0] || '2026';
    const mStr = parts[1] || '01';
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);
    const totalDays = new Date(y, m, 0).getDate();
    const firstDow = new Date(y, m - 1, 1).getDay();
    return { yearStr: yStr, monthNumStr: mStr, year: y, monthNum: m, daysInMonth: totalDays, firstDayOfWeek: firstDow };
  }, [selectedMonth]);

  useEffect(() => {
    if (selectedDayNum > daysInMonth) setSelectedDayNum(daysInMonth);
  }, [selectedMonth, daysInMonth, selectedDayNum]);

  const itemsByDay = useMemo(() => {
    const map = new Map<number, MonthTimelineItem[]>();
    for (const item of timelineItems) {
      if (!item.date) continue;
      const [iY, iM, iD] = item.date.split('-');
      if (iY === yearStr && iM === monthNumStr) {
        const d = parseInt(iD, 10);
        if (!isNaN(d) && d >= 1 && d <= 31) {
          const list = map.get(d) || [];
          list.push(item);
          map.set(d, list);
        }
      }
    }
    return map;
  }, [timelineItems, yearStr, monthNumStr]);

  const { daysData, totalInflows, totalOutflows, endMonthProjected, maxDayOutflow, peakDayNumber, firstNegativeDay } = useMemo(() => {
    let runningBalance = baseBalance;
    let sumInflows = 0;
    let sumOutflows = 0;
    let maxOutflow = 0;
    let peakDay = 1;
    let firstNegDay: number | null = null;
    const days: DayAggregate[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dayDateStr = `${yearStr}-${monthNumStr}-${String(d).padStart(2, '0')}`;
      const dayItems = itemsByDay.get(d) || [];
      let dayInflows = 0;
      let dayOutflows = 0;
      let hasShared = false, hasPendingBills = false, hasPaidBills = false, hasIncomes = false, hasExpenses = false;

      for (const it of dayItems) {
        const val = Math.abs(it.amount);
        if (it.type === 'income') { dayInflows += val; hasIncomes = true; }
        else {
          dayOutflows += val;
          if (it.type === 'bill') { if (it.status === 'paid') hasPaidBills = true; else hasPendingBills = true; }
          else hasExpenses = true;
        }
        if (it.id.startsWith('bill_sb_') || it.id.includes('sb_')) hasShared = true;
      }

      sumInflows += dayInflows;
      sumOutflows += dayOutflows;
      if (dayOutflows > maxOutflow) { maxOutflow = dayOutflows; peakDay = d; }
      runningBalance = runningBalance + dayInflows - dayOutflows;
      if (runningBalance < 0 && firstNegDay === null) firstNegDay = d;

      const filtered = dayItems.filter((it) => {
        if (activeFilter === 'all') return true;
        if (activeFilter === 'income') return it.type === 'income';
        if (activeFilter === 'expense') return it.type === 'bill' || it.type === 'expense';
        if (activeFilter === 'pending') return it.status === 'pending' || it.status === 'to_receive' || it.status === 'overdue';
        if (activeFilter === 'paid') return it.status === 'paid' || it.status === 'received';
        if (activeFilter === 'shared') return it.id.startsWith('bill_sb_') || it.id.includes('sb_');
        return true;
      });

      days.push({
        dayNumber: d, dateStr: dayDateStr, items: dayItems, filteredItems: filtered,
        inflows: dayInflows, outflows: dayOutflows, dailyResult: dayInflows - dayOutflows,
        projectedBalance: runningBalance, isToday: dayDateStr === todayStr,
        hasShared, hasPendingBills, hasPaidBills, hasIncomes, hasExpenses
      });
    }

    return { daysData: days, totalInflows: sumInflows, totalOutflows: sumOutflows, endMonthProjected: runningBalance, maxDayOutflow: maxOutflow, peakDayNumber: peakDay, firstNegativeDay: firstNegDay };
  }, [daysInMonth, yearStr, monthNumStr, itemsByDay, baseBalance, todayStr, activeFilter]);

  const selectedDayData = useMemo(() => daysData.find((d) => d.dayNumber === selectedDayNum) || daysData[0] || null, [daysData, selectedDayNum]);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2023, 0, 1 + i);
    const name = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(d);
    return name.charAt(0).toUpperCase() + name.slice(1).replace('.', '');
  }), [locale]);

  const handleOpenQuickCreate = (type: TransactionType, date?: string) => {
    setTxInitialType(type);
    setTxDefaultDate(date || selectedDayData?.dateStr || todayStr);
    setEditingTx(null);
    setIsQuickAddMenuOpen(false);
    setIsTxModalOpen(true);
  };

  const handleOpenEditItem = (item: MonthTimelineItem) => {
    if (item.type === 'bill') {
      const found = bills.find(b => b.id === item.originalId);
      if (found) { setEditingTx({ id: found.id, type: 'bill', item: found }); setTxInitialType('bill'); setIsTxModalOpen(true); }
    } else if (item.type === 'income') {
      const found = incomes.find(inc => inc.id === item.originalId);
      if (found) { setEditingTx({ id: found.id, type: 'income', item: found }); setTxInitialType('income'); setIsTxModalOpen(true); }
    } else {
      const found = expenses.find(exp => exp.id === item.originalId);
      if (found) { setEditingTx({ id: found.id, type: 'expense', item: found }); setTxInitialType('expense'); setIsTxModalOpen(true); }
    }
  };

  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.01 } } };
  const cellVariants = { hidden: { opacity: 0, scale: 0.9 }, visible: { opacity: 1, scale: 1 } };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-20">
      {/* Premium Header */}
      <div className="glass-panel rounded-[2.5rem] p-6 sm:p-8 shadow-md space-y-8 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-10"><Calendar className="w-40 h-48 text-emerald-600" /></div>
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <button onClick={onReturnToFinance} className="p-3 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 transition-all shadow-xs">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-md"><Calendar className="w-5 h-5 text-white" /></div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Calendário</h2>
              </div>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mt-1.5 opacity-80">Projeção temporal de fluxo de caixa</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-white/80 rounded-2xl p-1.5 flex items-center gap-2 border border-slate-200/80 shadow-xs">
              <button onClick={goToPreviousMonth} className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-all"><ChevronLeft className="w-4 h-4" /></button>
              <span className="px-4 text-sm font-black text-slate-900 uppercase tracking-widest min-w-[140px] text-center capitalize">{formatMonthName(selectedMonth, locale)}</span>
              <button onClick={goToNextMonth} className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-all"><ChevronRight className="w-4 h-4" /></button>
            </div>
            <button onClick={() => setSelectedMonth(getCurrentMonthStr())} className="h-12 px-6 rounded-2xl bg-white/80 hover:bg-white border border-slate-200/80 text-slate-700 text-[10px] font-black uppercase tracking-widest transition-all shadow-xs">Hoje</button>
            <button onClick={() => setShowProjected(!showProjected)} className={`h-12 px-5 rounded-2xl border transition-all flex items-center gap-2 shadow-xs ${showProjected ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-white/80 border-slate-200/80 text-slate-600'}`}>
              {showProjected ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Dynamic KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10">
          <div className="p-5 rounded-3xl bg-white/80 border border-slate-200/80 shadow-xs">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Total Entradas</div>
            <div className="text-2xl font-black text-emerald-600 font-mono">{formatCurrency(totalInflows, currency)}</div>
          </div>
          <div className="p-5 rounded-3xl bg-white/80 border border-slate-200/80 shadow-xs">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Total Saídas</div>
            <div className="text-2xl font-black text-rose-600 font-mono">{formatCurrency(totalOutflows, currency)}</div>
          </div>
          <div className="p-5 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 shadow-xs">
            <div className="text-[10px] font-black uppercase tracking-widest text-emerald-700 mb-1">Projeção Final</div>
            <div className="text-2xl font-black text-slate-900 font-mono">{formatCurrency(endMonthProjected, currency)}</div>
          </div>
        </div>

        {/* Filter Scroll */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 relative z-10">
          {(['all', 'income', 'expense', 'pending', 'paid', 'shared'] as const).map(f => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`h-10 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer whitespace-nowrap ${
                activeFilter === f ? 'bg-emerald-600 text-white shadow-md' : 'bg-white/80 text-slate-600 hover:text-slate-900 border border-slate-200/80 shadow-xs'
              }`}
            >
              {f === 'all' ? 'Todos' : f === 'income' ? 'Entradas' : f === 'expense' ? 'Saídas' : f === 'pending' ? 'Pendentes' : f === 'paid' ? 'Pagos' : 'Em Grupo'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Calendar Grid */}
      <div className="glass-panel rounded-[3rem] p-6 sm:p-8 shadow-md">
        <div className="grid grid-cols-7 gap-3 mb-6">
          {weekDays.map((wd, i) => (
            <div key={i} className="text-[10px] font-black text-slate-600 uppercase tracking-widest text-center">{wd}</div>
          ))}
        </div>

        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-7 gap-3 sm:gap-4">
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`pad-${i}`} className="min-h-[100px] rounded-2xl bg-white/2 border border-transparent opacity-20" />
          ))}

          {daysData.map((d) => {
            const isSelected = selectedDayNum === d.dayNumber;
            const hasMovements = d.filteredItems.length > 0;

            return (
              <motion.button
                key={d.dayNumber}
                variants={cellVariants}
                whileHover={{ scale: 1.03, zIndex: 20 }}
                onClick={() => { setSelectedDayNum(d.dayNumber); setIsDayDetailModalOpen(true); }}
                style={isSelected ? { backgroundColor: 'rgba(16, 185, 129, 0.12)' } : undefined}
                className={`min-h-[110px] p-2.5 sm:p-3 rounded-2xl border transition-all text-left flex flex-col justify-between group cursor-pointer relative overflow-hidden bg-white/80 ${
                  isSelected 
                    ? 'border-emerald-500 shadow-md ring-2 ring-emerald-500/20' 
                    : 'border-slate-200/80 hover:border-emerald-500/40 shadow-xs'
                } ${d.isToday ? 'ring-2 ring-emerald-500/80' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm sm:text-base font-black font-mono-numbers ${d.isToday ? 'text-emerald-700 font-extrabold' : 'text-slate-900'}`}>
                    {d.dayNumber}
                  </span>
                  {d.hasShared && <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-sm" />}
                </div>

                {/* Status dots */}
                <div className="flex items-center gap-1 flex-wrap my-1.5 min-h-[8px]">
                  {d.filteredItems.slice(0, 4).map((it, idx) => (
                    <div key={idx} className={`w-1.5 h-1.5 rounded-full ${it.type === 'income' ? 'bg-emerald-500' : it.status === 'pending' ? 'bg-amber-500' : 'bg-rose-500'}`} />
                  ))}
                  {d.filteredItems.length > 4 && <span className="text-[8px] font-black text-slate-500">+{d.filteredItems.length - 4}</span>}
                </div>

                {/* ONLY display financial values when real transactions/bills exist on this specific date */}
                {hasMovements ? (
                  <div className="mt-auto border-t border-slate-200/60 pt-1.5 space-y-0.5">
                    {d.inflows > 0 && (
                      <div className="text-[9px] font-black font-mono-numbers truncate text-emerald-600">
                        +{formatCurrency(d.inflows, currency)}
                      </div>
                    )}
                    {d.outflows > 0 && (
                      <div className="text-[9px] font-black font-mono-numbers truncate text-rose-600">
                        -{formatCurrency(d.outflows, currency)}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-auto min-h-[16px]" />
                )}
              </motion.button>
            );
          })}
        </motion.div>
      </div>

      {/* Day Detail Modal */}
      <AnimatePresence>
        {isDayDetailModalOpen && selectedDayData && (
          <div key="day-detail-modal-root" className="fixed inset-0 z-[100] isolate flex items-end sm:items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="financial-calendar-day-backdrop"
              onClick={() => setIsDayDetailModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="glass-modal w-full max-w-lg rounded-[3rem] p-8 shadow-2xl relative z-10 max-h-[85dvh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-8 shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-700 flex items-center justify-center font-black text-xl border border-emerald-500/20">{selectedDayData.dayNumber}</div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 capitalize">{formatMonthName(selectedMonth, locale)}</h3>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">{selectedDayData.items.length} Movimentações</p>
                  </div>
                </div>
                <button onClick={() => setIsDayDetailModalOpen(false)} className="p-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"><X className="w-6 h-6" /></button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-5 rounded-3xl bg-emerald-500/10 border border-emerald-500/20">
                    <div className="text-[9px] font-black text-emerald-700 uppercase tracking-widest mb-1">Entradas</div>
                    <div className="text-xl font-black text-emerald-700 font-mono">+{formatCurrency(selectedDayData.inflows, currency)}</div>
                  </div>
                  <div className="p-5 rounded-3xl bg-rose-500/10 border border-rose-500/20">
                    <div className="text-[9px] font-black text-rose-700 uppercase tracking-widest mb-1">Saídas</div>
                    <div className="text-xl font-black text-rose-700 font-mono">-{formatCurrency(selectedDayData.outflows, currency)}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-1">Lançamentos do Dia</div>
                  {selectedDayData.items.length === 0 ? (
                    <div className="p-10 rounded-[2rem] border border-dashed border-slate-200 text-center text-slate-500 font-bold text-sm">Sem movimentos neste dia</div>
                  ) : (
                    <div className="space-y-2">
                      {selectedDayData.items.map(it => (
                        <div key={it.id} onClick={() => handleOpenEditItem(it)} className="p-4 rounded-2xl bg-white/80 border border-slate-200 hover:border-emerald-500/40 hover:bg-white shadow-xs transition-all flex items-center justify-between group cursor-pointer">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${it.type === 'income' ? 'bg-emerald-500/15 text-emerald-700' : 'bg-rose-500/15 text-rose-700'}`}>
                              {it.type === 'income' ? <TrendingUp className="w-5 h-5" /> : <ShoppingBag className="w-5 h-5" />}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">{it.name}</div>
                              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">{it.category}</div>
                            </div>
                          </div>
                          <div className={`text-sm font-black font-mono ${it.type === 'income' ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {it.type === 'income' ? '+' : '-'}{formatCurrency(Math.abs(it.amount), currency)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-6 shrink-0">
                <button onClick={() => handleOpenQuickCreate('bill', selectedDayData.dateStr)} className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-600/30 transition-all flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" /> Novo Lançamento
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <TransactionModal
        isOpen={isTxModalOpen}
        onClose={() => { setIsTxModalOpen(false); setEditingTx(null); }}
        initialType={txInitialType}
        defaultDate={txDefaultDate}
        editingItem={editingTx}
        currency={currency}
        language={language}
      />
    </div>
  );
};
