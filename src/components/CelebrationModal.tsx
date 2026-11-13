/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChallengeGoal, CurrencyCode, LanguageCode } from '../types';
import { formatCurrency } from '../utils/currency';
import { triggerCelebration } from '../utils/storage';
import { getTranslations } from '../utils/i18n';
import { Trophy, X, PartyPopper, Sparkles, Star } from 'lucide-react';

interface CelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: ChallengeGoal;
  savedAmount: number;
  currency: CurrencyCode;
  language?: LanguageCode;
}

export const CelebrationModal: React.FC<CelebrationModalProps> = ({
  isOpen,
  onClose,
  goal,
  savedAmount,
  currency,
  language = 'pt',
}) => {
  const t = getTranslations(language);

  return createPortal((
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[300] flex items-center justify-center p-4 glass-overlay overflow-hidden"
        >
          {/* Animated Background Particles Concept */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
             {[...Array(6)].map((_, i) => (
               <motion.div
                 key={i}
                 initial={{ opacity: 0, scale: 0, x: '50%', y: '50%' }}
                 animate={{ 
                   opacity: [0, 0.2, 0], 
                   scale: [0, 2, 3],
                   x: [`${40 + Math.random() * 20}%`, `${Math.random() * 100}%`],
                   y: [`${40 + Math.random() * 20}%`, `${Math.random() * 100}%`]
                 }}
                 transition={{ duration: 4, repeat: Infinity, delay: i * 0.5 }}
                 className="absolute w-64 h-64 rounded-full bg-emerald-500/20 blur-[100px]"
               />
             ))}
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 50, rotate: -2 }}
            animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 50, rotate: 2 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="glass-modal rounded-[3rem] max-w-md w-full overflow-hidden border border-emerald-500/30 relative text-center p-10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-32 w-64 h-64 bg-emerald-500/30 rounded-full blur-[80px] pointer-events-none" />

            <button
              onClick={onClose}
              className="absolute top-6 right-6 w-10 h-10 rounded-xl bg-emerald-500/10 text-slate-500 hover:text-slate-800 hover:bg-emerald-500/20 transition-all cursor-pointer flex items-center justify-center border border-emerald-500/20"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Cinematic Trophy Stage */}
            <div className="relative mb-10">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="mx-auto w-24 h-24 rounded-[2rem] bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-2xl shadow-emerald-500/40 text-4xl relative z-10"
              >
                🏆
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-[-15px] border-2 border-dashed border-emerald-500/30 rounded-full"
                />
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="absolute -bottom-2 -right-2 w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/30 z-20 border-2 border-white"
              >
                <Star className="w-5 h-5 fill-current" />
              </motion.div>
            </div>

            <div className="space-y-2 mb-8">
              <motion.span 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-[10px] font-black uppercase tracking-[0.4em] text-emerald-600 block"
              >
                {t.celebrationTitle}
              </motion.span>

              <motion.h2 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tighter"
              >
                {formatCurrency(savedAmount, currency)}
              </motion.h2>

              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="text-[11px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed max-w-xs mx-auto"
              >
                {t.celebrationSubtitle}
              </motion.p>
            </div>

            {/* Achievement Card */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8 }}
              className="mb-10 p-6 rounded-[2.5rem] glass-emerald relative overflow-hidden group shadow-inner"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-1000" />
              <div className="space-y-1 relative z-10">
                <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">{t.celebrationTotalSaved}</div>
                <div className="text-2xl font-black text-slate-900 font-mono-numbers tracking-tight">
                  {formatCurrency(savedAmount, currency)}
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-700 text-[10px] font-black uppercase tracking-widest mt-3 border border-emerald-500/30">
                  <Sparkles className="w-3 h-3" />
                  <span>{goal.title} COMPLETADO</span>
                </div>
              </div>
            </motion.div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={() => {
                   triggerCelebration('major');
                }}
                className="py-4 px-4 rounded-2xl bg-white/70 hover:bg-emerald-50/80 border border-emerald-200/60 text-slate-700 hover:text-emerald-700 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <PartyPopper className="w-5 h-5" />
                <span className="text-[10px] font-black uppercase tracking-widest">COMEMORAR</span>
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={onClose}
                className="py-4 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="text-[10px] font-black uppercase tracking-widest">{t.celebrationContinueBtn}</span>
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  ), document.body);
};
