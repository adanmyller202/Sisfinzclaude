/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { IncomeItem, CurrencyCode, RecurrenceType, LanguageCode } from '../types';
import { getTodayStr } from '../utils/finance';
import { formatCurrency, CURRENCIES } from '../utils/currency';
import { getTranslations } from '../utils/i18n';
import { X, TrendingUp, Check, Calendar, Repeat, Tag, Plus } from 'lucide-react';

interface IncomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currency: CurrencyCode;
  language?: LanguageCode;
  editingIncome?: IncomeItem | null;
  categories: string[];
  onAddCategory?: (name: string, scope: 'bill' | 'income' | 'expense' | 'all') => Promise<unknown>;
  onSave: (data: Omit<IncomeItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdate?: (id: string, partial: Partial<IncomeItem>) => Promise<void>;
}

export const IncomeModal: React.FC<IncomeModalProps> = ({
  isOpen,
  onClose,
  currency,
  language = 'pt',
  editingIncome,
  categories,
  onAddCategory,
  onSave,
  onUpdate,
}) => {
  const t = getTranslations(language);

  const [name, setName] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [expectedDate, setExpectedDate] = useState(getTodayStr());
  const [category, setCategory] = useState<string>(categories[0] || 'Geral');
  const [notes, setNotes] = useState('');
  const [recurrence, setRecurrence] = useState<RecurrenceType>('monthly');
  const [recurrenceMode, setRecurrenceMode] = useState<'forever' | 'limited'>('forever');
  const [monthsCount, setMonthsCount] = useState<number>(12);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quick inline category creation
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  useEffect(() => {
    if (editingIncome) {
      setName(editingIncome.name);
      setAmountStr(String(editingIncome.amount));
      setExpectedDate(editingIncome.expectedDate);
      setCategory(editingIncome.category || categories[0] || 'Geral');
      setNotes(editingIncome.notes || '');
      setRecurrence(editingIncome.recurrence);
      if (editingIncome.recurrenceMonthsCount && editingIncome.recurrenceMonthsCount > 0) {
        setRecurrenceMode('limited');
        setMonthsCount(editingIncome.recurrenceMonthsCount);
      } else {
        setRecurrenceMode('forever');
      }
    } else {
      setName('');
      setAmountStr('');
      setExpectedDate(getTodayStr());
      setCategory(categories[0] || 'Geral');
      setNotes('');
      setRecurrence('monthly');
      setRecurrenceMode('forever');
      setMonthsCount(12);
      setError(null);
    }
    setIsCreatingCategory(false);
    setNewCategoryName('');
  }, [editingIncome, isOpen, categories]);

  if (!isOpen) return null;

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim() || !onAddCategory) return;
    try {
      setIsSavingCategory(true);
      await onAddCategory(newCategoryName.trim(), 'income');
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
    if (!expectedDate) {
      setError('Por favor, selecione a data prevista de recebimento.');
      return;
    }

    const expectedDay = expectedDate ? parseInt(expectedDate.split('-')[2], 10) || 1 : 1;
    const startMonth = expectedDate.substring(0, 7);
    const recurrenceMonthsCount =
      recurrence === 'monthly' && recurrenceMode === 'limited' ? Number(monthsCount) : 0;

    try {
      setIsSubmitting(true);
      if (editingIncome && onUpdate) {
        await onUpdate(editingIncome.id, {
          name: name.trim(),
          amount: val,
          expectedDate,
          expectedDay,
          category,
          notes: notes.trim() || undefined,
          recurrence,
          recurrenceMonthsCount,
          startMonth,
        });
      } else {
        await onSave({
          name: name.trim(),
          amount: val,
          expectedDate,
          expectedDay,
          category,
          notes: notes.trim() || undefined,
          recurrence,
          recurrenceMonthsCount,
          startMonth,
        });
      }
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar a receita.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[10010] flex items-center justify-center p-2.5 sm:p-4 glass-overlay overflow-hidden overscroll-contain"
    >
      <div className="glass-modal rounded-3xl max-w-lg w-full max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2.5rem)] flex flex-col overflow-hidden">
        {/* Header (pinned) */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200/60 shrink-0 bg-white/40 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingIncome ? t.editIncomeModalTitle : t.newIncomeModalTitle}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Salário, Freelance, Rendimentos, Bônus, etc.
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
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {t.nameLabel} *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Salário da empresa, Projeto Freelance, Venda..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 text-sm bg-white/80 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
            />
          </div>

          {/* Valor & Data Prevista */}
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
                  className="w-full px-4 py-3 text-sm font-semibold bg-white/80 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
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
                {t.expectedDateLabel} *
              </label>
              <input
                type="date"
                required
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                className="w-full px-4 py-3 text-sm bg-white/80 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
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
                  className="text-[11px] font-bold text-emerald-600 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>{t.inlineAddCategory}</span>
                </button>
              )}
            </div>

            {isCreatingCategory ? (
              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2">
                <div className="text-[11px] font-semibold text-slate-700">
                  Criar nova categoria para receitas:
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Ex: Dividendos, Aluguel Recebido..."
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    disabled={isSavingCategory || !newCategoryName.trim()}
                    onClick={handleCreateCategory}
                    className="px-3 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg disabled:opacity-50 cursor-pointer"
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
                className="w-full px-4 py-3 text-sm bg-white/80 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 cursor-pointer"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Recorrência */}
          <div className="p-4 rounded-2xl bg-white/80 border border-slate-200/80 space-y-3">
            <div className="flex items-center gap-2">
              <Repeat className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-bold text-slate-900">
                {t.recurrenceLabel}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRecurrence('monthly')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  recurrence === 'monthly'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold ring-1 ring-emerald-500'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                <div className="text-xs font-bold">{t.recurrenceMonthly}</div>
                <div className="text-[10px] text-slate-500">Repete todo mês (Salário, etc.)</div>
              </button>

              <button
                type="button"
                onClick={() => setRecurrence('none')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  recurrence === 'none'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold ring-1 ring-emerald-500'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                <div className="text-xs font-bold">{t.recurrenceNone}</div>
                <div className="text-[10px] text-slate-500">Apenas neste recebimento</div>
              </button>
            </div>

            {/* Opções de Recorrência Mensal */}
            {recurrence === 'monthly' && (
              <div className="pt-2 border-t border-slate-200/60 space-y-2.5">
                <div className="flex items-center gap-4 text-xs font-semibold text-slate-700">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="incomeRecurrenceMode"
                      value="forever"
                      checked={recurrenceMode === 'forever'}
                      onChange={() => setRecurrenceMode('forever')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>{t.repeatForever}</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="incomeRecurrenceMode"
                      value="limited"
                      checked={recurrenceMode === 'limited'}
                      onChange={() => setRecurrenceMode('limited')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>{t.endAfterMonths}</span>
                  </label>
                </div>

                {recurrenceMode === 'limited' && (
                  <div className="flex items-center gap-3 pt-1">
                    <label className="text-xs text-slate-500">
                      {t.monthsQty}:
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={monthsCount}
                      onChange={(e) => setMonthsCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-24 px-3 py-1.5 text-xs font-bold text-center bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
                    />
                    <span className="text-xs text-slate-500">meses</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">
              {t.notesLabel}
            </label>
            <input
              type="text"
              placeholder="Ex: Pagador, conta de depósito, detalhes adicionais..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2.5 text-xs bg-white/80 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
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
                className="px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-98 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{isSubmitting ? '...' : t.saveBtn}</span>
              </button>
            </div>
          </form>
        </div>
    </div>,
    document.body
  );
};
