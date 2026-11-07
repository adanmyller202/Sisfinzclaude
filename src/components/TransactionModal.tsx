/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CurrencyCode,
  LanguageCode,
  BillItem,
  ExpenseItem,
  IncomeItem,
  RecurrenceType,
  CategoryScope,
  SharedUserSummary,
  AccountItem,
  AccountDistribution,
} from '../types';
import { getTodayStr, formatMonthName, getInstallmentPosition } from '../utils/finance';
import { formatCurrency, CURRENCIES } from '../utils/currency';
import { getTranslations } from '../utils/i18n';
import { ACCOUNT_TYPE_CONFIG } from './AccountModal';
import {
  X,
  Receipt,
  TrendingUp,
  ShoppingBag,
  Check,
  Calendar,
  Repeat,
  Tag,
  Plus,
  AlertCircle,
  Landmark,
  MessageSquare,
  ChevronRight,
  Divide,
  Wallet,
} from 'lucide-react';

export type TransactionType = 'bill' | 'expense' | 'income';

export interface EditingTransaction {
  id: string;
  type: TransactionType;
  item: BillItem | ExpenseItem | IncomeItem;
}

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currency: CurrencyCode;
  language?: LanguageCode;
  accounts?: AccountItem[];
  onOpenNewAccount?: () => void;
  selectedMonth?: string;
  initialType?: TransactionType;
  defaultDate?: string;
  editingTransaction?: EditingTransaction | null;
  editingItem?: EditingTransaction | null;
  getCategoriesFor?: (scope: 'bill' | 'income' | 'expense' | 'all') => string[];
  onAddCategory?: (name: string, scope: CategoryScope) => Promise<unknown>;
  onSaveBill?: (data: Omit<BillItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<any> | void;
  onUpdateBill?: (id: string, partial: Partial<BillItem>) => Promise<any> | void;
  onUpdateBillOccurrence?: (
    id: string,
    targetMonth: string,
    partial: Partial<BillItem>,
    scope: 'this' | 'this_and_future'
  ) => Promise<any> | void;
  onDeleteBill?: (id: string) => Promise<any> | void;
  onSaveIncome?: (data: Omit<IncomeItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<any> | void;
  onUpdateIncome?: (id: string, partial: Partial<IncomeItem>) => Promise<any> | void;
  onDeleteIncome?: (id: string) => Promise<any> | void;
  onSaveExpense?: (data: Omit<ExpenseItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<any> | void;
  onUpdateExpense?: (id: string, partial: Partial<ExpenseItem>) => Promise<any> | void;
  onDeleteExpense?: (id: string) => Promise<any> | void;
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
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  currency,
  language = 'pt',
  accounts = [],
  onOpenNewAccount,
  selectedMonth,
  initialType = 'bill',
  defaultDate,
  editingTransaction,
  editingItem,
  getCategoriesFor = () => [],
  onAddCategory,
  onSaveBill = () => {},
  onUpdateBill,
  onUpdateBillOccurrence,
  onDeleteBill,
  onSaveIncome = () => {},
  onUpdateIncome,
  onDeleteIncome,
  onSaveExpense = () => {},
  onUpdateExpense,
  onDeleteExpense,
}) => {
  const activeEditing = editingTransaction || editingItem || null;
  const t = getTranslations(language);

  const [type, setType] = useState<TransactionType>(initialType);

  // Form Fields
  const [name, setName] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [date, setDate] = useState(getTodayStr());
  const [category, setCategory] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [recurrence, setRecurrence] = useState<RecurrenceType>('none');
  const [recurrenceMode, setRecurrenceMode] = useState<'forever' | 'limited'>('forever');
  const [monthsCountStr, setMonthsCountStr] = useState<string>('6');

  // Status & Errors
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quick inline category creation
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  // Prompt for recurring bill installment edits
  const [showRecurrencePrompt, setShowRecurrencePrompt] = useState(false);
  const [pendingBillPayload, setPendingBillPayload] = useState<Omit<
    BillItem,
    'id' | 'userId' | 'createdAt' | 'updatedAt'
  > | null>(null);

  // Active accounts filtering
  const activeAccounts = React.useMemo(() => accounts.filter((a) => a.isActive !== false), [accounts]);

  // Account selection fields
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [incomeDistMode, setIncomeDistMode] = useState<'single' | 'multi'>('single');
  const [incomeDistributions, setIncomeDistributions] = useState<Record<string, string>>({});

  // Active categories for the currently chosen type
  const availableCategories = React.useMemo(() => {
    return getCategoriesFor(type);
  }, [type, getCategoriesFor]);

  const prevIsOpenRef = React.useRef(isOpen);
  const prevEditingIdRef = React.useRef<string | null>(null);

  useEffect(() => {
    const isOpening = isOpen && !prevIsOpenRef.current;
    const currentEditId = activeEditing ? `${activeEditing.type}_${activeEditing.id}` : null;
    const isEditTargetChanged = currentEditId !== prevEditingIdRef.current;

    prevIsOpenRef.current = isOpen;
    prevEditingIdRef.current = currentEditId;

    if (!isOpen) return;

    if (isOpening || isEditTargetChanged) {
      if (activeEditing) {
        const { type: editType, item } = activeEditing;
        setType(editType);
        setName(item.name || '');
        setAmountStr(String(item.amount || ''));
        setNotes(item.notes || '');

        if (item.accountDistributions && item.accountDistributions.length > 0) {
          setIncomeDistMode('multi');
          const distMap: Record<string, string> = {};
          item.accountDistributions.forEach((d) => {
            distMap[d.accountId] = String(d.amount);
          });
          setIncomeDistributions(distMap);
          setSelectedAccountId(item.accountId || activeAccounts[0]?.id || '');
        } else if (item.accountId) {
          setIncomeDistMode('single');
          setSelectedAccountId(item.accountId);
          setIncomeDistributions({});
        } else {
          setIncomeDistMode('single');
          setSelectedAccountId(activeAccounts[0]?.id || '');
          setIncomeDistributions({});
        }

        if (editType === 'bill') {
          const b = item as BillItem;
          setDate(b.dueDate || getTodayStr());
          setCategory(b.category || '');
          setRecurrence(b.recurrence || 'none');
          if (b.recurrenceMonthsCount && b.recurrenceMonthsCount > 0) {
            setRecurrenceMode('limited');
            setMonthsCountStr(String(b.recurrenceMonthsCount));
          } else {
            setRecurrenceMode('forever');
            setMonthsCountStr('6');
          }
        } else if (editType === 'income') {
          const inc = item as IncomeItem;
          setDate(inc.expectedDate || getTodayStr());
          setCategory(inc.category || '');
          setRecurrence(inc.recurrence || 'none');
          if (inc.recurrenceMonthsCount && inc.recurrenceMonthsCount > 0) {
            setRecurrenceMode('limited');
            setMonthsCountStr(String(inc.recurrenceMonthsCount));
          } else {
            setRecurrenceMode('forever');
            setMonthsCountStr('12');
          }
        } else {
          const exp = item as ExpenseItem;
          setDate(exp.date || getTodayStr());
          setCategory(exp.category || '');
          setRecurrence('none');
        }
      } else {
        setType(initialType);
        setName('');
        setAmountStr('');
        setDate(defaultDate || getTodayStr());
        setNotes('');
        setRecurrence('none');
        setRecurrenceMode('forever');
        setMonthsCountStr(initialType === 'income' ? '12' : '6');
        setCategory('');
        setError(null);
        setIncomeDistMode('single');
        setSelectedAccountId(activeAccounts[0]?.id || '');
        setIncomeDistributions({});
      }

      setIsCreatingCategory(false);
      setNewCategoryName('');
      setShowRecurrencePrompt(false);
      setPendingBillPayload(null);
    }
  }, [isOpen, editingTransaction, initialType, defaultDate, activeAccounts]);

  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    setError(null);
    if (newType === 'expense') {
      setRecurrence('none');
    }
    const newCats = getCategoriesFor(newType);
    if (!newCats.includes(category)) {
      setCategory('');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim() || !onAddCategory) return;
    try {
      setIsSavingCategory(true);
      await onAddCategory(newCategoryName.trim(), type);
      setCategory(newCategoryName.trim());
      setNewCategoryName('');
      setIsCreatingCategory(false);
    } catch (err) {
      console.error('Error creating inline category:', err);
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const val = parseFloat(amountStr.replace(',', '.'));
    if (!name.trim()) {
      setError(t.nameLabel + (language === 'es' ? ' es obligatorio.' : language === 'pt' ? ' é obrigatório.' : ' is required.'));
      return;
    }
    if (isNaN(val) || val <= 0) {
      setError(
        language === 'es'
          ? 'Por favor, ingresa un monto válido mayor que cero.'
          : language === 'pt'
          ? 'Por favor, informe um valor válido maior que zero.'
          : 'Please enter a valid amount greater than zero.'
      );
      return;
    }
    if (!date) {
      setError(
        language === 'es' ? 'Por favor, selecciona una fecha.' : 'Por favor, selecione uma data.'
      );
      return;
    }
    if (!category || !category.trim() || category === 'Selecionar categoria' || category === 'Seleccionar categoría' || category === 'Select category') {
      setError(t.selectCategoryRequiredError || 'Por favor, selecione uma categoria.');
      return;
    }

    const day = date && date.includes('-') ? parseInt(date.split('-')[2], 10) || 1 : 1;
    const startMonth = date.substring(0, 7);
    let recurrenceMonthsCount = 0;
    if (recurrence === 'monthly' && recurrenceMode === 'limited') {
      const parsedM = parseInt(monthsCountStr, 10);
      if (!monthsCountStr || isNaN(parsedM) || parsedM <= 0) {
        setError('Por favor, informe uma quantidade válida de meses (maior que 0).');
        return;
      }
      recurrenceMonthsCount = parsedM;
    }

    if (type === 'bill') {
      const payload: Omit<BillItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'> = {
        name: name.trim(),
        amount: val,
        dueDate: date,
        dueDay: day,
        category: category.trim(),
        notes: notes.trim() || undefined,
        accountId: selectedAccountId || undefined,
        recurrence,
        recurrenceMonthsCount,
        startMonth,
      };

      if (editingTransaction && editingTransaction.type === 'bill' && (editingTransaction.item as BillItem).recurrence === 'monthly' && onUpdateBillOccurrence) {
        setPendingBillPayload(payload);
        setShowRecurrencePrompt(true);
        return;
      }

      try {
        setIsSubmitting(true);
        if (editingTransaction && editingTransaction.type === 'bill' && onUpdateBill) {
          await onUpdateBill(editingTransaction.id, payload);
        } else {
          if (editingTransaction && editingTransaction.type !== 'bill') {
            if (editingTransaction.type === 'expense' && onDeleteExpense) await onDeleteExpense(editingTransaction.id);
            else if (editingTransaction.type === 'income' && onDeleteIncome) await onDeleteIncome(editingTransaction.id);
          }
          await onSaveBill(payload);
        }
        onClose();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Falha ao salvar a fatura.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (type === 'expense') {
      const payload: Omit<ExpenseItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'> = {
        name: name.trim(),
        amount: val,
        date,
        category: category.trim(),
        notes: notes.trim() || undefined,
        accountId: selectedAccountId || undefined,
      };

      try {
        setIsSubmitting(true);
        if (editingTransaction && editingTransaction.type === 'expense' && onUpdateExpense) {
          await onUpdateExpense(editingTransaction.id, payload);
        } else {
          if (editingTransaction && editingTransaction.type !== 'expense') {
            if (editingTransaction.type === 'bill' && onDeleteBill) await onDeleteBill(editingTransaction.id);
            else if (editingTransaction.type === 'income' && onDeleteIncome) await onDeleteIncome(editingTransaction.id);
          }
          await onSaveExpense(payload);
        }
        onClose();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Falha ao salvar despesa.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (type === 'income') {
      let finalAccountId = selectedAccountId || undefined;
      let finalDistributions: AccountDistribution[] | undefined = undefined;

      if (incomeDistMode === 'multi') {
        const currentDistTotal = Object.values(incomeDistributions).reduce(
          (sum, strVal) => sum + (parseFloat(strVal.replace(',', '.')) || 0),
          0
        );

        if (Math.abs(currentDistTotal - val) >= 0.01) {
          setError(`Distribua o valor total da receita. Soma deve ser exatamente ${formatCurrency(val, currency)}.`);
          return;
        }

        const distList: AccountDistribution[] = Object.entries(incomeDistributions)
          .map(([accId, strVal]) => ({
            accountId: accId,
            amount: parseFloat(strVal.replace(',', '.')) || 0,
          }))
          .filter((d) => d.amount > 0);

        finalDistributions = distList;
        finalAccountId = distList[0]?.accountId || undefined;
      } else {
        finalAccountId = selectedAccountId || undefined;
        if (selectedAccountId) {
          finalDistributions = [{ accountId: selectedAccountId, amount: val }];
        }
      }

      const payload: Omit<IncomeItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'> = {
        name: name.trim(),
        amount: val,
        expectedDate: date,
        expectedDay: day,
        category: category.trim(),
        notes: notes.trim() || undefined,
        accountId: finalAccountId,
        accountDistributions: finalDistributions,
        recurrence,
        recurrenceMonthsCount,
        startMonth,
      };

      try {
        setIsSubmitting(true);
        if (editingTransaction && editingTransaction.type === 'income' && onUpdateIncome) {
          await onUpdateIncome(editingTransaction.id, payload);
        } else {
          if (editingTransaction && editingTransaction.type !== 'income') {
            if (editingTransaction.type === 'bill' && onDeleteBill) await onDeleteBill(editingTransaction.id);
            else if (editingTransaction.type === 'expense' && onDeleteExpense) await onDeleteExpense(editingTransaction.id);
          }
          await onSaveIncome(payload);
        }
        onClose();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Falha ao salvar receita.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }
  };

  const handleApplyRecurrenceEdit = async (scope: 'this' | 'this_and_future') => {
    if (!editingTransaction || !pendingBillPayload || !onUpdateBillOccurrence) return;
    const targetMonth = selectedMonth || pendingBillPayload.dueDate.substring(0, 7);
    try {
      setIsSubmitting(true);
      await onUpdateBillOccurrence(editingTransaction.id, targetMonth, pendingBillPayload, scope);
      setShowRecurrencePrompt(false);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar fatura parcelada.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const themeColor = type === 'income' ? 'emerald' : type === 'expense' ? 'amber' : 'rose';
  const themeBg = type === 'income' ? 'bg-emerald-600' : type === 'expense' ? 'bg-amber-600' : 'bg-rose-600';
  const themeBorder = type === 'income' ? 'border-emerald-500/30' : type === 'expense' ? 'border-amber-500/30' : 'border-rose-500/30';
  const themeShadow = type === 'income' ? 'shadow-emerald-600/20' : type === 'expense' ? 'shadow-amber-600/20' : 'shadow-rose-600/20';

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 glass-overlay overflow-hidden pt-safe pb-safe"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 30 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="glass-modal rounded-[2.5rem] shadow-2xl max-w-lg w-full max-h-[calc(100dvh-4rem)] flex flex-col overflow-hidden border border-white/90 relative"
          >
            {/* Dynamic Mesh Header */}
            <div className="relative p-8 shrink-0 overflow-hidden">
              <motion.div 
                layout
                className={`absolute inset-0 mesh-gradient opacity-20 transition-colors duration-700 ${
                  type === 'income' ? 'from-emerald-500/40' : type === 'expense' ? 'from-amber-500/40' : 'from-rose-500/40'
                }`} 
              />
              <div className="relative z-10 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-5">
                    <motion.div 
                      key={type}
                      initial={{ rotate: -15, scale: 0.8 }}
                      animate={{ rotate: 0, scale: 1 }}
                      className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center shadow-inner border transition-colors duration-500 ${
                        type === 'income' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 
                        type === 'expense' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 
                        'bg-rose-500/10 text-rose-600 border-rose-500/20'
                      }`}
                    >
                      {type === 'bill' && <Receipt className="w-8 h-8" />}
                      {type === 'income' && <TrendingUp className="w-8 h-8" />}
                      {type === 'expense' && <ShoppingBag className="w-8 h-8" />}
                    </motion.div>
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-tight tracking-tight">
                        {editingTransaction ? t.editTransactionTitle : t.newTransactionTitle}
                      </h3>
                      <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.3em] mt-1">
                        CENTRAL DE MOVIMENTAÇÕES
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-12 h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-all cursor-pointer flex items-center justify-center"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Segmented Switcher */}
                <div className="grid grid-cols-3 p-1.5 rounded-[1.25rem] bg-[#D1FAEB]/60 border border-emerald-500/20 relative overflow-hidden backdrop-blur-md">
                  <button
                    type="button"
                    onClick={() => handleTypeChange('bill')}
                    className={`py-3 px-2 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer relative z-10 ${
                      type === 'bill' ? 'text-white' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {type === 'bill' && (
                      <motion.div layoutId="tx-type-bg" className="absolute inset-0 bg-rose-600 rounded-xl shadow-lg shadow-rose-600/20" />
                    )}
                    <Receipt className="w-3.5 h-3.5 relative z-10" />
                    <span className="relative z-10">{t.txTypeBill}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTypeChange('expense')}
                    className={`py-3 px-2 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer relative z-10 ${
                      type === 'expense' ? 'text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {type === 'expense' && (
                      <motion.div layoutId="tx-type-bg" className="absolute inset-0 bg-amber-600 rounded-xl shadow-lg shadow-amber-600/20" />
                    )}
                    <ShoppingBag className="w-3.5 h-3.5 relative z-10" />
                    <span className="relative z-10">{t.txTypeExpense}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTypeChange('income')}
                    className={`py-3 px-2 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer relative z-10 ${
                      type === 'income' ? 'text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {type === 'income' && (
                      <motion.div layoutId="tx-type-bg" className="absolute inset-0 bg-emerald-600 rounded-xl shadow-lg shadow-emerald-600/20" />
                    )}
                    <TrendingUp className="w-3.5 h-3.5 relative z-10" />
                    <span className="relative z-10">{t.txTypeIncome}</span>
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} 
                animate={{ opacity: 1, y: 0 }}
                className="mx-8 mt-2 p-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-[11px] font-black uppercase tracking-widest flex items-center gap-3"
              >
                <AlertCircle className="w-5 h-5 shrink-0" />
                {error}
              </motion.div>
            )}

            {/* Recurrence Prompt Modal State for Bills */}
            {showRecurrencePrompt ? (
              <div className="p-8 space-y-8 overflow-y-auto overscroll-contain flex-1">
                <div className="flex items-start gap-5 p-6 rounded-[2.5rem] bg-amber-500/5 border border-amber-500/10 shadow-inner">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0 border border-amber-500/20 shadow-sm">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div className="space-y-2">
                    <div className="font-black text-base text-slate-900 dark:text-white tracking-tight uppercase">
                      {t.recurringEditPromptTitle}
                    </div>
                    <p className="text-[12px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed uppercase tracking-widest">
                      {t.recurringEditPromptSubtitle}
                    </p>
                    {selectedMonth && (
                      <div className="inline-block px-3 py-1 rounded-xl bg-amber-500/10 text-amber-600 text-[10px] font-black uppercase tracking-[0.2em] border border-amber-500/20">
                        REFERÊNCIA: {formatMonthName(selectedMonth)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <motion.button
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleApplyRecurrenceEdit('this')}
                    className="w-full p-6 rounded-[2.5rem] border transition-all text-left group bg-white/80 border-slate-200/80 hover:border-rose-500/30 hover:shadow-xl hover:shadow-rose-500/5"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-black text-sm text-slate-900 group-hover:text-rose-600 transition-colors uppercase tracking-tight">
                        {t.editOnlyThisOption}
                      </div>
                      <span className="text-[9px] px-3 py-1 rounded-xl bg-emerald-50 text-slate-600 font-black uppercase tracking-widest border border-emerald-100">
                        {t.oneMonthBadge}
                      </span>
                    </div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-tight">
                      {t.editOnlyThisDesc}
                    </p>
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleApplyRecurrenceEdit('this_and_future')}
                    className="w-full p-6 rounded-[2.5rem] border-2 border-rose-600/30 bg-rose-600/5 text-left group shadow-lg shadow-rose-600/10"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-black text-sm text-rose-600 uppercase tracking-tight">
                        {t.editThisAndFutureOption}
                      </div>
                      <span className="text-[9px] px-3 py-1 rounded-xl bg-rose-600 text-white font-black uppercase tracking-widest shadow-md shadow-rose-600/20">
                        {t.allNextBadge}
                      </span>
                    </div>
                    <p className="text-[11px] font-bold text-rose-600/60 uppercase tracking-widest leading-tight">
                      {t.editThisAndFutureDesc}
                    </p>
                  </motion.button>
                </div>

                <div className="pt-6 flex justify-center">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setShowRecurrencePrompt(false)}
                    className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    {t.cancelBtn}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-8 space-y-8 no-scrollbar">
                  {/* Identificação */}
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] ml-1">
                      {type === 'bill' ? t.billNameLabel : type === 'income' ? t.incomeNameLabel : t.expenseNameLabel}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={type === 'bill' ? t.billPlaceholder : type === 'income' ? t.incomePlaceholder : t.expensePlaceholder}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={`w-full px-6 py-5 text-sm font-black bg-white/80 border border-slate-200/80 rounded-[1.5rem] focus:outline-hidden focus:ring-2 transition-all placeholder:text-slate-400 text-slate-900 ${
                        type === 'income' ? 'focus:ring-emerald-500/30' : type === 'expense' ? 'focus:ring-amber-500/30' : 'focus:ring-rose-500/30'
                      }`}
                    />
                  </div>

                  {/* Valor & Data */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">
                        {t.amountLabel} ({CURRENCIES[currency]?.symbol || '$'})
                      </label>
                      <div className="relative group">
                        <input
                          type="number"
                          step="any"
                          required
                          placeholder="0.00"
                          value={amountStr}
                          onChange={(e) => setAmountStr(e.target.value.replace(/^0+(?=\d)/, ''))}
                          onFocus={(e) => e.target.select()}
                          className={`w-full px-6 py-5 text-sm font-mono-numbers font-black bg-white/80 border border-slate-200/80 rounded-[1.5rem] focus:outline-hidden focus:ring-2 transition-all text-slate-900 ${
                            type === 'income' ? 'focus:ring-emerald-500/30' : type === 'expense' ? 'focus:ring-amber-500/30' : 'focus:ring-rose-500/30'
                          }`}
                        />
                        {amountStr && !isNaN(parseFloat(amountStr)) && (
                          <div className={`absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border shadow-sm ${
                             type === 'income' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 
                             type === 'expense' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 
                             'bg-rose-500/10 text-rose-600 border-rose-500/20'
                          }`}>
                            {formatCurrency(parseFloat(amountStr), currency)}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1 flex items-center gap-2">
                        <Calendar className={`w-4 h-4 ${type === 'income' ? 'text-emerald-500' : type === 'expense' ? 'text-amber-500' : 'text-rose-500'}`} />
                        {type === 'bill' ? t.billDueDateLabel : type === 'income' ? t.expectedDateLabel : t.expenseDateLabel}
                      </label>
                      <input
                        type="date"
                        required
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className={`w-full px-6 py-5 text-sm font-black bg-white/80 border border-slate-200/80 rounded-[1.5rem] focus:outline-hidden focus:ring-2 transition-all appearance-none text-slate-900 ${
                           type === 'income' ? 'focus:ring-emerald-500/30' : type === 'expense' ? 'focus:ring-amber-500/30' : 'focus:ring-rose-500/30'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Categoria */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between ml-1">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
                        <Tag className={`w-4 h-4 ${type === 'income' ? 'text-emerald-500' : type === 'expense' ? 'text-amber-500' : 'text-rose-500'}`} />
                        {t.categoryLabel}
                      </label>
                      {!isCreatingCategory && onAddCategory && (
                        <button
                          type="button"
                          onClick={() => setIsCreatingCategory(true)}
                          className={`text-[10px] font-black flex items-center gap-1.5 cursor-pointer uppercase tracking-[0.2em] hover:scale-105 transition-transform px-3 py-1.5 rounded-xl border ${
                            type === 'income' ? 'text-emerald-600 bg-emerald-500/5 border-emerald-500/20' : 
                            type === 'expense' ? 'text-amber-600 bg-amber-500/5 border-amber-500/20' : 
                            'text-rose-600 bg-rose-500/5 border-rose-500/20'
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{t.inlineAddCategory}</span>
                        </button>
                      )}
                    </div>

                    {isCreatingCategory ? (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`p-6 rounded-[2rem] border space-y-5 shadow-inner ${
                           type === 'income' ? 'bg-emerald-500/5 border-emerald-500/20' : 
                           type === 'expense' ? 'bg-amber-500/5 border-amber-500/20' : 
                           'bg-rose-500/5 border-rose-500/20'
                        }`}
                      >
                        <div className={`text-[10px] font-black uppercase tracking-[0.3em] ${
                           type === 'income' ? 'text-emerald-600' : type === 'expense' ? 'text-amber-600' : 'text-rose-600'
                        }`}>CRIAR NOVA CATEGORIA</div>
                        <div className="flex items-center gap-3">
                          <input
                            type="text"
                            autoFocus
                            placeholder={t.categoryNamePlaceholder}
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            className="flex-1 px-5 py-4 text-xs font-black bg-white border border-slate-200 rounded-2xl text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 transition-all"
                          />
                          <button
                            type="button"
                            disabled={isSavingCategory || !newCategoryName.trim()}
                            onClick={handleCreateCategory}
                            className={`px-5 py-4 text-[10px] font-black text-white rounded-2xl disabled:opacity-50 cursor-pointer uppercase tracking-widest shadow-xl transition-all ${themeBg} ${themeShadow}`}
                          >
                            {isSavingCategory ? '...' : t.createAndUse}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsCreatingCategory(false);
                              setNewCategoryName('');
                            }}
                            className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center cursor-pointer hover:bg-slate-200 transition-colors"
                          >
                            <X className="w-6 h-6" />
                          </button>
                        </div>
                      </motion.div>
                    ) : (
                      <div className="relative group">
                        <select
                          required
                          value={category}
                          onChange={(e) => {
                            setCategory(e.target.value);
                            if (error) setError(null);
                          }}
                          className={`w-full px-6 py-5 text-sm font-black bg-white/80 border border-slate-200/80 rounded-[1.5rem] focus:outline-hidden focus:ring-2 text-slate-900 cursor-pointer transition-all appearance-none ${
                             type === 'income' ? 'focus:ring-emerald-500/30' : type === 'expense' ? 'focus:ring-amber-500/30' : 'focus:ring-rose-500/30'
                          } ${!category ? 'text-slate-400' : ''}`}
                        >
                          <option value="" disabled>
                            {t.selectCategoryPlaceholder || 'Selecionar categoria'}
                          </option>
                          {availableCategories.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                        <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                          <ChevronRight className="w-5 h-5 rotate-90" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Conta / Distribuição */}
                  <div className={`p-8 rounded-[2.5rem] border space-y-6 shadow-inner ${
                    type === 'income' ? 'bg-emerald-500/5 border-emerald-500/10' : 
                    type === 'expense' ? 'bg-amber-500/5 border-amber-500/10' : 
                    'bg-rose-500/5 border-rose-500/10'
                  }`}>
                    <div className="flex items-center justify-between ml-1">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] flex items-center gap-3">
                        <Landmark className="w-4 h-4" />
                        <span>
                          {type === 'expense' ? 'CONTA DE SAÍDA' : type === 'income' ? 'CONTA DE DESTINO' : 'CONTA DE PAGAMENTO'}
                        </span>
                      </label>
                      {onOpenNewAccount && (
                        <button
                          type="button"
                          onClick={onOpenNewAccount}
                          className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 cursor-pointer uppercase tracking-[0.2em] hover:scale-105 transition-transform"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>NOVA CONTA</span>
                        </button>
                      )}
                    </div>

                    {type === 'income' && activeAccounts.length > 0 && (
                      <div className="flex items-center gap-2 p-1 rounded-2xl bg-slate-100/70 border border-slate-200/50 backdrop-blur-sm">
                        <button
                          type="button"
                          onClick={() => setIncomeDistMode('single')}
                          className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer relative z-10 ${
                            incomeDistMode === 'single' ? 'text-white' : 'text-slate-500'
                          }`}
                        >
                          {incomeDistMode === 'single' && (
                             <motion.div layoutId="inc-dist-pill" className="absolute inset-0 bg-emerald-600 rounded-xl shadow-lg shadow-emerald-600/20" />
                          )}
                          <span className="relative z-10 flex items-center justify-center gap-2">
                             <Wallet className="w-3 h-3" /> ÚNICA CONTA
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIncomeDistMode('multi')}
                          className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer relative z-10 ${
                            incomeDistMode === 'multi' ? 'text-white' : 'text-slate-500'
                          }`}
                        >
                          {incomeDistMode === 'multi' && (
                             <motion.div layoutId="inc-dist-pill" className="absolute inset-0 bg-emerald-600 rounded-xl shadow-lg shadow-emerald-600/20" />
                          )}
                          <span className="relative z-10 flex items-center justify-center gap-2">
                             <Divide className="w-3 h-3" /> DISTRIBUIR
                          </span>
                        </button>
                      </div>
                    )}

                    <AnimatePresence mode="wait">
                      {incomeDistMode === 'single' || type !== 'income' ? (
                        <motion.div
                          key="single-acc"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          className="relative group"
                        >
                          <select
                            value={selectedAccountId}
                            onChange={(e) => setSelectedAccountId(e.target.value)}
                            className={`w-full px-6 py-5 text-sm font-black bg-white/80 border border-slate-200/80 rounded-[1.5rem] focus:outline-hidden text-slate-900 cursor-pointer transition-all appearance-none ${
                               type === 'income' ? 'focus:ring-2 focus:ring-emerald-500/30' : type === 'expense' ? 'focus:ring-2 focus:ring-amber-500/30' : 'focus:ring-2 focus:ring-rose-500/30'
                            }`}
                          >
                            <option value="">Nenhuma conta</option>
                            {activeAccounts.map((acc) => (
                              <option key={acc.id} value={acc.id}>
                                {ACCOUNT_TYPE_CONFIG[acc.type]?.emoji} {acc.name} ({formatCurrency(acc.currentBalance || 0, acc.currency)})
                              </option>
                            ))}
                          </select>
                          <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                             <ChevronRight className="w-5 h-5 rotate-90" />
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="multi-acc"
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          className="space-y-4"
                        >
                          <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center justify-between px-2">
                             <span>DISTRIBUIR VALOR TOTAL</span>
                             <span className="bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20 font-mono-numbers">
                               {formatCurrency(parseFloat(amountStr) || 0, currency)}
                             </span>
                          </div>
                          <div className="grid grid-cols-1 gap-3 max-h-60 overflow-y-auto pr-1 no-scrollbar">
                            {activeAccounts.map((acc) => {
                               const distVal = incomeDistributions[acc.id] || '';
                               return (
                                 <div key={acc.id} className="flex items-center gap-4 p-4 rounded-2xl bg-white/80 border border-slate-200/80 transition-all hover:border-emerald-500/30">
                                   <div className="flex-1 shrink-0">
                                     <div className="text-[11px] font-black text-slate-900 uppercase truncate">{acc.name}</div>
                                     <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">{ACCOUNT_TYPE_CONFIG[acc.type].label[language]}</div>
                                   </div>
                                   <div className="relative w-32">
                                     <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-emerald-600">
                                       {CURRENCIES[acc.currency]?.symbol || '$'}
                                     </span>
                                     <input
                                       type="text"
                                       inputMode="decimal"
                                       placeholder="0.00"
                                       value={distVal}
                                       onChange={(e) => {
                                         setIncomeDistributions(prev => ({
                                           ...prev,
                                           [acc.id]: e.target.value
                                         }));
                                       }}
                                       className="w-full pl-8 pr-4 py-2.5 text-xs font-mono-numbers font-black bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-emerald-500/50 text-slate-900"
                                     />
                                   </div>
                                 </div>
                               );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Recorrência (Only for Bills and Income) */}
                  {(type === 'bill' || type === 'income') && (
                    <div className="p-8 rounded-[2.5rem] bg-indigo-500/5 border border-indigo-500/20 space-y-6 shadow-inner">
                      <label className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em] flex items-center gap-3 ml-1">
                        <Repeat className="w-4 h-4" />
                        {t.recurrenceLabel}
                      </label>

                      <div className="grid grid-cols-2 gap-4">
                        <button
                          type="button"
                          onClick={() => setRecurrence('monthly')}
                          className={`p-5 rounded-2xl border transition-all text-left group relative overflow-hidden ${
                            recurrence === 'monthly'
                              ? 'border-indigo-600 bg-indigo-600 text-white shadow-xl shadow-indigo-600/20'
                              : 'border-slate-200 bg-white/80 text-slate-600'
                          }`}
                        >
                          <div className="text-[12px] font-black uppercase tracking-tight relative z-10">{t.recurrenceMonthly}</div>
                          <div className={`text-[9px] font-bold uppercase tracking-[0.2em] mt-1 relative z-10 ${recurrence === 'monthly' ? 'text-white/70' : 'text-slate-400'}`}>REPETE MENSALMENTE</div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setRecurrence('none')}
                          className={`p-5 rounded-2xl border transition-all text-left group relative overflow-hidden ${
                            recurrence === 'none'
                              ? 'border-indigo-600 bg-indigo-600 text-white shadow-xl shadow-indigo-600/20'
                              : 'border-slate-200 bg-white/80 text-slate-600'
                          }`}
                        >
                          <div className="text-[12px] font-black uppercase tracking-tight relative z-10">{t.recurrenceNone}</div>
                          <div className={`text-[9px] font-bold uppercase tracking-[0.2em] mt-1 relative z-10 ${recurrence === 'none' ? 'text-white/70' : 'text-slate-400'}`}>ÚNICA VEZ</div>
                        </button>
                      </div>

                      <AnimatePresence>
                        {recurrence === 'monthly' && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="pt-6 border-t border-indigo-500/10 space-y-6 overflow-hidden"
                          >
                            <div className="flex items-center gap-8">
                              <label className="flex items-center gap-3 cursor-pointer group">
                                <div className={`w-6 h-6 rounded-xl border-2 flex items-center justify-center transition-all ${recurrenceMode === 'forever' ? 'border-indigo-600 bg-indigo-600/10' : 'border-slate-300 dark:border-slate-700'}`}>
                                  {recurrenceMode === 'forever' && <div className="w-3 h-3 rounded-lg bg-indigo-600 shadow-sm" />}
                                </div>
                                <input type="radio" className="hidden" checked={recurrenceMode === 'forever'} onChange={() => setRecurrenceMode('forever')} />
                                <span className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-[0.2em] group-hover:text-indigo-600 transition-colors">{t.repeatForever}</span>
                              </label>

                              <label className="flex items-center gap-3 cursor-pointer group">
                                <div className={`w-6 h-6 rounded-xl border-2 flex items-center justify-center transition-all ${recurrenceMode === 'limited' ? 'border-indigo-600 bg-indigo-600/10' : 'border-slate-300 dark:border-slate-700'}`}>
                                  {recurrenceMode === 'limited' && <div className="w-3 h-3 rounded-lg bg-indigo-600 shadow-sm" />}
                                </div>
                                <input type="radio" className="hidden" checked={recurrenceMode === 'limited'} onChange={() => setRecurrenceMode('limited')} />
                                <span className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-[0.2em] group-hover:text-indigo-600 transition-colors">{t.endAfterMonths}</span>
                              </label>
                            </div>

                            {recurrenceMode === 'limited' && (
                              <div className="flex items-center gap-4 pt-2">
                                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">{t.monthsQty}:</span>
                                <div className="relative">
                                  <input
                                    type="number"
                                    min={1}
                                    value={monthsCountStr}
                                    onChange={(e) => setMonthsCountStr(e.target.value)}
                                    className="w-24 px-4 py-3 text-sm font-black text-center bg-white border border-indigo-500/30 rounded-2xl focus:outline-hidden text-slate-900 font-mono-numbers"
                                  />
                                </div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">meses</span>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Observações */}
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-slate-400" />
                      {t.notesLabel}
                    </label>
                    <textarea
                      placeholder="Ex: Chave Pix, código de barras, parcelamento..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full px-6 py-5 text-sm font-bold bg-white/80 border border-slate-200/80 rounded-[1.5rem] focus:outline-hidden text-slate-900 min-h-32 resize-none transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* Fixed Bottom Action Bar */}
                <div className="shrink-0 p-8 border-t border-slate-200/60 bg-white/80 backdrop-blur-2xl flex items-center justify-between gap-6 z-10">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-4 text-[10px] font-black text-slate-400 hover:text-slate-900 dark:hover:text-white uppercase tracking-[0.4em] transition-colors cursor-pointer"
                  >
                    {t.cancelBtn}
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.02, x: 5 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={isSubmitting}
                    className={`px-10 py-5 text-[11px] font-black text-white rounded-2xl shadow-2xl disabled:opacity-50 uppercase tracking-[0.3em] cursor-pointer flex items-center gap-3 active:scale-95 transition-all ${themeBg} ${themeShadow}`}
                  >
                    <Check className="w-5 h-5" />
                    <span>{isSubmitting ? 'SALVANDO...' : t.saveBtn}</span>
                  </motion.button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
