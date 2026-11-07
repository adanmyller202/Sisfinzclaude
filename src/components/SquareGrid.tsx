import React, { useState, useMemo } from 'react';
import { ChallengeGoal, CurrencyCode, ChallengeSquare, LanguageCode } from '../types';
import { formatCurrency, getGoalSquares } from '../utils/currency';
import { Check, Search, Sparkles, Filter, ChevronLeft, ChevronRight, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SquareGridProps {
  goal: ChallengeGoal;
  currency: CurrencyCode;
  language?: LanguageCode;
  onSquareClick: (squareId: number) => void;
  selectedSquareId: number | null;
  onAddAvulsoClick?: () => void;
}

type FilterType = 'all' | 'pending' | 'completed';

export const SquareGrid: React.FC<SquareGridProps> = ({
  goal,
  currency,
  language = 'pt',
  onSquareClick,
  selectedSquareId,
  onAddAvulsoClick,
}) => {
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState<number>(100);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const allSquares = useMemo(() => getGoalSquares(goal), [goal]);
  const completedSet = useMemo(() => new Set(goal.completedSquares), [goal.completedSquares]);

  const filteredSquares = useMemo(() => {
    let result = allSquares;
    if (filter === 'pending') result = result.filter((s) => !completedSet.has(s.id));
    else if (filter === 'completed') result = result.filter((s) => completedSet.has(s.id));
    if (searchQuery.trim() !== '') {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(s => s.id.toString().includes(q) || s.value.toString().includes(q) || formatCurrency(s.value, currency).toLowerCase().includes(q));
    }
    return result;
  }, [allSquares, completedSet, filter, searchQuery, currency]);

  const totalPages = pageSize === 0 ? 1 : Math.ceil(filteredSquares.length / pageSize);
  const safePage = Math.min(Math.max(1, currentPage), Math.max(1, totalPages));

  const paginatedSquares = useMemo(() => {
    if (pageSize === 0) return filteredSquares;
    return filteredSquares.slice((safePage - 1) * pageSize, safePage * pageSize);
  }, [filteredSquares, safePage, pageSize]);

  const handleSuggestSquare = () => {
    const pending = allSquares.filter((s) => !completedSet.has(s.id));
    if (pending.length === 0) return;
    onSquareClick(pending[Math.floor(Math.random() * pending.length)].id);
  };

  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.005 } } };
  const itemVariants = { hidden: { opacity: 0, scale: 0.9 }, visible: { opacity: 1, scale: 1 } };

  return (
    <div className="p-6 sm:p-8 space-y-8">
      {/* Dynamic Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-3">
            Grade do Desafio
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black text-emerald-400 uppercase tracking-widest">{allSquares.length} Quadrados</span>
          </h3>
          <p className="text-xs font-medium text-slate-500 mt-1 max-w-md">Toque em um quadrado para registrar seu depósito ou use a busca para encontrar valores específicos.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onAddAvulsoClick && (
            <button onClick={onAddAvulsoClick} className="h-10 px-4 rounded-xl glass bg-white/5 border border-amber-500/20 text-amber-400 hover:bg-white/10 transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
              <Zap className="w-3.5 h-3.5 fill-current" /> + Valor Avulso
            </button>
          )}
          <button onClick={handleSuggestSquare} className="h-10 px-4 rounded-xl glass bg-white/5 border border-emerald-500/20 text-emerald-400 hover:bg-white/10 transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5" /> Sugerir
          </button>
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
            <input
              type="text"
              placeholder="Buscar # ou valor..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="h-10 pl-9 pr-4 rounded-xl bg-white/5 border border-white/10 text-white text-[11px] font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 outline-none transition-all placeholder:text-slate-600 w-32 sm:w-48"
            />
          </div>
        </div>
      </div>

      {/* Tabs & Pagination Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div className="flex items-center gap-1 p-1 bg-white/2 rounded-2xl border border-white/5">
          {(['all', 'pending', 'completed'] as const).map(f => (
            <button
              key={f}
              onClick={() => { setFilter(f); setCurrentPage(1); }}
              className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                filter === f ? 'bg-white text-slate-950 shadow-xl' : 'text-slate-500 hover:text-white'
              }`}
            >
              {f === 'all' ? 'Todos' : f === 'pending' ? 'Faltam' : 'Feitos'}
            </button>
          ))}
        </div>

        {pageSize > 0 && totalPages > 1 && (
          <div className="flex items-center gap-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Página {safePage} de {totalPages}</div>
            <div className="flex gap-2">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safePage <= 1} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white disabled:opacity-20 transition-all"><ChevronLeft className="w-5 h-5" /></button>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white disabled:opacity-20 transition-all"><ChevronRight className="w-5 h-5" /></button>
            </div>
          </div>
        )}
      </div>

      {/* Main Grid */}
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2.5">
        {paginatedSquares.map((s) => {
          const isCompleted = completedSet.has(s.id);
          const isSelected = selectedSquareId === s.id;
          return (
            <motion.button
              key={s.id}
              variants={itemVariants}
              whileHover={{ scale: 1.1, zIndex: 10, y: -2 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => onSquareClick(s.id)}
              className={`
                relative h-16 sm:h-20 rounded-2xl border transition-all flex flex-col items-center justify-center gap-1 group overflow-hidden
                ${isCompleted
                  ? 'bg-emerald-600/10 border-emerald-500/50 text-emerald-700 shadow-sm'
                  : isSelected
                    ? 'bg-white text-slate-950 border-white ring-4 ring-emerald-500/20 shadow-2xl'
                    : 'bg-amber-500/10 border-amber-500/50 text-amber-900 hover:border-amber-500/60 hover:bg-amber-500/20'
                }
              `}
            >
              <div className="absolute top-1.5 left-2 text-[8px] font-black opacity-50 uppercase tracking-tighter">#{s.id}</div>
              <div className="text-[11px] sm:text-xs font-black font-mono tracking-tight">{formatCurrency(s.value, currency)}</div>
              {isCompleted ? <Check className="w-3.5 h-3.5 stroke-[3] text-emerald-200 mt-1" /> : <div className="text-[7px] font-black uppercase tracking-widest text-slate-600 group-hover:text-emerald-500 transition-colors">Abrir</div>}
            </motion.button>
          );
        })}
      </motion.div>

      {/* Legend Grid */}
      <div className="flex flex-wrap items-center gap-6 pt-8 border-t border-white/5 opacity-50">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-md bg-white/5 border border-white/10" />
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Pendente</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-md bg-white" />
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Selecionado</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-md bg-emerald-600" />
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Concluído</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-2 py-0.5 rounded-sm bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[8px] font-black uppercase tracking-tighter">Ajuste</div>
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Diferença de Metas</span>
        </div>
      </div>
    </div>
  );
};
