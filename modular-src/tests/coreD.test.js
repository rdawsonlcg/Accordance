// tests/coreD.test.js — covers a real bug: the scripture auto-linker's
// regex used to be built once, eagerly, at module load time, from
// BIBLE_STUDIES_BOOK_ORDER (imported from app.js, which imports this
// module back -- a genuine circular dependency). Which of the two finished
// initializing its top-level code first wasn't guaranteed, so the eager
// version could run before BIBLE_STUDIES_BOOK_ORDER was ready, throwing
// "Cannot read properties of undefined (reading 'slice')". Fixed by
// computing the regex lazily, on first real use, instead.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./helpers/loadApp.js');
const testExports = require('./testExports.js');

test('renderFoundationsContentHtml does not throw at load time (eager-IIFE / circular-import regression)', async () => {
  const { window } = await loadApp({
    extraExportNames: [...testExports.coreD],
  });

  assert.doesNotThrow(() => window.renderFoundationsContentHtml('Plain text with no references.'));
});

test('renderFoundationsContentHtml correctly auto-links a real scripture reference', async () => {
  const { window } = await loadApp({
    extraExportNames: [...testExports.coreD],
  });

  const result = window.renderFoundationsContentHtml('See John 3:16 for more.');
  assert.ok(result.includes("navigateToVerseReference('John 3:16')"), `expected a scripture link, got: ${result}`);
});

test('renderFoundationsContentHtml maps the singular "Psalm" to the canonical "Psalms" book name', async () => {
  const { window } = await loadApp({
    extraExportNames: [...testExports.coreD],
  });

  const result = window.renderFoundationsContentHtml('Read Psalm 23:1 today.');
  assert.ok(result.includes("navigateToVerseReference('Psalms 23:1')"), `expected the canonical book name, got: ${result}`);
});
