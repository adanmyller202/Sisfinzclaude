import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Clock,
} from 'lucide-react';
import { LanguageCode } from '../types';
import { QuickPunchModal } from './labor/QuickPunchModal';

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

const POS_STORAGE_KEY = 'sisfinz_quick_fab_pos_v2';
const LEGACY_EDGE_KEY = 'sisfinz_quick_fab_edge_v1';
const FAB_SIZE = 48;

interface StoredFabPos {
  side: 'left' | 'right';
  yRatio: number; // 0 (top safe bound) -> 1 (bottom safe bound)
}

function loadStoredPos(): StoredFabPos {
  if (typeof window === 'undefined') return { side: 'right', yRatio: 1 };
  try {
    const raw = localStorage.getItem(POS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const side = parsed?.side === 'left' ? 'left' : 'right';
      const yRatio =
        typeof parsed?.yRatio === 'number' && Number.isFinite(parsed.yRatio)
          ? Math.max(0, Math.min(1, parsed.yRatio))
          : 1;
      return { side, yRatio };
    }
    const legacy = localStorage.getItem(LEGACY_EDGE_KEY);
    if (legacy === 'left') return { side: 'left', yRatio: 1 };
  } catch {
    // ignore storage errors
  }
  return { side: 'right', yRatio: 1 };
}

function getSafeBounds() {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 390;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 844;
  const edgeMargin = vw >= 640 ? 24 : 16;

  // Detect top navbar height if mounted so the FAB never overlaps the top bar
  let topGuard = 86;
  let bottomGuard = 94;
  if (typeof document !== 'undefined') {
    const headerEl = document.querySelector('header');
    if (headerEl) {
      const rect = headerEl.getBoundingClientRect();
      if (rect.bottom > 40 && rect.bottom < vh * 0.35) {
        topGuard = Math.max(topGuard, Math.ceil(rect.bottom) + 12);
      }
    }
    const bottomNavEl = document.querySelector('nav.fixed.bottom-0, [data-bottom-nav="true"]');
    if (bottomNavEl) {
      const rect = bottomNavEl.getBoundingClientRect();
      const navHeight = vh - rect.top;
      if (navHeight > 40 && navHeight < vh * 0.35) {
        bottomGuard = Math.max(bottomGuard, Math.ceil(navHeight) + 14);
      }
    }
  }

  const leftX = edgeMargin;
  const rightX = Math.max(edgeMargin, vw - FAB_SIZE - edgeMargin);
  const minY = topGuard;
  const maxY = Math.max(minY + 40, vh - FAB_SIZE - bottomGuard);

  return { vw, vh, leftX, rightX, minY, maxY };
}

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
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isQuickPunchOpen, setIsQuickPunchOpen] = useState(false);
  const initialStored = useRef<StoredFabPos>(loadStoredPos());
  const [dockSide, setDockSide] = useState<'left' | 'right'>(initialStored.current.side);
  const [openDownwards, setOpenDownwards] = useState<boolean>(
    initialStored.current.yRatio < 0.45
  );
  const [viewport, setViewport] = useState(() => {
    const b = getSafeBounds();
    return { vw: b.vw, vh: b.vh };
  });

  const initialBounds = getSafeBounds();
  const initialX =
    initialStored.current.side === 'left' ? initialBounds.leftX : initialBounds.rightX;
  const initialY =
    initialBounds.minY +
    initialStored.current.yRatio * Math.max(0, initialBounds.maxY - initialBounds.minY);

  const x = useMotionValue(initialX);
  const y = useMotionValue(initialY);

  const containerRef = useRef<HTMLDivElement>(null);
  const draggedRef = useRef(false);
  const yRatioRef = useRef<number>(initialStored.current.yRatio);
  const dockSideRef = useRef<'left' | 'right'>(initialStored.current.side);

  const syncToViewport = useCallback(() => {
    const b = getSafeBounds();
    setViewport({ vw: b.vw, vh: b.vh });
    const targetX = dockSideRef.current === 'left' ? b.leftX : b.rightX;
    const targetY = b.minY + yRatioRef.current * Math.max(0, b.maxY - b.minY);
    x.set(targetX);
    y.set(targetY);
    setOpenDownwards(yRatioRef.current < 0.45);
  }, [x, y]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Sync once after mount so header/bottom-nav measurements are exact
    const raf = window.requestAnimationFrame(syncToViewport);
    window.addEventListener('resize', syncToViewport);
    window.addEventListener('orientationchange', syncToViewport);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', syncToViewport);
      window.removeEventListener('orientationchange', syncToViewport);
    };
  }, [syncToViewport]);

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
      id: 'punch',
      label:
        language === 'es'
          ? 'Marcar Punto'
          : language === 'en'
          ? 'Clock In / Out'
          : 'Marcar Ponto',
      icon: Clock,
      onClick: () => {
        setIsOpen(false);
        onMenuToggle?.(false);
        setIsQuickPunchOpen(true);
      },
    },
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

  return (
    <>
      <motion.div
        ref={containerRef}
        drag={!isOpen}
        dragConstraints={{
          left: 0,
          right: Math.max(0, viewport.vw - FAB_SIZE),
          top: 0,
          bottom: Math.max(0, viewport.vh - FAB_SIZE),
        }}
        dragElastic={0.08}
        dragMomentum={false}
        onDragStart={() => {
          draggedRef.current = false;
        }}
        onDrag={(_e, info) => {
          if (Math.abs(info.offset.x) > 6 || Math.abs(info.offset.y) > 6) {
            draggedRef.current = true;
          }
        }}
        onDragEnd={(_e, info) => {
          const b = getSafeBounds();
          const curX = x.get();
          const curY = y.get();

          // Always snap strictly to the left or right lateral edge (never stay in the middle)
          const centerX = curX + FAB_SIZE / 2;
          let nextSide: 'left' | 'right' = centerX < b.vw / 2 ? 'left' : 'right';
          if (info.velocity.x < -380) nextSide = 'left';
          else if (info.velocity.x > 380) nextSide = 'right';

          const targetX = nextSide === 'left' ? b.leftX : b.rightX;

          // Always clamp vertical position out of the top & bottom menu zones
          const targetY = Math.max(b.minY, Math.min(b.maxY, curY));
          const nextRatio =
            b.maxY > b.minY
              ? Math.max(0, Math.min(1, (targetY - b.minY) / (b.maxY - b.minY)))
              : 1;

          dockSideRef.current = nextSide;
          yRatioRef.current = nextRatio;
          setDockSide(nextSide);
          setOpenDownwards(nextRatio < 0.45);

          animate(x, targetX, { type: 'spring', stiffness: 460, damping: 32 });
          animate(y, targetY, { type: 'spring', stiffness: 460, damping: 32 });

          try {
            localStorage.setItem(
              POS_STORAGE_KEY,
              JSON.stringify({ side: nextSide, yRatio: nextRatio })
            );
            localStorage.setItem(LEGACY_EDGE_KEY, nextSide);
          } catch {
            // ignore
          }

          window.setTimeout(() => {
            draggedRef.current = false;
          }, 80);
        }}
        style={{ x, y }}
        className="fixed top-0 left-0 z-[64] print:hidden select-none touch-none"
      >
        {/* Contextual Action Menu (opens upwards when docked low, downwards when docked high) */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: openDownwards ? -10 : 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: openDownwards ? -8 : 8, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 420, damping: 26 }}
              className={`absolute ${isLeft ? 'left-0 items-start' : 'right-0 items-end'} ${
                openDownwards ? 'top-full mt-2.5' : 'bottom-full mb-2.5'
              } flex flex-col gap-1.5 max-h-[58dvh] overflow-y-auto no-scrollbar`}
            >
              {actions.map((act, idx) => {
                const Icon = act.icon;
                return (
                  <motion.button
                    key={act.id}
                    type="button"
                    initial={{ opacity: 0, x: isLeft ? -14 : 14, scale: 0.96 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: isLeft ? -10 : 10, scale: 0.96 }}
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
                    } items-center gap-3 px-3.5 py-2 rounded-2xl text-xs font-extrabold text-emerald-950 bg-white border-2 border-emerald-400 shadow-[0_6px_18px_rgba(16,185,129,0.18)] hover:bg-emerald-50/50 transition-all cursor-pointer shrink-0 whitespace-nowrap`}
                  >
                    <span className="tracking-tight">{act.label}</span>
                    <div className="w-7 h-7 rounded-xl bg-emerald-500/15 border border-emerald-400 text-emerald-700 flex items-center justify-center shrink-0">
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

      {/* Quick Punch Modal (Marcar Ponto) from Home FAB */}
      <QuickPunchModal
        isOpen={isQuickPunchOpen}
        onClose={() => setIsQuickPunchOpen(false)}
        language={language}
      />
    </>
  );
};
