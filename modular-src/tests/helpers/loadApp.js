// tests/helpers/loadApp.js — the shared setup every test file uses to get a
// real, running copy of the app to test against.
//
// Deliberately builds and runs the ACTUAL bundled artifact (via
// build.js's bundleApp()), not a plain `import` of the source modules
// directly — a few of the real bugs found during this project's history
// were specific to how esbuild bundles things (a multi-line
// `someTable\n.select(...)` chain slipping past an import check, an eager
// top-level IIFE racing a circular import's load order), and none of those
// would show up testing the unbundled source in isolation. Testing the real
// artifact costs a bit of bundling time per run; it buys confidence that
// what's tested is what actually ships.
//
// extraExportNames lets a test reach an internal function that has no
// onclick attribute of its own (so correctly stays private in the real
// shipped file) — see tests/testExports.js for the curated list this
// project's tests actually use, and build.js's own header comment for why
// this doesn't affect the production build at all.
//
// Each call to loadApp() creates a fresh jsdom window and evaluates the
// real app bundle into it — this is exactly right for testing (a clean
// slate every time), but some of the app's own real behavior intentionally
// starts things a browser tab's own page-unload would normally clean up
// (shared/videoPlayer.js's mini-player visibility watcher is a
// setInterval that ticks every 400ms for as long as any audio/video/TTS
// session is registered as active). Node has no equivalent teardown moment,
// so a handle like that can keep the process's event loop alive
// indefinitely once several tests across several files have each started
// one. package.json's "test" script runs with --test-force-exit for
// exactly this reason — the standard, intended tool for a test suite built
// on jsdom, not a workaround for a bug in the app itself.

const { JSDOM } = require('jsdom');
const { bundleApp } = require('../../build.js');

// A reasonable default mock: every table read returns empty, every write
// succeeds. Pass `overrides` to customize specific tables' behavior, or read
// `calls` afterward to assert on exactly what the app tried to do.
function createSupabaseMock(overrides = {}) {
  const calls = [];
  const client = {
    from(table) {
      calls.push({ op: 'from', table });
      const override = overrides[table];
      const builder = {
        select(cols) { calls.push({ op: 'select', table, cols }); return builder; },
        eq(col, val) { calls.push({ op: 'eq', table, col, val }); return builder; },
        neq(col, val) { calls.push({ op: 'neq', table, col, val }); return builder; },
        in(col, vals) { calls.push({ op: 'in', table, col, vals }); return builder; },
        order() { return builder; },
        range() { return builder; },
        limit() { return builder; },
        maybeSingle() {
          calls.push({ op: 'maybeSingle', table });
          const data = override && override.maybeSingle !== undefined ? override.maybeSingle : null;
          return Promise.resolve({ data, error: null });
        },
        single() {
          calls.push({ op: 'single', table });
          const data = override && override.single !== undefined ? override.single : {};
          return Promise.resolve({ data, error: null });
        },
        insert(payload) { calls.push({ op: 'insert', table, payload }); return builder; },
        insertMany(rows) { calls.push({ op: 'insertMany', table, rows }); return builder; },
        upsert(payload, selectCols, options) { calls.push({ op: 'upsert', table, payload, options }); return builder; },
        update(payload) { calls.push({ op: 'update', table, payload }); return builder; },
        updateQuery(payload) { calls.push({ op: 'updateQuery', table, payload }); return builder; },
        delete() { calls.push({ op: 'delete', table }); return builder; },
        deleteQuery() { calls.push({ op: 'deleteQuery', table }); return builder; },
        then(resolve) {
          const data = override && override.data !== undefined ? override.data : [];
          return Promise.resolve({ data, error: null }).then(resolve);
        },
      };
      return builder;
    },
    rpc(name, args) {
      calls.push({ op: 'rpc', name, args });
      const override = overrides.__rpc && overrides.__rpc[name];
      return Promise.resolve({ data: override || null, error: null });
    },
    storage: {
      from(bucket) {
        return {
          upload(path, file, opts) { calls.push({ op: 'storageUpload', bucket, path }); return Promise.resolve({ data: { path }, error: null }); },
          getPublicUrl(path) { return { data: { publicUrl: `https://example.com/${bucket}/${path}` } }; },
        };
      },
    },
    // Real app.js calls supabaseClient.auth.onAuthStateChange(...) once,
    // unconditionally, at the top level (not inside DOMContentLoaded) --
    // so unlike checkUserSession() (which only runs from inside that
    // listener, and so never actually fires during a test unless something
    // explicitly dispatches it), this one runs on every single test that
    // loads the app bundle at all. Without a real .auth object here, that
    // call would throw "Cannot read properties of undefined" and break
    // every test in the suite, not just ones about auth specifically.
    // Each method here returns a reasonable empty/success default; a test
    // that needs to exercise real auth behavior should override the
    // specific method it needs directly on window.supabaseClient.auth
    // after loadApp() resolves, rather than this file trying to anticipate
    // every possible auth scenario up front.
    auth: {
      onAuthStateChange(callback) {
        calls.push({ op: 'onAuthStateChange' });
        // Stored (not just recorded as a call) so a test can fire the REAL
        // callback app.js registered -- confirming the actual wiring (does
        // this callback really call showSetNewPasswordForm on
        // PASSWORD_RECOVERY?), not just that showSetNewPasswordForm works
        // when called directly and separately.
        client.auth.__registeredCallback = callback;
        return { data: { subscription: { unsubscribe() {} } } };
      },
      getSession() { calls.push({ op: 'getSession' }); return Promise.resolve({ data: { session: null }, error: null }); },
      signInWithPassword(args) { calls.push({ op: 'signInWithPassword', args }); return Promise.resolve({ data: { user: null, session: null }, error: null }); },
      signUp(args) { calls.push({ op: 'signUp', args }); return Promise.resolve({ data: { user: null, session: null }, error: null }); },
      signOut() { calls.push({ op: 'signOut' }); return Promise.resolve({ error: null }); },
      updateUser(args) { calls.push({ op: 'updateUser', args }); return Promise.resolve({ data: { user: null }, error: null }); },
      resetPasswordForEmail(email, args) { calls.push({ op: 'resetPasswordForEmail', email, args }); return Promise.resolve({ data: {}, error: null }); },
    },
  };
  return { client, calls };
}

// Loads a fresh window with the real bundled app evaluated into it.
// `html` is the initial document body (only include the elements the
// specific behavior under test actually needs — see each test file for what
// it provides). `extraExportNames` exposes additional internal functions on
// `window`, same as testExports.js. `supabaseOverrides` is passed straight
// through to createSupabaseMock.
async function loadApp({ html = '', extraExportNames = [], extraSource = '', supabaseOverrides = {} } = {}) {
  // A real URL matters here, not just cosmetically: jsdom treats a
  // document with no URL as an opaque origin, where localStorage throws
  // "localStorage is not available for opaque origins" rather than working.
  // Several real functions (markRecordBadgesSeen/getSeenRecordBadgeIds,
  // the Cords display-name cache) wrap their localStorage calls in a
  // try/catch, so that throw is silently swallowed rather than surfacing
  // as a test failure -- without this, those functions quietly no-op
  // every time, and a test checking "did this actually get remembered"
  // would misleadingly look like a real behavior bug instead of a missing
  // origin.
  // runScripts: 'dangerously', not 'outside-only' -- discovered the hard way:
  // 'outside-only' lets window.eval() below run our own bundle, but does NOT
  // compile inline onclick="..." HTML attributes into real event handlers
  // when markup is set via innerHTML (button.onclick stays typeof "object",
  // not "function", and a real .click() silently does nothing). That let an
  // actual bug (11 admin functions imported into app.js but never added to
  // its window-export list) pass tests that called the functions directly
  // instead of actually clicking the rendered button -- the tests were
  // correct that the function worked when called directly, they just never
  // exercised the real click path that a user (and a real browser) actually
  // use. 'dangerously' is safe here specifically because every HTML fixture
  // in this test suite is one this project wrote itself, not third-party
  // content -- there is nothing untrusted for it to run.
  const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`, { runScripts: 'dangerously', url: 'http://localhost/' });
  const window = dom.window;

  const { client, calls } = createSupabaseMock(supabaseOverrides);
  window.supabaseClient = client;

  // jsdom doesn't implement the Web Speech API at all -- tests that need
  // real speech behavior pass their own richer mock via window.speechSynthesis
  // after loadApp() returns; this bare default just stops an unrelated
  // `window.speechSynthesis.getVoices()` call elsewhere from throwing.
  window.speechSynthesis = { getVoices: () => [], cancel() {}, pause() {}, resume() {}, speak() {} };
  window.SpeechSynthesisUtterance = function (text) { this.text = text; };

  // jsdom doesn't implement scrollIntoView (it would require real layout,
  // which jsdom doesn't do) -- several real UI functions call it on a panel
  // right after making it visible (e.g. openTWModule, openFoundationsItem),
  // so without this shim, tests exercising those throw "scrollIntoView is
  // not a function" on something unrelated to what's actually being tested.
  window.HTMLElement.prototype.scrollIntoView = function () {};

  const bundle = await bundleApp(extraExportNames, extraSource);
  window.eval(bundle);

  return { window, calls };
}

module.exports = { loadApp, createSupabaseMock };
