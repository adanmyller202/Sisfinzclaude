/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CategoryScope, LanguageCode, CustomCategory } from '../types';
import { DisplayCategory } from '../hooks/useCategories';
import { getTranslations } from '../utils/i18n';
import {
  Tag,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Filter,
  Layers,
  RotateCcw,
  Palette,
  ChevronRight,
} from 'lucide-react';

interface CategoryManagerProps {
  language?: LanguageCode;
  allCategories: DisplayCategory[];
  onAddCategory: (name: string, scope: CategoryScope, color?: string) => Promise<CustomCategory>;
  onUpdateCategory: (id: string, partial: { name?: string; scope?: CategoryScope; color?: string }) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
  onResetPredefined?: () => Promise<void>;
}

const PRESET_COLORS = [
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#f43f5e', // Rose
  '#f59e0b', // Amber
  '#06b6d4', // Cyan
  '#8b5cf6', // Violet
  '#3b82f6', // Blue
  '#ec4899', // Pink
];

export const CategoryManager: React.FC<CategoryManagerProps> = ({
  language = 'pt',
  allCategories,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onResetPredefined,
}) => {
  const t = getTranslations(language);

  const [activeFilter, setActiveFilter] = useState<'all' | 'bill' | 'income' | 'expense'>('all');
  const [name, setName] = useState('');
  const [scope, setScope] = useState<CategoryScope>('all');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit mode
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editScope, setEditScope] = useState<CategoryScope>('all');
  const [editColor, setEditColor] = useState(PRESET_COLORS[0]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError(t.categoryNameRequired);
      return;
    }

    try {
      setIsSubmitting(true);
      await onAddCategory(name.trim(), scope, selectedColor);
      setName('');
      setScope('all');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error adding category.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (cat: DisplayCategory) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditScope(cat.scope);
    setEditColor(cat.color || PRESET_COLORS[0]);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const saveEdit = async (id: string) => {
    if (!editName.trim()) return;
    try {
      await onUpdateCategory(id, {
        name: editName.trim(),
        scope: editScope,
        color: editColor,
      });
      setEditingId(null);
    } catch (err) {
      console.error('Error saving edited category:', err);
    }
  };

  const filteredCategories = React.useMemo(() => {
    return allCategories.filter((c) => {
      if (activeFilter === 'all') return true;
      return c.scope === 'all' || c.scope === activeFilter;
    });
  }, [allCategories, activeFilter]);

  const getScopeLabel = (s: CategoryScope) => {
    switch (s) {
      case 'bill':
        return t.scopeBill;
      case 'income':
        return t.scopeIncome;
      case 'expense':
        return t.scopeExpense;
      default:
        return t.scopeAll;
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel rounded-[2.5rem] p-8 sm:p-10 space-y-10 relative overflow-hidden shadow-md"
    >
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-[1.5rem] bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0 shadow-inner border border-indigo-500/20">
            <Tag className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
              {t.categoriesManagerTitle}
            </h3>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">
              SISTEMA DE CLASSIFICAÇÃO INTELIGENTE
            </p>
          </div>
        </div>

        {onResetPredefined && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={() => {
              if (confirm(t.restoreDefaultsConfirm)) {
                onResetPredefined();
              }
            }}
            className="px-5 py-3 rounded-2xl bg-white/70 border border-slate-200 text-[10px] font-black text-slate-600 hover:text-indigo-600 uppercase tracking-widest transition-all cursor-pointer flex items-center gap-2.5 shadow-xs"
          >
            <RotateCcw className="w-4 h-4" />
            <span>RESTAURAR PADRÃO</span>
          </motion.button>
        )}
      </div>

      {/* Add New Category Form */}
      <form
        onSubmit={handleAdd}
        className="p-8 rounded-[2.5rem] bg-[#D1FAEB]/40 border border-emerald-500/20 space-y-8 relative z-10 shadow-xs"
      >
        <div className="flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em] ml-1">
          <Plus className="w-4 h-4" />
          <span>NOVA CATEGORIA</span>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-[11px] font-black uppercase tracking-widest flex items-center gap-3"
          >
            <X className="w-4 h-4" />
            {error}
          </motion.div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-6 space-y-4">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">
              {t.categoryNameLabel}
            </label>
            <input
              type="text"
              required
              placeholder={t.categoryNamePlaceholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-6 py-5 text-sm font-black bg-white/80 border border-slate-200 rounded-[1.25rem] focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 text-slate-900 transition-all placeholder:text-slate-400"
            />
          </div>

          <div className="md:col-span-3 space-y-4">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">
              {t.categoryScopeLabel}
            </label>
            <div className="relative">
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as CategoryScope)}
                className="w-full px-5 py-5 text-xs font-black bg-white/80 border border-slate-200 rounded-[1.25rem] focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 text-slate-900 cursor-pointer transition-all appearance-none uppercase tracking-widest"
              >
                <option value="all">{t.scopeAll}</option>
                <option value="bill">{t.scopeBill}</option>
                <option value="income">{t.scopeIncome}</option>
                <option value="expense">{t.scopeExpense}</option>
              </select>
              <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                 <ChevronRight className="w-4 h-4 rotate-90" />
              </div>
            </div>
          </div>

          <div className="md:col-span-3 flex items-end">
            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="w-full py-5 text-[11px] font-black text-white bg-indigo-600 rounded-[1.25rem] shadow-xl shadow-indigo-600/30 uppercase tracking-[0.3em] cursor-pointer disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              <Check className="w-5 h-5" />
              <span>{isSubmitting ? '...' : t.saveBtn}</span>
            </motion.button>
          </div>
        </div>

        <div className="space-y-5">
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] ml-1">
             <Palette className="w-4 h-4" />
             <span>MARCADOR VISUAL</span>
          </div>
          <div className="flex items-center gap-4 flex-wrap px-1">
            {PRESET_COLORS.map((col) => (
              <motion.button
                key={col}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
                type="button"
                onClick={() => setSelectedColor(col)}
                className={`w-10 h-10 rounded-2xl transition-all cursor-pointer relative shadow-sm border-2 ${
                  selectedColor === col ? 'border-white dark:border-slate-800 ring-4 ring-indigo-500/20' : 'border-transparent opacity-60 hover:opacity-100'
                }`}
                style={{ backgroundColor: col }}
              >
                {selectedColor === col && (
                  <div className="absolute inset-0 flex items-center justify-center text-white">
                    <Check className="w-5 h-5" />
                  </div>
                )}
              </motion.button>
            ))}
          </div>
        </div>
      </form>

      {/* Filter Tabs & Content */}
      <div className="space-y-8">
        <div className="flex items-center gap-4 border-b border-slate-200/50 dark:border-slate-800 pb-6 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] shrink-0 mr-4">
            <Filter className="w-4 h-4" />
            <span>{t.filterLabel}</span>
          </div>
          
          <div className="flex items-center gap-3 shrink-0">
            {[
              { id: 'all', label: t.filterAll, color: 'slate' },
              { id: 'bill', label: t.tabBills, color: 'rose' },
              { id: 'income', label: t.tabIncomes, color: 'emerald' },
              { id: 'expense', label: t.tabExpenses, color: 'amber' },
            ].map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setActiveFilter(filter.id as any)}
                className={`px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all cursor-pointer border ${
                  activeFilter === filter.id
                    ? filter.id === 'all' 
                      ? 'bg-slate-800 text-white border-slate-800 shadow-md'
                      : `bg-${filter.color}-600 text-white border-${filter.color}-600 shadow-xl shadow-${filter.color}-600/20`
                    : 'bg-white/60 text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Categories Grid */}
        <div className="space-y-6">
          <div className="flex items-center justify-between ml-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] flex items-center gap-3">
              <Layers className="w-5 h-5 text-indigo-600" />
              {t.activeCategoriesHeader}
              <span className="bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded-lg border border-emerald-200/60 ml-2 font-black">
                {filteredCategories.length}
              </span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredCategories.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="col-span-full py-16 text-center rounded-[2.5rem] border-2 border-dashed border-slate-200 bg-white/40"
                >
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">{t.noCategoriesForFilter}</p>
                </motion.div>
              ) : (
                filteredCategories.map((cat, idx) => {
                  const isEditing = editingId === cat.id;

                  return (
                    <motion.div
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ type: "spring", damping: 25, stiffness: 350, delay: idx * 0.02 }}
                      key={cat.id}
                      className={`p-6 rounded-[2rem] border transition-all relative overflow-hidden group ${
                        isEditing 
                          ? 'bg-white border-indigo-500 ring-8 ring-indigo-500/5 shadow-2xl z-20 scale-105' 
                          : 'glass-panel border-emerald-500/15 hover:bg-white hover:border-emerald-500/30 shadow-xs'
                      }`}
                    >
                      <div 
                        className="absolute top-0 right-0 w-24 h-24 blur-3xl pointer-events-none opacity-10 transition-opacity group-hover:opacity-20" 
                        style={{ backgroundColor: cat.color || '#6366f1' }}
                      />

                      {isEditing ? (
                        <div className="space-y-5 relative z-10">
                          <div className="space-y-2">
                             <label className="text-[9px] font-black text-indigo-500 uppercase tracking-widest ml-1">NOME DA CATEGORIA</label>
                             <input
                               type="text"
                               autoFocus
                               value={editName}
                               onChange={(e) => setEditName(e.target.value)}
                               className="w-full px-4 py-3 text-xs font-black bg-white border border-indigo-200 rounded-xl text-slate-900 focus:outline-hidden"
                             />
                          </div>
                          <div className="space-y-2">
                             <label className="text-[9px] font-black text-indigo-500 uppercase tracking-widest ml-1">ESCOPO DE USO</label>
                             <select
                               value={editScope}
                               onChange={(e) => setEditScope(e.target.value as CategoryScope)}
                               className="w-full px-3 py-3 text-[10px] font-black uppercase tracking-widest bg-white border border-slate-200 rounded-xl text-slate-900 cursor-pointer"
                             >
                               <option value="all">{t.scopeAll}</option>
                               <option value="bill">{t.scopeBill}</option>
                               <option value="income">{t.scopeIncome}</option>
                               <option value="expense">{t.scopeExpense}</option>
                             </select>
                          </div>
                          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                            <div className="flex items-center gap-2">
                              {PRESET_COLORS.slice(0, 5).map((c) => (
                                <button
                                  key={c}
                                  type="button"
                                  onClick={() => setEditColor(c)}
                                  className={`w-6 h-6 rounded-lg transition-transform ${editColor === c ? 'scale-110 shadow-md ring-2 ring-indigo-500/40 border border-white' : 'opacity-40 hover:opacity-100'}`}
                                  style={{ backgroundColor: c }}
                                />
                              ))}
                            </div>
                            <div className="flex items-center gap-3">
                              <button onClick={cancelEdit} className="p-2.5 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors cursor-pointer">
                                <X className="w-4 h-4" />
                              </button>
                              <button onClick={() => saveEdit(cat.id)} className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 cursor-pointer">
                                <Check className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-5 relative z-10">
                          <div className="flex items-center gap-4 min-w-0">
                            <div 
                              className="w-12 h-12 rounded-2xl shrink-0 shadow-lg flex items-center justify-center border-4 border-white"
                              style={{ 
                                backgroundColor: cat.color || '#6366f1', 
                                boxShadow: `0 10px 20px -5px ${cat.color}40` 
                              }}
                            >
                               <Tag className="w-5 h-5 text-white/90" />
                            </div>
                            <div className="min-w-0 space-y-1">
                              <div className="text-sm font-black text-slate-900 truncate uppercase tracking-tight">
                                {cat.name}
                              </div>
                              <div className="inline-block px-2 py-0.5 rounded-lg bg-emerald-50 text-[9px] font-black text-emerald-800 uppercase tracking-widest border border-emerald-200/60">
                                {getScopeLabel(cat.scope)}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => startEdit(cat)}
                              className="p-2.5 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-500/10 transition-all cursor-pointer bg-white/80 border border-slate-200"
                              title={t.editItem}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`${t.deleteConfirmCategory} "${cat.name}"?`)) {
                                  onDeleteCategory(cat.id);
                                }
                              }}
                              className="p-2.5 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-500/10 transition-all cursor-pointer bg-white/80 border border-slate-200"
                              title={t.deleteItem}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
