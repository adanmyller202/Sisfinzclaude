import React from 'react';
import { motion } from 'motion/react';
import { Target, Plus, Sparkles, ShieldCheck, Zap, Rocket } from 'lucide-react';

interface EmptyStateProps {
  onOpenNewGoalModal: () => void;
  userName?: string | null;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  onOpenNewGoalModal,
  userName,
}) => {
  return (
    <div className="py-16 sm:py-24 px-6 text-center max-w-xl mx-auto space-y-10">
      {/* Animated Icon Stage */}
      <div className="relative mx-auto w-24 h-24">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 15 }}
          className="absolute inset-0 rounded-[2.5rem] bg-emerald-500/10 border border-emerald-500/20 shadow-inner flex items-center justify-center text-emerald-600 dark:text-emerald-400"
        >
          <Target className="w-12 h-12" />
        </motion.div>
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            rotate: [0, 10, -10, 0]
          }}
          transition={{ duration: 4, repeat: Infinity }}
          className="absolute -top-2 -right-2 w-8 h-8 rounded-xl bg-white border border-slate-200 shadow-md flex items-center justify-center"
        >
          <Sparkles className="w-4 h-4 text-emerald-500" />
        </motion.div>
      </div>

      <div className="space-y-4">
        <motion.span 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[10px] font-black uppercase tracking-[0.4em] text-emerald-600"
        >
          BEM-VINDO{userName ? `, ${userName.toUpperCase()}` : ''}
        </motion.span>
        
        <motion.h2 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight"
        >
          Transforme planos em conquistas reais
        </motion.h2>
        
        <motion.p 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-[13px] font-bold text-slate-500 leading-relaxed max-w-sm mx-auto uppercase tracking-widest opacity-80"
        >
          Você ainda não possui objetivos. Defina sua próxima meta e acompanhe o progresso de forma visual e interativa.
        </motion.p>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
        className="pt-4"
      >
        <motion.button
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.95 }}
          type="button"
          onClick={onOpenNewGoalModal}
          className="inline-flex items-center gap-3 px-10 py-5 text-[11px] font-black text-white bg-emerald-600 hover:bg-emerald-500 rounded-2xl shadow-2xl shadow-emerald-600/30 transition-all cursor-pointer uppercase tracking-[0.2em]"
        >
          <Plus className="w-5 h-5 stroke-[3]" />
          <span>Criar meu primeiro objetivo</span>
        </motion.button>
      </motion.div>

      {/* Value Props Grid */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="pt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left"
      >
        <div className="p-6 rounded-3xl glass-card border border-white/80 space-y-3 shadow-xs hover:border-emerald-500/30 transition-colors group">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
             <Rocket className="w-5 h-5" />
          </div>
          <div className="space-y-1">
             <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight">Metas Livres</p>
             <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">Projetos, viagens ou reservas.</p>
          </div>
        </div>

        <div className="p-6 rounded-3xl glass-card border border-white/80 space-y-3 shadow-xs hover:border-emerald-500/30 transition-colors group">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
             <Zap className="w-5 h-5" />
          </div>
          <div className="space-y-1">
             <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight">Cálculo Smart</p>
             <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">Quadrados dinâmicos automáticos.</p>
          </div>
        </div>

        <div className="p-6 rounded-3xl glass-card border border-white/80 space-y-3 shadow-xs hover:border-emerald-500/30 transition-colors group">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-700 group-hover:scale-110 transition-transform">
             <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-1">
             <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight">Privacidade</p>
             <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">Dados protegidos de ponta a ponta.</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
