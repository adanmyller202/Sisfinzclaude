import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
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
  X,
  Highlighter,
  Palette,
  SlidersHorizontal,
  ChevronUp,
  ArrowDownWideNarrow,
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
  blocks: NoteBlock[];
  readOnly?: boolean;
  isReadingMode?: boolean;
  searchHighlight?: string;
  groupCompletedChecklist?: boolean;
  language?: LanguageCode;
  isUploadingImage?: boolean;
  isDictating?: boolean;
  onChangeBlocks: (nextBlocks: NoteBlock[], immediate?: boolean) => void;
  onToggleGroupCompleted?: () => void;
  onTriggerImageUpload: () => void;
  onTriggerScanUpload: () => void;
  onOpenDrawing: () => void;
  onAddTable: () => void;
  onToggleDictation: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
}

const TEXT_COLORS = [
  { label: 'Padrão', value: '#0f172a' },
  { label: 'Esmeralda', value: '#047857' },
  { label: 'Azul', value: '#0369a1' },
  { label: 'Roxo', value: '#6d28d9' },
  { label: 'Âmbar', value: '#b45309' },
  { label: 'Rosa', value: '#be123c' },
];

const HIGHLIGHT_COLORS = [
  { label: 'Sem destaque', value: 'transparent' },
  { label: 'Menta', value: '#d1fae5' },
  { label: 'Amarelo', value: '#fef08a' },
  { label: 'Azul', value: '#e0f2fe' },
  { label: 'Rosa', value: '#ffe4e6' },
];

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
  } catch {
    // ignore selection errors on restricted webviews
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

/**
 * Reorders contiguous checklist runs so completed items sink smoothly to the bottom of their run
 * without altering any item's content or mixing separate checklist sections.
 */
function groupCompletedInRuns(blocks: NoteBlock[]): NoteBlock[] {
  const result = [...blocks];
  let i = 0;
  while (i < result.length) {
    if (result[i].type !== 'checklist') {
      i += 1;
      continue;
    }
    let j = i;
    while (j < result.length && result[j].type === 'checklist') {
      j += 1;
    }
    const run = result.slice(i, j);
    const unchecked = run.filter((b) => !b.checked);
    const checked = run.filter((b) => Boolean(b.checked));
    const sortedRun = [...unchecked, ...checked];
    for (let k = 0; k < sortedRun.length; k++) {
      result[i + k] = sortedRun[k];
    }
    i = j;
  }
  return result;
}

interface EditableBlockRowProps {
  block: NoteBlock;
  index: number;
  totalBlocks: number;
  numberIndex: number;
  isFocused: boolean;
  readOnly: boolean;
  isReadingMode: boolean;
  isSearchMatch: boolean;
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
  readOnly,
  isReadingMode,
  isSearchMatch,
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
  const alignClass =
    block.align === 'center'
      ? 'text-center'
      : block.align === 'right'
      ? 'text-right'
      : 'text-left';

  // CRITICAL FOR iOS SAFARI ANTI-ZOOM: Every editable text block uses >= 16px font size!
  const textStyleClass =
    block.type === 'heading'
      ? 'text-[22px] font-black tracking-tight text-slate-900 leading-snug pt-2'
      : block.type === 'subheading'
      ? 'text-[19px] font-extrabold text-emerald-950 leading-snug pt-1.5'
      : block.type === 'h3'
      ? 'text-[17px] font-bold text-slate-800 leading-snug pt-1'
      : block.type === 'quote'
      ? 'text-[16px] italic font-medium text-emerald-900/90 leading-relaxed'
      : 'text-[16px] font-normal text-slate-800 leading-[1.68]';

  const placeholderText = isReadingMode
    ? ''
    : block.type === 'checklist'
    ? isEs
      ? 'Elemento de la lista...'
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
    : block.type === 'h3'
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
      transition={{ duration: 0.16 }}
      className={`group relative flex items-start gap-2.5 w-full max-w-full min-w-0 transition-colors ${
        block.type === 'quote'
          ? 'border-l-[3px] border-emerald-500/80 bg-emerald-50/40 pl-3.5 pr-2 py-2 my-1 rounded-r-xl'
          : 'py-[3px]'
      } ${isSearchMatch ? 'bg-amber-100/75 rounded-lg px-1.5 -mx-1.5' : ''}`}
    >
      {/* Interactive Checklist Checkbox */}
      {block.type === 'checklist' && (
        <motion.button
          type="button"
          disabled={readOnly && !isReadingMode}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onToggleCheck(block.id)}
          whileTap={reduceMotion ? undefined : { scale: 0.85 }}
          animate={
            reduceMotion
              ? undefined
              : isChecked
              ? { scale: [1, 1.16, 1] }
              : { scale: 1 }
          }
          transition={{ type: 'spring', stiffness: 480, damping: 24 }}
          aria-label={isChecked ? 'Desmarcar item' : 'Marcar item como concluído'}
          aria-pressed={isChecked}
          style={{ touchAction: 'manipulation' }}
          className={`mt-[4px] flex h-[21px] w-[21px] shrink-0 items-center justify-center rounded-[7px] border-2 transition-colors cursor-pointer select-none ${
            isChecked
              ? 'border-emerald-600 bg-emerald-600 text-white shadow-2xs'
              : 'border-emerald-500/70 bg-white text-transparent hover:border-emerald-600'
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
        <span className="mt-[11px] h-[6px] w-[6px] shrink-0 rounded-full bg-emerald-600" />
      )}

      {block.type === 'numbered' && (
        <span className="mt-[3px] min-w-[22px] shrink-0 font-mono text-[14px] font-bold text-emerald-700 text-right select-none">
          {numberIndex}.
        </span>
      )}

      {/* Editable Content */}
      <div className="relative min-w-0 flex-1 max-w-full">
        {isReadingMode ? (
          <div
            className={`min-h-[24px] w-full max-w-full break-words [overflow-wrap:anywhere] [&_a]:text-emerald-700 [&_a]:underline [&_a]:font-semibold ${textStyleClass} ${alignClass} ${
              isChecked ? 'text-slate-400 line-through decoration-emerald-600/60' : ''
            }`}
            dangerouslySetInnerHTML={{ __html: block.html || '&nbsp;' }}
          />
        ) : (
          <>
            <div
              ref={setRef}
              contentEditable={!readOnly}
              suppressContentEditableWarning
              onFocus={() => onFocusBlock(block.id)}
              onInput={(e) => {
                const html = (e.currentTarget as HTMLDivElement).innerHTML;
                onHtmlChange(block.id, html);
              }}
              onKeyDown={(e) => onKeyDown(e, block, index)}
              data-placeholder={placeholderText}
              className={`min-h-[26px] w-full max-w-full break-words [overflow-wrap:anywhere] outline-none transition-colors [&_a]:text-emerald-700 [&_a]:underline [&_a]:font-semibold empty:before:content-[attr(data-placeholder)] empty:before:text-slate-300 empty:before:pointer-events-none ${textStyleClass} ${alignClass} ${
                isChecked ? 'text-slate-400' : ''
              }`}
            />

            {/* Smooth animated strike-through on checklist completion */}
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
          </>
        )}
      </div>

      {/* Subtle Reorder & Delete Controls when editing list items */}
      {!readOnly &&
        !isReadingMode &&
        (block.type === 'checklist' || block.type === 'bullet' || block.type === 'numbered') &&
        isFocused && (
          <div className="flex items-center gap-0.5 shrink-0 pt-1">
            {index > 0 && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onMoveBlock(index, -1)}
                style={{ touchAction: 'manipulation' }}
                className="rounded-lg p-1 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer"
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
                style={{ touchAction: 'manipulation' }}
                className="rounded-lg p-1 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer"
                title={isEs ? 'Bajar' : 'Mover para baixo'}
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onRemoveBlock(block.id)}
              style={{ touchAction: 'manipulation' }}
              className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-500 cursor-pointer"
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
  blocks,
  readOnly = false,
  isReadingMode = false,
  searchHighlight = '',
  groupCompletedChecklist = false,
  language = 'pt',
  isUploadingImage = false,
  isDictating = false,
  onChangeBlocks,
  onToggleGroupCompleted,
  onTriggerImageUpload,
  onTriggerScanUpload,
  onOpenDrawing,
  onAddTable,
  onToggleDictation,
  onUndo,
  onRedo,
}) => {
  const isEs = language === 'es';
  const reduceMotion = Boolean(useReducedMotion());

  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(blocks[0]?.id || null);
  const [isMoreToolsOpen, setIsMoreToolsOpen] = useState(false);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [linkUrlInput, setLinkUrlInput] = useState('');
  const [linkTextInput, setLinkTextInput] = useState('');

  // Active inline format states
  const [activeInline, setActiveInline] = useState({
    bold: false,
    italic: false,
    underline: false,
    strike: false,
  });

  // Floating selection contextual toolbar state
  const [floatingBar, setFloatingBar] = useState<{
    visible: boolean;
    top: number;
    left: number;
    showColors: boolean;
    showHighlights: boolean;
  }>({ visible: false, top: 0, left: 0, showColors: false, showHighlights: false });

  const editorCanvasRef = useRef<HTMLDivElement>(null);
  const blockElsRef = useRef<Record<string, HTMLDivElement | null>>({});
  const pendingFocusRef = useRef<{ id: string; position: 'start' | 'end' } | null>(null);

  const safeBlocks: NoteBlock[] =
    blocks.length > 0 ? blocks : [{ id: createBlockId(), type: 'paragraph', html: '' }];

  const focusedBlock =
    safeBlocks.find((b) => b.id === focusedBlockId) || safeBlocks[safeBlocks.length - 1];

  const hasAnyChecklist = safeBlocks.some((b) => b.type === 'checklist');

  // Keyboard shortcuts for Undo/Redo inside editor
  useEffect(() => {
    if (readOnly || isReadingMode) return;
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          if (onRedo) {
            e.preventDefault();
            onRedo();
          }
        } else if (onUndo) {
          e.preventDefault();
          onUndo();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y' && onRedo) {
        e.preventDefault();
        onRedo();
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [readOnly, isReadingMode, onUndo, onRedo]);

  // Track text selection for floating contextual toolbar & active inline states (Safari iOS + Desktop)
  const updateSelectionState = useCallback(() => {
    if (readOnly || isReadingMode) {
      setFloatingBar((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      return;
    }
    try {
      setActiveInline({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strike: document.queryCommandState('strikeThrough'),
      });

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        setFloatingBar((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        return;
      }

      const text = sel.toString().trim();
      if (!text) {
        setFloatingBar((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        return;
      }

      const range = sel.getRangeAt(0);
      const container = editorCanvasRef.current;
      if (!container || !container.contains(range.commonAncestorContainer)) {
        setFloatingBar((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        return;
      }

      const rect = range.getBoundingClientRect();
      if (!rect || (rect.width === 0 && rect.height === 0)) return;

      const vw = window.innerWidth || 375;
      const barWidth = Math.min(280, vw - 24);
      const centerX = rect.left + rect.width / 2;
      const clampedLeft = Math.max(12 + barWidth / 2, Math.min(vw - 12 - barWidth / 2, centerX));
      const topAbove = rect.top - 52;
      const safeTop = topAbove > 110 ? topAbove : rect.bottom + 10;

      setFloatingBar((prev) => ({
        ...prev,
        visible: true,
        top: safeTop,
        left: clampedLeft,
      }));
    } catch {
      // ignore selection errors
    }
  }, [readOnly, isReadingMode]);

  useEffect(() => {
    document.addEventListener('selectionchange', updateSelectionState);
    return () => document.removeEventListener('selectionchange', updateSelectionState);
  }, [updateSelectionState]);

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

  const registerEl = (id: string, el: HTMLDivElement | null) => {
    blockElsRef.current[id] = el;
  };

  const handleHtmlChange = (id: string, html: string) => {
    const next = safeBlocks.map((b) => (b.id === id ? { ...b, html } : b));
    onChangeBlocks(next, false);
  };

  const handleToggleCheck = (id: string) => {
    let next = safeBlocks.map((b) => (b.id === id ? { ...b, checked: !b.checked } : b));
    if (groupCompletedChecklist) {
      next = groupCompletedInRuns(next);
    }
    onChangeBlocks(next, true);
  };

  const handleSetBlockType = (targetType: NoteBlockType) => {
    if (readOnly || isReadingMode) return;
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
    onChangeBlocks(next, true);
  };

  const handleSetAlign = (align: NoteTextAlign) => {
    if (readOnly || isReadingMode) return;
    const targetId = focusedBlock?.id || safeBlocks[0].id;
    const next = safeBlocks.map((b) => (b.id === targetId ? { ...b, align } : b));
    onChangeBlocks(next, true);
  };

  const handleInlineFormat = (
    cmd: 'bold' | 'italic' | 'underline' | 'strikeThrough' | 'foreColor' | 'hiliteColor',
    value?: string
  ) => {
    if (readOnly || isReadingMode) return;
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
        handleHtmlChange(targetId, el.innerHTML);
      }
      updateSelectionState();
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
    onChangeBlocks(next, true);
    setLinkUrlInput('');
    setLinkTextInput('');
    setIsLinkDialogOpen(false);
    pendingFocusRef.current = { id: focusedBlock.id, position: 'end' };
  };

  const handleMoveBlock = (index: number, delta: -1 | 1) => {
    const targetIdx = index + delta;
    if (targetIdx < 0 || targetIdx >= safeBlocks.length) return;
    const next = [...safeBlocks];
    const [moved] = next.splice(index, 1);
    next.splice(targetIdx, 0, moved);
    onChangeBlocks(next, true);
    setFocusedBlockId(moved.id);
  };

  const handleRemoveBlock = (id: string) => {
    if (safeBlocks.length <= 1) {
      const reset: NoteBlock[] = [{ id: safeBlocks[0].id, type: 'paragraph', html: '' }];
      onChangeBlocks(reset, true);
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
    onChangeBlocks(next, true);
  };

  const handleBlockKeyDown = (
    e: React.KeyboardEvent<HTMLDivElement>,
    block: NoteBlock,
    index: number
  ) => {
    if (readOnly || isReadingMode) return;
    const el = e.currentTarget;
    const currentHtml = el.innerHTML;
    const plain = htmlToPlainText(currentHtml);

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();

      const isListMode =
        block.type === 'checklist' || block.type === 'bullet' || block.type === 'numbered';

      // Pressing ENTER on an empty checklist/bullet/numbered line cleanly exits list mode
      if (isListMode && plain.length === 0) {
        const next = safeBlocks.map((b) =>
          b.id === block.id ? { ...b, type: 'paragraph' as NoteBlockType, checked: undefined } : b
        );
        pendingFocusRef.current = { id: block.id, position: 'start' };
        onChangeBlocks(next, true);
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
      onChangeBlocks(next, true);
      return;
    }

    if (e.key === 'Backspace' && isCaretAtStart(el)) {
      if (block.type !== 'paragraph') {
        e.preventDefault();
        const next = safeBlocks.map((b) =>
          b.id === block.id ? { ...b, type: 'paragraph' as NoteBlockType, checked: undefined } : b
        );
        pendingFocusRef.current = { id: block.id, position: 'start' };
        onChangeBlocks(next, true);
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
        onChangeBlocks(next, true);
      }
    }
  };

  let runningNumber = 0;
  const searchTerm = searchHighlight.trim().toLowerCase();

  return (
    <div className="flex flex-col w-full max-w-full min-w-0">
      {/* Compact Smart Primary Toolbar (Hidden in Reading Mode) */}
      {!readOnly && !isReadingMode && (
        <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 mb-4 border-y border-emerald-100/80 bg-white/95 backdrop-blur-sm">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar px-3 py-1.5">
            {/* Most Used Core Tools */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSetBlockType('checklist')}
              style={{ touchAction: 'manipulation' }}
              className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold transition-colors cursor-pointer shrink-0 ${
                focusedBlock?.type === 'checklist'
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-slate-200/80 bg-white text-slate-700 hover:border-emerald-300'
              }`}
              title="Checklist"
            >
              <CheckSquare className="h-3.5 w-3.5" />
              <span>Checklist</span>
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSetBlockType('bullet')}
              style={{ touchAction: 'manipulation' }}
              className={`rounded-xl border p-1.5 transition-colors cursor-pointer shrink-0 ${
                focusedBlock?.type === 'bullet'
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-slate-200/80 bg-white text-slate-700 hover:border-emerald-300'
              }`}
              title={isEs ? 'Viñetas' : 'Marcadores'}
            >
              <List className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSetBlockType('numbered')}
              style={{ touchAction: 'manipulation' }}
              className={`rounded-xl border p-1.5 transition-colors cursor-pointer shrink-0 ${
                focusedBlock?.type === 'numbered'
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-slate-200/80 bg-white text-slate-700 hover:border-emerald-300'
              }`}
              title={isEs ? 'Numeración' : 'Numeração'}
            >
              <ListOrdered className="h-3.5 w-3.5" />
            </button>

            <div className="mx-0.5 h-4 w-px bg-slate-200 shrink-0" />

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleInlineFormat('bold')}
              style={{ touchAction: 'manipulation' }}
              className={`rounded-xl border p-1.5 transition-colors cursor-pointer shrink-0 ${
                activeInline.bold
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200/80 bg-white text-slate-700 hover:border-emerald-300'
              }`}
              title={isEs ? 'Negrita' : 'Negrito'}
            >
              <Bold className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleInlineFormat('italic')}
              style={{ touchAction: 'manipulation' }}
              className={`rounded-xl border p-1.5 transition-colors cursor-pointer shrink-0 ${
                activeInline.italic
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200/80 bg-white text-slate-700 hover:border-emerald-300'
              }`}
              title={isEs ? 'Cursiva' : 'Itálico'}
            >
              <Italic className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleInlineFormat('underline')}
              style={{ touchAction: 'manipulation' }}
              className={`rounded-xl border p-1.5 transition-colors cursor-pointer shrink-0 ${
                activeInline.underline
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200/80 bg-white text-slate-700 hover:border-emerald-300'
              }`}
              title={isEs ? 'Subrayado' : 'Sublinhado'}
            >
              <Underline className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSetBlockType('subheading')}
              style={{ touchAction: 'manipulation' }}
              className={`rounded-xl border p-1.5 transition-colors cursor-pointer shrink-0 ${
                focusedBlock?.type === 'subheading'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200/80 bg-white text-slate-700 hover:border-emerald-300'
              }`}
              title="H2"
            >
              <Heading2 className="h-3.5 w-3.5" />
            </button>

            <div className="mx-0.5 h-4 w-px bg-slate-200 shrink-0" />

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onTriggerImageUpload}
              disabled={isUploadingImage}
              style={{ touchAction: 'manipulation' }}
              className="rounded-xl border border-slate-200/80 bg-white p-1.5 text-emerald-700 hover:border-emerald-300 cursor-pointer shrink-0"
              title={isEs ? 'Imagen' : 'Imagem'}
            >
              {isUploadingImage ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ImageIcon className="h-3.5 w-3.5" />
              )}
            </button>

            {/* Expandable Organized Tools Drawer Trigger */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setIsMoreToolsOpen((v) => !v)}
              style={{ touchAction: 'manipulation' }}
              className={`ml-auto inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold transition-colors cursor-pointer shrink-0 ${
                isMoreToolsOpen
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200/80 bg-slate-50 text-slate-600 hover:border-emerald-300'
              }`}
            >
              {isMoreToolsOpen ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <SlidersHorizontal className="h-3.5 w-3.5" />
              )}
              <span>{isEs ? 'Más' : 'Mais'}</span>
            </button>
          </div>

          {/* Organized Expandable Tools Panel (Formatting, Structure, Insert) */}
          <AnimatePresence>
            {isMoreToolsOpen && (
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={reduceMotion ? undefined : { opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden border-t border-emerald-100/80 bg-[#F8FBF9]"
              >
                <div className="px-3.5 py-3 space-y-3">
                  {/* Group 1: Formatação */}
                  <div className="space-y-1.5">
                    <span className="text-[9.5px] font-black uppercase tracking-widest text-slate-400">
                      {isEs ? 'Formato' : 'Formatação'}
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleInlineFormat('strikeThrough')}
                        className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold cursor-pointer ${
                          activeInline.strike
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                            : 'border-slate-200 bg-white text-slate-700'
                        }`}
                      >
                        <Strikethrough className="h-3.5 w-3.5" />
                        <span>{isEs ? 'Tachado' : 'Tachado'}</span>
                      </button>

                      {/* Text Colors */}
                      <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1">
                        <Palette className="h-3 w-3 text-slate-400 mr-0.5" />
                        {TEXT_COLORS.map((c) => (
                          <button
                            key={c.value}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleInlineFormat('foreColor', c.value)}
                            style={{ backgroundColor: c.value }}
                            className="h-4 w-4 rounded-full border border-white shadow-2xs cursor-pointer"
                            title={c.label}
                          />
                        ))}
                      </div>

                      {/* Highlight Colors */}
                      <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1">
                        <Highlighter className="h-3 w-3 text-slate-400 mr-0.5" />
                        {HIGHLIGHT_COLORS.map((h) => (
                          <button
                            key={h.value}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleInlineFormat('hiliteColor', h.value)}
                            style={{
                              backgroundColor: h.value === 'transparent' ? '#ffffff' : h.value,
                            }}
                            className="h-4 w-4 rounded-sm border border-slate-300 cursor-pointer"
                            title={h.label}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Group 2: Estrutura */}
                  <div className="space-y-1.5">
                    <span className="text-[9.5px] font-black uppercase tracking-widest text-slate-400">
                      {isEs ? 'Estructura' : 'Estrutura'}
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(
                        [
                          { id: 'heading', icon: Heading1, label: 'H1' },
                          { id: 'subheading', icon: Heading2, label: 'H2' },
                          { id: 'h3', icon: Heading3, label: 'H3' },
                          { id: 'paragraph', icon: Type, label: isEs ? 'Normal' : 'Normal' },
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
                            className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold cursor-pointer ${
                              active
                                ? 'border-emerald-600 bg-emerald-600 text-white'
                                : 'border-slate-200 bg-white text-slate-700'
                            }`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}

                      {/* Alignment */}
                      <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5">
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
                              className={`rounded-md p-1 cursor-pointer ${
                                active
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              <Icon className="h-3.5 w-3.5" />
                            </button>
                          );
                        })}
                      </div>

                      {/* Group Completed Checklist Items Option */}
                      {hasAnyChecklist && onToggleGroupCompleted && (
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            onToggleGroupCompleted();
                            if (!groupCompletedChecklist) {
                              onChangeBlocks(groupCompletedInRuns(safeBlocks), true);
                            }
                          }}
                          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold cursor-pointer ${
                            groupCompletedChecklist
                              ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                              : 'border-slate-200 bg-white text-slate-600'
                          }`}
                        >
                          <ArrowDownWideNarrow className="h-3.5 w-3.5" />
                          <span>
                            {isEs ? 'Concluidos al final' : 'Concluídos no fim'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Group 3: Inserção */}
                  <div className="space-y-1.5">
                    <span className="text-[9.5px] font-black uppercase tracking-widest text-slate-400">
                      {isEs ? 'Insertar' : 'Inserção'}
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setIsLinkDialogOpen((v) => !v)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:border-emerald-300 cursor-pointer"
                      >
                        <Link2 className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Link</span>
                      </button>

                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={onAddTable}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:border-emerald-300 cursor-pointer"
                      >
                        <TableIcon className="h-3.5 w-3.5 text-emerald-600" />
                        <span>{isEs ? 'Tabla' : 'Tabela'}</span>
                      </button>

                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={onOpenDrawing}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:border-emerald-300 cursor-pointer"
                      >
                        <PenTool className="h-3.5 w-3.5 text-emerald-600" />
                        <span>{isEs ? 'Dibujar' : 'Desenhar'}</span>
                      </button>

                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={onTriggerScanUpload}
                        disabled={isUploadingImage}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:border-emerald-300 cursor-pointer"
                      >
                        <ScanLine className="h-3.5 w-3.5 text-emerald-600" />
                        <span>{isEs ? 'Escanear' : 'Escanear'}</span>
                      </button>

                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={onToggleDictation}
                        className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold cursor-pointer ${
                          isDictating
                            ? 'border-rose-400 bg-rose-500 text-white animate-pulse'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300'
                        }`}
                      >
                        {isDictating ? (
                          <MicOff className="h-3.5 w-3.5" />
                        ) : (
                          <Mic className="h-3.5 w-3.5 text-emerald-600" />
                        )}
                        <span>{isEs ? 'Dictar' : 'Ditar'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Inline Insert Link Bar (16px inputs to prevent Safari zoom) */}
          <AnimatePresence>
            {isLinkDialogOpen && (
              <motion.form
                initial={reduceMotion ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={reduceMotion ? undefined : { opacity: 0, height: 0 }}
                onSubmit={handleInsertInlineLink}
                className="overflow-hidden border-t border-emerald-100 bg-emerald-50/50 px-3.5 py-2.5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="url"
                    required
                    value={linkUrlInput}
                    onChange={(e) => setLinkUrlInput(e.target.value)}
                    placeholder="https://..."
                    className="flex-1 min-w-[160px] rounded-xl border border-emerald-200 bg-white px-3 py-2 text-[16px] font-medium text-slate-900 outline-none focus:border-emerald-500"
                  />
                  <input
                    type="text"
                    value={linkTextInput}
                    onChange={(e) => setLinkTextInput(e.target.value)}
                    placeholder={isEs ? 'Texto (opcional)' : 'Texto (opcional)'}
                    className="flex-1 min-w-[140px] rounded-xl border border-emerald-200 bg-white px-3 py-2 text-[16px] font-medium text-slate-800 outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-black text-white hover:bg-emerald-700 cursor-pointer"
                  >
                    {isEs ? 'Insertar' : 'Inserir'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsLinkDialogOpen(false)}
                    className="rounded-xl p-2 text-slate-400 hover:bg-white cursor-pointer"
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
        {floatingBar.visible && !readOnly && !isReadingMode && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.14 }}
            style={{
              position: 'fixed',
              top: floatingBar.top,
              left: floatingBar.left,
              transform: 'translateX(-50%)',
              touchAction: 'manipulation',
            }}
            className="z-[90] flex flex-col items-center gap-1.5"
          >
            <div className="flex items-center gap-0.5 rounded-2xl border border-emerald-200 bg-white/98 px-2 py-1.5 shadow-[0_8px_28px_rgba(15,23,42,0.14)] backdrop-blur-md">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleInlineFormat('bold')}
                className={`rounded-xl p-1.5 cursor-pointer ${
                  activeInline.bold ? 'bg-emerald-100 text-emerald-800' : 'text-slate-700 hover:bg-slate-100'
                }`}
                aria-label="Negrito"
              >
                <Bold className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleInlineFormat('italic')}
                className={`rounded-xl p-1.5 cursor-pointer ${
                  activeInline.italic ? 'bg-emerald-100 text-emerald-800' : 'text-slate-700 hover:bg-slate-100'
                }`}
                aria-label="Itálico"
              >
                <Italic className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleInlineFormat('underline')}
                className={`rounded-xl p-1.5 cursor-pointer ${
                  activeInline.underline ? 'bg-emerald-100 text-emerald-800' : 'text-slate-700 hover:bg-slate-100'
                }`}
                aria-label="Sublinhado"
              >
                <Underline className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleInlineFormat('strikeThrough')}
                className={`rounded-xl p-1.5 cursor-pointer ${
                  activeInline.strike ? 'bg-emerald-100 text-emerald-800' : 'text-slate-700 hover:bg-slate-100'
                }`}
                aria-label="Tachado"
              >
                <Strikethrough className="h-3.5 w-3.5" />
              </button>
              <div className="mx-0.5 h-4 w-px bg-slate-200" />
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() =>
                  setFloatingBar((p) => ({
                    ...p,
                    showHighlights: !p.showHighlights,
                    showColors: false,
                  }))
                }
                className={`rounded-xl p-1.5 cursor-pointer ${
                  floatingBar.showHighlights
                    ? 'bg-amber-100 text-amber-800'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
                aria-label="Destaque"
              >
                <Highlighter className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() =>
                  setFloatingBar((p) => ({
                    ...p,
                    showColors: !p.showColors,
                    showHighlights: false,
                  }))
                }
                className={`rounded-xl p-1.5 cursor-pointer ${
                  floatingBar.showColors
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
                aria-label="Cor do texto"
              >
                <Palette className="h-3.5 w-3.5" />
              </button>
            </div>

            {(floatingBar.showColors || floatingBar.showHighlights) && (
              <div className="flex items-center gap-1.5 rounded-xl border border-emerald-100 bg-white px-2.5 py-1.5 shadow-lg">
                {floatingBar.showColors
                  ? TEXT_COLORS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          handleInlineFormat('foreColor', c.value);
                          setFloatingBar((p) => ({ ...p, showColors: false }));
                        }}
                        style={{ backgroundColor: c.value }}
                        className="h-5 w-5 rounded-full border border-white shadow-xs cursor-pointer"
                      />
                    ))
                  : HIGHLIGHT_COLORS.map((h) => (
                      <button
                        key={h.value}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          handleInlineFormat('hiliteColor', h.value);
                          setFloatingBar((p) => ({ ...p, showHighlights: false }));
                        }}
                        style={{
                          backgroundColor: h.value === 'transparent' ? '#ffffff' : h.value,
                        }}
                        className="h-5 w-5 rounded-md border border-slate-300 cursor-pointer"
                      />
                    ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Natural Fluid Document Blocks */}
      <div ref={editorCanvasRef} className="space-y-1 w-full max-w-full min-w-0">
        {safeBlocks.map((block, index) => {
          if (block.type === 'numbered') {
            runningNumber += 1;
          } else {
            runningNumber = 0;
          }
          const currentNumber = runningNumber;
          const isSearchMatch =
            Boolean(searchTerm) && htmlToPlainText(block.html).toLowerCase().includes(searchTerm);

          return (
            <EditableBlockRow
              key={block.id}
              block={block}
              index={index}
              totalBlocks={safeBlocks.length}
              numberIndex={currentNumber}
              isFocused={focusedBlock?.id === block.id}
              readOnly={readOnly}
              isReadingMode={isReadingMode}
              isSearchMatch={isSearchMatch}
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
      </div>
    </div>
  );
};
