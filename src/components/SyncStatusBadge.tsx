import React from 'react';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { LanguageCode } from '../types';
import { WifiOff, CheckCircle2, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';

interface SyncStatusBadgeProps {
  language?: LanguageCode;
  className?: string;
  showTextOnMobile?: boolean;
}

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({
  language = 'pt',
  className = '',
  showTextOnMobile = false,
}) => {
  const { isOnline, syncState } = useSyncStatus();

  const labels = {
    offline: language === 'es' ? 'Offline' : language === 'pt' ? 'Offline' : 'Offline',
    syncing: language === 'es' ? 'Sincronizando...' : language === 'pt' ? 'Sincronizando...' : 'Syncing...',
    synced: language === 'es' ? 'Sincronizado' : language === 'pt' ? 'Sincronizado' : 'Synced',
  };

  const getStatusColor = () => {
    if (!isOnline || syncState === 'offline') return 'amber';
    if (syncState === 'syncing') return 'blue';
    return 'emerald';
  };

  const color = getStatusColor();
  const colorMap = {
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] border transition-all ${colorMap[color]} ${className}`}
      title={
        !isOnline || syncState === 'offline'
          ? (language === 'pt' ? 'Você está offline. Alterações salvas localmente.' : 'Estás sin conexión. Cambios guardados localmente.')
          : syncState === 'syncing'
          ? (language === 'pt' ? 'Sincronizando dados...' : 'Sincronizando datos...')
          : (language === 'pt' ? 'Dados sincronizados' : 'Datos sincronizados')
      }
    >
      <div className="relative flex items-center justify-center">
        {color === 'amber' && (
          <>
            <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-amber-400 opacity-75"></span>
            <WifiOff className="w-3 h-3 shrink-0 relative z-10" />
          </>
        )}
        {color === 'blue' && (
          <RefreshCw className="w-3 h-3 animate-spin shrink-0" />
        )}
        {color === 'emerald' && (
          <CheckCircle2 className="w-3 h-3 shrink-0" />
        )}
      </div>
      <span className={showTextOnMobile ? 'inline' : 'hidden sm:inline'}>
        {color === 'amber' ? labels.offline : color === 'blue' ? labels.syncing : labels.synced}
      </span>
    </motion.div>
  );
};
