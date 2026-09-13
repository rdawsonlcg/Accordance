// tests/records.test.js — covers a real bug: app.js's logout cleanup used
// to clear the user's earned-badges cache with a direct assignment
// (userRecordsMap = {}), the same illegal-once-imported pattern found in
// shared/byTheBook.js's filters and shared/cords.js's poll timer. Fixed with
// a clearUserRecordsMap() setter in shared/records.js.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./helpers/loadApp.js');
const testExports = require('./testExports.js');

test('clearUserRecordsMap actually empties the map, not just reassigns a stale reference', async () => {
  const { window } = await loadApp({
    extraExportNames: [
      ...testExports.records,
      '__setUserRecordsMapForTest', '__getUserRecordsMapForTest',
    ],
    extraSource: `import { __setUserRecordsMapForTest, __getUserRecordsMapForTest } from './shared/records.js';`,
  });

  window.__setUserRecordsMapForTest({ badge1: { count: 1 }, badge2: { count: 2 } });
  assert.strictEqual(Object.keys(window.__getUserRecordsMapForTest()).length, 2);

  assert.doesNotThrow(() => window.clearUserRecordsMap());
  // A getter, not window.userRecordsMap, because clearUserRecordsMap()
  // REASSIGNS the map to a brand-new {} rather than emptying the existing
  // one's contents -- build.js's Object.assign(window, __App) copied the
  // OLD object onto `window` once, at bundle-eval time, so that property
  // never points at the new, actually-cleared object. Reading
  // window.userRecordsMap here would silently show the stale two-entry
  // object from before the clear, not the real current (now-empty) one.
  assert.strictEqual(Object.keys(window.__getUserRecordsMapForTest()).length, 0);
});

test('checkBookResourceBadgesAfterClick reaches By the Book\'s book config without throwing', async () => {
  const { window } = await loadApp({
    extraExportNames: [...testExports.records, ...testExports.app],
    supabaseOverrides: {
      user_resource_clicks: { data: [{ book: 'Genesis', session_key: '0' }, { book: 'Genesis', session_key: '1' }] },
      record_badges: { data: [{ id: 'b2', trigger_type: 'book_resources_clicked', trigger_config: { book: 'Genesis' } }] },
    },
  });

  window.__setCurrentUserForTest({ id: 'user-1' });
  await assert.doesNotReject(() => window.checkBookResourceBadgesAfterClick());
});

test('populateRecordAdminTWModuleField lists real TW modules from shared/twBibleCourse.js', async () => {
  const { window } = await loadApp({
    html: '<select id="record-admin-tw-module"></select>',
    extraExportNames: [...testExports.records, ...testExports.twBibleCourse, '__setTwBibleCourseDataForTest'],
    extraSource: `import { __setTwBibleCourseDataForTest } from './shared/twBibleCourse.js';`,
  });

  window.__setTwBibleCourseDataForTest([{ id: 'm1', title: 'Module One', lessons: [] }]);
  assert.doesNotThrow(() => window.populateRecordAdminTWModuleField());

  const html = window.document.getElementById('record-admin-tw-module').innerHTML;
  assert.ok(html.includes('Module One'));
});
