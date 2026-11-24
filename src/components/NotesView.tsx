import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  ArrowLeft,
  StickyNote,
  Search,
  Plus,
  Pin,
  Folder,
  FolderPlus,
  Trash2,
  RotateCcw,
  Image as ImageIcon,
  CheckSquare,
  Check,
  X,
  Cloud,
  Loader2,
  BookOpen,
  Briefcase,
  Lightbulb,
  User,
  Rocket,
  Heart,
  FileText,
  Lock,
  Unlock,
  History,
  Share2,
  Copy,
  Download,
  Printer,
  Link2,
  Eye,
  Pencil,
  MoreHorizontal,
  Files,
  Tag,
  Sparkles,
} from 'lucide-react';
import { LanguageCode } from '../types';
import {
  NoteAccentColor,
  NoteBlock,
  NoteFolder,
  NoteFolderColor,
  NoteFolderIcon,
  NoteItem,
  NoteVersionSnapshot,
  countCharacters,
  countWords,
  createBlockId,
  htmlToPlainText,
  useNotes,
} from '../hooks/useNotes';
import {
  NOTE_TEMPLATES,
  NoteTemplateId,
  buildNoteFromTemplate,
} from '../utils/noteTemplates';
import { NoteDrawingModal } from './NoteDrawingModal';
import { NotePinModal } from './NotePinModal';
import { SmartNoteEditor } from './SmartNoteEditor';
import { SavedLinksLibrary } from './SavedLinksLibrary';

interface NotesViewProps {
  isOpen: boolean;
  onClose: () => void;
  language?: LanguageCode;
}

type NotesHomeTab = 'all_notes' | 'folders' | 'saved_links';
type NotesQuickFilter = 'all' | 'pinned' | 'favorites' | 'with_images' | 'trash';

const FOLDER_ICONS: Array<{ id: NoteFolderIcon; icon: React.ComponentType<{ className?: string }> }> =
  [
    { id: 'folder', icon: Folder },
    { id: 'book', icon: BookOpen },
    { id: 'briefcase', icon: Briefcase },
    { id: 'lightbulb', icon: Lightbulb },
    { id: 'user', icon: User },
    { id: 'rocket', icon: Rocket },
    { id: 'heart', icon: Heart },
  ];

const FOLDER_COLORS: Record<
  NoteFolderColor,
  { bg: string; text: string; border: string; dot: string; accentBar: string; softTint: string }
> = {
  emerald: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
    accentBar: 'from-emerald-500 to-teal-500',
    softTint: 'from-emerald-50/70 via-white to-white',
  },
  teal: {
    bg: 'bg-teal-50',
    text: 'text-teal-700',
    border: 'border-teal-200',
    dot: 'bg-teal-500',
    accentBar: 'from-teal-500 to-emerald-500',
    softTint: 'from-teal-50/70 via-white to-white',
  },
  sky: {
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
    dot: 'bg-sky-500',
    accentBar: 'from-sky-500 to-cyan-500',
    softTint: 'from-sky-50/70 via-white to-white',
  },
  amber: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
    accentBar: 'from-amber-400 to-orange-500',
    softTint: 'from-amber-50/70 via-white to-white',
  },
  violet: {
    bg: 'bg-violet-50',
    text: 'text-violet-700',
    border: 'border-violet-200',
    dot: 'bg-violet-500',
    accentBar: 'from-violet-500 to-purple-500',
    softTint: 'from-violet-50/70 via-white to-white',
  },
  rose: {
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
    accentBar: 'from-rose-500 to-pink-500',
    softTint: 'from-rose-50/70 via-white to-white',
  },
};

function renderFolderIcon(icon: NoteFolderIcon, className = 'h-4 w-4') {
  const found = FOLDER_ICONS.find((f) => f.id === icon);
  const Icon = found ? found.icon : Folder;
  return <Icon className={className} />;
}

function formatNoteDate(iso: string, isEs: boolean): string {
  try {
    const dt = new Date(iso);
    return dt.toLocaleDateString(isEs ? 'es-AR' : 'pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function buildMarkdownFromNote(note: NoteItem): string {
  const lines: string[] = [];
  lines.push(`# ${note.title || 'Nota sem título'}`);
  lines.push('');

  let numCounter = 0;
  for (const blk of note.blocks || []) {
    const text = htmlToPlainText(blk.html);
    if (!text) continue;
    if (blk.type === 'numbered') {
      numCounter += 1;
      lines.push(`${numCounter}. ${text}`);
    } else {
      numCounter = 0;
      if (blk.type === 'heading') lines.push(`# ${text}`);
      else if (blk.type === 'subheading') lines.push(`## ${text}`);
      else if (blk.type === 'heading3') lines.push(`### ${text}`);
      else if (blk.type === 'quote') lines.push(`> ${text}`);
      else if (blk.type === 'checklist') lines.push(`- [${blk.checked ? 'x' : ' '}] ${text}`);
      else if (blk.type === 'bullet') lines.push(`- ${text}`);
      else lines.push(text);
    }
  }
  lines.push('');

  if ((note.tables || []).length > 0) {
    for (const tbl of note.tables) {
      lines.push(`| ${tbl.headers.join(' | ')} |`);
      lines.push(`| ${tbl.headers.map(() => '---').join(' | ')} |`);
      for (const row of tbl.rows) {
        lines.push(`| ${row.join(' | ')} |`);
      }
      lines.push('');
    }
  }
  return lines.join('\n').trim();
}

export const NotesView: React.FC<NotesViewProps> = ({
  isOpen,
  onClose,
  language = 'pt',
}) => {
  const isEs = language === 'es';
  const reduceMotion = Boolean(useReducedMotion());

  const {
    notes,
    folders,
    saveState,
    hasPinConfigured,
    setNotePin,
    verifyNotePin,
    createNote,
    duplicateNote,
    updateNote,
    saveVersionSnapshot,
    restoreVersionSnapshot,
    togglePinNote,
    toggleFavoriteNote,
    toggleLockNote,
    softDeleteNote,
    restoreNote,
    permanentlyDeleteNote,
    emptyTrash,
    createFolder,
    deleteFolder,
    uploadNoteImage,
    uploadDrawingDataUrl,
    flushPendingSaves,
  } = useNotes();

  const [activeTab, setActiveTab] = useState<NotesHomeTab>('all_notes');
  const [quickFilter, setQuickFilter] = useState<NotesQuickFilter>('all');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [isReadingMode, setIsReadingMode] = useState(false);

  const [isInNoteSearchOpen, setIsInNoteSearchOpen] = useState(false);
  const [inNoteSearchQuery, setInNoteSearchQuery] = useState('');

  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);

  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderIcon, setNewFolderIcon] = useState<NoteFolderIcon>('lightbulb');
  const [newFolderColor, setNewFolderColor] = useState<NoteFolderColor>('emerald');

  const [isEditorMenuOpen, setIsEditorMenuOpen] = useState(false);
  const [isTagsPopoverOpen, setIsTagsPopoverOpen] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<NoteVersionSnapshot | null>(null);
  const [contextMenuNoteId, setContextMenuNoteId] = useState<string | null>(null);

  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isDrawingOpen, setIsDrawingOpen] = useState(false);
  const [pinModalState, setPinModalState] = useState<{
    open: boolean;
    mode: 'create' | 'unlock';
    targetNoteId: string | null;
    action: 'open' | 'lock';
  }>({ open: false, mode: 'unlock', targetNoteId: null, action: 'open' });
  const [unlockedIds, setUnlockedIds] = useState<Record<string, boolean>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isDictating, setIsDictating] = useState(false);

  // Accurate iOS visualViewport tracking (height + offsetTop) so the home screen NEVER leaks through
  const [vvBox, setVvBox] = useState<{ top: number; height: number; keyboardOpen: boolean } | null>(
    null
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const activeNote: NoteItem | null = useMemo(
    () => notes.find((n) => n.id === activeNoteId) || null,
    [notes, activeNoteId]
  );

  const showToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 2000);
  };

  const stopDictation = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    setIsDictating(false);
  };

  // Definitive iOS Safari keyboard & viewport lock: tracks BOTH offsetTop and height
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;
    const vv = window.visualViewport;
    if (!vv) return;

    const syncViewport = () => {
      const h = Math.round(vv.height);
      const top = Math.max(0, Math.round(vv.offsetTop));
      const keyboardOpen = window.innerHeight - h > 110;
      setVvBox({ top, height: h, keyboardOpen });
    };

    syncViewport();
    vv.addEventListener('resize', syncViewport);
    vv.addEventListener('scroll', syncViewport);
    window.addEventListener('orientationchange', syncViewport);
    return () => {
      vv.removeEventListener('resize', syncViewport);
      vv.removeEventListener('scroll', syncViewport);
      window.removeEventListener('orientationchange', syncViewport);
      setVvBox(null);
    };
  }, [isOpen]);

  // Strict iOS body scroll lock while NotesView is open (prevents underlying dashboard bleed/scroll)
  useEffect(() => {
    if (!isOpen) {
      stopDictation();
      void flushPendingSaves();
      setActiveNoteId(null);
      setIsReadingMode(false);
      setIsInNoteSearchOpen(false);
      setInNoteSearchQuery('');
      setPreviewImageUrl(null);
      setIsHistoryOpen(false);
      setPreviewVersion(null);
      setIsEditorMenuOpen(false);
      setIsTagsPopoverOpen(false);
      setIsTemplatePickerOpen(false);
      setContextMenuNoteId(null);
      setUnlockedIds({});
      return;
    }

    const body = document.body;
    const html = document.documentElement;
    const scrollY = window.scrollY;
    const prev = {
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
      bodyOverflow: body.style.overflow,
      htmlOverflow: html.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
    };

    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';

    return () => {
      body.style.position = prev.bodyPosition;
      body.style.top = prev.bodyTop;
      body.style.left = prev.bodyLeft;
      body.style.right = prev.bodyRight;
      body.style.width = prev.bodyWidth;
      body.style.overflow = prev.bodyOverflow;
      html.style.overflow = prev.htmlOverflow;
      html.style.overscrollBehavior = prev.htmlOverscroll;
      window.scrollTo(0, scrollY);
    };
  }, [isOpen, flushPendingSaves]);

  // Periodic smart version snapshot while editing
  useEffect(() => {
    if (!activeNoteId || isReadingMode) return;
    const timer = window.setInterval(() => {
      saveVersionSnapshot(activeNoteId, 90_000);
    }, 90_000);
    return () => window.clearInterval(timer);
  }, [activeNoteId, isReadingMode, saveVersionSnapshot]);

  const activeNotes = useMemo(() => notes.filter((n) => !n.deletedAt), [notes]);
  const trashedNotes = useMemo(() => notes.filter((n) => Boolean(n.deletedAt)), [notes]);
  const pinnedCount = useMemo(() => activeNotes.filter((n) => n.pinned).length, [activeNotes]);
  const favoritesCount = useMemo(() => activeNotes.filter((n) => n.favorite).length, [activeNotes]);
  const withImagesCount = useMemo(
    () => activeNotes.filter((n) => (n.images || []).length > 0).length,
    [activeNotes]
  );

  const folderNameMap = useMemo(() => {
    const map: Record<string, NoteFolder> = {};
    folders.forEach((f) => {
      map[f.id] = f;
    });
    return map;
  }, [folders]);

  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let base =
      selectedFolderId !== null
        ? activeNotes.filter((n) => n.folderId === selectedFolderId)
        : quickFilter === 'trash'
        ? trashedNotes
        : quickFilter === 'pinned'
        ? activeNotes.filter((n) => n.pinned)
        : quickFilter === 'favorites'
        ? activeNotes.filter((n) => n.favorite)
        : quickFilter === 'with_images'
        ? activeNotes.filter((n) => (n.images || []).length > 0)
        : activeNotes;

    if (q) {
      base = base.filter((n) => {
        const folderName = n.folderId ? folderNameMap[n.folderId]?.name || '' : '';
        const tagsStr = (n.tags || []).join(' ');
        if (n.locked && !unlockedIds[n.id]) {
          return `${n.title} ${folderName} ${tagsStr}`.toLowerCase().includes(q);
        }
        const haystack = `${n.title} ${n.plainText} ${folderName} ${tagsStr}`.toLowerCase();
        return haystack.includes(q);
      });
    }

    return [...base].sort((a, b) => {
      if (quickFilter !== 'trash' && a.pinned !== b.pinned) {
        return a.pinned ? -1 : 1;
      }
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }, [
    activeNotes,
    trashedNotes,
    quickFilter,
    selectedFolderId,
    searchQuery,
    folderNameMap,
    unlockedIds,
  ]);

  const inNoteMatchCount = useMemo(() => {
    const q = inNoteSearchQuery.trim().toLowerCase();
    if (!q || !activeNote) return 0;
    return (activeNote.blocks || []).filter((b) =>
      htmlToPlainText(b.html).toLowerCase().includes(q)
    ).length;
  }, [inNoteSearchQuery, activeNote]);

  const handleOpenNoteCard = (note: NoteItem) => {
    setContextMenuNoteId(null);
    if (note.locked && !unlockedIds[note.id]) {
      setPinModalState({
        open: true,
        mode: hasPinConfigured ? 'unlock' : 'create',
        targetNoteId: note.id,
        action: 'open',
      });
      return;
    }
    setIsReadingMode(false);
    setIsInNoteSearchOpen(false);
    setInNoteSearchQuery('');
    setActiveNoteId(note.id);
  };

  const handleRequestToggleLock = () => {
    if (!activeNote) return;
    setIsEditorMenuOpen(false);
    if (activeNote.locked) {
      toggleLockNote(activeNote.id, false);
      showToast(isEs ? 'Bloqueo quitado' : 'Bloqueio removido');
      return;
    }
    if (!hasPinConfigured) {
      setPinModalState({
        open: true,
        mode: 'create',
        targetNoteId: activeNote.id,
        action: 'lock',
      });
    } else {
      toggleLockNote(activeNote.id, true);
      setUnlockedIds((prev) => ({ ...prev, [activeNote.id]: true }));
      showToast(isEs ? 'Nota protegida con PIN' : 'Nota protegida com PIN');
    }
  };

  const handlePinSubmit = async (pin: string): Promise<boolean> => {
    const targetId = pinModalState.targetNoteId;
    if (!targetId) return false;

    if (pinModalState.mode === 'create') {
      await setNotePin(pin);
      if (pinModalState.action === 'lock') {
        toggleLockNote(targetId, true);
        setUnlockedIds((prev) => ({ ...prev, [targetId]: true }));
      } else {
        setUnlockedIds((prev) => ({ ...prev, [targetId]: true }));
        setActiveNoteId(targetId);
      }
      return true;
    }

    const ok = await verifyNotePin(pin);
    if (!ok) return false;
    setUnlockedIds((prev) => ({ ...prev, [targetId]: true }));
    if (pinModalState.action === 'open') {
      setActiveNoteId(targetId);
    }
    return true;
  };

  const handleCreateFromTemplate = async (templateId: NoteTemplateId) => {
    setIsTemplatePickerOpen(false);
    const tpl = buildNoteFromTemplate(templateId, language);
    const created = await createNote(selectedFolderId, {
      title: tpl.title,
      blocks: tpl.blocks,
      tables: tpl.tables,
      tags: tpl.tags,
      accentColor: tpl.accentColor,
    });
    setIsReadingMode(false);
    setActiveNoteId(created.id);
  };

  const handleDuplicate = async (noteId: string) => {
    setContextMenuNoteId(null);
    setIsEditorMenuOpen(false);
    const copy = await duplicateNote(noteId);
    if (copy) {
      showToast(isEs ? 'Nota duplicada' : 'Nota duplicada');
    }
  };

  const handleCloseEditor = async () => {
    stopDictation();
    if (activeNote) {
      saveVersionSnapshot(activeNote.id, 30_000);
    }
    await flushPendingSaves();
    setIsReadingMode(false);
    setIsInNoteSearchOpen(false);
    setInNoteSearchQuery('');
    setIsHistoryOpen(false);
    setPreviewVersion(null);
    setIsEditorMenuOpen(false);
    setIsTagsPopoverOpen(false);
    setActiveNoteId(null);
  };

  const handleToggleDictation = () => {
    if (!activeNote) return;
    if (isDictating) {
      stopDictation();
      return;
    }

    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) return;

    try {
      const rec = new SpeechRec();
      rec.lang = isEs ? 'es-AR' : 'pt-BR';
      rec.continuous = true;
      rec.interimResults = false;
      rec.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + ' ';
          }
        }
        if (finalTranscript.trim() && activeNote) {
          const currentBlocks = activeNote.blocks || [];
          const last = currentBlocks[currentBlocks.length - 1];
          let nextBlocks: NoteBlock[];
          if (last && last.type === 'paragraph') {
            const sep = last.html ? ' ' : '';
            nextBlocks = currentBlocks.map((b, i) =>
              i === currentBlocks.length - 1
                ? { ...b, html: `${b.html}${sep}${finalTranscript.trim()}` }
                : b
            );
          } else {
            nextBlocks = [
              ...currentBlocks,
              { id: createBlockId(), type: 'paragraph', html: finalTranscript.trim() },
            ];
          }
          updateNote(activeNote.id, { blocks: nextBlocks }, true);
        }
      };
      rec.onerror = () => stopDictation();
      rec.onend = () => setIsDictating(false);
      recognitionRef.current = rec;
      rec.start();
      setIsDictating(true);
    } catch {
      stopDictation();
    }
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeNote) return;
    const clean = tagInput.trim().slice(0, 24);
    if (!clean) return;
    const current = activeNote.tags || [];
    if (!current.some((t) => t.toLowerCase() === clean.toLowerCase())) {
      updateNote(activeNote.id, { tags: [...current, clean] }, true);
    }
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (!activeNote) return;
    updateNote(
      activeNote.id,
      { tags: (activeNote.tags || []).filter((t) => t !== tagToRemove) },
      true
    );
  };

  const handleAddTable = () => {
    if (!activeNote) return;
    const newTable = {
      id: `ntbl_${Date.now()}`,
      headers: [isEs ? 'Columna 1' : 'Coluna 1', isEs ? 'Columna 2' : 'Coluna 2'],
      rows: [
        ['', ''],
        ['', ''],
      ],
    };
    updateNote(activeNote.id, { tables: [...(activeNote.tables || []), newTable] }, true);
  };

  const handleUpdateTableHeader = (tableId: string, colIdx: number, val: string) => {
    if (!activeNote) return;
    const next = (activeNote.tables || []).map((tbl) => {
      if (tbl.id !== tableId) return tbl;
      const headers = tbl.headers.map((h, i) => (i === colIdx ? val : h));
      return { ...tbl, headers };
    });
    updateNote(activeNote.id, { tables: next });
  };

  const handleUpdateTableCell = (tableId: string, rowIdx: number, colIdx: number, val: string) => {
    if (!activeNote) return;
    const next = (activeNote.tables || []).map((tbl) => {
      if (tbl.id !== tableId) return tbl;
      const rows = tbl.rows.map((r, ri) =>
        ri === rowIdx ? r.map((c, ci) => (ci === colIdx ? val : c)) : r
      );
      return { ...tbl, rows };
    });
    updateNote(activeNote.id, { tables: next });
  };

  const handleAddTableRow = (tableId: string) => {
    if (!activeNote) return;
    const next = (activeNote.tables || []).map((tbl) => {
      if (tbl.id !== tableId) return tbl;
      return { ...tbl, rows: [...tbl.rows, tbl.headers.map(() => '')] };
    });
    updateNote(activeNote.id, { tables: next }, true);
  };

  const handleAddTableCol = (tableId: string) => {
    if (!activeNote) return;
    const next = (activeNote.tables || []).map((tbl) => {
      if (tbl.id !== tableId || tbl.headers.length >= 5) return tbl;
      return {
        ...tbl,
        headers: [...tbl.headers, `Col ${tbl.headers.length + 1}`],
        rows: tbl.rows.map((r) => [...r, '']),
      };
    });
    updateNote(activeNote.id, { tables: next }, true);
  };

  const handleDeleteTable = (tableId: string) => {
    if (!activeNote) return;
    updateNote(
      activeNote.id,
      { tables: (activeNote.tables || []).filter((t) => t.id !== tableId) },
      true
    );
  };

  const handleImageFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
    kind: 'photo' | 'scan'
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !activeNote) return;
    setIsUploadingImage(true);
    try {
      const attachment = await uploadNoteImage(activeNote.id, file, kind);
      updateNote(
        activeNote.id,
        { images: [...(activeNote.images || []), attachment] },
        true
      );
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSaveDrawing = async (dataUrl: string) => {
    if (!activeNote) return;
    setIsUploadingImage(true);
    try {
      const attachment = await uploadDrawingDataUrl(activeNote.id, dataUrl);
      updateNote(
        activeNote.id,
        { images: [...(activeNote.images || []), attachment] },
        true
      );
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleRemoveImage = (imageId: string) => {
    if (!activeNote) return;
    updateNote(
      activeNote.id,
      { images: (activeNote.images || []).filter((img) => img.id !== imageId) },
      true
    );
  };

  const handleCopyNoteText = async () => {
    if (!activeNote) return;
    const text = buildMarkdownFromNote(activeNote);
    try {
      await navigator.clipboard?.writeText(text);
      showToast(isEs ? 'Texto copiado' : 'Texto copiado');
    } catch {
      // ignore
    }
    setIsEditorMenuOpen(false);
  };

  const handleShareNote = async () => {
    if (!activeNote) return;
    const text = buildMarkdownFromNote(activeNote);
    setIsEditorMenuOpen(false);
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: activeNote.title || 'Nota SisFinz',
          text,
        });
        return;
      } catch {
        // ignore cancel
      }
    }
    await handleCopyNoteText();
  };

  const handleDownloadNote = (ext: 'md' | 'txt') => {
    if (!activeNote) return;
    const content = buildMarkdownFromNote(activeNote);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeTitle = (activeNote.title || 'nota-sisfinz')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 40);
    a.href = url;
    a.download = `${safeTitle || 'nota-sisfinz'}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setIsEditorMenuOpen(false);
  };

  const handlePrintNotePdf = () => {
    if (!activeNote) return;
    setIsEditorMenuOpen(false);
    const win = window.open('', '_blank', 'width=820,height=920');
    if (!win) return;
    const blocksHtml = (activeNote.blocks || [])
      .map((b) => {
        const align = b.align ? ` style="text-align:${b.align}"` : '';
        if (b.type === 'heading') return `<h1${align}>${b.html}</h1>`;
        if (b.type === 'subheading') return `<h2${align}>${b.html}</h2>`;
        if (b.type === 'heading3') return `<h3${align}>${b.html}</h3>`;
        if (b.type === 'quote') return `<blockquote${align}>${b.html}</blockquote>`;
        if (b.type === 'checklist') return `<p${align}>${b.checked ? '☑' : '☐'} ${b.html}</p>`;
        if (b.type === 'bullet') return `<p${align}>• ${b.html}</p>`;
        if (b.type === 'numbered') return `<p${align}>- ${b.html}</p>`;
        return `<p${align}>${b.html}</p>`;
      })
      .join('');
    const tablesHtml = (activeNote.tables || [])
      .map(
        (tbl) =>
          `<table><thead><tr>${tbl.headers
            .map((h) => `<th>${h}</th>`)
            .join('')}</tr></thead><tbody>${tbl.rows
            .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`)
            .join('')}</tbody></table>`
      )
      .join('');
    const imagesHtml =
      (activeNote.images || []).length > 0
        ? `<div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:16px;">${activeNote.images
            .map(
              (img) =>
                `<img src="${img.url}" style="max-width:260px;border-radius:10px;border:1px solid #e2e8f0;" />`
            )
            .join('')}</div>`
        : '';
    win.document.write(`
      <html>
        <head>
          <title>${activeNote.title || 'Nota SisFinz'}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 36px; color: #0f172a; line-height: 1.65; max-width: 740px; margin: 0 auto; }
            h1.doc-title { color: #064e3b; margin-bottom: 4px; font-size: 26px; }
            .meta { color: #64748b; font-size: 12px; margin-bottom: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; }
            blockquote { border-left: 3px solid #10b981; padding-left: 12px; color: #475569; font-style: italic; margin: 12px 0; }
            table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
            th { background: #ecfdf5; color: #064e3b; }
          </style>
        </head>
        <body>
          <h1 class="doc-title">${activeNote.title || 'Nota sem título'}</h1>
          <div class="meta">SisFinz Notas • ${formatNoteDate(activeNote.updatedAt, isEs)}</div>
          <div>${blocksHtml}</div>
          ${tablesHtml}
          ${imagesHtml}
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    window.setTimeout(() => win.print(), 250);
  };

  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    const created = await createFolder({
      name: newFolderName.trim(),
      icon: newFolderIcon,
      color: newFolderColor,
    });
    setNewFolderName('');
    setIsFolderModalOpen(false);
    setSelectedFolderId(created.id);
    setActiveTab('all_notes');
  };

  if (typeof document === 'undefined') return null;

  const fullTextForStats = activeNote
    ? `${activeNote.title} ${activeNote.plainText}`.trim()
    : '';
  const activeWordCount = countWords(fullTextForStats);
  const activeCharCount = countCharacters(fullTextForStats);

  const activeAccentStyle =
    activeNote && activeNote.accentColor && activeNote.accentColor !== 'none'
      ? FOLDER_COLORS[activeNote.accentColor]
      : null;

  const containerStyle: React.CSSProperties =
    vvBox && vvBox.keyboardOpen
      ? { top: `${vvBox.top}px`, height: `${vvBox.height}px`, bottom: 'auto' }
      : { top: 0, bottom: 0, height: '100dvh' };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Permanent Solid Opaque Shield — guarantees the home screen NEVER peeks through on iOS keyboard transitions */}
          <div
            key="sisfinz-notes-opaque-shield"
            className="fixed inset-0 z-[57] bg-[#F4F9F6]"
            aria-hidden="true"
          />

          <motion.div
            key="sisfinz-notes-root"
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: 12 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            style={containerStyle}
            className="fixed inset-x-0 z-[58] flex flex-col w-full max-w-full bg-[#F4F9F6] text-slate-900 overflow-hidden"
          >
            <AnimatePresence mode="wait" initial={false}>
              {!activeNote ? (
                /* REDESIGNED MODERN NOTES 2.0 HOME */
                <motion.div
                  key="notes-home"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.16 }}
                  className="flex h-full w-full max-w-full flex-col overflow-hidden"
                >
                  {/* Editorial Ambient Emerald-White Header */}
                  <div
                    className="relative overflow-hidden border-b border-emerald-100/90 bg-gradient-to-b from-white via-white to-[#F7FBF9] px-4 pb-3.5 shrink-0 space-y-3.5"
                    style={{ paddingTop: 'max(0.85rem, env(safe-area-inset-top, 0px))' }}
                  >
                    {/* Subtle Decorative Ambient Glow */}
                    <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-emerald-200/35 blur-3xl" />

                    <div className="relative z-10 mx-auto flex max-w-2xl items-center justify-between gap-2">
                      <motion.button
                        whileTap={{ scale: 0.94 }}
                        type="button"
                        onClick={onClose}
                        className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200/80 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-2xs hover:border-emerald-300 hover:text-emerald-800 transition-all cursor-pointer shrink-0 touch-manipulation"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        <span>{isEs ? 'Volver' : 'Voltar'}</span>
                      </motion.button>

                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/25">
                          <StickyNote className="h-4.5 w-4.5" />
                        </div>
                        <div className="min-w-0">
                          <h1 className="truncate text-[15px] font-black tracking-tight text-slate-900">
                            Notas SisFinz
                          </h1>
                          <p className="truncate text-[10px] font-bold text-emerald-700">
                            {activeTab === 'saved_links'
                              ? isEs
                                ? 'Colección visual de enlaces'
                                : 'Coleção visual de links'
                              : activeTab === 'folders'
                              ? `${folders.length} ${folders.length === 1 ? 'pasta' : 'pastas'}`
                              : `${activeNotes.length} ${activeNotes.length === 1 ? 'nota' : 'notas'}${
                                  favoritesCount > 0 ? ` • ${favoritesCount} ★` : ''
                                }`}
                          </p>
                        </div>
                      </div>

                      {activeTab === 'folders' ? (
                        <motion.button
                          whileTap={{ scale: 0.94 }}
                          type="button"
                          onClick={() => setIsFolderModalOpen(true)}
                          className="inline-flex items-center gap-1 rounded-2xl bg-emerald-600 px-3 py-2 text-[11px] font-black text-white shadow-sm shadow-emerald-600/20 hover:bg-emerald-700 cursor-pointer shrink-0 touch-manipulation"
                        >
                          <FolderPlus className="h-3.5 w-3.5" />
                          <span>{isEs ? 'Nueva' : 'Nova'}</span>
                        </motion.button>
                      ) : activeTab === 'all_notes' ? (
                        <motion.button
                          whileTap={{ scale: 0.94 }}
                          type="button"
                          onClick={() => setIsTemplatePickerOpen(true)}
                          className="inline-flex items-center gap-1 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 px-3 py-2 text-[11px] font-black text-white shadow-sm shadow-emerald-600/25 hover:opacity-95 cursor-pointer shrink-0 touch-manipulation"
                        >
                          <Plus className="h-3.5 w-3.5 stroke-[2.8]" />
                          <span>{isEs ? 'Nueva' : 'Nova'}</span>
                        </motion.button>
                      ) : (
                        <div className="w-16 shrink-0" />
                      )}
                    </div>

                    {/* Sleek 3-Area Animated Segmented Control */}
                    <div className="relative z-10 mx-auto max-w-2xl">
                      <div className="grid grid-cols-3 gap-1 rounded-2xl border border-emerald-100/90 bg-[#EDF5F1] p-1">
                        {(
                          [
                            {
                              id: 'all_notes',
                              label: isEs ? 'Todas' : 'Notas',
                              icon: FileText,
                            },
                            {
                              id: 'folders',
                              label: isEs ? 'Carpetas' : 'Pastas',
                              icon: Folder,
                            },
                            {
                              id: 'saved_links',
                              label: isEs ? 'Links salvos' : 'Links salvos',
                              icon: Link2,
                            },
                          ] as const
                        ).map((tab) => {
                          const Icon = tab.icon;
                          const isActive = activeTab === tab.id;
                          return (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => {
                                setActiveTab(tab.id);
                                if (tab.id === 'all_notes') setSelectedFolderId(null);
                              }}
                              className={`relative isolate flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 text-xs font-black transition-colors cursor-pointer touch-manipulation ${
                                isActive
                                  ? 'text-emerald-950'
                                  : 'text-slate-500 hover:text-emerald-800'
                              }`}
                            >
                              {isActive && (
                                <motion.span
                                  layoutId="notes-home-tab-pill"
                                  transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                                  className="absolute inset-0 -z-10 rounded-xl bg-white border border-emerald-200/70 shadow-sm"
                                />
                              )}
                              <Icon
                                className={`h-3.5 w-3.5 shrink-0 ${
                                  isActive ? 'text-emerald-600' : 'text-slate-400'
                                }`}
                              />
                              <span className="truncate">{tab.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Scrollable Body */}
                  <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-4">
                    <div className="mx-auto max-w-2xl w-full min-w-0">
                      <AnimatePresence mode="wait" initial={false}>
                        {activeTab === 'saved_links' ? (
                          <motion.div
                            key="area-saved-links"
                            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
                            transition={{ duration: 0.18 }}
                          >
                            <SavedLinksLibrary language={language} />
                          </motion.div>
                        ) : activeTab === 'folders' ? (
                          <motion.div
                            key="area-folders"
                            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
                            transition={{ duration: 0.18 }}
                            className="space-y-5 pb-24"
                          >
                            {/* Bento Smart Folders */}
                            <div className="space-y-2.5">
                              <span className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                {isEs ? 'Colecciones inteligentes' : 'Coleções inteligentes'}
                              </span>
                              <div className="grid grid-cols-2 gap-3">
                                {(
                                  [
                                    {
                                      id: 'all',
                                      label: isEs ? 'Todas las notas' : 'Todas as notas',
                                      count: activeNotes.length,
                                      icon: FileText,
                                      cardBg: 'from-emerald-50/80 via-white to-white',
                                      iconBg: 'bg-emerald-600 text-white shadow-emerald-600/25',
                                    },
                                    {
                                      id: 'favorites',
                                      label: isEs ? 'Favoritas' : 'Favoritas',
                                      count: favoritesCount,
                                      icon: Heart,
                                      cardBg: 'from-rose-50/80 via-white to-white',
                                      iconBg: 'bg-rose-500 text-white shadow-rose-500/25',
                                    },
                                    {
                                      id: 'pinned',
                                      label: isEs ? 'Fijadas' : 'Fixadas',
                                      count: pinnedCount,
                                      icon: Pin,
                                      cardBg: 'from-amber-50/80 via-white to-white',
                                      iconBg: 'bg-amber-500 text-white shadow-amber-500/25',
                                    },
                                    {
                                      id: 'trash',
                                      label: isEs ? 'Papelera' : 'Lixeira',
                                      count: trashedNotes.length,
                                      icon: Trash2,
                                      cardBg: 'from-slate-100/80 via-white to-white',
                                      iconBg: 'bg-slate-600 text-white shadow-slate-600/20',
                                    },
                                  ] as const
                                ).map((sys) => {
                                  const Icon = sys.icon;
                                  return (
                                    <motion.button
                                      key={sys.id}
                                      type="button"
                                      whileHover={{ y: -2 }}
                                      whileTap={{ scale: 0.97 }}
                                      onClick={() => {
                                        setSelectedFolderId(null);
                                        setQuickFilter(sys.id);
                                        setActiveTab('all_notes');
                                      }}
                                      className={`flex flex-col justify-between gap-4 rounded-[1.5rem] border border-emerald-100/90 bg-gradient-to-br ${sys.cardBg} p-4 text-left shadow-[0_6px_20px_rgba(15,23,42,0.04)] hover:border-emerald-300 transition-all cursor-pointer touch-manipulation`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <span
                                          className={`flex h-10 w-10 items-center justify-center rounded-2xl shadow-md ${sys.iconBg}`}
                                        >
                                          <Icon className="h-4.5 w-4.5" />
                                        </span>
                                        <span className="font-mono text-xl font-black text-slate-900">
                                          {sys.count}
                                        </span>
                                      </div>
                                      <span className="text-xs font-black text-slate-800">
                                        {sys.label}
                                      </span>
                                    </motion.button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Custom Folders */}
                            <div className="space-y-2.5">
                              <div className="flex items-center justify-between px-1">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                  {isEs ? 'Mis carpetas' : 'Minhas pastas'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setIsFolderModalOpen(true)}
                                  className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-700 hover:underline cursor-pointer touch-manipulation"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                  {isEs ? 'Crear carpeta' : 'Criar pasta'}
                                </button>
                              </div>

                              {folders.length === 0 ? (
                                <div className="rounded-[1.75rem] border border-dashed border-emerald-200 bg-white p-8 text-center space-y-2.5">
                                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                                    <FolderPlus className="h-6 w-6" />
                                  </div>
                                  <p className="text-xs font-bold text-slate-600">
                                    {isEs
                                      ? 'Organiza tus notas en carpetas como Estudios, Trabajo o Proyectos.'
                                      : 'Organize suas notas em pastas como Estudos, Trabalho, Receitas ou Projetos.'}
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => setIsFolderModalOpen(true)}
                                    className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white shadow-sm hover:bg-emerald-700 cursor-pointer touch-manipulation"
                                  >
                                    <FolderPlus className="h-3.5 w-3.5" />
                                    {isEs ? 'Nueva carpeta' : 'Nova pasta'}
                                  </button>
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                  {folders.map((fld) => {
                                    const palette = FOLDER_COLORS[fld.color] || FOLDER_COLORS.emerald;
                                    const count = activeNotes.filter(
                                      (n) => n.folderId === fld.id
                                    ).length;
                                    return (
                                      <motion.div
                                        key={fld.id}
                                        whileHover={{ y: -1 }}
                                        className={`flex items-center justify-between gap-2 rounded-2xl border border-emerald-100/90 bg-gradient-to-r ${palette.softTint} p-3.5 shadow-2xs hover:border-emerald-300 transition-all`}
                                      >
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedFolderId(fld.id);
                                            setQuickFilter('all');
                                            setActiveTab('all_notes');
                                          }}
                                          className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer touch-manipulation"
                                        >
                                          <span
                                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${palette.bg} ${palette.text} ${palette.border}`}
                                          >
                                            {renderFolderIcon(fld.icon, 'h-4 w-4')}
                                          </span>
                                          <div className="min-w-0">
                                            <div className="truncate text-sm font-black text-slate-900">
                                              {fld.name}
                                            </div>
                                            <div className="text-[10.5px] font-bold text-slate-400">
                                              {count} {count === 1 ? 'nota' : 'notas'}
                                            </div>
                                          </div>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => void deleteFolder(fld.id)}
                                          className="rounded-xl p-2 text-slate-300 hover:bg-rose-50 hover:text-rose-500 cursor-pointer touch-manipulation"
                                          aria-label="Excluir pasta"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </button>
                                      </motion.div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        ) : (
                          /* AREA 1: MODERN VISUAL NOTES LIBRARY */
                          <motion.div
                            key="area-all-notes"
                            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
                            transition={{ duration: 0.18 }}
                            className="space-y-4 pb-24"
                          >
                            {/* Search Bar */}
                            <div className="relative">
                              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600/70" />
                              <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={
                                  isEs
                                    ? 'Buscar por título, texto, etiqueta o carpeta...'
                                    : 'Buscar por título, texto, etiqueta ou pasta...'
                                }
                                className="w-full rounded-2xl border border-emerald-100 bg-white py-3 pl-10 pr-9 text-[16px] sm:text-xs font-semibold text-slate-900 placeholder:text-slate-400 shadow-[0_4px_16px_rgba(6,78,59,0.04)] outline-none focus:border-emerald-500"
                              />
                              {searchQuery && (
                                <button
                                  type="button"
                                  onClick={() => setSearchQuery('')}
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-100 cursor-pointer"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              )}
                            </div>

                            {/* Quick Creative Start Strip (1-tap templates!) */}
                            {!searchQuery && quickFilter === 'all' && !selectedFolderId && (
                              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
                                {NOTE_TEMPLATES.map((tpl) => (
                                  <motion.button
                                    key={tpl.id}
                                    whileTap={{ scale: 0.95 }}
                                    type="button"
                                    onClick={() => void handleCreateFromTemplate(tpl.id)}
                                    className="inline-flex items-center gap-1.5 rounded-2xl border border-emerald-100/90 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 shadow-2xs hover:border-emerald-300 hover:bg-emerald-50/50 transition-all cursor-pointer shrink-0 touch-manipulation"
                                  >
                                    <span className="text-sm leading-none">{tpl.emoji}</span>
                                    <span className="whitespace-nowrap">
                                      {isEs ? tpl.labelEs : tpl.labelPt}
                                    </span>
                                  </motion.button>
                                ))}
                              </div>
                            )}

                            {/* Active Folder Banner or Quick Filter Pills */}
                            {selectedFolderId ? (
                              <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50/80 px-3.5 py-2.5">
                                <div className="flex items-center gap-2 text-xs font-black text-emerald-900">
                                  {renderFolderIcon(
                                    folderNameMap[selectedFolderId]?.icon || 'folder',
                                    'h-4 w-4 text-emerald-600'
                                  )}
                                  <span>{folderNameMap[selectedFolderId]?.name || 'Pasta'}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setSelectedFolderId(null)}
                                  className="inline-flex items-center gap-1 rounded-xl bg-white px-2.5 py-1 text-[10.5px] font-black text-emerald-800 shadow-2xs cursor-pointer touch-manipulation"
                                >
                                  <X className="h-3 w-3" />
                                  {isEs ? 'Ver todas' : 'Ver todas'}
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                                {(
                                  [
                                    { id: 'all', label: isEs ? 'Todas' : 'Todas', count: activeNotes.length },
                                    { id: 'favorites', label: isEs ? 'Favoritas' : 'Favoritas', count: favoritesCount },
                                    { id: 'pinned', label: isEs ? 'Fijadas' : 'Fixadas', count: pinnedCount },
                                    { id: 'with_images', label: isEs ? 'Con imágenes' : 'Com imagens', count: withImagesCount },
                                    { id: 'trash', label: isEs ? 'Papelera' : 'Lixeira', count: trashedNotes.length },
                                  ] as const
                                ).map((f) => {
                                  const active = quickFilter === f.id;
                                  return (
                                    <button
                                      key={f.id}
                                      type="button"
                                      onClick={() => setQuickFilter(f.id)}
                                      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[11px] font-black whitespace-nowrap transition-all cursor-pointer shrink-0 touch-manipulation ${
                                        active
                                          ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                                          : 'border-emerald-100/90 bg-white text-slate-600 hover:border-emerald-300'
                                      }`}
                                    >
                                      <span>{f.label}</span>
                                      <span
                                        className={`font-mono text-[10px] ${
                                          active ? 'text-emerald-100' : 'text-slate-400'
                                        }`}
                                      >
                                        {f.count}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            {/* Trash Header */}
                            {quickFilter === 'trash' && !selectedFolderId && trashedNotes.length > 0 && (
                              <div className="flex items-center justify-between px-1">
                                <span className="text-[10.5px] font-bold text-slate-500">
                                  {isEs ? 'Notas en la papelera' : 'Notas na lixeira'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => void emptyTrash()}
                                  className="text-[11px] font-black text-rose-600 hover:underline cursor-pointer touch-manipulation"
                                >
                                  {isEs ? 'Vaciar papelera' : 'Esvaziar lixeira'}
                                </button>
                              </div>
                            )}

                            {/* Elevated Modern Note Cards */}
                            {filteredNotes.length === 0 ? (
                              <div className="rounded-[2rem] border border-dashed border-emerald-200 bg-white p-9 text-center space-y-3 shadow-2xs">
                                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-50 text-emerald-600">
                                  <Sparkles className="h-7 w-7" />
                                </div>
                                <div className="space-y-1">
                                  <div className="text-sm font-black text-slate-900">
                                    {quickFilter === 'trash'
                                      ? isEs
                                        ? 'La papelera está vacía'
                                        : 'A lixeira está vazia'
                                      : isEs
                                      ? 'Tu espacio creativo de notas'
                                      : 'Seu espaço criativo de notas'}
                                  </div>
                                  <p className="mx-auto max-w-xs text-xs font-medium text-slate-500">
                                    {quickFilter === 'trash'
                                      ? isEs
                                        ? 'Las notas eliminadas aparecerán aquí.'
                                        : 'Notas apagadas aparecem aqui para restauração.'
                                      : isEs
                                      ? 'Crea notas rápidas, recetas, listas de compras o apuntes de estudio.'
                                      : 'Crie anotações, receitas, checklists interativos ou estudos organizados.'}
                                  </p>
                                </div>
                                {quickFilter !== 'trash' && (
                                  <button
                                    type="button"
                                    onClick={() => setIsTemplatePickerOpen(true)}
                                    className="inline-flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 px-5 py-2.5 text-xs font-black text-white shadow-md shadow-emerald-600/20 hover:opacity-95 cursor-pointer touch-manipulation"
                                  >
                                    <Plus className="h-4 w-4 stroke-[2.6]" />
                                    {isEs ? 'Crear primera nota' : 'Criar primeira nota'}
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <AnimatePresence initial={false} mode="popLayout">
                                  {filteredNotes.map((note) => {
                                    const folder = note.folderId ? folderNameMap[note.folderId] : null;
                                    const checkBlocks = (note.blocks || []).filter(
                                      (b) => b.type === 'checklist'
                                    );
                                    const checkTotal = checkBlocks.length;
                                    const checkDone = checkBlocks.filter((c) => c.checked).length;
                                    const firstImage = (note.images || [])[0]?.url || null;
                                    const isTrashed = Boolean(note.deletedAt);
                                    const isLockedPreview = note.locked && !unlockedIds[note.id];
                                    const accent =
                                      note.accentColor && note.accentColor !== 'none'
                                        ? FOLDER_COLORS[note.accentColor]
                                        : null;
                                    const menuOpen = contextMenuNoteId === note.id;

                                    return (
                                      <motion.div
                                        key={note.id}
                                        layout={!reduceMotion}
                                        initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.98 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={reduceMotion ? undefined : { opacity: 0, scale: 0.95 }}
                                        whileHover={reduceMotion ? undefined : { y: -2 }}
                                        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                                        onClick={() => handleOpenNoteCard(note)}
                                        className={`group relative flex flex-col justify-between rounded-[1.5rem] border p-4 transition-all cursor-pointer overflow-visible ${
                                          note.pinned
                                            ? 'border-emerald-300/90 bg-gradient-to-br from-emerald-50/55 via-white to-white shadow-[0_8px_24px_rgba(5,150,105,0.08)]'
                                            : 'border-emerald-100/90 bg-white hover:border-emerald-300 shadow-[0_4px_18px_rgba(15,23,42,0.04)]'
                                        }`}
                                      >
                                        {/* Top Color Accent Strip */}
                                        {accent && (
                                          <div
                                            className={`absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-gradient-to-r ${accent.accentBar}`}
                                          />
                                        )}

                                        <div className="space-y-2.5">
                                          {/* Card Top Row */}
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                              {note.pinned && (
                                                <Pin className="h-3.5 w-3.5 shrink-0 fill-emerald-600 text-emerald-600" />
                                              )}
                                              {note.locked && (
                                                <Lock className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                                              )}
                                              <h3 className="truncate text-[14.5px] font-black tracking-tight text-slate-900">
                                                {note.title ||
                                                  (isEs ? 'Nota sin título' : 'Nota sem título')}
                                              </h3>
                                            </div>

                                            <div
                                              className="relative flex items-center gap-0.5 shrink-0"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              {!isTrashed ? (
                                                <>
                                                  <motion.button
                                                    whileTap={{ scale: 0.8 }}
                                                    type="button"
                                                    onClick={() => toggleFavoriteNote(note.id)}
                                                    className={`rounded-xl p-1.5 transition-colors cursor-pointer touch-manipulation ${
                                                      note.favorite
                                                        ? 'text-rose-500'
                                                        : 'text-slate-300 hover:text-rose-400'
                                                    }`}
                                                    aria-label="Favoritar"
                                                  >
                                                    <Heart
                                                      className={`h-3.5 w-3.5 ${
                                                        note.favorite ? 'fill-rose-500' : ''
                                                      }`}
                                                    />
                                                  </motion.button>
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      setContextMenuNoteId(menuOpen ? null : note.id)
                                                    }
                                                    className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer touch-manipulation"
                                                    aria-label="Opções da nota"
                                                  >
                                                    <MoreHorizontal className="h-4 w-4" />
                                                  </button>

                                                  <AnimatePresence>
                                                    {menuOpen && (
                                                      <motion.div
                                                        initial={{ opacity: 0, scale: 0.94, y: 4 }}
                                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                                        exit={{ opacity: 0, scale: 0.94, y: 4 }}
                                                        className="absolute right-0 top-full mt-1 w-44 rounded-2xl border border-emerald-100 bg-white p-1.5 shadow-xl z-40"
                                                      >
                                                        <button
                                                          type="button"
                                                          onClick={() => {
                                                            togglePinNote(note.id);
                                                            setContextMenuNoteId(null);
                                                          }}
                                                          className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700 hover:bg-emerald-50 cursor-pointer"
                                                        >
                                                          <Pin className="h-3.5 w-3.5 text-emerald-600" />
                                                          {note.pinned
                                                            ? isEs
                                                              ? 'Desfijar'
                                                              : 'Desafixar'
                                                            : isEs
                                                            ? 'Fijar arriba'
                                                            : 'Fixar no topo'}
                                                        </button>
                                                        <button
                                                          type="button"
                                                          onClick={() => void handleDuplicate(note.id)}
                                                          className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700 hover:bg-emerald-50 cursor-pointer"
                                                        >
                                                          <Files className="h-3.5 w-3.5 text-emerald-600" />
                                                          {isEs ? 'Duplicar' : 'Duplicar'}
                                                        </button>
                                                        <div className="my-1 h-px bg-slate-100" />
                                                        <button
                                                          type="button"
                                                          onClick={() => {
                                                            softDeleteNote(note.id);
                                                            setContextMenuNoteId(null);
                                                          }}
                                                          className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 cursor-pointer"
                                                        >
                                                          <Trash2 className="h-3.5 w-3.5" />
                                                          {isEs ? 'Eliminar' : 'Excluir'}
                                                        </button>
                                                      </motion.div>
                                                    )}
                                                  </AnimatePresence>
                                                </>
                                              ) : (
                                                <>
                                                  <button
                                                    type="button"
                                                    onClick={() => restoreNote(note.id)}
                                                    className="rounded-xl bg-emerald-50 p-1.5 text-emerald-700 hover:bg-emerald-100 cursor-pointer touch-manipulation"
                                                    title={isEs ? 'Restaurar' : 'Restaurar'}
                                                  >
                                                    <RotateCcw className="h-3.5 w-3.5" />
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => void permanentlyDeleteNote(note.id)}
                                                    className="rounded-xl bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100 cursor-pointer touch-manipulation"
                                                    title={
                                                      isEs
                                                        ? 'Eliminar definitivamente'
                                                        : 'Excluir definitivamente'
                                                    }
                                                  >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                  </button>
                                                </>
                                              )}
                                            </div>
                                          </div>

                                          {/* Thumbnail Preview if note has an image */}
                                          {!isLockedPreview && firstImage && (
                                            <div className="h-24 w-full overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
                                              <img
                                                src={firstImage}
                                                alt=""
                                                loading="lazy"
                                                className="h-full w-full object-cover"
                                              />
                                            </div>
                                          )}

                                          {/* Body Preview */}
                                          <p className="line-clamp-3 text-xs font-medium text-slate-500 leading-relaxed break-words">
                                            {isLockedPreview
                                              ? isEs
                                                ? 'Nota protegida con PIN • Toca para desbloquear'
                                                : 'Nota protegida com PIN • Toque para desbloquear'
                                              : note.plainText ||
                                                (isEs
                                                  ? 'Toca para empezar a escribir...'
                                                  : 'Toque para começar a escrever...')}
                                          </p>

                                          {/* Mini Animated Checklist Progress Bar on Card */}
                                          {!isLockedPreview && checkTotal > 0 && (
                                            <div className="flex items-center gap-2 pt-0.5">
                                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-emerald-100">
                                                <div
                                                  style={{
                                                    width: `${Math.round((checkDone / checkTotal) * 100)}%`,
                                                  }}
                                                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-300"
                                                />
                                              </div>
                                              <span className="inline-flex items-center gap-1 font-mono text-[10px] font-black text-emerald-700 shrink-0">
                                                <CheckSquare className="h-3 w-3" />
                                                {checkDone}/{checkTotal}
                                              </span>
                                            </div>
                                          )}
                                        </div>

                                        {/* Footer Metadata */}
                                        <div className="mt-3 flex flex-wrap items-center justify-between gap-1.5 border-t border-slate-100/90 pt-2.5">
                                          <span className="text-[10px] font-bold text-slate-400">
                                            {formatNoteDate(note.updatedAt, isEs)}
                                          </span>

                                          <div className="flex flex-wrap items-center gap-1">
                                            {folder && (
                                              <span
                                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9.5px] font-black ${
                                                  FOLDER_COLORS[folder.color]?.bg || 'bg-emerald-50'
                                                } ${
                                                  FOLDER_COLORS[folder.color]?.text ||
                                                  'text-emerald-700'
                                                } ${
                                                  FOLDER_COLORS[folder.color]?.border ||
                                                  'border-emerald-200'
                                                }`}
                                              >
                                                {renderFolderIcon(folder.icon, 'h-2.5 w-2.5')}
                                                {folder.name}
                                              </span>
                                            )}

                                            {(note.tags || []).slice(0, 2).map((tg) => (
                                              <span
                                                key={tg}
                                                className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[9.5px] font-bold text-slate-600"
                                              >
                                                #{tg}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      </motion.div>
                                    );
                                  })}
                                </AnimatePresence>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              ) : (
                /* REDESIGNED FULL-SCREEN PROFESSIONAL EDITOR (NO HOME BLEED, BOTTOM DOCK ABOVE KEYBOARD) */
                <motion.div
                  key={`note-editor-${activeNote.id}`}
                  initial={reduceMotion ? false : { opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, x: 14 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="flex h-full w-full max-w-full flex-col bg-white overflow-hidden"
                >
                  {/* Discreet Top Accent Line */}
                  {activeAccentStyle && (
                    <div
                      className={`h-[3px] w-full shrink-0 bg-gradient-to-r ${activeAccentStyle.accentBar}`}
                    />
                  )}

                  {/* Pinned Compact Editor Top Bar */}
                  <div
                    className="flex items-center justify-between gap-1.5 border-b border-emerald-100/90 bg-white px-3.5 py-2.5 shrink-0 z-30"
                    style={{
                      paddingTop:
                        vvBox && vvBox.keyboardOpen
                          ? '0.55rem'
                          : 'max(0.65rem, env(safe-area-inset-top, 0px))',
                    }}
                  >
                    <motion.button
                      whileTap={{ scale: 0.94 }}
                      type="button"
                      onClick={handleCloseEditor}
                      className="inline-flex items-center gap-1 rounded-xl bg-slate-100/90 px-3 py-2 text-xs font-black text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 cursor-pointer shrink-0 touch-manipulation"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      <span>Notas</span>
                    </motion.button>

                    {/* Animated Autosave Pill */}
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10.5px] font-bold text-emerald-700 shrink-0">
                      {saveState === 'saving' ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>{isEs ? 'Guardando...' : 'Salvando...'}</span>
                        </>
                      ) : (
                        <>
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          <Cloud className="h-3 w-3" />
                          <span>{isEs ? 'Guardado' : 'Salvo'}</span>
                        </>
                      )}
                    </div>

                    {/* Right Action Controls */}
                    <div className="flex items-center gap-1 shrink-0 relative">
                      {!activeNote.deletedAt ? (
                        <>
                          <motion.button
                            whileTap={{ scale: 0.94 }}
                            type="button"
                            onClick={() => setIsReadingMode((v) => !v)}
                            className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-2 text-[11px] font-black transition-colors cursor-pointer touch-manipulation ${
                              isReadingMode
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'bg-slate-100/90 text-slate-600 hover:bg-emerald-50 hover:text-emerald-800'
                            }`}
                            title={
                              isReadingMode
                                ? isEs
                                  ? 'Volver a edición'
                                  : 'Voltar para edição'
                                : isEs
                                ? 'Modo lectura'
                                : 'Modo leitura'
                            }
                          >
                            {isReadingMode ? (
                              <>
                                <Pencil className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Editar</span>
                              </>
                            ) : (
                              <>
                                <Eye className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">{isEs ? 'Leer' : 'Ler'}</span>
                              </>
                            )}
                          </motion.button>

                          <button
                            type="button"
                            onClick={() => {
                              setIsInNoteSearchOpen((v) => !v);
                              if (isInNoteSearchOpen) setInNoteSearchQuery('');
                            }}
                            className={`rounded-xl p-2 transition-colors cursor-pointer touch-manipulation ${
                              isInNoteSearchOpen
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100/90 text-slate-600 hover:text-emerald-700'
                            }`}
                            title={isEs ? 'Buscar en la nota' : 'Buscar na nota'}
                          >
                            <Search className="h-4 w-4" />
                          </button>

                          <motion.button
                            whileTap={{ scale: 0.85 }}
                            type="button"
                            onClick={() => toggleFavoriteNote(activeNote.id)}
                            className={`rounded-xl p-2 transition-colors cursor-pointer touch-manipulation ${
                              activeNote.favorite
                                ? 'bg-rose-50 text-rose-500'
                                : 'bg-slate-100/90 text-slate-500 hover:text-rose-500'
                            }`}
                            title="Favoritar"
                          >
                            <Heart
                              className={`h-4 w-4 ${activeNote.favorite ? 'fill-rose-500' : ''}`}
                            />
                          </motion.button>

                          <button
                            type="button"
                            onClick={() => setIsEditorMenuOpen((v) => !v)}
                            className={`rounded-xl p-2 transition-colors cursor-pointer touch-manipulation ${
                              isEditorMenuOpen
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-100/90 text-slate-600 hover:bg-emerald-50'
                            }`}
                            title={isEs ? 'Más opciones' : 'Mais opções'}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => restoreNote(activeNote.id)}
                          className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-[11px] font-black text-white cursor-pointer touch-manipulation"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Restaurar
                        </button>
                      )}

                      {/* Editor Options Popover */}
                      <AnimatePresence>
                        {isEditorMenuOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: 8, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 6, scale: 0.95 }}
                            className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-emerald-100 bg-white p-1.5 shadow-2xl z-50"
                          >
                            <div className="px-2.5 py-1.5">
                              <label className="block text-[9.5px] font-black uppercase tracking-wider text-slate-400 mb-1">
                                {isEs ? 'Carpeta' : 'Pasta'}
                              </label>
                              <select
                                value={activeNote.folderId || ''}
                                onChange={(e) =>
                                  updateNote(activeNote.id, { folderId: e.target.value || null }, true)
                                }
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[16px] sm:text-xs font-bold text-slate-800 outline-none"
                              >
                                <option value="">{isEs ? 'Sin carpeta' : 'Sem pasta'}</option>
                                {folders.map((f) => (
                                  <option key={f.id} value={f.id}>
                                    {f.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="px-2.5 py-1.5">
                              <span className="block text-[9.5px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                                {isEs ? 'Color discreto' : 'Cor discreta'}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateNote(activeNote.id, { accentColor: 'none' }, true)
                                  }
                                  className={`flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 bg-white cursor-pointer ${
                                    activeNote.accentColor === 'none'
                                      ? 'ring-2 ring-emerald-600 ring-offset-1'
                                      : ''
                                  }`}
                                  title="Padrão"
                                >
                                  <X className="h-3 w-3 text-slate-400" />
                                </button>
                                {(Object.keys(FOLDER_COLORS) as NoteFolderColor[]).map((col) => (
                                  <button
                                    key={col}
                                    type="button"
                                    onClick={() =>
                                      updateNote(
                                        activeNote.id,
                                        { accentColor: col as NoteAccentColor },
                                        true
                                      )
                                    }
                                    className={`h-6 w-6 rounded-full ${FOLDER_COLORS[col].dot} cursor-pointer ${
                                      activeNote.accentColor === col
                                        ? 'ring-2 ring-slate-800 ring-offset-1 scale-110'
                                        : ''
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>

                            <div className="my-1 h-px bg-slate-100" />

                            <button
                              type="button"
                              onClick={() => {
                                setIsEditorMenuOpen(false);
                                setIsTagsPopoverOpen((v) => !v);
                              }}
                              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-emerald-50 cursor-pointer"
                            >
                              <Tag className="h-3.5 w-3.5 text-emerald-600" />
                              Etiquetas
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                togglePinNote(activeNote.id);
                                setIsEditorMenuOpen(false);
                              }}
                              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-emerald-50 cursor-pointer"
                            >
                              <Pin className="h-3.5 w-3.5 text-emerald-600" />
                              {activeNote.pinned
                                ? isEs
                                  ? 'Desfijar nota'
                                  : 'Desafixar nota'
                                : isEs
                                ? 'Fijar arriba'
                                : 'Fixar no topo'}
                            </button>

                            <button
                              type="button"
                              onClick={() => void handleDuplicate(activeNote.id)}
                              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-emerald-50 cursor-pointer"
                            >
                              <Files className="h-3.5 w-3.5 text-emerald-600" />
                              Duplicar nota
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setIsEditorMenuOpen(false);
                                saveVersionSnapshot(activeNote.id, 0);
                                setPreviewVersion(null);
                                setIsHistoryOpen(true);
                              }}
                              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-emerald-50 cursor-pointer"
                            >
                              <History className="h-3.5 w-3.5 text-emerald-600" />
                              {isEs ? 'Historial de versiones' : 'Histórico de edições'}
                            </button>

                            <button
                              type="button"
                              onClick={handleRequestToggleLock}
                              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-emerald-50 cursor-pointer"
                            >
                              {activeNote.locked ? (
                                <Unlock className="h-3.5 w-3.5 text-amber-600" />
                              ) : (
                                <Lock className="h-3.5 w-3.5 text-amber-600" />
                              )}
                              {activeNote.locked
                                ? isEs
                                  ? 'Quitar PIN'
                                  : 'Remover PIN'
                                : isEs
                                ? 'Bloquear con PIN'
                                : 'Bloquear com PIN'}
                            </button>

                            <div className="my-1 h-px bg-slate-100" />

                            <button
                              type="button"
                              onClick={() => void handleShareNote()}
                              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-emerald-50 cursor-pointer"
                            >
                              <Share2 className="h-3.5 w-3.5 text-emerald-600" />
                              {isEs ? 'Compartir' : 'Compartilhar'}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleCopyNoteText()}
                              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-emerald-50 cursor-pointer"
                            >
                              <Copy className="h-3.5 w-3.5 text-emerald-600" />
                              Copiar texto
                            </button>
                            <button
                              type="button"
                              onClick={handlePrintNotePdf}
                              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-emerald-50 cursor-pointer"
                            >
                              <Printer className="h-3.5 w-3.5 text-emerald-600" />
                              Exportar PDF
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadNote('md')}
                              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-emerald-50 cursor-pointer"
                            >
                              <Download className="h-3.5 w-3.5 text-emerald-600" />
                              Markdown (.md)
                            </button>

                            <div className="my-1 h-px bg-slate-100" />

                            <button
                              type="button"
                              onClick={() => {
                                setIsEditorMenuOpen(false);
                                softDeleteNote(activeNote.id);
                                setActiveNoteId(null);
                              }}
                              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              {isEs ? 'Mover a papelera' : 'Mover para lixeira'}
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* In-Note Search Bar */}
                  <AnimatePresence>
                    {isInNoteSearchOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden border-b border-emerald-100 bg-[#F6FBF8] px-3.5 py-2 shrink-0"
                      >
                        <div className="mx-auto flex max-w-2xl items-center gap-2">
                          <Search className="h-4 w-4 text-emerald-600 shrink-0" />
                          <input
                            type="text"
                            autoFocus
                            value={inNoteSearchQuery}
                            onChange={(e) => setInNoteSearchQuery(e.target.value)}
                            placeholder={
                              isEs
                                ? 'Buscar palabras en esta nota...'
                                : 'Buscar palavras nesta nota...'
                            }
                            className="flex-1 min-w-0 bg-transparent text-[16px] sm:text-xs font-semibold text-slate-900 placeholder:text-slate-400 outline-none"
                          />
                          {inNoteSearchQuery.trim() && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-mono text-[10px] font-black text-emerald-800 shrink-0">
                              {inNoteMatchCount}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setIsInNoteSearchOpen(false);
                              setInNoteSearchQuery('');
                            }}
                            className="rounded-lg p-1 text-slate-400 hover:bg-white cursor-pointer"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Hidden File Inputs */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => void handleImageFileSelect(e, 'photo')}
                    className="hidden"
                  />
                  <input
                    ref={scanInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => void handleImageFileSelect(e, 'scan')}
                    className="hidden"
                  />

                  {/* SmartNoteEditor manages the scrollable document paper + pinned bottom formatting dock */}
                  <SmartNoteEditor
                    noteId={activeNote.id}
                    blocks={activeNote.blocks}
                    readOnly={Boolean(activeNote.deletedAt)}
                    isReadingMode={isReadingMode}
                    isKeyboardOpen={Boolean(vvBox?.keyboardOpen)}
                    searchQuery={inNoteSearchQuery}
                    language={language}
                    isUploadingImage={isUploadingImage}
                    isDictating={isDictating}
                    onChangeBlocks={(nextBlocks, immediate) =>
                      updateNote(activeNote.id, { blocks: nextBlocks }, Boolean(immediate))
                    }
                    onTriggerImageUpload={() => fileInputRef.current?.click()}
                    onTriggerScanUpload={() => scanInputRef.current?.click()}
                    onOpenDrawing={() => setIsDrawingOpen(true)}
                    onAddTable={handleAddTable}
                    onToggleDictation={handleToggleDictation}
                    headerContent={
                      <div className="space-y-3">
                        {/* Subtle Metadata Row */}
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-slate-400">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span>{formatNoteDate(activeNote.updatedAt, isEs)}</span>
                            {activeNote.folderId && folderNameMap[activeNote.folderId] && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 text-[10px] font-black text-emerald-700">
                                {folderNameMap[activeNote.folderId].name}
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-[10.5px]">
                            {activeWordCount} pal. • {activeCharCount} car.
                          </span>
                        </div>

                        {/* Discreet Tags Bar */}
                        {((activeNote.tags || []).length > 0 || isTagsPopoverOpen) && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {(activeNote.tags || []).map((tg) => (
                              <span
                                key={tg}
                                className="inline-flex items-center gap-1 rounded-full border border-emerald-200/80 bg-emerald-50/70 px-2.5 py-0.5 text-[10.5px] font-bold text-emerald-800"
                              >
                                #{tg}
                                {!isReadingMode && !activeNote.deletedAt && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveTag(tg)}
                                    className="text-emerald-600/70 hover:text-rose-500 cursor-pointer"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </span>
                            ))}

                            {isTagsPopoverOpen && !isReadingMode && !activeNote.deletedAt && (
                              <form onSubmit={handleAddTag} className="inline-flex items-center gap-1">
                                <input
                                  type="text"
                                  value={tagInput}
                                  onChange={(e) => setTagInput(e.target.value)}
                                  placeholder={isEs ? 'Nueva etiqueta...' : 'Nova etiqueta...'}
                                  className="w-36 rounded-full border border-emerald-200 bg-slate-50 px-3 py-1 text-[16px] sm:text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white"
                                />
                                <button
                                  type="submit"
                                  className="rounded-full bg-emerald-600 p-1.5 text-white cursor-pointer"
                                >
                                  <Check className="h-3 w-3" />
                                </button>
                              </form>
                            )}
                          </div>
                        )}

                        {/* Editorial Document Title */}
                        {isReadingMode ? (
                          <h1 className="text-[26px] font-black tracking-tight text-slate-900 leading-tight break-words">
                            {activeNote.title || (isEs ? 'Nota sin título' : 'Nota sem título')}
                          </h1>
                        ) : (
                          <input
                            type="text"
                            value={activeNote.title}
                            readOnly={Boolean(activeNote.deletedAt)}
                            onChange={(e) => updateNote(activeNote.id, { title: e.target.value })}
                            placeholder={isEs ? 'Título de la nota...' : 'Título da nota...'}
                            className="w-full min-w-0 bg-transparent text-[26px] font-black tracking-tight text-slate-900 placeholder:text-slate-300 leading-tight outline-none"
                          />
                        )}

                        <div className="h-px w-full bg-gradient-to-r from-emerald-100 via-slate-100 to-transparent" />
                      </div>
                    }
                    footerContent={
                      <>
                        {/* Responsive Tables with Internal Horizontal Scroll */}
                        {(activeNote.tables || []).length > 0 && (
                          <div className="space-y-3 pt-4 w-full max-w-full min-w-0">
                            {(activeNote.tables || []).map((tbl) => (
                              <div
                                key={tbl.id}
                                className="w-full max-w-full overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-2xs"
                              >
                                {!isReadingMode && !activeNote.deletedAt && (
                                  <div className="flex items-center justify-between border-b border-emerald-100/70 bg-emerald-50/40 px-3 py-1.5">
                                    <span className="text-[10px] font-black uppercase text-emerald-800">
                                      {isEs ? 'Tabla' : 'Tabela'}
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleAddTableRow(tbl.id)}
                                        className="rounded-lg bg-white border border-emerald-200 px-2 py-0.5 text-[10px] font-black text-emerald-700 cursor-pointer touch-manipulation"
                                      >
                                        + {isEs ? 'Fila' : 'Linha'}
                                      </button>
                                      {tbl.headers.length < 5 && (
                                        <button
                                          type="button"
                                          onClick={() => handleAddTableCol(tbl.id)}
                                          className="rounded-lg bg-white border border-emerald-200 px-2 py-0.5 text-[10px] font-black text-emerald-700 cursor-pointer touch-manipulation"
                                        >
                                          + Col
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteTable(tbl.id)}
                                        className="rounded-lg p-1 text-slate-400 hover:text-rose-500 cursor-pointer touch-manipulation"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                )}
                                <div className="w-full overflow-x-auto">
                                  <table className="w-full min-w-[320px] border-collapse">
                                    <thead>
                                      <tr className="bg-emerald-50/50">
                                        {tbl.headers.map((h, ci) => (
                                          <th
                                            key={ci}
                                            className="border-b border-r last:border-r-0 border-slate-200 p-2 text-left"
                                          >
                                            {isReadingMode ? (
                                              <span className="text-xs font-black text-emerald-950">
                                                {h}
                                              </span>
                                            ) : (
                                              <input
                                                type="text"
                                                value={h}
                                                readOnly={Boolean(activeNote.deletedAt)}
                                                onChange={(e) =>
                                                  handleUpdateTableHeader(tbl.id, ci, e.target.value)
                                                }
                                                className="w-full min-w-[80px] bg-transparent text-[16px] sm:text-xs font-black text-emerald-950 outline-none"
                                              />
                                            )}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {tbl.rows.map((row, ri) => (
                                        <tr key={ri} className="border-b last:border-b-0 border-slate-100">
                                          {row.map((cell, ci) => (
                                            <td
                                              key={ci}
                                              className="border-r last:border-r-0 border-slate-100 p-2"
                                            >
                                              {isReadingMode ? (
                                                <span className="text-xs font-medium text-slate-700">
                                                  {cell || '—'}
                                                </span>
                                              ) : (
                                                <input
                                                  type="text"
                                                  value={cell}
                                                  readOnly={Boolean(activeNote.deletedAt)}
                                                  onChange={(e) =>
                                                    handleUpdateTableCell(tbl.id, ri, ci, e.target.value)
                                                  }
                                                  placeholder="—"
                                                  className="w-full min-w-[80px] bg-transparent text-[16px] sm:text-xs font-medium text-slate-700 outline-none"
                                                />
                                              )}
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Attached Images, Drawings & Scans */}
                        {(activeNote.images || []).length > 0 && (
                          <div className="space-y-2 pt-4">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                              {isEs
                                ? 'Imágenes, dibujos y escaneos'
                                : 'Imagens, desenhos e documentos'}
                            </span>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                              {(activeNote.images || []).map((img) => (
                                <div
                                  key={img.id}
                                  className="group relative aspect-video overflow-hidden rounded-2xl border border-emerald-100 bg-slate-50 shadow-2xs"
                                >
                                  <img
                                    src={img.url}
                                    alt={img.name}
                                    loading="lazy"
                                    onClick={() => setPreviewImageUrl(img.url)}
                                    className="h-full w-full object-cover cursor-pointer"
                                  />
                                  {img.kind && img.kind !== 'photo' && (
                                    <span className="absolute left-1.5 bottom-1.5 rounded-lg bg-white/95 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-900 shadow-xs">
                                      {img.kind === 'drawing'
                                        ? isEs
                                          ? 'Dibujo'
                                          : 'Desenho'
                                        : isEs
                                        ? 'Escaneo'
                                        : 'Scanner'}
                                    </span>
                                  )}
                                  {!isReadingMode && !activeNote.deletedAt && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveImage(img.id)}
                                      className="absolute right-1.5 top-1.5 rounded-lg bg-white/95 p-1 text-slate-700 hover:bg-rose-500 hover:text-white shadow-xs cursor-pointer touch-manipulation"
                                      aria-label="Remover anexo"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    }
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Subtle Feedback Toast */}
            <AnimatePresence>
              {toastMessage && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="fixed bottom-16 left-1/2 -translate-x-1/2 z-[96] rounded-full bg-emerald-900 px-4 py-2 text-xs font-bold text-white shadow-lg"
                >
                  {toastMessage}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Quick Templates Picker Modal */}
            <AnimatePresence>
              {isTemplatePickerOpen && (
                <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsTemplatePickerOpen(false)}
                    className="fixed inset-0 bg-emerald-950/15 backdrop-blur-[2px]"
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 30, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 24, scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                    className="relative z-10 w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-2xl space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-emerald-600" />
                        <h3 className="text-sm font-black text-slate-900">
                          {isEs ? 'Crear nueva nota' : 'Criar nova nota'}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsTemplatePickerOpen(false)}
                        className="rounded-xl p-1 text-slate-400 hover:bg-slate-100 cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      {NOTE_TEMPLATES.map((tpl) => (
                        <motion.button
                          key={tpl.id}
                          type="button"
                          whileHover={{ y: -1 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => void handleCreateFromTemplate(tpl.id)}
                          className="flex flex-col items-start gap-1.5 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/35 via-white to-white p-3.5 text-left hover:border-emerald-400 transition-all cursor-pointer touch-manipulation"
                        >
                          <span className="text-2xl leading-none">{tpl.emoji}</span>
                          <div className="text-xs font-black text-slate-900">
                            {isEs ? tpl.labelEs : tpl.labelPt}
                          </div>
                          <div className="text-[10.5px] font-medium text-slate-500 leading-snug">
                            {isEs ? tpl.descEs : tpl.descPt}
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Enhanced Version History Sheet */}
            <AnimatePresence>
              {isHistoryOpen && activeNote && (
                <div className="fixed inset-0 z-[82] flex items-end sm:items-center justify-center p-0 sm:p-4">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => {
                      setPreviewVersion(null);
                      setIsHistoryOpen(false);
                    }}
                    className="fixed inset-0 bg-emerald-950/15 backdrop-blur-[2px]"
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 32 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 32 }}
                    className="relative z-10 w-full max-w-md max-h-[80dvh] flex flex-col overflow-hidden rounded-t-[2rem] sm:rounded-[2rem] border border-emerald-100 bg-white shadow-2xl"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 shrink-0">
                      <div className="flex items-center gap-2">
                        {previewVersion ? (
                          <button
                            type="button"
                            onClick={() => setPreviewVersion(null)}
                            className="rounded-lg bg-slate-100 p-1 text-slate-600 hover:bg-emerald-50 cursor-pointer"
                          >
                            <ArrowLeft className="h-4 w-4" />
                          </button>
                        ) : (
                          <History className="h-4 w-4 text-emerald-600" />
                        )}
                        <h3 className="text-sm font-black text-slate-900">
                          {previewVersion
                            ? formatNoteDate(previewVersion.savedAt, isEs)
                            : isEs
                            ? 'Historial de versiones'
                            : 'Histórico de edições'}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewVersion(null);
                          setIsHistoryOpen(false);
                        }}
                        className="rounded-xl p-1 text-slate-400 hover:bg-slate-100 cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {previewVersion ? (
                      <div className="flex-1 overflow-y-auto p-5 space-y-4">
                        <div className="rounded-2xl border border-emerald-100 bg-[#F8FBF9] p-4 space-y-2">
                          <div className="text-base font-black text-slate-900">
                            {previewVersion.title || (isEs ? 'Sin título' : 'Sem título')}
                          </div>
                          <div className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700">
                            {previewVersion.plainText || '—'}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setPreviewVersion(null)}
                            className="flex-1 rounded-2xl border border-slate-200 bg-white py-3 text-xs font-black text-slate-600 hover:bg-slate-50 cursor-pointer"
                          >
                            {isEs ? 'Cancelar' : 'Voltar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              restoreVersionSnapshot(activeNote.id, previewVersion);
                              setPreviewVersion(null);
                              setIsHistoryOpen(false);
                              showToast(isEs ? 'Versión restaurada' : 'Versão restaurada');
                            }}
                            className="flex-1 rounded-2xl bg-emerald-600 py-3 text-xs font-black text-white shadow-sm hover:bg-emerald-700 cursor-pointer"
                          >
                            {isEs ? 'Confirmar restauración' : 'Confirmar restauração'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {(activeNote.versions || []).length === 0 ? (
                          <div className="py-8 text-center text-xs font-semibold text-slate-400">
                            {isEs
                              ? 'Aún no hay versiones guardadas para esta nota.'
                              : 'Nenhuma versão anterior salva ainda.'}
                          </div>
                        ) : (
                          (activeNote.versions || []).map((ver) => (
                            <div
                              key={ver.id}
                              className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 p-3 bg-slate-50/70"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="text-[10.5px] font-black text-emerald-700">
                                  {formatNoteDate(ver.savedAt, isEs)}
                                </div>
                                <div className="truncate text-xs font-black text-slate-900 mt-0.5">
                                  {ver.title || (isEs ? 'Sin título' : 'Sem título')}
                                </div>
                                <div className="line-clamp-2 text-[11px] font-medium text-slate-500 mt-0.5">
                                  {ver.plainText || '—'}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setPreviewVersion(ver)}
                                className="rounded-xl border border-emerald-200 bg-white px-2.5 py-1.5 text-[10.5px] font-black text-emerald-700 hover:bg-emerald-50 cursor-pointer shrink-0 touch-manipulation"
                              >
                                {isEs ? 'Ver' : 'Visualizar'}
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Create Folder Modal */}
            <AnimatePresence>
              {isFolderModalOpen && (
                <div className="fixed inset-0 z-[75] flex items-end sm:items-center justify-center p-0 sm:p-4">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsFolderModalOpen(false)}
                    className="fixed inset-0 bg-emerald-950/15 backdrop-blur-[2px]"
                  />
                  <motion.form
                    initial={{ opacity: 0, y: 28 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 28 }}
                    onSubmit={handleCreateFolderSubmit}
                    className="relative z-10 w-full max-w-sm rounded-t-[2rem] sm:rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-2xl space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-black text-slate-900">
                        {isEs ? 'Nueva carpeta' : 'Nova pasta'}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setIsFolderModalOpen(false)}
                        className="rounded-xl p-1 text-slate-400 hover:bg-slate-100 cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <input
                      type="text"
                      required
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      placeholder={
                        isEs
                          ? 'Ej: Estudios, Trabajo, Ideas, Proyectos...'
                          : 'Ex: Estudos, Trabalho, Ideias, Projetos...'
                      }
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[16px] sm:text-xs font-bold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white"
                    />

                    <div className="space-y-1.5">
                      <span className="text-[10px] font-black uppercase text-slate-400">
                        {isEs ? 'Ícono' : 'Ícone'}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {FOLDER_ICONS.map((ic) => {
                          const Icon = ic.icon;
                          const active = newFolderIcon === ic.id;
                          return (
                            <button
                              key={ic.id}
                              type="button"
                              onClick={() => setNewFolderIcon(ic.id)}
                              className={`flex h-9 w-9 items-center justify-center rounded-xl border cursor-pointer touch-manipulation ${
                                active
                                  ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                                  : 'border-slate-200 bg-white text-slate-500'
                              }`}
                            >
                              <Icon className="h-4 w-4" />
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[10px] font-black uppercase text-slate-400">
                        {isEs ? 'Color' : 'Cor'}
                      </span>
                      <div className="flex items-center gap-2">
                        {(Object.keys(FOLDER_COLORS) as NoteFolderColor[]).map((col) => (
                          <button
                            key={col}
                            type="button"
                            onClick={() => setNewFolderColor(col)}
                            className={`h-7 w-7 rounded-full ${FOLDER_COLORS[col].dot} cursor-pointer transition-transform touch-manipulation ${
                              newFolderColor === col
                                ? 'ring-2 ring-offset-2 ring-slate-800 scale-110'
                                : ''
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full rounded-2xl bg-emerald-600 py-3 text-xs font-black uppercase tracking-wider text-white shadow-md hover:bg-emerald-700 cursor-pointer touch-manipulation"
                    >
                      {isEs ? 'Crear carpeta' : 'Criar pasta'}
                    </button>
                  </motion.form>
                </div>
              )}
            </AnimatePresence>

            {/* Freehand Drawing Modal */}
            <NoteDrawingModal
              isOpen={isDrawingOpen}
              onClose={() => setIsDrawingOpen(false)}
              onSaveDrawing={handleSaveDrawing}
              language={language}
            />

            {/* PIN Lock / Unlock Modal */}
            <NotePinModal
              isOpen={pinModalState.open}
              mode={pinModalState.mode}
              onClose={() => setPinModalState((s) => ({ ...s, open: false }))}
              onSubmitPin={handlePinSubmit}
              language={language}
            />

            {/* Light Image Lightbox */}
            <AnimatePresence>
              {previewImageUrl && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setPreviewImageUrl(null)}
                  className="fixed inset-0 z-[92] flex items-center justify-center bg-white/92 backdrop-blur-md p-4"
                >
                  <img
                    src={previewImageUrl}
                    alt="Preview"
                    className="max-h-[88dvh] max-w-full rounded-2xl object-contain shadow-2xl border border-emerald-100"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};
