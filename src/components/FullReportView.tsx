/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CurrencyCode,
  LanguageCode,
  BillItem,
  IncomeItem,
  ExpenseItem,
  MonthlyStatusRecord,
  SharedBill,
  SharedTransferRecord,
  SharedUserSummary,
} from '../types';
import { formatCurrency } from '../utils/currency';
import { MonthlyReportSection } from './MonthlyReportSection';
import { getTranslations, getLocaleForLanguage } from '../utils/i18n';
import {
  doesItemOccurInMonth,
  getEffectiveDateForMonth,
  shiftMonthStr,
  getCurrentMonthStr,
  getTodayStr,
  formatDayMonthLabel,
  formatMonthName,
} from '../utils/finance';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
  CheckCircle2,
  Clock,
  AlertTriangle,
  PieChart as PieChartIcon,
  ArrowRightLeft,
  Users,
  ArrowUpRight,
  ArrowDownLeft,
  Filter,
  Tag,
  Sparkles,
  Info,
  Layers,
  HelpCircle,
  Printer,
} from 'lucide-react';

interface FullReportViewProps {
  currency: CurrencyCode;
  currentAccountBalance?: number;
  language?: LanguageCode;
  bills: BillItem[];
  incomes: IncomeItem[];
  expenses: ExpenseItem[];
  statusRecords: MonthlyStatusRecord[];
  sharedBills: SharedBill[];
  sharedTransfers?: SharedTransferRecord[];
  activePartners: SharedUserSummary[];
  myUserId: string;
  onReturnToFinance: () => void;
  onNavigateToFinance?: (
    tab: 'timeline' | 'bills' | 'upcoming' | 'incomes' | 'expenses' | 'categories' | 'savings' | 'report' | 'calendar' | 'freedom',
    options?: {
      billFilter?: 'all' | 'pending' | 'paid' | 'overdue';
      incomeFilter?: 'all' | 'pending' | 'received';
      month?: string;
    }
  ) => void;
}

export const FullReportView: React.FC<FullReportViewProps> = ({
  currency,
  currentAccountBalance,
  language = 'pt',
  bills,
  incomes,
  expenses,
  statusRecords,
  sharedBills,
  sharedTransfers,
  activePartners,
  myUserId,
  onReturnToFinance,
  onNavigateToFinance,
}) => {
  const t = getTranslations(language);
  const locale = getLocaleForLanguage(language);
  const todayStr = useMemo(() => getTodayStr(), []);

  // Filter mode: 'monthly' | 'custom'
  const [filterMode, setFilterMode] = useState<'monthly' | 'custom'>('monthly');

  // Monthly mode state
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthStr());

  // Custom range mode state
  const [customStartDate, setCustomStartDate] = useState<string>(
    `${getCurrentMonthStr()}-01`
  );
  const [customEndDate, setCustomEndDate] = useState<string>(todayStr);

  // Detail Modal for Timeline items
  const [selectedDetailItem, setSelectedDetailItem] = useState<any | null>(null);

  // Expandable Debt Detail Modal
  const [selectedDebtDetail, setSelectedDebtDetail] = useState<{
    type: 'owedToMe' | 'iOwe';
    items: { partnerName: string; billTitle: string; month: string; amount: number }[];
  } | null>(null);

  // Effective date range calculation
  const dateRange = useMemo(() => {
    if (filterMode === 'monthly') {
      const start = `${selectedMonth}-01`;
      // Calculate last day of month
      const [y, m] = selectedMonth.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      const end = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`;
      return { start, end, isMonthly: true };
    } else {
      return {
        start: customStartDate || '2000-01-01',
        end: customEndDate || '2099-12-31',
        isMonthly: false,
      };
    }
  }, [filterMode, selectedMonth, customStartDate, customEndDate]);

  // Index status records for fast lookup
  const statusMap = useMemo(() => {
    const map = new Map<string, MonthlyStatusRecord>();
    for (const rec of statusRecords) {
      map.set(rec.id, rec);
    }
    return map;
  }, [statusRecords]);

  // Determine months involved in date range
  const monthsInRange = useMemo(() => {
    const startM = dateRange.start.slice(0, 7);
    const endM = dateRange.end.slice(0, 7);
    const months: string[] = [];
    let curr = startM;
    while (curr <= endM) {
      months.push(curr);
      curr = shiftMonthStr(curr, 1);
    }
    return months;
  }, [dateRange]);

  // 1. EVALUATE ALL INCOMES IN RANGE
  const rangeIncomes = useMemo(() => {
    const list: {
      id: string;
      title: string;
      amount: number;
      date: string;
      category: string;
      status: 'received' | 'pending';
      notes?: string;
      isRefund?: boolean;
      isRefunded?: boolean;
    }[] = [];

    for (const inc of incomes) {
      for (const m of monthsInRange) {
        if (doesItemOccurInMonth(inc.startMonth, m, inc.recurrence, inc.recurrenceMonthsCount)) {
          const exception = inc.exceptions?.[m];
          if (exception?.isDeleted || inc.excludedMonths?.includes(m)) continue;

          const effectiveDay = exception?.expectedDay ?? inc.expectedDay;
          const effectiveDate = exception?.expectedDate ?? getEffectiveDateForMonth(m, effectiveDay);

          if (effectiveDate >= dateRange.start && effectiveDate <= dateRange.end) {
            const recordKey = `income_${inc.id}_${m}`;
            const isReceived = statusMap.get(recordKey)?.isCompleted === true;
            list.push({
              id: `inc_${inc.id}_${m}`,
              title: exception?.name ?? inc.name,
              amount: exception?.amount ?? inc.amount,
              date: effectiveDate,
              category: exception?.category ?? inc.category,
              status: isReceived ? 'received' : 'pending',
              notes: exception?.notes !== undefined ? exception.notes : inc.notes,
              isRefunded: inc.isRefunded,
              isRefund: inc.isRefund,
            });
          }
        }
      }
    }
    return list;
  }, [incomes, monthsInRange, dateRange, statusMap]);

  // 2. EVALUATE ALL PERSONAL BILLS IN RANGE
  const rangePersonalBills = useMemo(() => {
    const list: {
      id: string;
      title: string;
      amount: number;
      date: string;
      category: string;
      status: 'paid' | 'overdue' | 'pending';
      notes?: string;
      isRefund?: boolean;
      isRefunded?: boolean;
    }[] = [];

    for (const bill of bills) {
      for (const m of monthsInRange) {
        if (doesItemOccurInMonth(bill.startMonth, m, bill.recurrence, bill.recurrenceMonthsCount)) {
          const exception = bill.exceptions?.[m];
          if (exception?.isDeleted || bill.excludedMonths?.includes(m)) continue;

          const effectiveDay = exception?.dueDay ?? bill.dueDay;
          const effectiveDate = exception?.dueDate ?? getEffectiveDateForMonth(m, effectiveDay);

          if (effectiveDate >= dateRange.start && effectiveDate <= dateRange.end) {
            const recordKey = `bill_${bill.id}_${m}`;
            const isPaid = statusMap.get(recordKey)?.isCompleted === true;

            let status: 'paid' | 'overdue' | 'pending';
            if (isPaid) {
              status = 'paid';
            } else if (effectiveDate < todayStr) {
              status = 'overdue';
            } else {
              status = 'pending';
            }

            if (bill.isSharedExemptFromTotal) continue;

            list.push({
              id: `bill_${bill.id}_${m}`,
              title: exception?.name ?? bill.name,
              amount: exception?.amount ?? bill.amount,
              date: effectiveDate,
              category: exception?.category ?? bill.category,
              status,
              notes: exception?.notes !== undefined ? exception.notes : bill.notes,
              isRefund: bill.isRefund,
              isRefunded: bill.isRefunded,
            });
          }
        }
      }
    }
    return list;
  }, [bills, monthsInRange, dateRange, statusMap, todayStr]);

  // 3. EVALUATE ALL ONE-OFF EXPENSES IN RANGE
  const rangeExpenses = useMemo(() => {
    return expenses
      .filter((exp) => exp.date >= dateRange.start && exp.date <= dateRange.end)
      .map((exp) => ({
        id: exp.id,
        title: exp.name,
        amount: exp.amount,
        date: exp.date,
        category: exp.category,
        status: 'paid' as const,
        notes: exp.notes,
        isRefund: exp.isRefund,
        isRefunded: exp.isRefunded,
      }));
  }, [expenses, dateRange]);

  // 4. EVALUATE ALL SHARED BILLS IN RANGE (No double counting)
  const rangeSharedBillsDetailed = useMemo(() => {
    const list: {
      bill: SharedBill;
      month: string;
      effectiveDueDate: string;
      totalAmount: number;
      myShareAmount: number;
      partnerShareAmount: number;
      myPercentage: number;
      partnerPercentage: number;
      partnerName: string;
      partnerId: string;
      isPaidToCreditor: boolean;
      paidByUserId: string | null;
      paidByUserName: string;
      myStatus: 'paid' | 'overdue' | 'pending';
      reimbursement: {
        fromUserId: string;
        toUserId: string;
        amount: number;
        status: 'pending' | 'settled';
      } | null;
    }[] = [];

    for (const sb of sharedBills) {
      const startMonthFallback =
        sb.startMonth || sb.month || (sb.dueDate ? sb.dueDate.substring(0, 7) : '');

      for (const m of monthsInRange) {
        if (
          doesItemOccurInMonth(
            startMonthFallback,
            m,
            sb.recurrence || 'none',
            sb.recurrenceMonthsCount
          )
        ) {
          const mEx = sb.exceptions?.[m];
          if (mEx?.isDeleted || sb.excludedMonths?.includes(m)) continue;
          if (sb.shareRequest?.status === 'rejected') continue;

          const effectiveDueDay = sb.dueDay || 1;
          const effectiveDueDate = getEffectiveDateForMonth(m, effectiveDueDay);

          if (effectiveDueDate >= dateRange.start && effectiveDueDate <= dateRange.end) {
            const partnerId = sb.members.find((id) => id !== myUserId) || '';
            const partnerSummary = activePartners.find((p) => p.uid === partnerId);
            const partnerName = partnerSummary?.displayName || 'Parceiro';

            const myPercentage = sb.percentages?.[myUserId] ?? 50;
            const partnerPercentage = sb.percentages?.[partnerId] ?? 50;

            const myShareAmount =
              sb.shares?.[myUserId]?.amount !== undefined && !isNaN(sb.shares[myUserId].amount)
                ? sb.shares[myUserId].amount
                : Math.round((sb.amount * myPercentage) / 100);

            const partnerShareAmount = sb.amount - myShareAmount;

            const isPaidToCreditor =
              mEx?.status === 'paid' || (sb.recurrence === 'none' && sb.status === 'paid');
            const paidByUserId = mEx?.paidBy || (sb.recurrence === 'none' ? sb.paidBy : null) || null;
            const paidByUserName =
              paidByUserId === myUserId
                ? 'Você'
                : paidByUserId === partnerId
                ? partnerName
                : 'Pendente';

            const rawReimbursement = mEx?.reimbursement || (sb.recurrence === 'none' ? sb.reimbursement : null);
            const reimbursement = rawReimbursement ? {
              fromUserId: rawReimbursement.fromUserId,
              toUserId: rawReimbursement.toUserId,
              amount: rawReimbursement.amount,
              status: rawReimbursement.status,
            } : null;

            let myStatus: 'paid' | 'overdue' | 'pending' = 'pending';

            if (isPaidToCreditor) {
              if (reimbursement && reimbursement.status === 'pending') {
                if (reimbursement.fromUserId === myUserId) {
                  const recordKey = `bill_sb_${sb.id}_${m}`;
                  const isRecordPaid = statusMap.get(recordKey)?.isCompleted === true;
                  myStatus = isRecordPaid
                    ? 'paid'
                    : effectiveDueDate < todayStr
                    ? 'overdue'
                    : 'pending';
                } else {
                  myStatus = 'paid';
                }
              } else {
                myStatus = 'paid';
              }
            } else {
              const recordKey = `bill_sb_${sb.id}_${m}`;
              const isRecordPaid = statusMap.get(recordKey)?.isCompleted === true;
              const isSharePaid =
                isRecordPaid ||
                sb.shares?.[myUserId]?.status === 'transferred' ||
                sb.shares?.[myUserId]?.status === 'paid' ||
                mEx?.shares?.[myUserId]?.status === 'paid' ||
                mEx?.shares?.[myUserId]?.status === 'transferred';

              if (isSharePaid) {
                myStatus = 'paid';
              } else {
                myStatus = effectiveDueDate < todayStr ? 'overdue' : 'pending';
              }
            }

            list.push({
              bill: sb,
              month: m,
              effectiveDueDate,
              totalAmount: sb.amount,
              myShareAmount,
              partnerShareAmount,
              myPercentage,
              partnerPercentage,
              partnerName,
              partnerId,
              isPaidToCreditor,
              paidByUserId,
              paidByUserName,
              myStatus,
              reimbursement,
            });
          }
        }
      }
    }

    return list.sort((a, b) => a.effectiveDueDate.localeCompare(b.effectiveDueDate));
  }, [sharedBills, monthsInRange, dateRange, myUserId, activePartners, statusMap, todayStr]);

  // 5. RESUMEN GENERAL CALCULATIONS
  // Ingresos Recibidos (real cash in)
  const totalReceivedIncomes = useMemo(() => {
    return rangeIncomes
      .filter((i) => i.status === 'received' && !i.isRefunded && !i.isRefund)
      .reduce((sum, i) => sum + i.amount, 0);
  }, [rangeIncomes]);

  // Dinero Todavía por Recibir
  const totalPendingIncomes = useMemo(() => {
    return rangeIncomes
      .filter((i) => i.status === 'pending')
      .reduce((sum, i) => sum + i.amount, 0);
  }, [rangeIncomes]);

  // Gastos Pagados (Avulsos + Reembolsos liquidados ejecutados)
  const totalPaidOneOffExpenses = useMemo(() => {
    return rangeExpenses
      .filter(e => !e.isRefund && !e.isRefunded)
      .reduce((sum, e) => sum + e.amount, 0);
  }, [rangeExpenses]);

  // Facturas Personales Pagadas
  const totalPaidPersonalBills = useMemo(() => {
    return rangePersonalBills
      .filter((b) => b.status === 'paid')
      .reduce((sum, b) => sum + b.amount, 0);
  }, [rangePersonalBills]);

  // Total Facturas Pagadas (Personales + Cuotas Compartidas pagadas si aplican)
  const totalPaidBillsCount = useMemo(() => {
    const personalCount = rangePersonalBills.filter((b) => b.status === 'paid').length;
    const sharedCount = rangeSharedBillsDetailed.filter((sb) => sb.myStatus === 'paid').length;
    return personalCount + sharedCount;
  }, [rangePersonalBills, rangeSharedBillsDetailed]);

  // Total Gastos Realizados en el período (Gasto real de caja)
  const totalSpentPeriod = useMemo(() => {
    return totalPaidOneOffExpenses + totalPaidPersonalBills;
  }, [totalPaidOneOffExpenses, totalPaidPersonalBills]);

  // Total Todavía Pendiente de Pago
  const totalPendingPayment = useMemo(() => {
    const personalPending = rangePersonalBills
      .filter((b) => b.status === 'pending')
      .reduce((sum, b) => sum + b.amount, 0);

    const sharedPending = rangeSharedBillsDetailed
      .filter((sb) => sb.myStatus === 'pending')
      .reduce((sum, sb) => {
        if (sb.reimbursement && sb.reimbursement.status === 'pending') {
          return sum + (sb.reimbursement.fromUserId === myUserId ? sb.reimbursement.amount : 0);
        }
        return sum + sb.myShareAmount;
      }, 0);

    return personalPending + sharedPending;
  }, [rangePersonalBills, rangeSharedBillsDetailed, myUserId]);

  // Total Vencido
  const totalOverduePayment = useMemo(() => {
    const personalOverdue = rangePersonalBills
      .filter((b) => b.status === 'overdue')
      .reduce((sum, b) => sum + b.amount, 0);

    const sharedOverdue = rangeSharedBillsDetailed
      .filter((sb) => sb.myStatus === 'overdue')
      .reduce((sum, sb) => {
        if (sb.reimbursement && sb.reimbursement.status === 'pending') {
          return sum + (sb.reimbursement.fromUserId === myUserId ? sb.reimbursement.amount : 0);
        }
        return sum + sb.myShareAmount;
      }, 0);

    return personalOverdue + sharedOverdue;
  }, [rangePersonalBills, rangeSharedBillsDetailed, myUserId]);

  // Resultado analítico do período: entradas recebidas menos gastos pagos.
  const calculatedNetResultPeriod = useMemo(() => {
    return totalReceivedIncomes - totalSpentPeriod;
  }, [totalReceivedIncomes, totalSpentPeriod]);

  // No mês atual, o saldo oficial é o saldo real das contas (mesma referência da tela inicial).
  // Em períodos históricos ou filtros personalizados, mantemos o resultado analítico do período.
  const hasAccountBalance = Number.isFinite(currentAccountBalance);
  const netResultPeriod = hasAccountBalance ? Number(currentAccountBalance) : calculatedNetResultPeriod;
  const hasBalanceAdjustment = hasAccountBalance && Math.abs(netResultPeriod - calculatedNetResultPeriod) >= 0.01;
  const balanceDifference = netResultPeriod - calculatedNetResultPeriod;

  // 6. QUIÉN ME DEBE / A QUIÉN DEBO
  const debtSummary = useMemo(() => {
    let owedToMeTotal = 0;
    let iOweTotal = 0;
    const owedToMeItems: { partnerName: string; billTitle: string; month: string; amount: number }[] = [];
    const iOweItems: { partnerName: string; billTitle: string; month: string; amount: number }[] = [];

    // Check all active shared bills across system for active pending reimbursements
    for (const sb of sharedBills) {
      const partnerId = sb.members.find((id) => id !== myUserId) || '';
      const partnerSummary = activePartners.find((p) => p.uid === partnerId);
      const partnerName = partnerSummary?.displayName || 'Parceiro';

      // Check root level legacy reimbursement
      if (sb.reimbursement && sb.reimbursement.status === 'pending') {
        const r = sb.reimbursement;
        const m = sb.month || sb.dueDate?.substring(0, 7) || 'Geral';
        if (r.toUserId === myUserId) {
          owedToMeTotal += r.amount;
          owedToMeItems.push({ partnerName, billTitle: sb.title, month: m, amount: r.amount });
        } else if (r.fromUserId === myUserId) {
          iOweTotal += r.amount;
          iOweItems.push({ partnerName, billTitle: sb.title, month: m, amount: r.amount });
        }
      }

      // Check exceptions
      if (sb.exceptions) {
        for (const [m, ex] of Object.entries(sb.exceptions)) {
          if (ex.reimbursement && ex.reimbursement.status === 'pending') {
            const r = ex.reimbursement;
            if (r.toUserId === myUserId) {
              owedToMeTotal += r.amount;
              owedToMeItems.push({ partnerName, billTitle: sb.title, month: m, amount: r.amount });
            } else if (r.fromUserId === myUserId) {
              iOweTotal += r.amount;
              iOweItems.push({ partnerName, billTitle: sb.title, month: m, amount: r.amount });
            }
          }
        }
      }
    }

    return {
      owedToMeTotal,
      iOweTotal,
      owedToMeItems,
      iOweItems,
    };
  }, [sharedBills, myUserId, activePartners]);

  // 7. CHRONOLOGICAL COMBINED TIMELINE
  const combinedTimeline = useMemo(() => {
    const list: {
      id: string;
      type: 'income' | 'personal_bill' | 'expense' | 'shared_bill';
      title: string;
      amount: number;
      date: string;
      category: string;
      status: 'paid' | 'received' | 'pending' | 'overdue';
      isShared: boolean;
      notes?: string;
    }[] = [];

    // Incomes
    for (const inc of rangeIncomes) {
      list.push({
        id: inc.id,
        type: 'income',
        title: inc.title,
        amount: inc.amount,
        date: inc.date,
        category: inc.category,
        status: inc.status === 'received' ? 'received' : 'pending',
        isShared: false,
        notes: inc.notes,
      });
    }

    // Personal Bills
    for (const pb of rangePersonalBills) {
      list.push({
        id: pb.id,
        type: 'personal_bill',
        title: pb.title,
        amount: -pb.amount,
        date: pb.date,
        category: pb.category,
        status: pb.status,
        isShared: false,
        notes: pb.notes,
      });
    }

    // One-off Expenses
    for (const exp of rangeExpenses) {
      list.push({
        id: exp.id,
        type: 'expense',
        title: exp.title,
        amount: -exp.amount,
        date: exp.date,
        category: exp.category,
        status: 'paid',
        isShared: false,
        notes: exp.notes,
      });
    }

    // Shared Bills (User's actual responsibility)
    for (const sb of rangeSharedBillsDetailed) {
      let obligation = sb.myShareAmount;
      if (sb.reimbursement && sb.reimbursement.status === 'pending' && sb.reimbursement.fromUserId === myUserId) {
        obligation = sb.reimbursement.amount;
      }
      list.push({
        id: `sb_${sb.bill.id}_${sb.month}`,
        type: 'shared_bill',
        title: `[Compartilhada] ${sb.bill.title}`,
        amount: -obligation,
        date: sb.effectiveDueDate,
        category: sb.bill.category || 'Contas Compartilhadas',
        status: sb.myStatus,
        isShared: true,
        notes: sb.bill.notes,
      });
    }

    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [rangeIncomes, rangePersonalBills, rangeExpenses, rangeSharedBillsDetailed, myUserId]);

  // 8. CATEGORY BREAKDOWN (Paid/Realized Expenses ONLY)
  const categoryBreakdown = useMemo(() => {
    const categoryTotals: Record<string, number> = {};

    // 1. One-off Expenses
    for (const exp of rangeExpenses) {
      categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
    }

    // 2. Personal Paid Bills
    for (const pb of rangePersonalBills) {
      if (pb.status === 'paid') {
        categoryTotals[pb.category] = (categoryTotals[pb.category] || 0) + pb.amount;
      }
    }

    const totalCategorySpent = Object.values(categoryTotals).reduce((sum, v) => sum + v, 0);

    const list = Object.entries(categoryTotals).map(([cat, amount]) => {
      const percent = totalCategorySpent > 0 ? Math.round((amount / totalCategorySpent) * 100) : 0;
      return { category: cat, amount, percent };
    });

    return {
      list: list.sort((a, b) => b.amount - a.amount),
      totalCategorySpent,
    };
  }, [rangeExpenses, rangePersonalBills]);

  // 9. PENDENTES Y VENCIDOS SECTIONS
  const pendingItemsList = useMemo(() => {
    const list: { title: string; dueDate: string; amount: number; isShared: boolean }[] = [];

    for (const pb of rangePersonalBills) {
      if (pb.status === 'pending') {
        list.push({ title: pb.title, dueDate: pb.date, amount: pb.amount, isShared: false });
      }
    }

    for (const sb of rangeSharedBillsDetailed) {
      if (sb.myStatus === 'pending') {
        const amt =
          sb.reimbursement?.status === 'pending' && sb.reimbursement.fromUserId === myUserId
            ? sb.reimbursement.amount
            : sb.myShareAmount;
        list.push({
          title: `[Compartilhada] ${sb.bill.title}`,
          dueDate: sb.effectiveDueDate,
          amount: amt,
          isShared: true,
        });
      }
    }

    return list.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [rangePersonalBills, rangeSharedBillsDetailed, myUserId]);

  const overdueItemsList = useMemo(() => {
    const list: { title: string; dueDate: string; amount: number; isShared: boolean }[] = [];

    for (const pb of rangePersonalBills) {
      if (pb.status === 'overdue') {
        list.push({ title: pb.title, dueDate: pb.date, amount: pb.amount, isShared: false });
      }
    }

    for (const sb of rangeSharedBillsDetailed) {
      if (sb.myStatus === 'overdue') {
        const amt =
          sb.reimbursement?.status === 'pending' && sb.reimbursement.fromUserId === myUserId
            ? sb.reimbursement.amount
            : sb.myShareAmount;
        list.push({
          title: `[Compartilhada] ${sb.bill.title}`,
          dueDate: sb.effectiveDueDate,
          amount: amt,
          isShared: true,
        });
      }
    }

    return list.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [rangePersonalBills, rangeSharedBillsDetailed, myUserId]);

  // 10. MONTH-OVER-MONTH COMPARISON (When Monthly Filter is Active)
  const monthComparison = useMemo(() => {
    if (filterMode !== 'monthly') return null;

    const prevMonth = shiftMonthStr(selectedMonth, -1);
    const [y, m] = prevMonth.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const prevStart = `${prevMonth}-01`;
    const prevEnd = `${prevMonth}-${String(lastDay).padStart(2, '0')}`;

    // Compute prev month incomes
    let prevIncomesTotal = 0;
    for (const inc of incomes) {
      if (doesItemOccurInMonth(inc.startMonth, prevMonth, inc.recurrence, inc.recurrenceMonthsCount)) {
        const ex = inc.exceptions?.[prevMonth];
        if (!ex?.isDeleted && !inc.excludedMonths?.includes(prevMonth)) {
          const isRec = statusMap.get(`income_${inc.id}_${prevMonth}`)?.isCompleted === true;
          if (isRec) prevIncomesTotal += ex?.amount ?? inc.amount;
        }
      }
    }

    // Compute prev month expenses (avulsas + personal paid bills)
    let prevExpensesTotal = 0;
    for (const exp of expenses) {
      if (exp.date >= prevStart && exp.date <= prevEnd) {
        prevExpensesTotal += exp.amount;
      }
    }
    for (const pb of bills) {
      if (doesItemOccurInMonth(pb.startMonth, prevMonth, pb.recurrence, pb.recurrenceMonthsCount)) {
        const ex = pb.exceptions?.[prevMonth];
        if (!ex?.isDeleted && !pb.excludedMonths?.includes(prevMonth)) {
          const isPaid = statusMap.get(`bill_${pb.id}_${prevMonth}`)?.isCompleted === true;
          if (isPaid) prevExpensesTotal += ex?.amount ?? pb.amount;
        }
      }
    }

    // Compute prev month pending total
    let prevPendingTotal = 0;
    for (const pb of bills) {
      if (doesItemOccurInMonth(pb.startMonth, prevMonth, pb.recurrence, pb.recurrenceMonthsCount)) {
        const ex = pb.exceptions?.[prevMonth];
        if (!ex?.isDeleted && !pb.excludedMonths?.includes(prevMonth)) {
          const isPaid = statusMap.get(`bill_${pb.id}_${prevMonth}`)?.isCompleted === true;
          if (!isPaid) prevPendingTotal += ex?.amount ?? pb.amount;
        }
      }
    }

    const calcChange = (curr: number, prev: number) => {
      if (prev === 0) return null;
      const diff = ((curr - prev) / prev) * 100;
      return Math.round(diff);
    };

    return {
      prevMonthName: formatMonthName(prevMonth, locale),
      incomesChangePct: calcChange(totalReceivedIncomes, prevIncomesTotal),
      expensesChangePct: calcChange(totalSpentPeriod, prevExpensesTotal),
      pendingChangePct: calcChange(totalPendingPayment, prevPendingTotal),
      hasData: prevIncomesTotal > 0 || prevExpensesTotal > 0 || prevPendingTotal > 0,
    };
  }, [
    filterMode,
    selectedMonth,
    incomes,
    expenses,
    bills,
    statusMap,
    locale,
    totalReceivedIncomes,
    totalSpentPeriod,
    totalPendingPayment,
  ]);

  const containerVariants: any = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05 },
    },
  };

  const itemVariants: any = {
    hidden: { opacity: 0, y: 15 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
    },
  };

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="space-y-6 max-w-6xl mx-auto pb-16"
    >
      {/* Top Header & Navigation */}
      <motion.div 
        variants={itemVariants}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass p-5 sm:p-6 rounded-[2rem] border transition-colors shadow-xs"
      >
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onReturnToFinance}
            className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer print:hidden active:scale-95"
            title="Voltar"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                {t.fullReportTitle || 'Informe Financiero'}
              </h1>
              <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black text-[9px] uppercase tracking-widest print:hidden">
                {t.readOnlyBadge || 'Analítico'}
              </span>
            </div>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-1">
              Consolidado • {filterMode === 'monthly' ? formatMonthName(selectedMonth, locale) : 'Período Personalizado'}
            </p>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={() => window.print()}
          className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md active:scale-95 transition-all flex items-center gap-2 cursor-pointer self-start sm:self-auto print:hidden uppercase tracking-widest"
        >
          <Printer className="w-4 h-4" />
          <span>{language === 'es' ? 'Imprimir' : 'Imprimir'}</span>
        </motion.button>
      </motion.div>

      {/* Monthly summary and spending distribution charts */}
      <MonthlyReportSection
        bills={bills}
        incomes={incomes}
        expenses={expenses}
        currency={currency}
        language={language}
      />

      {/* SECTION 1: FILTRO DEL INFORME */}
      <motion.div 
        variants={itemVariants}
        className="glass rounded-[2rem] border p-5 sm:p-6 shadow-xs space-y-4"
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <Filter className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">
              {t.reportFilterTitle || 'Período do Relatório'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100/70 p-1 rounded-2xl border border-slate-200/50">
            <button
              type="button"
              onClick={() => setFilterMode('monthly')}
              className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all cursor-pointer relative ${
                filterMode === 'monthly'
                  ? 'text-emerald-700'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {filterMode === 'monthly' && (
                <motion.div layoutId="filter-pill" className="absolute inset-0 bg-white rounded-xl shadow-xs" />
              )}
              <span className="relative z-10">{t.filterMonthlyLabel || 'Mensal'}</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('custom')}
              className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all cursor-pointer relative ${
                filterMode === 'custom'
                  ? 'text-emerald-700'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {filterMode === 'custom' && (
                <motion.div layoutId="filter-pill" className="absolute inset-0 bg-white rounded-xl shadow-xs" />
              )}
              <span className="relative z-10">{t.filterCustomRangeLabel || 'Período'}</span>
            </button>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200/30 dark:border-slate-800 flex items-center gap-4 flex-wrap">
          {filterMode === 'monthly' ? (
            <div className="flex items-center gap-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {t.selectMonthLabel || 'Mês:'}
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-4 py-2.5 rounded-2xl border border-slate-200 bg-white text-xs font-black text-slate-900 focus:ring-2 focus:ring-emerald-500/20 outline-hidden"
              />
            </div>
          ) : (
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {t.startDateLabel || 'Início:'}
                </label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-4 py-2.5 rounded-2xl border border-slate-200 bg-white text-xs font-black text-slate-900 focus:ring-2 focus:ring-emerald-500/20 outline-hidden"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {t.endDateLabel || 'Fim:'}
                </label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-4 py-2.5 rounded-2xl border border-slate-200 bg-white text-xs font-black text-slate-900 focus:ring-2 focus:ring-emerald-500/20 outline-hidden"
                />
              </div>
            </div>
          )}

          <div className="ml-auto text-[10px] font-bold text-slate-500 bg-emerald-50/70 px-3 py-1 rounded-lg border border-emerald-100">
            {dateRange.start} • {dateRange.end}
          </div>
        </div>
      </motion.div>

      {/* SECTION 2: RESUMEN GENERAL (KPI Cards) */}
      <div className="space-y-3">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 px-2">
          {t.generalSummaryTitle || 'Indicadores do Período'}
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* Card 1: Ingresos Recibidos */}
          <motion.div
            variants={itemVariants}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            role="button"
            tabIndex={0}
            onClick={() => onNavigateToFinance?.('incomes', { incomeFilter: 'received', month: selectedMonth })}
            className="p-5 rounded-[2rem] glass border-emerald-500/20 space-y-3 premium-shadow cursor-pointer transition-all hover:border-emerald-500/50"
            title={language === 'es' ? 'Ver Ingresos Recibidos' : 'Ver Entradas Recebidas'}
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                <ArrowUpRight className="w-5 h-5" />
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Entradas</span>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono-numbers tracking-tighter">
                {formatCurrency(totalReceivedIncomes, currency)}
              </div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                {rangeIncomes.filter((i) => i.status === 'received').length} itens • {language === 'es' ? 'Ver lista' : 'Ver lista'} →
              </span>
            </div>
          </motion.div>

          {/* Card 2: Gastos Pagados */}
          <motion.div
            variants={itemVariants}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            role="button"
            tabIndex={0}
            onClick={() => onNavigateToFinance?.('expenses', { month: selectedMonth })}
            className="p-5 rounded-[2rem] glass border-rose-500/20 space-y-3 premium-shadow cursor-pointer transition-all hover:border-rose-500/50"
            title={language === 'es' ? 'Ver Gastos Realizados' : 'Ver Saídas Realizadas'}
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-600">
                <ArrowDownLeft className="w-5 h-5" />
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest text-rose-600">Saídas</span>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono-numbers tracking-tighter">
                {formatCurrency(totalSpentPeriod, currency)}
              </div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Realizados • {language === 'es' ? 'Ver lista' : 'Ver lista'} →
              </span>
            </div>
          </motion.div>

          {/* Card 3: Facturas Pagadas */}
          <motion.div
            variants={itemVariants}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            role="button"
            tabIndex={0}
            onClick={() => onNavigateToFinance?.('bills', { billFilter: 'paid', month: selectedMonth })}
            className="p-5 rounded-[2rem] glass border-teal-500/20 space-y-3 premium-shadow cursor-pointer transition-all hover:border-teal-500/50"
            title={language === 'es' ? 'Ver Cuentas Liquidadas / Facturas Pagadas' : 'Ver Contas Liquidadas'}
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-teal-500/10 flex items-center justify-center text-teal-600">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest text-teal-600">Contas</span>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono-numbers tracking-tighter">
                {totalPaidBillsCount}
              </div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Liquidadas • {language === 'es' ? 'Ver lista' : 'Ver lista'} →
              </span>
            </div>
          </motion.div>

          {/* Card 4: Pendiente de Pago */}
          <motion.div
            variants={itemVariants}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            role="button"
            tabIndex={0}
            onClick={() => onNavigateToFinance?.('bills', { billFilter: 'pending', month: selectedMonth })}
            className="p-5 rounded-[2rem] glass border-amber-500/20 space-y-3 premium-shadow cursor-pointer transition-all hover:border-amber-500/50"
            title={language === 'es' ? 'Ver Facturas y Obligaciones Pendientes' : 'Ver Contas Pendentes'}
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                <Clock className="w-5 h-5" />
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest text-amber-600">Pendentes</span>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono-numbers tracking-tighter">
                {formatCurrency(totalPendingPayment, currency)}
              </div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Em aberto • {language === 'es' ? 'Ver lista' : 'Ver lista'} →
              </span>
            </div>
          </motion.div>

          {/* Card 5: Resultante do Período - Destaque */}
          <motion.div
            variants={itemVariants}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            role="button"
            tabIndex={0}
            onClick={() => onNavigateToFinance?.('timeline', { month: selectedMonth })}
            className={`p-6 rounded-[2.5rem] border col-span-2 lg:col-span-2 flex flex-col justify-between relative overflow-hidden premium-shadow cursor-pointer transition-all ${
              netResultPeriod >= 0
                ? 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-500'
                : 'bg-rose-600 text-white border-rose-500 hover:bg-rose-500'
            }`}
            title={language === 'es' ? 'Ver Flujo de Caja y Resumen' : 'Ver Fluxo de Caixa'}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl pointer-events-none" />
            <div className="flex items-center justify-between relative z-10">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Saldo Resultante</span>
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div className="mt-4 relative z-10">
              <div className="text-3xl sm:text-4xl font-black font-mono-numbers tracking-tighter">
                {formatCurrency(netResultPeriod, currency)}
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mt-1">
                {hasAccountBalance ? 'Saldo atual das contas' : netResultPeriod >= 0 ? 'Superávit no período' : 'Déficit no período'} • {language === 'es' ? 'Ver resumen' : 'Ver resumo'} →
              </p>
              {hasBalanceAdjustment && (
                <div className="mt-3 rounded-xl bg-white/15 border border-white/20 p-3 text-left space-y-1">
                  <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest">
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    Saldo ajustado para coincidir com as contas
                  </div>
                  <p className="text-[10px] leading-relaxed font-medium normal-case tracking-normal opacity-90">
                    Entradas menos saídas: {formatCurrency(calculatedNetResultPeriod, currency)}. Saldo atual: {formatCurrency(netResultPeriod, currency)}. Diferença: {formatCurrency(Math.abs(balanceDifference), currency)}. Isso pode ocorrer por ajustes manuais, saldo anterior, transferências ou lançamentos fora do período.
                  </p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Card 6: Total Vencido */}
          <motion.div
            variants={itemVariants}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            role="button"
            tabIndex={0}
            onClick={() => onNavigateToFinance?.('bills', { billFilter: 'overdue', month: selectedMonth })}
            className="p-5 rounded-[2rem] glass border-rose-600/30 space-y-3 premium-shadow cursor-pointer transition-all hover:border-rose-600/60"
            title={language === 'es' ? 'Ver Facturas Vencidas' : 'Ver Contas Vencidas'}
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-rose-600/10 flex items-center justify-center text-rose-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest text-rose-600">Vencido</span>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black text-rose-600 font-mono-numbers tracking-tighter">
                {formatCurrency(totalOverduePayment, currency)}
              </div>
              <span className="text-[10px] font-bold text-rose-600/80 uppercase tracking-widest">
                Atenção • {language === 'es' ? 'Ver vencidas' : 'Ver vencidas'} →
              </span>
            </div>
          </motion.div>

          {/* Card 7: Dinero por Recibir */}
          <motion.div
            variants={itemVariants}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            role="button"
            tabIndex={0}
            onClick={() => onNavigateToFinance?.('incomes', { incomeFilter: 'pending', month: selectedMonth })}
            className="p-5 rounded-[2rem] glass border-blue-500/20 space-y-3 premium-shadow cursor-pointer transition-all hover:border-blue-500/50"
            title={language === 'es' ? 'Ver Ingresos Previstos por Cobrar' : 'Ver Entradas a Receber'}
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                <Wallet className="w-5 h-5" />
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest text-blue-600">Receber</span>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono-numbers tracking-tighter">
                {formatCurrency(totalPendingIncomes, currency)}
              </div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Programado • {language === 'es' ? 'Ver a cobrar' : 'Ver a receber'} →
              </span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* SECTION 3: SECCIÓN "PENDIENTES Y VENCIDOS" */}
      <motion.div variants={itemVariants} className="glass rounded-[2rem] border p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">
            {t.pendingAndOverdueTitle || 'Pendentes e Vencidos'}
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Subcard: Pendientes */}
          <div className="space-y-3 border border-slate-200/50 rounded-2xl p-4 bg-slate-50/50">
            <div
              role="button"
              tabIndex={0}
              onClick={() => onNavigateToFinance?.('bills', { billFilter: 'pending', month: selectedMonth })}
              className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-700/50 pb-3 cursor-pointer hover:opacity-80 transition-opacity"
              title={language === 'es' ? 'Ver todas las facturas pendientes' : 'Ver todas as contas pendentes'}
            >
              <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" />
                <span>{t.statusPending || 'Pendentes'} ({pendingItemsList.length})</span>
              </span>
              <span className="text-xs font-mono-numbers font-black text-amber-700 dark:text-amber-300">
                {formatCurrency(pendingItemsList.reduce((s, i) => s + i.amount, 0), currency)} →
              </span>
            </div>

            {pendingItemsList.length === 0 ? (
              <p className="text-[10px] font-bold text-slate-400 py-4 text-center italic">
                {t.noPendingInPeriod || 'Nenhuma conta pendente.'}
              </p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1 no-scrollbar">
                {pendingItemsList.map((item, idx) => (
                  <div
                    key={`pend_${idx}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => onNavigateToFinance?.('bills', { billFilter: 'pending', month: selectedMonth })}
                    className="p-3 rounded-xl bg-white/80 border border-slate-200/70 flex items-center justify-between text-xs cursor-pointer hover:border-amber-400 hover:shadow-xs transition-all"
                  >
                    <div className="min-w-0 pr-2">
                      <span className="font-bold text-slate-900 block truncate uppercase tracking-tighter">
                        {item.title}
                      </span>
                      <span className="text-[9px] font-black text-slate-400 uppercase">
                        Venc: {item.dueDate}
                      </span>
                    </div>
                    <span className="font-mono-numbers font-black text-amber-600 shrink-0">
                      {formatCurrency(item.amount, currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Subcard: Vencidos */}
          <div className="space-y-3 border border-rose-200/30 rounded-2xl p-4 bg-rose-50/40">
            <div
              role="button"
              tabIndex={0}
              onClick={() => onNavigateToFinance?.('bills', { billFilter: 'overdue', month: selectedMonth })}
              className="flex items-center justify-between border-b border-rose-200/30 pb-3 cursor-pointer hover:opacity-80 transition-opacity"
              title={language === 'es' ? 'Ver todas las facturas vencidas' : 'Ver todas as contas vencidas'}
            >
              <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{t.statusOverdue || 'Vencidos'} ({overdueItemsList.length})</span>
              </span>
              <span className="text-xs font-mono-numbers font-black text-rose-700">
                {formatCurrency(overdueItemsList.reduce((s, i) => s + i.amount, 0), currency)} →
              </span>
            </div>

            {overdueItemsList.length === 0 ? (
              <p className="text-[10px] font-bold text-slate-400 py-4 text-center italic">
                {t.noOverdueInPeriod || 'Tudo em dia! Sem vencidos.'}
              </p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1 no-scrollbar">
                {overdueItemsList.map((item, idx) => (
                  <div
                    key={`over_${idx}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => onNavigateToFinance?.('bills', { billFilter: 'overdue', month: selectedMonth })}
                    className="p-3 rounded-xl bg-white/80 border border-rose-200/40 flex items-center justify-between text-xs cursor-pointer hover:border-rose-400 hover:shadow-xs transition-all"
                  >
                    <div className="min-w-0 pr-2">
                      <span className="font-bold text-rose-900 dark:text-rose-200 block truncate uppercase tracking-tighter">
                        {item.title}
                      </span>
                      <span className="text-[9px] font-black text-rose-400 uppercase">
                        Vencido em {item.dueDate}
                      </span>
                    </div>
                    <span className="font-mono-numbers font-black text-rose-600 shrink-0">
                      {formatCurrency(item.amount, currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* SECTION 4: LÍNEA DE TIEMPO (Cronología completa) */}
      <motion.div variants={itemVariants} className="glass rounded-[2rem] border p-5 sm:p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <Calendar className="w-4 h-4" />
            </div>
            <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">
              {t.timelineSectionTitle || 'Linha do Tempo do Período'}
            </h3>
          </div>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100">
            {combinedTimeline.length} lançamentos
          </span>
        </div>

        {/* Legend - Subtle Text with Dots */}
        <div className="flex items-center gap-x-4 gap-y-2 text-[9px] font-black uppercase tracking-widest flex-wrap pt-2 border-t border-slate-200/30">
          <span className="flex items-center gap-1.5 text-emerald-600">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" /> Pago
          </span>
          <span className="flex items-center gap-1.5 text-amber-600">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" /> Pendente
          </span>
          <span className="flex items-center gap-1.5 text-rose-600">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" /> Vencido
          </span>
          <span className="flex items-center gap-1.5 text-blue-600">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" /> Recebimento
          </span>
          <span className="flex items-center gap-1.5 text-purple-600">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]" /> Compartilhada
          </span>
        </div>

        {combinedTimeline.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-16 h-16 rounded-[2rem] bg-slate-100 flex items-center justify-center mx-auto opacity-50">
              <Receipt className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {t.noMovementsInPeriod || 'Nenhum movimento registrado neste período.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {combinedTimeline.map((item) => {
              const isPositive = item.amount > 0;

              // Color badge logic:
              let statusColor = '';
              let statusText = '';
              let StatusIcon = null;

              if (item.status === 'received') {
                statusColor = 'text-emerald-600 dark:text-emerald-400';
                statusText = t.statusReceived || 'Recebido';
                StatusIcon = CheckCircle2;
              } else if (item.status === 'paid') {
                statusColor = 'text-emerald-600 dark:text-emerald-400';
                statusText = t.statusPaid || 'Pago';
                StatusIcon = CheckCircle2;
              } else if (item.status === 'overdue') {
                statusColor = 'text-rose-600 dark:text-rose-400';
                statusText = t.statusOverdue || 'Vencido';
                StatusIcon = AlertTriangle;
              } else if (item.type === 'income') {
                statusColor = 'text-blue-600 dark:text-blue-400';
                statusText = t.statusToReceive || 'A Receber';
                StatusIcon = Clock;
              } else {
                statusColor = 'text-amber-600 dark:text-amber-400';
                statusText = t.statusPending || 'Pendente';
                StatusIcon = Clock;
              }

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedDetailItem(item)}
                  className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 cursor-pointer hover:scale-[1.01] active:scale-[0.99] group ${
                    item.isShared
                      ? 'bg-purple-500/5 border-purple-500/20'
                      : 'bg-white/80 border-slate-200/70 hover:bg-[#D1FAEB]/30'
                  }`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex flex-col items-center justify-center shrink-0 border border-slate-200/50">
                      <span className="text-[10px] font-black text-slate-400 block uppercase">
                        {formatDayMonthLabel(item.date, locale).split(' ')[1]}
                      </span>
                      <span className="text-sm font-black text-slate-900 dark:text-white block -mt-1 font-mono-numbers">
                        {formatDayMonthLabel(item.date, locale).split(' ')[0]}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-900 dark:text-white truncate group-hover:text-emerald-600 transition-colors uppercase tracking-tight">
                          {item.title}
                        </span>
                        {item.isShared && (
                          <span className="text-[8px] font-black text-purple-600 uppercase tracking-widest border border-purple-500/20 px-1.5 rounded-sm">
                            Shared
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                        <span>{item.category}</span>
                        {item.notes && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                            <span className="truncate italic normal-case font-medium">"{item.notes}"</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={`text-sm font-black font-mono-numbers tracking-tight ${
                        isPositive
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {isPositive ? '+' : ''}
                      {formatCurrency(item.amount, currency)}
                    </span>

                    <div className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest ${statusColor}`}>
                      {StatusIcon && <StatusIcon className="w-3 h-3" />}
                      <span>{statusText}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* SECTION 5: CUENTAS COMPARTIDAS (Detalle Específico) */}
      <motion.div variants={itemVariants} className="glass rounded-[2rem] border p-5 sm:p-6 shadow-xs space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600">
            <Users className="w-4 h-4" />
          </div>
          <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">
            {t.sharedAccountsReportTitle || 'Detalhe de Contas Compartilhadas'}
          </h3>
        </div>

        {rangeSharedBillsDetailed.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {t.noSharedBillsInPeriod || 'Nenhuma fatura compartilhada neste período.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {rangeSharedBillsDetailed.map((item) => {
              const reimb = item.reimbursement;
              const isSettled = reimb?.status === 'settled';
              const isReimbPending = reimb?.status === 'pending';

              return (
                <div
                  key={`shared_rep_${item.bill.id}_${item.month}`}
                  className="p-5 rounded-[2rem] border border-purple-500/10 dark:border-purple-500/20 bg-purple-500/5 dark:bg-purple-500/10 space-y-4"
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap pb-4 border-b border-purple-500/10">
                    <div className="space-y-1">
                      <span className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                        {item.bill.title}
                      </span>
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <span>{item.month}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                        <span>Venc: {item.effectiveDueDate}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                        Valor Total:
                      </span>
                      <span className="text-lg font-black font-mono-numbers text-slate-900 dark:text-white tracking-tight">
                        {formatCurrency(item.totalAmount, currency)}
                      </span>
                    </div>
                  </div>

                  {/* Breakdown Grid - Premium Display */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Minha Parte:</span>
                      <div className="text-xs font-black text-emerald-600 font-mono-numbers">
                        {formatCurrency(item.myShareAmount, currency)}
                        <span className="text-[9px] ml-1 opacity-60">({item.myPercentage}%)</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">{item.partnerName}:</span>
                      <div className="text-xs font-black text-slate-600 dark:text-slate-400 font-mono-numbers">
                        {formatCurrency(item.partnerShareAmount, currency)}
                        <span className="text-[9px] ml-1 opacity-60">({item.partnerPercentage}%)</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Pagamento:</span>
                      <div className="text-xs font-black text-slate-800 dark:text-slate-200">
                        {item.paidByUserName}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Meu Status:</span>
                      <div
                        className={`text-xs font-black uppercase tracking-tighter ${
                          item.myStatus === 'paid'
                            ? 'text-emerald-600'
                            : item.myStatus === 'overdue'
                            ? 'text-rose-600'
                            : 'text-amber-600'
                        }`}
                      >
                        {item.myStatus === 'paid'
                          ? 'Liquidado'
                          : item.myStatus === 'overdue'
                          ? 'Atrasado'
                          : 'Aberto'}
                      </div>
                    </div>
                  </div>

                  {/* Full Pay & Reimbursement Details */}
                  {item.isPaidToCreditor && (
                    <div className="p-4 rounded-2xl bg-[#D1FAEB]/50 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 shrink-0">
                          <Info className="w-4 h-4" />
                        </div>
                        <p className="text-[10px] font-bold text-slate-600 leading-relaxed max-w-md">
                          {item.paidByUserId === myUserId
                            ? `Você antecipou o pagamento integral. ${item.partnerName} deve reembolsar sua cota de ${formatCurrency(item.partnerShareAmount, currency)}.`
                            : `${item.partnerName} realizou o pagamento total da fatura.`}
                        </p>
                      </div>

                      {reimb && (
                        <div className="shrink-0">
                          {isSettled ? (
                            <div className="flex items-center gap-1.5 text-[9px] font-black text-emerald-600 uppercase tracking-widest border border-emerald-500/20 px-3 py-1.5 rounded-xl bg-emerald-500/5">
                              <CheckCircle2 className="w-3 h-3" />
                              Reembolso Liquidado
                            </div>
                          ) : isReimbPending ? (
                            <div className="flex items-center gap-1.5 text-[9px] font-black text-amber-600 uppercase tracking-widest border border-amber-500/20 px-3 py-1.5 rounded-xl bg-amber-500/5">
                              <Clock className="w-3 h-3" />
                              Reembolso: {formatCurrency(reimb.amount, currency)}
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* SECTION 6: "QUIÉN ME DEBE / A QUIÉN DEBO" */}
      <motion.div variants={itemVariants} className="glass rounded-[2rem] border p-5 sm:p-6 shadow-xs space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
            <ArrowRightLeft className="w-4 h-4" />
          </div>
          <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">
            {t.whoOwesSectionTitle || 'Balanço de Reembolsos'}
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Card: Me devem */}
          <motion.div
            whileHover={debtSummary.owedToMeItems.length > 0 ? { scale: 1.02 } : {}}
            whileTap={debtSummary.owedToMeItems.length > 0 ? { scale: 0.98 } : {}}
            onClick={() =>
              debtSummary.owedToMeItems.length > 0 &&
              setSelectedDebtDetail({ type: 'owedToMe', items: debtSummary.owedToMeItems })
            }
            className={`p-6 rounded-[2rem] border transition-all relative overflow-hidden ${
              debtSummary.owedToMeItems.length > 0
                ? 'cursor-pointer hover:border-emerald-500/30 bg-emerald-500/5 border-emerald-500/20 shadow-xs'
                : 'bg-slate-50 border-slate-200/50'
            }`}
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 block mb-3">
              {t.owedToMeLabel || 'Me devem (A Receber)'}
            </span>
            <div className="text-2xl font-black font-mono-numbers text-emerald-600 tracking-tighter">
              +{formatCurrency(debtSummary.owedToMeTotal, currency)}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {debtSummary.owedToMeItems.length > 0
                  ? `${debtSummary.owedToMeItems.length} itens pendentes`
                  : 'Nenhum valor a receber'}
              </span>
              {debtSummary.owedToMeItems.length > 0 && (
                <span className="text-[8px] font-black text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded uppercase tracking-widest">Ver Detalhes</span>
              )}
            </div>
          </motion.div>

          {/* Card: Yo debo */}
          <motion.div
            whileHover={debtSummary.iOweItems.length > 0 ? { scale: 1.02 } : {}}
            whileTap={debtSummary.iOweItems.length > 0 ? { scale: 0.98 } : {}}
            onClick={() =>
              debtSummary.iOweItems.length > 0 &&
              setSelectedDebtDetail({ type: 'iOwe', items: debtSummary.iOweItems })
            }
            className={`p-6 rounded-[2rem] border transition-all relative overflow-hidden ${
              debtSummary.iOweItems.length > 0
                ? 'cursor-pointer hover:border-rose-500/30 bg-rose-500/5 border-rose-500/20 shadow-xs'
                : 'bg-slate-50 border-slate-200/50'
            }`}
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl pointer-events-none" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-600 block mb-3">
              {t.iOweLabel || 'Eu Devo (A Pagar)'}
            </span>
            <div className="text-2xl font-black font-mono-numbers text-rose-600 tracking-tighter">
              -{formatCurrency(debtSummary.iOweTotal, currency)}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {debtSummary.iOweItems.length > 0
                  ? `${debtSummary.iOweItems.length} itens pendentes`
                  : 'Nenhuma dívida pendente'}
              </span>
              {debtSummary.iOweItems.length > 0 && (
                <span className="text-[8px] font-black text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded uppercase tracking-widest">Ver Detalhes</span>
              )}
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* SECTION 7: RESUMEN POR CATEGORÍAS (Solo ejecutados) */}
      <motion.div variants={itemVariants} className="glass rounded-[2rem] border p-5 sm:p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
              <PieChartIcon className="w-4 h-4" />
            </div>
            <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">
              {t.categoryBreakdownTitle || 'Gastos por Categoria'}
            </h3>
          </div>
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100">
            Apenas Pagos Realizados
          </span>
        </div>

        {categoryBreakdown.list.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {t.noCategoryExpensesInPeriod || 'Nenhum gasto realizado neste período.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
            {categoryBreakdown.list.map((cat, idx) => (
              <motion.div 
                key={`cat_bp_${idx}`} 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="space-y-2.5"
              >
                <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-tighter">
                  <span className="text-slate-900 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                      <Tag className="w-3 h-3" />
                    </div>
                    <span>{cat.category}</span>
                  </span>
                  <div className="text-right flex items-center gap-3">
                    <span className="text-slate-900 font-mono-numbers text-sm">
                      {formatCurrency(cat.amount, currency)}
                    </span>
                    <span className="text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-lg text-[10px]">
                      {cat.percent}%
                    </span>
                  </div>
                </div>

                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/50">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, cat.percent)}%` }}
                    transition={{ duration: 0.8, ease: "easeOut", delay: idx * 0.1 }}
                    className="bg-emerald-500 h-full rounded-full shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                  />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* SECTION 8: COMPARACIÓN DEL PERÍODO (Mes anterior) */}
      {monthComparison && (
        <motion.div variants={itemVariants} className="glass rounded-[2rem] border p-5 sm:p-6 shadow-xs space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">
              {t.monthComparisonTitle || 'Análise Comparativa'}
            </h3>
          </div>

          {!monthComparison.hasData ? (
            <div className="py-6 text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {t.noComparisonData || 'Dados insuficientes do mês anterior.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Incomes change */}
              <div className="p-5 rounded-2xl bg-white/80 border border-slate-200/70 space-y-3 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-full blur-xl pointer-events-none group-hover:scale-150 transition-transform duration-500" />
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Receitas</span>
                <div className="flex items-end justify-between">
                  <div className="text-lg font-black text-slate-900 uppercase tracking-tight">Evolução</div>
                  {monthComparison.incomesChangePct !== null ? (
                    <div
                      className={`text-sm font-black font-mono-numbers flex items-center gap-1 px-2 py-1 rounded-lg ${
                        monthComparison.incomesChangePct >= 0
                          ? 'text-emerald-600 bg-emerald-500/10'
                          : 'text-rose-600 bg-rose-500/10'
                      }`}
                    >
                      <span className="text-xs">{monthComparison.incomesChangePct >= 0 ? '↑' : '↓'}</span>
                      <span>{Math.abs(monthComparison.incomesChangePct)}%</span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">N/A</span>
                  )}
                </div>
              </div>

              {/* Expenses change */}
              <div className="p-5 rounded-2xl bg-white/80 border border-slate-200/70 space-y-3 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-16 h-16 bg-rose-500/5 rounded-full blur-xl pointer-events-none group-hover:scale-150 transition-transform duration-500" />
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Gastos Reais</span>
                <div className="flex items-end justify-between">
                  <div className="text-lg font-black text-slate-900 uppercase tracking-tight">Consumo</div>
                  {monthComparison.expensesChangePct !== null ? (
                    <div
                      className={`text-sm font-black font-mono-numbers flex items-center gap-1 px-2 py-1 rounded-lg ${
                        monthComparison.expensesChangePct <= 0
                          ? 'text-emerald-600 bg-emerald-500/10'
                          : 'text-rose-600 bg-rose-500/10'
                      }`}
                    >
                      <span className="text-xs">{monthComparison.expensesChangePct >= 0 ? '↑' : '↓'}</span>
                      <span>{Math.abs(monthComparison.expensesChangePct)}%</span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">N/A</span>
                  )}
                </div>
              </div>

              {/* Pending change */}
              <div className="p-5 rounded-2xl bg-white/80 border border-slate-200/70 space-y-3 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/5 rounded-full blur-xl pointer-events-none group-hover:scale-150 transition-transform duration-500" />
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Inadimplência</span>
                <div className="flex items-end justify-between">
                  <div className="text-lg font-black text-slate-900 uppercase tracking-tight">Pendência</div>
                  {monthComparison.pendingChangePct !== null ? (
                    <div
                      className={`text-sm font-black font-mono-numbers flex items-center gap-1 px-2 py-1 rounded-lg ${
                        monthComparison.pendingChangePct <= 0
                          ? 'text-emerald-600 bg-emerald-500/10'
                          : 'text-rose-600 bg-rose-500/10'
                      }`}
                    >
                      <span className="text-xs">{monthComparison.pendingChangePct >= 0 ? '↑' : '↓'}</span>
                      <span>{Math.abs(monthComparison.pendingChangePct)}%</span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">N/A</span>
                  )}
                </div>
              </div>
            </div>
          )}
          <div className="pt-2 text-center">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
              Base de Comparação: {monthComparison?.prevMonthName}
            </span>
          </div>
        </motion.div>
      )}

      {/* TIMELINE DETAIL MODAL */}
      <AnimatePresence>
        {selectedDetailItem && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="glass-overlay"
            onClick={() => setSelectedDetailItem(null)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="glass-modal rounded-[2.5rem] max-w-sm w-full p-6 sm:p-8 space-y-6 relative overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
              
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                    Detalle del Registro
                  </h3>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Informações Analíticas
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDetailItem(null)}
                  className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-all cursor-pointer active:scale-90"
                >
                  <span className="text-xl">✕</span>
                </button>
              </div>

              <div className="space-y-4 pt-2">
                <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/50 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nome:</span>
                    <span className="text-xs font-bold text-slate-900 dark:text-white text-right">
                      {selectedDetailItem.title}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data:</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {selectedDetailItem.date}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoria:</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {selectedDetailItem.category}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Monto:</span>
                    <span className={`text-sm font-black font-mono-numbers ${selectedDetailItem.amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {formatCurrency(Math.abs(selectedDetailItem.amount), currency)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado:</span>
                    <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600 text-[10px] font-black uppercase tracking-widest">
                      {selectedDetailItem.status}
                    </span>
                  </div>
                </div>

                {selectedDetailItem.notes && (
                  <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 space-y-1.5">
                    <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Observações:</span>
                    <p className="text-xs text-slate-600 dark:text-slate-400 italic">
                      "{selectedDetailItem.notes}"
                    </p>
                  </div>
                )}
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={() => setSelectedDetailItem(null)}
                className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-[0.2em] shadow-md cursor-pointer active:scale-95 transition-all"
              >
                Fechar
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DEBT BREAKDOWN MODAL */}
      <AnimatePresence>
        {selectedDebtDetail && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 glass-overlay"
            onClick={() => setSelectedDebtDetail(null)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="glass-modal rounded-[2.5rem] max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
              
              <div className="p-6 sm:p-8 border-b border-slate-200/50 flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-slate-900 tracking-tight leading-tight">
                    {selectedDebtDetail.type === 'owedToMe' ? 'Me Devem' : 'Eu Devo'}
                  </h3>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Detalhamento de Reembolsos
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDebtDetail(null)}
                  className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-all cursor-pointer active:scale-90"
                >
                  <span className="text-xl">✕</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-3 no-scrollbar">
                {selectedDebtDetail.items.map((item, idx) => (
                  <motion.div
                    key={`debt_it_${idx}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="p-4 rounded-2xl bg-white/80 border border-slate-200/70 flex items-center justify-between"
                  >
                    <div className="min-w-0 pr-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                        {item.partnerName}
                      </span>
                      <span className="text-xs font-bold text-slate-900 block truncate uppercase tracking-tighter">
                        {item.billTitle}
                      </span>
                      <span className="text-[9px] font-black text-slate-400 uppercase mt-0.5 block">
                        {item.month}
                      </span>
                    </div>
                    <span className="text-sm font-black font-mono-numbers text-emerald-600 shrink-0">
                      {formatCurrency(item.amount, currency)}
                    </span>
                  </motion.div>
                ))}
              </div>

              <div className="p-6 sm:p-8 pt-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => setSelectedDebtDetail(null)}
                  className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-[0.2em] shadow-md cursor-pointer active:scale-95 transition-all"
                >
                  Entendido
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
