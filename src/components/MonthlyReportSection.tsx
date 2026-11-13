import React, { useState, useMemo } from 'react';
import { BillItem, IncomeItem, ExpenseItem, CurrencyCode, LanguageCode } from '../types';
import { formatCurrency } from '../utils/currency';
import { doesItemOccurInMonth, getCurrentMonthStr, formatMonthName } from '../utils/finance';
import { getTranslations, getLocaleForLanguage } from '../utils/i18n';
import {
  PieChart as PieChartIcon,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Info,
  Calendar,
} from 'lucide-react';

interface MonthlyReportSectionProps {
  bills: BillItem[];
  incomes: IncomeItem[];
  expenses: ExpenseItem[];
  currency: CurrencyCode;
  language?: LanguageCode;
  selectedMonth: string;
  onSelectedMonthChange: (month: string) => void;
}

// 14 high-contrast, beautiful accessible palette colors for category slices
const PALETTE = [
  '#10B981', // emerald-500
  '#3B82F6', // blue-500
  '#F59E0B', // amber-500
  '#EC4899', // pink-500
  '#8B5CF6', // purple-500
  '#06B6D4', // cyan-500
  '#F97316', // orange-500
  '#14B8A6', // teal-500
  '#6366F1', // indigo-500
  '#84CC16', // lime-500
  '#E11D48', // rose-600
  '#D97706', // amber-600
  '#0284C7', // sky-600
  '#A855F7', // purple-600
];

function isInvalidCategory(cat?: string | null): boolean {
  if (!cat || !cat.trim()) return true;
  const lower = cat.trim().toLowerCase();
  return (
    lower === 'sem categoria' ||
    lower === 'sem_categoria' ||
    lower === 'sin categoría' ||
    lower === 'sin categoria' ||
    lower === 'sin_categoria' ||
    lower === 'selecionar categoria' ||
    lower === 'seleccionar categoría' ||
    lower === 'seleccionar categoria' ||
    lower === 'select category' ||
    lower === 'none' ||
    lower === 'null' ||
    lower === 'undefined'
  );
}

export const MonthlyReportSection: React.FC<MonthlyReportSectionProps> = ({
  bills = [],
  incomes = [],
  expenses = [],
  currency,
  language = 'pt',
  selectedMonth,
  onSelectedMonthChange,
}) => {
  const t = getTranslations(language);
  const locale = getLocaleForLanguage(language);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState<number>(() => Number(selectedMonth.slice(0, 4)) || new Date().getFullYear());
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Month navigation helpers
  const handlePrevMonth = () => {
    const cur = selectedMonth || getCurrentMonthStr();
    const parts = (cur || '').split('-');
    if (parts.length < 2) return;
    const [y, m] = parts.map(Number);
    const d = new Date(y, (m || 1) - 2, 1);
    const yStr = d.getFullYear();
    const mStr = String(d.getMonth() + 1).padStart(2, '0');
    onSelectedMonthChange(`${yStr}-${mStr}`);
  };

  const handleNextMonth = () => {
    const cur = selectedMonth || getCurrentMonthStr();
    const parts = (cur || '').split('-');
    if (parts.length < 2) return;
    const [y, m] = parts.map(Number);
    const d = new Date(y, (m || 1), 1);
    const yStr = d.getFullYear();
    const mStr = String(d.getMonth() + 1).padStart(2, '0');
    onSelectedMonthChange(`${yStr}-${mStr}`);
  };

  // 1. Total monthly income
  const totalIncome = useMemo(() => {
    const safeIncomes = Array.isArray(incomes) ? incomes : [];
    const curMonth = selectedMonth || getCurrentMonthStr();
    return safeIncomes
      .filter((inc) => {
        if (!inc) return false;
        if (inc.exceptions?.[curMonth]?.isDeleted || inc.excludedMonths?.includes(curMonth) || inc.isRefund || inc.isRefunded) {
          return false;
        }
        return doesItemOccurInMonth(inc.startMonth, curMonth, inc.recurrence, inc.recurrenceMonthsCount);
      })
      .reduce((sum, inc) => {
        const exceptionAmount = inc.exceptions?.[curMonth]?.amount;
        return sum + (exceptionAmount !== undefined ? exceptionAmount : (inc.amount || 0));
      }, 0);
  }, [incomes, selectedMonth]);

  // 2. Filter transactions occurring in month that have a valid category
  const categorizedData = useMemo(() => {
    const safeBills = Array.isArray(bills) ? bills : [];
    const safeExpenses = Array.isArray(expenses) ? expenses : [];
    const curMonth = selectedMonth || getCurrentMonthStr();

    const monthBills = safeBills.filter((b) => {
      if (!b) return false;
      if (b.exceptions?.[curMonth]?.isDeleted || b.excludedMonths?.includes(curMonth)) {
        return false;
      }
      return doesItemOccurInMonth(b.startMonth, curMonth, b.recurrence, b.recurrenceMonthsCount);
    });
    const monthExpenses = safeExpenses.filter(
      (e) => e && e.date && e.date.substring(0, 7) === curMonth
    );

    const spendingByCategory: Record<string, number> = {};

    monthBills.forEach((b) => {
      if (b.isRefund || b.isRefunded) return;
      const exceptionCat = b.exceptions?.[selectedMonth]?.category;
      const cat = (exceptionCat || b.category || '').trim();
      if (!isInvalidCategory(cat)) {
        const exceptionAmount = b.exceptions?.[selectedMonth]?.amount;
        const amount = exceptionAmount !== undefined ? exceptionAmount : b.amount;
        spendingByCategory[cat] = (spendingByCategory[cat] || 0) + amount;
      }
    });

    monthExpenses.forEach((e) => {
      if (e.isRefund || e.isRefunded) return;
      if (!isInvalidCategory(e.category)) {
        const cat = e.category.trim();
        spendingByCategory[cat] = (spendingByCategory[cat] || 0) + e.amount;
      }
    });

    const entries = Object.entries(spendingByCategory)
      .map(([name, amount], idx) => ({
        name,
        amount,
        color: PALETTE[idx % PALETTE.length],
      }))
      .sort((a, b) => b.amount - a.amount);

    const totalSpent = entries.reduce((sum, item) => sum + item.amount, 0);

    const slices = entries.map((item) => ({
      ...item,
      percentage: totalSpent > 0 ? (item.amount / totalSpent) * 100 : 0,
      formattedPercentage:
        totalSpent > 0
          ? `${Math.round((item.amount / totalSpent) * 100)}%`
          : '0%',
    }));

    return { slices, totalSpent };
  }, [bills, expenses, selectedMonth]);

  const { slices, totalSpent } = categorizedData;

  // SVG pie/donut calculation
  const svgSlices = useMemo(() => {
    if (slices.length === 0 || totalSpent <= 0) return [];

    let currentAngle = -Math.PI / 2; // start at top (12 o'clock)
    const centerX = 120;
    const centerY = 120;
    const outerR = 90;
    const innerR = 48; // donut hole

    return slices.map((slice) => {
      const angle = (slice.amount / totalSpent) * (2 * Math.PI);
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle = endAngle;

      // Outer arc points
      const x1 = centerX + outerR * Math.cos(startAngle);
      const y1 = centerY + outerR * Math.sin(startAngle);
      const x2 = centerX + outerR * Math.cos(endAngle);
      const y2 = centerY + outerR * Math.sin(endAngle);

      // Inner arc points
      const ix1 = centerX + innerR * Math.cos(endAngle);
      const iy1 = centerY + innerR * Math.sin(endAngle);
      const ix2 = centerX + innerR * Math.cos(startAngle);
      const iy2 = centerY + innerR * Math.sin(startAngle);

      const largeArc = angle > Math.PI ? 1 : 0;

      // Donut slice path
      const pathData = [
        `M ${x1} ${y1}`,
        `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2}`,
        `L ${ix1} ${iy1}`,
        `A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix2} ${iy2}`,
        'Z',
      ].join(' ');

      return {
        ...slice,
        pathData,
        startAngle,
        endAngle,
      };
    });
  }, [slices, totalSpent]);

  const activeSlice = hoveredIndex !== null ? slices[hoveredIndex] : null;

  return (
    <>
    <div className="space-y-4 pt-3 border-t border-slate-100 dark:border-slate-800">
      {/* Section Title */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
          <PieChartIcon className="w-4 h-4 text-emerald-500" />
          <span>{t.monthlyReportTitle}</span>
        </label>
      </div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        {t.monthlyReportSubtitle}
      </p>

      {/* Month Selector Bar with Direct Selection Dropdown & Arrows */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2 rounded-xl bg-[#D1FAEB]/60 border border-emerald-500/20 gap-2">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-emerald-600 ml-1 shrink-0" />
          <span className="text-xs font-bold text-slate-800 shrink-0">
            {t.selectMonthLabel}:
          </span>
          <button
            type="button"
            onClick={() => { setPickerYear(Number(selectedMonth.slice(0, 4)) || new Date().getFullYear()); setIsMonthPickerOpen(true); }}
            className="text-xs font-extrabold text-slate-900 bg-white/90 border border-emerald-200 rounded-lg px-3 py-2 shadow-2xs hover:bg-emerald-50 active:scale-[0.98] transition-all capitalize"
          >
            {formatMonthName(selectedMonth, locale)}
          </button>
        </div>

        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1 rounded-lg text-slate-600 hover:bg-white transition-colors cursor-pointer"
            title={t.previousMonth}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="px-2 text-xs font-extrabold text-slate-900 capitalize min-w-[90px] text-center">
            {formatMonthName(selectedMonth, locale)}
          </span>

          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1 rounded-lg text-slate-600 hover:bg-white transition-colors cursor-pointer"
            title={t.nextMonth}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards: Total Monthly Income & Total Categorized Spent */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200">
          <div className="flex items-center justify-between text-[11px] font-bold text-emerald-800 mb-1">
            <span>{t.totalMonthlyIncomeLabel}</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-sm sm:text-base font-black font-mono-numbers text-emerald-700">
            {formatCurrency(totalIncome, currency)}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-white/80 border border-slate-200/80">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-1">
            <span>{t.totalMonthlySpentLabel}</span>
            <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <div className="text-sm sm:text-base font-black font-mono-numbers text-slate-900">
            {formatCurrency(totalSpent, currency)}
          </div>
        </div>
      </div>

      {/* Pie Chart & Breakdown */}
      {slices.length === 0 ? (
        <div className="p-6 text-center border border-dashed border-emerald-500/20 rounded-2xl space-y-2 bg-white/40">
          <PieChartIcon className="w-8 h-8 mx-auto text-slate-400" />
          <p className="text-xs font-semibold text-slate-700">
            {t.noCategorizedExpenses}
          </p>
          <p className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
            <Info className="w-3 h-3" />
            <span>{t.uncategorizedNotice}</span>
          </p>
        </div>
      ) : (
        <div className="p-4 rounded-2xl border border-white/80 bg-white/70 backdrop-blur-lg shadow-xs space-y-4">
          <div className="text-xs font-extrabold text-slate-900 flex items-center justify-between">
            <span>{t.categoryDistributionTitle}</span>
            <span className="text-[10px] text-slate-400 font-normal flex items-center gap-1">
              <Info className="w-3 h-3" />
              <span>{t.uncategorizedNotice}</span>
            </span>
          </div>

          {/* Donut SVG Pie Chart */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 py-2">
            <div className="relative w-48 h-48 shrink-0 flex items-center justify-center">
              <svg viewBox="0 0 240 240" className="w-full h-full transform transition-transform">
                {svgSlices.length === 1 ? (
                  // Single category circle
                  <circle
                    cx="120"
                    cy="120"
                    r="90"
                    fill={svgSlices[0].color}
                    className="cursor-pointer transition-transform hover:scale-102"
                    onMouseEnter={() => setHoveredIndex(0)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  />
                ) : (
                  svgSlices.map((s, idx) => (
                    <path
                      key={s.name}
                      d={s.pathData}
                      fill={s.color}
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-white dark:text-slate-900 transition-all duration-150 cursor-pointer hover:opacity-90 hover:stroke-white dark:hover:stroke-slate-950"
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      onClick={() => setHoveredIndex(idx === hoveredIndex ? null : idx)}
                    />
                  ))
                )}
                {/* Center hole for Donut */}
                <circle
                  cx="120"
                  cy="120"
                  r="46"
                  className="fill-white dark:fill-slate-900 pointer-events-none"
                />
              </svg>

              {/* Center Donut Label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
                {activeSlice ? (
                  <>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate max-w-[80px]">
                      {activeSlice.name}
                    </span>
                    <span className="text-xs font-black font-mono-numbers text-slate-900 dark:text-white">
                      {activeSlice.formattedPercentage}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Total
                    </span>
                    <span className="text-xs font-black font-mono-numbers text-slate-900 dark:text-white">
                      {formatCurrency(totalSpent, currency)}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Slices Legend & Progress Breakdown */}
            <div className="w-full space-y-2 max-h-56 overflow-y-auto pr-1">
              {slices.map((slice, idx) => {
                const isHovered = hoveredIndex === idx;
                return (
                  <div
                    key={slice.name}
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    onClick={() => setHoveredIndex(isHovered ? null : idx)}
                    className={`p-2 rounded-xl transition-all cursor-pointer border ${
                      isHovered
                        ? 'bg-emerald-50 border-emerald-300 shadow-xs'
                        : 'bg-white/60 border-slate-200/50 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                          style={{ backgroundColor: slice.color }}
                        />
                        <span className="font-extrabold text-slate-900 truncate">
                          {slice.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono-numbers font-semibold text-slate-700">
                          {formatCurrency(slice.amount, currency)}
                        </span>
                        <span
                          className="px-1.5 py-0.5 rounded-md text-[10px] font-bold text-white font-mono-numbers"
                          style={{ backgroundColor: slice.color }}
                        >
                          {slice.formattedPercentage}
                        </span>
                      </div>
                    </div>

                    {/* Visual Progress bar for each slice */}
                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.max(3, slice.percentage)}%`,
                          backgroundColor: slice.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>

    {isMonthPickerOpen && (
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm" onClick={() => setIsMonthPickerOpen(false)}>
        <div role="dialog" aria-modal="true" aria-label={t.selectMonthLabel || 'Selecionar mês'} className="w-full max-w-sm rounded-[2rem] bg-white border border-emerald-100 shadow-2xl p-5 sm:p-6" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-5">
            <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">{t.selectMonthLabel || 'Selecionar mês'}</p><h3 className="text-xl font-black text-slate-900 mt-1">{pickerYear}</h3></div>
            <button type="button" onClick={() => setIsMonthPickerOpen(false)} aria-label="Fechar" className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 text-xl">×</button>
          </div>
          <div className="flex items-center justify-between mb-4">
            <button type="button" onClick={() => setPickerYear(y => y - 1)} className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 font-bold">‹</button>
            <span className="text-sm font-extrabold text-slate-700">{pickerYear}</span>
            <button type="button" onClick={() => setPickerYear(y => y + 1)} className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 font-bold">›</button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 12 }, (_, index) => {
              const monthValue = `${pickerYear}-${String(index + 1).padStart(2, '0')}`;
              const isSelected = monthValue === selectedMonth;
              return <button key={monthValue} type="button" onClick={() => { onSelectedMonthChange(monthValue); setIsMonthPickerOpen(false); }} className={`rounded-xl py-3 px-2 text-xs font-extrabold capitalize transition-all ${isSelected ? 'bg-emerald-600 text-white shadow-md' : 'bg-emerald-50/70 text-slate-700 hover:bg-emerald-100'}`}>{formatMonthName(monthValue, locale)}</button>;
            })}
          </div>
          <button type="button" onClick={() => { const now = getCurrentMonthStr(); onSelectedMonthChange(now); setPickerYear(Number(now.slice(0, 4))); setIsMonthPickerOpen(false); }} className="w-full mt-4 py-3 rounded-xl border border-emerald-200 text-emerald-700 text-xs font-black uppercase tracking-wider hover:bg-emerald-50">{language === 'es' ? 'Mes actual' : 'Mês atual'}</button>
        </div>
      </div>
    )}
    </>
  );
};
