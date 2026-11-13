/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { CurrencyCode, LanguageCode } from '../types';
import { formatCurrency } from '../utils/currency';
import { getTranslations } from '../utils/i18n';
import { X, Wallet, Check, AlertCircle } from 'lucide-react';

interface BalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBalance: number;
  currency: CurrencyCode;
  language?: LanguageCode;
  onSave: (amount: number) => Promise<void>;
}

export const BalanceModal: React.FC<BalanceModalProps> = ({
  isOpen,
  onClose,
  currentBalance,
  currency,
  language = 'pt',
  onSave,
}) => {
  const t = getTranslations(language);
  const [balanceInput, setBalanceInput] = useState<string>(currentBalance ? String(currentBalance) : '0');
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setBalanceInput(currentBalance !== undefined ? String(currentBalance) : '0');
    }
  }, [isOpen, currentBalance]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(balanceInput.replace(',', '.'));
    if (isNaN(val)) return;

    try {
      setIsSubmitting(true);
      await onSave(val);
      onClose();
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
          className="fixed inset-0 z-[10010] flex items-center justify-center glass-overlay p-3 sm:p-4 overflow-hidden overscroll-none pt-safe pb-safe"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 30 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="glass-modal rounded-[2.5rem] max-w-md w-full max-h-[calc(100dvh-4rem)] flex flex-col overflow-hidden relative"
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
                    className="w-16 h-16 rounded-[1.5rem] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner border border-emerald-500/20"
                  >
                    <Wallet className="w-8 h-8" />
                  </motion.div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight tracking-tight uppercase">
                      {t.adjustBalanceTitle}
                    </h3>
                    <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.3em] mt-1">
                      CORREÇÃO DE SALDO PRINCIPAL
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

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-8 space-y-8 flex-1 overflow-y-auto no-scrollbar">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">
                  {t.balanceInputQuestion}
                </label>
                <div className="relative group">
                  <input
                    type="number"
                    step="any"
                    value={balanceInput}
                    onChange={(e) => setBalanceInput(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-6 py-6 text-2xl font-mono-numbers font-black bg-white/80 border border-slate-200/80 rounded-[1.5rem] focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 text-slate-900 transition-all shadow-inner"
                    autoFocus
                  />
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-2">
                     <span className="text-xs font-black text-emerald-600 uppercase tracking-widest bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                        {currency}
                     </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">{t.formattedBalanceLabel}:</span>
                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono-numbers tracking-tight">
                      {formatCurrency(parseFloat(balanceInput || '0') || 0, currency)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-[2rem] bg-amber-500/5 border border-amber-500/20 text-amber-700 dark:text-amber-400 flex items-start gap-4">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-[11px] font-bold uppercase tracking-widest leading-relaxed">
                  {language === 'es' 
                    ? 'Este ajuste cambiará directamente tu saldo total sin registrar transacciones de gasto o ingreso.'
                    : 'Este ajuste alterará diretamente seu saldo total sem registrar transações de gasto ou receita.'}
                </p>
              </div>

              <div className="flex items-center gap-6 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-5 text-[10px] font-black text-slate-400 hover:text-slate-900 dark:hover:text-white uppercase tracking-[0.4em] transition-colors cursor-pointer"
                >
                  {t.cancelBtn}
                </button>
                <motion.button
                  whileHover={{ scale: 1.02, x: 5 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-5 text-[11px] font-black text-white bg-emerald-600 rounded-2xl shadow-2xl shadow-emerald-600/30 disabled:opacity-50 uppercase tracking-[0.3em] cursor-pointer flex items-center justify-center gap-3 transition-all"
                >
                  <Check className="w-5 h-5" />
                  <span>{isSubmitting ? 'SALVANDO...' : 'CONFIRMAR'}</span>
                </motion.button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  ), document.body);
};
