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

const POS_STORAGE_KEY = 'sisfinz_quick_fab_pos_v1';

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
  const [offsetPos, setOffsetPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window === 'undefined') return { x: 0, y: 0 };
    try {
      const raw = localStorage.getItem(POS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
          return { x: parsed.x, y: parsed.y };
        }
      }
    } catch {
      // ignore
    }
    return { x: 0, y: 0 };
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const draggedRef = useRef(false);

  const clampOffsetToViewport = (x: number, y: number) => {
    if (typeof window === 'undefined') return { x, y };
    const maxLeft = Math.max(24, window.innerWidth - 96);
    const maxUp = Math.max(80, window.innerHeight - 170);
    const clampedX = Math.max(-maxLeft, Math.min(24, x));
    const clampedY = Math.max(-maxUp, Math.min(48, y));
    return { x: clampedX, y: clampedY };
  };

  useEffect(() => {
    const handleResize = () => {
      setOffsetPos((prev) => clampOffsetToViewport(prev.x, prev.y));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleMenu = () => {
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
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
      id: 'expense',
      label: language === 'es' ? 'Nuevo Gasto' : 'Novo Gasto',
      icon: TrendingDown,
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
      onClick: () => {
        setIsOpen(false);
        onMenuToggle?.(false);
        onOpenCalculator();
      },
    },
  ];

  const menuOpensUpward = offsetPos.y > -160;

  return (
    <motion.div
      ref={containerRef}
      drag
      dragMomentum={false}
      dragElastic={0.12}
      onDragStart={() => {
        draggedRef.current = true;
      }}
      onDragEnd={(_e, info) => {
        const next = clampOffsetToViewport(
          offsetPos.x + info.offset.x,
          offsetPos.y + info.offset.y
        );
        setOffsetPos(next);
        try {
          localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        window.setTimeout(() => {
          draggedRef.current = false;
        }, 80);
      }}
      style={{
        x: offsetPos.x,
        y: offsetPos.y,
        marginBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
      className={`fixed right-4 sm:right-6 z-[64] flex ${
        menuOpensUpward ? 'flex-col' : 'flex-col-reverse'
      } items-end gap-2 print:hidden touch-none ${bottomOffsetClass}`}
    >
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: menuOpensUpward ? 12 : -12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: menuOpensUpward ? 10 : -10, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 420, damping: 26 }}
            className="flex flex-col items-end gap-1.5 max-h-[62dvh] overflow-y-auto no-scrollbar pr-0.5"
          >
            {actions.map((act, idx) => {
              const Icon = act.icon;
              return (
                <motion.button
                  key={act.id}
                  type="button"
                  initial={{ opacity: 0, x: 16, scale: 0.96 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 12, scale: 0.96 }}
                  transition={{
                    delay: idx * 0.025,
                    type: 'spring',
                    stiffness: 460,
                    damping: 26,
                  }}
                  whileHover={{ x: -3 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={act.onClick}
                  style={{
                    backgroundColor: 'rgba(236, 253, 245, 0.78)',
                    backdropFilter: 'blur(14px)',
                    WebkitBackdropFilter: 'blur(14px)',
                  }}
                  className="flex items-center gap-3 pl-4 pr-2.5 py-2 rounded-2xl text-xs font-extrabold text-emerald-950 border-2 border-emerald-400 shadow-[0_6px_20px_rgba(16,185,129,0.22)] hover:bg-emerald-50/90 transition-all cursor-pointer shrink-0"
                >
                  <span className="tracking-tight">{act.label}</span>
                  <div className="w-7 h-7 rounded-xl bg-emerald-500/20 border border-emerald-400 text-emerald-700 flex items-center justify-center">
                    <Icon className="w-3.5 h-3.5 stroke-[2.4]" />
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transparent Emerald Glass Draggable FAB Button */}
      <motion.button
        type="button"
        onClick={toggleMenu}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.93 }}
        style={{
          background:
            'linear-gradient(145deg, rgba(52, 211, 153, 0.42), rgba(16, 185, 129, 0.24))',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
        className={`w-14 h-14 rounded-full flex items-center justify-center text-emerald-950 border-2 border-emerald-400/90 shadow-[0_8px_24px_rgba(16,185,129,0.28),inset_0_1px_1px_rgba(255,255,255,0.75)] transition-all cursor-grab active:cursor-grabbing ${
          isOpen ? 'ring-2 ring-emerald-400/60' : ''
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
    </motion.div>
  );
};
