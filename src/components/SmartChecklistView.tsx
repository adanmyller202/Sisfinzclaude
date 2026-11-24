import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  CheckSquare,
  Plus,
  RotateCcw,
  Trash2,
  Check,
  Sparkles,
  Backpack,
  ShoppingCart,
  Home,
  Plane,
  X,
} from 'lucide-react';
import { LanguageCode } from '../types';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { FinzyMascot } from './FinzyMascot';
import { getSavedFinzySkinId } from '../utils/finzyLiving';

export interface ReusableChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

export interface ReusableChecklist {
  id: string;
  title: string;
  icon: 'backpack' | 'cart' | 'home' | 'plane' | 'sparkles';
  items: ReusableChecklistItem[];
  updatedAt: string;
}

interface SmartChecklistViewProps {
  isOpen: boolean;
  onClose: () => void;
  language?: LanguageCode;
}

const STORAGE_PREFIX = 'sisfinz_smart_checklists_v1_';

function createDefaultChecklists(lang: LanguageCode): ReusableChecklist[] {
  const now = new Date().toISOString();
  const isEs = lang === 'es';
  return [
    {
      id: 'tpl_mochila',
      title: isEs ? 'Mochila del Turno / Día' : 'Mochila do Dia / Turno',
      icon: 'backpack',
      updatedAt: now,
      items: [
        { id: 'm_1', label: isEs ? 'Botella de agua' : 'Garrafa d’água', checked: false },
        { id: 'm_2', label: isEs ? 'Cargador / batería' : 'Carregador / bateria', checked: false },
        { id: 'm_3', label: isEs ? 'Documento y tarjeta' : 'Documento e cartão', checked: false },
        { id: 'm_4', label: isEs ? 'Colación / snack' : 'Lanche rápido', checked: false },
      ],
    },
    {
      id: 'tpl_casa',
      title: isEs ? 'Antes de Salir de Casa' : 'Antes de Sair de Casa',
      icon: 'home',
      updatedAt: now,
      items: [
        { id: 'c_1', label: isEs ? 'Llaves y celular' : 'Chaves e celular', checked: false },
        { id: 'c_2', label: isEs ? 'Luces / hornallas revisadas' : 'Luzes e fogão conferidos', checked: false },
        { id: 'c_3', label: isEs ? 'Abrigo / capa' : 'Casaco / blusa', checked: false },
      ],
    },
    {
      id: 'tpl_mercado',
      title: isEs ? 'Compras del Mercado' : 'Compras do Mercado',
      icon: 'cart',
      updatedAt: now,
      items: [
        { id: 'mk_1', label: isEs ? 'Frutas y verduras' : 'Frutas e verduras', checked: false },
        { id: 'mk_2', label: isEs ? 'Lácteos y huevos' : 'Laticínios e ovos', checked: false },
        { id: 'mk_3', label: isEs ? 'Limpieza e higiene' : 'Limpeza e higiene', checked: false },
        { id: 'mk_4', label: isEs ? 'Bolsas reutilizables' : 'Sacolas retornáveis', checked: false },
      ],
    },
    {
      id: 'tpl_viagem',
      title: isEs ? 'Maleta de Viaje' : 'Mala de Viagem',
      icon: 'plane',
      updatedAt: now,
      items: [
        { id: 'v_1', label: isEs ? 'Documentos y pasajes' : 'Documentos e passagens', checked: false },
        { id: 'v_2', label: isEs ? 'Ropa y calzado' : 'Roupas e calçados', checked: false },
        { id: 'v_3', label: isEs ? 'Neceser de higiene' : 'Necessaire de higiene', checked: false },
      ],
    },
  ];
}

function renderListIcon(icon: ReusableChecklist['icon'], className = 'h-4 w-4') {
  switch (icon) {
    case 'backpack':
      return <Backpack className={className} />;
    case 'cart':
      return <ShoppingCart className={className} />;
    case 'home':
      return <Home className={className} />;
    case 'plane':
      return <Plane className={className} />;
    default:
      return <Sparkles className={className} />;
  }
}

export const SmartChecklistView: React.FC<SmartChecklistViewProps> = ({
  isOpen,
  onClose,
  language = 'pt',
}) => {
  const { user } = useAuth();
  const isEs = language === 'es';
  const skinId = getSavedFinzySkinId();
  const storageKey = `${STORAGE_PREFIX}${user?.uid || 'guest'}`;

  const [lists, setLists] = useState<ReusableChecklist[]>(() => {
    if (typeof window === 'undefined') return createDefaultChecklists(language);
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return createDefaultChecklists(language);
  });

  const [selectedListId, setSelectedListId] = useState<string>(() => lists[0]?.id || 'tpl_mochila');
  const [newItemText, setNewItemText] = useState('');
  const [isCreateListOpen, setIsCreateListOpen] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');
  const [newListIcon, setNewListIcon] = useState<ReusableChecklist['icon']>('sparkles');
  const [lastBackupBeforeReset, setLastBackupBeforeReset] = useState<ReusableChecklist | null>(null);

  // Sync with Firestore when authenticated
  useEffect(() => {
    if (!user?.uid) return;
    const docRef = doc(db, 'users', user.uid, 'settings', 'smart_checklists');
    const unsub = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (Array.isArray(data?.lists) && data.lists.length > 0) {
            setLists(data.lists);
            try {
              localStorage.setItem(storageKey, JSON.stringify(data.lists));
            } catch {
              // ignore
            }
          }
        }
      },
      () => {}
    );
    return () => unsub();
  }, [user?.uid, storageKey]);

  useEffect(() => {
    if (!lists.some((l) => l.id === selectedListId) && lists[0]) {
      setSelectedListId(lists[0].id);
    }
  }, [lists, selectedListId]);

  const persistLists = useCallback(
    async (next: ReusableChecklist[]) => {
      setLists(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // ignore
      }
      if (user?.uid) {
        try {
          await setDoc(
            doc(db, 'users', user.uid, 'settings', 'smart_checklists'),
            { lists: JSON.parse(JSON.stringify(next)), updatedAt: new Date().toISOString() },
            { merge: true }
          );
        } catch {
          // ignore offline error
        }
      }
    },
    [storageKey, user?.uid]
  );

  const activeList = useMemo(
    () => lists.find((l) => l.id === selectedListId) || lists[0] || null,
    [lists, selectedListId]
  );

  const totalCount = activeList?.items.length || 0;
  const checkedCount = activeList?.items.filter((i) => i.checked).length || 0;
  const progressPct = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;
  const isComplete100 = totalCount > 0 && checkedCount === totalCount;

  const handleToggleItem = async (itemId: string) => {
    if (!activeList) return;
    setLastBackupBeforeReset(null);
    const next = lists.map((l) => {
      if (l.id !== activeList.id) return l;
      return {
        ...l,
        updatedAt: new Date().toISOString(),
        items: l.items.map((it) => (it.id === itemId ? { ...it, checked: !it.checked } : it)),
      };
    });
    await persistLists(next);
  };

  const handleResetAllItems = async () => {
    if (!activeList) return;
    setLastBackupBeforeReset(activeList);
    const next = lists.map((l) => {
      if (l.id !== activeList.id) return l;
      return {
        ...l,
        updatedAt: new Date().toISOString(),
        items: l.items.map((it) => ({ ...it, checked: false })),
      };
    });
    await persistLists(next);
  };

  const handleUndoReset = async () => {
    if (!lastBackupBeforeReset) return;
    const next = lists.map((l) =>
      l.id === lastBackupBeforeReset.id ? lastBackupBeforeReset : l
    );
    setLastBackupBeforeReset(null);
    await persistLists(next);
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeList || !newItemText.trim()) return;
    const clean = newItemText.trim();
    setNewItemText('');
    const next = lists.map((l) => {
      if (l.id !== activeList.id) return l;
      return {
        ...l,
        updatedAt: new Date().toISOString(),
        items: [
          ...l.items,
          {
            id: `chk_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
            label: clean,
            checked: false,
          },
        ],
      };
    });
    await persistLists(next);
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!activeList) return;
    const next = lists.map((l) => {
      if (l.id !== activeList.id) return l;
      return {
        ...l,
        updatedAt: new Date().toISOString(),
        items: l.items.filter((it) => it.id !== itemId),
      };
    });
    await persistLists(next);
  };

  const handleCreateChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListTitle.trim()) return;
    const created: ReusableChecklist = {
      id: `lst_${Date.now()}`,
      title: newListTitle.trim(),
      icon: newListIcon,
      updatedAt: new Date().toISOString(),
      items: [],
    };
    setNewListTitle('');
    setIsCreateListOpen(false);
    setSelectedListId(created.id);
    await persistLists([...lists, created]);
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="smart-checklist-overlay"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ type: 'spring', stiffness: 330, damping: 30 }}
          className="fixed inset-0 z-[58] flex flex-col bg-[#F4F8F6] text-slate-900 overflow-hidden"
        >
          {/* Top Bar */}
          <div
            className="flex items-center justify-between gap-3 border-b border-emerald-100/90 bg-white/95 px-4 py-3 backdrop-blur-md shrink-0"
            style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}
          >
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              {isEs ? 'Volver' : 'Voltar'}
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 text-white shadow-sm">
                <CheckSquare className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-sm font-black tracking-tight text-slate-900">
                  {isEs ? 'Checklists Reutilizables' : 'Checklists Reutilizáveis'}
                </h1>
                <p className="truncate text-[9.5px] font-bold uppercase tracking-wider text-emerald-700">
                  {isEs ? 'Mochila • Mercado • Viaje' : 'Mochila • Mercado • Viagem'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsCreateListOpen(true)}
              className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white shadow-sm hover:bg-emerald-700 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              {isEs ? 'Lista' : 'Lista'}
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="mx-auto max-w-xl space-y-4 pb-16">
              {/* Horizontal List Selector Pills */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {lists.map((lst) => {
                  const isSel = activeList?.id === lst.id;
                  const done = lst.items.filter((x) => x.checked).length;
                  return (
                    <button
                      key={lst.id}
                      type="button"
                      onClick={() => {
                        setSelectedListId(lst.id);
                        setLastBackupBeforeReset(null);
                      }}
                      className={`inline-flex items-center gap-2 rounded-2xl px-3.5 py-2 text-xs font-black whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                        isSel
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                          : 'border border-slate-200 bg-white text-slate-700 hover:border-emerald-300'
                      }`}
                    >
                      {renderListIcon(lst.icon, 'h-3.5 w-3.5')}
                      <span>{lst.title}</span>
                      {lst.items.length > 0 && (
                        <span
                          className={`rounded-full px-1.5 py-0.2 font-mono text-[9.5px] ${
                            isSel ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {done}/{lst.items.length}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {activeList && (
                <>
                  {/* Progress & Finzy Status Card (Clean light sheen on 100%, no confetti) */}
                  <div
                    className={`relative overflow-hidden rounded-[1.75rem] border p-4 transition-all duration-300 ${
                      isComplete100
                        ? 'border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-teal-50/70 shadow-md shadow-emerald-600/10'
                        : 'border-slate-200/80 bg-white shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <FinzyMascot
                          mood={isComplete100 ? 'happy' : 'calm'}
                          routineState={isComplete100 ? 'proud_streak' : 'normal'}
                          skinId={skinId}
                          size={48}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h2 className="truncate text-sm font-black text-slate-900">
                              {activeList.title}
                            </h2>
                            {isComplete100 && (
                              <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-white shrink-0">
                                {isEs ? 'Listo 100%' : 'Pronto 100%'}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] font-semibold text-slate-500">
                            {isComplete100
                              ? isEs
                                ? 'Todo revisado. Puedes resetear para el próximo uso.'
                                : 'Tudo conferido! Toque em resetar quando for usar de novo.'
                              : `${checkedCount} ${isEs ? 'de' : 'de'} ${totalCount} ${
                                  isEs ? 'marcados' : 'marcados'
                                } • ${progressPct}%`}
                          </p>
                        </div>
                      </div>

                      {checkedCount > 0 && (
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.94 }}
                          onClick={handleResetAllItems}
                          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                            isComplete100
                              ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                              : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800'
                          }`}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          {isEs ? 'Resetar' : 'Resetar'}
                        </motion.button>
                      )}
                    </div>

                    {/* Smooth Progress Bar with Elegant Sheen */}
                    <div className="relative mt-3.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <motion.div
                        initial={false}
                        animate={{ width: `${progressPct}%` }}
                        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                        className={`relative h-full rounded-full ${
                          isComplete100
                            ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600'
                            : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                        }`}
                      >
                        {isComplete100 && (
                          <motion.span
                            initial={{ x: '-100%' }}
                            animate={{ x: '220%' }}
                            transition={{
                              repeat: Infinity,
                              repeatDelay: 2.2,
                              duration: 1.1,
                              ease: 'easeInOut',
                            }}
                            className="absolute inset-y-0 w-10 bg-gradient-to-r from-transparent via-white/60 to-transparent"
                          />
                        )}
                      </motion.div>
                    </div>

                    {lastBackupBeforeReset && (
                      <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2 text-[11px] font-bold text-slate-700">
                        <span>
                          {isEs ? 'Lista reseteada para nuevo uso.' : 'Lista resetada para novo uso.'}
                        </span>
                        <button
                          type="button"
                          onClick={handleUndoReset}
                          className="font-black text-emerald-700 hover:underline cursor-pointer"
                        >
                          {isEs ? 'Deshacer' : 'Desfazer'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Quick Add Item Input */}
                  <form onSubmit={handleAddItem} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newItemText}
                      onChange={(e) => setNewItemText(e.target.value)}
                      placeholder={
                        isEs
                          ? 'Agregar ítem a esta lista...'
                          : 'Adicionar item nesta lista...'
                      }
                      className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-500 shadow-2xs"
                    />
                    <button
                      type="submit"
                      disabled={!newItemText.trim()}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 disabled:opacity-40 cursor-pointer"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </form>

                  {/* Checklist Items */}
                  <div className="space-y-2">
                    {activeList.items.map((item) => (
                      <motion.div
                        key={item.id}
                        layout
                        whileTap={{ scale: 0.985 }}
                        onClick={() => handleToggleItem(item.id)}
                        className={`flex items-center justify-between gap-3 rounded-2xl border p-3.5 transition-all cursor-pointer select-none ${
                          item.checked
                            ? 'border-emerald-200/80 bg-emerald-50/55'
                            : 'border-slate-200/80 bg-white hover:border-emerald-300 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <motion.span
                            animate={{ scale: item.checked ? [1, 1.15, 1] : 1 }}
                            transition={{ duration: 0.22 }}
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                              item.checked
                                ? 'border-emerald-600 bg-emerald-600 text-white'
                                : 'border-slate-300 bg-white text-transparent'
                            }`}
                          >
                            <Check className="h-3.5 w-3.5 stroke-[3]" />
                          </motion.span>
                          <span
                            className={`truncate text-xs sm:text-sm font-bold transition-colors ${
                              item.checked ? 'text-slate-400 line-through' : 'text-slate-900'
                            }`}
                          >
                            {item.label}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteItem(item.id);
                          }}
                          className="rounded-xl p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-colors cursor-pointer shrink-0"
                          aria-label="Excluir item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Create Custom Reusable List Modal */}
          <AnimatePresence>
            {isCreateListOpen && (
              <div className="fixed inset-0 z-[75] flex items-end sm:items-center justify-center p-0 sm:p-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsCreateListOpen(false)}
                  className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs"
                />
                <motion.form
                  initial={{ opacity: 0, y: 32 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 32 }}
                  onSubmit={handleCreateChecklist}
                  className="relative z-10 w-full max-w-sm rounded-t-[2rem] sm:rounded-[2rem] bg-white p-5 shadow-2xl space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-slate-900">
                      {isEs ? 'Nueva Checklist Reutilizable' : 'Nova Checklist Reutilizável'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setIsCreateListOpen(false)}
                      className="rounded-xl p-1 text-slate-400 hover:bg-slate-100 cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <input
                    type="text"
                    required
                    value={newListTitle}
                    onChange={(e) => setNewListTitle(e.target.value)}
                    placeholder={isEs ? 'Ej: Gimnasio, Playa, Trabajo' : 'Ex: Academia, Praia, Turno'}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white"
                  />

                  <div className="flex items-center gap-2">
                    {(['backpack', 'cart', 'home', 'plane', 'sparkles'] as const).map((ic) => (
                      <button
                        key={ic}
                        type="button"
                        onClick={() => setNewListIcon(ic)}
                        className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-all cursor-pointer ${
                          newListIcon === ic
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 bg-white text-slate-500'
                        }`}
                      >
                        {renderListIcon(ic, 'h-4 w-4')}
                      </button>
                    ))}
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-2xl bg-emerald-600 py-3 text-xs font-black uppercase tracking-wider text-white shadow-md hover:bg-emerald-700 cursor-pointer"
                  >
                    {isEs ? 'Crear Lista' : 'Criar Lista'}
                  </button>
                </motion.form>
              </div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
