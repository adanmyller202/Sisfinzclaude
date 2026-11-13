/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  useEffect(() => {
    if (!isOpen) return;
    const scrollY = window.scrollY;
    const body = document.body;
    const html = document.documentElement;
    const previousBody = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    const previousHtmlOverflow = html.style.overflow;

    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';

    return () => {
      body.style.position = previousBody.position;
      body.style.top = previousBody.top;
      body.style.left = previousBody.left;
      body.style.right = previousBody.right;
      body.style.width = previousBody.width;
      body.style.overflow = previousBody.overflow;
      html.style.overflow = previousHtmlOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[10050] flex items-center justify-center p-3 sm:p-4 glass-overlay overflow-hidden overscroll-none"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 30 }}
            transition={{ type: "spring", damping: 25, stiffness: 400 }}
            className="glass-modal rounded-3xl max-w-sm w-full max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2.5rem)] flex flex-col overflow-hidden relative"
          >
            {/* Header with Danger mesh */}
            <div className="relative p-5 sm:p-6 shrink-0 overflow-hidden text-center">
              <div className="absolute inset-0 mesh-gradient opacity-10 from-rose-500/40" />
              <motion.div 
                initial={{ rotate: -15, scale: 0.8 }}
                animate={{ rotate: 0, scale: 1 }}
                className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center mx-auto mb-3 shadow-inner border border-rose-500/20"
              >
                <ShieldAlert className="w-7 h-7" />
              </motion.div>
              
              <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight leading-tight uppercase break-words">
                {title}
              </h3>
              <p className="text-[10px] font-black text-rose-500 uppercase tracking-[0.4em] mt-2">
                AÇÃO IRREVERSÍVEL
              </p>
            </div>

            <div className="px-5 sm:px-6 pb-5 sm:pb-6 space-y-4 overflow-y-auto overscroll-contain min-h-0">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 leading-relaxed text-center break-words">
                {message}
              </p>

              <div className="flex flex-col gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onConfirm}
                  disabled={isLoading}
                  className="w-full py-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-lg shadow-rose-600/20 disabled:opacity-50 uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2 transition-all"
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
                  className="w-full py-3 text-[10px] font-black text-slate-400 hover:text-slate-900 dark:hover:text-white uppercase tracking-widest transition-colors cursor-pointer"
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
    </AnimatePresence>,
    document.body
  );
};
