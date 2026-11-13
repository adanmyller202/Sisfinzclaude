/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { AccountItem, CurrencyCode, LanguageCode } from '../types';
import { formatCurrency } from '../utils/currency';
import { getTranslations } from '../utils/i18n';
import { ACCOUNT_TYPE_CONFIG } from './AccountModal';
import {
  X,
  Wallet,
  Plus,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface BalanceBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: AccountItem[];
  currency: CurrencyCode;
  language?: LanguageCode;
  onNavigateToAccounts?: () => void;
  onOpenNewAccount?: () => void;
}

export const BalanceBreakdownModal: React.FC<BalanceBreakdownModalProps> = ({
  isOpen,
  onClose,
  accounts,
  currency,
  language = 'pt',
  onNavigateToAccounts,
  onOpenNewAccount,
}) => {
  const t = getTranslations(language);

  const activeAccounts = accounts.filter((a) => a.isActive !== false);
  const totalSum = activeAccounts.reduce((sum, a) => sum + (a.currentBalance || 0), 0);

  return createPortal((
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 overflow-hidden pt-safe pb-safe"
          style={{ background: 'rgba(15, 23, 42, 0.24)', isolation: 'isolate' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 30 }}
            transition={{ type: "spring", damping: 25, stiffness: 350, duration: 0.22 }}
            className="glass-modal rounded-[2.5rem] shadow-2xl max-w-md w-full max-h-[calc(100dvh-4rem)] flex flex-col overflow-hidden relative"
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
                      {language === 'es' ? 'Detalle del Saldo' : 'Detalhamento do Saldo'}
                    </h3>
                    <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.3em] mt-1 flex items-center gap-1.5">
                       <Sparkles className="w-3 h-3 text-emerald-500" />
                       DISTRIBUIÇÃO POR CONTAS
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

            {/* Content Body */}
            <div className="p-8 space-y-8 overflow-y-auto no-scrollbar flex-1 min-h-0 overscroll-contain">
              {activeAccounts.length === 0 ? (
                <div className="py-16 px-6 text-center rounded-[2.5rem] border-2 border-dashed border-slate-200 space-y-6 bg-white/80 shadow-inner">
                  <div className="w-20 h-20 rounded-[2.5rem] bg-emerald-50 flex items-center justify-center mx-auto text-3xl shadow-xs">
                    🏦
                  </div>
                  <div className="space-y-2">
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] leading-relaxed">
                      {language === 'es'
                        ? 'No tienes cuentas registradas todavía.'
                        : 'Você ainda não possui contas cadastradas.'}
                    </p>
                  </div>
                  {onOpenNewAccount && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenNewAccount();
                      }}
                      className="px-10 py-5 text-[10px] font-black text-white bg-emerald-600 rounded-2xl uppercase tracking-widest shadow-xl shadow-emerald-600/20 active:scale-95 transition-all"
                    >
                      CRIAR AGORA
                    </motion.button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 ml-1 mb-4 flex items-center justify-between">
                    <span>SUAS CONTAS ATIVAS</span>
                    <span className="bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100 text-[9px] text-slate-600 font-black">
                      {activeAccounts.length} {activeAccounts.length === 1 ? 'CONTA' : 'CONTAS'}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {activeAccounts.map((acc, idx) => {
                      const cfg = ACCOUNT_TYPE_CONFIG[acc.type] || ACCOUNT_TYPE_CONFIG.other;
                      return (
                        <motion.div
                          initial={{ opacity: 0, x: -15 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05, type: "spring", damping: 20 }}
                          key={acc.id}
                          className="p-5 rounded-[1.5rem] bg-white/80 border border-slate-200/80 flex items-center justify-between group hover:border-emerald-500/40 hover:bg-[#D1FAEB]/30 hover:shadow-lg hover:shadow-emerald-500/5 transition-all"
                        >
                          <div className="flex items-center gap-5 min-w-0">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-50/70 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform shadow-inner border border-emerald-100">
                              {cfg.emoji}
                            </div>
                            <div className="min-w-0 space-y-1">
                              <span className="text-sm font-black text-slate-900 truncate block uppercase tracking-tight">
                                {acc.name}
                              </span>
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] block">
                                {cfg.label[language] || cfg.label.pt}
                              </span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-base font-black font-mono-numbers text-slate-900 dark:text-white block tracking-tight">
                              {formatCurrency(acc.currentBalance, acc.currency || currency)}
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Total Consolidation Summary Card */}
              {activeAccounts.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: activeAccounts.length * 0.05 + 0.1 }}
                  className="p-8 rounded-[2.5rem] bg-gradient-to-br from-emerald-900 to-teal-900 text-white shadow-xl relative overflow-hidden group border border-emerald-400/30 backdrop-blur-xl"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none group-hover:scale-125 transition-transform duration-1000" />
                  <div className="flex items-center justify-between relative z-10">
                    <div className="space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40 block">
                        SALDO CONSOLIDADO
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black opacity-30 uppercase tracking-[0.2em] block">
                          AGREGADO EM TEMPO REAL
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl sm:text-3xl font-black font-mono-numbers block tracking-tighter">
                        {formatCurrency(totalSum, currency)}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="shrink-0 p-8 border-t border-slate-200/60 bg-white/80 backdrop-blur-2xl flex items-center justify-between gap-6 z-10">
              {onOpenNewAccount && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenNewAccount();
                  }}
                  className="px-4 py-3 text-[10px] font-black text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 transition-colors uppercase tracking-[0.2em] cursor-pointer flex items-center gap-2 group"
                >
                  <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                  <span>NOVA CONTA</span>
                </button>
              )}

              {onNavigateToAccounts && (
                <motion.button
                  whileHover={{ scale: 1.02, x: 5 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => {
                    // Let the dark modal veil finish fading before mounting Accounts.
                    onClose();
                    window.setTimeout(() => {
                      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
                      onNavigateToAccounts();
                    }, 220);
                  }}
                  className="px-8 py-5 text-[11px] font-black text-white bg-emerald-600 rounded-2xl shadow-2xl shadow-emerald-600/30 uppercase tracking-[0.2em] cursor-pointer flex items-center gap-3 active:scale-95 transition-all"
                >
                  <span>GERENCIAR</span>
                  <ChevronRight className="w-5 h-5" />
                </motion.button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  ), document.body);
};
