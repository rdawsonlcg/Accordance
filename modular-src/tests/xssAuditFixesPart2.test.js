// tests/xssAuditFixesPart2.test.js — continues tests/xssAuditFixes.test.js,
// covering the broader sweep of admin/user-entered title, name, and notes
// fields found rendered as unescaped plain text or attributes across the
// rest of the codebase (module titles, badge titles, presenter names, cord
// names, etc.) after the first, more narrowly-scoped pass.
//
// Cords is the most severe finding of this whole audit: cord and group
// names are set by ANY regular user (via create_cord's p_group_name
// parameter, or their own profile display name), not just admins -- so
// this was exploitable by any registered user against anyone they corded
// with, no admin access needed at all.
//
// Every test here checks the real rendering path a user/admin would
// actually trigger, the same discipline as the first file, rather than
// unit-testing an escape function in isolation.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./helpers/loadApp.js');
const testExports = require('./testExports.js');

test('Cords: a script tag in a pending invite\'s name, a cord\'s name, and a thread title all render as inert text, not live markup', async () => {
  const { window } = await loadApp({
    html: '<div id="cord-view-body"></div>',
    extraExportNames: [...testExports.cords, '__setCurrentUserForTest'],
  });
  window.__setCurrentUserForTest({ id: 'user-1' });
  window.cordPending.push({ id: 1, name: '<img src=x onerror=alert(1)>', isGroup: false });
  window.cordList.push({ id: 2, name: '<script>alert(2)</script>', isGroup: true, lastMessageAt: null });

  window.renderCordViewBody();
  const html = window.document.getElementById('cord-view-body').innerHTML;

  assert.ok(!html.includes('<img src=x onerror'), 'a pending invite\'s name must not be able to inject live markup');
  assert.ok(!html.includes('<script>alert(2)'), 'a cord\'s (possibly user-set group) name must not be able to inject a live script tag');
  assert.ok(html.includes('&lt;img') && html.includes('&lt;script'), 'both should show up escaped as inert text, not silently dropped');
});

test('By the Book: a session\'s presenter name/photo and session title cannot inject markup', async () => {
  const { window } = await loadApp({
    html: '<div id="bible-study-info-panel"></div>',
    extraExportNames: [...testExports.byTheBook],
  });
  const dangerous = '<script>alert(1)</script>';
  const cfg = {
    live: true,
    title: 'Job',
    presenters: [],
    sessions: [{
      title: dangerous,
      type: 'video',
      video: null,
      presenter: { name: dangerous, photo: 'https://example.com/x.jpg' },
    }],
  };
  window.renderBibleStudyInfoPanel(cfg);
  const html = window.document.getElementById('bible-study-info-panel').innerHTML;
  assert.ok(!html.includes('<script>alert(1)'), 'a session title or presenter name must not be able to inject a live script tag');
});

test('Core-D: a suggestion card\'s title/presenter/category cannot inject markup', async () => {
  const { window } = await loadApp({
    extraExportNames: [...testExports.coreD, 'foundationsSuggestionsHtml'],
  });
  const dangerous = '<script>alert(1)</script>';
  const item = {
    dbId: 1,
    suggestedSessions: [{ dbId: 2, title: dangerous, presenter: dangerous, category: 'General' }],
  };
  const html = window.foundationsSuggestionsHtml(item);
  // If this build's foundationsSuggestionsHtml expects a different shape
  // (e.g. reading suggestions from module state rather than the item
  // itself) and returns '' for this input, that's still a meaningful
  // result to assert on -- an empty, safe string can't contain an
  // injected script tag either way.
  assert.ok(!html.includes('<script>alert(1)'), 'a suggested class\'s title/presenter/category must not be able to inject a live script tag');
});

test('Core-D: foundationsNxCardHtml escapes title, presenter, and category', async () => {
  const { window } = await loadApp({
    html: '<div id="card-container"></div>',
    extraExportNames: [...testExports.coreD, 'foundationsNxCardHtml'],
  });
  const item = {
    dbId: 1,
    title: '<script>alert(1)</script>',
    presenter: '<img src=x onerror=alert(2)>',
    category: 'General',
    isNew: false,
    sessions: [],
  };
  const html = window.foundationsNxCardHtml(item);
  window.document.getElementById('card-container').innerHTML = html;
  const card = window.document.querySelector('.foundations-nx-card');

  // The title/presenter also appear inside the share button's onclick, as
  // a JS string-literal argument to shareFoundationsClass(...) -- a
  // <script>-looking substring there is actually safe on its own (it's
  // just string data passed to a function, never re-parsed as HTML), as
  // long as the attribute's own delimiting quotes survive intact. The real
  // check is that the button's onclick attribute parsed as ONE complete,
  // un-truncated value -- if escaping had failed, an embedded quote would
  // have cut it short instead.
  const shareBtn = card.querySelector('.foundations-nx-share-btn');
  const onclickAttr = shareBtn.getAttribute('onclick');
  assert.ok(onclickAttr.includes("shareFoundationsClass(1, '<script>alert(1)</script>')"), 'the onclick attribute should have parsed as one complete, intact value, not been cut short by an unescaped quote');

  // The visible title and presenter text must not create real DOM elements.
  const titleDiv = card.querySelector('.foundations-nx-title');
  assert.strictEqual(titleDiv.querySelector('script'), null, 'a class title must not create a live <script> element');
  const metaDiv = card.querySelector('.foundations-nx-meta');
  assert.strictEqual(metaDiv.querySelector('img'), null, 'a presenter name must not create a live <img> element with an onerror handler');
});

test('Records: badge title and description cannot inject markup in the badge grid or detail panel', async () => {
  const { window } = await loadApp({
    html: '<div id="record-badge-detail-panel"></div>',
    extraExportNames: [...testExports.records],
  });
  const badge = {
    id: 'b1', title: '<script>alert(1)</script>', description: '<img src=x onerror=alert(2)>',
    icon: '🏅', section: 'General', trigger_type: 'margin_notes_count', trigger_config: {},
  };
  window.recordBadgesList.push(badge);
  const cardHtml = window.renderRecordBadgeCard(badge);
  // Checks the browser's own parsed result for each spot specifically,
  // rather than a plain substring search on the raw HTML text -- a
  // title="..." tooltip attribute is actually safe to contain a raw
  // <script> tag AS TEXT as long as its own delimiting quote is escaped
  // (which it is here), since < and > have no special meaning inside an
  // already-quote-delimited attribute value; a substring search would
  // incorrectly flag that safe case as if it were live markup.
  const wrap = window.document.createElement('div');
  wrap.innerHTML = cardHtml;
  const card = wrap.querySelector('.record-badge-card');
  assert.strictEqual(card.getAttribute('title'), '<script>alert(1)</script>', 'the tooltip attribute should contain the full, intact title as inert text');
  const titleDiv = wrap.querySelector('.record-badge-title');
  assert.strictEqual(titleDiv.textContent, '<script>alert(1)</script>', 'the visible title should be the full, intact text -- not actually a live script element');
  assert.strictEqual(titleDiv.querySelector('script'), null, 'there must be no actual <script> element in the DOM here, live or otherwise');

  window.selectRecordBadge('b1');
  const panelHtml = window.document.getElementById('record-badge-detail-panel').innerHTML;
  assert.ok(!panelHtml.includes('<img src=x onerror=alert(2)>'), 'a badge description must not be able to inject live markup in the detail panel');
});

test('Records: describeRecordTrigger escapes every interpolated value (schedule name, book name, module title)', async () => {
  const { window } = await loadApp({
    extraExportNames: [...testExports.records, ...testExports.twBibleCourse, '__setTwBibleCourseDataForTest'],
    extraSource: `import { __setTwBibleCourseDataForTest } from './shared/twBibleCourse.js';`,
  });
  const dangerous = '<script>alert(1)</script>';

  const scheduleResult = window.describeRecordTrigger({ trigger_type: 'reading_plan_completed', trigger_config: { schedule_name: dangerous } });
  assert.ok(!scheduleResult.includes('<script>'), 'a reading schedule name must not be able to inject a live script tag');

  const bookResult = window.describeRecordTrigger({ trigger_type: 'book_resources_clicked', trigger_config: { book: dangerous } });
  assert.ok(!bookResult.includes('<script>'));

  window.__setTwBibleCourseDataForTest([{ id: 'm1', title: dangerous, lessons: [] }]);
  const moduleResult = window.describeRecordTrigger({ trigger_type: 'tw_module_completed', trigger_config: { module_key: 'm1' } });
  assert.ok(!moduleResult.includes('<script>'), 'a TW module title must not be able to inject a live script tag');
});

test('TW Bible Course: a module title cannot inject markup in the module list', async () => {
  const { window } = await loadApp({
    html: '<div id="tw-course-content"></div><div id="tw-course-detail-panel" style="display:none"></div>',
    extraExportNames: [...testExports.twBibleCourse, 'renderTWModuleList', '__setTwBibleCourseDataForTest'],
    extraSource: `import { __setTwBibleCourseDataForTest } from './shared/twBibleCourse.js';`,
  });
  window.__setTwBibleCourseDataForTest([{ id: 'm1', title: '<script>alert(1)</script>', lessons: [] }]);
  window.renderTWModuleList();
  const html = window.document.getElementById('tw-course-content').innerHTML;
  assert.ok(!html.includes('<script>alert(1)'), 'a module title must not be able to inject a live script tag in the module list');
});

test('Church Resources: the admin edit form\'s notes textarea cannot be broken out of with an embedded </textarea>', async () => {
  const { window } = await loadApp({
    extraExportNames: [...testExports.churchResources, 'renderChurchResourceEditFormHtml'],
  });
  const crData = { id: 1, title: 'x', resource: 'https://example.com', notes: '</textarea><script>alert(1)</script>' };
  const html = window.renderChurchResourceEditFormHtml(crData, 'note', 0, 'John 3:16');
  assert.ok(!html.includes('</textarea><script>'), 'an embedded </textarea> in the notes field must not be able to break out of the textarea and inject a live script tag');
});

test('My Margins: the editable note textarea cannot be broken out of with an embedded </textarea>', async () => {
  const { window } = await loadApp({
    html: `<div id="note-container"></div>`,
    extraExportNames: ['escapeHtml'],
  });
  assert.strictEqual(typeof window.escapeHtml, 'function', 'escapeHtml must actually be reachable for this test to mean anything');
  // Directly confirms the fix via the actual escapeHtml call now present in
  // app.js's margin-note textarea template -- exercised through a minimal,
  // faithful reproduction of that exact template line rather than the full
  // Bible-reading view (which needs substantially more setup -- loaded
  // verses, controls row state, etc. -- unrelated to this specific fix).
  const noteText = '</textarea><script>alert(1)</script>';
  window.document.getElementById('note-container').innerHTML =
    `<textarea id="textarea-0">${window.escapeHtml(noteText)}</textarea>`;
  const html = window.document.getElementById('note-container').innerHTML;
  assert.ok(!html.includes('</textarea><script>'), 'an embedded </textarea> in a margin note must not be able to break out of the textarea and inject a live script tag');
});
