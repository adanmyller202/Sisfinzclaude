/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  CurrencyCode,
  LanguageCode,
  SharedBill,
  SharedUserSummary,
  SplitMethod,
  CategoryScope,
} from '../../types';
import { getTodayStr } from '../../utils/finance';
import { formatCurrency } from '../../utils/currency';
import { getTranslations } from '../../utils/i18n';
import {
  X,
  Receipt,
  Users,
  Percent,
  Calendar,
  Tag,
  AlertCircle,
  Check,
  Loader2,
  FileText,
  Plus,
} from 'lucide-react';

interface SharedBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  currency: CurrencyCode;
  language?: LanguageCode;
  myUserId: string;
  activePartners: SharedUserSummary[];
  editingBill?: SharedBill | null;
  getCategoriesFor?: (scope: 'bill' | 'income' | 'expense' | 'all') => string[];
  onAddCategory?: (name: string, scope: CategoryScope) => Promise<unknown>;
  onSave: (params: {
    title: string;
    amount: number;
    dueDate: string;
    dueDay: number;
    category: string;
    notes?: string;
    partnerId: string;
    splitMethod: SplitMethod;
    myPercentage: number;
    partnerPercentage: number;
    recurrence?: 'none' | 'monthly';
    recurrenceMonthsCount?: number;
  }) => Promise<any>;
}

const DEFAULT_CATEGORIES = [
  'Aluguel / Moradia',
  'Energia / Luz',
  'Água',
  'Internet / TV',
  'Supermercado',
  'Transporte / Veículo',
  'Lazer / Viagem',
  'Saúde',
  'Outros',
];

export const SharedBillModal: React.FC<SharedBillModalProps> = ({
  isOpen,
  onClose,
  currency,
  language = 'pt',
  myUserId,
  activePartners,
  editingBill,
  getCategoriesFor,
  onAddCategory,
  onSave,
}) => {
  const t = getTranslations(language);

  const [title, setTitle] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [dueDate, setDueDate] = useState(getTodayStr());
  const [category, setCategory] = useState(DEFAULT_CATEGORIES[0]);
  const [notes, setNotes] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [splitMethod, setSplitMethod] = useState<SplitMethod>('fifty_fifty');
  const [myPercentStr, setMyPercentStr] = useState<string>('50');
  const [partnerPercentStr, setPartnerPercentStr] = useState<string>('50');
  const [recurrence, setRecurrence] = useState<'none' | 'monthly'>('none');
  const [recurrenceMode, setRecurrenceMode] = useState<'forever' | 'limited'>('forever');
  const [monthsCountStateStr, setMonthsCountStateStr] = useState<string>('6');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline category creation
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  const availableCategories = getCategoriesFor ? getCategoriesFor('bill') : DEFAULT_CATEGORIES;

  // Initialize form on open
  useEffect(() => {
    if (!isOpen) return;

    if (editingBill) {
      setTitle(editingBill.title || '');
      setAmountStr(String(editingBill.amount || ''));
      setDueDate(editingBill.dueDate || getTodayStr());
      setCategory(editingBill.category || availableCategories[0] || DEFAULT_CATEGORIES[0]);
      setNotes(editingBill.notes || '');
      const otherPartner = editingBill.members.find((m) => m !== myUserId) || '';
      setPartnerId(otherPartner);
      setSplitMethod(editingBill.splitMethod || 'fifty_fifty');
      const mp = editingBill.percentages?.[myUserId] ?? 50;
      const pp = editingBill.percentages?.[otherPartner] ?? (100 - mp);
      setMyPercentStr(String(mp));
      setPartnerPercentStr(String(pp));
      setRecurrence(editingBill.recurrence || 'none');
      if (editingBill.recurrenceMonthsCount && editingBill.recurrenceMonthsCount > 0) {
        setRecurrenceMode('limited');
        setMonthsCountStateStr(String(editingBill.recurrenceMonthsCount));
      } else {
        setRecurrenceMode('forever');
        setMonthsCountStateStr('6');
      }
    } else {
      setTitle('');
      setAmountStr('');
      setDueDate(getTodayStr());
      setCategory(availableCategories[0] || DEFAULT_CATEGORIES[0]);
      setNotes('');
      setPartnerId(activePartners.length > 0 ? activePartners[0].uid : '');
      setSplitMethod('fifty_fifty');
      setMyPercentStr('50');
      setPartnerPercentStr('50');
      setRecurrence('none');
      setRecurrenceMode('forever');
      setMonthsCountStateStr('6');
    }
    setIsCreatingCategory(false);
    setNewCategoryName('');
    setError(null);
  }, [isOpen, editingBill, activePartners, myUserId]);

  const handleCreateCategory = async () => {
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

  if (!isOpen) return null;

  // Selected partner
  const selectedPartner = activePartners.find((p) => p.uid === partnerId) || null;
  const partnerDisplayName = selectedPartner?.displayName || 'Parceiro';

  // Numeric amount
  const parsedTotalAmount = parseFloat(amountStr.replace(',', '.')) || 0;

  // Parsed percentages for live calculation
  const parsedMyPercent = parseFloat(myPercentStr) || 0;
  const parsedPartnerPercent = parseFloat(partnerPercentStr) || 0;

  // Automatic calculation of participant share amounts
  const myShareAmount = Math.round((parsedTotalAmount * parsedMyPercent) / 100);
  const partnerShareAmount = Math.max(0, parsedTotalAmount - myShareAmount);

  // Handle split method toggle
  const handleSplitMethodChange = (method: SplitMethod) => {
    setSplitMethod(method);
    if (method === 'fifty_fifty') {
      setMyPercentStr('50');
      setPartnerPercentStr('50');
    }
  };

  // Handle custom percentage input
  const handleMyPercentChange = (rawStr: string) => {
    const digitsOnly = rawStr.replace(/[^0-9]/g, '');
    const cleaned = digitsOnly.replace(/^0+(?=\d)/, '');
    setMyPercentStr(cleaned);
    if (cleaned !== '') {
      const n = parseInt(cleaned, 10);
      const clamped = Math.max(0, Math.min(100, n));
      setPartnerPercentStr(String(100 - clamped));
    }
  };

  const handlePartnerPercentChange = (rawStr: string) => {
    const digitsOnly = rawStr.replace(/[^0-9]/g, '');
    const cleaned = digitsOnly.replace(/^0+(?=\d)/, '');
    setPartnerPercentStr(cleaned);
    if (cleaned !== '') {
      const n = parseInt(cleaned, 10);
      const clamped = Math.max(0, Math.min(100, n));
      setMyPercentStr(String(100 - clamped));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError(
        language === 'es'
          ? 'Por favor, ingresa el título de la factura.'
          : language === 'en'
          ? 'Please enter bill title.'
          : 'Informe o título da fatura.'
      );
      return;
    }

    if (parsedTotalAmount <= 0) {
      setError(
        language === 'es'
          ? 'El monto total debe ser mayor a cero.'
          : language === 'en'
          ? 'Total amount must be greater than zero.'
          : 'O valor total deve ser maior que zero.'
      );
      return;
    }

    if (!partnerId) {
      setError(
        language === 'es'
          ? 'Selecciona la persona participante.'
          : language === 'en'
          ? 'Please select a participant.'
          : 'Selecione a pessoa participante.'
      );
      return;
    }

    if (splitMethod === 'custom_percentage') {
      if (myPercentStr === '' || partnerPercentStr === '' || isNaN(parsedMyPercent) || isNaN(parsedPartnerPercent)) {
        setError(
          language === 'es'
            ? 'Por favor, ingresa porcentajes válidos para los participantes.'
            : language === 'en'
            ? 'Please enter valid percentages.'
            : 'Informe porcentagens válidas.'
        );
        return;
      }

      if (parsedMyPercent + parsedPartnerPercent !== 100) {
        setError(t.percentagesMustSum100 || 'La suma de porcentajes debe ser exactamente 100%.');
        return;
      }
    }

    let finalRecurrenceMonthsCount = 0;
    if (recurrence === 'monthly' && recurrenceMode === 'limited') {
      const parsedMonths = parseInt(monthsCountStateStr, 10);
      if (!monthsCountStateStr || isNaN(parsedMonths) || parsedMonths <= 0) {
        setError(
          language === 'es'
            ? 'Por favor, ingresa una cantidad válida de meses (mayor a 0).'
            : language === 'en'
            ? 'Please enter a valid number of months (greater than 0).'
            : 'Informe uma quantidade válida de meses (maior que 0).'
        );
        return;
      }
      finalRecurrenceMonthsCount = parsedMonths;
    }

    const dueDay = parseInt(dueDate.slice(8, 10), 10) || 1;

    try {
      setIsSubmitting(true);
      await onSave({
        title: title.trim(),
        amount: parsedTotalAmount,
        dueDate,
        dueDay,
        category,
        notes: notes.trim() || undefined,
        partnerId,
        splitMethod,
        myPercentage: parsedMyPercent,
        partnerPercentage: parsedPartnerPercent,
        recurrence,
        recurrenceMonthsCount: finalRecurrenceMonthsCount,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar fatura compartilhada.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal((
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[10010] flex items-center justify-center glass-overlay p-3 sm:p-4 overflow-hidden overscroll-none"
    >
      <div className="glass-modal rounded-3xl max-w-lg w-full max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2.5rem)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header (pinned) */}
        <div className="p-4 sm:p-5 border-b border-slate-200/60 flex items-center justify-between shrink-0 bg-white/40 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                {editingBill ? 'Editar Fatura Compartilhada' : t.newSharedBill}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'es'
                  ? 'Registro único compartido con división de valores'
                  : language === 'en'
                  ? 'Single shared record with automated split'
                  : 'Registro único com cálculo automático da sua cota'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Scrollable Form Body */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4">
            {/* Title & Total Amount */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {language === 'es' ? 'Título da fatura' : language === 'en' ? 'Bill Title' : 'Título da Fatura'}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Seguro da moto, Aluguel, Internet..."
                required
                className="w-full px-3.5 py-2.5 rounded-2xl border border-emerald-100 bg-white/60 text-slate-900 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {language === 'es' ? 'Valor TOTAL' : language === 'en' ? 'TOTAL Amount' : 'Valor TOTAL da Fatura'}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  $
                </span>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full pl-8 pr-3.5 py-2.5 rounded-2xl border border-emerald-100 bg-white/60 text-slate-900 text-xs sm:text-sm font-mono-numbers focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50 font-bold"
                />
              </div>
            </div>
          </div>

          {/* Due Date & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>{language === 'es' ? 'Vencimiento' : language === 'en' ? 'Due Date' : 'Vencimento'}</span>
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-2xl border border-emerald-100 bg-white/60 text-slate-900 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-slate-400" />
                  <span>{language === 'es' ? 'Categoría' : language === 'en' ? 'Category' : 'Categoria'}</span>
                </label>
                {!isCreatingCategory && onAddCategory && (
                  <button
                    type="button"
                    onClick={() => setIsCreatingCategory(true)}
                    className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{t.inlineAddCategory || 'Nova Categoria'}</span>
                  </button>
                )}
              </div>

              {isCreatingCategory ? (
                <div className="p-2.5 rounded-2xl bg-slate-100 bg-white/80 border border-emerald-300 dark:border-emerald-800 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      autoFocus
                      placeholder={t.categoryNamePlaceholder || 'Nome da nova categoria'}
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs bg-white/80 border border-slate-200/80 rounded-xl text-slate-900 focus:outline-hidden"
                    />
                    <button
                      type="button"
                      disabled={isSavingCategory || !newCategoryName.trim()}
                      onClick={handleCreateCategory}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl disabled:opacity-50 cursor-pointer"
                    >
                      {isSavingCategory ? '...' : (t.createAndUse || 'Criar')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCreatingCategory(false)}
                      className="px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ) : (
                <select
                  value={category}
                  onChange={(e) => {
                    if (e.target.value === '__new__') {
                      setIsCreatingCategory(true);
                    } else {
                      setCategory(e.target.value);
                    }
                  }}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-emerald-100 bg-white/60 text-slate-900 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50"
                >
                  {availableCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                  {onAddCategory && (
                    <option value="__new__" className="font-bold text-emerald-600 dark:text-emerald-400">
                      + {language === 'es' ? 'Crear nueva categoría...' : language === 'en' ? 'Create new category...' : 'Adicionar nova categoria...'}
                    </option>
                  )}
                </select>
              )}
            </div>
          </div>


          {/* Partner Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span>{t.selectPartnerToShare}</span>
            </label>
            {activePartners.length === 0 ? (
              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-xs">
                {language === 'es'
                  ? 'Aún no tienes personas conectadas. Primero invita a alguien en "Conectar persona".'
                  : language === 'en'
                  ? 'You have no connected people yet. Please invite someone first.'
                  : 'Você ainda não possui pessoas conectadas. Convide alguém primeiro em "Convidar pessoa".'}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {activePartners.map((p) => {
                  const isSelected = partnerId === p.uid;
                  return (
                    <button
                      key={p.uid}
                      type="button"
                      onClick={() => setPartnerId(p.uid)}
                      className={`p-2.5 rounded-2xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/30'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-bold text-xs flex items-center justify-center shrink-0">
                        {p.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-bold truncate block">{p.displayName}</span>
                        <span className="text-[10px] text-slate-400 truncate block">{p.email}</span>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Split Method Toggle (50/50 vs Custom %) */}
          <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Percent className="w-3.5 h-3.5 text-slate-400" />
              <span>{t.splitMethodLabel}</span>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleSplitMethodChange('fifty_fifty')}
                className={`py-2 px-3 rounded-2xl text-xs font-bold transition-all cursor-pointer border ${
                  splitMethod === 'fifty_fifty'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-slate-100 bg-white text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                {t.splitFiftyFifty}
              </button>
              <button
                type="button"
                onClick={() => handleSplitMethodChange('custom_percentage')}
                className={`py-2 px-3 rounded-2xl text-xs font-bold transition-all cursor-pointer border ${
                  splitMethod === 'custom_percentage'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-slate-100 bg-white text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                {t.splitCustomPercent}
              </button>
            </div>

            {/* Custom Percent Inputs if active */}
            {splitMethod === 'custom_percentage' && (
              <div className="grid grid-cols-2 gap-3 pt-2 animate-in fade-in duration-200">
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {language === 'es' ? 'Tu porcentaje (%)' : 'Sua porcentagem (%)'}
                  </span>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={myPercentStr}
                      onChange={(e) => handleMyPercentChange(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      placeholder="0"
                      className="w-full px-3 py-2 pr-7 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 bg-white text-xs font-bold font-mono-numbers focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      %
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {partnerDisplayName} (%)
                  </span>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={partnerPercentStr}
                      onChange={(e) => handlePartnerPercentChange(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      placeholder="0"
                      className="w-full px-3 py-2 pr-7 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 bg-white text-xs font-bold font-mono-numbers focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      %
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Split Calculation Live Summary Card */}
            <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/60 space-y-2 mt-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block">
                {language === 'es' ? 'Cálculo Automático por Persona' : 'Cálculo Automático por Pessoa'}
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-white bg-white border border-emerald-200 dark:border-emerald-800/80">
                  <span className="text-[10px] text-slate-400 font-semibold block">
                    {language === 'es' ? 'Tú' : 'Você'} ({myPercentStr || '0'}%)
                  </span>
                  <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono-numbers">
                    {formatCurrency(myShareAmount, currency)}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white bg-white border border-emerald-200 dark:border-emerald-800/80">
                  <span className="text-[10px] text-slate-400 font-semibold block">
                    {partnerDisplayName} ({partnerPercentStr || '0'}%)
                  </span>
                  <span className="text-sm font-black text-slate-700 dark:text-slate-200 font-mono-numbers">
                    {formatCurrency(partnerShareAmount, currency)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Optional Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>{language === 'es' ? 'Notas (opcional)' : 'Observações (opcional)'}</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Pagar antes do dia 10 para ter desconto..."
              className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 bg-white text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          {error && (
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Recurrence Selector */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{language === 'es' ? 'Recurrencia' : language === 'en' ? 'Recurrence' : 'Recorrência'}</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRecurrence('none')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  recurrence === 'none'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-slate-50 bg-white text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                {language === 'es' ? 'No repetir nunca' : language === 'en' ? 'Don\'t repeat' : 'Não repetir nunca'}
              </button>
              <button
                type="button"
                onClick={() => setRecurrence('monthly')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  recurrence === 'monthly'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-slate-50 bg-white text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                {language === 'es' ? 'Repetir mensual' : language === 'en' ? 'Monthly repeat' : 'Repetir mensal'}
              </button>
            </div>
            {recurrence === 'monthly' && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-4 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="sharedRecurrenceMode"
                      value="forever"
                      checked={recurrenceMode === 'forever'}
                      onChange={() => setRecurrenceMode('forever')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>{t.repeatForever || 'Repetir para sempre'}</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="sharedRecurrenceMode"
                      value="limited"
                      checked={recurrenceMode === 'limited'}
                      onChange={() => setRecurrenceMode('limited')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>{t.endAfterMonths || 'Terminar depois de'}</span>
                  </label>
                </div>

                {recurrenceMode === 'limited' && (
                  <div className="flex items-center gap-2 pt-0.5">
                    <label className="text-[10px] text-slate-500 dark:text-slate-400">
                      {t.monthsQty || 'Qtd meses'}:
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={monthsCountStateStr}
                      onChange={(e) => setMonthsCountStateStr(e.target.value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, ''))}
                      onFocus={(e) => e.target.select()}
                      placeholder="1"
                      className="w-20 px-2 py-1 text-xs font-bold text-center bg-white bg-white border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white font-mono-numbers"
                    />
                    <span className="text-[10px] text-slate-500">{t.monthsLabel || 'meses'}</span>
                  </div>
                )}
              </div>
            )}
          </div>
          </div>

          {/* Fixed Bottom Action Bar (pinned) */}
          <div className="shrink-0 p-3 sm:p-4 border-t border-slate-100 dark:border-white/10 bg-slate-50/70 bg-white/40 backdrop-blur-xl flex items-center justify-end gap-2.5 z-10">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 text-xs font-semibold rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {language === 'es' ? 'Cancelar' : language === 'en' ? 'Cancel' : 'Cancelar'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || activePartners.length === 0}
              className="px-5 py-2.5 text-xs font-bold rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{language === 'es' ? 'Guardando...' : 'Salvando...'}</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{editingBill ? 'Salvar Alterações' : 'Criar Fatura Compartilhada'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  ), document.body);
};
