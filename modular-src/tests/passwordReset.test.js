// tests/passwordReset.test.js — covers the password-reset flow added after
// the security audit found this app had no way for someone to recover a
// forgotten password at all. Three real steps, each tested against the
// actual UI/state-machine code, not just the Supabase calls in isolation:
//   1. Requesting a reset email (setAuthScreenMode('reset-request') + handleAuth)
//   2. Arriving back via the recovery link (the onAuthStateChange listener)
//   3. Actually setting the new password (setAuthScreenMode('reset-confirm') + handleAuth)
//
// tests/helpers/loadApp.js's Supabase mock needed a real auth object added
// for this (see its own comment) -- app.js now calls
// supabaseClient.auth.onAuthStateChange(...) once, unconditionally, at the
// top level, which would otherwise throw on every single test in the whole
// suite, not just these.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./helpers/loadApp.js');

// Mirrors shell.html's actual login-modal markup closely enough for
// setAuthScreenMode's real element lookups (getElementById calls) to all
// resolve to something real, rather than silently no-op against missing
// elements -- a test against fully-real markup, not a hand-simplified
// stand-in that could pass even if a real id/element got renamed.
const LOGIN_MODAL_HTML = `
  <div id="login-screen" style="display:none;">
    <div class="login-box">
      <p id="auth-title"></p>
      <p id="auth-subtitle"></p>
      <input type="email" id="auth-email">
      <input type="password" id="auth-password">
      <p id="forgot-password-link-row"><a href="#" onclick="showResetPasswordRequest(); return false;">Forgot password?</a></p>
      <label id="remember-device-row"><input type="checkbox" id="remember-device-checkbox" checked></label>
      <input type="password" id="auth-new-password" style="display:none;">
      <button id="auth-btn" onclick="handleAuth()"></button>
      <p><span id="auth-toggle-text"></span><a href="#" id="auth-toggle-link" onclick="toggleAuthMode()"></a></p>
      <p id="back-to-signin-row" style="display:none;"><a href="#" onclick="showSignIn(); return false;">Back to Sign In</a></p>
      <p id="login-error" style="display:none;"></p>
    </div>
  </div>
  <div id="app-screen" style="display:none;"></div>
  <div id="loader" style="display:none;"></div>
`;

test('showResetPasswordRequest switches the modal into reset-request mode: hides the password field, shows the back link', async () => {
  const { window } = await loadApp({
    html: LOGIN_MODAL_HTML,
    extraExportNames: ['showResetPasswordRequest', 'setAuthScreenMode'],
  });

  window.showResetPasswordRequest();

  assert.strictEqual(window.document.getElementById('auth-title').innerText, 'Reset Password');
  assert.strictEqual(window.document.getElementById('auth-password').style.display, 'none', 'the password field makes no sense in this mode and should be hidden');
  assert.strictEqual(window.document.getElementById('back-to-signin-row').style.display, '', 'a way back to Sign In should now be visible');
  assert.strictEqual(window.document.getElementById('auth-btn').innerText, 'Send Reset Link');
});

test('submitting the reset-request form calls resetPasswordForEmail with the entered address, and shows a confirmation message', async () => {
  const { window, calls } = await loadApp({
    html: LOGIN_MODAL_HTML,
    extraExportNames: ['showResetPasswordRequest', 'handleAuth'],
  });

  window.showResetPasswordRequest();
  window.document.getElementById('auth-email').value = 'someone@example.com';
  await window.handleAuth();

  const resetCall = calls.find(c => c.op === 'resetPasswordForEmail');
  assert.ok(resetCall, 'resetPasswordForEmail should have actually been called');
  assert.strictEqual(resetCall.email, 'someone@example.com');

  const errorEl = window.document.getElementById('login-error');
  assert.strictEqual(errorEl.style.display, 'block');
  assert.ok(errorEl.innerText.toLowerCase().includes('check your email'));
});

test('submitting the reset-request form with no email shows a validation error instead of calling Supabase', async () => {
  const { window, calls } = await loadApp({
    html: LOGIN_MODAL_HTML,
    extraExportNames: ['showResetPasswordRequest', 'handleAuth'],
  });

  window.showResetPasswordRequest();
  await window.handleAuth();

  assert.ok(!calls.some(c => c.op === 'resetPasswordForEmail'), 'Supabase should not have been called with no email entered');
  assert.strictEqual(window.document.getElementById('login-error').style.display, 'block');
});

test('showSignIn returns the modal to the normal Sign In mode', async () => {
  const { window } = await loadApp({
    html: LOGIN_MODAL_HTML,
    extraExportNames: ['showResetPasswordRequest', 'showSignIn'],
  });

  window.showResetPasswordRequest();
  window.showSignIn();

  assert.strictEqual(window.document.getElementById('auth-title').innerText, 'Sign In');
  assert.strictEqual(window.document.getElementById('auth-password').style.display, '', 'the password field should be back');
  assert.strictEqual(window.document.getElementById('back-to-signin-row').style.display, 'none');
});

test('a PASSWORD_RECOVERY auth event opens the login modal directly into reset-confirm mode', async () => {
  const { window } = await loadApp({
    html: LOGIN_MODAL_HTML,
  });

  // Fires the REAL callback app.js itself registered with
  // onAuthStateChange (captured by the mock -- see loadApp.js), confirming
  // the actual wiring end to end, rather than calling
  // showSetNewPasswordForm() directly and only proving that function
  // works in isolation.
  const registeredCallback = window.supabaseClient.auth.__registeredCallback;
  assert.strictEqual(typeof registeredCallback, 'function', 'app.js should have registered a real onAuthStateChange callback at load time');

  registeredCallback('PASSWORD_RECOVERY', {});

  assert.strictEqual(window.document.getElementById('login-screen').style.display, 'flex', 'the modal should open even if it was closed');
  assert.strictEqual(window.document.getElementById('auth-title').innerText, 'Set a New Password');
  assert.strictEqual(window.document.getElementById('auth-new-password').style.display, '', 'the new-password field should be visible');
  assert.strictEqual(window.document.getElementById('auth-password').style.display, 'none', 'the normal password field should not be, to avoid any confusion about which field is in play');
});

test('other auth events (e.g. a normal sign-in) do NOT open the reset-confirm form', async () => {
  const { window } = await loadApp({
    html: LOGIN_MODAL_HTML,
  });
  const registeredCallback = window.supabaseClient.auth.__registeredCallback;

  registeredCallback('SIGNED_IN', {});

  assert.notStrictEqual(window.document.getElementById('auth-title').innerText, 'Set a New Password', 'an unrelated auth event should not trigger the password-reset UI');
});

test('submitting the reset-confirm form calls updateUser with the new password', async () => {
  const { window, calls } = await loadApp({
    html: LOGIN_MODAL_HTML,
    extraExportNames: ['showSetNewPasswordForm', 'handleAuth', '__setAppHasInitializedForTest'],
  });
  // checkUserSession() (fired, un-awaited, right after a successful
  // updateUser() -- see handleAuth's reset-confirm branch) would otherwise
  // go on to call the real, much larger initializeApp() the first time it
  // ever runs with no prior session -- skipped here since this test only
  // needs to confirm updateUser() itself was called correctly, not
  // reproduce the whole app's real startup DOM.
  window.__setAppHasInitializedForTest(true);

  window.showSetNewPasswordForm();
  window.document.getElementById('auth-new-password').value = 'a-genuinely-new-password';
  await window.handleAuth();
  // handleAuth's reset-confirm branch calls checkUserSession() without
  // awaiting it -- flushed here so that background activity (a mocked,
  // near-instant getSession() call and the DOM updates after it) fully
  // settles within this test's own lifetime, rather than surfacing as an
  // unhandled rejection after the test has already finished.
  await new Promise(resolve => setImmediate(resolve));

  const updateCall = calls.find(c => c.op === 'updateUser');
  assert.ok(updateCall, 'updateUser should have actually been called');
  assert.strictEqual(updateCall.args.password, 'a-genuinely-new-password');
});

test('submitting the reset-confirm form with no new password shows a validation error instead of calling Supabase', async () => {
  const { window, calls } = await loadApp({
    html: LOGIN_MODAL_HTML,
    extraExportNames: ['showSetNewPasswordForm', 'handleAuth'],
  });

  window.showSetNewPasswordForm();
  await window.handleAuth();

  assert.ok(!calls.some(c => c.op === 'updateUser'), 'Supabase should not have been called with no new password entered');
  assert.strictEqual(window.document.getElementById('login-error').style.display, 'block');
});

test('closing the login modal always resets it back to Sign In mode, even mid-reset-flow', async () => {
  const { window } = await loadApp({
    html: LOGIN_MODAL_HTML,
    extraExportNames: ['showResetPasswordRequest', 'closeLoginModal'],
  });

  window.showResetPasswordRequest();
  window.closeLoginModal();
  // Re-open (a real person would trigger this by clicking "Log In" again,
  // or by ensureLoggedInFor() popping it back open for some other feature)
  // and confirm it shows Sign In, not a stale Reset Password state.
  window.document.getElementById('login-screen').style.display = 'flex';

  assert.strictEqual(window.document.getElementById('auth-title').innerText, 'Sign In', 'reopening later should never show a leftover reset-flow state');
});
