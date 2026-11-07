import React, { useState } from 'react';
import { getBankLogoUrl } from '../utils/bankLogos';

interface BankLogoProps {
  name: string;
  type: string; // Used to look up emoji if logo fails
  size?: 'sm' | 'md' | 'lg';
  fallbackEmoji: string;
}

export const BankLogo: React.FC<BankLogoProps> = ({ name, size = 'md', fallbackEmoji }) => {
  const logoUrl = getBankLogoUrl(name);
  const [hasError, setHasError] = useState(false);
  const [isTooSmall, setIsTooSmall] = useState(false);

  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
  };

  if (!logoUrl || hasError || isTooSmall) {
    return (
      <div className={`flex items-center justify-center rounded-xl bg-slate-100 ${sizeClasses[size]} text-xl`}>
        {fallbackEmoji}
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={name}
      loading="lazy"
      className={`rounded-xl object-contain bg-white border border-slate-100 ${sizeClasses[size]}`}
      onError={() => setHasError(true)}
      onLoad={(e) => {
        const img = e.target as HTMLImageElement;
        if (img.naturalWidth <= 16) setIsTooSmall(true);
      }}
    />
  );
};
