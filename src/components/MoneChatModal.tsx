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
  AccountItem,
  SharedBill,
  FiftyTwoWeekChallenge,
} from '../types';
import { SisFinzPet } from './shared/SisFinzPet';
import { askMone, MoneContext, MoneResponse, MoneActionItem } from '../utils/moneEngine';
import { getTranslations } from '../utils/i18n';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { auth, db } from '../firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
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
import { GoogleGenAI, Modality } from '@google/genai';

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
  forecastBalance?: number;
  accounts?: AccountItem[];
  sharedBills?: SharedBill[];
  weeklyChallenges?: FiftyTwoWeekChallenge[];
  myUserId?: string;
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
  onUpdateGoal?: (goalId: string, partial: { title?: string; icon?: string; notes?: string }) => Promise<any> | void;
  onDeleteGoal?: (goalId: string) => Promise<any> | void;
  onTransferBetweenAccounts?: (params: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    date: string;
    notes?: string;
  }) => Promise<any> | void;
  onToggleMySharePaid?: (billId: string, isPaid: boolean, targetMonth?: string) => Promise<any> | void;
  onCompleteChallengeWeek?: (challengeId: string, weekNumber: number, accountId: string) => Promise<any> | void;
  onUndoChallengeWeek?: (challengeId: string, weekNumber: number, returnAccountId: string) => Promise<any> | void;
}

export const MoneChatModal: React.FC<MoneChatModalProps> = ({
  isOpen,
  onClose,
  currentBalance,
  forecastBalance = currentBalance,
  accounts = [],
  sharedBills = [],
  weeklyChallenges = [],
  myUserId,
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
  onUpdateGoal,
  onDeleteGoal,
  onTransferBetweenAccounts,
  onToggleMySharePaid,
  onCompleteChallengeWeek,
  onUndoChallengeWeek,
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
  const [lastActionItem, setLastActionItem] = useState<MoneActionItem | null>(null);

  useEffect(() => {
    if (!isOpen) pendingTextActionRef.current = null;
  }, [isOpen]);

  // Persistent, private conversation memory: keep each Firebase account strictly isolated.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    let loadSequence = 0;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const sequence = ++loadSequence;
      setMemoryReady(false);
      setMemoryOwnerUid(user?.uid || null);
      setLastActionItem(null);
      setMessages([{
        id: 'welcome_' + Date.now(),
        sender: 'mone',
        text: initialGreeting,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
      if (!user) {
        setMemoryReady(true);
        return;
      }
      try {
        const memoryRef = doc(db, 'users', user.uid, 'mone_memory', 'conversation');
        const snapshot = await getDoc(memoryRef);
        if (cancelled || sequence !== loadSequence) return;
        const memoryData = snapshot.exists() ? snapshot.data() : {};
        const saved = memoryData.messages;
        const savedAction = memoryData.lastActionItem;
        if (savedAction && ['expense', 'bill', 'income'].includes(savedAction.type) && typeof savedAction.id === 'string' && typeof savedAction.name === 'string') {
          setLastActionItem(savedAction as MoneActionItem);
        }
        if (Array.isArray(saved)) {
          const restored = saved
            .filter((item: any) => item && (item.sender === 'user' || item.sender === 'mone') && typeof item.text === 'string')
            .slice(-100)
            .map((item: any, index: number) => ({
              id: typeof item.id === 'string' ? item.id : 'restored_' + index,
              sender: item.sender,
              text: item.text.slice(0, 4000),
              timestamp: typeof item.timestamp === 'string' ? item.timestamp : '',
            })) as ChatMessage[];
          if (restored.length) setMessages(restored);
        }
      } catch (error) {
        if (!cancelled && sequence === loadSequence) {
          console.warn('[Mone] Não foi possível recuperar a memória da conversa:', error);
        }
      } finally {
        if (!cancelled && sequence === loadSequence) setMemoryReady(true);
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [isOpen, initialGreeting]);

  useEffect(() => {
    if (!isOpen || !memoryReady || !memoryOwnerUid || auth.currentUser?.uid !== memoryOwnerUid) return;
    const timeout = window.setTimeout(async () => {
      try {
        const compactMessages = messages.slice(-100).map((item) => ({
          id: item.id,
          sender: item.sender,
          text: item.text.slice(0, 4000),
          timestamp: item.timestamp,
        }));
        await setDoc(
          doc(db, 'users', memoryOwnerUid, 'mone_memory', 'conversation'),
          { messages: compactMessages, lastActionItem, updatedAt: new Date().toISOString(), version: 2 },
          { merge: true }
        );
      } catch (error) {
        console.warn('[Mone] Não foi possível salvar a memória da conversa:', error);
      }
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [isOpen, memoryReady, memoryOwnerUid, messages, lastActionItem]);

  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showTextMode, setShowTextMode] = useState(false);
  const [isVoiceReplyEnabled, setIsVoiceReplyEnabled] = useState(true);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const liveSessionRef = useRef<any>(null);
  const liveInputContextRef = useRef<AudioContext | null>(null);
  const liveOutputContextRef = useRef<AudioContext | null>(null);
  const liveStreamRef = useRef<MediaStream | null>(null);
  const liveProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const liveSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const livePlaybackTimeRef = useRef(0);
  const liveAudioSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const pendingVoiceActionRef = useRef<string | null>(null);
  const pendingTextActionRef = useRef<string | null>(null);
  const liveUserTextRef = useRef('');
  const liveMoneTextRef = useRef('');
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [liveStatus, setLiveStatus] = useState<'idle' | 'connecting' | 'listening' | 'speaking'>('idle');
  const [liveTranscript, setLiveTranscript] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen && liveSessionRef.current) {
      pendingVoiceActionRef.current = null;
      try { liveProcessorRef.current?.disconnect(); } catch {}
      try { liveSourceRef.current?.disconnect(); } catch {}
      liveStreamRef.current?.getTracks().forEach((track) => track.stop());
      liveSessionRef.current?.close?.();
      liveAudioSourcesRef.current.forEach((source) => { try { source.stop(); } catch {} });
      liveAudioSourcesRef.current = [];
      liveSessionRef.current = null;
      liveInputContextRef.current?.close().catch(() => {});
      liveOutputContextRef.current?.close().catch(() => {});
      liveInputContextRef.current = null;
      liveOutputContextRef.current = null;
      setIsLiveConnected(false);
      setIsRecording(false);
      setLiveStatus('idle');
    }
  }, [isOpen]);

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
    forecastBalance,
    accounts,
    sharedBills,
    weeklyChallenges,
    myUserId,
    bills,
    incomes,
    expenses,
    statusRecords,
    goals,
    currency,
    language,
    lastActionItem,
    history: messages.slice(-24).map((item) => ({ sender: item.sender, text: item.text })),
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
      onUpdateGoal,
      onDeleteGoal,
      onTransferBetweenAccounts,
      onToggleMySharePaid,
      onCompleteChallengeWeek,
      onUndoChallengeWeek,
    },
  };

  const handleSendMessage = async (textToSend?: string, audio?: { data: string; mimeType: string }) => {
    const query = (textToSend || inputValue).trim();
    if ((!query && !audio) || isLoading) return;
    if (query) pendingVoiceActionRef.current = null;
    let actionQuery = query;
    const normalizedReply = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[,.!?]+/g, ' ').replace(/\s+/g, ' ').trim();
    const isConfirmation = /^(sim|confirmo|confirmar|pode fazer|pode confirmar|isso mesmo|yes|confirm|go ahead|si|dale|ok|okay)(?:\s+(?:por favor|sim|confirmo|please))?$/.test(normalizedReply);
    const isCancellation = /^(?:nao\s+)?(?:cancela|cancelar|deixa|no|cancel|never mind)$/.test(normalizedReply);
    if (pendingTextActionRef.current && isConfirmation) {
      actionQuery = pendingTextActionRef.current;
      pendingTextActionRef.current = null;
    } else if (pendingTextActionRef.current && isCancellation) {
      pendingTextActionRef.current = null;
      const cancelMsg: ChatMessage = {
        id: 'cancel_action_' + Date.now(),
        sender: 'mone',
        text: 'Tudo bem. Cancelei a operação e não alterei nenhum registro.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, { id: 'msg_' + Date.now(), sender: 'user', text: query, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, cancelMsg]);
      setInputValue('');
      return;
    } else if (pendingTextActionRef.current) {
      pendingTextActionRef.current = null;
    }

    const isDestructiveRequest = /\b(apag\w*|exclu\w*|delet\w*|remov\w*|alter\w*|mud\w*|troc\w*|substitu\w*|atualiz\w*|modific\w*|ajust\w*|aument\w*|reduz\w*|edit\w*|renome\w*|rename\w*|corrig\w*|coloc\w*|defin\w*|desfaz\w*|estorn\w*|revert\w*)\b/i.test(query);
    const userMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      sender: 'user',
      text: audio ? 'Mensagem de voz' : query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    if (isDestructiveRequest && actionQuery === query) {
      pendingTextActionRef.current = query;
      const confirmMsg: ChatMessage = {
        id: 'confirm_action_' + Date.now(),
        sender: 'mone',
        text: `Você quer que eu execute esta alteração ou exclusão: “${query}”? Responda “sim” para confirmar ou “não” para cancelar.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, confirmMsg]);
      return;
    }
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

      const response: MoneResponse = await askMone(actionQuery || 'Comando por voz', {
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

  const stopLiveVoice = () => {
    try { liveProcessorRef.current?.disconnect(); } catch {}
    try { liveSourceRef.current?.disconnect(); } catch {}
    liveStreamRef.current?.getTracks().forEach((track) => track.stop());
    liveSessionRef.current?.close?.();
    pendingVoiceActionRef.current = null;
    liveAudioSourcesRef.current.forEach((source) => { try { source.stop(); } catch {} });
    liveAudioSourcesRef.current = [];
    liveSessionRef.current = null;
    liveProcessorRef.current = null;
    liveSourceRef.current = null;
    liveStreamRef.current = null;
    liveInputContextRef.current?.close().catch(() => {});
    liveOutputContextRef.current?.close().catch(() => {});
    liveInputContextRef.current = null;
    liveOutputContextRef.current = null;
    livePlaybackTimeRef.current = 0;
    setIsLiveConnected(false);
    setIsRecording(false);
    setLiveStatus('idle');
    setLiveTranscript('');
  };

  const floatToPcm16Base64 = (input: Float32Array, inputRate: number) => {
    const ratio = inputRate / 16000;
    const pcm = new Int16Array(Math.floor(input.length / ratio));
    for (let i = 0; i < pcm.length; i++) {
      const sample = Math.max(-1, Math.min(1, input[Math.floor(i * ratio)] || 0));
      pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }
    const bytes = new Uint8Array(pcm.buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + 0x8000, bytes.length)));
    }
    return btoa(binary);
  };

  const playLiveAudio = (base64: string) => {
    const context = liveOutputContextRef.current;
    if (!context || !base64) return;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const pcm = new Int16Array(bytes.buffer);
    const buffer = context.createBuffer(1, pcm.length, 24000);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) channel[i] = pcm[i] / 32768;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    const startAt = Math.max(context.currentTime + 0.025, livePlaybackTimeRef.current);
    source.onended = () => {
      liveAudioSourcesRef.current = liveAudioSourcesRef.current.filter((item) => item !== source);
    };
    liveAudioSourcesRef.current.push(source);
    source.start(startAt);
    livePlaybackTimeRef.current = startAt + buffer.duration;
  };

  const startLiveVoice = async () => {
    if (!memoryReady || isLiveConnected || liveStatus === 'connecting' || isLoading) return;
    pendingTextActionRef.current = null;
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessages((prev) => [...prev, { id: 'live_unsupported_' + Date.now(), sender: 'mone', text: 'Este navegador não oferece acesso ao microfone. Você pode conversar por texto.', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
      return;
    }
    setLiveStatus('connecting');
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Entre na sua conta SisFinz para iniciar a conversa por voz.');
      const idToken = await user.getIdToken();
      const tokenResponse = await fetch('/api/mone/live-token', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + idToken, 'Content-Type': 'application/json' },
      });
      if (!tokenResponse.ok) {
        const body = await tokenResponse.json().catch(() => ({}));
        throw new Error(body.error || 'Não foi possível iniciar a voz em tempo real.');
      }
      const tokenData = await tokenResponse.json();
      const financialContext = [
        'Idioma: ' + language + '; moeda: ' + currency + '.',
        'Saldo atual: ' + currentBalance + '; saldo projetado: ' + forecastBalance + '.',
        'Contas: ' + JSON.stringify(accounts.map((a) => ({ id: a.id, name: a.name, balance: a.currentBalance, currency: a.currency }))).slice(0, 4500) + '.',
        'Faturas: ' + JSON.stringify(bills.map((b) => ({ id: b.id, name: b.name, amount: b.amount, dueDay: b.dueDay }))).slice(0, 4500) + '.',
        'Receitas: ' + JSON.stringify(incomes.map((i) => ({ id: i.id, name: i.name, amount: i.amount }))).slice(0, 2500) + '.',
        'Despesas recentes: ' + JSON.stringify(expenses.slice(-15).map((e) => ({ id: e.id, name: e.name, amount: e.amount, date: e.date, category: e.category }))).slice(0, 3500) + '.',
        'Metas: ' + JSON.stringify(goals.map((g) => {
          const savedAmount = (g.history || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
          return {
            id: g.id,
            title: g.title,
            targetAmount: g.targetAmount || g.totalTarget,
            savedAmount,
            remainingAmount: Math.max(0, (Number(g.totalTarget || g.targetAmount) || 0) - savedAmount),
            completedSquares: (g.completedSquares || []).length,
            totalSquares: g.totalSquares || 0,
            currency: g.currency || currency,
          };
        })).slice(0, 2500) + '.',
        'Contas compartilhadas: ' + JSON.stringify(sharedBills.map((b) => ({ id: b.id, title: b.title, amount: b.amount, month: b.month, dueDate: b.dueDate, myShare: myUserId ? b.shares?.[myUserId]?.amount : undefined, myShareStatus: myUserId ? b.shares?.[myUserId]?.status : undefined }))).slice(0, 2500) + '.',
        'Desafios semanais: ' + JSON.stringify(weeklyChallenges.map((challenge) => ({ id: challenge.id, title: challenge.title, initialAmount: challenge.initialAmount, totalWeeks: challenge.totalWeeks || 52, totalTarget: challenge.totalTarget, completedWeeks: challenge.completedWeeks, status: challenge.status, savingMode: challenge.savingMode }))).slice(0, 2500) + '.',
        'Memória recente da conversa: ' + messages.slice(-24).map((m) => (m.sender === 'user' ? 'Usuário: ' : 'Mone: ') + m.text.slice(0, 500)).join(' | ').slice(0, 12000) + '.',
        'Preferência de estilo da Mone: ' + moneStyle + '.',
      ].join(' ');
      const liveSystemInstruction = `Você é Mone, assistente geral e copiloto financeiro do SisFinz. Converse naturalmente sobre qualquer assunto, como uma IA geral moderna. Use o histórico e as preferências abaixo para manter continuidade. Não transforme papo casual em comandos. Quando o usuário pedir explicitamente para registrar uma despesa, receita, fatura, marcar uma conta como paga, marcar sua parte de uma conta compartilhada como paga, marcar uma receita como recebida, concluir ou desfazer uma semana de desafio semanal com a conta escolhida pelo usuário, transferir dinheiro entre contas próprias, alterar ou excluir registros financeiros ou consultar dados, use a ferramenta sisfinz_action. Para alterações e exclusões, peça confirmação explícita antes de executar; só execute depois de um “sim” claro. Nunca diga que uma ação foi concluída sem receber confirmação de sucesso da ferramenta. Responda em ${language === 'pt' ? 'português brasileiro' : language === 'es' ? 'espanhol' : 'inglês'}. Contexto financeiro: ${financialContext}`;
      const ai = new GoogleGenAI({ apiKey: tokenData.token, httpOptions: { apiVersion: 'v1beta' } });
      const session = await ai.live.connect({
        model: tokenData.model || 'gemini-3.1-flash-live-preview',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: { parts: [{ text: liveSystemInstruction }] },
          tools: [{
            functionDeclarations: [{
              name: 'sisfinz_action',
              description: 'Executa uma ação financeira solicitada explicitamente pelo usuário no SisFinz ou responde uma consulta financeira. Use somente quando o usuário pedir claramente uma operação ou pergunta financeira. Não invente dados.',
              parameters: {
                type: 'OBJECT',
                properties: {
                  request: { type: 'STRING', description: 'Pedido original do usuário em linguagem natural, sem alterar valores ou nomes.' },
                },
                required: ['request'],
              },
            }],
          }],
        },
        callbacks: {
          onopen: () => {
            setIsLiveConnected(true);
            setIsRecording(true);
            setLiveStatus('listening');
          },
          onmessage: async (message: any) => {
            const toolCalls = message?.toolCall?.functionCalls || [];
            if (toolCalls.length && liveSessionRef.current) {
              const functionResponses = await Promise.all(toolCalls.map(async (call: any) => {
                const request = typeof call?.args?.request === 'string' ? call.args.request.trim() : '';
                const destructiveRequest = /\b(apag\w*|exclu\w*|delet\w*|remov\w*|alter\w*|mud\w*|troc\w*|substitu\w*|atualiz\w*|modific\w*|ajust\w*|aument\w*|reduz\w*|edit\w*|renome\w*|rename\w*|corrig\w*|coloc\w*|defin\w*|desfaz\w*|estorn\w*|revert\w*)\b/i.test(request);
                const normalizedReply = request.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[.!?]+$/g, '').trim();
                const isVoiceConfirmation = /^(sim|confirmo|confirmar|pode fazer|pode confirmar|isso mesmo|yes|confirm|go ahead|si|dale|ok|okay)$/.test(normalizedReply);
                const isVoiceCancellation = /^(nao|cancela|cancelar|deixa|no|cancel|never mind)$/.test(normalizedReply);
                if (!request) {
                  return { id: call.id, name: call.name, response: { error: 'Pedido vazio. Pergunte ao usuário o que deseja fazer.' } };
                }
                let actionRequest = request;
                if (pendingVoiceActionRef.current && isVoiceConfirmation) {
                  actionRequest = pendingVoiceActionRef.current;
                  pendingVoiceActionRef.current = null;
                } else if (pendingVoiceActionRef.current && isVoiceCancellation) {
                  pendingVoiceActionRef.current = null;
                  return { id: call.id, name: call.name, response: { result: 'Ação cancelada. Nenhuma alteração foi feita.' } };
                } else if (pendingVoiceActionRef.current) {
                  pendingVoiceActionRef.current = null;
                }
                if (destructiveRequest && actionRequest === request) {
                  pendingVoiceActionRef.current = request;
                  return {
                    id: call.id,
                    name: call.name,
                    response: { result: 'Ainda não execute essa alteração ou exclusão. Diga ao usuário exatamente o pedido que ele fez e pergunte: “Você confirma que devo fazer isso?”. Aguarde um “sim” claro antes de chamar a ferramenta novamente. Se ele disser não, não execute nada.' },
                  };
                }
                try {
                  const result = await askMone(actionRequest, moneContext);
                  if (result.createdItem) setLastActionItem(result.createdItem);
                  return {
                    id: call.id,
                    name: call.name,
                    response: { result: result.text, actionExecuted: result.actionExecuted || null },
                  };
                } catch (error: any) {
                  return { id: call.id, name: call.name, response: { error: error?.message || 'A operação não foi concluída.' } };
                }
              }));
              liveSessionRef.current.sendToolResponse({ functionResponses });
            }
            const content = message?.serverContent;
            if (content?.inputTranscription?.text) {
              const spoken = content.inputTranscription.text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[.!?]+$/g, '').trim();
              if (/^(?:nao\s+)?(?:cancela|cancelar|deixa|no|cancel|never mind)$/.test(spoken)) {
                pendingVoiceActionRef.current = null;
              }
              liveUserTextRef.current += content.inputTranscription.text;
              setLiveTranscript(liveUserTextRef.current);
            }
            if (content?.outputTranscription?.text) {
              liveMoneTextRef.current += content.outputTranscription.text;
              setLiveTranscript(liveMoneTextRef.current);
              setLiveStatus('speaking');
            }
            (content?.modelTurn?.parts || []).forEach((part: any) => {
              if (part?.inlineData?.data) playLiveAudio(part.inlineData.data);
              if (part?.text) {
                liveMoneTextRef.current += part.text;
                setLiveTranscript(liveMoneTextRef.current);
              }
            });
            if (content?.interrupted) {
              liveAudioSourcesRef.current.forEach((source) => {
                try { source.stop(); } catch {}
              });
              liveAudioSourcesRef.current = [];
              livePlaybackTimeRef.current = liveOutputContextRef.current?.currentTime || 0;
              setLiveStatus('listening');
            }
            if (content?.turnComplete) {
              const stamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const userText = liveUserTextRef.current.trim();
              const moneText = liveMoneTextRef.current.trim();
              setMessages((prev) => [
                ...prev,
                ...(userText ? [{ id: 'live_user_' + Date.now(), sender: 'user' as const, text: userText, timestamp: stamp }] : []),
                ...(moneText ? [{ id: 'live_mone_' + Date.now(), sender: 'mone' as const, text: moneText, timestamp: stamp }] : []),
              ]);
              liveUserTextRef.current = '';
              liveMoneTextRef.current = '';
              setLiveTranscript('');
              setLiveStatus('listening');
            }
          },
          onerror: (error: any) => {
            console.error('[Mone Live] Connection error:', error);
            stopLiveVoice();
            setMessages((prev) => [...prev, {
              id: 'live_connection_error_' + Date.now(),
              sender: 'mone',
              text: 'A conexão de voz foi interrompida. Toque no microfone para tentar novamente ou continue por texto.',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }]);
          },
          onclose: () => {
            setIsLiveConnected(false);
            setIsRecording(false);
            setLiveStatus('idle');
          },
        },
      });
      liveSessionRef.current = session;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      liveStreamRef.current = stream;
      const inputContext = new AudioContext({ sampleRate: 16000 });
      const outputContext = new AudioContext({ sampleRate: 24000 });
      await Promise.all([inputContext.resume(), outputContext.resume()]);
      liveInputContextRef.current = inputContext;
      liveOutputContextRef.current = outputContext;
      const source = inputContext.createMediaStreamSource(stream);
      const processor = inputContext.createScriptProcessor(2048, 1, 1);
      const silentGain = inputContext.createGain();
      silentGain.gain.value = 0;
      source.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(inputContext.destination);
      processor.onaudioprocess = (event) => {
        if (!liveSessionRef.current) return;
        const data = floatToPcm16Base64(event.inputBuffer.getChannelData(0), inputContext.sampleRate);
        liveSessionRef.current.sendRealtimeInput({ audio: { data, mimeType: 'audio/pcm;rate=16000' } });
      };
      liveSourceRef.current = source;
      liveProcessorRef.current = processor;


    } catch (error: any) {
      console.error('[Mone Live] Start failed:', error);
      stopLiveVoice();
      setMessages((prev) => [...prev, { id: 'live_error_' + Date.now(), sender: 'mone', text: error?.message || 'Não consegui iniciar a conversa em tempo real. Você ainda pode usar o texto.', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    }
  };

  const stopRecording = () => {
    if (isLiveConnected) {
      stopLiveVoice();
      return;
    }
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
    pendingVoiceActionRef.current = null;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
    try { liveProcessorRef.current?.disconnect(); } catch {}
    try { liveSourceRef.current?.disconnect(); } catch {}
    liveStreamRef.current?.getTracks().forEach((track) => track.stop());
    liveSessionRef.current?.close?.();
    liveAudioSourcesRef.current.forEach((source) => { try { source.stop(); } catch {} });
    liveAudioSourcesRef.current = [];
    liveInputContextRef.current?.close().catch(() => {});
    liveOutputContextRef.current?.close().catch(() => {});
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
                    {liveStatus === 'connecting' ? 'Conectando à Mone…' : liveStatus === 'speaking' ? 'Mone está falando…' : isLiveConnected ? 'Estou ouvindo você…' : isLoading ? 'Entendendo seu pedido…' : 'Oi! Sou a Mone.'}
                  </motion.h1>
                </AnimatePresence>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
                  {isLiveConnected ? 'Conversa em tempo real. Pode falar naturalmente e me interromper.' : liveStatus === 'connecting' ? 'Preparando o microfone e a conexão segura.' : isLoading ? 'Estou cuidando disso para você.' : 'Converse comigo sobre qualquer assunto ou suas finanças.'}
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
              {isLiveConnected && liveTranscript && (
                <div className="mb-4 w-full max-w-md rounded-2xl border border-emerald-100 bg-white/75 px-4 py-3 text-left text-xs leading-relaxed text-slate-600">
                  <span className="mb-1 block text-[9px] font-black uppercase tracking-widest text-emerald-700">Transcrição ao vivo</span>
                  {liveTranscript}
                </div>
              )}

              <div className="flex w-full max-w-md items-center justify-center gap-5">
                <button type="button" onClick={() => setShowTextMode((value) => !value)} className="flex h-12 min-w-12 flex-col items-center justify-center gap-1 rounded-2xl px-3 text-slate-500 transition hover:bg-white/80 hover:text-emerald-700" aria-label="Alternar conversa escrita">
                  <Bot className="h-5 w-5" />
                  <span className="text-[9px] font-bold">{showTextMode ? 'Ocultar texto' : 'Texto'}</span>
                </button>

                <motion.button
                  type="button"
                  onClick={isLiveConnected ? stopRecording : startLiveVoice}
                  disabled={isLoading || liveStatus === 'connecting' || !memoryReady}
                  whileTap={{ scale: 0.94 }}
                  className={`flex h-24 w-24 items-center justify-center rounded-full border-[6px] border-white shadow-[0_14px_40px_rgba(16,185,129,0.25)] transition-all disabled:opacity-50 ${isRecording ? 'bg-gradient-to-br from-rose-400 to-rose-600 text-white' : 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white'}`}
                  aria-label={isLiveConnected ? 'Encerrar conversa por voz' : 'Iniciar conversa por voz'}
                >
                  {liveStatus === 'connecting' ? <Loader2 className="h-8 w-8 animate-spin" /> : isLiveConnected ? <Square className="h-8 w-8 fill-current" /> : <Mic className="h-9 w-9" />}
                </motion.button>

                <button type="button" onClick={() => { setIsVoiceReplyEnabled((value) => !value); if (typeof window !== 'undefined' && 'speechSynthesis' in window && isVoiceReplyEnabled) window.speechSynthesis.cancel(); }} className={`flex h-12 min-w-12 flex-col items-center justify-center gap-1 rounded-2xl px-3 transition hover:bg-white/80 ${isVoiceReplyEnabled ? 'text-emerald-700' : 'text-slate-400'}`} aria-label="Alternar resposta falada">
                  <Volume2 className="h-5 w-5" />
                  <span className="text-[9px] font-bold">{isVoiceReplyEnabled ? 'Voz ligada' : 'Voz desligada'}</span>
                </button>
              </div>

              <p className="mt-4 text-[10px] font-medium text-slate-400">
                {isLiveConnected ? 'Toque no botão para encerrar a conversa' : 'Toque no microfone para iniciar uma conversa ao vivo'}
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
