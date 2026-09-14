// tests/foundationsHeroVideoLoop.test.js — regression test for a reported
// bug (screenshot showed skip-back/pause/skip-forward icons visibly
// overlaid on a Core-D hero preview video): the preview looped a single
// video via the standard "loop=1&playlist=<same video id>" URL trick,
// which makes YouTube treat it as a real (if one-item) playlist -- and
// YouTube can briefly show its own playlist previous/next navigation
// overlay because of that, regardless of the controls=0 parameter also
// set (that parameter hides the NORMAL player controls; the playlist
// navigation overlay is a separate UI layer it doesn't affect). Since this
// preview is muted, autoplaying, pointer-events:none decoration that
// nothing should ever need to interact with, the fix removes the loop/
// playlist URL trick entirely and instead loops the video manually via the
// real YouTube IFrame API's onStateChange event -- ended -> seek to 0,
// play again -- which never involves the "playlist" concept at all, and so
// never triggers that overlay.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./helpers/loadApp.js');
const testExports = require('./testExports.js');

test('toYouTubeMutedPreviewEmbedUrl no longer uses the loop=1&playlist= URL trick, and enables the JS API instead', async () => {
  const { window } = await loadApp({
    extraExportNames: ['toYouTubeMutedPreviewEmbedUrl'],
  });

  const embedUrl = window.toYouTubeMutedPreviewEmbedUrl('https://www.youtube.com/watch?v=abc12345678');
  assert.ok(embedUrl, 'expected a real embed URL for a valid YouTube link');
  assert.ok(!embedUrl.includes('loop=1'), 'the loop=1 URL trick should be gone -- looping is now done manually via the API');
  assert.ok(!embedUrl.includes('playlist='), 'the playlist= URL trick should be gone -- this is exactly what caused YouTube\'s own playlist-navigation overlay to appear');
  assert.ok(embedUrl.includes('controls=0'), 'the normal player controls should still be hidden');
  assert.ok(embedUrl.includes('enablejsapi=1'), 'the JS API needs to be enabled for manual looping to be possible at all');
});

test('initFoundationsHeroVideoPreviewPlayer loops the video manually via onStateChange, without ever using a playlist', async () => {
  const { window } = await loadApp({
    html: `
      <div class="foundations-hero-video-bg">
        <iframe id="hero-iframe" src="https://example.com/embed"></iframe>
      </div>
    `,
    extraExportNames: ['initFoundationsHeroVideoPreviewPlayer'],
    extraSource: `import { initFoundationsHeroVideoPreviewPlayer } from './shared/videoPlayer.js';`,
  });

  // Minimal mock of the real YouTube IFrame API -- just enough to prove
  // the ended -> seek(0) -> play sequence actually happens, and that a
  // real YT.Player gets constructed against the real rendered iframe
  // (not some other element).
  let capturedOnStateChange = null;
  let capturedOnReady = null;
  let seekToCalls = [];
  let playVideoCalls = 0;
  let muteCalls = 0;
  window.YT = {
    PlayerState: { ENDED: 0 },
    Player: function (iframeOrId, options) {
      const targetIframe = typeof iframeOrId === 'string' ? window.document.getElementById(iframeOrId) : iframeOrId;
      assert.strictEqual(targetIframe, window.document.getElementById('hero-iframe'), 'the player should attach to the real, already-rendered hero iframe');
      capturedOnStateChange = options.events.onStateChange;
      capturedOnReady = options.events.onReady;
    },
  };

  window.initFoundationsHeroVideoPreviewPlayer();
  await new Promise(resolve => setImmediate(resolve));

  assert.ok(capturedOnStateChange, 'expected a YT.Player to have been constructed with an onStateChange handler');
  assert.ok(capturedOnReady, 'expected a YT.Player to have been constructed with an onReady handler');

  // onReady should force play (and re-mute) -- ruling out attaching the API
  // itself leaving the preview in a paused state some other way.
  capturedOnReady({ target: { mute: () => muteCalls++, playVideo: () => playVideoCalls++ } });
  assert.strictEqual(muteCalls, 1, 'onReady should explicitly (re-)mute the player');
  assert.strictEqual(playVideoCalls, 1, 'onReady should explicitly force playback, ruling out the API attachment itself leaving this paused');

  const fakeEndedEvent = {
    data: 0, // YT.PlayerState.ENDED
    target: { seekTo: (t) => seekToCalls.push(t), playVideo: () => playVideoCalls++ },
  };
  capturedOnStateChange(fakeEndedEvent);

  assert.deepStrictEqual(seekToCalls, [0], 'the video ending should seek back to the start');
  assert.strictEqual(playVideoCalls, 2, 'the video ending should play again -- this IS the loop, done manually instead of via the URL trick (2, not 1, since onReady already called playVideo once above)');
});
