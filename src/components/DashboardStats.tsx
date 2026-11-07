/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChallengeGoal, CurrencyCode, LanguageCode } from '../types';
import { formatCurrency } from '../utils/currency';
import { Target, TrendingUp, PiggyBank, Clock, CheckCircle, Zap, Edit2 } from 'lucide-react';

interface DashboardStatsProps {
  goal: ChallengeGoal;
  savedAmount: number;
  targetAmount: number;
  remainingAmount: number;
  financialProgressPercent: number;
  completedSquaresCount: number;
  totalSquaresCount: number;
  squaresProgressPercent: number;
  currency: CurrencyCode;
  language?: LanguageCode;
  onEditGoalClick: () => void;
  onAddAvulsoClick: () => void;
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({
  goal,
  savedAmount,
  targetAmount,
  remainingAmount,
  financialProgressPercent,
  completedSquaresCount,
  totalSquaresCount,
  squaresProgressPercent,
  currency,
  language = 'pt',
  onEditGoalClick,
  onAddAvulsoClick,
}) => {
  const isFinished = completedSquaresCount >= totalSquaresCount && totalSquaresCount > 0;

  return (
    <div className="space-y-6">
      {/* Primary Hero Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[2.5rem] glass-panel text-slate-900 p-6 sm:p-8 border shadow-xl"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-slate-200/60">
            <div className="flex items-center gap-5">
              <motion.div 
                whileHover={{ scale: 1.05, rotate: 5 }}
                className="text-4xl w-16 h-16 bg-white/90 rounded-3xl border border-white/90 flex items-center justify-center shadow-md"
              >
                {goal.icon}
              </motion.div>
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-700">
                  {language === 'es' ? 'Mi Meta' : 'Meu Desafio'}
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tighter leading-none">
                  {goal.title}
                </h2>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                  {goal.startAmount
                    ? `${formatCurrency(goal.startAmount, currency)} • ${totalSquaresCount} Depósitos`
                    : `${totalSquaresCount} Depósitos`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={onAddAvulsoClick}
                className="px-4 py-2.5 text-[10px] font-black text-amber-700 bg-amber-50 border border-amber-200 rounded-xl transition-all cursor-pointer flex items-center gap-2 uppercase tracking-widest"
              >
                <Zap className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                <span>Monto Extra</span>
              </motion.button>
              
              <button
                type="button"
                onClick={onEditGoalClick}
                className="p-2.5 rounded-xl bg-white/80 text-slate-500 hover:text-slate-900 border border-slate-200/80 transition-all cursor-pointer"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Key Metric Numbers */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-3xl glass-card border border-white/80 space-y-4">
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                <Target className="w-4 h-4 text-slate-500" />
                {language === 'es' ? 'Monto de la Meta' : 'Valor da Meta'}
              </div>
              <div className="text-2xl font-black text-slate-900 font-mono-numbers tracking-tighter">
                {formatCurrency(targetAmount, currency)}
              </div>
            </div>

            <div className="p-5 rounded-3xl glass-emerald border border-emerald-500/20 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 text-[10px] font-black text-emerald-800 uppercase tracking-widest">
                <PiggyBank className="w-4 h-4" />
                {language === 'es' ? 'Total Ahorrado' : 'Total Acumulado'}
              </div>
              <div className="text-2xl font-black text-emerald-800 font-mono-numbers tracking-tighter">
                {formatCurrency(savedAmount, currency)}
              </div>
            </div>

            <div className="p-5 rounded-3xl glass-card border border-white/80 space-y-4">
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                <Clock className="w-4 h-4" />
                {language === 'es' ? 'Monto Restante' : 'Faltam'}
              </div>
              <div className="text-2xl font-black text-slate-900 font-mono-numbers tracking-tighter">
                {formatCurrency(remainingAmount, currency)}
              </div>
            </div>
          </div>

          {/* Dual Progress Bars */}
          <div className="space-y-6 pt-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                <span className="text-emerald-700 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Progresso Financeiro
                </span>
                <span className="text-slate-900 font-mono-numbers">
                  {financialProgressPercent.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 w-full bg-[#D1FAEB]/80 rounded-full overflow-hidden border border-emerald-500/20">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, Math.max(0, financialProgressPercent))}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                <span className="text-teal-700 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" /> Depósitos Realizados
                </span>
                <span className="text-slate-900 font-mono-numbers">
                  {completedSquaresCount} / {totalSquaresCount}
                </span>
              </div>
              <div className="h-2 w-full bg-[#D1FAEB]/80 rounded-full overflow-hidden border border-emerald-500/20">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, Math.max(0, squaresProgressPercent))}%` }}
                  transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                  className="h-full bg-teal-500 rounded-full shadow-[0_0_15px_rgba(20,184,166,0.3)]"
                />
              </div>
            </div>
          </div>

          <AnimatePresence>
            {isFinished && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-6 p-6 rounded-[2rem] bg-emerald-600 text-white shadow-2xl shadow-emerald-600/20 flex items-center gap-5 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                <span className="text-4xl relative z-10">🏆</span>
                <div className="relative z-10 space-y-1">
                  <p className="font-black text-lg tracking-tight uppercase">Meta Concluída!</p>
                  <p className="text-xs font-bold text-emerald-100 uppercase tracking-widest">
                    Você poupou {formatCurrency(targetAmount, currency)} com sucesso.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
