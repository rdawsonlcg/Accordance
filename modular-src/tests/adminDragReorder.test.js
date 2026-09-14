// tests/adminDragReorder.test.js — covers a real, plausible cause of a
// reported bug ("I cannot drag and drop lesson sections to reorder them,"
// on desktop): every admin drag-reorder card (TW lessons, Core-D sessions,
// By the Book sessions) has its title field, content textarea, video/audio/
// resource rows, and -- for TW/Core-D -- an entire Knowledge Check editor
// with its own text fields and buttons, ALL living inside the same
// draggable="true" container. The card's CSS put cursor:grab on the WHOLE
// card, visually suggesting any part of it starts a drag -- but browsers
// already refuse to start a native HTML5 drag from inside a focused text
// input, textarea, or button, so most of that visible "grabbable" surface
// never actually worked. Someone reasonably grabbing the card by its title
// field, or blank space near a form row, would see nothing happen and
// reasonably conclude the whole feature was broken -- while a real,
// end-to-end simulated drag (see tests/quizEditorWiring.test.js's own
// discovery of jsdom's onclick-compilation gap for the sibling bug this
// session also found) that happens to start exactly on the small drag
// handle would look completely fine, which is exactly why this one wasn't
// caught by that same style of test alone.
//
// Fixed by making makeAdminDragReorder's dragStart explicitly check that
// the drag began on .session-drag-handle (event.target.closest(...)) and
// cancel it otherwise, and moving the CSS's cursor:grab from the whole
// card onto just the handle so the visual affordance now matches where a
// drag actually works. This is a shared utility (shared/adminUtils.js), so
// the fix applies to every screen using it, not just TW's lesson list --
// only TW's is exercised directly below, since the underlying function is
// identical for all three.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./helpers/loadApp.js');
const testExports = require('./testExports.js');

function mockDragEvent(target, currentTarget) {
  return {
    dataTransfer: { effectAllowed: null, dropEffect: null, setData: () => {} },
    target, currentTarget,
    preventDefault: () => {},
  };
}

test('dragging from the handle actually reorders the lessons', async () => {
  const { window } = await loadApp({
    html: '<div id="tw-course-admin-lessons-list"></div>',
    extraExportNames: ['addTWCourseAdminLessonRow', 'renderTWCourseAdminLessonRows', 'updateTWCourseAdminLessonField', '__getTwCourseAdminLessonsStateForTest'],
    extraSource: `import { __getTwCourseAdminLessonsStateForTest } from './shared/twBibleCourse.js';`,
  });

  window.addTWCourseAdminLessonRow();
  window.addTWCourseAdminLessonRow();
  window.addTWCourseAdminLessonRow();
  window.updateTWCourseAdminLessonField(0, 'title', 'Lesson A');
  window.updateTWCourseAdminLessonField(1, 'title', 'Lesson B');
  window.updateTWCourseAdminLessonField(2, 'title', 'Lesson C');
  window.renderTWCourseAdminLessonRows();

  const cards = window.document.querySelectorAll('.session-drag-card');
  const handle = cards[0].querySelector('.session-drag-handle');

  cards[0].ondragstart(mockDragEvent(handle, cards[0]));
  cards[2].ondragover(mockDragEvent(cards[2], cards[2]));
  cards[2].ondrop(mockDragEvent(cards[2], cards[2]));
  cards[0].ondragend(mockDragEvent(cards[0], cards[0]));

  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(window.__getTwCourseAdminLessonsStateForTest().map(l => l.title))),
    ['Lesson B', 'Lesson C', 'Lesson A'],
    'dragging the first card onto the last position (starting from its handle) should move it to the end'
  );
});

test('dragging from anywhere else on the card (e.g. the title field) does NOT reorder -- the bug this test guards against', async () => {
  const { window } = await loadApp({
    html: '<div id="tw-course-admin-lessons-list"></div>',
    extraExportNames: ['addTWCourseAdminLessonRow', 'renderTWCourseAdminLessonRows', 'updateTWCourseAdminLessonField', '__getTwCourseAdminLessonsStateForTest'],
    extraSource: `import { __getTwCourseAdminLessonsStateForTest } from './shared/twBibleCourse.js';`,
  });

  window.addTWCourseAdminLessonRow();
  window.addTWCourseAdminLessonRow();
  window.addTWCourseAdminLessonRow();
  window.updateTWCourseAdminLessonField(0, 'title', 'Lesson A');
  window.updateTWCourseAdminLessonField(1, 'title', 'Lesson B');
  window.updateTWCourseAdminLessonField(2, 'title', 'Lesson C');
  window.renderTWCourseAdminLessonRows();

  const cards = window.document.querySelectorAll('.session-drag-card');
  const titleInput = cards[0].querySelector('input[type="text"]');

  cards[0].ondragstart(mockDragEvent(titleInput, cards[0]));
  cards[2].ondragover(mockDragEvent(cards[2], cards[2]));
  cards[2].ondrop(mockDragEvent(cards[2], cards[2]));
  cards[0].ondragend(mockDragEvent(cards[0], cards[0]));

  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(window.__getTwCourseAdminLessonsStateForTest().map(l => l.title))),
    ['Lesson A', 'Lesson B', 'Lesson C'],
    'a drag that did not start on the handle should be cancelled before it ever sets a dragged index, leaving the order untouched'
  );
});
