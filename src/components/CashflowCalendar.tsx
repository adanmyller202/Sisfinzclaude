/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { MonthTimelineItem, CurrencyCode, LanguageCode } from '../types';
import { formatCurrency } from '../utils/currency';
import { getTodayStr, formatMonthName } from '../utils/finance';
import { getTranslations, getLocaleForLanguage } from '../utils/i18n';
import { motion, AnimatePresence } from 'motion/react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Sparkles,
  Calendar,
  Receipt,
  ShoppingBag,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface CashflowCalendarProps {
  month: string; // 'YYYY-MM' (selectedMonth)
  items: MonthTimelineItem[]; // timelineItems from useFinanceControl
  startBalance: number; // baseBalance from useFinanceControl
  currency: CurrencyCode;
  language?: LanguageCode;
}

interface DayData {
  dayNumber: number;
  dateStr: string; // 'YYYY-MM-DD'
  items: MonthTimelineItem[];
  inflows: number;
  outflows: number;
  projectedBalance: number;
  isToday: boolean;
}

export const CashflowCalendar: React.FC<CashflowCalendarProps> = ({
  month,
  items,
  startBalance,
  currency,
  language = 'pt',
}) => {
  const t = getTranslations(language);
  const locale = getLocaleForLanguage(language);
  const todayStr = useMemo(() => getTodayStr(), []);

  // Parse Year and Month number without Date parsing (prevents timezone issues)
  const { year, monthNum, yearStr, monthNumStr, daysInMonth, firstDayOfWeek } = useMemo(() => {
    const parts = (month || '').split('-');
    const yStr = parts[0] || '2026';
    const mStr = parts[1] || '01';
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);

    // Number of days in month (day 0 of m+1 in 0-indexed is last day of m)
    const totalDays = new Date(y, m, 0).getDate();
    // Weekday of the 1st of this month (0 = Sun, 1 = Mon, ..., 6 = Sat)
    const firstDow = new Date(y, m - 1, 1).getDay();

    return {
      year: y,
      monthNum: m,
      yearStr: yStr,
      monthNumStr: mStr,
      daysInMonth: totalDays,
      firstDayOfWeek: firstDow,
    };
  }, [month]);

  // Group items by day number (1..daysInMonth)
  const itemsByDay = useMemo(() => {
    const map = new Map<number, MonthTimelineItem[]>();
    for (const item of items) {
      if (!item.date) continue;
      // Group strictly with split('-') to avoid timezone bugs
      const [iYear, iMonth, iDay] = item.date.split('-');
      if (iYear === yearStr && iMonth === monthNumStr) {
        const dayNum = parseInt(iDay, 10);
        if (!isNaN(dayNum) && dayNum >= 1 && dayNum <= 31) {
          const list = map.get(dayNum) || [];
          list.push(item);
          map.set(dayNum, list);
        }
      }
    }
    return map;
  }, [items, yearStr, monthNumStr]);

  // Compute daily numbers, running cumulative balances, and monthly summary
  const { daysData, totalInflows, totalOutflows, endMonthBalance, maxDayOutflow } = useMemo(() => {
    let runningBalance = startBalance;
    let sumInflows = 0;
    let sumOutflows = 0;
    let maxOutflow = 0;
    const days: DayData[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dayItems = itemsByDay.get(d) || [];
      const dayDateStr = `${yearStr}-${monthNumStr}-${String(d).padStart(2, '0')}`;

      let dayInflows = 0;
      let dayOutflows = 0;

      for (const it of dayItems) {
        const val = Math.abs(it.amount);
        if (it.type === 'income') {
          dayInflows += val;
        } else if (it.type === 'bill' || it.type === 'expense') {
          dayOutflows += val;
        }
      }

      sumInflows += dayInflows;
      sumOutflows += dayOutflows;
      if (dayOutflows > maxOutflow) {
        maxOutflow = dayOutflows;
      }

      runningBalance = runningBalance + dayInflows - dayOutflows;

      days.push({
        dayNumber: d,
        dateStr: dayDateStr,
        items: dayItems,
        inflows: dayInflows,
        outflows: dayOutflows,
        projectedBalance: runningBalance,
        isToday: dayDateStr === todayStr,
      });
    }

    return {
      daysData: days,
      totalInflows: sumInflows,
      totalOutflows: sumOutflows,
      endMonthBalance: runningBalance,
      maxDayOutflow: maxOutflow,
    };
  }, [daysInMonth, itemsByDay, startBalance, yearStr, monthNumStr, todayStr]);

  // Selected Day state (defaults to today if in current month, or day 1)
  const initialSelectedDay = useMemo(() => {
    const todayMatch = daysData.find((d) => d.isToday);
    if (todayMatch) return todayMatch.dayNumber;
    return 1;
  }, [daysData]);

  const [selectedDay, setSelectedDay] = useState<number>(initialSelectedDay);

  // Update selected day when month changes
  useEffect(() => {
    const todayMatch = daysData.find((d) => d.isToday);
    setSelectedDay(todayMatch ? todayMatch.dayNumber : 1);
  }, [month]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedDayData = useMemo(() => {
    return daysData.find((d) => d.dayNumber === selectedDay) || daysData[0] || null;
  }, [daysData, selectedDay]);

  // Localized weekday names (Sunday to Saturday)
  const weekDays = useMemo(() => {
    // 2023-01-01 was a Sunday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(2023, 0, 1 + i);
      const name = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(d);
      return name.charAt(0).toUpperCase() + name.slice(1).replace('.', '');
    });
  }, [locale]);

  return (
    <div className="space-y-4">
      {/* 1. TOP SUMMARY CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Card 1: Saldo Inicial */}
        <div className="glass-card rounded-2xl p-3 sm:p-4 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t.calendarStartBalance || t.baseBalance || 'Saldo inicial'}
            </span>
            <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Wallet className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-base sm:text-xl font-black font-mono-numbers tracking-tight text-slate-900 dark:text-white truncate">
              {formatCurrency(startBalance, currency)}
            </div>
          </div>
        </div>

        {/* Card 2: Total Entradas */}
        <div className="glass-card rounded-2xl p-3 sm:p-4 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t.calendarInflows || t.entries || 'Entradas'}
            </span>
            <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-base sm:text-xl font-black font-mono-numbers tracking-tight text-emerald-600 dark:text-emerald-400 truncate">
              +{formatCurrency(totalInflows, currency)}
            </div>
          </div>
        </div>

        {/* Card 3: Total Saídas */}
        <div className="glass-card rounded-2xl p-3 sm:p-4 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t.calendarOutflows || t.exits || 'Saídas'}
            </span>
            <div className="w-6 h-6 rounded-lg bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <ArrowDownLeft className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-base sm:text-xl font-black font-mono-numbers tracking-tight text-rose-600 dark:text-rose-400 truncate">
              -{formatCurrency(totalOutflows, currency)}
            </div>
          </div>
        </div>

        {/* Card 4: Saldo Previsto no Fim do Mês */}
        <div
          className={`rounded-2xl border p-3 sm:p-4 shadow-xs relative overflow-hidden flex flex-col justify-between transition-all ${
            endMonthBalance >= 0
              ? 'bg-emerald-500/10 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800'
              : 'bg-rose-500/10 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              {t.calendarForecastBalance || t.forecastBalance || 'Saldo previsto'}
            </span>
            <span
              className={`text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-full ${
                endMonthBalance >= 0
                  ? 'bg-emerald-200 text-emerald-900 dark:bg-emerald-900/80 dark:text-emerald-200'
                  : 'bg-rose-200 text-rose-900 dark:bg-rose-900/80 dark:text-rose-200'
              }`}
            >
              {endMonthBalance >= 0 ? (t.forecastSurplus || 'Sobra') : (t.forecastDeficit || 'Déficit')}
            </span>
          </div>
          <div className="mt-2">
            <div
              className={`text-base sm:text-xl font-black font-mono-numbers tracking-tight truncate ${
                endMonthBalance >= 0
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-rose-700 dark:text-rose-300'
              }`}
            >
              {formatCurrency(endMonthBalance, currency)}
            </div>
          </div>
        </div>
      </div>

      {/* 2. CALENDAR GRID CONTAINER */}
      <div className="glass rounded-3xl p-3 sm:p-5 shadow-xs space-y-3">
        {/* Calendar Title & Legend */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              {t.tabCalendar || 'Calendário'} • {formatMonthName(month, locale)}
            </h3>
          </div>

          {/* Dots Legend */}
          <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              {t.tabIncomes || 'Entrada'}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
              {t.tabBills || 'Fatura'}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
              {t.tabExpenses || 'Gasto'}
            </span>
          </div>
        </div>

        {/* 7-Column Weekday Header */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center">
          {weekDays.map((wd, idx) => (
            <div
              key={idx}
              className="py-1 text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider"
            >
              {wd}
            </div>
          ))}
        </div>

        {/* Calendar Cells Grid */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {/* Pre-padding blank days */}
          {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
            <div
              key={`blank-${idx}`}
              className="min-h-[58px] sm:min-h-[72px] rounded-xl sm:rounded-2xl border border-transparent bg-slate-50/40 opacity-40 pointer-events-none"
            />
          ))}

          {/* Day Cells */}
          {daysData.map((d) => {
            const isSelected = selectedDay === d.dayNumber;
            const isNegative = d.projectedBalance < 0;

            // Heatmap calculation: background opacity based on outflow ratio to maxDayOutflow
            const heatmapRatio = maxDayOutflow > 0 ? d.outflows / maxDayOutflow : 0;
            const heatmapBg =
              heatmapRatio > 0
                ? `rgba(244, 63, 94, ${Math.min(0.42, 0.08 + heatmapRatio * 0.32)})`
                : undefined;

            // Up to 3 item dots
            const visibleDots = d.items.slice(0, 3);
            const extraCount = d.items.length - 3;

            return (
              <button
                key={d.dayNumber}
                type="button"
                onClick={() => setSelectedDay(d.dayNumber)}
                style={{ backgroundColor: heatmapBg }}
                className={`min-h-[58px] sm:min-h-[72px] p-1 sm:p-1.5 rounded-xl sm:rounded-2xl text-left transition-all relative flex flex-col justify-between cursor-pointer border ${
                  isSelected
                    ? 'ring-2 ring-emerald-500 bg-emerald-50/80 border-emerald-400 shadow-xs z-10'
                    : isNegative
                    ? 'border-rose-400 hover:border-rose-500'
                    : 'border-slate-200/80 hover:border-slate-300 bg-white/80'
                } ${
                  d.isToday
                    ? 'ring-2 ring-emerald-500 ring-offset-1 ring-offset-white'
                    : ''
                }`}
                aria-label={`Dia ${d.dayNumber}`}
              >
                {/* Day Number + Today indicator */}
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`text-xs sm:text-sm font-black font-mono-numbers ${
                      d.isToday
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : isSelected
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : isNegative
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {d.dayNumber}
                  </span>

                  {d.isToday && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  )}
                </div>

                {/* Dots & +N indicator */}
                <div className="flex items-center gap-0.5 sm:gap-1 flex-wrap mt-auto pt-1">
                  {visibleDots.map((it, itIdx) => {
                    const dotColor =
                      it.type === 'income'
                        ? 'bg-emerald-500'
                        : it.type === 'bill'
                        ? 'bg-rose-500'
                        : 'bg-amber-500';
                    return (
                      <span
                        key={itIdx}
                        className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${dotColor} shrink-0`}
                      />
                    );
                  })}
                  {extraCount > 0 && (
                    <span className="text-[8px] sm:text-[9px] font-extrabold text-slate-500 dark:text-slate-400 leading-none">
                      +{extraCount}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Global Empty State for Month */}
        {items.length === 0 && (
          <div className="py-6 text-center space-y-1">
            <p className="text-xs sm:text-sm font-medium text-slate-400 dark:text-slate-500">
              {t.calendarNoItemsMonth || 'Sem movimentações neste mês'}
            </p>
          </div>
        )}
      </div>

      {/* 3. SELECTED DAY DETAILS PANEL (ANIMATED WITH MOTION) */}
      <AnimatePresence mode="wait">
        {selectedDayData && (
          <motion.div
            key={selectedDayData.dayNumber}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="glass rounded-3xl p-4 sm:p-5 shadow-xs space-y-3.5"
          >
            {/* Header: Selected Date & Projected Balance at End of Day */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-xs">
                  {selectedDayData.dayNumber}
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    {formatMonthName(month, locale)} • Dia {selectedDayData.dayNumber}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    {selectedDayData.items.length}{' '}
                    {selectedDayData.items.length === 1 ? 'lançamento' : 'lançamentos'}
                  </p>
                </div>
              </div>

              {/* Saldo ao fim do dia */}
              <div className="text-left sm:text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  {t.calendarEndOfDayBalance || 'Saldo ao fim do dia'}
                </span>
                <span
                  className={`text-sm sm:text-base font-black font-mono-numbers ${
                    selectedDayData.projectedBalance >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {formatCurrency(selectedDayData.projectedBalance, currency)}
                </span>
              </div>
            </div>

            {/* Daily items list */}
            {selectedDayData.items.length === 0 ? (
              <div className="py-6 text-center space-y-1">
                <p className="text-xs sm:text-sm font-medium text-slate-400 dark:text-slate-500">
                  {t.calendarNoItemsDay || 'Sem movimentações neste dia'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedDayData.items.map((item) => {
                  const isInc = item.type === 'income';
                  const isBill = item.type === 'bill';
                  const isPaidOrReceived = item.status === 'paid' || item.status === 'received';
                  const isOverdue = item.status === 'overdue';

                  const itemAmount = Math.abs(item.amount);

                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-2xl border border-slate-200/70 bg-white/80 flex items-center justify-between gap-3 shadow-xs"
                    >
                      {/* Left: Icon & Info */}
                      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            isInc
                              ? 'bg-emerald-100 text-emerald-700'
                              : isBill
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {isInc ? (
                            <TrendingUp className="w-4 h-4" />
                          ) : isBill ? (
                            <Receipt className="w-4 h-4" />
                          ) : (
                            <ShoppingBag className="w-4 h-4" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <h5 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                            {item.name}
                          </h5>
                          <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            <span>{item.category}</span>
                            {item.installmentLabel && (
                              <>
                                <span>•</span>
                                <span className="font-semibold text-rose-600 dark:text-rose-400">
                                  {item.installmentLabel}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Amount & Status Badge */}
                      <div className="text-right shrink-0 space-y-0.5">
                        <div
                          className={`text-xs sm:text-sm font-black font-mono-numbers ${
                            isInc
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {isInc ? '+' : '-'}
                          {formatCurrency(itemAmount, currency)}
                        </div>

                        {/* Status Chip */}
                        <div className="flex justify-end">
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                              isPaidOrReceived
                                ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                                : isOverdue
                                ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300'
                                : 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            {isPaidOrReceived ? (
                              <CheckCircle2 className="w-2.5 h-2.5" />
                            ) : isOverdue ? (
                              <AlertTriangle className="w-2.5 h-2.5" />
                            ) : (
                              <Clock className="w-2.5 h-2.5" />
                            )}
                            {item.statusLabel || (isPaidOrReceived ? t.statusPaid : t.statusPending)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
