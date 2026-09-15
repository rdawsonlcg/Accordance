// tests/twLessonRevisit.test.js — regression test for a real bug: a
// video-less TW lesson (one with only a Knowledge Check, no video) had its
// Knowledge Check specifically hidden once the lesson was marked complete
// (`if (!isComplete && ...)`). For a lesson with no other content (no
// written content, no video, no audio, no resources -- just a quiz), that
// meant reopening it after completion showed a completely empty body, with
// nothing there at all -- indistinguishable from something being broken,
// not "already finished." Fixed by rendering the Knowledge Check
// regardless of completion status; markTWLessonComplete's own guard
// already prevents any duplicate side effect from re-answering it.
//
// Core-D's equivalent (shared/coreD.js's per-session inline Knowledge
// Check) was checked too and did NOT have this bug -- it was already
// unconditional, by design (its own code comment says as much: "no lock/
// progression depends on it, unlike TW"), so nothing needed to change
// there. Not tested here since there was nothing to fix.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./helpers/loadApp.js');
const testExports = require('./testExports.js');

test('reopening a completed, video-less lesson still shows its Knowledge Check (not an empty body)', async () => {
  const { window } = await loadApp({
    html: '<div id="tw-course-detail-panel"></div><div id="tw-course-content" style="display:none"></div>',
    extraExportNames: [
      ...testExports.twBibleCourse, 'toggleTWLesson', 'openTWModule', 'twLessonAccordionHtml',
      '__setTwBibleCourseDataForTest',
    ],
    extraSource: `import { __setTwBibleCourseDataForTest } from './shared/twBibleCourse.js';`,
  });

  const mod = {
    id: 'm1',
    lessons: [{
      id: 'l1', title: 'Quiz Only', content: '', video: [], audio: [], resources: [],
      quizzes: [{ question: 'Q?', options: ['A', 'B'], correctIndex: 0 }],
    }],
  };
  window.__setTwBibleCourseDataForTest([mod]);
  Object.keys(window.twCourseProgress).forEach(k => delete window.twCourseProgress[k]);
  window.openTWModule('m1');

  // Open it before completing it -- the Knowledge Check should show.
  window.toggleTWLesson(0);
  let html = window.twLessonAccordionHtml(mod, mod.lessons[0], 0);
  assert.ok(html.includes('tw-inline-kc'), 'the Knowledge Check should render before completion');

  // Mark it complete directly (bypassing the real answer flow, which isn't
  // what this test is about) and reopen it.
  window.twCourseProgress['l1'] = true;
  html = window.twLessonAccordionHtml(mod, mod.lessons[0], 0);

  assert.ok(html.includes('tw-inline-kc'), 'the Knowledge Check should STILL render after completion -- this is the actual bug: it used to disappear entirely, leaving a lesson with no other content completely empty when reopened');
  assert.ok(!html.includes('foundations-session-body\"></div>'), 'the reopened lesson body should not be empty');
});
