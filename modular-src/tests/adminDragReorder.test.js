// tests/adminDragReorder.test.js — covers shared/adminUtils.js's
// makeAdminDragReorder (used by TW lessons, Core-D sessions, and By the
// Book sessions).
//
// This file previously also tested a restriction added here: requiring a
// drag to start specifically on .session-drag-handle, rather than
// anywhere on the (fully draggable) card, since the card's own cursor:grab
// styling visually suggested the whole thing was grabbable when browsers
// already silently refuse to start a drag from inside a focused input/
// textarea/button anyway. That restriction was REVERTED after shipping:
// a user reported drag-and-drop stopped working ENTIRELY afterward --
// including from the handle itself, and across all three screens that use
// this shared function, in real Chrome, via the actual deployed site (not
// a caching or extension issue -- both were specifically ruled out). This
// could not be reproduced or caught here beforehand, because jsdom does
// not implement real HTML5 drag events (no DragEvent, no DataTransfer) --
// the most faithful test possible in this environment invokes the
// compiled event handler directly with a constructed mock event, which
// cannot surface whatever real-browser-specific issue actually broke this.
// Given that blind spot, the honest, safe choice was to revert the
// restriction rather than leave a real feature broken while trying to
// prove a fix works in an environment that already failed to catch the
// regression once. The UX issue the restriction was meant to solve (most
// of the card's visible "grab" cursor being misleading) is still real and
// still unsolved -- worth revisiting with an approach that doesn't touch
// dragStart's own control flow, if this comes up again.

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

test('dragging a card (starting from its handle) reorders the lessons', async () => {
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
