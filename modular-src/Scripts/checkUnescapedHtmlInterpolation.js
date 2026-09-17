#!/usr/bin/env node
// scripts/checkUnescapedHtmlInterpolation.js
//
// A heuristic (not a true parser) that scans every shared module and app.js
// for a specific, previously-real bug class found during this project's
// security audit: a free-text field an admin or user controls (title,
// name, notes, description, presenter, label) interpolated directly into
// an HTML template string, without going through an escape function first.
// The worst confirmed instance of this let ANY signed-in user inject live
// script by setting a Cords group name -- not an admin-only concern.
//
// This is intentionally a regex-based heuristic, not a real JavaScript/HTML
// parser -- it can't perfectly tell "this string becomes innerHTML" from
// "this is unrelated data," so it works alongside a small, explicit
// allowlist (ALLOWLIST.md, or ALLOWLIST array below) for lines already
// individually confirmed safe during the audit (native alert()/confirm()
// dialogs, .textContent assignments, hardcoded developer-defined constants,
// system-generated IDs). A NEW match that isn't in the allowlist fails the
// build -- the intent is that a new match should prompt a human to either
// wrap it in an escape call, or -- if it's genuinely safe, the same way the
// allowlisted lines are -- add it to the allowlist with a comment
// explaining why, the same way every allowlist entry below is documented.
//
// This deliberately cannot replace careful review of a NEW pattern this
// heuristic doesn't search for at all (it only looks for the specific field
// names below) -- it's a safety net for the exact bug class already found,
// not a general-purpose security scanner.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FILES_TO_SCAN = [
  'app.js',
  ...fs.readdirSync(path.join(ROOT, 'shared')).filter(f => f.endsWith('.js')).map(f => `shared/${f}`),
];

// Field names established during the audit as the actual risk category:
// free text an admin or user enters, as opposed to system IDs, hardcoded
// constants, or computed values.
const RISKY_FIELD_PATTERN = /\$\{[a-zA-Z0-9_.()|]*\.(title|name|notes|description|presenter|label)\b[^}]*\}/;

// A line is considered already-safe if it contains any of these -- either
// an actual escape call, or a context where HTML injection can't happen
// regardless (a JS dialog, a .textContent/.value assignment which never
// parses its string as HTML).
const SAFE_MARKERS = [
  'escapeHtml(',
  'escapeFoundationsHtml(',
  '.replace(/"/g',
  '.replace(/[&<>"\']/g',
  '.textContent',
  '.value =',
  'alert(`',
  "alert('",
  'confirm(`',
  "confirm('",
];

// Lines individually reviewed during the audit and confirmed safe, kept
// here (rather than silently ignored) so removing or changing one of these
// lines later still gets re-checked against everything else. Each entry
// documents WHY it's safe -- add to this list only after doing the same
// kind of verification the audit itself did (trace the real source, check
// what escaping already happened upstream, confirm via a real test if the
// case is non-obvious), not just to silence the check.
const ALLOWLIST = [
  // openFsvPlayer's title argument is only ever assigned via
  // `titleEl.textContent = ...` (shared/videoPlayer.js) -- .textContent
  // never parses its string as HTML, regardless of content.
  { file: 'shared/coreD.js', contains: 'openFsvPlayer(videos, startVIdx, `${item.title}' },
  { file: 'shared/twBibleCourse.js', contains: 'openFsvPlayer(videos, startVIdx, `${mod.title}' },
  // Hardcoded, developer-defined book order (Genesis..Revelation) -- never
  // admin or user input.
  { file: 'shared/byTheBook.js', contains: 'BIBLE_STUDIES_BOOK_ORDER.forEach((title, i)' },
  // cfg.title here is just BIBLE_STUDIES_BOOK_ORDER's own hardcoded value
  // passed through getBibleStudyBookConfig() unchanged -- see that
  // function's own `return { title, ... }`.
  { file: 'shared/byTheBook.js', contains: 'style="font-family: var(--font-heading); font-size:24px; color:var(--text-main); margin-bottom:6px;">${cfg.title}' },
  { file: 'shared/byTheBook.js', contains: 'style="font-family: var(--font-heading); font-size:28px; color:var(--text-main); margin-bottom:12px;">${cfg.title}' },
  // Hardcoded shape/color name catalog (shared/records.js's
  // RECORD_BIBLE_ICON_SHAPES / RECORD_BIBLE_ICON_COLORS) -- e.g. "Feather
  // Pen", "Indigo" -- never admin or user input.
  { file: 'shared/records.js', contains: "label: `${shape.name} (${color.name})`" },
  { file: 'shared/records.js', contains: 'RECORD_BIBLE_BADGE_ICONS.map(item =>' },
  // Just a lookup key built by joining two values with "::", never
  // inserted into HTML at all.
  { file: 'app.js', contains: '`${cfg.title}::${i}`' },
  // esc() (defined a few lines above this call, local to this function)
  // already escapes double quotes specifically for this value="..."
  // attribute context -- confirmed sufficient earlier in the audit (an
  // unescaped < or > can't break out of an already quote-delimited
  // attribute value; only the delimiting quote character itself matters
  // there).
  { file: 'shared/churchResources.js', contains: 'id="church-edit-title-${idAttr}"' },
  // A plain data-property assignment on a cloned object (the "Duplicate
  // Module" admin feature) -- never inserted into HTML at all.
  { file: 'shared/twBibleCourse.js', contains: "clone.title = clone.title ?" },
  // Inside a multi-line alert(...) call whose own opening "alert(" sits on
  // an earlier line than the interpolation itself -- this script checks
  // one line at a time, so it can't see the alert( a few lines up. A
  // native alert() dialog only ever displays plain text, never parses its
  // argument as HTML, regardless of content.
  { file: 'shared/twBibleCourse.js', contains: '? `Saved! "${saved.title}" is now live for everyone. Since this is the first module' },
  { file: 'shared/twBibleCourse.js', contains: ': `Saved! "${saved.title}" is now live for everyone.`);' },
  // cordAvatarHtml passes name through to cordAvatarInitial, which now
  // escapes its own single-character output itself -- the actual escape
  // call is one function deeper than this heuristic (which only looks at
  // the line calling cordAvatarHtml, not inside its own definition) can see.
  { file: 'shared/cords.js', contains: 'cordAvatarHtml(c.name, c.avatarSeed, c.isGroup, 40)' },
  { file: 'shared/cords.js', contains: 'cordAvatarHtml(p.name, p.avatarSeed, p.isGroup, 44)' },
  { file: 'shared/cords.js', contains: 'cordAvatarHtml(c.name, c.avatarSeed, c.isGroup, 48)' },
];

function isAllowlisted(file, line) {
  return ALLOWLIST.some(entry => entry.file === file && line.includes(entry.contains));
}

function isSafeLine(line) {
  return SAFE_MARKERS.some(marker => line.includes(marker));
}

// Scans arbitrary (fileName, content) pairs for violations -- pulled out
// as its own function, separate from the CLI logic below (which reads real
// files, prints to the console, and calls process.exit), specifically so
// tests/checkUnescapedHtmlInterpolation.test.js can exercise the real
// detection logic directly, against small fixture strings, without
// touching any actual source file or spawning a subprocess.
function findViolations(fileContentPairs) {
  const violations = [];
  for (const { file, content } of fileContentPairs) {
    content.split('\n').forEach((line, idx) => {
      if (!RISKY_FIELD_PATTERN.test(line)) return;
      if (isSafeLine(line)) return;
      if (isAllowlisted(file, line)) return;
      violations.push({ file, lineNumber: idx + 1, line: line.trim() });
    });
  }
  return violations;
}

module.exports = { RISKY_FIELD_PATTERN, SAFE_MARKERS, ALLOWLIST, isAllowlisted, isSafeLine, findViolations };

// Only actually scan the real project files and exit the process when this
// file is run directly (`node scripts/checkUnescapedHtmlInterpolation.js`,
// which is what package.json's checkUnescaped script does) -- not when
// it's `require(...)`d as a module by a test.
if (require.main === module) {
  const fileContentPairs = FILES_TO_SCAN.map(relPath => ({
    file: relPath,
    content: fs.readFileSync(path.join(ROOT, relPath), 'utf8'),
  }));
  const violations = findViolations(fileContentPairs);

  if (violations.length > 0) {
    console.error(`\n✗ Found ${violations.length} potentially-unescaped HTML interpolation${violations.length === 1 ? '' : 's'}:\n`);
    violations.forEach(v => {
      console.error(`  ${v.file}:${v.lineNumber}`);
      console.error(`    ${v.line}\n`);
    });
    console.error('Each match above interpolates a title/name/notes/description/presenter/label');
    console.error('field without an obvious escape call. If it genuinely inserts into HTML,');
    console.error('wrap it in escapeHtml(...) or escapeFoundationsHtml(...). If it\'s actually');
    console.error('safe (a hardcoded constant, a .textContent assignment, etc.), add it to the');
    console.error('ALLOWLIST array in scripts/checkUnescapedHtmlInterpolation.js with a comment');
    console.error('explaining why -- the same way the existing allowlist entries are documented.\n');
    process.exit(1);
  } else {
    console.log(`✓ No unescaped HTML interpolation found (scanned ${FILES_TO_SCAN.length} files, ${ALLOWLIST.length} allowlisted lines).`);
  }
}
