import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LanguageCode } from '../types';
import { useAuth } from '../context/AuthContext';
import { getTranslations } from '../utils/i18n';
import {
  Wallet,
  PiggyBank,
  Settings,
  User as UserIcon,
  X,
  Sparkles,
  LogOut,
  ChevronRight,
  ShieldCheck,
  PieChart as PieChartIcon,
  Users,
  Award,
  FileText,
  Landmark,
  Calendar,
  Gauge,
  LayoutGrid,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface NavigationDrawerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentView: 'finance' | 'planejar' | 'goals' | 'savings' | 'categories' | 'report' | 'shared_accounts' | 'challenge_52' | 'full_report' | 'accounts' | 'financial_calendar' | 'freedom' | 'daily_pace';
  onChangeView: (view: any) => void;
  goalsCount: number;
  savingsCount: number;
  sharedPendingCount?: number;
  onOpenMoneChat: () => void;
  onOpenSettingsModal: () => void;
  onOpenProfileModal: () => void;
  language?: LanguageCode;
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export const NavigationDrawerModal: React.FC<NavigationDrawerModalProps> = ({
  isOpen,
  onClose,
  currentView,
  onChangeView,
  goalsCount,
  savingsCount,
  sharedPendingCount = 0,
  onOpenMoneChat,
  onOpenSettingsModal,
  onOpenProfileModal,
  language = 'pt',
  darkMode,
  onToggleDarkMode,
}) => {
  const t = getTranslations(language);
  const { user, signOutUser } = useAuth();
  const [pendingView, setPendingView] = useState<string | null>(null);
  const selectionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);


  // Lock the page behind the drawer on iOS/PWA as well as desktop.
  useEffect(() => {
    if (!isOpen) return;
    const body = document.body;
    const html = document.documentElement;
    const scrollY = window.scrollY;
    const previous = {
      bodyPosition: body.style.position, bodyTop: body.style.top,
      bodyLeft: body.style.left, bodyRight: body.style.right,
      bodyWidth: body.style.width, bodyOverflow: body.style.overflow,
      htmlOverflow: html.style.overflow, htmlOverscroll: html.style.overscrollBehavior,
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
      window.scrollTo({ top: scrollY, left: 0, behavior: 'instant' as ScrollBehavior });
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      if (selectionTimer.current) clearTimeout(selectionTimer.current);
      selectionTimer.current = null;
      setPendingView(null);
    }
    return () => {
      if (selectionTimer.current) clearTimeout(selectionTimer.current);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSelectView = (view: any) => {
    if (pendingView || view === currentView) {
      if (view === currentView && !pendingView) onClose();
      return;
    }
    setPendingView(view);
    // Let the selected row's fill, icon and label animation be clearly seen
    // before changing the page and dismissing the drawer.
    selectionTimer.current = setTimeout(() => {
      onChangeView(view);
      onClose();
      selectionTimer.current = null;
    }, 820);
  };

  const navGroups = [
    {
      title: language === 'es' ? 'Gestión Diaria' : 'Gestão Diária',
      items: [
        { id: 'finance', label: t.financialControl, icon: Wallet, color: 'emerald', desc: 'Faturas e despesas' },
        { id: 'accounts', label: 'Contas & Saldos', icon: Landmark, color: 'blue', desc: 'Bancos e efectivo' },
        { id: 'daily_pace', label: 'Ritmo Diário', icon: Gauge, color: 'emerald', desc: 'Limite até o salário' },
        { id: 'financial_calendar', label: 'Calendário', icon: Calendar, color: 'teal', desc: 'Visão temporal' },
      ]
    },
    {
      title: language === 'es' ? 'Metas y Ahorro' : 'Metas e Poupança',
      items: [
        { id: 'savings', label: t.tabSavings, icon: PiggyBank, color: 'emerald', desc: 'Reserva e cofrinhos', badge: savingsCount },
        { id: 'challenge_52', label: language === 'es' ? 'Plan Semanal' : 'Plano Semanal', icon: Award, color: 'amber', desc: language === 'es' ? 'Ahorro organizado por semana' : 'Poupança organizada por semana' },
        { id: 'freedom', label: 'Liberdade', icon: Sparkles, color: 'cyan', desc: 'Escala de liberdade' },
      ]
    },
    {
      title: language === 'es' ? 'Análisis y Extras' : 'Análise e Extras',
      items: [
        { id: 'full_report', label: 'Informe Real', icon: FileText, color: 'cyan', desc: 'Relatório detalhado' },
        { id: 'report', label: 'Percepções', icon: PieChartIcon, color: 'blue', desc: 'Resumo mensal e distribuição de gastos' },
        { id: 'shared_accounts', label: 'Compartilhados', icon: Users, color: 'indigo', desc: 'Contas em grupo', badge: sharedPendingCount },
      ]
    }
  ];

  const userInitial = user?.displayName
    ? user.displayName.charAt(0).toUpperCase()
    : user?.email?.charAt(0).toUpperCase() || 'U';

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div key="nav-drawer-root" className="fixed inset-0 z-[60] flex items-stretch justify-start overflow-hidden overscroll-none pointer-events-none">
          <motion.div
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(5px)' }}
            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 z-0 bg-emerald-950/20 pointer-events-auto"
            onClick={onClose}
          />

          <motion.div
            initial={{ x: '-112%', opacity: 0.55, scale: 0.84, rotate: -5 }}
            animate={{ x: 0, opacity: 1, scale: 1, rotate: 0 }}
            exit={{ x: '-108%', opacity: 0.65, scale: 0.9, rotate: -3 }}
            transition={{ type: 'spring', damping: 19, stiffness: 230, mass: 0.9 }}
            className="solid-container bg-white w-[calc(100%-1.25rem)] max-w-[340px] sm:max-w-sm flex flex-col h-[calc(100%-1.25rem)] my-2.5 ml-2.5 rounded-[28px] border border-emerald-100 shadow-[0_24px_70px_rgba(6,78,59,0.22)] overflow-hidden relative z-10 pt-safe pb-safe pointer-events-auto overscroll-contain"
            onClick={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            style={{ touchAction: 'pan-y' }}
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-200 flex items-center justify-between shrink-0 relative overflow-hidden bg-white">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-transparent pointer-events-none" />
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-md border border-white/90">
                  <img src="/assets/aistudio/image_89b2520a.jpeg" alt="Logo" className="w-full h-full object-cover" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight leading-none">SisFinz</h2>
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 mt-1.5">Gestão Financeira</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => {
                  onChangeView('finance');
                  onClose();
                }} 
                className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-all cursor-pointer pointer-events-auto relative z-20"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User Profile Card */}
            <div className="px-4 pt-6 pb-2 shrink-0">
              <button
                onClick={() => { onClose(); onOpenProfileModal(); }}
                className="w-full p-4 rounded-3xl bg-white/80 border border-slate-200/80 hover:bg-white shadow-xs transition-all text-left flex items-center gap-3 group cursor-pointer"
              >
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-xl font-black text-white shadow-md border border-white/50 overflow-hidden shrink-0">
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt="Foto" className="w-full h-full object-cover" />
                  ) : (
                    userInitial
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-black text-slate-900 truncate">{user?.displayName || 'Usuário'}</div>
                  <div className="text-[10px] font-medium text-slate-500 truncate">{user?.email}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-800 transition-colors" />
              </button>
            </div>

            {/* Navigation Groups */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar px-3 py-4 space-y-8"
              style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y', overscrollBehaviorY: 'contain' }}>
              {navGroups.map((group, gIdx) => (
                <div key={gIdx} className="space-y-2">
                  <div className="px-4 text-[10px] font-black uppercase tracking-widest text-slate-600 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                    {group.title}
                  </div>
                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const isActive = currentView === item.id;
                      const isSelected = pendingView === item.id;
                      // During selection, the single shared green surface travels
                      // from the previous item to the newly tapped item.
                      const isHighlighted = pendingView ? isSelected : isActive;
                      const Icon = item.icon;
                      return (
                        <motion.button
                          key={item.id}
                          type="button"
                          disabled={!!pendingView}
                          onClick={() => handleSelectView(item.id)}
                          initial={false}
                          whileTap={!pendingView ? { scale: 0.975 } : undefined}
                          animate={{
                            scale: isSelected ? 1.025 : 1,
                            x: isSelected ? 5 : 0,
                          }}
                          transition={{ type: 'spring', stiffness: 340, damping: 24 }}
                          className={`relative isolate w-full p-3 rounded-2xl flex items-center justify-between group overflow-hidden text-left cursor-pointer disabled:cursor-default ${
                            isHighlighted
                              ? 'text-white shadow-[0_10px_28px_rgba(5,150,105,0.28)]'
                              : 'text-slate-700 hover:bg-emerald-500/10'
                          }`}
                        >
                          {isHighlighted && (
                            <motion.span
                              layoutId="sisfinz-nav-active-fill"
                              className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-r from-emerald-700 via-emerald-500 to-teal-400 shadow-[0_10px_30px_rgba(5,150,105,0.34)]"
                              initial={false}
                              transition={{
                                layout: { type: 'spring', stiffness: 260, damping: 25, mass: 1.05 },
                                opacity: { duration: 0.28 },
                              }}
                            />
                          )}
                          {isSelected && (
                            <>
                              <motion.span
                                className="absolute inset-y-0 left-0 w-1/2 -z-0 pointer-events-none bg-gradient-to-r from-transparent via-white/25 to-transparent"
                                initial={{ x: '-130%' }}
                                animate={{ x: '260%' }}
                                transition={{ duration: 0.72, ease: 'easeInOut' }}
                              />
                              <motion.span
                                className="absolute -inset-2 -z-10 rounded-3xl border-2 border-emerald-300/80"
                                initial={{ opacity: 0, scale: 0.88 }}
                                animate={{ opacity: [0, 1, 0], scale: [0.88, 1.08, 1.2] }}
                                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                              />
                              <motion.span
                                className="absolute inset-0 -z-0 rounded-2xl pointer-events-none"
                                initial={{ boxShadow: 'inset 0 0 0 rgba(255,255,255,0)' }}
                                animate={{ boxShadow: ['inset 0 0 0 rgba(255,255,255,0)', 'inset 0 0 28px rgba(255,255,255,0.22)', 'inset 0 0 8px rgba(255,255,255,0.08)'] }}
                                transition={{ duration: 0.85, ease: 'easeOut' }}
                              />
                            </>
                          )}
                          <div className="relative z-10 flex items-center gap-3.5 min-w-0">
                            <motion.div
                              animate={{
                                scale: isSelected ? [1, 1.2, 1.08] : isActive ? 1.04 : 1,
                                rotate: isSelected ? [0, -8, 7, 0] : 0,
                                backgroundColor: isHighlighted ? 'rgba(255,255,255,0.22)' : '#059669',
                              }}
                              transition={{ duration: isSelected ? 0.62 : 0.28, ease: [0.22, 1, 0.36, 1] }}
                              className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 text-white shadow-sm"
                            >
                              <Icon className="w-5 h-5" />
                            </motion.div>
                            <div className="text-left min-w-0">
                              <motion.div
                                animate={{ x: isSelected ? 3 : 0, letterSpacing: isSelected ? '0.01em' : '0em' }}
                                transition={{ duration: 0.32 }}
                                className={`text-sm font-black truncate ${isHighlighted ? 'text-white' : 'text-slate-900'}`}
                              >
                                {item.label}
                              </motion.div>
                              <div className={`text-[10px] font-medium truncate ${isHighlighted ? 'text-emerald-50' : 'text-slate-500'}`}>
                                {isSelected ? (language === 'es' ? 'Abriendo sección…' : 'Preparando seção…') : item.desc}
                              </div>
                            </div>
                          </div>
                          <div className="relative z-10 flex items-center gap-2">
                            {item.badge !== undefined && item.badge > 0 && (
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                                isHighlighted ? 'bg-white text-emerald-700' : 'bg-rose-500 text-white shadow-xs'
                              }`}>
                                {item.badge}
                              </span>
                            )}
                            {isSelected && (
                              <motion.span
                                initial={{ opacity: 0, scale: 0.5, rotate: -90 }}
                                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                transition={{ type: 'spring', stiffness: 360, damping: 18 }}
                                className="text-white"
                              >
                                <Sparkles className="w-4 h-4" />
                              </motion.span>
                            )}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              ))}

            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 bg-white space-y-3 shrink-0">


              <button
                onClick={() => { onClose(); signOutUser(); }}
                className="w-full h-14 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-200 text-rose-700 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
              >
                <LogOut className="w-4 h-4" />
                {language === 'es' ? 'Cerrar Sesión' : 'Sair do SisFinz'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
