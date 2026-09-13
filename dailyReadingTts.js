// ============================================================================
// shared/dailyReadingTts.js — the "Listen Aloud" text-to-speech feature on
// the Daily Reading (Read) tab: picking a voice, starting/pausing/resuming/
// stopping a reading session, the skip-forward/back approximation (the Web
// Speech API has no real seek), the "continue to tomorrow?" prompt after a
// day finishes, and registering with the shared mini-player bar so playback
// controls there also work for a TTS session, not just audio/video.
//
// Reads only the text inside #daily-reading-passage-text — the actual
// passage rendering (renderPassageText, parsePassageSegment, etc.) stayed in
// app.js, since it's Reading Plan's own passage-rendering logic that this
// feature merely reads from, not something exclusive to Listen Aloud.
//
// Depends on:
//   - shared/videoPlayer.js: clearActiveMedia, handleMediaStarted,
//     updateMiniPlayerPlayPauseIcon (the shared mini-player bar)
//   - app.js: cachedScheduleDays, currentPlanStartDate, currentPlanSubTab,
//     ensureLoggedInFor, renderActivePlanView, switchPlanSubTab,
//     togglePlanDay, and setCurrentPlanViewDayNumber (a setter for
//     currentPlanViewDayNumber, needed because this module can only read an
//     imported binding, not assign it, when auto-advancing to the next
//     day's reading once the current one finishes)
// app.js in turn imports this module's own exports back (toggleDailyReadingTts,
// stopDailyReadingTts, etc.) — the same circular-dependency pattern used
// throughout this app, safe here for the same reason: every usage on both
// sides is inside a function body, never at module-load time.
// ============================================================================

import { clearActiveMedia, handleMediaStarted, updateMiniPlayerPlayPauseIcon } from './videoPlayer.js';
import {
  cachedScheduleDays, currentPlanStartDate, currentPlanSubTab, currentPlanViewDayNumber,
  ensureLoggedInFor, renderActivePlanView, switchPlanSubTab, togglePlanDay,
  setCurrentPlanViewDayNumber
} from '../app.js';

    // --- Daily Reading "listen aloud" (Read tab) state ---
    export let dailyReadingTtsActive = false;      // true while a session is ongoing at all (speaking, paused, or the continue-prompt is up)
    export let dailyReadingTtsPaused = false;      // true only while actively paused mid-session (speechSynthesis.pause()'d, not stopped) — meaningless unless dailyReadingTtsActive is also true
    // Bumped every time the flow is deliberately stopped/reset. Any in-flight utterance
    // event or pending timer captures the token at its own start and checks it before
    // acting, so a stale callback from a session the user already cancelled (by hitting
    // stop, changing days, or leaving the tab) can detect that and quietly no-op instead
    // of resurrecting a flow the user meant to end.
    export let dailyReadingTtsSessionToken = 0;
    export let dailyReadingContinueCountdownInterval = null;
    export let dailyReadingContinueTimeoutHandle = null;

    // --- Daily Reading rewind/fast-forward state ---
    // The Web Speech API has no seek/currentTime — a SpeechSynthesisUtterance is
    // just "speak this string", with no way to jump to a position within audio
    // that's already being synthesized. So "skip 10 seconds" is approximated by
    // estimating how far into the passage the voice has gotten (from elapsed
    // wall-clock time, banked across any pause/resume cycles — see
    // pauseDailyReadingTts/resumeDailyReadingTts) and starting a brand new
    // utterance from that estimated point in the text instead. See
    // skipDailyReadingTts for the actual skip logic.
    export let dailyReadingFullText = '';        // the complete (sup-stripped) passage text for the day currently being read
    export let dailyReadingSpokenOffset = 0;     // char offset into dailyReadingFullText where the CURRENT utterance begins
    export let dailyReadingSegmentStartTime = 0; // Date.now() when the current unpaused speaking segment began
    export let dailyReadingElapsedMs = 0;        // banked elapsed speaking time (ms) for the current utterance, across any pause/resume cycles before this segment
    // Rough estimate at this feature's rate of 0.90 (~2.1 words/sec at a natural
    // reading pace, ~6 characters per word including the trailing space) — not
    // exact (voices and rates vary), just close enough for a "skip" gesture.
    export const TTS_ESTIMATED_CHARS_PER_SECOND = 13;

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
    export let cachedTtsVoices = [];
    export function refreshTtsVoiceCache() {
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
    export let dailyReadingTtsWarmedUp = false;
    export function warmUpDailyReadingTtsVoice() {
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

    export function pickDailyReadingTtsVoice() {
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
    export function updateDailyReadingTtsButton() {
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
    export function registerDailyReadingMediaController(dayNumber) {
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
    export function toggleDailyReadingTts() {
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
    export function pauseDailyReadingTts() {
      if (!dailyReadingTtsActive || dailyReadingTtsPaused || !window.speechSynthesis) return;
      window.speechSynthesis.pause();
      dailyReadingTtsPaused = true;
      // Bank the time actually spent speaking this segment — see
      // skipDailyReadingTts/estimateDailyReadingCurrentCharIndex, which need an
      // accurate elapsed-time total even across pause/resume cycles.
      dailyReadingElapsedMs += Date.now() - dailyReadingSegmentStartTime;
      updateDailyReadingTtsButton();
    }

    export function resumeDailyReadingTts() {
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
    export function runDailyReadingTtsCycle() {
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
    export const TTS_STARTUP_GRACE_MS = 1500;

    // The utterance object currently backing playback (if any) — tracked so a
    // fresh call below can detach ITS handlers before cancelling it. Without
    // this, cancelling it to start a new utterance (a retry, a rewind/fast-
    // forward, or reading the next day) would fire that old utterance's own
    // onerror, which — since nothing about the session's own token changes for
    // any of those cases — would look exactly like a genuine failure and
    // incorrectly stop the very session still in progress.
    export let dailyReadingCurrentUtterance = null;

    export function speakDailyReadingPassage(text, mySessionToken, useLocalFallbackVoice, startOffset) {
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
    export function pickLocalFallbackTtsVoice() {
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
    export function estimateDailyReadingCurrentCharIndex() {
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
    export function skipDailyReadingTts(deltaSeconds) {
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

    export function stopDailyReadingTts() {
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
    export async function handleDailyReadingFinishedNaturally(mySessionToken) {
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
        setCurrentPlanViewDayNumber(nextDayNumber);
        renderActivePlanView();
        showDailyReadingContinuePrompt(nextDayNumber, mySessionToken);
      }, 1500);
    }

    export function showDailyReadingContinuePrompt(nextDayNumber, mySessionToken) {
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

    export function hideDailyReadingContinuePrompt() {
      const promptEl = document.getElementById('daily-reading-continue-prompt');
      if (promptEl) promptEl.style.display = 'none';
      if (dailyReadingContinueCountdownInterval) { clearInterval(dailyReadingContinueCountdownInterval); dailyReadingContinueCountdownInterval = null; }
      if (dailyReadingContinueTimeoutHandle) { clearTimeout(dailyReadingContinueTimeoutHandle); dailyReadingContinueTimeoutHandle = null; }
    }

    export function respondToDailyReadingContinuePrompt(continueReading) {
      hideDailyReadingContinuePrompt();
      if (continueReading) runDailyReadingTtsCycle(); // reads the next day's passage, already on screen
      else stopDailyReadingTts();
    }