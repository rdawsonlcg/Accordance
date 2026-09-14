// tests/twBibleCourseUnlocking.test.js — covers a real bug found while
// testing the RLS audit's tw_course_progress fix (not caused by it): a
// lesson with no Knowledge Check (lesson.quizzes.length === 0) had no way
// to ever be marked complete -- markTWLessonComplete is "the only way a
// lesson completes," and that only ever fired from a quiz being answered
// correctly. A lesson with no quiz (whether or not it had a video) was a
// permanent dead end: isTWLessonUnlocked requires the PREVIOUS lesson to
// be complete before unlocking the next one, so any quiz-less lesson
// blocked everything after it in that module, forever, for every learner.
//
// Fixed in two places, both covered here:
//   - shared/videoPlayer.js's fsvForwardTrack: a TW lesson's video ending
//     with no quiz configured now completes the lesson directly, instead
//     of just closing the player.
//   - shared/twBibleCourse.js's toggleTWLesson: a lesson with neither
//     video nor quiz (pure text) now completes the moment it's opened,
//     since opening it to read is the whole interaction.
// isTWLessonUnlocked also got the same "no video and no quiz" check
// directly, as a defensive fallback -- covered by the last test below.

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

test('isTWLessonUnlocked treats a quiz-less, video-less lesson as satisfied even without a tracked completion (defensive fallback)', async () => {
  const { window } = await loadApp({
    extraExportNames: [
      ...testExports.twBibleCourse, 'isTWLessonUnlocked',
      '__setTwBibleCourseDataForTest',
    ],
    extraSource: `import { __setTwBibleCourseDataForTest } from './shared/twBibleCourse.js';`,
  });

  const mod = makeModule();
  window.__setTwBibleCourseDataForTest([mod]);
  Object.keys(window.twCourseProgress).forEach(k => delete window.twCourseProgress[k]); // mutate in place -- see the comment on the getter pattern in shared/records.js's test utilities for why a reassigning setter would leave window.twCourseProgress pointing at a stale, pre-test object // l1 was never explicitly marked complete

  assert.strictEqual(window.isTWLessonUnlocked(mod, 1), true, 'lesson 2 should be unlocked even though lesson 1 (text-only) has no tracked completion yet');
});
