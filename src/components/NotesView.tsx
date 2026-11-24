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
} from 'lucide-react';
import { LanguageCode } from '../types';
import {
  NoteBlock,
  NoteFolder,
  NoteFolderColor,
  NoteFolderIcon,
  NoteItem,
  countWords,
  createBlockId,
  htmlToPlainText,
  useNotes,
} from '../hooks/useNotes';
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
type NotesQuickFilter = 'all' | 'pinned' | 'with_images' | 'trash';

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
  { bg: string; text: string; border: string; dot: string }
> = {
  emerald: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  teal: {
    bg: 'bg-teal-50',
    text: 'text-teal-700',
    border: 'border-teal-200',
    dot: 'bg-teal-500',
  },
  sky: {
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
    dot: 'bg-sky-500',
  },
  amber: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  violet: {
    bg: 'bg-violet-50',
    text: 'text-violet-700',
    border: 'border-violet-200',
    dot: 'bg-violet-500',
  },
  rose: {
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
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
      if (blk.type === 'heading') lines.push(`## ${text}`);
      else if (blk.type === 'subheading') lines.push(`### ${text}`);
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
    updateNote,
    saveVersionSnapshot,
    restoreVersionSnapshot,
    togglePinNote,
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

  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderIcon, setNewFolderIcon] = useState<NoteFolderIcon>('lightbulb');
  const [newFolderColor, setNewFolderColor] = useState<NoteFolderColor>('emerald');

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
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [copiedFeedback, setCopiedFeedback] = useState(false);
  const [isDictating, setIsDictating] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const activeNote: NoteItem | null = useMemo(
    () => notes.find((n) => n.id === activeNoteId) || null,
    [notes, activeNoteId]
  );

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

  useEffect(() => {
    if (!isOpen) {
      stopDictation();
      void flushPendingSaves();
      setActiveNoteId(null);
      setPreviewImageUrl(null);
      setIsHistoryOpen(false);
      setIsExportMenuOpen(false);
      setUnlockedIds({});
      return;
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, flushPendingSaves]);

  const activeNotes = useMemo(() => notes.filter((n) => !n.deletedAt), [notes]);
  const trashedNotes = useMemo(() => notes.filter((n) => Boolean(n.deletedAt)), [notes]);
  const pinnedCount = useMemo(() => activeNotes.filter((n) => n.pinned).length, [activeNotes]);
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
        : quickFilter === 'with_images'
        ? activeNotes.filter((n) => (n.images || []).length > 0)
        : activeNotes;

    if (q) {
      base = base.filter((n) => {
        const folderName = n.folderId ? folderNameMap[n.folderId]?.name || '' : '';
        if (n.locked && !unlockedIds[n.id]) {
          return `${n.title} ${folderName}`.toLowerCase().includes(q);
        }
        const haystack = `${n.title} ${n.plainText} ${folderName}`.toLowerCase();
        return haystack.includes(q);
      });
    }

    return [...base].sort((a, b) => {
      if (quickFilter !== 'trash' && a.pinned !== b.pinned) {
        return a.pinned ? -1 : 1;
      }
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }, [activeNotes, trashedNotes, quickFilter, selectedFolderId, searchQuery, folderNameMap, unlockedIds]);

  const handleOpenNoteCard = (note: NoteItem) => {
    if (note.locked && !unlockedIds[note.id]) {
      setPinModalState({
        open: true,
        mode: hasPinConfigured ? 'unlock' : 'create',
        targetNoteId: note.id,
        action: 'open',
      });
      return;
    }
    setActiveNoteId(note.id);
  };

  const handleRequestToggleLock = () => {
    if (!activeNote) return;
    if (activeNote.locked) {
      toggleLockNote(activeNote.id, false);
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

  const handleCreateNote = async () => {
    const created = await createNote(selectedFolderId);
    setActiveNoteId(created.id);
  };

  const handleCloseEditor = async () => {
    stopDictation();
    if (activeNote) {
      saveVersionSnapshot(activeNote.id);
    }
    await flushPendingSaves();
    setIsHistoryOpen(false);
    setIsExportMenuOpen(false);
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
      setCopiedFeedback(true);
      window.setTimeout(() => setCopiedFeedback(false), 1800);
    } catch {
      // ignore
    }
    setIsExportMenuOpen(false);
  };

  const handleShareNote = async () => {
    if (!activeNote) return;
    const text = buildMarkdownFromNote(activeNote);
    setIsExportMenuOpen(false);
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
    setIsExportMenuOpen(false);
  };

  const handlePrintNotePdf = () => {
    if (!activeNote) return;
    setIsExportMenuOpen(false);
    const win = window.open('', '_blank', 'width=800,height=900');
    if (!win) return;
    const blocksHtml = (activeNote.blocks || [])
      .map((b) => {
        if (b.type === 'heading') return `<h2>${b.html}</h2>`;
        if (b.type === 'subheading') return `<h3>${b.html}</h3>`;
        if (b.type === 'checklist') return `<p>${b.checked ? '☑' : '☐'} ${b.html}</p>`;
        if (b.type === 'bullet') return `<p>• ${b.html}</p>`;
        if (b.type === 'numbered') return `<p>- ${b.html}</p>`;
        return `<p>${b.html}</p>`;
      })
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
            body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 32px; color: #0f172a; line-height: 1.6; }
            h1 { color: #065f46; margin-bottom: 4px; }
            .meta { color: #64748b; font-size: 12px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <h1>${activeNote.title || 'Nota sem título'}</h1>
          <div class="meta">SisFinz Notas • ${formatNoteDate(activeNote.updatedAt, isEs)}</div>
          <div>${blocksHtml}</div>
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

  const activeWordCount = activeNote
    ? countWords(`${activeNote.title} ${activeNote.plainText}`)
    : 0;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="sisfinz-notes-root"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ type: 'spring', stiffness: 330, damping: 30 }}
          className="fixed inset-0 z-[58] flex flex-col bg-[#F5F9F7] text-slate-900 overflow-hidden"
        >
          <AnimatePresence mode="wait" initial={false}>
            {!activeNote ? (
              /* NOTES 2.0 HOME (3 AREAS: ALL NOTES, FOLDERS, SAVED LINKS) */
              <motion.div
                key="notes-home"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="flex h-full flex-col overflow-hidden"
              >
                {/* Clean Light Header */}
                <div
                  className="border-b border-emerald-100/90 bg-white/95 px-3.5 pb-3 pt-3 shrink-0 space-y-3"
                  style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}
                >
                  <div className="mx-auto flex max-w-2xl items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors cursor-pointer shrink-0"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      {isEs ? 'Volver' : 'Voltar'}
                    </button>

                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 text-white shadow-sm">
                        <StickyNote className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <h1 className="truncate text-sm font-black tracking-tight text-slate-900">
                          Notas SisFinz
                        </h1>
                        <p className="truncate text-[9.5px] font-bold uppercase tracking-wider text-emerald-700">
                          {activeTab === 'saved_links'
                            ? isEs
                              ? 'Biblioteca Visual de Enlaces'
                              : 'Biblioteca Visual de Links'
                            : activeTab === 'folders'
                            ? isEs
                              ? 'Carpetas y Colecciones'
                              : 'Pastas & Organização'
                            : `${activeNotes.length} ${activeNotes.length === 1 ? 'nota' : 'notas'}`}
                        </p>
                      </div>
                    </div>

                    {activeTab === 'folders' ? (
                      <button
                        type="button"
                        onClick={() => setIsFolderModalOpen(true)}
                        className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-[11px] font-black text-emerald-800 hover:bg-emerald-100 cursor-pointer shrink-0"
                      >
                        <FolderPlus className="h-3.5 w-3.5 text-emerald-600" />
                        <span>{isEs ? 'Nueva' : 'Nova'}</span>
                      </button>
                    ) : (
                      <div className="w-16 shrink-0" />
                    )}
                  </div>

                  {/* 3-Area Elegant Segmented Navigation */}
                  <div className="mx-auto max-w-2xl">
                    <div className="grid grid-cols-3 gap-1 rounded-2xl border border-emerald-100 bg-[#F3F8F5] p-1">
                      {(
                        [
                          {
                            id: 'all_notes',
                            label: isEs ? 'Todas las notas' : 'Todas as notas',
                            icon: FileText,
                          },
                          {
                            id: 'folders',
                            label: isEs ? 'Pastas' : 'Pastas',
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
                              if (tab.id === 'all_notes') {
                                setSelectedFolderId(null);
                              }
                            }}
                            className={`relative isolate flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 text-[11px] font-black transition-colors cursor-pointer ${
                              isActive
                                ? 'text-emerald-950'
                                : 'text-slate-500 hover:text-emerald-800'
                            }`}
                          >
                            {isActive && (
                              <motion.span
                                layoutId="notes-home-tab-pill"
                                transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                                className="absolute inset-0 -z-10 rounded-xl bg-white border border-emerald-200/80 shadow-xs"
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

                {/* Main Content Area with Smooth Transitions Between the 3 Areas */}
                <div className="flex-1 overflow-y-auto px-3.5 py-4">
                  <div className="mx-auto max-w-2xl">
                    <AnimatePresence mode="wait" initial={false}>
                      {activeTab === 'saved_links' ? (
                        <motion.div
                          key="area-saved-links"
                          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                          transition={{ duration: 0.2 }}
                        >
                          <SavedLinksLibrary language={language} />
                        </motion.div>
                      ) : activeTab === 'folders' ? (
                        <motion.div
                          key="area-folders"
                          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                          transition={{ duration: 0.2 }}
                          className="space-y-5 pb-24"
                        >
                          {/* Smart System Folders */}
                          <div className="space-y-2">
                            <span className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                              {isEs ? 'Inteligentes' : 'Pastas inteligentes'}
                            </span>
                            <div className="grid grid-cols-2 gap-2.5">
                              {(
                                [
                                  {
                                    id: 'all',
                                    label: isEs ? 'Todas las notas' : 'Todas as notas',
                                    count: activeNotes.length,
                                    icon: FileText,
                                    tone: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                                  },
                                  {
                                    id: 'pinned',
                                    label: isEs ? 'Fijadas' : 'Fixadas',
                                    count: pinnedCount,
                                    icon: Pin,
                                    tone: 'bg-amber-50 text-amber-700 border-amber-200',
                                  },
                                  {
                                    id: 'with_images',
                                    label: isEs ? 'Con imágenes' : 'Com imagens',
                                    count: withImagesCount,
                                    icon: ImageIcon,
                                    tone: 'bg-sky-50 text-sky-700 border-sky-200',
                                  },
                                  {
                                    id: 'trash',
                                    label: isEs ? 'Eliminadas' : 'Apagadas',
                                    count: trashedNotes.length,
                                    icon: Trash2,
                                    tone: 'bg-rose-50 text-rose-700 border-rose-200',
                                  },
                                ] as const
                              ).map((sys) => {
                                const Icon = sys.icon;
                                return (
                                  <motion.button
                                    key={sys.id}
                                    type="button"
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => {
                                      setSelectedFolderId(null);
                                      setQuickFilter(sys.id);
                                      setActiveTab('all_notes');
                                    }}
                                    className="flex flex-col justify-between gap-3 rounded-2xl border border-emerald-100 bg-white p-4 text-left shadow-2xs hover:border-emerald-300 hover:shadow-sm transition-all cursor-pointer"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span
                                        className={`flex h-9 w-9 items-center justify-center rounded-xl border ${sys.tone}`}
                                      >
                                        <Icon className="h-4 w-4" />
                                      </span>
                                      <span className="font-mono text-base font-black text-slate-900">
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
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                {isEs ? 'Mis carpetas' : 'Minhas pastas'}
                              </span>
                              <button
                                type="button"
                                onClick={() => setIsFolderModalOpen(true)}
                                className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-700 hover:underline cursor-pointer"
                              >
                                <Plus className="h-3.5 w-3.5" />
                                {isEs ? 'Crear carpeta' : 'Criar pasta'}
                              </button>
                            </div>

                            {folders.length === 0 ? (
                              <div className="rounded-3xl border border-dashed border-emerald-200 bg-white p-7 text-center space-y-2">
                                <Folder className="mx-auto h-7 w-7 text-emerald-500" />
                                <p className="text-xs font-bold text-slate-600">
                                  {isEs
                                    ? 'Organiza tus notas en carpetas como Estudios, Trabajo o Proyectos.'
                                    : 'Organize suas notas em pastas como Estudos, Trabalho, Ideias ou Projetos.'}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => setIsFolderModalOpen(true)}
                                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white shadow-xs hover:bg-emerald-700 cursor-pointer"
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
                                    <div
                                      key={fld.id}
                                      className="flex items-center justify-between gap-2 rounded-2xl border border-emerald-100 bg-white p-3.5 shadow-2xs hover:border-emerald-300 transition-all"
                                    >
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedFolderId(fld.id);
                                          setQuickFilter('all');
                                          setActiveTab('all_notes');
                                        }}
                                        className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
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
                                        className="rounded-xl p-2 text-slate-300 hover:bg-rose-50 hover:text-rose-500 cursor-pointer"
                                        aria-label="Excluir pasta"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      ) : (
                        /* AREA 1: ALL NOTES */
                        <motion.div
                          key="area-all-notes"
                          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                          transition={{ duration: 0.2 }}
                          className="space-y-4 pb-24"
                        >
                          {/* Search Bar */}
                          <div className="relative">
                            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                              type="text"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              placeholder={
                                isEs
                                  ? 'Buscar por título, contenido o carpeta...'
                                  : 'Buscar por título, conteúdo ou pasta...'
                              }
                              className="w-full rounded-2xl border border-slate-200/90 bg-white py-2.5 pl-10 pr-9 text-xs font-bold text-slate-900 placeholder:text-slate-400 shadow-2xs outline-none focus:border-emerald-500"
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

                          {/* Active Folder Banner or Quick Filter Chips */}
                          {selectedFolderId ? (
                            <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50/80 px-3.5 py-2">
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
                                className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-[10.5px] font-black text-emerald-800 shadow-2xs cursor-pointer"
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
                                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-black whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                                      active
                                        ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                                        : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300'
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
                                className="text-[11px] font-black text-rose-600 hover:underline cursor-pointer"
                              >
                                {isEs ? 'Vaciar papelera' : 'Esvaziar lixeira'}
                              </button>
                            </div>
                          )}

                          {/* Notes List */}
                          {filteredNotes.length === 0 ? (
                            <div className="rounded-[1.75rem] border border-dashed border-emerald-200 bg-white p-8 text-center space-y-2.5">
                              <StickyNote className="mx-auto h-7 w-7 text-emerald-500" />
                              <div className="text-xs font-black text-slate-800">
                                {quickFilter === 'trash'
                                  ? isEs
                                    ? 'La papelera está vacía.'
                                    : 'A lixeira está vazia.'
                                  : isEs
                                  ? 'Aún no hay notas aquí.'
                                  : 'Nenhuma nota por aqui ainda.'}
                              </div>
                              {quickFilter !== 'trash' && (
                                <button
                                  type="button"
                                  onClick={handleCreateNote}
                                  className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-emerald-700 cursor-pointer"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                  {isEs ? 'Crear nota' : 'Criar nota'}
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <AnimatePresence initial={false} mode="popLayout">
                                {filteredNotes.map((note) => {
                                  const folder = note.folderId ? folderNameMap[note.folderId] : null;
                                  const checkBlocks = (note.blocks || []).filter(
                                    (b) => b.type === 'checklist'
                                  );
                                  const checkTotal = checkBlocks.length;
                                  const checkDone = checkBlocks.filter((c) => c.checked).length;
                                  const imgCount = (note.images || []).length;
                                  const isTrashed = Boolean(note.deletedAt);
                                  const isLockedPreview = note.locked && !unlockedIds[note.id];

                                  return (
                                    <motion.div
                                      key={note.id}
                                      layout={!reduceMotion}
                                      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={reduceMotion ? undefined : { opacity: 0, scale: 0.96 }}
                                      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                                      onClick={() => handleOpenNoteCard(note)}
                                      className={`group rounded-2xl border p-3.5 transition-all cursor-pointer ${
                                        note.pinned
                                          ? 'border-emerald-300 bg-gradient-to-r from-emerald-50/55 via-white to-white shadow-xs'
                                          : 'border-slate-200/80 bg-white hover:border-emerald-300 shadow-2xs'
                                      }`}
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1 space-y-1">
                                          <div className="flex items-center gap-1.5">
                                            {note.pinned && (
                                              <Pin className="h-3.5 w-3.5 shrink-0 fill-emerald-600 text-emerald-600" />
                                            )}
                                            {note.locked && (
                                              <Lock className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                                            )}
                                            <h3 className="truncate text-sm font-black text-slate-900">
                                              {note.title ||
                                                (isEs ? 'Nota sin título' : 'Nota sem título')}
                                            </h3>
                                          </div>

                                          <p className="line-clamp-2 text-xs font-medium text-slate-500">
                                            {isLockedPreview
                                              ? isEs
                                                ? 'Nota protegida con PIN • Toca para desbloquear'
                                                : 'Nota protegida com PIN • Toque para desbloquear'
                                              : note.plainText ||
                                                (checkTotal > 0
                                                  ? `${checkDone}/${checkTotal} ${
                                                      isEs ? 'tareas' : 'itens na lista'
                                                    }`
                                                  : isEs
                                                  ? 'Toca para escribir...'
                                                  : 'Toque para escrever...')}
                                          </p>

                                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                            <span className="text-[10px] font-bold text-slate-400">
                                              {formatNoteDate(note.updatedAt, isEs)}
                                            </span>

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

                                            {!isLockedPreview && checkTotal > 0 && (
                                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-mono text-[9.5px] font-bold text-emerald-700">
                                                <CheckSquare className="h-2.5 w-2.5" />
                                                {checkDone}/{checkTotal}
                                              </span>
                                            )}

                                            {!isLockedPreview && imgCount > 0 && (
                                              <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 font-mono text-[9.5px] font-bold text-sky-700">
                                                <ImageIcon className="h-2.5 w-2.5" />
                                                {imgCount}
                                              </span>
                                            )}
                                          </div>
                                        </div>

                                        <div
                                          className="flex items-center gap-1 shrink-0"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {!isTrashed ? (
                                            <>
                                              <button
                                                type="button"
                                                onClick={() => togglePinNote(note.id)}
                                                className={`rounded-xl p-1.5 transition-colors cursor-pointer ${
                                                  note.pinned
                                                    ? 'bg-emerald-100 text-emerald-700'
                                                    : 'text-slate-300 hover:bg-slate-100 hover:text-slate-600'
                                                }`}
                                                aria-label="Fixar nota"
                                              >
                                                <Pin className="h-3.5 w-3.5" />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => softDeleteNote(note.id)}
                                                className="rounded-xl p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-colors cursor-pointer"
                                                aria-label="Mover para lixeira"
                                              >
                                                <Trash2 className="h-3.5 w-3.5" />
                                              </button>
                                            </>
                                          ) : (
                                            <>
                                              <button
                                                type="button"
                                                onClick={() => restoreNote(note.id)}
                                                className="rounded-xl bg-emerald-50 p-1.5 text-emerald-700 hover:bg-emerald-100 cursor-pointer"
                                                title={isEs ? 'Restaurar' : 'Restaurar'}
                                              >
                                                <RotateCcw className="h-3.5 w-3.5" />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => void permanentlyDeleteNote(note.id)}
                                                className="rounded-xl bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100 cursor-pointer"
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
                                    </motion.div>
                                  );
                                })}
                              </AnimatePresence>
                            </div>
                          )}

                          {/* Floating + New Note Button */}
                          {quickFilter !== 'trash' && (
                            <motion.button
                              type="button"
                              whileHover={{ scale: 1.06 }}
                              whileTap={{ scale: 0.92 }}
                              onClick={handleCreateNote}
                              style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
                              className="fixed right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-xl shadow-emerald-600/35 cursor-pointer"
                              aria-label={isEs ? 'Nueva nota' : 'Nova nota'}
                            >
                              <Plus className="h-6 w-6 stroke-[2.8]" />
                            </motion.button>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            ) : (
              /* FULL-SCREEN SMART EDITOR */
              <motion.div
                key={`note-editor-${activeNote.id}`}
                initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: 14, scale: 0.985 }}
                transition={{ type: 'spring', stiffness: 360, damping: 30 }}
                className="flex h-full flex-col bg-white overflow-hidden"
              >
                {/* Editor Top Bar */}
                <div
                  className="flex items-center justify-between gap-2 border-b border-emerald-100/80 bg-white px-3.5 py-2.5 shrink-0"
                  style={{ paddingTop: 'max(0.65rem, env(safe-area-inset-top, 0px))' }}
                >
                  <button
                    type="button"
                    onClick={handleCloseEditor}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 cursor-pointer shrink-0"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Notas
                  </button>

                  {/* Auto-save indicator */}
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700">
                    {saveState === 'saving' ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>{isEs ? 'Guardando...' : 'Salvando...'}</span>
                      </>
                    ) : copiedFeedback ? (
                      <>
                        <Check className="h-3 w-3" />
                        <span>{isEs ? 'Copiado' : 'Copiado'}</span>
                      </>
                    ) : (
                      <>
                        <Cloud className="h-3 w-3" />
                        <span>{isEs ? 'Guardado' : 'Salvo'}</span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0 relative">
                    <select
                      value={activeNote.folderId || ''}
                      onChange={(e) =>
                        updateNote(activeNote.id, { folderId: e.target.value || null }, true)
                      }
                      className="hidden sm:block max-w-[110px] rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 text-[10.5px] font-black text-slate-700 outline-none"
                    >
                      <option value="">{isEs ? 'Sin carpeta' : 'Sem pasta'}</option>
                      {folders.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>

                    {!activeNote.deletedAt ? (
                      <>
                        <button
                          type="button"
                          onClick={handleRequestToggleLock}
                          className={`rounded-xl p-2 transition-colors cursor-pointer ${
                            activeNote.locked
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-500 hover:text-slate-800'
                          }`}
                          title={
                            activeNote.locked
                              ? isEs
                                ? 'Quitar PIN'
                                : 'Remover PIN'
                              : isEs
                              ? 'Bloquear con PIN'
                              : 'Bloquear com PIN'
                          }
                        >
                          {activeNote.locked ? (
                            <Lock className="h-4 w-4" />
                          ) : (
                            <Unlock className="h-4 w-4" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            saveVersionSnapshot(activeNote.id);
                            setIsHistoryOpen(true);
                          }}
                          className="rounded-xl bg-slate-100 p-2 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer"
                          title={isEs ? 'Historial de versiones' : 'Histórico de versões'}
                        >
                          <History className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsExportMenuOpen((v) => !v)}
                          className="rounded-xl bg-slate-100 p-2 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer"
                          title={isEs ? 'Compartir / Exportar' : 'Compartilhar / Exportar'}
                        >
                          <Share2 className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => togglePinNote(activeNote.id)}
                          className={`rounded-xl p-2 transition-colors cursor-pointer ${
                            activeNote.pinned
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-500 hover:text-slate-800'
                          }`}
                          aria-label="Fixar nota"
                        >
                          <Pin className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => restoreNote(activeNote.id)}
                        className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-[11px] font-black text-white cursor-pointer"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        {isEs ? 'Restaurar' : 'Restaurar'}
                      </button>
                    )}

                    {/* Export & Share Dropdown */}
                    <AnimatePresence>
                      {isExportMenuOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 8, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 6, scale: 0.95 }}
                          className="absolute right-0 top-full mt-2 w-48 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl z-40"
                        >
                          <button
                            type="button"
                            onClick={() => void handleShareNote()}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 cursor-pointer"
                          >
                            <Share2 className="h-3.5 w-3.5 text-emerald-600" />
                            {isEs ? 'Compartir' : 'Compartilhar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleCopyNoteText()}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 cursor-pointer"
                          >
                            <Copy className="h-3.5 w-3.5 text-emerald-600" />
                            {isEs ? 'Copiar texto' : 'Copiar texto'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadNote('md')}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 cursor-pointer"
                          >
                            <Download className="h-3.5 w-3.5 text-emerald-600" />
                            {isEs ? 'Exportar Markdown (.md)' : 'Exportar Markdown (.md)'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadNote('txt')}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 cursor-pointer"
                          >
                            <Download className="h-3.5 w-3.5 text-emerald-600" />
                            {isEs ? 'Exportar Texto (.txt)' : 'Exportar Texto (.txt)'}
                          </button>
                          <button
                            type="button"
                            onClick={handlePrintNotePdf}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 cursor-pointer"
                          >
                            <Printer className="h-3.5 w-3.5 text-emerald-600" />
                            {isEs ? 'Imprimir / PDF' : 'Imprimir / PDF'}
                          </button>
                          <div className="my-1 h-px bg-slate-100" />
                          <button
                            type="button"
                            onClick={() => {
                              setIsExportMenuOpen(false);
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

                {/* Hidden File Inputs for Images & Document Scan */}
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

                {/* Editor Body + Smart Blocks + Tables + Images */}
                <div className="flex-1 overflow-y-auto">
                  <div className="mx-auto max-w-2xl px-4 sm:px-6 pt-4 pb-24 space-y-4">
                    {/* Metadata */}
                    <div className="flex items-center justify-between text-[10.5px] font-bold text-slate-400">
                      <span>{formatNoteDate(activeNote.updatedAt, isEs)}</span>
                      <span>
                        {activeWordCount}{' '}
                        {activeWordCount === 1
                          ? isEs
                            ? 'palabra'
                            : 'palavra'
                          : isEs
                          ? 'palabras'
                          : 'palavras'}
                      </span>
                    </div>

                    {/* Note Title */}
                    <input
                      type="text"
                      value={activeNote.title}
                      readOnly={Boolean(activeNote.deletedAt)}
                      onChange={(e) => updateNote(activeNote.id, { title: e.target.value })}
                      placeholder={isEs ? 'Título de la nota...' : 'Título da nota...'}
                      className="w-full bg-transparent text-2xl font-black tracking-tight text-slate-900 placeholder:text-slate-300 outline-none"
                    />

                    {/* Smart Structured Block Editor (Checklists, Bullets, Numbered, Headings, Inline Format) */}
                    <div className="-mx-4 sm:-mx-6">
                      <div className="px-4 sm:px-6">
                        <SmartNoteEditor
                          blocks={activeNote.blocks}
                          readOnly={Boolean(activeNote.deletedAt)}
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
                        />
                      </div>
                    </div>

                    {/* Editable Tables */}
                    {(activeNote.tables || []).length > 0 && (
                      <div className="space-y-3 pt-2">
                        {(activeNote.tables || []).map((tbl) => (
                          <div
                            key={tbl.id}
                            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs"
                          >
                            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-1.5">
                              <span className="text-[10px] font-black uppercase text-slate-500">
                                {isEs ? 'Tabla' : 'Tabela'}
                              </span>
                              {!activeNote.deletedAt && (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleAddTableRow(tbl.id)}
                                    className="rounded-lg bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-black text-emerald-700 cursor-pointer"
                                  >
                                    + {isEs ? 'Fila' : 'Linha'}
                                  </button>
                                  {tbl.headers.length < 5 && (
                                    <button
                                      type="button"
                                      onClick={() => handleAddTableCol(tbl.id)}
                                      className="rounded-lg bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-black text-emerald-700 cursor-pointer"
                                    >
                                      + Col
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteTable(tbl.id)}
                                    className="rounded-lg p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full border-collapse text-xs">
                                <thead>
                                  <tr className="bg-emerald-50/60">
                                    {tbl.headers.map((h, ci) => (
                                      <th
                                        key={ci}
                                        className="border-b border-r last:border-r-0 border-slate-200 p-1.5 text-left"
                                      >
                                        <input
                                          type="text"
                                          value={h}
                                          readOnly={Boolean(activeNote.deletedAt)}
                                          onChange={(e) =>
                                            handleUpdateTableHeader(tbl.id, ci, e.target.value)
                                          }
                                          className="w-full bg-transparent font-black text-emerald-950 outline-none"
                                        />
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
                                          className="border-r last:border-r-0 border-slate-100 p-1.5"
                                        >
                                          <input
                                            type="text"
                                            value={cell}
                                            readOnly={Boolean(activeNote.deletedAt)}
                                            onChange={(e) =>
                                              handleUpdateTableCell(tbl.id, ri, ci, e.target.value)
                                            }
                                            placeholder="—"
                                            className="w-full bg-transparent font-medium text-slate-700 outline-none"
                                          />
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
                      <div className="space-y-2 pt-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          {isEs ? 'Imágenes, dibujos y escaneos' : 'Imagens, desenhos e documentos'}
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {(activeNote.images || []).map((img) => (
                            <div
                              key={img.id}
                              className="group relative aspect-video overflow-hidden rounded-2xl border border-slate-200 bg-slate-100"
                            >
                              <img
                                src={img.url}
                                alt={img.name}
                                loading="lazy"
                                onClick={() => setPreviewImageUrl(img.url)}
                                className="h-full w-full object-cover cursor-pointer"
                              />
                              {img.kind && img.kind !== 'photo' && (
                                <span className="absolute left-1.5 bottom-1.5 rounded-lg bg-white/90 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-900 shadow-xs">
                                  {img.kind === 'drawing'
                                    ? isEs
                                      ? 'Dibujo'
                                      : 'Desenho'
                                    : isEs
                                    ? 'Escaneo'
                                    : 'Scanner'}
                                </span>
                              )}
                              {!activeNote.deletedAt && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveImage(img.id)}
                                  className="absolute right-1.5 top-1.5 rounded-lg bg-white/90 p-1 text-slate-700 hover:bg-rose-500 hover:text-white shadow-xs cursor-pointer"
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
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Version History Sheet */}
          <AnimatePresence>
            {isHistoryOpen && activeNote && (
              <div className="fixed inset-0 z-[82] flex items-end sm:items-center justify-center p-0 sm:p-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsHistoryOpen(false)}
                  className="fixed inset-0 bg-emerald-950/15 backdrop-blur-[2px]"
                />
                <motion.div
                  initial={{ opacity: 0, y: 32 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 32 }}
                  className="relative z-10 w-full max-w-md max-h-[75dvh] flex flex-col overflow-hidden rounded-t-[2rem] sm:rounded-[2rem] border border-emerald-100 bg-white shadow-2xl"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <History className="h-4 w-4 text-emerald-600" />
                      <h3 className="text-sm font-black text-slate-900">
                        {isEs ? 'Historial de versiones' : 'Histórico de versões'}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsHistoryOpen(false)}
                      className="rounded-xl p-1 text-slate-400 hover:bg-slate-100 cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

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
                            <div className="text-[10px] font-black text-emerald-700">
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
                            onClick={() => {
                              restoreVersionSnapshot(activeNote.id, ver);
                              setIsHistoryOpen(false);
                            }}
                            className="rounded-xl bg-emerald-600 px-2.5 py-1.5 text-[10px] font-black text-white hover:bg-emerald-700 cursor-pointer shrink-0"
                          >
                            {isEs ? 'Restaurar' : 'Restaurar'}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
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
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white"
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
                            className={`flex h-9 w-9 items-center justify-center rounded-xl border cursor-pointer ${
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
                          className={`h-7 w-7 rounded-full ${FOLDER_COLORS[col].dot} cursor-pointer transition-transform ${
                            newFolderColor === col ? 'ring-2 ring-offset-2 ring-slate-800 scale-110' : ''
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-2xl bg-emerald-600 py-3 text-xs font-black uppercase tracking-wider text-white shadow-md hover:bg-emerald-700 cursor-pointer"
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

          {/* Image Lightbox */}
          <AnimatePresence>
            {previewImageUrl && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setPreviewImageUrl(null)}
                className="fixed inset-0 z-[92] flex items-center justify-center bg-white/90 backdrop-blur-md p-4"
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
      )}
    </AnimatePresence>,
    document.body
  );
};
