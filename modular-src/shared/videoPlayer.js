// ============================================================================
// shared/videoPlayer.js — the app's one shared video/media player, used by
// Core-D, TW Bible Course, and "By the Book" alike (each of which previously
// called straight into this same code sitting inline in app.js). Covers:
//
//   - YouTube/direct-video-file URL parsing and embedding
//   - The persistent "mini player" bar for audio/video playing in the
//     background while someone browses elsewhere in the app
//   - The full-screen video (FSV) overlay itself: playback controls,
//     playlist, autoplay-blocked fallback, mini/expand mode, and the
//     Knowledge Check flow that can gate a TW Bible Course lesson or show
//     informationally after a Core-D session's video
//
// Depends on four things: foundationsList from shared/coreD.js (to look up a
// Core-D session's Knowledge Check questions once its last video ends) and
// escapeHtml from app.js, plus twBibleCourseData/markTWLessonComplete from
// shared/twBibleCourse.js (same lookup, for a TW lesson, plus marking it
// complete once its Knowledge Check is answered correctly). app.js,
// twBibleCourse.js, AND coreD.js all in turn import this module's own
// exports (openFsvPlayer, closeFsvPlayer, etc.) — genuine circular
// dependencies in every case, which ES modules handle correctly via live
// bindings as long as neither side touches the other's export at its own
// top level before both have finished loading. Every usage here is inside a
// function body, called only later (never at module-load time), so that's
// exactly what happens.
// ============================================================================

import { foundationsList } from './coreD.js';
import { escapeHtml } from '../app.js';
import { twBibleCourseData, markTWLessonComplete } from './twBibleCourse.js';



    export function getYouTubeVideoId(url) {
      if (!url) return null;
      let raw = url.trim();
      if (!raw) return null;
      if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw; // tolerate a pasted link with no protocol

      try {
        const u = new URL(raw);
        const host = u.hostname.replace(/^www\.|^m\.|^music\./, '');
        let videoId = '';
        if (host === 'youtu.be') {
          videoId = u.pathname.slice(1).split('/')[0];
        } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
          if (u.pathname === '/watch') {
            videoId = u.searchParams.get('v') || '';
          } else {
            const match = u.pathname.match(/^\/(?:embed|v|shorts|live)\/([^/?]+)/);
            if (match) videoId = match[1];
          }
        }
        // A real YouTube video ID is always exactly 11 URL-safe characters.
        if (/^[A-Za-z0-9_-]{11}$/.test(videoId)) return videoId;
      } catch (e) {
        // not a parseable URL at all — fall through to the text scan below
      }

      const scan = raw.match(/(?:[?&]v=|youtu\.be\/|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/);
      return scan ? scan[1] : null;
    }

    // The thumbnail YouTube serves for any video id — used to paint a Church
    // Resources card's background when its link is (or contains) a YouTube video.
    export function getYouTubeThumbnailUrl(url) {
      const id = getYouTubeVideoId(url);
      return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
    }

    // A link that points directly at an image file — the resource's own picture is
    // its natural thumbnail, no lookup needed.
    export function isDirectImageUrl(url) {
      if (!url) return false;
      try {
        const u = new URL(/^https?:\/\//i.test(url) ? url : 'https://' + url);
        return /\.(jpe?g|png|gif|webp|avif|svg|bmp)$/i.test(u.pathname);
      } catch (e) {
        return false;
      }
    }


    // A direct video file link (as opposed to a YouTube/YouTube-nocookie URL)
    // — played via the plain <video id="fsv-video"> element instead of the
    // YouTube iframe. See fsvLoadCurrentVideo for how the two paths share the
    // same on-screen controls through a small player-object adapter.
    export function isDirectVideoUrl(url) {
      return /\.(mp4|m4v|mov|webm|ogv|ogg)(\?.*)?(#.*)?$/i.test((url || '').trim());
    }

    // Converts an admin-typed "Start At" value — plain seconds ("90"),
    // "mm:ss" ("1:30"), or "h:mm:ss" ("1:02:03") — into whole seconds. Blank/
    // unparseable input is 0, meaning "start of video" (the default).
    export function parseTimeToSeconds(input) {
      const str = String(input == null ? '' : input).trim();
      if (!str) return 0;
      if (/^\d+$/.test(str)) return parseInt(str, 10);
      const parts = str.split(':').map(p => parseInt(p, 10) || 0);
      let seconds = 0;
      for (const p of parts) seconds = seconds * 60 + p;
      return Math.max(0, seconds);
    }

    // The reverse, for pre-filling a video row's Start At field when editing
    // already-saved content. 0 (the default) displays as an empty field.
    export function formatSecondsToTimeInput(seconds) {
      const s = Math.max(0, parseInt(seconds, 10) || 0);
      if (s === 0) return '';
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      return h > 0
        ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
        : `${m}:${String(sec).padStart(2, '0')}`;
    }

    export function toYouTubeEmbedUrl(url, startSeconds) {
      const videoId = getYouTubeVideoId(url);
      if (!videoId) return null;
      // enablejsapi=1 is required for the YouTube IFrame Player API (see
      // bindYouTubePlayer below) to attach to and control an *existing* iframe
      // rather than one it creates itself. The YT Player API ignores playerVars
      // passed to its constructor when binding to an iframe that already has a
      // src (ours always does, set just before the API attaches) — so autoplay
      // and every other player behavior has to be set here, on the URL itself,
      // rather than as constructor options.
      // autoplay=1: the video starts playing immediately instead of sitting
      // paused on YouTube's own thumbnail until tapped.
      // controls=0: hides YouTube's own control bar so only this app's overlay
      // controls (play/pause, mini/expand, close) are visible — otherwise both
      // sets of controls show at once, with YouTube's showing through behind ours.
      // rel=0/modestbranding=1: keep the embed to just the video, no related-
      // video grid or channel branding once the video ends/is paused.
      // playsinline=1: keeps playback inside the iframe on iOS Safari instead of
      // forcing the OS's own fullscreen video player, so our custom overlay
      // (and autoplay itself, which iOS is stricter about outside this mode)
      // still works there.
      // start=N: an admin-set "start at" point (see the video row's Start At
      // field) — omitted entirely when 0/unset so the video just plays from
      // the real beginning, its normal default.
      const start = parseInt(startSeconds, 10) || 0;
      return `https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&autoplay=1&controls=0&rel=0&modestbranding=1&playsinline=1${start > 0 ? `&start=${start}` : ''}`;
    }

    // A silent, looping preview embed — used for the Core-D class hero's
    // background (see renderFoundationsDetailPanel), not the real full-screen
    // player. mute=1 is what makes autoplay actually work in every browser;
    // loop=1 needs playlist=<same id> to loop a single video (a YouTube embed
    // quirk — loop alone only works for an actual playlist).
    export function toYouTubeMutedPreviewEmbedUrl(url) {
      const videoId = getYouTubeVideoId(url);
      if (!videoId) return null;
      return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&rel=0&modestbranding=1&playsinline=1&disablekb=1&iv_load_policy=3`;
    }

    // ============================================================
    // GLOBAL "NOW PLAYING" MINI PLAYER (audio only — every video now plays in
    // the full-screen player further down, which has its own always-visible
    // controls and doesn't need this).
    // Tracks whichever native <audio> element is currently playing anywhere
    // in the app, via capturing play/pause/ended listeners on document, and
    // surfaces a small floating bar above the bottom nav whenever that
    // audio's own on-screen player has scrolled out of view or sits in a tab
    // the user has navigated away from.
    // ============================================================
    // { kind: 'native', element, title } for a real <audio>/<video> tag, or
    // { kind: 'tts', element, title, isPaused(), play(), pause(), stop() } for
    // the Daily Reading "listen aloud" session (see registerDailyReadingMediaController)
    // — `element` is used generically for the on-screen-visibility check either
    // way (an <audio>/<video> tag for 'native', the daily-reading-tts-btn button
    // for 'tts'), while actual playback control goes through the type-specific
    // methods for 'tts' since a speechSynthesis session has no element to call
    // .play()/.pause() on directly.
    export let activeMediaController = null;
    export let miniPlayerWatcherId = null;

    // Every native <audio> element gets a data-media-title attribute at
    // render time (see the audio markup below) so the mini player always has
    // something readable to show, regardless of which part of the app it
    // came from.
    export function getNativeMediaTitle(el) {
      return el.getAttribute('data-media-title') || 'Now Playing';
    }

    export function getMiniPlayerElement() {
      return activeMediaController ? activeMediaController.element : null;
    }

    export function handleMediaStarted(controller) {
      // Only one thing plays at a time — pause whatever was previously active
      // (unless it's the same element restarting).
      if (activeMediaController && activeMediaController.element !== controller.element) {
        pauseMediaController(activeMediaController);
      }
      activeMediaController = controller;
      const titleEl = document.getElementById('media-mini-player-title');
      if (titleEl) titleEl.textContent = controller.title || 'Now Playing';
      setupMiniPlayerMarquee();
      updateMiniPlayerPlayPauseIcon(true);
      updateMiniPlayerVisibility();
      startMiniPlayerVisibilityWatcher();
    }

    export function pauseMediaController(controller) {
      if (!controller) return;
      if (controller.kind === 'tts') {
        try { controller.pause(); } catch (e) { /* session may already be gone */ }
        return;
      }
      try { controller.element.pause(); } catch (e) { /* element may already be gone */ }
    }

    export function clearActiveMedia() {
      activeMediaController = null;
      stopMiniPlayerVisibilityWatcher();
      const bar = document.getElementById('media-mini-player');
      if (bar) bar.classList.remove('visible');
    }

    export function updateMiniPlayerPlayPauseIcon(isPlaying) {
      const btn = document.getElementById('media-mini-player-playpause');
      if (!btn) return;
      btn.title = isPlaying ? 'Pause' : 'Play';
      btn.innerHTML = isPlaying
        ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"></rect><rect x="14" y="5" width="4" height="14" rx="1"></rect></svg>'
        : '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="7 4 20 12 7 20 7 4"></polygon></svg>';
    }

    // Scrolls the title back and forth if (and only if) it's too long to fit
    // its own space — a title that already fits just sits still.
    export function setupMiniPlayerMarquee() {
      const wrap = document.querySelector('.media-mini-player-title-wrap');
      const titleEl = document.getElementById('media-mini-player-title');
      if (!wrap || !titleEl) return;
      titleEl.classList.remove('scrolling');
      titleEl.style.animation = 'none';
      titleEl.style.transform = 'translateX(0)';
      // Force layout so the measurement below reflects the new title text.
      void titleEl.offsetWidth;
      const overflow = titleEl.scrollWidth - wrap.clientWidth;
      if (overflow > 4) {
        titleEl.style.setProperty('--media-mini-scroll-distance', `-${overflow}px`);
        const duration = Math.max(5, Math.min(18, titleEl.scrollWidth / 28));
        titleEl.style.animation = '';
        titleEl.style.animationDuration = duration + 's';
        titleEl.classList.add('scrolling');
      }
    }

    export function positionMiniPlayer() {
      const bar = document.getElementById('media-mini-player');
      const nav = document.querySelector('.nav-tabs');
      if (bar && nav) bar.style.bottom = nav.getBoundingClientRect().height + 'px';
    }
    window.addEventListener('resize', positionMiniPlayer);

    // Shows the bar only once the currently-playing media's own on-screen
    // player is no longer visible (its tab was switched away from, or an
    // ancestor collapsed) — while it's still visible there's no need for a
    // second, redundant set of controls floating on top of it.
    export function updateMiniPlayerVisibility() {
      const bar = document.getElementById('media-mini-player');
      if (!bar) return;
      if (!activeMediaController) { bar.classList.remove('visible'); return; }
      const el = getMiniPlayerElement();
      if (!el || !document.body.contains(el)) {
        // The element backing the current controller was removed from the DOM
        // entirely (e.g. its accordion item was collapsed by a re-render) —
        // there's nothing left to resume, so just clear it.
        clearActiveMedia();
        return;
      }
      const hidden = el.offsetParent === null;
      if (hidden) {
        const wasVisible = bar.classList.contains('visible');
        positionMiniPlayer();
        bar.classList.add('visible');
        // The marquee measurement setupMiniPlayerMarquee() takes at
        // handleMediaStarted time is often wrong — playback usually starts
        // while the bar is still hidden (its own view is on screen instead),
        // and a hidden element measures 0-width, so a long title never gets
        // marked as overflowing. Re-measure now that the bar has actually
        // just become visible and is laid out for real.
        if (!wasVisible) setupMiniPlayerMarquee();
      } else {
        bar.classList.remove('visible');
      }
    }

    // Polls (rather than hooking every navigation function in the app) so any
    // current or future way of switching tabs/views is covered automatically,
    // and also acts as a safety net: if a re-render silently removed the
    // playing element from the DOM entirely without ever firing a 'pause' or
    // 'ended' event, this notices on the next tick and clears the stale mini
    // player instead of leaving it stuck showing controls for media that no
    // longer exists. Pausing on its own is NOT a reason to clear — the mini
    // player is meant to stay put (showing a "Play" button) until the user
    // presses Stop, or the track actually ends, or its element is gone.
    export function startMiniPlayerVisibilityWatcher() {
      if (miniPlayerWatcherId) return;
      miniPlayerWatcherId = setInterval(() => {
        if (!activeMediaController) { stopMiniPlayerVisibilityWatcher(); return; }
        const el = activeMediaController.element;
        if (!el || !document.body.contains(el)) { clearActiveMedia(); return; }
        updateMiniPlayerVisibility();
      }, 400);
    }
    export function stopMiniPlayerVisibilityWatcher() {
      if (miniPlayerWatcherId) { clearInterval(miniPlayerWatcherId); miniPlayerWatcherId = null; }
    }

    export function toggleMiniPlayerPlayback() {
      if (!activeMediaController) return;
      if (activeMediaController.kind === 'tts') {
        if (activeMediaController.isPaused()) activeMediaController.play();
        else activeMediaController.pause();
        return;
      }
      const el = activeMediaController.element;
      if (el.paused) el.play(); else el.pause();
    }

    export function stopMiniPlayerMedia() {
      if (!activeMediaController) return;
      if (activeMediaController.kind === 'tts') {
        try { activeMediaController.stop(); } catch (e) { /* ignore */ }
        clearActiveMedia();
        return;
      }
      try { activeMediaController.element.pause(); activeMediaController.element.currentTime = 0; } catch (e) { /* ignore */ }
      clearActiveMedia();
    }

    // Capturing-phase listeners on document catch every native <audio>/<video>
    // element's play/pause/ended events, even though those events don't
    // bubble — capturing still sees them on the way down to the target. This
    // means any current or future audio/video tag in the app is picked up
    // automatically, with no need to wire each one up individually.
    document.addEventListener('play', function(e) {
      const el = e.target;
      if (el && (el.tagName === 'AUDIO' || el.tagName === 'VIDEO')) {
        handleMediaStarted({ kind: 'native', element: el, title: getNativeMediaTitle(el) });
      }
    }, true);
    document.addEventListener('pause', function(e) {
      const el = e.target;
      if (activeMediaController && activeMediaController.kind === 'native' && activeMediaController.element === el) {
        updateMiniPlayerPlayPauseIcon(false);
      }
    }, true);
    document.addEventListener('ended', function(e) {
      const el = e.target;
      if (activeMediaController && activeMediaController.kind === 'native' && activeMediaController.element === el) {
        clearActiveMedia();
      }
    }, true);

    // --- YouTube IFrame Player API loader (used by the full-screen video player below) ---
    export let youTubeApiReadyPromise = null;
    export function ensureYouTubeApiLoaded() {
      if (youTubeApiReadyPromise) return youTubeApiReadyPromise;
      youTubeApiReadyPromise = new Promise((resolve) => {
        if (window.YT && window.YT.Player) { resolve(window.YT); return; }
        const prevCallback = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = function() {
          if (typeof prevCallback === 'function') prevCallback();
          resolve(window.YT);
        };
        if (!document.getElementById('youtube-iframe-api-script')) {
          const tag = document.createElement('script');
          tag.id = 'youtube-iframe-api-script';
          tag.src = 'https://www.youtube.com/iframe_api';
          document.head.appendChild(tag);
        }
      });
      return youTubeApiReadyPromise;
    }

    // ============================================================
    // FULL-SCREEN VIDEO PLAYER
    // The single, shared way every video in the app now plays — replacing
    // the old inline dropdown/embed players entirely. Opened with a flat
    // list of {label, url} videos (a Foundations session's video list, or a
    // single-item list for a "By the Book" session) plus a starting index,
    // so back/forward-track and the session playlist panel all work off the
    // same simple array regardless of which part of the app opened it.
    // ============================================================
    export let fsvState = null; // { videos, index, contextTitle, player, controlsVisible, mini, completionContext, autoplayCheckTimer }

    export const FSV_PLAY_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>';
    export const FSV_PAUSE_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect></svg>';
    export const FSV_SHRINK_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="14" y1="10" x2="21" y2="3"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>';
    export const FSV_EXPAND_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>';

    // completionContext is an optional { type, ... } tag carried on fsvState —
    // currently only used by TW Bible Course lessons ({ type: 'tw_lesson',
    // moduleId, lessonIndex }) so that finishing this whole playlist (see
    // fsvForwardTrack) can mark the right lesson complete. Foundations videos
    // simply don't pass one, so this stays a no-op there.
    export function openFsvPlayer(videos, startIndex, contextTitle, completionContext) {
      const list = (videos || []).filter(v => v && v.url);
      if (list.length === 0) return;
      // Video takes over the whole screen — stop any background audio the
      // mini player was tracking rather than leaving two things playing.
      if (activeMediaController) stopMiniPlayerMedia();
      fsvState = {
        videos: list,
        index: Math.min(Math.max(startIndex || 0, 0), list.length - 1),
        contextTitle: contextTitle || '',
        player: null,
        controlsVisible: true,
        mini: false,
        completionContext: completionContext || null
      };
      const overlay = document.getElementById('fsv-player');
      overlay.classList.add('open');
      overlay.classList.remove('mini');
      document.body.style.overflow = 'hidden';
      fsvShowControls();
      applyFsvMiniMode();
      fsvUpdatePlaylistToggleVisibility();
      fsvLoadCurrentVideo();
    }

    // Shrinks the player into a small corner window (or restores it to full
    // screen) without ever destroying the iframe/player — the video just
    // keeps playing through the resize, and since #fsv-player sits outside
    // every .tab-content, it's never hidden by switching nav tabs either, so
    // shrinking it is what actually lets the user go tap around the rest of
    // the app while the video keeps going in the corner.
    export function toggleFsvMiniMode() {
      if (!fsvState) return;
      fsvState.mini = !fsvState.mini;
      if (fsvState.mini) fsvClosePlaylist();
      applyFsvMiniMode();
    }

    export function applyFsvMiniMode() {
      if (!fsvState) return;
      const overlay = document.getElementById('fsv-player');
      const btn = document.getElementById('fsv-expand-btn');
      if (overlay) overlay.classList.toggle('mini', fsvState.mini);
      if (btn) {
        btn.innerHTML = fsvState.mini ? FSV_EXPAND_SVG : FSV_SHRINK_SVG;
        btn.title = fsvState.mini ? 'Expand to full screen' : 'Shrink to corner';
      }
      // Mini mode always shows its (minimal) chrome, since there's no tap
      // gesture to bring it back — full mode falls back to whatever the
      // normal tap-to-hide state was.
      const controls = document.getElementById('fsv-controls');
      if (controls) controls.classList.toggle('visible', fsvState.mini || fsvState.controlsVisible);
      // Only the full-screen view is meant to block the rest of the page —
      // shrinking it is the whole point of freeing background scroll/taps back up.
      document.body.style.overflow = fsvState.mini ? '' : 'hidden';
    }

    // Tapping the video: in mini mode there's no chrome to toggle, so a tap
    // just restores full screen instead (the common "tap the PiP window to
    // bring it back" gesture); in full screen it toggles the control chrome.
    export function handleFsvTap() {
      if (!fsvState) return;
      if (fsvState.mini) { toggleFsvMiniMode(); return; }
      toggleFsvControls();
    }

    export function fsvUpdatePlaylistToggleVisibility() {
      const toggle = document.getElementById('fsv-playlist-toggle');
      if (toggle) toggle.style.display = (fsvState && fsvState.videos.length > 1) ? '' : 'none';
    }

    // (Re)points the shared iframe at the current track and rebinds a fresh
    // YouTube Player instance to it — used both for the initial open and for
    // every back/forward/playlist-jump track change.
    export function fsvLoadCurrentVideo() {
      if (!fsvState) return;
      hideFsvKnowledgeCheck();
      hideFsvAutoplayFallback();
      if (fsvState.autoplayCheckTimer) { clearTimeout(fsvState.autoplayCheckTimer); fsvState.autoplayCheckTimer = null; }
      const current = fsvState.videos[fsvState.index];
      const label = current.label || `Video ${fsvState.index + 1}`;
      const titleEl = document.getElementById('fsv-title');
      if (titleEl) titleEl.textContent = fsvState.contextTitle ? `${fsvState.contextTitle} — ${label}` : label;
      fsvSetPlayPauseIcon(false);
      fsvState.player = null;

      const iframe = document.getElementById('fsv-iframe');
      const videoEl = document.getElementById('fsv-video');
      const openedForVideos = fsvState.videos;
      const openedForIndex = fsvState.index;

      if (isDirectVideoUrl(current.url)) {
        // Direct video file (.mp4 etc.) — plain <video> element instead of the
        // YouTube iframe, wrapped in an adapter exposing the same
        // playVideo/pauseVideo/stopVideo/seekTo/getCurrentTime/getPlayerState
        // surface as YT.Player, so every other fsv control (play/pause button,
        // skip, close, the autoplay fallback, "Watch Again") works identically
        // no matter which kind of video is actually loaded.
        iframe.style.display = 'none';
        iframe.src = '';
        videoEl.style.display = 'block';
        videoEl.src = current.url;
        const startAt = parseInt(current.startSeconds, 10) || 0;
        videoEl.currentTime = startAt;
        if (startAt > 0) {
          // Setting currentTime before metadata has loaded doesn't reliably
          // "take" in every browser — this re-applies it once duration/seeking
          // is actually known, without fighting a user's own later seek.
          const applyStart = () => { videoEl.currentTime = startAt; videoEl.removeEventListener('loadedmetadata', applyStart); };
          videoEl.addEventListener('loadedmetadata', applyStart);
        }

        let hasStartedPlaying = false;
        const player = {
          playVideo: () => { const p = videoEl.play(); if (p && p.catch) p.catch(() => {}); },
          pauseVideo: () => videoEl.pause(),
          stopVideo: () => { videoEl.pause(); videoEl.currentTime = 0; },
          seekTo: (t) => { videoEl.currentTime = t; },
          getCurrentTime: () => videoEl.currentTime,
          getPlayerState: () => (videoEl.paused ? 2 : 1) // 1 mirrors YT.PlayerState.PLAYING, used by fsvTogglePlayPause
        };
        fsvState.player = player;

        videoEl.onplay = () => {
          if (!fsvState || fsvState.player !== player) return;
          hasStartedPlaying = true;
          hideFsvAutoplayFallback();
          fsvSetPlayPauseIcon(true);
        };
        videoEl.onpause = () => {
          if (!fsvState || fsvState.player !== player) return;
          fsvSetPlayPauseIcon(false);
        };
        videoEl.onended = () => {
          if (!fsvState || fsvState.player !== player) return;
          // Halt the track instead of auto-advancing when this video has a
          // Knowledge Check attached — see showFsvKnowledgeCheck.
          const finished = fsvState.videos[fsvState.index];
          if (finished && finished.quiz) showFsvKnowledgeCheck(finished.quiz);
          else fsvForwardTrack();
        };

        player.playVideo();

        // Same autoplay-blocked fallback as the YouTube path below.
        fsvState.autoplayCheckTimer = setTimeout(() => {
          if (fsvState && fsvState.videos === openedForVideos && fsvState.index === openedForIndex && !hasStartedPlaying) {
            showFsvAutoplayFallback();
          }
        }, 1200);

        fsvRenderPlaylist();
        return;
      }

      // Not a direct video file — reset the <video> element (in case the
      // previous track in this playlist was one) and fall through to YouTube.
      videoEl.style.display = 'none';
      videoEl.onplay = videoEl.onpause = videoEl.onended = null;
      videoEl.pause();
      videoEl.removeAttribute('src');
      videoEl.load();
      iframe.style.display = 'block';

      const embedUrl = toYouTubeEmbedUrl(current.url, current.startSeconds);
      if (!embedUrl) {
        // Not a recognized/embeddable link — best effort is to open it
        // externally rather than show a broken embed.
        window.open(current.url, '_blank', 'noopener');
        closeFsvPlayer();
        return;
      }
      iframe.src = embedUrl;
      let hasStartedPlaying = false;
      ensureYouTubeApiLoaded().then(function(YTApi) {
        // The player may have been closed, or moved to a different track,
        // while the API was still loading — only bind if we're still on
        // the same session's player and it hasn't been rebuilt since.
        if (!fsvState || fsvState.videos !== openedForVideos || fsvState.player) return;
        const iframeEl = document.getElementById('fsv-iframe');
        if (!iframeEl || iframeEl.tagName !== 'IFRAME') return;
        const player = new YTApi.Player('fsv-iframe', {
          events: {
            onStateChange: function(evt) {
              if (!fsvState || fsvState.player !== player) return;
              if (evt.data === YTApi.PlayerState.PLAYING) {
                hasStartedPlaying = true;
                hideFsvAutoplayFallback();
                fsvSetPlayPauseIcon(true);
              }
              else if (evt.data === YTApi.PlayerState.PAUSED) fsvSetPlayPauseIcon(false);
              else if (evt.data === YTApi.PlayerState.ENDED) {
                // Halt the track instead of auto-advancing when this video has a
                // Knowledge Check attached — see showFsvKnowledgeCheck.
                const finished = fsvState.videos[fsvState.index];
                if (finished && finished.quiz) showFsvKnowledgeCheck(finished.quiz);
                else fsvForwardTrack();
              }
            }
          }
        });
        fsvState.player = player;

        // Autoplay (autoplay=1 on the embed URL, plus allow="autoplay" on the
        // iframe) starts the video immediately in most browsers/contexts, but
        // some still block it (commonly unmuted autoplay in certain browser/
        // site-engagement combinations). Give it a brief window to actually
        // start; if it hasn't by then, show a one-tap fallback screen instead
        // of leaving YouTube's own blocked-thumbnail state sitting there.
        fsvState.autoplayCheckTimer = setTimeout(() => {
          if (fsvState && fsvState.videos === openedForVideos && fsvState.index === openedForIndex && !hasStartedPlaying) {
            showFsvAutoplayFallback();
          }
        }, 1200);
      });
      fsvRenderPlaylist();
    }

    export function showFsvAutoplayFallback() {
      const el = document.getElementById('fsv-autoplay-fallback');
      if (el) el.classList.add('show');
    }

    export function hideFsvAutoplayFallback() {
      const el = document.getElementById('fsv-autoplay-fallback');
      if (el) el.classList.remove('show');
    }

    // Tapping the fallback screen is a fresh, direct user gesture on our own
    // UI — this always succeeds even when the original automatic autoplay
    // attempt was blocked.
    export function fsvStartFromFallback() {
      hideFsvAutoplayFallback();
      if (fsvState && fsvState.player && fsvState.player.playVideo) fsvState.player.playVideo();
    }


    export function fsvSetPlayPauseIcon(isPlaying) {
      const btn = document.getElementById('fsv-playpause-btn');
      if (!btn) return;
      btn.title = isPlaying ? 'Pause' : 'Play';
      btn.innerHTML = isPlaying ? FSV_PAUSE_SVG : FSV_PLAY_SVG;
    }

    export function fsvTogglePlayPause() {
      if (!fsvState || !fsvState.player) return;
      const state = fsvState.player.getPlayerState ? fsvState.player.getPlayerState() : null;
      if (state === 1 /* PLAYING */) fsvState.player.pauseVideo(); else fsvState.player.playVideo();
    }

    export function fsvSkip(seconds) {
      if (!fsvState || !fsvState.player || !fsvState.player.getCurrentTime) return;
      const t = fsvState.player.getCurrentTime() + seconds;
      fsvState.player.seekTo(Math.max(0, t), true);
    }

    export function fsvStop() {
      if (!fsvState || !fsvState.player) return;
      try { fsvState.player.stopVideo(); } catch (e) { /* ignore */ }
      fsvSetPlayPauseIcon(false);
    }

    // No defined behavior for "back" at the very first track — just a no-op.
    export function fsvBackTrack() {
      if (!fsvState || fsvState.index <= 0) return;
      fsvState.index--;
      fsvLoadCurrentVideo();
    }

    // Forward on the last track closes the player instead of looping.
    export function fsvForwardTrack() {
      if (!fsvState) return;
      if (fsvState.index >= fsvState.videos.length - 1) {
        const ctx = fsvState.completionContext;
        // A session/lesson-level Knowledge Check (as opposed to one tied to a
        // specific video) shows here, at the end of the LAST video, whether
        // it's a TW Bible Course lesson (must be answered correctly — see
        // showFsvKnowledgeCheck/answerFsvKnowledgeCheck) or a Core-D session
        // (purely informational). Either way it can have several questions;
        // this starts at the first one (index 0) and
        // showFsvKnowledgeCheck/continueAfterFsvKnowledgeCheck step through
        // the rest.
        if (ctx && ctx.type === 'tw_lesson') {
          const mod = twBibleCourseData.find(m => m.id === ctx.moduleId);
          const lesson = mod && mod.lessons[ctx.lessonIndex];
          if (lesson && lesson.quizzes && lesson.quizzes.length > 0) { showFsvKnowledgeCheck(lesson.quizzes, ctx, 0); return; }
        } else if (ctx && ctx.type === 'foundations_session') {
          const item = foundationsList.find(i => i.dbId === ctx.classId);
          const session = item && (item.sessions || [])[ctx.sessionIndex];
          if (session && session.quizzes && session.quizzes.length > 0) { showFsvKnowledgeCheck(session.quizzes, null, 0); return; }
        }
        closeFsvPlayer();
        return;
      }
      fsvState.index++;
      fsvLoadCurrentVideo();
    }

    export function fsvJumpTo(i) {
      if (!fsvState || i < 0 || i >= fsvState.videos.length || i === fsvState.index) { fsvClosePlaylist(); return; }
      fsvState.index = i;
      fsvLoadCurrentVideo();
      fsvClosePlaylist();
    }

    export function fsvRenderPlaylist() {
      const panel = document.getElementById('fsv-playlist-panel');
      if (!panel || !fsvState) return;
      panel.innerHTML = fsvState.videos.map((v, i) => `
        <div class="fsv-playlist-item${i === fsvState.index ? ' active' : ''}" onclick="fsvJumpTo(${i})">${(v.label || `Video ${i + 1}`).replace(/</g, '&lt;')}</div>
      `).join('');
    }

    export function toggleFsvPlaylist() {
      const panel = document.getElementById('fsv-playlist-panel');
      if (panel) panel.classList.toggle('open');
    }
    export function fsvClosePlaylist() {
      const panel = document.getElementById('fsv-playlist-panel');
      if (panel) panel.classList.remove('open');
    }

    // Tapping the video itself toggles the whole control chrome (close X,
    // transport bar, session playlist link) — every button inside stops
    // propagation so pressing a control doesn't also trigger this toggle.
    export function toggleFsvControls() {
      if (!fsvState) return;
      fsvState.controlsVisible = !fsvState.controlsVisible;
      const controls = document.getElementById('fsv-controls');
      if (controls) controls.classList.toggle('visible', fsvState.controlsVisible);
      if (!fsvState.controlsVisible) fsvClosePlaylist();
    }
    export function fsvShowControls() {
      if (!fsvState) return;
      fsvState.controlsVisible = true;
      const controls = document.getElementById('fsv-controls');
      if (controls) controls.classList.add('visible');
    }

    export function closeFsvPlayer() {
      if (fsvState && fsvState.player) { try { fsvState.player.stopVideo(); } catch (e) { /* ignore */ } }
      if (fsvState && fsvState.autoplayCheckTimer) clearTimeout(fsvState.autoplayCheckTimer);
      const overlay = document.getElementById('fsv-player');
      if (overlay) overlay.classList.remove('open', 'mini');
      const iframe = document.getElementById('fsv-iframe');
      if (iframe) iframe.src = '';
      const videoEl = document.getElementById('fsv-video');
      if (videoEl) {
        videoEl.onplay = videoEl.onpause = videoEl.onended = null;
        videoEl.pause();
        videoEl.removeAttribute('src');
        videoEl.load();
        videoEl.style.display = 'none';
      }
      document.body.style.overflow = '';
      fsvClosePlaylist();
      hideFsvKnowledgeCheck();
      hideFsvAutoplayFallback();
      fsvState = null;
    }

    // ------------------------------------------------------------------
    // Knowledge Check overlay — one question at a time, large tappable
    // options, instant feedback, matching a modern course-platform feel
    // rather than a school quiz form.
    //
    // Two different behaviors share this same overlay, distinguished by
    // whether a twContext is passed in:
    //  - Foundations/Core-D videos (no twContext): a single question, any
    //    answer resolves it — right shows "Continue", wrong shows "Watch
    //    Again" / "Continue Anyway", same as before.
    //  - A TW Bible Course lesson (twContext set): the lesson can have
    //    MULTIPLE questions, walked through one at a time. ONLY a correct
    //    answer advances — a wrong answer just flashes red and lets them
    //    pick again, no "continue anyway" bypass. Getting every question
    //    right is the sole way a lesson (and eventually the whole Module)
    //    completes.
    // ------------------------------------------------------------------
    export let fsvKcState = null; // { quizzes, index, answered, twContext }

    // quizzes may be a single quiz object (Foundations' per-video call sites)
    // or an array (TW Bible Course lessons) — normalized to an array here so
    // the rest of this flow only ever deals with one shape.
    export function showFsvKnowledgeCheck(quizzes, twContext, questionIndex) {
      const list = Array.isArray(quizzes) ? quizzes : [quizzes];
      const index = questionIndex || 0;
      const quiz = list[index];
      if (!quiz) return;
      fsvKcState = { quizzes: list, index, answered: false, twContext: twContext || null };

      const overlay = document.getElementById('fsv-knowledge-check');
      const eyebrowEl = document.getElementById('fsv-kc-eyebrow');
      const qEl = document.getElementById('fsv-kc-question');
      const optsEl = document.getElementById('fsv-kc-options');
      const fbEl = document.getElementById('fsv-kc-feedback');
      const actionsEl = document.getElementById('fsv-kc-actions');
      if (!overlay || !qEl || !optsEl || !fbEl || !actionsEl) return;

      if (eyebrowEl) eyebrowEl.textContent = list.length > 1 ? `Knowledge Check — Question ${index + 1} of ${list.length}` : 'Knowledge Check';
      qEl.textContent = quiz.question;
      optsEl.innerHTML = quiz.options.map((opt, i) =>
        `<button type="button" class="fsv-kc-option" onclick="answerFsvKnowledgeCheck(${i})">${escapeHtml(opt)}</button>`
      ).join('');
      fbEl.style.display = 'none';
      fbEl.className = 'fsv-kc-feedback';
      fbEl.innerHTML = '';
      actionsEl.style.display = 'none';
      actionsEl.innerHTML = '';
      overlay.classList.add('open');
    }

    export function hideFsvKnowledgeCheck() {
      const overlay = document.getElementById('fsv-knowledge-check');
      if (overlay) overlay.classList.remove('open');
      fsvKcState = null;
    }

    export function answerFsvKnowledgeCheck(selectedIndex) {
      if (!fsvKcState || fsvKcState.answered) return;
      const { quizzes, index, twContext } = fsvKcState;
      const quiz = quizzes[index];
      const correct = selectedIndex === quiz.correctIndex;

      // TW Bible Course: a wrong answer doesn't resolve anything — flash it
      // red briefly and let them try again, with no way to move on except
      // getting it right.
      if (twContext && !correct) {
        const btn = document.querySelectorAll('#fsv-kc-options .fsv-kc-option')[selectedIndex];
        if (btn) btn.classList.add('incorrect');
        const fbEl = document.getElementById('fsv-kc-feedback');
        fbEl.className = 'fsv-kc-feedback incorrect';
        fbEl.style.display = 'block';
        fbEl.innerHTML = `<span class="fsv-kc-feedback-title">Not quite.</span>Give it another try.`;
        setTimeout(() => {
          if (btn) btn.classList.remove('incorrect');
          if (fsvKcState && !fsvKcState.answered) fbEl.style.display = 'none';
        }, 1600);
        return; // stays unanswered — retryable
      }

      fsvKcState.answered = true;
      document.querySelectorAll('#fsv-kc-options .fsv-kc-option').forEach((btn, i) => {
        btn.classList.add('disabled');
        if (i === quiz.correctIndex) btn.classList.add('correct');
        else if (i === selectedIndex) btn.classList.add('incorrect');
      });

      const fbEl = document.getElementById('fsv-kc-feedback');
      fbEl.className = `fsv-kc-feedback ${correct ? 'correct' : 'incorrect'}`;
      fbEl.style.display = 'block';
      fbEl.innerHTML = `<span class="fsv-kc-feedback-title">${correct ? 'Correct!' : 'Not quite.'}</span>${quiz.explanation ? escapeHtml(quiz.explanation) : ''}`;

      const actionsEl = document.getElementById('fsv-kc-actions');
      actionsEl.style.display = 'flex';
      if (twContext) {
        // Only reachable here when correct (wrong answers returned above).
        const isLastQuestion = index >= quizzes.length - 1;
        actionsEl.innerHTML = `<button type="button" class="fsv-kc-btn-primary" onclick="continueAfterFsvKnowledgeCheck()">${isLastQuestion ? 'Continue' : 'Next Question'}</button>`;
      } else {
        actionsEl.innerHTML = correct
          ? `<button type="button" class="fsv-kc-btn-primary" onclick="continueAfterFsvKnowledgeCheck()">Continue</button>`
          : `<button type="button" class="fsv-kc-btn-secondary" onclick="rewatchFsvClip()">Watch Again</button>
             <button type="button" class="fsv-kc-btn-primary" onclick="continueAfterFsvKnowledgeCheck()">Continue Anyway</button>`;
      }
    }

    export function continueAfterFsvKnowledgeCheck() {
      const state = fsvKcState;
      if (!state) return;
      const isLastQuestion = state.index >= state.quizzes.length - 1;
      if (!isLastQuestion) {
        // Next question — re-show the overlay fresh rather than hiding it, so
        // it reads as one continuous Knowledge Check (whether it's a TW
        // lesson or a Core-D session) rather than several separate popups.
        showFsvKnowledgeCheck(state.quizzes, state.twContext, state.index + 1);
        return;
      }
      hideFsvKnowledgeCheck();
      if (state.twContext) {
        closeFsvPlayer();
        markTWLessonComplete(state.twContext.moduleId, state.twContext.lessonIndex);
        return;
      }
      fsvForwardTrack();
    }

    export function rewatchFsvClip() {
      hideFsvKnowledgeCheck();
      if (fsvState && fsvState.player && fsvState.player.seekTo) {
        fsvState.player.seekTo(0, true);
        fsvState.player.playVideo();
      }
    }