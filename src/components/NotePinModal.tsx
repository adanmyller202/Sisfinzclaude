import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, X, Delete, ShieldCheck } from 'lucide-react';
import { LanguageCode } from '../types';

interface NotePinModalProps {
  isOpen: boolean;
  mode: 'create' | 'unlock';
  onClose: () => void;
  onSubmitPin: (pin: string) => Promise<boolean>;
  language?: LanguageCode;
}

export const NotePinModal: React.FC<NotePinModalProps> = ({
  isOpen,
  mode,
  onClose,
  onSubmitPin,
  language = 'pt',
}) => {
  const isEs = language === 'es';
  const [digits, setDigits] = useState('');
  const [errorShake, setErrorShake] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setDigits('');
      setErrorText(null);
      setErrorShake(false);
    }
  }, [isOpen]);

  const handlePress = async (num: string) => {
    if (digits.length >= 4) return;
    const next = `${digits}${num}`;
    setDigits(next);
    setErrorText(null);

    if (next.length === 4) {
      const ok = await onSubmitPin(next);
      if (ok) {
        setDigits('');
        onClose();
      } else {
        setErrorShake(true);
        setErrorText(isEs ? 'PIN incorrecto. Intenta de nuevo.' : 'PIN incorreto. Tente novamente.');
        window.setTimeout(() => {
          setErrorShake(false);
          setDigits('');
        }, 420);
      }
    }
  };

  const handleBackspace = () => {
    setDigits((prev) => prev.slice(0, -1));
    setErrorText(null);
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 18 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="relative z-10 w-full max-w-xs overflow-hidden rounded-[2rem] border border-emerald-200 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3.5 text-white">
              <div className="flex items-center gap-2">
                {mode === 'create' ? (
                  <ShieldCheck className="h-4 w-4 text-emerald-100" />
                ) : (
                  <Lock className="h-4 w-4 text-emerald-100" />
                )}
                <span className="text-xs font-black uppercase tracking-wider">
                  {mode === 'create'
                    ? isEs
                      ? 'Crear PIN de Notas'
                      : 'Criar PIN das Notas'
                    : isEs
                    ? 'Nota Protegida'
                    : 'Nota Protegida'}
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-1 text-white/85 hover:bg-white/15 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-center">
              <p className="text-xs font-semibold text-slate-600">
                {mode === 'create'
                  ? isEs
                    ? 'Elige un PIN de 4 dígitos para bloquear tus notas privadas.'
                    : 'Escolha um PIN de 4 dígitos para proteger suas notas privadas.'
                  : isEs
                  ? 'Ingresa tu PIN de 4 dígitos para abrir esta nota.'
                  : 'Digite seu PIN de 4 dígitos para desbloquear esta nota.'}
              </p>

              {/* 4-dot PIN indicator */}
              <motion.div
                animate={errorShake ? { x: [-8, 8, -6, 6, 0] } : { x: 0 }}
                transition={{ duration: 0.35 }}
                className="flex items-center justify-center gap-3 py-1"
              >
                {[0, 1, 2, 3].map((idx) => {
                  const filled = idx < digits.length;
                  return (
                    <span
                      key={idx}
                      className={`h-3.5 w-3.5 rounded-full border-2 transition-all ${
                        filled
                          ? 'border-emerald-600 bg-emerald-600 scale-110'
                          : 'border-slate-300 bg-slate-100'
                      }`}
                    />
                  );
                })}
              </motion.div>

              {errorText && (
                <div className="text-[11px] font-bold text-rose-600">{errorText}</div>
              )}

              {/* Numeric Keypad */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
                  <motion.button
                    key={n}
                    type="button"
                    whileTap={{ scale: 0.92 }}
                    onClick={() => void handlePress(n)}
                    className="h-12 rounded-2xl border border-slate-200 bg-slate-50 font-mono text-base font-black text-slate-900 hover:border-emerald-400 hover:bg-emerald-50/60 cursor-pointer"
                  >
                    {n}
                  </motion.button>
                ))}
                <div />
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.92 }}
                  onClick={() => void handlePress('0')}
                  className="h-12 rounded-2xl border border-slate-200 bg-slate-50 font-mono text-base font-black text-slate-900 hover:border-emerald-400 hover:bg-emerald-50/60 cursor-pointer"
                >
                  0
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.92 }}
                  onClick={handleBackspace}
                  className="flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 cursor-pointer"
                  aria-label="Apagar dígito"
                >
                  <Delete className="h-4 w-4" />
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
