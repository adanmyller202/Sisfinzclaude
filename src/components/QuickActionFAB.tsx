import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  X,
  TrendingDown,
  TrendingUp,
  Receipt,
  ArrowRightLeft,
  Users,
  Mic,
  Calculator,
} from 'lucide-react';
import { LanguageCode } from '../types';

interface QuickActionFABProps {
  language?: LanguageCode;
  onOpenExpense: () => void;
  onOpenIncome: () => void;
  onOpenBill: () => void;
  onOpenTransfer: () => void;
  onOpenSharedBill: () => void;
  onOpenVoice: () => void;
  onOpenCalculator: () => void;
  onMenuToggle?: (isOpen: boolean) => void;
  bottomOffsetClass?: string;
}

export const QuickActionFAB: React.FC<QuickActionFABProps> = ({
  language = 'pt',
  onOpenExpense,
  onOpenIncome,
  onOpenBill,
  onOpenTransfer,
  onOpenSharedBill,
  onOpenVoice,
  onOpenCalculator,
  onMenuToggle,
  bottomOffsetClass = 'bottom-20 sm:bottom-22',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleMenu = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    onMenuToggle?.(nextState);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        onMenuToggle?.(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onMenuToggle]);

  // Cohesive, high-craft ordered flow: daily money -> commitments -> shared/transfer -> quick tools (Voice & Calculator)
  const actions = [
    {
      id: 'expense',
      label: language === 'es' ? 'Nuevo Gasto' : 'Novo Gasto',
      icon: TrendingDown,
      badgeTone: 'text-rose-600 bg-rose-500/12 border-rose-500/20',
      onClick: () => {
        setIsOpen(false);
        onMenuToggle?.(false);
        onOpenExpense();
      },
    },
    {
      id: 'income',
      label: language === 'es' ? 'Nuevo Ingreso' : 'Novo Ingresso',
      icon: TrendingUp,
      badgeTone: 'text-emerald-700 bg-emerald-500/12 border-emerald-500/20',
      onClick: () => {
        setIsOpen(false);
        onMenuToggle?.(false);
        onOpenIncome();
      },
    },
    {
      id: 'bill',
      label: language === 'es' ? 'Nueva Factura' : 'Nova Fatura',
      icon: Receipt,
      badgeTone: 'text-amber-700 bg-amber-500/12 border-amber-500/20',
      onClick: () => {
        setIsOpen(false);
        onMenuToggle?.(false);
        onOpenBill();
      },
    },
    {
      id: 'transfer',
      label: language === 'es' ? 'Transferir' : 'Transferir',
      icon: ArrowRightLeft,
      badgeTone: 'text-teal-700 bg-teal-500/12 border-teal-500/20',
      onClick: () => {
        setIsOpen(false);
        onMenuToggle?.(false);
        onOpenTransfer();
      },
    },
    {
      id: 'shared',
      label: language === 'es' ? 'Dividir Fatura' : 'Dividir Fatura',
      icon: Users,
      badgeTone: 'text-emerald-800 bg-emerald-500/12 border-emerald-500/20',
      onClick: () => {
        setIsOpen(false);
        onMenuToggle?.(false);
        onOpenSharedBill();
      },
    },
    {
      id: 'voice',
      label: language === 'es' ? 'Por Voz' : 'Por Voz',
      icon: Mic,
      badgeTone: 'text-emerald-700 bg-emerald-500/12 border-emerald-500/20',
      onClick: () => {
        setIsOpen(false);
        onMenuToggle?.(false);
        onOpenVoice();
      },
    },
    {
      id: 'calculator',
      label: language === 'es' ? 'Calculadora' : 'Calculadora',
      icon: Calculator,
      badgeTone: 'text-slate-700 bg-slate-900/8 border-slate-300/60',
      onClick: () => {
        setIsOpen(false);
        onMenuToggle?.(false);
        onOpenCalculator();
      },
    },
  ];

  return (
    <div
      ref={containerRef}
      style={{
        marginBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
      className={`fixed right-4 sm:right-6 z-[64] flex flex-col items-end gap-2 print:hidden ${bottomOffsetClass}`}
    >
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 420, damping: 26 }}
            className="flex flex-col items-end gap-1.5 mb-1 max-h-[64dvh] overflow-y-auto no-scrollbar pr-0.5"
          >
            {actions.map((act, idx) => {
              const Icon = act.icon;
              return (
                <motion.button
                  key={act.id}
                  type="button"
                  initial={{ opacity: 0, x: 18, scale: 0.96 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 12, scale: 0.96 }}
                  transition={{
                    delay: idx * 0.03,
                    type: 'spring',
                    stiffness: 460,
                    damping: 26,
                  }}
                  whileHover={{ x: -3 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={act.onClick}
                  className="glass-modal flex items-center gap-3 pl-4 pr-2 py-2 rounded-2xl text-xs font-extrabold text-slate-800 hover:bg-white/95 border border-white/85 shadow-lg transition-all cursor-pointer shrink-0"
                >
                  <span className="tracking-tight">{act.label}</span>
                  <div
                    className={`w-7 h-7 rounded-xl border flex items-center justify-center transition-transform ${act.badgeTone}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Original Glass FAB Button */}
      <motion.button
        type="button"
        onClick={toggleMenu}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.93 }}
        className={`glass-emerald w-14 h-14 rounded-full flex items-center justify-center text-emerald-900 shadow-xl transition-all cursor-pointer border border-white/80 ${
          isOpen ? 'ring-2 ring-emerald-500/35 bg-white/85' : ''
        }`}
        aria-label={language === 'es' ? 'Acciones rápidas' : 'Ações rápidas'}
      >
        <AnimatePresence mode="wait" initial={false}>
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0, scale: 0.8 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: 90, opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.16 }}
            >
              <X className="w-6 h-6 stroke-[2.5]" />
            </motion.div>
          ) : (
            <motion.div
              key="add"
              initial={{ rotate: 90, opacity: 0, scale: 0.8 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: -90, opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.16 }}
            >
              <Plus className="w-6 h-6 stroke-[2.6]" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
};
