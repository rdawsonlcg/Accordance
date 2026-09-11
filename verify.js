// verify.js — confirms every function actually called from an onclick/
// oninput/onchange/etc. attribute anywhere in the built HTML is genuinely
// reachable as a global after bundling. Run this after every build, always
// -- and especially after touching the `export { ... }` block at the bottom
// of app.js, or after splitting any more code into new modules.
//
// Run with: node verify.js
//
// Why this exists: an earlier version of this check only found the FIRST
// function call immediately after on*="..." and missed anything chained
// after it -- e.g. onchange="if (!ensureLoggedInFor('...')) return; realFn()"
// silently lost `ensureLoggedInFor` and `realFn` both. That gap shipped
// silently until a user reported a broken feature. This version scans the
// ENTIRE value of every event attribute for every function-call-shaped
// identifier in it, not just the first one.

const fs = require('fs');
const path = require('path');

const JS_KEYWORDS = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'typeof',
  'new', 'delete', 'void', 'instanceof', 'in', 'of', 'do', 'else', 'try', 'throw'
]);

function findRequiredGlobalNames(html) {
  const names = new Set();
  // Every event-handler-style attribute's full value, not just its start.
  for (const m of html.matchAll(/on\w+="([^"]*)"/g)) {
    const value = m[1];
    // A bare identifier immediately followed by "(" -- but not one preceded
    // by "." (a method call like event.target.blur(), not a global function).
    const re = /(?<![.\w])([a-zA-Z_]\w*)\(/g;
    let mm;
    while ((mm = re.exec(value))) {
      if (!JS_KEYWORDS.has(mm[1])) names.add(mm[1]);
    }
  }
  return names;
}

function findExportedNames(bundledScript) {
  const exportBlockMatch = bundledScript.match(/__export\(app_exports,\s*\{([\s\S]*?)\}\);/);
  const names = new Set();
  if (exportBlockMatch) {
    for (const m of exportBlockMatch[1].matchAll(/(\w+):/g)) names.add(m[1]);
  }
  return names;
}

function verify(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .filter(m => !/^<script\s+src=/.test(m[0]));

  if (scripts.length === 0) {
    console.error('No inline <script> blocks found -- did the build actually run?');
    process.exit(1);
  }

  // Syntax-check every inline script.
  let syntaxOk = true;
  scripts.forEach((m, i) => {
    try { new Function(m[1]); }
    catch (e) { syntaxOk = false; console.error(`Script block ${i}: SYNTAX ERROR: ${e.message}`); }
  });

  const bundledScript = scripts[scripts.length - 1][1]; // the app bundle is always the last inline script
  const required = findRequiredGlobalNames(html);
  const exported = findExportedNames(bundledScript);

  const missing = [...required].filter(n => !exported.has(n));

  console.log(`Syntax check: ${syntaxOk ? 'OK' : 'FAILED'}`);
  console.log(`Functions required by HTML attributes: ${required.size}`);
  console.log(`Functions exported by the bundle: ${exported.size}`);
  console.log(`Missing: ${missing.length}`);
  if (missing.length > 0) {
    console.log('These are called from HTML but not reachable as globals:');
    missing.forEach(n => console.log('  -', n));
  }

  const ok = syntaxOk && missing.length === 0;
  console.log(ok ? '\nPASS' : '\nFAIL');
  process.exit(ok ? 0 : 1);
}

const target = process.argv[2] || path.join(__dirname, '..', 'Accordance.html');
verify(target);
