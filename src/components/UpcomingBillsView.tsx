import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BillItem, CurrencyCode, LanguageCode, MonthlyStatusRecord } from '../types';
import {
  shiftMonthStr,
  formatMonthName,
  doesItemOccurInMonth,
  getEffectiveDateForMonth,
  getMonthDiff,
} from '../utils/finance';
import { formatCurrency } from '../utils/currency';
import { getTranslations, getLocaleForLanguage } from '../utils/i18n';
import {
  Calendar,
  Receipt,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronRight,
  Plus,
  ArrowDownCircle,
  Trash2,
} from 'lucide-react';

interface UpcomingBillsViewProps {
  bills: BillItem[];
  currency: CurrencyCode;
  language?: LanguageCode;
  startMonthStr: string;
  statusRecords: MonthlyStatusRecord[];
  userId?: string;
  onSelectBill: (bill: BillItem, month: string) => void;
  onToggleBillPaid: (billId: string, month: string, isPaid: boolean) => void;
  onDeleteBillClick?: (bill: BillItem, month: string) => void;
  onNewBill: () => void;
}

interface MonthGroup {
  month: string; // YYYY-MM
  monthName: string;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  occurrences: {
    bill: BillItem;
    month: string;
    effectiveDueDate: string;
    dueDay: number;
    amount: number;
    status: 'paid' | 'overdue' | 'pending';
    installmentLabel?: string;
  }[];
}

export const UpcomingBillsView: React.FC<UpcomingBillsViewProps> = ({
  bills,
  currency,
  language = 'pt',
  startMonthStr,
  statusRecords,
  userId,
  onSelectBill,
  onToggleBillPaid,
  onDeleteBillClick,
  onNewBill,
}) => {
  const t = getTranslations(language);
  const locale = getLocaleForLanguage(language);
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const [monthsToShow, setMonthsToShow] = useState<number>(12);

  const statusMap = useMemo(() => {
    const map = new Map<string, MonthlyStatusRecord>();
    for (const rec of statusRecords) {
      map.set(rec.id, rec);
    }
    return map;
  }, [statusRecords]);

  const groupedMonths = useMemo<MonthGroup[]>(() => {
    const groups: MonthGroup[] = [];

    for (let i = 0; i < monthsToShow; i++) {
      const targetMonth = shiftMonthStr(startMonthStr, i);
      const occurrences: MonthGroup['occurrences'] = [];

      for (const bill of bills) {
        if (doesItemOccurInMonth(bill.startMonth, targetMonth, bill.recurrence, bill.recurrenceMonthsCount)) {
          const exception = bill.exceptions?.[targetMonth];
          if (exception?.isDeleted || bill.excludedMonths?.includes(targetMonth)) {
            continue;
          }

          const effectiveDueDay = exception?.dueDay ?? bill.dueDay;
          const effectiveDueDate =
            exception?.dueDate ?? getEffectiveDateForMonth(targetMonth, effectiveDueDay);
          const effectiveAmount = exception?.amount ?? bill.amount;

          const recordKey = `bill_${bill.id}_${targetMonth}`;
          const record = statusMap.get(recordKey);
          const monthShares = (exception as any)?.shares;
          const userShareStatus = userId && monthShares?.[userId]?.status;
          const isPaid =
            record?.isCompleted === true ||
            (exception as any)?.status === 'paid' ||
            userShareStatus === 'paid' ||
            userShareStatus === 'transferred' ||
            ((bill as any).recurrence === 'none' && ((bill as any).status === 'paid' || (userId && (bill as any).shares?.[userId]?.status === 'paid') || (userId && (bill as any).shares?.[userId]?.status === 'transferred')));

          let status: 'paid' | 'overdue' | 'pending';
          if (isPaid) {
            status = 'paid';
          } else if (effectiveDueDate < todayStr) {
            status = 'overdue';
          } else {
            status = 'pending';
          }

          let installmentLabel: string | undefined = undefined;
          if (bill.recurrence === 'monthly') {
            const diff = getMonthDiff(bill.startMonth, targetMonth);
            const currentInstallment = diff + 1;
            if (bill.recurrenceMonthsCount && bill.recurrenceMonthsCount > 0) {
              installmentLabel = `${t.installmentPrefix} ${currentInstallment}/${bill.recurrenceMonthsCount}`;
            } else {
              installmentLabel = `${t.recurrenceMonthly} (${currentInstallment})`;
            }
          }

          occurrences.push({
            bill,
            month: targetMonth,
            effectiveDueDate,
            dueDay: effectiveDueDay,
            amount: effectiveAmount,
            status,
            installmentLabel,
          });
        }
      }

      if (occurrences.length > 0) {
        occurrences.sort((a, b) => a.effectiveDueDate.localeCompare(b.effectiveDueDate));

        const totalAmount = occurrences.reduce((sum, o) => sum + o.amount, 0);
        const paidAmount = occurrences
          .filter((o) => o.status === 'paid')
          .reduce((sum, o) => sum + o.amount, 0);
        const pendingAmount = totalAmount - paidAmount;

        groups.push({
          month: targetMonth,
          monthName: formatMonthName(targetMonth, locale),
          totalAmount,
          paidAmount,
          pendingAmount,
          occurrences,
        });
      }
    }

    return groups;
  }, [bills, startMonthStr, monthsToShow, statusMap, todayStr, locale, t]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="space-y-4"
    >
      {/* Header Info */}
      <motion.div variants={itemVariants} className="glass rounded-[2rem] p-5 shadow-xl premium-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center">
            <Receipt className="w-6 h-6 text-rose-600 dark:text-rose-400" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
              {t.upcomingBillsTitle}
            </h3>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              {t.upcomingBillsSubtitle}
            </p>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          type="button"
          onClick={onNewBill}
          className="inline-flex items-center gap-2 px-6 py-3 text-xs font-black text-white bg-rose-600 hover:bg-rose-500 rounded-2xl shadow-lg shadow-rose-600/20 transition-colors cursor-pointer self-start sm:self-auto shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{t.addBill}</span>
        </motion.button>
      </motion.div>

      {/* Empty State */}
      {groupedMonths.length === 0 ? (
        <motion.div variants={itemVariants} className="glass-panel rounded-[2rem] p-12 text-center space-y-5">
          <div className="w-20 h-20 mx-auto rounded-[2.5rem] bg-slate-100 flex items-center justify-center shadow-inner">
            <Receipt className="w-10 h-10 text-slate-400" />
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">
              {t.noUpcomingBills}
            </h4>
            <p className="text-xs text-slate-500 max-w-xs mx-auto font-medium">
              {t.noUpcomingBillsDesc}
            </p>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={onNewBill}
            className="px-6 py-3 text-xs font-black text-rose-600 bg-rose-500/10 rounded-2xl hover:bg-rose-500/20 cursor-pointer"
          >
            {t.addBillNow}
          </motion.button>
        </motion.div>
      ) : (
        <div className="space-y-6">
          {groupedMonths.map((group) => (
            <motion.div
              variants={itemVariants}
              key={group.month}
              className="glass-panel rounded-[2.5rem] shadow-md overflow-hidden border border-white/80"
            >
              {/* Month Header */}
              <div className="px-6 py-4 bg-white/60 border-b border-slate-200/60 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-rose-500/10 flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-rose-600" />
                  </div>
                  <span className="text-sm font-black text-slate-900 capitalize">
                    {group.monthName}
                  </span>
                  <span className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-white text-slate-700 shadow-xs border border-slate-200/60">
                    {group.occurrences.length}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Total: <span className="text-rose-600 dark:text-rose-400 font-black text-xs">{formatCurrency(group.totalAmount, currency)}</span>
                  </div>
                  {group.paidAmount > 0 && (
                    <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest hidden sm:block">
                      Pagado: <span className="font-black text-xs">{formatCurrency(group.paidAmount, currency)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bills List */}
              <div className="p-4 space-y-2.5">
                {group.occurrences.map((occ) => {
                  const isPaid = occ.status === 'paid';
                  const isOverdue = occ.status === 'overdue';

                  return (
                    <motion.div
                      key={`${occ.bill.id}_${occ.month}`}
                      whileHover={{ x: 4 }}
                      onClick={() => onSelectBill(occ.bill, occ.month)}
                      className={`p-4 rounded-[1.75rem] border transition-all flex items-center justify-between gap-4 cursor-pointer ${
                        isPaid
                          ? 'bg-slate-100/50 border-slate-200/50 opacity-70'
                          : 'bg-white/80 border-white/90 shadow-xs'
                      }`}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-white flex flex-col items-center justify-center shrink-0 border border-slate-200/60 shadow-xs">
                          <span className="text-[12px] font-black text-slate-900 leading-none">
                            {occ.dueDay}
                          </span>
                          <span className="text-[8px] font-black text-slate-400 uppercase mt-0.5">
                            DÍA
                          </span>
                        </div>

                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs sm:text-sm font-black truncate ${isPaid ? 'text-slate-400 line-through' : 'text-slate-900 dark:text-white'}`}>
                              {occ.bill.name}
                            </span>
                            {occ.installmentLabel && (
                              <span className="text-[8px] font-black px-1.5 py-0.5 rounded-lg bg-amber-500 text-white shadow-sm">
                                {occ.installmentLabel}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 dark:text-slate-500">
                            <span className="truncate">{occ.bill.category}</span>
                            {occ.bill.notes && (
                              <span className="truncate italic hidden sm:inline">• {occ.bill.notes}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <div className="text-right">
                          <span className={`text-sm sm:text-base font-black font-mono-numbers tracking-tighter ${isPaid ? 'text-slate-300' : 'text-rose-600 dark:text-rose-400'}`}>
                            {formatCurrency(occ.amount, currency)}
                          </span>
                        </div>

                        <motion.button
                          whileTap={{ scale: 0.85 }}
                          type="button"
                          onClick={() => onToggleBillPaid(occ.bill.id, occ.month, !isPaid)}
                          className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-lg ${
                            isPaid
                              ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                              : isOverdue
                              ? 'bg-rose-500 text-white shadow-rose-500/30'
                              : 'bg-white text-slate-400 border border-slate-200/80 hover:border-emerald-500/50'
                          }`}
                        >
                          <CheckCircle2 className={`w-5 h-5 ${isPaid || isOverdue ? 'opacity-100' : 'opacity-30'}`} />
                        </motion.button>

                        <button
                          type="button"
                          onClick={() => onDeleteBillClick && onDeleteBillClick(occ.bill, occ.month)}
                          title={language === 'es' ? 'Eliminar factura' : 'Excluir fatura'}
                          className="w-9 h-9 rounded-2xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white border border-rose-200/40 flex items-center justify-center transition-all cursor-pointer shadow-xs"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => onSelectBill(occ.bill, occ.month)}
                          className="w-9 h-9 rounded-2xl bg-white text-slate-400 border border-slate-200/80 flex items-center justify-center hover:bg-slate-100 transition-all cursor-pointer"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          ))}

          {/* Load More */}
          <div className="text-center pt-2 pb-8">
            <motion.button
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={() => setMonthsToShow((prev) => prev + 12)}
              className="px-6 py-3 text-xs font-black text-slate-800 bg-[#D1FAEB]/60 backdrop-blur-xl border border-emerald-500/20 rounded-[1.5rem] shadow-sm transition-all cursor-pointer inline-flex items-center gap-2 hover:bg-[#D1FAEB]/90"
            >
              <ArrowDownCircle className="w-4 h-4 text-rose-500" />
              <span>{t.loadMoreMonths}</span>
            </motion.button>
          </div>
        </div>
      )}
    </motion.div>
  );
};

