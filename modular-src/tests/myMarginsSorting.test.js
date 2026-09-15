// tests/myMarginsSorting.test.js — covers a real, requested change: My
// Margins entries used to render in whatever order
// window.userMarginNotes's object keys happened to iterate in (reflecting
// creation order, or whatever order the margin_notes table returned rows
// in) -- essentially arbitrary once printed as a page of notes, rather
// than a genuinely useful study aid. Fixed by sorting Genesis-to-Revelation:
// book (canonical order), then chapter, then verse.
//
// parseMyMarginsReference specifically matches against
// BIBLE_STUDIES_BOOK_ORDER's real book names rather than naively splitting
// a reference on its first space, since several books have one in their
// own name ("1 Corinthians", "Song of Solomon") -- a naive split would cut
// those in half and misparse the chapter/verse entirely. This file's
// second test exists specifically to prove that distinction matters, not
// just that some sorting happens.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./helpers/loadApp.js');
const testExports = require('./testExports.js');

test('My Margins entries render in Genesis-to-Revelation order, not creation order', async () => {
  const { window } = await loadApp({
    html: '<div id="mymargins-print-area"></div>',
    extraExportNames: ['renderMyMargins'],
  });

  // Deliberately out of biblical order, and out of numeric order within
  // the same book, to actually exercise the sort rather than coincidentally
  // pass if nothing sorted at all.
  window.userMarginNotes = {
    'Revelation 22:21': { text: 'Last book, last verse', color: '#000000' },
    'Genesis 1:1': { text: 'First book, first verse', color: '#000000' },
    'Genesis 3:1': { text: 'Later chapter, same book', color: '#000000' },
    'Genesis 1:10': { text: 'Same chapter, later verse', color: '#000000' },
    'Exodus 2:5': { text: 'Second book', color: '#000000' },
  };

  window.renderMyMargins();
  const html = window.document.getElementById('mymargins-print-area').innerHTML;

  const positions = [
    'Genesis 1:1', 'Genesis 1:10', 'Genesis 3:1', 'Exodus 2:5', 'Revelation 22:21',
  ].map(ref => html.indexOf(ref));

  assert.ok(positions.every(p => p !== -1), 'expected every reference to actually appear in the rendered output');
  for (let i = 1; i < positions.length; i++) {
    assert.ok(positions[i] > positions[i - 1], `expected "${['Genesis 1:1', 'Genesis 1:10', 'Genesis 3:1', 'Exodus 2:5', 'Revelation 22:21'][i]}" to appear after "${['Genesis 1:1', 'Genesis 1:10', 'Genesis 3:1', 'Exodus 2:5', 'Revelation 22:21'][i - 1]}" in Genesis-to-Revelation order`);
  }
});

test('parseMyMarginsReference correctly handles multi-word book names, not just the first space', async () => {
  const { window } = await loadApp({
    extraExportNames: ['parseMyMarginsReference'],
  });

  const corinthians = window.parseMyMarginsReference('1 Corinthians 13:4');
  const song = window.parseMyMarginsReference('Song of Solomon 2:1');
  const genesis = window.parseMyMarginsReference('Genesis 1:1');
  const john1 = window.parseMyMarginsReference('1 John 4:8');

  // A naive split-on-first-space would parse "1 Corinthians 13:4" as book
  // "1", chapter/verse from "Corinthians 13:4" -- garbage. Confirm the real
  // book was matched and the chapter/verse parsed from what's actually left.
  assert.strictEqual(corinthians.chapter, 13);
  assert.strictEqual(corinthians.verse, 4);
  assert.strictEqual(song.chapter, 2);
  assert.strictEqual(song.verse, 1);
  assert.strictEqual(john1.chapter, 4);
  assert.strictEqual(john1.verse, 8);

  // And confirm canonical ordering: Genesis before 1 Corinthians before Song
  // of Solomon before 1 John (Old Testament wisdom books before New
  // Testament, then early NT before the General Epistles).
  assert.ok(genesis.bookIndex < song.bookIndex);
  assert.ok(song.bookIndex < corinthians.bookIndex);
  assert.ok(corinthians.bookIndex < john1.bookIndex);
});
