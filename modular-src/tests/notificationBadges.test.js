// tests/notificationBadges.test.js — confirms the Records and Cords header
// badges only count NEW items since the user's last opening of that
// respective area, rather than a running total, AND that this survives a
// fresh browser/localStorage entirely -- the actual bug report this file
// was expanded for: this app is designed to be opened as a downloaded
// local file as much as a hosted one, and browsers can treat two
// separately-downloaded copies of the same local HTML file as different
// origins, each with empty localStorage. "Seen" state used to live only in
// localStorage, so every app update silently looked like "nothing has ever
// been seen" again. Both trackers now live in the profiles table instead
// (seen_record_badge_ids, cord_last_read), tied to the actual account
// rather than to whichever copy of the file happens to be open -- the last
// test in each pair below specifically simulates a brand new jsdom window
// (i.e. a fresh origin, exactly like a newly-downloaded copy of the app)
// and confirms previously-saved seen/read state still applies.
//
// Also covers the visual change from the same original request: the
// Records badge now uses the same white-circle/purple-text style as
// Cords' own badge (shell.html's records-notification-badge span switched
// from the nav-badge class to nav-badge-inverse), rather than new CSS --
// there's nothing to unit-test about a CSS class name switch, so that part
// is only covered by this comment and worth a quick visual check in the
// app itself.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./helpers/loadApp.js');
const testExports = require('./testExports.js');

test('Records badge shows a count for newly-earned badges, then clears once the Records page is opened', async () => {
  const { window } = await loadApp({
    html: '<span id="records-notification-badge"></span>',
    extraExportNames: [...testExports.records, ...testExports.app],
  });

  window.__setCurrentUserForTest({ id: 'user-1' });
  window.userRecordsMap.badge1 = { count: 1 };
  window.userRecordsMap.badge2 = { count: 1 };

  await window.updateRecordsNotificationBadge();
  const badgeEl = window.document.getElementById('records-notification-badge');
  assert.strictEqual(badgeEl.style.display, 'flex', 'two never-seen badges should show the counter');
  assert.strictEqual(String(badgeEl.innerText), '2');

  // Opening the Records page is what "seeing" a badge means here.
  await window.markRecordBadgesSeen();
  assert.strictEqual(badgeEl.style.display, 'none', 'the counter should clear once the user has actually looked at the Records page');

  // Earning a THIRD badge afterward should show up again -- confirming this
  // tracks "seen at all," not just "seen once, ignore forever."
  window.userRecordsMap.badge3 = { count: 1 };
  await window.updateRecordsNotificationBadge();
  assert.strictEqual(badgeEl.style.display, 'flex');
  assert.strictEqual(String(badgeEl.innerText), '1', 'only the one genuinely new badge should count, not the two already seen');
});

test('Cords badge only counts messages received since that specific cord was last opened', async () => {
  const { window } = await loadApp({
    html: '<span id="cords-notification-badge"></span><div id="cord-view-body"></div>',
    extraExportNames: [...testExports.cords, ...testExports.app],
    supabaseOverrides: {
      cord_messages: {
        data: [
          { cord_id: 1, sender_id: 'other-user', created_at: '2026-01-01T10:00:00.000Z' },
          { cord_id: 2, sender_id: 'other-user', created_at: '2026-01-01T11:00:00.000Z' },
        ],
      },
    },
  });

  window.__setCurrentUserForTest({ id: 'user-1' });
  window.cordList.length = 0;
  window.cordList.push({ id: 1, name: 'Cord One' }, { id: 2, name: 'Cord Two' });

  await window.updateCordNotificationBadge();
  const badgeEl = window.document.getElementById('cords-notification-badge');
  assert.strictEqual(badgeEl.style.display, 'flex', 'two unread messages across two cords should show the counter');
  assert.strictEqual(String(badgeEl.innerText), '2');

  // Opening cord 1's thread should mark ONLY that cord's message as read --
  // cord 2's unread message should still count.
  await window.openCordThread(1);
  await window.updateCordNotificationBadge();
  assert.strictEqual(String(badgeEl.innerText), '1', 'opening one cord should not mark every cord as read, just that one');

  await window.openCordThread(2);
  await window.updateCordNotificationBadge();
  assert.strictEqual(badgeEl.style.display, 'none', 'once every cord with a new message has been opened, the counter should clear');
});

test('Records: seen-badge state survives a brand new browser/origin (the actual bug this fixes) since it now lives in the database, not localStorage', async () => {
  // A fresh loadApp() call is already a fresh jsdom window with empty
  // localStorage -- exactly what opening a newly-downloaded copy of the
  // app looks like. The only way this test can pass is if "seen" state is
  // actually being read from the (mocked) database, not from local storage.
  const { window } = await loadApp({
    html: '<span id="records-notification-badge"></span>',
    extraExportNames: [...testExports.records, ...testExports.app],
    supabaseOverrides: {
      profiles: { maybeSingle: { seen_record_badge_ids: ['badge1', 'badge2'] } },
    },
  });

  window.__setCurrentUserForTest({ id: 'user-1' });
  window.userRecordsMap.badge1 = { count: 1 };
  window.userRecordsMap.badge2 = { count: 1 };

  await window.updateRecordsNotificationBadge();
  const badgeEl = window.document.getElementById('records-notification-badge');
  assert.strictEqual(badgeEl.style.display, 'none', 'both badges were already marked seen in a previous session -- a fresh origin with empty localStorage should NOT show them as new again');
});

test('Cords: last-read state survives a brand new browser/origin (the actual bug this fixes) since it now lives in the database, not localStorage', async () => {
  const { window } = await loadApp({
    html: '<span id="cords-notification-badge"></span>',
    extraExportNames: [...testExports.cords, ...testExports.app],
    supabaseOverrides: {
      profiles: { maybeSingle: { cord_last_read: { 1: '2026-01-01T09:00:00.000Z' } } },
      cord_messages: {
        data: [
          { cord_id: 1, sender_id: 'other-user', created_at: '2026-01-01T08:00:00.000Z' }, // before last-read -- already seen
          { cord_id: 1, sender_id: 'other-user', created_at: '2026-01-01T10:00:00.000Z' }, // after last-read -- genuinely new
        ],
      },
    },
  });

  window.__setCurrentUserForTest({ id: 'user-1' });
  window.cordList.length = 0;
  window.cordList.push({ id: 1, name: 'Cord One' });

  await window.updateCordNotificationBadge();
  const badgeEl = window.document.getElementById('cords-notification-badge');
  assert.strictEqual(badgeEl.style.display, 'flex', 'the message from before the saved last-read time should stay read, and the one after it should show');
  assert.strictEqual(String(badgeEl.innerText), '1', 'only the genuinely new message should count -- a fresh origin with empty localStorage should not treat the earlier, already-read message as new too');
});
