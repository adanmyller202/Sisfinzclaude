import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Highlighter,
  Palette,
  Heading1,
  Heading2,
  Heading3,
  Type,
  Quote,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  CheckSquare,
  Check,
  Link2,
  Image as ImageIcon,
  Table as TableIcon,
  PenTool,
  ScanLine,
  Mic,
  MicOff,
  Loader2,
  ArrowUp,
  ArrowDown,
  Undo2,
  Redo2,
  Plus,
  ChevronDown,
  ArrowDownWideNarrow,
  X,
} from 'lucide-react';
import { LanguageCode } from '../types';
import {
  NoteBlock,
  NoteBlockType,
  NoteTextAlign,
  createBlockId,
  htmlToPlainText,
} from '../hooks/useNotes';

interface SmartNoteEditorProps {
  noteId: string;
  blocks: NoteBlock[];
  readOnly?: boolean;
  isReadingMode?: boolean;
  searchQuery?: string;
  language?: LanguageCode;
  isUploadingImage?: boolean;
  isDictating?: boolean;
  onChangeBlocks: (nextBlocks: NoteBlock[], immediate?: boolean) => void;
  onTriggerImageUpload: () => void;
  onTriggerScanUpload: () => void;
  onOpenDrawing: () => void;
  onAddTable: () => void;
  onToggleDictation: () => void;
}

type ExpandPanel = 'none' | 'structure' | 'color' | 'insert';

const TEXT_COLORS = [
  { label: 'Padrão', value: '#0f172a' },
  { label: 'Esmeralda', value: '#047857' },
  { label: 'Azul', value: '#0369a1' },
  { label: 'Âmbar', value: '#b45309' },
  { label: 'Roxo', value: '#6d28d9' },
  { label: 'Rosa', value: '#be123c' },
];

const HIGHLIGHT_COLORS = [
  { label: 'Sem destaque', value: 'transparent' },
  { label: 'Menta', value: '#d1fae5' },
  { label: 'Amarelo', value: '#fef08a' },
  { label: 'Céu', value: '#e0f2fe' },
  { label: 'Pêssego', value: '#ffedd5' },
  { label: 'Rosa', value: '#ffe4e6' },
];

function cloneBlocks(blocks: NoteBlock[]): NoteBlock[] {
  return blocks.map((b) => ({ ...b }));
}

function focusElementAt(el: HTMLElement | null, position: 'start' | 'end' = 'end') {
  if (!el) return;
  el.focus({ preventScroll: false });
  try {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(position === 'start');
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  } catch {
    // ignore selection errors
  }
}

function isCaretAtStart(el: HTMLElement): boolean {
  try {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;
    const range = sel.getRangeAt(0);
    if (!range.collapsed) return false;
    const preRange = range.cloneRange();
    preRange.selectNodeContents(el);
    preRange.setEnd(range.startContainer, range.startOffset);
    return preRange.toString().length === 0;
  } catch {
    return false;
  }
}

function splitHtmlAtCaret(el: HTMLElement): { beforeHtml: string; afterHtml: string } | null {
  try {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (!el.contains(range.startContainer)) return null;

    const beforeRange = document.createRange();
    beforeRange.selectNodeContents(el);
    beforeRange.setEnd(range.startContainer, range.startOffset);

    const afterRange = document.createRange();
    afterRange.selectNodeContents(el);
    afterRange.setStart(range.endContainer, range.endOffset);

    const beforeDiv = document.createElement('div');
    beforeDiv.appendChild(beforeRange.cloneContents());
    const afterDiv = document.createElement('div');
    afterDiv.appendChild(afterRange.cloneContents());

    return {
      beforeHtml: beforeDiv.innerHTML,
      afterHtml: afterDiv.innerHTML,
    };
  } catch {
    return null;
  }
}

interface EditableBlockRowProps {
  block: NoteBlock;
  index: number;
  totalBlocks: number;
  numberIndex: number;
  isFocused: boolean;
  isMatchedBySearch: boolean;
  readOnly: boolean;
  isReadingMode: boolean;
  isEs: boolean;
  reduceMotion: boolean;
  registerEl: (id: string, el: HTMLDivElement | null) => void;
  onFocusBlock: (id: string) => void;
  onHtmlChange: (id: string, html: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>, block: NoteBlock, index: number) => void;
  onToggleCheck: (id: string) => void;
  onMoveBlock: (index: number, delta: -1 | 1) => void;
  onRemoveBlock: (id: string) => void;
}

const EditableBlockRow: React.FC<EditableBlockRowProps> = ({
  block,
  index,
  totalBlocks,
  numberIndex,
  isFocused,
  isMatchedBySearch,
  readOnly,
  isReadingMode,
  isEs,
  reduceMotion,
  registerEl,
  onFocusBlock,
  onHtmlChange,
  onKeyDown,
  onToggleCheck,
  onMoveBlock,
  onRemoveBlock,
}) => {
  const localRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = localRef.current;
    if (!el) return;
    if (el.innerHTML !== block.html && document.activeElement !== el) {
      el.innerHTML = block.html;
    }
  }, [block.html]);

  useEffect(() => {
    const el = localRef.current;
    if (el && el.innerHTML !== block.html) {
      el.innerHTML = block.html;
    }
  }, [block.id]);

  const setRef = (node: HTMLDivElement | null) => {
    localRef.current = node;
    registerEl(block.id, node);
  };

  const isChecked = block.type === 'checklist' && Boolean(block.checked);
  const effectiveReadOnly = readOnly || isReadingMode;

  const alignClass =
    block.align === 'center'
      ? 'text-center'
      : block.align === 'right'
      ? 'text-right'
      : 'text-left';

  // Minimum 16px font-size on mobile prevents iOS Safari automatic zoom on focus!
  const textStyleClass =
    block.type === 'heading'
      ? 'text-[22px] sm:text-[24px] font-black tracking-tight text-slate-900 leading-[1.3] mt-3 mb-1'
      : block.type === 'subheading'
      ? 'text-[18.5px] sm:text-[19px] font-extrabold tracking-tight text-emerald-950 leading-[1.35] mt-2.5 mb-0.5'
      : block.type === 'heading3'
      ? 'text-[16.5px] sm:text-[17px] font-extrabold text-slate-800 leading-[1.4] mt-2'
      : block.type === 'quote'
      ? 'text-[16px] italic font-medium text-slate-600 leading-[1.65]'
      : 'text-[16px] font-normal text-slate-800 leading-[1.68]';

  const placeholderText = effectiveReadOnly
    ? ''
    : block.type === 'checklist'
    ? isEs
      ? 'Tarea...'
      : 'Item do checklist...'
    : block.type === 'bullet' || block.type === 'numbered'
    ? isEs
      ? 'Elemento de lista...'
      : 'Item da lista...'
    : block.type === 'heading'
    ? isEs
      ? 'Título principal...'
      : 'Título principal...'
    : block.type === 'subheading'
    ? isEs
      ? 'Subtítulo...'
      : 'Subtítulo...'
    : block.type === 'heading3'
    ? isEs
      ? 'Sección...'
      : 'Seção...'
    : block.type === 'quote'
    ? isEs
      ? 'Cita o nota destacada...'
      : 'Citação ou destaque...'
    : index === 0
    ? isEs
      ? 'Empieza a escribir aquí...'
      : 'Comece a escrever aqui...'
    : '';

  return (
    <motion.div
      layout={!reduceMotion ? 'position' : false}
      initial={reduceMotion ? false : { opacity: 0, y: 3 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, height: 0 }}
      transition={{ duration: 0.15 }}
      className={`group relative flex items-start gap-2.5 w-full min-w-0 max-w-full rounded-xl px-1 py-0.5 transition-colors ${
        block.type === 'quote'
          ? 'border-l-[3px] border-emerald-500/75 bg-emerald-50/35 pl-3.5 pr-2 py-2 my-1 rounded-l-none rounded-r-xl'
          : ''
      } ${isMatchedBySearch ? 'bg-amber-100/70 ring-1 ring-amber-300/80' : ''}`}
    >
      {/* Interactive Checklist Checkbox */}
      {block.type === 'checklist' && (
        <motion.button
          type="button"
          disabled={readOnly}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onToggleCheck(block.id)}
          whileTap={reduceMotion ? undefined : { scale: 0.85 }}
          animate={
            reduceMotion
              ? undefined
              : isChecked
              ? { scale: [1, 1.15, 1] }
              : { scale: 1 }
          }
          transition={{ type: 'spring', stiffness: 480, damping: 24 }}
          aria-label={isChecked ? 'Desmarcar item' : 'Marcar item como concluído'}
          aria-pressed={isChecked}
          className={`mt-[4px] flex h-[21px] w-[21px] shrink-0 items-center justify-center rounded-[7px] border-2 transition-colors cursor-pointer select-none touch-manipulation ${
            isChecked
              ? 'border-emerald-600 bg-emerald-600 text-white shadow-2xs'
              : 'border-emerald-400/90 bg-white text-transparent hover:border-emerald-600'
          }`}
        >
          <motion.span
            initial={false}
            animate={{
              scale: isChecked ? 1 : 0.3,
              opacity: isChecked ? 1 : 0,
            }}
            transition={{ type: 'spring', stiffness: 520, damping: 26 }}
          >
            <Check className="h-3.5 w-3.5 stroke-[3.2]" />
          </motion.span>
        </motion.button>
      )}

      {block.type === 'bullet' && (
        <span className="mt-[11px] h-[7px] w-[7px] shrink-0 rounded-full bg-emerald-600/90" />
      )}

      {block.type === 'numbered' && (
        <span className="mt-[2px] min-w-[22px] shrink-0 font-mono text-[14px] font-bold text-emerald-700 text-right select-none leading-[1.68]">
          {numberIndex}.
        </span>
      )}

      {/* Fluid Editable Line */}
      <div className="relative min-w-0 flex-1 max-w-full">
        <div
          ref={setRef}
          contentEditable={!effectiveReadOnly}
          suppressContentEditableWarning
          onFocus={() => onFocusBlock(block.id)}
          onInput={(e) => {
            const html = (e.currentTarget as HTMLDivElement).innerHTML;
            onHtmlChange(block.id, html);
          }}
          onKeyDown={(e) => onKeyDown(e, block, index)}
          data-placeholder={placeholderText}
          className={`min-h-[27px] w-full max-w-full break-words [overflow-wrap:anywhere] outline-none transition-colors [&_a]:text-emerald-700 [&_a]:underline [&_a]:font-semibold empty:before:content-[attr(data-placeholder)] empty:before:text-slate-300 empty:before:pointer-events-none ${alignClass} ${textStyleClass} ${
            isChecked ? 'text-slate-400' : ''
          }`}
        />

        {/* Smooth animated strike-through on completed checklist item */}
        {block.type === 'checklist' && (
          <motion.span
            aria-hidden="true"
            initial={false}
            animate={{
              scaleX: isChecked ? 1 : 0,
              opacity: isChecked ? 0.65 : 0,
            }}
            transition={{ duration: reduceMotion ? 0.01 : 0.24, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: 'left center' }}
            className="pointer-events-none absolute left-0 right-1 top-[14px] h-[1.6px] rounded-full bg-emerald-600/75"
          />
        )}
      </div>

      {/* Subtle Reorder & Remove Controls (hidden in Reading Mode) */}
      {!effectiveReadOnly &&
        (block.type === 'checklist' || block.type === 'bullet' || block.type === 'numbered') &&
        isFocused && (
          <div className="flex items-center gap-0.5 shrink-0 pt-1">
            {index > 0 && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onMoveBlock(index, -1)}
                className="rounded-lg p-1 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer touch-manipulation"
                title={isEs ? 'Subir' : 'Mover para cima'}
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
            )}
            {index < totalBlocks - 1 && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onMoveBlock(index, 1)}
                className="rounded-lg p-1 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer touch-manipulation"
                title={isEs ? 'Bajar' : 'Mover para baixo'}
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onRemoveBlock(block.id)}
              className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-500 cursor-pointer touch-manipulation"
              title={isEs ? 'Eliminar línea' : 'Excluir item'}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
    </motion.div>
  );
};

export const SmartNoteEditor: React.FC<SmartNoteEditorProps> = ({
  noteId,
  blocks,
  readOnly = false,
  isReadingMode = false,
  searchQuery = '',
  language = 'pt',
  isUploadingImage = false,
  isDictating = false,
  onChangeBlocks,
  onTriggerImageUpload,
  onTriggerScanUpload,
  onOpenDrawing,
  onAddTable,
  onToggleDictation,
}) => {
  const isEs = language === 'es';
  const reduceMotion = Boolean(useReducedMotion());
  const effectiveReadOnly = readOnly || isReadingMode;

  const safeBlocks: NoteBlock[] =
    blocks.length > 0 ? blocks : [{ id: createBlockId(), type: 'paragraph', html: '' }];

  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(safeBlocks[0]?.id || null);
  const [openPanel, setOpenPanel] = useState<ExpandPanel>('none');
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [linkUrlInput, setLinkUrlInput] = useState('');
  const [linkTextInput, setLinkTextInput] = useState('');

  // Active inline format states
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
  });

  // Floating selection toolbar state
  const [floatingBar, setFloatingBar] = useState<{
    visible: boolean;
    top: number;
    left: number;
    showColors: boolean;
  }>({ visible: false, top: 0, left: 0, showColors: false });

  // Undo / Redo stacks scoped per noteId
  const pastRef = useRef<NoteBlock[][]>([]);
  const futureRef = useRef<NoteBlock[][]>([]);
  const lastHistoryPushAtRef = useRef<number>(0);
  const [historyCounts, setHistoryCounts] = useState({ past: 0, future: 0 });

  const editorRootRef = useRef<HTMLDivElement>(null);
  const blockElsRef = useRef<Record<string, HTMLDivElement | null>>({});
  const pendingFocusRef = useRef<{ id: string; position: 'start' | 'end' } | null>(null);

  // Reset undo/redo when switching notes
  useEffect(() => {
    pastRef.current = [];
    futureRef.current = [];
    setHistoryCounts({ past: 0, future: 0 });
    setOpenPanel('none');
    setIsLinkDialogOpen(false);
    setFloatingBar({ visible: false, top: 0, left: 0, showColors: false });
  }, [noteId]);

  const focusedBlock =
    safeBlocks.find((b) => b.id === focusedBlockId) || safeBlocks[safeBlocks.length - 1];

  useEffect(() => {
    const pending = pendingFocusRef.current;
    if (!pending) return;
    const el = blockElsRef.current[pending.id];
    if (el) {
      pendingFocusRef.current = null;
      requestAnimationFrame(() => {
        focusElementAt(el, pending.position);
      });
    }
  }, [safeBlocks]);

  const pushHistory = useCallback((snapshot: NoteBlock[], force = false) => {
    const now = Date.now();
    if (!force && now - lastHistoryPushAtRef.current < 900 && pastRef.current.length > 0) {
      return;
    }
    lastHistoryPushAtRef.current = now;
    pastRef.current = [...pastRef.current.slice(-39), cloneBlocks(snapshot)];
    futureRef.current = [];
    setHistoryCounts({ past: pastRef.current.length, future: 0 });
  }, []);

  const commitBlocks = useCallback(
    (nextBlocks: NoteBlock[], immediate = false, forceHistory = false) => {
      pushHistory(safeBlocks, forceHistory);
      onChangeBlocks(nextBlocks, immediate);
    },
    [safeBlocks, pushHistory, onChangeBlocks]
  );

  const handleUndo = useCallback(() => {
    if (effectiveReadOnly || pastRef.current.length === 0) return;
    const previous = pastRef.current[pastRef.current.length - 1];
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [...futureRef.current.slice(-39), cloneBlocks(safeBlocks)];
    setHistoryCounts({ past: pastRef.current.length, future: futureRef.current.length });
    onChangeBlocks(previous, true);
    // Sync DOM nodes immediately
    requestAnimationFrame(() => {
      for (const blk of previous) {
        const el = blockElsRef.current[blk.id];
        if (el && el.innerHTML !== blk.html) {
          el.innerHTML = blk.html;
        }
      }
    });
  }, [effectiveReadOnly, safeBlocks, onChangeBlocks]);

  const handleRedo = useCallback(() => {
    if (effectiveReadOnly || futureRef.current.length === 0) return;
    const next = futureRef.current[futureRef.current.length - 1];
    futureRef.current = futureRef.current.slice(0, -1);
    pastRef.current = [...pastRef.current.slice(-39), cloneBlocks(safeBlocks)];
    setHistoryCounts({ past: pastRef.current.length, future: futureRef.current.length });
    onChangeBlocks(next, true);
    requestAnimationFrame(() => {
      for (const blk of next) {
        const el = blockElsRef.current[blk.id];
        if (el && el.innerHTML !== blk.html) {
          el.innerHTML = blk.html;
        }
      }
    });
  }, [effectiveReadOnly, safeBlocks, onChangeBlocks]);

  // Global keyboard shortcuts for Undo/Redo inside editor
  useEffect(() => {
    if (effectiveReadOnly) return;
    const onGlobalKey = (e: KeyboardEvent) => {
      const root = editorRootRef.current;
      if (!root || !root.contains(document.activeElement)) return;
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;
      if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onGlobalKey);
    return () => window.removeEventListener('keydown', onGlobalKey);
  }, [effectiveReadOnly, handleUndo, handleRedo]);

  // Track text selection for active format states & Floating Contextual Toolbar
  const refreshSelectionUI = useCallback(() => {
    if (effectiveReadOnly) {
      setFloatingBar((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      return;
    }

    try {
      setActiveFormats({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strikeThrough: document.queryCommandState('strikeThrough'),
      });
    } catch {
      // ignore
    }

    const sel = window.getSelection();
    const root = editorRootRef.current;
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed || !root) {
      setFloatingBar((prev) => (prev.visible ? { ...prev, visible: false, showColors: false } : prev));
      return;
    }

    const text = sel.toString().trim();
    if (!text) {
      setFloatingBar((prev) => (prev.visible ? { ...prev, visible: false, showColors: false } : prev));
      return;
    }

    const range = sel.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer)) {
      setFloatingBar((prev) => (prev.visible ? { ...prev, visible: false, showColors: false } : prev));
      return;
    }

    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    const vw = window.innerWidth || 375;
    const barHalfWidth = 136;
    const rawLeft = rect.left + rect.width / 2;
    const clampedLeft = Math.max(barHalfWidth + 10, Math.min(vw - barHalfWidth - 10, rawLeft));
    const top = Math.max(64, rect.top - 52);

    setFloatingBar((prev) => ({
      visible: true,
      top,
      left: clampedLeft,
      showColors: prev.visible ? prev.showColors : false,
    }));
  }, [effectiveReadOnly]);

  useEffect(() => {
    document.addEventListener('selectionchange', refreshSelectionUI);
    return () => document.removeEventListener('selectionchange', refreshSelectionUI);
  }, [refreshSelectionUI]);

  const registerEl = (id: string, el: HTMLDivElement | null) => {
    blockElsRef.current[id] = el;
  };

  const handleHtmlChange = (id: string, html: string) => {
    const next = safeBlocks.map((b) => (b.id === id ? { ...b, html } : b));
    commitBlocks(next, false, false);
  };

  const handleToggleCheck = (id: string) => {
    if (readOnly) return;
    const next = safeBlocks.map((b) =>
      b.id === id ? { ...b, checked: !b.checked } : b
    );
    commitBlocks(next, true, true);
  };

  // Option to group completed checklist items at the bottom of each contiguous checklist
  const hasUnsortedCompletedChecklist = useMemo(() => {
    for (let i = 0; i < safeBlocks.length - 1; i++) {
      if (
        safeBlocks[i].type === 'checklist' &&
        safeBlocks[i].checked &&
        safeBlocks[i + 1].type === 'checklist' &&
        !safeBlocks[i + 1].checked
      ) {
        return true;
      }
    }
    return false;
  }, [safeBlocks]);

  const handleGroupCompletedAtBottom = () => {
    if (effectiveReadOnly) return;
    const next: NoteBlock[] = [];
    let i = 0;
    while (i < safeBlocks.length) {
      if (safeBlocks[i].type !== 'checklist') {
        next.push(safeBlocks[i]);
        i++;
        continue;
      }
      const run: NoteBlock[] = [];
      while (i < safeBlocks.length && safeBlocks[i].type === 'checklist') {
        run.push(safeBlocks[i]);
        i++;
      }
      const unchecked = run.filter((b) => !b.checked);
      const checked = run.filter((b) => b.checked);
      next.push(...unchecked, ...checked);
    }
    commitBlocks(next, true, true);
  };

  const handleSetBlockType = (targetType: NoteBlockType) => {
    if (effectiveReadOnly) return;
    const targetId = focusedBlock?.id || safeBlocks[0].id;
    const current = safeBlocks.find((b) => b.id === targetId);
    if (!current) return;

    const nextType: NoteBlockType =
      current.type === targetType && targetType !== 'paragraph' ? 'paragraph' : targetType;

    const next = safeBlocks.map((b) =>
      b.id === targetId
        ? {
            ...b,
            type: nextType,
            checked: nextType === 'checklist' ? Boolean(b.checked) : undefined,
          }
        : b
    );
    pendingFocusRef.current = { id: targetId, position: 'end' };
    setFocusedBlockId(targetId);
    commitBlocks(next, true, true);
  };

  const handleSetAlign = (align: NoteTextAlign) => {
    if (effectiveReadOnly) return;
    const targetId = focusedBlock?.id || safeBlocks[0].id;
    const next = safeBlocks.map((b) => (b.id === targetId ? { ...b, align } : b));
    commitBlocks(next, true, true);
  };

  const handleInlineFormat = (
    cmd: 'bold' | 'italic' | 'underline' | 'strikeThrough' | 'foreColor' | 'hiliteColor',
    value?: string
  ) => {
    if (effectiveReadOnly) return;
    const targetId = focusedBlock?.id;
    const el = targetId ? blockElsRef.current[targetId] : null;
    if (el && document.activeElement !== el) {
      el.focus();
    }
    try {
      if (cmd === 'hiliteColor') {
        const applied = document.execCommand('hiliteColor', false, value);
        if (!applied) document.execCommand('backColor', false, value);
      } else {
        document.execCommand(cmd, false, value);
      }
      if (targetId && el) {
        const next = safeBlocks.map((b) =>
          b.id === targetId ? { ...b, html: el.innerHTML } : b
        );
        commitBlocks(next, false, true);
      }
      refreshSelectionUI();
    } catch {
      // ignore unsupported command
    }
  };

  const handleInsertInlineLink = (e: React.FormEvent) => {
    e.preventDefault();
    const rawUrl = linkUrlInput.trim();
    if (!rawUrl || !focusedBlock) return;
    const normalized = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    const label = linkTextInput.trim() || rawUrl;
    const anchorHtml = `<a href="${normalized}" target="_blank" rel="noopener noreferrer">${label}</a>&nbsp;`;

    const el = blockElsRef.current[focusedBlock.id];
    const nextHtml = `${focusedBlock.html}${focusedBlock.html ? ' ' : ''}${anchorHtml}`;
    if (el) {
      el.innerHTML = nextHtml;
    }
    const next = safeBlocks.map((b) =>
      b.id === focusedBlock.id ? { ...b, html: nextHtml } : b
    );
    commitBlocks(next, true, true);
    setLinkUrlInput('');
    setLinkTextInput('');
    setIsLinkDialogOpen(false);
    setOpenPanel('none');
    pendingFocusRef.current = { id: focusedBlock.id, position: 'end' };
  };

  const handleMoveBlock = (index: number, delta: -1 | 1) => {
    const targetIdx = index + delta;
    if (targetIdx < 0 || targetIdx >= safeBlocks.length) return;
    const next = [...safeBlocks];
    const [moved] = next.splice(index, 1);
    next.splice(targetIdx, 0, moved);
    commitBlocks(next, true, true);
    setFocusedBlockId(moved.id);
  };

  const handleRemoveBlock = (id: string) => {
    if (safeBlocks.length <= 1) {
      const reset: NoteBlock[] = [{ id: safeBlocks[0].id, type: 'paragraph', html: '' }];
      commitBlocks(reset, true, true);
      pendingFocusRef.current = { id: safeBlocks[0].id, position: 'start' };
      return;
    }
    const idx = safeBlocks.findIndex((b) => b.id === id);
    const next = safeBlocks.filter((b) => b.id !== id);
    const focusTarget = next[Math.max(0, idx - 1)];
    if (focusTarget) {
      setFocusedBlockId(focusTarget.id);
      pendingFocusRef.current = { id: focusTarget.id, position: 'end' };
    }
    commitBlocks(next, true, true);
  };

  const handleBlockKeyDown = (
    e: React.KeyboardEvent<HTMLDivElement>,
    block: NoteBlock,
    index: number
  ) => {
    if (effectiveReadOnly) return;
    const el = e.currentTarget;
    const currentHtml = el.innerHTML;
    const plain = htmlToPlainText(currentHtml);

    // SMART ENTER
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();

      const isListMode =
        block.type === 'checklist' || block.type === 'bullet' || block.type === 'numbered';

      // Enter on an EMPTY list line exits list mode cleanly without deleting existing content
      if (isListMode && plain.length === 0) {
        const next = safeBlocks.map((b) =>
          b.id === block.id ? { ...b, type: 'paragraph' as NoteBlockType, checked: undefined } : b
        );
        pendingFocusRef.current = { id: block.id, position: 'start' };
        commitBlocks(next, true, true);
        return;
      }

      const split = splitHtmlAtCaret(el);
      const beforeHtml = split ? split.beforeHtml : currentHtml;
      const afterHtml = split ? split.afterHtml : '';

      if (el.innerHTML !== beforeHtml) {
        el.innerHTML = beforeHtml;
      }

      const newBlockType: NoteBlockType = isListMode ? block.type : 'paragraph';
      const newBlock: NoteBlock = {
        id: createBlockId(),
        type: newBlockType,
        html: afterHtml,
        checked: newBlockType === 'checklist' ? false : undefined,
        align: block.align,
      };

      const next = [...safeBlocks];
      next[index] = { ...block, html: beforeHtml };
      next.splice(index + 1, 0, newBlock);

      setFocusedBlockId(newBlock.id);
      pendingFocusRef.current = { id: newBlock.id, position: 'start' };
      commitBlocks(next, true, true);
      return;
    }

    // SMART BACKSPACE
    if (e.key === 'Backspace' && isCaretAtStart(el)) {
      if (block.type !== 'paragraph') {
        e.preventDefault();
        const next = safeBlocks.map((b) =>
          b.id === block.id ? { ...b, type: 'paragraph' as NoteBlockType, checked: undefined } : b
        );
        pendingFocusRef.current = { id: block.id, position: 'start' };
        commitBlocks(next, true, true);
        return;
      }

      if (index > 0) {
        e.preventDefault();
        const prev = safeBlocks[index - 1];
        const mergedHtml = `${prev.html}${currentHtml}`;
        const next = safeBlocks.filter((b) => b.id !== block.id);
        next[index - 1] = { ...prev, html: mergedHtml };

        const prevEl = blockElsRef.current[prev.id];
        if (prevEl) prevEl.innerHTML = mergedHtml;

        setFocusedBlockId(prev.id);
        pendingFocusRef.current = { id: prev.id, position: 'end' };
        commitBlocks(next, true, true);
      }
    }
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();
  let runningNumber = 0;

  return (
    <div ref={editorRootRef} className="flex flex-col w-full min-w-0 max-w-full">
      {/* Compact Sticky Grouped Formatting Toolbar (Hidden in Reading Mode) */}
      {!effectiveReadOnly && (
        <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 mb-4 border-y border-emerald-100/90 bg-white/95 backdrop-blur-md">
          {/* Primary Compact Row */}
          <div className="mx-auto flex max-w-2xl items-center gap-1 overflow-x-auto no-scrollbar px-3 py-1.5">
            {/* Undo / Redo */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleUndo}
              disabled={historyCounts.past === 0}
              className="rounded-xl p-2 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-30 cursor-pointer shrink-0 touch-manipulation"
              title={isEs ? 'Deshacer' : 'Desfazer'}
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleRedo}
              disabled={historyCounts.future === 0}
              className="rounded-xl p-2 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-30 cursor-pointer shrink-0 touch-manipulation"
              title={isEs ? 'Rehacer' : 'Refazer'}
            >
              <Redo2 className="h-4 w-4" />
            </button>

            <div className="mx-0.5 h-4 w-px bg-slate-200 shrink-0" />

            {/* Most Used: Lists & Checklist */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSetBlockType('checklist')}
              className={`rounded-xl p-2 transition-colors cursor-pointer shrink-0 touch-manipulation ${
                focusedBlock?.type === 'checklist'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'
              }`}
              title="Checklist"
            >
              <CheckSquare className="h-4 w-4" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSetBlockType('bullet')}
              className={`rounded-xl p-2 transition-colors cursor-pointer shrink-0 touch-manipulation ${
                focusedBlock?.type === 'bullet'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'
              }`}
              title={isEs ? 'Viñetas' : 'Marcadores'}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSetBlockType('numbered')}
              className={`rounded-xl p-2 transition-colors cursor-pointer shrink-0 touch-manipulation ${
                focusedBlock?.type === 'numbered'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'
              }`}
              title={isEs ? 'Lista numerada' : 'Lista numerada'}
            >
              <ListOrdered className="h-4 w-4" />
            </button>

            <div className="mx-0.5 h-4 w-px bg-slate-200 shrink-0" />

            {/* Most Used: Inline Formatting */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleInlineFormat('bold')}
              className={`rounded-xl p-2 transition-colors cursor-pointer shrink-0 touch-manipulation ${
                activeFormats.bold
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'text-slate-700 hover:bg-emerald-50'
              }`}
              title={isEs ? 'Negrita' : 'Negrito'}
            >
              <Bold className="h-4 w-4" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleInlineFormat('italic')}
              className={`rounded-xl p-2 transition-colors cursor-pointer shrink-0 touch-manipulation ${
                activeFormats.italic
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'text-slate-700 hover:bg-emerald-50'
              }`}
              title={isEs ? 'Cursiva' : 'Itálico'}
            >
              <Italic className="h-4 w-4" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleInlineFormat('underline')}
              className={`rounded-xl p-2 transition-colors cursor-pointer shrink-0 touch-manipulation ${
                activeFormats.underline
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'text-slate-700 hover:bg-emerald-50'
              }`}
              title={isEs ? 'Subrayado' : 'Sublinhado'}
            >
              <Underline className="h-4 w-4" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleInlineFormat('strikeThrough')}
              className={`rounded-xl p-2 transition-colors cursor-pointer shrink-0 touch-manipulation ${
                activeFormats.strikeThrough
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'text-slate-700 hover:bg-emerald-50'
              }`}
              title={isEs ? 'Tachado' : 'Tachado'}
            >
              <Strikethrough className="h-4 w-4" />
            </button>

            <div className="mx-0.5 h-4 w-px bg-slate-200 shrink-0" />

            {/* Expandable Group Triggers */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setOpenPanel((p) => (p === 'structure' ? 'none' : 'structure'))}
              className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-black transition-colors cursor-pointer shrink-0 touch-manipulation ${
                openPanel === 'structure'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100/90 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800'
              }`}
            >
              <Type className="h-3.5 w-3.5" />
              <span>Aa</span>
              <ChevronDown className="h-3 w-3 opacity-75" />
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setOpenPanel((p) => (p === 'color' ? 'none' : 'color'))}
              className={`inline-flex items-center gap-1 rounded-xl p-2 transition-colors cursor-pointer shrink-0 touch-manipulation ${
                openPanel === 'color'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100/90 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800'
              }`}
              title={isEs ? 'Color y resaltado' : 'Cor e destaque'}
            >
              <Palette className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setOpenPanel((p) => (p === 'insert' ? 'none' : 'insert'))}
              className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-black transition-colors cursor-pointer shrink-0 touch-manipulation ${
                openPanel === 'insert'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              <Plus className="h-3.5 w-3.5 stroke-[2.6]" />
              <span>{isEs ? 'Insertar' : 'Inserir'}</span>
            </button>
          </div>

          {/* Expandable Sub-Bars */}
          <AnimatePresence initial={false}>
            {openPanel === 'structure' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden border-t border-emerald-100/70 bg-[#F8FBF9]"
              >
                <div className="mx-auto flex max-w-2xl items-center gap-1 overflow-x-auto no-scrollbar px-3 py-2">
                  {(
                    [
                      { id: 'heading', icon: Heading1, label: 'H1' },
                      { id: 'subheading', icon: Heading2, label: 'H2' },
                      { id: 'heading3', icon: Heading3, label: 'H3' },
                      { id: 'paragraph', icon: Type, label: isEs ? 'Texto' : 'Texto' },
                      { id: 'quote', icon: Quote, label: isEs ? 'Cita' : 'Citação' },
                    ] as const
                  ).map((item) => {
                    const Icon = item.icon;
                    const active = focusedBlock?.type === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleSetBlockType(item.id)}
                        className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[11px] font-black transition-colors cursor-pointer shrink-0 touch-manipulation ${
                          active
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-400'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}

                  <div className="mx-1 h-4 w-px bg-slate-200 shrink-0" />

                  {(
                    [
                      { id: 'left', icon: AlignLeft },
                      { id: 'center', icon: AlignCenter },
                      { id: 'right', icon: AlignRight },
                    ] as const
                  ).map((al) => {
                    const Icon = al.icon;
                    const active = (focusedBlock?.align || 'left') === al.id;
                    return (
                      <button
                        key={al.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleSetAlign(al.id)}
                        className={`rounded-xl border p-2 transition-colors cursor-pointer shrink-0 touch-manipulation ${
                          active
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {openPanel === 'color' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden border-t border-emerald-100/70 bg-[#F8FBF9]"
              >
                <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-3 px-3.5 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black uppercase text-slate-400">
                      {isEs ? 'Texto' : 'Texto'}
                    </span>
                    {TEXT_COLORS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleInlineFormat('foreColor', c.value)}
                        style={{ backgroundColor: c.value }}
                        title={c.label}
                        className="h-6 w-6 rounded-full border-2 border-white shadow-xs hover:scale-110 transition-transform cursor-pointer touch-manipulation"
                      />
                    ))}
                  </div>

                  <div className="h-4 w-px bg-slate-200 hidden sm:block" />

                  <div className="flex items-center gap-1.5">
                    <Highlighter className="h-3.5 w-3.5 text-emerald-600" />
                    {HIGHLIGHT_COLORS.map((h) => (
                      <button
                        key={h.value}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleInlineFormat('hiliteColor', h.value)}
                        style={{
                          backgroundColor: h.value === 'transparent' ? '#ffffff' : h.value,
                        }}
                        title={h.label}
                        className="flex h-6 w-6 items-center justify-center rounded-lg border border-slate-300 shadow-2xs hover:scale-110 transition-transform cursor-pointer touch-manipulation"
                      >
                        {h.value === 'transparent' && <X className="h-3 w-3 text-slate-400" />}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {openPanel === 'insert' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden border-t border-emerald-100/70 bg-[#F8FBF9]"
              >
                <div className="mx-auto flex max-w-2xl items-center gap-1.5 overflow-x-auto no-scrollbar px-3 py-2">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setIsLinkDialogOpen((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black text-slate-700 hover:border-emerald-400 hover:text-emerald-700 cursor-pointer shrink-0 touch-manipulation"
                  >
                    <Link2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Link</span>
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setOpenPanel('none');
                      onTriggerImageUpload();
                    }}
                    disabled={isUploadingImage}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black text-slate-700 hover:border-emerald-400 hover:text-emerald-700 cursor-pointer shrink-0 touch-manipulation"
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
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setOpenPanel('none');
                      onAddTable();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black text-slate-700 hover:border-emerald-400 hover:text-emerald-700 cursor-pointer shrink-0 touch-manipulation"
                  >
                    <TableIcon className="h-3.5 w-3.5 text-emerald-600" />
                    <span>{isEs ? 'Tabla' : 'Tabela'}</span>
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setOpenPanel('none');
                      onOpenDrawing();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black text-slate-700 hover:border-emerald-400 hover:text-emerald-700 cursor-pointer shrink-0 touch-manipulation"
                  >
                    <PenTool className="h-3.5 w-3.5 text-emerald-600" />
                    <span>{isEs ? 'Dibujo' : 'Desenho'}</span>
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setOpenPanel('none');
                      onTriggerScanUpload();
                    }}
                    disabled={isUploadingImage}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black text-slate-700 hover:border-emerald-400 hover:text-emerald-700 cursor-pointer shrink-0 touch-manipulation"
                  >
                    <ScanLine className="h-3.5 w-3.5 text-emerald-600" />
                    <span>{isEs ? 'Escanear' : 'Escanear'}</span>
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={onToggleDictation}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-black transition-all cursor-pointer shrink-0 touch-manipulation ${
                      isDictating
                        ? 'border-rose-400 bg-rose-500 text-white animate-pulse'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-400 hover:text-emerald-700'
                    }`}
                  >
                    {isDictating ? (
                      <MicOff className="h-3.5 w-3.5" />
                    ) : (
                      <Mic className="h-3.5 w-3.5 text-emerald-600" />
                    )}
                    <span>{isDictating ? (isEs ? 'Escuchando...' : 'Ouvindo...') : isEs ? 'Dictar' : 'Ditar'}</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Inline Insert Link Dialog (16px font on mobile to prevent Safari zoom) */}
          <AnimatePresence>
            {isLinkDialogOpen && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={handleInsertInlineLink}
                className="overflow-hidden border-t border-emerald-100 bg-emerald-50/50 px-3.5 py-2.5"
              >
                <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-2">
                  <input
                    type="text"
                    required
                    value={linkUrlInput}
                    onChange={(e) => setLinkUrlInput(e.target.value)}
                    placeholder="https://..."
                    className="flex-1 min-w-[150px] rounded-xl border border-emerald-200 bg-white px-3 py-2 text-[16px] sm:text-xs font-semibold text-slate-900 outline-none focus:border-emerald-500"
                  />
                  <input
                    type="text"
                    value={linkTextInput}
                    onChange={(e) => setLinkTextInput(e.target.value)}
                    placeholder={isEs ? 'Texto (opcional)' : 'Texto (opcional)'}
                    className="flex-1 min-w-[130px] rounded-xl border border-emerald-200 bg-white px-3 py-2 text-[16px] sm:text-xs font-medium text-slate-800 outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-black text-white hover:bg-emerald-700 cursor-pointer touch-manipulation"
                  >
                    {isEs ? 'Insertar' : 'Inserir'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsLinkDialogOpen(false)}
                    className="rounded-xl p-1.5 text-slate-400 hover:bg-white cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Floating Contextual Selection Toolbar */}
      <AnimatePresence>
        {floatingBar.visible && !effectiveReadOnly && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.14 }}
            style={{
              top: floatingBar.top,
              left: floatingBar.left,
              transform: 'translateX(-50%)',
            }}
            className="fixed z-[95] flex flex-col items-center gap-1.5 pointer-events-auto"
          >
            <div className="flex items-center gap-0.5 rounded-2xl border border-emerald-200 bg-white px-1.5 py-1 shadow-[0_10px_28px_rgba(6,78,59,0.16)]">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleInlineFormat('bold')}
                className={`rounded-xl p-2 cursor-pointer touch-manipulation ${
                  activeFormats.bold ? 'bg-emerald-100 text-emerald-800' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Bold className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleInlineFormat('italic')}
                className={`rounded-xl p-2 cursor-pointer touch-manipulation ${
                  activeFormats.italic ? 'bg-emerald-100 text-emerald-800' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Italic className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleInlineFormat('underline')}
                className={`rounded-xl p-2 cursor-pointer touch-manipulation ${
                  activeFormats.underline ? 'bg-emerald-100 text-emerald-800' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Underline className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleInlineFormat('strikeThrough')}
                className={`rounded-xl p-2 cursor-pointer touch-manipulation ${
                  activeFormats.strikeThrough ? 'bg-emerald-100 text-emerald-800' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Strikethrough className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleInlineFormat('hiliteColor', '#d1fae5')}
                className="rounded-xl p-2 text-emerald-700 hover:bg-emerald-50 cursor-pointer touch-manipulation"
                title={isEs ? 'Resaltar' : 'Destacar'}
              >
                <Highlighter className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() =>
                  setFloatingBar((prev) => ({ ...prev, showColors: !prev.showColors }))
                }
                className={`rounded-xl p-2 cursor-pointer touch-manipulation ${
                  floatingBar.showColors ? 'bg-emerald-600 text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
                title={isEs ? 'Color del texto' : 'Cor do texto'}
              >
                <Palette className="h-3.5 w-3.5" />
              </button>
            </div>

            {floatingBar.showColors && (
              <div className="flex items-center gap-1.5 rounded-2xl border border-emerald-200 bg-white px-2.5 py-1.5 shadow-lg">
                {TEXT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      handleInlineFormat('foreColor', c.value);
                      setFloatingBar((prev) => ({ ...prev, showColors: false }));
                    }}
                    style={{ backgroundColor: c.value }}
                    className="h-5 w-5 rounded-full border border-white shadow-xs cursor-pointer touch-manipulation"
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subtle Checklist Action: Group Completed Items at Bottom */}
      {!effectiveReadOnly && hasUnsortedCompletedChecklist && (
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleGroupCompletedAtBottom}
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/80 px-3 py-1 text-[10.5px] font-black text-emerald-800 hover:bg-emerald-100 transition-colors cursor-pointer touch-manipulation"
          >
            <ArrowDownWideNarrow className="h-3 w-3" />
            <span>{isEs ? 'Agrupar completados al final' : 'Agrupar concluídos no final'}</span>
          </button>
        </div>
      )}

      {/* Fluid Document Canvas */}
      <div className="space-y-1 w-full min-w-0 max-w-full">
        <AnimatePresence initial={false}>
          {safeBlocks.map((block, index) => {
            if (block.type === 'numbered') {
              runningNumber += 1;
            } else {
              runningNumber = 0;
            }
            const currentNumber = runningNumber;
            const isMatched =
              Boolean(normalizedQuery) &&
              htmlToPlainText(block.html).toLowerCase().includes(normalizedQuery);

            return (
              <EditableBlockRow
                key={block.id}
                block={block}
                index={index}
                totalBlocks={safeBlocks.length}
                numberIndex={currentNumber}
                isFocused={focusedBlock?.id === block.id}
                isMatchedBySearch={isMatched}
                readOnly={readOnly}
                isReadingMode={isReadingMode}
                isEs={isEs}
                reduceMotion={reduceMotion}
                registerEl={registerEl}
                onFocusBlock={setFocusedBlockId}
                onHtmlChange={handleHtmlChange}
                onKeyDown={handleBlockKeyDown}
                onToggleCheck={handleToggleCheck}
                onMoveBlock={handleMoveBlock}
                onRemoveBlock={handleRemoveBlock}
              />
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};
