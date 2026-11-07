/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { BillItem, CurrencyCode, LanguageCode } from '../types';
import { formatCurrency } from '../utils/currency';
import { shiftMonthStr, doesItemOccurInMonth } from '../utils/finance';
import { getTranslations } from '../utils/i18n';
import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface BillComparisonBadgeProps {
  bill: BillItem;
  selectedMonth: string; // YYYY-MM
  allBills: BillItem[];
  currency: CurrencyCode;
  language?: LanguageCode;
  compact?: boolean;
}

export const BillComparisonBadge: React.FC<BillComparisonBadgeProps> = ({
  bill,
  selectedMonth,
  allBills,
  currency,
  language = 'pt',
  compact = false,
}) => {
  const t = getTranslations(language);

  const comparison = useMemo(() => {
    if (!bill || !selectedMonth) return null;
    const prevMonth = shiftMonthStr(selectedMonth, -1);
    const currentAmount = bill.exceptions?.[selectedMonth]?.amount ?? bill.amount;

    const occurredSame = doesItemOccurInMonth(
      bill.startMonth,
      prevMonth,
      bill.recurrence,
      bill.recurrenceMonthsCount
    );

    let prevAmount: number | null = null;

    if (occurredSame) {
      const prevException = bill.exceptions?.[prevMonth];
      if (!prevException?.isDeleted && !bill.excludedMonths?.includes(prevMonth)) {
        prevAmount = prevException?.amount ?? bill.amount;
      }
    }

    if (prevAmount === null && Array.isArray(allBills)) {
      const cleanName = bill.name.trim().toLowerCase();
      const cleanCat = bill.category.trim().toLowerCase();

      const candidate = allBills.find((b) => {
        if (b.id === bill.id) return false;
        if (b.name.trim().toLowerCase() !== cleanName) return false;
        if (b.category.trim().toLowerCase() !== cleanCat) return false;

        const occurs = doesItemOccurInMonth(
          b.startMonth,
          prevMonth,
          b.recurrence,
          b.recurrenceMonthsCount
        );
        if (!occurs) return false;

        const exc = b.exceptions?.[prevMonth];
        if (exc?.isDeleted || b.excludedMonths?.includes(prevMonth)) return false;

        return true;
      });

      if (candidate) {
        prevAmount = candidate.exceptions?.[prevMonth]?.amount ?? candidate.amount;
      }
    }

    if (prevAmount === null || prevAmount === undefined) {
      return null;
    }

    const diff = currentAmount - prevAmount;
    const pct = prevAmount > 0 ? Math.round((Math.abs(diff) / prevAmount) * 100) : 0;
    const maxVal = Math.max(currentAmount, prevAmount, 1);
    const currRatio = Math.min(100, Math.max(8, Math.round((currentAmount / maxVal) * 100)));

    return {
      prevAmount,
      currentAmount,
      diff,
      pct,
      currRatio,
      isIncrease: diff > 0.001,
      isDecrease: diff < -0.001,
      isEqual: Math.abs(diff) <= 0.001,
    };
  }, [bill, selectedMonth, allBills]);

  if (!comparison) return null;

  const { diff, pct, currRatio, isIncrease, isDecrease } = comparison;

  const statusLabel = isIncrease
    ? `+${formatCurrency(diff, currency)} · +${pct}%`
    : isDecrease
    ? `-${formatCurrency(Math.abs(diff), currency)} · -${pct}%`
    : t.sameAmountAsPrevMonth || 'Igual ao mês anterior';

  const colorClass = isIncrease
    ? 'text-rose-600 dark:text-rose-400'
    : isDecrease
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-slate-500 dark:text-slate-400';

  const barColor = isIncrease
    ? 'bg-rose-500'
    : isDecrease
    ? 'bg-emerald-500'
    : 'bg-slate-400';

  return (
    <div className={`flex flex-col gap-1.5 ${compact ? 'mt-0.5' : 'mt-1'}`}>
      <div className={`flex items-center gap-1.5 ${colorClass}`}>
        {isIncrease && <TrendingUp className="w-3 h-3" />}
        {isDecrease && <TrendingDown className="w-3 h-3" />}
        {!isIncrease && !isDecrease && <Minus className="w-3 h-3" />}
        <span className="text-[10px] font-black uppercase tracking-widest font-mono-numbers">
          {statusLabel}
        </span>
      </div>

      <div className="w-24 sm:w-28 h-1 bg-slate-200/80 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${currRatio}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={`h-full rounded-full ${barColor}`}
        />
      </div>
    </div>
  );
};
