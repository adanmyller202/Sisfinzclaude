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

  const actions = [
    {
      id: 'calculator',
      label: language === 'es' ? 'Calculadora' : 'Calculadora',
      icon: Calculator,
      color: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30',
      onClick: () => {
        setIsOpen(false);
        onMenuToggle?.(false);
        onOpenCalculator();
      },
    },
    {
      id: 'voice',
      label: language === 'es' ? 'Por Voz' : 'Por Voz',
      icon: Mic,
      color: 'bg-violet-600 hover:bg-violet-500 text-white shadow-violet-600/30',
      onClick: () => {
        setIsOpen(false);
        onMenuToggle?.(false);
        onOpenVoice();
      },
    },
    {
      id: 'shared',
      label: language === 'es' ? 'Dividir Fatura' : 'Dividir Fatura',
      icon: Users,
      color: 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/30',
      onClick: () => {
        setIsOpen(false);
        onMenuToggle?.(false);
        onOpenSharedBill();
      },
    },
    {
      id: 'transfer',
      label: language === 'es' ? 'Transferir' : 'Transferir',
      icon: ArrowRightLeft,
      color: 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30',
      onClick: () => {
        setIsOpen(false);
        onMenuToggle?.(false);
        onOpenTransfer();
      },
    },
    {
      id: 'bill',
      label: language === 'es' ? 'Nueva Factura' : 'Nova Fatura',
      icon: Receipt,
      color: 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30',
      onClick: () => {
        setIsOpen(false);
        onMenuToggle?.(false);
        onOpenBill();
      },
    },
    {
      id: 'income',
      label: language === 'es' ? 'Nuevo Ingreso' : 'Novo Ingresso',
      icon: TrendingUp,
      color: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30',
      onClick: () => {
        setIsOpen(false);
        onMenuToggle?.(false);
        onOpenIncome();
      },
    },
    {
      id: 'expense',
      label: language === 'es' ? 'Nuevo Gasto' : 'Novo Gasto',
      icon: TrendingDown,
      color: 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30',
      onClick: () => {
        setIsOpen(false);
        onMenuToggle?.(false);
        onOpenExpense();
      },
    },
  ];

  return (
    <div
      ref={containerRef}
      style={{
        bottom: 'calc(5.25rem + env(safe-area-inset-bottom, 0px))',
      }}
      className="fixed right-4 sm:right-6 z-40 flex flex-col items-end gap-2.5 print:hidden"
    >
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 400, damping: 24 }}
            className="flex flex-col items-end gap-2 mb-1 max-h-[62dvh] overflow-y-auto no-scrollbar pr-0.5"
          >
            {actions.map((act, idx) => {
              const Icon = act.icon;
              return (
                <motion.button
                  key={act.id}
                  type="button"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 14 }}
                  transition={{ delay: idx * 0.03 }}
                  whileHover={{ scale: 1.03, x: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={act.onClick}
                  className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-xs font-extrabold shadow-lg transition-all cursor-pointer shrink-0 ${act.color}`}
                >
                  <span className="tracking-wide">{act.label}</span>
                  <div className="w-6 h-6 rounded-xl bg-white/20 flex items-center justify-center">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={toggleMenu}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.92 }}
        className={`w-13 h-13 rounded-2xl flex items-center justify-center text-white shadow-xl transition-all cursor-pointer ${
          isOpen
            ? 'bg-slate-800 shadow-slate-800/30 rotate-90'
            : 'bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-emerald-600/35 hover:shadow-emerald-600/50'
        }`}
        aria-label={language === 'es' ? 'Acciones rápidas' : 'Ações rápidas'}
      >
        <AnimatePresence mode="wait" initial={false}>
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X className="w-6 h-6" />
            </motion.div>
          ) : (
            <motion.div
              key="add"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Plus className="w-6 h-6 stroke-[2.8]" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
};
