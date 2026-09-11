// build.js — bundles src/app.js (which imports from src/core/db.js, and will
// import from more modules as the split continues) into one plain script,
// then splices it into shell.html in place of the /*__APP_BUNDLE__*/ marker
// to produce the final, single-file HTML output.
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

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

async function build() {
  const result = await esbuild.build({
    entryPoints: [path.join(__dirname, 'src/app.js')],
    bundle: true,
    format: 'iife',
    globalName: '__App',
    write: false
  });

  const bundleCode = result.outputFiles[0].text + '\nObject.assign(window, __App);\n';

  const shell = fs.readFileSync(path.join(__dirname, 'shell.html'), 'utf8');
  const marker = '/*__APP_BUNDLE__*/';
  if (!shell.includes(marker)) {
    throw new Error(`shell.html is missing the ${marker} marker — can't splice the bundle in.`);
  }
  // A function replacer (not a plain string) is required here: when the second
  // argument to String.replace() is a string, JS treats sequences like $` or $'
  // as special "insert text before/after the match" patterns — and a ~500KB
  // bundle full of template literals is virtually guaranteed to contain one of
  // those two-character sequences somewhere by coincidence. A function's return
  // value is always inserted literally, with no special-pattern processing.
  const finalHtml = shell.replace(marker, () => bundleCode);

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

build().catch(e => { console.error(e); process.exit(1); });
