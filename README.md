# Accordance — modular source (proof of concept)

This is the first step of splitting the app's single giant HTML file into
real, separately-maintainable source files, while still shipping you the
exact same kind of output you have today: one `.html` file you can
double-click open, upload, or share — nothing changes about how you use it.

## What's here

- **`core/db.js`** — the shared per-table data-access layer (the accessor we
  built earlier this session).
- **`shared/adminUtils.js`** — utilities shared by all three admin content
  screens (Core-D, TW Bible Course, "By the Book"): drag-and-drop reordering,
  the Knowledge Check question editor, and the "Lesson/Session Content"
  formatting toolbar (bold/italic/underline/bullets/links), rich-paste
  conversion, and table insertion/upload. Each screen's own thin wrapper
  functions (e.g. `applyFoundationsFormat`, `applyTWCourseAdminFormat`) stay
  in `app.js` — they're screen-specific glue, not shared logic.
- **`shared/videoPlayer.js`** — the one video/media player all three study
  features play their videos through: YouTube/direct-video-file URL parsing,
  the persistent mini-player bar, and the full-screen video overlay (playback
  controls, playlist, autoplay-blocked fallback, and the Knowledge Check flow
  that plays after a video ends). This one has a genuine circular dependency
  with `app.js` — it needs `twBibleCourseData`, `foundationsList`,
  `markTWLessonComplete`, and `escapeHtml` from there (to look up a lesson's
  Knowledge Check questions and mark it complete), while `app.js` needs this
  module's own exports (`openFsvPlayer`, `closeFsvPlayer`, etc.) back. ES
  modules handle that correctly via live bindings as long as neither side
  touches the other's export at its own top level before both have loaded —
  every usage here is inside a function body, called only later, so that
  holds. See the comment at the top of `videoPlayer.js` for more.
- **`shared/byTheBook.js`** — the "By the Book" study feature: the visual
  book shelf/ruler, book and session selection, the Listen/Watch/Read session
  list, presenters, shelf groups, and the full admin form. The most tangled
  extraction so far — it depends on things from `core/db.js`,
  `shared/adminUtils.js`, `shared/videoPlayer.js`, AND `app.js` all at once
  (see the comment at the top of the file for the full breakdown), with
  another genuine circular dependency back to `app.js`. Deliberately does
  NOT include Church Resources (the per-verse resource attachments shown in
  the main Bible reading tab) or the `book_resources_clicked` badge check —
  both stayed in `app.js`, since they belong to different systems that just
  happen to sit nearby in the UI.
- **`shared/twBibleCourse.js`** — the TW Bible Course study feature: module/
  lesson data and progress tracking, the learner-facing module list and
  lesson accordion (including both the inline and full-screen-overlay
  Knowledge Check flows), and the full admin form. Reuses three of Core-D's
  own content-rendering helpers directly (`normalizeFoundationsMediaList`,
  `foundationsMediaItemAccordionHtml`, `renderFoundationsContentHtml`,
  `sizeFoundationsHeroVideoBg`) rather than duplicating them — a real,
  pre-existing overlap between the two features that this extraction had to
  navigate rather than paper over. Also required updating
  `shared/videoPlayer.js`, which used to import `twBibleCourseData`/
  `markTWLessonComplete` from `app.js` back when this module's code still
  lived there — that import now points here instead, and was specifically
  re-verified afterward with a live cross-module test, not just a successful
  build. The same badge-check exclusion pattern as `byTheBook.js` applies
  here too: `checkTWModuleCompletionBadges`/`checkTWCourseCompletionBadges`
  stayed in `app.js` with the rest of the badge system.
- **`shared/audioPlayer.js`** — the plain HTML5 `<audio>` controls used
  wherever the app plays a simple audio clip inline (Church Resources, By the
  Book, Core-D, and TW Bible Course alike): play/pause, skip forward/back,
  the scrub bar, and the time display. Completely self-contained — no
  imports, no cross-module state — since every function just looks up DOM
  elements by a shared id convention. The simplest extraction so far: no
  circular dependency, no load-order hazard, nothing to re-point. Turned up
  one small piece of dead code along the way — `shared/byTheBook.js` was
  importing these six names from `app.js` even though it only ever
  referenced them inside onclick-attribute HTML strings (which resolve
  through the global scope at click time, not through a module's own
  imports) — removed as part of this pass.
- **`shared/churchResources.js`** — Church Resources: pastoral/study
  resources attached to one or more Bible verses (shown inline in the main
  Bible reading view) or browsed by book under "Line Upon Line." By far the
  most fragmented extraction of the seven — this feature isn't one or two
  big movable chunks, it's woven into 7 separate, non-contiguous regions of
  `app.js`, several interleaved with entirely unrelated code (Reading Plans,
  My Margins, core app bootstrap). The "add a new resource" form is actually
  embedded as literal inline HTML inside the main verse-row template, not a
  separate function — there was nothing to extract there, so that markup
  stays exactly where it is in `app.js`; only the genuinely separable
  logic/state moved. Depends on `shared/videoPlayer.js` (thumbnail/URL
  helpers, `openFsvPlayer`) and on `currentBibleVerses`/`currentUser`/
  `BIBLE_STUDIES_BOOK_ORDER`/a couple of small functions from `app.js`, with
  the same circular dependency back the other way.
  **Two real bugs came out of this pass**, both worth calling out:
  1. This module's own reference-matching regex had the exact same
     eager-top-level-IIFE-on-a-circular-import bug found in `shared/coreD.js`
     — fixed proactively, the same way, before it could cause a failure.
  2. A genuinely serious one, unrelated to this extraction itself: while
     testing this module's database calls, a gap was found in how earlier
     extractions were dependency-checked — a call like `someTable.insert(...)`
     was being seen as just a generic `.insert(` method call rather than a
     reference to an external `someTable` object, so a missing import of the
     *object* itself could slip through undetected. Rechecking every module
     against this specific pattern turned up a real instance already
     shipped: `shared/twBibleCourse.js` was missing its import of
     `twCourseProgressTable`, meaning **completing a TW Bible Course lesson's
     Knowledge Check has been silently failing to save progress** since that
     extraction — the completion call was throwing a `ReferenceError` before
     it could reach the database. Both this and `churchResources.js`'s own
     missing `churchResourcesTable` import are now fixed and confirmed with
     a test that actually reaches the database call, not just one that
     avoids throwing via an early-return path (which is what let the TW bug
     go unnoticed the first time).

- **`shared/coreD.js`** — the Core-D study feature: class/session data,
  category filters and search, the learner-facing list and detail panel
  (including the inline Knowledge Check flow), the shared content renderer
  (bold/italic/underline/links/tables/bullet lists/scripture auto-linking),
  and the full admin form. `shared/twBibleCourse.js`'s import of the
  rendering helpers and media-chip icons, and `shared/videoPlayer.js`'s
  import of `foundationsList`, both now point here instead of `app.js` —
  the two re-pointings this extraction required. Also reuses
  `shared/byTheBook.js`'s presenter system, the same way
  `shared/twBibleCourse.js` does. `normalizeTWLessonQuizzes` stayed in
  `app.js` (it only wraps this module's own `normalizeFoundationsQuiz`)
  since it's genuinely needed by both this module and TW and neither should
  be considered its "home." `openChurchResourceVideo` stayed in `app.js`
  too, for the same reason it did for the other two study features.
  **A real bug worth calling out**: the scripture auto-linker's regex used
  to be built once, eagerly, at module load time — but it depends on
  `BIBLE_STUDIES_BOOK_ORDER`, imported from `app.js`, which `app.js` in turn
  imports this module back from (the same circular-dependency pattern used
  throughout this whole modularization). Every *other* cross-module
  reference in the app is safely deferred inside a function body,
  precisely to avoid load-order hazards like this — this one wasn't, and
  only an automated test that actually exercised it (not just a successful
  build) caught it. Fixed by computing the regex lazily, on first real use,
  instead.
- **`shared/cords.js`** — Cords, the direct/group messaging system: request/
  accept, the cord list and pending invites, the message thread, avatar
  generation, and the one Cords-specific piece of the app-wide Share Sheet
  (sending a shared link straight into a Cord). The Share Sheet itself
  (`openShareSheet`, copy-link, device-share) stayed in `app.js` — it's
  generic, used by every `shareX` function across every already-extracted
  module, not something exclusive to Cords; only its Cords-specific piece
  moved. `lastMainTabId` and `closeMyMarginsView` stayed too, for the same
  reason — genuinely shared navigation state that just happened to sit next
  to Cords' own code.
  Depends on `core/db.js` (`cordMessagesTable`, `cordMembersTable`,
  `profilesTable`) and `supabaseClient` directly for one RPC call that
  doesn't go through a table accessor — referenced as a pre-existing global
  the same way `core/db.js` itself does, and specifically confirmed
  (not just assumed) to resolve correctly with an end-to-end test using the
  real built HTML file, both script tags included.
  Two things worth calling out from this pass:
  1. **A real bug, caught before shipping**: `app.js`'s `switchTab()` used to
     clear Cords' background poll timer with a direct assignment
     (`cordPollTimer = null`), which isn't legal once that variable becomes
     an imported binding. Fixed with a `stopCordPollTimer()` setter,
     confirmed with a test that actually sets a timer id and checks it gets
     cleared, not just that the call doesn't throw.
  2. **A methodology improvement that already paid for itself**: after the
     `churchResourcesTable`/`twCourseProgressTable` incident (see
     `shared/churchResources.js` above), every module was rechecked for the
     same class of miss — but the recheck script itself had a gap, since it
     only matched a table accessor's `.method()` call on the *same line*.
     Multi-line chains (`cordMembersTable` on one line, `.select(...)` on
     the next) slipped through the first pass. Broadening the check to allow
     a line break between the two confirmed `shared/cords.js` itself needed
     `cordMembersTable` too — caught before it ever shipped, this time.
- **`shared/records.js`** — Records/achievement badges: the admin-managed
  badge catalog, which of them a user has earned, the five trigger-check
  functions that award them (reading plan completed, margin notes count,
  book resources clicked, TW module/course completed), the learner-facing
  Records grid, and the badge-creation admin form. Structurally the cleanest
  extraction of the nine — one single contiguous ~1,000-line block, no
  interleaved unrelated code — but reaches into `shared/byTheBook.js`
  (`getBibleStudyBookConfig`, `getSessionType`) and `shared/twBibleCourse.js`
  (`twBibleCourseData`, `markTWLessonComplete`) to check its triggers, both
  re-pointed here from `app.js` the same way earlier re-pointings went.
  `markBookResourceClicked` was also imported by `shared/byTheBook.js` from
  `app.js` before this move, but — like `shared/audioPlayer.js`'s controls —
  only ever referenced inside onclick-attribute HTML strings there, never
  called directly, so that import was simply removed rather than re-pointed.
  **A real bug, caught before shipping**: `app.js`'s logout cleanup used to
  clear the user's earned-badges cache with a direct assignment
  (`userRecordsMap = {}`), the same illegal-once-imported pattern found
  twice before (`shared/byTheBook.js`'s filters, `shared/cords.js`'s poll
  timer). Fixed with a `clearUserRecordsMap()` setter, confirmed by
  populating the cache, clearing it, and checking it's actually empty
  afterward — not just that the call doesn't throw.
- **`app.js`** — everything else, for now. It `import`s from both files
  above. As more pieces get modularized, this file will keep shrinking and
  new files will appear alongside `core/` and `shared/`.
- **`shell.html`** — the page itself (markup, CSS, and the two small
  `<script>` tags that were already there before this split: the Supabase
  library tag, and the small config script that creates `supabaseClient`).
  It has one marker, `/*__APP_BUNDLE__*/`, where the built app code gets
  inserted.
- **`build.js`** — bundles `app.js` (and whatever it imports) into one plain
  script, then splices it into `shell.html` in place of that marker to
  produce the final file.

## Why a build step at all

Real JavaScript `import`/`export` (the whole point of splitting into files)
doesn't work when a page is opened directly from disk (`file://...`) —
browsers block it for security reasons. `build.js` resolves all the imports
ahead of time and produces one plain script with the exact same behavior, so
the *source* stays properly modular while the *shipped file* stays exactly
as portable as it is today.

## How to rebuild it yourself

You'll need [Node.js](https://nodejs.org) installed (just Node — no other
tools). Then, from this folder:

```
npm install
npm run build
npm run verify
```

`verify` checks that every function the HTML calls from an `onclick`/`onchange`/
etc. attribute is actually reachable after bundling — a real bug slipped
through here once (a function called after an `if (...)` guard in the same
attribute got silently missed), so this check runs as a matter of course
after every build now, not just when something seems wrong.

This writes two identical files one directory up:
`Accordance.html` (open, upload, or share this one directly) and
`index.html` (an exact copy of the same file, purely so GitHub Pages — or any
static host — serves the app automatically at your repo's root URL, since
that's the filename those look for by default).

You won't normally need to do this yourself — going forward, I'll edit these
source files directly and hand you the freshly-built HTML each time, exactly
like every other change this session. This is here so you have the real
source under your control too, and so the rebuild process isn't a mystery.

## A gotcha worth knowing about (already handled, but worth understanding)

This app calls ~200 of its own functions directly from `onclick="..."` (and
similar) attributes in the HTML. Those attributes reach into the page's
*global* scope when clicked. Bundlers normally wrap everything up privately
for safety — which would silently break every one of those buttons. The
`export { ... }` block at the very bottom of `app.js` is the fix: it lists
every function actually referenced that way, and `build.js` re-attaches
exactly those (and only those) onto `window` after bundling. Anything not in
that list stays properly private to the file that defines it — which is the
whole point of modularizing in the first place.

## What's next

Ten pieces down (`core/db.js`, `shared/adminUtils.js`, `shared/videoPlayer.js`,
`shared/byTheBook.js`, `shared/twBibleCourse.js`, `shared/coreD.js`,
`shared/audioPlayer.js`, `shared/churchResources.js`, `shared/cords.js`,
`shared/records.js`). All three study features, every widely-shared utility
flagged along the way, Church Resources, Cords, and Records/badges are now
their own modules. Everything else the app does (auth/session handling, tab
navigation, the core Bible reading view and search, reading plans, and
Settings) is still in `app.js`, with no committed plan to split it further.
No standing guess about what's "probably self-contained" has survived
contact with the actual code yet, so none is offered here either — the
honest answer is that finding out requires doing the same careful mapping
this file's whole history is made of, not assuming it from the outside.
