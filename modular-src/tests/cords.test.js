// tests/cords.test.js — covers a real bug: app.js's switchTab() used to
// clear Cords' background poll timer with a direct assignment
// (cordPollTimer = null), which isn't legal once cordPollTimer becomes an
// imported binding from another module's perspective. Fixed with a
// stopCordPollTimer() setter in shared/cords.js.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./helpers/loadApp.js');
const testExports = require('./testExports.js');

test('stopCordPollTimer actually clears an active timer', async () => {
  const { window } = await loadApp({
    extraExportNames: [...testExports.cords, '__setCordPollTimerForTest', '__getCordPollTimerForTest'],
    extraSource: `import { __setCordPollTimerForTest, __getCordPollTimerForTest } from './shared/cords.js';`,
  });

  // Using window.setInterval/clearInterval here, not Node's globals: the
  // app's own bundled code runs inside this jsdom window's realm (evaluated
  // via window.eval), so a real cordPollTimer id it creates is a jsdom
  // timer, not a Node one -- a mismatch here silently means clearInterval
  // never actually clears anything, which otherwise manifests as this test
  // process hanging until Node's own default test timeout, not as a
  // reported failure.
  const fakeTimerId = window.setInterval(() => {}, 100000);
  window.__setCordPollTimerForTest(fakeTimerId);
  // A getter, not window.cordPollTimer, because cordPollTimer is a
  // primitive: build.js's Object.assign(window, __App) copies its value
  // once, at bundle-eval time, so reassigning it internally afterward
  // (exactly what the setter just did) never updates that already-copied
  // window property. Reading window.cordPollTimer here would silently
  // re-read the stale pre-test snapshot instead of the real current value.
  assert.strictEqual(window.__getCordPollTimerForTest(), fakeTimerId);

  assert.doesNotThrow(() => window.stopCordPollTimer());
  assert.strictEqual(window.__getCordPollTimerForTest(), null);
});

test("switchTab away from Cords calls the real stopCordPollTimer (not a direct, now-illegal assignment)", async () => {
  const html = `
    <nav><button class="nav-btn"></button></nav>
    <div class="tab-content" id="bible-tab"></div>
    <div id="reading-notification-panel"></div>
  `;
  const { window } = await loadApp({
    html,
    extraExportNames: [...testExports.cords, '__setCordPollTimerForTest', '__getCordPollTimerForTest'],
    extraSource: `import { __setCordPollTimerForTest, __getCordPollTimerForTest } from './shared/cords.js';`,
  });

  const fakeTimerId = window.setInterval(() => {}, 100000);
  window.__setCordPollTimerForTest(fakeTimerId);

  assert.doesNotThrow(() => window.switchTab('bible'));
  assert.strictEqual(window.__getCordPollTimerForTest(), null, 'expected switching to a real tab to stop the Cords poll timer');
});
