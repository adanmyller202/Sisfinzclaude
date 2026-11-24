import { NoteItem, htmlToPlainText } from '../hooks/useNotes';

/**
 * Pure TypeScript A4 PDF generator (zero external dependencies) with WinAnsi (Windows-1252)
 * encoding support for Portuguese and Spanish accents, multi-page pagination, headings,
 * checklists, bullets, numbered lists, quotes, and tables.
 */

const WIN_ANSI_EXTRAS: Record<number, number> = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f,
};

function encodePdfLiteralWinAnsi(text: string): string {
  let out = '(';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    let byte: number | null = null;
    if (code >= 0x20 && code <= 0x7e) {
      byte = code;
    } else if (code >= 0xa0 && code <= 0xff) {
      byte = code;
    } else if (WIN_ANSI_EXTRAS[code] !== undefined) {
      byte = WIN_ANSI_EXTRAS[code];
    } else if (code === 0x2610) {
      out += '[ ]';
      continue;
    } else if (code === 0x2611 || code === 0x2713) {
      out += '[x]';
      continue;
    } else {
      continue;
    }

    if (byte === 0x28 || byte === 0x29 || byte === 0x5c) {
      out += '\\' + String.fromCharCode(byte);
    } else if (byte < 0x20 || byte > 0x7e) {
      out += '\\' + byte.toString(8).padStart(3, '0');
    } else {
      out += String.fromCharCode(byte);
    }
  }
  out += ')';
  return out;
}

function wrapTextLines(text: string, maxChars: number): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [''];
  const words = clean.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (!current) {
      if (word.length > maxChars) {
        let remaining = word;
        while (remaining.length > maxChars) {
          lines.push(remaining.slice(0, maxChars));
          remaining = remaining.slice(maxChars);
        }
        current = remaining;
      } else {
        current = word;
      }
    } else if (current.length + 1 + word.length <= maxChars) {
      current += ' ' + word;
    } else {
      lines.push(current);
      if (word.length > maxChars) {
        let remaining = word;
        while (remaining.length > maxChars) {
          lines.push(remaining.slice(0, maxChars));
          remaining = remaining.slice(maxChars);
        }
        current = remaining;
      } else {
        current = word;
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

interface PdfLineOp {
  text: string;
  font: 'F1' | 'F2' | 'F3';
  size: number;
  leading: number;
  indent: number;
  colorRgb: [number, number, number];
  quoteBar?: boolean;
  spaceBefore?: number;
  spaceAfter?: number;
}

export function buildNotePdfBlob(note: NoteItem, formattedDate: string): Blob {
  const PAGE_W = 595.28;
  const PAGE_H = 841.89;
  const MARGIN_X = 48;
  const MARGIN_TOP = 54;
  const MARGIN_BOTTOM = 52;
  const CONTENT_W = PAGE_W - MARGIN_X * 2;

  const ops: PdfLineOp[] = [];

  const titleText = (note.title || 'Nota sem título').trim();
  const titleLines = wrapTextLines(titleText, 38);
  titleLines.forEach((line, idx) => {
    ops.push({
      text: line,
      font: 'F2',
      size: 20,
      leading: 25,
      indent: 0,
      colorRgb: [0.024, 0.373, 0.275],
      spaceAfter: idx === titleLines.length - 1 ? 4 : 0,
    });
  });

  ops.push({
    text: `SisFinz Notas  •  ${formattedDate}`,
    font: 'F1',
    size: 9.5,
    leading: 14,
    indent: 0,
    colorRgb: [0.39, 0.45, 0.55],
    spaceAfter: 14,
  });

  let numCounter = 0;
  for (const blk of note.blocks || []) {
    const plain = htmlToPlainText(blk.html);
    if (!plain) {
      numCounter = 0;
      ops.push({
        text: '',
        font: 'F1',
        size: 11,
        leading: 10,
        indent: 0,
        colorRgb: [0.1, 0.14, 0.2],
      });
      continue;
    }

    if (blk.type === 'numbered') {
      numCounter += 1;
      const prefix = `${numCounter}. `;
      const wrapped = wrapTextLines(`${prefix}${plain}`, 76);
      wrapped.forEach((line, i) => {
        ops.push({
          text: line,
          font: 'F1',
          size: 11,
          leading: 16.5,
          indent: i === 0 ? 10 : 22,
          colorRgb: [0.1, 0.14, 0.2],
          spaceAfter: i === wrapped.length - 1 ? 4 : 0,
        });
      });
      continue;
    }

    numCounter = 0;

    if (blk.type === 'heading') {
      const wrapped = wrapTextLines(plain, 46);
      wrapped.forEach((line, i) => {
        ops.push({
          text: line,
          font: 'F2',
          size: 16,
          leading: 21,
          indent: 0,
          colorRgb: [0.06, 0.09, 0.16],
          spaceBefore: i === 0 ? 10 : 0,
          spaceAfter: i === wrapped.length - 1 ? 5 : 0,
        });
      });
    } else if (blk.type === 'subheading') {
      const wrapped = wrapTextLines(plain, 54);
      wrapped.forEach((line, i) => {
        ops.push({
          text: line,
          font: 'F2',
          size: 13.5,
          leading: 18.5,
          indent: 0,
          colorRgb: [0.024, 0.373, 0.275],
          spaceBefore: i === 0 ? 8 : 0,
          spaceAfter: i === wrapped.length - 1 ? 4 : 0,
        });
      });
    } else if (blk.type === 'heading3') {
      const wrapped = wrapTextLines(plain, 62);
      wrapped.forEach((line, i) => {
        ops.push({
          text: line,
          font: 'F2',
          size: 12,
          leading: 17,
          indent: 0,
          colorRgb: [0.15, 0.2, 0.28],
          spaceBefore: i === 0 ? 6 : 0,
          spaceAfter: i === wrapped.length - 1 ? 3 : 0,
        });
      });
    } else if (blk.type === 'checklist') {
      const prefix = blk.checked ? '[x] ' : '[ ] ';
      const wrapped = wrapTextLines(`${prefix}${plain}`, 74);
      wrapped.forEach((line, i) => {
        ops.push({
          text: line,
          font: 'F1',
          size: 11,
          leading: 16.5,
          indent: i === 0 ? 8 : 24,
          colorRgb: blk.checked ? [0.48, 0.54, 0.62] : [0.1, 0.14, 0.2],
          spaceAfter: i === wrapped.length - 1 ? 3.5 : 0,
        });
      });
    } else if (blk.type === 'bullet') {
      const wrapped = wrapTextLines(`• ${plain}`, 76);
      wrapped.forEach((line, i) => {
        ops.push({
          text: line,
          font: 'F1',
          size: 11,
          leading: 16.5,
          indent: i === 0 ? 10 : 18,
          colorRgb: [0.1, 0.14, 0.2],
          spaceAfter: i === wrapped.length - 1 ? 3.5 : 0,
        });
      });
    } else if (blk.type === 'quote') {
      const wrapped = wrapTextLines(plain, 70);
      wrapped.forEach((line, i) => {
        ops.push({
          text: line,
          font: 'F3',
          size: 11,
          leading: 16.5,
          indent: 14,
          colorRgb: [0.22, 0.35, 0.32],
          quoteBar: true,
          spaceBefore: i === 0 ? 4 : 0,
          spaceAfter: i === wrapped.length - 1 ? 6 : 0,
        });
      });
    } else {
      const wrapped = wrapTextLines(plain, 80);
      wrapped.forEach((line, i) => {
        ops.push({
          text: line,
          font: 'F1',
          size: 11,
          leading: 16.5,
          indent: 0,
          colorRgb: [0.1, 0.14, 0.2],
          spaceAfter: i === wrapped.length - 1 ? 5 : 0,
        });
      });
    }
  }

  for (const tbl of note.tables || []) {
    const headerRow = tbl.headers.join('  |  ');
    ops.push({
      text: headerRow,
      font: 'F2',
      size: 10.5,
      leading: 16,
      indent: 0,
      colorRgb: [0.024, 0.373, 0.275],
      spaceBefore: 10,
      spaceAfter: 3,
    });
    for (const row of tbl.rows) {
      const rowStr = row.map((c) => c || '—').join('  |  ');
      const wrapped = wrapTextLines(rowStr, 82);
      wrapped.forEach((line) => {
        ops.push({
          text: line,
          font: 'F1',
          size: 10,
          leading: 15,
          indent: 0,
          colorRgb: [0.15, 0.2, 0.28],
        });
      });
    }
  }

  const pageStreams: string[] = [];
  let currentCmds: string[] = [];
  let cursorY = PAGE_H - MARGIN_TOP;

  const flushPage = () => {
    if (pageStreams.length === 0) {
      currentCmds.unshift(
        `0.02 0.59 0.41 rg ${MARGIN_X} ${PAGE_H - 34} ${CONTENT_W} 2.5 re f`
      );
    }
    pageStreams.push(currentCmds.join('\n'));
    currentCmds = [];
    cursorY = PAGE_H - MARGIN_TOP;
  };

  for (const op of ops) {
    const needed = (op.spaceBefore || 0) + op.leading;
    if (cursorY - needed < MARGIN_BOTTOM && currentCmds.length > 0) {
      flushPage();
    }
    cursorY -= op.spaceBefore || 0;

    if (op.text) {
      const x = MARGIN_X + op.indent;
      const [r, g, b] = op.colorRgb;
      if (op.quoteBar) {
        currentCmds.push(
          `0.06 0.72 0.51 rg ${MARGIN_X + 2} ${cursorY - 3} 2.5 ${op.leading} re f`
        );
      }
      currentCmds.push(
        `BT /${op.font} ${op.size} Tf ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg 1 0 0 1 ${x.toFixed(
          2
        )} ${cursorY.toFixed(2)} Tm ${encodePdfLiteralWinAnsi(op.text)} Tj ET`
      );
    }

    cursorY -= op.leading + (op.spaceAfter || 0);
  }

  if (currentCmds.length > 0 || pageStreams.length === 0) {
    flushPage();
  }

  const objects: string[] = [];
  const addObj = (body: string): number => {
    objects.push(body);
    return objects.length;
  };

  const catalogId = addObj('');
  const pagesId = addObj('');
  const fontRegularId = addObj(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
  );
  const fontBoldId = addObj(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'
  );
  const fontItalicId = addObj(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>'
  );

  const pageIds: number[] = [];
  for (const stream of pageStreams) {
    const contentId = addObj(
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
    );
    const pageId = addObj(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_W.toFixed(
        2
      )} ${PAGE_H.toFixed(
        2
      )}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R /F3 ${fontItalicId} 0 R >> >> /Contents ${contentId} 0 R >>`
    );
    pageIds.push(pageId);
  }

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds
    .map((id) => `${id} 0 R`)
    .join(' ')}] /Count ${pageIds.length} >>`;

  const chunks: string[] = ['%PDF-1.4\n'];
  const offsets: number[] = [0];
  let byteOffset = chunks[0].length;

  for (let i = 0; i < objects.length; i++) {
    offsets.push(byteOffset);
    const entry = `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
    chunks.push(entry);
    byteOffset += entry.length;
  }

  const xrefStart = byteOffset;
  chunks.push(`xref\n0 ${objects.length + 1}\n`);
  chunks.push('0000000000 65535 f \n');
  for (let i = 1; i < offsets.length; i++) {
    chunks.push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  chunks.push(
    `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`
  );

  const fullStr = chunks.join('');
  const bytes = new Uint8Array(fullStr.length);
  for (let i = 0; i < fullStr.length; i++) {
    bytes[i] = fullStr.charCodeAt(i) & 0xff;
  }
  return new Blob([bytes], { type: 'application/pdf' });
}

export async function shareOrDownloadNotePdf(
  note: NoteItem,
  formattedDate: string
): Promise<'shared' | 'downloaded'> {
  const blob = buildNotePdfBlob(note, formattedDate);
  const safeBase = (note.title || 'nota-sisfinz')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const fileName = `${safeBase || 'nota-sisfinz'}.pdf`;

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      const pdfFile = new File([blob], fileName, { type: 'application/pdf' });
      const canShareFiles =
        typeof (navigator as any).canShare === 'function'
          ? (navigator as any).canShare({ files: [pdfFile] })
          : false;
      if (canShareFiles) {
        await navigator.share({
          title: note.title || 'Nota SisFinz',
          files: [pdfFile],
        });
        return 'shared';
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return 'shared';
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'downloaded';
}

function buildPrintableHtmlDocument(note: NoteItem, formattedDate: string): string {
  let num = 0;
  const blocksHtml = (note.blocks || [])
    .map((b) => {
      if (b.type === 'numbered') {
        num += 1;
      } else {
        num = 0;
      }
      const align = b.align ? ` style="text-align:${b.align}"` : '';
      if (b.type === 'heading') return `<h1${align}>${b.html || '&nbsp;'}</h1>`;
      if (b.type === 'subheading') return `<h2${align}>${b.html || '&nbsp;'}</h2>`;
      if (b.type === 'heading3') return `<h3${align}>${b.html || '&nbsp;'}</h3>`;
      if (b.type === 'quote') return `<blockquote${align}>${b.html || '&nbsp;'}</blockquote>`;
      if (b.type === 'checklist') {
        return `<p${align} class="${b.checked ? 'checked' : ''}">${b.checked ? '☑' : '☐'} ${
          b.html || '&nbsp;'
        }</p>`;
      }
      if (b.type === 'bullet') return `<p${align}>• ${b.html || '&nbsp;'}</p>`;
      if (b.type === 'numbered') return `<p${align}><strong>${num}.</strong> ${b.html || '&nbsp;'}</p>`;
      return `<p${align}>${b.html || '&nbsp;'}</p>`;
    })
    .join('');

  const tablesHtml = (note.tables || [])
    .map(
      (tbl) =>
        `<table><thead><tr>${tbl.headers
          .map((h) => `<th>${h}</th>`)
          .join('')}</tr></thead><tbody>${tbl.rows
          .map((r) => `<tr>${r.map((c) => `<td>${c || '—'}</td>`).join('')}</tr>`)
          .join('')}</tbody></table>`
    )
    .join('');

  const imagesHtml =
    (note.images || []).length > 0
      ? `<div class="images">${note.images
          .map((img) => `<img src="${img.url}" alt="" />`)
          .join('')}</div>`
      : '';

  const safeTitle = (note.title || 'Nota sem título')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${safeTitle}</title>
    <style>
      @page { margin: 18mm; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #0f172a;
        line-height: 1.6;
        margin: 0;
        padding: 12px;
      }
      .top-bar { height: 4px; background: #059669; border-radius: 4px; margin-bottom: 16px; }
      h1.doc-title { color: #064e3b; font-size: 24px; margin: 0 0 4px 0; }
      .meta { color: #64748b; font-size: 12px; margin-bottom: 18px; padding-bottom: 10px; border-bottom: 1px solid #e2e8f0; }
      h1 { font-size: 20px; margin: 14px 0 6px; }
      h2 { font-size: 16px; color: #065f46; margin: 12px 0 4px; }
      h3 { font-size: 14px; margin: 10px 0 4px; }
      p { margin: 4px 0; font-size: 13.5px; }
      p.checked { color: #94a3b8; text-decoration: line-through; }
      blockquote { border-left: 3px solid #10b981; padding-left: 12px; color: #475569; font-style: italic; margin: 10px 0; }
      table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 12.5px; }
      th, td { border: 1px solid #cbd5e1; padding: 7px 9px; text-align: left; }
      th { background: #ecfdf5; color: #064e3b; font-weight: 700; }
      .images { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
      .images img { max-width: 48%; max-height: 240px; object-fit: cover; border-radius: 8px; border: 1px solid #e2e8f0; }
    </style>
  </head>
  <body>
    <div class="top-bar"></div>
    <h1 class="doc-title">${safeTitle}</h1>
    <div class="meta">SisFinz Notas • ${formattedDate}</div>
    ${blocksHtml}
    ${tablesHtml}
    ${imagesHtml}
  </body>
</html>`;
}

/**
 * Reliable cross-platform printing:
 * - On iOS standalone PWA (where Apple WebKit silently ignores window.print()),
 *   generates a real .pdf and opens the native iOS Share Sheet (which includes AirPrint / "Imprimir").
 * - On Desktop & standard mobile browsers, prints via an isolated hidden <iframe>
 *   so fixed overlays and overflow-hidden body styles never break or clip the printout.
 */
export async function printNoteDocument(
  note: NoteItem,
  formattedDate: string
): Promise<'printed' | 'ios_share_sheet' | 'downloaded'> {
  const isIOS =
    typeof navigator !== 'undefined' &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
  const isStandalone =
    typeof window !== 'undefined' &&
    ((window.navigator as any).standalone === true ||
      window.matchMedia?.('(display-mode: standalone)')?.matches === true);

  // iOS Home Screen PWA silently ignores window.print() — route to native Share Sheet (AirPrint)
  if (isIOS && isStandalone) {
    const res = await shareOrDownloadNotePdf(note, formattedDate);
    return res === 'shared' ? 'ios_share_sheet' : 'downloaded';
  }

  if (typeof document !== 'undefined') {
    try {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);

      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      const win = iframe.contentWindow;
      if (doc && win && typeof win.print === 'function') {
        doc.open();
        doc.write(buildPrintableHtmlDocument(note, formattedDate));
        doc.close();

        await new Promise<void>((resolve) => {
          let done = false;
          const finish = () => {
            if (done) return;
            done = true;
            resolve();
          };
          const imgs = Array.from(doc.images || []);
          if (imgs.length === 0) {
            window.setTimeout(finish, 80);
            return;
          }
          let pending = imgs.length;
          const onOne = () => {
            pending -= 1;
            if (pending <= 0) finish();
          };
          imgs.forEach((img) => {
            if (img.complete) onOne();
            else {
              img.onload = onOne;
              img.onerror = onOne;
            }
          });
          window.setTimeout(finish, 1200);
        });

        win.focus();
        win.print();

        const cleanup = () => {
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        };
        win.addEventListener?.('afterprint', cleanup, { once: true });
        window.setTimeout(cleanup, 60000);
        return 'printed';
      }
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    } catch {
      // Fall back to PDF share/download
    }
  }

  const res = await shareOrDownloadNotePdf(note, formattedDate);
  return res === 'shared' ? 'ios_share_sheet' : 'downloaded';
}
