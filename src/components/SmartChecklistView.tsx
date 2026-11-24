import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
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
  ListChecks,
  CircleDashed,
  CheckCircle2,
  SlidersHorizontal,
} from 'lucide-react';
import { LanguageCode } from '../types';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { FinzyMascot } from './FinzyMascot';
import { getSavedFinzySkinId } from '../utils/finzyLiving';

export type ChecklistTag = 'essential' | 'quick' | 'night';

export interface ReusableChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  tag?: ChecklistTag;
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

type StatusFilter = 'all' | 'pending' | 'done';

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
        {
          id: 'm_1',
          label: isEs ? 'Botella de agua' : 'Garrafa d’água',
          checked: false,
          tag: 'essential',
        },
        {
          id: 'm_2',
          label: isEs ? 'Cargador / batería' : 'Carregador / bateria',
          checked: false,
          tag: 'essential',
        },
        {
          id: 'm_3',
          label: isEs ? 'Documento y tarjeta' : 'Documento e cartão',
          checked: false,
          tag: 'essential',
        },
        {
          id: 'm_4',
          label: isEs ? 'Colación / snack' : 'Lanche rápido',
          checked: false,
          tag: 'quick',
        },
      ],
    },
    {
      id: 'tpl_casa',
      title: isEs ? 'Antes de Salir de Casa' : 'Antes de Sair de Casa',
      icon: 'home',
      updatedAt: now,
      items: [
        {
          id: 'c_1',
          label: isEs ? 'Llaves y celular' : 'Chaves e celular',
          checked: false,
          tag: 'essential',
        },
        {
          id: 'c_2',
          label: isEs ? 'Luces / hornallas revisadas' : 'Luzes e fogão conferidos',
          checked: false,
          tag: 'essential',
        },
        {
          id: 'c_3',
          label: isEs ? 'Abrigo / capa' : 'Casaco / blusa',
          checked: false,
          tag: 'night',
        },
      ],
    },
    {
      id: 'tpl_mercado',
      title: isEs ? 'Compras del Mercado' : 'Compras do Mercado',
      icon: 'cart',
      updatedAt: now,
      items: [
        {
          id: 'mk_1',
          label: isEs ? 'Frutas y verduras' : 'Frutas e verduras',
          checked: false,
          tag: 'essential',
        },
        {
          id: 'mk_2',
          label: isEs ? 'Lácteos y huevos' : 'Laticínios e ovos',
          checked: false,
          tag: 'quick',
        },
        {
          id: 'mk_3',
          label: isEs ? 'Limpieza e higiene' : 'Limpeza e higiene',
          checked: false,
          tag: 'quick',
        },
        {
          id: 'mk_4',
          label: isEs ? 'Bolsas reutilizables' : 'Sacolas retornáveis',
          checked: false,
          tag: 'essential',
        },
      ],
    },
    {
      id: 'tpl_viagem',
      title: isEs ? 'Maleta de Viaje' : 'Mala de Viagem',
      icon: 'plane',
      updatedAt: now,
      items: [
        {
          id: 'v_1',
          label: isEs ? 'Documentos y pasajes' : 'Documentos e passagens',
          checked: false,
          tag: 'essential',
        },
        {
          id: 'v_2',
          label: isEs ? 'Ropa y calzado' : 'Roupas e calçados',
          checked: false,
          tag: 'essential',
        },
        {
          id: 'v_3',
          label: isEs ? 'Neceser de higiene' : 'Necessaire de higiene',
          checked: false,
          tag: 'quick',
        },
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

function playTaskTick(done: boolean) {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(done ? 587.33 : 440, now);
    osc.frequency.exponentialRampToValueAtTime(done ? 880 : 330, now + 0.09);
    gain.gain.setValueAtTime(0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
    window.setTimeout(() => ctx.close().catch(() => {}), 220);
  } catch {
    // ignore audio block
  }
}

function triggerSoftHaptic() {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(10);
    } catch {
      // ignore
    }
  }
}

export const SmartChecklistView: React.FC<SmartChecklistViewProps> = ({
  isOpen,
  onClose,
  language = 'pt',
}) => {
  const { user } = useAuth();
  const reduceMotion = useReducedMotion();
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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [newItemText, setNewItemText] = useState('');
  const [newItemTag, setNewItemTag] = useState<ChecklistTag>('essential');
  const [pulseId, setPulseId] = useState<string | null>(null);
  const [isCreateListOpen, setIsCreateListOpen] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');
  const [newListIcon, setNewListIcon] = useState<ReusableChecklist['icon']>('backpack');
  const [lastBackupBeforeReset, setLastBackupBeforeReset] = useState<ReusableChecklist | null>(null);

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
  const pendingCount = Math.max(0, totalCount - checkedCount);
  const progressPct = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;
  const isComplete100 = totalCount > 0 && checkedCount === totalCount;

  const visibleItems = useMemo(() => {
    if (!activeList) return [];
    const list = activeList.items;
    if (statusFilter === 'pending') return list.filter((i) => !i.checked);
    if (statusFilter === 'done') return list.filter((i) => i.checked);
    return list;
  }, [activeList, statusFilter]);

  const handleToggleItem = async (itemId: string) => {
    if (!activeList) return;
    const target = activeList.items.find((x) => x.id === itemId);
    const nextChecked = target ? !target.checked : true;
    setLastBackupBeforeReset(null);
    setPulseId(itemId);
    playTaskTick(nextChecked);
    triggerSoftHaptic();
    window.setTimeout(() => {
      setPulseId((curr) => (curr === itemId ? null : curr));
    }, 360);

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

  const handleCycleItemTag = async (itemId: string) => {
    if (!activeList) return;
    const order: ChecklistTag[] = ['essential', 'quick', 'night'];
    const next = lists.map((l) => {
      if (l.id !== activeList.id) return l;
      return {
        ...l,
        updatedAt: new Date().toISOString(),
        items: l.items.map((it) => {
          if (it.id !== itemId) return it;
          const idx = it.tag ? order.indexOf(it.tag) : -1;
          const nextTag = order[(idx + 1) % order.length];
          return { ...it, tag: nextTag };
        }),
      };
    });
    await persistLists(next);
  };

  const handleResetAllItems = async () => {
    if (!activeList) return;
    setLastBackupBeforeReset(activeList);
    playTaskTick(false);
    triggerSoftHaptic();
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
    playTaskTick(true);
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
            tag: newItemTag,
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

  const tagMeta = (tag: ChecklistTag = 'essential') => {
    if (tag === 'quick') {
      return {
        label: isEs ? 'Rápido' : 'Rápido',
        cls: 'bg-sky-100/90 text-sky-800 border-sky-200/80',
      };
    }
    if (tag === 'night') {
      return {
        label: isEs ? 'Turno' : 'Turno',
        cls: 'bg-purple-100/90 text-purple-800 border-purple-200/80',
      };
    }
    return {
      label: isEs ? 'Clave' : 'Essencial',
      cls: 'bg-emerald-100/90 text-emerald-800 border-emerald-200/80',
    };
  };

  const ringR = 25;
  const ringCirc = 2 * Math.PI * ringR;
  const ringDashOffset = ringCirc * (1 - progressPct / 100);

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
            className="flex items-center justify-between gap-2 border-b border-emerald-100/90 bg-white/95 px-3.5 py-3 backdrop-blur-md shrink-0"
            style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}
          >
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors cursor-pointer shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
              {isEs ? 'Volver' : 'Voltar'}
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 text-white shadow-sm shadow-emerald-600/20">
                <CheckSquare className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-sm font-black tracking-tight text-slate-900">
                  {isEs ? 'Checklists Reutilizables' : 'Checklists Reutilizáveis'}
                </h1>
                <p className="truncate text-[9.5px] font-bold uppercase tracking-wider text-emerald-700">
                  {isEs ? 'Todas las listas visibles • Reset 1 toque' : 'Todas as listas visíveis • Reset 1 toque'}
                </p>
              </div>
            </div>

            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={() => setIsCreateListOpen(true)}
              className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-3 py-2 text-xs font-black text-white shadow-sm shadow-emerald-600/25 hover:opacity-95 cursor-pointer shrink-0"
            >
              <Plus className="h-4 w-4 stroke-[2.6]" />
              {isEs ? 'Lista' : 'Lista'}
            </motion.button>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto px-3.5 py-3.5">
            <div className="mx-auto max-w-xl space-y-3.5 pb-16">
              {/* All Lists Exposed in a Responsive 2-Column Grid (Zero Hidden Horizontal Scroll!) */}
              <div className="grid grid-cols-2 gap-2">
                {lists.map((lst) => {
                  const isSel = activeList?.id === lst.id;
                  const done = lst.items.filter((x) => x.checked).length;
                  const total = lst.items.length;
                  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                  const allDone = total > 0 && done === total;

                  return (
                    <motion.button
                      key={lst.id}
                      type="button"
                      whileHover={!reduceMotion ? { y: -1.5 } : undefined}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        setSelectedListId(lst.id);
                        setStatusFilter('all');
                        setLastBackupBeforeReset(null);
                        playTaskTick(true);
                      }}
                      className={`relative isolate flex flex-col justify-between gap-2 rounded-2xl border p-3 text-left transition-all cursor-pointer overflow-hidden ${
                        isSel
                          ? 'border-emerald-400 bg-gradient-to-br from-emerald-100/90 via-[#E3F9EE] to-teal-100/80 shadow-md shadow-emerald-600/12 ring-2 ring-emerald-400/40'
                          : 'border-slate-200/85 bg-white hover:border-emerald-300 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 w-full">
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl transition-transform ${
                            isSel
                              ? 'bg-emerald-600 text-white shadow-xs scale-105'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {renderListIcon(lst.icon, 'h-3.5 w-3.5')}
                        </span>

                        {total > 0 && (
                          <span
                            className={`rounded-full px-2 py-0.5 font-mono text-[9.5px] font-black shrink-0 ${
                              allDone
                                ? 'bg-emerald-600 text-white'
                                : isSel
                                ? 'bg-emerald-700 text-white'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {done}/{total}
                          </span>
                        )}
                      </div>

                      <div className="w-full min-w-0">
                        <div
                          className={`truncate text-xs font-black ${
                            isSel ? 'text-emerald-950' : 'text-slate-800'
                          }`}
                        >
                          {lst.title}
                        </div>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/80 border border-slate-200/50">
                          <motion.div
                            initial={false}
                            animate={{ width: `${pct}%` }}
                            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                          />
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {activeList && (
                <>
                  {/* Finzy Station Hero with Circular Ring & Live Linear Progress */}
                  <div
                    className={`relative overflow-hidden rounded-[2rem] border p-4 transition-all duration-300 ${
                      isComplete100
                        ? 'border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-teal-50/80 shadow-md shadow-emerald-600/10'
                        : 'border-emerald-200/75 bg-gradient-to-br from-white via-emerald-50/35 to-white shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white border border-emerald-100 shadow-xs">
                          <FinzyMascot
                            mood={isComplete100 ? 'happy' : 'calm'}
                            routineState={isComplete100 ? 'proud_streak' : 'normal'}
                            skinId={skinId}
                            size={46}
                          />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h2 className="truncate text-sm sm:text-base font-black text-slate-900">
                              {activeList.title}
                            </h2>
                            {isComplete100 && (
                              <motion.span
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shrink-0"
                              >
                                {isEs ? '100% Listo' : '100% Pronto'}
                              </motion.span>
                            )}
                          </div>
                          <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                            {isComplete100
                              ? isEs
                                ? '¡Todo listo! Resetea cuando quieras reutilizar.'
                                : 'Tudo pronto! Resete quando for usar de novo.'
                              : `${checkedCount} ${isEs ? 'de' : 'de'} ${totalCount} ${
                                  isEs ? 'listos' : 'concluídos'
                                } • ${pendingCount} ${isEs ? 'pendientes' : 'pendentes'}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="relative flex h-14 w-14 items-center justify-center">
                          <svg className="h-full w-full -rotate-90" viewBox="0 0 64 64">
                            <circle
                              cx="32"
                              cy="32"
                              r={ringR}
                              fill="none"
                              stroke="#e2e8f0"
                              strokeWidth="5"
                            />
                            <motion.circle
                              cx="32"
                              cy="32"
                              r={ringR}
                              fill="none"
                              stroke={isComplete100 ? '#059669' : '#10b981'}
                              strokeWidth="5"
                              strokeLinecap="round"
                              strokeDasharray={ringCirc}
                              initial={{ strokeDashoffset: ringCirc }}
                              animate={{ strokeDashoffset: ringDashOffset }}
                              transition={{ type: 'spring', stiffness: 220, damping: 24 }}
                            />
                          </svg>
                          <span className="font-mono text-[11px] font-black text-emerald-900">
                            {progressPct}%
                          </span>
                        </div>

                        {checkedCount > 0 && (
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.92 }}
                            onClick={handleResetAllItems}
                            className={`inline-flex items-center gap-1 rounded-2xl px-3 py-2.5 text-[10.5px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                              isComplete100
                                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25 hover:bg-emerald-700'
                                : 'border border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50 shadow-2xs'
                            }`}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>{isEs ? 'Resetar' : 'Resetar'}</span>
                          </motion.button>
                        )}
                      </div>
                    </div>

                    <div className="relative mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-200/75 p-0.5">
                      <motion.div
                        initial={false}
                        animate={{ width: `${progressPct}%` }}
                        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                        className="relative h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600"
                      >
                        {isComplete100 && !reduceMotion && (
                          <motion.span
                            initial={{ x: '-120%' }}
                            animate={{ x: '240%' }}
                            transition={{
                              repeat: Infinity,
                              repeatDelay: 2.2,
                              duration: 1.15,
                              ease: 'easeInOut',
                            }}
                            className="absolute inset-y-0 w-12 bg-gradient-to-r from-transparent via-white/70 to-transparent"
                          />
                        )}
                      </motion.div>
                    </div>

                    {lastBackupBeforeReset && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-3 flex items-center justify-between rounded-2xl bg-slate-900/90 px-3.5 py-2 text-[11px] font-bold text-white"
                      >
                        <span>
                          {isEs
                            ? 'Lista reseteada para próximo uso.'
                            : 'Lista resetada para o próximo uso.'}
                        </span>
                        <button
                          type="button"
                          onClick={handleUndoReset}
                          className="rounded-lg bg-emerald-500 px-2.5 py-1 text-[10px] font-black uppercase text-white hover:bg-emerald-400 cursor-pointer"
                        >
                          {isEs ? 'Deshacer' : 'Desfazer'}
                        </button>
                      </motion.div>
                    )}
                  </div>

                  {/* Quick Add Item Dock with Tag Selector */}
                  <form
                    onSubmit={handleAddItem}
                    className="rounded-2xl border border-slate-200/80 bg-white p-2.5 shadow-2xs space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newItemText}
                        onChange={(e) => setNewItemText(e.target.value)}
                        placeholder={
                          isEs
                            ? 'Nuevo ítem (ej: cargador, café, llaves)...'
                            : 'Novo item (ex: carregador, café, chaves)...'
                        }
                        className="flex-1 min-w-0 rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/30"
                      />
                      <motion.button
                        type="submit"
                        whileTap={{ scale: 0.92 }}
                        disabled={!newItemText.trim()}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 disabled:opacity-40 cursor-pointer"
                      >
                        <Plus className="h-5 w-5 stroke-[2.6]" />
                      </motion.button>
                    </div>

                    <div className="flex items-center justify-between gap-2 px-1">
                      <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400">
                        {isEs ? 'Etiqueta:' : 'Tipo do item:'}
                      </span>
                      <div className="flex items-center gap-1">
                        {(['essential', 'quick', 'night'] as const).map((tg) => {
                          const meta = tagMeta(tg);
                          const active = newItemTag === tg;
                          return (
                            <button
                              key={tg}
                              type="button"
                              onClick={() => setNewItemTag(tg)}
                              className={`rounded-lg px-2 py-0.5 text-[9.5px] font-black transition-all cursor-pointer ${
                                active
                                  ? 'bg-slate-900 text-white shadow-2xs'
                                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                              }`}
                            >
                              {meta.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </form>

                  {/* Filter Pills (All / Pending / Done) */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 rounded-2xl bg-white/85 p-1 border border-slate-200/70">
                      {(
                        [
                          { id: 'all', label: isEs ? 'Todos' : 'Todos', count: totalCount },
                          {
                            id: 'pending',
                            label: isEs ? 'Pendientes' : 'Pendentes',
                            count: pendingCount,
                          },
                          { id: 'done', label: isEs ? 'Listos' : 'Feitos', count: checkedCount },
                        ] as const
                      ).map((f) => {
                        const active = statusFilter === f.id;
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setStatusFilter(f.id)}
                            className={`rounded-xl px-2.5 py-1 text-[10px] font-black transition-all cursor-pointer ${
                              active
                                ? 'bg-emerald-600 text-white shadow-2xs'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {f.label} ({f.count})
                          </button>
                        );
                      })}
                    </div>

                    <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-slate-400">
                      <SlidersHorizontal className="h-3 w-3" />
                      {isEs ? 'Toca etiqueta para cambiar' : 'Toque na etiqueta'}
                    </span>
                  </div>

                  {/* Animated Interactive Checklist Cards */}
                  <div className="space-y-2">
                    <AnimatePresence initial={false} mode="popLayout">
                      {visibleItems.length === 0 ? (
                        <motion.div
                          key="empty-filter"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-7 text-center space-y-2"
                        >
                          <Sparkles className="mx-auto h-6 w-6 text-emerald-500" />
                          <div className="text-xs font-black text-slate-700">
                            {statusFilter === 'pending'
                              ? isEs
                                ? '¡No quedan ítems pendientes!'
                                : 'Nenhum item pendente por aqui!'
                              : statusFilter === 'done'
                              ? isEs
                                ? 'Aún no marcaste ningún ítem.'
                                : 'Nenhum item marcado ainda.'
                              : isEs
                              ? 'Lista vacía. Agrega tu primer ítem arriba.'
                              : 'Lista vazia. Adicione seu primeiro item acima.'}
                          </div>
                        </motion.div>
                      ) : (
                        visibleItems.map((item, idx) => {
                          const tMeta = tagMeta(item.tag);
                          const isPulsing = pulseId === item.id;

                          return (
                            <motion.div
                              key={item.id}
                              layout
                              initial={{ opacity: 0, y: 12, scale: 0.97 }}
                              animate={{
                                opacity: 1,
                                y: 0,
                                scale: isPulsing ? 1.02 : 1,
                              }}
                              exit={{ opacity: 0, scale: 0.95, x: -16 }}
                              transition={{
                                delay: Math.min(idx * 0.03, 0.2),
                                type: 'spring',
                                stiffness: 380,
                                damping: 26,
                              }}
                              whileHover={!reduceMotion ? { y: -1.5 } : undefined}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => handleToggleItem(item.id)}
                              className={`group relative overflow-hidden flex items-center justify-between gap-2.5 rounded-2xl border p-3.5 transition-colors cursor-pointer select-none ${
                                item.checked
                                  ? 'border-emerald-200/90 bg-gradient-to-r from-emerald-50/85 to-teal-50/45'
                                  : 'border-slate-200/85 bg-white hover:border-emerald-300 shadow-2xs'
                              }`}
                            >
                              <span
                                className={`absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r-full transition-all ${
                                  item.checked
                                    ? 'bg-emerald-500'
                                    : 'bg-slate-200 group-hover:bg-emerald-400'
                                }`}
                              />

                              <div className="flex items-center gap-3 min-w-0 pl-1.5 flex-1">
                                <motion.span
                                  animate={{
                                    scale: item.checked ? [1, 1.22, 1] : 1,
                                    rotate: item.checked ? [0, -10, 0] : 0,
                                  }}
                                  transition={{ duration: 0.28 }}
                                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border transition-all ${
                                    item.checked
                                      ? 'border-emerald-600 bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm shadow-emerald-600/25'
                                      : 'border-slate-300 bg-slate-50 text-slate-400 group-hover:border-emerald-400 group-hover:text-emerald-600'
                                  }`}
                                >
                                  {item.checked ? (
                                    <Check className="h-4 w-4 stroke-[3]" />
                                  ) : (
                                    <CircleDashed className="h-3.5 w-3.5" />
                                  )}
                                </motion.span>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                      className={`truncate text-xs sm:text-sm font-black transition-all ${
                                        item.checked
                                          ? 'text-slate-400 line-through decoration-emerald-500/70 decoration-2'
                                          : 'text-slate-900'
                                      }`}
                                    >
                                      {item.label}
                                    </span>

                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCycleItemTag(item.id);
                                      }}
                                      title={
                                        isEs ? 'Cambiar etiqueta' : 'Trocar tipo do item'
                                      }
                                      className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wide transition-transform active:scale-95 cursor-pointer ${tMeta.cls}`}
                                    >
                                      {tMeta.label}
                                    </button>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {item.checked && (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 hidden xs:block" />
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteItem(item.id);
                                  }}
                                  className="rounded-xl p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-colors cursor-pointer"
                                  aria-label="Excluir item"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </motion.div>
                          );
                        })
                      )}
                    </AnimatePresence>
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
                    <div className="flex items-center gap-2">
                      <ListChecks className="h-4 w-4 text-emerald-600" />
                      <h3 className="text-sm font-black text-slate-900">
                        {isEs ? 'Nueva Checklist Reutilizable' : 'Nova Checklist Reutilizável'}
                      </h3>
                    </div>
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
                    placeholder={
                      isEs ? 'Ej: Gimnasio, Playa, Trabajo' : 'Ex: Academia, Praia, Turno'
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white"
                  />

                  <div className="space-y-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      {isEs ? 'Ícono de la lista' : 'Ícone da lista'}
                    </span>
                    <div className="flex items-center gap-2">
                      {(['backpack', 'cart', 'home', 'plane', 'sparkles'] as const).map((ic) => (
                        <button
                          key={ic}
                          type="button"
                          onClick={() => setNewListIcon(ic)}
                          className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-all cursor-pointer ${
                            newListIcon === ic
                              ? 'border-emerald-600 bg-emerald-50 text-emerald-700 shadow-2xs'
                              : 'border-slate-200 bg-white text-slate-500'
                          }`}
                        >
                          {renderListIcon(ic, 'h-4 w-4')}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 py-3 text-xs font-black uppercase tracking-wider text-white shadow-md hover:opacity-95 cursor-pointer"
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
