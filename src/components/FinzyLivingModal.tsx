import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, MessageSquare, Palette, Mic, Sparkles, Hand, ArrowUp, RotateCw, Coffee, Glasses } from 'lucide-react';
import { LanguageCode, MoneMood } from '../types';
import { FINZY_SKINS, FinzyMascot, FinzyRoutineState } from './FinzyMascot';
import { FinzyLivingContext, getSavedFinzySkinId, saveFinzySkinId } from '../utils/finzyLiving';

interface FinzyLivingModalProps {
  isOpen: boolean;
  onClose: () => void;
  mood: MoneMood;
  moodLabel?: string;
  living: FinzyLivingContext;
  language: LanguageCode;
  onOpenChat: () => void;
}

type FinzyFace = 'auto' | 'happy' | 'excited' | 'focused' | 'surprised' | 'sleepy' | 'zen';
type FinzyMove = 'idle' | 'jump' | 'wave' | 'tilt';

const FACE_OPTIONS: { id: FinzyFace; pt: string; es: string; mood: MoneMood; routine?: FinzyRoutineState }[] = [
  { id: 'auto', pt: 'Automático', es: 'Automático', mood: 'happy' },
  { id: 'happy', pt: 'Feliz', es: 'Feliz', mood: 'happy' },
  { id: 'excited', pt: 'Animado', es: 'Animado', mood: 'happy', routine: 'proud_streak' },
  { id: 'focused', pt: 'Focado', es: 'Concentrado', mood: 'worried' },
  { id: 'surprised', pt: 'Surpreso', es: 'Sorprendido', mood: 'scared' },
  { id: 'sleepy', pt: 'Sonolento / Café', es: 'Somnoliento / Café', mood: 'sleeping', routine: 'madrugada_coffee' },
  { id: 'zen', pt: 'Zen', es: 'Zen', mood: 'calm' },
];

const FACE_KEY = 'sisfinz_finzy_face_v1';

export const FinzyLivingModal: React.FC<FinzyLivingModalProps> = ({
  isOpen, onClose, mood, living, language, onOpenChat,
}) => {
  const isEs = language === 'es';
  const [studio, setStudio] = useState(false);
  const [skinId, setSkinId] = useState(() => getSavedFinzySkinId());
  const [face, setFace] = useState<FinzyFace>(() => {
    try { return (localStorage.getItem(FACE_KEY) as FinzyFace) || 'auto'; } catch { return 'auto'; }
  });
  const [move, setMove] = useState<FinzyMove>('idle');
  const liveTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setStudio(false);
      if (liveTimer.current) window.clearTimeout(liveTimer.current);
      return;
    }
    setSkinId(getSavedFinzySkinId());
    // Abre o modo de voz já existente no FinzyChatModal, que usa o token seguro do servidor.
    onOpenChat();
    liveTimer.current = window.setTimeout(() => {
      window.dispatchEvent(new Event('sisfinz:finzy-open-live'));
    }, 450);
    return () => {
      if (liveTimer.current) window.clearTimeout(liveTimer.current);
    };
  }, [isOpen]);

  const triggerMove = (next: Exclude<FinzyMove, 'idle'>) => {
    setMove(next);
    window.setTimeout(() => setMove(current => current === next ? 'idle' : current), 700);
  };

  const selectSkin = (id: string) => {
    setSkinId(id);
    saveFinzySkinId(id);
    triggerMove('jump');
  };

  const selectFace = (id: FinzyFace) => {
    setFace(id);
    try { localStorage.setItem(FACE_KEY, id); } catch { /* armazenamento opcional */ }
    triggerMove('tilt');
  };

  const activeFace = FACE_OPTIONS.find(option => option.id === face) || FACE_OPTIONS[0];
  const previewMood = face === 'auto' ? mood : activeFace.mood;
  const previewRoutine = face === 'auto' ? living.routineState : (activeFace.routine || 'normal');
  const moveAnimation = move === 'jump'
    ? { y: [0, -14, 0, -5, 0], scale: [1, 1.12, 0.96, 1.04, 1], rotate: 0 }
    : move === 'wave'
      ? { rotate: [0, -15, 15, -10, 10, 0], y: 0, scale: [1, 1.05, 1] }
      : move === 'tilt'
        ? { rotate: [0, 13, -9, 0], y: 0, scale: [1, 1.04, 1] }
        : { y: [0, -2, 0], rotate: 0, scale: 1 };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="absolute inset-0 bg-slate-900/45 backdrop-blur-xs" />
          <motion.div initial={{ opacity: 0, y: 28, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 28, scale: 0.97 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="relative z-10 flex max-h-[88dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[2rem] sm:rounded-[2rem] border border-emerald-200 bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3.5 text-white">
              <div className="flex items-center gap-2">
                {studio ? <button type="button" onClick={() => setStudio(false)} className="rounded-xl bg-white/15 px-2.5 py-1.5 text-xs font-black">← {isEs ? 'Volver' : 'Voltar'}</button> : <Sparkles className="h-5 w-5" />}
                <span className="text-sm font-black">{studio ? 'Estilizar Finzy' : 'Finzy • Live'}</span>
              </div>
              <div className="flex items-center gap-2">
                {!studio && <button type="button" onClick={() => setStudio(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-[11px] font-black hover:bg-white/25"><Palette className="h-3.5 w-3.5" />{isEs ? 'Estilizar' : 'Estilizar Finzy'}</button>}
                <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-xl p-1.5 hover:bg-white/15"><X className="h-5 w-5" /></button>
              </div>
            </div>

            {!studio ? (
              <div className="flex flex-col items-center gap-5 p-6 text-center">
                <div className="space-y-1">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">{isEs ? 'Modo de voz en vivo' : 'Modo Live em tempo real'}</p>
                  <p className="text-xs text-slate-500">{isEs ? 'Finzy está listo para escucharte.' : 'O Finzy está pronto para ouvir você.'}</p>
                </div>
                <motion.div animate={{ scale: [1, 1.04, 1], y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 2.2 }}
                  className="flex h-40 w-40 items-center justify-center rounded-full border-2 border-emerald-200 bg-emerald-50 shadow-inner">
                  <FinzyMascot mood={mood} routineState={living.routineState} skinId={skinId} size={108} />
                </motion.div>
                <div className="w-full space-y-2">
                  <button type="button" onClick={() => { onOpenChat(); window.setTimeout(() => window.dispatchEvent(new Event('sisfinz:finzy-open-live')), 350); }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 text-xs font-black uppercase tracking-wider text-white shadow-md hover:bg-emerald-500">
                    <Mic className="h-4 w-4" />{isEs ? 'Abrir voz en vivo' : 'Abrir Modo Live'}
                  </button>
                  <button type="button" onClick={() => { onClose(); onOpenChat(); }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-emerald-500 bg-emerald-50 py-3.5 text-xs font-black uppercase tracking-wider text-emerald-950 hover:bg-emerald-100">
                    <MessageSquare className="h-4 w-4" />{isEs ? 'Modo Chat' : 'Modo Chat'}
                  </button>
                </div>
                <p className="text-[10px] font-medium text-slate-400">{isEs ? 'Puedes silenciar o finalizar la voz desde la pantalla Live.' : 'Você pode silenciar ou encerrar a voz na tela Live.'}</p>
              </div>
            ) : (
              <div className="max-h-[76dvh] space-y-5 overflow-y-auto p-5">
                <div className="flex flex-col items-center gap-3 rounded-3xl border border-emerald-200 bg-gradient-to-b from-emerald-50 to-white p-5">
                  <motion.div animate={moveAnimation} transition={{ type: 'spring', stiffness: 420, damping: 18 }}>
                    <FinzyMascot mood={previewMood} routineState={previewRoutine} skinId={skinId} size={104} />
                  </motion.div>
                  <p className="text-[10px] font-bold text-slate-500">{isEs ? 'Toque nos gestos para testar' : 'Toque nos gestos para testar'}</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <button type="button" onClick={() => triggerMove('jump')} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black text-slate-700"><ArrowUp className="h-3 w-3 text-emerald-600" />{isEs ? 'Saltar' : 'Pular'}</button>
                    <button type="button" onClick={() => triggerMove('wave')} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black text-slate-700"><Hand className="h-3 w-3 text-emerald-600" />{isEs ? 'Saludar' : 'Acenar'}</button>
                    <button type="button" onClick={() => triggerMove('tilt')} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black text-slate-700"><RotateCw className="h-3 w-3 text-emerald-600" />{isEs ? 'Inclinar' : 'Inclinar'}</button>
                  </div>
                </div>

                <section className="space-y-2">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-500">{isEs ? 'Caras y expresiones' : 'Caras e expressões'}</h4>
                  <div className="flex flex-wrap gap-2">
                    {FACE_OPTIONS.map(option => <button key={option.id} type="button" onClick={() => selectFace(option.id)}
                      className={`rounded-xl px-3 py-2 text-[11px] font-black transition-all ${face === option.id ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                      {isEs ? option.es : option.pt}
                    </button>)}
                  </div>
                </section>

                <section className="space-y-2">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-500">{isEs ? 'Colores del Finzy' : 'Cores do Finzy'}</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {FINZY_SKINS.map(skin => {
                      const selected = skinId === skin.id;
                      return <button key={skin.id} type="button" onClick={() => selectSkin(skin.id)}
                        className={`flex items-center gap-2 rounded-2xl border p-2.5 text-left transition-all ${selected ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:border-emerald-300'}`}>
                        <span className="h-7 w-7 shrink-0 rounded-xl border border-white shadow-sm" style={{ background: `linear-gradient(135deg, ${skin.bodyStart}, ${skin.bodyEnd})` }} />
                        <span className="min-w-0 truncate text-[11px] font-black text-slate-800">{isEs ? skin.nameEs : skin.namePt}</span>
                        {selected && <span className="ml-auto text-emerald-600">✓</span>}
                      </button>;
                    })}
                  </div>
                </section>
                <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-[10px] font-semibold text-emerald-800"><Coffee className="mr-1 inline h-3 w-3" />{isEs ? 'Los cambios se guardan en este dispositivo.' : 'As alterações ficam salvas neste dispositivo.'}</div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
