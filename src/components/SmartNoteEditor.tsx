import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Bold,
  Italic,
  Underline,
  Heading1,
  Heading2,
  Type,
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
} from 'lucide-react';
import { LanguageCode } from '../types';
import {
  NoteBlock,
  NoteBlockType,
  createBlockId,
  htmlToPlainText,
} from '../hooks/useNotes';

interface SmartNoteEditorProps {
  blocks: NoteBlock[];
  readOnly?: boolean;
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

function focusElementAt(el: HTMLElement | null, position: 'start' | 'end' = 'end') {
  if (!el) return;
  el.focus();
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

interface EditableBlockRowProps {
  block: NoteBlock;
  index: number;
  totalBlocks: number;
  numberIndex: number;
  isFocused: boolean;
  readOnly: boolean;
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
  const lastHtmlRef = useRef<string>(block.html);

  useEffect(() => {
    const el = localRef.current;
    if (!el) return;
    if (el.innerHTML !== block.html && document.activeElement !== el) {
      el.innerHTML = block.html;
      lastHtmlRef.current = block.html;
    }
  }, [block.html]);

  useEffect(() => {
    const el = localRef.current;
    if (el && el.innerHTML !== block.html) {
      el.innerHTML = block.html;
      lastHtmlRef.current = block.html;
    }
  }, [block.id]);

  const setRef = (node: HTMLDivElement | null) => {
    localRef.current = node;
    registerEl(block.id, node);
  };

  const isChecked = block.type === 'checklist' && Boolean(block.checked);

  const textStyleClass =
    block.type === 'heading'
      ? 'text-xl font-black tracking-tight text-slate-900 leading-snug'
      : block.type === 'subheading'
      ? 'text-base font-extrabold text-emerald-950 leading-snug'
      : 'text-[14.5px] font-medium text-slate-800 leading-relaxed';

  const placeholderText =
    block.type === 'checklist'
      ? isEs
        ? 'Elemento de la lista...'
        : 'Item do checklist...'
      : block.type === 'bullet' || block.type === 'numbered'
      ? isEs
        ? 'Elemento de lista...'
        : 'Item da lista...'
      : block.type === 'heading'
      ? isEs
        ? 'Título...'
        : 'Título...'
      : block.type === 'subheading'
      ? isEs
        ? 'Subtítulo...'
        : 'Subtítulo...'
      : index === 0
      ? isEs
        ? 'Empieza a escribir aquí...'
        : 'Comece a escrever aqui...'
      : '';

  return (
    <motion.div
      layout={!reduceMotion ? 'position' : false}
      initial={reduceMotion ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, height: 0 }}
      transition={{ duration: 0.16 }}
      className={`group relative flex items-start gap-2.5 rounded-xl px-1.5 py-1 transition-colors ${
        isFocused && block.type === 'checklist' ? 'bg-emerald-50/45' : ''
      }`}
    >
      {/* Leading Marker / Interactive Checkbox */}
      {block.type === 'checklist' && (
        <motion.button
          type="button"
          disabled={readOnly}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onToggleCheck(block.id)}
          whileTap={reduceMotion ? undefined : { scale: 0.84 }}
          animate={
            reduceMotion
              ? undefined
              : isChecked
              ? { scale: [1, 1.18, 1] }
              : { scale: 1 }
          }
          transition={{ type: 'spring', stiffness: 480, damping: 24 }}
          aria-label={isChecked ? 'Desmarcar item' : 'Marcar item como concluído'}
          aria-pressed={isChecked}
          className={`mt-[3px] flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-lg border-2 transition-colors cursor-pointer select-none ${
            isChecked
              ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs shadow-emerald-600/25'
              : 'border-emerald-400/80 bg-white text-transparent hover:border-emerald-600'
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
        <span className="mt-[10px] h-2 w-2 shrink-0 rounded-full bg-emerald-600" />
      )}

      {block.type === 'numbered' && (
        <span className="mt-[2px] min-w-[20px] shrink-0 font-mono text-xs font-black text-emerald-700 text-right select-none">
          {numberIndex}.
        </span>
      )}

      {/* Editable Content with Smooth Animated Strike-Through for Checklist */}
      <div className="relative min-w-0 flex-1">
        <div
          ref={setRef}
          contentEditable={!readOnly}
          suppressContentEditableWarning
          onFocus={() => onFocusBlock(block.id)}
          onInput={(e) => {
            const html = (e.currentTarget as HTMLDivElement).innerHTML;
            lastHtmlRef.current = html;
            onHtmlChange(block.id, html);
          }}
          onKeyDown={(e) => onKeyDown(e, block, index)}
          data-placeholder={placeholderText}
          className={`min-h-[24px] w-full break-words outline-none transition-colors [&_a]:text-emerald-700 [&_a]:underline [&_a]:font-bold empty:before:content-[attr(data-placeholder)] empty:before:text-slate-300 empty:before:pointer-events-none ${textStyleClass} ${
            isChecked ? 'text-slate-400' : ''
          }`}
        />

        {/* Animated progressive strike-through line for completed checklist items */}
        {block.type === 'checklist' && (
          <motion.span
            aria-hidden="true"
            initial={false}
            animate={{
              scaleX: isChecked ? 1 : 0,
              opacity: isChecked ? 0.75 : 0,
            }}
            transition={{ duration: reduceMotion ? 0.01 : 0.26, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: 'left center' }}
            className="pointer-events-none absolute left-0 right-2 top-[13px] h-[1.8px] rounded-full bg-emerald-600/75"
          />
        )}
      </div>

      {/* Subtle Reorder & Delete Controls for Checklist / List items when active */}
      {!readOnly &&
        (block.type === 'checklist' || block.type === 'bullet' || block.type === 'numbered') &&
        isFocused && (
          <div className="flex items-center gap-0.5 shrink-0 pt-0.5">
            {index > 0 && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onMoveBlock(index, -1)}
                className="rounded-lg p-1 text-slate-400 hover:bg-emerald-100 hover:text-emerald-700 cursor-pointer"
                title={isEs ? 'Subir' : 'Mover para cima'}
              >
                <ArrowUp className="h-3 w-3" />
              </button>
            )}
            {index < totalBlocks - 1 && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onMoveBlock(index, 1)}
                className="rounded-lg p-1 text-slate-400 hover:bg-emerald-100 hover:text-emerald-700 cursor-pointer"
                title={isEs ? 'Bajar' : 'Mover para baixo'}
              >
                <ArrowDown className="h-3 w-3" />
              </button>
            )}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onRemoveBlock(block.id)}
              className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-500 cursor-pointer"
              title={isEs ? 'Eliminar línea' : 'Excluir item'}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
    </motion.div>
  );
};

export const SmartNoteEditor: React.FC<SmartNoteEditorProps> = ({
  blocks,
  readOnly = false,
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

  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(blocks[0]?.id || null);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [linkUrlInput, setLinkUrlInput] = useState('');
  const [linkTextInput, setLinkTextInput] = useState('');

  const blockElsRef = useRef<Record<string, HTMLDivElement | null>>({});
  const pendingFocusRef = useRef<{ id: string; position: 'start' | 'end' } | null>(null);

  const safeBlocks: NoteBlock[] =
    blocks.length > 0 ? blocks : [{ id: createBlockId(), type: 'paragraph', html: '' }];

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

  const registerEl = (id: string, el: HTMLDivElement | null) => {
    blockElsRef.current[id] = el;
  };

  const handleHtmlChange = (id: string, html: string) => {
    const next = safeBlocks.map((b) => (b.id === id ? { ...b, html } : b));
    onChangeBlocks(next, false);
  };

  const handleToggleCheck = (id: string) => {
    const next = safeBlocks.map((b) =>
      b.id === id ? { ...b, checked: !b.checked } : b
    );
    onChangeBlocks(next, true);
  };

  const handleSetBlockType = (targetType: NoteBlockType) => {
    if (readOnly) return;
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

  const handleInlineFormat = (cmd: 'bold' | 'italic' | 'underline') => {
    if (readOnly) return;
    const targetId = focusedBlock?.id;
    const el = targetId ? blockElsRef.current[targetId] : null;
    if (el && document.activeElement !== el) {
      el.focus();
    }
    try {
      document.execCommand(cmd, false);
      if (targetId && el) {
        handleHtmlChange(targetId, el.innerHTML);
      }
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
    if (readOnly) return;
    const el = e.currentTarget;
    const currentHtml = el.innerHTML;
    const plain = htmlToPlainText(currentHtml);

    // SMART ENTER BEHAVIOR
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();

      const isListMode =
        block.type === 'checklist' || block.type === 'bullet' || block.type === 'numbered';

      // Pressing Enter on an EMPTY checklist/bullet/numbered line exits list mode cleanly to normal text
      if (isListMode && plain.length === 0) {
        const next = safeBlocks.map((b) =>
          b.id === block.id ? { ...b, type: 'paragraph' as NoteBlockType, checked: undefined } : b
        );
        pendingFocusRef.current = { id: block.id, position: 'start' };
        onChangeBlocks(next, true);
        return;
      }

      // Split block at caret position so users can insert items in the middle of a list seamlessly
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
      };

      const next = [...safeBlocks];
      next[index] = { ...block, html: beforeHtml };
      next.splice(index + 1, 0, newBlock);

      setFocusedBlockId(newBlock.id);
      pendingFocusRef.current = { id: newBlock.id, position: 'start' };
      onChangeBlocks(next, true);
      return;
    }

    // SMART BACKSPACE BEHAVIOR
    if (e.key === 'Backspace' && isCaretAtStart(el)) {
      const isListOrHeading = block.type !== 'paragraph';

      // First convert empty/start-of-line list or heading back to normal paragraph
      if (isListOrHeading) {
        e.preventDefault();
        const next = safeBlocks.map((b) =>
          b.id === block.id ? { ...b, type: 'paragraph' as NoteBlockType, checked: undefined } : b
        );
        pendingFocusRef.current = { id: block.id, position: 'start' };
        onChangeBlocks(next, true);
        return;
      }

      // Merge with previous block if there is one
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

  // Compute sequential numbering for contiguous numbered blocks
  let runningNumber = 0;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Accessible Rich Formatting Toolbar */}
      {!readOnly && (
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar border-b border-emerald-100/80 bg-[#F8FBF9] px-3 py-2 shrink-0">
          {/* Block Type Controls */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleSetBlockType('checklist')}
            className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[11px] font-black transition-all cursor-pointer shrink-0 ${
              focusedBlock?.type === 'checklist'
                ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-400 hover:text-emerald-700'
            }`}
            title={isEs ? 'Checklist inteligente' : 'Checklist inteligente'}
          >
            <CheckSquare className="h-3.5 w-3.5" />
            <span>Checklist</span>
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleSetBlockType('bullet')}
            className={`rounded-xl border p-2 transition-all cursor-pointer shrink-0 ${
              focusedBlock?.type === 'bullet'
                ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-400 hover:text-emerald-700'
            }`}
            title={isEs ? 'Viñetas' : 'Marcadores'}
          >
            <List className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleSetBlockType('numbered')}
            className={`rounded-xl border p-2 transition-all cursor-pointer shrink-0 ${
              focusedBlock?.type === 'numbered'
                ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-400 hover:text-emerald-700'
            }`}
            title={isEs ? 'Lista numerada' : 'Lista numerada'}
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </button>

          <div className="mx-1 h-5 w-px bg-slate-200 shrink-0" />

          {/* Typography */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleSetBlockType('heading')}
            className={`rounded-xl border p-2 transition-all cursor-pointer shrink-0 ${
              focusedBlock?.type === 'heading'
                ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-400'
            }`}
            title={isEs ? 'Título' : 'Título'}
          >
            <Heading1 className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleSetBlockType('subheading')}
            className={`rounded-xl border p-2 transition-all cursor-pointer shrink-0 ${
              focusedBlock?.type === 'subheading'
                ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-400'
            }`}
            title={isEs ? 'Subtítulo' : 'Subtítulo'}
          >
            <Heading2 className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleSetBlockType('paragraph')}
            className={`rounded-xl border p-2 transition-all cursor-pointer shrink-0 ${
              focusedBlock?.type === 'paragraph'
                ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-400'
            }`}
            title={isEs ? 'Texto normal' : 'Texto normal'}
          >
            <Type className="h-3.5 w-3.5" />
          </button>

          <div className="mx-1 h-5 w-px bg-slate-200 shrink-0" />

          {/* Inline Styles */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleInlineFormat('bold')}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 hover:border-emerald-400 hover:text-emerald-700 cursor-pointer shrink-0"
            title={isEs ? 'Negrita' : 'Negrito'}
          >
            <Bold className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleInlineFormat('italic')}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 hover:border-emerald-400 hover:text-emerald-700 cursor-pointer shrink-0"
            title={isEs ? 'Cursiva' : 'Itálico'}
          >
            <Italic className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleInlineFormat('underline')}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 hover:border-emerald-400 hover:text-emerald-700 cursor-pointer shrink-0"
            title={isEs ? 'Subrayado' : 'Sublinhado'}
          >
            <Underline className="h-3.5 w-3.5" />
          </button>

          <div className="mx-1 h-5 w-px bg-slate-200 shrink-0" />

          {/* Rich Attachments & Tools */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setIsLinkDialogOpen((v) => !v)}
            className="rounded-xl border border-slate-200 bg-white p-2 text-emerald-700 hover:border-emerald-400 cursor-pointer shrink-0"
            title={isEs ? 'Insertar link' : 'Inserir link'}
          >
            <Link2 className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onTriggerImageUpload}
            disabled={isUploadingImage}
            className="rounded-xl border border-slate-200 bg-white p-2 text-emerald-700 hover:border-emerald-400 cursor-pointer shrink-0"
            title={isEs ? 'Imagen' : 'Imagem'}
          >
            {isUploadingImage ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ImageIcon className="h-3.5 w-3.5" />
            )}
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onAddTable}
            className="rounded-xl border border-slate-200 bg-white p-2 text-emerald-700 hover:border-emerald-400 cursor-pointer shrink-0"
            title={isEs ? 'Tabla' : 'Tabela'}
          >
            <TableIcon className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onOpenDrawing}
            className="rounded-xl border border-slate-200 bg-white p-2 text-emerald-700 hover:border-emerald-400 cursor-pointer shrink-0"
            title={isEs ? 'Dibujar' : 'Desenhar'}
          >
            <PenTool className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onTriggerScanUpload}
            disabled={isUploadingImage}
            className="rounded-xl border border-slate-200 bg-white p-2 text-emerald-700 hover:border-emerald-400 cursor-pointer shrink-0"
            title={isEs ? 'Escanear' : 'Escanear'}
          >
            <ScanLine className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onToggleDictation}
            className={`rounded-xl border p-2 transition-all cursor-pointer shrink-0 ${
              isDictating
                ? 'border-rose-400 bg-rose-500 text-white animate-pulse'
                : 'border-slate-200 bg-white text-emerald-700 hover:border-emerald-400'
            }`}
            title={isEs ? 'Dictado por voz' : 'Ditado por voz'}
          >
            {isDictating ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}

      {/* Inline Insert Link Bar */}
      <AnimatePresence>
        {isLinkDialogOpen && !readOnly && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleInsertInlineLink}
            className="overflow-hidden border-b border-emerald-100 bg-emerald-50/50 px-3.5 py-2.5"
          >
            <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-2">
              <input
                type="text"
                required
                value={linkUrlInput}
                onChange={(e) => setLinkUrlInput(e.target.value)}
                placeholder="https://..."
                className="flex-1 min-w-[160px] rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500"
              />
              <input
                type="text"
                value={linkTextInput}
                onChange={(e) => setLinkTextInput(e.target.value)}
                placeholder={isEs ? 'Texto visible (opcional)' : 'Texto do link (opcional)'}
                className="flex-1 min-w-[140px] rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-black text-white hover:bg-emerald-700 cursor-pointer"
              >
                {isEs ? 'Insertar' : 'Inserir'}
              </button>
              <button
                type="button"
                onClick={() => setIsLinkDialogOpen(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-white cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Structured Interactive Blocks List */}
      <div className="space-y-1">
        <AnimatePresence initial={false}>
          {safeBlocks.map((block, index) => {
            if (block.type === 'numbered') {
              runningNumber += 1;
            } else {
              runningNumber = 0;
            }
            const currentNumber = runningNumber;

            return (
              <EditableBlockRow
                key={block.id}
                block={block}
                index={index}
                totalBlocks={safeBlocks.length}
                numberIndex={currentNumber}
                isFocused={focusedBlock?.id === block.id}
                readOnly={readOnly}
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
