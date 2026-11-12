/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  CurrencyCode,
  LanguageCode,
  BillItem,
  IncomeItem,
  ExpenseItem,
  ChallengeGoal,
  MonthlyStatusRecord,
  MoneStyle,
  MoneMood,
} from '../types';
import { SisFinzPet } from './shared/SisFinzPet';
import { askMone, MoneContext, MoneResponse, MoneActionItem } from '../utils/moneEngine';
import { getTranslations } from '../utils/i18n';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { auth, db } from '../firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  Send,
  Mic,
  Square,
  Volume2,
  X,
  Bot,
  User,
  Loader2,
  Trash2,
  WifiOff,
  ChevronDown,
  Check,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'mone';
  text: string;
  timestamp: string;
}

interface MoneChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBalance: number;
  bills: BillItem[];
  incomes: IncomeItem[];
  expenses: ExpenseItem[];
  statusRecords: MonthlyStatusRecord[];
  goals: ChallengeGoal[];
  currency: CurrencyCode;
  language?: LanguageCode;
  moneStyle?: MoneStyle;
  onChangeMoneStyle?: (style: MoneStyle) => void;
  mood?: MoneMood;
  moodLabel?: string;
  onAddExpense?: (expenseData: Omit<ExpenseItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<any> | void;
  onUpdateExpense?: (expenseId: string, partial: Partial<ExpenseItem>) => Promise<any> | void;
  onDeleteExpense?: (expenseId: string) => Promise<any> | void;
  onAddBill?: (billData: Omit<BillItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<any> | void;
  onUpdateBill?: (billId: string, partial: Partial<BillItem>) => Promise<any> | void;
  onDeleteBill?: (billId: string) => Promise<any> | void;
  onToggleBillPaid?: (billId: string, month: string, isPaid: boolean) => Promise<any> | void;
  onAddIncome?: (incomeData: Omit<IncomeItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<any> | void;
  onUpdateIncome?: (incomeId: string, partial: Partial<IncomeItem>) => Promise<any> | void;
  onDeleteIncome?: (incomeId: string) => Promise<any> | void;
  onToggleIncomeReceived?: (incomeId: string, month: string, isReceived: boolean) => Promise<any> | void;
  onUpdateCurrentBalance?: (newBalance: number) => Promise<any> | void;
  onCreateGoal?: (goalData: {
    title: string;
    icon: string;
    targetAmount: number;
    initialValue: number;
    currency: CurrencyCode;
    notes?: string;
  }) => Promise<any> | void;
}

export const MoneChatModal: React.FC<MoneChatModalProps> = ({
  isOpen,
  onClose,
  currentBalance,
  bills,
  incomes,
  expenses,
  statusRecords,
  goals,
  currency,
  language = 'pt',
  moneStyle = 'direto',
  onChangeMoneStyle,
  moodLabel,
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
  onAddBill,
  onUpdateBill,
  onDeleteBill,
  onToggleBillPaid,
  onAddIncome,
  onUpdateIncome,
  onDeleteIncome,
  onToggleIncomeReceived,
  onUpdateCurrentBalance,
  onCreateGoal,
}) => {
  const t = getTranslations(language);
  const { isOnline } = useSyncStatus();

  const initialGreeting = React.useMemo(() => {
    if (language === 'pt') return 'Oi! Tudo bem? Pode conversar comigo sobre qualquer assunto — e, quando quiser, eu também posso cuidar das suas finanças no SisFinz.';
    if (language === 'es') return '¡Hola! ¿Cómo estás? Puedes hablar conmigo de cualquier tema y también puedo ayudarte con tus finanzas en SisFinz.';
    return 'Hi! How are you? You can talk to me about anything, and I can also help manage your finances in SisFinz.';
  }, [language]);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'mone',
      text: initialGreeting,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [memoryOwnerUid, setMemoryOwnerUid] = useState<string | null>(null);
  const [memoryReady, setMemoryReady] = useState(false);

  // Persistent, private conversation memory: each authenticated user has their own history.
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!isOpen || !uid) return;
    let cancelled = false;
    setMemoryReady(false);
    setMemoryOwnerUid(uid);
    (async () => {
      try {
        const memoryRef = doc(db, 'users', uid, 'mone_memory', 'conversation');
        const snapshot = await getDoc(memoryRef);
        if (cancelled) return;
        const saved = snapshot.exists() ? snapshot.data().messages : null;
        if (Array.isArray(saved)) {
          const restored = saved
            .filter((item: any) => item && (item.sender === 'user' || item.sender === 'mone') && typeof item.text === 'string')
            .slice(-60)
            .map((item: any, index: number) => ({
              id: typeof item.id === 'string' ? item.id : 'restored_' + index,
              sender: item.sender,
              text: item.text.slice(0, 4000),
              timestamp: typeof item.timestamp === 'string' ? item.timestamp : '',
            })) as ChatMessage[];
          if (restored.length) setMessages(restored);
        }
      } catch (error) {
        console.warn('[Mone] Não foi possível recuperar a memória da conversa:', error);
      } finally {
        if (!cancelled) setMemoryReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !memoryReady || !memoryOwnerUid || auth.currentUser?.uid !== memoryOwnerUid) return;
    const timeout = window.setTimeout(async () => {
      try {
        const compactMessages = messages.slice(-60).map((item) => ({
          id: item.id,
          sender: item.sender,
          text: item.text.slice(0, 4000),
          timestamp: item.timestamp,
        }));
        await setDoc(
          doc(db, 'users', memoryOwnerUid, 'mone_memory', 'conversation'),
          { messages: compactMessages, updatedAt: new Date().toISOString(), version: 1 },
          { merge: true }
        );
      } catch (error) {
        console.warn('[Mone] Não foi possível salvar a memória da conversa:', error);
      }
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [isOpen, memoryReady, memoryOwnerUid, messages]);

  const [lastActionItem, setLastActionItem] = useState<MoneActionItem | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showTextMode, setShowTextMode] = useState(false);
  const [isVoiceReplyEnabled, setIsVoiceReplyEnabled] = useState(true);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [isStyleMenuOpen, setIsStyleMenuOpen] = useState(false);

  const STYLE_OPTIONS = React.useMemo(() => [
    { id: 'direto' as const, emoji: '🎯', nameKey: 'moneStyleDireto' as const, descKey: 'moneStyleDescDireto' as const, switchKey: 'moneStyleSwitchedDireto' as const },
    { id: 'coach' as const, emoji: '💪', nameKey: 'moneStyleCoach' as const, descKey: 'moneStyleDescCoach' as const, switchKey: 'moneStyleSwitchedCoach' as const },
    { id: 'vovo' as const, emoji: '👵', nameKey: 'moneStyleVovo' as const, descKey: 'moneStyleDescVovo' as const, switchKey: 'moneStyleSwitchedVovo' as const },
    { id: 'sincerao' as const, emoji: '⚡', nameKey: 'moneStyleSincerao' as const, descKey: 'moneStyleDescSincerao' as const, switchKey: 'moneStyleSwitchedSincerao' as const },
  ], []);

  const currentStyleObj = React.useMemo(() => {
    return STYLE_OPTIONS.find((s) => s.id === moneStyle) || STYLE_OPTIONS[0];
  }, [STYLE_OPTIONS, moneStyle]);

  const handleSelectStyle = (newStyle: MoneStyle) => {
    setIsStyleMenuOpen(false);
    if (newStyle === moneStyle) return;
    onChangeMoneStyle?.(newStyle);

    const opt = STYLE_OPTIONS.find((s) => s.id === newStyle);
    const cannedText = opt ? (t[opt.switchKey] as string) : '';
    if (cannedText) {
      const confirmationMsg: ChatMessage = {
        id: 'style_switch_' + Date.now(),
        sender: 'mone',
        text: cannedText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, confirmationMsg]);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, messages]);

  const moneContext: MoneContext = {
    currentBalance,
    bills,
    incomes,
    expenses,
    statusRecords,
    goals,
    currency,
    language,
    lastActionItem,
    persona: moneStyle || 'direto',
    handlers: {
      onAddExpense,
      onUpdateExpense,
      onDeleteExpense,
      onAddBill,
      onUpdateBill,
      onDeleteBill,
      onToggleBillPaid,
      onAddIncome,
      onUpdateIncome,
      onDeleteIncome,
      onToggleIncomeReceived,
      onUpdateCurrentBalance,
      onCreateGoal,
    },
  };

  const handleSendMessage = async (textToSend?: string, audio?: { data: string; mimeType: string }) => {
    const query = (textToSend || inputValue).trim();
    if ((!query && !audio) || isLoading) return;

    const userMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      sender: 'user',
      text: audio ? 'Mensagem de voz' : query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    if (!isOnline) {
      const offlineMsg: ChatMessage = {
        id: 'msg_offline_' + Date.now(),
        sender: 'mone',
        text:
          language === 'pt'
            ? 'O assistente inteligente Mone precisa de conexão com a internet para gerar respostas com inteligência artificial.'
            : language === 'es'
            ? 'El asistente inteligente Mone requiere conexión a internet para generar respuestas con IA.'
            : 'The Mone AI assistant requires an internet connection.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setTimeout(() => {
        setMessages((prev) => [...prev, offlineMsg]);
        setIsLoading(false);
      }, 300);
      return;
    }

    try {
      const historyItems = [...messages, userMsg].map((m) => ({
        sender: m.sender,
        text: m.text,
      }));

      const response: MoneResponse = await askMone(query || 'Comando por voz', {
        ...moneContext,
        history: historyItems,
        lastActionItem,
      }, audio);

      if (response.createdItem) {
        setLastActionItem(response.createdItem);
      }

      const moneMsg: ChatMessage = {
        id: 'msg_mone_' + Date.now(),
        sender: 'mone',
        text: response.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, moneMsg]);
      if (isVoiceReplyEnabled && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(response.text);
        utterance.lang = language === 'pt' ? 'pt-BR' : language === 'es' ? 'es-AR' : 'en-US';
        utterance.rate = 1.08;
        window.speechSynthesis.speak(utterance);
      }
    } catch (err) {
      console.error('Error asking Mone:', err);
      const errorMsg: ChatMessage = {
        id: 'msg_err_' + Date.now(),
        sender: 'mone',
        text: (t as any).errorLoadingData || 'Erro ao comunicar com a Mone',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  };

  const startRecording = async () => {
    if (isRecording || isLoading) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setMessages((prev) => [...prev, { id: 'voice_unsupported_' + Date.now(), sender: 'mone', text: 'Este navegador não oferece gravação de áudio compatível. Você ainda pode conversar por texto.', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const preferred = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
      const mimeType = preferred.find((type) => MediaRecorder.isTypeSupported(type)) || '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (!blob.size) return;
        const reader = new FileReader();
        reader.onloadend = async () => {
          const dataUrl = String(reader.result || '');
          const data = dataUrl.includes(',') ? dataUrl.split(',')[1] : '';
          if (!data) return;
          await handleSendMessage('', { data, mimeType: blob.type || 'audio/webm' });
        };
        reader.readAsDataURL(blob);
      };
      recorder.start(250);
      setIsRecording(true);
    } catch (error) {
      console.error('Mone microphone error:', error);
      setMessages((prev) => [...prev, { id: 'voice_error_' + Date.now(), sender: 'mone', text: 'Não consegui acessar o microfone. Verifique a permissão do navegador e tente novamente.', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    }
  };

  useEffect(() => () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

  const handleClearChat = () => {
    setMessages([
      {
        id: 'welcome_' + Date.now(),
        sender: 'mone',
        text: initialGreeting,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setLastActionItem(null);
  };

  const quickSuggestions = [
    'Gastei 2500 de Uber agora',
    'Recebi 50 mil de salário',
    'Paguei a academia',
    'Quanto gastei este mês?',
  ];

  const latestMoneMessage = [...messages].reverse().find((message) => message.sender === 'mone');
  const latestUserMessage = [...messages].reverse().find((message) => message.sender === 'user');

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-[#F2FBF6] text-slate-800"
          style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-28 -right-20 h-80 w-80 rounded-full bg-emerald-200/40 blur-3xl" />
            <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-teal-100/70 blur-3xl" />
            <div className="absolute inset-0 opacity-[0.22]" style={{ backgroundImage: 'radial-gradient(#7CC9A5 0.7px, transparent 0.7px)', backgroundSize: '19px 19px' }} />
          </div>

          <header className="relative z-10 flex shrink-0 items-center justify-between px-5 py-4 sm:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-100 bg-white shadow-sm">
                <Sparkles className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight text-slate-900">SisFinz <span className="text-emerald-600">AI</span></h2>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700/70">Sua assistente inteligente</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`hidden rounded-full border px-3 py-1.5 text-[10px] font-bold sm:inline-flex ${isOnline ? 'border-emerald-200 bg-white/80 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                {isOnline ? '● Conectada' : '● Sem conexão'}
              </span>
              <button type="button" onClick={onClose} aria-label="Fechar assistente" className="flex h-10 w-10 items-center justify-center rounded-full border border-white bg-white/90 text-slate-500 shadow-sm transition hover:bg-white hover:text-slate-900">
                <X className="h-5 w-5" />
              </button>
            </div>
          </header>

          <main className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-5 pb-5">
            <div className="flex w-full max-w-xl flex-col items-center text-center">
              <div className="relative mb-7 flex h-64 w-64 items-center justify-center sm:h-72 sm:w-72">
                <motion.div
                  className="absolute h-56 w-56 rounded-full border border-emerald-200/80 sm:h-64 sm:w-64"
                  animate={{ scale: isRecording ? [1, 1.12, 1] : [1, 1.035, 1], opacity: isRecording ? [0.45, 0.95, 0.45] : [0.35, 0.65, 0.35] }}
                  transition={{ duration: isRecording ? 1.25 : 3.2, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                  className="absolute h-44 w-44 rounded-full bg-gradient-to-br from-emerald-200/80 to-teal-100/50 blur-xl sm:h-52 sm:w-52"
                  animate={{ scale: isRecording || isLoading ? [0.92, 1.16, 0.92] : [0.96, 1.04, 0.96] }}
                  transition={{ duration: isRecording ? 0.9 : 2.8, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                  className="relative z-10 flex h-40 w-40 items-center justify-center rounded-[3rem] border border-white/90 bg-white/80 shadow-[0_24px_70px_rgba(16,185,129,0.18)] backdrop-blur-sm sm:h-48 sm:w-48"
                  animate={{ y: isLoading ? [0, -5, 0] : [0, -4, 0], scale: isRecording ? [1, 1.035, 1] : 1 }}
                  transition={{ duration: isRecording ? 1 : 3, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <SisFinzPet size={142} className="drop-shadow-[0_10px_24px_rgba(16,185,129,0.22)]" />
                </motion.div>
                <motion.div
                  className={`absolute bottom-5 right-7 z-20 flex h-12 w-12 items-center justify-center rounded-2xl border-4 border-[#F2FBF6] shadow-lg ${isRecording ? 'bg-rose-500 text-white' : isLoading ? 'bg-amber-400 text-white' : 'bg-emerald-500 text-white'}`}
                  animate={isRecording || isLoading ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                  transition={{ duration: 0.8, repeat: isRecording || isLoading ? Infinity : 0 }}
                >
                  {isRecording ? <Mic className="h-5 w-5" /> : isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                </motion.div>
              </div>

              <div className="mb-2 min-h-[58px]">
                <AnimatePresence mode="wait">
                  <motion.h1
                    key={isRecording ? 'listening' : isLoading ? 'thinking' : 'ready'}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl"
                  >
                    {isRecording ? 'Estou ouvindo você…' : isLoading ? 'Entendendo seu pedido…' : 'Oi! Sou a Mone.'}
                  </motion.h1>
                </AnimatePresence>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
                  {isRecording ? 'Pode falar naturalmente. Quando terminar, toque no botão para enviar.' : isLoading ? 'Estou cuidando disso para você.' : 'Converse comigo sobre suas finanças ou peça para eu fazer algo no SisFinz.'}
                </p>
              </div>

              <div className="mb-7 flex h-10 items-center justify-center gap-1.5" aria-hidden="true">
                {Array.from({ length: 25 }).map((_, index) => (
                  <motion.span
                    key={index}
                    className={`w-1 rounded-full ${isRecording ? 'bg-rose-400' : isLoading ? 'bg-amber-400' : 'bg-emerald-300'}`}
                    animate={{ height: isRecording || isLoading ? [7, 12 + ((index * 7) % 23), 7] : [5, 9 + ((index * 3) % 8), 5], opacity: isRecording || isLoading ? [0.5, 1, 0.5] : 0.65 }}
                    transition={{ duration: isRecording ? 0.55 + (index % 5) * 0.08 : 1.5 + (index % 4) * 0.12, repeat: Infinity, delay: index * 0.025, ease: 'easeInOut' }}
                  />
                ))}
              </div>

              {latestMoneMessage && messages.length > 1 && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-5 w-full max-w-md rounded-3xl border border-white bg-white/75 px-5 py-4 text-left shadow-sm">
                  <div className="mb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-700"><Sparkles className="h-3 w-3" /> Mone</div>
                  <p className="line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{latestMoneMessage.text}</p>
                </motion.div>
              )}

              {latestUserMessage && (
                <p className="mb-4 max-w-sm truncate text-xs text-slate-400">{latestUserMessage.text}</p>
              )}

              <div className="flex w-full max-w-md items-center justify-center gap-5">
                <button type="button" onClick={() => setShowTextMode((value) => !value)} className="flex h-12 min-w-12 flex-col items-center justify-center gap-1 rounded-2xl px-3 text-slate-500 transition hover:bg-white/80 hover:text-emerald-700" aria-label="Alternar conversa escrita">
                  <Bot className="h-5 w-5" />
                  <span className="text-[9px] font-bold">{showTextMode ? 'Ocultar texto' : 'Texto'}</span>
                </button>

                <motion.button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isLoading}
                  whileTap={{ scale: 0.94 }}
                  className={`flex h-24 w-24 items-center justify-center rounded-full border-[6px] border-white shadow-[0_14px_40px_rgba(16,185,129,0.25)] transition-all disabled:opacity-50 ${isRecording ? 'bg-gradient-to-br from-rose-400 to-rose-600 text-white' : 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white'}`}
                  aria-label={isRecording ? 'Enviar áudio' : 'Começar a falar'}
                >
                  {isRecording ? <Square className="h-8 w-8 fill-current" /> : <Mic className="h-9 w-9" />}
                </motion.button>

                <button type="button" onClick={() => { setIsVoiceReplyEnabled((value) => !value); if (typeof window !== 'undefined' && 'speechSynthesis' in window && isVoiceReplyEnabled) window.speechSynthesis.cancel(); }} className={`flex h-12 min-w-12 flex-col items-center justify-center gap-1 rounded-2xl px-3 transition hover:bg-white/80 ${isVoiceReplyEnabled ? 'text-emerald-700' : 'text-slate-400'}`} aria-label="Alternar resposta falada">
                  <Volume2 className="h-5 w-5" />
                  <span className="text-[9px] font-bold">{isVoiceReplyEnabled ? 'Voz ligada' : 'Voz desligada'}</span>
                </button>
              </div>

              <p className="mt-4 text-[10px] font-medium text-slate-400">
                {isRecording ? 'Toque no botão vermelho quando terminar de falar' : 'Toque no microfone para começar'}
              </p>
            </div>

            <AnimatePresence>
              {showTextMode && (
                <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} className="mt-6 w-full max-w-xl rounded-3xl border border-white bg-white/85 p-4 shadow-lg">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-black text-slate-700">Conversa com a Mone</span>
                    <button type="button" onClick={handleClearChat} className="text-[10px] font-bold text-slate-400 hover:text-rose-500">Limpar</button>
                  </div>
                  <div className="mb-3 max-h-40 space-y-2 overflow-y-auto text-left">
                    {messages.map((message) => (
                      <div key={message.id} className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-xs leading-relaxed ${message.sender === 'mone' ? 'bg-emerald-50 text-slate-700' : 'ml-auto bg-emerald-600 text-white'}`}>{message.text}</div>
                    ))}
                    {isLoading && <p className="text-xs text-emerald-600">Mone está pensando…</p>}
                  </div>
                  <form onSubmit={(event) => { event.preventDefault(); handleSendMessage(); }} className="flex gap-2">
                    <input ref={inputRef} value={inputValue} onChange={(event) => setInputValue(event.target.value)} placeholder="Escreva para a Mone…" className="h-12 min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" disabled={isLoading} />
                    <button type="submit" disabled={!inputValue.trim() || isLoading} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white disabled:opacity-40"><Send className="h-4 w-4" /></button>
                  </form>
                </motion.section>
              )}
            </AnimatePresence>
          </main>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
