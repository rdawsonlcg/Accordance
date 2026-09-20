// tests/searchResultsPagination.test.js — regression test for a real bug:
// clicking a page number in Bible search results did nothing, because the
// page-number buttons' onclick attribute directly assigned to currentPage
// (onclick="currentPage=${i}; renderSearchResults();"). Inline onclick
// attributes execute in the global scope, but currentPage is a `let`
// declared inside app.js's own bundled closure -- in the app's actual,
// non-strict-mode bundle (confirmed directly: no "use strict" appears
// anywhere in the built output), assigning to an undeclared name like that
// silently creates a brand new, unrelated global variable instead of
// throwing, rather than reaching the real, closure-scoped currentPage that
// renderSearchResults() actually reads. So every click quietly changed a
// variable nothing else used, while the real currentPage stayed frozen at
// whatever it was (1, from executeSearchQuery, since nothing else inside
// the app's own code ever changed it) -- every page number, when clicked,
// re-rendered page 1's results again.
//
// Fixed with a real function (goToSearchResultsPage) that the onclick
// calls instead of assigning directly -- a real function call, unlike a
// bare assignment, correctly resolves to the closure-scoped currentPage
// through the app's own scope chain.

const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./helpers/loadApp.js');

test('clicking a different page number in search results actually shows that page\'s results', async () => {
  const { window } = await loadApp({
    html: '<div id="bible-text"></div><div id="pagination-area"></div>',
    extraExportNames: ['renderSearchResults', '__setKeywordResultsForTest'],
  });

  // 45 results at 20 per page (RESULTS_PER_PAGE) makes exactly 3 pages,
  // with page 2 and page 3 each containing distinguishable references.
  const results = [];
  for (let i = 1; i <= 45; i++) results.push({ reference: `Genesis 1:${i}`, text: `verse text ${i}` });
  window.__setKeywordResultsForTest(results);
  window.renderSearchResults();

  const pageButtons = window.document.querySelectorAll('#pagination-area button');
  assert.strictEqual(pageButtons.length, 3, 'expected exactly 3 page buttons for 45 results at 20 per page');

  // Confirm page 1's content is showing initially.
  assert.ok(window.document.getElementById('bible-text').innerHTML.includes('Genesis 1:1<'), 'page 1 should show the first results initially');
  assert.ok(!window.document.getElementById('bible-text').innerHTML.includes('Genesis 1:21<'), 'page 1 should not yet show page 2\'s results');

  // A REAL click on the page 2 button, not a direct function call --
  // exactly the interaction that was actually broken.
  pageButtons[1].click();

  const htmlAfterClick = window.document.getElementById('bible-text').innerHTML;
  assert.ok(htmlAfterClick.includes('Genesis 1:21<'), 'clicking page 2 should now show its results (verse 21, the first on page 2)');
  assert.ok(!htmlAfterClick.includes('Genesis 1:1<'), 'clicking page 2 should no longer show page 1\'s first result');
  assert.ok(window.document.querySelectorAll('#pagination-area button')[1].classList.contains('active'), 'the page 2 button should now show as the active page');

  // And a second click, to page 3, confirming this isn't a one-time fluke
  // (e.g. something that happened to work only for the very first click).
  window.document.querySelectorAll('#pagination-area button')[2].click();
  const htmlAfterSecondClick = window.document.getElementById('bible-text').innerHTML;
  assert.ok(htmlAfterSecondClick.includes('Genesis 1:41<'), 'clicking page 3 should show its results (verse 41, the first on page 3)');
});
