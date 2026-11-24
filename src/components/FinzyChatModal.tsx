import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
import { FinzyMascot, FinzyRoutineState } from './FinzyMascot';
import { askMone, MoneContext, MoneResponse, MoneActionItem } from '../utils/moneEngine';
import { getTranslations } from '../utils/i18n';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { auth } from '../firebase/config';
import { GoogleGenAI } from '@google/genai';
import {
  Send,
  X,
  User,
  Loader2,
  Trash2,
  WifiOff,
  ChevronDown,
  Check,
  Sparkles,
  Mic,
  MicOff,
  Volume2,
  PhoneOff,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'finzy';
  text: string;
  timestamp: string;
}

interface FinzyChatModalProps {
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
  routineState?: FinzyRoutineState;
  skinId?: string;
  onAddExpense?: (
    expenseData: Omit<ExpenseItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => Promise<any> | void;
  onUpdateExpense?: (expenseId: string, partial: Partial<ExpenseItem>) => Promise<any> | void;
  onDeleteExpense?: (expenseId: string) => Promise<any> | void;
  onAddBill?: (
    billData: Omit<BillItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => Promise<any> | void;
  onUpdateBill?: (billId: string, partial: Partial<BillItem>) => Promise<any> | void;
  onDeleteBill?: (billId: string) => Promise<any> | void;
  onToggleBillPaid?: (billId: string, month: string, isPaid: boolean) => Promise<any> | void;
  onAddIncome?: (
    incomeData: Omit<IncomeItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => Promise<any> | void;
  onUpdateIncome?: (incomeId: string, partial: Partial<IncomeItem>) => Promise<any> | void;
  onDeleteIncome?: (incomeId: string) => Promise<any> | void;
  onToggleIncomeReceived?: (
    incomeId: string,
    month: string,
    isReceived: boolean
  ) => Promise<any> | void;
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

export const FinzyChatModal: React.FC<FinzyChatModalProps> = ({
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
  mood = 'calm',
  moodLabel,
  routineState = 'normal',
  skinId = 'emerald_classic',
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
    if (language === 'pt')
      return 'Oi! Sou o Finzy. Como posso ajudar com suas finanças e sua rotina hoje?';
    if (language === 'es')
      return '¡Hola! Soy Finzy. ¿Cómo puedo ayudarte con tus finanzas y tu rutina hoy?';
    return 'Hi! I am Finzy. How can I help with your finances and routine today?';
  }, [language]);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'finzy',
      text: initialGreeting,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [lastActionItem, setLastActionItem] = useState<MoneActionItem | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [isStyleMenuOpen, setIsStyleMenuOpen] = useState(false);

  // Live Voice Mode State
  const [isVoiceLiveOpen, setIsVoiceLiveOpen] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<
    'idle' | 'connecting' | 'listening' | 'speaking' | 'error'
  >('idle');
  const [voiceErrorMsg, setVoiceErrorMsg] = useState<string | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);

  const isMicMutedRef = useRef(false);
  isMicMutedRef.current = isMicMuted;

  const liveSessionRef = useRef<any>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micContextRef = useRef<AudioContext | null>(null);
  const micProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const playContextRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const STYLE_OPTIONS = React.useMemo(
    () => [
      {
        id: 'direto' as const,
        emoji: '🎯',
        nameKey: 'moneStyleDireto' as const,
        descKey: 'moneStyleDescDireto' as const,
        switchKey: 'moneStyleSwitchedDireto' as const,
      },
      {
        id: 'coach' as const,
        emoji: '💪',
        nameKey: 'moneStyleCoach' as const,
        descKey: 'moneStyleDescCoach' as const,
        switchKey: 'moneStyleSwitchedCoach' as const,
      },
      {
        id: 'vovo' as const,
        emoji: '👵',
        nameKey: 'moneStyleVovo' as const,
        descKey: 'moneStyleDescVovo' as const,
        switchKey: 'moneStyleSwitchedVovo' as const,
      },
      {
        id: 'sincerao' as const,
        emoji: '⚡',
        nameKey: 'moneStyleSincerao' as const,
        descKey: 'moneStyleDescSincerao' as const,
        switchKey: 'moneStyleSwitchedSincerao' as const,
      },
    ],
    []
  );

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
        sender: 'finzy',
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

  const stopPlaybackQueue = React.useCallback(() => {
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch {
        // ignore already stopped source
      }
    });
    activeSourcesRef.current.clear();
    nextPlayTimeRef.current = 0;
  }, []);

  const stopLiveVoiceSession = React.useCallback(() => {
    stopPlaybackQueue();

    if (micProcessorRef.current) {
      try {
        micProcessorRef.current.disconnect();
      } catch {
        // ignore
      }
      micProcessorRef.current = null;
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((tr) => tr.stop());
      micStreamRef.current = null;
    }

    if (micContextRef.current) {
      micContextRef.current.close().catch(() => {});
      micContextRef.current = null;
    }

    if (playContextRef.current) {
      playContextRef.current.close().catch(() => {});
      playContextRef.current = null;
    }

    if (liveSessionRef.current) {
      try {
        if (typeof liveSessionRef.current.close === 'function') {
          liveSessionRef.current.close();
        }
      } catch {
        // ignore
      }
      liveSessionRef.current = null;
    }

    setVoiceStatus('idle');
    setIsMicMuted(false);
    setIsVoiceLiveOpen(false);
  }, [stopPlaybackQueue]);

  useEffect(() => {
    if (!isOpen && isVoiceLiveOpen) {
      stopLiveVoiceSession();
    }
  }, [isOpen, isVoiceLiveOpen, stopLiveVoiceSession]);

  useEffect(() => {
    return () => {
      stopLiveVoiceSession();
    };
  }, [stopLiveVoiceSession]);

  const playPcm16Chunk = React.useCallback((base64Data: string) => {
    if (!base64Data) return;
    try {
      if (!playContextRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        playContextRef.current = new AudioCtx({ sampleRate: 24000 });
        nextPlayTimeRef.current = playContextRef.current.currentTime;
      }
      const ctx = playContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const binaryStr = atob(base64Data);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const sampleCount = Math.floor(bytes.length / 2);
      const float32 = new Float32Array(sampleCount);
      const view = new DataView(bytes.buffer);
      for (let i = 0; i < sampleCount; i++) {
        const int16 = view.getInt16(i * 2, true);
        float32[i] = int16 / 32768;
      }

      const audioBuffer = ctx.createBuffer(1, sampleCount, 24000);
      audioBuffer.copyToChannel(float32, 0);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      const startAt = Math.max(ctx.currentTime + 0.02, nextPlayTimeRef.current);
      source.start(startAt);
      nextPlayTimeRef.current = startAt + audioBuffer.duration;
      activeSourcesRef.current.add(source);
      setVoiceStatus('speaking');

      source.onended = () => {
        activeSourcesRef.current.delete(source);
        if (activeSourcesRef.current.size === 0) {
          setVoiceStatus((prev) => (prev === 'speaking' ? 'listening' : prev));
        }
      };
    } catch (err) {
      console.warn('Error playing Finzy Live audio chunk:', err);
    }
  }, []);

  const startLiveVoiceSession = async () => {
    if (!isOnline) {
      setIsVoiceLiveOpen(true);
      setVoiceStatus('error');
      setVoiceErrorMsg(
        language === 'es'
          ? 'Necesitas conexión a internet para hablar por voz con Finzy.'
          : 'Você precisa de conexão com a internet para falar por voz com o Finzy.'
      );
      return;
    }

    setIsVoiceLiveOpen(true);
    setVoiceStatus('connecting');
    setVoiceErrorMsg(null);
    setIsMicMuted(false);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (auth.currentUser) {
        const token = await auth.currentUser.getIdToken();
        headers['Authorization'] = `Bearer ${token}`;
      }

      const tokenResp = await fetch('/api/mone/live-token', {
        method: 'POST',
        headers,
      });

      if (!tokenResp.ok) {
        const errJson = await tokenResp.json().catch(() => ({}));
        throw new Error(
          errJson.error ||
            (language === 'es'
              ? 'No se pudo iniciar la sesión de voz en vivo.'
              : 'Não foi possível iniciar a sessão de voz ao vivo.')
        );
      }

      const tokenData = await tokenResp.json();
      const financialSummary = [
        `Saldo atual: ${currentBalance}`,
        `Moeda padrão: ${currency}`,
        `Receitas cadastradas: ${incomes.length}`,
        `Faturas cadastradas: ${bills.length}`,
        `Despesas avulsas: ${expenses.length}`,
        `Metas ativas: ${goals.length}`,
        `Estilo preferido: ${moneStyle}`,
        `Memória recente da conversa: ${messages
          .slice(-24)
          .map((m) => `${m.sender === 'user' ? 'Usuário' : 'Finzy'}: ${m.text.slice(0, 500)}`)
          .join(' | ')
          .slice(0, 12000)}`,
      ].join('\n');

      const liveSystemInstruction =
        'Você é Finzy, assistente oficial do SisFinz e integrante digital deste aplicativo. Você não é um assistente externo: faz parte do SisFinz. Seu nome próprio e único é Finzy. Se perguntarem seu nome, responda naturalmente: Sou o Finzy, assistente oficial do SisFinz. Se perguntarem quem você é, explique que ajuda o usuário a consultar, organizar e atualizar suas finanças e rotina com os dados reais autorizados do aplicativo e também conversa sobre assuntos gerais. Nunca diga que não tem nome próprio, nunca se apresente como Gemini, Google, Flash ou outro modelo de IA. O nome do modelo é apenas tecnologia interna, não sua identidade. Fale SEMPRE em português brasileiro natural (pt-BR), mesmo que o aplicativo, o sistema ou algum trecho do histórico esteja em espanhol ou inglês. Só mude de idioma se o usuário pedir explicitamente. No modo de voz Live, nunca abra ou leve o usuário para outras telas do aplicativo; apenas responda de forma clara e direta por voz. Contexto real do usuário:\n' +
        financialSummary;

      const ai = new GoogleGenAI({
        apiKey: tokenData.token,
        httpOptions: { apiVersion: 'v1beta' },
      });

      const session = await ai.live.connect({
        model: tokenData.model || 'gemini-3.8-live',
        config: {
          systemInstruction: liveSystemInstruction,
          responseModalities: ['AUDIO' as any],
        },
        callbacks: {
          onopen: () => {
            setVoiceStatus('listening');
          },
          onmessage: (msg: any) => {
            const serverContent = msg?.serverContent;
            if (serverContent?.interrupted) {
              stopPlaybackQueue();
              setVoiceStatus('listening');
              return;
            }
            const parts = serverContent?.modelTurn?.parts || [];
            for (const p of parts) {
              if (p?.inlineData?.data) {
                playPcm16Chunk(p.inlineData.data);
              }
            }
          },
          onerror: (err: any) => {
            console.warn('Finzy Live socket error:', err);
            setVoiceStatus('error');
            setVoiceErrorMsg(
              err?.message ||
                (language === 'es'
                  ? 'Se interrumpió la conexión de voz.'
                  : 'A conexão de voz foi interrompida.')
            );
          },
          onclose: () => {
            setVoiceStatus((prev) => (prev === 'error' ? 'error' : 'idle'));
          },
        },
      });

      liveSessionRef.current = session;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      micStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const micCtx = new AudioCtx({ sampleRate: 16000 });
      micContextRef.current = micCtx;

      const sourceNode = micCtx.createMediaStreamSource(stream);
      const processor = micCtx.createScriptProcessor(4096, 1, 1);
      micProcessorRef.current = processor;

      processor.onaudioprocess = (ev) => {
        if (isMicMutedRef.current || !liveSessionRef.current) return;
        const inputData = ev.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        const bytes = new Uint8Array(pcm16.buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const b64 = btoa(binary);
        try {
          liveSessionRef.current.sendRealtimeInput({
            audio: {
              data: b64,
              mimeType: 'audio/pcm;rate=16000',
            },
          });
        } catch {
          // ignore send errors during teardown
        }
      };

      sourceNode.connect(processor);
      processor.connect(micCtx.destination);
      setVoiceStatus('listening');
    } catch (err: any) {
      console.error('Failed to start Finzy Live voice:', err);
      setVoiceStatus('error');
      setVoiceErrorMsg(
        err?.message ||
          (language === 'es'
            ? 'Permite el micrófono para hablar con Finzy.'
            : 'Permita o acesso ao microfone para falar com o Finzy.')
      );
    }
  };

  useEffect(() => {
    const handleFinzyLiveRequest = () => {
      if (isOpen) void startLiveVoiceSession();
    };
    window.addEventListener('sisfinz:finzy-open-live', handleFinzyLiveRequest);
    return () => window.removeEventListener('sisfinz:finzy-open-live', handleFinzyLiveRequest);
  }, [isOpen]);

  const engineContext: MoneContext = {
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

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputValue).trim();
    if (!query || isLoading) return;

    const userMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    if (!isOnline) {
      const offlineMsg: ChatMessage = {
        id: 'msg_offline_' + Date.now(),
        sender: 'finzy',
        text:
          language === 'pt'
            ? 'O assistente inteligente Finzy precisa de conexão com a internet para gerar respostas com inteligência artificial.'
            : language === 'es'
            ? 'El asistente inteligente Finzy requiere conexión a internet para generar respuestas con IA.'
            : 'The Finzy AI assistant requires an internet connection.',
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
        sender: (m.sender === 'finzy' ? 'mone' : 'user') as 'user' | 'mone',
        text: m.text,
      }));

      const response: MoneResponse = await askMone(query, {
        ...engineContext,
        history: historyItems,
        lastActionItem,
      });

      if (response.createdItem) {
        setLastActionItem(response.createdItem);
      }

      const finzyMsg: ChatMessage = {
        id: 'msg_finzy_' + Date.now(),
        sender: 'finzy',
        text: response.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, finzyMsg]);
    } catch (err) {
      console.error('Error asking Finzy:', err);
      const errorMsg: ChatMessage = {
        id: 'msg_err_' + Date.now(),
        sender: 'finzy',
        text:
          language === 'es'
            ? 'Error al comunicar con Finzy'
            : 'Erro ao comunicar com o Finzy',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 'welcome_' + Date.now(),
        sender: 'finzy',
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

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-2 sm:p-4 overflow-hidden overscroll-contain pointer-events-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-0 bg-slate-900/45 backdrop-blur-xs pointer-events-auto"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative z-10 w-full max-w-lg h-[calc(100dvh-2rem)] sm:h-[680px] rounded-[2.5rem] bg-[#F4F8F6] border border-emerald-200/80 shadow-2xl flex flex-col overflow-hidden pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-200/70 flex items-center justify-between shrink-0 relative overflow-hidden bg-white">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-transparent opacity-50 pointer-events-none" />

              <div className="flex items-center gap-3 relative z-10 min-w-0">
                <div className="w-11 h-11 shrink-0 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/30 shadow-2xs">
                  <FinzyMascot
                    mood={mood}
                    routineState={routineState}
                    skinId={skinId}
                    size="sm"
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-900 tracking-tight truncate">
                      Finzy
                    </h3>
                    <span
                      className={`flex items-center gap-1 text-[9.5px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border shrink-0 ${
                        isOnline
                          ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-700 border-amber-500/30'
                      }`}
                    >
                      {!isOnline && <WifiOff className="w-3 h-3" />}
                      {isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate mt-0.5">
                    {moodLabel || (t as any).smartAssistant || 'Assistente do SisFinz'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 relative z-10 shrink-0">
                {/* Live Voice Button */}
                <button
                  type="button"
                  onClick={startLiveVoiceSession}
                  className="h-10 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-emerald-600/25"
                  title={language === 'es' ? 'Modo de Voz en Vivo' : 'Modo de Voz ao Vivo'}
                  aria-label="Modo de Voz"
                >
                  <Mic className="w-4 h-4" />
                  <span className="hidden sm:inline text-[10px] font-black uppercase tracking-wider">
                    {language === 'es' ? 'Voz' : 'Voz'}
                  </span>
                </button>

                {/* Style Selector */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsStyleMenuOpen(!isStyleMenuOpen)}
                    className="h-10 px-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-slate-700 flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                  >
                    <span className="text-base">{currentStyleObj.emoji}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                  </button>

                  <AnimatePresence>
                    {isStyleMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 shadow-2xl p-2 rounded-3xl z-50 overflow-hidden"
                      >
                        <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-100 mb-1">
                          Personalidade do Finzy
                        </div>
                        {STYLE_OPTIONS.map((opt) => {
                          const isSelected = opt.id === (moneStyle || 'direto');
                          return (
                            <button
                              type="button"
                              key={opt.id}
                              onClick={() => handleSelectStyle(opt.id)}
                              className={`w-full p-3 rounded-2xl flex items-start gap-3 transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-900 font-bold'
                                  : 'hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <span className="text-xl shrink-0">{opt.emoji}</span>
                              <div className="text-left">
                                <div className="text-xs font-black flex items-center justify-between text-slate-900">
                                  {t[opt.nameKey]}
                                  {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                                </div>
                                <p className="text-[10px] font-medium text-slate-500 leading-tight mt-1">
                                  {t[opt.descKey]}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  type="button"
                  onClick={handleClearChat}
                  className="p-2.5 rounded-2xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/80 transition-all cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2.5 rounded-2xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/80 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Live Voice Overlay inside Finzy Chat */}
            <AnimatePresence>
              {isVoiceLiveOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 18 }}
                  className="absolute inset-x-0 top-[76px] bottom-0 z-30 flex flex-col items-center justify-between bg-gradient-to-b from-emerald-50/98 via-white/98 to-teal-50/98 backdrop-blur-xl p-6 text-center"
                >
                  <div className="space-y-1">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-800">
                      <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                      {language === 'es' ? 'Finzy Voz en Vivo' : 'Finzy Voz ao Vivo'}
                    </span>
                    <p className="text-xs font-bold text-slate-500">
                      {voiceStatus === 'connecting'
                        ? language === 'es'
                          ? 'Conectando con Finzy...'
                          : 'Conectando com o Finzy...'
                        : voiceStatus === 'speaking'
                        ? language === 'es'
                          ? 'Finzy está hablando...'
                          : 'Finzy está falando...'
                        : voiceStatus === 'error'
                        ? voiceErrorMsg || 'Erro de voz'
                        : isMicMuted
                        ? language === 'es'
                          ? 'Micrófono silenciado'
                          : 'Microfone mutado'
                        : language === 'es'
                        ? 'Te escucho, habla con naturalidad'
                        : 'Estou te ouvindo, fale naturalmente'}
                    </p>
                  </div>

                  <div className="relative flex h-36 w-36 items-center justify-center">
                    <motion.span
                      animate={{
                        scale:
                          voiceStatus === 'speaking' || (voiceStatus === 'listening' && !isMicMuted)
                            ? [1, 1.24, 1]
                            : 1,
                        opacity:
                          voiceStatus === 'speaking' || (voiceStatus === 'listening' && !isMicMuted)
                            ? [0.25, 0.55, 0.25]
                            : 0.15,
                      }}
                      transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
                      className="absolute inset-0 rounded-full bg-emerald-400"
                    />
                    <div className="relative z-10 flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-xl border-2 border-emerald-200">
                      <FinzyMascot
                        mood={voiceStatus === 'error' ? 'worried' : 'happy'}
                        routineState={routineState}
                        skinId={skinId}
                        size={68}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setIsMicMuted((m) => !m)}
                      className={`flex h-13 w-13 items-center justify-center rounded-2xl border transition-all cursor-pointer shadow-sm ${
                        isMicMuted
                          ? 'border-amber-300 bg-amber-100 text-amber-800'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                      aria-label={isMicMuted ? 'Ativar microfone' : 'Mutar microfone'}
                    >
                      {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </button>

                    <button
                      type="button"
                      onClick={stopLiveVoiceSession}
                      className="inline-flex h-13 items-center gap-2 rounded-2xl bg-rose-600 hover:bg-rose-500 px-6 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-rose-600/25 cursor-pointer"
                    >
                      <PhoneOff className="w-4 h-4" />
                      {language === 'es' ? 'Finalizar Voz' : 'Encerrar Voz'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Message Stream */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
              {messages.map((msg, idx) => {
                const isFinzy = msg.sender === 'finzy';
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, x: isFinzy ? -10 : 10, y: 10 }}
                    animate={{ opacity: 1, x: 0, y: 0 }}
                    transition={{ delay: idx === messages.length - 1 ? 0.1 : 0 }}
                    className={`flex gap-3 max-w-[90%] ${
                      isFinzy ? 'self-start' : 'self-end flex-row-reverse'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                        isFinzy
                          ? 'bg-emerald-500/10 border border-emerald-500/30'
                          : 'bg-emerald-600 border border-emerald-500'
                      }`}
                    >
                      {isFinzy ? (
                        <FinzyMascot
                          mood={mood}
                          routineState={routineState}
                          skinId={skinId}
                          size="sm"
                          className="scale-90"
                        />
                      ) : (
                        <User className="w-4 h-4 text-white" />
                      )}
                    </div>

                    <div
                      className={`p-4 rounded-2xl shadow-sm relative overflow-hidden ${
                        isFinzy
                          ? 'bg-white border border-slate-200/80 text-slate-800'
                          : 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white font-medium border border-emerald-500/30'
                      }`}
                    >
                      {isFinzy && (
                        <div className="absolute top-0 right-0 p-2 opacity-50">
                          <Sparkles className="w-3 h-3 text-emerald-600" />
                        </div>
                      )}
                      <div className="text-[13px] leading-relaxed whitespace-pre-wrap">
                        {msg.text.split('\n\n').map((para, i) => (
                          <p key={i} className="mb-2 last:mb-0">
                            {para.split(/(\*\*.*?\*\*)/g).map((part, j) => {
                              if (part.startsWith('**') && part.endsWith('**')) {
                                return (
                                  <strong key={j} className="font-black text-slate-900">
                                    {part.slice(2, -2)}
                                  </strong>
                                );
                              }
                              return part;
                            })}
                          </p>
                        ))}
                      </div>
                      <div
                        className={`text-[9px] mt-2 font-black uppercase tracking-widest text-right ${
                          isFinzy ? 'text-slate-400' : 'text-emerald-100'
                        }`}
                      >
                        {msg.timestamp}
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {isLoading && (
                <div className="flex gap-3 max-w-[85%] self-start">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                  </div>
                  <div className="p-4 rounded-2xl bg-white border border-slate-200/80 text-slate-500 italic text-xs shadow-2xs">
                    Finzy está pensando...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Bottom Section */}
            <div className="p-4 bg-white/85 border-t border-slate-200/70 space-y-3">
              {/* Quick Suggestions */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
                {quickSuggestions.map((sug, idx) => (
                  <motion.button
                    type="button"
                    key={idx}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleSendMessage(sug)}
                    className="px-3.5 py-2 rounded-2xl bg-white hover:bg-emerald-50/60 border border-slate-200/80 text-slate-700 text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer shadow-2xs"
                  >
                    {sug}
                  </motion.button>
                ))}
              </div>

              {/* Input Bar */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="relative flex items-center gap-2"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Envie uma mensagem para o Finzy..."
                  className="flex-1 h-13 bg-white border border-emerald-200/80 rounded-3xl px-5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/60 transition-all shadow-2xs"
                  disabled={isLoading}
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  type="submit"
                  disabled={!inputValue.trim() || isLoading}
                  className="w-13 h-13 rounded-3xl bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-600/20 disabled:opacity-40 transition-all cursor-pointer shrink-0"
                >
                  <Send className="w-5 h-5" />
                </motion.button>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
