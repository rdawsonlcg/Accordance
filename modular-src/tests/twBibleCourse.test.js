// tests/twBibleCourse.test.js — covers the exact bug that shipped once
// already: shared/twBibleCourse.js was missing its import of
// twCourseProgressTable, so completing a lesson's Knowledge Check silently
// failed to save progress (a ReferenceError, thrown before the database call
// could ever run). The earlier ad-hoc version of this test passed only
// because it used a non-existent module id, which hits an early return
// before the buggy line — this version uses a real module/lesson
// specifically so it actually reaches the database call and can check what
// was sent, not just that nothing threw.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./helpers/loadApp.js');
const testExports = require('./testExports.js');

test('completing a TW lesson saves progress and awards a matching badge', async () => {
  const { window, calls } = await loadApp({
    extraExportNames: [
      ...testExports.app, ...testExports.twBibleCourse, ...testExports.records,
      '__setTwBibleCourseDataForTest', '__setTwCourseProgressForTest', '__setRecordBadgesListForTest',
    ],
    extraSource: `
      import { __setTwBibleCourseDataForTest, __setTwCourseProgressForTest } from './shared/twBibleCourse.js';
      import { __setRecordBadgesListForTest } from './shared/records.js';
    `,
    // checkTWModuleCompletionBadges calls loadRecordBadges() internally,
    // which -- the first time it runs, since nothing has primed its cache
    // yet -- fetches for real and overwrites whatever __setRecordBadgesListForTest
    // seeded below. Providing the same badge here too (as what the mocked
    // fetch itself returns) is what makes the seeded data survive that
    // refetch; relying on __setRecordBadgesListForTest alone looked right
    // but silently lost the data at exactly this point the first time this
    // test was written.
    supabaseOverrides: {
      record_badges: { data: [{ id: 'badge1', trigger_type: 'tw_module_completed', trigger_config: { module_key: 'm1' } }] },
    },
  });

  window.__setCurrentUserForTest({ id: 'user-1', role: 'subscriber' });
  window.__setTwBibleCourseDataForTest([{ id: 'm1', lessons: [
    { id: 'l1', quizzes: [{ question: 'Q1?', options: ['A', 'B'], correctIndex: 0 }] },
    { id: 'l2', quizzes: [{ question: 'Q2?', options: ['A', 'B'], correctIndex: 0 }] },
  ] }]);
  window.__setTwCourseProgressForTest({});
  window.__setRecordBadgesListForTest([
    { id: 'badge1', trigger_type: 'tw_module_completed', trigger_config: { module_key: 'm1' } },
  ]);

  await window.markTWLessonComplete('m1', 0);

  const progressUpsert = calls.find(c => c.op === 'upsert' && c.table === 'tw_course_progress');
  assert.ok(progressUpsert, 'expected an upsert to tw_course_progress — this is the exact call that used to throw a ReferenceError before reaching the database');
  assert.strictEqual(progressUpsert.payload.user_id, 'user-1');
  assert.strictEqual(progressUpsert.payload.lesson_id, 'l1');

  // Only lesson l1's knowledge check is answered so far (l2's still isn't)
  // -- no module-completion badge should be awarded yet. Both lessons here
  // have a real quiz specifically so this module doesn't count as
  // vacuously "done" the moment it's created -- isTWModuleFullyComplete
  // only requires knowledge-check-bearing lessons to be answered, so a
  // module where neither lesson has one would complete immediately,
  // which isn't the scenario this test is checking.
  const badgeInsertTooSoon = calls.find(c => c.op === 'insert' && c.table === 'records');
  assert.strictEqual(badgeInsertTooSoon, undefined, 'badge should not award until every lesson in the module is complete');

  // Complete the second (and last) lesson — now the module genuinely is done.
  await window.markTWLessonComplete('m1', 1);
  const badgeInsert = calls.find(c => c.op === 'insert' && c.table === 'records');
  assert.ok(badgeInsert, 'expected the tw_module_completed badge to be awarded once every lesson is complete');
  assert.strictEqual(badgeInsert.payload.record_badge_id, 'badge1');
  assert.strictEqual(badgeInsert.payload.user_id, 'user-1');
});
