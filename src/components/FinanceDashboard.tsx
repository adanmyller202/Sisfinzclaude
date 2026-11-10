/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const NumberTicker = ({ value, currency, className }: { value: number; currency: CurrencyCode; className?: string }) => {
  const [displayValue, setDisplayValue] = useState(value);
  
  useEffect(() => {
    const duration = 1000;
    const steps = 60;
    const increment = (value - displayValue) / steps;
    let currentStep = 0;
    
    const interval = setInterval(() => {
      currentStep++;
      setDisplayValue(prev => prev + increment);
      if (currentStep >= steps) {
        setDisplayValue(value);
        clearInterval(interval);
      }
    }, duration / steps);
    
    return () => clearInterval(interval);
  }, [value]);

  return <span className={className}>{formatCurrency(displayValue, currency)}</span>;
};

import { CurrencyCode, BillItem, IncomeItem, ExpenseItem, LanguageCode, ChallengeGoal, SavingGoal, SharedUserSummary, SharedBill } from '../types';
import { useFinanceControl } from '../hooks/useFinanceControl';
import { useCategories } from '../hooks/useCategories';
import { useSavings } from '../hooks/useSavings';
import { useAccounts } from '../hooks/useAccounts';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, getGoalSavedAmount } from '../utils/currency';
import { formatMonthName, formatDayMonthLabel } from '../utils/finance';
import { getTranslations, getLocaleForLanguage } from '../utils/i18n';
import { BalanceModal } from './BalanceModal';
import { ConfirmationModal } from './ConfirmationModal';
import { BalanceBreakdownModal } from './BalanceBreakdownModal';
import { TransactionModal, TransactionType, EditingTransaction } from './TransactionModal';
import { CategoryManager } from './CategoryManager';
import { UpcomingBillsView } from './UpcomingBillsView';
import { SavingsSection } from './SavingsSection';
import { SavingGoalModal } from './SavingGoalModal';
import { TransferModal } from './TransferModal';
import { MonthlyReportSection } from './MonthlyReportSection';
import { CashflowCalendar } from './CashflowCalendar';
import { BillComparisonBadge } from './BillComparisonBadge';
import { MonthlyFreedomScale } from './MonthlyFreedomScale';
import { ErrorBoundary } from './ErrorBoundary';
import {
  ChevronLeft,
  ChevronRight,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Plus,
  Receipt,
  TrendingUp,
  ShoppingBag,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Edit2,
  Trash2,
  Sparkles,
  Tag,
  CalendarRange,
  X,
  Bot,
  Target,
  PiggyBank,
  ArrowRightLeft,
  PieChart as PieChartIcon,
  Eye,
  Undo2,
} from 'lucide-react';

interface FinanceDashboardProps {
  currency: CurrencyCode;
  language?: LanguageCode;
  onOpenMoneChat?: () => void;
  goals?: ChallengeGoal[];
  activeGoal?: ChallengeGoal | null;
  onNavigateToGoals?: () => void;
  onNavigateToAccounts?: () => void;
  initialTab?: 'timeline' | 'bills' | 'upcoming' | 'incomes' | 'expenses' | 'categories' | 'savings' | 'report' | 'calendar' | 'freedom';
  initialBillFilter?: 'all' | 'pending' | 'paid' | 'overdue';
  initialIncomeFilter?: 'all' | 'pending' | 'received';
  initialMonth?: string;
  initialTransaction?: { type: 'bill' | 'income' | 'expense'; id: string };
  onReturnToFinance?: () => void;
  activePartners?: SharedUserSummary[];
  onShareWithPartner?: (params: {
    title: string;
    amount: number;
    dueDate: string;
    dueDay: number;
    category: string;
    notes?: string;
    partnerId: string;
  }) => Promise<any>;
  onToggleBillPaidCustom?: (billId: string, month: string, isPaid: boolean) => Promise<any> | void;
  onDeleteBillCustom?: (billId: string) => Promise<any> | void;
  onDeleteBillOccurrenceCustom?: (
    billId: string,
    targetMonth: string,
    scope: 'this' | 'this_and_future'
  ) => Promise<any> | void;
}

export const FinanceDashboard: React.FC<FinanceDashboardProps> = ({
  currency,
  language = 'pt',
  onOpenMoneChat,
  goals,
  activeGoal,
  onNavigateToGoals,
  onNavigateToAccounts,
  initialTab,
  initialBillFilter,
  initialIncomeFilter,
  initialMonth,
  initialTransaction,
  onReturnToFinance,
  activePartners = [],
  onShareWithPartner,
  onToggleBillPaidCustom,
  onDeleteBillCustom,
  onDeleteBillOccurrenceCustom,
}) => {
  const t = getTranslations(language);
  const locale = getLocaleForLanguage(language);

  const handleToggleBill = async (billId: string, month: string, isPaid: boolean) => {
    if (onToggleBillPaidCustom) {
      await onToggleBillPaidCustom(billId, month, isPaid);
    } else {
      await toggleBillPaid(billId, month, isPaid);
    }
  };

  // Accounts are the source of truth for the forecast starting balance.
  const { accounts, totalBalance: accountsTotalBalance, adjustAccountBalanceForFinancialItem } = useAccounts();

  const {
    selectedMonth,
    setSelectedMonth,
    goToPreviousMonth,
    goToNextMonth,
    goToCurrentMonth,
    loading,

    // Data lists
    bills,
    incomes,
    expenses,
    monthBills,
    monthIncomes,
    monthExpenses,
    timelineItems,
    statusRecords,

    // KPIs
    baseBalance,
    currentBalance,
    totalReceivedMonth,
    totalSpentMonth,
    toReceive,
    toPay,
    totalIncomeMonth,
    totalExpensesMonth,
    forecastBalance,

    // Operations
    updateCurrentBalance,
    addBill,
    updateBill,
    updateBillOccurrence,
    deleteBill,
    deleteBillOccurrence,
    toggleBillPaid,

    addIncome,
    updateIncome,
    deleteIncome,
    toggleIncomeReceived,

    addExpense,
    updateExpense,
    deleteExpense,
    sharedBills,
  } = useFinanceControl(undefined, accounts.length > 0 ? accountsTotalBalance : undefined);

  const { user } = useAuth();
  const userId = user?.uid;
  const [isBalanceBreakdownOpen, setIsBalanceBreakdownOpen] = useState(false);

  const effectiveCurrentBalance = accounts.length > 0 ? accountsTotalBalance : currentBalance;

  // Unified Categories Hook (Supports editing and deleting predefined + custom)
  const {
    allDisplayCategories,
    addCategory,
    updateCategory,
    deleteCategory,
    resetPredefinedCategories,
    getCategoriesFor,
  } = useCategories();

  // Navigation tab inside Finance: 'timeline' | 'bills' | 'upcoming' | 'incomes' | 'expenses' | 'categories' | 'savings' | 'report' | 'calendar' | 'freedom'
  const [activeTab, setActiveTab] = useState<
    'timeline' | 'bills' | 'upcoming' | 'incomes' | 'expenses' | 'categories' | 'savings' | 'report' | 'calendar' | 'freedom'
  >(initialTab || 'timeline');

  const billsRef = useRef<HTMLDivElement>(null);
  const incomesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab === 'bills' && billsRef.current) {
      billsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (activeTab === 'incomes' && incomesRef.current) {
      incomesRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [activeTab]);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
      // Ensure scroll happens after tab is set
      setTimeout(() => {
        if (initialTab === 'bills' && billsRef.current) {
          billsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else if (initialTab === 'incomes' && incomesRef.current) {
          incomesRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, [initialTab]);

  // Savings Hook & State
  const {
    savings,
    transactions: savingTransactions,
    loading: savingsLoading,
    createSavingGoal,
    updateSavingGoal,
    deleteSavingGoal,
    deleteSavingTransaction,
    transferToSaving,
    withdrawFromSaving,
  } = useSavings();

  const [isSavingGoalModalOpen, setIsSavingGoalModalOpen] = useState(false);
  const [savingGoalToEdit, setSavingGoalToEdit] = useState<SavingGoal | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferDefaultSavingId, setTransferDefaultSavingId] = useState<string | undefined>(undefined);
  const [transferDefaultType, setTransferDefaultType] = useState<'deposit' | 'withdrawal'>('deposit');

  const handleOpenTransfer = (savingId?: string, type: 'deposit' | 'withdrawal' = 'deposit') => {
    setTransferDefaultSavingId(savingId);
    setTransferDefaultType(type);
    setIsTransferModalOpen(true);
  };

  const handleOpenCreateSaving = () => {
    setSavingGoalToEdit(null);
    setIsSavingGoalModalOpen(true);
  };

  const handleOpenEditSaving = (goal: SavingGoal) => {
    setSavingGoalToEdit(goal);
    setIsSavingGoalModalOpen(true);
  };

  const handleExecuteTransfer = async (
    savingId: string,
    amount: number,
    exchangeRate: number = 1,
    date?: string,
    note?: string
  ) => {
    await transferToSaving(savingId, amount, exchangeRate, date, note, { addExpense, currency });
  };

  const handleExecuteWithdrawal = async (
    savingId: string,
    amount: number,
    exchangeRate: number = 1,
    date?: string,
    note?: string
  ) => {
    await withdrawFromSaving(savingId, amount, exchangeRate, date, note, {
      addIncome,
      toggleIncomeReceived,
      currentMonthStr: selectedMonth,
    });
  };

  // Filter inside bills tab: 'all' | 'pending' | 'paid' | 'overdue'
  const [billFilter, setBillFilter] = useState<'all' | 'pending' | 'paid' | 'overdue'>(
    initialBillFilter || 'pending'
  );

  // Filter inside incomes tab: 'all' | 'pending' | 'received'
  const [incomeFilter, setIncomeFilter] = useState<'all' | 'pending' | 'received'>(
    initialIncomeFilter || 'all'
  );

  useEffect(() => {
    if (initialBillFilter) {
      setBillFilter(initialBillFilter);
    }
  }, [initialBillFilter]);

  useEffect(() => {
    if (initialIncomeFilter) {
      setIncomeFilter(initialIncomeFilter);
    }
  }, [initialIncomeFilter]);

  useEffect(() => {
    if (initialMonth) {
      setSelectedMonth(initialMonth);
    }
  }, [initialMonth, setSelectedMonth]);

  // Balance Adjustment Modal
  const [isBalanceOpen, setIsBalanceOpen] = useState(false);

  // Unified Transaction Modal (Switch between Fatura, Despesa, and Receita directly on the screen)
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [initialTxType, setInitialTxType] = useState<TransactionType>('bill');
  const [editingTx, setEditingTx] = useState<EditingTransaction | null>(null);
  const openedCalendarTransactionRef = useRef<string | null>(null);

  // When arriving from the planning calendar, open the selected record on the
  // Finance screen itself (never on top of the calendar's day sheet).
  useEffect(() => {
    if (!initialTransaction) {
      openedCalendarTransactionRef.current = null;
      return;
    }

    const targetMonth = initialMonth || selectedMonth;
    const targetKey = `${initialTransaction.type}:${initialTransaction.id}:${targetMonth}`;
    if (openedCalendarTransactionRef.current === targetKey || loading) return;

    if (initialMonth && selectedMonth !== initialMonth) {
      setSelectedMonth(initialMonth);
      return;
    }

    const item = initialTransaction.type === 'bill'
      ? bills.find((entry) => entry.id === initialTransaction.id)
      : initialTransaction.type === 'income'
        ? incomes.find((entry) => entry.id === initialTransaction.id)
        : expenses.find((entry) => entry.id === initialTransaction.id);

    if (!item) return;

    openedCalendarTransactionRef.current = targetKey;
    setInitialTxType(initialTransaction.type);
    setEditingTx({ id: item.id, type: initialTransaction.type, item });
    setIsTxModalOpen(true);
  }, [initialTransaction, initialMonth, selectedMonth, setSelectedMonth, loading, bills, incomes, expenses]);

  // Recurring bill delete prompt modal
  const [billToDelete, setBillToDelete] = useState<{ bill: BillItem; month: string } | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeletingOccurrence, setIsDeletingOccurrence] = useState(false);

  const handleConfirmDelete = async () => {
    if (!deleteCandidate) return;
    setIsDeleting(true);
    try {
      if (deleteCandidate.type === 'income') {
        const inc = incomes.find((i) => i.id === deleteCandidate.originalId);
        if (inc) {
          // 1. Check if this income was a savings withdrawal
          const tx = savingTransactions.find((t) => t.incomeId === inc.id);
          if (tx) {
            const goal = savings.find((s) => s.id === tx.savingId);
            if (goal) {
              try {
                await updateSavingGoal(goal.id, { currentAmount: (goal.currentAmount || 0) + tx.amount });
              } catch (e) {
                console.error("Error updating goal:", e);
                alert(`Error al devolver saldo a la meta: ${e instanceof Error ? e.message : 'Error desconocido'}`);
                throw e;
              }
            }
            try {
              await deleteSavingTransaction(tx.id);
            } catch (e) {
              console.error("Error deleting saving tx:", e);
              alert(`Error al eliminar registro de retiro: ${e instanceof Error ? e.message : 'Error desconocido'}`);
              throw e;
            }
          }
          
          // 2. Adjust account balance (only if received)
          const recordKey = `income_${inc.id}_${selectedMonth}`;
          const isReceived = statusRecords.find(r => r.id === recordKey)?.isCompleted;
          
          if (isReceived) {
            if (inc.accountDistributions && inc.accountDistributions.length > 0) {
              for (const dist of inc.accountDistributions) {
                await adjustAccountBalanceForFinancialItem(dist.accountId, -dist.amount);
              }
            } else if (inc.accountId) {
              await adjustAccountBalanceForFinancialItem(inc.accountId, -inc.amount);
            }
          }
        }
        try {
          await deleteIncome(deleteCandidate.originalId);
        } catch (e) {
          console.error("Error deleting income:", e);
          alert(`Error al eliminar el ingreso: ${e instanceof Error ? e.message : 'Error desconocido'}`);
          throw e;
        }
      } else if (deleteCandidate.type === 'expense') {
        const exp = expenses.find((e) => e.id === deleteCandidate.originalId);
        if (exp) {
          // 1. Check if this expense was a savings deposit
          const tx = savingTransactions.find((t) => t.expenseId === exp.id);
          if (tx) {
            const goal = savings.find((s) => s.id === tx.savingId);
            if (goal) {
              try {
                await updateSavingGoal(goal.id, { currentAmount: Math.max(0, (goal.currentAmount || 0) - tx.amount) });
              } catch (e) {
                console.error("Error updating goal:", e);
                alert(`Error al revertir saldo de la meta: ${e instanceof Error ? e.message : 'Error desconocido'}`);
                throw e;
              }
            }
            try {
              await deleteSavingTransaction(tx.id);
            } catch (e) {
              console.error("Error deleting saving tx:", e);
              alert(`Error al eliminar registro de depósito: ${e instanceof Error ? e.message : 'Error desconocido'}`);
              throw e;
            }
          }

          // 2. Adjust account balance (expenses are always executed/paid)
          if (exp.accountId) {
            await adjustAccountBalanceForFinancialItem(exp.accountId, exp.amount);
          }
        }
        try {
          await deleteExpense(deleteCandidate.originalId);
        } catch (e) {
          console.error("Error deleting expense:", e);
          alert(`Error al eliminar el gasto: ${e instanceof Error ? e.message : 'Error desconocido'}`);
          throw e;
        }
      } else if (deleteCandidate.type === 'bill') {
         const billId = deleteCandidate.originalId;
         const bill = bills.find(b => b.id === billId);
         if (bill) {
           // Restore balance if paid
           const recordKey = `bill_${billId}_${selectedMonth}`;
           const isPaid = statusRecords.find(r => r.id === recordKey)?.isCompleted;
           if (isPaid && bill.accountId) {
             // Use exception amount if exists for this month
             const amount = Number(bill.exceptions?.[selectedMonth]?.amount ?? bill.amount) || 0;
             await adjustAccountBalanceForFinancialItem(bill.accountId, amount);
           }
         }
         
         try {
           if (onDeleteBillCustom) {
             await onDeleteBillCustom(billId);
           } else {
             await deleteBill(billId);
           }
         } catch (e) {
           console.error("Error deleting bill:", e);
           alert(`Error al eliminar la factura: ${e instanceof Error ? e.message : 'Error desconocido'}`);
           throw e;
         }
      }
    } catch (err) {
      console.error('Error deleting item in FinanceDashboard:', err);
    } finally {
      setIsDeleting(false);
      setDeleteCandidate(null);
    }
  };



  // Month Bills count by status
  const pendingBillsCount = monthBills.filter((b) => b.status === 'pending').length;
  const overdueBillsCount = monthBills.filter((b) => b.status === 'overdue').length;
  const paidBillsCount = monthBills.filter((b) => b.status === 'paid').length;

  // Month Incomes count by status
  const pendingIncomesCount = monthIncomes.filter((i) => i.status === 'pending').length;
  const receivedIncomesCount = monthIncomes.filter((i) => i.status === 'received').length;

  // Filtered bills for display
  const filteredMonthBills = monthBills.filter((b) => {
    if (billFilter === 'all') return true;
    return b.status === billFilter;
  });

  // Filtered incomes for display
  const filteredMonthIncomes = monthIncomes.filter((i) => {
    if (incomeFilter === 'all') return true;
    return i.status === incomeFilter;
  });

  // Synthesize shared bills into BillItem format for UpcomingBillsView
  const allBillsForUpcoming = useMemo(() => {
    const synths = sharedBills.map((sb: SharedBill) => {
      const startMonthFallback = sb.startMonth || sb.month || (sb.dueDate ? sb.dueDate.substring(0, 7) : '');
      return {
        id: `sb_${sb.id}`,
        userId: userId || '',
        name: `[Compartilhada] ${sb.title}`,
        amount: sb.amount,
        dueDate: sb.dueDate,
        dueDay: sb.dueDay || 1,
        category: sb.category || 'Contas Compartilhadas',
        notes: sb.notes,
        recurrence: sb.recurrence || 'none',
        recurrenceMonthsCount: sb.recurrenceMonthsCount || 0,
        startMonth: startMonthFallback,
        createdAt: sb.createdAt,
        updatedAt: sb.updatedAt,
        exceptions: sb.exceptions,
        excludedMonths: sb.excludedMonths,
      } as BillItem;
    });
    return [...bills, ...synths];
  }, [bills, sharedBills, userId]);

  // Open modal for new item
  const handleOpenNew = (type: TransactionType) => {
    setEditingTx(null);
    setInitialTxType(type);
    setIsTxModalOpen(true);
  };

  // Open modal for editing existing item
  const handleEditBill = (bill: BillItem) => {
    setEditingTx({ id: bill.id, type: 'bill', item: bill });
    setIsTxModalOpen(true);
  };

  const handleEditIncome = (inc: IncomeItem) => {
    setEditingTx({ id: inc.id, type: 'income', item: inc });
    setIsTxModalOpen(true);
  };

  const handleEditExpense = (exp: ExpenseItem) => {
    setEditingTx({ id: exp.id, type: 'expense', item: exp });
    setIsTxModalOpen(true);
  };

  // Handle delete on a bill (with recurring prompt if monthly)
  const handleDeleteBillClick = (bill: BillItem, month?: string) => {
    const targetMonth = month || selectedMonth;
    if (bill.recurrence === 'monthly') {
      setBillToDelete({ bill, month: targetMonth });
    } else {
      setDeleteCandidate({ type: 'bill', originalId: bill.id, name: bill.name });
    }
  };

  const handleApplyRecurrenceDelete = async (scope: 'this' | 'this_and_future') => {
    if (!billToDelete) return;
    try {
      setIsDeletingOccurrence(true);
      const targetMonth = billToDelete.month;
      if (onDeleteBillOccurrenceCustom) {
        await onDeleteBillOccurrenceCustom(billToDelete.bill.id, targetMonth, scope);
      } else {
        await deleteBillOccurrence(billToDelete.bill.id, targetMonth, scope);
      }
      setBillToDelete(null);
    } catch (err) {
      console.error('Error deleting bill occurrence:', err);
    } finally {
      setIsDeletingOccurrence(false);
    }
  };

  const handleReturnToMainFinance = () => {
    setActiveTab('timeline');
    if (onReturnToFinance) onReturnToFinance();
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants: any = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
  };

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="space-y-4 bg-[#F4F8F6] min-h-screen pb-12 font-sans overflow-x-hidden mesh-gradient"
    >
      {/* 1. TOP HEADER - Translucent Glass */}
      <motion.div variants={itemVariants} className="px-1 pt-2">
        <div className="glass rounded-3xl p-2 flex items-center justify-between shadow-xs ring-1 ring-white/10">
          <motion.button
            whileTap={{ scale: 0.9 }}
            type="button"
            onClick={goToPreviousMonth}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </motion.button>
          
          <AnimatePresence mode="wait">
            <motion.span 
              key={selectedMonth}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="text-sm font-black text-slate-900 dark:text-white capitalize tracking-tight"
            >
              {formatMonthName(selectedMonth, locale)}
            </motion.span>
          </AnimatePresence>

          <motion.button
            whileTap={{ scale: 0.9 }}
            type="button"
            onClick={goToNextMonth}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </motion.button>
        </div>
      </motion.div>

      {/* 2. SALDO ACTUAL CARD - Premium Glass & Depth */}
      <motion.div variants={itemVariants} className="px-1">
        <div className="relative overflow-hidden group">
          <div className="absolute -inset-1 bg-gradient-to-tr from-emerald-500 to-teal-500 opacity-20 blur-2xl group-hover:opacity-30 transition-opacity duration-500" />
          
          <div className="glass rounded-[2rem] p-6 shadow-xl relative ring-1 ring-white/20 dark:ring-emerald-500/20 premium-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
                  Saldo Actual
                </span>
              </div>
              <motion.button
                whileHover={{ rotate: 180 }}
                transition={{ duration: 0.4 }}
                type="button"
                onClick={() => setIsBalanceBreakdownOpen(true)}
                className="text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer p-1"
              >
                <Eye className="w-4 h-4" />
              </motion.button>
            </div>

            <div className="mb-6">
              <NumberTicker 
                value={effectiveCurrentBalance} 
                currency={currency} 
                className="text-4xl sm:text-5xl font-black font-mono-numbers tracking-tight text-slate-900 dark:text-white block"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                type="button"
                onClick={() => setIsBalanceBreakdownOpen(true)}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold transition-shadow shadow-md hover:shadow-emerald-500/10 cursor-pointer"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>Cuentas</span>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                type="button"
                onClick={() => handleOpenTransfer()}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-emerald-600 text-white text-xs font-bold transition-shadow shadow-md hover:shadow-emerald-600/30 cursor-pointer ring-1 ring-white/10"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Transferir</span>
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* 3. QUICK ACTION PILLS - Micro-interactions */}
      <motion.div variants={itemVariants} className="grid grid-cols-4 gap-2 px-1">
        {[
          { icon: ArrowRightLeft, label: 'Transf.', color: 'emerald', onClick: () => handleOpenTransfer() },
          { icon: Receipt, label: 'Factura', color: 'rose', onClick: () => handleOpenNew('bill') },
          { icon: ArrowUpRight, label: 'Ingreso', color: 'emerald', onClick: () => handleOpenNew('income') },
          { icon: ArrowDownLeft, label: 'Gasto', color: 'amber', onClick: () => handleOpenNew('expense') }
        ].map((action, idx) => (
          <motion.button
            key={idx}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.92 }}
            type="button"
            onClick={action.onClick}
            className="glass rounded-2xl p-3 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer group premium-shadow shadow-sm hover:ring-2 hover:ring-emerald-500/30"
          >
            <div className={`w-9 h-9 rounded-xl bg-${action.color}-500/10 text-${action.color}-600 dark:text-${action.color}-400 flex items-center justify-center group-hover:scale-110 transition-transform`}>
              <action.icon className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">{action.label}</span>
          </motion.button>
        ))}
      </motion.div>

      {/* 4. SUMMARY CARDS - Por Cobrar / Por Pagar */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 gap-3 px-1">
        {/* Por Cobrar */}
        <motion.div
          whileHover={{ y: -4 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setActiveTab('incomes')}
          className="glass rounded-3xl p-4 shadow-sm space-y-3 cursor-pointer transition-all group premium-shadow"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-emerald-600 transition-colors">
              Por Cobrar
            </span>
            <div className="w-7 h-7 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black font-mono-numbers text-emerald-600 dark:text-emerald-400">
              <NumberTicker value={toReceive} currency={currency} />
            </div>
            <p className="text-[10px] font-bold text-slate-500 mt-0.5">
              {pendingIncomesCount} {t.itemsCount}
            </p>
          </div>
          <div className="pt-2 border-t border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between text-[10px]">
            <span className="text-slate-500 font-medium">Total</span>
            <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(totalIncomeMonth, currency)}</span>
          </div>
        </motion.div>

        {/* Por Pagar */}
        <motion.div
          whileHover={{ y: -4 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setActiveTab('bills')}
          className="glass rounded-3xl p-4 shadow-sm space-y-3 cursor-pointer transition-all group premium-shadow"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-rose-600 transition-colors">
              Por Pagar
            </span>
            <div className="w-7 h-7 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black font-mono-numbers text-rose-600 dark:text-rose-400">
              <NumberTicker value={-toPay} currency={currency} />
            </div>
            <p className="text-[10px] font-bold text-slate-500 mt-0.5">
              {pendingBillsCount} {t.itemsCount}
            </p>
          </div>
          <div className="pt-2 border-t border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between text-[10px]">
            <span className="text-slate-500 font-medium">Total</span>
            <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(totalExpensesMonth, currency)}</span>
          </div>
        </motion.div>
      </motion.div>

      {/* 5. PREVISIÓN FIN DE MES CARD - Premium Glass Emerald */}
      <motion.div variants={itemVariants} className="px-1">
        <div className="glass-emerald rounded-[2rem] p-6 shadow-lg relative overflow-hidden group premium-shadow">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-125 transition-transform duration-700">
            <Sparkles className="w-24 h-24 text-emerald-500" />
          </div>
          
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Previsión Fin de Mes
            </span>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 text-[10px] font-black rounded-full shadow-sm ${forecastBalance >= 0 ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                {forecastBalance >= 0 ? 'SOBRA' : 'FALTA'}
              </span>
            </div>
          </div>

          <div className="mb-4">
            <NumberTicker 
              value={forecastBalance} 
              currency={currency} 
              className={`text-4xl font-black font-mono-numbers tracking-tight block ${forecastBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
            />
          </div>

          <div className="pt-4 border-t border-emerald-500/10 flex items-center justify-between text-xs font-bold text-emerald-800/60 dark:text-emerald-400/60">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>Status Salud Financiera</span>
            </div>
            <span className="text-emerald-700 dark:text-emerald-300">
              {forecastBalance >= 0 ? 'Optimista' : 'Atención'}
            </span>
          </div>
        </div>
      </motion.div>

      {/* 6. NAVIGATION TABS - Premium Glass Sliding Indicator */}
      <motion.div variants={itemVariants} className="px-1">
        <div className="glass p-1.5 rounded-2xl flex items-center gap-1 overflow-x-auto no-scrollbar shadow-lg ring-1 ring-white/20">
          {[
            { id: 'timeline', icon: Calendar, label: t.tabOverview, count: timelineItems.length, color: 'blue' },
            { id: 'bills', icon: Receipt, label: t.tabBills, count: monthBills.length, color: 'rose' },
            { id: 'upcoming', icon: CalendarRange, label: t.tabUpcoming, color: 'rose' },
            { id: 'incomes', icon: TrendingUp, label: t.tabIncomes, count: monthIncomes.length, color: 'emerald' },
            { id: 'expenses', icon: ShoppingBag, label: t.tabExpenses, count: monthExpenses.length, color: 'amber' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`relative flex items-center gap-2 px-4 py-2 text-xs font-black rounded-xl transition-all whitespace-nowrap cursor-pointer z-10 ${
                activeTab === tab.id ? 'text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-emerald-600 rounded-xl -z-10 shadow-md shadow-emerald-600/20"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <tab.icon className={`w-3.5 h-3.5 ${activeTab === tab.id ? 'text-white' : `text-${tab.color}-500`}`} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${activeTab === tab.id ? 'bg-white/20' : 'bg-slate-200'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </motion.div>


      {/* 4. TAB CONTENT 1: VISÃO GERAL (TIMELINE) */}
      {/* 4. TAB CONTENT 1: VISÃO GERAL (TIMELINE) */}
      {activeTab === 'timeline' && (
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="glass rounded-[2.5rem] p-4 sm:p-6 space-y-5 shadow-xl premium-shadow mx-1"
        >
          <div className="flex items-center justify-between pb-4 border-b border-slate-200/50 dark:border-slate-800/50">
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                {t.overviewTitle} {formatMonthName(selectedMonth, locale)}
              </h3>
            </div>
            <div className="text-[10px] font-black bg-emerald-800 px-3 py-1.5 rounded-xl text-white shadow-md">
              {timelineItems.length} {t.itemsCount}
            </div>
          </div>

          {timelineItems.length === 0 ? (
            <motion.div variants={itemVariants} className="py-16 text-center space-y-5">
              <div className="w-20 h-20 mx-auto rounded-[2rem] bg-emerald-50 flex items-center justify-center shadow-inner border border-emerald-200/50">
                <Calendar className="w-10 h-10 text-emerald-600/40" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-black text-slate-700 dark:text-slate-300">
                  {t.overviewEmpty}
                </p>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-500 max-w-[200px] mx-auto">
                  Comienza agregando una factura o ingreso para este mes.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <motion.button
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  onClick={() => handleOpenNew('bill')}
                  className="px-5 py-2.5 text-xs font-black text-rose-600 bg-rose-500/10 rounded-xl hover:bg-rose-500/20 cursor-pointer transition-colors"
                >
                  {t.addBill}
                </motion.button>
                <motion.button
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  onClick={() => handleOpenNew('income')}
                  className="px-5 py-2.5 text-xs font-black text-emerald-600 bg-emerald-500/10 rounded-xl hover:bg-emerald-500/20 cursor-pointer transition-colors"
                >
                  {t.addIncome}
                </motion.button>
              </div>
            </motion.div>
          ) : (
            <div className="space-y-3.5">
              {timelineItems.map((item) => {
                const isInc = item.type === 'income';
                const isBill = item.type === 'bill';

                const handleTimelineItemClick = (e?: React.MouseEvent) => {
                  if (e?.target && (e.target as HTMLElement).closest('button')?.getAttribute('title') === t.deleteItem) return;
                  if (isBill) {
                    const foundBill = bills.find((b) => b.id === item.originalId);
                    if (foundBill) handleEditBill(foundBill);
                  } else if (isInc) {
                    const foundInc = incomes.find((inc) => inc.id === item.originalId);
                    if (foundInc) handleEditIncome(foundInc);
                  } else if (item.type === 'expense') {
                    const foundExp = expenses.find((exp) => exp.id === item.originalId);
                    if (foundExp) handleEditExpense(foundExp);
                  }
                };

                return (
                  <motion.div
                    layout="position"
                    variants={itemVariants}
                    key={item.id}
                    onClick={handleTimelineItemClick}
                    whileHover={{ scale: 1.01, backgroundColor: 'rgba(255, 255, 255, 0.9)' }}
                    whileTap={{ scale: 0.98 }}
                    className={`p-4 rounded-[1.75rem] border transition-all flex items-center justify-between gap-3 cursor-pointer premium-shadow ${
                      item.status === 'paid' || item.status === 'received'
                        ? 'bg-slate-50/60 border-slate-200/40 opacity-70'
                        : item.status === 'overdue'
                        ? 'bg-rose-500/5 border-rose-500/30'
                        : 'glass border-slate-200/50 shadow-md'
                    }`}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-slate-100 flex flex-col items-center justify-center shrink-0 border border-slate-200/50 shadow-inner">
                        <span className="text-[12px] font-black text-slate-900 leading-none">
                          {item.date.split('-')[2]}
                        </span>
                        <span className="text-[8px] font-black text-slate-500 uppercase mt-0.5">
                          {formatMonthName(item.date.substring(0, 7), locale).substring(0, 3)}
                        </span>
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className={`text-xs sm:text-sm font-black truncate ${item.status === 'paid' || item.status === 'received' ? 'text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                            {item.name}
                          </h4>
                          {item.installmentLabel && (
                            <span className="text-[8px] font-black px-1.5 py-0.5 rounded-lg bg-amber-500 text-white shadow-sm">
                              {item.installmentLabel}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 dark:text-slate-500">
                          <span className="truncate">{item.category}</span>
                          {item.notes && (
                            <span className="truncate italic max-w-[100px]">
                              • {item.notes}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span
                          className={`text-sm font-black font-mono-numbers tracking-tighter ${
                            isInc
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          } ${item.status === 'paid' || item.status === 'received' ? 'opacity-50' : ''}`}
                        >
                          {isInc ? '+' : '-'}
                          {formatCurrency(Math.abs(item.amount), currency)}
                        </span>
                      </div>

                      {/* Unified Status Checkbox Button */}
                      {(isInc || isBill) && (
                        <motion.button
                          whileTap={{ scale: 0.85 }}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isInc) {
                              toggleIncomeReceived(item.originalId, selectedMonth, item.status !== 'received');
                            } else {
                              handleToggleBill(item.originalId, selectedMonth, item.status !== 'paid');
                            }
                          }}
                          className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-lg ${
                            item.status === 'received' || item.status === 'paid'
                              ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                              : item.status === 'overdue'
                              ? 'bg-rose-500 text-white shadow-rose-500/30'
                              : 'bg-white text-slate-400 border border-slate-200 hover:border-emerald-500/50'
                          }`}
                        >
                          <CheckCircle2 className={`w-5 h-5 ${item.status === 'received' || item.status === 'paid' || item.status === 'overdue' ? 'opacity-100' : 'opacity-20'}`} />
                        </motion.button>
                      )}

                      {!isInc && !isBill && (
                         <div className="w-9 h-9 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-200/50">
                           <ShoppingBag className="w-4 h-4" />
                         </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      )}


      {/* 5. TAB CONTENT 2: FATURAS DO MÊS */}
      {/* 5. TAB CONTENT 2: FATURAS DO MÊS */}
      {activeTab === 'bills' && (
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          ref={billsRef} 
          className="glass rounded-[2.5rem] p-4 sm:p-6 space-y-5 shadow-xl premium-shadow mx-1"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 flex items-center justify-center">
                <Receipt className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                  {t.tabBills}
                </h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {formatMonthName(selectedMonth, locale)}
                </p>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={() => handleOpenNew('bill')}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-black text-white bg-rose-600 hover:bg-rose-500 rounded-2xl shadow-lg shadow-rose-600/20 transition-colors cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>{t.addBill}</span>
            </motion.button>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 border-b border-slate-200/50 dark:border-slate-800/50 pb-4 flex-wrap">
            {[
              { id: 'pending', label: t.filterPending, count: pendingBillsCount, color: 'amber' },
              { id: 'paid', label: t.filterPaid, count: paidBillsCount, color: 'emerald' },
              { id: 'overdue', label: t.filterOverdue, count: overdueBillsCount, color: 'rose' },
              { id: 'all', label: t.filterAll, count: monthBills.length, color: 'slate' }
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setBillFilter(f.id as any)}
                className={`px-3 py-1.5 text-[10px] font-black rounded-xl transition-all cursor-pointer border ${
                  billFilter === f.id
                    ? `bg-${f.color === 'slate' ? 'slate-800' : f.color + '-500'} text-white border-transparent shadow-md`
                    : 'bg-white/80 text-slate-600 border-slate-200 hover:border-rose-500/50'
                }`}
              >
                {f.label} ({f.count})
              </button>
            ))}
          </div>

          {filteredMonthBills.length === 0 ? (
            <motion.div variants={itemVariants} className="py-12 text-center text-slate-400">
              <p className="text-xs font-black uppercase tracking-widest">{t.noUpcomingBills}</p>
            </motion.div>
          ) : (
            <div className="space-y-3.5">
              {filteredMonthBills.map((bOcc) => {
                const bill = bOcc.bill;
                const isPaid = bOcc.status === 'paid';
                const isOverdue = bOcc.status === 'overdue';

                return (
                  <motion.div
                    layout="position"
                    variants={itemVariants}
                    key={bill.id}
                    onClick={() => handleEditBill(bill)}
                    whileHover={{ x: 4, backgroundColor: 'rgba(244, 63, 94, 0.05)' }}
                    className={`p-4 rounded-[1.75rem] border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer premium-shadow ${
                      isPaid
                        ? 'bg-slate-50/60 border-slate-200/40 opacity-70'
                        : isOverdue
                        ? 'bg-rose-500/5 border-rose-500/30 shadow-rose-500/5'
                        : 'glass border-slate-200/50 shadow-md'
                    }`}
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className={`text-xs sm:text-sm font-black truncate ${isPaid ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                          {bill.name}
                        </h4>
                        {bOcc.installmentLabel && (
                          <span className="text-[8px] font-black px-1.5 py-0.5 rounded-lg bg-amber-500 text-white shadow-sm">
                            {bOcc.installmentLabel}
                          </span>
                        )}
                        <span className={`text-[8px] font-black px-2 py-0.5 rounded-lg shadow-sm ${
                          isPaid ? 'bg-emerald-500 text-white' : isOverdue ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white'
                        }`}>
                          {isPaid ? t.statusPaid : isOverdue ? t.statusOverdue : t.statusPending}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 dark:text-slate-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{t.dayPrefix} {bill.dueDay} ({bOcc.effectiveDueDate})</span>
                        </div>
                        <span>•</span>
                        <span className="truncate">{bill.category}</span>
                      </div>

                      <BillComparisonBadge
                        bill={bill}
                        selectedMonth={selectedMonth}
                        allBills={allBillsForUpcoming || bills}
                        currency={currency}
                        language={language}
                      />
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      <div className="text-right">
                        <span className={`text-sm sm:text-base font-black font-mono-numbers tracking-tighter ${isPaid ? 'text-slate-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {formatCurrency(bill.amount, currency)}
                        </span>
                      </div>

                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleBill(bill.id, selectedMonth, !isPaid);
                        }}
                        className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-lg ${
                          isPaid
                            ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        <CheckCircle2 className="w-5 h-5" />
                      </motion.button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteBillClick(bill);
                        }}
                        className="w-9 h-9 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      )}

      {/* 6. TAB CONTENT 3: PRÓXIMAS FATURAS (Continuous Scroll) */}
      {activeTab === 'upcoming' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-1">
          <UpcomingBillsView
            bills={allBillsForUpcoming}
            currency={currency}
            language={language}
            startMonthStr={selectedMonth}
            statusRecords={statusRecords}
            userId={userId}
            onSelectBill={(bill) => handleEditBill(bill)}
            onToggleBillPaid={handleToggleBill}
            onDeleteBillClick={handleDeleteBillClick}
            onNewBill={() => handleOpenNew('bill')}
          />
        </motion.div>
      )}


      {/* 7. TAB CONTENT 4: RENDAS & A RECEBER */}
      {/* 7. TAB CONTENT 4: RENDAS & A RECEBER */}
      {activeTab === 'incomes' && (
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          ref={incomesRef} 
          className="glass rounded-[2.5rem] p-4 sm:p-6 space-y-5 shadow-xl premium-shadow mx-1"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                  {t.tabIncomes}
                </h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {formatMonthName(selectedMonth, locale)}
                </p>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={() => handleOpenNew('income')}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-500 rounded-2xl shadow-lg shadow-emerald-600/20 transition-colors cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>{t.addIncome}</span>
            </motion.button>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 border-b border-slate-200/50 dark:border-slate-800/50 pb-4 flex-wrap">
            {[
              { id: 'pending', label: t.statusToReceive, count: pendingIncomesCount, color: 'blue' },
              { id: 'received', label: t.statusReceived, count: receivedIncomesCount, color: 'emerald' },
              { id: 'all', label: t.filterAll, count: monthIncomes.length, color: 'slate' }
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setIncomeFilter(f.id as any)}
                className={`px-3 py-1.5 text-[10px] font-black rounded-xl transition-all cursor-pointer border ${
                  incomeFilter === f.id
                    ? `bg-${f.color === 'slate' ? 'slate-800' : f.color + '-500'} text-white border-transparent shadow-md`
                    : 'bg-white/80 text-slate-600 border-slate-200 hover:border-emerald-500/50'
                }`}
              >
                {f.label} ({f.count})
              </button>
            ))}
          </div>

          {filteredMonthIncomes.length === 0 ? (
            <motion.div variants={itemVariants} className="py-12 text-center text-slate-400">
              <p className="text-xs font-black uppercase tracking-widest">{t.noUpcomingBills}</p>
            </motion.div>
          ) : (
            <div className="space-y-3.5">
              {filteredMonthIncomes.map((iOcc) => {
                const inc = iOcc.income;
                const isReceived = iOcc.status === 'received';

                return (
                  <motion.div
                    layout="position"
                    variants={itemVariants}
                    key={inc.id}
                    onClick={() => handleEditIncome(inc)}
                    whileHover={{ x: 4, backgroundColor: 'rgba(16, 185, 129, 0.05)' }}
                    className={`p-4 rounded-[1.75rem] border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer premium-shadow ${
                      isReceived
                        ? 'bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/30 opacity-80'
                        : 'glass border-slate-200/50 dark:border-slate-700/50'
                    }`}
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className={`text-xs sm:text-sm font-black truncate ${isReceived ? 'text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                          {inc.name}
                        </h4>
                        <span className={`text-[8px] font-black px-2 py-0.5 rounded-lg shadow-sm ${
                          isReceived ? 'bg-emerald-500 text-white' : 'bg-blue-500 text-white'
                        }`}>
                          {isReceived ? t.statusReceived : t.statusToReceive}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 dark:text-slate-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{t.dayPrefix} {inc.expectedDay} ({iOcc.effectiveDate})</span>
                        </div>
                        <span>•</span>
                        <span className="truncate">{inc.category}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      <div className="text-right">
                        <span className={`text-sm sm:text-base font-black font-mono-numbers tracking-tighter ${isReceived ? 'text-emerald-700 dark:text-emerald-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          +{formatCurrency(inc.amount, currency)}
                        </span>
                      </div>

                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleIncomeReceived(inc.id, selectedMonth, !isReceived);
                        }}
                        className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-lg ${
                          isReceived
                            ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        <CheckCircle2 className="w-5 h-5" />
                      </motion.button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteCandidate({ type: 'income', originalId: inc.id, name: inc.name });
                          }}
                          className="w-9 h-9 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      )}

      {/* 8. TAB CONTENT 5: DESPESAS AVULSAS */}
      {activeTab === 'expenses' && (
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="glass rounded-[2.5rem] p-4 sm:p-6 space-y-5 shadow-xl premium-shadow mx-1"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                  {t.tabExpenses}
                </h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {formatMonthName(selectedMonth, locale)}
                </p>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={() => handleOpenNew('expense')}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-black text-white bg-amber-600 hover:bg-amber-500 rounded-2xl shadow-lg shadow-amber-600/20 transition-colors cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>{t.addExpense}</span>
            </motion.button>
          </div>

          {monthExpenses.length === 0 ? (
            <motion.div variants={itemVariants} className="py-12 text-center text-slate-400">
              <p className="text-xs font-black uppercase tracking-widest">{t.noUpcomingBills}</p>
            </motion.div>
          ) : (
            <div className="space-y-3.5">
              {monthExpenses.map((exp) => (
                <motion.div
                  variants={itemVariants}
                  key={exp.id}
                  onClick={() => handleEditExpense(exp)}
                  whileHover={{ x: 4, backgroundColor: 'rgba(245, 158, 11, 0.05)' }}
                  className="glass rounded-[1.75rem] border border-slate-200/50 dark:border-slate-700/50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer premium-shadow shadow-md transition-all"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                        {exp.name}
                      </h4>
                      <span className="text-[8px] font-black px-1.5 py-0.5 rounded-lg bg-amber-100 text-amber-800 border border-amber-200 shadow-2xs">
                        {t.statusSingleExpense}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 dark:text-slate-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{exp.date}</span>
                      </div>
                      <span>•</span>
                      <span className="truncate">{exp.category}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <div className="text-right">
                      <span className="text-sm sm:text-base font-black font-mono-numbers tracking-tighter text-rose-600 dark:text-rose-400">
                        -{formatCurrency(exp.amount, currency)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteCandidate({ type: 'expense', originalId: exp.id, name: exp.name });
                      }}
                      className="w-9 h-9 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      )}


      {/* 8. TAB CONTENT: CALENDÁRIO DE CAIXA */}
      {activeTab === 'calendar' && (
        <CashflowCalendar
          month={selectedMonth}
          items={timelineItems}
          startBalance={baseBalance}
          currency={currency}
          language={language}
        />
      )}

      {/* 8.5. TAB CONTENT: ESCALA DE LIBERDADE */}
      {activeTab === 'freedom' && (
        <MonthlyFreedomScale
          bills={allBillsForUpcoming || bills}
          incomes={incomes}
          expenses={expenses}
          sharedBills={sharedBills}
          statusRecords={statusRecords}
          userId={userId}
          currency={currency}
          language={language}
          startMonth={selectedMonth}
        />
      )}

      {/* 9. TAB CONTENT 6: GERENCIAMENTO DE CATEGORIAS */}
      {activeTab === 'categories' && (
        <motion.div initial="hidden" animate="visible" variants={containerVariants} className="space-y-4 mx-1">
          <motion.button
            variants={itemVariants}
            type="button"
            onClick={handleReturnToMainFinance}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-black text-slate-700 bg-white/70 backdrop-blur-md border border-slate-200/60 rounded-2xl transition-all cursor-pointer hover:bg-white shadow-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>{language === 'es' ? 'Volver' : 'Voltar'}</span>
          </motion.button>
          <motion.div variants={itemVariants}>
            <CategoryManager
              language={language}
              allCategories={allDisplayCategories}
              onAddCategory={addCategory}
              onUpdateCategory={updateCategory}
              onDeleteCategory={deleteCategory}
              onResetPredefined={resetPredefinedCategories}
            />
          </motion.div>
        </motion.div>
      )}

      {/* 10. TAB CONTENT 7: AHORROS (SAVINGS) */}
      {activeTab === 'savings' && (
        <motion.div initial="hidden" animate="visible" variants={containerVariants} className="space-y-4 mx-1">
          <motion.button
            variants={itemVariants}
            type="button"
            onClick={handleReturnToMainFinance}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-black text-slate-700 bg-white/70 backdrop-blur-md border border-slate-200/60 rounded-2xl transition-all cursor-pointer hover:bg-white shadow-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>{language === 'es' ? 'Volver' : 'Voltar'}</span>
          </motion.button>
          <motion.div variants={itemVariants}>
            <ErrorBoundary fallbackTitle="Error al cargar la sección de Ahorros">
              <SavingsSection
                savings={savings || []}
                transactions={savingTransactions || []}
                currentBalance={currentBalance}
                currency={currency}
                language={language}
                onOpenCreateModal={handleOpenCreateSaving}
                onOpenEditModal={handleOpenEditSaving}
                onOpenTransferModal={handleOpenTransfer}
                onDeleteGoal={deleteSavingGoal}
              />
            </ErrorBoundary>
          </motion.div>
        </motion.div>
      )}

      {/* 11. TAB CONTENT 8: GRÁFICO DE PIZZA MENSAL */}
      {activeTab === 'report' && (
        <motion.div initial="hidden" animate="visible" variants={containerVariants} className="space-y-4 mx-1">
          <motion.button
            variants={itemVariants}
            type="button"
            onClick={handleReturnToMainFinance}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-black text-slate-700 bg-white/70 backdrop-blur-md border border-slate-200/60 rounded-2xl transition-all cursor-pointer hover:bg-white shadow-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>{language === 'es' ? 'Volver' : 'Voltar'}</span>
          </motion.button>
          <motion.div variants={itemVariants} className="glass rounded-[2.5rem] p-4 sm:p-6 shadow-xl premium-shadow">
            <ErrorBoundary fallbackTitle="Error al generar el gráfico mensual">
              <MonthlyReportSection
                bills={bills || []}
                incomes={incomes || []}
                expenses={expenses || []}
                currency={currency}
                language={language}
              />
            </ErrorBoundary>
          </motion.div>
        </motion.div>
      )}


      {/* RECURRING BILL DELETE CONFIRMATION MODAL */}
      {billToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 glass-overlay animate-in fade-in duration-150 overflow-hidden overscroll-contain"
        >
          <div className="glass-modal rounded-3xl max-w-md w-full max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2.5rem)] overflow-y-auto overscroll-contain p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {t.recurringDeletePromptTitle}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    "{billToDelete.bill.name}" • {formatMonthName(billToDelete.month, locale)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBillToDelete(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              {t.recurringDeletePromptSubtitle}
            </p>

            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                disabled={isDeletingOccurrence}
                onClick={() => handleApplyRecurrenceDelete('this')}
                className="w-full p-3 rounded-2xl border-2 border-slate-200 hover:border-rose-500 bg-white text-left transition-all cursor-pointer group"
              >
                <div className="font-bold text-xs text-slate-900 group-hover:text-rose-600">
                  {t.deleteOnlyThisOption}
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {t.deleteOnlyThisDesc}
                </p>
              </button>

              <button
                type="button"
                disabled={isDeletingOccurrence}
                onClick={() => handleApplyRecurrenceDelete('this_and_future')}
                className="w-full p-3 rounded-2xl border-2 border-rose-500 bg-rose-50/50 dark:bg-rose-950/40 text-left transition-all cursor-pointer group"
              >
                <div className="font-bold text-xs text-rose-700 dark:text-rose-300">
                  {t.deleteThisAndFutureOption}
                </div>
                <p className="text-[10px] text-slate-600 dark:text-slate-300 mt-0.5">
                  {t.deleteThisAndFutureDesc}
                </p>
              </button>
            </div>

            <div className="pt-1 flex justify-end">
              <button
                type="button"
                disabled={isDeletingOccurrence}
                onClick={() => setBillToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                {t.cancelBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Balance Breakdown Modal */}
      <ConfirmationModal
        isOpen={!!deleteCandidate}
        title={
          deleteCandidate?.type === 'income' 
            ? t.deleteIncomeTitle 
            : deleteCandidate?.type === 'bill' 
              ? t.deleteBillTitle 
              : t.deleteExpenseTitle
        }
        message={(t.deleteConfirmQuestion as string).replace('{name}', deleteCandidate?.name || '')}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteCandidate(null)}
        isLoading={isDeleting}
        confirmLabel={t.deleteConfirmAction as string}
        cancelLabel={t.cancelBtn as string}
        loadingLabel={t.deletingState as string}
      />


      <BalanceBreakdownModal
        isOpen={isBalanceBreakdownOpen}
        onClose={() => setIsBalanceBreakdownOpen(false)}
        accounts={accounts}
        currency={currency}
        language={language}
        onNavigateToAccounts={onNavigateToAccounts}
      />

      {/* 1. Balance Modal */}
      <BalanceModal
        isOpen={isBalanceOpen}
        onClose={() => setIsBalanceOpen(false)}
        currentBalance={currentBalance}
        currency={currency}
        language={language}
        onSave={updateCurrentBalance}
      />

      {/* 2. Unified Switchable Transaction Modal */}
      <TransactionModal
        isOpen={isTxModalOpen}
        onClose={() => {
          setIsTxModalOpen(false);
          setEditingTx(null);
        }}
        accounts={accounts}
        onOpenNewAccount={onNavigateToAccounts}
        currency={currency}
        language={language}
        selectedMonth={selectedMonth}
        initialType={initialTxType}
        editingTransaction={editingTx}
        getCategoriesFor={getCategoriesFor}
        onAddCategory={addCategory}
        onSaveBill={addBill}
        onUpdateBill={updateBill}
        onUpdateBillOccurrence={updateBillOccurrence}
        onDeleteBill={deleteBill}
        onSaveIncome={async (data) => {
          return await addIncome(data);
        }}
        onUpdateIncome={async (id, partial) => {
          const oldInc = incomes.find((i) => i.id === id);
          const recordKey = `income_${id}_${selectedMonth}`;
          const isReceived = statusRecords.find((r) => r.id === recordKey)?.isCompleted;

          if (oldInc && isReceived) {
            if (oldInc.accountDistributions && oldInc.accountDistributions.length > 0) {
              for (const dist of oldInc.accountDistributions) {
                await adjustAccountBalanceForFinancialItem(dist.accountId, -dist.amount);
              }
            } else if (oldInc.accountId) {
              await adjustAccountBalanceForFinancialItem(oldInc.accountId, -oldInc.amount);
            }
          }

          await updateIncome(id, partial);

          if (oldInc && isReceived) {
            const newDists = partial.accountDistributions !== undefined ? partial.accountDistributions : oldInc.accountDistributions;
            const newAccountId = partial.accountId !== undefined ? partial.accountId : oldInc.accountId;
            const newAmount = partial.amount !== undefined ? partial.amount : oldInc.amount;

            if (newDists && newDists.length > 0) {
              for (const dist of newDists) {
                await adjustAccountBalanceForFinancialItem(dist.accountId, +dist.amount);
              }
            } else if (newAccountId) {
              await adjustAccountBalanceForFinancialItem(newAccountId, +newAmount);
            }
          }
        }}
        onDeleteIncome={async (id) => {
          const inc = incomes.find((i) => i.id === id);
          const recordKey = `income_${id}_${selectedMonth}`;
          const isReceived = statusRecords.find((r) => r.id === recordKey)?.isCompleted;

          if (inc && isReceived) {
            if (inc.accountDistributions && inc.accountDistributions.length > 0) {
              for (const dist of inc.accountDistributions) {
                await adjustAccountBalanceForFinancialItem(dist.accountId, -dist.amount);
              }
            } else if (inc.accountId) {
              await adjustAccountBalanceForFinancialItem(inc.accountId, -inc.amount);
            }
          }
          await deleteIncome(id);
        }}
        onSaveExpense={async (data) => {
          const res = await addExpense(data);
          if (data.accountId) {
            await adjustAccountBalanceForFinancialItem(data.accountId, -data.amount);
          }
          return res;
        }}
        onUpdateExpense={async (id, partial) => {
          const oldExp = expenses.find((e) => e.id === id);
          if (oldExp && oldExp.accountId) {
            await adjustAccountBalanceForFinancialItem(oldExp.accountId, +oldExp.amount);
          }
          await updateExpense(id, partial);
          const newAccId = partial.accountId !== undefined ? partial.accountId : oldExp?.accountId;
          const newAmt = partial.amount !== undefined ? partial.amount : oldExp?.amount ?? 0;
          if (newAccId) {
            await adjustAccountBalanceForFinancialItem(newAccId, -newAmt);
          }
        }}
        onDeleteExpense={async (id) => {
          const exp = expenses.find((e) => e.id === id);
          if (exp && exp.accountId) {
            await adjustAccountBalanceForFinancialItem(exp.accountId, +exp.amount);
          }
          await deleteExpense(id);
        }}
        activePartners={activePartners}
        onShareWithPartner={onShareWithPartner}
      />

      {/* 3. Saving Goal Modal (Create / Edit) */}
      <SavingGoalModal
        isOpen={isSavingGoalModalOpen}
        onClose={() => {
          setIsSavingGoalModalOpen(false);
          setSavingGoalToEdit(null);
        }}
        onSave={async (data) => {
          if (savingGoalToEdit) {
            await updateSavingGoal(savingGoalToEdit.id, data);
          } else {
            await createSavingGoal(data);
          }
        }}
        goalToEdit={savingGoalToEdit}
        currency={currency}
        language={language}
      />

      {/* 4. Transfer Modal (Available Balance <-> Savings Goals) */}
      <TransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        savings={savings}
        currentBalance={currentBalance}
        currency={currency}
        language={language}
        defaultSavingId={transferDefaultSavingId}
        defaultType={transferDefaultType}
        onTransferToSaving={handleExecuteTransfer}
        onWithdrawFromSaving={handleExecuteWithdrawal}
        onOpenCreateSaving={handleOpenCreateSaving}
      />
      </motion.div>
  );
};
