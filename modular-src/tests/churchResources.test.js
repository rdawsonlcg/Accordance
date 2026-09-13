// tests/churchResources.test.js — covers two real bugs found in this
// module's history:
//   1. shared/churchResources.js was missing its import of
//      churchResourcesTable, so addChurchResource threw a ReferenceError
//      before it could reach the database.
//   2. This module's own reference-matching regex used to be built once,
//      eagerly, at module load time, from BIBLE_STUDIES_BOOK_ORDER (an
//      imported, circularly-dependent binding) -- the exact same
//      load-order hazard found in shared/coreD.js's scripture regex (see
//      coreD.test.js). Fixed by computing it lazily on first real use.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./helpers/loadApp.js');
const testExports = require('./testExports.js');

test('addChurchResource saves the correct row to church_resources', async () => {
  const html = `
    <input id="church-reference-input-5" value="Genesis 1:1">
    <input id="church-title-input-5" value="My Title">
    <input id="church-resource-input-5" value="http://example.com">
    <input id="church-type-input-5" value="">
    <input id="church-tags-input-5" value="">
    <textarea id="church-notes-input-5"></textarea>
    <input id="church-thumbnail-input-5" value="">
    <input type="checkbox" id="church-hide-thumbnail-input-5">
    <div id="church-resources-list-5"></div>
  `;
  const { window, calls } = await loadApp({
    html,
    extraExportNames: [...testExports.app],
    supabaseOverrides: {
      church_resources: { single: { id: 99 } },
    },
  });

  window.__setCurrentUserForTest({ id: 'admin-1', isAdmin: true });
  window.currentBibleVerses.length = 0;
  window.currentBibleVerses.push({ rowIndex: 5, reference: 'Genesis 1:1', text: 'x', resources: [] });

  await window.addChurchResource(5, 'Genesis 1:1');

  const insertCall = calls.find(c => c.op === 'insert' && c.table === 'church_resources');
  assert.ok(insertCall, 'expected an insert into church_resources -- this is the exact call that used to throw a ReferenceError before reaching the database');
  assert.strictEqual(insertCall.payload.reference, 'Genesis 1:1');
  assert.strictEqual(insertCall.payload.title, 'My Title');
});

test('resolveChurchResourceReferenceInput does not throw at load time or first use (eager-IIFE regression)', async () => {
  const { window } = await loadApp({
    extraExportNames: [...testExports.churchResources, ...testExports.app],
  });
  window.currentBibleVerses.length = 0;
  window.currentBibleVerses.push({ rowIndex: 1, reference: 'Genesis 1:1', text: 'In the beginning...' });

  assert.doesNotThrow(() => window.resolveChurchResourceReferenceInput('Genesis 1:1'));
});

test('resolveChurchResourceReferenceInput correctly matches real verse references and rejects non-matches', async () => {
  const { window } = await loadApp({
    extraExportNames: [...testExports.churchResources, ...testExports.app],
  });
  window.currentBibleVerses.length = 0;
  window.currentBibleVerses.push(
    { rowIndex: 1, reference: 'Genesis 1:1', text: 'In the beginning...' },
    { rowIndex: 2, reference: 'John 3:16', text: 'For God so loved...' },
  );

  const result1 = window.resolveChurchResourceReferenceInput('Genesis 1:1');
  assert.strictEqual(result1.rowIndex, 1);

  const result2 = window.resolveChurchResourceReferenceInput('John 3:16');
  assert.strictEqual(result2.rowIndex, 2);

  assert.strictEqual(window.resolveChurchResourceReferenceInput('Not a real reference'), null);
});

test('updateChurchResourcesDOM renders a resource into the right verse row', async () => {
  const { window } = await loadApp({
    html: '<div id="church-resources-list-5"></div>',
    extraExportNames: [...testExports.churchResources],
  });

  window.churchResourcesMap[5] = [{ resource: 'http://x.com', title: 'Test Resource', notes: '' }];
  window.updateChurchResourcesDOM(5, 'Genesis 1:1');

  const html = window.document.getElementById('church-resources-list-5').innerHTML;
  assert.ok(html.includes('Test Resource'));
});
