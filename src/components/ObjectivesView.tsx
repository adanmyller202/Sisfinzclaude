import React, { useRef, useState } from 'react';
import { ChallengeGoal, CurrencyCode, ChallengeSquare, LanguageCode } from '../types';
import { getGoalSavedAmount } from '../utils/currency';
import { getTranslations } from '../utils/i18n';
import { DashboardStats } from './DashboardStats';
import { SquareGrid } from './SquareGrid';
import { GoalPuzzle } from './GoalPuzzle';
import { useGoalImage } from '../hooks/useGoalImage';
import {
  Target,
  Plus,
  Trash2,
  Edit2,
  Sparkles,
  ChevronLeft,
  Camera,
  AlertCircle,
  Loader2,
  ArrowLeft,
  LayoutGrid,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ObjectivesViewProps {
  goals: ChallengeGoal[];
  activeGoal: ChallengeGoal | null;
  activeGoalSquares: ChallengeSquare[];
  currency: CurrencyCode;
  language?: LanguageCode;
  savedAmount: number;
  targetAmount: number;
  remainingAmount: number;
  financialProgressPercent: number;
  completedSquaresCount: number;
  totalSquaresCount: number;
  squaresProgressPercent: number;
  onSwitchGoal: (id: string) => void;
  onOpenNewGoalModal: () => void;
  onOpenEditGoalModal: () => void;
  onOpenAvulsoModal: () => void;
  onDeleteGoal: (id: string) => void;
  onSquareClick: (squareId: number) => void;
  selectedSquareId: number | null;
  onReturnToFinance?: () => void;
}

export const ObjectivesView: React.FC<ObjectivesViewProps> = ({
  goals,
  activeGoal,
  activeGoalSquares,
  currency,
  language = 'pt',
  savedAmount,
  targetAmount,
  remainingAmount,
  financialProgressPercent,
  completedSquaresCount,
  totalSquaresCount,
  squaresProgressPercent,
  onSwitchGoal,
  onOpenNewGoalModal,
  onOpenEditGoalModal,
  onOpenAvulsoModal,
  onDeleteGoal,
  onSquareClick,
  selectedSquareId,
  onReturnToFinance,
}) => {
  const t = getTranslations(language);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { image: goalImage, saveImage, removeImage } = useGoalImage(activeGoal?.id);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setIsUploading(true);
    setUploadError(null);
    try {
      await saveImage(file);
    } catch (err: any) {
      setUploadError(err?.message || t.photoErrorDefault);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    const confirmMsg = t.removePhotoConfirm || 'Tem certeza de que deseja remover a foto deste sonho?';
    if (window.confirm(confirmMsg)) {
      setUploadError(null);
      try {
        await removeImage();
      } catch (err: any) {
        setUploadError(err?.message || t.photoErrorDefault);
      }
    }
  };

  const activeGoalCurrency = activeGoal?.currency || currency;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-24">
      {/* Dynamic Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={onReturnToFinance} className="p-3 rounded-2xl glass-card text-slate-700 hover:text-slate-900 transition-all cursor-pointer shadow-xs">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center shadow-md"><Target className="w-5 h-5 text-white" /></div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Meus Objetivos</h2>
            </div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1.5 opacity-80">Metas baseadas no desafio dos quadrados</p>
          </div>
        </div>

        <button
          onClick={onOpenNewGoalModal}
          className="h-12 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Nova Meta
        </button>
      </div>

      {/* Goal Horizontal Selector */}
      {goals.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2">
          {goals.map((g) => {
            const isActive = activeGoal?.id === g.id;
            const saved = getGoalSavedAmount(g);
            const pct = g.totalTarget > 0 ? Math.min(100, Math.round((saved / g.totalTarget) * 100)) : 0;
            return (
              <motion.button
                key={g.id}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onSwitchGoal(g.id)}
                className={`h-14 px-6 rounded-2xl border transition-all flex items-center gap-3 shrink-0 cursor-pointer ${
                  isActive 
                    ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-600/20' 
                    : 'glass-card text-slate-600 hover:text-slate-900 shadow-xs'
                }`}
              >
                <span className="text-xl">{g.icon || '🎯'}</span>
                <div className="text-left">
                  <div className="text-xs font-black tracking-tight leading-none">{g.title}</div>
                  <div className={`text-[9px] font-black uppercase tracking-widest mt-1 ${isActive ? 'text-emerald-100' : 'text-slate-500'}`}>{pct}% Concluído</div>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      {goals.length === 0 ? (
        <div className="glass-panel rounded-[3rem] p-12 text-center space-y-6 max-w-xl mx-auto my-12 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="w-20 h-20 rounded-[2.5rem] bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto shadow-md relative z-10">
            <Target className="w-10 h-10 text-emerald-600 animate-pulse" />
          </div>
          <div className="space-y-2 relative z-10">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Nenhuma Meta Ativa</h3>
            <p className="text-sm font-medium text-slate-600 leading-relaxed max-w-xs mx-auto">
              Transforme seus sonhos em realidade. Defina seu primeiro objetivo e comece a economizar hoje!
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onOpenNewGoalModal}
            className="h-16 px-8 rounded-3xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-emerald-600/30 transition-all cursor-pointer relative z-10"
          >
            Iniciar Jornada
          </motion.button>
        </div>
      ) : activeGoal && (
        <div className="space-y-6">
          <DashboardStats
            goal={activeGoal}
            savedAmount={savedAmount}
            targetAmount={targetAmount}
            remainingAmount={remainingAmount}
            financialProgressPercent={financialProgressPercent}
            completedSquaresCount={completedSquaresCount}
            totalSquaresCount={totalSquaresCount}
            squaresProgressPercent={squaresProgressPercent}
            currency={activeGoalCurrency}
            language={language}
            onEditGoalClick={onOpenEditGoalModal}
            onAddAvulsoClick={onOpenAvulsoModal}
          />

          <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleFileChange} />

          {goalImage ? (
            <GoalPuzzle
              goalId={activeGoal.id}
              goalTitle={activeGoal.title}
              imageUrl={goalImage.dataUrl}
              width={goalImage.width}
              height={goalImage.height}
              progressPercent={financialProgressPercent}
              language={language}
              onChangePhoto={() => fileInputRef.current?.click()}
              onRemovePhoto={handleRemovePhoto}
              isProcessing={isUploading}
            />
          ) : (
            <div className="glass-card rounded-[2.5rem] p-8 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden group shadow-sm">
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-transparent" />
              <div className="flex flex-col md:flex-row items-center gap-6 relative z-10">
                <div className="w-20 h-20 rounded-[2rem] bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform duration-500">
                  <Camera className="w-10 h-10 text-amber-600" />
                </div>
                <div className="text-center md:text-left">
                  <h3 className="text-xl font-black text-slate-900 tracking-tight leading-none mb-2">Visualização do Sonho</h3>
                  <p className="text-sm font-medium text-slate-600 max-w-sm">Adicione uma imagem que represente seu objetivo para criar um quebra-cabeça visual progressivo.</p>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="h-16 px-8 rounded-[1.5rem] bg-white hover:bg-slate-50 border border-slate-200/80 text-slate-800 font-black text-[10px] uppercase tracking-widest transition-all cursor-pointer relative z-10 disabled:opacity-50 shadow-xs"
              >
                {isUploading ? <Loader2 className="w-5 h-5 animate-spin text-emerald-600" /> : 'Adicionar Foto'}
              </motion.button>
            </div>
          )}

          <div className="glass-panel rounded-[3rem] p-1 shadow-xl">
            <SquareGrid
              goal={activeGoal}
              currency={activeGoalCurrency}
              language={language}
              onSquareClick={onSquareClick}
              selectedSquareId={selectedSquareId}
              onAddAvulsoClick={onOpenAvulsoModal}
            />
          </div>

          <div className="flex items-center justify-center gap-4 pt-4">
            <button
              onClick={onOpenEditGoalModal}
              className="h-12 px-6 rounded-2xl glass-card text-slate-600 hover:text-slate-900 transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest shadow-xs"
            >
              <Edit2 className="w-4 h-4" /> Editar Meta
            </button>
            <button
              onClick={() => {
                if (window.confirm(`Deseja realmente excluir a meta "${activeGoal.title}"?`)) onDeleteGoal(activeGoal.id);
              }}
              className="h-12 px-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
            >
              <Trash2 className="w-4 h-4" /> Excluir Meta
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
