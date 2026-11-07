/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ExpenseItem, CurrencyCode, LanguageCode } from '../types';
import { getTodayStr } from '../utils/finance';
import { formatCurrency, CURRENCIES } from '../utils/currency';
import { getTranslations } from '../utils/i18n';
import { X, ShoppingBag, Check, Calendar, Tag, Plus } from 'lucide-react';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  currency: CurrencyCode;
  language?: LanguageCode;
  editingExpense?: ExpenseItem | null;
  categories: string[];
  onAddCategory?: (name: string, scope: 'bill' | 'income' | 'expense' | 'all') => Promise<unknown>;
  onSave: (data: Omit<ExpenseItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdate?: (id: string, partial: Partial<ExpenseItem>) => Promise<void>;
}

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  isOpen,
  onClose,
  currency,
  language = 'pt',
  editingExpense,
  categories,
  onAddCategory,
  onSave,
  onUpdate,
}) => {
  const t = getTranslations(language);

  const [name, setName] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [date, setDate] = useState(getTodayStr());
  const [category, setCategory] = useState<string>(categories[0] || 'Geral');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quick inline category creation
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  useEffect(() => {
    if (editingExpense) {
      setName(editingExpense.name);
      setAmountStr(String(editingExpense.amount));
      setDate(editingExpense.date);
      setCategory(editingExpense.category || categories[0] || 'Geral');
      setNotes(editingExpense.notes || '');
    } else {
      setName('');
      setAmountStr('');
      setDate(getTodayStr());
      setCategory(categories[0] || 'Geral');
      setNotes('');
      setError(null);
    }
    setIsCreatingCategory(false);
    setNewCategoryName('');
  }, [editingExpense, isOpen, categories]);

  if (!isOpen) return null;

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim() || !onAddCategory) return;
    try {
      setIsSavingCategory(true);
      await onAddCategory(newCategoryName.trim(), 'expense');
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
      setError(t.nameLabel + ' é obrigatório.');
      return;
    }
    if (isNaN(val) || val <= 0) {
      setError('Por favor, informe um valor válido maior que zero.');
      return;
    }
    if (!date) {
      setError('Por favor, selecione a data do gasto.');
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingExpense && onUpdate) {
        await onUpdate(editingExpense.id, {
          name: name.trim(),
          amount: val,
          date,
          category,
          notes: notes.trim() || undefined,
        });
      } else {
        await onSave({
          name: name.trim(),
          amount: val,
          date,
          category,
          notes: notes.trim() || undefined,
        });
      }
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar despesa.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 glass-overlay animate-in fade-in duration-150 overflow-hidden overscroll-contain"
    >
      <div className="glass-modal rounded-3xl max-w-lg w-full max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2.5rem)] flex flex-col overflow-hidden">
        {/* Header (pinned) */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200/60 shrink-0 bg-white/80 backdrop-blur-xl z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingExpense ? t.editExpenseModalTitle : t.newExpenseModalTitle}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Restaurante, compras, imprevistos do dia a dia
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 text-xs">
            {error}
          </div>
        )}

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Scrollable Form Body */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4">
            {/* Nome */}
            <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">
              {t.nameLabel} *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Almoço restaurante, Supermercado, Farmácia..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 text-sm bg-white/80 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900"
            />
          </div>

          {/* Valor & Data */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                {t.amountLabel} ({CURRENCIES[currency]?.symbol || '$'} {currency}) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="0.00"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  className="w-full px-4 py-3 text-sm font-semibold bg-white/80 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900"
                />
              </div>
              {amountStr && !isNaN(parseFloat(amountStr)) && (
                <p className="text-[10px] text-slate-500">
                  {formatCurrency(parseFloat(amountStr), currency)}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {t.expenseDateLabel} *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-3 text-sm bg-white/80 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900"
              />
            </div>
          </div>

          {/* Categoria com Quick Add */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-slate-400" />
                {t.categoryLabel}
              </label>
              {!isCreatingCategory && onAddCategory && (
                <button
                  type="button"
                  onClick={() => setIsCreatingCategory(true)}
                  className="text-[11px] font-bold text-amber-600 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>{t.inlineAddCategory}</span>
                </button>
              )}
            </div>

            {isCreatingCategory ? (
              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2">
                <div className="text-[11px] font-semibold text-slate-700">
                  Criar nova categoria para despesas:
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Ex: Cafeteria, Presentes, Lazer..."
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    disabled={isSavingCategory || !newCategoryName.trim()}
                    onClick={handleCreateCategory}
                    className="px-3 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-lg disabled:opacity-50 cursor-pointer"
                  >
                    {isSavingCategory ? '...' : t.createAndUse}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingCategory(false);
                      setNewCategoryName('');
                    }}
                    className="px-2 py-2 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ) : (
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-3 text-sm bg-white/80 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 cursor-pointer"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">
              {t.notesLabel}
            </label>
            <input
              type="text"
              placeholder="Ex: Restaurante com amigos, compra parcelada, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2.5 text-xs bg-white/80 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900"
            />
          </div>

            </div>

            {/* Fixed Bottom Action Bar (pinned) */}
            <div className="shrink-0 p-3 sm:p-4 border-t border-slate-200/60 bg-white/80 backdrop-blur-xl flex items-center justify-end gap-3 z-10">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                {t.cancelBtn}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 active:scale-98 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{isSubmitting ? '...' : t.saveBtn}</span>
              </button>
            </div>
          </form>
        </div>
    </div>
  );
};
