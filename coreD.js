// ============================================================================
// shared/coreD.js — the Core-D study feature (internally "Foundations"):
// class/session data, category filters and search, the learner-facing list
// and detail panel (including the inline Knowledge Check flow), the shared
// markdown-like content renderer (bold/italic/underline/links/tables/bullet
// lists/scripture auto-linking), and the full admin form.
//
// The content renderer here (renderFoundationsContentHtml and its helpers)
// and the two media-chip icon constants are reused directly by TW Bible
// Course, not duplicated there — a real, pre-existing overlap between the
// two features. shared/twBibleCourse.js's import of these now points here
// instead of app.js, same as shared/videoPlayer.js's import of
// foundationsList below.
//
// Also reuses the study_presenters directory "By the Book" owns
// (loadStudyPresenters, upsertStudyPresenter, etc.) rather than keeping a
// separate copy — presenters are shared across every study feature.
//
// NOT included here, on purpose: openChurchResourceVideo stayed in app.js —
// it's Church Resources' own entry point into the shared video player, not
// something exclusive to Core-D, even though it sat right next to
// openFoundationsVideoPlayer in the original file.
//
// app.js in turn imports this module's own exports back (openFoundationsItem,
// foundationsList, etc.) — another genuine circular dependency, handled the
// same documented way as the others: every usage on both sides is inside a
// function body, never at module-load time.
// ============================================================================

import { createTableAccessor, fetchAllRows } from '../core/db.js';
import {
  applyContentFormat, handleContentPaste, handleTableUpload, insertTableAtCursor,
  makeAdminDragReorder, makeAdminQuizArrayController, renderAdminQuizEditorBlock
} from './adminUtils.js';
import {
  isDirectVideoUrl, toYouTubeEmbedUrl, toYouTubeMutedPreviewEmbedUrl, openFsvPlayer,
  formatSecondsToTimeInput, parseTimeToSeconds
} from './videoPlayer.js';
import {
  loadStudyPresenters, populateStudyPresenterDropdowns,
  seedStudyPresentersFromExistingBooksIfEmpty, upsertStudyPresenter, studyPresentersList
} from './byTheBook.js';
import {
  escapeHtml, fixMojibakeText, currentUser, loadChapterByReference,
  shareFoundationsClass, shareFoundationsSession, switchStudySubTab, switchTab,
  updateStudyNotificationBadges, BIBLE_STUDIES_BOOK_ORDER
} from '../app.js';

    export function openFoundationsVideoPlayer(classId, sessionIdx, startVIdx) {
      const item = foundationsList.find(i => i.dbId === classId);
      if (!item) return;
      const session = (item.sessions || [])[sessionIdx];
      if (!session) return;
      const videos = (session.video || []).filter(v => v.url);
      const sessionTitle = session.title || `Session ${sessionIdx + 1}`;
      openFsvPlayer(videos, startVIdx, `${item.title} • ${sessionTitle}`, { type: 'foundations_session', classId, sessionIndex: sessionIdx });
    }
    // --- FOUNDATIONS (Study tab sub-option): admin-editable list of classes,
    // each with a title, one presenter (drawn from the same study_presenters
    // directory "By the Book" uses), a category, a thumbnail, and one or more
    // sessions — each session can carry any number of audio links, any number
    // of video links, and a "Session Resources" list of extra print links.
    // Mirrors the bible_study_books admin pattern: one flat Supabase table,
    // RLS left open, admin-only editing enforced client-side via
    // currentUser.isAdmin (same convention used throughout).
    export let foundationsList = []; // [{ dbId, title, presenter, presenterPhotoUrl, category, thumbnailUrl, isNew, live, sortOrder, sessions }]
    export const foundationsContentTable = createTableAccessor('foundations_content');
    // sessions: [{ title, audio: [{label,url}], video: [{label,url}], resources: [{ label, url }] }]
    export let foundationsCategoryFilter = 'All';
    export let foundationsSearchTerm = '';
    export let activeFoundationsItemId = null;
    export let openFoundationsSessionIndex = null; // accordion: index of the one expanded session within the open class, or null
    // Nested accordion: which of the open session's individual audio/video items
    // are expanded (players hidden until clicked). Keyed "type:itemIdx" (e.g.
    // "video:0"), so more than one item can be open at once independently.
    // Cleared whenever the open session changes so media always starts
    // collapsed again — see toggleFoundationsSession/openFoundationsItem.
    export let foundationsOpenMediaKeys = new Set();

    // Normalizes a session's stored audio/video field into today's shape —
    // an array of { label, url }. Accepts three inputs so older data (from
    // before multiple files per session was supported) keeps working with no
    // migration needed: the original single-URL string, a bare array of URL
    // strings, or the current array of { label, url } objects.
    export function normalizeFoundationsMediaList(value) {
      if (Array.isArray(value)) {
        return value
          .map(v => (typeof v === 'string' ? { label: '', url: v } : { label: v.label || '', url: v.url || '', startSeconds: parseInt(v.startSeconds, 10) || 0, quiz: normalizeFoundationsQuiz(v.quiz) }))
          .filter(v => v.url);
      }
      if (typeof value === 'string' && value.trim()) return [{ label: '', url: value.trim() }];
      return [];
    }

    // A Knowledge Check needs a real question and at least 2 non-empty options
    // to be worth showing — anything short of that (including no quiz at all)
    // just quietly renders as null, so a half-filled-out quiz never breaks the
    // video-end overlay.
    export function normalizeFoundationsQuiz(quiz) {
      if (!quiz || typeof quiz !== 'object') return null;
      const question = fixMojibakeText((quiz.question || '').trim());
      const options = (Array.isArray(quiz.options) ? quiz.options : []).map(o => fixMojibakeText((o || '').trim()));
      if (!question || options.filter(Boolean).length < 2) return null;
      const correctIndex = Number.isInteger(quiz.correctIndex) && quiz.correctIndex >= 0 && quiz.correctIndex < options.length ? quiz.correctIndex : 0;
      return { question, options, correctIndex, explanation: fixMojibakeText((quiz.explanation || '').trim()) };
    }

    export async function loadFoundationsContent() {
      try {
        const rows = await fetchAllRows(
          'foundations_content',
          'id, title, presenter, presenter_photo_url, category, thumbnail_url, is_new, live, sort_order, sessions, suggested_ids, hero_session_index, hero_video_index',
          null,
          'sort_order'
        );
        foundationsList = rows.map(r => ({
          dbId: r.id,
          title: fixMojibakeText(r.title || ''),
          presenter: fixMojibakeText(r.presenter || ''),
          presenterPhotoUrl: r.presenter_photo_url || '',
          category: fixMojibakeText(r.category || 'General'),
          thumbnailUrl: r.thumbnail_url || '',
          isNew: !!r.is_new,
          live: r.live !== false,
          sortOrder: r.sort_order || 0,
          // An admin's explicit pick for the hero "Play" button — null/undefined
          // means "Auto" (see getFoundationsHeroVideo), same as a class created
          // before this column existed.
          heroSessionIndex: Number.isInteger(r.hero_session_index) ? r.hero_session_index : null,
          heroVideoIndex: Number.isInteger(r.hero_video_index) ? r.hero_video_index : null,
          sessions: Array.isArray(r.sessions) ? r.sessions.map(s => ({
            title: fixMojibakeText(s.title || ''),
            content: fixMojibakeText(s.content || ''),
            audio: normalizeFoundationsMediaList(s.audio),
            video: normalizeFoundationsMediaList(s.video),
            // Optional per-session presenter override — same shape as the book's
            // per-session override (see bookAdminSessionsState/s.presenter above).
            // Falls back to the class's own presenter (rendered in the class
            // header) whenever a session doesn't name one of its own.
            presenter: (s.presenter && s.presenter.name) ? { name: fixMojibakeText(s.presenter.name || ''), photo: s.presenter.photo || '' } : null,
            resources: Array.isArray(s.resources) ? s.resources.map(res => ({ label: fixMojibakeText(res.label || ''), url: res.url || '' })) : [],
            // Session-level Knowledge Check(s) — addable to ANY session
            // regardless of whether it has video, same as a TW Bible Course
            // lesson (reuses the same normalizer/shape). Purely informational
            // here though — nothing in Core-D locks on answering correctly.
            quizzes: normalizeTWLessonQuizzes(s.quizzes)
          })) : [],
          suggestedIds: Array.isArray(r.suggested_ids) ? r.suggested_ids.map(id => parseInt(id, 10)) : []
        }));
      } catch (e) {
        // Table may not exist yet (before the SQL migration is run) — Foundations
        // just shows empty until then.
        console.error('Error loading Foundations content:', e.message);
        foundationsList = [];
      }
    }

    export function getLiveFoundationsItems() {
      return foundationsList.filter(item => item.live).sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
    }

    export function getFoundationsCategories() {
      const cats = new Set();
      getLiveFoundationsItems().forEach(item => cats.add(item.category || 'General'));
      return ['All', ...Array.from(cats).sort((a, b) => a.localeCompare(b))];
    }

    // Entry point when the Foundations sub-tab is opened: resets the transient
    // filter/search UI state and (re)renders the pills + list from whatever
    // Foundations content is already loaded (loaded up-front at app startup,
    // same as Bible Studies, so this never has to lazy-fetch on first click).
    export function renderFoundationsTab() {
      const adminBtn = document.getElementById('foundations-admin-entry-btn');
      if (adminBtn) adminBtn.style.display = (currentUser && currentUser.isAdmin) ? 'inline-block' : 'none';

      closeFoundationsItem();
      renderFoundationsPills();
      renderFoundationsList();
    }

    export function renderFoundationsPills() {
      const row = document.getElementById('foundations-pills-row');
      if (!row) return;
      const categories = getFoundationsCategories();
      if (!categories.includes(foundationsCategoryFilter)) foundationsCategoryFilter = 'All';
      row.innerHTML = categories.map(cat => `
        <button class="foundations-pill${cat === foundationsCategoryFilter ? ' active' : ''}" onclick="selectFoundationsCategory('${cat.replace(/'/g, "\\'")}')">${cat}</button>
      `).join('');
    }

    export function selectFoundationsCategory(cat) {
      foundationsCategoryFilter = cat;
      renderFoundationsPills();
      renderFoundationsList();
    }

    // The search box is always visible now (no more "Filters" toggle to reveal
    // it) — this just jumps focus into it when the header search icon is
    // clicked, a shortcut rather than something that shows/hides anything.
    export function focusFoundationsSearch() {
      document.getElementById('foundations-search-input')?.focus();
    }

    export function clearFoundationsFilters() {
      foundationsCategoryFilter = 'All';
      foundationsSearchTerm = '';
      const searchInput = document.getElementById('foundations-search-input');
      if (searchInput) searchInput.value = '';
      renderFoundationsPills();
      renderFoundationsList();
    }

    // Deterministic per-category color for a Core-D class's fallback thumbnail —
    // its own dedicated hash (rather than reusing cordAvatarColor's 6-color avatar
    // palette) because an admin can create any number of categories, and picking
    // from only 6 fixed colors means two unrelated categories collide as soon as
    // there are more than a handful of them. Hashing straight into a hue instead
    // gives 360 possible colors, virtually eliminating that collision.
    //
    // The hash itself is FNV-1a followed by a Murmur3-style bit-mixing finalizer:
    // FNV-1a alone changes fairly smoothly as characters are added, so short,
    // similarly-shaped category names (e.g. two-or-three-word phrases sharing a
    // common word) tend to land within the same narrow slice of the hue wheel —
    // exactly the clustering that made several categories all show up purple.
    // The finalizer's bit-shuffling avalanches small input differences across the
    // whole hash so categories seeded closely in string-space still land on hues
    // spread across the wheel.
    export function foundationsCategoryHash(str) {
      let h = 0x811c9dc5;
      for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
      }
      h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
      h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
      h ^= h >>> 16;
      return h >>> 0;
    }
    // A fixed, curated set of hues (rather than picking any of the 360 possible
    // hues by raw hash) so any two DIFFERENT categories are always comfortably
    // tellable apart, while staying visually "on brand" with the app's own
    // signature indigo-to-purple gradient (#6366f1 -> #a855f7, hues ~239-272)
    // instead of a full rainbow that would clash with it. Two families:
    //  - a "cool" arc (teal -> cyan -> blue -> indigo -> violet -> purple ->
    //    magenta -> rose), which runs right through and around the app's own
    //    gradient hues, so most categories read as part of the same palette
    //    as the rest of the UI;
    //  - a small "warm" accent group (gold/amber), the classic complementary
    //    pairing for indigo/purple, reserved for a few categories that need
    //    to visually pop against the cool majority.
    // Each family is evenly spaced internally (14deg / 12deg apart) and the
    // two families sit far apart on the wheel from each other, so there's
    // no risk of a cool color and a warm color being mistaken for one another.
    export const FOUNDATIONS_CATEGORY_PALETTE = (function () {
      const coolHues = [170, 184, 198, 212, 226, 240, 254, 268, 282, 296, 310, 324, 338];
      const warmHues = [26, 38, 50];
      const colors = [];
      coolHues.forEach(hue => colors.push(`hsl(${hue}, 68%, 37%)`));
      warmHues.forEach(hue => colors.push(`hsl(${hue}, 68%, 37%)`));
      return colors;
    })();
    export function foundationsCategoryColor(category) {
      const idx = foundationsCategoryHash(String(category || 'General')) % FOUNDATIONS_CATEGORY_PALETTE.length;
      return FOUNDATIONS_CATEGORY_PALETTE[idx];
    }

    export function foundationsCardThumbHtml(item) {
      if (item.thumbnailUrl) {
        return `<img class="foundations-card-thumb" src="${item.thumbnailUrl.replace(/"/g, '&quot;')}" alt="">`;
      }
      const initial = (item.title || '?').trim().charAt(0).toUpperCase() || '?';
      // Colored by category (not by the individual class) so every class sharing a
      // category shows the same color — a class's own title never factors in, which
      // is what makes the color a category cue rather than a per-class one.
      return `<div class="foundations-card-thumb-fallback" style="background:${foundationsCategoryColor(item.category)};">${initial}</div>`;
    }

    // Netflix-style browse card: wide 16:9 thumbnail, hover play hint, minimal
    // title/meta below. Used for both the category "shelves" and the flat
    // filtered/search grid — see renderFoundationsList.
    export function foundationsNxThumbHtml(item) {
      if (item.thumbnailUrl) {
        return `<img class="foundations-nx-thumb" src="${item.thumbnailUrl.replace(/"/g, '&quot;')}" alt="">`;
      }
      const initial = (item.title || '?').trim().charAt(0).toUpperCase() || '?';
      return `<div class="foundations-nx-thumb-fallback" style="background:${foundationsCategoryColor(item.category)};">${initial}</div>`;
    }

    export function foundationsNxCardHtml(item) {
      const safeTitle = (item.title || '').replace(/</g, '&lt;');
      const heroVideo = getFoundationsHeroVideo(item);
      const heroPreviewEmbedUrl = heroVideo
        ? toYouTubeMutedPreviewEmbedUrl((item.sessions[heroVideo.sessionIdx].video || [])[heroVideo.videoIdx].url)
        : null;
      return `
        <div class="foundations-nx-card" onclick="openFoundationsItem(${item.dbId})">
          <div class="foundations-nx-thumb-wrap">
            ${foundationsNxThumbHtml(item)}
            ${heroPreviewEmbedUrl ? `<div class="foundations-nx-video-bg"><iframe src="${heroPreviewEmbedUrl}" allow="autoplay; encrypted-media" loading="lazy" tabindex="-1"></iframe></div>` : ''}
            ${item.isNew ? '<span class="foundations-nx-new-badge">New</span>' : ''}
            <button class="foundations-nx-share-btn" title="Share this class" onclick="event.stopPropagation(); shareFoundationsClass(${item.dbId}, '${(item.title || '').replace(/'/g, "\\'")}')">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
            </button>
          </div>
          <div class="foundations-nx-info">
            <div class="foundations-nx-title">${safeTitle}</div>
            <div class="foundations-nx-meta">${item.presenter ? `With ${item.presenter}` : (item.category || 'General')}</div>
          </div>
        </div>`;
    }

    // Scrolls a shelf roughly one screenful in the given direction (-1 left,
    // 1 right) — walks up to the button's own row, then finds that row's
    // scroll container as a sibling, so no per-row ids are needed.
    export function scrollFoundationsRow(btn, direction) {
      const row = btn.closest('.foundations-row');
      const scroller = row && row.querySelector('.foundations-hscroll');
      if (!scroller) return;
      scroller.scrollBy({ left: direction * scroller.clientWidth * 0.9, behavior: 'smooth' });
    }

    export function renderFoundationsList() {
      const listEl = document.getElementById('foundations-list');
      if (!listEl) return;

      foundationsSearchTerm = (document.getElementById('foundations-search-input')?.value || '').trim().toLowerCase();
      const clearBtn = document.getElementById('foundations-clear-filters-btn');
      const hasActiveFilters = foundationsCategoryFilter !== 'All' || foundationsSearchTerm !== '';
      if (clearBtn) clearBtn.classList.toggle('visible', hasActiveFilters);

      let items = getLiveFoundationsItems();
      if (foundationsCategoryFilter !== 'All') {
        items = items.filter(item => (item.category || 'General') === foundationsCategoryFilter);
      }
      if (foundationsSearchTerm) {
        items = items.filter(item =>
          item.title.toLowerCase().includes(foundationsSearchTerm) ||
          item.presenter.toLowerCase().includes(foundationsSearchTerm)
        );
      }

      if (items.length === 0) {
        listEl.innerHTML = `<div class="foundations-empty">No classes found${hasActiveFilters ? ' matching your filters.' : ' yet — check back soon.'}</div>`;
        return;
      }

      // No active filter: browse as horizontally-scrolling shelves grouped by
      // category, Netflix-style. A category pick or search narrows things
      // down to one flat wrapping grid instead — shelves don't make sense
      // once everything shown already matches one thing.
      if (!hasActiveFilters) {
        const byCategory = {};
        items.forEach(item => {
          const cat = item.category || 'General';
          (byCategory[cat] = byCategory[cat] || []).push(item);
        });
        const categoryNames = Object.keys(byCategory).sort((a, b) => a.localeCompare(b));
        listEl.innerHTML = `<div class="foundations-rows">${categoryNames.map(cat => `
          <div class="foundations-row">
            <div class="foundations-row-header">
              <div class="foundations-row-title">${cat.replace(/</g, '&lt;')}</div>
              <div class="foundations-row-nav">
                <button type="button" class="foundations-row-nav-btn" onclick="scrollFoundationsRow(this, -1)" aria-label="Scroll left">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                </button>
                <button type="button" class="foundations-row-nav-btn" onclick="scrollFoundationsRow(this, 1)" aria-label="Scroll right">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </button>
              </div>
            </div>
            <div class="foundations-hscroll">${byCategory[cat].map(foundationsNxCardHtml).join('')}</div>
          </div>`).join('')}</div>`;
      } else {
        listEl.innerHTML = `<div class="foundations-grid">${items.map(foundationsNxCardHtml).join('')}</div>`;
      }
    }

    export function openFoundationsItem(dbId) {
      const item = foundationsList.find(i => i.dbId === dbId);
      if (!item) return;
      activeFoundationsItemId = dbId;
      openFoundationsSessionIndex = null; // sessions start collapsed each time a class is opened
      foundationsOpenMediaKeys.clear();

      const panel = document.getElementById('foundations-detail-panel');
      const listWrap = document.getElementById('foundations-list');
      if (!panel) return;

      // Must be visible BEFORE rendering — renderFoundationsDetailPanel measures
      // the hero video preview's box to size its iframe (sizeFoundationsHeroVideoBg),
      // which reads 0 for a display:none element.
      panel.style.display = 'block';
      renderFoundationsDetailPanel();
      if (listWrap) listWrap.style.display = 'none';
      document.getElementById('foundations-pills-row').style.display = 'none';
      document.querySelector('.foundations-filters-row').style.display = 'none';
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // The video that plays when a learner taps the hero "Play" button. An
    // admin's explicit pick (heroSessionIndex/heroVideoIndex) wins as long as
    // it still points at a real, embeddable video — a session or video could
    // have been removed/reordered since it was picked, so this always
    // re-validates rather than trusting the stored indices blindly. Falls
    // back to the first embeddable video in session order ("Auto"), and
    // returns null for an audio/text-only class either way.
    export function getFoundationsHeroVideo(item) {
      const sessions = item.sessions || [];
      if (item.heroSessionIndex != null && item.heroVideoIndex != null) {
        const picked = sessions[item.heroSessionIndex] && sessions[item.heroSessionIndex].video && sessions[item.heroSessionIndex].video[item.heroVideoIndex];
        if (picked && picked.url && (isDirectVideoUrl(picked.url) || toYouTubeEmbedUrl(picked.url))) {
          return { sessionIdx: item.heroSessionIndex, videoIdx: item.heroVideoIndex };
        }
      }
      for (let i = 0; i < sessions.length; i++) {
        const videos = (sessions[i].video || []).filter(v => v.url && (isDirectVideoUrl(v.url) || toYouTubeEmbedUrl(v.url)));
        if (videos.length > 0) return { sessionIdx: i, videoIdx: (sessions[i].video || []).indexOf(videos[0]) };
      }
      return null;
    }

    export function renderFoundationsDetailPanel() {
      const item = foundationsList.find(i => i.dbId === activeFoundationsItemId);
      const panel = document.getElementById('foundations-detail-panel');
      if (!item || !panel) return;

      const safeTitle = (item.title || '').replace(/'/g, "\\'");
      const sessions = item.sessions || [];
      const firstVideo = getFoundationsHeroVideo(item);

      const heroPresenterHtml = item.presenter ? `
        <div class="foundations-hero-presenter">
          ${item.presenterPhotoUrl ? `<img src="${item.presenterPhotoUrl.replace(/"/g, '&quot;')}" alt="${item.presenter.replace(/"/g, '&quot;')}">` : ''}
          <span>With ${item.presenter.replace(/</g, '&lt;')}</span>
        </div>` : '';

      const heroPlayBtnHtml = firstVideo ? `
        <button type="button" class="foundations-hero-play-btn" onclick="openFoundationsVideoPlayer(${item.dbId}, ${firstVideo.sessionIdx}, ${firstVideo.videoIdx})">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#15131d"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>
          Play
        </button>` : '';

      const heroPreviewEmbedUrl = firstVideo
        ? toYouTubeMutedPreviewEmbedUrl(sessions[firstVideo.sessionIdx].video[firstVideo.videoIdx].url)
        : null;

      const heroHtml = `
        <div class="foundations-hero">
          <div class="foundations-hero-bg${item.thumbnailUrl ? '' : ' no-image'}" style="background-image:${item.thumbnailUrl ? `url('${item.thumbnailUrl.replace(/'/g, "\\'")}')` : `linear-gradient(135deg, ${foundationsCategoryColor(item.category)} 0%, #15131d 130%)`};"></div>
          ${heroPreviewEmbedUrl ? `<div class="foundations-hero-video-bg"><iframe src="${heroPreviewEmbedUrl}" allow="autoplay; encrypted-media" tabindex="-1"></iframe></div>` : ''}
          <div class="foundations-hero-scrim"></div>
          <div class="foundations-hero-topbar">
            <button type="button" class="foundations-hero-round-btn" title="Back" onclick="closeFoundationsItem()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            <button type="button" class="foundations-hero-round-btn" title="Share this class" onclick="shareFoundationsClass(${item.dbId}, '${safeTitle}')">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
            </button>
          </div>
          <div class="foundations-hero-content">
            <span class="foundations-hero-category">${(item.category || 'General').replace(/</g, '&lt;')}</span>
            <h3 class="foundations-hero-title">${(item.title || '').replace(/</g, '&lt;')}</h3>
            ${heroPresenterHtml}
            <div class="foundations-hero-actions">${heroPlayBtnHtml}</div>
          </div>
        </div>`;

      const sessionsHtml = sessions.length === 0
        ? `<div style="color:var(--text-muted); font-size:13px;">No lessons added yet — check back soon.</div>`
        : sessions.map((s, idx) => foundationsSessionAccordionHtml(s, idx, item.dbId, item.title)).join('');

      panel.innerHTML = `
        ${heroHtml}
        <div class="foundations-lessons-heading">Lessons</div>
        <div class="foundations-sessions-list">${sessionsHtml}</div>
        ${foundationsSuggestionsHtml(item)}
      `;

      if (heroPreviewEmbedUrl) sizeFoundationsHeroVideoBg();
    }

    // Sizes the hero video preview's iframe to "cover" its box (crop to fill
    // edge-to-edge, cropping whichever dimension overflows) regardless of the
    // box's own aspect ratio — a plain width:100%/height:100% iframe would
    // instead letterbox wherever the video's native 16:9 doesn't match the
    // box. Oversized by 15% beyond the computed cover size on both axes so a
    // fractional rounding difference never leaves a sliver of the (opaque
    // black) iframe edge visible.
    export function sizeFoundationsHeroVideoBg() {
      const wrap = document.querySelector('.foundations-hero-video-bg');
      const iframe = wrap ? wrap.querySelector('iframe') : null;
      if (!wrap || !iframe) return;
      const w = wrap.clientWidth, h = wrap.clientHeight;
      if (!w || !h) return;
      const videoRatio = 16 / 9;
      let iw, ih;
      if (w / h > videoRatio) { iw = w; ih = iw / videoRatio; } else { ih = h; iw = ih * videoRatio; }
      iframe.style.width = `${Math.ceil(iw * 1.15)}px`;
      iframe.style.height = `${Math.ceil(ih * 1.15)}px`;
      iframe.style.transform = 'translate(-50%, -50%)';
    }
    // The hero video preview's own container resizes with the page (device
    // rotation, browser window resize) — keep it covering correctly rather
    // than only sizing it right once at render time. Harmless no-op via the
    // querySelector check above whenever no class detail page (or no hero
    // video) is currently showing.
    window.addEventListener('resize', () => sizeFoundationsHeroVideoBg());

    // Renders the "May We Suggest?" section at the bottom of a class's detail
    // view, from the up-to-3 ids an admin picked in Manage Content. Filters
    // out any id that's been deleted or made non-live since it was picked,
    // and disappears entirely if nothing valid is left — an admin doesn't
    // need to keep this list tidy for it to always render correctly.
    export function foundationsSuggestionsHtml(item) {
      const ids = Array.isArray(item.suggestedIds) ? item.suggestedIds : [];
      const suggested = ids
        .map(id => foundationsList.find(i => i.dbId === id && i.live))
        .filter(Boolean)
        .slice(0, 3);
      if (suggested.length === 0) return '';

      const cardsHtml = suggested.map(s => `
        <div class="foundations-suggestion-card" onclick="openFoundationsItem(${s.dbId})">
          <div class="foundations-card-thumb-wrap">${foundationsCardThumbHtml(s)}</div>
          <div class="foundations-card-info">
            <div class="foundations-card-title">${s.title}</div>
            ${s.presenter ? `<div class="foundations-card-presenter">With ${s.presenter}</div>` : ''}
            <div class="foundations-card-meta">Class • ${s.category || 'General'}</div>
          </div>
        </div>
      `).join('');

      return `
        <div class="foundations-suggestions-section">
          <div class="foundations-suggestions-heading">May We Suggest?</div>
          ${cardsHtml}
        </div>
      `;
    }

    // --- Session content rendering: lightweight inline markup + automatic
    // scripture-reference linking ---
    //
    // Session content is stored as plain text with simple inline tokens the
    // formatting toolbar inserts (see applyFoundationsFormat): **bold**,
    // *italic*, __underline__, and [link text](url). renderFoundationsContentHtml
    // turns that into real HTML in three passes, in this specific order:
    //   1. Escape any literal HTML the admin typed, so nothing they wrote can
    //      inject markup/scripts of its own.
    //   2. Parse the admin's own tokens into real <strong>/<em>/<u>/<a> tags.
    //   3. Auto-detect Bible references (e.g. "John 3:16") in whatever's left
    //      and wrap them in a bold link that jumps to that verse — skipping
    //      text already inside an <a>...</a> from step 2, so a reference the
    //      admin already linked by hand never ends up inside a second,
    //      invalid nested link.
    export function escapeFoundationsHtml(str) {
      return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    export function applyFoundationsMarkup(text) {
      let out = text;
      // Headings: a line starting with 1-4 "#" characters and a space becomes
      // a sub-heading — the only block-level token this content format
      // supports beyond plain paragraphs/bullets/tables. Done before the
      // inline passes below so **bold** etc. still work inside a heading line.
      out = out.replace(/^(#{1,4})[ \t]+(.+)$/gm, (m, hashes, content) => {
        const level = hashes.length;
        return `<div class="foundations-content-heading foundations-content-heading-${level}">${content}</div>`;
      });
      out = out.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
      out = out.replace(/\*([^*]+?)\*/g, '<em>$1</em>');
      out = out.replace(/__([^_]+?)__/g, '<u>$1</u>');
      out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
      return out;
    }

    // Built from the same canonical 66-book list "By the Book" uses, so a
    // detected reference always matches how verses are actually keyed
    // (BIBLE_STUDIES_BOOK_ORDER is defined earlier in this file, above; sorted
    // longest-name-first here purely defensively — book names never actually
    // collide at the same text position, since e.g. "1 John" can't also start
    // matching as "John" a character earlier).
    //
    // Computed lazily on first actual use, rather than eagerly at module load
    // (as a top-level IIFE previously did) — BIBLE_STUDIES_BOOK_ORDER is
    // imported from app.js, and this module is itself imported back by
    // app.js (a genuine circular dependency, same as elsewhere in this app).
    // Which of the two finishes initializing its top-level code first isn't
    // guaranteed, so a top-level IIFE referencing an imported binding
    // immediately can run before that binding is ready. Every other
    // cross-module reference in this app is already safely deferred inside a
    // function body for exactly this reason; this one just wasn't, until it
    // was actually exercised by an automated test that caught it.
    let _foundationsScriptureRegexCache = null;
    function getFoundationsScriptureRegex() {
      if (_foundationsScriptureRegexCache) return _foundationsScriptureRegexCache;
      const names = BIBLE_STUDIES_BOOK_ORDER
        .slice();
      // "Psalm" (singular) is accepted alongside the canonical "Psalms" when
      // citing a specific reference (e.g. "Psalm 23:1") — never as a bare
      // standalone word, since the pattern below always requires the
      // chapter:verse suffix regardless of which book name matched.
      names.push('Psalm');
      const escaped = names
        .sort((a, b) => b.length - a.length)
        .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      _foundationsScriptureRegexCache = new RegExp(`\\b(${escaped.join('|')})\\s+(\\d{1,3}):(\\d{1,3})(?:[-–]\\d{1,3})?\\b`, 'gi');
      return _foundationsScriptureRegexCache;
    }

    export function linkifyScriptureReferences(html) {
      // Split on existing <a>...</a> tags and only linkify the segments in
      // between, so a reference the admin already wrapped in their own link
      // doesn't get a second, nested anchor tag put around it.
      const parts = html.split(/(<a\b[^>]*>[\s\S]*?<\/a>)/i);
      return parts.map(part => {
        if (/^<a\b/i.test(part)) return part;
        return part.replace(getFoundationsScriptureRegex(), (match, bookMatch, chapter, verse) => {
          // "Psalm" isn't itself in BIBLE_STUDIES_BOOK_ORDER (only the
          // canonical plural "Psalms" is) — map it across so the link still
          // points at the real book verses are actually keyed under.
          const canonicalBook = BIBLE_STUDIES_BOOK_ORDER.find(b => b.toLowerCase() === bookMatch.toLowerCase())
            || (bookMatch.toLowerCase() === 'psalm' ? 'Psalms' : null);
          if (!canonicalBook) return match;
          const targetRef = `${canonicalBook} ${chapter}:${verse}`.replace(/'/g, "\\'");
          return `<strong><a href="javascript:void(0)" class="foundations-scripture-link" onclick="navigateToVerseReference('${targetRef}')">${match}</a></strong>`;
        });
      }).join('');
    }

    // Turns consecutive "- " lines (the format the Bulleted List toolbar
    // button inserts) into a real <ul><li> list. Runs after applyFoundationsMarkup
    // so a bullet line can still contain its own bold/italic/underline/link
    // markup — inline markup never introduces a newline, so line boundaries
    // are unaffected by having run it first. Non-list lines are left exactly
    // as they were, joined back with the same "\n" that .foundations-detail-body's
    // white-space:pre-wrap turns into a line break; a <ul> block already gets
    // its own line from being a block element, so the join skips adding an
    // extra blank "\n" line directly next to one.
    // Shared by every "turns some plain-text lines into one block-level HTML
    // element" pass below (bullet lists, tables) — a chunk matching this is
    // already a rendered block (its own line by nature), so the join logic
    // in each pass skips adding an extra "\n" (which .foundations-detail-body's
    // white-space:pre-wrap would render as a visible blank line) next to one.
    export const FOUNDATIONS_BLOCK_CHUNK_RE = /^<(ul\b|div class="foundations-content-table-wrap")/;

    export function convertFoundationsBulletLists(text) {
      const lines = text.split('\n');
      const blocks = [];
      let listBuffer = [];
      function flushList() {
        if (listBuffer.length) {
          blocks.push('<ul class="foundations-content-list">' + listBuffer.map(item => `<li>${item}</li>`).join('') + '</ul>');
          listBuffer = [];
        }
      }
      lines.forEach(line => {
        const m = /^-\s+(.*)$/.exec(line);
        if (m) { listBuffer.push(m[1]); }
        else { flushList(); blocks.push(line); }
      });
      flushList();
      let result = '';
      blocks.forEach((block, i) => {
        if (i > 0 && !FOUNDATIONS_BLOCK_CHUNK_RE.test(blocks[i - 1]) && !FOUNDATIONS_BLOCK_CHUNK_RE.test(block)) result += '\n';
        result += block;
      });
      return result;
    }

    // Splits one "| a | b |" row into its trimmed cell texts, tolerating a
    // missing leading/trailing pipe ("a | b" works the same as "| a | b |").
    export function foundationsSplitTableRow(line) {
      let t = line.trim();
      if (t.startsWith('|')) t = t.slice(1);
      if (t.endsWith('|')) t = t.slice(0, -1);
      // A "\|" is a literal pipe inside a cell (what foundationsRowsToMarkdownTable
      // writes for a cell that itself contains "|", e.g. from an uploaded/pasted
      // spreadsheet) rather than a column separator — split only on the rest.
      const cells = [];
      let current = '';
      for (let i = 0; i < t.length; i++) {
        if (t[i] === '\\' && t[i + 1] === '|') { current += '|'; i++; }
        else if (t[i] === '|') { cells.push(current); current = ''; }
        else current += t[i];
      }
      cells.push(current);
      return cells.map(cell => cell.trim());
    }
    // The required second row of a table — dashes (optionally colon-flanked
    // for alignment) per column, e.g. "| --- | :---: | ---: |". A header row
    // only turns into a table when this line immediately follows it; a bare
    // line with a "|" in it otherwise stays plain text.
    export const FOUNDATIONS_TABLE_SEPARATOR_RE = /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/;
    export function foundationsTableColumnAligns(sepLine) {
      return foundationsSplitTableRow(sepLine).map(cell => {
        if (cell.startsWith(':') && cell.endsWith(':')) return 'center';
        if (cell.endsWith(':')) return 'right';
        if (cell.startsWith(':')) return 'left';
        return '';
      });
    }

    // Turns a "| Header |" row + "| --- |" separator row + zero or more
    // "| cell |" body rows (the shape the Table toolbar button inserts) into
    // a real <table>, wrapped in a horizontally scrollable div so a table
    // wider than the screen scrolls in place instead of breaking the page's
    // own layout on a phone. Runs after applyFoundationsMarkup so a cell can
    // still carry its own bold/italic/underline/link markup.
    export function convertFoundationsTables(text) {
      const lines = text.split('\n');
      const blocks = [];
      let i = 0;
      while (i < lines.length) {
        const headerLine = lines[i];
        const sepLine = lines[i + 1];
        const looksLikeRow = headerLine && headerLine.includes('|') && headerLine.trim() !== '';
        if (looksLikeRow && sepLine != null && FOUNDATIONS_TABLE_SEPARATOR_RE.test(sepLine.trim())) {
          const headerCells = foundationsSplitTableRow(headerLine);
          const aligns = foundationsTableColumnAligns(sepLine);
          let j = i + 2;
          const bodyRows = [];
          while (j < lines.length && lines[j].includes('|') && lines[j].trim() !== '') {
            bodyRows.push(foundationsSplitTableRow(lines[j]));
            j++;
          }
          const alignAttr = colIdx => aligns[colIdx] ? ` style="text-align:${aligns[colIdx]};"` : '';
          const theadHtml = '<tr>' + headerCells.map((c, colIdx) => `<th${alignAttr(colIdx)}>${c}</th>`).join('') + '</tr>';
          const tbodyHtml = bodyRows.map(row => '<tr>' + row.map((c, colIdx) => `<td${alignAttr(colIdx)}>${c || ''}</td>`).join('') + '</tr>').join('');
          blocks.push(`<div class="foundations-content-table-wrap"><table class="foundations-content-table"><thead>${theadHtml}</thead><tbody>${tbodyHtml}</tbody></table></div>`);
          i = j;
        } else {
          blocks.push(headerLine);
          i++;
        }
      }
      let result = '';
      blocks.forEach((block, idx) => {
        if (idx > 0 && !FOUNDATIONS_BLOCK_CHUNK_RE.test(blocks[idx - 1]) && !FOUNDATIONS_BLOCK_CHUNK_RE.test(block)) result += '\n';
        result += block;
      });
      return result;
    }

    export function renderFoundationsContentHtml(raw) {
      const escaped = escapeFoundationsHtml(raw);
      const withMarkup = applyFoundationsMarkup(escaped);
      const withTables = convertFoundationsTables(withMarkup);
      const withLists = convertFoundationsBulletLists(withTables);
      return linkifyScriptureReferences(withLists);
    }

    // ------------------------------------------------------------------
    // Getting a table into session content: rather than expecting an admin
    // to hand-type the "| a | b |" / "| --- | --- |" markup itself, they can
    // paste a range copied from a spreadsheet (Excel/Google Sheets/Numbers
    // all put it on the clipboard as tab-separated text) or upload a CSV/TSV
    // file exported from one. Both paths end up as a 2D array of row arrays,
    // which this turns into that same underlying markdown-table text — so
    // convertFoundationsTables() above (already built, already tested) is
    // the one and only place that shape ever gets rendered.
    // ------------------------------------------------------------------


    // Inserts a table (as rows of cell text) into one session's content
    // textarea at the cursor — thin wrapper over the shared insertTableAtCursor
    // (see TW's use of it above), pointed at this screen's own textarea id
    // and admin-state update function.
    export function insertFoundationsTableAtCursor(idx, rows) {
      insertTableAtCursor(
        document.getElementById(`foundations-session-content-${idx}`),
        (value) => updateFoundationsAdminSessionField(idx, 'content', value),
        rows
      );
    }

    // Splits one line of delimited text into cells. Tab-delimited (what a
    // spreadsheet paste/export uses) has no quoting to worry about; comma-
    // delimited (a plain .csv) gets real CSV quote handling — "" inside a
    // quoted field is an escaped quote — so a field like "Smith, John" with
    // its comma quoted doesn't get split apart.
    export function foundationsSplitDelimitedLine(line, delimiter) {
      if (delimiter === '\t') return line.split('\t');
      const cells = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (inQuotes) {
          if (c === '"' && line[i + 1] === '"') { current += '"'; i++; }
          else if (c === '"') { inQuotes = false; }
          else current += c;
        } else if (c === '"') { inQuotes = true; }
        else if (c === delimiter) { cells.push(current); current = ''; }
        else current += c;
      }
      cells.push(current);
      return cells;
    }


    // Fires on every paste into a session's content textarea — thin wrapper
    // over the shared handleContentPaste (see TW's use of it above), pointed
    // at this screen's own textarea id and admin-state update function.
    export function handleFoundationsContentPaste(event, idx) {
      handleContentPaste(
        event,
        document.getElementById(`foundations-session-content-${idx}`),
        (value) => updateFoundationsAdminSessionField(idx, 'content', value)
      );
    }

    // Fires when an admin picks a file from the "Upload a table" button's
    // file input — thin wrapper over the shared handleTableUpload.
    export function handleFoundationsTableUpload(event, idx) {
      handleTableUpload(
        event,
        document.getElementById(`foundations-session-content-${idx}`),
        (value) => updateFoundationsAdminSessionField(idx, 'content', value)
      );
    }

    // Jumps to the Bible/Notes tab, loads the right chapter, and scrolls to +
    // highlights the specific verse row — the exact same mechanism a shared
    // verse link uses (see applyPendingShareTarget's 'ref' handling above),
    // reused here so a scripture reference clicked from Foundations content
    // lands in exactly the same place a shared-link recipient would.
    export async function navigateToVerseReference(ref) {
      if (!ref) return;
      const lastSpace = ref.lastIndexOf(' ');
      const chapterOnly = lastSpace !== -1
        ? ref.substring(0, lastSpace) + ' ' + ref.substring(lastSpace + 1).split(':')[0]
        : ref;

      switchTab('bible');
      await loadChapterByReference(chapterOnly);

      const matched = currentBibleVerses.find(v => v.reference === ref);
      if (matched) {
        setTimeout(() => {
          const el = document.getElementById(`verse-row-${matched.rowIndex}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('share-highlight');
            setTimeout(() => el.classList.remove('share-highlight'), 2000);
          }
        }, 300);
      }
    }

    export const FOUNDATIONS_VIDEO_ICON_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>';
    export const FOUNDATIONS_AUDIO_ICON_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path></svg>';

    // One collapsible audio/video row within an open session — collapsed to
    // start (see foundationsOpenMediaKeys), so the player/embed itself isn't
    // built into the DOM (and an iframe isn't loaded, an audio file isn't
    // fetched) until the admin/viewer actually clicks to expand that one item.
    export function foundationsMediaItemAccordionHtml(key, isItemOpen, iconSvg, label, playerHtml) {
      const safeKey = key.replace(/'/g, "\\'");
      return `
        <div class="foundations-media-item${isItemOpen ? ' open' : ''}">
          <button type="button" class="foundations-media-item-toggle" onclick="toggleFoundationsMediaItem('${safeKey}')">
            <span class="foundations-media-item-left">
              <span class="foundations-media-item-icon">${iconSvg}</span>
              <span class="foundations-media-item-label">${label.replace(/</g, '&lt;')}</span>
            </span>
            <svg class="foundations-media-item-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>
          ${isItemOpen ? `<div class="foundations-media-item-body">${playerHtml}</div>` : ''}
        </div>`;
    }

    export function foundationsSessionAccordionHtml(session, idx, classId, classTitle) {
      const isOpen = openFoundationsSessionIndex === idx;
      const title = session.title || `Session ${idx + 1}`;

      // Small icon chips on the session's collapsed header so a session that
      // has audio, video, and/or print resources is visibly flagged before
      // it's even opened, instead of that only being discoverable by expanding
      // it. Computed up front (not just when isOpen) since the header always
      // renders, open or closed.
      const hasVideoContent = (session.video || []).some(v => v.url);
      const hasAudioContent = (session.audio || []).some(a => a.url);
      const hasResourceContent = (session.resources || []).some(r => r.url);
      const mediaChips = [];
      if (hasVideoContent) mediaChips.push(`<span class="foundations-session-media-chip" title="Includes video">${FOUNDATIONS_VIDEO_ICON_SVG}</span>`);
      if (hasAudioContent) mediaChips.push(`<span class="foundations-session-media-chip" title="Includes audio">${FOUNDATIONS_AUDIO_ICON_SVG}</span>`);
      if (hasResourceContent) mediaChips.push(`<span class="foundations-session-media-chip" title="Includes resources"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg></span>`);
      const mediaChipsHtml = mediaChips.length ? `<span class="foundations-session-media-chips">${mediaChips.join('')}</span>` : '';

      let bodyHtml = '';
      if (isOpen) {
        // A session's own presenter, when set, overrides the class's presenter
        // (shown in the class header above) for just this session — e.g. a
        // guest teacher for one session of an otherwise single-presenter class.
        const sessionPresenterHtml = (session.presenter && session.presenter.name) ? `
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
            ${session.presenter.photo ? `<img src="${session.presenter.photo.replace(/"/g, '&quot;')}" alt="${session.presenter.name.replace(/"/g, '&quot;')}" style="width:26px; height:26px; border-radius:50%; object-fit:cover; border:1px solid var(--border-color); flex-shrink:0;">` : ''}
            <span style="font-size:12px; color:var(--text-muted);">Presented by ${session.presenter.name.replace(/</g, '&lt;')}</span>
          </div>` : '';

        const contentHtml = session.content ? `<div class="foundations-detail-body" style="margin-bottom:12px;">${renderFoundationsContentHtml(session.content)}</div>` : '';

        // Each session can carry any number of video links and any number of
        // audio links. They're listed above the written content (audio/video
        // is usually the main event, with any text underneath as supporting
        // notes), and each one is its own small accordion collapsed to start —
        // clicking a row expands just that item's player/embed, so a session
        // with several files doesn't load (or autoplay) all of them at once.
        // A per-item label shows when the admin gave it one; otherwise, a
        // plain "Video"/"Audio" (numbered when there's more than one) fallback
        // keeps every row's header always showing something a viewer can read
        // before deciding whether to expand it.
        let mediaHtml = '';
        const videos = (session.video || []).filter(v => v.url);
        const audios = (session.audio || []).filter(a => a.url);
        if (videos.length > 0 || audios.length > 0) {
          let mediaItemsHtml = '';
          // Videos are plain rows, not accordions — clicking one opens the
          // full-screen player (see openFoundationsVideoPlayer) directly,
          // starting on that video within this session's playlist. A link
          // that couldn't be turned into an embeddable YouTube URL just opens
          // externally instead, same as before.
          videos.forEach((v, vIdx) => {
            const label = v.label || (videos.length > 1 ? `Video ${vIdx + 1}` : 'Video');
            const embedUrl = isDirectVideoUrl(v.url) || toYouTubeEmbedUrl(v.url);
            const rowAction = embedUrl
              ? `onclick="openFoundationsVideoPlayer(${classId}, ${idx}, ${vIdx})"`
              : `onclick="window.open('${v.url.replace(/'/g, "\\'")}', '_blank', 'noopener')"`;
            mediaItemsHtml += `
              <button type="button" class="foundations-media-item foundations-video-row" ${rowAction}>
                <span class="foundations-media-item-left">
                  <span class="foundations-media-item-icon">${FOUNDATIONS_VIDEO_ICON_SVG}</span>
                  <span class="foundations-media-item-label">${label.replace(/</g, '&lt;')}</span>
                </span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--primary-color)"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>
              </button>`;
          });
          audios.forEach((a, aIdx) => {
            const key = `audio:${aIdx}`;
            const isItemOpen = foundationsOpenMediaKeys.has(key);
            const label = a.label || (audios.length > 1 ? `Audio ${aIdx + 1}` : 'Audio');
            const safeAudioTitle = `${classTitle} • ${title} — ${label}`.replace(/"/g, '&quot;');
            const playerHtml = `<audio controls preload="metadata" data-media-title="${safeAudioTitle}" src="${a.url.replace(/"/g, '&quot;')}" style="width:100%; height:40px;"></audio>`;
            mediaItemsHtml += foundationsMediaItemAccordionHtml(key, isItemOpen, FOUNDATIONS_AUDIO_ICON_SVG, label, playerHtml);
          });
          mediaHtml = `<div class="foundations-media-list" style="margin-bottom:12px;">${mediaItemsHtml}</div>`;
        }
        // Audio and video are both optional, same as content and resources — a
        // session with neither just shows whatever it does have, with no
        // "nothing added" placeholder implying something's missing.

        const resources = (session.resources || []).filter(r => r.url);
        const resourcesHtml = resources.length > 0 ? `
          <div style="margin-top:6px; margin-bottom:14px;">
            <div style="font-size:11.5px; font-weight:700; text-transform:uppercase; letter-spacing:0.4px; color:var(--text-muted); margin-bottom:6px;">Session Resources</div>
            <div style="display:flex; flex-direction:column; gap:6px;">
              ${resources.map(r => `
                <a href="${r.url.replace(/"/g, '&quot;')}" target="_blank" rel="noopener" style="display:flex; align-items:center; gap:8px; background: var(--bg-color); border:1px solid var(--border-color); padding:8px 12px; border-radius:8px; text-decoration:none; color:var(--text-main);">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                  <span style="font-weight:600; font-size:13px;">${(r.label || 'Resource').replace(/</g, '&lt;')}</span>
                </a>`).join('')}
            </div>
          </div>` : '';

        // A session-level Knowledge Check — same multi-question capability as
        // a TW Bible Course lesson, and just as able to be added to ANY
        // session regardless of its content: video, audio, text, or none at
        // all. A video session shows it in the full-screen player overlay
        // once the last video ends (see fsvForwardTrack); a session with no
        // video has no such trigger, so it renders inline here instead. This
        // is purely informational for Core-D (no lock/progression depends on
        // it, unlike TW) — any answer, right or wrong, can move on.
        let kcHtml = '';
        if (videos.length === 0 && session.quizzes && session.quizzes.length > 0) {
          kcHtml = renderFoundationsInlineKnowledgeCheck(classId, idx, session.quizzes);
        }

        bodyHtml = `<div class="foundations-session-body">${sessionPresenterHtml}${mediaHtml}${resourcesHtml}${contentHtml}${kcHtml}</div>`;
      }

      const safeClassTitle = (classTitle || '').replace(/'/g, "\\'");
      const safeSessionTitle = title.replace(/'/g, "\\'");
      return `
        <div class="foundations-session-item${isOpen ? ' open' : ''}">
          <div class="foundations-session-header">
            <button type="button" class="foundations-session-toggle" onclick="toggleFoundationsSession(${idx})">
              <span class="foundations-session-toggle-left">
                <span class="foundations-lesson-index">${idx + 1}</span>
                <span class="foundations-session-title">${title.replace(/</g, '&lt;')}</span>
                ${mediaChipsHtml}
              </span>
              <svg class="foundations-session-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
            <button type="button" class="share-btn" title="Share this session" style="flex-shrink:0;" onclick="shareFoundationsSession(${classId}, ${idx}, '${safeClassTitle}', '${safeSessionTitle}')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
            </button>
          </div>
          ${bodyHtml}
        </div>`;
    }

    // Accordion behavior: opening a session closes whichever one was open before it.
    export function toggleFoundationsSession(idx) {
      openFoundationsSessionIndex = (openFoundationsSessionIndex === idx) ? null : idx;
      foundationsOpenMediaKeys.clear(); // media items collapse again each time the open session changes
      // Reset any in-progress inline Knowledge Check for this session so
      // reopening it later always restarts at question 1.
      delete foundationsInlineKcIndex[`${activeFoundationsItemId}:${idx}`];
      renderFoundationsDetailPanel();
    }

    // Tracks which question a video-less Core-D session's inline Knowledge
    // Check is currently on, keyed by "classId:sessionIdx" — mirrors
    // twInlineKcIndex, just for Core-D. Reset on toggleFoundationsSession
    // (see there) so reopening a session always restarts at question 1.
    export let foundationsInlineKcIndex = {};

    // A Core-D Knowledge Check is purely informational — unlike a TW Bible
    // Course lesson, nothing here is locked behind answering correctly, so
    // any answer (right or wrong) shows feedback and a button to move on,
    // rather than forcing a retry the way the TW version does.
    export function renderFoundationsInlineKnowledgeCheck(classId, sessionIdx, quizzes) {
      const qIndex = foundationsInlineKcIndex[`${classId}:${sessionIdx}`] || 0;
      const quiz = quizzes[qIndex] || quizzes[0];
      const progressLabel = quizzes.length > 1 ? ` — Question ${qIndex + 1} of ${quizzes.length}` : '';
      return `
        <div class="tw-inline-kc" id="foundations-inline-kc-${sessionIdx}">
          <div class="tw-inline-kc-eyebrow">Knowledge Check${progressLabel}</div>
          <div class="tw-inline-kc-question">${escapeHtml(quiz.question)}</div>
          <div class="tw-inline-kc-options">
            ${quiz.options.map((opt, i) => `<button type="button" class="tw-inline-kc-option" onclick="answerFoundationsInlineKnowledgeCheck(${classId}, ${sessionIdx}, ${i})">${escapeHtml(opt)}</button>`).join('')}
          </div>
          <div class="tw-inline-kc-feedback" id="foundations-inline-kc-feedback-${sessionIdx}" style="display:none;"></div>
        </div>`;
    }

    export function answerFoundationsInlineKnowledgeCheck(classId, sessionIdx, selectedIndex) {
      const item = foundationsList.find(i => i.dbId === classId);
      const session = item && (item.sessions || [])[sessionIdx];
      if (!session || !session.quizzes || session.quizzes.length === 0) return;
      const key = `${classId}:${sessionIdx}`;
      const qIndex = foundationsInlineKcIndex[key] || 0;
      const quiz = session.quizzes[qIndex];
      if (!quiz) return;

      const wrap = document.getElementById(`foundations-inline-kc-${sessionIdx}`);
      if (!wrap || wrap.dataset.answered === '1') return; // ignore extra clicks after this question's already answered
      wrap.dataset.answered = '1';

      const correct = selectedIndex === quiz.correctIndex;
      wrap.querySelectorAll('.tw-inline-kc-option').forEach((btn, i) => {
        btn.classList.add('disabled');
        if (i === quiz.correctIndex) btn.classList.add('correct');
        else if (i === selectedIndex) btn.classList.add('incorrect');
      });

      const isLast = qIndex >= session.quizzes.length - 1;
      const fbEl = document.getElementById(`foundations-inline-kc-feedback-${sessionIdx}`);
      fbEl.style.display = 'block';
      fbEl.className = `tw-inline-kc-feedback ${correct ? 'correct' : 'incorrect'}`;
      fbEl.innerHTML = `<span class="tw-inline-kc-feedback-title">${correct ? 'Correct!' : 'Not quite.'}</span>${quiz.explanation ? escapeHtml(quiz.explanation) + ' ' : ''}`
        + `<button type="button" class="tw-inline-kc-next-btn" onclick="advanceFoundationsInlineKnowledgeCheck(${classId}, ${sessionIdx})">${isLast ? 'Done' : 'Next Question'}</button>`;
    }

    export function advanceFoundationsInlineKnowledgeCheck(classId, sessionIdx) {
      const key = `${classId}:${sessionIdx}`;
      const item = foundationsList.find(i => i.dbId === classId);
      const session = item && (item.sessions || [])[sessionIdx];
      const total = session && session.quizzes ? session.quizzes.length : 0;
      const qIndex = foundationsInlineKcIndex[key] || 0;
      if (qIndex >= total - 1) delete foundationsInlineKcIndex[key];
      else foundationsInlineKcIndex[key] = qIndex + 1;
      renderFoundationsDetailPanel();
    }

    // Toggles one audio/video item's own collapsed player within the currently
    // open session — independent of any other item, so e.g. a video and an
    // audio file can both be expanded (or not) at the same time.
    export function toggleFoundationsMediaItem(key) {
      if (foundationsOpenMediaKeys.has(key)) foundationsOpenMediaKeys.delete(key);
      else foundationsOpenMediaKeys.add(key);
      renderFoundationsDetailPanel();
    }

    export function closeFoundationsItem() {
      activeFoundationsItemId = null;
      openFoundationsSessionIndex = null;
      const panel = document.getElementById('foundations-detail-panel');
      const listWrap = document.getElementById('foundations-list');
      if (panel) panel.style.display = 'none';
      if (listWrap) listWrap.style.display = 'flex';
      const pillsRow = document.getElementById('foundations-pills-row');
      const filtersRow = document.querySelector('.foundations-filters-row');
      if (pillsRow) pillsRow.style.display = 'flex';
      if (filtersRow) filtersRow.style.display = 'flex';
    }

    // --- Foundations admin (Manage Content) ---

    export let foundationsAdminSessionsState = []; // [{ title, audio, video, resources: [{ label, url }] }]
    export let foundationsAdminSuggestedIds = []; // up to 3 other foundations_content ids to recommend, "May We Suggest?"
    // Which video plays when a learner taps the hero "Play" button — a
    // "sessionIdx:videoIdx" string into the CURRENT admin form state, or ''
    // for "Auto" (first embeddable video in session order, the old default
    // behavior). Kept as its own variable rather than read straight off the
    // <select> each time because it also needs to survive
    // populateFoundationsAdminHeroVideoSelect() re-rendering the dropdown's
    // options whenever a video row is added/removed elsewhere in the form.
    export let foundationsAdminHeroVideoValue = '';

    // Rebuilds the Hero Video dropdown from whatever video rows currently
    // exist in the form (so a freshly-added or freshly-removed video is
    // immediately reflected), then restores the previous pick if it's still
    // a valid option — or falls back to "Auto" if that exact video was just
    // removed.
    export function populateFoundationsAdminHeroVideoSelect() {
      const select = document.getElementById('foundations-admin-hero-video');
      if (!select) return;
      const options = ['<option value="">Auto — first video in the class</option>'];
      foundationsAdminSessionsState.forEach((s, sIdx) => {
        const sessionVideos = (s.video || []).filter(v => (v.url || '').trim());
        (s.video || []).forEach((v, vIdx) => {
          if (!(v.url || '').trim()) return;
          const sessionTitle = s.title || `Session ${sIdx + 1}`;
          const videoLabel = v.label || (sessionVideos.length > 1 ? `Video ${vIdx + 1}` : 'Video');
          options.push(`<option value="${sIdx}:${vIdx}">${`${sessionTitle} — ${videoLabel}`.replace(/</g, '&lt;')}</option>`);
        });
      });
      select.innerHTML = options.join('');
      const stillValid = Array.from(select.options).some(o => o.value === foundationsAdminHeroVideoValue);
      select.value = stillValid ? foundationsAdminHeroVideoValue : '';
      foundationsAdminHeroVideoValue = select.value;
    }

    export function updateFoundationsAdminHeroVideoValue(value) {
      foundationsAdminHeroVideoValue = value;
    }

    export async function openFoundationsAdminView() {
      if (!currentUser || !currentUser.isAdmin) return;

      document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
      const notifPanel = document.getElementById('reading-notification-panel');
      if (notifPanel) notifPanel.style.display = 'none';

      document.getElementById('foundations-admin-tab').classList.add('active');

      // Shares the same reusable presenter directory as "By the Book" — load/seed
      // it here too, since an admin may open Foundations without ever visiting
      // the Bible Studies "Manage Content" screen first.
      await loadStudyPresenters();
      await seedStudyPresentersFromExistingBooksIfEmpty();
      populateStudyPresenterDropdowns();

      const select = document.getElementById('foundations-admin-select');
      const sorted = foundationsList.slice().sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
      select.innerHTML = '<option value="">+ Add a new class…</option>' +
        sorted.map(item => `<option value="${item.dbId}">${item.title}</option>`).join('');

      const categoryList = document.getElementById('foundations-admin-category-list');
      if (categoryList) {
        categoryList.innerHTML = getFoundationsCategories().filter(c => c !== 'All').map(c => `<option value="${c}"></option>`).join('');
      }

      handleFoundationsAdminSelectChange();
    }

    export function closeFoundationsAdminView() {
      switchTab('study');
    }

    export function handleFoundationsAdminSelectChange() {
      const idVal = document.getElementById('foundations-admin-select').value;
      const formEl = document.getElementById('foundations-admin-form');
      const deleteBtn = document.getElementById('foundations-admin-delete-btn');
      formEl.style.display = 'block';

      const item = idVal ? foundationsList.find(i => String(i.dbId) === String(idVal)) : null;

      document.getElementById('foundations-admin-title').value = item ? item.title : '';
      document.getElementById('foundations-admin-presenter').value = item ? item.presenter : '';
      document.getElementById('foundations-admin-presenter-photo').value = item ? item.presenterPhotoUrl : '';
      document.getElementById('foundations-admin-category').value = item ? item.category : '';
      document.getElementById('foundations-admin-thumbnail').value = item ? item.thumbnailUrl : '';
      document.getElementById('foundations-admin-sort-order').value = item ? item.sortOrder : (foundationsList.length ? Math.max(...foundationsList.map(i => i.sortOrder)) + 1 : 0);
      document.getElementById('foundations-admin-is-new').checked = item ? item.isNew : true;
      document.getElementById('foundations-admin-live').checked = item ? item.live : true;

      foundationsAdminSessionsState = item ? (item.sessions || []).map(s => ({
        title: s.title || '',
        content: s.content || '',
        audio: (s.audio || []).map(a => ({ label: a.label || '', url: a.url || '' })),
        video: (s.video || []).map(v => ({
          label: v.label || '',
          url: v.url || '',
          startTime: formatSecondsToTimeInput(v.startSeconds),
          quiz: v.quiz ? {
            question: v.quiz.question || '',
            options: (v.quiz.options && v.quiz.options.length ? v.quiz.options.slice(0, 4) : ['', '', '', '']),
            correctIndex: v.quiz.correctIndex || 0,
            explanation: v.quiz.explanation || ''
          } : null
        })),
        presenterName: s.presenter ? (s.presenter.name || '') : '',
        presenterPhoto: s.presenter ? (s.presenter.photo || '') : '',
        resources: (s.resources || []).map(r => ({ label: r.label || '', url: r.url || '' })),
        quizzes: (s.quizzes || []).map(q => ({
          question: q.question || '',
          options: (q.options && q.options.length ? q.options.slice(0, 4) : ['', '', '', '']),
          correctIndex: q.correctIndex || 0,
          explanation: q.explanation || ''
        }))
      })) : [];
      // Restore this class's saved hero-video pick (if any) BEFORE rendering
      // the session rows below, since that render also (re)builds the hero
      // video dropdown and needs this value to select the right option.
      foundationsAdminHeroVideoValue = (item && item.heroSessionIndex != null && item.heroVideoIndex != null)
        ? `${item.heroSessionIndex}:${item.heroVideoIndex}` : '';
      renderFoundationsAdminSessionRows();

      foundationsAdminSuggestedIds = item ? (item.suggestedIds || []).slice(0, 3) : [];
      renderFoundationsAdminSuggestionsList();

      deleteBtn.style.display = item ? 'inline-block' : 'none';
    }

    // Filling in name + photo from the reusable presenter directory, same as "By
    // the Book" — an admin can still type a brand-new presenter's name/photo by
    // hand instead, which registers them into the directory on Save.
    export function handleFoundationsAdminPresenterPick(presenterId) {
      if (!presenterId) return;
      const presenter = studyPresentersList.find(p => String(p.id) === presenterId);
      if (!presenter) return;
      document.getElementById('foundations-admin-presenter').value = presenter.name;
      document.getElementById('foundations-admin-presenter-photo').value = presenter.photo_url;
    }

    // Same idea as handleFoundationsAdminPresenterPick, but for a single
    // session's own optional presenter override (mirrors handleSessionAdminPresenterPick
    // in "By the Book").
    export function handleFoundationsSessionPresenterPick(idx, presenterId) {
      if (!presenterId) return;
      const presenter = studyPresentersList.find(p => String(p.id) === presenterId);
      if (!presenter || !foundationsAdminSessionsState[idx]) return;
      foundationsAdminSessionsState[idx].presenterName = presenter.name;
      foundationsAdminSessionsState[idx].presenterPhoto = presenter.photo_url;
      renderFoundationsAdminSessionRows();
    }

    export const FOUNDATIONS_SESSION_TITLE_PLACEHOLDER = 'e.g. Session 1: Why Study the Sabbath?';

    export function renderFoundationsAdminSessionRows() {
      const list = document.getElementById('foundations-admin-sessions-list');
      if (!list) return;
      if (foundationsAdminSessionsState.length === 0) {
        list.innerHTML = `<div style="color:var(--text-muted); font-size:13px; margin-bottom:8px;">No sessions yet — add one above.</div>`;
        return;
      }
      list.innerHTML = foundationsAdminSessionsState.map((s, idx) => `
        <div class="book-admin-item-card session-drag-card"
             draggable="true"
             ondragstart="handleFoundationsSessionDragStart(event, ${idx})"
             ondragover="handleFoundationsSessionDragOver(event, ${idx})"
             ondragleave="handleFoundationsSessionDragLeave(event)"
             ondrop="handleFoundationsSessionDrop(event, ${idx})"
             ondragend="handleFoundationsSessionDragEnd(event)">
          <div class="session-drag-handle" title="Drag to reorder">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="8" cy="6" r="1.6"/><circle cx="16" cy="6" r="1.6"/><circle cx="8" cy="12" r="1.6"/><circle cx="16" cy="12" r="1.6"/><circle cx="8" cy="18" r="1.6"/><circle cx="16" cy="18" r="1.6"/></svg>
            <span>Session ${idx + 1}</span>
          </div>
          <div class="book-admin-field-row">
            <div style="flex:1 1 100%;">
              <label>Title</label>
              <input type="text" class="input-field" style="margin-bottom:0;" value="${(s.title || '').replace(/"/g, '&quot;')}" oninput="updateFoundationsAdminSessionField(${idx}, 'title', this.value)" placeholder="${FOUNDATIONS_SESSION_TITLE_PLACEHOLDER}">
            </div>
          </div>
          <div class="book-admin-field-row">
            <div style="flex:1 1 100%;">
              <label>Choose an existing presenter <span style="font-weight:400; color:var(--text-muted);">(optional override for just this session)</span></label>
              <select class="input-field study-presenter-picker" style="margin-bottom:0;" onchange="handleFoundationsSessionPresenterPick(${idx}, this.value)">
                <option value="">Choose an existing presenter…</option>
              </select>
              <div class="study-presenter-picker-error-note" style="display:none; color:var(--accent-coral); font-size:12px; margin-top:4px;"></div>
            </div>
          </div>
          <div class="book-admin-field-row">
            <div style="flex:1 1 160px;">
              <label>Presenter name <span style="font-weight:400; color:var(--text-muted);">(optional)</span></label>
              <input type="text" class="input-field" style="margin-bottom:0;" value="${(s.presenterName || '').replace(/"/g, '&quot;')}" oninput="updateFoundationsAdminSessionField(${idx}, 'presenterName', this.value)" placeholder="Leave blank to use the class's presenter">
            </div>
            <div style="flex:1 1 220px;">
              <label>Presenter photo URL <span style="font-weight:400; color:var(--text-muted);">(optional)</span></label>
              <input type="text" class="input-field" style="margin-bottom:0;" value="${(s.presenterPhoto || '').replace(/"/g, '&quot;')}" oninput="updateFoundationsAdminSessionField(${idx}, 'presenterPhoto', this.value)" placeholder="https://...">
            </div>
          </div>
          <div class="book-admin-field-row">
            <div style="flex:1 1 100%;">
              <label>Session content <span style="font-weight:400; color:var(--text-muted);">(optional)</span></label>
              <div class="foundations-format-toolbar">
                <button type="button" class="foundations-format-btn" title="Bold" onclick="applyFoundationsFormat(${idx}, 'bold')"><strong>B</strong></button>
                <button type="button" class="foundations-format-btn" title="Italic" onclick="applyFoundationsFormat(${idx}, 'italic')"><em>I</em></button>
                <button type="button" class="foundations-format-btn" title="Underline" onclick="applyFoundationsFormat(${idx}, 'underline')"><u>U</u></button>
                <button type="button" class="foundations-format-btn" title="Bulleted List" onclick="applyFoundationsFormat(${idx}, 'bullet')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="9" y1="6" x2="20" y2="6"></line><line x1="9" y1="12" x2="20" y2="12"></line><line x1="9" y1="18" x2="20" y2="18"></line><circle cx="4" cy="6" r="1.4" fill="currentColor" stroke="none"></circle><circle cx="4" cy="12" r="1.4" fill="currentColor" stroke="none"></circle><circle cx="4" cy="18" r="1.4" fill="currentColor" stroke="none"></circle></svg></button>
                <button type="button" class="foundations-format-btn" title="Insert Link" onclick="applyFoundationsFormat(${idx}, 'link')">🔗</button>
                <button type="button" class="foundations-format-btn" title="Upload a table (CSV or TSV file)" onclick="document.getElementById('foundations-table-upload-${idx}').click()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="1.5"></rect><line x1="3" y1="10" x2="21" y2="10"></line><line x1="3" y1="16" x2="21" y2="16"></line><line x1="10.5" y1="4" x2="10.5" y2="20"></line></svg></button>
                <input type="file" id="foundations-table-upload-${idx}" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain" style="display:none;" onchange="handleFoundationsTableUpload(event, ${idx})">
              </div>
              <textarea id="foundations-session-content-${idx}" class="input-field" style="margin-bottom:0; min-height:100px; resize:vertical; font-family:'Plus Jakarta Sans', sans-serif;" oninput="updateFoundationsAdminSessionField(${idx}, 'content', this.value)" onpaste="handleFoundationsContentPaste(event, ${idx})" placeholder="Any written notes or summary for this session…">${(s.content || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</textarea>
              <div style="color:var(--text-muted); font-size:11.5px; margin-top:4px;">Scripture references like "John 3:16" are bolded and linked automatically — no need to mark them up yourself. Paste a copied spreadsheet range, or use the table icon to upload a CSV/TSV file, to drop in a table.</div>
            </div>
          </div>
          <div class="book-admin-field-row" style="align-items:center; justify-content:space-between;">
            <label style="margin:0;">Audio <span style="font-weight:400; color:var(--text-muted);">(optional, for listening — add as many as you need)</span></label>
            <button type="button" class="page-btn" onclick="addFoundationsAdminAudioRow(${idx})">+ Add Audio</button>
          </div>
          ${(s.audio || []).length === 0 ? `<div style="color:var(--text-muted); font-size:12.5px; margin-bottom:8px;">No audio yet.</div>` : (s.audio || []).map((a, aIdx) => `
            <div class="book-admin-field-row">
              <div style="flex:1 1 160px;">
                <input type="text" class="input-field" style="margin-bottom:0;" value="${(a.label || '').replace(/"/g, '&quot;')}" oninput="updateFoundationsAdminAudioField(${idx}, ${aIdx}, 'label', this.value)" placeholder="Label (optional)">
              </div>
              <div style="flex:2 1 220px;">
                <input type="text" class="input-field" style="margin-bottom:0;" value="${(a.url || '').replace(/"/g, '&quot;')}" oninput="updateFoundationsAdminAudioField(${idx}, ${aIdx}, 'url', this.value)" placeholder="https://... (mp3 link)">
              </div>
              <div>
                <button type="button" class="page-btn" style="background:#fee2e2; color:#b91c1c; border-color:#fca5a5;" onclick="removeFoundationsAdminAudioRow(${idx}, ${aIdx})">Remove</button>
              </div>
            </div>`).join('')}
          <div class="book-admin-field-row" style="align-items:center; justify-content:space-between; margin-top:6px;">
            <label style="margin:0;">Video <span style="font-weight:400; color:var(--text-muted);">(optional, for watching — add as many as you need)</span></label>
            <button type="button" class="page-btn" onclick="addFoundationsAdminVideoRow(${idx})">+ Add Video</button>
          </div>
          ${(s.video || []).length === 0 ? `<div style="color:var(--text-muted); font-size:12.5px; margin-bottom:8px;">No video yet.</div>` : (s.video || []).map((v, vIdx) => `
            <div class="book-admin-field-row">
              <div style="flex:1 1 130px;">
                <input type="text" class="input-field" style="margin-bottom:0;" value="${(v.label || '').replace(/"/g, '&quot;')}" oninput="updateFoundationsAdminVideoField(${idx}, ${vIdx}, 'label', this.value)" placeholder="Label (optional)">
              </div>
              <div style="flex:2 1 200px;">
                <input type="text" class="input-field" style="margin-bottom:0;" value="${(v.url || '').replace(/"/g, '&quot;')}" oninput="updateFoundationsAdminVideoField(${idx}, ${vIdx}, 'url', this.value)" placeholder="https://youtube.com/watch?v=...">
              </div>
              <div style="flex:0 1 90px;">
                <input type="text" class="input-field" style="margin-bottom:0;" value="${(v.startTime || '').replace(/"/g, '&quot;')}" oninput="updateFoundationsAdminVideoField(${idx}, ${vIdx}, 'startTime', this.value)" placeholder="Start at" title="Where this video should start playing — e.g. 1:30. Leave blank to start at the beginning.">
              </div>
              <div>
                <button type="button" class="page-btn" style="background:#fee2e2; color:#b91c1c; border-color:#fca5a5;" onclick="removeFoundationsAdminVideoRow(${idx}, ${vIdx})">Remove</button>
              </div>
            </div>
            ${v.quiz
              ? renderFoundationsAdminQuizEditor(idx, vIdx, v.quiz)
              : `<div class="book-admin-field-row" style="margin-top:-6px;"><button type="button" class="page-btn" onclick="toggleFoundationsAdminVideoQuiz(${idx}, ${vIdx})">+ Add Knowledge Check to this video</button></div>`}
          `).join('')}
          <div class="book-admin-field-row" style="align-items:center; justify-content:space-between; margin-top:6px;">
            <label style="margin:0;">Session Resources <span style="font-weight:400; color:var(--text-muted);">(additional print links)</span></label>
            <button type="button" class="page-btn" onclick="addFoundationsAdminResourceRow(${idx})">+ Add Resource</button>
          </div>
          ${(s.resources || []).length === 0 ? `<div style="color:var(--text-muted); font-size:12.5px; margin-bottom:8px;">No resources yet.</div>` : (s.resources || []).map((r, rIdx) => `
            <div class="book-admin-field-row">
              <div style="flex:1 1 160px;">
                <input type="text" class="input-field" style="margin-bottom:0;" value="${(r.label || '').replace(/"/g, '&quot;')}" oninput="updateFoundationsAdminResourceField(${idx}, ${rIdx}, 'label', this.value)" placeholder="e.g. Study Guide">
              </div>
              <div style="flex:2 1 220px;">
                <input type="text" class="input-field" style="margin-bottom:0;" value="${(r.url || '').replace(/"/g, '&quot;')}" oninput="updateFoundationsAdminResourceField(${idx}, ${rIdx}, 'url', this.value)" placeholder="https://... (article or PDF link)">
              </div>
              <div>
                <button type="button" class="page-btn" style="background:#fee2e2; color:#b91c1c; border-color:#fca5a5;" onclick="removeFoundationsAdminResourceRow(${idx}, ${rIdx})">Remove</button>
              </div>
            </div>`).join('')}
          <div class="book-admin-field-row" style="align-items:center; justify-content:space-between; margin-top:10px; padding-top:10px; border-top:1px solid var(--border-color);">
            <label style="margin:0;">Knowledge Check <span style="font-weight:400; color:var(--text-muted);">(optional — addable to any session, with or without video)</span></label>
            <button type="button" class="page-btn" onclick="addFoundationsAdminSessionQuiz(${idx})">+ Add Question</button>
          </div>
          ${(s.quizzes || []).map((quiz, qIdx) => renderFoundationsAdminSessionQuizEditor(idx, qIdx, quiz)).join('')}
          <div class="book-admin-field-row" style="margin-top:4px;">
            <button type="button" class="page-btn" style="background:#fee2e2; color:#b91c1c; border-color:#fca5a5;" onclick="removeFoundationsAdminSessionRow(${idx})">Remove this session</button>
          </div>
        </div>`).join('');
      // Fills in the "Choose an existing presenter" dropdown just added to each
      // session row above with the shared presenter directory — same helper
      // "By the Book" and the class-level picker both already use.
      populateStudyPresenterDropdowns();
      populateFoundationsAdminHeroVideoSelect();
    }

    // --- Drag-and-drop reordering of a Foundations class's sessions — uses
    // the shared makeAdminDragReorder factory (see "By the Book"'s use of it
    // above) so this, TW's lessons, and "By the Book"'s sessions all share
    // one implementation instead of three parallel copies. ---
    export const foundationsSessionDragReorder = makeAdminDragReorder(() => foundationsAdminSessionsState, renderFoundationsAdminSessionRows, 'foundations-admin-sessions-list');

    export function handleFoundationsSessionDragStart(event, idx) { foundationsSessionDragReorder.dragStart(event, idx); }
    export function handleFoundationsSessionDragOver(event, idx) { foundationsSessionDragReorder.dragOver(event, idx); }
    export function handleFoundationsSessionDragLeave(event) { foundationsSessionDragReorder.dragLeave(event); }
    export function handleFoundationsSessionDrop(event, idx) { foundationsSessionDragReorder.drop(event, idx); }
    export function handleFoundationsSessionDragEnd(event) {
      foundationsSessionDragReorder.dragEnd();
    }

    export function addFoundationsAdminSessionRow() {
      foundationsAdminSessionsState.push({ title: '', content: '', audio: [], video: [], presenterName: '', presenterPhoto: '', resources: [], quizzes: [] });
      renderFoundationsAdminSessionRows();
    }

    export function removeFoundationsAdminSessionRow(idx) {
      foundationsAdminSessionsState.splice(idx, 1);
      renderFoundationsAdminSessionRows();
    }

    export function updateFoundationsAdminSessionField(idx, field, value) {
      if (!foundationsAdminSessionsState[idx]) return;
      foundationsAdminSessionsState[idx][field] = value;
    }

    // Lightweight formatting toolbar for a session's "Session content" textarea.
    // Rather than a full contenteditable/WYSIWYG editor, this wraps the current
    // selection in simple inline markup tokens — **bold**, *italic*,
    // __underline__, [text](url) — that renderFoundationsContentHtml() below
    // turns into real HTML when the class is displayed. Keeping the stored
    // text as plain tokens (not raw HTML) is what makes it safe to render
    // without risking arbitrary markup/script injection from the admin form.
    // Thin wrapper over the shared applyContentFormat (see TW's use of it
    // above), pointed at this screen's own textarea id and admin-state
    // update function.
    export function applyFoundationsFormat(idx, kind) {
      applyContentFormat(
        document.getElementById(`foundations-session-content-${idx}`),
        (value) => updateFoundationsAdminSessionField(idx, 'content', value),
        kind
      );
    }

    export function addFoundationsAdminResourceRow(sessionIdx) {
      if (!foundationsAdminSessionsState[sessionIdx]) return;
      foundationsAdminSessionsState[sessionIdx].resources.push({ label: '', url: '' });
      renderFoundationsAdminSessionRows();
    }

    export function removeFoundationsAdminResourceRow(sessionIdx, resIdx) {
      if (!foundationsAdminSessionsState[sessionIdx]) return;
      foundationsAdminSessionsState[sessionIdx].resources.splice(resIdx, 1);
      renderFoundationsAdminSessionRows();
    }

    export function updateFoundationsAdminResourceField(sessionIdx, resIdx, field, value) {
      if (!foundationsAdminSessionsState[sessionIdx] || !foundationsAdminSessionsState[sessionIdx].resources[resIdx]) return;
      foundationsAdminSessionsState[sessionIdx].resources[resIdx][field] = value;
    }

    // Multiple audio files per session — same add/remove/update trio as the
    // Session Resources list just above, applied to session.audio instead.
    export function addFoundationsAdminAudioRow(sessionIdx) {
      if (!foundationsAdminSessionsState[sessionIdx]) return;
      foundationsAdminSessionsState[sessionIdx].audio.push({ label: '', url: '' });
      renderFoundationsAdminSessionRows();
    }

    export function removeFoundationsAdminAudioRow(sessionIdx, audioIdx) {
      if (!foundationsAdminSessionsState[sessionIdx]) return;
      foundationsAdminSessionsState[sessionIdx].audio.splice(audioIdx, 1);
      renderFoundationsAdminSessionRows();
    }

    export function updateFoundationsAdminAudioField(sessionIdx, audioIdx, field, value) {
      if (!foundationsAdminSessionsState[sessionIdx] || !foundationsAdminSessionsState[sessionIdx].audio[audioIdx]) return;
      foundationsAdminSessionsState[sessionIdx].audio[audioIdx][field] = value;
    }

    // Multiple video files per session — same idea, applied to session.video.
    export function addFoundationsAdminVideoRow(sessionIdx) {
      if (!foundationsAdminSessionsState[sessionIdx]) return;
      foundationsAdminSessionsState[sessionIdx].video.push({ label: '', url: '', startTime: '', quiz: null });
      renderFoundationsAdminSessionRows();
    }

    export function removeFoundationsAdminVideoRow(sessionIdx, videoIdx) {
      if (!foundationsAdminSessionsState[sessionIdx]) return;
      foundationsAdminSessionsState[sessionIdx].video.splice(videoIdx, 1);
      renderFoundationsAdminSessionRows();
    }

    export function updateFoundationsAdminVideoField(sessionIdx, videoIdx, field, value) {
      if (!foundationsAdminSessionsState[sessionIdx] || !foundationsAdminSessionsState[sessionIdx].video[videoIdx]) return;
      foundationsAdminSessionsState[sessionIdx].video[videoIdx][field] = value;
    }

    // ------------------------------------------------------------------
    // Knowledge Check editor for a single video row. Kept as a plain nested
    // object on that video ({ question, options[4], correctIndex, explanation })
    // rather than its own admin screen, since a Knowledge Check only ever
    // makes sense attached to one specific video module.
    // ------------------------------------------------------------------
    export function toggleFoundationsAdminVideoQuiz(sessionIdx, videoIdx) {
      const video = foundationsAdminSessionsState[sessionIdx] && foundationsAdminSessionsState[sessionIdx].video[videoIdx];
      if (!video) return;
      video.quiz = video.quiz ? null : { question: '', options: ['', '', '', ''], correctIndex: 0, explanation: '' };
      renderFoundationsAdminSessionRows();
    }

    export function updateFoundationsAdminQuizField(sessionIdx, videoIdx, field, value) {
      const video = foundationsAdminSessionsState[sessionIdx] && foundationsAdminSessionsState[sessionIdx].video[videoIdx];
      if (!video || !video.quiz) return;
      video.quiz[field] = value;
    }

    export function updateFoundationsAdminQuizOption(sessionIdx, videoIdx, optIdx, value) {
      const video = foundationsAdminSessionsState[sessionIdx] && foundationsAdminSessionsState[sessionIdx].video[videoIdx];
      if (!video || !video.quiz) return;
      video.quiz.options[optIdx] = value;
    }

    export function setFoundationsAdminQuizCorrect(sessionIdx, videoIdx, optIdx) {
      const video = foundationsAdminSessionsState[sessionIdx] && foundationsAdminSessionsState[sessionIdx].video[videoIdx];
      if (!video || !video.quiz) return;
      video.quiz.correctIndex = optIdx;
    }

    export function renderFoundationsAdminQuizEditor(sIdx, vIdx, quiz) {
      return renderAdminQuizEditorBlock({
        idxA: sIdx, idxB: vIdx, quiz,
        headerLabel: 'Knowledge Check',
        removeButtonLabel: 'Remove Knowledge Check',
        removeFnName: 'toggleFoundationsAdminVideoQuiz',
        updateFieldFnName: 'updateFoundationsAdminQuizField',
        updateOptionFnName: 'updateFoundationsAdminQuizOption',
        setCorrectFnName: 'setFoundationsAdminQuizCorrect',
        questionPlaceholder: 'Question shown right after this video ends',
        helperText: 'Fill in at least 2 options and mark the correct one.',
        radioName: `fq-correct-${sIdx}-${vIdx}`
      });
    }

    // --- Session-level Knowledge Check editing — addable to ANY session
    // regardless of its content (video, audio, text, or none), unlike the
    // per-video quiz above which needs a video to attach to. Uses the same
    // shared makeAdminQuizArrayController/renderAdminQuizEditorBlock as TW's
    // per-lesson quiz (see there), just pointed at
    // foundationsAdminSessionsState[sessionIdx].quizzes. Purely informational
    // for Core-D — no lock/progression depends on it. ---
    export const foundationsSessionQuizController = makeAdminQuizArrayController(sessionIdx => foundationsAdminSessionsState[sessionIdx]);

    export function addFoundationsAdminSessionQuiz(sessionIdx) {
      foundationsSessionQuizController.add(sessionIdx);
      renderFoundationsAdminSessionRows();
    }

    export function removeFoundationsAdminSessionQuiz(sessionIdx, quizIdx) {
      foundationsSessionQuizController.remove(sessionIdx, quizIdx);
      renderFoundationsAdminSessionRows();
    }

    export function updateFoundationsAdminSessionQuizField(sessionIdx, quizIdx, field, value) {
      foundationsSessionQuizController.updateField(sessionIdx, quizIdx, field, value);
    }

    export function updateFoundationsAdminSessionQuizOption(sessionIdx, quizIdx, optIdx, value) {
      foundationsSessionQuizController.updateOption(sessionIdx, quizIdx, optIdx, value);
    }

    export function setFoundationsAdminSessionQuizCorrect(sessionIdx, quizIdx, optIdx) {
      foundationsSessionQuizController.setCorrect(sessionIdx, quizIdx, optIdx);
    }

    export function renderFoundationsAdminSessionQuizEditor(sIdx, qIdx, quiz) {
      return renderAdminQuizEditorBlock({
        idxA: sIdx, idxB: qIdx, quiz,
        headerLabel: `Question ${qIdx + 1}`,
        removeButtonLabel: 'Remove this question',
        removeFnName: 'removeFoundationsAdminSessionQuiz',
        updateFieldFnName: 'updateFoundationsAdminSessionQuizField',
        updateOptionFnName: 'updateFoundationsAdminSessionQuizOption',
        setCorrectFnName: 'setFoundationsAdminSessionQuizCorrect',
        questionPlaceholder: 'Question for this session',
        helperText: 'Fill in at least 2 options and mark the correct one.',
        radioName: `fsq-correct-${sIdx}-${qIdx}`
      });
    }

    // "May We Suggest?" — lets an admin pick up to 3 other classes to
    // recommend at the end of this one. Lists every OTHER class (the one
    // currently being edited is excluded so a class can't suggest itself),
    // live or not, sorted the same way the Class picker above is, so an admin
    // can line up suggestions for a class they haven't published yet too.
    export function renderFoundationsAdminSuggestionsList() {
      const list = document.getElementById('foundations-admin-suggestions-list');
      const countEl = document.getElementById('foundations-admin-suggestions-count');
      if (!list) return;

      const currentIdVal = document.getElementById('foundations-admin-select').value;
      const currentId = currentIdVal ? parseInt(currentIdVal, 10) : null;
      const options = foundationsList
        .filter(i => i.dbId !== currentId)
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));

      if (countEl) countEl.textContent = `${foundationsAdminSuggestedIds.length}/3 selected`;

      if (options.length === 0) {
        list.innerHTML = `<div style="color:var(--text-muted); font-size:13px;">No other classes to suggest yet.</div>`;
        return;
      }

      const atLimit = foundationsAdminSuggestedIds.length >= 3;
      list.innerHTML = options.map(opt => {
        const checked = foundationsAdminSuggestedIds.includes(opt.dbId);
        const disabled = atLimit && !checked;
        return `
          <label style="display:flex; align-items:center; gap:8px; padding:5px 0; font-size:13.5px; color:${disabled ? 'var(--text-muted)' : 'var(--text-main)'}; cursor:${disabled ? 'not-allowed' : 'pointer'};">
            <input type="checkbox" style="width:16px; height:16px; margin:0; flex-shrink:0;" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} onchange="toggleFoundationsAdminSuggestion(${opt.dbId})">
            <span>${(opt.title || 'Untitled class').replace(/</g, '&lt;')}${opt.live ? '' : ' <span style="color:var(--text-muted);">(not live)</span>'}</span>
          </label>`;
      }).join('');
    }

    export function toggleFoundationsAdminSuggestion(dbId) {
      const idx = foundationsAdminSuggestedIds.indexOf(dbId);
      if (idx >= 0) {
        foundationsAdminSuggestedIds.splice(idx, 1);
      } else {
        if (foundationsAdminSuggestedIds.length >= 3) return; // shouldn't happen (checkbox is disabled), but stay safe
        foundationsAdminSuggestedIds.push(dbId);
      }
      renderFoundationsAdminSuggestionsList();
    }

    export async function saveFoundationsAdminForm() {
      if (!currentUser || !currentUser.isAdmin) return;

      const idVal = document.getElementById('foundations-admin-select').value;
      const title = document.getElementById('foundations-admin-title').value.trim();
      if (!title) { alert('Give this class a title.'); return; }

      if (foundationsAdminSessionsState.some(s => !s.title.trim())) {
        alert('Every session needs a title.');
        return;
      }

      const presenterName = document.getElementById('foundations-admin-presenter').value.trim();
      const presenterPhoto = document.getElementById('foundations-admin-presenter-photo').value.trim();

      const sessions = foundationsAdminSessionsState.map(s => {
        const item = {
          title: s.title.trim(),
          content: (s.content || '').trim(),
          audio: (s.audio || [])
            .filter(a => (a.label || '').trim() || (a.url || '').trim())
            .map(a => ({ label: (a.label || '').trim(), url: (a.url || '').trim() })),
          video: (s.video || [])
            .filter(v => (v.label || '').trim() || (v.url || '').trim())
            .map(v => {
              const out = { label: (v.label || '').trim(), url: (v.url || '').trim(), startSeconds: parseTimeToSeconds(v.startTime) };
              const q = v.quiz;
              if (q && (q.question || '').trim() && (q.options || []).filter(o => (o || '').trim()).length >= 2) {
                out.quiz = {
                  question: q.question.trim(),
                  options: q.options.map(o => (o || '').trim()),
                  correctIndex: q.correctIndex || 0,
                  explanation: (q.explanation || '').trim()
                };
              }
              return out;
            }),
          resources: (s.resources || [])
            .filter(r => (r.label || '').trim() || (r.url || '').trim())
            .map(r => ({ label: (r.label || '').trim(), url: (r.url || '').trim() })),
          quizzes: (s.quizzes || [])
            .filter(q => (q.question || '').trim() && (q.options || []).filter(o => (o || '').trim()).length >= 2)
            .map(q => ({
              question: q.question.trim(),
              options: q.options.map(o => (o || '').trim()),
              correctIndex: q.correctIndex || 0,
              explanation: (q.explanation || '').trim()
            }))
        };
        // Optional per-session presenter override — only set when a name was
        // given, so a session with nothing typed here just falls back to the
        // class's own presenter at display time (see foundationsSessionAccordionHtml).
        const sessionPresenterName = (s.presenterName || '').trim();
        if (sessionPresenterName) {
          item.presenter = { name: sessionPresenterName, photo: (s.presenterPhoto || '').trim() };
        }
        return item;
      });

      // Hero video pick — "sessionIdx:videoIdx" from the dropdown, or '' for
      // Auto (stored as null so it reads as "not set" on the way back in).
      let heroSessionIndex = null, heroVideoIndex = null;
      if (foundationsAdminHeroVideoValue) {
        const [hs, hv] = foundationsAdminHeroVideoValue.split(':').map(n => parseInt(n, 10));
        if (Number.isInteger(hs) && Number.isInteger(hv)) { heroSessionIndex = hs; heroVideoIndex = hv; }
      }

      const payload = {
        title: title,
        presenter: presenterName,
        presenter_photo_url: presenterPhoto,
        category: document.getElementById('foundations-admin-category').value.trim() || 'General',
        thumbnail_url: document.getElementById('foundations-admin-thumbnail').value.trim(),
        sort_order: parseInt(document.getElementById('foundations-admin-sort-order').value, 10) || 0,
        is_new: document.getElementById('foundations-admin-is-new').checked,
        live: document.getElementById('foundations-admin-live').checked,
        sessions: sessions,
        suggested_ids: foundationsAdminSuggestedIds.slice(0, 3),
        hero_session_index: heroSessionIndex,
        hero_video_index: heroVideoIndex,
        updated_at: new Date().toISOString()
      };
      if (idVal) payload.id = parseInt(idVal, 10);

      const { data, error } = await foundationsContentTable.upsert(
        payload,
        'id, title, presenter, presenter_photo_url, category, thumbnail_url, is_new, live, sort_order, sessions, suggested_ids, hero_session_index, hero_video_index'
      );

      if (error) {
        console.error('Error saving Foundations class:', error.message);
        alert('Could not save: ' + error.message);
        return;
      }

      // Register a hand-typed presenter (name + photo, both filled in) into the
      // reusable directory so they show up in the picker for every future class.
      if (presenterName && presenterPhoto) {
        await upsertStudyPresenter(presenterName, presenterPhoto);
      }
      // Same for any hand-typed per-session presenter overrides.
      for (const s of sessions) {
        if (s.presenter && s.presenter.name && s.presenter.photo) {
          await upsertStudyPresenter(s.presenter.name, s.presenter.photo);
        }
      }

      const saved = {
        dbId: data.id,
        title: data.title || '',
        presenter: data.presenter || '',
        presenterPhotoUrl: data.presenter_photo_url || '',
        category: data.category || 'General',
        thumbnailUrl: data.thumbnail_url || '',
        isNew: !!data.is_new,
        live: data.live !== false,
        sortOrder: data.sort_order || 0,
        sessions: Array.isArray(data.sessions) ? data.sessions : [],
        suggestedIds: Array.isArray(data.suggested_ids) ? data.suggested_ids.map(id => parseInt(id, 10)) : [],
        heroSessionIndex: Number.isInteger(data.hero_session_index) ? data.hero_session_index : null,
        heroVideoIndex: Number.isInteger(data.hero_video_index) ? data.hero_video_index : null
      };
      const existingIdx = foundationsList.findIndex(i => i.dbId === saved.dbId);
      if (existingIdx >= 0) foundationsList[existingIdx] = saved;
      else foundationsList.push(saved);

      updateStudyNotificationBadges();
      alert(`Saved! "${saved.title}" is now live for everyone.`);
      closeFoundationsAdminView();
      switchStudySubTab('foundations');
    }

    export async function deleteFoundationsAdminItem() {
      if (!currentUser || !currentUser.isAdmin) return;
      const idVal = document.getElementById('foundations-admin-select').value;
      if (!idVal) return;
      const item = foundationsList.find(i => String(i.dbId) === String(idVal));
      if (!item) return;
      if (!confirm(`Delete "${item.title}"? This can't be undone.`)) return;

      const { error } = await foundationsContentTable.remove(item.dbId);
      if (error) {
        console.error('Error deleting Foundations class:', error.message);
        alert('Could not delete: ' + error.message);
        return;
      }

      foundationsList = foundationsList.filter(i => i.dbId !== item.dbId);
      updateStudyNotificationBadges();
      openFoundationsAdminView();
    }