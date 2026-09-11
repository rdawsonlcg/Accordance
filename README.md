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

Six pieces down (`core/db.js`, `shared/adminUtils.js`, `shared/videoPlayer.js`, `shared/byTheBook.js`, `shared/twBibleCourse.js`, `shared/coreD.js`, `shared/audioPlayer.js`) — seven, counting the audio player. All three study features and every widely-shared utility flagged along the way are now their own modules. Everything else the app does (auth/session handling, tab navigation, the Bible reading view and search, Records/badges, reading plans, Cords, Settings, and Church Resources) is still in `app.js`, with no committed plan to split it further.
The natural next candidates, following the same one-piece-at-a-time approach as the rest of
this cleanup: each of the three study features (Core-D, TW Bible Course, By
the Book) as their own modules — they're the biggest remaining chunks of
`app.js`, and each one is fairly self-contained already.
