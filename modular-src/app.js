import {
  TTS_ESTIMATED_CHARS_PER_SECOND, TTS_STARTUP_GRACE_MS, cachedTtsVoices,
  dailyReadingContinueCountdownInterval, dailyReadingContinueTimeoutHandle,
  dailyReadingCurrentUtterance, dailyReadingElapsedMs, dailyReadingFullText,
  dailyReadingSegmentStartTime, dailyReadingSpokenOffset, dailyReadingTtsActive,
  dailyReadingTtsPaused, dailyReadingTtsSessionToken, dailyReadingTtsWarmedUp,
  estimateDailyReadingCurrentCharIndex, handleDailyReadingFinishedNaturally,
  hideDailyReadingContinuePrompt, pauseDailyReadingTts, pickDailyReadingTtsVoice,
  pickLocalFallbackTtsVoice, refreshTtsVoiceCache, registerDailyReadingMediaController,
  respondToDailyReadingContinuePrompt, resumeDailyReadingTts, runDailyReadingTtsCycle,
  showDailyReadingContinuePrompt, skipDailyReadingTts, speakDailyReadingPassage,
  stopDailyReadingTts, toggleDailyReadingTts, updateDailyReadingTtsButton,
  warmUpDailyReadingTtsVoice
} from './shared/dailyReadingTts.js';
import {
  fetchAllRows, createTableAccessor,
  readingSchedulesTable, twCourseProgressTable, churchResourcesTable,
  cordMessagesTable, cordMembersTable, marginNotesTable, recordsTable,
  userReadingPlansTable, userReadingProgressTable, userResourceClicksTable,
  profilesTable
} from './core/db.js';
import {
  initAudio, togglePlay, resetPlayButton, skipAudio, updateProgress, seekAudio
} from './shared/audioPlayer.js';
import {
  activeLineUponLineBook, addChurchResource, addLineUponLineResource,
  cancelEditChurchResource, cancelLineUponLineAddForm, churchResourcesMap,
  clearLineUponLineAddFormFields, deleteResourceFromTab, editingChurchResourceId,
  expandedResourceCardIds, getAllChurchResourcesFlat, getChurchResourceReferenceList,
  hasBookletTag, isCustomThumbnailShown, isResourcesSubTabVisible,
  openChurchResourceVideo, parseChurchResourceReferenceList,
  removeChurchResourceEverywhere, removeChurchResourceFromRowIndex,
  removeChurchResourceItem, renderChurchResourceEditFormHtml, renderLineUponLinePanel,
  renderLineUponLineSearchResults, renderResourceCardHtml, renderResourcesTab,
  resolveChurchResourceReferenceInput, resolveChurchResourceReferenceList,
  resolveChurchResourceThumbnail, saveEditChurchResource, saveNewChurchResource,
  selectLineUponLineBook, startEditChurchResource, toggleLineUponLineAddForm,
  toggleResourceCardExpanded, updateChurchResourcesDOM
} from './shared/churchResources.js';
import {
  CORD_AVATAR_COLORS, CORD_GROUP_ICON_SVG, activeCordId, addCordUsernameChip,
  backToCordList, closeCordView, cordAvatarColor, cordAvatarHtml, cordAvatarInitial,
  cordCacheStorageKey, cordList, cordMessagesCache, cordNewUsernames, cordPending,
  cordPollTimer, cordUsernameCache, formatCordDate, getCordLastReadMap,
  loadCordCacheFromStorage, loadCordData, loadCordMessages, openCordThread, openCordView,
  removeCordUsernameChip, renderCordThread, renderCordViewBody, renderShareSheetCordList,
  resetCordStateForLogout, resolveCordUsernames, respondToCord, saveCordCacheToStorage,
  sendCordThreadMessage, sendShareToCord, setCordLastRead, stopCordPollTimer,
  submitNewCord, updateCordNotificationBadge
} from './shared/cords.js';
import {
  RECORD_BADGES_CACHE_MS, RECORD_BADGE_CHECK_SVG, RECORD_BADGE_HUE_PALETTE,
  RECORD_BADGE_LOCK_SVG, RECORD_BIBLE_BADGE_ICONS, RECORD_BIBLE_ICON_COLORS,
  RECORD_BIBLE_ICON_SHAPES, RECORD_TRIGGER_TYPES, awardRecordByBadgeId, awardRecordOnce,
  checkBookResourceBadgesAfterClick, checkMarginNotesCountBadges,
  checkReadingPlanCompletionBadges, checkTWCourseCompletionBadges,
  checkTWModuleCompletionBadges, clearUserRecordsMap, closeRecordsView,
  describeRecordTrigger, getGroupedRecordBadgeSections, getRecordBadgeHueColor,
  getRecordBadgeProgress, getRecordBadgeSetLabel, getSeenRecordBadgeIds,
  handleRecordAdminEditSelectChange, handleRecordAdminIconPickerChange,
  handleRecordAdminTriggerTypeChange, loadRecordBadges, loadScheduleNamesForBadgeForm,
  loadUserRecords, markBookResourceClicked, markRecordBadgesSeen, openRecordsView,
  populateRecordAdminBookFields, populateRecordAdminEditSelect,
  populateRecordAdminGroupList, populateRecordAdminIconPicker,
  populateRecordAdminSectionList, populateRecordAdminTWModuleField,
  recordAdminIconPickerPopulated, recordBadgeSectionsCache, recordBadgesList,
  recordBadgesListLoadedAt, recordBadgesTable, renderRecordBadgeCard,
  renderRecordBadgePreviewCard, renderRecordBadgesGrid, renderRecordIconHtml,
  resetRecordAdminForm, saveRecordBadge, selectRecordBadge, sortBadgesForSet,
  toggleRecordAdminForm, updateRecordAdminBadgePreview, updateRecordAdminIconPreview,
  updateRecordsNotificationBadge, userRecordsMap
} from './shared/records.js';








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

// The other half of the shared/churchResources.js circular dependency (see
// its header comment): it needs these from here too. (escapeHtml,
// currentUser, and shareResource are ALSO needed by it, but are already
// exported above/below.)
export { currentBibleVerses, markStudySubTabSeen };

// The other half of the twBibleCourse.js circular dependency (see its header
// comment): it needs these from here too. (escapeHtml, fixMojibakeText,
// switchStudySubTab, switchTab, updateStudyNotificationBadges, and
// currentUser are ALSO needed by it, but are already exported above/below;
// the four Core-D rendering helpers it also needs now come from
// shared/coreD.js instead of here, imported above.)
export { checkTWCourseCompletionBadges, checkTWModuleCompletionBadges };

// The other half of the shared/cords.js circular dependency (see its header
// comment): it needs these from here too. (closeShareSheet, ensureLoggedInFor,
// escapeHtml, logout, switchTab, and currentUser are ALSO needed by it, but
// are already exported above/below.)
export { linkifyMessageContent, setHeaderIconSelected, shareSheetContext, lastMainTabId };

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
  duplicateTWCourseAdminModule,
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

    // The other half of the shared/dailyReadingTts.js circular dependency
    // (see its header comment): it needs these three from here too.
    // (ensureLoggedInFor, renderActivePlanView, switchPlanSubTab, and
    // togglePlanDay are ALSO needed by it, but are already exported
    // elsewhere via the big onclick-driven export list below.)
    export { cachedScheduleDays, currentPlanSubTab, currentPlanStartDate, currentPlanViewDayNumber };
    let currentPlanViewDayNumber = null;

    // A setter, rather than letting shared/dailyReadingTts.js assign this
    // directly — an imported binding is a read-only view from the importing
    // module's side, so its post-TTS auto-advance-to-the-next-day has to go
    // through this instead.
    export function setCurrentPlanViewDayNumber(dayNumber) {
      currentPlanViewDayNumber = dayNumber;
    }
    let calendarViewYear = null;
    let calendarViewMonth = null;
    let readingNotificationMessage = null; // current message text, or null if nothing to show
    let readingNotificationSeen = false;   // cleared (badge hidden) once the Reading Plan tab is opened
    let lastSeenReadingMessage = null;     // used to detect genuinely NEW messages so the badge can return
    let isReadingNotifCollapsed = false;
    let isNotesCollapsed = false;
    let isResourcesCollapsed = true;


    const bibleCache = {};
    let cachedChaptersList = null;
    let pendingShareTarget = null; // {type: 'verse'|'resource'|'book_session'|'foundations_class'|'foundations_session', ref, t, id, book, i} — captured from a shared link
    let originalShareUrl = null;  // full URL including ?share=... params, preserved for post-signup redirect



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
        await updateRecordsNotificationBadge();

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
      clearUserRecordsMap();
      await updateRecordsNotificationBadge();
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
        stopCordPollTimer();
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

    // Splits a reference like "1 Corinthians 13:4" into book/chapter/verse
    // for sorting purposes. Matched against BIBLE_STUDIES_BOOK_ORDER's own
    // real book names, longest first, rather than just splitting on the
    // first space -- several books have one in their own name ("1
    // Corinthians", "Song of Solomon"), so naive splitting would cut a
    // multi-word book's name in half. A reference that doesn't match any
    // known book (shouldn't normally happen, but data can always be messier
    // than expected) sorts to the very end rather than crashing or being
    // mistaken for Genesis.
    //
    // Built lazily, on first real use, rather than as a plain top-level
    // const: this code sits well before BIBLE_STUDIES_BOOK_ORDER's own
    // declaration further down the file, and a plain const here would try
    // to read it before it's been initialized at all (a "cannot access
    // before initialization" error the moment the script loads) -- the
    // same class of load-order hazard fixed the same way in
    // shared/coreD.js's FOUNDATIONS_SCRIPTURE_REGEX and
    // shared/churchResources.js's CHURCH_RESOURCE_REFERENCE_REGEX.
    let _myMarginsBookNamesByLengthDesc = null;
    function getMyMarginsBookNamesByLengthDesc() {
      if (!_myMarginsBookNamesByLengthDesc) {
        _myMarginsBookNamesByLengthDesc = [...BIBLE_STUDIES_BOOK_ORDER].sort((a, b) => b.length - a.length);
      }
      return _myMarginsBookNamesByLengthDesc;
    }
    function parseMyMarginsReference(ref) {
      const book = getMyMarginsBookNamesByLengthDesc().find(b => ref === b || ref.startsWith(b + ' '));
      const bookIndex = book ? BIBLE_STUDIES_BOOK_ORDER.indexOf(book) : BIBLE_STUDIES_BOOK_ORDER.length;
      const rest = book ? ref.slice(book.length).trim() : '';
      const match = rest.match(/^(\d+):(\d+)/);
      const chapter = match ? parseInt(match[1], 10) : 0;
      const verse = match ? parseInt(match[2], 10) : 0;
      return { bookIndex, chapter, verse };
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
      // Genesis-to-Revelation order (book, then chapter, then verse) --
      // window.userMarginNotes has no inherent order of its own (it just
      // reflects whatever order the margin_notes table happened to return
      // rows in, e.g. creation order), which read as essentially random
      // once printed as a page of notes rather than an ordered study aid.
      notes.sort((a, b) => {
        const pa = parseMyMarginsReference(a.reference);
        const pb = parseMyMarginsReference(b.reference);
        return (pa.bookIndex - pb.bookIndex) || (pa.chapter - pb.chapter) || (pa.verse - pb.verse);
      });

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


    function closeMyMarginsView() {
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
  duplicateTWCourseAdminModule,
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
  removeFoundationsAdminSessionQuiz,
  removeFoundationsAdminSessionRow,
  removeFoundationsAdminVideoRow,
  removeTWCourseAdminAudioRow,
  removeTWCourseAdminLessonQuiz,
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
  setFoundationsAdminQuizCorrect,
  setFoundationsAdminSessionQuizCorrect,
  setTWCourseAdminQuizCorrect,
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
  updateFoundationsAdminQuizField,
  updateFoundationsAdminQuizOption,
  updateFoundationsAdminResourceField,
  updateFoundationsAdminSessionField,
  updateFoundationsAdminSessionQuizField,
  updateFoundationsAdminSessionQuizOption,
  updateFoundationsAdminVideoField,
  updateProgress,
  updateRecordAdminBadgePreview,
  updateSearchVisibility,
  updateTWCourseAdminAudioField,
  updateTWCourseAdminHeroVideoValue,
  updateTWCourseAdminLessonField,
  updateTWCourseAdminQuizField,
  updateTWCourseAdminQuizOption,
  updateTWCourseAdminResourceField,
  updateTWCourseAdminVideoField
};

// ----------------------------------------------------------------------------
// Test utilities only — used by tests/ (see tests/testExports.js), never
// exported into the shipped build. Deliberately have NO `export` keyword
// here (unlike shared/twBibleCourse.js's __setTwBibleCourseDataForTest and
// similar): those stay private from THIS file's perspective unless app.js
// explicitly imports and re-exports them, but a function declared directly
// in app.js -- the entry point -- would be part of its exports (and so get
// flattened onto `window`) the moment it has an `export` keyword at all,
// with no way for build.js's extraExportNames gating to keep it out of a
// real production build. Staying a plain, undecorated function here and
// relying entirely on extraExportNames to append the export (only when a
// test asks for it) is what keeps these out of the shipped file.
function __setCurrentUserForTest(user) { currentUser = user; }
function __setCurrentPlanStartDateForTest(date) { currentPlanStartDate = date; }
// A getter, not window.currentPlanViewDayNumber, for the same reason
// shared/cords.js's __getCordPollTimerForTest and shared/records.js's
// __getUserRecordsMapForTest exist: currentPlanViewDayNumber is a
// primitive, so build.js's Object.assign(window, __App) copies its value
// onto `window` once, at bundle-eval time. setCurrentPlanViewDayNumber()
// (the real function this exists to help verify) reassigns it afterward,
// which never updates that already-copied window property.
function __getCurrentPlanViewDayNumberForTest() { return currentPlanViewDayNumber; }

