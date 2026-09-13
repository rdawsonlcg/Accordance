// tests/dailyReadingTts.test.js — covers two real bugs in the same variable:
//   1. The auto-advance-to-tomorrow logic directly reassigned
//      currentPlanViewDayNumber, illegal once that variable becomes an
//      imported binding from shared/dailyReadingTts.js's perspective. Fixed
//      with a setCurrentPlanViewDayNumber() setter in app.js.
//   2. A follow-on miss caught only by a broader sweep after fixing #1: the
//      same variable was also READ in two other spots in this module, not
//      just written -- easy to miss since fixing the write-side bug doesn't
//      surface the read-side one; it just throws a different, unrelated-
//      looking ReferenceError the next time that code path runs.
//
// Also documents a real, non-bug lesson from this module's history:
// registering the mini-player starts a setInterval-based visibility
// watcher, which has nothing to tear it down in a Node test environment the
// way a real browser's page-unload would -- silently hanging a test for the
// full default timeout, not failing it. Nothing to fix in the app for this;
// just something worth knowing when writing a test that touches it.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./helpers/loadApp.js');
const testExports = require('./testExports.js');

test("setCurrentPlanViewDayNumber (the fix) actually updates app.js's real state", async () => {
  const { window } = await loadApp({
    extraExportNames: [...testExports.app],
  });

  assert.strictEqual(window.__getCurrentPlanViewDayNumberForTest(), null);
  window.setCurrentPlanViewDayNumber(7);
  assert.strictEqual(window.__getCurrentPlanViewDayNumberForTest(), 7);
});

test('toggleDailyReadingTts reads the real passage text and speaks it', async () => {
  const html = `
    <button id="daily-reading-tts-btn"></button>
    <button id="daily-reading-rewind-btn"></button>
    <button id="daily-reading-forward-btn"></button>
    <div id="daily-reading-passage-text">In the beginning God created the heavens and the earth.</div>
  `;
  const { window } = await loadApp({ html, extraExportNames: [...testExports.app] });

  window.__setCurrentUserForTest({ id: 'user-1' });

  let spokenText = null;
  window.speechSynthesis = {
    getVoices: () => [{ name: 'Google UK English Male', lang: 'en-GB' }],
    speak: (utter) => { spokenText = utter.text; if (utter.onstart) setTimeout(() => utter.onstart(), 0); },
    cancel() {}, pause() {}, resume() {},
  };
  window.SpeechSynthesisUtterance = function (text) { this.text = text; };

  assert.doesNotThrow(() => window.toggleDailyReadingTts());
  await new Promise(resolve => setTimeout(resolve, 50));

  assert.ok(spokenText && spokenText.includes('In the beginning'), `expected the real passage text to be spoken, got: ${spokenText}`);
});

test('handleDailyReadingFinishedNaturally advances to the next day after the real end-to-end flow', async () => {
  const html = `
    <div id="daily-reading-continue-prompt"></div>
    <div id="daily-reading-continue-text"></div>
    <div id="plan-tab"><div id="schedule-content"></div></div>
  `;
  const { window } = await loadApp({
    html,
    extraExportNames: [...testExports.app, ...testExports.dailyReadingTts],
  });

  window.__setCurrentUserForTest({ id: 'user-1' });
  window.cachedScheduleDays.length = 0;
  window.cachedScheduleDays.push(
    { day: 1, rowIndex: 100, completed: false },
    { day: 2, rowIndex: 101, completed: false },
  );
  window.__setCurrentPlanStartDateForTest('2026-01-01');
  // This is the exact read-side miss described above: without setting a
  // starting day number, currentPlanViewDayNumber is null, so
  // handleDailyReadingFinishedNaturally's own `cachedScheduleDays.find(d =>
  // d.day === currentPlanViewDayNumber)` matches nothing and the function
  // silently no-ops via its early return -- easy to mistake for "the test
  // is wrong" rather than "the day was never set to begin with."
  window.setCurrentPlanViewDayNumber(1);

  await window.handleDailyReadingFinishedNaturally(window.dailyReadingTtsSessionToken);

  // The real function waits ~1.5s before advancing (so a brief "well done"
  // state is visible first) -- long enough that this test genuinely needs
  // to wait for it rather than checking immediately.
  await new Promise(resolve => setTimeout(resolve, 1700));

  assert.strictEqual(window.__getCurrentPlanViewDayNumberForTest(), 2, 'expected the day to have advanced from 1 to 2');
});
