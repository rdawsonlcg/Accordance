// tests/notificationBadges.test.js — confirms the Records and Cords header
// badges already do what was asked when this file was added (only count
// NEW items since the user's last opening of that respective area), rather
// than a running total. Both mechanisms already existed in the code before
// this test did -- these tests exist to actually prove it, not just take
// the source at its word, and to guard against either one regressing back
// into a running-total count later.
//
// Also covers the visual change from the same request: the Records badge
// now uses the same white-circle/purple-text style as Cords' own badge
// (shell.html's records-notification-badge span switched from the
// nav-badge class to nav-badge-inverse), rather than new CSS -- there's
// nothing to unit-test about a CSS class name switch, so that part is only
// covered by this comment and worth a quick visual check in the app itself.

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

  window.updateRecordsNotificationBadge();
  const badgeEl = window.document.getElementById('records-notification-badge');
  assert.strictEqual(badgeEl.style.display, 'flex', 'two never-seen badges should show the counter');
  assert.strictEqual(String(badgeEl.innerText), '2');

  // Opening the Records page is what "seeing" a badge means here.
  window.markRecordBadgesSeen();
  assert.strictEqual(badgeEl.style.display, 'none', 'the counter should clear once the user has actually looked at the Records page');

  // Earning a THIRD badge afterward should show up again -- confirming this
  // tracks "seen at all," not just "seen once, ignore forever."
  window.userRecordsMap.badge3 = { count: 1 };
  window.updateRecordsNotificationBadge();
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
