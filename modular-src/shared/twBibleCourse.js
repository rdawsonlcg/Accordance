// ============================================================================
// shared/twBibleCourse.js — the TW Bible Course study feature: module/lesson
// data and progress tracking, the learner-facing module list and lesson
// accordion (including the inline and full-screen-overlay Knowledge Check
// flows), and the full admin form for editing a module's content.
//
// NOT included here, on purpose: checkTWModuleCompletionBadges/
// checkTWCourseCompletionBadges (the badge-award checks) now live in
// shared/records.js with the rest of the badge system, same reasoning as
// isBookFullyClicked staying out of shared/byTheBook.js — this module just
// calls them. (They used to be imported from app.js, back when the badge
// system still lived there — re-pointed once shared/records.js existed.)
// normalizeTWLessonQuizzes stayed in app.js: despite its name, it's used by
// Core-D's content loader too (neither module is exclusively "home" for a
// validator both need).
//
// `supabaseClient` is referenced directly (for the module-thumbnail upload)
// as a pre-existing global, same as core/db.js — see that file's header for
// why that's safe.
//
// Depends on core/db.js, shared/adminUtils.js, and shared/videoPlayer.js for
// the obvious things, plus a fair amount still living in app.js: escapeHtml,
// fixMojibakeText, currentUser, the two badge-check functions above,
// normalizeTWLessonQuizzes, three Core-D rendering helpers this reuses
// (normalizeFoundationsMediaList, foundationsMediaItemAccordionHtml,
// renderFoundationsContentHtml, sizeFoundationsHeroVideoBg), and navigation/
// notification glue (switchTab, switchStudySubTab,
// updateStudyNotificationBadges). app.js in turn imports this module's own
// exports back (markTWLessonComplete, twBibleCourseData, etc.) — the third
// circular dependency with app.js now, handled the same documented way as
// the other two: every usage on both sides is inside a function body, never
// at module-load time.
//
// One extra wrinkle from being the third piece pulled out of app.js:
// shared/videoPlayer.js used to import twBibleCourseData and
// markTWLessonComplete straight from app.js, back when this module's code
// still lived there. Now that they live here instead, videoPlayer.js's
// import points at this file for those two names — see its own header.
// ============================================================================

import { createTableAccessor, fetchAllRows, twCourseProgressTable } from '../core/db.js';
import {
  applyContentFormat, handleContentPaste, handleTableUpload, insertTableAtCursor,
  makeAdminDragReorder, makeAdminQuizArrayController, renderAdminQuizEditorBlock
} from './adminUtils.js';
import {
  isDirectVideoUrl, toYouTubeEmbedUrl, toYouTubeMutedPreviewEmbedUrl, openFsvPlayer,
  formatSecondsToTimeInput, parseTimeToSeconds
} from './videoPlayer.js';
import {
  normalizeFoundationsMediaList, foundationsMediaItemAccordionHtml,
  renderFoundationsContentHtml, sizeFoundationsHeroVideoBg,
  FOUNDATIONS_VIDEO_ICON_SVG, FOUNDATIONS_AUDIO_ICON_SVG
} from './coreD.js';
import { checkTWCourseCompletionBadges, checkTWModuleCompletionBadges } from './records.js';
import {
  escapeHtml, fixMojibakeText, currentUser, normalizeTWLessonQuizzes,
  switchStudySubTab, switchTab, updateStudyNotificationBadges
} from '../app.js';



    // ============================================================
    // TW BIBLE COURSE (LMS-style structure, Study tab sub-option)
    // Progress is saved locally per-browser via localStorage — no
    // backend table was requested for this, so it's front-end only.
    // ============================================================
    export const TW_BIBLE_COURSE_BUILTIN_DEFAULT = [
      {
        id: 'm1',
        title: 'Module 1: Lessons 1-4',
        lessons: [
          { id: 'm1l1', title: 'Lesson 1: The Bible A Book for Today', content: 'If you properly use this course in the months ahead, we are confident that you will grow in your ability to understand the Bible and its vital message.', video: [], audio: [], resources: [], quizzes: [] },
          { id: 'm1l2', title: 'Lesson 2: Are We Living in the "Last Days?"', content: 'Religious people through the centuries have often thought that they were living in the last days. From the first century onwards, there have been many dates set in anticipation of Christ’s return. Why should we think that our day is unique?', video: [], audio: [], resources: [], quizzes: [] },
          { id: 'm1l3', title: 'Lesson 3: Can You Understand Bible Prophecy', content: 'Depending on how it is calculated, between onefourth and one-third of your Bible consists of prophecy—all inspired by our Creator, who declares “the end from the beginning” (Isaiah 46:10).', video: [], audio: [], resources: [], quizzes: [] },
          { id: 'm1l4', title: 'Lesson 4: The Master Key to Bible Prophecy', content: 'Does prophecy directly mention the United States and the other English-speaking peoples of the world? There are many prophecies relating to Israel, but are they all referring to the modern Jewish state in the Middle East? Understanding the identity of the modern peoples mentioned in those ancient prophecies is the master key to making sense of those same prophecies today!', video: [], audio: [], resources: [], quizzes: [] }
        ]
      },
      {
        id: 'm2',
        title: 'Module 2: Studying Scripture',
        lessons: [
          { id: 'm2l1', title: 'Hermeneutics 101', content: 'Principles for interpreting the Bible faithfully.', video: [], audio: [], resources: [], quizzes: [] },
          { id: 'm2l2', title: 'Using Cross-References', content: 'How to let Scripture interpret Scripture.', video: [], audio: [], resources: [], quizzes: [] },
          { id: 'm2l3', title: 'Historical & Cultural Context', content: 'Why context changes everything.', video: [], audio: [], resources: [], quizzes: [] }
        ]
      },
      {
        id: 'm3',
        title: 'Module 3: Living It Out',
        lessons: [
          { id: 'm3l1', title: 'Prayer & Meditation', content: 'Integrating Scripture into daily spiritual practice.', video: [], audio: [], resources: [], quizzes: [] },
          { id: 'm3l2', title: 'Sharing Your Faith', content: 'Practical steps for gospel conversations.', video: [], audio: [], resources: [], quizzes: [] },
          { id: 'm3l3', title: 'Building a Reading Habit', content: 'Sustainable rhythms for lifelong Bible engagement.', video: [], audio: [], resources: [], quizzes: [] }
        ]
      }
    ];

    // Live course data — starts as the hardcoded default above and is overwritten
    // WHOLESALE by loadTWBibleCourseFromDB() at boot once any admin-saved module
    // exists in the `tw_bible_course_modules` table (same "admin content replaces
    // the hardcoded default" pattern as bible_study_books/foundations_content).
    export let twBibleCourseData = TW_BIBLE_COURSE_BUILTIN_DEFAULT;
    export const twBibleCourseModulesTable = createTableAccessor('tw_bible_course_modules');

    // Admin-editable TW Bible Course content, loaded from the `tw_bible_course_modules`
    // table below and replacing TW_BIBLE_COURSE_BUILTIN_DEFAULT wholesale once any rows
    // exist. Falls back to (and stays on) the hardcoded course if the table doesn't
    // exist yet or genuinely has no rows saved.
    //
    // One-time setup: this table needs to exist in Supabase before Manage Content will
    // save anything. Run once in the SQL editor:
    //
    //   create table if not exists tw_bible_course_modules (
    //     id bigint generated by default as identity primary key,
    //     title text not null,
    //     order_index int not null default 0,
    //     presenter text,
    //     presenter_photo_url text,
    //     thumbnail_url text,
    //     hero_session_index int,
    //     hero_video_index int,
    //     lessons jsonb not null default '[]'::jsonb,
    //     updated_at timestamptz not null default now()
    //   );
    //   alter table tw_bible_course_modules disable row level security;
    //
    // A learner's actual progress through lessons lives in a SEPARATE table,
    // tw_course_progress (one row per completed lesson per user) — see the SQL
    // comment above loadTWCourseProgress below.
    export async function loadTWBibleCourseFromDB() {
      try {
        const rows = await fetchAllRows('tw_bible_course_modules', 'id, title, order_index, presenter, presenter_photo_url, thumbnail_url, hero_session_index, hero_video_index, lessons', null, 'order_index');
        if (rows && rows.length > 0) {
          twBibleCourseData = rows.map(r => ({
            id: `dbmod-${r.id}`,
            dbId: r.id,
            title: fixMojibakeText(r.title || ''),
            orderIndex: r.order_index || 0,
            presenter: fixMojibakeText(r.presenter || ''),
            presenterPhotoUrl: r.presenter_photo_url || '',
            thumbnailUrl: r.thumbnail_url || '',
            heroSessionIndex: Number.isInteger(r.hero_session_index) ? r.hero_session_index : null,
            heroVideoIndex: Number.isInteger(r.hero_video_index) ? r.hero_video_index : null,
            // Same lesson shape Foundations sessions use for content/video/audio/
            // resources (reusing its normalizers), plus a lesson-level `quiz` —
            // the single Knowledge Check that gates completing THIS lesson (see
            // markTWLessonComplete / the removed old "Continue" checkoff).
            lessons: Array.isArray(r.lessons) ? r.lessons.map(l => ({
              id: l.id,
              title: fixMojibakeText(l.title || ''),
              content: fixMojibakeText(l.content || l.description || ''),
              video: normalizeFoundationsMediaList(l.video),
              audio: normalizeFoundationsMediaList(l.audio),
              resources: Array.isArray(l.resources) ? l.resources.map(res => ({ label: fixMojibakeText(res.label || ''), url: res.url || '' })) : [],
              quizzes: normalizeTWLessonQuizzes(l.quizzes || l.quiz)
            })) : []
          }));
        }
      } catch (e) {
        // Table may not exist yet (before the SQL migration is run) — the course just
        // keeps showing TW_BIBLE_COURSE_BUILTIN_DEFAULT until then.
        console.error('Error loading TW Bible Course content:', e.message);
      }
    }

    // ------------------------------------------------------------------
    // A learner's progress through the course — which lessons they've
    // actually answered the Knowledge Check for correctly. Stored server-side
    // (one row per completed lesson) rather than localStorage, so progress
    // follows the account across devices and badges award correctly no
    // matter where a lesson was finished.
    //
    // One-time setup — run once in the SQL editor:
    //
    //   create table if not exists tw_course_progress (
    //     id bigint generated by default as identity primary key,
    //     user_id uuid not null references auth.users(id) on delete cascade,
    //     lesson_id text not null,
    //     completed_at timestamptz not null default now(),
    //     unique (user_id, lesson_id)
    //   );
    //   alter table tw_course_progress disable row level security;
    // ------------------------------------------------------------------
    export let twCourseProgress = {}; // { lessonId: true }, for the CURRENT user only

    export async function loadTWCourseProgress() {
      if (!currentUser) { twCourseProgress = {}; return; }
      try {
        const rows = await fetchAllRows('tw_course_progress', 'lesson_id', q => q.eq('user_id', currentUser.id), 'id');
        twCourseProgress = {};
        (rows || []).forEach(r => { twCourseProgress[r.lesson_id] = true; });
      } catch (e) {
        // Table may not exist yet (before the SQL migration is run) — progress
        // just won't persist until then.
        console.error('Error loading TW Bible Course progress:', e.message);
        twCourseProgress = {};
      }
    }

    // Records one completed lesson. Upserts (rather than insert) so replaying
    // an already-completed lesson's Knowledge Check never creates a duplicate
    // row or errors out on the unique(user_id, lesson_id) constraint.
    export async function saveTWLessonProgress(lessonId) {
      if (!currentUser) return;
      try {
        const { error } = await twCourseProgressTable.upsert(
          { user_id: currentUser.id, lesson_id: lessonId, completed_at: new Date().toISOString() },
          null,
          { onConflict: 'user_id,lesson_id' }
        );
        if (error) console.error('Error saving TW Bible Course progress:', error.message);
      } catch (e) {
        console.error('Error saving TW Bible Course progress:', e.message);
      }
    }

    // Counts MODULES (the "Lessons N" entries in the module list), not the
    // individual Sections inside each one — a module counts as done once
    // every one of its Sections is complete.
    export function getTWCourseTotals() {
      let total = 0, completed = 0;
      twBibleCourseData.forEach(mod => {
        total++;
        if (mod.lessons.length > 0 && mod.lessons.every(l => twCourseProgress[l.id])) completed++;
      });
      return { total, completed };
    }

    export function toggleTWMediaItem(key) {
      if (twOpenMediaKeys.has(key)) twOpenMediaKeys.delete(key); else twOpenMediaKeys.add(key);
      renderTWModuleDetailPanel();
    }

    // Module i (beyond the first) unlocks once every lesson in module i-1 is
    // complete — "the second Module unlocks after the first is completed, and
    // so on." An empty module never blocks the next one. Admins always see
    // every module as unlocked — they need to be able to open, review, and
    // edit any module's content regardless of a learner's actual progress.
    export function isTWModuleUnlocked(idx) {
      if (currentUser && currentUser.isAdmin) return true;
      if (idx <= 0) return true;
      const prev = twBibleCourseData[idx - 1];
      if (!prev || prev.lessons.length === 0) return true;
      return prev.lessons.every(l => twCourseProgress[l.id]);
    }

    export function isTWModuleUnlockedById(moduleId) {
      const idx = twBibleCourseData.findIndex(m => m.id === moduleId);
      return idx === -1 ? false : isTWModuleUnlocked(idx);
    }

    // Same idea, one level down: lessons within a module unlock one at a time too,
    // so the whole course reads as a single sequential path start to finish.
    // Same admin bypass as isTWModuleUnlocked above.
    export function isTWLessonUnlocked(mod, lessonIdx) {
      if (currentUser && currentUser.isAdmin) return true;
      if (lessonIdx <= 0) return true;
      const prevLesson = mod.lessons[lessonIdx - 1];
      return prevLesson ? !!twCourseProgress[prevLesson.id] : true;
    }

    // The ONLY way a lesson completes now — called when its Knowledge Check
    // (lesson.quizzes, every question in order) is answered CORRECTLY, whether that happened in the
    // full-screen video overlay (see fsvForwardTrack/answerFsvKnowledgeCheck)
    // or inline for a video-less lesson (see answerTWInlineKnowledgeCheck).
    // There is no manual "mark done"/"continue" path anymore — a wrong answer
    // never reaches this function. Awards the per-module and whole-course
    // badges the moment each is completed, and — for a Subscriber finishing
    // the whole course — surfaces the "next step" invitation.
    export async function markTWLessonComplete(moduleId, lessonIndex) {
      const mod = twBibleCourseData.find(m => m.id === moduleId);
      if (!mod) return;
      const lesson = (mod.lessons || [])[lessonIndex];
      if (!lesson || twCourseProgress[lesson.id]) return; // already done — nothing new to check

      twCourseProgress[lesson.id] = true;
      await saveTWLessonProgress(lesson.id);

      const modDone = mod.lessons.length > 0 && mod.lessons.every(l => twCourseProgress[l.id]);
      if (modDone) {
        await checkTWModuleCompletionBadges(mod.id);
        const courseDone = twBibleCourseData.every(m => m.lessons.length > 0 && m.lessons.every(l => twCourseProgress[l.id]));
        if (courseDone) {
          await checkTWCourseCompletionBadges();
          maybeShowTWCourseCompletionModal();
        }
      }

      if (activeTWModuleId === moduleId) renderTWModuleDetailPanel();
      const listEl = document.getElementById('tw-course-content');
      if (listEl && listEl.style.display !== 'none') renderTWModuleList();
    }

    // Only a Subscriber sees the "next step" invitation on finishing the course —
    // Member/Prospective Member/Admin have presumably already taken that step.
export function maybeShowTWCourseCompletionModal() {
      const role = (currentUser && currentUser.role) || 'subscriber';
      if (role !== 'subscriber') return;
      const modal = document.getElementById('tw-course-completion-modal');
      if (modal) modal.classList.add('open');
    }

    export function closeTWCourseCompletionModal() {
      const modal = document.getElementById('tw-course-completion-modal');
      if (modal) modal.classList.remove('open');
    }

    // ------------------------------------------------------------------
    // Module list (browse) view — "you should see all the Module options
    // they do now", just as clickable cards instead of an inline accordion,
    // since clicking one now navigates into a full Core-D-style module page
    // (see openTWModule/renderTWModuleDetailPanel) rather than expanding in place.
    // ------------------------------------------------------------------
    export const TW_LOCK_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2"></rect><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"></path></svg>';
    export const TW_CHECK_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';

    export function renderTWModuleList() {
      const container = document.getElementById('tw-course-content');
      if (!container) return;
      container.style.display = 'block';
      const detailPanel = document.getElementById('tw-course-detail-panel');
      if (detailPanel) detailPanel.style.display = 'none';

      const adminBtn = document.getElementById('tw-course-admin-entry-btn');
      if (adminBtn) adminBtn.style.display = (currentUser && currentUser.isAdmin) ? 'inline-block' : 'none';

      const { total, completed } = getTWCourseTotals();
      const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

      let html = `
        <div style="margin-bottom: 20px;">
          <div style="display:flex; justify-content:space-between; font-size:13px; color:var(--text-muted); margin-bottom:4px; font-family: 'Plus Jakarta Sans', sans-serif;">
            <span>Course Progress</span>
            <span>${completed} / ${total} lessons (${percent}%)</span>
          </div>
          <div style="width:100%; background:var(--border-color); border-radius:8px; height:10px; overflow:hidden;">
            <div style="width:${percent}%; background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); height:100%; transition:width 0.3s;"></div>
          </div>
        </div>
        <div class="tw-module-list">`;

      twBibleCourseData.forEach((mod, idx) => {
        const modTotal = mod.lessons.length;
        const modCompleted = mod.lessons.filter(l => twCourseProgress[l.id]).length;
        const isComplete = modTotal > 0 && modCompleted === modTotal;
        const unlocked = isTWModuleUnlocked(idx);
        const safeId = mod.id.replace(/'/g, "\\'");
        html += `
          <div class="tw-module-card${isComplete ? ' complete' : ''}${unlocked ? '' : ' locked'}" ${unlocked ? `onclick="openTWModule('${safeId}')"` : `title="Complete the previous module first"`}>
            <div style="display:flex; align-items:center; gap:14px; min-width:0;">
              <span class="tw-module-index">${isComplete ? TW_CHECK_SVG : (idx + 1)}</span>
              <div style="min-width:0;">
                <div class="tw-module-title">${(mod.title || '').replace(/</g, '&lt;')}</div>
                <div class="tw-module-meta">${modCompleted}/${modTotal}</div>
              </div>
            </div>
            ${unlocked
              ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-muted); flex-shrink:0;"><polyline points="9 6 15 12 9 18"></polyline></svg>'
              : `<span class="tw-module-lock-icon">${TW_LOCK_SVG}</span>`}
          </div>`;
      });

      html += `</div>`;
      container.innerHTML = html;
    }

    // ------------------------------------------------------------------
    // Module detail view — the "Modules layer between the TW Bible Course view
    // and the classes": opening a module here looks exactly like a Core-D
    // class page (same hero + Lessons list markup/CSS), with Lessons playing
    // the role Core-D's Sessions do.
    // ------------------------------------------------------------------
    export let activeTWModuleId = null;
    export let openTWLessonIndex = null;
    export let twOpenMediaKeys = new Set();

    export function openTWModule(moduleId) {
      if (!isTWModuleUnlockedById(moduleId)) return;
      activeTWModuleId = moduleId;
      openTWLessonIndex = null;
      twOpenMediaKeys.clear();

      const listEl = document.getElementById('tw-course-content');
      const panel = document.getElementById('tw-course-detail-panel');
      if (!panel) return;

      // Must be visible BEFORE rendering — same reason as Core-D's
      // openFoundationsItem: the hero video preview measures its own box to
      // size its iframe, which reads 0 for a display:none element.
      panel.style.display = 'block';
      renderTWModuleDetailPanel();
      if (listEl) listEl.style.display = 'none';
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    export function closeTWModule() {
      activeTWModuleId = null;
      openTWLessonIndex = null;
      renderTWModuleList();
    }

    // Mirrors getFoundationsHeroVideo, applied to a module's lessons instead
    // of a class's sessions.
    export function getTWModuleHeroVideo(mod) {
      const lessons = mod.lessons || [];
      if (mod.heroSessionIndex != null && mod.heroVideoIndex != null) {
        const picked = lessons[mod.heroSessionIndex] && lessons[mod.heroSessionIndex].video && lessons[mod.heroSessionIndex].video[mod.heroVideoIndex];
        if (picked && picked.url && (isDirectVideoUrl(picked.url) || toYouTubeEmbedUrl(picked.url))) {
          return { lessonIdx: mod.heroSessionIndex, videoIdx: mod.heroVideoIndex };
        }
      }
      for (let i = 0; i < lessons.length; i++) {
        const videos = (lessons[i].video || []).filter(v => v.url && (isDirectVideoUrl(v.url) || toYouTubeEmbedUrl(v.url)));
        if (videos.length > 0) return { lessonIdx: i, videoIdx: (lessons[i].video || []).indexOf(videos[0]) };
      }
      return null;
    }

    export function renderTWModuleDetailPanel() {
      const mod = twBibleCourseData.find(m => m.id === activeTWModuleId);
      const panel = document.getElementById('tw-course-detail-panel');
      if (!mod || !panel) return;

      const lessons = mod.lessons || [];
      const heroVideo = getTWModuleHeroVideo(mod);
      const heroPreviewEmbedUrl = heroVideo
        ? toYouTubeMutedPreviewEmbedUrl(lessons[heroVideo.lessonIdx].video[heroVideo.videoIdx].url)
        : null;

      const heroPresenterHtml = mod.presenter ? `
        <div class="foundations-hero-presenter">
          ${mod.presenterPhotoUrl ? `<img src="${mod.presenterPhotoUrl.replace(/"/g, '&quot;')}" alt="${mod.presenter.replace(/"/g, '&quot;')}">` : ''}
          <span>With ${mod.presenter.replace(/</g, '&lt;')}</span>
        </div>` : '';

      // The hero Play button only ever offers an UNLOCKED lesson's video —
      // jumping straight into a locked lesson would let a learner skip ahead
      // around the sequential unlock system entirely.
      const heroPlayBtnHtml = (heroVideo && isTWLessonUnlocked(mod, heroVideo.lessonIdx)) ? `
        <button type="button" class="foundations-hero-play-btn" onclick="openTWLessonVideo('${mod.id.replace(/'/g, "\\'")}', ${heroVideo.lessonIdx}, ${heroVideo.videoIdx})">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#15131d"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>
          Play
        </button>` : '';

      const heroHtml = `
        <div class="foundations-hero">
          <div class="foundations-hero-bg${mod.thumbnailUrl ? '' : ' no-image'}" style="background-image:${mod.thumbnailUrl ? `url('${mod.thumbnailUrl.replace(/'/g, "\\'")}')` : `linear-gradient(135deg, #6366f1 0%, #15131d 130%)`};"></div>
          ${heroPreviewEmbedUrl ? `<div class="foundations-hero-video-bg"><iframe src="${heroPreviewEmbedUrl}" allow="autoplay; encrypted-media" tabindex="-1"></iframe></div>` : ''}
          <div class="foundations-hero-scrim"></div>
          <div class="foundations-hero-topbar">
            <button type="button" class="foundations-hero-round-btn" title="Back" onclick="closeTWModule()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
          </div>
          <div class="foundations-hero-content">
            <span class="foundations-hero-category">TW Bible Course</span>
            <h3 class="foundations-hero-title">${(mod.title || '').replace(/</g, '&lt;')}</h3>
            ${heroPresenterHtml}
            <div class="foundations-hero-actions">${heroPlayBtnHtml}</div>
          </div>
        </div>`;

      const lessonsHtml = lessons.length === 0
        ? `<div style="color:var(--text-muted); font-size:13px;">No lessons added yet — check back soon.</div>`
        : lessons.map((lesson, idx) => twLessonAccordionHtml(mod, lesson, idx)).join('');

      panel.innerHTML = `
        ${heroHtml}
        <div class="foundations-lessons-heading">Sections</div>
        <div class="foundations-sessions-list">${lessonsHtml}</div>
      `;

      if (heroPreviewEmbedUrl) sizeFoundationsHeroVideoBg();
    }

    export function twLessonAccordionHtml(mod, lesson, idx) {
      const isOpen = openTWLessonIndex === idx;
      const unlocked = isTWLessonUnlocked(mod, idx);
      const isComplete = !!twCourseProgress[lesson.id];
      const title = lesson.title || `Lesson ${idx + 1}`;

      const hasVideoContent = (lesson.video || []).some(v => v.url);
      const hasAudioContent = (lesson.audio || []).some(a => a.url);
      const hasResourceContent = (lesson.resources || []).some(r => r.url);
      const mediaChips = [];
      if (hasVideoContent) mediaChips.push(`<span class="foundations-session-media-chip" title="Includes video">${FOUNDATIONS_VIDEO_ICON_SVG}</span>`);
      if (hasAudioContent) mediaChips.push(`<span class="foundations-session-media-chip" title="Includes audio">${FOUNDATIONS_AUDIO_ICON_SVG}</span>`);
      if (hasResourceContent) mediaChips.push(`<span class="foundations-session-media-chip" title="Includes resources"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg></span>`);
      const mediaChipsHtml = mediaChips.length ? `<span class="foundations-session-media-chips">${mediaChips.join('')}</span>` : '';
      const statusIconHtml = isComplete
        ? `<span style="display:inline-flex; color:var(--accent-teal); flex-shrink:0;">${TW_CHECK_SVG}</span>`
        : (!unlocked ? `<span style="display:inline-flex; color:var(--text-muted); flex-shrink:0;">${TW_LOCK_SVG}</span>` : '');

      let bodyHtml = '';
      if (isOpen && unlocked) {
        const contentHtml = lesson.content ? `<div class="foundations-detail-body" style="margin-bottom:12px;">${renderFoundationsContentHtml(lesson.content)}</div>` : '';

        let mediaHtml = '';
        const videos = (lesson.video || []).filter(v => v.url);
        const audios = (lesson.audio || []).filter(a => a.url);
        if (videos.length > 0 || audios.length > 0) {
          let mediaItemsHtml = '';
          videos.forEach((v, vIdx) => {
            const label = v.label || (videos.length > 1 ? `Video ${vIdx + 1}` : 'Video');
            const embedUrl = isDirectVideoUrl(v.url) || toYouTubeEmbedUrl(v.url);
            const safeModId = mod.id.replace(/'/g, "\\'");
            const rowAction = embedUrl
              ? `onclick="openTWLessonVideo('${safeModId}', ${idx}, ${vIdx})"`
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
            const key = `tw-audio:${idx}:${aIdx}`;
            const isItemOpen = twOpenMediaKeys.has(key);
            const label = a.label || (audios.length > 1 ? `Audio ${aIdx + 1}` : 'Audio');
            const safeAudioTitle = `${mod.title} • ${title} — ${label}`.replace(/"/g, '&quot;');
            const playerHtml = `<audio controls preload="metadata" data-media-title="${safeAudioTitle}" src="${a.url.replace(/"/g, '&quot;')}" style="width:100%; height:40px;"></audio>`;
            mediaItemsHtml += foundationsMediaItemAccordionHtml(key, isItemOpen, FOUNDATIONS_AUDIO_ICON_SVG, label, playerHtml);
          });
          mediaHtml = `<div class="foundations-media-list" style="margin-bottom:12px;">${mediaItemsHtml}</div>`;
        }

        const resources = (lesson.resources || []).filter(r => r.url);
        const resourcesHtml = resources.length > 0 ? `
          <div style="margin-top:6px; margin-bottom:14px;">
            <div style="font-size:11.5px; font-weight:700; text-transform:uppercase; letter-spacing:0.4px; color:var(--text-muted); margin-bottom:6px;">Lesson Resources</div>
            <div style="display:flex; flex-direction:column; gap:6px;">
              ${resources.map(r => `
                <a href="${r.url.replace(/"/g, '&quot;')}" target="_blank" rel="noopener" style="display:flex; align-items:center; gap:8px; background: var(--bg-color); border:1px solid var(--border-color); padding:8px 12px; border-radius:8px; text-decoration:none; color:var(--text-main);">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                  <span style="font-weight:600; font-size:13px;">${(r.label || 'Resource').replace(/</g, '&lt;')}</span>
                </a>`).join('')}
            </div>
          </div>` : '';

        // Video lessons get their Knowledge Check via the full-screen player
        // overlay once the video ends (see fsvForwardTrack/showFsvKnowledgeCheck).
        // A video-less lesson has no such trigger, so its Knowledge Check
        // renders right here instead — either way, answering every one of the
        // lesson's questions correctly is now the ONLY way to complete it
        // (no more manual checkoff). If there's no Knowledge Check configured
        // yet, this simply renders nothing rather than saying so.
        let kcHtml = '';
        if (!isComplete && videos.length === 0 && lesson.quizzes && lesson.quizzes.length > 0) {
          kcHtml = renderTWInlineKnowledgeCheck(mod.id, idx, lesson.quizzes);
        }

        bodyHtml = `<div class="foundations-session-body">${mediaHtml}${resourcesHtml}${contentHtml}${kcHtml}</div>`;
      }

      return `
        <div class="foundations-session-item${isOpen ? ' open' : ''}">
          <div class="foundations-session-header">
            <button type="button" class="foundations-session-toggle" ${unlocked ? `onclick="toggleTWLesson(${idx})"` : `style="cursor:not-allowed;" title="Complete the previous lesson first"`}>
              <span class="foundations-session-toggle-left">
                <span class="foundations-lesson-index">${idx + 1}</span>
                <span class="foundations-session-title">${title.replace(/</g, '&lt;')}</span>
                ${mediaChipsHtml}
                ${statusIconHtml}
              </span>
              ${unlocked ? `<svg class="foundations-session-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>` : ''}
            </button>
          </div>
          ${bodyHtml}
        </div>`;
    }

    // Tracks which question a video-less lesson's inline Knowledge Check is
    // currently on, keyed by "moduleId:lessonIdx" — reset whenever the lesson
    // is closed/reopened (see toggleTWLesson) so it always restarts from
    // question 1. Mirrors fsvKcState.index, just for the non-video path.
    export let twInlineKcIndex = {};

    // Inline Knowledge Check for a video-less lesson — same "must answer
    // every question correctly, in order" rule as the full-screen overlay
    // version (see answerFsvKnowledgeCheck), just rendered directly in the
    // lesson's expanded body since there's no video player to overlay it on.
    export function renderTWInlineKnowledgeCheck(moduleId, lessonIdx, quizzes) {
      const safeModId = moduleId.replace(/'/g, "\\'");
      const key = `${moduleId}:${lessonIdx}`;
      const qIndex = twInlineKcIndex[key] || 0;
      const quiz = quizzes[qIndex] || quizzes[0];
      const progressLabel = quizzes.length > 1 ? ` — Question ${qIndex + 1} of ${quizzes.length}` : '';
      return `
        <div class="tw-inline-kc" id="tw-inline-kc-${lessonIdx}">
          <div class="tw-inline-kc-eyebrow">Knowledge Check${progressLabel}</div>
          <div class="tw-inline-kc-question">${escapeHtml(quiz.question)}</div>
          <div class="tw-inline-kc-options">
            ${quiz.options.map((opt, i) => `<button type="button" class="tw-inline-kc-option" onclick="answerTWInlineKnowledgeCheck('${safeModId}', ${lessonIdx}, ${i})">${escapeHtml(opt)}</button>`).join('')}
          </div>
          <div class="tw-inline-kc-feedback" id="tw-inline-kc-feedback-${lessonIdx}" style="display:none;"></div>
        </div>`;
    }

    export function answerTWInlineKnowledgeCheck(moduleId, lessonIdx, selectedIndex) {
      const mod = twBibleCourseData.find(m => m.id === moduleId);
      const lesson = mod && mod.lessons[lessonIdx];
      if (!lesson || !lesson.quizzes || lesson.quizzes.length === 0) return;
      const key = `${moduleId}:${lessonIdx}`;
      const qIndex = twInlineKcIndex[key] || 0;
      const quiz = lesson.quizzes[qIndex];
      if (!quiz) return;

      if (selectedIndex === quiz.correctIndex) {
        if (qIndex >= lesson.quizzes.length - 1) {
          delete twInlineKcIndex[key];
          markTWLessonComplete(moduleId, lessonIdx); // re-renders the panel showing the completed state
        } else {
          twInlineKcIndex[key] = qIndex + 1;
          renderTWModuleDetailPanel(); // re-render to show the next question
        }
        return;
      }

      const wrap = document.getElementById(`tw-inline-kc-${lessonIdx}`);
      const fbEl = document.getElementById(`tw-inline-kc-feedback-${lessonIdx}`);
      if (!wrap || !fbEl) return;
      const btn = wrap.querySelectorAll('.tw-inline-kc-option')[selectedIndex];
      if (btn) btn.classList.add('incorrect');
      fbEl.style.display = 'block';
      fbEl.className = 'tw-inline-kc-feedback incorrect';
      fbEl.innerHTML = `<span class="tw-inline-kc-feedback-title">Not quite.</span>Give it another try.`;
      setTimeout(() => {
        if (btn) btn.classList.remove('incorrect');
        fbEl.style.display = 'none';
      }, 1600);
    }

    export function toggleTWLesson(idx) {
      openTWLessonIndex = (openTWLessonIndex === idx) ? null : idx;
      twOpenMediaKeys.clear();
      // Reset any in-progress inline Knowledge Check for this lesson so
      // reopening it later always starts back at question 1.
      delete twInlineKcIndex[`${activeTWModuleId}:${idx}`];
      renderTWModuleDetailPanel();
    }

    // Opens a lesson's video(s) in the shared full-screen player, tagged with a
    // completionContext so that finishing the lesson's whole playlist (the
    // last video ending, or its Knowledge Check being answered) calls
    // markTWLessonComplete automatically — see fsvForwardTrack.
    export function openTWLessonVideo(moduleId, lessonIdx, startVIdx) {
      const mod = twBibleCourseData.find(m => m.id === moduleId);
      if (!mod) return;
      const lesson = (mod.lessons || [])[lessonIdx];
      if (!lesson || !isTWLessonUnlocked(mod, lessonIdx)) return;
      const videos = (lesson.video || []).filter(v => v.url);
      const lessonTitle = lesson.title || `Lesson ${lessonIdx + 1}`;
      openFsvPlayer(videos, startVIdx, `${mod.title} • ${lessonTitle}`, { type: 'tw_lesson', moduleId, lessonIndex: lessonIdx });
    }

    export function renderTWBibleCourse() { renderTWModuleList(); } // back-compat alias

    // --- TW Bible Course admin (Manage Content) ---
    // Mirrors the Foundations admin pattern (a select of existing items, "+ Add a new
    // module…" for a new one) since course modules — like Foundations classes, unlike
    // Books of the Bible — have no fixed canonical list. Lessons within a module use a
    // simple add/remove/reorder list (no drag-and-drop) since a module rarely has more
    // than a handful of lessons.

    export let twCourseAdminLessonsState = []; // [{ id, title, content, video, audio, resources }]
    // Which video plays when a learner taps the module's hero "Play" button —
    // a "lessonIdx:videoIdx" string into the CURRENT admin form state, or ''
    // for "Auto". Mirrors foundationsAdminHeroVideoValue.
    export let twCourseAdminHeroVideoValue = '';

    export async function openTWCourseAdminView() {
      if (!currentUser || !currentUser.isAdmin) return;

      document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
      const notifPanel = document.getElementById('reading-notification-panel');
      if (notifPanel) notifPanel.style.display = 'none';

      document.getElementById('tw-course-admin-tab').classList.add('active');

      const select = document.getElementById('tw-course-admin-select');
      const sorted = twBibleCourseData.slice().sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
      select.innerHTML = '<option value="">+ Add a new module…</option>' +
        sorted.map(mod => `<option value="${mod.id}">${escapeHtml(mod.title)}</option>`).join('');

      handleTWCourseAdminSelectChange();
    }

    export function closeTWCourseAdminView() {
      switchTab('study');
    }

    export function handleTWCourseAdminSelectChange() {
      const idVal = document.getElementById('tw-course-admin-select').value;
      const formEl = document.getElementById('tw-course-admin-form');
      const deleteBtn = document.getElementById('tw-course-admin-delete-btn');
      formEl.style.display = 'block';

      const mod = idVal ? twBibleCourseData.find(m => m.id === idVal) : null;

      document.getElementById('tw-course-admin-title').value = mod ? mod.title : '';
      document.getElementById('tw-course-admin-order').value = mod
        ? (mod.orderIndex || 0)
        : (twBibleCourseData.length ? Math.max(...twBibleCourseData.map(m => m.orderIndex || 0)) + 1 : 0);
      document.getElementById('tw-course-admin-presenter').value = mod ? (mod.presenter || '') : '';
      document.getElementById('tw-course-admin-presenter-photo').value = mod ? (mod.presenterPhotoUrl || '') : '';
      document.getElementById('tw-course-admin-thumbnail').value = mod ? (mod.thumbnailUrl || '') : '';

      twCourseAdminLessonsState = mod ? mod.lessons.map(l => ({
        id: l.id,
        title: l.title || '',
        content: l.content || l.description || '',
        video: (l.video || []).map(v => ({ label: v.label || '', url: v.url || '', startTime: formatSecondsToTimeInput(v.startSeconds) })),
        audio: (l.audio || []).map(a => ({ label: a.label || '', url: a.url || '' })),
        resources: (l.resources || []).map(r => ({ label: r.label || '', url: r.url || '' })),
        // Back-compat: an older-saved lesson may still have a single `quiz`
        // object instead of the `quizzes` array — treat that as a one-question array.
        quizzes: (Array.isArray(l.quizzes) ? l.quizzes : (l.quiz ? [l.quiz] : [])).map(q => ({
          question: q.question || '',
          options: (q.options && q.options.length ? q.options.slice(0, 4) : ['', '', '', '']),
          correctIndex: q.correctIndex || 0,
          explanation: q.explanation || ''
        }))
      })) : [];

      // Restore this module's saved hero-video pick BEFORE rendering the lesson
      // rows below, since that render also (re)builds the hero video dropdown
      // and needs this value to select the right option.
      twCourseAdminHeroVideoValue = (mod && mod.heroSessionIndex != null && mod.heroVideoIndex != null)
        ? `${mod.heroSessionIndex}:${mod.heroVideoIndex}` : '';
      renderTWCourseAdminLessonRows();

      // A hardcoded-only module (never saved to the DB, so it has no dbId) has
      // nothing to actually delete — only a DB-backed module can be removed here.
      deleteBtn.style.display = (mod && mod.dbId) ? 'inline-block' : 'none';
    }

    // Rebuilds the Hero Video dropdown from whatever video rows currently exist
    // across all lessons in the form, restoring the previous pick if it's still
    // valid (or falling back to Auto). Same pattern as
    // populateRecordAdminIconPicker → wait, mirrors populateFoundationsAdminHeroVideoSelect.
    export function populateTWCourseAdminHeroVideoSelect() {
      const select = document.getElementById('tw-course-admin-hero-video');
      if (!select) return;
      const options = ['<option value="">Auto — first video in the module</option>'];
      twCourseAdminLessonsState.forEach((l, lIdx) => {
        const lessonVideos = (l.video || []).filter(v => (v.url || '').trim());
        (l.video || []).forEach((v, vIdx) => {
          if (!(v.url || '').trim()) return;
          const lessonTitle = l.title || `Lesson ${lIdx + 1}`;
          const videoLabel = v.label || (lessonVideos.length > 1 ? `Video ${vIdx + 1}` : 'Video');
          options.push(`<option value="${lIdx}:${vIdx}">${`${lessonTitle} — ${videoLabel}`.replace(/</g, '&lt;')}</option>`);
        });
      });
      select.innerHTML = options.join('');
      const stillValid = Array.from(select.options).some(o => o.value === twCourseAdminHeroVideoValue);
      select.value = stillValid ? twCourseAdminHeroVideoValue : '';
      twCourseAdminHeroVideoValue = select.value;
    }

    export function updateTWCourseAdminHeroVideoValue(value) {
      twCourseAdminHeroVideoValue = value;
    }

    // Lets an admin upload their own image instead of pasting a URL — uploads
    // to the "tw-course-images" Supabase Storage bucket (must exist first,
    // see the SQL comment on this file's storage setup) and drops the
    // resulting public URL straight into the Thumbnail field, so it's saved
    // exactly like a pasted URL would be.
    export async function handleTWCourseAdminThumbnailUpload(event) {
      const file = event.target.files && event.target.files[0];
      event.target.value = ''; // reset so choosing the same file again still fires 'change'
      if (!file) return;

      const statusEl = document.getElementById('tw-course-admin-thumbnail-upload-status');
      if (statusEl) { statusEl.textContent = 'Uploading…'; statusEl.style.color = 'var(--text-muted)'; }

      try {
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
        const path = `module-thumbnails/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: uploadError } = await supabaseClient.storage.from('tw-course-images').upload(path, file, { upsert: false, contentType: file.type || undefined });
        if (uploadError) throw uploadError;

        const { data } = supabaseClient.storage.from('tw-course-images').getPublicUrl(path);
        const url = data && data.publicUrl;
        if (!url) throw new Error('No public URL was returned for the uploaded file.');

        document.getElementById('tw-course-admin-thumbnail').value = url;
        if (statusEl) {
          statusEl.textContent = 'Uploaded!';
          statusEl.style.color = 'var(--accent-teal)';
          setTimeout(() => { if (statusEl.textContent === 'Uploaded!') statusEl.textContent = ''; }, 2500);
        }
      } catch (e) {
        console.error('Error uploading TW Bible Course thumbnail:', e.message);
        if (statusEl) { statusEl.textContent = 'Upload failed'; statusEl.style.color = '#b91c1c'; }
        alert('Could not upload that image: ' + e.message + '\n\nMake sure the "tw-course-images" storage bucket has been created in Supabase — see the SQL provided for this feature.');
      }
    }

    export function renderTWCourseAdminLessonRows() {
      const list = document.getElementById('tw-course-admin-lessons-list');
      if (!list) return;
      if (twCourseAdminLessonsState.length === 0) {
        list.innerHTML = `<div style="color:var(--text-muted); font-size:13px; margin-bottom:8px;">No lessons yet — add at least one before saving.</div>`;
      } else {
        list.innerHTML = twCourseAdminLessonsState.map((l, idx) => `
          <div class="book-admin-item-card session-drag-card"
               draggable="true"
               ondragstart="handleTWCourseAdminLessonDragStart(event, ${idx})"
               ondragover="handleTWCourseAdminLessonDragOver(event, ${idx})"
               ondragleave="handleTWCourseAdminLessonDragLeave(event)"
               ondrop="handleTWCourseAdminLessonDrop(event, ${idx})"
               ondragend="handleTWCourseAdminLessonDragEnd(event)">
            <div class="session-drag-handle" title="Drag to reorder">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="8" cy="6" r="1.6"/><circle cx="16" cy="6" r="1.6"/><circle cx="8" cy="12" r="1.6"/><circle cx="16" cy="12" r="1.6"/><circle cx="8" cy="18" r="1.6"/><circle cx="16" cy="18" r="1.6"/></svg>
              <span>Lesson ${idx + 1}</span>
            </div>
            <div class="book-admin-field-row">
              <div style="flex:1 1 100%;">
                <label>Lesson Title</label>
                <input type="text" class="input-field" style="margin-bottom:0;" value="${escapeHtml(l.title)}" oninput="updateTWCourseAdminLessonField(${idx}, 'title', this.value)" placeholder="e.g. Lesson 1: The Bible A Book for Today">
              </div>
            </div>
            <div class="book-admin-field-row">
              <div style="flex:1 1 100%;">
                <label>Lesson Content <span style="font-weight:400; color:var(--text-muted);">(optional written notes)</span></label>
                <div class="foundations-format-toolbar">
                  <button type="button" class="foundations-format-btn" title="Bold" onclick="applyTWCourseAdminFormat(${idx}, 'bold')"><strong>B</strong></button>
                  <button type="button" class="foundations-format-btn" title="Italic" onclick="applyTWCourseAdminFormat(${idx}, 'italic')"><em>I</em></button>
                  <button type="button" class="foundations-format-btn" title="Underline" onclick="applyTWCourseAdminFormat(${idx}, 'underline')"><u>U</u></button>
                  <button type="button" class="foundations-format-btn" title="Bulleted List" onclick="applyTWCourseAdminFormat(${idx}, 'bullet')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="9" y1="6" x2="20" y2="6"></line><line x1="9" y1="12" x2="20" y2="12"></line><line x1="9" y1="18" x2="20" y2="18"></line><circle cx="4" cy="6" r="1.4" fill="currentColor" stroke="none"></circle><circle cx="4" cy="12" r="1.4" fill="currentColor" stroke="none"></circle><circle cx="4" cy="18" r="1.4" fill="currentColor" stroke="none"></circle></svg></button>
                  <button type="button" class="foundations-format-btn" title="Insert Link" onclick="applyTWCourseAdminFormat(${idx}, 'link')">🔗</button>
                  <button type="button" class="foundations-format-btn" title="Upload a table (CSV or TSV file)" onclick="document.getElementById('tw-course-admin-table-upload-${idx}').click()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="1.5"></rect><line x1="3" y1="10" x2="21" y2="10"></line><line x1="3" y1="16" x2="21" y2="16"></line><line x1="10.5" y1="4" x2="10.5" y2="20"></line></svg></button>
                  <input type="file" id="tw-course-admin-table-upload-${idx}" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain" style="display:none;" onchange="handleTWCourseAdminTableUpload(event, ${idx})">
                </div>
                <textarea id="tw-course-admin-lesson-content-${idx}" class="input-field" style="margin-bottom:0; min-height:60px; resize:vertical; font-family:'Plus Jakarta Sans', sans-serif;" oninput="updateTWCourseAdminLessonField(${idx}, 'content', this.value)" onpaste="handleTWCourseAdminContentPaste(event, ${idx})" placeholder="One or two sentences describing this lesson.">${(l.content || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</textarea>
                <div style="color:var(--text-muted); font-size:11.5px; margin-top:4px;">Scripture references like "John 3:16" are bolded and linked automatically. Paste a copied spreadsheet range, or use the table icon to upload a CSV/TSV file, to drop in a table.</div>
              </div>
            </div>

            <div class="book-admin-field-row" style="align-items:center; justify-content:space-between; margin-top:6px;">
              <label style="margin:0;">Video <span style="font-weight:400; color:var(--text-muted);">(optional — add as many as you need)</span></label>
              <button type="button" class="page-btn" onclick="addTWCourseAdminVideoRow(${idx})">+ Add Video</button>
            </div>
            ${(l.video || []).length === 0 ? `<div style="color:var(--text-muted); font-size:12.5px; margin-bottom:8px;">No video yet.</div>` : (l.video || []).map((v, vIdx) => `
              <div class="book-admin-field-row">
                <div style="flex:1 1 130px;">
                  <input type="text" class="input-field" style="margin-bottom:0;" value="${(v.label || '').replace(/"/g, '&quot;')}" oninput="updateTWCourseAdminVideoField(${idx}, ${vIdx}, 'label', this.value)" placeholder="Label (optional)">
                </div>
                <div style="flex:2 1 200px;">
                  <input type="text" class="input-field" style="margin-bottom:0;" value="${(v.url || '').replace(/"/g, '&quot;')}" oninput="updateTWCourseAdminVideoField(${idx}, ${vIdx}, 'url', this.value)" placeholder="https://youtube.com/watch?v=...">
                </div>
                <div style="flex:0 1 90px;">
                  <input type="text" class="input-field" style="margin-bottom:0;" value="${(v.startTime || '').replace(/"/g, '&quot;')}" oninput="updateTWCourseAdminVideoField(${idx}, ${vIdx}, 'startTime', this.value)" placeholder="Start at" title="Where this video should start playing — e.g. 1:30. Leave blank to start at the beginning.">
                </div>
                <div>
                  <button type="button" class="page-btn" style="background:#fee2e2; color:#b91c1c; border-color:#fca5a5;" onclick="removeTWCourseAdminVideoRow(${idx}, ${vIdx})">Remove</button>
                </div>
              </div>
            `).join('')}

            <div class="book-admin-field-row" style="align-items:center; justify-content:space-between; margin-top:6px;">
              <label style="margin:0;">Audio <span style="font-weight:400; color:var(--text-muted);">(optional)</span></label>
              <button type="button" class="page-btn" onclick="addTWCourseAdminAudioRow(${idx})">+ Add Audio</button>
            </div>
            ${(l.audio || []).length === 0 ? `<div style="color:var(--text-muted); font-size:12.5px; margin-bottom:8px;">No audio yet.</div>` : (l.audio || []).map((a, aIdx) => `
              <div class="book-admin-field-row">
                <div style="flex:1 1 160px;">
                  <input type="text" class="input-field" style="margin-bottom:0;" value="${(a.label || '').replace(/"/g, '&quot;')}" oninput="updateTWCourseAdminAudioField(${idx}, ${aIdx}, 'label', this.value)" placeholder="Label (optional)">
                </div>
                <div style="flex:2 1 220px;">
                  <input type="text" class="input-field" style="margin-bottom:0;" value="${(a.url || '').replace(/"/g, '&quot;')}" oninput="updateTWCourseAdminAudioField(${idx}, ${aIdx}, 'url', this.value)" placeholder="https://... (mp3 link)">
                </div>
                <div>
                  <button type="button" class="page-btn" style="background:#fee2e2; color:#b91c1c; border-color:#fca5a5;" onclick="removeTWCourseAdminAudioRow(${idx}, ${aIdx})">Remove</button>
                </div>
              </div>`).join('')}

            <div class="book-admin-field-row" style="align-items:center; justify-content:space-between; margin-top:6px;">
              <label style="margin:0;">Lesson Resources <span style="font-weight:400; color:var(--text-muted);">(optional print links)</span></label>
              <button type="button" class="page-btn" onclick="addTWCourseAdminResourceRow(${idx})">+ Add Resource</button>
            </div>
            ${(l.resources || []).length === 0 ? `<div style="color:var(--text-muted); font-size:12.5px; margin-bottom:8px;">No resources yet.</div>` : (l.resources || []).map((r, rIdx) => `
              <div class="book-admin-field-row">
                <div style="flex:1 1 160px;">
                  <input type="text" class="input-field" style="margin-bottom:0;" value="${(r.label || '').replace(/"/g, '&quot;')}" oninput="updateTWCourseAdminResourceField(${idx}, ${rIdx}, 'label', this.value)" placeholder="e.g. Study Guide">
                </div>
                <div style="flex:2 1 220px;">
                  <input type="text" class="input-field" style="margin-bottom:0;" value="${(r.url || '').replace(/"/g, '&quot;')}" oninput="updateTWCourseAdminResourceField(${idx}, ${rIdx}, 'url', this.value)" placeholder="https://... (article or PDF link)">
                </div>
                <div>
                  <button type="button" class="page-btn" style="background:#fee2e2; color:#b91c1c; border-color:#fca5a5;" onclick="removeTWCourseAdminResourceRow(${idx}, ${rIdx})">Remove</button>
                </div>
              </div>`).join('')}

            <div class="book-admin-field-row" style="align-items:center; justify-content:space-between; margin-top:10px; padding-top:10px; border-top:1px solid var(--border-color);">
              <label style="margin:0;">Knowledge Check <span style="font-weight:400; color:var(--text-muted);">(required — every question below must be answered correctly, in order, to complete this lesson)</span></label>
              <button type="button" class="page-btn" onclick="addTWCourseAdminLessonQuiz(${idx})">+ Add Question</button>
            </div>
            ${(l.quizzes || []).length === 0
              ? `<div style="color:var(--text-muted); font-size:12.5px; margin-bottom:8px;">No Knowledge Check questions yet — until at least one's added, learners can't complete this lesson.</div>`
              : (l.quizzes || []).map((quiz, qIdx) => renderTWCourseAdminQuizEditor(idx, qIdx, quiz)).join('')}

            <div class="book-admin-field-row" style="justify-content:flex-end; margin-top:4px;">
              <button type="button" class="page-btn" onclick="duplicateTWCourseAdminLessonRow(${idx})">Duplicate this lesson</button>
              <button type="button" class="page-btn" style="background:#fee2e2; color:#b91c1c; border-color:#fca5a5;" onclick="removeTWCourseAdminLessonRow(${idx})">Remove this lesson</button>
            </div>
          </div>`).join('');
      }
      populateTWCourseAdminHeroVideoSelect();
    }

    export function addTWCourseAdminLessonRow() {
      // Stable id generated up front (not on save) so it survives reorders and is
      // ready to key completion state (twCourseProgress) the moment it's saved.
      twCourseAdminLessonsState.push({ id: `lesson_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, title: '', content: '', video: [], audio: [], resources: [], quizzes: [] });
      renderTWCourseAdminLessonRows();
    }

    export function removeTWCourseAdminLessonRow(idx) {
      twCourseAdminLessonsState.splice(idx, 1);
      renderTWCourseAdminLessonRows();
    }

    // Clones every field of a lesson — title, content, video/audio/resource
    // rows, and every Knowledge Check question — into a new lesson inserted
    // right after the original, so an admin can start a similar lesson from a
    // known-good one instead of rebuilding it by hand. Gets a fresh stable id
    // (never reuses the original's) so completion tracking never confuses the
    // two once this is saved, and the copy's title is marked so it's obvious
    // which one to go edit.
    export function duplicateTWCourseAdminLessonRow(idx) {
      const original = twCourseAdminLessonsState[idx];
      if (!original) return;
      const clone = JSON.parse(JSON.stringify(original));
      clone.id = `lesson_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      clone.title = clone.title ? `${clone.title} (Copy)` : 'Untitled Lesson (Copy)';
      twCourseAdminLessonsState.splice(idx + 1, 0, clone);
      renderTWCourseAdminLessonRows();
    }

    export function updateTWCourseAdminLessonField(idx, field, value) {
      if (!twCourseAdminLessonsState[idx]) return;
      twCourseAdminLessonsState[idx][field] = value;
    }

    // --- Drag-and-drop reordering of a module's lessons — uses the shared
    // makeAdminDragReorder factory (defined further down, alongside "By the
    // Book"'s own use of it) so this, Core-D's sessions, and "By the Book"'s
    // sessions all share one implementation instead of three parallel copies. ---
    export const twLessonDragReorder = makeAdminDragReorder(() => twCourseAdminLessonsState, renderTWCourseAdminLessonRows, 'tw-course-admin-lessons-list');

    export function handleTWCourseAdminLessonDragStart(event, idx) { twLessonDragReorder.dragStart(event, idx); }
    export function handleTWCourseAdminLessonDragOver(event, idx) { twLessonDragReorder.dragOver(event, idx); }
    export function handleTWCourseAdminLessonDragLeave(event) { twLessonDragReorder.dragLeave(event); }
    export function handleTWCourseAdminLessonDrop(event, idx) { twLessonDragReorder.drop(event, idx); }
    export function handleTWCourseAdminLessonDragEnd(event) { twLessonDragReorder.dragEnd(); }

    // --- Per-lesson video editing (label/url only now — Knowledge Checks live
    // at the lesson level below, not per-video). ---
    export function addTWCourseAdminVideoRow(lessonIdx) {
      if (!twCourseAdminLessonsState[lessonIdx]) return;
      twCourseAdminLessonsState[lessonIdx].video.push({ label: '', url: '', startTime: '' });
      renderTWCourseAdminLessonRows();
    }

    export function removeTWCourseAdminVideoRow(lessonIdx, videoIdx) {
      if (!twCourseAdminLessonsState[lessonIdx]) return;
      twCourseAdminLessonsState[lessonIdx].video.splice(videoIdx, 1);
      renderTWCourseAdminLessonRows();
    }

    export function updateTWCourseAdminVideoField(lessonIdx, videoIdx, field, value) {
      if (!twCourseAdminLessonsState[lessonIdx] || !twCourseAdminLessonsState[lessonIdx].video[videoIdx]) return;
      twCourseAdminLessonsState[lessonIdx].video[videoIdx][field] = value;
    }


    // --- Lesson-level Knowledge Check editing — the required gate for
    // completing a lesson. A lesson can now hold MULTIPLE questions
    // (lesson.quizzes is an array); every one must be answered correctly, in
    // order, to complete the lesson. Shown at the end of the lesson card. ---
    export const twLessonQuizController = makeAdminQuizArrayController(lessonIdx => twCourseAdminLessonsState[lessonIdx]);

    export function addTWCourseAdminLessonQuiz(lessonIdx) {
      twLessonQuizController.add(lessonIdx);
      renderTWCourseAdminLessonRows();
    }

    export function removeTWCourseAdminLessonQuiz(lessonIdx, quizIdx) {
      twLessonQuizController.remove(lessonIdx, quizIdx);
      renderTWCourseAdminLessonRows();
    }

    export function updateTWCourseAdminQuizField(lessonIdx, quizIdx, field, value) {
      twLessonQuizController.updateField(lessonIdx, quizIdx, field, value);
    }

    export function updateTWCourseAdminQuizOption(lessonIdx, quizIdx, optIdx, value) {
      twLessonQuizController.updateOption(lessonIdx, quizIdx, optIdx, value);
    }

    export function setTWCourseAdminQuizCorrect(lessonIdx, quizIdx, optIdx) {
      twLessonQuizController.setCorrect(lessonIdx, quizIdx, optIdx);
    }

    export function renderTWCourseAdminQuizEditor(lIdx, qIdx, quiz) {
      return renderAdminQuizEditorBlock({
        idxA: lIdx, idxB: qIdx, quiz,
        headerLabel: `Question ${qIdx + 1}`,
        removeButtonLabel: 'Remove this question',
        removeFnName: 'removeTWCourseAdminLessonQuiz',
        updateFieldFnName: 'updateTWCourseAdminQuizField',
        updateOptionFnName: 'updateTWCourseAdminQuizOption',
        setCorrectFnName: 'setTWCourseAdminQuizCorrect',
        questionPlaceholder: 'Question shown at the end of this lesson',
        helperText: 'Fill in at least 2 options and mark the correct one. The learner must answer CORRECTLY to move on — there\'s no way to skip past it.',
        explanationPlaceholder: 'Brief explanation shown once they get it right (optional)',
        radioName: `twq-correct-${lIdx}-${qIdx}`
      });
    }


    // --- Lightweight formatting toolbar for a lesson's "Lesson Content"
    // textarea — thin wrappers over the shared functions above, pointed at
    // this screen's own textarea id and admin-state update function. ---
    export function applyTWCourseAdminFormat(idx, kind) {
      applyContentFormat(
        document.getElementById(`tw-course-admin-lesson-content-${idx}`),
        (value) => updateTWCourseAdminLessonField(idx, 'content', value),
        kind
      );
    }

    export function insertTWCourseAdminTableAtCursor(idx, rows) {
      insertTableAtCursor(
        document.getElementById(`tw-course-admin-lesson-content-${idx}`),
        (value) => updateTWCourseAdminLessonField(idx, 'content', value),
        rows
      );
    }

    export function handleTWCourseAdminContentPaste(event, idx) {
      handleContentPaste(
        event,
        document.getElementById(`tw-course-admin-lesson-content-${idx}`),
        (value) => updateTWCourseAdminLessonField(idx, 'content', value)
      );
    }

    export function handleTWCourseAdminTableUpload(event, idx) {
      handleTableUpload(
        event,
        document.getElementById(`tw-course-admin-lesson-content-${idx}`),
        (value) => updateTWCourseAdminLessonField(idx, 'content', value)
      );
    }

    export function addTWCourseAdminAudioRow(lessonIdx) {
      if (!twCourseAdminLessonsState[lessonIdx]) return;
      twCourseAdminLessonsState[lessonIdx].audio.push({ label: '', url: '' });
      renderTWCourseAdminLessonRows();
    }
    export function removeTWCourseAdminAudioRow(lessonIdx, audioIdx) {
      if (!twCourseAdminLessonsState[lessonIdx]) return;
      twCourseAdminLessonsState[lessonIdx].audio.splice(audioIdx, 1);
      renderTWCourseAdminLessonRows();
    }
    export function updateTWCourseAdminAudioField(lessonIdx, audioIdx, field, value) {
      if (!twCourseAdminLessonsState[lessonIdx] || !twCourseAdminLessonsState[lessonIdx].audio[audioIdx]) return;
      twCourseAdminLessonsState[lessonIdx].audio[audioIdx][field] = value;
    }

    export function addTWCourseAdminResourceRow(lessonIdx) {
      if (!twCourseAdminLessonsState[lessonIdx]) return;
      twCourseAdminLessonsState[lessonIdx].resources.push({ label: '', url: '' });
      renderTWCourseAdminLessonRows();
    }
    export function removeTWCourseAdminResourceRow(lessonIdx, resIdx) {
      if (!twCourseAdminLessonsState[lessonIdx]) return;
      twCourseAdminLessonsState[lessonIdx].resources.splice(resIdx, 1);
      renderTWCourseAdminLessonRows();
    }
    export function updateTWCourseAdminResourceField(lessonIdx, resIdx, field, value) {
      if (!twCourseAdminLessonsState[lessonIdx] || !twCourseAdminLessonsState[lessonIdx].resources[resIdx]) return;
      twCourseAdminLessonsState[lessonIdx].resources[resIdx][field] = value;
    }

    export async function saveTWCourseAdminModule() {
      if (!currentUser || !currentUser.isAdmin) return;

      const idVal = document.getElementById('tw-course-admin-select').value;
      const title = document.getElementById('tw-course-admin-title').value.trim();
      if (!title) { alert('Give this module a title.'); return; }
      if (twCourseAdminLessonsState.length === 0) { alert('Add at least one lesson.'); return; }
      if (twCourseAdminLessonsState.some(l => !l.title.trim())) { alert('Every lesson needs a title.'); return; }

      const existingMod = idVal ? twBibleCourseData.find(m => m.id === idVal) : null;
      // Once ANY module is saved to the DB, loadTWBibleCourseFromDB() treats the DB as
      // the wholesale source of truth on every future load — so if nothing's in the DB
      // yet, this save is about to become the first row, and every other still-hardcoded
      // module (never saved) would otherwise vanish on the next reload while still
      // appearing here until then. Replacing the in-memory list now keeps this screen
      // consistent with what a reload will actually show.
      const hadNoDbModulesYet = !twBibleCourseData.some(m => m.dbId);

      const lessons = twCourseAdminLessonsState.map(l => {
        const out = {
          id: l.id,
          title: l.title.trim(),
          content: (l.content || '').trim(),
          video: (l.video || [])
            .filter(v => (v.label || '').trim() || (v.url || '').trim())
            .map(v => ({ label: (v.label || '').trim(), url: (v.url || '').trim(), startSeconds: parseTimeToSeconds(v.startTime) })),
          audio: (l.audio || [])
            .filter(a => (a.label || '').trim() || (a.url || '').trim())
            .map(a => ({ label: (a.label || '').trim(), url: (a.url || '').trim() })),
          resources: (l.resources || [])
            .filter(r => (r.label || '').trim() || (r.url || '').trim())
            .map(r => ({ label: (r.label || '').trim(), url: (r.url || '').trim() }))
        };
        out.quizzes = (l.quizzes || [])
          .filter(q => (q.question || '').trim() && (q.options || []).filter(o => (o || '').trim()).length >= 2)
          .map(q => ({
            question: q.question.trim(),
            options: q.options.map(o => (o || '').trim()),
            correctIndex: q.correctIndex || 0,
            explanation: (q.explanation || '').trim()
          }));
        return out;
      });

      let heroSessionIndex = null, heroVideoIndex = null;
      if (twCourseAdminHeroVideoValue) {
        const [hs, hv] = twCourseAdminHeroVideoValue.split(':').map(n => parseInt(n, 10));
        if (Number.isInteger(hs) && Number.isInteger(hv)) { heroSessionIndex = hs; heroVideoIndex = hv; }
      }

      const payload = {
        title: title,
        order_index: parseInt(document.getElementById('tw-course-admin-order').value, 10) || 0,
        presenter: document.getElementById('tw-course-admin-presenter').value.trim(),
        presenter_photo_url: document.getElementById('tw-course-admin-presenter-photo').value.trim(),
        thumbnail_url: document.getElementById('tw-course-admin-thumbnail').value.trim(),
        hero_session_index: heroSessionIndex,
        hero_video_index: heroVideoIndex,
        lessons: lessons,
        updated_at: new Date().toISOString()
      };
      if (existingMod && existingMod.dbId) payload.id = existingMod.dbId;

      const { data, error } = await twBibleCourseModulesTable.upsert(
        payload,
        'id, title, order_index, presenter, presenter_photo_url, thumbnail_url, hero_session_index, hero_video_index, lessons'
      );

      if (error) {
        console.error('Error saving TW Bible Course module:', error.message);
        alert('Could not save: ' + error.message + '\n\nMake sure the tw_bible_course_modules table has been created (and has the newer presenter/thumbnail/hero-video columns) in Supabase — see the comment above loadTWBibleCourseFromDB in this file for the SQL.');
        return;
      }

      const saved = {
        id: `dbmod-${data.id}`,
        dbId: data.id,
        title: data.title || '',
        orderIndex: data.order_index || 0,
        presenter: data.presenter || '',
        presenterPhotoUrl: data.presenter_photo_url || '',
        thumbnailUrl: data.thumbnail_url || '',
        heroSessionIndex: Number.isInteger(data.hero_session_index) ? data.hero_session_index : null,
        heroVideoIndex: Number.isInteger(data.hero_video_index) ? data.hero_video_index : null,
        lessons: Array.isArray(data.lessons) ? data.lessons : []
      };

      if (hadNoDbModulesYet) {
        twBibleCourseData = [saved];
      } else {
        const existingIdx = existingMod ? twBibleCourseData.findIndex(m => m.id === existingMod.id) : -1;
        if (existingIdx >= 0) twBibleCourseData[existingIdx] = saved;
        else twBibleCourseData.push(saved);
      }

      updateStudyNotificationBadges();
      alert(hadNoDbModulesYet
        ? `Saved! "${saved.title}" is now live for everyone. Since this is the first module saved to the database, it now replaces the built-in default course — use "Import Existing Course Content" above if you'd like to bring the other built-in modules in too.`
        : `Saved! "${saved.title}" is now live for everyone.`);
      closeTWCourseAdminView();
      switchStudySubTab('course');
    }

    export async function deleteTWCourseAdminModule() {
      if (!currentUser || !currentUser.isAdmin) return;
      const idVal = document.getElementById('tw-course-admin-select').value;
      if (!idVal) return;
      const mod = twBibleCourseData.find(m => m.id === idVal);
      if (!mod || !mod.dbId) return;
      if (!confirm(`Delete "${mod.title}"? This can't be undone.`)) return;

      const { error } = await twBibleCourseModulesTable.remove(mod.dbId);
      if (error) {
        console.error('Error deleting TW Bible Course module:', error.message);
        alert('Could not delete: ' + error.message);
        return;
      }

      twBibleCourseData = twBibleCourseData.filter(m => m.id !== mod.id);
      // No DB modules left at all — fall back to the hardcoded default again, same as
      // what a fresh page load would now show.
      if (!twBibleCourseData.some(m => m.dbId)) twBibleCourseData = TW_BIBLE_COURSE_BUILTIN_DEFAULT;
      updateStudyNotificationBadges();
      openTWCourseAdminView();
    }

    export async function importHardcodedTWCourseToDB() {
      if (!currentUser || !currentUser.isAdmin) return;
      if (twBibleCourseData.some(m => m.dbId)) {
        alert('Nothing to import — course content is already in the database.');
        return;
      }
      if (!confirm(`Import ${TW_BIBLE_COURSE_BUILTIN_DEFAULT.length} built-in module(s) into the database?`)) return;

      const rows = TW_BIBLE_COURSE_BUILTIN_DEFAULT.map((mod, idx) => ({
        title: mod.title,
        order_index: idx,
        lessons: mod.lessons.map(l => ({ id: l.id, title: l.title, content: l.content, video: l.video || [], audio: l.audio || [], resources: l.resources || [], quizzes: l.quizzes || [] })),
        updated_at: new Date().toISOString()
      }));

      const { data, error } = await twBibleCourseModulesTable.insertMany(
        rows,
        'id, title, order_index, presenter, presenter_photo_url, thumbnail_url, hero_session_index, hero_video_index, lessons'
      );

      if (error) {
        console.error('Error importing existing TW Bible Course content:', error.message);
        alert('Import failed: ' + error.message + '\n\nMake sure the tw_bible_course_modules table has been created in Supabase (see the comment above loadTWBibleCourseFromDB in this file for the SQL).');
        return;
      }

      twBibleCourseData = (data || []).map(r => ({
        id: `dbmod-${r.id}`,
        dbId: r.id,
        title: r.title || '',
        orderIndex: r.order_index || 0,
        presenter: r.presenter || '',
        presenterPhotoUrl: r.presenter_photo_url || '',
        thumbnailUrl: r.thumbnail_url || '',
        heroSessionIndex: Number.isInteger(r.hero_session_index) ? r.hero_session_index : null,
        heroVideoIndex: Number.isInteger(r.hero_video_index) ? r.hero_video_index : null,
        lessons: Array.isArray(r.lessons) ? r.lessons : []
      }));

      updateStudyNotificationBadges();
      renderTWModuleList();
      openTWCourseAdminView();
      alert(`Imported ${data ? data.length : rows.length} module(s). They're now editable from this screen.`);
    }
