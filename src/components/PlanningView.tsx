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
import { getTranslations, getLocaleForLanguage } from '../utils/i18n';
import { MonthlyFreedomScale } from './MonthlyFreedomScale';
import { FinancialCalendarView } from './FinancialCalendarView';
import {
  Calendar,
  Sparkles,
  TrendingUp,
  Receipt,
  Wallet,
  Plus,
  ArrowRight,
  TrendingDown,
  LayoutGrid,
  BarChart3,
  Scale,
} from 'lucide-react';

interface PlanningViewProps {
  currency: CurrencyCode;
  language?: LanguageCode;
  bills: BillItem[];
  incomes: IncomeItem[];
  expenses: ExpenseItem[];
  sharedBills?: SharedBill[];
  statusRecords?: MonthlyStatusRecord[];
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
  onOpenMoneChat,
  onOpenNewTransaction,
  overdueBillsCount = 0,
  onNavigateToFinance,
}) => {
  const t = getTranslations(language);
  const locale = getLocaleForLanguage(language);
  const [subTab, setSubTab] = useState<'projections' | 'calendar' | 'freedom'>('projections');
  const currentMonth = getCurrentMonthStr();

  const monthlyProjections = useMemo(() => {
    const list = [];
    for (let i = 0; i < 4; i++) {
      const monthStr = shiftMonthStr(currentMonth, i);
      const dateObj = new Date(parseInt(monthStr.split('-')[0]), parseInt(monthStr.split('-')[1]) - 1, 1);
      const monthTitle = dateObj.toLocaleDateString(locale, { month: 'long', year: 'numeric' });

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

      const surplus = sumIncomes - sumExpenses;
      list.push({ monthStr, monthTitle, isCurrent: i === 0, sumIncomes, sumExpenses, surplus, isPositive: surplus >= 0 });
    }
    return list;
  }, [currentMonth, incomes, bills, sharedBills, expenses, locale]);

  const tabs = [
    { id: 'projections', label: 'Projeção', icon: BarChart3 },
    { id: 'freedom', label: 'Liberdade', icon: Scale },
    { id: 'calendar', label: 'Calendário', icon: Calendar },
  ] as const;

  const containerVariants: any = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants: any = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } } };

  return (
    <motion.div initial="hidden" animate="visible" variants={containerVariants} className="space-y-6 pb-24">
      {overdueBillsCount > 0 && (
        <div
          role="button"
          onClick={() => onNavigateToFinance?.('bills', { billFilter: 'overdue' })}
          className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 font-bold text-xs text-center cursor-pointer hover:bg-rose-100 transition-colors"
        >
          {overdueBillsCount} {overdueBillsCount === 1 ? (language === 'pt' ? 'nova fatura atrasada' : language === 'es' ? 'nueva factura vencida' : 'new overdue bill') : (language === 'pt' ? 'novas faturas atrasadas' : language === 'es' ? 'nuevas facturas vencidas' : 'new overdue bills')}
        </div>
      )}
      {/* Premium Cinematic Header */}
      <motion.div variants={itemVariants} className="glass-panel rounded-[3rem] p-8 sm:p-10 shadow-md relative overflow-hidden group">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none group-hover:bg-blue-500/10 transition-colors duration-1000" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-[1.5rem] bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-600/20 border border-white/80">
                <LayoutGrid className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none">Planejamento</h1>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 mt-2">Visão Estratégica e Futuro</p>
              </div>
            </div>
            <p className="text-sm font-medium text-slate-600 max-w-xl leading-relaxed">Simule seu fluxo de caixa para os próximos meses, visualize sua escala de liberdade financeira e acompanhe seus compromissos no tempo.</p>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onOpenNewTransaction?.('bill')}
            className="h-16 px-10 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-[0.2em] shadow-md transition-all cursor-pointer shrink-0"
          >
            <span className="flex items-center gap-2"><Plus className="w-5 h-5 stroke-[4]" /> Lançar Fatura</span>
          </motion.button>
        </div>

        {/* Tab Switcher Interface */}
        <div className="flex items-center justify-center gap-2 p-2 mt-12 bg-slate-100/80 rounded-[2rem] border border-slate-200/80 relative shadow-inner">
          {tabs.map((tab) => {
            const isActive = subTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setSubTab(tab.id)}
                className={`flex-none w-[120px] py-4 rounded-[1.5rem] transition-all cursor-pointer relative z-10 group overflow-hidden ${
                  isActive ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {isActive && (
                  <motion.div layoutId="planning-view-tab" className="absolute inset-0 bg-white shadow-xs rounded-[1.5rem]" transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }} />
                )}
                <div className="relative z-10 flex flex-col items-center gap-1">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'group-hover:text-slate-800 transition-colors'}`} />
                  <span className="text-[10px] font-black uppercase tracking-widest">{tab.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Feature Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={subTab}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="relative"
        >
          {subTab === 'projections' && (
            <div className="space-y-6">
              <div className="px-2 flex items-center justify-between">
                <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-600">Simulação Trimestral</h2>
                <div className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[9px] font-black text-blue-700 uppercase tracking-widest">Baseado em Recorrências</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {monthlyProjections.map((m, idx) => (
                  <motion.div key={m.monthStr} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.1 }} className={`glass-card rounded-[2.5rem] p-8 border transition-all group overflow-hidden relative shadow-sm ${m.isCurrent ? 'border-blue-500/40 shadow-md' : 'border-slate-200/80'}`}>
                    {m.isCurrent && <div className="absolute top-0 right-0 p-8 opacity-10"><Sparkles className="w-24 h-24 text-blue-600" /></div>}
                    <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-200/60">
                      <div>
                        <div className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">{m.isCurrent ? 'Mês em Curso' : 'Previsão'}</div>
                        <h3 className="text-xl font-black text-slate-900 capitalize leading-none">{m.monthTitle}</h3>
                      </div>
                      <div className={`px-4 py-2 rounded-2xl font-black text-sm font-mono border ${m.isPositive ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700' : 'bg-rose-500/10 border-rose-500/20 text-rose-700'}`}>
                        {m.isPositive ? '+' : ''}{formatCurrency(m.surplus, currency)}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-5 rounded-3xl bg-white/2 border border-white/5">
                        <div className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-2">Previsão Entradas</div>
                        <div className="text-lg font-black text-emerald-400 font-mono tracking-tighter">+{formatCurrency(m.sumIncomes, currency)}</div>
                      </div>
                      <div className="p-5 rounded-3xl bg-white/2 border border-white/5">
                        <div className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-2">Custo de Vida</div>
                        <div className="text-lg font-black text-rose-400 font-mono tracking-tighter">-{formatCurrency(m.sumExpenses, currency)}</div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {subTab === 'freedom' && (
            <MonthlyFreedomScale bills={bills} incomes={incomes} expenses={expenses} sharedBills={sharedBills} statusRecords={statusRecords} currency={currency} language={language} startMonth={currentMonth} />
          )}

          {subTab === 'calendar' && (
            <FinancialCalendarView currency={currency} language={language} onOpenMoneChat={onOpenMoneChat} />
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
};
