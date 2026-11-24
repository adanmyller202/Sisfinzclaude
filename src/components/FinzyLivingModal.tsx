import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  MessageSquare,
  Palette,
  Mic,
  Sparkles,
  Hand,
  ArrowUp,
  RotateCw,
  Coffee,
} from 'lucide-react';
import { LanguageCode, MoneMood } from '../types';
import {
  FINZY_SKINS,
  FinzyCustomFace,
  FinzyGesture,
  FinzyMascot,
  getSavedFinzyFace,
  saveFinzyFace,
} from './FinzyMascot';
import {
  FinzyLivingContext,
  getSavedFinzySkinId,
  saveFinzySkinId,
} from '../utils/finzyLiving';

interface FinzyLivingModalProps {
  isOpen: boolean;
  onClose: () => void;
  mood: MoneMood;
  moodLabel?: string;
  living: FinzyLivingContext;
  language: LanguageCode;
  onOpenChat: () => void;
}

const FACE_OPTIONS: { id: FinzyCustomFace; pt: string; es: string }[] = [
  { id: 'auto', pt: 'Automático', es: 'Automático' },
  { id: 'happy', pt: 'Feliz', es: 'Feliz' },
  { id: 'excited', pt: 'Animado', es: 'Animado' },
  { id: 'focused', pt: 'Focado', es: 'Concentrado' },
  { id: 'surprised', pt: 'Surpreso', es: 'Sorprendido' },
  { id: 'sleepy', pt: 'Sonolento / Café', es: 'Somnoliento / Café' },
  { id: 'zen', pt: 'Zen', es: 'Zen' },
];

export const FinzyLivingModal: React.FC<FinzyLivingModalProps> = ({
  isOpen,
  onClose,
  mood,
  living,
  language,
  onOpenChat,
}) => {
  const isEs = language === 'es';
  const [studio, setStudio] = useState(false);
  const [skinId, setSkinId] = useState(() => getSavedFinzySkinId());
  const [face, setFace] = useState<FinzyCustomFace>(() => getSavedFinzyFace());
  const [gesture, setGesture] = useState<FinzyGesture>('idle');
  const [gestureNonce, setGestureNonce] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setStudio(false);
      setGesture('idle');
      return;
    }
    setSkinId(getSavedFinzySkinId());
    setFace(getSavedFinzyFace());
  }, [isOpen]);

  const triggerMove = (next: Exclude<FinzyGesture, 'idle'>) => {
    setGesture(next);
    setGestureNonce((n) => n + 1);
  };

  const selectSkin = (id: string) => {
    setSkinId(id);
    saveFinzySkinId(id);
    triggerMove('jump');
  };

  const selectFace = (id: FinzyCustomFace) => {
    setFace(id);
    saveFinzyFace(id);
    triggerMove('tilt');
  };

  const handleOpenLiveMode = () => {
    onClose();
    onOpenChat();
    window.setTimeout(() => {
      window.dispatchEvent(new Event('sisfinz:finzy-open-live'));
    }, 320);
  };

  const handleOpenChatMode = () => {
    onClose();
    onOpenChat();
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/45 backdrop-blur-xs"
          />

          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 28, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="relative z-10 flex max-h-[88dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[2rem] sm:rounded-[2rem] border border-emerald-200 bg-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3.5 text-white">
              <div className="flex items-center gap-2">
                {studio ? (
                  <button
                    type="button"
                    onClick={() => setStudio(false)}
                    className="rounded-xl bg-white/15 px-2.5 py-1.5 text-xs font-black hover:bg-white/25 cursor-pointer"
                  >
                    ← {isEs ? 'Volver' : 'Voltar'}
                  </button>
                ) : (
                  <Sparkles className="h-5 w-5" />
                )}
                <span className="text-sm font-black">
                  {studio ? 'Estilizar Finzy' : 'Finzy • Live'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {!studio && (
                  <button
                    type="button"
                    onClick={() => setStudio(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-[11px] font-black hover:bg-white/25 cursor-pointer"
                  >
                    <Palette className="h-3.5 w-3.5" />
                    {isEs ? 'Estilizar Finzy' : 'Estilizar Finzy'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fechar"
                  className="rounded-xl p-1.5 hover:bg-white/15 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {!studio ? (
              /* Compact Launcher Card */
              <div className="flex flex-col items-center gap-5 p-6 text-center">
                <div className="space-y-1">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
                    {isEs ? 'Modo Live en tiempo real' : 'Modo Live em tempo real'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {isEs
                      ? 'El Finzy está listo para escucharte.'
                      : 'O Finzy está pronto para ouvir você.'}
                  </p>
                </div>

                <div className="flex h-40 w-40 items-center justify-center rounded-full border-2 border-emerald-200 bg-emerald-50 shadow-inner">
                  <FinzyMascot
                    mood={mood}
                    routineState={living.routineState}
                    skinId={skinId}
                    customFace={face}
                    gesture={gesture}
                    gestureNonce={gestureNonce}
                    size={108}
                    onTapGesture={() => triggerMove('jump')}
                  />
                </div>

                <div className="w-full space-y-2.5">
                  <button
                    type="button"
                    onClick={handleOpenLiveMode}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 text-xs font-black uppercase tracking-wider text-white shadow-md hover:bg-emerald-500 cursor-pointer"
                  >
                    <Mic className="h-4 w-4" />
                    {isEs ? 'Abrir Modo Live' : 'Abrir Modo Live'}
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenChatMode}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-emerald-500 bg-emerald-50 py-3.5 text-xs font-black uppercase tracking-wider text-emerald-950 hover:bg-emerald-100 cursor-pointer"
                  >
                    <MessageSquare className="h-4 w-4" />
                    {isEs ? 'Modo Chat' : 'Modo Chat'}
                  </button>
                </div>

                <p className="text-[10px] font-medium text-slate-400">
                  {isEs
                    ? 'Puedes silenciar o finalizar la voz desde la pantalla Live.'
                    : 'Você pode silenciar ou encerrar a voz na tela Live.'}
                </p>
              </div>
            ) : (
              /* Customization Studio */
              <div className="max-h-[76dvh] space-y-5 overflow-y-auto p-5">
                <div className="flex flex-col items-center gap-3 rounded-3xl border border-emerald-200 bg-gradient-to-b from-emerald-50 to-white p-5">
                  <FinzyMascot
                    mood={mood}
                    routineState={living.routineState}
                    skinId={skinId}
                    customFace={face}
                    gesture={gesture}
                    gestureNonce={gestureNonce}
                    size={104}
                    onTapGesture={() => triggerMove('jump')}
                  />

                  <p className="text-[10px] font-bold text-slate-500">
                    {isEs ? 'Toque nos gestos para testar' : 'Toque nos gestos para testar'}
                  </p>

                  <div className="flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => triggerMove('jump')}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black text-slate-700 hover:border-emerald-400 active:scale-95 transition-all cursor-pointer"
                    >
                      <ArrowUp className="h-3 w-3 text-emerald-600" />
                      {isEs ? 'Saltar' : 'Pular'}
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerMove('wave')}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black text-slate-700 hover:border-emerald-400 active:scale-95 transition-all cursor-pointer"
                    >
                      <Hand className="h-3 w-3 text-emerald-600" />
                      {isEs ? 'Saludar' : 'Acenar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerMove('tilt')}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black text-slate-700 hover:border-emerald-400 active:scale-95 transition-all cursor-pointer"
                    >
                      <RotateCw className="h-3 w-3 text-emerald-600" />
                      {isEs ? 'Inclinar' : 'Inclinar'}
                    </button>
                  </div>
                </div>

                <section className="space-y-2">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    {isEs ? 'Caras y expresiones' : 'Caras e expressões'}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {FACE_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => selectFace(option.id)}
                        className={`rounded-xl px-3 py-2 text-[11px] font-black transition-all cursor-pointer ${
                          face === option.id
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {isEs ? option.es : option.pt}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="space-y-2">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    {isEs ? 'Colores del Finzy' : 'Cores do Finzy'}
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {FINZY_SKINS.map((skin) => {
                      const selected = skinId === skin.id;
                      return (
                        <button
                          key={skin.id}
                          type="button"
                          onClick={() => selectSkin(skin.id)}
                          className={`flex items-center gap-2 rounded-2xl border p-2.5 text-left transition-all cursor-pointer ${
                            selected
                              ? 'border-emerald-500 bg-emerald-50'
                              : 'border-slate-200 bg-white hover:border-emerald-300'
                          }`}
                        >
                          <span
                            className="h-7 w-7 shrink-0 rounded-xl border border-white shadow-sm"
                            style={{
                              background: `linear-gradient(135deg, ${skin.bodyStart}, ${skin.bodyEnd})`,
                            }}
                          />
                          <span className="min-w-0 truncate text-[11px] font-black text-slate-800">
                            {isEs ? skin.nameEs : skin.namePt}
                          </span>
                          {selected && <span className="ml-auto text-emerald-600 font-black">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </section>

                <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-[10px] font-semibold text-emerald-800">
                  <Coffee className="mr-1 inline h-3 w-3" />
                  {isEs
                    ? 'Los cambios se aplican en toda la app y se guardan en este dispositivo.'
                    : 'As alterações já ficam aplicadas na tela inicial e salvas neste dispositivo.'}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
