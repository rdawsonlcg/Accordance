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
// static analysis to find.
//
// This file was ALSO the reason tests/helpers/loadApp.js switched from
// jsdom's runScripts: 'outside-only' to 'dangerously': the first version of
// these tests called removeTWCourseAdminLessonQuiz(...) etc. directly and
// passed, even while the real bug above was still live in the app --
// 'outside-only' never compiles an inline onclick="..." HTML attribute
// into a real event handler when markup is set via innerHTML, so a real
// button.click() silently no-ops under it regardless of whether the
// function is actually wired correctly. These tests now render the exact
// same HTML the app renders and interact with it via real events (.click(),
// dispatched 'input'/'change' events) specifically so this class of bug -- a
// function that works when called directly but not from an actual click --
// can never pass silently again.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./helpers/loadApp.js');
const testExports = require('./testExports.js');

function fireInput(el, value) {
  el.value = value;
  el.dispatchEvent(new el.ownerDocument.defaultView.Event('input', { bubbles: true }));
}
function fireChange(el) {
  el.dispatchEvent(new el.ownerDocument.defaultView.Event('change', { bubbles: true }));
}

test('TW Bible Course lesson quiz editor: a real click on "Remove this question" actually removes it', async () => {
  const { window } = await loadApp({
    html: '<div id="quiz-container"></div>',
    extraExportNames: [
      'addTWCourseAdminLessonRow', 'addTWCourseAdminLessonQuiz', 'renderTWCourseAdminQuizEditor',
      '__getTwCourseAdminLessonsStateForTest',
    ],
    extraSource: `import { __getTwCourseAdminLessonsStateForTest } from './shared/twBibleCourse.js';`,
  });

  window.addTWCourseAdminLessonRow();
  window.addTWCourseAdminLessonQuiz(0);
  window.addTWCourseAdminLessonQuiz(0); // two, so removal is unambiguous

  function renderContainer() {
    const lesson = window.__getTwCourseAdminLessonsStateForTest()[0];
    const html = lesson.quizzes.map((q, i) => window.renderTWCourseAdminQuizEditor(0, i, q)).join('');
    window.document.getElementById('quiz-container').innerHTML = html;
  }
  renderContainer();

  // Fill in and mark the FIRST question so removing it is unambiguous from
  // the (still-blank) second one.
  const textareas = window.document.querySelectorAll('#quiz-container textarea');
  fireInput(textareas[0], 'What is grace?');
  const optionInputs = window.document.querySelectorAll('#quiz-container input[type="text"]');
  fireInput(optionInputs[1], 'Unmerited favor');
  const radios = window.document.querySelectorAll('#quiz-container input[type="radio"]');
  radios[1].checked = true;
  fireChange(radios[1]);

  assert.strictEqual(window.__getTwCourseAdminLessonsStateForTest()[0].quizzes[0].question, 'What is grace?', 'typing in the question field should actually save it');
  assert.strictEqual(window.__getTwCourseAdminLessonsStateForTest()[0].quizzes[0].options[1], 'Unmerited favor', 'typing in an option field should actually save it');
  assert.strictEqual(window.__getTwCourseAdminLessonsStateForTest()[0].quizzes[0].correctIndex, 1, 'selecting a radio button should actually mark it correct');

  const removeButtons = window.document.querySelectorAll('#quiz-container button');
  assert.strictEqual(removeButtons.length, 2);
  removeButtons[0].click(); // a REAL click, not calling the function directly
  renderContainer();

  const quizzes = window.__getTwCourseAdminLessonsStateForTest()[0].quizzes;
  assert.strictEqual(quizzes.length, 1, 'clicking Remove should actually remove a question');
  assert.strictEqual(quizzes[0].question, '', 'the SECOND (still-blank) question should remain -- confirms the right one was removed, not just that the count went down');
});

test('Core-D per-video Knowledge Check editor: a real click toggles the quiz on and off, real input events save its fields', async () => {
  const { window } = await loadApp({
    html: '<div id="quiz-container"></div>',
    extraExportNames: [
      'toggleFoundationsAdminVideoQuiz', 'renderFoundationsAdminQuizEditor',
      '__setFoundationsAdminSessionsStateForTest', '__getFoundationsAdminSessionsStateForTest',
    ],
    extraSource: `import { __setFoundationsAdminSessionsStateForTest, __getFoundationsAdminSessionsStateForTest } from './shared/coreD.js';`,
  });

  window.__setFoundationsAdminSessionsStateForTest([
    { title: 'Session 1', video: [{ label: 'Vid', url: 'https://example.com/v.mp4', quiz: null }], audio: [], resources: [] },
  ]);

  // toggleFoundationsAdminVideoQuiz IS correctly wired already (confirmed
  // separately) -- call it directly just to create the quiz object so the
  // editor block below has something real to render and click through.
  window.toggleFoundationsAdminVideoQuiz(0, 0);

  const quiz = window.__getFoundationsAdminSessionsStateForTest()[0].video[0].quiz;
  window.document.getElementById('quiz-container').innerHTML = window.renderFoundationsAdminQuizEditor(0, 0, quiz);

  const textareas = window.document.querySelectorAll('#quiz-container textarea');
  fireInput(textareas[0], 'What happened at Pentecost?');
  const optionInputs = window.document.querySelectorAll('#quiz-container input[type="text"]');
  fireInput(optionInputs[2], 'The Holy Spirit came');
  const radios = window.document.querySelectorAll('#quiz-container input[type="radio"]');
  radios[2].checked = true;
  fireChange(radios[2]);

  const savedQuiz = window.__getFoundationsAdminSessionsStateForTest()[0].video[0].quiz;
  assert.strictEqual(savedQuiz.question, 'What happened at Pentecost?');
  assert.strictEqual(savedQuiz.options[2], 'The Holy Spirit came');
  assert.strictEqual(savedQuiz.correctIndex, 2);

  const removeButton = window.document.querySelector('#quiz-container button');
  removeButton.click(); // a REAL click on "Remove this Knowledge Check"
  assert.strictEqual(window.__getFoundationsAdminSessionsStateForTest()[0].video[0].quiz, null, 'clicking remove should actually clear the quiz');
});

test('Core-D per-session Knowledge Check editor: a real click on "Remove this question" actually removes it', async () => {
  const { window } = await loadApp({
    html: '<div id="quiz-container"></div>',
    extraExportNames: [
      'addFoundationsAdminSessionQuiz', 'renderFoundationsAdminSessionQuizEditor',
      '__setFoundationsAdminSessionsStateForTest', '__getFoundationsAdminSessionsStateForTest',
    ],
    extraSource: `import { __setFoundationsAdminSessionsStateForTest, __getFoundationsAdminSessionsStateForTest } from './shared/coreD.js';`,
  });

  window.__setFoundationsAdminSessionsStateForTest([
    { title: 'Session 1', video: [], audio: [], resources: [], quizzes: [] },
  ]);
  window.addFoundationsAdminSessionQuiz(0);
  window.addFoundationsAdminSessionQuiz(0); // two, so removal is unambiguous

  function renderContainer() {
    const quizzes = window.__getFoundationsAdminSessionsStateForTest()[0].quizzes;
    const html = quizzes.map((q, i) => window.renderFoundationsAdminSessionQuizEditor(0, i, q)).join('');
    window.document.getElementById('quiz-container').innerHTML = html;
  }
  renderContainer();

  const textareas = window.document.querySelectorAll('#quiz-container textarea');
  fireInput(textareas[0], 'Who wrote Romans?');
  const optionInputs = window.document.querySelectorAll('#quiz-container input[type="text"]');
  fireInput(optionInputs[0], 'Paul');
  const radios = window.document.querySelectorAll('#quiz-container input[type="radio"]');
  radios[0].checked = true;
  fireChange(radios[0]);

  assert.strictEqual(window.__getFoundationsAdminSessionsStateForTest()[0].quizzes[0].question, 'Who wrote Romans?');
  assert.strictEqual(window.__getFoundationsAdminSessionsStateForTest()[0].quizzes[0].options[0], 'Paul');
  assert.strictEqual(window.__getFoundationsAdminSessionsStateForTest()[0].quizzes[0].correctIndex, 0);

  const removeButtons = window.document.querySelectorAll('#quiz-container button');
  assert.strictEqual(removeButtons.length, 2);
  removeButtons[0].click(); // a REAL click, not calling the function directly
  renderContainer();

  const quizzes = window.__getFoundationsAdminSessionsStateForTest()[0].quizzes;
  assert.strictEqual(quizzes.length, 1, 'clicking Remove should actually remove a question');
  assert.strictEqual(quizzes[0].question, '', 'the SECOND (still-blank) question should remain -- confirms the right one was removed, not just that the count went down');
});
