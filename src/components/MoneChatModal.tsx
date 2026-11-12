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
import { MoneMascot } from './MoneMascot';
import { askMone, MoneContext, MoneResponse, MoneActionItem } from '../utils/moneEngine';
import { getTranslations } from '../utils/i18n';
import { useSyncStatus } from '../hooks/useSyncStatus';
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
  mood = 'calm',
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
    if (language === 'pt') return 'Como posso ajudar com suas finanças hoje?';
    if (language === 'es') return '¿Cómo puedo ayudarte con tus finanzas hoy?';
    return 'How can I help with your finances today?';
  }, [language]);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'mone',
      text: initialGreeting,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [lastActionItem, setLastActionItem] = useState<MoneActionItem | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
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
      text: query,
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
      if (audio && isVoiceReplyEnabled && typeof window !== 'undefined' && 'speechSynthesis' in window) {
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
          await handleSendMessage('Comando enviado por voz. Interprete exatamente o que foi dito, inclusive expressões informais.', { data, mimeType: blob.type || 'audio/webm' });
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

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-hidden overscroll-contain">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="glass-overlay"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="glass-modal w-full max-w-lg h-[calc(100dvh-4rem)] sm:h-[680px] rounded-[2.5rem] flex flex-col overflow-hidden relative z-10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-200/60 flex items-center justify-between shrink-0 relative overflow-hidden bg-white/40">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-transparent opacity-50" />
              
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/30 shadow-xs">
                  <MoneMascot mood={mood} size="sm" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                      Mone
                      <span className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                        isOnline 
                          ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30' 
                          : 'bg-amber-500/15 text-amber-700 border-amber-500/30'
                      }`}>
                        {!isOnline && <WifiOff className="w-3 h-3" />}
                        {isOnline ? 'Online' : 'Offline'}
                      </span>
                    </h3>
                  </div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                    {moodLabel || (t as any).smartAssistant || 'Assistente Financeiro'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 relative z-10">
                {/* Style Selector */}
                <div className="relative">
                  <button
                    onClick={() => setIsStyleMenuOpen(!isStyleMenuOpen)}
                    className="h-10 px-3 rounded-2xl bg-white/70 hover:bg-white border border-slate-200/80 text-slate-700 flex items-center gap-2 transition-all cursor-pointer shadow-xs"
                  >
                    <span className="text-lg">{currentStyleObj.emoji}</span>
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  </button>

                  <AnimatePresence>
                    {isStyleMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 top-full mt-2 w-64 glass-dropdown p-2 rounded-3xl z-50 overflow-hidden"
                      >
                        <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-100 mb-1">
                          Personalidade do Assistente
                        </div>
                        {STYLE_OPTIONS.map((opt) => {
                          const isSelected = opt.id === (moneStyle || 'direto');
                          return (
                            <button
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
                  onClick={handleClearChat}
                  className="p-2.5 rounded-2xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/80 transition-all cursor-pointer"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <button
                  onClick={onClose}
                  className="p-2.5 rounded-2xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/80 transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Message Stream */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {messages.map((msg, idx) => {
                const isMone = msg.sender === 'mone';
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, x: isMone ? -10 : 10, y: 10 }}
                    animate={{ opacity: 1, x: 0, y: 0 }}
                    transition={{ delay: idx === messages.length - 1 ? 0.1 : 0 }}
                    className={`flex gap-3 max-w-[90%] ${isMone ? 'self-start' : 'self-end flex-row-reverse'}`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                      isMone ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-emerald-600 border border-emerald-500'
                    }`}>
                      {isMone ? <MoneMascot mood={mood} size="sm" className="scale-90" /> : <User className="w-4 h-4 text-white" />}
                    </div>

                    <div className={`p-4 rounded-2xl shadow-sm relative overflow-hidden ${
                      isMone 
                        ? 'bg-white/80 border border-slate-200/80 text-slate-800' 
                        : 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white font-medium border border-emerald-500/30'
                    }`}>
                      {isMone && <div className="absolute top-0 right-0 p-2 opacity-50"><Sparkles className="w-3 h-3 text-emerald-600" /></div>}
                      <div className="text-[13px] leading-relaxed whitespace-pre-wrap">
                        {msg.text.split('\n\n').map((para, i) => (
                          <p key={i} className="mb-2 last:mb-0">
                            {para.split(/(\*\*.*?\*\*)/g).map((part, j) => {
                              if (part.startsWith('**') && part.endsWith('**')) {
                                return <strong key={j} className="font-black text-slate-900">{part.slice(2, -2)}</strong>;
                              }
                              return part;
                            })}
                          </p>
                        ))}
                      </div>
                      <div className={`text-[9px] mt-2 font-black uppercase tracking-widest text-right ${isMone ? 'text-slate-400' : 'text-emerald-100'}`}>
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
                  <div className="p-4 rounded-2xl bg-white/80 border border-slate-200/80 text-slate-500 italic text-xs shadow-xs">
                    Mone está pensando...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Bottom Section */}
            <div className="p-4 bg-white/40 border-t border-slate-200/60 space-y-4">
              <div className="flex items-center justify-between -mb-2 px-1">
                <span className="text-[10px] font-semibold text-slate-500">{isRecording ? 'Estou ouvindo… toque no botão para enviar' : 'Toque no microfone e fale naturalmente'}</span>
                <button type="button" onClick={() => setIsVoiceReplyEnabled((value) => !value)} className="flex items-center gap-1 text-[10px] font-bold text-emerald-700" aria-label="Alternar resposta falada">
                  <Volume2 className="w-3.5 h-3.5" /> {isVoiceReplyEnabled ? 'Voz ativada' : 'Voz desativada'}
                </button>
              </div>
              {/* Quick Suggestions */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {quickSuggestions.map((sug, idx) => (
                  <motion.button
                    key={idx}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleSendMessage(sug)}
                    className="px-4 py-2 rounded-2xl bg-white/70 hover:bg-white border border-slate-200/80 text-slate-700 text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer shadow-xs"
                  >
                    {sug}
                  </motion.button>
                ))}
              </div>

              {/* Input Bar */}
              <form
                onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                className="relative flex items-center gap-2"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Envie uma mensagem para Mone..."
                  className="flex-1 h-14 bg-white/80 border border-slate-200/80 rounded-3xl px-6 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/60 transition-all shadow-xs"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isLoading}
                  aria-label={isRecording ? 'Finalizar gravação' : 'Falar com Mone'}
                  className={`w-14 h-14 rounded-3xl flex items-center justify-center shrink-0 transition-all border ${isRecording ? 'bg-rose-500 text-white border-rose-400 animate-pulse' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'} disabled:opacity-40`}
                >
                  {isRecording ? <Square className="w-5 h-5 fill-current" /> : <Mic className="w-5 h-5" />}
                </button>
                <motion.button
                  whileHover={{ scale: 1.05 }
                  whileTap={{ scale: 0.95 }}
                  type="submit"
                  disabled={!inputValue.trim() || isLoading}
                  className="w-14 h-14 rounded-3xl bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-600/20 disabled:opacity-40 transition-all cursor-pointer shrink-0"
                >
                  <Send className="w-5 h-5" />
                </motion.button>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
