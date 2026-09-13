// ============================================================================
// shared/records.js — the Records/achievement-badges system: the admin-
// managed badge catalog, which of them a user has actually earned, the five
// trigger-check functions (reading plan completed, margin notes count, book
// resources clicked, TW module/course completed) that award them, the
// learner-facing Records grid, and the full admin form for creating badges.
//
// Reaches into three other already-extracted modules to check its triggers
// against what they're tracking: shared/byTheBook.js (getBibleStudyBookConfig,
// getSessionType, for the book-resources-clicked trigger) and
// shared/twBibleCourse.js (twBibleCourseData, markTWLessonComplete, for the
// TW module/course triggers) — both were previously imported from app.js
// back when this module's code still lived there; both now point here
// instead, the same re-pointing pattern used every time a piece of app.js
// with its own dependents gets pulled out.
//
// markBookResourceClicked was also imported by shared/byTheBook.js from
// app.js before this move — but only ever referenced inside onclick-
// attribute HTML strings there (which resolve through the global scope at
// click time), never called as a real function, so that import was already
// dead and was simply removed rather than re-pointed.
//
// Depends on:
//   - core/db.js: createTableAccessor, fetchAllRows, readingSchedulesTable,
//     recordsTable, userResourceClicksTable (recordBadgesTable is this
//     module's own, created locally the same way)
//   - shared/byTheBook.js: getBibleStudyBookConfig, getSessionType
//   - shared/twBibleCourse.js: twBibleCourseData, markTWLessonComplete
//   - app.js: currentUser, BIBLE_STUDIES_BOOK_ORDER, lastMainTabId,
//     ensureLoggedInFor, setHeaderIconSelected, switchTab
// app.js in turn imports this module's own exports back (loadRecordBadges,
// awardRecordByBadgeId, etc.) — the same circular-dependency pattern used
// throughout this app, safe here for the same reason: every usage on both
// sides is inside a function body, never at module-load time. (The one
// top-level, eager piece of code in this file — building
// RECORD_BIBLE_BADGE_ICONS from RECORD_BIBLE_ICON_SHAPES/_COLORS — only
// touches this module's own local, hardcoded data, so it doesn't have the
// load-order hazard a cross-module version of the same pattern would.)
// ============================================================================

import { createTableAccessor, fetchAllRows, readingSchedulesTable, recordsTable, userResourceClicksTable } from '../core/db.js';
import { getBibleStudyBookConfig, getSessionType } from './byTheBook.js';
import { twBibleCourseData, markTWLessonComplete } from './twBibleCourse.js';
import {
  currentUser, BIBLE_STUDIES_BOOK_ORDER, lastMainTabId,
  ensureLoggedInFor, setHeaderIconSelected, switchTab
} from '../app.js';

    // ============================================================
    // RECORDS (achievement badges — opened from the header ribbon icon)
    //
    // Two tables: record_badges is the admin-managed catalog (title, description, icon,
    // whether it's tallied, and — this is the part that actually connects a badge to the
    // app — an optional trigger_type + trigger_config); records is which of those a given
    // user has actually earned, and how many times. See the SQL near the bottom of this
    // section.
    //
    // How a badge gets "connected" to something happening in the app: creating a badge
    // in the admin form only ever writes a row to record_badges. Nothing awards itself —
    // four specific places in this file call one of the award/check functions below at
    // the moment something noteworthy happens (a plan is completed, a margin note is
    // saved, a resource is clicked), and those functions look through record_badges for
    // any whose trigger_type + trigger_config matches what just happened. A badge with no
    // trigger_type is purely manual/cosmetic — nothing will ever auto-award it.
    // ============================================================
    export const RECORD_TRIGGER_TYPES = {
      margin_notes_count: { label: 'A subscriber saves a number of Margin Notes' },
      reading_plan_completed: { label: 'A subscriber completes a specific Reading Plan' },
      book_resources_clicked: { label: 'A subscriber clicks every resource in one Book of the Bible' },
      book_group_resources_clicked: { label: 'A subscriber clicks every resource across a group of Books' },
      tw_module_completed: { label: 'A subscriber completes a specific TW Bible Course Module' },
      tw_course_completed: { label: 'A subscriber completes the entire TW Bible Course' }
    };

    export let recordBadgesList = [];   // [{ id, key, title, section, group_name, description, icon, tallied, trigger_type, trigger_config }]
    export const recordBadgesTable = createTableAccessor('record_badges');
    export let userRecordsMap = {};     // record_badge_id -> { count, first_achieved_at, last_achieved_at }

    // A setter, rather than letting app.js's logout cleanup clear this
    // directly — an imported binding is a read-only view from the
    // importing module's side, so resetting it from outside has to go
    // through this instead.
    export function clearUserRecordsMap() {
      userRecordsMap = {};
    }

    // How long a fetch is trusted before loadRecordBadges() will hit the network
    // again. Every trigger-check function (margin notes, reading plans, book
    // clicks, TW modules/course) calls loadRecordBadges() independently before
    // checking anything, and badges themselves change rarely (only when an
    // admin edits them in Manage Content) — this cache means a burst of those
    // checks in quick succession share one fetch instead of one each.
    // openRecordsView()'s own call still gets a genuinely fresh fetch whenever
    // more than this long has passed since the last one.
    export const RECORD_BADGES_CACHE_MS = 60000;
    export let recordBadgesListLoadedAt = 0;

    export async function loadRecordBadges() {
      if (recordBadgesListLoadedAt && (Date.now() - recordBadgesListLoadedAt) < RECORD_BADGES_CACHE_MS) return;
      try {
        recordBadgesList = await fetchAllRows('record_badges', 'id, key, title, section, group_name, description, icon, tallied, trigger_type, trigger_config');
        recordBadgesListLoadedAt = Date.now();
      } catch (e) {
        console.error('Error loading record badges:', e.message);
        recordBadgesList = [];
        recordBadgesListLoadedAt = 0; // don't cache a failed load — let the next call retry for real
      }
    }

    export async function loadUserRecords() {
      if (!currentUser) { userRecordsMap = {}; return; }
      try {
        const { data, error } = await recordsTable
          .select('record_badge_id, count, first_achieved_at, last_achieved_at')
          .eq('user_id', currentUser.id);
        if (error) throw error;
        const map = {};
        (data || []).forEach(r => { map[r.record_badge_id] = r; });
        userRecordsMap = map;
      } catch (e) {
        console.error('Error loading user records:', e.message);
        userRecordsMap = {};
      }
    }

    // --- Records header notification bubble ---
    // Same purple-circle/white-number style used everywhere else in the app (.nav-badge),
    // showing how many achieved badges the user hasn't looked at on the Records page yet.
    // "Seen" state is tracked per-user in localStorage, keyed by record_badge_id.
    export function getSeenRecordBadgeIds() {
      if (!currentUser) return [];
      try {
        const raw = localStorage.getItem(`recordsSeenBadges_${currentUser.id}`);
        return raw ? JSON.parse(raw) : [];
      } catch (e) { return []; }
    }

    // Marks every badge currently achieved as "seen", clearing the bubble — called
    // whenever the user actually opens the Records page.
    export function markRecordBadgesSeen() {
      if (!currentUser) return;
      try {
        localStorage.setItem(`recordsSeenBadges_${currentUser.id}`, JSON.stringify(Object.keys(userRecordsMap)));
      } catch (e) {}
      updateRecordsNotificationBadge();
    }

    // Recomputes how many achieved badges haven't been seen yet and updates the header
    // icon's bubble. Call this any time userRecordsMap changes (login, or right after a
    // badge is newly awarded) so the bubble stays accurate even if the user never opens
    // the Records page that session.
    export function updateRecordsNotificationBadge() {
      const badgeEl = document.getElementById('records-notification-badge');
      if (!badgeEl) return;
      const achievedIds = Object.keys(userRecordsMap);
      const seenIds = new Set(getSeenRecordBadgeIds());
      const newCount = achievedIds.filter(id => !seenIds.has(id)).length;
      if (newCount > 0) { badgeEl.innerText = newCount; badgeEl.style.display = 'flex'; }
      else badgeEl.style.display = 'none';
    }

    // Repeatable achievements (e.g. completing a plan again) — increments the tally
    // every time it's called.
    // Returns true on success, false on failure (and logs the real Supabase error to
    // the console so a silent RLS/permissions block doesn't just disappear).
    export async function awardRecordByBadgeId(badgeId) {
      if (!currentUser) return false;
      try {
        const { data: existing, error: existErr } = await recordsTable
          .select('id, count')
          .eq('user_id', currentUser.id)
          .eq('record_badge_id', badgeId)
          .maybeSingle();
        if (existErr) { console.error('Error checking existing record:', existErr.message); return false; }

        const nowIso = new Date().toISOString();
        if (existing) {
          const { error: updErr } = await recordsTable.update(existing.id, { count: existing.count + 1, last_achieved_at: nowIso });
          if (updErr) { console.error('Error updating record:', updErr.message); return false; }
        } else {
          const { error: insErr } = await recordsTable.insert({ user_id: currentUser.id, record_badge_id: badgeId, count: 1, first_achieved_at: nowIso, last_achieved_at: nowIso });
          if (insErr) { console.error('Error inserting record:', insErr.message); return false; }
        }
        await loadUserRecords();
        updateRecordsNotificationBadge();
        return true;
      } catch (e) {
        console.error('Error awarding record:', e.message);
        return false;
      }
    }

    // One-time achievements (crossing a threshold, finishing every resource in a book) —
    // does nothing if the user already has this one, so it's safe to call repeatedly.
    // Returns true if the badge is now (or was already) achieved, false on a real failure.
    export async function awardRecordOnce(badgeId) {
      if (!currentUser) return false;
      try {
        const { data: existing, error: existErr } = await recordsTable
          .select('id')
          .eq('user_id', currentUser.id)
          .eq('record_badge_id', badgeId)
          .maybeSingle();
        if (existErr) { console.error('Error checking existing record:', existErr.message); return false; }
        if (existing) return true;

        const nowIso = new Date().toISOString();
        const { error: insErr } = await recordsTable.insert({ user_id: currentUser.id, record_badge_id: badgeId, count: 1, first_achieved_at: nowIso, last_achieved_at: nowIso });
        if (insErr) { console.error('Error inserting one-time record:', insErr.message); return false; }
        await loadUserRecords();
        updateRecordsNotificationBadge();
        return true;
      } catch (e) {
        console.error('Error awarding one-time record:', e.message);
        return false;
      }
    }

    // --- Triggers #5 and #6: TW Bible Course module / whole-course completion ---
    // called from markTWLessonComplete() once a module (or the entire course) is
    // fully done. Same one-time-achievement pattern as awardRecordOnce below.
    export async function checkTWModuleCompletionBadges(moduleKey) {
      await loadRecordBadges();
      const matches = recordBadgesList.filter(b =>
        b.trigger_type === 'tw_module_completed' &&
        b.trigger_config && b.trigger_config.module_key === moduleKey);
      for (const badge of matches) await awardRecordOnce(badge.id);
    }

    export async function checkTWCourseCompletionBadges() {
      await loadRecordBadges();
      const matches = recordBadgesList.filter(b => b.trigger_type === 'tw_course_completed');
      for (const badge of matches) await awardRecordOnce(badge.id);
    }

    // --- Trigger #1: reading plan completed --- called from completeCurrentPlan().
    // Returns { matched, awarded, failed } so the caller can tell "no badge configured
    // for this plan" apart from "a badge matched but saving it failed" (e.g. an RLS block).
    export async function checkReadingPlanCompletionBadges(scheduleName) {
      await loadRecordBadges();
      const matches = recordBadgesList.filter(b =>
        b.trigger_type === 'reading_plan_completed' &&
        b.trigger_config && b.trigger_config.schedule_name === scheduleName);
      let awarded = 0, failed = 0;
      for (const badge of matches) {
        const ok = await awardRecordByBadgeId(badge.id);
        if (ok) awarded++; else failed++;
      }
      if (matches.length === 0) {
        console.warn(`No record badge is configured for the "${scheduleName}" reading plan (checked ${recordBadgesList.length} badge(s)). If you expected one to award, open Records → Add/Edit Badge and confirm a badge has trigger type "A user completes a specific Reading Plan" with this exact schedule selected.`);
      } else if (failed > 0) {
        console.error(`${failed} of ${matches.length} reading-plan badge(s) for "${scheduleName}" failed to save — see the Supabase error logged above. This is most often Row Level Security blocking writes to the "records" table.`);
      }
      return { matched: matches.length, awarded, failed };
    }

    // --- Trigger #2: margin notes count --- called after a note saves, and once after
    // a user's margin notes are first loaded (so a badge created after the fact still
    // retroactively awards).
    export async function checkMarginNotesCountBadges() {
      if (!currentUser) return;
      const notes = window.userMarginNotes || {};
      const count = Object.values(notes).filter(n => n && n.text && n.text.trim() !== '').length;

      await loadRecordBadges();
      const matches = recordBadgesList.filter(b =>
        b.trigger_type === 'margin_notes_count' &&
        b.trigger_config && typeof b.trigger_config.threshold === 'number' &&
        count >= b.trigger_config.threshold);
      for (const badge of matches) {
        await awardRecordOnce(badge.id);
      }
    }

    // --- Triggers #3 and #4: book / book-group resources fully clicked --- called
    // whenever the user clicks a session's audio, video, or article link.
    export async function markBookResourceClicked(bookTitle, sessionIndex) {
      if (!currentUser) return;
      const sessionKey = `${bookTitle}::${sessionIndex}`;
      try {
        const { error } = await userResourceClicksTable.upsert(
          { user_id: currentUser.id, book: bookTitle, session_key: sessionKey, clicked_at: new Date().toISOString() },
          null,
          { onConflict: 'user_id,book,session_key' }
        );
        if (error) { console.error('Error recording resource click:', error.message); return; }
      } catch (e) {
        console.error('Error recording resource click:', e.message);
        return;
      }
      await checkBookResourceBadgesAfterClick();
    }

    export async function checkBookResourceBadgesAfterClick() {
      if (!currentUser) return;
      const { data: clicks, error } = await userResourceClicksTable
        .select('book, session_key')
        .eq('user_id', currentUser.id);
      if (error) { console.error('Error checking resource click badges:', error.message); return; }

      const clickedByBook = {};
      (clicks || []).forEach(c => {
        if (!clickedByBook[c.book]) clickedByBook[c.book] = new Set();
        clickedByBook[c.book].add(c.session_key);
      });

      // A session only ever gets a clickable button/link rendered (see the
      // Watch/Listen/Read media rendering above) when it actually has a
      // video/audio/article URL filled in — a session whose type is set but
      // whose URL is still blank shows a "coming soon" placeholder with
      // nothing to click. Counting it toward the total anyway would make the
      // badge mathematically unearnable — the user could click every
      // resource that actually exists and still never reach the total.
      function sessionHasClickableResource(s) {
        const type = getSessionType(s);
        if (type === 'video') return !!s.video;
        if (type === 'print' || type === 'study_guide') return !!(s.article && s.article !== '#');
        if (type === 'audio') return !!s.audio;
        return false;
      }

      function isBookFullyClicked(bookTitle) {
        const idx = BIBLE_STUDIES_BOOK_ORDER.indexOf(bookTitle);
        if (idx === -1) return false;
        const cfg = getBibleStudyBookConfig(bookTitle, idx);
        const total = (cfg.sessions || []).filter(sessionHasClickableResource).length;
        if (total === 0) return false;
        const clickedSet = clickedByBook[bookTitle] || new Set();
        return clickedSet.size >= total;
      }

      await loadRecordBadges();

      const singleBookBadges = recordBadgesList.filter(b => b.trigger_type === 'book_resources_clicked');
      for (const badge of singleBookBadges) {
        const book = badge.trigger_config && badge.trigger_config.book;
        if (book && isBookFullyClicked(book)) await awardRecordOnce(badge.id);
      }

      const groupBadges = recordBadgesList.filter(b => b.trigger_type === 'book_group_resources_clicked');
      for (const badge of groupBadges) {
        const books = (badge.trigger_config && badge.trigger_config.books) || [];
        if (books.length > 0 && books.every(isBookFullyClicked)) await awardRecordOnce(badge.id);
      }
    }

    export function renderRecordIconHtml(icon) {
      if (!icon) return '🏅';
      if (/^(https?:|data:)/i.test(icon)) return `<img src="${icon}" alt="">`;
      return icon;
    }

    // ------------------------------------------------------------------
    // Icon picker for the admin badge form: 100 hand-drawn, Bible-themed icon
    // shapes (no crosses or halos) x 5 accent colors = 500 selectable icon
    // options — plain icons only, not fully fleshed-out badge concepts. This
    // is now the ONLY way to set a badge's icon (the old free-text emoji/URL
    // field was removed so every badge stays visually consistent).
    // ------------------------------------------------------------------
    export const RECORD_BIBLE_ICON_SHAPES = [
      { name: 'Burning Bush', svg: c => `<path d="M12 21v-6" stroke="${c}" stroke-width="1.6"/><circle cx="8" cy="12" r="3" fill="${c}"/><circle cx="12" cy="9" r="3.4" fill="${c}"/><circle cx="16" cy="12" r="3" fill="${c}"/><path d="M12 6c1 1 1 2 0 3-1-1-1-2 0-3Z" fill="${c}"/><path d="M8 8c.8.8.8 1.6 0 2.4-.8-.8-.8-1.6 0-2.4Z" fill="${c}"/><path d="M16 8c.8.8.8 1.6 0 2.4-.8-.8-.8-1.6 0-2.4Z" fill="${c}"/>` },
      { name: 'Stone Tablets', svg: c => `<path d="M4 21V8a2 2 0 0 1 2-2h1l1-2 1 2h1a2 2 0 0 1 2 2v13Z" fill="${c}"/><path d="M13 21V9a2 2 0 0 1 2-2h1l1-2 1 2h1a2 2 0 0 1 2 2v12Z" fill="${c}" opacity="0.75"/>` },
      { name: 'Ark of the Covenant', svg: c => `<rect x="5" y="10" width="14" height="8" rx="1" fill="${c}"/><path d="M2 11h20M2 17h20" stroke="${c}" stroke-width="1.6"/><path d="M8 10c0-2 1-3 4-3s4 1 4 3" fill="none" stroke="${c}" stroke-width="1.6"/>` },
      { name: 'Ten Commandments Scroll', svg: c => `<rect x="5" y="9" width="14" height="10" fill="${c}"/><circle cx="5" cy="12" r="3" fill="${c}"/><circle cx="19" cy="12" r="3" fill="${c}"/><path d="M9 9c0-2 1-3 3-3s3 1 3 3" fill="none" stroke="${c}" stroke-width="1.4"/>` },
      { name: "Ram's Horn", svg: c => `<path d="M4 14c0-6 5-10 12-9 3 .4 5 2.4 5 4.4 0 3-3 4-6 3-2-.7-3-2-2.4-3.4" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round"/><circle cx="6" cy="17" r="2.4" fill="${c}"/>` },
      { name: 'Donkey', svg: c => `<ellipse cx="11" cy="14" rx="7" ry="4.5" fill="${c}"/><circle cx="18" cy="10" r="3.2" fill="${c}"/><path d="M20 7 L22 4" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/><path d="M5 18v3M10 19v3M15 18v3" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/>` },
      { name: 'Olive Branch', svg: c => `<path d="M4 20c6-10 10-14 16-16" stroke="${c}" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="9" cy="14" r="1.6" fill="${c}"/><circle cx="12" cy="11" r="1.6" fill="${c}"/><circle cx="15" cy="8" r="1.6" fill="${c}"/><circle cx="7" cy="17" r="1.6" fill="${c}"/>` },
      { name: 'Dove With Olive Leaf', svg: c => `<path d="M3 13c2-3 5-4 7-3-1-3 1-6 4-6-1 2 0 4 2 5 2 1 3 3 2 5-3-1-5 0-6 2-3 1-7 0-9-3Z" fill="${c}"/><path d="M3 13c-1.4-.2-2-.6-2.6-1.4.9 0 1.6.2 2.1.7Z" fill="${c}"/>` },
      { name: 'Rainbow', svg: c => `<path d="M3 18a9 9 0 0 1 18 0" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round"/><path d="M6 18a6 6 0 0 1 12 0" fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round" opacity="0.6"/>` },
      { name: "Noah's Ark", svg: c => `<path d="M3 15h18l-2.5 5a3 3 0 0 1-2.7 1.7H8.2A3 3 0 0 1 5.5 20Z" fill="${c}"/><rect x="7" y="8" width="10" height="7" rx="1" fill="${c}"/><path d="M6 8 12 4 18 8Z" fill="${c}"/>` },
      { name: 'Mustard Seed', svg: c => `<circle cx="12" cy="16" r="2.4" fill="${c}"/><path d="M12 14c0-4 2-6 5-7-1 3-2 5-5 7Z" fill="${c}"/>` },
      { name: 'Fig Tree', svg: c => `<path d="M12 21v-8" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="9" r="7" fill="${c}"/><circle cx="8" cy="15" r="1.4" fill="${c}"/><circle cx="16" cy="15" r="1.4" fill="${c}"/>` },
      { name: 'Loaves and Fishes Basket', svg: c => `<path d="M4 11h16l-2 9H6Z" fill="${c}"/><path d="M4 11c0-3 3.5-5 8-5s8 2 8 5" fill="none" stroke="${c}" stroke-width="1.6"/><ellipse cx="9" cy="9" rx="2.4" ry="1.6" fill="${c}"/><ellipse cx="15" cy="9" rx="2.4" ry="1.6" fill="${c}"/>` },
      { name: 'Sheaf of Wheat', svg: c => `<path d="M12 21V10" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/><path d="M12 10 L8 4M12 10 L16 4M12 10 L6 7M12 10 L18 7M12 10 L12 3" stroke="${c}" stroke-width="1.4" stroke-linecap="round"/>` },
      { name: 'Grapevine Cluster', svg: c => `<circle cx="9" cy="12" r="2" fill="${c}"/><circle cx="12" cy="14" r="2" fill="${c}"/><circle cx="15" cy="12" r="2" fill="${c}"/><circle cx="10.5" cy="9" r="2" fill="${c}"/><circle cx="13.5" cy="9" r="2" fill="${c}"/><path d="M12 6v3" stroke="${c}" stroke-width="1.5"/>` },
      { name: 'Clay Jar', svg: c => `<path d="M9 4h6v3c2 1 3 3 3 6 0 5-3 8-6 8s-6-3-6-8c0-3 1-5 3-6Z" fill="${c}"/><path d="M7 8c-1.5 0-2.5 1-2.5 2.5M17 8c1.5 0 2.5 1 2.5 2.5" fill="none" stroke="${c}" stroke-width="1.4" stroke-linecap="round"/>` },
      { name: 'Oil Lamp', svg: c => `<path d="M4 15c0-3 3-5 8-5s8 2 8 5-3 4-8 4-8-1-8-4Z" fill="${c}"/><path d="M18 14c2-1 4-.5 4 1s-2 2-4 1" fill="${c}"/><path d="M9 10c0-2 1-3 3-3" stroke="${c}" stroke-width="1.4" fill="none" stroke-linecap="round"/>` },
      { name: 'Camel', svg: c => `<path d="M3 17c0-2 1-3 3-3 1-3 3-3 4-1 1-3 3-4 5-2 2-1 4 0 4 2 1 0 2 1 2 2v2H3Z" fill="${c}"/><path d="M6 17v3M10 17v3M16 17v3" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/>` },
      { name: 'Lion', svg: c => `<circle cx="12" cy="12" r="8" fill="${c}" opacity="0.35"/><circle cx="12" cy="12" r="5" fill="${c}"/><circle cx="9.5" cy="11" r="0.8" fill="var(--card-bg)"/><circle cx="14.5" cy="11" r="0.8" fill="var(--card-bg)"/>` },
      { name: 'Lamb', svg: c => `<ellipse cx="11" cy="14" rx="7" ry="5" fill="${c}"/><circle cx="17" cy="11" r="3" fill="${c}"/><path d="M6 18v3M11 19v3M16 18v3" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/>` },
      { name: 'Crown of Thorns', svg: c => `<circle cx="12" cy="12" r="7" fill="none" stroke="${c}" stroke-width="2"/><path d="M5 8 L3 6M19 8 L21 6M5 16 L3 18M19 16 L21 18M12 5 L12 2M12 19 L12 22" stroke="${c}" stroke-width="1.4" stroke-linecap="round"/>` },
      { name: 'Palm Branch', svg: c => `<path d="M12 21V9" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/><path d="M12 9c-4-1-7 0-9 3 4 1 7 0 9-3ZM12 9c4-1 7 0 9 3-4 1-7 0-9-3ZM12 12c-3-.5-5 .5-6.5 3 3 .5 5-.5 6.5-3ZM12 12c3-.5 5 .5 6.5 3-3 .5-5-.5-6.5-3Z" fill="${c}"/>` },
      { name: 'Seamless Robe', svg: c => `<path d="M9 3h6l1 4-1 1v13H9V8L8 7Z" fill="${c}"/>` },
      { name: 'Silver Coin', svg: c => `<circle cx="12" cy="12" r="8" fill="${c}"/><circle cx="12" cy="12" r="5" fill="none" stroke="var(--card-bg)" stroke-width="1"/>` },
      { name: 'Wooden Staff', svg: c => `<path d="M11 21V6c0-2 1-3 3-3" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round"/>` },
      { name: "Shepherd's Crook", svg: c => `<path d="M8 21V8c0-3 2-5 5-5" stroke="${c}" stroke-width="2" fill="none" stroke-linecap="round"/>` },
      { name: 'Sling and Stones', svg: c => `<path d="M12 4v9M8 6l4 7 4-7" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/><circle cx="6" cy="19" r="2" fill="${c}"/><circle cx="12" cy="20" r="2" fill="${c}"/><circle cx="18" cy="19" r="2" fill="${c}"/>` },
      { name: 'Harp', svg: c => `<path d="M6 20V6a6 6 0 0 1 12 0" fill="none" stroke="${c}" stroke-width="1.8"/><path d="M8 8v11M11 7v12M14 7v11" stroke="${c}" stroke-width="1.2" stroke-linecap="round"/>` },
      { name: 'Lyre', svg: c => `<path d="M6 20V10c0-4 2-7 6-7s6 3 6 7v10" fill="none" stroke="${c}" stroke-width="1.8"/><path d="M6 12h12" stroke="${c}" stroke-width="1.4"/><path d="M9 12v8M12 12v8M15 12v8" stroke="${c}" stroke-width="1.1"/>` },
      { name: 'Trumpet', svg: c => `<path d="M4 10c5 0 9 2 13 6l2-2-2 8-8-2 2-2c-3-4-5-6-7-6Z" fill="${c}"/>` },
      { name: 'Bronze Serpent', svg: c => `<path d="M12 21V3" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/><path d="M8 5c0 2 8 2 8 5s-8 3-8 6 8 2 8 4" fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/>` },
      { name: 'Pillar of Fire', svg: c => `<rect x="9" y="10" width="6" height="11" fill="${c}"/><path d="M12 2c1.5 2-1 3-1 5s1 3 1 3 1-1 1-3-2.5-3-1-5Z" fill="${c}"/>` },
      { name: 'Pillar of Cloud', svg: c => `<rect x="9" y="12" width="6" height="9" fill="${c}"/><circle cx="9" cy="9" r="2.6" fill="${c}"/><circle cx="12" cy="7" r="3.2" fill="${c}"/><circle cx="15" cy="9" r="2.6" fill="${c}"/>` },
      { name: 'Manna in a Jar', svg: c => `<path d="M8 9h8v9a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2Z" fill="${c}"/><rect x="9" y="5" width="6" height="4" rx="1" fill="${c}"/><circle cx="10.5" cy="14" r="0.8" fill="var(--card-bg)"/><circle cx="13.5" cy="14" r="0.8" fill="var(--card-bg)"/><circle cx="12" cy="17" r="0.8" fill="var(--card-bg)"/>` },
      { name: "Aaron's Budding Rod", svg: c => `<path d="M12 21V7" stroke="${c}" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="5" r="1.6" fill="${c}"/><circle cx="9.5" cy="6.5" r="1.4" fill="${c}"/><circle cx="14.5" cy="6.5" r="1.4" fill="${c}"/>` },
      { name: 'Altar of Incense', svg: c => `<path d="M6 21l1-6h10l1 6Z" fill="${c}"/><path d="M12 15c-1-2 1-3 0-5" fill="none" stroke="${c}" stroke-width="1.4" stroke-linecap="round"/>` },
      { name: 'Golden Candlestick', svg: c => `<path d="M12 21v-8M6 21v-5c0-2 1-3 3-3M18 21v-5c0-2-1-3-3-3M9 21v-3c0-1 1-2 2-2M15 21v-3c0-1-1-2-2-2M12 13V8" stroke="${c}" stroke-width="1.4" fill="none" stroke-linecap="round"/><path d="M4 21h16" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="6" r="1.6" fill="${c}"/>` },
      { name: 'Showbread Table', svg: c => `<rect x="4" y="16" width="16" height="2" fill="${c}"/><path d="M6 18v3M18 18v3" stroke="${c}" stroke-width="1.6"/><ellipse cx="12" cy="13" rx="6" ry="2" fill="${c}"/><ellipse cx="12" cy="10.5" rx="5" ry="1.8" fill="${c}"/>` },
      { name: 'Horn of Oil', svg: c => `<path d="M5 6c8 0 12 4 12 9-3 1-5-1-5-4 0 3-3 5-7 4 3-2 3-5 0-9Z" fill="${c}"/>` },
      { name: 'Wailing Wall Stone', svg: c => `<rect x="4" y="14" width="7" height="6" fill="${c}"/><rect x="13" y="14" width="7" height="6" fill="${c}"/><rect x="8" y="8" width="7" height="6" fill="${c}"/><rect x="2" y="8" width="5" height="6" fill="${c}" opacity="0.7"/><rect x="16" y="8" width="6" height="6" fill="${c}" opacity="0.7"/>` },
      { name: 'City Gates', svg: c => `<path d="M5 21V11a7 7 0 0 1 14 0v10" fill="none" stroke="${c}" stroke-width="2.2"/><path d="M5 21h14" stroke="${c}" stroke-width="2.2" stroke-linecap="round"/>` },
      { name: 'Watchtower', svg: c => `<rect x="9" y="8" width="6" height="13" fill="${c}"/><path d="M8 8h2v-2h1v2h2v-2h1v2h2v-2h1v2h1" fill="none" stroke="${c}" stroke-width="1.2"/>` },
      { name: 'Anchor', svg: c => `<circle cx="12" cy="5" r="2" fill="none" stroke="${c}" stroke-width="1.8"/><path d="M12 7v13M6 15c0 4 3 6 6 6s6-2 6-6M6 11h12" stroke="${c}" stroke-width="1.8" fill="none" stroke-linecap="round"/>` },
      { name: 'Key', svg: c => `<circle cx="7" cy="7" r="4" fill="none" stroke="${c}" stroke-width="2.2"/><path d="M10 10 L20 20M16 16l2-2M18 18l2-2" stroke="${c}" stroke-width="2.2" stroke-linecap="round"/>` },
      { name: 'Door With Wooden Lintel', svg: c => `<path d="M5 21V6h14v15" fill="none" stroke="${c}" stroke-width="2"/><rect x="4" y="4" width="16" height="2.4" fill="${c}"/><circle cx="15" cy="13" r="0.9" fill="${c}"/>` },
      { name: 'Sealed Scroll', svg: c => `<rect x="4" y="9" width="16" height="6" fill="${c}"/><circle cx="4" cy="12" r="3" fill="${c}"/><circle cx="20" cy="12" r="3" fill="${c}"/><circle cx="12" cy="12" r="2.2" fill="var(--card-bg)"/><circle cx="12" cy="12" r="1.1" fill="${c}"/>` },
      { name: 'Quill and Inkhorn', svg: c => `<path d="M20 4c-6 1-11 6-13 12l-2 2 2 2 2-2c6-2 11-7 12-13Z" fill="${c}"/><circle cx="6" cy="19" r="2.2" fill="${c}"/>` },
      { name: 'Signet Ring', svg: c => `<circle cx="10" cy="15" r="6" fill="none" stroke="${c}" stroke-width="2.2"/><rect x="12" y="4" width="8" height="8" rx="2" fill="${c}"/>` },
      { name: 'Scales of Justice', svg: c => `<path d="M12 3v16" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/><path d="M4 8h16" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/><path d="M4 8l-2 5a3 3 0 0 0 6 0Z" fill="${c}"/><path d="M20 8l-2 5a3 3 0 0 0 6 0Z" fill="${c}"/><path d="M8 21h8" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/>` },
      { name: 'Broken Chains', svg: c => `<circle cx="6" cy="8" r="3" fill="none" stroke="${c}" stroke-width="2"/><circle cx="10" cy="13" r="3" fill="none" stroke="${c}" stroke-width="2"/><circle cx="16" cy="8" r="3" fill="none" stroke="${c}" stroke-width="2"/><circle cx="19" cy="14" r="3" fill="none" stroke="${c}" stroke-width="2"/>` },
      { name: 'Prison Cell Door', svg: c => `<rect x="5" y="4" width="14" height="17" fill="none" stroke="${c}" stroke-width="2"/><path d="M9 4v17M13 4v17M17 4v17" stroke="${c}" stroke-width="1.6"/>` },
      { name: 'Anchor Chain', svg: c => `<circle cx="12" cy="4" r="2" fill="none" stroke="${c}" stroke-width="1.8"/><circle cx="12" cy="9" r="2" fill="none" stroke="${c}" stroke-width="1.8"/><circle cx="12" cy="14" r="2" fill="none" stroke="${c}" stroke-width="1.8"/><path d="M6 20c0 1 2 1 6 1s6 0 6-1" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/>` },
      { name: "Ship's Wheel", svg: c => `<circle cx="12" cy="12" r="7" fill="none" stroke="${c}" stroke-width="2"/><circle cx="12" cy="12" r="2" fill="${c}"/><path d="M12 5v-3M12 19v3M5 12h-3M19 12h3M7 7l-2-2M17 7l2-2M7 17l-2 2M17 17l2 2" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/>` },
      { name: 'Compass Rose', svg: c => `<circle cx="12" cy="12" r="8" fill="none" stroke="${c}" stroke-width="1.6"/><path d="M12 6 L14 12 L12 18 L10 12 Z" fill="${c}"/>` },
      { name: 'Anchor in a Storm', svg: c => `<path d="M12 5v11M8 12c0 3 2 5 4 5s4-2 4-5" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="4" r="1.6" fill="none" stroke="${c}" stroke-width="1.4"/><path d="M3 19c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0 3 1.5 4.5 0" fill="none" stroke="${c}" stroke-width="1.4" stroke-linecap="round"/>` },
      { name: 'Mountain Peak', svg: c => `<path d="M2 19 9 8l4 6 3-3 6 8Z" fill="${c}"/>` },
      { name: 'Desert Dunes', svg: c => `<circle cx="18" cy="6" r="2.6" fill="${c}"/><path d="M2 16c3-3 6-3 9 0s6 3 9 0M2 20c3-3 6-3 9 0s6 3 9 0" fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/>` },
      { name: 'Oasis With Palm Trees', svg: c => `<path d="M8 21V13" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/><path d="M8 13c-2-1-3-3-2-5 2 0 3 2 4 4 1-2 2-4 4-4 1 2 0 4-2 5" fill="${c}"/><path d="M2 21c2-2 4-2 6 0s4 2 6 0 4-2 6 0" fill="none" stroke="${c}" stroke-width="1.4" stroke-linecap="round"/>` },
      { name: 'River Jordan Flowing', svg: c => `<path d="M2 8c4-3 6 1 10-2s6 1 10-2M2 14c4-3 6 1 10-2s6 1 10-2M2 20c4-3 6 1 10-2s6 1 10-2" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/>` },
      { name: 'Whirlwind', svg: c => `<path d="M12 3a9 9 0 1 0 6.4 15.4M12 3a6 6 0 1 1-4.2 10.2M12 3a3 3 0 1 1-2 5.2" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/>` },
      { name: 'Thundercloud', svg: c => `<path d="M6 14a4 4 0 1 1 1-7.9A5 5 0 0 1 17 8a4 4 0 0 1-1 7.9Z" fill="${c}"/><path d="M13 13l-3 5h3l-2 5 6-7h-3Z" fill="${c}"/>` },
      { name: 'Burning Furnace', svg: c => `<rect x="5" y="12" width="14" height="9" fill="${c}"/><path d="M8 12c-1-2 1-3 0-5 2 0 3 2 2 5ZM12 12c-1-2 1-4 0-6 2 0 3 3 2 6ZM16 12c-1-2 1-3 0-5 2 0 3 2 2 5Z" fill="${c}"/>` },
      { name: 'Den of Lions', svg: c => `<path d="M4 21V12a8 8 0 0 1 16 0v9" fill="none" stroke="${c}" stroke-width="2"/><circle cx="12" cy="15" r="3" fill="${c}"/>` },
      { name: "Jacob's Ladder", svg: c => `<path d="M8 3v18M16 3v18" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/><path d="M8 6h8M8 10h8M8 14h8M8 18h8" stroke="${c}" stroke-width="1.6"/>` },
      { name: 'Well of Water', svg: c => `<path d="M5 12h14v9H5Z" fill="none" stroke="${c}" stroke-width="2"/><path d="M12 3v9" stroke="${c}" stroke-width="1.6"/><rect x="9.5" y="10" width="5" height="4" rx="0.6" fill="${c}"/>` },
      { name: 'Clay Pitcher', svg: c => `<path d="M9 4h5l1 3c2 1 3 3 3 6 0 4-3 7-6 7s-6-3-6-7c0-3 1-5 3-6Z" fill="${c}"/><path d="M17 9c1.5 0 2.5 1 2.5 2.5" fill="none" stroke="${c}" stroke-width="1.4" stroke-linecap="round"/>` },
      { name: 'Wedding Feast Cup', svg: c => `<path d="M8 3h8l-1 6a3 3 0 0 1-6 0Z" fill="${c}"/><path d="M12 12v6" stroke="${c}" stroke-width="1.8"/><path d="M8 21h8" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/>` },
      { name: 'Loaf of Unleavened Bread', svg: c => `<rect x="4" y="9" width="16" height="8" rx="2" fill="${c}"/><path d="M8 11v4M12 11v4M16 11v4" stroke="var(--card-bg)" stroke-width="1"/>` },
      { name: 'Bowl of Bitter Herbs', svg: c => `<path d="M4 12h16l-2 6a2 2 0 0 1-2 1.5H8A2 2 0 0 1 6 18Z" fill="${c}"/><path d="M10 12c-1-2 0-4 1-5M14 12c1-2 0-4-1-5" fill="none" stroke="${c}" stroke-width="1.4" stroke-linecap="round"/>` },
      { name: 'Passover Lamb Shank', svg: c => `<path d="M6 8a2.4 2.4 0 1 1 3.4 2.2l5.2 5.2A2.4 2.4 0 1 1 17 18a2.4 2.4 0 0 1-2.2-3.4L9.6 9.4A2.4 2.4 0 0 1 6 8Z" fill="${c}"/>` },
      { name: 'Seder Plate', svg: c => `<circle cx="12" cy="12" r="9" fill="none" stroke="${c}" stroke-width="2"/><path d="M12 3v18M3 12h18M6 6l12 12M18 6 6 18" stroke="${c}" stroke-width="1"/>` },
      { name: 'Incense Censer', svg: c => `<path d="M12 2v3" stroke="${c}" stroke-width="1.4"/><path d="M6 5h12l-2 4H8Z" fill="${c}"/><path d="M8 9v3a4 4 0 0 0 8 0V9" fill="none" stroke="${c}" stroke-width="1.6"/><path d="M12 16c-1-2 1-3 0-5" fill="none" stroke="${c}" stroke-width="1.4" stroke-linecap="round"/>` },
      { name: 'Priestly Breastplate', svg: c => `<rect x="5" y="6" width="14" height="12" rx="1" fill="${c}"/><circle cx="8" cy="9" r="1" fill="var(--card-bg)"/><circle cx="12" cy="9" r="1" fill="var(--card-bg)"/><circle cx="16" cy="9" r="1" fill="var(--card-bg)"/><circle cx="8" cy="13" r="1" fill="var(--card-bg)"/><circle cx="12" cy="13" r="1" fill="var(--card-bg)"/><circle cx="16" cy="13" r="1" fill="var(--card-bg)"/>` },
      { name: 'Turban With Golden Plate', svg: c => `<path d="M4 16a8 8 0 0 1 16 0Z" fill="${c}"/><rect x="9" y="14.5" width="6" height="2.4" rx="1" fill="var(--card-bg)"/>` },
      { name: 'Ephod', svg: c => `<path d="M8 3 4 6v3l3-1v13h10V8l3 1V6L16 3l-2 2h-4Z" fill="${c}"/>` },
      { name: 'Sandals With Dusty Straps', svg: c => `<ellipse cx="12" cy="15" rx="7" ry="3.4" fill="${c}"/><path d="M8 12 12 6l4 6" fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/>` },
      { name: 'Washing Basin and Towel', svg: c => `<path d="M4 12h16l-2 3a3 3 0 0 1-3 2.5H9A3 3 0 0 1 6 15Z" fill="${c}"/><path d="M15 6c1 2 0 3-1 4s-1 2 0 3" fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/>` },
      { name: 'Pomegranate', svg: c => `<circle cx="12" cy="14" r="7" fill="${c}"/><path d="M9 6 10.5 3 12 6 13.5 3 15 6" fill="none" stroke="${c}" stroke-width="1.4" stroke-linecap="round"/>` },
      { name: 'Palm Frond Shelter', svg: c => `<path d="M4 21V13l8-6 8 6v8" fill="none" stroke="${c}" stroke-width="2"/><path d="M12 7c-2-2-4-2-6 0 2 1 4 1 6 0ZM12 7c2-2 4-2 6 0-2 1-4 1-6 0Z" fill="${c}"/>` },
      { name: 'Tent Peg and Mallet', svg: c => `<path d="M6 21 12 9l6 12Z" fill="${c}"/><rect x="14" y="3" width="6" height="4" rx="1" fill="${c}"/><path d="M16 7v6" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/>` },
      { name: "Watchman's Horn", svg: c => `<path d="M5 8c6 1 10 4 13 9l2-2-3 8-8-3 2-2c-3-4-4-7-6-10Z" fill="${c}"/>` },
      { name: 'Sieve Separating Wheat', svg: c => `<circle cx="12" cy="8" r="6" fill="none" stroke="${c}" stroke-width="2"/><path d="M6 8h12M8 5.5h8M8 10.5h8" stroke="${c}" stroke-width="1"/><path d="M9 16v2M12 16v3M15 16v2" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/>` },
      { name: 'Pruning Shears', svg: c => `<path d="M5 5l14 14M19 5 5 19" stroke="${c}" stroke-width="2" stroke-linecap="round"/><circle cx="5" cy="5" r="2" fill="${c}"/><circle cx="19" cy="5" r="2" fill="${c}"/>` },
      { name: 'Vineyard Watchtower', svg: c => `<rect x="9" y="4" width="6" height="17" fill="${c}"/><circle cx="6" cy="19" r="2" fill="${c}"/><circle cx="18" cy="19" r="2" fill="${c}"/>` },
      { name: 'Windmill Stone', svg: c => `<circle cx="12" cy="12" r="2" fill="${c}"/><path d="M12 12 4 8c2 4 2 6 0 8ZM12 12 20 8c-2 4-2 6 0 8ZM12 12 8 4c4 2 6 2 8 0ZM12 12 8 20c4-2 6-2 8 0Z" fill="${c}"/>` },
      { name: 'Pearl of Great Price', svg: c => `<path d="M2 14c4-6 16-6 20 0-4 4-16 4-20 0Z" fill="${c}"/><circle cx="12" cy="12" r="3" fill="var(--card-bg)"/><circle cx="12" cy="12" r="1.6" fill="${c}"/>` },
      { name: 'Hidden Treasure Chest', svg: c => `<rect x="4" y="10" width="16" height="9" rx="1" fill="${c}"/><path d="M4 10a8 4 0 0 1 16 0" fill="none" stroke="${c}" stroke-width="2"/><rect x="10.5" y="12.5" width="3" height="3" rx="0.6" fill="var(--card-bg)"/>` },
      { name: 'Salt Shaker', svg: c => `<path d="M9 9h6v9a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2Z" fill="${c}"/><rect x="9.5" y="5" width="5" height="4" rx="1" fill="${c}"/><circle cx="10.5" cy="3.5" r="0.6" fill="${c}"/><circle cx="12" cy="3" r="0.6" fill="${c}"/><circle cx="13.5" cy="3.5" r="0.6" fill="${c}"/>` },
      { name: 'City Set on a Hill', svg: c => `<path d="M2 19c4-6 16-6 20 0Z" fill="${c}"/><rect x="8" y="10" width="3" height="6" fill="${c}"/><rect x="13" y="8" width="3" height="8" fill="${c}"/>` },
      { name: 'Lamp Under a Basket', svg: c => `<path d="M6 13h12l-1.5 7h-9Z" fill="none" stroke="${c}" stroke-width="2"/><circle cx="12" cy="9" r="3" fill="${c}" opacity="0.5"/>` },
      { name: 'Narrow Gate', svg: c => `<path d="M9 21V5h6v16" fill="none" stroke="${c}" stroke-width="2.2"/><path d="M9 5h6" stroke="${c}" stroke-width="2.2"/>` },
      { name: "Camel Through a Needle's Eye", svg: c => `<path d="M11 2c3 0 4 3 4 6s-1 4-1 4 1 2 1 4-1 6-4 6" fill="none" stroke="${c}" stroke-width="1.6"/><ellipse cx="10" cy="8" rx="2" ry="3" fill="none" stroke="${c}" stroke-width="1.4"/><path d="M5 18c0-1 1-2 2-2s1 1 2 0 1-1 2 0" fill="none" stroke="${c}" stroke-width="1.4" stroke-linecap="round"/>` },
      { name: 'Sparrow', svg: c => `<path d="M3 14c3-4 7-5 10-3-1-2 0-4 2-4 0 1 0 2 1 2 2 0 3 1 3 2-1 0-2 0-2 1 2 1 3 3 2 5-3-1-5 0-6 1-3 1-7 0-10-4Z" fill="${c}"/>` },
      { name: 'Lily of the Field', svg: c => `<path d="M12 21v-7" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/><path d="M12 14c-2 0-3-2-3-4 2 0 3 1 3 4ZM12 14c2 0 3-2 3-4-2 0-3 1-3 4Z" fill="${c}"/><circle cx="12" cy="8" r="3.4" fill="${c}"/>` },
      { name: 'Raven With Food', svg: c => `<path d="M3 12c3-3 7-4 10-2-1-2 0-3 2-3 0 1 0 1 1 1 2 0 3 1 3 2-1 0-1 0-2 1 1 1 2 3 1 4-3-1-5 0-6 1-3 1-6 0-9-4Z" fill="${c}"/><rect x="14" y="10" width="2" height="1.6" fill="${c}"/>` },
      { name: 'Locust', svg: c => `<ellipse cx="12" cy="12" rx="4" ry="2.4" fill="${c}"/><path d="M8 12 3 9M8 13 3 16M16 12l5-3M16 13l5 3" stroke="${c}" stroke-width="1.4" stroke-linecap="round"/><path d="M9 14c-1 2-1 4 0 6M15 14c1 2 1 4 0 6" stroke="${c}" stroke-width="1.4" stroke-linecap="round"/>` },
      { name: 'Scourge of Cords', svg: c => `<path d="M6 3c3 4 3 8 0 12M12 3c3 4 3 8 0 12M18 3c3 4 3 8 0 12" fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/><circle cx="6" cy="9" r="1" fill="${c}"/><circle cx="12" cy="9" r="1" fill="${c}"/><circle cx="18" cy="9" r="1" fill="${c}"/>` },
      { name: 'Clay Pot Breaking', svg: c => `<path d="M8 9h8l-1 9a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2Z" fill="${c}"/><rect x="9" y="5" width="6" height="4" rx="1" fill="${c}"/><path d="M17 15l3 1-2 3Z" fill="${c}"/>` },
      { name: 'Cornerstone', svg: c => `<path d="M4 20V10l8-6 8 6v10Z" fill="none" stroke="${c}" stroke-width="2"/><path d="M4 10h16" stroke="${c}" stroke-width="2"/>` },
      { name: 'Feather Pen', svg: c => `<path d="M20 4c-6 1-11 6-13 12" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/><path d="M20 4c-2 4-5 7-9 9-1-3 1-6 4-8 2-1 3-1 5-1Z" fill="${c}"/><path d="M7 16l-2 4" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/>` }
    ];

    export const RECORD_BIBLE_ICON_COLORS = [
      { name: 'Indigo', hex: '#6366f1' },
      { name: 'Teal', hex: '#0d9488' },
      { name: 'Coral', hex: '#e11d48' },
      { name: 'Gold', hex: '#ca8a04' },
      { name: 'Violet', hex: '#7c3aed' }
    ];

    export const RECORD_BIBLE_BADGE_ICONS = [];
    RECORD_BIBLE_ICON_SHAPES.forEach(shape => {
      RECORD_BIBLE_ICON_COLORS.forEach(color => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${shape.svg(color.hex)}</svg>`;
        RECORD_BIBLE_BADGE_ICONS.push({
          label: `${shape.name} (${color.name})`,
          dataUri: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg)
        });
      });
    });

    export let recordAdminIconPickerPopulated = false;
    export function populateRecordAdminIconPicker() {
      if (recordAdminIconPickerPopulated) return;
      const select = document.getElementById('record-admin-icon-picker');
      if (!select) return;
      select.innerHTML = '<option value="">Pick an icon…</option>' +
        RECORD_BIBLE_BADGE_ICONS.map(item => `<option value="${item.dataUri}">${item.label}</option>`).join('');
      recordAdminIconPickerPopulated = true;
    }

    export function handleRecordAdminIconPickerChange() {
      const picker = document.getElementById('record-admin-icon-picker');
      if (!picker || !picker.value) return;
      document.getElementById('record-admin-icon').value = picker.value;
      picker.value = '';
      updateRecordAdminIconPreview();
      updateRecordAdminBadgePreview();
    }

    // Shows the currently-selected icon next to the picker — the only visual
    // confirmation of what's chosen now that there's no free-text field to
    // read the raw value from.
    export function updateRecordAdminIconPreview() {
      const preview = document.getElementById('record-admin-icon-preview');
      if (!preview) return;
      const val = document.getElementById('record-admin-icon').value;
      preview.innerHTML = val
        ? renderRecordIconHtml(val)
        : '<span style="font-size:10px; color:var(--text-muted); text-align:center; line-height:1.2;">No icon</span>';
    }

    // A non-interactive stand-in for renderRecordBadgeCard, used only in the
    // admin form's live preview — badge.id is a placeholder string here, never
    // a real record_badges id, so this never wires up selectRecordBadge.
    export function renderRecordBadgePreviewCard(badge, achieved) {
      const hue = getRecordBadgeHueColor(badge);
      const cornerHtml = achieved
        ? (badge.tallied
            ? `<span class="record-badge-corner tally">3</span>`
            : `<span class="record-badge-corner check">${RECORD_BADGE_CHECK_SVG}</span>`)
        : '';
      return `
        <div class="record-badge-card ${achieved ? 'achieved' : 'locked'}" style="--badge-hue-color:${hue}; cursor:default; max-width:110px;">
          ${cornerHtml}
          <div class="record-badge-icon-circle">
            <span class="record-badge-icon">${achieved ? renderRecordIconHtml(badge.icon) : RECORD_BADGE_LOCK_SVG}</span>
          </div>
          <div class="record-badge-title">${badge.title}</div>
        </div>`;
    }

    // Live preview in the badge builder — shows both the achieved and locked
    // look for whatever title/icon/tallied setting is currently in the form,
    // updated on every relevant edit rather than only after saving.
    export function updateRecordAdminBadgePreview() {
      const container = document.getElementById('record-admin-badge-preview');
      if (!container) return;
      const rawTitle = (document.getElementById('record-admin-title').value || '').trim();
      const title = rawTitle || 'Badge title';
      const icon = document.getElementById('record-admin-icon').value;
      const tallied = document.getElementById('record-admin-tallied').checked;

      // Keep the accent hue stable while typing rather than shifting on every
      // keystroke — reuse the real badge's own id/key when editing one,
      // otherwise a fixed placeholder key for a brand-new badge.
      const editId = document.getElementById('record-admin-edit-select').value;
      const editingBadge = editId ? recordBadgesList.find(b => String(b.id) === editId) : null;
      const hueKey = editingBadge ? (editingBadge.key || editingBadge.id) : 'new-badge-preview';

      const mockBadge = { key: hueKey, title, icon, tallied };

      container.innerHTML = `
        <div style="text-align:center;">
          <div style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.4px; color:var(--text-muted); margin-bottom:6px;">Achieved</div>
          ${renderRecordBadgePreviewCard(mockBadge, true)}
        </div>
        <div style="text-align:center;">
          <div style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.4px; color:var(--text-muted); margin-bottom:6px;">Locked</div>
          ${renderRecordBadgePreviewCard(mockBadge, false)}
        </div>`;
    }

    // Plain-language description of what earns a badge, derived from its trigger —
    // shown for not-yet-achieved badges so users know exactly what to go do.
    export function describeRecordTrigger(badge) {
      const cfg = badge.trigger_config || {};
      switch (badge.trigger_type) {
        case 'margin_notes_count':
          return typeof cfg.threshold === 'number' ? `Save ${cfg.threshold} margin note${cfg.threshold === 1 ? '' : 's'}.` : '';
        case 'reading_plan_completed':
          return cfg.schedule_name ? `Complete the "${cfg.schedule_name}" reading plan.` : '';
        case 'book_resources_clicked':
          return cfg.book ? `Explore every resource in the book of ${cfg.book} (Study tab → Books of the Bible).` : '';
        case 'book_group_resources_clicked':
          return (cfg.books && cfg.books.length) ? `Explore every resource in each of: ${cfg.books.join(', ')}.` : '';
        case 'tw_module_completed': {
          const mod = cfg.module_key ? twBibleCourseData.find(m => m.id === cfg.module_key) : null;
          return mod ? `Complete the "${mod.title}" module of the TW Bible Course.` : '';
        }
        case 'tw_course_completed':
          return 'Complete every module of the TW Bible Course.';
        default:
          return '';
      }
    }

    // Groups badges by section (alphabetical), and within each section sorts
    // alphabetically by title — except the badge this user most recently achieved
    // in that section (if any) is pulled to the front.
    // A badge's trigger_type is a natural "family" — several Margin Notes
    // badges at different thresholds, for instance, read as one escalating
    // set rather than a scattered alphabetical list. Only types with a
    // sensible progression order get a numeric sort; the rest just fall back
    // to title order within their set.
    export function getRecordBadgeSetLabel(triggerType) {
      switch (triggerType) {
        case 'margin_notes_count': return 'Margin Notes';
        case 'reading_plan_completed': return 'Reading Plans';
        case 'book_resources_clicked':
        case 'book_group_resources_clicked': return 'Book Study';
        default: return '';
      }
    }

    // Sorts the badges inside a set (whether auto-grouped by trigger type or
    // manually grouped by an admin). If every member shares the same
    // margin-notes-count trigger, that has a genuine numeric progression —
    // lowest threshold to highest. Everything else (mixed trigger types, or
    // types without a natural number) falls back to title order.
    export function sortBadgesForSet(badges) {
      const uniformType = badges.every(b => b.trigger_type === badges[0].trigger_type) ? badges[0].trigger_type : null;
      if (uniformType === 'margin_notes_count') {
        return badges.slice().sort((a, b) => {
          const ta = (a.trigger_config && a.trigger_config.threshold) || 0;
          const tb = (b.trigger_config && b.trigger_config.threshold) || 0;
          return ta - tb;
        });
      }
      return badges.slice().sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    }

    export function getGroupedRecordBadgeSections() {
      const bySection = {};
      recordBadgesList.forEach(badge => {
        const sectionName = (badge.section || '').trim() || 'General';
        if (!bySection[sectionName]) bySection[sectionName] = [];
        bySection[sectionName].push(badge);
      });

      const sectionNames = Object.keys(bySection).sort((a, b) => a.localeCompare(b));
      const GROUPABLE_TYPES = ['margin_notes_count', 'reading_plan_completed', 'book_resources_clicked', 'book_group_resources_clicked'];

      return sectionNames.map(sectionName => {
        const sectionBadges = bySection[sectionName];

        // An admin-assigned Group name always wins over automatic grouping
        // below — it's how an admin groups badges of different trigger types
        // together, splits apart badges that would've auto-grouped by type,
        // or just gives a set a custom label.
        const byManualGroup = {};
        const remaining = [];
        sectionBadges.forEach(badge => {
          const groupName = (badge.group_name || '').trim();
          if (groupName) {
            (byManualGroup[groupName] = byManualGroup[groupName] || []).push(badge);
          } else {
            remaining.push(badge);
          }
        });

        // Whatever's left without a manual group still auto-groups by shared
        // trigger type (2+ badges of the same type), same as before.
        const byTriggerType = {};
        const standalone = [];
        remaining.forEach(badge => {
          if (badge.trigger_type && GROUPABLE_TYPES.includes(badge.trigger_type)) {
            (byTriggerType[badge.trigger_type] = byTriggerType[badge.trigger_type] || []).push(badge);
          } else {
            standalone.push(badge);
          }
        });

        let mostRecentId = null, mostRecentTime = -Infinity;
        sectionBadges.forEach(b => {
          const rec = userRecordsMap[b.id];
          if (rec && rec.last_achieved_at) {
            const t = new Date(rec.last_achieved_at).getTime();
            if (t > mostRecentTime) { mostRecentTime = t; mostRecentId = b.id; }
          }
        });

        const items = [];

        // Manual groups first — even a "group" of one still renders as a
        // labeled set, since the admin named it on purpose (unlike automatic
        // grouping, where a lone badge of a groupable type just stays plain).
        Object.keys(byManualGroup).sort((a, b) => a.localeCompare(b)).forEach(groupName => {
          items.push({ type: 'set', label: groupName, badges: sortBadgesForSet(byManualGroup[groupName]) });
        });

        Object.keys(byTriggerType).sort().forEach(triggerType => {
          const group = byTriggerType[triggerType];
          if (group.length < 2) { standalone.push(...group); return; }
          items.push({ type: 'set', label: getRecordBadgeSetLabel(triggerType), badges: sortBadgesForSet(group) });
        });

        let orderedStandalone = standalone.slice().sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        const idx = orderedStandalone.findIndex(b => b.id === mostRecentId);
        if (idx > 0) {
          const [mostRecent] = orderedStandalone.splice(idx, 1);
          orderedStandalone.unshift(mostRecent);
        }
        orderedStandalone.forEach(badge => items.push({ type: 'single', badge }));

        return { sectionName, items };
      });
    }

    // Deterministic accent color per badge (hash of its stable key/id) so achieved
    // badges get some visual variety across a section rather than being uniform.
    export const RECORD_BADGE_HUE_PALETTE = ['#6366f1', '#0d9488', '#e11d48', '#ca8a04', '#7c3aed'];
    export function getRecordBadgeHueColor(badge) {
      const str = String(badge.key || badge.id || badge.title || '');
      let hash = 0;
      for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
      return RECORD_BADGE_HUE_PALETTE[hash % RECORD_BADGE_HUE_PALETTE.length];
    }

    // Best-effort "how close am I" progress for a not-yet-achieved badge, shown as
    // a small progress bar in its card. Only meaningful for triggers we can measure
    // purely from data already loaded client-side — margin note count is the only
    // one right now (reading-plan completion is all-or-nothing, and the two
    // resource-click triggers would need an extra network round trip per badge to
    // show accurately, so those just render as a plain locked card instead).
    export function getRecordBadgeProgress(badge) {
      if (badge.trigger_type === 'margin_notes_count' && badge.trigger_config && typeof badge.trigger_config.threshold === 'number') {
        const notes = window.userMarginNotes || {};
        const count = Object.values(notes).filter(n => n && n.text && n.text.trim() !== '').length;
        const total = badge.trigger_config.threshold;
        if (total > 0 && count < total) return { current: count, total };
      }
      return null;
    }

    export const RECORD_BADGE_CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 L9.5 18 L20 6"></path></svg>';
    export const RECORD_BADGE_LOCK_SVG = '<svg class="record-badge-lock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2"></rect><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"></path></svg>';

    export function renderRecordBadgeCard(badge) {
      const rec = userRecordsMap[badge.id];
      const achieved = !!rec;
      const showTally = achieved && badge.tallied && rec.count > 1;
      const safeTitle = (badge.title || '').replace(/"/g, '&quot;');
      const hue = getRecordBadgeHueColor(badge);

      let cornerHtml = '';
      if (achieved) {
        cornerHtml = showTally
          ? `<span class="record-badge-corner tally">${rec.count}</span>`
          : `<span class="record-badge-corner check">${RECORD_BADGE_CHECK_SVG}</span>`;
      }

      let progressHtml = '';
      if (!achieved) {
        const progress = getRecordBadgeProgress(badge);
        if (progress) {
          const pct = Math.min(100, Math.round((progress.current / progress.total) * 100));
          progressHtml = `
            <div class="record-badge-progress-track"><div class="record-badge-progress-fill" style="width:${pct}%;"></div></div>
            <div class="record-badge-progress-label">${progress.current} of ${progress.total}</div>`;
        }
      }

      return `
        <div class="record-badge-card ${achieved ? 'achieved' : 'locked'}" style="--badge-hue-color:${hue};" onclick="selectRecordBadge(${badge.id})" title="${safeTitle}">
          ${cornerHtml}
          <div class="record-badge-icon-circle">
            <span class="record-badge-icon">${achieved ? renderRecordIconHtml(badge.icon) : RECORD_BADGE_LOCK_SVG}</span>
          </div>
          <div class="record-badge-title">${badge.title}</div>
          ${progressHtml}
        </div>`;
    }

    export function renderRecordBadgesGrid() {
      const grid = document.getElementById('record-badges-grid');
      if (!grid) return;
      if (recordBadgesList.length === 0) {
        grid.innerHTML = `<div style="text-align:center; color:var(--text-muted); font-size:13px; font-family:'Plus Jakarta Sans', sans-serif; padding:20px;">No records badges yet.</div>`;
        return;
      }

      const sections = getGroupedRecordBadgeSections();
      recordBadgeSectionsCache = sections; // selectRecordBadge uses this to find which section's slot to fill
      grid.innerHTML = sections.map(({ sectionName, items }, sectionIndex) => {
        const itemsHtml = items.map(item => {
          if (item.type === 'set') {
            const setCards = item.badges.map(renderRecordBadgeCard).join('');
            return `
              <div class="record-badge-set">
                ${item.label ? `<div class="record-badge-set-label">${item.label}</div>` : ''}
                <div class="record-badge-set-row">${setCards}</div>
              </div>`;
          }
          return renderRecordBadgeCard(item.badge);
        }).join('');
        return `
          <div class="record-section">
            <div class="record-section-header">${(sectionName || '').replace(/</g, '&lt;')}</div>
            <div class="record-grid">${itemsHtml}</div>
            <div class="record-section-detail" id="record-section-detail-${sectionIndex}" style="display:none;"></div>
          </div>`;
      }).join('');
    }

    // Populated by renderRecordBadgesGrid — which section (by index into that
    // render's sections array) each badge belongs to, so selectRecordBadge can
    // drop the tapped badge's description into that section's own slot rather
    // than a single panel shared by the whole page.
    export let recordBadgeSectionsCache = [];

    export function selectRecordBadge(badgeId) {
      const badge = recordBadgesList.find(b => b.id === badgeId);
      if (!badge) return;
      const rec = userRecordsMap[badgeId];
      const achieved = !!rec;

      let statusLine;
      if (!achieved) {
        const howTo = describeRecordTrigger(badge);
        statusLine = `<div style="color:var(--text-muted); font-size:13px;">Not yet achieved.${howTo ? ' ' + howTo : ''}</div>`;
      } else if (badge.tallied) {
        statusLine = `<div style="color:var(--accent-teal); font-size:13px; font-weight:700;">Achieved ${rec.count} time${rec.count === 1 ? '' : 's'}.</div>`;
      } else {
        statusLine = `<div style="color:var(--accent-teal); font-size:13px; font-weight:700;">Achieved!</div>`;
      }

      // Find which section this badge belongs to (from the last render) so its
      // description/status appears right under THAT section, not at the
      // bottom of the whole Records view — and close any other section's
      // open description while we're at it, so only one shows at a time.
      const sectionIndex = recordBadgeSectionsCache.findIndex(s =>
        s.items.some(item => item.type === 'set' ? item.badges.some(b => b.id === badgeId) : item.badge.id === badgeId));
      document.querySelectorAll('.record-section-detail').forEach(el => {
        if (el.id !== `record-section-detail-${sectionIndex}`) { el.style.display = 'none'; el.innerHTML = ''; }
      });
      if (sectionIndex === -1) return;

      const panel = document.getElementById(`record-section-detail-${sectionIndex}`);
      if (!panel) return;
      panel.style.display = 'block';
      panel.innerHTML = `
        <div class="book-admin-item-card" style="background:var(--card-bg);">
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
            <span style="font-size:28px; line-height:1;">${renderRecordIconHtml(badge.icon)}</span>
            <div style="font-family: var(--font-heading); font-size:22px; color:var(--text-main);">${badge.title}</div>
          </div>
          <div style="font-size:14px; color:var(--text-main); margin-bottom:8px;">${badge.description || ''}</div>
          ${statusLine}
        </div>`;
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    export function toggleRecordAdminForm() {
      const form = document.getElementById('record-admin-form');
      if (!form) return;
      const opening = form.style.display === 'none';
      form.style.display = opening ? 'block' : 'none';
      if (opening) {
        populateRecordAdminEditSelect();
        populateRecordAdminSectionList();
        populateRecordAdminGroupList();
        populateRecordAdminIconPicker();
        resetRecordAdminForm();
      }
    }

    export function resetRecordAdminForm() {
      document.getElementById('record-admin-edit-select').value = '';
      document.getElementById('record-admin-title').value = '';
      document.getElementById('record-admin-section').value = '';
      document.getElementById('record-admin-group').value = '';
      document.getElementById('record-admin-icon').value = '';
      const iconPicker = document.getElementById('record-admin-icon-picker');
      if (iconPicker) iconPicker.value = '';
      updateRecordAdminIconPreview();
      document.getElementById('record-admin-description').value = '';
      document.getElementById('record-admin-tallied').checked = false;
      document.getElementById('record-admin-trigger-type').value = '';
      document.getElementById('record-admin-threshold').value = '';
      handleRecordAdminTriggerTypeChange();
      updateRecordAdminBadgePreview();
    }

    export function populateRecordAdminEditSelect() {
      const select = document.getElementById('record-admin-edit-select');
      select.innerHTML = '<option value="">— New Badge —</option>' +
        recordBadgesList.map(b => `<option value="${b.id}">${(b.title || '').replace(/</g, '&lt;')}</option>`).join('');
    }

    // Datalist of sections already in use, so admins reuse existing section names
    // instead of accidentally creating near-duplicates ("Reading Plans" vs "reading plan").
    export function populateRecordAdminSectionList() {
      const list = document.getElementById('record-admin-section-list');
      if (!list) return;
      const uniqueSections = [...new Set(recordBadgesList.map(b => (b.section || '').trim()).filter(Boolean))].sort();
      list.innerHTML = uniqueSections.map(s => `<option value="${s.replace(/"/g, '&quot;')}"></option>`).join('');
    }

    // Same idea for group names, so admins re-use "Margin Notes" instead of
    // spinning up "margin notes" as an accidental second group.
    export function populateRecordAdminGroupList() {
      const list = document.getElementById('record-admin-group-list');
      if (!list) return;
      const uniqueGroups = [...new Set(recordBadgesList.map(b => (b.group_name || '').trim()).filter(Boolean))].sort();
      list.innerHTML = uniqueGroups.map(g => `<option value="${g.replace(/"/g, '&quot;')}"></option>`).join('');
    }

    export async function handleRecordAdminEditSelectChange() {
      const idVal = document.getElementById('record-admin-edit-select').value;
      if (!idVal) { resetRecordAdminForm(); return; }

      const badge = recordBadgesList.find(b => String(b.id) === idVal);
      if (!badge) return;

      document.getElementById('record-admin-title').value = badge.title || '';
      document.getElementById('record-admin-section').value = badge.section || '';
      document.getElementById('record-admin-group').value = badge.group_name || '';
      document.getElementById('record-admin-icon').value = badge.icon || '';
      updateRecordAdminIconPreview();
      document.getElementById('record-admin-description').value = badge.description || '';
      document.getElementById('record-admin-tallied').checked = !!badge.tallied;
      document.getElementById('record-admin-trigger-type').value = badge.trigger_type || '';

      await handleRecordAdminTriggerTypeChange();
      updateRecordAdminBadgePreview();

      const cfg = badge.trigger_config || {};
      if (badge.trigger_type === 'margin_notes_count') {
        document.getElementById('record-admin-threshold').value = cfg.threshold || '';
      } else if (badge.trigger_type === 'reading_plan_completed') {
        document.getElementById('record-admin-schedule').value = cfg.schedule_name || '';
      } else if (badge.trigger_type === 'book_resources_clicked') {
        document.getElementById('record-admin-book').value = cfg.book || '';
      } else if (badge.trigger_type === 'book_group_resources_clicked') {
        const checked = new Set(cfg.books || []);
        document.querySelectorAll('#record-admin-book-group-list input[type="checkbox"]').forEach(cb => {
          cb.checked = checked.has(cb.value);
        });
      } else if (badge.trigger_type === 'tw_module_completed') {
        document.getElementById('record-admin-tw-module').value = cfg.module_key || '';
      }
    }

    export async function loadScheduleNamesForBadgeForm() {
      const select = document.getElementById('record-admin-schedule');
      try {
        const { data, error } = await readingSchedulesTable.select('schedule_name');
        if (error) throw error;
        const uniqueNames = [...new Set((data || []).map(s => s.schedule_name))];
        select.innerHTML = uniqueNames.map(name => `<option value="${name}">${name}</option>`).join('');
      } catch (e) {
        console.error('Error loading reading plan names:', e.message);
        select.innerHTML = '';
      }
    }

    // Populates the TW Bible Course Module picker from whatever's currently
    // loaded in twBibleCourseData (built-in default or admin-saved) — same
    // "just read the live in-memory list" approach as populateRecordAdminBookFields.
    export function populateRecordAdminTWModuleField() {
      const select = document.getElementById('record-admin-tw-module');
      if (!select) return;
      select.innerHTML = twBibleCourseData.map(mod => `<option value="${mod.id}">${(mod.title || '').replace(/</g, '&lt;')}</option>`).join('');
    }

    export function populateRecordAdminBookFields() {
      const bookSelect = document.getElementById('record-admin-book');
      bookSelect.innerHTML = BIBLE_STUDIES_BOOK_ORDER.map(title => `<option value="${title}">${title}</option>`).join('');

      const groupList = document.getElementById('record-admin-book-group-list');
      groupList.innerHTML = BIBLE_STUDIES_BOOK_ORDER.map(title => `
        <label style="display:flex; align-items:center; gap:6px; font-size:13px; padding:3px 0; font-weight:normal;">
          <input type="checkbox" value="${title}" style="width:15px; height:15px; margin:0;"> ${title}
        </label>`).join('');
    }

    export async function handleRecordAdminTriggerTypeChange() {
      const type = document.getElementById('record-admin-trigger-type').value;
      document.getElementById('record-admin-threshold-field').style.display = (type === 'margin_notes_count') ? 'flex' : 'none';
      document.getElementById('record-admin-schedule-field').style.display = (type === 'reading_plan_completed') ? 'flex' : 'none';
      document.getElementById('record-admin-book-field').style.display = (type === 'book_resources_clicked') ? 'flex' : 'none';
      document.getElementById('record-admin-book-group-field').style.display = (type === 'book_group_resources_clicked') ? 'flex' : 'none';
      document.getElementById('record-admin-tw-module-field').style.display = (type === 'tw_module_completed') ? 'flex' : 'none';

      if (type === 'tw_module_completed') populateRecordAdminTWModuleField();
      if (type === 'reading_plan_completed') await loadScheduleNamesForBadgeForm();
      if (type === 'book_resources_clicked' || type === 'book_group_resources_clicked') populateRecordAdminBookFields();
    }

    export async function saveRecordBadge() {
      if (!currentUser || !currentUser.isAdmin) return;

      const editId = document.getElementById('record-admin-edit-select').value;
      const title = document.getElementById('record-admin-title').value.trim();
      const section = document.getElementById('record-admin-section').value.trim() || 'General';
      const groupName = document.getElementById('record-admin-group').value.trim() || null;
      const icon = document.getElementById('record-admin-icon').value.trim();
      const description = document.getElementById('record-admin-description').value.trim();
      const tallied = document.getElementById('record-admin-tallied').checked;
      const triggerType = document.getElementById('record-admin-trigger-type').value;

      if (!title) { alert('Give the badge a title.'); return; }

      let triggerConfig = {};
      if (triggerType === 'margin_notes_count') {
        const threshold = parseInt(document.getElementById('record-admin-threshold').value, 10);
        if (!threshold || threshold < 1) { alert('Enter how many margin notes are required.'); return; }
        triggerConfig = { threshold };
      } else if (triggerType === 'reading_plan_completed') {
        const scheduleName = document.getElementById('record-admin-schedule').value;
        if (!scheduleName) { alert('Choose which reading plan this badge is for.'); return; }
        triggerConfig = { schedule_name: scheduleName };
      } else if (triggerType === 'book_resources_clicked') {
        const book = document.getElementById('record-admin-book').value;
        if (!book) { alert('Choose which book this badge is for.'); return; }
        triggerConfig = { book };
      } else if (triggerType === 'book_group_resources_clicked') {
        const books = Array.from(document.querySelectorAll('#record-admin-book-group-list input[type="checkbox"]:checked')).map(cb => cb.value);
        if (books.length === 0) { alert('Check at least one book for this group.'); return; }
        triggerConfig = { books };
      } else if (triggerType === 'tw_module_completed') {
        const moduleKey = document.getElementById('record-admin-tw-module').value;
        if (!moduleKey) { alert('Choose which TW Bible Course module this badge is for.'); return; }
        triggerConfig = { module_key: moduleKey };
      }

      const payload = {
        title, section, group_name: groupName, icon, description, tallied,
        trigger_type: triggerType || null,
        trigger_config: triggerConfig
      };

      let error, data;
      if (editId) {
        ({ data, error } = await recordBadgesTable.update(
          editId,
          payload,
          'id, key, title, section, group_name, description, icon, tallied, trigger_type, trigger_config'
        ));
      } else {
        const key = title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || `badge_${Date.now()}`;
        ({ data, error } = await recordBadgesTable.insert(
          { ...payload, key },
          'id, key, title, section, group_name, description, icon, tallied, trigger_type, trigger_config'
        ));
      }

      if (error) {
        console.error('Error saving record badge:', error.message);
        alert('Could not save badge: ' + error.message);
        return;
      }

      const idx = recordBadgesList.findIndex(b => b.id === data.id);
      if (idx !== -1) recordBadgesList[idx] = data;
      else recordBadgesList.push(data);

      document.getElementById('record-admin-form').style.display = 'none';
      renderRecordBadgesGrid();
      alert(`"${title}" badge saved.`);
    }

    export async function openRecordsView() {
      if (!ensureLoggedInFor('Sign in to see your badges and records.', () => openRecordsView())) return;
      document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
      setHeaderIconSelected('records-header-btn');
      const notifPanel = document.getElementById('reading-notification-panel');
      if (notifPanel) notifPanel.style.display = 'none';

      document.getElementById('records-view').classList.add('active');

      const adminEntry = document.getElementById('record-admin-entry');
      if (adminEntry) adminEntry.style.display = (currentUser && currentUser.isAdmin) ? 'block' : 'none';
      document.getElementById('record-admin-form').style.display = 'none';

      await Promise.all([loadRecordBadges(), loadUserRecords()]);
      renderRecordBadgesGrid();
      markRecordBadgesSeen(); // clears the header bubble now that the user's looking at them
    }

    export function closeRecordsView() {
      switchTab(lastMainTabId);
    }

// ----------------------------------------------------------------------------
// Test utilities only — used by tests/ (see tests/testExports.js), never
// exported into the shipped build. Same reasoning as
// shared/twBibleCourse.js's own test-utilities section, below its last real
// function: recordBadgesList/userRecordsMap are ordinary imported bindings
// from any other file's point of view, so setting them for a test has to go
// through a real setter in the module that actually owns them.
//
// __getUserRecordsMapForTest matters for a subtler reason than the setter:
// clearUserRecordsMap() (the real function this whole test-utility section
// exists to help verify) REASSIGNS userRecordsMap to a brand-new {}, rather
// than mutating the existing one's contents. build.js's window-flattening
// step copies each export's value onto `window` once, at bundle-eval time —
// a later reassignment like that one never updates the already-copied
// window.userRecordsMap, so reading it after calling clearUserRecordsMap()
// would silently show the stale pre-test object instead of the real,
// now-cleared one.
// ----------------------------------------------------------------------------
export function __setRecordBadgesListForTest(list) { recordBadgesList = list; }
export function __setUserRecordsMapForTest(map) { userRecordsMap = map; }
export function __getUserRecordsMapForTest() { return userRecordsMap; }
