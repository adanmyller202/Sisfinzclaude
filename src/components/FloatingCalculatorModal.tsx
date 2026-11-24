import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Calculator,
  X,
  Delete,
  RotateCcw,
  Copy,
  Check,
  Sparkles,
  FlaskConical,
  Equal,
} from 'lucide-react';
import { LanguageCode } from '../types';

interface FloatingCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  language?: LanguageCode;
}

type CalcMode = 'simple' | 'scientific';

interface SciKeyDef {
  id: string;
  label: string;
  kind: 'fn' | 'const' | 'op';
  token: string;
  titlePt: string;
  titleEs: string;
}

const SCIENTIFIC_KEYS: SciKeyDef[] = [
  { id: 'sin', label: 'sin', kind: 'fn', token: 'sin(', titlePt: 'Seno (graus)', titleEs: 'Seno (grados)' },
  { id: 'cos', label: 'cos', kind: 'fn', token: 'cos(', titlePt: 'Cosseno (graus)', titleEs: 'Coseno (grados)' },
  { id: 'tan', label: 'tan', kind: 'fn', token: 'tan(', titlePt: 'Tangente (graus)', titleEs: 'Tangente (grados)' },
  { id: 'log', label: 'log', kind: 'fn', token: 'log10(', titlePt: 'Logaritmo base 10', titleEs: 'Logaritmo base 10' },
  { id: 'ln', label: 'ln', kind: 'fn', token: 'ln(', titlePt: 'Logaritmo natural', titleEs: 'Logaritmo natural' },
  { id: 'sqrt', label: '√x', kind: 'fn', token: 'sqrt(', titlePt: 'Raiz quadrada', titleEs: 'Raíz cuadrada' },
  { id: 'sq', label: 'x²', kind: 'op', token: '^2', titlePt: 'Ao quadrado', titleEs: 'Al cuadrado' },
  { id: 'pow', label: 'xʸ', kind: 'op', token: '^', titlePt: 'Potência', titleEs: 'Potencia' },
  { id: 'pi', label: 'π', kind: 'const', token: 'π', titlePt: 'Pi (3,14159...)', titleEs: 'Pi (3,14159...)' },
  { id: 'e', label: 'e', kind: 'const', token: 'e', titlePt: 'Número de Euler', titleEs: 'Número de Euler' },
  { id: 'lpar', label: '(', kind: 'op', token: '(', titlePt: 'Abrir parêntese', titleEs: 'Abrir paréntesis' },
  { id: 'rpar', label: ')', kind: 'op', token: ')', titlePt: 'Fechar parêntese', titleEs: 'Cerrar paréntesis' },
];

const SIMPLE_ROWS: Array<
  Array<{
    label: string;
    value: string;
    variant: 'num' | 'op' | 'fn' | 'eq';
  }>
> = [
  [
    { label: 'C', value: 'CLEAR', variant: 'fn' },
    { label: '%', value: '%', variant: 'fn' },
    { label: '⌫', value: 'BACK', variant: 'fn' },
    { label: '÷', value: '÷', variant: 'op' },
  ],
  [
    { label: '7', value: '7', variant: 'num' },
    { label: '8', value: '8', variant: 'num' },
    { label: '9', value: '9', variant: 'num' },
    { label: '×', value: '×', variant: 'op' },
  ],
  [
    { label: '4', value: '4', variant: 'num' },
    { label: '5', value: '5', variant: 'num' },
    { label: '6', value: '6', variant: 'num' },
    { label: '−', value: '−', variant: 'op' },
  ],
  [
    { label: '1', value: '1', variant: 'num' },
    { label: '2', value: '2', variant: 'num' },
    { label: '3', value: '3', variant: 'num' },
    { label: '+', value: '+', variant: 'op' },
  ],
  [
    { label: '±', value: 'SIGN', variant: 'fn' },
    { label: '0', value: '0', variant: 'num' },
    { label: '.', value: '.', variant: 'num' },
    { label: '=', value: 'EQ', variant: 'eq' },
  ],
];

function evaluateMathExpression(rawExpr: string): string {
  const cleaned = rawExpr.trim();
  if (!cleaned) return '0';

  let jsExpr = cleaned
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/π/g, `(${Math.PI})`)
    .replace(/\be\b/g, `(${Math.E})`)
    .replace(/\^/g, '**')
    .replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');

  // Convert degree trig functions to radians
  jsExpr = jsExpr.replace(/\bsin\(/g, 'Math.sin((Math.PI/180)*');
  jsExpr = jsExpr.replace(/\bcos\(/g, 'Math.cos((Math.PI/180)*');
  jsExpr = jsExpr.replace(/\btan\(/g, 'Math.tan((Math.PI/180)*');
  jsExpr = jsExpr.replace(/\blog10\(/g, 'Math.log10(');
  jsExpr = jsExpr.replace(/\bln\(/g, 'Math.log(');
  jsExpr = jsExpr.replace(/\bsqrt\(/g, 'Math.sqrt(');

  // Auto-close unclosed parentheses safely
  const openParens = (jsExpr.match(/\(/g) || []).length;
  const closeParens = (jsExpr.match(/\)/g) || []).length;
  if (openParens > closeParens) {
    jsExpr += ')'.repeat(openParens - closeParens);
  }

  // Allow only safe mathematical characters & Math.* calls
  const sanitizedCheck = jsExpr.replace(/Math\.[a-zA-Z0-9]+/g, '');
  if (!/^[0-9+\-*/().\s*]*$/.test(sanitizedCheck)) {
    return 'Erro';
  }

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(`"use strict"; return (${jsExpr});`);
    const result = fn();
    if (typeof result !== 'number' || !Number.isFinite(result)) {
      return 'Erro';
    }
    const rounded = Math.round(result * 1e10) / 1e10;
    return String(rounded);
  } catch {
    return 'Erro';
  }
}

export const FloatingCalculatorModal: React.FC<FloatingCalculatorModalProps> = ({
  isOpen,
  onClose,
  language = 'pt',
}) => {
  const reduceMotion = useReducedMotion();
  const isEs = language === 'es';

  const [mode, setMode] = useState<CalcMode>('simple');
  const [expression, setExpression] = useState('');
  const [displayValue, setDisplayValue] = useState('0');
  const [justEvaluated, setJustEvaluated] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lastPressedKey, setLastPressedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setCopied(false);
      setLastPressedKey(null);
    }
  }, [isOpen]);

  const livePreview = useMemo(() => {
    if (!expression || justEvaluated) return '';
    const res = evaluateMathExpression(expression);
    if (res === 'Erro' || res === expression) return '';
    return `= ${res}`;
  }, [expression, justEvaluated]);

  const pulseKey = (id: string) => {
    setLastPressedKey(id);
    window.setTimeout(() => {
      setLastPressedKey((prev) => (prev === id ? null : prev));
    }, 160);
  };

  const handleSimpleAction = (val: string) => {
    pulseKey(val);
    setCopied(false);

    if (val === 'CLEAR') {
      setExpression('');
      setDisplayValue('0');
      setJustEvaluated(false);
      return;
    }

    if (val === 'BACK') {
      if (justEvaluated) {
        setExpression('');
        setDisplayValue('0');
        setJustEvaluated(false);
        return;
      }
      const next = expression.slice(0, -1);
      setExpression(next);
      setDisplayValue(next || '0');
      return;
    }

    if (val === 'SIGN') {
      if (displayValue === '0' || displayValue === 'Erro') return;
      if (displayValue.startsWith('-')) {
        const pos = displayValue.slice(1);
        setDisplayValue(pos);
        setExpression(pos);
      } else {
        const neg = `-${displayValue}`;
        setDisplayValue(neg);
        setExpression(neg);
      }
      setJustEvaluated(false);
      return;
    }

    if (val === 'EQ') {
      if (!expression.trim()) return;
      const evaluated = evaluateMathExpression(expression);
      setDisplayValue(evaluated);
      setJustEvaluated(true);
      return;
    }

    const isOp = ['+', '−', '×', '÷', '%'].includes(val);
    if (justEvaluated && !isOp) {
      setExpression(val === '.' ? '0.' : val);
      setDisplayValue(val === '.' ? '0.' : val);
      setJustEvaluated(false);
      return;
    }

    const nextExpr =
      justEvaluated && isOp
        ? `${displayValue === 'Erro' ? '0' : displayValue}${val}`
        : `${expression}${val}`;

    setExpression(nextExpr);
    setDisplayValue(nextExpr);
    setJustEvaluated(false);
  };

  const handleSciKey = (keyDef: SciKeyDef) => {
    pulseKey(keyDef.id);
    setCopied(false);
    const base = justEvaluated && displayValue !== 'Erro' ? displayValue : expression;
    const nextExpr = `${base}${keyDef.token}`;
    setExpression(nextExpr);
    setDisplayValue(nextExpr);
    setJustEvaluated(false);
  };

  const handleCopyResult = async () => {
    const textToCopy = displayValue;
    if (!textToCopy || textToCopy === 'Erro') return;
    try {
      await navigator.clipboard?.writeText(textToCopy);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  if (typeof document === 'undefined') return null;

  const isScientific = mode === 'scientific';

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/45 backdrop-blur-xs"
          />

          {/* Pop-Up Calculator Card: Expands smoothly when switching to Scientific mode */}
          <motion.div
            layout
            initial={{ opacity: 0, scale: 0.88, y: 24 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              maxWidth: isScientific ? 420 : 336,
            }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{
              layout: { type: 'spring', stiffness: 360, damping: 28 },
              default: { type: 'spring', stiffness: 380, damping: 26 },
            }}
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 w-full overflow-hidden rounded-[2rem] border border-emerald-200/90 bg-white shadow-2xl"
          >
            {/* Header Bar */}
            <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 px-4 py-3 text-white">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/20">
                  <Calculator className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-xs sm:text-sm font-black tracking-tight">
                    {isEs ? 'Calculadora Rápida' : 'Calculadora Rápida'}
                  </h3>
                  <p className="truncate text-[9px] font-bold uppercase tracking-wider text-emerald-100">
                    {isScientific
                      ? isEs
                        ? 'Modo Científico Expandido'
                        : 'Modo Científico Expandido'
                      : isEs
                      ? 'Modo Simple'
                      : 'Modo Simples'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-1.5 text-white/85 hover:bg-white/15 cursor-pointer shrink-0"
                aria-label="Fechar calculadora"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Mode Switcher Pill (Simple <-> Scientific) */}
            <div className="px-3.5 pt-3">
              <div className="relative grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1 border border-slate-200/70">
                <button
                  type="button"
                  onClick={() => setMode('simple')}
                  className={`relative isolate flex items-center justify-center gap-1.5 rounded-xl py-2 text-[11px] font-black transition-colors cursor-pointer ${
                    !isScientific ? 'text-emerald-950' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {!isScientific && (
                    <motion.span
                      layoutId="calc-mode-pill"
                      transition={{ type: 'spring', stiffness: 440, damping: 28 }}
                      className="absolute inset-0 -z-10 rounded-xl bg-white shadow-xs border border-emerald-200/70"
                    />
                  )}
                  <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                  <span>{isEs ? 'Simple' : 'Simples'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('scientific')}
                  className={`relative isolate flex items-center justify-center gap-1.5 rounded-xl py-2 text-[11px] font-black transition-colors cursor-pointer ${
                    isScientific ? 'text-indigo-950' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {isScientific && (
                    <motion.span
                      layoutId="calc-mode-pill"
                      transition={{ type: 'spring', stiffness: 440, damping: 28 }}
                      className="absolute inset-0 -z-10 rounded-xl bg-white shadow-xs border border-indigo-200/80"
                    />
                  )}
                  <FlaskConical className="h-3.5 w-3.5 text-indigo-600" />
                  <span>{isEs ? 'Científica' : 'Científica'}</span>
                </button>
              </div>
            </div>

            {/* Digital Display Screen */}
            <div className="px-3.5 pt-3">
              <div className="relative rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 px-4 py-3 text-right text-white shadow-inner">
                <div className="flex items-center justify-between gap-2 min-h-[18px]">
                  <button
                    type="button"
                    onClick={handleCopyResult}
                    className="inline-flex items-center gap-1 rounded-lg bg-white/10 hover:bg-white/20 px-2 py-0.5 text-[9.5px] font-bold text-emerald-200 transition-colors cursor-pointer"
                    title={isEs ? 'Copiar resultado' : 'Copiar resultado'}
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" />
                        <span>{isEs ? 'Copiado' : 'Copiado'}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>{isEs ? 'Copiar' : 'Copiar'}</span>
                      </>
                    )}
                  </button>

                  <span className="truncate font-mono text-[11px] text-emerald-300/80">
                    {livePreview || (expression && !justEvaluated ? '' : expression)}
                  </span>
                </div>

                <motion.div
                  key={displayValue}
                  initial={!reduceMotion ? { scale: 0.97, opacity: 0.8 } : undefined}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.14 }}
                  className="mt-1 truncate font-mono text-2xl sm:text-3xl font-black tracking-tight text-white"
                >
                  {displayValue}
                </motion.div>
              </div>
            </div>

            {/* Scientific Keys Grid: Appears one-by-one rapidly when expanding, disappears rapidly when collapsing */}
            <AnimatePresence initial={false}>
              {isScientific && (
                <motion.div
                  key="scientific-keypad-section"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{
                    height: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
                    opacity: { duration: 0.18 },
                  }}
                  className="overflow-hidden px-3.5 pt-2.5"
                >
                  <div className="rounded-2xl border border-indigo-200/80 bg-indigo-50/55 p-2">
                    <div className="grid grid-cols-4 gap-1.5">
                      {SCIENTIFIC_KEYS.map((k, index) => {
                        const reverseIndex = SCIENTIFIC_KEYS.length - 1 - index;
                        const isPressed = lastPressedKey === k.id;
                        return (
                          <motion.button
                            key={k.id}
                            type="button"
                            initial={{ opacity: 0, scale: 0.55, y: -8 }}
                            animate={{
                              opacity: 1,
                              scale: isPressed ? 0.9 : 1,
                              y: 0,
                            }}
                            exit={{
                              opacity: 0,
                              scale: 0.55,
                              y: -6,
                              transition: {
                                delay: reverseIndex * 0.018,
                                duration: 0.13,
                              },
                            }}
                            transition={{
                              delay: index * 0.022,
                              type: 'spring',
                              stiffness: 520,
                              damping: 24,
                            }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleSciKey(k)}
                            title={isEs ? k.titleEs : k.titlePt}
                            className={`h-9 rounded-xl font-mono text-xs font-black transition-colors cursor-pointer flex items-center justify-center shadow-2xs ${
                              k.kind === 'const'
                                ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                                : k.kind === 'fn'
                                ? 'bg-white text-indigo-900 border border-indigo-200/80 hover:bg-indigo-100/70'
                                : 'bg-indigo-100/90 text-indigo-950 border border-indigo-200/70 hover:bg-indigo-200/70'
                            }`}
                          >
                            {k.label}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Standard Simple Keypad */}
            <div className="p-3.5 pt-2.5 space-y-1.5">
              {SIMPLE_ROWS.map((row, rIdx) => (
                <div key={rIdx} className="grid grid-cols-4 gap-1.5">
                  {row.map((btn) => {
                    const isPressed = lastPressedKey === btn.value;
                    const baseCls =
                      btn.variant === 'eq'
                        ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-600/25 hover:opacity-95'
                        : btn.variant === 'op'
                        ? 'bg-emerald-100/90 text-emerald-900 border border-emerald-200/80 hover:bg-emerald-200/70'
                        : btn.variant === 'fn'
                        ? 'bg-slate-100 text-slate-800 border border-slate-200/70 hover:bg-slate-200/70'
                        : 'bg-white text-slate-900 border border-slate-200/80 hover:border-emerald-300 shadow-2xs';

                    return (
                      <motion.button
                        key={btn.value}
                        type="button"
                        layout
                        animate={{ scale: isPressed ? 0.91 : 1 }}
                        transition={{ type: 'spring', stiffness: 520, damping: 25 }}
                        whileTap={{ scale: 0.91 }}
                        onClick={() => handleSimpleAction(btn.value)}
                        className={`h-11 rounded-xl font-mono text-sm font-black transition-colors cursor-pointer flex items-center justify-center select-none ${baseCls}`}
                      >
                        {btn.value === 'BACK' ? (
                          <Delete className="h-4 w-4" />
                        ) : btn.value === 'CLEAR' ? (
                          <RotateCcw className="h-4 w-4" />
                        ) : btn.value === 'EQ' ? (
                          <Equal className="h-4 w-4 stroke-[2.8]" />
                        ) : (
                          btn.label
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
