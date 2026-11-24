import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, Eraser, Undo2, Trash2, Check, PenTool } from 'lucide-react';
import { LanguageCode } from '../types';

interface NoteDrawingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveDrawing: (dataUrl: string) => Promise<void> | void;
  language?: LanguageCode;
}

interface Stroke {
  color: string;
  width: number;
  isEraser: boolean;
  points: Array<{ x: number; y: number }>;
}

const PEN_COLORS = ['#0f172a', '#059669', '#0284c7', '#e11d48', '#d97706', '#7c3aed'];
const BRUSH_SIZES = [2.5, 5, 9];

export const NoteDrawingModal: React.FC<NoteDrawingModalProps> = ({
  isOpen,
  onClose,
  onSaveDrawing,
  language = 'pt',
}) => {
  const isEs = language === 'es';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const activeStrokeRef = useRef<Stroke | null>(null);

  const [color, setColor] = useState(PEN_COLORS[0]);
  const [brushSize, setBrushSize] = useState(BRUSH_SIZES[1]);
  const [isEraser, setIsEraser] = useState(false);
  const [strokeCount, setStrokeCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const redrawAll = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const s of strokesRef.current) {
      if (s.points.length === 0) continue;
      ctx.beginPath();
      ctx.strokeStyle = s.isEraser ? '#ffffff' : s.color;
      ctx.lineWidth = s.isEraser ? s.width * 2.4 : s.width;
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) {
        ctx.lineTo(s.points[i].x, s.points[i].y);
      }
      if (s.points.length === 1) {
        ctx.lineTo(s.points[0].x + 0.1, s.points[0].y + 0.1);
      }
      ctx.stroke();
    }
    ctx.restore();
  };

  useEffect(() => {
    if (!isOpen) {
      strokesRef.current = [];
      activeStrokeRef.current = null;
      setStrokeCount(0);
      return;
    }

    const setupCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      redrawAll();
    };

    const timer = window.setTimeout(setupCanvas, 60);
    window.addEventListener('resize', setupCanvas);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', setupCanvas);
    };
  }, [isOpen]);

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = getPoint(e);
    const newStroke: Stroke = {
      color,
      width: brushSize,
      isEraser,
      points: [pt],
    };
    activeStrokeRef.current = newStroke;
    strokesRef.current = [...strokesRef.current, newStroke];
    setStrokeCount(strokesRef.current.length);
    redrawAll();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!activeStrokeRef.current) return;
    activeStrokeRef.current.points.push(getPoint(e));
    redrawAll();
  };

  const handlePointerUp = () => {
    activeStrokeRef.current = null;
  };

  const handleUndo = () => {
    if (strokesRef.current.length === 0) return;
    strokesRef.current = strokesRef.current.slice(0, -1);
    setStrokeCount(strokesRef.current.length);
    redrawAll();
  };

  const handleClear = () => {
    strokesRef.current = [];
    activeStrokeRef.current = null;
    setStrokeCount(0);
    redrawAll();
  };

  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas || strokeCount === 0 || isSaving) return;
    setIsSaving(true);
    try {
      const dataUrl = canvas.toDataURL('image/png');
      await onSaveDrawing(dataUrl);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[88] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/55 backdrop-blur-xs"
          />

          <motion.div
            initial={{ opacity: 0, y: 36, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 36, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            className="relative z-10 flex h-[84dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[2rem] sm:rounded-[2rem] border border-emerald-200 bg-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-white shrink-0">
              <div className="flex items-center gap-2">
                <PenTool className="h-4 w-4 text-emerald-100" />
                <span className="text-sm font-black">
                  {isEs ? 'Dibujo a mano alzada' : 'Desenho à mão livre'}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={strokeCount === 0 || isSaving}
                  className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-1.5 text-xs font-black text-emerald-800 shadow-xs hover:bg-emerald-50 disabled:opacity-45 cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5 stroke-[3]" />
                  {isEs ? 'Insertar' : 'Inserir'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl p-1.5 text-white/85 hover:bg-white/15 cursor-pointer"
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Drawing Tools Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3.5 py-2.5 shrink-0">
              <div className="flex items-center gap-1.5">
                {PEN_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setColor(c);
                      setIsEraser(false);
                    }}
                    style={{ backgroundColor: c }}
                    className={`h-6 w-6 rounded-full cursor-pointer transition-transform ${
                      !isEraser && color === c
                        ? 'ring-2 ring-offset-2 ring-emerald-600 scale-110'
                        : 'opacity-80 hover:opacity-100'
                    }`}
                    aria-label={`Cor ${c}`}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => setIsEraser((v) => !v)}
                  className={`ml-1 rounded-xl border p-1.5 transition-colors cursor-pointer ${
                    isEraser
                      ? 'border-emerald-600 bg-emerald-100 text-emerald-800'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                  title={isEs ? 'Borrador' : 'Borracha'}
                >
                  <Eraser className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                {BRUSH_SIZES.map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setBrushSize(sz)}
                    className={`flex h-7 w-7 items-center justify-center rounded-xl border cursor-pointer ${
                      brushSize === sz
                        ? 'border-emerald-600 bg-emerald-50'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <span
                      style={{ width: sz + 3, height: sz + 3 }}
                      className="rounded-full bg-slate-800"
                    />
                  </button>
                ))}

                <div className="mx-0.5 h-5 w-px bg-slate-200" />

                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={strokeCount === 0}
                  className="rounded-xl border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  title={isEs ? 'Deshacer' : 'Desfazer'}
                >
                  <Undo2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={strokeCount === 0}
                  className="rounded-xl border border-slate-200 bg-white p-1.5 text-rose-500 hover:bg-rose-50 disabled:opacity-40 cursor-pointer"
                  title={isEs ? 'Limpiar' : 'Limpar'}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Canvas Surface */}
            <div className="relative flex-1 bg-white overflow-hidden">
              <canvas
                ref={canvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className="h-full w-full touch-none cursor-crosshair"
              />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
