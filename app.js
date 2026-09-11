import {
  fetchAllRows, createTableAccessor,
  readingSchedulesTable, twCourseProgressTable, churchResourcesTable,
  cordMessagesTable, cordMembersTable, marginNotesTable, recordsTable,
  userReadingPlansTable, userReadingProgressTable, userResourceClicksTable,
  profilesTable
} from './core/db.js';
import {
  makeAdminDragReorder, makeAdminQuizArrayController, renderAdminQuizEditorBlock,
  foundationsRowsToMarkdownTable, foundationsParseDelimitedText, htmlToFoundationsMarkdown,
  insertConvertedTextAtCursor, insertTableAtCursor, applyContentFormat,
  handleContentPaste, handleTableUpload
} from './shared/adminUtils.js';
import {
  getYouTubeVideoId, getYouTubeThumbnailUrl, isDirectImageUrl, isDirectVideoUrl,
  parseTimeToSeconds, formatSecondsToTimeInput, toYouTubeEmbedUrl, toYouTubeMutedPreviewEmbedUrl,
  activeMediaController, miniPlayerWatcherId, getNativeMediaTitle, getMiniPlayerElement,
  handleMediaStarted, pauseMediaController, clearActiveMedia, updateMiniPlayerPlayPauseIcon,
  setupMiniPlayerMarquee, positionMiniPlayer, updateMiniPlayerVisibility,
  startMiniPlayerVisibilityWatcher, stopMiniPlayerVisibilityWatcher, toggleMiniPlayerPlayback,
  stopMiniPlayerMedia, youTubeApiReadyPromise, ensureYouTubeApiLoaded,
  fsvState, FSV_PLAY_SVG, FSV_PAUSE_SVG, FSV_SHRINK_SVG, FSV_EXPAND_SVG,
  openFsvPlayer, toggleFsvMiniMode, applyFsvMiniMode, handleFsvTap,
  fsvUpdatePlaylistToggleVisibility, fsvLoadCurrentVideo, showFsvAutoplayFallback,
  hideFsvAutoplayFallback, fsvStartFromFallback, fsvSetPlayPauseIcon, fsvTogglePlayPause,
  fsvSkip, fsvStop, fsvBackTrack, fsvForwardTrack, fsvJumpTo, fsvRenderPlaylist,
  toggleFsvPlaylist, fsvClosePlaylist, toggleFsvControls, fsvShowControls, closeFsvPlayer,
  fsvKcState, showFsvKnowledgeCheck, hideFsvKnowledgeCheck, answerFsvKnowledgeCheck,
  continueAfterFsvKnowledgeCheck, rewatchFsvClip
} from './shared/videoPlayer.js';
import {
  FOUNDATIONS_AUDIO_ICON_SVG, FOUNDATIONS_BLOCK_CHUNK_RE, FOUNDATIONS_CATEGORY_PALETTE,
  FOUNDATIONS_SESSION_TITLE_PLACEHOLDER,
  FOUNDATIONS_TABLE_SEPARATOR_RE, FOUNDATIONS_VIDEO_ICON_SVG, activeFoundationsItemId,
  addFoundationsAdminAudioRow, addFoundationsAdminResourceRow,
  addFoundationsAdminSessionQuiz, addFoundationsAdminSessionRow,
  addFoundationsAdminVideoRow, advanceFoundationsInlineKnowledgeCheck,
  answerFoundationsInlineKnowledgeCheck, applyFoundationsFormat, applyFoundationsMarkup,
  clearFoundationsFilters, closeFoundationsAdminView, closeFoundationsItem,
  convertFoundationsBulletLists, convertFoundationsTables, deleteFoundationsAdminItem,
  escapeFoundationsHtml, focusFoundationsSearch, foundationsAdminHeroVideoValue,
  foundationsAdminSessionsState, foundationsAdminSuggestedIds, foundationsCardThumbHtml,
  foundationsCategoryColor, foundationsCategoryFilter, foundationsCategoryHash,
  foundationsContentTable, foundationsInlineKcIndex, foundationsList,
  foundationsMediaItemAccordionHtml, foundationsNxCardHtml, foundationsNxThumbHtml,
  foundationsOpenMediaKeys, foundationsSearchTerm, foundationsSessionAccordionHtml,
  foundationsSessionDragReorder, foundationsSessionQuizController,
  foundationsSplitDelimitedLine, foundationsSplitTableRow, foundationsSuggestionsHtml,
  foundationsTableColumnAligns, getFoundationsCategories, getFoundationsHeroVideo,
  getLiveFoundationsItems, handleFoundationsAdminPresenterPick,
  handleFoundationsAdminSelectChange, handleFoundationsContentPaste,
  handleFoundationsSessionDragEnd, handleFoundationsSessionDragLeave,
  handleFoundationsSessionDragOver, handleFoundationsSessionDragStart,
  handleFoundationsSessionDrop, handleFoundationsSessionPresenterPick,
  handleFoundationsTableUpload, insertFoundationsTableAtCursor,
  linkifyScriptureReferences, loadFoundationsContent, navigateToVerseReference,
  normalizeFoundationsMediaList, normalizeFoundationsQuiz, openFoundationsAdminView,
  openFoundationsItem, openFoundationsSessionIndex, openFoundationsVideoPlayer,
  populateFoundationsAdminHeroVideoSelect, removeFoundationsAdminAudioRow,
  removeFoundationsAdminResourceRow, removeFoundationsAdminSessionQuiz,
  removeFoundationsAdminSessionRow, removeFoundationsAdminVideoRow,
  renderFoundationsAdminQuizEditor, renderFoundationsAdminSessionQuizEditor,
  renderFoundationsAdminSessionRows, renderFoundationsAdminSuggestionsList,
  renderFoundationsContentHtml, renderFoundationsDetailPanel,
  renderFoundationsInlineKnowledgeCheck, renderFoundationsList, renderFoundationsPills,
  renderFoundationsTab, saveFoundationsAdminForm, scrollFoundationsRow,
  selectFoundationsCategory, setFoundationsAdminQuizCorrect,
  setFoundationsAdminSessionQuizCorrect, sizeFoundationsHeroVideoBg,
  toggleFoundationsAdminSuggestion, toggleFoundationsAdminVideoQuiz,
  toggleFoundationsMediaItem, toggleFoundationsSession, updateFoundationsAdminAudioField,
  updateFoundationsAdminHeroVideoValue, updateFoundationsAdminQuizField,
  updateFoundationsAdminQuizOption, updateFoundationsAdminResourceField,
  updateFoundationsAdminSessionField, updateFoundationsAdminSessionQuizField,
  updateFoundationsAdminSessionQuizOption, updateFoundationsAdminVideoField
} from './shared/coreD.js';

// The other half of the circular dependency described in videoPlayer.js's
// header comment: it needs escapeHtml from here (foundationsList now comes
// from shared/coreD.js instead, imported above).
export { escapeHtml };

// The other half of the twBibleCourse.js circular dependency (see its header
// comment): it needs these from here too. (escapeHtml, fixMojibakeText,
// switchStudySubTab, switchTab, updateStudyNotificationBadges, and
// currentUser are ALSO needed by it, but are already exported above/below;
// the four Core-D rendering helpers it also needs now come from
// shared/coreD.js instead of here, imported above.)
export { checkTWCourseCompletionBadges, checkTWModuleCompletionBadges };

// A TW Bible Course lesson can hold MULTIPLE Knowledge Check questions
// (unlike Foundations' single per-video quiz) — every one must be answered
// correctly, in order, to complete the lesson. Accepts either the current
// array shape or an older single-object `quiz` value for back-compat, and
// drops any question that doesn't have a real question + at least 2
// non-empty options. Lives here (rather than in coreD.js or
// twBibleCourse.js) because neither module is exclusively "home" for a
// validator both genuinely need — it just wraps coreD.js's own
// normalizeFoundationsQuiz for TW's array-of-quizzes shape.
export function normalizeTWLessonQuizzes(value) {
  const raw = Array.isArray(value) ? value : (value ? [value] : []);
  return raw.map(q => normalizeFoundationsQuiz(q)).filter(Boolean);
}
import {
  BOOK_ADMIN_TYPE_PLACEHOLDERS, NT_GROUP_ORDER, OT_GROUP_ORDER, activeBibleStudyBook,
  activeStudyPresenterFilter, activeStudyTypeFilter, addBookAdminPresenterRow,
  addBookAdminSessionRow, bibleStudyBooksTable, bibleStudyDbBooks,
  bibleStudyRulerMetrics, bibleStudyRulerScrollBound, bookAdminPresentersState,
  bookAdminSessionsState, bookSessionDragReorder, bookShelfGroupsList,
  bookShelfGroupsTable, clearStudyPresenterFilter, closeBookAdminView,
  deleteBookAdminContent, deleteBookAdminShelfGroup, drawDimLineSvg,
  getBibleStudyBookConfig, getSessionFilterType, getSessionPresenterName, getSessionType,
  handleBookAdminPresenterPick, handleBookAdminSelectChange,
  handleBookAdminShelfGroupChange, handleBookSpineClick, handleSessionAdminPresenterPick,
  handleSessionDragEnd, handleSessionDragLeave, handleSessionDragOver,
  handleSessionDragStart, handleSessionDrop, importHardcodedBooksToDB,
  loadBibleStudyBooksFromDB, loadBookShelfGroups, loadStudyPresenters, openBookAdminView,
  openBookVideoPlayer, populateBookAdminShelfGroupSelect,
  populateStudyPresenterDropdowns, positionDimLabel, removeBookAdminPresenterRow,
  removeBookAdminSessionRow, renderBibleStudyColorLegend, renderBibleStudyInfoPanel,
  renderBibleStudyRuler, renderBibleStudyShelf, renderBookAdminPresenterRows,
  renderBookAdminSessionRows, saveBookAdminForm,
  seedStudyPresentersFromExistingBooksIfEmpty, selectBibleStudyBook,
  selectBibleStudyBookFromDropdown, selectStudyView, setActiveStudyFilters,
  sortGroupsByCanonicalOrder, studyPresentersList, studyPresentersLoadError,
  studyPresentersTable, toggleStudyPresenterFilter, updateBibleStudyDimLabels,
  updateBookAdminPresenterField, updateBookAdminSessionField,
  updateBookShelfGroupColorHeight, upsertStudyPresenter
} from './shared/byTheBook.js';
import {
  TW_BIBLE_COURSE_BUILTIN_DEFAULT, TW_CHECK_SVG, TW_LOCK_SVG, activeTWModuleId,
  addTWCourseAdminAudioRow, addTWCourseAdminLessonQuiz, addTWCourseAdminLessonRow,
  addTWCourseAdminResourceRow, addTWCourseAdminVideoRow, answerTWInlineKnowledgeCheck,
  applyTWCourseAdminFormat, closeTWCourseAdminView, closeTWCourseCompletionModal,
  closeTWModule, deleteTWCourseAdminModule, duplicateTWCourseAdminLessonRow,
  getTWCourseTotals, getTWModuleHeroVideo, handleTWCourseAdminContentPaste,
  handleTWCourseAdminLessonDragEnd, handleTWCourseAdminLessonDragLeave,
  handleTWCourseAdminLessonDragOver, handleTWCourseAdminLessonDragStart,
  handleTWCourseAdminLessonDrop, handleTWCourseAdminSelectChange,
  handleTWCourseAdminTableUpload, handleTWCourseAdminThumbnailUpload,
  importHardcodedTWCourseToDB, insertTWCourseAdminTableAtCursor, isTWLessonUnlocked,
  isTWModuleUnlocked, isTWModuleUnlockedById, loadTWBibleCourseFromDB,
  loadTWCourseProgress, markTWLessonComplete, maybeShowTWCourseCompletionModal,
  openTWCourseAdminView, openTWLessonIndex, openTWLessonVideo, openTWModule,
  populateTWCourseAdminHeroVideoSelect, removeTWCourseAdminAudioRow,
  removeTWCourseAdminLessonQuiz, removeTWCourseAdminLessonRow,
  removeTWCourseAdminResourceRow, removeTWCourseAdminVideoRow, renderTWBibleCourse,
  renderTWCourseAdminLessonRows, renderTWCourseAdminQuizEditor,
  renderTWInlineKnowledgeCheck, renderTWModuleDetailPanel, renderTWModuleList,
  saveTWCourseAdminModule, saveTWLessonProgress, setTWCourseAdminQuizCorrect,
  toggleTWLesson, toggleTWMediaItem, twBibleCourseData, twBibleCourseModulesTable,
  twCourseAdminHeroVideoValue, twCourseAdminLessonsState, twCourseProgress,
  twInlineKcIndex, twLessonAccordionHtml, twLessonDragReorder, twLessonQuizController,
  twOpenMediaKeys, updateTWCourseAdminAudioField, updateTWCourseAdminHeroVideoValue,
  updateTWCourseAdminLessonField, updateTWCourseAdminQuizField,
  updateTWCourseAdminQuizOption, updateTWCourseAdminResourceField,
  updateTWCourseAdminVideoField
} from './shared/twBibleCourse.js';



// The other half of THIS circular dependency (see byTheBook.js's header comment):
// it needs these from here too. (shareBookSession, markBookResourceClicked, switchTab,
// switchStudySubTab, initAudio, togglePlay, resetPlayButton, skipAudio, updateProgress,
// and seekAudio are ALSO needed by byTheBook.js, but don't need listing again here --
// they're already in the big onclick-driven export list below, and a name can only be
// exported once from a module.)
export {
  fixMojibakeText, updateStudyNotificationBadges, BIBLE_STUDIES_BOOK_ORDER,
  BIBLE_STUDIES_DATA, BIBLE_STUDIES_DEFAULT_COLORS, BIBLE_STUDIES_DEFAULT_HEIGHTS,
  OT_BOOK_COUNT, currentUser
};


    let isSignUpMode = false;
    let currentUser = null;
    // True once initializeApp() has run to completion at least once this page load
    // (as a guest or signed in — whichever happens first). Signing in mid-session
    // as a guest must NOT re-run the whole public-content startup sequence again.
    let appHasInitialized = false;
    let currentBibleVerses = [];
    let keywordResults = [];
    let currentPage = 1;
    const RESULTS_PER_PAGE = 20;
    // True whenever the Note tab's #bible-text is showing keyword search results
    // (a list of clickable reference links) rather than the normal verse grid.
    // The 10-second live-sync poll used to overwrite #bible-text with the
    // currently-loaded chapter regardless of what was on screen, so a search
    // result list — and the reference link the user was about to click — could
    // vanish out from under them mid-click. See isLiveSyncRenderUnsafe().
    let isSearchResultsShowing = false;

    let cachedScheduleDays = [];
    let currentPlanSubTab = 'reading'; 
    let currentPlanStartDate = null;
    let currentPlanViewDayNumber = null;
    let calendarViewYear = null;
    let calendarViewMonth = null;
    let readingNotificationMessage = null; // current message text, or null if nothing to show
    let readingNotificationSeen = false;   // cleared (badge hidden) once the Reading Plan tab is opened
    let lastSeenReadingMessage = null;     // used to detect genuinely NEW messages so the badge can return
    let isReadingNotifCollapsed = false;
    let isNotesCollapsed = false;
    let isResourcesCollapsed = true;

    // --- Daily Reading "listen aloud" (Read tab) state ---
    let dailyReadingTtsActive = false;      // true while a session is ongoing at all (speaking, paused, or the continue-prompt is up)
    let dailyReadingTtsPaused = false;      // true only while actively paused mid-session (speechSynthesis.pause()'d, not stopped) — meaningless unless dailyReadingTtsActive is also true
    // Bumped every time the flow is deliberately stopped/reset. Any in-flight utterance
    // event or pending timer captures the token at its own start and checks it before
    // acting, so a stale callback from a session the user already cancelled (by hitting
    // stop, changing days, or leaving the tab) can detect that and quietly no-op instead
    // of resurrecting a flow the user meant to end.
    let dailyReadingTtsSessionToken = 0;
    let dailyReadingContinueCountdownInterval = null;
    let dailyReadingContinueTimeoutHandle = null;

    // --- Daily Reading rewind/fast-forward state ---
    // The Web Speech API has no seek/currentTime — a SpeechSynthesisUtterance is
    // just "speak this string", with no way to jump to a position within audio
    // that's already being synthesized. So "skip 10 seconds" is approximated by
    // estimating how far into the passage the voice has gotten (from elapsed
    // wall-clock time, banked across any pause/resume cycles — see
    // pauseDailyReadingTts/resumeDailyReadingTts) and starting a brand new
    // utterance from that estimated point in the text instead. See
    // skipDailyReadingTts for the actual skip logic.
    let dailyReadingFullText = '';        // the complete (sup-stripped) passage text for the day currently being read
    let dailyReadingSpokenOffset = 0;     // char offset into dailyReadingFullText where the CURRENT utterance begins
    let dailyReadingSegmentStartTime = 0; // Date.now() when the current unpaused speaking segment began
    let dailyReadingElapsedMs = 0;        // banked elapsed speaking time (ms) for the current utterance, across any pause/resume cycles before this segment
    // Rough estimate at this feature's rate of 0.90 (~2.1 words/sec at a natural
    // reading pace, ~6 characters per word including the trailing space) — not
    // exact (voices and rates vary), just close enough for a "skip" gesture.
    const TTS_ESTIMATED_CHARS_PER_SECOND = 13;

    const bibleCache = {};
    let cachedChaptersList = null;
    let pendingShareTarget = null; // {type: 'verse'|'resource'|'book_session'|'foundations_class'|'foundations_session', ref, t, id, book, i} — captured from a shared link
    let originalShareUrl = null;  // full URL including ?share=... params, preserved for post-signup redirect

    let churchResourcesMap = {}; // Will now hold Arrays of resources per rowIndex

    // DB id of the Church Resource currently open for editing (admins only), or null
    // when nothing is being edited. A resource can render in two places at once — its
    // verse's Church Resources column in the Note view, and its book's list under
    // Line Upon Line — so this is checked by both renderers (see
    // renderChurchResourceEditFormHtml) rather than tracked per-view.
    let editingChurchResourceId = null;

    let liveSyncTimer = null;
    let isUserTyping = false;

    // --- SUPABASE SCHEMA CONFIG ---
    // Maps the short code shown in dropdowns to the actual (quoted) column name in the `verses` table.
    const TRANSLATIONS = [
      { code: 'ASV', column: 'American Standard Version' },
      { code: 'KJV', column: 'King James Version' },
      { code: 'WEB', column: 'World English Bible' }
    ];
    const DEFAULT_TRANSLATION = 'KJV';
    function translationColumn(code) {
      const t = TRANSLATIONS.find(t => t.code === code);
      return t ? t.column : TRANSLATIONS[0].column;
    }

    // Reading-plan passage text (e.g. "Gen 1-3", "Amo 8-9; Oba") uses abbreviated book
    // names, while the `verses` table uses full names. This maps between them.
    const BOOK_ABBREV_MAP = {
      'Gen': 'Genesis', 'Ex': 'Exodus', 'Lev': 'Leviticus', 'Num': 'Numbers', 'Deut': 'Deuteronomy',
      'Josh': 'Joshua', 'Jdg': 'Judges', 'Rut': 'Ruth', '1 Sa': '1 Samuel', '2 Sa': '2 Samuel',
      '1 Kgs': '1 Kings', '2 Kgs': '2 Kings', '1 Chr': '1 Chronicles', '2 Chr': '2 Chronicles',
      'Ezr': 'Ezra', 'Neh': 'Nehemiah', 'Est': 'Esther', 'Job': 'Job', 'Ps': 'Psalm',
      'Pro': 'Proverbs', 'Ecc': 'Ecclesiastes', 'Sos': 'Song of Solomon', 'Isa': 'Isaiah',
      'Jer': 'Jeremiah', 'Lam': 'Lamentations', 'Eze': 'Ezekiel', 'Dan': 'Daniel', 'Hos': 'Hosea',
      'Joe': 'Joel', 'Amo': 'Amos', 'Oba': 'Obadiah', 'Jon': 'Jonah', 'Mic': 'Micah', 'Nah': 'Nahum',
      'Hab': 'Habakkuk', 'Zep': 'Zephaniah', 'Hag': 'Haggai', 'Zec': 'Zechariah', 'Mal': 'Malachi',
      'Mat': 'Matthew', 'Mk': 'Mark', 'Luk': 'Luke', 'John': 'John', 'Acts': 'Acts', 'Rom': 'Romans',
      '1 Co': '1 Corinthians', '2 Co': '2 Corinthians', 'Gal': 'Galatians', 'Eph': 'Ephesians',
      'Phil': 'Philippians', 'Col': 'Colossians', '1 Th': '1 Thessalonians', '2 Th': '2 Thessalonians',
      '1 Tim': '1 Timothy', '2 Tim': '2 Timothy', 'Tit': 'Titus', 'Phlm': 'Philemon', 'Heb': 'Hebrews',
      'Jam': 'James', '1 Pe': '1 Peter', '2 Pe': '2 Peter', '1 Jn': '1 John', '2 Jn': '2 John',
      '3 Jn': '3 John', 'Jude': 'Jude', 'Rev': 'Revelation'
    };

    function resolveBookAbbrev(abbrev) {
      const key = abbrev.trim();
      const foundKey = Object.keys(BOOK_ABBREV_MAP).find(k => k.toLowerCase() === key.toLowerCase());
      if (foundKey) return BOOK_ABBREV_MAP[foundKey];
      // Fallback: maybe it's already a full book name.
      const books = getBooksList();
      const exact = books.find(b => b.toLowerCase() === key.toLowerCase());
      return exact || key;
    }

    // Parses one passage segment like "Gen 1-3", "Lev 13", or "Oba" (whole book, no chapter given).
    function parsePassageSegment(segment) {
      const trimmed = segment.trim();
      const match = trimmed.match(/^((?:[1-3]\s)?[A-Za-z]+)\s*(\d+)?(?:-(\d+))?$/);
      if (!match) return null;
      const book = resolveBookAbbrev(match[1]);
      const startCh = match[2] ? parseInt(match[2], 10) : null;
      const endCh = match[3] ? parseInt(match[3], 10) : startCh;
      return { book, startCh, endCh };
    }

    // Resolves a full day's passage text (possibly several ";"-separated segments) into
    // the actual verse objects from the currently loaded translation, in reading order.
    function getVersesForPassageRange(passagesStr) {
      if (!passagesStr || !currentBibleVerses || currentBibleVerses.length === 0) return [];
      const segments = passagesStr.split(';').map(s => s.trim()).filter(Boolean);
      let allVerses = [];
      segments.forEach(seg => {
        const parsed = parsePassageSegment(seg);
        if (!parsed) return;
        const { book, startCh, endCh } = parsed;
        const versesForBook = currentBibleVerses.filter(v => v.reference.startsWith(book + ' '));
        if (startCh === null) {
          allVerses = allVerses.concat(versesForBook);
        } else {
          const filtered = versesForBook.filter(v => {
            const rest = v.reference.substring(book.length + 1);
            const chapterNum = parseInt(rest.split(':')[0], 10);
            return chapterNum >= startCh && chapterNum <= endCh;
          });
          allVerses = allVerses.concat(filtered);
        }
      });
      return allVerses;
    }

    // Renders a day's full scripture text with chapter-break headings inserted
    // wherever the book/chapter changes.
    function renderPassageText(passagesStr) {
      const verses = getVersesForPassageRange(passagesStr);
      if (!verses || verses.length === 0) {
        return `<div style="color:var(--text-muted); text-align:center; padding:16px;">Scripture text not found for "${passagesStr}".</div>`;
      }
      let html = '';
      let lastBookChapter = null;
      verses.forEach(v => {
        const lastSpace = v.reference.lastIndexOf(' ');
        const book = v.reference.substring(0, lastSpace);
        const chVerse = v.reference.substring(lastSpace + 1);
        const chapter = chVerse.split(':')[0];
        const verseNum = chVerse.split(':')[1] || '';
        const bookChapterKey = `${book} ${chapter}`;
        if (bookChapterKey !== lastBookChapter) {
          html += `<div style="font-family:var(--font-heading); font-size:16px; font-weight:700; color:var(--primary-color); margin:${lastBookChapter ? '18px' : '0'} 0 8px 0; border-bottom:1px solid var(--border-color); padding-bottom:4px;">${book} ${chapter}</div>`;
          lastBookChapter = bookChapterKey;
        }
        html += `<span><sup style="font-size:11px; color:var(--text-muted); margin-right:2px;">${verseNum}</sup>${v.text} </span>`;
      });
      // This id is the "daily reading container" the Read-aloud control reads from —
      // it grabs this element's text at play time, so keep the id stable here.
      return `<div id="daily-reading-passage-text" style="text-align:justify; line-height:1.7; font-size:16px; color:var(--text-main); padding:6px 2px;">${html}</div>`;
    }

    // ============ DAILY READING "LISTEN ALOUD" (Read tab) ============
    // Reads ONLY the text inside #daily-reading-passage-text (the Daily Reading
    // view's scripture container) — never the surrounding UI. Uses the free,
    // built-in browser voice "Google UK English Male" (en-GB) when it's present
    // on the device, falling back progressively (any en-GB male voice, then any
    // en-GB voice, then the browser's own default) since that exact voice only
    // ships on some browser/OS combinations — see the earlier discussion on why
    // named system voices don't carry over across devices.
    //
    // Chrome/Edge load their voice list asynchronously — speechSynthesis.getVoices()
    // often returns an EMPTY array the first time it's called after page load, only
    // becoming populated once the browser fires 'voiceschanged' (which can take a
    // moment on a cold session). Without this cache, pressing "Listen aloud" quickly
    // after opening the app would silently fall through to null/the browser's own
    // default voice instead of "Google UK English Male", even on a device that has
    // it. Warming this up as soon as the script runs (and again whenever the browser
    // reports the list changed) means the real voice list is ready well before the
    // person ever taps play.
    let cachedTtsVoices = [];
    function refreshTtsVoiceCache() {
      if (!window.speechSynthesis) return;
      const v = window.speechSynthesis.getVoices();
      if (v && v.length) cachedTtsVoices = v;
    }
    refreshTtsVoiceCache();
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = () => {
        refreshTtsVoiceCache();
        warmUpDailyReadingTtsVoice();
      };
    }

    // Primes the Google network voice as soon as the app opens, well before
    // the user ever presses "Listen aloud" — Chrome/Edge's "Google …" voices
    // aren't synthesized locally, so the very first utterance spoken with one
    // pays the cost of opening a fresh connection to Google's TTS servers.
    // That cold-start lag is exactly what used to get mistaken for a silently
    // failed voice (see TTS_STARTUP_GRACE_MS below) and is still noticeable as
    // the first second or two of a real Play press feeling unresponsive.
    // Speaking a near-instant, silenced (volume 0) utterance with that voice
    // right at load time gets the connection warmed up ahead of time — by the
    // time the user actually presses play, the correct voice is already
    // primed and ready to start promptly instead of cold.
    let dailyReadingTtsWarmedUp = false;
    function warmUpDailyReadingTtsVoice() {
      if (dailyReadingTtsWarmedUp) return;
      const synth = window.speechSynthesis;
      if (!synth) return;
      const voice = pickDailyReadingTtsVoice();
      if (!voice) return; // voice list hasn't loaded yet — onvoiceschanged above will retry
      dailyReadingTtsWarmedUp = true;
      const warmup = new SpeechSynthesisUtterance('.');
      warmup.voice = voice;
      warmup.volume = 0; // priming the connection only — never actually audible
      warmup.onerror = () => {}; // a blocked/offline network can't warm up anyway — nothing to react to
      try { synth.speak(warmup); } catch (e) {}
    }
    warmUpDailyReadingTtsVoice(); // in case the voice list is already available on this load (e.g. a warm reload)

    function pickDailyReadingTtsVoice() {
      const synth = window.speechSynthesis;
      if (!synth) return null;
      let voices = synth.getVoices() || [];
      // Fresh call came back empty (voices not finished loading yet this tick) —
      // fall back to whatever the warm-up above already captured.
      if (!voices.length) voices = cachedTtsVoices;
      if (!voices.length) return null;
      return voices.find(v => /google uk english male/i.test(v.name))
          || voices.find(v => (v.lang || '').toLowerCase() === 'en-gb' && /male/i.test(v.name))
          || voices.find(v => (v.lang || '').toLowerCase() === 'en-gb')
          || null;
    }

    // Icon/label reflect three states: idle (nothing loaded — Play), actively
    // speaking (Pause), and paused mid-session (Play again, since tapping it
    // resumes rather than starting over).
    function updateDailyReadingTtsButton() {
      const btn = document.getElementById('daily-reading-tts-btn');
      if (!btn) return;
      const isSpeaking = dailyReadingTtsActive && !dailyReadingTtsPaused;
      btn.classList.toggle('active', isSpeaking);
      btn.title = isSpeaking ? 'Pause reading aloud' : (dailyReadingTtsActive ? 'Resume reading aloud' : "Play today's reading aloud");
      btn.innerHTML = isSpeaking
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>';
      // Keep the global "Now Playing" mini player's own play/pause icon (see
      // registerDailyReadingMediaController) in sync too, whenever it's the one
      // currently representing this reading session — this button has no native
      // play/pause DOM events for the mini player system to listen for on its
      // own, unlike a real <audio>/<video> tag, so it's updated by hand here
      // instead, right alongside every other place this function already runs.
      if (typeof activeMediaController !== 'undefined' && activeMediaController && activeMediaController.kind === 'tts') {
        updateMiniPlayerPlayPauseIcon(isSpeaking);
      }
      // Rewind/fast-forward only make sense once there's actually a session to
      // skip within.
      const rewindBtn = document.getElementById('daily-reading-rewind-btn');
      const forwardBtn = document.getElementById('daily-reading-forward-btn');
      if (rewindBtn) rewindBtn.style.display = dailyReadingTtsActive ? 'flex' : 'none';
      if (forwardBtn) forwardBtn.style.display = dailyReadingTtsActive ? 'flex' : 'none';
    }

    // Registers (or re-registers, e.g. on resume, or on advancing to the next
    // day) the current Daily Reading "listen aloud" session with the same
    // global "Now Playing" mini player every audio/video in the app already
    // uses (see the GLOBAL "NOW PLAYING" MINI PLAYER section further down).
    // Reusing its element-visibility polling — rather than hooking switchTab or
    // any other specific navigation point — means switching to a different
    // nav-tab (or back) automatically shows/hides the floating mini player at
    // the same moment daily-reading-tts-btn itself becomes hidden/visible,
    // with no extra wiring needed here for tab-switch detection.
    function registerDailyReadingMediaController(dayNumber) {
      const btn = document.getElementById('daily-reading-tts-btn');
      if (!btn) return;
      handleMediaStarted({
        kind: 'tts',
        element: btn, // used only for the generic on-screen-visibility check
        title: `Day ${dayNumber} Reading`,
        isPaused: () => dailyReadingTtsPaused,
        play: () => resumeDailyReadingTts(),
        pause: () => pauseDailyReadingTts(),
        stop: () => stopDailyReadingTts()
      });
    }

    // Toggled by the control button: starts a fresh read when idle, pauses when
    // actively speaking, and resumes when paused — true speechSynthesis pause/
    // resume on the same utterance, not a stop-and-restart. Starting fresh from
    // the Calendar view switches to the Daily Reading view first, since that's
    // the only place the passage container exists.
    //
    // Known browser quirk: some Chrome versions can fail to actually resume
    // speech after speechSynthesis.pause() has been held for an extended period
    // (a long-standing Chromium bug, not something a page can work around) — if
    // that happens, stopping and pressing Play again starts a fresh read.
    function toggleDailyReadingTts() {
      if (dailyReadingTtsActive) {
        if (dailyReadingTtsPaused) resumeDailyReadingTts();
        else pauseDailyReadingTts();
        return;
      }
      if (!window.speechSynthesis) { alert('Text-to-speech is not supported in this browser.'); return; }
      // Finishing a day's reading marks it complete on the account, so listening
      // aloud needs a signed-in user just like the checkbox does.
      if (!ensureLoggedInFor('Sign in to track your reading progress.', () => toggleDailyReadingTts())) return;
      if (currentPlanSubTab !== 'reading') switchPlanSubTab('reading');
      dailyReadingTtsSessionToken++;
      runDailyReadingTtsCycle();
    }

    // Suspends the current utterance in place (speechSynthesis.pause()) — the
    // browser holds its exact position, ready to continue from there rather than
    // restarting the sentence/passage over from the beginning.
    function pauseDailyReadingTts() {
      if (!dailyReadingTtsActive || dailyReadingTtsPaused || !window.speechSynthesis) return;
      window.speechSynthesis.pause();
      dailyReadingTtsPaused = true;
      // Bank the time actually spent speaking this segment — see
      // skipDailyReadingTts/estimateDailyReadingCurrentCharIndex, which need an
      // accurate elapsed-time total even across pause/resume cycles.
      dailyReadingElapsedMs += Date.now() - dailyReadingSegmentStartTime;
      updateDailyReadingTtsButton();
    }

    function resumeDailyReadingTts() {
      if (!dailyReadingTtsActive || !dailyReadingTtsPaused || !window.speechSynthesis) return;
      window.speechSynthesis.resume();
      dailyReadingTtsPaused = false;
      dailyReadingSegmentStartTime = Date.now(); // restart the wall-clock segment timer from here
      updateDailyReadingTtsButton();
      // Reclaim the "Now Playing" mini player slot in case something else (a
      // Study tab audio/video) took it over while this was paused.
      registerDailyReadingMediaController(currentPlanViewDayNumber);
    }

    // Speaks whatever is currently in the passage container, then calls back on a
    // natural finish (never on a manual stop/interruption — those resolve to false).
    function runDailyReadingTtsCycle() {
      const mySessionToken = dailyReadingTtsSessionToken;
      const container = document.getElementById('daily-reading-passage-text');
      // Verse numbers are rendered as <sup> markers (see renderPassageText) purely
      // for on-screen reference — reading them aloud would insert a spoken digit
      // before every single verse ("1 In the beginning... 2 And the earth...").
      // Clone the container and strip those out before reading its text, rather
      // than pattern-matching digits out of the concatenated string (which could
      // misfire on legitimate numbers that are actually part of the scripture text).
      let text = '';
      if (container) {
        const clone = container.cloneNode(true);
        clone.querySelectorAll('sup').forEach(el => el.remove());
        text = clone.textContent.replace(/\s+/g, ' ').trim();
      }
      if (!container || !text) { stopDailyReadingTts(); return; }

      dailyReadingFullText = text;
      registerDailyReadingMediaController(currentPlanViewDayNumber);
      speakDailyReadingPassage(text, mySessionToken, false, 0);
    }

    // Chrome/Edge's "Google …" voices (including the "Google UK English Male"
    // this feature prefers) aren't synthesized locally — each utterance is sent
    // to Google's servers and the audio streamed back. On a network that blocks
    // or interferes with that request (a corporate firewall, certain ad/privacy
    // blockers, or just being offline), speechSynthesis reports no error at all:
    // speak() "succeeds", the page's own active/pause state looks completely
    // normal, and yet nothing is ever actually heard. There's no event to detect
    // that failure directly, so this waits for the browser's own 'start' (or
    // 'boundary') event — proof real synthesis is underway — and if neither has
    // fired within TTS_STARTUP_GRACE_MS, assumes the network voice silently
    // failed and retries once with a local voice instead.
    const TTS_STARTUP_GRACE_MS = 1500;

    // The utterance object currently backing playback (if any) — tracked so a
    // fresh call below can detach ITS handlers before cancelling it. Without
    // this, cancelling it to start a new utterance (a retry, a rewind/fast-
    // forward, or reading the next day) would fire that old utterance's own
    // onerror, which — since nothing about the session's own token changes for
    // any of those cases — would look exactly like a genuine failure and
    // incorrectly stop the very session still in progress.
    let dailyReadingCurrentUtterance = null;

    function speakDailyReadingPassage(text, mySessionToken, useLocalFallbackVoice, startOffset) {
      const synth = window.speechSynthesis;

      if (dailyReadingCurrentUtterance) {
        dailyReadingCurrentUtterance.onstart = null;
        dailyReadingCurrentUtterance.onboundary = null;
        dailyReadingCurrentUtterance.onend = null;
        dailyReadingCurrentUtterance.onerror = null;
      }

      const utter = new SpeechSynthesisUtterance(text);
      dailyReadingCurrentUtterance = utter;
      const voice = useLocalFallbackVoice ? pickLocalFallbackTtsVoice() : pickDailyReadingTtsVoice();
      if (voice) utter.voice = voice;
      utter.rate = 0.90;
      utter.pitch = 0.50;

      // Restart the elapsed-time tracking used by skipDailyReadingTts for this
      // fresh utterance (a retry re-speaking the exact same text/offset after a
      // silent network-voice failure is correct to reset this too — nothing was
      // actually audible yet for the time already "spent" on that failed attempt).
      dailyReadingSpokenOffset = startOffset;
      dailyReadingSegmentStartTime = Date.now();
      dailyReadingElapsedMs = 0;

      let started = false;
      utter.onstart = () => { started = true; };
      utter.onboundary = () => { started = true; };
      utter.onend = () => {
        if (mySessionToken !== dailyReadingTtsSessionToken) return; // a newer/stopped session superseded this one
        handleDailyReadingFinishedNaturally(mySessionToken);
      };
      utter.onerror = () => {
        if (mySessionToken !== dailyReadingTtsSessionToken) return; // already stopped deliberately — nothing to clean up
        stopDailyReadingTts();
      };

      // Chrome has a long-standing bug where the engine's internal "paused" flag
      // can survive a cancel() call made while paused (see stopDailyReadingTts) —
      // if that flag is still set from an earlier session, speak() below gets
      // silently queued and never actually plays, with no error event at all.
      // Clearing it defensively right before speaking is a no-op in the normal
      // case (nothing paused) and the fix in the stuck case.
      if (synth.paused) synth.resume();
      synth.cancel();
      // Calling speak() in the very same tick as cancel() is what let a
      // still-draining previous utterance's audio bleed through underneath
      // this new one in Chrome (most audible as the old "Google" voice
      // lingering under a newly-started fallback voice) — cancel() is not
      // guaranteed to have actually silenced the engine yet when it returns.
      // A brief delay gives it a moment to genuinely flush first. If another
      // call (a retry, a skip, a stop) supersedes this utterance before the
      // delay elapses, dailyReadingCurrentUtterance will have moved on and
      // this speak() is skipped rather than starting a now-stale utterance.
      setTimeout(() => {
        if (dailyReadingCurrentUtterance !== utter) return;
        synth.speak(utter);
      }, 50);
      dailyReadingTtsActive = true;
      dailyReadingTtsPaused = false;
      updateDailyReadingTtsButton();

      if (!useLocalFallbackVoice) {
        setTimeout(() => {
          if (mySessionToken !== dailyReadingTtsSessionToken) return; // stopped/moved on already
          if (started) return; // genuinely underway — leave it alone
          // Never actually started — speakDailyReadingPassage's own top-of-
          // function detach (above) handles cleanly cancelling this attempt
          // when the retry below calls it again.
          speakDailyReadingPassage(text, mySessionToken, true, startOffset);
        }, TTS_STARTUP_GRACE_MS);
      }
    }

    // Last-resort voice for the retry above: an explicitly LOCAL (not network/
    // cloud) voice, since those are what actually failed. Falls back to leaving
    // utter.voice unset (the browser's own default) if none is reported local —
    // still usually local in practice, just not guaranteed.
    function pickLocalFallbackTtsVoice() {
      const synth = window.speechSynthesis;
      if (!synth) return null;
      let voices = synth.getVoices() || [];
      if (!voices.length) voices = cachedTtsVoices;
      if (!voices.length) return null;
      return voices.find(v => v.localService && /^en/i.test(v.lang || ''))
          || voices.find(v => v.localService)
          || null;
    }

    // Best-effort estimate of how far into dailyReadingFullText the voice has
    // actually gotten right now — see the state comment above dailyReadingFullText
    // for why this is an estimate rather than a real position.
    function estimateDailyReadingCurrentCharIndex() {
      const elapsedMs = dailyReadingElapsedMs + ((dailyReadingTtsActive && !dailyReadingTtsPaused) ? (Date.now() - dailyReadingSegmentStartTime) : 0);
      const chars = Math.round((elapsedMs / 1000) * TTS_ESTIMATED_CHARS_PER_SECOND);
      return dailyReadingSpokenOffset + chars;
    }

    // Rewinds/fast-forwards the current reading by approximately deltaSeconds
    // (negative to rewind) by estimating the current position (see above),
    // moving it, snapping to the nearest word boundary so playback doesn't
    // resume mid-word, and starting a fresh utterance from there. Always leaves
    // the session playing afterward, even if it was paused — pressing a skip
    // button reads most naturally as "continue from here," and immediately
    // re-pausing a just-started utterance risks the same Chrome paused-flag bug
    // already worked around elsewhere in this file.
    function skipDailyReadingTts(deltaSeconds) {
      if (!dailyReadingTtsActive || !dailyReadingFullText) return;
      const mySessionToken = dailyReadingTtsSessionToken;
      const deltaChars = Math.round(deltaSeconds * TTS_ESTIMATED_CHARS_PER_SECOND);
      let targetIndex = estimateDailyReadingCurrentCharIndex() + deltaChars;
      targetIndex = Math.max(0, Math.min(targetIndex, dailyReadingFullText.length));

      // Snap back to the start of whichever word targetIndex landed inside, so
      // the new utterance never begins partway through a word.
      if (targetIndex > 0 && targetIndex < dailyReadingFullText.length) {
        const lastSpace = dailyReadingFullText.lastIndexOf(' ', targetIndex);
        if (lastSpace !== -1) targetIndex = lastSpace + 1;
      }

      // Skipped forward past the end of the passage — same outcome as the
      // voice reaching the end on its own.
      if (targetIndex >= dailyReadingFullText.length - 1) {
        handleDailyReadingFinishedNaturally(mySessionToken);
        return;
      }

      const remainingText = dailyReadingFullText.slice(targetIndex).trimStart();
      speakDailyReadingPassage(remainingText, mySessionToken, false, targetIndex);
    }

    function stopDailyReadingTts() {
      dailyReadingTtsSessionToken++; // invalidates any in-flight utterance events / pending timers from the old session
      dailyReadingTtsPaused = false;
      dailyReadingTtsActive = false;
      dailyReadingFullText = '';
      dailyReadingSpokenOffset = 0;
      dailyReadingElapsedMs = 0;
      dailyReadingCurrentUtterance = null;
      if (window.speechSynthesis) {
        // See the matching comment in speakDailyReadingPassage: cancelling while
        // the engine is still in a paused state (e.g. the user hit Pause and then
        // navigated away, landing here instead of resumeDailyReadingTts) is what
        // leaves it stuck — resuming first ensures cancel() actually clears the
        // queue instead of leaving speech synthesis silently wedged for next time.
        if (window.speechSynthesis.paused) window.speechSynthesis.resume();
        window.speechSynthesis.cancel();
      }
      // Only clear the global mini player if it's still showing THIS reading
      // session — something else (a Study tab audio/video) may have already
      // taken it over, in which case that's what should keep showing, not this.
      if (typeof activeMediaController !== 'undefined' && activeMediaController && activeMediaController.kind === 'tts') {
        clearActiveMedia();
      }
      hideDailyReadingContinuePrompt();
      updateDailyReadingTtsButton();
    }

    // The voice finished the day's passage without being stopped: mark today
    // complete, advance the view to the next scheduled day, then ask whether to
    // keep reading — auto-declining after 10 seconds of no response.
    async function handleDailyReadingFinishedNaturally(mySessionToken) {
      const dayObj = cachedScheduleDays.find(d => d.day === currentPlanViewDayNumber);
      if (!dayObj) { stopDailyReadingTts(); return; }

      await togglePlanDay(dayObj.rowIndex, true); // marks complete, saves, and re-renders (shows the "complete!" banner)
      if (mySessionToken !== dailyReadingTtsSessionToken) return; // stopped while that save was in flight

      // togglePlanDay's completeCurrentPlan() runs when every day is now complete,
      // wiping the start date and resetting the plan — nothing left to continue to.
      if (!currentPlanStartDate) { stopDailyReadingTts(); return; }

      const totalDays = cachedScheduleDays.length;
      const nextDayNumber = dayObj.day + 1;
      if (nextDayNumber > totalDays) { stopDailyReadingTts(); return; }

      // Give the "complete!" banner a moment on screen (matches the pause used
      // elsewhere when the checkbox itself triggers this same auto-advance) before
      // moving the view forward and asking whether to keep going.
      setTimeout(() => {
        if (mySessionToken !== dailyReadingTtsSessionToken) return;
        currentPlanViewDayNumber = nextDayNumber;
        renderActivePlanView();
        showDailyReadingContinuePrompt(nextDayNumber, mySessionToken);
      }, 1500);
    }

    function showDailyReadingContinuePrompt(nextDayNumber, mySessionToken) {
      const promptEl = document.getElementById('daily-reading-continue-prompt');
      const textEl = document.getElementById('daily-reading-continue-text');
      if (!promptEl || !textEl) { stopDailyReadingTts(); return; }

      let secondsLeft = 10;
      const updateText = () => {
        textEl.textContent = `Continue to Day ${nextDayNumber}'s reading aloud? (stopping automatically in ${secondsLeft}s)`;
      };
      updateText();
      promptEl.style.display = 'flex';

      dailyReadingContinueCountdownInterval = setInterval(() => {
        secondsLeft -= 1;
        if (secondsLeft > 0) updateText();
      }, 1000);

      dailyReadingContinueTimeoutHandle = setTimeout(() => {
        if (mySessionToken !== dailyReadingTtsSessionToken) return; // already answered or stopped
        respondToDailyReadingContinuePrompt(false);
      }, 10000);
    }

    function hideDailyReadingContinuePrompt() {
      const promptEl = document.getElementById('daily-reading-continue-prompt');
      if (promptEl) promptEl.style.display = 'none';
      if (dailyReadingContinueCountdownInterval) { clearInterval(dailyReadingContinueCountdownInterval); dailyReadingContinueCountdownInterval = null; }
      if (dailyReadingContinueTimeoutHandle) { clearTimeout(dailyReadingContinueTimeoutHandle); dailyReadingContinueTimeoutHandle = null; }
    }

    function respondToDailyReadingContinuePrompt(continueReading) {
      hideDailyReadingContinuePrompt();
      if (continueReading) runDailyReadingTtsCycle(); // reads the next day's passage, already on screen
      else stopDailyReadingTts();
    }

    

    // Listen for typing to prevent UI overwrites during live sync
    document.addEventListener('input', (e) => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') {
        isUserTyping = true;
        clearTimeout(e.target.typingTimeout);
        e.target.typingTimeout = setTimeout(() => { isUserTyping = false; }, 2000);
      }
    });

    function saveToLocalCache(translation, data) {
      try { localStorage.setItem(`bible_${translation}`, JSON.stringify(data)); } 
      catch (e) { console.warn("Local storage unavailable."); }
    }

    function showLoader(show) {
      document.getElementById('loader').style.display = show ? 'block' : 'none';
    }

    // Toggle between Sign In and Sign Up view
    function toggleAuthMode() {
      isSignUpMode = !isSignUpMode;
      document.getElementById('auth-title').innerText = isSignUpMode ? 'Create Account' : 'Sign In';
      document.getElementById('auth-btn').innerText = isSignUpMode ? 'Sign Up' : 'Sign In';
      document.getElementById('auth-toggle-text').innerText = isSignUpMode ? 'Already have an account?' : 'Don\'t have an account?';
      document.getElementById('auth-toggle-link').innerText = isSignUpMode ? 'Sign In' : 'Sign Up';
      document.getElementById('login-error').style.display = 'none';
    }

    // --- AUTHENTICATION & SESSION MANAGEMENT ---
    // --- SHAREABLE VERSE/RESOURCE LINKS ---
    // Reads ?share=verse|resource&ref=...&t=...&id=... from the URL (if present)
    // and remembers it — either to jump straight there (already logged in) or to
    // carry through the login/signup flow so the person lands in the right place
    // once they're authenticated.
    function captureShareTargetFromURL() {
      const params = new URLSearchParams(window.location.search);
      const share = params.get('share');
      if (share === 'verse' || share === 'resource' || share === 'book_session' || share === 'foundations_class' || share === 'foundations_session') {
        pendingShareTarget = {
          type: share,
          ref: params.get('ref') || null,
          t: params.get('t') || null,
          id: params.get('id') || null,
          book: params.get('book') || null,
          i: params.get('i') !== null ? parseInt(params.get('i'), 10) : null
        };
        originalShareUrl = window.location.href;
        try { sessionStorage.setItem('pendingShareTarget', JSON.stringify(pendingShareTarget)); } catch (e) {}
        try { sessionStorage.setItem('pendingShareUrl', originalShareUrl); } catch (e) {}
        // Clean the visible URL so refreshing/back doesn't keep re-triggering it,
        // while the target itself lives on in memory/sessionStorage.
        try { window.history.replaceState({}, document.title, window.location.pathname); } catch (e) {}
      } else {
        try {
          const storedTarget = sessionStorage.getItem('pendingShareTarget');
          if (storedTarget) pendingShareTarget = JSON.parse(storedTarget);
          const storedUrl = sessionStorage.getItem('pendingShareUrl');
          if (storedUrl) originalShareUrl = storedUrl;
        } catch (e) {}
      }
    }

    // Friendly names for the banner below — keep in sync with the share
    // types captureShareTargetFromURL() recognizes.
    const SHARE_TARGET_LABELS = {
      verse: 'Bible verse',
      resource: 'study resource',
      book_session: 'study session',
      foundations_class: 'Core-D class',
      foundations_session: 'Core-D session'
    };

    // Shown on the login screen when someone arrives via a share link (text,
    // email, anywhere) and isn't already signed in — called from
    // checkUserSession()'s "not logged in" branch. Doesn't force Sign Up
    // mode (the person may already have an account and just need to sign
    // in), it just makes signing up an obvious option instead of a dead end.
    function updateShareSignupBanner() {
      const banner = document.getElementById('share-signup-banner');
      if (!banner) return;
      if (pendingShareTarget) {
        const label = SHARE_TARGET_LABELS[pendingShareTarget.type] || 'item';
        banner.innerHTML = `📖 Someone shared a ${label} with you! Sign in, or create a free account, to see it.`;
        banner.style.display = 'block';
      } else {
        banner.style.display = 'none';
      }
    }

    // Called once the app has finished its normal startup — jumps to whatever
    // verse/resource a share link pointed at, if one is pending.
    async function applyPendingShareTarget() {
      if (!pendingShareTarget) return;
      const target = pendingShareTarget;
      pendingShareTarget = null;
      try { sessionStorage.removeItem('pendingShareTarget'); } catch (e) {}
      try { sessionStorage.removeItem('pendingShareUrl'); } catch (e) {}

      if (target.type === 'book_session') {
        if (!target.book) return;
        const index = BIBLE_STUDIES_BOOK_ORDER.indexOf(target.book);
        if (index === -1) return;
        const cfg = getBibleStudyBookConfig(target.book, index);
        if (!cfg.live) return;

        // By the Book is sign-in only — a shared link from a guest pops the login
        // modal and picks this exact session back up automatically once they do.
        const openSharedBookSession = () => {
          switchTab('study');
          switchStudySubTab('bible-studies');
          selectBibleStudyBook(target.book, true);

          // selectBibleStudyBook always resets to the Listen (audio) view with no
          // presenter filter — override both so the shared session is actually
          // visible in whichever view it lives in, then re-render with that.
          const session = (cfg.sessions || [])[target.i];
          if (session) {
            setActiveStudyFilters(getSessionFilterType(session), null);
            renderBibleStudyInfoPanel(cfg);
          }

          setTimeout(() => {
            const el = document.getElementById(`book-session-${target.i}`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              el.classList.add('share-highlight');
              setTimeout(() => el.classList.remove('share-highlight'), 2000);
            }
          }, 300);
        };
        if (!ensureLoggedInFor('Sign in to view By the Book.', openSharedBookSession)) return;
        openSharedBookSession();
        return;
      }

      if (target.type === 'foundations_class' || target.type === 'foundations_session') {
        const dbId = parseInt(target.id, 10);
        const item = foundationsList.find(i => i.dbId === dbId);
        if (!item || !item.live) return;

        // Core-D is sign-in only — a shared link from a guest pops the login modal
        // and picks this exact class/session back up automatically once they do.
        const openSharedFoundationsItem = () => {
          switchTab('study');
          switchStudySubTab('foundations');
          openFoundationsItem(dbId);

          if (target.type === 'foundations_session') {
            const sessionIdx = parseInt(target.i, 10);
            if (!isNaN(sessionIdx) && (item.sessions || [])[sessionIdx]) {
              // openFoundationsItem() just repainted the panel with everything
              // collapsed — wait a beat for that to land, then expand the
              // shared session and scroll/highlight it, same as any other
              // share-link landing in this app.
              setTimeout(() => {
                toggleFoundationsSession(sessionIdx);
                setTimeout(() => {
                  const el = document.querySelectorAll('#foundations-detail-panel .foundations-session-item')[sessionIdx];
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.classList.add('share-highlight');
                    setTimeout(() => el.classList.remove('share-highlight'), 2000);
                  }
                }, 150);
              }, 300);
            }
          } else {
            setTimeout(() => {
              const panel = document.getElementById('foundations-detail-panel');
              if (panel) {
                panel.classList.add('share-highlight');
                setTimeout(() => panel.classList.remove('share-highlight'), 2000);
              }
            }, 300);
          }
        };
        if (!ensureLoggedInFor('Sign in to view Core-D.', openSharedFoundationsItem)) return;
        openSharedFoundationsItem();
        return;
      }

      if (target.t) {
        const sel = document.getElementById('translation-select');
        if (sel && Array.from(sel.options).some(o => o.value === target.t)) {
          sel.value = target.t;
          if (!bibleCache[target.t]) {
            try { await loadBibleData(target.t); } catch (e) { console.error('Error loading shared translation:', e.message); }
          } else {
            currentBibleVerses = bibleCache[target.t];
          }
        }
      }

      if (!target.ref) return;

      const lastSpace = target.ref.lastIndexOf(' ');
      const chapterOnly = lastSpace !== -1
        ? target.ref.substring(0, lastSpace) + ' ' + target.ref.substring(lastSpace + 1).split(':')[0]
        : target.ref;

      switchTab('bible');
      await loadChapterByReference(chapterOnly);

      const matched = currentBibleVerses.find(v => v.reference === target.ref);
      if (matched) {
        setTimeout(() => {
          const elId = target.type === 'resource' ? `church-resources-card-${matched.rowIndex}` : `verse-row-${matched.rowIndex}`;
          const el = document.getElementById(elId);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('share-highlight');
            setTimeout(() => el.classList.remove('share-highlight'), 2000);
          }
        }, 300);
      }
    }

    function buildShareUrl(type, params) {
      const url = new URL(window.location.origin + window.location.pathname);
      url.searchParams.set('share', type);
      Object.keys(params).forEach(k => { if (params[k]) url.searchParams.set(k, params[k]); });
      return url.toString();
    }

    function escapeHtml(str) {
      return String(str == null ? '' : str).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    }

    // Repairs "mojibake": text that was correctly typed with real curly quotes/dashes
    // (usually pasted from Word, Google Docs, or a webpage) but somewhere upstream of
    // this app got its UTF-8 bytes decoded one byte at a time as Windows-1252 instead
    // — the classic “ becoming the readable-but-wrong "â€œ". Since that corruption
    // happened before the text ever reached here (typing/pasting in a browser can't
    // introduce it), this can only be un-done at display time, by reversing the exact
    // mis-decoding: turning each character back into the Windows-1252 byte it must
    // have come from, then decoding THAT byte sequence as UTF-8 — which is applied to
    // every place admin-entered lesson/resource/note text loads from the database
    // (see loadFoundationsContent, loadBibleStudyBooksFromDB, loadBibleData,
    // startLiveSync, fetchUserMarginNotes) so already-corrupted content self-heals
    // wherever it's shown, with no database migration needed.
    //
    // Bytes 0x80-0x9F are where Windows-1252 diverges from plain Latin-1: most of them
    // are "smart" typography (curly quotes, em dash, …) at codepoints far outside the
    // 0x00-0xFF range, so those need this explicit reverse-lookup; the 5 slots
    // Windows-1252 leaves unassigned decode as their own C1 control codepoint (e.g.
    // byte 0x9D <-> U+009D) per the WHATWG Encoding spec, which the generic
    // 0x80-0xFF identity fallback below already covers.
    const CP1252_SPECIAL_TO_BYTE = {
      0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86,
      0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C,
      0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95,
      0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B,
      0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F
    };

    // The telltale shape of this exact mistake: a UTF-8 lead byte (0xC2, 0xC3, 0xC5,
    // 0xE2, 0xE3 are the ones that turn up in real text) followed by a continuation
    // byte (0x80-0xBF), both misread one byte at a time as Windows-1252 — a two-
    // character sequence that never legitimately appears in real text, so this only
    // ever matches text that actually needs fixing. Built from character codes at
    // runtime (rather than typed as literal high-Unicode characters in this file's
    // own source) so there's no ambiguity about exactly which codepoints it matches.
    const MOJIBAKE_LEAD_CHARS = [0xC2, 0xC3, 0xC5, 0xE2, 0xE3].map(b => String.fromCharCode(b)).join('');
    const MOJIBAKE_CONT_CHARS = (function () {
      let chars = '';
      for (let b = 0x80; b <= 0xBF; b++) chars += String.fromCharCode(b); // identity-mapped continuation bytes
      Object.keys(CP1252_SPECIAL_TO_BYTE).forEach(cp => { chars += String.fromCodePoint(Number(cp)); }); // the scattered special ones
      return chars;
    })();
    const MOJIBAKE_PATTERN = new RegExp('[' + MOJIBAKE_LEAD_CHARS + '][' + MOJIBAKE_CONT_CHARS.replace(/[-\]\\^]/g, '\\$&') + ']');

    function fixMojibakeText(str) {
      if (!str || typeof str !== 'string' || !MOJIBAKE_PATTERN.test(str)) return str;
      const bytes = [];
      for (const ch of str) {
        const code = ch.codePointAt(0);
        let byte;
        if (code <= 0x7F) byte = code;
        else if (CP1252_SPECIAL_TO_BYTE[code] !== undefined) byte = CP1252_SPECIAL_TO_BYTE[code];
        else if (code >= 0x80 && code <= 0xFF) byte = code;
        else return str; // a character Windows-1252 can't produce — not this bug, leave it alone
        bytes.push(byte);
      }
      try {
        const fixed = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
        // Only accept the repair if it actually cleared up the suspicious pattern —
        // otherwise keep the original rather than risk mangling real text further.
        return MOJIBAKE_PATTERN.test(fixed) ? str : fixed;
      } catch (e) {
        return str; // reversing it didn't land on valid UTF-8 — this wasn't the bug
      }
    }

    // Escapes a cord message, then turns any http(s) URL in it into a tappable
    // link — this is what makes a scripture/resource link sent via the Share
    // Sheet actually openable from inside the cord thread, and is safe to run on
    // every message since it escapes first (URLs survive being escaped: & becomes
    // &amp; but browsers decode that back to & in the rendered href).
    //
    // Messages sent via the Share Sheet are stored as "<label>\n<url>" (see
    // sendShareToCord), where <url> is one of THIS app's own share links (it
    // always carries a "share=verse" / "share=resource" / "share=book_session" /
    // "share=foundations_class" / "share=foundations_session" query param —
    // see buildShareUrl). Detecting it by that query param rather
    // than by URL scheme means this still works no matter how the app is being
    // hosted — a normal https deployment, or this single HTML file just opened
    // directly (file://), which has no http(s) origin at all. Rather than
    // showing that raw URL, render the whole thing as one live link whose
    // visible text is just the label — the URL stays hidden but is still fully
    // clickable/live via the href. The scheme is still allowlisted (http/https/
    // file only) so a message someone hand-types can't smuggle in a
    // script-executing href like javascript:.
    function linkifyMessageContent(text) {
      const str = String(text == null ? '' : text);
      const lines = str.split('\n');
      const lastLine = lines[lines.length - 1].trim();
      const isOwnShareLink = lines.length > 1
        && !/\s/.test(lastLine)
        && /^(?:https?|file):\/\//i.test(lastLine)
        && /[?&]share=(?:verse|resource|book_session|foundations_class|foundations_session)(?:&|$)/.test(lastLine);
      if (isOwnShareLink) {
        const label = lines.slice(0, -1).join('\n');
        return `<a href="${escapeHtml(lastLine)}" target="_blank" rel="noopener" style="color:inherit; text-decoration:underline; font-weight:700;">${escapeHtml(label)}</a>`;
      }
      const escaped = escapeHtml(str);
      return escaped.replace(/(https?:\/\/[^\s<]+)/g, url => `<a href="${url}" target="_blank" rel="noopener" style="color:inherit; text-decoration:underline; word-break:break-all;">${url}</a>`);
    }


    function shareVerse(reference) {
      const translation = document.getElementById('translation-select').value;
      const url = buildShareUrl('verse', { ref: reference, t: translation });
      openShareSheet(url, `Check out ${reference}`);
    }

    function shareResource(resourceId, verseReference) {
      const translation = document.getElementById('translation-select').value;
      const url = buildShareUrl('resource', { id: resourceId, ref: verseReference, t: translation });
      openShareSheet(url, `Check out this resource on ${verseReference}`);
    }

    // Shares a single session/article from the "By the Book" shelf (Study tab).
    // sessionIndex is that session's position in cfg.sessions for the book — see
    // applyPendingShareTarget's 'book_session' handling for how a recipient
    // following the link back gets dropped on this exact session.
    function shareBookSession(bookTitle, sessionIndex, sessionTitle) {
      // buildShareUrl drops any param that's falsy, and 0 (the very first
      // session) is falsy — pass it as a non-empty string so session 0 doesn't
      // silently lose its index and become an un-followable link.
      const url = buildShareUrl('book_session', { book: bookTitle, i: String(sessionIndex) });
      openShareSheet(url, `Check out "${sessionTitle}" from ${bookTitle}`);
    }

    function shareFoundationsClass(dbId, title) {
      const url = buildShareUrl('foundations_class', { id: String(dbId) });
      openShareSheet(url, `Check out "${title}" in Core-D`);
    }

    function shareFoundationsSession(dbId, sessionIndex, classTitle, sessionTitle) {
      // Same falsy-0 caveat as shareBookSession above — String(sessionIndex)
      // keeps a shared first session from silently losing its index.
      const url = buildShareUrl('foundations_session', { id: String(dbId), i: String(sessionIndex) });
      openShareSheet(url, `Check out "${sessionTitle}" from ${classTitle}`);
    }

    async function checkUserSession() {
      showLoader(true);
      const { data: { session }, error } = await supabaseClient.auth.getSession();

      if (error) {
        console.error('Session error:', error.message);
        showLoader(false);
        return;
      }

      if (session && session.user) {
        currentUser = {
          id: session.user.id,
          email: session.user.email,
          isAdmin: false
        };

        // Fetch (or lazily create) this user's profile row for admin status / username.
        // display_name is a separate, user-editable "Cords display name" (set from
        // Settings) shown in Cords communications in place of the account username —
        // it falls back to the username until the person sets one. search_visibility
        // is the three-way privacy setting controlling whether/how this person can be
        // found by the Cords "Enter Username/Display Name" search:
        //   'searchable'    — found by either username or display name
        //   'username_only' — found only by the exact username, not the display name
        //   'unfindable'    — can't be found at all (default — opt-in to be found)
        // role is the account level — 'admin', 'member', 'prospective_member', or
        // 'subscriber' (the default for every new signup). Admin *access* in this
        // app is still governed entirely by is_admin (unchanged, everywhere it's
        // checked) — role is a separate, currently-informational classification
        // for the other three tiers, which all have identical access today but may
        // need to be distinguished later. An admin's role is set to 'admin' purely
        // for display consistency; is_admin remains the actual permission gate.
        let { data: profile, error: profileError } = await profilesTable
          .select('username, is_admin, display_name, search_visibility, role')
          .eq('id', currentUser.id)
          .maybeSingle();

        if (!profile && !profileError) {
          const defaultUsername = currentUser.email.split('@')[0];
          const { data: created } = await profilesTable.insert(
            { id: currentUser.id, username: defaultUsername, is_admin: false, role: 'subscriber' },
            'username, is_admin, display_name, search_visibility, role'
          );
          profile = created;
        }

        if (profile) {
          currentUser.isAdmin = !!profile.is_admin;
          currentUser.username = profile.username;
          currentUser.cordDisplayName = profile.display_name || profile.username;
          currentUser.searchVisibility = profile.search_visibility || 'unfindable';
          currentUser.role = profile.role || (currentUser.isAdmin ? 'admin' : 'subscriber');
        }

        const usernameEl = document.getElementById('welcome-msg-username');
        if (usernameEl) usernameEl.innerText = currentUser.cordDisplayName || currentUser.username || currentUser.email;
        updateAuthHeaderUI();
        document.getElementById('app-screen').style.display = 'block';

        // Fetch User's specific notes from Supabase after login
        await fetchUserMarginNotes();
        checkMarginNotesCountBadges(); // retroactive: in case a threshold badge was added since last login

        // So the Records header bubble reflects anything achieved last session even
        // before the user opens the Records page this session.
        await loadUserRecords();
        updateRecordsNotificationBadge();

        // Same idea for the Cords header bubble — reflects unread messages from
        // before this session even if the user hasn't opened Cords yet.
        await loadCordData();

        // The reading plan's progress/start date and its "Reading Updates"
        // notification are entirely account-bound — loadReadingSchedule() bails
        // out immediately for a guest, so if the public startup sequence already
        // ran before this login happened (appHasInitialized true, i.e. this
        // person browsed as a guest first), that data was never loaded. Refresh
        // it now that we know who's signed in, and do it before resolving any
        // queued action below (e.g. "Start Plan") so that action sees accurate
        // existing progress rather than acting on stale/empty data.
        if (appHasInitialized) {
          await loadReadingSchedule();
          // loadReadingSchedule() only just computed a fresh message — if the
          // person is already sitting on the Reading Plan tab (rather than
          // switching to it after logging in), show it immediately.
          revealReadingNotificationIfOnPlanTab();
        }

        // Whatever login-only feature (Records, Cords, My Margins, Start Plan, a
        // margin note, "Listen aloud", …) sent the person to the login modal in
        // the first place now gets to finish what it was doing, instead of just
        // leaving them logged in on whatever page happened to be behind the modal.
        hideLoginModal();
        resolvePendingAuthAction();

        // The rest of the public content (Bible text, Study tab) may already be
        // loaded if this login happened mid-session as a guest — only run the full
        // startup sequence once per page load.
        if (appHasInitialized) showLoader(false);
        else await initializeApp();
      } else {
        currentUser = null;
        updateAuthHeaderUI();
        // No forced login screen — browsing works fully signed out. The modal
        // only ever appears when a login-only feature calls openLoginModal()/
        // ensureLoggedInFor(), or the person opens it themselves from the header.
        document.getElementById('app-screen').style.display = 'block';
        updateShareSignupBanner();
        if (appHasInitialized) showLoader(false);
        else await initializeApp();
      }
    }

    // Handle login or signup submission
    async function handleAuth() {
      const email = document.getElementById('auth-email').value.trim();
      const password = document.getElementById('auth-password').value.trim();
      const errorEl = document.getElementById('login-error');
      const rememberCheckbox = document.getElementById('remember-device-checkbox');

      // Reset message styling
      errorEl.style.display = 'none';
      errorEl.style.color = 'var(--accent-coral)';

      if (!email || !password) {
        errorEl.innerText = 'Please enter both email and password.';
        errorEl.style.display = 'block';
        return;
      }

      // Decided before the sign-in/sign-up call so the storage adapter (see
      // rememberAwareAuthStorage, top of file) already knows where to persist the
      // session tokens Supabase is about to write — never the password itself.
      setRememberDevicePreference(!!(rememberCheckbox && rememberCheckbox.checked));

      let response;
      if (isSignUpMode) {
        response = await supabaseClient.auth.signUp({
          email, password,
          options: { emailRedirectTo: originalShareUrl || window.location.href }
        });
      } else {
        response = await supabaseClient.auth.signInWithPassword({ email, password });
      }

      if (response.error) {
        errorEl.innerText = response.error.message;
        errorEl.style.display = 'block';
      } else if (response.data.session) {
        checkUserSession();
      } else if (response.data.user && !response.data.session) {
        errorEl.style.color = 'var(--accent-teal)';
        errorEl.innerText = 'Success! Please check your email to confirm your account.';
        errorEl.style.display = 'block';
      }
    }

    // Logout Function
    async function logout() {
      await supabaseClient.auth.signOut();
      // Must run before currentUser is cleared — it needs the (about to be
      // former) user's id to find and remove that account's own Cords cache.
      resetCordStateForLogout();
      currentUser = null;
      updateAuthHeaderUI();
      document.getElementById('auth-email').value = '';
      document.getElementById('auth-password').value = '';

      // The Reading Updates box, its nav badge, and the loaded schedule/progress
      // are all that former user's own data — clear them out so a guest (or the
      // next person on this device) never sees a stale "Reading Updates" message
      // left over from whoever just signed out.
      cachedScheduleDays = [];
      currentPlanStartDate = null;
      currentPlanViewDayNumber = null;
      readingNotificationMessage = null;
      readingNotificationSeen = false;
      lastSeenReadingMessage = null;
      const notifPanel = document.getElementById('reading-notification-panel');
      if (notifPanel) notifPanel.style.display = 'none';
      const notifBadge = document.getElementById('reading-notification-badge');
      if (notifBadge) notifBadge.style.display = 'none';
      const notifBody = document.getElementById('reading-notif-body');
      if (notifBody) notifBody.innerText = '';

      // Margin notes are this account's own private annotations. Unlike most other
      // views, they're painted directly into the Bible view's verse rows (highlight
      // color + textarea text) with no per-render login check — so a guest browsing
      // the Bible view right after this person logs out would otherwise still see
      // their notes sitting there untouched. Clearing the data isn't enough on its
      // own since switchTab() below doesn't force a re-render of a tab that's
      // already active — so also force the verse grid to repaint right now.
      window.userMarginNotes = {};
      const chapterTitleEl = document.getElementById('current-chapter-title');
      const translationEl = document.getElementById('translation-select');
      if (chapterTitleEl && translationEl) {
        processLoadedVerses(chapterTitleEl.value, translationEl.value);
      }

      // Record badges/achievement counts are just as personal, and the header
      // bubble reads userRecordsMap directly with no login check of its own —
      // clear the cache and repaint the bubble now rather than leaving the former
      // user's count showing until someone happens to reopen Records.
      userRecordsMap = {};
      updateRecordsNotificationBadge();
      const recordsGrid = document.getElementById('record-badges-grid');
      if (recordsGrid) recordsGrid.innerHTML = '';

      // My Margins renders straight into this container, which stays in the DOM
      // (just hidden) whenever that tab isn't the active one — empty it out too so
      // nothing of the former user's notes is left sitting there to be reopened.
      const marginsContainer = document.getElementById('mymargins-print-area');
      if (marginsContainer) marginsContainer.innerHTML = '';

      // The Line Upon Line "Add Resource" form is admin-only and, being a
      // persistent element outside #resource-grid, would otherwise sit there with
      // whatever this admin was mid-typing — clear and collapse it so the next
      // person (guest or a different admin) never finds someone else's draft.
      // renderResourcesTab() below (via switchTab -> switchStudySubTab, if that's
      // the tab left open) also hides the row itself now that currentUser is null.
      if (typeof cancelLineUponLineAddForm === 'function') cancelLineUponLineAddForm();

      // Guests keep browsing — send them back to a normal tab rather than any
      // account-only view (Records/Cords/My Margins/Settings) they might have
      // been on, since that view's data no longer belongs to anyone signed in.
      switchTab(lastMainTabId || 'bible');
      // switchTab() re-renders the active tab's own content, but the Reading Plan
      // tab's day/calendar view isn't tied to tab-switching — repaint it directly
      // so it reflects "no plan loaded" immediately if it's the tab left open.
      renderActivePlanView();
      updatePlanStartRestartButton();
    }

    // ============ LOGIN MODAL (popup, not a forced first screen) ============
    // Toggles the header between "Logged in as X / Logout" and "Browsing as
    // guest / Log In" — called on every auth state change (login, logout, and
    // the initial guest/session check on page load).
    function updateAuthHeaderUI() {
      const loggedIn = !!currentUser;
      const loggedInLine = document.getElementById('user-info-logged-in');
      const guestLine = document.getElementById('user-info-guest');
      const logoutBtn = document.getElementById('logout-btn');
      const loginBtn = document.getElementById('header-login-btn');
      if (loggedInLine) loggedInLine.style.display = loggedIn ? 'flex' : 'none';
      if (guestLine) guestLine.style.display = loggedIn ? 'none' : 'flex';
      if (logoutBtn) logoutBtn.style.display = loggedIn ? 'inline' : 'none';
      if (loginBtn) loginBtn.style.display = loggedIn ? 'none' : 'inline';
    }

    // Holds one callback to resume automatically once login succeeds — e.g.
    // tapping "Listen aloud" while signed out queues up actually starting
    // playback, so a successful sign-in picks up right where the person left off
    // instead of just dropping them back on whatever page was behind the modal.
    let pendingAuthAction = null;

    function openLoginModal(reasonMessage, onSuccess) {
      pendingAuthAction = onSuccess || null;
      const reasonEl = document.getElementById('login-modal-reason');
      if (reasonEl) {
        if (reasonMessage) { reasonEl.textContent = reasonMessage; reasonEl.style.display = 'block'; }
        else reasonEl.style.display = 'none';
      }
      const errorEl = document.getElementById('login-error');
      if (errorEl) errorEl.style.display = 'none';
      updateShareSignupBanner();
      document.getElementById('login-screen').style.display = 'flex';
    }

    // Hides the modal without discarding a queued pendingAuthAction — used when
    // login just succeeded and that action is about to run.
    function hideLoginModal() {
      document.getElementById('login-screen').style.display = 'none';
    }

    // The person dismissed the modal themselves (× button or clicking the
    // backdrop) without signing in — whatever feature was waiting on login stays
    // undone, so drop the queued action rather than firing it on some later,
    // unrelated sign-in.
    function closeLoginModal() {
      hideLoginModal();
      pendingAuthAction = null;
    }

    function resolvePendingAuthAction() {
      if (typeof pendingAuthAction === 'function') {
        const action = pendingAuthAction;
        pendingAuthAction = null;
        action();
      }
    }

    // The single gate every login-only feature calls first. Logged in: runs
    // `action` (if given) immediately and returns true. Signed out: pops the
    // login modal with a short explanation of what needs signing in, queues
    // `action` to resume automatically after a successful login, and returns
    // false so the caller can stop (e.g. revert a checkbox it already flipped).
    function ensureLoggedInFor(reasonMessage, action) {
      // Already signed in: just tell the caller to proceed with what it was
      // already doing — NOT invoke `action` here too. `action` exists solely to
      // be replayed later by resolvePendingAuthAction() after a login that
      // hasn't happened yet; several callers pass a closure that calls the very
      // function currently running (e.g. `() => openRecordsView()`), so firing
      // it here as well would re-enter that same function a second time on
      // every already-logged-in call — and, for a self-referencing action,
      // recurse forever.
      if (currentUser) return true;
      openLoginModal(reasonMessage, action);
      return false;
    }

    // --- FETCH USER MARGIN NOTES FROM SUPABASE ---
    // window.userMarginNotes maps reference -> { color, text } directly (matches the
    // margin_notes table's separate `color` / `note_text` columns).
    async function fetchUserMarginNotes() {
      if (!currentUser) return;
      const { data, error } = await marginNotesTable
        .select('reference, color, note_text')
        .eq('user_id', currentUser.id);

      if (!error && data) {
        window.userMarginNotes = {};
        data.forEach(item => {
          window.userMarginNotes[item.reference] = { color: item.color || '#000000', text: fixMojibakeText(item.note_text || '') };
        });
      } else {
        console.error('Error fetching margin notes:', error?.message);
      }
    }

    // Returns { color, text } for a reference, from the Supabase-synced cache.
    function getMarginNote(reference) {
      if (window.userMarginNotes && window.userMarginNotes[reference]) {
        return window.userMarginNotes[reference];
      }
      return { color: '#000000', text: '' };
    }

    // --- TAB SWITCHING & VIEWS ---
    let lastMainTabId = 'bible'; // remembers which real tab to return to when leaving the Cords view

    // Marks one of the header icon buttons (MyMargins / Records / Cords) as "selected"
    // (scaled up, thicker lines — see .header-icon-btn.selected in the stylesheet) and
    // clears the others. Pass null to clear all three (e.g. when a main tab is shown).
    function setHeaderIconSelected(btnId) {
      document.querySelectorAll('.header-icon-btn').forEach(btn => btn.classList.remove('selected'));
      if (btnId) {
        const btn = document.getElementById(btnId);
        if (btn) btn.classList.add('selected');
      }
    }

    function switchTab(tabId) {
      // My Margins is entirely account-bound (it's a view of the signed-in
      // user's own margin notes) — pop the login modal instead of switching to
      // an empty/nonsensical view, and land there automatically on success.
      if (tabId === 'mymargins' && !ensureLoggedInFor('Sign in to see your saved margin notes.', () => switchTab('mymargins'))) return;
      // Deliberately NOT stopping Daily Reading TTS here anymore — switching
      // nav-tabs mid-read now keeps it playing in the background and surfaces
      // the same global "Now Playing" mini player every audio/video in the app
      // uses (see registerDailyReadingMediaController / updateMiniPlayerVisibility),
      // once daily-reading-tts-btn itself becomes hidden below.
      document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
      setHeaderIconSelected(tabId === 'mymargins' ? 'mymargins-header-btn' : null);
      const notifPanel = document.getElementById('reading-notification-panel');
      if (notifPanel) notifPanel.style.display = 'none';

      if (tabId === 'bible' || tabId === 'plan' || tabId === 'study') {
        lastMainTabId = tabId;
      }
      if (tabId === 'bible' || tabId === 'plan' || tabId === 'study' || tabId === 'mymargins') {
        // Leaving the Cords view (to any real tab) — stop its background poll.
        if (typeof cordPollTimer !== 'undefined' && cordPollTimer) { clearInterval(cordPollTimer); cordPollTimer = null; }
      }

      if (tabId === 'bible') {
        document.querySelector('.nav-btn:nth-child(1)').classList.add('active');
        document.getElementById('bible-tab').classList.add('active');
      } else if (tabId === 'plan') {
        document.querySelector('.nav-btn:nth-child(2)').classList.add('active');
        document.getElementById('plan-tab').classList.add('active');
        revealReadingNotificationIfOnPlanTab();
        revealDailyReadingTtsWrapOnce();
      } else if (tabId === 'study') {
        document.querySelector('.nav-btn:nth-child(3)').classList.add('active');
        document.getElementById('study-tab').classList.add('active');
        renderResourcesTab();
        markStudySubTabSeen(getActiveStudySubTab());
        hintStudySubTabsSlider();
      } else if (tabId === 'mymargins') {
        document.getElementById('mymargins-tab').classList.add('active');
        renderMyMargins();
      }
    }

    // --- INITIALIZATION ---
    async function initializeApp() {
      showLoader(true);
      updateStudyNotificationBadges();

      const sel = document.getElementById('translation-select');
      sel.innerHTML = TRANSLATIONS.map(t => `<option value="${t.code}" ${t.code === DEFAULT_TRANSLATION ? 'selected' : ''}>${t.code}</option>`).join('');
      const planSel = document.getElementById('plan-translation-select');
      planSel.innerHTML = TRANSLATIONS.map(t => `<option value="${t.code}" ${t.code === DEFAULT_TRANSLATION ? 'selected' : ''}>${t.code}</option>`).join('');

      try {
        const { data: schedules, error: schedError } = await readingSchedulesTable.select('schedule_name');
        if (schedError) throw schedError;
        const uniqueNames = [...new Set((schedules || []).map(s => s.schedule_name))];
        document.getElementById('schedule-select').innerHTML = uniqueNames.map(s => `<option value="${s}">${s}</option>`).join('');
      } catch (e) {
        console.error('Error loading schedules:', e.message);
      }

      try {
        const localData = localStorage.getItem(`bible_${DEFAULT_TRANSLATION}`);
        if (localData) {
          // Instant paint from cache while a fresh copy loads in the background.
          try {
            const cached = JSON.parse(localData);
            bibleCache[DEFAULT_TRANSLATION] = cached;
            currentBibleVerses = cached;
            cachedChaptersList = null;
            processLoadedVerses('Genesis 1', DEFAULT_TRANSLATION);
            renderResourcesTab();
            updateStudyNotificationBadges();
            showLoader(false);
          } catch (e) { /* fall through to fresh load below */ }
        }

        const scheduleLoadPromise = loadReadingSchedule();
        // Shelf groups load alongside the books themselves (not just when an admin
        // opens Manage Content) so every viewer resolves a grouped book's color/
        // height from the current shared group — not a possibly-stale value left
        // over on that book's own row from before the group's color last changed.
        const bibleStudyBooksLoadPromise = Promise.all([loadBibleStudyBooksFromDB(), loadBookShelfGroups()]).then(() => {
          updateStudyNotificationBadges();
          if (document.getElementById('study-sub-bible-studies-content')?.classList.contains('active')) {
            renderBibleStudyShelf();
          }
        });

        const foundationsLoadPromise = loadFoundationsContent().then(() => {
          updateStudyNotificationBadges();
          if (document.getElementById('study-sub-foundations-content')?.classList.contains('active')) {
            renderFoundationsTab();
          }
        });

        const twCourseLoadPromise = Promise.all([loadTWBibleCourseFromDB(), loadTWCourseProgress()]).then(() => {
          updateStudyNotificationBadges();
          if (document.getElementById('study-sub-course-content')?.classList.contains('active')) {
            renderTWModuleList();
          }
        });

        await loadBibleData(DEFAULT_TRANSLATION);
        const titleEl = document.getElementById('current-chapter-title');
        processLoadedVerses(titleEl ? titleEl.value : 'Genesis 1', DEFAULT_TRANSLATION);
        renderResourcesTab();
        updateStudyNotificationBadges();
        startLiveSync();

        // Bible verse text may not have been loaded yet when loadReadingSchedule() first
        // rendered the Daily Reading view (it fires in parallel, above) — re-render now
        // that both are guaranteed done, so Day 1's scripture shows immediately instead
        // of only appearing after navigating to another day and back.
        await scheduleLoadPromise;
        renderActivePlanView();
        await bibleStudyBooksLoadPromise;
        await foundationsLoadPromise;
        await twCourseLoadPromise;
        await applyPendingShareTarget();
      } finally {
        appHasInitialized = true;
        showLoader(false);
      }
    }

    // A Church Resource's `reference` column can name more than one verse at once
    // (e.g. "Genesis 1:1, John 3:16") so a single resource can be tied to multiple
    // scriptures — no schema change needed, since it was already a free-text
    // column; this just splits it back apart for grouping. Order doesn't matter
    // here since every caller re-groups by target reference anyway.
    function parseChurchResourceReferenceList(referenceField) {
      return (referenceField || '').split(',').map(s => s.trim()).filter(Boolean);
    }

    // Fetches every verse + its text in the given translation, merged with current
    // church resources, and stores it in bibleCache/currentBibleVerses.
    async function loadBibleData(translationCode) {
      const col = translationColumn(translationCode);
      const verseRows = await fetchAllRows('verses', `id, scripture, "${col}"`);
      const resourceRows = await fetchAllRows('church_resources', 'id, reference, title, url, type, tags, notes, thumbnail_url, thumbnail_hidden');

      const resourcesByRef = {};
      resourceRows.forEach(r => {
        if (!(r.title || r.url || r.notes)) return; // skip empty placeholder rows
        // The same item object is shared across every reference it's tied to, so
        // editing or deleting it later (by id) updates/removes every copy at once.
        const item = { id: r.id, resource: r.url, title: fixMojibakeText(r.title || ''), type: r.type, tags: fixMojibakeText(r.tags || ''), notes: fixMojibakeText(r.notes || ''), thumbnail: r.thumbnail_url || '', thumbnailHidden: !!r.thumbnail_hidden };
        parseChurchResourceReferenceList(r.reference).forEach(ref => {
          if (!resourcesByRef[ref]) resourcesByRef[ref] = [];
          resourcesByRef[ref].push(item);
        });
      });

      const verses = verseRows.map(row => ({
        rowIndex: row.id,
        reference: row.scripture,
        text: fixMojibakeText(row[col]),
        resources: resourcesByRef[row.scripture] || []
      }));

      bibleCache[translationCode] = verses;
      currentBibleVerses = verses;
      cachedChaptersList = null;
      saveToLocalCache(translationCode, verses);
      return verses;
    }

    function handleTranslationChange() {
      const translation = document.getElementById('translation-select').value;

      const searchVal = document.getElementById('bible-search-box').value.trim();
      if (searchVal) {
        processBibleSearch();
      } else {
        loadChapterByReference('Genesis 1');
      }
    }

    // --- BIBLE VIEW & SEARCH LOGIC ---
    function getAllChaptersList() {
      if (cachedChaptersList) return cachedChaptersList;
      if (!currentBibleVerses || currentBibleVerses.length === 0) return [];
      const map = new Map();
      currentBibleVerses.forEach(v => {
        const parts = v.reference.split(':');
        if (parts.length > 0) {
          const lastSpace = parts[0].lastIndexOf('othic') !== -1 ? parts[0].lastIndexOf('othic') : parts[0].lastIndexOf(' ');
          if (lastSpace !== -1) {
            const book = parts[0].substring(0, lastSpace);
            const ch = parts[0].substring(lastSpace + 1);
            if (!map.has(book)) {
              map.set(book, []);
            }
            const chapters = map.get(book);
            if (!chapters.includes(ch)) {
              chapters.push(ch);
            }
          }
        }
      });
      let list = [];
      map.forEach((chs, book) => {
        chs.forEach(ch => {
          list.push(`${book} ${ch}`);
        });
      });
      cachedChaptersList = list;
      return list;
    }

    async function loadChapterByReference(chapterPrefix) {
      const translation = document.getElementById('translation-select').value;

      const localData = localStorage.getItem(`bible_${translation}`);
      if (localData && !bibleCache[translation]) {
        try { bibleCache[translation] = JSON.parse(localData); } catch (e) {}
      }

      if (bibleCache[translation]) {
        // Already have this translation in memory — render immediately, no network call.
        currentBibleVerses = bibleCache[translation];
        processLoadedVerses(chapterPrefix, translation);
        return;
      }

      // First time loading this translation — need the real fetch.
      showLoader(true);
      try {
        await loadBibleData(translation);
        processLoadedVerses(chapterPrefix, translation);
        renderResourcesTab();
        updateStudyNotificationBadges();
      } catch (e) {
        console.error('Error loading Bible data:', e.message);
      } finally {
        showLoader(false);
      }
    }

    // Bible text itself never changes, so live-sync only re-pulls church resources
    // (which admins can edit) rather than re-fetching all ~31k verse rows. Started once
    // at init and reads the currently-displayed chapter/translation from the DOM each
    // tick, so it survives chapter navigation without being torn down and restarted.
    //
    // isUserTyping alone isn't enough to protect the DOM this poll rebuilds: it only
    // stays true for 2 seconds after the last keystroke, which doesn't cover someone
    // who pauses longer than that mid-form (to think, copy-paste, or fill in several
    // fields), or who has a native <select> dropdown open (opening one never fires an
    // 'input' event at all). isLiveSyncRenderUnsafe() below covers those longer-lived
    // cases so a poll landing mid-interaction skips the destructive re-render instead
    // of wiping it out — see its own comment for exactly what it checks.
    function isLiveSyncRenderUnsafe() {
      // An admin resource edit form (Note view or Line Upon Line) is open — its fields
      // are populated from the fetched row, so rebuilding it now would overwrite
      // whatever the admin has already typed with the original, unedited values.
      if (editingChurchResourceId != null) return true;

      // The Note view's per-verse "add a new resource" inputs are always present for
      // an admin (not gated by any open/closed flag), so the only way to tell one has
      // unsaved work is to check whether it actually has typed content. The reference
      // field is the one exception: it auto-fills with this row's own verse (see
      // renderVerses), so it's never actually empty by default — only treat IT as
      // unsaved work if the admin has changed it away from that auto-filled default.
      const addFormFields = document.querySelectorAll(
        '#bible-text .church-resource-input-container input[type="text"], #bible-text .church-resource-input-container textarea'
      );
      for (const el of addFormFields) {
        if (el.classList.contains('church-reference-input')) {
          if (el.value.trim() !== (el.dataset.defaultRef || '')) return true;
          continue;
        }
        if (el.value && el.value.trim() !== '') return true;
      }

      // The book/chapter <select>s now live in their own persistent container
      // (renderBibleControlsRow reuses these exact nodes rather than rebuilding them),
      // so this poll landing mid-interaction can no longer yank the dropdown out from
      // under the user the way it used to. Still worth skipping the refresh while one
      // is open, though: a <select> stays document.activeElement for as long as its
      // native dropdown popup is showing, so this catches "the dropdown is currently
      // open" without needing a dedicated open/close flag, and avoids rewriting its
      // <option> list (and thus visually flickering the open popup) mid-browse.
      const active = document.activeElement;
      if (active && (active.id === 'book-select' || active.id === 'chapter-num-select')) return true;

      // A keyword search results list (clickable reference links) is showing in
      // #bible-text — rebuilding it now with the currently-loaded chapter would
      // wipe the whole list out (and the specific link the user was about to
      // click) and silently drop them back into the ordinary verse view.
      if (isSearchResultsShowing) return true;

      return false;
    }

    function startLiveSync() {
      if (liveSyncTimer) clearInterval(liveSyncTimer);
      liveSyncTimer = setInterval(async () => {
        if (isUserTyping) return;
        const translation = document.getElementById('translation-select').value;
        const titleEl = document.getElementById('current-chapter-title');
        const chapterPrefix = titleEl ? titleEl.value : 'Genesis 1';
        try {
          const resourceRows = await fetchAllRows('church_resources', 'id, reference, title, url, type, tags, notes, thumbnail_url, thumbnail_hidden');
          const resourcesByRef = {};
          resourceRows.forEach(r => {
            if (!(r.title || r.url || r.notes)) return;
            const item = { id: r.id, resource: r.url, title: fixMojibakeText(r.title || ''), type: r.type, tags: fixMojibakeText(r.tags || ''), notes: fixMojibakeText(r.notes || ''), thumbnail: r.thumbnail_url || '', thumbnailHidden: !!r.thumbnail_hidden };
            parseChurchResourceReferenceList(r.reference).forEach(ref => {
              if (!resourcesByRef[ref]) resourcesByRef[ref] = [];
              resourcesByRef[ref].push(item);
            });
          });
          currentBibleVerses.forEach(v => { v.resources = resourcesByRef[v.reference] || []; });
          bibleCache[translation] = currentBibleVerses;
          updateStudyNotificationBadges();

          const renderUnsafe = isLiveSyncRenderUnsafe();

          // If the user is already parked on "Line Upon Line" while this poll pulls in
          // a resource added elsewhere, refresh the on-screen list right now instead of
          // leaving it stale until their next click — otherwise the new entry wouldn't
          // even be visible yet for them to "see" (see renderResourcesTab, which marks
          // the bubble seen as part of this same render whenever the tab is visible).
          // Skipped while renderUnsafe, so it doesn't wipe out an in-progress edit.
          if (isResourcesSubTabVisible() && !renderUnsafe) renderResourcesTab();

          if (!isUserTyping && !renderUnsafe) {
            processLoadedVerses(chapterPrefix, translation);
          }
        } catch (e) {
          console.error('Live sync error:', e.message);
        }
      }, 10000);
    }

    function processLoadedVerses(chapterPrefix, translation) {
      const res = currentBibleVerses;
      const filtered = res.filter(v => v.reference.toLowerCase().startsWith(chapterPrefix.toLowerCase() + ':') || v.reference.toLowerCase() === chapterPrefix.toLowerCase());
      
      if (filtered.length > 0) {
        renderVerses(filtered, chapterPrefix);
      } else {
        const exact = res.filter(v => v.reference.toLowerCase() === chapterPrefix.toLowerCase());
        if (exact.length > 0) {
          renderVerses(exact, chapterPrefix);
        } else {
          isSearchResultsShowing = false;
          document.getElementById('bible-text').innerHTML = `<p>Passage not found in ${translation}.</p>`;
        }
      }
    }

    async function processBibleSearch() {
      const query = document.getElementById('bible-search-box').value.trim();
      if (!query) {
        loadChapterByReference('Genesis 1');
        return;
      }

      const translation = document.getElementById('translation-select').value;
      if (bibleCache[translation]) {
        currentBibleVerses = bibleCache[translation];
        executeSearchQuery(query);
        return;
      }

      showLoader(true);
      try {
        await loadBibleData(translation);
        executeSearchQuery(query);
      } catch (e) {
        console.error('Error searching Bible data:', e.message);
      } finally {
        showLoader(false);
      }
    }

    function executeSearchQuery(query) {
      const res = currentBibleVerses;
      const refMatches = res.filter(v => v.reference.toLowerCase().includes(query.toLowerCase()));
      if (refMatches.length > 0 && (query.includes(':') || query.split(' ').length <= 2)) {
        const chapterMatches = res.filter(v => v.reference.toLowerCase().startsWith(query.toLowerCase() + ':') || v.reference.toLowerCase() === query.toLowerCase());
        if (chapterMatches.length > 0) {
          renderVerses(chapterMatches, query);
          return;
        }
        renderVerses(refMatches, query);
        return;
      }

      keywordResults = res.filter(v => v.text.toLowerCase().includes(query.toLowerCase()));
      currentPage = 1;
      renderSearchResults();
    }

    function renderSearchResults() {
      isSearchResultsShowing = true;
      const start = (currentPage - 1) * RESULTS_PER_PAGE;
      const end = start + RESULTS_PER_PAGE;
      const slice = keywordResults.slice(start, end);

      let html = `<p style="margin-bottom: 12px; color: var(--text-muted);">Found ${keywordResults.length} keyword matches.</p>`;
      slice.forEach(v => {
        html += `<div class="search-result" onclick="document.getElementById('bible-search-box').value='${v.reference}'; loadChapterByReference('${v.reference.split(':')[0]}')">
          <strong>${v.reference}</strong>: ${v.text}
        </div>`;
      });

      document.getElementById('bible-text').innerHTML = html;
      const totalPages = Math.ceil(keywordResults.length / RESULTS_PER_PAGE);
      let pageHtml = '';
      for (let i = 1; i <= totalPages; i++) {
        pageHtml += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="currentPage=${i}; renderSearchResults();">${i}</button>`;
      }
      document.getElementById('pagination-area').innerHTML = pageHtml;
    }

    function navigateChapter(direction) {
      const allChapters = getAllChaptersList();
      if (allChapters.length === 0) return;
      const currentTitle = document.getElementById('current-chapter-title');
      const currentVal = currentTitle ? currentTitle.value : allChapters[0];
      const index = allChapters.indexOf(currentVal);
      
      let targetIndex = index;
      if (direction === '<') {
        targetIndex = Math.max(0, index - 1);
      } else if (direction === '>') {
        targetIndex = Math.min(allChapters.length - 1, index + 1);
      } else if (direction === '<<') {
        if (index === -1) return;
        const currentBook = currentVal.substring(0, currentVal.lastIndexOf(' '));
        let newIndex = index;
        for (let i = index; i >= 0; i--) {
          if (!allChapters[i].startsWith(currentBook)) {
            newIndex = i;
            break;
          }
        }
        const prevBook = allChapters[newIndex].substring(0, allChapters[newIndex].lastIndexOf(' '));
        for (let i = 0; i < allChapters.length; i++) {
          if (allChapters[i].startsWith(prevBook)) {
            targetIndex = i;
            break;
          }
        }
      } else if (direction === '>>') {
        if (index === -1) return;
        const currentBook = currentVal.substring(0, currentVal.lastIndexOf(' '));
        let targetBook = '';
        for (let i = index; i < allChapters.length; i++) {
          if (!allChapters[i].startsWith(currentBook)) {
            targetBook = allChapters[i].substring(0, allChapters[i].lastIndexOf(' '));
            break;
          }
        }
        if (targetBook) {
          for (let i = 0; i < allChapters.length; i++) {
            if (allChapters[i].startsWith(targetBook)) {
              targetIndex = i;
              break;
            }
          }
        } else {
          targetIndex = allChapters.length - 1;
        }
      }

      const targetChapter = allChapters[targetIndex];
      document.getElementById('bible-search-box').value = targetChapter;
      loadChapterByReference(targetChapter);
    }

    function toggleNotesCollapse() {
      const checkboxEl = document.getElementById('collapse-notes-checkbox');
      isNotesCollapsed = !checkboxEl.checked;
      const gridEl = document.querySelector('.bible-grid');
      if (gridEl) {
        if (isNotesCollapsed) gridEl.classList.add('collapse-notes');
        else gridEl.classList.remove('collapse-notes');
      }
    }

    function toggleResourcesCollapse() {
      const checkboxEl = document.getElementById('collapse-resources-checkbox');
      isResourcesCollapsed = !checkboxEl.checked;
      const gridEl = document.querySelector('.bible-grid');
      if (gridEl) {
        if (isResourcesCollapsed) gridEl.classList.add('collapse-resources');
        else gridEl.classList.remove('collapse-resources');
      }
    }

    function parseNoteContent(rawNote) {
      if (!rawNote) return { color: '#000000', text: '' };
      try {
        const parsed = JSON.parse(rawNote);
        if (parsed && typeof parsed === 'object' && parsed.hasOwnProperty('text')) {
          return { color: parsed.color || '#000000', text: parsed.text || '' };
        }
      } catch (e) {}
      return { color: '#000000', text: rawNote };
    }

    function hexToRgba(hex, alpha) {
      let c = hex.replace('#', '');
      if (c.length === 3) c = c.split('').map(char => char + char).join('');
      const num = parseInt(c, 16);
      return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
    }

    function applyMarginNoteColor(rowIndex) {
      const selectEl = document.getElementById(`color-select-${rowIndex}`);
      const textEl = document.getElementById(`textarea-${rowIndex}`);
      const verseEl = document.getElementById(`verse-row-${rowIndex}`);
      if (!selectEl || !textEl || !verseEl) return;

      const selectedColor = selectEl.value;
      textEl.style.color = selectedColor;

      if (selectedColor.toLowerCase() === '#000000' || selectedColor.toLowerCase() === 'black') {
        verseEl.style.backgroundColor = '';
        verseEl.style.padding = '';
        verseEl.style.borderRadius = '';
      } else {
        verseEl.style.backgroundColor = hexToRgba(selectedColor, 0.15);
        verseEl.style.padding = '2px 4px';
        verseEl.style.borderRadius = '4px';
      }
    }

    // Per-row debounce timers for autoSaveUserNote below — keyed so editing
    // multiple notes' debounce windows never interfere with each other.
    const autoSaveNoteTimers = {};

    // Automatically save margin notes tied securely to the authenticated user's ID
    async function autoSaveUserNote(rowIndex, verseRef) {
      if (!currentUser) return;
      const selectEl = document.getElementById(`color-select-${rowIndex}`);
      const textEl = document.getElementById(`textarea-${rowIndex}`);
      const statusEl = document.getElementById(`status-${rowIndex}`);
      if (!selectEl || !textEl) return;

      const color = selectEl.value;
      const text = textEl.value;
      if (statusEl) statusEl.innerText = 'Saving...';

      // Keep local sync cache updated immediately — other views (MyMargins,
      // the margin-notes-count badge check) read this synchronously, so it
      // shouldn't wait on the debounce below.
      if (!window.userMarginNotes) window.userMarginNotes = {};
      window.userMarginNotes[verseRef] = { color, text };

      // Debounce the actual network save: this function runs on every
      // keystroke, and an upsert (plus the badge re-check it triggers) on
      // every single character typed is wasted work — wait for a short pause
      // in typing instead of saving mid-word every time.
      if (autoSaveNoteTimers[rowIndex]) clearTimeout(autoSaveNoteTimers[rowIndex]);
      autoSaveNoteTimers[rowIndex] = setTimeout(async () => {
        delete autoSaveNoteTimers[rowIndex];

        const { error } = await marginNotesTable.upsert({
          user_id: currentUser.id,
          reference: verseRef,
          color: color,
          note_text: text,
          updated_at: new Date()
        }, null, { onConflict: 'user_id,reference' });

        if (!error) {
          if (statusEl) {
            statusEl.innerText = 'Saved';
            setTimeout(() => { statusEl.innerText = ''; }, 1500);
          }
          await checkMarginNotesCountBadges();
        } else {
          if (statusEl) statusEl.innerText = 'Error saving';
          console.error('Save error:', error.message);
        }
      }, 600);
    }

    function focusMarginNote(rowIndex) {
      if (!ensureLoggedInFor('Sign in to add margin notes.')) return;
      const textEl = document.getElementById(`textarea-${rowIndex}`);
      if (textEl) textEl.focus();
    }

    function getBooksList() {
      const allChapters = getAllChaptersList();
      const books = [];
      const seen = new Set();
      allChapters.forEach(ch => {
        const book = ch.substring(0, ch.lastIndexOf(' '));
        if (!seen.has(book)) { seen.add(book); books.push(book); }
      });
      return books;
    }

    function getChaptersForBook(book) {
      const allChapters = getAllChaptersList();
      return allChapters
        .filter(ch => ch.startsWith(book + ' '))
        .map(ch => ch.substring(book.length + 1));
    }

    function handleBookSelectChange() {
      const book = document.getElementById('book-select').value;
      const chapters = getChaptersForBook(book);
      const firstChapter = chapters.length > 0 ? chapters[0] : '1';
      loadChapterByReference(`${book} ${firstChapter}`);
    }

    function handleChapterSelectChange() {
      const book = document.getElementById('book-select').value;
      const chapterNum = document.getElementById('chapter-num-select').value;
      loadChapterByReference(`${book} ${chapterNum}`);
    }

    // Builds/updates the book-select, chapter-select, hidden chapter-title input,
    // and prev/next nav buttons. Lives in its own persistent container
    // (#bible-book-chapter-row, outside of #bible-text) specifically so that on
    // every call after the first, the EXISTING <select> nodes are reused (their
    // <option> lists rewritten in place) rather than the whole row being torn
    // down and rebuilt from an innerHTML string.
    //
    // That reuse matters because renderVerses() runs very often — every chapter
    // navigation, the live-sync poll, a translation switch — and used to replace
    // these selects with brand-new DOM nodes every single time. Doing that while
    // the browser is still finishing its own native handling of whatever
    // interaction triggered the re-render (closing a just-used dropdown, moving
    // focus) could cause the very next click on the neighboring select to get
    // eaten — it looks like "the chapter dropdown just closes on me", needing a
    // second, clean click to actually register. Most noticeable right after
    // changing the book, since that's the one change that always re-renders.
    function renderBibleControlsRow(title) {
      const container = document.getElementById('bible-book-chapter-row');
      if (!container) return;

      const books = getBooksList();
      const currentBook = title.includes(' ') ? title.substring(0, title.lastIndexOf(' ')) : title;
      const currentChapterNum = title.includes(' ') ? title.substring(title.lastIndexOf(' ') + 1) : '';
      const chaptersForCurrentBook = getChaptersForBook(currentBook);

      const bookOptions = books.length > 0
        ? books.map(b => `<option value="${b}" ${b.toLowerCase() === currentBook.toLowerCase() ? 'selected' : ''}>${b}</option>`).join('')
        : `<option value="${currentBook}" selected>${currentBook}</option>`;

      const chapterOptions = chaptersForCurrentBook.length > 0
        ? chaptersForCurrentBook.map(c => `<option value="${c}" ${c === currentChapterNum ? 'selected' : ''}>${c}</option>`).join('')
        : `<option value="${currentChapterNum}" selected>${currentChapterNum}</option>`;

      const existingBookSelect = document.getElementById('book-select');
      const existingChapterSelect = document.getElementById('chapter-num-select');
      const existingTitleInput = document.getElementById('current-chapter-title');

      if (existingBookSelect && existingChapterSelect && existingTitleInput) {
        // Rewriting a select's <option> children (rather than replacing the
        // <select> element itself) never disturbs its identity/focus — only
        // touch each one if its options actually changed, as a further no-op
        // guard for the common case (same book, just re-rendering).
        if (existingBookSelect.innerHTML !== bookOptions) existingBookSelect.innerHTML = bookOptions;
        if (existingChapterSelect.innerHTML !== chapterOptions) existingChapterSelect.innerHTML = chapterOptions;
        existingTitleInput.value = title;
        return;
      }

      // First time this container has ever been populated this page load.
      container.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; border-bottom:1px solid var(--border-color); padding-bottom:8px; margin-top:0; gap:10px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <select id="book-select" style="font-family:var(--font-heading); font-size:18px; color:var(--primary-color); border:1px solid var(--border-color); border-radius:var(--border-radius); background:transparent; cursor:pointer; padding:4px 8px;" onchange="handleBookSelectChange()">
              ${bookOptions}
            </select>
            <select id="chapter-num-select" style="font-family:var(--font-heading); font-size:18px; color:var(--primary-color); border:1px solid var(--border-color); border-radius:var(--border-radius); background:transparent; cursor:pointer; padding:4px 8px; min-width:64px;" onchange="handleChapterSelectChange()">
              ${chapterOptions}
            </select>
          </div>
          <input type="hidden" id="current-chapter-title" value="${title}">
          <div style="display:flex; align-items:center; gap:6px;">
            <button class="page-btn" onclick="navigateChapter('<<')" title="Go back a book">&lt;&lt;</button>
            <button class="page-btn" onclick="navigateChapter('&lt;')" title="Go back a chapter">&lt;</button>
            <button class="page-btn" onclick="navigateChapter('&gt;')" title="Go forward a chapter">&gt;</button>
            <button class="page-btn" onclick="navigateChapter('>>')" title="Go forward a book">&gt;&gt;</button>
          </div>
        </div>`;
    }

    function renderVerses(verses, title) {
      // Whatever was previously in #bible-text (in particular, a keyword search
      // results list) is about to be replaced by the normal verse grid below.
      isSearchResultsShowing = false;
      renderBibleControlsRow(title);

      let gridHtml = `
        <div class="margin-title" style="grid-column: span 3;">
          <span>Scripture Text</span>
          <label class="margin-title-notes" style="display:flex; align-items:center; gap:6px; cursor:pointer; font-weight:normal; text-transform:none;">
            <input type="checkbox" class="plan-checkbox" id="collapse-notes-checkbox" ${!isNotesCollapsed ? 'checked' : ''} onchange="toggleNotesCollapse()">Margin Notes
          </label>
          <label class="margin-title-resources" style="display:flex; align-items:center; gap:6px; cursor:pointer; font-weight:normal; text-transform:none;">
            <input type="checkbox" class="plan-checkbox" id="collapse-resources-checkbox" ${!isResourcesCollapsed ? 'checked' : ''} onchange="toggleResourcesCollapse()">Church Resources
          </label>
        </div>`;
      
      verses.forEach(v => {
        const colonIdx = v.reference.indexOf(':');
        const verseNumOnly = colonIdx !== -1 ? v.reference.substring(colonIdx + 1) : v.reference;
        
        churchResourcesMap[v.rowIndex] = v.resources || [];

        const noteObj = getMarginNote(v.reference);
        const noteColor = noteObj.color || '#000000';
        const isNotBlack = noteColor.toLowerCase() !== '#000000' && noteColor.toLowerCase() !== 'black';
        const verseStyle = isNotBlack ? `style="background-color: ${hexToRgba(noteColor, 0.15)}; padding: 2px 4px; border-radius: 4px;"` : '';

        gridHtml += `
          <div class="verse-row-wrap">
            <div class="verse-row" id="verse-row-${v.rowIndex}" ${verseStyle}>
              <span><sup class="verse-ref" onclick="focusMarginNote(${v.rowIndex})">${verseNumOnly}</sup>${v.text}</span>
            </div>
            <div class="verse-share-cell">
              <button class="share-btn" title="Share this verse" onclick="shareVerse('${v.reference}')">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
              </button>
            </div>
          </div>
          <div class="margin-note-card" id="margin-card-${v.rowIndex}">
            <div class="margin-note-header">
              <span id="status-${v.rowIndex}" style="color: green; font-size: 11px; font-weight: normal;"></span>
              <div class="margin-note-controls">
                <img src="https://ndjyjqubaxldzimoagfl.supabase.co/storage/v1/object/public/Assets/Images/notes-icon.png" alt="Margin Notes" style="width: 56px; height: 56px; object-fit: contain; margin-bottom: 2px;">
                <select class="color-select" id="color-select-${v.rowIndex}" onchange="if (!ensureLoggedInFor('Sign in to add margin notes.')) { this.value = '${noteColor}'; return; } applyMarginNoteColor(${v.rowIndex}); autoSaveUserNote(${v.rowIndex}, '${v.reference}')">
                  <option value="#000000" ${noteColor === '#000000' ? 'selected' : ''}>None</option>
                  <option value="#e11d48" ${noteColor === '#e11d48' ? 'selected' : ''}>Red</option>
                  <option value="#ea580c" ${noteColor === '#ea580c' ? 'selected' : ''}>Orange</option>
                  <option value="#ca8a04" ${noteColor === '#ca8a04' ? 'selected' : ''}>Yellow</option>
                  <option value="#16a34a" ${noteColor === '#16a34a' ? 'selected' : ''}>Green</option>
                  <option value="#2563eb" ${noteColor === '#2563eb' ? 'selected' : ''}>Blue</option>
                  <option value="#4f46e5" ${noteColor === '#4f46e5' ? 'selected' : ''}>Indigo</option>
                  <option value="#7c3aed" ${noteColor === '#7c3aed' ? 'selected' : ''}>Violet</option>
                </select>
              </div>
            </div>
            <textarea id="textarea-${v.rowIndex}" style="color: ${noteColor};" placeholder="Add margin note..." onfocus="if (!ensureLoggedInFor('Sign in to add margin notes.')) this.blur();" oninput="autoSaveUserNote(${v.rowIndex}, '${v.reference}')">${noteObj.text}</textarea>
          </div>
          <div class="margin-note-card church-resource-column-cell" id="church-resources-card-${v.rowIndex}">
            ${currentUser && currentUser.isAdmin ? `
            <div class="church-resource-input-container" style="flex-direction: column; gap: 4px; margin-bottom: 8px;">
              <!-- Auto-fills with this row's own verse — see isLiveSyncRenderUnsafe(),
                   which special-cases .church-reference-input so this default,
                   non-empty value alone doesn't look like unsaved admin typing.
                   Still editable: change it to save the resource against a
                   different verse instead (validated in addChurchResource). -->
              <input type="text" id="church-reference-input-${v.rowIndex}" class="church-reference-input" data-default-ref="${v.reference}" value="${v.reference}" placeholder="Reference(s), e.g. Genesis 1:1, John 3:16..." style="width: 100%;">
              <input type="text" id="church-title-input-${v.rowIndex}" placeholder="Title (visible title)..." style="width: 100%;">
              <input type="text" id="church-resource-input-${v.rowIndex}" placeholder="URL..." style="width: 100%;">
              <input type="text" id="church-type-input-${v.rowIndex}" placeholder="Type..." style="width: 100%;">
              <input type="text" id="church-tags-input-${v.rowIndex}" placeholder="Tags (e.g. Grace, Faith)..." style="width: 100%;">
              <textarea id="church-notes-input-${v.rowIndex}" placeholder="Notes..." style="width: 100%; min-height: 40px; padding: 6px 10px; font-size: 13px; font-family: 'Plus Jakarta Sans', sans-serif; border: 1px solid var(--border-color); border-radius: var(--border-radius); resize: vertical;"></textarea>
              <input type="text" id="church-thumbnail-input-${v.rowIndex}" placeholder="Custom thumbnail URL (optional)..." style="width: 100%;">
              <label style="display:flex; align-items:center; gap:6px; font-size:12px; color:var(--text-muted); cursor:pointer; font-weight:normal;">
                <input type="checkbox" class="plan-checkbox" id="church-hide-thumbnail-input-${v.rowIndex}">Hide thumbnail
              </label>
              <button class="btn" style="padding: 6px 12px; font-size: 13px; width: 100%;" onclick="addChurchResource(${v.rowIndex}, '${v.reference}')">Save Resource</button>
            </div>` : ''}
            <div id="church-resources-list-${v.rowIndex}"></div>
          </div>`;
      });

      let gridClasses = ['bible-grid'];
      if (isNotesCollapsed) gridClasses.push('collapse-notes');
      if (isResourcesCollapsed) gridClasses.push('collapse-resources');
      let layoutHtml = `<div class="${gridClasses.join(' ')}">${gridHtml}</div>`;

      document.getElementById('bible-text').innerHTML = layoutHtml;
      document.getElementById('pagination-area').innerHTML = '';
      
      const notesCheckboxEl = document.getElementById('collapse-notes-checkbox');
      if (notesCheckboxEl) notesCheckboxEl.checked = !isNotesCollapsed;
      const resourcesCheckboxEl = document.getElementById('collapse-resources-checkbox');
      if (resourcesCheckboxEl) resourcesCheckboxEl.checked = !isResourcesCollapsed;
      
      verses.forEach(v => { updateChurchResourcesDOM(v.rowIndex, v.reference); });
    }

    // Shared insert path for a brand-new Church Resource, used by both the Note
    // view's per-verse "add a resource" form (addChurchResource, below) and the
    // Line Upon Line "Add Resource" form (addLineUponLineResource) — whichever
    // verse(s) the resource ultimately belongs to, it's saved and wired into local
    // state/the DOM exactly the same way. `targetVerses` is one or more resolved
    // verse objects (each with its own .rowIndex/.reference) — a single resource
    // can be tied to multiple scriptures at once, stored as one church_resources
    // row whose `reference` column holds every target reference, comma-separated
    // (see parseChurchResourceReferenceList). Returns true on success (state and
    // the affected views are already refreshed); false if the insert itself failed
    // (the error is already alert()ed here, matching every other save error in
    // this file, so the caller just needs to stop and leave the form as-is).
    async function saveNewChurchResource(targetVerses, fields) {
      const referenceField = targetVerses.map(v => v.reference).join(', ');
      const { data, error } = await churchResourcesTable.insert(
        { reference: referenceField, title: fields.title, url: fields.url, type: fields.type, tags: fields.tags, notes: fields.notes, thumbnail_url: fields.thumbnail, thumbnail_hidden: fields.thumbnailHidden },
        'id'
      );

      if (error) {
        console.error('Error saving resource:', error.message);
        alert('Could not save resource: ' + error.message);
        return false;
      }

      // One shared item object, pushed into every target verse's local lists, so
      // a later edit (which mutates this same object by id) or delete (which
      // removes it by id from everywhere) instantly stays consistent across all
      // of this resource's verses without needing a full reload.
      const newItem = { id: data.id, resource: fields.url, title: fields.title, type: fields.type, tags: fields.tags, notes: fields.notes, thumbnail: fields.thumbnail, thumbnailHidden: fields.thumbnailHidden };

      targetVerses.forEach(tv => {
        // churchResourcesMap[rowIndex] and its verse's own .resources array are
        // often already the very same array object (renderVerses aliases them —
        // see line ~3465), since the currently-open chapter renders on boot. Push
        // into whichever one already exists as the single source of truth, then
        // point the other at it too — pushing into both independently, when
        // they're already the same array, would silently double-add this item.
        const verseObj = currentBibleVerses.find(v => v.rowIndex === tv.rowIndex);
        const targetList = (verseObj && verseObj.resources) || churchResourcesMap[tv.rowIndex] || [];
        targetList.push(newItem);
        if (verseObj) verseObj.resources = targetList;
        churchResourcesMap[tv.rowIndex] = targetList;

        updateChurchResourcesDOM(tv.rowIndex, tv.reference);
      });

      renderResourcesTab();
      updateStudyNotificationBadges();
      return true;
    }

    async function addChurchResource(rowIndex, verseRef) {
      if (!currentUser || !currentUser.isAdmin) return;
      const inputTitle = document.getElementById(`church-title-input-${rowIndex}`);
      const inputRes = document.getElementById(`church-resource-input-${rowIndex}`);
      const inputType = document.getElementById(`church-type-input-${rowIndex}`);
      const inputTags = document.getElementById(`church-tags-input-${rowIndex}`);
      const inputNotes = document.getElementById(`church-notes-input-${rowIndex}`);
      const inputThumbnail = document.getElementById(`church-thumbnail-input-${rowIndex}`);
      const inputHideThumbnail = document.getElementById(`church-hide-thumbnail-input-${rowIndex}`);
      const inputReference = document.getElementById(`church-reference-input-${rowIndex}`);
      if (!inputRes) return;

      // The reference field auto-fills with this row's own verse (see renderVerses)
      // but stays editable — resolved/validated the same way the Line Upon Line
      // form does, so an admin who changes it still only ever saves against verses
      // that actually exist, wherever that ends up being. It also accepts more than
      // one reference, comma-separated, to tie this single resource to multiple
      // scriptures at once.
      const typedRef = inputReference ? inputReference.value.trim() : verseRef;
      const { verses: targetVerses, invalid } = resolveChurchResourceReferenceList(typedRef);
      if (!targetVerses) {
        const bad = invalid.length > 0 ? invalid.map(x => `"${x}"`).join(', ') : `"${typedRef}"`;
        alert(`${bad} isn't a recognized verse reference. Use the full book name and an exact chapter:verse, e.g. "Genesis 1:1" (separate multiple references with commas).`);
        return;
      }

      const titleText = inputTitle ? inputTitle.value.trim() : '';
      const resourceText = inputRes.value.trim();
      const typeText = inputType ? inputType.value.trim() : '';
      const tagsText = inputTags ? inputTags.value.trim() : '';
      const notesText = inputNotes ? inputNotes.value.trim() : '';
      const thumbnailText = inputThumbnail ? inputThumbnail.value.trim() : '';
      const hideThumbnail = inputHideThumbnail ? inputHideThumbnail.checked : false;

      const saved = await saveNewChurchResource(targetVerses, {
        title: titleText, url: resourceText, type: typeText, tags: tagsText, notes: notesText, thumbnail: thumbnailText, thumbnailHidden: hideThumbnail
      });
      if (!saved) return;

      if(inputTitle) inputTitle.value = '';
      if(inputRes) inputRes.value = '';
      if(inputType) inputType.value = '';
      if(inputTags) inputTags.value = '';
      if(inputNotes) inputNotes.value = '';
      if(inputThumbnail) inputThumbnail.value = '';
      if(inputHideThumbnail) inputHideThumbnail.checked = false;
      // Snap the reference field back to this row's own verse (rather than leaving
      // whatever the admin may have changed it to) so the form reads correctly the
      // next time they use it.
      if(inputReference) { inputReference.value = verseRef; inputReference.dataset.defaultRef = verseRef; }
    }

    // --- LINE UPON LINE "ADD RESOURCE" FORM (admin-only) ---
    // Unlike the Note view's per-verse form, there's no implicit "current verse"
    // here — the typed Reference field is the only way a new resource gets tied to
    // a verse, and it's what makes that resource show up automatically in the Note
    // view's Church Resources column for that verse (they're the same underlying
    // church_resources row, just displayed in two places based on its reference).
    function toggleLineUponLineAddForm() {
      const form = document.getElementById('line-upon-line-add-form');
      if (!form) return;
      const opening = form.style.display === 'none';
      form.style.display = opening ? 'flex' : 'none';
      if (opening) {
        const refInput = document.getElementById('lul-add-reference-input');
        if (refInput) refInput.focus();
      }
    }

    function clearLineUponLineAddFormFields() {
      ['lul-add-reference-input', 'lul-add-title-input', 'lul-add-url-input', 'lul-add-type-input', 'lul-add-tags-input', 'lul-add-notes-input', 'lul-add-thumbnail-input'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      const hideCb = document.getElementById('lul-add-hide-thumbnail-input');
      if (hideCb) hideCb.checked = false;
    }

    function cancelLineUponLineAddForm() {
      clearLineUponLineAddFormFields();
      const form = document.getElementById('line-upon-line-add-form');
      if (form) form.style.display = 'none';
    }

    async function addLineUponLineResource() {
      if (!currentUser || !currentUser.isAdmin) return;
      const refInput = document.getElementById('lul-add-reference-input');
      const typedRef = refInput ? refInput.value.trim() : '';
      const { verses: targetVerses, invalid } = resolveChurchResourceReferenceList(typedRef);
      if (!targetVerses) {
        const bad = invalid.length > 0 ? invalid.map(x => `"${x}"`).join(', ') : `"${typedRef}"`;
        alert(`${bad} isn't a recognized verse reference. Use the full book name and an exact chapter:verse, e.g. "Genesis 1:1" (separate multiple references with commas).`);
        return;
      }

      const titleText = (document.getElementById('lul-add-title-input')?.value || '').trim();
      const urlText = (document.getElementById('lul-add-url-input')?.value || '').trim();
      const typeText = (document.getElementById('lul-add-type-input')?.value || '').trim();
      const tagsText = (document.getElementById('lul-add-tags-input')?.value || '').trim();
      const notesText = (document.getElementById('lul-add-notes-input')?.value || '').trim();
      const thumbnailText = (document.getElementById('lul-add-thumbnail-input')?.value || '').trim();
      const hideThumbnail = document.getElementById('lul-add-hide-thumbnail-input')?.checked || false;

      // Jump straight to the book the FIRST target verse belongs to, so the render
      // triggered by saveNewChurchResource() below already shows it — otherwise
      // the admin would have to go hunting for it in the OT/NT lists. (It'll also
      // be visible under any other named verses' books, just not auto-opened there.)
      const firstRef = targetVerses[0].reference;
      const lastSpace = firstRef.lastIndexOf(' ');
      activeLineUponLineBook = lastSpace !== -1 ? firstRef.substring(0, lastSpace) : firstRef;

      const saved = await saveNewChurchResource(targetVerses, {
        title: titleText, url: urlText, type: typeText, tags: tagsText, notes: notesText, thumbnail: thumbnailText, thumbnailHidden: hideThumbnail
      });
      if (!saved) return;

      cancelLineUponLineAddForm();
    }

    // Removes a resource's id from every local list that might hold it — not just
    // one verse's — since a single resource can be tied to multiple scriptures at
    // once (see saveNewChurchResource) and its underlying church_resources row is
    // deleted just once. Mutates arrays in place (splice) rather than reassigning,
    // since churchResourcesMap[rowIndex] and its verse's .resources are often the
    // very same array object (see renderVerses) and reassigning one would silently
    // desync it from the other.
    // Removes a resource's id from just ONE rowIndex's local lists (its
    // churchResourcesMap entry and its verse's own .resources array) — used when
    // editing a resource's Reference field drops one of its previously-tied
    // verses, as distinct from removeChurchResourceEverywhere's full removal on
    // delete (below).
    function removeChurchResourceFromRowIndex(rowIndex, id) {
      const list = churchResourcesMap[rowIndex];
      if (list) {
        for (let i = list.length - 1; i >= 0; i--) {
          if (list[i].id === id) list.splice(i, 1);
        }
      }
      const verseObj = currentBibleVerses.find(v => v.rowIndex === rowIndex);
      if (verseObj && verseObj.resources) {
        for (let i = verseObj.resources.length - 1; i >= 0; i--) {
          if (verseObj.resources[i].id === id) verseObj.resources.splice(i, 1);
        }
      }
    }

    function removeChurchResourceEverywhere(id) {
      if (currentBibleVerses) {
        currentBibleVerses.forEach(v => {
          if (!v.resources || v.resources.length === 0) return;
          for (let i = v.resources.length - 1; i >= 0; i--) {
            if (v.resources[i].id === id) v.resources.splice(i, 1);
          }
        });
      }
      Object.keys(churchResourcesMap).forEach(ri => {
        const list = churchResourcesMap[ri];
        if (!list) return;
        for (let i = list.length - 1; i >= 0; i--) {
          if (list[i].id === id) list.splice(i, 1);
        }
      });
    }

    async function removeChurchResourceItem(rowIndex, verseRef, resIdx) {
      if (!currentUser || !currentUser.isAdmin) return;

      const resList = churchResourcesMap[rowIndex];
      if (!resList || !resList[resIdx]) return;

      const item = resList[resIdx];

      if (item.id != null) {
        const { error } = await churchResourcesTable.remove(item.id);
        if (error) {
          console.error('Error deleting resource:', error.message);
          alert('Could not delete resource: ' + error.message);
          return;
        }

        // Find every rowIndex currently displaying this resource (it may be tied to
        // more than just this one verse) BEFORE removing it, so each of those
        // Note-view columns can be refreshed too — otherwise any of them other than
        // the one the delete was clicked from would keep showing it until the next
        // live-sync poll quietly caught up.
        const affectedRowIndexes = new Set();
        Object.keys(churchResourcesMap).forEach(ri => {
          if ((churchResourcesMap[ri] || []).some(r => r.id === item.id)) affectedRowIndexes.add(Number(ri));
        });

        removeChurchResourceEverywhere(item.id);

        affectedRowIndexes.forEach(ri => {
          const v = currentBibleVerses.find(vv => vv.rowIndex === ri);
          updateChurchResourcesDOM(ri, v ? v.reference : verseRef);
        });
      } else {
        // No DB id (shouldn't normally happen) — just drop this one local copy.
        resList.splice(resIdx, 1);
        const verseObj = currentBibleVerses.find(v => v.rowIndex === rowIndex);
        if (verseObj && verseObj.resources) {
          const idx2 = verseObj.resources.indexOf(item);
          if (idx2 !== -1) verseObj.resources.splice(idx2, 1);
        }
        updateChurchResourcesDOM(rowIndex, verseRef);
      }

      renderResourcesTab();
      updateStudyNotificationBadges();
    }

    // Every verse reference a resource is CURRENTLY tied to, as a single
    // comma-separated string ready to drop straight into the edit form's
    // Reference field — derived from local state (no separate reference column
    // is cached on the item object itself) by finding every verse whose
    // .resources array contains this id. Order follows currentBibleVerses'
    // own (canonical, book-then-chapter-then-verse) order.
    function getChurchResourceReferenceList(id) {
      if (!currentBibleVerses) return '';
      return currentBibleVerses
        .filter(v => (v.resources || []).some(r => r.id === id))
        .map(v => v.reference)
        .join(', ');
    }

    // --- EDITING AN EXISTING CHURCH RESOURCE (admins only) ---
    // A resource can be showing in two places at once — its verse's Church Resources
    // column in the Note view, and its book's expanded list under Line Upon Line — so
    // editing is tracked by the resource's own DB id (editingChurchResourceId) rather
    // than by which view opened it, and both views re-render together on every step.
    // `contextPrefix` ('note' or 'lul') just keeps the two views' input element ids
    // from colliding if the same resource happens to be open for editing in both at
    // once (its Note-view verse open, and its book expanded in Line Upon Line).
    function renderChurchResourceEditFormHtml(r, contextPrefix, rowIndex, verseRef) {
      const idAttr = `${contextPrefix}-${r.id}`;
      const safeVerseRef = (verseRef || '').replace(/'/g, "\\'");
      const esc = (s) => (s || '').replace(/"/g, '&quot;');
      return `
        <div class="church-resource-input-container" style="flex-direction: column; gap: 4px;">
          <input type="text" id="church-edit-reference-${idAttr}" placeholder="Reference(s), e.g. Genesis 1:1, John 3:16..." style="width: 100%;" value="${esc(getChurchResourceReferenceList(r.id))}">
          <input type="text" id="church-edit-title-${idAttr}" placeholder="Title (visible title)..." style="width: 100%;" value="${esc(r.title)}">
          <input type="text" id="church-edit-url-${idAttr}" placeholder="URL..." style="width: 100%;" value="${esc(r.resource)}">
          <input type="text" id="church-edit-type-${idAttr}" placeholder="Type..." style="width: 100%;" value="${esc(r.type)}">
          <input type="text" id="church-edit-tags-${idAttr}" placeholder="Tags (e.g. Grace, Faith)..." style="width: 100%;" value="${esc(r.tags)}">
          <textarea id="church-edit-notes-${idAttr}" placeholder="Notes..." style="width: 100%; min-height: 40px; padding: 6px 10px; font-size: 13px; font-family: 'Plus Jakarta Sans', sans-serif; border: 1px solid var(--border-color); border-radius: var(--border-radius); resize: vertical;">${(r.notes || '')}</textarea>
          <input type="text" id="church-edit-thumbnail-${idAttr}" placeholder="Custom thumbnail URL (optional)..." style="width: 100%;" value="${esc(r.thumbnail)}">
          <label style="display:flex; align-items:center; gap:6px; font-size:12px; color:var(--text-muted); cursor:pointer; font-weight:normal;">
            <input type="checkbox" class="plan-checkbox" id="church-edit-hide-thumbnail-${idAttr}" ${r.thumbnailHidden ? 'checked' : ''}>Hide thumbnail
          </label>
          <div style="display: flex; justify-content: flex-end; gap: 6px; margin-top: 2px;">
            <button class="page-btn" onclick="cancelEditChurchResource(${rowIndex}, '${safeVerseRef}')">Cancel</button>
            <button class="btn" style="width: auto; padding: 6px 14px; font-size: 13px;" onclick="saveEditChurchResource(${r.id}, ${rowIndex}, '${safeVerseRef}', '${contextPrefix}')">Save</button>
          </div>
        </div>`;
    }

    function startEditChurchResource(id, rowIndex, verseRef) {
      if (!currentUser || !currentUser.isAdmin) return;
      editingChurchResourceId = id;
      updateChurchResourcesDOM(rowIndex, verseRef);
      renderResourcesTab();
    }

    function cancelEditChurchResource(rowIndex, verseRef) {
      editingChurchResourceId = null;
      updateChurchResourcesDOM(rowIndex, verseRef);
      renderResourcesTab();
    }

    async function saveEditChurchResource(id, rowIndex, verseRef, contextPrefix) {
      if (!currentUser || !currentUser.isAdmin) return;
      const idAttr = `${contextPrefix}-${id}`;
      const inputReference = document.getElementById(`church-edit-reference-${idAttr}`);
      const inputTitle = document.getElementById(`church-edit-title-${idAttr}`);
      const inputUrl = document.getElementById(`church-edit-url-${idAttr}`);
      const inputType = document.getElementById(`church-edit-type-${idAttr}`);
      const inputTags = document.getElementById(`church-edit-tags-${idAttr}`);
      const inputNotes = document.getElementById(`church-edit-notes-${idAttr}`);
      const inputThumbnail = document.getElementById(`church-edit-thumbnail-${idAttr}`);
      const inputHideThumbnail = document.getElementById(`church-edit-hide-thumbnail-${idAttr}`);
      if (!inputUrl) return;

      // Validated/resolved exactly like the add forms — one or more comma-separated
      // full references, every one of which has to resolve to a real verse or the
      // whole save is blocked (no partial re-tie).
      const typedRef = inputReference ? inputReference.value.trim() : '';
      const { verses: targetVerses, invalid } = resolveChurchResourceReferenceList(typedRef);
      if (!targetVerses) {
        const bad = invalid.length > 0 ? invalid.map(x => `"${x}"`).join(', ') : `"${typedRef}"`;
        alert(`${bad} isn't a recognized verse reference. Use the full book name and an exact chapter:verse, e.g. "Genesis 1:1" (separate multiple references with commas).`);
        return;
      }

      const titleText = inputTitle ? inputTitle.value.trim() : '';
      const urlText = inputUrl.value.trim();
      const typeText = inputType ? inputType.value.trim() : '';
      const tagsText = inputTags ? inputTags.value.trim() : '';
      const notesText = inputNotes ? inputNotes.value.trim() : '';
      const thumbnailText = inputThumbnail ? inputThumbnail.value.trim() : '';
      const hideThumbnail = inputHideThumbnail ? inputHideThumbnail.checked : false;
      const referenceField = targetVerses.map(v => v.reference).join(', ');

      const { error } = await churchResourcesTable.update(
        id,
        { reference: referenceField, title: titleText, url: urlText, type: typeText, tags: tagsText, notes: notesText, thumbnail_url: thumbnailText, thumbnail_hidden: hideThumbnail }
      );

      if (error) {
        console.error('Error updating resource:', error.message);
        alert('Could not update resource: ' + error.message);
        return;
      }

      // Which rowIndexes currently hold this resource, BEFORE touching anything —
      // needed both to update its plain fields wherever it already lives, and to
      // work out which of those verses the new Reference field just dropped.
      // Checked against BOTH churchResourcesMap AND each verse's own .resources —
      // a verse whose Note-view row has never been rendered yet only has the tie
      // recorded on its .resources array (churchResourcesMap only gets a rowIndex
      // entry once that row is actually rendered — see renderVerses). Missing
      // either source here is exactly what would cause a resource to duplicate
      // itself: a verse that already holds it via .resources, but isn't yet
      // reflected in churchResourcesMap, would look "new" below and get a second
      // copy pushed in alongside the one already there.
      const oldRowIndexes = new Set();
      currentBibleVerses.forEach(v => {
        if ((v.resources || []).some(r => r.id === id)) oldRowIndexes.add(v.rowIndex);
      });
      Object.keys(churchResourcesMap).forEach(ri => {
        if ((churchResourcesMap[ri] || []).some(r => r.id === id)) oldRowIndexes.add(Number(ri));
      });

      // Update every existing local copy's plain fields (mutates the one object
      // shared across every verse it's tied to, so this alone keeps all of them in
      // sync — reference membership is handled separately below). Checked against
      // both churchResourcesMap and the verse's own .resources per rowIndex, in
      // case the two haven't been aliased to the same array yet.
      let sharedItem = null;
      const applyFieldUpdate = (list) => {
        const item = (list || []).find(r => r.id === id);
        if (item) {
          item.title = titleText; item.resource = urlText; item.type = typeText; item.tags = tagsText; item.notes = notesText; item.thumbnail = thumbnailText; item.thumbnailHidden = hideThumbnail;
          sharedItem = item;
        }
      };
      oldRowIndexes.forEach(ri => {
        applyFieldUpdate(churchResourcesMap[ri]);
        const v = currentBibleVerses.find(vv => vv.rowIndex === ri);
        if (v) applyFieldUpdate(v.resources);
      });
      if (!sharedItem) {
        // Wasn't showing anywhere locally yet (shouldn't normally happen) — build a
        // fresh item object so it can still be attached to its new verse(s) below.
        sharedItem = { id, resource: urlText, title: titleText, type: typeText, tags: tagsText, notes: notesText, thumbnail: thumbnailText, thumbnailHidden: hideThumbnail };
      }

      // Reconcile WHICH verses hold it: drop it from any verse the edited
      // Reference field no longer names, and attach it to any newly-named verse
      // that didn't already have it. Verses present in both sets are untouched
      // (their copy was already updated above).
      const newRowIndexes = new Set(targetVerses.map(v => v.rowIndex));
      const affectedRowIndexes = new Set([...oldRowIndexes, ...newRowIndexes]);

      oldRowIndexes.forEach(ri => {
        if (!newRowIndexes.has(ri)) removeChurchResourceFromRowIndex(ri, id);
      });
      targetVerses.forEach(tv => {
        const verseObj = currentBibleVerses.find(v => v.rowIndex === tv.rowIndex);
        // Re-check actual presence here (not just membership in the oldRowIndexes
        // set computed above) as a last line of defense against ever pushing a
        // second copy of this resource into a verse that already has it.
        const alreadyPresent = (verseObj && (verseObj.resources || []).some(r => r.id === id)) || (churchResourcesMap[tv.rowIndex] || []).some(r => r.id === id);
        if (alreadyPresent) {
          // Make sure both sides end up aliased to the same array going forward,
          // without pushing a duplicate into either.
          if (verseObj) {
            if (!verseObj.resources) verseObj.resources = [];
            churchResourcesMap[tv.rowIndex] = verseObj.resources;
          }
          return;
        }
        const list = (verseObj && verseObj.resources) || churchResourcesMap[tv.rowIndex] || [];
        list.push(sharedItem);
        if (verseObj) verseObj.resources = list;
        churchResourcesMap[tv.rowIndex] = list;
      });

      editingChurchResourceId = null;
      affectedRowIndexes.forEach(ri => {
        const v = currentBibleVerses.find(vv => vv.rowIndex === ri);
        updateChurchResourcesDOM(ri, v ? v.reference : verseRef);
      });
      renderResourcesTab();
    }

    function updateChurchResourcesDOM(rowIndex, verseRef) {
      const container = document.getElementById(`church-resources-list-${rowIndex}`);
      if (!container) return;

      const crList = churchResourcesMap[rowIndex] || [];
      let resourcesListHtml = '';
      
      crList.forEach((crData, idx) => {
        const resUrl = crData.resource ? crData.resource.trim() : '';
        const resTitle = crData.title ? crData.title.trim() : '';
        const resType = crData.type ? crData.type.trim() : '';
        const resTags = crData.tags ? crData.tags.trim() : '';
        const resNotes = crData.notes ? crData.notes.trim() : '';

        if (resUrl || resTitle || resNotes) {
          if (currentUser && currentUser.isAdmin && editingChurchResourceId === crData.id) {
            resourcesListHtml += `<div class="church-resource-card">${renderChurchResourceEditFormHtml(crData, 'note', rowIndex, verseRef)}</div>`;
            return; // skip the normal display markup below while this card is being edited
          }

          let typeBadge = resType ? `<span class="type-tag">${resType}</span>` : '';
          let tagBadges = resTags ? resTags.split(',').map(t => `<span class="tag">${t.trim()}</span>`).join(' ') : '';
          let displayTitleText = resTitle || resUrl;

          // A YouTube link (or a link that simply passes a YouTube video id through,
          // e.g. another site's own "watch" page) opens in the same full-screen
          // player used everywhere else in the app, instead of a plain link that
          // leaves the app in a new tab — independent of whether its thumbnail is
          // actually showing (an admin can turn the thumbnail off without losing the
          // in-app player). The thumbnail itself — YouTube's own, an admin's custom
          // override, a link that's itself an image, or none — is resolved by
          // resolveChurchResourceThumbnail so this card and the Line Upon Line one
          // stay in agreement about what a resource's thumbnail is.
          const youTubeId = resUrl ? getYouTubeVideoId(resUrl) : null;
          const thumbUrl = resolveChurchResourceThumbnail(crData);

          let titleHtml;
          if (youTubeId) {
            const safeUrlJs = resUrl.replace(/'/g, "\\'");
            const safeTitleJs = displayTitleText.replace(/'/g, "\\'");
            const safeVerseRefJs = (verseRef || '').replace(/'/g, "\\'");
            // With a thumbnail showing, the big centered play icon (playIconHtml,
            // below) already says "this plays a video" — without one, this small
            // inline glyph in front of the title carries that same meaning.
            const inlinePlayIcon = thumbUrl ? '' : `<span class="church-resource-video-inline-play"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg></span>`;
            titleHtml = `<button type="button" class="church-resource-video-trigger" onclick="openChurchResourceVideo('${safeUrlJs}', '${safeTitleJs}', '${safeVerseRefJs}')" title="Play video">
              <span class="church-resource-video-title" style="font-size: 16px; font-weight: bold; font-family: 'Plus Jakarta Sans', sans-serif;">${inlinePlayIcon}${displayTitleText}</span>
            </button>`;
          } else if (resUrl) {
            // A plain link title sitting over a custom thumbnail image needs to be
            // white (matching the video-title/notes treatment elsewhere on this same
            // background) — its color is set inline here rather than through the
            // .has-video-thumb CSS rules because an inline style always wins over
            // them regardless, so leaving it at the default primary-color would
            // otherwise be unreadable against a busy custom cover image.
            const linkIsOverCustomThumb = isCustomThumbnailShown(crData, thumbUrl);
            const linkColorStyle = linkIsOverCustomThumb ? 'color: #fff; text-shadow: 0 1px 4px rgba(0,0,0,0.85);' : 'color: var(--primary-color);';
            titleHtml = `<a href="${resUrl}" target="_blank" style="font-size: 16px; font-weight: bold; ${linkColorStyle} text-decoration: none; font-family: 'Plus Jakarta Sans', sans-serif;">${displayTitleText}</a>`;
          } else {
            titleHtml = displayTitleText ? `<span style="font-size: 16px; font-weight: bold; color: var(--text-main); font-family: 'Plus Jakarta Sans', sans-serif;">${displayTitleText}</span>` : '';
          }
          let notesHtml = resNotes ? `<div style="font-size: 13px; ${thumbUrl ? 'color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,0.8);' : 'color: var(--text-muted);'} margin-top: 4px; white-space: pre-wrap;">${resNotes}</div>` : '';
          const playIconHtml = (youTubeId && thumbUrl) ? `<div class="church-resource-video-playbtn"><svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg></div>` : '';
          // A "Booklet"-tagged resource showing its own custom thumbnail (its cover
          // image) gets top-anchored instead of the usual centered crop — see the
          // .thumb-top-align CSS rule for why.
          const bookletTopAlign = isCustomThumbnailShown(crData, thumbUrl) && hasBookletTag(resTags);
          const cardClass = thumbUrl ? `church-resource-card has-video-thumb${bookletTopAlign ? ' thumb-top-align' : ''}` : 'church-resource-card';
          const cardStyleAttr = thumbUrl ? ` style="background-image: linear-gradient(180deg, rgba(10,10,14,0.2) 0%, rgba(10,10,14,0.85) 100%), url('${thumbUrl.replace(/'/g, "\\'")}');"` : '';

          resourcesListHtml += `
            <div class="${cardClass}"${cardStyleAttr}>
              ${playIconHtml}
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 6px;">
                  ${typeBadge}
                </div>
                ${titleHtml ? `<div>${titleHtml}</div>` : ''}
              </div>
              ${notesHtml}
              ${tagBadges ? `<div style="margin-top: 4px;">${tagBadges}</div>` : ''}
              <div style="display: flex; justify-content: flex-end; gap: 6px; margin-top: 4px;">
                ${currentUser && currentUser.isAdmin ? `<button class="page-btn" style="padding: 2px 6px; font-size: 11px;" onclick="startEditChurchResource(${crData.id}, ${rowIndex}, '${verseRef}')">Edit</button>` : ''}
                ${currentUser && currentUser.isAdmin ? `<button class="page-btn" style="padding: 2px 6px; font-size: 11px; background: #fee2e2; color: #b91c1c; border-color: #fca5a5;" onclick="removeChurchResourceItem(${rowIndex}, '${verseRef}', ${idx})">Delete</button>` : ''}
              </div>
              <button class="share-btn resource-share-btn" title="Share this resource" onclick="shareResource(${crData.id}, '${verseRef}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
              </button>
            </div>`;
        }
      });
      container.innerHTML = resourcesListHtml;
    }

    // --- READING PLAN LOGIC ---
    async function loadReadingSchedule() {
      const scheduleName = document.getElementById('schedule-select').value;
      if (!scheduleName || !currentUser) return;

      try {
        const { data: days, error: daysError } = await readingSchedulesTable
          .select('id, day_number, passages')
          .eq('schedule_name', scheduleName)
          .order('day_number', { ascending: true });
        if (daysError) throw daysError;

        const scheduleIds = (days || []).map(d => d.id);
        let progressByScheduleId = {};
        if (scheduleIds.length > 0) {
          const { data: progress, error: progError } = await userReadingProgressTable
            .select('schedule_id, completed')
            .eq('user_id', currentUser.id)
            .in('schedule_id', scheduleIds);
          if (progError) throw progError;
          (progress || []).forEach(p => { progressByScheduleId[p.schedule_id] = p.completed; });
        }

        cachedScheduleDays = (days || []).map(d => ({
          rowIndex: d.id,
          day: d.day_number,
          passages: d.passages,
          completed: !!progressByScheduleId[d.id]
        }));

        // Plans are opt-in — just check whether this user has already started this specific
        // plan (never auto-create a start date just from selecting it in the dropdown).
        currentPlanStartDate = await getExistingPlanStartDate(scheduleName);

        // Default view = the reading right after the last one completed (so a user who's
        // behind schedule opens straight to the reading they actually need to catch up on).
        currentPlanViewDayNumber = getCurrentDueDayNumber();

        // Calendar View always opens on the current real-world month.
        const now = new Date();
        calendarViewYear = now.getFullYear();
        calendarViewMonth = now.getMonth();

        updatePlanStartRestartButton();
        renderActivePlanView();
        updatePlanStatusNotification();
      } catch (e) {
        console.error('Error loading reading schedule:', e.message);
        cachedScheduleDays = [];
        renderActivePlanView();
      }
    }

    // The day right after the last one marked complete — i.e. the reading the user
    // actually needs to do next, regardless of what today's calendar date says.
    function getCurrentDueDayNumber() {
      if (!cachedScheduleDays || cachedScheduleDays.length === 0) return 1;
      const nextDue = cachedScheduleDays.find(d => !d.completed);
      return nextDue ? nextDue.day : cachedScheduleDays[cachedScheduleDays.length - 1].day;
    }

    // Read-only check: does this user already have a start date for this plan? Used
    // whenever a schedule is loaded/selected — selecting a plan in the dropdown must
    // never itself start it, only clicking "Start Plan" does.
    async function getExistingPlanStartDate(scheduleName) {
      const { data: existing, error: fetchErr } = await userReadingPlansTable
        .select('start_date')
        .eq('user_id', currentUser.id)
        .eq('schedule_name', scheduleName)
        .maybeSingle();
      if (fetchErr) console.error('Error fetching plan start date:', fetchErr.message);
      return existing ? existing.start_date : null;
    }

    // "Today" as a plain YYYY-MM-DD string in the user's own local calendar
    // day — deliberately NOT toISOString().slice(0,10), which converts to UTC
    // first and can land on the wrong day: e.g. 9pm US Eastern is already
    // after midnight UTC, so toISOString() would return tomorrow's date for
    // someone who, locally, is still very much on "today."
    function localDateString(date = new Date()) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    // Looks up the user's start date for this plan; if they've never started it before,
    // creates one (defaulting to today). Only ever called once the user has actually
    // opted in (clicking Start Plan, or confirming a restart) — never just from selecting
    // a plan in the dropdown.
    async function getOrCreatePlanStartDate(scheduleName) {
      const existingStartDate = await getExistingPlanStartDate(scheduleName);
      if (existingStartDate) return existingStartDate;

      const todayStr = localDateString();
      const { data: created, error: insertErr } = await userReadingPlansTable.insert(
        { user_id: currentUser.id, schedule_name: scheduleName, start_date: todayStr },
        'start_date'
      );
      if (insertErr) {
        console.error('Error creating plan start date:', insertErr.message);
        return todayStr;
      }
      return created.start_date;
    }

    // Toggles the header button between "Start Plan" (not yet opted in) and
    // "Restart Plan" (already started) — same slot in the layout either way.
    function updatePlanStartRestartButton() {
      const btn = document.getElementById('plan-start-restart-btn');
      if (!btn) return;
      if (currentPlanStartDate) {
        btn.textContent = 'Restart Plan';
        btn.style.background = 'var(--accent-coral)';
      } else {
        btn.textContent = 'Start Plan';
        btn.style.background = 'var(--accent-teal)';
      }
    }

    function handleStartOrRestartPlan() {
      // Starting/restarting writes a start date + per-day progress under the
      // account, so this needs a signed-in user.
      if (!ensureLoggedInFor('Sign in to start tracking a reading plan.', () => handleStartOrRestartPlan())) return;
      if (currentPlanStartDate) {
        confirmRestartPlan();
      } else {
        startCurrentPlan();
      }
    }

    // The actual opt-in moment: creates the start date and reveals the plan below.
    async function startCurrentPlan() {
      if (dailyReadingTtsActive) stopDailyReadingTts();
      const scheduleName = document.getElementById('schedule-select').value;
      if (!scheduleName || !currentUser) return;

      currentPlanStartDate = await getOrCreatePlanStartDate(scheduleName);
      currentPlanViewDayNumber = getCurrentDueDayNumber();

      updatePlanStartRestartButton();
      renderActivePlanView();
      updatePlanStatusNotification();
    }

    // Which day number "today" falls on, given a plan's start date, clamped to the plan's length.
    function computeTodayDayNumber(startDateStr, totalDays) {
      if (!startDateStr || !totalDays) return 1;
      const elapsedDays = computeRawElapsedDays(startDateStr);
      return Math.min(Math.max(elapsedDays, 1), totalDays);
    }

    // Same as above but NOT clamped to the plan's length — used to detect that the
    // calendar window for the plan has fully elapsed (distinct from "clamped to last day").
    function computeRawElapsedDays(startDateStr) {
      if (!startDateStr) return 1;
      const start = new Date(startDateStr + 'T00:00:00');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return Math.floor((today - start) / 86400000) + 1;
    }

    // Day 1 = the plan's start date. Formats the actual calendar date for a given day number.
    function formatPlanDate(startDateStr, dayNumber, includeWeekday) {
      if (!startDateStr) return '';
      const d = new Date(startDateStr + 'T00:00:00');
      d.setDate(d.getDate() + (dayNumber - 1));
      const opts = { month: 'short', day: 'numeric', year: 'numeric' };
      if (includeWeekday) opts.weekday = 'short';
      return d.toLocaleDateString(undefined, opts);
    }

    function changeCalendarMonth(delta) {
      let newMonth = calendarViewMonth + delta;
      let newYear = calendarViewYear;
      if (newMonth < 0) { newMonth = 11; newYear -= 1; }
      else if (newMonth > 11) { newMonth = 0; newYear += 1; }
      calendarViewMonth = newMonth;
      calendarViewYear = newYear;
      renderActivePlanView();
    }

    function jumpToPlanDay(dayNumber) {
      currentPlanViewDayNumber = dayNumber;
      switchPlanSubTab('reading');
    }

    // --- READING PLAN NOTIFICATION (badge on the nav icon + panel above the Reading Plan tab) ---
    function computeReadingNotificationMessage() {
      if (!currentUser || !currentPlanStartDate || !cachedScheduleDays || cachedScheduleDays.length === 0) return null;

      const totalDays = cachedScheduleDays.length;
      const allComplete = cachedScheduleDays.every(d => d.completed);
      if (allComplete) return null;

      const todayExpectedDay = computeTodayDayNumber(currentPlanStartDate, totalDays);
      const nextDueDay = getCurrentDueDayNumber();
      const daysBehind = Math.max(0, todayExpectedDay - nextDueDay);
      const todayCompleted = nextDueDay > todayExpectedDay;

      if (daysBehind === 0) {
        return todayCompleted
          ? "You're on track with your daily reading, great job!"
          : "Ready for today's daily reading?";
      }
      return "Let's tackle some readings and get you back on schedule!";
    }

    // Recomputes the current message and updates the nav-icon badge accordingly.
    // A brand-new message (different from the last one the user actually saw)
    // will bring the badge back even if a previous message was already seen.
    function updatePlanStatusNotification() {
      readingNotificationMessage = computeReadingNotificationMessage();

      if (readingNotificationMessage && readingNotificationMessage !== lastSeenReadingMessage) {
        readingNotificationSeen = false;
      }

      const badgeEl = document.getElementById('reading-notification-badge');
      if (badgeEl) {
        if (readingNotificationMessage && !readingNotificationSeen) {
          badgeEl.innerText = '1';
          badgeEl.style.display = 'flex';
        } else {
          badgeEl.style.display = 'none';
        }
      }

      // Keep the panel's content current; switchTab() (or, if the person is
      // already sitting on that tab, revealReadingNotificationIfOnPlanTab()
      // below) controls whether it's actually visible.
      const bodyEl = document.getElementById('reading-notif-body');
      if (bodyEl) bodyEl.innerText = readingNotificationMessage || '';
    }

    // Shows the "Reading Updates" box (and clears its nav badge) only if the
    // Reading Plan tab is the one currently on screen — used both when the
    // person switches to that tab, and when a freshly-computed
    // readingNotificationMessage becomes available while they're already sitting
    // on it (e.g. logging in mid-session doesn't itself switch tabs, so without
    // this the box would otherwise only appear after leaving and coming back).
    function revealReadingNotificationIfOnPlanTab() {
      if (!document.getElementById('plan-tab')?.classList.contains('active')) return;
      readingNotificationSeen = true;
      lastSeenReadingMessage = readingNotificationMessage;
      const badgeEl = document.getElementById('reading-notification-badge');
      if (badgeEl) badgeEl.style.display = 'none';
      const notifPanel = document.getElementById('reading-notification-panel');
      if (notifPanel) notifPanel.style.display = readingNotificationMessage ? 'block' : 'none';
    }

    function toggleReadingNotifPanel() {
      isReadingNotifCollapsed = !isReadingNotifCollapsed;
      const body = document.getElementById('reading-notif-body');
      const icon = document.getElementById('reading-notif-toggle-icon');
      if (body) body.classList.toggle('collapsed', isReadingNotifCollapsed);
      if (icon) icon.innerText = isReadingNotifCollapsed ? '▸' : '▾';
    }

    function goToPlanNotificationTarget() {
      const nextDueDay = getCurrentDueDayNumber();
      jumpToPlanDay(nextDueDay);
    }

    function changePlanViewDay(delta) {
      const totalDays = cachedScheduleDays.length;
      if (totalDays === 0) return;
      if (dailyReadingTtsActive) stopDailyReadingTts(); // manually navigating away from the day being read aloud
      currentPlanViewDayNumber = Math.min(Math.max((currentPlanViewDayNumber || 1) + delta, 1), totalDays);
      renderActivePlanView();
    }

    // Plays a brief leftward-bounce nudge on the Study tab's sub-option row (TW Bible
    // Course / Line Upon Line / By the Book) to hint that it slides for more options.
    // Only plays when something is actually hidden off to the side, and re-triggers
    // cleanly on every call (removing the class then forcing reflow before re-adding it).
    function hintStudySubTabsSlider() {
      const row = document.querySelector('.study-sub-tabs-row');
      if (!row) return;
      requestAnimationFrame(() => {
        if (row.scrollWidth <= row.clientWidth + 1) return;
        row.classList.remove('bounce-hint');
        void row.offsetWidth; // force reflow so the animation can replay
        row.classList.add('bounce-hint');
      });
    }

    function switchStudySubTab(subTab) {
      // "By the Book" and "Core-D" are account-bound study areas — pop the login
      // modal instead of switching into them, and land back here automatically
      // once the person signs in. By the Book specifically needs a signed-in
      // user id to track progress for Records badging, so it can't be opened
      // as a guest. Returns false when blocked so callers (e.g. a shared-link
      // deep link) know not to keep going as if the switch happened.
      if ((subTab === 'bible-studies' || subTab === 'foundations') &&
          !ensureLoggedInFor(
            subTab === 'bible-studies' ? 'Sign in to view By the Book.' : 'Sign in to view Core-D.',
            () => switchStudySubTab(subTab)
          )) {
        return false;
      }
      document.querySelectorAll('#study-tab .plan-sub-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('#study-tab .study-sub-content').forEach(c => c.classList.remove('active'));
      document.getElementById(`study-sub-${subTab}`).classList.add('active');
      document.getElementById(`study-sub-${subTab}-content`).classList.add('active');
      if (subTab === 'resources') renderResourcesTab();
      if (subTab === 'course') renderTWModuleList();
      if (subTab === 'bible-studies') renderBibleStudyShelf();
      if (subTab === 'foundations') renderFoundationsTab();
      markStudySubTabSeen(subTab);
      return true;
    }

    // --- STUDY TAB NOTIFICATION BADGES (nav-icon bubble + one bubble per sub-option) ---
    // To make a new Study sub-option participate in the badge count, just add an entry
    // here returning a stable list of IDs for whatever counts as "its content" — the
    // badge system automatically diffs that list against what the user has already
    // seen and rolls every sub-option's new-item count into the Study nav-icon total.
    const STUDY_SUBTAB_CONTENT_SOURCES = {
      course: () => twBibleCourseData.flatMap(mod => mod.lessons.map(l => l.id)),
      resources: () => (currentBibleVerses || []).flatMap(v => (v.resources || []).map(r => `res-${r.id}`)),
      'bible-studies': () => BIBLE_STUDIES_BOOK_ORDER
        .map((title, i) => getBibleStudyBookConfig(title, i))
        .filter(cfg => cfg.live)
        .flatMap(cfg => cfg.sessions.map((s, i) => `${cfg.title}::${i}`))
      // Core-D ("foundations") is deliberately NOT listed here — its bubble
      // doesn't use this seen/unseen-since-your-last-visit mechanism at all.
      // See updateStudyNotificationBadges() below for how its count works.
    };

    function getSeenStudyContentIds(subTab) {
      try {
        const raw = localStorage.getItem(`studySeenContent_${subTab}`);
        return raw ? JSON.parse(raw) : [];
      } catch (e) { return []; }
    }

    // Marks everything currently in a sub-option as "seen", clearing its bubble
    // (called whenever the user actually opens that sub-option).
    function markStudySubTabSeen(subTab) {
      const getIds = STUDY_SUBTAB_CONTENT_SOURCES[subTab];
      if (!getIds) return;
      try { localStorage.setItem(`studySeenContent_${subTab}`, JSON.stringify(getIds())); } catch (e) {}
      updateStudyNotificationBadges();
    }

    function getActiveStudySubTab() {
      const activeBtn = document.querySelector('#study-tab .plan-sub-btn.active');
      const match = activeBtn && activeBtn.id.match(/^study-sub-(.+)$/);
      return match ? match[1] : 'resources';
    }

    // Recomputes every sub-option's "new content" count and updates its bubble, then
    // sums all of them into the Study nav-icon bubble.
    function updateStudyNotificationBadges() {
      let total = 0;
      Object.keys(STUDY_SUBTAB_CONTENT_SOURCES).forEach(subTab => {
        const currentIds = STUDY_SUBTAB_CONTENT_SOURCES[subTab]();
        const seenIds = new Set(getSeenStudyContentIds(subTab));
        const newCount = currentIds.filter(id => !seenIds.has(id)).length;
        total += newCount;

        const subBadge = document.getElementById(`study-sub-${subTab}-badge`);
        if (subBadge) {
          if (newCount > 0) { subBadge.innerText = newCount; subBadge.style.display = 'flex'; }
          else subBadge.style.display = 'none';
        }
      });

      // Core-D's bubble counts something different from every other sub-option:
      // not "items you haven't opened yet" but simply how many currently-live
      // classes are flagged "New" by an admin (the same flag that puts the
      // "NEW" ribbon on a class's card) — so it stays showing that count
      // whether or not you've visited Core-D, exactly like the ribbon itself
      // doesn't disappear just because you looked at the class.
      const foundationsNewCount = getLiveFoundationsItems().filter(item => item.isNew).length;
      total += foundationsNewCount;
      const foundationsBadge = document.getElementById('study-sub-foundations-badge');
      if (foundationsBadge) {
        if (foundationsNewCount > 0) { foundationsBadge.innerText = foundationsNewCount; foundationsBadge.style.display = 'flex'; }
        else foundationsBadge.style.display = 'none';
      }

      const mainBadge = document.getElementById('study-notification-badge');
      if (mainBadge) {
        if (total > 0) { mainBadge.innerText = total; mainBadge.style.display = 'flex'; }
        else mainBadge.style.display = 'none';
      }
    }

    function switchPlanSubTab(subTab) {
      if (dailyReadingTtsActive) stopDailyReadingTts(); // e.g. switching to Calendar View mid-read
      currentPlanSubTab = subTab;
      document.getElementById('plan-sub-reading').classList.toggle('active', subTab === 'reading');
      document.getElementById('plan-sub-calendar').classList.toggle('active', subTab === 'calendar');
      renderActivePlanView();
    }

    function renderActivePlanView() {
      const container = document.getElementById('schedule-content');
      const subTabsRow = document.getElementById('plan-sub-tabs-row');
      // Toggled here (rather than deeper in the branches below, several of
      // which return early) so it's always correct regardless of which
      // early-return path this call takes — Daily Reading gets generous
      // print-style side margins the same way #bible-tab does, and its own
      // and its inner .calendar-cell's card background/border/shadow hidden
      // (present for layout/spacing purposes, just not visibly boxed) for the
      // same page-like reading feel; the Calendar grid wants its own full
      // width and visible day boxes, so it doesn't get either treatment.
      // Toggled on #plan-tab itself (not just #schedule-content) since the
      // outer tab card's own background/border is what needed hiding too.
      document.getElementById('plan-tab').classList.toggle('daily-reading-view', currentPlanSubTab === 'reading');
      if (!cachedScheduleDays || cachedScheduleDays.length === 0) {
        if (subTabsRow) subTabsRow.style.display = 'none';
        // A guest never has schedule data loaded (it's account-bound), so this is
        // the expected state for them — point at signing in rather than reading
        // like something's missing. A signed-in user landing here instead means
        // the schedule genuinely has no days (or failed to load).
        container.innerHTML = currentUser
          ? `<div style="padding: 20px; text-align: center; color: var(--text-muted);">No schedule days found.</div>`
          : `<div style="padding: 20px; text-align: center; color: var(--text-muted);">Login to start one of our daily reading schedules.</div>`;
        return;
      }

      const totalDays = cachedScheduleDays.length;

      // Opt-in gate: nothing below the selectors shows until the user clicks Start Plan.
      if (!currentPlanStartDate) {
        if (subTabsRow) subTabsRow.style.display = 'none';
        container.innerHTML = `
          <div style="text-align:center; padding: 30px 16px; color: var(--text-muted); background: var(--bg-color); border-radius: var(--border-radius); font-family: 'Plus Jakarta Sans', sans-serif;">
            <div style="font-family: var(--font-heading); font-size:24px; color:var(--text-main); margin-bottom:6px; letter-spacing:0.5px;">${totalDays}-Day Reading Plan</div>
            <div style="font-size:14px;">Click "Start Plan" above to begin — today will be Day 1.</div>
          </div>`;
        return;
      }
      if (subTabsRow) subTabsRow.style.display = 'flex';

      const completedCount = cachedScheduleDays.filter(d => d.completed).length;
      const percent = totalDays > 0 ? Math.round((completedCount / totalDays) * 100) : 0;

      const progressBarHtml = `
        <div style="margin-bottom: 16px;">
          <div style="display:flex; justify-content:space-between; font-size:13px; color:var(--text-muted); margin-bottom:4px; font-family: 'Plus Jakarta Sans', sans-serif;">
            <span>Progress</span>
            <span>${completedCount} / ${totalDays} days (${percent}%)</span>
          </div>
          <div style="width:100%; background:var(--border-color); border-radius:8px; height:10px; overflow:hidden;">
            <div style="width:${percent}%; background:var(--primary-color); height:100%; transition:width 0.3s;"></div>
          </div>
        </div>`;

      if (currentPlanSubTab === 'reading') {
        if (!currentPlanViewDayNumber) currentPlanViewDayNumber = getCurrentDueDayNumber();
        const todayDayNumber = computeTodayDayNumber(currentPlanStartDate, totalDays);
        const rawElapsedDays = computeRawElapsedDays(currentPlanStartDate);
        const isPlanComplete = completedCount === totalDays || rawElapsedDays > totalDays;
        const dayObj = cachedScheduleDays.find(d => d.day === currentPlanViewDayNumber) || cachedScheduleDays[0];

        let dateLabel = '';
        if (currentPlanStartDate) {
          dateLabel = formatPlanDate(currentPlanStartDate, dayObj.day, true);
        }

        let html = progressBarHtml;

        if (isPlanComplete) {
          html += `
            <div style="text-align:center; background: rgba(13,148,136,0.12); color: var(--accent-teal); padding:16px; border-radius:var(--border-radius); margin-bottom:16px;">
              <div style="font-weight:700; font-size:16px; margin-bottom:4px;">🏆 You've completed this reading plan!</div>
              <div style="font-size:13px; margin-bottom:12px;">${completedCount === totalDays ? 'Every day has been marked complete.' : "The plan's scheduled dates have run their course."} Ready to go again?</div>
              <button class="btn" style="width:auto; background: var(--accent-teal);" onclick="confirmRestartPlan()">Start This Plan Over</button>
            </div>`;
        }

        html += `
          <div class="calendar-cell ${dayObj.completed ? 'completed' : ''}" style="min-height:auto; padding:20px;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
              <button class="page-btn" onclick="changePlanViewDay(-1)" title="Previous day">&lt;</button>
              <div style="text-align:center;">
                <div class="plan-day-title" style="font-size:18px;">Day ${dayObj.day}${dayObj.day === todayDayNumber ? ' (Today)' : ''}</div>
                ${dateLabel ? `<div style="font-size:12px; color:var(--text-muted); font-family:var(--font-heading); letter-spacing:0.3px;">${dateLabel}</div>` : ''}
                <div style="font-size:13px; color:var(--text-muted); margin-top:2px; font-family:var(--font-heading); letter-spacing:0.3px;">${dayObj.passages || ''}</div>
              </div>
              <button class="page-btn" onclick="changePlanViewDay(1)" title="Next day">&gt;</button>
            </div>

            ${renderPassageText(dayObj.passages)}

            <div style="text-align:center; margin:20px 0 16px 0;">
              <input type="checkbox" id="daily-complete-checkbox" ${dayObj.completed ? 'checked' : ''} onchange="handleDailyCheckboxChange(${dayObj.rowIndex}, this.checked)" style="opacity:0; width:0; height:0; margin:0;">
              <label for="daily-complete-checkbox" class="daily-complete-toggle ${dayObj.completed ? 'is-complete' : ''}">
                <span class="toggle-icon">
                  ${dayObj.completed
                    ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'
                    : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"></circle></svg>'}
                </span>
                ${dayObj.completed ? "Today's Reading Complete" : "Mark Today's Reading Complete"}
              </label>
            </div>

            ${dayObj.completed ? `
              <div class="daily-complete-banner">
                <div class="daily-complete-banner-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <div>
                  <div style="font-size:15px; font-weight:700;">Day ${dayObj.day} complete!</div>
                  <div style="font-size:12px; font-weight:500; opacity:0.85;">Nice work staying on track with your reading.</div>
                </div>
              </div>` : ''}
          </div>`;
        container.innerHTML = html;
      } else {
        if (calendarViewYear === null) {
          const now = new Date();
          calendarViewYear = now.getFullYear();
          calendarViewMonth = now.getMonth();
        }

        const monthLabel = new Date(calendarViewYear, calendarViewMonth, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
        const daysInMonth = new Date(calendarViewYear, calendarViewMonth + 1, 0).getDate();
        const firstWeekday = new Date(calendarViewYear, calendarViewMonth, 1).getDay();
        const startDateObj = currentPlanStartDate ? new Date(currentPlanStartDate + 'T00:00:00') : null;
        const todayStr = new Date().toDateString();

        const scheduleByDayNumber = {};
        cachedScheduleDays.forEach(d => { scheduleByDayNumber[d.day] = d; });

        let html = progressBarHtml;
        html += `
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
            <button class="page-btn" onclick="changeCalendarMonth(-1)" title="Previous month">&lt;</button>
            <div class="plan-day-title" style="font-size:18px;">${monthLabel}</div>
            <button class="page-btn" onclick="changeCalendarMonth(1)" title="Next month">&gt;</button>
          </div>
          <div class="calendar-grid" style="margin-bottom:6px;">
            ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `<div style="text-align:center; font-weight:700; font-size:12px; color:var(--text-muted);">${d}</div>`).join('')}
          </div>
          <div class="calendar-grid">`;

        for (let i = 0; i < firstWeekday; i++) {
          html += `<div class="calendar-cell" style="background:transparent; border:none; min-height:70px;"></div>`;
        }

        for (let dateNum = 1; dateNum <= daysInMonth; dateNum++) {
          const cellDate = new Date(calendarViewYear, calendarViewMonth, dateNum);
          const isToday = cellDate.toDateString() === todayStr;
          let dayObj = null;
          if (startDateObj) {
            const dayNumber = Math.floor((cellDate - startDateObj) / 86400000) + 1;
            dayObj = scheduleByDayNumber[dayNumber] || null;
          }

          let cellClasses = 'calendar-cell';
          if (isToday) cellClasses += ' today';
          if (dayObj && dayObj.completed) cellClasses += ' completed';

          let cellContent = `<div class="calendar-cell-header"><span class="plan-day-title">${dateNum}</span></div>`;
          let cellAttrs = '';
          if (dayObj) {
            cellContent = `
              <div class="calendar-cell-header">
                <span class="plan-day-title">${dateNum}</span>
                <input type="checkbox" class="plan-checkbox" ${dayObj.completed ? 'checked' : ''} onclick="event.stopPropagation()" onchange="togglePlanDay(${dayObj.rowIndex}, this.checked)">
              </div>
              <div class="plan-passages">${dayObj.passages || ''}</div>`;
            cellAttrs = `style="cursor:pointer; min-height:70px;" onclick="jumpToPlanDay(${dayObj.day})" title="View this day's reading"`;
          } else {
            cellAttrs = `style="min-height:70px;"`;
          }

          html += `<div class="${cellClasses}" ${cellAttrs}>${cellContent}</div>`;
        }

        const trailingCells = (firstWeekday + daysInMonth) % 7;
        if (trailingCells !== 0) {
          for (let i = trailingCells; i < 7; i++) {
            html += `<div class="calendar-cell" style="background:transparent; border:none; min-height:70px;"></div>`;
          }
        }

        html += `</div>`;
        container.innerHTML = html;
      }
    }

    async function togglePlanDay(scheduleId, isCompleted) {
      // Shared by the Daily Reading checkbox, the Calendar view's per-day
      // checkbox, and the "Listen aloud" auto-complete flow — guard here once
      // rather than in each caller. Reverts the local model + re-renders so a
      // checkbox that already flipped visually snaps back instead of appearing
      // to have saved.
      if (!currentUser) {
        const dayObj = cachedScheduleDays.find(d => d.rowIndex === scheduleId);
        if (dayObj) dayObj.completed = !isCompleted;
        renderActivePlanView();
        ensureLoggedInFor('Sign in to track your reading progress.', () => togglePlanDay(scheduleId, isCompleted));
        return;
      }
      const dayObj = cachedScheduleDays.find(d => d.rowIndex === scheduleId);
      if (dayObj) dayObj.completed = isCompleted;
      renderActivePlanView();

      const { error } = await userReadingProgressTable.upsert({
        user_id: currentUser.id,
        schedule_id: scheduleId,
        completed: isCompleted,
        updated_at: new Date()
      }, null, { onConflict: 'user_id,schedule_id' });

      if (error) console.error('Error saving reading progress:', error.message);
      updatePlanStatusNotification();

      // Every day now checked off — the plan is genuinely finished. Award the record,
      // then reset it all the way back to "not started" so it's opt-in again next time.
      if (isCompleted && cachedScheduleDays.length > 0 && cachedScheduleDays.every(d => d.completed)) {
        await completeCurrentPlan();
      }
    }

    // Runs once when a plan's last day is marked complete: records the achievement,
    // then wipes progress + start date so the plan reverts to opted-out — the user has
    // to click "Start Plan" again to go through it another time.
    async function completeCurrentPlan() {
      const scheduleName = document.getElementById('schedule-select').value;

      const badgeResult = await checkReadingPlanCompletionBadges(scheduleName);

      const scheduleIds = cachedScheduleDays.map(d => d.rowIndex);
      if (scheduleIds.length > 0) {
        const { error: progressErr } = await userReadingProgressTable
          .deleteQuery()
          .eq('user_id', currentUser.id)
          .in('schedule_id', scheduleIds);
        if (progressErr) console.error('Error clearing completed plan progress:', progressErr.message);
      }

      const { error: planErr } = await userReadingPlansTable
        .deleteQuery()
        .eq('user_id', currentUser.id)
        .eq('schedule_name', scheduleName);
      if (planErr) console.error('Error clearing completed plan start date:', planErr.message);

      cachedScheduleDays.forEach(d => { d.completed = false; });
      currentPlanStartDate = null;
      currentPlanViewDayNumber = null;
      readingNotificationSeen = false;
      lastSeenReadingMessage = null;

      updatePlanStartRestartButton();
      renderActivePlanView();
      updatePlanStatusNotification();

      let badgeNote = '';
      if (badgeResult && badgeResult.failed > 0) {
        badgeNote = '\n\n⚠️ A badge was supposed to be awarded for this but saving it failed (likely a database permissions issue) — check the browser console for details.';
      } else if (badgeResult && badgeResult.matched === 0) {
        badgeNote = '\n\n(No badge is currently set up to award for this specific plan — that\'s fine if you haven\'t created one yet.)';
      }
      alert(`🎉 You completed the "${scheduleName}" reading plan! It's been reset — click "Start Plan" whenever you're ready to go through it again.${badgeNote}`);
    }

    // Used by the Daily Reading view's checkbox specifically: marking a day complete
    // automatically advances the view to the next reading that's actually due.
    async function handleDailyCheckboxChange(scheduleId, checked) {
      // Guest sessions can't normally reach a started plan's checkbox (starting one
      // requires login), but a logout while already viewing it would leave it
      // clickable — guard here too rather than letting the save throw.
      if (!currentUser) {
        const checkboxEl = document.getElementById('daily-complete-checkbox');
        if (checkboxEl) checkboxEl.checked = !checked;
        ensureLoggedInFor('Sign in to track your reading progress.', () => handleDailyCheckboxChange(scheduleId, checked));
        return;
      }
      const dayNumberAtCompletion = currentPlanViewDayNumber;
      await togglePlanDay(scheduleId, checked);
      if (checked) {
        // Let the completion banner stay on screen for a moment before advancing.
        setTimeout(() => {
          // Only auto-advance if the user is still looking at the day they just
          // completed — if they've since navigated elsewhere, leave them be.
          if (currentPlanViewDayNumber === dayNumberAtCompletion) {
            currentPlanViewDayNumber = getCurrentDueDayNumber();
            renderActivePlanView();
          }
        }, 2000);
      }
    }

    async function confirmRestartPlan() {
      if (dailyReadingTtsActive) stopDailyReadingTts();
      if (!confirm('Are you sure you want to restart your reading plan progress? This will also reset your start date to today.')) return;

      const scheduleName = document.getElementById('schedule-select').value;
      const scheduleIds = cachedScheduleDays.map(d => d.rowIndex);
      if (scheduleIds.length === 0) return;

      const { error } = await userReadingProgressTable
        .deleteQuery()
        .eq('user_id', currentUser.id)
        .in('schedule_id', scheduleIds);

      if (error) {
        console.error('Error restarting plan:', error.message);
        alert('Could not restart plan: ' + error.message);
        return;
      }

      const todayStr = localDateString();
      const { error: dateError } = await userReadingPlansTable
        .updateQuery({ start_date: todayStr })
        .eq('user_id', currentUser.id)
        .eq('schedule_name', scheduleName);

      if (dateError) console.error('Error resetting plan start date:', dateError.message);

      currentPlanViewDayNumber = null;
      readingNotificationSeen = false;
      lastSeenReadingMessage = null;
      loadReadingSchedule();
    }

    // --- RESOURCES TAB LOGIC ("Line Upon Line") ---
    // Which book's references are currently expanded below the Old/New Testament lists.
    // Only one book is ever open at a time; re-clicking it collapses back to just the lists.
    let activeLineUponLineBook = null;

    // Which individual resource cards (by their DB id) are expanded to show their
    // full notes/tags/admin controls, rather than the standard collapsed size. Kept
    // as a set of ids (not per-render state) so it survives renderResourcesTab()
    // being rebuilt from scratch — by a live-sync tick, a different book being
    // opened, etc. Any number of cards can be open at once (not an accordion).
    let expandedResourceCardIds = new Set();

    function toggleResourceCardExpanded(event, id) {
      // This is bound to a click anywhere on the card, so a click that landed on
      // one of the real <a>/<button> controls inside it (the video trigger, the
      // resource's own URL, Edit/Delete, Share) still runs that control's own
      // onclick first (the DOM fires the innermost listener before this one, since
      // this only runs once the click bubbles up) — this guard just stops it from
      // ALSO toggling the card underneath. The "Show more/less" indicator itself is
      // deliberately a plain <div>, not a <button>, so its clicks fall through to
      // this handler instead of being caught here.
      if (event.target.closest('a, button')) return;
      if (expandedResourceCardIds.has(id)) expandedResourceCardIds.delete(id);
      else expandedResourceCardIds.add(id);
      renderResourcesTab();
    }

    // Builds a single resource-card's HTML — shared by the (only) list of resources
    // shown under whichever book is currently expanded.
    function renderResourceCardHtml(r) {
      if (currentUser && currentUser.isAdmin && editingChurchResourceId === r.id) {
        // Always "expanded" — an open edit form needs its full height, never the
        // standard collapsed size, and isn't itself click-to-toggle.
        return `<div class="resource-card expanded">${renderChurchResourceEditFormHtml(r, 'lul', r.rowIndex, r.verseRef)}</div>`;
      }

      let typeBadge = r.type ? `<span class="type-tag">${r.type}</span>` : '';
      let tagBadges = r.tags ? r.tags.split(',').map(t => `<span class="tag">${t.trim()}</span>`).join(' ') : '';
      let displayTitle = r.title || r.resource;

      // Same resolution used by the Note view's Church Resources column, so a
      // resource's thumbnail (or lack of one) and its in-app video player both
      // agree no matter which of the two lists it's being shown in.
      const youTubeId = r.resource ? getYouTubeVideoId(r.resource) : null;
      const thumbUrl = resolveChurchResourceThumbnail(r);

      let titleHtml;
      if (youTubeId) {
        const safeUrlJs = (r.resource || '').replace(/'/g, "\\'");
        const safeTitleJs = (displayTitle || '').replace(/'/g, "\\'");
        const safeVerseRefJs = (r.verseRef || '').replace(/'/g, "\\'");
        const inlinePlayIcon = thumbUrl ? '' : `<span class="church-resource-video-inline-play"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg></span>`;
        titleHtml = `<button type="button" class="church-resource-video-trigger" onclick="openChurchResourceVideo('${safeUrlJs}', '${safeTitleJs}', '${safeVerseRefJs}')" title="Play video"><span class="church-resource-video-title">${inlinePlayIcon}${displayTitle}</span></button>`;
      } else {
        // See the matching comment in the Note view's Church Resources renderer —
        // a plain link title over a custom thumbnail image needs an inline white
        // color (an inline style always beats the .has-video-thumb h3 CSS rule that
        // would otherwise apply) so it stays readable against the cover image.
        const linkIsOverCustomThumb = isCustomThumbnailShown(r, thumbUrl);
        const linkColorStyle = linkIsOverCustomThumb ? 'color: #fff; text-shadow: 0 1px 4px rgba(0,0,0,0.85);' : 'color: var(--primary-color);';
        titleHtml = r.resource ? `<a href="${r.resource}" target="_blank" style="${linkColorStyle} text-decoration: none;">${displayTitle}</a>` : (displayTitle ? `<span>${displayTitle}</span>` : '');
      }
      let notesHtml = r.notes ? `<div style="font-size: 13px; ${thumbUrl ? 'color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,0.8);' : 'color: var(--text-muted);'} margin-top: 4px; white-space: pre-wrap;">${r.notes}</div>` : '';
      const playIconHtml = (youTubeId && thumbUrl) ? `<div class="church-resource-video-playbtn"><svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg></div>` : '';

      let verseRefHtml = r.verseRef ? `<div style="font-size: 15px; font-family: var(--font-heading); ${thumbUrl ? 'color: #fff; text-shadow: 0 1px 4px rgba(0,0,0,0.85); border-bottom-color: rgba(255,255,255,0.4);' : 'color: var(--primary-color);'} letter-spacing: 0.5px; margin-bottom: 8px; border-bottom: 1px solid var(--border-color); padding-bottom: 4px;">${r.verseRef}</div>` : '';

      let adminBtns = '';
      if (currentUser && currentUser.isAdmin) {
        let safeRef = r.verseRef ? r.verseRef.replace(/'/g, "\\'") : '';
        let safeUrl = r.resource ? r.resource.replace(/'/g, "\\'") : '';
        let safeTitle = r.title ? r.title.replace(/'/g, "\\'") : '';
        adminBtns = `<div style="display: flex; justify-content: flex-end; gap: 6px; margin-top: 8px;">
          <button class="page-btn" style="padding: 2px 6px; font-size: 11px;" onclick="startEditChurchResource(${r.id}, ${r.rowIndex}, '${safeRef}')">Edit</button>
          <button class="page-btn" style="padding: 2px 6px; font-size: 11px; background: #fee2e2; color: #b91c1c; border-color: #fca5a5;" onclick="deleteResourceFromTab('${safeRef}', '${safeUrl}', '${safeTitle}', ${r.rowIndex})">Delete</button>
        </div>`;
      }

      const isExpanded = expandedResourceCardIds.has(r.id);
      // A "Booklet"-tagged resource showing its own custom thumbnail (its cover
      // image) gets top-anchored instead of the usual centered crop — see the
      // .thumb-top-align CSS rule for why.
      const bookletTopAlign = isCustomThumbnailShown(r, thumbUrl) && hasBookletTag(r.tags);
      const cardClass = `resource-card${thumbUrl ? ' has-video-thumb' : ''}${bookletTopAlign ? ' thumb-top-align' : ''}${isExpanded ? ' expanded' : ''}`;
      const cardStyleAttr = thumbUrl ? ` style="background-image: linear-gradient(180deg, rgba(10,10,14,0.2) 0%, rgba(10,10,14,0.85) 100%), url('${thumbUrl.replace(/'/g, "\\'")}');"` : '';
      const toggleChevronSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

      return `
        <div class="${cardClass}"${cardStyleAttr} onclick="toggleResourceCardExpanded(event, ${r.id})">
          ${playIconHtml}
          ${verseRefHtml}
          <div style="display: flex; gap: 6px; margin-bottom: 6px;">${typeBadge}</div>
          ${titleHtml ? `<h3>${titleHtml}</h3>` : ''}
          <div class="resource-card-toggle">${isExpanded ? 'Show less' : 'Show more'} ${toggleChevronSvg}</div>
          <div class="resource-card-details">
            ${notesHtml}
            ${tagBadges ? `<div>${tagBadges}</div>` : ''}
            ${adminBtns}
            <button class="share-btn resource-share-btn" title="Share this resource" onclick="shareResource(${r.id}, '${(r.verseRef || '').replace(/'/g, "\\'")}')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
            </button>
          </div>
        </div>`;
    }

    // Flattens every church resource across the WHOLE Bible into a single list, each
    // tagged with the verse reference/rowIndex it belongs to (currentBibleVerses holds
    // every book, not just whatever chapter is currently open in the Note view). Shared
    // by the Old/New Testament book grouping below and by the "search all Church
    // Resources" box, so both always agree on exactly what counts as a resource.
    function getAllChurchResourcesFlat() {
      const flat = [];
      if (!currentBibleVerses || currentBibleVerses.length === 0) return flat;

      currentBibleVerses.forEach(v => {
        let combined = [];
        let mapRes = churchResourcesMap[v.rowIndex] || [];
        let vRes = v.resources || [];

        mapRes.forEach(r => combined.push(r));
        vRes.forEach(r => {
          if (!combined.some(c => c.resource === r.resource && c.title === r.title)) {
            combined.push(r);
          }
        });

        combined.forEach(res => {
          if (res && (res.resource || res.title || res.notes)) {
            flat.push({ ...res, verseRef: v.reference, rowIndex: v.rowIndex });
          }
        });
      });

      return flat;
    }

    function renderResourcesTab() {
      const grid = document.getElementById('resource-grid');
      if (!grid) return;

      // Same admin-only toggle pattern as Core-D's "⚙ Manage Content" button (see
      // renderFoundationsTab) — shown only for admins, re-checked on every call here
      // so signing in/out is reflected immediately without a page reload.
      const addResourceRow = document.getElementById('line-upon-line-add-resource-row');
      if (addResourceRow) addResourceRow.style.display = (currentUser && currentUser.isAdmin) ? 'block' : 'none';

      // Group every resource in the Bible by the book its verse belongs to.
      const resourcesByBook = {};
      getAllChurchResourcesFlat().forEach(res => {
        const lastSpace = res.verseRef.lastIndexOf(' ');
        const book = lastSpace !== -1 ? res.verseRef.substring(0, lastSpace) : res.verseRef;
        if (!resourcesByBook[book]) resourcesByBook[book] = [];
        resourcesByBook[book].push(res);
      });

      // If the book that was expanded no longer has anything under it (e.g. its last
      // resource was just deleted), fall back to just showing the book lists.
      if (activeLineUponLineBook && !(resourcesByBook[activeLineUponLineBook] || []).length) {
        activeLineUponLineBook = null;
      }

      // BIBLE_STUDIES_BOOK_ORDER is the full 66-book canonical order — Matthew is where
      // the New Testament begins (index 39), so it splits cleanly into OT/NT here too.
      const oldTestamentBooks = BIBLE_STUDIES_BOOK_ORDER.slice(0, 39);
      const newTestamentBooks = BIBLE_STUDIES_BOOK_ORDER.slice(39);

      const renderBookColumns = (books) => `
        <div class="line-upon-line-columns">
          ${books.map(book => {
            const count = (resourcesByBook[book] || []).length;
            const isActive = activeLineUponLineBook === book;
            const empty = count === 0;
            const safeBook = book.replace(/'/g, "\\'");
            return `<button type="button" class="line-upon-line-book ${isActive ? 'active' : ''} ${empty ? 'disabled' : ''}" onclick="selectLineUponLineBook('${safeBook}')">${book}${count ? `<span class="line-upon-line-count">${count}</span>` : ''}</button>`;
          }).join('')}
        </div>`;

      grid.innerHTML = `
        <div class="line-upon-line-testament">
          <h3 class="line-upon-line-heading">Old Testament</h3>
          ${renderBookColumns(oldTestamentBooks)}
        </div>
        <div class="line-upon-line-testament">
          <h3 class="line-upon-line-heading">New Testament</h3>
          ${renderBookColumns(newTestamentBooks)}
        </div>
        <div id="line-upon-line-panel" class="line-upon-line-panel" style="display:${activeLineUponLineBook ? 'block' : 'none'};"></div>`;

      if (activeLineUponLineBook) {
        renderLineUponLinePanel(activeLineUponLineBook, resourcesByBook[activeLineUponLineBook] || []);
      }

      // Whatever the trigger (first navigating here, live sync pulling in a resource
      // that was added while the user was already sitting on this tab, or opening a
      // specific book to read its "Resources by Verse" entries), this list is only
      // ever rebuilt while the user can actually see it — so a rebuild IS the user
      // seeing it, new entries included. Mark it seen right here rather than only on
      // the tab-switch click, otherwise the bubble next to "Line Upon Line" could keep
      // showing a stale "new" count even after the user opened the very book/verse
      // that new entry belongs to (selectLineUponLineBook() re-renders this same grid
      // but never itself switches sub-tabs, so it never used to clear the bubble).
      if (isResourcesSubTabVisible()) markStudySubTabSeen('resources');

      // Keep an active search's results in sync with whatever just changed here (a
      // resource added/edited/deleted, live sync pulling in something new) — mirrors
      // how the book panel above is refreshed on every call rather than only when the
      // user first opens a book. A no-op (leaves the area empty) while the search box
      // itself is empty, so this never draws anything the user didn't ask to see.
      renderLineUponLineSearchResults();
    }

    // Renders (or clears) the "search all Church Resources" results that live
    // between the search box and the Old Testament heading. Reads the search box's
    // current value fresh each time rather than caching it, the same pattern used by
    // renderFoundationsList()/#foundations-search-input — the input itself is a
    // persistent DOM node (never touched by renderResourcesTab's innerHTML rebuild
    // of #resource-grid), so typing in it is never interrupted by a re-render here.
    function renderLineUponLineSearchResults() {
      const container = document.getElementById('line-upon-line-search-results');
      if (!container) return;

      const term = (document.getElementById('line-upon-line-search-input')?.value || '').trim().toLowerCase();

      // Nothing typed — leave the space between the search box and the Old Testament
      // heading completely empty, as if the search box weren't there at all.
      if (!term) {
        container.innerHTML = '';
        return;
      }

      const matches = getAllChurchResourcesFlat().filter(r =>
        (r.title && r.title.toLowerCase().includes(term)) ||
        (r.notes && r.notes.toLowerCase().includes(term)) ||
        (r.tags && r.tags.toLowerCase().includes(term)) ||
        (r.verseRef && r.verseRef.toLowerCase().includes(term)) ||
        (r.resource && r.resource.toLowerCase().includes(term)) ||
        (r.type && r.type.toLowerCase().includes(term))
      );

      if (matches.length === 0) {
        container.innerHTML = `<div style="color:var(--text-muted); font-size:13px; margin-bottom:20px;">No Church Resources match "${escapeHtml(term)}".</div>`;
        return;
      }

      container.innerHTML = `
        <div style="color:var(--text-muted); font-size:13px; margin-bottom:8px;">Found ${matches.length} matching resource${matches.length === 1 ? '' : 's'}.</div>
        <div class="resource-grid-inner" style="margin-bottom:24px;">${matches.map(renderResourceCardHtml).join('')}</div>`;
    }

    // True only while the "Line Upon Line" (Resources by Verse) sub-tab is the one
    // actually on screen — i.e. the Study tab itself is active AND this is the active
    // sub-tab within it. Used to decide whether a render of the resources grid counts
    // as the user having seen it (see the end of renderResourcesTab above).
    function isResourcesSubTabVisible() {
      const mainTab = document.getElementById('study-tab');
      const subContent = document.getElementById('study-sub-resources-content');
      return !!(mainTab && mainTab.classList.contains('active') && subContent && subContent.classList.contains('active'));
    }

    // Clicking a book expands its references below the lists, collapsing whichever book
    // was previously expanded; clicking the already-expanded book collapses it again.
    function selectLineUponLineBook(book) {
      activeLineUponLineBook = (activeLineUponLineBook === book) ? null : book;
      renderResourcesTab();
      if (activeLineUponLineBook) {
        const panel = document.getElementById('line-upon-line-panel');
        if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    function renderLineUponLinePanel(book, resources) {
      const panel = document.getElementById('line-upon-line-panel');
      if (!panel) return;

      if (resources.length === 0) {
        panel.innerHTML = `<div style="color:var(--text-muted); font-size:13px;">No resources found for ${book} yet.</div>`;
        return;
      }

      panel.innerHTML = `
        <h3 class="line-upon-line-panel-title">${book}</h3>
        <div class="resource-grid-inner">${resources.map(renderResourceCardHtml).join('')}</div>`;
    }

    // --- MY MARGINS TAB LOGIC ---

    // Reduces a full reference like "Genesis 3:5" down to just "Genesis 3", the way
    // a printed reference book's running head would show it.
    function getMyMarginsBookChapter(ref) {
      const lastSpace = ref.lastIndexOf(' ');
      let bookChapter = ref;
      if (lastSpace !== -1) {
        const colonIdx = ref.indexOf(':', lastSpace);
        if (colonIdx !== -1) {
          bookChapter = ref.substring(0, colonIdx);
        }
      }
      return bookChapter;
    }

    // The cover page's title/name are user-editable (contenteditable) and persisted
    // locally so they survive re-renders and future visits. Title defaults to
    // "MyMargins"; name defaults to the user's Cords display name.
    const MYMARGINS_COVER_TITLE_KEY = 'mymargins_cover_title';
    const MYMARGINS_COVER_NAME_KEY = 'mymargins_cover_name';

    function getMyMarginsCoverDefaults() {
      let savedTitle = null, savedName = null;
      try {
        savedTitle = localStorage.getItem(MYMARGINS_COVER_TITLE_KEY);
        savedName = localStorage.getItem(MYMARGINS_COVER_NAME_KEY);
      } catch (e) {}

      const title = (savedTitle != null && savedTitle.trim() !== '') ? savedTitle : 'MyMargins';
      const name = (savedName != null && savedName.trim() !== '')
        ? savedName
        : ((currentUser && (currentUser.cordDisplayName || currentUser.username)) || '');

      return { title, name };
    }

    // Called on input from the cover page's contenteditable fields to persist edits.
    function saveMyMarginsCoverField(field, el) {
      const key = field === 'title' ? MYMARGINS_COVER_TITLE_KEY : MYMARGINS_COVER_NAME_KEY;
      try { localStorage.setItem(key, el.textContent); } catch (e) {}
    }

    function renderMyMargins() {
      const container = document.getElementById('mymargins-print-area');

      const { title: coverTitle, name: coverName } = getMyMarginsCoverDefaults();
      const coverHtml = `
        <div class="dict-page mymargins-cover-page page-break">
          <div class="mymargins-cover-inner">
            <div id="mymargins-cover-title" class="mymargins-cover-title" contenteditable="true" spellcheck="false"
                 oninput="saveMyMarginsCoverField('title', this)">${escapeHtml(coverTitle)}</div>
            <div id="mymargins-cover-name" class="mymargins-cover-name" contenteditable="true" spellcheck="false"
                 oninput="saveMyMarginsCoverField('name', this)">${escapeHtml(coverName)}</div>
            <div class="mymargins-cover-hint no-print">Tap the title or name above to edit them</div>
          </div>
        </div>`;

      // Notes now live entirely in window.userMarginNotes (synced from the margin_notes table).
      const notesMap = {};

      if (window.userMarginNotes) {
        for (const [ref, noteObj] of Object.entries(window.userMarginNotes)) {
          if (noteObj.text && noteObj.text.trim() !== '') {
            notesMap[ref] = { reference: ref, text: noteObj.text.trim(), color: noteObj.color };
          }
        }
      }

      const notes = Object.values(notesMap);

      if (notes.length === 0) {
        container.innerHTML = coverHtml + '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No margin notes found. Add notes in the Bible View to see them here!</div>';
        return;
      }

      const NOTES_PER_PAGE = 20;
      let html = coverHtml;

      for (let i = 0; i < notes.length; i += NOTES_PER_PAGE) {
        const pageNotes = notes.slice(i, i + NOTES_PER_PAGE);

        // Running header: first reference on this page in the top-left corner, last
        // reference on this page in the top-right corner (book + chapter only).
        const firstBookChapter = getMyMarginsBookChapter(pageNotes[0].reference);
        const lastBookChapter = getMyMarginsBookChapter(pageNotes[pageNotes.length - 1].reference);

        html += `<div class="dict-page page-break">`;
        html += `<div class="dict-header-row">
                   <span class="dict-header-left">${escapeHtml(firstBookChapter)}</span>
                   <span class="dict-header-right">${escapeHtml(lastBookChapter)}</span>
                 </div>`;

        html += `<div class="dict-columns">`;
        pageNotes.forEach(n => {
          html += `<div class="margin-entry">
                     <strong>${escapeHtml(n.reference)}</strong>
                     <p style="color: ${n.color !== '#000000' ? n.color : 'inherit'};">${escapeHtml(n.text)}</p>
                   </div>`;
        });
        html += `</div>`;

        html += `</div>`;
      }

      container.innerHTML = html;
    }

    function printMyMargins() {
      window.print();
    }

    async function deleteResourceFromTab(verseRef, resourceUrl, resourceTitle, rowIndex) {
      if (!currentUser || !currentUser.isAdmin) return;

      if (!confirm("Are you sure you want to delete this resource?")) return;

      const match = (churchResourcesMap[rowIndex] || []).find(r => r.resource === resourceUrl && r.title === resourceTitle);
      if (match && match.id != null) {
        const { error } = await churchResourcesTable.remove(match.id);
        if (error) {
          console.error('Error deleting resource:', error.message);
          alert('Could not delete resource: ' + error.message);
          return;
        }

        // This resource may be tied to more than just this one verse (see
        // saveNewChurchResource) — find every rowIndex currently displaying it
        // BEFORE removing it, so each of those Note-view columns is refreshed too,
        // not just this one.
        const affectedRowIndexes = new Set();
        Object.keys(churchResourcesMap).forEach(ri => {
          if ((churchResourcesMap[ri] || []).some(r => r.id === match.id)) affectedRowIndexes.add(Number(ri));
        });

        removeChurchResourceEverywhere(match.id);

        affectedRowIndexes.forEach(ri => {
          const v = currentBibleVerses.find(vv => vv.rowIndex === ri);
          updateChurchResourcesDOM(ri, v ? v.reference : verseRef);
        });
      } else if (churchResourcesMap[rowIndex]) {
        // No DB id to match on (shouldn't normally happen) — fall back to removing
        // just this one local copy by its url+title.
        const idx = churchResourcesMap[rowIndex].findIndex(r => r.resource === resourceUrl && r.title === resourceTitle);
        if (idx !== -1) churchResourcesMap[rowIndex].splice(idx, 1);
        const verseObj = currentBibleVerses.find(v => v.rowIndex === rowIndex);
        if (verseObj && verseObj.resources) {
          const vIdx = verseObj.resources.findIndex(r => r.resource === resourceUrl && r.title === resourceTitle);
          if (vIdx !== -1) verseObj.resources.splice(vIdx, 1);
        }
        updateChurchResourcesDOM(rowIndex, verseRef);
      }

      renderResourcesTab();
      updateStudyNotificationBadges();
    }
    
    document.addEventListener('DOMContentLoaded', () => {
      applyDarkModePreference();
      captureShareTargetFromURL();
      checkUserSession();
    });

    // Reveals the Daily Reading play/pause control ~2s after the user opens
    // the Reading nav-tab for the first time (not on page load) — it starts
    // collapsed (see #daily-reading-tts-wrap, .tts-wrap-collapsed) so the
    // Reading/Calendar view buttons sit right next to each other at first,
    // then smoothly opens up to show play/pause. The delay isn't just for
    // show — it buys the Google voice warm-up (warmUpDailyReadingTtsVoice,
    // which itself starts as soon as the app opens, well before this) a
    // little extra time to finish before the button is even tappable. Only
    // runs once per page load — re-visiting the Reading tab afterward leaves
    // the control already revealed.
    let dailyReadingTtsWrapRevealed = false;
    function revealDailyReadingTtsWrapOnce() {
      if (dailyReadingTtsWrapRevealed) return;
      dailyReadingTtsWrapRevealed = true;
      setTimeout(() => {
        const wrap = document.getElementById('daily-reading-tts-wrap');
        if (wrap) wrap.classList.remove('tts-wrap-collapsed');
      }, 2000);
    }

    // On mobile browsers, nudging the scroll position slightly on load helps the
    // browser start with its own toolbar already collapsed (older Android WebViews
    // in particular sometimes need this; modern iOS/Chrome auto-collapse on the
    // user's own scroll regardless). This can only ever affect the BROWSER's own
    // chrome — there's no way for a webpage to hide the phone's OS-level UI.
    window.addEventListener('load', () => {
      if (document.documentElement.scrollHeight > window.innerHeight) {
        setTimeout(() => window.scrollTo(0, 1), 50);
      }
    });

    // ============================================================
    // CORDS SYSTEM (request/accept, direct + group cords)
    // ============================================================
    let cordList = [];          // accepted cords, sorted by most recent activity
    let cordPending = [];       // invites awaiting the current user's response
    let cordNewUsernames = [];  // username chips being built for a new cord
    let activeCordId = null;    // set = viewing that cord's message thread
    let cordMessagesCache = [];
    let cordPollTimer = null;
    let cordUsernameCache = {};

    // --- Avatar helpers (IG-style colored initial circles — no photo storage,
    // so every avatar is generated from the app's own existing palette). ---
    const CORD_AVATAR_COLORS = ['var(--primary-color)', 'var(--accent-teal)', 'var(--accent-coral)', 'var(--accent-purple)', 'var(--accent-yellow)', 'var(--secondary-color)'];
    function cordAvatarColor(seed) {
      const str = String(seed || '?');
      let hash = 0;
      for (let i = 0; i < str.length; i++) { hash = (hash * 31 + str.charCodeAt(i)) >>> 0; }
      return CORD_AVATAR_COLORS[hash % CORD_AVATAR_COLORS.length];
    }
    function cordAvatarInitial(name) {
      const trimmed = (name || '').trim();
      return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
    }
    // seed should be something stable per-person (a user id) when available, so a
    // given person's avatar color doesn't shift if their display name changes.
    // An inline SVG (rather than the 👥 emoji) so the group icon is always a
    // solid white glyph on the avatar circle, no matter what platform this
    // renders on — an emoji's colors come from the OS's own emoji font and
    // ignore CSS color entirely, which is why it never matched the white
    // initials used for direct-cord avatars.
    const CORD_GROUP_ICON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:55%; height:55%;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>';

    function cordAvatarHtml(name, seed, isGroup, size) {
      const px = size || 44;
      const bg = cordAvatarColor(seed || name);
      const content = isGroup ? CORD_GROUP_ICON_SVG : cordAvatarInitial(name);
      return `<div class="cord-avatar" style="background:${bg}; width:${px}px; height:${px}px; font-size:${Math.round(px * 0.42)}px;">${content}</div>`;
    }

    // ============================================================
    // SHARE SHEET — opened from any content share icon (the verse share button,
    // every resource share button). Offers sending straight into a Cord, on top
    // of the existing copy-link / native-device-share options.
    // ============================================================
    let shareSheetContext = null; // { url, label } for whatever's currently being shared

    async function openShareSheet(url, label) {
      shareSheetContext = { url, label };
      const titleEl = document.getElementById('share-sheet-title');
      if (titleEl) titleEl.innerText = label || 'Share';

      const deviceBtn = document.getElementById('share-sheet-device-btn');
      if (deviceBtn) deviceBtn.style.display = (typeof navigator.share === 'function') ? 'block' : 'none';

      // Paint instantly from whatever's cached (if the person has never opened
      // the Cords tab this session, this is empty — that's fine, the fresh fetch
      // right below fills it in a moment later without the sheet ever showing a
      // stale "no cords yet" that then flickers a real list in behind it, since
      // we only render once here and once after the refresh resolves.
      if (cordList.length === 0) loadCordCacheFromStorage();
      renderShareSheetCordList();
      document.getElementById('share-sheet-modal').style.display = 'flex';

      if (currentUser) {
        try {
          await loadCordData();
          if (shareSheetContext) renderShareSheetCordList(); // still open? repaint with the fresh list
        } catch (e) {}
      }
    }

    function closeShareSheet() {
      document.getElementById('share-sheet-modal').style.display = 'none';
      shareSheetContext = null;
    }

    function renderShareSheetCordList() {
      const listEl = document.getElementById('share-sheet-cord-list');
      if (!listEl) return;

      if (!currentUser) {
        listEl.innerHTML = `<div style="color:var(--text-muted); font-size:13px; padding:8px 0;">Sign in to send this in a Cord.</div>`;
        return;
      }

      if (cordList.length === 0) {
        listEl.innerHTML = `
          <div style="color:var(--text-muted); font-size:13px; padding:4px 0 12px;">You don't have any cords yet.</div>
          <button type="button" class="page-btn" style="width:100%;" onclick="closeShareSheet(); switchTab('bible'); openCordView();">Start a Cord</button>`;
        return;
      }

      listEl.innerHTML = `<div class="cord-section-label" style="margin-top:0;">Send in a Cord</div>` +
        cordList.map(c => `
          <div class="cord-list-item" onclick="sendShareToCord(${c.id})">
            ${cordAvatarHtml(c.name, c.avatarSeed, c.isGroup, 40)}
            <div class="cord-list-item-info">
              <span class="cord-list-item-name">${escapeHtml(c.name)}</span>
              <span class="cord-list-item-sub">${c.isGroup ? 'Group cord' : 'Direct cord'}</span>
            </div>
          </div>`).join('');
    }

    async function sendShareToCord(cordId) {
      if (!shareSheetContext || !currentUser) return;
      const { url, label } = shareSheetContext;
      const content = `${label}\n${url}`;

      const { error } = await cordMessagesTable.insert({
        cord_id: cordId,
        sender_id: currentUser.id,
        content
      });

      if (error) {
        console.error('Error sending share to cord:', error.message);
        alert('Could not send: ' + error.message);
        return;
      }

      closeShareSheet();

      // If that cord's thread happens to already be open, refresh it so the
      // shared link shows up immediately instead of waiting for the next poll.
      if (activeCordId === cordId) { loadCordMessages().then(() => renderCordViewBody()); }
    }

    async function shareSheetCopyLink() {
      if (!shareSheetContext) return;
      try {
        await navigator.clipboard.writeText(shareSheetContext.url);
        alert('Link copied to clipboard!');
      } catch (e) {
        prompt('Copy this link:', shareSheetContext.url);
      }
      closeShareSheet();
    }

    async function shareSheetDeviceShare() {
      if (!shareSheetContext) return;
      const { url, label } = shareSheetContext;
      if (navigator.share) {
        try { await navigator.share({ title: 'Accordance', text: label, url }); } catch (e) { /* cancelled */ }
      }
      closeShareSheet();
    }

    // Namespaced by user id (rather than one shared key) so this cache can
    // never be read back for the wrong account — belt-and-suspenders on top
    // of clearing it outright on logout (see logout()). Old shared-key data
    // from before this fix is simply never read under the new key and just
    // sits there inert; it's harmless.
    function cordCacheStorageKey() {
      return currentUser && currentUser.id ? `cordDataCache_${currentUser.id}` : null;
    }

    function saveCordCacheToStorage() {
      const key = cordCacheStorageKey();
      if (!key) return;
      try {
        localStorage.setItem(key, JSON.stringify({
          userId: currentUser.id,
          list: cordList,
          pending: cordPending,
          usernames: cordUsernameCache,
          ts: Date.now()
        }));
      } catch (e) {}
    }

    function loadCordCacheFromStorage() {
      const key = cordCacheStorageKey();
      if (!key) return false;
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        // Extra guard: never apply a cached payload that isn't this user's,
        // even if it somehow ended up under this key.
        if (!parsed || parsed.userId !== currentUser.id) return false;
        cordList = parsed.list || [];
        cordPending = parsed.pending || [];
        cordUsernameCache = Object.assign({}, parsed.usernames || {}, cordUsernameCache);
        return true;
      } catch (e) {
        return false;
      }
    }

    // Wipes every trace of the current session's Cords state — in-memory and
    // cached-to-disk — so nothing from this account can leak into whichever
    // account signs in next on this device. Called from logout().
    function resetCordStateForLogout() {
      const key = cordCacheStorageKey();
      cordList = [];
      cordPending = [];
      cordNewUsernames = [];
      activeCordId = null;
      cordMessagesCache = [];
      cordUsernameCache = {};
      if (cordPollTimer) { clearInterval(cordPollTimer); cordPollTimer = null; }
      if (key) {
        try { localStorage.removeItem(key); } catch (e) {}
      }
      // So the next person to log in on this device doesn't briefly see this
      // account's unread count before their own cords ever load.
      const badgeEl = document.getElementById('cords-notification-badge');
      if (badgeEl) badgeEl.style.display = 'none';
      // This container stays in the DOM (just hidden) whenever Cords isn't the
      // active tab, so clear its actual message/list content too — otherwise
      // this account's cord list or an open thread's messages are still sitting
      // there for whoever reopens the tab next.
      const bodyEl = document.getElementById('cord-view-body');
      if (bodyEl) bodyEl.innerHTML = '';
    }

    function openCordView() {
      if (!ensureLoggedInFor('Sign in to use Cords.', () => openCordView())) return;
      document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
      setHeaderIconSelected('cords-header-btn');
      const notifPanel = document.getElementById('reading-notification-panel');
      if (notifPanel) notifPanel.style.display = 'none';

      document.getElementById('cord-view').classList.add('active');
      activeCordId = null;

      // Paint instantly from the last cached copy (if any) while a fresh copy loads
      // in the background — avoids a blank flash and an extra fetch on quick reopens.
      if (loadCordCacheFromStorage()) {
        renderCordViewBody();
      }
      loadCordData();

      if (!cordPollTimer) cordPollTimer = setInterval(() => {
        // While a thread is open, each poll's fresh messages are shown right
        // away, so re-mark that cord read too rather than letting a bubble
        // silently build up behind an already-open conversation.
        if (activeCordId) { loadCordMessages().then(() => {
          const latestMsg = cordMessagesCache.length > 0 ? cordMessagesCache[cordMessagesCache.length - 1].created_at : null;
          setCordLastRead(activeCordId, latestMsg);
          updateCordNotificationBadge();
          renderCordViewBody();
        }); }
        else { loadCordData(); }
      }, 15000);
    }

    function closeCordView() {
      if (cordPollTimer) { clearInterval(cordPollTimer); cordPollTimer = null; }
      switchTab(lastMainTabId);
    }

    function closeMyMarginsView() {
      switchTab(lastMainTabId);
    }

    // Pass forceRefresh = true at the specific spots that actually render names
    // (the cord list, pending requests, an open thread's messages) so a display
    // name someone just changed in Settings shows up there — including on other
    // people's screens — the next time that list loads or the 15s Cords poll
    // ticks, rather than being stuck on whatever was cached the first time this
    // person's id was ever looked up.
    async function resolveCordUsernames(ids, forceRefresh = false) {
      const uniqueIds = [...new Set(ids)].filter(id => id && (forceRefresh || !cordUsernameCache[id]));
      if (uniqueIds.length === 0) return;
      // Prefer each person's Cords display name (set from Settings); fall back to
      // their account username if they haven't set one.
      const { data, error } = await profilesTable.select('id, username, display_name').in('id', uniqueIds);
      if (!error && data) data.forEach(p => { cordUsernameCache[p.id] = p.display_name || p.username; });
    }

    function formatCordDate(dateStr) {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      const today = new Date();
      if (d.toDateString() === today.toDateString()) {
        return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      }
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }

    // --- Cords header notification bubble ---
    // "Unread" is tracked as a last-read timestamp per cord, in localStorage
    // under the current user's id — same convention as every other "seen"
    // tracker in this app (getSeenRecordBadgeIds, getSeenStudyContentIds
    // above), rather than a new DB column, since all it needs to answer is
    // "how many messages came in since I last opened this cord on this
    // device." A cord with no recorded last-read time (never opened) counts
    // every message not sent by you as unread, same as a fresh inbox would.
    function getCordLastReadMap() {
      if (!currentUser) return {};
      try {
        const raw = localStorage.getItem(`cordLastRead_${currentUser.id}`);
        return raw ? JSON.parse(raw) : {};
      } catch (e) { return {}; }
    }

    // atIso lets a caller mark "read up through" the timestamp of the newest
    // message it actually just fetched, rather than "right now" — a hair
    // safer than the wall-clock in case this device's clock and the
    // database's are ever slightly out of step. Falls back to now when no
    // timestamp is given (e.g. there were no messages at all to read).
    function setCordLastRead(cordId, atIso) {
      if (!currentUser) return;
      try {
        const map = getCordLastReadMap();
        map[cordId] = atIso || new Date().toISOString();
        localStorage.setItem(`cordLastRead_${currentUser.id}`, JSON.stringify(map));
      } catch (e) {}
    }

    // Fetches every message across all of the user's (accepted) cords in one
    // query, then counts — per cord — how many arrived after that cord was
    // last read and weren't sent by the user themselves (your own messages
    // never count as "unread" for you). Updates the header bubble with the
    // total across every cord. Call this any time cordList changes (login,
    // opening the Cords view, the background poll, accepting/starting a
    // cord) so the bubble stays accurate even if the user never opens Cords
    // this session.
    async function updateCordNotificationBadge() {
      const badgeEl = document.getElementById('cords-notification-badge');
      if (!badgeEl) return;
      if (!currentUser || cordList.length === 0) { badgeEl.style.display = 'none'; return; }

      const cordIds = cordList.map(c => c.id);
      const { data, error } = await cordMessagesTable
        .select('cord_id, sender_id, created_at')
        .in('cord_id', cordIds);
      if (error) { console.error('Error loading cord messages for unread count:', error.message); return; }

      const lastRead = getCordLastReadMap();
      const unreadCount = (data || []).filter(m => {
        if (m.sender_id === currentUser.id) return false;
        const readAt = lastRead[m.cord_id];
        return !readAt || new Date(m.created_at) > new Date(readAt);
      }).length;

      if (unreadCount > 0) { badgeEl.innerText = unreadCount; badgeEl.style.display = 'flex'; }
      else badgeEl.style.display = 'none';
    }

    async function loadCordData() {
      if (!currentUser) return;

      const { data: memberships, error } = await cordMembersTable
        .select('cord_id, status, cords(id, is_group, name, last_message_at, created_by)')
        .eq('user_id', currentUser.id);

      if (error) { console.error('Error loading cords:', error.message); return; }

      const accepted = (memberships || []).filter(m => m.status === 'accepted' && m.cords);
      const pending = (memberships || []).filter(m => m.status === 'pending' && m.cords);

      // Batch-fetch "the other member" for every direct (non-group) accepted cord in
      // ONE query instead of one round trip per cord — avoids an N+1 query pattern
      // that would otherwise scale with how many cords a user has.
      const directCordIds = accepted.filter(m => !m.cords.is_group).map(m => m.cords.id);
      let otherMemberByCord = {};
      if (directCordIds.length > 0) {
        const { data: otherRows, error: otherError } = await cordMembersTable
          .select('cord_id, user_id')
          .in('cord_id', directCordIds)
          .neq('user_id', currentUser.id);
        if (!otherError && otherRows) {
          otherRows.forEach(r => { otherMemberByCord[r.cord_id] = r.user_id; });
        }
      }
      await resolveCordUsernames(Object.values(otherMemberByCord), true);

      cordList = accepted.map(m => {
        let displayName = m.cords.name;
        const otherId = otherMemberByCord[m.cords.id];
        if (!m.cords.is_group) {
          displayName = otherId ? (cordUsernameCache[otherId] || 'Cord') : 'Cord';
        }
        // Avatar color is seeded from a stable id (the other person's user id for a
        // direct cord, the cord's own id for a group) rather than the display name,
        // so it doesn't shift colors when someone updates their name in Settings.
        return { id: m.cords.id, isGroup: m.cords.is_group, name: displayName, lastMessageAt: m.cords.last_message_at, avatarSeed: m.cords.is_group ? m.cords.id : otherId };
      });
      cordList.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));

      await resolveCordUsernames(pending.filter(m => !m.cords.is_group).map(m => m.cords.created_by), true);
      cordPending = pending.map(m => ({
        id: m.cords.id,
        isGroup: m.cords.is_group,
        name: m.cords.is_group ? m.cords.name : (cordUsernameCache[m.cords.created_by] || 'Someone'),
        avatarSeed: m.cords.is_group ? m.cords.id : m.cords.created_by
      }));

      saveCordCacheToStorage();
      renderCordViewBody();
      updateCordNotificationBadge();
    }

    function addCordUsernameChip() {
      const input = document.getElementById('cord-new-username-input');
      const val = input.value.trim();
      if (!val) return;
      if (!cordNewUsernames.includes(val)) cordNewUsernames.push(val);
      input.value = '';
      renderCordViewBody();
      const refocus = document.getElementById('cord-new-username-input');
      if (refocus) refocus.focus();
    }

    function removeCordUsernameChip(index) {
      cordNewUsernames.splice(index, 1);
      renderCordViewBody();
    }

    async function submitNewCord() {
      const statusEl = document.getElementById('cord-status-msg');
      if (cordNewUsernames.length === 0) {
        if (statusEl) statusEl.innerText = 'Add at least one username first.';
        return;
      }
      const groupNameInput = document.getElementById('cord-group-name-input');
      const groupName = groupNameInput ? groupNameInput.value.trim() : null;

      const { error } = await supabaseClient.rpc('create_cord', {
        p_usernames: cordNewUsernames,
        p_group_name: groupName || null
      });

      if (error) {
        console.error('Error creating cord:', error.message);
        if (statusEl) statusEl.innerText = error.message;
        return;
      }

      cordNewUsernames = [];
      loadCordData();
    }

    async function respondToCord(cordId, accept) {
      const { error } = await supabaseClient.rpc('respond_to_cord_invite', { p_cord_id: cordId, p_accept: accept });
      if (error) { console.error('Error responding to cord:', error.message); return; }
      loadCordData();
    }

    async function openCordThread(cordId) {
      activeCordId = cordId;
      await loadCordMessages();
      // Opening a thread is what "reading" it means here — clear its unread
      // count immediately rather than waiting for the next background poll.
      // Read "through" the newest message just fetched (falling back to now
      // for an empty thread) — see setCordLastRead's comment.
      const latestMsg = cordMessagesCache.length > 0 ? cordMessagesCache[cordMessagesCache.length - 1].created_at : null;
      setCordLastRead(cordId, latestMsg);
      updateCordNotificationBadge();
      renderCordViewBody();
    }

    function backToCordList() {
      activeCordId = null;
      loadCordData();
    }

    async function loadCordMessages() {
      if (!activeCordId) return;
      const { data, error } = await cordMessagesTable
        .select('*')
        .eq('cord_id', activeCordId)
        .order('created_at', { ascending: true });
      if (error) { console.error('Error loading cord messages:', error.message); return; }
      cordMessagesCache = data || [];
      await resolveCordUsernames(cordMessagesCache.map(m => m.sender_id), true);
    }

    async function sendCordThreadMessage() {
      const input = document.getElementById('cord-thread-input');
      const text = input.value.trim();
      if (!text || !activeCordId) return;

      const { error } = await cordMessagesTable.insert({
        cord_id: activeCordId,
        sender_id: currentUser.id,
        content: text
      });
      if (error) { console.error('Error sending cord message:', error.message); return; }
      input.value = '';
      await loadCordMessages();
      renderCordViewBody();
    }

    function renderCordViewBody() {
      const body = document.getElementById('cord-view-body');
      if (!body) return;

      if (activeCordId) {
        renderCordThread(body);
        return;
      }

      let html = `
        <div class="cord-compose-box">
          <div class="cord-section-label" style="margin-top:0;">New Cord</div>
          <div class="cord-search-row">
            <input type="text" id="cord-new-username-input" class="cord-search-input" placeholder="Enter Username/Display Name" onkeypress="if(event.key==='Enter'){event.preventDefault(); addCordUsernameChip();}">
            <button class="cord-add-circle-btn" title="Add" onclick="addCordUsernameChip()">+</button>
          </div>
          ${cordNewUsernames.length > 0 ? `<div class="cord-chip-row">${cordNewUsernames.map((u, i) => `<span class="cord-username-chip">${cordAvatarHtml(u, u, false, 18)}${u}<button onclick="removeCordUsernameChip(${i})">&times;</button></span>`).join('')}</div>` : ''}
          ${cordNewUsernames.length > 1 ? `<input type="text" id="cord-group-name-input" class="cord-search-input" style="margin-top:8px; width:100%;" placeholder="Group name">` : ''}
          ${cordNewUsernames.length > 0 ? `<button class="btn" style="width:100%; margin-top:10px;" onclick="submitNewCord()">Create Cord</button>` : ''}
          <div id="cord-status-msg" style="font-size:12px; color:var(--text-muted); margin-top:6px;"></div>
        </div>`;

      if (cordPending.length > 0) {
        html += `<div class="cord-section-label">Requests</div>`;
        cordPending.forEach(p => {
          html += `
            <div class="cord-pending-item">
              ${cordAvatarHtml(p.name, p.avatarSeed, p.isGroup, 44)}
              <div class="cord-pending-info">
                <span class="cord-pending-name">${p.name}</span>
                <span class="cord-pending-sub">${p.isGroup ? 'Group invite' : 'Wants to cord with you'}</span>
              </div>
              <span style="display:flex; gap:6px; flex-shrink:0;">
                <button class="cord-pill-btn cord-pill-btn-accept" onclick="respondToCord(${p.id}, true)">Accept</button>
                <button class="cord-pill-btn cord-pill-btn-decline" onclick="respondToCord(${p.id}, false)">Delete</button>
              </span>
            </div>`;
        });
      }

      html += `<div class="cord-section-label">Cords</div>`;
      if (cordList.length === 0) {
        html += `<div style="color:var(--text-muted); font-size:13px; padding:8px 4px;">No cords yet — search a username or display name above to start one.</div>`;
      } else {
        cordList.forEach(c => {
          html += `
            <div class="cord-list-item" onclick="openCordThread(${c.id})">
              ${cordAvatarHtml(c.name, c.avatarSeed, c.isGroup, 48)}
              <div class="cord-list-item-info">
                <span class="cord-list-item-name">${c.name}</span>
                <span class="cord-list-item-sub">${c.isGroup ? 'Group cord' : 'Direct cord'}</span>
              </div>
              <span class="cord-list-item-date">${formatCordDate(c.lastMessageAt)}</span>
            </div>`;
        });
      }

      body.innerHTML = html;
    }

    function renderCordThread(body) {
      const cordInfo = cordList.find(c => c.id === activeCordId);
      const title = cordInfo ? cordInfo.name : 'Cord';
      const headerAvatar = cordInfo ? cordAvatarHtml(cordInfo.name, cordInfo.avatarSeed, cordInfo.isGroup, 34) : cordAvatarHtml('?', activeCordId, false, 34);

      let messagesHtml = cordMessagesCache.map((m, i) => {
        const isMe = m.sender_id === currentUser.id;
        const name = isMe ? 'You' : (cordUsernameCache[m.sender_id] || 'User');
        const time = new Date(m.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

        // IG-style grouping: only the OTHER person gets an avatar (never your own
        // sent bubbles), and only on the last bubble of a consecutive run from
        // them — earlier bubbles in that run get a blank spacer so they still
        // line up under it instead of hugging the edge.
        const next = cordMessagesCache[i + 1];
        const isLastInGroup = !next || next.sender_id !== m.sender_id;
        const otherAvatarHtml = isLastInGroup ? cordAvatarHtml(name, m.sender_id, false, 26) : `<div class="cord-msg-avatar-spacer"></div>`;
        const showNameLabel = !isMe && cordInfo && cordInfo.isGroup && isLastInGroup;

        return `
          <div class="cord-msg-row ${isMe ? 'me' : 'other'}">
            ${isMe ? '' : otherAvatarHtml}
            <div class="cord-thread-bubble ${isMe ? 'me' : 'other'}" style="background:${isMe ? 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)' : 'var(--bg-color)'}; color:${isMe ? '#fff' : 'var(--text-main)'};">
              ${showNameLabel ? `<div class="cord-thread-bubble-meta">${escapeHtml(name)}</div>` : ''}
              <div>${linkifyMessageContent(m.content)}</div>
            </div>
          </div>
          ${isLastInGroup ? `<div class="cord-msg-time ${isMe ? 'me' : 'other'}">${time}</div>` : ''}`;
      }).join('');

      if (!messagesHtml) {
        messagesHtml = `<div style="color:var(--text-muted); font-size:13px; text-align:center; padding:20px;">No messages yet — say hello!</div>`;
      }

      body.innerHTML = `
        <div class="cord-thread-header">
          <button class="cord-thread-back" onclick="backToCordList()" title="Back">&larr;</button>
          ${headerAvatar}
          <span class="cord-thread-title">${title}</span>
        </div>
        <div class="cord-messages-scroll" id="cord-messages-scroll">${messagesHtml}</div>
        <div class="cord-thread-sendbar">
          <input type="text" id="cord-thread-input" class="cord-thread-input-pill" placeholder="Message..." onkeypress="if(event.key==='Enter') sendCordThreadMessage()">
          <button class="cord-send-circle-btn" title="Send" onclick="sendCordThreadMessage()">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
          </button>
        </div>`;

      const scrollEl = document.getElementById('cord-messages-scroll');
      if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
    }

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
    const RECORD_TRIGGER_TYPES = {
      margin_notes_count: { label: 'A subscriber saves a number of Margin Notes' },
      reading_plan_completed: { label: 'A subscriber completes a specific Reading Plan' },
      book_resources_clicked: { label: 'A subscriber clicks every resource in one Book of the Bible' },
      book_group_resources_clicked: { label: 'A subscriber clicks every resource across a group of Books' },
      tw_module_completed: { label: 'A subscriber completes a specific TW Bible Course Module' },
      tw_course_completed: { label: 'A subscriber completes the entire TW Bible Course' }
    };

    let recordBadgesList = [];   // [{ id, key, title, section, group_name, description, icon, tallied, trigger_type, trigger_config }]
    const recordBadgesTable = createTableAccessor('record_badges');
    let userRecordsMap = {};     // record_badge_id -> { count, first_achieved_at, last_achieved_at }

    // How long a fetch is trusted before loadRecordBadges() will hit the network
    // again. Every trigger-check function (margin notes, reading plans, book
    // clicks, TW modules/course) calls loadRecordBadges() independently before
    // checking anything, and badges themselves change rarely (only when an
    // admin edits them in Manage Content) — this cache means a burst of those
    // checks in quick succession share one fetch instead of one each.
    // openRecordsView()'s own call still gets a genuinely fresh fetch whenever
    // more than this long has passed since the last one.
    const RECORD_BADGES_CACHE_MS = 60000;
    let recordBadgesListLoadedAt = 0;

    async function loadRecordBadges() {
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

    async function loadUserRecords() {
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
    function getSeenRecordBadgeIds() {
      if (!currentUser) return [];
      try {
        const raw = localStorage.getItem(`recordsSeenBadges_${currentUser.id}`);
        return raw ? JSON.parse(raw) : [];
      } catch (e) { return []; }
    }

    // Marks every badge currently achieved as "seen", clearing the bubble — called
    // whenever the user actually opens the Records page.
    function markRecordBadgesSeen() {
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
    function updateRecordsNotificationBadge() {
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
    async function awardRecordByBadgeId(badgeId) {
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
    async function awardRecordOnce(badgeId) {
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
    async function checkTWModuleCompletionBadges(moduleKey) {
      await loadRecordBadges();
      const matches = recordBadgesList.filter(b =>
        b.trigger_type === 'tw_module_completed' &&
        b.trigger_config && b.trigger_config.module_key === moduleKey);
      for (const badge of matches) await awardRecordOnce(badge.id);
    }

    async function checkTWCourseCompletionBadges() {
      await loadRecordBadges();
      const matches = recordBadgesList.filter(b => b.trigger_type === 'tw_course_completed');
      for (const badge of matches) await awardRecordOnce(badge.id);
    }

    // --- Trigger #1: reading plan completed --- called from completeCurrentPlan().
    // Returns { matched, awarded, failed } so the caller can tell "no badge configured
    // for this plan" apart from "a badge matched but saving it failed" (e.g. an RLS block).
    async function checkReadingPlanCompletionBadges(scheduleName) {
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
    async function checkMarginNotesCountBadges() {
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
    async function markBookResourceClicked(bookTitle, sessionIndex) {
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

    async function checkBookResourceBadgesAfterClick() {
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

    function renderRecordIconHtml(icon) {
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
    const RECORD_BIBLE_ICON_SHAPES = [
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

    const RECORD_BIBLE_ICON_COLORS = [
      { name: 'Indigo', hex: '#6366f1' },
      { name: 'Teal', hex: '#0d9488' },
      { name: 'Coral', hex: '#e11d48' },
      { name: 'Gold', hex: '#ca8a04' },
      { name: 'Violet', hex: '#7c3aed' }
    ];

    const RECORD_BIBLE_BADGE_ICONS = [];
    RECORD_BIBLE_ICON_SHAPES.forEach(shape => {
      RECORD_BIBLE_ICON_COLORS.forEach(color => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${shape.svg(color.hex)}</svg>`;
        RECORD_BIBLE_BADGE_ICONS.push({
          label: `${shape.name} (${color.name})`,
          dataUri: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg)
        });
      });
    });

    let recordAdminIconPickerPopulated = false;
    function populateRecordAdminIconPicker() {
      if (recordAdminIconPickerPopulated) return;
      const select = document.getElementById('record-admin-icon-picker');
      if (!select) return;
      select.innerHTML = '<option value="">Pick an icon…</option>' +
        RECORD_BIBLE_BADGE_ICONS.map(item => `<option value="${item.dataUri}">${item.label}</option>`).join('');
      recordAdminIconPickerPopulated = true;
    }

    function handleRecordAdminIconPickerChange() {
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
    function updateRecordAdminIconPreview() {
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
    function renderRecordBadgePreviewCard(badge, achieved) {
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
    function updateRecordAdminBadgePreview() {
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
    function describeRecordTrigger(badge) {
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
    function getRecordBadgeSetLabel(triggerType) {
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
    function sortBadgesForSet(badges) {
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

    function getGroupedRecordBadgeSections() {
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
    const RECORD_BADGE_HUE_PALETTE = ['#6366f1', '#0d9488', '#e11d48', '#ca8a04', '#7c3aed'];
    function getRecordBadgeHueColor(badge) {
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
    function getRecordBadgeProgress(badge) {
      if (badge.trigger_type === 'margin_notes_count' && badge.trigger_config && typeof badge.trigger_config.threshold === 'number') {
        const notes = window.userMarginNotes || {};
        const count = Object.values(notes).filter(n => n && n.text && n.text.trim() !== '').length;
        const total = badge.trigger_config.threshold;
        if (total > 0 && count < total) return { current: count, total };
      }
      return null;
    }

    const RECORD_BADGE_CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 L9.5 18 L20 6"></path></svg>';
    const RECORD_BADGE_LOCK_SVG = '<svg class="record-badge-lock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2"></rect><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"></path></svg>';

    function renderRecordBadgeCard(badge) {
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

    function renderRecordBadgesGrid() {
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
    let recordBadgeSectionsCache = [];

    function selectRecordBadge(badgeId) {
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

    function toggleRecordAdminForm() {
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

    function resetRecordAdminForm() {
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

    function populateRecordAdminEditSelect() {
      const select = document.getElementById('record-admin-edit-select');
      select.innerHTML = '<option value="">— New Badge —</option>' +
        recordBadgesList.map(b => `<option value="${b.id}">${(b.title || '').replace(/</g, '&lt;')}</option>`).join('');
    }

    // Datalist of sections already in use, so admins reuse existing section names
    // instead of accidentally creating near-duplicates ("Reading Plans" vs "reading plan").
    function populateRecordAdminSectionList() {
      const list = document.getElementById('record-admin-section-list');
      if (!list) return;
      const uniqueSections = [...new Set(recordBadgesList.map(b => (b.section || '').trim()).filter(Boolean))].sort();
      list.innerHTML = uniqueSections.map(s => `<option value="${s.replace(/"/g, '&quot;')}"></option>`).join('');
    }

    // Same idea for group names, so admins re-use "Margin Notes" instead of
    // spinning up "margin notes" as an accidental second group.
    function populateRecordAdminGroupList() {
      const list = document.getElementById('record-admin-group-list');
      if (!list) return;
      const uniqueGroups = [...new Set(recordBadgesList.map(b => (b.group_name || '').trim()).filter(Boolean))].sort();
      list.innerHTML = uniqueGroups.map(g => `<option value="${g.replace(/"/g, '&quot;')}"></option>`).join('');
    }

    async function handleRecordAdminEditSelectChange() {
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

    async function loadScheduleNamesForBadgeForm() {
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
    function populateRecordAdminTWModuleField() {
      const select = document.getElementById('record-admin-tw-module');
      if (!select) return;
      select.innerHTML = twBibleCourseData.map(mod => `<option value="${mod.id}">${(mod.title || '').replace(/</g, '&lt;')}</option>`).join('');
    }

    function populateRecordAdminBookFields() {
      const bookSelect = document.getElementById('record-admin-book');
      bookSelect.innerHTML = BIBLE_STUDIES_BOOK_ORDER.map(title => `<option value="${title}">${title}</option>`).join('');

      const groupList = document.getElementById('record-admin-book-group-list');
      groupList.innerHTML = BIBLE_STUDIES_BOOK_ORDER.map(title => `
        <label style="display:flex; align-items:center; gap:6px; font-size:13px; padding:3px 0; font-weight:normal;">
          <input type="checkbox" value="${title}" style="width:15px; height:15px; margin:0;"> ${title}
        </label>`).join('');
    }

    async function handleRecordAdminTriggerTypeChange() {
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

    async function saveRecordBadge() {
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

    async function openRecordsView() {
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

    function closeRecordsView() {
      switchTab(lastMainTabId);
    }

    // ============================================================
    // SETTINGS (Cords display name, Dark Mode toggle, Delete Account)
    // ============================================================
    async function openSettingsView() {
      document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
      setHeaderIconSelected('settings-gear-btn');
      const notifPanel = document.getElementById('reading-notification-panel');
      if (notifPanel) notifPanel.style.display = 'none';

      document.getElementById('settings-view').classList.add('active');

      // Dark Mode is a local device preference anyone can use; the Cords name/
      // search settings and account deletion are account-bound, so guests see a
      // sign-in prompt in their place instead of the whole view being gated.
      const guestNotice = document.getElementById('settings-guest-notice');
      const accountSections = document.getElementById('settings-account-sections');
      if (guestNotice) guestNotice.style.display = currentUser ? 'none' : 'block';
      if (accountSections) accountSections.style.display = currentUser ? 'block' : 'none';

      const nameInput = document.getElementById('settings-display-name-input');
      if (nameInput) nameInput.value = (currentUser && currentUser.cordDisplayName) || '';
      const statusEl = document.getElementById('settings-display-name-status');
      if (statusEl) statusEl.style.display = 'none';

      const visibility = (currentUser && currentUser.searchVisibility) || 'unfindable';
      const visibilityRadio = document.querySelector(`input[name="search-visibility"][value="${visibility}"]`);
      if (visibilityRadio) visibilityRadio.checked = true;
      const visibilityStatusEl = document.getElementById('settings-visibility-status');
      if (visibilityStatusEl) visibilityStatusEl.style.display = 'none';

      const darkToggle = document.getElementById('dark-mode-toggle');
      if (darkToggle) darkToggle.checked = isDarkModeEnabled();
      updateThemeLabel();
    }

    function closeSettingsView() {
      switchTab(lastMainTabId);
    }

    // Sets how this user can be found by the Cords "Enter Username/Display Name"
    // search (profiles.search_visibility):
    //   'searchable'    — found by either username or display name
    //   'username_only' — found only by the exact username, not the display name
    //   'unfindable'    — can't be found at all (the default — opt-in to be found)
    async function updateSearchVisibility(value) {
      const statusEl = document.getElementById('settings-visibility-status');
      const previousValue = (currentUser && currentUser.searchVisibility) || 'unfindable';

      const { error } = await profilesTable.update(currentUser.id, { search_visibility: value });
      if (statusEl) statusEl.style.display = 'block';
      if (error) {
        console.error('Error updating search visibility setting:', error.message);
        // Revert the radio selection — the save didn't take.
        const previousRadio = document.querySelector(`input[name="search-visibility"][value="${previousValue}"]`);
        if (previousRadio) previousRadio.checked = true;
        if (statusEl) {
          statusEl.style.color = 'var(--accent-coral)';
          statusEl.innerText = 'Could not save: ' + error.message;
        }
        return;
      }

      currentUser.searchVisibility = value;
      if (statusEl) {
        statusEl.style.color = 'var(--accent-teal)';
        statusEl.innerText = 'Saved!';
      }
    }

    // Saves the user's Cords display name (profiles.display_name) — shown to other
    // users in Cords conversations in place of the account username.
    async function saveCordDisplayName() {
      const input = document.getElementById('settings-display-name-input');
      const statusEl = document.getElementById('settings-display-name-status');
      const name = input.value.trim();

      if (!name) {
        statusEl.style.display = 'block';
        statusEl.style.color = 'var(--accent-coral)';
        statusEl.innerText = 'Please enter a display name.';
        return;
      }

      const { error } = await profilesTable.update(currentUser.id, { display_name: name });
      statusEl.style.display = 'block';
      if (error) {
        statusEl.style.color = 'var(--accent-coral)';
        statusEl.innerText = 'Could not save: ' + error.message;
        console.error('Error saving Cords display name:', error.message);
        return;
      }

      currentUser.cordDisplayName = name;
      cordUsernameCache[currentUser.id] = name;
      const usernameEl = document.getElementById('welcome-msg-username');
      if (usernameEl) usernameEl.innerText = currentUser.cordDisplayName || currentUser.username || currentUser.email;
      statusEl.style.color = 'var(--accent-teal)';
      statusEl.innerText = 'Saved!';
    }

    // --- DARK MODE ---
    // Preference is stored in localStorage (per-browser) and applied as a class on
    // <body>; the CSS variables under body.dark-mode (see stylesheet) do the re-theming.
    function isDarkModeEnabled() {
      return localStorage.getItem('darkModeEnabled') === 'true';
    }

    function applyDarkModePreference() {
      document.body.classList.toggle('dark-mode', isDarkModeEnabled());
      updateThemeLabel();
    }

    function updateThemeLabel() {
      const label = document.getElementById('settings-theme-label');
      if (label) label.innerText = isDarkModeEnabled() ? 'Dark Mode' : 'Light Mode';
    }

    function toggleDarkMode() {
      const toggle = document.getElementById('dark-mode-toggle');
      localStorage.setItem('darkModeEnabled', toggle.checked ? 'true' : 'false');
      applyDarkModePreference();
    }

    // --- DELETE ACCOUNT ---
    function confirmDeleteAccount() {
      document.getElementById('delete-account-modal').style.display = 'flex';
    }

    function closeDeleteAccountModal() {
      document.getElementById('delete-account-modal').style.display = 'none';
    }

    // Permanently removes this user's information from every table that stores
    // per-user data, then signs them out. (Fully erasing the login credential
    // itself — the auth.users row — needs a service-role key, which isn't
    // available to this client-side anon key; that step is attempted via an
    // optional RPC below and simply no-ops if it hasn't been set up server-side.
    // Every table this app writes user data to is cleared either way.)
    async function performAccountDeletion() {
      const btn = document.getElementById('confirm-delete-account-btn');
      btn.disabled = true;
      btn.innerText = 'Deleting...';
      const userId = currentUser.id;

      try {
        await marginNotesTable.removeWhere('user_id', userId);
        await recordsTable.removeWhere('user_id', userId);
        await userReadingPlansTable.removeWhere('user_id', userId);
        await userReadingProgressTable.removeWhere('user_id', userId);
        await userResourceClicksTable.removeWhere('user_id', userId);
        await cordMessagesTable.removeWhere('sender_id', userId);
        await cordMembersTable.removeWhere('user_id', userId);
        await profilesTable.remove(userId);

        // Best-effort: fully delete the auth account too, if a
        // "delete_user_account" Postgres function (SECURITY DEFINER, service role)
        // has been set up on the backend. Safe to leave unimplemented — this just
        // won't do anything until it exists.
        try { await supabaseClient.rpc('delete_user_account'); } catch (e) { /* optional */ }

        await supabaseClient.auth.signOut();
        resetCordStateForLogout();
        closeDeleteAccountModal();
        currentUser = null;
        updateAuthHeaderUI();
        alert('Your account and all associated data have been deleted.');
        switchTab('bible'); // back to guest browsing rather than any now-stale account view
      } catch (e) {
        console.error('Error deleting account:', e.message);
        alert('Something went wrong while deleting your account: ' + e.message);
        btn.disabled = false;
        btn.innerText = 'Delete';
      }
    }


    // ============================================================
    // BOOKS OF THE BIBLE BOOKSHELF (Study tab sub-option)
    // Everything a book needs — spine color, height, live/offline
    // status, presenter(s), and session content — lives in
    // BIBLE_STUDIES_DATA below. This is edited directly in this file;
    // there is no in-app admin control for it, by design. Add or
    // update an entry, set `live: true`, and it becomes selectable
    // on the shelf. Books left out of this object (or left `live:
    // false`) stay on the shelf but are dimmed and can't be opened.
    //
    // Each entry in a book's `sessions` array is one piece of content —
    // an audio session, a video, or now an article — and can have:
    //   title:     shown above the content (required)
    //   audio:     mp3 (etc.) URL — renders the audio player
    //   video:     YouTube URL — renders an embedded player
    //   article:   URL to an article/write-up, or a study guide — renders a
    //              "Read Article" (or "Read Study Guide") link
    //   type:      'audio' | 'video' | 'print' | 'study_guide' — only needed
    //              if a session has more than one of the fields above and you
    //              want to force which one it's treated as. 'study_guide' is
    //              its own type (so it shows "Read Study Guide" and the admin
    //              form remembers the distinction) but still counts under the
    //              reader-facing "Print" filter, same as 'print'.
    //   presenter: { name, photo } — overrides the book's presenter for just
    //              this session; only needed on books with more than one
    //              presenter (see `presenters` below)
    //
    // A book can name its presenter either of two ways:
    //   presenter:  { name, photo }   — one presenter for the whole book
    //   presenters: [{ name, photo }, ...] — more than one; give each session
    //               a matching `presenter` so clicking a presenter's photo
    //               filters the list to just their content
    // ============================================================
    const BIBLE_STUDIES_BOOK_ORDER = [
      'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth',
      '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah',
      'Esther', 'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah',
      'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum',
      'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
      'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians', 'Galatians',
      'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy',
      '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James', '1 Peter', '2 Peter', '1 John', '2 John',
      '3 John', 'Jude', 'Revelation'
    ];

    // Old Testament is Genesis..Malachi, the first 39 entries above; everything
    // from Matthew on is New Testament. Used to split the shelf's color-code
    // legend into its two testament halves.
    const OT_BOOK_COUNT = BIBLE_STUDIES_BOOK_ORDER.indexOf('Matthew');

    // Sample/demo entries only — replace photo/audio URLs with real ones, add more
    // books, and flip `live` to true as each book's study is actually completed.
    const BIBLE_STUDIES_DATA = {
      'Genesis': {
        color: '#6366f1',
        height: 215,
        live: false,
        presenter: { name: 'Dr. Ray', photo: 'https://placehold.co/120x120?text=Presenter' },
        sessions: [
          { title: 'Session 1: In the Beginning', audio: '' },
          { title: 'Session 2: The Fall', audio: '' },
          { title: 'Session 3: Noah & the Flood', audio: '' },
          { title: 'Article: An Overview of Genesis', article: '' }
        ]
      },
      'Joshua': {
        color: '#6366f1',
        height: 215,
        live: true,
        presenter: { name: 'Mr. John Ogwyn', photo: 'https://members.lcg.org/sites/default/files/styles/thumbnail/public/contributor/john-ogwyn-profile.jpg?itok=DS3hJf9G' },
        sessions: [
          { title: 'Survey: Joshua Chapters 1-3', audio: 'https://media.lcg.org/biblestudy/jho0101.mp3' },
          { title: 'Survey: Joshua Chapters 4-6', audio: 'https://media.lcg.org/biblestudy/jho0102.mp3' },
          { title: 'Survey: Joshua Chapters 7-12', audio: 'https://media.lcg.org/biblestudy/jho0103.mp3' },
          { title: 'Survey: Joshua Chapters 13-24', audio: 'https://media.lcg.org/biblestudy/jho0104.mp3' }
        ]
      },
      'Judges': {
        color: '#6366f1',
        height: 215,
        live: true,
        presenter: { name: 'Mr. John Ogwyn', photo: 'https://members.lcg.org/sites/default/files/styles/thumbnail/public/contributor/john-ogwyn-profile.jpg?itok=DS3hJf9G' },
        sessions: [
          { title: 'Survey: Judges Chapters 1-5', audio: 'https://media.lcg.org/biblestudy/jho0105.mp3' },
          { title: 'Survey: Judges Chapters 6-10', audio: 'https://media.lcg.org/biblestudy/jho0106.mp3' },
          { title: 'Survey: Judges Chapters 11-16', audio: 'https://media.lcg.org/biblestudy/jho0107.mp3' },
          { title: 'Survey: Judges Chapters 17-21', audio: 'https://media.lcg.org/biblestudy/jho0108.mp3' }
        ]
      },

        'Ruth': {
        color: '#6366f1',
        height: 215,
        live: true,
        presenters: [
          { name: 'Mr. Ken Frank', photo: 'https://members.lcg.org/sites/default/files/styles/thumbnail/public/contributor/ken-frank-profile.jpg?itok=batgwcSM' },
          { name: 'Mr. Peter Nathan', photo: 'https://members.lcg.org/sites/default/files/styles/thumbnail/public/contributor/peter-nathan-profile.jpg?itok=IGZRy-uc' }
        ],
        sessions: [
          { title: 'Relationship Lessons from the Book of Ruth', audio: 'https://cav1.lcg.org/media/sermons/dve882.mp3', presenter: { name: 'Mr. Ken Frank', photo: 'https://members.lcg.org/sites/default/files/styles/thumbnail/public/contributor/ken-frank-profile.jpg?itok=batgwcSM' } },
          { title: 'Lessons for Pentecost from Ruth', audio: 'https://cav1.lcg.org/media/sermons/dve1174.mp3', presenter: { name: 'Mr. Peter Nathan', photo: 'https://members.lcg.org/sites/default/files/styles/thumbnail/public/contributor/peter-nathan-profile.jpg?itok=IGZRy-uc' } }
        ]
      },

        '1 Samuel': {
        color: '#6366f1',
        height: 195,
        live: true,
        presenter: { name: 'Mr. Ken Frank', photo: 'https://members.lcg.org/sites/default/files/styles/thumbnail/public/contributor/ken-frank-profile.jpg?itok=batgwcSM' },
        sessions: [
          { title: 'Petition Granted (Hannah)', audio: 'https://cav1.lcg.org/media/sermons/dve1064.mp3' }
        ]
      },

        '1 Kings': {
        color: '#6366f1',
        height: 195,
        live: true,
        presenter: { name: 'Mr. Ken Frank', photo: 'https://members.lcg.org/sites/default/files/styles/thumbnail/public/contributor/ken-frank-profile.jpg?itok=batgwcSM' },
        sessions: [
          { title: 'The Rise and Fall of King Asa (King Asa)', audio: 'https://cav1.lcg.org/media/sermons/dve1383.mp3' },
          { title: 'Jehoshaphat\'s Bible Education Program (King Jehoshaphat)', audio: 'https://cav1.lcg.org/media/sermons/dve1259.mp3' }
        ]
      },

        '2 Kings': {
        color: '#6366f1',
        height: 195,
        live: true,
        presenter: { name: 'Mr. Ken Frank', photo: 'https://members.lcg.org/sites/default/files/styles/thumbnail/public/contributor/ken-frank-profile.jpg?itok=batgwcSM' },
        sessions: [
          { title: 'The Prodigal King (King Manasseh)', audio: 'https://cav1.lcg.org/media/sermons/dve1146.mp3' },
          { title: 'The Young Reformer (King Josiah)', audio: 'https://cav1.lcg.org/media/sermons/dve935.mp3' }
        ]
      },

        '2 Chronicles': {
        color: '#6366f1',
        height: 195,
        live: true,
        presenter: { name: 'Mr. Ken Frank', photo: 'https://members.lcg.org/sites/default/files/styles/thumbnail/public/contributor/ken-frank-profile.jpg?itok=batgwcSM' },
        sessions: [
          { title: 'The Prodigal King (King Manasseh)', audio: 'https://cav1.lcg.org/media/sermons/dve1146.mp3' }
        ]
      },

        'Esther': {
        color: '#6366f1',
        height: 195,
        live: true,
        presenter: { name: 'Mr. Peter Nathan', photo: 'https://members.lcg.org/sites/default/files/styles/thumbnail/public/contributor/peter-nathan-profile.jpg?itok=IGZRy-uc' },
        sessions: [
          { title: 'Esther: Lessons for Passover', audio: 'https://cav1.lcg.org/media/sermons/dve1036.mp3' }
        ]
      },

        'Job': {
        color: '#6366f1',
        height: 195,
        live: true,
        presenters: [
          { name: 'Mr. Wallace Smith', photo: 'https://members.lcg.org/sites/default/files/styles/thumbnail/public/contributor/wallace-smith-profile2a.jpg?itok=eAQwQl-V' },
          { name: 'Mr. John Ogwyn', photo: 'https://members.lcg.org/sites/default/files/styles/thumbnail/public/contributor/john-ogwyn-profile.jpg?itok=DS3hJf9G' }
        ],
        sessions: [
          { title: 'Insights From Job', audio: 'https://cav1.lcg.org/media/sermons/dve976.mp3', presenter: { name: 'Mr. Wallace Smith', photo: 'https://members.lcg.org/sites/default/files/styles/thumbnail/public/contributor/wallace-smith-profile2a.jpg?itok=eAQwQl-V' } },
          { title: 'Study Topic: Seven lessons from the book of Job', article: 'https://members.lcg.org/bible-studies/study-topic-seven-lessons-book-job', presenter: { name: 'Mr. John Ogwyn', photo: 'https://members.lcg.org/sites/default/files/styles/thumbnail/public/contributor/john-ogwyn-profile.jpg?itok=DS3hJf9G' } }
        ]
      },

        'Jeremiah': {
        color: '#6366f1',
        height: 195,
        live: true,
        presenters: [
          { name: 'Mr. Gerald Weston', photo: 'https://members.lcg.org/sites/default/files/styles/thumbnail/public/contributor/gweston_default_crop.jpg?itok=fTZGt0yr' },
          { name: 'Mr. Rod McNair', photo: 'https://members.lcg.org/sites/default/files/styles/thumbnail/public/contributor/rod-mcnair-profile.jpg?itok=rJK2HIDk' }
        ],
        sessions: [
          { title: 'Jeremiah and His Commission', audio: 'https://cav1.lcg.org/media/sermons/dve1109.mp3', presenter: { name: 'Mr. Gerald Weston', photo: 'https://members.lcg.org/sites/default/files/styles/thumbnail/public/contributor/gweston_default_crop.jpg?itok=fTZGt0yr' } },
          { title: 'End-Time Lessons of Jeremiah', audio: 'https://cav1.lcg.org/media/sermons/dve521.mp3', presenter: { name: 'Mr. Rod McNair', photo: 'https://members.lcg.org/sites/default/files/styles/thumbnail/public/contributor/rod-mcnair-profile.jpg?itok=rJK2HIDk' } }
        ]
      },

        'Lamentations': {
        color: '#6366f1',
        height: 195,
        live: true,
        presenter: { name: 'Mr. Peter Nathan', photo: 'https://members.lcg.org/sites/default/files/styles/thumbnail/public/contributor/peter-nathan-profile.jpg?itok=IGZRy-uc' },
        sessions: [
          { title: 'Lamentations and Laodicea', audio: 'https://cav1.lcg.org/media/sermons/dve833.mp3' }
        ]
      },

        'Psalms': {
        color: '#6366f1',
        height: 195,
        live: true,
        presenter: { name: 'Mr. Ken Frank', photo: 'https://members.lcg.org/sites/default/files/styles/thumbnail/public/contributor/ken-frank-profile.jpg?itok=batgwcSM' },
        sessions: [
          { title: 'Psalm 16: A Psalm of Trust', audio: 'https://cav1.lcg.org/media/sermons/dve1284.mp3' }
        ]
      },

      'Matthew': {
        color: '#a855f7',
        height: 195,
        live: true,
        presenter: { name: 'Dr. Roderick Meredith', photo: 'https://members.lcg.org/sites/default/files/styles/thumbnail/public/contributor/rcm_memorial_crop.jpg?itok=tcYtFfVX' },
        sessions: [
          { title: 'Matthew 1:1-3:17', audio: 'https://media.lcg.org/biblestudy/rcm0101.mp3' },
          { title: 'Matthew 4:1-5:16', audio: 'https://media.lcg.org/biblestudy/rcm0102.mp3' },
          { title: 'Matthew 5:16-5:35', audio: 'https://media.lcg.org/biblestudy/rcm0103.mp3' },
          { title: 'Matthew 5:35-6:4', audio: 'https://media.lcg.org/biblestudy/rcm0104.mp3' },
          { title: 'Matthew 6:5-6:18', audio: 'https://media.lcg.org/biblestudy/rcm0105.mp3' },
          { title: 'Matthew 6:19-6:34', audio: 'https://media.lcg.org/biblestudy/rcm0106.mp3' },
          { title: 'Matthew 7:1-7:12', audio: 'https://media.lcg.org/biblestudy/rcm0107.mp3' },
          { title: 'Matthew 7:13-7:28', audio: 'https://media.lcg.org/biblestudy/rcm0108.mp3' },
          { title: 'Matthew 8:1-9:13', audio: 'https://media.lcg.org/biblestudy/rcm0109.mp3' },
          { title: 'Matthew 9:14-10:18', audio: 'https://media.lcg.org/biblestudy/rcm0110.mp3' },
          { title: 'Matthew 10:18-10:42', audio: 'https://media.lcg.org/biblestudy/rcm0111.mp3' },
          { title: 'Matthew 11:1-11:30', audio: 'https://media.lcg.org/biblestudy/rcm0112.mp3' },
          { title: 'Matthew 12:1-12:37', audio: 'https://media.lcg.org/biblestudy/rcm0113.mp3' },
          { title: 'Matthew 12:38-13:17', audio: 'https://media.lcg.org/biblestudy/rcm0114.mp3' },
          { title: 'Matthew 13:13-13:46', audio: 'https://media.lcg.org/biblestudy/rcm0115.mp3' },
          { title: 'Matthew 13:47-14:36', audio: 'https://media.lcg.org/biblestudy/rcm0116.mp3' },
          { title: 'Matthew 15:1-15:39', audio: 'https://media.lcg.org/biblestudy/rcm0117.mp3' },
          { title: 'Matthew 16:1-16:28', audio: 'https://media.lcg.org/biblestudy/rcm0118.mp3' },
          { title: 'Matthew 17:1-17:27', audio: 'https://media.lcg.org/biblestudy/rcm0119.mp3' },
          { title: 'Matthew 18:1-18:35', audio: 'https://media.lcg.org/biblestudy/rcm0120.mp3' },
          { title: 'Matthew 19:1-19:25', audio: 'https://media.lcg.org/biblestudy/rcm0121.mp3' },
          { title: 'Matthew 19:25-20:34', audio: 'https://media.lcg.org/biblestudy/rcm0122.mp3' },
          { title: 'Matthew 21:1-21:46', audio: 'https://media.lcg.org/biblestudy/rcm0123.mp3' },
          { title: 'Matthew 22:1-22:46', audio: 'https://media.lcg.org/biblestudy/rcm0124.mp3' },
          { title: 'Matthew 23:1-23:39', audio: 'https://media.lcg.org/biblestudy/rcm0125.mp3' },
          { title: 'Matthew 24:1-24:22', audio: 'https://media.lcg.org/biblestudy/rcm0126.mp3' },
          { title: 'Matthew 24:3-24:51', audio: 'https://media.lcg.org/biblestudy/rcm0127.mp3' },
          { title: 'Matthew 25:1-25:46', audio: 'https://media.lcg.org/biblestudy/rcm0128.mp3' },
          { title: 'Matthew 26:1-26:75', audio: 'https://media.lcg.org/biblestudy/rcm0129.mp3' },
          { title: 'Matthew 27:1-27:66', audio: 'https://media.lcg.org/biblestudy/rcm0130.mp3' },
          { title: 'Matthew 28:1-28:20', audio: 'https://media.lcg.org/biblestudy/rcm0131.mp3' },
          { title: 'Matthew Capstone', audio: 'https://media.lcg.org/biblestudy/rcm0131.mp3' }
        ]
      },
      'Galatians': {
        color: '#a855f7',
        height: 195,
        live: true,
        presenter: { name: 'Dr. Roderick Meredith', photo: 'https://members.lcg.org/sites/default/files/styles/thumbnail/public/contributor/rcm_memorial_crop.jpg?itok=tcYtFfVX' },
        sessions: [
          { title: 'Galatians Part 1', audio: 'https://cav1.lcg.org/media/sermons/dve569.mp3' },
          { title: 'Galatians Part 2', audio: 'https://cav1.lcg.org/media/sermons/dve571.mp3' }
        ]
      },

      'Philippians': {
        color: '#a855f7',
        height: 215,
        live: true,
        presenter: { name: 'Dr. Jeffery Fall', photo: 'https://members.lcg.org/sites/default/files/styles/thumbnail/public/contributor/jeff-fall-profile-v2.jpg?itok=flJB0oh_' },
        sessions: [
          { title: 'Philippians Chapter 1', audio: 'https://media.lcg.org/biblestudy/jf0101.mp3' },
          { title: 'Philippians Chapter 2', audio: 'https://media.lcg.org/biblestudy/jf0102.mp3' },
          { title: 'Philippians Chapter 3', audio: 'https://media.lcg.org/biblestudy/jf0103.mp3' },
          { title: 'Philippians Chapter 4', audio: 'https://media.lcg.org/biblestudy/jf0104.mp3' }
        ]
      },

      'Colossians': {
        color: '#a855f7',
        height: 195,
        live: true,
        presenter: { name: 'Dr. Roderick Meredith', photo: 'https://members.lcg.org/sites/default/files/styles/thumbnail/public/contributor/rcm_memorial_crop.jpg?itok=tcYtFfVX' },
        sessions: [
          { title: 'The Book of Colossians', audio: 'https://cav1.lcg.org/media/sermons/dve773.mp3' }
        ]
      },

      '1 Timothy': {
        color: '#a855f7',
        height: 195,
        live: true,
        presenter: { name: 'Mr. Ken Frank', photo: 'https://members.lcg.org/sites/default/files/styles/thumbnail/public/contributor/ken-frank-profile.jpg?itok=batgwcSM' },
        sessions: [
          { title: 'How Paul Mentored Timothy', audio: 'https://cav1.lcg.org/media/sermons/dve1577.mp3' }
        ]
      },


      'Philemon': {
        color: '#a855f7',
        height: 180,
        live: true,
        presenter: { name: 'Mr. Ken Frank', photo: 'https://members.lcg.org/sites/default/files/styles/thumbnail/public/contributor/ken-frank-profile.jpg?itok=batgwcSM' },
        sessions: [
          { title: 'Paul\'s Promissory Postcard', audio: 'https://cav1.lcg.org/media/sermons/dve1003.mp3' }
        ]
      },

      'James': {
        color: '#a855f7',
        height: 195,
        live: true,
        presenter: { name: 'Mr. John Ogwyn', photo: 'https://members.lcg.org/sites/default/files/styles/thumbnail/public/contributor/john-ogwyn-profile.jpg?itok=DS3hJf9G' },
        sessions: [
          { title: 'James, the Brother of Jesus', audio: 'http://tv1.tomorrowsworld.org/media/telecast/t0177.mp3' }
        ]
      },

      '1 Peter': {
        color: '#a855f7',
        height: 195,
        live: true,
        presenter: { name: 'Dr. Douglas Winnail', photo: 'https://members.lcg.org/sites/default/files/styles/thumbnail/public/contributor/douglas-winnail-profile.jpg?itok=5UnNayvU' },
        sessions: [
          { title: '1 Peter Chapter 1', audio: 'http://media.lcg.org/biblestudy/dsw0101.mp3' },
          { title: '1 Peter Chapter 2', audio: 'http://media.lcg.org/biblestudy/dsw0102.mp3' },
          { title: '1 Peter Chapter 3', audio: 'http://media.lcg.org/biblestudy/dsw0103.mp3' },
          { title: '1 Peter Chapter 4', audio: 'http://media.lcg.org/biblestudy/dsw0104.mp3' }
        ]
      },
      '2 Peter': {
        color: '#a855f7',
        height: 195,
        live: true,
        presenter: { name: 'Dr. Douglas Winnail', photo: 'https://members.lcg.org/sites/default/files/styles/thumbnail/public/contributor/douglas-winnail-profile.jpg?itok=5UnNayvU' },
        sessions: [
          { title: '2 Peter Chapter 1', audio: 'https://media.lcg.org/biblestudy/dsw0105.mp3' },
          { title: '2 Peter Chapter 2', audio: 'http://media.lcg.org/biblestudy/dsw0106.mp3' },
          { title: '2 Peter Chapter 3', audio: 'http://media.lcg.org/biblestudy/dsw0107.mp3' }
        ]
      },

      '1 John': {
        color: '#a855f7',
        height: 195,
        live: true,
        presenter: { name: 'Dr. Roderick Meredith', photo: 'https://members.lcg.org/sites/default/files/styles/thumbnail/public/contributor/rcm_memorial_crop.jpg?itok=tcYtFfVX' },
        sessions: [
          { title: '1 John Part 1', audio: 'https://cav1.lcg.org/media/sermons/dve247.mp3' },
          { title: '1 John Part 2', audio: 'https://cav1.lcg.org/media/sermons/dve252.mp3' }
        ]
      }
    };

    // Fallback color/height cycles for any book not given an explicit entry above,
    // so the full 66-book shelf always renders with a varied, "real shelf" look.
    const BIBLE_STUDIES_DEFAULT_COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#4f46e5', '#7c3aed', '#9333ea'];
    const BIBLE_STUDIES_DEFAULT_HEIGHTS = [
      150, 175, 200, 160, 190, 210, 145, 180, 200, 165, 155, 195, 205, 170, 185, 160,
      175, 150, 220, 190, 160, 175, 200, 155, 180, 205, 170, 150, 190, 165, 200, 175,
      155, 185, 160, 195, 170, 150, 180, 200, 160, 190, 210, 175, 155, 185, 165, 200,
      170, 150, 195, 180, 160, 205, 175, 150, 190, 165, 200, 155, 180, 170, 195, 160, 150, 185
    ];

    // Works out what thumbnail (if any) a Church Resource card should show as its
    // background, in priority order: an admin's own custom thumbnail always wins;
    // otherwise a YouTube link gets YouTube's own thumbnail; otherwise a link that
    // is itself an image file gets used directly; anything else falls back to no
    // thumbnail (the plain card). An admin can turn a resource's thumbnail off
    // entirely regardless of what it would otherwise resolve to.
    function resolveChurchResourceThumbnail(r) {
      if (!r || r.thumbnailHidden) return null;
      if (r.thumbnail) return r.thumbnail;
      const youTubeThumb = getYouTubeThumbnailUrl(r.resource);
      if (youTubeThumb) return youTubeThumb;
      if (isDirectImageUrl(r.resource)) return r.resource;
      return null;
    }

    // A resource's tags are a free-text, comma-separated string (e.g. "faith, hope,
    // Booklet") — this checks for an exact "Booklet" tag among them, case-insensitive
    // and whitespace-trimmed, so "Booklets" or a stray "booklet" inside some other
    // tag doesn't false-positive.
    function hasBookletTag(tags) {
      if (!tags) return false;
      return tags.split(',').some(t => t.trim().toLowerCase() === 'booklet');
    }

    // True only when the thumbnail actually being shown for this resource is its
    // own admin-set custom thumbnail (as opposed to one auto-derived from a YouTube
    // link or a direct-image URL) — see resolveChurchResourceThumbnail's priority
    // order. thumbUrl is passed in rather than re-resolved so callers that already
    // computed it (every caller) don't do the resolution work twice.
    function isCustomThumbnailShown(r, thumbUrl) {
      return !!thumbUrl && thumbUrl === r.thumbnail;
    }

    // Matches a Church Resource "Reference" field's ENTIRE value against a single
    // "Book Chapter:Verse" (optionally "-Verse" for a range, e.g. "John 3:16-18")
    // reference — anchored start-to-end since this validates a dedicated field's
    // whole content, unlike FOUNDATIONS_SCRIPTURE_REGEX above, which hunts for
    // references embedded anywhere inside free-form text. Only full, exact book
    // names are recognized (same as that regex) — "Genesis 1:1" matches,
    // "Gen 1:1" does not.
    const CHURCH_RESOURCE_REFERENCE_REGEX = (() => {
      const names = BIBLE_STUDIES_BOOK_ORDER
        .slice()
        .sort((a, b) => b.length - a.length)
        .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      return new RegExp(`^(${names.join('|')})\\s+(\\d{1,3}):(\\d{1,3})(?:\\s*[-–]\\s*\\d{1,3})?$`, 'i');
    })();

    // Resolves a typed Church Resource "Reference" field to the FIRST verse it
    // names (a typed range like "John 3:16-18" resolves to just John 3:16), and
    // only if that verse actually exists in the loaded Bible — a plausible-looking
    // but out-of-range chapter/verse (e.g. a chapter that doesn't have 99 verses)
    // is rejected same as text that doesn't look like a reference at all. Returns
    // the matching verse object (with its .rowIndex) on success, or null.
    function resolveChurchResourceReferenceInput(text) {
      const trimmed = (text || '').trim().replace(/\s+/g, ' ');
      if (!trimmed) return null;
      const match = CHURCH_RESOURCE_REFERENCE_REGEX.exec(trimmed);
      if (!match) return null;
      const canonicalBook = BIBLE_STUDIES_BOOK_ORDER.find(b => b.toLowerCase() === match[1].toLowerCase());
      if (!canonicalBook) return null;
      const targetRef = `${canonicalBook} ${match[2]}:${match[3]}`;
      if (!currentBibleVerses || currentBibleVerses.length === 0) return null;
      return currentBibleVerses.find(v => v.reference === targetRef) || null;
    }

    // A Reference field can name more than one scripture at once, comma-separated
    // (e.g. "Genesis 1:1, John 3:16"), so a single resource can be tied to multiple
    // verses — each comma-separated piece is resolved on its own the same way a
    // single reference is (including "only the first verse of a range" for any
    // piece that's itself a range). Mirrors resolveChurchResourceReferenceInput's
    // "no match blocks with an error" rule: if ANY piece fails to resolve, the
    // whole field is rejected (verses: null) and every unrecognized piece is
    // listed, rather than silently saving a partial set. Exact duplicate verses
    // (naming the same one twice) are folded down to one. An empty field also
    // returns verses: null, same as an invalid one — callers already require at
    // least one reference.
    function resolveChurchResourceReferenceList(text) {
      const parts = (text || '').split(',').map(s => s.trim()).filter(Boolean);
      if (parts.length === 0) return { verses: null, invalid: [] };
      const verses = [];
      const invalid = [];
      const seenRowIndexes = new Set();
      parts.forEach(part => {
        const v = resolveChurchResourceReferenceInput(part);
        if (!v) { invalid.push(part); return; }
        if (!seenRowIndexes.has(v.rowIndex)) {
          seenRowIndexes.add(v.rowIndex);
          verses.push(v);
        }
      });
      if (invalid.length > 0) return { verses: null, invalid };
      return { verses, invalid: [] };
    }

    // Entry points — look the video list up fresh at click time (rather than
    // serializing it into the onclick attribute) so it always reflects
    // whatever's currently saved, the same pattern used elsewhere in the app
    // (e.g. shareFoundationsSession).

    // Lets a Church Resources card (Note view) whose link is a YouTube video play
    // through the same full-screen player used for every other video in the app,
    // instead of just opening a new browser tab — same shared player, just handed
    // a one-video "playlist" like openBookVideoPlayer does above.
    function openChurchResourceVideo(url, title, verseRef) {
      if (!url) return;
      openFsvPlayer([{ label: title || 'Video', url: url }], 0, verseRef || '');
    }



function togglePlay(i) {
  const audio = document.getElementById(`audio-player-${i}`);
  const btn = document.getElementById(`play-btn-${i}`);
  if (audio.paused) {
    audio.play();
    btn.textContent = '❚❚';
  } else {
    audio.pause();
    btn.textContent = '▶';
  }
}

function resetPlayButton(i) {
  const btn = document.getElementById(`play-btn-${i}`);
  if (btn) btn.textContent = '▶';
}

function skipAudio(elementId, seconds) {
  const audio = document.getElementById(elementId);
  if (audio) {
    audio.currentTime = Math.min(Math.max(audio.currentTime + seconds, 0), audio.duration);
  }
}

function updateProgress(i) {
  const audio = document.getElementById(`audio-player-${i}`);
  const progress = document.getElementById(`progress-${i}`);
  const timeDisplay = document.getElementById(`time-${i}`);
  if (audio && audio.duration) {
    progress.value = (audio.currentTime / audio.duration) * 100;
    timeDisplay.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
  }
}

function seekAudio(i, value) {
  const audio = document.getElementById(`audio-player-${i}`);
  if (audio && audio.duration) {
    audio.currentTime = (value / 100) * audio.duration;
  }
}

function initAudio(i) {
  const audio = document.getElementById(`audio-player-${i}`);
  const timeDisplay = document.getElementById(`time-${i}`);
  if (audio && audio.duration) {
    timeDisplay.textContent = `0:00 / ${formatTime(audio.duration)}`;
  }
}

function formatTime(seconds) {
  if (isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}


// ----------------------------------------------------------------------------
// Every name below is called directly from an inline onclick/oninput/etc.
// attribute somewhere in the HTML, which resolves through the *global* scope
// at click time -- so each one needs to escape this module's otherwise-private
// scope. See build.js, which flattens these onto `window` after bundling.
// ----------------------------------------------------------------------------
export {
  applyMarginNoteColor,
  closeFsvPlayer,
  ensureLoggedInFor,
  loadChapterByReference,
  openBookVideoPlayer,
  renderSearchResults,
  toggleFsvMiniMode,
  toggleFsvPlaylist,
  addBookAdminPresenterRow,
  addBookAdminSessionRow,
  addChurchResource,
  addCordUsernameChip,
  addFoundationsAdminAudioRow,
  addFoundationsAdminResourceRow,
  addFoundationsAdminSessionQuiz,
  addFoundationsAdminSessionRow,
  addFoundationsAdminVideoRow,
  addLineUponLineResource,
  addTWCourseAdminAudioRow,
  addTWCourseAdminLessonQuiz,
  addTWCourseAdminLessonRow,
  addTWCourseAdminResourceRow,
  addTWCourseAdminVideoRow,
  advanceFoundationsInlineKnowledgeCheck,
  answerFoundationsInlineKnowledgeCheck,
  answerFsvKnowledgeCheck,
  answerTWInlineKnowledgeCheck,
  applyFoundationsFormat,
  applyTWCourseAdminFormat,
  autoSaveUserNote,
  backToCordList,
  cancelEditChurchResource,
  cancelLineUponLineAddForm,
  changeCalendarMonth,
  changePlanViewDay,
  clearFoundationsFilters,
  clearStudyPresenterFilter,
  closeBookAdminView,
  closeDeleteAccountModal,
  closeFoundationsAdminView,
  closeFoundationsItem,
  closeLoginModal,
  closeShareSheet,
  closeTWCourseAdminView,
  closeTWCourseCompletionModal,
  closeTWModule,
  confirmDeleteAccount,
  confirmRestartPlan,
  continueAfterFsvKnowledgeCheck,
  deleteBookAdminContent,
  deleteBookAdminShelfGroup,
  deleteFoundationsAdminItem,
  deleteResourceFromTab,
  deleteTWCourseAdminModule,
  duplicateTWCourseAdminLessonRow,
  focusFoundationsSearch,
  focusMarginNote,
  fsvBackTrack,
  fsvForwardTrack,
  fsvJumpTo,
  fsvSkip,
  fsvStartFromFallback,
  fsvStop,
  fsvTogglePlayPause,
  goToPlanNotificationTarget,
  handleAuth,
  handleBookAdminPresenterPick,
  handleBookAdminSelectChange,
  handleBookAdminShelfGroupChange,
  handleBookSelectChange,
  handleBookSpineClick,
  handleChapterSelectChange,
  handleDailyCheckboxChange,
  handleFoundationsAdminPresenterPick,
  handleFoundationsAdminSelectChange,
  handleFoundationsContentPaste,
  handleFoundationsSessionDragEnd,
  handleFoundationsSessionDragLeave,
  handleFoundationsSessionDragOver,
  handleFoundationsSessionDragStart,
  handleFoundationsSessionDrop,
  handleFoundationsSessionPresenterPick,
  handleFoundationsTableUpload,
  handleFsvTap,
  handleRecordAdminEditSelectChange,
  handleRecordAdminIconPickerChange,
  handleRecordAdminTriggerTypeChange,
  handleSessionAdminPresenterPick,
  handleSessionDragEnd,
  handleSessionDragLeave,
  handleSessionDragOver,
  handleSessionDragStart,
  handleSessionDrop,
  handleStartOrRestartPlan,
  handleTWCourseAdminContentPaste,
  handleTWCourseAdminLessonDragEnd,
  handleTWCourseAdminLessonDragLeave,
  handleTWCourseAdminLessonDragOver,
  handleTWCourseAdminLessonDragStart,
  handleTWCourseAdminLessonDrop,
  handleTWCourseAdminSelectChange,
  handleTWCourseAdminTableUpload,
  handleTWCourseAdminThumbnailUpload,
  handleTranslationChange,
  importHardcodedBooksToDB,
  importHardcodedTWCourseToDB,
  initAudio,
  jumpToPlanDay,
  loadReadingSchedule,
  logout,
  markBookResourceClicked,
  navigateChapter,
  navigateToVerseReference,
  openBookAdminView,
  openChurchResourceVideo,
  openCordThread,
  openCordView,
  openFoundationsAdminView,
  openFoundationsItem,
  openFoundationsVideoPlayer,
  openLoginModal,
  openRecordsView,
  openSettingsView,
  openTWCourseAdminView,
  openTWLessonVideo,
  openTWModule,
  performAccountDeletion,
  printMyMargins,
  processBibleSearch,
  removeBookAdminPresenterRow,
  removeBookAdminSessionRow,
  removeChurchResourceItem,
  removeCordUsernameChip,
  removeFoundationsAdminAudioRow,
  removeFoundationsAdminResourceRow,
  removeFoundationsAdminSessionRow,
  removeFoundationsAdminVideoRow,
  removeTWCourseAdminAudioRow,
  removeTWCourseAdminLessonRow,
  removeTWCourseAdminResourceRow,
  removeTWCourseAdminVideoRow,
  renderActivePlanView,
  renderFoundationsList,
  renderLineUponLineSearchResults,
  resetPlayButton,
  respondToCord,
  respondToDailyReadingContinuePrompt,
  rewatchFsvClip,
  saveBookAdminForm,
  saveCordDisplayName,
  saveEditChurchResource,
  saveFoundationsAdminForm,
  saveMyMarginsCoverField,
  saveRecordBadge,
  saveTWCourseAdminModule,
  scrollFoundationsRow,
  seekAudio,
  selectBibleStudyBookFromDropdown,
  selectFoundationsCategory,
  selectLineUponLineBook,
  selectRecordBadge,
  selectStudyView,
  sendCordThreadMessage,
  sendShareToCord,
  shareBookSession,
  shareFoundationsClass,
  shareFoundationsSession,
  shareResource,
  shareSheetCopyLink,
  shareSheetDeviceShare,
  shareVerse,
  skipAudio,
  skipDailyReadingTts,
  startEditChurchResource,
  stopMiniPlayerMedia,
  submitNewCord,
  switchPlanSubTab,
  switchStudySubTab,
  switchTab,
  toggleAuthMode,
  toggleDailyReadingTts,
  toggleDarkMode,
  toggleFoundationsAdminSuggestion,
  toggleFoundationsAdminVideoQuiz,
  toggleFoundationsMediaItem,
  toggleFoundationsSession,
  toggleLineUponLineAddForm,
  toggleMiniPlayerPlayback,
  toggleNotesCollapse,
  togglePlanDay,
  togglePlay,
  toggleReadingNotifPanel,
  toggleRecordAdminForm,
  toggleResourceCardExpanded,
  toggleResourcesCollapse,
  toggleStudyPresenterFilter,
  toggleTWLesson,
  updateBookAdminPresenterField,
  updateBookAdminSessionField,
  updateFoundationsAdminAudioField,
  updateFoundationsAdminHeroVideoValue,
  updateFoundationsAdminResourceField,
  updateFoundationsAdminSessionField,
  updateFoundationsAdminVideoField,
  updateProgress,
  updateRecordAdminBadgePreview,
  updateSearchVisibility,
  updateTWCourseAdminAudioField,
  updateTWCourseAdminHeroVideoValue,
  updateTWCourseAdminLessonField,
  updateTWCourseAdminResourceField,
  updateTWCourseAdminVideoField
};
