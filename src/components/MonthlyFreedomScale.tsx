/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  BillItem,
  IncomeItem,
  ExpenseItem,
  SharedBill,
  MonthlyStatusRecord,
  CurrencyCode,
  LanguageCode,
} from '../types';
import { formatCurrency } from '../utils/currency';
import {
  shiftMonthStr,
  doesItemOccurInMonth,
  getCurrentMonthStr,
} from '../utils/finance';
import { getTranslations, getLocaleForLanguage } from '../utils/i18n';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Calendar,
  Zap,
  Clock,
  ArrowUpRight,
  Info,
} from 'lucide-react';

interface MonthlyFreedomScaleProps {
  bills: BillItem[];
  incomes: IncomeItem[];
  expenses: ExpenseItem[];
  sharedBills?: SharedBill[];
  statusRecords?: MonthlyStatusRecord[];
  userId?: string;
  currency: CurrencyCode;
  language?: LanguageCode;
  startMonth?: string; // YYYY-MM
  className?: string;
  onReturnToFinance?: () => void;
}

interface MonthFreedomData {
  month: string; // YYYY-MM
  monthTitle: string; // e.g. "NOVIEMBRE"
  year: number;
  totalIncomes: number;
  gastosPagados: number;
  gastosPendientes: number;
  totalExpenses: number;
  freeMoney: number;
  deficit: number;
  isDeficit: boolean;
  prevMonthStr: string;
  prevMonthFreeMoney: number | null;
  hasPrevData: boolean;
  diffFromPrev: number | null;
  comparisonType: 'higher' | 'lower' | 'equal' | 'none';
  paidPct: number;
  pendingPct: number;
  freePct: number;
  deficitPct: number;
  insightText: string;
}

function getScaleLabels(lang: LanguageCode) {
  if (lang === 'es') {
    return {
      title: 'Escala de Libertad',
      subtitle: 'Distribución inteligente de tus ingresos previstos y dinero libre',
      proyeccion: 'Proyección',
      dineroLibreSub: 'Dinero que todavía tienes libre',
      deficitSub: 'Déficit acumulado para este mes',
      distribucionHeader: 'Distribución de tus ingresos previstos:',
      yaPagado: 'Ya pagado',
      yaPagadoSub: 'Dinero que ya salió de tu cuenta',
      pendientePago: 'Pendiente de pago',
      pendientePagoSub: 'Compromisos que todavía debes pagar',
      dineroLibre: 'Dinero libre',
      dineroLibreLegendSub: 'Lo que todavía puedes utilizar',
      totalIngresos: 'Total de ingresos',
      totalGastos: 'Total de gastos (pagados + pendientes)',
      insightTitle: 'Insight del mes',
      sobraMayor: 'Sobra mayor',
      sobraMenor: 'Sobra menor',
      mismoResultado: 'Sin cambios',
      deficitLabel: 'Déficit',
      prevMonthMore: 'a más que',
      prevMonthLess: 'a menos que',
      months: 'meses',
      today: 'Hoy',
    };
  }
  if (lang === 'en') {
    return {
      title: 'Freedom Scale',
      subtitle: 'Smart distribution of your expected income and free money',
      proyeccion: 'Projection',
      dineroLibreSub: 'Money you still have free',
      deficitSub: 'Accumulated deficit for this month',
      distribucionHeader: 'Distribution of expected income:',
      yaPagado: 'Already paid',
      yaPagadoSub: 'Money that already left your account',
      pendientePago: 'Pending payment',
      pendientePagoSub: 'Commitments you still need to pay',
      dineroLibre: 'Free money',
      dineroLibreLegendSub: 'What you can still use',
      totalIngresos: 'Total income',
      totalGastos: 'Total expenses (paid + pending)',
      insightTitle: 'Monthly insight',
      sobraMayor: 'Higher surplus',
      sobraMenor: 'Lower surplus',
      mismoResultado: 'No change',
      deficitLabel: 'Deficit',
      prevMonthMore: 'more than',
      prevMonthLess: 'less than',
      months: 'months',
      today: 'Today',
    };
  }
  return {
    title: 'Escala de Liberdade',
    subtitle: 'Distribuição inteligente do seu dinheiro previsto e saldo livre',
    proyeccion: 'Projeção',
    dineroLibreSub: 'Dinheiro que você ainda tem livre',
    deficitSub: 'Déficit acumulado para este mês',
    distribucionHeader: 'Distribuição da sua renda prevista:',
    yaPagado: 'Já pago',
    yaPagadoSub: 'Dinheiro que já saiu da sua conta',
    pendientePago: 'Pendente de pagamento',
    pendientePagoSub: 'Compromissos que você ainda deve pagar',
    dineroLibre: 'Dinheiro livre',
    dineroLibreLegendSub: 'O que você ainda pode utilizar',
    totalIngresos: 'Total de receitas',
    totalGastos: 'Total de gastos (pagos + pendentes)',
    insightTitle: 'Insight do mês',
    sobraMayor: 'Sobra maior',
    sobraMenor: 'Sobra menor',
    mismoResultado: 'Sem alterações',
    deficitLabel: 'Déficit',
    prevMonthMore: 'a mais que',
    prevMonthLess: 'a menos que',
    months: 'meses',
    today: 'Hoje',
  };
}

function generateMonthlyInsight(
  gastosPagados: number,
  gastosPendientes: number,
  freeMoney: number,
  totalIncomes: number,
  isDeficit: boolean,
  deficit: number,
  currency: CurrencyCode,
  language: LanguageCode
): string {
  const formattedPagados = formatCurrency(gastosPagados, currency);
  const formattedPendientes = formatCurrency(gastosPendientes, currency);
  const formattedFree = formatCurrency(freeMoney, currency);
  const formattedIncome = formatCurrency(totalIncomes, currency);
  const formattedDeficit = formatCurrency(deficit, currency);
  const totalExpensesFormatted = formatCurrency(gastosPagados + gastosPendientes, currency);

  if (language === 'es') {
    if (isDeficit) {
      return `¡Atención! Tus gastos previstos (${totalExpensesFormatted}) superan tus ingresos previstos (${formattedIncome}). Tendrás un déficit de ${formattedDeficit} este mes. Te sugerimos revisar o postergar pagos no urgentes.`;
    }
    if (totalIncomes === 0) {
      return `No tienes ingresos previstos registrados para este mes. Tienes ${formattedPendientes} en compromisos pendientes.`;
    }
    if (gastosPagados === 0 && gastosPendientes === 0) {
      return `No tienes gastos registrados para este mes. El total de tus ingresos (${formattedIncome}) se encuentra completamente libre.`;
    }
    return `Ya utilizaste ${formattedPagados} de tus ingresos. Además, tienes ${formattedPendientes} comprometidos en pagos pendientes. Si mantienes esta planificación, todavía tendrás ${formattedFree} disponibles.`;
  }

  if (language === 'en') {
    if (isDeficit) {
      return `Attention! Your planned expenses (${totalExpensesFormatted}) exceed your expected income (${formattedIncome}). You will have a deficit of ${formattedDeficit} this month.`;
    }
    if (totalIncomes === 0) {
      return `You have no expected income registered for this month. You have ${formattedPendientes} in pending commitments.`;
    }
    if (gastosPagados === 0 && gastosPendientes === 0) {
      return `You have no expenses recorded for this month. Your entire income (${formattedIncome}) is completely free.`;
    }
    return `You have already spent ${formattedPagados} of your income. Additionally, you have ${formattedPendientes} committed in pending payments. If you maintain this plan, you will still have ${formattedFree} available.`;
  }

  // Default pt
  if (isDeficit) {
    return `Atenção! Seus gastos previstos (${totalExpensesFormatted}) superam suas receitas previstas (${formattedIncome}). Você terá um déficit de ${formattedDeficit} este mês.`;
  }
  if (totalIncomes === 0) {
    return `Você não possui receitas registradas para este mês. Há ${formattedPendientes} em compromissos pendentes.`;
  }
  if (gastosPagados === 0 && gastosPendientes === 0) {
    return `Você não tem despesas registradas para este mês. Toda a sua renda (${formattedIncome}) está totalmente livre.`;
  }
  return `Você já utilizou ${formattedPagados} da sua renda. Além disso, tem ${formattedPendientes} comprometidos em pagamentos pendentes. Se mantiver esse planejamento, ainda terá ${formattedFree} disponíveis.`;
}

export const MonthlyFreedomScale: React.FC<MonthlyFreedomScaleProps> = ({
  bills = [],
  incomes = [],
  expenses = [],
  sharedBills = [],
  statusRecords = [],
  userId,
  currency,
  language = 'pt',
  startMonth,
  className = '',
  onReturnToFinance,
}) => {
  const t = getTranslations(language);
  const locale = getLocaleForLanguage(language);
  const labels = getScaleLabels(language);

  // Month navigation window state
  const baseMonth = startMonth || getCurrentMonthStr();
  const [windowOffset, setWindowOffset] = useState<number>(0);
  const [monthsCount, setMonthsCount] = useState<6 | 12>(6);

  const activeStartMonth = useMemo(() => {
    return shiftMonthStr(baseMonth, windowOffset);
  }, [baseMonth, windowOffset]);

  const statusMap = useMemo(() => {
    const map = new Map<string, MonthlyStatusRecord>();
    for (const rec of statusRecords) {
      if (!rec) continue;
      map.set(rec.id, rec);
      if (rec.itemId && rec.month) {
        map.set(`${rec.itemId}_${rec.month}`, rec);
        const cleanId = rec.itemId.replace(/^bill_/, '').replace(/^sb_/, '');
        map.set(`${cleanId}_${rec.month}`, rec);
      }
    }
    return map;
  }, [statusRecords]);

  const checkIsBillPaid = useMemo(() => {
    return (bill: BillItem, targetMonth: string): boolean => {
      const cleanId = bill.id.replace(/^bill_/, '').replace(/^sb_/, '');
      const keysToTry = [`bill_${bill.id}_${targetMonth}`, `${bill.id}_${targetMonth}`, `${cleanId}_${targetMonth}`];

      for (const k of keysToTry) {
        const rec = statusMap.get(k);
        if (rec) {
          if (rec.isCompleted === true || (rec as any).isPaid === true || (rec as any).status === 'paid' || !!rec.completedAt) return true;
          if (rec.isCompleted === false || (rec as any).status === 'pending') return false;
        }
      }

      const exc = bill.exceptions?.[targetMonth];
      if (exc && ((exc as any).status === 'paid' || (exc as any).isCompleted === true)) return true;

      return false;
    };
  }, [statusMap]);

  const checkIsSharedBillPaid = useMemo(() => {
    return (sb: SharedBill, targetMonth: string, userUid: string): boolean => {
      const exc = sb.exceptions?.[targetMonth];
      if ((exc as any)?.status === 'paid' || (userUid && exc?.shares?.[userUid]?.status === 'paid')) return true;
      if (sb.recurrence === 'none' && sb.status === 'paid') return true;
      return false;
    };
  }, []);

  const computeMonthFigures = useMemo(() => {
    return (targetMonth: string) => {
      let sumIncomes = 0;
      for (const inc of incomes) {
        if (doesItemOccurInMonth(inc.startMonth, targetMonth, inc.recurrence, inc.recurrenceMonthsCount)) {
          const exc = inc.exceptions?.[targetMonth];
          if (!exc?.isDeleted && !inc.excludedMonths?.includes(targetMonth) && !inc.isRefund && !inc.isRefunded) {
             sumIncomes += exc?.amount ?? inc.amount;
          }
        }
      }

      let gastosPagados = 0;
      let gastosPendientes = 0;

      for (const bill of bills) {
        if (sharedBills?.some(s => s.id === bill.id.replace(/^sb_/, '').replace(/^bill_/, ''))) continue;
        if (doesItemOccurInMonth(bill.startMonth, targetMonth, bill.recurrence, bill.recurrenceMonthsCount)) {
          const exc = bill.exceptions?.[targetMonth];
          if (!exc?.isDeleted && !bill.excludedMonths?.includes(targetMonth) && !bill.isRefund && !bill.isRefunded) {
            const isPaid = checkIsBillPaid(bill, targetMonth);
            if (isPaid) gastosPagados += exc?.amount ?? bill.amount;
            else gastosPendientes += exc?.amount ?? bill.amount;
          }
        }
      }

      for (const sb of sharedBills) {
        const start = sb.startMonth || sb.month || sb.dueDate?.substring(0, 7) || '';
        if (doesItemOccurInMonth(start, targetMonth, sb.recurrence || 'none', sb.recurrenceMonthsCount)) {
          const exc = sb.exceptions?.[targetMonth];
          if (!exc?.isDeleted && !sb.excludedMonths?.includes(targetMonth) && !sb.isRefund && !sb.isRefunded) {
            const userUid = userId || (sb.shares ? Object.keys(sb.shares)[0] : '');
            const myShare = userUid && sb.shares?.[userUid] ? sb.shares[userUid].amount : (sb.amount / 2);
            if (checkIsSharedBillPaid(sb, targetMonth, userUid)) gastosPagados += myShare;
            else gastosPendientes += myShare;
          }
        }
      }

      for (const exp of expenses) {
        if (exp.date?.startsWith(targetMonth) && !exp.isRefund && !exp.isRefunded) {
          gastosPagados += exp.amount;
        }
      }

      const netMoney = sumIncomes - (gastosPagados + gastosPendientes);
      const isDeficit = netMoney < 0;
      const baseScale = Math.max(sumIncomes, gastosPagados + gastosPendientes, 1);

      return {
        totalIncomes: sumIncomes,
        gastosPagados,
        gastosPendientes,
        freeMoney: isDeficit ? 0 : netMoney,
        deficit: isDeficit ? Math.abs(netMoney) : 0,
        isDeficit,
        hasAnyRecords: sumIncomes > 0 || (gastosPagados + gastosPendientes) > 0,
        paidPct: (gastosPagados / baseScale) * 100,
        pendingPct: (gastosPendientes / baseScale) * 100,
        freePct: isDeficit ? 0 : (Math.max(0, netMoney) / baseScale) * 100,
        deficitPct: isDeficit ? (Math.abs(netMoney) / baseScale) * 100 : 0,
        insightText: generateMonthlyInsight(gastosPagados, gastosPendientes, isDeficit ? 0 : netMoney, sumIncomes, isDeficit, isDeficit ? Math.abs(netMoney) : 0, currency, language),
      };
    };
  }, [incomes, bills, sharedBills, expenses, checkIsBillPaid, checkIsSharedBillPaid, userId, currency, language]);

  const monthsData = useMemo<MonthFreedomData[]>(() => {
    const list: MonthFreedomData[] = [];
    const preFirstFigures = computeMonthFigures(shiftMonthStr(activeStartMonth, -1));

    for (let i = 0; i < monthsCount; i++) {
      const mStr = shiftMonthStr(activeStartMonth, i);
      const figures = computeMonthFigures(mStr);
      const d = new Date(parseInt(mStr.split('-')[0]), parseInt(mStr.split('-')[1]) - 1, 1);
      const monthTitle = d.toLocaleDateString(locale, { month: 'long' }).toUpperCase();

      const prevFigures = i === 0 ? preFirstFigures : list[i - 1];
      let comparisonType: 'higher' | 'lower' | 'equal' | 'none' = 'none';
      if (prevFigures && (prevFigures as any).hasAnyRecords) {
        const diff = figures.freeMoney - (prevFigures as any).freeMoney;
        comparisonType = diff > 0.01 ? 'higher' : diff < -0.01 ? 'lower' : 'equal';
      }

      list.push({
        month: mStr, monthTitle, year: d.getFullYear(),
        ...figures,
        prevMonthStr: shiftMonthStr(mStr, -1),
        prevMonthFreeMoney: prevFigures ? (prevFigures as any).freeMoney : null,
        hasPrevData: prevFigures ? (prevFigures as any).hasAnyRecords : false,
        diffFromPrev: prevFigures ? figures.freeMoney - (prevFigures as any).freeMoney : null,
        comparisonType
      } as any);
    }
    return list;
  }, [activeStartMonth, monthsCount, computeMonthFigures, locale]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass-panel rounded-[2.5rem] p-8 sm:p-10 space-y-10 relative overflow-hidden shadow-md ${className}`}
    >
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-[1.5rem] bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 shadow-inner border border-emerald-500/20">
            <Zap className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase flex items-center gap-3">
              {labels.title}
              <span className="text-[10px] font-black px-3 py-1 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-200">
                PROJEÇÃO {monthsCount}M
              </span>
            </h3>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">
              {labels.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 self-end md:self-auto">
          <div className="p-1 rounded-2xl bg-white/60 border border-emerald-500/20 backdrop-blur-sm flex">
            {[6, 12].map(n => (
              <button
                key={n}
                onClick={() => setMonthsCount(n as any)}
                className={`px-5 py-2.5 rounded-xl text-[10px] font-black transition-all cursor-pointer ${monthsCount === n ? 'bg-white text-slate-900 shadow-sm border border-emerald-500/20' : 'text-slate-500'}`}
              >
                {n} MESES
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 p-1 rounded-2xl bg-white/60 border border-emerald-500/20 backdrop-blur-sm">
             <button onClick={() => setWindowOffset(v => v - 1)} className="p-2.5 rounded-xl hover:bg-white text-slate-500 hover:text-slate-900 transition-all cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
             {windowOffset !== 0 && <button onClick={() => setWindowOffset(0)} className="px-3 text-[10px] font-black text-emerald-600 uppercase tracking-widest">{labels.today}</button>}
             <button onClick={() => setWindowOffset(v => v + 1)} className="p-2.5 rounded-xl hover:bg-white text-slate-500 hover:text-slate-900 transition-all cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {/* Grid of months */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <AnimatePresence mode="popLayout">
          {monthsData.map((item, idx) => (
            <motion.div
              layout
              key={item.month}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05, type: "spring", damping: 25 }}
              className="p-8 rounded-[2.5rem] glass-panel border border-emerald-500/20 space-y-8 relative overflow-hidden group shadow-xs"
            >
              <div className="flex items-center justify-between relative z-10">
                <div className="space-y-1">
                  <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                    {item.monthTitle} <span className="text-slate-400 font-mono-numbers">{item.year}</span>
                  </h4>
                  <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                     <Clock className="w-3 h-3" />
                     <span>DISPONIBILIDADE REAL</span>
                  </div>
                </div>

                <div className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border flex items-center gap-2 ${
                  item.isDeficit ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' : 
                  item.comparisonType === 'higher' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                  item.comparisonType === 'lower' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                  'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  {item.isDeficit ? <AlertTriangle className="w-3 h-3" /> : <ArrowUpRight className={`w-3 h-3 ${item.comparisonType === 'lower' ? 'rotate-90' : ''}`} />}
                  {item.isDeficit ? labels.deficitLabel : item.comparisonType === 'higher' ? labels.sobraMayor : item.comparisonType === 'lower' ? labels.sobraMenor : labels.proyeccion}
                </div>
              </div>

              <div className="space-y-2 relative z-10">
                 <div className={`text-4xl font-black font-mono-numbers tracking-tighter ${item.isDeficit ? 'text-rose-600' : 'text-emerald-500'}`}>
                    {item.isDeficit ? `-${formatCurrency(item.deficit, currency)}` : formatCurrency(item.freeMoney, currency)}
                 </div>
                 <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                    {item.isDeficit ? labels.deficitSub : labels.dineroLibreSub}
                 </p>
              </div>

              {/* Progress Scale */}
              <div className="space-y-4 relative z-10">
                 <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                    <span>FLUXO DE CAIXA</span>
                    <span className="font-mono-numbers text-slate-900">IN {formatCurrency(item.totalIncomes, currency)}</span>
                 </div>
                 <div className="h-6 w-full bg-emerald-50/50 rounded-[1.25rem] overflow-hidden flex shadow-inner p-1 border border-emerald-100">
                    {item.paidPct > 0 && <motion.div initial={{ width: 0 }} animate={{ width: `${item.paidPct}%` }} className="h-full bg-slate-400 rounded-lg mr-0.5" />}
                    {item.pendingPct > 0 && <motion.div initial={{ width: 0 }} animate={{ width: `${item.pendingPct}%` }} className="h-full bg-amber-500 rounded-lg mr-0.5 shadow-lg shadow-amber-500/20" />}
                    {item.freePct > 0 && <motion.div initial={{ width: 0 }} animate={{ width: `${item.freePct}%` }} className="h-full bg-emerald-500 rounded-lg shadow-lg shadow-emerald-500/20" />}
                    {item.isDeficit && <motion.div initial={{ width: 0 }} animate={{ width: `${item.deficitPct}%` }} className="h-full bg-rose-500 rounded-lg shadow-lg shadow-rose-500/20" />}
                 </div>
              </div>

              {/* Legend Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
                 {[
                   { label: labels.yaPagado, val: item.gastosPagados, color: 'bg-slate-400', sub: labels.yaPagadoSub },
                   { label: labels.pendientePago, val: item.gastosPendientes, color: 'bg-amber-500', sub: labels.pendientePagoSub },
                 ].map(l => (
                   <div key={l.label} className="p-4 rounded-2xl bg-white/80 border border-emerald-500/10 space-y-1">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${l.color}`} />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{l.label}</span>
                      </div>
                      <div className="text-sm font-black font-mono-numbers text-slate-900 tracking-tight">{formatCurrency(l.val, currency)}</div>
                   </div>
                 ))}
              </div>

            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
