// tests/quizEditorWiring.test.js — regression test for a real, previously-
// shipped bug affecting every Knowledge Check editor in the app (TW Bible
// Course lessons, Core-D per-video quizzes, and Core-D per-session
// quizzes): removeTWCourseAdminLessonQuiz, updateTWCourseAdminQuizField,
// updateTWCourseAdminQuizOption, setTWCourseAdminQuizCorrect, and their six
// Core-D equivalents were all imported into app.js's own scope (so app.js's
// OWN code could reference them) but never added to app.js's onclick
// export list -- meaning none of them were ever actually reachable from
// `window`, so every "Remove this question" button, every quiz text field,
// every option field, and every "mark as correct" radio button silently
// did nothing when clicked, anywhere in the app that has a Knowledge Check
// editor. Only "add a question" (addTWCourseAdminLessonQuiz and
// toggleFoundationsAdminVideoQuiz) happened to be wired correctly.
//
// This specific bug class is invisible to tests/checkDependencies.js AND to
// verify.js: both of those functions are only ever referenced through a
// STRING passed to the shared renderAdminQuizEditorBlock (removeFnName:
// 'removeTWCourseAdminLessonQuiz', etc.), which then builds the onclick
// attribute dynamically -- there is no literal onclick="..." anywhere for
// static analysis to find. verify.js's own "functions required by HTML
// attributes" count did not change when these 11 functions were fixed
// (confirmed directly against a real build), proving it never saw them
// as referenced in the first place. A real, working button click is the
// only thing that can catch this -- which is exactly what these tests do.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./helpers/loadApp.js');
const testExports = require('./testExports.js');

test('TW Bible Course lesson quiz editor: add, update, mark correct, and remove all actually work', async () => {
  const { window } = await loadApp({
    extraExportNames: [
      'addTWCourseAdminLessonQuiz', 'removeTWCourseAdminLessonQuiz',
      'updateTWCourseAdminQuizField', 'updateTWCourseAdminQuizOption', 'setTWCourseAdminQuizCorrect',
      '__getTwCourseAdminLessonsStateForTest',
    ],
    extraSource: `import { __getTwCourseAdminLessonsStateForTest } from './shared/twBibleCourse.js';`,
  });

  // twCourseAdminLessonsState[0] must already exist for these functions to
  // have something to act on -- addTWCourseAdminLessonRow is the real,
  // already-correctly-wired way to get one, so use it rather than a
  // synthetic setter.
  window.addTWCourseAdminLessonRow();

  window.addTWCourseAdminLessonQuiz(0);
  let quizzes = window.__getTwCourseAdminLessonsStateForTest()[0].quizzes;
  assert.strictEqual(quizzes.length, 1, 'adding a question should create one');

  window.updateTWCourseAdminQuizField(0, 0, 'question', 'What is grace?');
  assert.strictEqual(window.__getTwCourseAdminLessonsStateForTest()[0].quizzes[0].question, 'What is grace?');

  window.updateTWCourseAdminQuizOption(0, 0, 1, 'Unmerited favor');
  assert.strictEqual(window.__getTwCourseAdminLessonsStateForTest()[0].quizzes[0].options[1], 'Unmerited favor');

  window.setTWCourseAdminQuizCorrect(0, 0, 1);
  assert.strictEqual(window.__getTwCourseAdminLessonsStateForTest()[0].quizzes[0].correctIndex, 1);

  window.addTWCourseAdminLessonQuiz(0); // a second question, so removal is unambiguous
  assert.strictEqual(window.__getTwCourseAdminLessonsStateForTest()[0].quizzes.length, 2);

  window.removeTWCourseAdminLessonQuiz(0, 0);
  quizzes = window.__getTwCourseAdminLessonsStateForTest()[0].quizzes;
  assert.strictEqual(quizzes.length, 1, 'removing a question should leave exactly one behind');
  assert.strictEqual(quizzes[0].question, '', 'the SECOND (still-blank) question should remain, not the one that was edited');
});

test('Core-D per-video Knowledge Check editor: toggle on, update, mark correct, and toggle off all actually work', async () => {
  const { window } = await loadApp({
    extraExportNames: [
      'toggleFoundationsAdminVideoQuiz', 'updateFoundationsAdminQuizField',
      'updateFoundationsAdminQuizOption', 'setFoundationsAdminQuizCorrect',
      '__setFoundationsAdminSessionsStateForTest', '__getFoundationsAdminSessionsStateForTest',
    ],
    extraSource: `import { __setFoundationsAdminSessionsStateForTest, __getFoundationsAdminSessionsStateForTest } from './shared/coreD.js';`,
  });

  window.__setFoundationsAdminSessionsStateForTest([
    { title: 'Session 1', video: [{ label: 'Vid', url: 'https://example.com/v.mp4', quiz: null }], audio: [], resources: [] },
  ]);

  window.toggleFoundationsAdminVideoQuiz(0, 0);
  let video = window.__getFoundationsAdminSessionsStateForTest()[0].video[0];
  assert.ok(video.quiz, 'toggling on should create a quiz object on the video');

  window.updateFoundationsAdminQuizField(0, 0, 'question', 'What happened at Pentecost?');
  assert.strictEqual(window.__getFoundationsAdminSessionsStateForTest()[0].video[0].quiz.question, 'What happened at Pentecost?');

  window.updateFoundationsAdminQuizOption(0, 0, 2, 'The Holy Spirit came');
  assert.strictEqual(window.__getFoundationsAdminSessionsStateForTest()[0].video[0].quiz.options[2], 'The Holy Spirit came');

  window.setFoundationsAdminQuizCorrect(0, 0, 2);
  assert.strictEqual(window.__getFoundationsAdminSessionsStateForTest()[0].video[0].quiz.correctIndex, 2);

  window.toggleFoundationsAdminVideoQuiz(0, 0); // toggling again removes it
  video = window.__getFoundationsAdminSessionsStateForTest()[0].video[0];
  assert.strictEqual(video.quiz, null, 'toggling a second time should remove the quiz');
});

test('Core-D per-session Knowledge Check editor: add, update, mark correct, and remove all actually work', async () => {
  const { window } = await loadApp({
    extraExportNames: [
      'addFoundationsAdminSessionQuiz', 'removeFoundationsAdminSessionQuiz',
      'updateFoundationsAdminSessionQuizField', 'updateFoundationsAdminSessionQuizOption',
      'setFoundationsAdminSessionQuizCorrect',
      '__setFoundationsAdminSessionsStateForTest', '__getFoundationsAdminSessionsStateForTest',
    ],
    extraSource: `import { __setFoundationsAdminSessionsStateForTest, __getFoundationsAdminSessionsStateForTest } from './shared/coreD.js';`,
  });

  window.__setFoundationsAdminSessionsStateForTest([
    { title: 'Session 1', video: [], audio: [], resources: [], quizzes: [] },
  ]);

  window.addFoundationsAdminSessionQuiz(0);
  let quizzes = window.__getFoundationsAdminSessionsStateForTest()[0].quizzes;
  assert.strictEqual(quizzes.length, 1);

  window.updateFoundationsAdminSessionQuizField(0, 0, 'question', 'Who wrote Romans?');
  assert.strictEqual(window.__getFoundationsAdminSessionsStateForTest()[0].quizzes[0].question, 'Who wrote Romans?');

  window.updateFoundationsAdminSessionQuizOption(0, 0, 0, 'Paul');
  assert.strictEqual(window.__getFoundationsAdminSessionsStateForTest()[0].quizzes[0].options[0], 'Paul');

  window.setFoundationsAdminSessionQuizCorrect(0, 0, 0);
  assert.strictEqual(window.__getFoundationsAdminSessionsStateForTest()[0].quizzes[0].correctIndex, 0);

  window.addFoundationsAdminSessionQuiz(0);
  assert.strictEqual(window.__getFoundationsAdminSessionsStateForTest()[0].quizzes.length, 2);

  window.removeFoundationsAdminSessionQuiz(0, 0);
  quizzes = window.__getFoundationsAdminSessionsStateForTest()[0].quizzes;
  assert.strictEqual(quizzes.length, 1, 'removing a question should leave exactly one behind');
  assert.strictEqual(quizzes[0].question, '', 'the SECOND (still-blank) question should remain, not the one that was edited');
});
