import React, { useEffect } from 'react';
import { LanguageCode } from '../types';
import { useAuth } from '../context/AuthContext';
import { getTranslations } from '../utils/i18n';
import {
  Wallet,
  PiggyBank,
  Target,
  Bot,
  Settings,
  User as UserIcon,
  X,
  Sparkles,
  LogOut,
  ChevronRight,
  Sun,
  Moon,
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSelectView = (view: any) => {
    onChangeView(view);
    onClose();
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
        { id: 'goals', label: t.myGoals, icon: Target, color: 'amber', desc: 'Desafio dos quadrados', badge: goalsCount },
        { id: 'challenge_52', label: '52 Semanas', icon: Award, color: 'amber', desc: 'Poupança progressiva' },
        { id: 'freedom', label: 'Liberdade', icon: Sparkles, color: 'cyan', desc: 'Escala de liberdade' },
      ]
    },
    {
      title: language === 'es' ? 'Análisis y Extras' : 'Análise e Extras',
      items: [
        { id: 'full_report', label: 'Informe Real', icon: FileText, color: 'cyan', desc: 'Relatório detalhado' },
        { id: 'report', label: 'Gráfico Mensal', icon: PieChartIcon, color: 'blue', desc: 'Gastos por categoria' },
        { id: 'shared_accounts', label: 'Compartilhados', icon: Users, color: 'indigo', desc: 'Contas em grupo', badge: sharedPendingCount },
      ]
    }
  ];

  const userInitial = user?.displayName
    ? user.displayName.charAt(0).toUpperCase()
    : user?.email?.charAt(0).toUpperCase() || 'U';

  return (
    <AnimatePresence>
      {isOpen && (
        <div key="nav-drawer-root" className="fixed inset-0 z-[60] flex items-stretch justify-start overflow-hidden overscroll-contain pointer-events-none">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-0 bg-slate-900/40 pointer-events-auto"
            onClick={onClose}
          />

          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="solid-container bg-white w-full max-w-[320px] sm:max-w-sm flex flex-col h-full relative z-10 pt-safe pb-safe pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
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
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 mt-1.5">Premium Fintech</p>
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
            <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-4 space-y-8">
              {navGroups.map((group, gIdx) => (
                <div key={gIdx} className="space-y-2">
                  <div className="px-4 text-[10px] font-black uppercase tracking-widest text-slate-600 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                    {group.title}
                  </div>
                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const isActive = currentView === item.id;
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleSelectView(item.id)}
                          className={`w-full p-3 rounded-2xl transition-all flex items-center justify-between group cursor-pointer ${
                            isActive 
                              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25' 
                              : 'hover:bg-emerald-500/10 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
                              isActive 
                                ? 'bg-white/20 text-white shadow-inner' 
                                : 'bg-emerald-600 text-white shadow-sm'
                            }`}>
                              <Icon className="w-5 h-5 text-white" />
                            </div>
                            <div className="text-left min-w-0">
                              <div className={`text-sm font-black truncate ${isActive ? 'text-white' : 'text-slate-900'}`}>
                                {item.label}
                              </div>
                              <div className={`text-[10px] font-medium truncate ${isActive ? 'text-emerald-100' : 'text-slate-500'}`}>
                                {item.desc}
                              </div>
                            </div>
                          </div>
                          {item.badge !== undefined && item.badge > 0 && (
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                              isActive ? 'bg-white text-emerald-700' : 'bg-rose-500 text-white shadow-xs'
                            }`}>
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Mone Smart Assistant Highlight */}
              <div className="px-1">
                <button
                  onClick={() => { onClose(); onOpenMoneChat(); }}
                  className="w-full p-4 rounded-3xl bg-gradient-to-br from-amber-500/15 to-orange-500/15 border border-amber-500/30 hover:from-amber-500/25 hover:to-orange-500/25 transition-all flex items-center justify-between group cursor-pointer shadow-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/20 text-white">
                      <Bot className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-1.5 text-sm font-black text-slate-900">
                        Mone AI
                        <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                      </div>
                      <div className="text-[10px] font-bold text-amber-700 uppercase tracking-tight">Assistente Inteligente</div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-amber-600 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 bg-white space-y-3 shrink-0">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => { onClose(); onOpenSettingsModal(); }}
                  className="p-3 rounded-2xl bg-white/80 hover:bg-white border border-slate-200/80 text-slate-700 hover:text-slate-900 shadow-xs transition-all flex flex-col items-center gap-1.5 cursor-pointer"
                >
                  <Settings className="w-4 h-4 text-emerald-600" />
                  <span className="text-[10px] font-black uppercase tracking-widest">{t.settings}</span>
                </button>
                <button
                  onClick={onToggleDarkMode}
                  className="p-3 rounded-2xl bg-white/80 hover:bg-white border border-slate-200/80 text-slate-700 hover:text-slate-900 shadow-xs transition-all flex flex-col items-center gap-1.5 cursor-pointer"
                >
                  {darkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-slate-700" />}
                  <span className="text-[10px] font-black uppercase tracking-widest">{darkMode ? 'Claro' : 'Escuro'}</span>
                </button>
              </div>

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
    </AnimatePresence>
  );
};
