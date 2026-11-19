/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
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
import { getLocaleForLanguage } from '../utils/i18n';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Zap,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
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
  currentBalance?: number;
  forecastBalance?: number;
  className?: string;
  onReturnToFinance?: () => void;
}

interface MonthFreedomData {
  month: string; // YYYY-MM
  monthTitle: string; // e.g. "NOVEMBRO"
  monthShort: string; // e.g. "NOV"
  year: number;
  totalIncomes: number;
  gastosPagados: number;
  gastosPendientes: number;
  totalExpenses: number;
  freeMoney: number;
  deficit: number;
  isDeficit: boolean;
  hasAnyRecords: boolean;
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

type SegmentKey = 'paid' | 'pending' | 'free';

function getScaleLabels(lang: LanguageCode) {
  if (lang === 'es') {
    return {
      title: 'Escala de Libertad',
      subtitle: 'Toca un mes o segmento para explorar tu saldo libre',
      proyeccion: 'Proyección',
      dineroLibreSub: 'Dinero que todavía tienes libre',
      deficitSub: 'Déficit previsto para este mes',
      yaPagado: 'Ya pagado',
      yaPagadoSub: 'Dinero que ya salió de tu cuenta',
      pendientePago: 'Pendiente',
      pendientePagoSub: 'Compromisos que todavía debes pagar',
      dineroLibre: 'Libre',
      dineroLibreLegendSub: 'Lo que todavía puedes utilizar',
      totalIngresos: 'Ingresos previstos',
      totalGastos: 'Total de salidas',
      insightTitle: 'Insight del mes',
      sobraMayor: 'Sobra mayor',
      sobraMenor: 'Sobra menor',
      mismoResultado: 'Sin cambios',
      deficitLabel: 'Déficit',
      today: 'Hoy',
      freedomPctLabel: 'libre',
      tapHint: 'Toca una tarjeta para resaltar en el arco',
    };
  }
  if (lang === 'en') {
    return {
      title: 'Freedom Scale',
      subtitle: 'Tap a month or segment to explore your free balance',
      proyeccion: 'Projection',
      dineroLibreSub: 'Money you still have free',
      deficitSub: 'Projected deficit for this month',
      yaPagado: 'Paid',
      yaPagadoSub: 'Money that already left your account',
      pendientePago: 'Pending',
      pendientePagoSub: 'Commitments you still need to pay',
      dineroLibre: 'Free',
      dineroLibreLegendSub: 'What you can still use',
      totalIngresos: 'Expected income',
      totalGastos: 'Total outflows',
      insightTitle: 'Monthly insight',
      sobraMayor: 'Higher surplus',
      sobraMenor: 'Lower surplus',
      mismoResultado: 'No change',
      deficitLabel: 'Deficit',
      today: 'Today',
      freedomPctLabel: 'free',
      tapHint: 'Tap a card to highlight on the arc',
    };
  }
  return {
    title: 'Escala de Liberdade',
    subtitle: 'Toque em um mês ou bloco para explorar seu saldo livre',
    proyeccion: 'Projeção',
    dineroLibreSub: 'Dinheiro que você ainda tem livre',
    deficitSub: 'Déficit previsto para este mês',
    yaPagado: 'Já pago',
    yaPagadoSub: 'Dinheiro que já saiu da sua conta',
    pendientePago: 'Pendente',
    pendientePagoSub: 'Compromissos que você ainda deve pagar',
    dineroLibre: 'Livre',
    dineroLibreLegendSub: 'O que você ainda pode utilizar',
    totalIngresos: 'Entradas previstas',
    totalGastos: 'Previsão de saídas',
    insightTitle: 'Insight do mês',
    sobraMayor: 'Sobra maior',
    sobraMenor: 'Sobra menor',
    mismoResultado: 'Sem alterações',
    deficitLabel: 'Déficit',
    today: 'Hoje',
    freedomPctLabel: 'livre',
    tapHint: 'Toque em um bloco para destacar no arco',
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

const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy - r * Math.sin(rad),
  };
};

const describeArc = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArcFlag = startAngle - endAngle <= 180 ? '0' : '1';
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
};

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
  currentBalance = 0,
  forecastBalance,
  className = '',
}) => {
  const locale = getLocaleForLanguage(language);
  const labels = getScaleLabels(language);

  const baseMonth = startMonth || getCurrentMonthStr();
  const [windowOffset, setWindowOffset] = useState<number>(0);
  const [monthsCount, setMonthsCount] = useState<6 | 12>(12);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [activeSegment, setActiveSegment] = useState<SegmentKey | null>(null);

  useEffect(() => {
    if (selectedIndex >= monthsCount) {
      setSelectedIndex(0);
    }
  }, [monthsCount, selectedIndex]);

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

      // Keep the current month's free-money figure aligned with the shared
      // account-based month-end forecast used by the Finance and Planning screens.
      const isCurrentMonth = targetMonth === getCurrentMonthStr();
      const netMoney = isCurrentMonth && forecastBalance !== undefined
        ? forecastBalance
        : sumIncomes - (gastosPagados + gastosPendientes);
      const isDeficit = netMoney < 0;
      const totalExpenses = gastosPagados + gastosPendientes;
      const freeVal = isDeficit ? 0 : Math.max(0, netMoney);
      const baseScale = Math.max(gastosPagados + gastosPendientes + freeVal, sumIncomes, 1);

      return {
        totalIncomes: sumIncomes,
        gastosPagados,
        gastosPendientes,
        totalExpenses,
        freeMoney: freeVal,
        deficit: isDeficit ? Math.abs(netMoney) : 0,
        isDeficit,
        hasAnyRecords: sumIncomes > 0 || totalExpenses > 0 || (isCurrentMonth && netMoney !== 0),
        paidPct: (gastosPagados / baseScale) * 100,
        pendingPct: (gastosPendientes / baseScale) * 100,
        freePct: isDeficit ? 0 : (freeVal / baseScale) * 100,
        deficitPct: isDeficit ? Math.min(100, (Math.abs(netMoney) / Math.max(totalExpenses, 1)) * 100) : 0,
        insightText: generateMonthlyInsight(gastosPagados, gastosPendientes, freeVal, sumIncomes, isDeficit, isDeficit ? Math.abs(netMoney) : 0, currency, language),
      };
    };
  }, [incomes, bills, sharedBills, expenses, checkIsBillPaid, checkIsSharedBillPaid, userId, currency, language, forecastBalance, currentBalance]);

  const monthsData = useMemo<MonthFreedomData[]>(() => {
    const list: MonthFreedomData[] = [];
    const preFirstFigures = computeMonthFigures(shiftMonthStr(activeStartMonth, -1));

    for (let i = 0; i < monthsCount; i++) {
      const mStr = shiftMonthStr(activeStartMonth, i);
      const figures = computeMonthFigures(mStr);
      const d = new Date(parseInt(mStr.split('-')[0]), parseInt(mStr.split('-')[1]) - 1, 1);
      const monthTitle = d.toLocaleDateString(locale, { month: 'long' });
      const monthShort = d
        .toLocaleDateString(locale, { month: 'short' })
        .replace('.', '')
        .slice(0, 3)
        .toUpperCase();

      const prevFigures = i === 0 ? preFirstFigures : list[i - 1];
      let comparisonType: 'higher' | 'lower' | 'equal' | 'none' = 'none';
      if (prevFigures && prevFigures.hasAnyRecords) {
        const diff = figures.freeMoney - prevFigures.freeMoney;
        comparisonType = diff > 0.01 ? 'higher' : diff < -0.01 ? 'lower' : 'equal';
      }

      list.push({
        month: mStr,
        monthTitle,
        monthShort,
        year: d.getFullYear(),
        ...figures,
        prevMonthStr: shiftMonthStr(mStr, -1),
        prevMonthFreeMoney: prevFigures ? prevFigures.freeMoney : null,
        hasPrevData: prevFigures ? prevFigures.hasAnyRecords : false,
        diffFromPrev: prevFigures ? figures.freeMoney - prevFigures.freeMoney : null,
        comparisonType,
      });
    }
    return list;
  }, [activeStartMonth, monthsCount, computeMonthFigures, locale]);

  const activeItem = monthsData[selectedIndex] || monthsData[0];

  // Build semicircular gauge segments (180° left to 0° right)
  const gaugeSegments = useMemo(() => {
    if (!activeItem) return [];
    const cx = 140;
    const cy = 138;
    const r = 104;

    if (activeItem.isDeficit) {
      return [
        {
          key: 'free' as SegmentKey,
          path: describeArc(cx, cy, r, 180, 0),
          color: '#e11d48',
          pct: 100,
        },
      ];
    }

    const allSegments: { key: SegmentKey; pct: number; color: string }[] = [
      { key: 'paid', pct: activeItem.paidPct, color: '#94a3b8' },
      { key: 'pending', pct: activeItem.pendingPct, color: '#f59e0b' },
      { key: 'free', pct: activeItem.freePct, color: '#059669' },
    ];
    const rawSegments = allSegments.filter((s) => s.pct > 0.5);

    const totalPct = rawSegments.reduce((acc, s) => acc + s.pct, 0);
    if (totalPct <= 0) return [];

    const gapDeg = rawSegments.length > 1 ? 3 : 0;
    const availableDeg = 180 - gapDeg * (rawSegments.length - 1);
    let cursor = 180;

    return rawSegments.map((seg, idx) => {
      const sweep = Math.max(2, (seg.pct / totalPct) * availableDeg);
      const startAngle = cursor;
      const endAngle = idx === rawSegments.length - 1 ? 0 : Math.max(0, cursor - sweep);
      cursor = endAngle - gapDeg;
      return {
        key: seg.key,
        path: describeArc(cx, cy, r, startAngle, endAngle),
        color: seg.color,
        pct: Math.round(seg.pct),
      };
    });
  }, [activeItem]);

  const centerReadout = useMemo(() => {
    if (!activeItem) {
      return { value: formatCurrency(0, currency), subtitle: '', badge: '0%', colorClass: 'text-slate-900', badgeClass: 'bg-slate-100 text-slate-600' };
    }
    if (activeSegment === 'paid') {
      return {
        value: formatCurrency(activeItem.gastosPagados, currency),
        subtitle: labels.yaPagadoSub,
        badge: `${Math.round(activeItem.paidPct)}% ${labels.yaPagado.toLowerCase()}`,
        colorClass: 'text-slate-800',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
      };
    }
    if (activeSegment === 'pending') {
      return {
        value: formatCurrency(activeItem.gastosPendientes, currency),
        subtitle: labels.pendientePagoSub,
        badge: `${Math.round(activeItem.pendingPct)}% ${labels.pendientePago.toLowerCase()}`,
        colorClass: 'text-amber-600',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
      };
    }
    if (activeItem.isDeficit) {
      return {
        value: `-${formatCurrency(activeItem.deficit, currency)}`,
        subtitle: labels.deficitSub,
        badge: labels.deficitLabel,
        colorClass: 'text-rose-600',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
      };
    }
    return {
      value: formatCurrency(activeItem.freeMoney, currency),
      subtitle: labels.dineroLibreSub,
      badge: `${Math.round(activeItem.freePct)}% ${labels.freedomPctLabel}`,
      colorClass: 'text-emerald-600',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
  }, [activeItem, activeSegment, currency, labels]);

  const toggleSegment = (key: SegmentKey) => {
    setActiveSegment((prev) => (prev === key ? null : key));
  };

  if (!activeItem) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className={`space-y-4 ${className}`}
    >
      {/* Compact Header & Period Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-600/20">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
              {labels.title}
            </h3>
            <p className="text-[10px] font-semibold text-slate-500">
              {labels.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-emerald-200/80 bg-white p-0.5 shadow-2xs">
            {([6, 12] as const).map((n) => (
              <button
                type="button"
                key={n}
                onClick={() => setMonthsCount(n)}
                className={`rounded-lg px-2.5 py-1.5 text-[10px] font-black transition-all cursor-pointer ${
                  monthsCount === n
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {n}M
              </button>
            ))}
          </div>

          <div className="flex items-center gap-0.5 rounded-xl border border-emerald-200/80 bg-white p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => { setWindowOffset((v) => v - 1); setActiveSegment(null); }}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 transition-colors cursor-pointer"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {windowOffset !== 0 && (
              <button
                type="button"
                onClick={() => { setWindowOffset(0); setSelectedIndex(0); setActiveSegment(null); }}
                className="px-2 text-[10px] font-black uppercase tracking-wider text-emerald-700 hover:underline cursor-pointer"
              >
                {labels.today}
              </button>
            )}
            <button
              type="button"
              onClick={() => { setWindowOffset((v) => v + 1); setActiveSegment(null); }}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 transition-colors cursor-pointer"
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal Interactive Month Selector */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
        {monthsData.map((m, idx) => {
          const isSelected = idx === selectedIndex;
          const dotColor = m.isDeficit
            ? 'bg-rose-500'
            : m.freeMoney > 0
            ? 'bg-emerald-500'
            : 'bg-slate-300';

          return (
            <button
              type="button"
              key={m.month}
              onClick={() => {
                setSelectedIndex(idx);
                setActiveSegment(null);
              }}
              className={`relative shrink-0 rounded-2xl border px-3.5 py-2.5 text-center transition-all cursor-pointer ${
                isSelected
                  ? m.isDeficit
                    ? 'border-rose-500 bg-rose-600 text-white shadow-md shadow-rose-600/20'
                    : 'border-emerald-600 bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'border-slate-200/90 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50/40'
              }`}
            >
              <div className="flex items-center justify-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isSelected ? 'bg-white' : dotColor
                  }`}
                />
                <span className="text-[11px] font-black tracking-wider">
                  {m.monthShort}
                </span>
              </div>
              <div
                className={`mt-0.5 text-[9px] font-bold ${
                  isSelected ? 'text-white/80' : 'text-slate-400'
                }`}
              >
                {String(m.year).slice(-2)}
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Animated Gauge Card */}
      <motion.section
        layout
        className="overflow-hidden rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-lg shadow-emerald-900/5 sm:p-7"
      >
        {/* Month Title & Trend Badge */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-emerald-600">
              {activeItem.month === getCurrentMonthStr() ? 'Mês atual' : labels.proyeccion}
            </p>
            <h4 className="mt-0.5 text-xl font-black capitalize tracking-tight text-slate-900 sm:text-2xl">
              {activeItem.monthTitle}{' '}
              <span className="font-mono text-slate-400">{activeItem.year}</span>
            </h4>
          </div>

          <div
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
              activeItem.isDeficit
                ? 'border-rose-200 bg-rose-50 text-rose-700'
                : activeItem.comparisonType === 'higher'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : activeItem.comparisonType === 'lower'
                ? 'border-amber-200 bg-amber-50 text-amber-700'
                : 'border-emerald-100 bg-emerald-50/60 text-emerald-700'
            }`}
          >
            {activeItem.isDeficit ? (
              <AlertTriangle className="h-3 w-3" />
            ) : (
              <ArrowUpRight
                className={`h-3 w-3 ${
                  activeItem.comparisonType === 'lower' ? 'rotate-90' : ''
                }`}
              />
            )}
            <span>
              {activeItem.isDeficit
                ? labels.deficitLabel
                : activeItem.comparisonType === 'higher'
                ? labels.sobraMayor
                : activeItem.comparisonType === 'lower'
                ? labels.sobraMenor
                : labels.proyeccion}
            </span>
          </div>
        </div>

        {/* Interactive Semicircular Freedom Gauge */}
        <div className="relative mx-auto mt-4 flex max-w-[320px] flex-col items-center">
          <svg
            viewBox="0 0 280 156"
            className="w-full overflow-visible"
            role="img"
            aria-label={`${labels.title} - ${activeItem.monthTitle}`}
          >
            {/* Background Track */}
            <path
              d={describeArc(140, 138, 104, 180, 0)}
              fill="none"
              stroke="#eef2f6"
              strokeWidth="18"
              strokeLinecap="round"
            />

            {/* Animated Arc Segments */}
            {gaugeSegments.map((seg) => {
              const isHighlighted = activeSegment === seg.key;
              const isDimmed = activeSegment !== null && activeSegment !== seg.key;

              return (
                <motion.path
                  key={`${activeItem.month}-${seg.key}`}
                  d={seg.path}
                  fill="none"
                  stroke={seg.color}
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0.4 }}
                  animate={{
                    pathLength: 1,
                    opacity: isDimmed ? 0.25 : 1,
                    strokeWidth: isHighlighted ? 22 : 18,
                  }}
                  transition={{ duration: 0.65, ease: 'easeOut' }}
                  onClick={() => !activeItem.isDeficit && toggleSegment(seg.key)}
                  className={!activeItem.isDeficit ? 'cursor-pointer' : ''}
                />
              );
            })}
          </svg>

          {/* Center Readout Inside the Arc */}
          <div className="pointer-events-none -mt-20 flex flex-col items-center text-center sm:-mt-22">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeItem.month}-${activeSegment || 'default'}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col items-center"
              >
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${centerReadout.badgeClass}`}
                >
                  {centerReadout.badge}
                </span>
                <div
                  className={`mt-1.5 font-mono text-2xl font-black tracking-tight sm:text-3xl ${centerReadout.colorClass}`}
                >
                  {centerReadout.value}
                </div>
                <p className="mt-1 max-w-[210px] text-[11px] font-semibold leading-snug text-slate-500">
                  {centerReadout.subtitle}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Interactive Clickable Breakdown Pills */}
        <div className="mt-6">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              {
                key: 'paid' as SegmentKey,
                label: labels.yaPagado,
                val: activeItem.gastosPagados,
                pct: Math.round(activeItem.paidPct),
                dot: 'bg-slate-400',
                activeStyle: 'border-slate-400 bg-slate-50 ring-2 ring-slate-200/80',
                valClass: 'text-slate-800',
              },
              {
                key: 'pending' as SegmentKey,
                label: labels.pendientePago,
                val: activeItem.gastosPendientes,
                pct: Math.round(activeItem.pendingPct),
                dot: 'bg-amber-500',
                activeStyle: 'border-amber-400 bg-amber-50/80 ring-2 ring-amber-100',
                valClass: 'text-amber-700',
              },
              {
                key: 'free' as SegmentKey,
                label: activeItem.isDeficit ? labels.deficitLabel : labels.dineroLibre,
                val: activeItem.isDeficit ? activeItem.deficit : activeItem.freeMoney,
                pct: activeItem.isDeficit ? Math.round(activeItem.deficitPct) : Math.round(activeItem.freePct),
                dot: activeItem.isDeficit ? 'bg-rose-500' : 'bg-emerald-600',
                activeStyle: activeItem.isDeficit
                  ? 'border-rose-400 bg-rose-50 ring-2 ring-rose-100'
                  : 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-100',
                valClass: activeItem.isDeficit ? 'text-rose-700' : 'text-emerald-700',
              },
            ].map((pill) => {
              const isSelected = activeSegment === pill.key;
              return (
                <motion.button
                  type="button"
                  key={pill.key}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => toggleSegment(pill.key)}
                  className={`rounded-2xl border p-3 text-left transition-all cursor-pointer ${
                    isSelected
                      ? pill.activeStyle
                      : 'border-slate-200/80 bg-slate-50/60 hover:border-emerald-200 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${pill.dot}`} />
                      <span className="truncate text-[9px] font-black uppercase tracking-wider text-slate-500">
                        {pill.label}
                      </span>
                    </div>
                  </div>
                  <div className={`mt-1.5 truncate font-mono text-xs font-black sm:text-sm ${pill.valClass}`}>
                    {activeItem.isDeficit && pill.key === 'free' ? '-' : ''}
                    {formatCurrency(pill.val, currency)}
                  </div>
                  <div className="mt-0.5 text-[10px] font-bold text-slate-400">
                    {pill.pct}%
                  </div>
                </motion.button>
              );
            })}
          </div>
          <p className="mt-2 text-center text-[10px] font-semibold text-slate-400">
            {labels.tapHint}
          </p>
        </div>

        {/* Income vs Outflow Summary Strip */}
        <div className="mt-4 grid grid-cols-2 gap-2.5 border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-2.5">
            <div className="min-w-0">
              <div className="flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider text-emerald-800/80">
                <Wallet className="h-3 w-3 shrink-0 text-emerald-600" />
                <span className="truncate">{labels.totalIngresos}</span>
              </div>
              <div className="mt-0.5 truncate font-mono text-xs font-black text-emerald-700 sm:text-sm">
                +{formatCurrency(activeItem.totalIncomes, currency)}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-rose-100 bg-rose-50/50 px-3 py-2.5">
            <div className="min-w-0">
              <div className="flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider text-rose-800/80">
                <ArrowDownLeft className="h-3 w-3 shrink-0 text-rose-500" />
                <span className="truncate">{labels.totalGastos}</span>
              </div>
              <div className="mt-0.5 truncate font-mono text-xs font-black text-rose-600 sm:text-sm">
                -{formatCurrency(activeItem.totalExpenses, currency)}
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Smart Insight */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`insight-${activeItem.month}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className={`mt-4 flex items-start gap-3 rounded-2xl border p-3.5 ${
              activeItem.isDeficit
                ? 'border-rose-200/80 bg-rose-50/70 text-rose-900'
                : 'border-emerald-200/80 bg-emerald-50/60 text-emerald-950'
            }`}
          >
            <div
              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${
                activeItem.isDeficit
                  ? 'bg-rose-100 text-rose-600'
                  : 'bg-emerald-600 text-white'
              }`}
            >
              {activeItem.isDeficit ? (
                <AlertTriangle className="h-3.5 w-3.5" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-wider opacity-75">
                {labels.insightTitle}
              </p>
              <p className="mt-0.5 text-xs font-medium leading-relaxed opacity-90">
                {activeItem.insightText}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.section>
    </motion.div>
  );
};
