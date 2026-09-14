const test = require('node:test');
const assert = require('node:assert');
const { checkAllModules } = require('./checkDependencies.js');

test('every table accessor referenced in shared/*.js is actually imported', () => {
  const results = checkAllModules();
  const failures = results.filter(r => r.missing.length > 0);
  if (failures.length > 0) {
    const detail = failures.map(f => `${f.file}: missing ${f.missing.join(', ')}`).join('\n');
    assert.fail(`Found module(s) using a table accessor they never imported:\n${detail}`);
  }
});
