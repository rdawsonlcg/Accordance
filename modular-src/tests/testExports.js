// tests/testExports.js — the curated list of internal (non-onclick) function
// and state names the test suite needs direct access to, passed to
// loadApp()'s extraExportNames. See build.js's header comment for why this
// doesn't affect the production build at all: bundleApp() only attaches
// these to `window` when a test explicitly asks for them, and automatically
// skips anything already exported for another reason.
//
// Grouped by the module that actually owns each name, for anyone adding to
// this list later — that's the file each name's `export` keyword lives in.

module.exports = {
  // shared/churchResources.js
  churchResources: [
    'resolveChurchResourceReferenceInput',
    'updateChurchResourcesDOM',
    'parseChurchResourceReferenceList',
    'renderResourcesTab',
    'renderLineUponLinePanel',
    'churchResourcesMap',
  ],
  // shared/coreD.js
  coreD: [
    'renderFoundationsContentHtml',
  ],
  // shared/twBibleCourse.js
  twBibleCourse: [
    'markTWLessonComplete',
    'twBibleCourseData',
    'twCourseProgress',
  ],
  // shared/byTheBook.js
  byTheBook: [
    'getBibleStudyBookConfig',
    'getSessionType',
  ],
  // shared/records.js
  records: [
    'checkBookResourceBadgesAfterClick',
    'populateRecordAdminTWModuleField',
    'renderRecordBadgesGrid',
    'recordBadgesList',
    'userRecordsMap',
    'clearUserRecordsMap',
    'markRecordBadgesSeen',
    'updateRecordsNotificationBadge',
    'getSeenRecordBadgeIds',
  ],
  // shared/cords.js
  cords: [
    'openShareSheet',
    'cordPollTimer',
    'stopCordPollTimer',
    'cordList',
    'loadCordData',
    'updateCordNotificationBadge',
    'openCordThread',
    'getCordLastReadMap',
  ],
  // shared/dailyReadingTts.js
  dailyReadingTts: [
    'handleDailyReadingFinishedNaturally',
    'registerDailyReadingMediaController',
    'dailyReadingTtsSessionToken',
  ],
  // app.js itself
  app: [
    'currentUser',
    'cachedScheduleDays',
    'currentPlanStartDate',
    'currentPlanViewDayNumber',
    'setCurrentPlanViewDayNumber',
    'currentBibleVerses',
    '__setCurrentUserForTest',
    '__setCurrentPlanStartDateForTest',
    '__getCurrentPlanViewDayNumberForTest',
  ],
};
