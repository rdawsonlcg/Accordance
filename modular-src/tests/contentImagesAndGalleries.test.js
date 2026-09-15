// tests/contentImagesAndGalleries.test.js — covers the new "insert an image"
// and "insert a gallery" admin features for TW Bible Course and Core-D
// (shared/adminUtils.js's applyContentFormat, and shared/coreD.js's
// applyFoundationsMarkup/renderFoundationsImageGalleryHtml/galleryPrevSlide/
// galleryNextSlide -- reused as-is by TW via its own applyTWCourseAdminFormat
// wrapper, so only tested once here rather than duplicated per feature).
//
// By the Book was NOT given this feature: its sessions have no rich-text
// "content" field at all currently (only title, type, url, and presenter
// fields) -- there's nowhere for inserted image/gallery markdown to live
// or be rendered for that feature without first building an entirely
// separate content field for it, which is its own, larger piece of work.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./helpers/loadApp.js');
const testExports = require('./testExports.js');

test('a single image line renders as one plain <img>, not a gallery', async () => {
  const { window } = await loadApp({
    extraExportNames: [...testExports.coreD],
  });

  const html = window.renderFoundationsContentHtml('Some text.\n\n![A lovely view](https://example.com/photo.jpg)\n\nMore text.');
  assert.ok(html.includes('<img src="https://example.com/photo.jpg" alt="A lovely view" class="foundations-content-image"'));
  assert.ok(!html.includes('foundations-gallery'), 'a single image should not be wrapped as a gallery');
});

test('the existing [text](url) link syntax still works, and is not confused with image syntax', async () => {
  const { window } = await loadApp({
    extraExportNames: [...testExports.coreD],
  });

  const html = window.renderFoundationsContentHtml('See [our website](https://example.com) for more.');
  assert.ok(html.includes('<a href="https://example.com" target="_blank" rel="noopener">our website</a>'));
  assert.ok(!html.includes('<img'), 'a real link should never accidentally render as an image');
});

test('two or more consecutive image lines become one gallery with the right number of slides', async () => {
  const { window } = await loadApp({
    extraExportNames: [...testExports.coreD],
  });

  const html = window.renderFoundationsContentHtml(
    '![Slide one](https://example.com/1.jpg)\n![Slide two](https://example.com/2.jpg)\n![Slide three](https://example.com/3.jpg)'
  );

  assert.ok(html.includes('class="foundations-gallery"'));
  assert.ok(html.includes('data-count="3"'));
  assert.strictEqual((html.match(/foundations-gallery-slide/g) || []).length, 4, 'expected 3 <img> slides plus one "active" class also matching the substring, i.e. 3 real slides'); // 3 slide divs + 1 extra "active" on the first
  assert.ok(html.includes('1 / 3'));
  assert.ok(html.includes('Slide one') && html.includes('Slide two') && html.includes('Slide three'));
});

test('galleryNextSlide and galleryPrevSlide move between slides and wrap around at either end', async () => {
  const { window } = await loadApp({
    html: '<div id="content"></div>',
    extraExportNames: [...testExports.coreD, 'galleryNextSlide', 'galleryPrevSlide'],
  });

  const html = window.renderFoundationsContentHtml(
    '![One](https://example.com/1.jpg)\n![Two](https://example.com/2.jpg)\n![Three](https://example.com/3.jpg)'
  );
  window.document.getElementById('content').innerHTML = html;

  const gallery = window.document.querySelector('.foundations-gallery');
  const galleryId = gallery.id;
  const counter = () => window.document.getElementById(galleryId).querySelector('.foundations-gallery-counter').textContent;
  const activeAlt = () => window.document.getElementById(galleryId).querySelector('.foundations-gallery-slide.active').alt;

  assert.strictEqual(activeAlt(), 'One');
  assert.strictEqual(counter(), '1 / 3');

  window.galleryNextSlide(galleryId);
  assert.strictEqual(activeAlt(), 'Two');
  assert.strictEqual(counter(), '2 / 3');

  window.galleryNextSlide(galleryId);
  window.galleryNextSlide(galleryId); // should wrap back to the first slide
  assert.strictEqual(activeAlt(), 'One');
  assert.strictEqual(counter(), '1 / 3');

  window.galleryPrevSlide(galleryId); // should wrap backward to the last slide
  assert.strictEqual(activeAlt(), 'Three');
  assert.strictEqual(counter(), '3 / 3');
});

test('a quote character in image alt text cannot break out of the <img> attributes', async () => {
  const { window } = await loadApp({
    extraExportNames: [...testExports.coreD],
  });

  // The URL portion of the regex ([^)\s]+) already can't contain a space at
  // all (the same shape as the existing link syntax), so a URL genuinely
  // can't carry a quote-plus-injected-attribute this way in the first
  // place -- alt text has no such restriction, though, so that's the
  // realistic place a stray " could actually reach this code and need
  // escaping. escapeFoundationsHtml (run before this) only escapes
  // &/</>, not ", so a raw " really does reach applyFoundationsMarkup
  // unescaped -- confirming the explicit &quot; escaping added alongside
  // the image/gallery feature is actually doing something, not redundant.
  const html = window.renderFoundationsContentHtml('![test" onerror="alert(1)](https://example.com/photo.jpg)');
  assert.ok(!html.includes('onerror="alert'), 'a quote in the alt text must not be able to inject a new, live HTML attribute');
  assert.ok(html.includes('&quot;'), 'the quote should show up escaped, not silently dropped');
});

test('applyContentFormat (kind: "image") inserts markdown image syntax with the alt text selected for editing', async () => {
  const { window } = await loadApp({
    html: '<textarea id="ta"></textarea>',
    extraExportNames: ['applyContentFormat'],
  });
  window.prompt = () => 'https://example.com/photo.jpg';

  const textarea = window.document.getElementById('ta');
  let savedValue = '';
  window.applyContentFormat(textarea, (v) => { savedValue = v; }, 'image');

  assert.strictEqual(savedValue.trim(), '![image description](https://example.com/photo.jpg)');
  assert.strictEqual(textarea.value.substring(textarea.selectionStart, textarea.selectionEnd), 'image description');
});

test('applyContentFormat (kind: "gallery") inserts a two-image starter block', async () => {
  const { window } = await loadApp({
    html: '<textarea id="ta"></textarea>',
    extraExportNames: ['applyContentFormat'],
  });

  const textarea = window.document.getElementById('ta');
  let savedValue = '';
  window.applyContentFormat(textarea, (v) => { savedValue = v; }, 'gallery');

  assert.ok(savedValue.includes('![First image](https://...)'));
  assert.ok(savedValue.includes('![Second image](https://...)'));
  // The first placeholder URL should be selected, ready to be typed over.
  assert.strictEqual(textarea.value.substring(textarea.selectionStart, textarea.selectionEnd), 'https://...');
});
