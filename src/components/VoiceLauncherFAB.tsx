/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { ParsedLancamentoItem } from '../types/voice';
import { AccountItem } from '../types';
import { parseLancamentoLocally } from '../utils/voiceLocalParser';
import {
  Mic,
  Loader2,
  Keyboard,
  X,
  AlertCircle,
  Send,
  Square,
  Volume2,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface VoiceLauncherFABProps {
  isFabMenuOpen?: boolean;
  categories: string[];
  accounts: AccountItem[];
  userPreferences?: Record<string, string>;
  onParsedSuccess: (items: ParsedLancamentoItem[], rawText: string) => void;
  hideFloatingButton?: boolean;
  externalTrigger?: boolean;
  onTriggerComplete?: () => void;
}

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const VoiceLauncherFAB: React.FC<VoiceLauncherFABProps> = ({
  isFabMenuOpen = false,
  categories,
  accounts,
  userPreferences = {},
  onParsedSuccess,
  hideFloatingButton = false,
  externalTrigger = false,
  onTriggerComplete,
}) => {
  const { user } = useAuth();
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'error'>('idle');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [errorTitle, setErrorTitle] = useState('');
  const [errorDetail, setErrorDetail] = useState('');
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualText, setManualText] = useState('');

  const recognitionRef = useRef<any>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const silenceTimeoutRef = useRef<any>(null);

  useEffect(() => {
    if (externalTrigger) { handleToggleVoice(); onTriggerComplete?.(); }
  }, [externalTrigger]);

  const SpeechRecognition = typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;

  const sendPayloadToParser = async (payload: { texto?: string }) => {
    const rawText = payload.texto?.trim() || '';
    if (!rawText) return;
    setStatus('processing');
    try {
      const localResult = parseLancamentoLocally(rawText, categories, userPreferences);
      if (localResult && localResult.length > 0) { onParsedSuccess(localResult, rawText); setStatus('idle'); setLiveTranscript(''); return; }

      const idToken = await user?.getIdToken();
      const response = await fetch('/api/parse-lancamento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ texto: rawText, dataAtual: new Date().toISOString().split('T')[0], categorias: categories, contas: accounts.map(a => ({ id: a.id, name: a.name })), userPreferences }),
      });
      const data = await response.json();
      if (response.ok && data.lancamentos) {
        onParsedSuccess(data.lancamentos.map((it: any, i: number) => ({ ...it, id: `v_${Date.now()}_${i}` })), data.textoTranscrito || rawText);
        setStatus('idle');
      } else throw new Error();
    } catch {
      onParsedSuccess([{ id: `v_f_${Date.now()}`, tipo: 'despesa', descricao: rawText, valor: 0, categoria: categories[0] || 'Outros', data: new Date().toISOString().split('T')[0], confianca: 0.4 }], rawText);
      setStatus('idle');
    }
  };

  const startListening = () => {
    if (!SpeechRecognition) return;
    setLiveTranscript('');
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'pt-BR';
    let accumulated = '';
    recognition.onstart = () => setStatus('listening');
    recognition.onresult = (e: any) => {
      let interim = '', final = '';
      for (let i = e.resultIndex; i < e.results.length; ++i) { if (e.results[i].isFinal) final += e.results[i][0].transcript; else interim += e.results[i][0].transcript; }
      accumulated = (final || interim).trim();
      setLiveTranscript(accumulated);
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = setTimeout(() => recognition.stop(), 2000);
    };
    recognition.onerror = () => setStatus('error');
    recognition.onend = () => { if (accumulated) sendPayloadToParser({ texto: accumulated }); else setStatus('idle'); };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleToggleVoice = () => status === 'listening' ? recognitionRef.current?.stop() : startListening();

  if (isFabMenuOpen) return null;

  return (
    <>
      {!hideFloatingButton && (
        <div className="fixed z-50 transition-all duration-300" style={{ bottom: 'calc(4.5rem + 3.5rem + 12px + env(safe-area-inset-bottom, 0px))', right: '1.4rem' }}>
          <AnimatePresence>
            {status !== 'idle' && (
              <motion.div initial={{ opacity: 0, x: 20, scale: 0.8 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 20, scale: 0.8 }} className="absolute right-14 bottom-0 glass-modal p-4 rounded-2xl w-64">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${status === 'listening' ? 'bg-rose-500 animate-ping' : 'bg-amber-500 animate-pulse'}`} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">{status === 'listening' ? 'Ouvindo...' : 'Analisando...'}</span>
                  </div>
                  <button onClick={() => setStatus('idle')} className="text-slate-400 hover:text-slate-900 transition-colors"><X className="w-3.5 h-3.5" /></button>
                </div>
                <p className="text-xs font-medium text-slate-600 italic">{liveTranscript || 'Fale agora...'}</p>
                {status === 'processing' && <div className="mt-3 h-1 w-full bg-slate-200/80 rounded-full overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 1.5 }} className="h-full bg-emerald-600" /></div>}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleToggleVoice}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-xl transition-all border ${
              status === 'listening' 
                ? 'bg-rose-600 border-rose-500 ring-4 ring-rose-500/20' 
                : 'bg-gradient-to-tr from-purple-600 to-indigo-600 border-purple-500/30'
            }`}
          >
            {status === 'processing' ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Mic className="w-5 h-5 text-white" />}
          </motion.button>
        </div>
      )}

      {isManualModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 glass-overlay" onClick={() => setIsManualModalOpen(false)} />
          <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="glass-modal w-full max-w-md p-8 rounded-[2.5rem] shadow-2xl relative z-10">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center"><Keyboard className="w-5 h-5" /></div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">Comando de Voz</h3>
              </div>
              <button onClick={() => setIsManualModalOpen(false)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400"><X className="w-5 h-5" /></button>
            </div>
            <textarea
              value={manualText}
              onChange={e => setManualText(e.target.value)}
              placeholder='Ex: "Gastei 50 reais no iFood hoje"'
              className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-medium focus:ring-2 focus:ring-purple-500/20 transition-all outline-none resize-none"
            />
            <div className="flex gap-3 mt-6">
              <button onClick={() => setIsManualModalOpen(false)} className="flex-1 h-14 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-black text-[10px] uppercase tracking-widest transition-all">Cancelar</button>
              <button onClick={() => sendPayloadToParser({ texto: manualText })} disabled={!manualText.trim()} className="flex-1 h-14 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-purple-600/20">Processar</button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
};
