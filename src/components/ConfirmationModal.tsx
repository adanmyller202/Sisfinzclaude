/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trash2, AlertTriangle, ShieldAlert } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  loadingLabel?: string;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  isLoading = false,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  loadingLabel = 'Processando...',
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="glass-overlay p-4 overflow-hidden"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 30 }}
            transition={{ type: "spring", damping: 25, stiffness: 400 }}
            className="glass-modal rounded-[2.5rem] max-w-sm w-full overflow-hidden relative"
          >
            {/* Header with Danger mesh */}
            <div className="relative p-8 shrink-0 overflow-hidden text-center">
              <div className="absolute inset-0 mesh-gradient opacity-10 from-rose-500/40" />
              <motion.div 
                initial={{ rotate: -15, scale: 0.8 }}
                animate={{ rotate: 0, scale: 1 }}
                className="w-20 h-20 rounded-[2rem] bg-rose-500/10 text-rose-600 flex items-center justify-center mx-auto mb-6 shadow-inner border border-rose-500/20"
              >
                <ShieldAlert className="w-10 h-10" />
              </motion.div>
              
              <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-tight uppercase">
                {title}
              </h3>
              <p className="text-[10px] font-black text-rose-500 uppercase tracking-[0.4em] mt-2">
                AÇÃO IRREVERSÍVEL
              </p>
            </div>

            <div className="px-8 pb-8 space-y-8">
              <p className="text-[12px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-relaxed text-center">
                {message}
              </p>

              <div className="flex flex-col gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onConfirm}
                  disabled={isLoading}
                  className="w-full py-5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-black shadow-2xl shadow-rose-600/30 disabled:opacity-50 uppercase tracking-[0.3em] cursor-pointer flex items-center justify-center gap-3 transition-all"
                >
                  {isLoading ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                      <AlertTriangle className="w-4 h-4" />
                    </motion.div>
                  ) : <Trash2 className="w-4 h-4" />}
                  <span>{isLoading ? loadingLabel : confirmLabel}</span>
                </motion.button>

                <button
                  onClick={onCancel}
                  disabled={isLoading}
                  className="w-full py-5 text-[10px] font-black text-slate-400 hover:text-slate-900 dark:hover:text-white uppercase tracking-[0.4em] transition-colors cursor-pointer"
                >
                  {cancelLabel}
                </button>
              </div>
            </div>

            {/* Subtle Close Button Top Right */}
            <button 
              onClick={onCancel} 
              className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-all cursor-pointer flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
