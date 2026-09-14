// build.js — bundles app.js (which imports from core/db.js and every
// shared/*.js module) into one plain script, then splices it into
// shell.html in place of the /*__APP_BUNDLE__*/ marker to produce the final,
// single-file HTML output.
//
// Run with: node build.js
//
// Why a bundler at all: the output still needs to be one .html file openable
// by double-clicking (no web server) — real <script type="module"> imports
// don't work over file://. esbuild resolves all the import/export statements
// across the source files at build time and emits one plain script with the
// same behavior, so the *source* stays properly modular while the *shipped
// file* stays exactly as portable as it is today.
//
// Why --format=iife + the manual window-flattening step below: esbuild's iife
// wrapper is scoped for safety, but this app calls ~200 functions directly
// from onclick="..." etc. attributes in the HTML, which resolve through the
// true global scope at click time. Every one of those functions is named in
// the `export { ... }` block at the bottom of app.js — that's the app's real,
// intentional public surface — and get attached to `window` after bundling
// so those attributes keep working exactly as before. Anything NOT in that
// export list stays properly private to the module that defines it.
//
// bundleApp() below is also used directly by tests/helpers/loadApp.js, with
// one difference: it can optionally attach a handful of ADDITIONAL internal
// names to the window too, listed in tests/testExports.js — functions like
// checkTWModuleCompletionBadges or resolveChurchResourceReferenceInput that
// have no onclick attribute of their own (so production correctly keeps them
// private) but that tests need to call directly to verify a fix actually
// works, not just that nothing throws. This keeps the SHIPPED file's public
// surface exactly as minimal as it should be, while still letting tests
// reach in and check real internal behavior — without ever leaving a
// temporary test hook sitting in committed source, the way every ad-hoc
// verification earlier in this project's history had to (and always had to
// remember to remove again afterward).

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

// Finds every name app.js already exports (whether from the big HTML-onclick
// list at the bottom, or one of the smaller `export { x, y }` statements used
// for another module's circular-dependency needs) — used below so
// bundleApp()'s extraExportNames never collide with something already
// exported under its own name, which esbuild treats as a hard error.
function getAlreadyExportedNames(source) {
  const names = new Set();
  for (const m of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const raw of m[1].split(',')) {
      const name = raw.trim().split(/\s+as\s+/)[0].trim();
      if (name) names.add(name);
    }
  }
  for (const m of source.matchAll(/export\s+(?:async function|function|let|const)\s+(\w+)/g)) {
    names.add(m[1]);
  }
  return names;
}

async function bundleApp(extraExportNames = [], extraSource = '') {
  let entryContents = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
  if (extraSource) {
    entryContents += `\n${extraSource}\n`;
  }
  if (extraExportNames.length > 0) {
    const alreadyExported = getAlreadyExportedNames(entryContents);
    const newNames = extraExportNames.filter(n => !alreadyExported.has(n));
    if (newNames.length > 0) {
      entryContents += `\nexport { ${newNames.join(', ')} };\n`;
    }
  }

  const result = await esbuild.build({
    stdin: {
      contents: entryContents,
      resolveDir: __dirname,
      sourcefile: 'app.js',
    },
    bundle: true,
    format: 'iife',
    globalName: '__App',
    write: false
  });

  return result.outputFiles[0].text + '\nObject.assign(window, __App);\n';
}

function spliceIntoShell(bundleCode) {
  const shell = fs.readFileSync(path.join(__dirname, 'shell.html'), 'utf8');
  const marker = '/*__APP_BUNDLE__*/';
  if (!shell.includes(marker)) {
    throw new Error(`shell.html is missing the ${marker} marker — can't splice the bundle in.`);
  }
  // A function replacer (not a plain string) is required here: when the
  // second argument to String.replace() is a string, JS treats sequences
  // like $` or $' as special "insert text before/after the match" patterns
  // — and a ~500KB bundle full of template literals is virtually guaranteed
  // to contain one of those two-character sequences somewhere by
  // coincidence. A function's return value is always inserted literally,
  // with no special-pattern processing.
  return shell.replace(marker, () => bundleCode);
}

async function build() {
  const bundleCode = await bundleApp();
  const finalHtml = spliceIntoShell(bundleCode);

  const outPath = path.join(__dirname, '..', 'Accordance.html');
  fs.writeFileSync(outPath, finalHtml);
  console.log(`Built ${outPath} (${(finalHtml.length / 1024).toFixed(0)} KB)`);

  // Also write an identical copy named index.html, right alongside it. GitHub
  // Pages (and static hosts generally) serve index.html automatically at a
  // site's root URL -- without this, visiting the bare root address wouldn't
  // show the app, only the longer /Accordance.html path would. Both files
  // always contain the same thing; index.html is purely so the short link
  // works too.
  const indexPath = path.join(__dirname, '..', 'index.html');
  fs.writeFileSync(indexPath, finalHtml);
  console.log(`Built ${indexPath} (copy, for the GitHub Pages root URL)`);
}

module.exports = { bundleApp, spliceIntoShell };

if (require.main === module) {
  build().catch(e => { console.error(e); process.exit(1); });
}
