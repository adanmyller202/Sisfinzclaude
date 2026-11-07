/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BillItem, CurrencyCode, RecurrenceType, LanguageCode } from '../types';
import { getTodayStr, formatMonthName } from '../utils/finance';
import { formatCurrency, CURRENCIES } from '../utils/currency';
import { getTranslations } from '../utils/i18n';
import { X, Receipt, Check, Calendar, Repeat, Tag, Plus, AlertCircle, MessageSquare } from 'lucide-react';

interface BillModalProps {
  isOpen: boolean;
  onClose: () => void;
  currency: CurrencyCode;
  language?: LanguageCode;
  selectedMonth?: string;
  editingBill?: BillItem | null;
  categories: string[];
  onAddCategory?: (name: string, scope: 'bill' | 'income' | 'expense' | 'all') => Promise<unknown>;
  onSave: (data: Omit<BillItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdate?: (id: string, partial: Partial<BillItem>) => Promise<void>;
  onUpdateOccurrence?: (
    id: string,
    targetMonth: string,
    partial: Partial<BillItem>,
    scope: 'this' | 'this_and_future'
  ) => Promise<void>;
}

export const BillModal: React.FC<BillModalProps> = ({
  isOpen,
  onClose,
  currency,
  language = 'pt',
  selectedMonth,
  editingBill,
  categories,
  onAddCategory,
  onSave,
  onUpdate,
  onUpdateOccurrence,
}) => {
  const t = getTranslations(language);

  const [name, setName] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [dueDate, setDueDate] = useState(getTodayStr());
  const [category, setCategory] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [recurrence, setRecurrence] = useState<RecurrenceType>('none');
  const [recurrenceMode, setRecurrenceMode] = useState<'forever' | 'limited'>('forever');
  const [monthsCount, setMonthsCount] = useState<number>(6);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quick inline category creation
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  // Prompt for recurring installment edits
  const [showRecurrencePrompt, setShowRecurrencePrompt] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<{
    name: string;
    amount: number;
    dueDate: string;
    dueDay: number;
    category: string;
    notes?: string;
    recurrence: RecurrenceType;
    recurrenceMonthsCount: number;
    startMonth: string;
  } | null>(null);

  const prevIsOpenRef = React.useRef(isOpen);
  const prevEditingIdRef = React.useRef<string | null>(null);

  useEffect(() => {
    const isOpening = isOpen && !prevIsOpenRef.current;
    const currentEditId = editingBill ? editingBill.id : null;
    const isEditTargetChanged = currentEditId !== prevEditingIdRef.current;

    prevIsOpenRef.current = isOpen;
    prevEditingIdRef.current = currentEditId;

    if (!isOpen) return;

    if (isOpening || isEditTargetChanged) {
      if (editingBill) {
        setName(editingBill.name);
        setAmountStr(String(editingBill.amount));
        setDueDate(editingBill.dueDate);
        setCategory(editingBill.category || '');
        setNotes(editingBill.notes || '');
        setRecurrence(editingBill.recurrence);
        if (editingBill.recurrenceMonthsCount && editingBill.recurrenceMonthsCount > 0) {
          setRecurrenceMode('limited');
          setMonthsCount(editingBill.recurrenceMonthsCount);
        } else {
          setRecurrenceMode('forever');
        }
      } else {
        setName('');
        setAmountStr('');
        setDueDate(getTodayStr());
        setCategory('');
        setNotes('');
        setRecurrence('none');
        setRecurrenceMode('forever');
        setMonthsCount(6);
        setError(null);
      }
      setIsCreatingCategory(false);
      setNewCategoryName('');
      setShowRecurrencePrompt(false);
      setPendingPayload(null);
    }
  }, [editingBill, isOpen]);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim() || !onAddCategory) return;
    try {
      setIsSavingCategory(true);
      await onAddCategory(newCategoryName.trim(), 'bill');
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
          ? 'Por favor, ingresa un valor válido maior que cero.'
          : language === 'pt'
          ? 'Por favor, informe um valor válido maior que zero.'
          : 'Please enter a valid amount greater than zero.'
      );
      return;
    }
    if (!dueDate) {
      setError(
        language === 'es'
          ? 'Por favor, selecciona la fecha de vencimiento.'
          : language === 'pt'
          ? 'Por favor, selecione a data de vencimento.'
          : 'Please select the due date.'
      );
      return;
    }
    if (!category || !category.trim() || category === 'Selecionar categoria' || category === 'Seleccionar categoría' || category === 'Select category') {
      setError(
        t.selectCategoryRequiredError ||
          (language === 'es'
            ? 'Por favor, seleccione una categoría. Este campo es obligatorio.'
            : language === 'pt'
            ? 'Por favor, selecione uma categoria. Este campo é obrigatório.'
            : 'Please select a category. This field is required.')
      );
      return;
    }

    const dueDay = dueDate ? parseInt(dueDate.split('-')[2], 10) || 1 : 1;
    const startMonth = dueDate.substring(0, 7);
    const recurrenceMonthsCount =
      recurrence === 'monthly' && recurrenceMode === 'limited' ? Number(monthsCount) : 0;

    const payload = {
      name: name.trim(),
      amount: val,
      dueDate,
      dueDay,
      category: category.trim(),
      notes: notes.trim() || undefined,
      recurrence,
      recurrenceMonthsCount,
      startMonth,
    };

    // If editing an existing recurring bill, ask user how to apply the changes
    if (editingBill && editingBill.recurrence === 'monthly' && onUpdateOccurrence) {
      setPendingPayload(payload);
      setShowRecurrencePrompt(true);
      return;
    }

    // Standard save / update for non-recurring or new bill
    try {
      setIsSubmitting(true);
      if (editingBill && onUpdate) {
        await onUpdate(editingBill.id, payload);
      } else {
        await onSave(payload);
      }
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar a fatura.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApplyRecurrenceEdit = async (scope: 'this' | 'this_and_future') => {
    if (!editingBill || !pendingPayload || !onUpdateOccurrence) return;
    const targetMonth = selectedMonth || editingBill.dueDate.substring(0, 7);
    try {
      setIsSubmitting(true);
      await onUpdateOccurrence(editingBill.id, targetMonth, pendingPayload, scope);
      setShowRecurrencePrompt(false);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar fatura parcelada.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="glass-overlay p-4 overflow-hidden pt-safe pb-safe"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 30 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="glass-modal rounded-[2.5rem] max-w-lg w-full max-h-[calc(100dvh-4rem)] flex flex-col overflow-hidden relative"
          >
            {/* Header with Mesh Gradient */}
            <div className="relative p-8 shrink-0 overflow-hidden">
              <div className="absolute inset-0 mesh-gradient opacity-20" />
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-5">
                  <motion.div 
                    initial={{ rotate: -10, scale: 0.8 }}
                    animate={{ rotate: 0, scale: 1 }}
                    className="w-16 h-16 rounded-[1.5rem] bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shadow-inner border border-rose-500/20"
                  >
                    <Receipt className="w-8 h-8" />
                  </motion.div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-tight tracking-tight">
                      {editingBill ? t.editBillModalTitle : t.newBillModalTitle}
                    </h3>
                    <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.3em] mt-1">
                      GASTOS FIXOS E VARIÁVEIS
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
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} 
                animate={{ opacity: 1, y: 0 }}
                className="mx-8 mt-2 p-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-[11px] font-black uppercase tracking-widest flex items-center gap-3"
              >
                <AlertCircle className="w-5 h-5 shrink-0" />
                {error}
              </motion.div>
            )}

            {/* Recurrence Prompt Modal State */}
            {showRecurrencePrompt ? (
              <div className="p-8 space-y-8 overflow-y-auto overscroll-contain flex-1">
                <div className="flex items-start gap-5 p-6 rounded-[2.5rem] bg-amber-500/5 border border-amber-500/10 shadow-inner">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0 border border-amber-500/20 shadow-sm">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div className="space-y-2">
                    <div className="font-black text-base text-slate-900 tracking-tight uppercase">
                      {t.recurringEditPromptTitle}
                    </div>
                    <p className="text-[12px] font-bold text-slate-500 leading-relaxed uppercase tracking-widest">
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
                        AVULSO
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
                        CASCATA
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
                  {/* Nome */}
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] ml-1">
                      {t.nameLabel}
                    </label>
                    <div className="relative group">
                      <input
                        type="text"
                        required
                        placeholder="Ex: Aluguel, Academia, Internet..."
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-6 py-5 text-sm font-black bg-white/80 border border-slate-200/80 rounded-[1.5rem] focus:outline-hidden focus:ring-2 focus:ring-rose-500/30 text-slate-900 transition-all placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  {/* Valor & Vencimento */}
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
                          onChange={(e) => setAmountStr(e.target.value)}
                          className="w-full px-6 py-5 text-sm font-mono-numbers font-black bg-white/80 border border-slate-200/80 rounded-[1.5rem] focus:outline-hidden focus:ring-2 focus:ring-rose-500/30 text-slate-900 transition-all"
                        />
                        {amountStr && !isNaN(parseFloat(amountStr)) && (
                          <div className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-600 uppercase tracking-widest bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100 shadow-xs">
                            {formatCurrency(parseFloat(amountStr), currency)}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-rose-500" />
                        {t.dueDateLabel}
                      </label>
                      <input
                        type="date"
                        required
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full px-6 py-5 text-sm font-black bg-white/80 border border-slate-200/80 rounded-[1.5rem] focus:outline-hidden focus:ring-2 focus:ring-rose-500/30 text-slate-900 transition-all appearance-none"
                      />
                    </div>
                  </div>

                  {/* Categoria */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between ml-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
                        <Tag className="w-4 h-4 text-rose-500" />
                        {t.categoryLabel}
                      </label>
                      {!isCreatingCategory && onAddCategory && (
                        <button
                          type="button"
                          onClick={() => setIsCreatingCategory(true)}
                          className="text-[10px] font-black text-rose-600 flex items-center gap-1.5 cursor-pointer uppercase tracking-[0.2em] hover:scale-105 transition-transform bg-rose-500/5 px-3 py-1.5 rounded-xl border border-rose-500/20"
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
                        className="p-6 rounded-[2rem] bg-rose-500/5 border border-rose-500/20 space-y-5 shadow-inner"
                      >
                        <div className="text-[10px] font-black text-rose-600 uppercase tracking-[0.3em]">CRIAR NOVA CATEGORIA</div>
                        <div className="flex items-center gap-3">
                          <input
                            type="text"
                            autoFocus
                            placeholder="Ex: Assinaturas, Stream..."
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            className="flex-1 px-5 py-4 text-xs font-black bg-white border border-slate-200 rounded-2xl text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-rose-500/30 transition-all"
                          />
                          <button
                            type="button"
                            disabled={isSavingCategory || !newCategoryName.trim()}
                            onClick={handleCreateCategory}
                            className="px-5 py-4 text-[10px] font-black text-white bg-rose-600 rounded-2xl disabled:opacity-50 cursor-pointer uppercase tracking-widest shadow-xl shadow-rose-600/20 hover:bg-rose-500 transition-all"
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
                          className={`w-full px-6 py-5 text-sm font-black bg-white/80 border border-slate-200/80 rounded-[1.5rem] focus:outline-hidden focus:ring-2 focus:ring-rose-500/30 text-slate-900 cursor-pointer transition-all appearance-none ${
                            !category ? 'text-slate-400' : ''
                          }`}
                        >
                          <option value="" disabled>{t.selectCategoryPlaceholder || 'Selecionar categoria'}</option>
                          {categories.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                        <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                           <Repeat className="w-4 h-4 rotate-90" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Recorrência */}
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
                        <div className={`text-[9px] font-bold uppercase tracking-[0.2em] mt-1 relative z-10 ${recurrence === 'none' ? 'text-white/70' : 'text-slate-400'}`}>FATURA ÚNICA</div>
                      </button>
                    </div>

                    <AnimatePresence>
                      {recurrence === 'monthly' && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="pt-6 border-t border-indigo-500/10 space-y-5 overflow-hidden"
                        >
                          <div className="flex items-center gap-8">
                            <label className="flex items-center gap-3 cursor-pointer group">
                              <div className={`w-6 h-6 rounded-xl border-2 flex items-center justify-center transition-all ${recurrenceMode === 'forever' ? 'border-indigo-600 bg-indigo-600/10' : 'border-slate-300'}`}>
                                {recurrenceMode === 'forever' && <div className="w-3 h-3 rounded-lg bg-indigo-600 shadow-sm" />}
                              </div>
                              <input type="radio" className="hidden" checked={recurrenceMode === 'forever'} onChange={() => setRecurrenceMode('forever')} />
                              <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] group-hover:text-indigo-600 transition-colors">{t.repeatForever}</span>
                            </label>

                            <label className="flex items-center gap-3 cursor-pointer group">
                              <div className={`w-6 h-6 rounded-xl border-2 flex items-center justify-center transition-all ${recurrenceMode === 'limited' ? 'border-indigo-600 bg-indigo-600/10' : 'border-slate-300'}`}>
                                {recurrenceMode === 'limited' && <div className="w-3 h-3 rounded-lg bg-indigo-600 shadow-sm" />}
                              </div>
                              <input type="radio" className="hidden" checked={recurrenceMode === 'limited'} onChange={() => setRecurrenceMode('limited')} />
                              <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] group-hover:text-indigo-600 transition-colors">{t.endAfterMonths}</span>
                            </label>
                          </div>

                          {recurrenceMode === 'limited' && (
                            <div className="flex items-center gap-4 pt-2">
                              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">{t.monthsQty}:</span>
                              <div className="relative">
                                <input
                                  type="number"
                                  min={1}
                                  value={monthsCount}
                                  onChange={(e) => setMonthsCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
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
                      className="w-full px-6 py-5 text-sm font-bold bg-white/80 border border-slate-200/80 rounded-[1.5rem] focus:outline-hidden focus:ring-2 focus:ring-slate-900/5 text-slate-900 min-h-32 resize-none transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* Fixed Bottom Action Bar */}
                <div className="shrink-0 p-8 border-t border-slate-200/60 bg-white/80 backdrop-blur-2xl flex items-center justify-between gap-6 z-10">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-4 text-[10px] font-black text-slate-400 hover:text-slate-900 uppercase tracking-[0.4em] transition-colors cursor-pointer"
                  >
                    {t.cancelBtn}
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.02, x: 5 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={isSubmitting}
                    className="px-10 py-5 text-[11px] font-black text-white bg-rose-600 rounded-2xl shadow-2xl shadow-rose-600/20 disabled:opacity-50 uppercase tracking-[0.3em] cursor-pointer flex items-center gap-3 active:scale-95 transition-all"
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
