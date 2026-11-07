/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { LanguageCode } from '../types';
import { getTranslations } from '../utils/i18n';
import {
  Plus,
  X,
  ShoppingBag,
  TrendingUp,
  Receipt,
  ArrowRightLeft,
  Users,
  Mic,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface QuickActionFABProps {
  language?: LanguageCode;
  onOpenExpense: () => void;
  onOpenIncome: () => void;
  onOpenBill: () => void;
  onOpenTransfer: () => void;
  onOpenSharedBill: () => void;
  onOpenVoice?: () => void;
  onMenuToggle?: (isOpen: boolean) => void;
}

export const QuickActionFAB: React.FC<QuickActionFABProps> = ({
  language = 'pt',
  onOpenExpense,
  onOpenIncome,
  onOpenBill,
  onOpenTransfer,
  onOpenSharedBill,
  onOpenVoice,
  onMenuToggle,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const t = getTranslations(language);

  const toggleOpen = (newVal: boolean) => {
    setIsOpen(newVal);
    if (onMenuToggle) onMenuToggle(newVal);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') toggleOpen(false);
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleAction = (actionFn: () => void) => {
    toggleOpen(false);
    actionFn();
  };

  const actions = [
    { id: 'expense', label: t.quickExpense, icon: ShoppingBag, color: 'rose', action: onOpenExpense, desc: 'Saída imediata' },
    { id: 'income', label: t.quickIncome, icon: TrendingUp, color: 'emerald', action: onOpenIncome, desc: 'Entrada de valor' },
    { id: 'bill', label: t.quickBill, icon: Receipt, color: 'blue', action: onOpenBill, desc: 'Conta ou parcela' },
    { id: 'transfer', label: t.quickTransfer, icon: ArrowRightLeft, color: 'teal', action: onOpenTransfer, desc: 'Entre contas' },
  ];

  return (
    <>
      <div
        className="fixed z-50 transition-all duration-300 print:hidden"
        style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))', right: '1.25rem' }}
      >
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => toggleOpen(!isOpen)}
          className={`w-14 h-14 rounded-[1.75rem] flex items-center justify-center transition-all duration-300 relative overflow-hidden cursor-pointer ${
            isOpen 
              ? 'bg-slate-900/80 text-white rotate-90 scale-90 shadow-xl' 
              : 'text-white shadow-2xl shadow-emerald-500/30'
          }`}
          style={{
            background: isOpen 
              ? 'rgba(15, 23, 42, 0.75)' 
              : 'linear-gradient(135deg, rgba(16, 185, 129, 0.65) 0%, rgba(5, 150, 105, 0.45) 50%, rgba(4, 120, 87, 0.75) 100%)',
            backdropFilter: 'blur(24px) saturate(190%)',
            WebkitBackdropFilter: 'blur(24px) saturate(190%)',
            boxShadow: '0 12px 32px 0 rgba(16, 185, 129, 0.35), inset 0 1px 1px 0 rgba(255, 255, 255, 0.6), inset 0 -1px 1px 0 rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.35)',
          }}
        >
          {/* Internal luminous reflection sheen */}
          <div 
            className="absolute inset-0 pointer-events-none" 
            style={{
              background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0.05) 50%, rgba(0, 0, 0, 0.15) 100%)',
            }}
          />
          <div className="relative z-10 flex items-center justify-center text-white drop-shadow-md">
            {isOpen ? <X className="w-6 h-6 stroke-[3]" /> : <Plus className="w-8 h-8 stroke-[3]" />}
          </div>
        </motion.button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[45] flex items-center justify-center overflow-hidden overscroll-contain">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-0 bg-slate-900/40 backdrop-blur-sm quick-action-backdrop"
              onClick={() => toggleOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="glass-modal w-full max-w-sm rounded-[3rem] p-8 shadow-2xl relative z-10 m-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-8">
                <h3 className="text-xl font-black text-slate-900 tracking-tight leading-none mb-2">Ação Rápida</h3>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Escolha o que deseja lançar</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {actions.map((item) => {
                  const Icon = item.icon;
                  return (
                    <motion.button
                      key={item.id}
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleAction(item.action)}
                      className="p-5 rounded-[2rem] bg-white/70 border border-slate-200/80 hover:bg-white shadow-xs transition-all text-left group cursor-pointer"
                    >
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-3 shadow-md ${
                        item.color === 'rose' ? 'bg-rose-500/10 text-rose-600' :
                        item.color === 'emerald' ? 'bg-emerald-500/10 text-emerald-600' :
                        item.color === 'blue' ? 'bg-blue-500/10 text-blue-600' :
                        'bg-teal-500/10 text-teal-600'
                      }`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="text-xs font-black text-slate-900 group-hover:text-emerald-700 transition-colors">{item.label}</div>
                      <div className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter mt-0.5">{item.desc}</div>
                    </motion.button>
                  );
                })}

                <motion.button
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleAction(onOpenSharedBill)}
                  className="col-span-2 p-5 rounded-[2rem] bg-indigo-50/80 border border-indigo-200/80 hover:bg-indigo-100/80 transition-all flex items-center gap-4 group cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20 group-hover:scale-110 transition-transform">
                    <Users className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-black text-slate-900 group-hover:text-indigo-700 transition-colors">{t.quickShared}</div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Dividir com amigos ou parceiro</div>
                  </div>
                </motion.button>

                {onOpenVoice && (
                  <motion.button
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleAction(onOpenVoice)}
                    className="col-span-2 p-5 rounded-[2rem] bg-purple-50/80 border border-purple-200/80 hover:bg-purple-100/80 transition-all flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-600/20 group-hover:scale-110 transition-transform">
                        <Mic className="w-6 h-6" />
                      </div>
                      <div className="text-left">
                        <div className="flex items-center gap-2 text-sm font-black text-slate-900 group-hover:text-purple-700 transition-colors">
                          Lançamento por Voz
                          <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                        </div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">IA identifica tudo automaticamente</div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-purple-600 group-hover:translate-x-1 transition-transform" />
                  </motion.button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

const ChevronRight = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
);
