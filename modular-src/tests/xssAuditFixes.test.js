// tests/xssAuditFixes.test.js — covers real, confirmed HTML-injection gaps
// found during a code-level security audit (requested after the RLS/
// database audit was completed). Each was confirmed exploitable, not just
// theoretical, by tracing the value back to its actual data source and
// checking whether any escaping already happened upstream before assuming
// a gap existed -- e.g. Cords message links turned out to already be safe
// (escapeHtml runs on the whole message before the URL is ever extracted
// from it), which is why that one isn't listed as a fix here.
//
// This is NOT a complete fix for every instance of this pattern in the
// codebase -- a broader sweep during this same session found many more
// admin-entered title/name fields (module titles, badge titles, presenter
// names, cord names, etc.) rendered as plain text content the same
// unescaped way. Those are a real, further piece of work, reported
// separately rather than rushed through here without the same care taken
// confirming and testing each one below.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./helpers/loadApp.js');
const testExports = require('./testExports.js');

test('a quote in a Church Resources link URL cannot break out of the href attribute', async () => {
  const { window } = await loadApp({
    html: '<div id="church-resources-list-0"></div>',
    extraExportNames: [...testExports.churchResources],
  });
  window.churchResourcesMap[0] = [{ id: 1, resource: 'https://example.com/"onmouseover="alert(1)', title: 'A resource', notes: null }];
  window.updateChurchResourcesDOM(0, 'John 3:16');
  const html = window.document.getElementById('church-resources-list-0').innerHTML;
  assert.ok(!html.includes('onmouseover="alert'), 'a quote in the resource URL must not be able to inject a new live attribute');
});

test('raw HTML in a Church Resources "notes" field is rendered as inert text, not live markup (the most severe finding: full script injection, not just an attribute breakout)', async () => {
  const { window } = await loadApp({
    html: '<div id="church-resources-list-0"></div>',
    extraExportNames: [...testExports.churchResources],
  });
  window.churchResourcesMap[0] = [{ id: 1, resource: null, title: 'A resource', notes: '<img src=x onerror=alert(1)>' }];
  window.updateChurchResourcesDOM(0, 'John 3:16');
  const html = window.document.getElementById('church-resources-list-0').innerHTML;
  assert.ok(!html.includes('<img src=x'), 'raw HTML typed into a notes field must never be inserted as live markup');
  assert.ok(html.includes('&lt;img'), 'it should show up escaped, not silently dropped');
});

test('renderRecordIconHtml escapes a quote in a custom image-URL icon', async () => {
  const { window } = await loadApp({
    extraExportNames: ['renderRecordIconHtml'],
  });
  const html = window.renderRecordIconHtml('https://example.com/badge.png" onerror="alert(1)');
  assert.ok(!html.includes('onerror="alert'), 'a quote in a custom badge icon URL must not be able to inject a new attribute');
  assert.ok(html.includes('&quot;'));
});

test('renderRecordIconHtml escapes raw HTML in a non-URL (emoji-expected) icon value', async () => {
  const { window } = await loadApp({
    extraExportNames: ['renderRecordIconHtml'],
  });
  const html = window.renderRecordIconHtml('<img src=x onerror=alert(1)>');
  assert.ok(!html.includes('<img src=x'), 'text expected to be a plain emoji must not be able to inject real HTML instead');
  assert.ok(html.includes('&lt;img'));
});

test('the content-renderer link syntax escapes a quote in its URL (matches the earlier image/gallery fix)', async () => {
  const { window } = await loadApp({
    extraExportNames: [...testExports.coreD],
  });
  const html = window.renderFoundationsContentHtml('[click here](https://example.com/"onmouseover="alert(1))');
  assert.ok(!html.includes('onmouseover="alert'), 'a quote in a content link URL must not be able to inject a new attribute');
});

test('By the Book: a quote in a presenter photo URL or name cannot break out of the <img> attributes', async () => {
  const { window } = await loadApp({
    html: '<div id="bible-study-info-panel"></div>',
    extraExportNames: [...testExports.byTheBook],
  });
  const cfg = {
    live: true,
    title: 'Job',
    presenters: [{ name: 'Pastor "Bob"', photo: 'https://example.com/photo.jpg" onerror="alert(1)' }],
    sessions: [],
  };
  window.renderBibleStudyInfoPanel(cfg);
  // The real signal here is what the browser's OWN html parser resolved
  // the attribute to, not a plain substring search on the raw HTML text --
  // a quote elsewhere in this same output (e.g. the plain-text "Presented
  // by [name]" label a few lines down) is completely harmless on its own,
  // since quotes have no special meaning outside an attribute. If escaping
  // had failed here, the parser would have cut the alt/src attribute short
  // at the injected quote instead of reading the full intended value.
  const img = window.document.querySelector('#bible-study-info-panel img');
  assert.strictEqual(img.getAttribute('alt'), 'Pastor "Bob"', 'the full name should survive intact as the alt attribute\'s actual value');
  assert.strictEqual(img.getAttribute('src'), 'https://example.com/photo.jpg" onerror="alert(1)', 'the full URL should survive intact as the src attribute\'s actual value, not get cut short by an unescaped quote');
  assert.strictEqual(img.onerror, null, 'no onerror handler should have actually been created on the element');
});
