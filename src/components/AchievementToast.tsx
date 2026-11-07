import React, { useEffect } from 'react';
import { Achievement, LanguageCode } from '../types';
import { Sparkles, X, Award } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AchievementToastProps {
  achievement: Achievement | null;
  language?: LanguageCode;
  onClose: () => void;
}

export const AchievementToast: React.FC<AchievementToastProps> = ({
  achievement,
  language = 'pt',
  onClose,
}) => {
  useEffect(() => {
    if (!achievement) return;
    const timer = setTimeout(() => {
      onClose();
    }, 6000);
    return () => clearTimeout(timer);
  }, [achievement, onClose]);

  return (
    <AnimatePresence>
      {achievement && (
        <motion.div 
          initial={{ opacity: 0, y: 50, x: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9, x: 20, transition: { duration: 0.2 } }}
          className="fixed bottom-24 right-4 sm:bottom-8 sm:right-8 z-[100] max-w-[340px] w-full"
        >
          <div className="glass-modal p-4 rounded-3xl border border-amber-500/30 relative overflow-hidden group">
            {/* Ambient Glow */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-500/20 rounded-full blur-[40px] pointer-events-none group-hover:bg-amber-500/30 transition-colors duration-700" />
            
            <div className="flex items-center gap-4 relative z-10">
              <motion.div 
                initial={{ rotate: -20, scale: 0.5 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: 'spring', delay: 0.2 }}
                className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-3xl shadow-lg shadow-amber-500/20 shrink-0 border border-white/20"
              >
                {achievement.icon}
              </motion.div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-400 mb-0.5">
                  <Sparkles className="w-3 h-3" />
                  <span>
                    {language === 'es'
                      ? '¡Logro Desbloqueado!'
                      : language === 'pt'
                      ? 'Conquista Desbloqueada!'
                      : 'Achievement Unlocked!'}
                  </span>
                </div>
                <h4 className="text-sm font-black text-white truncate leading-tight">
                  {achievement.title}
                </h4>
                <p className="text-[11px] font-medium text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  {achievement.description}
                </p>
              </div>

              <button
                onClick={onClose}
                className="p-1.5 rounded-xl text-slate-500 hover:text-white hover:bg-white/10 transition-all cursor-pointer shrink-0 self-start"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Progress Bar (Timer) */}
            <div className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-amber-500 to-transparent w-full">
              <motion.div 
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 6, ease: 'linear' }}
                className="h-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]"
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
