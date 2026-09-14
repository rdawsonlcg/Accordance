// tests/foundationsHeroVideoSizing.test.js — covers a reported bug ("Core-D
// lesson preview videos aren't filling the full container"): the hero
// preview video's size was calculated once, synchronously, right after the
// hero's HTML was inserted -- before the page's custom heading webfont
// (Bebas Neue, loaded with font-display:swap) necessarily finished
// downloading. The title renders in a fallback font in the meantime, which
// measures shorter than Bebas Neue does for a large, condensed display
// font like this one, so the hero banner's real content height (and
// therefore the video's cover-sizing calculation) could still grow once
// the real font swapped in moments later -- with nothing to re-run the
// sizing calculation afterward, the video stayed sized for the smaller,
// pre-swap measurement, visibly failing to cover the now-larger banner.
//
// jsdom doesn't implement document.fonts at all (confirmed directly, not
// assumed), so these tests mock it themselves to simulate the exact
// scenario: a font that "finishes loading" after the initial measurement,
// during which the container's real size turns out to have grown.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./helpers/loadApp.js');
const testExports = require('./testExports.js');

test('scheduleFoundationsHeroVideoBgRecheck re-sizes the video once document.fonts.ready resolves, using the container\'s size AT THAT TIME', async () => {
  const { window } = await loadApp({
    html: `
      <div class="foundations-hero-video-bg" id="hero-wrap">
        <iframe src="https://example.com/embed"></iframe>
      </div>
    `,
    extraExportNames: ['sizeFoundationsHeroVideoBg', 'scheduleFoundationsHeroVideoBgRecheck'],
    extraSource: `import { scheduleFoundationsHeroVideoBgRecheck } from './shared/coreD.js';`,
  });

  const wrap = window.document.getElementById('hero-wrap');
  // Simulate the pre-font-swap measurement: a smaller height, as if the
  // fallback font made the title (and so the banner) shorter than it will
  // end up being.
  Object.defineProperty(wrap, 'clientWidth', { value: 600, configurable: true });
  Object.defineProperty(wrap, 'clientHeight', { value: 200, configurable: true });

  window.sizeFoundationsHeroVideoBg();
  const iframe = wrap.querySelector('iframe');
  const widthAfterFirstMeasurement = iframe.style.width;
  assert.ok(widthAfterFirstMeasurement, 'the initial synchronous measurement should size the iframe');

  // Mock document.fonts.ready resolving -- and simulate the banner having
  // grown taller in the meantime, exactly as Bebas Neue swapping in for a
  // large title would do.
  let resolveFontsReady;
  window.document.fonts = { ready: new Promise(resolve => { resolveFontsReady = resolve; }) };
  window.scheduleFoundationsHeroVideoBgRecheck();

  Object.defineProperty(wrap, 'clientHeight', { value: 350, configurable: true }); // the banner grew
  resolveFontsReady();
  await window.document.fonts.ready;
  await new Promise(resolve => setImmediate(resolve)); // let the .then() callback actually run

  const widthAfterFontsReady = iframe.style.width;
  assert.notStrictEqual(widthAfterFontsReady, widthAfterFirstMeasurement, 'the video should be re-sized once fonts finish loading, using the container\'s real (now taller) size -- not stuck at the original, too-small measurement');
});

test('scheduleFoundationsHeroVideoBgRecheck does not throw when document.fonts does not exist (older browsers, and jsdom itself)', async () => {
  const { window } = await loadApp({
    extraExportNames: ['scheduleFoundationsHeroVideoBgRecheck'],
    extraSource: `import { scheduleFoundationsHeroVideoBgRecheck } from './shared/coreD.js';`,
  });
  // document.fonts is confirmed NOT implemented by jsdom at all -- this
  // test is really just confirming the guard in the real source code
  // (`if (document.fonts && document.fonts.ready)`) actually protects
  // against that, using the exact environment where it's already missing.
  assert.strictEqual(typeof window.document.fonts, 'undefined');
  assert.doesNotThrow(() => window.scheduleFoundationsHeroVideoBgRecheck());
});
