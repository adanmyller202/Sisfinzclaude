/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { SavingGoal, CurrencyCode, LanguageCode } from '../types';
import { getTranslations } from '../utils/i18n';
import { CURRENCIES } from '../utils/currency';
import { X, Target, Calendar, FileText, Check, AlertCircle, Sparkles, Coins, Lock } from 'lucide-react';

interface SavingGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    hasTarget: boolean;
    targetAmount?: number;
    currency: CurrencyCode;
    deadline?: string;
    icon?: string;
    notes?: string;
  }) => Promise<void>;
  goalToEdit?: SavingGoal | null;
  currency: CurrencyCode;
  language?: LanguageCode;
}

const POPULAR_ICONS = ['🏍️', '🚗', '🏠', '✈️', '💻', '💍', '🎓', '🏥', '🛡️', '🏖️', '📱', '🎯'];

const SUPPORTED_CURRENCIES: Array<{ code: CurrencyCode; label: string; flag: string; symbol: string }> = [
  { code: 'ARS', label: 'ARS — Pesos argentinos', flag: '🇦🇷', symbol: '$' },
  { code: 'USD', label: 'USD — Dólares americanos', flag: '🇺🇸', symbol: 'US$' },
  { code: 'BRL', label: 'BRL — Reais brasileiros', flag: '🇧🇷', symbol: 'R$' },
];

export const SavingGoalModal: React.FC<SavingGoalModalProps> = ({
  isOpen,
  onClose,
  onSave,
  goalToEdit,
  currency,
  language = 'pt',
}) => {
  const t = getTranslations(language);

  const [hasTarget, setHasTarget] = useState<boolean>(true);
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>(currency || 'ARS');
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [icon, setIcon] = useState('🎯');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (goalToEdit) {
      setHasTarget(goalToEdit.hasTarget !== false);
      setSelectedCurrency((goalToEdit.currency as CurrencyCode) || 'ARS');
      setName(goalToEdit.name || '');
      setTargetAmount(goalToEdit.targetAmount ? String(goalToEdit.targetAmount) : '');
      setDeadline(goalToEdit.deadline || '');
      setIcon(goalToEdit.icon || '🎯');
      setNotes(goalToEdit.notes || '');
    } else {
      setHasTarget(true);
      setSelectedCurrency(currency || 'ARS');
      setName('');
      setTargetAmount('');
      setDeadline('');
      setIcon('🎯');
      setNotes('');
    }
    setError(null);
  }, [goalToEdit, isOpen, currency]);

  const activeCurrencyConfig = CURRENCIES[selectedCurrency] || CURRENCIES.ARS;
  const currencySymbol = activeCurrencyConfig.symbol || '$';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError(language === 'es' ? 'Por favor, ingresa el nombre de la reserva.' : 'Por favor, informe o nome da reserva.');
      return;
    }

    let parsedTarget: number | undefined = undefined;
    if (hasTarget) {
      parsedTarget = parseFloat(targetAmount.replace(/[^0-9.-]/g, ''));
      if (isNaN(parsedTarget) || parsedTarget <= 0) {
        setError(
          language === 'es'
            ? 'Por favor, ingresa un monto objetivo válido mayor que cero.'
            : 'Por favor, informe um valor objetivo válido maior que zero.'
        );
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSave({
        name: name.trim(),
        hasTarget,
        targetAmount: hasTarget ? parsedTarget : undefined,
        currency: selectedCurrency,
        deadline: hasTarget && deadline.trim() ? deadline.trim() : undefined,
        icon: icon || '🎯',
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      console.error('Error saving saving goal:', err);
      setError(err?.message || 'Erro ao salvar a reserva.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal((
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[10002] flex items-center justify-center p-3 sm:p-4 overflow-hidden overscroll-none bg-slate-950/25 pt-safe pb-safe"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="glass-modal rounded-[2.5rem] max-w-md w-full max-h-[calc(100dvh-2.5rem)] sm:max-h-[calc(100dvh-3.5rem)] flex flex-col overflow-hidden relative shadow-2xl my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Mesh Gradient */}
            <div className="relative p-8 shrink-0 overflow-hidden">
              <div className="absolute inset-0 mesh-gradient opacity-20" />
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-5">
                  <motion.div 
                    initial={{ rotate: -15, scale: 0.8 }}
                    animate={{ rotate: 0, scale: 1 }}
                    className="w-16 h-16 rounded-[1.5rem] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner border border-emerald-500/20 text-3xl"
                  >
                    {icon}
                  </motion.div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-tight tracking-tight">
                      {goalToEdit ? (language === 'es' ? 'Editar Reserva' : 'Editar Reserva') : (language === 'es' ? 'Nueva Reserva' : 'Nova Reserva')}
                    </h3>
                    <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.3em] mt-1 flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-emerald-500" />
                      COFRINHOS SISFINZ
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

            <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-8 space-y-7 no-scrollbar">
                
                {/* 1. Escolha Obrigatória: Com Meta vs Sem Meta */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">
                    TIPO DE RESERVA
                  </label>
                  <div className="grid grid-cols-2 gap-3 p-1.5 rounded-[1.25rem] bg-[#D1FAEB]/60 border border-emerald-500/20 relative overflow-hidden backdrop-blur-md">
                    <button
                      type="button"
                      onClick={() => setHasTarget(true)}
                      className={`flex items-center justify-center gap-2 py-3.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all cursor-pointer relative z-10 ${
                        hasTarget ? 'text-white' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {hasTarget && (
                        <motion.div layoutId="saving-has-target-bg" className="absolute inset-0 bg-emerald-600 rounded-xl shadow-lg shadow-emerald-600/20" />
                      )}
                      <Target className="w-4 h-4 relative z-10" />
                      <span className="relative z-10">COM META</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setHasTarget(false)}
                      className={`flex items-center justify-center gap-2 py-3.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all cursor-pointer relative z-10 ${
                        !hasTarget ? 'text-white' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {!hasTarget && (
                        <motion.div layoutId="saving-has-target-bg" className="absolute inset-0 bg-emerald-600 rounded-xl shadow-lg shadow-emerald-600/20" />
                      )}
                      <Coins className="w-4 h-4 relative z-10" />
                      <span className="relative z-10">SEM META (LIVRE)</span>
                    </button>
                  </div>
                  <p className="text-[10px] font-medium text-slate-500 ml-1">
                    {hasTarget
                      ? 'Defina um objetivo financeiro e acompanhe a porcentagem de evolução.'
                      : 'Guarde qualquer valor sem prazo ou meta predefinida. Livre para resgatar.'}
                  </p>
                </div>

                {/* 2. Moeda da Reserva */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">
                      MOEDA DA RESERVA
                    </label>
                    {goalToEdit && (
                      <span className="text-[9px] font-black uppercase tracking-widest text-amber-700 flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                        <Lock className="w-2.5 h-2.5" /> Permanente
                      </span>
                    )}
                  </div>
                  
                  {goalToEdit ? (
                    <div className="flex items-center gap-3 p-4 rounded-[1.25rem] bg-slate-100/80 border border-slate-200">
                      <span className="text-2xl">{activeCurrencyConfig.flag}</span>
                      <div>
                        <div className="text-xs font-black text-slate-900 uppercase tracking-wider">
                          {activeCurrencyConfig.code} — {activeCurrencyConfig.name}
                        </div>
                        <div className="text-[10px] font-medium text-slate-500">
                          A moeda desta reserva é permanente e não pode ser alterada diretamente.
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {SUPPORTED_CURRENCIES.map((cur) => {
                        const isSelected = selectedCurrency === cur.code;
                        return (
                          <button
                            type="button"
                            key={cur.code}
                            onClick={() => setSelectedCurrency(cur.code)}
                            className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                              isSelected
                                ? 'border-emerald-500 bg-emerald-500/15 shadow-sm text-emerald-950 font-black'
                                : 'border-slate-200 bg-white/70 hover:bg-white text-slate-600'
                            }`}
                          >
                            <span className="text-xl">{cur.flag}</span>
                            <span className="text-[11px] font-black tracking-tight">{cur.code}</span>
                            <span className="text-[9px] font-bold text-slate-500">{cur.symbol}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 3. Icon Selector */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">
                    {t.savingIconLabel || 'ÍCONE DO COFRINHO'}
                  </label>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {POPULAR_ICONS.map((emoji) => (
                      <motion.button
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.9 }}
                        type="button"
                        key={emoji}
                        onClick={() => setIcon(emoji)}
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center text-lg transition-all cursor-pointer border ${
                          icon === emoji
                            ? 'border-emerald-500 bg-emerald-500/20 shadow-md shadow-emerald-500/10'
                            : 'border-slate-200 bg-white/80 hover:bg-[#D1FAEB]/30'
                        }`}
                      >
                        {emoji}
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* 4. Name */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">
                    {t.savingNameLabel || 'NOME DA RESERVA'}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Viagem, Fundo de Emergência, Dólares guardados..."
                    className="w-full px-5 py-4 text-sm font-black bg-white/80 border border-slate-200/80 rounded-[1.25rem] focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 text-slate-900 transition-all placeholder:text-slate-400"
                    required
                  />
                </div>

                {/* 5. Target Amount (Only if hasTarget) */}
                {hasTarget && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center justify-between ml-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">
                        {t.savingTargetLabel || 'VALOR OBJETIVO (META)'}
                      </label>
                      <span className="text-[10px] font-black text-emerald-600 uppercase">
                        Em {selectedCurrency}
                      </span>
                    </div>
                    <div className="relative group">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-sm font-black text-emerald-600">
                        {currencySymbol}
                      </span>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={targetAmount}
                        onChange={(e) => setTargetAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-14 pr-5 py-4 text-sm font-mono-numbers font-black bg-white/80 border border-slate-200/80 rounded-[1.25rem] focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 text-slate-900 transition-all"
                        required={hasTarget}
                      />
                    </div>
                  </motion.div>
                )}

                {/* 6. Deadline (Only if hasTarget) */}
                {hasTarget && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3"
                  >
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-emerald-500" />
                      {t.deadlineLabel || 'PRAZO ESTIMADO (OPCIONAL)'}
                    </label>
                    <input
                      type="date"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      className="w-full px-5 py-4 text-sm font-black bg-white/80 border border-slate-200/80 rounded-[1.25rem] focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 text-slate-900 transition-all appearance-none"
                    />
                  </motion.div>
                )}

                {/* 7. Notes */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-400" />
                    {t.savingNotesLabel || 'OBSERVAÇÕES'}
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Anotações opcionais sobre esta reserva..."
                    className="w-full px-5 py-4 text-sm font-bold bg-white/80 border border-slate-200/80 rounded-[1.25rem] focus:outline-hidden focus:ring-2 focus:ring-slate-900/5 text-slate-900 min-h-24 resize-none transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Fixed Bottom Action Bar */}
              <div className="shrink-0 p-6 border-t border-slate-200/60 bg-white/80 backdrop-blur-2xl flex items-center justify-between gap-4 z-10">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-5 py-3 text-[10px] font-black text-slate-400 hover:text-slate-900 uppercase tracking-[0.3em] transition-colors cursor-pointer"
                >
                  {t.cancelBtn}
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isSubmitting}
                  className="px-8 py-4 text-[11px] font-black text-white bg-emerald-600 rounded-2xl shadow-xl shadow-emerald-600/20 disabled:opacity-50 uppercase tracking-[0.25em] cursor-pointer flex items-center gap-2.5 active:scale-95 transition-all"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>{isSubmitting ? 'SALVANDO...' : (goalToEdit ? 'ATUALIZAR RESERVA' : 'CRIAR RESERVA')}</span>
                </motion.button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  ), document.body);
};
