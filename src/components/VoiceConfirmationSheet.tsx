/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ParsedLancamentoItem } from '../types/voice';
import { AccountItem, CurrencyCode, LanguageCode } from '../types';
import { parseMoneyBR, formatNumberBR } from '../utils/moneyParser';
import {
  X,
  Check,
  AlertTriangle,
  RotateCw,
  Trash2,
  Sparkles,
  ShoppingBag,
  TrendingUp,
  Receipt,
  Calendar,
  CreditCard,
  Layers,
  Mic,
  ArrowRight,
  Info,
} from 'lucide-react';

interface VoiceConfirmationSheetProps {
  isOpen: boolean;
  onClose: () => void;
  rawText: string;
  parsedItems: ParsedLancamentoItem[];
  availableCategories: string[];
  accounts: AccountItem[];
  currency: CurrencyCode;
  language?: LanguageCode;
  onReprocessText: (newText: string) => void;
  onConfirmItems: (items: ParsedLancamentoItem[]) => Promise<void>;
  onCategoryChangePreference?: (description: string, category: string) => void;
}

export const VoiceConfirmationSheet: React.FC<VoiceConfirmationSheetProps> = ({
  isOpen,
  onClose,
  rawText,
  parsedItems,
  availableCategories,
  accounts,
  currency,
  onReprocessText,
  onConfirmItems,
  onCategoryChangePreference,
}) => {
  const [items, setItems] = useState<ParsedLancamentoItem[]>([]);
  const [editingText, setEditingText] = useState(rawText);
  const [isSaving, setIsSaving] = useState(false);
  const [valueInputs, setValueInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    setItems(parsedItems);
    setEditingText(rawText);
    const initialInputs: Record<string, string> = {};
    parsedItems.forEach((it) => {
      if (it.id && it.valor) {
        initialInputs[it.id] = formatNumberBR(it.valor);
      }
    });
    setValueInputs(initialInputs);
  }, [parsedItems, rawText]);

  const handleUpdateItem = (id: string, field: keyof ParsedLancamentoItem, value: any) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          if (field === 'categoria' && onCategoryChangePreference && updated.descricao) {
            onCategoryChangePreference(updated.descricao, value);
          }
          return updated;
        }
        return item;
      })
    );
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSave = async () => {
    if (items.length === 0) return;
    setIsSaving(true);
    try {
      await onConfirmItems(items);
      onClose();
    } catch (err) {
      console.error('Error confirming items:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const currencySymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : 'R$';

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="glass-overlay flex items-end sm:items-center justify-center p-4 overflow-hidden pt-safe pb-safe"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 50 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="glass-modal w-full sm:max-w-2xl rounded-[2.5rem] border border-purple-500/20 flex flex-col max-h-[90dvh] overflow-hidden relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Mesh Gradient */}
            <div className="relative p-6 sm:p-8 shrink-0 overflow-hidden">
              <div className="absolute inset-0 mesh-gradient opacity-20 from-purple-500/40" />
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-5">
                  <motion.div 
                    initial={{ rotate: -15, scale: 0.8 }}
                    animate={{ rotate: 0, scale: 1 }}
                    className="w-14 h-14 rounded-[1.25rem] bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shadow-inner border border-purple-500/20"
                  >
                    <Sparkles className="w-7 h-7" />
                  </motion.div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 leading-tight tracking-tight uppercase">
                      Lançamento por Voz
                    </h3>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-1">
                      IA FINANCEIRA EM TEMPO REAL
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 hover:text-slate-900 hover:bg-slate-200 transition-all cursor-pointer flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 no-scrollbar overscroll-contain">
              
              {/* Transcript Correction Card */}
              <div className="p-6 rounded-[2rem] bg-purple-500/5 border border-purple-500/10 shadow-inner space-y-4">
                <label className="text-[10px] font-black text-purple-600 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Mic className="w-3.5 h-3.5" /> TRANSCRIÇÃO DA VOZ
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    placeholder="Ex: Almoço 35 reais no cartão hoje"
                    className="flex-1 text-sm font-bold px-5 py-4 rounded-2xl bg-white/80 border border-purple-500/20 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500/30 transition-all"
                  />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={() => onReprocessText(editingText)}
                    className="h-14 px-6 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-purple-600/20 transition-all cursor-pointer flex items-center gap-2 shrink-0"
                  >
                    <RotateCw className="w-4 h-4" />
                    <span className="hidden sm:inline">REPROCESSAR</span>
                  </motion.button>
                </div>
              </div>

              {items.length === 0 ? (
                <div className="py-16 text-center space-y-4">
                  <div className="w-20 h-20 rounded-[2rem] bg-emerald-50 flex items-center justify-center mx-auto opacity-50 border border-emerald-200/50">
                     <AlertTriangle className="w-10 h-10 text-emerald-600" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-black text-slate-900 uppercase tracking-tight">Nenhum dado extraído</p>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Tente ajustar a frase acima ou fale novamente.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between px-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">ITENS DETECTADOS ({items.length})</span>
                  </div>

                  <AnimatePresence mode="popLayout">
                    {items.map((item, idx) => {
                      const isLowConfidence = item.confianca < 0.7 || !item.valor || item.valor <= 0;
                      return (
                        <motion.div
                          key={item.id || idx}
                          layout
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ delay: idx * 0.05 }}
                          className={`p-6 rounded-[2.5rem] border relative overflow-hidden transition-all ${
                            isLowConfidence
                              ? 'bg-amber-500/5 border-amber-500/20 shadow-inner'
                              : 'bg-white/80 border-slate-200/80 shadow-xs'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                              <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200/60 flex items-center justify-center text-[10px] font-black">
                                {idx + 1}
                              </span>
                              <div className="flex p-1 rounded-xl bg-[#D1FAEB]/60 border border-emerald-500/20 backdrop-blur-sm">
                                {[
                                  { id: 'despesa', icon: ShoppingBag, color: 'rose' },
                                  { id: 'receita', icon: TrendingUp, color: 'emerald' },
                                  { id: 'fatura', icon: Receipt, color: 'blue' }
                                ].map(type => (
                                  <button
                                    key={type.id}
                                    type="button"
                                    onClick={() => handleUpdateItem(item.id, 'tipo', type.id)}
                                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer relative z-10 flex items-center gap-1.5 ${
                                      item.tipo === type.id ? 'text-white' : 'text-slate-500 hover:text-slate-900'
                                    }`}
                                  >
                                    {item.tipo === type.id && (
                                       <motion.div layoutId={`type-bg-${item.id}`} className={`absolute inset-0 bg-${type.color}-600 rounded-lg shadow-lg shadow-${type.color}-600/20`} />
                                    )}
                                    <type.icon className="w-3 h-3 relative z-10" />
                                    <span className="relative z-10 hidden sm:inline">{type.id}</span>
                                  </button>
                                ))}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer flex items-center justify-center"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {isLowConfidence && (
                            <div className="mb-6 flex items-center gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-[10px] font-black uppercase tracking-widest">
                              <AlertTriangle className="w-4 h-4 shrink-0" />
                              <span>CONFIANÇA BAIXA: REVISE OS VALORES</span>
                            </div>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">DESCRIÇÃO</label>
                              <input
                                type="text"
                                value={item.descricao}
                                onChange={(e) => handleUpdateItem(item.id, 'descricao', e.target.value)}
                                className="w-full text-xs font-black px-4 py-3 rounded-xl bg-white/80 border border-slate-200/80 text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-purple-500/30"
                              />
                            </div>

                            <div className="space-y-2">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">VALOR ({currencySymbol})</label>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={valueInputs[item.id] !== undefined ? valueInputs[item.id] : item.valor ? formatNumberBR(item.valor) : ''}
                                onChange={(e) => {
                                  const rawVal = e.target.value;
                                  setValueInputs((prev) => ({ ...prev, [item.id]: rawVal }));
                                  const parsed = parseMoneyBR(rawVal);
                                  if (parsed !== null && parsed > 0) handleUpdateItem(item.id, 'valor', parsed);
                                }}
                                className="w-full text-xs font-mono-numbers font-black px-4 py-3 rounded-xl bg-white/80 border border-slate-200/80 text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-purple-500/30"
                              />
                            </div>

                            <div className="space-y-2">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">CATEGORIA</label>
                              <select
                                value={item.categoria}
                                onChange={(e) => handleUpdateItem(item.id, 'categoria', e.target.value)}
                                className="w-full text-[10px] font-black uppercase tracking-widest px-3 py-3 rounded-xl bg-white/80 border border-slate-200/80 text-slate-900 focus:outline-hidden appearance-none cursor-pointer"
                              >
                                {availableCategories.map((cat) => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                            </div>

                            <div className="space-y-2">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                                 <Calendar className="w-3 h-3" /> DATA
                              </label>
                              <input
                                type="date"
                                value={item.data}
                                onChange={(e) => handleUpdateItem(item.id, 'data', e.target.value)}
                                className="w-full text-[10px] font-black uppercase tracking-widest px-3 py-3 rounded-xl bg-white/80 border border-slate-200/80 text-slate-900 focus:outline-hidden appearance-none cursor-pointer"
                              />
                            </div>
                          </div>

                          {item.duvidas && item.duvidas.length > 0 && (
                            <div className="mt-6 p-4 rounded-2xl bg-purple-500/5 border border-purple-500/10 text-purple-700 text-[10px] font-bold uppercase tracking-widest flex items-start gap-3">
                               <Info className="w-4 h-4 shrink-0 mt-0.5" />
                               <span>SISTEMA: {item.duvidas.join(' ')}</span>
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="shrink-0 p-8 border-t border-emerald-500/20 bg-white/80 backdrop-blur-2xl flex items-center justify-between gap-6 z-10">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-4 text-[10px] font-black text-slate-500 hover:text-slate-900 uppercase tracking-[0.4em] transition-colors cursor-pointer"
              >
                CANCELAR
              </button>
              
              <motion.button
                whileHover={{ scale: 1.02, x: 5 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={handleSave}
                disabled={items.length === 0 || isSaving}
                className="px-10 py-5 text-[11px] font-black text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl shadow-2xl shadow-purple-600/30 disabled:opacity-50 uppercase tracking-[0.3em] cursor-pointer flex items-center gap-3 transition-all active:scale-95"
              >
                {isSaving ? <RotateCw className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                <span>{isSaving ? 'SALVANDO...' : `CONFIRMAR (${items.length})`}</span>
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
