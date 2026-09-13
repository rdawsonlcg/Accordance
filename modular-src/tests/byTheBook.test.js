// tests/byTheBook.test.js — covers a real bug: app.js's shared-link handler
// (for jumping straight to a specific book session) used to set Study's
// active type/presenter filters with direct assignments
// (activeStudyTypeFilter = ...; activeStudyPresenterFilter = null), illegal
// once those become imported bindings from shared/byTheBook.js's
// perspective -- the first instance of this exact pattern found in this
// project, later repeated in shared/cords.js and shared/records.js. Fixed
// with a setActiveStudyFilters() setter.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./helpers/loadApp.js');
const testExports = require('./testExports.js');

test('setActiveStudyFilters actually updates the real filter state', async () => {
  const { window } = await loadApp({
    extraExportNames: ['setActiveStudyFilters', '__getActiveStudyFiltersForTest'],
    // activeStudyTypeFilter/activeStudyPresenterFilter are already imported
    // into app.js's own scope (part of its normal, real import from
    // shared/byTheBook.js) -- no need to import them again here.
    extraSource: `
      function __getActiveStudyFiltersForTest() {
        // A function reading these directly, rather than exporting
        // activeStudyTypeFilter/activeStudyPresenterFilter themselves,
        // sidesteps the same stale-snapshot issue documented in
        // shared/cords.js and shared/records.js's own test getters --
        // these are primitives, so reading them through window after a
        // reassignment would otherwise show whatever they were at
        // bundle-eval time, not the current value.
        return { type: activeStudyTypeFilter, presenter: activeStudyPresenterFilter };
      }
    `,
  });

  window.setActiveStudyFilters('video', 'John Smith');
  const result = window.__getActiveStudyFiltersForTest();
  assert.strictEqual(result.type, 'video');
  assert.strictEqual(result.presenter, 'John Smith');
});

test('By the Book admin session drag-and-drop reorder works (cross-module into shared/adminUtils.js)', async () => {
  const { window } = await loadApp({
    html: '<div id="book-admin-sessions-list"></div>',
    extraExportNames: ['__setBookAdminSessionsStateForTest', '__getBookAdminSessionsStateForTest'],
    // bookAdminSessionsState is already imported into app.js's own scope
    // (it's part of app.js's normal, real import from shared/byTheBook.js)
    // -- no need to import it again here, and esbuild correctly rejects a
    // second import of the same name as a duplicate declaration.
    extraSource: `
      function __setBookAdminSessionsStateForTest(rows) {
        bookAdminSessionsState.length = 0;
        bookAdminSessionsState.push(...rows);
      }
      function __getBookAdminSessionsStateForTest() { return bookAdminSessionsState; }
    `,
  });

  window.__setBookAdminSessionsStateForTest([
    { title: 'A', presenters: [] }, { title: 'B', presenters: [] }, { title: 'C', presenters: [] },
  ]);

  const fakeDragEvent = {
    dataTransfer: { setData() {}, dropEffect: null },
    currentTarget: { classList: { add() {}, remove() {} } },
    preventDefault() {},
  };
  window.handleSessionDragStart(fakeDragEvent, 0);
  window.handleSessionDrop(fakeDragEvent, 2);

  const titles = window.__getBookAdminSessionsStateForTest().map(s => s.title);
  // JSON.stringify rather than assert.deepStrictEqual: the array came from
  // jsdom's window realm, not Node's -- the values are identical, but
  // deepStrictEqual additionally checks prototype identity, which differs
  // across realms even for two otherwise-equal plain arrays. Not a real
  // app bug, just a cross-realm comparison gotcha worth sidestepping
  // cleanly rather than working around with the laxer (and easier to
  // accidentally misuse) assert.deepEqual.
  assert.strictEqual(JSON.stringify(titles), JSON.stringify(['B', 'C', 'A']));
});
