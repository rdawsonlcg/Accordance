// tests/checkUnescapedHtmlInterpolation.test.js — tests the detection tool
// itself (scripts/checkUnescapedHtmlInterpolation.js), added after a code-
// level security audit found several real, previously-shipped instances of
// admin/user-entered fields (titles, names, notes) being inserted into
// rendered HTML without an escape call -- most severely, Cords group names
// (settable by any regular user, not just admins). This tool exists so a
// NEW instance of the same bug class gets caught mechanically in CI, not
// only when someone happens to manually search for it again.
//
// findViolations() is exercised directly against small fixture strings
// here, rather than the real project files (which the CLI entry point --
// only run when the script is invoked directly, not required as a module
// -- scans separately, exercised by scripts/checkUnescapedHtmlInterpolation.js
// itself passing cleanly as part of `npm run check`).

const test = require('node:test');
const assert = require('node:assert');
const { findViolations, isSafeLine, isAllowlisted } = require('../scripts/checkUnescapedHtmlInterpolation.js');

test('flags an unescaped title interpolated into an HTML template', () => {
  const violations = findViolations([
    { file: 'fake.js', content: 'return `<div>${badge.title}</div>`;' },
  ]);
  assert.strictEqual(violations.length, 1);
  assert.strictEqual(violations[0].file, 'fake.js');
});

test('does not flag a value already wrapped in escapeHtml(...)', () => {
  const violations = findViolations([
    { file: 'fake.js', content: 'return `<div>${escapeHtml(badge.title)}</div>`;' },
  ]);
  assert.strictEqual(violations.length, 0);
});

test('does not flag a value already wrapped in escapeFoundationsHtml(...)', () => {
  const violations = findViolations([
    { file: 'fake.js', content: 'return `<div>${escapeFoundationsHtml(item.title)}</div>`;' },
  ]);
  assert.strictEqual(violations.length, 0);
});

test('does not flag a value used in a .textContent assignment', () => {
  const violations = findViolations([
    { file: 'fake.js', content: 'titleEl.textContent = `${mod.title} — ${label}`;' },
  ]);
  assert.strictEqual(violations.length, 0);
});

test('does not flag a value inside a native alert()/confirm() dialog', () => {
  const violations = findViolations([
    { file: 'fake.js', content: 'alert(`Saved! "${saved.title}" is now live.`);' },
    { file: 'fake.js', content: "if (!confirm(`Delete \"${mod.title}\"?`)) return;" },
  ]);
  assert.strictEqual(violations.length, 0);
});

test('does not flag a line matching an explicit ALLOWLIST entry', () => {
  // Uses a real allowlist entry rather than a synthetic one, so this test
  // breaks (correctly) if that entry's exact matched text ever drifts from
  // the real source line it's meant to cover.
  const violations = findViolations([
    { file: 'shared/twBibleCourse.js', content: "      clone.title = clone.title ? `${clone.title} (Copy)` : 'Untitled Lesson (Copy)';" },
  ]);
  assert.strictEqual(violations.length, 0);
});

test('DOES flag the same unsafe pattern even if the file happens to share a name with an allowlisted file, when the line content does not match', () => {
  const violations = findViolations([
    { file: 'shared/twBibleCourse.js', content: 'return `<div>${lesson.title}</div>`;' },
  ]);
  assert.strictEqual(violations.length, 1, 'an allowlist entry should only suppress its own exact line content, not every risky line in that file');
});

test('the real project (as currently shipped) has zero un-allowlisted violations', () => {
  // The actual regression guard: runs the real detection logic against the
  // real, current source files -- if this ever fails, either a genuine new
  // bug was introduced, or a legitimately-safe new pattern needs its own
  // reviewed, documented ALLOWLIST entry (see the header comment in
  // scripts/checkUnescapedHtmlInterpolation.js for what "reviewed" means
  // here -- not just adding an entry to make the failure go away).
  const fs = require('fs');
  const path = require('path');
  const root = path.join(__dirname, '..');
  const files = [
    'app.js',
    ...fs.readdirSync(path.join(root, 'shared')).filter(f => f.endsWith('.js')).map(f => `shared/${f}`),
  ];
  const fileContentPairs = files.map(file => ({ file, content: fs.readFileSync(path.join(root, file), 'utf8') }));
  const violations = findViolations(fileContentPairs);
  if (violations.length > 0) {
    console.log(violations.map(v => `${v.file}:${v.lineNumber}: ${v.line}`).join('\n'));
  }
  assert.strictEqual(violations.length, 0);
});
