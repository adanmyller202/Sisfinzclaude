/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AccountItem, CurrencyCode, LanguageCode } from '../types';
import { getTodayStr } from '../utils/finance';
import { formatCurrency, CURRENCIES } from '../utils/currency';
import { getTranslations } from '../utils/i18n';
import { ACCOUNT_TYPE_CONFIG } from './AccountModal';
import {
  X,
  ArrowRightLeft,
  Calendar,
  AlertCircle,
  Check,
  Info,
  Loader2,
  FileText,
  ArrowDown,
  Landmark,
} from 'lucide-react';

interface TransferBetweenAccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: AccountItem[];
  currency: CurrencyCode;
  language?: LanguageCode;
  onExecuteTransfer: (params: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    date: string;
    notes?: string;
  }) => Promise<void>;
}

export const TransferBetweenAccountsModal: React.FC<TransferBetweenAccountsModalProps> = ({
  isOpen,
  onClose,
  accounts,
  currency,
  language = 'pt',
  onExecuteTransfer,
}) => {
  const t = getTranslations(language);

  const activeAccounts = accounts.filter((a) => a.isActive !== false);

  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [date, setDate] = useState(getTodayStr());
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const transferContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (activeAccounts.length >= 2) {
      setFromAccountId(activeAccounts[0].id);
      setToAccountId(activeAccounts[1].id);
    } else if (activeAccounts.length === 1) {
      setFromAccountId(activeAccounts[0].id);
      setToAccountId('');
    } else {
      setFromAccountId('');
      setToAccountId('');
    }

    setAmountStr('');
    setDate(getTodayStr());
    setNotes('');
    setError(null);
    setIsSubmitting(false);
    setIsSuccess(false);
    // Always open the form at its first field, never at a stale scroll offset.
    requestAnimationFrame(() => {
      if (transferContentRef.current) transferContentRef.current.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    });
  }, [isOpen, activeAccounts.length]);

  const fromAccountObj = activeAccounts.find((a) => a.id === fromAccountId);
  const toAccountObj = activeAccounts.find((a) => a.id === toAccountId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fromAccountId || !toAccountId) {
      setError(
        language === 'es'
          ? 'Por favor, selecciona las cuentas de origen y destino.'
          : 'Selecione as contas de origem e destino.'
      );
      return;
    }

    if (fromAccountId === toAccountId) {
      setError(
        language === 'es'
          ? 'La cuenta de origen y destino no pueden ser la misma.'
          : 'A conta de origem e destino não podem ser a mesma.'
      );
      return;
    }

    const parsedAmount = parseFloat(amountStr.replace(',', '.')) || 0;
    if (parsedAmount <= 0) {
      setError(
        language === 'es'
          ? 'El monto a transferir debe ser mayor a cero.'
          : 'O valor da transferência deve ser maior que zero.'
      );
      return;
    }

    try {
      setIsSubmitting(true);
      await onExecuteTransfer({
        fromAccountId,
        toAccountId,
        amount: parsedAmount,
        date,
        notes: notes.trim(),
      });
      setIsSuccess(true);
      await new Promise((resolve) => window.setTimeout(resolve, 480));
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao executar transferência.');
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
            className="glass-modal rounded-[2.5rem] max-w-md w-full max-h-[calc(100dvh-4rem)] flex flex-col overflow-hidden relative"
          >
            {/* Header with Mesh Gradient */}
            <div className="relative p-8 shrink-0 overflow-hidden">
              <div className="absolute inset-0 mesh-gradient opacity-20" />
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-5">
                  <motion.div 
                    initial={{ rotate: -15, scale: 0.8 }}
                    animate={{ rotate: 0, scale: 1 }}
                    className="w-16 h-16 rounded-[1.5rem] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner border border-emerald-500/20"
                  >
                    <ArrowRightLeft className="w-8 h-8" />
                  </motion.div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight tracking-tight uppercase">
                      {language === 'es' ? 'Transferir Entre Cuentas' : 'Transferir Entre Contas'}
                    </h3>
                    <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.3em] mt-1">
                      MOVIMENTAÇÃO INTERNA
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
              <div ref={transferContentRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-8 space-y-8 no-scrollbar">
                
                {activeAccounts.length < 2 && (
                  <div className="p-5 rounded-[1.5rem] bg-amber-500/10 border border-amber-500/20 text-amber-700 text-[11px] font-black uppercase tracking-widest flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span>{language === 'es' ? 'Necesitas al menos 2 cuentas para transferir.' : 'Você precisa de pelo menos 2 contas para transferir.'}</span>
                  </div>
                )}

                {/* From Account */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
                      <Landmark className="w-4 h-4" />
                      <span>DE (CONTA DE ORIGEM)</span>
                    </label>
                    {fromAccountObj && (
                      <span className="text-[10px] text-emerald-600 font-mono-numbers font-black bg-emerald-500/5 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                        {formatCurrency(fromAccountObj.currentBalance, fromAccountObj.currency || currency)}
                      </span>
                    )}
                  </div>
                  <div className="relative group">
                    <select
                      value={fromAccountId}
                      onChange={(e) => setFromAccountId(e.target.value)}
                      required
                      className="w-full px-6 py-5 rounded-[1.5rem] border border-slate-200/80 bg-white/80 text-slate-900 text-sm font-black focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 transition-all appearance-none cursor-pointer"
                    >
                      {activeAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id} disabled={acc.id === toAccountId}>
                          {ACCOUNT_TYPE_CONFIG[acc.type]?.emoji || '🏦'} {acc.name}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                       <ArrowDown className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                {/* Arrow Visual */}
                <div className="flex items-center justify-center -my-4 relative z-10">
                   <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md border-2 border-white">
                     <ArrowDown className="w-5 h-5" />
                   </div>
                </div>

                {/* To Account */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
                      <Landmark className="w-4 h-4 rotate-180" />
                      <span>PARA (CONTA DE DESTINO)</span>
                    </label>
                    {toAccountObj && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono-numbers font-black bg-emerald-500/5 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                        {formatCurrency(toAccountObj.currentBalance, toAccountObj.currency || currency)}
                      </span>
                    )}
                  </div>
                  <div className="relative group">
                    <select
                      value={toAccountId}
                      onChange={(e) => setToAccountId(e.target.value)}
                      required
                      className="w-full px-6 py-5 rounded-[1.5rem] border border-slate-200/80 bg-white/80 text-slate-900 text-sm font-black focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 transition-all appearance-none cursor-pointer"
                    >
                      {activeAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id} disabled={acc.id === fromAccountId}>
                          {ACCOUNT_TYPE_CONFIG[acc.type]?.emoji || '🏦'} {acc.name}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                       <ArrowDown className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                {/* Amount & Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">VALOR</label>
                    <div className="relative group">
                      <span className="absolute left-6 top-1/2 -translate-y-1/2 text-sm font-black text-emerald-600">
                        {CURRENCIES[currency]?.symbol || '$'}
                      </span>
                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        value={amountStr}
                        onChange={(e) => setAmountStr(e.target.value)}
                        placeholder="0.00"
                        required
                        className="w-full pl-12 pr-6 py-5 rounded-[1.5rem] border border-slate-200/80 bg-white/80 text-slate-900 text-sm font-mono-numbers font-black focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-emerald-500" />
                      DATA
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                      className="w-full px-6 py-5 rounded-[1.5rem] border border-slate-200/80 bg-white/80 text-slate-900 text-sm font-black focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 transition-all appearance-none"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-400" />
                    OBSERVAÇÃO (OPCIONAL)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ex: Depósito, Retirada..."
                    className="w-full px-6 py-5 rounded-[1.5rem] border border-slate-200/80 bg-white/80 text-slate-900 text-sm font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 transition-all"
                  />
                </div>

                <div className="glass-emerald p-6 rounded-[2rem] text-slate-900 shadow-md border border-emerald-500/20 flex items-start gap-4">
                  <Info className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] font-bold uppercase tracking-widest leading-relaxed text-slate-800">
                    {language === 'es'
                      ? 'Esta transferencia NO afectará el informe mensual. Únicamente reajusta los saldos entre tus cuentas.'
                      : 'Esta transferência NÃO altera seu relatório mensal. Apenas ajusta os saldos das suas contas.'}
                  </p>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="shrink-0 p-8 border-t border-slate-200/60 bg-white/80 backdrop-blur-2xl flex items-center justify-between gap-6 z-10">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-6 py-4 text-[10px] font-black text-slate-400 hover:text-slate-900 uppercase tracking-[0.4em] transition-colors cursor-pointer"
                >
                  CANCELAR
                </button>
                <motion.button
                  whileHover={{ scale: 1.02, x: 5 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isSubmitting || activeAccounts.length < 2}
                  className="px-10 py-5 text-[11px] font-black text-white bg-emerald-600 rounded-2xl shadow-2xl shadow-emerald-600/30 disabled:opacity-50 uppercase tracking-[0.3em] cursor-pointer flex items-center gap-3 active:scale-95 transition-all"
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {isSuccess ? (
                      <motion.span key="success" initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 16 }} className="flex items-center gap-2">
                        <Check className="w-5 h-5" />
                        <span>CONCLUÍDO!</span>
                      </motion.span>
                    ) : isSubmitting ? (
                      <motion.span key="loading" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} className="flex items-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>PROCESSANDO...</span>
                      </motion.span>
                    ) : (
                      <motion.span key="idle" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-2">
                        <Check className="w-5 h-5" />
                        <span>CONFIRMAR TRANSFERÊNCIA</span>
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
