// tests/checkDependencies.js — a permanent, automated version of a check
// that was done by hand, ad-hoc, many times over this project's history: for
// every shared/*.js module, does it reference a table accessor
// (`someTable.method(...)`) or `supabaseClient` directly without actually
// importing it?
//
// This exact class of bug shipped THREE separate times before this check
// existed — shared/churchResources.js missing churchResourcesTable,
// shared/twBibleCourse.js missing twCourseProgressTable, and
// shared/cords.js almost missing cordMembersTable (caught before shipping,
// that last time, only because this exact pattern had already burned twice).
// Each slipped through because a plain call like `.insert(...)` or
// `.select(...)` reads as a generic method call — nothing about it LOOKS
// like a missing import, so nothing forces a human re-checking the code to
// notice. A build succeeding doesn't catch it either: a bare, undeclared
// identifier is valid enough JavaScript for a bundler to accept — it only
// becomes a ReferenceError the first time that exact line actually runs.
//
// Deliberately handles the receiver appearing on a DIFFERENT line than its
// `.method(` call (`cordMembersTable\n  .select(...)`) — a single-line
// regex was exactly what let the cordMembersTable case slip through the
// first version of this same check.
//
// Run standalone with: node tests/checkDependencies.js
// Also run as part of `npm test` (see checkDependencies.test.js).

const fs = require('fs');
const path = require('path');

const SHARED_DIR = path.join(__dirname, '..', 'src', 'shared');

function getImportedNames(source) {
  const names = new Set();
  for (const m of source.matchAll(/import\s*\{([^}]*)\}\s*from/g)) {
    for (const raw of m[1].split(',')) {
      const name = raw.trim().split(/\s+as\s+/).pop().trim();
      if (name) names.add(name);
    }
  }
  // A bare `import x from 'y'` (default import) — not currently used
  // anywhere in this codebase, but harmless to also recognize.
  for (const m of source.matchAll(/import\s+(\w+)\s+from/g)) {
    names.add(m[1]);
  }
  return names;
}

function getLocallyDefinedNames(source) {
  const names = new Set();
  for (const m of source.matchAll(/(?:export\s+)?(?:async function|function|let|const)\s+(\w+)/g)) {
    names.add(m[1]);
  }
  return names;
}

// Every table accessor in this app is named with a "...Table" suffix (the
// convention `core/db.js`'s createTableAccessor sets up), which is what
// makes this check possible: a receiver name like "recordsTable" or
// "cordMembersTable" is instantly recognizable as a table accessor, not just
// some arbitrary object. Matches the receiver even when a line break
// separates it from its `.method(` call.
//
// Deliberately does NOT also check supabaseClient itself: unlike a table
// accessor, it's never an ES module export anywhere in this app — it's a
// genuine pre-existing global, created by a separate, untouched <script>
// tag outside the whole module graph (see core/db.js's own header comment
// for why that's safe). There's no correct import to check for, since
// there's nowhere to import it from — every module that references it
// bare is doing so on purpose, not by accident.
function findTableAccessorReceivers(source) {
  const names = new Set();
  for (const m of source.matchAll(/\b(\w*Table)\s*\n?\s*\./g)) {
    names.add(m[1]);
  }
  return names;
}

function checkFile(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const imported = getImportedNames(source);
  const locallyDefined = getLocallyDefinedNames(source);
  const used = findTableAccessorReceivers(source);

  const missing = [...used].filter(name => !imported.has(name) && !locallyDefined.has(name));
  return { file: path.relative(path.join(__dirname, '..'), filePath), missing };
}

function checkAllModules() {
  const files = fs.readdirSync(SHARED_DIR)
    .filter(f => f.endsWith('.js'))
    .map(f => path.join(SHARED_DIR, f));
  return files.map(checkFile);
}

if (require.main === module) {
  const results = checkAllModules();
  let anyMissing = false;
  for (const { file, missing } of results) {
    if (missing.length > 0) {
      anyMissing = true;
      console.error(`${file}: missing import for ${missing.join(', ')}`);
    }
  }
  if (anyMissing) {
    process.exit(1);
  } else {
    console.log(`Checked ${results.length} module(s) in src/shared/ — every table accessor and supabaseClient reference is properly imported.`);
  }
}

module.exports = { checkAllModules, checkFile };
