// tests/twBibleCourseUnlocking.test.js — covers the TW Bible Course's
// progression rules, which changed twice in quick succession:
//
// 1. A lesson with no Knowledge Check (lesson.quizzes.length === 0) used
//    to have no way to ever be marked complete -- markTWLessonComplete was
//    "the only way a lesson completes," and that only ever fired from a
//    quiz being answered correctly. Under the OLD design (sections locked
//    one at a time, same as modules), any quiz-less lesson was a permanent
//    dead end blocking everything after it. Fixed in two places: a TW
//    lesson's video ending with no quiz now completes the lesson directly
//    (shared/videoPlayer.js's fsvForwardTrack), and a lesson with neither
//    video nor quiz completes the moment it's opened, since opening it to
//    read is the whole interaction (shared/twBibleCourse.js's toggleTWLesson).
//
// 2. The design itself then changed: sections within a module are now
//    ALWAYS open (isTWLessonUnlocked is unconditional) -- only MODULES
//    lock in sequence, and only based on that module's Knowledge Checks
//    specifically (isTWModuleFullyComplete), not on every lesson being
//    opened. A lesson with no quiz simply isn't part of that test at all
//    anymore; fix #1 above still runs (so such a lesson still gets a
//    completion checkmark once opened) but no longer needs to, for
//    unlocking purposes -- it's kept because it's a harmless, useful
//    per-lesson "you've seen this" indicator, covered by the first two
//    tests below.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./helpers/loadApp.js');
const testExports = require('./testExports.js');

function makeModule() {
  return {
    id: 'm1',
    title: 'Test Module',
    lessons: [
      { id: 'l1', title: 'Text only', content: 'Just read this.', video: [], quizzes: [] },
      { id: 'l2', title: 'Video, no quiz', content: '', video: [{ url: 'https://example.com/v.mp4' }], quizzes: [] },
      { id: 'l3', title: 'Has a quiz', content: '', video: [], quizzes: [{ question: 'Q?', options: ['A', 'B'], correctIndex: 0 }] },
    ],
  };
}

test('a text-only lesson (no video, no quiz) completes the moment it is opened', async () => {
  const { window } = await loadApp({
    html: '<div id="tw-course-detail-panel"></div><div id="tw-course-content" style="display:none"></div>',
    extraExportNames: [
      ...testExports.twBibleCourse, 'toggleTWLesson', 'openTWModule',
      '__setTwBibleCourseDataForTest',
    ],
    extraSource: `import { __setTwBibleCourseDataForTest } from './shared/twBibleCourse.js';`,
  });

  const mod = makeModule();
  window.__setTwBibleCourseDataForTest([mod]);
  Object.keys(window.twCourseProgress).forEach(k => delete window.twCourseProgress[k]); // mutate in place -- see the comment on the getter pattern in shared/records.js's test utilities for why a reassigning setter would leave window.twCourseProgress pointing at a stale, pre-test object
  window.openTWModule('m1'); // sets activeTWModuleId via the real function

  assert.strictEqual(window.twCourseProgress['l1'], undefined, 'l1 should not be complete before opening it');
  window.toggleTWLesson(0); // open the text-only lesson
  assert.strictEqual(window.twCourseProgress['l1'], true, 'opening a lesson with no video and no quiz should complete it');
});

test('a video-only lesson (no quiz) completes when its video finishes', async () => {
  const { window } = await loadApp({
    html: '<div id="tw-course-detail-panel"></div><div id="tw-course-content" style="display:none"></div>',
    extraExportNames: [
      ...testExports.twBibleCourse, '__setTwBibleCourseDataForTest',
      '__setFsvStateForTest',
    ],
    extraSource: `
      import { __setTwBibleCourseDataForTest } from './shared/twBibleCourse.js';
      import { __setFsvStateForTest } from './shared/videoPlayer.js';
    `,
  });

  const mod = makeModule();
  window.__setTwBibleCourseDataForTest([mod]);
  Object.keys(window.twCourseProgress).forEach(k => delete window.twCourseProgress[k]); // mutate in place -- see the comment on the getter pattern in shared/records.js's test utilities for why a reassigning setter would leave window.twCourseProgress pointing at a stale, pre-test object

  // Simulate being on the last (only) video of lesson l2's playlist, with
  // its completionContext set the same way openTWLessonVideo sets it.
  window.__setFsvStateForTest({
    videos: [{ url: 'https://example.com/v.mp4' }],
    index: 0,
    completionContext: { type: 'tw_lesson', moduleId: 'm1', lessonIndex: 1 },
  });

  assert.strictEqual(window.twCourseProgress['l2'], undefined);
  assert.doesNotThrow(() => window.fsvForwardTrack());
  assert.strictEqual(window.twCourseProgress['l2'], true, 'a video ending with no quiz configured should complete the lesson');
});

test('a lesson with a real quiz is NOT auto-completed just by opening or finishing its video', async () => {
  const { window } = await loadApp({
    html: '<div id="tw-course-detail-panel"></div><div id="tw-course-content" style="display:none"></div>',
    extraExportNames: [
      ...testExports.twBibleCourse, 'toggleTWLesson', 'openTWModule',
      '__setTwBibleCourseDataForTest',
    ],
    extraSource: `import { __setTwBibleCourseDataForTest } from './shared/twBibleCourse.js';`,
  });

  const mod = makeModule();
  window.__setTwBibleCourseDataForTest([mod]);
  Object.keys(window.twCourseProgress).forEach(k => delete window.twCourseProgress[k]); // mutate in place -- see the comment on the getter pattern in shared/records.js's test utilities for why a reassigning setter would leave window.twCourseProgress pointing at a stale, pre-test object
  window.openTWModule('m1');

  window.toggleTWLesson(2); // open the lesson that has a real quiz
  assert.strictEqual(window.twCourseProgress['l3'], undefined, 'a lesson with a real quiz should still require answering it, not auto-complete on open');
});

test('isTWLessonUnlocked always allows access -- only modules gate in sequence, not sections within one', async () => {
  const { window } = await loadApp({
    extraExportNames: [
      ...testExports.twBibleCourse, 'isTWLessonUnlocked',
      '__setTwBibleCourseDataForTest',
    ],
    extraSource: `import { __setTwBibleCourseDataForTest } from './shared/twBibleCourse.js';`,
  });

  const mod = makeModule();
  window.__setTwBibleCourseDataForTest([mod]);
  Object.keys(window.twCourseProgress).forEach(k => delete window.twCourseProgress[k]);

  // Every section should be reachable regardless of what's completed --
  // sections are never locked, only modules are (see the module-level
  // test below).
  assert.strictEqual(window.isTWLessonUnlocked(mod, 0), true);
  assert.strictEqual(window.isTWLessonUnlocked(mod, 1), true);
  assert.strictEqual(window.isTWLessonUnlocked(mod, 2), true, 'even the lesson with a real, unanswered quiz should still be reachable to open');
});

test('a module only unlocks once every KNOWLEDGE CHECK in the PREVIOUS module is answered -- lessons without one do not need to be opened at all', async () => {
  const { window } = await loadApp({
    html: '<div id="tw-course-detail-panel"></div><div id="tw-course-content" style="display:none"></div>',
    extraExportNames: [
      ...testExports.twBibleCourse, 'isTWModuleUnlocked', 'openTWModule', 'toggleTWLesson',
      'answerTWInlineKnowledgeCheck', '__setTwBibleCourseDataForTest',
    ],
    extraSource: `import { __setTwBibleCourseDataForTest } from './shared/twBibleCourse.js';`,
  });

  window.__setTwBibleCourseDataForTest([
    { id: 'm1', title: 'Module 1', lessons: [
      { id: 'm1l1', title: 'Text only, no quiz', video: [], quizzes: [] },
      { id: 'm1l2', title: 'Has a quiz', video: [], quizzes: [{ question: 'Q?', options: ['A', 'B'], correctIndex: 0 }] },
    ]},
    { id: 'm2', title: 'Module 2', lessons: [
      { id: 'm2l1', title: 'Lesson', video: [], quizzes: [] },
    ]},
  ]);
  Object.keys(window.twCourseProgress).forEach(k => delete window.twCourseProgress[k]);

  assert.strictEqual(window.isTWModuleUnlocked(1), false, 'module 2 should be locked before module 1\'s knowledge check is answered');

  window.openTWModule('m1');
  window.toggleTWLesson(1); // open the quiz lesson (does NOT itself complete it)
  assert.strictEqual(window.isTWModuleUnlocked(1), false, 'opening the quiz lesson without answering it should not unlock module 2');

  window.answerTWInlineKnowledgeCheck('m1', 1, 0); // answer correctly (correctIndex: 0)
  assert.strictEqual(window.isTWModuleUnlocked(1), true, 'module 2 should unlock once the only knowledge check in module 1 is answered correctly -- the text-only lesson never needed to be opened at all');
});

test('a module with no knowledge checks at all counts as complete immediately, without needing every section opened', async () => {
  const { window } = await loadApp({
    extraExportNames: [...testExports.twBibleCourse, 'isTWModuleFullyComplete', '__setTwBibleCourseDataForTest'],
    extraSource: `import { isTWModuleFullyComplete, __setTwBibleCourseDataForTest } from './shared/twBibleCourse.js';`,
  });

  const mod = { id: 'm1', title: 'Module 1', lessons: [
    { id: 'm1l1', title: 'Text only', video: [], quizzes: [] },
    { id: 'm1l2', title: 'Also text only', video: [], quizzes: [] },
  ]};
  window.__setTwBibleCourseDataForTest([mod]);
  Object.keys(window.twCourseProgress).forEach(k => delete window.twCourseProgress[k]);

  assert.strictEqual(window.isTWModuleFullyComplete(mod), true, 'a module with zero knowledge checks has nothing left to require -- it should count as done without any section needing to be opened');
});
