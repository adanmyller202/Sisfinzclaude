import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
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
  Bold,
  Italic,
  List,
  ListOrdered,
  Table as TableIcon,
  Heading2,
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
} from 'lucide-react';
import { LanguageCode } from '../types';
import {
  NoteFolder,
  NoteFolderColor,
  NoteFolderIcon,
  NoteItem,
  countWords,
  useNotes,
} from '../hooks/useNotes';

interface NotesViewProps {
  isOpen: boolean;
  onClose: () => void;
  language?: LanguageCode;
}

type SystemFolderKey = 'all' | 'pinned' | 'with_images' | 'trash';

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

export const NotesView: React.FC<NotesViewProps> = ({
  isOpen,
  onClose,
  language = 'pt',
}) => {
  const isEs = language === 'es';
  const {
    notes,
    folders,
    saveState,
    createNote,
    updateNote,
    togglePinNote,
    softDeleteNote,
    restoreNote,
    permanentlyDeleteNote,
    emptyTrash,
    createFolder,
    deleteFolder,
    uploadNoteImage,
    flushPendingSaves,
  } = useNotes();

  const [selectedFolder, setSelectedFolder] = useState<SystemFolderKey | string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderIcon, setNewFolderIcon] = useState<NoteFolderIcon>('lightbulb');
  const [newFolderColor, setNewFolderColor] = useState<NoteFolderColor>('emerald');

  const [newCheckItemText, setNewCheckItemText] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeNote: NoteItem | null = useMemo(
    () => notes.find((n) => n.id === activeNoteId) || null,
    [notes, activeNoteId]
  );

  // Sync contentEditable innerHTML only when switching active note
  useEffect(() => {
    if (editorRef.current && activeNote) {
      if (editorRef.current.innerHTML !== activeNote.bodyHtml) {
        editorRef.current.innerHTML = activeNote.bodyHtml || '';
      }
    }
  }, [activeNoteId]);

  useEffect(() => {
    if (!isOpen) {
      void flushPendingSaves();
      setActiveNoteId(null);
      setPreviewImageUrl(null);
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
      selectedFolder === 'trash'
        ? trashedNotes
        : selectedFolder === 'pinned'
        ? activeNotes.filter((n) => n.pinned)
        : selectedFolder === 'with_images'
        ? activeNotes.filter((n) => (n.images || []).length > 0)
        : selectedFolder === 'all'
        ? activeNotes
        : activeNotes.filter((n) => n.folderId === selectedFolder);

    if (q) {
      base = base.filter((n) => {
        const folderName = n.folderId ? folderNameMap[n.folderId]?.name || '' : '';
        const checklistText = (n.checklist || []).map((c) => c.text).join(' ');
        const haystack = `${n.title} ${n.plainText} ${folderName} ${checklistText}`.toLowerCase();
        return haystack.includes(q);
      });
    }

    return [...base].sort((a, b) => {
      if (selectedFolder !== 'trash' && a.pinned !== b.pinned) {
        return a.pinned ? -1 : 1;
      }
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }, [activeNotes, trashedNotes, selectedFolder, searchQuery, folderNameMap]);

  const handleCreateNote = async () => {
    const targetFolderId =
      selectedFolder === 'all' ||
      selectedFolder === 'pinned' ||
      selectedFolder === 'with_images' ||
      selectedFolder === 'trash'
        ? null
        : selectedFolder;
    const created = await createNote(targetFolderId);
    setActiveNoteId(created.id);
  };

  const handleCloseEditor = async () => {
    await flushPendingSaves();
    setActiveNoteId(null);
  };

  const applyFormat = (cmd: string, value?: string) => {
    if (!editorRef.current || !activeNote) return;
    editorRef.current.focus();
    try {
      document.execCommand(cmd, false, value);
      updateNote(activeNote.id, { bodyHtml: editorRef.current.innerHTML });
    } catch {
      // ignore unsupported formatting command
    }
  };

  const handleAddChecklistItem = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!activeNote) return;
    const text = newCheckItemText.trim();
    if (!text) return;
    const nextItem = {
      id: `nchk_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      text,
      checked: false,
    };
    updateNote(activeNote.id, { checklist: [...(activeNote.checklist || []), nextItem] }, true);
    setNewCheckItemText('');
  };

  const handleToggleChecklistItem = (itemId: string) => {
    if (!activeNote) return;
    const next = (activeNote.checklist || []).map((it) =>
      it.id === itemId ? { ...it, checked: !it.checked } : it
    );
    updateNote(activeNote.id, { checklist: next }, true);
  };

  const handleDeleteChecklistItem = (itemId: string) => {
    if (!activeNote) return;
    const next = (activeNote.checklist || []).filter((it) => it.id !== itemId);
    updateNote(activeNote.id, { checklist: next }, true);
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
        headers: [...tbl.headers, `${isEs ? 'Col' : 'Col'} ${tbl.headers.length + 1}`],
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

  const handleImageFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !activeNote) return;
    setIsUploadingImage(true);
    try {
      const attachment = await uploadNoteImage(activeNote.id, file);
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
    setSelectedFolder(created.id);
  };

  if (typeof document === 'undefined') return null;

  const activeWordCount = activeNote
    ? countWords(
        `${activeNote.title} ${activeNote.plainText} ${(activeNote.checklist || [])
          .map((c) => c.text)
          .join(' ')}`
      )
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
          className="fixed inset-0 z-[58] flex flex-col bg-[#F4F8F6] text-slate-900 overflow-hidden"
        >
          <AnimatePresence mode="wait" initial={false}>
            {!activeNote ? (
              /* LIBRARY & FOLDERS VIEW */
              <motion.div
                key="notes-library"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="flex h-full flex-col overflow-hidden"
              >
                {/* Header */}
                <div
                  className="flex items-center justify-between gap-2 border-b border-emerald-100/90 bg-white/95 px-3.5 py-3 backdrop-blur-md shrink-0"
                  style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}
                >
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
                        {isEs ? 'Notas SisFinz' : 'Notas SisFinz'}
                      </h1>
                      <p className="truncate text-[9.5px] font-bold uppercase tracking-wider text-emerald-700">
                        {activeNotes.length}{' '}
                        {activeNotes.length === 1
                          ? isEs
                            ? 'nota'
                            : 'nota'
                          : isEs
                          ? 'notas'
                          : 'notas'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsFolderModalOpen(true)}
                    className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-[11px] font-black text-emerald-800 hover:bg-emerald-100 transition-colors cursor-pointer shrink-0"
                  >
                    <FolderPlus className="h-3.5 w-3.5 text-emerald-600" />
                    <span>{isEs ? 'Carpeta' : 'Pasta'}</span>
                  </button>
                </div>

                {/* Scrollable Library Content */}
                <div className="flex-1 overflow-y-auto px-3.5 py-4">
                  <div className="mx-auto max-w-2xl space-y-5 pb-24">
                    {/* Smart Search Bar */}
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
                        className="w-full rounded-2xl border border-slate-200/90 bg-white py-3 pl-10 pr-9 text-xs font-bold text-slate-900 placeholder:text-slate-400 shadow-2xs outline-none focus:border-emerald-500"
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

                    {/* Folders Grid */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                          {isEs ? 'Carpetas' : 'Pastas'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {(
                          [
                            {
                              id: 'all',
                              label: isEs ? 'Todas las notas' : 'Todas as notas',
                              count: activeNotes.length,
                              icon: FileText,
                              tone: 'text-emerald-700 bg-emerald-50 border-emerald-200',
                            },
                            {
                              id: 'pinned',
                              label: isEs ? 'Fijadas' : 'Fixadas',
                              count: pinnedCount,
                              icon: Pin,
                              tone: 'text-amber-700 bg-amber-50 border-amber-200',
                            },
                            {
                              id: 'with_images',
                              label: isEs ? 'Con imágenes' : 'Com imagens',
                              count: withImagesCount,
                              icon: ImageIcon,
                              tone: 'text-sky-700 bg-sky-50 border-sky-200',
                            },
                            {
                              id: 'trash',
                              label: isEs ? 'Eliminadas' : 'Apagadas',
                              count: trashedNotes.length,
                              icon: Trash2,
                              tone: 'text-rose-700 bg-rose-50 border-rose-200',
                            },
                          ] as const
                        ).map((sys) => {
                          const Icon = sys.icon;
                          const active = selectedFolder === sys.id;
                          return (
                            <motion.button
                              key={sys.id}
                              type="button"
                              whileTap={{ scale: 0.97 }}
                              onClick={() => setSelectedFolder(sys.id)}
                              className={`flex flex-col justify-between gap-2 rounded-2xl border p-3 text-left transition-all cursor-pointer ${
                                active
                                  ? 'border-emerald-500 bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                                  : 'border-slate-200/80 bg-white hover:border-emerald-300 shadow-2xs'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span
                                  className={`flex h-7 w-7 items-center justify-center rounded-xl border ${
                                    active
                                      ? 'border-white/25 bg-white/20 text-white'
                                      : sys.tone
                                  }`}
                                >
                                  <Icon className="h-3.5 w-3.5" />
                                </span>
                                <span
                                  className={`font-mono text-xs font-black ${
                                    active ? 'text-white' : 'text-slate-900'
                                  }`}
                                >
                                  {sys.count}
                                </span>
                              </div>
                              <span
                                className={`truncate text-[11px] font-black ${
                                  active ? 'text-white' : 'text-slate-800'
                                }`}
                              >
                                {sys.label}
                              </span>
                            </motion.button>
                          );
                        })}
                      </div>

                      {/* Custom Folders Row */}
                      {folders.length > 0 && (
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
                          {folders.map((fld) => {
                            const palette = FOLDER_COLORS[fld.color] || FOLDER_COLORS.emerald;
                            const count = activeNotes.filter((n) => n.folderId === fld.id).length;
                            const active = selectedFolder === fld.id;
                            return (
                              <div
                                key={fld.id}
                                className={`inline-flex items-center gap-1.5 rounded-2xl border pl-3 pr-1.5 py-1.5 transition-all shrink-0 ${
                                  active
                                    ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                                    : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => setSelectedFolder(fld.id)}
                                  className="inline-flex items-center gap-1.5 text-xs font-black cursor-pointer"
                                >
                                  <span
                                    className={`flex h-5 w-5 items-center justify-center rounded-lg ${
                                      active ? 'bg-white/20 text-white' : `${palette.bg} ${palette.text}`
                                    }`}
                                  >
                                    {renderFolderIcon(fld.icon, 'h-3 w-3')}
                                  </span>
                                  <span>{fld.name}</span>
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
                                  onClick={() => {
                                    if (selectedFolder === fld.id) setSelectedFolder('all');
                                    void deleteFolder(fld.id);
                                  }}
                                  className={`rounded-lg p-1 transition-colors cursor-pointer ${
                                    active
                                      ? 'text-white/75 hover:bg-white/15'
                                      : 'text-slate-300 hover:text-rose-500'
                                  }`}
                                  aria-label="Excluir pasta"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Notes List Section */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                          {selectedFolder === 'trash'
                            ? isEs
                              ? 'Papelera'
                              : 'Lixeira'
                            : isEs
                            ? 'Notas recientes'
                            : 'Notas recentes'}
                        </span>
                        {selectedFolder === 'trash' && trashedNotes.length > 0 && (
                          <button
                            type="button"
                            onClick={() => void emptyTrash()}
                            className="text-[10.5px] font-black text-rose-600 hover:underline cursor-pointer"
                          >
                            {isEs ? 'Vaciar papelera' : 'Esvaziar lixeira'}
                          </button>
                        )}
                      </div>

                      {filteredNotes.length === 0 ? (
                        <div className="rounded-3xl border border-dashed border-emerald-200 bg-white/80 p-8 text-center space-y-2">
                          <StickyNote className="mx-auto h-7 w-7 text-emerald-500" />
                          <div className="text-xs font-black text-slate-800">
                            {selectedFolder === 'trash'
                              ? isEs
                                ? 'La papelera está vacía.'
                                : 'A lixeira está vazia.'
                              : isEs
                              ? 'Aún no hay notas aquí.'
                              : 'Nenhuma nota por aqui ainda.'}
                          </div>
                          {selectedFolder !== 'trash' && (
                            <button
                              type="button"
                              onClick={handleCreateNote}
                              className="mt-1 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-[11px] font-black text-white shadow-sm hover:bg-emerald-700 cursor-pointer"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              {isEs ? 'Crear primera nota' : 'Criar primeira nota'}
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <AnimatePresence initial={false} mode="popLayout">
                            {filteredNotes.map((note) => {
                              const folder = note.folderId ? folderNameMap[note.folderId] : null;
                              const checkTotal = (note.checklist || []).length;
                              const checkDone = (note.checklist || []).filter((c) => c.checked).length;
                              const imgCount = (note.images || []).length;
                              const isTrashed = Boolean(note.deletedAt);

                              return (
                                <motion.div
                                  key={note.id}
                                  layout
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.96 }}
                                  transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                                  onClick={() => setActiveNoteId(note.id)}
                                  className={`group rounded-2xl border p-3.5 transition-all cursor-pointer ${
                                    note.pinned
                                      ? 'border-emerald-300 bg-gradient-to-r from-emerald-50/60 via-white to-white shadow-xs'
                                      : 'border-slate-200/80 bg-white hover:border-emerald-300 shadow-2xs'
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1 space-y-1">
                                      <div className="flex items-center gap-1.5">
                                        {note.pinned && (
                                          <Pin className="h-3.5 w-3.5 shrink-0 fill-emerald-600 text-emerald-600" />
                                        )}
                                        <h3 className="truncate text-sm font-black text-slate-900">
                                          {note.title || (isEs ? 'Nota sin título' : 'Nota sem título')}
                                        </h3>
                                      </div>

                                      <p className="line-clamp-2 text-xs font-medium text-slate-500">
                                        {note.plainText ||
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
                                              FOLDER_COLORS[folder.color]?.text || 'text-emerald-700'
                                            } ${
                                              FOLDER_COLORS[folder.color]?.border || 'border-emerald-200'
                                            }`}
                                          >
                                            {renderFolderIcon(folder.icon, 'h-2.5 w-2.5')}
                                            {folder.name}
                                          </span>
                                        )}

                                        {checkTotal > 0 && (
                                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[9.5px] font-bold text-slate-600">
                                            <CheckSquare className="h-2.5 w-2.5 text-emerald-600" />
                                            {checkDone}/{checkTotal}
                                          </span>
                                        )}

                                        {imgCount > 0 && (
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
                                            title={isEs ? 'Eliminar definitivamente' : 'Excluir definitivamente'}
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
                    </div>
                  </div>
                </div>

                {/* Floating + New Note Button */}
                {selectedFolder !== 'trash' && (
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
            ) : (
              /* FULL-SCREEN RICH EDITOR */
              <motion.div
                key={`note-editor-${activeNote.id}`}
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 360, damping: 30 }}
                className="flex h-full flex-col bg-white overflow-hidden"
              >
                {/* Editor Top Bar */}
                <div
                  className="flex items-center justify-between gap-2 border-b border-slate-100 bg-white/95 px-3.5 py-2.5 backdrop-blur-md shrink-0"
                  style={{ paddingTop: 'max(0.65rem, env(safe-area-inset-top, 0px))' }}
                >
                  <button
                    type="button"
                    onClick={handleCloseEditor}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 cursor-pointer shrink-0"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    {isEs ? 'Notas' : 'Notas'}
                  </button>

                  {/* Auto-save indicator */}
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50/80 px-2.5 py-1 text-[10px] font-black text-emerald-700">
                    {saveState === 'saving' ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>{isEs ? 'Guardando...' : 'Salvando...'}</span>
                      </>
                    ) : (
                      <>
                        <Cloud className="h-3 w-3" />
                        <span>{isEs ? 'Guardado' : 'Salvo'}</span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Folder Selector */}
                    <select
                      value={activeNote.folderId || ''}
                      onChange={(e) =>
                        updateNote(activeNote.id, { folderId: e.target.value || null }, true)
                      }
                      className="max-w-[115px] rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 text-[10.5px] font-black text-slate-700 outline-none"
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
                        <button
                          type="button"
                          onClick={() => {
                            softDeleteNote(activeNote.id);
                            setActiveNoteId(null);
                          }}
                          className="rounded-xl bg-slate-100 p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                          aria-label="Apagar nota"
                        >
                          <Trash2 className="h-4 w-4" />
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
                  </div>
                </div>

                {/* Rich Formatting Toolbar */}
                {!activeNote.deletedAt && (
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar border-b border-slate-100 bg-slate-50/75 px-3 py-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => applyFormat('bold')}
                      className="rounded-xl bg-white border border-slate-200 p-2 text-slate-700 hover:border-emerald-400 hover:text-emerald-700 cursor-pointer shrink-0"
                      title="Negrito"
                    >
                      <Bold className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormat('italic')}
                      className="rounded-xl bg-white border border-slate-200 p-2 text-slate-700 hover:border-emerald-400 hover:text-emerald-700 cursor-pointer shrink-0"
                      title="Itálico"
                    >
                      <Italic className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormat('formatBlock', 'h3')}
                      className="rounded-xl bg-white border border-slate-200 p-2 text-slate-700 hover:border-emerald-400 hover:text-emerald-700 cursor-pointer shrink-0"
                      title="Subtítulo"
                    >
                      <Heading2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormat('insertUnorderedList')}
                      className="rounded-xl bg-white border border-slate-200 p-2 text-slate-700 hover:border-emerald-400 hover:text-emerald-700 cursor-pointer shrink-0"
                      title="Marcadores"
                    >
                      <List className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormat('insertOrderedList')}
                      className="rounded-xl bg-white border border-slate-200 p-2 text-slate-700 hover:border-emerald-400 hover:text-emerald-700 cursor-pointer shrink-0"
                      title="Lista numerada"
                    >
                      <ListOrdered className="h-3.5 w-3.5" />
                    </button>

                    <div className="mx-1 h-5 w-px bg-slate-200 shrink-0" />

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingImage}
                      className="inline-flex items-center gap-1 rounded-xl bg-white border border-slate-200 px-2.5 py-1.5 text-[11px] font-black text-slate-700 hover:border-emerald-400 hover:text-emerald-700 cursor-pointer shrink-0"
                    >
                      {isUploadingImage ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
                      ) : (
                        <ImageIcon className="h-3.5 w-3.5 text-emerald-600" />
                      )}
                      <span>{isEs ? 'Imagen' : 'Imagem'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleAddTable}
                      className="inline-flex items-center gap-1 rounded-xl bg-white border border-slate-200 px-2.5 py-1.5 text-[11px] font-black text-slate-700 hover:border-emerald-400 hover:text-emerald-700 cursor-pointer shrink-0"
                    >
                      <TableIcon className="h-3.5 w-3.5 text-emerald-600" />
                      <span>{isEs ? 'Tabla' : 'Tabela'}</span>
                    </button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageFileSelect}
                      className="hidden"
                    />
                  </div>
                )}

                {/* Full-Screen Scrollable Editor Canvas */}
                <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
                  <div className="mx-auto max-w-2xl space-y-5 pb-20">
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

                    {/* Title */}
                    <input
                      type="text"
                      value={activeNote.title}
                      readOnly={Boolean(activeNote.deletedAt)}
                      onChange={(e) => updateNote(activeNote.id, { title: e.target.value })}
                      placeholder={isEs ? 'Título de la nota...' : 'Título da nota...'}
                      className="w-full bg-transparent text-2xl font-black tracking-tight text-slate-900 placeholder:text-slate-300 outline-none"
                    />

                    {/* Rich Text Body */}
                    <div
                      ref={editorRef}
                      contentEditable={!activeNote.deletedAt}
                      suppressContentEditableWarning
                      onInput={(e) =>
                        updateNote(activeNote.id, {
                          bodyHtml: (e.currentTarget as HTMLDivElement).innerHTML,
                        })
                      }
                      data-placeholder={
                        isEs
                          ? 'Empieza a escribir tus ideas, planes o apuntes...'
                          : 'Comece a escrever suas ideias, anotações ou planos...'
                      }
                      className="min-h-[160px] text-sm leading-relaxed text-slate-800 outline-none [&_h3]:text-base [&_h3]:font-black [&_h3]:mt-3 [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 empty:before:content-[attr(data-placeholder)] empty:before:text-slate-300"
                    />

                    {/* Interactive Checklist Inside Note */}
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/35 p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 text-[10.5px] font-black uppercase tracking-wider text-emerald-800">
                          <CheckSquare className="h-3.5 w-3.5 text-emerald-600" />
                          {isEs ? 'Lista de verificación' : 'Checklist da nota'}
                        </span>
                        {(activeNote.checklist || []).length > 0 && (
                          <span className="font-mono text-[10px] font-black text-emerald-700">
                            {(activeNote.checklist || []).filter((c) => c.checked).length}/
                            {(activeNote.checklist || []).length}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <AnimatePresence initial={false}>
                          {(activeNote.checklist || []).map((item) => (
                            <motion.div
                              key={item.id}
                              layout
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              className="flex items-center justify-between gap-2 rounded-xl bg-white border border-slate-200/80 px-3 py-2"
                            >
                              <button
                                type="button"
                                onClick={() => handleToggleChecklistItem(item.id)}
                                className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                              >
                                <motion.span
                                  animate={{ scale: item.checked ? [1, 1.18, 1] : 1 }}
                                  transition={{ duration: 0.2 }}
                                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                                    item.checked
                                      ? 'border-emerald-600 bg-emerald-600 text-white'
                                      : 'border-slate-300 bg-white text-transparent'
                                  }`}
                                >
                                  <Check className="h-3 w-3 stroke-[3]" />
                                </motion.span>
                                <span
                                  className={`truncate text-xs font-bold transition-all ${
                                    item.checked ? 'text-slate-400 line-through' : 'text-slate-800'
                                  }`}
                                >
                                  {item.text}
                                </span>
                              </button>
                              {!activeNote.deletedAt && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteChecklistItem(item.id)}
                                  className="rounded-lg p-1 text-slate-300 hover:text-rose-500 cursor-pointer"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>

                      {!activeNote.deletedAt && (
                        <form onSubmit={handleAddChecklistItem} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={newCheckItemText}
                            onChange={(e) => setNewCheckItemText(e.target.value)}
                            placeholder={
                              isEs ? 'Agregar ítem al checklist...' : 'Adicionar item ao checklist...'
                            }
                            className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 placeholder:text-slate-400 outline-none focus:border-emerald-500"
                          />
                          <button
                            type="submit"
                            disabled={!newCheckItemText.trim()}
                            className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white disabled:opacity-40 cursor-pointer"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </form>
                      )}
                    </div>

                    {/* Simple Tables Inside Note */}
                    {(activeNote.tables || []).length > 0 && (
                      <div className="space-y-3">
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
                                      + {isEs ? 'Col' : 'Col'}
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

                    {/* Images Attachments Grid */}
                    {(activeNote.images || []).length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          {isEs ? 'Imágenes adjuntas' : 'Imagens anexadas'}
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
                                onClick={() => setPreviewImageUrl(img.url)}
                                className="h-full w-full object-cover cursor-pointer"
                              />
                              {!activeNote.deletedAt && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveImage(img.id)}
                                  className="absolute right-1.5 top-1.5 rounded-lg bg-slate-900/70 p-1 text-white hover:bg-rose-600 cursor-pointer"
                                  aria-label="Remover imagem"
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

          {/* Create Folder Modal */}
          <AnimatePresence>
            {isFolderModalOpen && (
              <div className="fixed inset-0 z-[75] flex items-end sm:items-center justify-center p-0 sm:p-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsFolderModalOpen(false)}
                  className="absolute inset-0 bg-slate-900/45 backdrop-blur-xs"
                />
                <motion.form
                  initial={{ opacity: 0, y: 28 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 28 }}
                  onSubmit={handleCreateFolderSubmit}
                  className="relative z-10 w-full max-w-sm rounded-t-[2rem] sm:rounded-[2rem] bg-white p-5 shadow-2xl space-y-4"
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

          {/* Image Lightbox */}
          <AnimatePresence>
            {previewImageUrl && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setPreviewImageUrl(null)}
                className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/85 p-4"
              >
                <img
                  src={previewImageUrl}
                  alt="Preview"
                  className="max-h-[88dvh] max-w-full rounded-2xl object-contain shadow-2xl"
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
