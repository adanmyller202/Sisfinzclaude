import React, { useState, useRef, useEffect } from 'react';
import { Plus, X, Receipt, ArrowUpCircle, ArrowDownCircle, ArrowLeftRight, Clock } from 'lucide-react';
import { LanguageCode } from '../types';
import { getTranslation } from '../utils/i18n';
import { QuickPunchModal } from './labor/QuickPunchModal';

interface QuickActionFABProps {
  onAddBill: () => void;
  onAddExpense: () => void;
  onAddIncome: () => void;
  onAddTransfer?: () => void;
  language?: LanguageCode;
}

export const QuickActionFAB: React.FC<QuickActionFABProps> = ({
  onAddBill,
  onAddExpense,
  onAddIncome,
  onAddTransfer,
  language = 'pt',
}) => {
  const t = (key: string) => getTranslation(language, key);
  const [isOpen, setIsOpen] = useState(false);
  const [isQuickPunchOpen, setIsQuickPunchOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const actions = [
    {
      id: 'punch',
      label: language === 'es' ? 'Marcar Punto' : language === 'en' ? 'Clock In/Out' : 'Marcar Ponto',
      icon: Clock,
      bg: 'bg-teal-600 hover:bg-teal-500 text-white shadow-teal-600/30',
      onClick: () => setIsQuickPunchOpen(true),
    },
    ...(onAddTransfer
      ? [
          {
            id: 'transfer',
            label: t('transfer'),
            icon: ArrowLeftRight,
            bg: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30',
            onClick: onAddTransfer,
          },
        ]
      : []),
    {
      id: 'income',
      label: t('income'),
      icon: ArrowUpCircle,
      bg: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30',
      onClick: onAddIncome,
    },
    {
      id: 'expense',
      label: t('expense'),
      icon: ArrowDownCircle,
      bg: 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30',
      onClick: onAddExpense,
    },
    {
      id: 'bill',
      label: t('bill'),
      icon: Receipt,
      bg: 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30',
      onClick: onAddBill,
    },
  ];

  return (
    <>
      <div
        ref={containerRef}
        className="fixed bottom-24 right-4 sm:bottom-6 sm:right-6 z-40 flex flex-col items-end gap-2.5"
      >
        {/* Action items */}
        <div
          className={`flex flex-col items-end gap-2 transition-all duration-200 ${
            isOpen
              ? 'opacity-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 translate-y-4 pointer-events-none'
          }`}
        >
          {actions.map((action, idx) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => {
                  setIsOpen(false);
                  action.onClick();
                }}
                style={{ transitionDelay: isOpen ? `${idx * 35}ms` : '0ms' }}
                className="flex items-center gap-2.5 group cursor-pointer"
              >
                <span className="px-3 py-1.5 rounded-xl bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-md text-xs font-bold text-slate-800 whitespace-nowrap group-hover:bg-white transition-colors">
                  {action.label}
                </span>
                <span
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg transition-transform active:scale-90 ${action.bg}`}
                >
                  <Icon className="w-5 h-5" />
                </span>
              </button>
            );
          })}
        </div>

        {/* Main FAB button */}
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label={isOpen ? t('closeQuickMenu') : t('newRecord')}
          className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl transition-all duration-200 active:scale-95 cursor-pointer ${
            isOpen
              ? 'bg-slate-800 text-white shadow-slate-900/30 rotate-45'
              : 'bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-emerald-600/35 hover:shadow-emerald-600/50'
          }`}
        >
          {isOpen ? <X className="w-6 h-6 -rotate-45" /> : <Plus className="w-7 h-7" />}
        </button>
      </div>

      {/* Quick Punch Modal from Home FAB */}
      <QuickPunchModal
        isOpen={isQuickPunchOpen}
        onClose={() => setIsQuickPunchOpen(false)}
        language={language}
      />
    </>
  );
};
