// tests/twCourseAdminDuplicate.test.js — covers duplicateTWCourseAdminModule,
// which lets an admin clone an existing module (title, presenter/photo/
// thumbnail, hero video pick, and every lesson) into the form as a new,
// unsaved module -- so a similar module can be built from a known-good one
// instead of from scratch. Mirrors the existing
// duplicateTWCourseAdminLessonRow's philosophy one level up: this only
// populates the form, it never saves anything on its own.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./helpers/loadApp.js');
const testExports = require('./testExports.js');

function adminFormHtml() {
  return `
    <select id="tw-course-admin-select"><option value="m1">Module 1</option></select>
    <div id="tw-course-admin-form" style="display:none;">
      <input id="tw-course-admin-title">
      <input id="tw-course-admin-order">
      <input id="tw-course-admin-presenter">
      <input id="tw-course-admin-presenter-photo">
      <input id="tw-course-admin-thumbnail">
      <select id="tw-course-admin-hero-video"></select>
      <div id="tw-course-admin-lessons-list"></div>
      <button id="tw-course-admin-delete-btn"></button>
      <button id="tw-course-admin-duplicate-btn"></button>
    </div>
  `;
}

function makeModule() {
  return {
    id: 'm1',
    dbId: 42,
    title: 'Original Module',
    orderIndex: 0,
    presenter: 'Jane Presenter',
    presenterPhotoUrl: 'https://example.com/jane.jpg',
    thumbnailUrl: 'https://example.com/thumb.jpg',
    heroSessionIndex: 0,
    heroVideoIndex: 0,
    lessons: [
      { id: 'orig-l1', title: 'Lesson One', content: 'Content one', video: [{ label: 'Vid', url: 'https://example.com/v.mp4' }], audio: [], resources: [], quizzes: [] },
      { id: 'orig-l2', title: 'Lesson Two', content: 'Content two', video: [], audio: [], resources: [], quizzes: [{ question: 'Q?', options: ['A', 'B'], correctIndex: 0, explanation: '' }] },
    ],
  };
}

test('duplicateTWCourseAdminModule clones the module into a new, unsaved entry with fresh lesson ids', async () => {
  const { window } = await loadApp({
    html: adminFormHtml(),
    extraExportNames: [
      ...testExports.twBibleCourse, ...testExports.app, 'duplicateTWCourseAdminModule',
      '__setTwBibleCourseDataForTest', '__getTwBibleCourseDataForTest', '__getTwCourseAdminLessonsStateForTest',
    ],
    extraSource: `import { __setTwBibleCourseDataForTest, __getTwBibleCourseDataForTest, __getTwCourseAdminLessonsStateForTest } from './shared/twBibleCourse.js';`,
      });

  window.__setCurrentUserForTest({ id: 'admin-1', isAdmin: true });
  window.__setTwBibleCourseDataForTest([makeModule()]);
  window.document.getElementById('tw-course-admin-select').value = 'm1';

  window.duplicateTWCourseAdminModule();

  assert.strictEqual(window.document.getElementById('tw-course-admin-select').value, '', 'the select should reset to "-- New Module --" so Save creates a new row');
  assert.strictEqual(window.document.getElementById('tw-course-admin-title').value, 'Original Module (Copy)');
  assert.strictEqual(window.document.getElementById('tw-course-admin-presenter').value, 'Jane Presenter');
  assert.strictEqual(window.document.getElementById('tw-course-admin-presenter-photo').value, 'https://example.com/jane.jpg');
  assert.strictEqual(window.document.getElementById('tw-course-admin-thumbnail').value, 'https://example.com/thumb.jpg');
  assert.strictEqual(window.document.getElementById('tw-course-admin-delete-btn').style.display, 'none', 'nothing to delete yet -- this is an unsaved new module');

  assert.strictEqual(window.__getTwCourseAdminLessonsStateForTest().length, 2);
  assert.strictEqual(window.__getTwCourseAdminLessonsStateForTest()[0].title, 'Lesson One');
  assert.strictEqual(window.__getTwCourseAdminLessonsStateForTest()[1].title, 'Lesson Two');
  assert.notStrictEqual(window.__getTwCourseAdminLessonsStateForTest()[0].id, 'orig-l1', 'the clone must get a fresh lesson id, not reuse the original\'s -- otherwise saving it would collide with the original\'s own learner-progress tracking');
  assert.notStrictEqual(window.__getTwCourseAdminLessonsStateForTest()[1].id, 'orig-l2');

  // The original module itself must be completely untouched by duplicating it.
  const original = window.__getTwBibleCourseDataForTest().find(m => m.id === 'm1');
  assert.strictEqual(original.title, 'Original Module');
  assert.strictEqual(original.lessons[0].id, 'orig-l1');
});

test('duplicateTWCourseAdminModule does nothing for a non-admin', async () => {
  const { window } = await loadApp({
    html: adminFormHtml(),
    extraExportNames: [
      ...testExports.twBibleCourse, ...testExports.app, 'duplicateTWCourseAdminModule',
      '__setTwBibleCourseDataForTest', '__getTwBibleCourseDataForTest', '__getTwCourseAdminLessonsStateForTest',
    ],
    extraSource: `import { __setTwBibleCourseDataForTest, __getTwBibleCourseDataForTest, __getTwCourseAdminLessonsStateForTest } from './shared/twBibleCourse.js';`,
      });

  window.__setCurrentUserForTest({ id: 'user-1', isAdmin: false });
  window.__setTwBibleCourseDataForTest([makeModule()]);
  window.document.getElementById('tw-course-admin-select').value = 'm1';

  assert.doesNotThrow(() => window.duplicateTWCourseAdminModule());
  assert.strictEqual(window.__getTwCourseAdminLessonsStateForTest().length, 0, 'a non-admin should not be able to populate the form at all');
});
