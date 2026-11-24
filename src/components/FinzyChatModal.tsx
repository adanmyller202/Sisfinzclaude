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
import { FinzyMascot, FinzyRoutineState } from './FinzyMascot';
import { askMone, MoneContext, MoneResponse, MoneActionItem } from '../utils/moneEngine';
import { getTranslations } from '../utils/i18n';
import { useSyncStatus } from '../hooks/useSyncStatus';
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

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-hidden overscroll-contain">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="glass-overlay !z-0"
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
                  <FinzyMascot
                    mood={mood}
                    routineState={routineState}
                    skinId={skinId}
                    size="sm"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                      Finzy
                      <span
                        className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                          isOnline
                            ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-700 border-amber-500/30'
                        }`}
                      >
                        {!isOnline && <WifiOff className="w-3 h-3" />}
                        {isOnline ? 'Online' : 'Offline'}
                      </span>
                    </h3>
                  </div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                    {moodLabel || (t as any).smartAssistant || 'Assistente do SisFinz'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 relative z-10">
                {/* Style Selector */}
                <div className="relative">
                  <button
                    type="button"
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
                  <Trash2 className="w-5 h-5" />
                </button>
                <button
                  type="button"
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
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
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
                          ? 'bg-white/80 border border-slate-200/80 text-slate-800'
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
                  <div className="p-4 rounded-2xl bg-white/80 border border-slate-200/80 text-slate-500 italic text-xs shadow-xs">
                    Finzy está pensando...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Bottom Section */}
            <div className="p-4 bg-white/40 border-t border-slate-200/60 space-y-4">
              {/* Quick Suggestions */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {quickSuggestions.map((sug, idx) => (
                  <motion.button
                    type="button"
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
                  className="flex-1 h-14 bg-white/80 border border-slate-200/80 rounded-3xl px-6 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/60 transition-all shadow-xs"
                  disabled={isLoading}
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
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
