// ============================================================================
// shared/adminUtils.js — utilities shared by all three admin content
// screens (Core-D, TW Bible Course, "By the Book"), which previously each
// had their own independently-maintained copy of this logic:
//
//   - makeAdminDragReorder      drag-and-drop reordering of a list of rows
//   - makeAdminQuizArrayController / renderAdminQuizEditorBlock
//                               the Knowledge Check question editor
//   - applyContentFormat / handleContentPaste / handleTableUpload /
//     insertTableAtCursor / insertConvertedTextAtCursor /
//     htmlToFoundationsMarkdown / foundationsRowsToMarkdownTable /
//     foundationsParseDelimitedText
//                               the "Lesson/Session Content" formatting
//                               toolbar, rich-paste conversion, and table
//                               insertion/upload
//
// Each screen's own per-screen wrapper functions (e.g. applyFoundationsFormat,
// applyTWCourseAdminFormat) stay in app.js — they're the thin, screen-specific
// glue that knows which textarea id and admin-state update function to use,
// and aren't shared with anything else.
// ============================================================================

// ------------------------------------------------------------------
// Generic drag-and-drop reordering for an admin list — shared by "By the
// Book" sessions, Core-D sessions, and TW Bible Course lessons, which
// previously each had their own independently-maintained copy of this
// exact logic. Call once per admin screen with (a) a function that
// returns that screen's live state array, (b) that screen's render
// function, and (c) that screen's list container id; get back the five
// event handlers its card markup wires up via ondragstart/over/leave/
// drop/end. Each call's `draggedIndex` is private to that instance, so
// dragging in one screen can never interfere with another's.
// ------------------------------------------------------------------
export function makeAdminDragReorder(getState, renderFn, containerId) {
  let draggedIndex = null;
  return {
    dragStart(event, idx) {
      draggedIndex = idx;
      event.dataTransfer.effectAllowed = 'move';
      try { event.dataTransfer.setData('text/plain', String(idx)); } catch (e) {}
      event.currentTarget.classList.add('dragging');
    },
    dragOver(event, idx) {
      event.preventDefault(); // required to allow a drop
      event.dataTransfer.dropEffect = 'move';
      if (draggedIndex === null || draggedIndex === idx) return;
      event.currentTarget.classList.add('drag-over');
    },
    dragLeave(event) {
      event.currentTarget.classList.remove('drag-over');
    },
    drop(event, idx) {
      event.preventDefault();
      event.currentTarget.classList.remove('drag-over');
      if (draggedIndex === null || draggedIndex === idx) return;
      const state = getState();
      const [moved] = state.splice(draggedIndex, 1);
      state.splice(idx, 0, moved);
      draggedIndex = null;
      renderFn();
    },
    dragEnd() {
      draggedIndex = null;
      document.querySelectorAll(`#${containerId} .session-drag-card`).forEach(el => {
        el.classList.remove('dragging', 'drag-over');
      });
    }
  };
}

// ------------------------------------------------------------------
// Generic CRUD for a "quizzes" array living on some admin-state item (a
// TW lesson or a Core-D session) — shared by both, which previously each
// had their own identical copy of this add/remove/update logic.
// getContainer(itemIdx) must return the object that holds (or should
// start holding) a `.quizzes` array.
// ------------------------------------------------------------------
export function makeAdminQuizArrayController(getContainer) {
  return {
    add(itemIdx) {
      const item = getContainer(itemIdx);
      if (!item) return;
      if (!item.quizzes) item.quizzes = [];
      item.quizzes.push({ question: '', options: ['', '', '', ''], correctIndex: 0, explanation: '' });
    },
    remove(itemIdx, quizIdx) {
      const item = getContainer(itemIdx);
      if (!item || !item.quizzes) return;
      item.quizzes.splice(quizIdx, 1);
    },
    updateField(itemIdx, quizIdx, field, value) {
      const quiz = getContainer(itemIdx) && getContainer(itemIdx).quizzes[quizIdx];
      if (!quiz) return;
      quiz[field] = value;
    },
    updateOption(itemIdx, quizIdx, optIdx, value) {
      const quiz = getContainer(itemIdx) && getContainer(itemIdx).quizzes[quizIdx];
      if (!quiz) return;
      quiz.options[optIdx] = value;
    },
    setCorrect(itemIdx, quizIdx, optIdx) {
      const quiz = getContainer(itemIdx) && getContainer(itemIdx).quizzes[quizIdx];
      if (!quiz) return;
      quiz.correctIndex = optIdx;
    }
  };
}

// Shared markup for one Knowledge Check question's editor block — used
// by Core-D's per-video quiz, Core-D's per-session quiz, and TW's
// per-lesson quiz, which previously each rendered their own copy of this
// same ~14-line block. Callers supply the actual global function names
// (as strings — this returns an HTML string, so its onclick/oninput
// attributes have to name real functions rather than close over any)
// along with whatever copy/labeling differs between the three.
export function renderAdminQuizEditorBlock(opts) {
  const { idxA, idxB, quiz, headerLabel, removeButtonLabel, removeFnName, updateFieldFnName, updateOptionFnName, setCorrectFnName, questionPlaceholder, helperText, radioName, explanationPlaceholder } = opts;
  const options = (quiz.options && quiz.options.length === 4) ? quiz.options : ['', '', '', ''];
  return `
    <div style="border:1px dashed var(--border-color); border-radius:var(--border-radius); padding:12px; background:var(--bg-color); margin-bottom:10px;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
        <span style="font-weight:700; font-size:12px; text-transform:uppercase; letter-spacing:0.4px; color:var(--text-muted);">${headerLabel}</span>
        <button type="button" class="page-btn" style="background:#fee2e2; color:#b91c1c; border-color:#fca5a5;" onclick="${removeFnName}(${idxA}, ${idxB})">${removeButtonLabel}</button>
      </div>
      <textarea class="input-field" style="margin-bottom:8px; min-height:50px; resize:vertical;" oninput="${updateFieldFnName}(${idxA}, ${idxB}, 'question', this.value)" placeholder="${questionPlaceholder}">${(quiz.question || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</textarea>
      <div style="color:var(--text-muted); font-size:11.5px; margin-bottom:8px;">${helperText}</div>
      ${options.map((opt, oIdx) => `
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
          <input type="radio" name="${radioName}" ${quiz.correctIndex === oIdx ? 'checked' : ''} onchange="${setCorrectFnName}(${idxA}, ${idxB}, ${oIdx})" style="width:16px; height:16px; flex-shrink:0;" title="Mark as the correct answer">
          <input type="text" class="input-field" style="margin-bottom:0; flex:1;" value="${(opt || '').replace(/"/g, '&quot;')}" oninput="${updateOptionFnName}(${idxA}, ${idxB}, ${oIdx}, this.value)" placeholder="Option ${oIdx + 1}">
        </div>`).join('')}
      <textarea class="input-field" style="margin-bottom:0; margin-top:4px; min-height:40px; resize:vertical;" oninput="${updateFieldFnName}(${idxA}, ${idxB}, 'explanation', this.value)" placeholder="${explanationPlaceholder || 'Brief explanation shown after they answer (optional)'}">${(quiz.explanation || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</textarea>
    </div>`;
}


export function foundationsRowsToMarkdownTable(rows) {
  if (!rows || rows.length === 0) return '';
  const width = rows.reduce((max, r) => Math.max(max, r.length), 0);
  if (width === 0) return '';
  const escapeCell = cell => String(cell == null ? '' : cell).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
  const padded = rows.map(r => Array.from({ length: width }, (_, i) => escapeCell(r[i])));
  const lineOf = cells => '| ' + cells.join(' | ') + ' |';
  const lines = [lineOf(padded[0]), lineOf(padded[0].map(() => '---'))];
  padded.slice(1).forEach(r => lines.push(lineOf(r)));
  return lines.join('\n');
}

// Auto-detects tab- vs comma-delimited text (an uploaded file could be
// either) and splits it into rows of cells.
export function foundationsParseDelimitedText(text) {
  const lines = (text || '').replace(/\r/g, '').split('\n').filter(l => l.length > 0);
  if (lines.length === 0) return [];
  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  return lines.map(line => foundationsSplitDelimitedLine(line, delimiter));
}

// Builds "| a | b |\n| --- | --- |\n| c | d |" from [[a,b],[c,d]] (first
// row = header). A literal "|" in a cell (rare, but possible in real
// spreadsheet data) is escaped as "\|" — see foundationsSplitTableRow's
// matching unescape — so it can't be mistaken for a column separator;
// a stray newline inside a cell is flattened to a space, since a table
// row here is always exactly one text line.
// Converts pasted rich text (the clipboard's HTML, not its plain-text
// fallback) into this app's own formatting tokens — **bold**, *italic*,
// __underline__, [text](url) links, "# "/"## " headings, "- " bullets,
// markdown tables, and footnotes — so copying from Word, Google Docs, or
// a webpage keeps its formatting instead of arriving as flat,
// unformatted text the way pasting into a plain <textarea> normally
// would. Checks both semantic tags (<b>, <i>, <u>, <h1>-<h6>) AND inline
// styles/class names, since Word in particular exports formatting as
// `<span style="font-weight:bold">` and headings as `<p class=MsoHeading1>`
// rather than <strong>/<h1>.
//
// Footnotes: this content format has no real hyperlinked footnote concept,
// so the best available approximation is used — a superscript reference
// in the body (<sup>) becomes a plain "[1]" marker, the matching
// footnote-text block (Word/Docs give these a distinguishable id, e.g.
// "ftn1"/"fn1"/"footnote1") is pulled out of the normal flow, and every
// captured footnote is listed under a "Footnotes" heading appended at the
// very end — so the information survives even though it's no longer a
// clickable jump-to-note link.
export function htmlToFoundationsMarkdown(html) {
  const container = document.createElement('div');
  container.innerHTML = html;

  const FOOTNOTE_ID_RE = /^(?:ftnt|ftn|fn|edn|footnote|endnote)[-_]?(\d+)$/i;
  const footnotes = []; // [{ n, text }], in the order encountered

  function inline(node) {
    let out = '';
    node.childNodes.forEach(child => {
      if (child.nodeType === 3) { out += child.textContent; return; }
      if (child.nodeType !== 1) return;
      const tag = child.tagName.toLowerCase();
      if (tag === 'script' || tag === 'style') return;
      if (tag === 'sup') {
        // A footnote reference marker in the body — reduced to a plain
        // "[1]" rather than true superscript, which this content format
        // has no way to render.
        const digits = child.textContent.replace(/\D/g, '');
        out += digits ? `[${digits}]` : `[${inline(child).trim()}]`;
        return;
      }
      let inner = inline(child);
      const style = child.getAttribute('style') || '';
      const isBold = tag === 'b' || tag === 'strong' || /font-weight:\s*(bold|[6-9]00)/i.test(style);
      const isItalic = tag === 'i' || tag === 'em' || /font-style:\s*italic/i.test(style);
      const isUnderline = tag === 'u' || /text-decoration(-line)?:\s*underline/i.test(style);
      if (inner.trim()) {
        if (isBold) inner = `**${inner}**`;
        if (isItalic) inner = `*${inner}*`;
        if (isUnderline) inner = `__${inner}__`;
      }
      if (tag === 'a' && child.getAttribute('href')) inner = `[${inner}](${child.getAttribute('href')})`;
      if (tag === 'br') inner += '\n';
      out += inner;
    });
    return out;
  }

  // Word/Docs-style heading class names — e.g. class="MsoHeading2" or
  // class="heading-3" — for editors that export a styled <p> instead of a
  // real <h1>-<h6> tag.
  function headingLevelFromClass(el) {
    const cls = el.getAttribute('class') || '';
    const m = cls.match(/heading[\s_-]?(\d)/i);
    return m ? Math.min(4, parseInt(m[1], 10)) : 0;
  }

  function walkBlocks(node, lines) {
    node.childNodes.forEach(child => {
      if (child.nodeType === 3) {
        const t = child.textContent;
        if (t.trim()) lines.push(t.trim());
        return;
      }
      if (child.nodeType !== 1) return;
      const tag = child.tagName.toLowerCase();
      if (tag === 'script' || tag === 'style') return;

      // A footnote's own text block — pulled out of the normal flow and
      // collected instead, regardless of what tag it's actually wrapped in.
      const id = child.getAttribute('id') || '';
      const footnoteMatch = id.match(FOOTNOTE_ID_RE);
      if (footnoteMatch) {
        // Strip the footnote's own leading back-reference marker (usually
        // a link like <a href="#ftnt_ref1">[1]</a>, sometimes a bare
        // <sup>) before extracting its text — it's just the number
        // repeated, not part of the actual footnote content, and the
        // "[N]" this function prepends below already covers it. Without
        // this, that leading link ends up captured as literal text.
        const clone = child.cloneNode(true);
        const first = clone.firstChild;
        if (first && first.nodeType === 1 && /^(a|sup)$/i.test(first.tagName)) clone.removeChild(first);
        const text = inline(clone).trim().replace(/^\[?\d+\]?[.\s]*/, '').trim();
        if (text) footnotes.push({ n: parseInt(footnoteMatch[1], 10), text });
        return;
      }

      if (tag === 'table') {
        const rows = [];
        child.querySelectorAll('tr').forEach(tr => {
          const cells = [];
          tr.querySelectorAll('td, th').forEach(td => cells.push(inline(td).trim()));
          if (cells.length) rows.push(cells);
        });
        const md = foundationsRowsToMarkdownTable(rows);
        if (md) lines.push(md);
      } else if (tag === 'ul' || tag === 'ol') {
        const items = [];
        child.querySelectorAll(':scope > li').forEach(li => {
          const text = inline(li).trim();
          if (text) items.push(`- ${text}`);
        });
        if (items.length) lines.push(items.join('\n'));
      } else if (/^h[1-6]$/.test(tag)) {
        const level = Math.min(4, parseInt(tag[1], 10));
        const text = inline(child).trim();
        if (text) lines.push(`${'#'.repeat(level)} ${text}`);
      } else if (tag === 'p' || tag === 'div') {
        const classLevel = headingLevelFromClass(child);
        const text = inline(child).trim();
        if (!text) return;
        lines.push(classLevel ? `${'#'.repeat(classLevel)} ${text}` : text);
      } else {
        walkBlocks(child, lines);
      }
    });
  }

  const lines = [];
  walkBlocks(container, lines);

  if (footnotes.length > 0) {
    footnotes.sort((a, b) => a.n - b.n);
    lines.push(`#### Footnotes`);
    lines.push(footnotes.map(f => `[${f.n}] ${f.text}`).join('\n'));
  }

  return lines.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

// Inserts already-converted (markdown-token) plain text into a content
// textarea at the cursor and pushes it into the given admin state field —
// shared by the rich-paste path below for both Foundations and TW.
export function insertConvertedTextAtCursor(textarea, text, updateFn) {
  if (!textarea || !text) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  textarea.value = value.substring(0, start) + text + value.substring(end);
  updateFn(textarea.value);
  const newPos = start + text.length;
  textarea.focus();
  textarea.setSelectionRange(newPos, newPos);
}

// Builds a markdown table from parsed rows and drops it in at the cursor
// via insertConvertedTextAtCursor (defined further down, alongside
// foundationsRowsToMarkdownTable/foundationsParseDelimitedText) — same
// insert-and-reposition-cursor behavior a rich-text paste uses, just with
// a table's worth of text instead of converted prose.
export function insertTableAtCursor(textarea, updateFn, rows) {
  const md = foundationsRowsToMarkdownTable(rows);
  if (!md) { alert('No table data found.'); return; }
  insertConvertedTextAtCursor(textarea, `\n\n${md}\n\n`, updateFn);
}

// ------------------------------------------------------------------
// Shared "Lesson/Session Content" formatting toolbar + paste/table-upload
// logic — used by both Core-D and TW Bible Course, which previously each
// had their own identical copy of all four pieces below. Each operates
// directly on a given textarea + updateFn rather than looking either up
// itself, so the two screens' thin per-screen wrappers (defined right
// after each function, and again further down for Core-D) are the only
// places that know which textarea id / admin-state update function to use.
// ------------------------------------------------------------------
export function applyContentFormat(textarea, updateFn, kind) {
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  const selected = value.substring(start, end);

  if (kind === 'bullet') {
    // Bulleted lists are line-based rather than wrapped around a
    // selection like bold/italic/underline: turn every selected line (or
    // just the current line, when nothing is selected) into its own
    // "- " markdown-style bullet, one per line. Running it again on an
    // already-bulleted block toggles the bullets back off.
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    let lineEnd = value.indexOf('\n', end);
    if (lineEnd === -1) lineEnd = value.length;
    const block = value.substring(lineStart, lineEnd);
    const lines = block.split('\n');
    const contentLines = lines.filter(line => line.trim() !== '');
    const alreadyBulleted = contentLines.length > 0 && contentLines.every(line => /^-\s/.test(line));
    const newLines = lines.map(line => {
      if (line.trim() === '') return line;
      return alreadyBulleted ? line.replace(/^-\s?/, '') : `- ${line}`;
    });
    const newBlock = newLines.join('\n');
    textarea.value = value.substring(0, lineStart) + newBlock + value.substring(lineEnd);
    updateFn(textarea.value);
    textarea.focus();
    textarea.setSelectionRange(lineStart, lineStart + newBlock.length);
    return;
  }

  let before = '', after = '', placeholder = '';
  if (kind === 'bold') { before = '**'; after = '**'; placeholder = 'bold text'; }
  else if (kind === 'italic') { before = '*'; after = '*'; placeholder = 'italic text'; }
  else if (kind === 'underline') { before = '__'; after = '__'; placeholder = 'underlined text'; }
  else if (kind === 'link') {
    const url = prompt('Link URL:', 'https://');
    if (!url) return;
    before = '[';
    after = `](${url.trim()})`;
    placeholder = 'link text';
  } else if (kind === 'image') {
    const url = prompt('Image URL:', 'https://');
    if (!url) return;
    // Inserted on its own line (blank lines before/after, when there's
    // existing content) since an image is a block-level element once
    // rendered, not something that reads naturally inline mid-sentence the
    // way a bold word or a link does.
    const needsLeadingBreak = start > 0 && value[start - 1] !== '\n';
    before = (needsLeadingBreak ? '\n\n' : '') + '![';
    after = `](${url.trim()})\n`;
    placeholder = 'image description';
  } else if (kind === 'gallery') {
    // Starter block of two placeholder image lines -- the actual gallery
    // grouping (shared/coreD.js's applyFoundationsMarkup) triggers on any
    // 2+ consecutive image lines, so this just gives the admin a
    // ready-to-edit example of that shape rather than requiring them to
    // already know the convention themselves. Both placeholder URLs get
    // selected together first, so typing immediately replaces the first
    // one; the second still needs its own edit afterward.
    const needsLeadingBreak = start > 0 && value[start - 1] !== '\n';
    const block = (needsLeadingBreak ? '\n\n' : '') +
      '![First image](https://...)\n![Second image](https://...)\n';
    textarea.value = value.substring(0, start) + block + value.substring(end);
    updateFn(textarea.value);
    const urlStart = start + (needsLeadingBreak ? 2 : 0) + '!['.length + 'First image'.length + 2;
    textarea.focus();
    textarea.setSelectionRange(urlStart, urlStart + 'https://...'.length);
    return;
  } else {
    return;
  }

  const text = selected || placeholder;
  textarea.value = value.substring(0, start) + before + text + after + value.substring(end);
  updateFn(textarea.value);

  // Leave the inserted text selected so the admin can immediately type
  // over the placeholder, or keep layering more formatting onto it.
  const selStart = start + before.length;
  const selEnd = selStart + text.length;
  textarea.focus();
  textarea.setSelectionRange(selStart, selEnd);
}

// Fires on every paste into a content textarea. A paste that carries rich
// HTML (Word, Google Docs, a webpage — practically anything copied from a
// browser or word processor) is converted to this app's own bold/italic/
// underline/link/table tokens via htmlToFoundationsMarkdown instead of
// arriving as flat text. Failing that, a paste that looks like
// spreadsheet cells (a tab character — the shape Excel/Sheets/Numbers use
// for a copied range) becomes a table; anything else is left alone.
export function handleContentPaste(event, textarea, updateFn) {
  const clipboard = event.clipboardData || window.clipboardData;
  const html = clipboard ? clipboard.getData('text/html') : '';
  if (html && html.trim()) {
    const converted = htmlToFoundationsMarkdown(html);
    if (converted) {
      event.preventDefault();
      insertConvertedTextAtCursor(textarea, converted, updateFn);
      return;
    }
  }
  const text = clipboard ? clipboard.getData('text/plain') : '';
  if (!text || !text.includes('\t')) return;
  event.preventDefault();
  insertTableAtCursor(textarea, updateFn, foundationsParseDelimitedText(text));
}

// Fires when an admin picks a file from the "Upload a table" button's
// file input. Read as plain text client-side (no server round-trip) and
// parsed the same way a paste is — a .csv or .tsv/.txt export from any
// spreadsheet program works.
export function handleTableUpload(event, textarea, updateFn) {
  const file = event.target.files && event.target.files[0];
  event.target.value = ''; // reset so choosing the same file again still fires 'change'
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const rows = foundationsParseDelimitedText(String(reader.result || ''));
    if (rows.length === 0) { alert('Could not find any rows in that file.'); return; }
    insertTableAtCursor(textarea, updateFn, rows);
  };
  reader.onerror = () => alert('Could not read that file.');
  reader.readAsText(file);
}
