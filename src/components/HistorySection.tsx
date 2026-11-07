/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DepositRecord, CurrencyCode } from '../types';
import { formatCurrency, formatHistoryDate } from '../utils/currency';
import { History, Search, ArrowUpDown, RotateCcw, CheckCircle2, Zap, X } from 'lucide-react';

interface HistorySectionProps {
  history: DepositRecord[];
  currency: CurrencyCode;
  onUndoDeposit: (squareNumber: number) => void;
  onUndoAvulsoDeposit?: (recordId: string) => void;
  onSquareClick?: (squareNumber: number) => void;
}

export const HistorySection: React.FC<HistorySectionProps> = ({
  history,
  currency,
  onUndoDeposit,
  onUndoAvulsoDeposit,
  onSquareClick,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'highest' | 'lowest'>('newest');
  const [confirmUndoId, setConfirmUndoId] = useState<string | null>(null);

  const totalAccumulated = useMemo(() => {
    return history.reduce((acc, curr) => acc + curr.amount, 0);
  }, [history]);

  const filteredHistory = useMemo(() => {
    let list = [...history];

    if (searchTerm.trim() !== '') {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(
        (item) =>
          item.squareNumber.toString().includes(q) ||
          item.amount.toString().includes(q) ||
          (item.note && item.note.toLowerCase().includes(q)) ||
          (item.isAvulso && 'avulso'.includes(q))
      );
    }

    switch (sortOrder) {
      case 'newest':
        list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        break;
      case 'oldest':
        list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        break;
      case 'highest':
        list.sort((a, b) => b.amount - a.amount);
        break;
      case 'lowest':
        list.sort((a, b) => a.amount - b.amount);
        break;
    }

    return list;
  }, [history, searchTerm, sortOrder]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel rounded-[2.5rem] p-6 sm:p-8 space-y-8 relative overflow-hidden shadow-md"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-[1.25rem] bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
            <History className="w-6 h-6" />
          </div>
          <div className="space-y-0.5">
            <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
              Histórico de Depósitos
            </h3>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-tight">
              Registro analítico de contribuições
            </p>
          </div>
        </div>

        <div className="p-5 rounded-[2rem] bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 text-right space-y-1 shadow-lg shadow-emerald-500/5">
          <span className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-[0.2em] block">
            Total Acumulado
          </span>
          <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono-numbers tracking-tighter">
            {formatCurrency(totalAccumulated, currency)}
          </div>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block opacity-60">
            {history.length} {history.length === 1 ? 'Lançamento' : 'Lançamentos'}
          </span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 relative z-10">
        <div className="relative flex-1 group">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-emerald-500 transition-colors" />
          <input
            type="text"
            placeholder="Buscar por número, valor ou descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3.5 text-xs font-black bg-white/70 border border-slate-200/80 rounded-2xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 text-slate-900 placeholder:text-slate-400 transition-all"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 bg-white/70 border border-slate-200/80 p-1.5 rounded-2xl shrink-0">
          <div className="flex items-center gap-2 pl-2 pr-1">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ordenar:</span>
          </div>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
            className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest text-slate-700 focus:ring-0 cursor-pointer pr-8"
          >
            <option value="newest">Mais recentes</option>
            <option value="oldest">Mais antigos</option>
            <option value="highest">Maior valor</option>
            <option value="lowest">Menor valor</option>
          </select>
        </div>
      </div>

      {/* List */}
      <div className="relative z-10">
        <AnimatePresence mode="popLayout">
          {filteredHistory.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-16 text-center space-y-4 rounded-[2rem] border-2 border-dashed border-slate-200 bg-white/40"
            >
              <div className="w-16 h-16 rounded-[2rem] bg-slate-100 flex items-center justify-center mx-auto opacity-50">
                <CheckCircle2 className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nenhum registro encontrado</p>
            </motion.div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 no-scrollbar">
              {filteredHistory.map((item, idx) => {
                const isAvulso = Boolean(item.isAvulso);

                return (
                  <motion.div
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(idx * 0.05, 0.5) }}
                    key={item.id}
                    className="p-4 rounded-[2rem] bg-white/80 border border-slate-200/70 shadow-xs flex items-center justify-between group hover:border-emerald-500/40 transition-all"
                  >
                    <div
                      className={`flex items-center gap-4 min-w-0 ${!isAvulso ? 'cursor-pointer' : ''}`}
                      onClick={() => !isAvulso && item.squareNumber && onSquareClick?.(item.squareNumber)}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${isAvulso ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'}`}>
                        {isAvulso ? <Zap className="w-5 h-5 fill-amber-500" /> : <span className="text-xs font-black">✓</span>}
                      </div>

                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-black uppercase tracking-tight ${isAvulso ? 'text-amber-700' : 'text-slate-900'}`}>
                            {isAvulso ? 'Depósito Extra' : `Quadrado #${item.squareNumber}`}
                          </span>
                          <span className="text-emerald-600 font-mono-numbers font-black text-xs">
                            {formatCurrency(item.amount, currency)}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          <span className="font-mono-numbers">{formatHistoryDate(item.timestamp)}</span>
                          {item.note && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-slate-300" />
                              <span className="truncate italic normal-case font-bold opacity-80">"{item.note}"</span>
                            </>
                          )}
                          {isAvulso && (
                            <span className="text-amber-500 ml-1">Recalculado</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 ml-4">
                      <AnimatePresence mode="wait">
                        {confirmUndoId === item.id ? (
                          <motion.div 
                            key="confirm"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="flex items-center gap-2"
                          >
                            <button
                              onClick={() => {
                                if (isAvulso) onUndoAvulsoDeposit?.(item.id);
                                else onUndoDeposit(item.squareNumber);
                                setConfirmUndoId(null);
                              }}
                              className="px-3 py-1.5 text-[9px] font-black text-white bg-rose-600 rounded-lg uppercase tracking-widest shadow-lg shadow-rose-600/20 cursor-pointer"
                            >
                              Confirmar
                            </button>
                            <button
                              onClick={() => setConfirmUndoId(null)}
                              className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-700 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </motion.div>
                        ) : (
                          <motion.button
                            key="action"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            whileHover={{ scale: 1.1, rotate: -10 }}
                            onClick={() => setConfirmUndoId(item.id)}
                            className="p-2.5 rounded-xl bg-slate-100 text-slate-500 hover:text-rose-600 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                            title="Desfazer"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </motion.button>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
