import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LanguageCode } from '../types';
import { useAuth } from '../context/AuthContext';
import { getTranslations } from '../utils/i18n';
import {
  Wallet,
  PiggyBank,
  X,
  Sparkles,
  LogOut,
  ChevronRight,
  PieChart as PieChartIcon,
  Users,
  Award,
  FileText,
  Landmark,
  Calendar,
  Gauge,
  BarChart3,
  Tag,
  Plus,
  ArrowLeft,
  SlidersHorizontal,
  Check,
  Briefcase,
  CheckSquare,
  Bell,
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { LaborAgendaView } from './labor/LaborAgendaView';
import { SmartChecklistView } from './SmartChecklistView';
import { TransactionType } from './TransactionModal';

type DrawerViewId =
  | 'finance'
  | 'planejar'
  | 'goals'
  | 'savings'
  | 'categories'
  | 'report'
  | 'shared_accounts'
  | 'challenge_52'
  | 'full_report'
  | 'accounts'
  | 'financial_calendar'
  | 'freedom'
  | 'daily_pace'
  | 'labor_agenda'
  | 'smart_checklists'
  | 'finzy_reminders';

interface NavigationDrawerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentView: Exclude<
    DrawerViewId,
    'labor_agenda' | 'smart_checklists' | 'finzy_reminders'
  >;
  onChangeView: (view: any) => void;
  goalsCount: number;
  savingsCount: number;
  sharedPendingCount?: number;
  remindersPendingCount?: number;
  onOpenMoneChat: () => void;
  onOpenSettingsModal: () => void;
  onOpenProfileModal: () => void;
  onOpenRemindersModal?: () => void;
  onOpenCalculator?: () => void;
  onOpenQuickTx?: (type: TransactionType) => void;
  onOpenQuickTransfer?: () => void;
  onOpenQuickVoice?: () => void;
  externalChecklistOpen?: boolean;
  onExternalChecklistClose?: () => void;
  language?: LanguageCode;
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
}

interface NavItemDef {
  id: DrawerViewId;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

const STORAGE_KEY_PREFIX = 'sisfinz_drawer_shortcuts_v1_';

export const NavigationDrawerModal: React.FC<NavigationDrawerModalProps> = ({
  isOpen,
  onClose,
  currentView,
  onChangeView,
  savingsCount,
  sharedPendingCount = 0,
  remindersPendingCount = 0,
  onOpenProfileModal,
  onOpenRemindersModal,
  onOpenCalculator,
  onOpenQuickTx,
  onOpenQuickTransfer,
  onOpenQuickVoice,
  externalChecklistOpen = false,
  onExternalChecklistClose,
  language = 'pt',
}) => {
  const t = getTranslations(language);
  const reduceMotion = useReducedMotion();
  const drawerSpring = reduceMotion
    ? { duration: 0.01 }
    : { type: 'spring' as const, stiffness: 285, damping: 22, mass: 0.78 };
  const pillMorphSpring = reduceMotion
    ? { duration: 0.01 }
    : { type: 'spring' as const, stiffness: 430, damping: 28, mass: 0.72 };
  const { user, signOutUser } = useAuth();
  const [pendingView, setPendingView] = useState<string | null>(null);
  const [isManagingShortcuts, setIsManagingShortcuts] = useState(false);
  const [isLaborAgendaOpen, setIsLaborAgendaOpen] = useState(false);
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);
  const selectionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (externalChecklistOpen) {
      setIsChecklistOpen(true);
    }
  }, [externalChecklistOpen]);

  const handleCloseChecklist = () => {
    setIsChecklistOpen(false);
    onExternalChecklistClose?.();
  };

  const storageKey = `${STORAGE_KEY_PREFIX}${user?.uid || 'guest'}`;

  const [enabledShortcuts, setEnabledShortcuts] = useState<DrawerViewId[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed as DrawerViewId[];
      }
    } catch {
      // ignore storage errors
    }
    return [];
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setEnabledShortcuts(parsed as DrawerViewId[]);
          return;
        }
      }
    } catch {
      // ignore storage errors
    }
    setEnabledShortcuts([]);
  }, [storageKey]);

  useEffect(() => {
    const openHandler = () => setIsLaborAgendaOpen(true);
    window.addEventListener('sisfinz:open-labor-agenda', openHandler);
    return () => window.removeEventListener('sisfinz:open-labor-agenda', openHandler);
  }, []);

  const toggleShortcut = (id: DrawerViewId) => {
    setEnabledShortcuts((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  useEffect(() => {
    if (!isOpen) return;
    const body = document.body;
    const html = document.documentElement;
    const scrollY = window.scrollY;
    const previous = {
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
      bodyOverflow: body.style.overflow,
      htmlOverflow: html.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
    };
    body.style.position = 'fixed';
    body.style.top = '-' + scrollY + 'px';
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';

    return () => {
      body.style.position = previous.bodyPosition;
      body.style.top = previous.bodyTop;
      body.style.left = previous.bodyLeft;
      body.style.right = previous.bodyRight;
      body.style.width = previous.bodyWidth;
      body.style.overflow = previous.bodyOverflow;
      html.style.overflow = previous.htmlOverflow;
      html.style.overscrollBehavior = previous.htmlOverscroll;
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      if (selectionTimer.current) clearTimeout(selectionTimer.current);
      selectionTimer.current = null;
      setPendingView(null);
      setIsManagingShortcuts(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isManagingShortcuts) setIsManagingShortcuts(false);
        else onClose();
      }
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isManagingShortcuts, onClose]);

  const handleSelectView = (view: DrawerViewId) => {
    if (pendingView) return;
    if (selectionTimer.current) clearTimeout(selectionTimer.current);
    setPendingView(view);
    selectionTimer.current = setTimeout(() => {
      if (view === 'labor_agenda') {
        onClose();
        setIsLaborAgendaOpen(true);
      } else if (view === 'smart_checklists') {
        onClose();
        setIsChecklistOpen(true);
      } else if (view === 'finzy_reminders') {
        onClose();
        onOpenRemindersModal?.();
      } else {
        onChangeView(view);
        onClose();
      }
      selectionTimer.current = null;
    }, reduceMotion ? 0 : 280);
  };

  const coreItems: NavItemDef[] = useMemo(
    () => [
      {
        id: 'labor_agenda',
        label: language === 'es' ? 'Jornada Laboral' : 'Jornada Laboral',
        desc:
          language === 'es'
            ? 'Turnos, fichaje, sueldo y propinas'
            : 'Turnos, ponto, salário e propinas',
        icon: Briefcase,
      },
      {
        id: 'finzy_reminders',
        label: language === 'es' ? 'Lembretes Importantes' : 'Lembretes Importantes',
        desc:
          language === 'es'
            ? 'Avisos del Finzy, soneca y repetición'
            : 'Avisos do Finzy, soneca e repetição',
        icon: Bell,
        badge: remindersPendingCount,
      },
      {
        id: 'smart_checklists',
        label: language === 'es' ? 'Checklists Reutilizables' : 'Checklists Reutilizáveis',
        desc:
          language === 'es'
            ? 'Mochila, mercado, viaje y reset rápido'
            : 'Mochila, mercado, viagem e reset rápido',
        icon: CheckSquare,
      },
      {
        id: 'daily_pace',
        label: language === 'es' ? 'Ritmo Diario' : 'Ritmo Diário',
        desc: language === 'es' ? 'Límite hasta el salario' : 'Limite até o salário',
        icon: Gauge,
      },
      {
        id: 'shared_accounts',
        label: language === 'es' ? 'Compartidos' : 'Compartilhados',
        desc: language === 'es' ? 'Cuentas en grupo' : 'Contas em grupo',
        icon: Users,
        badge: sharedPendingCount,
      },
    ],
    [language, sharedPendingCount, remindersPendingCount]
  );

  const shortcutCatalog: NavItemDef[] = useMemo(
    () => [
      {
        id: 'finzy_reminders',
        label: language === 'es' ? 'Lembretes Importantes' : 'Lembretes Importantes',
        desc: language === 'es' ? 'Avisos del Finzy' : 'Avisos do Finzy',
        icon: Bell,
        badge: remindersPendingCount,
      },
      {
        id: 'smart_checklists',
        label: language === 'es' ? 'Checklists Reutilizables' : 'Checklists Reutilizáveis',
        desc: language === 'es' ? 'Mochila, mercado y viaje' : 'Mochila, mercado e viagem',
        icon: CheckSquare,
      },
      {
        id: 'challenge_52',
        label: language === 'es' ? 'Mis Frascos' : 'Meus Frascos',
        desc: language === 'es' ? 'Planes semanales de ahorro' : 'Planos semanais de economia',
        icon: Award,
      },
      {
        id: 'savings',
        label: language === 'es' ? 'Alcancías y Reservas' : 'Cofrinhos & Reservas',
        desc: language === 'es' ? 'Metas libres y reservas' : 'Metas livres e reservas',
        icon: PiggyBank,
        badge: savingsCount,
      },
      {
        id: 'planejar',
        label: language === 'es' ? 'Proyección Anual' : 'Projeção Anual',
        desc: language === 'es' ? 'Simulación de 12 meses' : 'Simulação dos próximos 12 meses',
        icon: BarChart3,
      },
      {
        id: 'freedom',
        label: language === 'es' ? 'Escala de Libertad' : 'Escala de Liberdade',
        desc: language === 'es' ? 'Velocímetro de saldo libre' : 'Velocímetro de saldo livre',
        icon: Sparkles,
      },
      {
        id: 'financial_calendar',
        label: language === 'es' ? 'Calendario' : 'Calendário',
        desc: language === 'es' ? 'Agenda de vencimientos' : 'Agenda de vencimentos',
        icon: Calendar,
      },
      {
        id: 'report',
        label: language === 'es' ? 'Percepciones' : 'Percepções',
        desc: language === 'es' ? 'Gastos por categoría' : 'Gráficos e gastos por categoria',
        icon: PieChartIcon,
      },
      {
        id: 'full_report',
        label: language === 'es' ? 'Informe Real' : 'Informe Real',
        desc: language === 'es' ? 'Reporte detallado' : 'Relatório financeiro completo',
        icon: FileText,
      },
      {
        id: 'accounts',
        label: language === 'es' ? 'Cuentas y Saldos' : 'Contas & Saldos',
        desc: language === 'es' ? 'Bancos y efectivo' : 'Bancos e carteiras',
        icon: Landmark,
      },
      {
        id: 'categories',
        label: language === 'es' ? 'Categorías' : 'Categorias',
        desc: language === 'es' ? 'Gestionar etiquetas' : 'Gerenciar rótulos e cores',
        icon: Tag,
      },
      {
        id: 'finance',
        label: t.financialControl,
        desc: language === 'es' ? 'Facturas y gastos del mes' : 'Faturas e despesas do mês',
        icon: Wallet,
      },
    ],
    [language, savingsCount, remindersPendingCount, t.financialControl]
  );

  const activeShortcutItems = useMemo(
    () =>
      enabledShortcuts
        .map((id) => shortcutCatalog.find((item) => item.id === id))
        .filter((item): item is NavItemDef => Boolean(item)),
    [enabledShortcuts, shortcutCatalog]
  );

  const userInitial = user?.displayName
    ? user.displayName.charAt(0).toUpperCase()
    : user?.email?.charAt(0).toUpperCase() || 'U';

  const renderNavButton = (item: NavItemDef) => {
    const isActive =
      item.id === 'labor_agenda'
        ? isLaborAgendaOpen
        : item.id === 'smart_checklists'
        ? isChecklistOpen
        : currentView === item.id;
    const isSelected = pendingView === item.id;
    const isHighlighted = pendingView ? isSelected : isActive;
    const Icon = item.icon;

    return (
      <motion.button
        type="button"
        layout
        key={item.id}
        initial={{ opacity: 0, x: -10 }}
        animate={{
          opacity: 1,
          x: isSelected ? 4 : 0,
          scale: isSelected ? 1.015 : 1,
        }}
        exit={{ opacity: 0, x: -10 }}
        whileHover={!pendingView ? { x: 2 } : undefined}
        whileTap={{ scale: 0.975 }}
        transition={pillMorphSpring}
        onClick={() => handleSelectView(item.id)}
        className={`relative isolate w-full p-3 rounded-2xl transition-colors flex items-center justify-between group cursor-pointer ${
          isHighlighted
            ? 'text-emerald-950 font-black'
            : 'hover:bg-emerald-500/10 text-slate-700'
        }`}
      >
        {isHighlighted && (
          <motion.span
            layoutId="sisfinz-nav-active-fill"
            initial={false}
            transition={pillMorphSpring}
            className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-r from-emerald-200/95 via-[#B9F2D5] to-teal-200/90 border border-emerald-300/80 shadow-[0_8px_22px_rgba(5,150,105,0.18),inset_0_1px_0_rgba(255,255,255,0.9)]"
          />
        )}

        {isSelected && !reduceMotion && (
          <motion.span
            initial={{ opacity: 0.55, scale: 0.94 }}
            animate={{ opacity: 0, scale: 1.06 }}
            transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-none absolute -inset-0.5 -z-10 rounded-2xl border-2 border-emerald-400/75"
          />
        )}

        <div className="relative z-10 flex items-center gap-3.5 min-w-0">
          <motion.div
            animate={{
              scale: isSelected ? [1, 1.12, 1.04] : isHighlighted ? 1.03 : 1,
              rotate: isSelected ? [0, -7, 5, 0] : 0,
            }}
            transition={{
              duration: reduceMotion ? 0.01 : 0.28,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-colors bg-emerald-600 text-white shadow-2xs"
          >
            <Icon className="w-5 h-5" />
          </motion.div>
          <div className="text-left min-w-0">
            <motion.div
              animate={{ x: isSelected ? 2 : 0 }}
              transition={{ duration: reduceMotion ? 0.01 : 0.18 }}
              className={`text-sm font-black truncate ${
                isHighlighted ? 'text-emerald-950' : 'text-slate-900'
              }`}
            >
              {item.label}
            </motion.div>
            <div
              className={`text-[10px] font-semibold truncate ${
                isHighlighted ? 'text-emerald-800/85' : 'text-slate-500'
              }`}
            >
              {item.desc}
            </div>
          </div>
        </div>

        {item.badge !== undefined && item.badge > 0 && (
          <span
            className={`relative z-10 px-2.5 py-0.5 rounded-full text-[10px] font-black ${
              isHighlighted
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'bg-rose-500 text-white shadow-xs'
            }`}
          >
            {item.badge}
          </span>
        )}
      </motion.button>
    );
  };

  return (
    <>
      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <div
              key="nav-drawer-root"
              className="fixed inset-0 z-[60] flex items-stretch justify-start overflow-hidden overscroll-none pointer-events-none"
            >
              <motion.div
                initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                animate={{ opacity: 1, backdropFilter: 'blur(5px)' }}
                exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                className="absolute inset-0 z-0 bg-slate-900/40 pointer-events-auto"
                onClick={onClose}
              />

              <motion.div
                initial={{ x: '-100%', opacity: 0.92 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '-100%', opacity: 0.92 }}
                transition={drawerSpring}
                className="relative z-10 w-[86%] max-w-xs h-full bg-[#F4F8F6] border-r border-slate-200/80 shadow-2xl flex flex-col overflow-hidden pointer-events-auto"
                onTouchMove={(e) => e.stopPropagation()}
                style={{ touchAction: 'pan-y' }}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {!isManagingShortcuts ? (
                    <motion.div
                      key="drawer-main"
                      initial={{ opacity: 0, x: -18 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -18 }}
                      transition={{ duration: reduceMotion ? 0.01 : 0.22, ease: [0.22, 1, 0.36, 1] }}
                      className="flex flex-col h-full min-h-0"
                    >
                      <div className="p-5 border-b border-slate-200 flex items-center justify-between shrink-0 relative overflow-hidden bg-white">
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-transparent pointer-events-none" />
                        <div className="flex items-center gap-3.5 relative z-10">
                          <div className="w-11 h-11 rounded-2xl overflow-hidden shadow-md border border-white/90">
                            <img
                              src="/assets/aistudio/image_89b2520a.jpeg"
                              alt="Logo"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div>
                            <h2 className="text-xl font-black text-slate-900 tracking-tight leading-none">
                              SisFinz
                            </h2>
                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 mt-1">
                              Gestão Financeira
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={onClose}
                          className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-all cursor-pointer pointer-events-auto relative z-20"
                          aria-label="Fechar menu"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="px-4 pt-4 pb-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenProfileModal();
                          }}
                          className="w-full p-3.5 rounded-3xl bg-white/80 border border-slate-200/80 hover:border-emerald-200 hover:bg-emerald-50/30 shadow-xs transition-all text-left flex items-center gap-3 group cursor-pointer"
                        >
                          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-xl font-black text-white shadow-md border border-white/50 overflow-hidden shrink-0">
                            {user?.photoURL ? (
                              <img
                                src={user.photoURL}
                                alt="Foto"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              userInitial
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-black text-slate-900 truncate">
                              {user?.displayName || 'Usuário'}
                            </div>
                            <div className="text-[10px] font-medium text-slate-500 truncate">
                              {user?.email}
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-700 transition-colors" />
                        </button>
                      </div>

                      <div
                        className="flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar px-3 py-3 space-y-6"
                        style={{
                          WebkitOverflowScrolling: 'touch',
                          touchAction: 'pan-y',
                          overscrollBehaviorY: 'contain',
                        }}
                      >
                        <div className="space-y-2">
                          <div className="px-3 text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                            {language === 'es' ? 'Herramientas' : 'Ferramentas'}
                          </div>
                          <div className="space-y-1">
                            {coreItems.map((item) => renderNavButton(item))}
                          </div>
                        </div>

                        <AnimatePresence>
                          {activeShortcutItems.length > 0 && (
                            <motion.div
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -8 }}
                              className="space-y-2"
                            >
                              <div className="px-3 flex items-center justify-between gap-2">
                                <div className="text-[10px] font-black uppercase tracking-widest text-emerald-700 flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  {language === 'es' ? 'Mis Atajos' : 'Meus Atalhos'}
                                  <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-black text-emerald-800">
                                    {activeShortcutItems.length}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setIsManagingShortcuts(true)}
                                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-extrabold text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                                >
                                  <SlidersHorizontal className="w-3 h-3" />
                                  Editar
                                </button>
                              </div>

                              <div className="space-y-1">
                                <AnimatePresence initial={false}>
                                  {activeShortcutItems.map((item) => renderNavButton(item))}
                                </AnimatePresence>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <div className="px-1 pt-1">
                          <motion.button
                            type="button"
                            whileHover={{ y: -1 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setIsManagingShortcuts(true)}
                            className="w-full p-3.5 rounded-2xl border-2 border-dashed border-emerald-300/90 bg-gradient-to-r from-emerald-50/80 via-white to-emerald-50/60 hover:border-emerald-500 hover:from-emerald-50 hover:to-emerald-100/50 transition-all flex items-center justify-between gap-3 group cursor-pointer shadow-2xs"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-emerald-600/25 group-hover:scale-105 transition-transform">
                                <Plus className="w-5 h-5 stroke-[2.75]" />
                              </div>
                              <div className="text-left min-w-0">
                                <div className="text-sm font-black text-emerald-900 truncate">
                                  {language === 'es' ? 'Agregar atajo' : 'Adicionar atalho'}
                                </div>
                                <div className="text-[10px] font-semibold text-emerald-700/80 truncate">
                                  {language === 'es'
                                    ? 'Acceso rápido a tus pantallas'
                                    : 'Acesso rápido às suas telas'}
                                </div>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-emerald-600 group-hover:translate-x-0.5 transition-transform shrink-0" />
                          </motion.button>
                        </div>
                      </div>

                      <div className="p-4 border-t border-slate-200 bg-white shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            signOutUser();
                          }}
                          className="w-full h-13 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-200 text-rose-700 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                        >
                          <LogOut className="w-4 h-4" />
                          {language === 'es' ? 'Cerrar Sesión' : 'Sair do SisFinz'}
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="drawer-shortcuts"
                      initial={{ opacity: 0, x: 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 24 }}
                      transition={{ duration: reduceMotion ? 0.01 : 0.22, ease: [0.22, 1, 0.36, 1] }}
                      className="flex flex-col h-full min-h-0"
                    >
                      <div className="p-5 border-b border-emerald-100 bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-700 text-white shrink-0 relative overflow-hidden">
                        <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
                        <div className="relative z-10 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setIsManagingShortcuts(false)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 hover:bg-white/25 px-3 py-2 text-xs font-black text-white transition-colors cursor-pointer"
                          >
                            <ArrowLeft className="w-4 h-4" />
                            {language === 'es' ? 'Volver' : 'Voltar'}
                          </button>
                          <span className="rounded-full border border-white/25 bg-white/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white">
                            {activeShortcutItems.length}{' '}
                            {activeShortcutItems.length === 1 ? 'ativo' : 'ativos'}
                          </span>
                        </div>
                        <div className="relative z-10 mt-3.5">
                          <h3 className="text-lg font-black tracking-tight leading-tight">
                            {language === 'es' ? 'Agregar Atajos' : 'Adicionar Atalhos'}
                          </h3>
                          <p className="mt-1 text-[11px] font-medium text-emerald-50/90 leading-snug">
                            {language === 'es'
                              ? 'Activa las pantallas que quieras abrir rápido desde el menú lateral.'
                              : 'Ative as telas que você quer acessar rápido direto pelo menu lateral.'}
                          </p>
                        </div>
                      </div>

                      <div
                        className="flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar px-3 py-3 space-y-2"
                        style={{
                          WebkitOverflowScrolling: 'touch',
                          touchAction: 'pan-y',
                          overscrollBehaviorY: 'contain',
                        }}
                      >
                        {shortcutCatalog.map((item) => {
                          const isEnabled = enabledShortcuts.includes(item.id);
                          const Icon = item.icon;

                          return (
                            <motion.div
                              layout
                              key={item.id}
                              onClick={() => toggleShortcut(item.id)}
                              role="switch"
                              aria-checked={isEnabled}
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  toggleShortcut(item.id);
                                }
                              }}
                              whileTap={{ scale: 0.99 }}
                              className={`w-full p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer select-none ${
                                isEnabled
                                  ? 'border-emerald-300 bg-emerald-50/80 shadow-xs'
                                  : 'border-slate-200/80 bg-white hover:border-emerald-200 hover:bg-slate-50/70'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <motion.div
                                  animate={{
                                    scale: isEnabled ? [1, 1.08, 1] : 1,
                                  }}
                                  transition={{ duration: 0.25 }}
                                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                                    isEnabled
                                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/25'
                                      : 'bg-slate-100 text-slate-500'
                                  }`}
                                >
                                  <Icon className="w-5 h-5" />
                                </motion.div>
                                <div className="min-w-0 text-left">
                                  <div
                                    className={`text-sm font-black truncate ${
                                      isEnabled ? 'text-emerald-950' : 'text-slate-800'
                                    }`}
                                  >
                                    {item.label}
                                  </div>
                                  <div className="text-[10px] font-medium text-slate-500 truncate">
                                    {item.desc}
                                  </div>
                                </div>
                              </div>

                              <div
                                className={`relative flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors duration-200 ${
                                  isEnabled
                                    ? 'bg-emerald-500 shadow-inner shadow-emerald-700/20'
                                    : 'bg-slate-300/90'
                                }`}
                              >
                                <motion.span
                                  layout
                                  transition={{ type: 'spring', stiffness: 520, damping: 32 }}
                                  className={`flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-md ${
                                    isEnabled ? 'ml-auto' : 'mr-auto'
                                  }`}
                                >
                                  {isEnabled && (
                                    <Check className="h-3 w-3 text-emerald-600 stroke-[3]" />
                                  )}
                                </motion.span>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>

                      <div className="p-4 border-t border-slate-200 bg-white shrink-0">
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setIsManagingShortcuts(false)}
                          className="w-full h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-colors cursor-pointer"
                        >
                          <Check className="w-4 h-4 stroke-[3]" />
                          {language === 'es' ? 'Listo' : 'Concluir'}
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      <LaborAgendaView
        isOpen={isLaborAgendaOpen}
        onClose={() => setIsLaborAgendaOpen(false)}
        language={language}
        onOpenCalculator={onOpenCalculator}
        onOpenExpense={onOpenQuickTx ? () => onOpenQuickTx('expense') : undefined}
        onOpenIncome={onOpenQuickTx ? () => onOpenQuickTx('income') : undefined}
        onOpenBill={onOpenQuickTx ? () => onOpenQuickTx('bill') : undefined}
        onOpenTransfer={onOpenQuickTransfer}
        onOpenSharedBill={() => onChangeView('shared_accounts')}
        onOpenVoice={onOpenQuickVoice}
      />

      <SmartChecklistView
        isOpen={isChecklistOpen}
        onClose={handleCloseChecklist}
        language={language}
      />
    </>
  );
};
