/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  BillItem,
  IncomeItem,
  ExpenseItem,
  AccountItem,
  SharedBill,
  MonthlyStatusRecord,
  CurrencyCode,
  LanguageCode,
  RitmoDiarioConfig,
  FinanceSettings,
} from '../types';
import { formatCurrency } from '../utils/currency';
import { getTranslations, getLocaleForLanguage } from '../utils/i18n';
import {
  doesItemOccurInMonth,
  getEffectiveDateForMonth,
  shiftMonthStr,
} from '../utils/finance';
import { motion, AnimatePresence } from 'motion/react';
import {
  Gauge,
  CalendarClock,
  Wallet,
  ChevronLeft,
  Settings,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Clock,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  ShieldAlert,
  Info,
  X,
  Plus,
  Calendar,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  ArrowLeft,
  Target,
} from 'lucide-react';

interface RitmoDiarioViewProps {
  bills?: BillItem[];
  incomes?: IncomeItem[];
  expenses?: ExpenseItem[];
  accounts?: AccountItem[];
  currentBalance?: number;
  sharedBills?: SharedBill[];
  statusRecords?: MonthlyStatusRecord[];
  currency: CurrencyCode;
  language?: LanguageCode;
  userId?: string;
  financeSettings?: FinanceSettings;
  ritmoDiarioConfig?: RitmoDiarioConfig;
  onUpdateConfig: (config: Partial<RitmoDiarioConfig>) => Promise<void> | void;
  onReturnToFinance?: () => void;
}

export const RitmoDiarioView: React.FC<RitmoDiarioViewProps> = ({
  bills = [],
  incomes = [],
  expenses = [],
  accounts = [],
  currentBalance = 0,
  sharedBills = [],
  statusRecords = [],
  currency,
  language = 'pt',
  userId,
  financeSettings,
  ritmoDiarioConfig,
  onUpdateConfig,
  onReturnToFinance,
}) => {
  const t = getTranslations(language);
  const locale = getLocaleForLanguage(language);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const statusMap = useMemo(() => {
    const map = new Map<string, MonthlyStatusRecord>();
    const records = [...statusRecords];
    if (records.length === 0 && typeof window !== 'undefined') {
      try {
        const cached = (userId ? localStorage.getItem(`mc_fin_${userId}_status`) : null) || localStorage.getItem('mc_fin_anon_status');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) records.push(...parsed);
        }
      } catch {}
    }
    for (const rec of records) {
      if (rec.id) map.set(rec.id, rec);
      if (rec.itemId && rec.month) {
        map.set(`${rec.itemId}_${rec.month}`, rec);
        map.set(`bill_${rec.itemId}_${rec.month}`, rec);
        map.set(`inc_${rec.itemId}_${rec.month}`, rec);
      }
    }
    return map;
  }, [statusRecords, userId]);

  const checkIsBillPaid = useMemo(() => (bill: BillItem, targetMonth: string): boolean => {
    const cleanId = bill.id.replace(/^bill_/, '').replace(/^sb_/, '');
    const keys = [`bill_${bill.id}_${targetMonth}`, `sb_${bill.id}_${targetMonth}`, `${bill.id}_${targetMonth}`, `bill_${cleanId}_${targetMonth}`, `${cleanId}_${targetMonth}`];
    for (const k of keys) {
      const rec = statusMap.get(k);
      if (rec && (rec.isCompleted || (rec as any).status === 'paid')) return true;
    }
    return expenses.some(e => e.date?.startsWith(targetMonth) && ((e as any).billId === bill.id || (e as any).billId === cleanId));
  }, [statusMap, expenses]);

  const checkIsIncomeReceived = useMemo(() => (inc: IncomeItem, targetMonth: string): boolean => {
    const cleanId = inc.id.replace(/^inc_/, '');
    const keys = [`inc_${inc.id}_${targetMonth}`, `${inc.id}_${targetMonth}`, `${cleanId}_${targetMonth}`];
    for (const k of keys) {
      const rec = statusMap.get(k);
      if (rec && (rec.isCompleted || (rec as any).status === 'received')) return true;
    }
    return false;
  }, [statusMap]);

  // Próxima ocorrência futura de receita de maior valor (empate: data mais próxima).
  const paydayInfo = useMemo(() => {
    const today = new Date(todayStr + 'T00:00:00');
    const monthNow = todayStr.substring(0, 7);
    const candidates: Array<{ date: string; amount: number; name: string }> = [];
    incomes.filter(inc => !((inc as any).isTransfer || (inc as any).category === 'transfer' || inc.isSharedGenerated || inc.isReimbursement || inc.isRefund)).forEach(inc => {
      for (let offset = 0; offset <= 2; offset++) {
        const month = shiftMonthStr(monthNow, offset);
        if (!doesItemOccurInMonth(inc.startMonth, month, inc.recurrence, inc.recurrenceMonthsCount)) continue;
        if (inc.excludedMonths?.includes(month) || inc.exceptions?.[month]?.isDeleted || checkIsIncomeReceived(inc, month)) continue;
        const override = inc.exceptions?.[month] as any;
        const date = override?.expectedDate || getEffectiveDateForMonth(month, Number(override?.expectedDay || inc.expectedDay || (inc.expectedDate ? Number(inc.expectedDate.split('-')[2]) : 1)));
        if (date >= todayStr) candidates.push({ date, amount: Number(override?.amount ?? inc.amount) || 0, name: inc.name });
      }
    });
    candidates.sort((x, y) => y.amount - x.amount || x.date.localeCompare(y.date));
    const selected = candidates[0];
    if (ritmoDiarioConfig?.useAutoPayday === false && ritmoDiarioConfig.customPaydayDate && ritmoDiarioConfig.customPaydayDate >= todayStr) {
      return { date: ritmoDiarioConfig.customPaydayDate, amount: Number(ritmoDiarioConfig.customPaydayAmount || selected?.amount || 0), name: selected?.name || 'Ingresso previsto' };
    }
    if (selected) return selected;
    const fallback = new Date(today);
    fallback.setDate(fallback.getDate() + 15);
    return { date: fallback.getFullYear() + '-' + String(fallback.getMonth() + 1).padStart(2, '0') + '-' + String(fallback.getDate()).padStart(2, '0'), amount: Number(ritmoDiarioConfig?.customPaydayAmount || 0), name: 'Próximo ingresso' };
  }, [incomes, todayStr, checkIsIncomeReceived, ritmoDiarioConfig]);
  const resolvedPaydayStr = paydayInfo.date;

  const daysRemaining = useMemo(() => {
    const today = new Date(todayStr + 'T00:00:00');
    const payday = new Date(resolvedPaydayStr + 'T00:00:00');
    return Math.max(1, Math.ceil((payday.getTime() - today.getTime()) / 86400000));
  }, [todayStr, resolvedPaydayStr]);

  const realTotalBalance = useMemo(() => {
    if (!accounts || accounts.length === 0) return Number(currentBalance) || 0;
    return accounts.filter(account => account.isActive !== false).reduce((sum, account) => sum + (Number(account.currentBalance ?? account.initialBalance) || 0), 0);
  }, [accounts, currentBalance]);

  const pendingCommitmentsList = useMemo(() => {
    const list: Array<{ id: string; name: string; amount: number; due: string; kind: 'bill' | 'shared' }> = [];
    // O Ritmo Diário reserva somente compromissos do mês atual.
    // Nunca antecipa faturas do mês seguinte, mesmo quando o próximo ingresso cai nele.
    const currentMonth = todayStr.substring(0, 7);
    const lastDayOfCurrentMonth = new Date(
      Number(currentMonth.substring(0, 4)),
      Number(currentMonth.substring(5, 7)),
      0
    ).getDate();
    const monthEnd = `${currentMonth}-${String(lastDayOfCurrentMonth).padStart(2, '0')}`;

    bills.forEach(bill => {
      if (!doesItemOccurInMonth(bill.startMonth, currentMonth, bill.recurrence, bill.recurrenceMonthsCount)) return;
      if (bill.excludedMonths?.includes(currentMonth) || bill.exceptions?.[currentMonth]?.isDeleted || bill.isRefund || bill.isRefunded) return;
      if (checkIsBillPaid(bill, currentMonth)) return;
      const due = bill.exceptions?.[currentMonth]?.dueDate || getEffectiveDateForMonth(currentMonth, bill.dueDay || 1);
      if (due <= monthEnd) {
        list.push({
          id: 'bill:' + bill.id + ':' + currentMonth,
          name: bill.name,
          amount: Number(bill.exceptions?.[currentMonth]?.amount ?? bill.amount) || 0,
          due,
          kind: 'bill'
        });
      }
    });

    sharedBills.forEach(shared => {
      if (shared.hiddenForUsers?.includes(userId || '') || shared.excludedMonths?.includes(currentMonth)) return;
      if (!doesItemOccurInMonth(shared.startMonth || shared.month, currentMonth, shared.recurrence || 'none', shared.recurrenceMonthsCount)) return;
      const override = shared.exceptions?.[currentMonth] as any;
      if (override?.isDeleted || override?.deletedForUsers?.includes(userId || '')) return;
      const share = userId ? shared.shares?.[userId] : undefined;
      if (!share || share.status !== 'pending' || shared.status === 'paid') return;
      const due = override?.dueDate || (currentMonth === shared.month ? shared.dueDate : getEffectiveDateForMonth(currentMonth, shared.dueDay || 1));
      if (due <= monthEnd) {
        list.push({
          id: 'shared:' + shared.id + ':' + currentMonth,
          name: shared.title + ' (sua parte)',
          amount: Number((userId ? override?.shares?.[userId]?.amount : undefined) ?? share.amount) || 0,
          due,
          kind: 'shared'
        });
      }
    });

    return list.sort((x, y) => x.due.localeCompare(y.due));
  }, [bills, sharedBills, userId, todayStr, checkIsBillPaid]);

  const pendingSum = useMemo(() => pendingCommitmentsList.reduce((sum, item) => sum + item.amount, 0), [pendingCommitmentsList]);
  const realAvailable = realTotalBalance - pendingSum;
  const dailyBudget = Math.max(0, realAvailable) / daysRemaining;
  const todaySpent = expenses.filter(expense => expense.date === todayStr && !(expense as any).isTransfer && !(expense as any).isRefund).reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
  const remainingToday = dailyBudget - todaySpent;
  const availablePercentage = realTotalBalance > 0 ? Math.min(100, Math.max(0, (Math.max(0, realAvailable) / realTotalBalance) * 100)) : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-24">
      {/* Premium Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={onReturnToFinance} className="p-3 rounded-2xl glass-card text-slate-700 hover:text-slate-900 transition-all cursor-pointer shadow-xs">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-emerald-600 flex items-center justify-center shadow-md"><Gauge className="w-5 h-5 text-white" /></div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Ritmo Diário</h2>
            </div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1.5 opacity-80">Orçamento recomendado até o próximo salário</p>
          </div>
        </div>

        <button onClick={() => setIsSettingsOpen(true)} className="p-3 rounded-2xl bg-white/80 hover:bg-white border border-slate-200/80 text-slate-600 hover:text-slate-900 transition-all cursor-pointer shadow-xs">
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Main Hero Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-[2.5rem] p-8 shadow-md relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10"><Wallet className="w-24 h-24 text-emerald-600" /></div>
          <div className="relative z-10 space-y-6">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Saldo Real Disponível</div>
              <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black text-emerald-700 uppercase tracking-widest">{daysRemaining} Dias Restantes</div>
            </div>
            <div>
              <div className="text-4xl font-black text-slate-900 font-mono tracking-tight">{formatCurrency(realAvailable, currency)}</div>
              <p className="text-xs font-medium text-slate-600 mt-2">Saldo após reservar somente as contas pendentes deste mês (até {todayStr.substring(0, 7).split('-').reverse().join('/')}). Próximo ingresso de maior valor: {paydayInfo.name} ({formatCurrency(paydayInfo.amount, currency)}).</p>
            </div>
            <div className="h-3 w-full bg-slate-200/80 rounded-full overflow-hidden border border-slate-200/50">
              <motion.div initial={{ width: 0 }} animate={{ width: `${availablePercentage}%` }} className="h-full bg-gradient-to-r from-emerald-600 to-teal-400" />
            </div>
            <div className="flex justify-between text-[10px] font-bold text-slate-500"><span>Reserva: {formatCurrency(pendingSum, currency)}</span><span>{availablePercentage.toFixed(0)}% livre</span></div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-panel rounded-[2.5rem] p-8 shadow-md relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10"><Target className="w-24 h-24 text-amber-600" /></div>
          <div className="relative z-10 space-y-6">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Seu Limite Diário</div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600"><TrendingUp className="w-5 h-5" /></div>
            </div>
            <div>
              <div className="text-4xl font-black text-amber-600 font-mono tracking-tight">{formatCurrency(dailyBudget, currency)}</div>
              <p className="text-xs font-medium text-slate-600 mt-2">O máximo que você pode gastar hoje para não comprometer o mês.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-white/80 border border-slate-200/80 shadow-xs">
                <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Gasto Hoje</div>
                <div className="text-lg font-black text-slate-900 font-mono">{formatCurrency(todaySpent, currency)}</div>
              </div>
              <div className="p-4 rounded-2xl bg-white/80 border border-slate-200/80 shadow-xs">
                <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Restante</div>
                <div className={`text-lg font-black font-mono ${dailyBudget - todaySpent >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(remainingToday, currency)}</div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Advice Section */}
      <div className="p-6 rounded-[2rem] glass-card shadow-xs flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-2xl shrink-0">💡</div>
        <div>
          <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-1">Conselho SisFinz</h4>
          <p className="text-sm font-medium text-slate-600 leading-relaxed">
            {dailyBudget <= 0 ? 'Atenção! Seus compromissos superam seu saldo disponível. Evite novos gastos.' : 
             remainingToday < 0 ? 'Você ultrapassou o limite de hoje. O excedente será descontado do ritmo dos próximos dias.' :
             'Você está dentro do ritmo! Continue assim para fechar o ciclo com folga financeira.'}
          </p>
        </div>
      </div>

      {/* Reserved Money Section */}
      <div className="glass-panel rounded-[3rem] overflow-hidden shadow-md">
        <div className="p-8 border-b border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 shadow-xs"><ShieldAlert className="w-6 h-6" /></div>
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight leading-none mb-1">Reserva de Segurança</h3>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest opacity-80">Contas pendentes somente do mês atual</p>
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600 font-mono">-{formatCurrency(pendingSum, currency)}</div>
        </div>

        <div className="p-8 space-y-4">
          {pendingCommitmentsList.length === 0 ? (
            <div className="p-12 rounded-[2rem] border border-dashed border-white/5 text-center text-slate-600 font-bold">Sem contas pendentes até o próximo ingresso</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {pendingCommitmentsList.map((item, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-white/2 border border-white/5 hover:bg-white/5 transition-all flex items-center justify-between group">
                  <div className="min-w-0">
                    <div className="text-sm font-black text-slate-800 group-hover:text-amber-600 transition-colors truncate">{item.name}</div>
                    <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">{item.due < todayStr ? 'Vencida' : 'Vence'} em {item.due.split('-').reverse().join('/')}</div>
                  </div>
                  <div className="text-sm font-black text-rose-600 font-mono">-{formatCurrency(item.amount, currency)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
