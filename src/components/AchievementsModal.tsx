import React from 'react';
import { ChallengeGoal } from '../types';
import { ACHIEVEMENTS } from '../utils/achievements';
import { Award, X, Check, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AchievementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: ChallengeGoal;
  unlockedKeys: string[];
}

export const AchievementsModal: React.FC<AchievementsModalProps> = ({
  isOpen,
  onClose,
  goal,
  unlockedKeys,
}) => {
  const totalAchievements = ACHIEVEMENTS.length;
  const unlockedCount = ACHIEVEMENTS.filter((ach) =>
    unlockedKeys.includes(`${goal.id}_${ach.id}`) || ach.isUnlocked(goal)
  ).length;

  const progressPercent = Math.round((unlockedCount / totalAchievements) * 100);

  const containerVariants: any = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.05, delayChildren: 0.1 }
    }
  };

  const itemVariants: any = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 25 } }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 overflow-hidden overscroll-contain">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 glass-overlay"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="glass-modal w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden my-auto max-h-[calc(100dvh-3rem)] flex flex-col relative z-10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200/60 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center border border-amber-500/20 shadow-md">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">
                    Conquistas
                  </h3>
                  <p className="text-[11px] font-bold text-amber-700 uppercase tracking-widest">
                    {unlockedCount} de {totalAchievements} desbloqueadas
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6 overflow-y-auto overscroll-contain flex-1 min-h-0 custom-scrollbar">
              {/* Progress Header */}
              <div className="p-5 rounded-2xl bg-white/70 border border-slate-200/80 relative overflow-hidden group shadow-xs">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest mb-3 relative z-10">
                  <span className="text-slate-600">Progresso Geral</span>
                  <span className="text-amber-700 font-mono">
                    {progressPercent}%
                  </span>
                </div>
                
                <div className="h-2.5 w-full bg-slate-200/60 rounded-full overflow-hidden relative z-10">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                    className="h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-full relative"
                  >
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.3)_50%,transparent_100%)] animate-shimmer" />
                  </motion.div>
                </div>
              </div>

              {/* Achievements List */}
              <motion.div 
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid gap-3"
              >
                {ACHIEVEMENTS.map((ach) => {
                  const isUnlocked = unlockedKeys.includes(`${goal.id}_${ach.id}`) || ach.isUnlocked(goal);

                  return (
                    <motion.div
                      key={ach.id}
                      variants={itemVariants}
                      whileHover={{ scale: 1.01, x: 4 }}
                      className={`group p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                        isUnlocked
                          ? 'bg-amber-50/80 border-amber-200 shadow-sm'
                          : 'bg-white/60 border-slate-200/60 opacity-60 grayscale'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`text-2xl w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner transition-transform group-hover:scale-110 duration-300 ${
                          isUnlocked ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-slate-100 border border-slate-200/60'
                        }`}>
                          {ach.icon}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            {ach.title}
                            {isUnlocked && (
                              <Check className="w-3.5 h-3.5 text-amber-600 stroke-[3]" />
                            )}
                          </h4>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                            {ach.description}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isUnlocked ? (
                          <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                            <Check className="w-4 h-4 text-amber-600" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
                            <Lock className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-200/60 flex justify-center bg-slate-50/50 shrink-0">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onClose}
                className="px-8 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-widest shadow-md transition-all cursor-pointer"
              >
                Entendido
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
