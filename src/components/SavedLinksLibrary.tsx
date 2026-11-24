import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Search,
  Plus,
  ExternalLink,
  Copy,
  Check,
  Heart,
  Pencil,
  Trash2,
  LayoutGrid,
  List as ListIcon,
  X,
  Globe,
  Loader2,
  RefreshCw,
  Undo2,
  FolderPlus,
  Sparkles,
  Instagram,
} from 'lucide-react';
import { LanguageCode } from '../types';
import {
  LinkCategoryColor,
  LinkPreviewResult,
  SavedLinkCategory,
  SavedLinkItem,
  useSavedLinks,
} from '../hooks/useSavedLinks';

interface SavedLinksLibraryProps {
  language?: LanguageCode;
}

const CAT_COLORS: Record<
  LinkCategoryColor,
  { chip: string; softBg: string; border: string; text: string; dot: string; gradient: string }
> = {
  emerald: {
    chip: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    softBg: 'bg-emerald-50/80',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
    gradient: 'from-emerald-50 via-teal-50/70 to-white',
  },
  teal: {
    chip: 'bg-teal-50 text-teal-800 border-teal-200',
    softBg: 'bg-teal-50/80',
    border: 'border-teal-200',
    text: 'text-teal-700',
    dot: 'bg-teal-500',
    gradient: 'from-teal-50 via-emerald-50/70 to-white',
  },
  sky: {
    chip: 'bg-sky-50 text-sky-800 border-sky-200',
    softBg: 'bg-sky-50/80',
    border: 'border-sky-200',
    text: 'text-sky-700',
    dot: 'bg-sky-500',
    gradient: 'from-sky-50 via-cyan-50/70 to-white',
  },
  amber: {
    chip: 'bg-amber-50 text-amber-800 border-amber-200',
    softBg: 'bg-amber-50/80',
    border: 'border-amber-200',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
    gradient: 'from-amber-50 via-orange-50/60 to-white',
  },
  violet: {
    chip: 'bg-violet-50 text-violet-800 border-violet-200',
    softBg: 'bg-violet-50/80',
    border: 'border-violet-200',
    text: 'text-violet-700',
    dot: 'bg-violet-500',
    gradient: 'from-violet-50 via-purple-50/60 to-white',
  },
  rose: {
    chip: 'bg-rose-50 text-rose-800 border-rose-200',
    softBg: 'bg-rose-50/80',
    border: 'border-rose-200',
    text: 'text-rose-700',
    dot: 'bg-rose-500',
    gradient: 'from-rose-50 via-pink-50/60 to-white',
  },
  orange: {
    chip: 'bg-orange-50 text-orange-800 border-orange-200',
    softBg: 'bg-orange-50/80',
    border: 'border-orange-200',
    text: 'text-orange-700',
    dot: 'bg-orange-500',
    gradient: 'from-orange-50 via-amber-50/60 to-white',
  },
  slate: {
    chip: 'bg-slate-100 text-slate-800 border-slate-200',
    softBg: 'bg-slate-100/80',
    border: 'border-slate-200',
    text: 'text-slate-700',
    dot: 'bg-slate-500',
    gradient: 'from-slate-100 via-slate-50 to-white',
  },
};

const QUICK_EMOJIS = [
  '🍰',
  '👕',
  '🏠',
  '🛠️',
  '📚',
  '✨',
  '✈️',
  '🛍️',
  '🎬',
  '🎵',
  '💡',
  '🏋️',
  '🍳',
  '📱',
  '💼',
  '🌿',
];

function isGenericInstagramPlaceholderUrl(url: string | null | undefined): boolean {
  if (!url) return true;
  const lower = url.toLowerCase();
  return (
    lower.includes('static.cdninstagram.com/rsrc.php') ||
    lower.includes('/static/images/ico/') ||
    lower.includes('instagram_logo') ||
    lower.includes('rsrc.php/')
  );
}

interface LinkVisualCardProps {
  link: SavedLinkItem;
  category?: SavedLinkCategory;
  viewMode: 'grid' | 'list';
  isEs: boolean;
  reduceMotion: boolean;
  copiedId: string | null;
  onCopy: (link: SavedLinkItem) => void;
  onToggleFavorite: (id: string) => void;
  onEdit: (link: SavedLinkItem) => void;
  onDelete: (id: string) => void;
}

const LinkVisualCard: React.FC<LinkVisualCardProps> = ({
  link,
  category,
  viewMode,
  isEs,
  reduceMotion,
  copiedId,
  onCopy,
  onToggleFavorite,
  onEdit,
  onDelete,
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    setImgFailed(false);
    setImgLoaded(false);
  }, [link.image]);

  const palette = CAT_COLORS[category?.color || 'emerald'] || CAT_COLORS.emerald;
  const hasRealImage = Boolean(
    link.image && !imgFailed && !(link.isInstagram && isGenericInstagramPlaceholderUrl(link.image))
  );
  const isCopied = copiedId === link.id;
  const isList = viewMode === 'list';

  return (
    <motion.article
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.94, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, x: 24, scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      whileTap={reduceMotion ? undefined : { scale: 0.985 }}
      className={`group overflow-hidden rounded-[1.5rem] border border-emerald-100/90 bg-white shadow-[0_6px_24px_rgba(15,23,42,0.05)] hover:shadow-[0_10px_28px_rgba(5,150,105,0.10)] hover:border-emerald-300/90 transition-all flex ${
        isList ? 'flex-row items-stretch' : 'flex-col'
      }`}
    >
      {/* Visual Media / Real Profile Preview / Clean Fallback Cover */}
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`relative block overflow-hidden shrink-0 ${
          isList ? 'w-28 sm:w-36 min-h-[112px]' : 'aspect-[16/10] w-full'
        }`}
      >
        {hasRealImage ? (
          <>
            {!imgLoaded && (
              <div
                className={`absolute inset-0 animate-pulse bg-gradient-to-br ${palette.gradient}`}
              />
            )}
            {link.isInstagram ? (
              <div className="relative h-full w-full overflow-hidden bg-slate-900/5">
                <img
                  src={link.image!}
                  alt=""
                  aria-hidden="true"
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 h-full w-full scale-125 object-cover blur-xl opacity-45"
                />
                <img
                  src={link.image!}
                  alt={link.title}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onLoad={() => setImgLoaded(true)}
                  onError={() => setImgFailed(true)}
                  className={`relative z-10 h-full w-full object-contain p-2 transition-all duration-300 group-hover:scale-[1.03] ${
                    imgLoaded ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              </div>
            ) : (
              <img
                src={link.image!}
                alt={link.title}
                loading="lazy"
                referrerPolicy="no-referrer"
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgFailed(true)}
                className={`h-full w-full object-cover transition-all duration-300 group-hover:scale-[1.03] ${
                  imgLoaded ? 'opacity-100' : 'opacity-0'
                }`}
              />
            )}
          </>
        ) : (
          <div
            className={`flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br ${palette.gradient} p-4 text-center`}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm border border-white/90">
              {link.isInstagram ? (
                <Instagram className="h-6 w-6 text-rose-500" />
              ) : link.favicon ? (
                <img
                  src={link.favicon}
                  alt={link.domain}
                  referrerPolicy="no-referrer"
                  className="h-7 w-7 rounded-lg object-contain"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <Globe className={`h-6 w-6 ${palette.text}`} />
              )}
            </div>
            <span className="max-w-full truncate rounded-full bg-white/85 px-2.5 py-0.5 text-[10px] font-black text-slate-600 shadow-2xs">
              {link.domain || link.siteName}
            </span>
          </div>
        )}

        {/* Top Badges */}
        <div className="absolute left-2.5 top-2.5 z-20 flex items-center gap-1.5">
          {link.isInstagram && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[9.5px] font-black text-rose-600 shadow-xs">
              <Instagram className="h-2.5 w-2.5" />
              Instagram
            </span>
          )}
        </div>

        {/* Favorite Heart Overlay */}
        <motion.button
          type="button"
          whileTap={reduceMotion ? undefined : { scale: 0.8 }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleFavorite(link.id);
          }}
          aria-label={link.favorite ? 'Remover dos favoritos' : 'Favoritar link'}
          className={`absolute right-2.5 top-2.5 z-20 flex h-8 w-8 items-center justify-center rounded-full shadow-sm transition-colors cursor-pointer ${
            link.favorite
              ? 'bg-rose-500 text-white'
              : 'bg-white/90 text-slate-500 hover:text-rose-500'
          }`}
        >
          <Heart className={`h-3.5 w-3.5 ${link.favorite ? 'fill-white' : ''}`} />
        </motion.button>
      </a>

      {/* Card Content */}
      <div className="flex flex-1 flex-col justify-between p-3.5 min-w-0 gap-2.5">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              {link.favicon && (
                <img
                  src={link.favicon}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-3.5 w-3.5 rounded-xs object-contain shrink-0"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
              <span className="truncate text-[10.5px] font-bold text-slate-400">
                {link.siteName || link.domain}
              </span>
            </div>

            {category && (
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9.5px] font-black shrink-0 ${palette.chip}`}
              >
                <span>{category.emoji}</span>
                <span className="max-w-[82px] truncate">{category.name}</span>
              </span>
            )}
          </div>

          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block font-black text-[13.5px] leading-snug text-slate-900 hover:text-emerald-700 line-clamp-2 transition-colors"
          >
            {link.title}
          </a>

          {link.description && !isList && (
            <p className="line-clamp-2 text-[11.5px] font-medium text-slate-500 leading-relaxed">
              {link.description}
            </p>
          )}

          {link.notes && (
            <p className="line-clamp-2 rounded-xl bg-emerald-50/70 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-900">
              {link.notes}
            </p>
          )}
        </div>

        {/* Action Footer */}
        <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-100">
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-2.5 py-1.5 text-[10.5px] font-black text-emerald-800 hover:bg-emerald-100 transition-colors"
          >
            <span>Abrir</span>
            <ExternalLink className="h-3 w-3" />
          </a>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onCopy(link)}
              className={`inline-flex items-center gap-1 rounded-xl px-2 py-1.5 text-[10.5px] font-black transition-colors cursor-pointer ${
                isCopied
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
              }`}
              title={isEs ? 'Copiar enlace' : 'Copiar link'}
            >
              {isCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {isCopied && <span>Copiado</span>}
            </button>

            <button
              type="button"
              onClick={() => onEdit(link)}
              className="rounded-xl p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700 transition-colors cursor-pointer"
              title={isEs ? 'Editar o mover categoría' : 'Editar ou mover categoria'}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => onDelete(link.id)}
              className="rounded-xl p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors cursor-pointer"
              title={isEs ? 'Eliminar' : 'Excluir'}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </motion.article>
  );
};

export const SavedLinksLibrary: React.FC<SavedLinksLibraryProps> = ({ language = 'pt' }) => {
  const isEs = language === 'es';
  const reduceMotion = Boolean(useReducedMotion());

  const {
    links,
    categories,
    deletedUndoItem,
    fetchLinkPreview,
    addLink,
    updateLink,
    toggleFavoriteLink,
    deleteLink,
    undoDeleteLink,
    createCategory,
    updateCategory,
    deleteCategory,
  } = useSavedLinks(language);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<'all' | 'favorites' | string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<SavedLinkItem | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [categoryInput, setCategoryInput] = useState('');
  const [previewData, setPreviewData] = useState<LinkPreviewResult | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isSavingLink, setIsSavingLink] = useState(false);

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<SavedLinkCategory | null>(null);
  const [catNameInput, setCatNameInput] = useState('');
  const [catEmojiInput, setCatEmojiInput] = useState('✨');
  const [catColorInput, setCatColorInput] = useState<LinkCategoryColor>('emerald');

  const categoryMap = useMemo(() => {
    const m: Record<string, SavedLinkCategory> = {};
    categories.forEach((c) => {
      m[c.id] = c;
    });
    return m;
  }, [categories]);

  const linkCountByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    links.forEach((l) => {
      counts[l.categoryId] = (counts[l.categoryId] || 0) + 1;
    });
    return counts;
  }, [links]);

  const favoritesCount = useMemo(() => links.filter((l) => l.favorite).length, [links]);

  const filteredLinks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return links.filter((l) => {
      if (selectedCategoryId === 'favorites' && !l.favorite) return false;
      if (
        selectedCategoryId !== 'all' &&
        selectedCategoryId !== 'favorites' &&
        l.categoryId !== selectedCategoryId
      ) {
        return false;
      }
      if (!q) return true;
      const catName = categoryMap[l.categoryId]?.name || '';
      const hay =
        `${l.title} ${l.description} ${l.siteName} ${l.domain} ${l.notes} ${catName}`.toLowerCase();
      return hay.includes(q);
    });
  }, [links, selectedCategoryId, searchQuery, categoryMap]);

  const favoriteLinksSection = useMemo(() => {
    if (selectedCategoryId !== 'all' || searchQuery.trim()) return [];
    return filteredLinks.filter((l) => l.favorite);
  }, [filteredLinks, selectedCategoryId, searchQuery]);

  useEffect(() => {
    if (!isLinkModalOpen) return;
    const raw = urlInput.trim();
    if (!raw || raw.length < 4 || !raw.includes('.')) {
      setPreviewData(null);
      return;
    }
    if (editingLink && raw === editingLink.url && previewData) {
      return;
    }

    const timer = window.setTimeout(async () => {
      setIsLoadingPreview(true);
      try {
        const meta = await fetchLinkPreview(raw);
        setPreviewData(meta);
        if (!editingLink) {
          setTitleInput((prev) => (prev.trim() ? prev : meta.title));
        }
      } finally {
        setIsLoadingPreview(false);
      }
    }, 520);

    return () => window.clearTimeout(timer);
  }, [urlInput, isLinkModalOpen]);

  const openAddLinkModal = () => {
    setEditingLink(null);
    setUrlInput('');
    setTitleInput('');
    setNotesInput('');
    const defaultCat =
      selectedCategoryId !== 'all' && selectedCategoryId !== 'favorites'
        ? selectedCategoryId
        : categories[0]?.id || '';
    setCategoryInput(defaultCat);
    setPreviewData(null);
    setIsLinkModalOpen(true);
  };

  const openEditLinkModal = (link: SavedLinkItem) => {
    setEditingLink(link);
    setUrlInput(link.url);
    setTitleInput(link.title);
    setNotesInput(link.notes);
    setCategoryInput(link.categoryId);
    setPreviewData({
      url: link.url,
      normalizedUrl: link.url,
      domain: link.domain,
      siteName: link.siteName,
      title: link.title,
      description: link.description,
      image: link.image,
      favicon: link.favicon,
      isInstagram: link.isInstagram,
      previewStatus: link.image ? 'ok' : 'fallback',
    });
    setIsLinkModalOpen(true);
  };

  const handleManualRefreshPreview = async () => {
    if (!urlInput.trim()) return;
    setIsLoadingPreview(true);
    try {
      const meta = await fetchLinkPreview(urlInput.trim());
      setPreviewData(meta);
      setTitleInput(meta.title);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleSaveLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim() || isSavingLink) return;
    setIsSavingLink(true);
    try {
      const meta = previewData || (await fetchLinkPreview(urlInput.trim()));
      const finalTitle = titleInput.trim() || meta.title;
      const targetCatId = categoryInput || categories[0]?.id || 'cat_inspiracoes';

      if (editingLink) {
        await updateLink(editingLink.id, {
          url: meta.url,
          title: finalTitle,
          description: meta.description,
          siteName: meta.siteName,
          domain: meta.domain,
          image: meta.image,
          favicon: meta.favicon,
          isInstagram: meta.isInstagram,
          notes: notesInput.trim(),
          categoryId: targetCatId,
        });
      } else {
        await addLink({
          url: meta.url,
          title: finalTitle,
          description: meta.description,
          siteName: meta.siteName,
          domain: meta.domain,
          image: meta.image,
          favicon: meta.favicon,
          isInstagram: meta.isInstagram,
          notes: notesInput.trim(),
          categoryId: targetCatId,
        });
      }
      setIsLinkModalOpen(false);
    } finally {
      setIsSavingLink(false);
    }
  };

  const handleCopyUrl = async (link: SavedLinkItem) => {
    try {
      await navigator.clipboard?.writeText(link.url);
      setCopiedId(link.id);
      window.setTimeout(() => {
        setCopiedId((prev) => (prev === link.id ? null : prev));
      }, 1800);
    } catch {
      // ignore
    }
  };

  const openCreateCategory = () => {
    setEditingCategory(null);
    setCatNameInput('');
    setCatEmojiInput('✨');
    setCatColorInput('emerald');
    setIsCategoryModalOpen(true);
  };

  const openEditCategory = (cat: SavedLinkCategory) => {
    setEditingCategory(cat);
    setCatNameInput(cat.name);
    setCatEmojiInput(cat.emoji);
    setCatColorInput(cat.color);
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catNameInput.trim()) return;
    if (editingCategory) {
      await updateCategory(editingCategory.id, {
        name: catNameInput.trim(),
        emoji: catEmojiInput || '🔗',
        color: catColorInput,
      });
    } else {
      const created = await createCategory({
        name: catNameInput.trim(),
        emoji: catEmojiInput || '🔗',
        color: catColorInput,
      });
      setCategoryInput(created.id);
    }
    setIsCategoryModalOpen(false);
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Search + Layout Toggle Row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isEs ? 'Buscar enlaces...' : 'Pesquisar links...'}
            className="w-full rounded-2xl border border-slate-200/90 bg-white py-2.5 pl-10 pr-8 text-xs font-bold text-slate-900 placeholder:text-slate-400 shadow-2xs outline-none focus:border-emerald-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-100 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Grid / List Switcher */}
        <div className="flex items-center rounded-2xl border border-slate-200 bg-white p-1 shadow-2xs shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`rounded-xl p-1.5 transition-colors cursor-pointer ${
              viewMode === 'grid'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-400 hover:text-slate-700'
            }`}
            aria-label="Visualização em grade"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`rounded-xl p-1.5 transition-colors cursor-pointer ${
              viewMode === 'list'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-400 hover:text-slate-700'
            }`}
            aria-label="Visualização em lista"
          >
            <ListIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={openAddLinkModal}
          className="inline-flex items-center gap-1 rounded-2xl bg-emerald-600 px-3 py-2.5 text-xs font-black text-white shadow-sm shadow-emerald-600/20 hover:bg-emerald-700 transition-colors cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4 stroke-[2.8]" />
          <span className="hidden sm:inline">{isEs ? 'Enlace' : 'Link'}</span>
        </button>
      </div>

      {/* Horizontal Category Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        <button
          type="button"
          onClick={() => setSelectedCategoryId('all')}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[11px] font-black whitespace-nowrap transition-all cursor-pointer shrink-0 ${
            selectedCategoryId === 'all'
              ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
              : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300'
          }`}
        >
          <span>Todos</span>
          <span
            className={`font-mono text-[10px] ${
              selectedCategoryId === 'all' ? 'text-emerald-100' : 'text-slate-400'
            }`}
          >
            {links.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedCategoryId('favorites')}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-black whitespace-nowrap transition-all cursor-pointer shrink-0 ${
            selectedCategoryId === 'favorites'
              ? 'border-rose-500 bg-rose-500 text-white shadow-xs'
              : 'border-slate-200 bg-white text-slate-700 hover:border-rose-300'
          }`}
        >
          <Heart
            className={`h-3 w-3 ${
              selectedCategoryId === 'favorites' ? 'fill-white' : 'text-rose-500'
            }`}
          />
          <span>Favoritos</span>
          <span
            className={`font-mono text-[10px] ${
              selectedCategoryId === 'favorites' ? 'text-rose-100' : 'text-slate-400'
            }`}
          >
            {favoritesCount}
          </span>
        </button>

        {categories.map((cat) => {
          const active = selectedCategoryId === cat.id;
          const count = linkCountByCategory[cat.id] || 0;
          return (
            <div
              key={cat.id}
              className={`inline-flex items-center rounded-full border transition-all shrink-0 ${
                active
                  ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300'
              }`}
            >
              <button
                type="button"
                onClick={() => setSelectedCategoryId(cat.id)}
                className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 text-[11px] font-black whitespace-nowrap cursor-pointer"
              >
                <span>{cat.emoji}</span>
                <span>{cat.name}</span>
                <span
                  className={`font-mono text-[10px] ${
                    active ? 'text-emerald-100' : 'text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </button>
              <button
                type="button"
                onClick={() => openEditCategory(cat)}
                className={`pr-2.5 pl-0.5 py-1.5 cursor-pointer ${
                  active ? 'text-emerald-100 hover:text-white' : 'text-slate-300 hover:text-emerald-600'
                }`}
                title={isEs ? 'Editar categoría' : 'Editar categoria'}
              >
                <Pencil className="h-2.5 w-2.5" />
              </button>
            </div>
          );
        })}

        <button
          type="button"
          onClick={openCreateCategory}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-emerald-300 bg-emerald-50/70 px-3 py-1.5 text-[11px] font-black text-emerald-800 hover:bg-emerald-100 transition-colors cursor-pointer shrink-0"
        >
          <FolderPlus className="h-3 w-3" />
          <span>{isEs ? 'Nueva' : 'Nova'}</span>
        </button>
      </div>

      {/* Favorites Highlight Section */}
      {favoriteLinksSection.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 px-1">
            <Heart className="h-3.5 w-3.5 fill-rose-500 text-rose-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              Favoritos
            </span>
          </div>
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 sm:grid-cols-2 gap-3'
                : 'flex flex-col gap-2.5'
            }
          >
            <AnimatePresence mode="popLayout">
              {favoriteLinksSection.slice(0, 4).map((lnk) => (
                <LinkVisualCard
                  key={`fav-${lnk.id}`}
                  link={lnk}
                  category={categoryMap[lnk.categoryId]}
                  viewMode={viewMode}
                  isEs={isEs}
                  reduceMotion={reduceMotion}
                  copiedId={copiedId}
                  onCopy={handleCopyUrl}
                  onToggleFavorite={(id) => void toggleFavoriteLink(id)}
                  onEdit={openEditLinkModal}
                  onDelete={(id) => void deleteLink(id)}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Main Collection Grid / List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            {selectedCategoryId === 'favorites'
              ? isEs
                ? 'Tus favoritos'
                : 'Seus favoritos'
              : selectedCategoryId === 'all'
              ? isEs
                ? 'Añadidos recientemente'
                : 'Adicionados recentemente'
              : `${categoryMap[selectedCategoryId]?.emoji || ''} ${
                  categoryMap[selectedCategoryId]?.name || ''
                }`}
          </span>
          <span className="font-mono text-[10px] font-bold text-slate-400">
            {filteredLinks.length}
          </span>
        </div>

        {filteredLinks.length === 0 ? (
          <div className="rounded-[1.75rem] border border-dashed border-emerald-200 bg-white p-8 text-center space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600">
              <Sparkles className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-black text-slate-900">
                {searchQuery.trim()
                  ? isEs
                    ? 'Ningún enlace coincide con tu búsqueda'
                    : 'Nenhum link encontrado nessa busca'
                  : isEs
                  ? 'Tu biblioteca visual de enlaces'
                  : 'Sua coleção pessoal de links'}
              </h3>
              <p className="mx-auto max-w-xs text-xs font-medium text-slate-500">
                {isEs
                  ? 'Guarda recetas, looks de Instagram, alquileres, herramientas e inspiraciones en tarjetas visuales.'
                  : 'Guarde receitas, inspirações do Instagram, aluguéis, roupas e ferramentas em cartões visuais organizados.'}
              </p>
            </div>
            <button
              type="button"
              onClick={openAddLinkModal}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white shadow-sm hover:bg-emerald-700 cursor-pointer"
            >
              <Plus className="h-4 w-4 stroke-[2.6]" />
              {isEs ? 'Guardar primer enlace' : 'Salvar primeiro link'}
            </button>
          </div>
        ) : (
          <motion.div
            layout={!reduceMotion}
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 sm:grid-cols-2 gap-3'
                : 'flex flex-col gap-2.5'
            }
          >
            <AnimatePresence mode="popLayout">
              {filteredLinks.map((lnk) => (
                <LinkVisualCard
                  key={lnk.id}
                  link={lnk}
                  category={categoryMap[lnk.categoryId]}
                  viewMode={viewMode}
                  isEs={isEs}
                  reduceMotion={reduceMotion}
                  copiedId={copiedId}
                  onCopy={handleCopyUrl}
                  onToggleFavorite={(id) => void toggleFavoriteLink(id)}
                  onEdit={openEditLinkModal}
                  onDelete={(id) => void deleteLink(id)}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Floating + Add Link Button */}
      <motion.button
        type="button"
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.92 }}
        onClick={openAddLinkModal}
        style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
        className="fixed right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-xl shadow-emerald-600/35 cursor-pointer"
        aria-label={isEs ? 'Agregar enlace' : 'Adicionar link'}
      >
        <Plus className="h-6 w-6 stroke-[2.8]" />
      </motion.button>

      {/* Undo Delete Toast */}
      <AnimatePresence>
        {deletedUndoItem && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            style={{ bottom: 'calc(5.2rem + env(safe-area-inset-bottom, 0px))' }}
            className="fixed left-4 right-4 sm:left-auto sm:right-5 z-[65] sm:w-80 flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-white px-4 py-3 shadow-xl"
          >
            <span className="truncate text-xs font-bold text-slate-700">
              {isEs ? 'Enlace eliminado' : 'Link removido'}
            </span>
            <button
              type="button"
              onClick={() => void undoDeleteLink()}
              className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-[11px] font-black text-white hover:bg-emerald-700 cursor-pointer shrink-0"
            >
              <Undo2 className="h-3.5 w-3.5" />
              {isEs ? 'Deshacer' : 'Desfazer'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add / Edit Link Modal */}
      <AnimatePresence>
        {isLinkModalOpen && (
          <div className="fixed inset-0 z-[78] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLinkModalOpen(false)}
              className="fixed inset-0 bg-emerald-950/15 backdrop-blur-[2px]"
            />
            <motion.form
              initial={{ opacity: 0, y: 32, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 28, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 360, damping: 28 }}
              onSubmit={handleSaveLinkSubmit}
              className="relative z-10 w-full max-w-md max-h-[88dvh] overflow-y-auto rounded-t-[2rem] sm:rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900">
                  {editingLink
                    ? isEs
                      ? 'Editar enlace'
                      : 'Editar link'
                    : isEs
                    ? 'Guardar nuevo enlace'
                    : 'Salvar novo link'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsLinkModalOpen(false)}
                  className="rounded-xl p-1 text-slate-400 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* URL Input */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  URL
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    required
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://instagram.com/... ou site.com"
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => void handleManualRefreshPreview()}
                    disabled={!urlInput.trim() || isLoadingPreview}
                    className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 cursor-pointer"
                    title={isEs ? 'Buscar vista previa' : 'Atualizar prévia'}
                  >
                    {isLoadingPreview ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Live Preview Card */}
              {(isLoadingPreview || previewData) && (
                <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-[#F8FBF9]">
                  {isLoadingPreview ? (
                    <div className="flex items-center gap-2.5 p-3.5 text-xs font-bold text-emerald-700">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>
                        {isEs
                          ? 'Obteniendo vista previa pública...'
                          : 'Buscando prévia pública do link...'}
                      </span>
                    </div>
                  ) : previewData ? (
                    <div className="flex items-center gap-3 p-2.5">
                      {previewData.image &&
                      !(
                        previewData.isInstagram &&
                        isGenericInstagramPlaceholderUrl(previewData.image)
                      ) ? (
                        <img
                          src={previewData.image}
                          alt={previewData.title}
                          referrerPolicy="no-referrer"
                          className="h-16 w-20 shrink-0 rounded-xl object-cover border border-white shadow-2xs"
                        />
                      ) : (
                        <div className="flex h-16 w-20 shrink-0 flex-col items-center justify-center rounded-xl bg-white border border-emerald-100">
                          {previewData.isInstagram ? (
                            <Instagram className="h-5 w-5 text-rose-500" />
                          ) : previewData.favicon ? (
                            <img
                              src={previewData.favicon}
                              alt=""
                              referrerPolicy="no-referrer"
                              className="h-6 w-6 rounded-md object-contain"
                            />
                          ) : (
                            <Globe className="h-5 w-5 text-emerald-600" />
                          )}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[10px] font-bold text-emerald-700">
                          {previewData.siteName || previewData.domain}
                        </div>
                        <div className="truncate text-xs font-black text-slate-900">
                          {titleInput || previewData.title}
                        </div>
                        {previewData.description && (
                          <div className="line-clamp-2 text-[10.5px] font-medium text-slate-500">
                            {previewData.description}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Editable Title */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Título
                </label>
                <input
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  placeholder={
                    previewData?.title ||
                    (isEs ? 'Se completa automáticamente' : 'Preenchido automaticamente')
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              {/* Category Selector */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    {isEs ? 'Categoría' : 'Categoria'}
                  </label>
                  <button
                    type="button"
                    onClick={openCreateCategory}
                    className="text-[10.5px] font-black text-emerald-700 hover:underline cursor-pointer"
                  >
                    + {isEs ? 'Nueva categoría' : 'Nova categoria'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((cat) => {
                    const selected = categoryInput === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategoryInput(cat.id)}
                        className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[11px] font-black transition-all cursor-pointer ${
                          selected
                            ? 'border-emerald-600 bg-emerald-600 text-white shadow-2xs'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300'
                        }`}
                      >
                        <span>{cat.emoji}</span>
                        <span>{cat.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Optional Personal Notes */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  {isEs ? 'Observaciones personales (opcional)' : 'Observações pessoais (opcional)'}
                </label>
                <textarea
                  rows={2}
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  placeholder={
                    isEs
                      ? 'Ej: Probar esta receta el domingo, apartamento con balcón...'
                      : 'Ex: Testar essa receita no domingo, apê perto do metrô...'
                  }
                  className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={!urlInput.trim() || isSavingLink}
                className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 py-3 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-emerald-600/20 hover:opacity-95 disabled:opacity-40 cursor-pointer"
              >
                {isSavingLink
                  ? isEs
                    ? 'Guardando...'
                    : 'Salvando...'
                  : editingLink
                  ? isEs
                    ? 'Guardar cambios'
                    : 'Salvar alterações'
                  : isEs
                  ? 'Guardar en Links'
                  : 'Salvar nos Links'}
              </button>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* Create / Edit Category Modal */}
      <AnimatePresence>
        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-[82] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCategoryModalOpen(false)}
              className="fixed inset-0 bg-emerald-950/15 backdrop-blur-[2px]"
            />
            <motion.form
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 28 }}
              onSubmit={handleSaveCategorySubmit}
              className="relative z-10 w-full max-w-sm rounded-t-[2rem] sm:rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900">
                  {editingCategory
                    ? isEs
                      ? 'Editar categoría'
                      : 'Editar categoria'
                    : isEs
                    ? 'Nueva categoría'
                    : 'Nova categoria'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="rounded-xl p-1 text-slate-400 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <input
                type="text"
                required
                value={catNameInput}
                onChange={(e) => setCatNameInput(e.target.value)}
                placeholder={isEs ? 'Nombre de la categoría...' : 'Nome da categoria...'}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white"
              />

              <div className="space-y-1.5">
                <span className="text-[10px] font-black uppercase text-slate-400">
                  {isEs ? 'Ícono' : 'Ícone'}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_EMOJIS.map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setCatEmojiInput(em)}
                      className={`flex h-9 w-9 items-center justify-center rounded-xl border text-base cursor-pointer ${
                        catEmojiInput === em
                          ? 'border-emerald-600 bg-emerald-50 scale-105'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-black uppercase text-slate-400">
                  {isEs ? 'Color' : 'Cor'}
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  {(Object.keys(CAT_COLORS) as LinkCategoryColor[]).map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setCatColorInput(col)}
                      className={`h-7 w-7 rounded-full ${CAT_COLORS[col].dot} cursor-pointer transition-transform ${
                        catColorInput === col ? 'ring-2 ring-offset-2 ring-slate-800 scale-110' : ''
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                {editingCategory && categories.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedCategoryId === editingCategory.id) setSelectedCategoryId('all');
                      void deleteCategory(editingCategory.id);
                      setIsCategoryModalOpen(false);
                    }}
                    className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-black text-rose-600 hover:bg-rose-100 cursor-pointer"
                  >
                    {isEs ? 'Eliminar' : 'Excluir'}
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-1 rounded-2xl bg-emerald-600 py-3 text-xs font-black uppercase tracking-wider text-white shadow-md hover:bg-emerald-700 cursor-pointer"
                >
                  {editingCategory
                    ? isEs
                      ? 'Guardar'
                      : 'Salvar'
                    : isEs
                    ? 'Crear categoría'
                    : 'Criar categoria'}
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
