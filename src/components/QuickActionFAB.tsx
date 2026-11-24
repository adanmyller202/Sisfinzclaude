import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, animate } from 'motion/react';
import {
  Plus,
  X,
  TrendingDown,
  TrendingUp,
  Receipt,
  ArrowRightLeft,
  Users,
  Calculator,
  Camera,
} from 'lucide-react';
import { LanguageCode } from '../types';

interface QuickActionFABProps {
  language?: LanguageCode;
  onOpenExpense: () => void;
  onOpenReceiptScan?: () => void;
  onOpenIncome: () => void;
  onOpenBill: () => void;
  onOpenTransfer: () => void;
  onOpenSharedBill: () => void;
  onOpenVoice?: () => void;
  onOpenCalculator: () => void;
  onMenuToggle?: (isOpen: boolean) => void;
  bottomOffsetClass?: string;
}

const EDGE_STORAGE_KEY = 'sisfinz_quick_fab_edge_v1';
const FAB_SIZE_PX = 48;

export const QuickActionFAB: React.FC<QuickActionFABProps> = ({
  language = 'pt',
  onOpenExpense,
  onOpenReceiptScan,
  onOpenIncome,
  onOpenBill,
  onOpenTransfer,
  onOpenSharedBill,
  onOpenCalculator,
  onMenuToggle,
  bottomOffsetClass = 'bottom-20 sm:bottom-22',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dockSide, setDockSide] = useState<'right' | 'left'>(() => {
    if (typeof window === 'undefined') return 'right';
    try {
      const saved = localStorage.getItem(EDGE_STORAGE_KEY);
      return saved === 'left' ? 'left' : 'right';
    } catch {
      return 'right';
    }
  });
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 390
  );

  const x = useMotionValue(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggedRef = useRef(false);
  const pendingSnapFromXRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useLayoutEffect(() => {
    if (pendingSnapFromXRef.current !== null) {
      const startX = pendingSnapFromXRef.current;
      pendingSnapFromXRef.current = null;
      x.set(startX);
      animate(x, 0, { type: 'spring', stiffness: 460, damping: 32 });
    } else {
      x.set(0);
    }
  }, [dockSide, x]);

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
    ...(onOpenReceiptScan
      ? [
          {
            id: 'scan_ticket',
            label: language === 'es' ? 'Escanear Ticket' : 'Escanear Ticket',
            icon: Camera,
            onClick: () => {
              setIsOpen(false);
              onMenuToggle?.(false);
              onOpenReceiptScan();
            },
          },
        ]
      : []),
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

  const isLeft = dockSide === 'left';
  const edgeMargin = viewportWidth >= 640 ? 24 : 16;
  const maxTravel = Math.max(0, viewportWidth - FAB_SIZE_PX - edgeMargin * 2);

  return (
    <motion.div
      ref={containerRef}
      drag={!isOpen ? 'x' : false}
      dragConstraints={isLeft ? { left: 0, right: maxTravel } : { left: -maxTravel, right: 0 }}
      dragElastic={0.08}
      dragMomentum={false}
      onDragStart={() => {
        draggedRef.current = false;
      }}
      onDrag={(_e, info) => {
        if (Math.abs(info.offset.x) > 6) {
          draggedRef.current = true;
        }
      }}
      onDragEnd={(_e, info) => {
        const currentX = x.get();
        const threshold = Math.min(72, maxTravel * 0.35);

        let nextSide: 'left' | 'right' = dockSide;
        if (!isLeft && (currentX < -threshold || info.velocity.x < -300)) {
          nextSide = 'left';
        } else if (isLeft && (currentX > threshold || info.velocity.x > 300)) {
          nextSide = 'right';
        }

        if (nextSide !== dockSide) {
          pendingSnapFromXRef.current =
            nextSide === 'left'
              ? Math.max(0, Math.min(maxTravel, maxTravel + currentX))
              : Math.min(0, Math.max(-maxTravel, currentX - maxTravel));
          setDockSide(nextSide);
          try {
            localStorage.setItem(EDGE_STORAGE_KEY, nextSide);
          } catch {
            // ignore
          }
        } else {
          animate(x, 0, { type: 'spring', stiffness: 460, damping: 32 });
        }

        window.setTimeout(() => {
          draggedRef.current = false;
        }, 80);
      }}
      style={{
        x,
        marginBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
      className={`fixed ${
        isLeft ? 'left-4 sm:left-6 items-start' : 'right-4 sm:right-6 items-end'
      } z-[64] flex flex-col gap-2 print:hidden touch-pan-y ${bottomOffsetClass}`}
    >
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 420, damping: 26 }}
            className={`flex flex-col ${
              isLeft ? 'items-start' : 'items-end'
            } gap-1.5 max-h-[62dvh] overflow-y-auto no-scrollbar`}
          >
            {actions.map((act, idx) => {
              const Icon = act.icon;
              return (
                <motion.button
                  key={act.id}
                  type="button"
                  initial={{ opacity: 0, x: isLeft ? -16 : 16, scale: 0.96 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: isLeft ? -12 : 12, scale: 0.96 }}
                  transition={{
                    delay: idx * 0.025,
                    type: 'spring',
                    stiffness: 460,
                    damping: 26,
                  }}
                  whileHover={{ x: isLeft ? 3 : -3 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={act.onClick}
                  className={`flex ${
                    isLeft ? 'flex-row-reverse' : 'flex-row'
                  } items-center gap-3 px-3.5 py-2 rounded-2xl text-xs font-extrabold text-emerald-950 bg-white border-2 border-emerald-400 shadow-[0_6px_18px_rgba(16,185,129,0.18)] hover:bg-emerald-50/50 transition-all cursor-pointer shrink-0`}
                >
                  <span className="tracking-tight">{act.label}</span>
                  <div className="w-7 h-7 rounded-xl bg-emerald-500/15 border border-emerald-400 text-emerald-700 flex items-center justify-center">
                    <Icon className="w-3.5 h-3.5 stroke-[2.4]" />
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transparent Emerald Glass Edge-Docked FAB */}
      <motion.button
        type="button"
        onClick={toggleMenu}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.93 }}
        style={{
          background:
            'linear-gradient(145deg, rgba(52, 211, 153, 0.24), rgba(16, 185, 129, 0.12))',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }}
        className={`w-12 h-12 rounded-full flex items-center justify-center text-emerald-950 border-2 border-emerald-400/90 shadow-[0_8px_22px_rgba(16,185,129,0.22),inset_0_1px_1px_rgba(255,255,255,0.75)] transition-all cursor-grab active:cursor-grabbing ${
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
              <X className="w-5 h-5 stroke-[2.5]" />
            </motion.div>
          ) : (
            <motion.div
              key="add"
              initial={{ rotate: 90, opacity: 0, scale: 0.8 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: -90, opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.16 }}
            >
              <Plus className="w-5 h-5 stroke-[2.6]" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </motion.div>
  );
};
